import type { ChordSymbol, PitchClass } from "@/lib/music";

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export type HeardChord = {
  root: PitchClass;
  quality: "major" | "minor";
  label: string;
  id: string;
  confidence: number;
};

export type ChartPoint = {
  chord: HeardChord;
  symbol: ChordSymbol;
  midi: number | null;
  start: number;
};

function template(root: number, quality: "major" | "minor"): number[] {
  const values = Array.from({ length: 12 }, () => 0);
  values[root] = 1;
  values[(root + (quality === "major" ? 4 : 3)) % 12] = 0.85;
  values[(root + 7) % 12] = 0.9;
  return values;
}

function cosine(left: number[], right: number[]): number {
  let dot = 0;
  let leftEnergy = 0;
  let rightEnergy = 0;
  for (let index = 0; index < 12; index += 1) {
    dot += left[index] * right[index];
    leftEnergy += left[index] * left[index];
    rightEnergy += right[index] * right[index];
  }
  if (leftEnergy === 0 || rightEnergy === 0) return 0;
  return dot / Math.sqrt(leftEnergy * rightEnergy);
}

export function matchChord(chroma: number[]): HeardChord | null {
  let best: HeardChord | null = null;
  for (let root = 0; root < 12; root += 1) {
    for (const quality of ["major", "minor"] as const) {
      const confidence = cosine(chroma, template(root, quality));
      if (!best || confidence > best.confidence) {
        const name = NAMES[root].toLowerCase().replace("#", "s");
        best = {
          root: root as PitchClass,
          quality,
          label: quality === "minor" ? `${NAMES[root]}m` : NAMES[root],
          id: `${name}-${quality}`,
          confidence,
        };
      }
    }
  }
  if (!best || best.confidence < 0.7) return null;
  return best;
}

export function toSymbol(chord: HeardChord): ChordSymbol {
  return { id: chord.id, root: chord.root, quality: chord.quality, label: chord.label };
}

export function chromaFromSpectrum(bins: Float32Array, sampleRate: number): { chroma: number[]; peakMidi: number | null } {
  const chroma = Array.from({ length: 12 }, () => 0);
  let peakDb = -120;
  let peakHz = 0;
  const fftSize = bins.length * 2;
  for (let index = 2; index < bins.length; index += 1) {
    const db = bins[index];
    if (db < -82) continue;
    const hz = (index * sampleRate) / fftSize;
    if (hz < 70 || hz > 2200) continue;
    const magnitude = 10 ** (db / 20);
    const midi = 69 + 12 * Math.log2(hz / 440);
    const pitchClass = ((Math.round(midi) % 12) + 12) % 12;
    chroma[pitchClass] += magnitude * (hz < 350 ? 1.35 : 1);
    if (db > peakDb && hz > 150 && hz < 900) {
      peakDb = db;
      peakHz = hz;
    }
  }
  const energy = chroma.reduce((sum, value) => sum + value, 0) || 1;
  return {
    chroma: chroma.map((value) => value / energy),
    peakMidi: peakHz > 0 ? Math.round(69 + 12 * Math.log2(peakHz / 440)) : null,
  };
}

function goertzel(samples: Float32Array, sampleRate: number, frequency: number): number {
  const count = samples.length;
  const omega = (2 * Math.PI * frequency) / sampleRate;
  const coefficient = 2 * Math.cos(omega);
  let previous = 0;
  let prior = 0;
  for (let index = 0; index < count; index += 1) {
    const next = samples[index] + coefficient * previous - prior;
    prior = previous;
    previous = next;
  }
  return previous * previous + prior * prior - coefficient * previous * prior;
}

export async function analyzeBuffer(buffer: AudioBuffer, onProgress?: (ratio: number) => void): Promise<ChartPoint[]> {
  const rate = 4000;
  const step = Math.max(1, Math.round(buffer.sampleRate / rate));
  const channel = buffer.getChannelData(0);
  const samples = new Float32Array(Math.floor(channel.length / step));
  for (let index = 0; index < samples.length; index += 1) samples[index] = channel[index * step];
  const window = Math.floor(rate * 0.45);
  const hop = Math.floor(rate * 0.3);
  const points: ChartPoint[] = [];
  const total = Math.max(1, Math.ceil((samples.length - window) / hop));
  let seen = 0;
  for (let start = 0; start + window < samples.length; start += hop) {
    const slice = samples.subarray(start, start + window);
    const chroma = Array.from({ length: 12 }, () => 0);
    let strongest = 0;
    let melody = 0;
    for (let midi = 40; midi <= 84; midi += 1) {
      const power = goertzel(slice, rate, 440 * 2 ** ((midi - 69) / 12));
      chroma[midi % 12] += power;
      if (midi >= 55 && midi <= 79 && power > strongest) {
        strongest = power;
        melody = midi;
      }
    }
    const energy = chroma.reduce((sum, value) => sum + value, 0) || 1;
    const chord = matchChord(chroma.map((value) => value / energy));
    if (chord) {
      const last = points[points.length - 1];
      const at = start / rate;
      if (last && last.chord.id === chord.id) {
        last.chord = chord;
        if (melody) last.midi = melody;
      } else {
        points.push({ chord, symbol: toSymbol(chord), midi: melody || null, start: at });
      }
    }
    seen += 1;
    if (seen % 6 === 0) {
      onProgress?.(seen / total);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  onProgress?.(1);
  return points;
}

export function youtubeId(input: string): string | null {
  try {
    const url = new URL(input.trim());
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id && /^[\w-]{6,}$/.test(id) ? id : null;
    }
    if (url.hostname.includes("youtube.com")) {
      const id = url.searchParams.get("v") ?? url.pathname.split("/").filter(Boolean).at(-1) ?? "";
      return /^[\w-]{6,}$/.test(id) ? id : null;
    }
  } catch {
    return null;
  }
  return null;
}

export function spotifyPath(input: string): string | null {
  try {
    const url = new URL(input.trim());
    if (!url.hostname.includes("spotify.com")) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    const kind = parts[0] === "embed" ? parts[1] : parts[0];
    const id = parts[0] === "embed" ? parts[2] : parts[1];
    if (!kind || !id || !/^[A-Za-z0-9]+$/.test(id)) return null;
    if (kind !== "track" && kind !== "album" && kind !== "playlist") return null;
    return `${kind}/${id}`;
  } catch {
    return null;
  }
}
