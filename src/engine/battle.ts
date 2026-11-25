import { card, EQUIPMENT, FORMATIONS } from './content/cards';
import { monster } from './content/monsters';
import { chance, int, pick, shuffle, weighted, next } from './rng';
import type {
  BattleHero, BattleState, CardDef, Effect, EnemyState, EvilId, HeroState, Intent, MoveDef, QueueEntry, RunState, StatusId,
} from './types';

export const HAND_SIZE = 5;
export const WP_CAP = 8;
export const JP_CAP = 6;
export const SPARK_BASE = [0, 0.18, 0.12, 0.08, 0.05, 0.03];
export const SPARK_SCALE = 1.0; // design-doc base rates; a person plays far more techs than the sim bot
export const COMBO_MULT = [1, 1, 1.3, 1.6, 2.0, 2.5];
const BAD: StatusId[] = ['burn', 'chill', 'bind', 'sleep', 'blind', 'stun', 'weak'];

export interface BattleSetup {
  kind: BattleState['kind'];
  title: string;
  enemies: string[];
  rank: number;
  boss?: boolean;
  evilId?: EvilId | null;
  evilTier?: number;      // 1..5
  phases?: number;        // Evils: how many HP bars
}

// ---------------- helpers ----------------

export function heroState(run: RunState, uid: string): HeroState {
  const h = run.party.find((p) => p.uid === uid);
  if (!h) throw new Error(`no hero ${uid}`);
  return h;
}

export function bhero(b: BattleState, uid: string): BattleHero {
  const h = b.heroes.find((x) => x.uid === uid);
  if (!h) throw new Error(`no battle hero ${uid}`);
  return h;
}

export function stats(h: HeroState) {
  const w = EQUIPMENT[h.weaponItem];
  const a = h.armorItem ? EQUIPMENT[h.armorItem] : null;
  return { atk: w.atk, def: w.def + (a?.def ?? 0), wp: Math.max(0, w.wp + (a?.wp ?? 0)), mag: h.mag };
}

const aliveEnemies = (b: BattleState) => b.enemies.filter((e) => e.hp > 0);
const say = (b: BattleState, text: string) => { b.log.push(text); b.events.push({ k: 'say', text }); };
const hasMech = (e: EnemyState, m: string) => monster(e.defId).mech.includes(m as never);
const hasTag = (e: EnemyState, t: string) => monster(e.defId).tags.includes(t);

function scaleHp(base: number, rank: number) { return Math.round(base * (1 + 0.11 * (rank - 1))); }
function scaleAtk(base: number, rank: number) { return Math.round(base * (1 + 0.07 * (rank - 1))); }

function spawnEnemy(b: BattleState, id: string, rank: number, phases = 1): EnemyState {
  const m = monster(id);
  const hp = scaleHp(m.hp, rank);
  const e: EnemyState = {
    uid: b.nextUid++, defId: id, name: m.name, row: m.row, hp, maxHp: hp, atk: scaleAtk(m.atk, rank),
    armor: m.armor + Math.floor((rank - 1) / 4), guard: 0, statuses: {}, intent: null, charged: false, submerged: false,
    phase: 1, phases, risen: false, dodged: false, countered: false, copied: null, stolen: null, growth: 0, size: m.size, band: m.band,
  };
  b.enemies.push(e);
  return e;
}

// ---------------- setup ----------------

export function startBattle(run: RunState, s: BattleSetup): BattleState {
  const form = FORMATIONS[run.formation] ?? FORMATIONS['free-fight'];
  const b: BattleState = {
    kind: s.kind, title: s.title, round: 0, rank: s.rank, boss: !!s.boss, heroes: [], enemies: [], queue: [], charged: [],
    nextKey: 1, nextUid: 1, lpLost: false, over: null, log: [], events: [], pity: {}, sparked: [], rankBonus: 0,
    evilTier: s.evilTier ?? 0, evilId: s.evilId ?? null, noRevive: false,
  };
  const living = run.party.filter((h) => !h.dead);
  living.forEach((h, i) => {
    if (h.hp <= 0) h.hp = 1;
    b.heroes.push({
      uid: h.uid, row: form.rows[Math.min(i, form.rows.length - 1)], draw: shuffle(run.rng, [...h.deck]), hand: [], discard: [],
      wp: stats(h).wp, jp: 2, guard: 0, counter: 0, statuses: {}, downed: false, desperateArmed: false, desperateUsed: false, destinyUsed: false, played: 0,
    });
  });
  for (const id of s.enemies) {
    const m = monster(id);
    const phases = m.band === 'evil' ? s.phases ?? 1 : 1;
    if (m.mech.includes('pack3')) { for (let i = 0; i < 3; i++) spawnEnemy(b, id, s.rank); } else spawnEnemy(b, id, s.rank, phases);
  }
  say(b, `${s.title}!`);
  beginRound(run, b);
  return b;
}

// ---------------- rounds ----------------

function draw(run: RunState, b: BattleState, h: BattleHero, n: number) {
  for (let i = 0; i < n; i++) {
    if (h.draw.length === 0) {
      if (h.discard.length === 0) return;
      h.draw = shuffle(run.rng, h.discard);
      h.discard = [];
    }
    const id = h.draw.pop()!;
    h.hand.push({ key: b.nextKey++, id });
  }
}

