"""Group 3: Meal extras. Barcode scan states, label scan, photo estimate waiting and result, name estimate, billing confirmations.
Requirements: IN-2, IN-3, IN-8, IN-10, IN-15, IN-16, IN-19, LL-5, LL-12, LL-13. Copies: Meal choose, Meal review."""
from lib import *
from group2 import chips, block, allergens, time_note, note_field

SRC_PILL = lambda t: (f'<span style="height: 26px; padding: 0 10px; border-radius: 999px; box-shadow: inset 0 0 0 1.5px rgba(255,255,255,0.34); font-size: 12.5px; font-weight: 600; color: {SOFT}; display: flex; align-items: center; flex: none">{t}</span>')

def tools(active=None):
    def t(icon, label, on=False):
        extra = '; box-shadow: inset 0 0 0 1.5px @L@; color: @A@' if on else ''
        return (f'<button style="flex: 1; height: 44px; display: flex; align-items: center; justify-content: center; gap: 6px; border-radius: 999px; {GLASS}; font-size: 13.5px; font-weight: 600{extra}">{svg(IC[icon], 16, "@A@" if on else TEXT, 2 if on else 1.6)}{label}</button>')
    return f'<div style="display: flex; gap: 8px">{t("sparkle", "From name", active == "name")}{t("camera", "Photo", active == "photo")}{t("label", "Label", active == "label")}</div>'

def review(name, title, top='', ing=None, allergen_html=None, missing=None, h=1100, desc='Chicken salad', source=None, tool=None, save='Save meal', fav=True, ing_note=None, between=''):
    ing = ing if ing is not None else ['chicken', 'lettuce', 'egg', 'mustard', 'bread croutons']
    star = (f'<button aria-label="Favorite, on" aria-pressed="true" style="width: 44px; height: 44px; border-radius: 999px; display: flex; align-items: center; justify-content: center">{svg(IC["star"], 20, "@A@", 1.9)}</button>' if fav else '')
    src = SRC_PILL(source) if source else ''
    head = (f'<div class="ax-r ax-d1" style="display: flex; flex-direction: column; gap: 10px"><div style="display: flex; align-items: center; gap: 10px; height: 56px; padding: 0 6px 0 18px; border-radius: 999px; {RAISED}">'
            f'<label for="mealName" style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">Meal description</label>'
            f'<input id="mealName" value="{desc}" style="flex: 1; min-width: 0; height: 44px; font-size: 18px; font-weight: 700">{star}</div>'
            f'<div style="display: flex; align-items: center; gap: 8px">{time_row("Now · 14:20").replace("align-self: flex-start", "flex: none")}'
            f'<button style="height: 44px; display: flex; align-items: center; gap: 4px; padding: 0 12px 0 8px; border-radius: 999px; font-size: 14px; font-weight: 600; color: @A@">{svg(IC["back"], 16, "@A@", 2)}Change meal</button>{src}</div></div>')
    ing_block = block('Ingredients', chips([ing_chip(i) for i in ing] + [add_chip('Add ingredient')]) + (body_text(ing_note, MUTED, 13) if ing_note else '') + tools(tool), cls='ax-r ax-d2')
    al = allergen_html if allergen_html is not None else allergens(['Eggs', 'Mustard'], ['Gluten cereals'], 11)
    body = head + top + ing_block + between + al + f'<div class="ax-r ax-d4">{note_field("mealNote")}</div>'
    form(name, title, 'Log a meal', body, save, missing, h=h)

