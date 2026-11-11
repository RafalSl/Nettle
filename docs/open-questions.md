# Open questions and gaps

Undecided items only. Decisions go into `docs/requirements.md` (canonical, edited directly) and are removed from here.

## Open

1. **AES export (EX-6).** `fflate`, used for the ZIP, does not write AES-256 ZIPs. Decision: run a spike for an Expo Go compatible library (pure JS, e.g. zip.js with WebCrypto if Hermes supports it) before building EX-6.
2. **expo-sqlite wrapper is device-verified only.** Storage logic is tested through the `SqlDb` seam on Node's built-in `node:sqlite`; the ~20-line wrapper `app/src/adapters/storage/expoSqliteDb.ts` is only exercised on a phone. Accepted for now. Optional later: an in-app self-test that runs the storage contract against a throwaway database.
3. **Polish strings are a first draft** and need review by the project owner.
4. **Unused template dependencies** (reanimated, gesture-handler, expo-image, expo-glass-effect, `@expo/ui`, ...). Prune before a standalone build.

## Decided, code not yet changed

These are in the requirements already; the skeleton still behaves the old way.

- **Records vs settings in export/import** (EX-1, EX-10): separate sections and a choice of records, settings or both; replace touches only the chosen parts. Today `replace` wipes areas too.
- **`name_override` for predefined areas** (SK-2): today predefined areas cannot be renamed.
- **Date range as local days to UTC** (EX-11 note): the core accepts UTC bounds; the UI conversion does not exist yet.
- **Newest-wins merge with tombstones** (EX-12, Later): needed only once entries are editable or deletable. Adds modified timestamps and a schema version bump at that point.
