import type { CardDef, EquipDef, Weapon } from '../types';

const dmg = (n: number, extra: Partial<{ hits: number; pierce: boolean; armorBreak: number }> = {}) => ({ t: 'dmg' as const, n, ...extra });

// ---------------- basic cards ----------------
const BASICS: CardDef[] = [
  { id: 'guard', name: 'Guard', kind: 'basic', tier: 0, cost: 0, target: 'self', quick: true, effects: [{ t: 'guard', n: 7 }] },
  { id: 'move', name: 'Move', kind: 'basic', tier: 0, cost: 0, target: 'self', quick: true, effects: [{ t: 'move' }, { t: 'draw', n: 1 }] },
  { id: 'sword-attack', name: 'Sword Attack', kind: 'basic', weapon: 'sword', tier: 0, cost: 0, target: 'enemy', effects: [dmg(6)], sparks: ['cross-slash', 'feint'] },
  { id: 'greatsword-attack', name: 'Greatsword Attack', kind: 'basic', weapon: 'greatsword', tier: 0, cost: 0, target: 'enemy', effects: [dmg(8)], sparks: ['smash', 'windmill'] },
  { id: 'axe-attack', name: 'Axe Attack', kind: 'basic', weapon: 'axe', tier: 0, cost: 0, target: 'enemy', effects: [dmg(7, { armorBreak: 1 })], sparks: ['hew', 'tomahawk'] },
  { id: 'spear-attack', name: 'Spear Attack', kind: 'basic', weapon: 'spear', tier: 0, cost: 0, target: 'enemyAny', effects: [dmg(6)], sparks: ['double-thrust', 'skewer'] },
  { id: 'bow-attack', name: 'Bow Attack', kind: 'basic', weapon: 'bow', tier: 0, cost: 0, target: 'enemyAny', effects: [dmg(6)], sparks: ['aimed-shot', 'double-shot'] },
  { id: 'punch', name: 'Punch', kind: 'basic', weapon: 'martial', tier: 0, cost: 0, target: 'enemy', effects: [dmg(5), { t: 'wp', n: 1 }], sparks: ['jab-flurry', 'sweep'] },
];

export const BASIC_ATTACK: Record<Weapon, string> = {
  sword: 'sword-attack', greatsword: 'greatsword-attack', axe: 'axe-attack', spear: 'spear-attack', bow: 'bow-attack', martial: 'punch',
};

