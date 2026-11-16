# Phone test plan (Expo Go, v0.6 build)

Nothing in the app has run on a device yet. This plan orders the checks so that a failure early on does not hide later ones. Use only synthetic data in the diary while testing (no real symptoms, names or photos you would not want in an export).

How to read it: each check has an ID, what to do, and what you should see. Mark **Pass** as `✓`, or **Fail** or **Skip** as `✗` or `–`. A Fail needs one line in **Notes**: what happened, and the screen. Requirement IDs link to `docs/requirements.md`.

## 0. Setup

- Phone on the same Wi-Fi as the computer, or `npx expo start --tunnel`. Open in Expo Go.
- Start from a clean state: Settings, Data and backup, Delete data (everything), or reinstall Expo Go. This also tests the first run.
- Notifications: allow when asked. Camera and photos: allow when asked.
- Keep a second device or the computer ready to open an exported file.
- Set the phone clock aside for later: you will change the day or time in section 9.

## 1. Start-up and first run (P0)

| ID | Do | Expect | Pass | Notes |
| --- | --- | --- | --- | --- |
| S1 | Launch the app after a fresh install. | It starts without a red screen. Today and Review tabs, gear icon at the top right of both. |  |  |
| S2 | Look at Today with no data. | A first-run card with "Log a meal" and "Where do I log…?" (UX-1). Tab bar visible. |  |  |
| S3 | Open Review. | An empty state with a button back to Today. |  |  |
| S4 | Kill the app and reopen it. | No crash; database migrates (the schema changed several times). |  |  |
| S5 | Switch the phone language to Polish, reopen. | Polish strings appear (drafts). Switch back to English. |  |  |

## 2. Navigation shell (P0)

| ID | Do | Expect | Pass | Notes |
| --- | --- | --- | --- | --- |
| N1 | Tap the gear on Today. | Settings opens above the tabs: tab bar hidden, a Back button, no Done (UX-1). |  |  |
| N2 | Back. Repeat from the Review tab. | Back returns to the tab you came from each time. |  |  |
| N3 | Settings list. | Five groups: Logging; Reminders and privacy; AI analysis; Data and backup; About. |  |  |
| N4 | Open each group and each sub-row (Suggestions, Skin and nail areas, Regular items, Favorites, Privacy). | Every screen opens and goes back; titles fit. |  |  |
| N5 | Open any entry form, make a change, swipe down to dismiss. | Discard Changes sheet appears (UX-3). Cancel keeps the form. |  |  |
| N6 | Large titles, sheet grabber, tab bar look. | Nothing overlaps the notch or home bar. Note anything ugly. |  |  |

## 3. Daily logging (P0)

| ID | Do | Expect | Pass | Notes |
| --- | --- | --- | --- | --- |
| L1 | Meal: New meal, type a description, Continue, add ingredients, Save. | Appears at the top of Today's log, tinted for about 3 seconds. |  |  |
| L2 | Repeat the same meal. | It is offered as a suggestion; 3 taps to log (NF-2). |  |  |
| L3 | Drink with the alcohol switch on. | Saved; row says alcohol. |  |  |
| L4 | Skin: pick an area, move the slider by drag, by − and +. | Whole steps only; value readable and not hidden by the thumb. Optional scores show "–" with Clear. |  |  |
| L5 | Skin: save, then open Skin again for the same area. | Starts from the last scores. "No change" saves in one tap. |  |  |
| L6 | Daily health: set two scores, toggle two yes/no chips, Save with no meals logged. | Asks to confirm the empty day; after confirming, saved and the day is logged. |  |  |
| L7 | Daily health tomorrow-style: use "Same as yesterday" (create a record for yesterday first via the day switcher). | Copies all items; nothing filled silently. |  |  |
| L8 | Stool tile quick sheet: tap a type. | Saved at once and shown in the log. "Earlier…" opens the full form. |  |  |
| L9 | Edit mode on Today: move up, move Stool to More, pin Drink. | Grid follows; More lists Stool with a subtitle; nothing is hidden. |  |  |
| L10 | From More, open Stool. | The full form, not the quick sheet. |  |  |
| L11 | Tap a log row. | Action sheet with Edit and Delete, Cancel last. Edit saves under the same entry; Delete names what goes with it. |  |  |
| L12 | Jump to a past day with the day heading, log something. | Entry takes that day. Future days cannot be picked. |  |  |
| L13 | Day switcher arrows. | Moves one day; the right arrow is disabled on today. |  |  |

## 4. Flares (P0)

| ID | Do | Expect | Pass | Notes |
| --- | --- | --- | --- | --- |
| F1 | Log a skin entry with severity 9 for one area. | A flare card on Today: area, severity, since date. |  |  |
| F2 | Tap the card. | Review opens on Areas, flaring area first. |  |  |
| F3 | Log a second area at 9. | Card says "Flare in 2 areas, worst: …". |  |  |
| F4 | Log severity 2 for both areas. | Card disappears. |  |  |
| F5 | Settings, Logging, Flares: change the threshold. | Flares recompute at once (card appears or goes away). |  |  |
| F6 | Area timeline. | Trend chart with flare marks; text summary under it. |  |  |

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
| R1 | Review, Days: the calendar for this month. | Marks: • entries, ✓ Daily health, ▲ flare days. Month list below. |  |  |
| R2 | Arrows and the month picker. | Previous and next month work; next stops at the current month. |  |  |
| R3 | Tap a calendar day and a list row. | Opens that day's full log. |  |  |
| R4 | "Incomplete days" switch. | Lists only days with entries and no Daily health record. |  |  |
| R5 | Segmented control to Areas. | Skin and Nails groups with last severity or stage and date; archived areas hidden. |  |  |
| R6 | Daily health trends. | One chart per score item; archived items keep history. |  |  |
| R7 | Day view: "Show all" and open on Today. | Works from Today's "Show all (n)". |  |  |

