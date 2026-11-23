# Phone test plan (Expo Go, Aurora ring build)

Updated 2026-11-21 (language setting, nettle icon) for the Aurora ring design (floating tab bar, day ring, quick sheets, glass forms with a floating Save, the Group 1–6 screens). The design spike (blur, aurora, fonts, ring swipe) has run on the phone and passed; the rest of the app has had only a first look at Today and the meal form. This plan orders the checks so that a failure early on does not hide later ones. Use only synthetic data in the diary while testing (no real symptoms, names or photos you would not want in an export).

How to read it: each check has an ID, what to do, and what you should see. Mark **Pass** as `✓`, or **Fail** or **Skip** as `✗` or `–`. A Fail needs one line in **Notes**: what happened, and the screen. Requirement IDs link to `docs/requirements.md`.

## 0. Setup

- Start the server with `./run.sh`. Phone on the same Wi-Fi as the computer, or use `./run.sh npx expo start --tunnel --port 8081` (see README.md). Open in Expo Go.
- Start from a clean state: Settings, Data and backup, Delete data (everything), or reinstall Expo Go. This also tests the first run.
- Notifications: allow when asked. Camera and photos: allow when asked.
- Keep a second device or the computer ready to open an exported file.
- Set the phone clock aside for later: you will change the day or time in section 9.

## 1. Start-up and first run (P0)

| ID | Do | Expect | Pass | Notes |
| --- | --- | --- | --- | --- |
| S1 | Launch the app after a fresh install. | It starts without a red screen. A floating tab bar with Today (active, an accent pill with icon and label) and Review; a glass gear circle at the top right of both. | y |  |
| S2 | Look at Today with no data. | The day ring, quick actions and a first-run card with "Log a meal" and "Where to log" (UX-1). Scroll to the bottom of Today. The last item (the first-run card’s buttons, or the last log row) can be scrolled fully clear of the floating tab bar. | y | todo check: Scroll to the bottom of Today. The last item (the first-run card’s buttons, or the last log row) can be scrolled fully clear of the floating tab bar |
| S3 | Open Review. | An empty state (dashed ring, title, one sentence, one button) with a button back to Today; the two output cards (Doctor report, AI analysis) above it. | y |  |
| S4 | Kill the app and reopen it. | No crash; database migrates (the schema changed several times). | y | checked only in expo |
| S5 | Settings, About, Language: choose Polski, then English, then Device language, with the phone language set to the other one. | Each choice changes the text of the visible screens and the tab labels at once, without a restart; Polish strings are drafts (the Polish review is out of scope for now). The Language row shows "Polski", "English" or "Device (…)" with the phone's language (UX-7). Entries you logged stay as written. |  | want to switch it in the app |
| S6 | Look at the app icon on the home screen, then open the app. Expo Go always shows its own icon: check this in a standalone build, or open `app/assets/images/icon.png` and `splash-icon.png` on the computer. | The icon is one serrated nettle leaf inside an accent ring on a dark ground (UX-12), readable at the smallest size; a dark splash with the same mark and the word Nettle, then Today with no white flash. | y | checked only in expo |
| S7 | With Polski chosen, kill the app and reopen it. Then choose Device language. | Still Polish after the restart; Device language follows the phone again (UX-7). | y | checked only in expo |
| S8 | With Polski chosen, open Review, Doctor report. Then choose English and open it again. | The report language starts as Polish, then English; you can still change it for each report (EX-3). |  | later |

## 2. Navigation shell (P0)