def finder(icon='scan', cap='', size=300, scanning=True):
    br = lambda pos: f'<span aria-hidden="true" style="position: absolute; {pos}; width: 34px; height: 34px; border: 0 solid @A@"></span>'
    corners = ''.join([
        '<span aria-hidden="true" style="position: absolute; left: 18px; top: 18px; width: 34px; height: 34px; border-left: 3px solid @A@; border-top: 3px solid @A@; border-radius: 14px 0 0 0"></span>',
        '<span aria-hidden="true" style="position: absolute; right: 18px; top: 18px; width: 34px; height: 34px; border-right: 3px solid @A@; border-top: 3px solid @A@; border-radius: 0 14px 0 0"></span>',
        '<span aria-hidden="true" style="position: absolute; left: 18px; bottom: 18px; width: 34px; height: 34px; border-left: 3px solid @A@; border-bottom: 3px solid @A@; border-radius: 0 0 0 14px"></span>',
        '<span aria-hidden="true" style="position: absolute; right: 18px; bottom: 18px; width: 34px; height: 34px; border-right: 3px solid @A@; border-bottom: 3px solid @A@; border-radius: 0 0 14px 0"></span>'])
    line = '<span aria-hidden="true" style="position: absolute; left: 40px; right: 40px; top: 50%; height: 2px; border-radius: 999px; background: @A@; box-shadow: 0 0 14px @S@"></span>' if scanning else ''
    return (f'<div role="img" aria-label="Camera view" style="position: relative; height: {size}px; border-radius: 34px; overflow: hidden; background: linear-gradient(160deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03)); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.14); display: flex; align-items: center; justify-content: center">'
            f'<span style="opacity: 0.35">{svg(IC[icon], 72, TEXT, 1.2)}</span>{corners}{line}'
            f'<span style="position: absolute; left: 0; right: 0; bottom: 56px; text-align: center; font-size: 13.5px; color: {SOFT}">{cap}</span></div>')

def code_row(value=None, focus=False):
    return (f'<div style="display: flex; gap: 8px; align-items: center"><div style="flex: 1; min-width: 0">{field("barcode", "Barcode digits", "Or type the code", value, icon="scan", focus=focus)}</div>'
            f'{btn("Look up", "glass", h=56)}</div>')

ADD_SEL = btn('Add selected', 'glass', h=44, extra='; opacity: 0.38').replace('<button ', '<button disabled aria-disabled="true" ', 1)

def estimate_panel(title, intro, picked, others, source, extra='', unsure=None):
    cs = [chip(t, 'on') for t in picked] + [chip(t) for t in others]
    un = body_text(f'Unsure about: {unsure}', MUTED, 13) if unsure else ''
    return (f'<div class="ax-r ax-d2" style="display: flex; flex-direction: column; gap: 12px; padding: 14px 16px 16px 16px; border-radius: 28px; background: rgba(255,255,255,0.05); box-shadow: inset 0 0 0 1.5px @L@">'
            f'<div style="display: flex; align-items: center; gap: 10px">{icon_circle("sparkle", 36, 20)}<span style="flex: 1; font-size: 15.5px; font-weight: 700">{title}</span>{SRC_PILL(source)}</div>'
            f'{body_text(intro, SOFT, 14)}{chips(cs)}{un}{extra}'
            f'<div style="display: flex; gap: 8px; flex-wrap: wrap">{btn("Add all", "outline", h=44)}{ADD_SEL}{btn("Dismiss", "glass", h=44)}</div></div>')

def confirm_sheet(title, body, lines, primary, extra=''):
    inner = (body_text(body, SOFT, 14) + sent_list(lines) + extra + billing_note()
             + f'<div style="display: flex; flex-direction: column; gap: 8px">{btn(primary, "primary", "sparkle", full=True, h=56)}{btn("Cancel", "glass", full=True, h=52)}</div>')
    return sheet(title, None, inner, close=False)

