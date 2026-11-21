"""Group 7: changes asked for after review (2026-11-21). The Language setting and an app icon that combines the nettle with the ring.
Requirements: UX-6, UX-7, NF-6, LL-11, EX-3 (language); UX-12 (icon)."""
import math
from lib import *
from group5 import choice_row, hint
from group2 import block

def leaf_path(cx, cy, length, width, teeth=6, rot=0.0):
    """A nettle leaf: heart-shaped base, long pointed tip, forward-leaning teeth on both edges. Base at (cx, cy+length/2), tip at (cx, cy-length/2). Returns an SVG path d."""
    def half(t):  # t 0 at the base, 1 at the tip; widest about a third of the way up
        return width / 2 * math.sin(math.pi * t ** 0.62) ** 1.1
    seq_r, seq_l = [], []
    for side, seq in ((1, seq_r), (-1, seq_l)):
        for i in range(teeth):
            t_valley = 0.10 + 0.80 * i / teeth
            t_tip = 0.10 + 0.80 * (i + 0.7) / teeth
            seq.append((t_valley, half(t_valley) * 0.84 * side))
            seq.append((t_tip, half(t_tip) * 1.05 * side))
    seq = [(0.0, 0.0)] + seq_r + [(1.0, 0.0)] + list(reversed(seq_l))
    a = math.radians(rot)
    out = []
    for t, w in seq:
        x, y = w, length / 2 - t * length
        out.append((cx + x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a)))
    return 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in out) + ' Z'

def vein(cx, cy, length, rot=0.0):
    a = math.radians(rot)
    x1, y1 = cx - (length / 2 - 2) * math.sin(a), cy + (length / 2 - 2) * math.cos(a)
    x2, y2 = cx + length * 0.38 * math.sin(a), cy - length * 0.38 * math.cos(a)
    return f'M{x1:.1f} {y1:.1f} L{x2:.1f} {y2:.1f}'

def ring(r, off_frac, w=5, track=True):
    c = 2 * math.pi * r
    t = f'<circle cx="50" cy="50" r="{r}" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="{w}"/>' if track else ''
    arc = (f'<circle cx="50" cy="50" r="{r}" fill="none" stroke="{{{{accent}}}}" stroke-width="{w}" stroke-linecap="round" '
           f'stroke-dasharray="{c:.1f}" stroke-dashoffset="{c * off_frac:.1f}" transform="rotate(-90 50 50)"/>')
    return t + arc

def leaf(cx, cy, length, width, rot=0, teeth=5, sw=2.6):
    return (f'<path d="{leaf_path(cx, cy, length, width, teeth, rot)}" fill="{{{{accentSoft}}}}" stroke="{{{{accent}}}}" stroke-width="{sw}" stroke-linejoin="round"/>'
            f'<path d="{vein(cx, cy, length, rot)}" fill="none" stroke="{{{{accent}}}}" stroke-width="{sw * 0.8:.1f}" stroke-linecap="round"/>')

def mark(variant, size):
    if variant == 'A':   # a leaf inside the ring
        inner = ring(38, 0.28) + leaf(50, 50, 52, 30, 24, 6)
    elif variant == 'B':  # the leaf sits where the ring's dot was, at the head of the arc
        inner = ring(34, 0.30, 5) + leaf(17.6, 60.5, 30, 17, -18, 4, 2.2)
    else:                 # a sprig with two opposite leaves, in the ring
        inner = (ring(40, 0.22) + '<path d="M50 74 L50 36" stroke="{{accent}}" stroke-width="3" stroke-linecap="round" fill="none"/>'
                 + leaf(36, 54, 32, 19, -58, 4, 2.2) + leaf(64, 54, 32, 19, 58, 4, 2.2) + leaf(50, 28, 24, 14, 0, 4, 2.2))
    return f'<svg width="{size}" height="{size}" viewBox="0 0 100 100" aria-hidden="true">{inner}</svg>'

