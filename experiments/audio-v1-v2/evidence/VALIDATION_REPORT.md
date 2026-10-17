# FretWays | V1 & V2 Android Validation Report

**Experiment:** V1 / V2 Audio Decode Harness (`react-native-audio-api` 0.13.6)  
**Location:** `experiments/audio-v1-v2`  
**Git Branch:** `experiment/audio-v1-v2`  
**Date:** 2026-10-17  
**Device:** iQOO Neo 6 (`I2202`, Android 14, API Level 34, `arm64-v8a`)

---

## 1. Executive Summary

- **V1 Validation (Android Audio Decoding without FFmpeg):** **PASSED** on the attached iQOO Neo 6 device. Both WAV and MP3 audio files decoded successfully in both file-path and in-memory buffer routes without runtime FFmpeg dependency (`ffmpegEnabled: false`).
- **V2 Validation (Dependency Isolation & Static Library Exclusion):** **PASSED** on the attached device build. No FFmpeg, Opus, Ogg, Vorbis, or OpenSSL shared libraries were packaged in the APK, and Android NDK `llvm-nm` symbol analysis confirmed no defined symbols for those libraries in `libreact-native-audio-api.so`.
- **M4A Status:** **UNSUPPORTED** under the tested FFmpeg-disabled configuration. In `react-native-audio-api` 0.13.6, M4A decoding on Android is routed directly through FFmpeg; without FFmpeg, decoding requests fail with an explicit error.
- **Licensing Status:** **UNCERTAINTIES REMAIN**. Commercial licensing is **NOT** marked cleared. While optional codec libraries were not packaged or linked, `THIRD_PARTY.md` is absent from the published 0.13.6 npm tarball, and any future requirement to decode M4A would necessitate FFmpeg (LGPL/GPL licensing and patent considerations).

---

## 2. Environment & Device Specifications

### Host Environment
- **Host OS:** macOS Darwin 25.5.0 (Apple Silicon arm64)
- **Node.js:** `22.23.3` (activated via NVM)
- **Java / JDK:** OpenJDK `17.0.20` (`/opt/homebrew/opt/openjdk@17`)
- **Android SDK:** Command-line Tools (`/opt/homebrew/share/android-commandlinetools`)
- **Build Tools:** `37.0.0`
- **Platform:** `android-37.0`
- **Android NDK:** `27.1.12297006` (`/opt/homebrew/share/android-commandlinetools/ndk/27.1.12297006`)
- **ADB:** `1.0.41` (Version 37.0.1-15733141)

### Target Device
- **Device Model:** iQOO Neo 6 (`I2202`, `I2202i`)
- **Android OS Version:** 14 (API Level 34)
- **Primary ABI:** `arm64-v8a`
- **Connection:** USB (Debugging Authorized, Transport ID: 16)

---

## 3. Configuration & Decoder Flags

The harness requires `disableFFmpeg` and `disableStaticExternalLibs` to be enforced. On version 0.13.6, these default to `false`. Prebuild wrote these properties to `android/gradle.properties`:

```properties
disableAudioapiStaticExternalLibs=true
disableAudioapiFFmpeg=true
```

Verified prior to compilation via `scripts/assert-flags.sh`:
- `disableAudioapiStaticExternalLibs=true` present: **PASS**
- `disableAudioapiFFmpeg=true` present: **PASS**

---

## 4. Build & Installation Results

1. **Prebuild:** Generated Android project via `npx expo prebuild --platform android --no-install`.
2. **Build Execution:** Executed `npm run android` (`expo run:android --device`).
3. **Target Device Selection:** Automatically resolved and targeted `🔌 I2202 (device)`.
4. **Gradle Compilation:** Completed cleanly (`BUILD SUCCESSFUL in 3m 59s`, 339 actionable tasks).
5. **Output APK:** `android/app/build/outputs/apk/debug/app-debug.apk`.
6. **Device Installation & Launch:** APK installed onto iQOO Neo 6 via ADB; MainActivity (`com.validation.v1audiodecode/.MainActivity`) launched and connected to Metro bundler.

