import { POPUP_TYPE, callGenericPopup } from './popup.js';

/**
 * Client side of the multi-window session system.
 *
 * Identity: a windowId in sessionStorage (unique per tab, survives reload of
 * the tab) plus an epoch bumped on every registration. A poisoned session is
 * dead to the server (HTTP 410 on everything); the only path back is a
 * reload, which re-registers with epoch+1 and lands neutral.
 */

const HEARTBEAT_INTERVAL_MS = 15 * 1000;
const STORAGE_WINDOW_ID = 'mw_window_id';
const STORAGE_EPOCH = 'mw_epoch';
const STORAGE_NEUTRAL_LANDING = 'mw_neutral_landing';

let enabled = false;
let registered = false;
let windowId = '';
let epoch = 0;
/** @type {Map<string, {key: string, revision: number}>} One held lease per slot (chat, world, ...). */
const currentLeases = new Map();
/**
 * Read leases held purely to track other windows' writes (staleness).
 * key -> last seen revision. Auto-released on drain, re-acquired later.
 * @type {Map<string, number>}
 */
const watchLeases = new Map();
/** @type {?(key: string, revision: number) => void} */
let staleHandler = null;
/** Delay before re-acquiring a drained watch (writer finishes quickly). */
const REWATCH_DELAY_MS = 30 * 1000;
/** @type {?object} */
let rebirthReason = null;

function getIdentity() {
    if (!windowId) {
        windowId = sessionStorage.getItem(STORAGE_WINDOW_ID) || crypto.randomUUID();
        sessionStorage.setItem(STORAGE_WINDOW_ID, windowId);
    }
    if (!epoch) {
        epoch = Number(sessionStorage.getItem(STORAGE_EPOCH) || 0) + 1;
        sessionStorage.setItem(STORAGE_EPOCH, String(epoch));
    }
    return { windowId, epoch };
}

/**
 * Session headers to include on every API request.
 * @returns {object}
 */
export function getMultiWindowHeaders() {
    if (!enabled) {
        return {};
    }
    const identity = getIdentity();
    return {
        'X-Window-Id': identity.windowId,
        'X-Window-Epoch': String(identity.epoch),
    };
}

let dead = false;

/**
 * The death ritual: this session is dead to the server (every request now
 * returns 410), but the page deliberately does NOT auto-reload. A sticky
 * toast with a Reload button lets the user copy anything they need from the
 * page first; the reload lands neutral with the poison reason shown again.
 * @param {?object} poisonReason
 */
function die(poisonReason) {
    if (dead) {
        return;
    }
    dead = true;
    try {
        sessionStorage.setItem(STORAGE_NEUTRAL_LANDING, JSON.stringify(poisonReason ?? { reason: 'unknown' }));
    } catch {
        // sessionStorage full/unavailable: the rebirth toast is lost, nothing else.
    }
    const by = poisonReason?.byWindow
        ? (poisonReason.byWindow === windowId ? ' by this window' : ' by another window')
        : '';
    const entity = poisonReason?.entity ? ` over <code>${poisonReason.entity}</code>` : '';
    const $toast = toastr.error(
        `<div>This window's session was ended${by}${entity}. Nothing here can be saved anymore.</div>
         <div>Copy anything you still need, then reload.</div>
         <div class="menu_button mw-reload-button" style="margin-top: 8px;">Reload now</div>`,
        'Session ended',
        { timeOut: 0, extendedTimeOut: 0, closeButton: false, tapToDismiss: false, escapeHtml: false },
    );
    $toast?.find?.('.mw-reload-button')?.on?.('click', () => location.reload());
}

/**
 * If this boot follows a poisoning, returns the reason (once) - the caller
 * must skip active character/group restoration to land neutral.
 * @returns {?object}
 */
export function consumeNeutralLanding() {
    const raw = sessionStorage.getItem(STORAGE_NEUTRAL_LANDING);
    if (!raw) {
        return null;
    }
    sessionStorage.removeItem(STORAGE_NEUTRAL_LANDING);
    try {
        rebirthReason = JSON.parse(raw);
    } catch {
        rebirthReason = { reason: 'unknown' };
    }
    return rebirthReason;
}

/**
 * Wraps fetch so any 410 response from our own API triggers the death ritual.
 */
