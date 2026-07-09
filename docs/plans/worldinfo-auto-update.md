# World Info Auto-Update Extension Implementation Plan

> **For Hermes:** Use the `subagent-driven-development` skill to implement this plan task-by-task.

**Goal:** Build a SillyTavern client extension that scans recent story/assistant messages, runs a separate analysis pass to infer lorebook/world-info updates, and presents the resulting changes in a git-diff-style approval UI before saving.

**Architecture:** Start as a browser-side extension, not a server plugin. The extension will (1) collect the latest story context from the current chat, (2) read the selected world info file, (3) rank candidate entries with a lightweight retrieval layer, (4) call an LLM to produce structured update proposals, and (5) show those proposals in an editable diff UI for user approval. Keep the entrypoint thin and split the workflow into small modules so the system can grow without becoming a monolith.

**Tech Stack:** SillyTavern client extension APIs, ES modules, `getContext()` from `st-context.js`, `eventSource`, `extension_settings`, `/api/worldinfo/*` endpoints, DOM-based modal/diff UI, and strict JSON output from the analysis LLM.

---

## Scope and design decisions

- Build this first as a client-side extension under `public/scripts/extensions/worldinfo-auto-update/`.
- Use a manual trigger button first. Auto-triggering can come later if the manual flow is stable.
- Treat world info updates as an approval workflow, not an automatic write.
- Preserve all unknown fields when saving world info so existing data is not corrupted.
- Prefer content-only updates in v1; add keywords/comment/metadata editing only after the basic flow is safe.
- Keep the LLM output structured and validated. Never apply raw freeform text directly.

---

## Planned file layout

Create:
- `public/scripts/extensions/worldinfo-auto-update/manifest.json`
- `public/scripts/extensions/worldinfo-auto-update/index.js`
- `public/scripts/extensions/worldinfo-auto-update/styles/main.css`
- `public/scripts/extensions/worldinfo-auto-update/prompts/analyze.txt`
- `public/scripts/extensions/worldinfo-auto-update/prompts/merge.txt`
- `public/scripts/extensions/worldinfo-auto-update/src/context-builder.js`
- `public/scripts/extensions/worldinfo-auto-update/src/worldinfo-loader.js`
- `public/scripts/extensions/worldinfo-auto-update/src/worldinfo-normalizer.js`
- `public/scripts/extensions/worldinfo-auto-update/src/retrieval.js`
- `public/scripts/extensions/worldinfo-auto-update/src/analyzer.js`
- `public/scripts/extensions/worldinfo-auto-update/src/patcher.js`
- `public/scripts/extensions/worldinfo-auto-update/src/diff.js`
- `public/scripts/extensions/worldinfo-auto-update/src/updater.js`
- `public/scripts/extensions/worldinfo-auto-update/src/storage.js`
- `public/scripts/extensions/worldinfo-auto-update/src/history.js`
- `public/scripts/extensions/worldinfo-auto-update/src/ui/approval-dialog.js`
- `public/scripts/extensions/worldinfo-auto-update/src/ui/diff-viewer.js`
- `public/scripts/extensions/worldinfo-auto-update/src/ui/settings-panel.js`
- `public/scripts/extensions/worldinfo-auto-update/styles/diff-viewer.css`

---

## Task 1: Create the extension scaffold

**Objective:** Add a loadable extension shell with manifest, styles, settings namespace, and a visible trigger button.

**Files:**
- Create: `public/scripts/extensions/worldinfo-auto-update/manifest.json`
- Create: `public/scripts/extensions/worldinfo-auto-update/index.js`
- Create: `public/scripts/extensions/worldinfo-auto-update/styles/main.css`

**Steps:**
1. Write a manifest with `display_name`, `loading_order`, `js`, `css`, `version`, `author`, and `description`.
2. Create a minimal `index.js` that registers the extension and exposes a button in the UI.
3. Add an extension settings object with defaults for enabled state, selected world info file, max messages, candidate count, confidence threshold, and update mode.
4. Wire the button to open a placeholder panel or modal.
5. Make sure the extension loads without console errors.

