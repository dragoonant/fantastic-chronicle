// Short fanfares, written as small procedural phrases (arpeggios, scale runs and
// cadence chords), scheduled all at once since they last only a couple of seconds.

import type { DrumEv, InstName } from './composer';
import type { JingleName } from './types';

export interface JNote { t: number; d: number; m: number; v: number; inst: InstName }
export interface Jingle { bpm: number; beats: number; notes: JNote[]; drums: DrumEv[] }

const triad = (root: number, minor = false): number[] => [root, root + (minor ? 3 : 4), root + 7];

function withThirds(lead: JNote[], inst: InstName, below: (m: number) => number): JNote[] {
  return lead.filter((n) => n.d >= 0.5).map((n) => ({ ...n, m: below(n.m), v: n.v * 0.7, inst }));
}

function sparkJingle(): Jingle {
  const base = 62; // D
  const run = [0, 2, 4, 7, 9, 12, 14, 16, 19];
  const notes: JNote[] = run.map((s, i) => ({ t: i * 0.25, d: 0.6, m: base + 12 + s, v: 0.55 + i * 0.04, inst: 'harp' }));
  const hit = 2.25;
  for (const m of [...triad(base), base + 12]) notes.push({ t: hit, d: 1.6, m, v: 0.75, inst: 'brass' });
  notes.push({ t: hit, d: 1.8, m: base + 16, v: 0.7, inst: 'flute' });
  notes.push({ t: hit + 0.5, d: 1.3, m: base + 21, v: 0.55, inst: 'flute' });
  notes.push({ t: hit, d: 1.8, m: base - 24, v: 0.9, inst: 'contrabass' });
  for (const m of [base + 4, base + 9]) notes.push({ t: hit, d: 1.8, m, v: 0.5, inst: 'stringPad' });
  return {
    bpm: 150, beats: 4.5, notes,
    drums: [
      { t: hit, k: 'crash', v: 0.5 },
      { t: hit, k: 'timpani', v: 0.8, m: 38 },
    ],
  };
}

function victoryJingle(): Jingle {
  const C = 60;
  // Rising arpeggio, an answering turn over IV, a held high tonic.
  const lead: JNote[] = [
    { t: 0, d: 0.5, m: C + 7, v: 0.75, inst: 'brass' },
    { t: 0.5, d: 0.5, m: C + 12, v: 0.8, inst: 'brass' },
    { t: 1, d: 0.5, m: C + 16, v: 0.82, inst: 'brass' },
    { t: 1.5, d: 1, m: C + 19, v: 0.9, inst: 'brass' },
    { t: 2.5, d: 0.5, m: C + 17, v: 0.8, inst: 'brass' },
    { t: 3, d: 0.25, m: C + 21, v: 0.8, inst: 'brass' },
    { t: 3.25, d: 0.25, m: C + 19, v: 0.75, inst: 'brass' },
    { t: 3.5, d: 0.5, m: C + 17, v: 0.8, inst: 'brass' },
    { t: 4, d: 2.5, m: C + 24, v: 0.95, inst: 'brass' },
  ];
  const harmony = withThirds(lead, 'horn', (m) => (m - C) % 12 === 0 ? m - 5 : m - 4);
  const bass: JNote[] = [
    { t: 0, d: 1.5, m: 36, v: 0.9, inst: 'contrabass' },
    { t: 1.5, d: 1, m: 43, v: 0.8, inst: 'contrabass' },
    { t: 2.5, d: 1, m: 41, v: 0.85, inst: 'contrabass' },
    { t: 3.5, d: 0.5, m: 43, v: 0.85, inst: 'contrabass' },
    { t: 4, d: 2.5, m: 36, v: 0.9, inst: 'contrabass' },
  ];
  const pad: JNote[] = [
    ...[C + 4, C + 7].map((m) => ({ t: 0, d: 2.5, m, v: 0.5, inst: 'stringPad' as const })),
    ...[C + 5, C + 9].map((m) => ({ t: 2.5, d: 1.5, m, v: 0.5, inst: 'stringPad' as const })),
    ...[C + 4, C + 7, C + 12].map((m) => ({ t: 4, d: 2.5, m, v: 0.55, inst: 'stringPad' as const })),
  ];
  const drums: DrumEv[] = [
    { t: 0, k: 'timpani', v: 0.8, m: 36 },
    ...Array.from({ length: 4 }, (_, i): DrumEv => ({ t: 3 + i * 0.25, k: 'snare', v: 0.35 + i * 0.12 })),
    { t: 4, k: 'crash', v: 0.65 },
    { t: 4, k: 'timpani', v: 0.9, m: 36 },
    { t: 4, k: 'kick', v: 0.8 },
  ];
  return { bpm: 140, beats: 7, notes: [...lead, ...harmony, ...bass, ...pad], drums };
}

function levelUpJingle(): Jingle {
  const F = 65;
  const scale = [0, 2, 4, 5, 7, 9, 11, 12];
  const notes: JNote[] = scale.map((s, i) => ({ t: i * 0.25, d: 0.3, m: F + s, v: 0.6 + i * 0.04, inst: 'strings' }));
  scale.forEach((s, i) => notes.push({ t: i * 0.25, d: 0.25, m: F - 12 + s, v: 0.4, inst: 'pizz' }));
  // IV -> I cadence hits.
  for (const m of triad(F + 5)) notes.push({ t: 2, d: 0.45, m, v: 0.8, inst: 'brass' });
  for (const m of [...triad(F), F + 12]) notes.push({ t: 2.75, d: 1.75, m, v: 0.85, inst: 'brass' });
  notes.push({ t: 2, d: 0.5, m: F - 19, v: 0.9, inst: 'bass' });
  notes.push({ t: 2.75, d: 1.75, m: F - 24, v: 0.9, inst: 'bass' });
  notes.push({ t: 2.75, d: 1.6, m: F + 16, v: 0.6, inst: 'flute' });
  return {
    bpm: 160, beats: 5, notes,
    drums: [
      { t: 2, k: 'snare', v: 0.6 },
      { t: 2.5, k: 'snare', v: 0.5 },
      { t: 2.75, k: 'crash', v: 0.6 },
      { t: 2.75, k: 'kick', v: 0.85 },
      { t: 2.75, k: 'timpani', v: 0.8, m: 41 },
    ],
  };
}

export function makeJingle(name: JingleName): Jingle {
  if (name === 'victory') return victoryJingle();
  if (name === 'levelUp') return levelUpJingle();
  return sparkJingle();
}
