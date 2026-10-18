# V1 / V2 audio decode harness

Disposable experiment for `react-native-audio-api` 0.13.6. It is not the Musical Possibility Engine. It has no fretboard, no theory engine, and no song session.

V1 and V2 stay open until this harness is built on the MacBook Air M1 and run on an attached Android phone. Preparation of these files is not that result.

## What the phone measures

For one WAV, one MP3, and one M4A, both as a file path and as an in-memory buffer:

- success or the error text
- duration, sample rate, channel count, frame count
- peak, RMS, and a rough frequency estimate from the PCM
- whether `isFfmpegEnabled()` is true or false

The files are a one-second 440 Hz sine at amplitude 0.5. They are already committed. See `assets/fixtures/EXPECTED.json`. Do not regenerate them for a normal run. `npm run fixtures` keeps the committed files. `npm run fixtures -- --force` replaces them and needs `ffmpeg` on the machine.

## Flags

`app.json` sets `disableFFmpeg` and `disableStaticExternalLibs` to true. On 0.13.6 those default to false, so the prebuild must rewrite `android/gradle.properties`. `npm run assert-flags` checks that before you install.

The static-library flag also drops `libssl` and `libcrypto` in this version's CMake file. The phone build is what shows whether they were actually linked.

## Already done away from the phone

- The harness source and scripts exist.
- `tone.wav`, `tone.mp3`, and `tone.m4a` are committed. Regenerating them is optional.
- No Android SDK, no phone, and no APK were available when this was prepared, so nothing was installed or decoded on a device.

## Run on the Mac

From this directory, with Android Studio, a USB phone, and Node 22:

```sh
npm ci
npx expo prebuild --platform android --no-install
npm run assert-flags
npm run metadata
npm run android
```

`npm ci` installs the lockfile exactly. Do not use `npm install` for this run. The committed fixtures are used as they are. Regenerate them only if you intend to replace the experiment inputs:

```sh
npm run fixtures -- --force
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
- `evidence/generated/native-libraries.txt` lists every packaged `.so`, grouped by ABI.
- `evidence/generated/elf-inspection.txt` is the Android NDK read of those binaries. A Mac `nm` result is not a substitute.
- `evidence/generated/inspection-verdict.txt` says whether the shared-library list, the static-link check, and the license-file check are conclusive or inconclusive. An inconclusive line is not a pass.
- License text for FFmpeg or OpenSSL only matters for libraries the build actually downloaded or linked. `downloaded-prebuilts.txt` and `installed-pin.json` record that.

## Out of scope

V3 audition, analysis load, the benchmark, and any product screen.
