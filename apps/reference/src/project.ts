import { defaultNeck, standardTuning, timelineLength, validateArrangement } from "../../../packages/music/src/index";
import type { Arrangement, ChordSymbol, HarmonicSegment, Timeline } from "../../../packages/music/src/index";

import type { Session } from "./session";
import { createSession, emptyArrangement } from "./session";

export const PROJECT_SCHEMA = 1;

export type ProjectFile = {
  schema: typeof PROJECT_SCHEMA;
  title: string;
  timeline: Timeline;
  arrangement: Arrangement;
};

export type ParseResult = { ok: true; project: ProjectFile } | { ok: false; reason: string };

export function toProject(session: Session, title = "FretWays"): ProjectFile {
  return {
    schema: PROJECT_SCHEMA,
    title,
    timeline: session.timeline,
    arrangement: session.arrangement,
  };
}

function isChord(value: unknown): value is ChordSymbol {
  if (!value || typeof value !== "object") return false;
  const chord = value as ChordSymbol;
  return typeof chord.id === "string" && typeof chord.label === "string" && (chord.quality === "major" || chord.quality === "minor") && Number.isInteger(chord.root) && chord.root >= 0 && chord.root <= 11;
}

function isTimeline(value: unknown): value is Timeline {
  if (!value || typeof value !== "object") return false;
  const timeline = value as Timeline;
  if (timeline.meter !== "4/4" || !Number.isFinite(timeline.bpm) || timeline.bpm <= 0 || !Array.isArray(timeline.segments) || timeline.segments.length === 0) {
    return false;
  }
  return timeline.segments.every((segment) => {
    const item = segment as HarmonicSegment;
    return typeof item.id === "string" && item.provenance === "manual" && Number.isFinite(item.startBeat) && item.startBeat >= 0 && Number.isFinite(item.durationBeats) && item.durationBeats > 0 && isChord(item.chord);
  });
}

function isArrangement(value: unknown): value is Arrangement {
  if (!value || typeof value !== "object") return false;
  const arrangement = value as Arrangement;
  return Array.isArray(arrangement.rhythm) && Array.isArray(arrangement.lead);
}

export function parseProject(raw: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "The saved file is not valid JSON." };
  }
  if (!parsed || typeof parsed !== "object") return { ok: false, reason: "The saved file is empty." };
  const document = parsed as Partial<ProjectFile>;
  if (document.schema !== PROJECT_SCHEMA) return { ok: false, reason: "This file uses an unsupported project version." };
  if (!isTimeline(document.timeline) || !isArrangement(document.arrangement)) {
    return { ok: false, reason: "The saved song is missing its timeline or arrangement." };
  }
  const errors = validateArrangement(document.arrangement, document.timeline, standardTuning, defaultNeck);
  if (errors.length > 0) return { ok: false, reason: errors[0] ?? "The saved arrangement is not valid." };
  if (timelineLength(document.timeline) <= 0) return { ok: false, reason: "The saved timeline has no beats." };
  return {
    ok: true,
    project: {
      schema: PROJECT_SCHEMA,
      title: typeof document.title === "string" && document.title.trim() ? document.title : "FretWays",
      timeline: document.timeline,
      arrangement: document.arrangement,
    },
  };
}

export function applyProject(session: Session, project: ProjectFile): Session {
  const fresh = createSession(project.timeline);
  return {
    ...fresh,
    arrangement: project.arrangement ?? emptyArrangement(),
    notice: `Opened ${project.title}.`,
  };
}
