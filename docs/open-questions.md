# Open questions and gaps

Undecided items only. Decisions go into `docs/requirements.md` (canonical, edited directly) and are removed from here.

## Open

1. **AES export (EX-6): speed on the phone is unmeasured.** Implemented in pure JS and verified against 7-Zip (see `docs/spikes/aes-zip.md`), but Hermes speed for photo-sized exports is unknown. Text-only exports are fine. Measure when photos (SK-4) land, or earlier if an encrypted export of a few MB feels slow.
2. **Polish strings: review at the end of the project.** First draft lives in `app/src/i18n/pl.json` (English in `en.json`).
3. **Unused template dependencies: prune when moving to a standalone build** (reanimated, gesture-handler, expo-image, expo-glass-effect, `@expo/ui`, ...). No effect in Expo Go.

5. **Merge keeps local settings.** Importing into a fresh install with Merge skips the six pre-seeded predefined areas, so a renamed or archived predefined area from the file is not applied; use Replace (settings) to restore them. Revisit with EX-12 (newest wins) or adopt incoming values for areas still at factory state.

## Accepted

- **`expo-sqlite` wrapper stays untested in code.** Storage logic is tested through the `SqlDb` seam on Node's built-in `node:sqlite`; the ~20-line wrapper `app/src/adapters/storage/expoSqliteDb.ts` is verified on a phone only.

## Decided, code not yet changed

These are in the requirements already; the skeleton still behaves the old way.

- **Date range as local days to UTC** (EX-11 note): the core accepts UTC bounds; the UI conversion does not exist yet.
- **Newest-wins merge with tombstones** (EX-12, Later): needed only once entries are editable or deletable. Adds modified timestamps and a schema version bump at that point.
- **Requirements v0.3 tracking changes** (IN-5, IN-6, IN-10 to IN-13, SK-3, SK-7, SK-9 to SK-11, LL-2 to LL-4, EX-1, EX-3): nothing implemented yet. Needs new migrations (area `kind`, tables for daily check-ins, tags, treatments, change events, reactions, nail entries, meal allergens, day-complete marks) and new `data.json` sections with validation. `schema_version` stays 1 in development, so exports made before the change will not import afterwards.
