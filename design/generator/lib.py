"""Shared parts for the group scripts (group1.py ... group6.py).

Loads the helpers of reference.py (without drawing its boards) and adds the patterns the remaining screens
need: fields, banners, quick sheets, forms, the Today builder, LLM wait panels and settings details.
Everything is built from the approved tokens in docs/design-system.md. Placeholders @A@ (accent), @S@ (soft), @L@ (line)."""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
_src = open(os.path.join(HERE, 'reference.py')).read().split('# ------------------------------------------------------------------ 1. Skin form')[0]
_ns = {'__file__': os.path.join(HERE, 'reference.py')}
exec(_src, _ns)
globals().update({k: v for k, v in _ns.items() if not k.startswith('__')})

ONALERT = '#2A0D04'
ONACC = '#062A26'
TEXT = '#F2F5F9'
RAISED = 'background: rgba(255,255,255,0.09); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.14)'
FOCUS = 'background: rgba(255,255,255,0.09); box-shadow: inset 0 0 0 1.5px @L@'
SHEETFILL = 'background: rgba(16,22,33,0.88); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12), 0 30px 60px rgba(0,0,0,0.55); backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px)'

# Board registry: every board a group script writes is listed here so the canvas index can be built.
BOARDS = []

def put(name, title, body, h=844, w=390):
    """Write one board and remember it for canvas.json."""
    write(name, title, body, h=h, w=w)
    BOARDS.append({'file': name, 'title': title, 'w': w, 'h': h})

# ------------------------------------------------------------------ small parts
def cnt(t):
    return f'<span style="font-size: 13px; color: {MUTED}">{t}</span>'

def vh(text):
    return f'<span style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">{text}</span>'

def field(fid, label, placeholder='', value=None, icon=None, focus=False, suffix=None, h=56, inputmode=None):
    ic = svg(IC[icon], 20, MUTED, 2) if icon else ''
    val = f' value="{value}"' if value is not None else ''
    sfx = f'<span style="font-size: 14.5px; color: {MUTED}; padding-right: 6px">{suffix}</span>' if suffix else ''
    return (f'<div style="display: flex; align-items: center; gap: 10px; height: {h}px; padding: 0 14px 0 20px; border-radius: 999px; {FOCUS if focus else RAISED}">'
            f'{ic}<label for="{fid}" style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">{label}</label>'
            f'<input id="{fid}" placeholder="{placeholder}"{val} style="flex: 1; min-width: 0; height: 44px; font-size: 16.5px; font-variant-numeric: tabular-nums">{sfx}</div>')

def seg(options, selected, label='View'):
    items = ''.join(
        (f'<button role="tab" aria-selected="true" style="flex: 1; min-width: 0; height: 40px; border-radius: 999px; background: rgba(255,255,255,0.14); font-size: 14.5px; font-weight: 700; text-align: center">{o}</button>'
         if i == selected else
         f'<button role="tab" aria-selected="false" style="flex: 1; min-width: 0; height: 40px; border-radius: 999px; font-size: 14.5px; font-weight: 600; color: {SOFT}; text-align: center">{o}</button>')
        for i, o in enumerate(options))
    return f'<div role="tablist" aria-label="{label}" style="display: flex; padding: 4px; border-radius: 999px; {GLASS_BLUR}">{items}</div>'

def panel(inner, pad='14px 16px', gap=10, extra=''):
    return f'<div style="display: flex; flex-direction: column; gap: {gap}px; padding: {pad}; border-radius: 28px; {GLASS_BLUR}{extra}">{inner}</div>'

def body_text(text, color=SOFT, size=14.5, extra=''):
    return f'<p style="margin: 0; font-size: {size}px; line-height: {round(size * 1.45)}px; color: {color}{extra}">{text}</p>'

