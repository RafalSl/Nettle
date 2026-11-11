# Nettle: food and skin diary (private iPhone app)

Private, single-user iPhone diary: logs food, other intake and skin/health
status. Local-only storage, on-demand LLM analysis, doctor-ready export.
Expo (React Native) + TypeScript. Not for the App Store.

Requirements: @docs/requirements.md (exported snapshot of the canonical doc;
do not edit it here).

## Architecture rules
- Ports and adapters: core logic depends on small interfaces, with one adapter
  per external concern: LLM provider (Anthropic first), key store (iOS
  Keychain via expo-secure-store), storage (local SQLite), photo storage,
  barcode source (Open Food Facts), notifications, file sharing/export.
- Core logic makes no network or platform calls and is testable with fakes.
- All user-facing text goes through i18n (English first, Polish next).
- Timestamps in UTC plus local timezone; stable entry IDs; export schema has
  schema_version.
- Develop for Expo Go: use only libraries available in Expo Go unless a spike
  proves otherwise.

## Health and privacy rules
- LLM or app output is never a medical conclusion, only tentative hypotheses.
- Never use real personal data in code, tests, fixtures, logs or commits;
  use clearly synthetic data.
- Never commit API keys, exports, photos, local databases or .env files.
  The API key lives only in the Keychain and is never logged.
- Data leaves the device only through the explicit, confirmed LLM and export
  flows.

## Working rules
- Reference requirement IDs (IN-3, SE-3) in commits and test names.
- Small modules; tests for core logic; run typecheck, lint and tests before
  finishing a task.
- Prefer the simplest solution that meets the requirement; state trade-offs.
- Check current docs (Expo SDK, Expo Go, library behavior) before relying on
  memory.
- If the code reveals a gap or conflict in the requirements, add it to
  docs/open-questions.md instead of editing the requirements.
- I'm an experienced backend developer (Go), new to mobile: explain Expo and
  iOS specifics briefly, with backend analogies.

- Keep a log of work in docs/work-log.md: add a short dated entry whenever a
  task or meaningful step finishes (what, why, what is next). No personal data.
- Branching: committing straight to main is fine while the project is young;
  switch to feature branches (one per task) once there is a working baseline.

## Commands
Run from `app/` (Node >= 22.13, installed via fnm):
- install: `npm install`
- add an Expo library: `npx expo install <pkg>` (never plain `npm i` for Expo modules)
- start dev server: `npx expo start` (add `--tunnel` if Wi-Fi blocks it), open in Expo Go
- typecheck: `npm run typecheck`
- lint: `npm run lint` (also enforces that `src/core` imports no Expo/RN/adapters)
- test: `npm test`
- all three: `npm run check`

## Layout
- `app/src/core`: pure TS (model, ports, usecases, export). No platform imports.
- `app/src/adapters`: one folder per external concern (storage, keystore, share).
- `app/src/app`: expo-router screens; `app/src/services.tsx` is the composition root.
- `app/test`: tests, fakes (`test/fakes`) and the storage contract (`test/contract`).