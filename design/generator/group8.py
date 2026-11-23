"""Group 8: changes after the first real use (2026-11-23), from docs/reviews/2026-11-23-first-use-review.md.
The skin check (one entry over all areas), its patch size row, the ring and log, the merged-dot sheet with actions,
a steady Today across days, Edit Today with a grid preview, Review day title and score tables, stool rows with
descriptions, drinks by name, area order, the nail map, and the Polish layout fixes.
Requirements: SK-2, SK-3, SK-6, SK-7, SK-8, SK-10, EN-1, IN-14, UX-2, NF-6, UX-12 (v0.9.8)."""
from lib import *
from group2 import chips, block, time_note, note_field
from group5 import hint, edit_row, list_panel, add_row

UP = '<path d="M6 15l6-6 6 6"/>'
DOWN = '<path d="M6 9l6 6 6-6"/>'
PENCIL = '<path d="M4 20h4L19 9l-4-4L4 16Z" fill="url(#axWash)"/><path d="M13.5 6.5l4 4"/>'
CAMERA = IC['camera']
CORAL_SOFT = 'rgba(255,138,107,0.14)'
CORAL_LINE = 'rgba(255,138,107,0.45)'

# ------------------------------------------------------------------ small parts
def round_btn(icon, label, dis=False, size=44, kind='glass'):
    o = ' disabled aria-disabled="true"' if dis else ''
    op = '; opacity: 0.35' if dis else ''
    bg = GLASS if kind == 'glass' else f'background: {CORAL_SOFT}; box-shadow: inset 0 0 0 1px {CORAL_LINE}'
    st = TEXT if kind == 'glass' else CORAL
    return (f'<button{o} aria-label="{label}" style="width: {size}px; height: {size}px; border-radius: 999px; {bg}{op}; display: flex; align-items: center; justify-content: center; flex: none">'
            f'{svg(icon, 18, st, 2)}</button>')

def badge(n, size=24):
    return (f'<span aria-hidden="true" style="width: {size}px; height: {size}px; border-radius: 999px; background: {CORAL}; color: {ONALERT}; display: flex; align-items: center; justify-content: center; '
            f'font-size: {12 if size < 26 else 13}px; font-weight: 800; font-variant-numeric: tabular-nums; flex: none">{n}</span>')

def mono(text, color=MUTED, size=12.5):
    return f'<span style="font-size: {size}px; color: {color}; font-variant-numeric: tabular-nums">{text}</span>'

# ------------------------------------------------------------------ skin check parts
def strip_chip(label, state, flare=None):
    """state: done (changed), same (no change), skipped, current, pending."""
    fl = badge(flare, 22) if flare else ''
    if state == 'current':
        return (f'<button aria-current="step" aria-label="{label}, now editing" style="flex: none; height: 44px; display: flex; align-items: center; gap: 6px; padding: 0 14px 0 {8 if flare else 14}px; border-radius: 999px; '
                f'background: rgba(255,255,255,0.10); box-shadow: inset 0 0 0 2px @A@, 0 0 22px @S@; font-size: 14.5px; font-weight: 800">{fl}{label}</button>')
    marks = {'done': (svg(IC['check'], 14, '@A@', 2.8), 'changed'), 'same': ('<span style="font-size: 15px; font-weight: 800; color: @A@">=</span>', 'no change'),
             'skipped': (f'<span style="font-size: 15px; font-weight: 800; color: {MUTED}">–</span>', 'skipped'), 'pending': ('', 'to do')}
    m, word = marks[state]
    col = MUTED if state == 'skipped' else (SOFT if state == 'pending' else TEXT)
    ring = 'box-shadow: inset 0 0 0 1.5px rgba(255,255,255,0.22)' if state == 'pending' else 'background: rgba(255,255,255,0.07); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12)'
    return (f'<button aria-label="{label}, {word}" style="flex: none; height: 44px; display: flex; align-items: center; gap: 6px; padding: 0 14px 0 {8 if (m or flare) else 14}px; border-radius: 999px; {ring}; '
            f'font-size: 14.5px; font-weight: 600; color: {col}">{fl}{m}{label}</button>')

def strip(items):
    chips_ = ''.join(strip_chip(*i) for i in items)
    return (f'<nav aria-label="Areas of this check" class="ax-r ax-d1" style="display: flex; gap: 8px; overflow: hidden; margin: 0 -20px; padding: 2px 20px; '
            f'-webkit-mask-image: linear-gradient(to right, #000 85%, transparent); mask-image: linear-gradient(to right, #000 85%, transparent)">{chips_}</nav>')

def step_head(area, kind, last, flare=None):
    fl = ''
    if flare:
        fl = (f'<span style="display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px 0 4px; border-radius: 999px; background: {CORAL_SOFT}; box-shadow: inset 0 0 0 1px {CORAL_LINE}; '
              f'font-size: 13px; font-weight: 700; color: {CORAL}">{badge(flare[0], 22)}Flare since {flare[1]}</span>')
    return (f'<div class="ax-r ax-d1" style="display: flex; flex-direction: column; gap: 6px">'
            f'<div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap"><h2 style="margin: 0; font-size: 30px; line-height: 34px; font-weight: 800; letter-spacing: -0.8px">{area}</h2>{fl}</div>'
            f'<span style="font-size: 13.5px; color: {MUTED}">{kind} · {last}</span></div>')

def size_row(value=None):
    if value is None:
        right = (f'<button aria-label="Set the patch size" style="height: 44px; padding: 0 16px; border-radius: 999px; box-shadow: inset 0 0 0 1.5px @L@; color: @A@; font-size: 14.5px; font-weight: 700; '
                 f'display: flex; align-items: center; gap: 6px">{svg(IC["plus"], 15, "@A@", 2.6)}Set</button>')
        return (f'<div role="group" aria-label="Patch size" style="display: flex; align-items: center; gap: 12px; padding: 10px 10px 10px 16px">'
                f'<span style="flex: 1; min-width: 0"><span style="display: block; font-size: 15.5px; font-weight: 600">Patch size</span>'
                f'<span style="display: block; font-size: 12.5px; line-height: 17px; color: {MUTED}">Largest diameter of the patch. Not set</span></span>{right}</div>')
    step = lambda sym, lab: (f'<button aria-label="{lab} patch size" style="width: 36px; height: 36px; border-radius: 999px; {GLASS}; display: flex; align-items: center; justify-content: center; flex: none">'
                             f'{svg(IC["plus"] if sym == "+" else R["MINUS"], 16, TEXT, 2.4)}</button>')
    return (f'<div role="group" aria-label="Patch size" style="display: flex; flex-direction: column; gap: 8px; padding: 10px 10px 12px 16px">'
            f'<div style="display: flex; align-items: center; gap: 8px"><span style="flex: 1; min-width: 0"><span style="display: block; font-size: 15.5px; font-weight: 600">Patch size</span>'
            f'<span style="display: block; font-size: 12.5px; line-height: 17px; color: {MUTED}">Largest diameter of the patch</span></span>'
            f'<button aria-label="Clear the patch size" style="width: 36px; height: 36px; border-radius: 999px; display: flex; align-items: center; justify-content: center; opacity: 0.7">{svg(IC["x"], 15, TEXT, 2.2)}</button></div>'
            f'<div style="display: flex; align-items: center; gap: 12px">{step("-", "Decrease")}'
            f'<button aria-label="Type the patch size, {value} millimetres" style="flex: 1; height: 44px; border-radius: 999px; background: rgba(255,255,255,0.05); display: flex; align-items: baseline; justify-content: center; gap: 4px">'
            f'<span style="font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums">{value}</span><span style="font-size: 14px; color: {MUTED}">mm</span></button>{step("+", "Increase")}</div></div>')

