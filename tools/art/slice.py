"""Cut a Gemini asset sheet into single assets (one paid image -> many cards).

Key mode (sheets drawn on a flat key colour, the cheap default):
  python -I tools/art/slice.py <sheet.png> <out-dir> --names serin,oda,... [--key auto|#RRGGBB] [--tol 48] [--pad 6] [--alpha]
  Finds every blob that differs from the key colour, merges blobs closer than --gap px (weapons, loose hair),
  keeps the N largest, orders them row by row, trims each to its box plus --pad, and with --alpha makes the key transparent.

Sheet mode (reads names, mode and grid from tools/art/sheets.json):
  python -I tools/art/slice.py --sheet evils        # art-masters/gemini/evils.png -> art-masters/gemini/evils/

Grid mode (sheets with a painted backdrop, frames or labels):
  python -I tools/art/slice.py <sheet.png> <out-dir> --names a,b,c,d --grid 4x2 [--area x0,y0,x1,y1]
"""
import argparse, os
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('sheet', nargs='?'); ap.add_argument('outdir', nargs='?')
ap.add_argument('--names'); ap.add_argument('--sheet', dest='sheet_id')
ap.add_argument('--grid'); ap.add_argument('--area')
ap.add_argument('--key', default='auto'); ap.add_argument('--tol', type=int, default=48)
ap.add_argument('--gap', type=int, default=12); ap.add_argument('--pad', type=int, default=6)
ap.add_argument('--alpha', action='store_true')
a = ap.parse_args()
if a.sheet_id:
    import json
    spec = next(x for x in json.load(open('tools/art/sheets.json', encoding='utf-8'))['sheets'] if x['id'] == a.sheet_id)
    a.sheet = a.sheet or f'art-masters/gemini/{a.sheet_id}.png'
    a.outdir = a.outdir or f'art-masters/gemini/{a.sheet_id}'
    a.names = ','.join(n for n, _ in spec['items'])
    if spec['mode'] == 'grid':
        a.grid = spec['grid']
    else:
        a.alpha = True
if not (a.sheet and a.outdir and a.names):
    ap.error('give <sheet> <out-dir> --names, or --sheet <id>')
names = [n.strip() for n in a.names.split(',') if n.strip()]
im = Image.open(a.sheet).convert('RGB'); W, H = im.size
os.makedirs(a.outdir, exist_ok=True)

def save(name, crop):
    p = os.path.join(a.outdir, name + '.png'); crop.save(p); print(p, crop.size)

if a.grid:
    cols, rows = map(int, a.grid.lower().split('x'))
    x0, y0, x1, y1 = map(int, a.area.split(',')) if a.area else (0, 0, W, H)
    cw, ch = (x1 - x0) / cols, (y1 - y0) / rows
    for i, name in enumerate(names[:cols * rows]):
        c, r = i % cols, i // cols
        save(name, im.crop((round(x0 + c * cw), round(y0 + r * ch), round(x0 + (c + 1) * cw), round(y0 + (r + 1) * ch))))
    raise SystemExit

# key mode
px = im.load()
if a.key == 'auto':
    corners = [px[x, y] for x in (0, W - 1) for y in (0, H - 1)]
    key = tuple(sorted(c[i] for c in corners)[1] for i in range(3))
else:
    s = a.key.lstrip('#'); key = tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))
t2 = a.tol * a.tol
fg = bytearray(W * H)
for y in range(H):
    for x in range(W):
        r, g, b = px[x, y]
        if (r - key[0]) ** 2 + (g - key[1]) ** 2 + (b - key[2]) ** 2 > t2:
            fg[y * W + x] = 1
# blobs on a coarse grid (cell = gap px) so nearby parts merge into one asset
G = max(1, a.gap); gw, gh = (W + G - 1) // G, (H + G - 1) // G
cell = bytearray(gw * gh)
for y in range(H):
    row = y * W
    for x in range(W):
        if fg[row + x]:
            cell[(y // G) * gw + x // G] = 1
seen = bytearray(gw * gh); boxes = []
for start in range(gw * gh):
    if not cell[start] or seen[start]:
        continue
    stack = [start]; seen[start] = 1; n = 0
    bx0, by0, bx1, by1 = gw, gh, 0, 0
    while stack:
        k = stack.pop(); n += 1
        cx, cy = k % gw, k // gw
        bx0, by0, bx1, by1 = min(bx0, cx), min(by0, cy), max(bx1, cx), max(by1, cy)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                nx, ny = cx + dx, cy + dy
                if 0 <= nx < gw and 0 <= ny < gh:
                    j = ny * gw + nx
                    if cell[j] and not seen[j]:
                        seen[j] = 1; stack.append(j)
    boxes.append((n, bx0 * G, by0 * G, min(W, (bx1 + 1) * G), min(H, (by1 + 1) * G)))
boxes = sorted(boxes, reverse=True)[:len(names)]
if len(boxes) < len(names):
    print(f'warning: found {len(boxes)} assets for {len(names)} names')
hmed = sorted(b[4] - b[2] for b in boxes)[len(boxes) // 2]
boxes.sort(key=lambda b: (round(((b[2] + b[4]) / 2) / hmed), b[1]))  # row by row, then left to right
for name, (_, x0, y0, x1, y1) in zip(names, boxes):
    box = (max(0, x0 - a.pad), max(0, y0 - a.pad), min(W, x1 + a.pad), min(H, y1 + a.pad))
    crop = im.crop(box)
    if a.alpha:
        crop = crop.convert('RGBA'); cp = crop.load()
        for y in range(crop.size[1]):
            for x in range(crop.size[0]):
                if not fg[(box[1] + y) * W + box[0] + x]:
                    cp[x, y] = (0, 0, 0, 0)
    save(name, crop)
