# FretWays Reference Application Evidence Directory

This directory contains independent physical Android validation evidence for the **FretWays Phase 1 Increment 3 Reference** implementation (`apps/reference`) evaluated on an authorized physical **iQOO Neo 6** (`I2202`, Android 14).

## Contents

- **`VALIDATION_REPORT.md`**: Complete, formal validation report detailing static checks, Android build verification, fretboard layout checks, musical accuracy, dual B3 cell preservation, neck navigation, label modes, audio behavior, usability analysis, and documented defects.
- **`screenshots/`**: Captured screenshots from the physical device during validation.

## Key Screenshots

The four primary required validation states are captured below:

1. **G Major Frets 0–4 (Visual Layout & Harmonic Positions):**  
   [`screenshots/02-g-major-clean.png`](./screenshots/02-g-major-clean.png)  
   Displays all six strings (high e at top, low E at bottom), 5-fret visible window (frets 0–4), and the eight highlighted G-major harmonic positions with distinct Root (Gold), Third (Sage Green), and Fifth (Slate Blue) roles.

2. **Neck Shifted to Higher Fret Region (Frets 12–16 & Frets 20–24):**  
   [`screenshots/08-jump-12.png`](./screenshots/08-jump-12.png) (Jump 12)  
   [`screenshots/09-jump-20.png`](./screenshots/09-jump-20.png) (Jump 20)  
   Demonstrates neck navigation via position jumps, reaching the end of the 24-fret neck with strict boundary clamping.

3. **Label Modes (Names & Intervals):**  
   [`screenshots/12-label-mode-names.png`](./screenshots/12-label-mode-names.png) (Names mode)  
   [`screenshots/13-label-mode-intervals.png`](./screenshots/13-label-mode-intervals.png) (Intervals mode)  
   Demonstrates note names (`G`, `B`, `D`, `F#`, etc.) across all fret cells and interval numerals (`R`, `3`, `5`) on chord tones.

4. **Non-Chord Tone Selection:**  
   [`screenshots/14-non-chord-e4-selected.png`](./screenshots/14-non-chord-e4-selected.png)  
   Displays selection of String 1 fret 0 (E4) outside the G major chord, displaying status `String 1 · fret 0 · E4 · outside the chord` with an active selection ring.

### Supporting Screenshots
- `01-main-screen-c-major.png`: Initial launch state with C major selected.
- `03-chord-c-major.png`, `04-chord-a-minor.png`, `05-chord-f-major.png`: Chord switching verification across C, Am, and F.
- `06-jump-5.png`, `07-jump-7.png`: Position jumps 5 and 7.
- `10-swipe-left-fret-6.png`, `11-swipe-right-back-to-5.png`: Fretboard swipe gesture navigation.
- `15-solo-b3-string2.png`, `16-solo-b3-string3.png`: Dual B3 verification (Open B3 vs. G-string fret 4 B3).
- `17-g2-root.png`, `18-g3-root.png`, `19-g4-root.png`: G root octave positions across strings 6, 3, and 1.

## Summary Status

- **Static & Build Verification:** **PASSED**
- **Physical Layout & Musical Accuracy:** **PASSED**
- **Neck Navigation & Clamping:** **PASSED**
- **Android Audio Graph & Retriggering:** **PASSED**
- **Human Listening:** **PENDING** (Awaiting physical ear audition by product owner)
- **Commercial Licensing:** **OPEN**
