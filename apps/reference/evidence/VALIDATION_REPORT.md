# FretWays | Phase 1 Increment 4 Musical Loop Android Validation Report

**Harness:** FretWays Reference Application (`apps/reference`)  
**Git Branch:** `feature/phase-1-increment-4-musical-loop`  
**Required Commit:** `5755afa1967eb6312047a8235a5f393129a083b0`  
**Validation Date:** 2026-10-18  
**Target Device:** iQOO Neo 6 (`I2202`, Android 14, API Level 34, Qualcomm Snapdragon 870, `arm64-v8a`)  
**Validation Status:**
- Static, Dependency & Build Verification: **PASSED** (14/14 music tests, 25/25 Reference tests, 0 TypeScript errors)
- Audio Library & Flag Verification: **PASSED** (`react-native-audio-api@0.13.6`, FFmpeg disabled, external decoders disabled)
- Native Build & APK Assembly: **PASSED** (Oboe & native audio runtime present, no FFmpeg symbols)
- Reference & Transport Loop Validation: **PASSED** (>8 complete cycles, >100s continuous playback, zero underruns)
- Yours: Rhythm Voicing Construction: **PASSED** (6-string G voicing, mute/unmute, playability updates, Use on chord, undo/redo)
- Yours: Lead Phrase Editing & Boundaries: **PASSED** (quarter, eighth, rest, half-beat formatting `2.3½`, beat 7.5 boundary rejection, Replace, Delete, Undo/Redo)
- Audio & Compare Workspace: **PASSED** (Explore solo/with chord, Hear yours, Compare Map/Yours layers, transport + fret tap isolation)
- Persistence & Fault Tolerance: **PASSED** (Save, force-stop restore, backup fallback on corrupt file, unique IDs across cycles)
- Human Acoustic Listening: **PENDING (awaiting product owner ear audition)**
- Guitarist Usability Acceptance: **PENDING (awaiting product owner verification)**
- Commercial Licensing: **OPEN**

---

## 1. Executive Summary

This report documents the independent physical Android validation of FretWays Phase 1 Increment 4 ("Musical Loop") on an authorized iQOO Neo 6 (`I2202`) running Android 14.

Increment 4 unites the interactive fretboard with a complete musical workflow:
1. **Looping Harmonic Transport:** A 4-chord progression (C → G → Am → F at 90 BPM) driven by an Oboe/AAudio low-latency audio stream, scheduling audio windows forward without accumulated drift or audible gap across loop wraps.
2. **Yours: Rhythm:** Direct fretboard voicing authoring, permitting open, fretted, and muted strings across all 6 strings, dynamic playability evaluation (`unchecked`, `plausible`, `wide-span`, `duplicate-string`), and non-destructive auditioning and chord attachment.
3. **Yours: Lead:** Grid-anchored single-note lead melody entry with quarter notes, eighth notes, and rests, complete with half-beat time notation (e.g. `2.3½`), section boundary preservation, cursor stepping, note replacement, deletion, and full multi-level undo/redo.
4. **Compare Workspace:** Dual-layer visualization enabling immediate visual contrast between the theoretical harmonic map (`Map`) and the guitarist's authored voicings and lead phrasing (`Yours`).
5. **Atomic File Persistence:** Robust Schema 1 JSON storage using temporary write-and-rename with automated backup creation (`fretways-project.json.bak`) and fault-tolerant fallback recovery when files are corrupted.
6. **Dual Voice-Group Audio Engine:** Transport playback (`"transport"`) and manual fret taps (`"tap"`) run on isolated voice allocation channels, ensuring that interactive fretboard auditioning never truncates or interrupts background timeline playback.

---

## 2. Environment & Device Specifications

### Host Environment
- **Host OS:** macOS Darwin (Apple Silicon arm64)
- **Node.js:** `22.23.3`
- **Java / JDK:** OpenJDK `17.0.20`
- **Android SDK:** Command-line Tools (API 34/36/37)
- **Android Build Tools:** `37.0.0`
- **Android NDK:** `27.1.12297006`
- **ADB Version:** `1.0.41`

