# Open questions and gaps

Undecided items only. Decisions go into `docs/requirements.md` (canonical, edited directly) and are removed from here.

The file has four parts: undecided questions, accepted limits, decided work that is not built yet, and the phone checklist.

## Open (undecided)

- **AES export speed (EX-6).** Pure JS, verified against 7-Zip (`docs/spikes/aes-zip.md`). Photos are stored, not deflated, so only AES and the MAC cost time. V8 does about 26 MiB/s; Hermes is unmeasured. Measure an encrypted export of 30 or more photos on the phone.
- **Long LLM runs (LL-12).** The single request with a 10 minute timeout stays. If analyses time out in practice, choose between streaming (`expo/fetch`, unverified in Expo Go) and the Message Batches API.
- **Anthropic refusal fallback.** Not used (needs the beta request shape); a refusal shows a message. Revisit once a real call has worked.
- **Merge keeps local settings.** Merging into a fresh install skips the six pre-seeded predefined areas, so a renamed or archived predefined area from the file is not applied; Replace (settings) restores them. Revisit with EX-12, or adopt incoming values for areas still at factory state.
- **Polish strings.** Review at the end of the project. First draft: `app/src/i18n/pl.json`.
- **Unused template dependencies.** Prune when moving to a standalone build (reanimated, gesture-handler, expo-image, expo-glass-effect, `@expo/ui`, ...). No effect in Expo Go.

## Accepted limits

- **`expo-sqlite` wrapper is untested in code.** Storage logic is tested through the `SqlDb` seam on `node:sqlite`; the ~20-line `app/src/adapters/storage/expoSqliteDb.ts` is verified on a phone only.
- **One check-in per day is enforced by the use case only.** No database constraint, so a merge from another phone could add a second one for the same day; the newest is shown. Revisit with EX-12.
- **`schema_version` stays 1 in development.** Exports made before the current required sections will not import.
- **Export memory.** Photos are read one at a time, but the whole ZIP is held in memory (about the sum of the photos). Fine for months of daily photos; watch it on a large archive.
- **Backup exclusion of photos (SE-7).** Expo Go cannot mark files as excluded from iOS backup; revisit in a standalone build (`isExcludedFromBackup` through a config plugin or native code).

## Status of the decided work

Requirements and flows are in `docs/requirements.md`, `docs/ux-design.md` and `docs/user-flows.md`. The information architecture (two tabs, Settings behind a gear, modal forms, action sheets, the tombstone model) is built; each line below says what exists and what does not. Everything marked built is covered by tests and bundles for iOS, but none of it has run on a device (see the checklist at the end).

**Built since the IA (v0.4.2)**
- Editing and deleting (EN-1, EX-13): `core/usecases/entries.ts`, tombstones (migration 11, the `records.tombstones` section of `data.json`), merge skips and applies them, the restore switch (EX-10) in the import preview. Today's log rows open an action sheet with Edit and Delete (cascades named); `form/edit` has one small form per kind on `FormModal`. Removing a photo leaves a tombstone too. `schema_version` stays 1 while prototyping, so exports made earlier do not import.
- Navigation (UX-1 to UX-3, UX-9): Today and Review tabs with a stack each, Settings and More pushed inside Today, modal forms under `form/`, `chooseAction` and `confirmDestructive` action sheets.
- Today (UX-2, UX-5): day switcher, quick actions with an Edit mode (up and down, hide; More stays), stool quick sheet, treatment shortcuts, cards (open flare, incomplete day, backup), the day's log.
- Review (UX-1): Doctor report (EX-14), the days list, an Areas list with the per-area timeline (SK-8), AI analysis with a running card (LL-12).
- Settings (UX-6): Logging (tags, treatments), Suggestions, Privacy (app lock), Reminders, AI analysis, Data and backup (Full backup preset, custom export with a photo picker, import with the tombstone switch, Delete data last).
- Intake: two-phase meal form with suggestions and favorites (IN-7, IN-14), history tags pre-selected (IN-10), barcode scan and lookup (IN-2, IN-8, IN-9), inline editable photo estimate (IN-3), alcohol and medication suggestions with "save on tap". Preferences (favorites, suggestion settings, quick-action layout) travel in `settings.preferences`.
- Skin and health core: unique area names (SK-2), no change for nails and all areas (SK-3, core only), empty-day confirmation (SK-11), reminder taps (SK-9).
- LLM: elapsed time, Cancel, billing notice, no retry of a timeout, the run in `AnalysisRunner` (survives leaving the screen, interrupted state with retry, keep-awake).
- Security: app lock (SE-8) with `expo-local-authentication`.

