import type { EvilId, School } from '../types';

export type RegionType = 'town' | 'wilds' | 'dungeon' | 'seat';

export interface Territory { id: string; name: string; evil: EvilId | null; school: School; color: string }
export interface Region {
  id: string; name: string; territory: string; type: RegionType; x: number; y: number; adj: string[];
  text: string;
}

export const TERRITORIES: Record<string, Territory> = {
  highcastle: { id: 'highcastle', name: 'Highcastle', evil: null, school: 'earth', color: '#7a8c4a' },
  reaches: { id: 'reaches', name: 'The Reaches', evil: 'court', school: 'wind', color: '#6a5a9a' },
  saltmarch: { id: 'saltmarch', name: 'Saltmarch', evil: 'drowned', school: 'water', color: '#3a7a8a' },
  ashsteps: { id: 'ashsteps', name: 'The Ash Steps', evil: 'tyrant', school: 'fire', color: '#a0502a' },
  veil: { id: 'veil', name: 'The Veil', evil: 'saint', school: 'celestial', color: '#b0a060' },
  marches: { id: 'marches', name: 'The Marches', evil: 'horde', school: 'abyssal', color: '#6a6a72' },
};

const R: Omit<Region, 'adj'>[] = [
  { id: 'hc-town', name: 'Brennmoor', territory: 'highcastle', type: 'town', x: 40, y: 38, text: 'A market town in the shadow of the fallen castle.' },
  { id: 'hc-road', name: 'Kingsroad', territory: 'highcastle', type: 'wilds', x: 53, y: 35, text: 'The old royal road, now walked by deserters.' },
  { id: 'hc-keep', name: 'Fallen Keep', territory: 'highcastle', type: 'dungeon', x: 33, y: 50, text: 'The broken halls of Highcastle itself.' },
  { id: 're-town', name: 'Vey Hollow', territory: 'reaches', type: 'town', x: 21, y: 16, text: 'A hill village of shepherds and rangers.' },
  { id: 're-fen', name: 'Mistfen', territory: 'reaches', type: 'wilds', x: 34, y: 23, text: 'Marsh lights drift through the reeds.' },
  { id: 're-seat', name: 'Hall of Masks', territory: 'reaches', type: 'seat', x: 11, y: 7, text: 'The Herald holds court among a thousand masks.' },
  { id: 'sm-town', name: 'Saltwick', territory: 'saltmarch', type: 'town', x: 15, y: 57, text: 'A harbour town of shipwrights and fighting pits.' },
  { id: 'sm-shore', name: 'Wreck Shore', territory: 'saltmarch', type: 'wilds', x: 22, y: 44, text: 'Hulls rot on the sand. Some of the crews still walk.' },
  { id: 'sm-bell', name: 'Drowned Bell', territory: 'saltmarch', type: 'dungeon', x: 7, y: 68, text: 'A sunken chapel where a bell still rings under the water.' },
  { id: 'sm-reef', name: "Tidewarden's Reef", territory: 'saltmarch', type: 'seat', x: 27, y: 66, text: 'A reef of wrecks where the Tidewarden keeps watch.' },
  { id: 've-town', name: 'Lantern Abbey', territory: 'veil', type: 'town', x: 68, y: 13, text: 'The last abbey whose lanterns still burn true.' },
  { id: 've-road', name: 'Pale Road', territory: 'veil', type: 'wilds', x: 56, y: 22, text: 'A pilgrim road lined with hollow-eyed shrines.' },
  { id: 've-spire', name: "Penitent's Spire", territory: 'veil', type: 'seat', x: 82, y: 6, text: 'A white tower where the Penitent scourges itself.' },
  { id: 'as-town', name: 'Cinderhold', territory: 'ashsteps', type: 'town', x: 79, y: 36, text: 'A forge city under a sky of ash.' },
  { id: 'as-flats', name: 'Ember Flats', territory: 'ashsteps', type: 'wilds', x: 67, y: 33, text: 'Cracked plains that glow at night.' },
  { id: 'as-forge', name: 'Forge of Chains', territory: 'ashsteps', type: 'seat', x: 92, y: 26, text: 'The Smith of Chains hammers at the heart of the Steps.' },
  { id: 'ma-town', name: 'Gallows Camp', territory: 'marches', type: 'town', x: 64, y: 58, text: 'A camp of deserters, hangmen and black-robed tutors.' },
  { id: 'ma-fields', name: 'Burnt Fields', territory: 'marches', type: 'wilds', x: 52, y: 49, text: 'Farmland trampled flat by the Horde.' },
  { id: 'ma-siege', name: 'Siege Camp', territory: 'marches', type: 'dungeon', x: 77, y: 64, text: 'A war camp of the Horde, deep in trenches.' },
  { id: 'ma-hold', name: "Warlord's Hold", territory: 'marches', type: 'seat', x: 90, y: 52, text: 'The Warlord waits behind iron walls.' },
];

