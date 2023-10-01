#!/bin/sh

# Initialize missing user files
IFS="," RESOURCES="characters,chats,groups,group chats,User Avatars,worlds,OpenAI Settings,NovelAI Settings,KoboldAI Settings,TextGen Settings"
for R in $RESOURCES; do
  if [ ! -e "config/$R" ]; then
    echo "Resource not found, copying from defaults: $R"
    cp -r "public/$R.default" "config/$R"
  fi
done

if [ ! -e "config/config.conf" ]; then
    echo "Resource not found, copying from defaults: config.conf"
    cp -r "default/config.conf" "config/config.conf"
fi

if [ ! -e "config/settings.json" ]; then
    echo "Resource not found, copying from defaults: settings.json"
    cp -r "default/settings.json" "config/settings.json"
fi

if [ ! -e "config/bg_load.css" ]; then
    echo "Resource not found, copying from defaults: bg_load.css"
    cp -r "default/bg_load.css" "config/bg_load.css"
fi

# Start the server
exec node server.js
