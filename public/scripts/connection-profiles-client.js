import { getRequestHeaders, eventSource, event_types, main_api } from '../script.js';
import { oai_settings } from './openai.js';
import { textgenerationwebui_settings } from './textgen-settings.js';
import { kai_settings } from './kai-settings.js';
import { nai_settings } from './nai-settings.js';
import { extension_settings } from './extensions.js';
import { getBootEphemeralProfiles, watchEntity, unwatchEntity, onEntityStale, noteEntityRevision } from './multi-window.js';
import { POPUP_TYPE, callGenericPopup } from './popup.js';
import { debounce_timeout } from './constants.js';
import { debounce, uuidv4 } from './utils.js';

/**
 * Client side of atomic connection profiles.
 *
 * A profile is a snapshot of the connection + sampler state (the "sections"
 * below) plus a reference to the selected Connection Preset. The active
 * profile is applied by overlaying its sections onto the parsed settings.json
 * at the SETTINGS_LOADED_BEFORE seam, so every existing loadSettings/UI path
 * applies it with no special code.
 *
 * The Connection Preset UI (the connection-manager extension) is the preset
 * selector, fronted by an Anonymous/Named mode toggle injected under its
 * heading. Anonymous means the content is the profile's own: the preset
 * dropdown is hidden and the preset buttons are grayed out. Named means the
 * profile references a named preset: the dropdown appears and a preset must
 * be selected (switching to Named with no presets yet triggers the create
 * flow). When a named preset is selected and the working state diverges from
 * it, the preset shows "(unsaved)" and the profile cannot be saved until the
 * preset is updated or the toggle is switched to Anonymous (folding the
 * changes into the profile).
 *
 * Local changes fork a server-memory ephemeral "(edited)" copy - the ⚠️ in
 * the connections panel - which must be explicitly saved to persist.
 */

const DIRTY_CHECK_INTERVAL_MS = 10 * 1000;

/** The connection-manager buttons that only apply to named presets. */
const PRESET_BUTTON_IDS = [
    'view_connection_profile',
    'create_connection_profile',
    'update_connection_profile',
    'edit_connection_profile',
    'reload_connection_profile',
    'delete_connection_profile',
];

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

/** The Connection Preset currently selected in the connection manager. */
function getSelectedPresetId() {
    return extension_settings.connectionManager?.selectedProfile || null;
}

/** Display name of a Connection Preset. */
function getPresetName(presetId) {
    return extension_settings.connectionManager?.profiles?.find(p => p.id === presetId)?.name ?? presetId;
}

/** @type {?{id: string, name: string, settings: object}} */
let activeProfile = null;
/** @type {{id: string, name: string}[]} */
let profileList = [];
let currentDefaultId = null;
/** @type {string} JSON snapshot of the sections as last applied/saved */
let appliedSnapshot = '';
let dirty = false;
let needsMigration = false;

/** @type {?string} The Connection Preset id this window is tracking; null = anonymous. */
let activePresetId = null;
/** @type {?string} The presetId as persisted in the active profile. */
let persistedPresetId = null;
/** @type {string} JSON snapshot of the sections when the preset was applied/updated. */
let presetSnapshot = '';
/** Named preset selected and the working state has diverged from it. */
let presetUnsaved = false;
/** Another window saved a newer revision of the active profile. */
let profileStale = false;
/** Another window saved (or deleted) a newer revision of the active preset. */
let presetStale = false;
/** @type {?string} The preset id currently revision-watched. */
let watchedPresetId = null;

async function apiCall(path, body) {
    const response = await fetch(`/api/connection-profiles/${path}`, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(body ?? {}),
    });
    return response;
}

/**
 * Acquires the write lease for an entity, returning true when held.
 * @param {string} key
 * @returns {Promise<boolean>}
 */
async function tryAcquireWrite(key) {
    try {
        const response = await fetch('/api/sessions/lease/acquire', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ key, mode: 'write' }),
        });
        return response.ok && (await response.json()).ok === true;
    } catch {
        return false;
    }
}