**Verification:**
- Reload SillyTavern and confirm the extension appears in the Extensions panel.
- Confirm the new button renders.
- Confirm browser console has no extension loading errors.

---

## Task 2: Build chat-context extraction

**Objective:** Collect the latest story/assistant responses and normalize them into analysis input.

**Files:**
- Create: `public/scripts/extensions/worldinfo-auto-update/src/context-builder.js`

**Steps:**
1. Use `getContext()` to access the current chat state.
2. Extract the latest assistant/story messages according to a configurable window size.
3. Normalize messages into a compact structure:
   - role
   - text
   - order/index
   - message id if available
4. Add guardrails to skip empty, metadata-only, or non-story messages.
5. Cap total character/token budget so the analysis prompt stays bounded.

**Verification:**
- Trigger the button and inspect the generated context bundle.
- Confirm the latest messages are included and the payload is bounded.

---

## Task 3: Load and normalize world info data

**Objective:** Read the active world info file and convert it into an update-safe in-memory model.

**Files:**
- Create: `public/scripts/extensions/worldinfo-auto-update/src/worldinfo-loader.js`
- Create: `public/scripts/extensions/worldinfo-auto-update/src/worldinfo-normalizer.js`

**Steps:**
1. Fetch the available world info list from `/api/worldinfo/list`.
2. Fetch the chosen world info file from `/api/worldinfo/get`.
3. Normalize each entry into a stable internal shape:
   - entry key/id
   - name/comment
   - content
   - keywords
   - ordering fields
   - original raw object
4. Preserve all fields not directly edited so serialization is lossless.
5. Build a lookup table by name, key, and keyword alias for retrieval.

**Verification:**
- Confirm the extension can load one real world info file.
- Confirm serialization round-trips without dropping fields.

---

## Task 4: Add a retrieval/ranking layer

**Objective:** Identify the most relevant lorebook entries for the latest context before calling the LLM.

**Files:**
- Create: `public/scripts/extensions/worldinfo-auto-update/src/retrieval.js`

**Steps:**
1. Implement a baseline scorer using keyword overlap, title/comment match, and phrase overlap.
2. Rank entries by relevance to the latest chat context.
3. Return top-k candidates with a short explanation for why each one matched.
4. Keep the first version deterministic and easy to debug.
5. Leave room for later semantic retrieval or embedding-based RAG if needed.

**Verification:**
- Given a sample message bundle, confirm the top candidates are sensible.
- Confirm the scorer returns an explanation for each candidate.

---

## Task 5: Create the LLM analysis pass

**Objective:** Use a separate model call to propose structured updates for the selected entries.

**Files:**
- Create: `public/scripts/extensions/worldinfo-auto-update/src/analyzer.js`
- Create: `public/scripts/extensions/worldinfo-auto-update/prompts/analyze.txt`
- Create: `public/scripts/extensions/worldinfo-auto-update/prompts/merge.txt`

**Steps:**
1. Construct a prompt containing the latest story context, candidate entries, and update rules.
2. Require strict JSON output from the LLM.
3. Include fields such as:
   - `entryId`
   - `action` (`update`, `create`, `skip`)
   - `proposedContent`
   - `proposedKeywords`
   - `reason`
   - `confidence`
   - `warnings`
4. Validate and sanitize the response before it reaches the UI.
5. Reject malformed JSON or low-confidence results.

**Verification:**
- Run the analysis on a known sample and confirm the output parses as valid JSON.
- Confirm malformed responses are handled safely.

---

## Task 6: Build diff generation and merge logic

**Objective:** Turn proposed edits into a clean git-diff-style representation and apply them safely later.

**Files:**
- Create: `public/scripts/extensions/worldinfo-auto-update/src/patcher.js`
- Create: `public/scripts/extensions/worldinfo-auto-update/src/diff.js`

