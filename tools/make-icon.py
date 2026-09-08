#!/usr/bin/env python3
"""Draws the launcher icon (a chef hat on a warm tile) with Pillow. Usage: make-icon.py OUT.png [size]."""
import sys

from PIL import Image, ImageDraw

SIZE = int(sys.argv[2]) if len(sys.argv) > 2 else 256
OUT = sys.argv[1] if len(sys.argv) > 1 else "icon.png"

BG = (232, 150, 58)          # warm counter orange
BG_EDGE = (166, 96, 30)
HAT = (250, 248, 242)
HAT_SHADE = (214, 208, 196)
BAND = (236, 232, 222)
FACE = (246, 205, 160)
EYE = (60, 40, 30)
APRON = (58, 120, 210)


def main() -> None:
    s = SIZE
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r = s // 5
    d.rounded_rectangle((0, 0, s - 1, s - 1), radius=r, fill=BG, outline=BG_EDGE, width=max(2, s // 48))

    # Hat: three puffs over a band.
    cx = s / 2
    puff = s * 0.19
    top = s * 0.20
    for dx in (-0.22, 0.0, 0.22):
        x = cx + dx * s
        d.ellipse((x - puff, top - puff * 0.2, x + puff, top + puff * 1.6), fill=HAT)
    d.rectangle((cx - s * 0.30, top + puff * 0.7, cx + s * 0.30, s * 0.50), fill=HAT)
    d.rounded_rectangle((cx - s * 0.32, s * 0.47, cx + s * 0.32, s * 0.56), radius=s // 40, fill=BAND, outline=HAT_SHADE, width=max(1, s // 96))

    # Face and apron.
    d.ellipse((cx - s * 0.22, s * 0.54, cx + s * 0.22, s * 0.84), fill=FACE)
    eye = s * 0.03
    for dx in (-0.085, 0.085):
        d.ellipse((cx + dx * s - eye, s * 0.66 - eye, cx + dx * s + eye, s * 0.66 + eye), fill=EYE)
    d.arc((cx - s * 0.08, s * 0.68, cx + s * 0.08, s * 0.78), start=15, end=165, fill=EYE, width=max(2, s // 64))
    d.rounded_rectangle((cx - s * 0.30, s * 0.80, cx + s * 0.30, s * 0.98), radius=s // 24, fill=APRON)

    img.save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