def banner(title, text, icon='info', kind='info', actions=''):
    """A note panel. kind: info (glass, quiet), alert (coral, urgent or error)."""
    if kind == 'alert':
        box = f'background: rgba(255,138,107,0.12); box-shadow: inset 0 0 0 1px rgba(255,138,107,0.38)'
        ic = (f'<span style="width: 36px; height: 36px; border-radius: 999px; background: rgba(255,138,107,0.16); display: flex; align-items: center; justify-content: center; flex: none">{svg(IC[icon], 20, CORAL, 1.8)}</span>')
        tcol = CORAL
    else:
        box = 'background: rgba(255,255,255,0.05); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.10)'
        ic = icon_circle(icon, 36, 20)
        tcol = TEXT
    t = f'<span style="display: block; font-size: 15px; font-weight: 700; color: {tcol}">{title}</span>' if title else ''
    act = f'<div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px">{actions}</div>' if actions else ''
    return (f'<div style="display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; border-radius: 26px; {box}">{ic}'
            f'<div style="flex: 1; min-width: 0">{t}<span style="display: block; font-size: 13.5px; line-height: 19px; color: {SOFT}; margin-top: {2 if title else 0}px">{text}</span>{act}</div></div>')

def tick_row(text):
    return (f'<div style="display: flex; align-items: flex-start; gap: 10px; font-size: 14px; line-height: 19px; color: {SOFT}">'
            f'<span style="margin-top: 2px; flex: none">{svg(IC["check"], 15, "@A@", 2.4)}</span><span>{text}</span></div>')

def time_row(label='Now · 14:20'):
    return (f'<button style="height: 44px; display: flex; align-items: center; gap: 6px; padding: 0 16px 0 12px; border-radius: 999px; {GLASS}; font-size: 14.5px; font-weight: 600; font-variant-numeric: tabular-nums; align-self: flex-start">{svg(IC["clock"], 17)}{label}</button>')

def add_chip(text):
    return (f'<button style="height: 38px; display: flex; align-items: center; gap: 6px; padding: 0 14px 0 10px; border-radius: 999px; border: 1.5px dashed rgba(255,255,255,0.34); box-sizing: border-box; font-size: 14.5px; font-weight: 600; color: @A@">{svg(IC["plus"], 15, "@A@", 2.4)}{text}</button>')

def guess_chip(text):
    return (f'<button aria-pressed="false" aria-label="{text}, suggested" style="height: 38px; display: flex; align-items: center; gap: 6px; padding: 0 14px 0 10px; border-radius: 999px; '
            f'border: 1.5px dashed @A@; box-sizing: border-box; font-size: 14.5px; font-weight: 600; color: @A@">{svg(IC["plus"], 15, "@A@", 2.4)}{text}</button>')

def ing_chip(text):
    return (f'<button aria-label="Edit ingredient {text}" style="height: 38px; display: flex; align-items: center; gap: 6px; padding: 0 10px 0 14px; border-radius: 999px; {GLASS}; font-size: 14.5px; font-weight: 500">{text}'
            f'<span aria-hidden="true" style="display: flex; opacity: 0.6">{svg(IC["x"], 14, TEXT, 2.2)}</span></button>')

def tab_label(text):
    return section_label(text)

def kv(k, v):
    return (f'<div style="display: flex; justify-content: space-between; gap: 12px; font-size: 14px; line-height: 20px"><span style="color: {MUTED}">{k}</span>'
            f'<span style="color: {TEXT}; font-weight: 600; text-align: right; font-variant-numeric: tabular-nums">{v}</span></div>')

def hair():
    return '<div aria-hidden="true" style="height: 1px; background: rgba(255,255,255,0.08)"></div>'

def circle_btn(icon, label, size=44, isize=20, kind='glass'):
    bg = GLASS if kind == 'glass' else 'background: @A@'
    stroke = TEXT if kind == 'glass' else ONACC
    return (f'<button aria-label="{label}" style="width: {size}px; height: {size}px; border-radius: 999px; {bg}; display: flex; align-items: center; justify-content: center; flex: none">'
            f'{svg(IC[icon] if icon in IC else icon, isize, stroke, 2)}</button>')

# ------------------------------------------------------------------ forms and sheets
def form(name, title, header, body, save, missing=None, h=844):
    """Full form: Cancel in the header, floating Save at the bottom (UX-3)."""
    put(name, title, modal_top(header) + body + (save_bar(save, missing) if save else '') + MODAL_END, h=h)