function beginRound(run: RunState, b: BattleState) {
  b.round++;
  const form = FORMATIONS[run.formation] ?? FORMATIONS['free-fight'];
  for (const h of b.heroes) {
    const hs = heroState(run, h.uid);
    if (b.round > 1) {
      h.wp = Math.min(WP_CAP, h.wp + 3 + form.wpRegen - (h.statuses.chill ? 2 : 0));
      h.jp = Math.min(JP_CAP, h.jp + 2 + form.jpRegen);
    }
    h.guard = h.downed ? 0 : form.guardEachRound;
    h.counter = 0;
    h.played = 0;
    if (!h.downed && !hs.dead) draw(run, b, h, h.statuses.sleep ? 0 : HAND_SIZE - h.hand.length);
    if (h.statuses.sleep) say(b, `${hs.name} is asleep and draws nothing.`);
  }
  // Horde drummers raise the rank; conscript waves arrive every second round
  for (const e of aliveEnemies(b)) {
    if (hasMech(e, 'raiseRank')) { b.rankBonus++; for (const o of aliveEnemies(b)) o.atk += 1; say(b, `${e.name}'s drums raise the enemy rank!`); }
  }
  if (b.round > 1 && b.round % 2 === 0 && aliveEnemies(b).some((e) => hasMech(e, 'waves')) && aliveEnemies(b).length < 5) {
    const c = spawnEnemy(b, 'conscript', b.rank);
    b.events.push({ k: 'summon', enemy: c.uid });
    say(b, 'Another Conscript joins the line.');
  }
  for (const e of aliveEnemies(b)) {
    e.guard = 0; e.dodged = false; e.countered = false;
    if (e.submerged && e.intent) e.submerged = false;
    e.intent = chooseIntent(run, b, e);
  }
}

function moveOptions(b: BattleState, e: EnemyState): MoveDef[] {
  const m = monster(e.defId);
  let moves = m.moves.filter((x) => (x.minPhase ?? 1) <= e.phase);
  const forced = moves.filter((x) => x.every && b.round % x.every === 0);
  if (forced.length) return forced;
  moves = moves.filter((x) => !x.every);
  moves = e.charged ? moves.filter((x) => x.afterCharge) : moves.filter((x) => !x.afterCharge);
  if (!moves.length) moves = m.moves.filter((x) => !x.every && !x.afterCharge);
  if (aliveEnemies(b).length >= 6) moves = moves.filter((x) => x.kind !== 'summon');
  if (!aliveEnemies(b).some((o) => o !== e && o.hp < o.maxHp)) moves = moves.filter((x) => x.kind !== 'heal');
  return moves.length ? moves : [{ id: 'strike', name: 'Strike', kind: 'attack', power: 1, weight: 1 }];
}

function liveHeroes(b: BattleState, run: RunState) { return b.heroes.filter((h) => !h.downed && !heroState(run, h.uid).dead); }

function pickTarget(run: RunState, b: BattleState, e: EnemyState, mv: MoveDef): string[] {
  const alive = liveHeroes(b, run);
  if (!alive.length) return [];
  if (hasMech(e, 'hitDownedFirst')) {
    const downed = b.heroes.filter((h) => h.downed && !heroState(run, h.uid).dead);
    if (downed.length) return [pick(run.rng, downed).uid];
  }
  if (mv.target === 'lowest') return [alive.reduce((a, c) => (heroState(run, c.uid).hp < heroState(run, a.uid).hp ? c : a)).uid];
  if (mv.target === 'back' || mv.kind === 'pull') {
    const back = alive.filter((h) => h.row === 'back');
    if (back.length) return [pick(run.rng, back).uid];
  }
  const front = alive.filter((h) => h.row === 'front');
  return [pick(run.rng, front.length ? front : alive).uid];
}

function enemyHitEstimate(run: RunState, b: BattleState, e: EnemyState, mv: MoveDef, uid?: string) {
  const def = uid ? stats(heroState(run, uid)).def : 0;
  return Math.max(1, Math.round(e.atk * mv.power * (e.statuses.weak ? 0.6 : 1)) + (e.copied ? 2 : 0) - def);
}

function chooseIntent(run: RunState, b: BattleState, e: EnemyState): Intent | null {
  if (e.statuses.stun || e.statuses.sleep) return null;
  const mv = weighted(run.rng, moveOptions(b, e), (x) => x.weight);
  const name = e.copied && mv.kind === 'attack' ? `Mimic ${e.copied}` : mv.name;
  let targets: string[] = [];
  let text = '';
  const st = mv.status ? ` + ${mv.status.s}` : '';
  const lp = mv.lp ? ` and ${mv.lp} LP` : '';
  switch (mv.kind) {
    case 'attack': case 'pull': case 'steal':
      targets = pickTarget(run, b, e, mv);
      text = `${name}: ${targets.map((t) => heroState(run, t).name).join(', ')} for ${enemyHitEstimate(run, b, e, mv, targets[0])}${st}${lp}${mv.kind === 'pull' ? ', pulls to the front' : ''}${mv.kind === 'steal' ? ', steals a card' : ''}`;
      break;
    case 'multi':
      targets = pickTarget(run, b, e, mv);
      text = `${name}: ${mv.hits} hits of ${enemyHitEstimate(run, b, e, mv)} on ${heroState(run, targets[0]).name}${st}`;
      break;
    case 'all': text = `${name}: everyone for ${enemyHitEstimate(run, b, e, mv)}${st}${lp}`; break;
    case 'frontRow': text = `${name}: the front row for ${enemyHitEstimate(run, b, e, mv)}${st}`; break;
    case 'charge': text = `${name}: gathering power`; break;
    case 'buff': text = `${name}: all enemies grow stronger`; break;
    case 'heal': text = `${name}: heals an ally`; break;
    case 'summon': text = `${name}: calls reinforcements`; break;
    case 'guard': text = `${name}: raises its guard`; break;
    case 'toll': text = `${name}: every hero loses ${mv.lp ?? 1} LP`; break;
    case 'submerge': text = `${name}: sinks out of reach`; break;
    case 'status': text = `${name}${st}`; break;
  }
  return { moveId: mv.id, name, kind: mv.kind, targets, text };
}

// ---------------- playing cards ----------------

export function cardCost(c: CardDef) { return c.cost; }

