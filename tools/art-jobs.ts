// Builds art-masters/hf/jobs.json from game content: npx vite-node tools/art-jobs.ts
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { MONSTERS } from '../src/engine/content/monsters';
import { REGIONS, TERRITORIES } from '../src/engine/content/map';

const STYLE = '16-bit pixel art from a mid-1990s console role-playing game, crisp square pixels, limited palette, dark outlines, dithered shading';
const sheets = JSON.parse(readFileSync('tools/art/sheets.json', 'utf8'));
const heroLooks: [string, string][] = sheets.sheets.find((s: { id: string }) => s.id === 'heroes').items;
const jobs: { kind: string; id: string; prompt: string; w: number; h: number; seed: number }[] = [];
let seed = 11;
for (const [id, text] of heroLooks) {
  const look = text.replace(/^[^:]+:\s*/, '');
  jobs.push({ kind: 'hero', id, prompt: `${STYLE}, a battle sprite of ${look}, full body, standing in a three-quarter view, plain black background`, w: 512, h: 640, seed: seed++ });
}
for (const m of Object.values(MONSTERS)) {
  const size = m.size === 'S' ? 'a small creature' : m.size === 'XL' ? 'a towering boss monster' : m.size === 'L' ? 'a large monster' : 'a monster';
  jobs.push({ kind: 'monster', id: m.id, prompt: `${STYLE}, an enemy battle sprite, ${size}: ${m.look}, full body, facing right, plain black background`, w: 512, h: 512, seed: seed++ });
}
for (const r of Object.values(REGIONS)) {
  const t = TERRITORIES[r.territory];
  const kind = { town: 'a town', wilds: 'a wild landscape', dungeon: 'a dungeon entrance', seat: 'a sinister stronghold' }[r.type];
  jobs.push({ kind: 'region', id: r.id, prompt: `${STYLE}, a background scene of ${kind} called ${r.name} in ${t.name}: ${r.text} Wide landscape view, no people, no text`, w: 768, h: 512, seed: seed++ });
}
const cardScenes: Record<string, string> = {
  sword: 'a gleaming longsword cutting a crescent of pale blue light', greatsword: 'a huge greatsword smashing into the ground with a shockwave',
  axe: 'a heavy battle axe splitting a shield in a burst of sparks', spear: 'a spear thrusting forward trailing streaks of light',
  bow: 'arrows flying from a drawn longbow in a forest at dusk', martial: 'a fist striking with a shockwave of energy',
  fire: 'a swirling burst of magical fire', water: 'glowing healing rain falling in blue light', wind: 'a whirling blade of wind and leaves',
  earth: 'stone walls bursting up from the ground', celestial: 'a radiant halo of holy golden light', abyssal: 'a dark violet void with drifting souls',
  item: 'a potion bottle, herbs and a phoenix feather on a wooden table', story: 'an old letter sealed with red wax beside a candle', destiny: 'a legendary weapon floating in a beam of golden light',
  guard: 'a battered round shield on a stone floor', move: 'boots striding across a stone floor',
};
for (const [id, scene] of Object.entries(cardScenes)) jobs.push({ kind: 'cardtype', id, prompt: `${STYLE}, a card illustration of ${scene}, centred, dark background, no text`, w: 512, h: 384, seed: seed++ });
mkdirSync('art-masters/hf', { recursive: true });
writeFileSync('art-masters/hf/jobs.json', JSON.stringify(jobs, null, 1));
console.log(jobs.length, 'jobs');
