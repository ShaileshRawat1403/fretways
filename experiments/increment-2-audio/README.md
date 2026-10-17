# Increment 2 audio harness

Minimal Android test surface for FretWays. It is not the fretboard, and it does not save arrangements.

Pitch comes from `@fretways/music`. Each trigger becomes its own voice on one `AudioContext`. Two positions that share a MIDI pitch stay two voices. Stop is manual. Nothing is merged because the pitches match.

`react-native-audio-api` stays at 0.13.6. `disableFFmpeg` and `disableStaticExternalLibs` stay true.

## What the numbers mean

`internalSchedulingLatencyMs` is the time from the start of the schedule call until the voices are started. Buffers are prepared first. One audio-context time is then read, and every voice in that gesture uses it. Voices with no musical offset share that start time. The rapid-tap test still spaces voices by 80 ms from the same clock. `contextLeadSeconds` is the lead plus that musical offset. These values are internal.

`acousticLatencyMs` is always null. These timers do not measure the speaker. A listening note is a person's judgment and is not a pass by itself.

## Checks that do not need a phone

From the repository root:

```sh
node --experimental-strip-types --import packages/music/test/register.mjs --test packages/music/test/*.ts
cd experiments/increment-2-audio
npm test
```

`npm test` checks the voice plans: the B3 unison, in-context overlap on D3, the three-note and six-note probes, and eight rapid taps.

## Run on the Mac

Use the iQOO Neo 6. Stop if another phone is the only authorized device, if ADB is unauthorized, or if `assert-flags` fails.

```sh
cd experiments/increment-2-audio
npm ci
npm test
npx expo prebuild --platform android --no-install
npm run assert-flags
npm run android
```

On the phone, use Solo and In context for G. Tap each B3 position, tap both together, play the three-note G, play the six-note probe, and run the eight rapid taps. Then press Stop.

The log line starts with `INCREMENT2_RESULT`.

```sh
adb logcat -d | grep INCREMENT2_RESULT
```

Copy that line. Then listen, separately, and write whether the unisons, the chord, the six-note probe, and the rapid taps were distinguishable, and whether anything clicked, stuck, or distorted. Do not convert the schedule timings into a speaker-latency claim.

## Out of scope

Reference, Yours, Compare, persistence, suggestions, and a production mixer.
