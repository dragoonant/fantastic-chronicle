import { describe, expect, it } from 'vitest';
import { armDesperate, bhero, comboGroups, endRound, playCard, startBattle } from '../src/engine/battle';
import { card, CARDS } from '../src/engine/content/cards';
import { HERO_IDS } from '../src/engine/content/heroes';
import { MONSTERS } from '../src/engine/content/monsters';
import { REGIONS } from '../src/engine/content/map';
import { playOut } from '../src/engine/bot';
import { advanceSeason, evilTier, newRun } from '../src/engine/run';

const battle = (seed = 1, enemies = ['slag-hound']) => {
  const run = newRun(seed, 'serin', 'tamsin');
  run.battle = startBattle(run, { kind: 'wilds', title: 'Test', enemies, rank: 1 });
  run.phase = 'battle';
  return { run, b: run.battle };
};

describe('content', () => {
  it('every card reference resolves', () => {
    for (const c of Object.values(CARDS)) for (const s of [...(c.sparks ?? []), ...(c.requires ?? [])]) expect(CARDS[s], `${c.id} -> ${s}`).toBeTruthy();
  });
  it('the map is connected and symmetric', () => {
    for (const r of Object.values(REGIONS)) for (const a of r.adj) expect(REGIONS[a].adj).toContain(r.id);
  });
  it('has 40 roster monsters, 5 lieutenants and 5 Evils', () => {
    const ms = Object.values(MONSTERS);
    expect(ms.filter((m) => ['common', 'mid', 'high', 'elite'].includes(m.band))).toHaveLength(40);
    expect(ms.filter((m) => m.band === 'lieutenant')).toHaveLength(5);
    expect(ms.filter((m) => m.band === 'evil')).toHaveLength(5);
  });
});

describe('battle', () => {
  it('deals a hand of five to each hero', () => {
    const { b } = battle();
    for (const h of b.heroes) expect(h.hand).toHaveLength(5);
    expect(b.enemies[0].intent).not.toBeNull();
  });

  it('a basic attack is queued, then damages the enemy at end of round', () => {
    const { run, b } = battle();
    const h = bhero(b, 'h1');
    h.hand = [{ key: 900, id: 'sword-attack' }];
    const hp = b.enemies[0].hp;
    playCard(run, b, 'h1', 900, b.enemies[0].uid);
    expect(b.queue).toHaveLength(1);
    endRound(run, b);
    expect(b.enemies[0].hp).toBeLessThan(hp);
  });

  it('detects a Combination Attack across two heroes when symbols chain', () => {
    const { run, b } = battle(2, ['mire-crab']);
    bhero(b, 'h1').hand = [{ key: 901, id: 'cross-slash' }];   // o -> d
    bhero(b, 'h2').hand = [{ key: 902, id: 'double-shot' }];   // d -> D
    bhero(b, 'h1').wp = 8; bhero(b, 'h2').wp = 8;
    playCard(run, b, 'h1', 901, b.enemies[0].uid);
    playCard(run, b, 'h2', 902, b.enemies[0].uid);
    expect(comboGroups(b)).toEqual([{ start: 0, len: 2, mult: 1.3, heroes: 2 }]);
  });

  it('Desperate Spark costs 1 LP and guarantees a new tech', () => {
    const { run, b } = battle(3);
    const hs = run.party[0];
    const lp = hs.lp;
    bhero(b, 'h1').hand = [{ key: 903, id: 'sword-attack' }];
    expect(armDesperate(run, b, 'h1')).toBe(true);
    playCard(run, b, 'h1', 903, b.enemies[0].uid);
    endRound(run, b);
    expect(hs.lp).toBe(lp - 1);
    expect(hs.deck.some((id) => card(id).id === 'feint')).toBe(true);
    expect(run.codex).toContain('feint');
  });

  it('falling costs LP', () => {
    const { run, b } = battle(4, ['furnace-golem']);
    const hs = run.party[0];
    hs.hp = 1;
    const lp = hs.lp;
    for (let i = 0; i < 6 && !b.over && !bhero(b, 'h1').downed; i++) endRound(run, b);
    expect(bhero(b, 'h1').downed).toBe(true);
    expect(hs.lp).toBeLessThan(lp);
  });

  it('replays identically from the same seed', () => {
    const a = playOut(newRun(77, 'ketteran', 'yune'), 400);
    const z = playOut(newRun(77, 'ketteran', 'yune'), 400);
    expect(JSON.stringify(a.log)).toBe(JSON.stringify(z.log));
  });
});

describe('run', () => {
  it('Evils climb through their tiers as Seasons pass', () => {
    const run = newRun(5, 'oda', 'hollis');
    const id = 'saint' as const;
    const t1 = evilTier(run, id);
    advanceSeason(run, 15);
    expect(evilTier(run, id)).toBeGreaterThan(t1);
    expect(run.evils[id].claimed.length).toBeGreaterThan(1);
  });

  it('a bot can play every hero to the end without crashing', () => {
    for (const [i, id] of HERO_IDS.entries()) {
      const run = playOut(newRun(100 + i, id, HERO_IDS[(i + 3) % 8]), 6000);
      expect(run.phase, `${id}: ${run.log.slice(-3).join(' | ')}`).toBe('over');
    }
  });
});
