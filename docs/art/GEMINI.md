# Making art with Gemini

All card art comes from Gemini. Local Flux rendering is retired. The rule that keeps costs down:
**never spend a paid image on one asset.** Every request is a sheet of several assets, which
`tools/art/slice.py` cuts apart locally for free.

## How a sheet gets made (Gemini app, chosen 2026-11-24)

1. Open `docs/art/gemini-prompts.md`. Each numbered sheet has a ready prompt and a file name.
2. In a new Gemini chat, attach the style bible and paste the prompt.
3. Download the image with Gemini's download button (a screenshot shrinks it) and save it under
   `art-masters/gemini/` with the name the pack gives.
4. Tell Claude which sheets are in. Each one is cut apart with a single command:

   ```bash
   python -I tools/art/slice.py --sheet evils
   ```

To add or change sheets, edit `tools/art/sheets.json` and rebuild the pack with
`python -I tools/art/prompt_pack.py`. Each app image yields up to 16 assets, so the daily allowance
goes several times further than one asset per image.

## API costs, for reference (checked 2026-11-23)

| Model | ID | 1K | 2K | 4K | Batch |
|---|---|---|---|---|---|
| Nano Banana 2.1 | `gemini-nano-banana-2.1` | $0.0336 | $0.0504 | $0.113 | half price |
| Nano Banana 2 Lite | `gemini-3.1-flash-lite-image` | $0.0336 | n/a | n/a | half price |
| Nano Banana 2 | `gemini-3.1-flash-image` | $0.067 | $0.101 | $0.151 | none |
| Nano Banana Pro | `gemini-3-pro-image` | $0.134 | $0.134 | $0.24 | none |

A reference image sent with a request costs about a tenth of a cent. There is no free API tier.
Batch jobs cost half and can take up to 24 hours. In the Gemini app, images come out of the
subscription's daily allowance instead of credits.

## The method

1. **One style bible.** The approved hero sheet is attached to every request as the style and
   character reference. Words describe what is new; the picture holds the look. This is what keeps
   eight heroes, forty monsters and sixty techs looking like one game.
2. **Sheets, not singles.** Use the layout that fits the asset:

   | Asset | Layout | Aspect | Per image |
   |---|---|---|---|
   | Heroes, successors, monsters up to human size | 4 by 2 | 16:9 | 8 |
   | Large monsters, Evils, lieutenants | 2 by 1 | 16:9 | 2 |
   | Card scenes: techs, places, events | 2 by 2 | 3:2 | 4 |
   | Items, weapons, icons | 4 by 4 | 1:1 | 16 |

3. **Flat key colour, no text.** Ask for a flat magenta background and no labels, frames,
   pedestals or names. Text drawn into art is unusable and often misspelled. Names, stats and
   frames are added locally by `tools/art/card.py`.
4. **Settle the prompt cheaply.** Try a new kind of sheet once at 1K. Make finals at 2K, which
   gives cells several hundred pixels across, far more than pixel art needs.
5. **Fix by editing, not rerolling.** If one asset in a sheet is wrong, send the sheet back with
   "change only the third figure in the top row: ..." instead of generating a new sheet.
6. **Batch the bulk.** Once a layout is proven, queue the remaining sheets as one batch job at half price.
7. **Everything after the image is local and free:** slicing, transparency, palette clean-up and
   card composition.

## Sheet prompt template

Attach the style bible, then:

> Using exactly the art style, pixel density, proportions, outlines and shading of the attached
> character sheet, draw a new sheet of {N} {assets}. Arrange them in an even grid of {C} columns
> and {R} rows with wide empty gutters, each one whole and not touching the others or the edges.
> Each faces left in a battle stance. The background is flat solid magenta #FF00FF everywhere,
> with no floor, pedestal, shadow, frame, title, label or text of any kind.
> {one line per asset, in reading order}

For card scenes, replace the background sentence with a painted scene and divide the cells with
thin black gutters, then slice with `--grid`.

## Slicing

```bash
python -I tools/art/slice.py art-masters/gemini/monsters-1.png art-masters/gemini/monsters-1 --names harrower,ghoul,... --alpha
```

Key mode finds each asset on the magenta background, keeps weapons and loose hair with their
owner, orders them row by row, and with `--alpha` makes the background transparent. Grid mode
(`--grid 4x2 --area x0,y0,x1,y1`) cuts sheets that have a painted backdrop.

## Budget for the full game

About 200 assets (16 heroes and successors, 40 monsters, 10 Evils and lieutenants, 60 techs,
30 places, 40 items) fit in about 30 sheets.

| Route | Cost |
|---|---|
| 200 single images on Nano Banana Pro | about $27 |
| 30 sheets on Nano Banana 2.1 at 2K | about $1.50 |
| Same, as batch jobs | about $0.75 |
| Same, allowing three tries per sheet | about $2 to $5 |
