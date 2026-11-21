"""Generates the Aurora-ring follow-up screens. Each output is a self-contained .dc.html artboard."""
import os

# Boards are written to design/canvas/ next to this folder, or to $DESIGN_OUT.
OUT = os.environ.get('DESIGN_OUT', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'canvas'))

HEAD = '''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Gabarito:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
body{{margin:0}}
button{{font:inherit;color:inherit;border:0;background:none;padding:0;margin:0;cursor:pointer;text-align:inherit}}
input{{font:inherit;color:inherit;border:0;background:none;outline:none;margin:0;padding:0}}
input::placeholder{{color:#9AA4B2}}
@keyframes ax-rise{{from{{opacity:0;transform:translateY(14px)}}to{{opacity:1;transform:none}}}}
@keyframes ax-sheet{{from{{transform:translateY(60px);opacity:0}}to{{transform:none;opacity:1}}}}
@keyframes ax-drift1{{0%,100%{{transform:translate(0,0) scale(1)}}50%{{transform:translate(40px,30px) scale(1.12)}}}}
@keyframes ax-drift2{{0%,100%{{transform:translate(0,0) scale(1)}}50%{{transform:translate(-50px,-20px) scale(1.08)}}}}
.ax-r{{animation:ax-rise .6s cubic-bezier(.2,.7,.2,1) both}}
.ax-s{{animation:ax-sheet .5s cubic-bezier(.2,.8,.2,1) both}}
.ax-d1{{animation-delay:.05s}}.ax-d2{{animation-delay:.15s}}.ax-d3{{animation-delay:.25s}}.ax-d4{{animation-delay:.35s}}.ax-d5{{animation-delay:.45s}}
.ax-b1{{animation:ax-drift1 18s ease-in-out infinite}}.ax-b2{{animation:ax-drift2 22s ease-in-out infinite}}
</style>
</helmet>
<div style="position: relative; width: 390px; height: 844px; box-sizing: border-box; overflow: hidden; background: #070B12; font-family: Gabarito, -apple-system, system-ui, sans-serif; color: #F2F5F9; -webkit-font-smoothing: antialiased">
<div aria-hidden="true" style="position: absolute; inset: 0; overflow: hidden; pointer-events: none">
<div class="ax-b1" style="position: absolute; left: -120px; top: -120px; width: 420px; height: 380px; border-radius: 999px; background: {{{{glowA}}}}; filter: blur(70px); opacity: 0.5"></div>
<div class="ax-b2" style="position: absolute; right: -160px; top: 300px; width: 380px; height: 360px; border-radius: 999px; background: {{{{glowB}}}}; filter: blur(80px); opacity: 0.34"></div>
<div style="position: absolute; inset: 0; background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 1.5px); background-size: 24px 24px"></div>
</div>
<svg aria-hidden="true" width="0" height="0" style="position: absolute">
<defs>
<linearGradient id="axWash" gradientUnits="userSpaceOnUse" x1="0" y1="9" x2="0" y2="22"><stop offset="0" stop-color="{{{{accent}}}}" stop-opacity="0"/><stop offset="1" stop-color="{{{{accent}}}}" stop-opacity="0.7"/></linearGradient>
<linearGradient id="axNail" gradientUnits="userSpaceOnUse" x1="0" y1="2.5" x2="0" y2="9.5"><stop offset="0" stop-color="{{{{accent}}}}" stop-opacity="0.95"/><stop offset="1" stop-color="{{{{accent}}}}" stop-opacity="0.45"/></linearGradient>
<linearGradient id="axWashMeal" gradientUnits="userSpaceOnUse" x1="0" y1="9" x2="0" y2="17"><stop offset="0" stop-color="{{{{accent}}}}" stop-opacity="0"/><stop offset="1" stop-color="{{{{accent}}}}" stop-opacity="0.75"/></linearGradient>
</defs>
</svg>
'''

