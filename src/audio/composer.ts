// Procedural composer. Pure data: no WebAudio here, so it runs (and is tested) headless.
//
// A track is composed from its mood: key/mode, tempo, a chord progression per phrase
// drawn from a mood pool, a form (AABA, ABAB, ...) of 4- or 8-bar phrases, a melody
// built from a one-bar motif that is restated, sequenced and varied, closing each
// phrase on a cadence, then bass, accompaniment, pad, counter-line and drums over it.

import { hashString, makeRng, type Rng } from './prng';
import {
  MODES, PC_NAMES, chordDegrees, degToSemis, localScale, mod, parseChord,
  type Chord, type ModeName,
} from './theory';
import type { TrackName } from './types';

export type InstName =
  | 'brass' | 'horn' | 'strings' | 'stringPad' | 'flute' | 'reed' | 'harp' | 'pizz'
  | 'bass' | 'slapBass' | 'contrabass' | 'organ' | 'choir';

export type DrumKind = 'kick' | 'snare' | 'hat' | 'openHat' | 'crash' | 'tom' | 'timpani';

/** t and d in beats, m = MIDI note, v = velocity 0..1. */
export interface NoteEv { t: number; d: number; m: number; v: number }
export interface Part { name: string; inst: InstName; gain: number; pan: number; echo: number; notes: NoteEv[] }
export interface DrumEv { t: number; k: DrumKind; v: number; m?: number }
export interface Section { beats: number; parts: Part[]; drums: DrumEv[] }
export interface Song {
  track: TrackName;
  variant: number;
  seed: number;
  bpm: number;
  meter: 3 | 4;
  tonic: number;
  mode: ModeName;
  form: string;
  key: string;
  sections: Section[];
  /** Section index the loop returns to, or null for a one-shot track. */
  loopFrom: number | null;
}

// ---------------------------------------------------------------------------
// Mood tables

type CounterStyle = 'thirds' | 'guide';
type BassStyle = 'half' | 'march' | 'eighthsOct' | 'chromatic' | 'waltz' | 'drone' | 'syncop';
type AccompStyle = 'harpArp8' | 'harpArp4' | 'arp16' | 'pahpah' | 'offbeat' | 'stabs' | 'ostinato';
type DrumStyle = 'none' | 'timp' | 'march' | 'waltz' | 'sparse' | 'battle' | 'boss' | 'half' | 'final' | 'light';

interface Voice<S> { style: S; inst: InstName; gain: number }

interface Mood {
  bpm: [number, number];
  meter: 3 | 4;
  modes: ModeName[];
  tonics: number[];
  progs: string[][];
  turnaround: (string | null)[];
  forms: string[];
  phraseBars: 4 | 8;
  /** One-bar rhythm cells in 16th steps; negative = rest. */
  rhythms: number[][];
  cadences: number[][];
  leap: number;
  lead: { inst: InstName; gain: number };
  counter: Voice<CounterStyle> | null;
  bass: Voice<BassStyle>;
  accomp: Voice<AccompStyle> | null;
  pad: { inst: InstName; voices: 2 | 3; gain: number } | null;
  drums: DrumStyle;
  loop: boolean;
}

