import { noteName } from "../../../packages/music/src/index";
import type { Playability, StringIndex } from "../../../packages/music/src/index";

import { displayStrings, openStringLabel } from "./neck";
import { displayedSegment, draftChoice, leadInSegment, placeCursor, selectLead, snapToGrid, type Session } from "./session";

export function playabilityLabel(playability: Playability, noteCount: number): string {
  if (noteCount === 0) return "Nothing fretted yet.";
  if (playability === "wide-span") return "Wide stretch.";
  if (playability === "duplicate-string") return "Two frets on one string.";
  if (playability === "plausible") return "Playable shape.";
  return "Not checked.";
}

export type SongBar = {
  segmentId: string;
  label: string;
  hasVoicing: boolean;
  leadCount: number;
};

export function songBars(session: Session): SongBar[] {
  return session.timeline.segments.map((segment) => {
    const end = segment.startBeat + segment.durationBeats;
    return {
      segmentId: segment.id,
      label: segment.chord.label,
      hasVoicing: session.arrangement.rhythm.some((event) => event.segmentId === segment.id && event.notes.length > 0),
      leadCount: session.arrangement.lead.filter((event) => event.kind === "note" && event.startBeat >= segment.startBeat && event.startBeat < end).length,
    };
  });
}

export type RhythmRow = {
  stringIndex: StringIndex;
  label: string;
  state: string;
};

export function rhythmRows(session: Session): RhythmRow[] {
  return displayStrings().map((stringIndex) => {
    const choice = draftChoice(session, stringIndex);
    const state = choice.kind === "muted" ? "mute" : choice.kind === "sounding" ? (choice.fret === 0 ? "open" : `${choice.fret}`) : "—";
    return { stringIndex, label: openStringLabel(stringIndex), state };
  });
}

export type LeadSlot = {
  beat: number;
  label: string;
  eventId: string | null;
  kind: "empty" | "note" | "rest" | "held";
  caption: string;
};

export function leadSlots(session: Session): LeadSlot[] {
  const segment = displayedSegment(session);
  const events = leadInSegment(session);
  return Array.from({ length: 8 }, (_, index) => {
    const beat = segment.startBeat + index * 0.5;
    const onset = events.find((event) => Math.abs(event.startBeat - beat) < 1e-6);
    const held = events.find((event) => event.startBeat < beat && beat < event.startBeat + event.durationBeats - 1e-9);
    const whole = Math.floor(index / 2) + 1;
    const label = index % 2 === 0 ? `${whole}` : `${whole}+`;
    if (onset?.kind === "note") {
      return { beat, label, eventId: onset.id, kind: "note" as const, caption: noteName(onset.note.midi).replace(/[0-9-]/g, "") };
    }
    if (onset?.kind === "rest") return { beat, label, eventId: onset.id, kind: "rest" as const, caption: "rest" };
    if (held) return { beat, label, eventId: held.id, kind: "held" as const, caption: "·" };
    return { beat, label, eventId: null, kind: "empty" as const, caption: "" };
  });
}

export function focusLeadSlot(session: Session, beat: number): Session {
  const snapped = snapToGrid(beat, session.leadDuration);
  const placed = placeCursor(session, snapped);
  const event = placed.arrangement.lead.find((item) => Math.abs(item.startBeat - snapped) < 1e-6);
  return selectLead(placed, event?.id ?? null);
}

export function savedVoicingCount(session: Session): number {
  return songBars(session).filter((bar) => bar.hasVoicing).length;
}
