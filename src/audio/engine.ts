// The audio engine behind the `audio` singleton. Every public method is a safe no-op
// before unlock() or without WebAudio (headless tests), and never throws.

import { composeSong, type Song } from './composer';
import { makeEcho, playDrum, playNote, type EchoBus } from './instruments';
import { makeJingle } from './jingles';
import { SongPlayer } from './sequencer';
import { SFX } from './sfx';
import type { Audio, JingleName, SfxName, TrackName, VolumeKind } from './types';

const STORE_KEY = 'fantastic-chronicle.audio';
const LOOKAHEAD = 0.25;
const LOOKAHEAD_HIDDEN = 1.6; // background tabs throttle timers to ~1 s
const TICK_MS = 25;

interface Graph {
  masterGain: GainNode;
  musicVol: GainNode;
  sfxVol: GainNode;
  duck: GainNode;
  jingleBus: GainNode;
  sfxIn: GainNode;
  musicEcho: EchoBus;
  jingleEcho: EchoBus;
  sfxEcho: EchoBus;
}

type AudioCtor = new (opts?: AudioContextOptions) => AudioContext;

function audioCtor(): AudioCtor | null {
  try {
    const w = globalThis as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
    return w.AudioContext ?? w.webkitAudioContext ?? null;
  } catch {
    return null;
  }
}

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
/** Slider value -> gain (squared for a more even perceived loudness curve). */
const curve = (v: number): number => v * v;

function isHidden(): boolean {
  try {
    return typeof document !== 'undefined' && document.hidden === true;
  } catch {
    return false;
  }
}

