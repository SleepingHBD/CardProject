import { mkdir, writeFile } from "node:fs/promises";

const SAMPLE_RATE = 48000;
const OUTPUT_DIR = new URL("../assets/audio/results/", import.meta.url);

function createBuffer(duration) {
  const length = Math.ceil(duration * SAMPLE_RATE);
  return {
    left: new Float64Array(length),
    right: new Float64Array(length),
  };
}

function seededNoise(seed) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) / 0x100000000) * 2 - 1;
  };
}

function panGains(pan = 0) {
  const angle = (Math.max(-1, Math.min(1, pan)) + 1) * Math.PI / 4;
  return [Math.cos(angle), Math.sin(angle)];
}

function addSample(buffer, index, sample, pan = 0) {
  if (index < 0 || index >= buffer.left.length) return;
  const [leftGain, rightGain] = panGains(pan);
  buffer.left[index] += sample * leftGain;
  buffer.right[index] += sample * rightGain;
}

function addDrum(buffer, start, {
  amplitude = 0.8,
  startFrequency = 105,
  endFrequency = 48,
  decay = 0.42,
  pan = 0,
  seed = 1,
} = {}) {
  const noise = seededNoise(seed);
  const startIndex = Math.floor(start * SAMPLE_RATE);
  const sampleCount = Math.floor((decay + 0.16) * SAMPLE_RATE);
  let phase = 0;
  let filteredNoise = 0;

  for (let i = 0; i < sampleCount; i += 1) {
    const time = i / SAMPLE_RATE;
    const progress = Math.min(1, time / decay);
    const frequency = startFrequency * ((endFrequency / startFrequency) ** progress);
    phase += (Math.PI * 2 * frequency) / SAMPLE_RATE;
    const bodyEnvelope = Math.exp(-time * 8.2);
    const clickEnvelope = Math.exp(-time * 72);
    filteredNoise += 0.22 * (noise() - filteredNoise);
    const body = Math.sin(phase) + (0.26 * Math.sin((phase * 2.03) + 0.4));
    const sample = amplitude * (
      (body * bodyEnvelope * 0.78)
      + (filteredNoise * clickEnvelope * 0.42)
    );
    addSample(buffer, startIndex + i, sample, pan);
  }
}

function addMetal(buffer, start, {
  baseFrequency = 190,
  amplitude = 0.48,
  decay = 0.72,
  pan = 0,
  seed = 2,
  brightness = 1,
} = {}) {
  const ratios = [1, 1.414, 1.932, 2.57, 3.18, 4.23, 5.31];
  const weights = [1, 0.72, 0.58, 0.4, 0.28, 0.19, 0.12];
  const phases = ratios.map(() => 0);
  const detunes = ratios.map((_, index) => 1 + ((index % 2 ? -1 : 1) * 0.0027 * (index + 1)));
  const noise = seededNoise(seed);
  const startIndex = Math.floor(start * SAMPLE_RATE);
  const sampleCount = Math.floor((decay + 0.25) * SAMPLE_RATE);
  let highNoise = 0;
  let previousNoise = 0;

  for (let i = 0; i < sampleCount; i += 1) {
    const time = i / SAMPLE_RATE;
    let resonances = 0;
    for (let partial = 0; partial < ratios.length; partial += 1) {
      phases[partial] += (
        Math.PI * 2 * baseFrequency * ratios[partial] * detunes[partial]
      ) / SAMPLE_RATE;
      const partialDecay = Math.exp(-time * (3.8 + (partial * 1.3)));
      resonances += Math.sin(phases[partial]) * weights[partial] * partialDecay;
    }
    const rawNoise = noise();
    highNoise = rawNoise - previousNoise + (0.72 * highNoise);
    previousNoise = rawNoise;
    const strike = highNoise * Math.exp(-time * 48) * 0.52 * brightness;
    const sample = amplitude * ((resonances * 0.35) + strike);
    addSample(buffer, startIndex + i, sample, pan);
  }
}

function addWood(buffer, start, {
  amplitude = 0.44,
  frequency = 240,
  decay = 0.22,
  pan = 0,
  seed = 3,
} = {}) {
  const noise = seededNoise(seed);
  const startIndex = Math.floor(start * SAMPLE_RATE);
  const sampleCount = Math.floor((decay + 0.08) * SAMPLE_RATE);
  let phase = 0;
  let lowNoise = 0;

  for (let i = 0; i < sampleCount; i += 1) {
    const time = i / SAMPLE_RATE;
    phase += (Math.PI * 2 * frequency * (1 - (0.18 * time / decay))) / SAMPLE_RATE;
    lowNoise += 0.16 * (noise() - lowNoise);
    const envelope = Math.exp(-time * 18);
    const sample = amplitude * envelope * (
      (Math.sin(phase) * 0.72)
      + (Math.sin(phase * 2.36) * 0.18)
      + (lowNoise * 0.32)
    );
    addSample(buffer, startIndex + i, sample, pan);
  }
}

