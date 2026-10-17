# V1 / V2 audio decode harness

Disposable experiment for `react-native-audio-api` 0.13.6. It is not the Musical Possibility Engine. It has no fretboard, no theory engine, and no song session.

V1 and V2 stay open until this harness is built on the MacBook Air M1 and run on an attached Android phone. Preparation of these files is not that result.

## What the phone measures

For one WAV, one MP3, and one M4A, both as a file path and as an in-memory buffer:

- success or the error text
- duration, sample rate, channel count, frame count
- peak, RMS, and a rough frequency estimate from the PCM
- whether `isFfmpegEnabled()` is true or false

The files are a one-second 440 Hz sine at amplitude 0.5, generated locally. See `assets/fixtures/EXPECTED.json`.

## Flags

`app.json` sets `disableFFmpeg` and `disableStaticExternalLibs` to true. On 0.13.6 those default to false, so the prebuild must rewrite `android/gradle.properties`. `npm run assert-flags` checks that before you install.

The static-library flag also drops `libssl` and `libcrypto` in this version's CMake file. The phone build is what shows whether they were actually linked.

## Already done away from the phone

- The harness source and scripts exist.
- `tone.wav`, `tone.mp3`, and `tone.m4a` were generated here with a local encoder.
- No Android SDK, no phone, and no APK were available, so nothing was installed or decoded on a device.

## Run on the Mac

From this directory, with Android Studio, a USB phone, and Node 22:

```sh
npm install
npm run fixtures
npx expo prebuild --platform android --no-install
npm run assert-flags
npm run metadata
npm run android
```

`assert-flags` must pass before `npm run android`. If it fails, do not install the app and do not turn FFmpeg on to "fix" a decode.

On the phone, tap **Run WAV, MP3, and M4A**. The screen lists each result. The same JSON is logged as one line starting with `V1_RESULT` and written under the app cache as `v1-v2-results.json`.

Then, on the Mac:

```sh
npm run inspect
adb logcat -d | grep V1_RESULT
```

Copy `evidence/generated/` and the `V1_RESULT` line back. Do not mark V1 or V2 closed inside the harness.

## How to read it

- `ffmpegEnabled: true` means the disable flag did not take effect. Treat the run as invalid for V1.
- A failed M4A row is a valid measurement. It is not a reason to enable FFmpeg in this experiment.
- WAV and MP3 are not on the FFmpeg extension list in the 0.13.6 header. Whether they decode anyway is what the phone is for.
- `evidence/generated/library-name-scan.txt` and `native-so.txt` are the binary listing. Static libraries will not appear as their own `.so`. Use `strings-scan.txt` and `nm-scan.txt` as well, and still say if a symbol scan was inconclusive.
- License text for FFmpeg or OpenSSL only matters for libraries the build actually downloaded or linked. `downloaded-prebuilts.txt` and `installed-pin.json` record that.

## Out of scope

V3 audition, analysis load, the benchmark, and any product screen.
