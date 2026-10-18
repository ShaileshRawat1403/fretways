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
  insertLead,
  leadInSegment,
  moveNeck,
  pause,
  placePlayhead,
  play,
  redo,
  removeRhythm,
  replaceSelectedLead,
  savedRhythm,
  seek,
  selectSegment,
  setDraftFret,
  setHarmonyChoice,
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
  });
});
