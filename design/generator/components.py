"""Design-system board: tokens and every building block on one artboard (1200 wide)."""
import os
ns = {'__file__': os.path.join(os.path.dirname(os.path.abspath(__file__)), 'reference.py')}
exec(open(ns['__file__']).read(), ns)  # re-writes the reference boards unchanged
g = ns.get
svg, IC, GLASS, GLASS_BLUR = g('svg'), g('IC'), g('GLASS'), g('GLASS_BLUR')
btn, chip, switch, toggle_row, score_row, nav_row, group, section_label, icon_circle, write = (
    g('btn'), g('chip'), g('switch'), g('toggle_row'), g('score_row'), g('nav_row'), g('group'), g('section_label'), g('icon_circle'), g('write'))
CORAL, MUTED, SOFT = g('CORAL'), g('MUTED'), g('SOFT')

def card(title, inner, note=''):
    n = f'<p style="margin: 0; font-size: 12.5px; line-height: 18px; color: {MUTED}">{note}</p>' if note else ''
    return (f'<section style="display: flex; flex-direction: column; gap: 12px; padding: 18px; border-radius: 32px; background: rgba(255,255,255,0.035); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08)">'
            f'<h2 style="margin: 0; font-size: 13px; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase; color: {SOFT}">{title}</h2>{inner}{n}</section>')

def swatch(color, name, use, ring=False):
    r = 'box-shadow: inset 0 0 0 1px rgba(255,255,255,0.25); ' if ring else ''
    return (f'<div style="display: flex; align-items: center; gap: 12px"><span style="width: 40px; height: 40px; border-radius: 999px; background: {color}; {r}flex: none"></span>'
            f'<span><span style="display: block; font-size: 14.5px; font-weight: 700">{name}</span><span style="display: block; font-size: 12.5px; color: {MUTED}">{use}</span></span></div>')

colours = card('Colour', ''.join([
    swatch('#070B12', 'Ground #070B12', 'every screen', True),
    swatch('rgba(255,255,255,0.08)', 'Glass white 7–9 %', 'pills, circles, panels, line 12–16 %', True),
    swatch('#F2F5F9', 'Text #F2F5F9', 'titles, values, icons'),
    swatch(SOFT, f'Soft {SOFT}', 'secondary text, unselected chips'),
    swatch(MUTED, f'Muted {MUTED}', 'captions, hints, units'),
    swatch('@A@', 'Accent #5EEAD4', 'actions, selection, now, newest; text on it #062A26'),
    swatch(CORAL, f'Alert {CORAL}', 'flare, urgent advice, delete; text on it #2A0D04'),
    swatch('radial-gradient(circle at 30% 30%, #6D4AE0, #2563EB 70%)', 'Aurora #6D4AE0, #2563EB', 'background glows only, never on controls'),
]), 'One accent and one alert. Entry types are told apart by icon and label, never by colour.')

type_scale = card('Type: Gabarito', f'''
<div style="display: flex; align-items: baseline; gap: 14px"><span style="font-size: 40px; font-weight: 800; letter-spacing: -1.2px">14 Nov</span><span style="font-size: 12.5px; color: {MUTED}">Date 38–40 / 800</span></div>
<div style="font-size: 12.5px; font-weight: 600; letter-spacing: 1.8px; text-transform: uppercase; color: @A@">Saturday <span style="color: {MUTED}; letter-spacing: 0; text-transform: none; font-weight: 400">Weekday 12.5 / 600 caps, accent</span></div>
<div style="display: flex; align-items: baseline; gap: 14px"><span style="font-size: 34px; font-weight: 800; letter-spacing: -1px">Review</span><span style="font-size: 12.5px; color: {MUTED}">Screen title 30–34 / 800</span></div>
<div style="display: flex; align-items: baseline; gap: 14px"><span style="font-size: 17px; font-weight: 700">Log a meal</span><span style="font-size: 12.5px; color: {MUTED}">Form title 17 / 700</span></div>
<div style="display: flex; align-items: baseline; gap: 14px"><span style="font-size: 15.5px; font-weight: 600">Chicken salad</span><span style="font-size: 12.5px; color: {MUTED}">Row title 15.5 / 600</span></div>
<div style="display: flex; align-items: baseline; gap: 14px"><span style="font-size: 15px; color: {SOFT}">Entries you log on Today show up here.</span><span style="font-size: 12.5px; color: {MUTED}">Body 15 / 400</span></div>
<div style="display: flex; align-items: baseline; gap: 14px"><span style="font-size: 13px; font-weight: 600; letter-spacing: 1.4px; text-transform: uppercase; color: {MUTED}">Ingredients</span><span style="font-size: 12.5px; color: {MUTED}">Section label 13 / 600 caps</span></div>
<div style="display: flex; align-items: baseline; gap: 14px"><span style="font-size: 13px; color: {MUTED}">egg, mustard · 12:40</span><span style="font-size: 12.5px; color: {MUTED}">Caption 12.5–13, tabular numbers</span></div>
''', 'Nothing below 11 pt. Numbers that line up (times, scores) use tabular figures.')

