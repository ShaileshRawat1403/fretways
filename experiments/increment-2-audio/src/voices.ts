import { defaultNeck, noteName, placeNote, standardTuning } from "../../../packages/music/src/index";
import type { PlacedNote, StringIndex } from "../../../packages/music/src/index";

export const SAMPLE_RATE = 44100;
export const VOICE_SECONDS = 0.45;
export const CONTEXT_LEAD_SECONDS = 0.05;

export const referenceBeds = {
  "c-major": [48, 52, 55],
  "g-major": [43, 47, 50],
  "a-minor": [45, 48, 52],
  "f-major": [41, 45, 48],
} as const;

export type ChordId = keyof typeof referenceBeds;
export type AuditionMode = "solo" | "in-context";

export type VoicePlan = {
  voiceId: string;
  origin: "gesture" | "reference";
  eventId: string;
  stringIndex: number | null;
  fret: number | null;
  midi: number;
  noteName: string;
  hz: number;
  amplitude: number;
  startOffsetSeconds: number;
};

export type ScheduleTiming = {
  internalSchedulingLatencyMs: number;
  contextLeadSeconds: number;
  contextTimeAtSchedule: number;
  startAtContextTime: number;
  acousticLatencyMs: null;
};

const gestureAmplitude = 0.12;
const referenceAmplitude = 0.06;

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function placed(stringIndex: StringIndex, fret: number): PlacedNote {
  return placeNote(standardTuning, defaultNeck, { stringIndex, fret });
}

export const probes = {
  openB: placed(4, 0),
  gStringB: placed(3, 4),
  openG: placed(3, 0),
  highG: placed(5, 3),
  threeNote: [placed(2, 0), placed(3, 0), placed(4, 0)],
  sixNote: [placed(0, 3), placed(1, 2), placed(2, 0), placed(3, 0), placed(3, 4), placed(4, 0)],
};

export function planVoices(input: {
  gesture: PlacedNote[];
  mode: AuditionMode;
  chordId: ChordId;
  idPrefix: string;
  startOffsetSeconds?: number;
}): VoicePlan[] {
  const offset = input.startOffsetSeconds ?? 0;
  const voices: VoicePlan[] = input.gesture.map((note, index) => ({
    voiceId: `${input.idPrefix}-gesture-${index}`,
    origin: "gesture",
    eventId: `${input.idPrefix}-gesture-${index}`,
    stringIndex: note.stringIndex,
    fret: note.fret,
    midi: note.midi,
    noteName: noteName(note.midi),
    hz: midiToHz(note.midi),
    amplitude: gestureAmplitude,
    startOffsetSeconds: offset,
  }));
  if (input.mode === "in-context") {
    referenceBeds[input.chordId].forEach((midi, index) => {
      voices.push({
        voiceId: `${input.idPrefix}-reference-${index}`,
        origin: "reference",
        eventId: `${input.idPrefix}-reference-${index}`,
        stringIndex: null,
        fret: null,
        midi,
        noteName: noteName(midi),
        hz: midiToHz(midi),
        amplitude: referenceAmplitude,
        startOffsetSeconds: offset,
      });
    });
  }
  return voices;
}

export function planRapidTaps(cell: PlacedNote, count: number, spacingSeconds: number): VoicePlan[] {
  return Array.from({ length: count }, (_, index) => planVoices({
    gesture: [cell],
    mode: "solo",
    chordId: "g-major",
    idPrefix: `rapid-${index}`,
    startOffsetSeconds: index * spacingSeconds,
  })).flat();
}

export function assignStartTimes(
  plans: VoicePlan[],
  contextTimeAfterPreparation: number,
  leadSeconds = CONTEXT_LEAD_SECONDS,
): Array<VoicePlan & Pick<ScheduleTiming, "contextTimeAtSchedule" | "startAtContextTime" | "contextLeadSeconds">> {
  return plans.map((plan) => ({
    ...plan,
    contextTimeAtSchedule: contextTimeAfterPreparation,
    startAtContextTime: contextTimeAfterPreparation + leadSeconds + plan.startOffsetSeconds,
    contextLeadSeconds: leadSeconds + plan.startOffsetSeconds,
  }));
}

export function assertDistinctVoices(voices: VoicePlan[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const voice of voices) {
    if (ids.has(voice.voiceId)) errors.push(`Duplicate voice id ${voice.voiceId}.`);
    ids.add(voice.voiceId);
  }
  const byMidi = new Map<number, VoicePlan[]>();
  for (const voice of voices) {
    const group = byMidi.get(voice.midi) ?? [];
    group.push(voice);
    byMidi.set(voice.midi, group);
  }
  for (const [midi, group] of byMidi) {
    if (group.length > 1 && new Set(group.map((voice) => voice.voiceId)).size !== group.length) {
      errors.push(`MIDI ${midi} collapsed distinct voices.`);
    }
  }
  return errors;
}

export function sameMidiGroups(voices: VoicePlan[]): Array<{ midi: number; voiceIds: string[] }> {
  const byMidi = new Map<number, string[]>();
  for (const voice of voices) {
    const group = byMidi.get(voice.midi) ?? [];
    group.push(voice.voiceId);
    byMidi.set(voice.midi, group);
  }
  return [...byMidi.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([midi, voiceIds]) => ({ midi, voiceIds }));
}
