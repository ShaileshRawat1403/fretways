import type { PlacedNote } from "../../../packages/music/src/index";

import { playPlans } from "./audio/engine";
import { auditionVoices, type AuditionMode, type ChordId } from "./audio/plan";

export type { AuditionMode };

export async function playAudition(note: PlacedNote, mode: AuditionMode, chordId: ChordId) {
  return playPlans("tap", auditionVoices(note, mode, chordId, `reference-${Date.now()}`));
}