## 7. Regular items and reminders (P0 for notifications)

Notifications from Expo Go can behave differently from a standalone build; record exactly what you saw.

| ID | Do | Expect | Pass | Notes |
| --- | --- | --- | --- | --- |
| G1 | Medication form: name, dose, Regular on, Save. | Entry logged; Settings, Logging, Regular items lists it. |  |  |
| G2 | Treatment form with areas, Regular on, Save. | Same. |  |  |
| G3 | Pin Medication and Treatment. Tap the Medication tile. | A quick sheet with the regular items. One tap logs one at the current time. |  |  |
| G4 | Tap the same row twice quickly. | Second tap does nothing (3 second lock). |  |  |
| G5 | "Other or earlier…". | Opens the full form. With no regular items the tile opens the form directly. |  |  |
| G6 | Regular item screen: add a time two minutes ahead. | Permission asked the first time; item shows the time. |  |  |
| G7 | Wait for it, with the app open. | A banner appears. |  |  |
| G8 | Repeat with the app in the background, then locked. | Notification arrives with the item's name, never the dose. |  |  |
| G9 | Press the **Taken** (or **Applied**) button on the notification. | The app opens and one entry is logged at that time. If the button is missing or does nothing, record the app state and iOS version: this is the known unreliable part. |  |  |
| G10 | Tap the notification body itself. | Today opens with the quick sheet of that kind. |  |  |
| G11 | Turn "Hide the name" on, wait for the next reminder. | Generic text ("Time for your medication"). |  |  |
| G12 | Stop the item. | Its reminders stop; earlier entries stay. |  |  |
| G13 | Deny notifications in iOS settings, then add a time. | Error and an "Open system settings" button that works. |  |  |
| G14 | Daily Health reminder: enable it for a time two minutes ahead, save a Daily health record for today first. | No reminder fires today. Tomorrow's is still scheduled. |  |  |
| G15 | Same, with no record today. | The reminder fires; tapping it opens Daily health for that day. |  |  |
| G16 | Tap a reminder while a form with unsaved changes is open. | Nothing happens (the form is not lost). |  |  |
| G17 | Nail reminder (needs a nail area) and monthly backup reminder: set one a minute ahead if possible (change the day for weekly and monthly ones). | Fires; the backup one opens Data and backup. |  |  |

## 8. Export, import, privacy (P0)

| ID | Do | Expect | Pass | Notes |
| --- | --- | --- | --- | --- |
| E1 | Data and backup: Full backup. | Share sheet; the file saves to Files or AirDrop. |  |  |
| E2 | Open the ZIP on the computer. | `data.json`, photos, `report.pdf`, optional CSV. No API key anywhere. |  |  |
| E3 | Doctor report. | PDF paginates, charts render, A4, flares table states the threshold, Daily health table, text readable. |  |  |
| E4 | Export with a password. | Opens in 7-Zip with the password; not without. |  |  |
| E5 | AES export speed with 30 or more photos (open question). | Note the time. |  |  |
| E6 | Delete data: choose a group. | Action sheet with Export first; a second confirmation. |  |  |
| E7 | Import into a clean app (Merge, then Replace). | Preview counts; entries come back; regular items return and reminders are re-asked and re-scheduled (EX-10). |  |  |
| E8 | Delete one entry, re-import an older backup, merge. | The tombstone blocks it; the switch restores it. |  |  |
| E9 | App lock (Privacy): enable, background the app for a minute. | Locked on return; Expo Go uses the passcode. Switcher cover hides the screen. |  |  |
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
| A1 | Settings, AI analysis: enter your API key. | Stored; never shown in full again. |  |  |
| A2 | Meal photo estimate, label scan, barcode scan of a real product (Open Food Facts). | Confirmation names what is sent and notes separate billing; Cancel works; results are editable and marked as AI. |  |  |
| A3 | Run one analysis over a short range. | Hypotheses with uncertainty, flare periods and Daily health used; the running card shows on Review. |  |  |
| A4 | Leave the app during a run. | Shows interrupted with a retry. |  |  |
| A5 | Report summary in the Doctor report. | Editable; goes under the AI label in the PDF. |  |  |
| A6 | Polish products: scan three you actually buy. | Note how many Open Food Facts knows. |  |  |

## 11. Guide and routine changes (P2)

| ID | Do | Expect | Pass | Notes |
| --- | --- | --- | --- | --- |
| U1 | More, then "Where do I log…?" (and from Settings, About). | 16 situations; each opens the right form. |  |  |
| U2 | Routine change: Started, "already using, date unknown". | No date; shown with "date unknown". |  |  |
| U3 | Routine change: Stopped. | "In use now" lists it; tapping fills the name. |  |  |
| U4 | Add your own category in Settings, Logging. | Appears in the form with its description. |  |  |

## Exit criteria

- Every P0 check passes, or each failure has a written note.
- No crash during sections 1 to 4.
- Notifications (section 7) behave on at least one real reminder in each app state, or the failure is documented so the button-based logging can be redesigned.

## After the run

Record results in `docs/work-log.md` (a dated entry, no personal data). Fix failures on feature branches from `develop`. Move confirmed items out of the phone checklist in `docs/open-questions.md`.
