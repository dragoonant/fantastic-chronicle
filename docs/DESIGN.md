# Fantastic Chronicle — Game Design Document

**Working title:** Fantastic Chronicle
**Genre:** Cooperative roguelike deckbuilder, 1–4 players, web-based
**Inspiration:** Romancing SaGa 2 (SNES, 1993). Mechanics are drawn from the SaGa series; the world, characters, art and music are original.
**Status:** Design v0.1 (2026-11-22). Nothing built yet.

---

## 1. Vision

You are one of eight heroes with an unfinished story. One of you is hunting the blade that was stolen from your family. One of you is raising an army from a scattered people. One of you is searching for the person you lost. While you chase your Chronicle, the Five Evils are waking, and every season you spend on the road they grow stronger. Finish your story, then stand together against them before they become unstoppable.

### Design pillars

1. **Sparking is the heart.** You do not buy your best cards. You discover them in the middle of a fight, when your weapon teaches you something new. Deck growth comes mostly from sparks.
2. **Life Points are the stakes.** HP is a battle resource. LP is a run resource. Every fall costs a piece of you, and running out ends your hero's story and passes the quest to a successor.
3. **Your story is your win condition.** Each hero has a three-act Chronicle. Completing it is how you become ready for the final battle.
4. **The clock is the enemy.** The Five Evils scale with the world clock, not with the player. Speed is a strategy. Dawdling is punished.
5. **It looks and sounds like 1993.** 16-bit pixel art, a 256×224 internal canvas, blue-gradient menu windows, eight-channel sample-based music. Original assets that would pass for an SNES cartridge.

---

## 2. Player experience

### A session in one paragraph

Players pick heroes, draft a shared starting Formation, and are dropped onto a continent map with one of the Five Evils already stirring. Each **Season** (the world clock unit) every player chooses a region to act in. Players in the same region act as a party. Regions hold towns, dungeons, encounters and story events. Battles are card combat where heroes spend Weapon Points and Jutsu Points to play techs and spells, chain compatible cards into Combination Attacks, and hope to spark new techniques. Falling in battle costs LP. Between fights the party manages decks, equips weapons found in the world, and pursues Chronicle objectives. The Evils advance every Season and claim regions. When every living hero has completed their Chronicle, or when the clock reaches Cataclysm, the Final Confrontation begins against the Five Evils at whatever strength they have reached.

### Targets

| Measure | Target |
|---|---|
| Session length | 60–90 minutes for a full run |
| Players | 1–4 (solo controls one hero plus a Companion) |
| Run length | 24 Seasons to Cataclysm, typically 16–22 played |
| Deck size at end | 25–40 cards |
| Sparks per run per hero | 8–15 |

---

## 3. The world clock and the Five Evils

### The Season track

The run is 24 Seasons long. Each Season, every player takes one map action. Some actions cost extra Seasons (long dungeons, sea crossings). The group shares a single clock; the slowest action in a Season sets the pace for everyone, so splitting up is efficient only when actions are comparable in length.

### Evil power tiers

Each Evil's strength is read directly from the Season counter plus modifiers:

| Tier | Seasons | Effect |
|---|---|---|
| Stirring | 1–5 | Evil's lieutenant appears on the map. Enemies in its domain gain +1 rank. |
| Rising | 6–10 | Evil claims one adjacent region per Season. Claimed regions lose shops and inns. |
| Dominant | 11–16 | Evil gains its second battle phase. Claimed regions spawn corruption encounters. |
| Ascendant | 17–22 | Evil gains its third phase and an aura that drains 1 LP from heroes who fall. |
| Cataclysm | 23–24 | Final Confrontation begins automatically at the end of Season 24. |

Modifiers that **accelerate** an Evil: a hero death (+1 Season for all Evils), an Evil's lieutenant left undefeated past Season 10 (+1 tier for that Evil).
Modifiers that **delay** an Evil: defeating its lieutenant (−2 Seasons for that Evil), completing a Chronicle whose antagonist is that Evil (that Evil is locked at its current tier).

### The Final Confrontation

The Five Evils are fought in sequence chosen by the players, with no rest between them except one Camp. Each Evil fights at its current tier. Heroes who completed their Chronicle bring their **Destiny card** (see §9). Heroes who did not complete theirs fight without it and start the confrontation with −2 LP. Defeat all five to win.

