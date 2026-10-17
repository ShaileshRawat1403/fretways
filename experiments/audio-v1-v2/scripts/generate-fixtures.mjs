import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "assets", "fixtures");
mkdirSync(outDir, { recursive: true });

const sampleRate = 44100;
const durationSeconds = 1;
const frequencyHz = 440;
const amplitude = 0.5;
const frameCount = sampleRate * durationSeconds;

const pcm = Buffer.alloc(44 + frameCount * 2);
pcm.write("RIFF", 0);
pcm.writeUInt32LE(36 + frameCount * 2, 4);
pcm.write("WAVE", 8);
pcm.write("fmt ", 12);
pcm.writeUInt32LE(16, 16);
pcm.writeUInt16LE(1, 20);
pcm.writeUInt16LE(1, 22);
pcm.writeUInt32LE(sampleRate, 24);
pcm.writeUInt32LE(sampleRate * 2, 28);
pcm.writeUInt16LE(2, 32);
pcm.writeUInt16LE(16, 34);
pcm.write("data", 36);
pcm.writeUInt32LE(frameCount * 2, 40);

for (let i = 0; i < frameCount; i += 1) {
  const sample = Math.sin((2 * Math.PI * frequencyHz * i) / sampleRate) * amplitude;
  const value = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
  pcm.writeInt16LE(value, 44 + i * 2);
}

const wavPath = join(outDir, "tone.wav");
const mp3Path = join(outDir, "tone.mp3");
const m4aPath = join(outDir, "tone.m4a");
writeFileSync(wavPath, pcm);

execFileSync(
  "ffmpeg",
  ["-y", "-i", wavPath, "-codec:a", "libmp3lame", "-qscale:a", "5", mp3Path],
  { stdio: "inherit" },
);
execFileSync(
  "ffmpeg",
  ["-y", "-i", wavPath, "-codec:a", "aac", "-b:a", "96k", m4aPath],
  { stdio: "inherit" },
);

const expected = {
  note: "Locally generated 440 Hz sine. Not taken from a recording.",
  sampleRate,
  durationSeconds,
  frequencyHz,
  amplitude,
  channels: 1,
  files: ["tone.wav", "tone.mp3", "tone.m4a"],
  compareTolerances: {
    durationSeconds: 0.08,
    estimatedHz: 20,
    minimumPeak: 0.05,
  },
};

writeFileSync(join(outDir, "EXPECTED.json"), `${JSON.stringify(expected, null, 2)}\n`);
console.log("Wrote tone.wav, tone.mp3, tone.m4a, EXPECTED.json");
