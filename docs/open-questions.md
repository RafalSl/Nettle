# Open questions and gaps

Undecided items only. Decisions go into `docs/requirements.md` (canonical, edited directly) and are removed from here.

## Open

1. **AES export (EX-6): speed on the phone.** The spike works (pure JS WinZip AES-256, verified against 7-Zip, see `docs/spikes/aes-zip.md`). Unknown: how slow Hermes is for photo-sized exports. Needs a device benchmark before building EX-6.
2. **Polish strings: review at the end of the project.** First draft lives in `app/src/i18n/pl.json` (English in `en.json`).
3. **Unused template dependencies: prune when moving to a standalone build** (reanimated, gesture-handler, expo-image, expo-glass-effect, `@expo/ui`, ...). No effect in Expo Go.

## Accepted

- **`expo-sqlite` wrapper stays untested in code.** Storage logic is tested through the `SqlDb` seam on Node's built-in `node:sqlite`; the ~20-line wrapper `app/src/adapters/storage/expoSqliteDb.ts` is verified on a phone only.

## Decided, code not yet changed

These are in the requirements already; the skeleton still behaves the old way.

- **Records vs settings in export/import** (EX-1, EX-10): separate sections and a choice of records, settings or both; replace touches only the chosen parts. Today `replace` wipes areas too.
- **`name_override` for predefined areas** (SK-2): today predefined areas cannot be renamed.
- **Date range as local days to UTC** (EX-11 note): the core accepts UTC bounds; the UI conversion does not exist yet.
- **Newest-wins merge with tombstones** (EX-12, Later): needed only once entries are editable or deletable. Adds modified timestamps and a schema version bump at that point.