def behind(opacity=0.45):
    return f'''<div aria-hidden="true" style="position: absolute; inset: 0; padding: 50px 20px 0 20px; box-sizing: border-box; opacity: {opacity}; filter: blur(1.5px)">
<div style="margin: 0 auto; width: 256px; height: 256px; border-radius: 999px; {GLASS}; position: relative"><div style="position: absolute; inset: 14px; border-radius: 999px; border: 10px solid rgba(255,255,255,0.08)"></div>
<div style="position: absolute; left: 0; right: 0; top: 96px; text-align: center; font-size: 12.5px; font-weight: 600; letter-spacing: 1.8px; color: @A@">SATURDAY</div>
<div style="position: absolute; left: 0; right: 0; top: 112px; text-align: center; font-size: 38px; font-weight: 800">14 Nov</div></div>
<div style="margin-top: 28px; display: flex; flex-direction: column; gap: 8px"><div style="height: 56px; border-radius: 999px; {GLASS}"></div><div style="height: 56px; border-radius: 999px; {GLASS}"></div><div style="height: 56px; border-radius: 999px; {GLASS}"></div></div>
</div>
<div aria-hidden="true" style="position: absolute; inset: 0; background: rgba(3,6,10,0.55)"></div>
'''

def sheet(title, sub, inner, bottom=12, close=True):
    sb = f'<div style="font-size: 13.5px; color: {MUTED}; margin-top: 2px">{sub}</div>' if sub else ''
    cl = (f'<button aria-label="Close" style="width: 44px; height: 44px; border-radius: 999px; {GLASS}; display: flex; align-items: center; justify-content: center">{svg(IC["x"], 18, TEXT, 2.2)}</button>' if close else '')
    return (f'<div class="ax-s" role="dialog" aria-label="{title}" style="position: absolute; left: 10px; right: 10px; bottom: {bottom}px; border-radius: 40px; padding: 10px 14px 16px 14px; {SHEETFILL}; display: flex; flex-direction: column; gap: 12px">'
            f'<div aria-hidden="true" style="width: 40px; height: 5px; border-radius: 999px; background: rgba(255,255,255,0.22); margin: 0 auto"></div>'
            f'<div style="display: flex; align-items: center; justify-content: space-between; padding: 2px 6px 0 8px"><div><h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.4px">{title}</h1>{sb}</div>{cl}</div>{inner}</div>')

def action_sheet(title, text, actions, cancel='Cancel'):
    """Floating action sheet (UX-9): title, text, actions, a separate Cancel pill below."""
    return (f'<div class="ax-s" role="alertdialog" aria-label="{title}" style="position: absolute; left: 10px; right: 10px; bottom: 12px; display: flex; flex-direction: column; gap: 8px">'
            f'<div style="display: flex; flex-direction: column; gap: 8px; padding: 18px 16px 16px 16px; border-radius: 36px; {SHEETFILL}">'
            f'<div style="text-align: center; font-size: 16px; font-weight: 700">{title}</div>'
            f'<div style="text-align: center; font-size: 13.5px; line-height: 19px; color: {SOFT}; padding: 0 10px 6px 10px">{text}</div>{actions}</div>'
            + btn(cancel, 'glass', full=True, h=56, extra="; background: rgba(16,22,33,0.9); backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px); font-size: 17px") + '</div>')

