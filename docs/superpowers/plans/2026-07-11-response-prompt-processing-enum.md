# Response Prompt Processing Enum Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the boolean `minimal_prompt_processing` setting in the image generation extension with a three-state enum `prompt_processing` (`standard` / `minimal` / `off`), where `off` returns the LLM-generated prompt completely untouched (newlines preserved).

**Architecture:** Single atomic change across two files — `settings.html` (UI) and `index.js` (setting default, migration, `processReply` logic, load/save handlers, slash command mapping). The HTML element ID and JS references are interdependent, so all changes land in one commit. A migration step converts the old boolean to the new string enum on load.

**Tech Stack:** Vanilla JS (browser), jQuery for DOM, ESLint for linting. No test framework exists in this repo.

## Global Constraints

- No test runner exists — `npm run lint` is the only automated gate. Run it after the change.
- Do NOT read any user settings, saved character cards, or chats.
- Follow existing code style: jQuery DOM access via `$('#id')`, `extension_settings.sd.<key>` for storage, `saveSettingsDebounced()` after writes.
- i18n: new `data-i18n` keys carry inline English text as default; do not modify locale JSON files.
- The setting key is `prompt_processing` (string), values: `'standard'` | `'minimal'` | `'off'`. Default: `'standard'`.

---

### Task 1: Replace boolean minimal_prompt_processing with prompt_processing enum

**Files:**
- Modify: `public/scripts/extensions/stable-diffusion/settings.html:38-41` (checkbox → select)
- Modify: `public/scripts/extensions/stable-diffusion/index.js:283` (defaultSettings)
- Modify: `public/scripts/extensions/stable-diffusion/index.js:462-468` (migration in `loadSettings`)
- Modify: `public/scripts/extensions/stable-diffusion/index.js:547` (load UI value)
- Modify: `public/scripts/extensions/stable-diffusion/index.js:670-673` (save handler)
- Modify: `public/scripts/extensions/stable-diffusion/index.js:2896-2928` (`processReply`)
- Modify: `public/scripts/extensions/stable-diffusion/index.js:5407` (slash `settingMap`)
- Modify: `public/scripts/extensions/stable-diffusion/index.js:5410-5417` (slash `enumHandlers`)
- Modify: `public/scripts/extensions/stable-diffusion/index.js:5869` (event binding)

**Interfaces:**
- Consumes: `extension_settings.sd` (global settings object), `defaultSettings` (object literal in same file), `saveSettingsDebounced()` (imported util).
- Produces: `extension_settings.sd.prompt_processing` (string enum) replacing the old `minimal_prompt_processing` boolean. `processReply(str)` now has three branches. The slash command `--processing` arg now accepts `standard`/`minimal`/`off`.

- [ ] **Step 1: Change the default setting**

In `public/scripts/extensions/stable-diffusion/index.js`, in the `defaultSettings` object, find this line (around line 283):

```js
    minimal_prompt_processing: false,
```

Replace it with:

```js
    prompt_processing: 'standard',
```

- [ ] **Step 2: Add migration code in `loadSettings`**

In `public/scripts/extensions/stable-diffusion/index.js`, in `loadSettings()`, find this block (around lines 462-468):

```js
async function loadSettings() {
    // Initialize settings
    if (Object.keys(extension_settings.sd).length === 0) {
        Object.assign(extension_settings.sd, defaultSettings);
    }

    // Insert missing settings
```

Insert the following migration block **between** the `Object.assign` block and the `// Insert missing settings` comment:

```js
    // Migrate old boolean minimal_prompt_processing to new prompt_processing enum
    if (extension_settings.sd.prompt_processing === undefined
        && extension_settings.sd.minimal_prompt_processing !== undefined) {
        extension_settings.sd.prompt_processing =
            extension_settings.sd.minimal_prompt_processing ? 'minimal' : 'standard';
        delete extension_settings.sd.minimal_prompt_processing;
    }

```

This must run before the "Insert missing settings" loop so that the loop fills in `prompt_processing: 'standard'` for fresh installs (where neither key exists) but does not overwrite the migrated value.

- [ ] **Step 3: Update `processReply` to use the new enum**

In `public/scripts/extensions/stable-diffusion/index.js`, find the `processReply` function (around line 2896). It currently starts:

```js
function processReply(str) {
    if (!str) {
        return '';
    }

    if (extension_settings.sd.minimal_prompt_processing) {
        // Minimal prompt processing
        // JSON and similar should be preserved
        str = str.normalize('NFD');
        str = str.replace(/\s+/g, ' '); // Collapse multiple whitespaces into one
        str = str.trim();
        return str;
    }

    str = str.replaceAll('"', '');
```

Replace the empty-string guard and the `if (extension_settings.sd.minimal_prompt_processing)` block with:

```js
function processReply(str) {
    if (!str) {
        return '';
    }

    if (extension_settings.sd.prompt_processing === 'off') {
        // No processing — preserve raw LLM output including newlines
        return str;
    }

    if (extension_settings.sd.prompt_processing === 'minimal') {
        // Minimal prompt processing
        // JSON and similar should be preserved
        str = str.normalize('NFD');
        str = str.replace(/\s+/g, ' '); // Collapse multiple whitespaces into one
        str = str.trim();
        return str;
    }

    str = str.replaceAll('"', '');
```

The `'standard'` path (everything after the `minimal` block) remains unchanged as the implicit fallthrough.

- [ ] **Step 4: Replace the checkbox with a select dropdown in settings.html**

In `public/scripts/extensions/stable-diffusion/settings.html`, find this block (lines 38-41):

