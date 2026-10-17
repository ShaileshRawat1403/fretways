import type { ChordSymbol, HarmonicSegment, PitchClass, Timeline } from "./types.ts";

function chord(id: string, label: string, root: PitchClass, quality: ChordSymbol["quality"]): ChordSymbol {
  return { id, label, root, quality };
}

export function prototypeTimeline(bpm = 90): Timeline {
  const chords: ChordSymbol[] = [
    chord("c-major", "C", 0, "major"),
    chord("g-major", "G", 7, "major"),
    chord("a-minor", "Am", 9, "minor"),
    chord("f-major", "F", 5, "major"),
  ];
  const segments: HarmonicSegment[] = chords.map((item, index) => ({
    id: item.id,
    startBeat: index * 4,
    durationBeats: 4,
    chord: item,
    provenance: "manual",
  }));
  return { meter: "4/4", bpm, segments };
}

export function timelineLength(timeline: Timeline): number {
  return timeline.segments.reduce((end, segment) => Math.max(end, segment.startBeat + segment.durationBeats), 0);
}

export function segmentAt(timeline: Timeline, beat: number): HarmonicSegment | null {
  return (
    timeline.segments.find((segment) => beat >= segment.startBeat && beat < segment.startBeat + segment.durationBeats) ??
    null
  );
}

export function segmentById(timeline: Timeline, segmentId: string): HarmonicSegment | null {
  return timeline.segments.find((segment) => segment.id === segmentId) ?? null;
}
