import { audio, type TrackName } from './audio';
import {
  armDesperate, bhero, canPlay, comboGroups, endRound, heroState, playCard, reviveWithWp, unqueue, validTargets,
} from './engine/battle';
import { card, EQUIPMENT, FORMATIONS } from './engine/content/cards';
import { HERO_IDS, hero } from './engine/content/heroes';
import { REGIONS, TERRITORIES, region } from './engine/content/map';
import { EVIL_IDS, EVIL_NAME, LIEUTENANT_OF, monster } from './engine/content/monsters';
import { hashSeed } from './engine/rng';
import {
  buyCard, buyEquipment, camp, canCamp, canStartFinal, chooseEvent, claimedBy, evilTier, fightEvil, finalCamp, finishBattle,
  forgetCard, forgetCost, inn, innCost, leaveTown, newRun, rank, recruit, recruitOptions, setFormation, shopStock, startFinal,
  takeReward, tavern, TIER_NAMES, townOpen, travel,
} from './engine/run';
import type { EvilId, RunState } from './engine/types';
import { art, bg, loadArt } from './ui/art';
import { battleMat, cardHtml, enemyHtml, esc, evilHtml, hpBar, lpPips, mapMat, portrait, SYM } from './ui/cards';
import { playEvents, toast } from './ui/fx';

const SAVE_KEY = 'fantastic-chronicle.run';
type Modal = null | { k: 'deck'; hero: string } | { k: 'help' } | { k: 'log' };
const ui = {
  screen: 'title' as 'title' | 'select' | 'game',
  pickHero: null as string | null,
  pickComp: null as string | null,
  seasons: 20,
  sel: null as null | { hero: string; key: number },
  modal: null as Modal,
  townTab: 'inn',
  townMsg: '',
  evSeen: 0,
  battleRef: null as unknown,
  assign: {} as Record<number, string | null>,
};
let run: RunState | null = load();
const app = document.getElementById('app')!;

function load(): RunState | null {
  try { const s = localStorage.getItem(SAVE_KEY); return s ? (JSON.parse(s) as RunState) : null; } catch { return null; }
}
function save() {
  try { if (run && run.phase !== 'over') localStorage.setItem(SAVE_KEY, JSON.stringify(run)); else localStorage.removeItem(SAVE_KEY); } catch { /* storage off */ }
}

// ---------------------------------------------------------------- music
function musicFor(): [TrackName, number] {
  if (ui.screen !== 'game' || !run) return ['title', 0];
  const terr = Object.keys(TERRITORIES).indexOf(region(run.location).territory);
  switch (run.phase) {
    case 'town': return ['town', terr];
    case 'battle': {
      const k = run.battle?.kind;
      if (run.battle?.over === 'win') return ['victory', 0];
      return k === 'evil' ? ['final', 0] : k === 'lieutenant' ? ['lieutenant', 0] : k === 'story' ? ['boss', 0] : k === 'dungeon' ? ['battle', 1] : ['battle', 0];
    }
    case 'reward': return ['victory', 0];
    case 'final': return ['final', 1];
    case 'over': return [run.outcome === 'victory' ? 'victory' : 'gameover', 0];
    default: return [region(run.location).type === 'dungeon' ? 'dungeon' : 'map', terr];
  }
}

// ---------------------------------------------------------------- render
function render() {
  app.innerHTML = view() + modalView();
  const [t, v] = musicFor();
  audio.music(t, { variant: v });
  if (run?.battle) {
    if (ui.battleRef !== run.battle) { ui.battleRef = run.battle; ui.evSeen = 0; }
    const evs = run.battle.events.slice(ui.evSeen);
    ui.evSeen = run.battle.events.length;
    if (evs.length) requestAnimationFrame(() => playEvents(run!, evs));
  }
  const log = document.querySelector('.log.autoscroll');
  if (log) log.scrollTop = log.scrollHeight;
  save();
}

function view(): string {
  if (ui.screen === 'title') return titleView();
  if (ui.screen === 'select') return selectView();
  if (!run) return titleView();
  switch (run.phase) {
    case 'battle': return battleView(run);
    case 'final': return finalView(run);
    case 'over': return overView(run);
    default: return mapView(run);
  }
}

function topbar(r: RunState, extra = ''): string {
  let pips = '';
  for (let s = 1; s <= r.maxSeasons; s++) pips += `<div class="season ${s < r.season ? 'past' : s === r.season ? 'now' : ''} ${s > r.maxSeasons * 0.7 ? 'late' : ''}" title="Season ${s}"></div>`;
  return `<div class="topbar">
    <span class="title">Fantastic Chronicle</span>
    <span class="pix">Season ${Math.min(r.season, r.maxSeasons)}/${r.maxSeasons}</span><div class="seasons">${pips}</div>
    ${extra}
    <span class="spacer"></span>
    <span class="crowns" title="Crowns">◉ ${r.crowns}</span>
    <button class="btn small" data-act="help">?</button>
    <button class="btn small" data-act="mute">${audio.getVolume('master') === 0 ? '♪ off' : '♪'}</button>
    <button class="btn small" data-act="quit" title="Your run is saved">Title</button>
  </div>`;
}