// ---------------- techs: six spark trees ----------------
const TECHS: CardDef[] = [
  // Sword: balanced, counters
  { id: 'cross-slash', name: 'Cross Slash', kind: 'tech', weapon: 'sword', tier: 1, cost: 2, target: 'enemy', effects: [dmg(6, { hits: 2 })], open: 'o', close: 'd', sparks: ['parry', 'tiger-break'] },
  { id: 'feint', name: 'Feint', kind: 'tech', weapon: 'sword', tier: 1, cost: 1, target: 'enemy', quick: true, effects: [dmg(5), { t: 'status', s: 'blind', turns: 1 }], open: 'd', close: 'o', sparks: ['shadow-step'] },
  { id: 'parry', name: 'Parry', kind: 'tech', weapon: 'sword', tier: 2, cost: 1, target: 'self', quick: true, effects: [{ t: 'guard', n: 8 }, { t: 'counter', n: 8 }], open: 'D', close: 'o', sparks: ['riposte'] },
  { id: 'shadow-step', name: 'Shadow Step', kind: 'tech', weapon: 'sword', tier: 2, cost: 2, target: 'enemyAny', quick: true, effects: [dmg(11, { pierce: true })], open: 'o', close: 'D', sparks: ['phantom-edge'] },
  { id: 'tiger-break', name: 'Tiger Break', kind: 'tech', weapon: 'sword', tier: 3, cost: 4, target: 'enemy', effects: [dmg(24)], open: 'd', close: 'O', sparks: ['thousand-petals'] },
  { id: 'riposte', name: 'Riposte', kind: 'tech', weapon: 'sword', tier: 3, cost: 2, target: 'self', quick: true, effects: [{ t: 'guard', n: 12 }, { t: 'counter', n: 16 }], open: 'O', close: 'd' },
  { id: 'phantom-edge', name: 'Phantom Edge', kind: 'tech', weapon: 'sword', tier: 4, cost: 4, target: 'randomEnemies', effects: [dmg(11, { hits: 3, pierce: true })], open: 'D', close: 'D', requires: ['parry'] },
  { id: 'thousand-petals', name: 'Thousand Petals', kind: 'tech', weapon: 'sword', tier: 5, cost: 6, target: 'allEnemies', effects: [dmg(9, { hits: 3 })], open: 'O', close: 'O' },

  // Greatsword: slow single-target burst, charges
  { id: 'smash', name: 'Smash', kind: 'tech', weapon: 'greatsword', tier: 1, cost: 2, target: 'enemy', effects: [dmg(15)], open: 'o', close: 'D', sparks: ['hard-slash', 'stun-slash'] },
  { id: 'windmill', name: 'Windmill', kind: 'tech', weapon: 'greatsword', tier: 1, cost: 3, target: 'allEnemies', effects: [dmg(8)], open: 'D', close: 'o', sparks: ['earthsplitter'] },
  { id: 'hard-slash', name: 'Hard Slash', kind: 'tech', weapon: 'greatsword', tier: 2, cost: 3, target: 'enemy', effects: [{ t: 'charge', mult: 1 }, dmg(32)], open: 'O', close: 'D', sparks: ['avalanche'] },
  { id: 'stun-slash', name: 'Stun Slash', kind: 'tech', weapon: 'greatsword', tier: 2, cost: 3, target: 'enemy', effects: [dmg(13), { t: 'status', s: 'stun', turns: 1, chance: 0.6 }], open: 'D', close: 'd', sparks: ['avalanche'] },
  { id: 'earthsplitter', name: 'Earthsplitter', kind: 'tech', weapon: 'greatsword', tier: 3, cost: 4, target: 'allEnemies', effects: [dmg(16)], open: 'd', close: 'O', sparks: ['godcleaver'] },
  { id: 'avalanche', name: 'Avalanche', kind: 'tech', weapon: 'greatsword', tier: 4, cost: 5, target: 'enemy', effects: [{ t: 'charge', mult: 1 }, dmg(56, { pierce: true })], open: 'O', close: 'O', requires: ['hard-slash', 'stun-slash'] },
  { id: 'godcleaver', name: 'Godcleaver', kind: 'tech', weapon: 'greatsword', tier: 5, cost: 7, target: 'enemy', effects: [dmg(70, { pierce: true })], open: 'O', close: 'D' },

  // Axe: armour break
  { id: 'hew', name: 'Hew', kind: 'tech', weapon: 'axe', tier: 1, cost: 2, target: 'enemy', effects: [dmg(12, { armorBreak: 3 })], open: 'D', close: 'd', sparks: ['splitting-blow', 'bonecrusher'] },
  { id: 'tomahawk', name: 'Tomahawk', kind: 'tech', weapon: 'axe', tier: 1, cost: 2, target: 'enemyAny', quick: true, effects: [dmg(9)], open: 'o', close: 'o', sparks: ['storm-of-axes'] },
  { id: 'splitting-blow', name: 'Splitting Blow', kind: 'tech', weapon: 'axe', tier: 2, cost: 3, target: 'enemy', effects: [dmg(17, { armorBreak: 4 })], open: 'd', close: 'D', sparks: ['bonecrusher'] },
  { id: 'bonecrusher', name: 'Bonecrusher', kind: 'tech', weapon: 'axe', tier: 3, cost: 4, target: 'enemy', effects: [dmg(22, { armorBreak: 6 }), { t: 'status', s: 'stun', turns: 1, chance: 0.5 }], open: 'D', close: 'O', sparks: ['earth-reaver'] },
  { id: 'storm-of-axes', name: 'Storm of Axes', kind: 'tech', weapon: 'axe', tier: 4, cost: 5, target: 'randomEnemies', effects: [dmg(10, { hits: 4, armorBreak: 1 })], open: 'o', close: 'O' },
  { id: 'earth-reaver', name: 'Earth Reaver', kind: 'tech', weapon: 'axe', tier: 5, cost: 6, target: 'allEnemies', effects: [dmg(28, { pierce: true })], open: 'O', close: 'D' },

  // Spear: reach, multi-hit
  { id: 'double-thrust', name: 'Double Thrust', kind: 'tech', weapon: 'spear', tier: 1, cost: 2, target: 'enemyAny', effects: [dmg(6, { hits: 2 })], open: 'd', close: 'd', sparks: ['charge-lance', 'dragon-thrust'] },
  { id: 'skewer', name: 'Skewer', kind: 'tech', weapon: 'spear', tier: 1, cost: 2, target: 'twoEnemies', effects: [dmg(10)], open: 'o', close: 'D', sparks: ['whirl-spear'] },
  { id: 'charge-lance', name: 'Charge Lance', kind: 'tech', weapon: 'spear', tier: 2, cost: 3, target: 'enemyAny', effects: [dmg(19)], open: 'D', close: 'o', sparks: ['sky-piercer'] },
  { id: 'whirl-spear', name: 'Whirl Spear', kind: 'tech', weapon: 'spear', tier: 2, cost: 3, target: 'allEnemies', effects: [dmg(9)], open: 'O', close: 'd', sparks: ['dragon-thrust'] },
  { id: 'dragon-thrust', name: 'Dragon Thrust', kind: 'tech', weapon: 'spear', tier: 3, cost: 4, target: 'enemyAny', effects: [dmg(9, { hits: 3 })], open: 'd', close: 'O', sparks: ['myriad-spears'] },
  { id: 'sky-piercer', name: 'Sky Piercer', kind: 'tech', weapon: 'spear', tier: 4, cost: 5, target: 'enemyAny', effects: [dmg(38, { pierce: true })], open: 'o', close: 'O' },
  { id: 'myriad-spears', name: 'Myriad Spears', kind: 'tech', weapon: 'spear', tier: 5, cost: 6, target: 'randomEnemies', effects: [dmg(9, { hits: 6 })], open: 'O', close: 'O' },

  // Bow: back row reach, cancels intents
  { id: 'aimed-shot', name: 'Aimed Shot', kind: 'tech', weapon: 'bow', tier: 1, cost: 2, target: 'enemyAny', effects: [dmg(13)], open: 'o', close: 'd', sparks: ['pin-shot', 'piercing-arrow'] },
  { id: 'double-shot', name: 'Double Shot', kind: 'tech', weapon: 'bow', tier: 1, cost: 2, target: 'randomEnemies', effects: [dmg(7, { hits: 2 })], open: 'd', close: 'D', sparks: ['rain-of-arrows'] },
  { id: 'pin-shot', name: 'Pin Shot', kind: 'tech', weapon: 'bow', tier: 2, cost: 2, target: 'enemyAny', quick: true, effects: [dmg(7), { t: 'cancelIntent' }], open: 'D', close: 'o', sparks: ['shadow-bind'] },
  { id: 'shadow-bind', name: 'Shadow Bind', kind: 'tech', weapon: 'bow', tier: 3, cost: 3, target: 'enemyAny', quick: true, effects: [dmg(10), { t: 'status', s: 'stun', turns: 1 }], open: 'o', close: 'O' },
  { id: 'rain-of-arrows', name: 'Rain of Arrows', kind: 'tech', weapon: 'bow', tier: 3, cost: 4, target: 'allEnemies', effects: [dmg(7, { hits: 2 })], open: 'D', close: 'O', sparks: ['starfall'] },
  { id: 'piercing-arrow', name: 'Piercing Arrow', kind: 'tech', weapon: 'bow', tier: 4, cost: 4, target: 'enemyAny', effects: [dmg(30, { pierce: true })], open: 'O', close: 'd' },
  { id: 'starfall', name: 'Starfall', kind: 'tech', weapon: 'bow', tier: 5, cost: 6, target: 'allEnemies', effects: [dmg(14, { hits: 2 })], open: 'O', close: 'O' },

  // Martial arts: refunds WP
  { id: 'jab-flurry', name: 'Jab Flurry', kind: 'tech', weapon: 'martial', tier: 1, cost: 1, target: 'enemy', effects: [dmg(3, { hits: 3 }), { t: 'wp', n: 1 }], open: 'o', close: 'o', sparks: ['palm-strike', 'dragon-kick'] },
  { id: 'sweep', name: 'Sweep', kind: 'tech', weapon: 'martial', tier: 1, cost: 2, target: 'allEnemies', effects: [dmg(5), { t: 'status', s: 'stun', turns: 1, chance: 0.2 }], open: 'd', close: 'D', sparks: ['counter-stance'] },
  { id: 'palm-strike', name: 'Palm Strike', kind: 'tech', weapon: 'martial', tier: 2, cost: 2, target: 'enemy', effects: [dmg(13, { pierce: true }), { t: 'wp', n: 2 }], open: 'D', close: 'd', sparks: ['hundred-fists'] },
  { id: 'counter-stance', name: 'Counter Stance', kind: 'tech', weapon: 'martial', tier: 2, cost: 1, target: 'self', quick: true, effects: [{ t: 'guard', n: 6 }, { t: 'counter', n: 11 }, { t: 'wp', n: 1 }], open: 'O', close: 'o' },
  { id: 'dragon-kick', name: 'Dragon Kick', kind: 'tech', weapon: 'martial', tier: 3, cost: 3, target: 'enemy', effects: [dmg(23), { t: 'wp', n: 1 }], open: 'o', close: 'O', sparks: ['final-dragon'] },
  { id: 'hundred-fists', name: 'Hundred Fists', kind: 'tech', weapon: 'martial', tier: 4, cost: 4, target: 'randomEnemies', effects: [dmg(4, { hits: 8 }), { t: 'wp', n: 3 }], open: 'd', close: 'D' },
  { id: 'final-dragon', name: 'Final Dragon', kind: 'tech', weapon: 'martial', tier: 5, cost: 5, target: 'enemy', effects: [dmg(48, { pierce: true }), { t: 'wp', n: 2 }], open: 'O', close: 'O' },
];

