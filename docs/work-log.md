# Work log

Newest entry last. One short entry per working session or meaningful step: what was done, decisions and why, what is next. No personal data.

## 2026-11-11: walking skeleton kickoff
- Read CLAUDE.md and requirements (file is `docs/Requirements-v0.1.md`, CLAUDE.md says `docs/requirements.md`; logged in open-questions).
- Checked Expo: user confirmed App Store Expo Go supports SDK 58 (RN 0.88, React 19.3, Node >= 22.13). Node 22.23.5 installed via fnm.
- Scaffolded `app/` with `create-expo-app` (`default@sdk-58`), removed the template demo screens, installed expo-sqlite, expo-secure-store, expo-sharing, expo-file-system, expo-document-picker, expo-localization, expo-crypto, datetimepicker (all via `expo install`), plus fflate, i18n-js, jest-expo, eslint-config-expo.
- Decision: one skin entry = one area at one time (SK-3), instead of a separate score table as first planned; simpler schema, same data.
- Work happens on branch `claude/jolly-hertz-b828ab` in a worktree. Main-branch commits are fine while the project is young; switch to feature branches later.

## 2026-11-11: walking skeleton built (not yet run on a phone)
- Core (`app/src/core`): model, ports (storage, key store, LLM, barcode, clock/ids/file share), use cases (IN-1 logMeal, SK-1..3 logSkinEntry and area management, export/import), `data.json` schema v1 with strict validation (EX-1, EX-10), ZIP via fflate.
- Adapters: SQLite repository over a tiny `SqlDb` seam with migrations (expo-sqlite impl for the app, `node:sqlite` impl for tests), Keychain key store (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`), share sheet + document picker.
- UI: three bare tabs (meal, skin, data), all text via i18n (en complete, pl draft, key parity tested).
- Tests: 53 passing, including one storage contract run against both the in-memory fake and SQLite, and the export/import round trip on both. `tsc`, ESLint (with core boundary rule) and `expo export --platform ios` (Metro bundle) pass; `expo-doctor` 20/20.
- Decisions: light UI theme only for now; skin entries are one-area-per-entry; predefined area names localized by id and not renamable; export UI exports all data (range is supported in core only).
- Not verified: anything on a real iPhone (screens, date picker, share sheet, picker, secure store). Next: run in Expo Go and fix what shows up; see docs/open-questions.md for gaps.

## 2026-11-12: requirements become canonical; decisions recorded
- Import tested on the phone with a temporary second database file (empty diary, no reinstall): export, then merge import restored the meal. Temporary change reverted, not committed.
- `docs/Requirements-v0.1.md` renamed to `docs/requirements.md` and is now canonical and edited directly (v0.2, with a Changelog). CLAUDE.md rule updated; `open-questions.md` now holds undecided items only.
- Decisions: export/import split into records and settings (EX-1, EX-10); `name_override` for predefined areas (SK-2); 50 MB limit kept for `data.json` only; local-day ranges converted to UTC; newest-wins merge deferred as EX-12 (Later, needs edit/delete first). No schema version change during development.
- Next: AES-in-Expo-Go spike (EX-6); implement records/settings split and `name_override`.
- Open questions triaged: AES spike soon; expo-sqlite wrapper stays untested in code (accepted); Polish review and dependency pruning deferred (end of project, standalone build).

## 2026-11-12: AES-256 ZIP spike (EX-6)
- Prototype of WinZip AES-256 (AE-2) writer and reader on `@noble/ciphers` + `@noble/hashes` + fflate, pure JS so it fits Expo Go. Verified against two 7-Zip builds in both directions, wrong password and tamper detection work. Findings and code in `docs/spikes/aes-zip.md` and `docs/spikes/aes-zip/`. App code and dependencies not changed.
- Findings recorded in requirements (EX-6 note): file names/sizes stay visible in encrypted ZIPs; weak KDF (1000 rounds) means long passphrase.
- Unknown: Hermes speed (V8 does 26 MiB/s). Next: device benchmark, then implement in `src/core/export`.

## 2026-11-12: branching policy
- Skeleton merged to main (fast-forward, b38eba1). Worktrees are no longer used; development happens in the main checkout on `dev/<task>` branches, merged to main when checks pass (CLAUDE.md updated).

## 2026-11-12: SK-2 name_override (branch dev/area-name-override)
- Predefined areas can be renamed through `nameOverride` (stored in new column `name_override`, migration 2, exported as `name_override`). Label order: override, then localized default, then the user area's own name. Removed the `predefined_area_locked` error. Tested: use cases, both repos, round trip, and in-place upgrade of a version-1 database.
- No UI to rename areas yet (core only). Next: records/settings export split.
- Fix: the name_override round trip test failed after merge because Merge skips the pre-seeded predefined areas (I merged before checking the test result; fixed on dev/fix-override-roundtrip). Test now restores with Replace and a second test documents that Merge keeps local settings; logged in open-questions (item 5). Lesson: gate merges on a green `npm run check`.

## 2026-11-12: records/settings export split (branch dev/export-records-settings)
- `data.json` now has separate `records` (meals, skin entries) and `settings` (skin areas) sections; export and import choose records, settings or both (schema_version stays 1 in development). New API: `exportBundle(deps, {range, parts})`, `applyImport(deps, parsed, {mode, parts})`, repo `importData(payload, mode)`.
- Replace settings overwrites areas by id and deletes unused user areas; replace records leaves areas alone. Entries pointing at a missing area fail before any write (`import_unknown_area`). Data screen has switches for both directions.
- 76 tests pass; typecheck, lint and the iOS Metro bundle pass. Not tried on the phone yet.
- Hook note: the Write tool was blocked by a stale worktree hook; with the user's OK I wrote files via Bash in the main checkout.
- Next: AES-256 export/import (EX-6).

## 2026-11-12: AES-256 export/import (EX-6) (branch dev/export-encryption)
- `app/src/core/export/zip.ts`: WinZip AES-256 (AE-2) writer and reader on `@noble/ciphers` + `@noble/hashes` + fflate, pure JS. `randomBytes` is a new port (expo-crypto in the app). Reader handles plain and AES ZIPs, skips entries not asked for, guards inflated size, and distinguishes missing password, wrong password and tampering.
- Export: optional password entered twice, minimum 12 characters (fixed 1000-round PBKDF2 in the format). Import: asks for the password when the file is protected. Passwords live only in component state and are cleared after use.
- Tests: 100 passing (round trips across odd sizes, wrong/missing password, tamper, fresh salts, both repos, and 7-Zip interop in both directions when 7-Zip is installed). jest transforms `@noble/*` (ESM-only). Typecheck, lint and iOS Metro bundle pass. Not tried on the phone.
- Open: Hermes speed unmeasured (open-questions item 1).

## 2026-11-13: requirements v0.3 (branch dev/requirements-v0.3)
- Requirements widened beyond food: daily check-in with digestion and a day-complete mark, daily tags, allergen tags, treatments per area, change events, immediate reactions, nail areas, longer analysis lookbacks (see the v0.3 Changelog entry for IDs).
- Decision: skin scores stay 0–10 (already in schema and tests); prefill and "no change" cut the logging effort instead of a smaller scale.
- Documents only; no code changed. Next: plan the schema and migrations for the new record types (listed in open-questions, "Decided, code not yet changed").

## 2026-11-14: nail areas (SK-10) (branch feature/nail-areas)
- Areas now have a `kind` (skin or nail); nail entries hold a stage and an extent instead of five scores. Migration 3 (default `skin`, CHECK constraints), `addArea(name, kind)`, `logNailEntry`, `listActiveAreas(kind)`; skin and nail entries refuse the wrong kind (`wrong_area_kind`).
- Design for the next record types: flat dated records are now generic. `ExtraKind` + `EXTRA_KINDS` in the model, `addRecord`/`listRecords` on the storage port, one table mapping in `adapters/storage/extraTables.ts` and one JSON codec in `core/export/extras.ts` per kind. Snapshot, ids, replace, merge and preview counts loop over the list, so a new kind is a type, a table, a mapping and a codec.
- `data.json`: `settings.skin_areas[].kind` and `records.nail_entries` are required (schema_version stays 1, older exports will not import, as noted in open-questions).
- 116 tests pass with typecheck and lint. Not tried on the phone; no UI yet (step 5 of this session's plan).
- Next: daily check-in, tags, day complete and stool (SK-7, IN-6, SK-11).

## 2026-11-14: daily check-in, tags, day complete, stool (SK-7, IN-6, SK-11) (branch feature/daily-checkin)
- New flat records: `CheckIn` (one per local day: wellbeing, stress, sleep, abdominal pain as optional 0-10, bloating, tag ids, note, `completedAt`) and `StoolEntry` (Bristol 1-7). `saveCheckIn` creates or updates the day's single record (input is the whole screen state), `setDayComplete` closes or reopens a day, `logStool`. The day is `localDay(at, tz)`, so travel and DST do not move it.
- Settings: `ListItem` lists, first one `dailyTags` with nine seeded predefined tags (stable ids, localized names, rename via `nameOverride`, like areas). Port: `upsertItem`/`listItems`, `putRecord` (upsert for records that change). Migration 4: `check_in`, `stool_entry`, `list_item`; tag ids stored as JSON text in `check_in.tags_json`.
- Import: `recordRefs` finds the areas and tags that records point at. It refuses dangling references (`import_unknown_area`, `import_unknown_item`) and keeps used user items on replace settings. `data.json`: `records.check_ins`, `records.stool_entries`, `settings.daily_tags` (all required, schema_version stays 1).
- Decision: no DB-level unique constraint on `day`; the use case keeps one per day and a merge from another phone could in theory add a second one for the same day (newest is shown). Revisit with EX-12.
- 138 tests pass with typecheck and lint. No UI yet. Next: treatments, change events, reactions, allergen tags (IN-10 to IN-13).

## 2026-11-14: treatments, change events, reactions, allergen tags (IN-10 to IN-13) (branch feature/treatments-events-reactions)
- Meals carry confirmed `allergens` (the 14 EU allergens, IN-10); `suggestAllergens(ingredients)` pre-selects tags from English and Polish ingredient words, a helper only (the user confirms; a database or LLM can add suggestions later).
- Treatments are the second list kind (`treatments`, none seeded); `applyTreatment` stores one `TreatmentApplication` for one or more areas (IN-11). `logChangeEvent` (started/stopped, product/medication/diet, IN-12). `logReaction` links symptoms (hives, mouth tingling, swelling, stomach) and an onset time to a meal and refuses an onset before the meal (IN-13). The "seek urgent care" advice is UI text and comes with the screen.
- Migration 5: `meal.allergens_json`, `treatment_application`, `change_event`, `reaction` (reaction has a foreign key to its meal, so replace-records now empties flat record tables before meals). `data.json`: `meals[].allergens`, `records.treatment_applications`, `change_events`, `reactions`, `settings.treatments`, all required.
- `recordRefs` now returns areas, items per list kind and meals; import refuses dangling references (`import_unknown_meal` added).
- 161 tests pass with typecheck and lint. No UI yet. Next: fast skin logging and local-day date ranges (SK-3, EX-11 note).

## 2026-11-14: fast skin logging and local-day ranges (SK-3, EX-11 note) (branch feature/fast-skin-logging)
- `lastSkinScores` returns the area's newest scores for prefill; `repeatSkinEntry` is the "no change" one-call save (no note, `no_previous_entry` if the area has no history). Nail entries have no "no change" yet.
- `localDaysToRange(from, to, tz)` converts local calendar days to inclusive UTC bounds (start of the first day, last millisecond of the last day), including 23- and 25-hour days at daylight saving switches. `exportBundle` takes `days: { from, to }` as an alternative to UTC `range` and uses the device timezone; bad days or a start after the end give `invalid_range`.
- 173 tests pass with typecheck and lint. No UI yet. Next: minimal screens and i18n for check-in, nails, treatments and "no change".

## 2026-11-14: minimal screens and i18n (branch feature/ui-checkin-nails-treatments)
- New tabs: **Today** (daily check-in with optional 0-10 scores, bloating, daily tag chips, note, "save and close the day" / "reopen day", stool entries by Bristol type) and **More** (add nails and log nail stage + extent, save treatments and apply one to several areas in one tap). **Skin** now starts from the area's last scores and has a "No change" button; **Meal** has allergen chips with a "suggest from ingredients" button; the **Data** screen counts the new record kinds.
- Strings: English and a Polish draft for all of it (tags, allergens, nail stages and extents, new error codes). `ERROR_CODES` is now a runtime list, so the i18n test checks every error code, predefined tag, allergen and nail value for a translation instead of a hand-kept list.
- No screens yet for change events (IN-12), reactions (IN-13, including the urgent-care advice text), editing tag or treatment lists, or nail "no change". Reminders (SK-9) are not started.
- 175 tests pass with typecheck and lint; `expo export --platform ios` bundles. **Not run in Expo Go**: layout, the new tabs, the date picker with the check-in day, and chip behavior need a look on the phone.

## 2026-11-14: session wrap-up and phone checks
- Six steps done this session (nails, check-in, treatments/events/reactions/allergens, fast skin logging and local-day ranges, screens, docs); each merged into `develop` with a green `npm run check`. `main` is untouched.
- open-questions now lists what v0.3 still needs (screens for change events and reactions, reminders, photos, LLM prompt, PDF).
- **To check on the phone (Expo Go), none of this has run there:** the Today tab (scores with "–" and clear, tag chips, "save and close the day", reopening, back-filling a past day with the date picker, stool chips); the More tab (add a nail, nail entry, save a treatment, apply it to two areas); Skin prefill and "No change"; Meal allergen chips and "suggest"; export then import of the new data on a fresh install (merge and replace); first launch on an existing database to confirm migrations 3 to 5 run.
- Next big pieces: photos (SK-4, SK-5, NF-5), then the Anthropic adapter and the analysis flow (LL-1 to LL-10), then PDF.

## 2026-11-14: alcohol and medications (IN-4, IN-5) (branch feature/alcohol-medications)
- Two more flat record kinds: `AlcoholEntry` (drink type and whole millilitres, > 0) and `MedicationEntry` (medication or supplement, name, optional free-text dose). Migration 6, JSON `records.alcohol_entries` and `records.medication_entries` (required), use cases `logAlcohol`, `logMedication`, short forms at the top of the More tab with an editable time.
- Decision: alcohol amount is millilitres of the drink, not units of pure alcohol; the analysis can derive units later if the strength is known. 179 tests pass; not tried on the phone.

## 2026-11-14: change event, reaction and list screens (IN-12, IN-13, IN-6, IN-11) (branch feature/events-reactions-screens)
- More tab now has: started/stopped (product, medication, diet) with a date, reaction after a meal (pick one of the last five meals, symptoms, onset time) with the urgent-care advice always shown above the form, and add/rename/archive/restore for daily tags and treatments. English and Polish strings; the i18n test also covers symptoms, change values and list names.
- 180 tests pass, iOS bundle builds; not tried on the phone. The urgent-care wording is my draft and should be read once by you.

## 2026-11-14: bulk delete core (SE-9) (branch feature/bulk-delete-core)
- `planDeletion` (pure) decides which ids a selection of record kinds and an optional date range removes; a meal's reactions go with it. `previewDelete` counts, `deleteData` deletes through the new atomic `deleteRecords(ids)` repo method (flat tables first, meals last). Areas and lists are never deleted. 193 tests pass. No screen yet: it needs the confirmation text, the export-first offer and, later, photos.
- Next session, in this order: (1) photos SK-4/SK-5/NF-5 with a short Expo Go spike, plus the bulk delete screen and photo cleanup; (2) Anthropic adapter, key screen and LL-1 photo to ingredients; (3) analysis flow LL-2 to LL-8 with the confirmation screen; (4) PDF and CSV export; (5) reminders SK-9.

## 2026-11-14: photos, bulk delete screen, export and import with photos (branch feature/photos-core)
- **Photos (SK-4, SK-5, NF-5):** `Photo` is a flat record (entry kind and id, sensitive flag, store key); `PhotoStore` port with an Expo adapter (private document folder, long edge 1600 px, JPEG 0.7 via `expo-image-manipulator`, which also drops EXIF) and a picker adapter (`expo-image-picker`, camera and library). Use cases `addPhoto` (sensitive starts from the area default), `setPhotoSensitive`, `removePhoto`, `listPhotos`; a `PhotoStrip` under every recent skin and nail entry blurs sensitive photos until tapped. Migration 7.
- **SE-9 screen:** the Data tab deletes by group (food and intake, skin and nails, check-ins) and optional date range, shows counts, offers "Export first", then deletes. Deleting entries removes their photos and files; deleting a meal removes its reactions.
- **EX-2, EX-7, EX-8:** export includes `photos/` named `YYYY-MM-DD_<label>_NN.jpg` (local day; predefined area short id, `nail`, `skin`, or `private` for sensitive photos, so names reveal little), stored without compression in plain and AES ZIPs (7-Zip opens them). Selection: not sensitive (default), all, none, or a filter by area and date range with sensitive photos opt-in; `data.json` lists only photos that are in the bundle. A photo is exported when its entry is in the chosen range.
- **Import:** photo bytes are copied into private storage one at a time before the records are written; any failure removes what was copied (`import_missing_photo`), merge skips duplicate photos without storing their files, replace records removes the old files. Photo paths must be plain `photos/<name>`; import refuses records that point at entries that will not exist (`import_unknown_entry`, and replace no longer counts entries it is about to wipe).
- 240 tests pass (typecheck, lint, 7-Zip interop); iOS bundle builds. Not tried on the phone: camera, library picking, thumbnails, blur, an export with photos.

## 2026-11-14: Anthropic adapter, key and model settings, photo to ingredients (SE-2 to SE-5, LL-1, LL-9, LL-10, IN-3) (branch feature/anthropic-adapter)
- **LL-10 design:** one provider-neutral port, `LlmProvider.completeJson({ system, user, images, schema, maxTokens }) → { text, model }`. Prompts (`core/llm/prompts.ts`, versioned) and answer validation (`core/llm/parse.ts`) live in the core, so the Anthropic adapter (`adapters/llm/anthropicProvider.ts`, official `@anthropic-ai/sdk` 1.8, JSON-schema output format) only sends one request. `Deps` gained `keys` (Keychain), `settings` (new `app_setting` table, migration 8) and `llmFor`.
- **Key and model:** Data tab, "AI settings": paste the key (kept only in the Keychain, never shown again, rotate or delete), model name setting (default `claude-opus-5-5`, empty restores it; a Sonnet is cheaper and likely enough, your call).
- **IN-3:** Meal tab "Suggest ingredients from a photo": camera or library, a confirmation that the photo is sent, the photo is re-encoded to 1024 px JPEG (EXIF dropped) and not stored, then the answer fills the editable ingredient list and allergen chips; nothing is saved until you press Save.
- **LL-8:** every provider failure is mapped to a code with a message (invalid key, rate limit, no network, billing or spend limit, unknown model, refusal, unreadable answer); none includes the key or request.
- Decision: no server-side refusal fallback (needs a beta request shape I cannot test without a key); a refusal shows "the model declined". Revisit once a real call works.
- 257 tests pass (the SDK's error classes are used in the tests), iOS bundle builds. **Not run with a real key**: nothing has called the API yet.

## 2026-11-14: AI analysis (LL-2 to LL-8, LL-11, EX-4 data) (branch feature/analysis-flow)
- **Input (`core/llm/analysisInput.ts`):** the diary as one timeline by local day with exact local times (meals with allergens, alcohol, medication, treatments by name, change events, stool, skin scores by area, nails, reactions linked to their meal, daily check-in with tag names and a complete / not complete flag). Every calendar day of the period appears, also empty ones. Meals, skin and other records are sent only for the period; check-ins, change events and medication also for the 21 days before it (marked as context) for the lookbacks. Precomputed ingredient and allergen frequency tables give the share of days with meals each was eaten on, so "eaten on most days" is visible (LL-4).
- **Prompt (`analysisPrompt.ts`, version `analysis-1`):** hypotheses only, never diagnosis; same day, 24/48/72 h and 7/21 day windows; treatments as confounders; incomplete days counted and discounted; says when data cannot answer; order and lag of flare, digestion and nails; answer language follows the app (LL-11). Schema allows strength `weak` or `moderate` only, validated on arrival (`analysisResultFromJson`).
- **Flow:** `prepareAnalysis` builds the exact request without any network call (counts by kind, complete days, lookback days, photos with labels and sensitive marks, model, size); `runAnalysis` sends that same request and stores the answer as an `Analysis` record (run date, local days, model reported by the provider, prompt version, language, counts, result). Nothing is stored unless the answer is complete and valid (LL-8). Photos are off unless chosen by id, at most 20, sensitive ones only when chosen (LL-6). Analyses are a record kind (migration 9), travel in `data.json` (`records.analyses`, EX-4) and have their own delete group.
- **Screen:** Data tab, "AI analysis of my diary": date range, optional photos, a confirmation alert listing exactly what leaves the phone, then the result with the AI-generated and tentative notice, plus earlier analyses.
- 295 tests pass; not run against the real API. Not built: SK-6 flare markers (so the analysis infers flares from the scores), refusal fallback.

## 2026-11-14: flare markers, CSV and PDF report (SK-6, EX-3, EX-4, EX-5, EX-8) (branch feature/pdf-csv-export)
- **SK-6:** `FlareMarker` (start or end per area, separate from the scores), `markFlare` (a start needs no open flare, an end needs one), `openFlareAreas`; buttons on the Skin tab; markers are in `data.json`, the analysis timeline, the PDF and the skin delete group. Migration 10.
- **EX-5:** optional `csv/<section>.csv`, one per section of `data.json` (UTF-8, CRLF, lists joined with `;`, text cells that start with `= + - @` get a leading apostrophe against spreadsheet formulas).
- **EX-3, EX-4, EX-8:** optional `report.pdf` in English or Polish, independent of the app language (`tIn`). The core builds escaped HTML (`core/export/report.ts`); `expo-print` renders it (A4). Sections: flares, skin trend per area with a severity sparkline, nails, first and latest photo per skin area and a photo timeline per nail, check-ins, stool, treatments, change events, medication, meals and drinks, reactions, then AI analyses in their own page-broken section with a warning that they are AI-generated and tentative. Photos in the PDF are exactly the exported photo selection (small 500 px copies); a test checks that sensitive photos stay out by default.
- Every text key the report uses is checked to exist in both languages. 310 tests; iOS bundle builds. **Not verified on the phone:** that `printToFileAsync` paginates a long HTML report on iOS and renders the SVG and images; open-questions lists it.

## 2026-11-14: fix: app crashed at start-up (branch fix/anthropic-fetch-adapter)
- **Bug (found on the phone):** `TypeError: Cannot read property 'BetaToolRunner' of undefined` from `@anthropic-ai/sdk`. The SDK's ESM build has a circular import between its beta modules that Metro cannot evaluate, so the whole app failed to start; the "missing default export" warnings for every route were a side effect of the crashed `_layout`. Jest runs CommonJS and `expo export` only bundles, so neither caught it.
- **Fix:** the Anthropic adapter now uses `fetch` against the Messages API (one POST, `x-api-key` header, JSON-schema answer format, two retries on 429, 5xx and lost connections, 10 minute timeout, error codes by status and `error.type`, the key never in an error). The SDK dependency is removed. This is the documented raw-HTTP shape; the SDK is the default only where it works.
- **Safeguards added:** all pure-JS modules (core, SQLite repo, ZIP and AES, the adapter) were bundled with Metro in dev and release mode and loaded in a Node VM: 48 modules load. Date helpers no longer depend on a locale's date format (Hermes), CSV bytes use `fflate` instead of `TextEncoder`, and a test upgrades a database left at every earlier schema version to exactly the fresh schema.
- 321 tests pass. The UI itself still needs a run on the phone; see "to check on the phone".

## 2026-11-14: UI smoke and flow tests (branch feature/ui-smoke-tests)
- Why: the start-up crash passed 295 tests because none of them loaded a screen. `test/ui/screens.test.tsx` renders every route with React (`react-test-renderer`, dev dependency) against in-memory services and the real screens, components, i18n and use cases; only native modules and the router are replaced.
- It checks that each route has a default export and shows its title, and taps through: logging a meal, the daily check-in (save, close the day, reopen), "No change" and flare start/end on the skin screen, adding a nail and a treatment, saving the key (cleared from the field, never shown), export to the share sheet, export with CSV and the PDF report, an analysis (review shows the counts and sends nothing, send stores and shows the result), and a failed analysis (message, nothing stored). No React warnings are printed.
- Limits: native behaviour (camera, picker, share sheet, PDF printing, Keychain, the real date pickers) is still mocked, so it needs the phone.

## 2026-11-14: reminders (SK-9, monthly backup reminder) (branch feature/reminders)
- Ports: `Notifier` (permission, replace all scheduled reminders). Adapter: `expo-notifications` (daily, weekly and monthly calendar triggers, banner while the app is open, no sound or badge). Core `reminders.ts`: settings stored in the device settings table (off by default), validated (time, weekday 1 to 7, day of month 1 to 28), the weekly nail reminder is planned only while an active nail area exists, switching one on asks for permission and refusing saves nothing (`notifications_denied`). Texts come from the translations and never contain entries.
- UI: Reminders section on the More tab (switch, time, weekday and day chips). The schedule is re-applied at start-up (`ReminderSync` in the root layout, covers language changes) and after adding a nail area.
- `expo` and `expo-sqlite` moved to the SDK 58 patch versions `expo-doctor` asked for; doctor 20/20. 348 tests pass; iOS bundle builds.

## 2026-11-14: UX information architecture and HIG audit (branch feature/ux-information-architecture)
- **Why:** the screens carried too much, there was no start screen or Settings, and repeated input (meals, ingredients) was slow. Design only; no code changed.
- **Done:** requirements v0.4 (IN-7 rewritten, new IN-14, EN-1, EX-13, UX-1 to UX-9, several clarifications; see its Changelog), new `docs/ux-design.md` (screen map, density rules, suggestion engine, tombstones, HIG audit), open-questions updated.
- **Decisions:** two tabs (Today, Review) with Settings behind a gear icon; modal forms with Cancel and Save; suggestions from the diary's own history, a chosen meal fills an editable form with the latest ingredients; deletion markers (tombstones) designed in now, bulk delete leaves none, newest-wins merge stays Later; preferences travel in the export's settings part and the API key never; a locally suggested allergen tag counts as confirmed when visible and pre-selected; no in-app language setting (Expo Go and the standalone build follow the device language).
- **HIG audit:** the first design broke seven points (Settings as a tab, a timed undo toast, nested modals, unconfirmed discard, gesture-only actions, an in-app language switch, missing accessibility rules); all fixed in the design. HIG pages for buttons, pickers, toggles, materials and VoiceOver were not read.
- **Follow-up decisions (v0.4.1):** the PDF report language defaults to the app language; bulk delete keeps leaving no tombstones (so a wipe can be restored), and a single entry deleted by mistake is restored through a new merge-import switch (EX-10); the accessibility pass is deferred and not planned unless the app is ever distributed (UX-8 is Later). Export and import already offer records, settings or both on the Data screen.
- **Next:** implement in small steps: EN-1 with tombstones (core, storage, `data.json`, merge), the suggestion function with tests (IN-14), then the Today screen and navigation.

## 2026-11-14: user flows and edge cases (branch feature/ux-information-architecture)
- Added `docs/user-flows.md` (daily flows, review and backup flows, waiting for the LLM, notification taps, edge cases) and requirements v0.4.2 (LL-12, EX-14; IN-3, IN-7, IN-14, LL-5, SK-2, SK-9, SK-11, EN-1, UX-2, UX-3 changed). Design only; no code changed.
- **Decisions:** the meal form has a choose phase and a review phase (replaces the earlier "hide suggestions after an edit" idea); the LLM ingredient estimate is editable and never overwrites typed text; every LLM confirmation says the call is billed separately; waits show elapsed time with Cancel and a timeout is never retried; reminder taps open their target; Full backup is a separate preset that includes all photos; cascade deletes, unique area names and the empty-day confirmation are accepted.
- **Found in the code:** the Anthropic adapter retries a timed-out request up to twice (up to about 30 minutes with no way to cancel) and the analysis screen has no Cancel.
- **Next:** EN-1 with tombstones (core, storage, `data.json`, merge), then the suggestion function with tests, then the Today screen and navigation.

## 2026-11-14: LL-12 and LL-5 adapter and analysis screen (branch feature/llm-cancel-billing)
- **Done:** a timed-out Anthropic request (client timeout, 504 or `timeout_error`) is never retried; connection errors and 408, 409, 429 and 5xx other than 504 are retried at most twice, with a pause that Cancel can interrupt. The analysis screen shows elapsed time and a Cancel button; a cancel stores nothing and shows a note, not an error. The analysis and meal-photo confirmations say Anthropic bills the call separately and a Claude subscription does not cover it (English and Polish). New error codes `llm_cancelled` and `llm_timeout`. Tests for each case; typecheck, lint and 353 tests pass.
- **Still open under LL-12:** inline photo estimate with Cancel, keep-awake, running card in Review, interrupted state with retry (see open-questions).
- **Requirements text:** LL-12 now lists the exact retried statuses.

## 2026-11-14: tidy open-questions (branch feature/tidy-open-questions)
- **Done:** rewrote `docs/open-questions.md` into four parts (open, accepted limits, decided and not built, phone checklist). Removed the duplicated "Accepted" and "Decided" sections, dropped items that are built (reminders, photos, PDF sections, LLM prompt changes) and grouped the remaining work by area. Items are no longer numbered, so older work-log mentions of "item 1" or "item 5" mean the AES speed and merge-keeps-settings entries.
- **Next:** phone check, then the remaining work in that file.

## 2026-11-14: EN-1 and EX-13 core, storage, data.json and merge (branch feature/en1-tombstones)
- **Done:** a `Tombstone` (id, kind, deletion time) kept apart from `Records`; `putMeal`, `putSkinEntry`, `deleteWithTombstones` and `listTombstones` on the repository, with migration 11 and contract tests for both adapters. New `core/usecases/entries.ts`: edit use cases for every kind (they reuse the `log*` validation and keep the id and the original time), the edit rules (meal not after its reaction, check-in one per day, flare start before end and no overlap) and `deleteEntry` / `previewEntryDelete` with cascades (meal to reactions, entry to photos and files, flare start to its end; an end alone reopens the flare). Every cascaded id gets its own tombstone, so an older backup cannot bring back a child of a deleted parent. `data.json` has `records.tombstones` (required); merge skips tombstoned ids and their children, applies incoming tombstones to local entries, and `restoreTombstoned` brings back entries only this phone had a tombstone for; replace takes the file as it is. Bulk delete (SE-9) still leaves none. Four new error codes (English and Polish). Typecheck, lint and 403 tests pass.
- **Decisions:** `schema_version` stays 1 (prototyping), so exports made before this step do not import and there is no compatibility code. Tombstones are exported whatever the date range, because they are small and a merge elsewhere needs them.
- **Next:** A2 small core rules (unique area names, no-change for nails and all areas, empty-day confirmation, `rankSuggestions`, export presets), then the navigation shell and the Today screen with edit and delete.

## 2026-11-14: core rules from the IA (branch feature/ia-core-rules)
- **Done:** SK-2 duplicate active area names are refused without regard to case (add, rename, reset, unarchive; new code `duplicate_area_name`). SK-3 `repeatNailEntry` and `repeatAllAreas` ("no change for all": one time for every active area with an earlier entry, the rest listed as needing a first entry). SK-11 closing a day with no meals throws `day_has_no_meals` unless `confirmEmptyDay` is set, and the current check-in screen asks before closing. IN-14 pure `rankSuggestions` (favorites, frequent in the window, recent; typing filters the whole history) with history adapters for meals, alcohol and medication. EX-11 and EX-14: `markExported`, `sinceLastExport`, `backupCardDue` (7 days) and `presetOptions` for the Doctor report and the Full backup. 421 tests pass.
- **Not done:** nothing here has a UI yet except the empty-day confirmation; favorites storage and the suggestion settings.
- **Next:** the navigation shell (Today and Review tabs, Settings stack, modal forms, action sheets).

## 2026-11-14: navigation shell (branch feature/ia-navigation)
- **Done:** the six flat tabs became the IA's shape. Routes: root stack with `(tabs)` and a `form/*` modal group; two tabs, Today and Review, each with its own stack; Settings (Logging, Reminders, AI analysis, Data and backup) and More pushed inside the Today stack so the tab bar stays; gear icon on Today. Screen code moved from `src/app` to `src/screens` (route files are one-line re-exports; Expo wants non-route code outside `src/app`). The Data screen lost the AI settings and the analysis button (Settings and Review own them); Delete data stays last. UI tests now mount the route files, plus new tests for the quick actions, the More list and Settings rows, that every screen a layout declares has a route file, and that titles stay under 15 characters. 435 tests pass and `expo export --platform ios` bundles.
- **Trade-off:** the forms keep their own Save buttons for now; the unified `FormModal` (header Save, disabled state, swipe-down guard) comes with the Today step because it touches every form. Not verified on a phone: modal presentation, header buttons and the gear glyph.
- **Next:** Today (day switcher, log with edit and delete from EN-1, treatment shortcuts, cards, stool sheet) and the action-sheet helper.

## 2026-11-14: Today screen (branch feature/ia-today)
- **Done:** core `dayLog` (a local day's entries across all kinds, each with its record), `dayStatus`, `treatmentShortcuts` (used twice, at most 3, no archived items) and `atOnDay` (current clock time on a chosen past day). The Today screen: day switcher (no future days), quick-action grid with a stool quick sheet (two taps), treatment shortcuts locked for 3 seconds after a tap, cards (open flare with End flare, day not complete or complete with Reopen, no export or older than 7 days) and the day's log. Tapping a row opens an action sheet (`confirmDestructive`: destructive first, Cancel last) that names what goes with the entry and calls `deleteEntry`, which leaves the tombstones. New i18n groups `day`, `log`, `cards` in English and Polish. 448 tests pass and the iOS bundle builds.
- **Not done:** edit from a log row (needs edit mode in each form), highlight of a new row, quick-action Edit mode, date jump.
- **Next:** edit mode for the forms (one form per kind opens with a record and calls the `edit*` use cases), with the unified `FormModal`; then Review and Settings content.

## 2026-11-14: edit entries from the log (branch feature/ia-edit-forms)
- **Done:** tapping a log row opens one action sheet with Edit and Delete (Cancel last; the sheet names what a delete takes along). New `form/edit` route: one compact form per kind (meal, skin, nail, check-in, stool, treatment, change, reaction, alcohol, medication, flare marker) that loads the record with `getEntry` and saves through the matching `edit*` use case, so the id, the original time and the edit rules stay. `FormModal` is the unified modal body: Cancel leading, Save trailing in the header, Save disabled with a line saying what is missing, Discard Changes sheet when something changed, swipe-down off while dirty. `chooseAction` is the general action-sheet helper. Chips got accessibility labels. A test opens and saves every kind unchanged. 453 tests pass, iOS bundle builds.
- **Not verified on a phone:** header buttons set through `Stack.Screen` inside the screen, `gestureEnabled` while dirty.
- **Next:** Review (Doctor report, days list), then Settings content (Full backup, import tombstone switch, Delete data with an action sheet), then the meal choose and review phases.

## 2026-11-14: Full backup, import switch and Review (branch feature/ia-backup-review)
- **Done:** Data and backup has a Full backup button on top (records, settings, every photo, optional password), the custom export below it, `markExported` after every successful share, the report language defaulting to the app language, the tombstone lines and restore switch in the import preview, and Replace asking in an action sheet. Review has the Doctor report (period chips with "since last export" as the default after an export, counts, sensitive photos off by default, share) and a days list that opens a day on Today through a `day` route parameter. Core: `daysWithEntries`, `reportPreview`. 464 tests pass, iOS bundle builds.
- **Next:** the meal form's choose and review phases with suggestions (IN-7, IN-14), then phase B (reminder taps, LL-12 rest, barcode, timeline, photo selection screens, app lock).

## 2026-11-14: preferences in storage and export (branch feature/ia-preferences)
- **Done:** `Preferences` (favorite meals, drinks and medications as snapshots; suggestion settings; quick-action order and hidden list), a one-row `preference` table (migration 12), `getPreferences` and `setPreferences` on the repository, `settings.preferences` in `data.json` (required, validated; CSV skips it), import rules from EX-10 (merge keeps local ones once any are stored, replace overwrites, records-only import leaves them). Use cases: validated suggestion settings, favorite toggles, refresh of a favorite when the meal is saved again, move and hide quick actions (More cannot be hidden). 480 tests pass. `schema_version` stays 1.
- **Next:** the meal form with the choose and review phases, the Suggestions settings screen and the quick-action Edit mode on Today.

## 2026-11-14: meal form with suggestions (branch feature/ia-meal-flow)
- **Done:** the meal form is two phases on the unified `FormModal`: choose (typed description filters the whole history; favorites, frequent and recent above; hints star, count and age) and review (editable description, ingredients, allergen tags, time, note). A pick fills the review with the latest use's ingredients and tags (pre-selected, so confirmed under IN-10) and never saves; "Change meal" asks first only after an edit; a star keeps a favorite snapshot. The photo estimate now adds names to the list instead of replacing it and leaves LLM allergen tags unselected. A meal opened for a past day gets the current clock time on that day. New Suggestions settings screen, quick-action Edit mode on Today, and alcohol and medication suggestions with save on tap. 491 tests pass, iOS bundle builds.
- **Next:** phase B: reminder taps (SK-9), the rest of LL-12 and the inline photo estimate (IN-3), barcode (IN-2), the per-area timeline (SK-8), photo selection screens (EX-7), app lock (SE-8).

## 2026-11-14: reminder taps (branch feature/reminder-taps)
- **Done:** SK-9 taps. Scheduled reminders carry `data.target` (their own id from the fixed list). `Notifier.onTap` (expo adapter: the response that launched the app plus a listener, clearing the stored response after the handler runs). `resolveReminderTap` returns the check-in form for the delivery day (just Today when that day is complete), the nail form (just Today without nail areas) or Data and backup, and nothing for an unknown target, a repeat tap or while a `FormModal` form has unsaved changes; a tap is marked handled even when it did nothing. The root layout listens once the navigator is ready. The check-in form opens on a `day` parameter. 500 tests pass, iOS bundle builds.
- **To verify on the phone:** the `notification.date` unit (seconds or milliseconds are both accepted), taps from the lock screen and Notification Center with the app open, in the background and killed, and that the form does not reopen at every launch.
- **Next:** the rest of LL-12 (keep-awake, running card in Review, interrupted state) and the inline photo estimate (IN-3).

## 2026-11-14: analysis running state (branch feature/llm-running-state)
- **Done:** LL-12. `AnalysisRunner` (core, platform-free) owns the one run: idle, running, ready, cancelled, failed and interrupted, with subscribe, cancel, retry and dismiss. It lives in the composition root, so leaving the Analysis screen does not stop the run; the screen reads it with `useAnalysisRun`. Review shows a card for a running, ready, interrupted or failed run. The root layout keeps the screen awake while a run goes (new dependency `expo-keep-awake`, installed with `expo install`) and calls `markBackgrounded` when the app is left, so a connection failure after that is "interrupted, nothing saved" with a one-tap retry. Leaving the Analysis screen clears a finished card. 509 tests pass, iOS bundle builds.
- **To verify on the phone:** `expo-keep-awake` in Expo Go, and that a request survives or fails cleanly when the app is backgrounded.
- **Next:** the inline, editable photo estimate with Cancel after 30 seconds (IN-3), then barcode.

## 2026-11-14: inline photo estimate (branch feature/inline-photo-estimate)
- **Done:** IN-3 and the meal part of LL-12. After the billing confirmation the estimate runs inline in the review phase: the form stays editable, "still working" and a Cancel button appear after 30 seconds, and the answer is a banner with the suggested names (Add all, pick and Add selected, Dismiss). Added names become ordinary rows (`addIngredients` skips repeats and never touches what was typed); LLM allergen tags stay unselected. Cancel, a failure (with retry), saving and leaving the form all store nothing and abort the request. 515 tests pass, iOS bundle builds.
- **Next:** barcode lookup (IN-2, IN-8, IN-9).

## 2026-11-14: barcode lookup (branch feature/barcode)
- **Done:** IN-2, IN-8, IN-9. Pure model (`core/model/barcode.ts`): check-digit validation, in-store detection (prefix 2), ingredient-text parsing, Open Food Facts allergen tags to the 14 EU allergens. `BarcodeSource` port now returns typed allergens; Open Food Facts adapter (v2, `fields=` limited, 404 with status 0 is "not found", other failures `barcode_lookup_failed`; checked against one real public product). `lookupProduct` use case. The meal form has a scan phase (`BarcodeScanner` with `expo-camera`, permission explanation and settings link, one report per code) next to a typed-code field; a found product fills the review form, its allergens stay suggestions until the user selects them (IN-10), an in-store code asks first, and an unknown, incomplete or unreachable product leaves the form to manual entry. `expo-camera` installed with `expo install`; the camera permission text in `app.json` now covers scanning. 534 tests pass, iOS bundle builds.
- **To verify on the phone:** scanning in Expo Go, the permission prompt, and Open Food Facts coverage of Polish products.
- **Next:** the per-area timeline (SK-8), photo selection screens (EX-7), app lock (SE-8).

## 2026-11-14: area timeline (branch feature/area-timeline)
- **Done:** SK-8. `areaTimeline` groups an area's skin and nail entries, their photos and its flare markers by the entry's own local day, newest first; `areasWithEntries` lists the areas with history (archived ones too). Review has an Areas list and each area opens the timeline screen (scores or nail stage beside photos, blurred sensitive photos, notes). Also fixed: removing a photo now leaves a tombstone (EX-13), and the photo removal asks in an action sheet (UX-9). 540 tests pass, iOS bundle builds.
- **Next:** photo selection screens for export and LLM runs (EX-7), then the app lock (SE-8).

## 2026-11-14: single-photo selection for exports (branch feature/custom-photo-selection)
- **Done:** EX-7. The photo selection of the custom export gained a "Pick photos" mode: every photo is listed with its area and time (sensitive ones marked), and only the picked ones go into the ZIP and the PDF (the core's `custom` mode already existed). A sensitive photo is included only when it is picked. 541 tests pass.
- **Next:** the app lock (SE-8).

## 2026-11-14: app lock (branch feature/app-lock)
- **Done:** SE-8. `Authenticator` port (Face ID or the device passcode; `expo-local-authentication`, installed with `expo install`, plugin text in `app.json`), `AppLock` in the core (off by default, a setting that is not exported; locked at a cold start, after 60 seconds in the background; switching it on or off needs the prompt; a device with no passcode refuses; `whenUnlocked` for reminder taps). The root layout shows a cover while the app is locked or not in the foreground, so the app switcher never shows the diary, and prompts once when it comes back locked, with an Unlock button after a cancel. Settings has a Privacy row with the switch. 553 tests pass, iOS bundle builds.
- **To verify on the phone:** the prompt, the cover in the app switcher, and Face ID in a standalone build (Expo Go asks for the passcode).
- **Next:** reconcile the requirement and flow documents with what is built, and list what is left.

## 2026-11-14: documents reconciled with the build (branch feature/docs-ia-status)
- **Done:** `docs/open-questions.md` now has a "Status of the decided work" section (what is built since the IA, and an explicit list of what is not), the phone checklist gained the app lock and barcode items, `ux-design.md` and `user-flows.md` say they are built, requirements v0.4.3 records three clarifications (in-store code prefixes, tombstones for cascaded records and removed photos, `schema_version` policy).
- **Left:** see "Not built" in `docs/open-questions.md`; the biggest piece is moving the remaining create forms onto `FormModal`, then a phone check of everything.

## 2026-11-14: create forms on the unified modal (branch feature/forms-on-formmodal)
- **Done:** the skin, nail, treatment, change, reaction, alcohol, medication and check-in forms, plus a new stool form, now use `FormModal`: Cancel and Save in the header, Save disabled with a line saying what is missing, Discard Changes when something changed, swipe-down guarded, and a `day` route parameter that gives a new entry the current clock time on a past day (`useFormTime`; Today passes it from a past day). `FormModal.onSave` may return false to stay open (used when a confirmation is declined). Alcohol and medication are separate forms and More lists them as two rows; a suggestion tap with "save on tap" closes the form. The check-in has "Same as yesterday" (explicit) and a "Mark day complete" switch, and asks before closing an empty day; the quick sheet's "Earlier…" opens the stool form. The Skin form has "No change for all areas" and the nail form "No change". Photos of skin and nail entries are added from the entry's edit form, since the recent lists are gone. 563 tests pass, iOS bundle builds.
- **Left:** Settings screens for areas, favorites and check-in scores, About, "export first" before Replace and Delete data, flare start and end in More, and the phone check of everything.

## 2026-11-14: first phone run fixes (branch fix/header-inset-log-order)
- **Found on the phone:** content slid under the navigation header (Today's day switcher and quick actions, Review's first rows, the top of the modal forms), because the native header is translucent and `Screen` did not leave room for it. **Fixed:** `Screen` sets `contentInsetAdjustmentBehavior="automatic"`. The day's log now shows the newest entry first (requirements UX-2, v0.4.4). 565 tests pass.
- **Not verified on the phone:** the inset fix itself (only the prop is tested).

## 2026-11-14: drinks, label scan, models per action, Today cap (branch feature/docs-drinks-label-models)
- **Done (documents only):** requirements v0.5. All beverages are logged as drinks with an alcohol switch (IN-4, IN-10, IN-14, UX-2); a label scan reads ingredients from a photo when a barcode fails (new IN-15 and LL-13, LL-5, LL-10, LL-12); the model is chosen per LLM action with Haiku 5.5 as the default (LL-9, UX-6); Today shows the latest 8 entries with "Show all (n)", and Review's days list stays the full log (UX-2). `ux-design.md`, `user-flows.md` and `open-questions.md` follow; the open items added are the day-start setting, keeping the label photo, and whether an LLM should write report text.
- **Why:** decisions from the project chat. Barcode and photo results were already review-first, so the label scan reuses that flow.
- **Next:** decide caching of confirmed labels and meals and the provenance mark for AI-derived data, then build drinks, the model-per-action settings and the label scan on separate branches.

## 2026-11-14: sources, day start, report summary (branch feature/docs-drinks-label-models)
- **Done (documents only):** requirements v0.5 extended. Confirmed history is the cache (barcode on entries, looked up before Open Food Facts; no separate cache, no meal-photo cache, IN-2, IN-15); the source of ingredients is stored per entry and marked in the PDF and passed to the analysis (new IN-16, EX-4, LL-4); a diary day starts at a user-set hour (new NF-7, default midnight); the doctor report can open with a reviewed AI summary (new LL-14, EX-3); the label photo is discarded after the review (IN-15). Open items removed from `docs/open-questions.md` (day start, report text); "Decided in v0.5, not built" lists the work.
- **Why:** decisions from the project chat. A label scan costs well under a cent, so the cache is for speed, offline use and reuse of confirmed data, not for money.
- **Next:** build in this order on separate branches: drinks (IN-4, migration), sources and barcode on entries (IN-16, IN-2), model per action (LL-9), label scan (IN-15, LL-13), day start (NF-7), report summary (LL-14).

## 2026-11-14: drinks (branch feature/drinks)
- **Done:** IN-4, IN-10, IN-14 for drinks. `AlcoholEntry` is now `Drink` (record kind `drinks`, export key `drinks`, table `drink`, migration 13 renames the table and column, adds the alcohol flag, ingredients and allergens, and moves tombstones and drops old favorite drinks). The drink form and the edit form share `DrinkFields` (name, amount, alcohol switch, comma-separated ingredients, allergen chips); a suggestion pick fills them with the history tags pre-selected. Favorites keep the full snapshot and refresh when the drink is saved again. The report adds alcohol, ingredients and allergens columns; the analysis input carries them. 567 tests pass.
- **Next:** sources and barcode on entries (IN-16, IN-2).

## 2026-11-14: sources and barcode on entries (branch feature/entry-sources)
- **Done:** IN-16, IN-2, LL-4, EX-4. `IngredientSource` (core/model/source.ts) and `barcode` on `Meal`, `Drink` and the favorite snapshots; migration 14; `data.json` validates the source (LLM details exactly for the two AI kinds). `estimateIngredients` returns the model, time and prompt version. Editing the ingredients or tags of a filled entry marks it edited (`editMeal`, `editDrink`, and the forms against the lists as filled). `lookupProduct` checks the diary's own entries for the barcode first; the meal and drink forms show the date of that entry. 578 tests pass.
- **Trade-offs:** tags from Open Food Facts count as the source's own, so saving without selecting them marks the entry edited. A photo estimate becomes the source only on a meal that was still typed; on a scanned meal it counts as an edit.
- **Next:** model per action (LL-9).

## 2026-11-14: model per action (branch feature/model-per-action)
- **Done:** LL-9, LL-10, UX-6. `core/llm/actions.ts`, `getModel`, `setModel` and `currentProvider` take the action; the list of models comes from the adapter through `deps.llmModels`; a stored model that is no longer offered falls back to Haiku 5.5. The AI settings screen shows a chip row per action. 580 tests pass.
- **Next:** label scan (IN-15, LL-13).

## 2026-11-14: label scan (branch feature/label-scan)
- **Done:** IN-15, LL-13, LL-12, LL-5, IN-16. A label prompt (text as printed in the label's language, unreadable parts in `note`, the 14 allergen ids for declared allergens and "may contain" traces) and parser; `scanLabel` uses the `label_scan` model setting. The estimate machinery of the meal form moved into `useIngredientRun` and is shared with the drink form. The temporary photo is deleted through the new `PhotoStore.discardTemp`. Found on the way: the one-line ingredient fields split on every comma, which broke "mleko (3,2%)"; they now split outside brackets and between digits (also fixes the meal edit form). 590 tests pass.
- **To verify on the phone:** a real label photo in Polish, the 30 second Cancel, and that the cache file is gone afterwards.
- **Next:** day start (NF-7) and the Today log cap (UX-2).

## 2026-11-14: day start and Today log cap (branch feature/day-start)
- **Done:** NF-7, UX-2. `Preferences.dayStartHour` (0 to 6, exported with the settings), `DayStart` in `Deps`, and a start hour on `localDay`, `localDaysToRange` and `atOnDay`; all grouping sites use it. Logging settings has "Day starts at". `DayLog` is shared by Today (newest 8, "Show all (n)") and the new `review/day` screen; the Review days list opens that screen. 600 tests pass.
- **Trade-off:** the setting is not versioned per entry, so changing it regroups the diary (as the requirement says); a saved check-in keeps its stored day.
- **Next:** report summary (LL-14, EX-3).

## 2026-11-14: report summary (branch feature/report-summary)
- **Done:** LL-14, EX-3, EX-4, LL-9. New record kind `reportSummaries` with its table (migration 15), codec and delete group; prompt `summary-1`; `core/usecases/summary.ts`; `ReportSummaryPanel` on the Doctor report screen (billing confirmation listing what is sent, no photos, elapsed time, Cancel, review and edit, "Use in the report"); the PDF opens with the kept text under the AI label and a note when it was edited. Changing the period or the language remounts the panel (a new summary is needed) and `exportBundle` refuses a stale `summaryId`. 612 tests pass.
- **Trade-off:** the run lives in the screen, not in the `AnalysisRunner`, so leaving the screen cancels it (nothing is stored); an analysis survives that.
- **Next:** leftovers from earlier work (see "Not built" in `docs/open-questions.md`).

## 2026-11-14: known-names setting (branch feature/known-names)
- **Done:** IN-3, LL-5. A setting (off by default, Suggestions screen) lets the meal photo prompt prefer ingredient names already used in the diary; only names are sent, and the billing confirmation states how many. Prompt `ingredients-2`. 615 tests pass.
- **Next:** flare start and end in More (SK-6).

## 2026-11-14: flare start and end in More (branch feature/flare-in-more)
- **Done:** SK-6, UX-2. A flare form in More (area chips with an "open" mark, the kind follows the area, time, note, Save in the header); the Skin form lost its flare buttons. 615 tests pass.
- **Next:** favorite stars for drinks and medications (IN-14).

## 2026-11-14: favorite stars for drinks and medications (branch feature/favorite-stars)
- **Done:** IN-14. A Favorite / Remove favorite button on the drink and medication forms, using the existing `toggleFavoriteDrink` and `toggleFavoriteMedication`. 616 tests pass.
- **Next:** Settings screens (areas, favorites, check-in scores).

## 2026-11-14: settings screens (branch feature/settings-screens)
- **Done:** SK-2, SK-7, IN-14, UX-6. Settings gained "Skin and nail areas", "Favorites" and, in Logging, the four check-in score switches (`Preferences.checkInScores`, required in `data.json`). `scoresFor` keeps the stored value of a switched-off score, so nothing is lost. 622 tests pass.
- **Left in Settings:** the photo options of Privacy and photos, and About.
- **Next:** "export first" before Replace and Delete data.

## 2026-11-14: export first before Replace and Delete data (branch feature/export-first)
- **Done:** UX-6, UX-9, SE-9, EX-10. Replace and Delete data are action sheets with "Export first" (a full backup through the share sheet, then the sheet asks again); Delete data asks a second time. 625 tests pass.
- **Next:** Today date jump.

## 2026-11-14: Today date jump (branch feature/today-date-jump)
- **Done:** UX-2. Pressing the day heading on Today opens an inline date picker (future days not selectable); the test mock of the picker now records its props so tests can drive it. 626 tests pass.
- **Left (not built):** the photo options of Privacy and photos, About, the highlighted new row on Today, the "Earlier…" stool form, ingredient chips with autocomplete, LLM allergen suggestions, favorites for scanned products, a free date range picker for the report and the custom export, side-by-side photo comparison and trend charts (Review), newest-wins merge (EX-12), the accessibility pass (UX-8), Polish string review, pruning unused template dependencies. Everything since the IA, and all of v0.5, is untested on a phone.

## 2026-11-14: AI allergen suggestion (branch feature/allergen-suggestion)
- **Done:** IN-10, LL-5, LL-9. New LLM action `allergen_suggest` with its own model setting; a button on the meal and drink forms sends the ingredient names (text only) after a confirmation that lists them, and the answer only suggests tags. 632 tests pass.

## 2026-11-14: Polish ingredient text (branch feature/polish-ingredients)
- **Done:** IN-2. Open Food Facts lookups prefer `ingredients_text_pl`; a translation (product not entered in Polish) carries a warning on the meal and drink forms. 633 tests pass.
- **Next:** cache of AI allergen suggestions.

## 2026-11-14: allergen suggestion cache (branch feature/allergen-cache)
- **Done:** IN-10. The allergen prompt (`allergens-2`) answers per ingredient; each answer is saved on the phone (not exported, cleared with the AI data) so a name is asked once. The confirmation lists only the names that will be sent. 636 tests pass.

## 2026-11-14: AI marks in exports (branch feature/ai-marks)
- **Done:** IN-16, EX-4, EX-5, LL-4. Allergen tags chosen from an AI suggestion are marked (`aiTags` on the source); data.json, the meals and drinks CSV, the PDF and the analysis input all say what is AI-derived. 638 tests pass.

## 2026-11-14: photo options and About (branch feature/settings-photos-about)
- **Done:** SK-5, UX-6. Per-area "sensitive by default" switch, a photos paragraph in Privacy, and an About screen. 640 tests pass.
- **Next:** highlighted new row and the "Earlier…" stool form on Today.

## 2026-11-14: highlighted new row (branch feature/new-row-highlight)
- **Done:** UX-2. New rows on Today are tinted for 3 seconds. The "Earlier…" stool form was already built; the open-questions note was stale and is fixed. 641 tests pass.

## 2026-11-14: date range pickers (branch feature/date-range-picker)
- **Done:** EX-1, EX-11, EX-14. A free range for the Doctor report and the custom export. 643 tests pass.
- **Next:** ingredient autocomplete and favorites for scanned products.

## 2026-11-14: ingredient autocomplete (branch feature/autocomplete-scan-favorites)
- **Done:** IN-1, IN-14. Names from the diary complete what is typed in a meal row or a drink's ingredient text. Starring a scanned product already kept its barcode and source; a test now covers it. 647 tests pass.
- **Left:** Review photo comparison and trend charts.

## 2026-11-14: trend chart and photo comparison (branch feature/review-compare-trends)
- **Done:** SK-8, UX-1. The area timeline has a score chart and a two-photo comparison. 653 tests pass; the iOS bundle builds.
- **Left (not built):** first-run empty states beyond text, check-in trend charts, newest-wins merge (EX-12), the accessibility pass (UX-8), the Polish string review, pruning unused template dependencies, and the phone check of everything.

## 2026-11-14: fix crash on Today check-in (stale preferences)
- Tapping "Reopen day" / "Finish day" crashed `CheckInForm`: preferences stored before `checkInScores` existed had no such field, so `scoresOn[k]` threw.
- `SqliteRepo.getPreferences` now fills any missing setting from the defaults (nested groups too). Test added (650 total).
- Next: phone verification checklist.

## 2026-11-15: fixes from the whole-repo code review
- **Done:** a reaction edited without a new time keeps its onset (IN-13, EN-1); a backdated flare marker keeps start and end alternating (SK-6); a merge import no longer adds the file's ingredients to an existing meal that has none (EX-10); the ZIP reader bounds inflation by the declared size (EX-10); an aborted ingredient run no longer deletes the newer run's photo (LL-12); imports reject unknown timezones (EX-10); a range export leaves out reactions whose meal is outside the range (EX-2); `listMeals` reads only the ingredients in range; transactions on the Expo SQLite connection run one at a time; duplicate `viaToday` branch merged (SK-9). Regression tests added for each fix (659 tests); each fails without its fix.
- **Not done:** an exclusive SQLite transaction (needs a transaction-scoped `SqlDb`, so plain reads during an import still join it); use cases that list a whole table to find one record. Two screen tests (UX-2, UX-5 log order) already failed before these changes.

## 2026-11-15: Today stayed on yesterday after midnight
- Cause: `TodayScreen` read the clock in its render body (`deps.clock.now()`). With the React Compiler on (app.json) that call is cached because `deps` never changes, so the screen kept the day it was first rendered on until the app was reloaded. The arrow stayed disabled and the calendar fell back to "today" (UX-2, NF-7).
- Fix: the time is state, refreshed on focus, when the app returns to the foreground and every minute. Test added (the screen moves on to the new day).
- Next: check other screens that read the clock in a render body (Report, forms are remounted on open so they are fine).

## 2026-11-15: branch pruning and the develop rule
- Deleted 66 local branches already merged into `develop` (including `claude/*` ones and `main`'s ancestors kept). Removed 4 clean leftover worktrees under `.claude/worktrees`. Nothing was deleted on GitHub: `origin` only has `develop` and `main`.
- Requirements v0.5.1: `develop` is never deleted, even after a release merge into `main`.
- Next: keep pruning merged feature branches after each merge into `develop`.

## 2026-11-15: UX and requirements rework (branch feature/ux-review-v0-6)
- **Done (docs only, no application code changed):** requirements v0.6, `ux-design.md`, `user-flows.md` and `open-questions.md` updated after the first phone tests. Decided: pinned quick actions with nothing hidden (UX-2); flares derived from severity at or above a threshold, default 8 (SK-6); Routine change replaces "Started or stopped" (IN-12); regular medication and treatment with reminders, a Taken or Applied button and a quick sheet (IN-17); Daily health replaces Check-in with user-defined items, and saving it logs the day (SK-7, SK-11); slider with − and + for scores (SK-3, UX-3); photos in the Skin and Nails forms (SK-4); Settings pushed above the tabs from both tab headers, without Done (UX-1, UX-6); Review Days | Areas (UX-10); a guide (UX-11). Regular items are managed in Settings, Logging, "Regular items" (IN-17, UX-6). New IDs: IN-17, UX-10, UX-11.
- **Verified:** Apple HIG on sheets (Done pairs with Cancel or Back; complex flows are not for sheets) and on sliders (side buttons, stepper alongside). `ux-design.md` records both.
- **Next:** build in this order: score component and Daily health items (data model first), derived flares, quick-action layout and Settings placement, regular items and reminders, Review browsing, guide. Check the notification buttons on the phone before relying on them.
- **Left:** everything above is unbuilt; the old behaviour (hide model, flare markers, Mark day complete) still runs in the app.

## 2026-11-15: decisions, status column, baseline (branch feature/baseline-and-docs)
- **Done (docs):** Status column in every requirements table (Done, v0.6 change pending, Not built; update it when a task finishes). Recorded: prototyping phase, no migrations or old-data handling until the first GitHub release or a changed decision (also in CLAUDE.md); accessibility pass (UX-8) and Polish string review stay out of the plan until the user says so. Requirements v0.6.1.
- **Baseline:** `npm run check` is green, 660 tests; the two screen tests noted as failing earlier (UX-2, UX-5 log order) pass, also over repeated runs of `test/ui`.
- **Next:** v0.6 build, phase 1: score input component.

## 2026-11-15: score input (branch feature/score-input)
- **Done:** SK-3, UX-3. One `ScoreInput` (−, slider in whole steps, +, value; optional scores show "–" with Clear) replaces `ScoreStepper` and `OptionalScoreStepper` in the Skin, check-in and edit forms. `@react-native-community/slider` added with `npx expo install`. Tests in `test/ui/scoreInput.test.tsx`; 663 tests pass.
- **Phone check:** whole steps, value readable, thumb not hiding it.
- **Next:** Daily health data model (phase 2).

## 2026-11-15: Daily health (branch feature/daily-health)
- **Done:** SK-7, SK-11, IN-6 (and the data side of EX-1, EX-3, LL-2, LL-4). The record is values keyed by item id; items are a list (`dailyItems`) with score or yes/no, descriptions and archive; "Mark day complete", the Day complete card and Reopen are gone (saving logs the day, the first save of a day with no meals asks). Report, CSV, analysis input and data.json follow. New migration drops the old `check_in` table (no old-data handling, prototyping phase). 665 tests pass, iOS bundle builds.
- **Trade-off:** internal names `CheckIn`/`checkIns`/`check_in` stay (renaming touches many files for no behaviour); the UI and docs say Daily health. Polish strings added as drafts only.
- **Not built:** Daily health trend charts; the descriptions of user items are shown in Settings only.
- **Next:** derived flares (phase 3).

## 2026-11-15: derived flares (branch feature/derived-flares)
- **Done:** SK-6, EN-1, EX-13, LL-2 (and the data side of EX-1). Flares are computed from skin entries at or above a severity threshold (default 8, Settings, Logging), merged across areas, with "open at last entry". Today has one flare card that opens Review; the report, analysis input and area timeline use the derived periods. Flare markers, their table, codec, tombstones, edit form and the More row are removed. 664 tests pass, iOS bundle builds.
- **Not built:** the card opens the Review tab only; the Areas browsing change comes with Review browsing (UX-10). A range export derives flares from the entries inside the range.
- **Next:** quick-action layout and Settings placement (phase 4).

## 2026-11-15: quick actions and Settings placement (branch feature/quick-actions-settings)
- **Done:** UX-1, UX-2, UX-6, NF-2. Pinned quick actions over ten entry types with More listing the rest (subtitles, no hide), Edit mode with On Today and In More lists; Settings is a stack above the tabs with the gear on both tab headers, five groups, links updated to `/settings/data`. The Today flare card has the specified wording. 666 tests pass, iOS bundle builds.
- **Phone check:** tab bar hidden inside Settings, Back returns to the right tab.
- **Next:** routine change (IN-12), regular items (IN-17), photos in forms (SK-4), Review browsing (UX-10), guide (UX-11).

## 2026-11-15: routine change (branch feature/routine-change)
- **Done:** IN-12. Categories Product and Diet plus the user's own (a list in Settings, Logging, with descriptions), "in use now" for Stopped, "already using, date unknown" for Started; the medication category is removed. Report, analysis input, CSV and data.json follow. 670 tests pass, iOS bundle builds.
- **Next:** regular medication and treatment (IN-17) with reminders and quick sheets.

## 2026-11-15: regular medication and treatment (branch feature/regular-items)
- **Done:** IN-17, IN-5, IN-11, SK-9, UX-3, UX-5. Regular items (switch on the forms, Settings screens, quick sheets on the tiles, per-item reminders with a Taken or Applied button, hide-name, Stop, export and re-scheduling after an import). The Daily health reminder is scheduled day by day for 14 days so a day with a record is skipped. 681 tests pass, iOS bundle builds.
- **Phone check (not verified):** the action buttons in all app states (reports for old SDKs say they were unreliable; the design opens the app and logs, so it does not depend on them), a DATE trigger firing, notification categories in Expo Go.
- **Next:** photos in the Skin and Nails forms (SK-4), Review browsing (UX-10), the guide (UX-11).

## 2026-11-15: photos in the Skin and Nails forms (branch feature/photos-in-forms)
- **Done:** SK-4. A photos control in both forms, photos attached on Save, "No change" plus a photo as a photo-only update. 687 tests pass.
- **Next:** Review browsing (UX-10), then the guide (UX-11).

## 2026-11-15: Review browsing (branch feature/review-browsing)
- **Done:** UX-10. Days | Areas, a month calendar with marks, the month's days, the "Incomplete days" filter, grouped areas with the last score or stage. 691 tests pass, iOS bundle builds.
- **Process note:** the previous branch (photos in forms) was merged into `develop` while one new test still failed (it picked an area without an earlier entry). The test is fixed on this branch; nothing else was wrong. Merges now wait for a green `npm run check`.
- **Next:** the guide (UX-11).

## 2026-11-15: guide (branch feature/guide)
- **Done:** UX-11. "Where do I log…?" from More and from Settings, About; descriptions on every list item and in the Treatment form; subtitles were built with the layout editor. All v0.6 requirements are now built. 694 tests pass.
- **Cleaned:** `docs/open-questions.md` no longer lists "Decided in v0.6, not built"; stale lines about hide, flare markers and the check-in score switches are corrected.
- **Next:** the leftovers: first-run empty states, Daily health trend charts, newest-wins merge (EX-12). Then the phone checks.

## 2026-11-15: first-run states (branch feature/empty-states)
- **Done:** UX-1, UX-2. A first-run card on Today and a way back to Today from an empty Review. 696 tests pass.
- **Next:** Daily health trend charts, then newest-wins merge (EX-12).

## 2026-11-15: Daily health trends (branch feature/daily-health-trends)
- **Done:** SK-7, UX-1. A trend screen for the Daily health score items. 697 tests pass.
- **Next:** newest-wins merge (EX-12).

## 2026-11-16: requirements v0.7 (docs only, no code)
- **Done:** `docs/requirements.md` is v0.7, written in a claude.ai session and left uncommitted. New: IN-18 (medical event), SK-12 (time to relapse, derived). Changed: IN-6 (two more daily tags), IN-11 (reaction after applying, set after the fact), SK-1 and SK-5 (the intimate area becomes three areas), SK-3 (cracks flag, optional size in mm), SK-4 (time since the last treatment per photo, derived), LL-2, EX-1, EX-3, UX-2.
- **Decisions:** a fixed patch is an ordinary skin area with a size field, not a new area kind; palms are not predefined; time since treatment and time to relapse are computed by the program and passed to the LLM as numbers; no "before or after treatment" field on photos; a course ends after 7 days without an application (SK-12), one gap for all treatments.
- **Added later the same day:** IN-18 gets the kind "illness" with an optional end date; the daily tag stays for the quick yes/no.
- **Docs aligned:** `ux-design.md` and `user-flows.md` carry the v0.7 screens, flows and edge cases, marked "(v0.7)".
- **Not built:** all of the above; the Status column marks it ("Not built", "Done; v0.7 change not built").
- **Next:** commit the doc, then build in order of cost: SK-1 split, SK-3 fields, IN-11 reaction, IN-6 tags, SK-4 and SK-12 derivations, IN-18.

## 2026-11-16: phone test plan (docs only, no code)
- **Done:** `docs/phone-test-plan.md`, 85 checks in 11 sections with Pass and Notes columns, P0/P1/P2 priorities, exit criteria. Synthetic data only; the time-dependent and AI sections are last.
- **Next:** run the P0 sections (1 to 4, 7, 8) on a phone and record results in the Pass and Notes columns.

## 2026-11-16: requirements v0.8 and a bug (docs only, no code)
- **Done:** `docs/requirements.md` is v0.8. New: IN-19 (meal name estimate, text only, own source). Changed: IN-16, LL-4, LL-5, LL-9, EX-4 (name estimates), SK-8 (date jump on the area timeline), EN-1 (edit and delete from the area timeline). UX-1 is marked Bug. The Days list in Review needs no change: tapping a date already opens its day.
- **Bug recorded:** Settings has no Back button (`docs/open-questions.md`, Known bugs).
- **Next:** fix the Back button (small), then the area timeline (SK-8, EN-1), then IN-19.

## 2026-11-16: UX and flows for v0.8, and the Claude plan handoff (docs only, no code)
- **Done:** `docs/ux-design.md` and `docs/user-flows.md` describe the name estimate (IN-19), the area timeline's date jump and Edit and Delete (SK-8, EN-1), and edge cases for both. New requirements marked Later and not planned: IN-20 (fill later with AI) and LL-15 (AI pack and result import, so a stronger model on a Claude plan can analyze and fill gaps). Meal photos are out of scope for them.
- **Decisions:** a result file is imported, the model never edits `data.json`; fills wait in a "Suggestions to review" queue and never change an entry by themselves; the Settings Back bug has no UX change (it is in `docs/open-questions.md`).
- **Open:** how a Claude chat takes the pack (requirements, Open).
- **Next:** unchanged: Back button, area timeline, IN-19. IN-20 and LL-15 wait until the user says so.

## 2026-11-16: Settings Back button (branch feature/settings-back-button)
- **Done:** UX-1 bug fixed. The first Settings screen now has a Back button in its header (`ui/BackButton`): it pops the root stack, or opens Today when there is no history (a reminder tap can open `/settings/data` first). Test checks both cases and fails without the fix. The bug entry is removed from `docs/open-questions.md` and UX-1 is Done again. The test router mock gained `replace` and `canGoBack`, and the `Stack.Screen` mock keeps options per screen name.
- **Phone check:** N1 and N2 of the phone test plan, including the swipe-back gesture still working.
- **Next:** area timeline date jump and Edit/Delete (SK-8, EN-1).

## 2026-11-16: area timeline date jump and Edit/Delete (branch feature/area-timeline-jump-edit)
- **Done:** SK-8 and EN-1 (v0.8). "Go to date" on the area timeline opens an inline date picker (no future days) and scrolls to that day; with no entry it goes to the nearest earlier day, before the first entry to the oldest day, and a line says which day is shown. The target day's label is tinted. The jump is navigation: the chart and the list stay complete. The pure `resolveJumpDay` (core) decides the target. A tap on an entry line opens the day log's sheet: it is now one hook, `useEntryActions`, used by `DayLog` and the timeline (title, line naming the photos that go with it, Edit, Delete, Cancel last). Flare lines stay untappable; while comparing photos the entry lines are disabled. `Screen` takes an optional `scrollRef`.
- **Tests:** the jump rules, the picker and scroll calls (layout offsets fed in by the test), the sheet from the timeline (Edit route, Delete with tombstone and reload), compare mode.
- **Phone check (new R8, R9):** that the scroll puts the day under the translucent header and not behind it (`contentInsetAdjustmentBehavior` with `scrollTo` is the risk; the offset is `y - 8`). If it is off, the fix is one constant.
- **Next:** meal name estimate (IN-19).

## 2026-11-16: meal name estimate (branch feature/meal-name-estimate)
- **Done:** IN-19, with IN-16, LL-4, LL-5, LL-9, EX-4. New LLM action `meal_name` (own model setting, Haiku 5.5 by default), prompt `name-1`, `estimateIngredientsFromName` (text only; the sent text is trimmed and capped at 200 characters; a vague name returns no names and the model's note). The source kind `name_estimate` is the third AI source: `LLM_SOURCE_KINDS` in `core/model/source.ts` is now the one list that the validation, `data.json`, the CSV and the PDF mark read. `useIngredientRun` gained the `name` kind: the confirmation lists the exact text, the number of known names (when that setting is on) and the billing notice; it runs inline with Cancel after 30 seconds; a failure keeps the text for a one-tap retry without asking again; the result is the same editable list, tags unselected. The button shows in the meal review phase and the drink form while a description is typed. The analysis and summary prompts call a name estimate rougher than a photo estimate (`analysis-5`, `summary-4`).
- **Tests:** prompt, text tidying, model per action, no image in the request, vague name, errors; the source in export, CSV, PDF and analysis input; six UI tests (confirmation, add all keeps typed text, vague name, retry, abort, known names, drink form). The English strings are new; the Polish ones are a first draft (Polish review is not planned).
- **Phone check (new A7):** a real call from the meal and drink forms; what Haiku answers for a dish name and for "lunch".
- **Next:** v0.7 build, first the SK-1 area split.

## 2026-11-16: intimate area split (branch feature/intimate-area-split)
- **Done:** SK-1, SK-5. `PREDEFINED_AREAS` has eight areas: the single "intimate area" is now Penis (`area-penis`), Perineum and groin (`area-perineum-groin`) and Between the buttocks (`area-between-buttocks`), each sensitive by default; palms are not predefined. English names and a Polish draft. Tests that counted six predefined areas now count `PREDEFINED_AREAS.length`; a new test checks that each of the three starts its photos as sensitive.
- **Old row:** predefined areas are inserted at every start (`INSERT OR IGNORE`), so a phone that already has the app gets the three new areas on the next launch. A phone that has the old `area-intimate` row would have shown a missing translation key for it, so one plain SQL migration step (the last one) turns that row into an archived area under its stored name, keeping its entries. A new database never has it. Test: the step on a database with an old row and an entry, and a fresh database.
- **Next:** SK-3 cracks flag and optional size.

## 2026-11-16: cracks flag and size (branch feature/skin-cracks-size)
- **Done:** SK-3 (v0.7), and the parts of SK-8, EX-1, EX-3, LL-2 that carry it. A skin entry has `cracks` (yes/no) and an optional `sizeMm` (whole millimetres, 1 to 500, `invalid_size` otherwise). The area's last values prefill the Skin form and "No change" and "No change for all" carry them (`lastSkinValues`, `repeatSkinEntry`). The Skin and edit forms share `SkinExtraFields`: the switch is visible, the size sits behind a Details row that opens by itself only for an area that already has a size, and an invalid size disables Save (and a forced save throws instead of saving "no size"). Storage: one migration with CHECK constraints (old entries get no cracks and no size). `data.json` has `cracks` and `size_mm` (required, validated). The analysis input has them only when set and the prompt explains them (`analysis-6`, `summary-5`). The PDF adds a Cracks column and a Size column to an area's table only where they occur, and a size trend from two values on. The timeline and the day log say cracks and size, and the area chart offers Size where one is logged.
- **Trade-off:** size is whole millimetres, so a 12.5 mm patch is logged as 12 or 13; a fractional field is not worth the extra validation for a diameter estimated by eye. Cracks are not marked on the trend chart (the report and the line say it).
- **Tests:** core (validation, prefill, no change, edit, SQLite constraints, export and import, analysis input, timeline points, report columns), contract test on both repositories, the export round trip now includes a cracked patch, and six UI tests. Phone check F7.
- **Status column:** EX-1, EX-3 and LL-2 stay "v0.7 change not built" because other v0.7 additions (treatment reactions, time since treatment, time to relapse, medical events) are still missing from them.
- **Next:** IN-11 reaction after applying and the two IN-6 tags, then SK-4 and SK-12 derivations, then IN-18.

## 2026-11-16: treatment reaction and two daily tags (branch feature/treatment-reaction-tags)
- **Done:** IN-11 and IN-6 (v0.7). A treatment application has a `reaction` (none, mild, strong, or null for not recorded). It is set afterwards from the application's edit screen (chips, a tap on the chosen one clears it), never in the one-tap path or the quick sheets. New migration with a CHECK; `data.json` requires the key (null allowed); the analysis input has it only when recorded and the prompt says that empty is not none (`analysis-7`, `summary-6`); the PDF treatments table gets a Reaction column only when one was recorded; the log row says it. The Daily health seeds have `tag-hot-shower` and `tag-intimate-friction` (they appear on the next start through `INSERT OR IGNORE`, and a user rename of a seeded tag is not overwritten; both tested). Counts that assumed 14 seeded items follow the list.
- **Tests:** use case and validation, SQLite CHECK, analysis input, report column, import validation, the export round trip with a strong reaction, and three UI tests. Phone checks F8 and F9.
- **Next:** SK-4 (time since the last treatment per photo) and SK-12 (time to relapse).

## 2026-11-16: time since treatment and time to relapse (branch feature/time-since-treatment-relapse)
- **Done:** SK-4 and SK-12 (v0.7), with the parts of SK-8, EX-3 and LL-2 that show them. `core/model/derived.ts` holds two pure functions and nothing is stored: `sinceLastTreatment` (last application on the photo's area at or before the photo, within 7 days, with exact hours; null means "no treatment logged") and `timeToRelapse` (per skin area and treatment, courses with a gap of at most 7 days, only finished courses, the area's own next flare, other treatments in between as confounders). Photo captions on the area timeline and in the PDF; a "Time to relapse" table in the PDF; the analysis gets `time_to_relapse` and captioned photo labels, and the prompts say to use the numbers as given (`analysis-8`, `summary-7`). The as-of moment is the clock when a run is prepared, the export time in the PDF, and the end of the period in the pure builder's default.
- **Known limit:** a range export sees only what is inside the range, so a photo or flare near its start can lack the earlier data. Noted in `docs/open-questions.md`.
- **Tests:** the rules (window edge at exactly 7 days, ties, several areas, nail areas, threshold, finished versus running), the analysis input and photo notes, the timeline, the PDF, and one UI test. Phone checks F10 and F11.
- **Status column:** EX-1, EX-3 and LL-2 still wait for medical events (IN-18).
- **Next:** IN-18 medical event.

## 2026-11-16: medical events (branch feature/medical-event)
- **Done:** IN-18, which completes v0.7. `MedicalEvent` is a flat record kind with a kind (visit, test result, diagnosis, illness, other), a title (1 to 120 characters), a note and, for an illness only, an optional end day not before its start. Use cases `logMedicalEvent` and `editMedicalEvent` (an unchanged date validates the end day against its own stamp), a table with CHECKs, `data.json` `medical_events` (required), the health delete group, a day log row, an eleventh entry type `medical` listed in More, the `/form/medical` form and the edit screen on shared `MedicalFields`, two Guide rows plus a quick-yes/no row, markers on every area timeline (start day, illness end day) once the area has entries, a PDF table, and the analysis input: events as context (also from the lookback) and an `illness_day` flag set once per day when the Daily health tag or an illness event covers it (`analysis-9`, `summary-8`).
- **Tests:** rules, storage constraints, export and import validation, delete, analysis input and the illness-day rule, timeline markers, the PDF table, and five UI tests. Phone check F12.
- **Status:** IN-18, LL-2, EX-1 and EX-3 are Done, and requirements v0.8.1 says everything in v0.7 and v0.8 is built; only IN-20 and LL-15 (Later) remain.
- **Next:** IN-20 and LL-15, as asked.

## 2026-11-17: fill later with AI and the AI pack (branch feature/ai-pack-and-fill-later)
- **Done:** IN-20 and LL-15, the last of the planned work. Meals and drinks get a "fill later" mark (forms and edit screen). "Use my Claude plan" in Review writes a ZIP (`pack.json`, `INSTRUCTIONS.md`, chosen photos, a pack id) and imports a `result.json` after validating it (wrong pack, oversize, malformed, unknown ids refused; a repeated import is skipped). An analysis or report summary comes in as its own record labelled manual; fills become suggestions (Today card, "Suggestions to review", the edit screen with the same editable panel as a photo estimate, tags unselected until selected). Saving clears the mark and records a name estimate (manual). The model never edits `data.json` and an import never changes an entry. Storage: one migration step (`fill_later`, `manual` columns); `data.json` carries `fill_later` and `llm.manual` only when true; the pack state is a settings value, not exported, cleared by deleting AI results.
- **Bug found while testing:** `addIngredients` ends its list with an empty slot, so a suggestion saved untouched counted as edited; the comparison now ignores blanks.
- **Tests:** 14 core tests (marks, round trip on both repos, pack contents, parser, import, suggestions, delete) and 9 UI tests. Three older UI tests build entries "3 hours ago" and fail when the suite runs between 00:00 and 03:00 local time (they also fail without this task); not fixed here.
- **Not verified:** how a real Claude chat takes the pack (ZIP, photos, size, plan limits). Phone checks A8 to A10.
- **Next:** the phone run (`docs/phone-test-plan.md`), then fix what it finds. The three time-of-day tests need a fixed clock.

## 2026-11-19: reminder self-check (branch feature/reminder-diagnostics)
- **Problem:** the user reported that reminders never show up in Expo Go on an iPhone, with no error message. I read the reminder code, the installed `expo-notifications` 58.1.9 (trigger parsing, the iOS scheduler, the Expo Go warnings) and found no defect: triggers are valid, permission refusals already raise an alert, and iOS local notifications are supported in Expo Go. Without a device I cannot reproduce it, so the cause is open.
- **Done:** Settings, Reminders now shows the permission (allowed, not asked yet, blocked) and the number of reminders the system holds, and a "Send a test reminder" button that asks for permission and fires one notification after about 5 seconds (`Notifier.status`, `Notifier.sendTest`, use cases `reminderStatus` and `sendTestReminder`). The start-up scheduling no longer hides a failure: it logs a warning with the error message (no diary data).
- **Tests:** two core tests, one UI test; the UI test file now pins the date (midday, only `Date` is faked), because nine tests that log entries "3 hours ago" failed when the suite ran between 00:00 and 03:00 local time. This also fixes the three failures noted on 2026-11-17.
- **Next:** phone check G0. If the test banner arrives but daily reminders do not, the scheduled count and the times tell where it breaks; if the test does not arrive either, check iOS Settings for Expo Go (allowed, Focus). Send me what the status line says.

## 2026-11-19: reminder status no longer crashes the screen (branch feature/reminder-status-safe)
- **Problem:** after Fast Refresh the Reminders screen crashed with "undefined is not a function" in `reminderStatus`: the running app still held the notifier object from before the update, which has no `status`. A full reload clears it.
- **Done:** `reminderStatus` is async, so a failing notifier is a rejection the screen already ignores (the status line is just hidden). One test added.
- **Next:** reload the app fully, then phone check G0.

## 2026-11-19: reminders confirmed on the phone
- **Result:** after a full reload of Expo Go the user reported that reminders work (status line, test reminder, reminder a minute ahead). No scheduling defect was found in the code, so the earlier failure was most likely a stale session (hot reload) rather than the app logic; this is not proven. Phone check G0 passes on the iPhone; the action buttons, tap handling and other states (G-section) still need their own runs.

## 2026-11-21: Today redesign and visual design (branch feature/design-aurora-ring)
- **Done:** design work on a canvas (https://claude.ai/artifact/BVCSSjDYjDDMVcKrshmazt): several Today proposals, then the approved mix "Aurora ring" (dark aurora background, floating glass controls, a 24-hour day ring with intake and body-and-care dots) and the next screens in that style (Treatment quick sheet, Meal choose and review, More). Requirements v0.9 record it: UX-2 rewritten, new UX-12 (visual design and gestures) and UX-13 (Later, log by dragging around the ring), and changes to UX-3, UX-5, UX-11, IN-11, IN-17, IN-20 and NF-2. The one-tap treatment shortcuts move into the Treatment quick sheet; Today keeps at most 5 pins and two context pills. ux-design, user-flows and open-questions follow. Docs only, no code.
- **Next:** design boards for Skin, Daily health, Review and Settings; then build the Today redesign.

## 2026-11-21: known bugs recorded (branch feature/record-known-bugs)
- **Done:** two problems found while running the checks for the v0.9 docs are listed under "Known bugs" in `docs/open-questions.md`: the Daily health reminder mixes the process and the clock time zone (SK-9; its test fails under `TZ=UTC`), and Jest does not exit after the run. Docs only.
- **Next:** fix both before building the Today redesign.

## 2026-11-21: Save at the bottom of forms (branch feature/save-at-bottom)
- **Done:** requirements v0.9.1, UX-3: Save becomes a floating button at the bottom of every entry form, above the keyboard; the header keeps Cancel and the title. ux-design follows. Docs only.
- **Next:** the allergen display rule on the meal review (pending approval), Skin and Daily health boards.

## 2026-11-21: allergen guesses and Nails icon (branch feature/allergen-guesses-doc)
- **Done:** requirements v0.9.2. IN-10: the review phase shows ticked tags, unselected guesses that follow the ingredient list, and "+ N more"; the "Suggest from ingredients" button goes, since it replaced the selection. UX-12: the Nails icon is the Skin hand with tinted nails. user-flows and ux-design follow. Docs only.
- **Next:** Skin and Daily health boards.

## 2026-11-21: design system and reference screens (branch feature/design-system)
- **Done:** eight reference screens on the design canvas, one per pattern (Skin form, Daily health, Review Days, Area timeline, Settings, a settings detail, swipe and confirm delete, an empty state), and a Design system board with tokens and components. `docs/design-system.md` is the written spec (tokens, components, patterns, gestures, a "do not" list, how to build it in Expo). `design/canvas/` keeps a copy of the canvas files and `design/generator/` the Python script that draws the generated boards, so a later session can add matching boards. CLAUDE.md's layout lists `design/`. Docs and design files only, no app code.
- **Next:** the remaining screens follow the reference boards; then build the theme and the shared components, starting with Today.

## 2026-11-21: design checklist (branch feature/design-checklist)
- **Done:** requirements v0.9.3 (UX-4 exception for Daily health's yes/no items; "Same as yesterday" gets a copy icon on the canvas). `docs/design-system.md` lists the screens still to design, grouped, each with the reference board to copy. Docs and design files only.
- **Next:** the remaining screens (next model), then the Expo spike for the design (blur, font, ring, gestures, floating Save over the keyboard).


## 2026-11-21: known bugs fixed (branch feature/fix-known-bugs)
- **Done:** SK-9: the Daily health reminder time is now built on the clock's own time zone (`wallTimeOnDay` in `core/model/time.ts`), so the reminder and the diary-day lookup use one zone; the test passes under UTC, Europe/Warsaw, America/Los_Angeles and Asia/Tokyo. Jest now exits: the UI tests unmount every tree they create, which stops Today's one-minute timer. Both are removed from "Known bugs".
- **Next:** the Expo Go design spike (build plan task 2).

## 2026-11-21: design spike (branch feature/design-spike)
- **Done:** `app/src/app/spike.tsx` (route `/spike`) shows blur over a drifting aurora, an SVG ring with a drawing arc and a washed icon, Gabarito in three weights, a PanResponder swipe and a Save pill that rides above the keyboard. `docs/spikes/design-stack.md` lists what to check. It typechecks and bundles for iOS; it has not run on a device.
- **Decision:** gestures use `PanResponder` (gesture-handler 3 changed its API); the app uses React Native's `Animated` for motion.
- **Needs you:** the phone run, 10 minutes, list in the spike note. If blur stutters, `USE_BLUR` in `GlassSurface.tsx` falls back to a flat fill.
- **Next:** theme foundation.

## 2026-11-21: theme foundation (branch feature/theme-foundation)
- **Done:** UX-12 foundation. Installed `expo-blur`, `react-native-svg`, `@expo-google-fonts/gabarito`; `app.json` is dark. `ui/theme.ts` holds every token (control outlines at white 34 %); `ui/themed.tsx` has the app's `Text`, `TextInput` and `Switch` (Gabarito by weight, tabular figures, theme colours), and every screen now imports them. New: `Aurora`, `GlassSurface`, `Icon` (the 40 icons of the design board plus minus), `IconCircle`, `NavRow` and `NavGroup`, `SwitchRow`, `EmptyState`. Shared components (`Screen`, `Button` with the new kinds outline and dangerSolid, `Chips`, `Segmented`, `ScoreInput`, inputs) use the tokens, so all screens already show the dark glass look. The root layout loads the font behind the splash and sets a dark navigation theme. A test fails if a colour literal appears outside `theme.ts`.
- **Not done here:** `Sheet`, `ConfirmSheet`, `FloatingSave` and `FloatingTabBar` come with the tasks that use them (quick sheets, forms, Today). Native headers stay for now.
- **Next:** Today core logic.

## 2026-11-21: Today core logic (branch feature/today-core)
- **Done:** the pure logic of the Today redesign (UX-2, UX-11), with tests and no screens. `core/model/ring.ts`: dot positions on the 24 hour dial from the day start (daylight saving days included), the two tracks, merging of dots closer than 3 % of the day (about 43 minutes) into one dot at their mean, the arc up to now (today only), hour labels. `core/usecases/today.ts`: `selectPills` (fixed order flare, Daily health, backup, suggestions; at most two) and `todayContext` (first-run card replaces the pills on an empty diary; a past day has none; the Daily health pill counts from the reminder time whether or not the reminder is on, and a time before the day start belongs to the next calendar date). `core/model/search.ts`: the More search (every word, any order, no case or accents, title hits first). Pinning is limited to 5 (`too_many_pinned`, English and Polish messages).
- **Test fixed:** one UI test pinned a sixth entry type; it unpins Stool first.
- **Next:** the Today screen (ring, pills, quick actions, log rows, swipe).

## 2026-11-21: dev environment in Docker (branch feature/docker-dev)
- **Done:** the app now runs from a container: `compose.yaml` (host networking so Expo Go reaches Metro; the source is mounted; `node_modules`, the npm cache and `/tmp` (Jest and Metro caches) are named volumes), `app/Dockerfile` (Node 22 and git, runs as uid 1000) and `app/docker-entrypoint.sh` (runs `npm ci` when `package-lock.json` changes). Checked in the container: `npm run check` passes (the first run on a cold cache can time out the Today screen test, 9 s cold against the 5 s limit; the cache volume fixes later runs), the iOS bundle is served on the LAN address, an edit under `src` reaches Metro through the mount, and `expo install` writes `package.json` and the lockfile as the host user. `CLAUDE.md` Commands and the phone test plan use the container commands. No app code changed.
- **Next:** remove the host toolchain (fnm and Node, `node_modules`, the Expo and Metro caches) once the frontend session has moved to the container; this is done by hand, not by the plan.

## 2026-11-21: Today redesign (branch feature/today-redesign)
- **Done:** UX-2 and UX-12 on Today: the day ring (`DayRing`: 256 pt glass dial, intake and care tracks, merged dots with a count, the accent arc drawing in over 1.4 s, hour labels from the day start, date and entry count in the centre, swipe and faint arrows for the day, a tap on a dot opens the entry sheet, a merged dot first lists its entries), `ContextPills` (at most two, from `todayContext`), the first-run card, "Back to Today" on a past day, `QuickActions` (glass circles with icons, a long press opens the full form, More last), glass `LogRowView` rows with a swipe-left delete that asks first, the sections rising in once (`Rise`), a floating tab bar (`FloatingTabBar`; screens inside the tabs leave room under it) and the gear as a glass circle inside Today (no native header there). The treatment one-tap shortcuts are still on Today until the Treatment quick sheet takes them over (next task). "Pin to Today" is disabled at five pins. i18n: `day.entries`, `day.dot`, `day.backToToday`, `day.delete`.
- **Tests:** UI tests updated for the new texts (the pills are buttons named by their text, dates read "10 Jan"); four new ones (dots and merging, long press, pin limit, past day). The swipe gesture itself (a `PanResponder`) is not driven in a test.
- **Not verified:** how it looks and feels on the phone (blur with the aurora, the swipe against scrolling); see `docs/spikes/design-stack.md`.
- **Next:** quick sheets and More.

## 2026-11-21: quick sheets and More (branch feature/quick-sheets-more)
- **Done:** UX-3, UX-2, UX-11, UX-12. `Sheet` (floating quick sheet over a dimmed screen: 10 pt side margin, 26 pt above the bottom, slides up and fades in, closes on a tap outside or the close circle) with `SheetRow` and `SheetLabel`. The Stool, Medication and Treatment quick sheets are now sheets; the Treatment sheet lists Regular and Often used (the one-tap combinations left Today's body) and "Other or earlier…". More has a search field over entry types and the "Where do I log…?" situations (core `searchItems`), glass `NavGroup` rows with icons, the guide and an "Edit Today" row. Edit Today is its own pushed screen (`/today/edit`, Up, Down, Move to More, Pin disabled at 5 with the limit message) instead of an inline mode.
- **Not done:** the confirmation and action sheets stay the native iOS action sheet (`chooseAction`): replacing them with a floating `ConfirmSheet` means changing the many tests that drive `ActionSheetIOS`, so it waits for the review and settings task.
- **Tests:** the Today and layout tests follow the new screens; two new ones for the search and the Edit Today row.
- **Next:** forms (floating Save, modal chrome).

## 2026-11-21: forms (branch feature/forms-reskin)
- **Done:** UX-3, UX-12. Save is a floating 56 pt accent pill (`FloatingSave`) 26 pt above the bottom, or 12 pt above the keyboard; when something is missing it is the disabled look with a line above it saying what is. The form header keeps a glass Cancel and the title; the header no longer has Save. The choose phase of the meal form has no Save at all (`hideSave`, IN-7). Forms leave room under the pill (`SAVE_INSET`). Fields, chips, score rows, switches and the photo areas follow the shared components, so every form already has the glass look; the boards of the individual forms (G2, G3) come in phase 2.
- **Tests:** the 16 places that pressed Save through the header now find it in the form's tree (`lastTree`); two new tests (disabled with a missing line and no header Save; a complete form saves and closes).
- **Next:** Review, Settings and the other pushed screens.

## 2026-11-21: Review, Settings and pushed screens (branch feature/review-settings-reskin)
- **Done:** UX-12 on Review (own large title with the gear, two output cards with a status line for a running or ready analysis, glass calendar with a coral wash for flare days and an accent ring for Daily health, grouped glass rows for days and areas), Settings (grouped glass rows with icons), the glass back circle. Requirements v0.9.4: UX-2, UX-12 and the v0.9 parts of IN-11, IN-17, UX-3, UX-5, UX-11 are Done pending the phone run; `open-questions.md` follows. This closes phase 1 of `docs/build-plan.md`.
- **Next:** phase 2, the proposed additions (core logic first).
## 2026-11-21: remaining screens designed (branch feature/design-remaining-screens)
- **Done:** all six groups of "Remaining screens to design" drawn on the design canvas as 102 boards (G1 Today states, G2 entry forms, G3 meal extras, G4 Review, G5 Settings, G6 System), in one overnight run instead of group by group. An independent review of all 125 boards found 4 blocking and 13 should-fix issues; the blocking ones and most others are fixed in the generator and republished (`design/consistency-report.md`). The checklist in `docs/design-system.md` is ticked; new patterns and open decisions are under "Proposed additions (needs approval)". `design/generator/` has the new scripts (`group1.py` to `group6.py`, `lib.py`, `build.py`, `lint.py`, `contrast.py`), `design/canvas/` the boards and `canvas.json`.
- **Needs you:** the "Proposed additions" list (chart range switch for SK-7 and SK-8 first); no requirement was changed.
- **Next:** approve or change the proposals; then the missing states listed in the report; then the Expo spike for the design.

## 2026-11-21: additions core logic (branch feature/additions-core)
- **Done:** the logic the proposed additions need, with tests and no screens. Trend ranges (SK-7, SK-8): `TrendRange` 30 days, 90 days, 1 year, All, default 90 days; `trendRangeStart` and `limitTrend`. Flare threshold scope (SK-8): `FlareRule` (one number, or a fallback plus a threshold per area), `flareScope` and `flareThresholdByArea` in the preferences (exported as `flare_scope` and `flare_thresholds`), `setFlareScope`, `setAreaFlareThreshold`; flares, the day log markers, the analysis input (with `severity_thresholds_by_area`), the report (a line naming the own thresholds) and relapse all follow it. Analysis result (LL-4): `suggestions` became `questions_for_doctor` ("Questions for your doctor"), the prompt says questions only and never advice, prompt version `analysis-10`, the PDF lists the questions. Model groups (LL-2, LL-9): `getGroupModel` and `setGroupModel` give the two choices of the settings screen (estimates; analysis and report summary) on top of the per-action storage. Run cards (LL-12): `runCardStatus` and `formatElapsed`. The design branch (all `G` boards and the proposals) was merged in here to be built from.
- **Not done here:** the rate-limit message and its retry path need no core change (`llm_rate_limited` and the one-tap retry exist).
- **Next:** the UI of the additions, group by group (G1 first).

## 2026-11-21: Today states (branch feature/g1-today-states)
- **Done:** the Group 1 boards (UX-2, UX-3, NF-2, IN-17). The merged dot opens a sheet that lists its entries (each opens its Edit and Delete sheet); the Stool sheet is a two-column grid of the seven Bristol types with their names, and the tapped tile becomes "Saved HH:MM"; regular rows in the Medication and Treatment sheets show the dose and reminder times and "Taken HH:MM" or "Applied HH:MM" after the tap; the date picker sits in a glass panel. Edit Today as a pushed screen, "Back to Today", the first-run card and the 44 pt touch areas were already built in phase 1. The Today states proposals are removed from `design-system.md`.
- **Next:** G2, the entry forms.

## 2026-11-21: entry forms (branch feature/g2-entry-forms)
- **Done:** the Group 2 boards (IN-12, IN-13, IN-17, IN-11, UX-3, UX-4). New `RadioRow` and `FormModal`'s `banner`. The urgent-care advice of the Reaction form is a coral note that stays pinned under the header while the form scrolls; with no meal the form says "Log a meal first" with a button to the meal form and Save stays disabled. Every switch of a form (Regular, alcohol, cracks, fill later, date unknown) is the glass `SwitchRow`; the hint of Regular and fill later shows once the switch is on. Stopped in Routine change lists what is in use now as radio rows. The treatment application edit uses a Reaction control None, Mild, Strong with nothing selected (empty is not none). Entry-form proposals removed from `design-system.md`.
- **Next:** G3, meal extras.

## 2026-11-21: meal extras (branch feature/g3-meal-extras)
- **Done:** the Group 3 boards where they changed behaviour (IN-2, IN-3, IN-8, IN-10, IN-15, IN-19, LL-5, LL-12). A code the database and the diary do not know leaves the scan screen with a card: "Read the ingredient label" (opens the label scan with the code kept) or "Enter by hand". An in-store code asks in a sheet ("Use it") instead of an alert. A camera-off card explains and offers Allow or Settings; the typed code still works. Every LLM confirmation names the model (`getModelLabel`). Waiting is a glass card with the wait arc, elapsed time (`formatElapsed`) and a Cancel that is there from the start. Results: nothing selected, Add all, Add selected disabled until a tap, Dismiss; a failure says nothing was added and the form is as it was. LL-5 now says the confirmation names the model.
- **Not done:** floating-sheet versions of the three confirmations (they stay native alerts) and the label scan camera screen.
- **Tests:** the estimate Cancel test follows "Cancel from the start"; the scan tests follow the not-found card and the in-store sheet; three new ones.
- **Next:** G4, Review.

## 2026-11-21: Review (branch feature/g4-review)
- **Done:** the Group 4 boards (SK-7, SK-8, LL-2, LL-4, LL-5, LL-12, EX-4, EX-7). A range switch on both trend charts (core `limitTrend`, `downsample` for more than 90 bars; the chart is a glass card). The Review analysis card shows a ticking elapsed time. The analysis result is glass cards with questions for the doctor. `Screen` takes a `floating` primary (`FloatingAction`, shared with the form Save) for Send and analyse, Review and try again (the retry now opens the confirmation again instead of re-sending; the consistency report asked for this), Create doctor report and Prepare the pack. The analysis progress uses the wait arc. A `PhotoGrid` (three columns, check badge, sensitive blurred and left out of Select all) replaces the photo chips in the analysis, the Claude plan and the custom export; the Doctor report gets "Pick photos one by one" (`reportPhotos`) and glass switch rows. Requirements SK-8 and LL-4 carry the new behaviour.
- **Tests:** the interrupted-run retry test confirms first; the health and timeline tests pin the clock to January 2026; new tests for the range switch, picking report photos one by one and `reportPhotos`.
- **Next:** G5, Settings.

## 2026-11-21: Settings (branch feature/g5-settings)
- **Done:** the Group 5 boards (SK-8, SK-6, LL-1, LL-2, LL-9, SE-2, SE-9, NO-3). Flare threshold scope with a segmented control and a stepper per skin area. AI key: Save disabled with a missing line, `apiKeyTail` (last four characters only), `testApiKey` (one tiny request, says it may cost a tiny amount); two model choices on `getGroupModel` and `setGroupModel` (a "mixed" note when actions differ). Reminders: coral banner and disabled switches when notifications are blocked. Delete data: disabled until a group is chosen. Every Settings switch is a glass `SwitchRow`. Requirements SK-6, LL-9 and SE-2 carry the changes.
- **Tests:** the model and key tests follow the new screen; three new ones (flare scope, blocked reminders, delete disabled) and one for the key test.
- **Next:** G6, System.

## 2026-11-21: System (branch feature/g6-system)
- **Done:** the Group 6 boards (SE-8, IN-8, IN-9, NF-3, LL-8, UX-12). The lock cover is a glass ring with the lock, "Nettle is locked" and Unlock or Use passcode, never any entry; after a failed or cancelled prompt it becomes "Face ID did not work" with a coral lock and Try again (`AppLock.failed`); away from the foreground it is only a lock mark. `showError` explains a refused camera, photo or notification permission and offers "Open iPhone settings" and "Not now". A failed save keeps the form open with a coral banner (NF-3); a failed analysis is a coral banner too. The app icon, favicon, Android layers and the splash are drawn by `design/generator/appicon.py` (PIL; an accent ring on the Aurora ground, the splash adds the word Nettle); `app.json` no longer points at the Expo icon bundle and the splash is 220 wide.
- **Not done:** the offline barcode lookup is still an alert before the empty review form.
- **Tests:** the lock tests follow the failed state; new ones for the failed cover, the storage banner and `showError`.
- **Next:** the states the consistency report lists without a board.

## 2026-11-21: missing states and the end of the build plan (branch feature/missing-states)
- **Done:** the states the consistency report lists without a board, built from the design-system patterns and **not reviewed against a board**: the Review days list and the Regular items list use the empty state (title, one sentence, at most one button). The other states on that list already exist in a native form or came with earlier tasks: the Discard Changes sheet (native action sheet), label read, name estimate and export or delete results (inline panels and alerts), the meal-photo camera (the system picker), import of an unreadable or newer file (alerts), the key-test result (an alert), the Medication sheet without regular items (the tile opens the full form, IN-17).
- **Not done:** the Today card for a regular item's next time (no logic for it yet), the offline barcode lookup as a banner, floating-sheet versions of the confirmations (see the work log entries of tasks 6, 12 and 14).
- **State of the plan:** phase 1 (tasks 1 to 8) and phase 2 (tasks 9 to 16) of `docs/build-plan.md` are built and merged into `develop`. UX-13 (Later) and UX-8 are untouched. Needs the phone: the design spike checks (`docs/spikes/design-stack.md`), then a run of Today, a form, Review and Settings.

## 2026-11-21: Docker docs and run.sh (branch feature/docker-docs)
- **Done:** `./run.sh` starts the dev server in Docker on :8081 (it detects the Wi-Fi address, refuses to start if the port is taken) or runs any command in the container. README describes the dev environment and commands; CLAUDE.md, `app/AGENTS.md` and the phone test plan use `./run.sh`. No app code changed.
- **Next:** remove the host toolchain (Nettle `node_modules`, Expo and Metro caches, the fnm shell hook).

## 2026-11-21: Expo CLI login kept in a volume (branch feature/docker-expo-login)
- **Why:** Expo Go signed in to an Expo account refuses a project served by a CLI that is not signed in, and the container's `~/.expo` was thrown away on every run.
- **Done:** a named volume for `/home/node/.expo`; README and CLAUDE.md explain `./run.sh npx expo login`. Compose config only, no app code.
- **Next:** the user signs in once.

## 2026-11-21: expo login works in the container (branch feature/docker-login-link)
- **Done:** `expo login` crashed because the image has no `xdg-open`; the image gets a no-op stub, so the CLI prints the login link and waits for the browser callback on localhost (host networking). `run.sh` rebuilds the cached image before each run. No app code changed.

## 2026-11-21: first phone run (UX-12)
Design spike passed on the iPhone (blur, aurora, fonts, arc, swipe). Real-screen pass: Today works. Found that a focused field (ingredient entry in the meal form) stayed behind the keyboard; the shared `Screen` scroll view now has `automaticallyAdjustKeyboardInsets`. Spike screen deleted. Next: re-check the ingredient field on the phone, then the in-depth screen review.

## 2026-11-21: Add ingredient stays above the keyboard; spike route removed
Adding an ingredient grows the meal form, so the Add ingredient button slid under the keyboard. The form now scrolls (via a `scrollRef` that `FormModal` passes to `Screen`) to keep the button above the keyboard and the floating Save. Also removed the leftover `spike` route from `_layout.tsx` (it caused a "No route named spike" warning) and its test exemption. Next: re-check on the phone.

## 2026-11-21: Add ingredient focuses the new field
Phone test: when the keyboard was hidden, Add ingredient scrolled before the keyboard slid out, so the new field ended up behind it. Now the new row takes focus (one tap fewer) and the form scrolls once the keyboard's height is known (immediately when it is already open). Next: re-check on the phone.

## 2026-11-21: one smooth scroll for Add ingredient
The scroll for a new ingredient started after the keyboard had finished sliding (keyboardDidShow), so it came as two steps after the system's own adjustment. It now starts with the slide (keyboardWillShow). Next: re-check on the phone.

## 2026-11-21: phone test plan updated for the new design
`docs/phone-test-plan.md` follows the Aurora ring build: floating tab bar, day ring and dots, quick sheets (stool grid, Taken/Applied), Edit Today, swipe and long-press gestures, per-area flare thresholds, chart ranges, glass forms with the floating Save and the keyboard behaviour, report photo picking, AI key test and model groups, lock cover, permission errors, icon and splash. New sections: L14, L15, R10, S6 and section 12 (design and system states) with a list of what is known not built. Your filled-in results (S1, S2) are kept. Next: run the plan.

## 2026-11-21: language setting and nettle icon, design and docs (branch feature/language-setting-docs)
- **Done:** the earlier decision "no in-app language setting" is reversed at the user's request. Requirements v0.9.5: UX-7 rewritten (Device language by default, English, Polski, applied at once, stored with the preferences and exported with the settings part), UX-6, NF-6 and LL-11 follow; `ux-design.md` and `open-questions.md` updated; the old reason (per-app language needs a native build) no longer applies because the app switches its own text. `docs/build-plan.md` has a Phase 3 with task 17 (language-setting) and task 18 (app-icon-nettle). Canvas: boards `G7-Language`, `G7-AppIcon-Nettle` (three nettle-and-ring options, A proposed), `G7-Splash-Nettle`, and a Language row in `Ref-Settings`; generator `design/generator/group7.py`. Docs and design files only, no app code.
- **Next:** pick the icon option; then task 17 (language-setting) and task 18 (app-icon-nettle) from the build plan.

## 2026-11-21: Cancel and Back buttons no longer double-framed
On iOS 26 the system draws its own glass capsule behind a custom header view, so our glass Cancel and Back sat inside a second background and looked blurred and misaligned. The form Cancel and the Settings Back are now `unstable_headerLeftItems` with `hidesSharedBackground`, so only our glass shows. The test mock exposes such an item as `headerLeft`. Not verified on the phone; the other Settings screens use the native back button and were not touched. Next: check on the phone.

## 2026-11-21: icon A chosen, test plan updated (branch feature/language-setting-docs)
- **Done:** the user chose icon option A (a nettle leaf in the ring). Requirements: UX-12 names the icon and the splash, and the v0.9.5 Changelog entry says so; build-plan task 18 no longer waits for a pick; design-system and the canvas board mark A as chosen. `docs/phone-test-plan.md`: S5 now tests the Language setting in the app (Polski, English, Device language), S6 describes the new icon and splash and says Expo Go shows its own icon, new S7 (the choice survives a restart) and S8 (the Doctor report language default), A11 (AI answers follow the setting), N3 lists the Language row. Docs only.
- **Next:** task 17 (language-setting) and task 18 (app-icon-nettle) from the build plan.

## 2026-11-21: language setting (task 17, branch feature/language-setting)
- **Done:** UX-7, UX-6, NF-6, LL-11. Core: `LanguagePreference` (`system`, `en`, `pl`), pure `resolveLanguage`, `setLanguage` use case; the preference lives in the preferences JSON (default `system`) and travels in the export's settings part. i18n adapter: `setLanguage`, `deviceLanguage`, `useAppLanguage`; start-up applies the stored choice before the first screen. The Language page (Settings, first row of the About group, value "Device (English)") has three radio rows and a "What changes" list; a choice saves, switches the text at once, and re-schedules reminders in the new language (SK-9). The navigation root is keyed by the language, so every screen redraws. English and Polish strings added (Polish is a draft).
- **Not verified on the phone:** whether remounting the navigator keeps you on the Language page or returns you to Today; the check is S5 in the phone test plan.
- **Tests:** `test/language.test.ts` (resolution, storage, export round trip, `t()` switch) and a Language page test; the Settings list test includes the row.
- **Next:** task 18, the nettle icon.

## 2026-11-21: nettle icon (task 18, branch feature/app-icon-nettle)
- **Done:** UX-12. `design/generator/appicon.py` now draws option A, a serrated nettle leaf inside the filling ring (the leaf shape is the one of `leaf_path` in `group7.py`), and rewrote `icon.png`, `favicon.png`, `splash-icon.png` (leaf, ring and the word Nettle) and the three Android layers (the monochrome layer is the arc and the leaf outline in one colour). Checked by opening the PNGs and a preview at 180, 120, 60 and 29 px: the leaf and the ring stay readable down to 29 px. `NETTLE_FONT` points the script at a copy of the Gabarito file, because `node_modules` lives in a Docker volume.
- **Not seen on the phone:** Expo Go always shows its own icon, so the icon appears only in a standalone build; the splash is checked in S6.
- **Next:** the in-depth review on the phone; phone checks S5 and S6.

## 2026-11-22: fixes from the code review since 2026-11-15 (branch feature/review-fixes-2)
- **Done:** applying an AI suggestion works when the same edit switched "Fill later" off (IN-20); a pack import marks the pack before storing and undoes both on a failure, so a retry never stores a second analysis (LL-15); deleting, moving or importing a Daily health record, and Delete data, reschedule the reminders (SK-9); Today, Review, Area timeline and Health trends read the clock through `useNow` (state refreshed on focus, on return to the foreground and every minute), so a mounted Review tab moves on to a new month (NF-7); Taken or Applied that logs nothing now says so (IN-17); a tap without a delivery time is handled once per day, not once ever (SK-9); `replaceAll` no longer cancels the pending test reminder (SK-9). Tests added for the suggestion, the import retry and the tap marker (875 pass).
- **Not changed:** an open flare still absorbs later flares of other areas (SK-6): a test asks for it, so it needs a decision. The Daily health reminder still stops after 14 days without opening the app: the trade-off recorded in IN-17 / SK-9.
- **Next:** decide the open-flare merge rule; the in-depth review on the phone.

## 2026-11-22: open flares reach only to their last entry (branch feature/flare-open-merge)
- **Done:** SK-6, requirements v0.9.6. An open flare (no later entry below the threshold) now overlaps only what starts by its last entry, so a later flare of another area is its own period; before, one stale open flare took in every later flare (Today pill, Review calendar, analysis input and report showed one long body-wide flare). With several open flares, Today shows the most recent. The old test that asked for the absorbing came with the first build of derived flares, not from a recorded decision. Tests: three periods for the chin, neck and arm example, a merge that still happens by the last entry, and the most recent open flare on Today (877 pass).
- **Trade-off:** an area left high and not logged again stays an open flare in the report and the analysis, but Today no longer names it once a newer flare opens.
- **Next:** the in-depth review on the phone.

## 2026-11-22: clarity and maintainability pass (branch feature/maintainability)
- **Done (all 18 items of the review):**
  - Tooling: `noUncheckedIndexedAccess` on (it passed as is); Prettier (`npm run format`, `format:check` is part of `npm run check`), one formatting commit.
  - Shared helpers: `isLocalDay`, `dayParam`, `isDayRange`, `DAY_MS` and `HOUR_MS` in `core/model/time.ts`; one `isObj` (`core/model/json.ts`); `shownName`; `showError` on every screen (a refused permission now offers the iPhone settings everywhere); `toggled` and `one` (`ui/sets.ts`); every device setting key in `usecases/settingsStore.ts` with `readJsonSetting` (stored key names unchanged, so the phone keeps its settings).
  - Storage port: `addRecord`, `putRecord`, `listRecords` and the new `getRecord` work for every record kind; the meal and skin entry methods are gone; `putRecord` inserts a new id for every kind; whole-table scans for one record use `getRecord`.
  - Edits: the repository `Proxy` is gone. Every `log*` use case takes an `EntryWrite` (id, kept stamp, archived items still allowed), so an edit is the same use case with the entry's id; the medical event and reaction edits lost their clock workarounds.
  - `usecases/aiPack/` is `state`, `pack`, `result` and `suggestions`, same API.
  - Forms: `src/forms/<kind>/` holds the create form, the edit form and the shared fields (allergens, medication, nails, Bristol, treatment, skin scores, routine change, symptoms); `EditEntryScreen` only loads the record and picks the form; `formPages` is gone.
  - Screens: `useFocusLoad` (latest load wins, errors through `showError`) replaces 27 hand-written focus loaders; `MealForm` keeps its draft in `useMealDraft`; `DataScreen` is three sections; `TodayScreen` loads one `TodayData` and uses `useNewEntryHighlight` and `useRowLock`.
  - Tests: `errorCode` and `syntheticScores` helpers; the 4,800-line screen test is 11 files on `test/ui/harness.tsx` (30 s timeout for the cold first test). New tests: `getRecord` and `putRecord` on both stores, `useFocusLoad` (fails without its guard). 881 tests pass.
- **Not changed:** `LlmSettingsSection` keeps its own loader (it is awaited after saving a key). Behaviour is meant to be the same apart from: `showError` everywhere, edit forms now have accessibility labels on the medication and routine change fields, and stale loads are dropped.
- **Next:** the in-depth review on the phone (nothing in this pass was run on the phone).

## 2026-11-22: dev server lost its dependencies (branch feature/entrypoint-lock)
- **Cause:** adding Prettier changed `package-lock.json`, so the next `./run.sh` emptied the shared `node_modules` volume and ran `npm ci` while the dev server from the evening before was still running. That Metro kept its old picture of the folder and failed with "Unable to resolve module promise/setimmediate/es6-extensions". The installed tree itself is complete: a fresh Metro builds the dev bundle and `expo export` builds the iOS bundle.
- **Fix:** `app/docker-entrypoint.sh` takes a shared lock (in the shared `/tmp` volume, since `npm ci` deletes everything in `node_modules`) for as long as its command runs; a reinstall needs the lock for itself and otherwise stops with a message. Checked with a running container: the second one refused and `node_modules` stayed intact. CLAUDE.md and README say to stop the dev server before a dependency change and restart it with `--clear`.
- **Re-checked the maintainability pass:** typecheck, lint, format check, 881 tests, iOS export, a dev-mode Metro bundle on a spare port; i18n files and JSON configs unchanged apart from the TypeScript flag; the lockfile only gained Prettier.
- **Next:** restart the dev server (`./run.sh npx expo start --clear`), then the in-depth review on the phone.

## 2026-11-22: ingredient field under the keyboard on first tap (branch feature/ingredient-focus-scroll)
- **Report:** in the Polish app, tapping the first ingredient field with the keyboard hidden left the field under the keyboard. The code has nothing language-specific; the only thing doing the lift was the automatic keyboard inset (UX-3), which is not reliable on its own.
- **Fix:** `useAddIngredientScroll` now also has `revealField`: on focus with the keyboard hidden, once the keyboard is up (`keyboardDidShow`) it measures the field and scrolls the missing distance (needs the scroll offset, so `Screen` and `FormModal` take `onScrollY`). If the automatic inset already lifted the field, nothing moves. 881 tests pass; not seen on a phone.
- **Next:** phone check in Polish and English: tap the first ingredient field, then a field further down.

## 2026-11-22: Add ingredient hidden behind the keyboard in Polish (branch feature/add-ingredient-measure)
- **Report:** after the previous change, tapping Add ingredient did not scroll in the Polish app and the button stayed under the keyboard. The scroll was a formula (button position plus constants), which can be off by a few rows of height.
- **Fix:** the formula stays as the first, smooth move; once the keyboard has settled (`keyboardDidShow`, or 450 ms when it was already up) the button is measured on screen and any remaining gap is scrolled (UX-3). While the add scroll is pending, the focus scroll of the new field stays out of its way so the two do not fight. 881 tests pass; not seen on a phone.
- **Next:** phone check in Polish: add several ingredients, with the keyboard hidden and shown.

## 2026-11-23: first-use review (branch feature/first-use-review)
- **Done:** the user's remarks after a few days of real use and the notes in the phone test plan are in `docs/reviews/2026-11-23-first-use-review.md`, each with the current code, the cause where found and a proposed fix. Causes found in code: skin areas are listed `ORDER BY id` (alphabetical by id); Today's layout jumps only when leaving today because the "Back to today" row is inserted and the pills row collapses; the merged-dot sheet opens the native action sheet while its own `Modal` is closing (likely why nothing appears); drink suggestions are keyed by name and amount; `Segmented` labels are not centred; `SwitchRow` pills lose their shape when text wraps. All `nav.*` titles have Polish strings, so the untranslated titles need a phone check.
- **Decision (user):** the diary holds real data, so every data change ships with a migration. CLAUDE.md's prototyping rule is replaced; requirements v0.9.7 adds NF-8; open-questions updated; the test plan's Setup warns to back up first.
- **Proposed:** a skin check (one entry over all areas, `check_id` on the per-area entries, a stepper with the area name and step in the title), area order, and build-plan Phase 4 (tasks 19 to 28). Docs only, no app code.
- **Next:** the user's decisions listed at the end of the review; then task 19 (migration-safety).

## 2026-11-23: decisions on the review, work plan (branch feature/first-use-review)
- **Decisions (user):** existing skin entries are grouped into checks (within 15 minutes); destructive phone checks run after a Full backup; stool rows with descriptions only; no list of untranslated titles yet, so the fix is general; the skin stepper is approved.
- **Done:** requirements v0.9.8 (SK-3 rewritten as the skin check; SK-2, SK-7, SK-8, EN-1, EX-1, IN-14, UX-2, NF-6 extended, all "v0.9.8 change not built"); the review lists the decisions; open-questions and the test plan follow. `docs/work-plan-2026-11-23.md` plans tasks 19 to 28 in detail: database copy with `VACUUM INTO` before migrating, preferences and export upgrade chains, `check_id` with a one-off grouping shared by the migration and the import of old files, a batch write so a check is saved whole, then the UI tasks. Docs only.
- **Next:** the user approves the plan; merge PR #1 into `develop`; start task 19.

## 2026-11-23: nail map, patch size row, group 8 screens (branch feature/first-use-review)
- **Decisions (user):** nail photos are close-ups of one nail each (no whole-hand photo); the size stays the patch's, only the layout changes; the nail map and the size row are approved. Requirements: SK-10 (nail map, 20 predefined nails) and SK-3 (cracks and size card, no Details) extended; review and work plan updated (task 29 nail-map).
- **Done:** `design/generator/group8.py` draws 26 boards (G8-*), published to the design canvas and copied to `design/canvas/`: the skin check (step, first step, area in flare, new area, nail step, summary, editing), the cracks and patch size states, Today with a check, the check's sheet, merged-dot rows with Edit and Delete and the in-sheet delete, a steady past day (logged and not logged), Edit Today with a preview, the Review day title, the area timeline table, stool rows (form and quick sheet), drinks by name, area order, the nail map with its sheet, tracking and "This is…", and the Polish layout fixes. Nail stage colours added to `docs/design-system.md` and the lint tokens. Lint: no hard problems.
- **Next:** implementation in another session, from task 19 of `docs/work-plan-2026-11-23.md`.

## 2026-11-23: group 8 revised after the user's review (branch feature/first-use-review)
- **Decisions (user):** nails stay their own entry type, outside the skin check, with the nail-map flow; Review keeps its layout and only an area's entry list becomes a table (dates as rows, symptoms as columns); the skin check's bottom buttons centre their text.
- **Done:** `group8.py`: the step bar's three buttons centre their labels (Skip did not); the nail step board is gone and the strip, summary, edit, Today, sheet and Review boards no longer mention nails in a check; the Nails form gets "No change for all tracked nails"; the Review day board is back to the G4-DayLog layout with the weekday title; the area timeline table has full symptom names as column headers, the date with the time under it, zebra rows, and the trend chips and Compare button as before. Requirements SK-3, SK-8, SK-10, EX-1, the work plan (tasks 21, 25, 29) and the review follow; no nail `check_id`. Canvas and `design/canvas/` updated (25 boards).

