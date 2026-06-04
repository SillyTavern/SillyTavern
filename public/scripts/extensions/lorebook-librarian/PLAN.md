# Lorebook Librarian Alpha Plan

## Purpose

Lorebook Librarian is a client-side SillyTavern extension for proposing maintenance edits to currently active lorebook entries based on recent assistant messages. The alpha is a discovery and smoke-test milestone: it proves the data flow, lorebook search flow, separate model call flow, and proposal parsing flow before any lorebook writes are implemented.

> **Engineering reference:** the verified function calls, signatures, return
> shapes, public-vs-internal surface split, full data/ops flow diagram, and known
> gotchas live in [`PIPELINE_AND_CALL_FLOW.md`](./PIPELINE_AND_CALL_FLOW.md).
> That compendium is the source of truth for *how* the pipeline is wired; this
> plan covers *what* and *why*.
>
> **Source discovery addendum:** implementation-time corrections are recorded in
> [`ADDENDUM_ALPHA_SOURCE_DISCOVERY.md`](./ADDENDUM_ALPHA_SOURCE_DISCOVERY.md).

## Alpha Scope

- Build as a client-side extension under `public/scripts/extensions/lorebook-librarian/`.
- Trigger from both a slash command (`/lorelibrarian`) and a button near the World Info/lorebook UI.
- Read the last configurable number of assistant messages only.
- Use SillyTavern's existing active lorebook/world-info search/context machinery instead of a custom RAG implementation.
- Target the currently active lorebook context, initially the lorebooks related to the active character(s).
- Use a separate SillyTavern connection profile for lorebook proposal generation.
- Support OpenAI-style Chat Completion connection profiles only for alpha.
- Do not switch, mutate, or otherwise disturb the active chat connection/model.
- Prompt the summary/edit model to return plain JSON and parse it as a smoke test.
- Display generated proposals in a dedicated extension panel/drawer.
- Include a diagnostics/debug section showing the intermediate data at each pipeline stage.
- Do not write changes back to lorebooks in alpha.

## Non-Goals For Alpha

- No lorebook entry creation.
- No lorebook entry deletion, disabling, merging, or splitting.
- No automatic application of edits.
- No approval UI beyond displaying proposals.
- No git-like version control or persistent proposal history.
- No custom vector store or custom RAG implementation.
- No support for non-chat-completion summary profiles.
- No provider-specific prompt-cache optimization beyond keeping the Lorebook Librarian prompt structure stable.

## Allowed Proposal Operations

The proposal model may suggest edits only for existing entries returned by the active lorebook search/context flow:

- `update_content`: replace or revise existing entry content.
- `append_content`: append new durable facts to existing entry content.
- `update_keys`: add or adjust entry keywords/keys.

All proposals should reference stable lorebook entry identifiers wherever available. Entry title/name is display metadata, not the primary target key.

Example alpha output shape:

```json
{
    "proposals": [
        {
            "entryUid": 123,
            "entryTitle": "The Ashen Gate",
            "operation": "append_content",
            "reason": "Recent assistant messages established who controls the gate.",
            "proposedText": "The Ashen Gate is currently controlled by House Vael.",
            "proposedKeys": []
        }
    ]
}
```

## Data Flow

1. User triggers Lorebook Librarian with `/lorelibrarian` or the World Info-adjacent button.
2. Extension reads settings:
   - summary connection profile ID
   - number of assistant messages to inspect
   - debug visibility
   - proposal max tokens
3. Extension collects the last `N` assistant messages from the current chat.
4. Extension uses SillyTavern's active lorebook/world-info search/context machinery to identify relevant existing lorebook entries.
5. Extension builds a compact prompt containing:
   - stable system/developer instruction for the lorebook proposal task
   - recent assistant messages
   - relevant lorebook entry metadata/content
   - strict JSON output contract
6. Extension sends the prompt through the selected connection profile using SillyTavern's existing profile request service.
7. Extension captures the raw model response.
8. Extension parses JSON proposals.
9. Extension displays:
   - summary status
   - parsed proposals
   - raw response
   - debug data for each stage
10. Extension performs no lorebook writes.

## Model Call Flow

Use `ConnectionManagerRequestService` from `public/scripts/extensions/shared.js` if discovery confirms it remains suitable:

- It already sends extension requests through SillyTavern connection profiles.
- It can call chat-completion profiles without changing the active chat model.
- Alpha should reject unsupported profile types and ask the user to select a Chat Completion profile.

