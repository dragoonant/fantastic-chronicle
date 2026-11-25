# Fantastic Chronicle: playtest build

A playable solo slice of the design in `docs/DESIGN.md`, built to test whether the format is fun before fleshing it out. Prototype by evilgouki.

## Run it

```bash
npm install
npm run dev
```

Open the address Vite prints (usually http://localhost:5173). Click once anywhere to start the sound. Runs save automatically after every action; **Title** returns to the title screen and **Continue** resumes.

## What is in the slice

- **All eight heroes.** Pick a hero, then a companion. The hero follows their three-act Chronicle and can spark. The companion has a small fixed deck, cannot spark, but can join Combination Attacks (the solo rule in the design doc).
- **The map:** six territories, 20 regions (towns, wilds, dungeons, five lieutenant seats). Every move costs a Season; dungeons cost two and hold three fights and a treasure.
- **The Five Evils** climb Stirring, Rising, Dominant, Ascendant, Cataclysm with the Season clock, claim regions from Rising on, and fight with more phases the stronger they are.
- **Battle:** hands of five, WP and JP, Quick cards, the play line, enemy intents, rows, Guard, statuses, Combination Attacks (x1.3 to x2.5), sparking with pity, Desperate Spark, LP loss, revives, charged greatsword techs.
- **Content:** six weapon spark trees (44 techs), six magic schools (18 spells), 5 items, 17 pieces of equipment, 4 formations, the 40-monster roster with its mechanics, 5 lieutenants, the Five Evils, an Act II story foe per hero, Destiny cards.
- **Succession:** at 0 LP the hero dies and a successor inherits the Chronicle, Codex techs of their weapon and the equipment, with 3 less LP. Two successions per run.
- **Sound:** all music and effects are synthesized live in the browser (`src/audio`). Ten moods of procedurally composed tracks, 26 effects, three fanfares. Try `/src/audio/demo.html` to audition them.

## Where the slice departs from the design doc

- The table is HTML and CSS, not a 256x224 PixiJS canvas, so card text stays readable while we test the format.
- Equipment is bought and equipped in town instead of living in the deck.
- Solo runs are 20 Seasons (or 14 for a quick test); Evil tiers scale to the run length.
- Successors are available from the start rather than only after Act II.
- Balance tweaks found in simulation: a slain lieutenant removes one phase from its Evil in the finale; each destroyed Evil restores a quarter of the party's HP; area attacks only strike fallen heroes when they drain LP; the "lieutenant left alive" tier penalty starts in the last third of the run.

## Things to judge while playing

1. Do battles feel like puzzles (reading intents, ordering the play line, chaining symbols) or like clicking Attack?
2. Do sparks feel exciting and frequent enough? Is Desperate Spark tempting?
3. Is LP pressure felt? Does the Season clock push you to move?
4. Is the Final Confrontation (five Evils in a row) a climax or a slog?
5. Which card, monster or rule did you never use or never notice?

## Balance tools

```bash
npm test          # rules tests
npm run sim -- 40 # a greedy bot plays 40 runs per hero; prints win rate, Chronicle rate, sparks, LP
npm run diag -- 80 # bot win rate and LP loss by battle type
```

The bot plays far worse than a person (it wins about 13% of runs), so read its numbers as a floor.

## Art (Hugging Face)

All 103 images are in `public/art` (rendered 2026-11-25): 8 heroes, 58 monsters (Evils and lieutenants included), 20 regions and 17 card-type illustrations. Each is FLUX.1-schnell at 4 steps with a fixed seed, pixelated to the native grid (heroes 128x160, monsters 128x128, regions 192x128, card types 128x96) with a 40-colour palette.

`npm run art` renders anything missing and skips what exists, so delete an image (and its raw master in `art-masters/hf/raw/`) to render it again. By default it goes through Hugging Face's inference router with provider `fal-ai`, which needs a sign-in and bills the Hugging Face account per image. `--provider space` uses the public FLUX.1-schnell Space instead, which works without an account but allows only a few images. To sign in once (it asks for a token you create at huggingface.co/settings/tokens and stores it on your machine):

```bash
tools/.venv/Scripts/hf auth login
```

If `tools/.venv` is missing (for example on a fresh copy), create it first:

```bash
python -m venv tools/.venv
```

```bash
tools/.venv/Scripts/python -m pip install gradio_client huggingface_hub pillow
```

The job list comes from the game content: `npx vite-node tools/art-jobs.ts`. Its `REROLL` table holds the images re-rendered after a contact-sheet check: humanoid enemies are named "a human foe" because "a monster" gave them lizard tails (and writing "no tail" added tails), and Lantern Abbey printed its description as a caption until it was told not to. The game shows a clean placeholder for any card without art.
