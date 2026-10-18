# FretWays Reference Application Evidence Directory

This directory contains independent physical Android validation evidence for the **FretWays Phase 1 Increment 3 Reference** implementation (`apps/reference`) evaluated on an authorized physical **iQOO Neo 6** (`I2202`, Android 14), covering both the initial reference commit (`124300c`) and the post-patch UI correction commit (`dfb2363`).

## Contents

- **`VALIDATION_REPORT.md`**: Complete, formal validation report detailing static checks, Android build verification, status-bar inset, string row keys, fretboard layout checks, musical accuracy, dual B3 cell preservation, neck navigation, chromatic interval modes, audio behavior, usability analysis, and resolved issues.
- **`screenshots/`**: Captured screenshots from the physical device during validation.

## Post-Patch Acceptance Screenshots (Commit `dfb2363`)

1. **Clean G Major Fretboard (Status-Bar Inset & Zero Warnings):**  
   [`screenshots/20-postpatch-g-major-fretboard.png`](./screenshots/20-postpatch-g-major-fretboard.png)  
   Demonstrates complete status-bar clearance (heading padded cleanly below clock, notifications, and battery indicator), both visible E-string labels (`E` at top, `E` at bottom), eight highlighted G-major chord positions, and zero React key warnings or warning toasts.

2. **Chromatic Interval Mode:**  
   [`screenshots/21-postpatch-intervals-mode.png`](./screenshots/21-postpatch-intervals-mode.png)  
   Demonstrates full chromatic interval labeling across all twelve degrees calculated from the root (`R`, `m2`, `M2`, `m3`, `M3`, `P4`, `TT`, `P5`, `m6`, `M6`, `m7`, `M7`), with colored badges on chord tones (`R`, `M3`, `P5`) and quiet interval text on non-chord notes.

3. **Pitch Names Mode:**  
   [`screenshots/22-postpatch-names-mode.png`](./screenshots/22-postpatch-names-mode.png)  
   Demonstrates note pitch names on all fretboard cells with harmonic role badges on chord tones.

## Historical Pre-Patch Screenshots (Commit `124300c`)

Preserved for audit trail and regression tracking:
- `01-main-screen-c-major.png`: Initial launch state with C major selected.
- `02-g-major-clean.png`: Pre-patch G major frets 0–4 layout baseline.
- `03-chord-c-major.png`, `04-chord-a-minor.png`, `05-chord-f-major.png`: Chord switching verification across C, Am, and F.
- `06-jump-5.png`, `07-jump-7.png`: Position jumps 5 and 7.
- `08-jump-12.png`: Position jump 12 (frets 12–16).
- `09-jump-20.png`: Position jump 20 reaching the 24-fret neck limit (frets 20–24).
- `10-swipe-left-fret-6.png`, `11-swipe-right-back-to-5.png`: Fretboard swipe gesture navigation.
- `12-label-mode-names.png`: Pre-patch names mode.
- `13-label-mode-intervals.png`: Pre-patch intervals mode.
- `14-non-chord-e4-selected.png`: Non-chord tone E4 outside G chord.
- `15-solo-b3-string2.png`, `16-solo-b3-string3.png`: Dual B3 verification (Open B3 vs. G-string fret 4 B3).
- `17-g2-root.png`, `18-g3-root.png`, `19-g4-root.png`: G root octave positions across strings 6, 3, and 1.

## Summary Status

- **Static & Build Verification:** **PASSED** (8/8 Reference tests, 13/13 music domain tests, 0 TS errors)
- **Status-Bar Inset & Clearance:** **PASSED** (Heading Y=108 px, completely below system icons)
- **React Row Keys:** **PASSED** (Unique keys `string-5`..`string-0`, zero duplicate key warnings)
- **Physical Layout & Musical Accuracy:** **PASSED**
- **Chromatic Interval Map:** **PASSED** (`R`, `m2`, `M2`, `m3`, `M3`, `P4`, `TT`, `P5`, `m6`, `M6`, `m7`, `M7`)
- **Neck Navigation & Clamping:** **PASSED**
- **Android Audio Graph & Retriggering:** **PASSED**
- **Human Acoustic Listening:** **PENDING** (Awaiting physical ear audition by product owner)
- **Guitarist Usability Acceptance:** **PENDING** (Awaiting personal verification by product owner)
- **Commercial Licensing:** **OPEN**