def qrow(icon, name, sub, state=''):
    """One-tap row of a quick sheet. state '' (ready), 'done:<label>' (just logged, locked 3 s)."""
    if state.startswith('done'):
        label = state.split(':', 1)[1]
        right = (f'<span style="display: flex; align-items: center; gap: 6px; height: 34px; padding: 0 12px; border-radius: 999px; background: @A@; color: {ONACC}; font-size: 13.5px; font-weight: 700; font-variant-numeric: tabular-nums">{svg(IC["check"], 16, ONACC, 2.4)}{label}</span>')
        ring = 'box-shadow: inset 0 0 0 1.5px @A@, 0 0 28px @S@; background: rgba(255,255,255,0.08)'
        dis = ' disabled aria-disabled="true"'
    else:
        right = f'<span style="width: 34px; height: 34px; border-radius: 999px; background: @A@; display: flex; align-items: center; justify-content: center">{svg(IC["plus"], 16, ONACC, 2.6)}</span>'
        ring = GLASS
        dis = ''
    return (f'<button{dis} aria-label="Log {name}" style="display: flex; align-items: center; gap: 12px; padding: 8px; min-height: 60px; border-radius: 999px; {ring}">{icon_circle(icon, 44, 24)}'
            f'<span style="flex: 1; min-width: 0"><span style="display: block; font-size: 16px; font-weight: 600">{name}</span>'
            f'<span style="display: block; font-size: 13px; color: {MUTED}; margin-top: 1px">{sub}</span></span>{right}</button>')

def other_or_earlier():
    return f'<button style="height: 52px; border-radius: 999px; {GLASS}; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 15.5px; font-weight: 600">{svg(IC["clock"], 20)}Other or earlier…</button>'

# ------------------------------------------------------------------ Today builder
def qa(icon, label, more=False):
    if more:
        return (f'<button style="display: flex; flex-direction: column; align-items: center; gap: 6px"><span style="width: 56px; height: 56px; border-radius: 999px; box-shadow: inset 0 0 0 1.5px rgba(255,255,255,0.18); display: flex; align-items: center; justify-content: center">'
                f'<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="{TEXT}"><circle cx="6" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18" cy="12" r="1.7"/></svg></span>'
                f'<span style="font-size: 13.5px; font-weight: 500; color: {MUTED}">More</span></button>')
    return (f'<button style="display: flex; flex-direction: column; align-items: center; gap: 6px"><span style="width: 56px; height: 56px; border-radius: 999px; background: rgba(255,255,255,0.08); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.14); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); display: flex; align-items: center; justify-content: center">'
            f'{svg(IC[icon], 26)}</span><span style="font-size: 13.5px; font-weight: 500">{label}</span></button>')

QA_DEFAULT = [('meal', 'Meal'), ('skin', 'Skin'), ('treatment', 'Treatment'), ('health', 'Daily health'), ('stool', 'Stool')]

def log_row(icon, title, detail, time, new=False, swiped=False):
    ring = 'background: rgba(255,255,255,0.08); box-shadow: inset 0 0 0 1.5px @A@, 0 0 28px @S@' if new else 'background: rgba(255,255,255,0.06); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.10)'
    d = f'<span style="display: block; font-size: 13px; color: {MUTED}">{detail}</span>' if detail else ''
    row = (f'<button style="display: flex; align-items: center; gap: 12px; padding: 8px 16px 8px 8px; min-height: 56px; border-radius: 999px; {ring}; {"transform: translateX(-12px); flex: 1; " if swiped else "width: 100%; "}">{icon_circle(icon, 40, 24)}'
           f'<span style="flex: 1; min-width: 0"><span style="display: block; font-size: 15.5px; font-weight: 600">{title}</span>{d}</span>'
           f'<span style="font-size: 13.5px; color: {MUTED}; font-variant-numeric: tabular-nums">{time}</span></button>')
    if swiped:
        return (f'<div style="display: flex; gap: 8px">{row}<button aria-label="Delete {title}" style="width: 92px; border-radius: 999px; background: {CORAL}; color: {ONALERT}; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 14.5px; font-weight: 800">{svg(IC["trash"], 17, ONALERT, 2)}Delete</button></div>')
    return row

def pill(text, kind='plain', badge=None):
    if kind == 'flare':
        b = f'<span style="width: 26px; height: 26px; border-radius: 999px; background: {CORAL}; color: {ONALERT}; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800">{badge}</span>'
        return (f'<button style="height: 44px; display: flex; align-items: center; gap: 8px; padding: 0 14px 0 8px; border-radius: 999px; background: rgba(255,138,107,0.14); box-shadow: inset 0 0 0 1px rgba(255,138,107,0.38); font-size: 14px; font-weight: 600">{b}{text}</button>')
    return (f'<button style="height: 44px; display: flex; align-items: center; gap: 8px; padding: 0 14px; border-radius: 999px; background: rgba(255,255,255,0.07); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12); font-size: 14px; font-weight: 600; color: {SOFT}">{text}</button>')

