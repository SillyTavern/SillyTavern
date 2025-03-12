#!/usr/bin/env bash

# Make sure pwd is the directory of the script
cd "$(dirname "$0")"

echo "Assuming nodejs and npm is already installed. If you haven't installed them already, do so now"
echo "Installing Electron Wrapper's Node Modules..."
npm i --no-audit --no-fund --loglevel=error --no-progress --omit=dev

echo "Starting Electron Wrapper..."
npm run start -- "$@"
