# Open questions and gaps

Undecided items only. Decisions go into `docs/requirements.md` (canonical, edited directly) and are removed from here.

## Open

1. **AES export (EX-6): speed on the phone is unmeasured.** Implemented in pure JS and verified against 7-Zip (see `docs/spikes/aes-zip.md`). Photos are now exported (stored, not deflated, so only AES and the MAC cost time); V8 does about 26 MiB/s, Hermes is unmeasured. Measure with a real export of 30 or more photos, encrypted, on the phone.
2. **Polish strings: review at the end of the project.** First draft lives in `app/src/i18n/pl.json` (English in `en.json`).
3. **Unused template dependencies: prune when moving to a standalone build** (reanimated, gesture-handler, expo-image, expo-glass-effect, `@expo/ui`, ...). No effect in Expo Go.

5. **Merge keeps local settings.** Importing into a fresh install with Merge skips the six pre-seeded predefined areas, so a renamed or archived predefined area from the file is not applied; use Replace (settings) to restore them. Revisit with EX-12 (newest wins) or adopt incoming values for areas still at factory state.
9. **Expo Go checks for the new navigation (UX-1 to UX-3):** large titles, `expo-symbols`, the sheet grabber, the JS tab bar next to the iOS floating one, `formSheet` and `modal` presentation. The design does not depend on them.
10. **Long LLM runs (LL-12):** the single request with a 10 minute timeout stays. If analyses time out in practice, decide between streaming (`expo/fetch`, unverified in Expo Go) and the Message Batches API.

## Accepted

- **`expo-sqlite` wrapper stays untested in code.** Storage logic is tested through the `SqlDb` seam on Node's built-in `node:sqlite`; the ~20-line wrapper `app/src/adapters/storage/expoSqliteDb.ts` is verified on a phone only.

## Decided, code partly changed

- **Requirements v0.3 and later: what remains.**
  - Barcode (IN-2, IN-8, IN-9): not started. Needs the Open Food Facts adapter and a scan screen (`expo-camera` or `expo-barcode-scanner`, check Expo Go).
  - Recent and favorite meals (IN-7), suggestions (IN-14): not started. Requirements v0.4 redefines IN-7 and adds IN-14; the design is in `docs/ux-design.md`.
  - Navigation and screens (UX-1 to UX-9): not started. Two tabs (Today, Review), Settings behind a gear icon, modal forms, action sheets.
  - PDF report language default (EX-3): the Data screen still starts on English (`reportLanguage`); change it to the app language.
  - Import switch to restore entries skipped because of a tombstone (EX-10): not started.
  - LL-12 and LL-5: the adapter retries a timed-out attempt and has no cancel signal; the analysis screen has no elapsed time or Cancel, no running card in Review, no billing notice. The meal photo estimate is not inline and editable yet (IN-3).
  - IN-7 choose and review phases; SK-9 tap targets and the handled-notification marker; EX-14 Full backup preset; SK-2 unique area names (new error code); SK-11 empty-day confirmation; EN-1 cascades and edit rules: all not started. Flows in `docs/user-flows.md`.
  - Edit and delete one entry (EN-1) and tombstones (EX-13): not started. Needs a `tombstones` table, a `tombstones` section in `data.json` and merge rules; `schema_version` stays 1.
  - Timeline per area with photos side by side (SK-8): not started.
  - Reminders (SK-9) are built; the nail reminder follows nail areas and the weekday numbering is iOS (1 = Sunday).
  - App lock with Face ID (SE-8): not started (`expo-local-authentication`).
  - Single-photo export selection and a per-photo LLM selection are core only; the screens offer all, none, non-sensitive and an area and date filter.
  - "No change" for nail entries, and for all areas at once.
  - Allergen suggestions from Open Food Facts or the LLM (only the ingredient-text helper exists).
  - Export "since last export" (EX-11) and a date range picker for the export (core `days` option exists).
  - Newest-wins merge (EX-12, Later): the daily check-in and photos' sensitive flag are edited in place, and merge cannot tell which version is newer.
