"""Draws the app icon and the splash image (UX-12, boards G7-AppIcon-Nettle option A and G7-Splash-Nettle):
a serrated nettle leaf inside a filling ring, on the Aurora ground. The leaf has the shape of `leaf_path` in group7.py.

Run from the repo root: python3 design/generator/appicon.py
Writes app/assets/images/icon.png, splash-icon.png, favicon.png and the Android layers.
"""
import math
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'app')
OUT = os.path.join(ROOT, 'assets', 'images')
# node_modules lives in a Docker volume; point NETTLE_FONT at a copy of Gabarito_800ExtraBold.ttf when it is not on the host.
FONT = os.environ.get('NETTLE_FONT') or os.path.join(ROOT, 'node_modules', '@expo-google-fonts', 'gabarito', '800ExtraBold', 'Gabarito_800ExtraBold.ttf')
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


def leaf_points(cx, cy, length, width, teeth, rot):
    """The nettle leaf outline, same shape as leaf_path in group7.py: pointed tip, forward teeth on both edges (units of the 100-box)."""
    def half(t):
        return width / 2 * math.sin(math.pi * t ** 0.62) ** 1.1
    right, left = [], []
    for side, seq in ((1, right), (-1, left)):
        for i in range(teeth):
            t_valley = 0.10 + 0.80 * i / teeth
            t_tip = 0.10 + 0.80 * (i + 0.7) / teeth
            seq.append((t_valley, half(t_valley) * 0.84 * side))
            seq.append((t_tip, half(t_tip) * 1.05 * side))
    seq = [(0.0, 0.0)] + right + [(1.0, 0.0)] + list(reversed(left))
    a = math.radians(rot)
    return [(cx + w * math.cos(a) - (length / 2 - t * length) * math.sin(a), cy + w * math.sin(a) + (length / 2 - t * length) * math.cos(a)) for t, w in seq]


def mark(img, cx, cy, size, flat=False):
    """Option A: the ring (arc 72 %) with the leaf inside. `size` is the side of the 100-unit box; `flat` is one colour, no track or wash (the Android monochrome layer)."""
    u = size / 100
    box0x, box0y = cx - size / 2, cy - size / 2
    if flat:
        arc = Image.new('RGBA', img.size, (0, 0, 0, 0))
        ring_arc(arc, cx, cy, int(38 * u), max(1, int(5 * u)))
        img.alpha_composite(arc)
    else:
        ring(img, cx, cy, int(38 * u), max(1, int(5 * u)), 0.72)
    pts = [(box0x + x * u, box0y + y * u) for x, y in leaf_points(50, 50, 52, 30, 6, 24)]
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    if not flat:
        d.polygon(pts, fill=ACCENT + (46,))  # accentSoft: the wash inside the leaf
    stroke = max(1, int(2.6 * u))
    d.line(pts + [pts[0], pts[1]], fill=ACCENT + (255,), width=stroke, joint='curve')
    a = math.radians(24)
    x1, y1 = 50 - 24 * math.sin(a), 50 + 24 * math.cos(a)
    x2, y2 = 50 + 52 * 0.38 * math.sin(a), 50 - 52 * 0.38 * math.cos(a)
    d.line([(box0x + x1 * u, box0y + y1 * u), (box0x + x2 * u, box0y + y2 * u)], fill=ACCENT + (255,), width=max(1, int(2.1 * u)), joint='curve')
    img.alpha_composite(layer)


def ring_arc(img, cx, cy, r, width, fill_fraction=0.72):
    """Only the accent arc (no track), for the one-colour layer."""
    d = ImageDraw.Draw(img)
    box = [cx - r, cy - r, cx + r, cy + r]
    start, end = -90, -90 + 360 * fill_fraction
    d.arc(box, start, end, fill=ACCENT + (255,), width=width)
    for ang in (start, end):
        x = cx + (r - width / 2) * math.cos(math.radians(ang))
        y = cy + (r - width / 2) * math.sin(math.radians(ang))
        d.ellipse([x - width / 2, y - width / 2, x + width / 2, y + width / 2], fill=ACCENT + (255,))


def icon(size=1024, background=True, scale=0.62, flat=False):
    n = size * S
    img = Image.new('RGBA', (n, n), GROUND + (255,) if background else (0, 0, 0, 0))
    if background:
        img = Image.alpha_composite(img, glow(n, (int(n * 0.28), int(n * 0.2)), int(n * 0.38), VIOLET, 0.55))
        img = Image.alpha_composite(img, glow(n, (int(n * 0.8), int(n * 0.85)), int(n * 0.42), BLUE, 0.45))
        img = Image.alpha_composite(img, glow(n, (int(n * 0.5), int(n * 0.5)), int(n * 0.3), ACCENT, 0.12))
    mark(img, n // 2, n // 2, n * scale / 0.76, flat)  # scale is the ring's diameter as a fraction of the icon
    return img.resize((size, size), Image.LANCZOS)


def splash(size=1024):
    n = size * S
    img = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    r = int(n * 0.22)
    mark(img, n // 2, int(n * 0.40), 2 * r / 0.76)
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
    mono = icon(1024, background=False, scale=0.5, flat=True)
    alpha = mono.split()[3]
    Image.merge('RGBA', (Image.new('L', mono.size, 255),) * 3 + (alpha,)).save(os.path.join(OUT, 'android-icon-monochrome.png'))
    print('written to', OUT)