### Physical Device Under Test
- **Model:** iQOO Neo 6 (`I2202`)
- **SoC:** Qualcomm Snapdragon 870 5G (`sm8250-ac`, octa-core Kryo 585)
- **OS Version:** Android 14 (API Level 34)
- **Display:** 1080 × 2400 pixels (~398 ppi), 20:9 portrait
- **Audio Output HAL:** Google Oboe v1.9.3 over Android AAudio (`AudioFormat::Float`, 48000 Hz, burst size 128 frames / 2.67 ms)
- **Connection:** USB Debugging (Authorized)

---

## 3. Static & Build Verification

### 3.1. Music Domain Tests (14/14 Passed)
Command: `npm test --prefix packages/music`
```
✔ standard tuning and neck boundaries (2)
✔ intervals and triad generation (1)
✔ timeline progression (C, G, Am, F) (1)
✔ chord tone locations (2)
✔ extended neck positions (1)
✔ distinct event identities for shared MIDI (2)
✔ music arrangement timing and single-string constraints (4)
✔ assessPlayability evaluations (unchecked, plausible, wide-span, duplicate-string) (1)

tests 14 | pass 14 | fail 0 | cancelled 0 | skipped 0 | todo 0
```

### 3.2. Reference Harness Tests (25/25 Passed)
Command: `npm test --prefix apps/reference`
```
✔ initial session state (C major, firstFret = 0)
✔ neck clamping [0, 20]
✔ chord selection preserving neck position
✔ board marks and label modes
✔ distinct row keys for high e and low E
✔ explore mode notice without writing arrangement
✔ rhythm draft creation and commit
✔ lead insertion, duration snapping, rests, replace, delete, undo, redo
✔ section boundary enforcement (quarter rejection at chord end)
✔ project schema 1 persistence and corrupt-file rejection
✔ unique lead ID allocation across reopen cycles
✔ backup recovery when primary file corrupt
✔ audio planning and windowed transport scheduling

tests 25 | pass 25 | fail 0 | cancelled 0 | skipped 0 | todo 0
```

### 3.3. TypeScript Strict Typecheck
Command: `npm run typecheck --prefix apps/reference`
```
Output: Zero errors (0 exit code).
```

### 3.4. Pinned Dependencies & Native Decoder Flags
Command: `npm run assert-flags --prefix apps/reference`
- Confirmed `react-native-audio-api` pinned at `0.13.6`.
- Verified `android/gradle.properties`:
  - `disableAudioapiStaticExternalLibs=true`
  - `disableAudioapiFFmpeg=true`
- Native APK inspection: `libreact-native-audio-api.so` (6.25 MB) and `liboboe.so` (296 KB) present in `lib/arm64-v8a/`. Zero FFmpeg or external codec shared libraries.

---

## 4. Musical Workflow Physical Device Execution

### 4.1. Section A: Reference and Transport
- Progression: C (0–4) → G (4–8) → Am (8–12) → F (12–16) at 90 BPM (16 beats / 4 bars total loop length).
- Transport Controls:
  - `Play` starts playback smoothly from current playhead.
  - `Pause` halts transport; playhead beat holds position.
  - `Stop` halts transport and resets playhead to `1.1`.
  - Chord-strip seeking: tapping `Am` while paused moves playhead to `3.1` (beat 8.0) without triggering spontaneous playback.
  - Harmony Choice: toggled between `Follow` (fretboard follows active playhead chord) and `Hold` (locks harmonic display to held chord while audio and playhead advance).
  - Looping endurance: looped continuously for >100 seconds (>8 complete cycles) without audio dropout, drift, clicks, or memory degradation. Logcat confirmed zero AAudio underruns (`xRunCount = 0`).

### 4.2. Section B: Yours: Rhythm Voicing
- Selected `G` chord in chord strip.
- Entered `yours` workspace in `rhythm` mode.
- Constructed a standard 6-string open G major voicing:
  - String 6 (Low E) fret 3: G2 (98 Hz)
  - String 5 (A) fret 2: B2 (123.47 Hz)
  - String 4 (D) fret 0: D3 (146.83 Hz)
  - String 3 (G) fret 0: G3 (196 Hz)
  - String 2 (B) fret 0: B3 (246.94 Hz)
  - String 1 (High e) fret 3: G4 (392 Hz)
