#!/bin/bash
# Script to update character lore in SillyTavern settings.json files
# Configuration - Edit these values for your specific character and books
TARGET_NAME="Tristan"
TEMPLATE_BOOKS=(
    "Z-hyperion-Ravenwood"
    
    "Z-hyperion-prompt"
)

# Base directory to search for settings.json files
BASE_DIR="/root/SillyTavern/data"

# Log file for recording changes
LOG_FILE="char_lore_update_$(date +%Y%m%d_%H%M%S).log"
touch "$LOG_FILE" && chmod 644 "$LOG_FILE"
echo "Starting update process at $(date)" > "$LOG_FILE"
echo "Target character: $TARGET_NAME" >> "$LOG_FILE"
echo "Template books: ${TEMPLATE_BOOKS[*]}" >> "$LOG_FILE"
echo "----------------------------------------" >> "$LOG_FILE"

# Function to check if an array contains a specific element
contains_element() {
    local element="$1"
    shift
    local array=("$@")
    for i in "${array[@]}"; do
        if [[ "$i" == "$element" ]]; then
            return 0
        fi
    done
    return 1
}

# Function to process each settings.json file
process_file() {
    local file="$1"
    local username=$(echo "$file" | grep -oP "/data/\K[^/]+(?=/settings\.json)")

    # Skip if username starts with underscore
    if [[ "$username" == _* ]]; then
        return
    fi

    echo "Processing file: $file (User: $username)" >> "$LOG_FILE"

    # Create a temporary file for modifications
    local temp_file=$(mktemp)

    # Use jq to check if charLore exists and contains the target name
    name_exists=$(jq --arg name "$TARGET_NAME" '.world_info_settings.world_info.charLore[] | select(.name == $name) | .name' "$file" 2>/dev/null)

    if [[ -n "$name_exists" ]]; then
        # Name exists, get current books
        current_books=$(jq --arg name "$TARGET_NAME" '.world_info_settings.world_info.charLore[] | select(.name == $name) | .extraBooks[]' "$file" 2>/dev/null | tr -d '"')
        readarray -t current_books_array <<< "$current_books"

        # Check if any books from template are missing
        missing_books=()
        for template_book in "${TEMPLATE_BOOKS[@]}"; do
            if ! contains_element "$template_book" "${current_books_array[@]}"; then
                missing_books+=("$template_book")
            fi
        done

        # Additional books that are in the current setup but not in the template
        additional_books=()
        for current_book in "${current_books_array[@]}"; do
            if ! contains_element "$current_book" "${TEMPLATE_BOOKS[@]}"; then
                additional_books+=("$current_book")
            fi
        done

        if [[ ${#missing_books[@]} -eq 0 && ${#additional_books[@]} -eq 0 ]]; then
            # Case 4a: extraBooks match exactly
            echo "  ✓ Case 4a: Name exists, extraBooks match exactly." >> "$LOG_FILE"
            echo "  ✓ No changes needed." >> "$LOG_FILE"
            rm "$temp_file"
            return
        elif [[ ${#missing_books[@]} -gt 0 ]]; then
            # Case 4b: Some books need to be inserted
            echo "  ! Case 4b: Name exists, but some books need to be inserted:" >> "$LOG_FILE"
            for book in "${missing_books[@]}"; do
                echo "    - Adding: $book" >> "$LOG_FILE"
            done

            # Create the combined book list (current books + missing books)
            combined_books=("${current_books_array[@]}" "${missing_books[@]}")

            # Convert to JSON array format
            json_books="$(printf '"%s",' "${combined_books[@]}" | sed 's/,$//')"

            # Use jq to update the extraBooks array for the matching name
            jq --arg name "$TARGET_NAME" --argjson books "[$json_books]" '
                (.world_info_settings.world_info.charLore[] | select(.name == $name)).extraBooks = $books
            ' "$file" > "$temp_file"

            # Get the line number of the modification
            line_num=$(grep -n "\"name\": \"$TARGET_NAME\"" "$file" | cut -d: -f1)
            echo "  ➤ Modified at approximately line $line_num" >> "$LOG_FILE"

            # If there were additional books
            if [[ ${#additional_books[@]} -gt 0 ]]; then
                echo "  ! Case 4c: There were additional books not in the template (preserved):" >> "$LOG_FILE"
                for book in "${additional_books[@]}"; do
                    echo "    - Kept: $book" >> "$LOG_FILE"
                done
            fi
        else
            # Case 4c: Only additional books, no insertions needed
            echo "  ! Case 4c: Name exists, has additional books not in template (preserved):" >> "$LOG_FILE"
            for book in "${additional_books[@]}"; do
                echo "    - Kept: $book" >> "$LOG_FILE"
            done
            echo "  ✓ No insertions needed." >> "$LOG_FILE"
            rm "$temp_file"
            return
        fi
    else
        # Case 5: Name does not exist, insert new entry
        echo "  + Case 5: Name does not exist, inserting new entry." >> "$LOG_FILE"

        # Convert template books to JSON array format
        json_books="$(printf '"%s",' "${TEMPLATE_BOOKS[@]}" | sed 's/,$//')"

        # Prepare the new charLore entry
        new_entry="{\"name\": \"$TARGET_NAME\", \"extraBooks\": [$json_books]}"

        # Use jq to add the new entry to the charLore array
        jq --argjson new_entry "$new_entry" '
            .world_info_settings.world_info.charLore += [$new_entry]
        ' "$file" > "$temp_file"

        # Get the line number where the insertion occurred
        line_num=$(grep -n "\"charLore\":" "$file" | cut -d: -f1)
        if [[ -z "$line_num" ]]; then
            line_num="unknown"
        else
            # Add a small offset to approximate the insertion point
            line_num=$((line_num + 1))
        fi
        echo "  ➤ Added at approximately line $line_num" >> "$LOG_FILE"
    fi

    # Apply changes if temporary file has content
    if [[ -s "$temp_file" ]]; then
        cp "$temp_file" "$file"
        echo "  ✓ File updated successfully." >> "$LOG_FILE"
    else
        echo "  ⚠ Error: Temporary file is empty, no changes applied." >> "$LOG_FILE"
    fi

    rm "$temp_file"
    echo "----------------------------------------" >> "$LOG_FILE"
}

# Find and process each settings.json file
find "$BASE_DIR" -type f -name "settings.json" | while read -r file; do
    process_file "$file"
done

echo "Update process completed at $(date)" >> "$LOG_FILE"

# Output a summary
total_files=$(grep -c "Processing file:" "$LOG_FILE")
no_changes=$(grep -c "  ✓ No changes needed" "$LOG_FILE")
updated=$(grep -c "  ✓ File updated successfully" "$LOG_FILE")
new_entries=$(grep -c "  + Case 5: Name does not exist" "$LOG_FILE")
errors=$(grep -c "  ⚠ Error:" "$LOG_FILE")

echo ""
echo "Summary:"
echo "  Total files processed: $total_files"
echo "  Files with no changes needed: $no_changes"
echo "  Files updated: $updated"
echo "  Files with new entries: $new_entries"
echo "  Files with errors: $errors"
echo ""
echo "Details in: $LOG_FILE"