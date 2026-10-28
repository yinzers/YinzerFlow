# Release toolbox: bun runs scripts/publish.ts, which shells out to real node/npm, git and ssh.
# oven/bun has no npm (its `node` is a shim), so node and npm are copied from the official image.
FROM node:22-bookworm-slim AS node

FROM oven/bun:1.2.17

USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends git openssh-client ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Replace bun's node shim with real node, and wire npm/npx to it.
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -sf /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && ln -sf /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

# npm login state lives here, on a named volume (see docker-compose.yml). Created and owned by
# the bun user (uid 1000) so a fresh volume inherits that ownership.
RUN mkdir -p /npm-config && chown 1000:1000 /npm-config

COPY release-entrypoint.sh /usr/local/bin/release-entrypoint.sh
RUN chmod 0755 /usr/local/bin/release-entrypoint.sh

USER 1000:1000
WORKDIR /app
ENTRYPOINT ["/usr/local/bin/release-entrypoint.sh"]
