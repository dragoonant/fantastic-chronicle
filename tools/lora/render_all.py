"""Redraw every card image with the fc-style LoRA.
Run from the project root:
  python -I tools/lora/render_all.py config   -> tools/lora/fc-render-all.yaml (one sample prompt per art job)
  (from tools/lora/ai-toolkit) venv/Scripts/python run.py ../fc-render-all.yaml
      resumes the finished run for one step so the trainer samples every prompt through its 16 GB-safe pipeline
  python -I tools/lora/render_all.py install  -> pixelates the renders into public/art (old art kept in art-masters/hf-v1-art)
  python -I tools/lora/render_all.py sheet    -> art-masters/lora/check/all-<kind>.jpg contact sheets
Prompts come from art-masters/hf/jobs.json (npx vite-node tools/art-jobs.ts), with the base style swapped for the LoRA trigger."""
import glob, json, os, re, shutil, sys
from PIL import Image, ImageDraw

RUN = 'tools/lora/output/fc-style-v1'
ARGS = dict(a.split('=', 1) for a in sys.argv[2:])  # kinds=monster,region step=1502
STEP = int(ARGS.get('step', 1501))
KINDS = ARGS.get('kinds', 'hero,monster,region,cardtype').split(',')
# Full strength homogenises non-hero subjects toward the 8 training heroes (brown leather, humanoid), so they get less.
# Rerolled after review (2026-11-25): a region printed its flavour text, a monster had a stray digit, two sat on grey, the move card's boots were tiny.
FIX = {'hc-road': 'No lettering, no caption, no border. ', 'pilgrim-husk': ', no numbers, no text', 'crossbow-pair': ', no floor, no frame', 'conscript': ', no floor, no frame', 'move': 'a close view of a pair of large worn leather '}
STRENGTH = {'hero': 1.0, 'monster': float(ARGS.get('m_monster', 0.6)), 'region': float(ARGS.get('m_scene', 0.5)), 'cardtype': float(ARGS.get('m_scene', 0.5))}
NATIVE = {'hero': (128, 160), 'monster': (128, 128), 'region': (192, 128), 'cardtype': (128, 96)}
STYLE = '16-bit pixel art from a mid-1990s console role-playing game, crisp square pixels, limited palette, dark outlines, dithered shading'

def jobs():
    js = [j for j in json.load(open('art-masters/hf/jobs.json', encoding='utf-8')) if j['kind'] in KINDS]
    if 'ids' in ARGS:  # rerolls: ids=a,b seed=5000 -> new seeds, plus the fixes in FIX
        ids = ARGS['ids'].split(',')
        js = [dict(j, seed=int(ARGS.get('seed', 5000)) + i) for i, j in enumerate(x for x in js if x['id'] in ids)]
        for j in js:
            j['prompt'] = j['prompt'].replace('Wide landscape view', FIX.get(j['id'], '') + 'Wide landscape view').replace('plain black background', 'plain solid black background' + FIX.get(j['id'], ''))
            j['prompt'] = j['prompt'].replace('boots striding', FIX.get(j['id'], '') + 'boots striding')
    return js

def prompt(j):
    p = j['prompt']
    if j['kind'] == 'hero':  # same wording as the training captions
        look = re.search(r'a battle sprite of (.*?)\.?, full body', p).group(1)
        p = f'fcsprite, 16-bit pixel art battle sprite of {look}, full body, standing on a grey stone pedestal, dark blue background'
    else:
        p = p.replace(STYLE, 'fcsprite, 16-bit pixel art')
    return f"{p} --w {j['w']} --h {j['h']} --seed {j['seed']} --m {STRENGTH[j['kind']]}"

def config():
    s = open('tools/lora/fc-style.yaml', encoding='utf-8').read()
    s = s.replace('steps: 1500', f'steps: {STEP}', 1).replace('lr: 1e-4', 'lr: 0.0')
    head, rest = s.split('        prompts:\n', 1)
    tail = rest[rest.index('        neg:'):]
    lines = ''.join(f'          - {json.dumps(prompt(j))}\n' for j in jobs())
    tail = tail.replace('        sample_steps: 4', '        sample_steps: 4\n        format: png')
    open('tools/lora/fc-render-all.yaml', 'w', encoding='utf-8').write(head + '        prompts:\n' + lines + tail)
    print('wrote tools/lora/fc-render-all.yaml with', len(jobs()), 'prompts')

def renders():
    files = glob.glob(f'{RUN}/samples/*__{STEP:09d}_*.png')
    by_i = {int(re.search(r'_(\d+)\.png$', f).group(1)): f for f in files}
    js = jobs()
    assert len(by_i) == len(js), (len(by_i), len(js))
    return [(j, by_i[i]) for i, j in enumerate(js)]

def pixelate(src, kind, out):
    im = Image.open(src).convert('RGB')
    w, h = NATIVE[kind]
    sw, sh = im.size
    s = max(w / sw, h / sh)
    im = im.resize((round(sw * s), round(sh * s)), Image.LANCZOS)
    l, t = (im.size[0] - w) // 2, (im.size[1] - h) // 2
    im = im.crop((l, t, l + w, t + h))
    im = im.quantize(colors=40, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).convert('RGB')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    im.save(out)

def install():
    if not os.path.exists('art-masters/hf-v1-art'):
        shutil.copytree('public/art', 'art-masters/hf-v1-art')
    os.makedirs('art-masters/lora/raw', exist_ok=True)
    keys = set(json.load(open('public/art/manifest.json')))
    for j, f in renders():
        key = f"{j['kind']}/{j['id']}"
        shutil.copy(f, f"art-masters/lora/raw/{j['kind']}-{j['id']}.png")
        pixelate(f, j['kind'], f'public/art/{key}.png')
        keys.add(key)
    json.dump(sorted(keys), open('public/art/manifest.json', 'w'))
    print('installed', len(keys), 'images')

def sheet():
    os.makedirs('art-masters/lora/check', exist_ok=True)
    for kind in KINDS:
        items = [j for j in jobs() if j['kind'] == kind]
        w, h = NATIVE[kind]; z = 2; cols = 8 if kind != 'region' else 5
        cw, ch = w * z * 2 + 6, h * z + 16
        rows = (len(items) + cols - 1) // cols
        out = Image.new('RGB', (cols * cw, rows * ch), (16, 16, 22)); d = ImageDraw.Draw(out)
        for i, j in enumerate(items):
            x, y = (i % cols) * cw, (i // cols) * ch
            old = f"art-masters/hf-v1-art/{kind}/{j['id']}.png"
            if os.path.exists(old): out.paste(Image.open(old).convert('RGB').resize((w * z, h * z), Image.NEAREST), (x, y + 14))
            out.paste(Image.open(f"public/art/{kind}/{j['id']}.png").convert('RGB').resize((w * z, h * z), Image.NEAREST), (x + w * z, y + 14))
            d.text((x + 2, y + 1), j['id'], fill=(230, 230, 230))
        out.save(f'art-masters/lora/check/all-{kind}.jpg', quality=88); print(f'art-masters/lora/check/all-{kind}.jpg', out.size)

{'config': config, 'install': install, 'sheet': sheet}[sys.argv[1]]()
