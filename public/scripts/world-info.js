import { saveSettings, callPopup, substituteParams, getRequestHeaders, chat_metadata, this_chid, characters, saveCharacterDebounced, menu_type, eventSource, event_types, getExtensionPromptByName, saveMetadata, getCurrentChatId, extension_prompt_roles } from '../script.js';
import { download, debounce, initScrollHeight, resetScrollHeight, parseJsonFile, extractDataFromPng, getFileBuffer, getCharaFilename, getSortableDelay, escapeRegex, PAGINATION_TEMPLATE, navigation_option, waitUntilCondition, isTrueBoolean, setValueByPath, flashHighlight, select2ModifyOptions, getSelect2OptionId, dynamicSelect2DataViaAjax, highlightRegex, select2ChoiceClickSubscribe, isFalseBoolean, getSanitizedFilename, checkOverwriteExistingData, getStringHash, parseStringArray, cancelDebounce } from './utils.js';
import { extension_settings, getContext } from './extensions.js';
import { NOTE_MODULE_NAME, metadata_keys, shouldWIAddPrompt } from './authors-note.js';
import { isMobile } from './RossAscends-mods.js';
import { FILTER_TYPES, FilterHelper } from './filters.js';
import { getTokenCountAsync } from './tokenizers.js';
import { power_user } from './power-user.js';
import { getTagKeyForEntity } from './tags.js';
import { debounce_timeout } from './constants.js';
import { getRegexedString, regex_placement } from './extensions/regex/engine.js';
import { SlashCommandParser } from './slash-commands/SlashCommandParser.js';
import { SlashCommand } from './slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from './slash-commands/SlashCommandArgument.js';
import { SlashCommandEnumValue, enumTypes } from './slash-commands/SlashCommandEnumValue.js';
import { commonEnumProviders, enumIcons } from './slash-commands/SlashCommandCommonEnumsProvider.js';
import { SlashCommandClosure } from './slash-commands/SlashCommandClosure.js';
import { callGenericPopup, Popup, POPUP_TYPE } from './popup.js';
import { StructuredCloneMap } from './util/StructuredCloneMap.js';
import { renderTemplateAsync } from './templates.js';

export const world_info_insertion_strategy = {
    evenly: 0,
    character_first: 1,
    global_first: 2,
};

export const world_info_logic = {
    AND_ANY: 0,
    NOT_ALL: 1,
    NOT_ANY: 2,
    AND_ALL: 3,
};

/**
 * @enum {number} Possible states of the WI evaluation
 */
export const scan_state = {
    /**
     * The scan will be stopped.
     */
    NONE: 0,
    /**
     * Initial state.
     */
    INITIAL: 1,
    /**
     * The scan is triggered by a recursion step.
     */
    RECURSION: 2,
    /**
     * The scan is triggered by a min activations depth skew.
     */
    MIN_ACTIVATIONS: 3,
};

const WI_ENTRY_EDIT_TEMPLATE = $('#entry_edit_template .world_entry');

export let world_info = {};
export let selected_world_info = [];
/** @type {string[]} */
export let world_names;
export let world_info_depth = 2;
export let world_info_min_activations = 0; // if > 0, will continue seeking chat until minimum world infos are activated
export let world_info_min_activations_depth_max = 0; // used when (world_info_min_activations > 0)

export let world_info_budget = 25;
export let world_info_include_names = true;
export let world_info_recursive = false;
export let world_info_overflow_alert = false;
export let world_info_case_sensitive = false;
export let world_info_match_whole_words = false;
export let world_info_use_group_scoring = false;
export let world_info_character_strategy = world_info_insertion_strategy.character_first;
export let world_info_budget_cap = 0;
export let world_info_max_recursion_steps = 0;
const saveWorldDebounced = debounce(async (name, data) => await _save(name, data), debounce_timeout.relaxed);
const saveSettingsDebounced = debounce(() => {
    Object.assign(world_info, { globalSelect: selected_world_info });
    saveSettings();
}, debounce_timeout.relaxed);
const sortFn = (a, b) => b.order - a.order;
let updateEditor = (navigation, flashOnNav = true) => { console.debug('Triggered WI navigation', navigation, flashOnNav); };

// Do not optimize. updateEditor is a function that is updated by the displayWorldEntries with new data.
export const worldInfoFilter = new FilterHelper(() => updateEditor());
export const SORT_ORDER_KEY = 'world_info_sort_order';
export const METADATA_KEY = 'world_info';

export const DEFAULT_DEPTH = 4;
export const DEFAULT_WEIGHT = 100;
export const MAX_SCAN_DEPTH = 1000;
const KNOWN_DECORATORS = ['@@activate', '@@dont_activate'];

// Typedef area
/**
 * @typedef {object} WIScanEntry The entry that triggered the scan
 * @property {number} [scanDepth] The depth of the scan
 * @property {boolean} [caseSensitive] If the scan is case sensitive
 * @property {boolean} [matchWholeWords] If the scan should match whole words
 * @property {boolean} [useGroupScoring] If the scan should use group scoring
 * @property {number} [uid] The UID of the entry that triggered the scan
 * @property {string} [world] The world info book of origin of the entry
 * @property {string[]} [key] The primary keys to scan for
 * @property {string[]} [keysecondary] The secondary keys to scan for
 * @property {number} [selectiveLogic] The logic to use for selective activation
 * @property {number} [sticky] The sticky value of the entry
 * @property {number} [cooldown] The cooldown of the entry
 * @property {number} [delay] The delay of the entry
 * @property {string[]} [decorators] Array of decorators for the entry
 * @property {number} [hash] The hash of the entry
 */

/**
 * @typedef {object} WITimedEffect Timed effect for world info
 * @property {number} hash Hash of the entry that triggered the effect
 * @property {number} start The chat index where the effect starts
 * @property {number} end The chat index where the effect ends
 * @property {boolean} protected The protected effect can't be removed if the chat does not advance
 */

/**
 * @typedef TimedEffectType Type of timed effect
 * @type {'sticky'|'cooldown'|'delay'}
 */
// End typedef area

/**
 * Represents a scanning buffer for one evaluation of World Info.
 */
class WorldInfoBuffer {
    /**
     * @type {object[]} Array of entries that need to be activated no matter what
     */
    static externalActivations = [];

    /**
     * @type {string[]} Array of messages sorted by ascending depth
     */
    #depthBuffer = [];

    /**
     * @type {string[]} Array of strings added by recursive scanning
     */
    #recurseBuffer = [];

    /**
     * @type {string[]} Array of strings added by prompt injections that are valid for the current scan
     */
    #injectBuffer = [];

    /**
     * @type {number} The skew of the global scan depth. Used in "min activations"
     */
    #skew = 0;

    /**
     * @type {number} The starting depth of the global scan depth.
     */
    #startDepth = 0;

    /**
     * Initialize the buffer with the given messages.
     * @param {string[]} messages Array of messages to add to the buffer
     */
    constructor(messages) {
        this.#initDepthBuffer(messages);
    }

    /**
     * Populates the buffer with the given messages.
     * @param {string[]} messages Array of messages to add to the buffer
     * @returns {void} Hardly seen nothing down here
     */
    #initDepthBuffer(messages) {
        for (let depth = 0; depth < MAX_SCAN_DEPTH; depth++) {
            if (messages[depth]) {
                this.#depthBuffer[depth] = messages[depth].trim();
            }
            // break if last message is reached
            if (depth === messages.length - 1) {
                break;
            }
        }
    }

    /**
     * Gets a string that respects the case sensitivity setting
     * @param {string} str The string to transform
     * @param {WIScanEntry} entry The entry that triggered the scan
     * @returns {string} The transformed string
    */
    #transformString(str, entry) {
        const caseSensitive = entry.caseSensitive ?? world_info_case_sensitive;
        return caseSensitive ? str : str.toLowerCase();
    }

    /**
     * Gets all messages up to the given depth + recursion buffer.
     * @param {WIScanEntry} entry The entry that triggered the scan
     * @param {number} scanState The state of the scan
     * @returns {string} A slice of buffer until the given depth (inclusive)
     */
    get(entry, scanState) {
        let depth = entry.scanDepth ?? this.getDepth();
        if (depth <= this.#startDepth) {
            return '';
        }

        if (depth < 0) {
            console.error(`[WI] Invalid WI scan depth ${depth}. Must be >= 0`);
            return '';
        }

        if (depth > MAX_SCAN_DEPTH) {
            console.warn(`[WI] Invalid WI scan depth ${depth}. Truncating to ${MAX_SCAN_DEPTH}`);
            depth = MAX_SCAN_DEPTH;
        }

        const MATCHER = '\x01';
        const JOINER = '\n' + MATCHER;
        let result = MATCHER + this.#depthBuffer.slice(this.#startDepth, depth).join(JOINER);

        if (this.#injectBuffer.length > 0) {
            result += JOINER + this.#injectBuffer.join(JOINER);
        }

        // Min activations should not include the recursion buffer
        if (this.#recurseBuffer.length > 0 && scanState !== scan_state.MIN_ACTIVATIONS) {
            result += JOINER + this.#recurseBuffer.join(JOINER);
        }

        return result;
    }

    /**
     * Matches the given string against the buffer.
     * @param {string} haystack The string to search in
     * @param {string} needle The string to search for
     * @param {WIScanEntry} entry The entry that triggered the scan
     * @returns {boolean} True if the string was found in the buffer
     */
    matchKeys(haystack, needle, entry) {
        // If the needle is a regex, we do regex pattern matching and override all the other options
        const keyRegex = parseRegexFromString(needle);
        if (keyRegex) {
            return keyRegex.test(haystack);
        }

        // Otherwise we do normal matching of plaintext with the chosen entry settings
        haystack = this.#transformString(haystack, entry);
        const transformedString = this.#transformString(needle, entry);
        const matchWholeWords = entry.matchWholeWords ?? world_info_match_whole_words;

        if (matchWholeWords) {
            const keyWords = transformedString.split(/\s+/);

            if (keyWords.length > 1) {
                return haystack.includes(transformedString);
            }
            else {
                // Use custom boundaries to include punctuation and other non-alphanumeric characters
                const regex = new RegExp(`(?:^|\\W)(${escapeRegex(transformedString)})(?:$|\\W)`);
                if (regex.test(haystack)) {
                    return true;
                }
            }
        } else {
            return haystack.includes(transformedString);
        }

        return false;
    }

    /**
     * Adds a message to the recursion buffer.
     * @param {string} message The message to add
     */
    addRecurse(message) {
        this.#recurseBuffer.push(message);
    }

    /**
     * Adds an injection to the buffer.
     * @param {string} message The injection to add
     */
    addInject(message) {
        this.#injectBuffer.push(message);
    }

    /**
     * Checks if the recursion buffer is not empty.
     * @returns {boolean} Returns true if the recursion buffer is not empty, otherwise false
     */
    hasRecurse() {
        return this.#recurseBuffer.length > 0;
    }

    /**
     * Increments skew to advance the scan range.
     */
    advanceScan() {
        this.#skew++;
    }

    /**
     * @returns {number} Settings' depth + current skew.
     */
    getDepth() {
        return world_info_depth + this.#skew;
    }

    /**
     * Check if the current entry is externally activated.
     * @param {object} entry WI entry to check
     * @returns {boolean} True if the entry is forcefully activated
     */
    isExternallyActivated(entry) {
        // Entries could be copied with structuredClone, so we need to compare them by string representation
        return WorldInfoBuffer.externalActivations.some(x => JSON.stringify(x) === JSON.stringify(entry));
    }

    /**
     * Clean-up the external effects for entries.
     */
    resetExternalEffects() {
        WorldInfoBuffer.externalActivations.splice(0, WorldInfoBuffer.externalActivations.length);
    }

    /**
     * Gets the match score for the given entry.
     * @param {WIScanEntry} entry Entry to check
     * @param {number} scanState The state of the scan
     * @returns {number} The number of key activations for the given entry
     */
    getScore(entry, scanState) {
        const bufferState = this.get(entry, scanState);
        let numberOfPrimaryKeys = 0;
        let numberOfSecondaryKeys = 0;
        let primaryScore = 0;
        let secondaryScore = 0;

        // Increment score for every key found in the buffer
        if (Array.isArray(entry.key)) {
            numberOfPrimaryKeys = entry.key.length;
            for (const key of entry.key) {
                if (this.matchKeys(bufferState, key, entry)) {
                    primaryScore++;
                }
            }
        }

        // Increment score for every secondary key found in the buffer
        if (Array.isArray(entry.keysecondary)) {
            numberOfSecondaryKeys = entry.keysecondary.length;
            for (const key of entry.keysecondary) {
                if (this.matchKeys(bufferState, key, entry)) {
                    secondaryScore++;
                }
            }
        }

        // No keys == no score
        if (!numberOfPrimaryKeys) {
            return 0;
        }

        // Only positive logic influences the score
        if (numberOfSecondaryKeys > 0) {
            switch (entry.selectiveLogic) {
                // AND_ANY: Add both scores
                case world_info_logic.AND_ANY:
                    return primaryScore + secondaryScore;
                // AND_ALL: Add both scores if all secondary keys are found, otherwise only primary score
                case world_info_logic.AND_ALL:
                    return secondaryScore === numberOfSecondaryKeys ? primaryScore + secondaryScore : primaryScore;
            }
        }

        return primaryScore;
    }
}

/**
 * Represents a timed effects manager for World Info.
 */
class WorldInfoTimedEffects {
    /**
     * Array of chat messages.
     * @type {string[]}
     */
    #chat = [];

    /**
     * Array of entries.
     * @type {WIScanEntry[]}
     */
    #entries = [];

    /**
     * Buffer for active timed effects.
     * @type {Record<TimedEffectType, WIScanEntry[]>}
     */
    #buffer = {
        'sticky': [],
        'cooldown': [],
        'delay': [],
    };

    /**
     * Callbacks for effect types ending.
     * @type {Record<TimedEffectType, (entry: WIScanEntry) => void>}
     */
    #onEnded = {
        /**
         * Callback for when a sticky entry ends.
         * Sets an entry on cooldown immediately if it has a cooldown.
         * @param {WIScanEntry} entry Entry that ended sticky
         */
        'sticky': (entry) => {
            if (!entry.cooldown) {
                return;
            }

            const key = this.#getEntryKey(entry);
            const effect = this.#getEntryTimedEffect('cooldown', entry, true);
            chat_metadata.timedWorldInfo.cooldown[key] = effect;
            console.log(`[WI] Adding cooldown entry ${key} on ended sticky: start=${effect.start}, end=${effect.end}, protected=${effect.protected}`);
            // Set the cooldown immediately for this evaluation
            this.#buffer.cooldown.push(entry);
        },

        /**
         * Callback for when a cooldown entry ends.
         * No-op, essentially.
         * @param {WIScanEntry} entry Entry that ended cooldown
         */
        'cooldown': (entry) => {
            console.debug('[WI] Cooldown ended for entry', entry.uid);
        },

        'delay': () => { },
    };

    /**
     * Initialize the timed effects with the given messages.
     * @param {string[]} chat Array of chat messages
     * @param {WIScanEntry[]} entries Array of entries
     */
    constructor(chat, entries) {
        this.#chat = chat;
        this.#entries = entries;
        this.#ensureChatMetadata();
    }

    /**
     * Verify correct structure of chat metadata.
     */
    #ensureChatMetadata() {
        if (!chat_metadata.timedWorldInfo) {
            chat_metadata.timedWorldInfo = {};
        }

        ['sticky', 'cooldown'].forEach(type => {
            // Ensure the property exists and is an object
            if (!chat_metadata.timedWorldInfo[type] || typeof chat_metadata.timedWorldInfo[type] !== 'object') {
                chat_metadata.timedWorldInfo[type] = {};
            }

            // Clean up invalid entries
            Object.entries(chat_metadata.timedWorldInfo[type]).forEach(([key, value]) => {
                if (!value || typeof value !== 'object') {
                    delete chat_metadata.timedWorldInfo[type][key];
                }
            });
        });
    }

    /**
    * Gets a hash for a WI entry.
    * @param {WIScanEntry} entry WI entry
    * @returns {number} String hash
    */
    #getEntryHash(entry) {
        return entry.hash;
    }

    /**
     * Gets a unique-ish key for a WI entry.
     * @param {WIScanEntry} entry WI entry
     * @returns {string} String key for the entry
     */
    #getEntryKey(entry) {
        return `${entry.world}.${entry.uid}`;
    }

    /**
     * Gets a timed effect for a WI entry.
     * @param {TimedEffectType} type Type of timed effect
     * @param {WIScanEntry} entry WI entry
     * @param {boolean} isProtected If the effect should be protected
     * @returns {WITimedEffect} Timed effect for the entry
     */
    #getEntryTimedEffect(type, entry, isProtected) {
        return {
            hash: this.#getEntryHash(entry),
            start: this.#chat.length,
            end: this.#chat.length + Number(entry[type]),
            protected: !!isProtected,
        };
    }

    /**
     * Processes entries for a given type of timed effect.
     * @param {TimedEffectType} type Identifier for the type of timed effect
     * @param {WIScanEntry[]} buffer Buffer to store the entries
     * @param {(entry: WIScanEntry) => void} onEnded Callback for when a timed effect ends
     */
    #checkTimedEffectOfType(type, buffer, onEnded) {
        /** @type {[string, WITimedEffect][]} */
        const effects = Object.entries(chat_metadata.timedWorldInfo[type]);
        for (const [key, value] of effects) {
            console.log(`[WI] Processing ${type} entry ${key}`, value);
            const entry = this.#entries.find(x => String(this.#getEntryHash(x)) === String(value.hash));

            if (this.#chat.length <= Number(value.start) && !value.protected) {
                console.log(`[WI] Removing ${type} entry ${key} from timedWorldInfo: chat not advanced`, value);
                delete chat_metadata.timedWorldInfo[type][key];
                continue;
            }

            // Missing entries (they could be from another character's lorebook)
            if (!entry) {
                if (this.#chat.length >= Number(value.end)) {
                    console.log(`[WI] Removing ${type} entry from timedWorldInfo: entry not found and interval passed`, entry);
                    delete chat_metadata.timedWorldInfo[type][key];
                }
                continue;
            }

            // Ignore invalid entries (not configured for timed effects)
            if (!entry[type]) {
                console.log(`[WI] Removing ${type} entry from timedWorldInfo: entry not ${type}`, entry);
                delete chat_metadata.timedWorldInfo[type][key];
                continue;
            }

            if (this.#chat.length >= Number(value.end)) {
                console.log(`[WI] Removing ${type} entry from timedWorldInfo: ${type} interval passed`, entry);
                delete chat_metadata.timedWorldInfo[type][key];
                if (typeof onEnded === 'function') {
                    onEnded(entry);
                }
                continue;
            }

            buffer.push(entry);
            console.log(`[WI] Timed effect "${type}" applied to entry`, entry);
        }
    }

    /**
     * Processes entries for the "delay" timed effect.
     * @param {WIScanEntry[]} buffer Buffer to store the entries
     */
    #checkDelayEffect(buffer) {
        for (const entry of this.#entries) {
            if (!entry.delay) {
                continue;
            }

            if (this.#chat.length < entry.delay) {
                buffer.push(entry);
                console.log('[WI] Timed effect "delay" applied to entry', entry);
            }
        }

    }

    /**
     * Checks for timed effects on chat messages.
     */
    checkTimedEffects() {
        this.#checkTimedEffectOfType('sticky', this.#buffer.sticky, this.#onEnded.sticky.bind(this));
        this.#checkTimedEffectOfType('cooldown', this.#buffer.cooldown, this.#onEnded.cooldown.bind(this));
        this.#checkDelayEffect(this.#buffer.delay);
    }

    /**
     * Gets raw timed effect metadatum for a WI entry.
     * @param {TimedEffectType} type Type of timed effect
     * @param {WIScanEntry} entry WI entry
     * @returns {WITimedEffect} Timed effect for the entry
     */
    getEffectMetadata(type, entry) {
        if (!this.isValidEffectType(type)) {
            return null;
        }

        const key = this.#getEntryKey(entry);
        return chat_metadata.timedWorldInfo[type][key];
    }

    /**
     * Sets a timed effect for a WI entry.
     * @param {TimedEffectType} type Type of timed effect
     * @param {WIScanEntry} entry WI entry to check
     */
    #setTimedEffectOfType(type, entry) {
        // Skip if entry does not have the type (sticky or cooldown)
        if (!entry[type]) {
            return;
        }

        const key = this.#getEntryKey(entry);

        if (!chat_metadata.timedWorldInfo[type][key]) {
            const effect = this.#getEntryTimedEffect(type, entry, false);
            chat_metadata.timedWorldInfo[type][key] = effect;

            console.log(`[WI] Adding ${type} entry ${key}: start=${effect.start}, end=${effect.end}, protected=${effect.protected}`);
        }
    }

    /**
     * Sets timed effects on chat messages.
     * @param {WIScanEntry[]} activatedEntries Entries that were activated
     */
    setTimedEffects(activatedEntries) {
        for (const entry of activatedEntries) {
            this.#setTimedEffectOfType('sticky', entry);
            this.#setTimedEffectOfType('cooldown', entry);
        }
    }

    /**
     * Force set a timed effect for a WI entry.
     * @param {TimedEffectType} type Type of timed effect
     * @param {WIScanEntry} entry WI entry
     * @param {boolean} newState The state of the effect
     */
    setTimedEffect(type, entry, newState) {
        if (!this.isValidEffectType(type)) {
            return;
        }

        const key = this.#getEntryKey(entry);
        delete chat_metadata.timedWorldInfo[type][key];

        if (newState) {
            const effect = this.#getEntryTimedEffect(type, entry, false);
            chat_metadata.timedWorldInfo[type][key] = effect;
            console.log(`[WI] Adding ${type} entry ${key}: start=${effect.start}, end=${effect.end}, protected=${effect.protected}`);
        }
    }

    /**
     * Check if the string is a valid timed effect type.
     * @param {string} type Name of the timed effect
     * @returns {boolean} Is recognized type
     */
    isValidEffectType(type) {
        return typeof type === 'string' && ['sticky', 'cooldown', 'delay'].includes(type.trim().toLowerCase());
    }

    /**
     * Check if the current entry is sticky activated.
     * @param {TimedEffectType} type Type of timed effect
     * @param {WIScanEntry} entry WI entry to check
     * @returns {boolean} True if the entry is active
     */
    isEffectActive(type, entry) {
        if (!this.isValidEffectType(type)) {
            return false;
        }

        return this.#buffer[type]?.some(x => this.#getEntryHash(x) === this.#getEntryHash(entry)) ?? false;
    }

    /**
     * Clean-up previously set timed effects.
     */
    cleanUp() {
        for (const buffer of Object.values(this.#buffer)) {
            buffer.splice(0, buffer.length);
        }
    }
}