TAIL = '''</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"accent":{"editor":"color","default":"#5EEAD4","options":["#5EEAD4","#A3E635","#C4B5FD"],"section":"Look"},"$preview":{"width":390,"height":844}}'>
class Component extends DCLogic {
renderVals() {
const accent = this.props.accent ?? '#5EEAD4';
return {
accent,
accentSoft: 'color-mix(in srgb, ' + accent + ' 16%, transparent)',
accentLine: 'color-mix(in srgb, ' + accent + ' 45%, transparent)',
glowA: 'radial-gradient(circle, ' + accent + ' 0%, transparent 70%)',
glowB: 'radial-gradient(circle, #6D4AE0 0%, transparent 70%)'
};
}
}
</script>
</body>
</html>
'''

GLASS = 'background: rgba(255,255,255,0.07); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12)'
GLASS_BLUR = GLASS + '; backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px)'

def svg(paths, size=24, stroke='#F2F5F9', width=1.6):
    return (f'<svg aria-hidden="true" width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{stroke}" '
            f'stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round">{paths}</svg>')

IC = {
    'meal': '<path d="M4 17a8 8 0 0 1 16 0Z" fill="url(#axWashMeal)"/><path d="M2.5 20.5h19"/><path d="M12 9V7"/><circle cx="12" cy="5.8" r="1.2"/>',
    'treatment': '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" fill="url(#axWash)"/><path d="m8.5 8.5 7 7"/>',
    'drink': '<path d="M6 4h12l-1.4 14.2a2 2 0 0 1-2 1.8H9.4a2 2 0 0 1-2-1.8Z"/><path d="M6.9 11h10.2l-.8 7.2a2 2 0 0 1-2 1.8H9.7a2 2 0 0 1-2-1.8Z" fill="url(#axWash)" stroke="none"/>',
    'medication': '<rect x="3" y="8.5" width="18" height="7" rx="3.5" transform="rotate(-35 12 12)"/><path d="M12 12l3.6-5.1a3.5 3.5 0 0 1 2.9 5L15 17Z" fill="url(#axWash)" stroke="none"/><path d="M10 9.2l4 5.6"/>',
    'nails': '<path d="M14.8 5.9a1.2 1.2 0 0 1 2.4 0v1.6h-2.4Z" fill="url(#axNail)" stroke="none"/><path d="M10.8 3.9a1.2 1.2 0 0 1 2.4 0v1.6h-2.4Z" fill="url(#axNail)" stroke="none"/><path d="M6.8 5.9a1.2 1.2 0 0 1 2.4 0v1.6H6.8Z" fill="url(#axNail)" stroke="none"/><path d="M18.8 7.9a1.2 1.2 0 0 1 2.4 0v1.6h-2.4Z" fill="url(#axNail)" stroke="none"/><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"/><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
    'reaction': '<path d="M12 3 2.5 20h19Z" fill="url(#axWash)"/><path d="M12 9.5v4.5M12 17h.01"/>',
    'change': '<path d="M4 12a8 8 0 0 1 13.7-5.6L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15"/><path d="M4 20v-5h5"/>',
    'medical': '<rect x="4" y="4" width="16" height="16" rx="5" fill="url(#axWash)"/><path d="M12 8.5v7M8.5 12h7"/>',
    'guide': '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.4M12 17h.01"/>',
    'edit': '<rect x="3.5" y="4" width="7" height="7" rx="2"/><rect x="13.5" y="4" width="7" height="7" rx="2" fill="url(#axWash)"/><rect x="3.5" y="14" width="7" height="7" rx="2"/><path d="M14 17.5h6M17 14.5v6"/>',
    'scan': '<path d="M4 6v12M8 6v12M11 6v12M15 6v12M18 6v12M20.5 6v12"/>',
    'camera': '<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
    'label': '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8.5 8h7M8.5 11.5h7M8.5 15h4"/>',
    'sparkle': '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/><path d="M19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z"/>',
    'search': '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    'star': '<path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9l-5.3 2.7 1-5.8-4.2-4.1 5.9-.9Z"/>',
    'chev': '<path d="M9 6l6 6-6 6"/>',
    'back': '<path d="M15 6l-6 6 6 6"/>',
    'check': '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    'plus': '<path d="M12 5v14M5 12h14"/>',
    'x': '<path d="M7 7l10 10M17 7 7 17"/>',
    'clock': '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
}