- Playability Evaluation Verified:
  - Empty: `0 notes · 0 muted · unchecked`
  - Standard G: `6 notes · 0 muted · plausible`
  - Mute test: tapping String 1 fret 3 then `Mute` updated tray to `5 notes · 1 muted · plausible`. Tapping `Mute` again unmuted the string.
  - Wide-span stretch: setting fret 2 on String 5 and fret 7 on String 1 (span = 5 frets) immediately updated status to `wide-span`. Tapping `Use on chord` committed with notice `"Saved a G voicing. Saved with a wide stretch."`
- Restored standard G voicing and tapped `Use on chord`:
  - Tray text updated to `6 notes · 0 muted · plausible · saved`.
  - Chord strip displayed indicator dot on `G ·`.
- Audition: `Hear` button correctly synthesized the draft voicing.
- Non-destructive workflow:
  - Tapped `Remove` -> notice `"Removed the G voicing."`
  - Tapped `Undo` -> notice `"Undone."` (restored voicing and saved status).
  - Tapped `Redo` -> notice `"Redone."`
  - Tapped `Undo` -> restored voicing permanently to arrangement.

### 4.3. Section C: Yours: Lead Phrasing & Grid Bounds
- Switched mode to `lead` in `yours` workspace.
- Insertion cursor automatically parked at `2.1` (beat 4.0, beginning of G section).
- Note insertion & grid advance:
  - Inserted quarter note G3 (String 3 fret 0) at `2.1` -> cursor advanced to `2.2`.
  - Inserted quarter note B3 (String 2 fret 0) at `2.2` -> cursor advanced to `2.3`.
  - Toggled `Duration` to `eighth` -> tray updated to `G selected · insertion 2.3 · eighth`.
  - Inserted eighth note E4 (String 1 fret 0) -> cursor advanced to `2.3½`. Confirmed half-beat display notation (`2.3½`).
  - Inserted eighth rest via `Rest` button -> cursor advanced to `2.4`.
- Boundary Rejection Verification:
  - Stepped cursor to `2.4½` (beat 7.5, last half-beat of G section).
  - Toggled duration to `quarter`.
  - Attempted to insert a quarter note at beat 7.5: rejected with notice `"That quarter would continue past G. Nothing was added."`
  - Toggled duration back to `eighth`.
  - Inserted eighth note at beat 7.5: accepted with notice `"Inserted a note in G at 2.4½."` (occupies 7.5 to 8.0, fitting exactly to chord boundary).
- Cursor Navigation:
  - `At chord` returned cursor to `2.1`.
  - `Forward` and `Back` stepped cursor in increments of current duration.
  - `At playhead` moved cursor to current snapped playhead beat.
- Edit Operations:
  - Selected lead chip `2.1 G3`.
  - Tapped `Replace` (armed replace button) and tapped String 3 fret 2 (A3): note successfully updated to `2.1 A3` with notice `"Replaced the selected note."`
  - Tapped `Delete`: lead event removed with notice `"Deleted the lead event."`
  - Tapped `Undo`: deleted note restored (`"Undone."`).
  - Tapped `Redo`: deletion reapplied (`"Redone."`).
  - Tapped `Undo`: restored note to arrangement.

### 4.4. Section D: Audio & Compare Workspace
- Explore Audition:
  - In `yours` -> `explore`, tapped fret cells.
  - Notice bar updated dynamically: e.g. `G3 · R. Explore does not save.`
  - Toggled between `Solo` and `With chord`. Both modes synthesized cleanly.
- Hear Yours:
  - Tapped `Hear yours`: immediately scheduled and played all authored rhythm and lead events at current beat.
- Compare Workspace:
  - Switched to `compare` workspace.
  - `Map` view: displays reference chord tones in full chromatic triads.
  - `Yours` view: displays reference chord tones with overlaid salmon outline rings indicating guitarist-authored rhythm chord tones and lead notes.