/** Overlays the boot profile onto the parsed settings before loadSettings. */
async function onSettingsLoadedBefore(settings) {
    try {
        const response = await apiCall('list');
        if (!response.ok) {
            return;
        }
        const { profiles, defaultId } = await response.json();
        profileList = profiles.map(p => ({ id: p.id, name: p.name }));
        currentDefaultId = defaultId;

        if (!profiles.length) {
            // First boot with the profile system: current globals become the
            // "Default" profile once the app is ready (migration).
            needsMigration = true;
            return;
        }

        // Precedence: explicit switch pick (one-shot, discards unsaved
        // changes) > this window's ephemeral > default profile > first.
        const pick = sessionStorage.getItem('mw_boot_profile');
        sessionStorage.removeItem('mw_boot_profile');
        const ephemeral = pick ? null : getBootEphemeralProfiles()[0];
        if (pick) {
            for (const stale of getBootEphemeralProfiles()) {
                apiCall('ephemeral', { profile: { id: stale.id }, remove: true });
            }
        }
        const parent = profiles.find(p => p.id === pick)
            ?? profiles.find(p => p.id === defaultId)
            ?? profiles[0];

        persistedPresetId = parent.presetId ?? null;
        activePresetId = ephemeral ? (ephemeral.presetId ?? null) : persistedPresetId;

        // Content source: ephemeral working tree > profile.
        const content = ephemeral?.settings ?? parent.settings ?? {};

        activeProfile = {
            id: ephemeral ? (ephemeral.parentId ?? parent.id) : parent.id,
            name: parent.name,
            settings: parent.settings ?? {},
        };
        for (const [key, value] of Object.entries(content)) {
            settings[key] = value;
        }

        // The profile's preset reference drives the Connection Preset UI.
        if (settings.extension_settings?.connectionManager) {
            settings.extension_settings.connectionManager.selectedProfile = activePresetId ?? '';
        }

        // Booting from an ephemeral means unsaved changes exist: an empty
        // snapshot keeps the state dirty until saved or reverted.
        dirty = !!ephemeral;
        appliedSnapshot = ephemeral ? '' : JSON.stringify(content);
        presetSnapshot = appliedSnapshot;
    } catch (error) {
        console.error('Connection profiles: failed to load', error);
    }
}

