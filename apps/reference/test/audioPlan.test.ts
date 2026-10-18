import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { prototypeTimeline } from "../../../packages/music/src/index";
import { acceptSchedule, assignStartTimes, auditionVoices, beatAtContextTime, placeWindowOnOrigin, planArrangement, planReferenceProgression, planReferenceWindow, TRANSPORT_HORIZON_BEATS } from "../src/audio/plan";
import { cellAt } from "../src/neck";
import { commitDraft, createSession, insertLead, placePlayhead, savedRhythm, setDraftFret, setHarmonyChoice } from "../src/session";

const gChord = { id: "g-major", label: "G", root: 7 as const, quality: "major" as const };

describe("audio plans", () => {
  it("keeps same-pitch voices and starts them together unless an offset is written", () => {
    const openB = cellAt(gChord, 4, 0).note;
    const stoppedB = cellAt(gChord, 3, 4).note;
    const voices = assignStartTimes([
      ...auditionVoices(openB, "solo", "g-major", "open"),
      ...auditionVoices(stoppedB, "solo", "g-major", "stopped"),
    ], 10);
    assert.equal(voices.length, 2);
    assert.equal(voices[0].midi, 59);
    assert.equal(voices[1].midi, 59);
    assert.notEqual(voices[0].voiceId, voices[1].voiceId);
    assert.equal(voices[0].startAtContextTime, voices[1].startAtContextTime);
    const staggered = assignStartTimes(voices.map((voice, index) => ({ ...voice, startOffsetSeconds: index * 0.08 })), 3);
    assert.ok(Math.abs(staggered[1].startAtContextTime - staggered[0].startAtContextTime - 0.08) < 1e-12);
    assert.equal(acceptSchedule(2, 2), true);
    assert.equal(acceptSchedule(1, 2), false);
  });

  it("places saved rhythm and lead on one clock without dropping a unison", () => {
    let session = setHarmonyChoice(placePlayhead(createSession(prototypeTimeline()), 4), "hold");
    session = setDraftFret(session, 4, 0);
    session = setDraftFret(session, 3, 4);
    session = commitDraft(session);
    session = { ...session, cursorBeat: 4 };
    session = insertLead(session, cellAt(gChord, 3, 0).note);
    const saved = savedRhythm(session);
    assert.equal(saved?.notes.length, 2);
    const plans = planArrangement(session.arrangement, session.timeline, 4);
    const timed = assignStartTimes(plans, 5);
    assert.equal(plans.filter((voice) => voice.midi === 59).length, 2);
    assert.equal(new Set(timed.map((voice) => voice.voiceId)).size, plans.length);
    const lead = timed.find((voice) => voice.eventId.startsWith("lead-"));
    const rhythm = timed.find((voice) => voice.eventId.startsWith("rhythm-"));
    assert.ok(lead && rhythm);
    assert.equal(lead.startAtContextTime, rhythm.startAtContextTime);
    const progression = planReferenceProgression(session.timeline, 0, 1);
    assert.equal(progression.length, 12);
    assert.equal(new Set(assignStartTimes(progression, 1).map((voice) => voice.contextTimeAtSchedule)).size, 1);
  });

  it("clips events that have already started and schedules only the next transport window", () => {
    let session = setHarmonyChoice(placePlayhead(createSession(prototypeTimeline()), 4), "hold");
    session = setDraftFret(session, 3, 0);
    session = commitDraft(session);
    session = {
      ...session,
      arrangement: {
        rhythm: session.arrangement.rhythm,
        lead: [{ kind: "note", id: "lead-long", startBeat: 4, durationBeats: 4, note: cellAt(gChord, 4, 0).note }],
      },
    };
    const scale = 60 / session.timeline.bpm;
    const clipped = planArrangement(session.arrangement, session.timeline, 6);
    const rhythm = clipped.find((voice) => voice.eventId.startsWith("rhythm-"));
    const lead = clipped.find((voice) => voice.eventId === "lead-long");
    assert.ok(rhythm && lead);
    assert.equal(rhythm.startOffsetSeconds, 0);
    assert.equal(lead.startOffsetSeconds, 0);
    assert.ok(Math.abs(rhythm.durationSeconds - 2 * scale) < 1e-9);
    assert.ok(Math.abs(lead.durationSeconds - 2 * scale) < 1e-9);
    const timeline = prototypeTimeline();
    assert.equal(planReferenceWindow(timeline, 0, 0, 4, false).length, 3);
    const middle = planReferenceWindow(timeline, 6, 6, 10, false);
    assert.equal(middle.filter((voice) => voice.eventId.startsWith("g-major")).length, 3);
    assert.equal(middle.filter((voice) => voice.eventId.startsWith("a-minor")).length, 3);
    const wrapped = planReferenceWindow(timeline, 14, 14, 18, true);
    assert.equal(wrapped.filter((voice) => voice.eventId.startsWith("f-major")).length, 3);
    assert.equal(wrapped.filter((voice) => voice.eventId.startsWith("c-major")).length, 3);
    assert.equal(planReferenceWindow(timeline, 14, 14, 18, false).filter((voice) => voice.eventId.startsWith("c-major")).length, 0);
    assert.equal(beatAtContextTime(4, 10, 12, 90), 7);
    const audible = 10.05;
    assert.equal(beatAtContextTime(0, audible, audible, 90), 0);
    assert.notEqual(beatAtContextTime(0, 10, audible, 90), 0);
  });

  it("keeps C, G, Am, and F on one origin through repeated loops", () => {
    const timeline = prototypeTimeline();
    const bpm = timeline.bpm;
    const scale = 60 / bpm;
    const origin = { beat: 0, contextTime: 20 };
    const cycles = 10;
    const placed: Array<ReturnType<typeof placeWindowOnOrigin>[number]> = [];
    for (let from = 0; from < cycles * 16; from += TRANSPORT_HORIZON_BEATS) {
      const nowBeat = from === 0 ? 0 : from - 1;
      const window = planReferenceWindow(timeline, nowBeat, from, from + TRANSPORT_HORIZON_BEATS, true);
      placed.push(...placeWindowOnOrigin(window, origin, nowBeat, bpm));
    }
    const seen = new Set<string>();
    for (const voice of placed) {
      const key = `${voice.eventId}|${voice.midi}|${voice.musicalBeat}`;
      assert.equal(seen.has(key), false);
      seen.add(key);
    }
    const chords = ["c-major", "g-major", "a-minor", "f-major"];
    for (const beat of [0, 4, 8, 12, 16, 20, 32, 16 * 9]) {
      const chord = chords[(beat % 16) / 4];
      const found = placed.find((item) => item.eventId.startsWith(chord) && Math.abs(item.musicalBeat - beat) < 1e-9);
      assert.ok(found);
      assert.ok(Math.abs(found.startAtContextTime - (origin.contextTime + beat * scale)) < 1e-9);
    }
    const firstC = placed.find((item) => item.musicalBeat === 0 && item.eventId.startsWith("c-major"));
    const firstG = placed.find((item) => item.musicalBeat === 4 && item.eventId.startsWith("g-major"));
    const loopC = placed.find((item) => item.musicalBeat === 16 && item.eventId.startsWith("c-major"));
    const lastF = placed.find((item) => item.musicalBeat === 12 && item.eventId.startsWith("f-major"));
    assert.ok(firstC && firstG && loopC && lastF);
    assert.ok(Math.abs(firstG.startAtContextTime - firstC.startAtContextTime - 4 * scale) < 1e-9);
    assert.ok(Math.abs(lastF.startAtContextTime + 4 * scale - loopC.startAtContextTime) < 1e-9);
    assert.ok(Math.abs(firstG.startAtContextTime - firstC.startAtContextTime - 4 * scale - 0.05) > 1e-6);
  });
});