---

## 4. The map and the Free Scenario

The continent is a graph of about 30 regions in six territories, each territory the home of one hero pair and the eventual domain of one Evil. Regions have a type:

- **Town:** inn (restore HP, WP, JP; never LP), weapon shop, magic school (buy spells of that territory's school), tavern (rumors reveal story nodes).
- **Dungeon:** 3–5 linked battles with a treasure room. Costs 2 Seasons. Best spark rates because enemies are strong.
- **Wilds:** a single battle or a roaming event. 1 Season.
- **Story node:** a Chronicle event for a specific hero. Revealed by rumors or by that hero entering the territory.
- **Lieutenant's seat:** a hard optional fight. Defeating it delays that Evil.

Nothing is gated by order. A hero may walk to any adjacent region at any time, in the spirit of Romancing SaGa's Free Scenario System. The map reveals itself through rumors, so talking to people is how you find your story.

### Enemy rank

As in Romancing SaGa 2, enemy strength rises with the **number of battles fought** by the party, independent of the Season clock. Each battle fought raises the party's Battle Count; enemy rank is derived from Battle Count and the local Evil's tier. More fighting means stronger enemies, which means higher spark rates and better loot, but also more LP risk. This is the central tension of the mid-game.

---

## 5. Battle

### Layout

Side view, as on the SNES. Enemies on the left in their formation, heroes on the right in theirs. Below, the blue-gradient command window shows the active hero's hand. HP, LP, WP and JP are shown per hero in the status strip.

### Round structure

1. **Intent.** Each enemy telegraphs its next action with an icon (attack, multi-target, spell, LP-drain, charge).
2. **Formation shift.** The party may spend its one free formation action if the current Formation allows.
3. **Hero phase.** Heroes draw to a hand of 5. Players play cards in any order they agree on. Order matters because Combination Attacks depend on sequence. Each player may play as many cards as WP and JP allow. Cards marked **Quick** resolve immediately; all others queue.
4. **Resolution.** Queued hero cards resolve in played order. Then enemies act in initiative order. Cards marked **Counter** trigger during enemy actions.
5. **Cleanup.** Discard the hand. Statuses tick. Spark checks that were rolled this round are revealed with the glimmer animation.

### Resources

| Resource | Scope | Notes |
|---|---|---|
| **HP** | Battle | Restored fully at inns and Camps. At 0 the hero is Downed. |
| **LP** | Run | 8–14 depending on hero. Lost when Downed, when struck while Downed, and to LP-drain attacks. Never restored at inns. Restored only by rare events and the Camp action (see §8). |
| **WP** | Battle | Weapon Points. Pays for techs. Regenerates +3 per round, cap 8. Starting WP equals the equipped weapon's WP bonus. |
| **JP** | Battle | Jutsu Points. Pays for spells. Regenerates +2 per round, cap 6. |

Basic Attack and Guard cards cost 0. Techs cost 1–5 WP. Spells cost 1–5 JP. Running out of points is the pacing mechanism within a fight; the regen curve means early rounds are cheap techs and later rounds are the expensive ones, matching the dramatic arc of a SaGa boss fight.

### Downed and dead

- **Downed:** HP reaches 0. Lose 1 LP. The hero lies at the back of the formation for the rest of the battle. If struck while Downed, lose 1 more LP. Any hero may spend a **Revive** card or 2 WP to raise a Downed ally with 25% HP.
- **Dead:** LP reaches 0. The hero dies at the end of the battle. See **Succession** in §8.

---

## 6. Cards

### Card types

| Type | Costs | Source | Examples |
|---|---|---|---|
| **Basic** | 0 | Starting deck | Attack, Guard, Move |
| **Tech** | WP | Sparking, rarely treasure | Cross Slash, Skewer, Rain of Arrows |
| **Spell** | JP | Magic schools in towns | Fire Wall, Mending Rain, Stone Skin |
| **Equipment** | None, passive while in deck | Shops, treasure, Chronicle rewards | Weapons, armor, accessories |
| **Formation** | None, party-wide | Towns, events | Imperial Wedge, Tortoise, Free Fight |
| **Item** | 0, consumed | Shops, loot | Herb, Antidote, Phoenix Feather |
| **Story** | 0 | Chronicle events | Letter from Home, Banner of the Exiles |
| **Destiny** | 0, once per battle | Completing a Chronicle | One per hero, unique |

### Card anatomy

```
+--------------------------+
| CROSS SLASH        # 2WP |  name, combo link, cost
| [sword icon]  Tier 2     |  weapon type, spark tier
|                          |
|  Deal 12 twice.          |  effect text
|  Spark > Tiger Break 3%  |  what this card can spark, and its base spark chance
|                          |
|  o--#                    |  combo: opens with o, closes with #
+--------------------------+
```

### Equipment in the deck

Weapons and armor are cards that live in the deck but do not clog the hand. When drawn, an Equipment card is auto-equipped if its slot is empty, or offered as a swap, and then set aside. This keeps the SaGa feel of finding and changing gear mid-run while avoiding dead draws. A hero's **equipped weapon** determines:

- which Basic Attack the hero has (Sword Attack, Bow Attack, and so on),
- which spark tree is open,
- a WP bonus and a damage stat.

---

## 7. Sparking

Sparking is how a hero learns techniques, and it is the main way the deck grows.

### How a spark happens

Every Tech and Basic Attack card lists one or more **spark children**. When a hero plays the card against an enemy, the game rolls for each child the hero does not yet own:

```
spark chance = base[child tier] * enemyFactor * pressure * pity
```

- **base[tier]:** Tier 1 = 18%, Tier 2 = 12%, Tier 3 = 8%, Tier 4 = 5%, Tier 5 = 3%.
- **enemyFactor:** the ratio of enemy rank to the child's tier, capped at 2.0. Punching up sparks more. Hitting weak enemies with high-tier intentions sparks almost never.
- **pressure:** +25% if the hero is below half HP, +25% if any party member lost LP this battle, +50% during a boss or lieutenant fight. Multiplicative.
- **pity:** +10% of base per failed roll on that specific child. Resets on spark. Guarantees that a technique you keep reaching for eventually comes.

### What a spark does

When a spark succeeds:

1. Time freezes. The hero sprite flashes, the glimmer icon appears above their head, and the new tech's name scrolls in.
2. The new tech **resolves immediately in place of the card that sparked it**, at no cost.
3. The new tech card is added permanently to the hero's deck and to the party **Codex**.

A spark is both a reward and a rescue: the best sparks arrive in the fights that are going badly.

### Desperate Spark

Once per battle a hero may **burn 1 LP** before playing a Tech. The next spark roll on that card is guaranteed to succeed on the highest-tier available child. This is the single most important decision in the game. It trades permanent life for a permanent, immediate power spike, and it is most tempting exactly when LP is lowest.

### Spark trees

Each weapon type has a tree of 12–16 techs across five tiers. Trees are directed graphs, not strict ladders. Several Tier 1 techs can each spark the same Tier 2, and some Tier 3 techs require two different parents to be owned before they become sparkable. Trees are hidden; the Codex fills in as the party discovers them, and persists across runs as meta-progression (knowing a tree does not grant the cards, it only shows the player what is possible).

Example, Sword, abridged:

```
Sword Attack --+--> Cross Slash (1) --+--> Tiger Break (3) --> Thousand Petals (5)
               |                      +--> Parry (2) --> Riposte (3)
               +--> Feint (1) -----------> Shadow Step (2) --> Phantom Edge (4)
                                                                 ^
Parry (2) + Shadow Step (2) both owned ---------------------------+
```

### Inheritance

Techs in the Codex are **inheritable**. When a hero dies and a successor takes up the quest (see Succession), the successor starts with every Codex tech that matches their weapon type at Tier 1–2, and one Tier 3 chosen by the player. This is the Romancing SaGa 2 generational idea turned into a roguelike safety net.

---

## 8. Life Points and Succession

LP is the run's true health bar. It is deliberately scarce.

### Spending and losing LP

| Event | LP change |
|---|---|
| Downed (HP to 0) | −1 |
| Struck while Downed | −1 per hit |
| LP-drain attack (undead, some Evils) | −1 to −2 |
| Desperate Spark | −1 |
| Ascendant Evil aura, on being Downed | −1 extra |
| Hero's Rest event (rare) | +2 |
| Camp action (1 Season, once per 6 Seasons) | +1 to all present heroes |
| Certain Story cards | +1 to +3, once |

### Succession

When a hero dies, the player does not leave the game. The hero's Chronicle passes to a **successor**: a named companion met during the run (every hero's Act II introduces at least one). The successor:

- keeps the dead hero's Chronicle progress and Story cards,
- inherits Codex techs as described in §7,
- keeps the dead hero's Equipment,
- loses all Spells (magic is personal, as it was in SaGa),
- has LP equal to the dead hero's starting LP minus 3,
- is a different weapon type, so the player's spark tree changes.

Each hero death advances the Season clock by 1 for all Evils. A player may succeed at most twice. A third death removes that player's hero from the run; their remaining Story cards go to the party, and the other players can still complete the run.

---

## 9. Chronicles: the story system

Every hero has a Chronicle in three acts. Each act is a Story card goal.

| Act | Shape | Example (Serin, the Dispossessed) |
|---|---|---|
| **I. The Need** | Find a thing, place or person. Revealed by rumor in the hero's home territory. | Learn where the stolen blade Wintermark was taken. |
| **II. The Cost** | A hard choice or a hard fight. Introduces the hero's companion (potential successor). | Fight the mercenary captain who holds Wintermark, or buy it with the war chest the party needs. |
| **III. The Reckoning** | A confrontation tied to one of the Five Evils' lieutenants or domain. | Carry Wintermark into the Ashen Tyrant's forge and reforge it. |

Completing Act III grants the hero's **Destiny card**, a unique once-per-battle card that is the hero's answer to the Evils, and locks the Chronicle's antagonist Evil at its current tier.