def icon_circle(name, size=40, isize=22):
    return (f'<span style="width: {size}px; height: {size}px; border-radius: 999px; background: rgba(255,255,255,0.08); '
            f'display: flex; align-items: center; justify-content: center; flex: none">{svg(IC[name], isize)}</span>')

def modal_top(title):
    return f'''<!-- Full-height modal sheet: the screen behind shows as a strip at the top -->
<div aria-hidden="true" style="position: absolute; left: 14px; right: 14px; top: 44px; height: 30px; border-radius: 28px 28px 0 0; background: rgba(255,255,255,0.05)"></div>
<div class="ax-s" style="position: absolute; left: 0; right: 0; top: 54px; bottom: 0; border-radius: 34px 34px 0 0; background: rgba(13,19,29,0.86); box-shadow: inset 0 1px 0 rgba(255,255,255,0.10), 0 -10px 40px rgba(0,0,0,0.45); backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px); overflow: hidden">
<div aria-hidden="true" style="width: 40px; height: 5px; border-radius: 999px; background: rgba(255,255,255,0.22); margin: 8px auto 0 auto"></div>
<div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 16px 0 16px">
<button style="height: 40px; padding: 0 16px; border-radius: 999px; {GLASS}; font-size: 15.5px; font-weight: 600">Cancel</button>
<h1 style="margin: 0; font-size: 17px; font-weight: 700">{title}</h1>
<span aria-hidden="true" style="width: 82px"></span>
</div>
<div style="padding: 18px 20px 0 20px; display: flex; flex-direction: column; gap: 18px">
'''

MODAL_END = '</div>\n</div>\n'

def save_bar(label, missing=None):
    if missing:
        return (f'<div style="position: absolute; left: 20px; right: 20px; bottom: 24px; display: flex; flex-direction: column; align-items: center; gap: 8px">'
                f'<span style="font-size: 13px; color: #9AA4B2">{missing}</span>'
                f'<button disabled aria-disabled="true" style="width: 100%; height: 56px; border-radius: 999px; background: rgba(255,255,255,0.07); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.10); color: rgba(242,245,249,0.38); font-size: 17px; font-weight: 700">{label}</button></div>')
    return (f'<!-- Save floats at the bottom, in thumb reach; it rides above the keyboard while typing -->\n'
            f'<div class="ax-r ax-d5" style="position: absolute; left: 20px; right: 20px; bottom: 24px">'
            f'<button style="width: 100%; height: 56px; border-radius: 999px; background: {{{{accent}}}}; color: #062A26; font-size: 17px; font-weight: 800; '
            f'display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 14px 34px rgba(0,0,0,0.45), 0 0 30px {{{{accentSoft}}}}">'
            f'{svg(IC["check"], 20, "#062A26", 2.6)}{label}</button></div>')

def section_label(text, right=''):
    return (f'<div style="display: flex; align-items: baseline; justify-content: space-between; padding: 0 4px">'
            f'<h2 style="margin: 0; font-size: 13px; font-weight: 600; letter-spacing: 1.4px; text-transform: uppercase; color: #9AA4B2">{text}</h2>{right}</div>')

def write(name, title, body):
    with open(os.path.join(OUT, name), 'w') as f:
        f.write(HEAD.format(title=title) + body + TAIL)

