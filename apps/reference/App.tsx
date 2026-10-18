import { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";

import { noteName } from "../../packages/music/src/index";
import { playPlans, readAudioTime, stopAudio } from "./src/audio/engine";
import { auditionVoices, planArrangement, planReferenceProgression, planVoices, type ChordId } from "./src/audio/plan";
import { NeckBoard } from "./src/NeckBoard";
import { chordTitle, displayStrings, openStringLabel, positionJumps, visibleFrets, visibleNeck, type NeckCell } from "./src/neck";
import { applyProject, parseProject, toProject } from "./src/project";
import { readProject, writeProject } from "./src/storage";
import {
  boardMarks,
  commitDraft,
  createSession,
  deleteSelectedLead,
  displayedSegment,
  draftMaterial,
  exploreNotice,
  formatBeat,
  insertLead,
  leadInSegment,
  moveNeck,
  muteDraftString,
  pause,
  placePlayhead,
  play,
  playheadSegment,
  redo,
  removeRhythm,
  replaceSelectedLead,
  savedRhythm,
  selectLead,
  selectSegment,
  setCompareView,
  setDraftFret,
  setHarmonyChoice,
  setLoop,
  setWorkspace,
  setYoursMode,
  songLength,
  stop,
  undo,
  type Session,
  type Workspace,
  type YoursMode,
} from "./src/session";

function androidTopInset(): number {
  if (Platform.OS !== "android") return 0;
  const height = StatusBar.currentHeight;
  return height && height > 0 ? height : 24;
}

export default function App() {
  const [session, setSession] = useState<Session>(() => createSession());
  const [replaceArmed, setReplaceArmed] = useState(false);
  const [lastString, setLastString] = useState<NeckCell["stringIndex"] | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const chord = displayedSegment(session).chord;
  const frets = visibleFrets(session.firstFret);
  const rows = useMemo(() => visibleNeck(chord, session.firstFret), [chord, session.firstFret]);
  const marks = boardMarks(session);
  const playhead = playheadSegment(session);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      try {
        const raw = await readProject();
        if (cancel || !raw) return;
        const parsed = parseProject(raw);
        if (!parsed.ok) {
          setSession((current) => ({ ...current, notice: parsed.reason }));
          return;
        }
        setSession((current) => applyProject(current, parsed.project));
      } catch {
        setSession((current) => ({ ...current, notice: "Saved work could not be opened." }));
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!session.playing) {
      stopAudio("transport");
      return;
    }
    const epoch = session.transportEpoch;
    const startBeat = session.beat;
    const bpm = session.timeline.bpm;
    const cycles = session.loop ? 8 : 1;
    const timeline = session.timeline;
    let cancel = false;
    const perfStart = performance.now();
    let audioStart: number | null = null;
    void (async () => {
      await playPlans("transport", planReferenceProgression(timeline, startBeat, cycles));
      if (cancel) return;
      audioStart = await readAudioTime();
    })();
    const timer = setInterval(() => {
      void (async () => {
        const now = await readAudioTime();
        const seconds = audioStart != null && now != null ? now - audioStart : (performance.now() - perfStart) / 1000;
        if (cancel) return;
        setSession((current) => (current.transportEpoch === epoch ? placePlayhead(current, startBeat + seconds * (bpm / 60)) : current));
      })();
    }, 80);
    return () => {
      cancel = true;
      clearInterval(timer);
      stopAudio("transport");
    };
  }, [session.playing, session.transportEpoch]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 24 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dx <= -36) setSession((current) => moveNeck(current, current.firstFret + 1));
        if (gesture.dx >= 36) setSession((current) => moveNeck(current, current.firstFret - 1));
      },
    }),
  ).current;

  async function audition(cell: NeckCell) {
    const current = sessionRef.current;
    if (current.workspace === "yours" && current.yoursMode === "explore") {
      setSession(exploreNotice(current, cell.noteName, cell.intervalLabel));
    }
    await playPlans("tap", auditionVoices(cell.note, current.auditionMode, chord.id as ChordId, `tap-${cell.stringIndex}-${cell.fret}`));
  }

  async function onTap(cell: NeckCell) {
    const current = sessionRef.current;
    setLastString(cell.stringIndex);
    const editingRhythm = current.workspace === "yours" && current.yoursMode === "rhythm";
    const editingLead = current.workspace === "yours" && current.yoursMode === "lead";
    if (editingRhythm) {
      setSession(setDraftFret(current, cell.stringIndex, cell.fret));
      return;
    }
    if (editingLead) {
      if (replaceArmed && current.selectedLeadId) {
        setSession(replaceSelectedLead(current, cell.note));
        setReplaceArmed(false);
        return;
      }
      setSession(insertLead(current, cell.note));
      return;
    }
    await audition(cell);
  }

  async function save() {
    try {
      await writeProject(JSON.stringify(toProject(sessionRef.current)));
      setSession((current) => ({ ...current, notice: "Saved on this device. The write is not claimed to be crash-proof." }));
    } catch {
      setSession((current) => ({ ...current, notice: "Save failed. The previous file, if any, was left as it was." }));
    }
  }

  async function reopen() {
    try {
      const raw = await readProject();
      if (!raw) {
        setSession((current) => ({ ...current, notice: "Nothing is saved on this device yet." }));
        return;
      }
      const parsed = parseProject(raw);
      if (!parsed.ok) {
        setSession((current) => ({ ...current, notice: parsed.reason }));
        return;
      }
      setSession((current) => applyProject(current, parsed.project));
    } catch {
      setSession((current) => ({ ...current, notice: "Saved work could not be opened." }));
    }
  }

  const material = draftMaterial(session);
  const rhythm = savedRhythm(session);
  const leads = leadInSegment(session);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: 12 + androidTopInset() }]}>
        <Text style={styles.brand}>FretWays</Text>
        <Text style={styles.kicker}>{chordTitle(chord)} · {session.workspace} · synthesized audio</Text>
        <View style={styles.row}>
          {(["reference", "yours", "compare"] as Workspace[]).map((item) => (
            <Pressable key={item} onPress={() => setSession((current) => setWorkspace(current, item))} style={[styles.chip, session.workspace === item && styles.chipOn]}>
              <Text style={styles.chipText}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.row}>
          {session.timeline.segments.map((segment) => {
            const selected = segment.id === chord.id;
            const here = playhead?.id === segment.id;
            return (
              <Pressable key={segment.id} onPress={() => setSession((current) => selectSegment(current, segment.id))} style={[styles.chord, selected && styles.chordOn]}>
                <Text style={[styles.chordText, selected && styles.chordTextOn]}>{segment.chord.label}{here ? " ·" : ""}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.row}>
          <Pressable onPress={() => setSession((current) => play(current))} style={styles.chip}><Text style={styles.chipText}>Play</Text></Pressable>
          <Pressable onPress={() => setSession((current) => pause(current))} style={styles.chip}><Text style={styles.chipText}>Pause</Text></Pressable>
          <Pressable onPress={() => setSession((current) => stop(current))} style={styles.chip}><Text style={styles.chipText}>Stop</Text></Pressable>
          <Text style={styles.meta}>{formatBeat(session.beat, songLength(session))}</Text>
          <Pressable onPress={() => setSession((current) => setLoop(current, !current.loop))} style={[styles.chip, session.loop && styles.chipOn]}><Text style={styles.chipText}>Loop</Text></Pressable>
          <Pressable onPress={() => setSession((current) => setHarmonyChoice(current, current.harmonyChoice === "follow" ? "hold" : "follow"))} style={styles.chip}>
            <Text style={styles.chipText}>{session.harmonyChoice === "follow" ? "Follow" : "Hold"}</Text>
          </Pressable>
        </View>
        <View {...pan.panHandlers}>
          <NeckBoard
            frets={frets}
            rows={rows}
            stringLabels={displayStrings().map((stringIndex) => openStringLabel(stringIndex))}
            labelMode={session.labelMode}
            selectedKey={null}
            marks={marks}
            mutedStrings={session.workspace === "yours" && session.yoursMode === "rhythm" ? material.mutedStrings : []}
            onTap={(cell) => void onTap(cell)}
          />
        </View>
        <View style={styles.row}>
          {positionJumps.map((fret) => (
            <Pressable key={fret} onPress={() => setSession((current) => moveNeck(current, fret))} style={styles.chip}>
              <Text style={styles.chipText}>{fret === 0 ? "Open" : fret}</Text>
            </Pressable>
          ))}
          {(["markers", "names", "intervals"] as const).map((mode) => (
            <Pressable key={mode} onPress={() => setSession((current) => ({ ...current, labelMode: mode }))} style={[styles.chip, session.labelMode === mode && styles.chipOn]}>
              <Text style={styles.chipText}>{mode === "markers" ? "Marks" : mode === "names" ? "Names" : "Intervals"}</Text>
            </Pressable>
          ))}
        </View>
        {session.workspace === "yours" ? (
          <View style={styles.row}>
            {(["explore", "rhythm", "lead"] as YoursMode[]).map((mode) => (
              <Pressable key={mode} onPress={() => setSession((current) => setYoursMode(current, mode))} style={[styles.chip, session.yoursMode === mode && styles.chipOn]}>
                <Text style={styles.chipText}>{mode}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {session.workspace === "compare" ? (
          <View style={styles.row}>
            <Pressable onPress={() => setSession((current) => setCompareView(current, "reference"))} style={[styles.chip, session.compareView === "reference" && styles.chipOn]}><Text style={styles.chipText}>Map</Text></Pressable>
            <Pressable onPress={() => setSession((current) => setCompareView(current, "yours"))} style={[styles.chip, session.compareView === "yours" && styles.chipOn]}><Text style={styles.chipText}>Yours</Text></Pressable>
          </View>
        ) : null}
        {session.workspace !== "yours" || session.yoursMode === "explore" ? (
          <View style={styles.row}>
            <Pressable onPress={() => setSession((current) => ({ ...current, auditionMode: current.auditionMode === "solo" ? "in-context" : "solo" }))} style={styles.chip}>
              <Text style={styles.chipText}>{session.auditionMode === "solo" ? "Solo" : "With chord"}</Text>
            </Pressable>
          </View>
        ) : null}
        {session.workspace === "yours" && session.yoursMode === "rhythm" ? (
          <View style={styles.tray}>
            <Text style={styles.meta}>{material.notes.length} notes · {material.mutedStrings.length} muted · {material.playability}{rhythm ? " · saved" : ""}</Text>
            <View style={styles.row}>
              <Pressable onPress={() => lastString != null && setSession((current) => muteDraftString(current, lastString))} style={styles.chip}><Text style={styles.chipText}>Mute</Text></Pressable>
              <Pressable onPress={() => void playPlans("tap", planVoices({ gesture: material.notes, mode: session.auditionMode, chordId: chord.id as ChordId, idPrefix: "draft" }))} style={styles.chip}><Text style={styles.chipText}>Hear</Text></Pressable>
              <Pressable onPress={() => setSession((current) => commitDraft(current))} style={styles.chip}><Text style={styles.chipText}>Use on chord</Text></Pressable>
              <Pressable onPress={() => setSession((current) => removeRhythm(current))} style={styles.chip}><Text style={styles.chipText}>Remove</Text></Pressable>
            </View>
          </View>
        ) : null}
        {session.workspace === "yours" && session.yoursMode === "lead" ? (
          <View style={styles.tray}>
            <Text style={styles.meta}>Cursor {formatBeat(session.cursorBeat, songLength(session))} · {session.leadDuration === 1 ? "quarter" : "eighth"}</Text>
            <View style={styles.row}>
              <Pressable onPress={() => setSession((current) => ({ ...current, leadDuration: current.leadDuration === 1 ? 0.5 : 1 }))} style={styles.chip}><Text style={styles.chipText}>Duration</Text></Pressable>
              <Pressable onPress={() => setSession((current) => insertLead(current, null))} style={styles.chip}><Text style={styles.chipText}>Rest</Text></Pressable>
              <Pressable onPress={() => setReplaceArmed(true)} style={[styles.chip, replaceArmed && styles.chipOn]}><Text style={styles.chipText}>Replace</Text></Pressable>
              <Pressable onPress={() => setSession((current) => deleteSelectedLead(current))} style={styles.chip}><Text style={styles.chipText}>Delete</Text></Pressable>
              <Pressable onPress={() => setSession((current) => undo(current))} style={styles.chip}><Text style={styles.chipText}>Undo</Text></Pressable>
              <Pressable onPress={() => setSession((current) => redo(current))} style={styles.chip}><Text style={styles.chipText}>Redo</Text></Pressable>
            </View>
            {leads.map((event) => (
              <Pressable key={event.id} onPress={() => setSession((current) => selectLead(current, event.id))} style={[styles.chip, session.selectedLeadId === event.id && styles.chipOn]}>
                <Text style={styles.chipText}>{formatBeat(event.startBeat)} {event.kind === "note" ? noteName(event.note.midi) : "rest"}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View style={styles.row}>
          <Pressable onPress={() => { const current = sessionRef.current; setSession(pause(current)); void playPlans("tap", planArrangement(current.arrangement, current.timeline, current.beat)); }} style={styles.chip}><Text style={styles.chipText}>Hear yours</Text></Pressable>
          <Pressable onPress={() => setSession((current) => undo(current))} style={styles.chip}><Text style={styles.chipText}>Undo</Text></Pressable>
          <Pressable onPress={() => setSession((current) => redo(current))} style={styles.chip}><Text style={styles.chipText}>Redo</Text></Pressable>
          <Pressable onPress={() => void save()} style={styles.chip}><Text style={styles.chipText}>Save</Text></Pressable>
          <Pressable onPress={() => void reopen()} style={styles.chip}><Text style={styles.chipText}>Open</Text></Pressable>
        </View>
        <Text style={styles.status}>{session.notice}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#1c1915" },
  content: { paddingHorizontal: 16, paddingBottom: 28, gap: 10 },
  brand: { color: "#f3efe6", fontSize: 22, fontWeight: "700" },
  kicker: { color: "#c4b8a5", fontSize: 13, marginTop: -6 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  tray: { gap: 8 },
  chord: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#2a2420" },
  chordOn: { backgroundColor: "#e2b657" },
  chordText: { color: "#f3efe6", fontSize: 16, fontWeight: "700" },
  chordTextOn: { color: "#1c1915" },
  chip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: "#2a2420" },
  chipOn: { backgroundColor: "#3f4f46" },
  chipText: { color: "#f3efe6", fontSize: 14 },
  meta: { color: "#c4b8a5", fontSize: 13 },
  status: { color: "#f3efe6", fontSize: 15 },
});
