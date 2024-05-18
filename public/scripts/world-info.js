import { saveSettings, callPopup, substituteParams, getRequestHeaders, chat_metadata, this_chid, characters, saveCharacterDebounced, menu_type, eventSource, event_types, getExtensionPromptByName, saveMetadata, getCurrentChatId, extension_prompt_roles } from '../script.js';
import { download, debounce, initScrollHeight, resetScrollHeight, parseJsonFile, extractDataFromPng, getFileBuffer, getCharaFilename, getSortableDelay, escapeRegex, PAGINATION_TEMPLATE, navigation_option, waitUntilCondition, isTrueBoolean, setValueByPath, flashHighlight, select2ModifyOptions, getSelect2OptionId, dynamicSelect2DataViaAjax, highlightRegex, select2ChoiceClickSubscribe, isFalseBoolean } from './utils.js';
import { extension_settings, getContext } from './extensions.js';
import { NOTE_MODULE_NAME, metadata_keys, shouldWIAddPrompt } from './authors-note.js';
import { isMobile } from './RossAscends-mods.js';
import { FILTER_TYPES, FilterHelper } from './filters.js';
import { getTokenCountAsync } from './tokenizers.js';
import { power_user } from './power-user.js';
import { getTagKeyForEntity } from './tags.js';
import { resolveVariable } from './variables.js';
import { debounce_timeout } from './constants.js';
import { getRegexedString, regex_placement } from './extensions/regex/engine.js';
import { SlashCommandParser } from './slash-commands/SlashCommandParser.js';
import { SlashCommand } from './slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from './slash-commands/SlashCommandArgument.js';

export {
    world_info,
    world_info_budget,
    world_info_depth,
    world_info_min_activations,
    world_info_min_activations_depth_max,
    world_info_recursive,
    world_info_overflow_alert,
    world_info_case_sensitive,
    world_info_match_whole_words,
    world_info_character_strategy,
    world_info_budget_cap,
    world_names,
    checkWorldInfo,
    deleteWorldInfo,
    setWorldInfoSettings,
    getWorldInfoPrompt,
};

const world_info_insertion_strategy = {
    evenly: 0,
    character_first: 1,
    global_first: 2,
};

const world_info_logic = {
    AND_ANY: 0,
    NOT_ALL: 1,
    NOT_ANY: 2,
    AND_ALL: 3,
};

const WI_ENTRY_EDIT_TEMPLATE = $('#entry_edit_template .world_entry');

let world_info = {};
let selected_world_info = [];
let world_names;
let world_info_depth = 2;
let world_info_min_activations = 0; // if > 0, will continue seeking chat until minimum world infos are activated
let world_info_min_activations_depth_max = 0; // used when (world_info_min_activations > 0)

let world_info_budget = 25;
let world_info_recursive = false;
let world_info_overflow_alert = false;
let world_info_case_sensitive = false;
let world_info_match_whole_words = false;
let world_info_use_group_scoring = false;
let world_info_character_strategy = world_info_insertion_strategy.character_first;
let world_info_budget_cap = 0;
const saveWorldDebounced = debounce(async (name, data) => await _save(name, data), debounce_timeout.relaxed);
const saveSettingsDebounced = debounce(() => {
    Object.assign(world_info, { globalSelect: selected_world_info });
    saveSettings();
}, debounce_timeout.relaxed);
const sortFn = (a, b) => b.order - a.order;
let updateEditor = (navigation, flashOnNav = true) => { console.debug('Triggered WI navigation', navigation, flashOnNav); };

// Do not optimize. updateEditor is a function that is updated by the displayWorldEntries with new data.
const worldInfoFilter = new FilterHelper(() => updateEditor());
const SORT_ORDER_KEY = 'world_info_sort_order';
const METADATA_KEY = 'world_info';

const DEFAULT_DEPTH = 4;
const DEFAULT_WEIGHT = 100;
const MAX_SCAN_DEPTH = 1000;

/**
 * Represents a scanning buffer for one evaluation of World Info.
 */
class WorldInfoBuffer {
    // Typedef area
    /**
     * @typedef {object} WIScanEntry The entry that triggered the scan
     * @property {number} [scanDepth] The depth of the scan
     * @property {boolean} [caseSensitive] If the scan is case sensitive
     * @property {boolean} [matchWholeWords] If the scan should match whole words
     * @property {boolean} [useGroupScoring] If the scan should use group scoring
     * @property {number} [uid] The UID of the entry that triggered the scan
     * @property {string[]} [key] The primary keys to scan for
     * @property {string[]} [keysecondary] The secondary keys to scan for
     * @property {number} [selectiveLogic] The logic to use for selective activation
     */
    // End typedef area

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
     * @type {number} The skew of the global scan depth. Used in "min activations"
     */
    #skew = 0;

