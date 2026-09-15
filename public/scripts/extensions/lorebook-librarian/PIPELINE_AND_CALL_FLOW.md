# Lorebook Librarian — Pipeline & Call-Flow Compendium

> Companion to `PLAN.md`. This document is the grounded engineering reference for
> the alpha pipeline: the exact SillyTavern function calls the extension makes,
> their verified signatures and return shapes, the public-vs-internal surface
> split, and the known gotchas that will otherwise bite at debug time.
>
> All signatures below were verified against the SillyTavern source at authoring
> time. File/line references are anchors, not contracts — re-verify during
> implementation discovery before depending on any internal shape.

## Naming

This component is the **Lorebook Librarian**: a read-only curator that reconciles
authoritative canon (lorebook entries) against recent narrative drift. It is not a
"janitor" — the job is curatorial (re-shelve / correct existing canon), not custodial.

## Core Design Principle

**The lorebook is authoritative; the recent chat is only drift evidence.**

The summary model derives its worldview primarily from the activated lorebook
entries, not from the chat. Recent assistant messages are a narrow delta that
signals *some entries may be stale or incomplete* — they are not a new source of
world truth. This is why alpha operations are `update` / `append` / `update_keys`
only, never `create`: we reconcile the description of the world to events, we do
not author new world from a handful of chat lines.

## The Same Window, Two Roles

The last-N assistant messages serve **two** purposes simultaneously, and this is
deliberate (not a conflation):

1. **Scan input** — the chat slice fed to the activation engine, so the canon
   we surface is exactly the canon implicated by what just happened.
2. **Evidence payload** — the same messages sent to the model as "what changed."

We do **not** pass the full chat history. Faithful reproduction of what the
roleplay model saw is explicitly *not* a goal of this tool, so the "full-chat vs
sliced" tension does not apply.

---

## Data / Ops Flow Diagram

