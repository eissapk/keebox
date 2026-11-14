#!/usr/bin/env bash

dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
platform="$(uname | tr '[:upper:]' '[:lower:]')"

case "$platform" in
  linux) node_bin="$dir/node/linux/node" ;;
  darwin) node_bin="$dir/node/mac/node" ;;
  *) echo "Your OS neither linux nor mac ($platform)"; exit 1 ;;
esac

# fall back to system node if the bundled one can't run (e.g. termux/ARM)
"$node_bin" -v >/dev/null 2>&1 || node_bin="node"

exec "$node_bin" "$dir/index.js" "$@"
