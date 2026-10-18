import { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";

import { beginTransport, extendTransport, playPlans, readAudioTime, stopAudio } from "./src/audio/engine";
import { auditionVoices, beatAtContextTime, planArrangement, planReferenceWindow, planVoices, TRANSPORT_HORIZON_BEATS, type ChordId } from "./src/audio/plan";
import { NeckBoard } from "./src/NeckBoard";
import { chordTitle, displayStrings, openStringLabel, positionJumps, visibleFrets, visibleNeck, type NeckCell } from "./src/neck";
import { focusLeadSlot, leadSlots, playabilityLabel, rhythmRows, songBars } from "./src/overview";
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
  formatInsertion,
  insertLead,
  moveNeck,
  muteDraftString,
  pause,
  play,
  playheadSegment,
  redo,
  removeRhythm,
  replaceSelectedLead,
  selectSegment,
  setCompareView,
  setDraftFret,
  setHarmonyChoice,
  setLeadDuration,
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
    const loop = session.loop;
    const timeline = session.timeline;
    const length = songLength(session);
    let cancel = false;
    let origin: { beat: number; contextTime: number } | null = null;
    let scheduledUntil = startBeat;
    let extending = false;
    void (async () => {
      const begun = await beginTransport(
        planReferenceWindow(timeline, startBeat, startBeat, startBeat + TRANSPORT_HORIZON_BEATS, loop),
        startBeat,
        bpm,
      );
      if (cancel || !begun) return;
      origin = begun.origin;
      scheduledUntil = startBeat + TRANSPORT_HORIZON_BEATS;
    })();
    const timer = setInterval(() => {
      void (async () => {
        if (cancel || origin == null) return;
        const now = await readAudioTime();
        if (now == null) return;
        const unwrapped = beatAtContextTime(origin.beat, origin.contextTime, now, bpm);
        if (!loop && unwrapped >= length) {
          setSession((current) => current.transportEpoch === epoch ? { ...current, beat: length, playing: false, notice: "End of the progression." } : current);
          return;
        }
        const display = loop ? unwrapped % length : Math.min(unwrapped, length);
        setSession((current) => current.transportEpoch === epoch ? { ...current, beat: display } : current);
        if (extending || unwrapped + 1 < scheduledUntil) return;
        if (!loop && scheduledUntil >= length) return;
        extending = true;
        const from = scheduledUntil;
        const currentBeat = unwrapped;
        scheduledUntil += TRANSPORT_HORIZON_BEATS;
        await extendTransport(
          planReferenceWindow(timeline, currentBeat, from, from + TRANSPORT_HORIZON_BEATS, loop),
          origin,
          currentBeat,
          bpm,
        );
        extending = false;
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
      setSession((current) => ({ ...current, notice: "Saved. A backup is kept until the new file is in place. A crash during the final move has not been tested on a phone." }));
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
  const bars = songBars(session);
  const slots = leadSlots(session);
  const strings = rhythmRows(session);
  const editingRhythm = session.workspace === "yours" && session.yoursMode === "rhythm";
  const editingLead = session.workspace === "yours" && session.yoursMode === "lead";

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: 8 + androidTopInset() }]}>
        <View style={styles.top}>
          <Text style={styles.brand}>FretWays</Text>
          <Text style={styles.kicker}>{chordTitle(chord)} · {formatBeat(session.beat, songLength(session))} · {session.harmonyChoice === "follow" ? "Follow" : "Hold"}</Text>
          <Pressable onPress={() => void save()} style={styles.chip}><Text style={styles.chipText}>Save</Text></Pressable>
        </View>
        <View style={styles.row}>
          <Pressable onPress={() => setSession((current) => (current.playing ? pause(current) : play(current)))} style={styles.play}>
            <Text style={styles.playText}>{session.playing ? "Pause" : "Play"}</Text>
          </Pressable>
          <Pressable onPress={() => setSession((current) => stop(current))} style={styles.chip}><Text style={styles.chipText}>Stop</Text></Pressable>
          <Pressable onPress={() => setSession((current) => setLoop(current, !current.loop))} style={[styles.chip, session.loop && styles.chipOn]}><Text style={styles.chipText}>{session.loop ? "Looping" : "Loop"}</Text></Pressable>
          <Pressable onPress={() => setSession((current) => setHarmonyChoice(current, current.harmonyChoice === "follow" ? "hold" : "follow"))} style={styles.chip}>
            <Text style={styles.chipText}>{session.harmonyChoice === "follow" ? "Hold chord" : "Follow song"}</Text>
          </Pressable>
        </View>
        <View style={styles.row}>
          {bars.map((bar) => {
            const selected = bar.segmentId === chord.id;
            const here = playhead?.id === bar.segmentId;
            return (
              <Pressable key={bar.segmentId} onPress={() => setSession((current) => selectSegment(current, bar.segmentId))} style={[styles.chord, selected && styles.chordOn]}>
                <Text style={[styles.chordText, selected && styles.chordTextOn]}>{bar.label}{here ? " ·" : ""}</Text>
                <Text style={[styles.chordHint, selected && styles.chordTextOn]}>{bar.hasVoicing ? "voicing" : "—"}{bar.leadCount > 0 ? ` · ${bar.leadCount}` : ""}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.row}>
          {(["reference", "yours", "compare"] as Workspace[]).map((item) => (
            <Pressable key={item} onPress={() => setSession((current) => setWorkspace(current, item))} style={[styles.chip, styles.grow, session.workspace === item && styles.chipOn]}>
              <Text style={styles.chipText}>{item === "reference" ? "Reference" : item === "yours" ? "Yours" : "Compare"}</Text>
            </Pressable>
          ))}
        </View>
        {session.workspace === "yours" ? (
          <View style={styles.row}>
            {(["explore", "rhythm", "lead"] as YoursMode[]).map((mode) => (
              <Pressable key={mode} onPress={() => setSession((current) => setYoursMode(current, mode))} style={[styles.chip, styles.grow, session.yoursMode === mode && styles.chipOn]}>
                <Text style={styles.chipText}>{mode === "explore" ? "Explore" : mode === "rhythm" ? "Rhythm" : "Lead"}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <View {...pan.panHandlers}>
          <NeckBoard
            frets={frets}
            rows={rows}
            stringLabels={displayStrings().map((stringIndex) => openStringLabel(stringIndex))}
            labelMode={session.labelMode}
            selectedKey={null}
            marks={marks}
            mutedStrings={editingRhythm ? material.mutedStrings : []}
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
              <Text style={styles.chipText}>{mode === "markers" ? "Dots" : mode === "names" ? "Names" : "Intervals"}</Text>
            </Pressable>
          ))}
        </View>
        {session.workspace === "compare" ? (
          <View style={styles.tray}>
            <View style={styles.row}>
              <Pressable onPress={() => setSession((current) => setCompareView(current, "reference"))} style={[styles.chip, styles.grow, session.compareView === "reference" && styles.chipOn]}><Text style={styles.chipText}>Chord map</Text></Pressable>
              <Pressable onPress={() => setSession((current) => setCompareView(current, "yours"))} style={[styles.chip, styles.grow, session.compareView === "yours" && styles.chipOn]}><Text style={styles.chipText}>Your part</Text></Pressable>
            </View>
            <Text style={styles.meta}>{session.compareView === "reference" ? "Gold, green, and blue are the chord tones." : "Coral rings are the notes you saved."}</Text>
          </View>
        ) : null}
        {session.workspace !== "yours" || session.yoursMode === "explore" ? (
          <View style={styles.row}>
            <Pressable onPress={() => setSession((current) => ({ ...current, auditionMode: current.auditionMode === "solo" ? "in-context" : "solo" }))} style={styles.chip}>
              <Text style={styles.chipText}>{session.auditionMode === "solo" ? "Solo" : "With chord"}</Text>
            </Pressable>
            <Text style={styles.meta}>{session.workspace === "reference" ? "Tap any fret. The map stays read-only." : "Explore does not save."}</Text>
          </View>
        ) : null}
        {editingRhythm ? (
          <View style={styles.tray}>
            <View style={styles.row}>
              {strings.map((row) => (
                <Pressable key={row.stringIndex} onPress={() => setSession((current) => muteDraftString(current, row.stringIndex))} style={styles.stringChip}>
                  <Text style={styles.chipText}>{row.label}</Text>
                  <Text style={styles.meta}>{row.state}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.meta}>{playabilityLabel(material.playability, material.notes.length)} Tap a string letter to mute it.</Text>
            <View style={styles.row}>
              <Pressable onPress={() => void playPlans("tap", planVoices({ gesture: material.notes, mode: session.auditionMode, chordId: chord.id as ChordId, idPrefix: "draft" }))} style={styles.chip}><Text style={styles.chipText}>Hear shape</Text></Pressable>
              <Pressable onPress={() => setSession((current) => commitDraft(current))} style={styles.chip}><Text style={styles.chipText}>Use on {chord.label}</Text></Pressable>
              <Pressable onPress={() => setSession((current) => removeRhythm(current))} style={styles.chip}><Text style={styles.chipText}>Remove</Text></Pressable>
            </View>
          </View>
        ) : null}
        {editingLead ? (
          <View style={styles.tray}>
            <Text style={styles.meta}>{chord.label} · insert {formatInsertion(session.cursorBeat, songLength(session))} · {session.leadDuration === 1 ? "quarter" : "eighth"}</Text>
            <View style={styles.row}>
              {slots.map((slot) => (
                <Pressable key={slot.beat} onPress={() => setSession((current) => focusLeadSlot(current, slot.beat))} style={[styles.slot, Math.abs(session.cursorBeat - slot.beat) < 1e-6 && styles.chipOn, slot.kind === "note" && styles.slotNote]}>
                  <Text style={styles.slotBeat}>{slot.label}</Text>
                  <Text style={styles.slotCaption}>{slot.caption}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.row}>
              <Pressable onPress={() => setSession((current) => setLeadDuration(current, current.leadDuration === 1 ? 0.5 : 1))} style={styles.chip}><Text style={styles.chipText}>{session.leadDuration === 1 ? "Quarter" : "Eighth"}</Text></Pressable>
              <Pressable onPress={() => setSession((current) => insertLead(current, null))} style={styles.chip}><Text style={styles.chipText}>Rest</Text></Pressable>
              <Pressable onPress={() => setReplaceArmed(true)} style={[styles.chip, replaceArmed && styles.chipOn]}><Text style={styles.chipText}>{replaceArmed ? "Tap a fret" : "Replace"}</Text></Pressable>
              <Pressable onPress={() => setSession((current) => deleteSelectedLead(current))} style={styles.chip}><Text style={styles.chipText}>Delete</Text></Pressable>
            </View>
          </View>
        ) : null}
        <View style={styles.row}>
          <Pressable onPress={() => { const current = sessionRef.current; setSession(pause(current)); void playPlans("tap", planArrangement(current.arrangement, current.timeline, current.beat)); }} style={styles.chip}><Text style={styles.chipText}>Hear yours</Text></Pressable>
          <Pressable onPress={() => setSession((current) => undo(current))} style={styles.chip}><Text style={styles.chipText}>Undo</Text></Pressable>
          <Pressable onPress={() => setSession((current) => redo(current))} style={styles.chip}><Text style={styles.chipText}>Redo</Text></Pressable>
          <Pressable onPress={() => void reopen()} style={styles.chip}><Text style={styles.chipText}>Open</Text></Pressable>
        </View>
        <Text style={styles.status}>{session.notice}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#1c1915" },
  content: { paddingHorizontal: 12, paddingBottom: 24, gap: 8 },
  top: { flexDirection: "row", alignItems: "center", gap: 8 },
  brand: { color: "#f3efe6", fontSize: 20, fontWeight: "700" },
  kicker: { color: "#c4b8a5", fontSize: 13, flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  tray: { gap: 6 },
  grow: { flex: 1, alignItems: "center" },
  play: { minHeight: 40, paddingHorizontal: 14, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#e2b657" },
  playText: { color: "#1c1915", fontSize: 15, fontWeight: "700" },
  chord: { flex: 1, minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#2a2420" },
  chordOn: { backgroundColor: "#e2b657" },
  chordText: { color: "#f3efe6", fontSize: 16, fontWeight: "700" },
  chordHint: { color: "#c4b8a5", fontSize: 10 },
  chordTextOn: { color: "#1c1915" },
  chip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: "#2a2420" },
  chipOn: { backgroundColor: "#3f4f46" },
  chipText: { color: "#f3efe6", fontSize: 14 },
  meta: { color: "#c4b8a5", fontSize: 13, flexShrink: 1 },
  stringChip: { width: 48, minHeight: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#2a2420" },
  slot: { width: 36, minHeight: 42, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#2a2420" },
  slotNote: { backgroundColor: "#5c3a32" },
  slotBeat: { color: "#c4b8a5", fontSize: 10 },
  slotCaption: { color: "#f3efe6", fontSize: 12, fontWeight: "700" },
  status: { color: "#f3efe6", fontSize: 15 },
});
