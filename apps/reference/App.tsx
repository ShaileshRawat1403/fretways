import { useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";

import { playAudition } from "./src/audition";
import { NeckBoard } from "./src/NeckBoard";
import {
  chordById,
  chordTitle,
  displayStrings,
  moveNeck,
  openStringLabel,
  positionJumps,
  referenceChords,
  selectChord,
  visibleFrets,
  visibleNeck,
  type LabelMode,
  type NeckCell,
  type ReferenceState,
} from "./src/neck";
import type { AuditionMode } from "./src/auditionPlan";
import type { ChordId } from "../../experiments/increment-2-audio/src/voices";

const chords = referenceChords();

export default function App() {
  const [state, setState] = useState<ReferenceState>({ chordId: "c-major", firstFret: 0 });
  const [labels, setLabels] = useState<LabelMode>("markers");
  const [mode, setMode] = useState<AuditionMode>("in-context");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [status, setStatus] = useState("Tap any fret. Accompaniment is synthesized.");
  const stateRef = useRef(state);
  stateRef.current = state;

  const chord = chordById(state.chordId);
  const frets = visibleFrets(state.firstFret);
  const rows = useMemo(() => visibleNeck(chord, state.firstFret), [chord, state.firstFret]);
  const stringLabels = displayStrings().map((stringIndex) => openStringLabel(stringIndex));

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 24 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dx <= -36) setState((current) => moveNeck(current, current.firstFret + 1));
        if (gesture.dx >= 36) setState((current) => moveNeck(current, current.firstFret - 1));
      },
    }),
  ).current;

  async function onTap(cell: NeckCell) {
    setSelectedKey(`${cell.stringIndex}-${cell.fret}`);
    const role = cell.role ? ` · ${cell.role}` : " · outside the chord";
    setStatus(`String ${cell.conventionalString} · fret ${cell.fret} · ${cell.noteName}${role}`);
    try {
      await playAudition(cell.note, mode, stateRef.current.chordId as ChordId);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The note could not be started.");
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.brand}>FretWays</Text>
      <Text style={styles.kicker}>Reference · harmonic map, not a recorded fingering</Text>
      <View style={styles.row}>
        {chords.map((item) => {
          const selected = item.id === state.chordId;
          return (
            <Pressable
              key={item.id}
              onPress={() => setState((current) => selectChord(current, item.id))}
              style={[styles.chord, selected && styles.chordOn]}
            >
              <Text style={[styles.chordText, selected && styles.chordTextOn]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.row}>
        {(["solo", "in-context"] as const).map((item) => (
          <Pressable key={item} onPress={() => setMode(item)} style={[styles.mode, mode === item && styles.modeOn]}>
            <Text style={styles.modeText}>{item === "solo" ? "Solo" : "With chord"}</Text>
          </Pressable>
        ))}
        <Text style={styles.synth}>Synthesized</Text>
      </View>
      <View {...pan.panHandlers}>
        <NeckBoard
          frets={frets}
          rows={rows}
          stringLabels={stringLabels}
          labelMode={labels}
          selectedKey={selectedKey}
          onTap={(cell) => void onTap(cell)}
        />
      </View>
      <View style={styles.row}>
        {positionJumps.map((fret) => (
          <Pressable key={fret} onPress={() => setState((current) => moveNeck(current, fret))} style={styles.jump}>
            <Text style={styles.jumpText}>{fret === 0 ? "Open" : fret}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.row}>
        {(
          [
            ["markers", "Marks"],
            ["names", "Names"],
            ["intervals", "Intervals"],
          ] as const
        ).map(([value, label]) => (
          <Pressable key={value} onPress={() => setLabels(value)} style={[styles.jump, labels === value && styles.modeOn]}>
            <Text style={styles.jumpText}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.legend}>
        <Legend color="#e2b657" name="Root" />
        <Legend color="#7eb8a2" name="Third" />
        <Legend color="#8aa4c8" name="Fifth" />
      </View>
      <Text style={styles.status}>{chordTitle(chord)} · frets {frets[0]}–{frets[4]}</Text>
      <Text style={styles.status}>{status}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Legend(props: { color: string; name: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: props.color }]} />
      <Text style={styles.jumpText}>{props.name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#1c1915" },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28, gap: 10 },
  brand: { color: "#f3efe6", fontSize: 22, fontWeight: "700" },
  kicker: { color: "#c4b8a5", fontSize: 13, marginTop: -6 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  chord: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2a2420",
  },
  chordOn: { backgroundColor: "#e2b657" },
  chordText: { color: "#f3efe6", fontSize: 18, fontWeight: "700" },
  chordTextOn: { color: "#1c1915" },
  mode: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: "#2a2420" },
  modeOn: { backgroundColor: "#3f4f46" },
  modeText: { color: "#f3efe6", fontSize: 15 },
  synth: { color: "#c4b8a5", fontSize: 13, marginLeft: "auto" },
  jump: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: "#2a2420" },
  jumpText: { color: "#f3efe6", fontSize: 14 },
  legend: { flexDirection: "row", gap: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  status: { color: "#f3efe6", fontSize: 15 },
});
