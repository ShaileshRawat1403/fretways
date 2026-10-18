import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assessPlayability,
  chordToneRole,
  chordTonesInRange,
  conventionalString,
  defaultNeck,
  DomainError,
  intervalBetween,
  intervalName,
  majorTriad,
  minorTriad,
  noteName,
  placeNote,
  prototypeTimeline,
  rhythmEvent,
  segmentAt,
  soundingNotesAt,
  standardTuning,
  stringIndexFromConventional,
  timelineLength,
  validateArrangement,
} from "../src/index.ts";
import type { Arrangement, ChordSymbol, ChordToneLocation, PlacedNote } from "../src/index.ts";

const range = { first: 0, last: 4 };

function tones(chord: ChordSymbol): ChordToneLocation[] {
  return chordTonesInRange(chord, standardTuning, range.first, range.last);
}

function cell(stringIndex: PlacedNote["stringIndex"], fret: number): PlacedNote {
  return placeNote(standardTuning, defaultNeck, { stringIndex, fret });
}

const timeline = prototypeTimeline();
const chords = {
  C: timeline.segments[0].chord,
  G: timeline.segments[1].chord,
  Am: timeline.segments[2].chord,
  F: timeline.segments[3].chord,
};

describe("standard tuning", () => {
  it("maps internal indexes to conventional strings and open pitches", () => {
    assert.deepEqual(standardTuning.openMidi, [40, 45, 50, 55, 59, 64]);
    assert.equal(conventionalString(0), 6);
    assert.equal(conventionalString(5), 1);
    assert.equal(stringIndexFromConventional(2), 4);
    assert.equal(noteName(40), "E2");
    assert.equal(noteName(59), "B3");
    assert.equal(noteName(64), "E4");
  });

  it("rejects a fret past the configurable neck", () => {
    assert.throws(() => placeNote(standardTuning, defaultNeck, { stringIndex: 5, fret: 25 }), DomainError);
    assert.equal(placeNote(standardTuning, defaultNeck, { stringIndex: 0, fret: 24 }).midi, 64);
  });
});

describe("intervals and triads", () => {
  it("builds major and minor triads from the root", () => {
    assert.deepEqual(majorTriad(7), [7, 11, 2]);
    assert.deepEqual(minorTriad(9), [9, 0, 4]);
    assert.equal(intervalBetween(7, 11), 4);
    assert.equal(intervalName(4), "major third");
    assert.equal(intervalName(3), "minor third");
    assert.equal(intervalName(7), "perfect fifth");
    assert.equal(chordToneRole(chords.G, 11), "third");
    assert.equal(chordToneRole(chords.Am, 0), "third");
    assert.equal(chordToneRole(chords.C, 2), null);
  });
});

describe("prototype timeline", () => {
  it("is four manual bars of C, G, Am, and F", () => {
    assert.equal(timeline.meter, "4/4");
    assert.equal(timeline.bpm, 90);
    assert.equal(timelineLength(timeline), 16);
    assert.deepEqual(
      timeline.segments.map((segment) => [segment.chord.label, segment.startBeat, segment.provenance]),
      [
        ["C", 0, "manual"],
        ["G", 4, "manual"],
        ["Am", 8, "manual"],
        ["F", 12, "manual"],
      ],
    );
    assert.equal(segmentAt(timeline, 4)?.chord.label, "G");
    assert.equal(segmentAt(timeline, 7.9)?.chord.label, "G");
    assert.equal(segmentAt(timeline, 8)?.chord.label, "Am");
  });
});

describe("chord tones in frets 0 through 4", () => {
  it("lists every G major location, including the B3 unison and the G octave", () => {
    assert.deepEqual(
      tones(chords.G).map((tone) => [tone.conventionalString, tone.fret, tone.midi, tone.noteName, tone.role]),
      [
        [6, 3, 43, "G2", "root"],
        [5, 2, 47, "B2", "third"],
        [4, 0, 50, "D3", "fifth"],
        [3, 0, 55, "G3", "root"],
        [3, 4, 59, "B3", "third"],
        [2, 0, 59, "B3", "third"],
        [2, 3, 62, "D4", "fifth"],
        [1, 3, 67, "G4", "root"],
      ],
    );
  });

  it("lists every C, Am, and F location in the same window", () => {
    assert.deepEqual(
      tones(chords.C).map((tone) => [tone.conventionalString, tone.fret, tone.noteName, tone.role]),
      [
        [6, 0, "E2", "third"],
        [6, 3, "G2", "fifth"],
        [5, 3, "C3", "root"],
        [4, 2, "E3", "third"],
        [3, 0, "G3", "fifth"],
        [2, 1, "C4", "root"],
        [1, 0, "E4", "third"],
        [1, 3, "G4", "fifth"],
      ],
    );
    assert.deepEqual(
      tones(chords.Am).map((tone) => [tone.conventionalString, tone.fret, tone.noteName, tone.role]),
      [
        [6, 0, "E2", "fifth"],
        [5, 0, "A2", "root"],
        [5, 3, "C3", "third"],
        [4, 2, "E3", "fifth"],
        [3, 2, "A3", "root"],
        [2, 1, "C4", "third"],
        [1, 0, "E4", "fifth"],
      ],
    );
    assert.deepEqual(
      tones(chords.F).map((tone) => [tone.conventionalString, tone.fret, tone.noteName, tone.role]),
      [
        [6, 1, "F2", "root"],
        [5, 0, "A2", "third"],
        [5, 3, "C3", "fifth"],
        [4, 3, "F3", "root"],
        [3, 2, "A3", "third"],
        [2, 1, "C4", "fifth"],
        [1, 1, "F4", "root"],
      ],
    );
  });
});

