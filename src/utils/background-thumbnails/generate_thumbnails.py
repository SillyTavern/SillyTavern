# File: src/utils/background-thumbnails/generate_thumbnails.py
# Purpose: Generates static thumbnails for SillyTavern backgrounds.
# Usage: Can be run from any directory, finds paths relative to itself.

import os
from PIL import Image, UnidentifiedImageError
import sys

# Default relative path from project root to the user's backgrounds
DEFAULT_BACKGROUNDS_REL_PATH = os.path.join('data', 'default-user', 'backgrounds')
# Target thumbnail dimensions (width, height) - 16:9 aspect ratio
THUMBNAIL_SIZE = (320, 180)
# JPEG quality (if saving as JPEG)
THUMBNAIL_QUALITY = 75
# Output format ('JPEG' or 'PNG') - Use JPEG for smaller static files
THUMBNAIL_FORMAT = 'JPEG'

# Get the absolute path to the directory containing this script
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(script_dir, '..', '..', '..'))

# Construct the absolute paths using the calculated project root
backgrounds_dir = os.path.join(project_root, DEFAULT_BACKGROUNDS_REL_PATH)
thumbnails_dir = os.path.join(backgrounds_dir, 'thumbnails') # Subdir inside backgrounds

# Verify the calculated backgrounds directory exists
if not os.path.isdir(backgrounds_dir):
    print(f"Error: Calculated backgrounds directory not found at: {backgrounds_dir}", file=sys.stderr)
    print("Script location:", script_dir, file=sys.stderr)
    print("Calculated project root:", project_root, file=sys.stderr)
    sys.exit(1)

# Ensure the thumbnails subdirectory exists
try:
    os.makedirs(thumbnails_dir, exist_ok=True)
except OSError as e:
    print(f"Error: Could not create thumbnails directory: {thumbnails_dir}\n{e}", file=sys.stderr)
    sys.exit(1)

print(f"Project Root detected as: {project_root}")
print(f"Scanning for images in: {backgrounds_dir}")
print(f"Saving thumbnails to: {thumbnails_dir}")
print(f"Target thumbnail size: {THUMBNAIL_SIZE}")
print(f"Output format: {THUMBNAIL_FORMAT}")

supported_extensions = ('.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif')
processed_count = 0
skipped_count = 0
error_count = 0

# Iterate through files directly in the 'backgrounds' directory
for filename in os.listdir(backgrounds_dir):
    original_filepath = os.path.join(backgrounds_dir, filename)

    # Check if it's a file and has a supported extension
    if os.path.isfile(original_filepath) and filename.lower().endswith(supported_extensions):
        try:
            # Construct the expected thumbnail filename: basename_thumbnail.ext
            base_name, original_ext = os.path.splitext(filename)
            # Skip if filename somehow already ends in _thumbnail.ext to avoid loops
            if base_name.lower().endswith('_thumbnail'):
                 continue
            thumbnail_filename = f"{base_name}_thumbnail{original_ext}"
            thumbnail_filepath = os.path.join(thumbnails_dir, thumbnail_filename)

            # Skip if thumbnail already exists
            if os.path.exists(thumbnail_filepath):
                # print(f"Skipping (already exists): {thumbnail_filename}")
                skipped_count += 1
                continue

            # Open the original image
            print(f"Processing: {filename} -> {thumbnail_filename}")
            with Image.open(original_filepath) as img:
                # Ensure we're using the first frame for animated formats (GIF, animated WebP)
                img.seek(0)

                # Create a thumbnail (preserves aspect ratio while fitting bounds)
                img.thumbnail(THUMBNAIL_SIZE, Image.Resampling.LANCZOS) # Use high-quality downsampling

                # Save the thumbnail in the desired format
                save_img = img
                if THUMBNAIL_FORMAT == 'JPEG' and img.mode in ('RGBA', 'LA', 'P'):
                    bg = Image.new("RGB", img.size, (255, 255, 255)) # White background
                    # Handle palette images explicitly if needed (though pasting usually works)
                    try:
                       bg.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                    except ValueError as ve:
                        # Handle potential issue pasting palette image directly
                        print(f"  Info: Converting image '{filename}' to RGB due to mode '{img.mode}'.")
                        img_rgb = img.convert("RGB")
                        img_rgb.thumbnail(THUMBNAIL_SIZE, Image.Resampling.LANCZOS)
                        save_img = img_rgb # Use the converted version

                    save_img = bg # Use the version pasted onto background


                save_img.save(thumbnail_filepath, format=THUMBNAIL_FORMAT, quality=THUMBNAIL_QUALITY)
                processed_count += 1

        except UnidentifiedImageError:
            print(f"Error: Cannot identify image file (maybe corrupt?): {filename}", file=sys.stderr)
            error_count += 1
        except Exception as e:
            print(f"Error processing {filename}: {e}", file=sys.stderr)
            error_count += 1
    elif os.path.isdir(original_filepath) and filename == "thumbnails":
        # Skip the thumbnails directory itself when iterating
        pass

print("\n--- Summary ---")
print(f"Thumbnails generated: {processed_count}")
print(f"Skipped (already existed): {skipped_count}")
print(f"Errors: {error_count}")
print("---------------")