// ---------------- spells: six schools, bought in towns ----------------
const SPELLS: CardDef[] = [
  { id: 'fire-bolt', name: 'Fire Bolt', kind: 'spell', school: 'fire', tier: 1, cost: 2, target: 'enemyAny', effects: [dmg(11), { t: 'status', s: 'burn', turns: 2 }], open: 'o', close: 'D', price: 45 },
  { id: 'fire-wall', name: 'Fire Wall', kind: 'spell', school: 'fire', tier: 2, cost: 3, target: 'allEnemies', effects: [dmg(6), { t: 'status', s: 'burn', turns: 3 }], open: 'D', close: 'O', price: 70 },
  { id: 'inferno', name: 'Inferno', kind: 'spell', school: 'fire', tier: 3, cost: 5, target: 'allEnemies', effects: [dmg(19)], open: 'O', close: 'O', price: 110 },
  { id: 'mending-rain', name: 'Mending Rain', kind: 'spell', school: 'water', tier: 2, cost: 3, target: 'allAllies', effects: [{ t: 'heal', n: 14 }], price: 70 },
  { id: 'frost-lance', name: 'Frost Lance', kind: 'spell', school: 'water', tier: 1, cost: 2, target: 'enemyAny', effects: [dmg(12), { t: 'status', s: 'chill', turns: 2 }], open: 'd', close: 'o', price: 45 },
  { id: 'cleansing-tide', name: 'Cleansing Tide', kind: 'spell', school: 'water', tier: 1, cost: 2, target: 'ally', quick: true, effects: [{ t: 'heal', n: 12 }, { t: 'cleanse' }], price: 40 },
  { id: 'haste', name: 'Haste', kind: 'spell', school: 'wind', tier: 1, cost: 1, target: 'ally', quick: true, effects: [{ t: 'wp', n: 2 }, { t: 'draw', n: 1 }], price: 45 },
  { id: 'wind-blade', name: 'Wind Blade', kind: 'spell', school: 'wind', tier: 1, cost: 2, target: 'enemyAny', quick: true, effects: [dmg(10)], open: 'd', close: 'd', price: 40 },
  { id: 'cyclone', name: 'Cyclone', kind: 'spell', school: 'wind', tier: 3, cost: 4, target: 'randomEnemies', effects: [dmg(8, { hits: 4 })], open: 'O', close: 'D', price: 100 },
  { id: 'stone-skin', name: 'Stone Skin', kind: 'spell', school: 'earth', tier: 1, cost: 2, target: 'ally', quick: true, effects: [{ t: 'guard', n: 16 }], price: 40 },
  { id: 'stone-wall', name: 'Stone Wall', kind: 'spell', school: 'earth', tier: 2, cost: 3, target: 'allAllies', quick: true, effects: [{ t: 'guard', n: 9 }], price: 65 },
  { id: 'quake', name: 'Quake', kind: 'spell', school: 'earth', tier: 3, cost: 4, target: 'allEnemies', effects: [dmg(15, { armorBreak: 2 })], open: 'D', close: 'D', price: 100 },
  { id: 'revive', name: 'Revive', kind: 'spell', school: 'celestial', tier: 2, cost: 3, target: 'downedAlly', quick: true, effects: [{ t: 'revive', pct: 0.5 }], price: 80 },
  { id: 'sanctuary', name: 'Sanctuary', kind: 'spell', school: 'celestial', tier: 3, cost: 4, target: 'allAllies', quick: true, effects: [{ t: 'status', s: 'lpShield', turns: 99 }, { t: 'heal', n: 8 }], price: 110 },
  { id: 'holy-light', name: 'Holy Light', kind: 'spell', school: 'celestial', tier: 1, cost: 3, target: 'enemyAny', effects: [{ t: 'dmg', n: 15, vs: { tag: 'undead', mult: 2 } }], open: 'o', close: 'o', price: 55 },
  { id: 'drain', name: 'Drain', kind: 'spell', school: 'abyssal', tier: 1, cost: 2, target: 'enemyAny', effects: [dmg(11), { t: 'lifesteal', pct: 1 }], open: 'D', close: 'd', price: 50 },
  { id: 'curse', name: 'Curse', kind: 'spell', school: 'abyssal', tier: 1, cost: 2, target: 'enemyAny', quick: true, effects: [{ t: 'status', s: 'weak', turns: 3 }], price: 45 },
  { id: 'soul-rend', name: 'Soul Rend', kind: 'spell', school: 'abyssal', tier: 3, cost: 4, target: 'enemyAny', effects: [{ t: 'dmg', n: 30, pierce: true, vs: { tag: 'holy', mult: 1.5 } }, { t: 'selfDmg', n: 5 }], open: 'O', close: 'D', price: 100 },
];

