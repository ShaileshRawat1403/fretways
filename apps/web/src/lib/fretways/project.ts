import { defaultNeck, standardTuning, timelineLength, validateArrangement } from "@/lib/music";
import type { Arrangement, ChordSymbol, HarmonicSegment, Timeline } from "@/lib/music";

import type { Session } from "./session";
import { createSession, emptyArrangement, nextLeadSerial } from "./session";

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
    if (!segment || typeof segment !== "object") return false;
    const item = segment as HarmonicSegment;
    return typeof item.id === "string" && item.provenance === "manual" && Number.isFinite(item.startBeat) && item.startBeat >= 0 && Number.isFinite(item.durationBeats) && item.durationBeats > 0 && isChord(item.chord);
  });
}

function isArrangement(value: unknown): value is Arrangement {
  if (!value || typeof value !== "object") return false;
  const arrangement = value as Arrangement;
  if (!Array.isArray(arrangement.rhythm) || !Array.isArray(arrangement.lead)) return false;
  if (arrangement.rhythm.some((item) => item == null || typeof item !== "object")) return false;
  if (arrangement.lead.some((item) => item == null || typeof item !== "object")) return false;
  return true;
}

export function parseProject(raw: string): ParseResult {
  try {
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
      return { ok: false, reason: "The saved song is missing or malformed." };
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
  } catch {
    return { ok: false, reason: "The saved song is malformed." };
  }
}

export function applyProject(session: Session, project: ProjectFile): Session {
  const fresh = createSession(project.timeline);
  const arrangement = project.arrangement ?? emptyArrangement();
  return {
    ...fresh,
    arrangement,
    nextId: nextLeadSerial(arrangement.lead),
    notice: `Opened ${project.title}.`,
  };
}
