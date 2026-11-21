"""Group 5: Settings. Every settings detail screen, privacy, AI key and models, data and backup, import preview, delete data.
Requirements: UX-4, UX-8, SK-2..SK-5, EN-3, IN-14..IN-19, RE-1..RE-4, NO-1..NO-3, SE-1..SE-9, LL-1..LL-3, EX-1..EX-10."""
from lib import *
from group2 import chips, block, note_field
from group4 import pushed_fp, date_pill

def nrow(icon, title, value=None, sub=None, last=False, danger=False):
    return R['nav_row'](icon, title, value, sub, danger=danger, last=last)

def grp(title, rows):
    return group(title, rows)

def hint(text):
    return body_text(text, MUTED, 13.5)

def choice_row(icon, title, detail, on):
    ring = 'box-shadow: inset 0 0 0 1.5px @A@, 0 0 24px @S@; background: rgba(255,255,255,0.08)' if on else GLASS
    dot = (f'<span style="width: 24px; height: 24px; border-radius: 999px; background: @A@; display: flex; align-items: center; justify-content: center; flex: none">{svg(IC["check"], 15, ONACC, 2.8)}</span>' if on
           else '<span style="width: 24px; height: 24px; border-radius: 999px; box-shadow: inset 0 0 0 1.5px rgba(255,255,255,0.34); flex: none"></span>')
    return (f'<button role="radio" aria-checked="{"true" if on else "false"}" style="display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 8px 16px 8px 8px; border-radius: 999px; {ring}">{icon_circle(icon, 40, 22)}'
            f'<span style="flex: 1; min-width: 0"><span style="display: block; font-size: 15.5px; font-weight: 600">{title}</span><span style="display: block; font-size: 13px; color: {MUTED}">{detail}</span></span>{dot}</button>')

def stepper(label, value, unit=''):
    def b(sym, lab):
        glyph = svg(IC['plus'] if sym == 'p' else R['MINUS'], 18, TEXT, 2.4)
        return (f'<button aria-label="{lab}" style="width: 44px; height: 44px; border-radius: 999px; {GLASS}; display: flex; align-items: center; justify-content: center; flex: none">{glyph}</button>')
    return (f'<div style="display: flex; align-items: center; gap: 12px; padding: 10px 12px 10px 18px; border-radius: 999px; {GLASS_BLUR}"><span style="flex: 1; font-size: 15.5px; font-weight: 600">{label}</span>'
            + b('m', 'Lower ' + label) + f'<span style="min-width: 44px; text-align: center; font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums">{value}{unit}</span>' + b('p', 'Raise ' + label) + '</div>')

def edit_row(name, sub=None, tail=''):
    s = f'<span style="display: block; font-size: 12.5px; color: {MUTED}">{sub}</span>' if sub else ''
    return (f'<div style="display: flex; align-items: center; gap: 8px; min-height: 56px; padding: 6px 6px 6px 16px; border-bottom: 1px solid rgba(255,255,255,0.07)"><span style="flex: 1; min-width: 0"><span style="display: block; font-size: 15.5px; font-weight: 600">{name}</span>{s}</span>{tail}'
            f'<button aria-label="Open {name}" style="width: 44px; height: 44px; display: flex; align-items: center; justify-content: center">{svg(IC["chev"], 18, MUTED, 2)}</button></div>')

def list_panel(rows):
    return f'<div style="display: flex; flex-direction: column; padding: 2px 8px 2px 0; border-radius: 28px; {GLASS_BLUR}">{"".join(rows)}</div>'

def add_row(label):
    return btn(label, 'glass', 'plus', full=True, h=48)

def sw(title, on, h=None, icon=None):
    return toggle_row(title, on, h, icon)