export function getWorldInfoSettings() {
    return {
        world_info,
        world_info_depth,
        world_info_min_activations,
        world_info_min_activations_depth_max,
        world_info_budget,
        world_info_include_names,
        world_info_recursive,
        world_info_overflow_alert,
        world_info_case_sensitive,
        world_info_match_whole_words,
        world_info_character_strategy,
        world_info_budget_cap,
        world_info_use_group_scoring,
        world_info_max_recursion_steps,
    };
}

export const world_info_position = {
    before: 0,
    after: 1,
    ANTop: 2,
    ANBottom: 3,
    atDepth: 4,
    EMTop: 5,
    EMBottom: 6,
};

export const wi_anchor_position = {
    before: 0,
    after: 1,
};

/**
 * The cache of all world info data that was loaded from the backend.
 *
 * Calling `loadWorldInfo` will fill this cache and utilize this cache, so should be the preferred way to load any world info data.
 * Only use the cache directly if you need synchronous access.
 *
 * This will return a deep clone of the data, so no way to modify the data without actually saving it.
 * Should generally be only used for readonly access.
 *
 * @type {StructuredCloneMap<string,object>}
 * */
export const worldInfoCache = new StructuredCloneMap({ cloneOnGet: true, cloneOnSet: false });

/**
 * Gets the world info based on chat messages.
 * @param {string[]} chat The chat messages to scan, in reverse order.
 * @param {number} maxContext The maximum context size of the generation.
 * @param {boolean} isDryRun If true, the function will not emit any events.
 * @typedef {{worldInfoString: string, worldInfoBefore: string, worldInfoAfter: string, worldInfoExamples: any[], worldInfoDepth: any[]}} WIPromptResult
 * @returns {Promise<WIPromptResult>} The world info string and depth.
 */
export async function getWorldInfoPrompt(chat, maxContext, isDryRun) {
    let worldInfoString = '', worldInfoBefore = '', worldInfoAfter = '';

    const activatedWorldInfo = await checkWorldInfo(chat, maxContext, isDryRun);
    worldInfoBefore = activatedWorldInfo.worldInfoBefore;
    worldInfoAfter = activatedWorldInfo.worldInfoAfter;
    worldInfoString = worldInfoBefore + worldInfoAfter;

    if (!isDryRun && activatedWorldInfo.allActivatedEntries && activatedWorldInfo.allActivatedEntries.size > 0) {
        const arg = Array.from(activatedWorldInfo.allActivatedEntries);
        await eventSource.emit(event_types.WORLD_INFO_ACTIVATED, arg);
    }

    return {
        worldInfoString,
        worldInfoBefore,
        worldInfoAfter,
        worldInfoExamples: activatedWorldInfo.EMEntries ?? [],
        worldInfoDepth: activatedWorldInfo.WIDepthEntries ?? [],
    };
}

export function setWorldInfoSettings(settings, data) {
    if (settings.world_info_depth !== undefined)
        world_info_depth = Number(settings.world_info_depth);
    if (settings.world_info_min_activations !== undefined)
        world_info_min_activations = Number(settings.world_info_min_activations);
    if (settings.world_info_min_activations_depth_max !== undefined)
        world_info_min_activations_depth_max = Number(settings.world_info_min_activations_depth_max);
    if (settings.world_info_budget !== undefined)
        world_info_budget = Number(settings.world_info_budget);
    if (settings.world_info_include_names !== undefined)
        world_info_include_names = Boolean(settings.world_info_include_names);
    if (settings.world_info_recursive !== undefined)
        world_info_recursive = Boolean(settings.world_info_recursive);
    if (settings.world_info_overflow_alert !== undefined)
        world_info_overflow_alert = Boolean(settings.world_info_overflow_alert);
    if (settings.world_info_case_sensitive !== undefined)
        world_info_case_sensitive = Boolean(settings.world_info_case_sensitive);
    if (settings.world_info_match_whole_words !== undefined)
        world_info_match_whole_words = Boolean(settings.world_info_match_whole_words);
    if (settings.world_info_character_strategy !== undefined)
        world_info_character_strategy = Number(settings.world_info_character_strategy);
    if (settings.world_info_budget_cap !== undefined)
        world_info_budget_cap = Number(settings.world_info_budget_cap);
    if (settings.world_info_use_group_scoring !== undefined)
        world_info_use_group_scoring = Boolean(settings.world_info_use_group_scoring);
    if (settings.world_info_max_recursion_steps !== undefined)
        world_info_max_recursion_steps = Number(settings.world_info_max_recursion_steps);

    // Migrate old settings
    if (world_info_budget > 100) {
        world_info_budget = 25;
    }

    if (world_info_use_group_scoring === undefined) {
        world_info_use_group_scoring = false;
    }

    // Reset selected world from old string and delete old keys
    // TODO: Remove next release
    const existingWorldInfo = settings.world_info;
    if (typeof existingWorldInfo === 'string') {
        delete settings.world_info;
        selected_world_info = [existingWorldInfo];
    } else if (Array.isArray(existingWorldInfo)) {
        delete settings.world_info;
        selected_world_info = existingWorldInfo;
    }

    world_info = settings.world_info ?? {};

    $('#world_info_depth_counter').val(world_info_depth);
    $('#world_info_depth').val(world_info_depth);

    $('#world_info_min_activations_counter').val(world_info_min_activations);
    $('#world_info_min_activations').val(world_info_min_activations);

    $('#world_info_min_activations_depth_max_counter').val(world_info_min_activations_depth_max);
    $('#world_info_min_activations_depth_max').val(world_info_min_activations_depth_max);

    $('#world_info_budget_counter').val(world_info_budget);
    $('#world_info_budget').val(world_info_budget);

    $('#world_info_include_names').prop('checked', world_info_include_names);
    $('#world_info_recursive').prop('checked', world_info_recursive);
    $('#world_info_overflow_alert').prop('checked', world_info_overflow_alert);
    $('#world_info_case_sensitive').prop('checked', world_info_case_sensitive);
    $('#world_info_match_whole_words').prop('checked', world_info_match_whole_words);
    $('#world_info_use_group_scoring').prop('checked', world_info_use_group_scoring);

    $(`#world_info_character_strategy option[value='${world_info_character_strategy}']`).prop('selected', true);
    $('#world_info_character_strategy').val(world_info_character_strategy);

    $('#world_info_budget_cap').val(world_info_budget_cap);
    $('#world_info_budget_cap_counter').val(world_info_budget_cap);

    $('#world_info_max_recursion_steps').val(world_info_max_recursion_steps);
    $('#world_info_max_recursion_steps_counter').val(world_info_max_recursion_steps);

    world_names = data.world_names?.length ? data.world_names : [];

    // Add to existing selected WI if it exists
    selected_world_info = selected_world_info.concat(settings.world_info?.globalSelect?.filter((e) => world_names.includes(e)) ?? []);

    if (world_names.length > 0) {
        $('#world_info').empty();
    }

    world_names.forEach((item, i) => {
        $('#world_info').append(`<option value='${i}'${selected_world_info.includes(item) ? ' selected' : ''}>${item}</option>`);
        $('#world_editor_select').append(`<option value='${i}'>${item}</option>`);
    });

    $('#world_info_sort_order').val(localStorage.getItem(SORT_ORDER_KEY) || '0');
    $('#world_info').trigger('change');
    $('#world_editor_select').trigger('change');

    eventSource.on(event_types.CHAT_CHANGED, async () => {
        const hasWorldInfo = !!chat_metadata[METADATA_KEY] && world_names.includes(chat_metadata[METADATA_KEY]);
        $('.chat_lorebook_button').toggleClass('world_set', hasWorldInfo);
        // Pre-cache the world info data for the chat for quicker first prompt generation
        await getSortedEntries();
    });

    eventSource.on(event_types.WORLDINFO_FORCE_ACTIVATE, (entries) => {
        WorldInfoBuffer.externalActivations.push(...entries);
    });

    // Add slash commands
    registerWorldInfoSlashCommands();
}

