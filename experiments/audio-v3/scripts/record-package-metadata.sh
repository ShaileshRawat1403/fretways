#!/bin/bash
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/evidence/generated"
PKG="$ROOT/node_modules/react-native-audio-api"
mkdir -p "$OUT"
cd "$ROOT"

if [[ ! -d "$PKG" ]]; then
  echo "node_modules/react-native-audio-api is missing. Run npm ci."
  exit 1
fi

node --input-type=module -e '
import { readFileSync } from "node:fs";
const pkg = JSON.parse(readFileSync("node_modules/react-native-audio-api/package.json", "utf8"));
const plugin = readFileSync("node_modules/react-native-audio-api/src/plugin/withAudioAPI.ts", "utf8");
console.log(JSON.stringify({
  name: pkg.name,
  version: pkg.version,
  licenseField: pkg.license,
  disableFFmpegDefaultFalse: plugin.includes("disableFFmpeg: false"),
  disableStaticExternalLibsDefaultFalse: plugin.includes("disableStaticExternalLibs: false"),
}, null, 2));
' | tee "$OUT/installed-pin.json"

npm ls react-native-audio-api expo react-native --depth=0 > "$OUT/npm-ls.txt" || true
echo "Wrote $OUT/installed-pin.json"
