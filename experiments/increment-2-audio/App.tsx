import { useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { isFfmpegEnabled } from "react-native-audio-api";

import { scheduleVoices, stopVoices } from "./src/schedule";
import { planRapidTaps, planVoices, probes, type AuditionMode, type ChordId, type VoicePlan } from "./src/voices";

const chords: ChordId[] = ["c-major", "g-major", "a-minor", "f-major"];
let triggerSerial = 0;

export default function App() {
  const [mode, setMode] = useState<AuditionMode>("solo");
  const [chordId, setChordId] = useState<ChordId>("g-major");
  const [log, setLog] = useState("No voices scheduled. Acoustic latency is not measured here.");

  async function play(plans: VoicePlan[]) {
    const requestedAtMs = performance.now();
    const scheduled = await scheduleVoices(plans, requestedAtMs);
    const body = {
      label: "INCREMENT2_RESULT",
      note: "Schedule measurement only. Not acoustic latency and not a listening pass.",
      ffmpegEnabled: isFfmpegEnabled(),
      policy: "Each trigger is a new voice. Matching MIDI pitches are not merged and do not stop each other.",
      mode,
      chordId,
      voiceCount: scheduled.length,
      voices: scheduled,
    };
    const json = JSON.stringify(body);
    console.log(`INCREMENT2_RESULT ${json}`);
    setLog(JSON.stringify(body, null, 2));
  }

  function trigger(gesture: Parameters<typeof planVoices>[0]["gesture"]) {
    triggerSerial += 1;
    void play(planVoices({ gesture, mode, chordId, idPrefix: `tap-${triggerSerial}` }));
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.title}>Increment 2 audio harness</Text>
      <Text style={styles.body}>
        Test surface only. One audio context. Solo plays the tapped positions. In context also plays the
        synthesized chord. Same MIDI pitch does not collapse two positions.
      </Text>
      <Text style={styles.meta}>Mode: {mode}. Reference chord: {chordId}.</Text>
      <Text style={styles.meta}>Internal timers are not speaker latency.</Text>
      {(["solo", "in-context"] as const).map((item) => (
        <Pressable key={item} style={styles.secondary} onPress={() => setMode(item)}>
          <Text style={styles.secondaryText}>{item}</Text>
        </Pressable>
      ))}
      {chords.map((item) => (
        <Pressable key={item} style={styles.secondary} onPress={() => setChordId(item)}>
          <Text style={styles.secondaryText}>{item}</Text>
        </Pressable>
      ))}
      <Pressable style={styles.button} onPress={() => trigger([probes.openB])}>
        <Text style={styles.buttonText}>Tap open B, B3</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={() => trigger([probes.gStringB])}>
        <Text style={styles.buttonText}>Tap G string fret 4, B3</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={() => trigger([probes.openB, probes.gStringB])}>
        <Text style={styles.buttonText}>Both B3 positions together</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={() => trigger([probes.highG])}>
        <Text style={styles.buttonText}>Tap high e fret 3, G4</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={() => trigger(probes.threeNote)}>
        <Text style={styles.buttonText}>Three-note G</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={() => trigger(probes.sixNote)}>
        <Text style={styles.buttonText}>Six-note probe</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={() => void play(planRapidTaps(probes.openB, 8, 0.08))}>
        <Text style={styles.buttonText}>Eight rapid B3 taps</Text>
      </Pressable>
      <Pressable style={styles.secondary} onPress={() => setLog(`Stopped ${stopVoices()} scheduled voices.`)}>
        <Text style={styles.secondaryText}>Stop voices</Text>
      </Pressable>
      <Text style={styles.mono}>{log}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, paddingTop: 56, gap: 8 },
  title: { fontSize: 22, fontWeight: "600" },
  body: { fontSize: 16, lineHeight: 22 },
  meta: { fontSize: 14 },
  button: { backgroundColor: "#1d4e3a", padding: 12, borderRadius: 8 },
  buttonText: { color: "#f4f1ea", fontSize: 16, textAlign: "center" },
  secondary: { borderWidth: 1, borderColor: "#1d4e3a", padding: 10, borderRadius: 8 },
  secondaryText: { fontSize: 15, textAlign: "center" },
  mono: { fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 11 },
});
