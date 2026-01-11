#!/bin/sh

if [ ! -e "config/config.yaml" ]; then
    echo "Resource not found, copying from defaults: config.yaml"
    cp -r "default/config.yaml" "config/config.yaml"
fi

# non-root-mode: Only fix permissions if PUID/PGID are set
if [ -n "$PUID" ] && [ -n "$PGID" ]; then
    TARGET_UID=$PUID
    TARGET_GID=$PGID
    echo "Non-root mode requested (UID:$TARGET_UID GID:$TARGET_GID)."
    echo "This may take a while for large libraries and slow devices. Please wait..."

    # Update the 'node' user
    groupmod -o -g "$TARGET_GID" node
    usermod -o -u "$TARGET_UID" -g "$TARGET_GID" node

    # List of default directories to fix
    DEFAULT_DIRS="config data plugins public/scripts/extensions/third-party"

    for dir in $DEFAULT_DIRS; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            chown node:node "$dir"
        fi

        if [ -d "$dir" ]; then
            DIR_UID=$(stat -c '%u' "$dir")
            DIR_GID=$(stat -c '%g' "$dir")

            if [ "$DIR_UID" != "$TARGET_UID" ] || [ "$DIR_GID" != "$TARGET_GID" ]; then
                echo "Ownership mismatch detected for '$dir'."
                echo "Adjusting permissions to UID:$TARGET_UID GID:$TARGET_GID..."
                if chown -R node:node "$dir"; then
                    echo "Successfully updated permissions for '$dir' to node."
                else
                    echo "Error: Failed to update permissions for '$dir' to node."
                fi
            fi
        fi
    done
    
    # Final ownership for the config file created above
    chown node:node "config/config.yaml"

    # Set execution prefix to run as node user
    EXEC_PREFIX="su-exec node:node"
else
    # Default mode: stay as root
    echo "Running in default (root) mode."
    
    # Reset permissions back to root if they were changed previously
    DEFAULT_DIRS="config data plugins public/scripts/extensions/third-party"
    for dir in $DEFAULT_DIRS; do
        if [ -d "$dir" ]; then
            DIR_UID=$(stat -c '%u' "$dir")
            # If the directory is NOT owned by root (UID 0), reset it
            if [ "$DIR_UID" != "0" ]; then
                echo "Ownership mismatch detected for '$dir'. Adjusting permissions to root..."
                if chown -R root:root "$dir"; then
                    echo "Successfully updated permissions for '$dir' to root."
                else
                    echo "Error: Failed to update permissions for '$dir' to root."
                fi
            fi
        fi
    done

    EXEC_PREFIX=""
fi

# Execute postinstall to auto-populate config.yaml with missing values and using the determined prefix
$EXEC_PREFIX npm run postinstall
exec $EXEC_PREFIX node server.js --listen "$@"