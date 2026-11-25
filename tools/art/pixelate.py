"""Turn a Flux master into real pixel art: python -I tools/art/pixelate.py <in.png> <out.png> [--width 136] [--colors 48] [--scale 1] [--dither]
Crops the bottom 5%, downsamples to <width> px wide (3:2), quantizes to <colors> colours, upsamples with nearest neighbour."""
import argparse
from PIL import Image, ImageEnhance

ap = argparse.ArgumentParser()
ap.add_argument('inp'); ap.add_argument('out')
ap.add_argument('--width', type=int, default=136); ap.add_argument('--colors', type=int, default=48)
ap.add_argument('--scale', type=int, default=1); ap.add_argument('--dither', action='store_true')
ap.add_argument('--method', default='octree', choices=['mediancut','maxcoverage','octree'])
ap.add_argument('--sat', type=float, default=1.25); ap.add_argument('--contrast', type=float, default=1.1)
a = ap.parse_args()

im = Image.open(a.inp).convert('RGB')
w, h = im.size
im = im.crop((0, 0, w, int(h * 0.95)))
# 3:2 centre crop, then box-filter downsample
tw, th = a.width, round(a.width * 2 / 3)
s = max(tw / im.size[0], th / im.size[1])
im = im.resize((max(tw, round(im.size[0] * s)), max(th, round(im.size[1] * s))), Image.LANCZOS)
ox, oy = (im.size[0] - tw) // 2, (im.size[1] - th) // 2
im = im.crop((ox, oy, ox + tw, oy + th))
im = ImageEnhance.Color(im).enhance(a.sat); im = ImageEnhance.Contrast(im).enhance(a.contrast)
M = {'mediancut': Image.Quantize.MEDIANCUT, 'maxcoverage': Image.Quantize.MAXCOVERAGE, 'octree': Image.Quantize.FASTOCTREE}[a.method]
im = im.quantize(colors=a.colors, method=M, dither=Image.Dither.FLOYDSTEINBERG if a.dither else Image.Dither.NONE).convert('RGB')
im = im.resize((tw * a.scale, th * a.scale), Image.NEAREST)
im.save(a.out)
print(a.out, f'{tw}x{th} native, {a.colors} colours')
