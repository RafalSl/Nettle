"""Group 4: Review. Areas, a day's full log, Doctor report, AI analysis (confirm, progress, result, interrupted, failed),
Daily health trends, Suggestions to review, the Claude plan pack, and the trend range switch.
Requirements: UX-10, SK-6, SK-7, SK-8, EN-1, EX-3, EX-4, EX-7, EX-14, LL-4..LL-8, LL-12, LL-14, LL-15, IN-20. Copies: Review, Area timeline."""
from lib import *
from group2 import chips, block, note_field
from group3 import estimate_panel, SRC_PILL

def kvpanel(rows):
    return panel(''.join(rows), gap=8)

def date_pill(label, value):
    return (f'<button style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; padding: 10px 16px; border-radius: 26px; {GLASS}">'
            f'<span style="font-size: 12.5px; color: {MUTED}">{label}</span><span style="font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums">{value}</span></button>')

def day_rows():
    return (R['day_row']('Saturday, 14 Nov', 8, False) + R['day_row']('Friday, 13 Nov', 7, True) + R['day_row']('Thursday, 12 Nov', 6, True))

def review_top(card_b):
    return (f'<div class="ax-r ax-d1" style="display: flex; align-items: center; justify-content: space-between; padding-left: 4px"><h1 style="margin: 0; font-size: 34px; font-weight: 800; letter-spacing: -1px">Review</h1>{gear()}</div>'
            f'<div class="ax-r ax-d2" style="display: flex; gap: 10px">{R["output_card"]("report", "Doctor report", "Since last export")}{card_b}</div>')

def status_card(sub, dot=True):
    d = '<span aria-hidden="true" style="width: 8px; height: 8px; border-radius: 999px; background: @A@; box-shadow: 0 0 10px @S@; flex: none"></span>' if dot else ''
    return (f'<button style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 10px; padding: 14px; border-radius: 28px; background: rgba(255,255,255,0.08); box-shadow: inset 0 0 0 1.5px @L@, 0 0 28px @S@">'
            f'{icon_circle("sparkle", 40, 22)}<span><span style="display: block; font-size: 16px; font-weight: 700">AI analysis</span>'
            f'<span style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: {SOFT}; margin-top: 2px; font-variant-numeric: tabular-nums">{d}{sub}</span></span></button>')

def area_row(name, sub, flare=False, last=False, icon='skin'):
    val = ''
    if flare:
        val = f'<span style="height: 26px; padding: 0 10px; border-radius: 999px; background: rgba(255,138,107,0.14); box-shadow: inset 0 0 0 1px rgba(255,138,107,0.38); color: {CORAL}; font-size: 12.5px; font-weight: 700; display: flex; align-items: center">flare</span>'
    return R['nav_row'](icon, name, val or None, sub, last=last)

def pushed_fp(name, title, header_title, sub, back, body, primary, h=1000, note=None, icon='check', right=''):
    """Pushed screen with its one primary button floating at the bottom."""
    put(name, title, content(gap=18) + pushed_header(header_title, sub, back, right) + body + '</div>' + float_primary(primary, icon, note), h=h)

