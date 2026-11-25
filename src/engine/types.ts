import type { RngState } from './rng';

export type Sym = 'o' | 'd' | 'D' | 'O'; // circle, diamond, filled diamond, filled circle
export type Weapon = 'sword' | 'greatsword' | 'axe' | 'spear' | 'bow' | 'martial';
export type School = 'fire' | 'water' | 'wind' | 'earth' | 'celestial' | 'abyssal';
export type StatusId = 'burn' | 'chill' | 'bind' | 'sleep' | 'blind' | 'stun' | 'weak' | 'lpShield';
export type EvilId = 'tyrant' | 'drowned' | 'court' | 'saint' | 'horde';
export type Row = 'front' | 'back';

/** enemy: a single enemy in reach of a melee weapon; enemyAny: any single enemy (reach, bows, spells). */
export type Target =
  | 'enemy' | 'enemyAny' | 'allEnemies' | 'randomEnemies' | 'twoEnemies'
  | 'self' | 'ally' | 'allAllies' | 'downedAlly' | 'none';

export type Effect =
  | { t: 'dmg'; n: number; hits?: number; pierce?: boolean; armorBreak?: number; vs?: { tag: string; mult: number } }
  | { t: 'guard'; n: number }
  | { t: 'heal'; n: number }
  | { t: 'status'; s: StatusId; turns: number; chance?: number }
  | { t: 'wp'; n: number }
  | { t: 'jp'; n: number }
  | { t: 'draw'; n: number }
  | { t: 'revive'; pct: number }
  | { t: 'cleanse' }
  | { t: 'counter'; n: number }
  | { t: 'cancelIntent' }
  | { t: 'lifesteal'; pct: number }
  | { t: 'selfDmg'; n: number }
  | { t: 'move' }
  | { t: 'lp'; n: number }
  | { t: 'delayEvils'; n: number }
  | { t: 'spendAllWp'; perWp: number }
  | { t: 'charge'; mult: number };

export type CardKind = 'basic' | 'tech' | 'spell' | 'item' | 'story' | 'destiny';

export interface CardDef {
  id: string;
  name: string;
  kind: CardKind;
  weapon?: Weapon;
  school?: School;
  tier: number;
  cost: number;            // WP for basic, tech and destiny; JP for spells; 0 for items and story cards
  target: Target;
  quick?: boolean;         // resolves the moment it is played
  effects: Effect[];
  sparks?: string[];       // techs this card can spark
  requires?: string[];     // extra techs that must be owned before this one can spark
  open?: Sym;
  close?: Sym;
  exhaust?: boolean;       // removed from the deck when played (items)
  price?: number;
  art?: string;
  flavor?: string;
}

export interface EquipDef {
  id: string;
  name: string;
  slot: 'weapon' | 'armor';
  weapon?: Weapon;
  atk: number;
  def: number;
  wp: number;              // starting WP in battle
  price: number;
  tier: number;
  text?: string;
}

export interface MoveDef {
  id: string;
  name: string;
  kind: 'attack' | 'multi' | 'all' | 'frontRow' | 'charge' | 'buff' | 'heal' | 'summon' | 'guard' | 'toll' | 'steal' | 'pull' | 'submerge' | 'status';
  power: number;           // multiplier of the monster's atk
  hits?: number;
  target?: 'front' | 'back' | 'lowest' | 'random' | 'downed';
  status?: { s: StatusId; turns: number; chance?: number };
  lp?: number;             // LP drained from each hero struck
  drainWp?: number;
  drainJp?: number;
  summon?: string;
  weight: number;
  every?: number;          // only on rounds divisible by this
  minPhase?: number;
  afterCharge?: boolean;   // only chosen right after a charge move
}

export type Mech =
  | 'burnOnHit' | 'guardWhenBurning' | 'spreadBurn' | 'burnImmune' | 'dodgeFirst' | 'counterSwordSpear'
  | 'pack3' | 'riseOnce' | 'axeBreaks' | 'hitDownedFirst' | 'lure' | 'copyTech' | 'reflectSpell'
  | 'explodeOnDeath' | 'reflectCelestial' | 'immovable' | 'noRevive' | 'growOnAllyDeath'
  | 'celestialImmune' | 'counterOnce' | 'waves' | 'protectAdjacent' | 'raiseRank' | 'callWave'
  | 'mirrorCounter' | 'lpAura' | 'undead' | 'holy';

export interface MonsterDef {
  id: string;
  name: string;
  band: 'common' | 'mid' | 'high' | 'elite' | 'lieutenant' | 'evil' | 'story';
  size: 'S' | 'M' | 'L' | 'XL';
  domain: EvilId | null;
  hp: number;
  atk: number;
  armor: number;
  row: Row;
  tags: string[];
  mech: Mech[];
  moves: MoveDef[];
  phases?: number;         // Evils: battle phases (each a full HP bar)
  look: string;
  text: string;
}

export interface HeroDef {
  id: string;
  name: string;
  home: string;            // territory id
  weapon: Weapon;
  lp: number;
  hp: number;
  line: string;
  archetype: 'weapon' | 'army' | 'lost' | 'crown';
  antagonist: EvilId;
  startTechs: string[];
  school?: 'celestial' | 'abyssal';
  successor: { name: string; weapon: Weapon; line: string };
  destiny: string;         // card id
  chronicle: ChronicleDef;
}