// ---------------------------------------------------------------- title & select
function titleView(): string {
  const saved = load();
  return `<div class="titlescreen"><div>
    <h1 class="logo">Fantastic Chronicle<small>A tabletop SaGa of eight heroes and five evils</small></h1>
    <div style="display:flex;flex-direction:column;gap:10px;align-items:center;margin-top:40px">
      ${saved && saved.phase !== 'over' ? `<button class="btn big gold" data-act="continue">Continue (Season ${saved.season}, ${esc(saved.party[0].name)})</button>` : ''}
      <button class="btn big" data-act="new">New Chronicle</button>
      <button class="btn" data-act="help">How to play</button>
    </div>
    <p class="dim" style="margin-top:40px">Prototype for playtesting · music and sound are generated live · art by FLUX.1-schnell with a house-style LoRA trained on evilgouki's hero sheet</p>
  </div></div>`;
}

function selectView(): string {
  const cards = HERO_IDS.map((id) => {
    const h = hero(id);
    const a = art('hero', id);
    const cls = ui.pickHero === id ? 'on' : ui.pickComp === id ? 'comp' : '';
    return `<div class="win herocard ${cls}" data-act="pick" data-id="${id}">
      <div class="portrait" style="${a ? `background-image:url('${a}')` : ''}">${a ? '' : esc(h.name[0])}</div>
      <div>
        <div class="pix" style="font-size:18px">${esc(h.name)} ${ui.pickHero === id ? '<span class="gold-t">· Hero</span>' : ui.pickComp === id ? '<span style="color:var(--blue)">· Companion</span>' : ''}</div>
        <div>${h.weapon[0].toUpperCase() + h.weapon.slice(1)}${h.school ? ` · ${h.school}` : ''} · HP ${h.hp} · ${lpPips(h.lp, h.lp)}</div>
        <div class="line">${esc(h.line)}</div>
        <div class="dim" style="font-size:15px;margin-top:4px">Chronicle: <span class="gold-t">${esc(h.chronicle.title)}</span> (${h.archetype}) · foe: ${esc(EVIL_NAME[h.antagonist])}</div>
      </div>
    </div>`;
  }).join('');
  return `<div class="select">
    <div class="win" style="margin-bottom:10px;display:flex;align-items:center;gap:14px">
      <div style="flex:1"><h2 class="pix">Choose your hero, then a companion</h2>
      <div class="dim">Your hero follows their Chronicle and can spark new techniques. The companion fights beside you with a small fixed deck, cannot spark, but can join Combination Attacks.</div></div>
      <label>Run length <select data-act="seasons" style="font:inherit">
        <option value="20" ${ui.seasons === 20 ? 'selected' : ''}>20 Seasons (standard solo)</option>
        <option value="14" ${ui.seasons === 14 ? 'selected' : ''}>14 Seasons (quick test)</option></select></label>
      <button class="btn big gold" data-act="start" ${ui.pickHero && ui.pickComp ? '' : 'disabled'}>Begin</button>
      <button class="btn" data-act="back">Back</button>
    </div>
    <div class="herogrid">${cards}</div>
  </div>`;
}

