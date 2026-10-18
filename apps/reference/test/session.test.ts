import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { placeNote, prototypeTimeline, standardTuning, defaultNeck } from "../../../packages/music/src/index";
import { cellAt } from "../src/neck";
import { parseProject, toProject, applyProject } from "../src/project";
import {
  boardMarks,
  clearDraft,
  commitDraft,
  createSession,
  deleteSelectedLead,
  displayedSegment,
  exploreNotice,
  formatBeat,
  formatInsertion,
  insertLead,
  leadInSegment,
  moveNeck,
  nextLeadSerial,
  pause,
  placePlayhead,
  placeCursor,
  placeCursorAtPlayhead,
  play,
  redo,
  removeRhythm,
  replaceSelectedLead,
  savedRhythm,
  seek,
  selectSegment,
  setDraftFret,
  setHarmonyChoice,
  setLeadDuration,
  setLoop,
  setYoursMode,
  stepCursor,
  undo,
} from "../src/session";

const timeline = prototypeTimeline();
const g = cellAt({ id: "g-major", label: "G", root: 7, quality: "major" }, 4, 0);

function note(stringIndex: 0 | 1 | 2 | 3 | 4 | 5, fret: number) {
  return placeNote(standardTuning, defaultNeck, { stringIndex, fret });
}

describe("timeline transport", () => {
  it("seeks to a segment, loops, and stops at the end", () => {
    const session = createSession(timeline);
    const sought = selectSegment(session, "g-major");
    assert.equal(sought.playing, false);
    assert.equal(sought.beat, 4);
    assert.equal(formatBeat(sought.beat), "2.1");
    const playing = play(sought);
    const wrapped = placePlayhead({ ...playing, loop: true }, 16);
    assert.equal(wrapped.beat, 0);
    assert.equal(wrapped.playing, true);
    const ended = placePlayhead(playing, 16);
    assert.equal(ended.playing, false);
    assert.equal(ended.beat, 16);
    assert.equal(formatBeat(16), "end");
  });
});

describe("follow and hold", () => {
  it("keeps held harmony while the playhead and neck move", () => {
    let session = createSession(timeline);
    assert.equal(displayedSegment(session).id, "c-major");
    session = placePlayhead(session, 4);
    assert.equal(displayedSegment(session).id, "g-major");
    session = moveNeck(session, 12);
    assert.equal(session.firstFret, 12);
    assert.equal(displayedSegment(session).id, "g-major");
    assert.equal(session.timeline, timeline);
    session = setHarmonyChoice(session, "hold");
    session = placePlayhead(session, 8);
    session = moveNeck(session, 0);
    assert.equal(displayedSegment(session).id, "g-major");
    assert.equal(session.beat, 8);
    assert.equal(session.timeline.segments[2].chord.label, "Am");
    const paused = pause(play(session));
    const sought = selectSegment(paused, "f-major");
    assert.equal(sought.playing, false);
    assert.equal(sought.beat, 12);
    assert.equal(displayedSegment(sought).id, "g-major");
  });
});

describe("explore and rhythm", () => {
  it("does not write an arrangement when exploring", () => {
    const session = createSession(timeline);
    const next = exploreNotice(session, g.noteName, g.intervalLabel);
    assert.equal(next.arrangement, session.arrangement);
    assert.match(next.notice, /Explore does not save/);
  });

  it("builds one fret per string and saves only on commit", () => {
    let session = setHarmonyChoice(placePlayhead(createSession(timeline), 4), "hold");
    session = setDraftFret(session, 5, 3);
    session = setDraftFret(session, 4, 0);
    session = setDraftFret(session, 4, 0);
    session = setDraftFret(session, 4, 0);
    assert.equal(savedRhythm(session), null);
    session = commitDraft(session);
    const saved = savedRhythm(session);
    assert.equal(saved?.segmentId, "g-major");
    assert.equal(saved?.notes.length, 2);
    assert.equal(session.arrangement.lead.length, 0);
    const shown = boardMarks({ ...session, workspace: "compare", compareView: "yours" });
    assert.equal(shown["5-3"], "yours");
    assert.equal(shown["4-0"], "yours");
    assert.deepEqual(boardMarks({ ...session, workspace: "compare", compareView: "reference" }), {});
    session = removeRhythm(session);
    assert.equal(savedRhythm(session), null);
    session = clearDraft(session);
    assert.equal(session.arrangement.rhythm.length, 0);
    const compared = boardMarks({ ...session, workspace: "compare", compareView: "yours", harmonyChoice: "hold", heldSegmentId: "g-major" });
    assert.deepEqual(compared, {});
  });
});

