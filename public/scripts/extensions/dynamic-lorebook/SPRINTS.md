# Dynamic Lorebook Manager — SCRUM Sprint Plan

**Epic:** Implement the Dynamic Lorebook Manager SillyTavern extension
**Target branch:** `staging`
**Status key:** ✅ Done · 🔄 In Progress · ⬜ Pending

---

## Epic Summary

Build a SillyTavern extension that automatically detects lorebook entry activations during chat
generation, analyzes the AI response for new/expanded lore using the active LLM API, and
presents a diff-based approval dialog for the user to accept, edit, or reject changes before
they are written back to the lorebook.

---

## Sprint 0 — Scaffolding & Project Setup

**Goal:** A loadable extension skeleton wired into SillyTavern with no console errors.

| # | Task | Status | File(s) |
|---|------|--------|---------|
| 0.1 | Create `manifest.json` | ✅ | `manifest.json` |
| 0.2 | Create `index.js` entry point | ✅ | `index.js` |
| 0.3 | Create `src/utils.js` helper utilities | ✅ | `src/utils.js` |
| 0.4 | Create `index.html` settings panel template | ✅ | `index.html` |
| 0.5 | Create `styles/main.css` base styles | ✅ | `styles/main.css` |

**Acceptance Criteria:**
- Extension appears in the ST Extensions panel
- No console errors on load
- Settings panel renders correctly (collapsed drawer)

---

## Sprint 1 — Entry Detection

**Goal:** Extension reliably records which lorebook entries were active for each AI message.

| # | Task | Status | File(s) |
|---|------|--------|---------|
| 1.1 | Fix design-doc bug: use `event_types.WORLD_INFO_ACTIVATED` (not `WORLDINFO_ACTIVATED`) | ✅ | `index.js` |
| 1.2 | Implement `EntryDetector` class | ✅ | `src/detector.js` |
| 1.3 | Handle `GENERATION_STARTED` → reset pending activations | ✅ | `src/detector.js` |
| 1.4 | Handle `WORLD_INFO_ACTIVATED` → accumulate entries into pending buffer | ✅ | `src/detector.js` |
| 1.5 | Handle `MESSAGE_RECEIVED` → associate pending activations with message ID | ✅ | `src/detector.js` |
| 1.6 | Subscribe / unsubscribe cleanly on enable / disable | ✅ | `index.js` |
| 1.7 | Prune history to last 100 messages | ✅ | `src/detector.js` |

**Event signatures (real ST API):**
- `WORLD_INFO_ACTIVATED` → `(WIEntry[])` — array of activated entry objects
- `MESSAGE_RECEIVED` → `(messageId: number, type: string)` — `messageId` is chat array index
- `GENERATION_STARTED` → `(type, options, dryRun)`

**Acceptance Criteria:**
- After generation, `detector.getActivationsForMessage(id)` returns the correct entries
- No memory leak after 100+ messages

---

## Sprint 2 — AI Analysis Engine

**Goal:** Extension can submit a response + activated entries to the LLM and receive structured JSON.

| # | Task | Status | File(s) |
|---|------|--------|---------|
| 2.1 | Implement `sendAnalysisRequest(system, user)` | ✅ | `src/api-client.js` |
| 2.2 | Support chat-completion APIs (OpenAI-family) via `/api/backends/chat-completions/generate` | ✅ | `src/api-client.js` |
| 2.3 | Support text-completion APIs (KoboldAI / TextGen) via `/api/backends/text-completions/generate` | ✅ | `src/api-client.js` |
| 2.4 | Graceful error for unsupported API types | ✅ | `src/api-client.js` |
| 2.5 | Implement `ResponseAnalyzer` class with `analyzeMessage()` | ✅ | `src/analyzer.js` |
| 2.6 | Build analysis prompt from entry data | ✅ | `src/analyzer.js` |
| 2.7 | Parse + validate LLM JSON output; handle malformed responses | ✅ | `src/analyzer.js` |
| 2.8 | LRU analysis cache (100 entries, key = hash of text + entry UIDs) | ✅ | `src/analyzer.js` |
| 2.9 | Retry with exponential backoff on API failure (3 attempts) | ✅ | `src/api-client.js` |