export function canPlay(run: RunState, b: BattleState, uid: string, key: number): { ok: boolean; reason?: string } {
  if (b.over) return { ok: false, reason: 'The battle is over.' };
  const h = bhero(b, uid);
  const hs = heroState(run, uid);
  if (h.downed || hs.dead) return { ok: false, reason: `${hs.name} is down.` };
  const hc = h.hand.find((x) => x.key === key);
  if (!hc) return { ok: false, reason: 'Not in hand.' };
  const c = card(hc.id);
  if (c.kind === 'tech' && h.statuses.bind) return { ok: false, reason: `${hs.name} is bound and cannot use techs.` };
  if (c.quick && (FORMATIONS[run.formation]?.noQuick)) return { ok: false, reason: 'Tortoise formation forbids Quick cards.' };
  if (c.kind === 'destiny' && h.destinyUsed) return { ok: false, reason: 'Destiny can be used once per battle.' };
  if (c.kind === 'spell' && h.jp < c.cost) return { ok: false, reason: `Needs ${c.cost} JP.` };
  if (c.kind !== 'spell' && h.wp < c.cost) return { ok: false, reason: `Needs ${c.cost} WP.` };
  if (c.target === 'downedAlly' && !b.heroes.some((x) => x.downed && !heroState(run, x.uid).dead)) return { ok: false, reason: 'Nobody is down.' };
  return { ok: true };
}

/** Which targets a card may be aimed at: enemy uids (numbers) or hero uids (strings). Empty = no choice needed. */
export function validTargets(run: RunState, b: BattleState, uid: string, cardId: string): (number | string)[] {
  const c = card(cardId);
  const targetable = aliveEnemies(b).filter((e) => !e.submerged);
  switch (c.target) {
    case 'enemy': {
      const front = targetable.filter((e) => e.row === 'front');
      return (front.length ? front : targetable).map((e) => e.uid);
    }
    case 'enemyAny': case 'twoEnemies': return targetable.map((e) => e.uid);
    case 'ally': return b.heroes.filter((h) => !h.downed && !heroState(run, h.uid).dead).map((h) => h.uid);
    case 'downedAlly': return b.heroes.filter((h) => h.downed && !heroState(run, h.uid).dead).map((h) => h.uid);
    default: return [];
  }
}

export function sparkChildren(run: RunState, hs: HeroState, c: CardDef): CardDef[] {
  if (!hs.canSpark || !c.sparks) return [];
  return c.sparks
    .map(card)
    .filter((t) => t.weapon === hs.weapon && !hs.deck.includes(t.id) && (t.requires ?? []).every((r) => hs.deck.includes(r)));
}

export function playCard(run: RunState, b: BattleState, uid: string, key: number, target: number | string | null): boolean {
  const ok = canPlay(run, b, uid, key);
  if (!ok.ok) { say(b, ok.reason!); return false; }
  const h = bhero(b, uid);
  const hc = h.hand.find((x) => x.key === key)!;
  const c = card(hc.id);
  const hs = heroState(run, uid);
  const targets = validTargets(run, b, uid, c.id);
  if (targets.length && (target === null || !targets.includes(target))) target = targets[0];
  if (c.target === 'self') target = uid;
  if (c.kind === 'spell') h.jp -= c.cost; else h.wp -= c.cost;
  if (c.kind === 'destiny') h.destinyUsed = true;
  h.hand = h.hand.filter((x) => x.key !== key);
  h.played++;
  let desperate = false;
  if (h.desperateArmed && sparkChildren(run, hs, c).length) {
    desperate = true;
    h.desperateArmed = false;
    h.desperateUsed = true;
    loseLp(run, b, h, 1, 'Desperate Spark');
  }
  const entry: QueueEntry = { key, heroUid: uid, cardId: c.id, target, desperate };
  b.events.push({ k: 'play', hero: uid, card: c.id });
  if (c.quick) {
    resolveEntry(run, b, entry, 1, false);
    finishCard(h, c);
    checkOver(run, b);
  } else {
    b.queue.push(entry);
  }
  return true;
}

export function unqueue(run: RunState, b: BattleState, key: number) {
  const i = b.queue.findIndex((q) => q.key === key);
  if (i < 0) return;
  const q = b.queue[i];
  const h = bhero(b, q.heroUid);
  const c = card(q.cardId);
  if (c.kind === 'spell') h.jp += c.cost; else h.wp += c.cost;
  if (c.kind === 'destiny') h.destinyUsed = false;
  if (q.desperate) { h.desperateArmed = true; h.desperateUsed = false; }
  h.hand.push({ key: q.key, id: q.cardId });
  h.played--;
  b.queue.splice(i, 1);
}

export function armDesperate(run: RunState, b: BattleState, uid: string): boolean {
  const h = bhero(b, uid);
  const hs = heroState(run, uid);
  if (h.desperateUsed || h.downed || !hs.canSpark || hs.lp <= 1) return false;
  h.desperateArmed = !h.desperateArmed;
  return true;
}

export function reviveWithWp(run: RunState, b: BattleState, reviver: string, downed: string): boolean {
  const r = bhero(b, reviver);
  const d = bhero(b, downed);
  if (r.downed || r.wp < 2 || !d.downed || heroState(run, downed).dead) return false;
  if (noRevive(b)) { say(b, 'A pale smoke smothers the revive. It fails.'); return false; }
  r.wp -= 2;
  reviveHero(run, b, d, 0.25);
  return true;
}

function noRevive(b: BattleState) { return b.noRevive || aliveEnemies(b).some((e) => hasMech(e, 'noRevive')); }

function reviveHero(run: RunState, b: BattleState, h: BattleHero, pct: number) {
  const hs = heroState(run, h.uid);
  h.downed = false;
  hs.hp = Math.max(1, Math.round(hs.maxHp * pct));
  b.events.push({ k: 'revive', hero: h.uid });
  say(b, `${hs.name} gets back up.`);
}

function finishCard(h: BattleHero, c: CardDef) {
  if (!c.exhaust) h.discard.push(c.id);
}

// ---------------- combos ----------------

export interface ComboGroup { start: number; len: number; mult: number; heroes: number }