def ring_dot(track, hour, kind, label, count=None):
    """track out (intake, radius 95) or in (body and care, radius 73); hour 0-24; kind filled|hollow|care."""
    import math
    r = 95 if track == 'out' else 73
    a = hour / 24 * 2 * math.pi
    x = 128 + r * math.sin(a) - 14
    y = 128 - r * math.cos(a) - 14
    if count:
        inner = (f'<span style="width: 24px; height: 24px; border-radius: 999px; background: {TEXT}; color: #070B12; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; font-variant-numeric: tabular-nums">{count}</span>')
    elif kind == 'filled':
        inner = f'<span style="width: 16px; height: 16px; border-radius: 999px; background: {TEXT}"></span>'
    elif kind == 'care':
        inner = f'<span style="width: 15px; height: 15px; border-radius: 999px; box-sizing: border-box; border: 2.5px solid @A@; background: #0E141E; box-shadow: 0 0 10px @S@"></span>'
    else:
        inner = f'<span style="width: 15px; height: 15px; border-radius: 999px; box-sizing: border-box; border: 2.5px solid {TEXT}; background: #0E141E"></span>'
    return (f'<button aria-label="{label}" style="position: absolute; left: {x:.0f}px; top: {y:.0f}px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center">{inner}</button>')

def today(name, title, dots=(), arc=14.33, weekday='Saturday', date='14 Nov', count='3 entries · 14:20', pills=(), card=None,
          back=False, past=False, qas=None, rows=(), log_label='Log', log_n='3 entries', empty_log=False, h=844, overlay='', tab=True):
    """The Today screen of the approved Aurora ring, parameterised. arc=None draws no 'now' arc (a past day)."""
    arcs = ''
    if arc is not None:
        off = 653.5 * (1 - arc / 24)
        arcs = (f'<circle cx="130" cy="130" r="104" fill="none" stroke="@A@" stroke-width="10" stroke-linecap="round" stroke-dasharray="653.5" stroke-dashoffset="{off:.1f}" transform="rotate(-90 130 130)" style="filter: drop-shadow(0 0 6px @S@)"/>')
    now_dot = ''
    if arc is not None:
        import math
        a = arc / 24 * 2 * math.pi
        nx, ny = 128 + 95 * math.sin(a) - 5, 128 - 95 * math.cos(a) - 5
        now_dot = f'<span aria-hidden="true" style="position: absolute; left: {nx:.0f}px; top: {ny:.0f}px; width: 10px; height: 10px; border-radius: 999px; background: #FFFFFF; box-shadow: 0 0 0 3px @A@, 0 0 14px @S@"></span>'
    nxt_dis = ' disabled aria-disabled="true"' if not past else ''
    nxt_lbl = 'Next day, not available' if not past else 'Next day'
    nxt_op = '0.18' if not past else '0.55'
    ring = f'''<div style="position: relative; height: 256px; display: flex; justify-content: center">
<button aria-label="Previous day" style="position: absolute; left: 0; top: 106px; width: 44px; height: 44px; border-radius: 999px; display: flex; align-items: center; justify-content: center; opacity: 0.55">{svg(IC["back"], 20, TEXT, 2)}</button>
<button aria-label="{nxt_lbl}"{nxt_dis} style="position: absolute; right: 0; top: 106px; width: 44px; height: 44px; border-radius: 999px; display: flex; align-items: center; justify-content: center; opacity: {nxt_op}">{svg(IC["chev"], 20, TEXT, 2)}</button>
<div style="position: relative; width: 256px; height: 256px; border-radius: 999px; background: rgba(255,255,255,0.06); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12), 0 30px 60px rgba(0,0,0,0.35); backdrop-filter: blur(22px); -webkit-backdrop-filter: blur(22px)">
<svg aria-hidden="true" width="256" height="256" viewBox="-10 -10 280 280" style="position: absolute; inset: 0"><circle cx="130" cy="130" r="104" fill="none" stroke="rgba(255,255,255,0.09)" stroke-width="10"/><circle cx="130" cy="130" r="80" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="10"/>{arcs}
<g fill="{MUTED}" font-family="Gabarito, sans-serif" font-size="11" font-weight="600" text-anchor="middle"><text x="130" y="7">00</text><text x="256" y="134">06</text><text x="130" y="262">12</text><text x="4" y="134">18</text></g></svg>
{"".join(dots)}{now_dot}
<button aria-label="Jump to a date, {weekday} {date}" style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -56%); display: flex; flex-direction: column; align-items: center; text-align: center">
<span style="font-size: 12.5px; font-weight: 600; letter-spacing: 1.8px; text-transform: uppercase; color: @A@">{weekday}</span>
<span style="font-size: 38px; line-height: 42px; font-weight: 800; letter-spacing: -1.2px">{date}</span>
<span style="margin-top: 6px; padding: 4px 10px; border-radius: 999px; background: rgba(255,255,255,0.08); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12); font-size: 12.5px; font-weight: 500; color: {SOFT}; font-variant-numeric: tabular-nums">{count}</span></button>
</div></div>'''
    legend = (f'<div style="display: flex; justify-content: center; gap: 18px; font-size: 12.5px; font-weight: 500; color: {MUTED}; margin-top: -2px">'
              f'<span style="display: flex; align-items: center; gap: 6px"><span style="width: 10px; height: 10px; border-radius: 999px; background: {TEXT}"></span>Intake</span>'
              f'<span style="display: flex; align-items: center; gap: 6px"><span style="width: 10px; height: 10px; border-radius: 999px; box-sizing: border-box; border: 2px solid {TEXT}"></span>Body and care</span></div>')
    mid = ''
    if back:
        mid = f'<div style="display: flex; justify-content: center">{btn("Back to Today", "outline", "back")}</div>'
    elif card:
        mid = card
    elif pills:
        mid = f'<div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap">{"".join(pills)}</div>'
    qs = qas if qas is not None else QA_DEFAULT
    grid = ''.join(qa(i, l) for i, l in qs) + qa('', '', more=True)
    log = ''
    if empty_log:
        log = (f'<div style="display: flex; flex-direction: column; gap: 8px">{section_label(log_label)}<div style="padding: 18px 16px; border-radius: 28px; {GLASS}; text-align: center; font-size: 14.5px; color: {SOFT}">Nothing logged on this day.</div></div>')
    else:
        n_html = f'<span style="font-size: 13px; color: {MUTED}">{log_n}</span>'
        log = (f'<div style="display: flex; flex-direction: column; gap: 8px; -webkit-mask-image: linear-gradient(to bottom, #000 45%, transparent 100%); mask-image: linear-gradient(to bottom, #000 45%, transparent 100%)">'
               f'{section_label(log_label, n_html)}{"".join(rows)}</div>')
    nav = tabbar('today', name) if tab else ''
    body = (f'<button aria-label="Settings" style="position: absolute; right: 20px; top: 54px; z-index: 2; width: 44px; height: 44px; border-radius: 999px; {GLASS_BLUR}; display: flex; align-items: center; justify-content: center">{svg(IC["sliders"], 21, TEXT, 1.8)}</button>'
            f'<div style="position: absolute; inset: 0; padding: 50px 20px 0 20px; box-sizing: border-box; display: flex; flex-direction: column; gap: 14px">{ring}{legend}{mid}'
            f'<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); row-gap: 12px; column-gap: 10px">{grid}</div>{log}</div>{nav}{overlay}')
    put(name, title, body, h=h)