def extras_card(cracks=False, size=None, cls='ax-r ax-d3'):
    sw_ = R['switch'](cracks)
    tog = (f'<button role="switch" aria-checked="{"true" if cracks else "false"}" style="display: flex; align-items: center; gap: 12px; padding: 12px 14px 12px 16px">'
           f'<span style="flex: 1; min-width: 0; text-align: left"><span style="display: block; font-size: 15.5px; font-weight: 600">Cracks or open wounds</span></span>{sw_}</button>')
    return (f'<div class="{cls}" style="display: flex; flex-direction: column; border-radius: 26px; {GLASS}">{tog}{hair()}{size_row(size)}</div>')

def photos_block(times=('14:12',), label='Photos', right='stay on this phone'):
    add = (f'<button aria-label="Add a photo" style="width: 76px; height: 76px; border-radius: 22px; border: 1.5px dashed rgba(255,255,255,0.34); box-sizing: border-box; display: flex; flex-direction: column; '
           f'align-items: center; justify-content: center; gap: 4px; font-size: 12px; font-weight: 600; color: @A@">{svg(CAMERA, 22, "@A@", 1.8)}Add</button>')
    return block(label, f'<div style="display: flex; gap: 10px">{add}{"".join(R["photo"](t) for t in times)}</div>', f'<span style="font-size: 13px; color: {MUTED}">{right}</span>', cls='ax-r ax-d4')

def note_only():
    return f'<div class="ax-r ax-d4" style="display: flex">{note_field()}</div>'

def scores(vals):
    names = ['Severity', 'Itch', 'Pain', 'Dryness', 'Scaling']
    rows = ''.join(score_row(n, v) for n, v in zip(names, vals))
    return (f'<div class="ax-r ax-d2" style="display: flex; align-items: baseline; justify-content: space-between; padding: 0 4px; margin-bottom: -8px">'
            f'<span style="font-size: 13px; color: {MUTED}">Started from the last entry</span><span style="font-size: 13px; color: {MUTED}">0 none · 10 worst</span></div>'
            f'<div class="ax-r ax-d2" style="display: flex; flex-direction: column; gap: 8px">{rows}</div>')

def step_bar(no_change=True, skip='Skip', next_label='Next', skip_note=None):
    nc = (f'<button style="flex: 1; min-width: 0; height: 56px; border-radius: 999px; box-shadow: inset 0 0 0 1.5px @L@; color: @A@; font-size: 15.5px; font-weight: 700; background: rgba(13,19,29,0.86); '
          f'backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); display: flex; align-items: center; justify-content: center; gap: 6px">{svg(IC["check"], 17, "@A@", 2.4)}No change</button>' if no_change else '')
    sk = (f'<button style="flex: {"1" if no_change else "1.2"}; min-width: 0; height: 56px; border-radius: 999px; {GLASS}; background: rgba(30,38,52,0.86); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); '
          f'font-size: 15.5px; font-weight: 600">{skip}</button>')
    nx = (f'<button style="flex: 1.25; min-width: 0; height: 56px; border-radius: 999px; background: @A@; color: {ONACC}; font-size: 16.5px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 6px; '
          f'box-shadow: 0 14px 34px rgba(0,0,0,0.45), 0 0 30px @S@">{next_label}{svg(IC["chev"], 18, ONACC, 2.6)}</button>')
    note = f'<span style="font-size: 13px; color: {CORAL}; text-align: center">{skip_note}</span>' if skip_note else ''
    return (f'<div class="ax-r ax-d5" style="position: absolute; left: 16px; right: 16px; bottom: 24px; display: flex; flex-direction: column; gap: 8px">{note}'
            f'<div style="display: flex; gap: 8px">{nc}{sk}{nx}</div></div>')

def check_form(name, title, header, body, bar, h=1500):
    put(name, title, modal_top(header) + body + '<div aria-hidden="true" style="height: 90px"></div>' + bar + MODAL_END, h=h)

STRIP_STEP2 = [('Chin', 'done'), ('Neck', 'current'), ('Ears, inside', 'pending'), ('Behind the ears', 'pending'), ('Sternum', 'pending'), ('Left elbow', 'pending')]

# ------------------------------------------------------------------ score table
def score_table(rows, first='Area', state=True, legend=True, thresh=None):
    """rows: (label, [5 values or None], mark, extra). mark: changed|same|skipped|''; extra: small text under the label."""
    hd = ''.join(f'<span style="text-align: center">{h}</span>' for h in ['Sev', 'Itch', 'Pain', 'Dry', 'Scal'])
    cols = 'minmax(0, 1fr) repeat(5, 34px)' + (' 26px' if state else '')
    head = (f'<div aria-hidden="true" style="display: grid; grid-template-columns: {cols}; gap: 4px; padding: 0 12px 6px 14px; font-size: 11.5px; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase; color: {MUTED}">'
            f'<span>{first}</span>{hd}{"<span></span>" if state else ""}</div>')
    body = ''
    for i, (label, vals, mark, extra) in enumerate(rows):
        cells = ''
        for j, v in enumerate(vals):
            if v is None:
                cells += f'<span style="text-align: center; color: {MUTED}">–</span>'
            elif j == 0 and thresh is not None and v >= thresh:
                cells += (f'<span style="display: flex; justify-content: center"><span style="width: 26px; height: 26px; border-radius: 999px; background: {CORAL}; color: {ONALERT}; display: flex; align-items: center; justify-content: center; font-weight: 800">{v}</span></span>')
            else:
                cells += f'<span style="text-align: center; font-weight: {"800" if j == 0 else "600"}">{v}</span>'
        m = {'changed': svg(IC['check'], 15, '@A@', 2.8), 'same': '<span style="color: @A@; font-weight: 800">=</span>', 'skipped': f'<span style="color: {MUTED}; font-weight: 800">–</span>', '': ''}[mark]
        ex = f'<span style="display: block; font-size: 11.5px; line-height: 15px; color: {MUTED}; font-weight: 500">{extra}</span>' if extra else ''
        border = '' if i == len(rows) - 1 else 'border-bottom: 1px solid rgba(255,255,255,0.07); '
        state_cell = f'<span style="display: flex; justify-content: center">{m}</span>' if state else ''
        body += (f'<button aria-label="{label}" style="display: grid; grid-template-columns: {cols}; gap: 4px; align-items: center; min-height: 48px; padding: 6px 12px 6px 14px; {border}font-size: 15px; font-variant-numeric: tabular-nums; text-align: left">'
                 f'<span style="min-width: 0"><span style="display: block; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{label}</span>{ex}</span>{cells}{state_cell}</button>')
    lg = (f'<span style="font-size: 12px; line-height: 16px; color: {MUTED}; padding: 8px 14px 4px 14px">Sev severity · Itch · Pain · Dry dryness · Scal scaling · 0 none, 10 worst</span>' if legend else '')
    return f'<div style="display: flex; flex-direction: column; padding: 10px 0 6px 0; border-radius: 28px; {GLASS_BLUR}">{head}{body}{lg}</div>'

# ------------------------------------------------------------------ nail map
STAGE = {'red': ('#FF8A6B', 'Red or dark edge'), 'sep': ('#C4B5FD', 'Separation'), 'yel': ('#E8C468', 'Yellow'), 'white': ('#E6EAF0', 'White'), 'clear': ('#5EEAD4', 'Clear')}
HAND = ['Thumb', 'Index', 'Middle', 'Ring', 'Little']
FOOT = ['Big toe', '2nd', '3rd', '4th', 'Little']

