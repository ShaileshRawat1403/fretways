# Evidence: Increment 2 Audio Validation

This directory contains the sanitized validation evidence and artifacts for FretWays Phase 1 Increment 2 on Android (`react-native-audio-api` 0.13.6).

## Evidence Inventory

- `VALIDATION_REPORT.md`: Comprehensive validation report detailing build outcomes, static verification, device voice scheduling results, before/after scheduling spread comparisons, deadline margin qualification, and product owner human listening acceptance.
- `increment-2-results-post-fix.jsonl`: Raw sanitized `INCREMENT2_RESULT` payloads emitted by the iQOO Neo 6 on post-fix commit `48c2a78` demonstrating exact 0.000000 s scheduling spread across simultaneous voices.
- `increment-2-results-before-fix.jsonl`: Baseline `INCREMENT2_RESULT` payloads from initial validation commit `3011908` preserved for historical comparison.
- `increment-2-results.jsonl`: Mirror of post-fix device results.
- `device.txt`: Sanitized ADB target device specifications (iQOO Neo 6 / I2202, Android 14, API Level 34, `arm64-v8a`).
- `gradle-flags.txt`: Extracted build properties enforcing decoder disable flags (`disableAudioapiStaticExternalLibs=true`, `disableAudioapiFFmpeg=true`).
- `installed-pin.json`: Package version pin analysis for `react-native-audio-api` 0.13.6.
- `native-libraries.txt`: Inventory of packaged native `.so` binaries in `app-debug.apk` confirming the absence of FFmpeg and optional external codecs.
