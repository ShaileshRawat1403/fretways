import {
  assessPlayability,
  defaultNeck,
  placeNote,
  prototypeTimeline,
  rhythmEvent,
  segmentAt,
  segmentById,
  standardTuning,
  timelineLength,
} from "../../../packages/music/src/index";
import type {
  Arrangement,
  HarmonicSegment,
  LeadEvent,
  PlacedNote,
  RhythmEvent,
  StringIndex,
  Timeline,
} from "../../../packages/music/src/index";

import { clampFirstFret, type LabelMode } from "./neck";

export type HarmonyChoice = "follow" | "hold";
export type Workspace = "reference" | "yours" | "compare";
export type YoursMode = "explore" | "rhythm" | "lead";
export type CompareView = "reference" | "yours";
export type AuditionMode = "solo" | "in-context";
export type LeadDuration = 1 | 0.5;

export type DraftChoice =
  | { stringIndex: StringIndex; kind: "unused" }
  | { stringIndex: StringIndex; kind: "muted" }
  | { stringIndex: StringIndex; kind: "sounding"; fret: number };

export type Session = {
  timeline: Timeline;
  arrangement: Arrangement;
  beat: number;
  playing: boolean;
  loop: boolean;
  transportEpoch: number;
  harmonyChoice: HarmonyChoice;
  heldSegmentId: string;
  firstFret: number;
  workspace: Workspace;
  yoursMode: YoursMode;
  compareView: CompareView;
  auditionMode: AuditionMode;
  labelMode: LabelMode;
  cursorBeat: number;
  leadDuration: LeadDuration;
  selectedLeadId: string | null;
  draft: DraftChoice[];
  nextId: number;
  undo: Arrangement[];
  redo: Arrangement[];
  notice: string;
};

const STRINGS: StringIndex[] = [0, 1, 2, 3, 4, 5];

export function emptyArrangement(): Arrangement {
  return { rhythm: [], lead: [] };
}

export function emptyDraft(): DraftChoice[] {
  return STRINGS.map((stringIndex) => ({ stringIndex, kind: "unused" }));
}

export function createSession(timeline: Timeline = prototypeTimeline()): Session {
  return {
    timeline,
    arrangement: emptyArrangement(),
    beat: 0,
    playing: false,
    loop: false,
    transportEpoch: 0,
    harmonyChoice: "follow",
    heldSegmentId: timeline.segments[0]?.id ?? "",
    firstFret: 0,
    workspace: "reference",
    yoursMode: "explore",
    compareView: "reference",
    auditionMode: "in-context",
    labelMode: "markers",
    cursorBeat: 0,
    leadDuration: 1,
    selectedLeadId: null,
    draft: emptyDraft(),
    nextId: 1,
    undo: [],
    redo: [],
    notice: "Reference is a harmonic map, not a recorded fingering.",
  };
}

export function songLength(session: Session): number {
  return timelineLength(session.timeline);
}

export function displayedSegment(session: Session): HarmonicSegment {
  if (session.harmonyChoice === "hold") {
    return segmentById(session.timeline, session.heldSegmentId) ?? session.timeline.segments[0];
  }
  return segmentAt(session.timeline, Math.min(session.beat, songLength(session) - 0.0001)) ?? session.timeline.segments[0];
}

export function playheadSegment(session: Session): HarmonicSegment | null {
  return segmentAt(session.timeline, session.beat);
}

export function formatBeat(beat: number, length = 16): string {
  if (beat >= length) return "end";
  const safe = Math.max(0, beat);
  return `${Math.floor(safe / 4) + 1}.${Math.floor(safe % 4) + 1}`;
}

function bump(session: Session): Session {
  return { ...session, transportEpoch: session.transportEpoch + 1 };
}

export function seek(session: Session, beat: number): Session {
  const length = songLength(session);
  const next = Math.min(length, Math.max(0, beat));
  return bump({ ...session, beat: next, notice: `Playhead ${formatBeat(next, length)}.` });
}

export function selectSegment(session: Session, segmentId: string): Session {
  const segment = segmentById(session.timeline, segmentId);
  if (!segment) return { ...session, notice: "That chord is not on the timeline." };
  return seek({ ...session, playing: session.playing }, segment.startBeat);
}

export function setHarmonyChoice(session: Session, choice: HarmonyChoice): Session {
  if (choice === "hold") {
    const current = displayedSegment(session);
    return { ...session, harmonyChoice: "hold", heldSegmentId: current.id, notice: `Holding ${current.chord.label}.` };
  }
  return { ...session, harmonyChoice: "follow", notice: "Following the playhead." };
}

export function setLoop(session: Session, loop: boolean): Session {
  return { ...session, loop };
}

