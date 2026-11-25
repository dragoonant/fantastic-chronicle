import { BASIC_ATTACK, card, CARDS, EQUIPMENT, FORMATIONS, ITEM_IDS, SPELL_IDS, STARTER_WEAPON } from './content/cards';
import { HEROES, hero } from './content/heroes';
import { distance, REGIONS, region, SEAT_OF, TERRITORIES, TOWN_STOCK } from './content/map';
import { domainPool, EVIL_IDS, EVIL_MONSTER, EVIL_NAME, LIEUTENANT_OF, monster } from './content/monsters';
import { startBattle } from './battle';
import { chance, makeRng, pick, weighted } from './rng';
import type { BattleState, EvilId, HeroState, RunState, Weapon } from './types';

export const TIER_NAMES = ['', 'Stirring', 'Rising', 'Dominant', 'Ascendant', 'Cataclysm'];
const CAMP_EVERY = 5;
const BAND_CROWNS: Record<string, number> = { common: 6, mid: 10, high: 16, elite: 26, lieutenant: 70, story: 60, evil: 0 };

// ---------------- creation ----------------

export function makeHero(defId: string, isCompanion: boolean, uid: string): HeroState {
  const d = hero(defId);
  const basic = BASIC_ATTACK[d.weapon];
  const tree = Object.values(CARDS).filter((c) => c.kind === 'tech' && c.weapon === d.weapon && c.tier === 1).map((c) => c.id);
  const other = tree.find((t) => t !== d.startTechs[0]) ?? d.startTechs[0];
  const deck = isCompanion
    ? [basic, basic, basic, basic, 'guard', 'guard', d.startTechs[0], other]
    : [basic, basic, basic, basic, basic, 'guard', 'guard', 'guard', 'move', d.startTechs[0], d.startTechs[0], 'letter-from-home'];
  if (d.school === 'celestial') deck.push('holy-light');
  if (d.school === 'abyssal') deck.push('drain');
  return {
    uid, defId, name: d.name, weapon: d.weapon, isCompanion, generation: 0, maxHp: d.hp, hp: d.hp, lp: d.lp, maxLp: d.lp,
    mag: d.school ? 5 : 2, weaponItem: STARTER_WEAPON[d.weapon], armorItem: null, deck, school: d.school ?? null,
    canSpark: !isCompanion, dead: false,
  };
}

export function newRun(seed: number, heroId: string, companionId: string, maxSeasons = 20): RunState {
  const rng = makeRng(seed);
  const main = makeHero(heroId, false, 'h1');
  const comp = makeHero(companionId, true, 'h2');
  const home = Object.values(REGIONS).find((r) => r.territory === hero(heroId).home && r.type === 'town')!;
  const evils = Object.fromEntries(EVIL_IDS.map((id) => [id, { offset: 0, lieutenantDefeated: false, lockedTier: null, claimed: [SEAT_OF[id]], defeated: false }])) as RunState['evils'];
  const run: RunState = {
    version: 1, seed, rng, season: 1, maxSeasons, mainHero: heroId, party: [main, comp], successors: 0, crowns: 40,
    location: home.id, visited: [home.id], revealed: [], evils, battleCount: 0,
    chronicle: { act: 0, done: false, storyCard: null }, codex: [], formation: 'free-fight', formations: ['free-fight', 'imperial-wedge', 'tortoise'],
    lastCamp: -99, phase: 'town', battle: null, pending: null, event: null, reward: null, final: null, outcome: null,
    log: [`Season 1. ${main.name} sets out from ${home.name} with ${comp.name}.`], evilDelayUsed: false, sparkPity: {}, sparksTotal: 0, storyPending: null,
  };
  // one Evil is already stirring: give it a head start
  const first = pick(rng, EVIL_IDS);
  run.evils[first].offset += 2;
  run.log.push(`${EVIL_NAME[first]} is already stirring.`);
  return run;
}

// ---------------- the clock and the Evils ----------------

export function evilSeason(run: RunState, id: EvilId) { return run.season + run.evils[id].offset; }

