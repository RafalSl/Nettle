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

## Real data: every data change ships with a migration (decided 2026-11-23, NF-8)
The user logs real data in the app (no formal release yet). This replaces the
prototyping-phase rule of 2026-11-15. Every change to a data structure includes
its migration, with a test that upgrades data in the previous shape (synthetic
rows only):
- SQLite: a new append-only step in `adapters/storage/migrations.ts`; never edit
  or drop a shipped step, never delete user rows as "prototype data".
- Preferences JSON: bump its version and add a pure upgrade function.
- Export: bump `schema_version` when the shape changes; the importer keeps
  reading every earlier version and upgrades it in memory.
- Photos and other files keep their ids and paths, or the migration moves them.
Still out of the plan until the user says so: the accessibility pass (UX-8)
and the Polish string review.

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
or `node_modules` is needed on the host. Run from the repo root; `./run.sh` is a
thin wrapper around `docker compose run --rm app` (no arguments: start the dev
server on :8081; with arguments: run that command in the container). The
container installs dependencies into a named volume when `app/package-lock.json`
changes.
- install / update dependencies: automatic on the next `run` after the lockfile changes. All containers share one `node_modules` volume: while one runs (the dev server), another refuses to reinstall and says so. Stop the dev server first, and after any dependency change restart it with `./run.sh npx expo start --clear`
- add an Expo library: `./run.sh npx expo install <pkg>` (never plain `npm i` for Expo modules); it edits `app/package.json` and the lockfile through the mount
- start dev server: `./run.sh`, scan the QR code in Expo Go. If Wi-Fi blocks it, `./run.sh npx expo start --tunnel --port 8081`. `run.sh` detects the Wi-Fi address; if the QR code still shows a wrong one, set `NETTLE_LAN_IP=<Wi-Fi IP>`. It uses host networking, so port 8081 must be free
- Expo login: if Expo Go says it is signed in but the CLI is not, run `./run.sh npx expo login` once (kept in a volume) or sign out in Expo Go
- typecheck: `./run.sh npm run typecheck`
- lint: `./run.sh npm run lint` (also enforces that `src/core` imports no Expo/RN/adapters)
- format: `./run.sh npm run format` (Prettier; `npm run format:check` only checks)
- test: `./run.sh npm test` (screen tests have a 30 s timeout for the first, cold run)
- all four (typecheck, lint, format check, tests): `./run.sh npm run check`
- reset the container's dependencies: `docker compose down -v` (removes the `node_modules`, npm and tmp cache volumes)

## Layout
- `app/src/core`: pure TS (model, ports, usecases, export). No platform imports.
- `app/src/adapters`: one folder per external concern (storage, keystore, share).
- `app/src/app`: expo-router routes (thin files that export a screen or a form); `app/src/services.tsx` is the composition root.
- `app/src/screens`: screens; `app/src/forms/<kind>`: the create form, the edit form (`Edit*.tsx`) and the shared fields of one entry kind.
- `app/src/ui`: shared components and hooks (`useFocusLoad` for screen data, `useNow` for the clock, `showError`).
- `app/test`: tests, fakes (`test/fakes`), helpers (`test/helpers`), the storage contract (`test/contract`) and screen tests by area on a shared harness (`test/ui/harness.tsx`).
- `compose.yaml`, `app/Dockerfile`, `app/docker-entrypoint.sh`, `run.sh`: the Docker dev environment (see README.md).
- `design/`: the design canvas files (`design/canvas/`) and the script that draws the generated boards (`design/generator/`). The UI follows `docs/design-system.md`.