import type { StringIndex } from "@/lib/music";

export type Grip = {
  chordId: string;
  name: string;
  diagram: string;
  notes: { stringIndex: StringIndex; fret: number }[];
  muted: StringIndex[];
};

const grips: Record<string, Grip> = {
  "c-major": {
    chordId: "c-major",
    name: "Open C",
    diagram: "x 3 2 0 1 0",
    muted: [0],
    notes: [
      { stringIndex: 1, fret: 3 },
      { stringIndex: 2, fret: 2 },
      { stringIndex: 3, fret: 0 },
      { stringIndex: 4, fret: 1 },
      { stringIndex: 5, fret: 0 },
    ],
  },
  "g-major": {
    chordId: "g-major",
    name: "Open G",
    diagram: "3 2 0 0 0 3",
    muted: [],
    notes: [
      { stringIndex: 0, fret: 3 },
      { stringIndex: 1, fret: 2 },
      { stringIndex: 2, fret: 0 },
      { stringIndex: 3, fret: 0 },
      { stringIndex: 4, fret: 0 },
      { stringIndex: 5, fret: 3 },
    ],
  },
  "a-minor": {
    chordId: "a-minor",
    name: "Open Am",
    diagram: "x 0 2 2 1 0",
    muted: [0],
    notes: [
      { stringIndex: 1, fret: 0 },
      { stringIndex: 2, fret: 2 },
      { stringIndex: 3, fret: 2 },
      { stringIndex: 4, fret: 1 },
      { stringIndex: 5, fret: 0 },
    ],
  },
  "f-major": {
    chordId: "f-major",
    name: "Easy F",
    diagram: "x x 3 2 1 1",
    muted: [0, 1],
    notes: [
      { stringIndex: 2, fret: 3 },
      { stringIndex: 3, fret: 2 },
      { stringIndex: 4, fret: 1 },
      { stringIndex: 5, fret: 1 },
    ],
  },
};

export function gripFor(chordId: string): Grip | null {
  return grips[chordId] ?? null;
}
