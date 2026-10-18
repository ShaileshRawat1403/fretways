import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { prototypeTimeline } from "../../../packages/music/src/index";
import { acceptSchedule, assignStartTimes, auditionVoices, beatAtContextTime, planArrangement, planReferenceProgression, planReferenceWindow } from "../src/audio/plan";
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
  });
});