const MOODS: Record<Exclude<TrackName, 'victory'>, Mood> = {
  title: {
    bpm: [84, 94], meter: 4, modes: ['ionian'], tonics: [0, 2, 3, 5, 7, 10],
    progs: [
      ['I', 'IV', 'V', 'I'], ['I', 'vi', 'IV', 'V'], ['I', 'V', 'vi', 'IV'], ['IV', 'V', 'iii', 'vi'],
      ['I', 'iii', 'IV', 'V'], ['vi', 'IV', 'V', 'I'], ['IV', 'I', 'ii', 'V'],
    ],
    turnaround: ['V'], forms: ['AABA', 'ABAB', 'AABB'], phraseBars: 4,
    rhythms: [[8, 4, 4], [4, 4, 8], [6, 2, 4, 4], [4, 4, 4, 4], [12, 4], [6, 2, 8], [4, 2, 2, 8]],
    cadences: [[16], [4, 12], [8, 8], [6, 2, 8]], leap: 0.25,
    lead: { inst: 'brass', gain: 1 },
    counter: { style: 'guide', inst: 'strings', gain: 0.7 },
    bass: { style: 'half', inst: 'contrabass', gain: 1 },
    accomp: { style: 'harpArp8', inst: 'harp', gain: 0.8 },
    pad: { inst: 'stringPad', voices: 2, gain: 0.8 },
    drums: 'timp', loop: true,
  },
  map: {
    bpm: [112, 126], meter: 4, modes: ['ionian', 'mixolydian'], tonics: [2, 4, 5, 7, 9],
    progs: [
      ['I', 'bVII', 'IV', 'I'], ['I', 'IV', 'bVII', 'I'], ['I', 'V', 'IV', 'I'], ['I', 'ii', 'IV', 'V'],
      ['IV', 'bVII', 'I', 'V'], ['vi', 'IV', 'I', 'V'], ['I', 'iii', 'IV', 'bVII'],
    ],
    turnaround: ['V', 'bVII'], forms: ['AABA', 'AABB', 'ABAB'], phraseBars: 4,
    rhythms: [[3, 1, 4, 4, 4], [4, 4, 3, 1, 4], [6, 2, 4, 4], [4, 2, 2, 4, 4], [2, 2, 4, 8], [3, 1, 3, 1, 8], [4, 4, 4, 2, 2]],
    cadences: [[4, 4, 8], [8, 8], [3, 1, 12], [16]], leap: 0.3,
    lead: { inst: 'horn', gain: 1 },
    counter: { style: 'thirds', inst: 'reed', gain: 0.55 },
    bass: { style: 'march', inst: 'bass', gain: 1 },
    accomp: { style: 'offbeat', inst: 'pizz', gain: 0.8 },
    pad: null,
    drums: 'march', loop: true,
  },
  town: {
    bpm: [96, 110], meter: 3, modes: ['ionian', 'lydian'], tonics: [0, 5, 7, 9, 10],
    progs: [
      ['I', 'IV', 'I', 'V'], ['I', 'vi', 'ii', 'V'], ['I', 'iii', 'IV', 'I'], ['IV', 'I', 'ii', 'V'],
      ['I', 'ii', 'V', 'I'], ['vi', 'ii', 'V', 'I'],
    ],
    turnaround: ['V'], forms: ['AABA', 'ABAB'], phraseBars: 8,
    rhythms: [[4, 4, 4], [6, 2, 4], [8, 4], [4, 2, 2, 4], [6, 6], [2, 2, 4, 4], [-4, 4, 4]],
    cadences: [[12], [4, 8], [2, 2, 8]], leap: 0.25,
    lead: { inst: 'flute', gain: 1 },
    counter: null,
    bass: { style: 'waltz', inst: 'pizz', gain: 1.1 },
    accomp: { style: 'pahpah', inst: 'harp', gain: 0.7 },
    pad: { inst: 'stringPad', voices: 2, gain: 0.45 },
    drums: 'waltz', loop: true,
  },
  dungeon: {
    bpm: [72, 84], meter: 4, modes: ['aeolian', 'phrygian'], tonics: [1, 4, 6, 9, 11],
    progs: [
      ['i', 'i', 'bVI', 'v'], ['i', 'bII', 'i', 'bII'], ['i', 'bVII', 'bVI', 'bVII'], ['i', 'iv', 'i', 'v'],
      ['i', 'bVI', 'iv', 'v'], ['iv', 'i', 'bII', 'i'],
    ],
    turnaround: ['v', 'bII'], forms: ['ABAB', 'AABA'], phraseBars: 4,
    rhythms: [[8, 8], [12, 4], [-4, 4, 8], [16], [4, 4, 8], [-8, 8], [-8, 4, 4]],
    cadences: [[16], [8, 8], [4, 12]], leap: 0.3,
    lead: { inst: 'reed', gain: 0.9 },
    counter: null,
    bass: { style: 'drone', inst: 'contrabass', gain: 1 },
    accomp: { style: 'ostinato', inst: 'harp', gain: 0.75 },
    pad: { inst: 'stringPad', voices: 2, gain: 0.5 },
    drums: 'sparse', loop: true,
  },
  battle: {
    bpm: [150, 168], meter: 4, modes: ['aeolian', 'harmonicMinor'], tonics: [2, 4, 7, 9, 11],
    progs: [
      ['i', 'bVI', 'bVII', 'i'], ['i', 'bVII', 'bVI', 'V'], ['i', 'iv', 'bVII', 'bIII'], ['bVI', 'bVII', 'i', 'i'],
      ['i', 'bVI', 'iv', 'V'], ['iv', 'V', 'i', 'bVI'], ['i', 'bIII', 'bVII', 'iv'],
    ],
    turnaround: ['V', 'bVII'], forms: ['AABA', 'AABB', 'ABAB'], phraseBars: 8,
    rhythms: [
      [4, 2, 2, 4, 4], [2, 2, 2, 2, 4, 4], [3, 3, 2, 4, 4], [6, 2, 4, 2, 2], [4, 4, 2, 2, 2, 2],
      [3, 3, 3, 3, 4], [-2, 2, 4, 4, 4], [2, 2, 2, 2, 2, 2, 4],
    ],
    cadences: [[4, 12], [2, 2, 12], [6, 10], [3, 3, 10]], leap: 0.22,
    lead: { inst: 'brass', gain: 1 },
    counter: { style: 'guide', inst: 'strings', gain: 0.6 },
    bass: { style: 'eighthsOct', inst: 'slapBass', gain: 1 },
    accomp: { style: 'stabs', inst: 'horn', gain: 0.55 },
    pad: null,
    drums: 'battle', loop: true,
  },
  boss: {
    bpm: [168, 182], meter: 4, modes: ['harmonicMinor', 'phrygian'], tonics: [1, 3, 4, 6, 8],
    progs: [
      ['i', 'bII', 'i', 'V'], ['i', 'bVI', 'bII', 'V'], ['i', 'iv', 'bII', 'V'], ['i', 'i', 'bVI', 'V'],
      ['bVI', 'bII', 'i', 'V'], ['iv', 'i', 'bII', 'bVI'],
    ],
    turnaround: ['V'], forms: ['AABA', 'ABAB'], phraseBars: 8,
    rhythms: [
      [2, 2, 2, 2, 4, 4], [3, 3, 2, 2, 2, 4], [2, 2, 4, 2, 2, 4], [4, 2, 2, 2, 2, 4],
      [1, 1, 2, 4, 4, 4], [3, 3, 3, 3, 2, 2], [6, 2, 2, 2, 4],
    ],
    cadences: [[4, 12], [2, 2, 12], [3, 3, 10]], leap: 0.3,
    lead: { inst: 'organ', gain: 1 },
    counter: { style: 'thirds', inst: 'brass', gain: 0.6 },
    bass: { style: 'chromatic', inst: 'slapBass', gain: 1 },
    accomp: { style: 'stabs', inst: 'strings', gain: 0.5 },
    pad: null,
    drums: 'boss', loop: true,
  },
  lieutenant: {
    bpm: [124, 138], meter: 4, modes: ['dorian'], tonics: [2, 4, 7, 9],
    progs: [
      ['i', 'IV', 'i', 'IV'], ['i', 'bVII', 'IV', 'i'], ['i', 'bIII', 'IV', 'i'], ['i', 'v', 'IV', 'i'],
      ['i', 'bVII', 'IV', 'IV'], ['ii', 'IV', 'i', 'bVII'],
    ],
    turnaround: ['bVII', 'IV'], forms: ['AABA', 'ABAB', 'AABB'], phraseBars: 4,
    rhythms: [[3, 3, 2, 4, 4], [6, 6, 4], [4, 2, 4, 2, 4], [-2, 4, 2, 8], [3, 3, 3, 3, 4], [2, 2, 4, 4, 4]],
    cadences: [[4, 12], [16], [3, 3, 10]], leap: 0.25,
    lead: { inst: 'strings', gain: 1.1 },
    counter: { style: 'guide', inst: 'horn', gain: 0.55 },
    bass: { style: 'syncop', inst: 'bass', gain: 1 },
    accomp: { style: 'ostinato', inst: 'harp', gain: 0.65 },
    pad: null,
    drums: 'half', loop: true,
  },
  final: {
    bpm: [138, 150], meter: 4, modes: ['harmonicMinor'], tonics: [0, 2, 5, 7, 10],
    progs: [
      ['i', 'bVI', 'bIII', 'V'], ['i', 'iv', 'V', 'i'], ['bVI', 'bVII', 'i', 'V'], ['i', 'bII', 'bVI', 'V'],
      ['iv', 'V', 'i', 'bVI'], ['i', 'bVII', 'bVI', 'V'],
    ],
    turnaround: ['V'], forms: ['AABA', 'AABB'], phraseBars: 8,
    rhythms: [[4, 4, 4, 4], [6, 2, 8], [3, 3, 2, 8], [2, 2, 2, 2, 8], [4, 2, 2, 4, 4], [8, 4, 4], [6, 2, 4, 4]],
    cadences: [[4, 12], [16], [2, 2, 12], [8, 8]], leap: 0.25,
    lead: { inst: 'brass', gain: 1.05 },
    counter: { style: 'guide', inst: 'strings', gain: 0.7 },
    bass: { style: 'eighthsOct', inst: 'bass', gain: 1 },
    accomp: { style: 'arp16', inst: 'harp', gain: 0.55 },
    pad: { inst: 'choir', voices: 2, gain: 0.8 },
    drums: 'final', loop: true,
  },
  gameover: {
    bpm: [58, 64], meter: 4, modes: ['aeolian'], tonics: [2, 4, 7, 9],
    progs: [
      ['i', 'iv', 'bVI', 'V'], ['i', 'bVI', 'iv', 'i'], ['i', 'bVII', 'bVI', 'V'], ['iv', 'i', 'bVI', 'i'],
    ],
    turnaround: [null], forms: ['A'], phraseBars: 8,
    rhythms: [[8, 8], [12, 4], [16], [4, 4, 8], [6, 2, 8]],
    cadences: [[16], [8, 8]], leap: 0.2,
    lead: { inst: 'flute', gain: 0.95 },
    counter: null,
    bass: { style: 'drone', inst: 'contrabass', gain: 0.9 },
    accomp: { style: 'harpArp4', inst: 'harp', gain: 0.6 },
    pad: { inst: 'stringPad', voices: 3, gain: 0.7 },
    drums: 'none', loop: false,
  },
};