def nail_tile(row, digit, stage=None, photos=0, selected=False, small=False):
    w, hgt = (56, 60) if not small else (44, 48)
    if stage:
        c, sname = STAGE[stage]
        shape = (f'<span aria-hidden="true" style="width: 26px; height: 30px; border-radius: 13px 13px 8px 8px; background: {c}; opacity: 0.9; box-shadow: 0 0 14px {c}55"></span>')
        tile_bg = 'background: rgba(255,255,255,0.08); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.16)'
        lab_col = TEXT
        aria = f'{row}, {digit}: {sname}' + (f', {photos} photos' if photos else '')
    else:
        shape = '<span aria-hidden="true" style="width: 26px; height: 30px; border-radius: 13px 13px 8px 8px; box-sizing: border-box; border: 1.5px dashed rgba(255,255,255,0.30)"></span>'
        tile_bg = 'background: rgba(255,255,255,0.03)'
        lab_col = MUTED
        aria = f'{row}, {digit}: not tracked'
    if selected:
        tile_bg = 'background: rgba(255,255,255,0.10); box-shadow: inset 0 0 0 2px @A@, 0 0 22px @S@'
    dot = (f'<span aria-hidden="true" style="position: absolute; right: 5px; top: 5px; width: 16px; height: 16px; border-radius: 999px; background: #0E141E; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.3); '
           f'display: flex; align-items: center; justify-content: center">{svg(CAMERA, 10, TEXT, 2.2)}</span>' if photos else '')
    return (f'<button aria-label="{aria}" style="position: relative; flex: 1; min-width: 0; height: {hgt + 22}px; border-radius: 20px; {tile_bg}; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px">'
            f'{dot}{shape}<span style="font-size: 11.5px; font-weight: 600; color: {lab_col}; white-space: nowrap">{digit}</span></button>')

def nail_row(row, digits, states, selected=None):
    tiles = ''.join(nail_tile(row, d, *(states.get(d, (None, 0))), selected=(d == selected)) for d in digits)
    return (f'<div role="group" aria-label="{row}" style="display: flex; flex-direction: column; gap: 6px">'
            f'<span style="font-size: 12.5px; font-weight: 600; letter-spacing: 1.2px; text-transform: uppercase; color: {MUTED}; padding-left: 4px">{row}</span>'
            f'<div style="display: flex; gap: 6px">{tiles}</div></div>')

def nail_map(lh=None, rh=None, lf=None, rf=None, sel=None, cls='ax-r ax-d2'):
    """Rows read as you look down at the backs of your hands and the tops of your feet: left side shows little to thumb, right side thumb to little."""
    lh, rh, lf, rf = lh or {}, rh or {}, lf or {}, rf or {}
    s = sel or (None, None)
    rows = (nail_row('Left hand', list(reversed(HAND)), lh, s[1] if s[0] == 'Left hand' else None)
            + nail_row('Right hand', HAND, rh, s[1] if s[0] == 'Right hand' else None)
            + nail_row('Left foot', list(reversed(FOOT)), lf, s[1] if s[0] == 'Left foot' else None)
            + nail_row('Right foot', FOOT, rf, s[1] if s[0] == 'Right foot' else None))
    legend = ''.join(f'<span style="display: flex; align-items: center; gap: 5px"><span style="width: 10px; height: 12px; border-radius: 5px 5px 3px 3px; background: {c}"></span>{n}</span>' for c, n in STAGE.values())
    legend += f'<span style="display: flex; align-items: center; gap: 5px"><span style="width: 10px; height: 12px; border-radius: 5px 5px 3px 3px; box-sizing: border-box; border: 1.5px dashed rgba(255,255,255,0.4)"></span>Not tracked</span>'
    return (f'<div class="{cls}" style="display: flex; flex-direction: column; gap: 12px; padding: 14px 12px; border-radius: 30px; {GLASS_BLUR}">{rows}'
            f'<div style="display: flex; flex-wrap: wrap; gap: 6px 12px; font-size: 12px; color: {SOFT}; padding: 4px 4px 0 4px">{legend}</div></div>')

MAP_STATES = dict(lh={'Thumb': ('sep', 2), 'Index': ('clear', 0)}, rh={'Thumb': ('yel', 1)}, lf={}, rf={'Big toe': ('white', 0)})

