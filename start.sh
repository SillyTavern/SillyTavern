#!/usr/bin/env bash

# Make sure pwd is the directory of the script
cd "$(dirname "$0")"

if ! command -v npm &> /dev/null
then
    echo -e "\033[0;31mnpm could not be found in PATH. If the startup fails, please install Node.js from https://nodejs.org/\033[0m"
fi

echo "Installing Node Modules..."
export NODE_ENV=production
npm i --no-save --no-audit --no-fund --loglevel=error --no-progress --omit=dev

echo "Entering SillyTavern..."
node "server.js" "$@"
