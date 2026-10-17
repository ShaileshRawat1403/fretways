import { intervalBetween, intervalUp, noteName, pitchClassOf } from "./pitch.ts";
import { conventionalString, isStringIndex, midiAt } from "./tuning.ts";
import type { ChordSymbol, ChordToneLocation, ChordToneRole, PitchClass, Tuning } from "./types.ts";

export function majorTriad(root: PitchClass): [PitchClass, PitchClass, PitchClass] {
  return [root, intervalUp(root, 4), intervalUp(root, 7)];
}

export function minorTriad(root: PitchClass): [PitchClass, PitchClass, PitchClass] {
  return [root, intervalUp(root, 3), intervalUp(root, 7)];
}

export function chordPitchClasses(chord: ChordSymbol): [PitchClass, PitchClass, PitchClass] {
  return chord.quality === "major" ? majorTriad(chord.root) : minorTriad(chord.root);
}

export function chordToneRole(chord: ChordSymbol, pitchClass: PitchClass): ChordToneRole | null {
  const [root, third, fifth] = chordPitchClasses(chord);
  if (pitchClass === root) return "root";
  if (pitchClass === third) return "third";
  if (pitchClass === fifth) return "fifth";
  return null;
}

export function chordTonesInRange(
  chord: ChordSymbol,
  tuning: Tuning,
  firstFret: number,
  lastFret: number,
): ChordToneLocation[] {
  if (!Number.isInteger(firstFret) || !Number.isInteger(lastFret) || firstFret < 0 || lastFret < firstFret) {
    throw new Error(`Fret range ${firstFret} through ${lastFret} is not valid.`);
  }
  const found: ChordToneLocation[] = [];
  for (let stringIndex = 0; stringIndex <= 5; stringIndex += 1) {
    if (!isStringIndex(stringIndex)) continue;
    for (let fret = firstFret; fret <= lastFret; fret += 1) {
      const cell = { stringIndex, fret };
      const midi = midiAt(tuning, cell);
      const role = chordToneRole(chord, pitchClassOf(midi));
      if (!role) continue;
      found.push({
        stringIndex,
        fret,
        conventionalString: conventionalString(stringIndex),
        midi,
        noteName: noteName(midi),
        role,
      });
    }
  }
  return found;
}

export function intervalName(semitones: number): string {
  const names = [
    "unison",
    "minor second",
    "major second",
    "minor third",
    "major third",
    "perfect fourth",
    "tritone",
    "perfect fifth",
    "minor sixth",
    "major sixth",
    "minor seventh",
    "major seventh",
  ];
  return names[((semitones % 12) + 12) % 12] ?? "unison";
}

export function intervalFromRoot(chord: ChordSymbol, pitchClass: PitchClass): number {
  return intervalBetween(chord.root, pitchClass);
}
