import { CONTEXT_LEAD_SECONDS, placeWindowOnOrigin, type TransportOrigin, type VoicePlan } from "./plan";

type Group = "transport" | "tap";

const active: Record<Group, AudioScheduledSourceNode[]> = { transport: [], tap: [] };
let live: AudioContext | null = null;

function context(): AudioContext {
  if (!live) live = new AudioContext();
  if (live.state === "suspended") void live.resume();
  return live;
}

export function unlockAudio() {
  if (typeof window === "undefined") return;
  context();
}

export function readAudioTime(): number | null {
  return live ? live.currentTime : null;
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
  if (typeof window === "undefined") return;
  if (group) {
    stopGroup(group);
    return;
  }
  stopAudio("transport");
  stopAudio("tap");
}

function startVoice(ctx: AudioContext, plan: VoicePlan, when: number, group: Group) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = plan.touch === "pull" ? "triangle" : "sine";
  const start = Math.max(when, ctx.currentTime);
  const end = start + Math.max(0.08, plan.durationSeconds);
  if (plan.glideFromHz) {
    osc.frequency.setValueAtTime(plan.glideFromHz, start);
    osc.frequency.linearRampToValueAtTime(plan.hz, start + Math.min(0.18, plan.durationSeconds * 0.55));
  } else if (plan.touch === "bend") {
    osc.frequency.setValueAtTime(plan.hz, start);
    osc.frequency.exponentialRampToValueAtTime(plan.hz * 2 ** (2 / 12), start + plan.durationSeconds * 0.72);
  } else {
    osc.frequency.value = plan.hz;
  }
  const attack = plan.touch === "hammer" || plan.touch === "slide" ? 0.07 : 0.012;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, plan.amplitude), start + attack);
  if (plan.origin === "gesture") {
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
  } else {
    gain.gain.setValueAtTime(plan.amplitude, Math.max(start + 0.03, end - 0.04));
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
  }
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(end + 0.02);
  active[group].push(osc);
}

export function playTap(plans: VoicePlan[]) {
  const ctx = context();
  stopGroup("tap");
  const when = ctx.currentTime + CONTEXT_LEAD_SECONDS;
  for (const plan of plans) startVoice(ctx, plan, when + plan.startOffsetSeconds, "tap");
}

export function beginTransport(plans: VoicePlan[], originBeat: number, bpm: number): { origin: TransportOrigin } {
  const ctx = context();
  stopGroup("transport");
  const origin = { beat: originBeat, contextTime: ctx.currentTime + CONTEXT_LEAD_SECONDS };
  for (const plan of placeWindowOnOrigin(plans, origin, originBeat, bpm)) {
    startVoice(ctx, plan, plan.startAtContextTime, "transport");
  }
  return { origin };
}

export function scheduleClicks(origin: TransportOrigin, fromBeat: number, untilBeat: number, bpm: number) {
  const ctx = context();
  const scale = 60 / bpm;
  const first = Math.ceil(fromBeat - 1e-9);
  for (let beat = first; beat < untilBeat - 1e-9; beat += 1) {
    const when = origin.contextTime + (beat - origin.beat) * scale;
    const accent = ((beat % 4) + 4) % 4 === 0;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = accent ? 1600 : 1100;
    const start = Math.max(when, ctx.currentTime);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.05 : 0.028, start + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.028);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.04);
    active.transport.push(osc);
  }
}

export function extendTransport(plans: VoicePlan[], origin: TransportOrigin, windowNowBeat: number, bpm: number) {
  const ctx = context();
  for (const plan of placeWindowOnOrigin(plans, origin, windowNowBeat, bpm)) {
    startVoice(ctx, plan, plan.startAtContextTime, "transport");
  }
}
