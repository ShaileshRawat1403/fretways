import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { auditionVoices } from "../src/auditionPlan";
import {
  cellAt,
  clampFirstFret,
  moveNeck,
  positionJumps,
  referenceChords,
  selectChord,
  visibleFrets,
  visibleNeck,
  WINDOW_FRETS,
} from "../src/neck";

const chords = Object.fromEntries(referenceChords().map((chord) => [chord.label, chord]));

describe("reference neck", () => {
  it("shows G, B, and D for G major without hiding other frets", () => {
    const rows = visibleNeck(chords.G, 0);
    const marked = rows.flat().filter((cell) => cell.role);
    assert.deepEqual(
      marked.map((cell) => [cell.conventionalString, cell.fret, cell.midi, cell.noteName, cell.role]),
      [
        [1, 3, 67, "G4", "root"],
        [2, 0, 59, "B3", "third"],
        [2, 3, 62, "D4", "fifth"],
        [3, 0, 55, "G3", "root"],
        [3, 4, 59, "B3", "third"],
        [4, 0, 50, "D3", "fifth"],
        [5, 2, 47, "B2", "third"],
        [6, 3, 43, "G2", "root"],
      ],
    );
    const openHighE = rows[0][0];
    assert.equal(openHighE.role, null);
    assert.equal(openHighE.midi, 64);
    assert.equal(rows.flat().length, 6 * WINDOW_FRETS);
  });

  it("keeps the two B3 positions distinct", () => {
    const openB = cellAt(chords.G, 4, 0);
    const stoppedB = cellAt(chords.G, 3, 4);
    assert.equal(openB.midi, 59);
    assert.equal(stoppedB.midi, 59);
    assert.equal(openB.noteName, "B3");
    assert.equal(stoppedB.noteName, "B3");
    assert.notDeepEqual([openB.conventionalString, openB.fret], [stoppedB.conventionalString, stoppedB.fret]);
    assert.equal(openB.conventionalString, 2);
    assert.equal(stoppedB.conventionalString, 3);
  });

  it("can address a chord tone and a non-chord tone above fret 12", () => {
    const root = cellAt(chords.G, 5, 15);
    const other = cellAt(chords.G, 5, 13);
    assert.equal(root.fret, 15);
    assert.equal(root.noteName, "G5");
    assert.equal(root.role, "root");
    assert.equal(other.role, null);
    assert.ok(other.midi !== root.midi);
  });

  it("changes the highlighted chord without moving the neck", () => {
    const started = { chordId: "c-major", firstFret: 7 };
    const next = selectChord(started, "g-major");
    assert.equal(next.chordId, "g-major");
    assert.equal(next.firstFret, 7);
    assert.equal(visibleFrets(next.firstFret)[0], 7);
    const cTone = cellAt(chords.C, 1, 3).role;
    const gTone = cellAt(chords.G, 1, 3).role;
    assert.equal(cTone, "root");
    assert.equal(gTone, null);
  });

  it("moves across frets 0 through 24 and stops at the edges", () => {
    const state = { chordId: "g-major", firstFret: 0 };
    assert.deepEqual(visibleFrets(0), [0, 1, 2, 3, 4]);
    assert.equal(clampFirstFret(-4), 0);
    assert.equal(clampFirstFret(99), 20);
    assert.deepEqual(visibleFrets(20), [20, 21, 22, 23, 24]);
    const moved = moveNeck(state, 12);
    assert.equal(moved.chordId, "g-major");
    assert.equal(moved.firstFret, 12);
    for (const jump of positionJumps) {
      assert.equal(moveNeck(state, jump).firstFret, jump);
      assert.equal(moveNeck(state, jump).chordId, state.chordId);
    }
  });
});

describe("reference audition voices", () => {
  it("plays each B3 as MIDI 59 and keeps the positions distinct", () => {
    const openB = cellAt(chords.G, 4, 0);
    const stoppedB = cellAt(chords.G, 3, 4);
    const first = auditionVoices(openB.note, "solo", "g-major", "open-b");
    const second = auditionVoices(stoppedB.note, "solo", "g-major", "stopped-b");
    assert.equal(first.length, 1);
    assert.equal(second.length, 1);
    assert.equal(first[0].midi, 59);
    assert.equal(second[0].midi, 59);
    assert.notEqual(first[0].voiceId, second[0].voiceId);
    assert.notEqual(first[0].stringIndex, second[0].stringIndex);
  });

  it("adds synthesized G without dropping a matching or non-chord tap", () => {
    const openD = cellAt(chords.G, 2, 0);
    const openHighE = cellAt(chords.G, 5, 0);
    assert.equal(openD.role, "fifth");
    assert.equal(openHighE.role, null);
    const withD = auditionVoices(openD.note, "in-context", "g-major", "d-context");
    const withE = auditionVoices(openHighE.note, "in-context", "g-major", "e-context");
    assert.equal(withD.length, 4);
    assert.equal(withD.filter((voice) => voice.midi === 50).length, 2);
    assert.equal(withE.length, 4);
    assert.equal(withE.filter((voice) => voice.origin === "gesture" && voice.midi === 64).length, 1);
    assert.equal(auditionVoices(openHighE.note, "solo", "g-major", "e-solo").length, 1);
  });
});
