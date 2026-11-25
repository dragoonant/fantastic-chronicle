// Procedural sound effects. Each one is a handful of oscillators/noise bursts with
// fast envelopes; the caller supplies a pitch factor (with random jitter) and volume.

import { getNoise, setOsc, type WaveName } from './instruments';
import type { SfxName } from './types';

export interface SfxCtx {
  ctx: AudioContext;
  out: AudioNode;
  echo: AudioNode;
  t: number;
  /** Pitch multiplier (already includes the semitone offset and jitter). */
  p: number;
  /** Volume multiplier. */
  v: number;
  /** Escalation level for 'combo' (1..8). */
  level: number;
}

interface ToneOpts {
  at?: number;
  f: number;
  f2?: number;
  glide?: number;
  wave?: WaveName | OscillatorType;
  dur: number;
  a?: number;
  peak: number;
  filter?: { type: BiquadFilterType; f: number; f2?: number; q?: number };
  echo?: number;
  vib?: { rate: number; depth: number };
  shaper?: boolean;
}

interface NoiseOpts {
  at?: number;
  dur: number;
  a?: number;
  peak: number;
  type: BiquadFilterType;
  f: number;
  f2?: number;
  q?: number;
  echo?: number;
}

const shaperCache = new WeakMap<BaseAudioContext, Float32Array<ArrayBuffer>>();
function driveCurve(ctx: BaseAudioContext): Float32Array<ArrayBuffer> {
  let c = shaperCache.get(ctx);
  if (!c) {
    c = new Float32Array(1024);
    for (let i = 0; i < c.length; i++) {
      const x = (i / (c.length - 1)) * 2 - 1;
      c[i] = Math.tanh(x * 3.2) / Math.tanh(3.2);
    }
    shaperCache.set(ctx, c);
  }
  return c;
}

function envelope(g: AudioParam, t: number, a: number, dur: number, peak: number): void {
  const pk = Math.max(0.0002, peak);
  g.setValueAtTime(0.0001, t);
  g.exponentialRampToValueAtTime(pk, t + Math.max(0.002, a));
  g.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, a + 0.01));
}

function finish(c: SfxCtx, src: AudioScheduledSourceNode, last: AudioNode, echo: number | undefined, nodes: AudioNode[]): void {
  last.connect(c.out);
  let send: GainNode | null = null;
  if (echo && echo > 0) {
    send = c.ctx.createGain();
    send.gain.value = echo;
    last.connect(send);
    send.connect(c.echo);
  }
  src.onended = () => {
    for (const n of [...nodes, ...(send ? [send] : [])]) {
      try {
        n.disconnect();
      } catch {
        /* ignore */
      }
    }
  };
}

function tone(c: SfxCtx, o: ToneOpts): void {
  const { ctx } = c;
  const t = c.t + (o.at ?? 0);
  const osc = ctx.createOscillator();
  setOsc(ctx, osc, o.wave ?? 'sine');
  const nyq = ctx.sampleRate / 2 - 100;
  const f = Math.min(nyq, o.f * c.p);
  osc.frequency.setValueAtTime(f, t);
  if (o.f2 !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, Math.min(nyq, o.f2 * c.p)), t + (o.glide ?? o.dur));
  const nodes: AudioNode[] = [osc];
  let last: AudioNode = osc;
  if (o.shaper) {
    const ws = ctx.createWaveShaper();
    ws.curve = driveCurve(ctx);
    last.connect(ws);
    last = ws;
    nodes.push(ws);
  }
  if (o.filter) {
    const bq = ctx.createBiquadFilter();
    bq.type = o.filter.type;
    bq.frequency.setValueAtTime(Math.min(nyq, o.filter.f), t);
    if (o.filter.f2) bq.frequency.exponentialRampToValueAtTime(Math.min(nyq, o.filter.f2), t + o.dur);
    bq.Q.value = o.filter.q ?? 0.7;
    last.connect(bq);
    last = bq;
    nodes.push(bq);
  }
  const g = ctx.createGain();
  envelope(g.gain, t, o.a ?? 0.004, o.dur, o.peak * c.v);
  last.connect(g);
  nodes.push(g);
  if (o.vib) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = o.vib.rate;
    const depth = ctx.createGain();
    depth.gain.value = o.vib.depth * c.p;
    lfo.connect(depth);
    depth.connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + o.dur + 0.05);
    nodes.push(lfo, depth);
  }
  osc.start(t);
  osc.stop(t + o.dur + 0.05);
  finish(c, osc, g, o.echo, nodes);
}