# ---------------------------------------------------------------- 1. Treatment quick sheet
def sheet_row(name, areas, extra, state=''):
    if state == 'done':
        right = (f'<span style="display: flex; align-items: center; gap: 6px; height: 34px; padding: 0 12px; border-radius: 999px; '
                 f'background: {{{{accent}}}}; color: #062A26; font-size: 13.5px; font-weight: 700">{svg(IC["check"], 16, "#062A26", 2.4)}Applied 14:20</span>')
        ring = 'box-shadow: inset 0 0 0 1.5px {{accent}}, 0 0 28px {{accentSoft}}; background: rgba(255,255,255,0.08)'
    else:
        right = (f'<span style="width: 34px; height: 34px; border-radius: 999px; background: {{{{accent}}}}; display: flex; align-items: center; '
                 f'justify-content: center">{svg(IC["plus"], 16, "#062A26", 2.6)}</span>')
        ring = GLASS
    dis = ' disabled aria-disabled="true"' if state == 'done' else ''
    return (f'<button{dis} aria-label="Apply {name} to {areas}" style="display: flex; align-items: center; gap: 12px; padding: 8px 8px 8px 8px; '
            f'border-radius: 999px; {ring}">{icon_circle("treatment", 44, 24)}'
            f'<span style="flex: 1; min-width: 0"><span style="display: block; font-size: 16px; font-weight: 600">{name}</span>'
            f'<span style="display: block; font-size: 13px; color: #9AA4B2; margin-top: 1px">{areas}{extra}</span></span>{right}</button>')

sheet_body = f'''<!-- Today behind, dimmed -->
<div aria-hidden="true" style="position: absolute; inset: 0; padding: 50px 20px 0 20px; box-sizing: border-box; opacity: 0.45; filter: blur(1.5px)">
<div style="margin: 0 auto; width: 256px; height: 256px; border-radius: 999px; {GLASS}; position: relative">
<div style="position: absolute; inset: 14px; border-radius: 999px; border: 10px solid rgba(255,255,255,0.08)"></div>
<div style="position: absolute; left: 0; right: 0; top: 96px; text-align: center; font-size: 12.5px; font-weight: 600; letter-spacing: 1.8px; color: {{{{accent}}}}">SATURDAY</div>
<div style="position: absolute; left: 0; right: 0; top: 112px; text-align: center; font-size: 38px; font-weight: 800">14 Nov</div>
</div>
</div>
<div aria-hidden="true" style="position: absolute; inset: 0; background: rgba(3,6,10,0.55)"></div>

<!-- Quick sheet: one tap logs at the current time -->
<div class="ax-s" role="dialog" aria-label="Treatments" style="position: absolute; left: 10px; right: 10px; bottom: 12px; border-radius: 40px; padding: 10px 14px 16px 14px; background: rgba(16,22,33,0.86); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12), 0 30px 60px rgba(0,0,0,0.55); backdrop-filter: blur(30px); -webkit-backdrop-filter: blur(30px); display: flex; flex-direction: column; gap: 12px">
<div aria-hidden="true" style="width: 40px; height: 5px; border-radius: 999px; background: rgba(255,255,255,0.22); margin: 0 auto"></div>
<div style="display: flex; align-items: center; justify-content: space-between; padding: 2px 6px 0 8px">
<div><h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.4px">Treatment</h1><div style="font-size: 13.5px; color: #9AA4B2; margin-top: 2px">Tap to log it now</div></div>
<button aria-label="Close" style="width: 40px; height: 40px; border-radius: 999px; {GLASS}; display: flex; align-items: center; justify-content: center">{svg(IC["x"], 18, "#F2F5F9", 2.2)}</button>
</div>
{section_label("Regular")}
<div style="display: flex; flex-direction: column; gap: 8px">
{sheet_row("Emollient", "Chin, Neck", " · reminder 08:00", "done")}
{sheet_row("Scalp lotion", "Ears", " · reminder 21:00")}
</div>
{section_label("Often used")}
<div style="display: flex; flex-direction: column; gap: 8px">
{sheet_row("Barrier cream", "Sternum", " · 4× in 30 days")}
</div>
<button style="height: 52px; border-radius: 999px; {GLASS}; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 15.5px; font-weight: 600; margin-top: 2px">{svg(IC["clock"], 20)}Other or earlier…</button>
</div>
'''
write('Sheet-Treatment.dc.html', 'Treatment quick sheet', sheet_body)