export function comboGroups(b: BattleState): ComboGroup[] {
  const out: ComboGroup[] = [];
  const q = b.queue;
  let i = 0;
  while (i < q.length) {
    let j = i;
    while (j + 1 < q.length) {
      const a = card(q[j].cardId), c = card(q[j + 1].cardId);
      if (a.close && c.open && a.close === c.open) j++; else break;
    }
    const len = j - i + 1;
    const heroes = new Set(q.slice(i, j + 1).map((x) => x.heroUid)).size;
    if (len >= 2 && heroes >= 2) out.push({ start: i, len, mult: COMBO_MULT[Math.min(5, len)], heroes });
    i = j + 1;
  }
  return out;
}

// ---------------- resolution ----------------

export function endRound(run: RunState, b: BattleState) {
  if (b.over) return;
  // charged techs from last round go first
  const charged = b.charged;
  b.charged = [];
  for (const q of charged) { resolveEntry(run, b, { ...q, charged: true }, 1, false); if (checkOver(run, b)) return; }
  const groups = comboGroups(b);
  const queue = b.queue;
  b.queue = [];
  for (let i = 0; i < queue.length; i++) {
    const g = groups.find((x) => i >= x.start && i < x.start + x.len);
    if (g && i === g.start) {
      const names = queue.slice(g.start, g.start + g.len).map((q) => card(q.cardId).name);
      b.events.push({ k: 'combo', n: g.len, mult: g.mult, names });
      say(b, `${g.len}-card Combination! ${names.join(' + ')} (x${g.mult})`);
    }
    const q = queue[i];
    const c = card(q.cardId);
    const h = bhero(b, q.heroUid);
    if (c.effects.some((e) => e.t === 'charge') && !q.charged) {
      b.charged.push(q);
      say(b, `${heroState(run, q.heroUid).name} raises ${c.name} and gathers strength.`);
      continue;
    }
    resolveEntry(run, b, q, g ? g.mult : 1, !!g && g.len >= 3, g?.len ?? 0);
    finishCard(h, c);
    if (checkOver(run, b)) return;
  }
  // enemies act
  for (const e of [...b.enemies]) {
    if (e.hp <= 0) continue;
    enemyAct(run, b, e);
    if (checkOver(run, b)) return;
  }
  cleanup(run, b);
  if (checkOver(run, b)) return;
  beginRound(run, b);
}

function resolveEntry(run: RunState, b: BattleState, q: QueueEntry, mult: number, comboPierce: boolean, comboLen = 0) {
  const h = bhero(b, q.heroUid);
  const hs = heroState(run, q.heroUid);
  let c = card(q.cardId);
  if (h.downed || hs.dead) { say(b, `${c.name} fizzles: ${hs.name} is down.`); return; }
  // sparking happens as the card is about to resolve; the new tech resolves in its place
  const targetsEnemy = ['enemy', 'enemyAny', 'allEnemies', 'randomEnemies', 'twoEnemies'].includes(c.target);
  if ((c.kind === 'tech' || c.kind === 'basic') && targetsEnemy && hs.canSpark) {
    const sparked = rollSpark(run, b, h, hs, c, q.desperate, comboLen >= 5 ? 2 : 1);
    if (sparked) c = sparked;
  }
  if (c.kind === 'destiny') {
    const sp = destinySpark(run, b, hs);
    if (sp) say(b, `Destiny awakens ${sp.name}!`);
  }
  applyEffects(run, b, h, hs, c, q.target, mult, comboPierce || comboLen >= 3, comboLen >= 4);
}

function rollSpark(run: RunState, b: BattleState, h: BattleHero, hs: HeroState, c: CardDef, desperate: boolean, pressureMult: number): CardDef | null {
  const kids = sparkChildren(run, hs, c).sort((a, z) => z.tier - a.tier);
  if (!kids.length) return null;
  let got: CardDef | null = null;
  if (desperate) got = kids[0];
  else {
    const rank = b.rank + b.rankBonus;
    let pressure = pressureMult;
    if (hs.hp < hs.maxHp / 2) pressure *= 1.25;
    if (b.lpLost) pressure *= 1.25;
    if (b.boss) pressure *= 1.5;
    for (const k of kids) {
      const key = `${hs.uid}:${k.id}`;
      const pity = run.sparkPity[key] ?? 0;
      const p = SPARK_SCALE * SPARK_BASE[k.tier] * Math.min(2, rank / k.tier) * pressure * (1 + 0.1 * pity);
      if (next(run.rng) < p) { got = k; break; }
      run.sparkPity[key] = pity + 1;
    }
  }
  if (!got) return null;
  hs.deck.push(got.id);
  if (!run.codex.includes(got.id)) run.codex.push(got.id);
  const key = `${hs.uid}:${got.id}`;
  delete run.sparkPity[key];
  run.sparksTotal++;
  b.sparked.push({ hero: hs.uid, card: got.id });
  b.events.push({ k: 'spark', hero: hs.uid, card: got.id, from: c.id });
  say(b, `${hs.name} sparks! ${got.name}!`);
  return got;
}

function destinySpark(run: RunState, b: BattleState, hs: HeroState): CardDef | null {
  if (!hs.canSpark) return null;
  const owned = hs.deck.map(card);
  const options = owned.flatMap((c) => sparkChildren(run, hs, c)).sort((a, z) => z.tier - a.tier);
  if (!options.length) return null;
  const got = options[0];
  hs.deck.push(got.id);
  if (!run.codex.includes(got.id)) run.codex.push(got.id);
  b.events.push({ k: 'spark', hero: hs.uid, card: got.id, from: 'destiny' });
  return got;
}

