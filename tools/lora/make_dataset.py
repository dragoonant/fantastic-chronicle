"""Cut the eight heroes out of the Gemini style-bible sheet (no labels, no LP badges) and write a LoRA training set.
Run: python -I tools/lora/make_dataset.py   ->  art-masters/lora/dataset/*.png + *.txt"""
import os
from PIL import Image, ImageOps

SHEET = 'art-masters/gemini/heroes-sheet-1.png'
OUT = 'art-masters/lora/dataset'
TRIGGER = 'fcsprite'
COLS = [195, 405, 620, 830]
ROWS = [(100, 286), (326, 512)]  # figure top to pedestal bottom, above the name labels
HEROES = [
    ('serin', 'a young knight with short brown hair in silver plate armour and a blue tabard, holding a longsword'),
    ('oda', 'a swordswoman with long black hair in red and bronze armour, a greatsword raised over her shoulder'),
    ('tamsin', 'a ranger woman with a long red braid in a green hooded tunic, holding a longbow, a quiver on her back'),
    ('hollis', 'a bearded man in a brown fur-collared cloak and leather armour, holding a tall spear with a banner'),
    ('ketteran', 'a broad bearded sailor in a blue bandana and leather vest, a heavy axe on his shoulder, a chain at his belt'),
    ('ismet', 'a young martial artist with black hair in a white wrapped gi and dark trousers, fists raised'),
    ('yune', 'a young woman with long black hair in white and gold robes, holding a glowing sword'),
    ('garrick', 'a grim man in a black hooded cloak and dark mail, holding a greatsword low'),
]

def clean(im, cx, top, bot):
    """Remove the LP badge and weapon icon at the pedestal's right corner.
    The pedestal (x cx-62..cx+60, y bot-30..bot) gets its right end rebuilt as a mirror of its left end;
    the badge text above it and the icon past its edge are painted with the row's background colour."""
    px = im.load()
    ped_top, centre = bot - 30, cx - 1
    for y in range(ped_top, bot):
        for x in range(cx + 38, cx + 63):
            px[x, y] = px[2 * centre - x, y]
    for y in range(bot - 47, bot):
        bgc = px[cx + 108, y]
        x0 = cx + 46 if y < ped_top else cx + 63
        for x in range(x0, cx + 98):
            px[x, y] = bgc
    return im

def main():
    os.makedirs(OUT, exist_ok=True)
    sheet = Image.open(SHEET).convert('RGB')
    n = 0
    for i, (hid, desc) in enumerate(HEROES):
        cx = COLS[i % 4]; top, bot = ROWS[i // 4]
        work = clean(sheet.copy(), cx, top, bot)
        crop = work.crop((cx - 105, top, cx + 105, bot))
        for flip in (False, True):
            im = ImageOps.mirror(crop) if flip else crop
            im = im.resize((im.width * 2, im.height * 2), Image.NEAREST)
            oy = (512 - im.height) // 2
            edge = im.crop((0, 0, 1, im.height)).resize((1, im.height), Image.NEAREST)
            col = Image.new('RGB', (1, 512)); col.paste(edge, (0, oy))
            col.paste(edge.crop((0, 0, 1, 1)).resize((1, oy)), (0, 0))
            col.paste(edge.crop((0, im.height - 1, 1, im.height)).resize((1, 512 - oy - im.height)), (0, oy + im.height))
            canvas = col.resize((512, 512), Image.NEAREST)  # extend the sheet's own vertical gradient
            canvas.paste(im, ((512 - im.width) // 2, oy))
            name = f'{hid}{"-flip" if flip else ""}'
            canvas.save(f'{OUT}/{name}.png')
            cap = f'{TRIGGER}, 16-bit pixel art battle sprite of {desc}, full body, standing on a grey stone pedestal, dark blue background'
            open(f'{OUT}/{name}.txt', 'w', encoding='utf-8').write(cap)
            n += 1
    print(n, 'images in', OUT)

main()