---

## 5. Actual Device Decoding Results

The decode test was triggered directly on the iQOO Neo 6 device using the committed 1-second 440 Hz sine tone fixtures (`amplitude: 0.5`, `sampleRate: 44100`, `channels: 1`).

- **Runtime FFmpeg Check:** `isFfmpegEnabled() -> false` (flags successfully took effect).

### Detailed Decoding Table

| Format | Route | Result | Duration | Sample Rate | Channels | Frames | Peak | RMS | Est. Hz | Error / Message |
|---|---|---|---|---|---|---|---|---|---|---|
| **WAV** | File path | **PASS** | 1.0000 s | 44100 Hz | 1 | 44100 | 0.5000 | 0.3535 | 440 Hz | None |
| **WAV** | In-memory | **PASS** | 1.0000 s | 44100 Hz | 1 | 44100 | 0.5000 | 0.3535 | 440 Hz | None |
| **MP3** | File path | **PASS** | 1.0710 s | 44100 Hz | 1 | 47232 | 0.5098 | 0.3417 | 444 Hz | None |
| **MP3** | In-memory | **PASS** | 1.0710 s | 44100 Hz | 1 | 47232 | 0.5098 | 0.3417 | 444 Hz | None |
| **M4A** | File path | **FAIL (Expected)** | - | - | - | - | - | - | - | `FFmpeg is disabled, cannot decode with file path` |
| **M4A** | In-memory | **FAIL (Expected)** | - | - | - | - | - | - | - | `FFmpeg is disabled, cannot decode memory block` |

### Key Observations:
- **WAV:** Decoded with exact mathematical fidelity (duration: 1.0s, 44100 frames, 440 Hz crossing estimate, 0.5 peak).
- **MP3:** Decoded via platform decoder with expected padding frames (1.071s, 444 Hz crossing estimate, 0.5098 peak), within fixture comparison tolerances.
- **M4A:** Confirmed completely unsupported when FFmpeg is disabled.

---

## 6. Native Dependency & Binary Inspection Findings

Inspection was conducted via `scripts/inspect-android.sh` using Android NDK LLVM tools (`llvm-readelf`, `llvm-nm`):

### Packaged Shared Libraries (`lib/arm64-v8a/*.so`)
The debug APK contains exactly 20 shared libraries:
- `libandroidx.graphics.path.so` (10,096 bytes)
- `libappmodules.so` (238,600 bytes)
- `libbarhopper_v3.so` (4,946,720 bytes)
- `libc++_shared.so` (1,292,904 bytes)
- `libexpo-modules-core.so` (1,845,560 bytes)
- `libexpo-modules-jsi.so` (94,432 bytes)
- `libexpo-modules-v2.so` (1,318,144 bytes)
- `libfbjni.so` (177,000 bytes)
- `libgifimage.so` (319,088 bytes)
- `libhermestooling.so` (566,576 bytes)
- `libhermesvm.so` (4,019,784 bytes)
- `libimagepipeline.so` (8,760 bytes)
- `libjsi.so` (941,304 bytes)
- `libnative-filters.so` (277,744 bytes)
- `libnative-imagetranscoder.so` (585,376 bytes)
- `liboboe.so` (296,080 bytes)
- `libreact-native-audio-api.so` (6,253,552 bytes)
- `libreactnative.so` (24,063,504 bytes)
- `libstatic-webp.so` (502,112 bytes)
- `libzstd-kmp.so` (731,872 bytes)

### Binary Analysis Conclusions:
1. **Shared Library List:** **CONCLUSIVE**. No shared library matching FFmpeg (`avcodec`, `avformat`, `avutil`, `swresample`), Opus, Ogg, Vorbis, or OpenSSL (`libssl`, `libcrypto`) was packaged.
2. **Static-Link Check:** **CONCLUSIVE**. `llvm-nm --defined-only` on `libreact-native-audio-api.so` returned zero matches for `avcodec_`, `avformat_`, `avutil_`, `swr_`, `opus_`, `ogg_`, `vorbis_`, `SSL_`, `EVP_`, or `FFmpeg`.
3. **Downloaded Prebuilts:** `downloaded-prebuilts.txt` confirmed that `jniLibs` and external prebuilt directories under `react-native-audio-api` remained empty throughout the build.