export function evilTier(run: RunState, id: EvilId): number {
  const ev = run.evils[id];
  if (ev.lockedTier) return ev.lockedTier;
  const f = run.maxSeasons / 24;
  const s = evilSeason(run, id);
  let t = s <= 5 * f ? 1 : s <= 10 * f ? 2 : s <= 16 * f ? 3 : s <= 22 * f ? 4 : 5;
  if (!ev.lieutenantDefeated && run.season > 16 * f) t = Math.min(5, t + 1);
  return t;
}

function claimStep(run: RunState, id: EvilId) {
  const ev = run.evils[id];
  const home = TERRITORIES[region(SEAT_OF[id]).territory].id;
  const frontier = new Set<string>();
  for (const c of ev.claimed) for (const n of REGIONS[c].adj) {
    if (!EVIL_IDS.some((o) => run.evils[o].claimed.includes(n))) frontier.add(n);
  }
  if (!frontier.size) return;
  const opts = [...frontier];
  const choice = weighted(run.rng, opts, (r) => (REGIONS[r].territory === home ? 4 : 1) * (REGIONS[r].type === 'town' ? 0.5 : 1));
  ev.claimed.push(choice);
  run.log.push(`${EVIL_NAME[id]} claims ${REGIONS[choice].name}.`);
}

export function advanceSeason(run: RunState, n = 1) {
  for (let i = 0; i < n; i++) {
    run.season++;
    for (const id of EVIL_IDS) if (!run.evils[id].defeated && evilTier(run, id) >= 2) claimStep(run, id);
  }
  run.log.push(`Season ${run.season} begins.`);
}

export function claimedBy(run: RunState, regionId: string): EvilId | null {
  return EVIL_IDS.find((id) => run.evils[id].claimed.includes(regionId)) ?? null;
}

export function rank(run: RunState, regionId: string): number {
  const t = REGIONS[regionId].territory;
  const dom = TERRITORIES[t].evil;
  let r = 1 + Math.floor(run.battleCount / 2);
  if (dom) r += 1;
  const cl = claimedBy(run, regionId);
  if (cl && evilTier(run, cl) >= 3) r += 2;
  return r;
}

// ---------------- encounters ----------------

const BAND_COST: Record<string, number> = { common: 1, mid: 2, high: 3, elite: 4 };

export function encounter(run: RunState, regionId: string, big = false): string[] {
  const r = region(regionId);
  const rk = rank(run, regionId);
  const cl = claimedBy(run, regionId);
  const domain: EvilId = cl ?? TERRITORIES[r.territory].evil ?? pick(run.rng, ['court', 'drowned', 'horde', 'tyrant'] as EvilId[]);
  const bands = ['common', 'mid', 'high', 'elite'].filter((bnd) => (bnd === 'common') || (bnd === 'mid' && rk >= 3) || (bnd === 'high' && rk >= 5) || (bnd === 'elite' && rk >= 8 && big));
  const allowed = TERRITORIES[r.territory].evil || cl ? bands : bands.filter((x) => x === 'common' || x === 'mid');
  let budget = Math.min(10, 3 + Math.ceil(rk * 0.6)) + (big ? 2 : 0);
  const out: string[] = [];
  while (budget > 0 && out.length < (big ? 4 : 3)) {
    const fit = allowed.filter((bnd) => BAND_COST[bnd] <= budget);
    if (!fit.length) break;
    const bnd = weighted(run.rng, fit, (x) => (x === 'elite' ? 1 : x === 'high' ? 2 : 3));
    const id = pick(run.rng, domainPool(domain, bnd as never));
    out.push(id);
    budget -= BAND_COST[bnd] * (monster(id).mech.includes('pack3') ? 2 : 1);
  }
  return out.length ? out : [pick(run.rng, domainPool(domain, 'common'))];
}

function begin(run: RunState, kind: BattleState['kind'], title: string, enemies: string[], extra: { boss?: boolean; evilId?: EvilId; evilTier?: number; rankAdd?: number } = {}) {
  run.battle = startBattle(run, { kind, title, enemies, rank: rank(run, run.location) + (extra.rankAdd ?? 0), boss: extra.boss, evilId: extra.evilId ?? null, evilTier: extra.evilTier });
  run.phase = 'battle';
}

// ---------------- map actions ----------------

export function canTravel(run: RunState, to: string) {
  return run.phase === 'map' || run.phase === 'town' ? REGIONS[run.location].adj.includes(to) : false;
}