// ---------------------------------------------------------------------------
// Internal composition state

const SPB = 4; // 16th-note steps per beat

interface Seg { start: number; len: number; chord: Chord; scale: number[]; cdeg: number[]; ending: boolean }
interface MNote { s: number; len: number; deg: number }
interface SNote { s: number; len: number; m: number; v: number }
interface SDrum { s: number; k: DrumKind; v: number; m?: number }

interface Comp {
  meter: 3 | 4;
  barSteps: number;
  tonic: number;
  mode: readonly number[];
  segs: Seg[];
  leadBase: number;
  lo: number;
  hi: number;
}

interface Motif { rhythm: number[]; moves: number[] }

function makeSeg(c: Pick<Comp, 'mode'>, start: number, len: number, sym: string, ending = false): Seg {
  const chord = parseChord(sym);
  const scale = localScale(c.mode, chord);
  return { start, len, chord, scale, cdeg: chordDegrees(scale, chord), ending };
}

function segAt(c: Comp, step: number): Seg {
  let found = c.segs[0]!;
  for (const s of c.segs) {
    if (s.start <= step) found = s;
    else break;
  }
  return found;
}

function snap(deg: number, cdeg: readonly number[], prefer: number): number {
  if (cdeg.length === 0 || cdeg.includes(mod(deg, 7))) return deg;
  const dir = prefer >= 0 ? 1 : -1;
  for (let k = 1; k <= 3; k++) {
    if (cdeg.includes(mod(deg + k * dir, 7))) return deg + k * dir;
    if (cdeg.includes(mod(deg - k * dir, 7))) return deg - k * dir;
  }
  return deg;
}

function nearestWhere(from: number, ok: (d: number) => boolean, lo: number, hi: number): number {
  for (let k = 0; k <= 14; k++) {
    if (from - k >= lo && ok(from - k)) return from - k;
    if (from + k <= hi && ok(from + k)) return from + k;
  }
  return from;
}

function clampDeg(c: Comp, prev: number, deg: number): number {
  if (deg > c.hi) deg = prev - Math.abs(deg - prev);
  if (deg < c.lo) deg = prev + Math.abs(deg - prev);
  return Math.max(c.lo, Math.min(c.hi, deg));
}

function fitRhythm(r: number[], barSteps: number): number[] {
  const total = r.reduce((a, x) => a + Math.abs(x), 0);
  if (total === barSteps) return r;
  // Scale 4/4 cells into 3/4 (or vice versa) by trimming/padding the last value.
  const out = [...r];
  let diff = barSteps - total;
  while (diff !== 0 && out.length > 0) {
    const last = out[out.length - 1]!;
    const mag = Math.abs(last) + diff;
    if (mag > 0) {
      out[out.length - 1] = last < 0 ? -mag : mag;
      diff = 0;
    } else {
      diff += Math.abs(last);
      out.pop();
    }
  }
  return out.length ? out : [barSteps];
}

function makeMotif(rng: Rng, pool: number[][], leap: number, barSteps: number): Motif {
  const rhythm = fitRhythm(rng.pick(pool), barSteps);
  const n = rhythm.filter((x) => x > 0).length;
  const shape = rng.pick(['rise', 'fall', 'arch', 'valley'] as const);
  const moves: number[] = [0];
  for (let i = 1; i < n; i++) {
    const firstHalf = i <= n / 2;
    let dir = shape === 'rise' ? 1 : shape === 'fall' ? -1 : shape === 'arch' ? (firstHalf ? 1 : -1) : firstHalf ? -1 : 1;
    if (rng.chance(0.25)) dir = -dir;
    const mag = rng.chance(leap) ? rng.pick([2, 3, 4]) : rng.weighted([[0, 1], [1, 6], [2, 2]] as const);
    moves.push(mag * dir);
  }
  return { rhythm, moves };
}

function varyMotif(rng: Rng, m: Motif, kind: 'invert' | 'tail' | 'same' | 'split'): Motif {
  if (kind === 'invert') return { rhythm: m.rhythm, moves: m.moves.map((x) => -x) };
  if (kind === 'tail') {
    const moves = [...m.moves];
    for (let i = Math.max(1, moves.length - 2); i < moves.length; i++) moves[i] = rng.pick([-2, -1, 1, 2]);
    return { rhythm: m.rhythm, moves };
  }
  if (kind === 'split') {
    // Split the longest even note in two (adds a passing note).
    let idx = -1;
    m.rhythm.forEach((r, i) => {
      if (r >= 4 && r % 2 === 0 && (idx < 0 || r > m.rhythm[idx]!)) idx = i;
    });
    if (idx < 0) return m;
    const rhythm = [...m.rhythm.slice(0, idx), m.rhythm[idx]! / 2, m.rhythm[idx]! / 2, ...m.rhythm.slice(idx + 1)];
    const noteIdx = m.rhythm.slice(0, idx + 1).filter((x) => x > 0).length; // index of note after split
    const moves = [...m.moves.slice(0, noteIdx), rng.pick([-1, 1]), ...m.moves.slice(noteIdx)];
    return { rhythm, moves };
  }
  return m;
}

