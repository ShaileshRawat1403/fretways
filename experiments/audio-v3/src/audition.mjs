export const SAMPLE_RATE = 44100;
export const BPM = 60;
export const BEATS_PER_BAR = 4;
export const BEAT_SECONDS = 60 / BPM;
export const FADE_SECONDS = 0.01;
export const MELODY_AMPLITUDE = 0.35;
export const HARMONY_TONE_AMPLITUDE = 0.1;

function hz(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

export const TIMELINE = {
  meter: "4/4",
  bpm: BPM,
  beatSeconds: BEAT_SECONDS,
  cMajorBeats: 4,
  gMajorStartSeconds: 4,
  melody: [
    { name: "E4", midi: 64, startBeat: 0, beats: 1 },
    { name: "D4", midi: 62, startBeat: 1, beats: 1 },
    { name: "C4", midi: 60, startBeat: 2, beats: 1 },
    { name: "B3", midi: 59, startBeat: 4, beats: 1 },
  ],
  harmony: [
    {
      name: "C major",
      startBeat: 0,
      beats: 4,
      tones: [
        { name: "C3", midi: 48 },
        { name: "E3", midi: 52 },
        { name: "G3", midi: 55 },
      ],
    },
    {
      name: "G major",
      startBeat: 4,
      beats: 1,
      tones: [
        { name: "G2", midi: 43 },
        { name: "B2", midi: 47 },
        { name: "D3", midi: 50 },
      ],
    },
  ],
};

export function toneHz(midi) {
  return hz(midi);
}

export function totalSeconds() {
  return 5 * BEAT_SECONDS;
}

export function totalFrames() {
  return Math.round(totalSeconds() * SAMPLE_RATE);
}

function tonesFor(mode) {
  const tones = [];
  if (mode !== "harmony") {
    for (const note of TIMELINE.melody) {
      tones.push({
        name: note.name,
        hz: hz(note.midi),
        start: note.startBeat * BEAT_SECONDS,
        duration: note.beats * BEAT_SECONDS,
        amplitude: MELODY_AMPLITUDE,
      });
    }
  }
  if (mode !== "melody") {
    for (const chord of TIMELINE.harmony) {
      for (const tone of chord.tones) {
        tones.push({
          name: `${chord.name} ${tone.name}`,
          hz: hz(tone.midi),
          start: chord.startBeat * BEAT_SECONDS,
          duration: chord.beats * BEAT_SECONDS,
          amplitude: HARMONY_TONE_AMPLITUDE,
        });
      }
    }
  }
  return tones;
}

export function scheduledTones(mode) {
  return tonesFor(mode);
}

function writeTone(target, targetStart, tone) {
  const length = Math.round(tone.duration * SAMPLE_RATE);
  const fade = Math.round(FADE_SECONDS * SAMPLE_RATE);
  for (let i = 0; i < length; i += 1) {
    let envelope = 1;
    if (fade > 0 && i < fade) envelope = i / fade;
    if (fade > 0 && i >= length - fade) envelope = Math.min(envelope, (length - i) / fade);
    const sample = Math.sin((2 * Math.PI * tone.hz * i) / SAMPLE_RATE) * tone.amplitude * envelope;
    target[targetStart + i] += sample;
  }
}

export function renderTone(tone) {
  const chunk = new Float32Array(Math.round(tone.duration * SAMPLE_RATE));
  writeTone(chunk, 0, tone);
  return chunk;
}

export function renderPcm(mode) {
  const output = new Float32Array(totalFrames());
  for (const tone of tonesFor(mode)) {
    writeTone(output, Math.round(tone.start * SAMPLE_RATE), tone);
  }
  return output;
}

function goertzelPower(samples, start, end, frequency) {
  const omega = (2 * Math.PI * frequency) / SAMPLE_RATE;
  const coefficient = 2 * Math.cos(omega);
  let previous = 0;
  let beforePrevious = 0;
  for (let i = start; i < end; i += 1) {
    const next = samples[i] + coefficient * previous - beforePrevious;
    beforePrevious = previous;
    previous = next;
  }
  return previous * previous + beforePrevious * beforePrevious - coefficient * previous * beforePrevious;
}

function estimateHz(samples, start, end) {
  let crossings = 0;
  for (let i = start + 1; i < end; i += 1) {
    const previous = samples[i - 1];
    const current = samples[i];
    if ((previous <= 0 && current > 0) || (previous >= 0 && current < 0)) crossings += 1;
  }
  const seconds = (end - start) / SAMPLE_RATE;
  return crossings / 2 / seconds;
}

function region(startSecond, endSecond) {
  return [Math.round(startSecond * SAMPLE_RATE), Math.round(endSecond * SAMPLE_RATE)];
}

function peakIn(samples, start, end) {
  let peak = 0;
  for (let i = start; i < end; i += 1) {
    const value = Math.abs(samples[i]);
    if (value > peak) peak = value;
  }
  return peak;
}

function check(name, pass, detail) {
  return { name, pass, detail };
}

export function measureRenders(renders) {
  const melody = renders.melody;
  const harmony = renders.harmony;
  const combined = renders.combined;
  const checks = [];

  for (const note of TIMELINE.melody) {
    const start = note.startBeat * BEAT_SECONDS;
    const end = start + note.beats * BEAT_SECONDS;
    const [fullStart, fullEnd] = region(start, end);
    const [steadyStart, steadyEnd] = region(start + 0.05, end - 0.05);
    const measuredHz = estimateHz(melody, steadyStart, steadyEnd);
    const expectedHz = hz(note.midi);
    checks.push(
      check(
        `${note.name} pitch`,
        Math.abs(measuredHz - expectedHz) <= 1,
        `${measuredHz.toFixed(2)} Hz, expected ${expectedHz.toFixed(2)} Hz`,
      ),
    );
    let onset = fullStart;
    while (onset < fullEnd && Math.abs(melody[onset]) <= 0.002) onset += 1;
    checks.push(
      check(
        `${note.name} onset`,
        Math.abs(onset / SAMPLE_RATE - start) <= 0.005,
        `${(onset / SAMPLE_RATE).toFixed(4)} s, expected ${start.toFixed(1)} s`,
      ),
    );
    let last = fullEnd - 1;
    while (last > onset && Math.abs(melody[last]) <= 0.002) last -= 1;
    const duration = (last - onset + 1) / SAMPLE_RATE;
    checks.push(
      check(
        `${note.name} duration`,
        Math.abs(duration - note.beats * BEAT_SECONDS) <= 0.02,
        `${duration.toFixed(4)} s`,
      ),
    );
  }

  const [restStart, restEnd] = region(3, 4);
  checks.push(
    check(
      "one-beat rest is silent",
      peakIn(melody, restStart, restEnd) < 0.0001,
      `melody peak ${peakIn(melody, restStart, restEnd).toExponential(2)}`,
    ),
  );

  const [cStart, cEnd] = region(0.5, 3.5);
  const [gStart, gEnd] = region(4.05, 4.95);
  for (const tone of TIMELINE.harmony[0].tones) {
    const frequency = hz(tone.midi);
    const active = goertzelPower(harmony, cStart, cEnd, frequency);
    const inactive = goertzelPower(harmony, gStart, gEnd, frequency);
    checks.push(
      check(
        `${tone.name} belongs to C major`,
        active > inactive * 20,
        `active ${active.toExponential(3)}, later ${inactive.toExponential(3)}`,
      ),
    );
  }
  for (const tone of TIMELINE.harmony[1].tones) {
    const frequency = hz(tone.midi);
    const active = goertzelPower(harmony, gStart, gEnd, frequency);
    const inactive = goertzelPower(harmony, cStart, cEnd, frequency);
    checks.push(
      check(
        `${tone.name} belongs to G major`,
        active > inactive * 20 && inactive < active * 0.05,
        `at G ${active.toExponential(3)}, during C ${inactive.toExponential(3)}`,
      ),
    );
  }

  let maxDifference = 0;
  let combinedPeak = 0;
  for (let i = 0; i < combined.length; i += 1) {
    const difference = Math.abs(combined[i] - (melody[i] + harmony[i]));
    if (difference > maxDifference) maxDifference = difference;
    const value = Math.abs(combined[i]);
    if (value > combinedPeak) combinedPeak = value;
  }
  checks.push(
    check(
      "combined matches one timeline",
      maxDifference < 0.000001,
      `max sample difference ${maxDifference.toExponential(2)}`,
    ),
  );
  checks.push(
    check(
      "combined does not clip",
      combinedPeak < 0.99,
      `peak ${combinedPeak.toFixed(4)}`,
    ),
  );

  const g2 = hz(43);
  const beforeG = goertzelPower(combined, cStart, cEnd, g2);
  const atG = goertzelPower(combined, gStart, gEnd, g2);
  checks.push(
    check(
      "G starts at 4.0 seconds",
      atG > beforeG * 20,
      `G2 during C ${beforeG.toExponential(3)}, G2 during G ${atG.toExponential(3)}`,
    ),
  );

  const b3 = hz(59);
  const [bStart, bEnd] = region(4.05, 4.95);
  const [beforeBStart, beforeBEnd] = region(0.5, 3.5);
  const bDuring = goertzelPower(combined, bStart, bEnd, b3);
  const bBefore = goertzelPower(combined, beforeBStart, beforeBEnd, b3);
  checks.push(
    check(
      "B3 resolves with G",
      bDuring > bBefore * 20,
      `B3 before 4.0 ${bBefore.toExponential(3)}, B3 over G ${bDuring.toExponential(3)}`,
    ),
  );

  return {
    pass: checks.every((item) => item.pass),
    sampleRate: SAMPLE_RATE,
    seconds: totalSeconds(),
    checks,
  };
}

export function measurePcm() {
  return measureRenders({
    melody: renderPcm("melody"),
    harmony: renderPcm("harmony"),
    combined: renderPcm("combined"),
  });
}