function installPoisonDetector() {
    const origFetch = window.fetch.bind(window);
    window.fetch = async function (resource, options) {
        const response = await origFetch(resource, options);
        const url = typeof resource === 'string' ? resource : resource?.url ?? '';
        if (response.status === 410 && url.startsWith('/')) {
            let reason = null;
            try {
                reason = (await response.clone().json())?.poisonReason ?? null;
            } catch {
                // Not JSON; die with unknown reason.
            }
            die(reason);
        }
        return response;
    };
}

async function api(path, body = {}) {
    const { getRequestHeaders } = await import('../script.js');
    return fetch(`/api/sessions/${path}`, {
        method: 'POST',
        headers: { ...getRequestHeaders(), ...getMultiWindowHeaders() },
        body: JSON.stringify(body),
    });
}

async function heartbeat() {
    if (!registered || dead) {
        return;
    }
    try {
        const response = await api('heartbeat', {
            heldLeases: [
                ...currentLeases.values(),
                ...[...watchLeases].map(([key, revision]) => ({ key, revision })),
            ],
        });
        if (response.status === 440) {
            // Server lost our session (restart or TTL after background-tab
            // timer throttling): re-register and re-acquire our lease.
            registered = false;
            epoch = 0;
            const lostLeases = new Map(currentLeases);
            currentLeases.clear();
            if (await register()) {
                for (const [slot, lost] of lostLeases) {
                    const reacquire = await api('lease/acquire', { key: lost.key, mode: 'write' });
                    const result = reacquire.ok ? await reacquire.json() : null;
                    if (result?.ok) {
                        currentLeases.set(slot, { key: lost.key, revision: result.revision });
                    } else {
                        toastr.warning(
                            `"${lost.key}" was taken by another window while this one was inactive. It is now read-only here.`,
                            'Multi-window', { timeOut: 10000 },
                        );
                    }
                }
            }
            return;
        }
        if (!response.ok) {
            return;
        }
        const data = await response.json();
        for (const bump of data.revisionBumps ?? []) {
            for (const lease of currentLeases.values()) {
                if (lease.key === bump.key) {
                    lease.revision = bump.revision;
                }
            }
            if (watchLeases.has(bump.key)) {
                watchLeases.set(bump.key, bump.revision);
                staleHandler?.(bump.key, bump.revision);
            }
        }
        for (const key of data.drainRequests ?? []) {
            // Pure readers comply at zero cost: release, re-acquire later to
            // resume revision tracking. Never auto-release write intents.
            const isWriteHeld = [...currentLeases.values()].some(lease => lease.key === key);
            if (isWriteHeld) {
                continue;
            }
            api('lease/release', { key }).catch(() => { });
            if (watchLeases.has(key)) {
                const lastSeen = watchLeases.get(key);
                watchLeases.delete(key);
                setTimeout(() => rewatch(key, lastSeen), REWATCH_DELAY_MS);
            }
        }
    } catch {
        // Network hiccup: next tick will retry.
    }
}

async function rewatch(key, lastSeenRevision) {
    if (dead || watchLeases.has(key)) {
        return;
    }
    const revision = await watchEntity(key);
    if (revision !== null && revision !== lastSeenRevision) {
        staleHandler?.(key, revision);
    }
}

/**
 * Registers the handler notified when a watched entity's revision changes
 * (i.e. another window saved it).
 * @param {(key: string, revision: number) => void} handler
 */
export function onEntityStale(handler) {
    staleHandler = handler;
}

/**
 * Starts revision-tracking an entity via a read lease.
 * @param {string} key Entity key
 * @returns {Promise<?number>} The current revision, or null if unavailable
 */
export async function watchEntity(key) {
    if (!enabled || !registered || dead) {
        return null;
    }
    try {
        const response = await api('lease/acquire', { key, mode: 'read' });
        const result = response.ok ? await response.json() : null;
        if (result?.ok) {
            watchLeases.set(key, result.revision);
            return result.revision;
        }
    } catch {
        // Watching is best-effort.
    }
    return null;
}

/**
 * Stops watching an entity and releases its read lease.
 * @param {string} key Entity key
 */
export function unwatchEntity(key) {
    if (watchLeases.delete(key)) {
        api('lease/release', { key }).catch(() => { });
    }
}

/**
 * Records a revision this window itself produced (its own save), so the
 * watch does not misreport it as another window's update.
 * @param {string} key Entity key
 * @param {number} revision
 */
