import { getRequestHeaders, eventSource, event_types, main_api } from '../script.js';
import { oai_settings } from './openai.js';
import { textgenerationwebui_settings } from './textgen-settings.js';
import { kai_settings } from './kai-settings.js';
import { nai_settings } from './nai-settings.js';
import { getBootEphemeralProfiles } from './multi-window.js';
import { POPUP_TYPE, callGenericPopup } from './popup.js';
import { debounce_timeout } from './constants.js';
import { debounce, uuidv4 } from './utils.js';

/**
 * Client side of atomic connection profiles.
 *
 * A profile is a self-contained snapshot of the connection + sampler state
 * (the "sections" below). The active profile is applied by overlaying its
 * sections onto the parsed settings.json at the SETTINGS_LOADED_BEFORE seam,
 * so every existing loadSettings/UI path applies it with no special code.
 * Local changes fork a server-memory ephemeral "(edited)" copy - the ⚠️ in
 * the connections panel - which must be explicitly saved to persist.
 */

const DIRTY_CHECK_INTERVAL_MS = 10 * 1000;

/** Live references to the section sources; collected by value via JSON clone. */
function collectSections() {
    return JSON.parse(JSON.stringify({
        main_api: main_api,
        oai_settings: oai_settings,
        textgenerationwebui_settings: textgenerationwebui_settings,
        kai_settings: kai_settings,
        nai_settings: nai_settings,
    }));
}

/** @type {?{id: string, name: string, settings: object}} */
let activeProfile = null;
/** @type {string} JSON snapshot of the sections as last applied/saved */
let appliedSnapshot = '';
let dirty = false;
let needsMigration = false;

async function apiCall(path, body) {
    const response = await fetch(`/api/connection-profiles/${path}`, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(body ?? {}),
    });
    return response;
}

/** Overlays the boot profile onto the parsed settings before loadSettings. */
async function onSettingsLoadedBefore(settings) {
    try {
        const response = await apiCall('list');
        if (!response.ok) {
            return;
        }
        const { profiles, defaultId } = await response.json();

        if (!profiles.length) {
            // First boot with the profile system: current globals become the
            // "Default" profile once the app is ready (migration).
            needsMigration = true;
            return;
        }

        // Precedence: this window's ephemeral (rides re-registration after a
        // reload) > default profile > first profile.
        const ephemeral = getBootEphemeralProfiles()[0];
        const parent = profiles.find(p => p.id === defaultId) ?? profiles[0];
        const source = ephemeral ?? parent;

        activeProfile = {
            id: ephemeral ? (ephemeral.parentId ?? parent.id) : parent.id,
            name: parent.name,
            settings: source.settings,
        };
        for (const [key, value] of Object.entries(source.settings ?? {})) {
            settings[key] = value;
        }
        // Booting from an ephemeral means unsaved changes exist: an empty
        // snapshot keeps the state dirty until saved or reverted.
        dirty = !!ephemeral;
        appliedSnapshot = ephemeral ? '' : JSON.stringify(parent.settings ?? {});
    } catch (error) {
        console.error('Connection profiles: failed to load', error);
    }
}

const upsertEphemeralDebounced = debounce(async () => {
    if (!activeProfile || !dirty) {
        return;
    }
    await apiCall('ephemeral', {
        profile: {
            id: `eph-${activeProfile.id}`,
            parentId: activeProfile.id,
            name: `${activeProfile.name} (edited)`,
            settings: collectSections(),
        },
    });
}, debounce_timeout.relaxed);

function checkDirty() {
    if (!activeProfile) {
        return;
    }
    const snap = JSON.stringify(collectSections());
    const wasDirty = dirty;
    dirty = snap !== appliedSnapshot;
    if (dirty) {
        upsertEphemeralDebounced();
    } else if (wasDirty) {
        apiCall('ephemeral', { profile: { id: `eph-${activeProfile.id}` }, remove: true });
    }
    updateBadge();
}

