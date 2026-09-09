"""Paint chef skins for the Kenney animated character from one of its stock skins.

The stock skater skin is a red jacket over black straps, blue jeans and green sneakers. A chef
keeps the straps (they read as apron straps), gets an apron in the player colour where the
jacket was, dark trousers and black shoes, and loses the skull emblem.

Run:  python3 tools/make-chef-skins.py
Reads  assets/kenney_animated-characters-protagonists/Skins/skaterMaleA.png
Writes public/models/chef/skin_chef0.png … skin_chef5.png and copies the four stock skins.
"""
import colorsys
import os
import shutil

from PIL import Image

# ─── Config ─────────────────────────────────────────────────────────────────
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KIT = os.path.join(ROOT, 'assets', 'kenney_animated-characters-protagonists', 'Skins')
OUT = os.path.join(ROOT, 'public', 'models', 'chef')
SOURCE = 'skaterMaleA.png'
# Every stock skin is copied as well: the Chefs page offers them as characters, and three of
# them dress the pedestrians.
STOCK_SKINS = ['skaterMaleA.png', 'skaterFemaleA.png', 'criminalMaleA.png', 'cyborgFemaleA.png']

# Apron colours match CHEF_SKINS in src/art/models.ts, in the same order (the Chefs page
# lets each player pick one; players 1 and 2 default to blue and red).
CHEFS = [
    ('skin_chef0.png', (0.58, 0.80, 0.95)),   # hue, saturation, value of the apron: blue
    ('skin_chef1.png', (0.00, 0.80, 0.92)),   # red
    ('skin_chef2.png', (0.36, 0.72, 0.78)),   # green
    ('skin_chef3.png', (0.14, 0.88, 0.98)),   # yellow
    ('skin_chef4.png', (0.76, 0.58, 0.86)),   # purple
    ('skin_chef5.png', (0.07, 0.85, 0.98)),   # orange
]

# Garment regions of the 1024x1024 skin (left, top, right, bottom) and the hue window (0..1)
# of the pixels inside them that get recoloured. Skin tone shares the jacket's red hue, so
# the regions matter more than the hues.
JACKET_BOX = (150, 488, 495, 1024)
JACKET_HUE = (0.93, 1.0, 0.0, 0.06)    # red, wraps around 0
JEANS_BOX = (608, 760, 1024, 1024)
JEANS_HUE = (0.50, 0.70)               # blue
SNEAKER_BOX = (636, 128, 830, 524)
SNEAKER_HUE = (0.35, 0.52)             # teal/green
MIN_SAT = 0.35                         # straps, laces and whites stay below this
EMBLEM_BOX = (236, 690, 404, 900)      # skull + patch on the jacket front
TROUSERS = (0.0, 0.0, 0.22)            # dark grey
SHOES = (0.0, 0.0, 0.12)


# ─── Helpers ────────────────────────────────────────────────────────────────

def in_window(hue: float, window) -> bool:
    if len(window) == 4:
        return window[0] <= hue <= window[1] or window[2] <= hue <= window[3]
    return window[0] <= hue <= window[1]


def recolour(px, hsv_target, keep_value: bool = True):
    r, g, b, a = px
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    th, ts, tv = hsv_target
    v2 = v * (tv / 0.92) if keep_value else tv
    r2, g2, b2 = colorsys.hsv_to_rgb(th, ts, min(1.0, v2))
    return (int(r2 * 255), int(g2 * 255), int(b2 * 255), a)


def recolour_region(pixels, box, hue_window, target, keep_value: bool) -> None:
    x0, y0, x1, y1 = box
    for y in range(y0, y1):
        for x in range(x0, x1):
            px = pixels[x, y]
            r, g, b, a = px
            if a == 0:
                continue
            hue, sat, _val = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if sat >= MIN_SAT and in_window(hue, hue_window):
                pixels[x, y] = recolour(px, target, keep_value)


def paint(source: Image.Image, apron_hsv) -> Image.Image:
    out = source.copy()
    pixels = out.load()
    recolour_region(pixels, JACKET_BOX, JACKET_HUE, apron_hsv, True)
    recolour_region(pixels, JEANS_BOX, JEANS_HUE, TROUSERS, False)
    recolour_region(pixels, SNEAKER_BOX, SNEAKER_HUE, SHOES, False)
    # Flat apron colour over the emblem so the chef has a plain apron front.
    flat = recolour((234, 48, 49, 255), apron_hsv)
    x0, y0, x1, y1 = EMBLEM_BOX
    for y in range(y0, y1):
        for x in range(x0, x1):
            if pixels[x, y][3] > 0:
                pixels[x, y] = flat
    return out


# ─── Main ───────────────────────────────────────────────────────────────────

def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    source = Image.open(os.path.join(KIT, SOURCE)).convert('RGBA')
    for name, hsv in CHEFS:
        paint(source, hsv).save(os.path.join(OUT, name))
        print('wrote', name)
    for name in STOCK_SKINS:
        shutil.copyfile(os.path.join(KIT, name), os.path.join(OUT, name))
        print('copied', name)


if __name__ == '__main__':
    main()
