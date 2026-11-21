#!/bin/sh
# Install dependencies into the node_modules volume when package-lock.json has
# changed since the last install, then run the requested command.
set -e
cd /app

want=$(sha256sum package-lock.json | cut -d' ' -f1)
have=$(cat node_modules/.lock-hash 2>/dev/null || true)

if [ "$want" != "$have" ]; then
  echo "[nettle] installing dependencies (npm ci)..."
  # node_modules is a mount point, so empty it instead of letting npm remove it.
  find node_modules -mindepth 1 -delete
  npm ci --no-audit --no-fund
  echo "$want" > node_modules/.lock-hash
fi

exec "$@"
