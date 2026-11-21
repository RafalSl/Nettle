"""Group 1: Today states. Past day, first-run, Medication and Stool quick sheets, merged-dot sheet, date picker, Edit Today.
Requirements: UX-2, UX-3, UX-12, IN-5, IN-11, IN-17, EN-1. Copies: Today-AuroraRing, Sheet-Treatment, More."""
from lib import *

def run():
    # ---------------------------------------------------------------- past day
    today('G1-Today-PastDay.dc.html', 'Today: a past day',
          dots=[ring_dot('out', 7.5, 'filled', 'Oatmeal with banana, 07:30'), ring_dot('out', 12.7, 'filled', 'Chicken salad, 12:40'),
                ring_dot('out', 19.2, 'filled', 'Rice with vegetables, 19:10'), ring_dot('in', 8.0, 'hollow', 'Emollient, 08:00'),
                ring_dot('in', 21.5, 'hollow', 'Daily health, 21:30')],
          arc=None, weekday='Thursday', date='12 Nov', count='5 entries', past=True, back=True,
          rows=[log_row('health', 'Daily health', 'Wellbeing 6 · Stress 4', '21:30'), log_row('meal', 'Rice with vegetables', '', '19:10'),
                log_row('meal', 'Chicken salad', 'egg, mustard', '12:40')],
          log_label='Log', log_n='5 entries')

    # ---------------------------------------------------------------- first run
    card = panel(
        f'<div style="display: flex; align-items: center; gap: 12px">{icon_circle("guide", 40, 22)}'
        f'<span style="font-size: 14.5px; line-height: 20px; color: {SOFT}">Your diary is empty. Start with a meal, or see where each kind of entry goes.</span></div>'
        f'<div style="display: flex; gap: 8px">{btn("Log a meal", "primary", "meal", extra="; flex: 1")}{btn("Where do I log…?", "glass", extra="; flex: 1")}</div>', pad='14px', gap=12)
    today('G1-Today-FirstRun.dc.html', 'Today: first run, empty diary', dots=[], arc=14.33, count='0 entries · 14:20', card=card,
          rows=[], empty_log=True, log_label='Log', log_n='', h=930)

    # ---------------------------------------------------------------- Medication quick sheet
    med_inner = (section_label('Regular medication and supplements')
                 + '<div style="display: flex; flex-direction: column; gap: 8px">'
                 + qrow('medication', 'Vitamin D3', '1 tablet · reminder 08:00', 'done:Taken 08:05')
                 + qrow('medication', 'Fish oil', '2 capsules · reminder 20:00')
                 + '</div>' + other_or_earlier())
    put('G1-Sheet-Medication.dc.html', 'Medication quick sheet',
        behind() + sheet('Medication', 'Tap to log it now', med_inner))

    # ---------------------------------------------------------------- Stool quick sheet
    types = [(1, 'Hard lumps'), (2, 'Lumpy sausage'), (3, 'Cracked sausage'), (4, 'Smooth sausage'), (5, 'Soft blobs'), (6, 'Mushy'), (7, 'Watery')]
    tiles = ''
    for n, lab in types:
        if n == 4:
            tiles += (f'<button disabled aria-disabled="true" aria-label="Stool type 4 saved at 14:20" style="display: flex; align-items: center; gap: 10px; height: 52px; padding: 0 12px 0 6px; border-radius: 999px; box-shadow: inset 0 0 0 1.5px @A@, 0 0 28px @S@; background: rgba(255,255,255,0.08)">'
                      f'<span style="width: 40px; height: 40px; border-radius: 999px; background: @A@; color: {ONACC}; display: flex; align-items: center; justify-content: center; font-size: 17px; font-weight: 800">4</span>'
                      f'<span style="font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums">Saved 14:20</span></button>')
        else:
            tiles += stool_tile(n, lab)
    tiles += (f'<button style="display: flex; align-items: center; justify-content: center; gap: 8px; height: 52px; border-radius: 999px; {GLASS}; font-size: 14.5px; font-weight: 600">{svg(IC["clock"], 18)}Earlier…</button>')
    put('G1-Sheet-Stool.dc.html', 'Stool quick sheet',
        behind() + sheet('Stool', 'Tap a type to save it now, 1 hard lumps to 7 watery', f'<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px">{tiles}</div>'))

    # ---------------------------------------------------------------- merged dot
    scrim = '<div aria-hidden="true" style="position: absolute; inset: 0; background: rgba(3,6,10,0.55)"></div>'
    merged_rows = (log_row('meal', 'Almonds', '', '13:05') + log_row('drink', 'Rooibos tea, 250 ml', '', '12:55') + log_row('meal', 'Chicken salad', 'egg, mustard', '12:40'))
    today('G1-Sheet-MergedDot.dc.html', 'Merged dot: pick an entry',
          dots=[ring_dot('out', 12.9, 'filled', '3 entries around 12:50', count=3), ring_dot('in', 9.2, 'hollow', 'Emollient, 09:10'), ring_dot('in', 13.1, 'care', 'Stool, type 4, 13:05')],
          count='5 entries · 14:20', pills=[pill('Backup: 9 days ago')],
          rows=[log_row('stool', 'Stool, type 4', '', '13:05'), log_row('meal', 'Almonds', '', '13:05')],
          log_n='5 entries',
          overlay=scrim + sheet('Around 12:50', '3 entries close together. Pick one to edit or delete.',
                                f'<div style="display: flex; flex-direction: column; gap: 8px">{merged_rows}</div>'))

    # ---------------------------------------------------------------- date picker
    wk = ''.join(f'<span style="text-align: center; font-size: 12px; font-weight: 600; color: {MUTED}">{d}</span>' for d in 'MTWTFSS')
    cells = ['<span></span>'] * 6
    for d in range(1, 31):
        future = d > 14
        sel = d == 10
        today_ = d == 14
        if sel:
            st = f'background: @A@; color: {ONACC}; font-weight: 800; '
        elif today_:
            st = 'box-shadow: inset 0 0 0 1.8px #F2F5F9; font-weight: 800; '
        else:
            st = 'font-weight: 500; '
        op = 'opacity: 0.3; ' if future else ''
        dis = ' disabled aria-disabled="true"' if future else ''
        dot = ('' if (future or sel) else '<span style="position: absolute; bottom: 5px; left: 50%; margin-left: -2px; width: 4px; height: 4px; border-radius: 999px; background: #F2F5F9"></span>')
        cells.append(f'<button{dis} aria-label="{d} November" style="position: relative; height: 44px; border-radius: 999px; {st}{op}font-size: 14.5px; font-variant-numeric: tabular-nums; display: flex; align-items: center; justify-content: center">{d}{dot}</button>')
    cal = (f'<div style="display: flex; flex-direction: column; gap: 10px; padding: 8px 6px 6px 6px">'
           f'<div style="display: flex; align-items: center; justify-content: space-between">{circle_btn("back", "Previous month")}<span style="font-size: 17px; font-weight: 700">November 2026</span>'
           f'<button aria-label="Next month, not available" disabled aria-disabled="true" style="width: 44px; height: 44px; border-radius: 999px; display: flex; align-items: center; justify-content: center; opacity: 0.3">{svg(IC["chev"], 19, TEXT, 2)}</button></div>'
           f'<div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); row-gap: 2px; column-gap: 2px">{wk}{"".join(cells)}</div></div>')
    put('G1-DatePicker.dc.html', 'Date picker',
        behind() + sheet('Jump to a date', 'A day with a dot has entries. No future days.', cal + btn('Back to Today', 'glass', 'back', full=True, h=52)), h=900)

    # ---------------------------------------------------------------- Edit Today
    def pin_card(icon, title, first=False, last=False):
        def b(label, ic, dis=False, flex='1'):
            o = ' disabled aria-disabled="true"' if dis else ''
            op = '; opacity: 0.38' if dis else ''
            return (f'<button{o} aria-label="{label} {title}" style="flex: {flex}; height: 44px; border-radius: 999px; {GLASS}{op}; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 14px; font-weight: 600">'
                    f'{svg(IC[ic] if ic in IC else ic, 17, TEXT, 2)}{label}</button>')
        up = '<path d="M6 15l6-6 6 6"/>'
        dn = '<path d="M6 9l6 6 6-6"/>'
        return panel(f'<div style="display: flex; align-items: center; gap: 12px">{icon_circle(icon, 34, 19)}<span style="flex: 1; font-size: 15.5px; font-weight: 600">{title}</span></div>'
                     f'<div style="display: flex; gap: 8px">{b("Up", up, first)}{b("Down", dn, last)}{b("Move to More", "x", False, "1.7")}</div>', pad='12px 14px', gap=10)
    pinned = ''.join([pin_card('meal', 'Meal', first=True), pin_card('skin', 'Skin'), pin_card('treatment', 'Treatment'), pin_card('health', 'Daily health'), pin_card('stool', 'Stool', last=True)])

    def more_row(icon, title, hint):
        return (f'<div style="display: flex; align-items: center; gap: 10px; padding: 10px 10px 10px 14px; min-height: 64px; border-radius: 26px; {GLASS_BLUR}">{icon_circle(icon, 34, 19)}'
                f'<span style="flex: 1; min-width: 0"><span style="display: block; font-size: 15.5px; font-weight: 600">{title}</span><span style="display: block; font-size: 12.5px; line-height: 16px; color: {MUTED}">{hint}</span></span>'
                f'<button disabled aria-disabled="true" style="flex: none; height: 44px; padding: 0 14px; border-radius: 999px; background: rgba(255,255,255,0.07); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.10); color: rgba(242,245,249,0.38); font-size: 14px; font-weight: 600">Pin to Today</button></div>')
    in_more = ''.join([more_row('drink', 'Drink', 'Any drink, with an alcohol switch'), more_row('medication', 'Medication', 'A medicine or supplement you took once'),
                       more_row('nails', 'Nails', 'Stage, extent and photos of a nail'), more_row('reaction', 'Reaction', 'Symptoms after a meal'),
                       more_row('change', 'Routine change', 'A product or diet you started or stopped'), more_row('medical', 'Medical event', 'A visit, test result, diagnosis or illness')])
    body = (f'<div style="display: flex; flex-direction: column; gap: 8px">{section_label("On Today", cnt("5 of 5"))}{pinned}</div>'
            + banner('', 'Today keeps 5 pinned actions plus More. Move one to More to pin another. More is always on Today.', 'info')
            + f'<div style="display: flex; flex-direction: column; gap: 8px">{section_label("In More")}{in_more}</div>')
    pushed('G1-EditToday.dc.html', 'Edit Today', 'Edit Today', 'Choose what sits on Today', 'Back to More', body, h=1760)

    # ---------------------------------------------------------------- Edit Today, room to pin
    pinned4 = ''.join([pin_card('meal', 'Meal', first=True), pin_card('skin', 'Skin'), pin_card('treatment', 'Treatment'), pin_card('health', 'Daily health', last=True)])

    def more_row_ok(icon, title, hint):
        return more_row(icon, title, hint).replace('disabled aria-disabled="true" style="flex: none; height: 44px; padding: 0 14px; border-radius: 999px; background: rgba(255,255,255,0.07); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.10); color: rgba(242,245,249,0.38);',
                                                    'aria-label="Pin ' + title + ' to Today" style="flex: none; height: 44px; padding: 0 14px; border-radius: 999px; box-shadow: inset 0 0 0 1.5px @L@; color: @A@;')
    body2 = (f'<div style="display: flex; flex-direction: column; gap: 8px">{section_label("On Today", cnt("4 of 5"))}{pinned4}</div>'
             + f'<div style="display: flex; flex-direction: column; gap: 8px">{section_label("In More")}{more_row_ok("stool", "Stool", "One entry with its Bristol type")}{more_row_ok("drink", "Drink", "Any drink, with an alcohol switch")}{more_row_ok("medication", "Medication", "A medicine or supplement you took once")}</div>')
    pushed('G1-EditToday-Room.dc.html', 'Edit Today, one slot free', 'Edit Today', 'Choose what sits on Today', 'Back to More', body2, h=1480)

if __name__ == '__main__':
    run()

TITLE = 'Group 1: Today states'
NEEDS = '''Group 1: Needs approval

1. Edit Today is a pushed screen (Back, no Done). Each pinned row has Up, Down and Move to More; Pin to Today is disabled at 5 with a note. Affects UX-2.
2. Merged dot: the sheet lists its entries first, then each opens Edit or Delete. Affects UX-2, EN-1.
3. Stool quick sheet: a 2-column grid of the 7 types plus Earlier…; the tapped tile turns into "Saved 14:20". Affects UX-3, NF-2.
4. Past day: "Back to Today" replaces the context pills; the next-day arrow is active. Affects UX-2.
5. First-run card carries two buttons: Log a meal (primary) and Where do I log…?. Affects UX-2, UX-11.
6. Ring dots are 28 pt as approved; the tap area should be 44 pt (hit slop). Affects UX-8 (deferred).'''