describe("lead editing", () => {
  it("inserts, rests, replaces, and undoes without touching rhythm", () => {
    let session = commitDraft(setDraftFret(setHarmonyChoice(placePlayhead(createSession(timeline), 4), "hold"), 3, 0));
    const rhythm = session.arrangement.rhythm;
    session = { ...session, cursorBeat: 4 };
    session = insertLead(session, note(4, 0));
    session = insertLead({ ...session, leadDuration: 0.5 }, null);
    assert.equal(session.arrangement.rhythm, rhythm);
    assert.equal(session.arrangement.lead.length, 2);
    assert.equal(session.arrangement.lead[0].kind, "note");
    assert.equal(session.arrangement.lead[1].kind, "rest");
    assert.equal(session.cursorBeat, 5.5);
    session = replaceSelectedLead(session, note(5, 3));
    const replaced = session.arrangement.lead[1];
    assert.equal(replaced.kind, "note");
    if (replaced.kind === "note") assert.equal(replaced.note.midi, 67);
    session = deleteSelectedLead(session);
    assert.equal(session.arrangement.lead.length, 1);
    session = undo(session);
    assert.equal(session.arrangement.lead.length, 2);
    session = undo(undo(undo(session)));
    assert.equal(session.arrangement.lead.length, 0);
    assert.equal(session.arrangement.rhythm.length, 1);
    session = redo(session);
    assert.equal(session.arrangement.lead.length, 1);
    assert.equal(leadInSegment({ ...session, beat: 4, harmonyChoice: "follow" }).length, 1);
    assert.equal(leadInSegment(placePlayhead({ ...session, harmonyChoice: "follow" }, 0)).length, 0);
  });

  it("places the insertion cursor in G when lead editing starts there", () => {
    let session = selectSegment(createSession(timeline), "g-major");
    assert.equal(session.beat, 4);
    assert.equal(session.cursorBeat, 0);
    session = setYoursMode(session, "lead");
    assert.equal(session.cursorBeat, 4);
    assert.equal(displayedSegment(session).id, "g-major");
    session = insertLead(session, note(4, 0));
    session = insertLead(session, note(3, 0));
    assert.equal(session.arrangement.lead.length, 2);
    for (const event of session.arrangement.lead) {
      assert.ok(event.startBeat >= 4 && event.startBeat < 8);
    }
    const cursor = session.cursorBeat;
    session = selectSegment(session, "a-minor");
    assert.equal(session.cursorBeat, cursor);
    assert.equal(session.beat, 8);
    const blocked = insertLead(session, note(5, 0));
    assert.equal(blocked.arrangement.lead.length, 2);
    assert.match(blocked.notice, /Place the cursor/);
  });

  it("snaps the insertion cursor to the quarter or eighth grid without following transport", () => {
    let session = setYoursMode(selectSegment(createSession(timeline), "g-major"), "lead");
    const parked = session.cursorBeat;
    session = placePlayhead(session, 4.6);
    assert.equal(session.cursorBeat, parked);
    const quarter = placeCursorAtPlayhead(session);
    assert.equal(quarter.cursorBeat, 4);
    assert.equal(quarter.beat, 4.6);
    const eighth = placeCursorAtPlayhead(setLeadDuration(session, 0.5));
    assert.equal(eighth.cursorBeat, 4.5);
    assert.equal(stepCursor(eighth, 1).cursorBeat, 5);
    assert.equal(stepCursor(stepCursor(eighth, 1), -1).cursorBeat, 4.5);
    assert.equal(formatInsertion(4), "2.1");
    assert.equal(formatInsertion(7.5), "2.4½");
  });

  it("rejects a note or rest that would leave the selected chord", () => {
    let session = setYoursMode(selectSegment(createSession(timeline), "g-major"), "lead");
    session = insertLead(session, note(4, 0));
    assert.equal(session.arrangement.lead[0].startBeat, 4);
    session = insertLead(placeCursor(session, 6), null);
    assert.equal(session.arrangement.lead[1].kind, "rest");
    assert.equal(session.arrangement.lead[1].startBeat, 6);
    session = insertLead(placeCursor(session, 7), note(5, 0));
    assert.equal(session.arrangement.lead[2].startBeat, 7);
    assert.equal(session.arrangement.lead[2].durationBeats, 1);
    const saved = session.arrangement.lead.length;
    const crossing = insertLead({ ...session, cursorBeat: 7.5, leadDuration: 1 }, null);
    assert.equal(crossing.arrangement.lead.length, saved);
    assert.match(crossing.notice, /continue past G/);
    const ending = insertLead({ ...session, cursorBeat: 7.5, leadDuration: 0.5 }, null);
    assert.equal(ending.arrangement.lead.at(-1)?.startBeat, 7.5);
    assert.equal(ending.arrangement.lead.at(-1)?.durationBeats, 0.5);
    assert.equal(ending.arrangement.lead.at(-1)?.kind, "rest");
  });
});

