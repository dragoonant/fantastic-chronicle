import type { EvilId, Mech, MonsterDef, MoveDef } from '../types';

type Band = MonsterDef['band'];
type Size = MonsterDef['size'];

const BASE: Record<string, { hp: number; atk: number }> = {
  'common-S': { hp: 16, atk: 4 }, 'common-M': { hp: 22, atk: 5 },
  'mid-M': { hp: 32, atk: 6 }, 'mid-L': { hp: 42, atk: 7 },
  'high-M': { hp: 44, atk: 8 }, 'high-L': { hp: 56, atk: 9 },
  'elite-M': { hp: 72, atk: 10 }, 'elite-L': { hp: 86, atk: 11 },
  'story-L': { hp: 160, atk: 11 }, 'lieutenant-XL': { hp: 160, atk: 11 }, 'evil-XL': { hp: 120, atk: 10 },
};

const mv = (id: string, name: string, kind: MoveDef['kind'], power: number, extra: Partial<MoveDef> = {}): MoveDef =>
  ({ id, name, kind, power, weight: 3, ...extra });

interface M {
  id: string; name: string; band: Band; size: Size; domain: EvilId | null; row?: 'front' | 'back';
  armor?: number; tags?: string[]; mech?: Mech[]; moves: MoveDef[]; look: string; text: string; phases?: number; hpMul?: number;
}

function mk(m: M): MonsterDef {
  const b = BASE[`${m.band}-${m.size}`] ?? BASE['mid-M'];
  return {
    id: m.id, name: m.name, band: m.band, size: m.size, domain: m.domain, row: m.row ?? 'front',
    hp: Math.round(b.hp * (m.hpMul ?? 1)), atk: b.atk, armor: m.armor ?? 0, tags: m.tags ?? [], mech: m.mech ?? [],
    moves: m.moves, look: m.look, text: m.text, phases: m.phases,
  };
}