export function travel(run: RunState, to: string) {
  if (!canTravel(run, to)) return;
  run.location = to;
  if (!run.visited.includes(to)) run.visited.push(to);
  const r = region(to);
  advanceSeason(run, r.type === 'dungeon' ? 2 : 1);
  run.log.push(`The party travels to ${r.name}.`);
  if (checkClock(run)) return;
  arrive(run);
}

function checkClock(run: RunState): boolean {
  if (run.season > run.maxSeasons && !run.final) {
    run.log.push('Cataclysm. The Five Evils come for the world. The Final Confrontation begins.');
    startFinal(run);
    return true;
  }
  return false;
}

function arrive(run: RunState) {
  const r = region(run.location);
  const h = hero(run.mainHero);
  const ch = run.chronicle;
  // Chronicle Act II
  if (ch.act === 1 && h.chronicle.act2.region === r.id) {
    const a = h.chronicle.act2;
    const cost = a.cost.crowns ? run.crowns >= a.cost.crowns : true;
    run.event = {
      title: `${h.chronicle.title}: The Cost`, text: a.text, tag: 'act2',
      choices: [{ id: 'fight', label: a.fightText }, { id: 'pay', label: a.costText, disabled: !cost }, { id: 'leave', label: 'Not yet' }],
    };
    run.phase = 'event';
    return;
  }
  if (r.type === 'town') { run.phase = 'town'; return; }
  if (r.type === 'seat') {
    const id = EVIL_IDS.find((e) => SEAT_OF[e] === r.id)!;
    const ev = run.evils[id];
    const isAct3 = ch.act === 2 && h.chronicle.act3.region === r.id;
    if (ev.lieutenantDefeated) {
      if (isAct3) { completeChronicle(run); return; }
      run.event = { title: r.name, text: `The seat stands empty. ${monster(LIEUTENANT_OF[id]).name} is gone.`, tag: 'quiet', choices: [{ id: 'leave', label: 'Move on' }] };
      run.phase = 'event';
      return;
    }
    run.event = {
      title: r.name, text: `${r.text} ${isAct3 ? h.chronicle.act3.text : 'Defeating the lieutenant will set its master back two Seasons.'}`, tag: 'seat',
      choices: [{ id: 'fight', label: `Challenge ${monster(LIEUTENANT_OF[id]).name}` }, { id: 'leave', label: 'Withdraw' }],
    };
    run.phase = 'event';
    return;
  }
  if (r.type === 'dungeon') {
    run.pending = { region: r.id, battles: 3, kind: 'dungeon' };
    begin(run, 'dungeon', `${r.name}: the first hall`, encounter(run, r.id, true));
    return;
  }
  begin(run, 'wilds', r.name, encounter(run, r.id));
}

export function chooseEvent(run: RunState, choice: string) {
  const ev = run.event;
  if (!ev || run.phase !== 'event') return;
  const h = hero(run.mainHero);
  run.event = null;
  if (ev.tag === 'act2') {
    const a = h.chronicle.act2;
    if (choice === 'fight') { begin(run, 'story', monster(a.fight).name, [a.fight], { boss: true, rankAdd: 1 }); return; }
    if (choice === 'pay') {
      if (a.cost.crowns) run.crowns -= a.cost.crowns;
      if (a.cost.lp) { const m = mainHero(run); m.lp = Math.max(1, m.lp - a.cost.lp); }
      finishAct2(run);
      return;
    }
    run.phase = 'map';
    return;
  }
  if (ev.tag === 'seat' && choice === 'fight') {
    const id = EVIL_IDS.find((e) => SEAT_OF[e] === run.location)!;
    begin(run, 'lieutenant', monster(LIEUTENANT_OF[id]).name, [LIEUTENANT_OF[id]], { boss: true, rankAdd: 1 });
    return;
  }
  if (ev.tag === 'final-camp') {
    if (choice === 'camp' && run.final) { run.final.campUsed = true; for (const p of run.party) if (!p.dead) { p.hp = p.maxHp; p.lp = Math.min(p.maxLp, p.lp + 1); } }
    run.phase = 'final';
    return;
  }
  if (ev.tag === 'over') { run.phase = 'over'; return; }
  run.phase = run.final ? 'final' : REGIONS[run.location].type === 'town' ? 'town' : 'map';
}

