// Battle outcome diagnostics: npx vite-node tools/diag.ts [runs=60]
import { HERO_IDS } from '../src/engine/content/heroes';
import { botStep } from '../src/engine/bot';
import { newRun } from '../src/engine/run';

const N = Number(process.argv[2] ?? 60);
const stat: Record<string, { w: number; l: number; rounds: number; lpLost: number }> = {};
const evilRounds: number[] = [];
for (let k = 0; k < N; k++) {
  const id = HERO_IDS[k % 8];
  const run = newRun(5000 + k, id, HERO_IDS[(k + 3) % 8]);
  for (let i = 0; i < 20000; i++) {
    if (run.phase === 'battle' && run.battle?.over) {
      const b = run.battle;
      const key = b.kind === 'evil' ? `evil t${b.evilTier}` : b.kind;
      const s = (stat[key] ??= { w: 0, l: 0, rounds: 0, lpLost: 0 });
      if (b.over === 'win') s.w++; else s.l++;
      s.rounds += b.round;
      s.lpLost += b.events.filter((e) => e.k === 'lp' && e.n < 0).reduce((a, e) => a + (e.k === 'lp' ? -e.n : 0), 0);
      if (b.kind === 'evil') evilRounds.push(b.round);
    }
    if (!botStep(run)) break;
  }
}
for (const [k, s] of Object.entries(stat).sort()) {
  const n = s.w + s.l;
  console.log(`${k.padEnd(10)} n ${String(n).padStart(4)}  win ${(100 * s.w / n).toFixed(0).padStart(3)}%  rounds ${(s.rounds / n).toFixed(1)}  LP lost/battle ${(s.lpLost / n).toFixed(2)}`);
}
