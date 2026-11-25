import { describe, stats } from '../engine/battle';
import { card, EQUIPMENT } from '../engine/content/cards';
import { monster, EVIL_NAME } from '../engine/content/monsters';
import { TERRITORIES } from '../engine/content/map';
import type { BattleHero, CardDef, EnemyState, HeroState, RunState, Sym } from '../engine/types';
import { art, bg, GLYPH } from './art';

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
export const SYM: Record<Sym, string> = { o: '○', d: '◇', D: '◆', O: '●' };

function glyphFor(c: CardDef) {
  if (c.id === 'guard') return GLYPH.guard;
  if (c.id === 'move') return GLYPH.move;
  if (c.weapon) return GLYPH[c.weapon];
  if (c.school) return GLYPH[c.school];
  return GLYPH[c.kind] ?? '✦';
}

export function cardHtml(c: CardDef, opts: { run?: RunState; attrs?: string; cls?: string; cost?: boolean } = {}): string {
  const costCls = c.cost === 0 ? 'free' : c.kind === 'spell' ? 'jp' : 'wp';
  const kindLabel = c.kind === 'basic' ? 'Basic' : c.kind === 'tech' ? `Tech T${c.tier}` : c.kind === 'spell' ? `${cap(c.school!)} T${c.tier}` : cap(c.kind);
  const syms = c.open && c.close ? `<span class="sym">${SYM[c.open]}→${SYM[c.close]}</span>` : '';
  const codex = [...(opts.run?.codex ?? []), ...(opts.run?.party.flatMap((p) => p.deck) ?? [])];
  const sparks = c.sparks?.length ? `<div class="c-spark">✦ ${c.sparks.map((s) => (codex.includes(s) ? card(s).name : '???')).join(', ')}</div>` : '';
  const typeKey = c.id === 'guard' || c.id === 'move' ? c.id : c.weapon ?? c.school ?? (c.kind === 'item' || c.kind === 'story' || c.kind === 'destiny' ? c.kind : 'guard');
  const a = art('card', c.id) ?? art('cardtype', typeKey);
  return `<div class="card kind-${c.kind} ${opts.cls ?? ''}" ${opts.attrs ?? ''} title="${esc(c.name)}">
    <div class="c-head"><span class="c-name">${esc(c.name)}</span><span class="c-cost ${costCls}">${c.cost}</span></div>
    <div class="c-art" style="${a ? `background-image:url('${a}')` : ''}">${a ? '' : `<span class="glyph">${glyphFor(c)}</span>`}</div>
    <div class="c-type"><span>${kindLabel}${c.quick ? ' <span class="quick">Quick</span>' : ''}</span>${syms}</div>
    <div class="c-text">${describe(c).map(esc).join(' ')}</div>
    ${sparks}
  </div>`;
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function hpBar(hp: number, max: number) {
  const pct = Math.max(0, Math.min(100, (100 * hp) / max));
  const cls = pct < 25 ? 'hp-crit' : pct < 50 ? 'hp-low' : '';
  return `<div class="bar ${cls}"><i style="width:${pct}%"></i></div>`;
}

export function lpPips(lp: number, max: number) {
  const n = Math.max(max, lp);
  let s = '';
  for (let i = 0; i < n; i++) s += i < lp ? '♥' : '<span class="lost">♥</span>';
  return `<span class="lp" title="Life Points ${lp}/${max}">${s}</span>`;
}

export function statusHtml(st: Partial<Record<string, number>>) {
  const ks = Object.keys(st).filter((k) => (st[k] ?? 0) > 0);
  if (!ks.length) return '';
  return `<span class="statuses">${ks.map((k) => `<span class="st st-${k}">${k === 'lpShield' ? 'Sanctuary' : `${cap(k)} ${st[k]}`}</span>`).join('')}</span>`;
}

export function portrait(h: HeroState, size = '') {
  const a = art('hero', h.defId) ;
  const own = h.generation === 0 || h.isCompanion;
  return `<div class="portrait ${size}" style="${a && own ? `background-image:url('${a}')` : ''}">${a && own ? '' : GLYPH[h.weapon]}</div>`;
}

export function mapMat(run: RunState, h: HeroState): string {
  const st = stats(h);
  const w = EQUIPMENT[h.weaponItem];
  const ar = h.armorItem ? EQUIPMENT[h.armorItem] : null;
  return `<div class="win mat">
    ${portrait(h)}
    <div>
      <div class="pix" style="display:flex;justify-content:space-between"><span>${esc(h.name)}</span><span class="dim">${h.isCompanion ? 'Companion' : h.generation ? `Successor ${h.generation}` : 'Hero'}</span></div>
      ${h.dead ? '<div class="red-t">Dead</div>' : `${hpBar(h.hp, h.maxHp)}<div style="display:flex;justify-content:space-between"><span>HP ${h.hp}/${h.maxHp}</span>${lpPips(h.lp, h.maxLp)}</div>`}
      <div class="dim" style="font-size:15px">${esc(w.name)} (ATK ${st.atk}, WP ${st.wp})${ar ? ` · ${esc(ar.name)} (DEF ${ar.def})` : ''}${h.school ? ` · ${cap(h.school)}` : ''}</div>
      <div style="display:flex;gap:6px;margin-top:3px"><button class="btn small" data-act="deck" data-hero="${h.uid}">Deck (${h.deck.length})</button>${h.canSpark ? '' : '<span class="dim" style="font-size:14px">cannot spark</span>'}</div>
    </div>
  </div>`;
}

export function battleMat(run: RunState, bh: BattleHero, h: HeroState, opts: { targetable?: boolean; reviveFrom?: string | null } = {}): string {
  return `<div class="win hmat ${opts.targetable ? 'targetable-hero' : ''}" id="hero-${h.uid}" ${opts.targetable ? `data-act="target" data-target="${h.uid}"` : ''}>
    <div style="display:flex;gap:6px">
      ${portrait(h)}
      <div style="flex:1;min-width:0">
        <div class="nm"><span>${esc(h.name)}</span><span class="row-tag">${bh.row}</span></div>
        ${hpBar(h.hp, h.maxHp)}
        <div style="display:flex;justify-content:space-between;font-size:16px"><span>${h.hp}/${h.maxHp}</span>${lpPips(h.lp, h.maxLp)}</div>
        <div class="gems"><span class="gem-wp" title="Weapon Points: pay for techs (+3 a round, max 8)">WP ${bh.wp}</span><span class="gem-jp" title="Jutsu Points: pay for spells (+2 a round, max 6)">JP ${bh.jp}</span>${bh.guard ? `<span class="gem-g">⛨${bh.guard}</span>` : ''}${bh.counter ? `<span class="gem-g">↺${bh.counter}</span>` : ''}</div>
      </div>
    </div>
    <div style="margin-top:3px">${statusHtml(bh.statuses)}${bh.downed ? ' <span class="red-t pix">DOWN</span>' : ''}</div>
    <div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap">
      ${h.canSpark && !bh.desperateUsed && !bh.downed ? `<button class="btn small ${bh.desperateArmed ? 'gold' : 'red'}" data-act="desperate" data-hero="${h.uid}" title="Burn 1 LP: the next tech you play is guaranteed to spark its best new technique. Once per battle.">${bh.desperateArmed ? 'Desperate: armed' : 'Desperate Spark'}</button>` : ''}
      ${opts.reviveFrom ? `<button class="btn small gold" data-act="revive" data-hero="${opts.reviveFrom}" data-target="${h.uid}" title="Spend 2 WP to raise a fallen ally at 25% HP">Revive (2 WP)</button>` : ''}
    </div>
  </div>`;
}

export function enemyHtml(e: EnemyState, opts: { targetable?: boolean } = {}): string {
  const m = monster(e.defId);
  const a = art('monster', e.defId);
  const color = m.domain ? Object.values(TERRITORIES).find((t) => t.evil === m.domain)?.color ?? '#555' : '#777';
  const phases = e.phases > 1 ? `<span class="phase-pips">${'◆'.repeat(e.phases - e.phase + 1)}${'◇'.repeat(e.phase - 1)}</span>` : '';
  return `<div class="ecard size-${e.size} ${e.hp <= 0 ? 'dead' : ''} ${e.row === 'back' ? 'back' : ''} ${e.submerged ? 'submerged' : ''} ${opts.targetable ? 'targetable' : ''}" id="enemy-${e.uid}" ${opts.targetable ? `data-act="target" data-target="${e.uid}"` : ''} title="${esc(m.text)}">
    <div class="e-art" style="${a ? `background-image:url('${a}');background-size:contain` : `background:linear-gradient(180deg, ${color}, #000)`}">${a ? '' : esc(m.name[0])}</div>
    <div class="e-name"><span>${esc(e.name)}</span>${phases}</div>
    ${hpBar(e.hp, e.maxHp)}
    <div style="display:flex;justify-content:space-between;font-size:14px"><span>${Math.max(0, e.hp)}/${e.maxHp}</span><span class="armor">${e.armor ? `⛊${e.armor}` : ''}${e.guard ? ` ⛨${e.guard}` : ''}${e.row === 'back' ? ' back' : ''}</span></div>
    ${statusHtml(e.statuses)}
    ${e.hp > 0 ? `<div class="intent ${e.intent ? '' : 'none'}">${e.intent ? esc(e.intent.text) : e.statuses.stun ? 'Stunned' : e.statuses.sleep ? 'Asleep' : 'No action'}</div>` : ''}
  </div>`;
}

export function evilHtml(run: RunState, id: keyof RunState['evils'], tier: number, tierName: string, attrs = ''): string {
  const ev = run.evils[id];
  return `<div class="evil t${tier} ${ev.defeated ? 'dead' : ''}" style="${bg('monster', `evil-${id}`)};background-size:cover;background-position:center 30%" ${attrs} title="${esc(EVIL_NAME[id])}: ${tierName}. Claims ${ev.claimed.length} regions. Lieutenant ${ev.lieutenantDefeated ? 'defeated' : 'stands'}.">
    <div class="t">${esc(EVIL_NAME[id].replace('The ', ''))}</div>
    <div class="tier">${tierName}</div>
    <div class="dim">⚑${ev.claimed.length} ${ev.lieutenantDefeated ? '✝' : ''}${ev.lockedTier ? ' 🔒' : ''}</div>
  </div>`;
}

export function monsterName(id: string) { return monster(id).name; }