**Analysis prompt contract:**
- Input: activated entries (uid, world, comment, keywords, content) + AI message text
- Output JSON: `{ updates: [...], newEntities: [...] }` per schema in ARCHITECTURE.md

**Acceptance Criteria:**
- Calling `analyzeMessage()` returns a valid `AnalysisResult` with `updates[]` and `newEntities[]`
- Empty result (not an error) when AI adds no new information
- Malformed LLM response returns empty result, does not crash

---

## Sprint 3 — Suggestion Pipeline

**Goal:** Raw analysis results are filtered, ranked, enriched with diffs, and ready for the UI.

| # | Task | Status | File(s) |
|---|------|--------|---------|
| 3.1 | Implement `UpdateSuggester.generateSuggestions()` | ✅ | `src/suggester.js` |
| 3.2 | Filter by `minConfidence` setting | ✅ | `src/suggester.js` |
| 3.3 | Implement aggressiveness filter (conservative / balanced / aggressive) | ✅ | `src/suggester.js` |
| 3.4 | Compute character-level diffs via `diff_match_patch` (global from `lib.js`) | ✅ | `src/suggester.js` |
| 3.5 | Implement `calculateImpact()` score | ✅ | `src/suggester.js` |
| 3.6 | Rank suggestions by confidence → impact | ✅ | `src/suggester.js` |
| 3.7 | Wire pipeline: detector → analyzer → suggester in `index.js` | ✅ | `index.js` |
| 3.8 | Configurable analysis delay / debounce (default 2 s) | ✅ | `index.js` |

**Acceptance Criteria:**
- `generateSuggestions()` returns a sorted `Suggestion[]` with pre-computed diffs
- Zero-length array when nothing passes filters (not an error)

---

## Sprint 4 — Lorebook Updater & History

**Goal:** Approved suggestions are written to lorebooks with full undo/redo.

| # | Task | Status | File(s) |
|---|------|--------|---------|
| 4.1 | Implement `LorebookUpdater.applySuggestion()` | ✅ | `src/updater.js` |
| 4.2 | Implement `applySuggestions()` batch path (group by world name) | ✅ | `src/updater.js` |
| 4.3 | Backup entry before mutation | ✅ | `src/updater.js` |
| 4.4 | Update keywords if `updateFields` includes `'keywords'` | ✅ | `src/updater.js` |
| 4.5 | Implement `restoreBackup()` for undo | ✅ | `src/updater.js` |
| 4.6 | Implement `createEntry()` for new-entity suggestions | ✅ | `src/updater.js` |
| 4.7 | Implement `UpdateHistory` class with localStorage persistence | ✅ | `src/storage.js` |
| 4.8 | Implement `addUpdate()`, `peekUndo()`, `commitUndo()`, `peekRedo()`, `commitRedo()` | ✅ | `src/storage.js` |
| 4.9 | Circular buffer capped at `maxHistorySize` (default 50) | ✅ | `src/storage.js` |

**Acceptance Criteria:**
- Approved suggestion content appears in the lorebook after apply
- Undo restores the original content
- History persists across page refresh

---

## Sprint 5 — UI: Settings Panel & Notification

**Goal:** Users can configure the extension; status feedback is unobtrusive.

| # | Task | Status | File(s) |
|---|------|--------|---------|
| 5.1 | Create `styles/main.css` with CSS variables and `dlm-` prefixed classes | ✅ | `styles/main.css` |
| 5.2 | Create `index.html` settings panel template (inline-drawer pattern) | ✅ | `index.html` |
| 5.3 | Wire settings panel inputs to `extension_settings.dynamic_lorebook` | ✅ | `index.js` |
| 5.4 | Persist settings via `saveSettingsDebounced()` | ✅ | `index.js` |
| 5.5 | Notification helpers wrapping `toastr` (success / info / warning / error) | ✅ | `index.js` |

**Acceptance Criteria:**
- All settings save and reload correctly across page refresh
- Toast notifications appear and auto-dismiss

---

## Sprint 6 — UI: Diff Viewer & Approval Dialog

**Goal:** Users can review, edit, approve, or reject each suggestion in a modal dialog.

