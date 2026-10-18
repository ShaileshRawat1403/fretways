import { noteName } from "@/lib/music";
import type { Arrangement, PlacedNote, Timeline } from "@/lib/music";

export const SAMPLE_RATE = 44100;
export const CONTEXT_LEAD_SECONDS = 0.05;
export const TAP_SECONDS = 0.45;

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
  durationSeconds: number;
  musicalBeat?: number;
  touch?: "pick" | "hammer" | "pull" | "slide" | "bend";
  glideFromHz?: number;
};

const gestureAmplitude = 0.12;
const referenceAmplitude = 0.06;

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function secondsPerBeat(bpm: number): number {
  return 60 / bpm;
}

export function acceptSchedule(ticket: number, current: number): boolean {
  return ticket === current;
}

export function assignStartTimes(plans: VoicePlan[], contextTimeAfterPreparation: number, leadSeconds = CONTEXT_LEAD_SECONDS): Array<VoicePlan & {
  contextTimeAtSchedule: number;
  startAtContextTime: number;
  contextLeadSeconds: number;
}> {
  return plans.map((plan) => ({
    ...plan,
    contextTimeAtSchedule: contextTimeAfterPreparation,
    startAtContextTime: contextTimeAfterPreparation + leadSeconds + plan.startOffsetSeconds,
    contextLeadSeconds: leadSeconds + plan.startOffsetSeconds,
  }));
}

function voice(input: {
  idPrefix: string;
  index: number;
  origin: VoicePlan["origin"];
  eventId: string;
  note: PlacedNote | null;
  midi: number;
  amplitude: number;
  startOffsetSeconds: number;
  durationSeconds: number;
  musicalBeat?: number;
}): VoicePlan {
  return {
    voiceId: `${input.idPrefix}-${input.origin}-${input.index}`,
    origin: input.origin,
    eventId: input.eventId,
    stringIndex: input.note?.stringIndex ?? null,
    fret: input.note?.fret ?? null,
    midi: input.midi,
    noteName: noteName(input.midi),
    hz: midiToHz(input.midi),
    amplitude: input.amplitude,
    startOffsetSeconds: input.startOffsetSeconds,
    durationSeconds: input.durationSeconds,
    musicalBeat: input.musicalBeat,
  };
}

export function planVoices(input: {
  gesture: PlacedNote[];
  mode: AuditionMode;
  chordId: ChordId;
  idPrefix: string;
  startOffsetSeconds?: number;
  durationSeconds?: number;
}): VoicePlan[] {
  const offset = input.startOffsetSeconds ?? 0;
  const duration = input.durationSeconds ?? TAP_SECONDS;
  const voices = input.gesture.map((note, index) => voice({
    idPrefix: input.idPrefix,
    index,
    origin: "gesture",
    eventId: `${input.idPrefix}-gesture-${index}`,
    note,
    midi: note.midi,
    amplitude: gestureAmplitude,
    startOffsetSeconds: offset,
    durationSeconds: duration,
  }));
  if (input.mode === "in-context") {
    bedFor(input.chordId).forEach((midi, index) => {
      voices.push(voice({
        idPrefix: input.idPrefix,
        index,
        origin: "reference",
        eventId: `${input.idPrefix}-reference-${index}`,
        note: null,
        midi,
        amplitude: referenceAmplitude,
        startOffsetSeconds: offset,
        durationSeconds: duration,
      }));
    });
  }
  return voices;
}

function bedFor(chordId: string): readonly number[] {
  const known = referenceBeds[chordId as ChordId];
  if (known) return known;
  const names: Record<string, number> = { c: 0, cs: 1, d: 2, ds: 3, e: 4, f: 5, fs: 6, g: 7, gs: 8, a: 9, as: 10, b: 11 };
  const [name, quality] = chordId.split("-");
  const root = names[name ?? ""];
  if (root == null) return [];
  const third = (root + (quality === "minor" ? 3 : 4)) % 12;
  const fifth = (root + 7) % 12;
  return [48 + root, 48 + third, 48 + fifth, 60 + root];
}

export function planChord(chordId: ChordId, idPrefix: string): VoicePlan[] {
  return bedFor(chordId).map((midi, index) => voice({
    idPrefix,
    index,
    origin: "reference",
    eventId: `${idPrefix}-chord-${index}`,
    note: null,
    midi,
    amplitude: referenceAmplitude,
    startOffsetSeconds: 0,
    durationSeconds: 1.6,
  }));
}

export function planPhrase(events: { note: PlacedNote; touch?: VoicePlan["touch"] }[]): VoicePlan[] {
  let at = 0;
  return events.map((event, index) => {
    const touch = event.touch ?? "pick";
    const duration = touch === "bend" || touch === "slide" ? 0.62 : 0.4;
    const previous = index > 0 ? midiToHz(events[index - 1].note.midi) : midiToHz(event.note.midi - 1);
    const plan = voice({
      idPrefix: "phrase",
      index,
      origin: "gesture",
      eventId: `phrase-${index}`,
      note: event.note,
      midi: event.note.midi,
      amplitude: gestureAmplitude,
      startOffsetSeconds: at,
      durationSeconds: duration,
    });
    at += touch === "slide" ? 0.34 : 0.42;
    return { ...plan, touch, glideFromHz: touch === "slide" ? previous : undefined };
  });
}

export function auditionVoices(note: PlacedNote, mode: AuditionMode, chordId: ChordId, idPrefix: string): VoicePlan[] {
  return planVoices({ gesture: [note], mode, chordId, idPrefix });
}

export const TRANSPORT_HORIZON_BEATS = 4;

export type TransportOrigin = {
  beat: number;
  contextTime: number;
};

