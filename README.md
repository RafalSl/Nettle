# Nettle

Private, single-user iPhone diary for food, other intake and skin/health
status. Local-only storage, on-demand LLM analysis, doctor-ready export. Expo
(React Native) and TypeScript; run on the phone through Expo Go. Not for the
App Store. Requirements: [docs/requirements.md](docs/requirements.md).

## Dev environment

Everything runs in Docker; the host needs only Docker with the Compose plugin
(Linux, because the dev server uses host networking) and Expo Go on the phone.
No Node, npm or `node_modules` on the host.

Run these from the repo root:

| Task | Command |
| --- | --- |
| Start the dev server on :8081 | `./run.sh` |
| Scan the QR code | Expo Go on the iPhone (same Wi-Fi) |
| Typecheck, lint and tests | `./run.sh npm run check` |
| Tests only | `./run.sh npm test` |
| Add an Expo library | `./run.sh npx expo install <pkg>` |
| Dev server through a tunnel | `./run.sh npx expo start --tunnel --port 8081` |
| Sign the Expo CLI in (once) | `./run.sh npx expo login` |
| Shell in the container | `./run.sh bash` |
| Reset installed dependencies and caches | `docker compose down -v` |

`./run.sh` with no arguments starts the server; with arguments it runs them in
the container (`docker compose run --rm app <args>`).

How it works:
- `app/Dockerfile`: Node 22 and git, running as uid 1000.
- `compose.yaml`: mounts `app/` into the container; `node_modules`, the npm
  cache and `/tmp` (Jest and Metro caches) live in named volumes, so nothing
  Linux-built lands in the working tree.
- `app/docker-entrypoint.sh`: runs `npm ci` when `app/package-lock.json` has
  changed since the last install, but never while another Nettle container (the
  dev server) uses `node_modules`: it then stops and asks you to stop the other
  one first. After a dependency change, restart the dev server with
  `./run.sh npx expo start --clear`.
- `run.sh` tells the phone your Wi-Fi address. If the QR code shows a wrong one,
  set `NETTLE_LAN_IP=<Wi-Fi IP>`.
- Port 8081 must be free (host networking).
- If Expo Go is signed in to an Expo account, the CLI must be too, or Expo Go
  refuses to open the project: run `./run.sh npx expo login` once (the login is
  kept in a volume; the CLI prints a link: open it in the host browser, it
  calls back to localhost), or sign out in Expo Go.

## Docs

- [CLAUDE.md](CLAUDE.md): project rules and commands.
- [docs/design-system.md](docs/design-system.md): the UI spec.
- [docs/phone-test-plan.md](docs/phone-test-plan.md): manual checks on the phone.
- [docs/work-log.md](docs/work-log.md): what was done and what is next.
