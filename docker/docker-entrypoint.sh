#!/bin/sh

# Check if the "characters" directory is empty
if [ -z "$(ls -A /home/node/app/config/characters)" ]; then
  echo "Characters directory is empty. Copying default characters."
  mv /home/node/app/public/characters.default /home/node/app/config/characters
fi

# Check if the "chats" directory is empty
if [ -z "$(ls -A /home/node/app/config/chats)" ]; then
  echo "Chats directory is empty. Copying default chats."
  mv /home/node/app/public/chats.default /home/node/app/config/chats/
fi

# Check if the "User Avatars" directory is empty
if [ -z "$(ls -A '/home/node/app/config/User Avatars')" ]; then
  echo "User Avatars directory is empty. Copying default user avatars."
  mv /home/node/app/public/User\ Avatars.default /home/node/app/config/User\ Avatars/
fi

# Check if the "settings.json" file is not empty
if [ ! -s "/home/node/app/config/settings.json" ]; then
  echo "Settings file does not exist. Copying default settings."
  mv /home/node/app/public/settings.json.default /home/node/app/config/settings.json
fi

# Start the server
node /home/node/app/server.js