// ---------------- items (consumed when played) ----------------
const ITEMS: CardDef[] = [
  { id: 'herb', name: 'Herb', kind: 'item', tier: 0, cost: 0, target: 'ally', quick: true, exhaust: true, effects: [{ t: 'heal', n: 20 }], price: 12 },
  { id: 'antidote', name: 'Antidote', kind: 'item', tier: 0, cost: 0, target: 'ally', quick: true, exhaust: true, effects: [{ t: 'cleanse' }, { t: 'heal', n: 6 }], price: 10 },
  { id: 'phoenix-feather', name: 'Phoenix Feather', kind: 'item', tier: 0, cost: 0, target: 'downedAlly', quick: true, exhaust: true, effects: [{ t: 'revive', pct: 0.4 }], price: 45 },
  { id: 'tonic', name: 'Tonic', kind: 'item', tier: 0, cost: 0, target: 'ally', quick: true, exhaust: true, effects: [{ t: 'wp', n: 3 }], price: 18 },
  { id: 'ether', name: 'Ether', kind: 'item', tier: 0, cost: 0, target: 'ally', quick: true, exhaust: true, effects: [{ t: 'jp', n: 3 }], price: 18 },
];

// ---------------- story cards (Chronicle) ----------------
const STORY: CardDef[] = [
  { id: 'letter-from-home', name: 'Letter from Home', kind: 'story', tier: 0, cost: 0, target: 'self', quick: true, effects: [{ t: 'draw', n: 1 }, { t: 'wp', n: 1 }] },
  { id: 'oath-sworn', name: 'Oath Sworn', kind: 'story', tier: 0, cost: 0, target: 'self', quick: true, effects: [{ t: 'guard', n: 5 }, { t: 'wp', n: 2 }] },
  { id: 'reckoning', name: 'The Reckoning', kind: 'story', tier: 0, cost: 0, target: 'allAllies', quick: true, effects: [{ t: 'heal', n: 10 }, { t: 'wp', n: 1 }] },
];