/** Renders one bar of rhythm + moves starting at startDeg; returns the last degree. */
function renderBar(c: Comp, at: number, m: Motif, startDeg: number, out: MNote[]): number {
  let s = at;
  let prev = startDeg;
  let ni = 0;
  for (const r of m.rhythm) {
    const len = Math.abs(r);
    if (r < 0) {
      s += len;
      continue;
    }
    const move = m.moves[ni] ?? 0;
    let deg = ni === 0 ? startDeg : prev + move;
    deg = clampDeg(c, prev, deg);
    const seg = segAt(c, s);
    const strong = (s % c.barSteps) % (c.meter === 3 ? 12 : 8) === 0 || len >= 8;
    if (strong) deg = snap(deg, seg.cdeg, move);
    out.push({ s, len, deg });
    prev = deg;
    s += len;
    ni++;
  }
  return prev;
}

function renderCadence(c: Comp, rng: Rng, at: number, prev: number, pool: number[][], out: MNote[]): number {
  const rhythm = fitRhythm(rng.pick(pool), c.barSteps);
  const sounding: { s: number; len: number }[] = [];
  let s = at;
  for (const r of rhythm) {
    if (r > 0) sounding.push({ s, len: r });
    s += Math.abs(r);
  }
  const lastNote = sounding[sounding.length - 1]!;
  const seg = segAt(c, lastNote.s);
  const tonicCadence = seg.chord.root === 0;
  const ok = (d: number): boolean => (tonicCadence ? mod(d, 7) === 0 || (mod(d, 7) === 2 && rng.chance(0.15)) : seg.cdeg.includes(mod(d, 7)));
  const target = nearestWhere(prev, ok, c.lo, c.hi);
  const dir = prev >= target ? 1 : -1;
  const n = sounding.length;
  sounding.forEach((note, i) => {
    const deg = Math.max(c.lo, Math.min(c.hi, target + (n - 1 - i) * dir));
    out.push({ s: note.s, len: note.len, deg });
  });
  return target;
}

/** A four-bar phrase: motif, varied motif, motif restated over new harmony, cadence. */
function phrase4(c: Comp, rng: Rng, motif: Motif, bar0: number, startDeg: number, cadPool: number[][], out: MNote[]): void {
  const bs = c.barSteps;
  const s1 = snap(startDeg, segAt(c, bar0 * bs).cdeg, 1);
  let last = renderBar(c, bar0 * bs, motif, s1, out);

  const kind = rng.pick(['invert', 'tail', 'same', 'split', 'tail'] as const);
  const v = varyMotif(rng, motif, kind);
  const seqStep = rng.pick([-1, 1, 2, -2, 0]);
  const s2 = kind === 'same' || kind === 'split' ? s1 + seqStep : last + rng.pick([-1, 1]);
  last = renderBar(c, (bar0 + 1) * bs, v, clampDeg(c, last, s2), out);

  const s3 = snap(s1 + rng.pick([0, 0, 1, 2, -1]), segAt(c, (bar0 + 2) * bs).cdeg, 1);
  const v3 = rng.chance(0.3) ? varyMotif(rng, motif, 'tail') : motif;
  last = renderBar(c, (bar0 + 2) * bs, v3, s3, out);

  renderCadence(c, rng, (bar0 + 3) * bs, last, cadPool, out);
}

function chordMidis(tonic: number, chord: Chord, lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let m = lo; m <= hi; m++) if (chord.tones.includes(mod(m - tonic, 12))) out.push(m);
  return out;
}

function voiceLead(prev: number[] | null, cands: number[], n: number, center: number): number[] {
  if (cands.length === 0) return [];
  if (!prev || prev.length === 0) {
    let start = 0;
    let best = Infinity;
    for (let i = 0; i + n <= cands.length; i++) {
      const avg = cands.slice(i, i + n).reduce((a, b) => a + b, 0) / n;
      if (Math.abs(avg - center) < best) {
        best = Math.abs(avg - center);
        start = i;
      }
    }
    return cands.slice(start, start + n);
  }
  const used = new Set<number>();
  const out: number[] = [];
  for (const p of prev) {
    let bestM = cands[0]!;
    let bd = Infinity;
    for (const m of cands) {
      if (used.has(m)) continue;
      const d = Math.abs(m - p) + (Math.abs(m - center) > 9 ? 3 : 0);
      if (d < bd) {
        bd = d;
        bestM = m;
      }
    }
    used.add(bestM);
    out.push(bestM);
  }
  return out.sort((a, b) => a - b);
}

function rootMidi(tonic: number, chord: Chord, lo: number): number {
  return lo + mod(tonic + chord.root - lo, 12);
}

// ---------------------------------------------------------------------------
// Accompaniment generators

function genBass(c: Comp, rng: Rng, style: BassStyle): SNote[] {
  const out: SNote[] = [];
  const approach = rng.pick([-1, 2, -2]);
  c.segs.forEach((seg, i) => {
    const next = c.segs[i + 1] ?? c.segs[0]!;
    const r = rootMidi(c.tonic, seg.chord, 31);
    const fifth = r + mod(seg.chord.tones[2]! - seg.chord.root, 12);
    const nr = rootMidi(c.tonic, next.chord, 31);
    const end = seg.start + seg.len;
    if (seg.ending) {
      out.push({ s: seg.start, len: seg.len, m: r, v: 0.7 });
      return;
    }
    switch (style) {
      case 'drone':
        out.push({ s: seg.start, len: seg.len, m: r, v: 0.7 });
        break;
      case 'half': {
        const half = seg.len >= 8 ? seg.len / 2 : seg.len;
        for (let s = seg.start, k = 0; s < end; s += half, k++) out.push({ s, len: half, m: k % 2 ? fifth - 12 * (fifth > r + 7 ? 1 : 0) : r, v: 0.8 });
        break;
      }
      case 'march':
        for (let s = seg.start, k = 0; s < end; s += 4, k++) {
          const m = k % 2 === 0 ? r : k % 4 === 1 ? fifth : fifth - 12;
          out.push({ s, len: 3, m: Math.max(28, m), v: k % 2 === 0 ? 0.85 : 0.7 });
        }
        break;
      case 'waltz':
        out.push({ s: seg.start, len: 4, m: Math.floor(seg.start / c.barSteps) % 2 ? fifth - 12 : r, v: 0.85 });
        break;
      case 'eighthsOct': {
        const pat = [0, 0, 12, 0, 0, 12, 0, 12];
        for (let s = seg.start, k = 0; s < end; s += 2, k++) {
          let m = r + pat[k % pat.length]!;
          if (s === end - 2 && nr !== r) m = nr + approach;
          out.push({ s, len: 1.7, m, v: k % 2 === 0 ? 0.9 : 0.72 });
        }
        break;
      }
      case 'chromatic': {
        const count = seg.len / 2;
        let diff = nr - r;
        if (diff > 6) diff -= 12;
        if (diff < -6) diff += 12;
        const walk = Math.min(3, Math.abs(diff) > 0 ? 3 : 0);
        for (let k = 0; k < count; k++) {
          const s = seg.start + k * 2;
          let m = r + (k % 4 === 2 ? 12 : 0);
          const fromEnd = count - k;
          if (walk && fromEnd <= walk) m = r + diff - Math.sign(diff || 1) * fromEnd;
          out.push({ s, len: 1.7, m, v: k % 2 === 0 ? 0.92 : 0.75 });
        }
        break;
      }
      case 'syncop': {
        for (let base = seg.start; base < end; base += 8) {
          out.push({ s: base, len: 2.5, m: r, v: 0.9 });
          out.push({ s: base + 3, len: 2.5, m: r, v: 0.75 });
          out.push({ s: base + 6, len: 1.7, m: r + 12, v: 0.8 });
        }
        break;
      }
    }
  });
  return out;
}

