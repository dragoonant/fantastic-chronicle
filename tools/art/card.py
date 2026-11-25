"""Compose a tabletop card from a Flux master.
python -I tools/art/card.py <art.png> <out.png> --name "CROSS SLASH" --type "Technique - Sword" --cost 2WP \
    --text "Deal 12 twice.|Spark: Tiger Break 8%" [--accent "#4888f0"] [--gold] [--pixel]
Card is 750x1050 (2.5 x 3.5 in at 300 dpi). Art box is 3:2 under the name bar; text box below.
"""
import argparse, os
from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser()
ap.add_argument('art'); ap.add_argument('out')
ap.add_argument('--name', required=True); ap.add_argument('--type', default='')
ap.add_argument('--cost', default=''); ap.add_argument('--text', default='')
ap.add_argument('--accent', default='#4888f0'); ap.add_argument('--gold', action='store_true')
ap.add_argument('--pixel', action='store_true', help='art is native-resolution pixel art: integer nearest scale, no crop')
a = ap.parse_args()

W, H = 750, 1050
M = 30
fonts = os.path.join(os.environ.get('WINDIR', 'C:/Windows'), 'Fonts')
def font(name, size):
    for cand in (name, 'georgiab.ttf', 'arialbd.ttf'):
        p = os.path.join(fonts, cand)
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()
F_NAME, F_TYPE, F_TEXT, F_COST = font('georgiab.ttf', 40), font('georgia.ttf', 24), font('georgia.ttf', 27), font('georgiab.ttf', 34)

def vgrad(w, h, top, bottom):
    im = Image.new('RGB', (w, h))
    px = im.load()
    for y in range(h):
        t = y / max(1, h - 1)
        c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        for x in range(w):
            px[x, y] = c
    return im

def hexrgb(s):
    s = s.lstrip('#'); return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))

if a.gold:
    top, bottom, bevel = (112, 80, 16), (40, 24, 4), (240, 200, 64)
else:
    top, bottom, bevel = (40, 56, 160), (12, 16, 64), (248, 248, 248)
card = vgrad(W, H, top, bottom)
d = ImageDraw.Draw(card)
# bevel frame: light, grey, dark
d.rectangle((0, 0, W - 1, H - 1), outline=bevel, width=6)
d.rectangle((6, 6, W - 7, H - 7), outline=(168, 168, 192), width=4)
d.rectangle((10, 10, W - 11, H - 11), outline=(40, 40, 80), width=3)

# name bar
y = M + 4
d.text((M + 14, y), a.name, font=F_NAME, fill=(16, 16, 32))
d.text((M + 12, y - 2), a.name, font=F_NAME, fill=(248, 248, 248))
if a.cost:
    cw = d.textlength(a.cost, font=F_COST) + 28
    d.rectangle((W - M - cw - 6, y - 2, W - M, y + 48), fill=(8, 8, 16))
    d.rectangle((W - M - cw - 2, y + 2, W - M - 4, y + 44), fill=(20, 28, 88), outline=(248, 248, 248), width=2)
    d.text((W - M - cw + 10, y + 6), a.cost, font=F_COST, fill=(248, 216, 72))
y += 58
d.rectangle((M, y, W - M, y + 4), fill=hexrgb(a.accent))
d.rectangle((M, y + 4, W - M, y + 6), fill=(16, 16, 32))
y += 16

# art box, 3:2
aw = W - 2 * M - 8
ah = int(aw * 2 / 3)
art = Image.open(a.art).convert('RGB')
if a.pixel:
    k = max(1, round(min(aw / art.size[0], ah / art.size[1])))
    art = art.resize((art.size[0] * k, art.size[1] * k), Image.NEAREST)
    box = Image.new('RGB', (aw, ah), (8, 8, 16))
    box.paste(art, ((aw - art.size[0]) // 2, (ah - art.size[1]) // 2))
    art = box
else:
    w0, h0 = art.size
    art = art.crop((0, 0, w0, int(h0 * 0.95)))
    s = max(aw / art.size[0], ah / art.size[1])
    art = art.resize((int(art.size[0] * s) + 1, int(art.size[1] * s) + 1), Image.LANCZOS)
    ox, oy = (art.size[0] - aw) // 2, (art.size[1] - ah) // 2
    art = art.crop((ox, oy, ox + aw, oy + ah))
d.rectangle((M, y, M + aw + 8, y + ah + 8), fill=(8, 8, 16))
card.paste(art, (M + 4, y + 4))
d.rectangle((M + 3, y + 3, M + aw + 4, y + ah + 4), outline=(200, 200, 216), width=1)
y += ah + 20

# type line
if a.type:
    d.text((M + 12, y), a.type.upper(), font=F_TYPE, fill=(168, 176, 200))
    y += 40

# text box
box_top = y
d.rectangle((M, box_top, W - M, H - M - 10), fill=(8, 10, 32))
d.rectangle((M + 2, box_top + 2, W - M - 2, H - M - 12), outline=(60, 70, 140), width=2)
ty = box_top + 16
for line in [l for l in a.text.split('|') if l]:
    gold = line.lower().startswith('spark') or line.lower().startswith('destiny')
    # wrap
    words, cur = line.split(), ''
    for wd in words:
        trial = (cur + ' ' + wd).strip()
        if d.textlength(trial, font=F_TEXT) > W - 2 * M - 40:
            d.text((M + 18, ty), cur, font=F_TEXT, fill=(248, 216, 72) if gold else (240, 240, 248)); ty += 36; cur = wd
        else:
            cur = trial
    d.text((M + 18, ty), cur, font=F_TEXT, fill=(248, 216, 72) if gold else (240, 240, 248)); ty += 36
card.save(a.out)
print(a.out)