def run():
    # ---------------------------------------------------------------- Areas
    seg_areas = seg(['Days', 'Areas'], 1, 'Review view')
    skin_rows = [area_row('Chin', 'severity 8 · 14 Nov', True), area_row('Neck', 'severity 4 · 13 Nov'), area_row('Ears, inside', 'severity 3 · 12 Nov'),
                 area_row('Behind the ears', 'severity 2 · 12 Nov'), area_row('Sternum', 'severity 3 · 9 Nov', last=True)]
    nail_rows = [area_row('Left thumb', 'Separation · 12 Nov', icon='nails'), area_row('Right index', 'No entries yet', last=True, icon='nails')]
    areas = (review_top(R['output_card']('sparkle', 'AI analysis', 'Last run 2 Nov')) + f'<div class="ax-r ax-d3">{seg_areas}</div>'
             + f'<div class="ax-r ax-d3">{group("Skin", skin_rows)}</div><div class="ax-r ax-d4">{group("Nails", nail_rows)}</div>')
    put('G4-Areas.dc.html', 'Review: Areas', content() + areas + '</div>' + tabbar('review', 'G4-Areas.dc.html'), h=1100)

    # ---------------------------------------------------------------- a day's full log
    log = ''.join([log_row('health', 'Daily health', 'Wellbeing 6 · Stress 4', '21:30'), log_row('meal', 'Rice with vegetables', '', '19:10'), log_row('stool', 'Stool, type 4', '', '13:05'),
                   log_row('meal', 'Chicken salad', 'egg, mustard', '12:40'), log_row('reaction', 'Reaction: hives', '', '13:10'), log_row('skin', 'Skin: Chin', 'severity 8 · 1 photo', '09:20'),
                   log_row('treatment', 'Emollient', 'Chin, Neck', '09:10'), log_row('meal', 'Oatmeal with banana', 'oats, banana, milk', '07:30')])
    day = (f'<div class="ax-r ax-d2">{banner("", "This day has a Daily health record. Entries below are newest first.", "check")}</div>'
           f'<div class="ax-r ax-d3" style="display: flex; flex-direction: column; gap: 8px">{section_label("Log", cnt("8 entries"))}{log}</div>'
           f'<div class="ax-r ax-d4">{btn("Open this day on Today", "glass", "clock", full=True, h=52)}</div>')
    pushed('G4-DayLog.dc.html', 'A day: the full log', 'Saturday, 14 Nov', '8 entries', 'Back to Review', day, h=1200)

    # ---------------------------------------------------------------- photo picker (EX-4, EX-7, SK-5)
    def pick(label, selected=False, sensitive=False):
        ph = R['photo'](label + ' · left out' if sensitive and not selected else label, sensitive, 108)
        if selected:
            badge = f'<span aria-hidden="true" style="position: absolute; right: 6px; bottom: 28px; width: 26px; height: 26px; border-radius: 999px; background: @A@; display: flex; align-items: center; justify-content: center">{svg(IC["check"], 15, ONACC, 2.8)}</span>'
            return f'<div role="checkbox" aria-checked="true" style="position: relative; border-radius: 24px; box-shadow: 0 0 0 2px @A@; width: 108px; height: 108px">{ph}{badge}</div>'
        return f'<div role="checkbox" aria-checked="false" style="position: relative; width: 108px; height: 108px">{ph}</div>'
    grid = ('<div style="display: flex; flex-wrap: wrap; gap: 10px">' + pick('14 Nov', True) + pick('12 Nov', True) + pick('12 Nov', False, True)
            + pick('9 Nov', True) + pick('9 Nov', False, True) + pick('5 Nov', True) + pick('2 Nov', True) + pick('30 Oct', False) + pick('28 Oct', True) + '</div>')
    pp = (f'<div class="ax-r ax-d1" style="display: flex; gap: 8px; align-items: center"><span style="flex: 1; font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums">15 of 18 selected</span>'
          f'{btn("Select all", "glass", h=44)}{btn("None", "glass", h=44)}</div>'
          f'<div class="ax-r ax-d2">{grid}</div>'
          + body_text('Photos marked with a lock are sensitive. They are blurred here and left out unless you tap them.', MUTED, 13.5))
    pushed_fp('G4-PhotoPick.dc.html', 'Pick photos one by one', 'Pick photos', 'Doctor report', 'Back to Doctor report', pp, 'Use 15 photos', h=900, icon='check')

    # ---------------------------------------------------------------- Doctor report
    rng = chips([chip('Since last export', 'on'), chip('Last 30 days'), chip('Last 90 days'), chip('Choose dates'), chip('Everything')])
    summ_head = '<div style="display: flex; align-items: center; gap: 10px">' + icon_circle('sparkle', 36, 20) + '<span style="font-size: 15.5px; font-weight: 700">Summary</span></div>'
    rep = (block('Period', rng + body_text('124 entries and 18 photos in this period.', SOFT, 14), cls='ax-r ax-d1')
           + f'<div class="ax-r ax-d2" style="display: flex; flex-direction: column; gap: 8px">{section_label("Photos")}{toggle_row("Include sensitive photos (3)", False, "Off by default. Sensitive photos leave the phone only when you turn this on.", "lock")}'
           f'{group("", [R["nav_row"]("camera", "Pick photos one by one", "15 of 18", last=True)]).replace(section_label(""), "")}</div>'
           + block('Report language', seg(['English', 'Polish'], 0, 'Report language'), cls='ax-r ax-d3')
           + f'<div class="ax-r ax-d3">{panel(summ_head + body_text("Optional: a short AI-written narrative of this period opens the report. You review and can edit it before it goes in. No photos are sent.", MUTED, 13) + btn("Write a summary with AI", "glass", "sparkle", full=True, h=48), gap=10)}</div>')
    pushed_fp('G4-DoctorReport.dc.html', 'Doctor report', 'Doctor report', 'Review', 'Back to Review', rep, 'Create doctor report', h=1180, icon='report', note=None)

    rng0 = chips([chip('Since last export'), chip('Last 30 days', 'on'), chip('Last 90 days'), chip('Choose dates'), chip('Everything')])
    pushed_head = pushed_header('Doctor report', 'Review', 'Back to Review')
    put('G4-DoctorReport-Empty.dc.html', 'Doctor report: nothing in the period',
        content(gap=18) + pushed_head + block('Period', rng0 + body_text('Nothing to export in this period.', SOFT, 14), cls='ax-r ax-d1')
        + f'<div class="ax-r ax-d2">{toggle_row("Include sensitive photos (0)", False, "Off by default. Sensitive photos leave the phone only when you turn this on.", "lock")}</div></div>'
        + save_bar('Create doctor report', 'Nothing to export in this period'))

    summ = (f'<div class="ax-r ax-d1" style="display: flex; align-items: center; gap: 8px">{SRC_PILL("AI-generated and tentative")}</div>'
            f'<div class="ax-r ax-d2" style="padding: 16px 18px; border-radius: 28px; {RAISED}; font-size: 15px; line-height: 23px; color: {TEXT}">In the period, Chin was at or above the flare threshold on 6 days and Daily health was recorded on 38 of 45 days. '
            f'Itch followed the same course as severity. Treatments changed once, on 3 Nov. These are patterns in the logged data, not a diagnosis, and the days without a Daily health record limit what can be said.</div>'
            f'{body_text("Review the summary. Edit it as you like; nothing is saved until you use it.", MUTED, 13.5)}'
            f'<div class="ax-r ax-d3">{btn("Dismiss", "glass", "trash", full=True, h=52)}</div>')
    put('G4-ReportSummary.dc.html', 'Doctor report: review the AI summary', modal_top('Summary') + summ + save_bar('Use in the report') + MODAL_END)

    # ---------------------------------------------------------------- AI summary: confirm and wait (LL-5, LL-12)
    from group3 import confirm_sheet
    put('G4-ReportSummary-Confirm.dc.html', 'Report summary: confirm what is sent',
        behind() + confirm_sheet('Send this to Anthropic?', 'The counts and entries of the report period are sent over the internet to Anthropic to write a short summary. No photos are sent. Nothing is saved until you review the text.',
                                 ['Days: 1 Oct to 14 Nov (45 days)', '131 meals and drinks, 42 skin and nail entries, 38 Daily health records', 'No photos', 'Model: Sonnet 5.5', 'About 30,000 characters of text'], 'Send and write summary'), h=1000)
    wsum = (f'<div class="ax-r ax-d1">{inline_wait("Writing the summary. You can wait here or go back.", "Running for 0:41", cancel=True)}</div>'
            + f'<div class="ax-r ax-d2">{panel(summ_head + body_text("The text appears here for review when it is ready.", MUTED, 13), gap=10)}</div>')
    pushed_fp('G4-ReportSummary-Waiting.dc.html', 'Report summary: waiting', 'Doctor report', 'Summary', 'Back to Review', wsum, 'Create doctor report', h=844, icon='report')

    # ---------------------------------------------------------------- AI analysis: idle
    photos = ('<div style="display: flex; gap: 10px; align-items: flex-start">' + pick('9 Nov', True) + pick('12 Nov', False, True) + pick('5 Nov', False) + '</div>')
    earlier = group('Earlier analyses', [R['nav_row']('sparkle', '2 Nov', 'Haiku 5.5', '14 Oct to 2 Nov'), R['nav_row']('sparkle', '9 Oct', 'Haiku 5.5', '1 Sep to 9 Oct', last=True)])
    ana = (f'<div class="ax-r ax-d1" style="display: flex; flex-direction: column; gap: 10px">{section_label("Period")}<div style="display: flex; gap: 8px">{date_pill("From", "1 Oct")}{date_pill("To", "14 Nov")}</div></div>'
           + block('Photos', photos + body_text('Photos are not sent unless you select them. Sensitive photos are blurred and left out until you tap them in.', MUTED, 13), cls='ax-r ax-d2')
           + f'<div class="ax-r ax-d3">{group("", [R["nav_row"]("copy", "Use my Claude plan", None, "Analyse with a chat on your own Claude plan, without the paid API", last=True)]).replace(section_label(""), "")}</div>'
           + f'<div class="ax-r ax-d4">{earlier}</div>')
    pushed_fp('G4-Analysis.dc.html', 'AI analysis', 'AI analysis', 'Review', 'Back to Review', ana, 'Review what will be sent', h=1320, icon='sparkle')

    # confirm (LL-5, LL-6)
    lines = ['Days: 1 Oct to 14 Nov (45 days, 38 with a Daily health record)', 'Also included for context: 21 earlier days of illness, stress, sleep, medication and changes.',
             '131 meals and drinks, 42 skin and nail entries, 38 Daily health records, 24 treatments, 2 medical events', 'Photo: 9 Nov, Chin (not sensitive)', 'Model: Haiku 5.5', 'About 48,000 characters of text']
    conf = (body_text('This data leaves your phone and is sent over the internet to Anthropic using your API key. Nothing is sent until you confirm.', SOFT, 14.5)
            + sent_list(lines) + billing_note())
    put('G4-Analysis-Confirm.dc.html', 'AI analysis: confirm what is sent', modal_top('Send this to Anthropic?') + conf + float_primary('Send and analyse', 'sparkle') + MODAL_END, h=1100)

    # progress (LL-12)
    prog = (f'<div class="ax-r ax-d1" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; text-align: center; padding: 20px 10px 40px 10px">'
            f'<div style="position: relative; width: 150px; height: 150px; border-radius: 999px; {GLASS_BLUR}; display: flex; align-items: center; justify-content: center"><div style="position: absolute; inset: 14px; border-radius: 999px; border: 2px dashed rgba(255,255,255,0.14)"></div>{wait_arc(76)}</div>'
            f'<h2 style="margin: 0; font-size: 22px; font-weight: 800">Analysing…</h2>{body_text("This can take a few minutes. Keep the app open.", SOFT, 15)}'
            f'<span style="font-size: 26px; font-weight: 800; font-variant-numeric: tabular-nums">Running for 2:10</span>'
            f'<span style="font-size: 13.5px; color: {MUTED}">Sent: 45 days, 131 meals and drinks, 1 photo (not sensitive) · Haiku 5.5</span>'
            f'{btn("Cancel analysis", "glass", "x", h=52)}{body_text("Cancel stops the request and stores nothing. Work already started may still be billed.", MUTED, 13)}</div>')
    put('G4-Analysis-Progress.dc.html', 'AI analysis: running', content(gap=18) + pushed_header('AI analysis', 'Review', 'Back to Review') + prog + '</div>')

    # result (LL-4, LL-7)
    h1 = hypothesis('Milk and flares on the chin', 'weak', 'Chin severity reached 8 within a day of a meal with milk on 3 of 4 occasions.', 'It also reached 8 on 2 days without milk.',
                    'Only 4 occasions, a treatment changed on 3 Nov, and 7 days have no Daily health record.', 24)
    h2 = hypothesis('Short sleep and more itch', 'moderate', 'Itch was 6 or higher on 7 of the 9 days with sleep quality of 4 or lower.', 'Itch was also high on 3 days with good sleep.',
                    'Stress was high on most of the same days, so the two cannot be separated.')
    res = (f'<div class="ax-r ax-d1">{banner("AI-generated and tentative", "These are possible patterns to discuss with a doctor, not a diagnosis and not medical advice.", "info")}</div>'
           f'<span style="font-size: 12.5px; color: {MUTED}; padding: 0 4px; font-variant-numeric: tabular-nums">14 Nov · 1 Oct to 14 Nov · Haiku 5.5 · prompt v3</span>'
           f'<div style="display: flex; flex-direction: column; gap: 8px">{section_label("Summary")}{panel(body_text("Chin was the most active area. Flares clustered around 3 to 14 Nov. Several patterns are possible, none is established.", SOFT, 14.5), gap=0)}</div>'
           f'<div style="display: flex; flex-direction: column; gap: 10px">{section_label("Possible patterns")}{h1}{h2}</div>'
           f'<div style="display: flex; flex-direction: column; gap: 8px">{section_label("What the data cannot show")}{panel(body_text("A food eaten on most days cannot be compared with days without it. Photo estimates are rough and name estimates rougher.", SOFT, 14), gap=0)}</div>'
           f'<div style="display: flex; flex-direction: column; gap: 8px">{section_label("Questions for your doctor")}{panel(body_text("Whether the pattern with milk is worth looking at together. Whether the treatment change on 3 Nov could explain the flares.", SOFT, 14), gap=0)}</div>'
           f'<span style="font-size: 12.5px; color: {MUTED}; text-align: center">Saved with the analysis. Your entries were not changed.</span>')
    pushed('G4-Analysis-Result.dc.html', 'AI analysis: result', 'AI analysis', 'Saved 14 Nov', 'Back to Review', res, h=1980)

    # interrupted and failed (LL-8, LL-12)
    intr = banner('Interrupted', 'The analysis was interrupted when the app was left. Nothing was saved.', 'info', kind='alert')
    pushed_fp('G4-Analysis-Interrupted.dc.html', 'AI analysis: interrupted', 'AI analysis', 'Review', 'Back to Review',
              f'<div class="ax-r ax-d1">{intr}</div>{body_text("The same request is ready: 45 days, 131 meals and drinks, 1 photo. Nothing is sent until you review it again; a new request is billed again.", SOFT, 14.5)}',
              'Review and try again', h=844, icon='sparkle', note='Opens the confirmation. Nothing is sent until you confirm.')
    fail = banner('Failed', 'The API key was not accepted. Check it or enter a new one. Nothing was saved.', 'info', kind='alert', actions=btn('Open AI settings', 'glass', 'key', h=44))
    pushed_fp('G4-Analysis-Failed.dc.html', 'AI analysis: failed', 'AI analysis', 'Review', 'Back to Review', f'<div class="ax-r ax-d1">{fail}</div>', 'Review and try again', h=844, icon='sparkle', note='Opens the confirmation. Nothing is sent until you confirm.')

    # review tab showing the run
    for nm, ttl, card in (('G4-Review-Running.dc.html', 'Review: analysis running', status_card('Analysis running · 2:10')),
                          ('G4-Review-Ready.dc.html', 'Review: analysis ready', status_card('Analysis ready'))):
        put(nm, ttl, content() + review_top(card) + f'<div class="ax-r ax-d3">{segmented_days()}</div>' + f'<div class="ax-r ax-d4" style="display: flex; flex-direction: column; gap: 8px">{section_label("Days")}{day_rows()}</div></div>' + tabbar('review', nm))

    # ---------------------------------------------------------------- Daily health trends, with the proposed range switch
    def trend_card(title, chips_html, vals, xl, aria, rng_sel, summary):
        return (f'<div class="ax-r ax-d2" style="display: flex; flex-direction: column; gap: 10px; padding: 14px 14px 12px 14px; border-radius: 30px; {GLASS_BLUR}">'
                f'<div style="display: flex; align-items: center; justify-content: space-between"><h2 style="margin: 0; font-size: 16px; font-weight: 700">{title}</h2></div>'
                f'<div style="display: flex; gap: 2px; overflow-x: auto; margin: 0 -4px">{chips_html}</div>{seg(["30 days", "90 days", "1 year", "All"], rng_sel, "Range")}'
                f'{line_chart(vals, xl, aria)}<p style="margin: 0; font-size: 12.5px; line-height: 18px; color: {MUTED}">{summary}</p></div>')
    items = ''.join((f'<button aria-pressed="true" style="height: 44px; padding: 0 12px; border-radius: 999px; background: rgba(255,255,255,0.16); font-size: 13.5px; font-weight: 700">{n}</button>' if i == 0
                     else f'<button aria-pressed="false" style="height: 44px; padding: 0 12px; border-radius: 999px; font-size: 13.5px; font-weight: 600; color: {SOFT}">{n}</button>')
                    for i, n in enumerate(['Wellbeing', 'Stress', 'Sleep quality', 'Abdominal pain']))
    well = [6, 7, 6, 5, 6, 7, 8, 7, 6, 5, 4, 5, 6, 6, 7, 7, 6, 5, 4, 3, 4, 5, 6, 6, 7, 7, 6, 6, 7, 7]
    tags = group('Days with a yes', [R['nav_row']('health', 'Bloating', '9 days'), R['nav_row']('health', 'Hot or long shower', '12 days'), R['nav_row']('health', 'Shaving', '6 days', last=True)])
    ht = (trend_card('Trend', items, well, ['16 Aug', '30 Sep', '14 Nov'], 'Wellbeing over the last 90 days, between 3 and 8', 1,
                     'Wellbeing, 16 Aug to 14 Nov: from 6 to 7, lowest 3, highest 8.') + f'<div class="ax-r ax-d3">{tags}</div>')
    pushed('G4-HealthTrends.dc.html', 'Daily health trends, with range switch', 'Daily health trends', 'Review', 'Back to Review', ht, h=1060)
    emp = (f'<div class="ax-r ax-d2" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; text-align: center; padding-bottom: 40px">'
           f'<div aria-hidden="true" style="position: relative; width: 170px; height: 170px; border-radius: 999px; {GLASS_BLUR}; display: flex; align-items: center; justify-content: center"><div style="position: absolute; inset: 14px; border-radius: 999px; border: 2px dashed rgba(255,255,255,0.18)"></div>{svg(IC["health"], 40, "@A@", 1.8)}</div>'
           f'<div style="display: flex; flex-direction: column; gap: 6px; max-width: 290px"><h2 style="margin: 0; font-size: 22px; font-weight: 800">Nothing to chart yet</h2>{body_text("Save Daily health records with a score first.", SOFT, 15)}</div>{btn("Open Daily health", "primary", "health", h=52)}</div>')
    put('G4-HealthTrends-Empty.dc.html', 'Daily health trends, empty', content() + pushed_header('Daily health trends', 'Review', 'Back to Review') + emp + '</div>')

    # ---------------------------------------------------------------- Area timeline with the range switch (copy of Ref-AreaTimeline)
    sev = [4, 4, 5, 3, 3, 2, 3, 4, 4, 5, 5, 4, 3, 3, 4, 5, 6, 5, 5, 6, 6, 7, 7, 6, 7, 7, 8, 8, 8]
    tl = (f'<div class="ax-r ax-d2" style="display: flex; flex-direction: column; gap: 10px; padding: 14px 14px 12px 14px; border-radius: 30px; {GLASS_BLUR}">'
          f'<div style="display: flex; align-items: center; justify-content: space-between"><h2 style="margin: 0; font-size: 16px; font-weight: 700">Trend</h2></div>'
          f'<div style="display: flex; gap: 2px; overflow-x: auto; margin: 0 -4px">{R["score_chips"].replace("height: 34px", "height: 44px")}</div>'
          f'{seg(["30 days", "90 days", "1 year", "All"], 1, "Range")}'
          f'{line_chart(sev, ["15 Aug", "30 Sep", "14 Nov"], "Severity for Chin over the last 90 days, from 4 to 8; at the flare threshold since 12 Nov", 10, 8, 26)}'
          f'<p style="margin: 0; font-size: 12.5px; line-height: 18px; color: {MUTED}">Severity, 16 Aug to 14 Nov: from 4 to 8, lowest 2, highest 8.</p></div>'
          f'<div class="ax-r ax-d3">{btn("Compare two photos", "glass", "camera", full=True, h=48)}</div>'
          f'<div class="ax-r ax-d4" style="display: flex; flex-direction: column; gap: 10px; -webkit-mask-image: linear-gradient(to bottom, #000 60%, transparent 100%); mask-image: linear-gradient(to bottom, #000 60%, transparent 100%)">{section_label("Entries")}'
          f'{R["entry_card"]("Saturday, 14 Nov", [("Sev", 8), ("Itch", 6), ("Pain", 3), ("Dry", 7), ("Scal", 6)], ["14:12"], "Emollient 5 h before this photo")}'
          f'{R["entry_card"]("Thursday, 12 Nov", [("Sev", 8), ("Itch", 7), ("Pain", 4), ("Dry", 7), ("Scal", 6)], ["20:40", "20:41"], "No treatment logged in the 7 days before")}</div>')
    put('G4-AreaTimeline-Range.dc.html', 'Area timeline with range switch',
        content() + pushed_header('Chin', 'Skin · flare since 12 Nov', 'Back to Review', btn('Go to date', 'glass', 'calendar', h=44)) + tl + '</div>', h=1180)

    # ---------------------------------------------------------------- Suggestions to review (IN-20)
    def sug_row(title, detail, last=False):
        return R['nav_row']('meal', title, None, detail, last=last)
    sg = (body_text('Ingredients that came back from a pack. Open one to look at it; nothing changes until you save.', SOFT, 14.5)
          + f'<div class="ax-r ax-d2">{group("", [sug_row("Chicken salad", "5 ingredients from Sonnet 5.5"), sug_row("Tomato soup", "4 ingredients from Sonnet 5.5"), sug_row("Pasta with tomato sauce", "6 ingredients from Sonnet 5.5", True)]).replace(section_label(""), "")}</div>')
    pushed('G4-Suggestions.dc.html', 'Suggestions to review', 'AI suggestions', '3 to review', 'Back to Today', sg, h=844)
    pushed('G4-Suggestions-Empty.dc.html', 'Suggestions to review, none', 'AI suggestions', 'Nothing waiting', 'Back to Today',
           f'<div style="flex: 1; display: flex; align-items: center; justify-content: center; padding-bottom: 80px">{body_text("No suggestions to review.", SOFT, 16, "; text-align: center")}</div>', h=844)
    pn = estimate_panel('Suggestion', 'A suggestion from Sonnet 5.5, made in a chat on your own Claude plan. Add what applies, then edit and save.', [],
                        ['chicken', 'lettuce', 'tomato', 'cucumber', 'olive oil'], 'manual').replace('Dismiss</button>', 'Dismiss the suggestion</button>')
    from group3 import review
    review('G4-Suggestion-Edit.dc.html', 'A suggestion on its entry', top=pn, desc='Chicken salad', ing=['chicken'], source='waiting for AI', fav=False,
           allergen_html=__import__('group2').allergens([], [], 14), h=1240)

    # ---------------------------------------------------------------- Claude plan pack (LL-15)
    pl = (body_text('Prepare a pack, give it to a chat on your own Claude plan, and import the result.json that comes back. The app sends nothing itself and bills nothing.', SOFT, 14.5)
          + f'<div class="ax-r ax-d2" style="display: flex; flex-direction: column; gap: 10px">{section_label("Prepare a pack")}<div style="display: flex; gap: 8px">{date_pill("From", "1 Oct")}{date_pill("To", "14 Nov")}</div>'
          f'{toggle_row("Include sensitive photos (3)", False, "Off by default. Meal photos do not exist, so none are in a pack.", "lock")}'
          f'{body_text("3 meals and drinks still without ingredients go in whatever their date.", MUTED, 13)}</div>'
          + f'<div class="ax-r ax-d3" style="display: flex; flex-direction: column; gap: 10px">{section_label("Import a result")}{panel(body_text("Pick the result.json from the chat. It must answer a pack made on this phone.", SOFT, 14) + btn("Import a result", "glass", "box", full=True, h=48), gap=12)}</div>')
    pushed_fp('G4-Plan.dc.html', 'Claude plan: prepare and import', 'My Claude plan', 'AI analysis', 'Back to AI analysis', pl, 'Prepare the pack', h=1000, icon='box', note='Opens the share sheet. The ZIP goes nowhere unless you send it.')

    pc_lines = ['pack.json: 45 days, 131 meals and drinks, 42 skin and nail entries', '2 photos you chose, none sensitive', 'INSTRUCTIONS.md: the analysis prompt, the result schema and a pack id', 'To fill: 3 meals and drinks']
    pc = (body_text('The pack is one ZIP file with these contents:', SOFT, 14) + sent_list(pc_lines, 'In the pack')
          + panel(tick_row('The file leaves this phone only if you send it.') + tick_row('A chat on a Claude plan falls under the consumer terms: whether it is used for training and how long it is kept depend on your account’s privacy setting, not on the API terms.') + tick_row('The app bills nothing. Your plan’s own limits apply.'), gap=8)
          + f'<div style="display: flex; flex-direction: column; gap: 8px">{btn("Prepare the pack", "primary", "box", full=True, h=56)}{btn("Cancel", "glass", full=True, h=52)}</div>')
    put('G4-Plan-Confirm.dc.html', 'Claude plan: confirm the pack', behind() + sheet('Prepare this pack?', None, pc, close=False), h=1080)

    imp = (sent_list(['Model: Sonnet 5.5', 'For the pack of 1 Oct to 14 Nov', 'An analysis, stored as AI-generated and tentative', 'A report summary', '7 suggestions to review (1 skipped)'], 'In this result')
           + body_text('No entry is changed.', SOFT, 14.5)
           + f'<div style="display: flex; flex-direction: column; gap: 8px">{btn("Import", "primary", "check", full=True, h=56)}{btn("Cancel", "glass", full=True, h=52)}</div>')
    put('G4-Plan-ImportPreview.dc.html', 'Claude plan: import preview', behind() + sheet('Import this result?', None, imp, close=False), h=900)
    al = (body_text('The result for pack 7F3A was imported before. Nothing was changed.', SOFT, 14.5) + btn('OK', 'primary', full=True, h=56))
    put('G4-Plan-AlreadyImported.dc.html', 'Claude plan: already imported', behind() + sheet('Already imported', None, al, close=False))

