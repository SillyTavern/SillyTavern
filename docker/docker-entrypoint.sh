#!/bin/sh

# Function to handle startup logic (Config check + Postinstall + Start)
start_sillytavern() {
    local PREFIX="$1"
    shift # Remove the first argument (PREFIX) so $@ contains the rest

    # Config Check
    if [ ! -e "config/config.yaml" ]; then
        echo "Resource not found, copying from defaults: config.yaml"
        $PREFIX cp -r "default/config.yaml" "config/config.yaml"
    fi

    # Execute postinstall to auto-populate config.yaml with missing values
    $PREFIX npm run postinstall

    # Start the server
    exec $PREFIX node server.js --listen "$@"
}

# Dirs that MUST be present at this point (e.g for volumeless docker runs).
# Please update list, if in the future a related perm issue appear.
CORE_DIRS="config data plugins public/scripts/extensions/third-party"

# Mounted Volumes (External)
# Parse mounts, handling files vs directories
RAW_MOUNTS=$(awk -v app_path="/home/node/app" '$2 ~ "^" app_path {print $2}' /proc/mounts)
MOUNTED_DIRS=""

for mount in $RAW_MOUNTS; do
    if [ -f "$mount" ]; then
        # If it is a mounted file (e.g. cert.pem), we want to check its PARENT directory
        # so that the app can write adjacent files (e.g. key.pem).
        PARENT_DIR=$(dirname "$mount")

        # Performance Safety: If the file is in the root of the app,
        # we do NOT add the parent (App Root), or we will recursively scan the whole app.
        if [ "$PARENT_DIR" = "/home/node/app" ]; then
            MOUNTED_DIRS="$MOUNTED_DIRS $mount"
        else
            MOUNTED_DIRS="$MOUNTED_DIRS $PARENT_DIR"
        fi
    else
        # It is a directory, add it directly
        MOUNTED_DIRS="$MOUNTED_DIRS $mount"
    fi
done

# Combine dirs for checks
CHECK_DIRS=$(echo "$CORE_DIRS $MOUNTED_DIRS" | tr ' ' '\n' | sort -u)

# Ensure the needed directories exist
for dir in $CHECK_DIRS; do
    if [ ! -e "$dir" ]; then
        echo "Creating missing directory: $dir"
        mkdir -p "$dir"
    fi
done

# Change permissions only if started as Root(UID 0) and needed.
if [ "$(id -u)" = "0" ]; then
    # Check if PUID/PGID variables are provided
    if [ -n "$PUID" ] && [ -n "$PGID" ]; then
        TARGET_UID=$PUID
        TARGET_GID=$PGID
        echo "Non-root mode requested (UID:$TARGET_UID GID:$TARGET_GID)."

        # Update the internal 'node' user to match requested IDs
        groupmod -o -g "$TARGET_GID" node
        usermod -o -u "$TARGET_UID" -g "$TARGET_GID" node

        for dir in $CHECK_DIRS; do
            if [ -d "$dir" ]; then
                # Runs chown only if there is an mismatch
                DIR_UID=$(stat -c '%u' "$dir")
                DIR_GID=$(stat -c '%g' "$dir")

                if [ "$DIR_UID" != "$TARGET_UID" ] || [ "$DIR_GID" != "$TARGET_GID" ]; then
                    echo "(Detected mismatch) Adjusting permissions for: $dir."
                    if ! chown -R node:node "$dir"; then
                        echo "Error: Failed to update permissions for '$dir'."
                    fi
                fi
            fi
        done

        # Fix config file specifically
        chown node:node "config/config.yaml" 2>/dev/null

        EXEC_PREFIX="su-exec node:node"
    else
        # Default: Run as Root (original behavior)
        echo "Running in default (root) mode."
        EXEC_PREFIX=""
    fi

else
    # Non-Root Mode (Docker CLI --user flag)
    echo "Running as detected user (UID: $(id -u))."
    # We CANNOT auto-fix permissions in this mode because we lack privileges.
    # Relying solely on the user configuring their host permissions correctly.
    EXEC_PREFIX=""
fi

# Calling function with the determined prefix
start_sillytavern "$EXEC_PREFIX" "$@"
