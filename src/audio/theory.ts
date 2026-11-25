// Minimal music theory: modes, roman-numeral chords, local scales.

export const MODES = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
} as const satisfies Record<string, readonly number[]>;

export type ModeName = keyof typeof MODES;

export const PC_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

export interface Chord {
  symbol: string;
  /** Root in semitones above the tonic (0..11). */
  root: number;
  /** Chord tones as semitones above the tonic (0..11), root first. */
  tones: number[];
}

export function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

const NUMERALS: readonly (readonly [string, number])[] = [
  ['vii', 11], ['iii', 4], ['vi', 9], ['iv', 5], ['ii', 2], ['v', 7], ['i', 0],
];

/** Parses e.g. 'I', 'iv', 'bVI', 'V7', 'viio', 'bII'. Unknown input gives the tonic triad. */
export function parseChord(symbol: string): Chord {
  let s = symbol;
  let shift = 0;
  while (s.startsWith('b') || s.startsWith('#')) {
    shift += s[0] === 'b' ? -1 : 1;
    s = s.slice(1);
  }
  let degree = 0;
  let upper = true;
  for (const [name, semis] of NUMERALS) {
    if (s.toLowerCase().startsWith(name)) {
      degree = semis;
      upper = s[0] === s[0]!.toUpperCase();
      s = s.slice(name.length);
      break;
    }
  }
  let shape = upper ? [0, 4, 7] : [0, 3, 7];
  if (s.includes('o')) shape = [0, 3, 6];
  if (s.includes('+')) shape = [0, 4, 8];
  if (s.includes('sus')) shape = [0, 5, 7];
  if (s.includes('7')) shape = [...shape, 10];
  const root = mod(degree + shift, 12);
  return { symbol, root, tones: shape.map((x) => mod(root + x, 12)) };
}

/**
 * The mode with notes nudged by a semitone where they clash with a chord tone, so a
 * melody over V in minor uses the leading tone, over bVII in major the flat 7, etc.
 */
export function localScale(mode: readonly number[], chord: Chord): number[] {
  const s = [...mode];
  for (const pc of chord.tones) {
    if (s.includes(pc)) continue;
    let best = -1;
    for (let i = 0; i < s.length; i++) {
      const d = Math.min(mod(s[i]! - pc, 12), mod(pc - s[i]!, 12));
      if (d !== 1 || chord.tones.includes(s[i]!)) continue;
      if (best === -1 || best === 0) best = i; // keep the tonic unless nothing else fits
    }
    if (best >= 0) {
      const cand = [...s];
      cand[best] = pc;
      if (new Set(cand).size === cand.length) s.splice(0, s.length, ...cand);
    }
  }
  return s.sort((a, b) => a - b);
}

/** Scale-degree indices (0..6) of the local scale that are chord tones. */
export function chordDegrees(scale: readonly number[], chord: Chord): number[] {
  const out: number[] = [];
  for (let i = 0; i < scale.length; i++) if (chord.tones.includes(scale[i]!)) out.push(i);
  return out;
}

export function degToSemis(deg: number, scale: readonly number[]): number {
  return scale[mod(deg, 7)]! + 12 * Math.floor(deg / 7);
}