### Why speed matters

Chronicles take roughly 9–14 Seasons if pursued directly, more if the party fights everything. Every Season beyond that is a Season the Evils grow. The ideal run completes Chronicles around Season 16–18 and opens the Final Confrontation early with the Evils at Dominant rather than Ascendant. Players feel this as a constant pull between "one more dungeon for sparks" and "we have to move."

### Chronicle archetypes for the eight heroes

Each hero's Chronicle is one of four archetypes, two heroes per archetype, so that four-player groups rarely overlap:

- **The Weapon:** recover or forge a legendary weapon. Reward: a Tier 5 Equipment card and a Destiny that spends WP for a guaranteed spark.
- **The Army:** gather banners from scattered peoples. Reward: Formation cards and a Destiny that summons the army for one massive strike.
- **The Lost:** find a missing person. Reward: a companion who joins as a permanent Formation slot and a Destiny that restores LP to the party.
- **The Crown:** reclaim a seat of power. Reward: control of a territory (its shops stay open even if claimed) and a Destiny that delays all Evils by one Season.

---

## 10. Weapons, schools and Combination Attacks

### Weapon types

| Weapon | Role | Signature |
|---|---|---|
| Sword | Balanced, counters | Parry/Riposte line |
| Greatsword | Single-target burst, slow | Charge techs that resolve next round |
| Axe | Armor break | Reduces enemy Guard |
| Spear | Reach, multi-hit | Hits front and back rows |
| Bow | Back row, pulls intents | Can retarget enemy intents |
| Martial Arts | WP generation | Techs that refund WP; strongest when unarmed |

### Magic schools

Six schools, one per territory. Spells are bought, not sparked, at that territory's magic school. **Celestial** and **Abyssal** are mutually exclusive, as Heaven and Underworld magic were in Romancing SaGa 2; learning one forbids the other for that hero.

| School | Theme |
|---|---|
| Fire | Damage, Burn |
| Water | Healing, Chill |
| Wind | Speed, Quick cards |
| Earth | Guard, Stone Skin |
| Celestial | Revive, LP protection |
| Abyssal | LP drain, curses |

### Combination Attacks

Every Tech has a **combo link**: an opening symbol and a closing symbol from a set of four (circle, diamond, filled diamond, filled circle). When two or more heroes play Techs in sequence in the same Hero phase, and each card's opening symbol matches the previous card's closing symbol, the cards form a **Combination Attack**:

- 2 cards: total damage ×1.3, combined animation.
- 3 cards: ×1.6, enemy Guard ignored.
- 4 cards: ×2.0, enemy loses its next action.
- 5 cards: ×2.5 and every participant rolls a spark at pressure ×2.

Combination Attacks are the reason to fight together rather than split up. They are also the main communication layer of co-op: players read each other's hands and negotiate order.

### Formations

A Formation is a party card that sets positions (front/back, left/right) and a passive. The party has one active Formation; swapping costs the round's free formation action. Starting Formations: **Free Fight** (no passive), **Imperial Wedge** (front hero takes hits for back heroes, +1 WP regen), **Tortoise** (all heroes +Guard, no Quick cards). Found Formations include ones that change turn order, grant Counters, or boost Combination multipliers.

---

## 11. The Eight Heroes

All names, places and histories are original. Two heroes hail from each of four home territories; the remaining two territories belong to no hero and are where the Evils are strongest.

| Hero | Home | Weapon | LP | Chronicle | One line |
|---|---|---|---|---|---|
| **Serin** | Highcastle | Sword | 11 | The Weapon | A knight whose family blade was taken on the night the castle fell. |
| **Oda Brenn** | Highcastle | Greatsword | 13 | The Crown | The exiled heir who wants the throne back, and is not sure she deserves it. |
| **Tamsin Vey** | The Reaches | Bow | 9 | The Lost | A ranger searching for a brother the Court took. |
| **Hollis** | The Reaches | Spear | 12 | The Army | A shepherd turned captain, gathering the hill clans under one banner. |
| **Ketteran** | Saltmarch | Axe | 14 | The Weapon | A shipwright who means to raise the drowned anchor-axe of his ancestors. |
| **Ismet Caro** | Saltmarch | Martial Arts | 10 | The Lost | A pit fighter who owes a debt to the man who freed him and has vanished. |
| **Yune** | The Ash Steps | Sword (Celestial) | 8 | The Crown | A cloistered seer who alone can reopen the sealed sanctum. |
| **Garrick Thole** | The Ash Steps | Greatsword (Abyssal) | 12 | The Army | A former inquisitor raising the condemned into a legion. |

Heroes with low LP have the best spark rates (their weapon trees have more Tier 1 entry points). Heroes with high LP spark slower. Yune at 8 LP is the glass cannon; Ketteran at 14 is the anchor.

---

## 12. The Five Evils

| Evil | Domain | Theme | Lieutenant | Signature threat |
|---|---|---|---|---|
| **The Ashen Tyrant** | The Ash Steps | Fire, forges, conquest | The Smith of Chains | Burn that spreads between heroes in adjacent slots |
| **The Drowned King** | Saltmarch | Water, the dead at sea | The Tidewarden | LP drain on every third round |
| **The Thousand-Eyed Court** | The Reaches | Illusion, abduction | The Herald | Swaps hero hands; copies a hero's Destiny |
| **The Hollow Saint** | The Veil (no hero) | Corrupted light | The Penitent | Cancels Revive effects; punishes Celestial users |
| **The Iron Horde** | The Marches (no hero) | Armies, attrition | The Warlord | Summons waves; each wave raises enemy rank |

Each Evil has three battle phases, unlocked by tier. Each phase changes its intents and adds a mechanic. At Stirring an Evil fights only its first phase. At Ascendant it fights all three with the LP aura active.

### Monsters of each domain

Each Evil's domain has eight monsters: two common, three mid-rank, two high-rank and one elite. Enemy rank (§4) decides which ones a battle draws. Highcastle has no Evil; its encounters draw the common and mid-rank monsters of the neighbouring domains. Sizes follow the visual spec (§15): S is 32×32, M is 48×48 to 64×64, L is 96×96.

**The Ash Steps: The Ashen Tyrant.** Fire and forges. Burn is everywhere, and the strongest monsters spread it along the hero line.