def run():
    P = lambda name, ttl, head, sub, body, **k: pushed(name, ttl, head, sub, 'Back to Settings', body, **k)

    # ---- AI suggestions on Today (IN-17)
    P('G5-Suggestions.dc.html', 'Settings: Suggestions', 'Suggestions', 'Today',
      f'<div class="ax-r ax-d2" style="display: flex; flex-direction: column; gap: 10px">{sw("Suggest on Today", True, "Shows a Today card for a new suggestion: ingredients, a restaurant meal, or an AI result to review.", "sparkle")}{sw("Suggest the next time of a regular item", True, "Suggests the next time of a regular item on Today, at its usual time.", "clock")}</div>'
      + hint('Suggestions are never selected for you. You always tap to accept.'))

    # ---- Day start (UX-5)
    ds = chips([chip('00:00'), chip('02:00'), chip('03:00', 'on'), chip('04:00'), chip('05:00'), chip('06:00')])
    P('G5-DayStart.dc.html', 'Settings: Day start', 'Day start', 'Settings',
      block('Day starts at', ds, cls='ax-r ax-d2') + hint('A late-night entry after midnight but before this time counts for the day before. Changing it moves no entry.'))

    # ---- Flare threshold (SK-8)
    P('G5-FlareThreshold.dc.html', 'Settings: Flare threshold', 'Flare threshold', 'Skin',
      f'<div class="ax-r ax-d2">{stepper("Severity of", 8)}</div>' + hint('An area is marked as in a flare when its latest severity is at or above this number. It sets the coral marker on the chart and the flare pill on Today.')
      + f'<div class="ax-r ax-d3">{seg(["Per area", "Same for all"], 1, "Threshold scope")}</div>')

    # ---- Daily health items (IN-15)
    items = ''.join(edit_row(n, s) for n, s in [('Wellbeing', 'Score 1 to 10'), ('Stress', 'Score 1 to 10'), ('Sleep quality', 'Score 1 to 10'), ('Abdominal pain', 'Score 1 to 10, optional'), ('Bloating', 'Yes or no'), ('Hot or long shower', 'Yes or no')])
    P('G5-DailyHealthItems.dc.html', 'Settings: Daily health items', 'Daily health items', 'Settings',
      f'<div class="ax-r ax-d2">{list_panel([items])}</div><div class="ax-r ax-d3">{add_row("Add an item")}</div>' + hint('Up to 3 scores sit on the Daily health form; the rest go under “More”. Turning an item off keeps its past values.'), h=1000)

    # ---- Skin and nail areas (SK-2)
    ar = ''.join(edit_row(n, s) for n, s in [('Chin', 'Skin · pinned'), ('Neck', 'Skin · pinned'), ('Ears, inside', 'Skin'), ('Behind the ears', 'Skin'), ('Sternum', 'Skin')])
    nl = ''.join(edit_row(n, 'Nails') for n in ['Left thumb', 'Right index'])
    P('G5-SkinAreas.dc.html', 'Settings: Skin and nail areas', 'Skin and nail areas', 'Settings',
      f'<div class="ax-r ax-d2" style="display: flex; flex-direction: column; gap: 8px">{section_label("Skin")}{list_panel([ar])}</div><div class="ax-r ax-d3" style="display: flex; flex-direction: column; gap: 8px">{section_label("Nails")}{list_panel([nl])}</div>'
      f'<div class="ax-r ax-d3">{add_row("Add an area")}</div>' + hint('Pinned areas come first on the skin form (5 at most).'), h=1100)

    # ---- Treatments (SK-4)
    tr = ''.join(edit_row(n, s) for n, s in [('Emollient', 'Regular · 2 times a day'), ('Cool compress', 'Used when needed'), ('Prescription cream', 'Regular · 1 time a day')])
    P('G5-Treatments.dc.html', 'Settings: Treatments', 'Treatments', 'Settings',
      f'<div class="ax-r ax-d2">{list_panel([tr])}</div><div class="ax-r ax-d3">{add_row("Add a treatment")}</div>' + hint('Archived treatments stay on past entries and leave the pick list.'))

    # ---- Regular items (RE-1)
    P('G5-RegularItems.dc.html', 'Settings: Regular items', 'Regular items', 'Settings',
      f'<div class="ax-r ax-d2" style="display: flex; flex-direction: column; gap: 8px">{section_label("Active")}{list_panel([edit_row("Emollient", "Treatment · 08:00, 21:00"), edit_row("Daily vitamin", "Supplement · 08:00"), edit_row("Antihistamine", "Medication · as needed")])}</div>'
      f'<div class="ax-r ax-d3" style="display: flex; flex-direction: column; gap: 8px">{section_label("Stopped")}{list_panel([edit_row("Zinc", "Supplement · stopped 2 Nov")])}</div><div class="ax-r ax-d4">{add_row("Add a regular item")}</div>')

    # ---- Routine categories (IN-19)
    cats = ''.join(edit_row(n) for n in ['New product', 'Different washing powder', 'Travel', 'Illness', 'Stress period', 'Diet change'])
    P('G5-RoutineCategories.dc.html', 'Settings: Routine categories', 'Routine categories', 'Settings',
      f'<div class="ax-r ax-d2">{list_panel([cats])}</div><div class="ax-r ax-d3">{add_row("Add a category")}</div>' + hint('These are the choices on Routine change. Removing one keeps it on past entries.'), h=960)

    # ---- Favorites (IN-4)
    fv = ''.join(edit_row(n, s) for n, s in [('Oatmeal with banana', 'Meal · 3 ingredients'), ('Black coffee', 'Drink'), ('Chicken salad', 'Meal · 5 ingredients')])
    P('G5-Favorites.dc.html', 'Settings: Favorites', 'Favorites', 'Settings',
      f'<div class="ax-r ax-d2">{list_panel([fv])}</div>' + hint('Open one to rename it or change its ingredients. Removing a favorite changes no entry.'))

    # ---- Reminders (NO-1..3)
    P('G5-Reminders.dc.html', 'Settings: Reminders', 'Reminders', 'Settings',
      f'<div class="ax-r ax-d2" style="display: flex; flex-direction: column; gap: 10px">{sw("Reminders", True, "Local notifications only. Nothing leaves the phone.", "bell")}{sw("Hide names in reminders", False, "A reminder then says only “Time for your treatment”.", "lock")}</div>'
      f'<div class="ax-r ax-d3">{grp("", [nrow("clock", "Quiet hours", "22:00 to 07:00"), nrow("bell", "Daily health reminder", "21:30", last=True)]).replace(section_label(""), "")}</div>'
      + hint('Reminders for regular items are set on each item. The reminder has one button, Applied, which logs it.'))
    den = banner('Notifications are off', 'Allow notifications for Nettle in the iPhone settings to get reminders. Nothing is lost: your reminders stay saved.', 'info', kind='alert', actions=btn('Open iPhone settings', 'glass', 'sliders', h=44))
    off_switch = toggle_row('Reminders', False, 'Turn on after allowing notifications.', 'bell').replace('aria-checked', 'aria-disabled="true" aria-checked')
    P('G5-Reminders-Denied.dc.html', 'Settings: Reminders, permission denied', 'Reminders', 'Settings',
      f'<div class="ax-r ax-d1">{den}</div><div class="ax-r ax-d2">{off_switch}</div>', h=844)

    # ---- Privacy and photos (SE-4..SE-8)
    P('G5-Privacy.dc.html', 'Settings: Privacy and photos', 'Privacy and photos', 'Settings',
      f'<div class="ax-r ax-d2" style="display: flex; flex-direction: column; gap: 10px">{sw("Lock the app", True, "Face ID or your passcode when you open the app. Today stays hidden until then.", "lock")}{sw("Blur sensitive photos", True, "Photos you mark sensitive are blurred in lists until you tap them.", "camera")}</div>'
      f'<div class="ax-r ax-d3">{grp("", [nrow("camera", "Mark new photos as sensitive", "Intimate areas only", None, True)]).replace(section_label(""), "")}</div>'
      + hint('Sensitive photos are excluded from every export, report and AI request unless you include them on that screen.'))

    # ---- AI key (LL-1) and models (LL-2)
    keyf = field('key', 'API key', 'sk-ant-…', None, 'key')
    put('G5-AIKey-Empty.dc.html', 'Settings: AI key, empty', content(gap=18) + pushed_header('AI key', 'AI', 'Back to Settings')
        + f'<div class="ax-r ax-d2">{keyf}</div>' + hint('The key is stored in the iOS Keychain on this phone and sent only to Anthropic. It is never in a backup or an export, and never shown in full.')
        + '</div>' + save_bar('Save key', 'Paste the key first'))
    keyhead = ('<div style="display: flex; align-items: center; gap: 12px">' + icon_circle('key', 40, 22)
               + '<div><div style="font-size: 15.5px; font-weight: 700">Key saved</div><div style="font-size: 13.5px; color: ' + MUTED + '; font-variant-numeric: tabular-nums">sk-ant-…••••9f2c</div></div></div>')
    P('G5-AIKey.dc.html', 'Settings: AI key, saved', 'AI key', 'AI',
      f'<div class="ax-r ax-d1">{panel(keyhead, gap=10)}</div>'
      f'<div class="ax-r ax-d2" style="display: flex; flex-direction: column; gap: 8px">{btn("Test the key (sends one request)", "glass", "check", full=True, h=52)}{btn("Replace key", "glass", "edit", full=True, h=52)}{btn("Remove key", "danger", "trash", full=True, h=52)}</div>'
      + hint('Testing sends one tiny request to Anthropic and may cost a fraction of a cent.'))

    models = ''.join([choice_row('sparkle', 'Haiku 5.5', 'Cheapest. Photo and name estimates', True), choice_row('sparkle', 'Sonnet 5.5', 'Balanced. Analyses', False), choice_row('sparkle', 'Opus 5.5', 'Most thorough and the most expensive', False)])
    P('G5-AIModels.dc.html', 'Settings: AI models', 'AI models', 'AI',
      block('Photo and name estimates', f'<div style="display: flex; flex-direction: column; gap: 8px">{models}</div>', cls='ax-r ax-d2')
      + block('Analysis', f'<div style="display: flex; flex-direction: column; gap: 8px">{choice_row("sparkle", "Haiku 5.5", "Cheapest", False)}{choice_row("sparkle", "Sonnet 5.5", "Balanced", True)}</div>', cls='ax-r ax-d3')
      + hint('Prices change. Each confirmation screen shows the model and the billing note before anything is sent.'), h=1000)

    # ---- Data and backup (EX-1..EX-9)
    P('G5-Data.dc.html', 'Settings: Data and backup', 'Data and backup', 'Settings',
      f'<div class="ax-r ax-d2">{grp("Export", [nrow("box", "Full backup", None, "Everything, including photos, as a ZIP"), nrow("sliders", "Custom export", None, "Choose a period and what to include", True)])}</div>'
      f'<div class="ax-r ax-d3">{grp("Import", [nrow("copy", "Import a backup", None, "Adds to or restores from a ZIP", True)])}</div>'
      f'<div class="ax-r ax-d4">{grp("Danger zone", [nrow("trash", "Delete data", None, "Erase entries, photos or everything", True, True)])}</div>'
      + hint('Exports go through the iOS share sheet and go nowhere unless you send them. A backup holds no AI key.'))

    pk = lambda n, s: chip(n, 'on')
    pushed_fp('G5-ExportCustom.dc.html', 'Settings: Custom export', 'Custom export', 'Data and backup', 'Back to Data and backup',
              block('Period', f'<div style="display: flex; gap: 8px">{date_pill("From", "1 Oct")}{date_pill("To", "14 Nov")}</div>', cls='ax-r ax-d2')
              + block('Include', f'<div style="display: flex; flex-wrap: wrap; gap: 8px">{pk("Entries", "true")}{pk("Photos", "true")}{pk("Doctor report PDF", "true")}</div>', cls='ax-r ax-d3')
              + f'<div class="ax-r ax-d3">{sw("Include sensitive photos (3)", False, "Off by default. Turned on, they are in the ZIP unblurred.", "lock")}</div>'
              + f'<div class="ax-r ax-d4">{grp("", [nrow("camera", "Pick photos one by one", "15 of 18", None, True)]).replace(section_label(""), "")}</div>',
              'Create export', h=1000, icon='box', note='Opens the share sheet. The file goes nowhere unless you send it.')

    # ---- Import preview (EX-9, EX-10)
    imp = (sent_list(['Entries: 118 new, 6 already here', '14 photos', 'Schema version 1', 'Entries you deleted here: 4 (they are in the backup)'], 'In this backup')
           + f'<div class="ax-r">{sw("Restore entries I deleted", False, "Off: the 4 entries you deleted on this phone stay deleted and are skipped. On: they come back.", "trash")}</div>'
           + f'<div style="display: flex; flex-direction: column; gap: 8px">{btn("Import", "primary", "check", full=True, h=56)}{btn("Cancel", "glass", full=True, h=52)}</div>')
    put('G5-ImportPreview.dc.html', 'Settings: Import preview', behind() + sheet('Import this backup?', None, imp, close=False), h=1000)
    put('G5-ImportDone.dc.html', 'Settings: Import done', behind() + sheet('Import finished', None,
        body_text('118 entries and 14 photos were added. 6 were already here. 4 deleted entries were skipped.', SOFT, 14.5) + btn('OK', 'primary', full=True, h=56), close=False))

    # ---- Delete data (SE-9)
    dd = (f'<div class="ax-r ax-d2" style="display: flex; flex-direction: column; gap: 10px">{section_label("Delete")}'
          + ''.join(choice_row(i, t, d, o) for i, t, d, o in [('meal', 'Entries in a period', 'Choose dates', False), ('camera', 'Photos only', 'Entries stay', False), ('trash', 'Everything', 'Entries, photos and settings', False)])
          + '</div>' + body_text('Deleting cannot be undone. You are offered an export first.', MUTED, 13.5))
    put('G5-Delete.dc.html', 'Settings: Delete data', content(gap=18) + pushed_header('Delete data', 'Data and backup', 'Back to Data and backup') + dd + '</div>' + save_bar('Continue', 'Choose what to delete first'))
    put('G5-Delete-Export.dc.html', 'Settings: Delete data, export first', behind() + action_sheet('Export first?', 'You are about to delete everything. A full backup is the only way to get it back.',
        btn('Export a backup first', 'primary', 'box', full=True, h=56) + btn('Continue without a backup', 'glass', full=True, h=52), 'Cancel'))
    put('G5-Delete-Confirm.dc.html', 'Settings: Delete data, final confirmation', behind() + action_sheet('Delete everything?', 'All entries, photos and settings on this phone are erased. This cannot be undone.',
        btn('Delete everything', 'dangerSolid', 'trash', full=True, h=56), 'Cancel'))

    # ---- About and Where do I log
    P('G5-About.dc.html', 'Settings: About', 'About', 'Settings',
      f'<div class="ax-r ax-d2">{grp("", [nrow("info", "Version", "0.1.0 (1)"), nrow("list", "Schema version", "1"), nrow("report", "Prompt version", "v3", None, True)]).replace(section_label(""), "")}</div>'
      + hint('Nettle is a private diary. Nothing it shows is a medical conclusion. Patterns are tentative and are for discussing with a doctor.'))
    wh = ''.join(nrow(i, t, None, s, l) for i, t, s, l in [('meal', 'A meal or a drink', 'Today, Meal or Drink', False), ('skin', 'A skin or nail change', 'Today, Skin or Nails', False), ('change', 'A new soap, travel or illness', 'More, Routine change', False), ('health', 'How the day went', 'Today, Daily health', False), ('medical', 'A doctor visit or test', 'More, Medical event', True)])
    P('G5-WhereDoILog.dc.html', 'Settings: Where do I log…', 'Where do I log…?', 'Settings',
      f'<div class="ax-r ax-d2">{group("", [wh]).replace(section_label(""), "")}</div>' + hint('Quick actions on Today can be changed in Edit Today.'), h=900)

TITLE = 'Group 5: Settings'
NEEDS = '''Group 5: Needs approval

1. Delete data: pick what to delete, then an export-first sheet, then a final confirmation (two asks, SE-9). Affects SE-9.
2. Import preview carries a "Restore entries I deleted" switch, off by default, and a count of skipped entries. Affects EX-9, EX-10.
3. Flare threshold: one stepper, scope "Per area" or "Same for all", default Same for all. Affects SK-8.
4. Custom export reuses the report's "Pick photos one by one" row and the sensitive photos switch, off by default. Affects EX-4, EX-7.
5. AI key: Save key stays disabled with a "Paste the key first" line; key shown only as the last 4 characters; "Test the key" mentions a possible tiny cost. Affects LL-1, LL-3.
6. AI models: one choice for photo and name estimates and one for analysis, each a single choice. Affects LL-2.
7. Reminders denied: a coral banner with "Open iPhone settings" and a disabled switch. Affects NO-3.
8. Where do I log…? is a settings list of what goes where, not a search. Affects UX-4.'''
