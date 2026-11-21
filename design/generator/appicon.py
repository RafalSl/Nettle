"""Draws the app icon and the splash image (UX-12, SE-8 board G6): a ring that is filling, on the Aurora ground.

Run from the repo root: python3 design/generator/appicon.py
Writes app/assets/images/icon.png, splash-icon.png, favicon.png and the Android layers.
"""
import math
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'app')
OUT = os.path.join(ROOT, 'assets', 'images')
FONT = os.path.join(ROOT, 'node_modules', '@expo-google-fonts', 'gabarito', '800ExtraBold', 'Gabarito_800ExtraBold.ttf')
GROUND = (7, 11, 18)
ACCENT = (94, 234, 212)
VIOLET = (109, 74, 224)
BLUE = (37, 99, 235)
S = 2  # supersampling


def glow(size, center, radius, color, alpha):
    layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse([center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius], fill=color + (int(255 * alpha),))
    return layer.filter(ImageFilter.GaussianBlur(radius / 2.2))


def ring(img, cx, cy, r, width, fill_fraction=0.7):
    """Draws the track and the accent arc on `img` (alpha composited, so the track stays faint)."""
    box = [cx - r, cy - r, cx + r, cy + r]
    track = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ImageDraw.Draw(track).ellipse(box, outline=(255, 255, 255, 36), width=width)
    img.alpha_composite(track)
    arc = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(arc)
    start = -90
    end = start + 360 * fill_fraction
    d.arc(box, start, end, fill=ACCENT + (255,), width=width)
    # round caps, like the day ring
    for ang in (start, end):
        x = cx + (r - width / 2) * math.cos(math.radians(ang))
        y = cy + (r - width / 2) * math.sin(math.radians(ang))
        d.ellipse([x - width / 2, y - width / 2, x + width / 2, y + width / 2], fill=ACCENT + (255,))
    img.alpha_composite(arc)


def icon(size=1024, background=True, scale=0.62):
    n = size * S
    img = Image.new('RGBA', (n, n), GROUND + (255,) if background else (0, 0, 0, 0))
    if background:
        img = Image.alpha_composite(img, glow(n, (int(n * 0.28), int(n * 0.2)), int(n * 0.38), VIOLET, 0.55))
        img = Image.alpha_composite(img, glow(n, (int(n * 0.8), int(n * 0.85)), int(n * 0.42), BLUE, 0.45))
        img = Image.alpha_composite(img, glow(n, (int(n * 0.5), int(n * 0.5)), int(n * 0.3), ACCENT, 0.12))
    r = int(n * scale / 2)
    ring(img, n // 2, n // 2, r, int(n * 0.065))
    return img.resize((size, size), Image.LANCZOS)


def splash(size=1024):
    n = size * S
    img = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    r = int(n * 0.22)
    ring(img, n // 2, int(n * 0.40), r, int(n * 0.04))
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT, int(n * 0.12))
    text = 'Nettle'
    w = d.textlength(text, font=font)
    d.text(((n - w) / 2, int(n * 0.40) + r + int(n * 0.06)), text, font=font, fill=(242, 245, 249, 255))
    return img.resize((size, size), Image.LANCZOS)


if __name__ == '__main__':
    icon().convert('RGB').save(os.path.join(OUT, 'icon.png'))
    icon(48, scale=0.7).convert('RGB').save(os.path.join(OUT, 'favicon.png'))
    splash().save(os.path.join(OUT, 'splash-icon.png'))
    icon(1024, background=False, scale=0.5).save(os.path.join(OUT, 'android-icon-foreground.png'))
    Image.new('RGBA', (1024, 1024), GROUND + (255,)).save(os.path.join(OUT, 'android-icon-background.png'))
    mono = icon(1024, background=False, scale=0.5)
    alpha = mono.split()[3]
    Image.merge('RGBA', (Image.new('L', mono.size, 255),) * 3 + (alpha,)).save(os.path.join(OUT, 'android-icon-monochrome.png'))
    print('written to', OUT)