function genAccomp(c: Comp, rng: Rng, style: AccompStyle): SNote[] {
  const out: SNote[] = [];
  const stabPats = [[0, 3, 6, 10, 12], [2, 6, 10, 14], [0, 6, 8, 14], [3, 6, 11, 14], [0, 3, 6, 8, 11, 14]];
  const stabPat = rng.pick(stabPats);
  const ostPats = [[0, 2, 1, 2, 3, 2, 1, 2], [0, 1, 2, 1, 0, 1, 3, 1], [0, 2, 3, 2, 1, 2, 3, 2], [0, 3, 2, 1, 0, 3, 2, 1]];
  const ost = rng.pick(ostPats);
  const neighbour = rng.chance(0.5);
  let prevVoicing: number[] | null = null;
  for (const seg of c.segs) {
    if (seg.ending && style !== 'harpArp4') continue;
    const end = seg.start + seg.len;
    switch (style) {
      case 'harpArp8':
      case 'harpArp4':
      case 'arp16': {
        const unit = style === 'arp16' ? 1 : style === 'harpArp8' ? 2 : 4;
        const tones = chordMidis(c.tonic, seg.chord, style === 'arp16' ? 55 : 57, style === 'arp16' ? 79 : 74);
        if (tones.length === 0) break;
        const up = [...tones, ...tones.slice(1, -1).reverse()];
        for (let s = seg.start; s < end; s += unit) {
          const k = (s - seg.start) / unit;
          if (seg.ending && k >= 4) break;
          out.push({ s, len: unit * 1.5, m: up[k % up.length]!, v: (s % 4 === 0 ? 0.6 : 0.45) });
        }
        break;
      }
      case 'pahpah': {
        const v = voiceLead(prevVoicing, chordMidis(c.tonic, seg.chord, 57, 72), 2, 64);
        prevVoicing = v;
        for (let s = seg.start; s < end; s += 4) {
          if (s % c.barSteps === 0) continue;
          for (const m of v) out.push({ s, len: 2.5, m, v: 0.5 });
        }
        break;
      }
      case 'offbeat': {
        const v = voiceLead(prevVoicing, chordMidis(c.tonic, seg.chord, 57, 72), 2, 64);
        prevVoicing = v;
        for (let s = seg.start + 2; s < end; s += 4) for (const m of v) out.push({ s, len: 1.5, m, v: 0.55 });
        break;
      }
      case 'stabs': {
        const v = voiceLead(prevVoicing, chordMidis(c.tonic, seg.chord, 58, 74), 2, 66);
        prevVoicing = v;
        for (let bar = seg.start; bar < end; bar += 16) {
          for (const p of stabPat) {
            if (bar + p >= end) continue;
            for (const m of v) out.push({ s: bar + p, len: 1.6, m, v: p === 0 ? 0.7 : 0.55 });
          }
        }
        break;
      }
      case 'ostinato': {
        const tones = chordMidis(c.tonic, seg.chord, rootMidi(c.tonic, seg.chord, 50), rootMidi(c.tonic, seg.chord, 50) + 12);
        for (let s = seg.start; s < end; s += 2) {
          const k = Math.floor(s / 2) % ost.length;
          let m = tones[ost[k]! % tones.length]!;
          if (neighbour && k === 5) m = tones[0]! + 1; // a dark semitone neighbour
          out.push({ s, len: 2.2, m, v: k === 0 ? 0.6 : 0.45 });
        }
        break;
      }
    }
  }
  return out;
}

function genPad(c: Comp, voices: number): SNote[] {
  const out: SNote[] = [];
  let prev: number[] | null = null;
  for (const seg of c.segs) {
    const v = voiceLead(prev, chordMidis(c.tonic, seg.chord, 52, 76), voices, 63);
    prev = v;
    for (const m of v) out.push({ s: seg.start, len: seg.len, m, v: 0.5 });
  }
  return out;
}

function genCounter(c: Comp, style: CounterStyle, lead: SNote[]): SNote[] {
  const out: SNote[] = [];
  if (style === 'thirds') {
    for (const n of lead) {
      if (n.len < 2) continue;
      const seg = segAt(c, n.s);
      const cands = chordMidis(c.tonic, seg.chord, n.m - 9, n.m - 3);
      if (cands.length) out.push({ s: n.s, len: n.len, m: cands[cands.length - 1]!, v: n.v * 0.8 });
    }
    return out;
  }
  // 'guide': a slow line of chord thirds/fifths, voice-led, moving on the half bar.
  let prev = 62;
  for (const seg of c.segs) {
    const half = c.meter === 4 && seg.len >= 16 ? seg.len / 2 : seg.len;
    for (let s = seg.start, k = 0; s < seg.start + seg.len; s += half, k++) {
      const cands = chordMidis(c.tonic, seg.chord, 55, 71).filter((m) => (k === 0 ? true : m !== prev));
      if (!cands.length) continue;
      const third = cands.filter((m) => mod(m - c.tonic, 12) === seg.chord.tones[1]);
      const pool = k === 0 && third.length ? third : cands;
      let best = pool[0]!;
      for (const m of pool) if (Math.abs(m - prev) < Math.abs(best - prev)) best = m;
      out.push({ s, len: half, m: best, v: 0.55 });
      prev = best;
    }
  }
  return out;
}

