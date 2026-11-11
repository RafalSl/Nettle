# Open questions and gaps

Found while building; the requirements doc is not edited from here.

1. **Requirements filename.** CLAUDE.md points to `docs/requirements.md`, the file is `docs/Requirements-v0.1.md`. Fix the reference or rename the exported snapshot.
2. **AES export (EX-6).** `fflate`, used for the ZIP, does not write AES-256 ZIPs. Needs a spike for an Expo Go compatible library (pure JS, e.g. zip.js with WebCrypto if Hermes supports it) or a fallback decision.
3. **Test coverage gap for expo-sqlite.** SQLite adapter logic is tested against Node's built-in `node:sqlite` through the `SqlDb` seam, not against `expo-sqlite` itself. The thin wrapper (`expoSqliteDb.ts`) is only verified on a device. Transactions there are non-exclusive (same connection), which is fine for one user and one UI.
4. **Replace import semantics (EX-10).** `replace` currently wipes all areas (including user-created ones not in the file), then restores the six predefined ones. Should user-created areas survive a replace?
5. **Renaming predefined areas (SK-2).** SK-2 says users add, rename and archive "their own areas". The skeleton locks predefined names (they are localized by id) and lets them be archived. Confirm that is intended.
6. **Merge conflicts by id.** Merge skips an incoming row whose id already exists, even if its content differs (for example an edited meal). There is no edit feature yet; revisit when entries become editable (maybe compare a modified-at stamp).
7. **Range semantics.** Export ranges are inclusive on both ends in UTC. The doctor-facing "date range" is probably local calendar days; the UI will need to convert local day boundaries to UTC bounds.
8. **Large imports.** `data.json` is capped at 50 MB when unzipping; photos (SK-4) will need a different limit and streaming.
9. **Polish strings are a first draft** and should be reviewed by a native speaker (the project owner).
10. **Unused template dependencies.** `create-expo-app` pulled in reanimated, gesture-handler, expo-image, expo-glass-effect, `@expo/ui` etc. Not used by the skeleton; consider pruning before a standalone build.