// ---------------------------------------------------------------- map table
function mapView(r: RunState): string {
  const here = r.location;
  const reach = new Set(r.phase === 'map' || r.phase === 'town' ? REGIONS[here].adj : []);
  const h = hero(r.mainHero);
  const storyRegions: Record<string, string> = {};
  if (r.chronicle.act === 0) storyRegions[h.chronicle.act1.region] = 'I';
  if (r.chronicle.act === 1) storyRegions[h.chronicle.act2.region] = 'II';
  if (r.chronicle.act === 2) storyRegions[h.chronicle.act3.region] = 'III';
  let lines = '';
  const seen = new Set<string>();
  for (const a of Object.values(REGIONS)) for (const b of a.adj) {
    const k = [a.id, b].sort().join('|');
    if (seen.has(k)) continue;
    seen.add(k);
    const B = REGIONS[b];
    const on = (a.id === here && reach.has(b)) || (b === here && reach.has(a.id));
    lines += `<line x1="${a.x}%" y1="${a.y * 1.24 + 6}%" x2="${B.x}%" y2="${B.y * 1.24 + 6}%" stroke="${on ? '#8ef' : '#e8dcb066'}" stroke-width="${on ? 4 : 3}" stroke-dasharray="${on ? '' : '6 6'}"/>`;
  }
  const terrLabels = Object.values(TERRITORIES).map((t) => {
    const rs = Object.values(REGIONS).filter((x) => x.territory === t.id);
    const x = rs.reduce((s, q) => s + q.x, 0) / rs.length;
    const y = Math.min(...rs.map((q) => q.y));
    return `<div class="terr-label" style="left:${x}%;top:${Math.max(0, y * 1.24 + 6 - 9)}%;transform:translateX(-50%);color:${t.color}">${esc(t.name)}${t.evil ? '' : ''}</div>`;
  }).join('');
  const regions = Object.values(REGIONS).map((rg) => {
    const cl = claimedBy(r, rg.id);
    const isReach = reach.has(rg.id);
    const typeLabel = { town: 'Town', wilds: 'Wilds', dungeon: 'Dungeon · 2 Seasons', seat: 'Lieutenant' }[rg.type];
    const lt = rg.type === 'seat' ? EVIL_IDS.find((e) => r.evils[e].claimed[0] === rg.id) : null;
    const tip = `${rg.name} (${typeLabel}). ${rg.text}${cl ? ` Claimed by ${EVIL_NAME[cl]}.` : ''} Enemy rank ${rank(r, rg.id)}.`;
    return `<div class="region ${rg.id === here ? 'here' : ''} ${isReach ? 'reach' : ''} ${cl ? 'claimed' : ''}" style="left:${rg.x}%;top:${rg.y * 1.24 + 6}%;${bg('region', rg.id)};border-color:${TERRITORIES[rg.territory].color}" ${isReach ? `data-act="travel" data-id="${rg.id}"` : ''} title="${esc(tip)}">
      ${storyRegions[rg.id] ? `<span class="r-story">✦ Act ${storyRegions[rg.id]}</span>` : ''}
      ${lt && r.evils[lt].lieutenantDefeated ? '<span class="r-badge">✝</span>' : rg.type === 'seat' ? '<span class="r-badge red-t">☠</span>' : rg.type === 'dungeon' ? '<span class="r-badge">⌂</span>' : rg.type === 'town' ? '<span class="r-badge">⌂</span>' : ''}
      <span class="r-name">${esc(rg.name)}</span><span class="r-type">${typeLabel}${cl ? ' · <span class="red-t">claimed</span>' : ''}</span>
    </div>`;
  }).join('');
  const loc = REGIONS[here];
  const token = `<div class="token" style="left:${loc.x}%;top:${loc.y * 1.24 + 6}%">⚑</div>`;
  const evils = EVIL_IDS.map((id) => { const t = evilTier(r, id); return evilHtml(r, id, t, TIER_NAMES[t]); }).join('');
  const act = r.chronicle.done ? 'Complete' : ['Not begun', 'Act I done', 'Act II done'][r.chronicle.act];
  const objective = r.chronicle.done ? 'Your Destiny is ready. March on the Evils when you choose.'
    : r.chronicle.act === 0 ? `Hear the rumour in the tavern at ${REGIONS[h.chronicle.act1.region].name}.`
    : r.chronicle.act === 1 ? `Act II waits at ${REGIONS[h.chronicle.act2.region].name}.`
    : `Act III: ${h.chronicle.act3.text} (${REGIONS[h.chronicle.act3.region].name})`;
  const form = FORMATIONS[r.formation];
  const forms = r.formations.map((f) => `<option value="${f}" ${f === r.formation ? 'selected' : ''}>${esc(FORMATIONS[f].name)}</option>`).join('');
  return `${topbar(r)}
  <div class="table">
    <div class="board"><svg>${lines}</svg>${terrLabels}${regions}${token}</div>
    <div class="side">
      <div class="win"><h3 class="pix">The Five Evils</h3><div class="evils">${evils}</div>
        <div class="dim" style="font-size:15px;margin-top:4px">Evils grow every Season: Stirring, Rising, Dominant, Ascendant, Cataclysm. Defeating a lieutenant (☠) sets its Evil back 2 Seasons and costs it a phase in the finale.</div></div>
      <div class="win"><h3 class="pix">Chronicle: ${esc(h.chronicle.title)} <span class="dim">(${act})</span></h3><div>${esc(objective)}</div></div>
      <div class="mats">${r.party.filter((p) => !p.dead || p.isCompanion).map((p) => mapMat(r, p)).join('')}</div>
      <div class="win">
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <label title="${esc(form.text)}">Formation <select data-act="formation" style="font:inherit">${forms}</select></label>
          ${region(here).type === 'town' && r.phase === 'map' ? '<button class="btn" data-act="entertown">Enter town</button>' : ''}
          <button class="btn" data-act="camp" ${canCamp(r) ? '' : 'disabled'} title="1 Season: restore HP and +1 LP for everyone. Once every 5 Seasons.">Camp</button>
          <button class="btn gold" data-act="final" ${canStartFinal(r) ? '' : 'disabled'} title="Requires a completed Chronicle. Otherwise it begins by itself after the last Season.">March on the Evils</button>
        </div>
        <div class="dim" style="font-size:15px;margin-top:4px">${esc(form.text)} Click a glowing region to travel (1 Season).</div>
      </div>
      <div class="win log autoscroll">${r.log.slice(-40).map((l) => `<div>${esc(l)}</div>`).join('')}</div>
    </div>
  </div>`;
}