function registerWorldInfoSlashCommands() {
    /**
     * Reloads the editor with the specified world info file
     * @param {string} file - The file to load in the editor
     * @param {boolean} [loadIfNotSelected=false] - Indicates whether to load the file even if it's not currently selected
     */
    function reloadEditor(file, loadIfNotSelected = false) {
        const currentIndex = Number($('#world_editor_select').val());
        const selectedIndex = world_names.indexOf(file);
        if (selectedIndex !== -1 && (loadIfNotSelected || currentIndex === selectedIndex)) {
            $('#world_editor_select').val(selectedIndex).trigger('change');
        }
    }

    /**
     * Gets a *rough* approximation of the current chat context.
     * Normally, it is provided externally by the prompt builder.
     * Don't use for anything critical!
     * @returns {string[]}
     */
    function getScanningChat() {
        return getContext().chat.filter(x => !x.is_system).map(x => x.mes);
    }

    async function getEntriesFromFile(file) {
        if (!file || !world_names.includes(file)) {
            toastr.warning('Valid World Info file name is required');
            return '';
        }

        const data = await loadWorldInfo(file);

        if (!data || !('entries' in data)) {
            toastr.warning('World Info file has an invalid format');
            return '';
        }

        const entries = Object.values(data.entries);

        if (!entries || entries.length === 0) {
            toastr.warning('World Info file has no entries');
            return '';
        }

        return entries;
    }

    async function getChatBookCallback() {
        const chatId = getCurrentChatId();

        if (!chatId) {
            toastr.warning('Open a chat to get a name of the chat-bound lorebook');
            return '';
        }

        if (chat_metadata[METADATA_KEY] && world_names.includes(chat_metadata[METADATA_KEY])) {
            return chat_metadata[METADATA_KEY];
        }

        // Replace non-alphanumeric characters with underscores, cut to 64 characters
        const name = `Chat Book ${getCurrentChatId()}`.replace(/[^a-z0-9]/gi, '_').replace(/_{2,}/g, '_').substring(0, 64);
        await createNewWorldInfo(name);

        chat_metadata[METADATA_KEY] = name;
        await saveMetadata();
        $('.chat_lorebook_button').addClass('world_set');
        return name;
    }

    async function findBookEntryCallback(args, value) {
        const file = args.file;
        const field = args.field || 'key';

        const entries = await getEntriesFromFile(file);

        if (!entries) {
            return '';
        }

        if (typeof newWorldInfoEntryTemplate[field] === 'boolean') {
            const isTrue = isTrueBoolean(value);
            const isFalse = isFalseBoolean(value);

            if (isTrue) {
                value = String(true);
            }

            if (isFalse) {
                value = String(false);
            }
        }

        const fuse = new Fuse(entries, {
            keys: [{ name: field, weight: 1 }],
            includeScore: true,
            threshold: 0.3,
        });

        const results = fuse.search(value);

        if (!results || results.length === 0) {
            return '';
        }

        const result = results[0]?.item?.uid;

        if (result === undefined) {
            return '';
        }

        return result;
    }

    async function getEntryFieldCallback(args, uid) {
        const file = args.file;
        const field = args.field || 'content';

        const entries = await getEntriesFromFile(file);

        if (!entries) {
            return '';
        }

        const entry = entries.find(x => String(x.uid) === String(uid));

        if (!entry) {
            toastr.warning('Valid UID is required');
            return '';
        }

        if (newWorldInfoEntryTemplate[field] === undefined) {
            toastr.warning('Valid field name is required');
            return '';
        }

        const fieldValue = entry[field];

        if (fieldValue === undefined) {
            return '';
        }

        if (Array.isArray(fieldValue)) {
            return JSON.stringify(fieldValue.map(x => substituteParams(x)));
        }

        return substituteParams(String(fieldValue));
    }

    async function createEntryCallback(args, content) {
        const file = args.file;
        const key = args.key;

        const data = await loadWorldInfo(file);

        if (!data || !('entries' in data)) {
            toastr.warning('Valid World Info file name is required');
            return '';
        }

        const entry = createWorldInfoEntry(file, data);

        if (key) {
            entry.key.push(key);
            entry.addMemo = true;
            entry.comment = key;
        }

        if (content) {
            entry.content = content;
        }

        await saveWorldInfo(file, data);
        reloadEditor(file);

        return String(entry.uid);
    }

    async function setEntryFieldCallback(args, value) {
        const file = args.file;
        const uid = args.uid;
        const field = args.field || 'content';

        if (value === undefined) {
            toastr.warning('Value is required');
            return '';
        }

        value = value.replace(/\\([{}|])/g, '$1');

        const data = await loadWorldInfo(file);

        if (!data || !('entries' in data)) {
            toastr.warning('Valid World Info file name is required');
            return '';
        }

        const entry = data.entries[uid];

        if (!entry) {
            toastr.warning('Valid UID is required');
            return '';
        }

        if (newWorldInfoEntryTemplate[field] === undefined) {
            toastr.warning('Valid field name is required');
            return '';
        }

        if (Array.isArray(entry[field])) {
            entry[field] = parseStringArray(value);
        } else if (typeof entry[field] === 'boolean') {
            entry[field] = isTrueBoolean(value);
        } else if (typeof entry[field] === 'number') {
            entry[field] = Number(value);
        } else {
            entry[field] = value;
        }

        if (originalWIDataKeyMap[field]) {
            setWIOriginalDataValue(data, uid, originalWIDataKeyMap[field], entry[field]);
        }

        await saveWorldInfo(file, data);
        reloadEditor(file);
        return '';
    }

    async function getTimedEffectCallback(args, value) {
        if (!getCurrentChatId()) {
            throw new Error('This command can only be used in chat');
        }

        const file = args.file;
        const uid = value;
        const effect = args.effect;

        const entries = await getEntriesFromFile(file);

        if (!entries) {
            return '';
        }

        /** @type {WIScanEntry} */
        const entry = structuredClone(entries.find(x => String(x.uid) === String(uid)));

        if (!entry) {
            toastr.warning('Valid UID is required');
            return '';
        }

        entry.world = file; // Required by the timed effects manager
        const chat = getScanningChat();
        const timedEffects = new WorldInfoTimedEffects(chat, [entry]);

        if (!timedEffects.isValidEffectType(effect)) {
            toastr.warning('Valid effect type is required');
            return '';
        }

        const data = timedEffects.getEffectMetadata(effect, entry);

        if (String(args.format).trim().toLowerCase() === ARGUMENT_TYPE.NUMBER) {
            return String(data ? (data.end - chat.length) : 0);
        }

        return String(!!data);
    }

    async function setTimedEffectCallback(args, value) {
        if (!getCurrentChatId()) {
            throw new Error('This command can only be used in chat');
        }

        const file = args.file;
        const uid = args.uid;
        const effect = args.effect;

        if (value === undefined) {
            toastr.warning('New state is required');
            return '';
        }

        const entries = await getEntriesFromFile(file);

        if (!entries) {
            return '';
        }

        /** @type {WIScanEntry} */
        const entry = structuredClone(entries.find(x => String(x.uid) === String(uid)));

        if (!entry) {
            toastr.warning('Valid UID is required');
            return '';
        }

        entry.world = file; // Required by the timed effects manager
        const chat = getScanningChat();
        const timedEffects = new WorldInfoTimedEffects(chat, [entry]);

        if (!timedEffects.isValidEffectType(effect)) {
            toastr.warning('Valid effect type is required');
            return '';
        }

        if (!entry[effect]) {
            toastr.warning('This entry does not have the selected effect. Configure it in the editor first.');
            return '';
        }

        const getNewEffectState = () => {
            const currentState = !!timedEffects.getEffectMetadata(effect, entry);

            if (['toggle', 't', ''].includes(value.trim().toLowerCase())) {
                return !currentState;
            }

            if (isTrueBoolean(value)) {
                return true;
            }

            if (isFalseBoolean(value)) {
                return false;
            }

            return currentState;
        };

        const newEffectState = getNewEffectState();
        timedEffects.setTimedEffect(effect, entry, newEffectState);

        await saveMetadata();
        toastr.success(`Timed effect "${effect}" for entry ${entry.uid} is now ${newEffectState ? 'active' : 'inactive'}`);

        return '';
    }

    /** A collection of local enum providers for this context of world info */
    const localEnumProviders = {
        /** All possible fields that can be set in a WI entry */
        wiEntryFields: () => Object.entries(newWorldInfoEntryDefinition).map(([key, value]) =>
            new SlashCommandEnumValue(key, `[${value.type}] default: ${(typeof value.default === 'string' ? `'${value.default}'` : value.default)}`,
                enumTypes.enum, enumIcons.getDataTypeIcon(value.type))),

        /** All existing UIDs based on the file argument as world name */
        wiUids: (/** @type {import('./slash-commands/SlashCommandExecutor.js').SlashCommandExecutor} */ executor) => {
            const file = executor.namedArgumentList.find(it => it.name == 'file')?.value;
            if (file instanceof SlashCommandClosure) throw new Error('Argument \'file\' does not support closures');
            // Try find world from cache
            if (!worldInfoCache.has(file)) return [];
            const world = worldInfoCache.get(file);
            if (!world) return [];
            return Object.entries(world.entries).map(([uid, data]) =>
                new SlashCommandEnumValue(uid, `${data.comment ? `${data.comment}: ` : ''}${data.key.join(', ')}${data.keysecondary?.length ? ` [${Object.entries(world_info_logic).find(([_, value]) => value == data.selectiveLogic)[0]}] ${data.keysecondary.join(', ')}` : ''} [${getWiPositionString(data)}]`,
                    enumTypes.enum, enumIcons.getWiStatusIcon(data)));
        },

        timedEffects: () => [
            new SlashCommandEnumValue('sticky', 'Stays active for N messages', enumTypes.enum, '📌'),
            new SlashCommandEnumValue('cooldown', 'Cooldown for N messages', enumTypes.enum, '⌛'),
        ],
    };

    function getWiPositionString(entry) {
        switch (entry.position) {
            case world_info_position.before: return '↑Char';
            case world_info_position.after: return '↓Char';
            case world_info_position.EMTop: return '↑EM';
            case world_info_position.EMBottom: return '↓EM';
            case world_info_position.ANTop: return '↑AT';
            case world_info_position.ANBottom: return '↓AT';
            case world_info_position.atDepth: return `@D${enumIcons.getRoleIcon(entry.role)}`;
            default: return '<Unknown>';
        }
    }

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'world',
        callback: onWorldInfoChange,
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'state', 'set world state', [ARGUMENT_TYPE.STRING], false, false, null, commonEnumProviders.boolean('onOffToggle')(),
            ),
            new SlashCommandNamedArgument(
                'silent', 'suppress toast messages', [ARGUMENT_TYPE.BOOLEAN], false,
            ),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'world name',
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: commonEnumProviders.worlds,
            }),
        ],
        helpString: `
            <div>
                Sets active World, or unsets if no args provided, use <code>state=off</code> and <code>state=toggle</code> to deactivate or toggle a World, use <code>silent=true</code> to suppress toast messages.
            </div>
        `,
        aliases: [],
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'getchatbook',
        callback: getChatBookCallback,
        returns: 'lorebook name',
        helpString: 'Get a name of the chat-bound lorebook or create a new one if was unbound, and pass it down the pipe.',
        aliases: ['getchatlore', 'getchatwi'],
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'findentry',
        aliases: ['findlore', 'findwi'],
        returns: 'UID',
        callback: findBookEntryCallback,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'file',
                description: 'book name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: commonEnumProviders.worlds,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'field',
                description: 'field value for fuzzy match (default: key)',
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: 'key',
                enumList: localEnumProviders.wiEntryFields(),
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'texts', ARGUMENT_TYPE.STRING, true, true,
            ),
        ],
        helpString: `
            <div>
                Find a UID of the record from the specified book using the fuzzy match of a field value (default: key) and pass it down the pipe.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code>/findentry file=chatLore field=key Shadowfang</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'getentryfield',
        aliases: ['getlorefield', 'getwifield'],
        callback: getEntryFieldCallback,
        returns: 'field value',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'file',
                description: 'book name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: commonEnumProviders.worlds,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'field',
                description: 'field to retrieve (default: content)',
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: 'content',
                enumList: localEnumProviders.wiEntryFields(),
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'record UID',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: localEnumProviders.wiUids,
            }),
        ],
        helpString: `
            <div>
                Get a field value (default: content) of the record with the UID from the specified book and pass it down the pipe.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code>/getentryfield file=chatLore field=content 123</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'createentry',
        callback: createEntryCallback,
        aliases: ['createlore', 'createwi'],
        returns: 'UID of the new record',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'file',
                description: 'book name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: commonEnumProviders.worlds,
            }),
            new SlashCommandNamedArgument(
                'key', 'record key', [ARGUMENT_TYPE.STRING], false,
            ),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'content', [ARGUMENT_TYPE.STRING], false,
            ),
        ],
        helpString: `
            <div>
                Create a new record in the specified book with the key and content (both are optional) and pass the UID down the pipe.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code>/createentry file=chatLore key=Shadowfang The sword of the king</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'setentryfield',
        callback: setEntryFieldCallback,
        aliases: ['setlorefield', 'setwifield'],
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'file',
                description: 'book name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: commonEnumProviders.worlds,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'uid',
                description: 'record UID',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: localEnumProviders.wiUids,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'field',
                description: 'field name (default: content)',
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: 'content',
                enumList: localEnumProviders.wiEntryFields(),
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'value', [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: `
            <div>
                Set a field value (default: content) of the record with the UID from the specified book. To set multiple values for key fields, use comma-delimited list as a value.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code>/setentryfield file=chatLore uid=123 field=key Shadowfang,sword,weapon</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'wi-set-timed-effect',
        callback: setTimedEffectCallback,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'file',
                description: 'book name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: commonEnumProviders.worlds,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'uid',
                description: 'record UID',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: localEnumProviders.wiUids,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'effect',
                description: 'effect name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: localEnumProviders.timedEffects,
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'new state of the effect',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                acceptsMultiple: false,
                enumList: commonEnumProviders.boolean('onOffToggle')(),
            }),
        ],
        helpString: `
            <div>
                Set a timed effect for the record with the UID from the specified book. The duration must be set in the entry itself.
                Will only be applied for the current chat. Enabling an effect that was already active refreshes the duration.
                If the last chat message is swiped or deleted, the effect will be removed.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code>/wi-set-timed-effect file=chatLore uid=123 effect=sticky on</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'wi-get-timed-effect',
        callback: getTimedEffectCallback,
        helpString: `
            <div>
                Get the current state of the timed effect for the record with the UID from the specified book.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <code>/wi-get-timed-effect file=chatLore format=bool effect=sticky 123</code> - returns true or false if the effect is active or not
                    </li>
                    <li>
                        <code>/wi-get-timed-effect file=chatLore format=number effect=sticky 123</code> - returns the remaining duration of the effect, or 0 if inactive
                    </li>
                </ul>
            </div>
        `,
        returns: 'state of the effect',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'file',
                description: 'book name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: commonEnumProviders.worlds,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'effect',
                description: 'effect name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: localEnumProviders.timedEffects,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'format',
                description: 'output format',
                isRequired: false,
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: ARGUMENT_TYPE.BOOLEAN,
                enumList: [ARGUMENT_TYPE.BOOLEAN, ARGUMENT_TYPE.NUMBER],
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'record UID',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: localEnumProviders.wiUids,
            }),
        ],
    }));
}


/**
 * Loads the given world into the World Editor.
 *
 * @param {string} name - The name of the world
 * @return {Promise<void>} A promise that resolves when the world editor is loaded
 */
export async function showWorldEditor(name) {
    if (!name) {
        hideWorldEditor();
        return;
    }

    const wiData = await loadWorldInfo(name);
    displayWorldEntries(name, wiData);
}

/**
 * Loads world info from the backend.
 *
 * This function will return from `worldInfoCache` if it has already been loaded before.
 *
 * @param {string} name - The name of the world to load
 * @return {Promise<Object|null>} A promise that resolves to the loaded world information, or null if the request fails.
 */
export async function loadWorldInfo(name) {
    if (!name) {
        return;
    }

    if (worldInfoCache.has(name)) {
        return worldInfoCache.get(name);
    }

    const response = await fetch('/api/worldinfo/get', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ name: name }),
        cache: 'no-cache',
    });

    if (response.ok) {
        const data = await response.json();
        worldInfoCache.set(name, data);
        return data;
    }

    return null;
}

async function updateWorldInfoList() {
    const result = await fetch('/api/settings/get', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({}),
    });

    if (result.ok) {
        var data = await result.json();
        world_names = data.world_names?.length ? data.world_names : [];
        $('#world_info').find('option[value!=""]').remove();
        $('#world_editor_select').find('option[value!=""]').remove();

        world_names.forEach((item, i) => {
            $('#world_info').append(`<option value='${i}'${selected_world_info.includes(item) ? ' selected' : ''}>${item}</option>`);
            $('#world_editor_select').append(`<option value='${i}'>${item}</option>`);
        });
    }
}

function hideWorldEditor() {
    displayWorldEntries(null, null);
}

function getWIElement(name) {
    const wiElement = $('#world_info').children().filter(function () {
        return $(this).text().toLowerCase() === name.toLowerCase();
    });

    return wiElement;
}

/**
 * Sorts the given data based on the selected sort option
 *
 * @param {any[]} data WI entries
 * @param {object} [options={}] - Optional arguments
 * @param {{sortField?: string, sortOrder?: string, sortRule?: string}} [options.customSort={}] - Custom sort options, instead of the chosen UI sort
 * @returns {any[]} Sorted data
 */
export function sortWorldInfoEntries(data, { customSort = null } = {}) {
    const option = $('#world_info_sort_order').find(':selected');
    const sortField = customSort?.sortField ?? option.data('field');
    const sortOrder = customSort?.sortOrder ?? option.data('order');
    const sortRule = customSort?.sortRule ?? option.data('rule');
    const orderSign = sortOrder === 'asc' ? 1 : -1;

    if (!data.length) return data;

    /** @type {(a: any, b: any) => number} */
    let primarySort;

    // Secondary and tertiary it will always be sorted by Order descending, and last UID ascending
    // This is the most sensible approach for sorts where the primary sort has a lot of equal values
    const secondarySort = (a, b) => b.order - a.order;
    const tertiarySort = (a, b) => a.uid - b.uid;

    // If we have a search term for WI, we are sorting by weighting scores
    if (sortRule === 'search') {
        primarySort = (a, b) => {
            const aScore = worldInfoFilter.getScore(FILTER_TYPES.WORLD_INFO_SEARCH, a.uid);
            const bScore = worldInfoFilter.getScore(FILTER_TYPES.WORLD_INFO_SEARCH, b.uid);
            return aScore - bScore;
        };
    }
    else if (sortRule === 'custom') {
        // First by display index
        primarySort = (a, b) => {
            const aValue = a.displayIndex;
            const bValue = b.displayIndex;
            return aValue - bValue;
        };
    } else if (sortRule === 'priority') {
        // First constant, then normal, then disabled.
        primarySort = (a, b) => {
            const aValue = a.constant ? 0 : a.disable ? 2 : 1;
            const bValue = b.constant ? 0 : b.disable ? 2 : 1;
            return aValue - bValue;
        };
    } else {
        primarySort = (a, b) => {
            const aValue = a[sortField];
            const bValue = b[sortField];

            // Sort strings
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                if (sortRule === 'length') {
                    // Sort by string length
                    return orderSign * (aValue.length - bValue.length);
                } else {
                    // Sort by A-Z ordinal
                    return orderSign * aValue.localeCompare(bValue);
                }
            }

            // Sort numbers
            return orderSign * (Number(aValue) - Number(bValue));
        };
    }

    data.sort((a, b) => {
        return primarySort(a, b) || secondarySort(a, b) || tertiarySort(a, b);
    });

    return data;
}

function nullWorldInfo() {
    toastr.info('Create or import a new World Info file first.', 'World Info is not set', { timeOut: 10000, preventDuplicates: true });
}

/** @type {Select2Option[]} Cache all keys as selectable dropdown option */
const worldEntryKeyOptionsCache = [];

/**
 * Update the cache and all select options for the keys with new values to display
 * @param {string[]|Select2Option[]} keyOptions - An array of options to update
 * @param {object} options - Optional arguments
 * @param {boolean?} [options.remove=false] - Whether the option was removed, so the count should be reduced - otherwise it'll be increased
 * @param {boolean?} [options.reset=false] - Whether the cache should be reset. Reset will also not trigger update of the controls, as we expect them to be redrawn anyway
 */
function updateWorldEntryKeyOptionsCache(keyOptions, { remove = false, reset = false } = {}) {
    if (!keyOptions.length) return;
    /** @type {Select2Option[]} */
    const options = keyOptions.map(x => typeof x === 'string' ? { id: getSelect2OptionId(x), text: x } : x);
    if (reset) worldEntryKeyOptionsCache.length = 0;
    options.forEach(option => {
        // Update the cache list
        let cachedEntry = worldEntryKeyOptionsCache.find(x => x.id == option.id);
        if (cachedEntry) {
            cachedEntry.count += !remove ? 1 : -1;
        } else if (!remove) {
            worldEntryKeyOptionsCache.push(option);
            cachedEntry = option;
            cachedEntry.count = 1;
        }
    });

    // Sort by count DESC and then alphabetically
    worldEntryKeyOptionsCache.sort((a, b) => b.count - a.count || a.text.localeCompare(b.text));
}

function displayWorldEntries(name, data, navigation = navigation_option.none, flashOnNav = true) {
    updateEditor = (navigation, flashOnNav = true) => displayWorldEntries(name, data, navigation, flashOnNav);

    const worldEntriesList = $('#world_popup_entries_list');

    // We save costly performance by removing all events before emptying. Because we know there are no relevant event handlers reacting on removing elements
    // This prevents jQuery from actually going through all registered events on the controls for each entry when removing it
    worldEntriesList.find('*').off();
    worldEntriesList.empty().show();

    if (!data || !('entries' in data)) {
        $('#world_popup_new').off('click').on('click', nullWorldInfo);
        $('#world_popup_name_button').off('click').on('click', nullWorldInfo);
        $('#world_popup_export').off('click').on('click', nullWorldInfo);
        $('#world_popup_delete').off('click').on('click', nullWorldInfo);
        $('#world_duplicate').off('click').on('click', nullWorldInfo);
        worldEntriesList.hide();
        $('#world_info_pagination').html('');
        return;
    }

    // Regardless of whether success is displayed or not. Make sure the delete button is available.
    // Do not put this code behind.
    $('#world_popup_delete').off('click').on('click', async () => {
        const confirmation = await Popup.show.confirm(`Delete the World/Lorebook: "${name}"?`, 'This action is irreversible!');
        if (!confirmation) {
            return;
        }

        if (world_info.charLore) {
            world_info.charLore.forEach((charLore, index) => {
                if (charLore.extraBooks?.includes(name)) {
                    const tempCharLore = charLore.extraBooks.filter((e) => e !== name);
                    if (tempCharLore.length === 0) {
                        world_info.charLore.splice(index, 1);
                    } else {
                        charLore.extraBooks = tempCharLore;
                    }
                }
            });

            saveSettingsDebounced();
        }

        // Selected world_info automatically refreshes
        await deleteWorldInfo(name);
    });

    // Before printing the WI, we check if we should enable/disable search sorting
    verifyWorldInfoSearchSortRule();

    function getDataArray(callback) {
        // Convert the data.entries object into an array
        let entriesArray = Object.keys(data.entries).map(uid => {
            const entry = data.entries[uid];
            entry.displayIndex = entry.displayIndex ?? entry.uid;
            return entry;
        });

        // Apply the filter and do the chosen sorting
        entriesArray = worldInfoFilter.applyFilters(entriesArray);
        entriesArray = sortWorldInfoEntries(entriesArray);

        // Cache keys
        const keys = entriesArray.flatMap(entry => [...entry.key, ...entry.keysecondary]);
        updateWorldEntryKeyOptionsCache(keys, { reset: true });

        // Run the callback for printing this
        typeof callback === 'function' && callback(entriesArray);
        return entriesArray;
    }

    const storageKey = 'WI_PerPage';
    const perPageDefault = 25;
    let startPage = 1;

    if (navigation === navigation_option.previous) {
        startPage = $('#world_info_pagination').pagination('getCurrentPageNum');
    }

    if (typeof navigation === 'number' && Number(navigation) >= 0) {
        const data = getDataArray();
        const uidIndex = data.findIndex(x => x.uid === navigation);
        const perPage = Number(localStorage.getItem(storageKey)) || perPageDefault;
        startPage = Math.floor(uidIndex / perPage) + 1;
    }

    $('#world_info_pagination').pagination({
        dataSource: getDataArray,
        pageSize: Number(localStorage.getItem(storageKey)) || perPageDefault,
        sizeChangerOptions: [10, 25, 50, 100, 500, 1000],
        showSizeChanger: true,
        pageRange: 1,
        pageNumber: startPage,
        position: 'top',
        showPageNumbers: false,
        prevText: '<',
        nextText: '>',
        formatNavigator: PAGINATION_TEMPLATE,
        showNavigator: true,
        callback: async function (/** @type {object[]} */ page) {
            // We save costly performance by removing all events before emptying. Because we know there are no relevant event handlers reacting on removing elements
            // This prevents jQuery from actually going through all registered events on the controls for each entry when removing it
            worldEntriesList.find('*').off();
            worldEntriesList.empty();

            const keywordHeaders = await renderTemplateAsync('worldInfoKeywordHeaders');
            const blocksPromises = page.map(async (entry) => await getWorldEntry(name, data, entry)).filter(x => x);
            const blocks = await Promise.all(blocksPromises);
            const isCustomOrder = $('#world_info_sort_order').find(':selected').data('rule') === 'custom';
            if (!isCustomOrder) {
                blocks.forEach(block => {
                    block.find('.drag-handle').remove();
                });
            }
            worldEntriesList.append(keywordHeaders);
            worldEntriesList.append(blocks);
        },
        afterSizeSelectorChange: function (e) {
            localStorage.setItem(storageKey, e.target.value);
        },
        afterPaging: function () {
            $('#world_popup_entries_list textarea[name="comment"]').each(function () {
                initScrollHeight($(this));
            });
        },
    });

    if (typeof navigation === 'number' && Number(navigation) >= 0) {
        const selector = `#world_popup_entries_list [uid="${navigation}"]`;
        waitUntilCondition(() => document.querySelector(selector) !== null).finally(() => {
            const element = $(selector);

            if (element.length === 0) {
                console.log(`Could not find element for uid ${navigation}`);
                return;
            }

            const elementOffset = element.offset();
            const parentOffset = element.parent().offset();
            const scrollOffset = elementOffset.top - parentOffset.top;
            $('#WorldInfo').scrollTop(scrollOffset);
            if (flashOnNav) flashHighlight(element);
        });
    }

    $('#world_popup_new').off('click').on('click', () => {
        const entry = createWorldInfoEntry(name, data);
        if (entry) updateEditor(entry.uid);
    });

    $('#world_popup_name_button').off('click').on('click', async () => {
        await renameWorldInfo(name, data);
    });

    $('#world_backfill_memos').off('click').on('click', async () => {
        let counter = 0;
        for (const entry of Object.values(data.entries)) {
            if (!entry.comment && Array.isArray(entry.key) && entry.key.length > 0) {
                entry.comment = entry.key[0];
                setWIOriginalDataValue(data, entry.uid, 'comment', entry.comment);
                counter++;
            }
        }

        if (counter > 0) {
            toastr.info(`Backfilled ${counter} titles`);
            await saveWorldInfo(name, data);
            updateEditor(navigation_option.previous);
        }
    });

    $('#world_apply_current_sorting').off('click').on('click', async () => {
        const entryCount = Object.keys(data.entries).length;
        const moreThan100 = entryCount > 100;

        let content = '<span>Apply your current sorting to the "Order" field. The Order values will go down from the chosen number.</span>';
        if (moreThan100) {
            content += `<div class="m-t-1"><i class="fa-solid fa-triangle-exclamation" style="color: #FFD43B;"></i> More than 100 entries in this world. If you don't choose a number higher than that, the lower entries will default to 0.<br />(Usual default: 100)<br />Minimum: ${entryCount}</div>`;
        }

        const result = await Popup.show.input('Apply Current Sorting', content, '100', { okButton: 'Apply', cancelButton: 'Cancel' });
        if (!result) return;

        const start = Number(result);
        if (isNaN(start) || start < 0) {
            toastr.error('Invalid number: ' + result, 'Apply Current Sorting');
            return;
        }
        if (start < entryCount) {
            toastr.warning('A number lower than the entry count has been chosen. All entries below that will default to 0.', 'Apply Current Sorting');
        }

        // We need to sort the entries here, as the data source isn't sorted
        const entries = Object.values(data.entries);
        sortWorldInfoEntries(entries);

        let updated = 0, current = start;
        for (const entry of entries) {
            const newOrder = Math.max(current--, 0);
            if (entry.order === newOrder) continue;

            entry.order = newOrder;
            setWIOriginalDataValue(data, entry.order, 'order', entry.order);
            updated++;
        }

        if (updated > 0) {
            toastr.info(`Updated ${updated} Order values`, 'Apply Custom Sorting');
            await saveWorldInfo(name, data, true);
            updateEditor(navigation_option.previous);
        } else {
            toastr.info('All values up to date', 'Apply Custom Sorting');
        }
    });

    $('#world_popup_export').off('click').on('click', () => {
        if (name && data) {
            const jsonValue = JSON.stringify(data);
            const fileName = `${name}.json`;
            download(jsonValue, fileName, 'application/json');
        }
    });

    $('#world_duplicate').off('click').on('click', async () => {
        const tempName = getFreeWorldName();
        const finalName = await Popup.show.input('Create a new World Info?', 'Enter a name for the new file:', tempName);

        if (finalName) {
            await saveWorldInfo(finalName, data, true);
            await updateWorldInfoList();

            const selectedIndex = world_names.indexOf(finalName);
            if (selectedIndex !== -1) {
                $('#world_editor_select').val(selectedIndex).trigger('change');
            } else {
                hideWorldEditor();
            }
        }
    });

    // Check if a sortable instance exists
    if (worldEntriesList.sortable('instance') !== undefined) {
        // Destroy the instance
        worldEntriesList.sortable('destroy');
    }

    worldEntriesList.sortable({
        items: '.world_entry',
        delay: getSortableDelay(),
        handle: '.drag-handle',
        stop: async function (_event, _ui) {
            const firstEntryUid = $('#world_popup_entries_list .world_entry').first().data('uid');
            const minDisplayIndex = data?.entries[firstEntryUid]?.displayIndex ?? 0;
            $('#world_popup_entries_list .world_entry').each(function (index) {
                const uid = $(this).data('uid');

                // Update the display index in the data array
                const item = data.entries[uid];

                if (!item) {
                    console.debug(`Could not find entry with uid ${uid}`);
                    return;
                }

                item.displayIndex = minDisplayIndex + index;
                setWIOriginalDataValue(data, uid, 'extensions.display_index', item.displayIndex);
            });

            console.table(Object.keys(data.entries).map(uid => data.entries[uid]).map(x => ({ uid: x.uid, key: x.key.join(','), displayIndex: x.displayIndex })));

            await saveWorldInfo(name, data);
        },
    });
    //$("#world_popup_entries_list").disableSelection();
}

export const originalWIDataKeyMap = {
    'displayIndex': 'extensions.display_index',
    'excludeRecursion': 'extensions.exclude_recursion',
    'preventRecursion': 'extensions.prevent_recursion',
    'delayUntilRecursion': 'extensions.delay_until_recursion',
    'selectiveLogic': 'selectiveLogic',
    'comment': 'comment',
    'constant': 'constant',
    'order': 'insertion_order',
    'depth': 'extensions.depth',
    'probability': 'extensions.probability',
    'position': 'extensions.position',
    'role': 'extensions.role',
    'content': 'content',
    'enabled': 'enabled',
    'key': 'keys',
    'keysecondary': 'secondary_keys',
    'selective': 'selective',
    'matchWholeWords': 'extensions.match_whole_words',
    'useGroupScoring': 'extensions.use_group_scoring',
    'caseSensitive': 'extensions.case_sensitive',
    'scanDepth': 'extensions.scan_depth',
    'automationId': 'extensions.automation_id',
    'vectorized': 'extensions.vectorized',
    'groupOverride': 'extensions.group_override',
    'groupWeight': 'extensions.group_weight',
    'sticky': 'extensions.sticky',
    'cooldown': 'extensions.cooldown',
    'delay': 'extensions.delay',
};

