import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const trailerRoot = path.resolve(__dirname, "..");
const outDir = path.join(trailerRoot, "public", "generated", "audio");
const outPath = path.join(outDir, "hermes-godspeed-score.wav");

const sampleRate = 48000;
const channels = 2;
const durationSeconds = 45;
const totalSamples = sampleRate * durationSeconds;
const left = new Float32Array(totalSamples);
const right = new Float32Array(totalSamples);

const notes = {
  c2: 65.41,
  d2: 73.42,
  e2: 82.41,
  g2: 98.0,
  a2: 110.0,
  b2: 123.47,
  c3: 130.81,
  d3: 146.83,
  e3: 164.81,
  g3: 196.0,
  a3: 220.0,
  b3: 246.94,
  c4: 261.63,
  d4: 293.66,
  e4: 329.63,
  g4: 392.0,
  a4: 440.0,
  b4: 493.88,
  c5: 523.25,
  d5: 587.33,
  e5: 659.25,
  g5: 783.99,
  a5: 880.0,
};

const clamp = (value) => Math.max(-1, Math.min(1, value));
const fract = (value) => value - Math.floor(value);
const sine = (phase) => Math.sin(phase * Math.PI * 2);
const tri = (phase) => 1 - Math.abs(fract(phase) * 4 - 2);
const saw = (phase) => fract(phase) * 2 - 1;
const noise = (seed) => {
  const x = Math.sin(seed * 127.13) * 43758.5453;
  return fract(x) * 2 - 1;
};

const envelope = (age, length, attack = 0.01, release = 0.18) => {
  if (age < 0 || age > length) return 0;
  const attackAmp = Math.min(1, age / attack);
  const releaseAmp = Math.min(1, (length - age) / release);
  return Math.max(0, Math.min(attackAmp, releaseAmp));
};

const addVoice = ({ start, length, freq, gain, pan = 0, wave = "sine", attack = 0.01, release = 0.2, detune = 0 }) => {
  const startSample = Math.max(0, Math.floor(start * sampleRate));
  const endSample = Math.min(totalSamples, Math.floor((start + length) * sampleRate));
  const panLeft = Math.cos((pan + 1) * Math.PI * 0.25);
  const panRight = Math.sin((pan + 1) * Math.PI * 0.25);
  for (let index = startSample; index < endSample; index += 1) {
    const t = index / sampleRate;
    const age = t - start;
    const env = envelope(age, length, attack, release);
    const phase = (age * (freq + detune)) % 1;
    const raw =
      wave === "tri" ? tri(phase) * 2 - 1 : wave === "saw" ? saw(phase) : wave === "pulse" ? (fract(phase) > 0.55 ? 1 : -1) : sine(phase);
    const value = raw * gain * env;
    left[index] += value * panLeft;
    right[index] += value * panRight;
  }
};

const addHit = ({ start, gain = 0.45, tone = 80, noiseAmount = 0.45, length = 0.24 }) => {
  const startSample = Math.floor(start * sampleRate);
  const endSample = Math.min(totalSamples, Math.floor((start + length) * sampleRate));
  for (let index = startSample; index < endSample; index += 1) {
    const t = index / sampleRate;
    const age = t - start;
    const env = Math.exp(-age * 14);
    const tonal = sine(age * tone) * gain * env;
    const grit = noise(index) * noiseAmount * gain * env;
    left[index] += tonal + grit * 0.7;
    right[index] += tonal + grit * 0.55;
  }
};

const addRiser = ({ start, length, from, to, gain = 0.12 }) => {
  const startSample = Math.floor(start * sampleRate);
  const endSample = Math.min(totalSamples, Math.floor((start + length) * sampleRate));
  let phase = 0;
  for (let index = startSample; index < endSample; index += 1) {
    const t = index / sampleRate;
    const age = t - start;
    const progress = age / length;
    const freq = from + (to - from) * progress * progress;
    phase += freq / sampleRate;
    const env = Math.sin(Math.PI * progress);
    const shimmer = (sine(phase) + saw(phase * 1.5) * 0.25 + noise(index) * 0.16) * gain * env;
    left[index] += shimmer * 0.75;
    right[index] += shimmer;
  }
};

const chord = (start, length, frequencies, gain, pan = 0) => {
  frequencies.forEach((freq, i) => {
    addVoice({ start, length, freq, gain: gain / frequencies.length, pan: pan + (i - 1) * 0.18, wave: "tri", attack: 0.08, release: 0.65 });
    addVoice({ start, length, freq: freq * 2, gain: gain / frequencies.length * 0.32, pan: -pan + (i - 1) * 0.12, wave: "saw", attack: 0.12, release: 0.7, detune: 0.8 });
  });
};

const addPattern = (start, end, step, callback) => {
  for (let t = start; t < end; t += step) callback(t, Math.round((t - start) / step));
};