// ---------------------------------------------------------------- battle table
function battleView(r: RunState): string {
  const b = r.battle!;
  const sel = ui.sel;
  const selCard = sel ? bhero(b, sel.hero).hand.find((x) => x.key === sel.key) : null;
  const targets = sel && selCard ? validTargets(r, b, sel.hero, selCard.id) : [];
  const back = b.enemies.filter((e) => e.row === 'back');
  const front = b.enemies.filter((e) => e.row === 'front');
  const eRow = (es: typeof b.enemies) => `<div class="erow">${es.map((e) => enemyHtml(e, { targetable: targets.includes(e.uid) })).join('')}</div>`;
  // the play line: charged techs, then the queue with combination links
  const groups = comboGroups(b);
  const inCombo = (i: number) => groups.some((g) => i >= g.start && i < g.start + g.len);
  let line = b.charged.map((q) => `<div class="qcard charged" title="Charging: resolves first next round"><div class="who">${esc(heroState(r, q.heroUid).name)} · charging</div><div class="nm">${esc(card(q.cardId).name)}</div></div>`).join('');
  b.queue.forEach((q, i) => {
    const c = card(q.cardId);
    if (i > 0) {
      const p = card(b.queue[i - 1].cardId);
      const on = p.close && c.open && p.close === c.open;
      line += `<span class="link ${on ? 'on' : ''}">${on ? '⟶' : '·'}</span>`;
    }
    const tgt = typeof q.target === 'number' ? b.enemies.find((e) => e.uid === q.target)?.name : typeof q.target === 'string' ? heroState(r, q.target).name : '';
    line += `<div class="qcard ${inCombo(i) ? 'combo' : ''}" data-act="unqueue" data-key="${q.key}" title="Click to take back">
      <div class="who">${esc(heroState(r, q.heroUid).name)}${q.desperate ? ' · <span class="gold-t">DESPERATE</span>' : ''}</div>
      <div class="nm">${esc(c.name)}</div><div class="who">${tgt ? `→ ${esc(tgt)}` : ''}</div>
      <div class="sym" style="position:absolute;bottom:2px;right:4px">${c.open && c.close ? `${SYM[c.open]}→${SYM[c.close]}` : ''}</div></div>`;
  });
  const comboText = groups.map((g) => `<span class="combo-tag">${g.len}-card Combination x${g.mult}${g.len >= 3 ? ', ignores armour' : ''}${g.len >= 4 ? ', stuns' : ''}</span>`).join(' ');
  const heroes = b.heroes.map((bh) => {
    const hs = heroState(r, bh.uid);
    if (hs.dead && !bh.downed) return '';
    const reviver = bh.downed && !hs.dead ? b.heroes.find((x) => !x.downed && x.wp >= 2 && !heroState(r, x.uid).dead)?.uid ?? null : null;
    const heroTarget = targets.includes(bh.uid);
    const hand = bh.hand.map((hc) => {
      const c = card(hc.id);
      const ok = canPlay(r, b, bh.uid, hc.key).ok;
      const selected = sel && sel.hero === bh.uid && sel.key === hc.key;
      return cardHtml(c, { run: r, cls: `${ok ? '' : 'unplayable'} ${selected ? 'selected' : ''}`, attrs: `data-act="card" data-hero="${bh.uid}" data-key="${hc.key}"` });
    }).join('');
    return `<div class="hrow ${bh.downed ? 'downed' : ''}">${battleMat(r, bh, hs, { targetable: heroTarget, reviveFrom: reviver })}
      <div class="hand">${hand || `<span class="empty">${bh.downed ? 'Down. Revive with a Phoenix Feather, a Revive spell, or 2 WP from an ally.' : 'No cards in hand.'}</span>`}</div></div>`;
  }).join('');
  const help = selCard ? `<div class="win"><b class="pix">${esc(card(selCard.id).name)}</b><div class="dim">${targets.length ? 'Choose a target (glowing).' : ''} Click the card again to cancel.</div></div>` : '';
  const over = b.over ? `<div class="overlay"><div class="win modal" style="text-align:center">
      <h2 class="pix" style="font-size:40px;color:${b.over === 'win' ? 'var(--gold)' : 'var(--red)'}">${b.over === 'win' ? 'Victory!' : 'Defeat'}</h2>
      <p>${b.over === 'win' ? `${b.enemies.length} foes defeated in ${b.round} rounds.` : b.kind === 'evil' ? 'The Evil overwhelms the party.' : 'The party is driven back. Fallen heroes get up with 1 HP, but LP lost is gone.'}</p>
      ${b.sparked.length ? `<p class="gold-t">New techniques: ${b.sparked.map((s) => esc(card(s.card).name)).join(', ')}</p>` : ''}
      <button class="btn big gold" data-act="finishbattle">Continue</button></div></div>` : '';
  return `${topbar(r, `<span class="pix gold-t">${esc(b.title)}</span><span class="dim">Round ${b.round} · Rank ${b.rank + b.rankBonus}${b.boss ? ' · Boss' : ''}</span>`)}
  <div class="battle">
    <div class="field">
      <div class="enemies">${back.length ? eRow(back) : ''}${eRow(front)}</div>
      <div class="playline">${line || '<span class="empty">Play cards from your hands. Techs whose symbols chain (◇→◇) across both heroes form Combination Attacks. Quick cards act at once.</span>'} ${comboText}</div>
      <div class="heroes">${heroes}</div>
    </div>
    <div class="side-battle">
      <button class="btn big gold" data-act="end" title="Space">End Round ▶</button>
      ${help}
      <div class="win" style="font-size:15px">WP +3/round (max 8) pays for techs. JP +2/round (max 6) pays for spells. Falling costs 1 LP. Basic attacks and Guard are free.</div>
      <div class="win log autoscroll">${b.log.slice(-60).map((l) => `<div>${esc(l)}</div>`).join('')}</div>
    </div>
  </div>${over}`;
}

