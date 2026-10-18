import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";

import { auditionVoices, beatAtContextTime, planArrangement, planChord, planPhrase, planReferenceWindow, planVoices, TRANSPORT_HORIZON_BEATS, type ChordId } from "@/lib/fretways/plan";
import { beginTransport, extendTransport, playTap, readAudioTime, scheduleClicks, stopAudio, unlockAudio } from "@/lib/fretways/engine";
import { Neck, type NeckHandle } from "@/components/fretways/Neck";
import { analyzeBuffer, chromaFromSpectrum, matchChord, spotifyPath, toSymbol, youtubeId, type ChartPoint } from "@/lib/fretways/hear";
import { gripFor } from "@/lib/fretways/shapes";
import { chordSpelling, displayStrings, FRET_COUNT, openStringLabel, positionJumps, visibleFrets, visibleNeck, type NeckCell } from "@/lib/fretways/neck";
import { nextMoves, type Touch } from "@/lib/fretways/possibilities";
import { defaultNeck, midiAt, noteName, placeNote, standardTuning } from "@/lib/music";
import { focusLeadSlot, leadSlots, playabilityLabel, rhythmRows, songBars } from "@/lib/fretways/overview";
import { applyProject, parseProject, toProject } from "@/lib/fretways/project";
import { readSaved, writeSaved } from "@/lib/fretways/storage";
import {
  appendPhrase,
  boardMarks,
  commitDraft,
  createSession,
  deleteSelectedLead,
  displayedSegment,
  draftMaterial,
  formatBeat,
  formatInsertion,
  insertLead,
  keepGrip,
  muteDraftString,
  pause,
  phraseInBar,
  play,
  playheadSegment,
  redo,
  removeRhythm,
  replaceSelectedLead,
  selectSegment,
  setCompareView,
  setDraftFret,
  setHarmonyChoice,
  setLeadTouch,
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
} from "@/lib/fretways/session";