function resolveEnemyTargets(run: RunState, b: BattleState, h: BattleHero, c: CardDef, target: number | string | null): EnemyState[] {
  const alive = aliveEnemies(b).filter((e) => !e.submerged);
  if (!alive.length) return [];
  const single = ['enemy', 'enemyAny', 'twoEnemies'].includes(c.target);
  if (single) {
    const lure = alive.find((e) => hasMech(e, 'lure') && !e.dodged);
    let t = alive.find((e) => e.uid === target);
    if (lure && (!t || t.uid !== lure.uid)) { t = lure; say(b, `${lure.name} lures the attack!`); }
    if (!t || (c.target === 'enemy' && t.row === 'back' && alive.some((e) => e.row === 'front'))) {
      const front = alive.filter((e) => e.row === 'front');
      t = pick(run.rng, c.target === 'enemy' && front.length ? front : alive);
    }
    // a Shield Sergeant takes hits meant for its neighbours
    const idx = b.enemies.indexOf(t);
    const guard = [b.enemies[idx - 1], b.enemies[idx + 1]].find((x) => x && x.hp > 0 && x !== t && hasMech(x, 'protectAdjacent'));
    if (guard && c.target !== 'enemyAny') { say(b, `${guard.name} steps in front of ${t.name}!`); t = guard; }
    if (c.target === 'twoEnemies') {
      const other = alive.filter((e) => e !== t);
      return other.length ? [t, pick(run.rng, other)] : [t];
    }
    return [t];
  }
  if (c.target === 'allEnemies') return alive;
  void h;
  return alive;
}

function allyTargets(run: RunState, b: BattleState, h: BattleHero, c: CardDef, target: number | string | null): BattleHero[] {
  const live = b.heroes.filter((x) => !heroState(run, x.uid).dead);
  switch (c.target) {
    case 'self': return [h];
    case 'allAllies': return live.filter((x) => !x.downed || c.effects.some((e) => e.t === 'revive'));
    case 'ally': case 'downedAlly': return live.filter((x) => x.uid === target).slice(0, 1).concat(live.find((x) => x.uid === target) ? [] : [h]);
    default: return [h];
  }
}

function applyEffects(run: RunState, b: BattleState, h: BattleHero, hs: HeroState, c: CardDef, target: number | string | null, mult: number, pierceAll: boolean, stunAll: boolean) {
  const st = stats(hs);
  const isWeapon = c.kind === 'basic' || c.kind === 'tech' || c.kind === 'destiny';
  const enemyCard = ['enemy', 'enemyAny', 'allEnemies', 'randomEnemies', 'twoEnemies'].includes(c.target);
  let enemies = enemyCard ? resolveEnemyTargets(run, b, h, c, target) : [];
  const allies = enemyCard ? [h] : allyTargets(run, b, h, c, target);
  let dealt = 0;
  for (const ef of c.effects) {
    switch (ef.t) {
      case 'dmg': {
        const hits = ef.hits ?? 1;
        for (let i = 0; i < hits; i++) {
          if (c.target === 'randomEnemies') {
            const alive = aliveEnemies(b).filter((e) => !e.submerged);
            if (!alive.length) break;
            enemies = [pick(run.rng, alive)];
          }
          for (const e of enemies) {
            if (e.hp <= 0) continue;
            const base = ef.n + (isWeapon ? st.atk : c.kind === 'spell' ? st.mag : 0);
            dealt += hitEnemy(run, b, h, hs, c, e, base * mult * (ef.vs && hasTag(e, ef.vs.tag) ? ef.vs.mult : 1), !!ef.pierce || pierceAll, ef.armorBreak ?? 0);
          }
        }
        if (stunAll) for (const e of enemies) if (e.hp > 0) { e.statuses.stun = 1; e.intent = null; }
        break;
      }
      case 'spendAllWp': {
        const n = h.wp * ef.perWp + st.atk;
        h.wp = 0;
        for (const e of enemies) dealt += hitEnemy(run, b, h, hs, c, e, n, true, 0);
        break;
      }
      case 'status':
        if (enemyCard) {
          for (const e of enemies) {
            if (e.hp <= 0 || (ef.chance !== undefined && !chance(run.rng, ef.chance))) continue;
            if (ef.s === 'burn' && hasMech(e, 'burnImmune')) continue;
            e.statuses[ef.s] = Math.max(e.statuses[ef.s] ?? 0, ef.turns);
            if (ef.s === 'stun' || ef.s === 'sleep') e.intent = null;
            b.events.push({ k: 'status', to: e.uid, s: ef.s });
          }
        } else {
          for (const a of allies) { a.statuses[ef.s] = Math.max(a.statuses[ef.s] ?? 0, ef.turns); b.events.push({ k: 'status', to: a.uid, s: ef.s }); }
        }
        break;
      case 'guard': for (const a of allies) { if (a.downed) continue; a.guard += ef.n + (c.kind === 'basic' ? st.def : 0); b.events.push({ k: 'guard', to: a.uid, n: ef.n }); } break;
      case 'heal':
        for (const a of allies) {
          if (a.downed) continue;
          const t = heroState(run, a.uid);
          const n = Math.min(t.maxHp - t.hp, ef.n + (c.kind === 'spell' ? st.mag : 0));
          t.hp += n;
          b.events.push({ k: 'heal', to: a.uid, n });
        }
        break;
      case 'wp': for (const a of allies) a.wp = Math.min(WP_CAP, a.wp + ef.n); break;
      case 'jp': for (const a of allies) a.jp = Math.min(JP_CAP, a.jp + ef.n); break;
      case 'draw': for (const a of allies) draw(run, b, a, ef.n); break;
      case 'revive':
        if (noRevive(b)) { say(b, 'A pale smoke smothers the revive. It fails.'); break; }
        for (const a of allies) if (a.downed) reviveHero(run, b, a, ef.pct);
        break;
      case 'cleanse': for (const a of allies) for (const s of BAD) delete a.statuses[s]; break;
      case 'counter': h.counter += ef.n; break;
      case 'cancelIntent': for (const e of enemies) if (e.hp > 0 && e.intent) { say(b, `${e.name} is pinned and loses its action.`); e.intent = null; } break;
      case 'lifesteal': { const n = Math.min(hs.maxHp - hs.hp, Math.round(dealt * ef.pct)); hs.hp += n; if (n) b.events.push({ k: 'heal', to: h.uid, n }); break; }
      case 'selfDmg': hs.hp = Math.max(1, hs.hp - ef.n); break;
      case 'move': h.row = h.row === 'front' ? 'back' : 'front'; say(b, `${hs.name} moves to the ${h.row} row.`); break;
      case 'lp': for (const a of allies) { const t = heroState(run, a.uid); t.lp = Math.min(t.maxLp, t.lp + ef.n); b.events.push({ k: 'lp', hero: a.uid, n: ef.n }); } break;
      case 'delayEvils':
        if (!run.evilDelayUsed) {
          run.evilDelayUsed = true;
          for (const ev of Object.values(run.evils)) ev.offset -= ef.n;
          say(b, 'The rightful crown is raised. The Evils falter: every Evil is delayed by one Season.');
        }
        break;
      case 'charge': break;
    }
  }
}