// ---------------- Destiny cards ----------------
const DESTINY: CardDef[] = [
  { id: 'destiny-weapon', name: 'Blade of Legend', kind: 'destiny', tier: 5, cost: 0, target: 'enemyAny', effects: [{ t: 'spendAllWp', perWp: 9 }] },
  { id: 'destiny-army', name: 'The Banners Answer', kind: 'destiny', tier: 5, cost: 0, target: 'allEnemies', effects: [dmg(26, { pierce: true }), { t: 'status', s: 'stun', turns: 1, chance: 0.5 }] },
  { id: 'destiny-lost', name: 'The Lost Returned', kind: 'destiny', tier: 5, cost: 0, target: 'allAllies', quick: true, effects: [{ t: 'revive', pct: 0.5 }, { t: 'heal', n: 25 }, { t: 'lp', n: 1 }] },
  { id: 'destiny-crown', name: 'Rightful Crown', kind: 'destiny', tier: 5, cost: 0, target: 'allAllies', quick: true, effects: [{ t: 'guard', n: 15 }, { t: 'wp', n: 3 }, { t: 'delayEvils', n: 1 }] },
];

export const CARDS: Record<string, CardDef> = Object.fromEntries(
  [...BASICS, ...TECHS, ...SPELLS, ...ITEMS, ...STORY, ...DESTINY].map((c) => [c.id, c]),
);