| Monster | Rank | Size | In battle | Look |
|---|---|---|---|---|
| Cinder Imp | Common | S | Its hits apply Burn. | A knee-high horned imp of black coal with ember eyes. |
| Slag Hound | Common | M | Gains Guard while any hero is burning. | A hound of cooling slag with glowing orange cracks. |
| Chain Thrall | Mid | M | Drags a back-row hero to the front row. | A shackled soldier in forge-scarred armour swinging a length of chain. |
| Bellows Toad | Mid | M | Fans every Burn to the heroes beside it. | A huge warty toad with a leather bellows throat. |
| Ash Wraith | Mid | M | Immune to Burn; dodges the first physical hit each round. | A drifting hooded figure of grey ash and floating embers. |
| Furnace Golem | High | L | Charges for a round, then blasts the whole front row. | A walking furnace of brick and iron with a glowing door for a mouth. |
| Pyre Drake | High | L | Fire breath hits a whole row and applies Burn. | A wingless red drake with molten scales and a smoking snout. |
| Forgeborn Knight | Elite | L | Counters Sword and Spear techs; Burn on every counter. | A tall knight hammered from one piece of black iron, flames behind the visor. |

**Saltmarch: The Drowned King.** The drowned dead. Fights here are long and quietly cost LP.

| Monster | Rank | Size | In battle | Look |
|---|---|---|---|---|
| Bilge Rat | Common | S | Always appears in threes. | A bloated grey rat crusted with barnacles. |
| Drowned Sailor | Common | M | Rises once with half HP after it falls. | A pale waterlogged sailor in a torn striped shirt with a boathook. |
| Mire Crab | Mid | M | Heavy Guard; Axe techs break it in one hit. | A giant mud crab whose shell is a piece of ship hull. |
| Kelp Strangler | Mid | M | Binds a hero, who cannot play Techs next round. | A tangle of dripping kelp with a skull inside. |
| Figurehead Siren | Mid | M | Its song applies Chill and drains 1 WP from every hero. | A pale singing woman fused to a broken ship figurehead. |
| Lantern Angler | High | L | Strikes Downed heroes first, costing them LP. | A deep-sea fish with a glowing lantern lure and needle teeth. |
| Tide Serpent | High | L | Hits the whole front row, then sinks out of reach for a round. | A sea serpent with green scales and a ragged fin crest. |
| Bell Revenant | Elite | L | Every third round its bell tolls and every hero loses 1 LP. | A drowned priest carrying a cracked ship bell on a chain. |

**The Reaches: The Thousand-Eyed Court.** Illusion and theft. These monsters take cards, copy techs and trick the party into hitting the wrong target.

| Monster | Rank | Size | In battle | Look |
|---|---|---|---|---|
| Will-o'-Wisp | Common | S | Forces the next single-target card to hit it. | A floating pale light with a faint face inside. |
| Changeling | Common | M | Copies the last tech played on it, at Tier 1. | A grey child-shaped creature with a blank smooth face. |
| Moth Courtier | Mid | M | Puts a hero to Sleep for a round. | A person-sized moth in a ruffled velvet coat. |
| Mirror Knight | Mid | M | Reflects the first spell cast on it each battle. | A knight in mirror-polished armour that shows distorted reflections. |
| Masked Stag | Mid | L | Charges the back row. | A great white stag whose antlers are hung with porcelain masks. |
| Name Thief | High | M | Steals a card from a hero's hand until it is defeated. | A cloaked figure carrying a sack that spills glowing letters. |
| Eye Swarm | High | M | Many small hits; each one can Blind. | A cluster of floating eyes trailing red threads. |
| Masked Duelist | Elite | M | Mirrors the party's Formation and counters the first tech each round. | A fencer in a porcelain mask and long violet coat with a rapier. |

**The Veil: The Hollow Saint.** Corrupted light. Revives fail here and Celestial magic turns against its caster.

