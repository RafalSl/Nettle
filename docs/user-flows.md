# User flows and edge cases

Status: accepted 2026-11-14 and built, then revised 2026-11-15 (requirements v0.6). Flows marked "(v0.6)" are decided but not built; `docs/open-questions.md` ("Status of the decided work", "Decided in v0.6, not built") lists them. Revised again 2026-11-16 (requirements v0.7): flows marked "(v0.7)" are decided but not built. Revised again 2026-11-16 (requirements v0.8): flows marked "(v0.8)" are decided but not built, and flows marked "(Later)" are designed but not planned. Requirements: `docs/requirements.md` v0.8. Screens and rules: `docs/ux-design.md`.

## Flow rules

- Every flow starts on Today and ends on Today with the new row visible in the log.
- A form saves only through Save. Quick sheets (stool, treatment shortcuts, regular medication and treatment, "save on tap" suggestions) save on pick.
- Settings is the one exception to "ends on Today": it is a pushed screen above the tabs (UX-1). Back returns to the tab it was opened from, and there is no Done.
- Nothing from an LLM or a database is saved without a review step. A failed save keeps the form open with its data.

## Daily flows

**Meal (3 taps from a suggestion).** One form, two phases (IN-7).
1. *Choose:* New meal shows suggestions (IN-14) above a description field. Typing filters the whole history. A new meal is typed.
2. *Review:* choosing a suggestion fills the description, ingredient chips and allergen tags from its latest use. Chips can be removed, renamed and added (autocomplete), and tags toggled. The time chip says Now.
3. Save creates a new, independent entry.
4. "Change meal" returns to choose. It asks first only if something was edited (action sheet, Discard Changes).
5. Allergen tags that come from the diary's history are pre-selected and visible, so they count as confirmed (IN-10). Hints from the ingredient text appear as unselected chips.
6. *Packaged product (IN-2):* scan. The diary's own history is checked first (a hit shows its date and "Scan label again"; an in-store code still asks to confirm the match), then Open Food Facts: found (review), not found (label scan, IN-15, or manual entry) or an in-store code (warning, confirm the match).
7. *Photo (IN-3):* see "Waiting for the LLM". The estimate arrives as an editable list and lands in the review phase.
8. *Label (IN-15):* offered when a barcode is not found or incomplete, or from the scan phase for a product without a barcode. Photograph the ingredient label; after the billing confirmation (LL-5) the result lands in the review phase as editable chips with the text the model read beside them. Allergen tags stay unselected.
9. *Name (v0.8, IN-19):* once a description is typed, "Suggest ingredients from the name" sits beside the photo and label buttons. After the billing confirmation (LL-5) the typical ingredients arrive as an editable list in the same panel as a photo estimate: Add all, pick items or Dismiss. Allergen tags stay unselected, and the AI allergen button can follow. A name that is too vague returns an empty list and a note.
10. *Fill later (Later, IN-20):* a switch under the description marks the meal or drink for the next AI pack. Save as usual; the log row says "waiting for AI".

**Stool and treatment (1 to 2 taps).**
- Stool tile opens a quick sheet while Stool is pinned. Tapping a Bristol type saves it now. "Earlier…" opens the full form. From More, Stool opens the full form.
- A treatment shortcut chip saves at once and is disabled for 3 seconds so a double tap cannot log twice. A combination becomes a shortcut after it has been used twice, at most 3 on Today. Archived treatments and areas never appear.
- (v0.7) Reaction after applying (IN-11): the shortcut and the quick sheet never ask. Later, tap the application's row in the log, Edit, and pick None, Mild or Strong; leaving it empty means "not recorded", which is not the same as None.

**Skin update.** Active areas are listed with their last values and a "No change" button each. "No change for all" saves every area that has a previous entry; areas without one are listed as needing a first entry. Scores use the slider row (UX-3). (v0.6) Photos are added in the form itself, per area entry, with the sensitive flag shown and changeable, and are attached on Save; a photo can be the only change ("No change" plus a photo, SK-4). Photos can still be added later from the entry's edit screen. (v0.6) Flares are not logged: when a saved severity reaches the threshold (SK-6), Today shows the flare card, "Flare in N areas, worst: X", which opens Review, Areas with the flaring areas first. (v0.7) Each area entry also has a "Cracks or open wounds" switch and, behind a Details row, an optional size in mm with a Clear button; both are prefilled and carried by "No change" (SK-3). The former intimate area is three areas (penis, perineum and groin, between the buttocks), listed and scored separately and sensitive by default (SK-1). A fixed patch such as one on a knee is a user area with a size.