function hitEnemy(run: RunState, b: BattleState, h: BattleHero, hs: HeroState, c: CardDef, e: EnemyState, raw: number, pierce: boolean, armorBreak: number): number {
  if (e.hp <= 0) return 0;
  const physical = c.kind !== 'spell';
  if (physical && h.statuses.blind && chance(run.rng, 0.5)) { b.events.push({ k: 'miss', to: e.uid }); return 0; }
  if (physical && hasMech(e, 'dodgeFirst') && !e.dodged) { e.dodged = true; b.events.push({ k: 'miss', to: e.uid }); say(b, `${e.name} drifts aside.`); return 0; }
  if (c.kind === 'spell') {
    if (c.school === 'celestial' && hasMech(e, 'celestialImmune')) { say(b, `${e.name} is untouched by holy light.`); return 0; }
    if ((c.school === 'celestial' && hasMech(e, 'reflectCelestial')) || (hasMech(e, 'reflectSpell') && !e.risen)) {
      if (hasMech(e, 'reflectSpell')) e.risen = true; // reflects only the first spell
      const n = Math.round(raw);
      hs.hp = Math.max(1, hs.hp - n);
      b.events.push({ k: 'dmg', to: h.uid, n });
      say(b, `${e.name} turns ${c.name} back on ${hs.name}!`);
      return 0;
    }
  }
  if (c.weapon === 'axe' && hasMech(e, 'axeBreaks') && e.armor > 0) { e.armor = 0; say(b, `${c.name} splits ${e.name}'s shell!`); }
  if (armorBreak) e.armor = Math.max(0, e.armor - armorBreak);
  let n = Math.round(raw);
  if (!pierce) n = Math.max(1, n - e.armor);
  const blocked = Math.min(e.guard, n);
  e.guard -= blocked;
  n -= blocked;
  e.hp -= n;
  b.events.push({ k: 'dmg', to: e.uid, n, heavy: n >= 20, blocked: blocked > 0 });
  b.log.push(`${hs.name}'s ${c.name} hits ${e.name} for ${n}${blocked ? ` (${blocked} blocked)` : ''}.`);
  if (c.kind === 'tech' && hasMech(e, 'copyTech')) e.copied = c.name;
  // counters
  const counterSS = hasMech(e, 'counterSwordSpear') && c.kind === 'tech' && (c.weapon === 'sword' || c.weapon === 'spear');
  const counterTech = hasMech(e, 'mirrorCounter') && c.kind === 'tech' && !e.countered;
  const counterAny = hasMech(e, 'counterOnce') && !e.countered && physical;
  if (e.hp > 0 && (counterSS || counterTech || counterAny)) {
    e.countered = true;
    say(b, `${e.name} counters!`);
    damageHero(run, b, e, h, Math.round(e.atk * 0.9), hasMech(e, 'burnOnHit') ? { s: 'burn', turns: 2 } : undefined);
  }
  if (e.hp <= 0) onEnemyDown(run, b, e);
  else if (hasMech(e, 'callWave') && e.band === 'elite' && e.hp < e.maxHp / 2 && !e.risen) {
    e.risen = true;
    for (let i = 0; i < 2; i++) { const s = spawnEnemy(b, 'conscript', b.rank); b.events.push({ k: 'summon', enemy: s.uid }); }
    say(b, `${e.name} calls a fresh wave!`);
  }
  return n;
}

function onEnemyDown(run: RunState, b: BattleState, e: EnemyState) {
  if (e.phase < e.phases) {
    e.phase++;
    e.hp = e.maxHp;
    e.charged = false;
    e.statuses = {};
    e.atk = Math.round(e.atk * 1.12);
    b.events.push({ k: 'phase', enemy: e.uid, phase: e.phase });
    say(b, `${e.name} rises into its ${e.phase === 2 ? 'second' : 'third'} form!`);
    return;
  }
  if (hasMech(e, 'riseOnce') && !e.risen) {
    e.risen = true;
    e.hp = Math.round(e.maxHp / 2);
    say(b, `${e.name} drags itself up again!`);
    return;
  }
  e.hp = 0;
  e.intent = null;
  b.events.push({ k: 'defeat', enemy: e.uid });
  say(b, `${e.name} is defeated.`);
  if (e.stolen) {
    const owner = b.heroes.find((x) => x.uid === e.stolen!.heroUid);
    if (owner) owner.discard.push(e.stolen.cardId);
    say(b, `The stolen ${card(e.stolen.cardId).name} card is recovered.`);
    e.stolen = null;
  }
  if (hasMech(e, 'explodeOnDeath')) {
    say(b, `${e.name} bursts in pale fire!`);
    for (const h of b.heroes) if (!h.downed && h.row === 'front') damageHero(run, b, e, h, Math.round(e.atk * 0.8));
  }
  for (const o of aliveEnemies(b)) if (hasMech(o, 'growOnAllyDeath')) { o.atk += 2; o.growth++; say(b, `${o.name} feeds and grows stronger.`); }
}

// ---------------- enemies ----------------

