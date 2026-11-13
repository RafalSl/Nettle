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