| ID | Do | Expect | Pass | Notes |
| --- | --- | --- | --- | --- |
| N1 | Tap the gear on Today. | Settings opens above the tabs: tab bar hidden, a glass back circle, a large title, no Done (UX-1). | y |  |
| N2 | Back. Repeat from the Review tab. | Back returns to the tab you came from each time. | y |  |
| N3 | Settings list. | Grouped glass rows with icons: Logging; Reminders and privacy; AI analysis; Data and backup; About (Language, Where do I log…?, About Nettle). | y |  |
| N4 | Open each group and each sub-row (Suggestions, Skin and nail areas, Regular items, Favorites, Privacy). | Every screen opens and goes back; titles fit. | y | 1. In polish version Wpisy.zaostrzenia.jednakowy dla wszystkich doesn't fit in one line and is aligned to the left - should fit in one line or be centered; 2. Prywatność - Blokada face id albo kodem - also aligned to the left which doesn't look good (the same with meal:Uzupełnij później z ai - not aligned well - text is aligned to the left and sits to close to the rounded corner, toggle is aligned to the top instead of the center); 3. I'm not sure if Privacy should be in "Przypomnienia i prywatność" - it fits well also in "Data & backup" and "About" |
| N5 | Open any entry form, make a change, swipe down to dismiss. | Discard Changes sheet appears (UX-3). Cancel keeps the form. The form has a glass Cancel in the header and no Save there; Save floats at the bottom. | y |  |
| N6 | Large titles, form grabber, floating tab bar. | Nothing overlaps the notch, the home bar or the tab bar. Note anything ugly. | y |  |

## 3. Daily logging (P0)

| ID | Do | Expect | Pass | Notes |
| --- | --- | --- | --- | --- |
| L1 | Meal: New meal, type a description, Continue (the choose phase has no Save), add ingredients with Add ingredient, tap the floating Save. | Appears at the top of Today's log with an accent line for about 3 seconds. Add ingredient puts the cursor in the new field, and the form scrolls so the field and the button stay above the keyboard in one smooth move, with the keyboard hidden or open. | y | I'm just not sure if Favorite button should be just under the name with ai suggestions button - record this as an open question |
| L2 | Repeat the same meal. | It is offered as a suggestion; 3 taps to log (NF-2). | y | |
| L3 | Drink with the alcohol switch on. | Saved; row says alcohol. | y | i'm not sure about pills and suggestions placement and order - record as open question |
| L4 | Skin: pick an area, move the slider by drag, by − and +. | Whole steps only; value readable and not hidden by the thumb. Optional scores show "–" with Clear. | y | |
| L5 | Skin: save, then open Skin again for the same area. | Starts from the last scores. "No change" saves in one tap. |  |  |
| L6 | Daily health: set two scores, toggle two yes/no chips, Save with no meals logged. | Asks to confirm the empty day; after confirming, saved and the day is logged. |  |  |
| L7 | Daily health tomorrow-style: use "Same as yesterday" (create a record for yesterday first via the day switcher). | Copies all items; nothing filled silently. |  |  |
| L8 | Stool quick action: tap a type in the sheet. | A grid of the seven Bristol types with their names; the tapped tile becomes "Saved HH:MM", the entry shows in the log. "Earlier…" opens the full form. |  |  |
| L9 | More, Edit Today: move an action up, move Stool to More, pin Drink; try pinning a sixth. | Today's quick actions follow; More lists Stool; Pin is disabled at five with the limit message; More is always last on Today. |  |  |
| L10 | From More, open Stool. Long-press a quick action on Today. | The full form, not the quick sheet, both times. |  |  |
| L11 | Tap a log row; then swipe another row left; then tap a dot on the ring. | Tap: action sheet with Edit and Delete, Cancel last (native iOS sheet). Swipe: Delete, which asks first. Dot: the same sheet for that entry. Edit saves under the same entry; Delete names what goes with it. |  |  |
| L12 | Jump to a past day with the date (the picker opens in a glass panel), log something. | Entry takes that day; "Back to Today" appears. Future days cannot be picked. |  |  |
| L13 | Swipe the ring left and right, and use the faint arrows. | One day per swipe, with the screen staying on Today (no swipe-back); the next-day arrow is disabled on today. |  |  |
| L14 | Log two entries within a few minutes, look at the ring; tap the merged dot. | Intake dots on the outer track, body and care on the inner; close dots merge with a count; the merged dot opens a sheet listing its entries, each opening its Edit and Delete sheet. The arc runs up to now; hour labels 00, 06, 12, 18 from the day start. |  |  |
| L15 | Today with a flare, a missing Daily health, an old backup and AI suggestions at once. | At most two context pills, in the order flare, Daily health, backup, AI suggestions; each opens its target (UX-2). |  |  |