function addHorn(buffer, start, {
  frequency,
  duration = 0.72,
  amplitude = 0.2,
  pan = 0,
  fall = 0,
} = {}) {
  const startIndex = Math.floor(start * SAMPLE_RATE);
  const sampleCount = Math.floor(duration * SAMPLE_RATE);
  const phases = new Float64Array(7);

  for (let i = 0; i < sampleCount; i += 1) {
    const time = i / SAMPLE_RATE;
    const progress = time / duration;
    const attack = Math.min(1, time / 0.055);
    const release = Math.min(1, (duration - time) / 0.26);
    const envelope = attack * release * Math.exp(-time * 0.8);
    const vibrato = 1 + (0.0022 * Math.sin(Math.PI * 2 * 5.2 * time));
    const currentFrequency = frequency * (1 - (fall * progress)) * vibrato;
    let tone = 0;
    for (let harmonic = 1; harmonic <= phases.length; harmonic += 1) {
      phases[harmonic - 1] += (
        Math.PI * 2 * currentFrequency * harmonic
      ) / SAMPLE_RATE;
      const weight = harmonic === 1
        ? 1
        : (1 / (harmonic ** 1.28)) * (harmonic % 2 ? 0.9 : 0.58);
      tone += Math.sin(phases[harmonic - 1]) * weight;
    }
    tone = Math.tanh(tone * 0.9);
    addSample(buffer, startIndex + i, tone * amplitude * envelope, pan);
  }
}

function addAirSweep(buffer, start, {
  duration = 0.45,
  amplitude = 0.12,
  pan = 0,
  seed = 4,
} = {}) {
  const noise = seededNoise(seed);
  const startIndex = Math.floor(start * SAMPLE_RATE);
  const sampleCount = Math.floor(duration * SAMPLE_RATE);
  let low = 0;
  let previousLow = 0;

  for (let i = 0; i < sampleCount; i += 1) {
    const time = i / SAMPLE_RATE;
    const progress = time / duration;
    const smoothing = 0.025 + (progress * 0.18);
    low += smoothing * (noise() - low);
    const band = low - previousLow;
    previousLow += 0.005 * (low - previousLow);
    const envelope = Math.sin(Math.PI * progress) ** 1.5;
    addSample(buffer, startIndex + i, band * amplitude * envelope, pan);
  }
}

function addRoom(buffer, amount = 0.18) {
  const dryLeft = Float64Array.from(buffer.left);
  const dryRight = Float64Array.from(buffer.right);
  const taps = [
    [0.047, 0.26],
    [0.079, 0.2],
    [0.113, 0.15],
    [0.167, 0.11],
    [0.229, 0.075],
  ];

  for (const [delaySeconds, gain] of taps) {
    const delay = Math.floor(delaySeconds * SAMPLE_RATE);
    for (let i = delay; i < buffer.left.length; i += 1) {
      const sourceIndex = i - delay;
      buffer.left[i] += (
        (dryLeft[sourceIndex] * gain * 0.72)
        + (dryRight[sourceIndex] * gain * 0.28)
      ) * amount;
      buffer.right[i] += (
        (dryRight[sourceIndex] * gain * 0.72)
        + (dryLeft[sourceIndex] * gain * 0.28)
      ) * amount;
    }
  }
}

function master(buffer) {
  let peak = 0;
  for (let i = 0; i < buffer.left.length; i += 1) {
    buffer.left[i] = Math.tanh(buffer.left[i] * 1.16);
    buffer.right[i] = Math.tanh(buffer.right[i] * 1.16);
    peak = Math.max(peak, Math.abs(buffer.left[i]), Math.abs(buffer.right[i]));
  }
  const gain = peak ? 0.93 / peak : 1;
  for (let i = 0; i < buffer.left.length; i += 1) {
    buffer.left[i] *= gain;
    buffer.right[i] *= gain;
  }
}

function encodeWav(buffer) {
  const frameCount = buffer.left.length;
  const bytesPerSample = 2;
  const channelCount = 2;
  const dataSize = frameCount * channelCount * bytesPerSample;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write("WAVE", 8);
  wav.write("fmt ", 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(channelCount, 22);
  wav.writeUInt32LE(SAMPLE_RATE, 24);
  wav.writeUInt32LE(SAMPLE_RATE * channelCount * bytesPerSample, 28);
  wav.writeUInt16LE(channelCount * bytesPerSample, 32);
  wav.writeUInt16LE(bytesPerSample * 8, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < frameCount; i += 1) {
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, buffer.left[i])) * 32767), offset);
    wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, buffer.right[i])) * 32767), offset + 2);
    offset += 4;
  }
  return wav;
}

