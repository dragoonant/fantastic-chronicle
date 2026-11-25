"""Shorten figures' bodies while keeping their heads: python -I tools/art/squash.py <in.png> <out.png> --neck Y --feet Y --factor 0.7
Rows between neck and feet are resized vertically with nearest neighbour (whole pixel rows drop out, so pixels stay square-edged);
everything above the neck moves down so the feet stay on the floor; the vacated top rows repeat the top backdrop row."""
import argparse
from PIL import Image
ap = argparse.ArgumentParser()
ap.add_argument('inp'); ap.add_argument('out')
ap.add_argument('--neck', type=int, required=True); ap.add_argument('--feet', type=int, required=True)
ap.add_argument('--factor', type=float, default=0.7)
a = ap.parse_args()
im = Image.open(a.inp).convert('RGB'); w, h = im.size
body = im.crop((0, a.neck, w, a.feet))
nb = round(body.size[1] * a.factor)
body = body.resize((w, nb), Image.NEAREST)
shift = (a.feet - a.neck) - nb
out = Image.new('RGB', (w, h))
out.paste(im.crop((0, a.feet, w, h)), (0, a.feet))          # floor below the feet, unchanged
out.paste(body, (0, a.feet - nb))                            # shortened bodies
out.paste(im.crop((0, 0, w, a.neck)), (0, shift))            # heads and backdrop, moved down
top = im.crop((0, 0, w, 1)).resize((w, shift), Image.NEAREST) # refill the vacated strip
out.paste(top, (0, 0))
out.save(a.out); print(a.out, 'body', a.feet - a.neck, '->', nb)