    /**
     * @type {number} The starting depth of the global scan depth. Incremented by "min activations" feature to not repeat scans. When > 0 it means a complete scan was done up to #startDepth already, and `advanceScanPosition` was called.
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
     * @returns {string} A slice of buffer until the given depth (inclusive)
     */
    get(entry) {
        let depth = entry.scanDepth ?? this.getDepth();
        if (depth <= this.#startDepth) {
            return '';
        }

        if (depth < 0) {
            console.error(`Invalid WI scan depth ${depth}. Must be >= 0`);
            return '';
        }

        if (depth > MAX_SCAN_DEPTH) {
            console.warn(`Invalid WI scan depth ${depth}. Truncating to ${MAX_SCAN_DEPTH}`);
            depth = MAX_SCAN_DEPTH;
        }

        let result = this.#depthBuffer.slice(this.#startDepth, depth).join('\n');

        if (this.#recurseBuffer.length > 0) {
            result += '\n' + this.#recurseBuffer.join('\n');
        }

        return this.#transformString(result, entry);
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
     * Increments skew and sets startDepth to previous depth.
     */
    advanceScanPosition() {
        this.#startDepth = this.getDepth();
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
     * Clears the force activations buffer.
     */
    cleanExternalActivations() {
        WorldInfoBuffer.externalActivations.splice(0, WorldInfoBuffer.externalActivations.length);
    }

    /**
     * Gets the match score for the given entry.
     * @param {WIScanEntry} entry Entry to check
     * @returns {number} The number of key activations for the given entry
     */
    getScore(entry) {
        const bufferState = this.get(entry);
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

export function getWorldInfoSettings() {
    return {
        world_info,
        world_info_depth,
        world_info_min_activations,
        world_info_min_activations_depth_max,
        world_info_budget,
        world_info_recursive,
        world_info_overflow_alert,
        world_info_case_sensitive,
        world_info_match_whole_words,
        world_info_character_strategy,
        world_info_budget_cap,
        world_info_use_group_scoring,
    };
}

const world_info_position = {
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

const worldInfoCache = {};

/**
 * Gets the world info based on chat messages.
 * @param {string[]} chat The chat messages to scan.
 * @param {number} maxContext The maximum context size of the generation.
 * @param {boolean} isDryRun If true, the function will not emit any events.
 * @typedef {{worldInfoString: string, worldInfoBefore: string, worldInfoAfter: string, worldInfoExamples: any[], worldInfoDepth: any[]}} WIPromptResult
 * @returns {Promise<WIPromptResult>} The world info string and depth.
 */
async function getWorldInfoPrompt(chat, maxContext, isDryRun) {
    let worldInfoString = '', worldInfoBefore = '', worldInfoAfter = '';

    const activatedWorldInfo = await checkWorldInfo(chat, maxContext);
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

function setWorldInfoSettings(settings, data) {
    if (settings.world_info_depth !== undefined)
        world_info_depth = Number(settings.world_info_depth);
    if (settings.world_info_min_activations !== undefined)
        world_info_min_activations = Number(settings.world_info_min_activations);
    if (settings.world_info_min_activations_depth_max !== undefined)
        world_info_min_activations_depth_max = Number(settings.world_info_min_activations_depth_max);
    if (settings.world_info_budget !== undefined)
        world_info_budget = Number(settings.world_info_budget);
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

    $('#world_info_recursive').prop('checked', world_info_recursive);
    $('#world_info_overflow_alert').prop('checked', world_info_overflow_alert);
    $('#world_info_case_sensitive').prop('checked', world_info_case_sensitive);
    $('#world_info_match_whole_words').prop('checked', world_info_match_whole_words);
    $('#world_info_use_group_scoring').prop('checked', world_info_use_group_scoring);

    $(`#world_info_character_strategy option[value='${world_info_character_strategy}']`).prop('selected', true);
    $('#world_info_character_strategy').val(world_info_character_strategy);

    $('#world_info_budget_cap').val(world_info_budget_cap);
    $('#world_info_budget_cap_counter').val(world_info_budget_cap);

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

    eventSource.on(event_types.CHAT_CHANGED, () => {
        const hasWorldInfo = !!chat_metadata[METADATA_KEY] && world_names.includes(chat_metadata[METADATA_KEY]);
        $('.chat_lorebook_button').toggleClass('world_set', hasWorldInfo);
    });

    eventSource.on(event_types.WORLDINFO_FORCE_ACTIVATE, (entries) => {
        WorldInfoBuffer.externalActivations.push(...entries);
    });

    // Add slash commands
    registerWorldInfoSlashCommands();
}

function registerWorldInfoSlashCommands() {
    function reloadEditor(file) {
        const selectedIndex = world_names.indexOf(file);
        if (selectedIndex !== -1) {
            $('#world_editor_select').val(selectedIndex).trigger('change');
        }
    }

    async function getEntriesFromFile(file) {
        if (!file || !world_names.includes(file)) {
            toastr.warning('Valid World Info file name is required');
            return '';
        }

        const data = await loadWorldInfoData(file);

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
        const file = resolveVariable(args.file);
        const field = args.field || 'key';

        const entries = await getEntriesFromFile(file);

        if (!entries) {
            return '';
        }

        if (typeof newEntryTemplate[field] === 'boolean') {
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
        const file = resolveVariable(args.file);
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

        if (newEntryTemplate[field] === undefined) {
            toastr.warning('Valid field name is required');
            return '';
        }

        const fieldValue = entry[field];

        if (fieldValue === undefined) {
            return '';
        }

        if (Array.isArray(fieldValue)) {
            return fieldValue.map(x => substituteParams(x)).join(', ');
        }

        return substituteParams(String(fieldValue));
    }

    async function createEntryCallback(args, content) {
        const file = resolveVariable(args.file);
        const key = args.key;

        const data = await loadWorldInfoData(file);

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

        await saveWorldInfo(file, data, true);
        reloadEditor(file);

        return entry.uid;
    }

    async function setEntryFieldCallback(args, value) {
        const file = resolveVariable(args.file);
        const uid = resolveVariable(args.uid);
        const field = args.field || 'content';

        if (value === undefined) {
            toastr.warning('Value is required');
            return '';
        }

        value = value.replace(/\\([{}|])/g, '$1');

        const data = await loadWorldInfoData(file);

        if (!data || !('entries' in data)) {
            toastr.warning('Valid World Info file name is required');
            return '';
        }

        const entry = data.entries[uid];

        if (!entry) {
            toastr.warning('Valid UID is required');
            return '';
        }

        if (newEntryTemplate[field] === undefined) {
            toastr.warning('Valid field name is required');
            return '';
        }

        if (Array.isArray(entry[field])) {
            entry[field] = value.split(',').map(x => x.trim()).filter(x => x);
        } else if (typeof entry[field] === 'boolean') {
            entry[field] = isTrueBoolean(value);
        } else if (typeof entry[field] === 'number') {
            entry[field] = Number(value);
        } else {
            entry[field] = value;
        }

        if (originalDataKeyMap[field]) {
            setOriginalDataValue(data, uid, originalDataKeyMap[field], entry[field]);
        }

        await saveWorldInfo(file, data, true);
        reloadEditor(file);
        return '';
    }

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'world',
        callback: onWorldInfoChange,
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'state', 'set world state', [ARGUMENT_TYPE.STRING], false, false, null, ['off', 'toggle'],
            ),
            new SlashCommandNamedArgument(
                'silent', 'suppress toast messages', [ARGUMENT_TYPE.BOOLEAN], false,
            ),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'name', [ARGUMENT_TYPE.STRING], false,
            ),
        ],
        helpString: `
            <div>
                Sets active World, or unsets if no args provided, use <code>state=off</code> and <code>state=toggle</code> to deactivate or toggle a World, use <code>silent=true</code> to suppress toast messages.
            </div>
        `,
        aliases: [],
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'getchatbook',
        callback: getChatBookCallback,
        returns: 'lorebook name',
        helpString: 'Get a name of the chat-bound lorebook or create a new one if was unbound, and pass it down the pipe.',
        aliases: ['getchatlore', 'getchatwi'],
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'findentry',
        aliases: ['findlore', 'findwi'],
        returns: 'UID',
        callback: findBookEntryCallback,
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'file', 'bookName', ARGUMENT_TYPE.STRING, true,
            ),
            new SlashCommandNamedArgument(
                'field', 'field value for fuzzy match (default: key)', ARGUMENT_TYPE.STRING, false, false, 'key',
            ),
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
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'getentryfield',
        aliases: ['getlorefield', 'getwifield'],
        callback: getEntryFieldCallback,
        returns: 'field value',
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'file', 'bookName', ARGUMENT_TYPE.STRING, true,
            ),
            new SlashCommandNamedArgument(
                'field', 'field to retrieve (default: content)', ARGUMENT_TYPE.STRING, false, false, 'content',
            ),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'UID', ARGUMENT_TYPE.STRING, true,
            ),
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
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'createentry',
        callback: createEntryCallback,
        aliases: ['createlore', 'createwi'],
        returns: 'UID of the new record',
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'file', 'book name', [ARGUMENT_TYPE.STRING], true,
            ),
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
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'setentryfield',
        callback: setEntryFieldCallback,
        aliases: ['setlorefield', 'setwifield'],
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'file', 'book name', [ARGUMENT_TYPE.STRING], true,
            ),
            new SlashCommandNamedArgument(
                'uid', 'record UID', [ARGUMENT_TYPE.STRING], true,
            ),
            new SlashCommandNamedArgument(
                'field', 'field name', [ARGUMENT_TYPE.STRING], true, false, 'content',
            ),
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

}

// World Info Editor
async function showWorldEditor(name) {
    if (!name) {
        hideWorldEditor();
        return;
    }

    const wiData = await loadWorldInfoData(name);
    displayWorldEntries(name, wiData);
}

