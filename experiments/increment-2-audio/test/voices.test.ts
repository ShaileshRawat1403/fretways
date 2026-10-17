import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { noteName } from "../../../packages/music/src/index.ts";
import { assertDistinctVoices, assignStartTimes, planRapidTaps, planVoices, probes, sameMidiGroups } from "../src/voices.ts";

describe("voice plans", () => {
  it("keeps the two B3 positions as two solo voices", () => {
    const voices = planVoices({
      gesture: [probes.openB, probes.gStringB],
      mode: "solo",
      chordId: "g-major",
      idPrefix: "unison",
    });
    assert.equal(voices.length, 2);
    assert.equal(voices[0].midi, 59);
    assert.equal(voices[1].midi, 59);
    assert.equal(noteName(voices[0].midi), "B3");
    assert.notEqual(voices[0].voiceId, voices[1].voiceId);
    assert.deepEqual(
      voices.map((voice) => [voice.stringIndex, voice.fret]),
      [
        [4, 0],
        [3, 4],
      ],
    );
    assert.deepEqual(assertDistinctVoices(voices), []);
  });

  it("adds the G reference bed without removing a matching gesture pitch", () => {
    const voices = planVoices({
      gesture: probes.threeNote,
      mode: "in-context",
      chordId: "g-major",
      idPrefix: "context",
    });
    assert.equal(voices.length, 6);
    const d3 = voices.filter((voice) => voice.midi === 50);
    assert.equal(d3.length, 2);
    assert.deepEqual(
      d3.map((voice) => voice.origin).sort(),
      ["gesture", "reference"],
    );
    assert.equal(d3.find((voice) => voice.origin === "gesture")?.stringIndex, 2);
    assert.equal(d3.find((voice) => voice.origin === "reference")?.stringIndex, null);
    assert.deepEqual(assertDistinctVoices(voices), []);
    assert.ok(sameMidiGroups(voices).some((group) => group.midi === 50 && group.voiceIds.length === 2));
  });

  it("schedules three-note and six-note probes as written", () => {
    const three = planVoices({
      gesture: probes.threeNote,
      mode: "solo",
      chordId: "g-major",
      idPrefix: "three",
    });
    const six = planVoices({
      gesture: probes.sixNote,
      mode: "solo",
      chordId: "g-major",
      idPrefix: "six",
    });
    assert.equal(three.length, 3);
    assert.equal(six.length, 6);
    assert.equal(new Set(six.map((voice) => voice.midi)).size, 5);
    assert.equal(six.filter((voice) => voice.midi === 59).length, 2);
    assert.deepEqual(assertDistinctVoices(six), []);
  });

  it("plans eight rapid taps as eight voices of the same cell", () => {
    const voices = planRapidTaps(probes.openB, 8, 0.08);
    assert.equal(voices.length, 8);
    assert.deepEqual(new Set(voices.map((voice) => voice.voiceId)).size, 8);
    assert.ok(voices.every((voice) => voice.stringIndex === 4 && voice.fret === 0 && voice.midi === 59));
    assert.deepEqual(
      voices.map((voice) => voice.startOffsetSeconds),
      [0, 0.08, 0.16, 0.24, 0.32, 0.4, 0.48, 0.56],
    );
  });

  it("does not add the reference bed in solo mode", () => {
    const voices = planVoices({
      gesture: [probes.highG],
      mode: "solo",
      chordId: "g-major",
      idPrefix: "solo-g4",
    });
    assert.equal(voices.length, 1);
    assert.equal(voices[0].midi, 67);
    assert.equal(voices[0].noteName, "G4");
    assert.equal(voices[0].origin, "gesture");
  });
});

describe("shared start timestamp", () => {
  function spread(values: number[]): number {
    return Math.max(...values) - Math.min(...values);
  }

  it("starts a unison, a chord, a six-note probe, and a reference mix together", () => {
    const cases = [
      planVoices({ gesture: [probes.openB, probes.gStringB], mode: "solo", chordId: "g-major", idPrefix: "unison" }),
      planVoices({ gesture: probes.threeNote, mode: "solo", chordId: "g-major", idPrefix: "three" }),
      planVoices({ gesture: probes.sixNote, mode: "solo", chordId: "g-major", idPrefix: "six" }),
      planVoices({ gesture: probes.threeNote, mode: "in-context", chordId: "g-major", idPrefix: "context" }),
    ];
    for (const plans of cases) {
      const timed = assignStartTimes(plans, 12.5);
      assert.equal(spread(timed.map((voice) => voice.startAtContextTime)), 0);
      assert.equal(spread(timed.map((voice) => voice.contextTimeAtSchedule)), 0);
      assert.equal(timed[0].startAtContextTime, 12.55);
      assert.equal(timed.length, plans.length);
      assert.deepEqual(
        timed.map((voice) => voice.voiceId),
        plans.map((voice) => voice.voiceId),
      );
    }
  });

  it("keeps the 80 ms rapid-tap spacing from one shared clock", () => {
    const plans = planRapidTaps(probes.openB, 8, 0.08);
    const timed = assignStartTimes(plans, 3);
    assert.equal(new Set(timed.map((voice) => voice.contextTimeAtSchedule)).size, 1);
    assert.deepEqual(
      timed.map((voice) => voice.voiceId),
      plans.map((voice) => voice.voiceId),
    );
    for (let index = 0; index < timed.length; index += 1) {
      assert.ok(Math.abs(timed[index].startAtContextTime - (3.05 + index * 0.08)) < 1e-12);
    }
    assert.equal(timed.filter((voice) => voice.midi === 59).length, 8);
  });
});