**Not built**
- *Create forms.* Only editing, the meal form and the settings use `FormModal`. The skin, nail, treatment, intake, change, reaction and check-in forms still have their own Save buttons and no discard guard, and a reminder tap can replace one that has typed text. Forms other than the meal form do not default to a chosen past day (only the quick logging does). Flare start and end are on the Skin form, not in the More list.
- *Check-in (SK-7).* "Same as yesterday", and the Settings screen that switches check-in scores off, are not built.
- *No change buttons (SK-3).* The core has `repeatNailEntry` and `repeatAllAreas`; the Skin form has no button for nails or for all areas.
- *Settings.* Missing groups and screens: skin and nail areas (rename, archive; only the nail form adds areas), Favorites, the photo options of Privacy and photos, About. Delete data, Replace and bulk delete still use `Alert` and do not offer an export first.
- *Today.* The highlighted new row, the date jump, the "Earlier…" stool form (it opens the check-in), the first-run empty states beyond text.
- *Intake details.* Ingredient chips with autocomplete, favorite stars for drinks and medications in the UI (the core has them), LLM allergen suggestions, favorites for scanned products, a Polish ingredient text from the database.
- *Export and import.* A free date range picker for the report and the custom export, "export first" before Replace and Delete data, newest-wins merge (EX-12, Later: needs modified timestamps and a schema bump).
- *Review.* A side-by-side comparison of two photos, trend charts.
- *Other.* The accessibility pass (UX-8, deferred), polishing Polish strings, pruning unused template dependencies.

## To verify on the phone

Nothing below has run on a device.

- **Start-up:** the app starts after the SDK fix; migrations 3 to 12 on the existing database (first launch).
- **Navigation (UX-1 to UX-3):** large titles, `expo-symbols`, the sheet grabber, the JS tab bar next to the iOS floating one, `formSheet` and `modal` presentation. The design does not depend on them.
- **Photos:** camera and library permission prompts and multi-select; thumbnails; blur on sensitive photos; EXIF and location removed from a photo taken with location on (re-encoded by `expo-image-manipulator`). The permission texts in `app.json` apply to the standalone build only.
- **Export:** photos, CSV and PDF; that `expo-print` paginates a long report, renders the inline SVG and images, A4 size; AES export speed with many photos.
- **AI:** a real key, one analysis and one photo-to-ingredients call; the cost and the answer language (English and Polish).
- **App lock (SE-8):** the prompt (Expo Go asks for the passcode; Face ID needs a standalone build), the cover in the app switcher, locking after a minute away, a reminder tap while locked.
- **Barcode (IN-2):** camera permission and scanning a real product in Expo Go; how many of the Polish products you buy Open Food Facts knows.
- **Reminders:** permission prompt; a daily reminder a minute away; weekly and monthly ones by changing the day. Taps (SK-9): from the lock screen and Notification Center, with the app open, in the background and killed; check that `notification.date` exists and the form does not reopen on every launch. Also `expo-keep-awake` in Expo Go.
- **Date pickers:** check-in day, export photo filter, analysis range; the delete confirmation and "Export first".
- **Language:** Expo Go follows the device language (decided: no in-app setting, UX-7); the Polish strings appear when the device is set to Polish.