async function loadWorldInfoData(name) {
    if (!name) {
        return;
    }

    if (worldInfoCache[name]) {
        return worldInfoCache[name];
    }

    const response = await fetch('/api/worldinfo/get', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ name: name }),
        cache: 'no-cache',
    });

    if (response.ok) {
        const data = await response.json();
        worldInfoCache[name] = data;
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
 * @param {any[]} data WI entries
 * @returns {any[]} Sorted data
 */
function sortEntries(data) {
    const option = $('#world_info_sort_order').find(':selected');
    const sortField = option.data('field');
    const sortOrder = option.data('order');
    const sortRule = option.data('rule');
    const orderSign = sortOrder === 'asc' ? 1 : -1;

    if (!data.length) return data;

    // If we have a search term for WI, we are sorting by weighting scores
    if (sortRule === 'search') {
        data.sort((a, b) => {
            const aScore = worldInfoFilter.getScore(FILTER_TYPES.WORLD_INFO_SEARCH, a.uid);
            const bScore = worldInfoFilter.getScore(FILTER_TYPES.WORLD_INFO_SEARCH, b.uid);
            return (aScore - bScore);
        });
    }
    else if (sortRule === 'custom') {
        // First by display index, then by order, then by uid
        data.sort((a, b) => {
            const aValue = a.displayIndex;
            const bValue = b.displayIndex;

            return (aValue - bValue || b.order - a.order || a.uid - b.uid);
        });
    } else if (sortRule === 'priority') {
        // First constant, then normal, then disabled. Then sort by order
        data.sort((a, b) => {
            const aValue = a.constant ? 0 : a.disable ? 2 : 1;
            const bValue = b.constant ? 0 : b.disable ? 2 : 1;

            return (aValue - bValue || b.order - a.order);
        });
    } else {
        const primarySort = (a, b) => {
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
        const secondarySort = (a, b) => a.order - b.order;
        const tertiarySort = (a, b) => a.uid - b.uid;

        data.sort((a, b) => {
            const primary = primarySort(a, b);

            if (primary !== 0) {
                return primary;
            }

            const secondary = secondarySort(a, b);

            if (secondary !== 0) {
                return secondary;
            }

            return tertiarySort(a, b);
        });
    }

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
        entriesArray = sortEntries(entriesArray);

        // Cache keys
        const keys = entriesArray.flatMap(entry => [...entry.key, ...entry.keysecondary]);
        updateWorldEntryKeyOptionsCache(keys, { reset: true });

        // Run the callback for printing this
        typeof callback === 'function' && callback(entriesArray);
        return entriesArray;
    }

    let startPage = 1;

    if (navigation === navigation_option.previous) {
        startPage = $('#world_info_pagination').pagination('getCurrentPageNum');
    }

    const storageKey = 'WI_PerPage';
    const perPageDefault = 25;
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
        callback: function (/** @type {object[]} */ page) {
            // We save costly performance by removing all events before emptying. Because we know there are no relevant event handlers reacting on removing elements
            // This prevents jQuery from actually going through all registered events on the controls for each entry when removing it
            worldEntriesList.find('*').off();
            worldEntriesList.empty();

            const keywordHeaders = `
            <div id="WIEntryHeaderTitlesPC" class="flex-container wide100p spaceBetween justifyCenter textAlignCenter" style="padding:0 4.5em;">
            <small class="flex1">
            Title/Memo
        </small>
                <small style="width: calc(3.5em + 15px)">
                    Status
                </small>
                <small style="width: calc(3.5em + 30px)">
                    Position
                </small>
                <small style="width: calc(3.5em + 20px)">
                    Depth
                </small>
                <small style="width: calc(3.5em + 20px)">
                    Order
                </small>
                <small style="width: calc(3.5em + 15px)">
                    Trigger %
                </small>
            </div>`;
            const blocks = page.map(entry => getWorldEntry(name, data, entry)).filter(x => x);
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
        const data = getDataArray();
        const uidIndex = data.findIndex(x => x.uid === navigation);
        const perPage = Number(localStorage.getItem(storageKey)) || perPageDefault;
        const page = Math.floor(uidIndex / perPage) + 1;
        $('#world_info_pagination').pagination('go', page);
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
                setOriginalDataValue(data, entry.uid, 'comment', entry.comment);
                counter++;
            }
        }

        if (counter > 0) {
            toastr.info(`Backfilled ${counter} titles`);
            await saveWorldInfo(name, data, true);
            updateEditor(navigation_option.previous);
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
        const finalName = await callPopup('<h3>Create a new World Info?</h3>Enter a name for the new file:', 'input', tempName);

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

    $('#world_popup_delete').off('click').on('click', async () => {
        const confirmation = await callPopup(`<h3>Delete the World/Lorebook: "${name}"?</h3>This action is irreversible!`, 'confirm');

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
                setOriginalDataValue(data, uid, 'extensions.display_index', item.displayIndex);
            });

            console.table(Object.keys(data.entries).map(uid => data.entries[uid]).map(x => ({ uid: x.uid, key: x.key.join(','), displayIndex: x.displayIndex })));

            await saveWorldInfo(name, data, true);
        },
    });
    //$("#world_popup_entries_list").disableSelection();
}

