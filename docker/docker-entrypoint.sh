#!/bin/sh

# Check if the "characters" directory is empty
if [ ! -e "/home/node/app/config/characters" ]; then
  echo "Characters directory not found. Copying default characters."
  mv /home/node/app/public/characters.default /home/node/app/config/characters
fi

# Check if the "chats" directory is empty
if [ ! -e "/home/node/app/config/chats" ]; then
  echo "Chats directory not found. Copying default chats."
  mv /home/node/app/public/chats.default /home/node/app/config/chats/
fi

# Check if the "User Avatars" directory is empty
if [ ! -e "/home/node/app/config/User Avatars" ]; then
  echo "User Avatars directory not found. Copying default user avatars."
  mv /home/node/app/public/User\ Avatars.default /home/node/app/config/User\ Avatars/
fi

# Check if the "settings.json" file is not empty
if [ ! -e "/home/node/app/config/settings.json" ]; then
  echo "Settings file not found. Copying default settings."
  mv /home/node/app/public/settings.json.default /home/node/app/config/settings.json
fi

# Start the server
exec node /home/node/app/server.js