# ---------------------------------------------------------------- 2. Meal, choose phase
def suggestion(name, hint, star=False):
    st = (f'<span aria-label="Favorite" style="display: flex">{svg(IC["star"], 18, "{{accent}}", 1.8)}</span>' if star else '')
    return (f'<button style="display: flex; align-items: center; gap: 12px; height: 56px; padding: 0 16px 0 8px; border-radius: 999px; {GLASS}">'
            f'{icon_circle("meal", 40, 22)}<span style="flex: 1; min-width: 0; font-size: 16px; font-weight: 600">{name}</span>'
            f'{st}<span style="font-size: 13px; color: #9AA4B2">{hint}</span>{svg(IC["chev"], 18, "#9AA4B2", 2)}</button>')

def tool_button(name, label):
    return (f'<button style="flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 4px; '
            f'border-radius: 26px; {GLASS}">{icon_circle(name, 40, 22)}<span style="font-size: 13px; font-weight: 600; text-align: center">{label}</span></button>')

choose_body = modal_top('Log a meal') + f'''
<div class="ax-r ax-d1" style="display: flex; align-items: center; gap: 12px; height: 58px; padding: 0 8px 0 20px; border-radius: 999px; background: rgba(255,255,255,0.09); box-shadow: inset 0 0 0 1.5px {{{{accentLine}}}}">
{svg(IC["search"], 20, "#9AA4B2", 2)}
<label for="mealDesc" style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">Meal description</label>
<input id="mealDesc" placeholder="Type a meal or pick one below" style="flex: 1; min-width: 0; height: 44px; font-size: 16.5px">
<button style="height: 42px; padding: 0 16px; border-radius: 999px; background: rgba(255,255,255,0.08); font-size: 14.5px; font-weight: 600">Continue</button>
</div>

<div class="ax-r ax-d2" style="display: flex; gap: 10px">
{tool_button("scan", "Scan barcode")}
{tool_button("label", "Read label")}
{tool_button("camera", "From photo")}
</div>

<div class="ax-r ax-d3" style="display: flex; flex-direction: column; gap: 10px">
{section_label("Suggestions")}
{suggestion("Oatmeal with banana", "", True)}
{suggestion("Chicken salad", "6×")}
{suggestion("Rye bread with cheese", "yesterday")}
{suggestion("Tomato soup", "3×")}
{suggestion("Rice with vegetables", "4 days")}
</div>
<p class="ax-r ax-d4" style="margin: 0; padding: 0 6px; font-size: 13px; line-height: 19px; color: #9AA4B2">A pick fills the form with its latest ingredients. Nothing is saved until you save.</p>
''' + MODAL_END
write('Meal-Choose.dc.html', 'Log a meal, choose', choose_body)

# ---------------------------------------------------------------- 3. Meal, review phase
def chip(text, removable=True):
    x = (f'<span aria-hidden="true" style="display: flex; opacity: 0.6">{svg(IC["x"], 14, "#F2F5F9", 2.2)}</span>' if removable else '')
    return (f'<button aria-label="Edit ingredient {text}" style="height: 38px; display: flex; align-items: center; gap: 6px; padding: 0 10px 0 14px; '
            f'border-radius: 999px; {GLASS}; font-size: 14.5px; font-weight: 500">{text}{x}</button>')