const upsertEphemeralDebounced = debounce(async () => {
    if (!activeProfile || (!dirty && !presetUnsaved)) {
        return;
    }
    await apiCall('ephemeral', {
        profile: {
            id: `eph-${activeProfile.id}`,
            parentId: activeProfile.id,
            presetId: activePresetId,
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
    const wasDirty = dirty || presetUnsaved;

    // Follow the Connection Preset selection: a change means the preset was
    // just applied (or Anonymous selected) - resnapshot against it.
    const selected = getSelectedPresetId();
    if (selected !== activePresetId) {
        activePresetId = selected;
        presetSnapshot = snap;
        watchActivePreset();
    }

    const refDirty = activePresetId !== persistedPresetId;
    if (activePresetId) {
        // Named preset: content divergence belongs to the preset, not the
        // profile. The profile is dirty only if its reference changed.
        presetUnsaved = snap !== presetSnapshot;
        dirty = refDirty;
    } else {
        presetUnsaved = false;
        dirty = refDirty || snap !== appliedSnapshot;
    }
    if (dirty || presetUnsaved) {
        upsertEphemeralDebounced();
    } else if (wasDirty) {
        apiCall('ephemeral', { profile: { id: `eph-${activeProfile.id}` }, remove: true });
    }
    updateBadge();
}

/**
 * Revision-watches the active named preset so another window's save (or
 * delete - both bump the revision) surfaces as staleness. Transitive: the
 * profile references the preset, so a stale preset means the window's
 * working state no longer matches what a reload would produce.
 */
function watchActivePreset() {
    const key = activePresetId ? `preset/${activePresetId}` : null;
    const watchedKey = watchedPresetId ? `preset/${watchedPresetId}` : null;
    if (key === watchedKey) {
        return;
    }
    if (watchedKey) {
        unwatchEntity(watchedKey);
    }
    presetStale = false;
    watchedPresetId = activePresetId;
    if (key) {
        watchEntity(key);
    }
}

/**
 * Marks the current preset state as saved (called after the connection
 * manager's own Update flow persists the preset).
 */
export function notePresetUpdated() {
    presetSnapshot = JSON.stringify(collectSections());
    presetUnsaved = false;
    // This window's save is now the newest revision - it is no longer stale.
    presetStale = false;
    updateBadge();
}

function updateBadge() {
    const manager = document.getElementById('connection_profile_status');
    if (!manager) {
        return;
    }
    const select = manager.querySelector('.cp-select');
    select.innerHTML = '';
    for (const p of profileList) {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.id === currentDefaultId ? `${p.name} ★` : p.name;
        if (p.id === activeProfile?.id && profileStale) {
            option.textContent += ' (updated elsewhere)';
        }
        select.appendChild(option);
    }
    if (activeProfile) {
        select.value = activeProfile.id;
    }
    manager.querySelector('.cp-warning').style.display = dirty ? '' : 'none';
    manager.querySelector('.cp-save').style.display = dirty ? '' : 'none';

    // The Anonymous/Named toggle fronts the Connection Preset select. The
    // mode follows the extension's live selection (set synchronously on
    // change), not activePresetId, which lags behind the delayed dirty check.
    const named = !!getSelectedPresetId();
    const modeToggle = document.getElementById('cp_preset_mode');
    if (modeToggle) {
        modeToggle.querySelector('.cp-anon-name').textContent = activeProfile?.name ?? 'profile';
        modeToggle.querySelector('input[value="anonymous"]').checked = !named;
        modeToggle.querySelector('input[value="named"]').checked = named;
    }
    const presetSelect = document.getElementById('connection_profiles');
    if (presetSelect) {
        // Anonymous is a toggle state, not a select option: the dropdown only
        // ever offers named presets and only shows in Named mode.
        presetSelect.style.display = named ? '' : 'none';
        const noneOption = presetSelect.querySelector('option[value=""]');
        if (noneOption) {
            noneOption.hidden = true;
        }
        for (const id of PRESET_BUTTON_IDS) {
            document.getElementById(id)?.classList.toggle('disabled', !named);
        }
        // The selected named preset carries the "(unsaved)" marker when the
        // working state has diverged from it, and "(updated elsewhere)" when
        // another window saved a newer revision of it.
        for (const option of presetSelect.options) {
            if (!option.value) {
                continue;
            }
            option.textContent = option.textContent.replace(/( \((unsaved|updated elsewhere)\))+$/, '');
            if (option.value === activePresetId && presetUnsaved) {
                option.textContent += ' (unsaved)';
            }
            if (option.value === activePresetId && presetStale) {
                option.textContent += ' (updated elsewhere)';
            }
        }
    }
}

/** Persists the current state into the active profile (or a new one). */
async function saveActiveProfile() {
    // A profile never persists content that diverges from the named
    // Connection Preset it references: resolve the preset first.
    if (activePresetId && presetUnsaved) {
        toastr.error(
            `Connection Preset "${getPresetName(activePresetId)}" has unsaved changes. Update the preset, or switch to Anonymous to fold the changes into this profile.`,
            'Profile not saved', { timeOut: 10000 },
        );
        return;
    }

    const settings = collectSections();

    if (activeProfile) {
        // Try to overwrite the parent: needs the write lease on it.
        await tryAcquireWrite(`profile/${activeProfile.id}`);
        const response = await apiCall('save', {
            profile: { id: activeProfile.id, name: activeProfile.name, presetId: activePresetId, settings },
        });
        if (response.ok) {
            activeProfile.settings = settings;
            persistedPresetId = activePresetId;
            appliedSnapshot = JSON.stringify(settings);
            dirty = false;
            profileStale = false;
            noteEntityRevision(`profile/${activeProfile.id}`, (await response.json()).revision);
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
    const response = await apiCall('save', { profile: { id, name, presetId: activePresetId, settings }, makeDefault: !activeProfile });
    if (response.ok) {
        activeProfile = { id, name, settings };
        persistedPresetId = activePresetId;
        appliedSnapshot = JSON.stringify(settings);
        profileList.push({ id, name });
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
        profile: { id, name: 'Default', presetId: getSelectedPresetId(), settings },
        makeDefault: true,
    });
    if (response.ok) {
        activeProfile = { id, name: 'Default', settings };
        activePresetId = getSelectedPresetId();
        persistedPresetId = activePresetId;
        appliedSnapshot = JSON.stringify(settings);
        presetSnapshot = appliedSnapshot;
        profileList.push({ id, name: 'Default' });
        currentDefaultId = id;
        console.log('Connection profiles: migrated current settings into the "Default" profile');
    }
}

async function switchProfile(id) {
    if (!activeProfile || id === activeProfile.id) {
        return;
    }
    if (dirty || presetUnsaved) {
        const confirmed = await callGenericPopup(
            'Switching profiles discards the unsaved changes in this window. Continue?',
            POPUP_TYPE.CONFIRM, '', { okButton: 'Discard and switch', cancelButton: 'Cancel' });
        if (confirmed !== 1) {
            updateBadge();
            return;
        }
    }
    sessionStorage.setItem('mw_boot_profile', id);
    location.reload();
}

async function saveAsNewProfile() {
    const name = await callGenericPopup('New profile name:', POPUP_TYPE.INPUT, activeProfile ? `${activeProfile.name} (copy)` : 'New profile');
    if (!name || typeof name !== 'string') {
        return;
    }
    const settings = collectSections();
    const id = uuidv4();
    const response = await apiCall('save', { profile: { id, name, presetId: activePresetId, settings } });
    if (response.ok) {
        activeProfile = { id, name, settings };
        persistedPresetId = activePresetId;
        appliedSnapshot = JSON.stringify(settings);
        profileList.push({ id, name });
        dirty = false;
        updateBadge();
        toastr.success(`Profile "${name}" saved.`, 'Connection profiles');
    }
}

async function deleteActiveProfile() {
    if (!activeProfile || profileList.length < 2) {
        toastr.info('Cannot delete the last profile.', 'Connection profiles');
        return;
    }
    const confirmed = await callGenericPopup(
        `Delete profile "${activeProfile.name}"?`, POPUP_TYPE.CONFIRM, '',
        { okButton: 'Delete', cancelButton: 'Cancel' });
    if (confirmed !== 1) {
        return;
    }
    await tryAcquireWrite(`profile/${activeProfile.id}`);
    const response = await apiCall('delete', { id: activeProfile.id });
    if (!response.ok) {
        toastr.error('Could not delete: the profile is owned by another window.', 'Connection profiles');
        return;
    }
    const fallback = profileList.find(p => p.id !== activeProfile.id);
    sessionStorage.setItem('mw_boot_profile', fallback.id);
    location.reload();
}

async function setDefaultProfile() {
    if (!activeProfile) {
        return;
    }
    const response = await apiCall('set-default', { id: activeProfile.id });
    if (response.ok) {
        currentDefaultId = activeProfile.id;
        updateBadge();
        toastr.success(`"${activeProfile.name}" is now the default profile.`, 'Connection profiles');
    }
}

/**
 * Switches between Anonymous (content owned by the profile) and Named
 * (profile references a Connection Preset) by driving the extension's own
 * select, so its change handler applies/clears the preset normally.
 * @param {Event} event
 */
function onPresetModeToggle(event) {
    const mode = /** @type {HTMLInputElement} */ (event.target).value;
    const presetSelect = /** @type {HTMLSelectElement} */ (document.getElementById('connection_profiles'));
    if (!presetSelect || (mode === 'named') === !!getSelectedPresetId()) {
        return;
    }
    if (mode === 'anonymous') {
        presetSelect.value = '';
        presetSelect.dispatchEvent(new Event('change', { bubbles: true }));
        updateBadge();
        return;
    }
    const presets = extension_settings.connectionManager?.profiles ?? [];
    if (!presets.length) {
        // Nothing to select yet: run the extension's create flow. Success
        // lands on the new preset via its own events; cancel emits nothing,
        // so show Anonymous again right away instead of a dead Named state.
        updateBadge();
        document.getElementById('create_connection_profile')?.click();
        return;
    }
    const target = presets.find(p => p.id === persistedPresetId) ?? presets[0];
    presetSelect.value = target.id;
    presetSelect.dispatchEvent(new Event('change', { bubbles: true }));
    updateBadge();
}

/** Injects the Anonymous/Named toggle under the Connection Preset heading. */
function injectPresetModeToggle() {
    const presetSelect = document.getElementById('connection_profiles');
    const controlsRow = presetSelect?.parentElement;
    if (!controlsRow || document.getElementById('cp_preset_mode')) {
        return;
    }
    const toggle = document.createElement('div');
    toggle.id = 'cp_preset_mode';
    toggle.className = 'flex-container alignItemsCenter';
    toggle.style.gap = '10px';
    toggle.innerHTML = `
        <label class="checkbox_label" title="The preset content is embedded in and owned by the connection profile">
            <input type="radio" name="cp_preset_mode" value="anonymous">
            <span>Anonymous (<span class="cp-anon-name">profile</span>)</span>
        </label>
        <label class="checkbox_label" title="The connection profile references a named Connection Preset">
            <input type="radio" name="cp_preset_mode" value="named">
            <span data-i18n="Named:">Named:</span>
        </label>`;
    toggle.addEventListener('change', onPresetModeToggle);
    controlsRow.parentElement.insertBefore(toggle, controlsRow);
}

function injectBadge() {
    const anchor = document.getElementById('rm_api_block');
    if (!anchor || document.getElementById('connection_profile_status')) {
        return;
    }
    const manager = document.createElement('div');
    manager.id = 'connection_profile_status';
    manager.innerHTML = `
        <div class="flex-container justifyCenter alignItemsCenter" style="gap: 6px;">
            <strong>Profile:</strong>
            <select class="cp-select text_pole" style="max-width: 40%; flex: 0 1 auto;"></select>
            <span class="cp-warning" title="Virtual profile - will be lost on server restart. Save to keep." style="color: #ffc107; font-size: 1.2em; text-shadow: 0 0 2px #000;">&#9888;&#65039;</span>
            <div class="cp-save menu_button menu_button_icon" title="Save changes into this profile">
                <i class="fa-solid fa-save"></i><span>Save</span>
            </div>
            <i class="cp-save-as menu_button fa-solid fa-file-circle-plus" title="Save as new profile"></i>
            <i class="cp-default menu_button fa-solid fa-star" title="Make this the default profile"></i>
            <i class="cp-delete menu_button fa-solid fa-trash-can" title="Delete this profile"></i>
        </div>
        <hr>`;
    manager.querySelector('.cp-save').addEventListener('click', saveActiveProfile);
    manager.querySelector('.cp-save-as').addEventListener('click', saveAsNewProfile);
    manager.querySelector('.cp-default').addEventListener('click', setDefaultProfile);
    manager.querySelector('.cp-delete').addEventListener('click', deleteActiveProfile);
    manager.querySelector('.cp-select').addEventListener('change', (e) => switchProfile(e.target.value));
    anchor.prepend(manager);

    // React promptly when the Connection Preset selection changes (give the
    // preset's commands a moment to apply before snapshotting).
    document.getElementById('connection_profiles')
        ?.addEventListener('change', () => setTimeout(checkDirty, 1500));

    injectPresetModeToggle();
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
        if (!activeProfile) {
            // Feature off (or the profile list unreachable): leave the
            // legacy UI untouched.
            return;
        }
        injectBadge();
        setInterval(checkDirty, DIRTY_CHECK_INTERVAL_MS);
        eventSource.on(event_types.SETTINGS_UPDATED, checkDirty);
        // The connection manager's own Update flow saves the preset; a
        // finished preset apply is the moment to resnapshot against it.
        eventSource.on(event_types.CONNECTION_PROFILE_UPDATED, () => notePresetUpdated());
        eventSource.on(event_types.CONNECTION_PROFILE_LOADED, () => checkDirty());
        updateBadge();

        // Watch the active profile so other windows' saves show up as
        // staleness (never hot-applied - fork or reload, no merging).
        onEntityStale((key) => {
            if (activeProfile && key === `profile/${activeProfile.id}`) {
                profileStale = true;
                toastr.warning(
                    `Profile "${activeProfile.name}" was updated in another window. Reload to get the new version, or save yours as a new profile.`,
                    'Connection profiles', { timeOut: 15000 },
                );
                updateBadge();
            }
            if (activePresetId && key === `preset/${activePresetId}`) {
                presetStale = true;
                toastr.warning(
                    `Connection Preset "${getPresetName(activePresetId)}" was updated or deleted in another window. Reload to get the new version.`,
                    'Connection presets', { timeOut: 15000 },
                );
                updateBadge();
            }
        });
        if (activeProfile) {
            watchEntity(`profile/${activeProfile.id}`);
        }
        watchActivePreset();
    });
}
