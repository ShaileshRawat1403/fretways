import { noteName } from "./pitch";
import type { FretCell, Neck, PlacedNote, StringIndex, Tuning } from "./types";

export const standardTuning: Tuning = {
  id: "standard-e",
  openMidi: [40, 45, 50, 55, 59, 64],
};

export const defaultNeck: Neck = {
  fretCount: 24,
};

export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export function isStringIndex(value: number): value is StringIndex {
  return Number.isInteger(value) && value >= 0 && value <= 5;
}

export function conventionalString(stringIndex: StringIndex): number {
  return 6 - stringIndex;
}

export function stringIndexFromConventional(conventional: number): StringIndex {
  if (!Number.isInteger(conventional) || conventional < 1 || conventional > 6) {
    throw new DomainError(`Conventional string ${conventional} is outside 1 through 6.`);
  }
  return (6 - conventional) as StringIndex;
}

export function midiAt(tuning: Tuning, cell: FretCell): number {
  if (!isStringIndex(cell.stringIndex)) {
    throw new DomainError(`stringIndex ${cell.stringIndex} is outside 0 through 5.`);
  }
  if (!Number.isInteger(cell.fret) || cell.fret < 0) {
    throw new DomainError(`Fret ${cell.fret} is not a valid fret number.`);
  }
  return tuning.openMidi[cell.stringIndex] + cell.fret;
}

export function placeNote(tuning: Tuning, neck: Neck, cell: FretCell): PlacedNote {
  if (!Number.isInteger(cell.fret) || cell.fret < 0 || cell.fret > neck.fretCount) {
    throw new DomainError(`Fret ${cell.fret} is outside 0 through ${neck.fretCount}.`);
  }
  return {
    stringIndex: cell.stringIndex,
    fret: cell.fret,
    tuningId: tuning.id,
    midi: midiAt(tuning, cell),
  };
}

export function placedNoteError(note: PlacedNote, tuning: Tuning, neck: Neck): string | null {
  if (note.tuningId !== tuning.id) {
    return `${note.tuningId} does not match the active tuning ${tuning.id}.`;
  }
  if (!isStringIndex(note.stringIndex)) {
    return `stringIndex ${note.stringIndex} is outside 0 through 5.`;
  }
  if (!Number.isInteger(note.fret) || note.fret < 0 || note.fret > neck.fretCount) {
    return `Fret ${note.fret} is outside 0 through ${neck.fretCount}.`;
  }
  const expected = tuning.openMidi[note.stringIndex] + note.fret;
  if (note.midi !== expected) {
    return `${noteName(note.midi)} at stringIndex ${note.stringIndex} fret ${note.fret} does not match ${noteName(expected)}.`;
  }
  return null;
}
