# FretWays | V3 Musical Audition Android Validation Report

**Experiment:** V3 Musical Audition Harness (`react-native-audio-api` 0.13.6)  
**Location:** `experiments/audio-v3`  
**Git Branch:** `experiment/v3-musical-audition`  
**Date:** 2026-10-17  
**Device:** iQOO Neo 6 (`I2202`, Android 14, API Level 34, `arm64-v8a`)  
**Status:** **Offline Measurements PASSED (23/23)** | **Live Human Audition PENDING**

---

## 1. Executive Summary

- **Android OfflineAudioContext Evaluation:** **PASSED (23/23)** on the physical iQOO Neo 6 device. The harness executed natively through Android's C++ Web Audio graph (`measurementSource: "offline-audio-context"`, `offlineError: null`). The deterministic PCM fallback was **not** triggered.
- **Frequency Measurement Methodology:** Melodic frequencies were evaluated using **zero-crossing rate estimation** over a 0.90-second steady-state window. All four melodic notes (E4, D4, C4, B3) matched their equal-temperament targets within the discrete quantization resolution of the zero-crossing counter ($\Delta f \approx 0.56\text{ Hz}$).
- **Offline Timing & Harmonic Resolution:**
  - Melodic onsets aligned within 0.2ms of nominal beats (0.0002s, 1.0002s, 2.0002s, 4.0002s); durations held steady at 0.9997s–0.9998s.
  - The one-beat rest between 3.0s and 4.0s is confirmed completely silent in the offline melody buffer (peak amplitude `0.00e+0`).
  - The C major (C3–E3–G3) to G major (G2–B2–D3) chordal transition executed cleanly at 4.0002s.
  - Note B3 sounded concurrently with G major at 4.0002s with no clipping (combined peak `0.6494`) and matched the single-timeline sum within float32 precision (`8.94e-8` max difference).
- **Separation of Offline Measurements vs Live Playback:** Device measurement results are strictly based on offline buffer rendering. Live playback was driven by an active `AudioContext` with Oboe v1.9.3 / AAudio. While driver telemetry confirmed clean stream initialization (`AAUDIO_OK`) without system-reported xruns, software logs are not a substitute for human listening. Physical acoustic audition through device speakers remains **pending human verification**.
- **Codec & Library Enclosure:** FFmpeg and optional external codec libraries remained strictly disabled (`ffmpegEnabled: false`, `disableAudioapiStaticExternalLibs=true`, `disableAudioapiFFmpeg=true`).
- **Licensing Status:** Commercial licensing remains **open / not cleared**, pending a full audit of bundled dependencies including Google Oboe.

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
- **Audio Output Driver:** Oboe v1.9.3 over AAudio (`AudioFormat::Float`, native rate 48000 Hz, 2 channels, callback burst size 128 frames)
- **Connection:** USB (Debugging Authorized)

---

## 3. Configuration & Build Verification

The build configuration strictly enforced the decoder-disable flags in `android/gradle.properties`:

```properties
disableAudioapiStaticExternalLibs=true
disableAudioapiFFmpeg=true
```

### Pre-Build & Build Steps
1. **Pre-Build Verification:** Executed `npm run check` in `experiments/audio-v3`. All 23 deterministic PCM checks passed in the Node environment.
2. **Flag Assertion:** Executed `npm run assert-flags` (`scripts/assert-flags.sh`). Confirmed both `disableAudioapiStaticExternalLibs=true` and `disableAudioapiFFmpeg=true` were present.
3. **Android Compilation:** Built debug APK via `npm run android` (`expo run:android --device`). Gradle compilation completed cleanly in 2m 16s across 339 tasks.
4. **Packaged Native Libraries:** Verified native libraries packaged in `app-debug.apk` under `lib/arm64-v8a/`:
   - `libreact-native-audio-api.so` (6,253,552 bytes)
   - `liboboe.so` (296,080 bytes)
   - `libc++_shared.so` (1,292,904 bytes)
   - `libreactnative.so` (24,063,504 bytes)
   - Standard Expo / React Native runtime binaries.
   - **Excluded:** No FFmpeg libraries (`libavcodec`, `libavformat`, `libavutil`, `libswresample`) and no optional codec libraries (`libopus`, `libvorbis`, `libogg`, `libssl`, `libcrypto`) were present.

---

## 4. Musical Timeline Specification