**Daily health (v0.6).** Open the form (empty, or today's saved record). It lists the user's check-in items (SK-7): scores with the slider row, yes/no items as switches. "Same as yesterday" fills all items; nothing is prefilled silently. Save logs the day (SK-11); there is no "complete" switch. Saving a day with no meals asks once first, because the analysis discounts days that are not fully logged (LL-4). Editing the record later keeps the day logged; deleting it makes the day unlogged again. (v0.7) Two more seeded yes/no items: hot or long shower, and friction in the intimate area (IN-6).

**Routine change (v0.6).** From More (or pinned). Choose Started or Stopped and a category (Product, Diet, or one the user added; each predefined one shows its description). Started: a name, a date, and "already using, date unknown" for things begun before the diary. Stopped: pick from the items in use now. Rule of thumb shown in the descriptions: a cream applied to an area to treat it is a Treatment; a soap, detergent or cosmetic that merely touches the skin is a Product, logged once at start and once at stop.

**Regular medication or treatment (v0.6).** On the Medication form (supplements included) or the Treatment form, the "Regular" switch marks the item. Settings, Logging, "Regular items" lists the regular items; the screen of each one holds reminder times, the hide-name switch and Stop. Logging a dose: the Medication tile opens a quick sheet of regular items; one tap logs it now, highlights the row and locks it for 3 seconds. "Other or earlier…" opens the full form. With no regular items the tile opens the full form. Treatment works the same way, with areas.

**Quick-action layout (v0.6).** Today, Edit: two lists, On Today and In More. Up and down reorder the pinned list; Move sends an entry to More; Pin brings one back. The More tile cannot be moved. Done leaves Edit mode.

**Where do I log…? (v0.6).** From More or Settings, About: a list of situations ("a new cream or soap", "a regular tablet"); each row opens the right form. (v0.7) New rows: "a doctor visit or a test result" opens Medical event; "I am ill" explains the two ways (the Daily health switch for a quick yes/no, a Medical event of kind illness for its name and length) and opens either.

**Medical event (v0.7).** From More (or pinned). Pick a kind (visit, test result, diagnosis, illness, other), type a short title, keep or change the date (default today) and add a note if needed. An illness shows an optional end date, which can be added later from the edit screen. Save puts a row in the day's log and a marker on the timelines; nothing is sent anywhere (IN-18).

**Reaction.** Started from a meal row ("Reaction after this meal") or from More, which offers the last 24 hours of meals. No meals: "Log a meal first". The onset cannot be before the meal. The urgent-care advice is always visible on this form (the one exception to the no-hints rule).

**Edit and delete (EN-1).** Tap a row in the log, then Edit or Delete. Delete opens an action sheet naming what else goes: "also deletes 3 photos", "also deletes 1 reaction". (v0.8) The same sheet opens from a skin or nail entry on its area's timeline (Review, Areas, the area); after Save or Delete the timeline reloads.

## Review, backup and import

- **Browsing (v0.6, UX-10):** below the two output rows, Days | Areas. Days: month with ‹ › and a jump picker, a calendar grid, then the month's days; "Incomplete days" is the only filter. Areas: Skin and Nails groups with the last score or stage and date; flaring areas first when opened from the flare card.
- **Area timeline (v0.8, SK-8, EN-1):** Review, Areas, tap an area. "Go to date" opens a date picker and scrolls to that day, or to the nearest earlier day with an entry and says so; the chart and the list stay complete. Tap an entry's line for Edit or Delete (the sheet names the photos that go with it). Flare lines are derived and not tappable. While comparing photos, taps pick photos and the entry sheet is off.
- **Doctor report (Review):** range (default since the last export), counts and photo count, sensitive photos off by default, then the share sheet. An optional AI summary (LL-14) is generated here after the billing confirmation, shown for review and editable, and opens the PDF. Nothing in the range disables Export and says why.
- **Settings (v0.6):** the gear on either tab pushes Settings above the tabs; Back returns to that tab.
- **Full backup (Settings, Data and backup, EX-14):** records and settings, all photos including sensitive, optional password. The Doctor report defaults would silently drop sensitive photos, which is wrong for a backup or a migration from Expo Go.
- **Import and restore:** pick the file; password if protected; preview with counts, new versus duplicate and entries skipped by a tombstone, with the restore switch (EX-10); choose records, settings or both and merge or replace. Replace asks again in an action sheet and offers an export first. All or nothing, then a summary. A file that needs settings the app lacks says so and offers to import settings too.
- **(v0.7) Derived lines:** a photo on the timeline and in the report carries a caption such as "14 h after <treatment>" or "no treatment logged" (SK-4). The Doctor report lists, per area and treatment, the days from the end of each course to the next flare (SK-12), and shows medical events on its timeline (IN-18). Both numbers come from the program; the analysis receives them as numbers.
- **AI analysis:** range, review of exactly what will be sent plus the billing notice (LL-5), confirm, progress screen, result stored as tentative hypotheses.

## Using my Claude plan (Later, LL-15, IN-20)

Designed, not planned. A manual handoff so a stronger model on the user's own Claude subscription can analyze the diary and fill gaps, with nothing sent by the app itself.

1. *Mark (IN-20):* on a meal or drink, switch on "Fill later with AI" and save with just a description. The log row says "waiting for AI".
2. *Prepare (LL-15):* Review, AI analysis, "Use my Claude plan", "Prepare a pack". Choose the date range and photos (sensitive photos off by default; no meal photos exist). The screen lists what is inside (counts and marked entries) and says that the file leaves the phone only by your act, that a Claude plan chat is under the consumer terms, and that the app bills nothing. Prepare opens the share sheet; the ZIP never goes anywhere by itself.
3. *Hand over:* outside the app, give the ZIP to a model in a Claude chat. `INSTRUCTIONS.md` in the pack says what to do and which file to return.
4. *Import:* "Import a result", pick `result.json`. The preview shows the analysis (range, model), whether a report summary is included, how many suggestions come with it and how many are skipped. Import stores the analysis like any other one, labelled manual, and queues the suggestions.
5. *Review suggestions (IN-20):* a Today card, "3 AI suggestions to review", opens the list. A row opens that entry's edit screen with the suggestion in the same panel as a photo estimate. Add all or pick, edit, Save: the mark clears and the source reads name estimate (manual). Dismiss removes the suggestion and keeps the mark.

The model never edits `data.json`, and an import never changes an entry by itself.

## Waiting for the LLM (LL-12)

| Moment | Behavior |
| --- | --- |
| Analysis start | The review screen becomes a progress screen: spinner, elapsed time ("Running for 2:10"), a one-line summary of what was sent, Cancel. No invented percentage. |
| Screen lock | The screen is kept awake during the run. |
| Leaving the screen in the app | The run continues. Review shows "Analysis running" and then "Analysis ready". |
| Leaving the app | The request may be interrupted. On return: "Interrupted, nothing was saved" with a one-tap retry on the same prepared request. |
| Cancel | Aborts the request and stores nothing. The note says work already started may still be billed. |
| Failure | Clear message, nothing stored (LL-8). |
| Meal photo, label or name (v0.8) | Inline in the form, which stays editable. After 30 seconds: "Still working, keep entering the meal" and a Cancel link. |
| Meal photo or name result | A banner with the suggested ingredients: Add all, pick items, or Dismiss. Added items are normal chips, so they can be renamed and removed, and the user's own can be added. Never overwrites typed text. LLM allergen tags stay unselected. A name that is too vague returns an empty list and the model's note (v0.8). |
| Save or leave the form while waiting | Save uses the fields as they are and drops the estimate. Leaving aborts it. |

Built: a timeout is never retried (so a call can no longer run about 30 minutes), the analysis screen has elapsed time and Cancel, both confirmations say the call is billed separately, the inline photo estimate with Cancel, keep-awake, the running card in Review and the interrupted state with retry. Keep-awake and the behavior when the app is backgrounded are unverified on a device. Streaming (`expo/fetch`, unverified) or the Message Batches API are options if long runs time out in practice; neither is planned.

## Notification taps (SK-9)

Each reminder carries a target in its data (`checkin`, `nails`, `backup`, and in v0.6 `regular` for regular medication and treatment). `checkin` keeps its name in the code; it opens Daily health. The app maps it to a route from a fixed list and never opens a URL from notification data.

| Reminder | Tap result |
| --- | --- |
| Daily health (daily) | Today with the Daily health form. If that day already has a record (v0.6), just Today. The reminder is sent only while the day has no record; saving one reschedules it. |
| Nail photos (weekly) | Today with the Nail update form. If no nail area remains, just Today. |
| Backup (monthly) | Settings, Data and backup, Full backup (the pushed Settings screen, v0.6). Never exports by itself. |
| Regular medication or treatment (v0.6) | Today with the quick sheet of regular items. The Taken or Applied button logs at the tap time and opens the app if iOS requires it. The notification shows the item name unless hidden for that item. |

- A late tap opens Daily health for the day the reminder was delivered (the notification's delivery time, to be verified), with the date in the title.
- A tap does nothing while a form has unsaved changes. The Today cards cover it.
- A handled notification is remembered, because Expo returns the last response again at launch and the form would reopen on every start.
- On a cold start, navigate only when the database and the root navigator are ready.
- Texts stay generic, with no entries. With the app lock (SE-8), the target waits until unlock.
- Test: schedule a reminder a minute ahead and tap it from the lock screen and from Notification Center, with the app open, in the background and killed.

## Edge cases and defaults

| Case | Default |
| --- | --- |
| Logging for a past day | Form defaults to the current clock time on that day, title shows the date; future times are blocked |
| App open across the day start (NF-7) | On foreground it returns to today unless the user chose another day |
| Travel across time zones | Each entry's day is its own recorded local day (NF-4) |
| Edit a Daily health record to a day that already has one | Blocked, with a link to open that day's record |
| Add entries to a logged day (v0.6) | The day stays logged; nothing to reopen |
| Delete the Daily health record (v0.6) | The day is unlogged again; the evening reminder applies to it only if it is still today |
| Delete a meal that has reactions | Cascade, stated in the action sheet |
| Delete a skin or nail entry | Its photos and photo files go with it |
| Edit or delete a skin entry that is part of a flare (v0.6) | The flare periods are recomputed from the entries; there is nothing to confirm |
| Change the flare threshold (v0.6) | The whole history regroups; the setting says so |
| Flare with no later entry below the threshold (v0.6) | Reads "open at last entry" |
| Edit a meal time to after its reaction | Blocked |
| Delete an area, treatment or Daily health item in use | Not deletable; archive. History keeps showing it |
| Stop or archive a regular item (v0.6) | Its reminders are cancelled; past doses stay in the log |
| Notification permission denied with regular reminders set (v0.6) | The item screen and the Reminders summary say reminders are off and offer the system settings button; logging from the tile still works |
| Pinned list empty except the More tile (v0.6) | Allowed; Today shows only the More tile |
| Duplicate area names | Rejected among active areas, case-insensitive (new error code) |
| Meal descriptions differing by case or spacing | Same meal. Different wording is a different meal; fix by editing old entries |
| Favorite whose entries were all deleted | Kept. A favorite stores a snapshot of description and ingredients, updated whenever that meal is saved |
| First run, empty history | No suggestions section, no onboarding. Review shows an empty state explaining why |
| Notification permission denied | Reminders screen explains it and offers a button to the system settings |
| Camera or photo permission denied | Photo area explains it with the same button; the entry still saves |
| Photo save fails | The entry is saved first; the failed photo shows a retry |
| Storage error on save | The form stays open with a message |
| Restart in the middle of a form | Unsaved form text is lost; no drafts. Saved data is unaffected (NF-3) |
| Illness logged as a daily tag and as a medical event (v0.7) | Counted once: a day is an illness day when either says so |
| Illness with no end date (v0.7) | Counts for its start day only and reads "no end date"; it never stays open by itself |
| Illness end date before its start (v0.7) | Blocked |
| Photo with no application on that area in the 7 days before it (v0.7) | Caption "no treatment logged" |
| Treatment applied later the same day than the photo (v0.7) | Ignored; only earlier applications count |
| Application added, edited or deleted (v0.7) | Captions and time to relapse are recomputed; nothing is stored |
| Course still running, last application within the gap (v0.7) | No time to relapse yet; reads "course running" |
| Another treatment applied between the course end and the flare (v0.7) | Listed beside the result as a confounder |
| Size no longer applies, the patch healed (v0.7) | Clear empties it; "No change" would keep carrying it |
| Entries made on the old single intimate area (v0.7) | A small SQL step turns the old `area-intimate` row into an archived area under its stored name, with its entries; a fresh install has only the three new areas |
| Go to date with no entry that day (v0.8) | Scrolls to the nearest earlier day with an entry and says so |
| Go to date before the area's first entry (v0.8) | Scrolls to the oldest day and says so |
| Delete the last entry of an area from its timeline (v0.8) | The timeline shows its empty state; the area stays |
| Edit an entry's time so it falls on another day, from the timeline (v0.8) | It appears under the new day after the reload; flares are recomputed |
| Tap an entry while comparing photos (v0.8) | Nothing opens; taps pick photos until compare mode ends |
| Name estimate with an empty description (v0.8) | The button is hidden |
| Name too vague, for example "lunch" (v0.8) | An empty list and the model's note; nothing is added |
| Name estimate on a meal chosen from history (v0.8) | Allowed; it behaves like a photo estimate there (IN-16) and never replaces confirmed ingredients |
| The same name estimated twice (v0.8) | Each run is a new call; the diary's history is the cache (IN-7), nothing separate is stored |
| Result for a different pack (Later) | Refused, showing the pack id it answers |
| The same result imported twice (Later) | Skipped: "already imported" |
| Result is not valid or fails the schema (Later) | Refused whole with the reason; nothing is stored |
| Suggestion for an entry deleted since the pack (Later) | Skipped and counted in the preview |
| Suggestion for an entry that now has ingredients (Later) | Shown beside them; never replaces them |
| Suggestion dismissed (Later) | Removed; the mark stays, so the next pack asks again |
| Delete all data | Offers an export first, asks twice; does not delete the API key (it has its own remove button) |

## Risks and open checks

- Free-account standalone builds expire after 7 days. Whether reinstalling over the top keeps the data is unverified, so the backup card on Today appears after 7 days (UX-2).
- Unverified in Expo Go: `expo-keep-awake`, the notification delivery time field, `expo/fetch` streaming.
- Face ID lock flow (SE-8) is not designed because it is not built. Default: lock on cold start and after a minute in the background.
- (v0.6) Notification action buttons (Taken, Applied) may not work from the lock screen or in the background on the current SDK; forum reports for SDK 39 and 42 say they were unreliable. Test on the phone: lock screen, Notification Center, app open, background and killed. The design opens the app and logs, so it holds either way.
- (v0.6) The "reminder only while the day has no record" rule needs one-shot scheduling that is renewed on each app start and on each save. If the app is not opened for days, the reminder keeps firing. Accepted.
- (v0.7) A course ends after 7 days without an application (SK-12, decided 2026-11-16), so maintenance use twice a week stays one course. Accepted cost: two real courses less than a week apart merge into one. A gap per treatment is the fallback if that hides too much.
- (v0.7) The Skin form grows by a switch and a Details row on top of five scores; check on the phone that an update with no change is still one tap and the form does not need scrolling for a typical area.
- (v0.6) The slider row (−, slider, +) is a design bet: check on the phone that whole-number steps feel right and that the value is readable under the thumb.
- (Later) The AI pack (LL-15) is unverified on the Claude side: whether a chat opens a ZIP with photos, how many files and how large, which models and usage limits the plan gives, and what the account's privacy setting does to retention. Test with a synthetic pack before building anything.