const originalDataKeyMap = {
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

function setOriginalDataValue(data, uid, key, value) {
    if (data.originalData && Array.isArray(data.originalData.entries)) {
        let originalEntry = data.originalData.entries.find(x => x.uid === uid);

        if (!originalEntry) {
            return;
        }

        setValueByPath(originalEntry, key, value);
    }
}

function deleteOriginalDataValue(data, uid) {
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
function splitKeywordsAndRegexes(input) {
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

    // Go over the input and check the current state, if we can get a token
    for (let i = 0; i < current.length; i++) {
        let char = current[i];

        // If a comma is typed, we tokenize the input.
        // unless we are inside a possible regex, which would allow commas inside
        if (char === ',') {
            // We take everything up till now and consider this a token
            const token = current.slice(0, i).trim();

            // Now how we test if this is a valid regex? And not a finished one, but a half-finished one?
            // Easy, if someone typed a comma it can't be a delimiter escape.
            // So we just check if this opening with a slash, and if so, we "close" the regex and try to parse it.
            // So if we are inside a valid regex, we can't take the token now, we continue processing until the regex is closed,
            // or this is not a valid regex anymore
            if (token.startsWith('/') && isValidRegex(token + '/')) {
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
function parseRegexFromString(input) {
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

function getWorldEntry(name, data, entry) {
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
            input.select2({
                ajax: dynamicSelect2DataViaAjax(() => worldEntryKeyOptionsCache),
                tags: true,
                tokenSeparators: [','],
                tokenizer: customTokenizer,
                placeholder: input.attr('placeholder'),
                templateResult: item => templateStyling(item, { searchStyle: true }),
                templateSelection: item => templateStyling(item),
            });
            input.on('change', function (_, { skipReset, noSave } = {}) {
                const uid = $(this).data('uid');
                /** @type {string[]} */
                const keys = ($(this).select2('data')).map(x => x.text);

                !skipReset && resetScrollHeight(this);
                if (!noSave) {
                    data.entries[uid][entryPropName] = keys;
                    setOriginalDataValue(data, uid, originalDataValueName, data.entries[uid][entryPropName]);
                    saveWorldInfo(name, data);
                }
            });
            input.on('select2:select', /** @type {function(*):void} */ event => updateWorldEntryKeyOptionsCache([event.params.data]));
            input.on('select2:unselect', /** @type {function(*):void} */ event => updateWorldEntryKeyOptionsCache([event.params.data], { remove: true }));

            select2ChoiceClickSubscribe(input, target => {
                const key = $(target).text();
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

            select2ModifyOptions(input, entry[entryPropName], { select: true, changeEventArgs: { skipReset: true, noSave: true } });
        }
        else {
            // Compatibility with mobile devices. On mobile we need a text input field, not a select option control, so we need its own event handlers
            template.find(`select[name="${entryPropName}"]`).hide();
            input.show();

            input.on('input', function (_, { skipReset, noSave } = {}) {
                const uid = $(this).data('uid');
                const value = String($(this).val());
                !skipReset && resetScrollHeight(this);
                if (!noSave) {
                    data.entries[uid][entryPropName] = splitKeywordsAndRegexes(value);
                    setOriginalDataValue(data, uid, originalDataValueName, data.entries[uid][entryPropName]);
                    saveWorldInfo(name, data);
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

    selectiveLogicDropdown.on('input', function () {
        const uid = $(this).data('uid');
        const value = Number($(this).val());
        data.entries[uid].selectiveLogic = !isNaN(value) ? value : world_info_logic.AND_ANY;
        setOriginalDataValue(data, uid, 'selectiveLogic', data.entries[uid].selectiveLogic);
        saveWorldInfo(name, data);
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
    characterExclusionInput.on('input', function () {
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

        setOriginalDataValue(data, uid, 'character_filter', data.entries[uid].characterFilter);
        saveWorldInfo(name, data);
    });
    characterExclusionInput.prop('checked', entry.characterFilter?.isExclude ?? false).trigger('input');

    const characterFilter = template.find('select[name="characterFilter"]');
    characterFilter.data('uid', entry.uid);

    if (!isMobile()) {
        $(characterFilter).select2({
            width: '100%',
            placeholder: 'All characters will pull from this entry.',
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
        setOriginalDataValue(data, uid, 'character_filter', data.entries[uid].characterFilter);
        saveWorldInfo(name, data);
    });

    // comment
    const commentInput = template.find('textarea[name="comment"]');
    const commentToggle = template.find('input[name="addMemo"]');
    commentInput.data('uid', entry.uid);
    commentInput.on('input', function (_, { skipReset } = {}) {
        const uid = $(this).data('uid');
        const value = $(this).val();
        !skipReset && resetScrollHeight(this);
        data.entries[uid].comment = value;

        setOriginalDataValue(data, uid, 'comment', data.entries[uid].comment);
        saveWorldInfo(name, data);
    });
    commentToggle.data('uid', entry.uid);
    commentToggle.on('input', function () {
        const uid = $(this).data('uid');
        const value = $(this).prop('checked');
        //console.log(value)
        const commentContainer = $(this)
            .closest('.world_entry')
            .find('.commentContainer');
        data.entries[uid].addMemo = value;
        saveWorldInfo(name, data);
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
    contentInput.on('input', function (_, { skipCount } = {}) {
        const uid = $(this).data('uid');
        const value = $(this).val();
        data.entries[uid].content = value;

        setOriginalDataValue(data, uid, 'content', data.entries[uid].content);
        saveWorldInfo(name, data);

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
    selectiveInput.on('input', function () {
        const uid = $(this).data('uid');
        const value = $(this).prop('checked');
        data.entries[uid].selective = value;

        setOriginalDataValue(data, uid, 'selective', data.entries[uid].selective);
        saveWorldInfo(name, data);

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
    constantInput.on("input", function () {
        const uid = $(this).data("uid");
        const value = $(this).prop("checked");
        data.entries[uid].constant = value;
        setOriginalDataValue(data, uid, "constant", data.entries[uid].constant);
        saveWorldInfo(name, data);
    });
    constantInput.prop("checked", entry.constant).trigger("input");
    */

    // order
    const orderInput = template.find('input[name="order"]');
    orderInput.data('uid', entry.uid);
    orderInput.on('input', function () {
        const uid = $(this).data('uid');
        const value = Number($(this).val());

        data.entries[uid].order = !isNaN(value) ? value : 0;
        updatePosOrdDisplay(uid);
        setOriginalDataValue(data, uid, 'insertion_order', data.entries[uid].order);
        saveWorldInfo(name, data);
    });
    orderInput.val(entry.order).trigger('input');
    orderInput.css('width', 'calc(3em + 15px)');

    // group
    const groupInput = template.find('input[name="group"]');
    groupInput.data('uid', entry.uid);
    groupInput.on('input', function () {
        const uid = $(this).data('uid');
        const value = String($(this).val()).trim();

        data.entries[uid].group = value;
        setOriginalDataValue(data, uid, 'extensions.group', data.entries[uid].group);
        saveWorldInfo(name, data);
    });
    groupInput.val(entry.group ?? '').trigger('input');
    setTimeout(() => createEntryInputAutocomplete(groupInput, getInclusionGroupCallback(data), { allowMultiple: true }), 1);

    // inclusion priority
    const groupOverrideInput = template.find('input[name="groupOverride"]');
    groupOverrideInput.data('uid', entry.uid);
    groupOverrideInput.on('input', function () {
        const uid = $(this).data('uid');
        const value = $(this).prop('checked');
        data.entries[uid].groupOverride = value;
        setOriginalDataValue(data, uid, 'extensions.group_override', data.entries[uid].groupOverride);
        saveWorldInfo(name, data);
    });
    groupOverrideInput.prop('checked', entry.groupOverride).trigger('input');

    // group weight
    const groupWeightInput = template.find('input[name="groupWeight"]');
    groupWeightInput.data('uid', entry.uid);
    groupWeightInput.on('input', function () {
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
        setOriginalDataValue(data, uid, 'extensions.group_weight', data.entries[uid].groupWeight);
        saveWorldInfo(name, data);
    });
    groupWeightInput.val(entry.groupWeight ?? DEFAULT_WEIGHT).trigger('input');

    // probability
    if (entry.probability === undefined) {
        entry.probability = null;
    }

    // depth
    const depthInput = template.find('input[name="depth"]');
    depthInput.data('uid', entry.uid);

    depthInput.on('input', function () {
        const uid = $(this).data('uid');
        const value = Number($(this).val());

        data.entries[uid].depth = !isNaN(value) ? value : 0;
        updatePosOrdDisplay(uid);
        setOriginalDataValue(data, uid, 'extensions.depth', data.entries[uid].depth);
        saveWorldInfo(name, data);
    });
    depthInput.val(entry.depth ?? DEFAULT_DEPTH).trigger('input');
    depthInput.css('width', 'calc(3em + 15px)');

    // Hide by default unless depth is specified
    if (entry.position === world_info_position.atDepth) {
        //depthInput.parent().hide();
    }

    const probabilityInput = template.find('input[name="probability"]');
    probabilityInput.data('uid', entry.uid);
    probabilityInput.on('input', function () {
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

        setOriginalDataValue(data, uid, 'extensions.probability', data.entries[uid].probability);
        saveWorldInfo(name, data);
    });
    probabilityInput.val(entry.probability).trigger('input');
    probabilityInput.css('width', 'calc(3em + 15px)');

    // probability toggle
    if (entry.useProbability === undefined) {
        entry.useProbability = false;
    }

    const probabilityToggle = template.find('input[name="useProbability"]');
    probabilityToggle.data('uid', entry.uid);
    probabilityToggle.on('input', function () {
        const uid = $(this).data('uid');
        const value = $(this).prop('checked');
        data.entries[uid].useProbability = value;
        const probabilityContainer = $(this)
            .closest('.world_entry')
            .find('.probabilityContainer');
        saveWorldInfo(name, data);
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
    positionInput.on('input', function () {
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
        setOriginalDataValue(data, uid, 'position', data.entries[uid].position == 0 ? 'before_char' : 'after_char');
        // Write the original value as extensions field
        setOriginalDataValue(data, uid, 'extensions.position', data.entries[uid].position);
        setOriginalDataValue(data, uid, 'extensions.role', data.entries[uid].role);
        saveWorldInfo(name, data);
    });

    const roleValue = entry.position === world_info_position.atDepth ? String(entry.role ?? extension_prompt_roles.SYSTEM) : '';
    template
        .find(`select[name="position"] option[value=${entry.position}][data-role="${roleValue}"]`)
        .prop('selected', true)
        .trigger('input');

    //add UID above content box (less important doesn't need to be always visible)
    template.find('.world_entry_form_uid_value').text(`(UID: ${entry.uid})`);

    // disable
    /*
    const disableInput = template.find('input[name="disable"]');
    disableInput.data("uid", entry.uid);
    disableInput.on("input", function () {
        const uid = $(this).data("uid");
        const value = $(this).prop("checked");
        data.entries[uid].disable = value;
        setOriginalDataValue(data, uid, "enabled", !data.entries[uid].disable);
        saveWorldInfo(name, data);
    });
    disableInput.prop("checked", entry.disable).trigger("input");
    */

    //new tri-state selector for constant/normal/disabled
    const entryStateSelector = template.find('select[name="entryStateSelector"]');
    entryStateSelector.data('uid', entry.uid);
    entryStateSelector.on('click', function (event) {
        // Prevent closing the drawer on clicking the input
        event.stopPropagation();
    });
    entryStateSelector.on('input', function () {
        const uid = entry.uid;
        const value = $(this).val();
        switch (value) {
            case 'constant':
                data.entries[uid].constant = true;
                data.entries[uid].disable = false;
                data.entries[uid].vectorized = false;
                setOriginalDataValue(data, uid, 'enabled', true);
                setOriginalDataValue(data, uid, 'constant', true);
                setOriginalDataValue(data, uid, 'extensions.vectorized', false);
                template.removeClass('disabledWIEntry');
                break;
            case 'normal':
                data.entries[uid].constant = false;
                data.entries[uid].disable = false;
                data.entries[uid].vectorized = false;
                setOriginalDataValue(data, uid, 'enabled', true);
                setOriginalDataValue(data, uid, 'constant', false);
                setOriginalDataValue(data, uid, 'extensions.vectorized', false);
                template.removeClass('disabledWIEntry');
                break;
            case 'vectorized':
                data.entries[uid].constant = false;
                data.entries[uid].disable = false;
                data.entries[uid].vectorized = true;
                setOriginalDataValue(data, uid, 'enabled', true);
                setOriginalDataValue(data, uid, 'constant', false);
                setOriginalDataValue(data, uid, 'extensions.vectorized', true);
                template.removeClass('disabledWIEntry');
                break;
            case 'disabled':
                data.entries[uid].constant = false;
                data.entries[uid].disable = true;
                data.entries[uid].vectorized = false;
                setOriginalDataValue(data, uid, 'enabled', false);
                setOriginalDataValue(data, uid, 'constant', false);
                setOriginalDataValue(data, uid, 'extensions.vectorized', false);
                template.addClass('disabledWIEntry');
                break;
        }
        saveWorldInfo(name, data);

    });

    const entryState = function () {
        if (entry.constant === true) {
            return 'constant';
        } else if (entry.vectorized === true) {
            return 'vectorized';
        } else if (entry.disable === true) {
            return 'disabled';
        } else {
            return 'normal';
        }
    };
    template
        .find(`select[name="entryStateSelector"] option[value=${entryState()}]`)
        .prop('selected', true)
        .trigger('input');

    saveWorldInfo(name, data);

    // exclude recursion
    const excludeRecursionInput = template.find('input[name="exclude_recursion"]');
    excludeRecursionInput.data('uid', entry.uid);
    excludeRecursionInput.on('input', function () {
        const uid = $(this).data('uid');
        const value = $(this).prop('checked');
        data.entries[uid].excludeRecursion = value;
        setOriginalDataValue(data, uid, 'extensions.exclude_recursion', data.entries[uid].excludeRecursion);
        saveWorldInfo(name, data);
    });
    excludeRecursionInput.prop('checked', entry.excludeRecursion).trigger('input');

    // prevent recursion
    const preventRecursionInput = template.find('input[name="prevent_recursion"]');
    preventRecursionInput.data('uid', entry.uid);
    preventRecursionInput.on('input', function () {
        const uid = $(this).data('uid');
        const value = $(this).prop('checked');
        data.entries[uid].preventRecursion = value;
        setOriginalDataValue(data, uid, 'extensions.prevent_recursion', data.entries[uid].preventRecursion);
        saveWorldInfo(name, data);
    });
    preventRecursionInput.prop('checked', entry.preventRecursion).trigger('input');

    // delay until recursion
    const delayUntilRecursionInput = template.find('input[name="delay_until_recursion"]');
    delayUntilRecursionInput.data('uid', entry.uid);
    delayUntilRecursionInput.on('input', function () {
        const uid = $(this).data('uid');
        const value = $(this).prop('checked');
        data.entries[uid].delayUntilRecursion = value;
        setOriginalDataValue(data, uid, 'extensions.delay_until_recursion', data.entries[uid].delayUntilRecursion);
        saveWorldInfo(name, data);
    });
    delayUntilRecursionInput.prop('checked', entry.delayUntilRecursion).trigger('input');

    // duplicate button
    const duplicateButton = template.find('.duplicate_entry_button');
    duplicateButton.data('uid', entry.uid);
    duplicateButton.on('click', function () {
        const uid = $(this).data('uid');
        const entry = duplicateWorldInfoEntry(data, uid);
        if (entry) {
            saveWorldInfo(name, data);
            updateEditor(entry.uid);
        }
    });

    // delete button
    const deleteButton = template.find('.delete_entry_button');
    deleteButton.data('uid', entry.uid);
    deleteButton.on('click', function () {
        const uid = $(this).data('uid');
        deleteWorldInfoEntry(data, uid);
        deleteOriginalDataValue(data, uid);
        saveWorldInfo(name, data);
        updateEditor(navigation_option.previous);
    });

    // scan depth
    const scanDepthInput = template.find('input[name="scanDepth"]');
    scanDepthInput.data('uid', entry.uid);
    scanDepthInput.on('input', function () {
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
        setOriginalDataValue(data, uid, 'extensions.scan_depth', data.entries[uid].scanDepth);
        saveWorldInfo(name, data);
    });
    scanDepthInput.val(entry.scanDepth ?? null).trigger('input');

    // case sensitive select
    const caseSensitiveSelect = template.find('select[name="caseSensitive"]');
    caseSensitiveSelect.data('uid', entry.uid);
    caseSensitiveSelect.on('input', function () {
        const uid = $(this).data('uid');
        const value = $(this).val();

        data.entries[uid].caseSensitive = value === 'null' ? null : value === 'true';
        setOriginalDataValue(data, uid, 'extensions.case_sensitive', data.entries[uid].caseSensitive);
        saveWorldInfo(name, data);
    });
    caseSensitiveSelect.val((entry.caseSensitive === null || entry.caseSensitive === undefined) ? 'null' : entry.caseSensitive ? 'true' : 'false').trigger('input');

    // match whole words select
    const matchWholeWordsSelect = template.find('select[name="matchWholeWords"]');
    matchWholeWordsSelect.data('uid', entry.uid);
    matchWholeWordsSelect.on('input', function () {
        const uid = $(this).data('uid');
        const value = $(this).val();

        data.entries[uid].matchWholeWords = value === 'null' ? null : value === 'true';
        setOriginalDataValue(data, uid, 'extensions.match_whole_words', data.entries[uid].matchWholeWords);
        saveWorldInfo(name, data);
    });
    matchWholeWordsSelect.val((entry.matchWholeWords === null || entry.matchWholeWords === undefined) ? 'null' : entry.matchWholeWords ? 'true' : 'false').trigger('input');

    // use group scoring select
    const useGroupScoringSelect = template.find('select[name="useGroupScoring"]');
    useGroupScoringSelect.data('uid', entry.uid);
    useGroupScoringSelect.on('input', function () {
        const uid = $(this).data('uid');
        const value = $(this).val();

        data.entries[uid].useGroupScoring = value === 'null' ? null : value === 'true';
        setOriginalDataValue(data, uid, 'extensions.use_group_scoring', data.entries[uid].useGroupScoring);
        saveWorldInfo(name, data);
    });
    useGroupScoringSelect.val((entry.useGroupScoring === null || entry.useGroupScoring === undefined) ? 'null' : entry.useGroupScoring ? 'true' : 'false').trigger('input');

    // automation id
    const automationIdInput = template.find('input[name="automationId"]');
    automationIdInput.data('uid', entry.uid);
    automationIdInput.on('input', function () {
        const uid = $(this).data('uid');
        const value = $(this).val();

        data.entries[uid].automationId = value;
        setOriginalDataValue(data, uid, 'extensions.automation_id', data.entries[uid].automationId);
        saveWorldInfo(name, data);
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
 * Duplicated a WI entry by copying all of its properties and assigning a new uid
 * @param {*} data - The data of the book
 * @param {number} uid - The uid of the entry to copy in this book
 * @returns {*} The new WI duplicated entry
 */
function duplicateWorldInfoEntry(data, uid) {
    if (!data || !('entries' in data) || !data.entries[uid]) {
        return;
    }

    // Exclude uid and gather the rest of the properties
    const { uid: _, ...originalData } = data.entries[uid];

    // Create new entry and copy over data
    const entry = createWorldInfoEntry(data.name, data);
    Object.assign(entry, originalData);

    return entry;
}

/**
 * Deletes a WI entry, with a user confirmation dialog
 * @param {*[]} data - The data of the book
 * @param {number} uid - The uid of the entry to copy in this book
 */
function deleteWorldInfoEntry(data, uid) {
    if (!data || !('entries' in data)) {
        return;
    }

    if (!confirm(`Delete the entry with UID: ${uid}? This action is irreversible!`)) {
        throw new Error('User cancelled deletion');
    }

    delete data.entries[uid];
}

const newEntryTemplate = {
    key: [],
    keysecondary: [],
    comment: '',
    content: '',
    constant: false,
    vectorized: false,
    selective: true,
    selectiveLogic: world_info_logic.AND_ANY,
    addMemo: false,
    order: 100,
    position: 0,
    disable: false,
    excludeRecursion: false,
    preventRecursion: false,
    delayUntilRecursion: false,
    probability: 100,
    useProbability: true,
    depth: DEFAULT_DEPTH,
    group: '',
    groupOverride: false,
    groupWeight: DEFAULT_WEIGHT,
    scanDepth: null,
    caseSensitive: null,
    matchWholeWords: null,
    useGroupScoring: null,
    automationId: '',
    role: 0,
};

function createWorldInfoEntry(_name, data) {
    const newUid = getFreeWorldEntryUid(data);

    if (!Number.isInteger(newUid)) {
        console.error('Couldn\'t assign UID to a new entry');
        return;
    }

    const newEntry = { uid: newUid, ...structuredClone(newEntryTemplate) };
    data.entries[newUid] = newEntry;

    return newEntry;
}

async function _save(name, data) {
    await fetch('/api/worldinfo/edit', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ name: name, data: data }),
    });
    eventSource.emit(event_types.WORLDINFO_UPDATED, name, data);
}

async function saveWorldInfo(name, data, immediately) {
    if (!name || !data) {
        return;
    }

    delete worldInfoCache[name];

    if (immediately) {
        return await _save(name, data);
    }

    saveWorldDebounced(name, data);
}

async function renameWorldInfo(name, data) {
    const oldName = name;
    const newName = await callPopup('<h3>Rename World Info</h3>Enter a new name:', 'input', oldName);

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

async function deleteWorldInfo(worldInfoName) {
    if (!world_names.includes(worldInfoName)) {
        return;
    }

    const response = await fetch('/api/worldinfo/delete', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ name: worldInfoName }),
    });

    if (response.ok) {
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
    }
}

function getFreeWorldEntryUid(data) {
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

function getFreeWorldName() {
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

async function createNewWorldInfo(worldInfoName) {
    const worldInfoTemplate = { entries: {} };

    if (!worldInfoName) {
        return;
    }

    await saveWorldInfo(worldInfoName, worldInfoTemplate, true);
    await updateWorldInfoList();

    const selectedIndex = world_names.indexOf(worldInfoName);
    if (selectedIndex !== -1) {
        $('#world_editor_select').val(selectedIndex).trigger('change');
    } else {
        hideWorldEditor();
    }
}

async function getCharacterLore() {
    const character = characters[this_chid];
    const name = character?.name;
    let worldsToSearch = new Set();

    const baseWorldName = character?.data?.extensions?.world;
    if (baseWorldName) {
        worldsToSearch.add(baseWorldName);
    } else {
        console.debug(`Character ${name}'s base world could not be found or is empty! Skipping...`);
        return [];
    }

    // TODO: Maybe make the utility function not use the window context?
    const fileName = getCharaFilename(this_chid);
    const extraCharLore = world_info.charLore?.find((e) => e.name === fileName);
    if (extraCharLore) {
        worldsToSearch = new Set([...worldsToSearch, ...extraCharLore.extraBooks]);
    }

    let entries = [];
    for (const worldName of worldsToSearch) {
        if (selected_world_info.includes(worldName)) {
            console.debug(`Character ${name}'s world ${worldName} is already activated in global world info! Skipping...`);
            continue;
        }

        if (chat_metadata[METADATA_KEY] === worldName) {
            console.debug(`Character ${name}'s world ${worldName} is already activated in chat lore! Skipping...`);
            continue;
        }

        const data = await loadWorldInfoData(worldName);
        const newEntries = data ? Object.keys(data.entries).map((x) => data.entries[x]).map(x => ({ ...x, world: worldName })) : [];
        entries = entries.concat(newEntries);
    }

    console.debug(`Character ${characters[this_chid]?.name} lore (${baseWorldName}) has ${entries.length} world info entries`);
    return entries;
}

async function getGlobalLore() {
    if (!selected_world_info) {
        return [];
    }

    let entries = [];
    for (const worldName of selected_world_info) {
        const data = await loadWorldInfoData(worldName);
        const newEntries = data ? Object.keys(data.entries).map((x) => data.entries[x]).map(x => ({ ...x, world: worldName })) : [];
        entries = entries.concat(newEntries);
    }

    console.debug(`Global world info has ${entries.length} entries`);

    return entries;
}

async function getChatLore() {
    const chatWorld = chat_metadata[METADATA_KEY];

    if (!chatWorld) {
        return [];
    }

    if (selected_world_info.includes(chatWorld)) {
        console.debug(`Chat world ${chatWorld} is already activated in global world info! Skipping...`);
        return [];
    }

    const data = await loadWorldInfoData(chatWorld);
    const entries = data ? Object.keys(data.entries).map((x) => data.entries[x]).map(x => ({ ...x, world: chatWorld })) : [];

    console.debug(`Chat lore has ${entries.length} entries`);

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
                console.error('Unknown WI insertion strategy: ', world_info_character_strategy, 'defaulting to evenly');
                entries = [...globalLore, ...characterLore].sort(sortFn);
                break;
        }

        // Chat lore always goes first
        entries = [...chatLore.sort(sortFn), ...entries];

        console.debug(`Sorted ${entries.length} world lore entries using strategy ${world_info_character_strategy}`);

        // Need to deep clone the entries to avoid modifying the cached data
        return structuredClone(entries);
    }
    catch (e) {
        console.error(e);
        return [];
    }
}

/**
 * Performs a scan on the chat and returns the world info activated.
 * @param {string[]} chat The chat messages to scan.
 * @param {number} maxContext The maximum context size of the generation.
 * @typedef {{ worldInfoBefore: string, worldInfoAfter: string, EMEntries: any[], WIDepthEntries: any[], allActivatedEntries: Set<any> }} WIActivated
 * @returns {Promise<WIActivated>} The world info activated.
 */
async function checkWorldInfo(chat, maxContext) {
    const context = getContext();
    const buffer = new WorldInfoBuffer(chat);

    // Combine the chat

    // Add the depth or AN if enabled
    // Put this code here since otherwise, the chat reference is modified
    for (const key of Object.keys(context.extensionPrompts)) {
        if (context.extensionPrompts[key]?.scan) {
            const prompt = getExtensionPromptByName(key);
            if (prompt) {
                buffer.addRecurse(prompt);
            }
        }
    }

    let needsToScan = true;
    let token_budget_overflowed = false;
    let count = 0;
    let allActivatedEntries = new Set();
    let failedProbabilityChecks = new Set();
    let allActivatedText = '';

    let budget = Math.round(world_info_budget * maxContext / 100) || 1;

    if (world_info_budget_cap > 0 && budget > world_info_budget_cap) {
        console.debug(`Budget ${budget} exceeds cap ${world_info_budget_cap}, using cap`);
        budget = world_info_budget_cap;
    }

    console.debug(`Context size: ${maxContext}; WI budget: ${budget} (max% = ${world_info_budget}%, cap = ${world_info_budget_cap})`);
    const sortedEntries = await getSortedEntries();

    if (sortedEntries.length === 0) {
        return { worldInfoBefore: '', worldInfoAfter: '', WIDepthEntries: [], EMEntries: [], allActivatedEntries: new Set() };
    }

    while (needsToScan) {
        // Track how many times the loop has run
        count++;

        let activatedNow = new Set();

        for (let entry of sortedEntries) {
            // Check if this entry applies to the character or if it's excluded
            if (entry.characterFilter && entry.characterFilter?.names?.length > 0) {
                const nameIncluded = entry.characterFilter.names.includes(getCharaFilename());
                const filtered = entry.characterFilter.isExclude ? nameIncluded : !nameIncluded;

                if (filtered) {
                    console.debug(`WI entry ${entry.uid} filtered out by character`);
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
                            console.debug(`WI entry ${entry.uid} filtered out by tag`);
                            continue;
                        }
                    }
                }
            }

            if (failedProbabilityChecks.has(entry)) {
                continue;
            }

            if (allActivatedEntries.has(entry) || entry.disable == true || (count > 1 && world_info_recursive && entry.excludeRecursion) || (count == 1 && entry.delayUntilRecursion)) {
                continue;
            }

            if (entry.constant || buffer.isExternallyActivated(entry)) {
                activatedNow.add(entry);
                continue;
            }

            if (Array.isArray(entry.key) && entry.key.length) { //check for keywords existing
                // If selectiveLogic isn't found, assume it's AND, only do this once per entry
                const selectiveLogic = entry.selectiveLogic ?? 0;

                primary: for (let key of entry.key) {
                    const substituted = substituteParams(key);
                    const textToScan = buffer.get(entry);

                    if (substituted && buffer.matchKeys(textToScan, substituted.trim(), entry)) {
                        console.debug(`WI UID ${entry.uid} found by primary match: ${substituted}.`);

                        //selective logic begins
                        if (
                            entry.selective && //all entries are selective now
                            Array.isArray(entry.keysecondary) && //always true
                            entry.keysecondary.length //ignore empties
                        ) {
                            console.debug(`WI UID:${entry.uid} found. Checking logic: ${entry.selectiveLogic}`);
                            let hasAnyMatch = false;
                            let hasAllMatch = true;
                            secondary: for (let keysecondary of entry.keysecondary) {
                                const secondarySubstituted = substituteParams(keysecondary);
                                const hasSecondaryMatch = secondarySubstituted && buffer.matchKeys(textToScan, secondarySubstituted.trim(), entry);
                                console.debug(`WI UID:${entry.uid}: Filtering for secondary keyword - "${secondarySubstituted}".`);

                                if (hasSecondaryMatch) {
                                    hasAnyMatch = true;
                                }

                                if (!hasSecondaryMatch) {
                                    hasAllMatch = false;
                                }

                                // Simplified AND ANY / NOT ALL if statement. (Proper fix for PR#1356 by Bronya)
                                // If AND ANY logic and the main checks pass OR if NOT ALL logic and the main checks do not pass
                                if ((selectiveLogic === world_info_logic.AND_ANY && hasSecondaryMatch) || (selectiveLogic === world_info_logic.NOT_ALL && !hasSecondaryMatch)) {
                                    // Differ both logic statements in the debugger
                                    if (selectiveLogic === world_info_logic.AND_ANY) {
                                        console.debug(`(AND ANY Check) Activating WI Entry ${entry.uid}. Found match for word: ${substituted} ${secondarySubstituted}`);
                                    } else {
                                        console.debug(`(NOT ALL Check) Activating WI Entry ${entry.uid}. Found match for word "${substituted}" without secondary keyword: ${secondarySubstituted}`);
                                    }
                                    activatedNow.add(entry);
                                    break secondary;
                                }
                            }

                            // Handle NOT ANY logic
                            if (selectiveLogic === world_info_logic.NOT_ANY && !hasAnyMatch) {
                                console.debug(`(NOT ANY Check) Activating WI Entry ${entry.uid}, no secondary keywords found.`);
                                activatedNow.add(entry);
                            }

                            // Handle AND ALL logic
                            if (selectiveLogic === world_info_logic.AND_ALL && hasAllMatch) {
                                console.debug(`(AND ALL Check) Activating WI Entry ${entry.uid}, all secondary keywords found.`);
                                activatedNow.add(entry);
                            }
                        } else {
                            // Handle cases where secondary is empty
                            console.debug(`WI UID ${entry.uid}: Activated without filter logic.`);
                            activatedNow.add(entry);
                            break primary;
                        }
                    }
                }
            }
        }

        needsToScan = world_info_recursive && activatedNow.size > 0;
        const newEntries = [...activatedNow]
            .sort((a, b) => sortedEntries.indexOf(a) - sortedEntries.indexOf(b));
        let newContent = '';
        const textToScanTokens = await getTokenCountAsync(allActivatedText);
        const probabilityChecksBefore = failedProbabilityChecks.size;

        filterByInclusionGroups(newEntries, allActivatedEntries, buffer);

        console.debug('-- PROBABILITY CHECKS BEGIN --');
        for (const entry of newEntries) {
            const rollValue = Math.random() * 100;

            if (entry.useProbability && rollValue > entry.probability) {
                console.debug(`WI entry ${entry.uid} ${entry.key} failed probability check, skipping`);
                failedProbabilityChecks.add(entry);
                continue;
            } else { console.debug(`uid:${entry.uid} passed probability check, inserting to prompt`); }

            // Substitute macros inline, for both this checking and also future processing
            entry.content = substituteParams(entry.content);
            newContent += `${entry.content}\n`;

            if ((textToScanTokens + (await getTokenCountAsync(newContent))) >= budget) {
                console.debug('WI budget reached, stopping');
                if (world_info_overflow_alert) {
                    console.log('Alerting');
                    toastr.warning(`World info budget reached after ${allActivatedEntries.size} entries.`, 'World Info');
                }
                needsToScan = false;
                token_budget_overflowed = true;
                break;
            }

            allActivatedEntries.add(entry);
            console.debug('WI entry activated:', entry);
        }

        const probabilityChecksAfter = failedProbabilityChecks.size;

        if ((probabilityChecksAfter - probabilityChecksBefore) === activatedNow.size) {
            console.debug('WI probability checks failed for all activated entries, stopping');
            needsToScan = false;
        }

        if (newEntries.length === 0) {
            console.debug('No new entries activated, stopping');
            needsToScan = false;
        }

        if (needsToScan) {
            const text = newEntries
                .filter(x => !failedProbabilityChecks.has(x))
                .filter(x => !x.preventRecursion)
                .map(x => x.content).join('\n');
            buffer.addRecurse(text);
            allActivatedText = (text + '\n' + allActivatedText);
        }

        // world_info_min_activations
        if (!needsToScan && !token_budget_overflowed) {
            if (world_info_min_activations > 0 && (allActivatedEntries.size < world_info_min_activations)) {
                let over_max = (
                    world_info_min_activations_depth_max > 0 &&
                    buffer.getDepth() > world_info_min_activations_depth_max
                ) || (buffer.getDepth() > chat.length);

                if (!over_max) {
                    needsToScan = true; // loop
                    buffer.advanceScanPosition();
                }
            }
        }
    }

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
            console.debug('Skipping adding WI entry to prompt due to empty content:', entry);
            return;
        }

        switch (entry.position) {
            case world_info_position.before:
                WIBeforeEntries.unshift(substituteParams(content));
                break;
            case world_info_position.after:
                WIAfterEntries.unshift(substituteParams(content));
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
        const ANWithWI = `${ANTopEntries.join('\n')}\n${originalAN}\n${ANBottomEntries.join('\n')}`;
        context.setExtensionPrompt(NOTE_MODULE_NAME, ANWithWI, chat_metadata[metadata_keys.position], chat_metadata[metadata_keys.depth], extension_settings.note.allowWIScan, chat_metadata[metadata_keys.role]);
    }

    buffer.cleanExternalActivations();

    return { worldInfoBefore, worldInfoAfter, EMEntries, WIDepthEntries, allActivatedEntries };
}

/**
 * Only leaves entries with the highest key matching score in each group.
 * @param {Record<string, WIScanEntry[]>} groups The groups to filter
 * @param {WorldInfoBuffer} buffer The buffer to use for scoring
 * @param {(entry: WIScanEntry) => void} removeEntry The function to remove an entry
 */
function filterGroupsByScoring(groups, buffer, removeEntry) {
    for (const [key, group] of Object.entries(groups)) {
        // Group scoring is disabled both globally and for the group entries
        if (!world_info_use_group_scoring && !group.some(x => x.useGroupScoring)) {
            console.debug(`Skipping group scoring for group '${key}'`);
            continue;
        }

        const scores = group.map(entry => buffer.getScore(entry));
        const maxScore = Math.max(...scores);
        console.debug(`Group '${key}' max score: ${maxScore}`);
        //console.table(group.map((entry, i) => ({ uid: entry.uid, key: JSON.stringify(entry.key), score: scores[i] })));

        for (let i = 0; i < group.length; i++) {
            const isScored = group[i].useGroupScoring ?? world_info_use_group_scoring;

            if (!isScored) {
                continue;
            }

            if (scores[i] < maxScore) {
                console.debug(`Removing score loser from inclusion group '${key}' entry '${group[i].uid}'`, group[i]);
                removeEntry(group[i]);
                group.splice(i, 1);
                scores.splice(i, 1);
                i--;
            }
        }
    }
}

/**
 * Filters entries by inclusion groups.
 * @param {object[]} newEntries Entries activated on current recursion level
 * @param {Set<object>} allActivatedEntries Set of all activated entries
 * @param {WorldInfoBuffer} buffer The buffer to use for scanning
 */
function filterByInclusionGroups(newEntries, allActivatedEntries, buffer) {
    console.debug('-- INCLUSION GROUP CHECKS BEGIN --');
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
        console.debug('No inclusion groups found');
        return;
    }

    const removeEntry = (entry) => newEntries.splice(newEntries.indexOf(entry), 1);
    function removeAllBut(group, chosen, logging = true) {
        for (const entry of group) {
            if (entry === chosen) {
                continue;
            }

            if (logging) console.debug(`Removing loser from inclusion group '${entry.group}' entry '${entry.uid}'`, entry);
            removeEntry(entry);
        }
    }

    filterGroupsByScoring(grouped, buffer, removeEntry);

    for (const [key, group] of Object.entries(grouped)) {
        console.debug(`Checking inclusion group '${key}' with ${group.length} entries`, group);

        if (Array.from(allActivatedEntries).some(x => x.group === key)) {
            console.debug(`Skipping inclusion group check, group already activated '${key}'`);
            // We need to forcefully deactivate all other entries in the group
            removeAllBut(group, null, false);
            continue;
        }

        if (!Array.isArray(group) || group.length <= 1) {
            console.debug('Skipping inclusion group check, only one entry');
            continue;
        }

        // Check for group prio
        const prios = group.filter(x => x.groupOverride).sort(sortFn);
        if (prios.length) {
            console.debug(`Activated inclusion group '${key}' with by prio winner entry '${prios[0].uid}'`, prios[0]);
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
                console.debug(`Activated inclusion group '${key}' with roll winner entry '${entry.uid}'`, entry);
                winner = entry;
                break;
            }
        }

        if (!winner) {
            console.debug(`Failed to activate inclusion group '${key}', no winner found`);
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
            ...newEntryTemplate,
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
        };
    });

    return outputObj;
}

function convertRisuLorebook(inputObj) {
    const outputObj = { entries: {} };

    inputObj.data.forEach((entry, index) => {
        outputObj.entries[index] = {
            ...newEntryTemplate,
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
            ...newEntryTemplate,
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
            ...newEntryTemplate,
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
                callPopup(html, 'confirm', '', { okButton: 'Yes' }).then(checkResult);
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
    const confirmationText = (`<h3>Are you sure you want to import "${bookName}"?</h3>`) + (world_names.includes(bookName) ? 'It will overwrite the World/Lorebook with the same name.' : '');

    if (!skipPopup) {
        const confirmation = await callPopup(confirmationText, 'confirm');

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

function onWorldInfoChange(args, text) {
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
        let tempWorldInfo = [];
        let selectedWorlds = $('#world_info').val().map((e) => Number(e)).filter((e) => !isNaN(e));
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

                toastr.info(`World Info "${data.name}" imported successfully!`);
            }
        },
        error: (_jqXHR, _exception) => { },
    });
}

function assignLorebookToChat() {
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
        const finalName = await callPopup('<h3>Create a new World Info?</h3>Enter a name for the new file:', 'input', tempName);

        if (finalName) {
            await createNewWorldInfo(finalName);
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
        $('#world_info_min_activations_counter').val($(this).val());
        saveSettings();
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