| Monster | Rank | Size | In battle | Look |
|---|---|---|---|---|
| Candle Wight | Common | S | Explodes in pale fire when defeated. | A walking melted candle with a pale flame for a head. |
| Pilgrim Husk | Common | M | Heals the other monsters instead of attacking. | An emptied pilgrim in grey rags holding a dim lantern. |
| Gilded Seraph | Mid | M | Turns Celestial spells back on their caster. | A winged statue of cracked gilt with a blank golden face. |
| Weeping Statue | Mid | M | Heavy Guard; cannot be moved or knocked back. | A stone saint with black tears running down its face. |
| Censer Bearer | Mid | M | While it stands, Revive cards fail. | A hooded acolyte swinging a censer of pale smoke. |
| Light Eater | High | L | Drains JP with every hit. | A pale eyeless worm with a mouth full of light. |
| Reliquary Beast | High | L | Grows stronger each time another monster falls. | A beast built from a gilded reliquary box on long bone legs. |
| Blind Templar | Elite | L | Immune to Celestial magic; counters any attack once per round. | A towering knight with a white-bandaged face and a blade of light. |

**The Marches: The Iron Horde.** An army that never runs out. Monsters arrive in waves and some raise enemy rank while they live.

| Monster | Rank | Size | In battle | Look |
|---|---|---|---|---|
| Conscript | Common | M | Comes in waves; a new one joins every second round. | A frightened foot soldier in a dented helm holding a pike. |
| War Dog | Common | S | Fast; always attacks the hero with the lowest HP. | A scarred mastiff in spiked leather barding. |
| Shield Sergeant | Mid | M | Takes hits meant for the monster beside it. | A broad soldier behind a tall iron tower shield. |
| Crossbow Pair | Mid | M | Back row; shoots the heroes in the back row. | Two crossbowmen in iron caps kneeling side by side. |
| Siege Ogre | Mid | L | Breaks a hero's Guard with every hit. | A huge chained ogre carrying a battering ram. |
| Horde Drummer | High | M | Raises enemy rank by 1 each round until it falls. | A skull-masked drummer with a great war drum. |
| Iron Cavalier | High | L | Charges and hits the whole front row. | A horned rider on a horse in heavy iron barding. |
| Banner Champion | Elite | L | Calls a new wave when it drops below half HP. | A giant champion carrying the Horde's iron banner. |

---

## 13. Deckbuilding and economy

- **Starting deck (12 cards):** 5 Basic Attack, 3 Guard, 1 Move, 2 class Techs (Tier 1), 1 Story card (Act I hook).
- **Growth:** sparks (primary), spells from magic schools, equipment from shops and treasure, Formations from towns and events, Story cards from Chronicle events.
- **Thinning:** Mentors in towns will **Forget** one card for a fee. Basic Attacks cannot be removed below 3.
- **Currency:** Crowns. Earned from battles and events. Spent on spells, gear, inns, Forget.
- **Loot tables** are weighted by enemy rank. Higher rank, better gear. The same tension as sparks.
- **Camp:** a 1-Season action available once per 6 Seasons. Restores HP, WP, JP and +1 LP to every present hero. The only reliable LP source.

### Meta-progression across runs

The **Codex** persists: discovered spark trees stay visible. Completed Chronicles unlock alternate Act II paths for that hero. Nothing that increases raw power persists, so every run is fair.

---

## 14. Cooperative play

- **Shared clock, independent movement.** Players choose regions simultaneously. Heroes in the same region form a party for that Season.
- **Party battles.** Each player plays from their own deck and manages their own hero. Hands are visible to all party members, which enables Combination planning.
- **Negotiation layer.** The Hero phase has no timer in casual mode and a 60-second timer in standard mode. Players place cards into a shared queue; any player may reorder the queue before Resolution.
- **Solo play.** One player controls a hero and a **Companion** (a fixed, smaller deck, no Chronicle, cannot spark but can combo). Solo runs use 20 Seasons instead of 24.
- **Sessions.** Runs are saved after each Season. Any player may rejoin a run in progress. Drop-in players take over a Companion or a successor.
- **Communication.** Built-in pings on cards and map regions. Text chat optional. No voice; the game should be playable with strangers.

---

## 15. Presentation

### Visual spec