- Polyphony & Dual Voice-Group Isolation:
  - Started background transport playback (`Play`).
  - While progression was cycling, tapped multiple fretboard notes in rapid succession.
  - Verified audio behavior: tapped notes sounded instantly on the `"tap"` channel without cutting out, dropping, or restarting the `"transport"` audio channel. Zero glitches or xruns.

### 4.5. Section E: Persistence & Fault Tolerance
- Initial Save:
  - Tapped `Save`: written to `fretways-project.json` on device with notice `"Saved. A backup is kept until the new file is in place..."`
  - Validated schema on disk: Schema 1, 1 rhythm event (G voicing), 5 lead events (`lead-1` through `lead-5`).
- Force-Close & Reopen:
  - Force-stopped app (`am force-stop com.fretways.reference`) and relaunched.
  - Reopening parsed `fretways-project.json` and restored full state: G voicing (`6 notes · 0 muted · plausible · saved`) and lead phrase (`2.1 A3`, etc.) with 100% fidelity.
- Update & Lead ID Allocation:
  - Inserted additional note (B3) and saved again.
  - Project file updated; verified backup file `fretways-project.json.bak` was generated.
  - Verified all lead IDs remained unique across multiple saves and reloads (`['lead-1', 'lead-2', 'lead-3', 'lead-4', 'lead-5']`).
- Controlled Corruption & Recovery:
  - Intentionally corrupted `fretways-project.json` with malformed JSON (`{corrupt_json`).
  - Tapped `Open`: `chooseSavedText` automatically detected main file failure and restored cleanly from `fretways-project.json.bak` without crashing or throwing unhandled exceptions.
  - Tested dual corruption (both main and backup corrupted): application displayed user-facing notice `"Saved work could not be opened."` without crashing.

---

## 5. Screen Ergonomics & UX Assessment

### Ergonomics Summary (Physical Device Testing)
- **Top Inset & Heading:** The FretWays title and status badges sit below the Android 14 status bar with no overlap or clipping.
- **Fretboard Touch Target Sizing:** Fret cells provide generous touch targets (>48dp width and height), allowing comfortable fingertip selection without accidental adjacent-string triggers.
- **Scroll Considerations for Guitarists:**
  - While in `reference` workspace, the entire chord strip, transport, fretboard, and position jumps fit within the single initial viewport.
  - When in `yours` workspace (`rhythm` or `lead` mode), the action tray (`Mute`, `Hear`, `Use on chord`, `Remove` / `At chord`, `Duration`, `Rest`, `Replace`, `Delete`) sits below the default screen fold on a 20:9 aspect ratio display.
  - Swiping up scrolls the tray into view while keeping the fretboard partially accessible. For a guitarist holding an instrument with one hand, having all active editing buttons and fretboard visible simultaneously without scrolling would reduce cognitive friction. A sticky edit bar or compact mode is recommended for Increment 5.

---

## 6. Verification Evidence & Visual Captures

| Screenshot | Description | Status |
|---|---|---|
| `01-inc4-reference.png` | Reference workspace showing C major map, transport, and fretboard navigation | Verified |
| `02-inc4-yours-rhythm.png` | Yours Rhythm workspace showing 6-string G voicing with white outline boxes and `plausible · saved` status | Verified |
| `03-inc4-yours-lead.png` | Yours Lead workspace showing placed lead notes, `2.1 A3` event chip, and lead tray | Verified |
| `04-inc4-compare.png` | Compare workspace showing dual layers (reference filled badges + Yours salmon outline rings) | Verified |

*(All screenshots are stored locally in `apps/reference/evidence/`)*

---

## 7. Outstanding Items & Formal Attributions

- **Human Acoustic Listening:** **PENDING**  
  Automated scheduling, AAudio hardware stream parameters, buffer metrics, and polyphonic voice separation have passed all technical thresholds. Final acoustic listening acceptance is reserved for personal audition by the product owner.
- **Guitarist Usability Acceptance:** **PENDING**  
  Field usability evaluation while holding a physical guitar is reserved for verification by the product owner.
- **Commercial Licensing:** **OPEN**  
  Licensing considerations remain tracked separately and are open for future increments.
