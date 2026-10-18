#!/bin/bash
# Records the installed package pin and license files. Run after npm install.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/evidence/generated"
PKG="$ROOT/node_modules/react-native-audio-api"
mkdir -p "$OUT"
cd "$ROOT"

if [[ ! -d "$PKG" ]]; then
  echo "node_modules/react-native-audio-api is missing. Run npm install."
  exit 1
fi

node --input-type=module -e '
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const pkg = JSON.parse(readFileSync("node_modules/react-native-audio-api/package.json", "utf8"));
const plugin = readFileSync("node_modules/react-native-audio-api/src/plugin/withAudioAPI.ts", "utf8");
const header = readFileSync("node_modules/react-native-audio-api/common/cpp/audioapi/core/utils/AudioDecoding.h", "utf8");
const report = {
  name: pkg.name,
  version: pkg.version,
  licenseField: pkg.license,
  disableFFmpegDefaultFalse: plugin.includes("disableFFmpeg: false"),
  disableStaticExternalLibsDefaultFalse: plugin.includes("disableStaticExternalLibs: false"),
  m4aRoutedToFfmpegInHeader: header.includes("AudioFormat::M4A"),
};
console.log(JSON.stringify(report, null, 2));
' | tee "$OUT/installed-pin.json"

npm ls react-native-audio-api expo react-native --depth=0 > "$OUT/npm-ls.txt" || true

if [[ -f "$PKG/THIRD_PARTY.md" ]]; then
  cp "$PKG/THIRD_PARTY.md" "$OUT/THIRD_PARTY.md"
else
  echo "THIRD_PARTY.md is not in the published 0.13.6 tarball." | tee "$OUT/THIRD_PARTY.md"
fi

if [[ -f "$PKG/LICENSE" ]]; then
  cp "$PKG/LICENSE" "$OUT/audio-api-LICENSE.txt"
fi

echo "Wrote $OUT/installed-pin.json"
