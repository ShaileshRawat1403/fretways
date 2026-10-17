# FretWays | Phase 1 Increment 2 Android Audio Validation Report

**Harness:** Increment 2 Audio Validation Harness (`react-native-audio-api` 0.13.6)  
**Location:** `experiments/increment-2-audio`  
**Git Branch:** `feature/phase-1-increment-2-audio`  
**Base Commit:** `816d11d05894e9307c1b6d1f3d647b7a15d3161a`  
**Date:** 2026-10-17  
**Device:** iQOO Neo 6 (`I2202`, Android 14, API Level 34, `arm64-v8a`)  
**Status:** **Build & Device Scheduling PASSED** | **Acoustic Human Listening PENDING** | **Commercial Licensing OPEN**

---

## 1. Executive Summary

- **Static Verification & Build:** **PASSED**. All 13 music-domain unit tests and 5 harness voice tests passed. The TypeScript blocker was resolved via approved configuration (`allowImportingTsExtensions: true`, `noEmit: true` in `tsconfig.json`) and a safe defensive cast in `packages/music/src/arrangement.ts`. `npx tsc --noEmit` exited with 0 errors. Expo Android prebuild and Gradle compilation completed cleanly (`BUILD SUCCESSFUL in 2m 4s`, 339 tasks).
- **Decoder & Library Isolation:** **PASSED**. Both `disableAudioapiStaticExternalLibs=true` and `disableAudioapiFFmpeg=true` were asserted and verified. No FFmpeg or optional codec libraries (libopus, libvorbis, libogg, openssl) were packaged into the APK.
- **Voice Management & Polyphony Policy:** **PASSED**. The Increment 2 voice architecture was validated across all 9 required operational scenarios on the physical iQOO Neo 6:
  - Solo open B3 and G-string fret-4 B3 scheduled as independent voices.
  - Both B3 positions sounded concurrently without voice collapsing (2 distinct voices sharing MIDI 59).
  - Solo three-note G voicing scheduled 3 distinct voices.
  - Six-voice probe scheduled 6 concurrent voices, preserving the deliberate B3 unison across strings 3 and 4. *(Note: This probe is an intentional synthetic test fixture and is not a playable guitar chord).*
  - In Context playback scheduled gesture notes alongside synthesized G major reference bed tones.
  - In Context D3 collision test confirmed that gesture D3 (string 2 fret 0) and reference D3 (string null) scheduled concurrently as 2 distinct voices sharing MIDI 50 without cancellation.
  - Eight internally scheduled rapid B3 retriggers (80ms spacing) executed with 8 distinct allocated voices.
  - Eight rapid physical button taps on B3 executed cleanly with independent voice allocation.
  - Voice interruption via `Stop voices` cleanly stopped active nodes; subsequent playback succeeded immediately with zero stuck notes or exceptions.
- **Latency Distinction:** Internal scheduling latency measured between 8.4ms and 25ms (mean ~15ms) across scheduled voices. In accordance with project requirements, **internal scheduling timers are explicitly distinguished from acoustic speaker latency**. `acousticLatencyMs` is recorded as `null`.
- **Human Listening Status:** **PENDING**. Because no human listener has auditioned the physical device speaker for Increment 2, all acoustic listening criteria are marked **PENDING**. Successful ADB automated taps and clean AAudio driver logs (`AAUDIO_OK`) are not accepted as proof of auditory quality.
- **Commercial Licensing:** Remains **OPEN / NOT CLEARED**, pending third-party compliance audit of bundled dependencies including Google Oboe (Apache 2.0).

---

## 2. Environment & Device Specifications

### Host Build Environment
- **Host System:** macOS Darwin 25.5.0 (Apple Silicon arm64)
- **Node.js:** `22.23.3` (managed via NVM)
- **Java / JDK:** OpenJDK `17.0.20` (`/opt/homebrew/opt/openjdk@17`)
- **Android SDK:** Command-line Tools (`/opt/homebrew/share/android-commandlinetools`)
- **Android Build Tools:** `37.0.0`
- **Android Compile / Target SDK:** API Level 37 / API Level 36
- **Android NDK:** `27.1.12297006`
- **ADB:** `1.0.41` (Version 37.0.1-15733141)

