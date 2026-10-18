import {
  chordToneRole,
  conventionalString,
  defaultNeck,
  intervalFromRoot,
  intervalUp,
  noteName,
  pitchClassOf,
  placeNote,
  prototypeTimeline,
  standardTuning,
} from "@/lib/music";
import type { ChordSymbol, PitchClass, PlacedNote, StringIndex } from "@/lib/music";

export const WINDOW_FRETS = 5;
export const FRET_COUNT = defaultNeck.fretCount;

const SHORT_INTERVAL = ["R", "m2", "M2", "m3", "M3", "P4", "TT", "P5", "m6", "M6", "m7", "M7"] as const;

export type LabelMode = "markers" | "names" | "intervals";

export type NeckCell = {
  stringIndex: StringIndex;
  conventionalString: number;
  fret: number;
  midi: number;
  noteName: string;
  role: "root" | "third" | "fifth" | null;
  intervalLabel: string;
  note: PlacedNote;
};

export type ReferenceState = {
  chordId: string;
  firstFret: number;
};

export function referenceChords(): ChordSymbol[] {
  return prototypeTimeline().segments.map((segment) => segment.chord);
}

export function chordById(chordId: string): ChordSymbol {
  const chord = referenceChords().find((item) => item.id === chordId);
  if (!chord) throw new Error(`Unknown reference chord ${chordId}.`);
  return chord;
}

export function maxFirstFret(windowFrets = WINDOW_FRETS, fretCount = FRET_COUNT): number {
  return Math.max(0, fretCount - windowFrets + 1);
}

export function clampFirstFret(firstFret: number): number {
  if (!Number.isFinite(firstFret)) return 0;
  return Math.min(maxFirstFret(), Math.max(0, Math.round(firstFret)));
}

export function visibleFrets(firstFret: number, count = WINDOW_FRETS): number[] {
  const size = Math.max(1, Math.round(count));
  const max = Math.max(0, FRET_COUNT - size + 1);
  const start = Math.min(max, Math.max(0, Number.isFinite(firstFret) ? Math.round(firstFret) : 0));
  return Array.from({ length: size }, (_, index) => start + index);
}

export function visibleNeck(chord: ChordSymbol, firstFret: number, count = WINDOW_FRETS): NeckCell[][] {
  const frets = visibleFrets(firstFret, count);
  return displayStrings().map((stringIndex) => frets.map((fret) => cellAt(chord, stringIndex, fret)));
}

export function displayStrings(): StringIndex[] {
  return [5, 4, 3, 2, 1, 0];
}

const STRING_FACE = ["E", "A", "D", "G", "B", "e"] as const;

export function openStringLabel(stringIndex: StringIndex): string {
  return STRING_FACE[stringIndex];
}

export function chordSpelling(chord: ChordSymbol): { root: string; third: string; fifth: string } {
  const third = intervalUp(chord.root, chord.quality === "major" ? 4 : 3);
  const fifth = intervalUp(chord.root, 7);
  const letter = (pitch: PitchClass) => noteName(60 + pitch).replace(/[0-9-]/g, "");
  return { root: letter(chord.root), third: letter(third), fifth: letter(fifth) };
}

export function stringRowKey(stringIndex: StringIndex): string {
  return `string-${stringIndex}`;
}

export function cellAt(chord: ChordSymbol, stringIndex: StringIndex, fret: number): NeckCell {
  const note = placeNote(standardTuning, defaultNeck, { stringIndex, fret });
  const pitchClass = pitchClassOf(note.midi);
  return {
    stringIndex,
    conventionalString: conventionalString(stringIndex),
    fret,
    midi: note.midi,
    noteName: noteName(note.midi),
    role: chordToneRole(chord, pitchClass),
    intervalLabel: SHORT_INTERVAL[intervalFromRoot(chord, pitchClass)],
    note,
  };
}

export function selectChord(state: ReferenceState, chordId: string): ReferenceState {
  chordById(chordId);
  return { chordId, firstFret: state.firstFret };
}

export function moveNeck(state: ReferenceState, firstFret: number): ReferenceState {
  return { chordId: state.chordId, firstFret: clampFirstFret(firstFret) };
}

export function chordTitle(chord: ChordSymbol): string {
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  return `${names[chord.root]} ${chord.quality}`;
}

export const positionJumps = [0, 5, 7, 12, 20] as const;
