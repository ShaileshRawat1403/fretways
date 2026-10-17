# V3 musical audition harness

Isolated experiment. It is not the FretWays product. It has no fretboard, no song recognition, and no analysis engine.

The timeline is 4/4 at 60 BPM. Each beat is one second.

| Time | Melody | Harmony |
|---|---|---|
| 0.0–1.0 | E4 | C major: C3, E3, G3 |
| 1.0–2.0 | D4 | C major continues |
| 2.0–3.0 | C4 | C major continues |
| 3.0–4.0 | rest | C major continues |
| 4.0–5.0 | B3 | G major starts: G2, B2, D3 |

One timeline produces the melody-only, harmony-only, and combined renders. C major stays active through the first four beats. G major and B3 start together at 4.0 seconds. G is held for the one beat that B3 sounds.

`react-native-audio-api` stays at 0.13.6. `disableFFmpeg` and `disableStaticExternalLibs` stay true. M4A is not used.

## Checks already possible without a phone

`npm run check` measures the deterministic PCM render: pitch, onset, duration, the rest, chord membership, timeline agreement, clipping, and the G/B3 alignment. A pass there is not an Android result.

## Run on the Mac

From this directory, with the iQOO Neo 6 attached and authorized:

```sh
npm ci
npm run check
npx expo prebuild --platform android --no-install
npm run assert-flags
npm run metadata
npm run android
```

Stop if `npm run check` fails, `assert-flags` fails, ADB is unauthorized, or the Android toolchain is missing. Do not turn the disable flags off.

On the phone, tap **Run measurements**, then play melody, harmony, and combined. The measurement JSON is logged as `V3_RESULT` and written to the app cache as `v3-audition-results.json`.

```sh
adb logcat -d | grep V3_RESULT
```

Copy that line and `evidence/generated/` back. Write a separate listening note for the three passes. The listening note is a person's judgment, not a calculated pass.

If OfflineAudioContext is unavailable, the result says `deterministic-pcm-fallback`. That fallback is allowed for the measurement file, and it does not by itself prove the device audio graph rendered the timeline. Playback still uses one live AudioContext.

## How to read a device result

- `ffmpegEnabled: true` means the run does not count.
- Melody pitch, onset, and duration are read from the melody-only render.
- Chord membership is read from the harmony-only render.
- The combined render must match the sum of the other two and stay below a peak of 0.99.
- Speaker delay is not the musical clock.

## Out of scope

Production Phase 1, V1 fixture changes, song import, and any M4A decoder.
