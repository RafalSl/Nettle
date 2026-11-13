# Open questions and gaps

Undecided items only. Decisions go into `docs/requirements.md` (canonical, edited directly) and are removed from here.

## Open

1. **AES export (EX-6): speed on the phone is unmeasured.** Implemented in pure JS and verified against 7-Zip (see `docs/spikes/aes-zip.md`), but Hermes speed for photo-sized exports is unknown. Text-only exports are fine. Measure when photos (SK-4) land, or earlier if an encrypted export of a few MB feels slow.
2. **Polish strings: review at the end of the project.** First draft lives in `app/src/i18n/pl.json` (English in `en.json`).
3. **Unused template dependencies: prune when moving to a standalone build** (reanimated, gesture-handler, expo-image, expo-glass-effect, `@expo/ui`, ...). No effect in Expo Go.

5. **Merge keeps local settings.** Importing into a fresh install with Merge skips the six pre-seeded predefined areas, so a renamed or archived predefined area from the file is not applied; use Replace (settings) to restore them. Revisit with EX-12 (newest wins) or adopt incoming values for areas still at factory state.

## Accepted

- **`expo-sqlite` wrapper stays untested in code.** Storage logic is tested through the `SqlDb` seam on Node's built-in `node:sqlite`; the ~20-line wrapper `app/src/adapters/storage/expoSqliteDb.ts` is verified on a phone only.

## Decided, code partly changed

These are in the requirements already; what remains is listed per item.

- **Requirements v0.3 tracking changes.** Done in core, storage and `data.json` (schema, validation, round trips): IN-6, IN-10 to IN-13, SK-3, SK-7, SK-10, SK-11, EX-1 (records and settings), IN-11. Screens exist for the daily check-in with tags and day complete, stool, nails, treatments, "no change" and allergen chips. Still open:
  - Screens for change events (IN-12) and reactions (IN-13, with the urgent-care advice text), and for renaming, archiving or adding tags and treatments.
  - "No change" for nail entries, and for all areas at once.
  - SK-9 reminders (daily check-in, weekly nail photo) and SK-4/SK-5 photos for nails and skin.
  - LL-2 to LL-4 prompt changes, EX-3 PDF sections (check-in and digestion trends, treatments, change events, per-nail photo timeline).
  - Allergen suggestions from Open Food Facts or the LLM (only the ingredient-text helper exists).
- **Date range as local days to UTC** (EX-11 note): the core converts (`localDaysToRange`, `exportBundle({ days })`); the Data screen still exports everything and has no date picker.
- **Newest-wins merge with tombstones** (EX-12, Later): needed only once entries are editable or deletable. The daily check-in is already updated in place, and a merge cannot tell which version is newer; adds modified timestamps and a schema version bump at that point.
- **One check-in per day is kept by the use case only.** There is no database constraint, so a merge from another phone could add a second check-in for the same day; the newest is shown. Revisit with EX-12.
- **`schema_version` stays 1 in development.** Exports made before v0.3 (before the new required sections) will not import.
