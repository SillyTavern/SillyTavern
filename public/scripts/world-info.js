import { saveSettings, callPopup, substituteParams, getRequestHeaders, chat_metadata, this_chid, characters, saveCharacterDebounced, menu_type, eventSource, event_types, getExtensionPromptByName, saveMetadata, getCurrentChatId } from '../script.js';
import { download, debounce, initScrollHeight, resetScrollHeight, parseJsonFile, extractDataFromPng, getFileBuffer, getCharaFilename, getSortableDelay, escapeRegex, PAGINATION_TEMPLATE, navigation_option, waitUntilCondition, isTrueBoolean } from './utils.js';
import { extension_settings, getContext } from './extensions.js';
import { NOTE_MODULE_NAME, metadata_keys, shouldWIAddPrompt } from './authors-note.js';
import { registerSlashCommand } from './slash-commands.js';
import { isMobile } from './RossAscends-mods.js';
import { FILTER_TYPES, FilterHelper } from './filters.js';
import { getTokenCount } from './tokenizers.js';
import { power_user } from './power-user.js';
import { getTagKeyForCharacter } from './tags.js';
import { resolveVariable } from './variables.js';

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
let world_info_character_strategy = world_info_insertion_strategy.character_first;
let world_info_budget_cap = 0;
const saveWorldDebounced = debounce(async (name, data) => await _save(name, data), 1000);
const saveSettingsDebounced = debounce(() => {
    Object.assign(world_info, { globalSelect: selected_world_info });
    saveSettings();
}, 1000);
const sortFn = (a, b) => b.order - a.order;
let updateEditor = (navigation) => { navigation; };

// Do not optimize. updateEditor is a function that is updated by the displayWorldEntries with new data.
const worldInfoFilter = new FilterHelper(() => updateEditor());
const SORT_ORDER_KEY = 'world_info_sort_order';
const METADATA_KEY = 'world_info';

const DEFAULT_DEPTH = 4;
const MAX_SCAN_DEPTH = 100;

/**
 * Represents a scanning buffer for one evaluation of World Info.
 */
