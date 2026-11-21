"""Reference screens for the Aurora ring design system (Skin, Daily health, Review, Area timeline,
Settings, Regular item, Delete sheet, empty Review). Reuses the shared parts of screens.py.
Placeholders: @A@ = accent, @S@ = soft accent, @L@ = accent line. Replaced when written."""
import os

SRC = open(os.path.join(os.path.dirname(__file__), 'screens.py')).read().split('# ---------------------------------------------------------------- 1.')[0]
ns = {'__file__': os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screens.py')}
exec(SRC, ns)
HEAD, TAIL, svg, IC, GLASS, GLASS_BLUR, OUT = ns['HEAD'], ns['TAIL'], ns['svg'], ns['IC'], ns['GLASS'], ns['GLASS_BLUR'], ns['OUT']
section_label, icon_circle, modal_top, MODAL_END, save_bar = ns['section_label'], ns['icon_circle'], ns['modal_top'], ns['MODAL_END'], ns['save_bar']

IC.update({
    'skin': '<path d="M6 12H22V14a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15L6 14Z" fill="url(#axWash)" stroke="none"/><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
    'health': '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" fill="url(#axWash)"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>',
    'stool': '<rect x="3.5" y="15.5" width="17" height="5" rx="2.5" transform="rotate(-3 12 18)" fill="url(#axWash)"/><rect x="6" y="10.5" width="12" height="5" rx="2.5" transform="rotate(3 12 13)" fill="url(#axWash)"/><rect x="8.5" y="6" width="7" height="4.5" rx="2.25" transform="rotate(-4 12 8)" fill="url(#axWash)"/><path d="M12 6c0-1.6.8-2.6 2.2-3.2"/>',
    'report': '<path d="M6 3h8l4 4v14H6Z" fill="url(#axWash)"/><path d="M14 3v4h4"/><path d="M9 12h6M9 15.5h6M9 19h3"/>',
    'bell': '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15Z" fill="url(#axWash)"/><path d="M10 21h4"/>',
    'lock': '<rect x="5" y="10.5" width="14" height="10" rx="3" fill="url(#axWash)"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    'key': '<circle cx="8" cy="15" r="4.5" fill="url(#axWash)"/><path d="M11.2 11.8 20 3M17 6l2.5 2.5M14.5 8.5 16.5 10.5"/>',
    'box': '<path d="M3.5 8 12 3.5 20.5 8v8L12 20.5 3.5 16Z"/><path d="M3.5 8 12 12.5 20.5 8M12 12.5v8" /><path d="M12 12.5 20.5 8v8L12 20.5Z" fill="url(#axWash)" stroke="none"/>',
    'trash': '<path d="M4 7h16M10 3.5h4M6 7l1 13h10l1-13"/><path d="M10 11v5.5M14 11v5.5"/>',
    'info': '<circle cx="12" cy="12" r="9" fill="url(#axWash)"/><path d="M12 11v5.5M12 7.8h.01"/>',
    'sliders': '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    'calendar': '<rect x="4" y="5" width="16" height="15" rx="3.5"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    'chart': '<path d="M6 20v-9M12 20V5M18 20v-6"/>',
    'list': '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    'tag': '<path d="M3.5 12.5V4.5h8l9 9-8 8Z" fill="url(#axWash)"/><circle cx="8" cy="9" r="1.4"/>',
    'sun': '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    'flame': '<path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3 0-6 1-9z"/>',
    'copy': '<rect x="8.5" y="8.5" width="12" height="12" rx="3" fill="url(#axWash)"/><path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/>',
})

def write(name, title, body, h=844, w=390, extra_defs=''):
    head = HEAD.format(title=title).replace('width: 390px; height: 844px', f'width: {w}px; height: {h}px')
    tail = TAIL.replace('"$preview":{"width":390,"height":844}', f'"$preview":{{"width":{w},"height":{h}}}')
    if extra_defs:
        head = head.replace('</defs>', extra_defs + '\n</defs>', 1)
    html = (head + body + tail).replace('@A@', '{{accent}}').replace('@S@', '{{accentSoft}}').replace('@L@', '{{accentLine}}')
    with open(os.path.join(OUT, name), 'w') as f:
        f.write(html)

CORAL = '#FF8A6B'
MINUS = '<path d="M5 12h14"/>'
MUTED = '#9AA4B2'
SOFT = '#C9D0DA'

# ------------------------------------------------------------------ building blocks
def btn(label, kind='glass', icon=None, full=False, h=44, extra=''):
    styles = {
        'primary': 'background: @A@; color: #062A26; font-weight: 800',
        'glass': GLASS + '; font-weight: 600',
        'outline': 'box-shadow: inset 0 0 0 1.5px @L@; color: @A@; font-weight: 700',
        'danger': f'background: rgba(255,138,107,0.12); box-shadow: inset 0 0 0 1px rgba(255,138,107,0.40); color: {CORAL}; font-weight: 700',
        'dangerSolid': f'background: {CORAL}; color: #2A0D04; font-weight: 800',
    }
    stroke = {'primary': '#062A26', 'outline': '@A@', 'danger': CORAL, 'dangerSolid': '#2A0D04'}.get(kind, '#F2F5F9')
    ic = svg(IC[icon], 18, stroke, 2) if icon else ''
    width = 'width: 100%; ' if full else ''
    return (f'<button style="{width}height: {h}px; padding: 0 18px; border-radius: 999px; {styles[kind]}; font-size: 15.5px; '
            f'display: flex; align-items: center; justify-content: center; gap: 8px{extra}">{ic}{label}</button>')

def switch(on):
    if on:
        return ('<span aria-hidden="true" style="width: 51px; height: 31px; border-radius: 999px; background: @A@; position: relative; flex: none">'
                '<span style="position: absolute; right: 2px; top: 2px; width: 27px; height: 27px; border-radius: 999px; background: #FFFFFF; box-shadow: 0 2px 6px rgba(0,0,0,0.3)"></span></span>')
    return ('<span aria-hidden="true" style="width: 51px; height: 31px; border-radius: 999px; background: rgba(255,255,255,0.34); position: relative; flex: none">'
            '<span style="position: absolute; left: 2px; top: 2px; width: 27px; height: 27px; border-radius: 999px; background: #E6EAF0; box-shadow: 0 2px 6px rgba(0,0,0,0.3)"></span></span>')

def toggle_row(title, on, hint=None, icon=None):
    ic = icon_circle(icon, 34, 19) if icon else ''
    hint_html = f'<span style="display: block; font-size: 13px; line-height: 18px; color: {MUTED}; margin-top: 2px">{hint}</span>' if hint else ''
    return (f'<button role="switch" aria-checked="{"true" if on else "false"}" style="display: flex; align-items: center; gap: 12px; padding: 12px 14px 12px 16px; border-radius: 26px; {GLASS}">'
            f'{ic}<span style="flex: 1; min-width: 0"><span style="display: block; font-size: 15.5px; font-weight: 600">{title}</span>{hint_html}</span>{switch(on)}</button>')

def score_row(label, value, optional=False):
    shown = '–' if value is None else str(value)
    if value is None:
        track = '<span style="position: absolute; left: 0; right: 0; top: 0; height: 6px; border-radius: 999px; background: rgba(255,255,255,0.10)"></span>'
        tail_btn = f'<span style="font-size: 12.5px; color: {MUTED}">not set</span>'
    else:
        pct = value * 10
        track = (f'<span style="position: absolute; left: 0; right: 0; top: 0; height: 6px; border-radius: 999px; background: rgba(255,255,255,0.12)"></span>'
                 f'<span style="position: absolute; left: 0; width: {pct}%; top: 0; height: 6px; border-radius: 999px; background: @A@; box-shadow: 0 0 12px @S@"></span>'
                 f'<span style="position: absolute; left: calc({pct}% - 12px); top: -9px; width: 24px; height: 24px; border-radius: 999px; background: #FFFFFF; box-shadow: 0 2px 8px rgba(0,0,0,0.4)"></span>')
        tail_btn = (f'<button aria-label="Clear {label}" style="font-size: 12.5px; font-weight: 600; color: @A@">Clear</button>' if optional else '')
    step = lambda sym, lab: (f'<button aria-label="{lab} {label}" style="width: 36px; height: 36px; border-radius: 999px; {GLASS}; display: flex; align-items: center; justify-content: center; flex: none">'
                             f'{svg(IC["plus"] if sym == "+" else MINUS, 16, "#F2F5F9", 2.4)}</button>')
    return (f'<div role="group" aria-label="{label}" style="display: flex; flex-direction: column; gap: 10px; padding: 12px 14px 14px 16px; border-radius: 26px; {GLASS}">'
            f'<div style="display: flex; align-items: baseline; gap: 8px"><span style="flex: 1; font-size: 15.5px; font-weight: 600">{label}</span>{tail_btn}'
            f'<span style="font-size: 22px; font-weight: 800; min-width: 26px; text-align: right; font-variant-numeric: tabular-nums">{shown}</span></div>'
            f'<div style="display: flex; align-items: center; gap: 12px">{step("-", "Decrease")}'
            f'<span style="position: relative; flex: 1; height: 6px">{track}</span>{step("+", "Increase")}</div></div>')

def chip(text, state='plain', icon=None, dot=None):
    d = f'<span style="width: 7px; height: 7px; border-radius: 999px; background: {dot}"></span>' if dot else ''
    if state == 'on':
        return (f'<button aria-pressed="true" style="height: 38px; display: flex; align-items: center; gap: 6px; padding: 0 14px 0 10px; border-radius: 999px; '
                f'background: @A@; color: #062A26; font-size: 14.5px; font-weight: 700">{svg(IC["check"], 16, "#062A26", 2.6)}{text}{d}</button>')
    return (f'<button aria-pressed="false" style="height: 38px; display: flex; align-items: center; gap: 6px; padding: 0 14px; border-radius: 999px; '
            f'box-shadow: inset 0 0 0 1.5px rgba(255,255,255,0.34); font-size: 14.5px; font-weight: 500; color: {SOFT}">{text}{d}</button>')

def nav_row(icon, title, value=None, sub=None, danger=False, last=False):
    color = CORAL if danger else '#F2F5F9'
    ic = (f'<span style="width: 34px; height: 34px; border-radius: 999px; background: rgba(255,138,107,0.14); display: flex; align-items: center; justify-content: center; flex: none">{svg(IC[icon], 19, CORAL, 1.8)}</span>'
          if danger else icon_circle(icon, 34, 19))
    val = f'<span style="font-size: 14.5px; color: {MUTED}">{value}</span>' if value else ''
    s = f'<span style="display: block; font-size: 12.5px; color: {MUTED}; margin-top: 1px">{sub}</span>' if sub else ''
    border = '' if last else 'border-bottom: 1px solid rgba(255,255,255,0.07); '
    chev = '' if danger else svg(IC['chev'], 16, MUTED, 2)
    return (f'<button style="display: flex; align-items: center; gap: 12px; min-height: 54px; padding: 8px 4px; {border}">'
            f'{ic}<span style="flex: 1; min-width: 0"><span style="display: block; font-size: 15.5px; font-weight: 600; color: {color}">{title}</span>{s}</span>{val}{chev}</button>')

def group(title, rows):
    return (f'<div style="display: flex; flex-direction: column; gap: 8px">{section_label(title)}'
            f'<div style="display: flex; flex-direction: column; padding: 2px 14px; border-radius: 28px; {GLASS_BLUR}">{"".join(rows)}</div></div>')

def pushed_header(title, sub=None, back='Back', right=''):
    s = f'<div style="font-size: 14px; color: {MUTED}; margin-top: 2px">{sub}</div>' if sub else ''
    return (f'<div class="ax-r ax-d1" style="display: flex; align-items: center; gap: 12px">'
            f'<button aria-label="{back}" style="width: 44px; height: 44px; border-radius: 999px; {GLASS_BLUR}; display: flex; align-items: center; justify-content: center; flex: none">{svg(IC["back"], 20, "#F2F5F9", 2)}</button>'
            f'<div style="flex: 1; min-width: 0"><h1 style="margin: 0; font-size: 30px; line-height: 34px; font-weight: 800; letter-spacing: -0.8px">{title}</h1>{s}</div>{right}</div>')

def gear():
    return (f'<button aria-label="Settings" style="width: 44px; height: 44px; border-radius: 999px; {GLASS_BLUR}; display: flex; align-items: center; justify-content: center; flex: none">{svg(IC["sliders"], 21, "#F2F5F9", 1.8)}</button>')

def tabbar(active, name):
    def tab(label, icon, on):
        if on:
            return (f'<a href="{name}" aria-current="page" style="display: flex; align-items: center; gap: 8px; height: 52px; padding: 0 22px; border-radius: 999px; background: @A@; color: #062A26; text-decoration: none; font-size: 15.5px; font-weight: 700">{svg(icon, 22, "#062A26", 2)}{label}</a>')
        return (f'<a href="{name}" style="display: flex; align-items: center; gap: 8px; height: 52px; padding: 0 22px; border-radius: 999px; color: {SOFT}; text-decoration: none; font-size: 15.5px; font-weight: 600">{svg(icon, 22, SOFT, 1.9)}{label}</a>')
    clock = '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>'
    return (f'<nav aria-label="Main" style="position: absolute; left: 0; right: 0; bottom: 26px; display: flex; justify-content: center">'
            f'<div style="display: flex; align-items: center; gap: 4px; padding: 6px; border-radius: 999px; background: rgba(20,26,38,0.72); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.14), 0 18px 40px rgba(0,0,0,0.5); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px)">'
            f'{tab("Today", clock, active == "today")}{tab("Review", IC["chart"], active == "review")}</div></nav>')

def photo(label, sensitive=False, size=76):
    lock = (f'<span style="position: absolute; right: 6px; top: 6px; width: 22px; height: 22px; border-radius: 999px; background: rgba(7,11,18,0.7); display: flex; align-items: center; justify-content: center">{svg(IC["lock"], 13, "#F2F5F9", 2)}</span>' if sensitive else '')
    blur = 'filter: blur(6px); ' if sensitive else ''
    return (f'<button aria-label="Photo, {label}" style="position: relative; width: {size}px; height: {size}px; border-radius: 22px; overflow: hidden; flex: none; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.14)">'
            f'<span style="position: absolute; inset: -8px; {blur}background: radial-gradient(60% 50% at 40% 45%, #C9A39A 0%, #8E6E68 55%, #3B302F 100%)"></span>{lock}'
            f'<span style="position: absolute; left: 0; right: 0; bottom: 0; padding: 14px 6px 5px 6px; background: linear-gradient(transparent, rgba(7,11,18,0.75)); font-size: 11px; font-weight: 600; color: #F2F5F9; text-align: center">{label}</span></button>')

def content(pad_top=54, gap=16):
    return f'<div style="position: absolute; inset: 0; padding: {pad_top}px 20px 120px 20px; box-sizing: border-box; display: flex; flex-direction: column; gap: {gap}px">'

def time_and_note():
    return (f'<div class="ax-r ax-d4" style="display: flex; gap: 8px">'
            f'<button style="height: 44px; display: flex; align-items: center; gap: 6px; padding: 0 16px 0 12px; border-radius: 999px; {GLASS}; font-size: 14.5px; font-weight: 600; flex: none">{svg(IC["clock"], 17)}Now · 14:20</button>'
            f'<div style="flex: 1; min-width: 0; display: flex; align-items: center; height: 44px; padding: 0 16px; border-radius: 999px; {GLASS}">'
            f'<label for="note" style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">Note</label>'
            f'<input id="note" placeholder="Note (optional)" style="flex: 1; min-width: 0; height: 40px; font-size: 15px"></div></div>')

# ------------------------------------------------------------------ 1. Skin form
skin = modal_top('Log skin status') + f'''
<div class="ax-r ax-d1" style="display: flex; flex-direction: column; gap: 10px">
{section_label("Area")}
<div style="display: flex; flex-wrap: wrap; gap: 8px">{chip("Chin", "on", dot=CORAL)}{chip("Neck")}{chip("Ears, inside")}{chip("Behind the ears")}{chip("Sternum")}{chip("+ 3 more")}</div>
</div>
<div class="ax-r ax-d2" style="display: flex; gap: 8px">
{btn("No change", "outline", "check")}
{btn("No change for all areas", "glass", extra="; flex: 1")}
</div>
<div class="ax-r ax-d2" style="display: flex; align-items: baseline; justify-content: space-between; padding: 0 4px; margin-bottom: -6px">
<span style="font-size: 13px; color: {MUTED}">Starts from the last entry, 12 Nov</span><span style="font-size: 13px; color: {MUTED}">0 none · 10 worst</span>
</div>
<div class="ax-r ax-d3" style="display: flex; flex-direction: column; gap: 8px">
{score_row("Severity", 8)}{score_row("Itch", 6)}{score_row("Pain", 3)}{score_row("Dryness", 7)}{score_row("Scaling", 6)}
</div>
<div class="ax-r ax-d3" style="display: flex; flex-direction: column; gap: 8px">
{toggle_row("Cracks or open wounds", False)}
{nav_row("sliders", "Details", "Size: not set", last=True).replace('<button style="', f'<button style="padding-left: 12px; padding-right: 14px; border-radius: 26px; {GLASS}; ', 1)}
</div>
<div class="ax-r ax-d4" style="display: flex; flex-direction: column; gap: 10px">
{section_label("Photos", f'<span style="font-size: 13px; color: {MUTED}">stay on this phone</span>')}
<div style="display: flex; gap: 10px">
<button aria-label="Add a photo" style="width: 76px; height: 76px; border-radius: 22px; border: 1.5px dashed rgba(255,255,255,0.34); box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-size: 12px; font-weight: 600; color: @A@">{svg(IC["camera"], 22, "@A@", 1.8)}Add</button>
{photo("14:12")}
</div>
</div>
{time_and_note()}
''' + save_bar('Save skin entry') + MODAL_END
write('Ref-Skin.dc.html', 'Log skin status', skin, h=1180)

# ------------------------------------------------------------------ 2. Daily health
tags = [('Bloating', False), ('Illness or infection', False), ('Antibiotics', False), ('Shaving', True), ('Heavy sweating', False),
        ('Sauna or pool', False), ('Sun exposure', False), ('Travel', False), ('Nicotine', False), ('Joint symptoms', False),
        ('Hot or long shower', True), ('Friction, intimate area', False)]
daily = modal_top('Daily health') + f'''
<div class="ax-r ax-d1" style="display: flex; align-items: center; gap: 10px">
<div style="flex: 1"><div style="font-size: 12.5px; font-weight: 600; letter-spacing: 1.8px; text-transform: uppercase; color: @A@">Saturday</div><div style="font-size: 26px; font-weight: 800; letter-spacing: -0.6px">14 Nov</div></div>
{btn("Same as yesterday", "outline", "copy")}
</div>
<div class="ax-r ax-d2" style="display: flex; flex-direction: column; gap: 8px">
{section_label("Scores", f'<span style="font-size: 13px; color: {MUTED}">0 to 10</span>')}
{score_row("Wellbeing", 6)}{score_row("Stress", 4)}{score_row("Sleep quality", 7)}{score_row("Abdominal pain", None, optional=True)}
</div>
<div class="ax-r ax-d3" style="display: flex; flex-direction: column; gap: 10px">
{section_label("Today I had", f'<span style="font-size: 13px; color: {MUTED}">only a yes is saved</span>')}
<div style="display: flex; flex-wrap: wrap; gap: 8px">{"".join(chip(t, "on" if on else "plain") for t, on in tags)}</div>
</div>
{time_and_note().replace(f'<button style="height: 44px; display: flex; align-items: center; gap: 6px; padding: 0 16px 0 12px; border-radius: 999px; {GLASS}; font-size: 14.5px; font-weight: 600; flex: none">{svg(IC["clock"], 17)}Now · 14:20</button>', '')}
''' + save_bar('Save Daily health') + MODAL_END
write('Ref-DailyHealth.dc.html', 'Daily health', daily, h=1120)

# ------------------------------------------------------------------ 3. Review, Days
def calendar():
    wk = ''.join(f'<span style="text-align: center; font-size: 12px; font-weight: 600; color: {MUTED}">{d}</span>' for d in 'MTWTFSS')
    cells = ['<span></span>'] * 6  # 1 Nov 2026 is a Sunday
    for d in range(1, 31):
        future = d > 14
        flare = d in (12, 13, 14)
        health = d <= 13 and d not in (5, 9)
        entries = d <= 14
        today = d == 14
        bg = 'background: rgba(255,138,107,0.20); ' if flare else ''
        ring = 'box-shadow: inset 0 0 0 1.8px @A@; ' if health else ''
        if today:
            ring = 'box-shadow: inset 0 0 0 1.8px #F2F5F9; '
        op = 'opacity: 0.3; ' if future else ''
        dot = '<span style="position: absolute; bottom: 4px; left: 50%; margin-left: -2px; width: 4px; height: 4px; border-radius: 999px; background: #F2F5F9"></span>' if entries else ''
        cells.append(f'<button aria-label="{d} November" style="position: relative; height: 40px; border-radius: 999px; {bg}{ring}{op}font-size: 14px; font-weight: {800 if today else 500}; font-variant-numeric: tabular-nums; display: flex; align-items: center; justify-content: center">{d}{dot}</button>')
    return (f'<div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); row-gap: 4px; column-gap: 4px">{wk}{"".join(cells)}</div>')

def day_row(day, n, health):
    h = (f'<span style="display: flex; align-items: center; gap: 4px; font-size: 13px; color: @A@">{svg(IC["check"], 14, "@A@", 2.4)}Daily health</span>' if health
         else f'<span style="font-size: 13px; color: {MUTED}">no Daily health</span>')
    return (f'<button style="display: flex; align-items: center; gap: 12px; padding: 10px 16px 10px 18px; border-radius: 999px; {GLASS}">'
            f'<span style="flex: 1; min-width: 0"><span style="display: block; font-size: 15.5px; font-weight: 600">{day}</span><span style="display: block; font-size: 13px; color: {MUTED}">{n} entries</span></span>{h}{svg(IC["chev"], 16, MUTED, 2)}</button>')

segmented = (f'<div role="tablist" style="display: flex; padding: 4px; border-radius: 999px; {GLASS_BLUR}">'
             f'<button role="tab" aria-selected="true" style="flex: 1; height: 40px; border-radius: 999px; background: rgba(255,255,255,0.14); font-size: 15px; font-weight: 700">Days</button>'
             f'<button role="tab" aria-selected="false" style="flex: 1; height: 40px; border-radius: 999px; font-size: 15px; font-weight: 600; color: {SOFT}">Areas</button></div>')

def output_card(icon, title, sub):
    return (f'<button style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px; padding: 14px; border-radius: 28px; {GLASS_BLUR}">'
            f'{icon_circle(icon, 40, 22)}<span><span style="display: block; font-size: 16px; font-weight: 700">{title}</span><span style="display: block; font-size: 13px; color: {MUTED}; margin-top: 2px">{sub}</span></span></button>')

review = content() + f'''
<div class="ax-r ax-d1" style="display: flex; align-items: center; justify-content: space-between; padding-left: 4px"><h1 style="margin: 0; font-size: 34px; font-weight: 800; letter-spacing: -1px">Review</h1>{gear()}</div>
<div class="ax-r ax-d2" style="display: flex; gap: 10px">{output_card("report", "Doctor report", "Since last export")}{output_card("sparkle", "AI analysis", "Last run 2 Nov")}</div>
<div class="ax-r ax-d3">{segmented}</div>
<div class="ax-r ax-d3" style="display: flex; flex-direction: column; gap: 12px; padding: 14px 12px 16px 12px; border-radius: 30px; {GLASS_BLUR}">
<div style="display: flex; align-items: center; justify-content: space-between">
<button aria-label="Previous month" style="width: 40px; height: 40px; border-radius: 999px; display: flex; align-items: center; justify-content: center">{svg(IC["back"], 19, "#F2F5F9", 2)}</button>
<button aria-label="Jump to a month" style="font-size: 17px; font-weight: 700">November 2026</button>
<button aria-label="Next month, not available" disabled style="width: 40px; height: 40px; border-radius: 999px; display: flex; align-items: center; justify-content: center; opacity: 0.3; cursor: default">{svg(IC["chev"], 19, "#F2F5F9", 2)}</button>
</div>
{calendar()}
<div style="display: flex; justify-content: center; gap: 14px; font-size: 12px; color: {MUTED}">
<span style="display: flex; align-items: center; gap: 5px"><span style="width: 5px; height: 5px; border-radius: 999px; background: #F2F5F9"></span>entries</span>
<span style="display: flex; align-items: center; gap: 5px"><span style="width: 12px; height: 12px; border-radius: 999px; box-shadow: inset 0 0 0 1.6px @A@"></span>Daily health</span>
<span style="display: flex; align-items: center; gap: 5px"><span style="width: 12px; height: 12px; border-radius: 999px; background: rgba(255,138,107,0.35)"></span>flare</span>
</div>
</div>
<div class="ax-r ax-d4" style="display: flex; align-items: center; justify-content: space-between">
{section_label("Days")}
<button aria-pressed="false" style="height: 34px; padding: 0 14px; border-radius: 999px; box-shadow: inset 0 0 0 1.5px rgba(255,255,255,0.34); font-size: 13.5px; font-weight: 600; color: {SOFT}">Incomplete days</button>
</div>
<div class="ax-r ax-d5" style="display: flex; flex-direction: column; gap: 8px; -webkit-mask-image: linear-gradient(to bottom, #000 55%, transparent 100%); mask-image: linear-gradient(to bottom, #000 55%, transparent 100%)">
{day_row("Saturday, 14 Nov", 3, False)}{day_row("Friday, 13 Nov", 7, True)}{day_row("Thursday, 12 Nov", 6, True)}
</div>
</div>
{tabbar("review", "Ref-Review.dc.html")}
'''
write('Ref-Review.dc.html', 'Review', review, h=1180)

# ------------------------------------------------------------------ 4. Area timeline
def trend_chart():
    vals = [4, 4, 5, 3, 3, 2, 3, 4, 4, 5, 5, 4, 3, 3, 4, 5, 6, 5, 5, 6, 6, 7, 7, 6, 7, 7, 8, 8, 8]
    W, H, L, T = 300, 150, 26, 8
    xs = [L + i * (W - L - 6) / (len(vals) - 1) for i in range(len(vals))]
    ys = [T + (10 - v) * (H - T - 22) / 10 for v in vals]
    pts = ' '.join(f'{x:.1f},{y:.1f}' for x, y in zip(xs, ys))
    y8 = T + 2 * (H - T - 22) / 10
    base = H - 22
    grid = ''.join(f'<line x1="{L}" x2="{W}" y1="{T + (10 - g) * (H - T - 22) / 10:.1f}" y2="{T + (10 - g) * (H - T - 22) / 10:.1f}" stroke="rgba(255,255,255,0.07)"/>'
                   f'<text x="{L - 8}" y="{T + (10 - g) * (H - T - 22) / 10 + 4:.1f}" text-anchor="end" font-size="11" fill="{MUTED}">{g}</text>' for g in (0, 5, 10))
    flare_x = xs[-3]
    area = f'{xs[0]:.1f},{base} ' + pts + f' {xs[-1]:.1f},{base}'
    return (f'<svg role="img" aria-label="Severity for Chin over all entries, from 4 to 8; at the flare threshold since 12 Nov" width="100%" height="150" viewBox="0 0 {W} {H}" preserveAspectRatio="none">'
            f'<defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="@A@" stop-opacity="0.32"/><stop offset="1" stop-color="@A@" stop-opacity="0"/></linearGradient></defs>'
            f'{grid}<rect x="{flare_x:.1f}" y="{T}" width="{W - flare_x:.1f}" height="{base - T}" fill="rgba(255,138,107,0.14)"/>'
            f'<line x1="{L}" x2="{W}" y1="{y8:.1f}" y2="{y8:.1f}" stroke="{CORAL}" stroke-dasharray="4 4" stroke-width="1.2"/>'
            f'<text x="{L + 4}" y="{y8 - 5:.1f}" font-size="11" fill="{CORAL}" font-weight="600">flare 8</text>'
            f'<polygon points="{area}" fill="url(#trendFill)"/><polyline points="{pts}" fill="none" stroke="@A@" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>'
            f'<circle cx="{xs[-1]:.1f}" cy="{ys[-1]:.1f}" r="4.5" fill="#FFFFFF" stroke="@A@" stroke-width="2.5"/>'
            f'<g font-size="11" fill="{MUTED}"><text x="{L}" y="{H - 6}">15 Oct</text><text x="{(L + W) / 2:.0f}" y="{H - 6}" text-anchor="middle">31 Oct</text><text x="{W}" y="{H - 6}" text-anchor="end">14 Nov</text></g></svg>')

def entry_card(day, scores, photos, caption):
    sc = ''.join(f'<span style="display: flex; flex-direction: column; align-items: center; gap: 1px; min-width: 40px"><span style="font-size: 17px; font-weight: 800; font-variant-numeric: tabular-nums">{v}</span><span style="font-size: 11px; color: {MUTED}">{k}</span></span>' for k, v in scores)
    ph = ''.join(photo(p, size=64) for p in photos)
    return (f'<button style="display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border-radius: 28px; {GLASS_BLUR}">'
            f'<span style="display: flex; align-items: center; justify-content: space-between"><span style="font-size: 15.5px; font-weight: 700">{day}</span>{svg(IC["chev"], 16, MUTED, 2)}</span>'
            f'<span style="display: flex; justify-content: space-between">{sc}</span>'
            f'<span style="display: flex; align-items: center; gap: 10px">{ph}<span style="font-size: 12.5px; line-height: 17px; color: {SOFT}">{caption}</span></span></button>')

score_chips = ''.join(
    (f'<button aria-pressed="true" style="height: 34px; padding: 0 12px; border-radius: 999px; background: rgba(255,255,255,0.16); font-size: 13.5px; font-weight: 700">{n}</button>' if i == 0
     else f'<button aria-pressed="false" style="height: 34px; padding: 0 12px; border-radius: 999px; font-size: 13.5px; font-weight: 600; color: {SOFT}">{n}</button>')
    for i, n in enumerate(['Severity', 'Itch', 'Pain', 'Dryness', 'Scaling']))

timeline = content() + f'''
{pushed_header("Chin", "Skin · flare since 12 Nov", "Back to Review", btn("Go to date", "glass", "calendar", h=40))}
<div class="ax-r ax-d2" style="display: flex; flex-direction: column; gap: 10px; padding: 14px 14px 12px 14px; border-radius: 30px; {GLASS_BLUR}">
<div style="display: flex; align-items: center; justify-content: space-between"><h2 style="margin: 0; font-size: 16px; font-weight: 700">Trend</h2><span style="font-size: 13px; color: {MUTED}">All</span></div>
<div style="display: flex; gap: 2px; overflow-x: auto; margin: 0 -4px">{score_chips}</div>
{trend_chart()}
<p style="margin: 0; font-size: 12.5px; line-height: 18px; color: {MUTED}">Severity, 15 Oct to 14 Nov: from 4 to 8, lowest 2, highest 8.</p>
</div>
<div class="ax-r ax-d3">{btn("Compare two photos", "glass", "camera", full=True, h=48)}</div>
<div class="ax-r ax-d4" style="display: flex; flex-direction: column; gap: 10px; -webkit-mask-image: linear-gradient(to bottom, #000 60%, transparent 100%); mask-image: linear-gradient(to bottom, #000 60%, transparent 100%)">
{section_label("Entries")}
{entry_card("Saturday, 14 Nov", [("Sev", 8), ("Itch", 6), ("Pain", 3), ("Dry", 7), ("Scal", 6)], ["14:12"], "Emollient 5 h before this photo")}
{entry_card("Thursday, 12 Nov", [("Sev", 8), ("Itch", 7), ("Pain", 4), ("Dry", 7), ("Scal", 6)], ["20:40", "20:41"], "No treatment logged in the 7 days before")}
</div>
</div>
'''
write('Ref-AreaTimeline.dc.html', 'Chin, area timeline', timeline, h=1180)

# ------------------------------------------------------------------ 5. Settings
settings = content(gap=18) + f'''
{pushed_header("Settings", None, "Back to Today")}
<div class="ax-r ax-d2">{group("Logging", [
    nav_row("list", "Suggestions", "5 rows, 30 days"), nav_row("clock", "Day starts at", "00:00"), nav_row("flame", "Flare threshold", "8"),
    nav_row("health", "Daily health items", "12"), nav_row("skin", "Skin and nail areas", "9"), nav_row("treatment", "Treatments", "3"),
    nav_row("bell", "Regular items", "2"), nav_row("change", "Routine categories", "2"), nav_row("star", "Favorites", "4", last=True)])}</div>
<div class="ax-r ax-d3">{group("Reminders and privacy", [nav_row("bell", "Reminders", "3 on"), nav_row("lock", "Privacy and photos", "App lock on", last=True)])}</div>
<div class="ax-r ax-d3">{group("AI analysis", [nav_row("key", "API key", "saved"), nav_row("sparkle", "Models", "Haiku 5.5", last=True)])}</div>
<div class="ax-r ax-d4">{group("Data and backup", [nav_row("box", "Export and import", "9 days ago"), nav_row("trash", "Delete data", danger=True, last=True)])}</div>
<div class="ax-r ax-d5">{group("About", [nav_row("guide", "Where do I log…?"), nav_row("info", "About Nettle", "0.1.0", last=True)])}</div>
</div>
'''
write('Ref-Settings.dc.html', 'Settings', settings, h=1330)

# ------------------------------------------------------------------ 6. Regular item
def time_chip(t):
    return (f'<span style="height: 44px; display: flex; align-items: center; gap: 8px; padding: 0 6px 0 16px; border-radius: 999px; {GLASS}; font-size: 17px; font-weight: 700; font-variant-numeric: tabular-nums">{t}'
            f'<button aria-label="Remove {t}" style="width: 32px; height: 32px; border-radius: 999px; background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center">{svg(IC["x"], 14, "#F2F5F9", 2.2)}</button></span>')

regular = content(gap=18) + f'''
{pushed_header("Emollient", "Treatment · Chin, Neck", "Back to Regular items")}
<div class="ax-r ax-d2" style="display: flex; flex-direction: column; gap: 10px">
{section_label("Reminder times")}
<div style="display: flex; flex-wrap: wrap; gap: 8px">{time_chip("08:00")}{time_chip("21:00")}
<button style="height: 44px; display: flex; align-items: center; gap: 6px; padding: 0 16px 0 12px; border-radius: 999px; border: 1.5px dashed rgba(255,255,255,0.34); box-sizing: border-box; font-size: 14.5px; font-weight: 600; color: @A@">{svg(IC["plus"], 15, "@A@", 2.4)}Add a time</button></div>
</div>
<div class="ax-r ax-d3">{toggle_row("Hide the name in reminders", False, "A reminder then says only “Time for your treatment”. It never shows a dose or a note.")}</div>
<div class="ax-r ax-d3" style="display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 26px; background: rgba(255,255,255,0.04); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08)">
{icon_circle("bell", 36, 20)}<span style="font-size: 13.5px; line-height: 19px; color: {SOFT}">The reminder reads “Time for Emollient” and has one button, Applied, which logs it at the time of the tap.</span>
</div>
<div style="flex: 1"></div>
<div class="ax-r ax-d4" style="display: flex; flex-direction: column; gap: 8px; align-items: center; margin-bottom: -76px">
{btn("Stop regular item", "danger", "x", full=True, h=52)}
<span style="font-size: 12.5px; color: {MUTED}">Its reminders end. Entries already logged stay.</span>
</div>
</div>
'''
write('Ref-RegularItem.dc.html', 'Regular item', regular)

# ------------------------------------------------------------------ 7. Delete sheet
delete = f'''<div aria-hidden="true" style="position: absolute; inset: 0; padding: 50px 20px 0 20px; box-sizing: border-box; opacity: 0.4; filter: blur(1.5px)">
<div style="margin: 0 auto; width: 256px; height: 256px; border-radius: 999px; {GLASS}; position: relative"><div style="position: absolute; inset: 14px; border-radius: 999px; border: 10px solid rgba(255,255,255,0.08)"></div>
<div style="position: absolute; left: 0; right: 0; top: 104px; text-align: center; font-size: 38px; font-weight: 800">14 Nov</div></div>
<div style="margin-top: 260px; display: flex; flex-direction: column; gap: 8px">
<div style="height: 56px; border-radius: 999px; {GLASS}"></div><div style="height: 56px; border-radius: 999px; {GLASS}"></div></div>
</div>
<div aria-hidden="true" style="position: absolute; inset: 0; background: rgba(3,6,10,0.55)"></div>

<!-- Swiped row: the gesture reveals Delete, which asks in the sheet below -->
<div aria-hidden="true" style="position: absolute; left: 20px; right: 20px; top: 610px; height: 56px; display: flex; gap: 8px; opacity: 0.9">
<div style="flex: 1; display: flex; align-items: center; gap: 12px; padding: 8px 16px 8px 8px; border-radius: 999px; background: rgba(30,38,52,0.95); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12); transform: translateX(-12px)">
{icon_circle("meal", 40, 22)}<span style="flex: 1; font-size: 15.5px; font-weight: 600">Chicken salad</span><span style="font-size: 13.5px; color: {MUTED}">12:40</span></div>
<div style="width: 86px; border-radius: 999px; background: {CORAL}; color: #2A0D04; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 14.5px; font-weight: 800">{svg(IC["trash"], 17, "#2A0D04", 2)}Delete</div>
</div>

<div class="ax-s" role="alertdialog" aria-label="Delete Chicken salad?" style="position: absolute; left: 10px; right: 10px; bottom: 12px; display: flex; flex-direction: column; gap: 8px">
<div style="display: flex; flex-direction: column; gap: 6px; padding: 18px 16px 16px 16px; border-radius: 36px; background: rgba(16,22,33,0.9); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12), 0 30px 60px rgba(0,0,0,0.55); backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px)">
<div style="text-align: center; font-size: 16px; font-weight: 700">Delete Chicken salad, 12:40?</div>
<div style="text-align: center; font-size: 13.5px; line-height: 19px; color: {SOFT}; padding: 0 12px 6px 12px">Also deletes 1 reaction. This cannot be undone here; a backup can restore it.</div>
{btn("Delete", "dangerSolid", "trash", full=True, h=54)}
</div>
{btn("Cancel", "glass", full=True, h=56, extra="; background: rgba(16,22,33,0.9); backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px); font-size: 17px")}
</div>
'''
write('Ref-DeleteSheet.dc.html', 'Delete an entry', delete)

# ------------------------------------------------------------------ 8. Empty Review
empty = content() + f'''
<div class="ax-r ax-d1" style="display: flex; align-items: center; justify-content: space-between; padding-left: 4px"><h1 style="margin: 0; font-size: 34px; font-weight: 800; letter-spacing: -1px">Review</h1>{gear()}</div>
<div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; text-align: center; padding-bottom: 40px">
<div class="ax-r ax-d2" aria-hidden="true" style="position: relative; width: 190px; height: 190px; border-radius: 999px; {GLASS_BLUR}; display: flex; align-items: center; justify-content: center">
<div style="position: absolute; inset: 14px; border-radius: 999px; border: 2px dashed rgba(255,255,255,0.18)"></div>
<div style="position: absolute; inset: 40px; border-radius: 999px; border: 2px dashed rgba(255,255,255,0.10)"></div>
{svg(IC["chart"], 40, "@A@", 1.8)}
</div>
<div class="ax-r ax-d3" style="display: flex; flex-direction: column; gap: 6px; max-width: 290px">
<h2 style="margin: 0; font-size: 22px; font-weight: 800">Nothing to review yet</h2>
<p style="margin: 0; font-size: 15px; line-height: 22px; color: {SOFT}">Entries you log on Today show up here, with the calendar, your areas and the doctor report.</p>
</div>
<div class="ax-r ax-d4">{btn("Go to Today", "primary", h=52)}</div>
</div>
</div>
{tabbar("review", "Ref-ReviewEmpty.dc.html")}
'''
write('Ref-ReviewEmpty.dc.html', 'Review, empty', empty)
print('ok')
