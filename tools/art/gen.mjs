// Renders card art on the local Flux Studio (http://127.0.0.1:7880), one job at a time.
//   node tools/art/gen.mjs [--only <id>] [--batch 4] [--model klein|dev|schnell] [--steps N] [--reroll N] [--dry-run]
// Prompts come from tools/art/prompts.json: one STYLE constant plus a per-item scene clause.
// Masters land in art-masters/<id>-<n>.png (not for the repo). The job params are saved next to them.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const val = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const HOST = process.env.FLUX_URL ?? 'http://127.0.0.1:7880';
const spec = JSON.parse(readFileSync('tools/art/prompts.json', 'utf8'));
const only = val('only', null);
const items = spec.items.filter((p) => !only || p.id === only);
if (!items.length) { console.error(`no prompt with id ${only}`); process.exit(1); }
const batch = Number(val('batch', '4'));
const model = val('model', 'klein');
const steps = val('steps') ? Number(val('steps')) : undefined;
const reroll = Number(val('reroll', '0'));
const seedOf = (id) => { let h = 2166136261; for (const ch of id) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 2000000000) + reroll; };
const promptOf = (p) => `${p.scene}, ${p.figure ? spec.figure + ', ' : ''}${spec.style}`;

for (const p of items) {
  const t = promptOf(p);
  if (t.length > 900) { console.error(`${p.id}: prompt is ${t.length} chars (limit 900)`); process.exit(1); }
  if (/\b(chibi|cute|toy|cartoony|kawaii|nendoroid|gundam|stubby|tiny legs|super-deformed)\b/i.test(t)) { console.error(`${p.id}: banned word`); process.exit(1); }
}
if (flag('dry-run')) { for (const p of items) console.log(`${p.id} [${p.aspect}] seed ${seedOf(p.id)}\n  ${promptOf(p)}\n`); process.exit(0); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function json(url, init) {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${url} -> HTTP ${r.status} ${await r.text()}`);
  return r.json();
}
const post = (path, body) => json(`${HOST}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

mkdirSync('art-masters', { recursive: true });
await post('/api/settings', { freeAfter: false });
for (const p of items) {
  const body = { model, prompt: promptOf(p), aspect: p.aspect, megapixels: 1, batch, seed: seedOf(p.id) };
  if (steps) body.steps = steps;
  const { id: job } = await post('/api/jobs', body);
  process.stdout.write(`${p.id}: job ${job} `);
  let st, last = '';
  for (let i = 0; i < 600; i++) {
    st = await json(`${HOST}/api/jobs/${job}`);
    const ph = `${st.phase || st.status} ${Math.round((st.progress || 0) * 100)}%`;
    if (ph !== last) { process.stdout.write(`| ${ph} `); last = ph; }
    if (['done', 'error', 'failed', 'cancelled'].includes(st.status)) break;
    await sleep(1500);
  }
  console.log();
  if (st.status !== 'done' || !st.images?.length) { console.error(`FAILED ${p.id}: ${st.status} ${st.error || ''}\n${(st.log || []).slice(-10).join('\n')}`); continue; }
  const files = [];
  for (const [i, name] of st.images.entries()) {
    const img = await fetch(`${HOST}/files/${job}/${name}`);
    if (!img.ok) { console.error(`download failed ${name}`); continue; }
    const f = `art-masters/${p.id}-${i + 1}.png`;
    writeFileSync(f, Buffer.from(await img.arrayBuffer()));
    files.push(f);
  }
  writeFileSync(`art-masters/${p.id}.json`, JSON.stringify({ job, params: st.params, prompt: body.prompt, files }, null, 1));
  console.log(`  ok ${files.length} images`);
}
await post('/api/settings', { freeAfter: true });