```
═══════════════════════════════════════════════════════════════════
  LOREBOOK LIBRARIAN — ALPHA DATA / OPS FLOW
═══════════════════════════════════════════════════════════════════

 TRIGGER
 ───────
   /lorelibrarian  (slash command) ─┐
   WI-adjacent button click     ──┴──►  runLibrarian()
                                          (single entry point, both routes converge)


 STAGE 0 — PRECONDITIONS / SETTINGS
 ──────────────────────────────────
   const ctx = getContext();                                    [PUBLIC]
   read settings: { summaryProfileId, messageCount N,
                    maxResponseTokens, debugVisible }
   guard: ctx.chat?.length            → else err "no active chat"
   guard: summaryProfileId set        → else err "no summary profile"
   guard: profile is Chat Completion  → else err "select a CC profile"
          (filter apiMap.selected==='openai' && source — YOUR check, not the service's)


 STAGE 1 — COLLECT EVIDENCE  (leg 1, the "what changed" signal)
 ──────────────────────────────────────────────────────────────
   ctx.chat                                                     [PUBLIC]
        │  .filter(m => !m.is_user && !m.is_system)
        │  .slice(-N)
        │  map → m.mes            (active swipe text, not swipes[])
        │  REVERSE → most-recent-first  (see note ⑤)
        ▼
   recentMsgs : string[]   ◄── serves TWO purposes downstream:
                                 (a) scan input for Stage 2
                                 (b) evidence payload for Stage 3
        │
        ├─ guard: recentMsgs.length > 0  → else err "no assistant messages"
        ▼

 STAGE 2 — ACTIVATE CANON  (leg 2, the hard leg — recall-bounded)
 ────────────────────────────────────────────────────────────────
   checkWorldInfo(recentMsgs, maxContext, /*isDryRun*/ true)    [INTERNAL ← world-info.js:4510]
        │
        │   internally calls:
        │     └─ getSortedEntries()              [world-info.js:4388]
        │           ├─ getGlobalLore()
        │           ├─ getCharacterLore()
        │           ├─ getChatLore()
        │           └─ getPersonaLore()
        │           → structuredClone(allEntries)  // pool: global+char+chat+persona
        │     └─ WorldInfoBuffer(recentMsgs)        // keyword scan buffer (expects string[])
        │     └─ WorldInfoTimedEffects(...)         // sticky/cooldown — DRY, see note ①
        │     └─ keyword + recursion activation loop
        │           keyed internally as `${entry.world}.${entry.uid}`   ◄── note ②
        │
        ▼
   { allActivatedEntries: Set<entry>, worldInfoBefore, worldInfoAfter, ... }
        │  take ONLY allActivatedEntries
        │  [...set].map(e => ({
        │       world:   e.world,        // composite key, REQUIRED
        │       uid:     e.uid,
        │       key:     e.key,
        │       content: excerpt(e.content)   // truncate — token guard
        │  }))
        ▼
   activatedEntries : CanonSlice[]
        │
        ├─ guard: activatedEntries.length > 0 → else err "no relevant entries"
        ▼

 STAGE 3 — ASSEMBLE PROMPT  (lorebook = authority, chat = drift evidence)
 ────────────────────────────────────────────────────────────────────────
   buildMessages(recentMsgs, activatedEntries) → ChatCompletionMessage[]
        │
        │   [ { role: 'system', content: STABLE_CONTRACT },   ◄── note ③ (cache-stable)
        │     { role: 'user',   content: renderCanon(activatedEntries)
        │                                + renderEvidence(recentMsgs)
        │                                + JSON_OUTPUT_CONTRACT } ]
        ▼
   messages : ChatCompletionMessage[]


 STAGE 4 — CALL THE LIBRARIAN MODEL  (leg 3, the second brain)
 ──────────────────────────────────────────────────────────────
   ConnectionManagerRequestService.sendRequest(                 [SHARED ← extensions/shared.js:411]
        summaryProfileId,
        messages,                       // array ⇒ routes to CC branch (shared.js:431)
        maxResponseTokens,
        { stream:false, extractData:true, includePreset:true, includeInstruct:false }
   )
        │   internally:
        │     └─ validateProfile()   → throws if not allowed type
        │     └─ ChatCompletionService.processRequest(...)   // CC branch only
        │   THROWS (not returns) on: CM disabled / bad profile / request fail
        │     └─ wrap in try/catch → surface error.cause in diagnostics
        ▼
   result : ExtractedData
        │  rawText = result.content
        ▼

 STAGE 5 — PARSE PROPOSALS  (smoke-test the contract)
 ─────────────────────────────────────────────────────
   tryParse(rawText):
        ├─ JSON.parse(rawText)              // strict first
        └─ on fail: extract first ```json fenced block, parse once   ◄── note ④
        │  on fail again → err "malformed JSON", keep rawText for diag
        ▼
   proposals : [{ world, entryUid, entryTitle, operation,
                  reason, proposedText, proposedKeys }]
        validate: operation ∈ {update_content, append_content, update_keys}
        validate: (world,entryUid) resolves to a real activated entry


 STAGE 6 — DISPLAY  (NO WRITES — terminal of the alpha pipeline)
 ────────────────────────────────────────────────────────────────
   render panel:
        ├─ summary status (ok / which error)
        ├─ parsed proposals (cards)
        ├─ raw model response
        └─ DIAGNOSTICS (collapsible) ── every intermediate artifact:
              settings · recentMsgs · ctx summary (name2/characterId/groupId)
              · active world names · activatedEntries[uid/world/key/excerpt]
              · messages sent · profile metadata (NO secrets)
              · rawText · proposals · any error.cause
   ───────────────────────────────────────────────
   ✗ no checkWorldInfo writes (isDryRun=true)
   ✗ no saveWorldInfo / loadWorldInfo mutation
   ✗ active chat connection + model untouched
