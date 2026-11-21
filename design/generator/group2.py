"""Group 2: Entry forms. Drink, Medication, Treatment, Nails, Stool, Reaction, Routine change, Medical event, treatment application edit.
Requirements: IN-4, IN-5, IN-10, IN-11, IN-12, IN-13, IN-17, IN-18, IN-19, SK-10, UX-3, UX-4. Copies: Meal review, Skin form, Daily health."""
from lib import *

URGENT = 'Swelling of the face or throat, or trouble breathing, needs urgent medical care. Call emergency services. Do not wait for this app.'

def chips(items):
    return f'<div style="display: flex; flex-wrap: wrap; gap: 8px">{"".join(items)}</div>'

def block(label, inner, right='', cls='ax-r ax-d2'):
    return f'<div class="{cls}" style="display: flex; flex-direction: column; gap: 10px">{section_label(label, right)}{inner}</div>'

def allergens(ticked, guesses, more):
    items = [chip(t, 'on') for t in ticked] + [guess_chip(g) for g in guesses] + [chip(f'+ {more} more')]
    hint = body_text('Ticked: from this meal\'s history. Dashed: a guess from the ingredients, tap to add.', MUTED, 13) if guesses else ''
    return block('Allergens', chips(items) + hint)

def radio_row(title, detail, on):
    ring = 'box-shadow: inset 0 0 0 1.5px @A@, 0 0 24px @S@; background: rgba(255,255,255,0.08)' if on else GLASS
    dot = (f'<span style="width: 24px; height: 24px; border-radius: 999px; background: @A@; display: flex; align-items: center; justify-content: center; flex: none">{svg(IC["check"], 15, ONACC, 2.8)}</span>' if on
           else '<span style="width: 24px; height: 24px; border-radius: 999px; box-shadow: inset 0 0 0 1.5px rgba(255,255,255,0.34); flex: none"></span>')
    return (f'<button role="radio" aria-checked="{"true" if on else "false"}" style="display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 8px 16px 8px 8px; border-radius: 999px; {ring}">{icon_circle("meal", 40, 22)}'
            f'<span style="flex: 1; min-width: 0"><span style="display: block; font-size: 15.5px; font-weight: 600">{title}</span><span style="display: block; font-size: 13px; color: {MUTED}">{detail}</span></span>{dot}</button>')

def note_field(fid='note'):
    return (f'<div style="display: flex; align-items: center; height: 44px; padding: 0 16px; border-radius: 999px; {GLASS}; flex: 1; min-width: 0">'
            f'<label for="{fid}" style="position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0)">Note</label>'
            f'<input id="{fid}" placeholder="Note (optional)" style="flex: 1; min-width: 0; height: 40px; font-size: 15px"></div>')

def time_note(label='Now · 14:20'):
    return f'<div class="ax-r ax-d4" style="display: flex; gap: 8px">{time_row(label).replace("align-self: flex-start", "flex: none")}{note_field()}</div>'

STOOL_TYPES = [(1, 'Hard lumps'), (2, 'Lumpy sausage'), (3, 'Cracked sausage'), (4, 'Smooth sausage'), (5, 'Soft blobs'), (6, 'Mushy'), (7, 'Watery')]

