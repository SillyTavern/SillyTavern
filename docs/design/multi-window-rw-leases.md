# Multi-Window SillyTavern: RW Leases, Atomic Profiles, and Session Poisoning

**Status:** Living design — implementation underway on `feature/multi-window-leases` (Stage 1 complete, Stage 2 in progress)
**Date:** 2026-07-19
**Scope:** SillyTavern core (server + frontend). No changes to the multi-user account system.

---

## 1. Motivation

SillyTavern today is a one-window application per user account. Nothing enforces
this — it is an emergent property of two facts:

1. Every window persists the **entire `settings.json` blob** on a debounce
   (`saveSettings`, `public/script.js:8025`, payload at `:8043-8068`), and the
   server replaces the whole file with no versioning or merge
   (`src/endpoints/settings.js:206-216`). Two windows ping-pong each other's
   `main_api`, model selection, `active_character`, and every other setting.
2. Chat saves send the **whole message array** and rewrite the whole `.jsonl`
   (`public/script.js:7369`, `src/endpoints/chats.js:457-495`). Two windows on
   the same chat silently lose messages (last write wins). The existing
   "integrity" slug is a per-chat identity UUID, not a revision — both windows
   carry the same slug and both pass the check.

Nothing crashes; data is corrupted silently. Meanwhile the parts that *look*
hard are already safe: generation is fully stateless — the client sends model,
sampler parameters, API URL, and proxy config in every request body
(`public/scripts/openai.js:2756-2805`, `public/scripts/textgen-settings.js:1640-1676`),
so two windows can already stream from two different models simultaneously
without server-side conflict.

**Goal:** N windows per user, each with an independent chat and an independent
connection/model/sampler configuration, with locking at the thread (file)
level, and no silent data loss anywhere.

## 2. Design doctrine

These principles resolve every edge case below; when in doubt, apply them:

- **Atomic units, no merging — ever.** Every conflict resolves to *fork* or
  *reload*, never a merge UI.
- **Files are the locking granularity.** Every entity that is a file gets an
  RW lease. Entity data still trapped in the settings blob either moves out
  into files (personas) or falls under one global single-writer lease
  (extension settings).
- **Locks gate persistence, not use.** Reading, rendering, and generating from
  an in-memory snapshot is always allowed. Only writes require lease
  validation.
- **Windows are isolated.** No window ever has its state mutated behind its
  back. Cross-window convergence happens only through explicit user action
  (save, reload) or through poisoning (force reload into a clean state).
- **The server holds session state in memory only.** Leases, ephemeral
  profiles, revisions: all TTL-guarded, all lost on restart by design. Users
  must explicitly save anything they want to survive a restart (⚠️ everywhere
  this applies).

## 3. Core concepts

### 3.1 Window identity

- `windowId`: `crypto.randomUUID()`, stored in `sessionStorage` — unique per
  browser tab, **survives reload of that tab**, dies with the tab.
- `epoch`: an integer incremented on every registration. A session is the pair
  `(windowId, epoch)`.
- The user cookie (`cookie-session`, `src/server-main.js:169-174`) continues to
  identify the *account*; `(windowId, epoch)` identifies the *window*. Today
  the server cannot distinguish two windows of the same user at all.

### 3.2 Session registry (server, in-memory)

```
sessions: Map<windowId, {
    epoch: number,
    lastSeen: timestamp,          // TTL-expired (default 3 min)
    poisoned: false | { reason: string, byWindow: string, entity: string },
    ephemeralProfiles: Map<profileId, ProfileObject>,
}>
```

The session TTL must tolerate background-tab timer throttling (browsers
throttle `setInterval` in hidden tabs to as little as one tick per minute),
hence minutes, not seconds. The client additionally heartbeats immediately on
`visibilitychange` → visible, and on a `440 unknown_session` response (server
restart or TTL expiry) it silently re-registers **and re-acquires the lease it
was holding** — if that re-acquire conflicts because another window took the
entity in the meantime, the window drops to read-only with a warning toast.

### 3.3 Heartbeat

`POST /api/session/heartbeat` every ~15s from each window. It is the **only**
sync channel — there is no websocket/SSE push (the server currently has none;
the only SSE is per-request LLM stream proxying). The heartbeat:

- renews the session TTL and all leases held by the window;
- returns *revision bumps* for entities the window has read leases on
  ("profile X is now rev 7, you loaded rev 5" → ⚠️ stale);
- returns *drain requests* ("release your read lease on character Y, a writer
  is waiting") — pure readers comply automatically at zero cost;
- for a poisoned session, every endpoint (not just heartbeat) returns the
  death response — see §6.

### 3.4 RW leases

Per entity file, in-memory:

```
leases: Map<filePath, {
    readers:  Map<windowId, { expiresAt }>,
    writer:   windowId | null,        // write-intent holder
    writePending: windowId | null,    // writer waiting for drain
    revision: number,                 // bumped on every successful write
}>
```

Semantics:

- **Read lease:** many concurrent holders. Acquired on open (chat, character
  edit panel, persona panel, world info book…). Auto-released on close/switch
  and on drain requests. Pure readers never block anything for long: they
  release on the next heartbeat when drained and keep working from their
  snapshot, now revision-tracked (stale ⚠️ if it changes).
- **Write-intent:** acquired by *upgrade* on first edit (a "reader with
  unsaved edits" is a contradiction — first keystroke upgrades read → write).
  At most one holder. All save endpoints for the entity validate that the
  caller holds it.
- **Drain protocol:** a would-be writer sets `writePending`. Pure readers
  auto-release within one heartbeat interval. A conflicting write-intent
  holder blocks the drain — this is a *real* conflict. After a bounded wait
  (default: 2 heartbeat intervals), the force-write option unlocks.
- **Force-write:** available only when other holders of *this file's* lease
  block the write. Shows a warning naming the blast radius: *"N windows hold
  this file and will be reloaded; their unsaved changes will be discarded."*
  On confirm: the write proceeds, revision bumps, and every other holder's
  session is **poisoned** (§6). Bystander windows (no lease on this file) are
  never affected.

Single-window behavior is unchanged by construction: one window trivially
acquires every lease it asks for and never sees a drain, ⚠️, or dialog.

### 3.5 Revisions

Every entity file gets a monotonically increasing in-memory revision (seeded
from file mtime hash on first touch after server start). Saves bearing a
lease also carry the revision they were based on; the server rejects
mismatches (HTTP 409) as a belt-and-suspenders backstop under force-write
races. Clients treat 409 identically to a stale ⚠️: fork or reload.

## 4. Entity taxonomy

| Entity | Storage today | Lock treatment |
|---|---|---|
| Chats | `chats/*.jsonl` (per file) | RW lease. The chatting window holds write-intent for the duration; other windows may hold read leases (live-ish read-only view via revision bumps). |
| Group chats + groups | `group chats/*.jsonl`, `groups/*.json` | Same as chats. |
| Characters | `characters/*.png` cards | RW lease. Many chats read a card; editing upgrades to write-intent. |
| Personas | **inside settings blob** (`power_user.personas`, `persona_descriptions`, `public/scripts/personas.js:197`) | **Migrate to `personas/*.json`** (§8.1), then RW lease like characters. |
| World info books | `worlds/*.json` | RW lease. |
| Themes, Quick Reply sets | per file | RW lease (low contention; comes for free). |
| Connection profiles | **new**: `connection-profiles/*.json` (§5) | RW lease gates *persisting* a profile. Using a profile never requires a lease. |
| Connection Presets | **inside settings blob** (`extension_settings.connectionManager.profiles`) | **Migrate to `connection-presets/*.json`**, then RW lease + revisions like profiles. Referenced by profiles by id; preset saves transitively ⚠️-invalidate windows whose profile references them (§5.1). |
| Extension settings (`extension_settings`) | settings blob | **Explicit save + poison-all (§6.1).** No lease. Changes are local ⚠️-dirty state until an explicit save; the save persists the blob and poisons **every** session, including the saver's own. No window ever runs globals that differ from disk. |
| `power_user` UI prefs, tags/tag_map | settings blob | Same explicit-save + poison-all mechanic. Tags are entity-ish and a candidate for later extraction like personas. |
| Generation | stateless per-request | No locking needed. |
| Secrets/API keys | `secrets.json`, referenced by id | Unchanged; profiles reference `secret-id` (already supported by connection-manager). |

## 5. Connection profiles as atomic units

### 5.1 Shape

The `<none>` (unprofiled) state is removed. Connection state always belongs to
a profile. The *preset-scope content* covered by this system is the full
generation configuration:

- API family (`main_api`) + source, server URL, model;
- **the complete sampler state** for that API family (snapshot of
  `oai_settings` / `textgenerationwebui_settings` /… minus key material);
- instruct/context/reasoning templates, system prompt state, proxy,
  post-processing, `secret-id`, stop strings — the full field set the
  connection-manager already enumerates (`FANCY_NAMES`,
  `public/scripts/extensions/connection-manager/index.js:72-90`).

**Naming:** *profile* always means our atomic unit. The legacy
connection-manager bundles are renamed **Connection Presets** in the UI
(internal ids, storage keys and slash commands unchanged for compat).

**Presets are peer entities, not embedded copies.** A Connection Preset is a
first-class leased entity on the same layer as profiles: it moves out of the
`extension_settings` blob into `connection-presets/*.json` and gets its own
RW lease and revision like every other file. A profile stores *which* preset
it uses — never the preset's content. Editing preset content requires its
write lease (drain/force-write as usual); saving it bumps its revision,
which **transitively invalidates every window whose active profile references
it**: those windows get the standard stale ⚠️. Force-writing a preset
poisons its lease holders like any other entity.

**No `<None>` preset — anonymous or named.** The preset selector never shows
`<None>`. A profile's connection content is either:

- **Anonymous: <profile name>** — the preset-scope content is embedded in
  and owned by the profile itself: saved with the profile, no separate
  lease, invisible to other profiles. This is the default state and the
  successor of `<None>`.
- **A named preset** — the profile stores only the reference; the content
  lives in the preset file.

Local edits while a named preset is selected mark it **"(unsaved)" ⚠️** in
the selector — the working state has diverged from the named preset's
content. In that state **the profile cannot be saved**: the user must first
either (a) switch to the anonymous preset, folding the changes into the
profile's own content and leaving the named preset untouched, or (b) save
the named preset (lease-gated, staleness-propagating as above). This keeps
the invariant sound: a profile never persists content that silently diverges
from a named preset it claims to reference.

Storage: one JSON file per persistent profile under
`data/<user>/connection-profiles/`. Never inside `settings.json` (that would
reimport the clobber problem).

### 5.2 Ephemeral profiles (the working tree)

- Windows boot into the **default profile** (a designated persistent profile).
- The first change in a window forks an **ephemeral profile** —
  *"Default (edited, window 2)"* — held in **server memory**, keyed by
  `windowId`, auto-updated on a debounce. Detection is a dirty-diff of the
  collected field set against the loaded profile (the `collectSettings()`
  pattern — **no rewiring of individual input handlers**; globals remain the
  in-memory working state exactly as today).
- Ephemerals carry `{ id, parentId, parentRev }`.
- UI: ⚠️ *"virtual profile — will be lost on server restart; save to keep."*
  Explicit **Save** persists (overwrite parent if you hold its write lease, or
  save-as-new). Nothing auto-persists.
- Surviving reload: `windowId` survives tab reload → the server re-attaches
  the window's ephemeral profile on re-registration. Ephemerals die with
  server restart *by design* (hence the ⚠️).

### 5.3 Staleness (git model)

Profiles are branches; a window's live state is a working tree; ephemerals are
uncommitted changes; Save is a commit. When someone saves profile P (rev++),
other windows *using* P are *not* hot-updated. Their next heartbeat reports
the bump → ⚠️ *"profile updated — save current as a new profile, or reload to
get new settings."* Fork or pull. A deleted profile produces the same dialog
minus reload. A window that is both dirty *and* stale gets the same two
options. **No merge.**

### 5.4 Per-chat binding

`chat_metadata` (stored in the chat file's first line — rides under the chat's
own lease, conflict-free) gains:

```
connection: { profileId, parentId }   // parentId = fallback if profileId was ephemeral
```

Opening a chat applies its bound profile (fallback: parent, then default).
Since a profile carries the full preset-scope content — anonymous or via its
named-preset reference — a chat binding captures the *entire* generation
config. (Prior art: the community CharacterLocks extension does the
switch-on-open half of this via chat metadata today.)

## 6. Poisoning

Force-write is the only source of poisoning. Semantics:

1. The force-writer's write lands; revision bumps.
2. Every *other* holder of that file's lease has its session marked poisoned:
   `{ reason, byWindow, entity }`.
3. **A poisoned session is dead to the server.** Every endpoint rejects it
   (HTTP `410 Gone` with a `poisoned` body) — not just the heartbeat. In-flight
   debounced saves and stream continuations bounce off harmlessly. The
   server-side rejection is the safety mechanism; everything client-side is
   only UX.
4. Client rule: on any `410 poisoned` response the window becomes a
   **read-only zombie** — heartbeats stop and nothing can be saved (the
   server enforces this), but the page deliberately does **not** auto-reload.
   A sticky toast ("Session ended — copy anything you still need") with a
   **Reload** button hands control to the user, so the state of the page can
   be read or copied before it is discarded. Reload happens only on click.
5. Rebirth: the reload re-registers with the same `windowId`, `epoch + 1`. The
   server clears the poison, returns the window's ephemeral profiles and the
   poison reason. The window lands **neutral**: same ephemeral/connection
   profile re-attached (still ⚠️-unsaved), **no chat loaded, default character,
   default persona** — the normal boot flow with the `active_character`/
   `active_group` restoration step skipped (lands on the Assistant/welcome
   screen). One toast explains: *"This window was reloaded: window N
   force-wrote <entity>. Unsaved changes were discarded."*

Force-write destroys other windows' unsaved work **by design** — that is what
the bounded drain and the explicit warning exist for.

### 6.1 Global settings: explicit save + poison-all

`extension_settings`, `power_user` UI prefs, and tags/tag_map (the residual
`settings.json` blob) do not use leases. Their mechanic:

- All windows boot from the persisted blob. Changes accumulate **locally
  in memory only** and light a ⚠️ on a new "Save settings" control.
  `saveSettingsDebounced` becomes a dirty-marking shim — third-party
  extensions keep working unchanged in memory and inherit the semantics
  for free. Nothing about the blob auto-persists. Unsaved blob changes are
  lost on reload/poison/server restart (⚠️ says so).
- **Explicit save** persists the whole blob and then poisons **every live
  session — including the saver's own**. Everyone reboots through the normal
  poison path (§6): neutral landing, ephemeral profiles restored, reason
  toast ("global settings were saved by window N").
- Invariant: no running window ever has globals that differ from disk.
  Divergence exists only as local ⚠️ state; a save is a global barrier.
- **Self-serializing, no lock needed:** if two windows race to save, the
  first save poisons the second's session, and the second's in-flight save
  is rejected as dead (410). Arrival order decides.
- The save button carries a blast-radius warning like force-write:
  *"Saving will reload all N open windows; unsaved changes in them will be
  discarded."*
- Deliberately heavyweight: this creates the incentive to keep frequently
  touched configuration profile-scoped (reloads nobody) and reserve the
  global blob for set-and-forget preferences.

## 7. Server API surface (new)

```
POST /api/session/register    { windowId, epoch }
  → { ephemeralProfiles, poisonReason?, landing: 'neutral'|'normal' }

POST /api/session/heartbeat   { windowId, epoch, heldLeases[] }
  → { revisionBumps[], drainRequests[], leaseGrants[] }

POST /api/lease/acquire       { file, mode: 'read'|'write' }   → grant | conflict info
POST /api/lease/upgrade       { file }                          → grant | pending (drain started)
POST /api/lease/release       { file }
POST /api/lease/force-write   { file }                          → poisons blocking holders

POST /api/connection-profiles/{list,save,delete,set-default}   (profile CRUD; save/delete of an existing id requires its lease)
POST /api/connection-profiles/ephemeral                        (debounced ephemeral upsert, keyed by session)
POST /api/connection-presets/{list,save,delete,set-default}    (preset CRUD; same lease rules, key preset/<id>)
```

(Implemented paths use `/api/sessions/*` for register/heartbeat and
`/api/sessions/lease/*` for lease operations.)

Modified: every existing save endpoint (`/api/chats/save`,
`/api/characters/edit*`, group saves, world info save) gains a
lease-validation middleware: reject without a valid write-intent lease from a
live session; reject revision mismatches with 409. `/api/settings/save`
instead requires only a live session and triggers poison-all (§6.1) on
success.

Config: `multiWindow.enabled` flag in `config.yaml` (default off initially).
Disabled ⇒ middleware grants everything to everyone (today's behavior).

## 8. Migrations

1. **Personas out of the blob** (prerequisite for their per-file leases):
   `power_user.personas` + `persona_descriptions` + connections →
   `data/<user>/personas/<avatarId>.json`. One-time import on first boot;
   old fields left in place (read-only) for rollback for one release cycle.
2. **Default profile synthesis / `<none>` retirement:** on first boot, collect
   current global connection+sampler state into a persistent profile named
   "Default" with **anonymous** preset content; mark it the boot profile.
   Existing connection-manager bundles are imported as named Connection
   Preset files (compat import); the legacy `<None>` selection maps to the
   anonymous state.
3. **Settings blob slimming:** connection/sampler sections are no longer
   *read* from `settings.json` at boot (they come from the boot profile);
   they are still written for one release cycle for rollback safety, then
   dropped from the payload.

## 9. Staged rollout (each stage shippable & testable in a two-window setup)

| Stage | Contents | Estimate |
|---|---|---|
| **1. Sessions + chat leases** | Window id/epoch, registry, heartbeat, RW lease table, lease middleware on chat/group saves, read-only chat view, drain + force-write + poison for chats only. Kills the silent chat clobber. | ~1 week |
| **2. Atomic profiles + presets** | Profile files + CRUD, anonymous/named preset model (preset file extraction, lease-gated preset CRUD, transitive staleness), ephemeral registry, dirty-diff, Save/⚠️/staleness UI, default profile migration, `<none>` retirement, explicit-save + poison-all for the residual settings blob (`saveSettingsDebounced` → dirty-marking shim). | ~2.5–3 weeks |
| **3. Full generalization** | Persona extraction + leases, character/world/theme leases, per-chat profile binding, tags decision. | ~1 week |

Total ≈ **a month** of focused work; the dominant cost is multi-window testing
(group chats, swipes during drain, debounced saves racing poison, extension
settings churn), not the lease machinery itself (~a day of server code).

## 10. Risks & open questions

- **The anonymous/named preset UX shift** is the biggest user-visible change
  (no `<None>`, "(unsaved)" blocking profile saves); ships behind the
  `multiWindow.enabled` flag. The two escape hatches (switch to anonymous /
  save the named preset) must be one click each from the blocked-save state.
- **Third-party extensions** that programmatically switch connections (e.g.
  profile-switcher extensions) keep working in-memory; their
  `saveSettingsDebounced` calls mark the blob dirty instead of writing.
  Extensions that *assume* silent auto-persistence now depend on the user
  hitting "Save settings" (which reloads all windows) — the ⚠️ makes the
  pending state visible.
- **Same account from two devices:** works identically — windowId is per-tab
  regardless of device; TTL cleans up dead remote sessions.
- **Group chat force-write blast radius:** force-writing a *character* used by
  a group another window is chatting in poisons that window only if it holds a
  lease on that character (it does, as a reader → it drains automatically;
  only write-intent holders block and get poisoned). Verify in Stage 3 testing.
- **Tags/tag_map extraction** deferred; under global lease until then.
- **Upstream:** this is core-invasive; the flag, the unchanged single-window
  behavior, and a staged PR series (Stage 1 first — it fixes real data loss)
  are the acceptance strategy. Related upstream asks: #883 (multi-tab),
  #3501 (profile files), #5165 (connection/profile split), #3467 (hot-swap).

---

*Companion research (2026-07-19): server has no locking of any kind — all
writes are atomic whole-file replaces via `write-file-atomic`; sessions are
cookie-only with no server-side registry; no push channel exists; generation
endpoints are stateless per-request. Frontend generation locks
(`is_send_press`, `streamingProcessor`) are per-tab globals with no cross-tab
effect.*