- **One check-in per day is kept by the use case only.** A merge from another phone could add a second one for the same day; the newest is shown. Revisit with EX-12.
- **`schema_version` stays 1 in development.** Exports made before the current sections will not import.
- **Anthropic refusal fallback:** not used (needs the beta request shape); a refusal shows a message. Revisit once a real call has worked.

## To verify on the phone (nothing below has run on a device)

- Start-up after the fix; the new tabs; migrations 3 to 12 on the existing database (first launch).
- Photos: camera and library permission prompts, thumbnails, blur on sensitive photos, EXIF removal, backup exclusion (SE-7: not possible in Expo Go).
- Export with photos, CSV and PDF: that `expo-print` paginates a long report, renders the inline SVG and images, A4 size; the speed of an AES export with many photos (item 1).
- AI: a real key and one real analysis and photo-to-ingredients call; check the cost and the answer language (English and Polish).
- Reminders: permission prompt, a daily reminder at a time a minute away, the weekly and monthly ones by changing the day.
- Date pickers (check-in day, export photo filter, analysis range), the delete confirmation and "Export first".
- Reminder taps (SK-9): schedule one a minute ahead and tap it from the lock screen and Notification Center, with the app open, in the background and killed; check that `notification.date` exists and that the form does not reopen on every launch. Also `expo-keep-awake` in Expo Go.
- Language: Expo Go follows the device language (decided: no in-app setting, UX-7); check that the Polish strings appear when the device is set to Polish.

## Accepted

- **`expo-sqlite` wrapper stays untested in code.** Storage logic is tested through the `SqlDb` seam on Node's built-in `node:sqlite`; the ~20-line wrapper `app/src/adapters/storage/expoSqliteDb.ts` is verified on a phone only.

## Decided, code partly changed

These are in the requirements already; what remains is listed per item.

- **Requirements v0.3 tracking changes.** Done in core, storage and `data.json` (schema, validation, round trips): IN-6, IN-10 to IN-13, SK-3, SK-7, SK-10, SK-11, EX-1 (records and settings), IN-11. Screens exist for the daily check-in with tags and day complete, stool, nails, treatments, "no change" and allergen chips. Still open:
  - "No change" for nail entries, and for all areas at once.
  - SK-9 reminders (daily check-in, weekly nail photo) and SK-4/SK-5 photos for nails and skin.
  - LL-2 to LL-4 prompt changes, EX-3 PDF sections (check-in and digestion trends, treatments, change events, per-nail photo timeline).
  - Allergen suggestions from Open Food Facts or the LLM (only the ingredient-text helper exists).
- **Date range as local days to UTC** (EX-11 note): the core converts (`localDaysToRange`, `exportBundle({ days })`); the Data screen still exports everything and has no date picker.
- **Newest-wins merge with tombstones** (EX-12, Later): needed only once entries are editable or deletable. The daily check-in is already updated in place, and a merge cannot tell which version is newer; adds modified timestamps and a schema version bump at that point.
- **One check-in per day is kept by the use case only.** There is no database constraint, so a merge from another phone could add a second check-in for the same day; the newest is shown. Revisit with EX-12.
- **`schema_version` stays 1 in development.** Exports made before v0.3 (before the new required sections) will not import.

## Photos: to verify on the phone

- **Backup exclusion (SE-7):** photos live in the app's document folder, which iOS backs up. Expo Go gives no way to mark files as excluded from backup; revisit in the standalone build (`isExcludedFromBackup` through a config plugin or native code).
- **EXIF:** the stored JPEG is re-encoded by `expo-image-manipulator`, which should drop EXIF and location. Not verified; check one photo taken with location on.
- **Picker behaviour:** `expo-image-picker` permission prompts and multi-select in Expo Go; the permission texts in `app.json` apply to the standalone build only.
- **Memory:** import and export read photos one at a time, but the whole ZIP is held in memory (about the sum of the photos). Fine for months of daily photos; watch it on a large archive.
- **Single-photo export selection** (EX-7): the screen offers all, none, not sensitive, or a filter by area and date; picking individual photos has no screen yet (the core supports it).
