# User flows and edge cases

Status: accepted 2026-11-14 and built except where `docs/open-questions.md` ("Status of the decided work") lists it as missing. Requirements: `docs/requirements.md` v0.4.2. Screens and rules: `docs/ux-design.md`.

## Flow rules

- Every flow starts on Today and ends on Today with the new row visible in the log.
- A form saves only through Save. Quick sheets (stool, treatment shortcuts, "save on tap" suggestions) save on pick.
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
- Stool tile opens a quick sheet. Tapping a Bristol type saves it now. "Earlier…" opens the full form.
- A treatment shortcut chip saves at once and is disabled for 3 seconds so a double tap cannot log twice. A combination becomes a shortcut after it has been used twice, at most 3 on Today. Archived treatments and areas never appear.

**Skin update.** Active areas are listed with their last values and a "No change" button each. "No change for all" saves every area that has a previous entry; areas without one are listed as needing a first entry. Photos attach per area entry, with the sensitive flag shown and changeable. An open flare shows as a card on Today with an End flare action.

**Check-in and closing the day.** Open the form (empty, or today's saved one). "Same as yesterday" fills the scores; nothing is prefilled silently. Save, plus a separate "Mark day complete" switch. Completing a day with no meals asks first, because the analysis discounts incomplete days (LL-4).

**Reaction.** Started from a meal row ("Reaction after this meal") or from More, which offers the last 24 hours of meals. No meals: "Log a meal first". The onset cannot be before the meal. The urgent-care advice is always visible on this form (the one exception to the no-hints rule).

**Edit and delete (EN-1).** Tap a row in the log, then Edit or Delete. Delete opens an action sheet naming what else goes: "also deletes 3 photos", "also deletes 1 reaction".

## Review, backup and import

- **Doctor report (Review):** range (default since the last export), counts and photo count, sensitive photos off by default, then the share sheet. An optional AI summary (LL-14) is generated here after the billing confirmation, shown for review and editable, and opens the PDF. Nothing in the range disables Export and says why.
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

Each reminder carries a target in its data (`checkin`, `nails`, `backup`). The app maps it to a route from a fixed list and never opens a URL from notification data.

| Reminder | Tap result |
| --- | --- |
| Check-in (daily) | Today with the Check-in form. If that day is already complete, just Today. |
| Nail photos (weekly) | Today with the Nail update form. If no nail area remains, just Today. |
| Backup (monthly) | Settings, Data and backup, Full backup. Never exports by itself. |

- A late tap opens the check-in for the day the reminder was delivered (the notification's delivery time, to be verified), with the date in the title.
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
| Edit a check-in to a day that already has one | Blocked, with a link to open that day's check-in |
| Add or delete entries in a completed day | The mark stays; Today shows "Day complete" with Reopen |
| Delete a meal that has reactions | Cascade, stated in the action sheet |
| Delete a skin or nail entry | Its photos and photo files go with it |
| Delete a flare start that has an end | Both go, stated in the sheet; deleting an end alone reopens the flare |
| Edit a flare marker time | Must keep start before end and not overlap the previous flare |
| Edit a meal time to after its reaction | Blocked |
| Delete an area, treatment or tag in use | Not deletable; archive. History keeps showing it |
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