/** Checks the state of the current search, and adds/removes the search sorting option accordingly */
function verifyWorldInfoSearchSortRule() {
    const searchTerm = worldInfoFilter.getFilterData(FILTER_TYPES.WORLD_INFO_SEARCH);
    const searchOption = $('#world_info_sort_order option[data-rule="search"]');
    const selector = $('#world_info_sort_order');
    const isHidden = searchOption.attr('hidden') !== undefined;

    // If we have a search term, we are displaying the sorting option for it
    if (searchTerm && isHidden) {
        searchOption.removeAttr('hidden');
        selector.val(searchOption.attr('value') || '0');
        flashHighlight(selector);
    }
    // If search got cleared, we make sure to hide the option and go back to the one before
    if (!searchTerm && !isHidden) {
        searchOption.attr('hidden', '');
        selector.val(localStorage.getItem(SORT_ORDER_KEY) || '0');
    }
}

/**
 * Sets the value of a specific key in the original data entry corresponding to the given uid
 * This needs to be called whenever you update JSON data fields.
 * Use `originalWIDataKeyMap` to find the correct value to be set.
 *
 * @param {object} data - The data object containing the original data entries.
 * @param {string} uid - The unique identifier of the data entry.
 * @param {string} key - The key of the value to be set.
 * @param {any} value - The value to be set.
 */
export function setWIOriginalDataValue(data, uid, key, value) {
    if (data.originalData && Array.isArray(data.originalData.entries)) {
        let originalEntry = data.originalData.entries.find(x => x.uid === uid);

        if (!originalEntry) {
            return;
        }

        setValueByPath(originalEntry, key, value);
    }
}

/**
 * Deletes the original data entry corresponding to the given uid from the provided data object
 *
 * @param {object} data - The data object containing the original data entries
 * @param {string} uid - The unique identifier of the data entry to be deleted
 */
export function deleteWIOriginalDataValue(data, uid) {
    if (data.originalData && Array.isArray(data.originalData.entries)) {
        const originalIndex = data.originalData.entries.findIndex(x => x.uid === uid);

        if (originalIndex >= 0) {
            data.originalData.entries.splice(originalIndex, 1);
        }
    }
}

/** @typedef {import('./utils.js').Select2Option} Select2Option */

/**
 * Splits a given input string that contains one or more keywords or regexes, separated by commas.
 *
 * Each part can be a valid regex following the pattern `/myregex/flags` with optional flags. Commmas inside the regex are allowed, slashes have to be escaped like this: `\/`
 * If a regex doesn't stand alone, it is not treated as a regex.
 *
 * @param {string} input - One or multiple keywords or regexes, separated by commas
 * @returns {string[]} An array of keywords and regexes
 */
export function splitKeywordsAndRegexes(input) {
    /** @type {string[]} */
    let keywordsAndRegexes = [];

    // We can make this easy. Instead of writing another function to find and parse regexes,
    // we gonna utilize the custom tokenizer that also handles the input.
    // No need for validation here
    const addFindCallback = (/** @type {Select2Option} */ item) => {
        keywordsAndRegexes.push(item.text);
    };

    const { term } = customTokenizer({ _type: 'custom_call', term: input }, undefined, addFindCallback);
    const finalTerm = term.trim();
    if (finalTerm) {
        addFindCallback({ id: getSelect2OptionId(finalTerm), text: finalTerm });
    }

    return keywordsAndRegexes;
}

/**
 * Tokenizer parsing input and splitting it into keywords and regexes
 *
 * @param {{_type: string, term: string}} input - The typed input
 * @param {{options: object}} _selection - The selection even object (?)
 * @param {function(Select2Option):void} callback - The original callback function to call if an item should be inserted
 * @returns {{term: string}} - The remaining part that is untokenized in the textbox
 */
function customTokenizer(input, _selection, callback) {
    let current = input.term;

    let insideRegex = false, regexClosed = false;

    // Go over the input and check the current state, if we can get a token
    for (let i = 0; i < current.length; i++) {
        let char = current[i];

        // If we find an unascaped slash, set the current regex state
        if (char === '/' && (i === 0 || current[i - 1] !== '\\')) {
            if (!insideRegex) insideRegex = true;
            else if (!regexClosed) regexClosed = true;
        }

        // If a comma is typed, we tokenize the input.
        // unless we are inside a possible regex, which would allow commas inside
        if (char === ',') {
            // We take everything up till now and consider this a token
            const token = current.slice(0, i).trim();

            // Now how we test if this is a regex? And not a finished one, but a half-finished one?
            // We use the state remembered from above to check whether the delimiter was opened but not closed yet.
            // We don't check validity here if we are inside a regex, because it might only get valid after its finished. (Closing brackets, etc)
            // Validity will be finally checked when the next comma is typed.
            if (insideRegex && !regexClosed) {
                continue;
            }

            // So now the comma really means the token is done.
            // We take the token up till now, and insert it. Empty will be skipped.
            if (token) {
                const isRegex = isValidRegex(token);

                // Last chance to check for valid regex again. Because it might have been valid while typing, but now is not valid anymore and contains commas we need to split.
                if (token.startsWith('/') && !isRegex) {
                    const tokens = token.split(',').map(x => x.trim());
                    tokens.forEach(x => callback({ id: getSelect2OptionId(x), text: x }));
                } else {
                    callback({ id: getSelect2OptionId(token), text: token });
                }
            }

            // Now remove the token from the current input, and the comma too
            current = current.slice(i + 1);
            insideRegex = false;
            regexClosed = false;
            i = 0;
        }
    }

    // At the end, just return the left-over input
    return { term: current };
}

/**
 * Validates if a string is a valid slash-delimited regex, that can be parsed and executed
 *
 * This is a wrapper around `parseRegexFromString`
 *
 * @param {string} input - A delimited regex string
 * @returns {boolean} Whether this would be a valid regex that can be parsed and executed
 */
function isValidRegex(input) {
    return parseRegexFromString(input) !== null;
}

/**
 * Gets a real regex object from a slash-delimited regex string
 *
 * This function works with `/` as delimiter, and each occurance of it inside the regex has to be escaped.
 * Flags are optional, but can only be valid flags supported by JavaScript's `RegExp` (`g`, `i`, `m`, `s`, `u`, `y`).
 *
 * @param {string} input - A delimited regex string
 * @returns {RegExp|null} The regex object, or null if not a valid regex
 */
