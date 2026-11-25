// Public types for the procedural audio module.

export type SfxName =
  | 'cardDraw' | 'cardPlay' | 'cardHover' | 'menuMove' | 'menuSelect' | 'error'
  | 'hit' | 'heavyHit' | 'multiHit' | 'guard' | 'heal' | 'spell' | 'burn' | 'chill'
  | 'enemyDefeat' | 'heroDowned' | 'lpLoss' | 'revive'
  | 'spark' | 'combo' | 'coins' | 'equip' | 'seasonTick' | 'evilAdvance' | 'travel' | 'chronicle';

export type TrackName =
  | 'title' | 'map' | 'town' | 'dungeon' | 'battle' | 'boss' | 'lieutenant' | 'final'
  | 'victory' | 'gameover';

export type JingleName = 'spark' | 'victory' | 'levelUp';

export type VolumeKind = 'master' | 'music' | 'sfx';

export interface Audio {
  /** Call from the first user gesture; creates/resumes the AudioContext. */
  unlock(): Promise<void>;
  /** pitch is a semitone offset; safe no-op before unlock. */
  sfx(name: SfxName, opts?: { pitch?: number; volume?: number }): void;
  /** Crossfades (~0.8 s) to the track; same track+variant already playing = no-op. */
  music(track: TrackName, opts?: { variant?: number }): void;
  /** Short fanfare that ducks the music, then restores it. */
  jingle(name: JingleName): void;
  stopMusic(fadeSeconds?: number): void;
  /** 0..1 */
  setVolume(kind: VolumeKind, value: number): void;
  getVolume(kind: VolumeKind): number;
  /** Returns the new muted state. */
  toggleMute(): boolean;
}

export const SFX_NAMES: readonly SfxName[] = [
  'cardDraw', 'cardPlay', 'cardHover', 'menuMove', 'menuSelect', 'error',
  'hit', 'heavyHit', 'multiHit', 'guard', 'heal', 'spell', 'burn', 'chill',
  'enemyDefeat', 'heroDowned', 'lpLoss', 'revive',
  'spark', 'combo', 'coins', 'equip', 'seasonTick', 'evilAdvance', 'travel', 'chronicle',
];

export const TRACK_NAMES: readonly TrackName[] = [
  'title', 'map', 'town', 'dungeon', 'battle', 'boss', 'lieutenant', 'final', 'victory', 'gameover',
];

export const JINGLE_NAMES: readonly JingleName[] = ['spark', 'victory', 'levelUp'];