function updateBadge() {
    const badge = document.getElementById('connection_profile_status');
    if (!badge) {
        return;
    }
    const name = activeProfile?.name ?? '(no profile)';
    badge.querySelector('.cp-name').textContent = name;
    badge.querySelector('.cp-warning').style.display = dirty ? '' : 'none';
    badge.querySelector('.cp-save').style.display = dirty ? '' : 'none';
}

/** Persists the current sections into the active profile (or a new one). */
async function saveActiveProfile() {
    const settings = collectSections();

    if (activeProfile) {
        // Try to overwrite the parent: needs the write lease on it.
        await fetch('/api/sessions/lease/acquire', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ key: `profile/${activeProfile.id}`, mode: 'write' }),
        }).catch(() => { });
        const response = await apiCall('save', {
            profile: { id: activeProfile.id, name: activeProfile.name, settings },
        });
        if (response.ok) {
            activeProfile.settings = settings;
            appliedSnapshot = JSON.stringify(settings);
            dirty = false;
            updateBadge();
            toastr.success(`Profile "${activeProfile.name}" saved.`, 'Connection profiles');
            return;
        }
        if (response.status !== 409) {
            toastr.error('Could not save the profile.', 'Connection profiles');
            return;
        }
        // Owned by another window: fall through to save-as-new.
    }

    const name = await callGenericPopup('Save connection profile as:', POPUP_TYPE.INPUT, activeProfile ? `${activeProfile.name} (copy)` : 'Default');
    if (!name || typeof name !== 'string') {
        return;
    }
    const id = uuidv4();
    const response = await apiCall('save', { profile: { id, name, settings }, makeDefault: !activeProfile });
    if (response.ok) {
        activeProfile = { id, name, settings };
        appliedSnapshot = JSON.stringify(settings);
        dirty = false;
        updateBadge();
        toastr.success(`Profile "${name}" saved.`, 'Connection profiles');
    } else {
        toastr.error('Could not save the profile.', 'Connection profiles');
    }
}

/** One-time migration: current globals become the persistent Default profile. */
async function migrate() {
    const settings = collectSections();
    const id = uuidv4();
    const response = await apiCall('save', {
        profile: { id, name: 'Default', settings },
        makeDefault: true,
    });
    if (response.ok) {
        activeProfile = { id, name: 'Default', settings };
        appliedSnapshot = JSON.stringify(settings);
        console.log('Connection profiles: migrated current settings into the "Default" profile');
    }
}

function injectBadge() {
    const anchor = document.getElementById('rm_api_block');
    if (!anchor || document.getElementById('connection_profile_status')) {
        return;
    }
    const badge = document.createElement('div');
    badge.id = 'connection_profile_status';
    badge.classList.add('flex-container', 'alignItemsCenter');
    badge.innerHTML = `
        <small>Profile: <span class="cp-name"></span></small>
        <span class="cp-warning" title="Virtual profile - will be lost on server restart. Save to keep.">⚠️</span>
        <div class="cp-save menu_button menu_button_icon" title="Save connection profile">
            <i class="fa-solid fa-save"></i><span>Save</span>
        </div>`;
    badge.querySelector('.cp-save').addEventListener('click', saveActiveProfile);
    anchor.prepend(badge);
    updateBadge();
}

/**
 * Initializes the connection profile client. Call once during app init,
 * before settings are loaded.
 */
export function initConnectionProfiles() {
    eventSource.on(event_types.SETTINGS_LOADED_BEFORE, onSettingsLoadedBefore);
    eventSource.once(event_types.APP_READY, async () => {
        if (needsMigration) {
            await migrate();
        }
        injectBadge();
        setInterval(checkDirty, DIRTY_CHECK_INTERVAL_MS);
        eventSource.on(event_types.SETTINGS_UPDATED, checkDirty);
        updateBadge();
    });
}