export function parseRegexFromString(input) {
    // Extracting the regex pattern and flags
    let match = input.match(/^\/([\w\W]+?)\/([gimsuy]*)$/);
    if (!match) {
        return null; // Not a valid regex format
    }

    let [, pattern, flags] = match;

    // If we find any unescaped slash delimiter, we also exit out.
    // JS doesn't care about delimiters inside regex patterns, but for this to be a valid regex outside of our implementation,
    // we have to make sure that our delimiter is correctly escaped. Or every other engine would fail.
    if (pattern.match(/(^|[^\\])\//)) {
        return null;
    }

    // Now we need to actually unescape the slash delimiters, because JS doesn't care about delimiters
    pattern = pattern.replace('\\/', '/');

    // Then we return the regex. If it fails, it was invalid syntax.
    try {
        return new RegExp(pattern, flags);
    } catch (e) {
        return null;
    }
}

async function getWorldEntry(name, data, entry) {
    if (!data.entries[entry.uid]) {
        return;
    }

    const template = WI_ENTRY_EDIT_TEMPLATE.clone();
    template.data('uid', entry.uid);
    template.attr('uid', entry.uid);

    // Init default state of WI Key toggle (=> true)
    if (typeof power_user.wi_key_input_plaintext === 'undefined') power_user.wi_key_input_plaintext = true;

    /** Function to build the keys input controls @param {string} entryPropName @param {string} originalDataValueName */
    function enableKeysInput(entryPropName, originalDataValueName) {
        const isFancyInput = !isMobile() && !power_user.wi_key_input_plaintext;
        const input = isFancyInput ? template.find(`select[name="${entryPropName}"]`) : template.find(`textarea[name="${entryPropName}"]`);
        input.data('uid', entry.uid);
        input.on('click', function (event) {
            // Prevent closing the drawer on clicking the input
            event.stopPropagation();
        });

        function templateStyling(/** @type {Select2Option} */ item, { searchStyle = false } = {}) {
            const content = $('<span>').addClass('item').text(item.text).attr('title', `${item.text}\n\nClick to edit`);
            const isRegex = isValidRegex(item.text);
            if (isRegex) {
                content.html(highlightRegex(item.text));
                content.addClass('regex_item').prepend($('<span>').addClass('regex_icon').text('•*').attr('title', 'Regex'));
            }

            if (searchStyle && item.count) {
                // Build a wrapping element
                const wrapper = $('<span>').addClass('result_block')
                    .append(content);
                wrapper.append($('<span>').addClass('item_count').text(item.count).attr('title', `Used as a key ${item.count} ${item.count != 1 ? 'times' : 'time'} in this lorebook`));
                return wrapper;
            }

            return content;
        }

        if (isFancyInput) {
            // First initialize existing values as options, before initializing select2, to speed up performance
            select2ModifyOptions(input, entry[entryPropName], { select: true, changeEventArgs: { skipReset: true, noSave: true } });

            input.select2({
                ajax: dynamicSelect2DataViaAjax(() => worldEntryKeyOptionsCache),
                tags: true,
                tokenSeparators: [','],
                tokenizer: customTokenizer,
                placeholder: input.attr('placeholder'),
                templateResult: item => templateStyling(item, { searchStyle: true }),
                templateSelection: item => templateStyling(item),
            });
            input.on('change', async function (_, { skipReset, noSave } = {}) {
                const uid = $(this).data('uid');
                /** @type {string[]} */
                const keys = ($(this).select2('data')).map(x => x.text);

                !skipReset && await resetScrollHeight(this);
                if (!noSave) {
                    data.entries[uid][entryPropName] = keys;
                    setWIOriginalDataValue(data, uid, originalDataValueName, data.entries[uid][entryPropName]);
                    await saveWorldInfo(name, data);
                }
            });
            input.on('select2:select', /** @type {function(*):void} */ event => updateWorldEntryKeyOptionsCache([event.params.data]));
            input.on('select2:unselect', /** @type {function(*):void} */ event => updateWorldEntryKeyOptionsCache([event.params.data], { remove: true }));

            select2ChoiceClickSubscribe(input, target => {
                const key = $(target.closest('.regex-highlight, .item')).text();
                console.debug('Editing WI key', key);

                // Remove the current key from the actual selection
                const selected = input.val();
                if (!Array.isArray(selected)) return;
                var index = selected.indexOf(getSelect2OptionId(key));
                if (index > -1) selected.splice(index, 1);
                input.val(selected).trigger('change');
                // Manually update the cache, that change event is not gonna trigger it
                updateWorldEntryKeyOptionsCache([key], { remove: true });

                // We need to "hack" the actual text input into the currently open textarea
                input.next('span.select2-container').find('textarea')
                    .val(key).trigger('input');
            }, { openDrawer: true });
        }
        else {
            // Compatibility with mobile devices. On mobile we need a text input field, not a select option control, so we need its own event handlers
            template.find(`select[name="${entryPropName}"]`).hide();
            input.show();

            input.on('input', async function (_, { skipReset, noSave } = {}) {
                const uid = $(this).data('uid');
                const value = String($(this).val());
                !skipReset && await resetScrollHeight(this);
                if (!noSave) {
                    data.entries[uid][entryPropName] = splitKeywordsAndRegexes(value);
                    setWIOriginalDataValue(data, uid, originalDataValueName, data.entries[uid][entryPropName]);
                    await saveWorldInfo(name, data);
                }
            });
            input.val(entry[entryPropName].join(', ')).trigger('input', { skipReset: true });
        }
        return { isFancy: isFancyInput, control: input };
    }

    // key
    const keyInput = enableKeysInput('key', 'keys');

    // keysecondary
    const keySecondaryInput = enableKeysInput('keysecondary', 'secondary_keys');

    // draw key input switch button
    template.find('.switch_input_type_icon').on('click', function () {
        power_user.wi_key_input_plaintext = !power_user.wi_key_input_plaintext;
        saveSettingsDebounced();

        // Just redraw the panel
        const uid = ($(this).parents('.world_entry')).data('uid');
        updateEditor(uid, false);

        $(`.world_entry[uid="${uid}"] .inline-drawer-icon`).trigger('click');
        // setTimeout(() => {
        // }, debounce_timeout.standard);
    }).each((_, icon) => {
        $(icon).attr('title', $(icon).data(power_user.wi_key_input_plaintext ? 'tooltip-on' : 'tooltip-off'));
        $(icon).text($(icon).data(power_user.wi_key_input_plaintext ? 'icon-on' : 'icon-off'));
    });

    // logic AND/NOT
    const selectiveLogicDropdown = template.find('select[name="entryLogicType"]');
    selectiveLogicDropdown.data('uid', entry.uid);

    selectiveLogicDropdown.on('click', function (event) {
        event.stopPropagation();
    });

    selectiveLogicDropdown.on('input', async function () {
        const uid = $(this).data('uid');
        const value = Number($(this).val());
        data.entries[uid].selectiveLogic = !isNaN(value) ? value : world_info_logic.AND_ANY;
        setWIOriginalDataValue(data, uid, 'selectiveLogic', data.entries[uid].selectiveLogic);
        await saveWorldInfo(name, data);
    });

    template
        .find(`select[name="entryLogicType"] option[value=${entry.selectiveLogic}]`)
        .prop('selected', true)
        .trigger('input');

    // Character filter
    const characterFilterLabel = template.find('label[for="characterFilter"] > small');
    characterFilterLabel.text(entry.characterFilter?.isExclude ? 'Exclude Character(s)' : 'Filter to Character(s)');

    // exclude characters checkbox
    const characterExclusionInput = template.find('input[name="character_exclusion"]');
    characterExclusionInput.data('uid', entry.uid);
    characterExclusionInput.on('input', async function () {
        const uid = $(this).data('uid');
        const value = $(this).prop('checked');
        characterFilterLabel.text(value ? 'Exclude Character(s)' : 'Filter to Character(s)');
        if (data.entries[uid].characterFilter) {
            if (!value && data.entries[uid].characterFilter.names.length === 0 && data.entries[uid].characterFilter.tags.length === 0) {
                delete data.entries[uid].characterFilter;
            } else {
                data.entries[uid].characterFilter.isExclude = value;
            }
        } else if (value) {
            Object.assign(
                data.entries[uid],
                {
                    characterFilter: {
                        isExclude: true,
                        names: [],
                        tags: [],
                    },
                },
            );
        }

        // Verify names to exist in the system
        if (data.entries[uid]?.characterFilter?.names?.length > 0) {
            for (const name of [...data.entries[uid].characterFilter.names]) {
                if (!getContext().characters.find(x => x.avatar.replace(/\.[^/.]+$/, '') === name)) {
                    console.warn(`World Info: Character ${name} not found. Removing from the entry filter.`, entry);
                    data.entries[uid].characterFilter.names = data.entries[uid].characterFilter.names.filter(x => x !== name);
                }
            }
        }

        setWIOriginalDataValue(data, uid, 'character_filter', data.entries[uid].characterFilter);
        await saveWorldInfo(name, data);
    });
    characterExclusionInput.prop('checked', entry.characterFilter?.isExclude ?? false).trigger('input');

    const characterFilter = template.find('select[name="characterFilter"]');
    characterFilter.data('uid', entry.uid);

    if (!isMobile()) {
        $(characterFilter).select2({
            width: '100%',
            placeholder: 'Tie this entry to specific characters or characters with specific tags',
            allowClear: true,
            closeOnSelect: false,
        });
    }

    const characters = getContext().characters;
    characters.forEach((character) => {
        const option = document.createElement('option');
        const name = character.avatar.replace(/\.[^/.]+$/, '') ?? character.name;
        option.innerText = name;
        option.selected = entry.characterFilter?.names?.includes(name);
        option.setAttribute('data-type', 'character');
        characterFilter.append(option);
    });

    const tags = getContext().tags;
    tags.forEach((tag) => {
        const option = document.createElement('option');
        option.innerText = `[Tag] ${tag.name}`;
        option.selected = entry.characterFilter?.tags?.includes(tag.id);
        option.value = tag.id;
        option.setAttribute('data-type', 'tag');
        characterFilter.append(option);
    });

    characterFilter.on('mousedown change', async function (e) {
        // If there's no world names, don't do anything
        if (world_names.length === 0) {
            e.preventDefault();
            return;
        }

        const uid = $(this).data('uid');
        const selected = $(this).find(':selected');
        if ((!selected || selected?.length === 0) && !data.entries[uid].characterFilter?.isExclude) {
            delete data.entries[uid].characterFilter;
        } else {
            const names = selected.filter('[data-type="character"]').map((_, e) => e instanceof HTMLOptionElement && e.innerText).toArray();
            const tags = selected.filter('[data-type="tag"]').map((_, e) => e instanceof HTMLOptionElement && e.value).toArray();
            Object.assign(
                data.entries[uid],
                {
                    characterFilter: {
                        isExclude: data.entries[uid].characterFilter?.isExclude ?? false,
                        names: names,
                        tags: tags,
                    },
                },
            );
        }
        setWIOriginalDataValue(data, uid, 'character_filter', data.entries[uid].characterFilter);
        await saveWorldInfo(name, data);
    });

    // comment
    const commentInput = template.find('textarea[name="comment"]');
    const commentToggle = template.find('input[name="addMemo"]');
    commentInput.data('uid', entry.uid);
    commentInput.on('input', async function (_, { skipReset } = {}) {
        const uid = $(this).data('uid');
        const value = $(this).val();
        !skipReset && await resetScrollHeight(this);
        data.entries[uid].comment = value;

        setWIOriginalDataValue(data, uid, 'comment', data.entries[uid].comment);
        await saveWorldInfo(name, data);
    });
    commentToggle.data('uid', entry.uid);
    commentToggle.on('input', async function () {
        const uid = $(this).data('uid');
        const value = $(this).prop('checked');
        //console.log(value)
        const commentContainer = $(this)
            .closest('.world_entry')
            .find('.commentContainer');
        data.entries[uid].addMemo = value;
        await saveWorldInfo(name, data);
        value ? commentContainer.show() : commentContainer.hide();
    });

    commentInput.val(entry.comment).trigger('input', { skipReset: true });
    //initScrollHeight(commentInput);
    commentToggle.prop('checked', true /* entry.addMemo */).trigger('input');
    commentToggle.parent().hide();

    // content
    const counter = template.find('.world_entry_form_token_counter');
    const countTokensDebounced = debounce(async function (counter, value) {
        const numberOfTokens = await getTokenCountAsync(value);
        $(counter).text(numberOfTokens);
    }, debounce_timeout.relaxed);

    const contentInput = template.find('textarea[name="content"]');
    contentInput.data('uid', entry.uid);
    contentInput.on('input', async function (_, { skipCount } = {}) {
        const uid = $(this).data('uid');
        const value = $(this).val();
        data.entries[uid].content = value;

        setWIOriginalDataValue(data, uid, 'content', data.entries[uid].content);
        await saveWorldInfo(name, data);

        if (skipCount) {
            return;
        }

        // count tokens
        countTokensDebounced(counter, value);
    });
    contentInput.val(entry.content).trigger('input', { skipCount: true });
    //initScrollHeight(contentInput);

    template.find('.inline-drawer-toggle').on('click', function () {
        if (counter.data('first-run')) {
            counter.data('first-run', false);
            countTokensDebounced(counter, contentInput.val());
            if (!keyInput.isFancy) initScrollHeight(keyInput.control);
            if (!keySecondaryInput.isFancy) initScrollHeight(keySecondaryInput.control);
        }
    });

    // selective
    const selectiveInput = template.find('input[name="selective"]');
    selectiveInput.data('uid', entry.uid);
    selectiveInput.on('input', async function () {
        const uid = $(this).data('uid');
        const value = $(this).prop('checked');
        data.entries[uid].selective = value;

        setWIOriginalDataValue(data, uid, 'selective', data.entries[uid].selective);
        await saveWorldInfo(name, data);

        const keysecondary = $(this)
            .closest('.world_entry')
            .find('.keysecondary');

        const keysecondarytextpole = $(this)
            .closest('.world_entry')
            .find('.keysecondarytextpole');

        const keyprimaryselect = $(this)
            .closest('.world_entry')
            .find('.keyprimaryselect');

        const keyprimaryHeight = keyprimaryselect.outerHeight();
        keysecondarytextpole.css('height', keyprimaryHeight + 'px');

        value ? keysecondary.show() : keysecondary.hide();

    });
    //forced on, ignored if empty
    selectiveInput.prop('checked', true /* entry.selective */).trigger('input');
    selectiveInput.parent().hide();


    // constant
    /*
    const constantInput = template.find('input[name="constant"]');
    constantInput.data("uid", entry.uid);
    constantInput.on("input", async function () {
        const uid = $(this).data("uid");
        const value = $(this).prop("checked");
        data.entries[uid].constant = value;
        setOriginalDataValue(data, uid, "constant", data.entries[uid].constant);
        await saveWorldInfo(name, data);
    });
    constantInput.prop("checked", entry.constant).trigger("input");
    */

    // order
    const orderInput = template.find('input[name="order"]');
    orderInput.data('uid', entry.uid);
    orderInput.on('input', async function () {
        const uid = $(this).data('uid');
        const value = Number($(this).val());

        data.entries[uid].order = !isNaN(value) ? value : 0;
        updatePosOrdDisplay(uid);
        setWIOriginalDataValue(data, uid, 'insertion_order', data.entries[uid].order);
        await saveWorldInfo(name, data);
    });
    orderInput.val(entry.order).trigger('input');
    orderInput.css('width', 'calc(3em + 15px)');

    // group
    const groupInput = template.find('input[name="group"]');
    groupInput.data('uid', entry.uid);
    groupInput.on('input', async function () {
        const uid = $(this).data('uid');
        const value = String($(this).val()).trim();

        data.entries[uid].group = value;
        setWIOriginalDataValue(data, uid, 'extensions.group', data.entries[uid].group);
        await saveWorldInfo(name, data);
    });
    groupInput.val(entry.group ?? '').trigger('input');
    setTimeout(() => createEntryInputAutocomplete(groupInput, getInclusionGroupCallback(data), { allowMultiple: true }), 1);

    // inclusion priority
    const groupOverrideInput = template.find('input[name="groupOverride"]');
    groupOverrideInput.data('uid', entry.uid);
    groupOverrideInput.on('input', async function () {
        const uid = $(this).data('uid');
        const value = $(this).prop('checked');
        data.entries[uid].groupOverride = value;
        setWIOriginalDataValue(data, uid, 'extensions.group_override', data.entries[uid].groupOverride);
        await saveWorldInfo(name, data);
    });
    groupOverrideInput.prop('checked', entry.groupOverride).trigger('input');

    // group weight
    const groupWeightInput = template.find('input[name="groupWeight"]');
    groupWeightInput.data('uid', entry.uid);
    groupWeightInput.on('input', async function () {
        const uid = $(this).data('uid');
        let value = Number($(this).val());
        const min = Number($(this).attr('min'));
        const max = Number($(this).attr('max'));

        // Clamp the value
        if (value < min) {
            value = min;
            $(this).val(min);
        } else if (value > max) {
            value = max;
            $(this).val(max);
        }

        data.entries[uid].groupWeight = !isNaN(value) ? Math.abs(value) : 1;
        setWIOriginalDataValue(data, uid, 'extensions.group_weight', data.entries[uid].groupWeight);
        await saveWorldInfo(name, data);
    });
    groupWeightInput.val(entry.groupWeight ?? DEFAULT_WEIGHT).trigger('input');

    // sticky
    const sticky = template.find('input[name="sticky"]');
    sticky.data('uid', entry.uid);
    sticky.on('input', async function () {
        const uid = $(this).data('uid');
        const value = Number($(this).val());
        data.entries[uid].sticky = !isNaN(value) ? value : null;

        setWIOriginalDataValue(data, uid, 'extensions.sticky', data.entries[uid].sticky);
        await saveWorldInfo(name, data);
    });
    sticky.val(entry.sticky > 0 ? entry.sticky : '').trigger('input');

    // cooldown
    const cooldown = template.find('input[name="cooldown"]');
    cooldown.data('uid', entry.uid);
    cooldown.on('input', async function () {
        const uid = $(this).data('uid');
        const value = Number($(this).val());
        data.entries[uid].cooldown = !isNaN(value) ? value : null;

        setWIOriginalDataValue(data, uid, 'extensions.cooldown', data.entries[uid].cooldown);
        await saveWorldInfo(name, data);
    });
    cooldown.val(entry.cooldown > 0 ? entry.cooldown : '').trigger('input');

    // delay
    const delay = template.find('input[name="delay"]');
    delay.data('uid', entry.uid);
    delay.on('input', async function () {
        const uid = $(this).data('uid');
        const value = Number($(this).val());
        data.entries[uid].delay = !isNaN(value) ? value : null;

        setWIOriginalDataValue(data, uid, 'extensions.delay', data.entries[uid].delay);
        await saveWorldInfo(name, data);
    });
    delay.val(entry.delay > 0 ? entry.delay : '').trigger('input');

    // probability
    if (entry.probability === undefined) {
        entry.probability = null;
    }

    // depth
    const depthInput = template.find('input[name="depth"]');
    depthInput.data('uid', entry.uid);

    depthInput.on('input', async function () {
        const uid = $(this).data('uid');
        const value = Number($(this).val());

        data.entries[uid].depth = !isNaN(value) ? value : 0;
        updatePosOrdDisplay(uid);
        setWIOriginalDataValue(data, uid, 'extensions.depth', data.entries[uid].depth);
        await saveWorldInfo(name, data);
    });
    depthInput.val(entry.depth ?? DEFAULT_DEPTH).trigger('input');
    depthInput.css('width', 'calc(3em + 15px)');

    // Hide by default unless depth is specified
    if (entry.position === world_info_position.atDepth) {
        //depthInput.parent().hide();
    }

    const probabilityInput = template.find('input[name="probability"]');
    probabilityInput.data('uid', entry.uid);
    probabilityInput.on('input', async function () {
        const uid = $(this).data('uid');
        const value = Number($(this).val());

        data.entries[uid].probability = !isNaN(value) ? value : null;

        // Clamp probability to 0-100
        if (data.entries[uid].probability !== null) {
            data.entries[uid].probability = Math.min(100, Math.max(0, data.entries[uid].probability));

            if (data.entries[uid].probability !== value) {
                $(this).val(data.entries[uid].probability);
            }
        }

        setWIOriginalDataValue(data, uid, 'extensions.probability', data.entries[uid].probability);
        await saveWorldInfo(name, data);
    });
    probabilityInput.val(entry.probability).trigger('input');
    probabilityInput.css('width', 'calc(3em + 15px)');

    // probability toggle
    if (entry.useProbability === undefined) {
        entry.useProbability = false;
    }

    const probabilityToggle = template.find('input[name="useProbability"]');
    probabilityToggle.data('uid', entry.uid);
    probabilityToggle.on('input', async function () {
        const uid = $(this).data('uid');
        const value = $(this).prop('checked');
        data.entries[uid].useProbability = value;
        const probabilityContainer = $(this)
            .closest('.world_entry')
            .find('.probabilityContainer');
        await saveWorldInfo(name, data);
        value ? probabilityContainer.show() : probabilityContainer.hide();

        if (value && data.entries[uid].probability === null) {
            data.entries[uid].probability = 100;
        }

        if (!value) {
            data.entries[uid].probability = null;
        }

        probabilityInput.val(data.entries[uid].probability).trigger('input');
    });
    //forced on, 100% by default
    probabilityToggle.prop('checked', true /* entry.useProbability */).trigger('input');
    probabilityToggle.parent().hide();

    // position
    if (entry.position === undefined) {
        entry.position = 0;
    }

    const positionInput = template.find('select[name="position"]');
    //initScrollHeight(positionInput);
    positionInput.data('uid', entry.uid);
    positionInput.on('click', function (event) {
        // Prevent closing the drawer on clicking the input
        event.stopPropagation();
    });
    positionInput.on('input', async function () {
        const uid = $(this).data('uid');
        const value = Number($(this).val());
        data.entries[uid].position = !isNaN(value) ? value : 0;
        if (value === world_info_position.atDepth) {
            depthInput.prop('disabled', false);
            depthInput.css('visibility', 'visible');
            //depthInput.parent().show();
            const role = Number($(this).find(':selected').data('role'));
            data.entries[uid].role = role;
        } else {
            depthInput.prop('disabled', true);
            depthInput.css('visibility', 'hidden');
            data.entries[uid].role = null;
            //depthInput.parent().hide();
        }
        updatePosOrdDisplay(uid);
        // Spec v2 only supports before_char and after_char
        setWIOriginalDataValue(data, uid, 'position', data.entries[uid].position == 0 ? 'before_char' : 'after_char');
        // Write the original value as extensions field
        setWIOriginalDataValue(data, uid, 'extensions.position', data.entries[uid].position);
        setWIOriginalDataValue(data, uid, 'extensions.role', data.entries[uid].role);
        await saveWorldInfo(name, data);
    });

    const roleValue = entry.position === world_info_position.atDepth ? String(entry.role ?? extension_prompt_roles.SYSTEM) : '';
    template
        .find(`select[name="position"] option[value=${entry.position}][data-role="${roleValue}"]`)
        .prop('selected', true)
        .trigger('input');

    //add UID above content box (less important doesn't need to be always visible)
    template.find('.world_entry_form_uid_value').text(`(UID: ${entry.uid})`);

    //new tri-state selector for constant/normal/vectorized
    const entryStateSelector = template.find('select[name="entryStateSelector"]');
    entryStateSelector.data('uid', entry.uid);
    entryStateSelector.on('click', function (event) {
        // Prevent closing the drawer on clicking the input
        event.stopPropagation();
    });
    entryStateSelector.on('input', async function () {
        const uid = entry.uid;
        const value = $(this).val();
        switch (value) {
            case 'constant':
                data.entries[uid].constant = true;
                data.entries[uid].vectorized = false;
                setWIOriginalDataValue(data, uid, 'constant', true);
                setWIOriginalDataValue(data, uid, 'extensions.vectorized', false);
                break;
            case 'normal':
                data.entries[uid].constant = false;
                data.entries[uid].vectorized = false;
                setWIOriginalDataValue(data, uid, 'constant', false);
                setWIOriginalDataValue(data, uid, 'extensions.vectorized', false);
                break;
            case 'vectorized':
                data.entries[uid].constant = false;
                data.entries[uid].vectorized = true;
                setWIOriginalDataValue(data, uid, 'constant', false);
                setWIOriginalDataValue(data, uid, 'extensions.vectorized', true);
                break;
        }
        await saveWorldInfo(name, data);

    });

    const entryKillSwitch = template.find('div[name="entryKillSwitch"]');
    entryKillSwitch.data('uid', entry.uid);
    entryKillSwitch.on('click', async function (event) {
        const uid = entry.uid;
        data.entries[uid].disable = !data.entries[uid].disable;
        const isActive = !data.entries[uid].disable;
        setWIOriginalDataValue(data, uid, 'enabled', isActive);
        template.toggleClass('disabledWIEntry', !isActive);
        entryKillSwitch.toggleClass('fa-toggle-off', !isActive);
        entryKillSwitch.toggleClass('fa-toggle-on', isActive);
        await saveWorldInfo(name, data);

    });

    const entryState = function () {
        if (entry.constant === true) {
            return 'constant';
        } else if (entry.vectorized === true) {
            return 'vectorized';
        } else {
            return 'normal';
        }
    };

    const isActive = !entry.disable;
    template.toggleClass('disabledWIEntry', !isActive);
    entryKillSwitch.toggleClass('fa-toggle-off', !isActive);
    entryKillSwitch.toggleClass('fa-toggle-on', isActive);

    template
        .find(`select[name="entryStateSelector"] option[value=${entryState()}]`)
        .prop('selected', true)
        .trigger('input');

    // exclude recursion
    const excludeRecursionInput = template.find('input[name="exclude_recursion"]');
    excludeRecursionInput.data('uid', entry.uid);
    excludeRecursionInput.on('input', async function () {
        const uid = $(this).data('uid');
        const value = $(this).prop('checked');
        data.entries[uid].excludeRecursion = value;
        setWIOriginalDataValue(data, uid, 'extensions.exclude_recursion', data.entries[uid].excludeRecursion);
        await saveWorldInfo(name, data);
    });
    excludeRecursionInput.prop('checked', entry.excludeRecursion).trigger('input');

    // prevent recursion
    const preventRecursionInput = template.find('input[name="prevent_recursion"]');
    preventRecursionInput.data('uid', entry.uid);
    preventRecursionInput.on('input', async function () {
        const uid = $(this).data('uid');
        const value = $(this).prop('checked');
        data.entries[uid].preventRecursion = value;
        setWIOriginalDataValue(data, uid, 'extensions.prevent_recursion', data.entries[uid].preventRecursion);
        await saveWorldInfo(name, data);
    });
    preventRecursionInput.prop('checked', entry.preventRecursion).trigger('input');

    // delay until recursion
    // delay until recursion level
    const delayUntilRecursionInput = template.find('input[name="delay_until_recursion"]');
    delayUntilRecursionInput.data('uid', entry.uid);
    const delayUntilRecursionLevelInput = template.find('input[name="delayUntilRecursionLevel"]');
    delayUntilRecursionLevelInput.data('uid', entry.uid);
    delayUntilRecursionInput.on('input', async function () {
        const uid = $(this).data('uid');
        const toggled = $(this).prop('checked');

        // If the value contains a number, we'll take that one (set by the level input), otherwise we can use true/false switch
        const value = toggled ? data.entries[uid].delayUntilRecursion || true : false;

        if (!toggled) delayUntilRecursionLevelInput.val('');

        data.entries[uid].delayUntilRecursion = value;
        setWIOriginalDataValue(data, uid, 'extensions.delay_until_recursion', data.entries[uid].delayUntilRecursion);
        await saveWorldInfo(name, data);
    });
    delayUntilRecursionInput.prop('checked', entry.delayUntilRecursion).trigger('input');
    delayUntilRecursionLevelInput.on('input', async function () {
        const uid = $(this).data('uid');
        const content = $(this).val();
        const value = content === '' ? (typeof data.entries[uid].delayUntilRecursion === 'boolean' ? data.entries[uid].delayUntilRecursion : true)
            : content === 1 ? true
                : !isNaN(Number(content)) ? Number(content)
                    : false;

        data.entries[uid].delayUntilRecursion = value;
        setWIOriginalDataValue(data, uid, 'extensions.delay_until_recursion', data.entries[uid].delayUntilRecursion);
        await saveWorldInfo(name, data);
    });
    // No need to retrigger inpout event, we'll just set the curret current value. It was edited/saved above already
    delayUntilRecursionLevelInput.val(['number', 'string'].includes(typeof entry.delayUntilRecursion) ? entry.delayUntilRecursion : '').trigger('input');

    // duplicate button
    const duplicateButton = template.find('.duplicate_entry_button');
    duplicateButton.data('uid', entry.uid);
    duplicateButton.on('click', async function () {
        const uid = $(this).data('uid');
        const entry = duplicateWorldInfoEntry(data, uid);
        if (entry) {
            await saveWorldInfo(name, data);
            updateEditor(entry.uid);
        }
    });

    // delete button
    const deleteButton = template.find('.delete_entry_button');
    deleteButton.data('uid', entry.uid);
    deleteButton.on('click', async function (e) {
        e.stopPropagation();
        const uid = $(this).data('uid');
        const deleted = await deleteWorldInfoEntry(data, uid);
        if (!deleted) return;
        deleteWIOriginalDataValue(data, uid);
        await saveWorldInfo(name, data);
        updateEditor(navigation_option.previous);
    });

    // scan depth
    const scanDepthInput = template.find('input[name="scanDepth"]');
    scanDepthInput.data('uid', entry.uid);
    scanDepthInput.on('input', async function () {
        const uid = $(this).data('uid');
        const isEmpty = $(this).val() === '';
        const value = Number($(this).val());

        // Clamp if necessary
        if (value < 0) {
            $(this).val(0).trigger('input');
            toastr.warning('Scan depth cannot be negative');
            return;
        }

        if (value > MAX_SCAN_DEPTH) {
            $(this).val(MAX_SCAN_DEPTH).trigger('input');
            toastr.warning(`Scan depth cannot exceed ${MAX_SCAN_DEPTH}`);
            return;
        }

        data.entries[uid].scanDepth = !isEmpty && !isNaN(value) && value >= 0 && value <= MAX_SCAN_DEPTH ? Math.floor(value) : null;
        setWIOriginalDataValue(data, uid, 'extensions.scan_depth', data.entries[uid].scanDepth);
        await saveWorldInfo(name, data);
    });
    scanDepthInput.val(entry.scanDepth ?? null).trigger('input');

    // case sensitive select
    const caseSensitiveSelect = template.find('select[name="caseSensitive"]');
    caseSensitiveSelect.data('uid', entry.uid);
    caseSensitiveSelect.on('input', async function () {
        const uid = $(this).data('uid');
        const value = $(this).val();

        data.entries[uid].caseSensitive = value === 'null' ? null : value === 'true';
        setWIOriginalDataValue(data, uid, 'extensions.case_sensitive', data.entries[uid].caseSensitive);
        await saveWorldInfo(name, data);
    });
    caseSensitiveSelect.val((entry.caseSensitive === null || entry.caseSensitive === undefined) ? 'null' : entry.caseSensitive ? 'true' : 'false').trigger('input');

    // match whole words select
    const matchWholeWordsSelect = template.find('select[name="matchWholeWords"]');
    matchWholeWordsSelect.data('uid', entry.uid);
    matchWholeWordsSelect.on('input', async function () {
        const uid = $(this).data('uid');
        const value = $(this).val();

        data.entries[uid].matchWholeWords = value === 'null' ? null : value === 'true';
        setWIOriginalDataValue(data, uid, 'extensions.match_whole_words', data.entries[uid].matchWholeWords);
        await saveWorldInfo(name, data);
    });
    matchWholeWordsSelect.val((entry.matchWholeWords === null || entry.matchWholeWords === undefined) ? 'null' : entry.matchWholeWords ? 'true' : 'false').trigger('input');

    // use group scoring select
    const useGroupScoringSelect = template.find('select[name="useGroupScoring"]');
    useGroupScoringSelect.data('uid', entry.uid);
    useGroupScoringSelect.on('input', async function () {
        const uid = $(this).data('uid');
        const value = $(this).val();

        data.entries[uid].useGroupScoring = value === 'null' ? null : value === 'true';
        setWIOriginalDataValue(data, uid, 'extensions.use_group_scoring', data.entries[uid].useGroupScoring);
        await saveWorldInfo(name, data);
    });
    useGroupScoringSelect.val((entry.useGroupScoring === null || entry.useGroupScoring === undefined) ? 'null' : entry.useGroupScoring ? 'true' : 'false').trigger('input');

    // automation id
    const automationIdInput = template.find('input[name="automationId"]');
    automationIdInput.data('uid', entry.uid);
    automationIdInput.on('input', async function () {
        const uid = $(this).data('uid');
        const value = $(this).val();

        data.entries[uid].automationId = value;
        setWIOriginalDataValue(data, uid, 'extensions.automation_id', data.entries[uid].automationId);
        await saveWorldInfo(name, data);
    });
    automationIdInput.val(entry.automationId ?? '').trigger('input');
    setTimeout(() => createEntryInputAutocomplete(automationIdInput, getAutomationIdCallback(data)), 1);

    template.find('.inline-drawer-content').css('display', 'none'); //entries start collapsed

    function updatePosOrdDisplay(uid) {
        // display position/order info left of keyword box
        let entry = data.entries[uid];
        let posText = entry.position;
        switch (entry.position) {
            case 0:
                posText = '↑CD';
                break;
            case 1:
                posText = 'CD↓';
                break;
            case 2:
                posText = '↑AN';
                break;
            case 3:
                posText = 'AN↓';
                break;
            case 4:
                posText = `@D${entry.depth}`;
                break;
        }
        template.find('.world_entry_form_position_value').text(`(${posText} ${entry.order})`);
    }

    return template;
}

/**
 * Get the inclusion groups for the autocomplete.
 * @param {any} data WI data
 * @returns {(input: any, output: any) => any} Callback function for the autocomplete
 */
function getInclusionGroupCallback(data) {
    return function (control, input, output) {
        const uid = $(control).data('uid');
        const thisGroups = String($(control).val()).split(/,\s*/).filter(x => x).map(x => x.toLowerCase());
        const groups = new Set();
        for (const entry of Object.values(data.entries)) {
            // Skip the groups of this entry, because auto-complete should only suggest the ones that are already available on other entries
            if (entry.uid == uid) continue;
            if (entry.group) {
                entry.group.split(/,\s*/).filter(x => x).forEach(x => groups.add(x));
            }
        }

        const haystack = Array.from(groups);
        haystack.sort((a, b) => a.localeCompare(b));
        const needle = input.term.toLowerCase();
        const hasExactMatch = haystack.findIndex(x => x.toLowerCase() == needle) !== -1;
        const result = haystack.filter(x => x.toLowerCase().includes(needle) && (!thisGroups.includes(x) || hasExactMatch && thisGroups.filter(g => g == x).length == 1));

        output(result);
    };
}

function getAutomationIdCallback(data) {
    return function (control, input, output) {
        const uid = $(control).data('uid');
        const ids = new Set();
        for (const entry of Object.values(data.entries)) {
            // Skip automation id of this entry, because auto-complete should only suggest the ones that are already available on other entries
            if (entry.uid == uid) continue;
            if (entry.automationId) {
                ids.add(String(entry.automationId));
            }
        }

        if ('quickReplyApi' in window) {
            // @ts-ignore
            for (const automationId of window['quickReplyApi'].listAutomationIds()) {
                ids.add(String(automationId));
            }
        }

        const haystack = Array.from(ids);
        haystack.sort((a, b) => a.localeCompare(b));
        const needle = input.term.toLowerCase();
        const result = haystack.filter(x => x.toLowerCase().includes(needle));

        output(result);
    };
}

/**
 * Create an autocomplete for the inclusion group.
 * @param {JQuery<HTMLElement>} input - Input element to attach the autocomplete to
 * @param {(control: JQuery<HTMLElement>, input: any, output: any) => any} callback - Source data callbacks
 * @param {object} [options={}] - Optional arguments
 * @param {boolean} [options.allowMultiple=false] - Whether to allow multiple comma-separated values
 */
function createEntryInputAutocomplete(input, callback, { allowMultiple = false } = {}) {
    const handleSelect = (event, ui) => {
        // Prevent default autocomplete select, so we can manually set the value
        event.preventDefault();
        if (!allowMultiple) {
            $(input).val(ui.item.value).trigger('input').trigger('blur');
        } else {
            var terms = String($(input).val()).split(/,\s*/);
            terms.pop(); // remove the current input
            terms.push(ui.item.value); // add the selected item
            $(input).val(terms.filter(x => x).join(', ')).trigger('input').trigger('blur');
        }
    };

    $(input).autocomplete({
        minLength: 0,
        source: function (request, response) {
            if (!allowMultiple) {
                callback(input, request, response);
            } else {
                const term = request.term.split(/,\s*/).pop();
                request.term = term;
                callback(input, request, response);
            }
        },
        select: handleSelect,
    });

    $(input).on('focus click', function () {
        $(input).autocomplete('search', allowMultiple ? String($(input).val()).split(/,\s*/).pop() : $(input).val());
    });
}


/**
 * Duplicate a WI entry by copying all of its properties and assigning a new uid
 * @param {*} data - The data of the book
 * @param {number} uid - The uid of the entry to copy in this book
 * @returns {*} The new WI duplicated entry
 */
export function duplicateWorldInfoEntry(data, uid) {
    if (!data || !('entries' in data) || !data.entries[uid]) {
        return;
    }

    // Exclude uid and gather the rest of the properties
    const originalData = Object.assign({}, data.entries[uid]);
    delete originalData.uid;

    // Create new entry and copy over data
    const entry = createWorldInfoEntry(data.name, data);
    Object.assign(entry, originalData);

    return entry;
}

/**
 * Deletes a WI entry, with a user confirmation dialog
 * @param {*[]} data - The data of the book
 * @param {number} uid - The uid of the entry to copy in this book
 * @param {object} [options={}] - Optional arguments
 * @param {boolean} [options.silent=false] - Whether to prompt the user for deletion or just do it
 * @returns {Promise<boolean>} Whether the entry deletion was successful
 */
export async function deleteWorldInfoEntry(data, uid, { silent = false } = {}) {
    if (!data || !('entries' in data)) {
        return;
    }

    const confirmation = silent || await Popup.show.confirm(`Delete the entry with UID: ${uid}?`, 'This action is irreversible!');
    if (!confirmation) {
        return false;
    }

    delete data.entries[uid];
    return true;
}

/**
 * Definitions of types for new WI entries
 *
 * Use `newEntryTemplate` if you just need the template that contains default values
 *
 * @type {{[key: string]: { default: any, type: string }}}
 */
export const newWorldInfoEntryDefinition = {
    key: { default: [], type: 'array' },
    keysecondary: { default: [], type: 'array' },
    comment: { default: '', type: 'string' },
    content: { default: '', type: 'string' },
    constant: { default: false, type: 'boolean' },
    vectorized: { default: false, type: 'boolean' },
    selective: { default: true, type: 'boolean' },
    selectiveLogic: { default: world_info_logic.AND_ANY, type: 'enum' },
    addMemo: { default: false, type: 'boolean' },
    order: { default: 100, type: 'number' },
    position: { default: 0, type: 'number' },
    disable: { default: false, type: 'boolean' },
    excludeRecursion: { default: false, type: 'boolean' },
    preventRecursion: { default: false, type: 'boolean' },
    delayUntilRecursion: { default: 0, type: 'number' },
    probability: { default: 100, type: 'number' },
    useProbability: { default: true, type: 'boolean' },
    depth: { default: DEFAULT_DEPTH, type: 'number' },
    group: { default: '', type: 'string' },
    groupOverride: { default: false, type: 'boolean' },
    groupWeight: { default: DEFAULT_WEIGHT, type: 'number' },
    scanDepth: { default: null, type: 'number?' },
    caseSensitive: { default: null, type: 'boolean?' },
    matchWholeWords: { default: null, type: 'boolean?' },
    useGroupScoring: { default: null, type: 'boolean?' },
    automationId: { default: '', type: 'string' },
    role: { default: 0, type: 'enum' },
    sticky: { default: null, type: 'number?' },
    cooldown: { default: null, type: 'number?' },
    delay: { default: null, type: 'number?' },
};

export const newWorldInfoEntryTemplate = Object.fromEntries(
    Object.entries(newWorldInfoEntryDefinition).map(([key, value]) => [key, value.default]),
);

/**
 * Creates a new world info entry from template.
 * @param {string} _name Name of the WI (unused)
 * @param {any} data WI data
 * @returns {object | undefined} New entry object or undefined if failed
 */
export function createWorldInfoEntry(_name, data) {
    const newUid = getFreeWorldEntryUid(data);

    if (!Number.isInteger(newUid)) {
        console.error('Couldn\'t assign UID to a new entry');
        return;
    }

    const newEntry = { uid: newUid, ...structuredClone(newWorldInfoEntryTemplate) };
    data.entries[newUid] = newEntry;

    return newEntry;
}

async function _save(name, data) {
    // Prevent double saving if both immediate and debounced save are called
    cancelDebounce(saveWorldDebounced);

    await fetch('/api/worldinfo/edit', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ name: name, data: data }),
    });
    eventSource.emit(event_types.WORLDINFO_UPDATED, name, data);
}


