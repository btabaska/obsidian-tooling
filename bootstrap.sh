#!/usr/bin/env bash
# Thin wrapper: verify Node >= 18 is available, then run bootstrap.js with all args passed through.
# Usage: ./bootstrap.sh --vault "/path/to/vault" [--update] [--dry-run] [--force-settings]
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is required but was not found on PATH." >&2
  echo "Install Node 18+ from https://nodejs.org (or your package manager), then re-run." >&2
  exit 1
fi

NODE_MAJOR="$(node -e 'process.stdout.write(process.versions.node.split(".")[0])')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Error: Node 18+ required (found $(node -v))." >&2
  exit 1
fi

exec node "$DIR/bootstrap.js" "$@"
