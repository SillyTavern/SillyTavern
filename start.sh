#!/usr/bin/env bash

# Make sure pwd is the directory of the script
cd "$(dirname "$0")"

if ! command -v npm &> /dev/null
then
    echo -e "\033[0;31mnpm could not be found in PATH. If the startup fails, please install Node.js from https://nodejs.org/\033[0m"
fi

export NODE_ENV=production
LOCK_HASH_FILE="node_modules/.package-lock.sha256"
CURRENT_HASH=""
if command -v sha256sum &> /dev/null && [ -f "package-lock.json" ]; then
    CURRENT_HASH="$(sha256sum package-lock.json | awk '{print $1}')"
fi

if [ ! -d "node_modules" ] || [ ! -f "$LOCK_HASH_FILE" ] || [ "$CURRENT_HASH" != "$(cat "$LOCK_HASH_FILE" 2>/dev/null)" ]; then
    echo "Installing Node Modules..."
    if npm install --no-save --no-audit --no-fund --loglevel=error --no-progress --omit=dev --ignore-scripts; then
        [ -n "$CURRENT_HASH" ] && [ -d "node_modules" ] && printf '%s\n' "$CURRENT_HASH" > "$LOCK_HASH_FILE"
    fi
fi

echo "Entering SillyTavern..."
exec node "server.js" "$@"
