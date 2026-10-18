# @fretways/music

Increment 1 of the FretWays musical domain. Pure TypeScript. No interface, no audio, and no persistence.

A rhythm voicing can also mute strings. A muted string is not a sounding note, and it cannot be fretted in the same voicing.

Android tap-to-sound latency and internal schedule time are also later measurements. They are not the same number, and neither is measured here.

Source imports omit the `.ts` suffix so the React Native bundler can load this package. The test runner adds that suffix.