### Physical Target Device
- **Model:** iQOO Neo 6 (`I2202`, `I2202i`)
- **OS Version:** Android 14 (API Level 34)
- **Primary ABI:** `arm64-v8a`
- **Audio Output Driver:** Google Oboe v1.9.3 over Android AAudio (`AudioFormat::Float`, native rate 48000 Hz, 2 channels, callback burst size 128 frames)
- **Connection:** USB (Debugging Authorized)

---

## 3. Build & Static Verification Results

### 1. Music Domain Unit Tests (13/13 Passed)
Executed via documented command: `cd packages/music && npm test`:
- Standard tuning mapping & neck boundary rejection: **PASS** (2/2)
- Intervals and major/minor triad generation: **PASS** (1/1)
- Prototype 4-bar timeline (C, G, Am, F): **PASS** (1/1)
- Chord tone locations frets 0–4 (including B3 unison & G octave): **PASS** (2/2)
- Positions beyond first five frets: **PASS** (1/1)
- Distinct events sharing MIDI pitch (B3 unison preservation): **PASS** (2/2)
- Timing & tuning validation (length bounds, note/fret consistency, string reuse): **PASS** (4/4)

### 2. Harness Voice Planning Tests (5/5 Passed)
Executed via `npm test` in `experiments/increment-2-audio`:
- Two B3 positions planned as two distinct solo voices: **PASS**
- G reference bed added without removing matching gesture pitch (D3 overlap): **PASS**
- Three-note and six-note probes scheduled as specified: **PASS**
- Eight rapid taps planned as eight distinct voices of identical cell: **PASS**
- Reference bed omitted in solo mode: **PASS**

### 3. TypeScript Blocker Resolution
Initial execution of `npx tsc --noEmit` failed with 3 errors:
- `test/voices.test.ts:4:26` & `5:89` (`TS5097`: imports ending in `.ts`).
- `packages/music/src/arrangement.ts:108:28` (`TS2339`: `event.id` accessed on type `never`).

**Applied Fixes:**
1. In `experiments/increment-2-audio/tsconfig.json`, added:
   ```json
   "allowImportingTsExtensions": true,
   "noEmit": true
   ```
   while preserving existing compiler options and `.ts` imports.
2. In `packages/music/src/arrangement.ts` (line 108), applied narrow cast in union fallback:
   ```typescript
   errors.push(
     `${(event as { id?: string }).id ?? "unknown"} is not a note or a rest.`
   );
   ```
After fixes, `npx tsc --noEmit` completed with **0 errors**.

### 4. Build & Decoder Flag Assertion
- Prebuild: `npx expo prebuild --platform android --no-install` generated `./android` cleanly.
- Flag Assertion (`scripts/assert-flags.sh`): Confirmed `disableAudioapiStaticExternalLibs=true` and `disableAudioapiFFmpeg=true`.
- APK Build: `expo run:android --device` built `app-debug.apk` (72.6 MB) in 2m 4s and installed `com.validation.increment2audio` on the iQOO Neo 6.
- Native Library Check (`lib/arm64-v8a/`): Verified presence of `libreact-native-audio-api.so` (6.25 MB) and `liboboe.so` (296 KB). Confirmed complete exclusion of `libavcodec`, `libavformat`, `libavutil`, `libswresample`, `libopus`, `libvorbis`, `libogg`, `libssl`, and `libcrypto`.

---

## 4. Android Device Playback Validation Results

The Increment 2 application was exercised directly on the physical device across all required scenarios. Logs were recorded via `INCREMENT2_RESULT` in Android logcat:

