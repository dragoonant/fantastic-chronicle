// SPC700-flavoured instruments: PeriodicWave wavetables through filters and ADSR
// envelopes, noise drums, and the SNES-style echo (feedback delay with a low-passed loop).

import { midiToFreq } from './theory';
import type { DrumKind, InstName } from './composer';

export type WaveName =
  | 'saw' | 'brass' | 'flute' | 'reed' | 'harp' | 'bass' | 'organ' | 'choir' | 'timp' | 'square12';

/** Harmonic amplitudes (sine series) for each wavetable. */
const WAVES: Record<WaveName, number[]> = {
  saw: Array.from({ length: 24 }, (_, i) => 1 / (i + 1)),
  brass: Array.from({ length: 20 }, (_, i) => Math.pow(1 / (i + 1), 0.75) * (i === 1 ? 1.2 : 1)),
  flute: [1, 0.22, 0.1, 0.04, 0.02],
  reed: [1, 0.08, 0.7, 0.06, 0.45, 0.04, 0.3, 0.02, 0.18, 0.02, 0.1],
  harp: [1, 0.55, 0.3, 0.18, 0.1, 0.06, 0.03],
  bass: [1, 0.75, 0.5, 0.3, 0.22, 0.14, 0.09, 0.05],
  organ: [1, 0.9, 0.55, 0.7, 0.1, 0.4, 0.05, 0.3, 0, 0.12],
  choir: [1, 0.45, 0.9, 0.25, 0.5, 0.12, 0.2, 0.05],
  timp: [1, 0, 0.5, 0.25, 0.15, 0.05],
  square12: Array.from({ length: 16 }, (_, i) => ((i + 1) % 2 === 1 ? 1 / (i + 1) : (i + 1) % 8 === 0 ? 0 : 0.35 / (i + 1))),
};

const waveCache = new WeakMap<BaseAudioContext, Map<WaveName, PeriodicWave>>();
const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

export function getWave(ctx: BaseAudioContext, name: WaveName): PeriodicWave {
  let m = waveCache.get(ctx);
  if (!m) {
    m = new Map();
    waveCache.set(ctx, m);
  }
  let w = m.get(name);
  if (!w) {
    const amps = WAVES[name];
    const real = new Float32Array(amps.length + 1);
    const imag = new Float32Array(amps.length + 1);
    amps.forEach((a, i) => (imag[i + 1] = a));
    w = ctx.createPeriodicWave(real, imag);
    m.set(name, w);
  }
  return w;
}

export function getNoise(ctx: BaseAudioContext): AudioBuffer {
  let b = noiseCache.get(ctx);
  if (!b) {
    const len = Math.floor(ctx.sampleRate * 2);
    b = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, b);
  }
  return b;
}

export function setOsc(ctx: BaseAudioContext, osc: OscillatorNode, wave: WaveName | OscillatorType): void {
  if (wave === 'sine' || wave === 'square' || wave === 'sawtooth' || wave === 'triangle') osc.type = wave;
  else if (wave !== 'custom') osc.setPeriodicWave(getWave(ctx, wave));
}