/**
 * Saves the world info
 *
 * This will also refresh the `worldInfoCache`.
 * Note, for performance reasons the saved cache will not make a deep clone of the data.
 * It is your responsibility to not modify the saved data object after calling this function, or there will be data inconsistencies.
 * Call `loadWorldInfoData` or query directly from cache if you need the object again.
 *
 * @param {string} name - The name of the world info
 * @param {any} data - The data to be saved
 * @param {boolean} [immediately=false] - Whether to save immediately or use debouncing
 * @return {Promise<void>} A promise that resolves when the world info is saved
 */
export async function saveWorldInfo(name, data, immediately = false) {
    if (!name || !data) {
        return;
    }

    // Update cache immediately, so any future call can pull from this
    worldInfoCache.set(name, data);

    if (immediately) {
        return await _save(name, data);
    }

    saveWorldDebounced(name, data);
}

async function renameWorldInfo(name, data) {
    const oldName = name;
    const newName = await Popup.show.input('Rename World Info', 'Enter a new name:', oldName);

    if (oldName === newName || !newName) {
        console.debug('World info rename cancelled');
        return;
    }

    const entryPreviouslySelected = selected_world_info.findIndex((e) => e === oldName);

    await saveWorldInfo(newName, data, true);
    await deleteWorldInfo(oldName);

    const existingCharLores = world_info.charLore?.filter((e) => e.extraBooks.includes(oldName));
    if (existingCharLores && existingCharLores.length > 0) {
        existingCharLores.forEach((charLore) => {
            const tempCharLore = charLore.extraBooks.filter((e) => e !== oldName);
            tempCharLore.push(newName);
            charLore.extraBooks = tempCharLore;
        });
        saveSettingsDebounced();
    }

    if (entryPreviouslySelected !== -1) {
        const wiElement = getWIElement(newName);
        wiElement.prop('selected', true);
        $('#world_info').trigger('change');
    }

    const selectedIndex = world_names.indexOf(newName);
    if (selectedIndex !== -1) {
        $('#world_editor_select').val(selectedIndex).trigger('change');
    }
}

/**
 * Deletes a world info with the given name
 *
 * @param {string} worldInfoName - The name of the world info to delete
 * @returns {Promise<boolean>} A promise that resolves to true if the world info was successfully deleted, false otherwise
 */
export async function deleteWorldInfo(worldInfoName) {
    if (!world_names.includes(worldInfoName)) {
        return false;
    }

    const response = await fetch('/api/worldinfo/delete', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ name: worldInfoName }),
    });

    if (!response.ok) {
        return false;
    }

    const existingWorldIndex = selected_world_info.findIndex((e) => e === worldInfoName);
    if (existingWorldIndex !== -1) {
        selected_world_info.splice(existingWorldIndex, 1);
        saveSettingsDebounced();
    }

    await updateWorldInfoList();
    $('#world_editor_select').trigger('change');

    if ($('#character_world').val() === worldInfoName) {
        $('#character_world').val('').trigger('change');
        setWorldInfoButtonClass(undefined, false);
        if (menu_type != 'create') {
            saveCharacterDebounced();
        }
    }

    return true;
}

export function getFreeWorldEntryUid(data) {
    if (!data || !('entries' in data)) {
        return null;
    }

    const MAX_UID = 1_000_000; // <- should be safe enough :)
    for (let uid = 0; uid < MAX_UID; uid++) {
        if (uid in data.entries) {
            continue;
        }
        return uid;
    }

    return null;
}

export function getFreeWorldName() {
    const MAX_FREE_NAME = 100_000;
    for (let index = 1; index < MAX_FREE_NAME; index++) {
        const newName = `New World (${index})`;
        if (world_names.includes(newName)) {
            continue;
        }
        return newName;
    }

    return undefined;
}

/**
 * Creates a new world info/lorebook with the given name.
 * Checks if a world with the same name already exists, providing a warning or optionally a user confirmation dialog.
 *
 * @param {string} worldName - The name of the new world info
 * @param {Object} options - Optional parameters
 * @param {boolean} [options.interactive=false] - Whether to show a confirmation dialog when overwriting an existing world
 * @returns {Promise<boolean>} - True if the world info was successfully created, false otherwise
 */
export async function createNewWorldInfo(worldName, { interactive = false } = {}) {
    const worldInfoTemplate = { entries: {} };

    if (!worldName) {
        return false;
    }

    const sanitizedWorldName = await getSanitizedFilename(worldName);

    const allowed = await checkOverwriteExistingData('World Info', world_names, sanitizedWorldName, { interactive: interactive, actionName: 'Create', deleteAction: (existingName) => deleteWorldInfo(existingName) });
    if (!allowed) {
        return false;
    }

    await saveWorldInfo(worldName, worldInfoTemplate, true);
    await updateWorldInfoList();

    const selectedIndex = world_names.indexOf(worldName);
    if (selectedIndex !== -1) {
        $('#world_editor_select').val(selectedIndex).trigger('change');
    } else {
        hideWorldEditor();
    }

    return true;
}

async function getCharacterLore() {
    const character = characters[this_chid];
    const name = character?.name;
    /** @type {Set<string>} */
    let worldsToSearch = new Set();

    const baseWorldName = character?.data?.extensions?.world;
    if (baseWorldName) {
        worldsToSearch.add(baseWorldName);
    }

    // TODO: Maybe make the utility function not use the window context?
    const fileName = getCharaFilename(this_chid);
    const extraCharLore = world_info.charLore?.find((e) => e.name === fileName);
    if (extraCharLore) {
        worldsToSearch = new Set([...worldsToSearch, ...extraCharLore.extraBooks]);
    }

    if (!worldsToSearch.size) {
        return [];
    }

    let entries = [];
    for (const worldName of worldsToSearch) {
        if (selected_world_info.includes(worldName)) {
            console.debug(`[WI] Character ${name}'s world ${worldName} is already activated in global world info! Skipping...`);
            continue;
        }

        if (chat_metadata[METADATA_KEY] === worldName) {
            console.debug(`[WI] Character ${name}'s world ${worldName} is already activated in chat lore! Skipping...`);
            continue;
        }

        const data = await loadWorldInfo(worldName);
        const newEntries = data ? Object.keys(data.entries).map((x) => data.entries[x]).map(({ uid, ...rest }) => ({ uid, world: worldName, ...rest })) : [];
        entries = entries.concat(newEntries);

        if (!newEntries.length) {
            console.debug(`[WI] Character ${name}'s world ${worldName} could not be found or is empty`);
        }
    }

    console.debug(`[WI] Character ${name}'s lore has ${entries.length} world info entries`, [...worldsToSearch]);
    return entries;
}

async function getGlobalLore() {
    if (!selected_world_info?.length) {
        return [];
    }

    let entries = [];
    for (const worldName of selected_world_info) {
        const data = await loadWorldInfo(worldName);
        const newEntries = data ? Object.keys(data.entries).map((x) => data.entries[x]).map(({ uid, ...rest }) => ({ uid, world: worldName, ...rest })) : [];
        entries = entries.concat(newEntries);
    }

    console.debug(`[WI] Global world info has ${entries.length} entries`, selected_world_info);

    return entries;
}

async function getChatLore() {
    const chatWorld = chat_metadata[METADATA_KEY];

    if (!chatWorld) {
        return [];
    }

    if (selected_world_info.includes(chatWorld)) {
        console.debug(`[WI] Chat world ${chatWorld} is already activated in global world info! Skipping...`);
        return [];
    }

    const data = await loadWorldInfo(chatWorld);
    const entries = data ? Object.keys(data.entries).map((x) => data.entries[x]).map(({ uid, ...rest }) => ({ uid, world: chatWorld, ...rest })) : [];

    console.debug(`[WI] Chat lore has ${entries.length} entries`, [chatWorld]);

    return entries;
}

export async function getSortedEntries() {
    try {
        const globalLore = await getGlobalLore();
        const characterLore = await getCharacterLore();
        const chatLore = await getChatLore();

        let entries;

        switch (Number(world_info_character_strategy)) {
            case world_info_insertion_strategy.evenly:
                entries = [...globalLore, ...characterLore].sort(sortFn);
                break;
            case world_info_insertion_strategy.character_first:
                entries = [...characterLore.sort(sortFn), ...globalLore.sort(sortFn)];
                break;
            case world_info_insertion_strategy.global_first:
                entries = [...globalLore.sort(sortFn), ...characterLore.sort(sortFn)];
                break;
            default:
                console.error('[WI] Unknown WI insertion strategy:', world_info_character_strategy, 'defaulting to evenly');
                entries = [...globalLore, ...characterLore].sort(sortFn);
                break;
        }

        // Chat lore always goes first
        entries = [...chatLore.sort(sortFn), ...entries];

        // Calculate hash and parse decorators. Split maps to preserve old hashes.
        entries = entries.map((entry) => {
            const [decorators, content] = parseDecorators(entry.content || '');
            return { ...entry, decorators, content };
        }).map((entry) => {
            const hash = getStringHash(JSON.stringify(entry));
            return { ...entry, hash };
        });

        console.debug(`[WI] Found ${entries.length} world lore entries. Sorted by strategy`, Object.entries(world_info_insertion_strategy).find((x) => x[1] === world_info_character_strategy));

        // Need to deep clone the entries to avoid modifying the cached data
        return structuredClone(entries);
    }
    catch (e) {
        console.error(e);
        return [];
    }
}


/**
 * Parse decorators from worldinfo content
 * @param {string} content The content to parse
 * @returns {[string[],string]} The decorators found in the content and the content without decorators
*/
function parseDecorators(content) {
    /**
     * Check if the decorator is known
     * @param {string} data string to check
     * @returns {boolean} true if the decorator is known
    */
    const isKnownDecorator = (data) => {
        if (data.startsWith('@@@')) {
            data = data.substring(1);
        }

        for (let i = 0; i < KNOWN_DECORATORS.length; i++) {
            if (data.startsWith(KNOWN_DECORATORS[i])) {
                return true;
            }
        }
        return false;
    };

    if (content.startsWith('@@')) {
        let newContent = content;
        const splited = content.split('\n');
        let decorators = [];
        let fallbacked = false;

        for (let i = 0; i < splited.length; i++) {
            if (splited[i].startsWith('@@')) {
                if (splited[i].startsWith('@@@') && !fallbacked) {
                    continue;
                }

                if (isKnownDecorator(splited[i])) {
                    decorators.push(splited[i].startsWith('@@@') ? splited[i].substring(1) : splited[i]);
                    fallbacked = false;
                }
                else {
                    fallbacked = true;
                }
            } else {
                newContent = splited.slice(i).join('\n');
                break;
            }
        }
        return [decorators, newContent];
    }

    return [[], content];

}

/**
 * Performs a scan on the chat and returns the world info activated.
 * @param {string[]} chat The chat messages to scan, in reverse order.
 * @param {number} maxContext The maximum context size of the generation.
 * @param {boolean} isDryRun Whether to perform a dry run.
 * @typedef {{ worldInfoBefore: string, worldInfoAfter: string, EMEntries: any[], WIDepthEntries: any[], allActivatedEntries: Set<any> }} WIActivated
 * @returns {Promise<WIActivated>} The world info activated.
 */
