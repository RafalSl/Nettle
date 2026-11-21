#!/usr/bin/env bash
# Run the Nettle dev environment in Docker.
#   ./run.sh                     start the Expo dev server on :8081 (scan the QR code in Expo Go)
#   ./run.sh <command...>        run any command in the container, e.g.
#                                  ./run.sh npm run check
#                                  ./run.sh npx expo install <pkg>
#                                  ./run.sh npx expo start --tunnel --port 8081
# NETTLE_LAN_IP overrides the address the phone is told to use; by default it is
# the address of the interface that routes to the internet (your Wi-Fi).
set -euo pipefail
cd "$(dirname "$0")"

PORT=8081

if [ -z "${NETTLE_LAN_IP:-}" ]; then
  NETTLE_LAN_IP=$(ip route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "src") { print $(i + 1); exit }}' || true)
fi
export NETTLE_LAN_IP

if [ "$#" -eq 0 ]; then
  if ss -ltn "sport = :$PORT" | grep -q LISTEN; then
    echo "Port $PORT is already in use (another Expo server?). Stop it first." >&2
    exit 1
  fi
  echo "Expo dev server on port $PORT, advertised address: ${NETTLE_LAN_IP:-auto}"
  set -- npx expo start --port "$PORT"
fi

exec docker compose run --rm app "$@"