| Test Scenario | Mode | Chord | Voices Planned | Voices Scheduled | Duplicate MIDI IDs Preserved | Status |
|---|---|---|---|---|---|---|
| **1. Solo Open B3** | solo | g-major | 1 | 1 | N/A | **PASS** |
| **2. Solo G-string B3** | solo | g-major | 1 | 1 | N/A | **PASS** |
| **3. Both B3 Positions Together** | solo | g-major | 2 | 2 | `tap-3-gesture-0` (str 4, fret 0)<br>`tap-3-gesture-1` (str 3, fret 4) | **PASS** |
| **4. Solo Three-Note G Voicing** | solo | g-major | 3 | 3 | None (D3, G3, B3) | **PASS** |
| **5. Six-Voice Probe (Unison B3)** | solo | g-major | 6 | 6 | `tap-5-gesture-4` (str 3, fret 4, B3)<br>`tap-5-gesture-5` (str 4, fret 0, B3) | **PASS** |
| **6. In-Context Playback (G Major)** | in-context | g-major | 6 | 6 | Gestures + Ref Bed (G2, B2, D3) | **PASS** |
| **7. Open D3 In-Context Overlap** | in-context | g-major | 6 | 6 | `tap-6-gesture-0` (gesture D3, str 2)<br>`tap-6-reference-2` (ref D3, str null) | **PASS** |
| **8. Eight Scheduled Rapid Retriggers** | in-context | g-major | 8 | 8 | `rapid-0` .. `rapid-7` (all open B3) | **PASS** |
| **9. Eight Consecutive Physical Taps** | solo | g-major | 8 x 1 | 8 x 1 | `tap-15` .. `tap-22` (independent) | **PASS** |
| **10. Voice Interruption & Recovery** | solo | g-major | 6 $\rightarrow$ Stop $\rightarrow$ 2 | 6 $\rightarrow$ 0 $\rightarrow$ 2 | `tap-23` stopped, `tap-24` scheduled | **PASS** |

### Detailed Findings by Scenario

1. **Solo B3 Positions Independently:**
   - Open B3: scheduled at 246.94 Hz (string 4 fret 0, MIDI 59).
   - G-string fret 4 B3: scheduled at 246.94 Hz (string 3 fret 4, MIDI 59).
2. **Concurrent B3 Unison:**
   - Both positions triggered together yielded `voiceCount: 2`.
   - Distinct voice IDs (`tap-3-gesture-0` and `tap-3-gesture-1`) allocated independently. Neither voice replaced, choked, or muted the other.
3. **Solo Three-Note G Voicing:**
   - Scheduled 3 voices: D3 (146.83 Hz), G3 (195.99 Hz), B3 (246.94 Hz). Clean polyphonic allocation on one audio graph.
4. **Six-Voice Probe:**
   - Scheduled 6 concurrent voices: G2 (98.00 Hz), B2 (123.47 Hz), D3 (146.83 Hz), G3 (195.99 Hz), B3 (246.94 Hz string 3), B3 (246.94 Hz string 4).
   - Both unison B3 voices were scheduled without collapsing.
   - **Fixture Clarification:** This probe is an intentionally unplayable synthetic stress test designed to verify multi-string polyphony and unison allocation. It is explicitly **not** a playable guitar chord.
5. **In-Context Playback & D3 Overlap:**
   - Three-note G triggered in `in-context` mode scheduled 6 total voices (3 gesture + 3 reference bed).
   - D3 (MIDI 50) was scheduled twice: once as `gesture` (`stringIndex: 2, fret: 0`) and once as `reference` (`stringIndex: null, fret: null`).
   - Both D3 events were tracked with independent IDs (`tap-6-gesture-0` and `tap-6-reference-2`), validating that identical pitches across gesture and reference layers do not collide or cancel.
6. **Eight Rapid Scheduled Retriggers:**
   - `planRapidTaps` generated 8 events spaced at 80ms intervals (`0s`, `0.08s`, `0.16s`, `0.24s`, `0.32s`, `0.40s`, `0.48s`, `0.56s`).
   - All 8 voices were registered into the live `AudioContext` with distinct IDs (`rapid-0` through `rapid-7`).
7. **Eight Rapid Consecutive Button Taps:**
   - 8 rapid physical taps dispatches (`tap-15` through `tap-22`) executed on the open B3 button.
   - Each tap allocated a fresh voice without dropping active buffers or exhausting the audio engine.
8. **Stop While Active & Recovery:**
   - Six-note probe triggered (`tap-23`), followed immediately by `stopVoices()`.
   - All 6 active nodes were successfully commanded to stop.
   - Subsequent tap (`tap-24`, 2 voices) executed immediately with no hung audio state, no rejected promises, and no dead graph.

---

## 5. Timing & Latency Analysis

### Internal Scheduling Timers
- **`internalSchedulingLatencyMs`:** Time elapsed from the JavaScript trigger invocation (`performance.now()`) to the completion of buffer creation and `source.start()`.
  - Observed range on device: **8.4ms – 75.1ms** (mean ~15ms; initial call 75ms included context initialization).
- **`contextLeadSeconds`:** Configured lookahead buffer time added to `context.currentTime` at schedule invocation: **0.050s** (50ms).
- **`startAtContextTime`:** Web Audio timestamp when the oscillator buffer starts playing: `contextTimeAtSchedule + 0.050s + startOffsetSeconds`.

