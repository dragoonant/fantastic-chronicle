// Audition page for the audio module (served at /src/audio/demo.html).

import { audio } from './index';
import { composeSong } from './composer';
import { JINGLE_NAMES, SFX_NAMES, TRACK_NAMES, type TrackName } from './types';

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.addEventListener('click', () => {
    void audio.unlock().then(onClick);
  });
  return b;
}

const variantInput = $<HTMLInputElement>('variant');
const info = $('info');
let current: TrackName | null = null;

function variant(): number {
  return Math.max(0, Math.trunc(Number(variantInput.value) || 0));
}

function describe(track: TrackName): void {
  const s = composeSong(track, variant());
  const bars = s.sections.reduce((a, sec) => a + sec.beats / s.meter, 0);
  const secs = s.sections.reduce((a, sec) => a + sec.beats, 0) * (60 / s.bpm);
  info.textContent =
    `${track} #${s.variant}: ${s.key}, ${s.bpm} bpm, ${s.meter}/4, form ${s.form}, ${bars} bars (${secs.toFixed(1)} s)` +
    `${s.loopFrom === null ? ', one-shot' : ', loops'}\nparts: ${s.sections[0]!.parts.map((p) => `${p.name}=${p.inst}`).join(', ')}`;
}

function play(track: TrackName): void {
  current = track;
  audio.music(track, { variant: variant() });
  describe(track);
  document.querySelectorAll<HTMLButtonElement>('#tracks button').forEach((b) => b.classList.toggle('on', b.textContent === track));
}

const tracks = $('tracks');
for (const t of TRACK_NAMES) tracks.append(button(t, () => play(t)));

const step = (d: number) => () => {
  variantInput.value = String(Math.max(0, variant() + d));
  if (current) play(current);
};
$('prevVar').addEventListener('click', step(-1));
$('nextVar').addEventListener('click', step(1));
variantInput.addEventListener('change', () => current && play(current));

$('stop').addEventListener('click', () => {
  audio.stopMusic();
  current = null;
  info.textContent = 'No track playing.';
  document.querySelectorAll('#tracks button').forEach((b) => b.classList.remove('on'));
});
$('stopNow').addEventListener('click', () => {
  audio.stopMusic(0);
  current = null;
  info.textContent = 'No track playing.';
  document.querySelectorAll('#tracks button').forEach((b) => b.classList.remove('on'));
});

const jingles = $('jingles');
for (const j of JINGLE_NAMES) jingles.append(button(j, () => audio.jingle(j)));

const pitch = $<HTMLInputElement>('pitch');
pitch.addEventListener('input', () => ($('pitchOut').textContent = pitch.value));
const sfx = $('sfx');
for (const n of SFX_NAMES) sfx.append(button(n, () => audio.sfx(n, { pitch: Number(pitch.value) })));

document.querySelectorAll<HTMLInputElement>('input[data-vol]').forEach((input) => {
  const kind = input.dataset.vol as 'master' | 'music' | 'sfx';
  input.value = String(audio.getVolume(kind));
  input.addEventListener('input', () => audio.setVolume(kind, Number(input.value)));
});

const mute = $<HTMLButtonElement>('mute');
mute.addEventListener('click', () => {
  void audio.unlock();
  const m = audio.toggleMute();
  mute.textContent = m ? 'Unmute' : 'Mute';
  mute.classList.toggle('on', m);
});

document.addEventListener('pointerdown', () => void audio.unlock(), { once: true });
