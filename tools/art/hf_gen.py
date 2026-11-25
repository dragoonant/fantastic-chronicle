"""Generate game art with FLUX.1-schnell through Hugging Face and pixelate it into public/art.
Run with the project venv:  tools/.venv/Scripts/python -I tools/art/hf_gen.py [--kinds hero,monster] [--limit N] [--provider fal-ai|space]
--provider fal-ai (default): Hugging Face's inference router, same model, seed and 4 steps; needs HF_TOKEN or the login saved
by `hf auth login`, and Hugging Face bills the account per image. --provider space: the public FLUX.1-schnell Space, which works
anonymously with a tiny quota. Skips art that already exists."""
import argparse, json, os, shutil, sys, time
from PIL import Image
from huggingface_hub import get_token

NATIVE = {'hero': (128, 160), 'monster': (128, 128), 'region': (192, 128), 'cardtype': (128, 96)}
ap = argparse.ArgumentParser()
ap.add_argument('--kinds', default='hero,monster,region,cardtype')
ap.add_argument('--limit', type=int, default=999)
ap.add_argument('--space', default='black-forest-labs/FLUX.1-schnell')
ap.add_argument('--provider', default='fal-ai', help="inference provider on the Hugging Face router, or 'space'")
a = ap.parse_args()

jobs = [j for j in json.load(open('art-masters/hf/jobs.json', encoding='utf-8')) if j['kind'] in a.kinds.split(',')]
os.makedirs('art-masters/hf/raw', exist_ok=True)
manifest_path = 'public/art/manifest.json'
manifest = set(json.load(open(manifest_path))) if os.path.exists(manifest_path) else set()

def pixelate(src, kind, out):
    im = Image.open(src).convert('RGB')
    w, h = NATIVE[kind]
    # cover-crop to the target aspect, then downsample to the native grid and cut the palette
    sw, sh = im.size
    s = max(w / sw, h / sh)
    im = im.resize((round(sw * s), round(sh * s)), Image.LANCZOS)
    l, t = (im.size[0] - w) // 2, (im.size[1] - h) // 2
    im = im.crop((l, t, l + w, t + h))
    im = im.quantize(colors=40, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).convert('RGB')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    im.save(out)

client = None
done = 0
for j in jobs:
    key = f"{j['kind']}/{j['id']}"
    out = f"public/art/{key}.png"
    raw = f"art-masters/hf/raw/{j['kind']}-{j['id']}.webp"
    if os.path.exists(out):
        manifest.add(key); continue
    if done >= a.limit: break
    if not os.path.exists(raw):
        try:
            t = time.time()
            if a.provider == 'space':
                if client is None:
                    from gradio_client import Client
                    tok = os.environ.get('HF_TOKEN') or get_token()
                    client = Client(a.space, verbose=False, **({'token': tok} if tok else {}))
                r = client.predict(prompt=j['prompt'], seed=j['seed'], randomize_seed=False, width=j['w'], height=j['h'], num_inference_steps=4, api_name='/infer')
                shutil.copy(r[0] if isinstance(r, (list, tuple)) else r, raw)
            else:
                if client is None:
                    from huggingface_hub import InferenceClient
                    client = InferenceClient(provider=a.provider, api_key=os.environ.get('HF_TOKEN') or get_token())
                img = client.text_to_image(j['prompt'], model=a.space, width=j['w'], height=j['h'], num_inference_steps=4, seed=j['seed'])
                img.save(raw, lossless=True)
            print(f"ok {key} {time.time() - t:.1f}s", flush=True)
        except Exception as e:  # quota or Space errors: stop and keep what we have
            msg = str(e).replace('\n', ' ')[:300]
            print(f"stopped at {key}: {msg}", flush=True)
            break
    pixelate(raw, j['kind'], out)
    manifest.add(key)
    done += 1
    json.dump(sorted(manifest), open(manifest_path, 'w'))
json.dump(sorted(manifest), open(manifest_path, 'w'))
print(f"manifest {len(manifest)} images, {done} new this run", flush=True)
