import { AudioContext } from "react-native-audio-api";

import { acceptSchedule, assignStartTimes, CONTEXT_LEAD_SECONDS, SAMPLE_RATE, type VoicePlan } from "./plan";

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

export async function playPlans(group: Group, plans: VoicePlan[]) {
  const ticket = tickets[group] + 1;
  tickets[group] = ticket;
  stopGroup(group);
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
    acousticLatencyMs: null,
    acousticNote: "Not measured. Internal schedule times are not speaker latency.",
  }));
}
