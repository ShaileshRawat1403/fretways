import { chordPitchClasses, midiAt, noteName, pitchClassOf } from "@/lib/music";
import type { ChordSymbol, PitchClass, StringIndex, Tuning } from "@/lib/music";

export type Touch = "pick" | "hammer" | "pull" | "slide" | "bend";

export type Move = {
  stringIndex: StringIndex;
  fret: number;
  touch: Touch;
  line: string;
};

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function letter(midi: number): string {
  return noteName(midi).replace(/[0-9-]/g, "");
}

function say(touch: Touch, name: string): string {
  if (touch === "hammer") return `Hammer into ${name}`;
  if (touch === "pull") return `Pull to ${name}`;
  if (touch === "bend") return `Bend this to ${name}`;
  if (touch === "slide") return `Slide into ${name}`;
  return `Play ${name}`;
}

function belongs(chord: ChordSymbol, pitch: PitchClass): boolean {
  return (chordPitchClasses(chord) as PitchClass[]).includes(pitch);
}

export function nextMoves(input: {
  seeds: { stringIndex: StringIndex; fret: number }[];
  next: ChordSymbol;
  tuning: Tuning;
  fretCount: number;
}): Move[] {
  const found: (Move & { distance: number; intoNext: boolean })[] = [];
  const seen = new Set<string>();
  for (const seed of input.seeds) {
    const fromMidi = midiAt(input.tuning, seed);
    for (let fret = 0; fret <= input.fretCount; fret += 1) {
      const distance = fret - seed.fret;
      const span = Math.abs(distance);
      if (span === 0 || span > 4) continue;
      const midi = midiAt(input.tuning, { stringIndex: seed.stringIndex, fret });
      const pitch = pitchClassOf(midi);
      if (!belongs(input.next, pitch)) continue;
      const touch: Touch = distance === 1 ? "hammer" : distance < 0 ? "pull" : "slide";
      const key = `${seed.stringIndex}-${fret}`;
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({
        stringIndex: seed.stringIndex,
        fret,
        touch,
        line: say(touch, letter(midi)),
        distance: span,
        intoNext: true,
      });
    }
    const bent = pitchClassOf(fromMidi + 2);
    if (belongs(input.next, bent)) {
      const key = `bend-${seed.stringIndex}-${seed.fret}`;
      if (!seen.has(key)) {
        seen.add(key);
        found.push({
          stringIndex: seed.stringIndex,
          fret: seed.fret,
          touch: "bend",
          line: say("bend", NAMES[bent] ?? "the next chord"),
          distance: 0,
          intoNext: true,
        });
      }
    }
  }
  const unique: Move[] = [];
  const said = new Set<string>();
  for (const move of found.sort((a, b) => a.distance - b.distance)) {
    if (said.has(move.line)) continue;
    said.add(move.line);
    unique.push(move);
    if (unique.length === 3) break;
  }
  return unique;
}