# ------------------------------------------------------------------ LLM waits and confirmations (LL-5, LL-12)
def wait_arc(size=44):
    """Static 'working' arc. It is the one proposed motion (rotates only while a call runs): see Proposed additions."""
    return (f'<svg aria-hidden="true" width="{size}" height="{size}" viewBox="0 0 44 44" fill="none"><circle cx="22" cy="22" r="17" stroke="rgba(255,255,255,0.12)" stroke-width="4"/>'
            f'<path d="M22 5a17 17 0 0 1 14.7 8.5" stroke="@A@" stroke-width="4" stroke-linecap="round"/></svg>')

def inline_wait(text, elapsed=None, cancel=True):
    e = f'<span style="font-size: 13px; color: {MUTED}; font-variant-numeric: tabular-nums">{elapsed}</span>' if elapsed else ''
    c = btn('Cancel', 'glass', h=44, extra='; flex: none') if cancel else ''
    return (f'<div role="status" style="display: flex; align-items: center; gap: 12px; padding: 12px 12px 12px 16px; border-radius: 26px; background: rgba(255,255,255,0.05); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.10)">'
            f'{wait_arc(32)}<span style="flex: 1; min-width: 0"><span style="display: block; font-size: 14px; line-height: 19px; color: {SOFT}">{text}</span>{e}</span>{c}</div>')