function noise(c: SfxCtx, o: NoiseOpts): void {
  const { ctx } = c;
  const t = c.t + (o.at ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  const nyq = ctx.sampleRate / 2 - 100;
  const bq = ctx.createBiquadFilter();
  bq.type = o.type;
  bq.frequency.setValueAtTime(Math.min(nyq, o.f * c.p), t);
  if (o.f2) bq.frequency.exponentialRampToValueAtTime(Math.min(nyq, o.f2 * c.p), t + o.dur);
  bq.Q.value = o.q ?? 0.8;
  const g = ctx.createGain();
  envelope(g.gain, t, o.a ?? 0.003, o.dur, o.peak * c.v);
  src.connect(bq);
  bq.connect(g);
  const room = Math.max(0, src.buffer.duration - o.dur - 0.1);
  src.start(t, Math.random() * room, o.dur + 0.05);
  finish(c, src, g, o.echo, [src, bq, g]);
}

/** Bell / chime: a few inharmonic sine partials. */
function bell(c: SfxCtx, at: number, f: number, dur: number, peak: number, echo = 0): void {
  const partials: [number, number, number][] = [[1, 1, 1], [2, 0.45, 0.7], [2.76, 0.3, 0.5], [5.4, 0.12, 0.3]];
  for (const [ratio, amp, len] of partials) tone(c, { at, f: f * ratio, dur: dur * len, peak: peak * amp, a: 0.002, echo });
}

const semis = (n: number): number => Math.pow(2, n / 12);
const rand = (lo: number, hi: number): number => lo + Math.random() * (hi - lo);

export const SFX: Record<SfxName, (c: SfxCtx) => void> = {
  cardDraw(c) {
    noise(c, { dur: 0.15, peak: 0.75, type: 'bandpass', f: 900, f2: 4200, q: 1.3, a: 0.02 });
    tone(c, { at: 0.11, f: 2400, dur: 0.035, peak: 0.07, wave: 'triangle' });
  },
  cardPlay(c) {
    noise(c, { dur: 0.09, peak: 0.55, type: 'lowpass', f: 1800 });
    tone(c, { f: 190, f2: 85, dur: 0.13, peak: 0.55, wave: 'triangle' });
    noise(c, { dur: 0.03, peak: 0.25, type: 'highpass', f: 3200 });
  },
  cardHover(c) {
    tone(c, { f: 2100, dur: 0.035, peak: 0.06, wave: 'triangle' });
  },
  menuMove(c) {
    tone(c, { f: 1320, dur: 0.045, peak: 0.09, wave: 'square', filter: { type: 'lowpass', f: 4500 } });
  },
  menuSelect(c) {
    tone(c, { f: 988, dur: 0.06, peak: 0.1, wave: 'square', filter: { type: 'lowpass', f: 5000 } });
    tone(c, { at: 0.055, f: 1480, dur: 0.12, peak: 0.1, wave: 'square', filter: { type: 'lowpass', f: 5000 }, echo: 0.3 });
  },
  error(c) {
    tone(c, { f: 196, dur: 0.1, peak: 0.14, wave: 'square', filter: { type: 'lowpass', f: 1400 } });
    tone(c, { at: 0.11, f: 147, dur: 0.17, peak: 0.14, wave: 'square', filter: { type: 'lowpass', f: 1200 } });
  },
  hit(c) {
    noise(c, { dur: 0.13, peak: 0.6, type: 'bandpass', f: 1400, q: 0.8 });
    tone(c, { f: 170, f2: 55, glide: 0.1, dur: 0.17, peak: 0.65 });
    noise(c, { dur: 0.025, peak: 0.3, type: 'highpass', f: 4000 });
  },
  heavyHit(c) {
    tone(c, { f: 130, f2: 32, glide: 0.3, dur: 0.48, peak: 0.85, shaper: true });
    noise(c, { dur: 0.38, peak: 0.7, type: 'lowpass', f: 3200, f2: 260 });
    tone(c, { f: 65, f2: 38, dur: 0.28, peak: 0.25, wave: 'square', filter: { type: 'lowpass', f: 420 } });
    noise(c, { dur: 0.45, peak: 0.12, type: 'highpass', f: 3000 });
  },
  multiHit(c) {
    for (let i = 0; i < 3; i++) {
      const at = i * 0.075;
      const k = 1 + i * 0.12;
      noise(c, { at, dur: 0.09, peak: 0.45, type: 'bandpass', f: 1500 * k, q: 0.9 });
      tone(c, { at, f: 190 * k, f2: 70 * k, glide: 0.07, dur: 0.11, peak: 0.45 });
    }
  },
  guard(c) {
    bell(c, 0, 520, 0.38, 0.22);
    noise(c, { dur: 0.05, peak: 0.35, type: 'highpass', f: 2500 });
    tone(c, { f: 260, dur: 0.12, peak: 0.18, wave: 'triangle' });
  },
  heal(c) {
    [0, 4, 7, 12, 16].forEach((s, i) => {
      tone(c, { at: i * 0.06, f: 523 * semis(s), dur: 0.4, peak: 0.12, wave: 'flute', echo: 0.4, a: 0.01 });
      tone(c, { at: i * 0.06, f: 1046 * semis(s), dur: 0.2, peak: 0.04 });
    });
    noise(c, { dur: 0.55, a: 0.12, peak: 0.05, type: 'highpass', f: 6000 });
  },
  spell(c) {
    tone(c, { f: 300, f2: 1200, glide: 0.35, dur: 0.48, peak: 0.22, wave: 'sawtooth', filter: { type: 'lowpass', f: 1200, f2: 4200 }, vib: { rate: 13, depth: 30 }, echo: 0.45, a: 0.03 });
    noise(c, { dur: 0.45, a: 0.15, peak: 0.32, type: 'bandpass', f: 600, f2: 3200, q: 2 });
    bell(c, 0.3, 1568, 0.3, 0.1, 0.4);
  },
  burn(c) {
    noise(c, { dur: 0.55, a: 0.05, peak: 0.42, type: 'lowpass', f: 900, f2: 400 });
    for (let i = 0; i < 9; i++) noise(c, { at: rand(0, 0.45), dur: rand(0.015, 0.04), peak: rand(0.15, 0.35), type: 'bandpass', f: rand(2200, 5200), q: 2 });
    tone(c, { f: 110, f2: 70, dur: 0.4, peak: 0.1, wave: 'sawtooth', filter: { type: 'lowpass', f: 600 } });
  },
  chill(c) {
    const fs = [2093, 2637, 3136, 3951];
    for (let i = fs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [fs[i], fs[j]] = [fs[j]!, fs[i]!];
    }
    fs.forEach((f, i) => tone(c, { at: i * 0.05, f, dur: 0.26, peak: 0.07, echo: 0.5, a: 0.002 }));
    noise(c, { dur: 0.45, a: 0.02, peak: 0.12, type: 'highpass', f: 7000 });
    tone(c, { f: 1200, f2: 600, dur: 0.3, peak: 0.05, wave: 'triangle' });
  },
  enemyDefeat(c) {
    tone(c, { f: 700, f2: 70, glide: 0.4, dur: 0.45, peak: 0.13, wave: 'square', filter: { type: 'lowpass', f: 3000 } });
    noise(c, { dur: 0.45, peak: 0.4, type: 'bandpass', f: 2200, f2: 280, q: 0.9 });
    tone(c, { at: 0.05, f: 90, f2: 40, dur: 0.3, peak: 0.4 });
  },
  heroDowned(c) {
    const ns = [659, 587, 494, 330];
    ns.forEach((f, i) => tone(c, { at: i * 0.13, f, dur: i === 3 ? 0.5 : 0.24, peak: 0.16, wave: 'reed', filter: { type: 'lowpass', f: 2400 }, echo: 0.3, a: 0.01 }));
    noise(c, { at: 0.39, dur: 0.3, peak: 0.15, type: 'lowpass', f: 300 });
  },
  lpLoss(c) {
    tone(c, { f: 55, dur: 1.4, peak: 0.75, a: 0.02 });
    tone(c, { f: 77.8, dur: 1.3, peak: 0.16, wave: 'sawtooth', filter: { type: 'lowpass', f: 520, f2: 180 }, a: 0.18, vib: { rate: 5, depth: 1.5 } });
    tone(c, { f: 58.3, dur: 1.2, peak: 0.13, wave: 'sawtooth', filter: { type: 'lowpass', f: 420, f2: 160 }, a: 0.12 });
    tone(c, { f: 85, f2: 50, glide: 0.25, dur: 0.9, peak: 0.6, wave: 'timp' });
    noise(c, { dur: 0.8, peak: 0.5, type: 'lowpass', f: 420, f2: 90 });
    tone(c, { at: 0.35, f: 155.6, dur: 0.9, peak: 0.07, wave: 'choir', a: 0.2, echo: 0.3 });
  },
  revive(c) {
    [0, 4, 7, 12, 16, 19].forEach((s, i) => bell(c, i * 0.055, 392 * semis(s), 0.45, 0.1, 0.35));
    [12, 16, 19].forEach((s) => tone(c, { at: 0.33, f: 392 * semis(s), dur: 0.65, a: 0.12, peak: 0.07, wave: 'choir', echo: 0.3 }));
    noise(c, { at: 0.2, dur: 0.6, a: 0.1, peak: 0.05, type: 'highpass', f: 7000 });
  },
  spark(c) {
    // Signature: a bright rising pentatonic glimmer ending on a ringing high chime.
    const run = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
    run.forEach((s, i) => bell(c, i * 0.03, 1046 * semis(s), 0.32, 0.06 + i * 0.012, 0.5));
    noise(c, { dur: 0.42, a: 0.15, peak: 0.1, type: 'bandpass', f: 3000, f2: 9500, q: 1.5, echo: 0.3 });
    bell(c, 0.32, 1046 * semis(24), 0.75, 0.2, 0.55);
    tone(c, { at: 0.32, f: 1046 * semis(19), dur: 0.5, peak: 0.05, wave: 'triangle', echo: 0.4 });
  },
  combo(c) {
    // Escalates: each call within ~1.5 s of the last raises the level (pitch and length).
    const lvl = Math.max(1, Math.min(8, c.level));
    const base = 523 * semis((lvl - 1) * 2);
    const steps = [0, 4, 7, 12, 16, 19, 24].slice(0, Math.min(7, 2 + lvl));
    steps.forEach((s, i) => tone(c, { at: i * 0.04, f: base * semis(s), dur: 0.12, peak: 0.08 + lvl * 0.008, wave: 'square', filter: { type: 'lowpass', f: 5000 }, echo: 0.25 }));
    const end = steps.length * 0.04;
    bell(c, end, base * semis(24), 0.35 + lvl * 0.04, 0.1 + lvl * 0.01, 0.4);
    noise(c, { dur: 0.08, peak: 0.12 + lvl * 0.02, type: 'highpass', f: 5000 });
  },
  coins(c) {
    tone(c, { f: 988, dur: 0.07, peak: 0.1, wave: 'square', filter: { type: 'lowpass', f: 6000 } });
    tone(c, { at: 0.065, f: 1319, dur: 0.28, peak: 0.1, wave: 'square', filter: { type: 'lowpass', f: 6000 }, echo: 0.3 });
    bell(c, 0.07, 2637, 0.2, 0.04);
  },
  equip(c) {
    noise(c, { dur: 0.26, a: 0.01, peak: 0.25, type: 'highpass', f: 3000, f2: 8500 });
    bell(c, 0.02, 1480, 0.42, 0.12, 0.3);
    tone(c, { f: 300, dur: 0.035, peak: 0.25, wave: 'triangle' });
  },
  seasonTick(c) {
    tone(c, { f: 784, dur: 0.28, peak: 0.16, a: 0.002, echo: 0.3 });
    tone(c, { f: 392, dur: 0.2, peak: 0.08, wave: 'triangle' });
    tone(c, { at: 0.13, f: 1046, dur: 0.32, peak: 0.14, a: 0.002, echo: 0.3 });
  },
  evilAdvance(c) {
    tone(c, { f: 98, dur: 0.38, peak: 0.24, wave: 'brass', filter: { type: 'lowpass', f: 700 }, vib: { rate: 7, depth: 2 }, a: 0.03 });
    tone(c, { at: 0.24, f: 92.5, dur: 0.5, peak: 0.26, wave: 'brass', filter: { type: 'lowpass', f: 650 }, vib: { rate: 7, depth: 2 }, a: 0.03 });
    tone(c, { at: 0.24, f: 46.25, dur: 0.5, peak: 0.3, a: 0.03 });
    noise(c, { dur: 0.7, a: 0.1, peak: 0.28, type: 'lowpass', f: 220 });
  },
  travel(c) {
    for (let i = 0; i < 3; i++) noise(c, { at: i * 0.12, dur: 0.05, peak: 0.42, type: 'lowpass', f: 700 + i * 100 });
    [0, 5, 7].forEach((s, i) => tone(c, { at: 0.05 + i * 0.12, f: 587 * semis(s), dur: 0.16, peak: 0.17, wave: 'flute', echo: 0.3, a: 0.01 }));
    noise(c, { dur: 0.4, a: 0.15, peak: 0.07, type: 'bandpass', f: 500, f2: 1800, q: 1 });
  },
  chronicle(c) {
    noise(c, { dur: 0.2, a: 0.03, peak: 0.32, type: 'bandpass', f: 1800, f2: 5000, q: 1.2 });
    [0, 2, 4, 7, 9, 12, 14].forEach((s, i) => tone(c, { at: 0.15 + i * 0.04, f: 523 * semis(s), dur: 0.5, peak: 0.1, wave: 'harp', echo: 0.45, a: 0.002 }));
  },
};
