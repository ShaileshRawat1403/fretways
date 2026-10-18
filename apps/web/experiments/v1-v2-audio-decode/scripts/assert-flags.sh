#!/bin/bash
# Confirms the prebuild wrote the V1/V2 disable flags. Does not build or install.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROPS="$ROOT/android/gradle.properties"
fail=0

if [[ ! -f "$PROPS" ]]; then
  echo "Missing $PROPS. Run npm run prebuild:android first."
  exit 1
fi

echo "gradle.properties flags:"
grep -n "disableAudioapi" "$PROPS" || true

if ! grep -q "^disableAudioapiFFmpeg=true$" "$PROPS"; then
  echo "FAIL: disableAudioapiFFmpeg=true is not set. Do not install this build."
  fail=1
fi

if ! grep -q "^disableAudioapiStaticExternalLibs=true$" "$PROPS"; then
  echo "FAIL: disableAudioapiStaticExternalLibs=true is not set. Do not install this build."
  fail=1
fi

if [[ "$fail" -ne 0 ]]; then
  exit 1
fi

echo "PASS: both disable flags are present. This is not a device decode result."