export function mainHero(run: RunState): HeroState {
  return run.party.find((p) => !p.isCompanion && !p.dead) ?? run.party[0];
}

function finishAct2(run: RunState) {
  const h = hero(run.mainHero);
  const a = h.chronicle.act2;
  const m = mainHero(run);
  const [kind, val] = a.reward.split(':');
  let text = '';
  if (kind === 'equip') {
    const eq = EQUIPMENT[val];
    if (eq.weapon === m.weapon) { m.weaponItem = val; text = `${m.name} takes up ${eq.name}.`; } else { run.crowns += 100; text = `${eq.name} is recovered, but ${m.name} cannot wield it. It is sold for 100 Crowns.`; }
  } else if (kind === 'formation') { if (!run.formations.includes(val)) run.formations.push(val); text = `New Formation: ${FORMATIONS[val].name}.`; }
  else if (kind === 'card') { m.deck.push(val); text = `${m.name} learns ${card(val).name}.`; }
  else if (kind === 'lp') { m.lp = Math.min(m.maxLp + 2, m.lp + Number(val)); m.maxLp = Math.max(m.maxLp, m.lp); text = `${m.name} regains ${val} LP.`; }
  m.deck.push('oath-sworn');
  run.chronicle.act = 2;
  run.log.push(`Chronicle: Act II complete. ${text}`);
  run.event = {
    title: `${h.chronicle.title}: Act II complete`, tag: 'story',
    text: `${text} ${h.successor.name} joins the cause and will carry it on if ${m.name} falls. Act III: ${h.chronicle.act3.text} (${REGIONS[h.chronicle.act3.region].name})`,
    choices: [{ id: 'ok', label: 'Onward' }],
  };
  run.phase = 'event';
}

function completeChronicle(run: RunState) {
  const h = hero(run.mainHero);
  const m = mainHero(run);
  run.chronicle.act = 3;
  run.chronicle.done = true;
  m.deck.push(h.destiny, 'reckoning');
  const tier = evilTier(run, h.antagonist);
  run.evils[h.antagonist].lockedTier = tier;
  run.log.push(`Chronicle complete! ${m.name} gains the Destiny card ${card(h.destiny).name}.`);
  run.event = {
    title: `${h.chronicle.title}: complete`, tag: 'story',
    text: `${m.name}'s Chronicle is complete. Destiny card gained: ${card(h.destiny).name}. ${EVIL_NAME[h.antagonist]} is locked at ${TIER_NAMES[tier]}. You may march on the Evils whenever you are ready.`,
    choices: [{ id: 'ok', label: 'Onward' }],
  };
  run.phase = 'event';
}

// ---------------- towns ----------------

export function townOpen(run: RunState): boolean {
  return REGIONS[run.location].type === 'town' && !claimedBy(run, run.location);
}

export function innCost(run: RunState) { return 8 + run.season; }

export function inn(run: RunState): boolean {
  if (!townOpen(run) || run.crowns < innCost(run)) return false;
  run.crowns -= innCost(run);
  for (const p of run.party) if (!p.dead) p.hp = p.maxHp;
  run.log.push('The party rests at the inn. HP restored. (LP is never restored by inns.)');
  return true;
}

export function tavern(run: RunState): string {
  const h = hero(run.mainHero);
  if (run.chronicle.act === 0 && h.chronicle.act1.region === run.location) {
    run.chronicle.act = 1;
    run.revealed.push(h.chronicle.act2.region);
    const t = `${h.chronicle.act1.text} (Act II: ${REGIONS[h.chronicle.act2.region].name})`;
    run.log.push(`Chronicle, Act I: ${t}`);
    return t;
  }
  if (run.chronicle.act === 0) return `The talk is of ${REGIONS[h.chronicle.act1.region].name}: someone there knows your story.`;
  const strongest = [...EVIL_IDS].sort((a, z) => evilTier(run, z) - evilTier(run, a))[0];
  return `Travellers say ${EVIL_NAME[strongest]} is ${TIER_NAMES[evilTier(run, strongest)].toLowerCase()}. Its lieutenant waits at ${REGIONS[SEAT_OF[strongest]].name}.`;
}

export function shopStock(run: RunState) {
  const s = TOWN_STOCK[run.location] ?? { items: [], equipment: [] };
  const school = TERRITORIES[REGIONS[run.location].territory].school;
  return { items: s.items, equipment: s.equipment, spells: SPELL_IDS.filter((id) => card(id).school === school) };
}

