import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { placeNote, standardTuning, defaultNeck } from "../../../packages/music/src/index";
import { focusLeadSlot, leadSlots, playabilityLabel, rhythmRows, songBars } from "../src/overview";
import { commitDraft, createSession, insertLead, placeCursor, selectSegment, setDraftFret, setYoursMode } from "../src/session";

function note(stringIndex: 0 | 1 | 2 | 3 | 4 | 5, fret: number) {
  return placeNote(standardTuning, defaultNeck, { stringIndex, fret });
}

describe("musician overview", () => {
  it("shows which bars have a voicing and a lead note", () => {
    let session = setYoursMode(selectSegment(createSession(), "g-major"), "rhythm");
    session = commitDraft(setDraftFret(session, 3, 0));
    session = setYoursMode(session, "lead");
    session = insertLead(session, note(4, 0));
    const bars = songBars(session);
    assert.equal(bars.find((bar) => bar.segmentId === "g-major")?.hasVoicing, true);
    assert.equal(bars.find((bar) => bar.segmentId === "g-major")?.leadCount, 1);
    assert.equal(bars.find((bar) => bar.segmentId === "c-major")?.hasVoicing, false);
    assert.equal(playabilityLabel("wide-span", 2), "Wide stretch.");
    assert.equal(playabilityLabel("unchecked", 0), "Nothing fretted yet.");
  });

  it("lays the selected bar on eighths and moves the cursor without writing", () => {
    let session = setYoursMode(selectSegment(createSession(), "g-major"), "lead");
    session = insertLead(session, note(4, 0));
    session = insertLead(placeCursor({ ...session, leadDuration: 0.5 }, 6), null);
    const slots = leadSlots(session);
    assert.equal(slots[0]?.kind, "note");
    assert.equal(slots[1]?.kind, "held");
    assert.equal(slots.find((slot) => slot.beat === 6)?.kind, "rest");
    const before = session.arrangement;
    const focused = focusLeadSlot({ ...session, leadDuration: 1 }, 4.5);
    assert.equal(focused.arrangement, before);
    assert.equal(focused.cursorBeat, 4);
    const rows = rhythmRows(setDraftFret(session, 5, 3));
    assert.equal(rows[0]?.state, "3");
  });
});
