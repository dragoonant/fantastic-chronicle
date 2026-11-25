import { audio } from '../audio';
import { card } from '../engine/content/cards';
import type { BattleEvent, RunState } from '../engine/types';
import { cardHtml, esc } from './cards';

function el(target: number | string): HTMLElement | null {
  return document.getElementById(typeof target === 'number' ? `enemy-${target}` : `hero-${target}`);
}

export function floatText(target: number | string, text: string, cls: string) {
  const e = el(target);
  if (!e) return;
  const r = e.getBoundingClientRect();
  const f = document.createElement('div');
  f.className = `float ${cls}`;
  f.textContent = text;
  f.style.left = `${r.left + r.width / 2 + (Math.random() * 30 - 15)}px`;
  f.style.top = `${r.top + r.height * 0.3}px`;
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1000);
}

function pulse(target: number | string, cls: string) {
  const e = el(target);
  if (!e) return;
  e.classList.remove(cls);
  void e.offsetWidth;
  e.classList.add(cls);
}

let sparkQueue: { hero: string; cardId: string }[] = [];
let sparkOpen = false;

function showSpark(run: RunState) {
  if (sparkOpen || !sparkQueue.length) return;
  const s = sparkQueue.shift()!;
  sparkOpen = true;
  const name = run.party.find((p) => p.uid === s.hero)?.name ?? '';
  const d = document.createElement('div');
  d.className = 'spark-banner';
  d.innerHTML = `<div class="inner"><div class="bang">!</div><div class="who">${esc(name)} sparks a new technique!</div>${cardHtml(card(s.cardId), { run })}<div class="dim">click to continue</div></div>`;
  const close = () => { d.remove(); sparkOpen = false; showSpark(run); };
  d.addEventListener('click', close);
  setTimeout(() => { if (d.isConnected) close(); }, 3200);
  document.body.appendChild(d);
  audio.jingle('spark');
}

/** Plays sound and visual effects for battle events, staggered so a round reads as a sequence. */
export function playEvents(run: RunState, events: BattleEvent[]) {
  let t = 0;
  const at = (fn: () => void, step = 110) => { setTimeout(fn, t); t += step; };
  for (const ev of events) {
    switch (ev.k) {
      case 'play': at(() => audio.sfx('cardPlay'), 40); break;
      case 'dmg':
        at(() => {
          if (ev.blocked && ev.n === 0) { floatText(ev.to, 'Guard', 'miss'); audio.sfx('guard'); return; }
          floatText(ev.to, String(ev.n), typeof ev.to === 'string' ? 'hdmg' : ev.heavy ? 'big' : 'dmg');
          pulse(ev.to, 'shake');
          audio.sfx(ev.heavy ? 'heavyHit' : 'hit', { pitch: Math.random() * 4 - 2 });
          if (ev.heavy && typeof ev.to === 'number') { document.getElementById('app')?.classList.remove('screen-shake'); void document.body.offsetWidth; document.getElementById('app')?.classList.add('screen-shake'); }
        });
        break;
      case 'heal': at(() => { if (ev.n > 0) { floatText(ev.to, `+${ev.n}`, 'heal'); audio.sfx('heal'); } }); break;
      case 'guard': at(() => { floatText(ev.to, `⛨${ev.n}`, 'miss'); audio.sfx('guard'); }, 60); break;
      case 'miss': at(() => { floatText(ev.to, 'Miss', 'miss'); audio.sfx('error', { volume: 0.4 }); }); break;
      case 'status': at(() => { floatText(ev.to, ev.s === 'lpShield' ? 'Sanctuary' : ev.s, 'miss'); audio.sfx(ev.s === 'burn' ? 'burn' : ev.s === 'chill' ? 'chill' : 'spell', { volume: 0.6 }); }, 60); break;
      case 'lp': at(() => { floatText(ev.hero, `${ev.n > 0 ? '+' : ''}${ev.n} LP`, 'lp'); audio.sfx('lpLoss'); }, 300); break;
      case 'downed': at(() => { pulse(ev.hero, 'flash'); audio.sfx('heroDowned'); }, 250); break;
      case 'revive': at(() => audio.sfx('revive'), 200); break;
      case 'defeat': at(() => { pulse(ev.enemy, 'flash'); audio.sfx('enemyDefeat'); }, 160); break;
      case 'summon': at(() => audio.sfx('spell'), 100); break;
      case 'phase': at(() => { pulse(ev.enemy, 'flash'); audio.sfx('evilAdvance'); }, 500); break;
      case 'enemyMove': at(() => pulse(ev.enemy, 'flash'), 160); break;
      case 'combo':
        at(() => {
          const b = document.createElement('div');
          b.className = 'combo-banner';
          b.textContent = `${ev.n}-Card Combination! x${ev.mult}`;
          document.body.appendChild(b);
          setTimeout(() => b.remove(), 1300);
          audio.sfx('combo', { pitch: ev.n * 2 });
        }, 500);
        break;
      case 'spark':
        at(() => { sparkQueue.push({ hero: ev.hero, cardId: ev.card }); showSpark(run); }, 400);
        break;
      default: break;
    }
  }
}

export function toast(msg: string) {
  const d = document.createElement('div');
  d.className = 'win toast';
  d.textContent = msg;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 2200);
}