export function buyCard(run: RunState, cardId: string, heroUid: string): string | null {
  const c = card(cardId);
  const h = run.party.find((p) => p.uid === heroUid && !p.dead);
  if (!h || !townOpen(run)) return 'Not available.';
  if (run.crowns < (c.price ?? 0)) return 'Not enough Crowns.';
  if (c.kind === 'spell') {
    if (c.school === 'celestial' || c.school === 'abyssal') {
      if (h.school && h.school !== c.school) return `${h.name} follows ${h.school} magic and cannot learn ${c.school}.`;
      h.school = c.school;
    }
    if (h.deck.includes(c.id)) return `${h.name} already knows ${c.name}.`;
  }
  run.crowns -= c.price ?? 0;
  h.deck.push(c.id);
  return null;
}

export function buyEquipment(run: RunState, id: string, heroUid: string): string | null {
  const e = EQUIPMENT[id];
  const h = run.party.find((p) => p.uid === heroUid && !p.dead);
  if (!h || !townOpen(run)) return 'Not available.';
  if (e.slot === 'weapon' && e.weapon !== h.weapon) return `${h.name} cannot use a ${e.weapon}.`;
  if (run.crowns < e.price) return 'Not enough Crowns.';
  run.crowns -= e.price;
  if (e.slot === 'weapon') h.weaponItem = id; else h.armorItem = id;
  return null;
}

export function forgetCost(run: RunState) { return 15 + run.season; }

export function forgetCard(run: RunState, heroUid: string, cardId: string): string | null {
  const h = run.party.find((p) => p.uid === heroUid);
  if (!h || !townOpen(run)) return 'Not available.';
  if (run.crowns < forgetCost(run)) return 'Not enough Crowns.';
  const c = card(cardId);
  if (c.kind === 'destiny') return 'A Destiny cannot be forgotten.';
  if (c.kind === 'basic' && c.id === BASIC_ATTACK[h.weapon] && h.deck.filter((x) => x === c.id).length <= 3) return 'Keep at least 3 basic attacks.';
  const i = h.deck.indexOf(cardId);
  if (i < 0) return 'Not in deck.';
  h.deck.splice(i, 1);
  run.crowns -= forgetCost(run);
  return null;
}

export function recruitOptions(run: RunState): string[] {
  if (run.party.some((p) => p.isCompanion && !p.dead)) return [];
  const used = new Set(run.party.map((p) => p.defId));
  return Object.keys(HEROES).filter((id) => !used.has(id));
}

export function recruit(run: RunState, defId: string): string | null {
  if (!townOpen(run)) return 'Not available.';
  if (!recruitOptions(run).includes(defId)) return 'Cannot recruit.';
  if (run.crowns < 60) return 'Not enough Crowns.';
  run.crowns -= 60;
  run.party = run.party.filter((p) => !(p.isCompanion && p.dead));
  run.party.push(makeHero(defId, true, `h${run.party.length + 2}${run.season}`));
  return null;
}

export function leaveTown(run: RunState) { if (run.phase === 'town') run.phase = 'map'; }

export function canCamp(run: RunState) { return (run.phase === 'map' || run.phase === 'town') && run.season - run.lastCamp >= CAMP_EVERY; }

export function camp(run: RunState) {
  if (!canCamp(run)) return;
  run.lastCamp = run.season;
  for (const p of run.party) if (!p.dead) { p.hp = p.maxHp; p.lp = Math.min(p.maxLp, p.lp + 1); }
  run.log.push('The party makes camp. HP restored and +1 LP each.');
  advanceSeason(run, 1);
  checkClock(run);
}

export function setFormation(run: RunState, id: string) { if (run.formations.includes(id)) run.formation = id; }

// ---------------- after a battle ----------------

