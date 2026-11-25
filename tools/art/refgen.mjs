// Flux klein edit mode with style references: node tools/art/refgen.mjs <out-prefix> <seed> "<prompt>" <ref1.png> [ref2.png]
import { readFileSync, writeFileSync } from 'node:fs';
const [out, seed, prompt, ...refs] = process.argv.slice(2);
const H = 'http://127.0.0.1:7880';
const post = async (p, b) => (await fetch(H + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) })).json();
const images = refs.map((f) => 'data:image/png;base64,' + readFileSync(f).toString('base64'));
await post('/api/settings', { freeAfter: false });
const j = await post('/api/jobs', { model: 'klein', mode: 'edit', prompt, images, aspect: '4:3', megapixels: 1, batch: 4, seed: Number(seed) });
if (!j.id) { console.error(j); process.exit(1); }
let st;
for (let i = 0; i < 400; i++) { st = await (await fetch(`${H}/api/jobs/${j.id}`)).json(); if (['done','failed','cancelled'].includes(st.status)) break; await new Promise(r => setTimeout(r, 1500)); }
if (st.status !== 'done') { console.error(st.status, st.error, st.log); process.exit(1); }
for (const [i, n] of st.images.entries()) writeFileSync(`${out}-${i + 1}.png`, Buffer.from(await (await fetch(`${H}/files/${j.id}/${n}`)).arrayBuffer()));
await post('/api/settings', { freeAfter: true });
console.log('ok', st.images.length, st.params.width + 'x' + st.params.height);