// ---------------------------------------------------------------- final & over
function finalView(r: RunState): string {
  const f = r.final!;
  const cards = EVIL_IDS.map((id) => {
    const t = evilTier(r, id);
    const ev = r.evils[id];
    const phases = Math.max(1, (t <= 2 ? 1 : t === 3 ? 2 : 3) - (ev.lieutenantDefeated ? 1 : 0));
    const a = art('monster', `evil-${id}`);
    return `<div class="win" style="width:200px;text-align:center;${ev.defeated ? 'filter:grayscale(1) brightness(.5)' : ''}">
      <div class="portrait" style="width:100%;height:150px;${a ? `background-image:url('${a}');background-size:contain;background-repeat:no-repeat;background-color:#000` : ''}">${a ? '' : esc(EVIL_NAME[id][4])}</div>
      <h3 class="pix">${esc(EVIL_NAME[id])}</h3>
      <div class="gold-t">${TIER_NAMES[t]}${ev.lockedTier ? ' 🔒' : ''} · ${phases} phase${phases > 1 ? 's' : ''}</div>
      <div class="dim" style="font-size:15px">${esc(monster(`evil-${id}`).text)}${ev.lieutenantDefeated ? ' Its lieutenant is slain.' : ''}</div>
      ${ev.defeated ? '<div class="pix">Destroyed</div>' : `<button class="btn gold" data-act="fightevil" data-id="${id}">Confront</button>`}
    </div>`;
  }).join('');
  return `${topbar(r)}<div class="select">
    <div class="win" style="margin-bottom:10px"><h2 class="pix">The Final Confrontation</h2>
      <div>Defeat all five Evils, in any order. There is no rest between them except one Camp. Each fallen Evil restores a quarter of your HP.</div>
      <div style="margin-top:6px"><button class="btn" data-act="finalcamp" ${f.campUsed ? 'disabled' : ''}>Make the last Camp (HP full, +1 LP)</button></div></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">${cards}</div>
    <div class="mats" style="flex-direction:row;margin-top:10px;justify-content:center">${r.party.filter((p) => !p.dead).map((p) => `<div style="width:340px">${mapMat(r, p)}</div>`).join('')}</div>
  </div>`;
}

function overView(r: RunState): string {
  const win = r.outcome === 'victory';
  const m = r.party.find((p) => !p.isCompanion) ?? r.party[0];
  return `<div class="titlescreen"><div class="win" style="max-width:640px">
    <h1 class="logo" style="font-size:54px;color:${win ? 'var(--gold)' : 'var(--red)'}">${win ? 'The Chronicle is Written' : 'The Chronicle Ends'}</h1>
    <p>${win ? 'The Five Evils are destroyed.' : 'The Evils outlast the heroes this time.'}</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;text-align:left;margin:12px 0">
      <span>Seasons</span><span>${Math.min(r.season, r.maxSeasons)} of ${r.maxSeasons}</span>
      <span>Battles fought</span><span>${r.battleCount}</span>
      <span>Techniques sparked</span><span>${r.sparksTotal}</span>
      <span>Chronicle</span><span>${r.chronicle.done ? 'Complete' : `Act ${r.chronicle.act} of 3`}</span>
      <span>Successors</span><span>${r.successors}</span>
      <span>Evils destroyed</span><span>${EVIL_IDS.filter((e) => r.evils[e].defeated).length} of 5</span>
      <span>Last hero</span><span>${esc(m.name)} · ${lpPips(m.lp, m.maxLp)}</span>
    </div>
    <button class="btn big gold" data-act="newafter">New Chronicle</button>
  </div></div>`;
}

// ---------------------------------------------------------------- modals
function modalView(): string {
  if (ui.modal?.k === 'help') return `<div class="overlay" data-act="closemodal"><div class="win modal" data-stop="1">
    <h2 class="pix">How to play</h2>
    <p><b>Goal.</b> Finish your hero's three-act Chronicle, then defeat all Five Evils in the Final Confrontation. The Evils grow stronger every Season and spread across the map, so time matters.</p>
    <p><b>The map.</b> Each move to a neighbouring region costs a Season (dungeons cost two). Towns have an inn (restores HP, never LP), a tavern (rumours start your Chronicle), a market, a magic school and a mentor who removes cards. Wilds and dungeons mean battles. A ☠ region holds an Evil's lieutenant: beating it sets that Evil back and weakens it for the finale.</p>
    <p><b>Battle.</b> Each round both heroes draw to 5 cards. Play as many as your WP (techs) and JP (spells) allow. Most cards wait in the play line and resolve in order when you press End Round; Quick cards act at once. Enemies show their intent, so you can guard, kill or pin the right one first.</p>
    <p><b>Combinations.</b> Techs carry symbols, for example ○→◇. If the next card in the play line opens with the symbol the previous one closed with, and both heroes are involved, they chain: 2 cards x1.3, 3 ignore armour, 4 stun, 5 x2.5.</p>
    <p><b>Sparking.</b> Using a weapon card against an enemy can spark a new technique on the spot. Stronger enemies, low HP and boss fights raise the odds; every miss makes the next try likelier. <b>Desperate Spark</b> burns 1 LP to guarantee one.</p>
    <p><b>LP.</b> Life Points are your run's real health. Falling in battle costs 1 LP; some foes drain it. At 0 LP your hero dies and a successor takes up the Chronicle, weaker. Camp restores 1 LP.</p>
    <button class="btn gold" data-act="closemodal">Close</button></div></div>`;
  if (ui.modal?.k === 'deck' && run) {
    const h = run.party.find((p) => p.uid === (ui.modal as { hero: string }).hero)!;
    const inTown = run.phase === 'town' && townOpen(run) && ui.townTab === 'mentor';
    const counts = new Map<string, number>();
    for (const id of h.deck) counts.set(id, (counts.get(id) ?? 0) + 1);
    const cards = [...counts.entries()].map(([id, n]) => `<div style="position:relative">${cardHtml(card(id), { run: run!, attrs: inTown ? `data-act="forget" data-hero="${h.uid}" data-id="${id}"` : '' })}${n > 1 ? `<span class="win" style="position:absolute;top:-6px;right:-6px;padding:0 5px">x${n}</span>` : ''}</div>`).join('');
    return `<div class="overlay" data-act="closemodal"><div class="win modal" data-stop="1">
      <h2 class="pix">${esc(h.name)}'s deck (${h.deck.length})</h2>
      ${inTown ? `<p class="gold-t">Click a card to have the mentor remove it (${forgetCost(run)} Crowns).</p>` : ''}
      <div class="deckgrid">${cards}</div>
      <button class="btn gold" data-act="closemodal" style="margin-top:10px">Close</button></div></div>`;
  }
  if (!run || ui.screen !== 'game') return '';
  if (run.phase === 'town') return townModal(run);
  if (run.phase === 'event' && run.event) {
    const e = run.event;
    return `<div class="overlay"><div class="win modal"><h2 class="pix">${esc(e.title)}</h2><p style="font-size:21px">${esc(e.text)}</p>
      <div class="choices">${e.choices.map((c) => `<button class="btn ${c.id === 'fight' ? 'red' : ''}" data-act="choice" data-id="${c.id}" ${c.disabled ? 'disabled' : ''}>${esc(c.label)}</button>`).join('')}</div></div></div>`;
  }
  if (run.phase === 'reward' && run.reward) {
    const rw = run.reward;
    const living = run.party.filter((p) => !p.dead);
    const cards = rw.cards.map((c, i) => {
      if (!(i in ui.assign)) ui.assign[i] = living[0]?.uid ?? null;
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px">${cardHtml(card(c), { run: run! })}
        <div style="display:flex;gap:3px;flex-wrap:wrap;justify-content:center">${living.map((p) => `<button class="btn small ${ui.assign[i] === p.uid ? 'gold' : ''}" data-act="assign" data-i="${i}" data-hero="${p.uid}">${esc(p.name.split(' ')[0])}</button>`).join('')}<button class="btn small ${ui.assign[i] === null ? 'gold' : ''}" data-act="assign" data-i="${i}" data-hero="">Leave</button></div></div>`;
    }).join('');
    return `<div class="overlay"><div class="win modal"><h2 class="pix">Spoils</h2>
      ${rw.crowns ? `<p class="gold-t">+${rw.crowns} Crowns</p>` : ''}
      ${rw.text.map((t) => `<p>${esc(t)}</p>`).join('')}
      ${cards ? `<p>Found cards. Choose who adds each to their deck:</p><div style="display:flex;gap:12px;flex-wrap:wrap">${cards}</div>` : ''}
      <button class="btn big gold" data-act="takereward" style="margin-top:12px">Continue</button></div></div>`;
  }
  return '';
}