export function finishBattle(run: RunState) {
  const b = run.battle;
  if (!b || !b.over) return;
  run.battleCount++;
  const won = b.over === 'win';
  for (const p of run.party) {
    if (p.lp <= 0) p.dead = true;
    else if (p.hp <= 0) p.hp = 1;
  }
  const crowns = won ? Math.round(b.enemies.reduce((a, e) => a + (BAND_CROWNS[e.band] ?? 5), 0) * (1 + 0.1 * b.rank)) : 0;
  run.crowns += crowns;
  const text: string[] = [];
  const cards: string[] = [];
  if (won && chance(run.rng, 0.35)) cards.push(pick(run.rng, ITEM_IDS));
  // lieutenant / story / evil outcomes
  if (won && b.kind === 'lieutenant') {
    const id = EVIL_IDS.find((e) => SEAT_OF[e] === run.location)!;
    run.evils[id].lieutenantDefeated = true;
    run.evils[id].offset -= 2;
    text.push(`${EVIL_NAME[id]} is set back two Seasons.`);
  }
  if (won && b.kind === 'dungeon' && run.pending) {
    run.pending.battles--;
    if (run.pending.battles <= 0) {
      run.crowns += 50;
      cards.push(pick(run.rng, ITEM_IDS), pick(run.rng, ['phoenix-feather', 'tonic', 'ether']));
      text.push('Treasure room: 50 Crowns.');
      run.pending = null;
    }
  }
  if (!won) run.pending = null;
  if (b.kind === 'evil' && run.final) {
    if (won) {
      run.evils[b.evilId!].defeated = true;
      run.final.remaining = run.final.remaining.filter((x) => x !== b.evilId);
      for (const p of run.party) if (!p.dead) p.hp = Math.min(p.maxHp, Math.max(1, p.hp) + Math.round(p.maxHp * 0.25));
      text.push(`${EVIL_NAME[b.evilId!]} is destroyed! Its fall restores a quarter of the party's HP.`);
    }
  }
  for (const s of b.sparked) text.push(`${run.party.find((p) => p.uid === s.hero)?.name} learned ${card(s.card).name}.`);
  run.reward = { crowns, cards, sparks: b.sparked, text };
  const deaths = handleDeaths(run, text);
  if (b.kind === 'evil' && (!won || deaths === 'over')) { endRun(run, 'defeat'); return; }
  if (deaths === 'over') { endRun(run, 'defeat'); return; }
  run.phase = 'reward';
  if (won && b.kind === 'story') { run.battle = null; run.reward.text.push('The story moves on.'); finishAct2Reward(run); return; }
  if (won && b.kind === 'lieutenant' && run.chronicle.act === 2 && hero(run.mainHero).chronicle.act3.region === run.location) {
    run.battle = null; completeChronicleAfterReward(run); return;
  }
  if (!won) {
    run.reward.text.push('The party retreats to lick its wounds. A Season passes.');
    advanceSeason(run, 1);
    checkClock(run);
  }
  run.battle = null;
}

function finishAct2Reward(run: RunState) { run.storyPending = 'act2'; }
function completeChronicleAfterReward(run: RunState) { run.storyPending = 'act3'; }

export function takeReward(run: RunState, assignments: Record<number, string | null>) {
  if (run.phase !== 'reward' || !run.reward) return;
  run.reward.cards.forEach((c, i) => {
    const who = assignments[i];
    const h = run.party.find((p) => p.uid === who && !p.dead);
    if (h) h.deck.push(c);
  });
  run.reward = null;
  const story = run.storyPending;
  run.storyPending = null;
  if (story === 'act2') { finishAct2(run); return; }
  if (story === 'act3') { completeChronicle(run); return; }
  if (run.outcome) { run.phase = 'over'; return; }
  if (run.final) { run.phase = run.final.remaining.length ? 'final' : 'over'; if (!run.final.remaining.length) endRun(run, 'victory'); return; }
  if (run.pending) { begin(run, 'dungeon', `${REGIONS[run.pending.region].name}: ${run.pending.battles === 2 ? 'the second hall' : 'the inner sanctum'}`, encounter(run, run.pending.region, true)); return; }
  if (run.season > run.maxSeasons) { startFinal(run); return; }
  run.phase = REGIONS[run.location].type === 'town' ? 'town' : 'map';
}

