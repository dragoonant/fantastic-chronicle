// Procedural audio for Fantastic Chronicle: SNES-flavoured synthesized SFX and music,
// all generated at runtime with WebAudio (no audio files).
//
//   import { audio } from './audio';
//   button.addEventListener('click', () => audio.unlock(), { once: true });
//   audio.music('map', { variant: territoryIndex });
//   audio.sfx('cardPlay');
//   audio.jingle('victory');

import { AudioEngine } from './engine';
import type { Audio } from './types';

export type { Audio, SfxName, TrackName } from './types';

export const audio: Audio = new AudioEngine();
