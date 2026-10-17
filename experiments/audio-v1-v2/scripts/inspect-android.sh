#!/bin/bash
# Collects native-library evidence from the Android build. Run on the Mac after a successful build.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/evidence/generated"
mkdir -p "$OUT"
cd "$ROOT"

{
  echo "date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "host: $(uname -a)"
  echo "pwd: $ROOT"
} | tee "$OUT/host.txt"

if [[ -f android/gradle.properties ]]; then
  grep -n "disableAudioapi\|newArchEnabled\|hermes" android/gradle.properties > "$OUT/gradle-flags.txt" || true
else
  echo "android/gradle.properties missing" | tee "$OUT/gradle-flags.txt"
fi

APK="$(find android/app/build/outputs/apk -name '*.apk' -print 2>/dev/null | sort | tail -n 1 || true)"
if [[ -z "${APK}" ]]; then
  echo "No APK found under android/app/build/outputs/apk" | tee "$OUT/apk-missing.txt"
  echo "Build first with npm run android, then rerun npm run inspect."
  exit 1
fi

echo "$APK" | tee "$OUT/apk-path.txt"
unzip -l "$APK" > "$OUT/apk-listing.txt"
unzip -l "$APK" | grep -E 'lib/.+\.so$' > "$OUT/native-so.txt" || true

{
  echo "Names that should be ABSENT when both disable flags worked:"
  unzip -l "$APK" | grep -Ei 'avcodec|avformat|avutil|swresample|libopus|libogg|libvorbis|libssl|libcrypto' || echo "(none of those names in the APK listing)"
} | tee "$OUT/library-name-scan.txt"

TMP="$(mktemp -d)"
unzip -q -o "$APK" "lib/*react-native-audio-api*.so" -d "$TMP" || true
SO="$(find "$TMP" -name '*react-native-audio-api*.so' -print | head -n 1 || true)"
if [[ -n "${SO}" ]]; then
  echo "Inspecting $SO" | tee "$OUT/strings-scan.txt"
  if command -v strings >/dev/null 2>&1; then
    strings "$SO" | grep -Ei 'FFmpeg|libavcodec|libopus|libvorbis|OpenSSL|libssl' | head -n 80 >> "$OUT/strings-scan.txt" || echo "(no matching strings)" >> "$OUT/strings-scan.txt"
  else
    echo "strings not installed" >> "$OUT/strings-scan.txt"
  fi
  if command -v nm >/dev/null 2>&1; then
    nm -gU "$SO" 2>/dev/null | grep -Ei 'opus_|vorbis_|ogg_|avcodec_|SSL_|EVP_' | head -n 80 > "$OUT/nm-scan.txt" || true
  fi
else
  echo "Could not extract libreact-native-audio-api.so from the APK." | tee "$OUT/strings-scan.txt"
fi
rm -rf "$TMP"

if command -v adb >/dev/null 2>&1; then
  {
    echo "adb devices:"
    adb devices -l || true
    echo "model: $(adb shell getprop ro.product.model 2>/dev/null || true)"
    echo "android: $(adb shell getprop ro.build.version.release 2>/dev/null || true)"
    echo "sdk: $(adb shell getprop ro.build.version.sdk 2>/dev/null || true)"
    echo "abi: $(adb shell getprop ro.product.cpu.abi 2>/dev/null || true)"
  } | tee "$OUT/device.txt"
else
  echo "adb not on PATH" | tee "$OUT/device.txt"
fi

PREBUILT="$ROOT/node_modules/react-native-audio-api"
{
  echo "Prebuilt dirs inside the installed package (downloaded at build time, absent from the npm tarball):"
  find "$PREBUILT/android/src/main/jniLibs" "$PREBUILT/common/cpp/audioapi/external/android" -type f 2>/dev/null | head -n 200 || echo "(those directories are absent or empty)"
} | tee "$OUT/downloaded-prebuilts.txt"

echo "Wrote $OUT"
echo "This script does not decide V1 or V2. Read the files."