shape = card('Shape, space, motion', f'''
<div style="display: flex; gap: 10px; align-items: center">
<span style="width: 88px; height: 44px; border-radius: 999px; {GLASS}"></span><span style="width: 56px; height: 56px; border-radius: 999px; {GLASS}"></span><span style="width: 88px; height: 64px; border-radius: 26px; {GLASS}"></span><span style="width: 88px; height: 64px; border-radius: 36px; {GLASS}"></span>
</div>
<ul style="margin: 0; padding-left: 18px; font-size: 13.5px; line-height: 21px; color: {SOFT}">
<li>Pills and circles: radius 999. Panels 26–30, sheets 34–40.</li>
<li>Screen margin 20; gaps 8 inside a group, 14–18 between groups.</li>
<li>Targets 44 pt or larger; rows 52–56 pt.</li>
<li>Nothing touches a screen edge: tab bar, sheets and Save float.</li>
<li>Motion only on first load: sections rise in with a 0.1 s stagger, the ring draws in, dots pop in. The aurora drifts slowly. No other animation.</li>
</ul>''')

buttons = card('Buttons', f'''
<div style="display: flex; flex-wrap: wrap; gap: 10px">{btn("Save meal", "primary", "check", h=52)}{btn("Other or earlier…", "glass", "clock")}{btn("No change", "outline", "check")}</div>
<div style="display: flex; flex-wrap: wrap; gap: 10px">{btn("Stop regular item", "danger", "x")}{btn("Delete", "dangerSolid", "trash")}
<button disabled aria-disabled="true" style="height: 44px; padding: 0 18px; border-radius: 999px; background: rgba(255,255,255,0.07); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.10); color: rgba(242,245,249,0.38); font-size: 15.5px; font-weight: 700">Save (disabled)</button></div>
''', 'Primary: one per screen, the form Save floats at the bottom. Glass: everything else. Outline: a secondary action that should stand out. Danger: destructive, at the end of a screen; Delete solid only inside its confirmation sheet.')

chips = card('Chips', f'''
<div style="display: flex; flex-wrap: wrap; gap: 8px">{chip("Eggs", "on")}{chip("Milk")}
<button aria-pressed="false" style="height: 38px; display: flex; align-items: center; gap: 6px; padding: 0 14px 0 10px; border-radius: 999px; border: 1.5px dashed @A@; box-sizing: border-box; font-size: 14.5px; font-weight: 600; color: @A@">{svg(IC["plus"], 15, "@A@", 2.4)}Gluten</button>
<button style="height: 38px; display: flex; align-items: center; gap: 6px; padding: 0 10px 0 14px; border-radius: 999px; {GLASS}; font-size: 14.5px; font-weight: 500">mustard<span style="display: flex; opacity: 0.6">{svg(IC["x"], 14, "#F2F5F9", 2.2)}</span></button>
<button style="height: 38px; display: flex; align-items: center; gap: 6px; padding: 0 14px 0 10px; border-radius: 999px; border: 1.5px dashed rgba(255,255,255,0.28); box-sizing: border-box; font-size: 14.5px; font-weight: 600; color: @A@">{svg(IC["plus"], 15, "@A@", 2.4)}Add</button></div>
''', 'Selected: accent with a tick. Unselected: outline. Suggested by the app: dashed accent, never selected until tapped. Editable item: glass with a remove cross. Add: dashed outline.')

