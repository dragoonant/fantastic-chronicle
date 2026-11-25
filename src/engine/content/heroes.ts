import type { HeroDef } from '../types';

export const HEROES: Record<string, HeroDef> = Object.fromEntries(([
  {
    id: 'serin', name: 'Serin', home: 'highcastle', weapon: 'sword', lp: 11, hp: 50, archetype: 'weapon', antagonist: 'tyrant',
    line: 'A knight whose family blade was taken on the night the castle fell.', startTechs: ['cross-slash'],
    successor: { name: 'Bren the Squire', weapon: 'spear', line: 'Serin\'s squire, who carried the banner home.' }, destiny: 'destiny-weapon',
    chronicle: {
      title: 'Wintermark',
      act1: { region: 'hc-town', text: 'In a Brennmoor tavern a drunk sellsword brags about a pale blade that frosts the air. Its owner, Captain Varro, camps in Mistfen.' },
      act2: { region: 're-fen', text: 'Captain Varro sits by a fire in the reeds, Wintermark across his knees. He will sell it, for a price.', fight: 'story-varro', fightText: 'Take back Wintermark by force', cost: { crowns: 150 }, costText: 'Pay Varro 150 Crowns', reward: 'equip:wintermark' },
      act3: { region: 'as-forge', text: 'Wintermark must be reforged in the Smith of Chains\' own fire.' },
    },
  },
  {
    id: 'oda', name: 'Oda Brenn', home: 'highcastle', weapon: 'greatsword', lp: 13, hp: 56, archetype: 'crown', antagonist: 'horde',
    line: 'The exiled heir who wants the throne back, and is not sure she deserves it.', startTechs: ['smash'],
    successor: { name: 'Mara Vell', weapon: 'sword', line: 'Captain of the last royal guard.' }, destiny: 'destiny-crown',
    chronicle: {
      title: 'The Empty Throne',
      act1: { region: 'hc-town', text: 'Loyalists whisper that the Usurper\'s Champion still guards the throne room of the Fallen Keep.' },
      act2: { region: 'hc-keep', text: 'The Champion bars the throne room. The old guard would kneel to you, if you swore to give up your claim to the eastern lands.', fight: 'story-usurper', fightText: 'Fight the Champion', cost: { lp: 2 }, costText: 'Swear the oath (lose 2 LP)', reward: 'formation:rear-guard' },
      act3: { region: 'ma-hold', text: 'The Horde\'s Warlord holds the crown of Highcastle as a trophy.' },
    },
  },
  {
    id: 'tamsin', name: 'Tamsin Vey', home: 'reaches', weapon: 'bow', lp: 9, hp: 44, archetype: 'lost', antagonist: 'court',
    line: 'A ranger searching for a brother the Court took.', startTechs: ['aimed-shot'],
    successor: { name: 'Owain Vey', weapon: 'axe', line: 'A cousin who swore to finish the search.' }, destiny: 'destiny-lost',
    chronicle: {
      title: 'The Taken',
      act1: { region: 're-town', text: 'A shepherd in Vey Hollow saw the Court Huntsman leading a bound young man into Mistfen.' },
      act2: { region: 're-fen', text: 'The Huntsman waits among the marsh lights. He might trade your brother\'s trail for coin.', fight: 'story-huntsman', fightText: 'Hunt the Huntsman', cost: { crowns: 120 }, costText: 'Buy the trail for 120 Crowns', reward: 'lp:2' },
      act3: { region: 're-seat', text: 'Your brother is held in the Hall of Masks, behind the Herald.' },
    },
  },
  {
    id: 'hollis', name: 'Hollis', home: 'reaches', weapon: 'spear', lp: 12, hp: 52, archetype: 'army', antagonist: 'horde',
    line: 'A shepherd turned captain, gathering the hill clans under one banner.', startTechs: ['double-thrust'],
    successor: { name: 'Ysolde of the Fells', weapon: 'bow', line: 'A clan archer who takes up the banner.' }, destiny: 'destiny-army',
    chronicle: {
      title: 'One Banner',
      act1: { region: 're-town', text: 'The clan chiefs will not unite while the strongest of them sits bewitched on the Pale Road.' },
      act2: { region: 've-road', text: 'The Chieftain stands guard over the pilgrims, eyes glazed violet. Break the spell by force, or pay the Abbey to lift it.', fight: 'story-chieftain', fightText: 'Wake him by force', cost: { crowns: 130 }, costText: 'Pay the Abbey 130 Crowns', reward: 'formation:rear-guard' },
      act3: { region: 'ma-hold', text: 'United, the clans march on the Warlord\'s Hold.' },
    },
  },
  {
    id: 'ketteran', name: 'Ketteran', home: 'saltmarch', weapon: 'axe', lp: 14, hp: 60, archetype: 'weapon', antagonist: 'drowned',
    line: 'A shipwright who means to raise the drowned anchor-axe of his ancestors.', startTechs: ['hew'],
    successor: { name: 'Nils Ketterson', weapon: 'spear', line: 'His apprentice, who learned to read the tides.' }, destiny: 'destiny-weapon',
    chronicle: {
      title: 'The Anchor-Axe',
      act1: { region: 'sm-town', text: 'Old sailors say the anchor-axe lies in the Drowned Bell chapel, guarded by a warden made of wrecks.' },
      act2: { region: 'sm-bell', text: 'The Wreck Warden coils around the anchor-axe. The divers of Saltwick could haul it up, for a fee.', fight: 'story-wreck', fightText: 'Break the Warden', cost: { crowns: 160 }, costText: 'Pay the divers 160 Crowns', reward: 'equip:anchor-axe' },
      act3: { region: 'sm-reef', text: 'The anchor-axe must cut the Tidewarden\'s chain to free your ancestors\' ships.' },
    },
  },
  {
    id: 'ismet', name: 'Ismet Caro', home: 'saltmarch', weapon: 'martial', lp: 10, hp: 46, archetype: 'lost', antagonist: 'drowned',
    line: 'A pit fighter who owes a debt to the man who freed him, and the man has vanished.', startTechs: ['jab-flurry'],
    successor: { name: 'Dagny Caro', weapon: 'sword', line: 'His pit-sister, who never lost a bout.' }, destiny: 'destiny-lost',
    chronicle: {
      title: 'The Debt',
      act1: { region: 'sm-town', text: 'The Pitmaster of Saltwick knows where your saviour went. He is drinking on Wreck Shore.' },
      act2: { region: 'sm-shore', text: 'The Pitmaster laughs. He will talk if you fight one more time for him, or if you let him take a little of your strength.', fight: 'story-pitmaster', fightText: 'Fight the Pitmaster', cost: { lp: 1 }, costText: 'Let him beat you (lose 1 LP)', reward: 'lp:2' },
      act3: { region: 'sm-reef', text: 'Your saviour was dragged under by the Tidewarden.' },
    },
  },
  {
    id: 'yune', name: 'Yune', home: 'ashsteps', weapon: 'sword', lp: 8, hp: 40, archetype: 'crown', antagonist: 'saint', school: 'celestial',
    line: 'A cloistered seer who alone can reopen the sealed sanctum.', startTechs: ['feint'],
    successor: { name: 'Sister Aveline', weapon: 'spear', line: 'A temple guard sworn to the seer.' }, destiny: 'destiny-crown',
    chronicle: {
      title: 'The Sealed Sanctum',
      act1: { region: 'as-town', text: 'The keepers of Cinderhold say the sanctum\'s seal answers only to a warden on the Ember Flats.' },
      act2: { region: 'as-flats', text: 'The Sanctum Warden blocks the way. You could break it, or pour your own life into the seal.', fight: 'story-warden', fightText: 'Break the Warden', cost: { lp: 2 }, costText: 'Feed the seal (lose 2 LP)', reward: 'card:sanctuary' },
      act3: { region: 've-spire', text: 'The sanctum\'s light was stolen by the Penitent of the Hollow Saint.' },
    },
  },
  {
    id: 'garrick', name: 'Garrick Thole', home: 'ashsteps', weapon: 'greatsword', lp: 12, hp: 54, archetype: 'army', antagonist: 'saint', school: 'abyssal',
    line: 'A former inquisitor raising the condemned into a legion.', startTechs: ['windmill'],
    successor: { name: 'Corwin the Condemned', weapon: 'axe', line: 'The first prisoner Garrick freed.' }, destiny: 'destiny-army',
    chronicle: {
      title: 'The Condemned Legion',
      act1: { region: 'as-town', text: 'Your old master, Grand Inquisitor Hale, is marching prisoners along the Pale Road to the pyres.' },
      act2: { region: 've-road', text: 'Hale and his prisoners. Free them by the sword, or buy their writs.', fight: 'story-inquisitor', fightText: 'Free them by force', cost: { crowns: 140 }, costText: 'Buy the writs for 140 Crowns', reward: 'card:soul-rend' },
      act3: { region: 've-spire', text: 'The Penitent ordered the pyres. Your legion marches on the Spire.' },
    },
  },
] as HeroDef[]).map((h) => [h.id, h]));

export const HERO_IDS = Object.keys(HEROES);

export function hero(id: string): HeroDef {
  const h = HEROES[id];
  if (!h) throw new Error(`unknown hero ${id}`);
  return h;
}
