# Evidence

This directory contains the finalized, sanitized validation evidence and report for the V1/V2 audio decode experiment (`react-native-audio-api` 0.13.6) performed on the attached iQOO Neo 6 Android phone.

## Key Documents & Artifacts

- **[VALIDATION_REPORT.md](VALIDATION_REPORT.md)**: The comprehensive validation report detailing the build process, device environment, actual WAV/MP3/M4A decode measurements, native symbol inspection, licensing evaluation, and acceptance findings.
- **`v1-v2-results.json`**: The actual JSON output recorded from the physical device test run (`label: "V1_RESULT"`).
- **`inspection-verdict.txt`**: Conclusiveness verdicts for the shared library list, static symbol checks, and package license files.
- **`native-libraries.txt`**: Complete listing and byte count of every packaged `.so` in the assembled APK (`lib/arm64-v8a/`).
- **`elf-inspection.txt`**: Detailed Android NDK `llvm-readelf` and `llvm-nm` symbol inspection outputs.
- **`device.txt`**: Properties of the target device (`I2202`, Android 14, SDK 34) with sensitive serial numbers redacted.
- **`gradle-flags.txt`**: Prebuild flags confirming FFmpeg and static external libraries were disabled.
- **`installed-pin.json`**: Pinned package metadata for `react-native-audio-api` 0.13.6.
- **`apk-listing.txt`** & **`apk-path.txt`**: Verification of the assembled debug APK.
- **`library-name-scan.txt`**, **`license-files.txt`**, **`downloaded-prebuilts.txt`**: Corroborating scans confirming absence of third-party decoders and downloaded prebuilts.

## Raw Local Artifacts

Complete unedited local build artifacts and machine logs are preserved on disk under `generated/` (which is gitignored to avoid leaking host-specific paths or hardware serials).
