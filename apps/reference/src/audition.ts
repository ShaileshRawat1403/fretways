import type { PlacedNote } from "../../../packages/music/src/index";
import type { ChordId } from "../../../experiments/increment-2-audio/src/voices";

import { auditionVoices, type AuditionMode } from "./auditionPlan";
import { scheduleAudition, stopAudition } from "./deviceSchedule";

export type { AuditionMode };

export async function playAudition(note: PlacedNote, mode: AuditionMode, chordId: ChordId) {
  stopAudition();
  const voices = auditionVoices(note, mode, chordId, `reference-${Date.now()}`);
  return scheduleAudition(voices, performance.now());
}
