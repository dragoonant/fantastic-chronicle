// Balance simulator: npm run sim -- [runs per hero=40]
import { HERO_IDS } from '../src/engine/content/heroes';
import { playOut } from '../src/engine/bot';
import { newRun } from '../src/engine/run';

const N = Number(process.argv[2] ?? 40);
const rows: string[] = [];
let wins = 0, total = 0;
for (const [i, id] of HERO_IDS.entries()) {
  let w = 0, seasons = 0, sparks = 0, battles = 0, chron = 0, deaths = 0, finals = 0, lpLeft = 0;
  const ends: Record<string, number> = {};
  for (let k = 0; k < N; k++) {
    const run = playOut(newRun(1000 * i + k + 1, id, HERO_IDS[(i + 1 + (k % 7)) % 8]), 20000);
    total++;
    if (run.outcome === 'victory') { w++; wins++; }
    seasons += run.season; sparks += run.sparksTotal; battles += run.battleCount; deaths += run.successors;
    if (run.chronicle.done) chron++;
    if (run.final) finals++;
    lpLeft += run.party.find((p) => !p.isCompanion)?.lp ?? 0;
    const last = run.log[run.log.length - 1] + (run.phase !== 'over' ? ` [stuck in ${run.phase}]` : '');
    const key = last.replace(/[0-9]+/g, '#').slice(0, 70);
    ends[key] = (ends[key] ?? 0) + 1;
  }
  rows.push(`${id.padEnd(9)} win ${(100 * w / N).toFixed(0).padStart(3)}%  chronicle ${(100 * chron / N).toFixed(0).padStart(3)}%  final ${(100 * finals / N).toFixed(0).padStart(3)}%  seasons ${(seasons / N).toFixed(1)}  battles ${(battles / N).toFixed(1)}  sparks ${(sparks / N).toFixed(1)}  successions ${(deaths / N).toFixed(2)}  lp ${(lpLeft / N).toFixed(1)}`);
  rows.push('    ends: ' + Object.entries(ends).sort((a, z) => z[1] - a[1]).slice(0, 3).map(([k, v]) => `${v}x ${k}`).join(' | '));
}
console.log(rows.join('\n'));
console.log(`overall win ${(100 * wins / total).toFixed(1)}% of ${total} runs`);