def run():
    # ---------------------------------------------------------------- scan: pointing the camera
    scan = (f'<div class="ax-r ax-d1" style="display: flex; flex-direction: column; gap: 14px"><h2 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.4px">Point the camera at the barcode</h2>'
            f'{finder("scan", "Hold the code inside the frame")}</div><div class="ax-r ax-d2">{code_row()}</div>'
            f'{body_text("Barcode lookups use Open Food Facts. Only the code is sent, never a photo.", MUTED, 13)}')
    put('G3-Scan.dc.html', 'Barcode scan: camera', modal_top('Scan a barcode') + scan + MODAL_END)

    # looking up
    looking = (f'<div class="ax-r ax-d1" style="display: flex; flex-direction: column; gap: 14px">{finder("scan", "", 220, False)}</div>'
               + inline_wait('Looking up the product…', '0:02', cancel=False)
               + f'<div class="ax-r ax-d2">{code_row("5900000000000")}</div>')
    put('G3-Scan-Looking.dc.html', 'Barcode scan: looking up', modal_top('Scan a barcode') + looking + MODAL_END)

    # ---------------------------------------------------------------- scan: found
    ban = banner('', 'Filled from Open Food Facts. Check it before saving.', 'info')
    review('G3-Scan-Found.dc.html', 'Barcode scan: found', top=f'<div class="ax-r ax-d1">{ban}</div>', desc='Oat drink with calcium, 1 l',
           ing=['oats', 'water', 'rapeseed oil', 'calcium carbonate', 'salt'], source='Open Food Facts', fav=False,
           allergen_html=allergens([], ['Gluten cereals', 'Milk'], 12), ing_note='Barcode 5900000000000', h=1180)
    hist = banner('', 'Filled from your diary: this code was last logged on 9 Nov. The ingredients and tags are the ones you confirmed then.', 'calendar',
                  actions=btn('Scan label again', 'glass', 'label', h=44))
    review('G3-Scan-History.dc.html', 'Barcode scan: found in the diary', top=f'<div class="ax-r ax-d1">{hist}</div>', desc='Tomato soup, 400 g',
           ing=['tomato', 'water', 'cream', 'sugar', 'salt'], source='manual', fav=False, allergen_html=allergens(['Milk'], [], 13), h=1220)

    # ---------------------------------------------------------------- scan: not found, in-store, denied
    nf = (f'<div class="ax-r ax-d1" style="display: flex; flex-direction: column; gap: 14px; align-items: center; text-align: center; padding-top: 6px">'
          f'<div aria-hidden="true" style="position: relative; width: 150px; height: 150px; border-radius: 999px; {GLASS_BLUR}; display: flex; align-items: center; justify-content: center"><div style="position: absolute; inset: 14px; border-radius: 999px; border: 2px dashed rgba(255,255,255,0.18)"></div>{svg(IC["scan"], 48, "@A@", 1.6)}</div>'
          f'<h2 style="margin: 0; font-size: 22px; font-weight: 800">Not in the database</h2>'
          f'{body_text("This product is not in the database. Enter it by hand.", SOFT, 15)}'
          f'<span style="font-size: 13px; color: {MUTED}; font-variant-numeric: tabular-nums">Barcode 5900000000000</span></div>'
          f'<div class="ax-r ax-d2" style="display: flex; flex-direction: column; gap: 8px">{btn("Enter the ingredients by hand", "glass", "edit", full=True, h=52)}</div>')
    put('G3-Scan-NotFound.dc.html', 'Barcode scan: not found', modal_top('Scan a barcode') + nf + float_primary('Read the ingredient label', 'label') + MODAL_END)

    store = banner('', 'This number is used by shops for their own products, so the same code can mean different products. Is the match right?', 'info') + \
        f'<div style="display: flex; align-items: center; gap: 12px; padding: 8px 8px 8px 8px; border-radius: 999px; {GLASS}">{icon_circle("meal", 44, 24)}<span style="flex: 1"><span style="display: block; font-size: 16px; font-weight: 600">Tomato soup, shop brand</span><span style="display: block; font-size: 13px; color: {MUTED}; font-variant-numeric: tabular-nums">Code 2000000000000</span></span></div>' + \
        f'<div style="display: flex; flex-direction: column; gap: 8px">{btn("Use it", "primary", "check", full=True, h=56)}{btn("Read the ingredient label", "glass", "label", full=True, h=52)}</div>'
    put('G3-Scan-InStore.dc.html', 'Barcode scan: in-store code', behind() + sheet('In-store code', None, store, close=False))

    den = (f'<div class="ax-r ax-d1" style="display: flex; flex-direction: column; gap: 14px; align-items: center; text-align: center; padding-top: 6px">'
           f'<div aria-hidden="true" style="width: 150px; height: 150px; border-radius: 999px; {GLASS_BLUR}; display: flex; align-items: center; justify-content: center">{svg(IC["camera"], 48, CORAL, 1.6)}</div>'
           f'<h2 style="margin: 0; font-size: 22px; font-weight: 800">Camera is off</h2>{body_text("Barcode scanning needs the camera.", SOFT, 15)}</div>'
           f'<div class="ax-r ax-d2" style="display: flex; flex-direction: column; gap: 8px">{btn("Open settings", "primary", "sliders", full=True, h=56)}{btn("Allow the camera", "glass", "camera", full=True, h=52)}</div>'
           f'<div class="ax-r ax-d3">{code_row()}</div>{body_text("You can still type the code. The entry saves without the camera.", MUTED, 13)}')
    put('G3-Scan-Denied.dc.html', 'Barcode scan: camera denied', modal_top('Scan a barcode') + den + float_primary('Open iPhone settings', 'sliders') + MODAL_END)

    # ---------------------------------------------------------------- label scan
    shutter = (f'<div style="display: flex; justify-content: center; padding-top: 4px"><button aria-label="Take the photo" style="width: 72px; height: 72px; border-radius: 999px; box-shadow: inset 0 0 0 3px rgba(255,255,255,0.5); display: flex; align-items: center; justify-content: center">'
               f'<span style="width: 56px; height: 56px; border-radius: 999px; background: @A@; display: flex; align-items: center; justify-content: center">{svg(IC["camera"], 26, ONACC, 2)}</span></button></div>')
    label = (f'<div class="ax-r ax-d1" style="display: flex; flex-direction: column; gap: 14px"><h2 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.4px">Photograph the ingredient label</h2>'
             f'{finder("label", "Fill the frame with the ingredient text", 330, False)}</div>' + shutter
             + f'<div style="display: flex; justify-content: center">{btn("Choose from photos", "glass", "camera")}</div>'
             + body_text('The photo is sent to Anthropic only after you confirm. It is deleted from this phone afterwards.', MUTED, 13))
    put('G3-Label.dc.html', 'Label scan: camera', modal_top('Read the ingredient label') + label + MODAL_END, h=900)

    # ---------------------------------------------------------------- billing confirmations (LL-5)
    put('G3-Confirm-Label.dc.html', 'Confirm: label photo',
        behind() + confirm_sheet('Send this label photo to Anthropic?',
                                 'The photo of the label is sent over the internet to Anthropic to read the ingredients. Nothing is saved from the answer until you review it, and the photo is deleted from your phone afterwards.',
                                 ['1 photo: the ingredient label', 'Model: Haiku 5.5'], 'Send photo'), h=900)
    put('G3-Confirm-Photo.dc.html', 'Confirm: meal photo',
        behind() + confirm_sheet('Send this photo to Anthropic?',
                                 'The photo is sent over the internet to Anthropic to guess the ingredients. Nothing is saved from the answer until you review it.',
                                 ['1 photo of the meal, taken 14:12', '48 ingredient names from your diary, to help match what is in the photo', 'Model: Haiku 5.5'], 'Send photo'), h=940)
    put('G3-Confirm-Name.dc.html', 'Confirm: meal name',
        behind() + confirm_sheet('Send this name to Anthropic?',
                                 'This text is sent over the internet to Anthropic (no photo) to list the ingredients the dish usually contains: “Chicken salad”. Nothing is saved from the answer until you review it.',
                                 ['The text “Chicken salad”, no photo', 'Model: Haiku 5.5'], 'Send name'), h=900)

    # ---------------------------------------------------------------- photo estimate waiting (LL-12)
    wait1 = f'<div class="ax-r ax-d1">{inline_wait("Estimating ingredients from the photo. You can keep entering the meal.", "Running for 0:12", cancel=True)}</div>'
    review('G3-Photo-Waiting.dc.html', 'Photo estimate: waiting', top=wait1, desc='Pasta with tomato sauce', ing=['pasta'], tool='photo', source='manual', fav=False,
           allergen_html=allergens([], ['Gluten cereals'], 12), h=1100)
    wait2 = f'<div class="ax-r ax-d1">{inline_wait("Still working, keep entering the meal.", "Running for 0:34", cancel=True)}</div>'
    review('G3-Photo-WaitingSlow.dc.html', 'Photo estimate: slow, Cancel offered', top=wait2, desc='Pasta with tomato sauce', ing=['pasta'], tool='photo', source='manual', fav=False,
           allergen_html=allergens([], ['Gluten cereals'], 12), h=1100)

    # ---------------------------------------------------------------- photo estimate result
    pr = estimate_panel('Suggested ingredients', 'Suggested ingredients. Check and edit them before saving.', [], ['pasta', 'tomato', 'basil', 'onion', 'parmesan'], 'AI photo estimate', unsure='garlic')
    review('G3-Photo-Result.dc.html', 'Photo estimate: result', top=pr, desc='Pasta with tomato sauce', ing=['pasta'], tool='photo', source='AI photo estimate', fav=False,
           allergen_html=allergens([], ['Gluten cereals'], 12), h=1260)
    fail = banner('Nothing was added', 'No connection. Nothing was changed.', 'info', kind='alert', actions=btn('Try again', 'glass', h=44) + btn('Dismiss', 'glass', h=44))
    review('G3-Photo-Failed.dc.html', 'Photo estimate: failed', top=f'<div class="ax-r ax-d1">{fail}</div>', desc='Pasta with tomato sauce', ing=['pasta'], tool='photo', source='manual', fav=False,
           allergen_html=allergens([], ['Gluten cereals'], 12), h=1120)

    # ---------------------------------------------------------------- name estimate
    nr = estimate_panel('Suggested ingredients', 'Typical ingredients of this dish, not necessarily what you ate. Add what applies and edit the list.',
                        [], ['chicken', 'lettuce', 'tomato', 'cucumber', 'olive oil', 'croutons'], 'AI name estimate')
    review('G3-Name-Result.dc.html', 'Name estimate: result', top=nr, desc='Chicken salad', ing=[], tool='name', source='manual', fav=False,
           allergen_html=allergens([], [], 14), ing_note=None, h=1180)
    vague_panel = (f'<div class="ax-r ax-d2" style="display: flex; flex-direction: column; gap: 12px; padding: 14px 16px 16px 16px; border-radius: 28px; background: rgba(255,255,255,0.05); box-shadow: inset 0 0 0 1.5px rgba(255,255,255,0.14)">'
                   f'<div style="display: flex; align-items: center; gap: 10px">{icon_circle("sparkle", 36, 20)}<span style="flex: 1; font-size: 15.5px; font-weight: 700">No ingredients suggested</span>{SRC_PILL("AI name estimate")}</div>'
                   f'{body_text("The name is too vague to list ingredients. Nothing was suggested.", SOFT, 14)}{body_text("Note from the model: lunch can be many dishes. Try the name of the dish.", MUTED, 13)}'
                   f'<div style="display: flex; gap: 8px">{btn("Dismiss", "glass", h=44)}</div></div>')
    review('G3-Name-Vague.dc.html', 'Name estimate: too vague', top=vague_panel, desc='Lunch', ing=[], tool='name', source='manual', fav=False,
           allergen_html=allergens([], [], 14), h=1100)

TITLE = 'Group 3: Meal extras'
NEEDS = '''Group 3: Needs approval

1. Scan has one screen for the camera and a typed code beside it; Open Food Facts gets the code only. Affects IN-2.
2. A history hit shows its date and Scan label again; an in-store code asks first in a sheet with Use it. Affects IN-2.
3. Not found offers Read the ingredient label (primary) and Enter by hand. Affects IN-8, IN-15.
4. Camera denied: explains it, Open settings, and the typed code still works. Affects IN-2.
5. Every confirmation lists exactly what is sent and carries the billing notice; the model is named. Affects LL-5.
6. Waiting shows elapsed time; Cancel is there from the start; the wait arc is the one proposed motion (rotates only while a call runs). Affects LL-12, UX-12.
7. Estimate results: nothing is pre-selected, Add selected stays disabled until you tap an item; allergen tags stay unselected. Affects IN-3, IN-10, IN-19.
8. A failed or too vague estimate leaves the form untouched and says so. Affects IN-19, LL-8.'''
