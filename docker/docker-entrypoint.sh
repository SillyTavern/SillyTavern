#!/bin/sh

# Check if the "characters" directory is empty
if [ -z "$(ls -A /home/node/app/public/characters)" ]; then
  echo "Characters directory is empty. Copying default characters."
  mv /home/node/app/public/characters.default/* /home/node/app/public/characters/
  rm -rf /home/node/app/public/characters.default
fi

# Check if the "chats" directory is empty
if [ -z "$(ls -A /home/node/app/public/chats)" ]; then
  echo "Chats directory is empty. Copying default chats."
  mv /home/node/app/public/chats.default/* /home/node/app/public/chats/
  rm -rf /home/node/app/public/chats.default
fi

# Check if the "User Avatars" directory is empty
if [ -z "$(ls -A '/home/node/app/public/User Avatars')" ]; then
  echo "User Avatars directory is empty. Copying default user avatars."
  mv /home/node/app/public/User\ Avatars.default/* '/home/node/app/public/User Avatars/'
  rm -rf /home/node/app/public/User\ Avatars.default
fi

# Start the server
node /home/node/app/server.js