def tile(variant, size, r):
    return (f'<div role="img" aria-label="Nettle app icon, option {variant}, {size} pixels" style="width: {size}px; height: {size}px; border-radius: {r}px; flex: none; '
            f'background: radial-gradient(circle at 30% 20%, rgba(109,74,224,0.55), transparent 60%), radial-gradient(circle at 75% 80%, rgba(37,99,235,0.45), transparent 60%), #070B12; '
            f'box-shadow: inset 0 0 0 1px rgba(255,255,255,0.14); display: flex; align-items: center; justify-content: center">{mark(variant, int(size * 0.74))}</div>')

def option(v, title, text, recommended=False):
    tag = (f'<span style="height: 24px; padding: 0 10px; border-radius: 999px; background: rgba(94,234,212,0.14); box-shadow: inset 0 0 0 1px @L@; font-size: 12px; font-weight: 700; color: @A@; display: flex; align-items: center">Proposed</span>' if recommended else '')
    return (f'<div style="display: flex; flex-direction: column; gap: 12px; padding: 14px; border-radius: 28px; {GLASS_BLUR}">'
            f'<div style="display: flex; align-items: center; justify-content: space-between"><span style="font-size: 16px; font-weight: 700">{v}. {title}</span>{tag}</div>'
            f'<div style="display: flex; gap: 14px; align-items: flex-end">{tile(v, 112, 26)}<div style="display: flex; gap: 10px; align-items: flex-end">{tile(v, 60, 14)}{tile(v, 40, 9)}{tile(v, 29, 7)}</div></div>'
            f'{body_text(text, SOFT, 13.5)}</div>')

def run():
    body = (content(gap=14) +
            f'<h1 class="ax-r ax-d1" style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.6px">App icon: nettle and ring</h1>'
            + option('A', 'A leaf in the ring', 'One serrated nettle leaf with its vein, inside the ring that is filling. Simplest, still readable at the smallest size.', True)
            + option('B', 'The leaf as the ring’s dot', 'The leaf sits at the top of the ring where the dot was; the ring keeps the lead. Closest to the in-app Today ring, but the leaf is small.')
            + option('C', 'A sprig in the ring', 'A stem with a pair of opposite leaves and a tip leaf, which is how nettle really grows. Most recognisable at large size, busy at 29 px.')
            + '</div>')
    put('G7-AppIcon-Nettle.dc.html', 'App icon: nettle and ring, three options', body, h=1560)
    put('G7-Splash-Nettle.dc.html', 'Splash screen with the proposed icon mark',
        f'<div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px">{mark("A", 130)}<span style="font-size: 34px; font-weight: 800; letter-spacing: -1px">Nettle</span></div>')

    # ---- Language (UX-7, NF-6, LL-11)
    rows = (choice_row('label', 'Device language', 'Follows the iPhone. Now: English', True)
            + choice_row('label', 'English', 'English', False) + choice_row('label', 'Polski', 'Polish', False))
    note = ('<div class="ax-r ax-d3" style="display: flex; flex-direction: column; gap: 8px">' + section_label('What changes')
            + panel(tick_row('The text of the app, at once, without a restart.') + tick_row('The language of AI answers (analysis, estimates, summary).')
                    + tick_row('The default language of a new doctor report. You still choose it for each report.'), gap=8) + '</div>')
    lang = (f'<div class="ax-r ax-d2" style="display: flex; flex-direction: column; gap: 8px">{rows}</div>' + note
            + hint('What you wrote stays as you wrote it. Names of your own areas and items are not translated.'))
    pushed('G7-Language.dc.html', 'Settings: Language', 'Language', 'About', 'Back to Settings', lang, h=900)

TITLE = 'Group 7: Language and app icon'
NEEDS = '''Group 7: Needs approval

1. LANGUAGE setting: Device language (default) / English / Polski, applied at once. Reverses the earlier decision "no in-app language setting". Affects UX-6, UX-7, NF-6, LL-11, EX-3.
2. The Language row is the first row of the About group in Settings (Ref-Settings now has it). Affects UX-6.
3. APP ICON: three nettle-and-ring options; A (a leaf in the ring) is proposed. Pick one and the splash follows. G6-AppIcon and G6-Splash are the first version and can be deleted once you pick. Affects UX-12.'''