const LIST: M[] = [
  // ---------- The Ash Steps: the Ashen Tyrant ----------
  { id: 'cinder-imp', name: 'Cinder Imp', band: 'common', size: 'S', domain: 'tyrant', mech: ['burnOnHit'], moves: [mv('claw', 'Claw', 'attack', 1)], look: 'a knee-high horned imp of black coal with ember eyes', text: 'Its hits apply Burn.' },
  { id: 'slag-hound', name: 'Slag Hound', band: 'common', size: 'M', domain: 'tyrant', mech: ['guardWhenBurning'], moves: [mv('bite', 'Bite', 'attack', 1), mv('maul', 'Maul', 'attack', 1.4, { weight: 1 })], look: 'a hound of cooling slag with glowing orange cracks', text: 'Gains Guard while any hero is burning.' },
  { id: 'chain-thrall', name: 'Chain Thrall', band: 'mid', size: 'M', domain: 'tyrant', moves: [mv('lash', 'Chain Lash', 'attack', 1, { target: 'back' }), mv('drag', 'Drag', 'pull', 0.7, { weight: 2 })], look: 'a shackled soldier in forge-scarred armour swinging a length of chain', text: 'Drags a back-row hero to the front row.' },
  { id: 'bellows-toad', name: 'Bellows Toad', band: 'mid', size: 'M', domain: 'tyrant', mech: ['spreadBurn'], moves: [mv('belch', 'Belch Fire', 'all', 0.6, { status: { s: 'burn', turns: 2 } }), mv('slam', 'Slam', 'attack', 1.1)], look: 'a huge warty toad with a leather bellows throat', text: 'Fans every Burn to the heroes beside it.' },
  { id: 'ash-wraith', name: 'Ash Wraith', band: 'mid', size: 'M', domain: 'tyrant', tags: ['undead'], mech: ['burnImmune', 'dodgeFirst'], moves: [mv('touch', 'Ash Touch', 'attack', 0.9, { status: { s: 'blind', turns: 1, chance: 0.5 } }), mv('choke', 'Choke', 'attack', 1.2)], look: 'a drifting hooded figure of grey ash and floating embers', text: 'Immune to Burn; dodges the first physical hit each round.' },
  { id: 'furnace-golem', name: 'Furnace Golem', band: 'high', size: 'L', domain: 'tyrant', armor: 3, mech: ['burnImmune'], moves: [mv('stoke', 'Stoke the Fire', 'charge', 0), mv('blast', 'Furnace Blast', 'frontRow', 1.8, { status: { s: 'burn', turns: 2 }, afterCharge: true }), mv('fist', 'Brick Fist', 'attack', 1.1)], look: 'a walking furnace of brick and iron with a glowing door for a mouth', text: 'Charges for a round, then blasts the whole front row.' },
  { id: 'pyre-drake', name: 'Pyre Drake', band: 'high', size: 'L', domain: 'tyrant', mech: ['burnImmune'], moves: [mv('breath', 'Fire Breath', 'frontRow', 1, { status: { s: 'burn', turns: 2 } }), mv('tail', 'Tail Lash', 'attack', 1.4)], look: 'a wingless red drake with molten scales and a smoking snout', text: 'Fire breath hits a whole row and applies Burn.' },
  { id: 'forgeborn-knight', name: 'Forgeborn Knight', band: 'elite', size: 'L', domain: 'tyrant', armor: 4, mech: ['counterSwordSpear', 'burnOnHit'], moves: [mv('cleave', 'Iron Cleave', 'attack', 1.5), mv('guard', 'Searing Guard', 'guard', 1.2, { weight: 1 })], look: 'a tall knight hammered from one piece of black iron, flames behind the visor', text: 'Counters Sword and Spear techs; Burn on every counter.' },

  // ---------- Saltmarch: the Drowned King ----------
  { id: 'bilge-rat', name: 'Bilge Rat', band: 'common', size: 'S', domain: 'drowned', mech: ['pack3'], moves: [mv('bite', 'Bite', 'attack', 1)], look: 'a bloated grey rat crusted with barnacles', text: 'Always appears in threes.' },
  { id: 'drowned-sailor', name: 'Drowned Sailor', band: 'common', size: 'M', domain: 'drowned', tags: ['undead'], mech: ['riseOnce'], moves: [mv('hook', 'Boathook', 'attack', 1, { target: 'back' })], look: 'a pale waterlogged sailor in a torn striped shirt with a boathook', text: 'Rises once with half HP after it falls.' },
  { id: 'mire-crab', name: 'Mire Crab', band: 'mid', size: 'M', domain: 'drowned', armor: 5, mech: ['axeBreaks'], moves: [mv('pinch', 'Pinch', 'attack', 1.1), mv('shell', 'Shell Up', 'guard', 1, { weight: 1 })], look: 'a giant mud crab whose shell is a piece of ship hull', text: 'Heavy Guard; Axe techs break it in one hit.' },
  { id: 'kelp-strangler', name: 'Kelp Strangler', band: 'mid', size: 'M', domain: 'drowned', tags: ['undead'], moves: [mv('strangle', 'Strangle', 'attack', 0.8, { status: { s: 'bind', turns: 1 } }), mv('lash', 'Kelp Lash', 'attack', 1)], look: 'a tangle of dripping kelp with a skull inside', text: 'Binds a hero, who cannot play Techs next round.' },
  { id: 'figurehead-siren', name: 'Figurehead Siren', band: 'mid', size: 'M', domain: 'drowned', row: 'back', tags: ['undead'], moves: [mv('song', 'Drowning Song', 'all', 0.4, { status: { s: 'chill', turns: 1 }, drainWp: 1 })], look: 'a pale singing woman fused to a broken ship figurehead', text: 'Its song applies Chill and drains 1 WP from every hero.' },
  { id: 'lantern-angler', name: 'Lantern Angler', band: 'high', size: 'L', domain: 'drowned', mech: ['hitDownedFirst'], moves: [mv('bite', 'Needle Bite', 'attack', 1.5, { target: 'lowest' }), mv('under', 'Drag Under', 'attack', 1.1, { lp: 1, weight: 1 })], look: 'a deep-sea fish with a glowing lantern lure and needle teeth', text: 'Strikes Downed heroes first, costing them LP.' },
  { id: 'tide-serpent', name: 'Tide Serpent', band: 'high', size: 'L', domain: 'drowned', moves: [mv('sweep', 'Tidal Sweep', 'frontRow', 1.2), mv('dive', 'Submerge', 'submerge', 0, { weight: 1 })], look: 'a sea serpent with green scales and a ragged fin crest', text: 'Hits the whole front row, then sinks out of reach for a round.' },
  { id: 'bell-revenant', name: 'Bell Revenant', band: 'elite', size: 'L', domain: 'drowned', tags: ['undead'], moves: [mv('toll', 'Toll of the Deep', 'toll', 0, { every: 3, weight: 99, lp: 1 }), mv('strike', 'Bell Strike', 'attack', 1.4)], look: 'a drowned priest carrying a cracked ship bell on a chain', text: 'Every third round its bell tolls and every hero loses 1 LP.' },

  // ---------- The Reaches: the Thousand-Eyed Court ----------
  { id: 'wisp', name: "Will-o'-Wisp", band: 'common', size: 'S', domain: 'court', row: 'back', mech: ['lure'], moves: [mv('flicker', 'Flicker', 'attack', 0.7, { status: { s: 'blind', turns: 1, chance: 0.4 } })], look: 'a floating pale light with a faint face inside', text: 'Forces the next single-target card to hit it.' },
  { id: 'changeling', name: 'Changeling', band: 'common', size: 'M', domain: 'court', mech: ['copyTech'], moves: [mv('mimic', 'Mimic Strike', 'attack', 1)], look: 'a grey child-shaped creature with a blank smooth face', text: 'Copies the last tech played on it, at Tier 1.' },
  { id: 'moth-courtier', name: 'Moth Courtier', band: 'mid', size: 'M', domain: 'court', row: 'back', moves: [mv('dust', 'Slumber Dust', 'attack', 0.5, { status: { s: 'sleep', turns: 1 } }), mv('wing', 'Wing Buffet', 'all', 0.6)], look: 'a person-sized moth in a ruffled velvet coat', text: 'Puts a hero to Sleep for a round.' },
  { id: 'mirror-knight', name: 'Mirror Knight', band: 'mid', size: 'M', domain: 'court', armor: 2, mech: ['reflectSpell'], moves: [mv('edge', 'Mirror Edge', 'attack', 1.2)], look: 'a knight in mirror-polished armour that shows distorted reflections', text: 'Reflects the first spell cast on it each battle.' },
  { id: 'masked-stag', name: 'Masked Stag', band: 'mid', size: 'L', domain: 'court', moves: [mv('charge', 'Antler Charge', 'attack', 1.4, { target: 'back' })], look: 'a great white stag whose antlers are hung with porcelain masks', text: 'Charges the back row.' },
  { id: 'name-thief', name: 'Name Thief', band: 'high', size: 'M', domain: 'court', row: 'back', moves: [mv('steal', 'Steal a Name', 'steal', 0.6), mv('knife', 'Knife', 'attack', 1.1)], look: 'a cloaked figure carrying a sack that spills glowing letters', text: "Steals a card from a hero's hand until it is defeated." },
  { id: 'eye-swarm', name: 'Eye Swarm', band: 'high', size: 'M', domain: 'court', row: 'back', moves: [mv('stare', 'Thousand Stares', 'multi', 0.55, { hits: 3, status: { s: 'blind', turns: 1, chance: 0.3 } })], look: 'a cluster of floating eyes trailing red threads', text: 'Many small hits; each one can Blind.' },
  { id: 'masked-duelist', name: 'Masked Duelist', band: 'elite', size: 'M', domain: 'court', mech: ['mirrorCounter'], moves: [mv('flurry', 'Rapier Flurry', 'multi', 0.6, { hits: 3 }), mv('lunge', 'Lunge', 'attack', 1.6)], look: 'a fencer in a porcelain mask and long violet coat with a rapier', text: "Mirrors the party's Formation and counters the first tech each round." },

  // ---------- The Veil: the Hollow Saint ----------
  { id: 'candle-wight', name: 'Candle Wight', band: 'common', size: 'S', domain: 'saint', tags: ['undead'], mech: ['explodeOnDeath'], moves: [mv('wax', 'Hot Wax', 'attack', 0.9, { status: { s: 'burn', turns: 1 } })], look: 'a walking melted candle with a pale flame for a head', text: 'Explodes in pale fire when defeated.' },
  { id: 'pilgrim-husk', name: 'Pilgrim Husk', band: 'common', size: 'M', domain: 'saint', row: 'back', tags: ['undead'], moves: [mv('mend', 'Hollow Prayer', 'heal', 1.6), mv('lantern', 'Lantern Swing', 'attack', 0.8)], look: 'an emptied pilgrim in grey rags holding a dim lantern', text: 'Heals the other monsters instead of attacking.' },
  { id: 'gilded-seraph', name: 'Gilded Seraph', band: 'mid', size: 'M', domain: 'saint', tags: ['holy'], mech: ['reflectCelestial'], moves: [mv('wing', 'Gilt Wing', 'attack', 1.1), mv('glare', 'Glare', 'attack', 0.7, { status: { s: 'blind', turns: 1 } })], look: 'a winged statue of cracked gilt with a blank golden face', text: 'Turns Celestial spells back on their caster.' },
  { id: 'weeping-statue', name: 'Weeping Statue', band: 'mid', size: 'M', domain: 'saint', armor: 6, tags: ['holy'], mech: ['immovable'], moves: [mv('fist', 'Stone Fist', 'attack', 1.2), mv('weep', 'Weep', 'guard', 1, { weight: 1 })], look: 'a stone saint with black tears running down its face', text: 'Heavy Guard; cannot be moved or knocked back.' },
  { id: 'censer-bearer', name: 'Censer Bearer', band: 'mid', size: 'M', domain: 'saint', row: 'back', tags: ['holy'], mech: ['noRevive'], moves: [mv('smoke', 'Pale Smoke', 'all', 0.45, { status: { s: 'blind', turns: 1, chance: 0.3 } })], look: 'a hooded acolyte swinging a censer of pale smoke', text: 'While it stands, Revive cards fail.' },
  { id: 'light-eater', name: 'Light Eater', band: 'high', size: 'L', domain: 'saint', moves: [mv('devour', 'Devour Light', 'attack', 1.2, { drainJp: 2 }), mv('maw', 'Shining Maw', 'attack', 1.5)], look: 'a pale eyeless worm with a mouth full of light', text: 'Drains JP with every hit.' },
  { id: 'reliquary-beast', name: 'Reliquary Beast', band: 'high', size: 'L', domain: 'saint', armor: 2, mech: ['growOnAllyDeath'], moves: [mv('crush', 'Crush', 'attack', 1.4)], look: 'a beast built from a gilded reliquary box on long bone legs', text: 'Grows stronger each time another monster falls.' },
  { id: 'blind-templar', name: 'Blind Templar', band: 'elite', size: 'L', domain: 'saint', armor: 3, tags: ['holy'], mech: ['celestialImmune', 'counterOnce'], moves: [mv('halo', 'Halo Blade', 'attack', 1.5), mv('judge', 'Judgment', 'frontRow', 1)], look: 'a towering knight with a white-bandaged face and a blade of light', text: 'Immune to Celestial magic; counters any attack once per round.' },

  // ---------- The Marches: the Iron Horde ----------
  { id: 'conscript', name: 'Conscript', band: 'common', size: 'M', domain: 'horde', mech: ['waves'], moves: [mv('pike', 'Pike Thrust', 'attack', 1)], look: 'a frightened foot soldier in a dented helm holding a pike', text: 'Comes in waves; a new one joins every second round.' },
  { id: 'war-dog', name: 'War Dog', band: 'common', size: 'S', domain: 'horde', moves: [mv('bite', 'Savage Bite', 'attack', 1.1, { target: 'lowest' })], look: 'a scarred mastiff in spiked leather barding', text: 'Fast; always attacks the hero with the lowest HP.' },
  { id: 'shield-sergeant', name: 'Shield Sergeant', band: 'mid', size: 'M', domain: 'horde', armor: 3, mech: ['protectAdjacent'], moves: [mv('bash', 'Shield Bash', 'attack', 1, { status: { s: 'stun', turns: 1, chance: 0.25 } })], look: 'a broad soldier behind a tall iron tower shield', text: 'Takes hits meant for the monster beside it.' },
  { id: 'crossbow-pair', name: 'Crossbow Pair', band: 'mid', size: 'M', domain: 'horde', row: 'back', moves: [mv('volley', 'Volley', 'multi', 0.65, { hits: 2, target: 'back' })], look: 'two crossbowmen in iron caps kneeling side by side', text: 'Back row; shoots the heroes in the back row.' },
  { id: 'siege-ogre', name: 'Siege Ogre', band: 'mid', size: 'L', domain: 'horde', moves: [mv('ram', 'Battering Ram', 'attack', 1.5)], mech: [], look: 'a huge chained ogre carrying a battering ram', text: "Breaks a hero's Guard with every hit." },
  { id: 'horde-drummer', name: 'Horde Drummer', band: 'high', size: 'M', domain: 'horde', row: 'back', mech: ['raiseRank'], moves: [mv('drum', 'War Drum', 'buff', 0), mv('stick', 'Drumstick', 'attack', 0.9, { weight: 1 })], look: 'a skull-masked drummer with a great war drum', text: 'Raises enemy rank by 1 each round until it falls.' },
  { id: 'iron-cavalier', name: 'Iron Cavalier', band: 'high', size: 'L', domain: 'horde', armor: 2, moves: [mv('trample', 'Trample', 'frontRow', 1.3), mv('lance', 'Lance Charge', 'attack', 1.7)], look: 'a horned rider on a horse in heavy iron barding', text: 'Charges and hits the whole front row.' },
  { id: 'banner-champion', name: 'Banner Champion', band: 'elite', size: 'L', domain: 'horde', armor: 2, mech: ['callWave'], moves: [mv('smash', 'Banner Smash', 'attack', 1.5), mv('rally', 'Rally the Line', 'summon', 0, { summon: 'conscript', weight: 1 })], look: "a giant champion carrying the Horde's iron banner", text: 'Calls a new wave when it drops below half HP.' },

  // ---------- Lieutenants ----------
  { id: 'smith-of-chains', name: 'The Smith of Chains', band: 'lieutenant', size: 'XL', domain: 'tyrant', armor: 3, mech: ['burnOnHit', 'burnImmune'], moves: [mv('hammer', 'Chain Hammer', 'attack', 1.4), mv('pull', 'Chain Pull', 'pull', 0.8), mv('stoke', 'Stoke the Forge', 'charge', 0, { weight: 1 }), mv('blast', 'Forge Blast', 'frontRow', 1.6, { status: { s: 'burn', turns: 2 }, afterCharge: true })], look: 'a hunched giant blacksmith with an anvil-shaped head, chains wrapped round both arms', text: 'Burns on every hit. Charges, then blasts the front row.' },
  { id: 'tidewarden', name: 'The Tidewarden', band: 'lieutenant', size: 'XL', domain: 'drowned', armor: 2, tags: ['undead'], moves: [mv('trident', 'Trident', 'attack', 1.3), mv('undertow', 'Undertow', 'all', 0.7, { lp: 1, every: 3, weight: 99 }), mv('dive', 'Submerge', 'submerge', 0, { weight: 1 })], look: 'a drowned knight in barnacled plate holding a trident', text: 'Every third round its Undertow costs every hero 1 LP.' },
  { id: 'herald', name: 'The Herald', band: 'lieutenant', size: 'XL', domain: 'court', mech: ['lure'], moves: [mv('fanfare', 'Fanfare of Sleep', 'all', 0.5, { status: { s: 'sleep', turns: 1, chance: 0.35 } }), mv('steal', 'Steal a Name', 'steal', 0.6), mv('twin', 'Two Faces', 'multi', 0.7, { hits: 2 })], look: 'a thin jester-herald in violet and gold with a long trumpet and a smiling mask', text: 'Puts heroes to Sleep and steals cards.' },
  { id: 'penitent', name: 'The Penitent', band: 'lieutenant', size: 'XL', domain: 'saint', tags: ['holy'], mech: ['noRevive'], moves: [mv('scourge', 'Scourge', 'multi', 0.6, { hits: 3 }), mv('censer', 'Pale Censer', 'all', 0.55, { status: { s: 'burn', turns: 2 } })], look: 'a kneeling armoured flagellant with a cage over its head and a censer of pale fire', text: 'While it stands, Revive cards fail.' },
  { id: 'warlord', name: 'The Warlord', band: 'lieutenant', size: 'XL', domain: 'horde', armor: 3, mech: ['callWave'], moves: [mv('cleave', 'Cleaver', 'attack', 1.6), mv('wall', 'Tower Shield', 'guard', 1.5, { weight: 1 }), mv('call', 'Call the Horde', 'summon', 0, { summon: 'conscript', weight: 1 })], look: 'a huge horned warrior in spiked iron armour with a tower shield and a heavy cleaver', text: 'Calls conscripts to the line.' },

  // ---------- The Five Evils ----------
  { id: 'evil-tyrant', name: 'The Ashen Tyrant', band: 'evil', size: 'XL', domain: 'tyrant', phases: 3, armor: 3, mech: ['burnOnHit', 'spreadBurn', 'burnImmune'], moves: [mv('hammer', 'Burning Hammer', 'attack', 1.5), mv('embers', 'Rain of Embers', 'all', 0.7, { status: { s: 'burn', turns: 2 } }), mv('chains', 'Chains of Conquest', 'pull', 0.9, { minPhase: 2 }), mv('stoke', 'The Great Forge', 'charge', 0, { minPhase: 3, weight: 1 }), mv('blast', 'Cataclysm Furnace', 'all', 1.5, { afterCharge: true })], look: 'a towering armoured warlord of black iron and glowing forge cracks, a crown of chains, a burning hammer', text: 'Burn spreads between heroes. Each phase brings a new weapon.' },
  { id: 'evil-drowned', name: 'The Drowned King', band: 'evil', size: 'XL', domain: 'drowned', phases: 3, tags: ['undead'], mech: [], moves: [mv('grasp', 'Drowning Grasp', 'attack', 1.4), mv('tide', 'Tide of the Dead', 'all', 0.8), mv('toll', 'Toll of the Deep', 'toll', 0, { every: 3, lp: 1, weight: 99 }), mv('call', 'Call the Drowned', 'summon', 0, { summon: 'drowned-sailor', minPhase: 2, weight: 1 }), mv('wave', 'Abyssal Wave', 'all', 1.2, { minPhase: 3 })], look: 'a bloated grey-green corpse king in a rusted crown, seaweed hair, pale glowing eyes', text: 'Every third round the deep tolls and every hero loses 1 LP.' },
  { id: 'evil-court', name: 'The Thousand-Eyed Court', band: 'evil', size: 'XL', domain: 'court', phases: 3, mech: ['mirrorCounter'], moves: [mv('gaze', 'Thousand Gazes', 'multi', 0.55, { hits: 4, status: { s: 'blind', turns: 1, chance: 0.25 } }), mv('steal', 'Abduction', 'steal', 0.8), mv('lull', 'Court Lullaby', 'all', 0.6, { status: { s: 'sleep', turns: 1, chance: 0.3 }, minPhase: 2 }), mv('masque', 'Grand Masque', 'all', 1.2, { minPhase: 3 })], look: 'a floating masked figure in layered violet robes covered in open eyes', text: 'Steals cards, blinds and lulls heroes to sleep.' },
  { id: 'evil-saint', name: 'The Hollow Saint', band: 'evil', size: 'XL', domain: 'saint', phases: 3, tags: ['holy'], mech: ['noRevive', 'reflectCelestial'], moves: [mv('halo', 'Pale Halo', 'all', 0.8), mv('judge', 'Hollow Judgment', 'attack', 1.6), mv('corrupt', 'Corrupt Light', 'attack', 0.9, { status: { s: 'weak', turns: 2 }, minPhase: 2 }), mv('nova', 'Dead Sun', 'all', 1.3, { minPhase: 3 })], look: 'a tall empty saint\'s robe with a cracked golden halo and no face', text: 'Revives fail. Celestial magic turns against its caster.' },
  { id: 'evil-horde', name: 'The Iron Horde', band: 'evil', size: 'XL', domain: 'horde', phases: 3, armor: 4, mech: ['callWave'], moves: [mv('charge', 'Iron Charge', 'frontRow', 1.4), mv('call', 'Summon the Line', 'summon', 0, { summon: 'conscript', weight: 2 }), mv('drums', 'War Drums', 'buff', 0, { minPhase: 2, weight: 1 }), mv('siege', 'The Siege', 'all', 1.3, { minPhase: 3 })], look: 'a giant war-beast of riveted iron plates ridden by a horned warlord', text: 'An endless army. Every wave raises its strength.' },

  // ---------- Chronicle story foes (Act II) ----------
  { id: 'story-varro', name: 'Captain Varro', band: 'story', size: 'L', domain: null, armor: 2, mech: ['counterOnce'], moves: [mv('cut', 'Mercenary Cut', 'attack', 1.3), mv('frost', 'Stolen Frost', 'frontRow', 1, { status: { s: 'chill', turns: 1 } })], look: 'a scarred mercenary captain carrying a pale frost-blue sword', text: 'Holds Wintermark. Counters the first attack each round.' },
  { id: 'story-usurper', name: 'The Usurper\'s Champion', band: 'story', size: 'L', domain: null, armor: 3, moves: [mv('mace', 'Flanged Mace', 'attack', 1.4), mv('decree', 'Decree', 'buff', 0, { weight: 1 })], look: 'a champion in gilded plate under a stolen royal banner', text: 'Guards the stolen throne of Highcastle.' },
  { id: 'story-huntsman', name: 'The Court Huntsman', band: 'story', size: 'L', domain: null, row: 'back', moves: [mv('arrows', 'Hunting Arrows', 'multi', 0.6, { hits: 3 }), mv('net', 'Snare', 'attack', 0.6, { status: { s: 'bind', turns: 1 } })], look: 'a masked huntsman with a horn bow and a pack of shadow hounds', text: 'Took your brother to the Court.' },
  { id: 'story-chieftain', name: 'The Bewitched Chieftain', band: 'story', size: 'L', domain: null, moves: [mv('axe', 'Clan Axe', 'attack', 1.4), mv('howl', 'War Howl', 'buff', 0, { weight: 1 })], look: 'a hill chieftain with glazed violet eyes and a great axe', text: 'A clan chief under the Court\'s spell.' },
  { id: 'story-wreck', name: 'The Wreck Warden', band: 'story', size: 'L', domain: null, tags: ['undead'], armor: 4, mech: ['axeBreaks'], moves: [mv('anchor', 'Anchor Swing', 'attack', 1.5), mv('brine', 'Brine', 'all', 0.6, { status: { s: 'chill', turns: 1 } })], look: 'a hulk of fused wreckage guarding a sunken hall', text: 'Guards the anchor-axe. Axe techs break its armour.' },
  { id: 'story-pitmaster', name: 'The Pitmaster', band: 'story', size: 'L', domain: null, moves: [mv('whip', 'Whip', 'multi', 0.6, { hits: 3 }), mv('net', 'Weighted Net', 'attack', 0.7, { status: { s: 'bind', turns: 1 } })], look: 'a heavyset pitmaster with a whip and a ring of keys', text: 'Knows where your saviour was taken.' },
  { id: 'story-warden', name: 'The Sanctum Warden', band: 'story', size: 'L', domain: null, tags: ['holy'], armor: 3, moves: [mv('seal', 'Seal', 'attack', 1.2, { status: { s: 'weak', turns: 1 } }), mv('ward', 'Ward', 'guard', 1.3, { weight: 1 })], look: 'a faceless stone warden bound in golden seals', text: 'Guards the sealed sanctum.' },
  { id: 'story-inquisitor', name: 'Grand Inquisitor Hale', band: 'story', size: 'L', domain: null, tags: ['holy'], moves: [mv('brand', 'Brand', 'attack', 1.3, { status: { s: 'burn', turns: 2 } }), mv('verdict', 'Verdict', 'all', 0.7)], look: 'a gaunt inquisitor in white and red holding a branding iron', text: 'Your former master, hunting the condemned.' },
];

export const MONSTERS: Record<string, MonsterDef> = Object.fromEntries(LIST.map((m) => [m.id, mk(m)]));

export function monster(id: string): MonsterDef {
  const m = MONSTERS[id];
  if (!m) throw new Error(`unknown monster ${id}`);
  return m;
}

export const LIEUTENANT_OF: Record<EvilId, string> = {
  tyrant: 'smith-of-chains', drowned: 'tidewarden', court: 'herald', saint: 'penitent', horde: 'warlord',
};

export const EVIL_MONSTER: Record<EvilId, string> = {
  tyrant: 'evil-tyrant', drowned: 'evil-drowned', court: 'evil-court', saint: 'evil-saint', horde: 'evil-horde',
};

export const EVIL_NAME: Record<EvilId, string> = {
  tyrant: 'The Ashen Tyrant', drowned: 'The Drowned King', court: 'The Thousand-Eyed Court', saint: 'The Hollow Saint', horde: 'The Iron Horde',
};

export const EVIL_IDS: EvilId[] = ['tyrant', 'drowned', 'court', 'saint', 'horde'];

export function domainPool(domain: EvilId, band: Band): string[] {
  return Object.values(MONSTERS).filter((m) => m.domain === domain && m.band === band).map((m) => m.id);
}
