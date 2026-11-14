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

## Decided, not built yet

Requirements and flows are in `docs/requirements.md`, `docs/ux-design.md` and `docs/user-flows.md`.

**Intake**
- Barcode (IN-2, IN-8, IN-9): needs an Open Food Facts adapter and a scan screen (`expo-camera` or `expo-barcode-scanner`; check Expo Go).
- Recent and favorite meals (IN-7, v0.4 definition) with the choose and review phases: `rankSuggestions`, `mealHistory`, `alcoholHistory` and `medicationHistory` are built and tested (`core/model/suggestions.ts`); the form, favorites storage (a snapshot of description and ingredients, exported with the settings) and the suggestion settings are not.
- Allergen suggestions from Open Food Facts or the LLM (only the ingredient-text helper exists).

**Skin and health**
- "No change" for nail entries and for all areas: the core is built (`repeatNailEntry`, `repeatAllAreas`); no button yet.
- Timeline per area with photos side by side (SK-8).
- SK-2 unique names and SK-11 empty-day confirmation are built (core and the current check-in screen). The duplicate check compares the English seed name of a predefined area, not its localized one.
- SK-9 reminders: tap targets and the handled-notification marker. The reminders themselves are built (the nail reminder follows nail areas; weekday numbering is iOS, 1 = Sunday).

**Navigation (UX-1 to UX-9)**
- Built: two tabs (Today, Review) with a stack each, Settings and More pushed inside the Today stack (tab bar stays), gear icon, every entry form a modal route under `form/` with Cancel on the leading edge; Metro bundles it. Today is built (day switcher, quick-action grid, stool quick sheet, treatment shortcuts, cards for an open flare, an incomplete day and the backup, the day's log with Delete in an action sheet naming the cascade). Not built: editing a log row (the forms have no edit mode yet; the core `edit*` use cases exist), the highlighted new row, quick-action Edit mode (reorder and hide), the date jump, the unified form (Save in the header, disabled with "what is missing", swipe-down guard), action sheets elsewhere (bulk delete and replace still use `Alert`), the "Earlier…" stool form (it opens the check-in), forms defaulting to the chosen past day (only the quick logging does), the Review content (Doctor report, days list), the Settings groups Privacy and About, large titles, tab icons. Flare start and end are still on the Skin form, not in the More list.

**Editing and deleting (EN-1, EX-13)**
- Core, storage, `data.json` and merge are built (`core/usecases/entries.ts`, migration 11, the `tombstones` section of `records`). Not built: the screens (tap a log row, Edit or Delete, action sheet from `previewEntryDelete`) and the import switch in the UI. `schema_version` stays 1 while prototyping, so exports made before the `tombstones` section do not import.

**LLM (LL-5, LL-12, IN-3)**
- The meal photo estimate is not inline and editable yet and has no Cancel button (the cancel signal already reaches `estimateIngredients`).
- No keep-awake during an analysis, no running card in Review, no interrupted state with a one-tap retry.
- Done: a timeout is never retried, the analysis screen shows elapsed time and Cancel (a cancel stores nothing), and both LLM confirmations carry the billing notice.

**Export and import**
- Date range picker for the export (EX-11). The core converts local days to UTC (`localDaysToRange`, `exportBundle({ days })`) and has `sinceLastExport`, `markExported`, `backupCardDue` and the two presets (`core/usecases/backup.ts`, EX-14); the Data screen still exports everything and does not call `markExported`.
- PDF report language should default to the app language (EX-3); the Data screen still starts on English (`reportLanguage`).
- Import switch to restore entries skipped because of a tombstone (EX-10): the core is built (`applyImport(..., { restoreTombstoned })`, `preview.tombstones`), the Data screen has no switch yet. EX-14 Full backup preset.
- Single-photo selection screens for export (EX-7) and for LLM runs; the core supports both, the screens offer all, none, non-sensitive and an area and date filter.
- Newest-wins merge (EX-12, Later): needs modified timestamps and a schema version bump. Today the daily check-in and a photo's sensitive flag are edited in place, and a merge cannot tell which version is newer.

**Security**
- App lock with Face ID (SE-8): `expo-local-authentication`.

## To verify on the phone

Nothing below has run on a device.

- **Start-up:** the app starts after the SDK fix; migrations 3 to 12 on the existing database (first launch).
- **Navigation (UX-1 to UX-3):** large titles, `expo-symbols`, the sheet grabber, the JS tab bar next to the iOS floating one, `formSheet` and `modal` presentation. The design does not depend on them.
- **Photos:** camera and library permission prompts and multi-select; thumbnails; blur on sensitive photos; EXIF and location removed from a photo taken with location on (re-encoded by `expo-image-manipulator`). The permission texts in `app.json` apply to the standalone build only.
- **Export:** photos, CSV and PDF; that `expo-print` paginates a long report, renders the inline SVG and images, A4 size; AES export speed with many photos.
- **AI:** a real key, one analysis and one photo-to-ingredients call; the cost and the answer language (English and Polish).
- **Reminders:** permission prompt; a daily reminder a minute away; weekly and monthly ones by changing the day. Taps (SK-9): from the lock screen and Notification Center, with the app open, in the background and killed; check that `notification.date` exists and the form does not reopen on every launch. Also `expo-keep-awake` in Expo Go.
- **Date pickers:** check-in day, export photo filter, analysis range; the delete confirmation and "Export first".
- **Language:** Expo Go follows the device language (decided: no in-app setting, UX-7); the Polish strings appear when the device is set to Polish.