---

## 7. Licensing Uncertainties & Remaining Risks

1. **Absence of Proof is Not License Clearance:** While ELF scanning confirms that optional external symbols were not defined in `libreact-native-audio-api.so`, binary inspection alone does not substitute for upstream legal licensing verification.
2. **Missing Package License Notices:** `THIRD_PARTY.md` is absent from the published npm package tarball of `react-native-audio-api` 0.13.6, and no individual license texts for third-party audio dependencies are packaged.
3. **M4A Codec Limitation & Future Risk:** M4A support is currently impossible without FFmpeg in this library version. If product requirements mandate M4A playback or decoding in future milestones, enabling FFmpeg will introduce substantial LGPL/GPL compliance requirements and patent licensing considerations.
4. **Commercial Clearance Boundary:** Commercial licensing for FretWays **cannot be declared fully cleared** until an official legal audit of all bundled dependencies is performed.

---

## 8. V1 / V2 Acceptance Conclusions

| Item | Requirement | Measured Result | Verdict |
|---|---|---|---|
| **V1.1** | WAV decode without FFmpeg | File & memory routes decode accurately at 44.1 kHz | **PASS** |
| **V1.2** | MP3 decode without FFmpeg | File & memory routes decode accurately at 44.1 kHz | **PASS** |
| **V1.3** | M4A decode without FFmpeg | Fails gracefully with explicit disable error | **UNSUPPORTED** (Documented) |
| **V1.4** | `isFfmpegEnabled()` returns false | Verified false on physical device runtime | **PASS** |
| **V2.1** | No FFmpeg / OpenSSL shared libraries in APK | Verified via APK extraction and listing | **PASS** |
| **V2.2** | No FFmpeg / OpenSSL defined static symbols | Verified via NDK `llvm-nm` inspection | **PASS** |
| **V2.3** | Commercial licensing status | Licensing notices missing; future M4A risk noted | **RESERVED** (Uncertainties Documented) |

---

## 9. Retained Evidence Paths

- **Sanitized Committed Evidence:**
  - `experiments/audio-v1-v2/evidence/VALIDATION_REPORT.md`: This comprehensive report.
  - `experiments/audio-v1-v2/evidence/v1-v2-results.json`: Formatted device decode output.
  - `experiments/audio-v1-v2/evidence/device.txt`: Device specs (sanitized serial).
  - `experiments/audio-v1-v2/evidence/inspection-verdict.txt`: Tool verdict summary.
  - `experiments/audio-v1-v2/evidence/native-libraries.txt`: Full packaged `.so` listing.
  - `experiments/audio-v1-v2/evidence/elf-inspection.txt`: NDK `llvm-readelf` and `llvm-nm` output.
  - `experiments/audio-v1-v2/evidence/gradle-flags.txt`: Active flags in `gradle.properties`.
  - `experiments/audio-v1-v2/evidence/installed-pin.json`: Package version metadata.
  - `experiments/audio-v1-v2/evidence/library-name-scan.txt`: Specific library name search results.
  - `experiments/audio-v1-v2/evidence/license-files.txt`: Scan for bundled license texts.
  - `experiments/audio-v1-v2/evidence/downloaded-prebuilts.txt`: Scan for build-time downloaded prebuilts.
  - `experiments/audio-v1-v2/evidence/apk-listing.txt`: Complete APK zip entry listing.
  - `experiments/audio-v1-v2/evidence/apk-path.txt`: Output debug APK path.

- **Local Raw Evidence:**
  - Preserved unmodified on the local build machine under `experiments/audio-v1-v2/evidence/generated/` (gitignored).