inputs = card('Fields and switches', f'''
<div style="display: flex; align-items: center; gap: 12px; height: 56px; padding: 0 20px; border-radius: 999px; background: rgba(255,255,255,0.09); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.16)">{svg(IC["search"], 20, MUTED, 2)}<span style="font-size: 16px; color: {MUTED}">Search, for example: new soap</span></div>
<div style="display: flex; align-items: center; height: 52px; padding: 0 18px; border-radius: 999px; {GLASS}"><span style="font-size: 15.5px; color: {MUTED}">Note (optional)</span></div>
{toggle_row("Cracks or open wounds", False)}{toggle_row("Regular", True, "Adds it to the quick sheet and allows reminders.")}
''', 'Text fields are pills; the focused field gets an accent line. A switch row is the whole tappable pill.')

scores = card('Score row (0–10)', score_row("Severity", 8) + score_row("Abdominal pain", None, optional=True),
              '− and + step by one; the slider moves in whole numbers. An optional score shows “–” until set, then gets Clear.')

segmented = (f'<div style="display: flex; padding: 4px; border-radius: 999px; {GLASS_BLUR}"><button style="flex: 1; height: 40px; border-radius: 999px; background: rgba(255,255,255,0.14); font-size: 15px; font-weight: 700">Days</button>'
             f'<button style="flex: 1; height: 40px; border-radius: 999px; font-size: 15px; font-weight: 600; color: {SOFT}">Areas</button></div>')
lists = card('Lists and navigation', segmented + group("Data and backup", [nav_row("box", "Export and import", "9 days ago"), nav_row("trash", "Delete data", danger=True, last=True)]),
             'Segmented control for two views of one thing. Grouped list for Settings; a destructive row is coral, last, without a chevron, and always confirms in a sheet.')

today_bits = card('Today parts', f'''
<div style="display: flex; gap: 8px; flex-wrap: wrap">
<span style="height: 38px; display: flex; align-items: center; gap: 8px; padding: 0 14px 0 6px; border-radius: 999px; background: rgba(255,138,107,0.14); box-shadow: inset 0 0 0 1px rgba(255,138,107,0.38); font-size: 14px; font-weight: 600"><span style="width: 26px; height: 26px; border-radius: 999px; background: {CORAL}; color: #2A0D04; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800">8</span>Flare: Chin since 12 Nov</span>
<span style="height: 38px; display: flex; align-items: center; padding: 0 14px; border-radius: 999px; {GLASS}; font-size: 14px; font-weight: 600; color: {SOFT}">Backup: 9 days ago</span></div>
<div style="display: flex; gap: 22px; align-items: flex-start">
<span style="display: flex; flex-direction: column; align-items: center; gap: 6px"><span style="width: 56px; height: 56px; border-radius: 999px; {GLASS_BLUR}; display: flex; align-items: center; justify-content: center">{svg(IC["meal"], 26)}</span><span style="font-size: 13.5px; font-weight: 500">Meal</span></span>
<span style="display: flex; flex-direction: column; align-items: center; gap: 6px"><span style="width: 56px; height: 56px; border-radius: 999px; box-shadow: inset 0 0 0 1.5px rgba(255,255,255,0.18); display: flex; align-items: center; justify-content: center"><svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="#F2F5F9"><circle cx="6" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18" cy="12" r="1.7"/></svg></span><span style="font-size: 13.5px; font-weight: 500; color: {MUTED}">More</span></span>
<span style="display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 0">
<span style="display: flex; align-items: center; gap: 12px; padding: 8px 16px 8px 8px; border-radius: 999px; background: rgba(255,255,255,0.08); box-shadow: inset 0 0 0 1.5px @A@, 0 0 28px @S@">{icon_circle("stool", 40, 24)}<span style="flex: 1; font-size: 15.5px; font-weight: 600">Stool, type 4</span><span style="font-size: 13.5px; color: {MUTED}">13:05</span></span>
<span style="display: flex; align-items: center; gap: 12px; padding: 8px 16px 8px 8px; border-radius: 999px; {GLASS}">{icon_circle("meal", 40, 22)}<span style="flex: 1; font-size: 15.5px; font-weight: 600">Chicken salad</span><span style="font-size: 13.5px; color: {MUTED}">12:40</span></span>
</span></div>
''', 'Context pills: at most two (flare, Daily health, backup, AI suggestions). Quick action: a glass circle with a label; More is an outline circle. Log row: a glass pill; the newest one gets an accent line and glow for 3 s.')

