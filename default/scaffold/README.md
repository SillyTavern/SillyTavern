# Content Scaffolding

Content files in this folder will be copied for all users (old and new) on the server startup.

1. You **must** create an `index.json` file in `/default/scaffold` for it to work. The syntax is the same as for default content.
2. All file paths should be relative to `/default/scaffold`, the use of subdirectories is allowed.
3. Scaffolded files are copied first, so they override any of the default files (presets/settings/etc.) that have the same file name.

## Example

```json
[
    {
        "filename": "themes/Midnight.json",
        "type": "theme"
    },
    {
        "filename": "backgrounds/city.png",
        "type": "background"
    },
    {
        "filename": "characters/Charlie.png",
        "type": "character"
    }
]
```