def billing_note():
    return banner('Billed separately', 'This call is billed by Anthropic to your API account. It is not covered by a Claude subscription.', 'key')

def sent_list(lines, title='Sent to Anthropic'):
    items = ''.join(tick_row(l) for l in lines)
    return panel(f'<div style="font-size: 13px; font-weight: 600; letter-spacing: 1.4px; text-transform: uppercase; color: {MUTED}">{title}</div>{items}', gap=8)

def hypothesis(title, strength, evidence, against, uncertainty, lag=None):
    lg = f'<div style="font-size: 13px; color: {MUTED}">Typical delay: about {lag} h</div>' if lag else ''
    return panel(
        f'<div style="display: flex; align-items: center; justify-content: space-between; gap: 10px"><h3 style="margin: 0; font-size: 16px; font-weight: 700">{title}</h3>'
        f'<span style="flex: none; height: 26px; padding: 0 10px; border-radius: 999px; box-shadow: inset 0 0 0 1.5px rgba(255,255,255,0.34); font-size: 12.5px; font-weight: 600; color: {SOFT}; display: flex; align-items: center">{strength}</span></div>'
        f'<div><span style="font-size: 12.5px; font-weight: 600; letter-spacing: 1.2px; text-transform: uppercase; color: {MUTED}">Evidence</span><div style="font-size: 14px; line-height: 20px; color: {SOFT}; margin-top: 2px">{evidence}</div></div>'
        f'<div><span style="font-size: 12.5px; font-weight: 600; letter-spacing: 1.2px; text-transform: uppercase; color: {MUTED}">Against</span><div style="font-size: 14px; line-height: 20px; color: {SOFT}; margin-top: 2px">{against}</div></div>'
        f'<div><span style="font-size: 12.5px; font-weight: 600; letter-spacing: 1.2px; text-transform: uppercase; color: {MUTED}">Uncertainty</span><div style="font-size: 14px; line-height: 20px; color: {SOFT}; margin-top: 2px">{uncertainty}</div></div>{lg}', gap=10)

# ------------------------------------------------------------------ pushed screens
def pushed(name, title, header_title, sub, back, body, h=844, right='', tab=False, active='review', gap=18):
    put(name, title, content(gap=gap) + pushed_header(header_title, sub, back, right) + body + '</div>' + (tabbar(active, name) if tab else ''), h=h)

def settings_detail(name, title, header_title, sub, body, h=844, back='Back to Settings'):
    pushed(name, title, header_title, sub, back, body, h=h)

def stool_tile(n, label):
    return (f'<button aria-label="Stool type {n}, {label}" style="display: flex; align-items: center; gap: 10px; height: 52px; padding: 0 12px 0 6px; border-radius: 999px; {GLASS}">'
            f'<span style="width: 40px; height: 40px; border-radius: 999px; background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 800; font-variant-numeric: tabular-nums">{n}</span>'
            f'<span style="font-size: 14.5px; font-weight: 600">{label}</span></button>')

