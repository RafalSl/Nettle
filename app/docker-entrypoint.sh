#!/bin/sh
# Install dependencies into the node_modules volume when package-lock.json has
# changed since the last install, then run the requested command.
#
# Every container shares one node_modules volume. Each one holds a shared lock
# while it runs; a reinstall needs the lock for itself, so it never empties
# node_modules under a running dev server or test run (Metro then cannot find
# files it already knew about). The lock file lives in the shared /tmp volume,
# because `npm ci` deletes everything inside node_modules.
set -e
cd /app

exec 9>>/tmp/nettle-node-modules.lock

installed() { [ "$(sha256sum package-lock.json | cut -d' ' -f1)" = "$(cat node_modules/.lock-hash 2>/dev/null || true)" ]; }

if ! installed; then
  if ! flock -n -x 9; then
    echo "[nettle] package-lock.json changed, but another Nettle container (the dev server?) is using node_modules." >&2
    echo "[nettle] Stop it, then run this again: the dependencies are installed then." >&2
    exit 1
  fi
  if ! installed; then # another container may have installed them while this one waited
    echo "[nettle] installing dependencies (npm ci)..."
    # node_modules is a mount point, so empty it instead of letting npm remove it.
    find node_modules -mindepth 1 -delete
    npm ci --no-audit --no-fund
    sha256sum package-lock.json | cut -d' ' -f1 > node_modules/.lock-hash
  fi
fi

flock -s 9 # held until the command ends (the descriptor stays open across exec)
exec "$@"