def segmented_days():
    return seg(['Days', 'Areas'], 0, 'Review view')

TITLE = 'Group 4: Review'
NEEDS = '''Group 4: Needs approval

1. RANGE SWITCH on the Area timeline trend and on Daily health trends: 30 days | 90 days | 1 year | All, default 90 days, a segmented control above the chart. Today both chart the whole history. Affects SK-8, SK-7.
2. Review output cards show a status line while a run exists: Analysis running with elapsed time, Analysis ready (accent dot and line). Affects LL-12.
3. Analysis result shows Evidence, Against and Uncertainty for each possible pattern, a "What the data cannot show" part and "Questions for your doctor"; no advice. Affects LL-4.
4. A pushed screen's single primary floats at the bottom like the form Save (Prepare the pack, Send and analyse, Create doctor report, Try again). Affects UX-3, UX-12.
5. Doctor report: period chips, a sensitive photos switch off by default, a one-by-one photo picker, language, optional AI summary. Affects EX-3, EX-7, EX-14, LL-14.
6. The wait arc is drawn static here; proposed motion: it turns only while a call runs. Affects UX-12.
7. Claude plan: the confirmation repeats the three notes (file leaves only if you send it, consumer terms, nothing billed). Affects LL-15.
8. Photo picker: a 3-column grid with a check badge, sensitive photos blurred and unselected, Select all and None. Affects EX-4, EX-7, SK-5.
'''