export function noteEntityRevision(key, revision) {
    if (watchLeases.has(key) && Number.isInteger(revision)) {
        watchLeases.set(key, revision);
    }
}

/**
 * Whether the multi-window session system is active in this window.
 * @returns {boolean}
 */
export function isMultiWindowActive() {
    return enabled && registered;
}

// --- Global settings: explicit save + poison-all (design §6.1) ---
// The settings blob never auto-persists in multi-window mode: changes are
// local ⚠️-dirty state until an explicit save, which reloads EVERY window
// (including this one) so no running window ever has globals differing from
// disk. Boot-time normalizations (before APP_READY) still save normally.

let appReady = false;
let settingsDirty = false;

/**
 * True when a settings blob save should be deferred to the explicit flow.
 * @returns {boolean}
 */
export function shouldDeferSettingsSave() {
    return enabled && registered && appReady && !dead;
}

/** Marks the settings blob dirty and shows the explicit save control. */
export function markSettingsDirty() {
    settingsDirty = true;
    let button = document.getElementById('mw_settings_save');
    if (!button) {
        button = document.createElement('div');
        button.id = 'mw_settings_save';
        button.classList.add('menu_button');
        button.title = 'Unsaved global settings - lost on reload or server restart. Saving reloads ALL open windows.';
        button.innerHTML = '<span style="color: #ffc107; text-shadow: 0 0 2px #000;">&#9888;&#65039;</span><span>Save settings</span>';
        button.addEventListener('click', explicitSettingsSave);
        // In-flow at the end of the top drawer-icon bar, where it cannot
        // cover the chat input or the side panels.
        const topBar = document.getElementById('top-settings-holder');
        if (topBar) {
            button.style.cssText = 'align-self: center; margin-left: 10px; display: flex; align-items: center; gap: 6px; white-space: nowrap;';
            topBar.appendChild(button);
        } else {
            button.style.cssText = 'position: fixed; bottom: 8px; right: 8px; z-index: 10000; display: flex; align-items: center; gap: 6px;';
            document.body.appendChild(button);
        }
    }
    button.style.display = settingsDirty ? 'flex' : 'none';
}

async function explicitSettingsSave() {
    const confirmed = await callGenericPopup(
        '<h3>Save global settings?</h3><p>All open windows (including this one) will be reloaded; unsaved changes in them will be discarded.</p>',
        POPUP_TYPE.CONFIRM, '', { okButton: 'Save and reload all', cancelButton: 'Cancel' });
    if (confirmed !== 1) {
        return;
    }
    const { saveSettings } = await import('../script.js');
    try {
        await saveSettings(0, { explicit: true });
    } catch (error) {
        console.error('Explicit settings save failed', error);
        toastr.error('Settings could not be saved.', 'Multi-window');
        return;
    }
    settingsDirty = false;
    // The server has poisoned every session including ours. The user just
    // consented to "Save and reload all": record the landing reason and
    // reload right away instead of parking this window on the death toast
    // (other windows still get it - they may hold unsaved work).
    die({ reason: 'global settings saved', byWindow: windowId, entity: 'settings' });
    location.reload();
}

/** @type {object[]} Ephemeral profiles returned by the last registration. */
let bootEphemeralProfiles = [];

/**
 * Ephemeral profiles this window held before its last reload (restored by
 * the server on re-registration).
 * @returns {object[]}
 */
export function getBootEphemeralProfiles() {
    return bootEphemeralProfiles;
}

async function register() {
    const response = await api('register', {});
    if (response.status === 404) {
        enabled = false;
        return false;
    }
    if (!response.ok) {
        return false;
    }
    const data = await response.json();
    bootEphemeralProfiles = data.ephemeralProfiles ?? [];
    registered = true;
    return true;
}

/**
 * Initializes the multi-window session. Safe to call unconditionally: if the
 * server has the feature disabled, this becomes a no-op module.
 */
