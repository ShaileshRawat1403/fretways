# Evidence: Increment 2 Audio Validation

This directory contains the sanitized validation evidence and artifacts for FretWays Phase 1 Increment 2 on Android (`react-native-audio-api` 0.13.6).

## Evidence Inventory

- `VALIDATION_REPORT.md`: Comprehensive validation report detailing build outcomes, TypeScript blocker resolution, device voice scheduling results, timing analysis, and pending human listening checklist.
- `increment-2-results.jsonl`: Raw sanitized `INCREMENT2_RESULT` payloads emitted by the iQOO Neo 6 across all 25 test triggers.
- `device.txt`: Sanitized ADB target device specifications (iQOO Neo 6 / I2202, Android 14, API Level 34, `arm64-v8a`).
- `gradle-flags.txt`: Extracted build properties enforcing decoder disable flags (`disableAudioapiStaticExternalLibs=true`, `disableAudioapiFFmpeg=true`).
- `installed-pin.json`: Package version pin analysis for `react-native-audio-api` 0.13.6.
- `native-libraries.txt`: Inventory of packaged native `.so` binaries in `app-debug.apk` confirming the absence of FFmpeg and optional external codecs.