chord(0, 3, [notes.c3, notes.g3, notes.d4], 0.16, -0.2);
chord(3, 5, [notes.d3, notes.a3, notes.e4], 0.13, 0.2);
chord(8, 4, [notes.e3, notes.b3, notes.g4], 0.14, -0.15);
chord(42, 3, [notes.c3, notes.g3, notes.c4, notes.e4], 0.2, 0);
addRiser({ start: 0.2, length: 2.5, from: 220, to: 960, gain: 0.055 });
addRiser({ start: 5.8, length: 2.1, from: 180, to: 1200, gain: 0.075 });
addRiser({ start: 37.5, length: 4.2, from: 160, to: 1600, gain: 0.11 });

const bass = [notes.c2, notes.c2, notes.g2, notes.a2, notes.e2, notes.g2, notes.d2, notes.g2];
addPattern(8, 42, 0.5, (t, i) => {
  const intensity = t > 28 ? 1.12 : 0.92;
  addVoice({ start: t, length: 0.42, freq: bass[i % bass.length], gain: 0.17 * intensity, pan: 0, wave: "saw", attack: 0.006, release: 0.16 });
  if (i % 2 === 0) addHit({ start: t, gain: 0.31 * intensity, tone: 62, noiseAmount: 0.24, length: 0.2 });
});

const lead = [notes.g4, notes.a4, notes.c5, notes.d5, notes.e5, notes.d5, notes.c5, notes.a4];
addPattern(10, 38, 0.5, (t, i) => {
  const active = t < 28 || i % 2 === 0;
  if (!active) return;
  addVoice({ start: t, length: 0.26, freq: lead[i % lead.length], gain: 0.072, pan: i % 2 ? 0.34 : -0.34, wave: "pulse", attack: 0.01, release: 0.09 });
  addVoice({ start: t + 0.01, length: 0.24, freq: lead[i % lead.length] * 2, gain: 0.028, pan: i % 2 ? -0.2 : 0.2, wave: "sine", attack: 0.01, release: 0.08 });
});

addPattern(8, 42, 0.25, (t, i) => {
  const gain = t > 38 ? 0.055 : 0.04;
  const startSample = Math.floor(t * sampleRate);
  const endSample = Math.min(totalSamples, Math.floor((t + 0.08) * sampleRate));
  for (let index = startSample; index < endSample; index += 1) {
    const age = index / sampleRate - t;
    const env = Math.exp(-age * 46);
    const value = noise(index + i * 17) * gain * env;
    left[index] += value * (i % 2 ? 0.55 : 0.9);
    right[index] += value * (i % 2 ? 0.9 : 0.55);
  }
});

[0, 3, 8, 12, 20, 28, 33, 38, 42].forEach((t, index) => {
  addHit({ start: t, gain: index === 0 || t >= 38 ? 0.66 : 0.52, tone: t >= 38 ? 52 : 72, noiseAmount: 0.34, length: 0.32 });
});

addPattern(38, 42, 0.25, (t, i) => {
  addVoice({ start: t, length: 0.18, freq: [notes.c5, notes.d5, notes.e5, notes.g5][i % 4], gain: 0.075, pan: i % 2 ? 0.38 : -0.38, wave: "saw", attack: 0.005, release: 0.07 });
});

let peak = 0;
for (let i = 0; i < totalSamples; i += 1) {
  const fadeIn = Math.min(1, i / (sampleRate * 0.2));
  const fadeOut = Math.min(1, (totalSamples - i) / (sampleRate * 1.5));
  const master = Math.min(fadeIn, fadeOut) * 0.72;
  left[i] = Math.tanh(left[i] * master * 1.25);
  right[i] = Math.tanh(right[i] * master * 1.25);
  peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
}

const normalize = peak > 0 ? 0.92 / peak : 1;
const dataBytes = totalSamples * channels * 2;
const buffer = Buffer.alloc(44 + dataBytes);
buffer.write("RIFF", 0);
buffer.writeUInt32LE(36 + dataBytes, 4);
buffer.write("WAVE", 8);
buffer.write("fmt ", 12);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(channels, 22);
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * channels * 2, 28);
buffer.writeUInt16LE(channels * 2, 32);
buffer.writeUInt16LE(16, 34);
buffer.write("data", 36);
buffer.writeUInt32LE(dataBytes, 40);

let offset = 44;
for (let i = 0; i < totalSamples; i += 1) {
  buffer.writeInt16LE(Math.round(clamp(left[i] * normalize) * 32767), offset);
  offset += 2;
  buffer.writeInt16LE(Math.round(clamp(right[i] * normalize) * 32767), offset);
  offset += 2;
}

await mkdir(outDir, { recursive: true });
await writeFile(outPath, buffer);
console.log(outPath);
