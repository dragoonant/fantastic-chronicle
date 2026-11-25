import { describe, expect, it } from 'vitest';
import { audio } from './index';
import { composeSong, maxPolyphony } from './composer';
import { SFX_NAMES, TRACK_NAMES } from './types';

describe('composer', () => {
  it('is deterministic per track + variant', () => {
    for (const t of TRACK_NAMES) {
      expect(JSON.stringify(composeSong(t, 3))).toBe(JSON.stringify(composeSong(t, 3)));
    }
  });

  it('gives different tunes for different variants', () => {
    for (const t of TRACK_NAMES) {
      const a = JSON.stringify(composeSong(t, 0).sections);
      const b = JSON.stringify(composeSong(t, 1).sections);
      expect(a).not.toBe(b);
    }
  });

  it('keeps every event inside its section and with sane values', () => {
    for (const t of TRACK_NAMES) {
      for (let v = 0; v < 6; v++) {
        const s = composeSong(t, v);
        expect(s.sections.length).toBeGreaterThan(0);
        for (const sec of s.sections) {
          for (const p of sec.parts) {
            for (const n of p.notes) {
              expect(n.t).toBeGreaterThanOrEqual(0);
              expect(n.t).toBeLessThan(sec.beats);
              expect(n.d).toBeGreaterThan(0);
              expect(Number.isFinite(n.m)).toBe(true);
              expect(n.m).toBeGreaterThanOrEqual(24);
              expect(n.m).toBeLessThanOrEqual(100);
            }
          }
          for (const d of sec.drums) expect(d.t).toBeLessThan(sec.beats);
        }
        expect(maxPolyphony(s)).toBeLessThanOrEqual(12);
      }
    }
  });

  it('loops everything except game over', () => {
    expect(composeSong('gameover').loopFrom).toBeNull();
    expect(composeSong('victory').loopFrom).toBe(1);
    expect(composeSong('battle').loopFrom).toBe(0);
  });
});

describe('audio singleton headless', () => {
  it('never throws without WebAudio', async () => {
    await audio.unlock();
    for (const n of SFX_NAMES) audio.sfx(n, { pitch: 2 });
    audio.music('battle', { variant: 2 });
    audio.music('battle', { variant: 2 });
    audio.jingle('spark');
    audio.stopMusic();
    audio.setVolume('music', 0.4);
    expect(audio.getVolume('music')).toBeCloseTo(0.4);
    audio.setVolume('sfx', 7);
    expect(audio.getVolume('sfx')).toBe(1);
    const m = audio.toggleMute();
    expect(audio.toggleMute()).toBe(!m);
  });
});
