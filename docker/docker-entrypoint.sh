#!/bin/sh

# Default to 1000 if PUID/PGID are not set
TARGET_UID=${PUID:-1000}
TARGET_GID=${PGID:-1000}

# Get the current UID/GID of the 'node' user
CURRENT_UID=$(id -u node)
CURRENT_GID=$(id -g node)

# If the requested PUID/PGID differs from the current 'node' user, update it.
if [ "$CURRENT_UID" != "$TARGET_UID" ] || [ "$CURRENT_GID" != "$TARGET_GID" ]; then
    echo "Updating 'node' user to UID:$TARGET_UID / GID:$TARGET_GID..."
    # Change the group ID
    groupmod -o -g "$TARGET_GID" node
    # Change the user ID and primary group
    usermod -o -u "$TARGET_UID" -g "$TARGET_GID" node
fi

# List of default directories that must be writable
# This list matches the standard volume mounts in docker-compose.yml
DEFAULT_DIRS="config data plugins public/scripts/extensions/third-party"

for dir in $DEFAULT_DIRS; do
    # 1. Create directory if it doesn't exist (Docker creates root-owned dirs otherwise)
    if [ ! -d "$dir" ]; then
        echo "Creating missing directory: $dir"
        mkdir -p "$dir"
        # Immediate chown for the new folder
        chown node:node "$dir"
    fi

    # 2. Permissions check with skip if already owned by the target UID/GID
    if [ -d "$dir" ]; then
        DIR_UID=$(stat -c '%u' "$dir")
        DIR_GID=$(stat -c '%g' "$dir")

        if [ "$DIR_UID" != "$TARGET_UID" ] || [ "$DIR_GID" != "$TARGET_GID" ]; then
            echo "Fixing permissions for: $dir (Detected mismatch)"
            chown -R node:node "$dir"
        fi
    fi
done

# Handle config.yaml default
if [ ! -e "config/config.yaml" ]; then
    echo "Resource not found, copying from defaults: config.yaml"
    cp -r "default/config.yaml" "config/config.yaml"
    # Ensure the new file is owned by node
    chown node:node "config/config.yaml"
fi

# Execute postinstall as the 'node' user
# This populates config.yaml with missing values safely
su-exec node:node npm run postinstall

# Start the server as the 'node' user
exec su-exec node:node node server.js --listen "$@"