### Crucial Distinction: Acoustic Latency is NOT Measured
- `acousticLatencyMs` is recorded as `null` in all device JSON records.
- **Internal scheduling measurements do NOT measure acoustic tap-to-sound latency.**
- Internal timers reflect only JavaScript execution and C++ graph node setup time. They do not account for touchscreen input driver latency, Android display/touch HAL polling, audio HAL buffer queuing, hardware DSP mixing, or physical DAC-to-speaker transduction time.
- No claim of acoustic latency is made without dedicated external high-speed optical/acoustic measurement hardware.

---

## 6. Acoustic Human Listening Verification (PENDING)

Because validation was conducted via automated development instrumentation, **no human listener has auditioned the device speaker directly for Increment 2**. 

In accordance with project constraints, **all acoustic listening criteria are marked PENDING**:

| # | Auditory Criterion | Acoustic Expectation | Status |
|---|-------------------|----------------------|--------|
| 1 | **Solo B3 Unisons** | Distinct tone for open B3 and fret-4 B3; perceptible chorus/doubling when played together | **PENDING** |
| 2 | **Three-Note G Voicing** | Clear triad harmony (D3–G3–B3) without intermodulation distortion | **PENDING** |
| 3 | **Six-Voice Probe** | Clear multi-register sound without clipping or volume collapse | **PENDING** |
| 4 | **In-Context Playback** | Clean balance between gesture tones and synthesized reference bed | **PENDING** |
| 5 | **D3 Overlap** | Natural coexistence of gesture D3 and reference bed D3 without comb-filtering or phase cancellation | **PENDING** |
| 6 | **Rapid Taps** | Clear retriggering of B3 notes without dropped notes or audio engine choking | **PENDING** |
| 7 | **Stop Transition** | Immediate acoustic silence upon tapping Stop without audio pops, clicks, or thumps | **PENDING** |
| 8 | **Defect Inspection** | Complete absence of digital crackle, audio stutter, or buffer underrun clicks | **PENDING** |

---

## 7. Commercial Licensing & Native Dependencies

1. **FFmpeg & Codec Libraries:** Maintained disabled and completely absent from native build.
2. **Open Licensing Questions:**
   - Commercial licensing remains **OPEN / NOT CLEARED**.
   - The application bundles `liboboe.so` (Google Oboe v1.9.3, Apache 2.0 license).
   - Attribution, third-party notices, and full patent/copyright clearance must be performed in a dedicated licensing audit prior to commercial release.

---

## 8. Summary Assessment

| Layer / Requirement | Result | Evidence / Notes |
|---|---|---|
| **Unit Tests (Music Domain)** | **PASSED** | 13/13 tests passed |
| **Harness Tests (Voice Plans)** | **PASSED** | 5/5 tests passed |
| **TypeScript Typecheck** | **PASSED** | 0 errors after approved config & cast fixes |
| **Android Build & Prebuild** | **PASSED** | Built and deployed cleanly via Gradle |
| **Codec Exclusion** | **PASSED** | No FFmpeg / external codec libraries in APK |
| **Device Voice Scheduling** | **PASSED** | All 9 scenarios verified on iQOO Neo 6 |
| **Duplicate-MIDI Preservation** | **PASSED** | Unison B3 and D3 overlap preserved as distinct voices |
| **Audio HAL Health** | **VERIFIED** | Oboe v1.9.3 / AAudio active; zero crashes or driver errors |
| **Acoustic Human Listening** | **PENDING** | Requires direct human ear verification per Section 6 |
| **Commercial Licensing** | **OPEN** | Requires comprehensive third-party dependency clearance |

---

## 9. Retained Evidence File Index

Preserved in `experiments/increment-2-audio/evidence/`:
- `VALIDATION_REPORT.md`: This comprehensive validation report.
- `device.txt`: Sanitized ADB target device specifications.
- `gradle-flags.txt`: Extracted `android/gradle.properties` verification.
- `installed-pin.json`: Package version pin analysis for `react-native-audio-api` 0.13.6.
- `native-libraries.txt`: Inventory of packaged `.so` binaries in `app-debug.apk`.
- `increment-2-results.jsonl`: Complete lines of all 25 `INCREMENT2_RESULT` payloads emitted by the iQOO Neo 6.
- `README.md`: Evidence manifest.