export function play(session: Session): Session {
  const length = songLength(session);
  const beat = session.beat >= length ? 0 : session.beat;
  return bump({ ...session, beat, playing: true, notice: "Synthesized harmony. Not the original recording." });
}

export function pause(session: Session): Session {
  return bump({ ...session, playing: false, notice: "Paused." });
}

export function stop(session: Session): Session {
  return bump({ ...session, playing: false, beat: 0, notice: "Stopped." });
}

export function placePlayhead(session: Session, beat: number): Session {
  const length = songLength(session);
  if (session.loop && beat >= length) {
    return { ...session, beat: beat % length, playing: true };
  }
  if (beat >= length) return { ...session, beat: length, playing: false, notice: "End of the progression." };
  if (beat < 0) return { ...session, beat: 0 };
  return { ...session, beat };
}

export function moveNeck(session: Session, firstFret: number): Session {
  return { ...session, firstFret: clampFirstFret(firstFret) };
}

export function setWorkspace(session: Session, workspace: Workspace): Session {
  return { ...session, workspace };
}

export function setYoursMode(session: Session, yoursMode: YoursMode): Session {
  return { ...session, yoursMode, workspace: "yours" };
}

export function setCompareView(session: Session, compareView: CompareView): Session {
  return { ...session, compareView, workspace: "compare" };
}

export function exploreNotice(session: Session, noteName: string, intervalLabel: string): Session {
  return { ...session, arrangement: session.arrangement, notice: `${noteName} · ${intervalLabel}. Explore does not save.` };
}

function remember(session: Session, arrangement: Arrangement, notice: string): Session {
  return {
    ...session,
    arrangement,
    undo: [...session.undo, session.arrangement].slice(-40),
    redo: [],
    notice,
  };
}

export function draftChoice(session: Session, stringIndex: StringIndex): DraftChoice {
  return session.draft.find((choice) => choice.stringIndex === stringIndex) ?? { stringIndex, kind: "unused" };
}

export function setDraftFret(session: Session, stringIndex: StringIndex, fret: number): Session {
  const current = draftChoice(session, stringIndex);
  const nextChoice: DraftChoice =
    current.kind === "sounding" && current.fret === fret
      ? { stringIndex, kind: "unused" }
      : { stringIndex, kind: "sounding", fret };
  return {
    ...session,
    draft: session.draft.map((choice) => (choice.stringIndex === stringIndex ? nextChoice : choice)),
    notice: nextChoice.kind === "unused" ? "Cleared that string." : `String ${6 - stringIndex} · fret ${fret}. Not saved yet.`,
  };
}

export function muteDraftString(session: Session, stringIndex: StringIndex): Session {
  const current = draftChoice(session, stringIndex);
  const nextChoice: DraftChoice = current.kind === "muted" ? { stringIndex, kind: "unused" } : { stringIndex, kind: "muted" };
  return {
    ...session,
    draft: session.draft.map((choice) => (choice.stringIndex === stringIndex ? nextChoice : choice)),
  };
}

export function clearDraft(session: Session): Session {
  return { ...session, draft: emptyDraft(), notice: "Voicing cleared. The arrangement is unchanged." };
}

export function draftMaterial(session: Session): { notes: PlacedNote[]; mutedStrings: StringIndex[]; playability: ReturnType<typeof assessPlayability> } {
  const notes: PlacedNote[] = [];
  const mutedStrings: StringIndex[] = [];
  for (const choice of session.draft) {
    if (choice.kind === "muted") mutedStrings.push(choice.stringIndex);
    if (choice.kind === "sounding") notes.push(placeNote(standardTuning, defaultNeck, { stringIndex: choice.stringIndex, fret: choice.fret }));
  }
  return { notes, mutedStrings, playability: assessPlayability(notes) };
}

export function commitDraft(session: Session): Session {
  const segment = displayedSegment(session);
  const { notes, mutedStrings, playability } = draftMaterial(session);
  if (notes.length === 0 && mutedStrings.length === 0) {
    return { ...session, notice: "Nothing to save on this chord." };
  }
  if (playability === "duplicate-string") {
    return { ...session, notice: "One fret per string. Nothing was saved." };
  }
  const event: RhythmEvent = rhythmEvent({
    id: `rhythm-${segment.id}`,
    segmentId: segment.id,
    startBeat: segment.startBeat,
    durationBeats: segment.durationBeats,
    notes,
    mutedStrings,
  });
  const rhythm = [...session.arrangement.rhythm.filter((item) => item.segmentId !== segment.id), event];
  const warning = playability === "wide-span" ? " Saved with a wide stretch." : "";
  return remember(
    session,
    { rhythm, lead: session.arrangement.lead },
    `Saved a ${segment.chord.label} voicing.${warning}`,
  );
}