function cleanup(src: AudioScheduledSourceNode, nodes: AudioNode[]): void {
  src.onended = () => {
    for (const n of nodes) {
      try {
        n.disconnect();
      } catch {
        /* already gone */
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Pitched instruments

interface InstSpec {
  wave: WaveName | OscillatorType;
  /** Second oscillator detuned by this many cents (ensemble/chorus). */
  detune2?: number;
  filter: { type: BiquadFilterType; mul: number; max: number; q: number; envMul?: number; envTime?: number };
  a: number;
  d: number;
  s: number;
  r: number;
  /** Plucked: rings out over d seconds regardless of note length. */
  ring?: boolean;
  vib?: { rate: number; cents: number; delay: number };
  gain: number;
  /** Octave shift applied at play time. */
  oct?: number;
}

const INST: Record<InstName, InstSpec> = {
  brass: {
    wave: 'brass', detune2: 6,
    filter: { type: 'lowpass', mul: 4, max: 6000, q: 1.2, envMul: 9, envTime: 0.09 },
    a: 0.035, d: 0.25, s: 0.72, r: 0.12, vib: { rate: 5.6, cents: 11, delay: 0.28 }, gain: 0.2,
  },
  horn: {
    wave: 'brass',
    filter: { type: 'lowpass', mul: 2.6, max: 3200, q: 0.9, envMul: 5, envTime: 0.12 },
    a: 0.05, d: 0.3, s: 0.75, r: 0.15, vib: { rate: 5, cents: 8, delay: 0.3 }, gain: 0.21,
  },
  strings: {
    wave: 'saw', detune2: 9,
    filter: { type: 'lowpass', mul: 5, max: 5500, q: 0.7 },
    a: 0.06, d: 0.3, s: 0.82, r: 0.22, vib: { rate: 5.3, cents: 13, delay: 0.22 }, gain: 0.16,
  },
  stringPad: {
    wave: 'saw', detune2: 12,
    filter: { type: 'lowpass', mul: 3, max: 2600, q: 0.6 },
    a: 0.38, d: 0.5, s: 0.85, r: 0.55, vib: { rate: 4.6, cents: 9, delay: 0.3 }, gain: 0.1,
  },
  flute: {
    wave: 'flute',
    filter: { type: 'lowpass', mul: 8, max: 9000, q: 0.5 },
    a: 0.05, d: 0.2, s: 0.85, r: 0.12, vib: { rate: 5.2, cents: 15, delay: 0.2 }, gain: 0.26,
  },
  reed: {
    wave: 'reed',
    filter: { type: 'lowpass', mul: 6, max: 5000, q: 0.8 },
    a: 0.03, d: 0.2, s: 0.8, r: 0.1, vib: { rate: 5.4, cents: 10, delay: 0.25 }, gain: 0.19,
  },
  harp: {
    wave: 'harp',
    filter: { type: 'lowpass', mul: 7, max: 7000, q: 0.6 },
    a: 0.003, d: 1.1, s: 0, r: 0.3, ring: true, gain: 0.22,
  },
  pizz: {
    wave: 'saw',
    filter: { type: 'lowpass', mul: 4, max: 4000, q: 1, envMul: 8, envTime: 0.05 },
    a: 0.004, d: 0.32, s: 0, r: 0.1, ring: true, gain: 0.26,
  },
  bass: {
    wave: 'bass',
    filter: { type: 'lowpass', mul: 3.5, max: 1600, q: 2, envMul: 9, envTime: 0.07 },
    a: 0.006, d: 0.35, s: 0.55, r: 0.07, gain: 0.36,
  },
  slapBass: {
    wave: 'bass',
    filter: { type: 'lowpass', mul: 5, max: 2400, q: 3, envMul: 14, envTime: 0.05 },
    a: 0.003, d: 0.22, s: 0.45, r: 0.06, gain: 0.36,
  },
  contrabass: {
    wave: 'saw', detune2: 5,
    filter: { type: 'lowpass', mul: 3, max: 900, q: 0.8 },
    a: 0.07, d: 0.4, s: 0.85, r: 0.2, vib: { rate: 4.8, cents: 6, delay: 0.3 }, gain: 0.32,
  },
  organ: {
    wave: 'organ', detune2: 4,
    filter: { type: 'lowpass', mul: 8, max: 7000, q: 0.5 },
    a: 0.012, d: 0.1, s: 0.9, r: 0.08, vib: { rate: 6.2, cents: 9, delay: 0.15 }, gain: 0.13,
  },
  choir: {
    wave: 'choir', detune2: 10,
    filter: { type: 'lowpass', mul: 4, max: 3000, q: 0.7 },
    a: 0.3, d: 0.4, s: 0.9, r: 0.5, vib: { rate: 4.4, cents: 12, delay: 0.25 }, gain: 0.11,
  },
};

/** Schedules one note. dur in seconds; vel 0..1. */
export function playNote(
  ctx: BaseAudioContext, out: AudioNode, inst: InstName, t: number, midi: number, dur: number, vel: number,
): void {
  const spec = INST[inst];
  const f = midiToFreq(midi + 12 * (spec.oct ?? 0));
  const nyq = ctx.sampleRate / 2 - 100;

  const filter = ctx.createBiquadFilter();
  filter.type = spec.filter.type;
  filter.Q.value = spec.filter.q;
  const base = Math.min(spec.filter.max, f * spec.filter.mul, nyq);
  if (spec.filter.envMul) {
    filter.frequency.setValueAtTime(Math.min(f * spec.filter.envMul, nyq, 16000), t);
    filter.frequency.setTargetAtTime(base, t + 0.005, (spec.filter.envTime ?? 0.08) / 3);
  } else filter.frequency.setValueAtTime(base, t);

  const amp = ctx.createGain();
  const peak = Math.max(0.0001, vel * spec.gain);
  const g = amp.gain;
  g.setValueAtTime(0, t);
  g.linearRampToValueAtTime(peak, t + spec.a);
  let stopAt: number;
  if (spec.ring) {
    // Short notes ring for less time, so fast arpeggios do not pile up voices.
    const ringLen = Math.min(spec.d, Math.max(0.18, dur * 3));
    g.setTargetAtTime(0, t + spec.a, ringLen / 5);
    stopAt = t + spec.a + ringLen * 1.1 + 0.05;
  } else {
    g.setTargetAtTime(peak * spec.s, t + spec.a, Math.max(0.01, spec.d / 3));
    const end = Math.max(t + dur, t + spec.a + 0.01);
    g.setTargetAtTime(0, end, spec.r / 4);
    stopAt = end + spec.r * 1.6 + 0.03;
  }

  const oscs: OscillatorNode[] = [];
  const count = spec.detune2 ? 2 : 1;
  for (let i = 0; i < count; i++) {
    const o = ctx.createOscillator();
    setOsc(ctx, o, spec.wave);
    o.frequency.setValueAtTime(f, t);
    if (spec.detune2) o.detune.setValueAtTime(i === 0 ? -spec.detune2 / 2 : spec.detune2 / 2, t);
    o.connect(filter);
    oscs.push(o);
  }
  const mix = count === 2 ? ctx.createGain() : null;
  if (mix) {
    mix.gain.value = 0.62;
    filter.connect(mix);
    mix.connect(amp);
  } else filter.connect(amp);
  amp.connect(out);

  const extra: AudioNode[] = [];
  if (spec.vib && !spec.ring && dur > spec.vib.delay + 0.08) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = spec.vib.rate;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.setValueAtTime(0, t + spec.vib.delay);
    depth.gain.linearRampToValueAtTime(spec.vib.cents, t + spec.vib.delay + 0.25);
    lfo.connect(depth);
    for (const o of oscs) depth.connect(o.detune);
    lfo.start(t);
    lfo.stop(stopAt);
    extra.push(lfo, depth);
  }
  for (const o of oscs) {
    o.start(t);
    o.stop(stopAt);
  }
  cleanup(oscs[0]!, [...oscs, filter, amp, ...(mix ? [mix] : []), ...extra]);
}

// ---------------------------------------------------------------------------
// Drums

function noiseBurst(
  ctx: BaseAudioContext, out: AudioNode, t: number, dur: number, peak: number,
  ftype: BiquadFilterType, freq: number, q = 0.8, freqEnd?: number,
): void {
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  const filt = ctx.createBiquadFilter();
  filt.type = ftype;
  filt.frequency.setValueAtTime(freq, t);
  if (freqEnd) filt.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
  filt.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(Math.max(0.0001, peak), t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filt);
  filt.connect(g);
  g.connect(out);
  const room = Math.max(0, src.buffer.duration - dur - 0.1);
  src.start(t, Math.random() * room, dur + 0.05);
  cleanup(src, [src, filt, g]);
}

function pitched(
  ctx: BaseAudioContext, out: AudioNode, t: number, wave: WaveName | OscillatorType,
  f0: number, f1: number, sweep: number, dur: number, peak: number,
): void {
  const o = ctx.createOscillator();
  setOsc(ctx, o, wave);
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + sweep);
  const g = ctx.createGain();
  g.gain.setValueAtTime(Math.max(0.0001, peak), t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(out);
  o.start(t);
  o.stop(t + dur + 0.02);
  cleanup(o, [o, g]);
}

export function playDrum(ctx: BaseAudioContext, out: AudioNode, kind: DrumKind, t: number, vel: number, midi?: number): void {
  const v = Math.max(0.0001, vel);
  switch (kind) {
    case 'kick':
      pitched(ctx, out, t, 'sine', 150, 42, 0.09, 0.32, 0.95 * v);
      noiseBurst(ctx, out, t, 0.012, 0.25 * v, 'bandpass', 3000, 1);
      break;
    case 'snare':
      noiseBurst(ctx, out, t, 0.17, 0.42 * v, 'highpass', 1300, 0.7);
      noiseBurst(ctx, out, t, 0.08, 0.25 * v, 'bandpass', 4200, 1.2);
      pitched(ctx, out, t, 'triangle', 200, 160, 0.06, 0.09, 0.32 * v);
      break;
    case 'hat':
      noiseBurst(ctx, out, t, 0.035, 0.2 * v, 'highpass', 7500, 0.7);
      break;
    case 'openHat':
      noiseBurst(ctx, out, t, 0.2, 0.15 * v, 'highpass', 7000, 0.7);
      break;
    case 'crash':
      noiseBurst(ctx, out, t, 1.5, 0.2 * v, 'highpass', 4500, 0.5, 3000);
      noiseBurst(ctx, out, t, 0.5, 0.12 * v, 'bandpass', 6500, 0.8);
      break;
    case 'tom': {
      const f = midiToFreq(midi ?? 47);
      pitched(ctx, out, t, 'sine', f * 1.5, f, 0.08, 0.3, 0.7 * v);
      noiseBurst(ctx, out, t, 0.05, 0.12 * v, 'lowpass', 1200, 0.7);
      break;
    }
    case 'timpani': {
      const f = midiToFreq(midi ?? 45);
      pitched(ctx, out, t, 'timp', f * 1.03, f, 0.12, 1.0, 0.5 * v);
      pitched(ctx, out, t, 'sine', f * 1.5, f * 1.49, 0.1, 0.5, 0.12 * v);
      noiseBurst(ctx, out, t, 0.09, 0.3 * v, 'lowpass', 380, 0.7);
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Echo bus: input -> highpass -> delay <-> (lowpass -> feedback gain), delay -> wet -> output

export interface EchoBus { input: GainNode; output: GainNode }

export function makeEcho(ctx: BaseAudioContext, time: number, feedback: number, wet: number, lp = 2600): EchoBus {
  const input = ctx.createGain();
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 260;
  const delay = ctx.createDelay(1);
  delay.delayTime.value = time;
  const fbFilter = ctx.createBiquadFilter();
  fbFilter.type = 'lowpass';
  fbFilter.frequency.value = lp;
  const fb = ctx.createGain();
  fb.gain.value = feedback;
  const output = ctx.createGain();
  output.gain.value = wet;
  input.connect(hp);
  hp.connect(delay);
  delay.connect(fbFilter);
  fbFilter.connect(fb);
  fb.connect(delay);
  fbFilter.connect(output);
  return { input, output };
}
