# Evidence: V3 Musical Audition

This directory contains the sanitized evidence and validation artifacts for the FretWays V3 Musical Audition experiment on Android (`react-native-audio-api` 0.13.6).

## Evidence Inventory

- `VALIDATION_REPORT.md`: Comprehensive validation report detailing build verification, numerical device measurements, audio driver telemetry, human listening results, and licensing boundary.
- `v3-audition-results.json`: Full 23-check numerical measurement record produced by the physical iQOO Neo 6 device (`com.validation.v3audition`) on Android 14.
- `device.txt`: Sanitized ADB target device specifications (iQOO Neo 6 / I2202, Android 14, API Level 34, `arm64-v8a`).
- `gradle-flags.txt`: Verified Android build properties enforcing decoder disable flags (`disableAudioapiStaticExternalLibs=true`, `disableAudioapiFFmpeg=true`).
- `installed-pin.json`: Package version pin and default flag analysis for `react-native-audio-api` 0.13.6.
- `native-libraries.txt`: Inventory of packaged native `.so` binaries in the Android debug APK confirming the absence of FFmpeg and optional external codecs.
- `generated/`: Raw artifacts generated during the automated build and measurement flow (`npm-ls.txt`, `installed-pin.json`, `v3-audition-results.json`).
