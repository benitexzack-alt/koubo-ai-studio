#!/bin/zsh
set -e
cd -- "$(dirname -- "$0")"
node scripts/launch.mjs --open