```html
            <label for="sd_minimal_prompt_processing" class="checkbox_label" data-i18n="[title]sd_minimal_prompt_processing" title="Reduce post-processing on a prompt generated by the LLM to preserve JSON and other structured output.">
                <input id="sd_minimal_prompt_processing" type="checkbox" />
                <span data-i18n="sd_minimal_prompt_processing_txt">Minimal response prompt processing</span>
            </label>
```

Replace it with:

```html
            <label for="sd_prompt_processing" data-i18n="[title]sd_prompt_processing" title="Controls post-processing on prompts generated by the LLM. Off preserves raw output including newlines. Minimal preserves JSON and structured output. Standard applies full sanitization.">
                <span data-i18n="sd_prompt_processing_txt">Response prompt processing</span>
            </label>
            <select id="sd_prompt_processing" class="text_pole">
                <option value="standard" data-i18n="sd_prompt_processing_standard">Standard</option>
                <option value="minimal" data-i18n="sd_prompt_processing_minimal">Minimal</option>
                <option value="off" data-i18n="sd_prompt_processing_off">Off</option>
            </select>
```

- [ ] **Step 5: Update the settings load line**

In `public/scripts/extensions/stable-diffusion/index.js`, find this line (around line 547):

```js
    $('#sd_minimal_prompt_processing').prop('checked', extension_settings.sd.minimal_prompt_processing);
```

Replace it with:

```js
    $('#sd_prompt_processing').val(extension_settings.sd.prompt_processing);
```

- [ ] **Step 6: Rename and rewrite the save handler**

In `public/scripts/extensions/stable-diffusion/index.js`, find this function (around lines 670-673):

```js
function onMinimalPromptProcessing() {
    extension_settings.sd.minimal_prompt_processing = !!$(this).prop('checked');
    saveSettingsDebounced();
}
```

Replace it with:

```js
function onPromptProcessingSelect() {
    extension_settings.sd.prompt_processing = String($(this).val());
    saveSettingsDebounced();
}
```

- [ ] **Step 7: Update the event binding**

In `public/scripts/extensions/stable-diffusion/index.js`, find this line (around line 5869):

```js
    $('#sd_minimal_prompt_processing').on('input', onMinimalPromptProcessing);
```

Replace it with:

```js
    $('#sd_prompt_processing').on('change', onPromptProcessingSelect);
```

- [ ] **Step 8: Update the slash command `settingMap`**

In `public/scripts/extensions/stable-diffusion/index.js`, in `applyCommandArguments`, find this line in the `settingMap` object (around line 5407):

```js
        'processing': 'minimal_prompt_processing',
```

Replace it with:

```js
        'processing': 'prompt_processing',
```

- [ ] **Step 9: Update the slash command `enumHandlers`**

In the same `applyCommandArguments` function, find this `enumHandlers` entry (around lines 5410-5417):

```js
        'processing': (value) => {
            if (/standard/gi.test(String(value))) {
                return false;
            }
            if (/minimal/gi.test(String(value))) {
                return true;
            }
        },
```

Replace it with:

```js
        'processing': (value) => {
            if (/standard/gi.test(String(value))) {
                return 'standard';
            }
            if (/minimal/gi.test(String(value))) {
                return 'minimal';
            }
            if (/off/gi.test(String(value))) {
                return 'off';
            }
        },
```

- [ ] **Step 10: Verify no stale references remain**

Search the two modified files for any remaining occurrences of the old identifier. Run:

```bash
rg -n "minimal_prompt_processing|onMinimalPromptProcessing|sd_minimal_prompt_processing" public/scripts/extensions/stable-diffusion/
```

Expected: **no matches** in `index.js` or `settings.html`. (Matches in `public/locales/zh-cn.json` are acceptable — those are stale i18n keys, left intentionally per the spec.)

If any match is found in `index.js` or `settings.html`, fix it before continuing.

- [ ] **Step 11: Run lint**

Run:

```bash
npm run lint
```

Expected: exits 0, no errors. If ESLint reports errors in the modified files, fix them.

- [ ] **Step 12: Commit**

```bash
git add public/scripts/extensions/stable-diffusion/settings.html public/scripts/extensions/stable-diffusion/index.js
git commit -m "feat(sd): replace minimal_prompt_processing with prompt_processing enum

Replaces the boolean 'Minimal response prompt processing' checkbox with a
three-state enum (standard/minimal/off). The new 'off' mode returns the
LLM-generated prompt completely untouched, preserving newlines.

Migrates existing saved settings from the old boolean to the new string
enum on load."
```

- [ ] **Step 13: Manual verification**

This step requires a running SillyTavern instance with an image generation backend configured. If a backend is not available, skip this step and note it for the user.

1. Start SillyTavern (`npm start`), open the UI.
2. Open Extensions → Image Generation settings.
3. Confirm the old "Minimal response prompt processing" checkbox is gone.
4. Confirm a "Response prompt processing" dropdown exists with three options: Standard, Minimal, Off.
5. Set it to "Off", generate an image via the wand menu or `/imagine` command using a prompt that the LLM returns with newlines. Confirm the prompt sent to generation preserves newlines (check the browser console or the refine-mode prompt editor if enabled).
6. Set it to "Minimal", generate again. Confirm behavior is as before (whitespace collapsed, JSON preserved).
7. Set it to "Standard", generate again. Confirm full sanitization (commas, quotes stripped).
8. Reload the page. Confirm the dropdown remembers the selected value (settings persisted + migrated).
