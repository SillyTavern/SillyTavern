# Multi-Window Implementation Status & Handoff

**Branch:** `feature/multi-window-leases` in `~/dev/SillyTavern-dev` (clone of `~/dev/SillyTavern`, based on devel `39972e97c`).
**Design:** `multi-window-rw-leases.md` (same dir) — read it first; this doc is the delta between design and code.
**State:** Stages 1 + 2 complete and live-verified. Stage 3 not started.

## Environment / workflow (critical for the next session)

- Agent shell is a toolbox container WITHOUT node. Run/build via host flatpak SDK:
  `flatpak-spawn --host flatpak run --command=sh --filesystem=host --share=network --cwd=<dir> org.freedesktop.Sdk//25.08 -c '. /usr/lib/sdk/node24/enable.sh && <cmd>'` (requires sandbox disabled).
- Dev server: `node server.js --port 8020` in the clone (config.yaml there has `multiWindow.enabled: true`, whitelist `10.0.0.0/8`). Preview launch config `sillytavern-dev` exists in the MAIN repo's `.claude/launch.json`. `preview_stop` leaves the flatpak'd node alive — kill by port: `ss -tlnp | grep 8020` → kill PID (via flatpak-spawn --host).
- Test suite: `bash tests/multi-window-leases.sh` against a RUNNING :8020 server — **33/33**. It pollutes `data/default-user/` (profiles/presets); `rm -rf data/default-user/connection-profiles` before browser-testing migration paths.
- Simulate a second window with curl: register with `X-Window-Id`/`X-Window-Epoch` headers + CSRF token + cookie jar (see test script for the exact recipe).
- The floating save button and popups: `preview_click` coordinate-clicks can miss; use `element.click()` via `preview_eval`.
- Lint: `npx eslint <files>` (same flatpak recipe). Use Read/Edit tools for file edits, NOT python str.replace (silent no-ops caused doc drift once).

## Commit map (oldest → newest)

| Commit | What |
|---|---|
| `39972e97c` | Design doc (also on main repo devel) |
| `d0f94fdd2` | Stage 1 server: `src/multi-window.js` (session registry, RW lease table, poisonGate, leaseWriteGuard, poisonAllSessions), `src/endpoints/sessions.js`, chat/group saves lease-gated, curl test |
| `4b684d853` | Stage 1 client: `public/scripts/multi-window.js` — windowId(sessionStorage)+epoch, headers via getRequestHeaders, lease on chat open (getChat/getGroupChat), take-over dialog, 410 → read-only zombie + sticky toast + user-clicked Reload (NO auto-reload, user decision), neutral landing (skips active_char restore), rebirth toast after APP_READY, TTL 3min for bg-tab throttling, 440 → re-register + re-acquire leases |
| `a88f58f31` | Stage 2 server: `src/endpoints/connection-profiles.js` — profile files + `_meta.json` defaultId, ephemeral upsert into session (survives F5, dies with server) |
| `3351988ab` | Stage 2 client core: `public/scripts/connection-profiles-client.js` — overlay at SETTINGS_LOADED_BEFORE seam (sections: main_api, oai/textgen/kai/nai settings), first-boot migration → "Default" profile, dirty-diff → ephemeral + ⚠️/Save |
| `d72502f9e` | World-info leases (worldinfo /edit+/delete, key `world/<name>`, editor acquires, 409→acquire-retry covers creation); client leases slot-keyed (chat+world coexist); **rename: "Connection Profiles"→"Connection Presets"** (UI strings only) |
| `67bd7adfa` | `src/endpoints/connection-presets.js` (mirror of profiles, key `preset/<id>`) |
| `2aca9b74b` | Profile manager UI: centered row top of API drawer + hr (user-specified layout), colored ⚠️, save/save-as/star/delete, switch = confirm-if-dirty + one-shot `mw_boot_profile` + reload |
| `f8a2a3057`/`53e21b6d3` | Doc: presets = peer leased entities; anonymous-or-named semantics (NO `<None>`) |
| `68830c377`→`80eddc0a5` | Preset semantics INTEGRATED into the existing Connection Preset select (user rejected a second dropdown): None option renders "Anonymous: <profile>", "(unsaved)" suffix on selected option, profile save BLOCKED until preset Updated (CONNECTION_PROFILE_UPDATED clears) or Anonymous selected (folds via dirty path); profile.presetId = bundle id, drives selection at boot via overlay |
| `db285c346` | Bundle→file migration: connection-manager hydrates from /api/connection-presets at init, one-time blob migration (`migratedToFiles` marker, failure keeps blob authoritative), files are truth, CONNECTION_PROFILE_CREATED/UPDATED events persist, update/delete lease-gated |
| `243a6d5c9` | Settings blob explicit-save + poison-all: saveSettings defers unless explicit (shim active APP_READY+5s grace), floating "⚠️ Save settings" (fixed bottom-right), `X-Settings-Explicit` header scopes the poison-all barrier (without it boot saves poisoned everyone — real bug found), saver dies voluntarily; per-window active char/group in sessionStorage (`mw_active_character/group`) |

Also: `watchEntity/onEntityStale/noteEntityRevision` staleness machinery in client multi-window.js (read-lease watch, drain → auto-release + 30s rewatch); server registerSession drops the window's previous leases.

## Key invariants (do not break)

- No merging anywhere; conflicts = fork or reload. Locks gate persistence, not use. Generation is stateless.
- Poisoned session = dead to server (410 everything except register); rebirth = same windowId, epoch+1, neutral landing + reason toast; page never auto-reloads (sticky toast + Reload button).
- Flag off (`multiWindow.enabled: false`) = byte-identical legacy behavior (guards no-op, preset list 404s → extension legacy mode).
- Profile = atomic unit (files `connection-profiles/<id>.json`); preset content is either anonymous (embedded in profile) or a named Connection Preset file referenced by id; a profile never persists content diverging from a referenced preset.

## Known gaps / next work

1. **Stage 2 stragglers:** client-side transitive preset staleness (watch `preset/<id>` of active profile; machinery exists, unwired); rename-only preset edit persists via UPDATED event without lease guard; staleness-rewatch browser toast E2E never fully observed (drain+save half verified).
2. **Stage 3:** persona extraction from blob → `personas/*.json` + leases; character card leases (`/api/characters/edit*`); theme/QR leases; per-chat profile binding via chat_metadata (`connection: {profileId, parentId}`); tags decision; read-only live chat view (drain handling for chat read leases).
3. Cosmetics: zombie toast says "by another window" even for self-initiated settings saves; floating save button placement may collide with ST's bottom-right UI.
4. ~~Data dir test residue~~ — cleaned; `tests/multi-window-leases.sh` now deletes everything it creates (a leftover `eph-1.json` makes the "saved ephemeral cleared" check fail on re-runs, since promoting the ephemeral becomes a lease-gated re-save). Re-runs still need a server restart (fixed window ids/epochs can't re-register against live session state).

## Upstream strategy

Stage 1 (sessions + chat leases) is the standalone, data-loss-fixing, most acceptable PR. Related asks: #883, #3501, #5165, #3467. Everything ships behind the config flag.