function townModal(r: RunState): string {
  const rg = region(r.location);
  const cl = claimedBy(r, r.location);
  if (cl) return `<div class="overlay"><div class="win modal"><h2 class="pix">${esc(rg.name)}</h2>
    <p>${esc(EVIL_NAME[cl])} holds this town. The inn and shops are shut, and frightened faces watch from the windows. The tavern still whispers.</p>
    ${ui.townMsg ? `<div class="win" style="margin-bottom:8px">${esc(ui.townMsg)}</div>` : ''}
    <button class="btn" data-act="tavern">Listen in the tavern</button>
    <button class="btn gold" data-act="leavetown">Leave</button></div></div>`;
  const living = r.party.filter((p) => !p.dead);
  const stock = shopStock(r);
  const tabs = ['inn', 'tavern', 'market', 'school', 'mentor', ...(recruitOptions(r).length ? ['recruit'] : [])];
  const tabNames: Record<string, string> = { inn: 'Inn', tavern: 'Tavern', market: 'Market', school: `${TERRITORIES[rg.territory].school[0].toUpperCase()}${TERRITORIES[rg.territory].school.slice(1)} School`, mentor: 'Mentor', recruit: 'Recruit' };
  let body = '';
  const buyFor = (act: string, id: string, price: number, filter: (uid: string) => boolean = () => true) =>
    living.filter((p) => filter(p.uid)).map((p) => `<button class="btn small" data-act="${act}" data-id="${id}" data-hero="${p.uid}" ${r.crowns < price ? 'disabled' : ''}>${esc(p.name.split(' ')[0])}</button>`).join('');
  switch (ui.townTab) {
    case 'inn':
      body = `<p>A warm bed restores everyone's HP. Life Points cannot be restored here.</p>
        <div class="mats">${living.map((p) => `<div>${esc(p.name)}: ${hpBar(p.hp, p.maxHp)} HP ${p.hp}/${p.maxHp} · ${lpPips(p.lp, p.maxLp)}</div>`).join('')}</div>
        <button class="btn gold" data-act="inn" ${r.crowns < innCost(r) ? 'disabled' : ''}>Rest (${innCost(r)} Crowns)</button>`;
      break;
    case 'tavern':
      body = `<p>Listen to the talk of travellers. Rumours start Chronicles.</p><button class="btn gold" data-act="tavern">Listen</button>`;
      break;
    case 'market':
      body = `<h3 class="pix">Items (go into a deck; used up when played)</h3><div class="shop">${stock.items.map((id) => { const c = card(id); return `<div class="item">${cardHtml(c, { run: r })}<div>${c.price} Crowns<br>Add to: ${buyFor('buycard', id, c.price ?? 0)}</div></div>`; }).join('')}</div>
        <h3 class="pix" style="margin-top:10px">Equipment</h3><div class="shop">${stock.equipment.map((id) => { const e = EQUIPMENT[id]; return `<div class="item" style="flex-direction:column;align-items:flex-start"><b class="pix">${esc(e.name)}</b><span class="dim">${e.slot === 'weapon' ? `${e.weapon} · ATK ${e.atk} · WP ${e.wp}` : `armour · DEF ${e.def}${e.wp ? ` · WP ${e.wp}` : ''}`}</span><span>${e.price} Crowns · equip on: ${buyFor('buyequip', id, e.price, (uid) => e.slot === 'armor' || r.party.find((p) => p.uid === uid)!.weapon === e.weapon) || '<span class="dim">nobody can use it</span>'}</span></div>`; }).join('')}</div>`;
      break;
    case 'school':
      body = `<p>Spells cost JP. Celestial and Abyssal magic exclude each other.</p><div class="shop">${stock.spells.map((id) => { const c = card(id); return `<div class="item">${cardHtml(c, { run: r })}<div>${c.price} Crowns<br>Learn: ${buyFor('buycard', id, c.price ?? 0)}</div></div>`; }).join('')}</div>`;
      break;
    case 'mentor':
      body = `<p>The mentor helps you forget a card, thinning your deck (${forgetCost(r)} Crowns). Open a deck and click a card.</p>${living.map((p) => `<button class="btn" data-act="deck" data-hero="${p.uid}">${esc(p.name)}'s deck</button>`).join(' ')}`;
      break;
    case 'recruit':
      body = `<p>Your companion has fallen. Hire a new one for 60 Crowns.</p><div class="shop">${recruitOptions(r).map((id) => { const h = hero(id); return `<div class="item">${portrait({ ...h, defId: id, generation: 0, isCompanion: true } as never)}<div><b class="pix">${esc(h.name)}</b><br><span class="dim">${h.weapon}</span><br><button class="btn small" data-act="recruit" data-id="${id}" ${r.crowns < 60 ? 'disabled' : ''}>Hire</button></div></div>`; }).join('')}</div>`;
      break;
  }
  return `<div class="overlay"><div class="win modal" style="background-image:linear-gradient(180deg,#3050c8ee,#101a5cf4),url('${art('region', rg.id) ?? ''}');background-size:cover">
    <h2 class="pix">${esc(rg.name)} <span class="dim" style="font-size:16px">${esc(TERRITORIES[rg.territory].name)} · ◉ ${r.crowns} Crowns</span></h2>
    <div class="tabs">${tabs.map((t) => `<button class="btn ${ui.townTab === t ? 'on' : ''}" data-act="towntab" data-id="${t}">${tabNames[t]}</button>`).join('')}</div>
    ${ui.townMsg ? `<div class="win" style="margin-bottom:8px">${esc(ui.townMsg)}</div>` : ''}
    ${body}
    <div style="margin-top:12px"><button class="btn gold" data-act="leavetown">Leave town</button></div></div></div>`;
}