class WorldInfoBuffer {
    // Typedef area
    /** @typedef {{scanDepth?: number, caseSensitive?: boolean, matchWholeWords?: boolean}} WIScanEntry The entry that triggered the scan */
    // End typedef area

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
        let depth = entry.scanDepth ?? (world_info_depth + this.#skew);

        if (depth < 0) {
            console.error(`Invalid WI scan depth ${depth}. Must be >= 0`);
            return '';
        }

        if (depth > MAX_SCAN_DEPTH) {
            console.warn(`Invalid WI scan depth ${depth}. Truncating to ${MAX_SCAN_DEPTH}`);
            depth = MAX_SCAN_DEPTH;
        }

        let result = this.#depthBuffer.slice(0, depth).join('\n');

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
        const transformedString = this.#transformString(needle, entry);
        const matchWholeWords = entry.matchWholeWords ?? world_info_match_whole_words;

        if (matchWholeWords) {
            const keyWords = transformedString.split(/\s+/);

            if (keyWords.length > 1) {
                return haystack.includes(transformedString);
            }
            else {
                const regex = new RegExp(`\\b${escapeRegex(transformedString)}\\b`);
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
     * Adds an increment to depth skew.
     */
    addSkew() {
        this.#skew++;
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
    };
}

const world_info_position = {
    before: 0,
    after: 1,
    ANTop: 2,
    ANBottom: 3,
    atDepth: 4,
};

const worldInfoCache = {};

async function getWorldInfoPrompt(chat2, maxContext) {
    let worldInfoString = '', worldInfoBefore = '', worldInfoAfter = '';

    const activatedWorldInfo = await checkWorldInfo(chat2, maxContext);
    worldInfoBefore = activatedWorldInfo.worldInfoBefore;
    worldInfoAfter = activatedWorldInfo.worldInfoAfter;
    worldInfoString = worldInfoBefore + worldInfoAfter;

    return {
        worldInfoString,
        worldInfoBefore,
        worldInfoAfter,
        worldInfoDepth: activatedWorldInfo.WIDepthEntries,
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

    // Migrate old settings
    if (world_info_budget > 100) {
        world_info_budget = 25;
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
    $('#world_editor_select').trigger('change');

    eventSource.on(event_types.CHAT_CHANGED, () => {
        const hasWorldInfo = !!chat_metadata[METADATA_KEY] && world_names.includes(chat_metadata[METADATA_KEY]);
        $('.chat_lorebook_button').toggleClass('world_set', hasWorldInfo);
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

        const entry = createWorldInfoEntry(file, data, true);

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

    registerSlashCommand('getchatbook', getChatBookCallback, ['getchatlore', 'getchatwi'], '– get a name of the chat-bound lorebook or create a new one if was unbound, and pass it down the pipe', true, true);
    registerSlashCommand('findentry', findBookEntryCallback, ['findlore', 'findwi'], '<span class="monospace">(file=bookName field=field [texts])</span> – find a UID of the record from the specified book using the fuzzy match of a field value (default: key) and pass it down the pipe, e.g. <tt>/findentry file=chatLore field=key Shadowfang</tt>', true, true);
    registerSlashCommand('getentryfield', getEntryFieldCallback, ['getlorefield', 'getwifield'], '<span class="monospace">(file=bookName field=field [UID])</span> – get a field value (default: content) of the record with the UID from the specified book and pass it down the pipe, e.g. <tt>/getentryfield file=chatLore field=content 123</tt>', true, true);
    registerSlashCommand('createentry', createEntryCallback, ['createlore', 'createwi'], '<span class="monospace">(file=bookName key=key [content])</span> – create a new record in the specified book with the key and content (both are optional) and pass the UID down the pipe, e.g. <tt>/createentry file=chatLore key=Shadowfang The sword of the king</tt>', true, true);
    registerSlashCommand('setentryfield', setEntryFieldCallback, ['setlorefield', 'setwifield'], '<span class="monospace">(file=bookName uid=UID field=field [value])</span> – set a field value (default: content) of the record with the UID from the specified book. To set multiple values for key fields, use comma-delimited list as a value, e.g. <tt>/setentryfield file=chatLore uid=123 field=key Shadowfang,sword,weapon</tt>', true, true);
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

    if (sortRule === 'custom') {
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

function displayWorldEntries(name, data, navigation = navigation_option.none) {
    updateEditor = (navigation) => displayWorldEntries(name, data, navigation);

    $('#world_popup_entries_list').empty().show();

    if (!data || !('entries' in data)) {
        $('#world_popup_new').off('click').on('click', nullWorldInfo);
        $('#world_popup_name_button').off('click').on('click', nullWorldInfo);
        $('#world_popup_export').off('click').on('click', nullWorldInfo);
        $('#world_popup_delete').off('click').on('click', nullWorldInfo);
        $('#world_duplicate').off('click').on('click', nullWorldInfo);
        $('#world_popup_entries_list').hide();
        $('#world_info_pagination').html('');
        return;
    }

    function getDataArray(callback) {
        // Convert the data.entries object into an array
        let entriesArray = Object.keys(data.entries).map(uid => {
            const entry = data.entries[uid];
            entry.displayIndex = entry.displayIndex ?? entry.uid;
            return entry;
        });

        // Sort the entries array by displayIndex and uid
        entriesArray.sort((a, b) => a.displayIndex - b.displayIndex || a.uid - b.uid);
        entriesArray = sortEntries(entriesArray);
        entriesArray = worldInfoFilter.applyFilters(entriesArray);
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
        sizeChangerOptions: [10, 25, 50, 100],
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
            $('#world_popup_entries_list').empty();
            const keywordHeaders = `
            <div id="WIEntryHeaderTitlesPC" class="flex-container wide100p spaceBetween justifyCenter textAlignCenter" style="padding:0 2.5em;">
            <small class="flex1">
            Title/Memo
        </small>
                <small style="width: calc(3.5em + 5px)">
                    Status
                </small>
                <small style="width: calc(3.5em + 20px)">
                    Position
                </small>
                <small style="width: calc(3.5em + 15px)">
                    Depth
                </small>
                <small style="width: calc(3.5em + 15px)">
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
            $('#world_popup_entries_list').append(keywordHeaders);
            $('#world_popup_entries_list').append(blocks);
        },
        afterSizeSelectorChange: function (e) {
            localStorage.setItem(storageKey, e.target.value);
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
            element.addClass('flash animated');
            setTimeout(() => element.removeClass('flash animated'), 2000);
        });
    }

    $('#world_popup_new').off('click').on('click', () => {
        createWorldInfoEntry(name, data);
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
    if ($('#world_popup_entries_list').sortable('instance') !== undefined) {
        // Destroy the instance
        $('#world_popup_entries_list').sortable('destroy');
    }

    $('#world_popup_entries_list').sortable({
        delay: getSortableDelay(),
        handle: '.drag-handle',
        stop: async function (event, ui) {
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
    'selectiveLogic': 'selectiveLogic',
    'comment': 'comment',
    'constant': 'constant',
    'order': 'insertion_order',
    'depth': 'extensions.depth',
    'probability': 'extensions.probability',
    'position': 'extensions.position',
    'content': 'content',
    'enabled': 'enabled',
    'key': 'keys',
    'keysecondary': 'secondary_keys',
    'selective': 'selective',
    'matchWholeWords': 'extensions.match_whole_words',
    'caseSensitive': 'extensions.case_sensitive',
    'scanDepth': 'extensions.scan_depth',
};

function setOriginalDataValue(data, uid, key, value) {
    if (data.originalData && Array.isArray(data.originalData.entries)) {
        let originalEntry = data.originalData.entries.find(x => x.uid === uid);

        if (!originalEntry) {
            return;
        }

        const keyParts = key.split('.');
        let currentObject = originalEntry;

        for (let i = 0; i < keyParts.length - 1; i++) {
            const part = keyParts[i];

            if (!Object.hasOwn(currentObject, part)) {
                currentObject[part] = {};
            }

            currentObject = currentObject[part];
        }

        currentObject[keyParts[keyParts.length - 1]] = value;
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

function getWorldEntry(name, data, entry) {
    if (!data.entries[entry.uid]) {
        return;
    }

    const template = $('#entry_edit_template .world_entry').clone();
    template.data('uid', entry.uid);
    template.attr('uid', entry.uid);

    // key
    const keyInput = template.find('textarea[name="key"]');
    keyInput.data('uid', entry.uid);
    keyInput.on('click', function (event) {
        // Prevent closing the drawer on clicking the input
        event.stopPropagation();
    });

    keyInput.on('input', function () {
        const uid = $(this).data('uid');
        const value = String($(this).val());
        resetScrollHeight(this);
        data.entries[uid].key = value
            .split(',')
            .map((x) => x.trim())
            .filter((x) => x);

        setOriginalDataValue(data, uid, 'keys', data.entries[uid].key);
        saveWorldInfo(name, data);
    });
    keyInput.val(entry.key.join(', ')).trigger('input');
    //initScrollHeight(keyInput);

    // logic AND/NOT
    const selectiveLogicDropdown = template.find('select[name="entryLogicType"]');
    selectiveLogicDropdown.data('uid', entry.uid);

    selectiveLogicDropdown.on('click', function (event) {
        event.stopPropagation();
    });

    selectiveLogicDropdown.on('input', function () {
        const uid = $(this).data('uid');
        const value = Number($(this).val());
        console.debug(`logic for ${entry.uid} set to ${value}`);
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

    // keysecondary
    const keySecondaryInput = template.find('textarea[name="keysecondary"]');
    keySecondaryInput.data('uid', entry.uid);
    keySecondaryInput.on('input', function () {
        const uid = $(this).data('uid');
        const value = String($(this).val());
        resetScrollHeight(this);
        data.entries[uid].keysecondary = value
            .split(',')
            .map((x) => x.trim())
            .filter((x) => x);

        setOriginalDataValue(data, uid, 'secondary_keys', data.entries[uid].keysecondary);
        saveWorldInfo(name, data);
    });

    keySecondaryInput.val(entry.keysecondary.join(', ')).trigger('input');
    initScrollHeight(keySecondaryInput);

    // comment
    const commentInput = template.find('textarea[name="comment"]');
    const commentToggle = template.find('input[name="addMemo"]');
    commentInput.data('uid', entry.uid);
    commentInput.on('input', function () {
        const uid = $(this).data('uid');
        const value = $(this).val();
        resetScrollHeight(this);
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

    commentInput.val(entry.comment).trigger('input');
    initScrollHeight(commentInput);
    commentToggle.prop('checked', true /* entry.addMemo */).trigger('input');
    commentToggle.parent().hide();

    // content
    const counter = template.find('.world_entry_form_token_counter');
    const countTokensDebounced = debounce(function (counter, value) {
        const numberOfTokens = getTokenCount(value);
        $(counter).text(numberOfTokens);
    }, 1000);

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

        const keyprimarytextpole = $(this)
            .closest('.world_entry')
            .find('.keyprimarytextpole');

        const keyprimaryHeight = keyprimarytextpole.outerHeight();
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
    initScrollHeight(positionInput);
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
        } else {
            depthInput.prop('disabled', true);
            depthInput.css('visibility', 'hidden');
            //depthInput.parent().hide();
        }
        updatePosOrdDisplay(uid);
        // Spec v2 only supports before_char and after_char
        setOriginalDataValue(data, uid, 'position', data.entries[uid].position == 0 ? 'before_char' : 'after_char');
        // Write the original value as extensions field
        setOriginalDataValue(data, uid, 'extensions.position', data.entries[uid].position);
        saveWorldInfo(name, data);
    });

    template
        .find(`select[name="position"] option[value=${entry.position}]`)
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
    console.log(entry.uid);
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
                setOriginalDataValue(data, uid, 'enabled', true);
                setOriginalDataValue(data, uid, 'constant', true);
                template.removeClass('disabledWIEntry');
                console.debug('set to constant');
                break;
            case 'normal':
                data.entries[uid].constant = false;
                data.entries[uid].disable = false;
                setOriginalDataValue(data, uid, 'enabled', true);
                setOriginalDataValue(data, uid, 'constant', false);
                template.removeClass('disabledWIEntry');
                console.debug('set to normal');
                break;
            case 'disabled':
                data.entries[uid].constant = false;
                data.entries[uid].disable = true;
                setOriginalDataValue(data, uid, 'enabled', false);
                setOriginalDataValue(data, uid, 'constant', false);
                template.addClass('disabledWIEntry');
                console.debug('set to disabled');
                break;
        }
        saveWorldInfo(name, data);

    });

    const entryState = function () {

        console.log(`constant: ${entry.constant},  disabled: ${entry.disable}`);
        if (entry.constant === true) {
            console.debug('found constant');
            return 'constant';
        } else if (entry.disable === true) {
            console.debug('found disabled');
            return 'disabled';
        } else {
            console.debug('found normal');
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
            return;
        }

        if (value > MAX_SCAN_DEPTH) {
            $(this).val(MAX_SCAN_DEPTH).trigger('input');
            return;
        }

        data.entries[uid].scanDepth = !isEmpty && !isNaN(value) && value >= 0 && value < MAX_SCAN_DEPTH ? Math.floor(value) : null;
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

async function deleteWorldInfoEntry(data, uid) {
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
    selective: true,
    selectiveLogic: world_info_logic.AND_ANY,
    addMemo: false,
    order: 100,
    position: 0,
    disable: false,
    excludeRecursion: false,
    probability: 100,
    useProbability: true,
    depth: DEFAULT_DEPTH,
    group: '',
    scanDepth: null,
    caseSensitive: null,
    matchWholeWords: null,
};

function createWorldInfoEntry(name, data, fromSlashCommand = false) {
    const newUid = getFreeWorldEntryUid(data);

    if (!Number.isInteger(newUid)) {
        console.error('Couldn\'t assign UID to a new entry');
        return;
    }

    const newEntry = { uid: newUid, ...structuredClone(newEntryTemplate) };
    data.entries[newUid] = newEntry;

    if (!fromSlashCommand) {
        updateEditor(newUid);
    }

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
        const newEntries = data ? Object.keys(data.entries).map((x) => data.entries[x]) : [];
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
        const newEntries = data ? Object.keys(data.entries).map((x) => data.entries[x]) : [];
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
    const entries = data ? Object.keys(data.entries).map((x) => data.entries[x]) : [];

    console.debug(`Chat lore has ${entries.length} entries`);

    return entries;
}

async function getSortedEntries() {
    try {
        const globalLore = await getGlobalLore();
        const characterLore = await getCharacterLore();
        const chatLore = await getChatLore();

        let entries;

        switch (Number(world_info_character_strategy)) {
            case world_info_insertion_strategy.evenly:
                console.debug('WI using evenly');
                entries = [...globalLore, ...characterLore].sort(sortFn);
                break;
            case world_info_insertion_strategy.character_first:
                console.debug('WI using char first');
                entries = [...characterLore.sort(sortFn), ...globalLore.sort(sortFn)];
                break;
            case world_info_insertion_strategy.global_first:
                console.debug('WI using global first');
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

async function checkWorldInfo(chat, maxContext) {
    const context = getContext();
    const buffer = new WorldInfoBuffer(chat);

    // Combine the chat
    let minActivationMsgIndex = world_info_depth; // tracks chat index to satisfy `world_info_min_activations`

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
        return { worldInfoBefore: '', worldInfoAfter: '' };
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
                const tagKey = getTagKeyForCharacter(this_chid);

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

            if (allActivatedEntries.has(entry) || entry.disable == true || (count > 1 && world_info_recursive && entry.excludeRecursion)) {
                continue;
            }

            if (entry.constant) {
                entry.content = substituteParams(entry.content);
                activatedNow.add(entry);
                continue;
            }

            if (Array.isArray(entry.key) && entry.key.length) { //check for keywords existing
                // If selectiveLogic isn't found, assume it's AND, only do this once per entry
                const selectiveLogic = entry.selectiveLogic ?? 0;

                primary: for (let key of entry.key) {
                    const substituted = substituteParams(key);
                    const textToScan = buffer.get(entry);

                    console.debug(`${entry.uid}: ${substituted}`);

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
                    } else { console.debug(`No active entries for logic checks for word: ${substituted}.`); }
                }
            }
        }

        needsToScan = world_info_recursive && activatedNow.size > 0;
        const newEntries = [...activatedNow]
            .sort((a, b) => sortedEntries.indexOf(a) - sortedEntries.indexOf(b));
        let newContent = '';
        const textToScanTokens = getTokenCount(allActivatedText);
        const probabilityChecksBefore = failedProbabilityChecks.size;

        filterByInclusionGroups(newEntries, allActivatedEntries);

        console.debug('-- PROBABILITY CHECKS BEGIN --');
        for (const entry of newEntries) {
            const rollValue = Math.random() * 100;

            if (entry.useProbability && rollValue > entry.probability) {
                console.debug(`WI entry ${entry.uid} ${entry.key} failed probability check, skipping`);
                failedProbabilityChecks.add(entry);
                continue;
            } else { console.debug(`uid:${entry.uid} passed probability check, inserting to prompt`); }

            newContent += `${substituteParams(entry.content)}\n`;

            if (textToScanTokens + getTokenCount(newContent) >= budget) {
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
                let over_max = false;
                over_max = (
                    world_info_min_activations_depth_max > 0 &&
                    minActivationMsgIndex > world_info_min_activations_depth_max
                ) || (minActivationMsgIndex >= chat.length);
                if (!over_max) {
                    needsToScan = true;
                    minActivationMsgIndex += 1;
                    buffer.addSkew();
                }
            }
        }
    }

    // Forward-sorted list of entries for joining
    const WIBeforeEntries = [];
    const WIAfterEntries = [];
    const ANTopEntries = [];
    const ANBottomEntries = [];
    const WIDepthEntries = [];

    // Appends from insertion order 999 to 1. Use unshift for this purpose
    [...allActivatedEntries].sort(sortFn).forEach((entry) => {
        switch (entry.position) {
            case world_info_position.before:
                WIBeforeEntries.unshift(substituteParams(entry.content));
                break;
            case world_info_position.after:
                WIAfterEntries.unshift(substituteParams(entry.content));
                break;
            case world_info_position.ANTop:
                ANTopEntries.unshift(entry.content);
                break;
            case world_info_position.ANBottom:
                ANBottomEntries.unshift(entry.content);
                break;
            case world_info_position.atDepth: {
                const existingDepthIndex = WIDepthEntries.findIndex((e) => e.depth === entry.depth ?? DEFAULT_DEPTH);
                if (existingDepthIndex !== -1) {
                    WIDepthEntries[existingDepthIndex].entries.unshift(entry.content);
                } else {
                    WIDepthEntries.push({
                        depth: entry.depth,
                        entries: [entry.content],
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
        context.setExtensionPrompt(NOTE_MODULE_NAME, ANWithWI, chat_metadata[metadata_keys.position], chat_metadata[metadata_keys.depth], extension_settings.note.allowWIScan);
    }

    return { worldInfoBefore, worldInfoAfter, WIDepthEntries };
}

/**
 * Filters entries by inclusion groups.
 * @param {object[]} newEntries Entries activated on current recursion level
 * @param {Set<object>} allActivatedEntries Set of all activated entries
 */
function filterByInclusionGroups(newEntries, allActivatedEntries) {
    console.debug('-- INCLUSION GROUP CHECKS BEGIN --');
    const grouped = newEntries.filter(x => x.group).reduce((acc, item) => {
        if (!acc[item.group]) {
            acc[item.group] = [];
        }
        acc[item.group].push(item);
        return acc;
    }, {});

    if (Object.keys(grouped).length === 0) {
        console.debug('No inclusion groups found');
        return;
    }

    for (const [key, group] of Object.entries(grouped)) {
        console.debug(`Checking inclusion group '${key}' with ${group.length} entries`, group);

        if (Array.from(allActivatedEntries).some(x => x.group === key)) {
            console.debug(`Skipping inclusion group check, group already activated '${key}'`);
            // We need to forcefully deactivate all other entries in the group
            for (const entry of group) {
                newEntries.splice(newEntries.indexOf(entry), 1);
            }
            continue;
        }

        if (!Array.isArray(group) || group.length <= 1) {
            console.debug('Skipping inclusion group check, only one entry');
            continue;
        }

        // Do weighted random using probability of entry as weight
        const totalWeight = group.reduce((acc, item) => acc + item.probability, 0);
        const rollValue = Math.random() * totalWeight;
        let currentWeight = 0;
        let winner = null;

        for (const entry of group) {
            currentWeight += entry.probability;

            if (rollValue <= currentWeight) {
                console.debug(`Activated inclusion group '${key}' with entry '${entry.uid}'`, entry);
                winner = entry;
                break;
            }
        }

        if (!winner) {
            console.debug(`Failed to activate inclusion group '${key}', no winner found`);
            continue;
        }

        // Remove every group item from newEntries but the winner
        for (const entry of group) {
            if (entry === winner) {
                continue;
            }

            console.debug(`Removing loser from inclusion group '${key}' entry '${entry.uid}'`, entry);
            newEntries.splice(newEntries.indexOf(entry), 1);
        }
    }
}

function convertAgnaiMemoryBook(inputObj) {
    const outputObj = { entries: {} };

    inputObj.entries.forEach((entry, index) => {
        outputObj.entries[index] = {
            uid: index,
            key: entry.keywords,
            keysecondary: [],
            comment: entry.name,
            content: entry.entry,
            constant: false,
            selective: false,
            selectiveLogic: world_info_logic.AND_ANY,
            order: entry.weight,
            position: 0,
            disable: !entry.enabled,
            addMemo: !!entry.name,
            excludeRecursion: false,
            displayIndex: index,
            probability: null,
            useProbability: false,
            group: '',
        };
    });

    return outputObj;
}

function convertRisuLorebook(inputObj) {
    const outputObj = { entries: {} };

    inputObj.data.forEach((entry, index) => {
        outputObj.entries[index] = {
            uid: index,
            key: entry.key.split(',').map(x => x.trim()),
            keysecondary: entry.secondkey ? entry.secondkey.split(',').map(x => x.trim()) : [],
            comment: entry.comment,
            content: entry.content,
            constant: entry.alwaysActive,
            selective: entry.selective,
            selectiveLogic: world_info_logic.AND_ANY,
            order: entry.insertorder,
            position: world_info_position.before,
            disable: false,
            addMemo: true,
            excludeRecursion: false,
            displayIndex: index,
            probability: entry.activationPercent ?? null,
            useProbability: entry.activationPercent ?? false,
            group: '',
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
            uid: index,
            key: entry.keys,
            keysecondary: [],
            comment: displayName || '',
            content: entry.text,
            constant: false,
            selective: false,
            selectiveLogic: world_info_logic.AND_ANY,
            order: entry.contextConfig?.budgetPriority ?? 0,
            position: 0,
            disable: !entry.enabled,
            addMemo: addMemo,
            excludeRecursion: false,
            displayIndex: index,
            probability: null,
            useProbability: false,
            group: '',
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
            disable: !entry.enabled,
            addMemo: entry.comment ? true : false,
            displayIndex: entry.extensions?.display_index ?? index,
            probability: entry.extensions?.probability ?? null,
            useProbability: entry.extensions?.useProbability ?? false,
            depth: entry.extensions?.depth ?? DEFAULT_DEPTH,
            selectiveLogic: entry.extensions?.selectiveLogic ?? world_info_logic.AND_ANY,
            group: entry.extensions?.group ?? '',
            scanDepth: entry.extensions?.scan_depth ?? null,
            caseSensitive: entry.extensions?.case_sensitive ?? null,
            matchWholeWords: entry.extensions?.match_whole_words ?? null,
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
        error: (jqXHR, exception) => { },
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

    $(document).ready(function () {
        registerSlashCommand('world', onWorldInfoChange, [], '<span class="monospace">[optional state=off|toggle] [optional silent=true] (optional name)</span> – sets active World, or unsets if no args provided, use <code>state=off</code> and <code>state=toggle</code> to deactivate or toggle a World, use <code>silent=true</code> to suppress toast messages', true, true);
    });


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

    $('#world_info_search').on('input', function () {
        const term = $(this).val();
        worldInfoFilter.setFilterData(FILTER_TYPES.WORLD_INFO_SEARCH, term);
    });

    $('#world_refresh').on('click', () => {
        updateEditor(navigation_option.previous);
    });

    $('#world_info_sort_order').on('change', function () {
        const value = String($(this).find(':selected').val());
        localStorage.setItem(SORT_ORDER_KEY, value);
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
    }
});
