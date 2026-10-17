# @fretways/music

Increment 1 of the FretWays musical domain. Pure TypeScript. No interface, no audio, and no persistence.

Events keep their own identity, string, fret, and timing when two positions share a MIDI pitch. This package does not decide whether those notes replace each other in the speakers. That policy belongs to a later audio adapter.

Android tap-to-sound latency and internal schedule time are also later measurements. They are not the same number, and neither is measured here.

Source imports omit the `.ts` suffix so the React Native bundler can load this package. The test runner adds that suffix.