import { getRequestHeaders, eventSource, event_types } from '../script.js';
import { power_user } from './power-user.js';

/**
 * Persona extraction out of the settings blob (design §8.1).
 *
 * Personas live as files (data/<user>/personas/<avatarId>.json) behind
 * /api/personas; the in-memory model (power_user.personas +
 * power_user.persona_descriptions) is unchanged, hydrated from the files at
 * boot. Files are the source of truth: blob-only personas are migrated once
 * (marker power_user.personasMigratedToFiles), and personas deleted from the
 * files elsewhere disappear from the working copy at the next boot.
 *
 * Persistence is a diff-sync: mutations anywhere in personas.js are picked
 * up by snapshot comparison and written to the persona's file through the
 * lease-aware fetch interceptor (transient write lease, conflict toast).
 * The legacy blob fields remain in the explicit-save payload as rollback
 * state for one release cycle.
 */

const SYNC_INTERVAL_MS = 10 * 1000;

let filesAvailable = false;
/** @type {Map<string, string>} avatarId -> serialized persona as last synced */
let syncedState = new Map();

async function personaApi(path, body) {
    return fetch(`/api/personas/${path}`, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(body ?? {}),
    });
}

/** The file-shape of one persona, collected from the in-memory model. */
function collectPersona(avatarId) {
    return {
        avatarId,
        name: power_user.personas[avatarId] ?? '',
        description: power_user.persona_descriptions[avatarId] ?? {},
    };
}

/**
 * Hydrates personas from files into the parsed settings before loadSettings,
 * migrating blob-only personas to files once.
 * @param {object} settings Parsed settings.json about to be loaded
 */
async function onSettingsLoadedBefore(settings) {
    let response;
    try {
        response = await personaApi('list', {});
    } catch {
        return;
    }
    if (!response.ok) {
        return;
    }
    filesAvailable = true;
    const pu = settings.power_user ?? {};
    const blobPersonas = pu.personas ?? {};
    const blobDescriptions = pu.persona_descriptions ?? {};
    const personas = (await response.json()).personas ?? [];
    const fileIds = new Set(personas.map(p => p.avatarId));

    if (!pu.personasMigratedToFiles) {
        const toMigrate = Object.keys(blobPersonas).filter(id => !fileIds.has(id));
        for (const avatarId of toMigrate) {
            const saved = await personaApi('save', {
                persona: {
                    avatarId,
                    name: blobPersonas[avatarId] ?? '',
                    description: blobDescriptions[avatarId] ?? {},
                },
            });
            if (saved.ok) {
                personas.push({ avatarId, name: blobPersonas[avatarId] ?? '', description: blobDescriptions[avatarId] ?? {} });
            } else {
                console.error('Personas: failed to migrate persona to file', avatarId);
                return; // keep blob authoritative; retry next boot
            }
        }
        if (toMigrate.length) {
            console.log(`Personas: migrated ${toMigrate.length} persona(s) to files`);
        }
        pu.personasMigratedToFiles = true;
        settings.power_user = pu;
    }

    pu.personas = {};
    pu.persona_descriptions = {};
    syncedState = new Map();
    for (const persona of personas) {
        delete persona.revision; // server-side bookkeeping, not persona content
        pu.personas[persona.avatarId] = persona.name;
        pu.persona_descriptions[persona.avatarId] = persona.description ?? {};
        // The synced baseline is the FILE state: anything the boot itself
        // creates (e.g. the default persona on first run) diffs against it
        // and gets persisted on the first sync pass.
        syncedState.set(persona.avatarId, JSON.stringify({
            avatarId: persona.avatarId,
            name: persona.name,
            description: persona.description ?? {},
        }));
    }
}

let syncing = false;

/**
 * Persists in-memory persona changes to their files: new/changed personas
 * are saved, removed ones deleted. Runs through the fetch interceptor, so
 * each write holds a transient lease and conflicts surface as a toast (the
 * failed entry stays un-synced and retries on the next pass).
 */
async function syncPersonas() {
    if (!filesAvailable || syncing) {
        return;
    }
    syncing = true;
    try {
        const current = new Set(Object.keys(power_user.personas ?? {}));
        for (const avatarId of current) {
            const serialized = JSON.stringify(collectPersona(avatarId));
            if (syncedState.get(avatarId) === serialized) {
                continue;
            }
            const response = await personaApi('save', { persona: JSON.parse(serialized) });
            if (response.ok) {
                syncedState.set(avatarId, serialized);
            }
        }
        for (const avatarId of [...syncedState.keys()]) {
            if (current.has(avatarId)) {
                continue;
            }
            const response = await personaApi('delete', { avatarId });
            if (response.ok) {
                syncedState.delete(avatarId);
            }
        }
    } finally {
        syncing = false;
    }
}

/**
 * Initializes persona file storage. Call once during app init, before
 * settings are loaded. No-op when the server has the multi-window feature
 * disabled (personas stay in the blob, legacy behavior).
 */
export function initPersonaFiles() {
    eventSource.on(event_types.SETTINGS_LOADED_BEFORE, onSettingsLoadedBefore);
    eventSource.once(event_types.APP_READY, () => {
        if (!filesAvailable) {
            return;
        }
        setInterval(syncPersonas, SYNC_INTERVAL_MS);
        eventSource.on(event_types.SETTINGS_UPDATED, syncPersonas);
    });
}
