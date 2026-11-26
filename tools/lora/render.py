"""After training, render comparison prompts with the finished LoRA by resuming the run for 1 step
(the trainer samples at the end, through the same 16 GB-safe pipeline). Then build a side-by-side sheet:
current game art (FLUX.1-schnell without LoRA, from public/art) next to the LoRA render.
Run from the project root: python -I tools/lora/render.py config  ->  writes tools/lora/fc-render.yaml
                           python -I tools/lora/render.py sheet   ->  art-masters/lora/check/compare.png"""
import glob, os, re, sys
from PIL import Image, ImageDraw

SUBJECTS = [  # (kind, id, description); descriptions match the game's art prompts
    ('hero', 'oda', 'a woman with long wild black hair in a crimson coat over bronze armour, a greatsword over her shoulder'),
    ('hero', 'garrick', 'a hard-faced man in a black hood and dark mail, holding a dark greatsword low'),
    ('monster', 'cinder-imp', 'a knee-high horned imp of black coal with ember eyes'),
    ('monster', 'drowned-sailor', 'a pale waterlogged sailor in a torn striped shirt with a boathook'),
    ('monster', 'mirror-knight', 'a knight in mirror-polished armour that shows distorted reflections'),
    ('monster', 'furnace-golem', 'a walking furnace of brick and iron with a glowing door for a mouth'),
    ('monster', 'tide-serpent', 'a sea serpent with green scales and a ragged fin crest'),
    ('monster', 'evil-drowned', 'a bloated grey-green corpse king in a rusted crown, seaweed hair, pale glowing eyes'),
]
RUN = 'tools/lora/output/fc-style-v1'

def prompt(kind, desc):
    base = f'fcsprite, 16-bit pixel art battle sprite of {desc}, full body'
    return base + (', standing on a grey stone pedestal, dark blue background' if kind == 'hero' else ', dark blue background')

def config():
    s = open('tools/lora/fc-style.yaml', encoding='utf-8').read()
    s = s.replace('steps: 1500', 'steps: 1501')
    head, rest = s.split('        prompts:\n', 1)
    tail = rest[rest.index('        neg:'):]
    lines = ''.join(f'          - "{prompt(k, d)}"\n' for k, _, d in SUBJECTS)
    open('tools/lora/fc-render.yaml', 'w', encoding='utf-8').write(head + '        prompts:\n' + lines + tail)
    print('wrote tools/lora/fc-render.yaml')

def sheet():
    files = sorted(glob.glob(f'{RUN}/samples/*__000001501_*.jpg'), key=lambda f: int(re.search(r'_(\d+)\.jpg$', f).group(1)))
    assert len(files) == len(SUBJECTS), files
    cell = 320
    out = Image.new('RGB', (cell * 2 * 4, (cell + 24) * 2), (20, 20, 28))
    d = ImageDraw.Draw(out)
    for i, ((kind, sid, _), f) in enumerate(zip(SUBJECTS, files)):
        x, y = (i % 4) * cell * 2, (i // 4) * (cell + 24)
        cur = f'public/art/{kind}/{sid}.png'
        if os.path.exists(cur):
            im = Image.open(cur).convert('RGB'); im.thumbnail((cell, cell), Image.NEAREST); out.paste(im, (x + (cell - im.width) // 2, y + 24))
        out.paste(Image.open(f).convert('RGB').resize((cell, cell)), (x + cell, y + 24))
        d.text((x + 6, y + 6), f'{sid}: current | LoRA', fill=(230, 230, 230))
    out.save('art-masters/lora/check/compare.png'); print('wrote art-masters/lora/check/compare.png')

{'config': config, 'sheet': sheet}[sys.argv[1]]()