| # | Task | Status | File(s) |
|---|------|--------|---------|
| 6.1 | Create `styles/diff-viewer.css` | ✅ | `styles/diff-viewer.css` |
| 6.2 | Implement `DiffViewer` — renders `diff_match_patch` output as HTML | ✅ | `src/ui/diff-viewer.js` |
| 6.3 | Implement `SuggestionCard` — header, diff, reasoning, keyword tags, edit textarea, actions | ✅ | `src/ui/approval-dialog.js` |
| 6.4 | Card state machine: pending → approved / rejected / editing → edited → approved | ✅ | `src/ui/approval-dialog.js` |
| 6.5 | Implement `ApprovalDialog` modal — summary stats, confidence filter, sort, batch footer | ✅ | `src/ui/approval-dialog.js` |
| 6.6 | Implement `HistoryPanel` — update list, undo/redo buttons, export | ✅ | `src/ui/history-panel.js` |
| 6.7 | Add "Analyze" button to AI messages via `CHARACTER_MESSAGE_RENDERED` | ✅ | `index.js` |
| 6.8 | Keyboard shortcuts: `Ctrl+Enter` apply, `Esc` close | ✅ | `src/ui/approval-dialog.js` |

**Acceptance Criteria:**
- Diff viewer shows green/red highlights for added/removed text
- Each card can be independently approved, rejected, or edited
- "Apply Selected" applies only approved/edited cards
- History panel shows applied updates with working Undo

---

## Sprint 7 — Integration & Error Handling

**Goal:** All modules wired end-to-end; robust failure handling; linting clean.

| # | Task | Status | File(s) |
|---|------|--------|---------|
| 7.1 | Wrap all async paths in `try/catch` with `[DLM]`-prefixed console logs | ✅ | all |
| 7.2 | Handle "no entries activated" — skip analysis silently | ✅ | `index.js` |
| 7.3 | Handle "no suggestions generated" — silent or debug-mode toast | ✅ | `index.js` |
| 7.4 | Handle unsupported API type — show warning in settings panel | ✅ | `index.js` |
| 7.5 | Handle malformed LLM JSON — log raw response, skip silently | ✅ | `src/analyzer.js` |
| 7.6 | Status widget in settings panel — pending count, last-update time | ✅ | `index.js` |
| 7.7 | Debug mode — log analysis prompt and raw LLM response | ✅ | `src/analyzer.js` |
| 7.8 | `npm run lint` passes with zero errors | ✅ | all |

**Acceptance Criteria:**
- Full end-to-end flow: chat → activation → analysis → approval → undo
- No unhandled promise rejections
- ESLint clean (4-space, single quotes, semicolons, trailing commas)

---

## Sprint 8 — Polish & Hardening (future)

| # | Task | Status |
|---|------|--------|
| 8.1 | Token-budget guard on suggested content | ⬜ |
| 8.2 | New-entity creation flow (Create Entry button) | ⬜ |
| 8.3 | Move design `.md` files to `docs/` subdirectory | ⬜ |
| 8.4 | PR targeting `staging` branch | ⬜ |

---

## Dependency Graph

```
S0 (scaffold)
  └─► S1 (detection)
        └─► S2 (analysis)
              └─► S3 (pipeline)
                    ├─► S4 (updater/history)
                    ├─► S5 (settings UI)
                    └─► S6 (diff/dialog UI)
                          └─► S7 (integration)
                                └─► S8 (polish)
```

S4, S5, S6 can be developed in parallel once S3 is complete.

---

## Key Bugs Found in Design Docs

| Bug | Location | Fix |
|-----|----------|-----|
| `event_types.WORLDINFO_ACTIVATED` does not exist | API_REFERENCE.md, ARCHITECTURE.md | Use `event_types.WORLD_INFO_ACTIVATED` (snake_case, with underscore between WORLD and INFO) |
| Event payload described as `{entries, scanState}` object | API_REFERENCE.md | Real payload is a flat `WIEntry[]` array from `allActivatedEntries.values()` |
| `MESSAGE_RECEIVED` payload described as `{messageId, text, ...}` | API_REFERENCE.md | Real signature: `(messageId: number, type: string)` — text must be fetched from `chat[messageId].mes` |