## 4. Flares (P0)

| ID | Do | Expect | Pass | Notes |
| --- | --- | --- | --- | --- |
| F1 | Log a skin entry with severity 9 for one area. | A coral flare pill on Today: area, severity in a coral circle, since date. |  |  |
| F2 | Tap the pill. | Review opens on Areas, flaring area first. |  |  |
| F3 | Log a second area at 9. | The pill says "Flare in 2 areas, worst: …". |  |  |
| F4 | Log severity 2 for both areas. | The pill disappears. |  |  |
| F5 | Settings, Logging, Flares: change the common threshold, then switch to Per area and set a value for one area. | Flares recompute at once (pill appears or goes away). Per area shows a stepper per skin area; an area without its own value follows the common one; the report names the own thresholds. |  |  |
| F6 | Area timeline: switch the range 30 days, 90 days, 1 year, All. | A glass chart card with a line, the threshold as a dashed coral line and flare days as a coral band; the line changes with the range (default 90 days); a text summary under it. |  |  |
| F10 | Photos on an area timeline after logging a treatment on that area the same day or the day before. | Each photo says how long after the treatment it was taken ("14 h after <name>"), or "no treatment logged" when none in the 7 days before; the same lines appear under the photos in the PDF. |  |  |
| F11 | PDF after a treatment course and a later flare (needs about two weeks of entries). | A "Time to relapse" table: course dates, applications, days to the next flare or "no flare yet", other treatments in between. |  |  |
| F12 | More, Medical event: log a visit, then an illness with an end date; open the illness from the log, clear the end date. | Only Illness shows an end date; the log row says "until"; the area timelines show the start and the end as lines; the PDF has a Medical events table. "Where to log" has the visit row and the two illness rows. |  |  |
| F8 | Treatments: apply a treatment in one tap, then open its row in the log, Edit. Pick Strong; reopen; tap Strong again. | Reaction is empty by default and never asked at logging time; Strong shows in the row and the PDF; a second tap clears it (not recorded). |  |  |
| F9 | Daily health: look for "Hot or long shower" and "Friction in the intimate area". | Both are there as yes/no items without a reinstall; the Polish names are drafts. |  |  |
| F7 | Skin form: switch "Cracks or open wounds"; open Details and enter a size in mm; save. Open the form again for the same area; try 12.5 and 600. | Switch and size are prefilled and Details opens by itself; "No change" keeps both. An invalid size shows a hint and Save stays off. The area timeline line says cracks and size, the chart offers Size, and the PDF has the columns. |  |  |

## 5. Photos (P1)

| ID | Do | Expect | Pass | Notes |
| --- | --- | --- | --- | --- |
| P1 | Skin form: Take photo, then Save. | Camera permission prompt, photo attached to the entry, thumbnail in the entry's edit screen. |  |  |
| P2 | Skin form: pick two from the library, tap one thumbnail to drop it, Save. | Only one photo saved. |  |  |
| P3 | Skin form: add a photo, tap Cancel. | No photo and no entry remain. |  |  |
| P4 | "No change" with a photo. | One new entry with the same scores plus the photo, and the form closes. |  |  |
| P5 | Nails form: stage, extent, photo. | Saved with the photo. |  |  |
| P6 | Sensitive area (intimate): photo is blurred until tapped. | Blur works; the flag can be changed per photo. |  |  |
| P7 | Photo taken with Location on: export it (section 8) and inspect. | No EXIF or location in the exported file. |  |  |
| P8 | Compare two photos in an area timeline. | Earlier on the left; sensitive ones blurred until tapped. |  |  |

## 6. Review (P1)

