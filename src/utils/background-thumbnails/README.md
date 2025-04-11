# Background Thumbnail Generation Script

This script generates preview thumbnails for SillyTavern backgrounds to improve performance in the selector menu.

## Purpose

SillyTavern can use small, static thumbnails in the background selection menu for better performance, especially with many large or animated backgrounds. This script creates those thumbnails.

## Requirements

1.  **Python 3:** Make sure Python 3 is installed.
2.  **Pillow Library:** Install the Pillow library:
    ```bash
    pip install Pillow
    ```

## Instructions

1.  Open a terminal or command prompt **in the main SillyTavern project root directory** (the one containing `start.bat`, `server.js`, `public`, `src`, `data`, etc.).
2.  Run the script using its path from the root:

    *Example on Windows:*
    ```bash
    python src\utils\background-thumbnails\generate_thumbnails.py
    ```
    *Example on Linux/macOS:*
    ```bash
    python src/utils/background-thumbnails/generate_thumbnails.py
    ```

The script will automatically target the default user backgrounds directory (`data/default-user/backgrounds/`), scan it for images, and create corresponding `_thumbnail` files in the `data/default-user/backgrounds/thumbnails/` subdirectory, skipping any thumbnails that already exist.