// ---------------------------------------------------------------- input
function act(name: string, d: DOMStringMap) {
  const r = run;
  switch (name) {
    case 'help': ui.modal = { k: 'help' }; break;
    case 'closemodal': ui.modal = null; break;
    case 'mute': audio.toggleMute(); break;
    case 'quit': ui.screen = 'title'; break;
    case 'continue': run = load(); ui.screen = 'game'; break;
    case 'new': case 'newafter': ui.screen = 'select'; ui.pickHero = null; ui.pickComp = null; break;
    case 'back': ui.screen = 'title'; break;
    case 'pick': {
      const id = d.id!;
      if (ui.pickHero === id) ui.pickHero = null;
      else if (ui.pickComp === id) ui.pickComp = null;
      else if (!ui.pickHero) ui.pickHero = id;
      else ui.pickComp = id;
      audio.sfx('menuSelect');
      break;
    }
    case 'start':
      if (!ui.pickHero || !ui.pickComp) return;
      run = newRun(hashSeed(`${Date.now()}`), ui.pickHero, ui.pickComp, ui.seasons);
      ui.screen = 'game'; ui.townTab = 'tavern'; ui.townMsg = 'Your story begins here. Listen in the tavern, rest, or leave town to set out.';
      audio.sfx('chronicle');
      break;
    default:
      if (!r) return;
      gameAct(r, name, d);
  }
  render();
}

