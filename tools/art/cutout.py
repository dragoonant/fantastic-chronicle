"""Cut single heroes out of a party render: python -I tools/art/cutout.py <party.png> <out-dir> name:x0:x1 [name:x0:x1 ...] --top Y --bottom Y
Each crop spans x0..x1 and top..bottom at native resolution; the hero master is saved as <out-dir>/<name>.png."""
import argparse, os
from PIL import Image
ap = argparse.ArgumentParser()
ap.add_argument('inp'); ap.add_argument('outdir'); ap.add_argument('boxes', nargs='+')
ap.add_argument('--top', type=int, required=True); ap.add_argument('--bottom', type=int, required=True)
a = ap.parse_args()
im = Image.open(a.inp).convert('RGB')
os.makedirs(a.outdir, exist_ok=True)
for b in a.boxes:
    name, x0, x1 = b.split(':')
    out = os.path.join(a.outdir, name + '.png')
    im.crop((int(x0), a.top, int(x1), a.bottom)).save(out); print(out)