def run():
    # ---------------------------------------------------------------- Drink
    name_block = lambda v: field('drinkName', 'Drink', 'Drink (for example beer or coffee with milk)', v, focus=(v is None))
    drink_body = (
        f'<div class="ax-r ax-d1" style="display: flex; flex-direction: column; gap: 10px">{name_block("Coffee with milk")}'
        f'{field("drinkMl", "Amount in ml", "Amount in ml", "250", suffix="ml")}'
        f'{btn("Suggest ingredients from the name", "glass", "sparkle", full=True, h=48)}</div>'
        f'<div class="ax-r ax-d2">{toggle_row("Contains alcohol", False)}</div>'
        + block('Ingredients', chips([ing_chip('coffee'), ing_chip('milk'), add_chip('Add ingredient')]), cls='ax-r ax-d3')
        + allergens([], ['Milk'], 13) + time_note())
    form('G2-Drink.dc.html', 'Drink form', 'Drink', drink_body, 'Save drink', h=1020)
    empty = (f'<div class="ax-r ax-d1" style="display: flex; flex-direction: column; gap: 10px">{name_block(None)}{field("drinkMl", "Amount in ml", "Amount in ml", None, suffix="ml")}</div>'
             f'<div class="ax-r ax-d2">{toggle_row("Contains alcohol", False)}</div>' + time_note())
    form('G2-Drink-Empty.dc.html', 'Drink form, nothing typed', 'Drink', empty, 'Save drink', missing='Missing: a drink, an amount in ml')

    # ---------------------------------------------------------------- Medication
    seg2 = seg(['Medication', 'Supplement'], 1, 'Kind')
    med = (f'<div class="ax-r ax-d1" style="display: flex; flex-direction: column; gap: 10px">{seg2}{field("medName", "Name", "Name", "Vitamin D3")}{field("medDose", "Dose", "Dose (for example 1 tablet)", "1 tablet")}</div>'
           f'<div class="ax-r ax-d2">{toggle_row("Regular", True, "Adds it to the quick sheet and lets you set reminders (Settings, Logging, Regular items).", "bell")}</div>'
           + time_note())
    form('G2-Medication.dc.html', 'Medication form, Regular on', 'Medication', med, 'Save medication')

    # ---------------------------------------------------------------- Treatment
    treat_chips = chips([chip('Emollient', 'on'), chip('Barrier cream'), chip('Scalp lotion'), add_chip('New treatment')])
    area_chips = chips([chip('Chin', 'on'), chip('Neck', 'on'), chip('Ears, inside'), chip('Behind the ears'), chip('Sternum'), chip('+ 3 more')])
    treat = (block('Treatment', treat_chips, cls='ax-r ax-d1') + block('Applied to', area_chips)
             + f'<div class="ax-r ax-d3">{toggle_row("Regular", True, "Adds it to the quick sheet and lets you set reminders (Settings, Logging, Regular items).", "bell")}</div>' + time_note())
    form('G2-Treatment.dc.html', 'Treatment form, areas and Regular', 'Treatment', treat, 'Save treatment', h=960)
    treat_e = (block('Treatment', chips([chip('Emollient'), chip('Barrier cream'), chip('Scalp lotion'), add_chip('New treatment')]), cls='ax-r ax-d1')
               + block('Applied to', chips([chip('Chin'), chip('Neck'), chip('Ears, inside'), chip('Behind the ears'), chip('Sternum'), chip('+ 3 more')]))
               + f'<div class="ax-r ax-d3">{toggle_row("Regular", False, "Adds it to the quick sheet and lets you set reminders (Settings, Logging, Regular items).", "bell")}</div>' + time_note())
    form('G2-Treatment-Empty.dc.html', 'Treatment form, nothing picked', 'Treatment', treat_e, 'Save treatment', missing='Missing: a treatment, at least one area', h=960)

    # ---------------------------------------------------------------- Nails
    nail_chips = chips([chip('Left thumb', 'on'), chip('Right index'), add_chip('Add nail')])
    stage = chips([chip('Red or dark edge'), chip('Separation', 'on'), chip('Yellow'), chip('White'), chip('Clear')])
    extent = chips([chip('None'), chip('Under a quarter'), chip('Up to half', 'on'), chip('More than half')])
    photos = (f'<div style="display: flex; gap: 10px"><button aria-label="Add a photo" style="width: 76px; height: 76px; border-radius: 22px; border: 1.5px dashed rgba(255,255,255,0.34); box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-size: 12px; font-weight: 600; color: @A@">{svg(IC["camera"], 22, "@A@", 1.8)}Add</button>{photo("14:12")}</div>')
    nails = (block('Nail', nail_chips, cls='ax-r ax-d1') + block('Stage', stage) + block('How much of the nail', extent)
             + block('Photos', photos, f'<span style="font-size: 13px; color: {MUTED}">stay on this phone</span>', cls='ax-r ax-d3') + time_note())
    form('G2-Nails.dc.html', 'Nails form', 'Nails', nails, 'Save nail entry', h=1120)
    nails_e = (f'<div class="ax-r ax-d1" style="display: flex; flex-direction: column; gap: 10px">{section_label("Nail")}{field("nailName", "New nail", "New nail (for example left thumb)", None, focus=True)}'
               f'{body_text("Add a nail first.", MUTED, 13.5)}</div>'
               + block('Stage', chips([chip('Red or dark edge'), chip('Separation'), chip('Yellow'), chip('White'), chip('Clear')]))
               + block('How much of the nail', chips([chip('None'), chip('Under a quarter'), chip('Up to half'), chip('More than half')])) + time_note())
    form('G2-Nails-Empty.dc.html', 'Nails form, no nail yet', 'Nails', nails_e, 'Save nail entry', missing='Missing: an area, a stage, how much of the nail', h=1000)

    # ---------------------------------------------------------------- Stool (full form, from More)
    tiles = ''.join((stool_tile(n, l) if n != 4 else stool_tile(n, l).replace(GLASS, 'background: rgba(255,255,255,0.08); box-shadow: inset 0 0 0 1.5px @A@, 0 0 24px @S@')) for n, l in
                    [(1, 'Hard lumps'), (2, 'Lumpy sausage'), (3, 'Cracked sausage'), (4, 'Smooth sausage'), (5, 'Soft blobs'), (6, 'Mushy'), (7, 'Watery')])
    stool = (f'<div class="ax-r ax-d1" style="display: flex; flex-direction: column; gap: 10px">{section_label("Bristol type")}<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">{tiles}</div></div>' + time_note())
    form('G2-Stool.dc.html', 'Stool form', 'Stool', stool, 'Save stool entry')
    tiles0 = ''.join(stool_tile(n, l) for n, l in STOOL_TYPES)
    stool0 = (f'<div class="ax-r ax-d1" style="display: flex; flex-direction: column; gap: 10px">{section_label("Bristol type")}<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">{tiles0}</div></div>' + time_note())
    form('G2-Stool-Empty.dc.html', 'Stool form, nothing chosen', 'Stool', stool0, 'Save stool entry', missing='Missing: a Bristol type')

    # ---------------------------------------------------------------- Reaction (IN-13)
    urgent = (f'<div class="ax-r ax-d1" role="note" style="position: sticky; top: 0; z-index: 2; display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; border-radius: 26px; background: rgba(255,138,107,0.14); box-shadow: inset 0 0 0 1.5px rgba(255,138,107,0.5)">'
              f'<span style="width: 36px; height: 36px; border-radius: 999px; background: {CORAL}; display: flex; align-items: center; justify-content: center; flex: none">{svg(IC["reaction"], 20, ONALERT, 2)}</span>'
              f'<span style="font-size: 14.5px; line-height: 20px; font-weight: 600; color: {TEXT}">{URGENT}</span></div>')
    syms = chips([chip('Hives', 'on'), chip('Lip or mouth tingling', 'on'), chip('Swelling'), chip('Stomach symptoms')])
    meals = f'<div style="display: flex; flex-direction: column; gap: 8px">{radio_row("Chicken salad", "12:40 today", True)}{radio_row("Oatmeal with banana", "07:30 today", False)}</div>'
    react = (urgent + block('Which meal', meals, f'<span style="font-size: 13px; color: {MUTED}">last 24 hours</span>') + block('Symptoms', syms, cls='ax-r ax-d3')
             + f'<div class="ax-r ax-d4" style="display: flex; flex-direction: column; gap: 10px">{section_label("Onset")}{time_row("13:10 · 30 min after the meal")}</div>')
    form('G2-Reaction.dc.html', 'Reaction form', 'Reaction', react, 'Save reaction', h=1060)
    react_n = (urgent + f'<div class="ax-r ax-d2" style="display: flex; flex-direction: column; gap: 14px; align-items: center; text-align: center; padding: 26px 10px">'
               f'<div aria-hidden="true" style="position: relative; width: 120px; height: 120px; border-radius: 999px; {GLASS_BLUR}; display: flex; align-items: center; justify-content: center"><div style="position: absolute; inset: 12px; border-radius: 999px; border: 2px dashed rgba(255,255,255,0.18)"></div>{svg(IC["meal"], 40, "@A@", 1.8)}</div>'
               f'<h2 style="margin: 0; font-size: 20px; font-weight: 800">Log a meal first</h2>{body_text("A reaction is linked to a meal from the last 24 hours.", SOFT, 15)}{btn("Log a meal", "glass", "meal")}</div>')
    form('G2-Reaction-NoMeals.dc.html', 'Reaction form, no meal to react to', 'Reaction', react_n, 'Save reaction', missing='Missing: a meal to react to')

    # ---------------------------------------------------------------- Routine change
    desc_p = lambda t, d: panel(f'<div style="font-size: 14px; font-weight: 700">{t}</div>{body_text(d, SOFT, 13.5)}', pad='12px 16px', gap=2, extra='; background: rgba(255,255,255,0.05)')
    started = (f'<div class="ax-r ax-d1">{seg(["Started", "Stopped"], 0, "Action")}</div>'
               + block('Category', chips([chip('Product', 'on'), chip('Diet'), add_chip('Add category')]), cls='ax-r ax-d2')
               + desc_p('Product', 'Anything that touches the skin or its surroundings: cosmetics, detergents, clothing, jewelry. Log it once when it starts and once when it stops.')
               + f'<div class="ax-r ax-d3" style="display: flex; flex-direction: column; gap: 10px">{field("chName", "Name", "Name (product, medication or diet)", "Fragrance-free soap")}'
               f'{toggle_row("Already using, date unknown", False, "Saved without a date. The analysis is told it was already in use.")}</div>' + time_note('Today · 14 Nov'))
    form('G2-Routine-Started.dc.html', 'Routine change: started', 'Routine change', started, 'Save changes', h=1000)
    use = lambda t, c, on: radio_row(t, c, on).replace(icon_circle('meal', 40, 22), icon_circle('change', 40, 22))
    stopped = (f'<div class="ax-r ax-d1">{seg(["Started", "Stopped"], 1, "Action")}</div>'
               + block('In use now', f'<div style="display: flex; flex-direction: column; gap: 8px">{use("Fragrance-free soap", "Product · since 14 Nov", True)}{use("Gluten-free diet", "Diet · date unknown", False)}</div>')
               + time_note('Today · 14 Nov'))
    form('G2-Routine-Stopped.dc.html', 'Routine change: stopped', 'Routine change', stopped, 'Save changes')

    # ---------------------------------------------------------------- Medical event
    kinds = chips([chip('Visit'), chip('Test result'), chip('Diagnosis'), chip('Illness', 'on'), chip('Other')])
    end_row = (f'<div style="display: flex; align-items: center; gap: 12px; padding: 12px 14px 12px 16px; border-radius: 26px; {GLASS}"><span style="flex: 1"><span style="display: block; font-size: 15.5px; font-weight: 600">Ended on</span>'
               f'<span style="display: block; font-size: 13px; color: {MUTED}">not set</span></span>{btn("Set end date", "glass", h=44)}</div>')
    med_ev = (block('Kind', kinds, cls='ax-r ax-d1')
              + f'<div class="ax-r ax-d2" style="display: flex; flex-direction: column; gap: 10px">{field("evTitle", "Title", "Title", "Throat infection")}{end_row}'
              f'{body_text("Optional. Leave it empty while the illness goes on. A Daily health yes/no for illness stays the quick way to mark a day.", MUTED, 13)}</div>'
              + time_note('Today · 14 Nov'))
    form('G2-MedicalEvent.dc.html', 'Medical event: illness', 'Medical event', med_ev, 'Save medical event', h=940)
    med_e = (block('Kind', chips([chip('Visit', 'on'), chip('Test result'), chip('Diagnosis'), chip('Illness'), chip('Other')]), cls='ax-r ax-d1')
             + f'<div class="ax-r ax-d2">{field("evTitle2", "Title", "Title", None, focus=True)}</div>' + time_note('Today · 14 Nov'))
    form('G2-MedicalEvent-Empty.dc.html', 'Medical event, no title', 'Medical event', med_e, 'Save medical event', missing='Missing: a title')

    # ---------------------------------------------------------------- Treatment application edit (IN-11)
    react_seg = seg(['None', 'Mild', 'Strong'], -1, 'Reaction after applying')
    edit = (f'<div class="ax-r ax-d1" style="display: flex; flex-direction: column; gap: 10px">{section_label("Treatment")}{chips([chip("Emollient", "on")])}</div>'
            + block('Applied to', chips([chip('Chin', 'on'), chip('Neck', 'on'), chip('Sternum')]))
            + f'<div class="ax-r ax-d3" style="display: flex; flex-direction: column; gap: 10px">{section_label("Reaction after applying")}{react_seg}'
            f'{body_text("Burning, itching or redness after applying. Leave it empty if you did not note it: empty is not the same as none.", MUTED, 13)}</div>'
            + time_note('09:10 · 14 Nov'))
    form('G2-TreatmentEdit.dc.html', 'Edit a treatment application', 'Edit entry', edit, 'Save changes', h=900)

TITLE = 'Group 2: Entry forms'
NEEDS = '''Group 2: Needs approval

1. Reaction: the urgent-care advice is a coral note under the header and stays pinned while the form scrolls. Affects IN-13.
2. Reaction with no meal: the same form with "Log a meal first" and a glass Log a meal button; Save stays disabled with a missing line. Affects IN-13, UX-3.
3. Medication and Treatment: Regular switch with its hint; reminders are not set in the form. Affects IN-17, UX-4.
4. Treatment application edit: Reaction None | Mild | Strong as a segmented control with nothing selected; the hint says empty is not none. Affects IN-11.
5. Medical event: an Illness shows "Ended on" with a Set end date button. Affects IN-18.
6. Routine change: Stopped lists the items in use now as a single choice. Affects IN-12.
7. Chips are 38 pt high as approved; the tap area should be 44 pt. Affects UX-8 (deferred).'''