| ID | Do | Expect | Pass | Notes |
| --- | --- | --- | --- | --- |
| R1 | Review, Days: the calendar for this month. | A glass calendar; marks: • entries, ✓ Daily health, ▲ flare days with a coral wash. Month list below. |  |  |
| R2 | Arrows and the month picker. | Previous and next month work; next stops at the current month. |  |  |
| R3 | Tap a calendar day and a list row. | Opens that day's full log. |  |  |
| R4 | "Incomplete days" switch. | Lists only days with entries and no Daily health record. |  |  |
| R5 | Segmented control to Areas. | Skin and Nails groups with last severity or stage and date; archived areas hidden. |  |  |
| R6 | Daily health trends (Review, Health trends), switch the range. | One chart per score item with the range switch; archived items keep history. |  |  |
| R7 | Day view: "Show all" and open on Today. | Works from Today's "Show all (n)". |  |  |
| R8 | Area timeline, "Go to date": pick a day with an entry, a day without one, and a date before the first entry. | The list scrolls so the day sits just under the header (not hidden by it); the day is tinted; a line says which day is shown when the picked day has no entry. Chart and list stay complete. |  |  |
| R9 | Area timeline: tap an entry line, then Edit, then Save; then Delete on another entry. While "Compare two photos" is on, tap an entry line. | Sheet names the photos that go with the entry. After Save or Delete the timeline reloads at the same place. While comparing, entry lines do nothing and taps pick photos. |  |  |

| R10 | Run an analysis from Review and go back to Review while it runs. | The AI analysis card shows "Analysis running" with an elapsed time that ticks every second; later "Analysis ready". |  |  |

## 7. Regular items and reminders (P0 for notifications)

Notifications from Expo Go can behave differently from a standalone build; record exactly what you saw.

| ID | Do | Expect | Pass | Notes |
| --- | --- | --- | --- | --- |
| G0 | Settings, Reminders: read the status line, then tap "Send a test reminder" and lock the phone (or leave the app). | The status says notifications are allowed and how many reminders are scheduled. A "Test reminder" banner arrives after about 5 seconds, listed as Expo Go. If it does not: iOS Settings, Notifications, Expo Go (allowed, not in a Focus that hides it), and note what the status line said. Then switch on a daily reminder a minute ahead and compare. |  |  |
| G1 | Medication form: name, dose, Regular on, Save. | Entry logged; Settings, Logging, Regular items lists it. |  |  |
| G2 | Treatment form with areas, Regular on, Save. | Same. |  |  |
| G3 | Pin Medication and Treatment. Tap the Medication quick action. | A floating sheet with the regular items, with dose and reminder times. One tap logs one at the current time; the row becomes "Taken HH:MM" ("Applied HH:MM" for treatments). The Treatment sheet also has "Often used". |  |  |
| G4 | Tap the same row twice quickly. | Second tap does nothing (3 second lock). |  |  |
| G5 | "Other or earlier…". | Opens the full form. With no regular items the quick action opens the form directly. |  |  |
| G6 | Regular item screen: add a time two minutes ahead. | Permission asked the first time; item shows the time. |  |  |
| G7 | Wait for it, with the app open. | A banner appears. |  |  |
| G8 | Repeat with the app in the background, then locked. | Notification arrives with the item's name, never the dose. |  |  |
| G9 | Press the **Taken** (or **Applied**) button on the notification. | The app opens and one entry is logged at that time. If the button is missing or does nothing, record the app state and iOS version: this is the known unreliable part. |  |  |
| G10 | Tap the notification body itself. | Today opens with the quick sheet of that kind. |  |  |
| G11 | Turn "Hide the name" on, wait for the next reminder. | Generic text ("Time for your medication"). |  |  |
| G12 | Stop the item. | Its reminders stop; earlier entries stay. |  |  |
| G13 | Deny notifications in iOS settings, then add a time; then open Settings, Reminders. | Error and an "Open iPhone settings" button that works. Reminders show a coral banner and the switches are disabled. |  |  |
| G14 | Daily Health reminder: enable it for a time two minutes ahead, save a Daily health record for today first. | No reminder fires today. Tomorrow's is still scheduled. |  |  |
| G15 | Same, with no record today. | The reminder fires; tapping it opens Daily health for that day. |  |  |
| G16 | Tap a reminder while a form with unsaved changes is open. | Nothing happens (the form is not lost). |  |  |
| G17 | Nail reminder (needs a nail area) and monthly backup reminder: set one a minute ahead if possible (change the day for weekly and monthly ones). | Fires; the backup one opens Data and backup. |  |  |