function damageHero(run: RunState, b: BattleState, e: EnemyState, h: BattleHero, raw: number, status?: { s: StatusId; turns: number; chance?: number }, lp = 0): void {
  const hs = heroState(run, h.uid);
  if (hs.dead) return;
  if (e.statuses.blind && chance(run.rng, 0.5)) { b.events.push({ k: 'miss', to: h.uid }); return; }
  if (h.downed) {
    loseLp(run, b, h, 1, 'struck while down');
    return;
  }
  let n = Math.max(1, Math.round(raw * (e.statuses.weak ? 0.6 : 1)) - stats(hs).def);
  const blocked = Math.min(h.guard, n);
  h.guard -= blocked;
  n -= blocked;
  hs.hp -= n;
  b.events.push({ k: 'dmg', to: h.uid, n, heavy: n >= 15, blocked: blocked > 0 });
  b.log.push(`  ${hs.name} takes ${n}${blocked ? ` (${blocked} blocked)` : ''}.`);
  if (status && (status.chance === undefined || chance(run.rng, status.chance))) { h.statuses[status.s] = Math.max(h.statuses[status.s] ?? 0, status.turns); b.events.push({ k: 'status', to: h.uid, s: status.s }); }
  if (hasMech(e, 'burnOnHit') && n > 0) h.statuses.burn = Math.max(h.statuses.burn ?? 0, 2);
  if (lp) loseLp(run, b, h, lp, 'drained');
  if (h.counter > 0 && e.hp > 0) {
    say(b, `${hs.name} counters for ${h.counter}!`);
    e.hp -= h.counter;
    b.events.push({ k: 'dmg', to: e.uid, n: h.counter });
    if (e.hp <= 0) onEnemyDown(run, b, e);
  }
  if (hs.hp <= 0) downHero(run, b, h);
}

function downHero(run: RunState, b: BattleState, h: BattleHero) {
  const hs = heroState(run, h.uid);
  hs.hp = 0;
  h.downed = true;
  h.guard = 0;
  h.statuses = h.statuses.lpShield ? { lpShield: h.statuses.lpShield } : {};
  b.events.push({ k: 'downed', hero: h.uid });
  say(b, `${hs.name} falls!`);
  loseLp(run, b, h, 1, 'downed');
  if (b.evilTier >= 4 && b.kind === 'evil') loseLp(run, b, h, 1, 'the Ascendant aura');
  // queued cards from a downed hero fizzle later; charged ones are lost
  b.charged = b.charged.filter((q) => q.heroUid !== h.uid);
}

export function loseLp(run: RunState, b: BattleState, h: BattleHero, n: number, why: string) {
  const hs = heroState(run, h.uid);
  if (h.statuses.lpShield && why !== 'Desperate Spark') { delete h.statuses.lpShield; say(b, `Sanctuary shields ${hs.name}'s life.`); return; }
  hs.lp = Math.max(0, hs.lp - n);
  b.lpLost = true;
  b.events.push({ k: 'lp', hero: h.uid, n: -n });
  say(b, `${hs.name} loses ${n} LP (${why}). ${hs.lp} left.`);
  if (hs.lp <= 0) { say(b, `${hs.name} has no life left...`); h.downed = true; hs.hp = 0; }
}

function enemyAct(run: RunState, b: BattleState, e: EnemyState) {
  if (e.statuses.stun) { say(b, `${e.name} is stunned.`); return; }
  if (e.statuses.sleep) { say(b, `${e.name} sleeps.`); return; }
  const it = e.intent;
  if (!it) return;
  const mv = monster(e.defId).moves.find((m) => m.id === it.moveId) ?? { id: 'strike', name: 'Strike', kind: 'attack', power: 1, weight: 1 } as MoveDef;
  b.events.push({ k: 'enemyMove', enemy: e.uid, name: it.name });
  b.log.push(`${e.name}: ${it.name}.`);
  const power = e.atk * mv.power + (e.copied && mv.kind === 'attack' ? 2 : 0);
  const live = () => b.heroes.filter((h) => !heroState(run, h.uid).dead);
  const retarget = (uids: string[]) => {
    const hs = uids.map((u) => b.heroes.find((h) => h.uid === u)!).filter((h) => h && !heroState(run, h.uid).dead && (!h.downed || hasMech(e, 'hitDownedFirst')));
    if (hs.length) return hs;
    const alive = live().filter((h) => !h.downed);
    return alive.length ? [pick(run.rng, alive)] : [];
  };
  switch (mv.kind) {
    case 'attack': case 'pull': case 'steal': {
      for (const h of retarget(it.targets)) {
        if (mv.kind === 'pull' && h.row === 'back') { h.row = 'front'; say(b, `${e.name} drags ${heroState(run, h.uid).name} to the front!`); }
        if (mv.kind === 'steal' && h.hand.length && !e.stolen) {
          const idx = int(run.rng, 0, h.hand.length - 1);
          const stolen = h.hand.splice(idx, 1)[0];
          e.stolen = { heroUid: h.uid, cardId: stolen.id };
          say(b, `${e.name} steals ${card(stolen.id).name} from ${heroState(run, h.uid).name}'s hand!`);
        }
        if (mv.power > 0) damageHero(run, b, e, h, power, mv.status, mv.lp ?? 0);
        if (mv.drainWp) h.wp = Math.max(0, h.wp - mv.drainWp);
        if (mv.drainJp) h.jp = Math.max(0, h.jp - mv.drainJp);
      }
      break;
    }
    case 'multi': {
      const tgt = retarget(it.targets);
      for (let i = 0; i < (mv.hits ?? 2); i++) {
        const t = tgt[0] && !tgt[0].downed ? tgt[0] : retarget([])[0];
        if (t) damageHero(run, b, e, t, power, mv.status);
      }
      break;
    }
    case 'all':
      for (const h of live().filter((x) => !x.downed || mv.lp)) { damageHero(run, b, e, h, power, mv.status, mv.lp ?? 0); if (mv.drainWp) h.wp = Math.max(0, h.wp - mv.drainWp); }
      break;
    case 'frontRow': {
      let row = live().filter((h) => !h.downed && h.row === 'front');
      if (!row.length) row = live().filter((h) => !h.downed);
      for (const h of row) damageHero(run, b, e, h, power, mv.status);
      break;
    }
    case 'charge': e.charged = true; say(b, `${e.name} gathers terrible power...`); break;
    case 'buff': for (const o of aliveEnemies(b)) o.atk = Math.round(o.atk * 1.15) + 1; say(b, `${e.name}: ${mv.name}! The enemy grows stronger.`); break;
    case 'heal': {
      const hurt = aliveEnemies(b).filter((o) => o !== e && o.hp < o.maxHp).sort((a, z) => a.hp / a.maxHp - z.hp / z.maxHp)[0];
      if (hurt) { const n = Math.round(e.atk * mv.power * 2); hurt.hp = Math.min(hurt.maxHp, hurt.hp + n); b.events.push({ k: 'heal', to: hurt.uid, n }); }
      break;
    }
    case 'summon': {
      if (aliveEnemies(b).length < 6 && mv.summon) { const s = spawnEnemy(b, mv.summon, b.rank); b.events.push({ k: 'summon', enemy: s.uid }); say(b, `${e.name} calls a ${s.name}!`); }
      break;
    }
    case 'guard': e.guard = Math.round(e.atk * mv.power * 2); say(b, `${e.name} braces (${e.guard} Guard).`); break;
    case 'toll': for (const h of live()) loseLp(run, b, h, mv.lp ?? 1, mv.name); break;
    case 'submerge': e.submerged = true; say(b, `${e.name} sinks beneath the surface.`); break;
    case 'status': for (const h of retarget(it.targets)) if (mv.status) h.statuses[mv.status.s] = mv.status.turns; break;
  }
  if (mv.afterCharge) e.charged = false;
}

