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