export function card(id: string): CardDef {
  const c = CARDS[id];
  if (!c) throw new Error(`unknown card ${id}`);
  return c;
}

export const TECH_IDS = TECHS.map((t) => t.id);
export const SPELL_IDS = SPELLS.map((s) => s.id);
export const ITEM_IDS = ITEMS.map((i) => i.id);

// ---------------- equipment ----------------
export const EQUIPMENT: Record<string, EquipDef> = Object.fromEntries(([
  { id: 'iron-sword', name: 'Iron Sword', slot: 'weapon', weapon: 'sword', atk: 2, def: 0, wp: 2, price: 0, tier: 1 },
  { id: 'steel-sword', name: 'Steel Sword', slot: 'weapon', weapon: 'sword', atk: 5, def: 0, wp: 3, price: 110, tier: 2 },
  { id: 'wintermark', name: 'Wintermark', slot: 'weapon', weapon: 'sword', atk: 9, def: 1, wp: 4, price: 0, tier: 5, text: 'Your family blade.' },
  { id: 'iron-greatsword', name: 'Iron Greatsword', slot: 'weapon', weapon: 'greatsword', atk: 3, def: 0, wp: 1, price: 0, tier: 1 },
  { id: 'black-greatsword', name: 'Black Greatsword', slot: 'weapon', weapon: 'greatsword', atk: 7, def: 0, wp: 2, price: 130, tier: 2 },
  { id: 'hand-axe', name: 'Hand Axe', slot: 'weapon', weapon: 'axe', atk: 3, def: 0, wp: 2, price: 0, tier: 1 },
  { id: 'anchor-axe', name: 'Anchor-Axe', slot: 'weapon', weapon: 'axe', atk: 8, def: 1, wp: 3, price: 0, tier: 5, text: 'Raised from the drowned hall.' },
  { id: 'war-axe', name: 'War Axe', slot: 'weapon', weapon: 'axe', atk: 6, def: 0, wp: 2, price: 120, tier: 2 },
  { id: 'iron-spear', name: 'Iron Spear', slot: 'weapon', weapon: 'spear', atk: 2, def: 0, wp: 2, price: 0, tier: 1 },
  { id: 'winged-lance', name: 'Winged Lance', slot: 'weapon', weapon: 'spear', atk: 5, def: 0, wp: 3, price: 115, tier: 2 },
  { id: 'short-bow', name: 'Short Bow', slot: 'weapon', weapon: 'bow', atk: 2, def: 0, wp: 2, price: 0, tier: 1 },
  { id: 'longbow', name: 'Yew Longbow', slot: 'weapon', weapon: 'bow', atk: 5, def: 0, wp: 3, price: 110, tier: 2 },
  { id: 'wrapped-fists', name: 'Wrapped Fists', slot: 'weapon', weapon: 'martial', atk: 1, def: 0, wp: 3, price: 0, tier: 1 },
  { id: 'iron-knuckles', name: 'Iron Knuckles', slot: 'weapon', weapon: 'martial', atk: 4, def: 0, wp: 4, price: 100, tier: 2 },
  { id: 'leather-jerkin', name: 'Leather Jerkin', slot: 'armor', atk: 0, def: 1, wp: 0, price: 40, tier: 1 },
  { id: 'chain-mail', name: 'Chain Mail', slot: 'armor', atk: 0, def: 2, wp: 0, price: 90, tier: 2 },
  { id: 'steel-plate', name: 'Steel Plate', slot: 'armor', atk: 0, def: 4, wp: -1, price: 170, tier: 3 },
] as EquipDef[]).map((e) => [e.id, e]));