export function removeRhythm(session: Session): Session {
  const segment = displayedSegment(session);
  const rhythm = session.arrangement.rhythm.filter((item) => item.segmentId !== segment.id);
  if (rhythm.length === session.arrangement.rhythm.length) return { ...session, notice: "No saved voicing on this chord." };
  return remember(session, { rhythm, lead: session.arrangement.lead }, `Removed the ${segment.chord.label} voicing.`);
}

function leadFits(session: Session, start: number, duration: number): boolean {
  return start >= 0 && start + duration <= songLength(session);
}

export function insertLead(session: Session, note: PlacedNote | null): Session {
  const duration = session.leadDuration;
  if (!leadFits(session, session.cursorBeat, duration)) {
    return { ...session, notice: "That note would pass the end of the song." };
  }
  const id = `lead-${session.nextId}`;
  const event: LeadEvent = note
    ? { kind: "note", id, startBeat: session.cursorBeat, durationBeats: duration, note }
    : { kind: "rest", id, startBeat: session.cursorBeat, durationBeats: duration };
  return remember(
    { ...session, nextId: session.nextId + 1, cursorBeat: session.cursorBeat + duration, selectedLeadId: id },
    { rhythm: session.arrangement.rhythm, lead: [...session.arrangement.lead, event] },
    note ? `Inserted ${event.kind} at ${formatBeat(event.startBeat)}.` : `Inserted a rest at ${formatBeat(event.startBeat)}.`,
  );
}

export function selectLead(session: Session, id: string | null): Session {
  return { ...session, selectedLeadId: id };
}

export function replaceSelectedLead(session: Session, note: PlacedNote): Session {
  const selected = session.arrangement.lead.find((event) => event.id === session.selectedLeadId);
  if (!selected) return insertLead(session, note);
  const lead = session.arrangement.lead.map((event) =>
    event.id === selected.id ? { kind: "note" as const, id: event.id, startBeat: event.startBeat, durationBeats: event.durationBeats, note } : event,
  );
  return remember(session, { rhythm: session.arrangement.rhythm, lead }, "Replaced the selected note.");
}

export function deleteSelectedLead(session: Session): Session {
  if (!session.selectedLeadId) return { ...session, notice: "Select a lead event first." };
  const lead = session.arrangement.lead.filter((event) => event.id !== session.selectedLeadId);
  if (lead.length === session.arrangement.lead.length) return { ...session, notice: "That lead event is already gone." };
  return remember(
    { ...session, selectedLeadId: null },
    { rhythm: session.arrangement.rhythm, lead },
    "Deleted the lead event.",
  );
}

export function undo(session: Session): Session {
  const previous = session.undo[session.undo.length - 1];
  if (!previous) return { ...session, notice: "Nothing to undo." };
  return {
    ...session,
    arrangement: previous,
    undo: session.undo.slice(0, -1),
    redo: [...session.redo, session.arrangement],
    selectedLeadId: null,
    notice: "Undone.",
  };
}

export function redo(session: Session): Session {
  const next = session.redo[session.redo.length - 1];
  if (!next) return { ...session, notice: "Nothing to redo." };
  return {
    ...session,
    arrangement: next,
    redo: session.redo.slice(0, -1),
    undo: [...session.undo, session.arrangement],
    selectedLeadId: null,
    notice: "Redone.",
  };
}

export function savedRhythm(session: Session): RhythmEvent | null {
  const segment = displayedSegment(session);
  return session.arrangement.rhythm.find((event) => event.segmentId === segment.id) ?? null;
}

export function leadInSegment(session: Session): LeadEvent[] {
  const segment = displayedSegment(session);
  const end = segment.startBeat + segment.durationBeats;
  return session.arrangement.lead.filter((event) => event.startBeat >= segment.startBeat && event.startBeat < end);
}

export function boardMarks(session: Session): Record<string, "draft" | "yours"> {
  const marks: Record<string, "draft" | "yours"> = {};
  const showSaved = session.workspace === "compare" ? session.compareView === "yours" : session.workspace === "yours" && session.yoursMode !== "explore";
  if (showSaved) {
    for (const note of savedRhythm(session)?.notes ?? []) marks[`${note.stringIndex}-${note.fret}`] = "yours";
    for (const event of leadInSegment(session)) {
      if (event.kind === "note") marks[`${event.note.stringIndex}-${event.note.fret}`] = "yours";
    }
  }
  if (session.workspace === "yours" && session.yoursMode === "rhythm") {
    for (const choice of session.draft) {
      if (choice.kind === "sounding") marks[`${choice.stringIndex}-${choice.fret}`] = "draft";
    }
  }
  return marks;
}