export function Studio() {
  const [session, setSession] = useState<Session>(() => createSession());
  const [replaceArmed, setReplaceArmed] = useState(false);
  const [click, setClick] = useState(false);
  const [intent, setIntent] = useState<"line" | "together">("line");
  const intentRef = useRef(intent);
  intentRef.current = intent;
  const [live, setLive] = useState<{ key: string; name: string } | null>(null);
  const [listening, setListening] = useState(false);
  const [reading, setReading] = useState<number | null>(null);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [pinned, setPinned] = useState<number | null>(null);
  const [leadMidi, setLeadMidi] = useState<number | null>(null);
  const [level, setLevel] = useState(0);
  const [sourceName, setSourceName] = useState("");
  const [link, setLink] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [spotify, setSpotify] = useState<string | null>(null);
  const [linkNote, setLinkNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const listenRef = useRef<{ stop: () => void } | null>(null);
  const smoothRef = useRef(Array.from({ length: 12 }, () => 0));
  const stableRef = useRef({ id: "", count: 0 });
  const sessionRef = useRef(session);
  const neckRef = useRef<NeckHandle>(null);
  const movesRef = useRef<ReturnType<typeof nextMoves>>([]);
  sessionRef.current = session;

  const practiceChord = displayedSegment(session).chord;
  const followed = pinned != null ? chart[pinned] : chart[chart.length - 1];
  const chord = followed?.symbol ?? practiceChord;
  const frets = visibleFrets(0, FRET_COUNT + 1);
  const rows = useMemo(() => visibleNeck(chord, 0, FRET_COUNT + 1), [chord]);
  const marks = boardMarks(session);
  const playhead = playheadSegment(session);

  useEffect(() => {
    const raw = readSaved();
    if (!raw) return;
    const parsed = parseProject(raw);
    if (!parsed.ok) {
      setSession((current) => ({ ...current, notice: parsed.reason }));
      return;
    }
    setSession((current) => applyProject(current, parsed.project));
  }, []);

  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
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
    const begun = beginTransport(
      planReferenceWindow(timeline, startBeat, startBeat, startBeat + TRANSPORT_HORIZON_BEATS, loop),
      startBeat,
      bpm,
    );
    origin = begun.origin;
    scheduledUntil = startBeat + TRANSPORT_HORIZON_BEATS;
    if (click) scheduleClicks(origin, startBeat, scheduledUntil, bpm);
    const timer = window.setInterval(() => {
      if (cancel || origin == null) return;
      const now = readAudioTime();
      if (now == null) return;
      const unwrapped = beatAtContextTime(origin.beat, origin.contextTime, now, bpm);
      if (!loop && unwrapped >= length) {
        setSession((current) => (current.transportEpoch === epoch ? { ...current, beat: length, playing: false, notice: "End of the progression." } : current));
        return;
      }
      const display = loop ? unwrapped % length : Math.min(unwrapped, length);
      setSession((current) => (current.transportEpoch === epoch ? { ...current, beat: display } : current));
      if (extending || unwrapped + 1 < scheduledUntil) return;
      if (!loop && scheduledUntil >= length) return;
      extending = true;
      const from = scheduledUntil;
      const currentBeat = unwrapped;
      scheduledUntil += TRANSPORT_HORIZON_BEATS;
      extendTransport(planReferenceWindow(timeline, currentBeat, from, from + TRANSPORT_HORIZON_BEATS, loop), origin, currentBeat, bpm);
      if (click) scheduleClicks(origin, from, from + TRANSPORT_HORIZON_BEATS, bpm);
      extending = false;
    }, 80);
    return () => {
      cancel = true;
      window.clearInterval(timer);
      stopAudio("transport");
    };
  }, [session.playing, session.transportEpoch, click]);

  function onTap(cell: NeckCell) {
    unlockAudio();
    setLive({ key: `${cell.stringIndex}-${cell.fret}`, name: `${cell.noteName}${cell.role ? ` · ${cell.role}` : ""}` });
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
    if (intentRef.current === "together") {
      setSession(setDraftFret(current, cell.stringIndex, cell.fret));
      playTap(auditionVoices(cell.note, current.auditionMode, chord.id as ChordId, `tap-${cell.stringIndex}-${cell.fret}`));
      return;
    }
    const last = phraseInBar(current).at(-1);
    const move = movesRef.current.find((item) => item.stringIndex === cell.stringIndex && item.fret === cell.fret);
    if (move?.touch === "bend" && last && last.note.stringIndex === cell.stringIndex && last.note.fret === cell.fret) {
      setSession(setLeadTouch(current, last.id, "bend"));
      playTap(planPhrase([{ note: last.note, touch: "bend" }]));
      return;
    }
    const touch: Touch = move && move.touch !== "bend" ? move.touch : "pick";
    setSession(appendPhrase(current, cell.note, touch));
    playTap(planPhrase([{ note: cell.note, touch }]));
  }

  function save() {
    writeSaved(JSON.stringify(toProject(sessionRef.current)));
    setSession((current) => ({ ...current, notice: "Saved on this device." }));
  }

  function reopen() {
    const raw = readSaved();
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
  }

  const material = draftMaterial(session);
  const bars = songBars(session);
  const slots = leadSlots(session);
  const strings = rhythmRows(session);
  const editingRhythm = session.workspace === "yours" && session.yoursMode === "rhythm";
  const editingLead = session.workspace === "yours" && session.yoursMode === "lead";
  const length = songLength(session);
  const hereProgress = `${Math.min(100, ((session.beat % 4) / 4) * 100)}%`;
  const place = formatBeat(session.beat, length);
  const spelling = chordSpelling(chord);
  const grip = gripFor(chord.id);
  const nextChord = session.timeline.segments[(session.timeline.segments.findIndex((item) => item.id === displayedSegment(session).id) + 1) % session.timeline.segments.length];
  const phrase = phraseInBar(session);
  const heardKey = useMemo(() => {
    const midi = followed?.midi ?? leadMidi;
    if (midi == null) return null;
    for (const stringIndex of [5, 4, 3, 2, 1, 0] as const) {
      for (let fret = 0; fret <= 18; fret += 1) {
        if (midiAt(standardTuning, { stringIndex, fret }) === midi) return `${stringIndex}-${fret}`;
      }
    }
    return null;
  }, [followed, leadMidi]);
  const heardSeed = heardKey ? [{ stringIndex: Number(heardKey.split("-")[0]) as 0 | 1 | 2 | 3 | 4 | 5, fret: Number(heardKey.split("-")[1]) }] : [];
  const seeds = heardSeed.length > 0
    ? heardSeed
    : phrase.length > 0
      ? [{ stringIndex: phrase[phrase.length - 1].note.stringIndex, fret: phrase[phrase.length - 1].note.fret }]
      : (grip?.notes ?? []);
  const targetChord = pinned != null && chart[pinned + 1] ? chart[pinned + 1].symbol : chord;
  const moves = nextMoves({ seeds, next: targetChord, tuning: standardTuning, fretCount: FRET_COUNT });
  movesRef.current = moves;
  const touches: Touch[] = ["pick", "hammer", "pull", "slide", "bend"];

  useEffect(() => () => listenRef.current?.stop(), []);

  async function toggleListen() {
    if (listenRef.current) {
      listenRef.current.stop();
      listenRef.current = null;
      setListening(false);
      setLevel(0);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      const bins = new Float32Array(analyser.frequencyBinCount);
      const time = new Float32Array(analyser.fftSize);
      let frame = 0;
      const tick = () => {
        analyser.getFloatFrequencyData(bins);
        analyser.getFloatTimeDomainData(time);
        let energy = 0;
        for (const sample of time) energy += sample * sample;
        const rms = Math.sqrt(energy / time.length);
        setLevel(Math.min(1, rms * 5));
        if (rms > 0.012) {
          const { chroma, peakMidi } = chromaFromSpectrum(bins, ctx.sampleRate);
          const smooth = smoothRef.current;
          for (let index = 0; index < 12; index += 1) smooth[index] = smooth[index] * 0.7 + chroma[index] * 0.3;
          const match = matchChord(smooth);
          if (match) {
            if (stableRef.current.id === match.id) stableRef.current.count += 1;
            else stableRef.current = { id: match.id, count: 1 };
            if (stableRef.current.count === 4) {
              setChart((previous) => {
                const last = previous[previous.length - 1];
                if (last?.chord.id === match.id) return previous;
                return [...previous, { chord: match, symbol: toSymbol(match), midi: peakMidi, start: ctx.currentTime }].slice(-32);
              });
              setPinned(null);
              stableRef.current.count = 0;
            }
          }
          if (peakMidi) setLeadMidi(peakMidi);
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      listenRef.current = {
        stop() {
          cancelAnimationFrame(frame);
          stream.getTracks().forEach((track) => track.stop());
          void ctx.close();
        },
      };
      setListening(true);
      setSourceName("Microphone");
      setLinkNote("");
    } catch {
      setLinkNote("The microphone was not allowed.");
    }
  }

  async function openFile(file: File) {
    setReading(0);
    setSourceName(file.name);
    const ctx = new AudioContext();
    try {
      const buffer = await ctx.decodeAudioData(await file.arrayBuffer());
      const points = await analyzeBuffer(buffer, setReading);
      setChart(points);
      setPinned(points.length > 0 ? 0 : null);
      setLeadMidi(points[0]?.midi ?? null);
      if (points.length === 0) setLinkNote("No stable chord was found in that file.");
    } catch {
      setLinkNote("That audio file could not be read.");
    } finally {
      setReading(null);
      await ctx.close();
    }
  }

  function openStream(event: FormEvent) {
    event.preventDefault();
    const video = youtubeId(link);
    const track = spotifyPath(link);
    if (video) {
      setVideoId(video);
      setSpotify(null);
      setLinkNote("The video plays here. Listening uses the microphone. Headphones hide it.");
      return;
    }
    if (track) {
      setSpotify(track);
      setVideoId(null);
      setLinkNote("Spotify plays here. Listening uses the microphone. Headphones hide it.");
      return;
    }
    setVideoId(null);
    setSpotify(null);
    setLinkNote("Paste a YouTube or Spotify link, or open an audio file.");
  }

  return (
    <main className="stage">
      <header className="player">
        <div>
          <p className="eyebrow">{listening ? "Listening" : chart.length > 0 ? "Heard" : "Practice"}</p>
          <h1 className="chord-hero">{chord.label}</h1>
          <p className="kicker">
            {followed ? `${Math.round(followed.chord.confidence * 100)} match` : place}
            {leadMidi ? ` · lead ${noteName(leadMidi)}` : ""}
            {sourceName ? ` · ${sourceName}` : ""}
          </p>
        </div>
        <div className="meter" aria-hidden="true"><span style={{ width: `${Math.round(level * 100)}%` }} /></div>
        <div className="player-actions">
          <button type="button" className="play" onClick={() => void toggleListen()}>{listening ? "Stop" : "Listen"}</button>
          <button type="button" className="chip" onClick={() => fileRef.current?.click()}>{reading != null ? `${Math.round(reading * 100)}%` : "Audio file"}</button>
          <button type="button" className="chip" onClick={() => { unlockAudio(); setSession((current) => (current.playing ? pause(current) : play(current))); }}>
            {session.playing ? "Pause" : "Practice"}
          </button>
        </div>
        <input ref={fileRef} className="file" type="file" accept="audio/*,.wav,.mp3,.m4a" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void openFile(file);
          event.target.value = "";
        }} />
      </header>
      <form className="link-row" onSubmit={openStream}>
        <input value={link} onChange={(event) => setLink(event.target.value)} placeholder="YouTube or Spotify link" aria-label="YouTube or Spotify link" />
        <button type="submit" className="chip">Open</button>
      </form>
      {linkNote ? <p className="kicker">{linkNote}</p> : null}
      {videoId ? <iframe className="embed" title="YouTube" src={`https://www.youtube.com/embed/${videoId}`} allow="autoplay; encrypted-media" /> : null}
      {spotify ? <iframe className="embed" title="Spotify" src={`https://open.spotify.com/embed/${spotify}`} allow="autoplay; encrypted-media" /> : null}
      <div className="song">
        {chart.length > 0 ? chart.map((point, index) => (
          <button key={`${point.chord.id}-${point.start}`} type="button" className={followed === point ? "bar bar-on" : "bar"} onClick={() => { setPinned(index); setLeadMidi(point.midi); }}>
            <span className="text-base font-bold">{point.chord.label}</span>
          </button>
        )) : bars.map((bar) => {
          const selected = bar.segmentId === practiceChord.id;
          const here = playhead?.id === bar.segmentId;
          return (
            <button
              key={bar.segmentId}
              type="button"
              className={`${selected ? "bar bar-on" : "bar"} ${here ? "bar-here" : ""}`}
              style={here ? ({ "--progress": hereProgress } as CSSProperties) : undefined}
              onClick={() => setSession((current) => selectSegment(current, bar.segmentId))}
            >
              <span className="text-base font-bold">{bar.label}</span>
            </button>
          );
        })}
      </div>
      <div className="modes">
        {(["reference", "yours", "compare"] as Workspace[]).map((item) => (
          <button key={item} type="button" className={session.workspace === item ? "chip chip-on grow" : "chip grow"} onClick={() => setSession((current) => setWorkspace(current, item))}>
            {item === "reference" ? "Reference" : item === "yours" ? "Yours" : "Compare"}
          </button>
        ))}
      </div>
      {session.workspace === "yours" ? (
        <div className="modes">
          {(["explore", "rhythm", "lead"] as YoursMode[]).map((mode) => (
            <button key={mode} type="button" className={session.yoursMode === mode ? "chip chip-on grow" : "chip grow"} onClick={() => setSession((current) => setYoursMode(current, mode))}>
              {mode === "explore" ? "Explore" : mode === "rhythm" ? "Rhythm" : "Lead"}
            </button>
          ))}
        </div>
      ) : null}
      {grip ? (
        <div className="grip">
          <button type="button" className="chip chip-on" onClick={() => { setSession((current) => ({ ...current, firstFret: 0 })); neckRef.current?.scrollToFret(0); }}>{grip.name}</button>
          <span className="diagram">{grip.diagram}</span>
          <button type="button" className="chip" onClick={() => {
            unlockAudio();
            neckRef.current?.scrollToFret(0);
            playTap(planVoices({
              gesture: grip.notes.map((note) => placeNote(standardTuning, defaultNeck, note)),
              mode: session.auditionMode,
              chordId: chord.id as ChordId,
              idPrefix: "grip",
              durationSeconds: 1.4,
            }));
          }}>Hear</button>
          <button type="button" className="chip" onClick={() => setSession((current) => keepGrip(current, grip))}>Keep</button>
          {nextChord ? (
            <button type="button" className="chip" onClick={() => setSession((current) => selectSegment(current, nextChord.id))}>then {nextChord.chord.label}</button>
          ) : null}
        </div>
      ) : null}
      <div className="legend" aria-label="Chord tones">
        <span><i className="swatch tone-root" /> {spelling.root} root</span>
        <span><i className="swatch tone-third" /> {spelling.third} third</span>
        <span><i className="swatch tone-fifth" /> {spelling.fifth} fifth</span>
        <button type="button" className="chip" onClick={() => { unlockAudio(); playTap(planChord(chord.id as ChordId, "chord")); }}>Hear chord</button>
      </div>
      <Neck
        ref={neckRef}
        frets={frets}
        rows={rows}
        stringLabels={displayStrings().map((stringIndex) => openStringLabel(stringIndex))}
        labelMode={session.labelMode}
        marks={marks}
        mutedStrings={editingRhythm ? material.mutedStrings : (grip?.muted ?? [])}
        shapeKeys={grip ? grip.notes.map((note) => `${note.stringIndex}-${note.fret}`) : []}
        moves={intent === "line" ? moves.map((move) => ({ key: `${move.stringIndex}-${move.fret}`, word: move.touch })) : []}
        activeKey={live?.key ?? null}
        heardKey={heardKey}
        onTap={onTap}
        onVisibleFret={(fret) => setSession((current) => (current.firstFret === fret ? current : { ...current, firstFret: fret }))}
      />
      <p className="notice">{moves.length > 0 && intent === "line" ? moves.map((move) => move.line).join("  ·  ") : session.notice}</p>
      <section className="score">
        <div className="score-switch">
          <button type="button" className={intent === "together" ? "chip chip-on" : "chip"} onClick={() => setIntent("together")}>Together</button>
          <button type="button" className={intent === "line" ? "chip chip-on" : "chip"} onClick={() => setIntent("line")}>In order</button>
        </div>
        <div className="score-notes">
          {intent === "line" ? phrase.map((event) => (
            <button
              key={event.id}
              type="button"
              className={session.selectedLeadId === event.id ? "token token-on" : "token"}
              onClick={() => {
                if (session.selectedLeadId === event.id) {
                  const touch = event.touch ?? "pick";
                  const next = touches[(touches.indexOf(touch) + 1) % touches.length];
                  setSession((current) => setLeadTouch(current, event.id, next));
                  return;
                }
                setSession((current) => ({ ...current, selectedLeadId: event.id }));
              }}
            >
              <span>{noteName(event.note.midi).replace(/[0-9-]/g, "")}</span>
              <span className="touch">{event.touch ?? "pick"}</span>
            </button>
          )) : material.notes.map((note) => (
            <span key={`${note.stringIndex}-${note.fret}`} className="token">{noteName(note.midi).replace(/[0-9-]/g, "")}</span>
          ))}
        </div>
        <button type="button" className="play" onClick={() => {
          unlockAudio();
          const current = sessionRef.current;
          setSession(pause(current));
          if (intent === "together") {
            const notes = draftMaterial(current).notes;
            const source = notes.length > 0 ? notes : (grip?.notes.map((note) => placeNote(standardTuning, defaultNeck, note)) ?? []);
            playTap(planVoices({ gesture: source, mode: "solo", chordId: chord.id as ChordId, idPrefix: "together", durationSeconds: 1.5 }));
            return;
          }
          playTap(planPhrase(phraseInBar(current).map((event) => ({ note: event.note, touch: event.touch }))));
        }}>Play</button>
      </section>
      <section className="dock">
        <div className="jumps">
          <span className="hint">Drag or pinch</span>
          {positionJumps.map((fret) => (
            <button key={fret} type="button" className={session.firstFret === fret ? "chip chip-on" : "chip"} onClick={() => { setSession((current) => ({ ...current, firstFret: fret })); neckRef.current?.scrollToFret(fret); }}>
              {fret === 0 ? "Open" : fret}
            </button>
          ))}
          {(["markers", "names", "intervals"] as const).map((mode) => (
            <button key={mode} type="button" className={session.labelMode === mode ? "chip chip-on" : "chip"} onClick={() => setSession((current) => ({ ...current, labelMode: mode }))}>
              {mode === "markers" ? "Dots" : mode === "names" ? "Names" : "Intervals"}
            </button>
          ))}
        </div>
        {session.workspace === "compare" ? (
          <div className="dock-row">
            <button type="button" className={session.compareView === "reference" ? "chip chip-on grow" : "chip grow"} onClick={() => setSession((current) => setCompareView(current, "reference"))}>Chord map</button>
            <button type="button" className={session.compareView === "yours" ? "chip chip-on grow" : "chip grow"} onClick={() => setSession((current) => setCompareView(current, "yours"))}>Your part</button>
          </div>
        ) : null}
        {session.workspace !== "yours" || session.yoursMode === "explore" ? (
          <div className="dock-row">
            <button type="button" className="chip" onClick={() => setSession((current) => ({ ...current, auditionMode: current.auditionMode === "solo" ? "in-context" : "solo" }))}>
              {session.auditionMode === "solo" ? "Solo" : "With chord"}
            </button>
          </div>
        ) : null}
        {editingRhythm ? (
          <>
            <div className="dock-row">
              {strings.map((row) => (
                <button key={row.stringIndex} type="button" className="string" onClick={() => setSession((current) => muteDraftString(current, row.stringIndex))}>
                  <span>{row.label}</span>
                  <span className="text-xs text-muted">{row.state}</span>
                </button>
              ))}
            </div>
            <div className="dock-row">
              <button type="button" className="chip" onClick={() => { unlockAudio(); playTap(planVoices({ gesture: material.notes, mode: session.auditionMode, chordId: chord.id as ChordId, idPrefix: "draft" })); }}>Hear</button>
              <button type="button" className="play" onClick={() => setSession((current) => commitDraft(current))}>Use on {chord.label}</button>
              <button type="button" className="chip" onClick={() => setSession((current) => removeRhythm(current))}>Remove</button>
            </div>
            <p className="hint">{playabilityLabel(material.playability, material.notes.length)}</p>
          </>
        ) : null}
        {editingLead ? (
          <>
            <p className="hint">{chord.label} · {formatInsertion(session.cursorBeat, length)} · {session.leadDuration === 1 ? "quarter" : "eighth"}</p>
            <div className="dock-row">
              {slots.map((slot) => (
                <button key={slot.beat} type="button" className={`slot ${Math.abs(session.cursorBeat - slot.beat) < 1e-6 ? "chip-on" : ""} ${slot.kind === "note" ? "slot-note" : ""}`} onClick={() => setSession((current) => focusLeadSlot(current, slot.beat))}>
                  <span className="text-xs text-muted">{slot.label}</span>
                  <span className="text-xs font-bold">{slot.caption}</span>
                </button>
              ))}
            </div>
            <div className="dock-row">
              <button type="button" className="chip" onClick={() => setSession((current) => setLeadDuration(current, current.leadDuration === 1 ? 0.5 : 1))}>{session.leadDuration === 1 ? "Quarter" : "Eighth"}</button>
              <button type="button" className="chip" onClick={() => setSession((current) => insertLead(current, null))}>Rest</button>
              <button type="button" className={replaceArmed ? "chip chip-on" : "chip"} onClick={() => setReplaceArmed(true)}>{replaceArmed ? "Tap a fret" : "Replace"}</button>
              <button type="button" className="chip" onClick={() => setSession((current) => deleteSelectedLead(current))}>Delete</button>
            </div>
          </>
        ) : null}
        <div className="dock-row">
          <button type="button" className="chip" onClick={() => { unlockAudio(); const current = sessionRef.current; setSession(pause(current)); playTap(planArrangement(current.arrangement, current.timeline, current.beat)); }}>Hear yours</button>
          <button type="button" className="chip" onClick={() => setSession((current) => undo(current))}>Undo</button>
          <button type="button" className="chip" onClick={() => setSession((current) => redo(current))}>Redo</button>
          <button type="button" className="chip" onClick={save}>Save</button>
          <button type="button" className="chip" onClick={reopen}>Open</button>
        </div>
      </section>
    </main>
  );
}
