// Look-ahead scheduler: a timer wakes every ~25 ms and schedules every note that
// falls inside the next window against AudioContext time, looping sections seamlessly.

import type { DrumEv, NoteEv, Part, Song } from './composer';
import { playDrum, playNote } from './instruments';

const partKey = (p: Part): string => `${p.name}|${p.inst}`;

type Ev = { t: number; part: number; n: NoteEv } | { t: number; part: -1; d: DrumEv };

interface SectionPlan { beats: number; events: Ev[] }

export class SongPlayer {
  readonly out: GainNode;
  private readonly echoSend: GainNode;
  private readonly partNodes: AudioNode[] = [];
  private readonly partInst: Part['inst'][] = [];
  private readonly drumNode: GainNode;
  private readonly plans: SectionPlan[];
  private readonly spb: number;
  private sectionIdx = 0;
  private sectionStart: number;
  private evIdx = 0;
  private stopped = false;
  finished = false;

  constructor(
    private readonly ctx: AudioContext,
    readonly song: Song,
    dest: AudioNode,
    echoIn: AudioNode,
    startAt: number,
    fadeIn: number,
  ) {
    this.spb = 60 / song.bpm;
    this.sectionStart = startAt;
    this.out = ctx.createGain();
    this.echoSend = ctx.createGain();
    const g0 = fadeIn > 0.02 ? 0 : 1;
    for (const g of [this.out.gain, this.echoSend.gain]) {
      g.setValueAtTime(g0, ctx.currentTime);
      if (g0 === 0) g.linearRampToValueAtTime(1, startAt + fadeIn);
    }
    this.out.connect(dest);
    this.echoSend.connect(echoIn);

    // One chain per distinct part (name + instrument), shared by every section.
    const proto = new Map<string, Part>();
    for (const sec of song.sections) for (const p of sec.parts) if (!proto.has(partKey(p))) proto.set(partKey(p), p);
    const nodeOf = new Map<string, number>();
    proto.forEach((p, key) => {
      const gain = ctx.createGain();
      gain.gain.value = 1;
      const pan = ctx.createStereoPanner();
      pan.pan.value = p.pan;
      gain.connect(pan);
      pan.connect(this.out);
      if (p.echo > 0) {
        const send = ctx.createGain();
        send.gain.value = p.echo;
        pan.connect(send);
        send.connect(this.echoSend);
      }
      nodeOf.set(key, this.partNodes.length);
      this.partNodes.push(gain);
      this.partInst.push(p.inst);
    });
    this.drumNode = ctx.createGain();
    this.drumNode.gain.value = 0.9;
    this.drumNode.connect(this.out);

    this.plans = song.sections.map((sec) => {
      const events: Ev[] = [];
      for (const p of sec.parts) {
        const idx = nodeOf.get(partKey(p))!;
        // Fold the per-part mix level into note velocity.
        for (const n of p.notes) events.push({ t: n.t, part: idx, n: { ...n, v: n.v * p.gain } });
      }
      for (const d of sec.drums) events.push({ t: d.t, part: -1, d });
      events.sort((a, b) => a.t - b.t);
      return { beats: sec.beats, events };
    });
  }

  get active(): boolean {
    return !this.stopped && !this.finished;
  }

  /** Schedule everything up to `until` (AudioContext seconds). */
  tick(until: number): void {
    if (!this.active) return;
    const now = this.ctx.currentTime;
    let guard = 0;
    while (guard++ < 4000) {
      const plan = this.plans[this.sectionIdx];
      if (!plan) {
        this.finished = true;
        return;
      }
      const ev = plan.events[this.evIdx];
      if (ev) {
        const when = this.sectionStart + ev.t * this.spb;
        if (when >= until) return;
        this.evIdx++;
        if (when < now - 0.03) continue; // fell behind (throttled tab): drop, don't burst
        this.play(ev, Math.max(when, now));
        continue;
      }
      const sectionEnd = this.sectionStart + plan.beats * this.spb;
      if (sectionEnd >= until) return;
      // Advance to the next section (or loop).
      this.sectionStart = sectionEnd;
      this.evIdx = 0;
      if (this.sectionIdx + 1 < this.plans.length) this.sectionIdx++;
      else if (this.song.loopFrom !== null) this.sectionIdx = this.song.loopFrom;
      else {
        this.finished = true;
        return;
      }
      // If we are hopelessly behind (tab was asleep), re-anchor the loop at now.
      if (this.sectionStart + 0.5 < now) this.sectionStart = now + 0.05;
    }
  }

  private play(ev: Ev, when: number): void {
    try {
      if ('d' in ev) playDrum(this.ctx, this.drumNode, ev.d.k, when, ev.d.v, ev.d.m);
      else playNote(this.ctx, this.partNodes[ev.part]!, this.partInst[ev.part]!, when, ev.n.m, ev.n.d * this.spb, ev.n.v);
    } catch {
      /* never let a single note kill the scheduler */
    }
  }

  /** Fade out and stop scheduling; nodes are released after the tail. */
  fadeOut(seconds: number): void {
    if (this.stopped) return;
    this.stopped = true;
    const now = this.ctx.currentTime;
    const fade = Math.max(0.02, seconds);
    for (const g of [this.out.gain, this.echoSend.gain]) {
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(0, now + fade);
    }
    setTimeout(() => {
      try {
        this.out.disconnect();
        this.echoSend.disconnect();
      } catch {
        /* ignore */
      }
    }, (fade + 2.5) * 1000);
  }
}
