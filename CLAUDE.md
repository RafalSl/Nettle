# Nettle: food and skin diary (private iPhone app)

Private, single-user iPhone diary: logs food, other intake and skin/health
status. Local-only storage, on-demand LLM analysis, doctor-ready export.
Expo (React Native) + TypeScript. Not for the App Store.

Requirements: @docs/requirements.md.

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

## Prototyping phase (decided 2026-11-15)
Nothing logged so far is real data. Do not plan or build data migrations,
old-data handling, importers for old export shapes or backward-compatible
parsers; change the schema freely (`schema_version` stays 1; a plain new SQL
migration step is fine when the app needs one). This holds until the first
release on GitHub or until the user changes the decision. Also out of the plan
until the user says so: the accessibility pass (UX-8) and the Polish string
review.

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
- docs/requirements.md is canonical and lives in this repo: edit it directly
  when a decision is made, and note the change in its Changelog. Use
  docs/open-questions.md only for undecided items; move them out once resolved.
- I'm an experienced backend developer (Go), new to mobile: explain Expo and
  iOS specifics briefly, with backend analogies.

- Keep a log of work in docs/work-log.md: add a short dated entry whenever a
  task or meaningful step finishes (what, why, what is next). No personal data.
- Branching: no git worktrees; work in the main checkout. `develop` is the
  main development branch. Create a feature branch per task
  (`feature/<short-task-name>`, cut from `develop`) and merge it back into
  `develop` when the task's checks pass. Do not commit directly to `develop`
  or `main`.
- Releases: `main` holds only clean, released versions. Only the user merges
  `develop` into `main`, when they decide to release. Never merge into `main`
  or create release tags yourself.

## Commands
The dev environment is Docker (`compose.yaml`, `app/Dockerfile`); no Node, fnm
or `node_modules` is needed on the host. Run from the repo root. The container
installs dependencies into a named volume when `app/package-lock.json` changes.
- install / update dependencies: automatic on the next `run` after the lockfile changes
- add an Expo library: `docker compose run --rm app npx expo install <pkg>` (never plain `npm i` for Expo modules); it edits `app/package.json` and the lockfile through the mount
- start dev server: `docker compose run --rm app`, scan the QR code in Expo Go. Add `npx expo start --tunnel` after `app` if Wi-Fi blocks it. If the QR code shows a wrong address (docker0, VM bridge), set `NETTLE_LAN_IP=<Wi-Fi IP>` before the command. It uses host networking, so port 8081 must be free
- typecheck: `docker compose run --rm app npm run typecheck`
- lint: `docker compose run --rm app npm run lint` (also enforces that `src/core` imports no Expo/RN/adapters)
- test: `docker compose run --rm app npm test` (the first run on a fresh cache volume can time out the Today screen test; run it again)
- all three: `docker compose run --rm app npm run check`
- reset the container's dependencies: `docker compose down -v` (removes the `node_modules`, npm and tmp cache volumes)

## Layout
- `app/src/core`: pure TS (model, ports, usecases, export). No platform imports.
- `app/src/adapters`: one folder per external concern (storage, keystore, share).
- `app/src/app`: expo-router screens; `app/src/services.tsx` is the composition root.
- `app/test`: tests, fakes (`test/fakes`) and the storage contract (`test/contract`).
- `design/`: the design canvas files (`design/canvas/`) and the script that draws the generated boards (`design/generator/`). The UI follows `docs/design-system.md`.