// A simple greedy player, used by tests and by tools/sim.ts to tune balance. Not used by the game UI.
import { bhero, canPlay, endRound, heroState, playCard, reviveWithWp, sparkChildren, stats, validTargets, armDesperate } from './battle';
import { card, EQUIPMENT } from './content/cards';
import { hero } from './content/heroes';
import { nextStep, REGIONS, TOWN_STOCK } from './content/map';
import {
  buyCard, buyEquipment, camp, canCamp, canStartFinal, chooseEvent, finishBattle, fightEvil, finalCamp, inn, innCost, leaveTown,
  recruit, recruitOptions, startFinal, takeReward, tavern, townOpen, travel, evilTier,
} from './run';
import type { RunState } from './types';

export function botRound(run: RunState) {
  const b = run.battle!;
  for (const h of b.heroes) {
    const hs = heroState(run, h.uid);
    if (h.downed || hs.dead) continue;
    // revive a fallen ally first
    const down = b.heroes.find((x) => x.downed && !heroState(run, x.uid).dead);
    if (down && h.wp >= 2) reviveWithWp(run, b, h.uid, down.uid);
    // a boss fight at low LP-risk: try a Desperate Spark
    if (b.boss && hs.canSpark && hs.lp > 5 && !h.desperateUsed && h.hand.some((c) => sparkChildren(run, hs, card(c.id)).length && h.wp >= card(c.id).cost)) armDesperate(run, b, h.uid);
    let guard = hs.hp < hs.maxHp * 0.4;
    for (let safety = 0; safety < 12; safety++) {
      const playable = h.hand.filter((c) => canPlay(run, b, h.uid, c.key).ok);
      if (!playable.length) break;
      const score = (id: string) => {
        const c = card(id);
        if (c.kind === 'item') return c.effects.some((e) => e.t === 'heal') && hs.hp < hs.maxHp * 0.5 ? 50 : c.effects.some((e) => e.t === 'revive') ? 60 : -1;
        if (c.id === 'guard') return guard ? 30 : 1;
        if (c.id === 'move') return 0.5;
        if (c.kind === 'story') return 2;
        const dmg = c.effects.reduce((a, e) => a + (e.t === 'dmg' ? e.n * (e.hits ?? 1) * (c.target === 'allEnemies' ? Math.max(1, b.enemies.filter((x) => x.hp > 0).length * 0.8) : 1) : 0), 0);
        const heal = c.effects.reduce((a, e) => a + (e.t === 'heal' ? (hs.hp < hs.maxHp * 0.6 ? e.n : 0) : e.t === 'guard' ? e.n * 0.5 : 0), 0);
        return dmg + heal + 3;
      };
      const best = playable.sort((a, z) => score(z.id) - score(a.id))[0];
      if (score(best.id) <= 0) break;
      const c = card(best.id);
      const tg = validTargets(run, b, h.uid, c.id);
      let target: number | string | null = null;
      if (tg.length && typeof tg[0] === 'number') {
        const es = b.enemies.filter((e) => tg.includes(e.uid));
        target = es.sort((a, z) => a.hp - z.hp)[0].uid;
      } else if (tg.length) {
        target = c.target === 'downedAlly' ? tg[0] : [...tg].sort((a, z) => heroState(run, a as string).hp / heroState(run, a as string).maxHp - heroState(run, z as string).hp / heroState(run, z as string).maxHp)[0];
      }
      playCard(run, b, h.uid, best.key, target);
      if (best.id === 'guard') guard = false;
      if (b.over) return;
    }
  }
  endRound(run, b);
}

