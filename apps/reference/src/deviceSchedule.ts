import { AudioContext } from "react-native-audio-api";

import {
  assignStartTimes,
  CONTEXT_LEAD_SECONDS,
  SAMPLE_RATE,
  VOICE_SECONDS,
  type ScheduleTiming,
  type VoicePlan,
} from "../../../experiments/increment-2-audio/src/voices";

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
  for (let index = 0; index < length; index += 1) {
    let envelope = 1;
    if (index < fade) envelope = index / fade;
    if (index >= length - fade) envelope = Math.min(envelope, (length - index) / fade);
    samples[index] = Math.sin((2 * Math.PI * hz * index) / sampleRate) * amplitude * envelope;
  }
  return samples;
}

async function context(): Promise<LiveContext> {
  if (!live) live = new AudioContext({ sampleRate: SAMPLE_RATE }) as LiveContext;
  if (live.state === "suspended") await live.resume();
  return live;
}

export function stopAudition(): number {
  const count = active.length;
  for (const source of active) {
    try {
      source.stop();
    } catch {
      // A finished voice can reject stop. This clears the previous tap only.
    }
  }
  active = [];
  return count;
}

export async function scheduleAudition(plans: VoicePlan[], requestedAtMs: number): Promise<ScheduledVoice[]> {
  const audio = await context();
  const sampleRate = audio.sampleRate || SAMPLE_RATE;
  const prepared = plans.map((plan) => {
    const samples = toneBuffer(plan.hz, plan.amplitude, sampleRate);
    const buffer = audio.createBuffer(1, samples.length, sampleRate);
    buffer.copyToChannel(samples, 0);
    const source = audio.createBufferSource();
    source.buffer = buffer;
    source.connect(audio.destination);
    return source;
  });
  const contextTimeAfterPreparation = audio.currentTime;
  const scheduleInvokedAtMs = performance.now();
  const timed = assignStartTimes(plans, contextTimeAfterPreparation, CONTEXT_LEAD_SECONDS);
  return timed.map((voice, index) => {
    prepared[index].start(voice.startAtContextTime);
    active.push(prepared[index]);
    return {
      ...voice,
      internalSchedulingLatencyMs: scheduleInvokedAtMs - requestedAtMs,
      acousticLatencyMs: null,
      acousticNote: "Not measured. Internal schedule times are not speaker latency.",
    };
  });
}