// ---------------- cleanup ----------------

function cleanup(run: RunState, b: BattleState) {
  const spread = aliveEnemies(b).some((e) => hasMech(e, 'spreadBurn'));
  const burning = b.heroes.filter((h) => h.statuses.burn && !h.downed);
  if (spread && burning.length) for (const h of b.heroes) if (!h.downed && !h.statuses.burn) { h.statuses.burn = 1; say(b, `The burn spreads to ${heroState(run, h.uid).name}.`); }
  for (const h of b.heroes) {
    const hs = heroState(run, h.uid);
    h.discard.push(...h.hand.map((x) => x.id));
    h.hand = [];
    if (h.statuses.burn && !h.downed && !hs.dead) {
      const n = 3 + Math.floor(b.rank / 3);
      hs.hp -= n;
      b.events.push({ k: 'dmg', to: h.uid, n });
      if (hs.hp <= 0) downHero(run, b, h);
    }
    tick(h.statuses);
  }
  for (const e of aliveEnemies(b)) {
    if (e.statuses.burn) {
      const n = 4 + Math.floor(b.rank / 2);
      e.hp -= n;
      b.events.push({ k: 'dmg', to: e.uid, n });
      if (e.hp <= 0) onEnemyDown(run, b, e);
    }
    tick(e.statuses);
  }
}

function tick(s: Partial<Record<StatusId, number>>) {
  for (const k of Object.keys(s) as StatusId[]) {
    if (k === 'lpShield') continue;
    s[k] = (s[k] ?? 0) - 1;
    if ((s[k] ?? 0) <= 0) delete s[k];
  }
}

export function checkOver(run: RunState, b: BattleState): boolean {
  if (b.over) return true;
  if (!aliveEnemies(b).length) { b.over = 'win'; say(b, 'Victory!'); return true; }
  if (b.heroes.every((h) => h.downed || heroState(run, h.uid).dead)) { b.over = 'lose'; say(b, 'The party has fallen...'); return true; }
  return false;
}

/** Text for an effect list, used for card faces. */
export function describe(c: CardDef): string[] {
  const out: string[] = [];
  const tgt: Record<string, string> = { enemy: '', enemyAny: ' (any row)', allEnemies: ' to all enemies', randomEnemies: ' to random enemies', twoEnemies: ' to two enemies', ally: ' to an ally', allAllies: ' to all allies', self: '', downedAlly: '', none: '' };
  for (const e of c.effects as Effect[]) {
    switch (e.t) {
      case 'dmg': out.push(`Deal ${e.n}${e.hits && e.hits > 1 ? ` x${e.hits}` : ''}${tgt[c.target]}.${e.pierce ? ' Ignores armour.' : ''}${e.armorBreak ? ` Breaks ${e.armorBreak} armour.` : ''}${e.vs ? ` x${e.vs.mult} vs ${e.vs.tag}.` : ''}`); break;
      case 'guard': out.push(`Gain ${e.n} Guard${c.target === 'allAllies' ? ' (all allies)' : c.target === 'ally' ? ' (an ally)' : ''}.`); break;
      case 'heal': out.push(`Heal ${e.n}${c.target === 'allAllies' ? ' to all allies' : ''}.`); break;
      case 'status': out.push(`${e.chance ? `${Math.round(e.chance * 100)}%: ` : ''}${cap(e.s === 'lpShield' ? 'shield 1 LP loss' : e.s)}${e.s === 'lpShield' ? '' : ` ${e.turns}`}.`); break;
      case 'wp': out.push(`+${e.n} WP.`); break;
      case 'jp': out.push(`+${e.n} JP.`); break;
      case 'draw': out.push(`Draw ${e.n}.`); break;
      case 'revive': out.push(`Revive a downed ally at ${Math.round(e.pct * 100)}% HP.`); break;
      case 'cleanse': out.push('Remove bad statuses.'); break;
      case 'counter': out.push(`Counter ${e.n} when struck this round.`); break;
      case 'cancelIntent': out.push('The target loses its action.'); break;
      case 'lifesteal': out.push('Heal by the damage dealt.'); break;
      case 'selfDmg': out.push(`Lose ${e.n} HP.`); break;
      case 'move': out.push('Swap rows.'); break;
      case 'lp': out.push(`+${e.n} LP.`); break;
      case 'delayEvils': out.push(`Once per run: delay every Evil by ${e.n} Season.`); break;
      case 'spendAllWp': out.push(`Spend all WP: deal ${e.perWp} per WP, ignoring armour. Sparks your best tech.`); break;
      case 'charge': out.push('Charges: resolves next round.'); break;
    }
  }
  return out;
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
