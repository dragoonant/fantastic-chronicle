"""Snap a 'pixel-styled' render onto its true pixel grid.
python -I tools/art/snap.py <in.png> <out.png> [--pitch auto|N] [--colors 32] [--scale N]
Finds the effective pixel pitch from colour-edge spacing, samples each cell by its most common colour,
quantizes, and writes the native-size image (and an upscaled copy if --scale > 1)."""
import argparse
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('inp'); ap.add_argument('out')
ap.add_argument('--pitch', default='auto'); ap.add_argument('--colors', type=int, default=32)
ap.add_argument('--scale', type=int, default=1)
a = ap.parse_args()
im = Image.open(a.inp).convert('RGB')
arr = np.asarray(im).astype(int)

def edges(axis):
    d = np.abs(np.diff(arr, axis=axis)).sum(axis=2) > 40
    return d.sum(axis=0 if axis == 0 else 1) if False else d.sum(axis=1 - axis)

def find_pitch():
    # edge counts per column / row, then score pitch+phase by how much edge mass falls on grid lines
    ex = (np.abs(np.diff(arr, axis=1)).sum(axis=2) > 40).sum(axis=0).astype(float)
    ey = (np.abs(np.diff(arr, axis=0)).sum(axis=2) > 40).sum(axis=1).astype(float)
    best = None
    for p in np.arange(3.0, 12.01, 0.05):
        sc = 0
        for e in (ex, ey):
            idx = np.arange(len(e))
            ph = (idx % p)
            # histogram of edge mass by phase bin
            bins = np.zeros(int(np.ceil(p * 4)))
            np.add.at(bins, (ph * 4).astype(int) % len(bins), e)
            sc += bins.max() / max(1, e.sum()) * p   # concentrated on one phase, normalised for pitch
        if best is None or sc > best[0]: best = (sc, p)
    return best[1]

p = find_pitch() if a.pitch == 'auto' else float(a.pitch)
# phase: column/row with most edges modulo p
ex = (np.abs(np.diff(arr, axis=1)).sum(axis=2) > 40).sum(axis=0)
ey = (np.abs(np.diff(arr, axis=0)).sum(axis=2) > 40).sum(axis=1)
def phase(e):
    best, bp = -1, 0
    for o in np.arange(0, p, 0.25):
        s = sum(e[int(round(o + k * p))] for k in range(int((len(e) - o) / p)) if int(round(o + k * p)) < len(e))
        if s > best: best, bp = s, o
    return bp + 1
ox, oy = phase(ex), phase(ey)
cols = int((arr.shape[1] - ox) // p); rows = int((arr.shape[0] - oy) // p)
out = np.zeros((rows, cols, 3), dtype=np.uint8)
for r in range(rows):
    y0, y1 = int(oy + r * p), int(oy + (r + 1) * p)
    for c in range(cols):
        x0, x1 = int(ox + c * p), int(ox + (c + 1) * p)
        cell = arr[y0 + 1:y1 - 1 or y1, x0 + 1:x1 - 1 or x1].reshape(-1, 3) if (y1 - y0 > 2 and x1 - x0 > 2) else arr[y0:y1, x0:x1].reshape(-1, 3)
        out[r, c] = np.median(cell, axis=0)
g = Image.fromarray(out).quantize(colors=a.colors, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).convert('RGB')
g.save(a.out)
if a.scale > 1:
    g.resize((g.size[0] * a.scale, g.size[1] * a.scale), Image.NEAREST).save(a.out.replace('.png', f'-{a.scale}x.png'))
print(a.inp, 'pitch', round(p, 2), 'phase', ox, oy, '->', g.size)
