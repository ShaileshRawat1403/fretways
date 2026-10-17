# FretWays Reference

Increment 3. One portrait neck for the manual progression C, G, Am, F.

The music package decides every pitch and chord tone. The screen does not keep its own fret table. Solo and With chord use the Increment 2 scheduler: one shared start time, and matching MIDI pitches stay separate voices inside that audition.

A new tap stops the previous audition so the neck stays clear. That does not merge the note with the synthesized chord.

There is no transport. Moving the neck does not change the selected chord.

## Checks without a phone

```sh
cd apps/reference
npm test
npm run typecheck
```

## Android

On the Mac, from this directory, with the iQOO Neo 6:

```sh
npm ci
npm test
npx expo prebuild --platform android --no-install
npm run assert-flags
npm run android
```

Stop if the flags are missing or ADB is unauthorized.

On the phone: choose G, swipe and jump along the neck, tap both B3s, tap a note that is not in G, and listen in Solo and With chord. With chord is synthesized. It is not the original recording. Write a listening note. Schedule numbers are still not speaker latency.

## Out of scope

Yours, Compare, Rhythm, Lead, saving, suggestions, recognition, and microphone input.