describe("positions beyond the first five frets", () => {
  it("keeps G chord tones past fret 12", () => {
    const found = chordTonesInRange(chords.G, standardTuning, 12, 15);
    const marked = found.map((tone) => [tone.conventionalString, tone.fret, tone.midi, tone.noteName, tone.role]);
    assert.ok(marked.some((row) => row[0] === 2 && row[1] === 12 && row[2] === 71 && row[3] === "B4"));
    assert.ok(marked.some((row) => row[0] === 6 && row[1] === 15 && row[2] === 55 && row[3] === "G3"));
    assert.ok(marked.some((row) => row[0] === 1 && row[1] === 15 && row[2] === 79 && row[3] === "G5"));
  });
});

describe("distinct events that share a MIDI pitch", () => {
  it("keeps both B3 positions in one rhythm voicing", () => {
    const openB = cell(4, 0);
    const gStringB = cell(3, 4);
    assert.equal(openB.midi, 59);
    assert.equal(gStringB.midi, 59);
    assert.notDeepEqual([openB.stringIndex, openB.fret], [gStringB.stringIndex, gStringB.fret]);

    const event = rhythmEvent({
      id: "g-unison",
      segmentId: "g-major",
      startBeat: 4,
      durationBeats: 4,
      notes: [openB, gStringB],
    });
    assert.equal(event.notes.length, 2);
    assert.equal(event.playability, "plausible");

    const arrangement: Arrangement = { rhythm: [event], lead: [] };
    assert.deepEqual(validateArrangement(arrangement, timeline, standardTuning, defaultNeck), []);
    const sounding = soundingNotesAt(arrangement, 4);
    assert.equal(sounding.length, 2);
    assert.deepEqual(
      sounding.map((item) => [item.eventId, item.note.stringIndex, item.note.fret]),
      [
        ["g-unison", 4, 0],
        ["g-unison", 3, 4],
      ],
    );
  });

  it("keeps two lead notes separate when they sound the same pitch", () => {
    const arrangement: Arrangement = {
      rhythm: [],
      lead: [
        { kind: "note", id: "lead-open-b", startBeat: 4, durationBeats: 1, note: cell(4, 0) },
        { kind: "note", id: "lead-g-string-b", startBeat: 4, durationBeats: 1, note: cell(3, 4) },
        { kind: "rest", id: "lead-rest", startBeat: 5, durationBeats: 1 },
      ],
    };
    assert.deepEqual(validateArrangement(arrangement, timeline, standardTuning, defaultNeck), []);
    const sounding = soundingNotesAt(arrangement, 4);
    assert.deepEqual(
      sounding.map((item) => item.eventId),
      ["lead-open-b", "lead-g-string-b"],
    );
    assert.equal(soundingNotesAt(arrangement, 5).length, 0);
  });
});

describe("timing and tuning validation", () => {
  it("accepts a shorter rhythm hit inside its segment and rejects one that leaves it", () => {
    const note = cell(3, 0);
    const inside = rhythmEvent({
      id: "g-hit",
      segmentId: "g-major",
      startBeat: 5,
      durationBeats: 1,
      notes: [note],
    });
    const outside = rhythmEvent({
      id: "g-early",
      segmentId: "g-major",
      startBeat: 3,
      durationBeats: 2,
      notes: [note],
    });
    assert.deepEqual(validateArrangement({ rhythm: [inside], lead: [] }, timeline, standardTuning, defaultNeck), []);
    assert.match(
      validateArrangement({ rhythm: [outside], lead: [] }, timeline, standardTuning, defaultNeck).join("\n"),
      /not contained/,
    );
  });

  it("rejects a placed note whose MIDI value disagrees with the fret", () => {
    const lying: PlacedNote = { stringIndex: 4, fret: 0, tuningId: "standard-e", midi: 71 };
    const event = rhythmEvent({
      id: "wrong-pitch",
      segmentId: "g-major",
      startBeat: 4,
      durationBeats: 1,
      notes: [lying],
    });
    assert.match(
      validateArrangement({ rhythm: [event], lead: [] }, timeline, standardTuning, defaultNeck).join("\n"),
      /does not match/,
    );
  });

  it("does not let a rhythm edit remove lead events", () => {
    const lead = { kind: "note" as const, id: "phrase", startBeat: 0, durationBeats: 1, note: cell(5, 3) };
    const arrangement: Arrangement = {
      rhythm: [
        rhythmEvent({
          id: "c-shape",
          segmentId: "c-major",
          startBeat: 0,
          durationBeats: 4,
          notes: [cell(1, 3), cell(2, 2), cell(4, 1)],
        }),
      ],
      lead: [lead],
    };
    const next: Arrangement = { ...arrangement, rhythm: [] };
    assert.equal(next.lead[0], lead);
    assert.equal(arrangement.lead.length, 1);
    assert.deepEqual(validateArrangement(arrangement, timeline, standardTuning, defaultNeck), []);
  });

  it("rejects a muted string that is also fretted", () => {
    const event = rhythmEvent({
      id: "mute-clash",
      segmentId: "g-major",
      startBeat: 4,
      durationBeats: 4,
      notes: [cell(3, 0)],
      mutedStrings: [3],
    });
    assert.match(
      validateArrangement({ rhythm: [event], lead: [] }, timeline, standardTuning, defaultNeck).join("\n"),
      /mutes string 3 and also frets it/,
    );
  });

  it("marks an impossible string reuse without deleting the notes", () => {
    const notes = [cell(4, 0), cell(4, 3)];
    assert.equal(assessPlayability(notes), "duplicate-string");
    assert.equal(notes.length, 2);
    assert.equal(assessPlayability([cell(0, 1), cell(1, 6)]), "wide-span");
  });
});