function makeWin() {
  const buffer = createBuffer(1.62);
  addAirSweep(buffer, 0, { duration: 0.27, amplitude: 0.08, pan: 0, seed: 101 });
  addDrum(buffer, 0.015, { amplitude: 0.86, startFrequency: 118, endFrequency: 51, decay: 0.44, seed: 102 });
  addMetal(buffer, 0.02, { baseFrequency: 210, amplitude: 0.42, decay: 0.73, pan: -0.08, seed: 103 });
  addWood(buffer, 0.29, { amplitude: 0.3, frequency: 270, pan: 0.08, seed: 104 });
  addHorn(buffer, 0.12, { frequency: 293.66, duration: 0.76, amplitude: 0.17, pan: -0.16 });
  addHorn(buffer, 0.26, { frequency: 369.99, duration: 0.78, amplitude: 0.155, pan: 0.12 });
  addHorn(buffer, 0.4, { frequency: 440, duration: 0.84, amplitude: 0.145, pan: -0.05 });
  addHorn(buffer, 0.56, { frequency: 587.33, duration: 0.86, amplitude: 0.13, pan: 0.12 });
  addMetal(buffer, 0.48, { baseFrequency: 510, amplitude: 0.16, decay: 0.76, pan: 0.28, seed: 105, brightness: 0.75 });
  addRoom(buffer, 0.32);
  master(buffer);
  return buffer;
}

function makeLoss() {
  const buffer = createBuffer(1.7);
  addDrum(buffer, 0.01, { amplitude: 0.94, startFrequency: 92, endFrequency: 39, decay: 0.58, seed: 201 });
  addMetal(buffer, 0.025, { baseFrequency: 142, amplitude: 0.48, decay: 0.88, pan: 0.04, seed: 202, brightness: 0.72 });
  addWood(buffer, 0.3, { amplitude: 0.48, frequency: 178, pan: -0.16, seed: 203 });
  addDrum(buffer, 0.36, { amplitude: 0.48, startFrequency: 76, endFrequency: 34, decay: 0.52, pan: 0.08, seed: 204 });
  addHorn(buffer, 0.13, { frequency: 196, duration: 0.76, amplitude: 0.17, pan: -0.12, fall: 0.08 });
  addHorn(buffer, 0.31, { frequency: 164.81, duration: 0.8, amplitude: 0.15, pan: 0.12, fall: 0.09 });
  addHorn(buffer, 0.5, { frequency: 123.47, duration: 0.9, amplitude: 0.155, pan: -0.04, fall: 0.1 });
  addAirSweep(buffer, 0.22, { duration: 0.65, amplitude: 0.1, pan: -0.12, seed: 205 });
  addRoom(buffer, 0.28);
  master(buffer);
  return buffer;
}

function makeDraw() {
  const buffer = createBuffer(1.34);
  addMetal(buffer, 0.015, { baseFrequency: 205, amplitude: 0.4, decay: 0.55, pan: -0.34, seed: 301, brightness: 0.8 });
  addWood(buffer, 0.02, { amplitude: 0.35, frequency: 235, pan: -0.32, seed: 302 });
  addMetal(buffer, 0.19, { baseFrequency: 205, amplitude: 0.4, decay: 0.55, pan: 0.34, seed: 303, brightness: 0.8 });
  addWood(buffer, 0.195, { amplitude: 0.35, frequency: 235, pan: 0.32, seed: 304 });
  addHorn(buffer, 0.2, { frequency: 293.66, duration: 0.78, amplitude: 0.11, pan: -0.16 });
  addHorn(buffer, 0.2, { frequency: 440, duration: 0.78, amplitude: 0.095, pan: 0.16 });
  addHorn(buffer, 0.2, { frequency: 659.25, duration: 0.72, amplitude: 0.065, pan: 0 });
  addRoom(buffer, 0.26);
  master(buffer);
  return buffer;
}

await mkdir(OUTPUT_DIR, { recursive: true });
await Promise.all([
  writeFile(new URL("round-win.wav", OUTPUT_DIR), encodeWav(makeWin())),
  writeFile(new URL("round-loss.wav", OUTPUT_DIR), encodeWav(makeLoss())),
  writeFile(new URL("round-draw.wav", OUTPUT_DIR), encodeWav(makeDraw())),
]);