Planned alpha call shape:

```javascript
await ConnectionManagerRequestService.sendRequest(
    settings.summaryProfileId,
    messages,
    settings.maxResponseTokens,
    {
        stream: false,
        extractData: true,
        includePreset: true,
        includeInstruct: false,
    },
);
```

The implementation must verify the exact returned data shape during discovery before depending on it.

## Lorebook Search Discovery

The highest-risk alpha discovery item is reusing SillyTavern's active lorebook search/context behavior to obtain structured, addressable entries.

**Resolved (verified against source — see [`PIPELINE_AND_CALL_FLOW.md`](./PIPELINE_AND_CALL_FLOW.md)):**

- `getContext()` does NOT expose the matching engine. It exposes `getWorldInfoPrompt` (returns assembled prompt *text*, not addressable entries), `loadWorldInfo`, and `saveWorldInfo` — none of which yield structured entries with stable identifiers.
- A narrow, documented **internal import of `checkWorldInfo` from `public/scripts/world-info.js` is the PRIMARY path**, not a fallback. Use only its `allActivatedEntries` result. A custom search/RAG implementation remains out of scope.
- Activation is scoped to the **last-N assistant messages** (`string[]`, most-recent-first), run with `isDryRun=true` so nothing persists. Those same N messages double as the "what changed" evidence payload to the model.
- Proposals MUST carry `world` alongside `entryUid` — SillyTavern addresses entries by the composite `${world}.${uid}`, and `uid` is not globally unique.
- **Recall is bounded by the lorebook's own keying** (keyword/recursion match only). The Librarian can only propose edits to entries whose keys appear in recent text. This is an accepted, documented alpha limitation, not a bug.

Remaining discovery targets:

- Confirm the correct `maxContext` value to pass to `checkWorldInfo`.
- Confirm `entry.world` survives the lore merge / `structuredClone` on returned entries.
- Confirm `ExtractedData.content` is the right field for raw model text across targeted CC sources.

## UI Plan

Add a dedicated Lorebook Librarian panel/drawer with:

- Summary profile dropdown populated from supported Chat Completion connection profiles.
- Assistant message count setting.
- Max proposal token setting.
- Run button.
- Proposal results area.
- Collapsible diagnostics section.

Add a World Info-adjacent trigger button that opens/runs the same flow.

Register slash command:

```text
/lorelibrarian
```

Command arguments are deferred for alpha. Settings drive behavior.

## Diagnostics

Diagnostics should show enough state to validate the end-to-end flow and learn the internals:

- selected settings
- collected assistant messages
- active character/group context summary
- active lorebook/world names
- matched lorebook entries, including UID/title/keys/content excerpt
- generated prompt/messages sent to the summary model
- selected summary profile metadata
- raw model response
- parsed JSON result
- parse or request errors

Diagnostics should avoid exposing API keys or secrets.

## Error Handling

The alpha should display clear user-facing errors for:

- no active chat
- no assistant messages found
- connection manager disabled or unavailable
- no summary profile selected
- selected profile is not Chat Completion compatible
- no active/relevant lorebook entries found
- model request failure
- malformed JSON response

Failures should leave the active chat connection and lorebook data unchanged.

## Acceptance Criteria

Alpha is complete when:

- `/lorelibrarian` can run from an active chat.
- A World Info-adjacent button can start the same flow.
- The extension can collect the configured number of recent assistant messages.
- The extension can retrieve relevant entries from the active lorebook context using existing SillyTavern machinery.
- The extension can call a separate Chat Completion connection profile without changing the active chat model.
- The extension can display raw and parsed JSON proposals in its panel.
- The diagnostics panel shows each pipeline stage.
- No lorebook files or entries are modified.
- `npm run lint` passes for touched files, or any unrelated lint failures are documented.

## Future Milestones

1. Diff preview:
   - Show old vs proposed entry content.
   - Support entry-level accept/reject.

2. Approval and writes:
   - Apply only approved `update_content`, `append_content`, and `update_keys` changes.
   - Reuse existing world-info save/update APIs.

3. Granular review:
   - Add line-level or section-level approval.
   - Allow editing proposed text before apply.

4. Proposal persistence:
   - Save rejected or deferred proposals as drafts.
   - Consider git-like history only after core write safety is proven.

5. Policy controls:
   - Add strictness modes for durable canon facts vs scene state.
   - Add prompt templates per use case.

6. Test fixture:
   - Use the provided importable character and lorebook JSON for an end-to-end smoke test.
