#!/bin/sh

# Check if the "characters" directory is empty
if [ -z "$(ls -A /home/node/app/public/characters)" ]; then
  echo "Characters directory is empty. Copying default characters."
  mv /home/node/app/public/characters.default/ /home/node/app/public/characters/
fi

# Check if the "chats" directory is empty
if [ -z "$(ls -A /home/node/app/public/chats)" ]; then
  echo "Chats directory is empty. Copying default chats."
  mv /home/node/app/public/chats.default/ /home/node/app/public/chats/
fi

# Check if the "User Avatars" directory is empty
if [ -z "$(ls -A '/home/node/app/public/User Avatars')" ]; then
  echo "User Avatars directory is empty. Copying default user avatars."
  mv /home/node/app/public/User\ Avatars.default/ '/home/node/app/public/User Avatars/'
fi

# Start the server
node /home/node/app/server.js