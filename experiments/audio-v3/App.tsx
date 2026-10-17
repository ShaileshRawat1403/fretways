import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import {
  AudioContext,
  OfflineAudioContext,
  isFfmpegEnabled,
} from "react-native-audio-api";

import { SAMPLE_RATE, measureRenders, renderPcm, renderTone, scheduledTones, totalFrames } from "./src/audition.mjs";

type Mode = "melody" | "harmony" | "combined";

type LiveContext = {
  currentTime: number;
  sampleRate: number;
  state?: string;
  createBuffer: (channels: number, length: number, sampleRate: number) => {
    copyToChannel: (source: Float32Array, channel: number) => void;
  };
  createBufferSource: () => {
    buffer: unknown;
    connect: (destination: unknown) => void;
    start: (when: number) => void;
    stop: () => void;
  };
  destination: unknown;
  resume: () => Promise<void>;
};

let liveContext: LiveContext | null = null;
let activeSource: { stop: () => void } | null = null;

async function renderOffline(mode: Mode): Promise<Float32Array> {
  const context = new OfflineAudioContext(1, totalFrames(), SAMPLE_RATE);
  for (const tone of scheduledTones(mode)) {
    const pcm = renderTone(tone);
    const buffer = context.createBuffer(1, pcm.length, SAMPLE_RATE);
    buffer.copyToChannel(pcm, 0);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start(tone.start);
  }
  const rendered = await context.startRendering();
  const output = new Float32Array(rendered.length);
  rendered.copyFromChannel(output, 0, 0);
  return output;
}

async function play(mode: Mode): Promise<string> {
  if (!liveContext) {
    liveContext = new AudioContext({ sampleRate: SAMPLE_RATE }) as LiveContext;
  }
  if (liveContext.state === "suspended") await liveContext.resume();
  if (activeSource) {
    try {
      activeSource.stop();
    } catch {
      // A finished source can reject stop. The same context stays in use.
    }
  }
  const when = liveContext.currentTime + 0.1;
  const sources: { stop: () => void }[] = [];
  for (const tone of scheduledTones(mode)) {
    const pcm = renderTone(tone);
    const buffer = liveContext.createBuffer(1, pcm.length, SAMPLE_RATE);
    buffer.copyToChannel(pcm, 0);
    const source = liveContext.createBufferSource();
    source.buffer = buffer;
    source.connect(liveContext.destination);
    source.start(when + tone.start);
    sources.push(source);
  }
  activeSource = {
    stop() {
      for (const source of sources) source.stop();
    },
  };
  return `scheduled ${sources.length} tones from ${when.toFixed(3)} s on one context, sample rate ${liveContext.sampleRate}`;
}

export default function App() {
  const [status, setStatus] = useState("Not measured. This screen is not a validation pass.");
  const [report, setReport] = useState("");

  async function runMeasurements() {
    setStatus("Measuring");
    const pcm = measureRenders({
      melody: renderPcm("melody"),
      harmony: renderPcm("harmony"),
      combined: renderPcm("combined"),
    });
    let offline: ReturnType<typeof measureRenders> | null = null;
    let offlineError: string | null = null;
    try {
      offline = measureRenders({
        melody: await renderOffline("melody"),
        harmony: await renderOffline("harmony"),
        combined: await renderOffline("combined"),
      });
    } catch (error) {
      offlineError = error instanceof Error ? error.message : String(error);
    }
    let ffmpegEnabled: boolean | null = null;
    try {
      ffmpegEnabled = isFfmpegEnabled();
    } catch (error) {
      ffmpegEnabled = null;
      offlineError = offlineError ?? (error instanceof Error ? error.message : String(error));
    }
    const body = {
      label: "V3_RESULT",
      note: "Device measurement only. Not a closed validation.",
      ffmpegEnabled,
      device: {
        os: Platform.OS,
        version: String(Platform.Version),
        name: Constants.deviceName ?? null,
      },
      measurementSource: offline ? "offline-audio-context" : "deterministic-pcm-fallback",
      deterministicPcm: pcm,
      offline,
      offlineError,
    };
    const json = JSON.stringify(body);
    console.log(`V3_RESULT ${json}`);
    const path = `${FileSystem.cacheDirectory}v3-audition-results.json`;
    await FileSystem.writeAsStringAsync(path, json);
    setReport(JSON.stringify(body, null, 2));
    setStatus(`Wrote ${path}`);
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>V3 musical audition</Text>
      <Text style={styles.body}>
        Isolated experiment. One 4/4 timeline at 60 BPM. C major for four beats, G major at 4.0
        seconds, with B3 arriving on that beat after a one-beat rest. Not the FretWays product.
      </Text>
      <Pressable style={styles.button} onPress={() => void runMeasurements()}>
        <Text style={styles.buttonText}>Run measurements</Text>
      </Pressable>
      {(["melody", "harmony", "combined"] as const).map((mode) => (
        <Pressable key={mode} style={styles.secondary} onPress={() => void play(mode).then(setStatus).catch((error) => setStatus(String(error)))}>
          <Text style={styles.secondaryText}>Play {mode}</Text>
        </Pressable>
      ))}
      <Text style={styles.meta}>{status}</Text>
      <Text style={styles.mono}>{report}</Text>
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
  secondary: { borderWidth: 1, borderColor: "#1d4e3a", padding: 12, borderRadius: 8 },
  secondaryText: { fontSize: 16, textAlign: "center" },
  mono: { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 12 },
});