**Steps:**
1. Compare the original entry with the proposed version.
2. Generate unified or side-by-side diff text.
3. Support content-only changes first.
4. Preserve untouched metadata fields when building the updated object.
5. Detect conflicts such as duplicate keywords or overlong content.

**Verification:**
- Confirm the diff output matches the actual proposed change.
- Confirm untouched fields remain unchanged in the merged object.

---

## Task 7: Build the approval UI

**Objective:** Let the user inspect, edit, approve, or reject suggestions before any save happens.

**Files:**
- Create: `public/scripts/extensions/worldinfo-auto-update/src/ui/approval-dialog.js`
- Create: `public/scripts/extensions/worldinfo-auto-update/src/ui/diff-viewer.js`
- Create: `public/scripts/extensions/worldinfo-auto-update/styles/diff-viewer.css`

**Steps:**
1. Create a modal/drawer that lists all candidate updates.
2. Show old content vs proposed content in a diff-friendly layout.
3. Add per-item controls for approve, reject, and inline edit.
4. Add bulk actions for approve all and reject all.
5. Display confidence and rationale prominently.

**Verification:**
- Confirm the user can approve/reject individual changes.
- Confirm edits made in the dialog are reflected in the pending patch.

---

## Task 8: Apply approved updates back to world info

**Objective:** Save approved changes using the existing world info API without corrupting the file.

**Files:**
- Create: `public/scripts/extensions/worldinfo-auto-update/src/updater.js`
- Create: `public/scripts/extensions/worldinfo-auto-update/src/history.js`

**Steps:**
1. Re-fetch the latest world info data before saving to avoid stale writes.
2. Apply only the approved diffs.
3. Use `/api/worldinfo/edit` for persistence.
4. Keep a local undo/history stack.
5. Optionally create a backup before writing.

**Verification:**
- Save a test change and confirm the file updates correctly.
- Reload the world info file and confirm the edits persist.

---

## Task 9: Add settings, storage, and UX polish

**Objective:** Make the extension usable repeatedly and safely.

**Files:**
- Create: `public/scripts/extensions/worldinfo-auto-update/src/storage.js`
- Create: `public/scripts/extensions/worldinfo-auto-update/src/ui/settings-panel.js`
- Modify: `public/scripts/extensions/worldinfo-auto-update/index.js`

**Steps:**
1. Persist user preferences in the extension settings namespace.
2. Add toggles for analysis window, candidate count, confidence threshold, and auto-open behavior.
3. Add notifications for success, no candidates, invalid JSON, and save failure.
4. Add clear error handling for missing world info or stale data.

**Verification:**
- Reload SillyTavern and confirm settings persist.
- Confirm error states are visible and actionable.

---

## Task 10: Validate the end-to-end flow

**Objective:** Prove the whole workflow works from button click to approved world info save.

**Test scenarios:**
1. Single entry updated from one assistant response.
2. Multiple entries updated from one response.
3. No relevant entry found.
4. Low-confidence suggestion rejected.
5. Conflicting suggestion marked with warnings.
6. Inline edit before approval.
7. Save and reload round trip.
8. Undo after save.

**Verification:**
- No console errors.
- Diff output matches the resulting saved file.
- Untouched fields remain unchanged.

---

## Future enhancement: server plugin only if needed

If browser-side model routing becomes too awkward, add a small server plugin later for:
- hidden API keys
- provider abstraction
- heavier retrieval/indexing
- background processing

Do not start there unless the browser extension hits a hard limit.

---

## Implementation sequence

1. Scaffold the extension
2. Extract chat context
3. Load world info data
4. Add retrieval/ranking
5. Add LLM JSON analysis
6. Build diff/merge logic
7. Build approval UI
8. Apply updates safely
9. Add settings/history/polish
10. Validate end-to-end

---

## Suggested first milestone

A minimal useful v1 is:
- one button
- latest assistant response only
- one selected world info file
- 3 top candidate entries
- one analysis LLM call
- diff approval dialog
- save only after explicit approval

That milestone proves the entire architecture before expanding scope.