The experiment implemented a single unified musical timeline governed by standard 4/4 meter at 60 BPM (1 beat = 1.000 second):

```text
Time (s):   0.0s        1.0s        2.0s        3.0s        4.0s        5.0s
            |-----------|-----------|-----------|-----------|-----------|
Beat:       1           2           3           4 (Rest)    5 (Bar 2.1)
Melody:     E4 (329.6)  D4 (293.7)  C4 (261.6)  [ SILENCE ] B3 (246.9)
Harmony:    [ C Major: C3 (130.8) + E3 (164.8) + G3 (196.0) ]  [ G Major: G2 (98.0) + B2 (123.5) + D3 (146.8) ]
Resolution:                                                 B3 resolves as 3rd of G
```

- **Melody Voice:** Pure sine oscillators, amplitude 0.35, scheduled with precise start and stop times on the audio context timeline.
- **Harmony Voice:** Triads synthesized from 3 parallel sine oscillators, amplitude 0.10 per voice (total harmony amplitude 0.30).
- **Combined Voice:** Concurrent synthesis of melody and harmony on one synchronized audio clock (total theoretical peak amplitude ≤ 0.65, well below the 1.0 clipping threshold).

---

## 5. Confirmed Offline Device Measurements (`OfflineAudioContext`)

Measurements were executed on the iQOO Neo 6 using the native `OfflineAudioContext` (sample rate 44,100 Hz, 5.0 seconds duration, 220,500 samples rendered into an `AudioBuffer`).

```json
{
  "label": "V3_RESULT",
  "note": "Device measurement only. Not a closed validation.",
  "ffmpegEnabled": false,
  "device": { "os": "android", "version": "34", "name": "I2202" },
  "measurementSource": "offline-audio-context",
  "offlineError": null
}
```

### Complete 23-Check Measurement Results

| # | Test Check Name | Expected Value | Measured Device Value | Status |
|---|-----------------|----------------|-----------------------|--------|
| 1 | E4 pitch | 329.63 Hz | 330.00 Hz | **PASS** |
| 2 | E4 onset | 0.0000 s | 0.0002 s | **PASS** |
| 3 | E4 duration | 1.0000 s | 0.9997 s | **PASS** |
| 4 | D4 pitch | 293.66 Hz | 293.33 Hz | **PASS** |
| 5 | D4 onset | 1.0000 s | 1.0002 s | **PASS** |
| 6 | D4 duration | 1.0000 s | 0.9998 s | **PASS** |
| 7 | C4 pitch | 261.63 Hz | 261.67 Hz | **PASS** |
| 8 | C4 onset | 2.0000 s | 2.0002 s | **PASS** |
| 9 | C4 duration | 1.0000 s | 0.9997 s | **PASS** |
| 10 | B3 pitch | 246.94 Hz | 247.22 Hz | **PASS** |
| 11 | B3 onset | 4.0000 s | 4.0002 s | **PASS** |
| 12 | B3 duration | 1.0000 s | 0.9997 s | **PASS** |
| 13 | One-beat rest is silent | Peak = 0.0 | Melody peak `0.00e+0` | **PASS** |
| 14 | C3 belongs to C major | Active >> Later | Active `4.388e+7`, Later `9.281e+3` | **PASS** |
| 15 | E3 belongs to C major | Active >> Later | Active `4.398e+7`, Later `8.010e+2` | **PASS** |
| 16 | G3 belongs to C major | Active >> Later | Active `4.409e+7`, Later `2.633e+2` | **PASS** |
| 17 | G2 belongs to G major | At G >> During C | At G `3.938e+6`, During C `1.015e+3` | **PASS** |
| 18 | B2 belongs to G major | At G >> During C | At G `3.951e+6`, During C `3.316e+2` | **PASS** |
| 19 | D3 belongs to G major | At G >> During C | At G `3.960e+6`, During C `2.755e+2` | **PASS** |
| 20 | Combined matches one timeline | Sum difference ≈ 0 | Max difference `8.94e-8` | **PASS** |
| 21 | Combined does not clip | Peak < 1.0 | Peak `0.6494` | **PASS** |
| 22 | G starts at 4.0 seconds | Energy shift at 4.0s | G2 during C `7.610e+2`, during G `3.955e+6` | **PASS** |
| 23 | B3 resolves with G | B3 at 4.0s >> Pre-4.0s | Pre-4.0s `3.493e+4`, over G `4.822e+7` | **PASS** |