names = ['meal', 'drink', 'medication', 'skin', 'nails', 'treatment', 'health', 'stool', 'reaction', 'change', 'medical',
         'report', 'sparkle', 'calendar', 'chart', 'bell', 'lock', 'key', 'box', 'trash', 'info', 'guide', 'edit', 'scan',
         'label', 'camera', 'search', 'star', 'clock', 'tag', 'list', 'sliders', 'flame', 'sun', 'copy']
icon_cells = ''.join(f'<span style="display: flex; flex-direction: column; align-items: center; gap: 4px; width: 64px">{icon_circle(n, 44, 24)}<span style="font-size: 11px; color: {MUTED}">{n}</span></span>' for n in names)
icons = card('Icons', f'<div style="display: flex; flex-wrap: wrap; gap: 10px 6px">{icon_cells}</div>',
             '24 grid, 1.6 stroke outlines in the text colour, with an accent wash that fades in over the lower half of a closed shape. Nails is the Skin hand with only the nails tinted.')

gestures = card('Gestures (each has a tap alternative)', f'''
<ul style="margin: 0; padding-left: 18px; font-size: 13.5px; line-height: 21px; color: {SOFT}">
<li>Swipe the day ring: previous or next day (faint arrows).</li>
<li>Tap a dot on the ring: that entry’s Edit or Delete sheet (the log row).</li>
<li>Swipe a log row left: Delete, then the confirmation sheet (tap the row).</li>
<li>Long-press a quick action: its full form (“Other or earlier…”).</li>
<li>Swipe down on a form: Cancel; with changes, Discard Changes first.</li>
<li>Later (UX-13): press and drag around the ring to pick a time.</li>
</ul>''')

body = f'''<div style="position: absolute; inset: 0; padding: 60px 56px; box-sizing: border-box; display: flex; flex-direction: column; gap: 28px">
<div style="display: flex; align-items: flex-end; justify-content: space-between">
<div><div style="font-size: 13px; font-weight: 600; letter-spacing: 1.8px; text-transform: uppercase; color: @A@">Nettle</div>
<h1 style="margin: 0; font-size: 52px; line-height: 58px; font-weight: 800; letter-spacing: -1.6px">Design system: Aurora ring</h1></div>
<p style="margin: 0; max-width: 380px; font-size: 14.5px; line-height: 21px; color: {SOFT}">Dark ground, drifting aurora, floating glass. One accent, one alert. Reference screens on this canvas show each part in use; docs/design-system.md is the written spec.</p>
</div>
<div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; align-items: start">
<div style="display: flex; flex-direction: column; gap: 20px">{colours}{type_scale}{shape}</div>
<div style="display: flex; flex-direction: column; gap: 20px">{buttons}{chips}{inputs}{scores}</div>
<div style="display: flex; flex-direction: column; gap: 20px">{lists}{today_bits}{icons}{gestures}</div>
</div>
</div>
'''
write('DesignSystem.dc.html', 'Design system: Aurora ring', body, h=1900, w=1280)
print('ok')
