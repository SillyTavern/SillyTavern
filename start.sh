#!/usr/bin/env bash

# Make sure pwd is the directory of the script
cd "$(dirname "$0")"


PM=$(command -v bun || command -v yarn || command -v npm)
PM="${SILLYTAVERN_PM:-$PM}"

if ! command -v "$PM" &> /dev/null
then
    read -p "npm is not installed. Do you want to install nodejs and npm? (y/n)" choice
    case "$choice" in
      y|Y )
        echo "Installing nvm..."
        export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
        source ~/.bashrc
        nvm install --lts
        nvm use --lts
        PM="npm";;
      n|N )
        echo "Nodejs and npm will not be installed."
        exit;;
      * )
        echo "Invalid option. Nodejs and npm will not be installed."
        exit;;
    esac
fi

if [[ "$PM" != *"npm"* ]]; then
  printf "\e[31mWARNING:\e[0m \e[4;58:5:208mSillyTavern only supports NPM.\nPlease help us test \"%s\" and report bugs here: https://github.com/SillyTavern/SillyTavern/pull/4674\e[0m\n", "$(basename "$PM")"
fi

echo "Installing Node Modules..."
export NODE_ENV=production
$PM install --no-audit --no-fund --loglevel=error --no-progress --omit=dev

echo "Entering SillyTavern..."
node "server.js" "$@"
