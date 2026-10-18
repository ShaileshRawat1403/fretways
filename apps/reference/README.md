# FretWays Reference

Increment 4 musical loop. One portrait screen for the manual progression C, G, Am, F.

`packages/music` decides pitches, chord tones, rhythm, lead, and validation. The screen keeps transport, harmony choice, neck position, and the editing cursor separate. Follow uses the playhead chord. Hold keeps the chosen chord and does not change the timeline. Explore never writes the arrangement. A rhythm voicing is saved only by Use on chord. Lead notes, rests, undo, and redo change the lead layer only.

Reference playback and Hear yours are synthesized. They are not the original recording. Voices that share a MIDI pitch stay separate. Notes that start together use one audio-context time. A newer tap cancels an older tap that has not started yet. It does not cancel the timeline playback.

The project file is schema 1 JSON in the app documents folder: timeline, arrangement, and title. UI state is not stored. Opening a broken file shows the reason and leaves the current session in place. The file write is a normal write. It is not claimed to be atomic on Android.

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