export async function checkWorldInfo(chat, maxContext, isDryRun) {
    const context = getContext();
    const buffer = new WorldInfoBuffer(chat);

    console.debug(`[WI] --- START WI SCAN (on ${chat.length} messages) ---`);

    // Combine the chat

    // Add the depth or AN if enabled
    // Put this code here since otherwise, the chat reference is modified
    for (const key of Object.keys(context.extensionPrompts)) {
        if (context.extensionPrompts[key]?.scan) {
            const prompt = getExtensionPromptByName(key);
            if (prompt) {
                buffer.addInject(prompt);
            }
        }
    }

    /** @type {scan_state} */
    let scanState = scan_state.INITIAL;
    let token_budget_overflowed = false;
    let count = 0;
    let allActivatedEntries = new Set();
    let failedProbabilityChecks = new Set();
    let allActivatedText = '';

    let budget = Math.round(world_info_budget * maxContext / 100) || 1;

    if (world_info_budget_cap > 0 && budget > world_info_budget_cap) {
        console.debug(`[WI] Budget ${budget} exceeds cap ${world_info_budget_cap}, using cap`);
        budget = world_info_budget_cap;
    }

    console.debug(`[WI] Context size: ${maxContext}; WI budget: ${budget} (max% = ${world_info_budget}%, cap = ${world_info_budget_cap})`);
    const sortedEntries = await getSortedEntries();
    const timedEffects = new WorldInfoTimedEffects(chat, sortedEntries);

    !isDryRun && timedEffects.checkTimedEffects();

    if (sortedEntries.length === 0) {
        return { worldInfoBefore: '', worldInfoAfter: '', WIDepthEntries: [], EMEntries: [], allActivatedEntries: new Set() };
    }

    /** @type {number[]} Represents the delay levels for entries that are delayed until recursion */
    const availableRecursionDelayLevels = [...new Set(sortedEntries
        .filter(entry => entry.delayUntilRecursion)
        .map(entry => entry.delayUntilRecursion === true ? 1 : entry.delayUntilRecursion),
    )].sort((a, b) => a - b);
    // Already preset with the first level
    let currentRecursionDelayLevel = availableRecursionDelayLevels.shift() ?? 0;
    if (currentRecursionDelayLevel > 0 && availableRecursionDelayLevels.length) {
        console.debug('[WI] Preparing first delayed recursion level', currentRecursionDelayLevel, '. Still delayed:', availableRecursionDelayLevels);
    }

    console.debug(`[WI] --- SEARCHING ENTRIES (on ${sortedEntries.length} entries) ---`);

    while (scanState) {
        //if world_info_max_recursion_steps is non-zero min activations are disabled, and vice versa
        if (world_info_max_recursion_steps && world_info_max_recursion_steps <= count) {
            console.debug('[WI] Search stopped by reaching max recursion steps', world_info_max_recursion_steps);
            break;
        }

        // Track how many times the loop has run. May be useful for debugging.
        count++;

        console.debug(`[WI] --- LOOP #${count} START ---`);
        console.debug('[WI] Scan state', Object.entries(scan_state).find(x => x[1] === scanState));

        // Until decided otherwise, we set the loop to stop scanning after this
        let nextScanState = scan_state.NONE;

        // Loop and find all entries that can activate here
        let activatedNow = new Set();

        for (let entry of sortedEntries) {
            // Logging preparation
            let headerLogged = false;
            function log(...args) {
                if (!headerLogged) {
                    console.debug(`[WI] Entry ${entry.uid}`, `from '${entry.world}' processing`, entry);
                    headerLogged = true;
                }
                console.debug(`[WI] Entry ${entry.uid}`, ...args);
            }

            // Already processed, considered and then skipped entries should still be skipped
            if (failedProbabilityChecks.has(entry) || allActivatedEntries.has(entry)) {
                continue;
            }

            if (entry.disable == true) {
                log('disabled');
                continue;
            }

            // Check if this entry applies to the character or if it's excluded
            if (entry.characterFilter && entry.characterFilter?.names?.length > 0) {
                const nameIncluded = entry.characterFilter.names.includes(getCharaFilename());
                const filtered = entry.characterFilter.isExclude ? nameIncluded : !nameIncluded;

                if (filtered) {
                    log('filtered out by character');
                    continue;
                }
            }

            if (entry.characterFilter && entry.characterFilter?.tags?.length > 0) {
                const tagKey = getTagKeyForEntity(this_chid);

                if (tagKey) {
                    const tagMapEntry = context.tagMap[tagKey];

                    if (Array.isArray(tagMapEntry)) {
                        // If tag map intersects with the tag exclusion list, skip
                        const includesTag = tagMapEntry.some((tag) => entry.characterFilter.tags.includes(tag));
                        const filtered = entry.characterFilter.isExclude ? includesTag : !includesTag;

                        if (filtered) {
                            log('filtered out by tag');
                            continue;
                        }
                    }
                }
            }

            const isSticky = timedEffects.isEffectActive('sticky', entry);
            const isCooldown = timedEffects.isEffectActive('cooldown', entry);
            const isDelay = timedEffects.isEffectActive('delay', entry);

            if (isDelay) {
                log('suppressed by delay');
                continue;
            }

            if (isCooldown && !isSticky) {
                log('suppressed by cooldown');
                continue;
            }

            // Only use checks for recursion flags if the scan step was activated by recursion
            if (scanState !== scan_state.RECURSION && entry.delayUntilRecursion && !isSticky) {
                log('suppressed by delay until recursion');
                continue;
            }

            if (scanState === scan_state.RECURSION && entry.delayUntilRecursion && entry.delayUntilRecursion > currentRecursionDelayLevel && !isSticky) {
                log('suppressed by delay until recursion level', entry.delayUntilRecursion, '. Currently', currentRecursionDelayLevel);
                continue;
            }

            if (scanState === scan_state.RECURSION && world_info_recursive && entry.excludeRecursion && !isSticky) {
                log('suppressed by exclude recursion');
                continue;
            }

            if (entry.decorators.includes('@@activate')) {
                log('activated by @@activate decorator');
                activatedNow.add(entry);
                continue;
            }

            if (entry.decorators.includes('@@dont_activate')) {
                log('suppressed by @@dont_activate decorator');
                continue;
            }

            // Now do checks for immediate activations
            if (entry.constant) {
                log('activated because of constant');
                activatedNow.add(entry);
                continue;
            }

            if (buffer.isExternallyActivated(entry)) {
                log('externally activated');
                activatedNow.add(entry);
                continue;
            }

            if (isSticky) {
                log('activated because active sticky');
                activatedNow.add(entry);
                continue;
            }

            if (!Array.isArray(entry.key) || !entry.key.length) {
                log('has no keys defined, skipped');
                continue;
            }

            // Cache the text to scan before the loop, it won't change its content
            const textToScan = buffer.get(entry, scanState);

            // PRIMARY KEYWORDS
            let primaryKeyMatch = entry.key.find(key => {
                const substituted = substituteParams(key);
                return substituted && buffer.matchKeys(textToScan, substituted.trim(), entry);
            });

            if (!primaryKeyMatch) {
                // Don't write logs for simple no-matches
                continue;
            }

            const hasSecondaryKeywords = (
                entry.selective && //all entries are selective now
                Array.isArray(entry.keysecondary) && //always true
                entry.keysecondary.length //ignore empties
            );

            if (!hasSecondaryKeywords) {
                // Handle cases where secondary is empty
                log('activated by primary key match', primaryKeyMatch);
                activatedNow.add(entry);
                continue;
            }


            // SECONDARY KEYWORDS
            const selectiveLogic = entry.selectiveLogic ?? 0; // If selectiveLogic isn't found, assume it's AND, only do this once per entry
            log('Entry with primary key match', primaryKeyMatch, 'has secondary keywords. Checking with logic logic', Object.entries(world_info_logic).find(x => x[1] === entry.selectiveLogic));

            /** @type {() => boolean} */
            function matchSecondaryKeys() {
                let hasAnyMatch = false;
                let hasAllMatch = true;
                for (let keysecondary of entry.keysecondary) {
                    const secondarySubstituted = substituteParams(keysecondary);
                    const hasSecondaryMatch = secondarySubstituted && buffer.matchKeys(textToScan, secondarySubstituted.trim(), entry);

                    if (hasSecondaryMatch) hasAnyMatch = true;
                    if (!hasSecondaryMatch) hasAllMatch = false;

                    // Simplified AND ANY / NOT ALL if statement. (Proper fix for PR#1356 by Bronya)
                    // If AND ANY logic and the main checks pass OR if NOT ALL logic and the main checks do not pass
                    if (selectiveLogic === world_info_logic.AND_ANY && hasSecondaryMatch) {
                        log('activated. (AND ANY) Found match secondary keyword', secondarySubstituted);
                        return true;
                    }
                    if (selectiveLogic === world_info_logic.NOT_ALL && !hasSecondaryMatch) {
                        log('activated. (NOT ALL) Found not matching secondary keyword', secondarySubstituted);
                        return true;
                    }
                }

                // Handle NOT ANY logic
                if (selectiveLogic === world_info_logic.NOT_ANY && !hasAnyMatch) {
                    log('activated. (NOT ANY) No secondary keywords found', entry.keysecondary);
                    return true;
                }

                // Handle AND ALL logic
                if (selectiveLogic === world_info_logic.AND_ALL && hasAllMatch) {
                    log('activated. (AND ALL) All secondary keywords found', entry.keysecondary);
                    return true;
                }

                return false;
            }

            const matched = matchSecondaryKeys();
            if (!matched) {
                log('skipped. Secondary keywords not satisfied', entry.keysecondary);
                continue;
            }

            // Success logging was already done inside the function, so just add the entry
            activatedNow.add(entry);
            continue;
        }

        console.debug(`[WI] Search done. Found ${activatedNow.size} possible entries.`);

        // Sort the entries for the probability and the budget limit checks
        const newEntries = [...activatedNow]
            .sort((a, b) => {
                const isASticky = timedEffects.isEffectActive('sticky', a) ? 1 : 0;
                const isBSticky = timedEffects.isEffectActive('sticky', b) ? 1 : 0;
                return isBSticky - isASticky || sortedEntries.indexOf(a) - sortedEntries.indexOf(b);
            });


        let newContent = '';
        const textToScanTokens = await getTokenCountAsync(allActivatedText);

        filterByInclusionGroups(newEntries, allActivatedEntries, buffer, scanState, timedEffects);

        console.debug('[WI] --- PROBABILITY CHECKS ---');
        !newEntries.length && console.debug('[WI] No probability checks to do');

        for (const entry of newEntries) {
            function verifyProbability() {
                // If we don't need to roll, it's always true
                if (!entry.useProbability || entry.probability === 100) {
                    console.debug(`WI entry ${entry.uid} does not use probability`);
                    return true;
                }

                const isSticky = timedEffects.isEffectActive('sticky', entry);
                if (isSticky) {
                    console.debug(`WI entry ${entry.uid} is sticky, does not need to re-roll probability`);
                    return true;
                }

                const rollValue = Math.random() * 100;
                if (rollValue <= entry.probability) {
                    console.debug(`WI entry ${entry.uid} passed probability check of ${entry.probability}%`);
                    return true;
                }

                failedProbabilityChecks.add(entry);
                return false;
            }

            const success = verifyProbability();
            if (!success) {
                console.debug(`WI entry ${entry.uid} failed probability check, removing from activated entries`, entry);
                continue;
            }

            // Substitute macros inline, for both this checking and also future processing
            entry.content = substituteParams(entry.content);
            newContent += `${entry.content}\n`;

            if ((textToScanTokens + (await getTokenCountAsync(newContent))) >= budget) {
                console.debug('[WI] --- BUDGET OVERFLOW CHECK ---');
                if (world_info_overflow_alert) {
                    console.warn(`[WI] budget of ${budget} reached, stopping after ${allActivatedEntries.size} entries`);
                    toastr.warning(`World info budget reached after ${allActivatedEntries.size} entries.`, 'World Info');
                } else {
                    console.debug(`[WI] budget of ${budget} reached, stopping after ${allActivatedEntries.size} entries`);
                }
                token_budget_overflowed = true;
                break;
            }

            allActivatedEntries.add(entry);
            console.debug(`[WI] Entry ${entry.uid} activation successful, adding to prompt`, entry);
        }

        const successfulNewEntries = newEntries.filter(x => !failedProbabilityChecks.has(x));
        const successfulNewEntriesForRecursion = successfulNewEntries.filter(x => !x.preventRecursion);

        console.debug(`[WI] --- LOOP #${count} RESULT ---`);
        if (!newEntries.length) {
            console.debug('[WI] No new entries activated.');
        } else if (!successfulNewEntries.length) {
            console.debug('[WI] Probability checks failed for all activated entries. No new entries activated.');
        } else {
            console.debug(`[WI] Successfully activated ${successfulNewEntries.length} new entries to prompt. ${allActivatedEntries.size} total entries activated.`, successfulNewEntries);
        }

        function logNextState(...args) {
            args.length && console.debug(args.shift(), ...args);
            console.debug('[WI] Setting scan state', Object.entries(scan_state).find(x => x[1] === scanState));
        }

        // After processing and rolling entries is done, see if we should continue with normal recursion
        if (world_info_recursive && !token_budget_overflowed && successfulNewEntriesForRecursion.length) {
            nextScanState = scan_state.RECURSION;
            logNextState('[WI] Found', successfulNewEntriesForRecursion.length, 'new entries for recursion');
        }

        // If we are inside min activations scan, and we have recursive buffer, we should do a recursive scan before increasing the buffer again
        // There might be recurse-trigger-able entries that match the buffer, so we need to check that
        if (world_info_recursive && !token_budget_overflowed && scanState === scan_state.MIN_ACTIVATIONS && buffer.hasRecurse()) {
            nextScanState = scan_state.RECURSION;
            logNextState('[WI] Min Activations run done, whill will always be followed by a recursive scan');
        }

        // If scanning is planned to stop, but min activations is set and not satisfied, check if we should continue
        const minActivationsNotSatisfied = world_info_min_activations > 0 && (allActivatedEntries.size < world_info_min_activations);
        if (!nextScanState && !token_budget_overflowed && minActivationsNotSatisfied) {
            console.debug('[WI] --- MIN ACTIVATIONS CHECK ---');

            let over_max = (
                world_info_min_activations_depth_max > 0 &&
                buffer.getDepth() > world_info_min_activations_depth_max
            ) || (buffer.getDepth() > chat.length);

            if (!over_max) {
                nextScanState = scan_state.MIN_ACTIVATIONS; // loop
                logNextState(`[WI] Min activations not reached (${allActivatedEntries.size}/${world_info_min_activations}), advancing depth to ${buffer.getDepth() + 1}, starting another scan`);
                buffer.advanceScan();
            } else {
                console.debug(`[WI] Min activations not reached (${allActivatedEntries.size}/${world_info_min_activations}), but reached on of depth. Stopping`);
            }
        }

        // If the scan is done, but we still have open "delay until recursion" levels, we should continue with the next one
        if (nextScanState === scan_state.NONE && availableRecursionDelayLevels.length) {
            nextScanState = scan_state.RECURSION;
            currentRecursionDelayLevel = availableRecursionDelayLevels.shift();
            logNextState('[WI] Open delayed recursion levels left. Preparing next delayed recursion level', currentRecursionDelayLevel, '. Still delayed:', availableRecursionDelayLevels);
        }

        // Final check if we should really continue scan, and extend the current WI recurse buffer
        scanState = nextScanState;
        if (scanState) {
            const text = successfulNewEntriesForRecursion
                .map(x => x.content).join('\n');
            buffer.addRecurse(text);
            allActivatedText = (text + '\n' + allActivatedText);
        } else {
            logNextState('[WI] Scan done. No new entries to prompt. Stopping.');
        }
    }

    console.debug('[WI] --- BUILDING PROMPT ---');

    // Forward-sorted list of entries for joining
    const WIBeforeEntries = [];
    const WIAfterEntries = [];
    const EMEntries = [];
    const ANTopEntries = [];
    const ANBottomEntries = [];
    const WIDepthEntries = [];

    // Appends from insertion order 999 to 1. Use unshift for this purpose
    // TODO (kingbri): Change to use WI Anchor positioning instead of separate top/bottom arrays
    [...allActivatedEntries].sort(sortFn).forEach((entry) => {
        const regexDepth = entry.position === world_info_position.atDepth ? (entry.depth ?? DEFAULT_DEPTH) : null;
        const content = getRegexedString(entry.content, regex_placement.WORLD_INFO, { depth: regexDepth, isMarkdown: false, isPrompt: true });

        if (!content) {
            console.debug(`[WI] Entry ${entry.uid}`, 'skipped adding to prompt due to empty content', entry);
            return;
        }

        switch (entry.position) {
            case world_info_position.before:
                WIBeforeEntries.unshift(content);
                break;
            case world_info_position.after:
                WIAfterEntries.unshift(content);
                break;
            case world_info_position.EMTop:
                EMEntries.unshift(
                    { position: wi_anchor_position.before, content: content },
                );
                break;
            case world_info_position.EMBottom:
                EMEntries.unshift(
                    { position: wi_anchor_position.after, content: content },
                );
                break;
            case world_info_position.ANTop:
                ANTopEntries.unshift(content);
                break;
            case world_info_position.ANBottom:
                ANBottomEntries.unshift(content);
                break;
            case world_info_position.atDepth: {
                const existingDepthIndex = WIDepthEntries.findIndex((e) => e.depth === (entry.depth ?? DEFAULT_DEPTH) && e.role === (entry.role ?? extension_prompt_roles.SYSTEM));
                if (existingDepthIndex !== -1) {
                    WIDepthEntries[existingDepthIndex].entries.unshift(content);
                } else {
                    WIDepthEntries.push({
                        depth: entry.depth,
                        entries: [content],
                        role: entry.role ?? extension_prompt_roles.SYSTEM,
                    });
                }
                break;
            }
            default:
                break;
        }
    });

    const worldInfoBefore = WIBeforeEntries.length ? WIBeforeEntries.join('\n') : '';
    const worldInfoAfter = WIAfterEntries.length ? WIAfterEntries.join('\n') : '';

    if (shouldWIAddPrompt) {
        const originalAN = context.extensionPrompts[NOTE_MODULE_NAME].value;
        const ANWithWI = `${ANTopEntries.join('\n')}\n${originalAN}\n${ANBottomEntries.join('\n')}`.replace(/(^\n)|(\n$)/g, '');
        context.setExtensionPrompt(NOTE_MODULE_NAME, ANWithWI, chat_metadata[metadata_keys.position], chat_metadata[metadata_keys.depth], extension_settings.note.allowWIScan, chat_metadata[metadata_keys.role]);
    }

    !isDryRun && timedEffects.setTimedEffects(Array.from(allActivatedEntries));
    buffer.resetExternalEffects();
    timedEffects.cleanUp();

    console.log(`[WI] Adding ${allActivatedEntries.size} entries to prompt`, Array.from(allActivatedEntries));
    console.debug('[WI] --- DONE ---');

    return { worldInfoBefore, worldInfoAfter, EMEntries, WIDepthEntries, allActivatedEntries };
}

/**
 * Only leaves entries with the highest key matching score in each group.
 * @param {Record<string, WIScanEntry[]>} groups The groups to filter
 * @param {WorldInfoBuffer} buffer The buffer to use for scoring
 * @param {(entry: WIScanEntry) => void} removeEntry The function to remove an entry
 * @param {number} scanState The current scan state
 * @param {Map<string, boolean>} hasStickyMap The sticky entries map
 */
function filterGroupsByScoring(groups, buffer, removeEntry, scanState, hasStickyMap) {
    for (const [key, group] of Object.entries(groups)) {
        // Group scoring is disabled both globally and for the group entries
        if (!world_info_use_group_scoring && !group.some(x => x.useGroupScoring)) {
            console.debug(`[WI] Skipping group scoring for group '${key}'`);
            continue;
        }

        // If the group has any sticky entries, the rest are already removed by the timed effects filter
        const hasAnySticky = hasStickyMap.get(key);
        if (hasAnySticky) {
            console.debug(`[WI] Skipping group scoring check, group '${key}' has sticky entries`);
            continue;
        }

        const scores = group.map(entry => buffer.getScore(entry, scanState));
        const maxScore = Math.max(...scores);
        console.debug(`[WI] Group '${key}' max score:`, maxScore);
        //console.table(group.map((entry, i) => ({ uid: entry.uid, key: JSON.stringify(entry.key), score: scores[i] })));

        for (let i = 0; i < group.length; i++) {
            const isScored = group[i].useGroupScoring ?? world_info_use_group_scoring;

            if (!isScored) {
                continue;
            }

            if (scores[i] < maxScore) {
                console.debug(`[WI] Entry ${group[i].uid}`, `removed as score loser from inclusion group '${key}'`, group[i]);
                removeEntry(group[i]);
                group.splice(i, 1);
                scores.splice(i, 1);
                i--;
            }
        }
    }
}

/**
 * Removes entries on cooldown and forces sticky entries as winners.
 * @param {Record<string, WIScanEntry[]>} groups The groups to filter
 * @param {WorldInfoTimedEffects} timedEffects The timed effects to use
 * @param {(entry: WIScanEntry) => void} removeEntry The function to remove an entry
 * @returns {Map<string, boolean>} If any sticky entries were found
 */
function filterGroupsByTimedEffects(groups, timedEffects, removeEntry) {
    /** @type {Map<string, boolean>} */
    const hasStickyMap = new Map();

    for (const [key, group] of Object.entries(groups)) {
        hasStickyMap.set(key, false);

        // If the group has any sticky entries, leave only the sticky entries
        const stickyEntries = group.filter(x => timedEffects.isEffectActive('sticky', x));
        if (stickyEntries.length) {
            for (const entry of group) {
                if (stickyEntries.includes(entry)) {
                    continue;
                }

                console.debug(`[WI] Entry ${entry.uid}`, `removed as a non-sticky loser from inclusion group '${key}'`, entry);
                removeEntry(entry);
            }

            hasStickyMap.set(key, true);
        }

        // It should not be possible for an entry on cooldown/delay to event get into the grouping phase but @Wolfsblvt told me to leave it here.
        const cooldownEntries = group.filter(x => timedEffects.isEffectActive('cooldown', x));
        if (cooldownEntries.length) {
            console.debug(`[WI] Inclusion group '${key}' has entries on cooldown. They will be removed.`, cooldownEntries);
            for (const entry of cooldownEntries) {
                removeEntry(entry);
            }
        }

        const delayEntries = group.filter(x => timedEffects.isEffectActive('delay', x));
        if (delayEntries.length) {
            console.debug(`[WI] Inclusion group '${key}' has entries with delay. They will be removed.`, delayEntries);
            for (const entry of delayEntries) {
                removeEntry(entry);
            }
        }
    }

    return hasStickyMap;
}

/**
 * Filters entries by inclusion groups.
 * @param {object[]} newEntries Entries activated on current recursion level
 * @param {Set<object>} allActivatedEntries Set of all activated entries
 * @param {WorldInfoBuffer} buffer The buffer to use for scanning
 * @param {number} scanState The current scan state
 * @param {WorldInfoTimedEffects} timedEffects The timed effects currently active
 */
function filterByInclusionGroups(newEntries, allActivatedEntries, buffer, scanState, timedEffects) {
    console.debug('[WI] --- INCLUSION GROUP CHECKS ---');

    const grouped = newEntries.filter(x => x.group).reduce((acc, item) => {
        item.group.split(/,\s*/).filter(x => x).forEach(group => {
            if (!acc[group]) {
                acc[group] = [];
            }
            acc[group].push(item);
        });
        return acc;
    }, {});

    if (Object.keys(grouped).length === 0) {
        console.debug('[WI] No inclusion groups found');
        return;
    }

    const removeEntry = (entry) => newEntries.splice(newEntries.indexOf(entry), 1);
    function removeAllBut(group, chosen, logging = true) {
        for (const entry of group) {
            if (entry === chosen) {
                continue;
            }

            if (logging) console.debug(`[WI] Entry ${entry.uid}`, `removed as loser from inclusion group '${entry.group}'`, entry);
            removeEntry(entry);
        }
    }

    const hasStickyMap = filterGroupsByTimedEffects(grouped, timedEffects, removeEntry);
    filterGroupsByScoring(grouped, buffer, removeEntry, scanState, hasStickyMap);

    for (const [key, group] of Object.entries(grouped)) {
        console.debug(`[WI] Checking inclusion group '${key}' with ${group.length} entries`, group);

        // If the group has any sticky entries, the rest are already removed by the timed effects filter
        const hasAnySticky = hasStickyMap.get(key);
        if (hasAnySticky) {
            console.debug(`[WI] Skipping inclusion group check, group '${key}' has sticky entries`);
            continue;
        }

        if (Array.from(allActivatedEntries).some(x => x.group === key)) {
            console.debug(`[WI] Skipping inclusion group check, group '${key}' was already activated`);
            // We need to forcefully deactivate all other entries in the group
            removeAllBut(group, null, false);
            continue;
        }

        if (!Array.isArray(group) || group.length <= 1) {
            console.debug('[WI] Skipping inclusion group check, only one entry');
            continue;
        }

        // Check for group prio
        const prios = group.filter(x => x.groupOverride).sort(sortFn);
        if (prios.length) {
            console.debug(`[WI] Entry ${prios[0].uid}`, `activated as prio winner from inclusion group '${key}'`, prios[0]);
            removeAllBut(group, prios[0]);
            continue;
        }

        // Do weighted random using entry's weight
        const totalWeight = group.reduce((acc, item) => acc + (item.groupWeight ?? DEFAULT_WEIGHT), 0);
        const rollValue = Math.random() * totalWeight;
        let currentWeight = 0;
        let winner = null;

        for (const entry of group) {
            currentWeight += (entry.groupWeight ?? DEFAULT_WEIGHT);

            if (rollValue <= currentWeight) {
                console.debug(`[WI] Entry ${entry.uid}`, `activated as roll winner from inclusion group '${key}'`, entry);
                winner = entry;
                break;
            }
        }

        if (!winner) {
            console.debug(`[WI] Failed to activate inclusion group '${key}', no winner found`);
            continue;
        }

        // Remove every group item from newEntries but the winner
        removeAllBut(group, winner);
    }
}