| Element | Specification |
|---|---|
| Internal resolution | 256×224, integer-scaled to the browser window, letterboxed. No sub-pixel rendering, ever. |
| Palette | A 15-color palette plus transparency per sprite, mimicking SNES 4bpp tiles. Backgrounds may use up to 256 colors on screen. |
| Battle sprites | Heroes 32×48 pixels, about 3 head-heights tall with the head roughly one third of total height, side view, 3-frame idle, 4-frame attack, hurt, downed. Enemies 32×32 to 96×96, static with 2-frame idle, flash on hit. |
| Overworld | Tile-based map, 16×16 tiles, hero shown as a 16×24 walking sprite. The map scrolls as the cursor moves between regions. |
| Windows | Blue vertical-gradient fill, 2-pixel white bevel border, 8×8 bitmap font, drop-shadowed text. Cards in hand are drawn as a horizontal window strip with the selected card rising 4 pixels. |
| Effects | Palette-cycled slashes, Mode 7 style zoom on boss intros, screen shake on 4+ card Combinations, the glimmer "!" bubble on sparks. |
| UI chrome outside the 256×224 canvas | None. Everything, including the lobby, lives inside the canvas. |

### Audio spec

- Eight-channel, sample-based music written to SPC700 constraints: short looped samples, echo on two channels, no more than 64 KB of sample memory per track.
- Tracks: title, overworld (one per territory), town, battle, boss, lieutenant, Final Confrontation, spark fanfare (short), victory, game over.
- Sound effects: single-channel, short, pitch-shifted for variety.

### Legal note

Romancing SaGa 2's art, music, names and text are Square Enix property. This project reproduces the **style** of the SNES game with original assets and does not ship any ripped sprites, tiles, samples or names. Game mechanics such as sparking, LP, WP/JP and formations are not protected and are used freely.

---

## 16. Technical direction

| Concern | Choice | Reason |
|---|---|---|
| Language | TypeScript | Shared rules code between client and server |
| Rendering | PixiJS with a 256×224 render texture scaled with nearest-neighbor | Pixel-perfect, fast, no engine lock-in |
| Rules engine | Pure, deterministic state machine with a seeded RNG | Spark rolls must replay identically on every client |
| Netcode | Authoritative Node server, WebSocket, Colyseus or hand-rolled rooms | Co-op needs one source of truth; the state is small |
| Data | Cards, trees, enemies, Chronicles in JSON, validated with a schema | Designers edit content without touching code |
| Persistence | Server-side run saves keyed by room code; Codex per account | Drop-in, drop-out |
| Audio | WebAudio with a small tracker player for SPC-style modules | Authentic sound, tiny files |
| Build | Vite | Simple, fast |

The rules engine is the first thing to build, and it should run headless with a test harness that can simulate a thousand runs overnight to tune spark rates, LP pressure and Evil scaling.

---

## 17. Scope and milestones

### Milestone 1: Paper proof

Spreadsheet prototype of one hero, one weapon tree, one Evil. Simulate battles with dice. Validate that sparks feel good at the stated rates and that LP pressure is real but fair.

### Milestone 2: Headless engine

TypeScript rules engine, JSON content for 2 heroes, 2 weapon trees, 1 Evil, 10 enemies, a 10-region map. Automated run simulator with tuning report.

### Milestone 3: Playable solo slice

PixiJS client at 256×224. One territory, one hero, one Chronicle, one Evil. Placeholder sprites in the correct dimensions and palette constraints.

### Milestone 4: Co-op

Server, rooms, 2–4 player battles, Combination Attacks, shared clock. Four heroes.

### Milestone 5: Full content

Eight heroes, six weapon trees, six schools, Five Evils, 30 regions, all Chronicles. Original art and music replacing placeholders.

### Milestone 6: Polish and release

Balance from telemetry, accessibility (colorblind-safe combo symbols, text size option), tutorial run.

---

## 18. Open questions

1. **Spell sparking.** Spells are bought, not sparked, to match SaGa. Should Celestial and Abyssal have a small spark path to make those heroes feel special?
2. **Hidden vs visible spark rates.** The SNES hid them. The Codex reveals trees but not percentages. Should the card show the exact chance, a range, or nothing?
3. **Companion depth in solo.** Does a Companion with no sparks make solo feel like half a game? Alternative: solo controls two full heroes.
4. **Succession limit.** Two successions per player is a guess. Simulation should confirm it.
5. **Evil order in the Final Confrontation.** Player-chosen order is flexible but may have a dominant solution. Consider forcing the strongest Evil last.
6. **Permanent death of a player's line.** Should a player whose line is extinguished be able to take a Companion for the Final Confrontation so no one sits out?
