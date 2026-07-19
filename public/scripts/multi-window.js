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
    const by = poisonReason?.byWindow ? ' by another window' : '';
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
            heldLeases: [...currentLeases.values()],
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
        }
    } catch {
        // Network hiccup: next tick will retry.
    }
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
        const by = reason.byWindow ? ' by another window' : '';
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
