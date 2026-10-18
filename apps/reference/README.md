# FretWays Reference

Increment 4 musical loop. One portrait screen for the manual progression C, G, Am, F.

`packages/music` decides pitches, chord tones, rhythm, lead, and validation. The screen keeps transport, harmony choice, neck position, and the editing cursor separate. Follow uses the playhead chord. Hold keeps the chosen chord and does not change the timeline. Explore never writes the arrangement. A rhythm voicing is saved only by Use on chord. Lead notes, rests, undo, and redo change the lead layer only.

Reference playback and Hear yours are synthesized. They are not the original recording. Voices that share a MIDI pitch stay separate. Notes that start together use one audio-context time. A newer tap cancels an older tap that has not started yet. It does not cancel the timeline playback.

Play schedules about one bar ahead, then adds the next bar before that audio runs out. Pause, Stop, Seek, and Loop start the schedule again from the playhead. The on-screen beat follows the audio-context time captured when the schedule starts. That is not a measured speaker latency. Fret taps use a separate audio group.

Entering Lead places the insertion cursor in the selected chord when it is not already there. The cursor then stays put while the playhead moves. At chord, At playhead, Back, and Forward move it explicitly. A note is refused when the cursor is outside the selected chord.

The project file is schema 1 JSON: timeline, arrangement, and title. UI state is not stored. Save writes a temporary file, moves the previous project aside, then moves the temporary file into place. If the temporary write fails, the current file stays. If the final move throws, the backup is restored. Open uses the backup when the main file is unreadable. A crash inside the phone's own file move has not been tested. A broken file is rejected and the current session stays in memory.

Both audio decoder-disable flags stay on.

## Checks without a phone

```sh
cd apps/reference
npm test
npm run typecheck
```

## Android

On the Mac, with the iQOO Neo 6:

```sh
git switch feature/phase-1-increment-4-musical-loop
cd apps/reference
npm ci
npm test
npx expo prebuild --platform android --no-install
npm run assert-flags
npm run android
```

Stop if the disable flags are missing. Suggested pass: choose G, explore a nearby note, build a voicing and use it on the chord, enter a short lead, Hear yours, switch Compare between Map and Yours, Save, kill the app, and Open. Listening and guitarist acceptance are still open.

## Out of scope

Microphone, song upload, recognition, suggestions, accounts, cloud sync, and payments.