## 8. Export, import, privacy (P0)

| ID | Do | Expect | Pass | Notes |
| --- | --- | --- | --- | --- |
| E1 | Data and backup: Full backup. | Share sheet; the file saves to Files or AirDrop. |  |  |
| E2 | Open the ZIP on the computer. | `data.json`, photos, `report.pdf`, optional CSV. No API key anywhere. |  |  |
| E3 | Doctor report: also try "Pick photos one by one". | The photo grid has three columns with check badges; sensitive photos are blurred and left out of Select all; only the picked photos are in the PDF. PDF paginates, charts render, A4, flares table states the threshold, Daily health table, text readable. |  |  |
| E4 | Export with a password. | Opens in 7-Zip with the password; not without. |  |  |
| E5 | AES export speed with 30 or more photos (open question). | Note the time. |  |  |
| E6 | Delete data: first with no group chosen, then choose a group. | The button is disabled until a group is chosen. Then an action sheet with Export first and a second confirmation. |  |  |
| E7 | Import into a clean app (Merge, then Replace). | Preview counts; entries come back; regular items return and reminders are re-asked and re-scheduled (EX-10). |  |  |
| E8 | Delete one entry, re-import an older backup, merge. | The tombstone blocks it; the switch restores it. |  |  |
| E9 | App lock (Privacy): enable, background the app for a minute; cancel the prompt once. | Locked on return: a glass ring with the lock, "Nettle is locked" and Unlock; no entry is shown. Expo Go uses the passcode. After a cancelled prompt: "Face ID did not work" with Try again and Use passcode. In the app switcher only a lock mark shows. |  |  |
| E10 | Photos in iOS backup. | Known limit in Expo Go (SE-7); just note. |  |  |

## 9. Time-dependent checks (P1)

| ID | Do | Expect | Pass | Notes |
| --- | --- | --- | --- | --- |
| T1 | Leave Today open past midnight (or change the phone date). | The day moves on when you return to the app; "today" is correct. |  |  |
| T2 | Settings, Logging, Day starts at 03:00; log something at 01:00. | It belongs to the evening before. |  |  |
| T3 | Change the phone time zone, log an entry. | Timestamps keep their own zone; days do not shift. |  |  |

## 10. AI (P2, costs a little money)

| ID | Do | Expect | Pass | Notes |
| --- | --- | --- | --- | --- |
| A1 | Settings, AI analysis: Save is disabled with a line saying the key is missing; enter your API key, Save, then Test the key. | Stored; afterwards only "ending in" the last four characters show. The test sends one tiny request, says it may cost a tiny amount, and reports whether the key works. Two model choices (photo and name estimates; analysis and report summary). |  |  |
| A2 | Meal photo estimate, label scan, barcode scan of a real product (Open Food Facts). | Confirmation names what is sent, the model, and notes separate billing; Cancel works; results are editable and marked as AI. |  |  |
| A3 | Run one analysis over a short range, picking photos in the photo grid. | Hypotheses with uncertainty, flare periods and Daily health used; "Questions for your doctor" (questions only, no advice); the wait card shows an arc, elapsed time and a Cancel from the start; the running card shows on Review. |  |  |
| A4 | Leave the app during a run. | Shows interrupted; "Review and try again" opens the confirmation again (it does not re-send at once). A failed run shows a coral banner, nothing saved. |  |  |
| A5 | Report summary in the Doctor report. | Editable; goes under the AI label in the PDF. |  |  |
| A7 | Meal review phase: type "pancakes with jam", tap "Suggest ingredients from the name". Repeat on the Drink form with a name. Then try "lunch". | Button only with a description. The confirmation shows the exact text and the billing notice; no photo. The answer is an editable list (add all or pick) that never overwrites typed ingredients; tags stay unselected. "Lunch" gives "too vague" and no names. The saved entry shows "AI name estimate" and the PDF marks it AI. |  |  |
| A6 | Polish products: scan three you actually buy. | Note how many Open Food Facts knows. |  |  |
| A8 | Meal form: switch "Fill later with AI" on, save with only a description. Open it from the log. | The log row says it is waiting for AI. The edit screen has the switch and can clear it. |  |  |
| A9 | Review, AI analysis, Use my Claude plan: pick a range, include photos, create the pack, share it to Files. Open the ZIP in Files. | A confirmation lists what is in the pack and the three privacy points. The ZIP has `pack.json`, `INSTRUCTIONS.md` and the photos; sensitive photos are left out by default. |  |  |
| A10 | Give the ZIP to a chat on your Claude plan, save its `result.json`, then Import a result. Try the wrong pack's result and a cancelled picker. | Counts shown before applying; a wrong pack is refused. A fill shows as the Today card and under Suggestions to review; adding it and saving clears the mark and the row reads name estimate (manual). An imported analysis is labelled manual; an imported summary is offered in the Doctor report. Note what the chat accepted (ZIP, photo count, size). |  |  |
| A11 | With Polski chosen, run one short analysis. Then choose English and run it again. | The answer, its headings and the estimates are in Polish, then in English (LL-11). The prompts do not change. |  |  |

