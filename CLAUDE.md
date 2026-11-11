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

## Commands
(fill in after scaffolding: install, start, typecheck, lint, test)