# ------------------------------------------------------------------ the finished reference boards' parts (trend_chart, entry_card, calendar, ...)
import contextlib, io, tempfile
_old_out = os.environ.get('DESIGN_OUT')
os.environ['DESIGN_OUT'] = tempfile.mkdtemp(prefix='ref_')
R = {'__file__': os.path.join(HERE, 'reference.py')}
with contextlib.redirect_stdout(io.StringIO()):
    exec(open(R['__file__']).read(), R)
if _old_out is None:
    del os.environ['DESIGN_OUT']
else:
    os.environ['DESIGN_OUT'] = _old_out

def float_primary(label, icon='check', note=None):
    """The one primary button of a screen that is not a Save form: floating at the bottom, like the form Save (UX-3)."""
    n = f'<span style="font-size: 13px; color: {MUTED}; text-align: center">{note}</span>' if note else ''
    return (f'<div class="ax-r ax-d5" style="position: absolute; left: 20px; right: 20px; bottom: 24px; display: flex; flex-direction: column; align-items: center; gap: 8px">{n}'
            f'<button style="width: 100%; height: 56px; border-radius: 999px; background: @A@; color: {ONACC}; font-size: 17px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 14px 34px rgba(0,0,0,0.45), 0 0 30px @S@">'
            f'{svg(IC[icon], 20, ONACC, 2.4)}{label}</button></div>')

def line_chart(vals, xlabels, aria, ymax=10, thresh=None, band_from=None, yticks=(0, 5, 10)):
    """A trend chart on the approved pattern: accent line with a soft fill, optional flare threshold and flare band."""
    W, H, L, T = 300, 150, 26, 8
    n = len(vals)
    xs = [L + i * (W - L - 6) / (n - 1) for i in range(n)]
    ys = [T + (ymax - v) * (H - T - 22) / ymax for v in vals]
    pts = ' '.join(f'{x:.1f},{y:.1f}' for x, y in zip(xs, ys))
    base = H - 22
    grid = ''.join(f'<line x1="{L}" x2="{W}" y1="{T + (ymax - g) * (H - T - 22) / ymax:.1f}" y2="{T + (ymax - g) * (H - T - 22) / ymax:.1f}" stroke="rgba(255,255,255,0.07)"/>'
                   f'<text x="{L - 8}" y="{T + (ymax - g) * (H - T - 22) / ymax + 4:.1f}" text-anchor="end" font-size="11" fill="{MUTED}">{g}</text>' for g in yticks)
    extra = ''
    if band_from is not None:
        bx = xs[band_from]
        extra += f'<rect x="{bx:.1f}" y="{T}" width="{W - bx:.1f}" height="{base - T}" fill="rgba(255,138,107,0.14)"/>'
    if thresh is not None:
        ty = T + (ymax - thresh) * (H - T - 22) / ymax
        extra += (f'<line x1="{L}" x2="{W}" y1="{ty:.1f}" y2="{ty:.1f}" stroke="{CORAL}" stroke-dasharray="4 4" stroke-width="1.2"/>'
                  f'<text x="{L + 4}" y="{ty - 5:.1f}" font-size="11" fill="{CORAL}" font-weight="600">flare {thresh}</text>')
    area = f'{xs[0]:.1f},{base} ' + pts + f' {xs[-1]:.1f},{base}'
    lab = ''.join(f'<text x="{x}" y="{H - 6}" text-anchor="{a}">{t}</text>' for t, x, a in zip(xlabels, (L, (L + W) / 2, W), ('start', 'middle', 'end')))
    return (f'<svg role="img" aria-label="{aria}" width="100%" height="150" viewBox="0 0 {W} {H}" preserveAspectRatio="none">'
            f'<defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="@A@" stop-opacity="0.32"/><stop offset="1" stop-color="@A@" stop-opacity="0"/></linearGradient></defs>'
            f'{grid}{extra}<polygon points="{area}" fill="url(#trendFill)"/><polyline points="{pts}" fill="none" stroke="@A@" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>'
            f'<circle cx="{xs[-1]:.1f}" cy="{ys[-1]:.1f}" r="4.5" fill="#FFFFFF" stroke="@A@" stroke-width="2.5"/><g font-size="11" fill="{MUTED}">{lab}</g></svg>')