export class AudioEngine implements Audio {
  private ctx: AudioContext | null = null;
  private g: Graph | null = null;
  private vol: Record<VolumeKind, number> = { master: 0.8, music: 0.7, sfx: 0.85 };
  private muted = false;
  private currentKey: string | null = null;
  private player: SongPlayer | null = null;
  private fading: SongPlayer[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private songs = new Map<string, Song>();
  private lastSfx = new Map<SfxName, number>();
  private comboLevel = 0;
  private comboAt = -10;
  private duckUntil = 0;

  constructor() {
    this.load();
  }

  // -------------------------------------------------------------------------
  // Lifecycle

  async unlock(): Promise<void> {
    try {
      if (!this.ctx) {
        const Ctor = audioCtor();
        if (!Ctor) return;
        this.ctx = new Ctor({ latencyHint: 'interactive' });
        this.g = this.buildGraph(this.ctx);
        this.applyVolumes(true);
        this.timer = setInterval(() => this.tick(), TICK_MS);
      }
      if (this.ctx.state !== 'running' && this.ctx.state !== 'closed') {
        // resume() can stay pending outside a gesture; never let the caller hang on it.
        await Promise.race([
          this.ctx.resume().catch(() => undefined),
          new Promise<void>((r) => setTimeout(r, 400)),
        ]);
      }
      if (this.currentKey && !this.player) this.startCurrent(0);
    } catch {
      /* audio is optional */
    }
  }

  private buildGraph(ctx: AudioContext): Graph {
    const masterGain = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 10;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(15000, ctx.sampleRate / 2 - 500);
    lp.Q.value = 0.5;
    const pre = ctx.createGain();
    pre.gain.value = 0.85;
    pre.connect(lp);
    lp.connect(comp);
    comp.connect(masterGain);
    masterGain.connect(ctx.destination);

    const musicVol = ctx.createGain();
    const sfxVol = ctx.createGain();
    musicVol.connect(pre);
    sfxVol.connect(pre);

    const duck = ctx.createGain();
    duck.connect(musicVol);
    const musicEcho = makeEcho(ctx, 0.24, 0.42, 0.38);
    musicEcho.output.connect(duck);

    const jingleBus = ctx.createGain();
    jingleBus.gain.value = 0.95;
    jingleBus.connect(musicVol);
    const jingleEcho = makeEcho(ctx, 0.22, 0.35, 0.3);
    jingleEcho.output.connect(musicVol);

    const sfxIn = ctx.createGain();
    sfxIn.connect(sfxVol);
    const sfxEcho = makeEcho(ctx, 0.2, 0.35, 0.35, 3500);
    sfxEcho.output.connect(sfxVol);

    return { masterGain, musicVol, sfxVol, duck, jingleBus, sfxIn, musicEcho, jingleEcho, sfxEcho };
  }

  private tick(): void {
    try {
      const ctx = this.ctx;
      if (!ctx || ctx.state === 'closed') return;
      const until = ctx.currentTime + (isHidden() ? LOOKAHEAD_HIDDEN : LOOKAHEAD);
      this.player?.tick(until);
      this.fading = this.fading.filter((p) => p.active);
    } catch {
      /* keep ticking */
    }
  }

  // -------------------------------------------------------------------------
  // Music

  music(track: TrackName, opts?: { variant?: number }): void {
    try {
      const raw = opts?.variant ?? 0;
      const variant = Number.isFinite(raw) ? Math.trunc(raw) : 0;
      const key = `${track}:${variant}`;
      if (this.currentKey === key) return;
      this.currentKey = key;
      if (this.ctx && this.g) this.startCurrent(0.8);
    } catch {
      /* ignore */
    }
  }

  private song(key: string): Song {
    let s = this.songs.get(key);
    if (!s) {
      const [track, v] = key.split(':') as [TrackName, string];
      s = composeSong(track, Number(v));
      this.songs.set(key, s);
    }
    return s;
  }

  private startCurrent(fade: number): void {
    const ctx = this.ctx;
    const g = this.g;
    if (!ctx || !g || !this.currentKey) return;
    const song = this.song(this.currentKey);
    const old = this.player;
    if (old) {
      old.fadeOut(fade);
      this.fading.push(old);
    }
    this.player = new SongPlayer(ctx, song, g.duck, g.musicEcho.input, ctx.currentTime + 0.06, old ? fade : 0);
    this.player.tick(ctx.currentTime + LOOKAHEAD);
  }

  stopMusic(fadeSeconds = 0.8): void {
    try {
      this.currentKey = null;
      if (this.player) {
        this.player.fadeOut(Number.isFinite(fadeSeconds) ? Math.max(0, fadeSeconds) : 0.8);
        this.fading.push(this.player);
        this.player = null;
      }
    } catch {
      /* ignore */
    }
  }

  jingle(name: JingleName): void {
    try {
      const ctx = this.ctx;
      const g = this.g;
      if (!ctx || !g) return;
      const j = makeJingle(name);
      const spb = 60 / j.bpm;
      const t0 = ctx.currentTime + 0.03;
      const len = j.beats * spb;

      // Duck the music under the fanfare, then bring it back.
      const d = g.duck.gain;
      const now = ctx.currentTime;
      this.duckUntil = Math.max(this.duckUntil, t0 + len);
      d.cancelScheduledValues(now);
      d.setValueAtTime(d.value, now);
      d.linearRampToValueAtTime(0.18, now + 0.08);
      d.setValueAtTime(0.18, this.duckUntil);
      d.linearRampToValueAtTime(1, this.duckUntil + 0.7);

      const out = ctx.createGain();
      out.connect(g.jingleBus);
      const send = ctx.createGain();
      send.gain.value = 0.3;
      out.connect(send);
      send.connect(g.jingleEcho.input);
      for (const n of j.notes) playNote(ctx, out, n.inst, t0 + n.t * spb, n.m, n.d * spb, n.v);
      for (const dr of j.drums) playDrum(ctx, out, dr.k, t0 + dr.t * spb, dr.v, dr.m);
      setTimeout(() => {
        try {
          out.disconnect();
          send.disconnect();
        } catch {
          /* ignore */
        }
      }, (len + 3) * 1000);
    } catch {
      /* ignore */
    }
  }

  // -------------------------------------------------------------------------
  // SFX

  sfx(name: SfxName, opts?: { pitch?: number; volume?: number }): void {
    try {
      const ctx = this.ctx;
      const g = this.g;
      if (!ctx || !g || ctx.state === 'closed') return;
      const fn = SFX[name];
      if (!fn) return;
      const now = ctx.currentTime;
      const last = this.lastSfx.get(name);
      if (last !== undefined && now - last < 0.03) return; // swallow machine-gun repeats
      this.lastSfx.set(name, now);

      let level = 1;
      if (name === 'combo') {
        level = now - this.comboAt < 1.5 ? Math.min(8, this.comboLevel + 1) : 1;
        this.comboLevel = level;
        this.comboAt = now;
      }
      const pitch = Number.isFinite(opts?.pitch) ? (opts!.pitch as number) : 0;
      const volume = Number.isFinite(opts?.volume) ? Math.max(0, Math.min(2, opts!.volume as number)) : 1;
      const jitterRange = name === 'spark' || name === 'combo' || name === 'coins' ? 0.15 : 0.6;
      const p = Math.pow(2, (pitch + (Math.random() - 0.5) * jitterRange) / 12);
      fn({ ctx, out: g.sfxIn, echo: g.sfxEcho.input, t: now + 0.005, p, v: volume * (0.92 + Math.random() * 0.08), level });
    } catch {
      /* ignore */
    }
  }

  // -------------------------------------------------------------------------
  // Volume / mute

  setVolume(kind: VolumeKind, value: number): void {
    try {
      if (!(kind in this.vol)) return;
      this.vol[kind] = clamp01(value);
      this.applyVolumes(false);
      this.save();
    } catch {
      /* ignore */
    }
  }

  getVolume(kind: VolumeKind): number {
    return this.vol[kind] ?? 0;
  }

  toggleMute(): boolean {
    try {
      this.muted = !this.muted;
      this.applyVolumes(false);
      this.save();
    } catch {
      /* ignore */
    }
    return this.muted;
  }

  private applyVolumes(immediate: boolean): void {
    const ctx = this.ctx;
    const g = this.g;
    if (!ctx || !g) return;
    const set = (p: AudioParam, v: number): void => {
      if (immediate) p.value = v;
      else {
        p.cancelScheduledValues(ctx.currentTime);
        p.setTargetAtTime(v, ctx.currentTime, 0.03);
      }
    };
    set(g.masterGain.gain, this.muted ? 0 : curve(this.vol.master));
    set(g.musicVol.gain, curve(this.vol.music));
    set(g.sfxVol.gain, curve(this.vol.sfx));
  }

  private load(): void {
    try {
      const raw = globalThis.localStorage?.getItem(STORE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as Partial<Record<VolumeKind, unknown>> & { muted?: unknown };
      for (const k of ['master', 'music', 'sfx'] as const) {
        const v = data[k];
        if (typeof v === 'number' && Number.isFinite(v)) this.vol[k] = clamp01(v);
      }
      if (typeof data.muted === 'boolean') this.muted = data.muted;
    } catch {
      /* storage unavailable or corrupt: keep defaults */
    }
  }

  private save(): void {
    try {
      globalThis.localStorage?.setItem(STORE_KEY, JSON.stringify({ ...this.vol, muted: this.muted }));
    } catch {
      /* storage unavailable */
    }
  }

  // -------------------------------------------------------------------------
  // Diagnostics for the demo page (not part of the public Audio interface).

  describeCurrent(): Song | null {
    return this.currentKey ? this.song(this.currentKey) : null;
  }

  get state(): string {
    return this.ctx ? this.ctx.state : 'locked';
  }

  /** Stops the timer and closes the context (used by tests/hot reload). */
  dispose(): void {
    try {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      void this.ctx?.close();
    } catch {
      /* ignore */
    }
    this.ctx = null;
    this.g = null;
    this.player = null;
    this.fading = [];
  }
}