function gameAct(r: RunState, name: string, d: DOMStringMap) {
  switch (name) {
    case 'travel': if (r.phase === 'town') leaveTown(r); ui.townTab = 'inn'; ui.townMsg = ''; travel(r, d.id!); audio.sfx('travel'); if (r.phase === 'battle') audio.sfx('evilAdvance', { volume: 0.4 }); break;
    case 'entertown': r.phase = 'town'; break;
    case 'camp': camp(r); audio.sfx('heal'); break;
    case 'final': startFinal(r); audio.sfx('evilAdvance'); break;
    case 'formation': break;
    case 'deck': ui.modal = { k: 'deck', hero: d.hero! }; break;
    case 'towntab': ui.townTab = d.id!; ui.townMsg = ''; audio.sfx('menuMove'); break;
    case 'leavetown': leaveTown(r); ui.townMsg = ''; break;
    case 'inn': if (inn(r)) { ui.townMsg = 'You rest. HP restored.'; audio.sfx('heal'); } break;
    case 'tavern': ui.townMsg = tavern(r); audio.sfx(r.chronicle.act ? 'chronicle' : 'menuSelect'); break;
    case 'buycard': { const e = buyCard(r, d.id!, d.hero!); ui.townMsg = e ?? `${card(d.id!).name} added.`; audio.sfx(e ? 'error' : 'coins'); break; }
    case 'buyequip': { const e = buyEquipment(r, d.id!, d.hero!); ui.townMsg = e ?? `${EQUIPMENT[d.id!].name} equipped.`; audio.sfx(e ? 'error' : 'equip'); break; }
    case 'forget': { const e = forgetCard(r, d.hero!, d.id!); ui.townMsg = e ?? `${card(d.id!).name} forgotten.`; toast(ui.townMsg); audio.sfx(e ? 'error' : 'coins'); break; }
    case 'recruit': { const e = recruit(r, d.id!); ui.townMsg = e ?? `${hero(d.id!).name} joins you.`; audio.sfx(e ? 'error' : 'chronicle'); break; }
    case 'choice': chooseEvent(r, d.id!); audio.sfx('menuSelect'); break;
    case 'assign': ui.assign[Number(d.i)] = d.hero || null; break;
    case 'takereward': takeReward(r, ui.assign); ui.assign = {}; if (r.phase === 'town') { ui.townTab = 'inn'; } break;
    case 'finishbattle': finishBattle(r); ui.sel = null; break;
    case 'fightevil': fightEvil(r, d.id as EvilId); break;
    case 'finalcamp': finalCamp(r); audio.sfx('heal'); break;
    // battle
    case 'card': battleCard(r, d.hero!, Number(d.key)); break;
    case 'target': {
      if (!ui.sel || !r.battle) break;
      const t = /^\d+$/.test(d.target!) ? Number(d.target) : d.target!;
      playCard(r, r.battle, ui.sel.hero, ui.sel.key, t);
      ui.sel = null;
      break;
    }
    case 'unqueue': if (r.battle) { unqueue(r, r.battle, Number(d.key)); audio.sfx('cardDraw'); } break;
    case 'end': if (r.battle && !r.battle.over) { ui.sel = null; endRound(r, r.battle); audio.sfx('menuSelect'); } break;
    case 'desperate': if (r.battle) { if (armDesperate(r, r.battle, d.hero!)) audio.sfx('lpLoss', { volume: 0.5 }); else toast('Desperate Spark needs more than 1 LP, and works once per battle.'); } break;
    case 'revive': if (r.battle && !reviveWithWp(r, r.battle, d.hero!, d.target!)) toast('The revive fails.'); break;
  }
}

function battleCard(r: RunState, uid: string, key: number) {
  const b = r.battle;
  if (!b || b.over) return;
  if (ui.sel && ui.sel.hero === uid && ui.sel.key === key) { ui.sel = null; return; }
  const ok = canPlay(r, b, uid, key);
  if (!ok.ok) { toast(ok.reason!); audio.sfx('error'); ui.sel = null; return; }
  const hc = bhero(b, uid).hand.find((x) => x.key === key)!;
  const c = card(hc.id);
  const targets = validTargets(r, b, uid, c.id);
  if (targets.length > 1) { ui.sel = { hero: uid, key }; audio.sfx('cardHover'); return; }
  playCard(r, b, uid, key, targets[0] ?? null);
  ui.sel = null;
}

document.addEventListener('click', (ev) => {
  audio.unlock();
  const t = ev.target as HTMLElement;
  const el = t.closest<HTMLElement>('[data-act]');
  if (!el) return;
  if (el.dataset.act === 'closemodal' && t.closest('[data-stop]') && !t.closest('button')) return;
  if (el.tagName === 'SELECT') return;
  act(el.dataset.act!, el.dataset);
});
document.addEventListener('change', (ev) => {
  const el = ev.target as HTMLSelectElement;
  if (el.dataset.act === 'formation' && run) { setFormation(run, el.value); render(); }
  if (el.dataset.act === 'seasons') { ui.seasons = Number(el.value); }
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') { ui.sel = null; ui.modal = null; render(); }
  if ((ev.key === ' ' || ev.key === 'Enter') && run?.phase === 'battle' && run.battle && !run.battle.over && ui.screen === 'game') { ev.preventDefault(); act('end', {}); }
});

void LIEUTENANT_OF;
loadArt().then(render);
