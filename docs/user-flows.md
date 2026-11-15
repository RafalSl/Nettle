# User flows and edge cases

Status: accepted 2026-11-14 and built, then revised 2026-11-15 (requirements v0.6). Flows marked "(v0.6)" are decided but not built; `docs/open-questions.md` ("Status of the decided work", "Decided in v0.6, not built") lists them. Requirements: `docs/requirements.md` v0.6. Screens and rules: `docs/ux-design.md`.

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

**Stool and treatment (1 to 2 taps).**
- Stool tile opens a quick sheet while Stool is pinned. Tapping a Bristol type saves it now. "Earlier…" opens the full form. From More, Stool opens the full form.
- A treatment shortcut chip saves at once and is disabled for 3 seconds so a double tap cannot log twice. A combination becomes a shortcut after it has been used twice, at most 3 on Today. Archived treatments and areas never appear.

**Skin update.** Active areas are listed with their last values and a "No change" button each. "No change for all" saves every area that has a previous entry; areas without one are listed as needing a first entry. Scores use the slider row (UX-3). (v0.6) Photos are added in the form itself, per area entry, with the sensitive flag shown and changeable, and are attached on Save; a photo can be the only change ("No change" plus a photo, SK-4). Photos can still be added later from the entry's edit screen. (v0.6) Flares are not logged: when a saved severity reaches the threshold (SK-6), Today shows the flare card, "Flare in N areas, worst: X", which opens Review, Areas with the flaring areas first.

**Daily health (v0.6).** Open the form (empty, or today's saved record). It lists the user's check-in items (SK-7): scores with the slider row, yes/no items as switches. "Same as yesterday" fills all items; nothing is prefilled silently. Save logs the day (SK-11); there is no "complete" switch. Saving a day with no meals asks once first, because the analysis discounts days that are not fully logged (LL-4). Editing the record later keeps the day logged; deleting it makes the day unlogged again.

**Routine change (v0.6).** From More (or pinned). Choose Started or Stopped and a category (Product, Diet, or one the user added; each predefined one shows its description). Started: a name, a date, and "already using, date unknown" for things begun before the diary. Stopped: pick from the items in use now. Rule of thumb shown in the descriptions: a cream applied to an area to treat it is a Treatment; a soap, detergent or cosmetic that merely touches the skin is a Product, logged once at start and once at stop.

**Regular medication or treatment (v0.6).** On the Medication form (supplements included) or the Treatment form, the "Regular" switch marks the item. Settings, Logging, "Regular items" lists the regular items; the screen of each one holds reminder times, the hide-name switch and Stop. Logging a dose: the Medication tile opens a quick sheet of regular items; one tap logs it now, highlights the row and locks it for 3 seconds. "Other or earlier…" opens the full form. With no regular items the tile opens the full form. Treatment works the same way, with areas.

**Quick-action layout (v0.6).** Today, Edit: two lists, On Today and In More. Up and down reorder the pinned list; Move sends an entry to More; Pin brings one back. The More tile cannot be moved. Done leaves Edit mode.

**Where do I log…? (v0.6).** From More or Settings, About: a list of situations ("a new cream or soap", "a regular tablet"); each row opens the right form.

**Reaction.** Started from a meal row ("Reaction after this meal") or from More, which offers the last 24 hours of meals. No meals: "Log a meal first". The onset cannot be before the meal. The urgent-care advice is always visible on this form (the one exception to the no-hints rule).

**Edit and delete (EN-1).** Tap a row in the log, then Edit or Delete. Delete opens an action sheet naming what else goes: "also deletes 3 photos", "also deletes 1 reaction".

## Review, backup and import

- **Browsing (v0.6, UX-10):** below the two output rows, Days | Areas. Days: month with ‹ › and a jump picker, a calendar grid, then the month's days; "Incomplete days" is the only filter. Areas: Skin and Nails groups with the last score or stage and date; flaring areas first when opened from the flare card.
- **Doctor report (Review):** range (default since the last export), counts and photo count, sensitive photos off by default, then the share sheet. An optional AI summary (LL-14) is generated here after the billing confirmation, shown for review and editable, and opens the PDF. Nothing in the range disables Export and says why.
- **Settings (v0.6):** the gear on either tab pushes Settings above the tabs; Back returns to that tab.
- **Full backup (Settings, Data and backup, EX-14):** records and settings, all photos including sensitive, optional password. The Doctor report defaults would silently drop sensitive photos, which is wrong for a backup or a migration from Expo Go.
- **Import and restore:** pick the file; password if protected; preview with counts, new versus duplicate and entries skipped by a tombstone, with the restore switch (EX-10); choose records, settings or both and merge or replace. Replace asks again in an action sheet and offers an export first. All or nothing, then a summary. A file that needs settings the app lacks says so and offers to import settings too.
- **AI analysis:** range, review of exactly what will be sent plus the billing notice (LL-5), confirm, progress screen, result stored as tentative hypotheses.

## Waiting for the LLM (LL-12)

| Moment | Behavior |
| --- | --- |
| Analysis start | The review screen becomes a progress screen: spinner, elapsed time ("Running for 2:10"), a one-line summary of what was sent, Cancel. No invented percentage. |
| Screen lock | The screen is kept awake during the run. |
| Leaving the screen in the app | The run continues. Review shows "Analysis running" and then "Analysis ready". |
| Leaving the app | The request may be interrupted. On return: "Interrupted, nothing was saved" with a one-tap retry on the same prepared request. |
| Cancel | Aborts the request and stores nothing. The note says work already started may still be billed. |
| Failure | Clear message, nothing stored (LL-8). |
| Meal photo or label | Inline in the form, which stays editable. After 30 seconds: "Still working, keep entering the meal" and a Cancel link. |
| Meal photo result | A banner with the suggested ingredients: Add all, pick items, or Dismiss. Added items are normal chips, so they can be renamed and removed, and the user's own can be added. Never overwrites typed text. LLM allergen tags stay unselected. |
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
| Delete all data | Offers an export first, asks twice; does not delete the API key (it has its own remove button) |

## Risks and open checks

- Free-account standalone builds expire after 7 days. Whether reinstalling over the top keeps the data is unverified, so the backup card on Today appears after 7 days (UX-2).
- Unverified in Expo Go: `expo-keep-awake`, the notification delivery time field, `expo/fetch` streaming.
- Face ID lock flow (SE-8) is not designed because it is not built. Default: lock on cold start and after a minute in the background.
- (v0.6) Notification action buttons (Taken, Applied) may not work from the lock screen or in the background on the current SDK; forum reports for SDK 39 and 42 say they were unreliable. Test on the phone: lock screen, Notification Center, app open, background and killed. The design opens the app and logs, so it holds either way.
- (v0.6) The "reminder only while the day has no record" rule needs one-shot scheduling that is renewed on each app start and on each save. If the app is not opened for days, the reminder keeps firing. Accepted.
- (v0.6) The slider row (−, slider, +) is a design bet: check on the phone that whole-number steps feel right and that the value is readable under the thumb.
