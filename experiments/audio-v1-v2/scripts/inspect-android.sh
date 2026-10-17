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

TMP="$(mktemp -d)"
unzip -q -o "$APK" "lib/*.so" -d "$TMP" || true

{
  echo "Every packaged native library in $APK"
  echo "A shared library that is absent from this list is not packaged."
  echo "Absence here does not prove that a static library was left out."
  echo
  find "$TMP" -name '*.so' -type f | sort | while read -r so; do
    rel="${so#"$TMP"/}"
    bytes="$(wc -c < "$so" | tr -d ' ')"
    printf "%8s  %s\n" "$bytes" "$rel"
  done
} | tee "$OUT/native-libraries.txt"

cp "$OUT/native-libraries.txt" "$OUT/native-so.txt"

INTEREST='avcodec|avformat|avutil|swresample|opus|ogg|vorbis|libssl|libcrypto|react-native-audio-api'
{
  echo "Packaged names related to FFmpeg, Opus, Ogg, Vorbis, OpenSSL, or react-native-audio-api:"
  if grep -Ei "$INTEREST" "$OUT/native-libraries.txt"; then
    :
  else
    echo "(none of those names are packaged as their own .so)"
  fi
} | tee "$OUT/library-name-scan.txt"

find_ndk_bin() {
  local roots=()
  local root prebuilt
  [[ -n "${ANDROID_NDK_HOME:-}" ]] && roots+=("$ANDROID_NDK_HOME")
  [[ -n "${ANDROID_NDK_ROOT:-}" ]] && roots+=("$ANDROID_NDK_ROOT")
  [[ -n "${ANDROID_HOME:-}" && -d "$ANDROID_HOME/ndk" ]] && roots+=("$ANDROID_HOME/ndk"/*)
  [[ -d "$HOME/Library/Android/sdk/ndk" ]] && roots+=("$HOME/Library/Android/sdk/ndk"/*)
  for root in "${roots[@]}"; do
    [[ -d "$root" ]] || continue
    for prebuilt in "$root"/toolchains/llvm/prebuilt/*/bin; do
      if [[ -x "$prebuilt/llvm-readelf" && -x "$prebuilt/llvm-nm" ]]; then
        echo "$prebuilt"
        return 0
      fi
    done
  done
  return 1
}

NDK_BIN=""
if NDK_BIN="$(find_ndk_bin)"; then
  echo "NDK LLVM bin: $NDK_BIN" | tee "$OUT/ndk-tools.txt"
else
  echo "Android NDK llvm-readelf and llvm-nm were not found." | tee "$OUT/ndk-tools.txt"
  echo "Checked ANDROID_NDK_HOME, ANDROID_NDK_ROOT, ANDROID_HOME/ndk, and ~/Library/Android/sdk/ndk."
fi

ELF="$OUT/elf-inspection.txt"
: > "$ELF"
STATIC_STATUS="INCONCLUSIVE"
STATIC_REASON="The Android NDK tools were not found, so no ELF symbol table was read."
LICENSE_STATUS="INCONCLUSIVE"
LICENSE_REASON="License files for optional native libraries were not matched to an actual linked binary."

if [[ -n "$NDK_BIN" ]]; then
  READELF="$NDK_BIN/llvm-readelf"
  NM="$NDK_BIN/llvm-nm"
  ALL_SO=()
  while IFS= read -r so; do
    [[ -n "$so" ]] && ALL_SO+=("$so")
  done < <(find "$TMP" -name '*.so' -type f | sort)
  {
    echo "Tool: $READELF"
    echo "Tool: $NM"
    echo "Host nm and host strings are not used. They do not reliably read Android ELF files."
    echo
    echo "NEEDED entries for every packaged .so"
    echo
  } >> "$ELF"

  if [[ ${#ALL_SO[@]} -eq 0 ]]; then
    echo "No .so files were extracted from the APK." >> "$ELF"
  fi
  for so in "${ALL_SO[@]+"${ALL_SO[@]}"}"; do
    {
      echo "==== ${so#"$TMP"/} ===="
      "$READELF" -h "$so" | grep -E 'Class:|Machine:|Type:' || true
      echo "-- NEEDED --"
      "$READELF" -d "$so" | grep NEEDED || echo "(no NEEDED entries)"
      echo
    } >> "$ELF"
  done

  AUDIO_SO="$(find "$TMP" -name '*react-native-audio-api*.so' -type f | head -n 1 || true)"
  DEFINED_HITS=""
  if [[ -n "$AUDIO_SO" ]]; then
    {
      echo "==== symbol scan ${AUDIO_SO#"$TMP"/} ===="
      echo "Defined symbols matching FFmpeg, Opus, Vorbis, Ogg, or OpenSSL."
      echo "A 'U' symbol is an external reference, not proof of static inclusion."
      echo
      "$NM" --defined-only "$AUDIO_SO" | grep -Ei 'avcodec_|avformat_|avutil_|swr_|opus_|ogg_|vorbis_|SSL_|EVP_|FFmpeg' || echo "(no defined symbols matched)"
      echo
      echo "Undefined references with the same names, if any:"
      "$NM" --undefined-only "$AUDIO_SO" | grep -Ei 'avcodec_|avformat_|avutil_|swr_|opus_|ogg_|vorbis_|SSL_|EVP_' || echo "(no undefined symbols matched)"
      echo
    } >> "$ELF"
    DEFINED_HITS="$("$NM" --defined-only "$AUDIO_SO" | grep -Ei 'avcodec_|avformat_|avutil_|swr_|opus_|ogg_|vorbis_|SSL_|EVP_|FFmpeg' || true)"
  else
    echo "libreact-native-audio-api.so was not in the APK. Static-link symbols cannot be read." >> "$ELF"
  fi

  PACKAGED_INTEREST="$(find "$TMP" -name '*.so' -type f | grep -Ei 'avcodec|avformat|avutil|swresample|opus|ogg|vorbis|libssl|libcrypto' || true)"
  if [[ -n "$DEFINED_HITS" || -n "$PACKAGED_INTEREST" ]]; then
    STATIC_STATUS="CONCLUSIVE"
    STATIC_REASON="Either a relevant shared library is packaged, or llvm-nm found defined symbols inside libreact-native-audio-api.so. See elf-inspection.txt."
  elif [[ -n "$AUDIO_SO" ]]; then
    STATIC_STATUS="CONCLUSIVE"
    STATIC_REASON="llvm-nm found no defined FFmpeg, Opus, Ogg, Vorbis, or OpenSSL symbols in libreact-native-audio-api.so, and those libraries are not packaged as their own .so files."
  else
    STATIC_STATUS="INCONCLUSIVE"
    STATIC_REASON="libreact-native-audio-api.so was not extracted, so the static-link check could not be made."
  fi
fi

PREBUILT="$ROOT/node_modules/react-native-audio-api"
{
  echo "Prebuilt files downloaded into the installed package."
  echo "These directories are empty in the npm tarball and are filled at build time."
  found=0
  while IFS= read -r path; do
    echo "$path"
    found=1
  done < <(find "$PREBUILT/android/src/main/jniLibs" "$PREBUILT/common/cpp/audioapi/external/android" -type f 2>/dev/null | head -n 200 || true)
  if [[ "$found" -eq 0 ]]; then
    echo "(those directories are absent or empty)"
  fi
} | tee "$OUT/downloaded-prebuilts.txt"

LICENSE_HITS="$(find "$PREBUILT" -type f \( -iname 'LICENSE*' -o -iname 'COPYING*' -o -iname 'lgpl*' \) 2>/dev/null | grep -Ei 'ffmpeg|openssl|opus|vorbis|ogg|lgpl' || true)"
{
  echo "License files whose names match the optional native libraries:"
  if [[ -n "$LICENSE_HITS" ]]; then
    echo "$LICENSE_HITS"
  else
    echo "(none found under node_modules/react-native-audio-api)"
  fi
} | tee "$OUT/license-files.txt"

if [[ "$STATIC_STATUS" == "CONCLUSIVE" && -n "$LICENSE_HITS" ]]; then
  LICENSE_STATUS="CONCLUSIVE"
  LICENSE_REASON="The ELF result and at least one matching license file are both recorded. Read them together. Do not treat a missing name as a license grant."
elif [[ "$STATIC_STATUS" == "CONCLUSIVE" && -z "$LICENSE_HITS" ]]; then
  LICENSE_STATUS="INCONCLUSIVE"
  LICENSE_REASON="The binary scan completed, but no FFmpeg, OpenSSL, Opus, Ogg, or Vorbis license text was found in the installed package. Presence or absence of a .so is not itself the license text."
else
  LICENSE_STATUS="INCONCLUSIVE"
  LICENSE_REASON="The static-link scan did not complete, so a license conclusion would be a guess."
fi

{
  echo "shared-library list: CONCLUSIVE"
  echo "reason: native-libraries.txt is the complete set of .so files extracted from the APK."
  echo
  echo "static-link check: $STATIC_STATUS"
  echo "reason: $STATIC_REASON"
  echo
  echo "license-file check: $LICENSE_STATUS"
  echo "reason: $LICENSE_REASON"
  echo
  echo "An INCONCLUSIVE line is not a pass and is not evidence that a library is absent."
  echo "This script does not close V1 or V2."
} | tee "$OUT/inspection-verdict.txt"

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

rm -rf "$TMP"
echo "Wrote $OUT"
echo "Read inspection-verdict.txt before treating any library or license question as answered."
