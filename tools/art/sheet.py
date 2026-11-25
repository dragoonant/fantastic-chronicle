"""Contact sheet of art-masters/*.png: python -I tools/art/sheet.py <out.jpg> [id-prefix]
Tiles are 384 px wide, labelled, bottom 5% cropped (the model signs its work)."""
import glob, os, sys
from PIL import Image, ImageDraw

out = sys.argv[1]
prefix = sys.argv[2] if len(sys.argv) > 2 else ''
files = sorted(f for f in glob.glob('art-masters/*.png') if os.path.basename(f).startswith(prefix))
if not files:
    sys.exit('no masters')
TW = 384
cols = 4
tiles = []
for f in files:
    im = Image.open(f).convert('RGB')
    w, h = im.size
    im = im.crop((0, 0, w, int(h * 0.95)))
    im = im.resize((TW, int(im.size[1] * TW / w)))
    tiles.append((os.path.basename(f)[:-4], im))
th = max(t[1].size[1] for t in tiles) + 18
rows = (len(tiles) + cols - 1) // cols
sheet = Image.new('RGB', (cols * TW + (cols + 1) * 6, rows * th + (rows + 1) * 6), '#111')
d = ImageDraw.Draw(sheet)
for i, (name, im) in enumerate(tiles):
    x = 6 + (i % cols) * (TW + 6)
    y = 6 + (i // cols) * (th + 6)
    sheet.paste(im, (x, y))
    d.rectangle((x, y + im.size[1], x + TW, y + im.size[1] + 18), fill='#000')
    d.text((x + 4, y + im.size[1] + 3), name, fill='#fff')
sheet.save(out, quality=85)
print(out, sheet.size, len(tiles), 'tiles')