function handleDeaths(run: RunState, text: string[]): 'ok' | 'over' {
  for (const p of [...run.party]) {
    if (!p.dead || (p as HeroState & { mourned?: boolean }).mourned) continue;
    (p as HeroState & { mourned?: boolean }).mourned = true;
    for (const id of EVIL_IDS) run.evils[id].offset += 1;
    if (p.isCompanion) { text.push(`${p.name} has died. Recruit a new companion in any town. Every Evil grows one Season stronger.`); continue; }
    if (run.successors >= 2) { text.push(`${p.name} has died, and no one is left to carry the Chronicle.`); return 'over'; }
    run.successors++;
    const s = successorOf(run, p);
    run.party = run.party.filter((x) => x !== p);
    run.party.unshift(s);
    text.push(`${p.name} has died. ${s.name} takes up the Chronicle with ${s.lp} LP. Every Evil grows one Season stronger.`);
  }
  return 'ok';
}

function successorOf(run: RunState, dead: HeroState): HeroState {
  const d = hero(run.mainHero);
  const gen = dead.generation + 1;
  const weapon: Weapon = gen === 1 ? d.successor.weapon : (['sword', 'spear', 'axe', 'bow', 'greatsword'] as Weapon[]).find((w) => w !== dead.weapon)!;
  const name = gen === 1 ? d.successor.name : `${d.successor.name.split(' ')[0]}'s heir`;
  const basic = BASIC_ATTACK[weapon];
  const inherited = run.codex.filter((id) => card(id).weapon === weapon && card(id).tier <= 2);
  const t3 = run.codex.find((id) => card(id).weapon === weapon && card(id).tier === 3);
  const t1 = Object.values(CARDS).find((c) => c.kind === 'tech' && c.weapon === weapon && c.tier === 1)!.id;
  const keep = dead.deck.filter((id) => ['story', 'destiny', 'item'].includes(card(id).kind));
  const deck = [basic, basic, basic, basic, basic, 'guard', 'guard', 'guard', 'move', ...(inherited.length ? inherited : [t1]), ...(t3 ? [t3] : []), ...keep];
  const maxLp = Math.max(4, dead.maxLp - 3);
  return {
    uid: `${dead.uid}s${gen}`, defId: dead.defId, name, weapon, isCompanion: false, generation: gen, maxHp: dead.maxHp, hp: dead.maxHp,
    lp: maxLp, maxLp, mag: 2, weaponItem: STARTER_WEAPON[weapon], armorItem: dead.armorItem, deck, school: null, canSpark: true, dead: false,
  };
}

function endRun(run: RunState, outcome: 'victory' | 'defeat') {
  run.outcome = outcome;
  run.phase = 'over';
  run.battle = null;
  run.log.push(outcome === 'victory' ? 'The Five Evils are destroyed. The Chronicle is written.' : 'The Chronicle ends here.');
}

// ---------------- the Final Confrontation ----------------

export function canStartFinal(run: RunState) { return run.chronicle.done && !run.final && (run.phase === 'map' || run.phase === 'town'); }

export function startFinal(run: RunState) {
  run.final = { remaining: EVIL_IDS.filter((id) => !run.evils[id].defeated), campUsed: false, started: true };
  if (!run.chronicle.done) {
    const m = mainHero(run);
    m.lp = Math.max(1, m.lp - 2);
    run.log.push(`${m.name} faces the Evils without a finished Chronicle (-2 LP).`);
  }
  run.pending = null;
  run.phase = 'final';
}

export function fightEvil(run: RunState, id: EvilId) {
  if (run.phase !== 'final' || !run.final?.remaining.includes(id)) return;
  const t = evilTier(run, id);
  const phases = Math.max(1, (t <= 2 ? 1 : t === 3 ? 2 : 3) - (run.evils[id].lieutenantDefeated ? 1 : 0));
  run.battle = startBattle(run, { kind: 'evil', title: `${EVIL_NAME[id]} (${TIER_NAMES[t]})`, enemies: [EVIL_MONSTER[id]], rank: 1 + Math.floor(run.battleCount / 4) + t, boss: true, evilId: id, evilTier: t, phases });
  run.phase = 'battle';
}

export function finalCamp(run: RunState) {
  if (run.phase !== 'final' || !run.final || run.final.campUsed) return;
  run.final.campUsed = true;
  for (const p of run.party) if (!p.dead) { p.hp = p.maxHp; p.lp = Math.min(p.maxLp, p.lp + 1); }
  run.log.push('One last camp before the next Evil. HP restored, +1 LP.');
}

export function distanceTo(run: RunState, to: string) { return distance(run.location, to); }