```

---

## Call Inventory — the complete parasitic footprint

| Surface | Calls | Source |
| --- | --- | --- |
| **PUBLIC** (`getContext()`) | `chat`, `name1`, `name2`, `characterId`, `groupId`, `chatId` | `st-context.js` |
| **SHARED service** | `ConnectionManagerRequestService.sendRequest` | `extensions/shared.js:411` |
| **INTERNAL import** | `checkWorldInfo` (transitively pulls `getSortedEntries` + buffer + timed effects) | `world-info.js:4510` |

**Total internal/private imports: 1 function.** The entire structural risk of the
alpha is concentrated in this one `checkWorldInfo` call behaving as expected —
which is precisely why `PLAN.md` flags lorebook search as the highest-risk
discovery item.

### Why the internal import is the PRIMARY path (not a fallback)

`getContext()` exposes `getWorldInfoPrompt`, `loadWorldInfo`, `saveWorldInfo`,
`convertCharacterBook` — but it does **not** expose the matching engine
(`getSortedEntries`, `checkWorldInfo`). The public `getWorldInfoPrompt` returns
assembled prompt *text*, not structured entries with stable identifiers, so it
cannot satisfy the UID-based proposal contract. Therefore a narrow, documented
internal import of `checkWorldInfo` from `world-info.js` is the expected primary
path. A custom search/RAG implementation remains out of scope.

---

## Verified Signatures (re-verify during discovery)

### `checkWorldInfo(chat, maxContext, isDryRun, globalScanData?)` — world-info.js:4510
```
@param {string[]} chat        — chat messages to scan, IN REVERSE ORDER (depth 0 = newest)
@param {number}   maxContext  — max generation context size
@param {boolean}  isDryRun    — true ⇒ no persistence (REQUIRED for read-only)
@param {WIGlobalScanData} globalScanData — optional, defaults to defaultGlobalScanData
@returns {Promise<WIActivated>}
```
Returns `{ worldInfoBefore, worldInfoAfter, WIDepthEntries, EMEntries,
ANBeforeEntries, ANAfterEntries, outletEntries, allActivatedEntries }`.
**Use only `allActivatedEntries`** (a `Set` of activated entry objects, each
carrying `world`, `uid`, `key`, `content`, plus added `hash`/`decorators`).

### `ConnectionManagerRequestService.sendRequest(profileId, prompt, maxTokens, custom?, overridePayload?)` — shared.js:411
- `prompt` as an **array** of `{role, content}` ⇒ routes to the Chat Completion
  branch (`shared.js:431`). A bare string is wrapped as a single user message.
- `custom`: `{ stream, signal, extractData, includePreset, includeInstruct, instructSettings }`.
- With `extractData:true`, returns `ExtractedData`; read `.content` for the raw text.
- **Throws** (does not return) on: connection-manager disabled, unsupported
  profile, or request failure (wrapped as `'API request failed'` with `.cause`).
- **CC-only enforcement is the extension's job.** `getSupportedProfiles()` /
  `isProfileSupported()` accept `textgenerationwebui` too; filter the dropdown to
  `apiMap.selected === 'openai' && !!source` yourself.

---

## Annotated Notes — the things that will bite at debug time

**① Timed effects on a slice.** `WorldInfoTimedEffects` keys off message
indices/positions. A 5-message slice ≠ the real chat timeline, so sticky/cooldown
reasoning is computed against a truncated history. `isDryRun=true` ⇒ nothing
persists (safe), but activation on timed-heavy lorebooks may differ from
intuition. Observable in diagnostics. Documented, accepted alpha limitation.

**② Composite key.** SillyTavern addresses entries as `` `${entry.world}.${entry.uid}` ``
(world-info.js:4598). `uid` is **not** globally unique across active books. The
proposal contract MUST carry `world` beside `entryUid`, or the future write
milestone (M2) will edit the wrong entry.

**③ Cache-stable system prompt.** Keep the contract/system block byte-stable
across runs so the CC provider can prompt-cache it. Variable data (canon slice +
evidence) goes in the user turn only.

**④ Recall ceiling — the product's real boundary.** `checkWorldInfo` activates by
keyword/recursion match. The Librarian can only propose edits to entries whose
keys appear (directly or via recursion) in the last-N messages. "The fortress
finally fell" will NOT surface an entry keyed `Ashen Gate` if that exact term is
absent from recent text. This is inherent to "reuse the ST matcher, no custom
RAG" — recall is bounded by the lorebook's own keying quality. Accepted alpha
limitation; a broader low-precision pass via `getSortedEntries` is explicitly
post-alpha.

**⑤ Reverse order + string type.** `checkWorldInfo` and `WorldInfoBuffer` expect a
`string[]` (raw message text), NOT message objects, and the array must be
**most-recent-first** (`@param {string[]} chat ... in reverse order`,
world-info.js:4503; `WorldInfoBuffer.#initDepthBuffer` reads `messages[depth].trim()`
with depth 0 = newest). So Stage 1 must map to `m.mes` AND reverse before passing
to Stage 2.

---

## Error-Path Map — every guard collapses to the same safe terminal

```
  no chat ─┐
  no msgs ─┤
  no profile ─┤
  non-CC profile ─┼─► toast + diagnostics, NO writes, chat untouched
  CM disabled ─┤        (button + /lorelibrarian route through identical handler)
  request fail ─┤
  no entries ─┤
  bad JSON ─┘
```

The error path is the happy path minus the model call. One handler, both trigger
routes. This symmetry should be preserved in the implementation.

---

## Open Items For Implementation Discovery

- Confirm `maxContext` value to pass to `checkWorldInfo` (use the active
  generation context size from settings/context, not a hardcoded constant).
- Confirm `ExtractedData.content` is the correct field for the raw text across
  the targeted CC sources before depending on it.
- Confirm `entry.world` is populated on entries returned via the
  global/character/chat/persona lore merge (it is referenced in the internal
  composite key, but verify it survives `structuredClone`).
- Decide excerpt length for `content` truncation and surface an approximate input
  token count in diagnostics.
