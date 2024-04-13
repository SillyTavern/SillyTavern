#!/bin/sh

if [ ! -e "config/config.yaml" ]; then
    echo "Resource not found, copying from defaults: config.yaml"
    cp -r "default/config.yaml" "config/config.yaml"
fi

CONFIG_FILE="config.yaml"

echo "Starting with the following config:"
cat $CONFIG_FILE

# Start the server
exec node server.js --listen
