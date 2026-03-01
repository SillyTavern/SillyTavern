# Push Bot - Admin Character & Lorebook Distribution System

A complete push system for SillyTavern that lets admins (and optionally users) distribute characters with embedded lorebooks across all users on a multi-user server. Pushed lorebooks are locked, hidden, and protected from tampering. Re-pushing overwrites the lorebook and character card without touching anyone's chat history or memories.

---

## Table of Contents

1. [What This Does](#what-this-does)
2. [Files Overview](#files-overview)
3. [Installation](#installation)
4. [File-by-File Breakdown](#file-by-file-breakdown)
5. [How It Works](#how-it-works)
6. [Metadata Flags Reference](#metadata-flags-reference)
7. [Naming Conventions](#naming-conventions)
8. [Troubleshooting](#troubleshooting)

---

## What This Does

### Core Features

- **Push Character + Lorebook**: Admin (or user) selects a lorebook, picks target users, and pushes the lorebook + any linked character PNGs to those users in one click.
- **Bulk Push (Admin Only)**: Admin selects 1-10 lorebook-embedded characters and pushes all of them at once to selected users (or all users).
- **Overwrite on Re-Push**: Pushing again overwrites the existing lorebook and character card on target users. Chat files, memories, and personal data are never touched.
- **Locked & Hidden Lorebooks**: Pushed lorebooks are locked (non-admins can't edit) and hidden (non-admins don't see them in the lorebook list — they activate silently in the background).
- **Advanced Definitions Protection**: Pushed characters have their "Advanced Definitions" section (system prompt, personality, scenario, etc.) hidden and server-side protected from non-creator/non-admin users.
- **WorldInfoInfo Extension Compatibility**: Hidden lorebooks show a single "(hidden entries)" line in the WorldInfoInfo extension panel instead of leaking lorebook names.
- **One-Way Sync**: When the creator edits a pushed character or lorebook, changes auto-propagate to all recipients who still have the file.
- **Tamper Protection**: Server-side guards prevent users from stripping push metadata via crafted API requests.

---

## Files Overview

| File in this folder | Goes to (relative to SillyTavern root) | What it does |
|---|---|---|
| `index.html` | `public/index.html` | Two new buttons in the World Info toolbar |
| `world-info.js` | `public/scripts/world-info.js` | Push popup UI, bulk push popup, hidden lorebook filtering, 9z prefix trick |
| `script.js` | `public/script.js` | Advanced Definitions hiding for pushed characters, push notification polling |
| `worldinfo.js` | `src/endpoints/worldinfo.js` | Push & bulk-push server endpoints, push manifest, lorebook sync, lock checking, push notifications |
| `characters.js` | `src/endpoints/characters.js` | Advanced Definitions server-side protection, character sync, tamper protection |
| `settings.js` | `src/endpoints/settings.js` | Hidden lorebook filtering from the settings/world-names list |
| `style.css` | `public/style.css` | **Append** to end of file — gradient icon colors for push buttons |

---

## Installation

### Prerequisites

- A working SillyTavern installation with multi-user mode enabled
- At least one admin account and one or more regular user accounts
- Node.js and the SillyTavern dependencies already installed

### Steps

> **IMPORTANT**: Back up your existing files before replacing them. These are FULL file replacements, not patches.

1. **Stop SillyTavern** (or PM2):
   ```bash
   pm2 stop SillyTavern
   # or: ctrl+C if running directly
   ```

2. **Copy the files** to their correct locations:
   ```bash
   # From inside the Push Bot folder:
   cp index.html       /path/to/SillyTavern/public/index.html
   cp world-info.js    /path/to/SillyTavern/public/scripts/world-info.js
   cp script.js        /path/to/SillyTavern/public/script.js
   cp worldinfo.js     /path/to/SillyTavern/src/endpoints/worldinfo.js
   cp characters.js    /path/to/SillyTavern/src/endpoints/characters.js
   cp settings.js      /path/to/SillyTavern/src/endpoints/settings.js

   # style.css is NOT a full replacement — append it to the existing file:
   cat style.css >> /path/to/SillyTavern/public/style.css
   ```

3. **Restart SillyTavern**:
   ```bash
   pm2 restart SillyTavern
   # or: node server.js
   ```

4. **Verify**:
   - Log in as admin, open World Info panel. You should see:
     - A paper-plane icon (Push to Users) with a **teal gradient** icon - visible to all users
     - A boxes-stacked icon (Bulk Push Characters) with an **orange gradient** icon - visible to admins only
   - Log in as a non-admin user and confirm the Bulk Push button is hidden

---

## File-by-File Breakdown

### 1. `index.html` -> `public/index.html`

**What changed**: Two new buttons added to the World Info toolbar (around line 4672-4673).

```html
<div id="world_popup_share" class="menu_button fa-solid fa-paper-plane"
     title="Push to Users" style="display:none;"></div>
<div id="world_bulk_push" class="menu_button fa-solid fa-boxes-stacked"
     title="Bulk Push Characters" style="display:none;"></div>
```

- `#world_popup_share` - The single-push button (paper plane icon). Hidden by default, shown via JS for logged-in users.
- `#world_bulk_push` - The bulk-push button (stacked boxes icon). Hidden by default, shown via JS only for admin users.

Both are placed in the World Info editor toolbar row, after the Delete button.

---

### 2. `world-info.js` -> `public/scripts/world-info.js`

**What changed**: This is the largest set of client-side changes. Here's everything that was added:

#### a) Import additions (line 11)

```js
import { isAdmin, getCurrentUserHandle } from './user.js';
```

These are used throughout for permission checks.

#### b) 9z Prefix Trick for WorldInfoInfo Extension (lines ~893-958)

**Problem**: The third-party "WorldInfoInfo" extension displays all active lorebooks in a panel. Hidden/locked lorebooks would leak their names.

**Solution**: The WorldInfoInfo extension has a built-in `isHiddenWorld()` function that recognizes world names starting with `9z` and replaces them with a single "(hidden entries)" line. We prefix hidden lorebook names with `9z` before the extension event fires, then use a MutationObserver to clean up the displayed name.

```js
// MutationObserver strips "9z" prefix from panel headers
let _wiiObserverReady = false;
function ensureWiiPanelObserver() { ... }

// In the WORLD_INFO_ACTIVATED event handler:
// Prefix entry.world with "9z" for hidden lorebooks (non-admin only)
if (!isAdmin()) {
    for (const entry of arg) {
        const w = entry.world || '';
        if (w.startsWith('ADMIN-') || (w.startsWith('dd-') && creator !== handle)) {
            entry.world = '9z' + w;
        }
    }
    ensureWiiPanelObserver();
}
```

#### c) Hidden Lorebook Filtering in `getEntriesFromFile` (lines ~1124-1135)

Non-admin users who encounter `ADMIN-*` or `dd-{handle}-*` lorebook names in character data will have those entries silently filtered out from the WI editor view. The lorebooks still activate behind the scenes (because the data is loaded server-side), they just can't be viewed or edited.

```js
if (!isAdmin()) {
    const checkFile = file.startsWith('9z') ? file.substring(2) : file;
    if (checkFile.startsWith('ADMIN-')) return '';
    if (checkFile.startsWith('dd-')) {
        const creator = checkFile.split('-')[1];
        if (creator !== getCurrentUserHandle()) return '';
    }
}
```

#### d) Single Push Popup (lines ~2648-2793)

The `#world_popup_share` click handler opens a popup that:
1. Fetches the user list (`/api/users/get` for admins, `/api/worldinfo/admin-handles` for regular users)
2. Finds characters linked to the currently open lorebook
3. Shows a character name input field + user checkboxes with "Select All"
4. On confirm, calls `POST /api/worldinfo/push` with the lorebook name, target handles, and custom label
5. Shows a results toast: "3 new, 2 updated, 1 char(s) pushed"

**Naming**:
- Admin pushes create: `ADMIN-{label}`
- User pushes create: `dd-{userHandle}-{label}`

#### e) Bulk Push Popup (lines ~6217-6404)

The `#world_bulk_push` click handler (admin only) opens a popup with TWO sections:

**Characters section**:
- Lists all characters from the `characters` array that have `data.extensions.world` set (i.e., have an embedded lorebook)
- "Select All Characters" checkbox (limited to first 10)
- Individual character checkboxes showing character name + lorebook name
- Max 10 enforcement (disables unchecked boxes at the limit)
- Counter: "3 / 10 selected"

**Users section**:
- Fetches all users from `/api/users/get`
- "Select All Users" checkbox
- Individual user checkboxes (admin's own entry is disabled)
- Shows user name, handle, and admin/you badges

**Push button**: Dynamically updates label, e.g., "Push 3 -> 5 users"

On confirm, calls `POST /api/worldinfo/bulk-push` with `{ lorebooks: [...], targets: [...] }`.

Results toast shows per-lorebook breakdown: "**LorebookA**: 3 new, 2 updated, 5 char(s)"

---

### 3. `script.js` -> `public/script.js`

**What changed**: Three additions for hiding Advanced Definitions on pushed characters, plus push notification polling.

#### a) Import addition (line 251)

```js
import { currentUser, setUserControls, isAdmin, getCurrentUserHandle } from './scripts/user.js';
```

`isAdmin` and `getCurrentUserHandle` were added to the existing import.

#### b) `canAccessAdvancedDefs(chid)` helper (line ~8457)

```js
function canAccessAdvancedDefs(chid) {
    const ext = characters[chid]?.data?.extensions;
    if (!ext?.dreamtavern_pushed) return true;  // not a pushed character
    if (isAdmin()) return true;
    if (getCurrentUserHandle() === ext.dreamtavern_creator) return true;
    return false;
}
```

Returns `true` if the user can see the Advanced Definitions section. Returns `false` for pushed characters where the user is neither the creator nor an admin.

#### c) Toggle in `select_selected_character` (line ~8551)

```js
const advancedAllowed = canAccessAdvancedDefs(chid);
$('#advanced_div').toggle(advancedAllowed);
if (!advancedAllowed && is_advanced_char_open) {
    is_advanced_char_open = false;
    // close the popup if open
}
```

Hides the Advanced Definitions button when viewing a pushed character you don't own. Also closes the advanced popup if it was already open.

#### d) Re-show in `select_rm_create` (line ~8586)

```js
$('#advanced_div').show();
```

When switching to the "Create New Character" view, the Advanced Definitions button is always re-shown.

#### e) Push Notification Polling (inside `jQuery(async function () {`)

```js
setInterval(async () => {
    try {
        const resp = await fetch('/api/worldinfo/push-notifications', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({}),
        });
        if (resp.ok) {
            const notifications = await resp.json();
            for (const notif of notifications) {
                toastr.success(notif.message, 'DreamTavern', { timeOut: 10000 });
            }
        }
    } catch { /* silent */ }
}, 30000);
```

Polls the server every 30 seconds for push notifications. When the server returns pending notifications (e.g., after an admin pushes a new character), a green toastr notification is shown to the logged-in user with a 10-second display time. Users who are not logged in at the time of the push will simply see the new character when they next log in.

---

### 4. `worldinfo.js` -> `src/endpoints/worldinfo.js`

**What changed**: This file has the most server-side additions. Here's everything:

#### a) Push Manifest System (lines ~13-80)

A JSON file (`data/{handle}/push-manifest.json`) that tracks every push operation. Used for one-way sync and re-push tracking.

```js
getPushManifestPath(handle)     // Returns path to manifest file
readPushManifest(handle)        // Reads manifest (exported for use by characters.js)
writePushManifest(handle, data) // Writes manifest atomically
recordPush(creatorHandle, record) // Adds/merges a push record
```

Each record in the manifest looks like:
```json
{
    "source_lorebook": "MyLorebook",
    "pushed_lorebook_name": "ADMIN-MyLorebook",
    "character_files": ["character.png"],
    "recipients": ["user1", "user2"]
}
```

#### b) Push Notification Writer: `writePushNotification(handle, message)`

Writes a JSON notification file to `data/{handle}/push-notifications/{timestamp}.json`. Called at the end of both the `/push` and `/bulk-push` endpoints to notify each recipient that a new character was pushed to them. The client polls for these files via the `/push-notifications` endpoint (see below).

```js
function writePushNotification(handle, message) {
    const notifDir = path.join(path.dirname(userDirs.worlds), 'push-notifications');
    // Creates directory if needed, writes { message, ts } as JSON
}
```

#### c) Lock Checking: `checkLock(filePath, userProfile)` (lines ~82-110)

Reads a lorebook JSON and checks:
- `dreamtavern_locked: true` -> locked for everyone except the creator and admins
- Returns `{ locked: true/false, reason: "..." }`

Used by the `/edit` endpoint to prevent non-authorized users from modifying pushed lorebooks.

#### c) Hidden Lorebook Filtering in `/` (GET all lorebooks)

The endpoint that returns the list of world/lorebook names filters out:
- `ADMIN-*` lorebooks from non-admin users
- `dd-{handle}-*` lorebooks from users who aren't that handle
- Lorebooks with `dreamtavern_hidden: true` from non-creators

This means non-admins never see pushed lorebooks in their lorebook dropdown.

#### d) `POST /api/worldinfo/push` (lines ~345-474)

Single-push endpoint. Accepts:
```json
{
    "name": "LorebookName",
    "targets": ["handle1", "handle2"] or "all",
    "charLabel": "CustomLabel"
}
```

Logic:
1. Reads the source lorebook from the pusher's `worlds/` directory
2. Adds lock metadata: `dreamtavern_locked`, `dreamtavern_hidden`, `dreamtavern_creator`
3. Finds linked characters via `findCharactersByWorld()`
4. Builds the pushed filename:
   - Admin pushing own book: `ADMIN-{label}`
   - Admin pushing a user-sent `dd-*` book: keeps the `dd-{handle}-{label}` name as-is
   - Regular user pushing: `dd-{handle}-{label}`
5. For each target user:
   - **Overwrites** the lorebook JSON (or creates if new)
   - **Overwrites** character PNGs with updated world reference + push metadata
   - Chat files and memories are never touched (they live in `chats/`, not `characters/` or `worlds/`)
6. Records in push manifest
7. Returns: `{ pushed: [...], updated: [...], failed: [...], characters_pushed: [...] }`

Non-admin users can only push to admin accounts (enforced server-side).

#### e) `POST /api/worldinfo/bulk-push` (lines ~477-607)

Admin-only bulk push. Accepts:
```json
{
    "lorebooks": ["Lorebook1", "Lorebook2", ...],
    "targets": ["handle1", "handle2"]  // optional, defaults to all users
}
```

Logic:
1. Admin check (403 if not admin)
2. Validates 1-10 lorebooks
3. Resolves target users (from `targets` array, or all users minus admin)
4. For EACH lorebook:
   - Same push logic as single push (overwrite existing, stamp metadata)
   - Records in push manifest
5. Returns: `{ results: [{ lorebook, pushed, updated, failed, characters_pushed }, ...] }`

#### f) One-Way Lorebook Sync in `/edit` (lines ~304-340)

After a lorebook is saved, a fire-and-forget (`setImmediate`) task checks the push manifest. If this user previously pushed this lorebook, the edit is propagated to all recipients who still have the file:

```js
setImmediate(() => {
    const manifest = readPushManifest(creatorHandle);
    const records = manifest.filter(r => r.source_lorebook === lorebookName);
    for (const record of records) {
        for (const recipient of record.recipients) {
            // Copy updated lorebook to recipient, preserving lock metadata
            // Skip if recipient deleted the file
        }
    }
});
```

#### g) `POST /api/worldinfo/push-notifications` (polling endpoint)

Called by the client every 30 seconds. Reads all pending notification JSON files from the user's `push-notifications/` directory, returns them as an array, and deletes the files so they aren't shown again.

```js
router.post('/push-notifications', (request, response) => {
    // Reads data/{handle}/push-notifications/*.json
    // Returns array of { message, ts } objects
    // Deletes each file after reading
});
```

This is the server half of the notification system. The client half is the `setInterval` polling in `script.js` that calls this endpoint and shows toastr messages for each notification.

---

### 5. `characters.js` -> `src/endpoints/characters.js`

**What changed**: Advanced Definitions protection, character sync, and tamper protection.

#### a) Import addition (line 20)

```js
import { readWorldInfoFile, readPushManifest } from './worldinfo.js';
```

#### b) `ADVANCED_DEFINITION_FIELDS` constant (lines 33-47)

A list of all fields in the "Advanced Definitions" section that are protected on pushed characters:

```js
const ADVANCED_DEFINITION_FIELDS = [
    'system_prompt', 'post_history_instructions', 'personality',
    'scenario', 'depth_prompt_prompt', 'depth_prompt_depth',
    'depth_prompt_role', 'talkativeness', 'mes_example',
    'creator', 'creator_notes', 'character_version', 'tags',
];
```

#### c) `isAdvancedLocked(avatarPath, userProfile)` helper (lines 56-69)

Reads a character PNG, checks if it has `dreamtavern_pushed: true`, and returns `true` if the current user is neither the creator nor an admin. Used by three different endpoints.

#### d) Guard in `POST /api/characters/edit` (lines ~1197-1220)

When a non-authorized user edits a pushed character, the server silently restores all advanced definition fields from the original character data. The edit still succeeds (so the user can change things like the character's display name or avatar), but the system prompt, personality, scenario, etc. are reverted to the original values.

Also restores `depth_prompt` and `talkativeness` from the character's extensions.

#### e) Guard in `POST /api/characters/edit-attribute` (lines ~1384-1389)

If a single-field edit targets an advanced definition field on a pushed character, returns `403 Forbidden`.

#### f) Guard in `POST /api/characters/merge-attributes` (lines ~1441-1448)

Strips all advanced definition fields from the update object before merging, so bulk attribute updates can't modify protected fields.

#### g) Tamper Protection in `charaFormatData()` (lines ~703-709)

When a character card is formatted for saving, the server checks if the original `json_data` had `dreamtavern_pushed: true`. If so, it re-asserts the push metadata regardless of what the client sent:

```js
const origExt = tryParse(data.json_data)?.data?.extensions;
if (origExt?.dreamtavern_pushed) {
    _.set(char, 'data.extensions.dreamtavern_pushed', true);
    _.set(char, 'data.extensions.dreamtavern_creator', origExt.dreamtavern_creator);
}
```

This prevents a user from crafting a request that strips the `dreamtavern_pushed` flag to bypass protections.

#### h) One-Way Character Sync in `POST /api/characters/edit` (lines ~1240-1302)

After a character edit is saved, a fire-and-forget (`setImmediate`) task checks the push manifest. If this creator has previously pushed this character, the updated card is propagated to all recipients:

```js
setImmediate(() => {
    const manifest = readPushManifest(syncCreatorHandle);
    // Find records that include this character file
    // For each recipient who still has the file:
    //   - Clone creator's card data
    //   - Preserve recipient's world reference (their ADMIN-* name)
    //   - Re-stamp dreamtavern_pushed + dreamtavern_creator
    //   - Write updated PNG
    //   - Invalidate memory/disk caches
});
```

---

### 6. `settings.js` -> `src/endpoints/settings.js`

**What changed**: Hidden lorebook filtering in the settings endpoint that returns world/lorebook names to the client.

#### Lorebook Name Filtering (lines ~252-287)

When the server returns the list of available lorebooks (used to populate dropdowns), it filters out hidden ones for non-admin users:

```js
const isAdmin = request.user.profile?.admin;
const userHandle = request.user.profile?.handle;
const world_names = worldFiles.filter(file => {
    if (isAdmin) return true;
    const baseName = path.parse(file).name;
    // ADMIN-* lorebooks: hidden from ALL non-admin users
    if (baseName.startsWith('ADMIN-')) return false;
    // dd-{handle}-* lorebooks: visible only to that handle
    if (baseName.startsWith('dd-')) {
        const parts = baseName.split('-');
        if (parts[1] === userHandle) return true;
        return false;
    }
    // Check internal dreamtavern_hidden flag
    // ...
});
```

This is the secondary filtering layer (the primary one is in `worldinfo.js`). It ensures that even if a lorebook somehow bypasses the World Info endpoint filtering, it still won't appear in settings-based dropdowns.

---

### 7. `style.css` -> **Append** to `public/style.css`

> **NOTE**: Unlike the other files, `style.css` is NOT a full replacement. Append its contents to the end of the existing `public/style.css`.

**What it does**: Applies gradient colors to the push button icons so they stand out in the World Info toolbar.

- **Single Push** (`#world_popup_share`) — paper-plane icon gets a **teal gradient** (`#0d9488` to `#2dd4bf`)
- **Bulk Push** (`#world_bulk_push`) — boxes-stacked icon gets an **orange gradient** (`#ea580c` to `#fb923c`)

```css
#world_popup_share.menu_button::before {
    background: linear-gradient(135deg, #0d9488, #2dd4bf);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
}

#world_bulk_push.menu_button::before {
    background: linear-gradient(135deg, #ea580c, #fb923c);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
}
```

The `background-clip: text` technique renders the gradient through the Font Awesome icon glyph while keeping the button itself styled normally by the theme.

---

## How It Works

### Push Flow (Single)

```
Admin opens World Info panel
  -> Opens a lorebook
  -> Clicks paper-plane (Push to Users) button
  -> Popup shows: linked characters, name input, user checkboxes
  -> Admin selects users (or Select All) and confirms
  -> Client sends POST /api/worldinfo/push
  -> Server:
     1. Reads lorebook JSON
     2. Stamps lock metadata (dreamtavern_locked, dreamtavern_hidden, dreamtavern_creator)
     3. Finds linked character PNGs
     4. For each target user:
        - Writes ADMIN-{name}.json to their worlds/ folder (overwrites if exists)
        - Writes character PNGs to their characters/ folder with updated world reference (overwrites if exists)
     5. Records push in push-manifest.json
     6. Writes a push notification file for each recipient
  -> Toast (admin): "3 new, 2 updated, 1 char(s) pushed"
  -> Toast (recipients): Within 30s, logged-in recipients see "New character added! Please refresh your browser"
```

### Bulk Push Flow (Admin Only)

```
Admin opens World Info panel
  -> Clicks boxes-stacked (Bulk Push) button
  -> Popup shows TWO sections:
     - Characters: checkboxes for all lorebook-embedded characters (max 10)
     - Users: checkboxes for all server users (with Select All)
  -> Admin selects characters and users, confirms
  -> Client sends POST /api/worldinfo/bulk-push
  -> Server processes each lorebook the same way as single push
  -> Server writes push notifications for all recipients (de-duped)
  -> Toast (admin): per-lorebook breakdown
  -> Toast (recipients): Within 30s, logged-in recipients see "New character added! Please refresh your browser"
```

### Re-Push / Update Flow

```
Creator updates a character's lorebook entries
  -> Admin re-pushes (single or bulk)
  -> Server OVERWRITES existing lorebook JSON and character PNGs
  -> Users' chat files (data/{handle}/chats/) are UNTOUCHED
  -> Users' memories and personal data are UNTOUCHED
  -> Toast shows "updated" count instead of "skipped"
```

### What Gets Overwritten vs. What's Safe

| Data | On Re-Push | Location |
|---|---|---|
| Lorebook JSON | OVERWRITTEN with creator's latest | `data/{handle}/worlds/` |
| Character PNG (card data) | OVERWRITTEN with creator's latest | `data/{handle}/characters/` |
| Chat history | UNTOUCHED | `data/{handle}/chats/` |
| Chat memories | UNTOUCHED | Stored per-chat, not in character PNG |
| User settings | UNTOUCHED | `data/{handle}/settings.json` |
| Other characters | UNTOUCHED | Only the specific pushed character is affected |

---

## Metadata Flags Reference

### Lorebook Extensions (`lorebookData.extensions`)

| Flag | Type | Meaning |
|---|---|---|
| `dreamtavern_locked` | boolean | `true` = non-creator/non-admin users can't edit this lorebook |
| `dreamtavern_hidden` | boolean | `true` = non-creator/non-admin users can't see this lorebook in dropdowns |
| `dreamtavern_creator` | string | The handle of the user who created/pushed this lorebook |

### Character Extensions (`charData.data.extensions`)

| Flag | Type | Meaning |
|---|---|---|
| `dreamtavern_pushed` | boolean | `true` = this character was pushed; Advanced Definitions are protected |
| `dreamtavern_creator` | string | The handle of the user who pushed this character |
| `world` | string | The lorebook name this character is linked to (updated to `ADMIN-*` or `dd-*-*` on push) |

### Push Manifest (`data/{handle}/push-manifest.json`)

Array of records:
```json
[
    {
        "source_lorebook": "OriginalName",
        "pushed_lorebook_name": "ADMIN-OriginalName",
        "character_files": ["character.png"],
        "recipients": ["user1", "user2", "user3"]
    }
]
```

---

## Naming Conventions

| Who pushes | Source lorebook | Pushed lorebook name | Example |
|---|---|---|---|
| Admin (own book) | `MyLorebook` | `ADMIN-{label}` | `ADMIN-TavernLore` |
| Admin (user-sent book) | `dd-john-MyBook` | `dd-{handle}-{label}` (kept as-is) | `dd-john123-MyCharacter` |
| Regular user | `MyLorebook` | `dd-{handle}-{label}` | `dd-john123-MyCharacter` |

- `ADMIN-*` lorebooks are hidden from ALL non-admin users
- `dd-{handle}-*` lorebooks are visible only to that specific user + admins
- When an admin pushes a `dd-*` lorebook (one that a user sent to them), the `dd-` naming is preserved and the original user remains the `dreamtavern_creator`. This keeps ownership with the original creator while allowing server-wide distribution.
- The `9z` prefix is a client-side-only trick for the WorldInfoInfo extension and is never written to disk

---

## Troubleshooting

### Push button doesn't appear
- Make sure you're logged in (multi-user mode must be enabled)
- The buttons are hidden by default and shown via JavaScript. Hard-refresh the page (Ctrl+Shift+R)
- Check browser console for JS errors

### Bulk Push button doesn't appear
- This button is admin-only. Verify your account has admin privileges
- Check that `isAdmin()` returns `true` in the browser console

### "No characters with embedded lorebooks found"
- Characters must have `data.extensions.world` set to a lorebook name
- Open a character, go to Advanced Definitions, and link a World Info / Lorebook to it

### Pushed lorebook shows up for regular users
- Check that the lorebook JSON has `dreamtavern_hidden: true` in its extensions
- Check that the filename starts with `ADMIN-` or `dd-{handle}-`
- Hard-refresh the page to reload the filtered lorebook list

### Users can still edit Advanced Definitions
- The client-side button hiding is a convenience measure. The real protection is server-side
- Check that the character PNG has `dreamtavern_pushed: true` and `dreamtavern_creator` set in its extensions
- The server silently restores advanced fields even if the client somehow sends modified values

### Re-push still shows "skipped" instead of "updated"
- Make sure you have the latest version of `worldinfo.js` (the endpoint file). The old version skipped existing files; the new version overwrites them.

### One-way sync not working
- The sync is fire-and-forget (`setImmediate`). Check PM2 logs for `[Sync]` messages
- The push manifest must exist at `data/{handle}/push-manifest.json`
- The recipient must still have the file (if they deleted it, sync is skipped)
- Sync requires the creator to edit via the SillyTavern UI (direct file edits won't trigger it)