### Detailed Analysis of Offline Measurements

#### Zero-Crossing Frequency Estimation
The pitch verification algorithm (`estimateHz` in `src/audition.mjs`) counts positive and negative zero crossings over a 0.90-second steady-state window $[start + 0.05\text{s}, end - 0.05\text{s}]$:

$$\text{Frequency (Hz)} = \frac{\text{crossings}}{2 \times \text{duration}} = \frac{\text{crossings}}{2 \times 0.90\text{ s}} = \frac{\text{crossings}}{1.8} = \text{crossings} \times \frac{5}{9}$$

Because the count of zero crossings is an integer, the frequency estimation is quantized in steps of $\Delta f = 1 / 1.8 \approx 0.5556\text{ Hz}$:
- **E4 (Target: 329.63 Hz):** 594 crossings $\rightarrow 594 / 1.8 = \mathbf{330.00\text{ Hz}}$ ($\Delta = +0.37\text{ Hz}$)
- **D4 (Target: 293.66 Hz):** 528 crossings $\rightarrow 528 / 1.8 = \mathbf{293.33\text{ Hz}}$ ($\Delta = -0.33\text{ Hz}$)
- **C4 (Target: 261.63 Hz):** 471 crossings $\rightarrow 471 / 1.8 = \mathbf{261.67\text{ Hz}}$ ($\Delta = +0.04\text{ Hz}$)
- **B3 (Target: 246.94 Hz):** 445 crossings $\rightarrow 445 / 1.8 = \mathbf{247.22\text{ Hz}}$ ($\Delta = +0.28\text{ Hz}$)

All four notes fall well within the $\pm 1.0\text{ Hz}$ test tolerance and match the expected integer-quantized values for clean sinusoidal waveforms. (Chord presence was evaluated separately using Goertzel single-bin discrete Fourier filter power).

#### Floating-Point Precision & Timeline Mixing
- The maximum sample difference between the offline combined render and the discrete sum of offline melody and harmony buffers was `8.94e-8` on the device (compared to `7.45e-8` in the local Node PCM test).
- Both values reside within IEEE 754 single-precision float32 rounding epsilon ($\approx 1.19 \times 10^{-7}$), confirming that `react-native-audio-api` performs exact linear mixing without non-linear artifacts or timing jitter in its offline audio graph.

#### Timing Alignment
- Measured onsets show an offset of approximately 10 samples ($10 / 44100 \approx 0.00022\text{ s}$), reflecting the brief initial envelope ramp applied by the synthesizer node to eliminate DC click transients.

---

## 6. Live Playback Driver & System Graph Telemetry

The harness provides interactive playback buttons for three modes (Melody, Harmony, Combined) utilizing a live `AudioContext`. Start times were scheduled at `ctx.currentTime + 0.1s`.

### Driver Telemetry (Logcat & Audio HAL)
Inspection of system logs during playback execution confirmed:
- **Audio Output Subsystem:** Google Oboe v1.9.3 initialized over the Android AAudio service.
- **Stream Parameters:** `AudioFormat::Float`, 2 channels, 44.1 kHz internal graph sample rate converted to 48.0 kHz native DAC rate by the hardware flowgraph.
- **Buffer & Callback:** Callback burst size configured to 128 frames.
- **Stream Status:** Logcat recorded `StreamAAudio::open() AAUDIO_OK`. The graph started and stopped cleanly without throwing native exceptions.
- **System Buffer Health:** The AAudio subsystem reported zero buffer underruns, zero xruns, and zero dropped frames during test triggers.

### Crucial Qualification on Live Playback
- **Distinction from Acoustic Verification:** Executing playback via ADB UI clicks and observing clean driver logs demonstrates that the software pipeline, JSI bindings, C++ graph manager, and Android AAudio driver operated without system-level fault.
- **Limit of Telemetry:** Logcat status codes and ADB automation cannot measure the analog acoustic output emitted by the physical speaker or headphone jack.
- **No Inferred Hearing:** The telemetry does not prove the absence of audible acoustic distortion, analog clipping, acoustic speaker resonance, or perceptible playback latency. Those characteristics require explicit human listening evaluation.

---

## 7. Pending Human Listening Acceptance Checklist

To complete formal validation of the audible user experience, a human evaluator must audition the physical device (iQOO Neo 6) and complete the following verification checklist:

| # | Inspection Item | Specific Auditory Criteria | Status |
|---|-----------------|----------------------------|--------|
| 1 | **Melody Playback** | Audition descending phrase (E4 $\rightarrow$ D4 $\rightarrow$ C4 $\rightarrow$ B3). Verify clear sinusoidal pitch contour, distinct note separations, and clean termination. | **PENDING** |
| 2 | **Harmony Playback** | Audition sustained C major triad (beats 1–4) transitioning to G major triad at beat 5 (4.0s). Verify balanced chord voicing and instantaneous harmonic change. | **PENDING** |
| 3 | **Combined Playback** | Audition combined melody and harmony. Verify proper musical balance (melody prominent over harmony), musical cohesion on a single clock, and no perceived volume pumping. | **PENDING** |
| 4 | **Rhythmic Rest (Beat 4)** | Audition beat 4 (3.0s–4.0s). Verify that the melodic silence is clearly perceptible while the C major triad continues underneath. | **PENDING** |
| 5 | **Harmonic Resolution (B3 over G)** | Audition beat 5 (4.0s). Verify that the melodic arrival of B3 resolves naturally and convincingly over the G major chord entrance as its major 3rd. | **PENDING** |
| 6 | **Audible Defect Inspection** | Listen for acoustic clicks, pops, zero-crossing thumps at note boundaries, DAC glitches, buffer stutter, or digital harshness. | **PENDING** |

---

## 8. Licensing & Native Dependency Boundaries

1. **FFmpeg Exclusion:** The V3 harness maintained `disableAudioapiFFmpeg=true`. No FFmpeg binaries were compiled or packaged.
2. **Optional Codecs Exclusion:** `disableAudioapiStaticExternalLibs=true` excluded optional static libraries (libopus, libvorbis, libogg, openssl).
3. **Open Licensing Questions:**
   - Commercial licensing is **NOT marked fully cleared**.
   - As observed in V1/V2, `THIRD_PARTY.md` is omitted from the published npm package for `react-native-audio-api` 0.13.6.
   - The application APK bundles `liboboe.so` (Google Oboe, Apache 2.0 license). While Apache 2.0 is generally commercial-friendly, standard attribution and copyright notices must be incorporated into product compliance documentation.
   - Any future production implementation requiring M4A audio playback must resolve whether to use Android platform decoders (`MediaCodec`) or FFmpeg.

---

## 9. Validation Status Summary

| Validation Layer | Scope | Result | Details / Evidence |
|------------------|-------|--------|---------------------|
| Deterministic PCM (Node) | 23 Checks | **PASSED** | Validated mathematical specification |
| Android `OfflineAudioContext` | 23 Checks | **PASSED** | Native device execution (`I2202`, Android 14); no fallback |
| Pitch Accuracy (Zero-Crossing) | E4, D4, C4, B3 | **PASSED** | Within $\pm 0.37\text{ Hz}$ (quantization limit $\approx 0.56\text{ Hz}$) |
| Timing & Silence | Onsets, Rest | **PASSED** | Onset jitter $\le 0.2\text{ms}$; rest peak `0.00e+0` |
| Codec Isolation | Native APK | **PASSED** | Zero FFmpeg / external codec libraries in APK |
| Audio HAL Telemetry | AAudio / Oboe | **VERIFIED** | Clean initialization (`AAUDIO_OK`), zero driver xruns |
| **Acoustic Listening Audition** | Physical Ear | **PENDING** | Requires human verification per Section 7 checklist |
| **Commercial Licensing** | Legal / IP | **OPEN** | Requires comprehensive dependency audit (Oboe, etc.) |

---

## 10. Retained Evidence File Index

All evidence files are preserved in `experiments/audio-v3/evidence/`:

- `VALIDATION_REPORT.md`: This comprehensive validation report.
- `v3-audition-results.json`: Complete 23-check numerical measurement report extracted directly from device cache (`com.validation.v3audition`).
- `device.txt`: Sanitized ADB target device specifications.
- `gradle-flags.txt`: Extracted `android/gradle.properties` verification.
- `installed-pin.json`: Package version pin and default-flag analysis for `react-native-audio-api` 0.13.6.
- `native-libraries.txt`: Inventory of packaged `.so` binaries in `app-debug.apk`.
- `generated/npm-ls.txt`: Dependency tree verification.
- `generated/installed-pin.json`: Automated pre-build package inspection record.
- `generated/v3-audition-results.json`: Mirror of device measurement JSON.