export interface ChronicleDef {
  title: string;
  act1: { region: string; text: string };                    // rumor heard in this town's tavern
  act2: { region: string; text: string; fight: string; fightText: string; cost: { crowns?: number; lp?: number }; costText: string; reward: string };
  act3: { region: string; text: string };                    // the antagonist lieutenant's seat
}

// ---------- runtime ----------

export interface HeroState {
  uid: string;
  defId: string;           // hero def this character comes from (successors keep their own name)
  name: string;
  weapon: Weapon;
  isCompanion: boolean;
  generation: number;      // 0 = the original hero, 1 and 2 = successors
  maxHp: number;
  hp: number;
  lp: number;
  maxLp: number;
  mag: number;
  weaponItem: string;
  armorItem: string | null;
  deck: string[];          // card ids, the permanent deck
  school: 'celestial' | 'abyssal' | null;
  canSpark: boolean;
  dead: boolean;
}

export interface HandCard { key: number; id: string }

export interface BattleHero {
  uid: string;
  row: Row;
  draw: string[];
  hand: HandCard[];
  discard: string[];
  wp: number;
  jp: number;
  guard: number;
  counter: number;
  statuses: Partial<Record<StatusId, number>>;
  downed: boolean;
  desperateArmed: boolean;
  desperateUsed: boolean;
  destinyUsed: boolean;
  played: number;          // cards played this round
}

export interface Intent {
  moveId: string;
  name: string;
  kind: MoveDef['kind'];
  targets: string[];       // hero uids, decided when the intent is shown
  text: string;
}

export interface EnemyState {
  uid: number;
  defId: string;
  name: string;
  row: Row;
  hp: number;
  maxHp: number;
  atk: number;
  armor: number;
  guard: number;
  statuses: Partial<Record<StatusId, number>>;
  intent: Intent | null;
  charged: boolean;
  submerged: boolean;
  phase: number;
  phases: number;
  risen: boolean;
  dodged: boolean;
  countered: boolean;
  copied: string | null;
  stolen: { heroUid: string; cardId: string } | null;
  growth: number;
  size: MonsterDef['size'];
  band: MonsterDef['band'];
}

export interface QueueEntry {
  key: number;
  heroUid: string;
  cardId: string;
  target: number | string | null;
  desperate: boolean;
  charged?: boolean;
}

export type BattleEvent =
  | { k: 'dmg'; to: number | string; n: number; heavy?: boolean; blocked?: boolean }
  | { k: 'heal'; to: string | number; n: number }
  | { k: 'guard'; to: string; n: number }
  | { k: 'miss'; to: number | string }
  | { k: 'status'; to: number | string; s: StatusId }
  | { k: 'spark'; hero: string; card: string; from: string }
  | { k: 'combo'; n: number; mult: number; names: string[] }
  | { k: 'lp'; hero: string; n: number }
  | { k: 'downed'; hero: string }
  | { k: 'revive'; hero: string }
  | { k: 'defeat'; enemy: number }
  | { k: 'summon'; enemy: number }
  | { k: 'phase'; enemy: number; phase: number }
  | { k: 'play'; hero: string; card: string }
  | { k: 'enemyMove'; enemy: number; name: string }
  | { k: 'say'; text: string };

export interface BattleState {
  kind: 'wilds' | 'dungeon' | 'lieutenant' | 'evil' | 'story';
  title: string;
  round: number;
  rank: number;
  boss: boolean;
  heroes: BattleHero[];
  enemies: EnemyState[];
  queue: QueueEntry[];
  charged: QueueEntry[];
  nextKey: number;
  nextUid: number;
  lpLost: boolean;
  over: null | 'win' | 'lose';
  log: string[];
  events: BattleEvent[];
  pity: Record<string, number>;
  sparked: { hero: string; card: string }[];
  rankBonus: number;
  evilTier: number;
  evilId: EvilId | null;
  noRevive: boolean;
}

export interface EvilState {
  offset: number;          // + accelerates, - delays (in Seasons)
  lieutenantDefeated: boolean;
  lockedTier: number | null;
  claimed: string[];
  defeated: boolean;
}

export type Phase = 'map' | 'town' | 'battle' | 'event' | 'reward' | 'final' | 'over';

export interface EventChoice { id: string; label: string; disabled?: boolean }
export interface EventState { title: string; text: string; choices: EventChoice[]; tag: string; art?: string }

export interface Reward { crowns: number; cards: string[]; sparks: { hero: string; card: string }[]; text: string[] }

export interface RunState {
  version: 1;
  seed: number;
  rng: RngState;
  season: number;
  maxSeasons: number;
  mainHero: string;        // hero def id whose Chronicle the run follows
  party: HeroState[];
  successors: number;
  crowns: number;
  location: string;
  visited: string[];
  revealed: string[];      // story regions revealed by rumor
  evils: Record<EvilId, EvilState>;
  battleCount: number;
  chronicle: { act: number; done: boolean; storyCard: string | null };
  codex: string[];
  formation: string;
  formations: string[];
  lastCamp: number;
  phase: Phase;
  battle: BattleState | null;
  pending: { region: string; battles: number; kind: BattleState['kind'] } | null;
  event: EventState | null;
  reward: Reward | null;
  final: { remaining: EvilId[]; campUsed: boolean; started: boolean } | null;
  outcome: null | 'victory' | 'defeat';
  log: string[];
  evilDelayUsed: boolean;
  sparkPity: Record<string, number>;   // failed rolls per hero:tech, kept across battles
  sparksTotal: number;
  storyPending: null | 'act2' | 'act3';
}
