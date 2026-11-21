# Dev image for the Nettle Expo app: Node + git, nothing else.
# The source is bind-mounted at /app by compose.yaml; node_modules lives in a
# named volume so Linux-built packages never land in the host folder.
FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Pre-create the mount points owned by the non-root `node` user (uid 1000), so
# the named volumes mounted there start out writable.
RUN mkdir -p /app/node_modules /home/node/.npm /home/node/.expo \
 && chown -R node:node /app /home/node

USER node
WORKDIR /app
ENV EXPO_NO_TELEMETRY=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false

COPY --chown=node:node docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npx", "expo", "start"]