function goal(run: RunState): string {
  const d = hero(run.mainHero).chronicle;
  const m = run.party.find((p) => !p.isCompanion && !p.dead)!;
  const hurt = run.party.some((p) => !p.dead && p.hp < p.maxHp * 0.55);
  const nearestTown = Object.values(REGIONS).filter((r) => r.type === 'town').sort((a, z) => dist(run, a.id) - dist(run, z.id))[0].id;
  if (hurt && run.crowns >= innCost(run)) return nearestTown;
  if (!run.party.some((p) => p.isCompanion && !p.dead) && run.crowns >= 60) return nearestTown;
  if (run.chronicle.act === 0) return d.act1.region;
  if (run.chronicle.act === 1) return d.act2.region;
  if (run.chronicle.act === 2) {
    // grow a little before the lieutenant
    if (run.battleCount < 5) return REGIONS[run.location].adj.find((a) => REGIONS[a].type === 'wilds') ?? d.act3.region;
    return d.act3.region;
  }
  void m;
  return run.location;
}

function dist(run: RunState, to: string) {
  let n = 0; let at = run.location;
  while (at !== to && n < 20) { at = nextStep(at, to); n++; }
  return n;
}

/** Play one decision. Returns false when the run is over. */
export function botStep(run: RunState): boolean {
  switch (run.phase) {
    case 'over': return false;
    case 'battle':
      if (run.battle!.over) finishBattle(run); else botRound(run);
      return true;
    case 'reward': {
      const a: Record<number, string | null> = {};
      run.reward!.cards.forEach((_, i) => { a[i] = run.party.find((p) => !p.dead)!.uid; });
      takeReward(run, a);
      return true;
    }
    case 'event': {
      const ev = run.event!;
      const pay = ev.choices.find((c) => c.id === 'pay' && !c.disabled);
      const pick = ev.tag === 'act2' ? (pay && run.party.some((p) => p.hp < p.maxHp * 0.6) ? 'pay' : 'fight') : ev.choices.find((c) => c.id === 'fight' || c.id === 'ok')?.id ?? ev.choices[0].id;
      chooseEvent(run, pick);
      return true;
    }
    case 'final': {
      if (!run.final!.campUsed && run.party.some((p) => !p.dead && p.hp < p.maxHp * 0.5)) finalCamp(run);
      const order = [...run.final!.remaining].sort((a, z) => evilTier(run, a) - evilTier(run, z));
      fightEvil(run, order[0]);
      return true;
    }
    case 'town': {
      tavern(run);
      if (townOpen(run)) {
        if (run.party.some((p) => !p.dead && p.hp < p.maxHp)) inn(run);
        const opts = recruitOptions(run);
        if (opts.length && run.crowns >= 60) recruit(run, opts[0]);
        const stock = TOWN_STOCK[run.location];
        for (const p of run.party.filter((x) => !x.dead)) {
          for (const e of stock?.equipment ?? []) {
            const eq = EQUIPMENT[e];
            const cur = eq.slot === 'weapon' ? EQUIPMENT[p.weaponItem] : p.armorItem ? EQUIPMENT[p.armorItem] : null;
            if ((eq.slot === 'armor' || eq.weapon === p.weapon) && (!cur || eq.tier > cur.tier) && run.crowns >= eq.price + 30) buyEquipment(run, e, p.uid);
          }
          if (run.crowns > 70 && p.deck.filter((c) => c === 'herb').length < 2) buyCard(run, 'herb', p.uid);
        }
      }
      leaveTown(run);
      return true;
    }
    case 'map': {
      if (canStartFinal(run) && (run.battleCount >= 9 || run.season >= run.maxSeasons - 3)) { startFinal(run); return true; }
      const m = run.party.find((p) => !p.isCompanion && !p.dead);
      if (canCamp(run) && m && m.lp <= Math.ceil(m.maxLp / 2)) { camp(run); return true; }
      const g = goal(run);
      const to = g === run.location ? REGIONS[run.location].adj[0] : nextStep(run.location, g);
      travel(run, to);
      return true;
    }
  }
  return true;
}

export function playOut(run: RunState, maxSteps = 5000) {
  for (let i = 0; i < maxSteps; i++) if (!botStep(run)) break;
  return run;
}

export { stats, bhero };
