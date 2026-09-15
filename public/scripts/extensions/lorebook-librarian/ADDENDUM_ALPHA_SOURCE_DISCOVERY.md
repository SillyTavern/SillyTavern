# Lorebook Librarian Alpha Source Discovery Addendum

## Dry-Run World Info Scan Side Effects

During alpha implementation, source review confirmed that `checkWorldInfo(chat, maxContext, true)` is the right way to reuse SillyTavern's existing lorebook activation engine without applying timed effects. However, the original planning language was too broad when it implied that the dry run has no in-memory side effects at all.

Observed behavior in `public/scripts/world-info.js`:

- `WorldInfoTimedEffects` skips sticky/cooldown persistence when `isDryRun=true`.
- The constructor still ensures `chat_metadata.timedWorldInfo` exists.
- Prompt-building can call `context.setExtensionPrompt(...)` when World Info is combined with Author's Note behavior.
- `WORLDINFO_SCAN_DONE` is still emitted during the scan.

Alpha implementation response:

- Lorebook Librarian wraps `checkWorldInfo` in a local dry-scan helper.
- Before the scan, it snapshots `chat_metadata.timedWorldInfo` and `context.extensionPrompts`.
- After the scan, it restores those in-memory objects.
- It still does not call `saveWorldInfo`, `saveChat`, `saveMetadata`, or any lorebook write API.

This keeps the alpha aligned with the project requirement: the active chat model and lorebook data remain unchanged, and the scan is used only to obtain activated entries for read-only proposal generation.