export function beatAtContextTime(anchorBeat: number, anchorContextTime: number, contextNow: number, bpm: number): number {
  return anchorBeat + (contextNow - anchorContextTime) * (bpm / 60);
}

export function placeWindowOnOrigin(
  plans: VoicePlan[],
  origin: TransportOrigin,
  windowNowBeat: number,
  bpm: number,
): Array<VoicePlan & { musicalBeat: number; startAtContextTime: number }> {
  const scale = secondsPerBeat(bpm);
  return plans.map((plan) => {
    const musicalBeat = plan.musicalBeat ?? windowNowBeat + plan.startOffsetSeconds / scale;
    return {
      ...plan,
      musicalBeat,
      startAtContextTime: origin.contextTime + (musicalBeat - origin.beat) * scale,
    };
  });
}

function clipEvent(startBeat: number, durationBeats: number, fromBeat: number, scale: number): { offset: number; duration: number } | null {
  const end = startBeat + durationBeats;
  if (end <= fromBeat) return null;
  const audibleStart = Math.max(startBeat, fromBeat);
  return {
    offset: Math.max(0, (startBeat - fromBeat) * scale),
    duration: (end - audibleStart) * scale,
  };
}

export function planArrangement(arrangement: Arrangement, timeline: Timeline, fromBeat: number): VoicePlan[] {
  const scale = secondsPerBeat(timeline.bpm);
  const voices: VoicePlan[] = [];
  for (const event of arrangement.rhythm) {
    const clip = clipEvent(event.startBeat, event.durationBeats, fromBeat, scale);
    if (!clip) continue;
    event.notes.forEach((note, index) => {
      voices.push(voice({
        idPrefix: event.id,
        index,
        origin: "gesture",
        eventId: event.id,
        note,
        midi: note.midi,
        amplitude: gestureAmplitude,
        startOffsetSeconds: clip.offset,
        durationSeconds: clip.duration,
      }));
    });
  }
  for (const event of arrangement.lead) {
    if (event.kind !== "note") continue;
    const clip = clipEvent(event.startBeat, event.durationBeats, fromBeat, scale);
    if (!clip) continue;
    voices.push(voice({
      idPrefix: event.id,
      index: 0,
      origin: "gesture",
      eventId: event.id,
      note: event.note,
      midi: event.note.midi,
      amplitude: gestureAmplitude,
      startOffsetSeconds: clip.offset,
      durationSeconds: clip.duration,
    }));
  }
  return voices;
}

export function planReferenceWindow(timeline: Timeline, nowBeat: number, rangeStart: number, rangeEnd: number, loop: boolean): VoicePlan[] {
  const scale = secondsPerBeat(timeline.bpm);
  const length = timeline.segments.reduce((end, segment) => Math.max(end, segment.startBeat + segment.durationBeats), 0);
  const limit = loop ? rangeEnd : Math.min(rangeEnd, length);
  if (length <= 0 || limit <= rangeStart) return [];
  const voices: VoicePlan[] = [];
  const firstCycle = Math.floor(rangeStart / length);
  const lastCycle = Math.floor(Math.max(rangeStart, limit - 0.0001) / length);
  for (let cycle = firstCycle; cycle <= lastCycle; cycle += 1) {
    for (const segment of timeline.segments) {
      const absoluteStart = cycle * length + segment.startBeat;
      const absoluteEnd = absoluteStart + segment.durationBeats;
      const sliceEnd = Math.min(absoluteEnd, limit);
      const sliceStart = Math.max(absoluteStart, rangeStart, nowBeat);
      if (sliceEnd <= sliceStart) continue;
      const bed = referenceBeds[segment.chord.id as ChordId];
      if (!bed) continue;
      bed.forEach((midi, index) => {
        voices.push(voice({
          idPrefix: `${segment.id}-w${cycle}-${Math.round(sliceStart * 1000)}`,
          index,
          origin: "reference",
          eventId: `${segment.id}-w${cycle}`,
          note: null,
          midi,
          amplitude: referenceAmplitude,
          startOffsetSeconds: Math.max(0, (sliceStart - nowBeat) * scale),
          durationSeconds: (sliceEnd - sliceStart) * scale,
          musicalBeat: sliceStart,
        }));
      });
    }
  }
  return voices;
}

export function planReferenceProgression(timeline: Timeline, fromBeat: number, cycles = 1): VoicePlan[] {
  const scale = secondsPerBeat(timeline.bpm);
  const length = timeline.segments.reduce((end, segment) => Math.max(end, segment.startBeat + segment.durationBeats), 0);
  const voices: VoicePlan[] = [];
  for (let cycle = 0; cycle < cycles; cycle += 1) {
    const cycleOffset = cycle * length * scale;
    for (const segment of timeline.segments) {
      const segmentEnd = segment.startBeat + segment.durationBeats;
      if (cycle === 0 && segmentEnd <= fromBeat) continue;
      const start = cycle === 0 ? Math.max(segment.startBeat, fromBeat) : segment.startBeat;
      const offset = cycle === 0 ? Math.max(0, segment.startBeat - fromBeat) * scale : (segment.startBeat * scale) + cycleOffset - fromBeat * scale;
      const durationBeats = segmentEnd - start;
      const bed = referenceBeds[segment.chord.id as ChordId];
      if (!bed) continue;
      bed.forEach((midi, index) => {
        voices.push(voice({
          idPrefix: `${segment.id}-c${cycle}`,
          index,
          origin: "reference",
          eventId: `${segment.id}-c${cycle}`,
          note: null,
          midi,
          amplitude: referenceAmplitude,
          startOffsetSeconds: Math.max(0, offset),
          durationSeconds: durationBeats * scale,
        }));
      });
    }
  }
  return voices;
}