describe("project files", () => {
  it("saves musical data and rejects a corrupt file", () => {
    let session = insertLead(createSession(timeline), note(5, 0));
    const project = toProject(session);
    assert.equal(project.schema, 1);
    assert.equal("beat" in project, false);
    const opened = applyProject(createSession(), project);
    assert.equal(opened.arrangement.lead.length, 1);
    assert.equal(opened.beat, 0);
    const bad = parseProject("{");
    assert.equal(bad.ok, false);
    const wrong = parseProject(JSON.stringify({ schema: 1, title: "x", timeline, arrangement: { rhythm: [], lead: [{ kind: "note", id: "bad", startBeat: 0, durationBeats: 1, note: { ...note(4, 0), midi: 1 } }] } }));
    assert.equal(wrong.ok, false);
    if (!wrong.ok) assert.match(wrong.reason, /does not match|not valid|midi/i);
    const nested = parseProject(JSON.stringify({ schema: 1, title: "x", timeline: { ...timeline, segments: [null] }, arrangement: { rhythm: [null], lead: [null] } }));
    assert.equal(nested.ok, false);
    assert.equal(setLoop(session, true).transportEpoch, session.transportEpoch + 1);
    assert.equal(setLoop(session, true).cursorBeat, session.cursorBeat);
  });

  it("keeps lead ids unique after reopening", () => {
    let session = setYoursMode(selectSegment(createSession(timeline), "g-major"), "lead");
    session = insertLead(session, note(4, 0));
    session = insertLead(session, note(3, 0));
    session = insertLead(session, null);
    const opened = applyProject(createSession(), parseProject(JSON.stringify(toProject(session))).ok ? (parseProject(JSON.stringify(toProject(session))) as { ok: true; project: ReturnType<typeof toProject> }).project : toProject(session));
    assert.equal(opened.nextId, 4);
    const more = insertLead(setYoursMode(opened, "lead"), note(5, 0));
    const ids = more.arrangement.lead.map((event) => event.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(ids.length, 4);
    const again = applyProject(createSession(), toProject(more));
    assert.deepEqual(again.arrangement.lead.map((event) => event.id), ids);
    assert.equal(nextLeadSerial(again.arrangement.lead), 5);
  });
});
