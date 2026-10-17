import { planVoices, type AuditionMode, type ChordId } from "../../../experiments/increment-2-audio/src/voices";
import type { PlacedNote } from "../../../packages/music/src/index";

export type { AuditionMode };

export function auditionVoices(note: PlacedNote, mode: AuditionMode, chordId: ChordId, idPrefix: string) {
  return planVoices({
    gesture: [note],
    mode,
    chordId,
    idPrefix,
  });
}