const EDGES: [string, string][] = [
  ['hc-town', 'hc-road'], ['hc-town', 'hc-keep'], ['hc-town', 're-fen'], ['hc-town', 'sm-shore'],
  ['hc-road', 've-road'], ['hc-road', 'as-flats'], ['hc-road', 'ma-fields'], ['hc-keep', 'sm-shore'], ['hc-keep', 'ma-fields'],
  ['re-town', 're-fen'], ['re-town', 're-seat'], ['re-fen', 've-road'],
  ['sm-shore', 'sm-town'], ['sm-town', 'sm-bell'], ['sm-town', 'sm-reef'],
  ['ve-road', 've-town'], ['ve-road', 'as-flats'], ['ve-town', 've-spire'], ['ve-spire', 'as-forge'],
  ['as-flats', 'as-town'], ['as-flats', 'ma-fields'], ['as-town', 'as-forge'], ['as-town', 'ma-hold'],
  ['ma-fields', 'ma-town'], ['ma-town', 'ma-siege'], ['ma-town', 'ma-hold'],
];

export const REGIONS: Record<string, Region> = Object.fromEntries(R.map((r) => [r.id, { ...r, adj: [] as string[] }]));
for (const [a, b] of EDGES) {
  REGIONS[a].adj.push(b);
  REGIONS[b].adj.push(a);
}

export function region(id: string): Region {
  const r = REGIONS[id];
  if (!r) throw new Error(`unknown region ${id}`);
  return r;
}

export const SEAT_OF: Record<EvilId, string> = {
  court: 're-seat', drowned: 'sm-reef', saint: 've-spire', tyrant: 'as-forge', horde: 'ma-hold',
};

/** Shortest path length between regions (BFS), used by Evils spreading and by the bot. */
export function distance(from: string, to: string): number {
  const seen = new Map<string, number>([[from, 0]]);
  const q = [from];
  while (q.length) {
    const cur = q.shift()!;
    if (cur === to) return seen.get(cur)!;
    for (const n of REGIONS[cur].adj) if (!seen.has(n)) { seen.set(n, seen.get(cur)! + 1); q.push(n); }
  }
  return 99;
}

export function nextStep(from: string, to: string): string {
  if (from === to) return from;
  let best = from; let bestD = 99;
  for (const n of REGIONS[from].adj) { const d = distance(n, to); if (d < bestD) { bestD = d; best = n; } }
  return best;
}

export const TOWN_STOCK: Record<string, { items: string[]; equipment: string[] }> = {
  'hc-town': { items: ['herb', 'antidote', 'tonic'], equipment: ['steel-sword', 'winged-lance', 'chain-mail', 'leather-jerkin'] },
  're-town': { items: ['herb', 'tonic', 'ether'], equipment: ['longbow', 'winged-lance', 'leather-jerkin'] },
  'sm-town': { items: ['herb', 'antidote', 'phoenix-feather'], equipment: ['war-axe', 'iron-knuckles', 'chain-mail'] },
  've-town': { items: ['herb', 'ether', 'phoenix-feather'], equipment: ['steel-sword', 'chain-mail'] },
  'as-town': { items: ['herb', 'tonic', 'ether'], equipment: ['black-greatsword', 'war-axe', 'steel-plate'] },
  'ma-town': { items: ['herb', 'antidote', 'tonic'], equipment: ['black-greatsword', 'iron-knuckles', 'steel-plate'] },
};
