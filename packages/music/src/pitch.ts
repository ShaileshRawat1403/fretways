import type { PitchClass } from "./types.ts";

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

export function pitchClassOf(midi: number): PitchClass {
  const value = ((Math.round(midi) % 12) + 12) % 12;
  return value as PitchClass;
}

export function noteName(midi: number): string {
  const rounded = Math.round(midi);
  const octave = Math.floor(rounded / 12) - 1;
  return `${NAMES[pitchClassOf(rounded)]}${octave}`;
}

export function intervalUp(from: PitchClass, semitones: number): PitchClass {
  return (((from + semitones) % 12) + 12) % 12 as PitchClass;
}

export function intervalBetween(from: PitchClass, to: PitchClass): number {
  return (to - from + 12) % 12;
}
