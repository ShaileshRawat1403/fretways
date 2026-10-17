import { AudioContext } from "react-native-audio-api";

import { CONTEXT_LEAD_SECONDS, SAMPLE_RATE, VOICE_SECONDS, type ScheduleTiming, type VoicePlan } from "./voices";

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

export type ScheduledVoice = VoicePlan & ScheduleTiming & {
  acousticLatencyMs: null;
  acousticNote: "Not measured. Internal schedule times are not speaker latency.";
};

let live: LiveContext | null = null;
let active: Array<{ stop: () => void }> = [];

function toneBuffer(hz: number, amplitude: number, sampleRate: number): Float32Array {
  const length = Math.round(VOICE_SECONDS * sampleRate);
  const fade = Math.round(0.01 * sampleRate);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    let envelope = 1;
    if (i < fade) envelope = i / fade;
    if (i >= length - fade) envelope = Math.min(envelope, (length - i) / fade);
    samples[i] = Math.sin((2 * Math.PI * hz * i) / sampleRate) * amplitude * envelope;
  }
  return samples;
}

export async function getContext(): Promise<LiveContext> {
  if (!live) live = new AudioContext({ sampleRate: SAMPLE_RATE }) as LiveContext;
  if (live.state === "suspended") await live.resume();
  return live;
}

export async function scheduleVoices(plans: VoicePlan[], requestedAtMs: number): Promise<ScheduledVoice[]> {
  const context = await getContext();
  const sampleRate = context.sampleRate || SAMPLE_RATE;
  const scheduled: ScheduledVoice[] = [];
  for (const plan of plans) {
    const samples = toneBuffer(plan.hz, plan.amplitude, sampleRate);
    const buffer = context.createBuffer(1, samples.length, sampleRate);
    buffer.copyToChannel(samples, 0);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    const contextTimeAtSchedule = context.currentTime;
    const startAtContextTime = contextTimeAtSchedule + CONTEXT_LEAD_SECONDS + plan.startOffsetSeconds;
    const scheduleInvokedAtMs = performance.now();
    source.start(startAtContextTime);
    active.push(source);
    scheduled.push({
      ...plan,
      internalSchedulingLatencyMs: scheduleInvokedAtMs - requestedAtMs,
      contextLeadSeconds: startAtContextTime - contextTimeAtSchedule,
      contextTimeAtSchedule,
      startAtContextTime,
      acousticLatencyMs: null,
      acousticNote: "Not measured. Internal schedule times are not speaker latency.",
    });
  }
  return scheduled;
}

export function stopVoices(): number {
  const count = active.length;
  for (const source of active) {
    try {
      source.stop();
    } catch {
      // A finished voice can reject stop. This reset is manual, not a MIDI replacement.
    }
  }
  active = [];
  return count;
}
