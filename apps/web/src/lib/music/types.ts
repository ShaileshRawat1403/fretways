export type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export type StringIndex = 0 | 1 | 2 | 3 | 4 | 5;

export type Tuning = {
  id: "standard-e";
  openMidi: [40, 45, 50, 55, 59, 64];
};

export type Neck = {
  fretCount: number;
};

export type FretCell = {
  stringIndex: StringIndex;
  fret: number;
};

export type PlacedNote = FretCell & {
  tuningId: Tuning["id"];
  midi: number;
};

export type ChordQuality = "major" | "minor";

export type ChordSymbol = {
  id: string;
  root: PitchClass;
  quality: ChordQuality;
  label: string;
};

export type HarmonicSegment = {
  id: string;
  startBeat: number;
  durationBeats: number;
  chord: ChordSymbol;
  provenance: "manual";
};

export type Timeline = {
  meter: "4/4";
  bpm: number;
  segments: HarmonicSegment[];
};

export type Playability = "unchecked" | "plausible" | "wide-span" | "duplicate-string";

export type RhythmEvent = {
  kind: "rhythm";
  id: string;
  segmentId: string;
  startBeat: number;
  durationBeats: number;
  notes: PlacedNote[];
  mutedStrings: StringIndex[];
  playability: Playability;
};

export type LeadNote = {
  kind: "note";
  id: string;
  startBeat: number;
  durationBeats: number;
  note: PlacedNote;
  touch?: "pick" | "hammer" | "pull" | "slide" | "bend";
};

export type LeadRest = {
  kind: "rest";
  id: string;
  startBeat: number;
  durationBeats: number;
};

export type LeadEvent = LeadNote | LeadRest;

export type Arrangement = {
  rhythm: RhythmEvent[];
  lead: LeadEvent[];
};

export type ChordToneRole = "root" | "third" | "fifth";

export type ChordToneLocation = FretCell & {
  conventionalString: number;
  midi: number;
  noteName: string;
  role: ChordToneRole;
};

export type SoundingNote = {
  eventId: string;
  layer: "rhythm" | "lead";
  note: PlacedNote;
};