export const STARTER_WEAPON: Record<Weapon, string> = {
  sword: 'iron-sword', greatsword: 'iron-greatsword', axe: 'hand-axe', spear: 'iron-spear', bow: 'short-bow', martial: 'wrapped-fists',
};

// ---------------- formations ----------------
export interface FormationDef { id: string; name: string; text: string; rows: ('front' | 'back')[]; wpRegen: number; jpRegen: number; guardEachRound: number; noQuick: boolean; price: number }
export const FORMATIONS: Record<string, FormationDef> = {
  'free-fight': { id: 'free-fight', name: 'Free Fight', text: 'Both heroes fight in the front row. No passive.', rows: ['front', 'front'], wpRegen: 0, jpRegen: 0, guardEachRound: 0, noQuick: false, price: 0 },
  'imperial-wedge': { id: 'imperial-wedge', name: 'Imperial Wedge', text: 'Your hero leads in front and shields the companion behind. +1 WP each round.', rows: ['front', 'back'], wpRegen: 1, jpRegen: 0, guardEachRound: 0, noQuick: false, price: 0 },
  'tortoise': { id: 'tortoise', name: 'Tortoise', text: 'Both heroes gain 4 Guard each round. Quick cards cannot be played.', rows: ['front', 'front'], wpRegen: 0, jpRegen: 0, guardEachRound: 4, noQuick: true, price: 0 },
  'rear-guard': { id: 'rear-guard', name: 'Rear Guard', text: 'Your companion leads; your hero fights from behind. +1 JP each round.', rows: ['back', 'front'], wpRegen: 0, jpRegen: 1, guardEachRound: 0, noQuick: false, price: 60 },
};
