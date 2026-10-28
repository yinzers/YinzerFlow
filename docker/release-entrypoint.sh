#!/bin/sh
# Runs bun with the given arguments. Installs dependencies first only when the repo has none
# (a fresh clone): the release script's bundle build needs typescript from node_modules.
set -eu

if [ ! -d /app/node_modules/typescript ] && [ -f /app/package.json ]; then
  echo "node_modules missing, running bun install --frozen-lockfile" >&2
  (cd /app && bun install --frozen-lockfile)
fi

exec bun "$@"
