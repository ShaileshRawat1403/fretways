import { Asset } from "expo-asset";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { decodeAudioData, isFfmpegEnabled } from "react-native-audio-api";

import expected from "./assets/fixtures/EXPECTED.json";

const FIXTURES = {
  wav: require("./assets/fixtures/tone.wav"),
  mp3: require("./assets/fixtures/tone.mp3"),
  m4a: require("./assets/fixtures/tone.m4a"),
} as const;

type FormatName = keyof typeof FIXTURES;
type RouteName = "file" | "memory";

type Row = {
  format: FormatName;
  route: RouteName;
  ok: boolean;
  error?: string;
  duration?: number;
  sampleRate?: number;
  channels?: number;
  frames?: number;
  peak?: number;
  rms?: number;
  estimatedHz?: number | null;
  fileBytes?: number;
};

function estimateHz(samples: Float32Array, sampleRate: number): number | null {
  const count = Math.min(samples.length, sampleRate);
  if (count < 200) return null;
  let crossings = 0;
  for (let i = 1; i < count; i += 1) {
    const previous = samples[i - 1] ?? 0;
    const current = samples[i] ?? 0;
    if ((previous <= 0 && current > 0) || (previous >= 0 && current < 0)) {
      crossings += 1;
    }
  }
  return crossings / 2 / (count / sampleRate);
}

function measure(samples: Float32Array): { peak: number; rms: number } {
  const count = samples.length;
  if (count === 0) return { peak: 0, rms: 0 };
  let peak = 0;
  let sum = 0;
  for (let i = 0; i < count; i += 1) {
    const value = samples[i] ?? 0;
    const absolute = Math.abs(value);
    if (absolute > peak) peak = absolute;
    sum += value * value;
  }
  return { peak, rms: Math.sqrt(sum / count) };
}

function decodeBase64(value: string): ArrayBuffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = value.replace(/[^A-Za-z0-9+/]/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const a = alphabet.indexOf(clean[i] ?? "A");
    const b = alphabet.indexOf(clean[i + 1] ?? "A");
    const cChar = clean[i + 2] ?? "=";
    const dChar = clean[i + 3] ?? "=";
    const c = cChar === "=" ? 0 : alphabet.indexOf(cChar);
    const d = dChar === "=" ? 0 : alphabet.indexOf(dChar);
    bytes.push((a << 2) | (b >> 4));
    if (cChar !== "=") bytes.push(((b & 15) << 4) | (c >> 2));
    if (dChar !== "=") bytes.push(((c & 3) << 6) | d);
  }
  return Uint8Array.from(bytes).buffer;
}

async function materialize(format: FormatName): Promise<{ path: string; bytes: number }> {
  const asset = Asset.fromModule(FIXTURES[format]);
  await asset.downloadAsync();
  if (!asset.localUri) {
    throw new Error(`No local file for ${format}`);
  }
  const destination = `${FileSystem.cacheDirectory}v1-tone.${format}`;
  await FileSystem.copyAsync({ from: asset.localUri, to: destination });
  const info = await FileSystem.getInfoAsync(destination);
  if (!info.exists) {
    throw new Error(`Copy failed for ${format}`);
  }
  return { path: destination, bytes: info.size ?? 0 };
}

async function measureDecode(format: FormatName, route: RouteName, path: string, fileBytes: number): Promise<Row> {
  try {
    const input =
      route === "file"
        ? path
        : decodeBase64(await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.Base64 }));
    const buffer = await decodeAudioData(input, 0);
    const channel = buffer.getChannelData(0);
    const levels = measure(channel);
    return {
      format,
      route,
      ok: true,
      duration: buffer.duration,
      sampleRate: buffer.sampleRate,
      channels: buffer.numberOfChannels,
      frames: buffer.length,
      peak: Number(levels.peak.toFixed(4)),
      rms: Number(levels.rms.toFixed(4)),
      estimatedHz: estimateHz(channel, buffer.sampleRate),
      fileBytes,
    };
  } catch (error) {
    return {
      format,
      route,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      fileBytes,
    };
  }
}

export default function App() {
  const [ffmpeg, setFfmpeg] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState("Not run. This screen is not a validation pass.");

  async function runAll() {
    setStatus("Running");
    setRows([]);
    let ffmpegEnabled: boolean | null = null;
    try {
      ffmpegEnabled = isFfmpegEnabled();
    } catch (error) {
      ffmpegEnabled = null;
      setStatus(error instanceof Error ? error.message : String(error));
    }
    setFfmpeg(ffmpegEnabled);

    const next: Row[] = [];
    for (const format of ["wav", "mp3", "m4a"] as const) {
      try {
        const file = await materialize(format);
        next.push(await measureDecode(format, "file", file.path, file.bytes));
        next.push(await measureDecode(format, "memory", file.path, file.bytes));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        next.push({ format, route: "file", ok: false, error: message });
        next.push({ format, route: "memory", ok: false, error: message });
      }
      setRows([...next]);
    }

    const report = {
      label: "V1_RESULT",
      note: "Device measurement only. Not a closed validation.",
      ffmpegEnabled,
      device: {
        os: Platform.OS,
        version: String(Platform.Version),
        name: Constants.deviceName ?? null,
      },
      fixtureIntent: expected,
      rows: next,
    };
    const json = JSON.stringify(report);
    console.log(`V1_RESULT ${json}`);
    const reportPath = `${FileSystem.cacheDirectory}v1-v2-results.json`;
    await FileSystem.writeAsStringAsync(reportPath, json);
    setStatus(`Wrote ${reportPath}`);
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>V1 / V2 decode harness</Text>
      <Text style={styles.body}>
        Disposable experiment. Not the Musical Possibility Engine. FFmpeg and the
        Opus, Ogg, and Vorbis libraries are configured off. A result here is a
        measurement, not a pass.
      </Text>
      <Text style={styles.meta}>FFmpeg linked at runtime: {ffmpeg === null ? "unknown until run" : String(ffmpeg)}</Text>
      <Text style={styles.meta}>
        {Platform.OS} {String(Platform.Version)} {Constants.deviceName ?? ""}
      </Text>
      <Pressable style={styles.button} onPress={() => void runAll()}>
        <Text style={styles.buttonText}>Run WAV, MP3, and M4A</Text>
      </Pressable>
      <Text style={styles.meta}>{status}</Text>
      {rows.map((row) => (
        <View key={`${row.format}-${row.route}`} style={styles.card}>
          <Text style={styles.cardTitle}>
            {row.format} / {row.route} / {row.ok ? "decoded" : "error"}
          </Text>
          <Text style={styles.mono}>{JSON.stringify(row, null, 2)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 64, gap: 12 },
  title: { fontSize: 22, fontWeight: "600" },
  body: { fontSize: 16, lineHeight: 22 },
  meta: { fontSize: 14 },
  button: { backgroundColor: "#1d4e3a", padding: 14, borderRadius: 8 },
  buttonText: { color: "#f4f1ea", fontSize: 16, textAlign: "center" },
  card: { borderWidth: 1, borderColor: "#cfc6b8", padding: 10, borderRadius: 8 },
  cardTitle: { fontSize: 16, marginBottom: 6 },
  mono: { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 12 },
});
