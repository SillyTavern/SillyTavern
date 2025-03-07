import { saveSettingsDebounced } from '../../script.js';

const MIGRATED_MARKER = '__migrated';
const MIGRATABLE_KEYS = [
    /^AlertRegex_/,
    /^AlertWI_/,
    /^Assets_SkipConfirm_/,
    /^Characters_PerPage$/,
    /^DataBank_sortField$/,
    /^DataBank_sortOrder$/,
    /^extension_update_nag$/,
    /^extensions_sortByName$/,
    /^FeatherlessModels_PerPage$/,
    /^GroupMembers_PerPage$/,
    /^GroupCandidates_PerPage$/,
    /^LNavLockOn$/,
    /^LNavOpened$/,
    /^mediaWarningShown:/,
    /^NavLockOn$/,
    /^NavOpened$/,
    /^Personas_PerPage$/,
    /^Personas_GridView$/,
    /^Proxy_SkipConfirm_/,
    /^qr--executeShortcut$/,
    /^qr--syntax$/,
    /^qr--tabSize$/,
    /^qr--wrap$/,
    /^RegenerateWithCtrlEnter$/,
    /^SelectedNavTab$/,
    /^sendAsNamelessWarningShown$/,
    /^StoryStringValidationCache$/,
    /^WINavOpened$/,
    /^WI_PerPage$/,
    /^world_info_sort_order$/,
];

/**
 * Provides access to account storage of arbitrary key-value pairs.
 */
class AccountStorage {
    /**
     * @type {Record<string, string>} Storage state
     */
    #state = {};

    /**
     * @type {boolean} If the storage was initialized
     */
    #ready = false;

    #migrateLocalStorage() {
        const localStorageKeys = [];
        for (let i = 0; i < globalThis.localStorage.length; i++) {
            localStorageKeys.push(globalThis.localStorage.key(i));
        }
        for (const key of localStorageKeys) {
            if (MIGRATABLE_KEYS.some(k => k.test(key))) {
                const value = globalThis.localStorage.getItem(key);
                this.#state[key] = value;
                globalThis.localStorage.removeItem(key);
            }
        }
    }

    /**
     * Initialize the account storage.
     * @param {Object} state Initial state
     */
    init(state) {
        if (state && typeof state === 'object') {
            this.#state = Object.assign(this.#state, state);
        }

        if (!Object.hasOwn(this.#state, MIGRATED_MARKER)) {
            this.#migrateLocalStorage();
            this.#state[MIGRATED_MARKER] = '1';
            saveSettingsDebounced();
        }

        this.#ready = true;
    }

    /**
     * Get the value of a key in account storage.
     * @param {string} key Key to get
     * @returns {string|null} Value of the key
     */
    getItem(key) {
        if (!this.#ready) {
            console.warn(`AccountStorage not ready (trying to read from ${key})`);
        }

        return Object.hasOwn(this.#state, key) ? String(this.#state[key]) : null;
    }

    /**
     * Set a key in account storage.
     * @param {string} key Key to set
     * @param {string} value Value to set
     */
    setItem(key, value) {
        if (!this.#ready) {
            console.warn(`AccountStorage not ready (trying to write to ${key})`);
        }

        this.#state[key] = String(value);
        saveSettingsDebounced();
    }

    /**
     * Remove a key from account storage.
     * @param {string} key Key to remove
     */
    removeItem(key) {
        if (!this.#ready) {
            console.warn(`AccountStorage not ready (trying to remove ${key})`);
        }

        if (!Object.hasOwn(this.#state, key)) {
            return;
        }

        delete this.#state[key];
        saveSettingsDebounced();
    }

    /**
     * Gets a snapshot of the storage state.
     * @returns {Record<string, string>} A deep clone of the storage state
     */
    getState() {
        return structuredClone(this.#state);
    }
}

/**
 * Account storage instance.
 */
export const accountStorage = new AccountStorage();