function genDrums(c: Comp, rng: Rng, style: DrumStyle, phraseBars: number, totalBars: number): SDrum[] {
  const out: SDrum[] = [];
  if (style === 'none') return out;
  const bs = c.barSteps;
  const hatTicks = Array.from({ length: totalBars }, () => rng.chance(0.4));
  for (let bar = 0; bar < totalBars; bar++) {
    const b0 = bar * bs;
    const pos = bar % phraseBars;
    const phraseStart = pos === 0;
    const phraseEnd = pos === phraseBars - 1;
    const seg = segAt(c, b0);
    if (seg.ending) continue;
    const timp = rootMidi(c.tonic, seg.chord, 41);
    const add = (s: number, k: DrumKind, v: number, m?: number): void => {
      out.push(m === undefined ? { s: b0 + s, k, v } : { s: b0 + s, k, v, m });
    };
    switch (style) {
      case 'timp':
        add(0, 'timpani', 0.8, timp);
        if (bar % 2 === 1) add(8, 'timpani', 0.55, timp + 7 > 52 ? timp - 5 : timp + 7);
        if (phraseStart) add(0, 'crash', 0.45);
        if (phraseEnd) for (let s = 12; s < 16; s++) add(s, 'snare', 0.2 + (s - 12) * 0.1);
        break;
      case 'march':
        add(0, 'kick', 0.8);
        add(8, 'kick', 0.7);
        if (phraseStart) add(0, 'crash', 0.5);
        for (let s = 0; s < 16; s += 2) add(s, 'hat', s % 4 === 0 ? 0.3 : 0.2);
        if (phraseEnd) {
          add(4, 'snare', 0.7);
          for (let s = 8; s < 16; s++) add(s, 'snare', 0.3 + (s - 8) * 0.07);
        } else {
          add(4, 'snare', 0.7);
          add(12, 'snare', 0.7);
          if (bar % 2) {
            add(14, 'snare', 0.25);
            add(15, 'snare', 0.3);
          }
        }
        break;
      case 'waltz':
        add(4, 'hat', 0.18);
        add(8, 'hat', 0.14);
        if (phraseStart && bar % 8 === 0) add(0, 'timpani', 0.35, timp);
        break;
      case 'sparse':
        if (bar % 2 === 0) add(0, 'timpani', 0.55, timp);
        if (hatTicks[bar]) add(10, 'hat', 0.15);
        if (phraseEnd) add(12, 'tom', 0.4, 45);
        break;
      case 'battle':
      case 'final':
        add(0, 'kick', 0.95);
        add(6, 'kick', 0.7);
        add(8, 'kick', 0.85);
        if (bar % 2) add(10, 'kick', 0.6);
        if (phraseStart) add(0, 'crash', 0.6);
        if (style === 'final') {
          add(0, 'timpani', 0.8, timp);
          if (bar % 2 === 0) add(8, 'timpani', 0.6, timp);
        }
        if (phraseEnd) {
          add(4, 'snare', 0.85);
          add(8, 'snare', 0.6);
          add(10, 'snare', 0.7);
          [12, 13, 14, 15].forEach((s, i) => add(s, i < 2 ? 'snare' : 'tom', 0.6 + i * 0.1, 50 - i * 3));
          if (style === 'final') for (let s = 12; s < 16; s++) add(s, 'timpani', 0.4 + (s - 12) * 0.1, timp);
        } else {
          add(4, 'snare', 0.85);
          add(12, 'snare', 0.85);
          for (let s = 0; s < 16; s += 2) add(s, 'hat', s % 4 === 2 ? 0.4 : 0.25);
        }
        break;
      case 'boss':
        for (const s of [0, 3, 6, 8, 11, 14]) add(s, 'kick', s === 0 || s === 8 ? 0.95 : 0.7);
        if (pos % 2 === 0) add(0, 'crash', phraseStart ? 0.65 : 0.4);
        if (phraseEnd) {
          add(4, 'snare', 0.85);
          for (let s = 8; s < 16; s++) add(s, s >= 12 ? 'tom' : 'snare', 0.5 + (s - 8) * 0.06, 52 - (s - 12) * 2);
        } else {
          add(4, 'snare', 0.9);
          add(12, 'snare', 0.9);
          for (let s = 0; s < 16; s++) add(s, 'hat', s % 2 ? 0.16 : 0.3);
        }
        break;
      case 'half':
        add(0, 'kick', 0.9);
        add(10, 'kick', 0.7);
        add(8, 'snare', 0.85);
        for (let s = 0; s < 16; s += 2) add(s, s % 4 === 2 ? 'openHat' : 'hat', s % 4 === 2 ? 0.18 : 0.25);
        if (phraseStart) add(0, 'crash', 0.5);
        if (phraseEnd) [12, 13, 14, 15].forEach((s, i) => add(s, 'tom', 0.6 + i * 0.08, 52 - i * 3));
        else if (bar % 2) {
          add(14, 'tom', 0.45, 47);
          add(15, 'tom', 0.5, 43);
        }
        break;
      case 'light':
        add(0, 'kick', 0.6);
        add(8, 'kick', 0.5);
        add(4, 'snare', 0.45);
        add(12, 'snare', 0.45);
        for (let s = 0; s < 16; s += 2) add(s, 'hat', 0.2);
        break;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Assembly helpers

function toPart(name: string, inst: InstName, gain: number, pan: number, echo: number, notes: SNote[], gate = 0.92): Part {
  return {
    name, inst, gain, pan, echo,
    notes: notes.map((n) => ({ t: n.s / SPB, d: (n.len * (n.len >= 8 ? 0.98 : gate)) / SPB, m: n.m, v: n.v })),
  };
}

function toDrums(d: SDrum[]): DrumEv[] {
  return d
    .map((x) => (x.m === undefined ? { t: x.s / SPB, k: x.k, v: x.v } : { t: x.s / SPB, k: x.k, v: x.v, m: x.m }))
    .sort((a, b) => a.t - b.t);
}

function leadNotes(c: Comp, rng: Rng, mel: MNote[]): SNote[] {
  return mel.map((n) => {
    const seg = segAt(c, n.s);
    const strong = n.s % (c.meter === 3 ? 12 : 8) === 0;
    return { s: n.s, len: n.len, m: c.leadBase + degToSemis(n.deg, seg.scale), v: 0.74 + (strong ? 0.12 : 0) + rng.next() * 0.06 };
  });
}

function leadBaseFor(tonic: number): number {
  return 57 + mod(tonic - 9, 12); // tonic between A3 and G#4
}

function keyName(tonic: number, mode: ModeName): string {
  return `${PC_NAMES[mod(tonic, 12)]} ${mode}`;
}

// ---------------------------------------------------------------------------
// Mood-driven composition

function composeMood(track: Exclude<TrackName, 'victory'>, variant: number, seed: number): Song {
  const mood = MOODS[track];
  const rng = makeRng(seed);
  const tonic = rng.pick(mood.tonics);
  const modeName = rng.pick(mood.modes);
  const mode = MODES[modeName];
  const bpm = rng.int(mood.bpm[0], mood.bpm[1]);
  const form = rng.pick(mood.forms);
  const turnaround = rng.pick(mood.turnaround);
  const letters = form.split('');
  const unique = [...new Set(letters)];
  const tonicSym = mode[2] === 4 ? 'I' : 'i';

  // Progressions per letter (A and B use different pool entries; B prefers a non-tonic start).
  const used = new Set<number>();
  const progOf: Record<string, string[]> = {};
  unique.forEach((L, li) => {
    const bars: string[] = [];
    for (let h = 0; h < mood.phraseBars / 4; h++) {
      let candidates = mood.progs.map((_, i) => i).filter((i) => !used.has(i));
      if (li > 0 && h === 0) {
        const nonTonic = candidates.filter((i) => parseChord(mood.progs[i]![0]!).root !== 0);
        if (nonTonic.length) candidates = nonTonic;
      }
      if (!candidates.length) candidates = mood.progs.map((_, i) => i);
      const idx = rng.pick(candidates);
      used.add(idx);
      bars.push(...mood.progs[idx]!);
    }
    progOf[L] = bars;
  });

  const occ = letters.map((L, i) => {
    const ch = [...progOf[L]!];
    const lastIdx = ch.length - 1;
    if (i === letters.length - 1) ch[lastIdx] = mood.loop && turnaround ? turnaround : tonicSym;
    else if (i > 0 && letters[i - 1] === L) ch[lastIdx] = tonicSym;
    return ch;
  });

  const meter = mood.meter;
  const barSteps = meter * SPB;
  const segs: Seg[] = [];
  let bar = 0;
  for (const ch of occ) for (const sym of ch) segs.push(makeSeg({ mode }, (bar++) * barSteps, barSteps, sym));
  const bodyBars = bar;
  const endingBars = mood.loop ? 0 : 2;
  for (let i = 0; i < endingBars; i++) segs.push(makeSeg({ mode }, (bar++) * barSteps, barSteps, tonicSym, true));
  const totalBars = bar;

  const c: Comp = { meter, barSteps, tonic, mode, segs, leadBase: leadBaseFor(tonic), lo: 0, hi: 10 };

  // Melody.
  const motifs: Record<string, Motif> = {};
  const startDegs: Record<string, number> = {};
  unique.forEach((L, i) => {
    motifs[L] = makeMotif(rng.fork(`motif-${L}`), mood.rhythms, mood.leap, barSteps);
    startDegs[L] = i === 0 ? rng.pick([2, 4, 4, 7]) : rng.pick([5, 6, 7, 8]);
  });
  const mel: MNote[] = [];
  letters.forEach((L, i) => {
    const b0 = i * mood.phraseBars;
    phrase4(c, rng.fork(`phrase-${L}-a`), motifs[L]!, b0, startDegs[L]!, mood.cadences, mel);
    if (mood.phraseBars === 8) {
      phrase4(c, rng.fork(`phrase-${L}-b`), motifs[L]!, b0 + 4, startDegs[L]! + (L === 'A' ? 0 : 1), mood.cadences, mel);
    }
  });
  if (endingBars) {
    const last = mel[mel.length - 1];
    const deg = last ? nearestWhere(last.deg, (d) => mod(d, 7) === 0, c.lo, c.hi) : 7;
    mel.push({ s: bodyBars * barSteps, len: endingBars * barSteps - 2, deg });
  }
  const lead = leadNotes(c, rng, mel);

  const parts: Part[] = [toPart('lead', mood.lead.inst, mood.lead.gain, 0, 0.32, lead, 0.94)];
  if (mood.counter) parts.push(toPart('counter', mood.counter.inst, mood.counter.gain, -0.3, 0, genCounter(c, mood.counter.style, lead)));
  parts.push(toPart('bass', mood.bass.inst, mood.bass.gain, 0, 0, genBass(c, rng.fork('bass'), mood.bass.style)));
  if (mood.accomp) parts.push(toPart('accomp', mood.accomp.inst, mood.accomp.gain, 0.3, 0.25, genAccomp(c, rng.fork('accomp'), mood.accomp.style)));
  if (mood.pad) parts.push(toPart('pad', mood.pad.inst, mood.pad.gain, -0.15, 0, genPad(c, mood.pad.voices)));
  const drums = toDrums(genDrums(c, rng.fork('drums'), mood.drums, mood.phraseBars, totalBars));

  const beats = totalBars * meter + (mood.loop ? 0 : meter);
  return {
    track, variant, seed, bpm, meter, tonic, mode: modeName, form: mood.loop ? form : `${form} (no loop)`,
    key: keyName(tonic, modeName),
    sections: [{ beats, parts, drums }],
    loopFrom: mood.loop ? 0 : null,
  };
}

// ---------------------------------------------------------------------------
// Victory: a short fanfare, then a cheerful two-bar loop.

function composeVictory(variant: number, seed: number): Song {
  const rng = makeRng(seed);
  const tonic = rng.pick([0, 2, 3, 5, 7, 10]);
  const mode = MODES.ionian;
  const bpm = rng.int(132, 144);
  const leadBase = leadBaseFor(tonic);

  // Fanfare: I | IV V | I (held)
  const fSegs = [
    makeSeg({ mode }, 0, 16, 'I'),
    makeSeg({ mode }, 16, 8, 'IV'),
    makeSeg({ mode }, 24, 8, 'V'),
    makeSeg({ mode }, 32, 16, 'I'),
  ];
  const fc: Comp = { meter: 4, barSteps: 16, tonic, mode, segs: fSegs, leadBase, lo: 0, hi: 11 };
  const mel: MNote[] = [];
  // Bar 1: rising arpeggio through chord tones.
  const r1 = rng.pick([[2, 2, 4, 8], [3, 1, 4, 8], [4, 2, 2, 8], [6, 2, 8], [2, 2, 2, 2, 8]]);
  let deg = rng.pick([0, 2, 4]);
  let s = 0;
  r1.forEach((len, i) => {
    if (i > 0) {
      deg += 1;
      while (!fSegs[0]!.cdeg.includes(mod(deg, 7))) deg++;
    }
    mel.push({ s, len, deg: Math.min(deg, 9) });
    s += len;
  });
  // Bar 2: stepwise answer over IV then V.
  const r2 = rng.pick([[4, 4, 4, 4], [6, 2, 6, 2], [4, 2, 2, 4, 4], [3, 1, 4, 3, 1, 4]]);
  const dir = rng.pick([1, -1]);
  const moves = r2.map((_, i) => (i === 0 ? 0 : dir * (i % 3 === 2 ? -1 : 1)));
  const last = renderBar(fc, 16, { rhythm: r2, moves }, snap(Math.min(deg, 9) - 1, fSegs[1]!.cdeg, -1), mel);
  // Bar 3: land on a high chord tone and hold.
  const target = nearestWhere(Math.max(last, 7), (d) => mod(d, 7) === 0 || mod(d, 7) === 2, 7, 11);
  if (rng.chance(0.5)) {
    mel.push({ s: 32, len: 2, deg: target - 1 });
    mel.push({ s: 34, len: 14, deg: target });
  } else mel.push({ s: 32, len: 16, deg: target });
  const fLead = leadNotes(fc, rng, mel).map((n) => ({ ...n, v: Math.min(1, n.v + 0.08) }));
  const fBass: SNote[] = [
    { s: 0, len: 8, m: rootMidi(tonic, fSegs[0]!.chord, 31), v: 0.85 },
    { s: 8, len: 8, m: rootMidi(tonic, fSegs[0]!.chord, 31) + 7, v: 0.75 },
    { s: 16, len: 8, m: rootMidi(tonic, fSegs[1]!.chord, 31), v: 0.85 },
    { s: 24, len: 8, m: rootMidi(tonic, fSegs[2]!.chord, 31), v: 0.85 },
    { s: 32, len: 16, m: rootMidi(tonic, fSegs[3]!.chord, 31), v: 0.85 },
  ];
  const fDrums: SDrum[] = [
    { s: 0, k: 'crash', v: 0.55 }, { s: 0, k: 'timpani', v: 0.8, m: rootMidi(tonic, fSegs[0]!.chord, 41) },
    { s: 16, k: 'timpani', v: 0.6, m: rootMidi(tonic, fSegs[1]!.chord, 41) },
    { s: 24, k: 'timpani', v: 0.6, m: rootMidi(tonic, fSegs[2]!.chord, 41) },
    ...Array.from({ length: 8 }, (_, i): SDrum => ({ s: 24 + i, k: 'snare', v: 0.3 + i * 0.07 })),
    { s: 32, k: 'crash', v: 0.7 }, { s: 32, k: 'kick', v: 0.9 },
    { s: 32, k: 'timpani', v: 0.9, m: rootMidi(tonic, fSegs[3]!.chord, 41) },
  ];
  const fanfare: Section = {
    beats: 12,
    parts: [
      toPart('lead', 'brass', 1.1, 0, 0.3, fLead, 0.9),
      toPart('counter', 'horn', 0.7, -0.3, 0, genCounter(fc, 'thirds', fLead)),
      toPart('bass', 'contrabass', 1, 0, 0, fBass),
      toPart('pad', 'stringPad', 0.8, -0.15, 0, genPad(fc, 3)),
    ],
    drums: toDrums(fDrums),
  };

  // Loop: two cheerful bars, two chords per bar.
  const prog = rng.pick([['I', 'IV', 'I', 'V'], ['I', 'vi', 'IV', 'V'], ['I', 'V', 'IV', 'V'], ['I', 'iii', 'IV', 'V']]);
  const lSegs = prog.map((sym, i) => makeSeg({ mode }, i * 8, 8, sym));
  const lc: Comp = { meter: 4, barSteps: 16, tonic, mode, segs: lSegs, leadBase, lo: 2, hi: 10 };
  const lr = rng.fork('loop');
  const motif = makeMotif(lr, [[2, 2, 4, 4, 4], [4, 2, 2, 4, 4], [3, 1, 3, 1, 4, 4], [2, 2, 2, 2, 8]], 0.3, 16);
  const lMel: MNote[] = [];
  const l1 = renderBar(lc, 0, motif, snap(rng.pick([4, 7]), lSegs[0]!.cdeg, 1), lMel);
  renderBar(lc, 16, varyMotif(lr, motif, 'tail'), clampDeg(lc, l1, l1 + lr.pick([-1, 1])), lMel);
  const lLead = leadNotes(lc, lr, lMel);
  const loop: Section = {
    beats: 8,
    parts: [
      toPart('lead', 'flute', 1, 0, 0.3, lLead),
      toPart('bass', 'bass', 0.95, 0, 0, genBass(lc, lr, 'march')),
      toPart('accomp', 'pizz', 0.75, 0.3, 0.2, genAccomp(lc, lr, 'offbeat')),
    ],
    drums: toDrums(genDrums(lc, lr, 'light', 2, 2)),
  };

  return {
    track: 'victory', variant, seed, bpm, meter: 4, tonic, mode: 'ionian', form: 'fanfare + loop',
    key: keyName(tonic, 'ionian'), sections: [fanfare, loop], loopFrom: 1,
  };
}

// ---------------------------------------------------------------------------

export function songSeed(track: TrackName, variant: number): number {
  return hashString(`fantastic-chronicle/${track}/${variant | 0}`);
}

/** Deterministic: the same track + variant always yields the same song. */
export function composeSong(track: TrackName, variant = 0): Song {
  const v = Number.isFinite(variant) ? Math.trunc(variant) : 0;
  const seed = songSeed(track, v);
  return track === 'victory' ? composeVictory(v, seed) : composeMood(track, v, seed);
}

/** Highest number of notes sounding at once (music voices), for tests/diagnostics. */
export function maxPolyphony(song: Song): number {
  let max = 0;
  for (const sec of song.sections) {
    const evs: [number, number][] = [];
    for (const p of sec.parts) for (const n of p.notes) {
      evs.push([n.t, 1]);
      evs.push([n.t + n.d, -1]);
    }
    for (const d of sec.drums) {
      evs.push([d.t, 1]);
      evs.push([d.t + 0.25, -1]);
    }
    evs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let cur = 0;
    for (const [, x] of evs) {
      cur += x;
      max = Math.max(max, cur);
    }
  }
  return max;
}