export async function initMultiWindow() {
    enabled = true; // provisional, so the register call carries identity headers
    getIdentity();
    if (!await register()) {
        return;
    }
    installPoisonDetector();
    setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
    // Background tabs get their timers throttled: beat immediately when the
    // tab becomes visible again.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            heartbeat();
        }
    });
    // The settings-save shim only kicks in after boot: normalization saves
    // during init (and its debounced tail shortly after APP_READY) persist
    // normally, so a clean boot never starts ⚠️-dirty.
    import('../script.js').then(({ eventSource, event_types }) => {
        eventSource.once(event_types.APP_READY, () => {
            setTimeout(() => {
                appReady = true;
            }, 5000);
        });
    });
    // The landing flag may not have been consumed yet (init order): peek it.
    let reason = rebirthReason;
    if (!reason) {
        try {
            reason = JSON.parse(sessionStorage.getItem(STORAGE_NEUTRAL_LANDING) ?? 'null');
        } catch {
            reason = null;
        }
    }
    if (reason) {
        const by = reason.byWindow
            ? (reason.byWindow === windowId ? ' by this window' : ' by another window')
            : '';
        const entity = reason.entity ? ` (${reason.entity})` : '';
        const showToast = () => toastr.warning(
            `This window was reloaded: ${reason.reason}${by}${entity}. Unsaved changes were discarded.`,
            'Multi-window',
            { timeOut: 15000 },
        );
        // Init runs behind the splash screen: defer the toast until the app
        // is actually visible.
        const { eventSource, event_types } = await import('../script.js');
        eventSource.once(event_types.APP_READY, showToast);
    }
}

/**
 * Acquires the write lease for a chat, releasing any previously held lease.
 * On conflict, offers to take over (force-write), which reloads the other
 * holders.
 * @param {string} key Entity key, matching the server's chatKey/groupChatKey
 * @returns {Promise<'acquired'|'readonly'|'disabled'>}
 */
async function acquireWriteLease(key, slot, label) {
    if (!enabled || !registered) {
        return 'disabled';
    }
    const held = currentLeases.get(slot);
    if (held && held.key !== key) {
        api('lease/release', { key: held.key }).catch(() => { });
        currentLeases.delete(slot);
    }
    if (currentLeases.get(slot)?.key === key) {
        return 'acquired';
    }

    const response = await api('lease/acquire', { key, mode: 'write' });
    if (!response.ok) {
        return 'readonly';
    }
    const result = await response.json();
    if (result.ok) {
        currentLeases.set(slot, { key, revision: result.revision });
        return 'acquired';
    }

    const takeOver = await callGenericPopup(
        `<h3>${label} in use</h3><p>This ${label.toLowerCase()} is open in ${result.holders ?? 'another'} other window(s).</p>
         <p>Take over? The other window(s) will be reloaded and their unsaved changes discarded.</p>`,
        POPUP_TYPE.CONFIRM, '', { okButton: 'Take over', cancelButton: 'Stay read-only' });

    if (takeOver !== 1) {
        toastr.info(`${label} is read-only in this window: another window holds it.`, 'Multi-window');
        return 'readonly';
    }

    const forceResponse = await api('lease/force-write', { key });
    if (forceResponse.ok) {
        const forceResult = await forceResponse.json();
        if (forceResult.ok) {
            currentLeases.set(slot, { key, revision: forceResult.revision });
            return 'acquired';
        }
    }
    toastr.error(`Could not take over the ${label.toLowerCase()}.`, 'Multi-window');
    return 'readonly';
}

/**
 * Acquires the write lease for a character chat.
 * @param {string} avatarUrl Character avatar file name
 * @param {string} fileName Chat file name (no extension)
 * @returns {Promise<'acquired'|'readonly'|'disabled'>}
 */
export function leaseChat(avatarUrl, fileName) {
    return acquireWriteLease(`chat/${avatarUrl}/${fileName}`, 'chat', 'Chat');
}

/**
 * Acquires the write lease for a group chat.
 * @param {string} chatId Group chat id
 * @returns {Promise<'acquired'|'readonly'|'disabled'>}
 */
export function leaseGroupChat(chatId) {
    return acquireWriteLease(`groupchat/${chatId}`, 'chat', 'Chat');
}

/**
 * Acquires the write lease for a World Info book.
 * @param {string} name Book name
 * @returns {Promise<'acquired'|'readonly'|'disabled'>}
 */
export function leaseWorld(name) {
    return acquireWriteLease(`world/${name}`, 'world', 'Lorebook');
}

/**
 * Handles a lease rejection on a save (HTTP 409): the chat is owned by
 * another window.
 * @param {Response} response
 * @returns {boolean} true if the response was a lease rejection
 */
export function isLeaseRejection(response) {
    if (!enabled || response.status !== 409) {
        return false;
    }
    toastr.error('Not saved: this chat is owned by another window.', 'Multi-window', { timeOut: 8000 });
    return true;
}