## 11. Guide and routine changes (P2)

| ID | Do | Expect | Pass | Notes |
| --- | --- | --- | --- | --- |
| U1 | More, then "Where do I log…?" (and from Settings, About). | 16 situations; each opens the right form. |  |  |
| U2 | Routine change: Started, "already using, date unknown". | No date; shown with "date unknown". |  |  |
| U3 | Routine change: Stopped. | "In use now" lists it; tapping fills the name. |  |  |
| U4 | Add your own category in Settings, Logging. | Appears in the form with its description. |  |  |

## 12. Design and system states (P1, UX-12, UX-3, NF-3)

| ID | Do | Expect | Pass | Notes |
| --- | --- | --- | --- | --- |
| D1 | Use the app for a few minutes, scrolling Today and Review. | The aurora behind the glass drifts slowly with no stutter, flicker or heat. If it stutters: set `USE_BLUR` to false in `GlassSurface.tsx` and record it. |  |  |
| D2 | Read text on glass cards over bright aurora spots. | Everything is readable; note the screen and where it is not. |  |  |
| D3 | Tap small targets: calendar days, the pills, "−" on an ingredient, close circles. | All hit at the first try (44 pt minimum). |  |  |
| D4 | In several forms (Meal note, Skin note, Daily health, Drink), tap the lowest field. | The form scrolls so the field is above the keyboard; the floating Save rides above the keyboard and does not cover the field. |  |  |
| D5 | Meal: choose phase, scan a barcode. | The scanner shows; with the camera denied a card says so and offers Allow or Open settings, and the typed code still works. |  |  |
| D6 | Scan a code the database does not know. | A card: "Read the ingredient label" or "Enter by hand". An in-store code asks in a sheet ("Use it"). Offline lookup is still an alert (known, not redesigned). |  |  |
| D7 | Force a save failure if you can (storage full is hard; skip if not possible). | A coral banner, the form stays open with the input (NF-3). |  |  |
| D8 | Deny camera, photos and notifications in iOS settings, then use each. | An explanation with "Open iPhone settings" and "Not now". |  |  |
| D9 | Reaction form with no meal logged. | "Log a meal first" with a button to the meal form; Save disabled; the urgent-care note stays pinned under the header while scrolling. |  |  |
| D10 | Treatment application edit: Reaction None, Mild, Strong. | Nothing selected by default; a second tap on the selected one clears it. |  |  |

Known not built (do not report as bugs): floating versions of the confirmation and action sheets (the native iOS sheets stay), the Today card for a regular item's next time, the offline barcode banner, the accessibility pass (UX-8), the press-and-drag around the ring (UX-13).

## Exit criteria

- Every P0 check passes, or each failure has a written note.
- No crash during sections 1 to 4 and 12.
- Notifications (section 7) behave on at least one real reminder in each app state, or the failure is documented so the button-based logging can be redesigned.

## After the run

Record results in `docs/work-log.md` (a dated entry, no personal data). Fix failures on feature branches from `develop`. Move confirmed items out of the phone checklist in `docs/open-questions.md`.