# ------------------------------------------------------------------ boards
def run():
    # ======================================================== 1. skin check: step 2 of 8
    body = (strip(STRIP_STEP2) + step_head('Neck', 'Skin', 'Last: yesterday 21:40 · severity 6') + scores([6, 5, 2, 6, 4])
            + extras_card(False, None) + photos_block(()) + note_only())
    check_form('G8-SkinCheck-Step.dc.html', 'Skin check: one area per step', 'Skin · Neck  2/8', body, step_bar(), h=1500)

    # ======================================================== 2. first step, with "No change for all areas"
    first_strip = [('Chin', 'current'), ('Neck', 'pending'), ('Ears, inside', 'pending'), ('Behind the ears', 'pending'), ('Sternum', 'pending'), ('Left elbow', 'pending')]
    all_btn = (f'<div class="ax-r ax-d1" style="display: flex; flex-direction: column; gap: 6px">{btn("No change for all areas", "outline", "check", full=True, h=52)}'
               f'{hint("Marks every area that has an earlier entry and goes to the summary. One area has no earlier entry yet and stays to do.")}</div>')
    body = (strip(first_strip) + all_btn + step_head('Chin', 'Skin', 'Last: yesterday 21:38 · severity 5') + scores([5, 4, 1, 5, 3])
            + extras_card(True, 18) + photos_block(()) + note_only())
    check_form('G8-SkinCheck-First.dc.html', 'Skin check: first step', 'Skin · Chin  1/8', body, step_bar(), h=1640)

    # ======================================================== 3. an area in flare
    fl_strip = [('Chin', 'done'), ('Neck', 'same'), ('Ears, inside', 'current', 8), ('Behind the ears', 'pending'), ('Sternum', 'pending'), ('Left elbow', 'pending')]
    body = (strip(fl_strip) + step_head('Ears, inside', 'Skin', 'Last: yesterday 21:41 · severity 8', flare=(8, '12 Nov'))
            + scores([8, 7, 3, 7, 6]) + extras_card(True, None) + photos_block(('yesterday',)) + note_only())
    check_form('G8-SkinCheck-Flare.dc.html', 'Skin check: an area in flare', 'Skin · Ears, inside  3/8', body,
               step_bar(skip='Skip', skip_note='Skip leaves the flare open since 12 Nov. No change records that it goes on.'), h=1560)

    # ======================================================== 4. an area with no earlier entry
    new_strip = [('Sternum', 'same'), ('Left elbow', 'current'), ('Left thumb', 'pending'), ('Right big toe', 'pending')]
    body = (strip(new_strip) + step_head('Left elbow', 'Skin', 'First entry for this area')
            + (f'<div class="ax-r ax-d2" style="display: flex; justify-content: flex-end; padding: 0 4px; margin-bottom: -8px"><span style="font-size: 13px; color: {MUTED}">0 none · 10 worst</span></div>'
               f'<div class="ax-r ax-d2" style="display: flex; flex-direction: column; gap: 8px">{score_row("Severity", 0)}{score_row("Itch", 0)}{score_row("Pain", 0)}{score_row("Dryness", 0)}{score_row("Scaling", 0)}</div>')
            + extras_card(False, None) + photos_block(()) + note_only())
    check_form('G8-SkinCheck-NewArea.dc.html', 'Skin check: an area without an earlier entry', 'Skin · Left elbow  6/8', body, step_bar(no_change=False), h=1500)

    # ======================================================== 5. a nail step
    nail_strip = [('Left elbow', 'done'), ('Left thumb', 'current'), ('Right big toe', 'pending')]
    stage = chips([chip('Red or dark edge'), chip('Separation', 'on'), chip('Yellow'), chip('White'), chip('Clear')])
    extent = chips([chip('None'), chip('Under a quarter'), chip('Up to half', 'on'), chip('More than half')])
    body = (strip(nail_strip) + step_head('Left thumb', 'Nail', 'Last: 16 Nov · separation, up to half')
            + block('Stage', stage) + block('How much of the nail', extent)
            + photos_block(('16 Nov',), 'Close-up photos', 'one nail per photo') + note_only())
    check_form('G8-SkinCheck-Nail.dc.html', 'Skin check: a nail step', 'Skin · Left thumb  7/8', body, step_bar(), h=1160)

    # ======================================================== 6. summary
    rows = [('Chin', [5, 4, 1, 5, 3], 'changed', 'cracks · 18 mm'), ('Neck', [6, 5, 2, 6, 4], 'same', ''), ('Ears, inside', [8, 7, 3, 7, 6], 'changed', '1 photo'),
            ('Behind the ears', [3, 2, 0, 3, 2], 'same', ''), ('Sternum', [None] * 5, 'skipped', 'not logged'), ('Left elbow', [2, 3, 0, 2, 1], 'changed', 'first entry')]
    nails_sum = panel(
        f'<div style="display: flex; align-items: center; gap: 10px"><span style="flex: 1; font-size: 15px; font-weight: 600">Left thumb</span><span style="font-size: 13.5px; color: {SOFT}">Separation · up to half</span><span style="color: @A@; font-weight: 800">=</span></div>'
        + hair() + f'<div style="display: flex; align-items: center; gap: 10px"><span style="flex: 1; font-size: 15px; font-weight: 600">Right big toe</span><span style="font-size: 13.5px; color: {MUTED}">not logged</span><span style="color: {MUTED}; font-weight: 800">–</span></div>', pad='12px 16px', gap=10)
    not_logged = (f'<div class="ax-r ax-d3" style="display: flex; align-items: center; gap: 12px; padding: 12px 12px 12px 16px; border-radius: 26px; background: rgba(255,255,255,0.05); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.10)">'
                  f'<span style="flex: 1; min-width: 0; font-size: 14px; line-height: 19px; color: {SOFT}">Not logged: Sternum, Right big toe</span>{btn("No change for these", "outline", h=44, extra="; flex: none; padding: 0 14px")}</div>')
    body = (strip([('Chin', 'done'), ('Neck', 'same'), ('Ears, inside', 'done', 8), ('Behind the ears', 'same'), ('Sternum', 'skipped'), ('Left elbow', 'done'), ('Left thumb', 'same'), ('Right big toe', 'skipped')])
            + f'<div class="ax-r ax-d1" style="display: flex; flex-direction: column; gap: 4px"><h2 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.6px">Check this check</h2>'
              f'{hint("Tap a row to go back to that area. Everything is saved together, at one time.")}</div>'
            + f'<div class="ax-r ax-d2" style="display: flex; flex-direction: column; gap: 8px">{section_label("Skin", cnt("5 of 6 logged"))}{score_table(rows, thresh=8)}</div>'
            + f'<div class="ax-r ax-d2" style="display: flex; flex-direction: column; gap: 8px">{section_label("Nails", cnt("1 of 2 logged"))}{nails_sum}</div>'
            + not_logged + time_note())
    put('G8-SkinCheck-Summary.dc.html', 'Skin check: summary and Save', modal_top('Skin · Summary') + body + '<div aria-hidden="true" style="height: 90px"></div>' + save_bar('Save skin check') + MODAL_END, h=1240)

    # ======================================================== 7. editing a saved check
    erows = [('Chin', [5, 4, 1, 5, 3], '', 'cracks · 18 mm'), ('Neck', [6, 5, 2, 6, 4], '', ''), ('Ears, inside', [8, 7, 3, 7, 6], '', '1 photo'),
             ('Behind the ears', [3, 2, 0, 3, 2], '', ''), ('Left elbow', [2, 3, 0, 2, 1], '', '')]
    body = (f'<div class="ax-r ax-d1" style="display: flex; flex-direction: column; gap: 4px"><h2 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.6px">Skin check, 21:40</h2>'
            f'{hint("Tap an area to change it. Removing an area deletes only that area’s entry.")}</div>'
            + f'<div class="ax-r ax-d2" style="display: flex; flex-direction: column; gap: 8px">{section_label("Logged", cnt("5 skin · 1 nail"))}{score_table(erows, state=False, thresh=8)}</div>'
            + block('Not in this check', chips([add_chip('Sternum'), add_chip('Right big toe')]), cls='ax-r ax-d3')
            + time_note('Thu 19 Nov · 21:40')
            + f'<div class="ax-r ax-d4">{btn("Delete this check", "danger", "trash", full=True, h=52)}</div>')
    put('G8-SkinCheck-Edit.dc.html', 'Skin check: editing a saved check', modal_top('Edit skin check') + body + '<div aria-hidden="true" style="height: 90px"></div>' + save_bar('Save changes') + MODAL_END, h=1060)

    # ======================================================== 8. cracks and patch size, three states
    states = (f'<div class="ax-r ax-d1">{hint("No Details button: both rows are always there, under the five scores. The size is of the whole patch, not of a wound.")}</div>'
              + f'<div style="display: flex; flex-direction: column; gap: 8px">{section_label("Not set")}{extras_card(False, None, "ax-r ax-d2")}</div>'
              + f'<div style="display: flex; flex-direction: column; gap: 8px">{section_label("Cracks on, size set")}{extras_card(True, 18, "ax-r ax-d3")}</div>'
              + f'<div style="display: flex; flex-direction: column; gap: 8px">{section_label("Typing a size")}'
              + f'<div class="ax-r ax-d4" style="display: flex; flex-direction: column; border-radius: 26px; {GLASS}">'
              + f'<div style="padding: 10px 10px 12px 16px; display: flex; flex-direction: column; gap: 8px"><span style="font-size: 15.5px; font-weight: 600">Patch size</span>'
              + field('sizeMm', 'Patch size in mm', 'mm', '18', focus=True, suffix='mm', h=52, inputmode='numeric')
              + f'<span style="font-size: 12.5px; color: {MUTED}">Whole millimetres, 1 to 500. Done closes the keypad.</span></div></div></div>')
    put('G8-SkinExtras-States.dc.html', 'Skin: cracks and patch size, three states', modal_top('Skin · Chin  1/8') + states + MODAL_END, h=900)

    # ======================================================== 9. Today with a skin check (one dot, one row)
    rows_t = [log_row('skin', 'Skin check · 6 areas', 'worst: Ears, inside 8 · 1 skipped', '21:40', new=True), log_row('health', 'Daily health', 'Wellbeing 6 · Stress 4', '21:30'),
              log_row('meal', 'Rice with vegetables', '', '19:10')]
    today('G8-Today-SkinCheck.dc.html', 'Today: a skin check is one dot and one row',
          dots=[ring_dot('out', 7.5, 'filled', 'Oatmeal, 07:30'), ring_dot('out', 19.2, 'filled', 'Rice with vegetables, 19:10'), ring_dot('in', 21.0, 'hollow', 'Daily health, 21:30'),
                ring_dot('in', 21.7, 'care', 'Skin check, 6 areas, 21:40')],
          arc=21.8, count='4 entries · 21:48', pills=[pill('Ears, inside: severity 8 since 12 Nov', 'flare', 8)], rows=rows_t, log_n='4 entries')

    # ======================================================== 10. the action sheet of a check
    scrim = '<div aria-hidden="true" style="position: absolute; inset: 0; background: rgba(3,6,10,0.55)"></div>'
    acts = btn('Edit', 'glass', None, full=True, h=56, extra='; font-size: 17px') + btn('Delete', 'danger', None, full=True, h=56, extra='; font-size: 17px')
    today('G8-Sheet-SkinCheck.dc.html', 'A skin check: Edit or Delete',
          dots=[ring_dot('out', 7.5, 'filled', 'Oatmeal, 07:30'), ring_dot('in', 21.7, 'care', 'Skin check, 21:40')],
          arc=21.8, count='4 entries · 21:48', rows=rows_t, log_n='4 entries',
          overlay=scrim + action_sheet('Skin check, 21:40', '6 areas and 1 nail. Deleting also deletes 1 photo.', acts))

    # ======================================================== 11. merged dot: Edit and Delete on each row
    def mrow(icon, title, detail, time):
        d = f'<span style="display: block; font-size: 13px; color: {MUTED}">{detail}</span>' if detail else ''
        return (f'<div style="display: flex; align-items: center; gap: 10px; padding: 8px 8px 8px 8px; min-height: 60px; border-radius: 30px; background: rgba(255,255,255,0.06); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.10)">'
                f'{icon_circle(icon, 40, 24)}<span style="flex: 1; min-width: 0"><span style="display: block; font-size: 15.5px; font-weight: 600">{title}</span>'
                f'<span style="display: block; font-size: 13px; color: {MUTED}; font-variant-numeric: tabular-nums">{time}{" · " + detail if detail else ""}</span></span>'
                f'{round_btn(PENCIL, "Edit " + title)}{round_btn(IC["trash"], "Delete " + title, kind="danger")}</div>')
    m_rows = mrow('meal', 'Almonds', '', '13:05') + mrow('drink', 'Rooibos tea, 250 ml', '', '12:55') + mrow('meal', 'Chicken salad', 'egg, mustard', '12:40')
    base_dots = [ring_dot('out', 12.9, 'filled', '3 entries around 12:50', count=3), ring_dot('in', 9.2, 'hollow', 'Emollient, 09:10')]
    base_rows = [log_row('meal', 'Almonds', '', '13:05'), log_row('drink', 'Rooibos tea, 250 ml', '', '12:55')]
    today('G8-Sheet-MergedDot-Actions.dc.html', 'Merged dot: Edit and Delete on each row', dots=base_dots, count='4 entries · 14:20', rows=base_rows, log_n='4 entries',
          overlay=scrim + sheet('Around 12:50', '3 entries close together', f'<div style="display: flex; flex-direction: column; gap: 8px">{m_rows}</div>'))

    # ======================================================== 12. merged dot: delete asks inside the sheet
    confirm = (f'<div role="alertdialog" aria-label="Delete Chicken salad?" style="display: flex; flex-direction: column; gap: 10px; padding: 12px 12px 12px 16px; border-radius: 28px; background: {CORAL_SOFT}; box-shadow: inset 0 0 0 1.5px {CORAL_LINE}">'
               f'<span style="font-size: 15px; font-weight: 700">Delete Chicken salad, 12:40?</span><span style="font-size: 13.5px; line-height: 19px; color: {SOFT}">Also deletes 1 reaction logged after it.</span>'
               f'<div style="display: flex; gap: 8px">{btn("Keep", "glass", extra="; flex: 1")}{btn("Delete", "dangerSolid", "trash", extra="; flex: 1")}</div></div>')
    m_rows2 = mrow('meal', 'Almonds', '', '13:05') + mrow('drink', 'Rooibos tea, 250 ml', '', '12:55') + confirm
    today('G8-Sheet-MergedDot-Confirm.dc.html', 'Merged dot: Delete asks inside the sheet', dots=base_dots, count='4 entries · 14:20', rows=base_rows, log_n='4 entries',
          overlay=scrim + sheet('Around 12:50', '3 entries close together', f'<div style="display: flex; flex-direction: column; gap: 8px">{m_rows2}</div>'))

    # ======================================================== 13. a past day, nothing moves
    back_chip = (f'<button aria-label="Back to Today" style="position: absolute; left: 20px; top: 54px; z-index: 2; height: 44px; display: flex; align-items: center; gap: 6px; padding: 0 16px 0 10px; border-radius: 999px; '
                 f'{GLASS_BLUR}; box-shadow: inset 0 0 0 1.5px @L@; color: @A@; font-size: 14.5px; font-weight: 700">{svg(IC["back"], 18, "@A@", 2.2)}Today</button>')
    today('G8-Today-PastDay-Steady.dc.html', 'A past day: Back to Today in the top bar, a day status pill',
          dots=[ring_dot('out', 7.5, 'filled', 'Oatmeal, 07:30'), ring_dot('out', 12.7, 'filled', 'Chicken salad, 12:40'), ring_dot('in', 21.6, 'care', 'Skin check, 21:40'), ring_dot('in', 21.0, 'hollow', 'Daily health, 21:30')],
          arc=None, weekday='Thursday', date='19 Nov', count='5 entries', past=True,
          pills=[pill(svg(IC['check'], 16, '@A@', 2.6) + 'Daily health saved')],
          rows=[log_row('skin', 'Skin check · 6 areas', 'worst: Ears, inside 8', '21:40'), log_row('health', 'Daily health', 'Wellbeing 6 · Stress 4', '21:30'), log_row('meal', 'Chicken salad', 'egg, mustard', '12:40')],
          log_n='5 entries', overlay=back_chip)
    today('G8-Today-PastDay-NotLogged.dc.html', 'A past day without Daily health',
          dots=[ring_dot('out', 8.0, 'filled', 'Toast, 08:00'), ring_dot('out', 13.2, 'filled', 'Soup, 13:10')],
          arc=None, weekday='Wednesday', date='18 Nov', count='2 entries', past=True,
          pills=[pill('Day not fully logged · add Daily health')],
          rows=[log_row('meal', 'Soup', 'carrot, potato', '13:10'), log_row('meal', 'Toast', 'bread, butter', '08:00')], log_n='2 entries', overlay=back_chip)

    # ======================================================== 14. Edit Today with a live preview
    def mini(icon, label, n=None, more=False):
        num = (f'<span aria-hidden="true" style="position: absolute; left: 50%; top: -4px; margin-left: 12px; width: 20px; height: 20px; border-radius: 999px; background: @A@; color: {ONACC}; font-size: 11.5px; font-weight: 800; display: flex; align-items: center; justify-content: center">{n}</span>' if n else '')
        circ = ('box-shadow: inset 0 0 0 1.5px rgba(255,255,255,0.18)' if more else 'background: rgba(255,255,255,0.08); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.14)')
        ic = ('<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="#F2F5F9"><circle cx="6" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18" cy="12" r="1.7"/></svg>' if more else svg(IC[icon], 20))
        return (f'<span style="position: relative; display: flex; flex-direction: column; align-items: center; gap: 4px"><span style="width: 44px; height: 44px; border-radius: 999px; {circ}; display: flex; align-items: center; justify-content: center">{ic}</span>{num}'
                f'<span style="font-size: 12px; font-weight: 500; color: {MUTED if more else SOFT}">{label}</span></span>')
    preview = (f'<div class="ax-r ax-d2" role="img" aria-label="Preview of Today: 1 Meal, 2 Skin, 3 Daily health, 4 Treatment, 5 Stool, then More" style="display: flex; flex-direction: column; gap: 10px; padding: 14px; border-radius: 30px; {GLASS_BLUR}">'
               f'{section_label("Preview of Today", cnt("updates as you edit"))}'
               f'<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); row-gap: 12px; padding: 4px 8px">'
               f'{mini("meal", "Meal", 1)}{mini("skin", "Skin", 2)}{mini("health", "Daily health", 3)}{mini("treatment", "Treatment", 4)}{mini("stool", "Stool", 5)}{mini("", "More", more=True)}</div></div>')
    def prow(n, icon, title, first=False, last=False, moved=False):
        ring = 'box-shadow: inset 0 0 0 1.5px @A@, 0 0 22px @S@; background: rgba(255,255,255,0.08)' if moved else GLASS_BLUR
        return (f'<div style="display: flex; align-items: center; gap: 8px; padding: 8px 8px 8px 10px; border-radius: 999px; {ring}">'
                f'<span aria-hidden="true" style="width: 24px; height: 24px; border-radius: 999px; background: @A@; color: {ONACC}; font-size: 12.5px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex: none">{n}</span>'
                f'{icon_circle(icon, 36, 20)}<span style="flex: 1; min-width: 0; font-size: 15.5px; font-weight: 600">{title}</span>'
                f'{round_btn(UP, "Move up " + title, first)}{round_btn(DOWN, "Move down " + title, last)}{round_btn(IC["x"], "Move " + title + " to More")}</div>')
    pinned = (prow(1, 'meal', 'Meal', first=True) + prow(2, 'skin', 'Skin') + prow(3, 'health', 'Daily health', moved=True) + prow(4, 'treatment', 'Treatment') + prow(5, 'stool', 'Stool', last=True))
    def morow(icon, title, sub, first=False, last=False):
        return (f'<div style="display: flex; align-items: center; gap: 8px; padding: 8px 8px 8px 10px; border-radius: 30px; {GLASS_BLUR}">{icon_circle(icon, 36, 20)}'
                f'<span style="flex: 1; min-width: 0"><span style="display: block; font-size: 15.5px; font-weight: 600">{title}</span><span style="display: block; font-size: 12.5px; color: {MUTED}">{sub}</span></span>'
                f'{round_btn(UP, "Move up " + title, first)}{round_btn(DOWN, "Move down " + title, last)}'
                f'<button disabled aria-disabled="true" aria-label="Pin {title}, Today is full" style="height: 44px; padding: 0 12px; border-radius: 999px; background: rgba(255,255,255,0.07); color: rgba(242,245,249,0.38); font-size: 14px; font-weight: 600; flex: none">Pin</button></div>')
    in_more = (morow('drink', 'Drink', 'Any drink', first=True) + morow('medication', 'Medication', 'A medicine or supplement') + morow('nails', 'Nails', 'Stage and photos of a nail')
               + morow('reaction', 'Reaction', 'Symptoms after a meal') + morow('change', 'Routine change', 'Started or stopped') + morow('medical', 'Medical event', 'Visit, result, illness', last=True))
    body = (preview + f'<div class="ax-r ax-d3" style="display: flex; flex-direction: column; gap: 8px">{section_label("On Today", cnt("5 of 5"))}{pinned}</div>'
            + f'<div class="ax-r ax-d4" style="display: flex; flex-direction: column; gap: 8px">{section_label("In More", cnt("this order in More"))}{in_more}'
            + hint('Today is full: move one to More to pin another. A type you move to More goes to the end of this list.') + '</div>')
    pushed('G8-EditToday-Preview.dc.html', 'Edit Today: live preview, numbered pins, sortable More', 'Edit Today', 'Choose what sits on Today', 'Back to More', body, h=1500)

    # ======================================================== 15. Review: a day, with the date as title
    day_rows = [('Chin', [5, 4, 1, 5, 3], '', 'cracks · 18 mm'), ('Neck', [6, 5, 2, 6, 4], '', ''), ('Ears, inside', [8, 7, 3, 7, 6], '', '1 photo'), ('Behind the ears', [3, 2, 0, 3, 2], '', ''), ('Left elbow', [2, 3, 0, 2, 1], '', '')]
    check_block = (f'<div style="display: flex; flex-direction: column; gap: 8px; padding: 8px; border-radius: 32px; background: rgba(255,255,255,0.04); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08)">'
                   + log_row('skin', 'Skin check · 6 areas', 'worst: Ears, inside 8 · nails: Left thumb =', '21:40') + score_table(day_rows, state=False, legend=False, thresh=8) + '</div>')
    log = check_block + ''.join([log_row('health', 'Daily health', 'Wellbeing 6 · Stress 4', '21:30'), log_row('meal', 'Rice with vegetables', '', '19:10'), log_row('meal', 'Chicken salad', 'egg, mustard', '12:40')])
    day = (f'<div class="ax-r ax-d2">{banner("", "This day has a Daily health record. Newest first.", "check")}</div>'
           f'<div class="ax-r ax-d3" style="display: flex; flex-direction: column; gap: 8px">{section_label("Log", cnt("6 entries"))}{log}</div>'
           f'<div class="ax-r ax-d4">{btn("Open this day on Today", "glass", "clock", full=True, h=52)}</div>')
    pushed('G8-ReviewDay-Title.dc.html', 'Review day: the date and weekday as title, a check as a table', 'Thursday, 19 November', '6 entries', 'Back to Review', day, h=1260)

    # ======================================================== 16. area timeline as a table
    tl_rows = [('Thu 19 Nov', [8, 7, 3, 7, 6], '', '21:40 · 1 photo'), ('Wed 18 Nov', [8, 7, 4, 7, 6], '', '21:12'), ('Tue 17 Nov', [7, 6, 3, 6, 5], '', '21:30 · cracks'),
               ('Mon 16 Nov', [6, 5, 2, 6, 4], '', '22:05 · 2 photos'), ('Sun 15 Nov', [5, 5, 2, 5, 4], '', '20:50'), ('Sat 14 Nov', [5, 4, 1, 5, 3], '', '21:00')]
    chart = (f'<div class="ax-r ax-d2" style="display: flex; flex-direction: column; gap: 10px; padding: 14px 14px 12px 14px; border-radius: 30px; {GLASS_BLUR}">'
             f'<div style="display: flex; align-items: center; justify-content: space-between"><h2 style="margin: 0; font-size: 16px; font-weight: 700">Trend</h2><span style="font-size: 13px; color: {MUTED}">90 days</span></div>'
             f'{R["trend_chart"]()}</div>')
    tl = (pushed_header('Ears, inside', 'Skin · flare since 12 Nov', 'Back to Review', btn('Go to date', 'glass', 'calendar', h=40)) + chart
          + f'<div class="ax-r ax-d3" style="display: flex; flex-direction: column; gap: 8px">{section_label("Entries", cnt("coral: at or above the flare threshold, 8"))}{score_table(tl_rows, first="Day", state=False, thresh=8)}</div>'
          + hint('A tap on a row opens the Edit and Delete sheet of its skin check; Edit opens the check at this area.'))
    put('G8-AreaTimeline-Table.dc.html', 'Area timeline: entries as a table', content() + tl + '</div>', h=1180)

    # ======================================================== 17. stool rows with descriptions (form)
    DESC = [(1, 'Hard lumps', 'Separate hard lumps, hard to pass'), (2, 'Lumpy sausage', 'Sausage-shaped but lumpy'), (3, 'Cracked sausage', 'Sausage shape with cracks on the surface'),
            (4, 'Smooth sausage', 'Smooth and soft'), (5, 'Soft pieces', 'Soft blobs with clear edges, passed easily'), (6, 'Mushy', 'Fluffy pieces with ragged edges'), (7, 'Watery', 'Liquid, no solid pieces')]
    BANDS = [('Hard', (1, 2)), ('Normal', (3, 4)), ('Loose', (5, 6, 7))]
    def srow(n, name, desc, state=''):
        if state == 'on':
            ring, numbg, numc, right = 'box-shadow: inset 0 0 0 2px @A@, 0 0 22px @S@; background: rgba(255,255,255,0.09)', '@A@', ONACC, svg(IC['check'], 18, '@A@', 2.6)
            label, aria = name, f'Type {n}, {name}, selected'
        elif state.startswith('saved'):
            ring, numbg, numc, right = 'box-shadow: inset 0 0 0 1.5px @A@, 0 0 22px @S@; background: rgba(255,255,255,0.08)', '@A@', ONACC, ''
            label, aria = state.split(':', 1)[1], f'Type {n} saved'
            desc = name
        else:
            ring, numbg, numc, right, label, aria = GLASS, 'rgba(255,255,255,0.08)', TEXT, '', name, f'Type {n}, {name}: {desc}'
        return (f'<button aria-label="{aria}" style="display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 8px 16px 8px 8px; border-radius: 30px; {ring}; text-align: left">'
                f'<span style="width: 40px; height: 40px; border-radius: 999px; background: {numbg}; color: {numc}; display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 800; flex: none">{n}</span>'
                f'<span style="flex: 1; min-width: 0"><span style="display: block; font-size: 15.5px; font-weight: {"700" if state else "600"}; font-variant-numeric: tabular-nums">{label}</span>'
                f'<span style="display: block; font-size: 13px; line-height: 17px; color: {MUTED}">{desc}</span></span>{right}</button>')
    def bands(selected=None, saved=None):
        out = ''
        for bname, ns in BANDS:
            rows_ = ''.join(srow(n, nm, d, 'on' if n == selected else (f'saved:{saved[1]}' if saved and n == saved[0] else '')) for n, nm, d in DESC if n in ns)
            out += f'<div style="display: flex; flex-direction: column; gap: 8px">{section_label(bname, cnt(", ".join(str(n) for n in ns)))}{rows_}</div>'
        return out
    stool = f'<div class="ax-r ax-d1" style="display: flex; flex-direction: column; gap: 14px">{bands(selected=4)}</div>' + time_note()
    form('G8-Stool-Form.dc.html', 'Stool form: banded rows with descriptions', 'Stool', stool, 'Save stool entry', h=1200)

    # ======================================================== 18. stool quick sheet as rows
    qs = (f'<div style="display: flex; flex-direction: column; gap: 12px; max-height: 600px; overflow: hidden">{bands(saved=(4, "Saved 14:20"))}</div>'
          f'<button style="height: 52px; border-radius: 999px; {GLASS}; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 15px; font-weight: 600">{svg(IC["clock"], 18)}Earlier…</button>')
    put('G8-Sheet-Stool-Rows.dc.html', 'Stool quick sheet: the same rows, a tap saves', behind() + sheet('Stool', 'Tap a type to save it now', qs, bottom=12), h=1040)

    # ======================================================== 19. drink suggestions by name
    def drow(name, hint_, star=False):
        st = svg(IC['star'], 15, '@A@', 2) if star else ''
        return (f'<button aria-label="{name}, {hint_}" style="display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 8px 16px 8px 8px; border-radius: 999px; {GLASS}; text-align: left">{icon_circle("drink", 40, 22)}'
                f'<span style="flex: 1; min-width: 0"><span style="display: flex; align-items: center; gap: 6px; font-size: 15.5px; font-weight: 600">{name}{st}</span><span style="display: block; font-size: 13px; color: {MUTED}">{hint_}</span></span>'
                f'{svg(IC["plus"], 18, "@A@", 2.4)}</button>')
    sugg = (drow('Coffee with milk', 'usually 250 ml · 14 times in 30 days', True) + drow('Water', 'usually 500 ml · yesterday') + drow('Rooibos tea', 'usually 250 ml · 6 times')
            + drow('Orange juice', '200 ml · 3 Nov'))
    dbody = (f'<div class="ax-r ax-d1">{field("drinkName", "Drink", "Drink (for example beer or coffee with milk)", None, focus=True, icon="search")}</div>'
             + f'<div class="ax-r ax-d2" style="display: flex; flex-direction: column; gap: 8px">{section_label("Recent and favorites", cnt("one row per drink"))}{sugg}</div>'
             + hint('A drink you log in several amounts is one row. Picking it fills the amount, alcohol and ingredients of the last time; you can change them before saving.'))
    form('G8-Drink-Recents.dc.html', 'Drink: suggestions by name, with the usual amount', 'Drink', dbody, None, h=900)

    # ======================================================== 20. Settings: area order
    def orow(name, sub, first=False, last=False):
        s = f'<span style="display: block; font-size: 12.5px; color: {MUTED}">{sub}</span>' if sub else ''
        return (f'<div style="display: flex; align-items: center; gap: 6px; min-height: 58px; padding: 6px 6px 6px 16px; border-bottom: 1px solid rgba(255,255,255,0.07)">'
                f'<span style="flex: 1; min-width: 0"><span style="display: block; font-size: 15.5px; font-weight: 600">{name}</span>{s}</span>'
                f'{round_btn(UP, "Move up " + name, first)}{round_btn(DOWN, "Move down " + name, last)}'
                f'<button aria-label="Open {name}" style="width: 40px; height: 44px; display: flex; align-items: center; justify-content: center">{svg(IC["chev"], 18, MUTED, 2)}</button></div>')
    skin_list = (orow('Chin', 'Predefined', first=True) + orow('Neck', 'Predefined') + orow('Ears, inside', 'Predefined') + orow('Behind the ears', 'Predefined')
                 + orow('Sternum', 'Predefined') + orow('Left elbow', 'Your area', last=True))
    nails_entry = R['nav_row']('nails', 'Nail map', '3 tracked', 'Pick the nails you follow', last=True).replace('<button style="', f'<button style="padding-left: 12px; padding-right: 14px; border-radius: 26px; {GLASS_BLUR}; ', 1)
    sa = (f'<div class="ax-r ax-d2" style="display: flex; flex-direction: column; gap: 8px">{section_label("Skin", cnt("this order everywhere"))}{list_panel([skin_list])}</div>'
          f'<div class="ax-r ax-d3">{add_row("Add a skin area")}</div>'
          + hint('The skin check goes through the areas in this order, then the nails. Review, the report and the area pickers use it too.')
          + f'<div class="ax-r ax-d3" style="display: flex; flex-direction: column; gap: 8px">{section_label("Nails")}{nails_entry}</div>'
          + f'<div class="ax-r ax-d4">{btn("Archived areas (1)", "glass", "box", full=True, h=48)}</div>')
    pushed('G8-SkinAreas-Order.dc.html', 'Settings: area order and the nail map', 'Skin and nail areas', 'Settings', 'Back to Settings', sa, h=1180)

    # ======================================================== 21. Nails form: the nail map
    other = (f'<div class="ax-r ax-d3" style="display: flex; flex-direction: column; gap: 8px">{section_label("Other nails", cnt("added by name before"))}'
             f'<div style="display: flex; align-items: center; gap: 10px; padding: 8px 8px 8px 16px; border-radius: 999px; {GLASS_BLUR}"><span style="flex: 1; min-width: 0"><span style="display: block; font-size: 15.5px; font-weight: 600">Big toe right</span>'
             f'<span style="display: block; font-size: 12.5px; color: {MUTED}">4 entries · 2 photos</span></span>{btn("This is…", "outline", h=44, extra="; flex: none")}</div></div>')
    nmap = (f'<div class="ax-r ax-d1">{hint("Tap a nail to log it or add a close-up photo. A dashed nail is not tracked: tap it to start.")}</div>'
            + nail_map(**MAP_STATES) + other + time_note())
    form('G8-NailMap.dc.html', 'Nails: pick a nail on the map', 'Nails', nmap, None, h=1080)

    # ======================================================== 22. a tracked nail's sheet
    ns_inner = (f'<div style="display: flex; flex-direction: column; gap: 14px; padding: 0 4px">'
                f'<span style="font-size: 13.5px; color: {MUTED}">Last: 16 Nov · separation, up to half · 2 photos</span>'
                + btn('No change', 'outline', 'check', full=True, h=48)
                + block('Stage', chips([chip('Red or dark edge'), chip('Separation', 'on'), chip('Yellow'), chip('White'), chip('Clear')]), cls='')
                + block('How much of the nail', chips([chip('None'), chip('Under a quarter'), chip('Up to half', 'on'), chip('More than half')]), cls='')
                + block('Close-up photos', f'<div style="display: flex; gap: 10px">{btn("Take photo", "glass", "camera", h=48, extra="; flex: 1")}{btn("From library", "glass", "plus", h=48, extra="; flex: 1")}</div>'
                        f'<div style="display: flex; gap: 10px">{R["photo"]("16 Nov", size=64)}{R["photo"]("16 Nov", size=64)}</div>', cls='')
                + btn('Save Left thumb', 'primary', 'check', full=True, h=56, extra='; font-size: 17px')
                + f'<button style="height: 44px; font-size: 14.5px; font-weight: 600; color: {CORAL}">Stop tracking this nail</button></div>')
    put('G8-NailMap-Sheet.dc.html', 'Nails: a tracked nail’s sheet with close-up photos',
        modal_top('Nails') + f'<div style="opacity: 0.35">{nail_map(**MAP_STATES, sel=("Left hand", "Thumb"), cls="")}</div>' + MODAL_END
        + '<div aria-hidden="true" style="position: absolute; inset: 0; background: rgba(3,6,10,0.55)"></div>'
        + sheet('Left hand · thumb', 'Tracked since 2 Nov', ns_inner), h=1120)

    # ======================================================== 23. tracking a new nail
    tr_inner = (f'<div style="display: flex; flex-direction: column; gap: 12px; padding: 0 4px">'
                + body_text('This nail joins the skin check and the weekly nail photo reminder. You can stop tracking it at any time; its entries stay.', SOFT, 14)
                + btn('Track this nail', 'primary', 'plus', full=True, h=56, extra='; font-size: 17px') + btn('Not now', 'glass', full=True, h=48) + '</div>')
    put('G8-NailMap-Track.dc.html', 'Nails: start tracking a nail',
        modal_top('Nails') + f'<div style="opacity: 0.35">{nail_map(**MAP_STATES, sel=("Right hand", "Index"), cls="")}</div>' + MODAL_END
        + '<div aria-hidden="true" style="position: absolute; inset: 0; background: rgba(3,6,10,0.55)"></div>'
        + sheet('Right hand · index', 'Not tracked yet', tr_inner), h=1000)

    # ======================================================== 24. mapping a nail added by name
    ti = (f'<div class="ax-r ax-d1">{banner("Which nail is “Big toe right”?", "Pick it on the map. Its 4 entries and 2 photos move to that nail, and “Big toe right” is archived.", "nails")}</div>'
          + nail_map(**{**MAP_STATES, 'rf': {'Big toe': ('white', 0)}}, sel=('Right foot', 'Big toe'))
          + f'<div class="ax-r ax-d3">{hint("The picked nail already has entries: they are kept, and the moved ones are added to its history by their own dates.")}</div>')
    pushed_fp_ = lambda: put('G8-NailMap-ThisIs.dc.html', 'Nails: “This is…” for a nail added by name',
                             content(gap=18) + pushed_header('This is…', 'Big toe right', 'Back to Nails') + ti + '</div>' + float_primary('Move to Right foot · big toe', 'check'), h=1000)
    pushed_fp_()

    # ======================================================== 25. Polish: segmented and switch rows
    def seg_fixed(options, selected):
        items = ''.join(
            f'<button role="tab" aria-selected="{"true" if i == selected else "false"}" style="flex: 1; min-width: 0; height: 44px; padding: 0 8px; border-radius: 999px; {"background: rgba(255,255,255,0.14); font-weight: 700" if i == selected else f"font-weight: 600; color: {SOFT}"}; '
            f'font-size: 14px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{o}</button>' for i, o in enumerate(options))
        return f'<div role="tablist" aria-label="Zakres progu" style="display: flex; padding: 4px; border-radius: 999px; {GLASS_BLUR}">{items}</div>'
    def sw_card(title, hint_, on):
        h_ = f'<span style="display: block; font-size: 13px; line-height: 18px; color: {MUTED}; margin-top: 2px">{hint_}</span>' if hint_ else ''
        return (f'<button role="switch" aria-checked="{"true" if on else "false"}" style="display: flex; align-items: center; gap: 14px; padding: 14px 16px 14px 20px; border-radius: 26px; {GLASS}; text-align: left">'
                f'<span style="flex: 1; min-width: 0"><span style="display: block; font-size: 15.5px; line-height: 21px; font-weight: 600">{title}</span>{h_}</span>{R["switch"](on)}</button>')
    before = (f'<div style="display: flex; padding: 4px; border-radius: 999px; {GLASS_BLUR}"><span style="flex: 1; padding: 4px 10px; border-radius: 999px; background: rgba(255,255,255,0.14); font-size: 14.5px; font-weight: 700; line-height: 18px">Jednakowy dla<br>wszystkich</span>'
              f'<span style="flex: 1; padding: 4px 10px; font-size: 14.5px; font-weight: 600; color: {SOFT}; line-height: 18px">Dla każdego<br>miejsca</span></div>')
    pl = (f'<div class="ax-r ax-d1">{hint("Polish labels are longer. Segment labels stay on one line and are centred; switch rows that wrap get the card radius, so the text stays clear of the corners and the switch stays centred.")}</div>'
          + f'<div class="ax-r ax-d2" style="display: flex; flex-direction: column; gap: 8px">{section_label("Teraz")}<div style="opacity: 0.7">{before}</div></div>'
          + f'<div class="ax-r ax-d2" style="display: flex; flex-direction: column; gap: 8px">{section_label("Po zmianie")}{seg_fixed(["Wspólny", "Osobno dla miejsc"], 0)}'
          + hint('Jeśli pełna etykieta „Jednakowy dla wszystkich” mieści się po zmniejszeniu czcionki do 85%, zostaje; jeśli nie, krótsze: „Wspólny”, „Osobno dla miejsc”.') + '</div>'
          + f'<div class="ax-r ax-d3" style="display: flex; flex-direction: column; gap: 8px">{section_label("Wiersze z przełącznikiem")}'
          + sw_card('Blokada Face ID albo kodem', 'Po powrocie do aplikacji po minucie', True)
          + sw_card('Uzupełnij później z AI', 'Zapisuje sam opis; składniki dopiszesz później z pomocą AI', False) + '</div>')
    pushed('G8-Polish-Rows.dc.html', 'Polish: segment labels and switch rows', 'Wpisy', 'Ustawienia', 'Wróć do ustawień', pl, h=960)

TITLE = 'Group 8: after the first real use (2026-11-23)'
NEEDS = '''Group 8: approved in the review, for building (tasks 20 to 29)

Skin check: one area per step (title "Skin · Neck 2/8"), area strip, No change / Skip / Next, flare badge and Skip note, summary table with one Save, editing a saved check. Cracks and patch size in one card, no Details.
Today: one dot and one row per check; merged-dot rows with Edit and Delete, delete asks in the sheet; past day with "Today" chip in the top bar and a status pill.
Edit Today: live preview, numbered pins, sortable In More. Review day titled with the date; area timeline and check as score tables.
Stool rows with descriptions (no drawings). Drinks by name. Area order. Nail map (20 nails, close-up photos), its sheet, tracking, "This is…". Polish layout fixes.

See docs/reviews/2026-11-23-first-use-review.md and docs/work-plan-2026-11-23.md.'''

if __name__ == '__main__':
    run()