def tag(text, on):
    if on == 'guess':
        return (f'<button aria-pressed="false" aria-label="{text}, suggested from the ingredients" style="height: 38px; display: flex; align-items: center; gap: 6px; padding: 0 14px 0 10px; border-radius: 999px; '
                f'border: 1.5px dashed {{{{accent}}}}; box-sizing: border-box; font-size: 14.5px; font-weight: 600; color: {{{{accent}}}}">{svg(IC["plus"], 15, "{{accent}}", 2.4)}{text}</button>')
    if on:
        return (f'<button aria-pressed="true" style="height: 38px; display: flex; align-items: center; gap: 6px; padding: 0 14px 0 10px; border-radius: 999px; '
                f'background: {{{{accent}}}}; color: #062A26; font-size: 14.5px; font-weight: 700">{svg(IC["check"], 16, "#062A26", 2.6)}{text}</button>')
    return (f'<button aria-pressed="false" style="height: 38px; display: flex; align-items: center; padding: 0 14px; border-radius: 999px; '
            f'box-shadow: inset 0 0 0 1.5px rgba(255,255,255,0.22); font-size: 14.5px; font-weight: 500; color: #C9D0DA">{text}</button>')

review_body = modal_top('Log a meal') + f'''
<div class="ax-r ax-d1" style="display: flex; align-items: center; gap: 10px">
<div style="flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; height: 56px; padding: 0 8px 0 18px; border-radius: 999px; background: rgba(255,255,255,0.09); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.14)">
<label for="mealName" style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">Meal description</label>
<input id="mealName" value="Chicken salad" style="flex: 1; min-width: 0; height: 44px; font-size: 18px; font-weight: 700">
<button aria-label="Favorite, on" aria-pressed="true" style="width: 40px; height: 40px; border-radius: 999px; display: flex; align-items: center; justify-content: center">{svg(IC["star"], 20, "{{accent}}", 1.9)}</button>
</div>
</div>
<div class="ax-r ax-d1" style="display: flex; gap: 8px; margin-top: -6px">
<button style="height: 36px; display: flex; align-items: center; gap: 6px; padding: 0 14px 0 10px; border-radius: 999px; {GLASS}; font-size: 14px; font-weight: 600">{svg(IC["clock"], 16)}Now · 14:20</button>
<button style="height: 36px; display: flex; align-items: center; gap: 4px; padding: 0 14px 0 8px; border-radius: 999px; font-size: 14px; font-weight: 600; color: {{{{accent}}}}">{svg(IC["back"], 16, "{{accent}}", 2)}Change meal</button>
</div>

<div class="ax-r ax-d2" style="display: flex; flex-direction: column; gap: 10px">
{section_label("Ingredients", '<span style="font-size: 13px; color: #9AA4B2">from 12 Nov</span>')}
<div style="display: flex; flex-wrap: wrap; gap: 8px">
{chip("chicken")}{chip("lettuce")}{chip("egg")}{chip("mustard")}{chip("bread croutons")}
<button style="height: 38px; display: flex; align-items: center; gap: 6px; padding: 0 14px 0 10px; border-radius: 999px; border: 1.5px dashed rgba(255,255,255,0.28); box-sizing: border-box; font-size: 14.5px; font-weight: 600; color: {{{{accent}}}}">{svg(IC["plus"], 15, "{{accent}}", 2.4)}Add</button>
</div>
<div style="display: flex; gap: 8px">
<button style="flex: 1; height: 40px; display: flex; align-items: center; justify-content: center; gap: 6px; border-radius: 999px; {GLASS}; font-size: 13.5px; font-weight: 600">{svg(IC["sparkle"], 16)}From name</button>
<button style="flex: 1; height: 40px; display: flex; align-items: center; justify-content: center; gap: 6px; border-radius: 999px; {GLASS}; font-size: 13.5px; font-weight: 600">{svg(IC["camera"], 16)}Photo</button>
<button style="flex: 1; height: 40px; display: flex; align-items: center; justify-content: center; gap: 6px; border-radius: 999px; {GLASS}; font-size: 13.5px; font-weight: 600">{svg(IC["label"], 16)}Label</button>
</div>
</div>

<div class="ax-r ax-d3" style="display: flex; flex-direction: column; gap: 10px">
{section_label("Allergens")}
<div style="display: flex; flex-wrap: wrap; gap: 8px">
{tag("Eggs", True)}{tag("Mustard", True)}{tag("Gluten", "guess")}
<button style="height: 38px; display: flex; align-items: center; padding: 0 14px; border-radius: 999px; box-shadow: inset 0 0 0 1.5px rgba(255,255,255,0.22); font-size: 14.5px; font-weight: 600; color: #C9D0DA">+ 11 more</button>
</div>
<p style="margin: 0; padding: 0 4px; font-size: 13px; line-height: 19px; color: #9AA4B2">Ticked: from this meal's history. Dashed: a guess from the ingredients, tap to add.</p>
</div>

<div class="ax-r ax-d4" style="display: flex; align-items: center; gap: 12px; height: 52px; padding: 0 18px; border-radius: 999px; {GLASS}">
<label for="mealNote" style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">Note</label>
<input id="mealNote" placeholder="Note (optional)" style="flex: 1; min-width: 0; height: 44px; font-size: 15.5px">
</div>
''' + save_bar('Save meal') + MODAL_END
write('Meal-Review.dc.html', 'Log a meal, review', review_body)

