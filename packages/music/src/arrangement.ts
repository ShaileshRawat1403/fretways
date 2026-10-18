import { placedNoteError } from "./tuning";
import { segmentById, timelineLength } from "./timeline";
import type {
  Arrangement,
  LeadEvent,
  Neck,
  Playability,
  PlacedNote,
  RhythmEvent,
  SoundingNote,
  StringIndex,
  Timeline,
  Tuning,
} from "./types";

function covers(startBeat: number, durationBeats: number, beat: number): boolean {
  return beat >= startBeat && beat < startBeat + durationBeats;
}

function containedBy(innerStart: number, innerDuration: number, outerStart: number, outerDuration: number): boolean {
  return innerStart >= outerStart && innerStart + innerDuration <= outerStart + outerDuration;
}

export function assessPlayability(notes: PlacedNote[]): Playability {
  if (notes.length === 0) return "unchecked";
  const strings = new Set(notes.map((note) => note.stringIndex));
  if (strings.size !== notes.length) return "duplicate-string";
  const stopped = notes.map((note) => note.fret).filter((fret) => fret > 0);
  if (stopped.length >= 2 && Math.max(...stopped) - Math.min(...stopped) > 4) return "wide-span";
  return "plausible";
}

export function rhythmEvent(input: Omit<RhythmEvent, "kind" | "playability" | "mutedStrings"> & { playability?: Playability; mutedStrings?: StringIndex[] }): RhythmEvent {
  return {
    kind: "rhythm",
    playability: input.playability ?? assessPlayability(input.notes),
    id: input.id,
    segmentId: input.segmentId,
    startBeat: input.startBeat,
    durationBeats: input.durationBeats,
    notes: input.notes,
    mutedStrings: input.mutedStrings ?? [],
  };
}

export function leadEventsSoundingAt(events: LeadEvent[], beat: number): LeadEvent[] {
  return events.filter((event) => covers(event.startBeat, event.durationBeats, beat));
}

export function rhythmEventsSoundingAt(events: RhythmEvent[], beat: number): RhythmEvent[] {
  return events.filter((event) => covers(event.startBeat, event.durationBeats, beat));
}

export function soundingNotesAt(arrangement: Arrangement, beat: number): SoundingNote[] {
  const notes: SoundingNote[] = [];
  for (const event of rhythmEventsSoundingAt(arrangement.rhythm, beat)) {
    for (const note of event.notes) {
      notes.push({ eventId: event.id, layer: "rhythm", note });
    }
  }
  for (const event of leadEventsSoundingAt(arrangement.lead, beat)) {
    if (event.kind === "note") notes.push({ eventId: event.id, layer: "lead", note: event.note });
  }
  return notes;
}

function timingError(label: string, startBeat: number, durationBeats: number): string | null {
  if (!Number.isFinite(startBeat) || startBeat < 0) return `${label} starts before beat 0.`;
  if (!Number.isFinite(durationBeats) || durationBeats <= 0) return `${label} needs a duration greater than zero.`;
  return null;
}

export function validateArrangement(arrangement: Arrangement, timeline: Timeline, tuning: Tuning, neck: Neck): string[] {
  const errors: string[] = [];
  const length = timelineLength(timeline);
  const rhythmIds = new Set<string>();
  const leadIds = new Set<string>();

  for (const event of arrangement.rhythm) {
    if (event.kind !== "rhythm") errors.push(`${event.id} is not a rhythm event.`);
    if (!event.id || rhythmIds.has(event.id)) errors.push(`Rhythm id ${event.id} is missing or duplicated.`);
    rhythmIds.add(event.id);
    const timing = timingError(event.id, event.startBeat, event.durationBeats);
    if (timing) errors.push(timing);
    const segment = segmentById(timeline, event.segmentId);
    if (!segment) {
      errors.push(`${event.id} points at missing segment ${event.segmentId}.`);
    } else if (!containedBy(event.startBeat, event.durationBeats, segment.startBeat, segment.durationBeats)) {
      errors.push(`${event.id} is not contained by segment ${segment.id}.`);
    }
    for (const note of event.notes) {
      const problem = placedNoteError(note, tuning, neck);
      if (problem) errors.push(`${event.id}: ${problem}`);
    }
    const muted = event.mutedStrings ?? [];
    const used = new Set(event.notes.map((note) => note.stringIndex));
    const seenMuted = new Set<number>();
    for (const stringIndex of muted) {
      if (stringIndex < 0 || stringIndex > 5 || !Number.isInteger(stringIndex)) {
        errors.push(`${event.id} mutes a string that is not on the neck.`);
      }
      if (seenMuted.has(stringIndex)) errors.push(`${event.id} mutes string ${stringIndex} more than once.`);
      seenMuted.add(stringIndex);
      if (used.has(stringIndex)) errors.push(`${event.id} mutes string ${stringIndex} and also frets it.`);
    }
  }

  for (const event of arrangement.lead) {
    if (!event.id || leadIds.has(event.id)) errors.push(`Lead id ${event.id} is missing or duplicated.`);
    leadIds.add(event.id);
    const timing = timingError(event.id, event.startBeat, event.durationBeats);
    if (timing) errors.push(timing);
    const end = event.startBeat + event.durationBeats;
    if (event.startBeat < 0 || end > length) errors.push(`${event.id} falls outside the timeline.`);
    if (event.kind === "note") {
      const problem = placedNoteError(event.note, tuning, neck);
      if (problem) errors.push(`${event.id}: ${problem}`);
    } else if (event.kind === "rest") {
      if ("note" in event) errors.push(`${event.id} is a rest and cannot carry a note.`);
    } else {
      errors.push(
        `${(event as { id?: string }).id ?? "unknown"} is not a note or a rest.`
      );
    }
  }

  return errors;
}
