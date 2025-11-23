#!/usr/bin/env bash

# Make sure pwd is the directory of the script
cd "$(dirname "$0")"

if ! command -v npm &> /dev/null
then
    echo "npm could not be found in PATH. If the startup fails, please install Node.js from https://nodejs.org/"
fi

echo "Installing Node Modules..."
export NODE_ENV=production
npm i --no-audit --no-fund --loglevel=error --no-progress --omit=dev

echo "Entering SillyTavern..."
node "server.js" "$@"