function convertAgnaiMemoryBook(inputObj) {
    const outputObj = { entries: {} };

    inputObj.entries.forEach((entry, index) => {
        outputObj.entries[index] = {
            ...newWorldInfoEntryTemplate,
            uid: index,
            key: entry.keywords,
            keysecondary: [],
            comment: entry.name,
            content: entry.entry,
            constant: false,
            selective: false,
            vectorized: false,
            selectiveLogic: world_info_logic.AND_ANY,
            order: entry.weight,
            position: 0,
            disable: !entry.enabled,
            addMemo: !!entry.name,
            excludeRecursion: false,
            delayUntilRecursion: false,
            displayIndex: index,
            probability: 100,
            useProbability: true,
            group: '',
            groupOverride: false,
            groupWeight: DEFAULT_WEIGHT,
            scanDepth: null,
            caseSensitive: null,
            matchWholeWords: null,
            useGroupScoring: null,
            automationId: '',
            role: extension_prompt_roles.SYSTEM,
            sticky: null,
            cooldown: null,
            delay: null,
        };
    });

    return outputObj;
}

function convertRisuLorebook(inputObj) {
    const outputObj = { entries: {} };

    inputObj.data.forEach((entry, index) => {
        outputObj.entries[index] = {
            ...newWorldInfoEntryTemplate,
            uid: index,
            key: entry.key.split(',').map(x => x.trim()),
            keysecondary: entry.secondkey ? entry.secondkey.split(',').map(x => x.trim()) : [],
            comment: entry.comment,
            content: entry.content,
            constant: entry.alwaysActive,
            selective: entry.selective,
            vectorized: false,
            selectiveLogic: world_info_logic.AND_ANY,
            order: entry.insertorder,
            position: world_info_position.before,
            disable: false,
            addMemo: true,
            excludeRecursion: false,
            delayUntilRecursion: false,
            displayIndex: index,
            probability: entry.activationPercent ?? 100,
            useProbability: entry.activationPercent ?? true,
            group: '',
            groupOverride: false,
            groupWeight: DEFAULT_WEIGHT,
            scanDepth: null,
            caseSensitive: null,
            matchWholeWords: null,
            useGroupScoring: null,
            automationId: '',
            role: extension_prompt_roles.SYSTEM,
            sticky: null,
            cooldown: null,
            delay: null,
        };
    });

    return outputObj;
}

function convertNovelLorebook(inputObj) {
    const outputObj = {
        entries: {},
    };

    inputObj.entries.forEach((entry, index) => {
        const displayName = entry.displayName;
        const addMemo = displayName !== undefined && displayName.trim() !== '';

        outputObj.entries[index] = {
            ...newWorldInfoEntryTemplate,
            uid: index,
            key: entry.keys,
            keysecondary: [],
            comment: displayName || '',
            content: entry.text,
            constant: false,
            selective: false,
            vectorized: false,
            selectiveLogic: world_info_logic.AND_ANY,
            order: entry.contextConfig?.budgetPriority ?? 0,
            position: 0,
            disable: !entry.enabled,
            addMemo: addMemo,
            excludeRecursion: false,
            delayUntilRecursion: false,
            displayIndex: index,
            probability: 100,
            useProbability: true,
            group: '',
            groupOverride: false,
            groupWeight: DEFAULT_WEIGHT,
            scanDepth: null,
            caseSensitive: null,
            matchWholeWords: null,
            useGroupScoring: null,
            automationId: '',
            role: extension_prompt_roles.SYSTEM,
            sticky: null,
            cooldown: null,
            delay: null,
        };
    });

    return outputObj;
}

function convertCharacterBook(characterBook) {
    const result = { entries: {}, originalData: characterBook };

    characterBook.entries.forEach((entry, index) => {
        // Not in the spec, but this is needed to find the entry in the original data
        if (entry.id === undefined) {
            entry.id = index;
        }

        result.entries[entry.id] = {
            ...newWorldInfoEntryTemplate,
            uid: entry.id,
            key: entry.keys,
            keysecondary: entry.secondary_keys || [],
            comment: entry.comment || '',
            content: entry.content,
            constant: entry.constant || false,
            selective: entry.selective || false,
            order: entry.insertion_order,
            position: entry.extensions?.position ?? (entry.position === 'before_char' ? world_info_position.before : world_info_position.after),
            excludeRecursion: entry.extensions?.exclude_recursion ?? false,
            preventRecursion: entry.extensions?.prevent_recursion ?? false,
            delayUntilRecursion: entry.extensions?.delay_until_recursion ?? false,
            disable: !entry.enabled,
            addMemo: entry.comment ? true : false,
            displayIndex: entry.extensions?.display_index ?? index,
            probability: entry.extensions?.probability ?? 100,
            useProbability: entry.extensions?.useProbability ?? true,
            depth: entry.extensions?.depth ?? DEFAULT_DEPTH,
            selectiveLogic: entry.extensions?.selectiveLogic ?? world_info_logic.AND_ANY,
            group: entry.extensions?.group ?? '',
            groupOverride: entry.extensions?.group_override ?? false,
            groupWeight: entry.extensions?.group_weight ?? DEFAULT_WEIGHT,
            scanDepth: entry.extensions?.scan_depth ?? null,
            caseSensitive: entry.extensions?.case_sensitive ?? null,
            matchWholeWords: entry.extensions?.match_whole_words ?? null,
            useGroupScoring: entry.extensions?.use_group_scoring ?? null,
            automationId: entry.extensions?.automation_id ?? '',
            role: entry.extensions?.role ?? extension_prompt_roles.SYSTEM,
            vectorized: entry.extensions?.vectorized ?? false,
            sticky: entry.extensions?.sticky ?? null,
            cooldown: entry.extensions?.cooldown ?? null,
            delay: entry.extensions?.delay ?? null,
        };
    });

    return result;
}

export function setWorldInfoButtonClass(chid, forceValue = undefined) {
    if (forceValue !== undefined) {
        $('#set_character_world, #world_button').toggleClass('world_set', forceValue);
        return;
    }

    if (!chid) {
        return;
    }

    const world = characters[chid]?.data?.extensions?.world;
    const worldSet = Boolean(world && world_names.includes(world));
    $('#set_character_world, #world_button').toggleClass('world_set', worldSet);
}

export function checkEmbeddedWorld(chid) {
    $('#import_character_info').hide();

    if (chid === undefined) {
        return false;
    }

    if (characters[chid]?.data?.character_book) {
        $('#import_character_info').data('chid', chid).show();

        // Only show the alert once per character
        const checkKey = `AlertWI_${characters[chid].avatar}`;
        const worldName = characters[chid]?.data?.extensions?.world;
        if (!localStorage.getItem(checkKey) && (!worldName || !world_names.includes(worldName))) {
            localStorage.setItem(checkKey, 'true');

            if (power_user.world_import_dialog) {
                const html = `<h3>This character has an embedded World/Lorebook.</h3>
                <h3>Would you like to import it now?</h3>
                <div class="m-b-1">If you want to import it later, select "Import Card Lore" in the "More..." dropdown menu on the character panel.</div>`;
                const checkResult = (result) => {
                    if (result) {
                        importEmbeddedWorldInfo(true);
                    }
                };
                callGenericPopup(html, POPUP_TYPE.CONFIRM, '', { okButton: 'Yes' }).then(checkResult);
            }
            else {
                toastr.info(
                    'To import and use it, select "Import Card Lore" in the "More..." dropdown menu on the character panel.',
                    `${characters[chid].name} has an embedded World/Lorebook`,
                    { timeOut: 5000, extendedTimeOut: 10000, positionClass: 'toast-top-center' },
                );
            }
        }
        return true;
    }

    return false;
}

export async function importEmbeddedWorldInfo(skipPopup = false) {
    const chid = $('#import_character_info').data('chid');

    if (chid === undefined) {
        return;
    }

    const bookName = characters[chid]?.data?.character_book?.name || `${characters[chid]?.name}'s Lorebook`;

    if (!skipPopup) {
        const confirmation = await Popup.show.confirm(`Are you sure you want to import "${bookName}"?`, world_names.includes(bookName) ? 'It will overwrite the World/Lorebook with the same name.' : '');
        if (!confirmation) {
            return;
        }
    }

    const convertedBook = convertCharacterBook(characters[chid].data.character_book);

    await saveWorldInfo(bookName, convertedBook, true);
    await updateWorldInfoList();
    $('#character_world').val(bookName).trigger('change');

    toastr.success(`The world "${bookName}" has been imported and linked to the character successfully.`, 'World/Lorebook imported');

    const newIndex = world_names.indexOf(bookName);
    if (newIndex >= 0) {
        //show&draw the WI panel before..
        $('#WIDrawerIcon').trigger('click');
        //..auto-opening the new imported WI
        $('#world_editor_select').val(newIndex).trigger('change');
    }

    setWorldInfoButtonClass(chid, true);
}

export function onWorldInfoChange(args, text) {
    if (args !== '__notSlashCommand__') { // if it's a slash command
        const silent = isTrueBoolean(args.silent);
        if (text.trim() !== '') { // and args are provided
            const slashInputSplitText = text.trim().toLowerCase().split(',');

            slashInputSplitText.forEach((worldName) => {
                const wiElement = getWIElement(worldName);
                if (wiElement.length > 0) {
                    const name = wiElement.text();
                    switch (args.state) {
                        case 'off': {
                            if (selected_world_info.includes(name)) {
                                selected_world_info.splice(selected_world_info.indexOf(name), 1);
                                wiElement.prop('selected', false);
                                if (!silent) toastr.success(`Deactivated world: ${name}`);
                            } else {
                                if (!silent) toastr.error(`World was not active: ${name}`);
                            }
                            break;
                        }
                        case 'toggle': {
                            if (selected_world_info.includes(name)) {
                                selected_world_info.splice(selected_world_info.indexOf(name), 1);
                                wiElement.prop('selected', false);
                                if (!silent) toastr.success(`Deactivated world: ${name}`);
                            } else {
                                selected_world_info.push(name);
                                wiElement.prop('selected', true);
                                if (!silent) toastr.success(`Activated world: ${name}`);
                            }
                            break;
                        }
                        case 'on':
                        default: {
                            selected_world_info.push(name);
                            wiElement.prop('selected', true);
                            if (!silent) toastr.success(`Activated world: ${name}`);
                        }
                    }
                } else {
                    if (!silent) toastr.error(`No world found named: ${worldName}`);
                }
            });
            $('#world_info').trigger('change');
        } else { // if no args, unset all worlds
            if (!silent) toastr.success('Deactivated all worlds');
            selected_world_info = [];
            $('#world_info').val(null).trigger('change');
        }
    } else { //if it's a pointer selection
        const tempWorldInfo = [];
        const val = $('#world_info').val();
        const selectedWorlds = (Array.isArray(val) ? val : [val]).map((e) => Number(e)).filter((e) => !isNaN(e));
        if (selectedWorlds.length > 0) {
            selectedWorlds.forEach((worldIndex) => {
                const existingWorldName = world_names[worldIndex];
                if (existingWorldName) {
                    tempWorldInfo.push(existingWorldName);
                } else {
                    const wiElement = getWIElement(existingWorldName);
                    wiElement.prop('selected', false);
                    toastr.error(`The world with ${existingWorldName} is invalid or corrupted.`);
                }
            });
        }
        selected_world_info = tempWorldInfo;
    }

    saveSettingsDebounced();
    eventSource.emit(event_types.WORLDINFO_SETTINGS_UPDATED);
    return '';
}

export async function importWorldInfo(file) {
    if (!file) {
        return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    try {
        let jsonData;

        if (file.name.endsWith('.png')) {
            const buffer = new Uint8Array(await getFileBuffer(file));
            jsonData = extractDataFromPng(buffer, 'naidata');
        } else {
            // File should be a JSON file
            jsonData = await parseJsonFile(file);
        }

        if (jsonData === undefined || jsonData === null) {
            toastr.error(`File is not valid: ${file.name}`);
            return;
        }

        // Convert Novel Lorebook
        if (jsonData.lorebookVersion !== undefined) {
            console.log('Converting Novel Lorebook');
            formData.append('convertedData', JSON.stringify(convertNovelLorebook(jsonData)));
        }

        // Convert Agnai Memory Book
        if (jsonData.kind === 'memory') {
            console.log('Converting Agnai Memory Book');
            formData.append('convertedData', JSON.stringify(convertAgnaiMemoryBook(jsonData)));
        }

        // Convert Risu Lorebook
        if (jsonData.type === 'risu') {
            console.log('Converting Risu Lorebook');
            formData.append('convertedData', JSON.stringify(convertRisuLorebook(jsonData)));
        }
    } catch (error) {
        toastr.error(`Error parsing file: ${error}`);
        return;
    }

    const worldName = file.name.substr(0, file.name.lastIndexOf('.'));
    const sanitizedWorldName = await getSanitizedFilename(worldName);
    const allowed = await checkOverwriteExistingData('World Info', world_names, sanitizedWorldName, { interactive: true, actionName: 'Import', deleteAction: (existingName) => deleteWorldInfo(existingName) });
    if (!allowed) {
        return false;
    }

    jQuery.ajax({
        type: 'POST',
        url: '/api/worldinfo/import',
        data: formData,
        beforeSend: () => { },
        cache: false,
        contentType: false,
        processData: false,
        success: async function (data) {
            if (data.name) {
                await updateWorldInfoList();

                const newIndex = world_names.indexOf(data.name);
                if (newIndex >= 0) {
                    $('#world_editor_select').val(newIndex).trigger('change');
                }

                toastr.success(`World Info "${data.name}" imported successfully!`);
            }
        },
        error: (_jqXHR, _exception) => { },
    });
}

export function assignLorebookToChat() {
    const selectedName = chat_metadata[METADATA_KEY];
    const template = $('#chat_world_template .chat_world').clone();

    const worldSelect = template.find('select');
    const chatName = template.find('.chat_name');
    chatName.text(getCurrentChatId());

    for (const worldName of world_names) {
        const option = document.createElement('option');
        option.value = worldName;
        option.innerText = worldName;
        option.selected = selectedName === worldName;
        worldSelect.append(option);
    }

    worldSelect.on('change', function () {
        const worldName = $(this).val();

        if (worldName) {
            chat_metadata[METADATA_KEY] = worldName;
            $('.chat_lorebook_button').addClass('world_set');
        } else {
            delete chat_metadata[METADATA_KEY];
            $('.chat_lorebook_button').removeClass('world_set');
        }

        saveMetadata();
    });

    callPopup(template, 'text');
}

jQuery(() => {

    $('#world_info').on('mousedown change', async function (e) {
        // If there's no world names, don't do anything
        if (world_names.length === 0) {
            e.preventDefault();
            return;
        }

        onWorldInfoChange('__notSlashCommand__');
    });

    //**************************WORLD INFO IMPORT EXPORT*************************//
    $('#world_import_button').on('click', function () {
        $('#world_import_file').trigger('click');
    });

    $('#world_import_file').on('change', async function (e) {
        if (!(e.target instanceof HTMLInputElement)) {
            return;
        }

        const file = e.target.files[0];

        await importWorldInfo(file);

        // Will allow to select the same file twice in a row
        e.target.value = '';
    });

    $('#world_create_button').on('click', async () => {
        const tempName = getFreeWorldName();
        const finalName = await Popup.show.input('Create a new World Info', 'Enter a name for the new file:', tempName);

        if (finalName) {
            await createNewWorldInfo(finalName, { interactive: true });
        }
    });

    $('#world_editor_select').on('change', async () => {
        $('#world_info_search').val('');
        worldInfoFilter.setFilterData(FILTER_TYPES.WORLD_INFO_SEARCH, '', true);
        const selectedIndex = String($('#world_editor_select').find(':selected').val());

        if (selectedIndex === '') {
            hideWorldEditor();
        } else {
            const worldName = world_names[selectedIndex];
            showWorldEditor(worldName);
        }
    });

    const saveSettings = () => {
        saveSettingsDebounced();
        eventSource.emit(event_types.WORLDINFO_SETTINGS_UPDATED);
    };

    $('#world_info_depth').on('input', function () {
        world_info_depth = Number($(this).val());
        $('#world_info_depth_counter').val($(this).val());
        saveSettings();
    });

    $('#world_info_min_activations').on('input', function () {
        world_info_min_activations = Number($(this).val());
        $('#world_info_min_activations_counter').val(world_info_min_activations);

        if (world_info_min_activations !== 0 && world_info_max_recursion_steps !== 0) {
            $('#world_info_max_recursion_steps').val(0).trigger('input');
            flashHighlight($('#world_info_max_recursion_steps').parent()); // flash the other control to show it has changed
            console.info('[WI] Max recursion steps set to 0, as min activations is set to', world_info_min_activations);
        } else {
            saveSettings();
        }
    });

    $('#world_info_min_activations_depth_max').on('input', function () {
        world_info_min_activations_depth_max = Number($(this).val());
        $('#world_info_min_activations_depth_max_counter').val($(this).val());
        saveSettings();
    });

    $('#world_info_budget').on('input', function () {
        world_info_budget = Number($(this).val());
        $('#world_info_budget_counter').val($(this).val());
        saveSettings();
    });

    $('#world_info_include_names').on('input', function () {
        world_info_include_names = !!$(this).prop('checked');
        saveSettings();
    });

    $('#world_info_recursive').on('input', function () {
        world_info_recursive = !!$(this).prop('checked');
        saveSettings();
    });

    $('#world_info_case_sensitive').on('input', function () {
        world_info_case_sensitive = !!$(this).prop('checked');
        saveSettings();
    });

    $('#world_info_match_whole_words').on('input', function () {
        world_info_match_whole_words = !!$(this).prop('checked');
        saveSettings();
    });

    $('#world_info_character_strategy').on('change', function () {
        world_info_character_strategy = Number($(this).val());
        saveSettings();
    });

    $('#world_info_overflow_alert').on('change', function () {
        world_info_overflow_alert = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#world_info_use_group_scoring').on('change', function () {
        world_info_use_group_scoring = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#world_info_budget_cap').on('input', function () {
        world_info_budget_cap = Number($(this).val());
        $('#world_info_budget_cap_counter').val(world_info_budget_cap);
        saveSettings();
    });

    $('#world_info_max_recursion_steps').on('input', function () {
        world_info_max_recursion_steps = Number($(this).val());
        $('#world_info_max_recursion_steps_counter').val(world_info_max_recursion_steps);
        if (world_info_max_recursion_steps !== 0 && world_info_min_activations !== 0) {
            $('#world_info_min_activations').val(0).trigger('input');
            flashHighlight($('#world_info_min_activations').parent()); // flash the other control to show it has changed
            console.info('[WI] Min activations set to 0, as max recursion steps is set to', world_info_max_recursion_steps);
        } else {
            saveSettings();
        }
    });

    $('#world_button').on('click', async function (event) {
        const chid = $('#set_character_world').data('chid');

        if (chid) {
            const worldName = characters[chid]?.data?.extensions?.world;
            const hasEmbed = checkEmbeddedWorld(chid);
            if (worldName && world_names.includes(worldName) && !event.shiftKey) {
                if (!$('#WorldInfo').is(':visible')) {
                    $('#WIDrawerIcon').trigger('click');
                }
                const index = world_names.indexOf(worldName);
                $('#world_editor_select').val(index).trigger('change');
            } else if (hasEmbed && !event.shiftKey) {
                await importEmbeddedWorldInfo();
                saveCharacterDebounced();
            }
            else {
                $('#char-management-dropdown').val($('#set_character_world').val()).trigger('change');
            }
        }
    });

    const debouncedWorldInfoSearch = debounce((searchQuery) => {
        worldInfoFilter.setFilterData(FILTER_TYPES.WORLD_INFO_SEARCH, searchQuery);
    });
    $('#world_info_search').on('input', function () {
        const searchQuery = $(this).val();
        debouncedWorldInfoSearch(searchQuery);
    });

    $('#world_refresh').on('click', () => {
        updateEditor(navigation_option.previous);
    });

    $('#world_info_sort_order').on('change', function () {
        const value = String($(this).find(':selected').val());
        // Save sort order, but do not save search sorting, as this is a temporary sorting option
        if (value !== 'search') localStorage.setItem(SORT_ORDER_KEY, value);
        updateEditor(navigation_option.none);
    });

    $(document).on('click', '.chat_lorebook_button', assignLorebookToChat);

    // Not needed on mobile
    if (!isMobile()) {
        $('#world_info').select2({
            width: '100%',
            placeholder: 'No Worlds active. Click here to select.',
            allowClear: true,
            closeOnSelect: false,
        });

        // Subscribe world loading to the select2 multiselect items (We need to target the specific select2 control)
        select2ChoiceClickSubscribe($('#world_info'), target => {
            const name = $(target).text();
            const selectedIndex = world_names.indexOf(name);
            if (selectedIndex !== -1) {
                $('#world_editor_select').val(selectedIndex).trigger('change');
                console.log('Quick selection of world', name);
            }
        }, { buttonStyle: true, closeDrawer: true });
    }

    $('#WorldInfo').on('scroll', () => {
        $('.world_entry input[name="group"], .world_entry input[name="automationId"]').each((_, el) => {
            const instance = $(el).autocomplete('instance');

            if (instance !== undefined) {
                $(el).autocomplete('close');
            }
        });
    });
});
