import { AudioContext } from "react-native-audio-api";

import { acceptSchedule, assignStartTimes, CONTEXT_LEAD_SECONDS, placeWindowOnOrigin, SAMPLE_RATE, type TransportOrigin, type VoicePlan } from "./plan";

type LiveContext = {
  currentTime: number;
  sampleRate: number;
  state?: string;
  destination: unknown;
  resume: () => Promise<void>;
  createBuffer: (channels: number, length: number, sampleRate: number) => {
    copyToChannel: (source: Float32Array, channel: number) => void;
  };
  createBufferSource: () => {
    buffer: unknown;
    connect: (destination: unknown) => void;
    start: (when: number) => void;
    stop: () => void;
  };
};

type Group = "transport" | "tap";

let live: LiveContext | null = null;
const active: Record<Group, Array<{ stop: () => void }>> = { transport: [], tap: [] };
const tickets: Record<Group, number> = { transport: 0, tap: 0 };

function tone(hz: number, amplitude: number, durationSeconds: number, sampleRate: number): Float32Array {
  const length = Math.max(1, Math.round(durationSeconds * sampleRate));
  const fade = Math.min(Math.round(0.01 * sampleRate), Math.floor(length / 4));
  const samples = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    let envelope = 1;
    if (index < fade) envelope = index / fade;
    if (index >= length - fade) envelope = Math.min(envelope, (length - index) / fade);
    samples[index] = Math.sin((2 * Math.PI * hz * index) / sampleRate) * amplitude * envelope;
  }
  return samples;
}

export async function audioContext(): Promise<LiveContext> {
  if (!live) live = new AudioContext({ sampleRate: SAMPLE_RATE }) as LiveContext;
  if (live.state === "suspended") await live.resume();
  return live;
}

export async function readAudioTime(): Promise<number | null> {
  if (!live) return null;
  return live.currentTime;
}

function stopGroup(group: Group) {
  for (const source of active[group]) {
    try {
      source.stop();
    } catch {
      // A finished voice can reject stop.
    }
  }
  active[group] = [];
}

export function stopAudio(group?: Group) {
  if (group) {
    tickets[group] += 1;
    stopGroup(group);
    return;
  }
  stopAudio("transport");
  stopAudio("tap");
}

async function prepare(context: LiveContext, plans: VoicePlan[], ticket: number, group: Group) {
  if (!acceptSchedule(ticket, tickets[group]) || plans.length === 0) return [];
  const sampleRate = context.sampleRate || SAMPLE_RATE;
  const prepared = plans.map((plan) => {
    const samples = tone(plan.hz, plan.amplitude, plan.durationSeconds, sampleRate);
    const buffer = context.createBuffer(1, samples.length, sampleRate);
    buffer.copyToChannel(samples, 0);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    return source;
  });
  if (!acceptSchedule(ticket, tickets[group])) return [];
  return prepared;
}

export async function beginTransport(plans: VoicePlan[], originBeat: number, bpm: number) {
  const ticket = tickets.transport + 1;
  tickets.transport = ticket;
  stopGroup("transport");
  const context = await audioContext();
  if (!acceptSchedule(ticket, tickets.transport)) return null;
  const prepared = await prepare(context, plans, ticket, "transport");
  if (!acceptSchedule(ticket, tickets.transport)) return null;
  const origin: TransportOrigin = { beat: originBeat, contextTime: context.currentTime + CONTEXT_LEAD_SECONDS };
  const timed = placeWindowOnOrigin(plans, origin, originBeat, bpm);
  timed.forEach((plan, index) => {
    prepared[index]?.start(plan.startAtContextTime);
    if (prepared[index]) active.transport.push(prepared[index]);
  });
  return {
    origin,
    voices: timed.map((plan) => ({
      ...plan,
      acousticLatencyMs: null as null,
      acousticNote: "Not measured. Scheduled times are not speaker latency." as const,
    })),
  };
}

export async function extendTransport(plans: VoicePlan[], origin: TransportOrigin, windowNowBeat: number, bpm: number) {
  const ticket = tickets.transport;
  const context = await audioContext();
  if (!acceptSchedule(ticket, tickets.transport)) return [];
  const prepared = await prepare(context, plans, ticket, "transport");
  if (!acceptSchedule(ticket, tickets.transport)) return [];
  const timed = placeWindowOnOrigin(plans, origin, windowNowBeat, bpm);
  timed.forEach((plan, index) => {
    prepared[index]?.start(plan.startAtContextTime);
    if (prepared[index]) active.transport.push(prepared[index]);
  });
  return timed;
}

async function schedule(group: Group, plans: VoicePlan[], replace: boolean) {
  const ticket = replace ? tickets[group] + 1 : tickets[group];
  if (replace) tickets[group] = ticket;
  if (replace) stopGroup(group);
  if (plans.length === 0) return [];
  const context = await audioContext();
  if (!acceptSchedule(ticket, tickets[group])) return [];
  const sampleRate = context.sampleRate || SAMPLE_RATE;
  const prepared = plans.map((plan) => {
    const samples = tone(plan.hz, plan.amplitude, plan.durationSeconds, sampleRate);
    const buffer = context.createBuffer(1, samples.length, sampleRate);
    buffer.copyToChannel(samples, 0);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    return source;
  });
  if (!acceptSchedule(ticket, tickets[group])) return [];
  const contextTime = context.currentTime;
  const timed = assignStartTimes(plans, contextTime, CONTEXT_LEAD_SECONDS);
  timed.forEach((plan, index) => {
    prepared[index].start(plan.startAtContextTime);
    active[group].push(prepared[index]);
  });
  return timed.map((plan) => ({
    ...plan,
    acousticLatencyMs: null as null,
    acousticNote: "Not measured. Internal schedule times are not speaker latency." as const,
  }));
}

export function playPlans(group: Group, plans: VoicePlan[]) {
  return schedule(group, plans, true);
}