# ---------------------------------------------------------------- 4. More
def more_row(icon, title, sub):
    return (f'<button style="display: flex; align-items: center; gap: 12px; padding: 8px 16px 8px 8px; border-radius: 999px; {GLASS_BLUR}">'
            f'{icon_circle(icon, 44, 24)}<span style="flex: 1; min-width: 0"><span style="display: block; font-size: 16px; font-weight: 600">{title}</span>'
            f'<span style="display: block; font-size: 13px; color: #9AA4B2; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{sub}</span></span>'
            f'{svg(IC["chev"], 18, "#9AA4B2", 2)}</button>')

more_body = f'''<div style="position: absolute; inset: 0; padding: 54px 20px 0 20px; box-sizing: border-box; display: flex; flex-direction: column; gap: 16px">
<div class="ax-r ax-d1" style="display: flex; align-items: center; gap: 12px">
<a href="More.dc.html" aria-label="Back to Today" style="width: 44px; height: 44px; border-radius: 999px; {GLASS_BLUR}; display: flex; align-items: center; justify-content: center">{svg(IC["back"], 20, "#F2F5F9", 2)}</a>
<h1 style="margin: 0; font-size: 34px; font-weight: 800; letter-spacing: -1px">More</h1>
</div>

<div class="ax-r ax-d2" style="display: flex; align-items: center; gap: 12px; height: 56px; padding: 0 20px; border-radius: 999px; background: rgba(255,255,255,0.09); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.16), 0 20px 40px rgba(0,0,0,0.3); backdrop-filter: blur(22px); -webkit-backdrop-filter: blur(22px)">
{svg(IC["search"], 20, "#9AA4B2", 2)}
<label for="moreSearch" style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">Search</label>
<input id="moreSearch" placeholder="Search, for example: new soap" style="flex: 1; min-width: 0; height: 44px; font-size: 16px">
</div>

<div class="ax-r ax-d3" style="display: flex; flex-direction: column; gap: 8px">
{section_label("Log")}
{more_row("drink", "Drink", "Any drink, with an alcohol switch")}
{more_row("medication", "Medication", "A medicine or supplement you took once")}
{more_row("nails", "Nails", "Stage, extent and photos of a nail")}
{more_row("reaction", "Reaction", "Symptoms after a meal")}
{more_row("change", "Routine change", "A product or diet you started or stopped")}
{more_row("medical", "Medical event", "A visit, test result, diagnosis or illness")}
</div>

<div class="ax-r ax-d4" style="display: flex; gap: 8px">
<button style="flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; padding: 8px 14px 8px 8px; border-radius: 999px; {GLASS}">{icon_circle("guide", 40, 22)}<span style="font-size: 14.5px; font-weight: 600">Where do I log…?</span></button>
<button style="flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; padding: 8px 14px 8px 8px; border-radius: 999px; {GLASS}">{icon_circle("edit", 40, 22)}<span style="font-size: 14.5px; font-weight: 600">Edit Today</span></button>
</div>
</div>
'''
write('More.dc.html', 'More', more_body)
print('ok')
