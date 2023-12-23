import { humanizedDateTime, favsToHotswap, getMessageTimeStamp, dragElement, isMobile, initRossMods } from './scripts/RossAscends-mods.js';
import { userStatsHandler, statMesProcess, initStats } from './scripts/stats.js';
import {
    generateKoboldWithStreaming,
    kai_settings,
    loadKoboldSettings,
    formatKoboldUrl,
    getKoboldGenerationData,
    kai_flags,
    setKoboldFlags,
} from './scripts/kai-settings.js';

import {
    textgenerationwebui_settings as textgen_settings,
    loadTextGenSettings,
    generateTextGenWithStreaming,
    getTextGenGenerationData,
    textgen_types,
    textgenerationwebui_banned_in_macros,
    getTextGenServer,
    validateTextGenUrl,
} from './scripts/textgen-settings.js';

const { MANCER, TOGETHERAI, OOBA, APHRODITE, OLLAMA } = textgen_types;

import {
    world_info,
    getWorldInfoPrompt,
    getWorldInfoSettings,
    setWorldInfoSettings,
    world_names,
    importEmbeddedWorldInfo,
    checkEmbeddedWorld,
    setWorldInfoButtonClass,
    importWorldInfo,
} from './scripts/world-info.js';

import {
    groups,
    selected_group,
    saveGroupChat,
    getGroups,
    generateGroupWrapper,
    deleteGroup,
    is_group_generating,
    resetSelectedGroup,
    select_group_chats,
    regenerateGroup,
    group_generation_id,
    getGroupChat,
    renameGroupMember,
    createNewGroupChat,
    getGroupPastChats,
    getGroupAvatar,
    openGroupChat,
    editGroup,
    deleteGroupChat,
    renameGroupChat,
    importGroupChat,
    getGroupBlock,
    getGroupCharacterCards,
    getGroupDepthPrompts,
} from './scripts/group-chats.js';

import {
    collapseNewlines,
    loadPowerUserSettings,
    playMessageSound,
    fixMarkdown,
    power_user,
    persona_description_positions,
    loadMovingUIState,
    getCustomStoppingStrings,
    MAX_CONTEXT_DEFAULT,
    MAX_RESPONSE_DEFAULT,
    renderStoryString,
    sortEntitiesList,
    registerDebugFunction,
    ui_mode,
    switchSimpleMode,
    flushEphemeralStoppingStrings,
} from './scripts/power-user.js';

import {
    setOpenAIMessageExamples,
    setOpenAIMessages,
    setupChatCompletionPromptManager,
    prepareOpenAIMessages,
    sendOpenAIRequest,
    loadOpenAISettings,
    oai_settings,
    openai_messages_count,
    chat_completion_sources,
    getChatCompletionModel,
    isOpenRouterWithInstruct,
} from './scripts/openai.js';

import {
    generateNovelWithStreaming,
    getNovelGenerationData,
    getKayraMaxContextTokens,
    getNovelTier,
    loadNovelPreset,
    loadNovelSettings,
    nai_settings,
    adjustNovelInstructionPrompt,
    loadNovelSubscriptionData,
} from './scripts/nai-settings.js';

import {
    createNewBookmark,
    showBookmarksButtons,
    createBranch,
} from './scripts/bookmarks.js';

import {
    horde_settings,
    loadHordeSettings,
    generateHorde,
    checkHordeStatus,
    getHordeModels,
    adjustHordeGenerationParams,
    MIN_LENGTH,
} from './scripts/horde.js';

import {
    debounce,
    delay,
    trimToEndSentence,
    countOccurrences,
    isOdd,
    sortMoments,
    timestampToMoment,
    download,
    isDataURL,
    getCharaFilename,
    isDigitsOnly,
    PAGINATION_TEMPLATE,
    waitUntilCondition,
    escapeRegex,
    resetScrollHeight,
    onlyUnique,
    getBase64Async,
    humanFileSize,
    Stopwatch,
} from './scripts/utils.js';

import { ModuleWorkerWrapper, doDailyExtensionUpdatesCheck, extension_settings, getContext, loadExtensionSettings, renderExtensionTemplate, runGenerationInterceptors, saveMetadataDebounced } from './scripts/extensions.js';
import { COMMENT_NAME_DEFAULT, executeSlashCommands, getSlashCommandsHelp, processChatSlashCommands, registerSlashCommand } from './scripts/slash-commands.js';
import {
    tag_map,
    tags,
    loadTagsSettings,
    printTagFilters,
    getTagsList,
    appendTagToList,
    createTagMapFromList,
    renameTagKey,
    importTags,
    tag_filter_types,
} from './scripts/tags.js';
import {
    SECRET_KEYS,
    readSecretState,
    secret_state,
    writeSecret,
} from './scripts/secrets.js';
import { EventEmitter } from './lib/eventemitter.js';
import { markdownExclusionExt } from './scripts/showdown-exclusion.js';
import { NOTE_MODULE_NAME, initAuthorsNote, metadata_keys, setFloatingPrompt, shouldWIAddPrompt } from './scripts/authors-note.js';
import { registerPromptManagerMigration } from './scripts/PromptManager.js';
import { getRegexedString, regex_placement } from './scripts/extensions/regex/engine.js';
import { FILTER_TYPES, FilterHelper } from './scripts/filters.js';
import { getCfgPrompt, getGuidanceScale, initCfg } from './scripts/cfg-scale.js';
import {
    force_output_sequence,
    formatInstructModeChat,
    formatInstructModePrompt,
    formatInstructModeExamples,
    getInstructStoppingSequences,
    autoSelectInstructPreset,
    formatInstructModeSystemPrompt,
    replaceInstructMacros,
} from './scripts/instruct-mode.js';
import { applyLocale, initLocales } from './scripts/i18n.js';
import { getFriendlyTokenizerName, getTokenCount, getTokenizerModel, initTokenizers, saveTokenCache } from './scripts/tokenizers.js';
import { createPersona, initPersonas, selectCurrentPersona, setPersonaDescription, updatePersonaNameIfExists } from './scripts/personas.js';
import { getBackgrounds, initBackgrounds, loadBackgroundSettings, background_settings } from './scripts/backgrounds.js';
import { hideLoader, showLoader } from './scripts/loader.js';
import { BulkEditOverlay, CharacterContextMenu } from './scripts/BulkEditOverlay.js';
import { loadMancerModels, loadOllamaModels, loadTogetherAIModels } from './scripts/textgen-models.js';
import { appendFileContent, hasPendingFileAttachment, populateFileAttachment, decodeStyleTags, encodeStyleTags } from './scripts/chats.js';
import { replaceVariableMacros } from './scripts/variables.js';
import { initPresetManager } from './scripts/preset-manager.js';

//exporting functions and vars for mods
export {
    Generate,
    getSettings,
    saveSettings,
    saveSettingsDebounced,
    printMessages,
    clearChat,
    getChat,
    getCharacters,
    callPopup,
    substituteParams,
    sendSystemMessage,
    addOneMessage,
    deleteLastMessage,
    resetChatState,
    select_rm_info,
    setCharacterId,
    setCharacterName,
    replaceCurrentChat,
    setOnlineStatus,
    displayOnlineStatus,
    setEditedMessageId,
    setSendButtonState,
    selectRightMenuWithAnimation,
    openCharacterChat,
    saveChat,
    messageFormatting,
    getExtensionPrompt,
    getExtensionPromptByName,
    showSwipeButtons,
    hideSwipeButtons,
    changeMainAPI,
    setGenerationProgress,
    updateChatMetadata,
    scrollChatToBottom,
    isStreamingEnabled,
    getThumbnailUrl,
    getStoppingStrings,
    reloadMarkdownProcessor,
    getCurrentChatId,
    chat,
    this_chid,
    selected_button,
    menu_type,
    settings,
    characters,
    online_status,
    main_api,
    api_server,
    system_messages,
    nai_settings,
    token,
    name1,
    name2,
    is_send_press,
    max_context,
    chat_metadata,
    streamingProcessor,
    default_avatar,
    system_message_types,
    talkativeness_default,
    default_ch_mes,
    extension_prompt_types,
    mesForShowdownParse,
    printCharacters,
    isOdd,
    countOccurrences,
};

showLoader();
// Yoink preloader entirely; it only exists to cover up unstyled content while loading JS
document.getElementById('preloader').remove();

// Allow target="_blank" in links
DOMPurify.addHook('afterSanitizeAttributes', function (node) {
    if ('target' in node) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener');
    }
});

DOMPurify.addHook("uponSanitizeAttribute", (_, data, config) => {
    if (!config['MESSAGE_SANITIZE']) {
        return;
    }
    switch (data.attrName) {
        case 'class': {
            if (data.attrValue) {
                data.attrValue = data.attrValue.split(' ').map((v) => {
                    if (v.startsWith('fa-') || v.startsWith('note-') || v === 'monospace') {
                        return v;
                    }

                    return "custom-" + v;
                }).join(' ');
            }
            break;
        }
    }
});

// API OBJECT FOR EXTERNAL WIRING
window['SillyTavern'] = {};

// Event source init
export const event_types = {
    APP_READY: 'app_ready',
    EXTRAS_CONNECTED: 'extras_connected',
    MESSAGE_SWIPED: 'message_swiped',
    MESSAGE_SENT: 'message_sent',
    MESSAGE_RECEIVED: 'message_received',
    MESSAGE_EDITED: 'message_edited',
    MESSAGE_DELETED: 'message_deleted',
    IMPERSONATE_READY: 'impersonate_ready',
    CHAT_CHANGED: 'chat_id_changed',
    GENERATION_STARTED: 'generation_started',
    GENERATION_STOPPED: 'generation_stopped',
    EXTENSIONS_FIRST_LOAD: 'extensions_first_load',
    SETTINGS_LOADED: 'settings_loaded',
    SETTINGS_UPDATED: 'settings_updated',
    GROUP_UPDATED: 'group_updated',
    MOVABLE_PANELS_RESET: 'movable_panels_reset',
    SETTINGS_LOADED_BEFORE: 'settings_loaded_before',
    SETTINGS_LOADED_AFTER: 'settings_loaded_after',
    CHATCOMPLETION_SOURCE_CHANGED: 'chatcompletion_source_changed',
    CHATCOMPLETION_MODEL_CHANGED: 'chatcompletion_model_changed',
    OAI_BEFORE_CHATCOMPLETION: 'oai_before_chatcompletion',
    OAI_PRESET_CHANGED_BEFORE: 'oai_preset_changed_before',
    OAI_PRESET_CHANGED_AFTER: 'oai_preset_changed_after',
    WORLDINFO_SETTINGS_UPDATED: 'worldinfo_settings_updated',
    CHARACTER_EDITED: 'character_edited',
    CHARACTER_PAGE_LOADED: 'character_page_loaded',
    CHARACTER_GROUP_OVERLAY_STATE_CHANGE_BEFORE: 'character_group_overlay_state_change_before',
    CHARACTER_GROUP_OVERLAY_STATE_CHANGE_AFTER: 'character_group_overlay_state_change_after',
    USER_MESSAGE_RENDERED: 'user_message_rendered',
    CHARACTER_MESSAGE_RENDERED: 'character_message_rendered',
    FORCE_SET_BACKGROUND: 'force_set_background',
    CHAT_DELETED: 'chat_deleted',
    GROUP_CHAT_DELETED: 'group_chat_deleted',
    GENERATE_BEFORE_COMBINE_PROMPTS: 'generate_before_combine_prompts',
};

export const eventSource = new EventEmitter();

eventSource.on(event_types.CHAT_CHANGED, processChatSlashCommands);

const characterGroupOverlay = new BulkEditOverlay();
const characterContextMenu = new CharacterContextMenu(characterGroupOverlay);
eventSource.on(event_types.CHARACTER_PAGE_LOADED, characterGroupOverlay.onPageLoad);
console.debug('Character context menu initialized', characterContextMenu);

hljs.addPlugin({ 'before:highlightElement': ({ el }) => { el.textContent = el.innerText; } });

// Markdown converter
let mesForShowdownParse; //intended to be used as a context to compare showdown strings against
let converter;
reloadMarkdownProcessor();

// array for prompt token calculations
console.debug('initializing Prompt Itemization Array on Startup');
const promptStorage = new localforage.createInstance({ name: 'SillyTavern_Prompts' });
let itemizedPrompts = [];

export const systemUserName = 'SillyTavern System';
let default_user_name = 'User';
let name1 = default_user_name;
let name2 = 'SillyTavern System';
let chat = [];
let safetychat = [
    {
        name: systemUserName,
        is_user: false,
        create_date: 0,
        mes: 'You deleted a character/chat and arrived back here for safety reasons! Pick another character!',
    },
];
let chatSaveTimeout;
let importFlashTimeout;
export let isChatSaving = false;
let chat_create_date = 0;
let firstRun = false;
let settingsReady = false;
let currentVersion = '0.0.0';

const default_ch_mes = 'Hello';
let count_view_mes = 0;
let generatedPromptCache = '';
let generation_started = new Date();
let characters = [];
let this_chid;
let saveCharactersPage = 0;
const default_avatar = 'img/ai4.png';
export const system_avatar = 'img/five.png';
export const comment_avatar = 'img/quill.png';
export let CLIENT_VERSION = 'SillyTavern:UNKNOWN:Cohee#1207'; // For Horde header
let optionsPopper = Popper.createPopper(document.getElementById('options_button'), document.getElementById('options'), {
    placement: 'top-start',
});
let exportPopper = Popper.createPopper(document.getElementById('export_button'), document.getElementById('export_format_popup'), {
    placement: 'left',
});
let rawPromptPopper = Popper.createPopper(document.getElementById('dialogue_popup'), document.getElementById('rawPromptPopup'), {
    placement: 'right',
});

let dialogueResolve = null;
let dialogueCloseStop = false;
let chat_metadata = {};
let streamingProcessor = null;
let crop_data = undefined;
let is_delete_mode = false;
let fav_ch_checked = false;
let scrollLock = false;
export let abortStatusCheck = new AbortController();

const durationSaveEdit = 1000;
const saveSettingsDebounced = debounce(() => saveSettings(), durationSaveEdit);
export const saveCharacterDebounced = debounce(() => $('#create_button').trigger('click'), durationSaveEdit);

const system_message_types = {
    HELP: 'help',
    WELCOME: 'welcome',
    GROUP: 'group',
    EMPTY: 'empty',
    GENERIC: 'generic',
    BOOKMARK_CREATED: 'bookmark_created',
    BOOKMARK_BACK: 'bookmark_back',
    NARRATOR: 'narrator',
    COMMENT: 'comment',
    SLASH_COMMANDS: 'slash_commands',
    FORMATTING: 'formatting',
    HOTKEYS: 'hotkeys',
    MACROS: 'macros',
};

const extension_prompt_types = {
    IN_PROMPT: 0,
    IN_CHAT: 1,
    BEFORE_PROMPT: 2,
};

export const MAX_INJECTION_DEPTH = 1000;

let system_messages = {};

function getSystemMessages() {
    system_messages = {
        help: {
            name: systemUserName,
            force_avatar: system_avatar,
            is_user: false,
            is_system: true,
            mes: renderTemplate('help'),
        },
        slash_commands: {
            name: systemUserName,
            force_avatar: system_avatar,
            is_user: false,
            is_system: true,
            mes: '',
        },
        hotkeys: {
            name: systemUserName,
            force_avatar: system_avatar,
            is_user: false,
            is_system: true,
            mes: renderTemplate('hotkeys'),
        },
        formatting: {
            name: systemUserName,
            force_avatar: system_avatar,
            is_user: false,
            is_system: true,
            mes: renderTemplate('formatting'),
        },
        macros: {
            name: systemUserName,
            force_avatar: system_avatar,
            is_user: false,
            is_system: true,
            mes: renderTemplate('macros'),
        },
        welcome:
        {
            name: systemUserName,
            force_avatar: system_avatar,
            is_user: false,
            is_system: true,
            mes: renderTemplate('welcome'),
        },
        group: {
            name: systemUserName,
            force_avatar: system_avatar,
            is_user: false,
            is_system: true,
            is_group: true,
            mes: 'Group chat created. Say \'Hi\' to lovely people!',
        },
        empty: {
            name: systemUserName,
            force_avatar: system_avatar,
            is_user: false,
            is_system: true,
            mes: 'No one hears you. <b>Hint&#58;</b> add more members to the group!',
        },
        generic: {
            name: systemUserName,
            force_avatar: system_avatar,
            is_user: false,
            is_system: true,
            mes: 'Generic system message. User `text` parameter to override the contents',
        },
        bookmark_created: {
            name: systemUserName,
            force_avatar: system_avatar,
            is_user: false,
            is_system: true,
            mes: 'Checkpoint created! Click here to open the checkpoint chat: <a class="bookmark_link" file_name="{0}" href="javascript:void(null);">{1}</a>',
        },
        bookmark_back: {
            name: systemUserName,
            force_avatar: system_avatar,
            is_user: false,
            is_system: true,
            mes: 'Click here to return to the previous chat: <a class="bookmark_link" file_name="{0}" href="javascript:void(null);">Return</a>',
        },
    };
}

// Register configuration migrations
registerPromptManagerMigration();

$(document).ajaxError(function myErrorHandler(_, xhr) {
    if (xhr.status == 403) {
        toastr.warning(
            'doubleCsrf errors in console are NORMAL in this case. If you want to run ST in multiple tabs, start the server with --disableCsrf option.',
            'Looks like you\'ve opened SillyTavern in another browser tab',
            { timeOut: 0, extendedTimeOut: 0, preventDuplicates: true },
        );
    }
});

function getUrlSync(url, cache = true) {
    return $.ajax({
        type: 'GET',
        url: url,
        cache: cache,
        async: false,
    }).responseText;
}

const templateCache = new Map();

export function renderTemplate(templateId, templateData = {}, sanitize = true, localize = true, fullPath = false) {
    try {
        const pathToTemplate = fullPath ? templateId : `/scripts/templates/${templateId}.html`;
        let template = templateCache.get(pathToTemplate);
        if (!template) {
            const templateContent = getUrlSync(pathToTemplate);
            template = Handlebars.compile(templateContent);
            templateCache.set(pathToTemplate, template);
        }
        let result = template(templateData);

        if (sanitize) {
            result = DOMPurify.sanitize(result);
        }

        if (localize) {
            result = applyLocale(result);
        }

        return result;
    } catch (err) {
        console.error('Error rendering template', templateId, templateData, err);
        toastr.error('Check the DevTools console for more information.', 'Error rendering template');
    }
}

async function getClientVersion() {
    try {
        const response = await fetch('/version');
        const data = await response.json();
        CLIENT_VERSION = data.agent;
        let displayVersion = `SillyTavern ${data.pkgVersion}`;
        currentVersion = data.pkgVersion;

        if (data.gitRevision && data.gitBranch) {
            displayVersion += ` '${data.gitBranch}' (${data.gitRevision})`;
        }

        $('#version_display').text(displayVersion);
        $('#version_display_welcome').text(displayVersion);
    } catch (err) {
        console.error('Couldn\'t get client version', err);
    }
}

function reloadMarkdownProcessor(render_formulas = false) {
    if (render_formulas) {
        converter = new showdown.Converter({
            emoji: true,
            underline: true,
            tables: true,
            parseImgDimensions: true,
            extensions: [
                showdownKatex(
                    {
                        delimiters: [
                            { left: '$$', right: '$$', display: true, asciimath: false },
                            { left: '$', right: '$', display: false, asciimath: true },
                        ],
                    },
                )],
        });
    }
    else {
        converter = new showdown.Converter({
            emoji: true,
            literalMidWordUnderscores: true,
            parseImgDimensions: true,
            tables: true,
        });
    }

    // Inject the dinkus extension after creating the converter
    // Maybe move this into power_user init?
    setTimeout(() => {
        if (power_user) {
            converter.addExtension(markdownExclusionExt(), 'exclusion');
        }
    }, 1);

    return converter;
}

function getCurrentChatId() {
    console.debug(`selectedGroup:${selected_group}, this_chid:${this_chid}`);
    if (selected_group) {
        return groups.find(x => x.id == selected_group)?.chat_id;
    }
    else if (this_chid) {
        return characters[this_chid]?.chat;
    }
}

const talkativeness_default = 0.5;
export const depth_prompt_depth_default = 4;
const per_page_default = 50;

var is_advanced_char_open = false;

var menu_type = ''; //what is selected in the menu
var selected_button = ''; //which button pressed
//create pole save
let create_save = {
    name: '',
    description: '',
    creator_notes: '',
    post_history_instructions: '',
    character_version: '',
    system_prompt: '',
    tags: '',
    creator: '',
    personality: '',
    first_message: '',
    avatar: '',
    scenario: '',
    mes_example: '',
    world: '',
    talkativeness: talkativeness_default,
    alternate_greetings: [],
    depth_prompt_prompt: '',
    depth_prompt_depth: depth_prompt_depth_default,
};

//animation right menu
export const ANIMATION_DURATION_DEFAULT = 125;
export let animation_duration = ANIMATION_DURATION_DEFAULT;
let animation_easing = 'ease-in-out';
let popup_type = '';
let chat_file_for_del = '';
let online_status = 'no_connection';

let api_server = '';

let is_send_press = false; //Send generation

let this_del_mes = -1;

//message editing and chat scroll position persistence
var this_edit_mes_chname = '';
var this_edit_mes_id;
var scroll_holder = 0;
var is_use_scroll_holder = false;

//settings
var settings;
export let koboldai_settings;
export let koboldai_setting_names;
var preset_settings = 'gui';
export let user_avatar = 'you.png';
export var amount_gen = 80; //default max length of AI generated responses
var max_context = 2048;

var swipes = true;
let extension_prompts = {};

var main_api;// = "kobold";
//novel settings
export let novelai_settings;
export let novelai_setting_names;
let abortController;

//css
var css_mes_bg = $('<div class="mes"></div>').css('background');
var css_send_form_display = $('<div id=send_form></div>').css('display');
const MAX_GENERATION_LOOPS = 5;

var kobold_horde_model = '';

let token;

var PromptArrayItemForRawPromptDisplay;

export let active_character = '';
export let active_group = '';
export const entitiesFilter = new FilterHelper(debounce(printCharacters, 100));

export function getRequestHeaders() {
    return {
        'Content-Type': 'application/json',
        'X-CSRF-Token': token,
    };
}

$.ajaxPrefilter((options, originalOptions, xhr) => {
    xhr.setRequestHeader('X-CSRF-Token', token);
});

async function firstLoadInit() {
    try {
        const tokenResponse = await fetch('/csrf-token');
        const tokenData = await tokenResponse.json();
        token = tokenData.token;
    } catch {
        hideLoader();
        toastr.error('Couldn\'t get CSRF token. Please refresh the page.', 'Error', { timeOut: 0, extendedTimeOut: 0, preventDuplicates: true });
        throw new Error('Initialization failed');
    }

    getSystemMessages();
    sendSystemMessage(system_message_types.WELCOME);
    initLocales();
    await readSecretState();
    await getClientVersion();
    await getSettings();
    await getUserAvatars();
    await getCharacters();
    await getBackgrounds();
    await initTokenizers();
    await initPresetManager();
    initBackgrounds();
    initAuthorsNote();
    initPersonas();
    initRossMods();
    initStats();
    initCfg();
    doDailyExtensionUpdatesCheck();
    hideLoader();
    await eventSource.emit(event_types.APP_READY);
}

function cancelStatusCheck() {
    abortStatusCheck?.abort();
    abortStatusCheck = new AbortController();
    setOnlineStatus('no_connection');
}

function displayOnlineStatus() {
    if (online_status == 'no_connection') {
        $('.online_status_indicator').removeClass('success');
        $('.online_status_text').text('No connection...');
    } else {
        $('.online_status_indicator').addClass('success');
        $('.online_status_text').text(online_status);
    }
}

/**
 * Sets the duration of JS animations.
 * @param {number} ms Duration in milliseconds. Resets to default if null.
 */
export function setAnimationDuration(ms = null) {
    animation_duration = ms ?? ANIMATION_DURATION_DEFAULT;
}

export function setActiveCharacter(character) {
    active_character = character;
}

export function setActiveGroup(group) {
    active_group = group;
}

/**
 * Gets the itemized prompts for a chat.
 * @param {string} chatId Chat ID to load
 */
export async function loadItemizedPrompts(chatId) {
    try {
        if (!chatId) {
            itemizedPrompts = [];
            return;
        }

        itemizedPrompts = await promptStorage.getItem(chatId);

        if (!itemizedPrompts) {
            itemizedPrompts = [];
        }
    } catch {
        console.log('Error loading itemized prompts for chat', chatId);
        itemizedPrompts = [];
    }
}

/**
 * Saves the itemized prompts for a chat.
 * @param {string} chatId Chat ID to save itemized prompts for
 */
export async function saveItemizedPrompts(chatId) {
    try {
        if (!chatId) {
            return;
        }

        await promptStorage.setItem(chatId, itemizedPrompts);
    } catch {
        console.log('Error saving itemized prompts for chat', chatId);
    }
}

/**
 * Replaces the itemized prompt text for a message.
 * @param {number} mesId Message ID to get itemized prompt for
 * @param {string} promptText New raw prompt text
 * @returns
 */
export async function replaceItemizedPromptText(mesId, promptText) {
    if (!Array.isArray(itemizedPrompts)) {
        itemizedPrompts = [];
    }

    const itemizedPrompt = itemizedPrompts.find(x => x.mesId === mesId);

    if (!itemizedPrompt) {
        return;
    }

    itemizedPrompt.rawPrompt = promptText;
}

/**
 * Deletes the itemized prompts for a chat.
 * @param {string} chatId Chat ID to delete itemized prompts for
 */
export async function deleteItemizedPrompts(chatId) {
    try {
        if (!chatId) {
            return;
        }

        await promptStorage.removeItem(chatId);
    } catch {
        console.log('Error deleting itemized prompts for chat', chatId);
    }
}

/**
 * Empties the itemized prompts array and caches.
 */
export async function clearItemizedPrompts() {
    try {
        await promptStorage.clear();
        itemizedPrompts = [];
    } catch {
        console.log('Error clearing itemized prompts');
    }
}

async function getStatusHorde() {
    try {
        const hordeStatus = await checkHordeStatus();
        online_status = hordeStatus ? 'Connected' : 'no_connection';
    }
    catch {
        online_status = 'no_connection';
    }

    return resultCheckStatus();
}

async function getStatusKobold() {
    let endpoint = api_server;

    if (!endpoint) {
        console.warn('No endpoint for status check');
        online_status = 'no_connection';
        return resultCheckStatus();
    }

    try {
        const response = await fetch('/api/backends/kobold/status', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                main_api,
                api_server: endpoint,
            }),
            signal: abortStatusCheck.signal,
        });

        const data = await response.json();

        online_status = data?.model ?? 'no_connection';

        if (!data.koboldUnitedVersion) {
            throw new Error('Missing mandatory Kobold version in data:', data);
        }

        // Determine instruct mode preset
        autoSelectInstructPreset(online_status);

        // determine if we can use stop sequence and streaming
        setKoboldFlags(data.koboldUnitedVersion, data.koboldCppVersion);

        // We didn't get a 200 status code, but the endpoint has an explanation. Which means it DID connect, but I digress.
        if (online_status === 'no_connection' && data.response) {
            toastr.error(data.response, 'API Error', { timeOut: 5000, preventDuplicates: true });
        }
    } catch (err) {
        console.error('Error getting status', err);
        online_status = 'no_connection';
    }

    return resultCheckStatus();
}

async function getStatusTextgen() {
    const url = '/api/backends/text-completions/status';

    const endpoint = getTextGenServer();

    if (!endpoint) {
        console.warn('No endpoint for status check');
        online_status = 'no_connection';
        return resultCheckStatus();
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                api_server: endpoint,
                api_type: textgen_settings.type,
                legacy_api: textgen_settings.legacy_api && (textgen_settings.type === OOBA || textgen_settings.type === APHRODITE),
            }),
            signal: abortStatusCheck.signal,
        });

        const data = await response.json();

        if (textgen_settings.type === MANCER) {
            loadMancerModels(data?.data);
            online_status = textgen_settings.mancer_model;
        } else if (textgen_settings.type === TOGETHERAI) {
            loadTogetherAIModels(data?.data);
            online_status = textgen_settings.togetherai_model;
        } else if (textgen_settings.type === OLLAMA) {
            loadOllamaModels(data?.data);
            online_status = textgen_settings.ollama_model || 'Connected';
        } else {
            online_status = data?.result;
        }

        if (!online_status) {
            online_status = 'no_connection';
        }

        // Determine instruct mode preset
        autoSelectInstructPreset(online_status);

        // We didn't get a 200 status code, but the endpoint has an explanation. Which means it DID connect, but I digress.
        if (online_status === 'no_connection' && data.response) {
            toastr.error(data.response, 'API Error', { timeOut: 5000, preventDuplicates: true });
        }
    } catch (err) {
        console.error('Error getting status', err);
        online_status = 'no_connection';
    }

    return resultCheckStatus();
}

async function getStatusNovel() {
    try {
        const result = await loadNovelSubscriptionData();

        if (!result) {
            throw new Error('Could not load subscription data');
        }

        online_status = getNovelTier();
    } catch {
        online_status = 'no_connection';
    }

    resultCheckStatus();
}

export function startStatusLoading() {
    $('.api_loading').show();
    $('.api_button').addClass('disabled');
}

export function stopStatusLoading() {
    $('.api_loading').hide();
    $('.api_button').removeClass('disabled');
}

export function resultCheckStatus() {
    displayOnlineStatus();
    stopStatusLoading();
}

export async function selectCharacterById(id) {
    if (characters[id] == undefined) {
        return;
    }

    if (isChatSaving) {
        toastr.info('Please wait until the chat is saved before switching characters.', 'Your chat is still saving...');
        return;
    }

    if (selected_group && is_group_generating) {
        return;
    }

    if (selected_group || this_chid !== id) {
        //if clicked on a different character from what was currently selected
        if (!is_send_press) {
            await clearChat();
            cancelTtsPlay();
            resetSelectedGroup();
            this_edit_mes_id = undefined;
            selected_button = 'character_edit';
            this_chid = id;
            chat.length = 0;
            chat_metadata = {};
            await getChat();
        }
    } else {
        //if clicked on character that was already selected
        selected_button = 'character_edit';
        select_selected_character(this_chid);
    }
}

function getTagBlock(item, entities) {
    let count = 0;

    for (const entity of entities) {
        if (entitiesFilter.isElementTagged(entity, item.id)) {
            count++;
        }
    }

    const template = $('#bogus_folder_template .bogus_folder_select').clone();
    template.attr({ 'tagid': item.id, 'id': `BogusFolder${item.id}` });
    template.find('.avatar').css({ 'background-color': item.color, 'color': item.color2 });
    template.find('.ch_name').text(item.name);
    template.find('.bogus_folder_counter').text(count);
    return template;
}

function getBackBlock() {
    const template = $('#bogus_folder_back_template .bogus_folder_select').clone();
    return template;
}

function getEmptyBlock() {
    const icons = ['fa-dragon', 'fa-otter', 'fa-kiwi-bird', 'fa-crow', 'fa-frog'];
    const texts = ['Here be dragons', 'Otterly empty', 'Kiwibunga', 'Pump-a-Rum', 'Croak it'];
    const roll = new Date().getMinutes() % icons.length;
    const emptyBlock = `
    <div class="empty_block">
        <i class="fa-solid ${icons[roll]} fa-4x"></i>
        <h1>${texts[roll]}</h1>
        <p>There are no items to display.</p>
    </div>`;
    return $(emptyBlock);
}

function getCharacterBlock(item, id) {
    let this_avatar = default_avatar;
    if (item.avatar != 'none') {
        this_avatar = getThumbnailUrl('avatar', item.avatar);
    }
    // Populate the template
    const template = $('#character_template .character_select').clone();
    template.attr({ 'chid': id, 'id': `CharID${id}` });
    template.find('img').attr('src', this_avatar);
    template.find('.avatar').attr('title', item.avatar);
    template.find('.ch_name').text(item.name);
    if (power_user.show_card_avatar_urls) {
        template.find('.ch_avatar_url').text(item.avatar);
    }
    template.find('.ch_fav_icon').css('display', 'none');
    template.toggleClass('is_fav', item.fav || item.fav == 'true');
    template.find('.ch_fav').val(item.fav);

    const description = item.data?.creator_notes?.split('\n', 1)[0] || '';
    if (description) {
        template.find('.ch_description').text(description);
    }
    else {
        template.find('.ch_description').hide();
    }

    const auxFieldName = power_user.aux_field || 'character_version';
    const auxFieldValue = (item.data && item.data[auxFieldName]) || '';
    if (auxFieldValue) {
        template.find('.character_version').text(auxFieldValue);
    }
    else {
        template.find('.character_version').hide();
    }

    // Display inline tags
    const tags = getTagsList(item.avatar);
    const tagsElement = template.find('.tags');
    tags.forEach(tag => appendTagToList(tagsElement, tag, {}));

    // Add to the list
    return template;
}

async function printCharacters(fullRefresh = false) {
    if (fullRefresh) {
        saveCharactersPage = 0;
        printTagFilters(tag_filter_types.character);
        printTagFilters(tag_filter_types.group_member);

        // Return to main list
        if (isBogusFolderOpen()) {
            entitiesFilter.setFilterData(FILTER_TYPES.TAG, { excluded: [], selected: [] });
        }

        await delay(1);
    }

    const storageKey = 'Characters_PerPage';
    const listId = '#rm_print_characters_block';
    const entities = getEntitiesList({ doFilter: true });

    $('#rm_print_characters_pagination').pagination({
        dataSource: entities,
        pageSize: Number(localStorage.getItem(storageKey)) || per_page_default,
        sizeChangerOptions: [10, 25, 50, 100, 250, 500, 1000],
        pageRange: 1,
        pageNumber: saveCharactersPage || 1,
        position: 'top',
        showPageNumbers: false,
        showSizeChanger: true,
        prevText: '<',
        nextText: '>',
        formatNavigator: PAGINATION_TEMPLATE,
        showNavigator: true,
        callback: function (data) {
            $(listId).empty();
            if (isBogusFolderOpen()) {
                $(listId).append(getBackBlock());
            }
            if (!data.length) {
                $(listId).append(getEmptyBlock());
            }
            for (const i of data) {
                switch (i.type) {
                    case 'character':
                        $(listId).append(getCharacterBlock(i.item, i.id));
                        break;
                    case 'group':
                        $(listId).append(getGroupBlock(i.item));
                        break;
                    case 'tag':
                        $(listId).append(getTagBlock(i.item, entities));
                        break;
                }
            }
            eventSource.emit(event_types.CHARACTER_PAGE_LOADED);
        },
        afterSizeSelectorChange: function (e) {
            localStorage.setItem(storageKey, e.target.value);
        },
        afterPaging: function (e) {
            saveCharactersPage = e;
        },
        afterRender: function () {
            $(listId).scrollTop(0);
        },
    });

    favsToHotswap();
}

/**
 * Indicates whether a user is currently in a bogus folder.
 * @returns {boolean} If currently viewing a folder
 */
function isBogusFolderOpen() {
    return !!entitiesFilter.getFilterData(FILTER_TYPES.TAG)?.bogus;
}

export function getEntitiesList({ doFilter } = {}) {
    function characterToEntity(character, id) {
        return { item: character, id, type: 'character' };
    }

    function groupToEntity(group) {
        return { item: group, id: group.id, type: 'group' };
    }

    function tagToEntity(tag) {
        return { item: structuredClone(tag), id: tag.id, type: 'tag' };
    }

    let entities = [
        ...characters.map((item, index) => characterToEntity(item, index)),
        ...groups.map(item => groupToEntity(item)),
        ...(power_user.bogus_folders ? tags.map(item => tagToEntity(item)) : []),
    ];

    if (doFilter) {
        entities = entitiesFilter.applyFilters(entities);
    }

    if (isBogusFolderOpen()) {
        // Get tags of entities within the bogus folder
        const filterData = structuredClone(entitiesFilter.getFilterData(FILTER_TYPES.TAG));
        entities = entities.filter(x => x.type !== 'tag');
        const otherTags = tags.filter(x => !filterData.selected.includes(x.id));
        const bogusTags = [];
        for (const entity of entities) {
            for (const tag of otherTags) {
                if (!bogusTags.includes(tag) && entitiesFilter.isElementTagged(entity, tag.id)) {
                    bogusTags.push(tag);
                }
            }
        }
        entities.push(...bogusTags.map(item => tagToEntity(item)));
    }

    sortEntitiesList(entities);
    return entities;
}

export async function getOneCharacter(avatarUrl) {
    const response = await fetch('/api/characters/get', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            avatar_url: avatarUrl,
        }),
    });

    if (response.ok) {
        const getData = await response.json();
        getData['name'] = DOMPurify.sanitize(getData['name']);
        getData['chat'] = String(getData['chat']);

        const indexOf = characters.findIndex(x => x.avatar === avatarUrl);

        if (indexOf !== -1) {
            characters[indexOf] = getData;
        } else {
            toastr.error(`Character ${avatarUrl} not found in the list`, 'Error', { timeOut: 5000, preventDuplicates: true });
        }
    }
}

async function getCharacters() {
    var response = await fetch('/api/characters/all', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            '': '',
        }),
    });
    if (response.ok === true) {
        var getData = ''; //RossAscends: reset to force array to update to account for deleted character.
        getData = await response.json();
        const load_ch_count = Object.getOwnPropertyNames(getData);
        for (var i = 0; i < load_ch_count.length; i++) {
            characters[i] = [];
            characters[i] = getData[i];
            characters[i]['name'] = DOMPurify.sanitize(characters[i]['name']);

            // For dropped-in cards
            if (!characters[i]['chat']) {
                characters[i]['chat'] = `${characters[i]['name']} - ${humanizedDateTime()}`;
            }

            characters[i]['chat'] = String(characters[i]['chat']);
        }
        if (this_chid != undefined && this_chid != 'invalid-safety-id') {
            $('#avatar_url_pole').val(characters[this_chid].avatar);
        }

        await getGroups();
        await printCharacters(true);
    }
}

async function delChat(chatfile) {
    const response = await fetch('/api/chats/delete', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            chatfile: chatfile,
            avatar_url: characters[this_chid].avatar,
        }),
    });
    if (response.ok === true) {
        // choose another chat if current was deleted
        const name = chatfile.replace('.jsonl', '');
        if (name === characters[this_chid].chat) {
            chat_metadata = {};
            await replaceCurrentChat();
        }
        await eventSource.emit(event_types.CHAT_DELETED, name);
    }
}

async function replaceCurrentChat() {
    await clearChat();
    chat.length = 0;

    const chatsResponse = await fetch('/api/characters/chats', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ avatar_url: characters[this_chid].avatar }),
    });

    if (chatsResponse.ok) {
        const chats = Object.values(await chatsResponse.json());

        // pick existing chat
        if (chats.length && typeof chats[0] === 'object') {
            characters[this_chid].chat = chats[0].file_name.replace('.jsonl', '');
            $('#selected_chat_pole').val(characters[this_chid].chat);
            saveCharacterDebounced();
            await getChat();
        }

        // start new chat
        else {
            characters[this_chid].chat = `${name2} - ${humanizedDateTime()}`;
            $('#selected_chat_pole').val(characters[this_chid].chat);
            saveCharacterDebounced();
            await getChat();
        }
    }
}

export function showMoreMessages() {
    let messageId = Number($('#chat').children('.mes').first().attr('mesid'));
    let count = power_user.chat_truncation || Number.MAX_SAFE_INTEGER;

    console.debug('Inserting messages before', messageId, 'count', count, 'chat length', chat.length);
    const prevHeight = $('#chat').prop('scrollHeight');

    while (messageId > 0 && count > 0) {
        count--;
        messageId--;
        addOneMessage(chat[messageId], { insertBefore: messageId + 1, scroll: false, forceId: messageId });
    }

    if (messageId == 0) {
        $('#show_more_messages').remove();
    }

    const newHeight = $('#chat').prop('scrollHeight');
    $('#chat').scrollTop(newHeight - prevHeight);
}

async function printMessages() {
    let startIndex = 0;
    let count = power_user.chat_truncation || Number.MAX_SAFE_INTEGER;

    if (chat.length > count) {
        count_view_mes = chat.length - count;
        startIndex = count_view_mes;
        $('#chat').append('<div id="show_more_messages">Show more messages</div>');
    }

    for (let i = startIndex; i < chat.length; i++) {
        const item = chat[i];
        addOneMessage(item, { scroll: i === chat.length - 1 });
    }

    // Scroll to bottom when all images are loaded
    const images = document.querySelectorAll('#chat .mes img');
    let imagesLoaded = 0;

    for (let i = 0; i < images.length; i++) {
        const image = images[i];
        if (image instanceof HTMLImageElement) {
            if (image.complete) {
                incrementAndCheck();
            } else {
                image.addEventListener('load', incrementAndCheck);
            }
        }
    }

    function incrementAndCheck() {
        imagesLoaded++;
        if (imagesLoaded === images.length) {
            scrollChatToBottom();
        }
    }
}

async function clearChat() {
    count_view_mes = 0;
    extension_prompts = {};
    if (is_delete_mode) {
        $('#dialogue_del_mes_cancel').trigger('click');
    }
    $('#chat').children().remove();
    if ($('.zoomed_avatar[forChar]').length) {
        console.debug('saw avatars to remove');
        $('.zoomed_avatar[forChar]').remove();
    } else { console.debug('saw no avatars'); }

    await saveItemizedPrompts(getCurrentChatId());
    itemizedPrompts = [];
}

async function deleteLastMessage() {
    count_view_mes--;
    chat.length = chat.length - 1;
    $('#chat').children('.mes').last().remove();
    await eventSource.emit(event_types.MESSAGE_DELETED, chat.length);
}

export async function reloadCurrentChat() {
    await clearChat();
    chat.length = 0;

    if (selected_group) {
        await getGroupChat(selected_group);
    }
    else if (this_chid) {
        await getChat();
    }
    else {
        resetChatState();
        await printMessages();
        await eventSource.emit(event_types.CHAT_CHANGED, getCurrentChatId());
    }

    hideSwipeButtons();
    showSwipeButtons();
}

function messageFormatting(mes, ch_name, isSystem, isUser) {
    if (!mes) {
        return '';
    }

    mesForShowdownParse = mes;

    // Force isSystem = false on comment messages so they get formatted properly
    if (ch_name === COMMENT_NAME_DEFAULT && isSystem && !isUser) {
        isSystem = false;
    }

    // Let hidden messages have markdown
    if (isSystem && ch_name !== systemUserName) {
        isSystem = false;
    }

    // Prompt bias replacement should be applied on the raw message
    if (!power_user.show_user_prompt_bias && ch_name && !isUser && !isSystem) {
        mes = mes.replaceAll(substituteParams(power_user.user_prompt_bias), '');
    }

    if (!isSystem) {
        let regexPlacement;
        if (isUser) {
            regexPlacement = regex_placement.USER_INPUT;
        } else if (ch_name !== name2) {
            regexPlacement = regex_placement.SLASH_COMMAND;
        } else {
            regexPlacement = regex_placement.AI_OUTPUT;
        }

        // Always override the character name
        mes = getRegexedString(mes, regexPlacement, {
            characterOverride: ch_name,
            isMarkdown: true,
        });
    }

    if (power_user.auto_fix_generated_markdown) {
        mes = fixMarkdown(mes, true);
    }

    if (!isSystem && power_user.encode_tags) {
        mes = mes.replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    }

    if ((this_chid === undefined || this_chid === 'invalid-safety-id') && !selected_group) {
        mes = mes
            .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
            .replace(/\n/g, '<br/>');
    } else if (!isSystem) {
        mes = mes.replace(/```[\s\S]*?```|``[\s\S]*?``|`[\s\S]*?`|(".+?")|(\u201C.+?\u201D)/gm, function (match, p1, p2) {
            if (p1) {
                return '<q>"' + p1.replace(/"/g, '') + '"</q>';
            } else if (p2) {
                return '<q>“' + p2.replace(/\u201C|\u201D/g, '') + '”</q>';
            } else {
                return match;
            }
        });

        mes = mes.replaceAll('\\begin{align*}', '$$');
        mes = mes.replaceAll('\\end{align*}', '$$');
        mes = converter.makeHtml(mes);

        mes = mes.replace(/<code(.*)>[\s\S]*?<\/code>/g, function (match) {
            // Firefox creates extra newlines from <br>s in code blocks, so we replace them before converting newlines to <br>s.
            return match.replace(/\n/gm, '\u0000');
        });
        mes = mes.replace(/\n/g, '<br/>');
        mes = mes.replace(/\u0000/g, '\n'); // Restore converted newlines
        mes = mes.trim();

        mes = mes.replace(/<code(.*)>[\s\S]*?<\/code>/g, function (match) {
            return match.replace(/&amp;/g, '&');
        });
    }

    /*
    // Hides bias from empty messages send with slash commands
    if (isSystem) {
        mes = mes.replace(/\{\{[\s\S]*?\}\}/gm, "");
    }
    */

    if (!power_user.allow_name2_display && ch_name && !isUser && !isSystem) {
        mes = mes.replace(new RegExp(`(^|\n)${ch_name}:`, 'g'), '$1');
    }

    /** @type {any} */
    const config = { MESSAGE_SANITIZE: true, ADD_TAGS: ['custom-style'] };
    mes = encodeStyleTags(mes);
    mes = DOMPurify.sanitize(mes, config);
    mes = decodeStyleTags(mes);

    return mes;
}

/**
 * Inserts or replaces an SVG icon adjacent to the provided message's timestamp.
 *
 * If the `extra.api` is "openai" and `extra.model` contains the substring "claude",
 * the function fetches the "claude.svg". Otherwise, it fetches the SVG named after
 * the value in `extra.api`.
 *
 * @param {JQuery<HTMLElement>} mes - The message element containing the timestamp where the icon should be inserted or replaced.
 * @param {Object} extra - Contains the API and model details.
 * @param {string} extra.api - The name of the API, used to determine which SVG to fetch.
 * @param {string} extra.model - The model name, used to check for the substring "claude".
 */
function insertSVGIcon(mes, extra) {
    // Determine the SVG filename
    let modelName;

    // Claude on OpenRouter or Anthropic
    if (extra.api === 'openai' && extra.model?.toLowerCase().includes('claude')) {
        modelName = 'claude';
    }
    // OpenAI on OpenRouter
    else if (extra.api === 'openai' && extra.model?.toLowerCase().includes('openai')) {
        modelName = 'openai';
    }
    // OpenRouter website model or other models
    else if (extra.api === 'openai' && (extra.model === null || extra.model?.toLowerCase().includes('/'))) {
        modelName = 'openrouter';
    }
    // Everything else
    else {
        modelName = extra.api;
    }

    const image = new Image();
    // Add classes for styling and identification
    image.classList.add('icon-svg', 'timestamp-icon');
    image.src = `/img/${modelName}.svg`;
    image.title = `${extra?.api ? extra.api + ' - ' : ''}${extra?.model ?? ''}`;

    image.onload = async function () {
        // Check if an SVG already exists adjacent to the timestamp
        let existingSVG = mes.find('.timestamp').next('.timestamp-icon');

        if (existingSVG.length) {
            // Replace existing SVG
            existingSVG.replaceWith(image);
        } else {
            // Append the new SVG if none exists
            mes.find('.timestamp').after(image);
        }

        await SVGInject(this);
    };
}


function getMessageFromTemplate({
    mesId,
    characterName,
    isUser,
    avatarImg,
    bias,
    isSystem,
    title,
    timerValue,
    timerTitle,
    bookmarkLink,
    forceAvatar,
    timestamp,
    tokenCount,
    extra,
} = {}) {
    const mes = $('#message_template .mes').clone();
    mes.attr({
        'mesid': mesId,
        'ch_name': characterName,
        'is_user': isUser,
        'is_system': !!isSystem,
        'bookmark_link': bookmarkLink,
        'force_avatar': !!forceAvatar,
        'timestamp': timestamp,
    });
    mes.find('.avatar img').attr('src', avatarImg);
    mes.find('.ch_name .name_text').text(characterName);
    mes.find('.mes_bias').html(bias);
    mes.find('.timestamp').text(timestamp).attr('title', `${extra?.api ? extra.api + ' - ' : ''}${extra?.model ?? ''}`);
    mes.find('.mesIDDisplay').text(`#${mesId}`);
    tokenCount && mes.find('.tokenCounterDisplay').text(`${tokenCount}t`);
    title && mes.attr('title', title);
    timerValue && mes.find('.mes_timer').attr('title', timerTitle).text(timerValue);

    if (power_user.timestamp_model_icon && extra?.api) {
        insertSVGIcon(mes, extra);
    }

    return mes;
}

export function updateMessageBlock(messageId, message) {
    const messageElement = $(`#chat [mesid="${messageId}"]`);
    const text = message?.extra?.display_text ?? message.mes;
    messageElement.find('.mes_text').html(messageFormatting(text, message.name, message.is_system, message.is_user));
    addCopyToCodeBlocks(messageElement);
    appendMediaToMessage(message, messageElement);
}

export function appendMediaToMessage(mes, messageElement) {
    // Add image to message
    if (mes.extra?.image) {
        const chatHeight = $('#chat').prop('scrollHeight');
        const image = messageElement.find('.mes_img');
        const text = messageElement.find('.mes_text');
        const isInline = !!mes.extra?.inline_image;
        image.on('load', function () {
            const scrollPosition = $('#chat').scrollTop();
            const newChatHeight = $('#chat').prop('scrollHeight');
            const diff = newChatHeight - chatHeight;
            $('#chat').scrollTop(scrollPosition + diff);
        });
        image.attr('src', mes.extra?.image);
        image.attr('title', mes.extra?.title || mes.title || '');
        messageElement.find('.mes_img_container').addClass('img_extra');
        image.toggleClass('img_inline', isInline);
        text.toggleClass('displayNone', !isInline);
    }

    // Add file to message
    if (mes.extra?.file) {
        messageElement.find('.mes_file_container').remove();
        const messageId = messageElement.attr('mesid');
        const template = $('#message_file_template .mes_file_container').clone();
        template.find('.mes_file_name').text(mes.extra.file.name);
        template.find('.mes_file_size').text(humanFileSize(mes.extra.file.size));
        template.find('.mes_file_download').attr('mesid', messageId);
        template.find('.mes_file_delete').attr('mesid', messageId);
        messageElement.find('.mes_block').append(template);
    } else {
        messageElement.find('.mes_file_container').remove();
    }
}

/**
 * @deprecated Use appendMediaToMessage instead.
 */
export function appendImageToMessage(mes, messageElement) {
    appendMediaToMessage(mes, messageElement);
}

export function addCopyToCodeBlocks(messageElement) {
    const codeBlocks = $(messageElement).find('pre code');
    for (let i = 0; i < codeBlocks.length; i++) {
        hljs.highlightElement(codeBlocks.get(i));
        if (navigator.clipboard !== undefined) {
            const copyButton = document.createElement('i');
            copyButton.classList.add('fa-solid', 'fa-copy', 'code-copy');
            copyButton.title = 'Copy code';
            codeBlocks.get(i).appendChild(copyButton);
            copyButton.addEventListener('pointerup', function (event) {
                navigator.clipboard.writeText(codeBlocks.get(i).innerText);
                toastr.info('Copied!', '', { timeOut: 2000 });
            });
        }
    }
}


function addOneMessage(mes, { type = 'normal', insertAfter = null, scroll = true, insertBefore = null, forceId = null } = {}) {
    var messageText = mes['mes'];
    const momentDate = timestampToMoment(mes.send_date);
    const timestamp = momentDate.isValid() ? momentDate.format('LL LT') : '';

    if (mes?.extra?.display_text) {
        messageText = mes.extra.display_text;
    }

    // Forbidden black magic
    // This allows to use "continue" on user messages
    if (type === 'swipe' && mes.swipe_id === undefined) {
        mes.swipe_id = 0;
        mes.swipes = [mes.mes];
    }

    var avatarImg = getUserAvatar(user_avatar);
    const isSystem = mes.is_system;
    const title = mes.title;
    generatedPromptCache = '';

    //for non-user mesages
    if (!mes['is_user']) {
        if (mes.force_avatar) {
            avatarImg = mes.force_avatar;
        } else if (this_chid === undefined || this_chid === 'invalid-safety-id') {
            avatarImg = system_avatar;
        } else {
            if (characters[this_chid].avatar != 'none') {
                avatarImg = getThumbnailUrl('avatar', characters[this_chid].avatar);
            } else {
                avatarImg = default_avatar;
            }
        }
        //old processing:
        //if messge is from sytem, use the name provided in the message JSONL to proceed,
        //if not system message, use name2 (char's name) to proceed
        //characterName = mes.is_system || mes.force_avatar ? mes.name : name2;
    } else if (mes['is_user'] && mes['force_avatar']) {
        // Special case for persona images.
        avatarImg = mes['force_avatar'];
    }

    if (count_view_mes == 0) {
        messageText = substituteParams(messageText);
    }
    messageText = messageFormatting(
        messageText,
        mes.name,
        isSystem,
        mes.is_user,
    );
    const bias = messageFormatting(mes.extra?.bias ?? '');
    let bookmarkLink = mes?.extra?.bookmark_link ?? '';
    // Verify bookmarked chat still exists
    // Cohee: Commented out for now. I'm worried of performance issues.
    /*if (bookmarkLink !== '') {
        let chat_names = selected_group
            ? getGroupChatNames(selected_group)
            : Object.values(getPastCharacterChats()).map(({ file_name }) => file_name);

        if (!chat_names.includes(bookmarkLink)) {
            bookmarkLink = ''
        }
    }*/
    let params = {
        mesId: forceId ?? count_view_mes,
        characterName: mes.name,
        isUser: mes.is_user,
        avatarImg: avatarImg,
        bias: bias,
        isSystem: isSystem,
        title: title,
        bookmarkLink: bookmarkLink,
        forceAvatar: mes.force_avatar,
        timestamp: timestamp,
        extra: mes.extra,
        tokenCount: mes.extra?.token_count,
        ...formatGenerationTimer(mes.gen_started, mes.gen_finished, mes.extra?.token_count),
    };

    const HTMLForEachMes = getMessageFromTemplate(params);

    if (type !== 'swipe') {
        if (!insertAfter && !insertBefore) {
            $('#chat').append(HTMLForEachMes);
        }
        else if (insertAfter) {
            const target = $('#chat').find(`.mes[mesid="${insertAfter}"]`);
            $(HTMLForEachMes).insertAfter(target);
            $(HTMLForEachMes).find('.swipe_left').css('display', 'none');
            $(HTMLForEachMes).find('.swipe_right').css('display', 'none');
        } else {
            const target = $('#chat').find(`.mes[mesid="${insertBefore}"]`);
            $(HTMLForEachMes).insertBefore(target);
            $(HTMLForEachMes).find('.swipe_left').css('display', 'none');
            $(HTMLForEachMes).find('.swipe_right').css('display', 'none');
        }
    }

    function getMessageId() {
        if (typeof forceId == 'number') {
            return forceId;
        }

        return type == 'swipe' ? count_view_mes - 1 : count_view_mes;
    }

    const newMessageId = getMessageId();
    const newMessage = $(`#chat [mesid="${newMessageId}"]`);
    const isSmallSys = mes?.extra?.isSmallSys;
    newMessage.data('isSystem', isSystem);

    if (isSystem) {
        // newMessage.find(".mes_edit").hide();
        newMessage.find('.mes_prompt').hide(); //don't need prompt button for sys
    }

    if (isSmallSys === true) {
        newMessage.addClass('smallSysMes');
    }

    // don't need prompt button for user
    if (params.isUser === true) {
        newMessage.find('.mes_prompt').hide();
        //console.log(`hiding prompt for user mesID ${params.mesId}`);
    }

    //shows or hides the Prompt display button
    let mesIdToFind = type == 'swipe' ? params.mesId - 1 : params.mesId;  //Number(newMessage.attr('mesId'));

    //if we have itemized messages, and the array isn't null..
    if (params.isUser === false && itemizedPrompts.length !== 0 && itemizedPrompts.length !== null) {
        // console.log('looking through itemized prompts...');
        //console.log(`mesIdToFind = ${mesIdToFind} from ${params.avatarImg}`);
        //console.log(`itemizedPrompts.length = ${itemizedPrompts.length}`)
        //console.log(itemizedPrompts);

        for (var i = 0; i < itemizedPrompts.length; i++) {
            //console.log(`itemized array item ${i} is MesID ${Number(itemizedPrompts[i].mesId)}, does it match ${Number(mesIdToFind)}?`);
            if (Number(itemizedPrompts[i].mesId) === Number(mesIdToFind)) {
                newMessage.find('.mes_prompt').show();
                //console.log(`showing button for mesID ${params.mesId} from ${params.characterName}`);
                break;

            } /*else {
                console.log(`no cache obj for mesID ${mesIdToFind}, hiding this prompt button`);
                newMessage.find(".mes_prompt").hide();
                console.log(itemizedPrompts);
            } */
        }
    } else {
        //console.log('itemizedprompt array empty null, or user, hiding this prompt buttons');
        //$(".mes_prompt").hide();
        newMessage.find('.mes_prompt').hide();
        //console.log(itemizedPrompts);
    }

    newMessage.find('.avatar img').on('error', function () {
        $(this).hide();
        $(this).parent().html('<div class="missing-avatar fa-solid fa-user-slash"></div>');
    });

    if (type === 'swipe') {
        const swipeMessage = $('#chat').find(`[mesid="${count_view_mes - 1}"]`);
        swipeMessage.find('.mes_text').html('');
        swipeMessage.find('.mes_text').append(messageText);
        appendMediaToMessage(mes, swipeMessage);
        swipeMessage.attr('title', title);
        swipeMessage.find('.timestamp').text(timestamp).attr('title', `${params.extra.api} - ${params.extra.model}`);
        if (power_user.timestamp_model_icon && params.extra?.api) {
            insertSVGIcon(swipeMessage, params.extra);
        }

        if (mes.swipe_id == mes.swipes.length - 1) {
            swipeMessage.find('.mes_timer').text(params.timerValue);
            swipeMessage.find('.mes_timer').attr('title', params.timerTitle);
            swipeMessage.find('.tokenCounterDisplay').text(`${params.tokenCount}t`);
        } else {
            swipeMessage.find('.mes_timer').html('');
            swipeMessage.find('.tokenCounterDisplay').html('');
        }
    } else if (typeof forceId == 'number') {
        $('#chat').find(`[mesid="${forceId}"]`).find('.mes_text').append(messageText);
        appendMediaToMessage(mes, newMessage);
        hideSwipeButtons();
        showSwipeButtons();
    } else {
        $('#chat').find(`[mesid="${count_view_mes}"]`).find('.mes_text').append(messageText);
        appendMediaToMessage(mes, newMessage);
        hideSwipeButtons();
        count_view_mes++;
    }

    addCopyToCodeBlocks(newMessage);

    // Don't scroll if not inserting last
    if (!insertAfter && !insertBefore && scroll) {
        $('#chat .mes').last().addClass('last_mes');
        $('#chat .mes').eq(-2).removeClass('last_mes');

        hideSwipeButtons();
        showSwipeButtons();
        scrollChatToBottom();
    }
}

/**
 * Returns the URL of the avatar for the given user avatar Id.
 * @param {string} avatarImg User avatar Id
 * @returns {string} User avatar URL
 */
export function getUserAvatar(avatarImg) {
    return `User Avatars/${avatarImg}`;
}

/**
 * Returns the URL of the avatar for the given character Id.
 * @param {number} characterId Character Id
 * @returns {string} Avatar URL
 */
export function getCharacterAvatar(characterId) {
    const character = characters[characterId];
    const avatarImg = character?.avatar;

    if (!avatarImg || avatarImg === 'none') {
        return default_avatar;
    }

    return formatCharacterAvatar(avatarImg);
}

export function formatCharacterAvatar(characterAvatar) {
    return `characters/${characterAvatar}`;
}

/**
 * Formats the title for the generation timer.
 * @param {Date} gen_started Date when generation was started
 * @param {Date} gen_finished Date when generation was finished
 * @param {number} tokenCount Number of tokens generated (0 if not available)
 * @returns {Object} Object containing the formatted timer value and title
 * @example
 * const { timerValue, timerTitle } = formatGenerationTimer(gen_started, gen_finished, tokenCount);
 * console.log(timerValue); // 1.2s
 * console.log(timerTitle); // Generation queued: 12:34:56 7 Jan 2021\nReply received: 12:34:57 7 Jan 2021\nTime to generate: 1.2 seconds\nToken rate: 5 t/s
 */
function formatGenerationTimer(gen_started, gen_finished, tokenCount) {
    if (!gen_started || !gen_finished) {
        return {};
    }

    const dateFormat = 'HH:mm:ss D MMM YYYY';
    const start = moment(gen_started);
    const finish = moment(gen_finished);
    const seconds = finish.diff(start, 'seconds', true);
    const timerValue = `${seconds.toFixed(1)}s`;
    const timerTitle = [
        `Generation queued: ${start.format(dateFormat)}`,
        `Reply received: ${finish.format(dateFormat)}`,
        `Time to generate: ${seconds} seconds`,
        tokenCount > 0 ? `Token rate: ${Number(tokenCount / seconds).toFixed(1)} t/s` : '',
    ].join('\n');

    if (isNaN(seconds)) {
        return { timerValue: '', timerTitle };
    }

    return { timerValue, timerTitle };
}

function scrollChatToBottom() {
    if (power_user.auto_scroll_chat_to_bottom) {
        const chatElement = $('#chat');
        let position = chatElement[0].scrollHeight;

        if (power_user.waifuMode) {
            const lastMessage = chatElement.find('.mes').last();
            if (lastMessage.length) {
                const lastMessagePosition = lastMessage.position().top;
                position = chatElement.scrollTop() + lastMessagePosition;
            }
        }

        chatElement.scrollTop(position);
    }
}

/**
 * Returns the ID of the last message in the chat.
 * @returns {string} The ID of the last message in the chat.
 */
function getLastMessageId() {
    const index = chat?.length - 1;

    if (!isNaN(index) && index >= 0) {
        return String(index);
    }

    return '';
}

/**
 * Returns the ID of the first message included in the context.
 * @returns {string} The ID of the first message in the context.
 */
function getFirstIncludedMessageId() {
    const index = document.querySelector('.lastInContext')?.getAttribute('mesid');

    if (!isNaN(index) && index >= 0) {
        return String(index);
    }

    return '';
}

/**
 * Returns the last message in the chat.
 * @returns {string} The last message in the chat.
 */
function getLastMessage() {
    const index = chat?.length - 1;

    if (!isNaN(index) && index >= 0) {
        return chat[index].mes;
    }

    return '';
}

/**
 * Returns the ID of the last swipe.
 * @returns {string} The 1-based ID of the last swipe
 */
function getLastSwipeId() {
    const index = chat?.length - 1;

    if (!isNaN(index) && index >= 0) {
        const swipes = chat[index].swipes;

        if (!Array.isArray(swipes) || swipes.length === 0) {
            return '';
        }

        return String(swipes.length);
    }

    return '';
}

/**
 * Returns the ID of the current swipe.
 * @returns {string} The 1-based ID of the current swipe.
 */
function getCurrentSwipeId() {
    const index = chat?.length - 1;

    if (!isNaN(index) && index >= 0) {
        const swipeId = chat[index].swipe_id;

        if (swipeId === undefined || isNaN(swipeId)) {
            return '';
        }

        return String(swipeId + 1);
    }

    return '';
}

/**
 * Substitutes {{macro}} parameters in a string.
 * @param {string} content - The string to substitute parameters in.
 * @param {*} _name1 - The name of the user. Uses global name1 if not provided.
 * @param {*} _name2 - The name of the character. Uses global name2 if not provided.
 * @param {*} _original - The original message for {{original}} substitution.
 * @param {*} _group - The group members list for {{group}} substitution.
 * @returns {string} The string with substituted parameters.
 */
function substituteParams(content, _name1, _name2, _original, _group, _replaceCharacterCard = true) {
    _name1 = _name1 ?? name1;
    _name2 = _name2 ?? name2;
    _group = _group ?? name2;

    if (!content) {
        return '';
    }

    // Replace {{original}} with the original message
    // Note: only replace the first instance of {{original}}
    // This will hopefully prevent the abuse
    if (typeof _original === 'string') {
        content = content.replace(/{{original}}/i, _original);
    }
    content = diceRollReplace(content);
    content = replaceInstructMacros(content);
    content = replaceVariableMacros(content);
    content = content.replace(/{{newline}}/gi, '\n');
    content = content.replace(/{{input}}/gi, String($('#send_textarea').val()));

    if (_replaceCharacterCard) {
        const fields = getCharacterCardFields();
        content = content.replace(/{{charPrompt}}/gi, fields.system || '');
        content = content.replace(/{{charJailbreak}}/gi, fields.jailbreak || '');
        content = content.replace(/{{description}}/gi, fields.description || '');
        content = content.replace(/{{personality}}/gi, fields.personality || '');
        content = content.replace(/{{scenario}}/gi, fields.scenario || '');
        content = content.replace(/{{persona}}/gi, fields.persona || '');
        content = content.replace(/{{mesExamples}}/gi, fields.mesExamples || '');
    }

    content = content.replace(/{{maxPrompt}}/gi, () => String(getMaxContextSize()));
    content = content.replace(/{{user}}/gi, _name1);
    content = content.replace(/{{char}}/gi, _name2);
    content = content.replace(/{{charIfNotGroup}}/gi, _group);
    content = content.replace(/{{group}}/gi, _group);
    content = content.replace(/{{lastMessage}}/gi, getLastMessage());
    content = content.replace(/{{lastMessageId}}/gi, getLastMessageId());
    content = content.replace(/{{firstIncludedMessageId}}/gi, getFirstIncludedMessageId());
    content = content.replace(/{{lastSwipeId}}/gi, getLastSwipeId());
    content = content.replace(/{{currentSwipeId}}/gi, getCurrentSwipeId());

    content = content.replace(/<USER>/gi, _name1);
    content = content.replace(/<BOT>/gi, _name2);
    content = content.replace(/<CHARIFNOTGROUP>/gi, _group);
    content = content.replace(/<GROUP>/gi, _group);

    content = content.replace(/\{\{\/\/([\s\S]*?)\}\}/gm, '');

    content = content.replace(/{{time}}/gi, moment().format('LT'));
    content = content.replace(/{{date}}/gi, moment().format('LL'));
    content = content.replace(/{{weekday}}/gi, moment().format('dddd'));
    content = content.replace(/{{isotime}}/gi, moment().format('HH:mm'));
    content = content.replace(/{{isodate}}/gi, moment().format('YYYY-MM-DD'));

    content = content.replace(/{{datetimeformat +([^}]*)}}/gi, (_, format) => {
        const formattedTime = moment().format(format);
        return formattedTime;
    });
    content = content.replace(/{{idle_duration}}/gi, () => getTimeSinceLastMessage());
    content = content.replace(/{{time_UTC([-+]\d+)}}/gi, (_, offset) => {
        const utcOffset = parseInt(offset, 10);
        const utcTime = moment().utc().utcOffset(utcOffset).format('LT');
        return utcTime;
    });
    content = bannedWordsReplace(content);
    content = randomReplace(content);
    return content;
}

/**
 * Replaces banned words in macros with an empty string.
 * Adds them to textgenerationwebui ban list.
 * @param {string} inText Text to replace banned words in
 * @returns {string} Text without the "banned" macro
 */
function bannedWordsReplace(inText) {
    if (!inText) {
        return '';
    }

    const banPattern = /{{banned "(.*)"}}/gi;

    if (main_api == 'textgenerationwebui') {
        const bans = inText.matchAll(banPattern);
        if (bans) {
            for (const banCase of bans) {
                console.log('Found banned words in macros: ' + banCase[1]);
                textgenerationwebui_banned_in_macros.push(banCase[1]);
            }
        }
    }

    inText = inText.replaceAll(banPattern, '');
    return inText;
}

function getTimeSinceLastMessage() {
    const now = moment();

    if (Array.isArray(chat) && chat.length > 0) {
        let lastMessage;
        let takeNext = false;

        for (let i = chat.length - 1; i >= 0; i--) {
            const message = chat[i];

            if (message.is_system) {
                continue;
            }

            if (message.is_user && takeNext) {
                lastMessage = message;
                break;
            }

            takeNext = true;
        }

        if (lastMessage?.send_date) {
            const lastMessageDate = timestampToMoment(lastMessage.send_date);
            const duration = moment.duration(now.diff(lastMessageDate));
            return duration.humanize();
        }
    }

    return 'just now';
}

function randomReplace(input, emptyListPlaceholder = '') {
    const randomPatternNew = /{{random\s?::\s?([^}]+)}}/gi;
    const randomPatternOld = /{{random\s?:\s?([^}]+)}}/gi;

    if (randomPatternNew.test(input)) {
        return input.replace(randomPatternNew, (match, listString) => {
            //split on double colons instead of commas to allow for commas inside random items
            const list = listString.split('::').filter(item => item.length > 0);
            if (list.length === 0) {
                return emptyListPlaceholder;
            }
            var rng = new Math.seedrandom('added entropy.', { entropy: true });
            const randomIndex = Math.floor(rng() * list.length);
            //trim() at the end to allow for empty random values
            return list[randomIndex].trim();
        });
    } else if (randomPatternOld.test(input)) {
        return input.replace(randomPatternOld, (match, listString) => {
            const list = listString.split(',').map(item => item.trim()).filter(item => item.length > 0);
            if (list.length === 0) {
                return emptyListPlaceholder;
            }
            var rng = new Math.seedrandom('added entropy.', { entropy: true });
            const randomIndex = Math.floor(rng() * list.length);
            return list[randomIndex];
        });
    } else {
        return input;
    }
}

function diceRollReplace(input, invalidRollPlaceholder = '') {
    const rollPattern = /{{roll[ : ]([^}]+)}}/gi;

    return input.replace(rollPattern, (match, matchValue) => {
        let formula = matchValue.trim();

        if (isDigitsOnly(formula)) {
            formula = `1d${formula}`;
        }

        const isValid = droll.validate(formula);

        if (!isValid) {
            console.debug(`Invalid roll formula: ${formula}`);
            return invalidRollPlaceholder;
        }

        const result = droll.roll(formula);
        return new String(result.total);
    });
}

/**
 * Gets stopping sequences for the prompt.
 * @param {boolean} isImpersonate A request is made to impersonate a user
 * @param {boolean} isContinue A request is made to continue the message
 * @returns {string[]} Array of stopping strings
 */
function getStoppingStrings(isImpersonate, isContinue) {
    const charString = `\n${name2}:`;
    const userString = `\n${name1}:`;
    const result = isImpersonate ? [charString] : [userString];

    result.push(userString);

    if (isContinue && Array.isArray(chat) && chat[chat.length - 1]?.is_user) {
        result.push(charString);
    }

    // Add other group members as the stopping strings
    if (selected_group) {
        const group = groups.find(x => x.id === selected_group);

        if (group && Array.isArray(group.members)) {
            const names = group.members
                .map(x => characters.find(y => y.avatar == x))
                .filter(x => x && x.name && x.name !== name2)
                .map(x => `\n${x.name}:`);
            result.push(...names);
        }
    }

    result.push(...getInstructStoppingSequences());
    result.push(...getCustomStoppingStrings());

    if (power_user.single_line) {
        result.unshift('\n');
    }

    return result.filter(onlyUnique);
}

/**
 * Background generation based on the provided prompt.
 * @param {string} quiet_prompt Instruction prompt for the AI
 * @param {boolean} quietToLoud Whether the message should be sent in a foreground (loud) or background (quiet) mode
 * @param {boolean} skipWIAN whether to skip addition of World Info and Author's Note into the prompt
 * @param {string} quietImage Image to use for the quiet prompt
 * @returns
 */
export async function generateQuietPrompt(quiet_prompt, quietToLoud, skipWIAN, quietImage = null) {
    console.log('got into genQuietPrompt');
    const generateFinished = await Generate('quiet', { quiet_prompt, quietToLoud, skipWIAN: skipWIAN, force_name2: true, quietImage: quietImage });
    return generateFinished;
}

async function processCommands(message, type, dryRun) {
    if (dryRun || type == 'regenerate' || type == 'swipe' || type == 'quiet') {
        return null;
    }

    const previousText = String($('#send_textarea').val());
    const result = await executeSlashCommands(message);

    if (!result || typeof result !== 'object') {
        return null;
    }

    const currentText = String($('#send_textarea').val());

    if (previousText === currentText) {
        $('#send_textarea').val(result.newText).trigger('input');
    }

    // interrupt generation if the input was nothing but a command
    if (message.length > 0 && result?.newText.length === 0) {
        return true;
    }

    return result?.interrupt;
}

function sendSystemMessage(type, text, extra = {}) {
    const systemMessage = system_messages[type];

    if (!systemMessage) {
        return;
    }

    const newMessage = { ...systemMessage, send_date: getMessageTimeStamp() };

    if (text) {
        newMessage.mes = text;
    }

    if (type == system_message_types.SLASH_COMMANDS) {
        newMessage.mes = getSlashCommandsHelp();
    }

    if (!newMessage.extra) {
        newMessage.extra = {};
    }

    newMessage.extra = Object.assign(newMessage.extra, extra);
    newMessage.extra.type = type;

    chat.push(newMessage);
    addOneMessage(newMessage);
    is_send_press = false;
}

export function extractMessageBias(message) {
    if (!message) {
        return null;
    }

    try {
        const biasHandlebars = Handlebars.create();
        const biasMatches = [];
        biasHandlebars.registerHelper('bias', function (text) {
            biasMatches.push(text);
            return '';
        });
        const template = biasHandlebars.compile(message);
        template({});

        if (biasMatches && biasMatches.length > 0) {
            return ` ${biasMatches.join(' ')}`;
        }

        return '';
    } catch {
        return '';
    }
}

/**
 * Removes impersonated group member lines from the group member messages.
 * Doesn't do anything if group reply trimming is disabled.
 * @param {string} getMessage Group message
 * @returns Cleaned-up group message
 */
function cleanGroupMessage(getMessage) {
    if (power_user.disable_group_trimming) {
        return getMessage;
    }

    const group = groups.find((x) => x.id == selected_group);

    if (group && Array.isArray(group.members) && group.members) {
        for (let member of group.members) {
            const character = characters.find(x => x.avatar == member);

            if (!character) {
                continue;
            }

            const name = character.name;

            // Skip current speaker.
            if (name === name2) {
                continue;
            }

            const regex = new RegExp(`(^|\n)${escapeRegex(name)}:`);
            const nameMatch = getMessage.match(regex);
            if (nameMatch) {
                getMessage = getMessage.substring(0, nameMatch.index);
            }
        }
    }
    return getMessage;
}

function addPersonaDescriptionExtensionPrompt() {
    if (!power_user.persona_description) {
        return;
    }

    const promptPositions = [persona_description_positions.BOTTOM_AN, persona_description_positions.TOP_AN];

    if (promptPositions.includes(power_user.persona_description_position) && shouldWIAddPrompt) {
        const originalAN = extension_prompts[NOTE_MODULE_NAME].value;
        const ANWithDesc = power_user.persona_description_position === persona_description_positions.TOP_AN
            ? `${power_user.persona_description}\n${originalAN}`
            : `${originalAN}\n${power_user.persona_description}`;

        setExtensionPrompt(NOTE_MODULE_NAME, ANWithDesc, chat_metadata[metadata_keys.position], chat_metadata[metadata_keys.depth], extension_settings.note.allowWIScan);
    }
}

function getAllExtensionPrompts() {
    const value = Object
        .values(extension_prompts)
        .filter(x => x.value)
        .map(x => x.value.trim())
        .join('\n');

    return value.length ? substituteParams(value) : '';
}

// Wrapper to fetch extension prompts by module name
function getExtensionPromptByName(moduleName) {
    if (moduleName) {
        return substituteParams(extension_prompts[moduleName]?.value);
    } else {
        return;
    }
}

function getExtensionPrompt(position = 0, depth = undefined, separator = '\n') {
    let extension_prompt = Object.keys(extension_prompts)
        .sort()
        .map((x) => extension_prompts[x])
        .filter(x => x.position == position && x.value && (depth === undefined || x.depth == depth))
        .map(x => x.value.trim())
        .join(separator);
    if (extension_prompt.length && !extension_prompt.startsWith(separator)) {
        extension_prompt = separator + extension_prompt;
    }
    if (extension_prompt.length && !extension_prompt.endsWith(separator)) {
        extension_prompt = extension_prompt + separator;
    }
    if (extension_prompt.length) {
        extension_prompt = substituteParams(extension_prompt);
    }
    return extension_prompt;
}

export function baseChatReplace(value, name1, name2) {
    if (value !== undefined && value.length > 0) {
        const _ = undefined;
        value = substituteParams(value, name1, name2, _, _, false);

        if (power_user.collapse_newlines) {
            value = collapseNewlines(value);
        }

        value = value.replace(/\r/g, '');
    }
    return value;
}

/**
 * Returns the character card fields for the current character.
 * @returns {{system: string, mesExamples: string, description: string, personality: string, persona: string, scenario: string, jailbreak: string}}
 */
function getCharacterCardFields() {
    const result = { system: '', mesExamples: '', description: '', personality: '', persona: '', scenario: '', jailbreak: '' };
    const character = characters[this_chid];

    if (!character) {
        return result;
    }

    const scenarioText = chat_metadata['scenario'] || characters[this_chid].scenario;
    result.description = baseChatReplace(characters[this_chid].description.trim(), name1, name2);
    result.personality = baseChatReplace(characters[this_chid].personality.trim(), name1, name2);
    result.scenario = baseChatReplace(scenarioText.trim(), name1, name2);
    result.mesExamples = baseChatReplace(characters[this_chid].mes_example.trim(), name1, name2);
    result.persona = baseChatReplace(power_user.persona_description.trim(), name1, name2);
    result.system = power_user.prefer_character_prompt ? baseChatReplace(characters[this_chid].data?.system_prompt?.trim(), name1, name2) : '';
    result.jailbreak = power_user.prefer_character_jailbreak ? baseChatReplace(characters[this_chid].data?.post_history_instructions?.trim(), name1, name2) : '';

    if (selected_group) {
        const groupCards = getGroupCharacterCards(selected_group, Number(this_chid));

        if (groupCards) {
            result.description = groupCards.description;
            result.personality = groupCards.personality;
            result.scenario = groupCards.scenario;
            result.mesExamples = groupCards.mesExamples;
        }
    }

    return result;
}

function isStreamingEnabled() {
    const noStreamSources = [chat_completion_sources.SCALE, chat_completion_sources.AI21];
    return ((main_api == 'openai' && oai_settings.stream_openai && !noStreamSources.includes(oai_settings.chat_completion_source) && !(oai_settings.chat_completion_source == chat_completion_sources.MAKERSUITE && oai_settings.google_model.includes('bison')))
        || (main_api == 'kobold' && kai_settings.streaming_kobold && kai_flags.can_use_streaming)
        || (main_api == 'novel' && nai_settings.streaming_novel)
        || (main_api == 'textgenerationwebui' && textgen_settings.streaming));
}

function showStopButton() {
    $('#mes_stop').css({ 'display': 'flex' });
}

function hideStopButton() {
    $('#mes_stop').css({ 'display': 'none' });
}

class StreamingProcessor {
    constructor(type, force_name2, timeStarted, messageAlreadyGenerated) {
        this.result = '';
        this.messageId = -1;
        this.type = type;
        this.force_name2 = force_name2;
        this.isStopped = false;
        this.isFinished = false;
        this.generator = this.nullStreamingGeneration;
        this.abortController = new AbortController();
        this.firstMessageText = '...';
        this.timeStarted = timeStarted;
        this.messageAlreadyGenerated = messageAlreadyGenerated;
        this.swipes = [];
    }

    showMessageButtons(messageId) {
        if (messageId == -1) {
            return;
        }

        showStopButton();
        $(`#chat .mes[mesid="${messageId}"] .mes_buttons`).css({ 'display': 'none' });
    }

    hideMessageButtons(messageId) {
        if (messageId == -1) {
            return;
        }

        hideStopButton();
        $(`#chat .mes[mesid="${messageId}"] .mes_buttons`).css({ 'display': 'flex' });
    }

    async onStartStreaming(text) {
        let messageId = -1;

        if (this.type == 'impersonate') {
            $('#send_textarea').val('').trigger('input');
        }
        else {
            await saveReply(this.type, text, true);
            messageId = count_view_mes - 1;
            this.showMessageButtons(messageId);
        }

        hideSwipeButtons();
        scrollChatToBottom();
        return messageId;
    }

    onProgressStreaming(messageId, text, isFinal) {
        const isImpersonate = this.type == 'impersonate';
        const isContinue = this.type == 'continue';

        if (!isImpersonate && !isContinue && Array.isArray(this.swipes) && this.swipes.length > 0) {
            for (let i = 0; i < this.swipes.length; i++) {
                this.swipes[i] = cleanUpMessage(this.swipes[i], false, false, true, this.stoppingStrings);
            }
        }

        let processedText = cleanUpMessage(text, isImpersonate, isContinue, !isFinal, this.stoppingStrings);

        // Predict unbalanced asterisks / quotes during streaming
        const charsToBalance = ['*', '"', '```'];
        for (const char of charsToBalance) {
            if (!isFinal && isOdd(countOccurrences(processedText, char))) {
                // Add character at the end to balance it
                const separator = char.length > 1 ? '\n' : '';
                processedText = processedText.trimEnd() + separator + char;
            }
        }

        if (isImpersonate) {
            $('#send_textarea').val(processedText).trigger('input');
        }
        else {
            let currentTime = new Date();
            // Don't waste time calculating token count for streaming
            let currentTokenCount = isFinal && power_user.message_token_count_enabled ? getTokenCount(processedText, 0) : 0;
            const timePassed = formatGenerationTimer(this.timeStarted, currentTime, currentTokenCount);
            chat[messageId]['mes'] = processedText;
            chat[messageId]['gen_started'] = this.timeStarted;
            chat[messageId]['gen_finished'] = currentTime;

            if (currentTokenCount) {
                if (!chat[messageId]['extra']) {
                    chat[messageId]['extra'] = {};
                }

                chat[messageId]['extra']['token_count'] = currentTokenCount;
                const tokenCounter = $(`#chat .mes[mesid="${messageId}"] .tokenCounterDisplay`);
                tokenCounter.text(`${currentTokenCount}t`);
            }

            if ((this.type == 'swipe' || this.type === 'continue') && Array.isArray(chat[messageId]['swipes'])) {
                chat[messageId]['swipes'][chat[messageId]['swipe_id']] = processedText;
                chat[messageId]['swipe_info'][chat[messageId]['swipe_id']] = { 'send_date': chat[messageId]['send_date'], 'gen_started': chat[messageId]['gen_started'], 'gen_finished': chat[messageId]['gen_finished'], 'extra': JSON.parse(JSON.stringify(chat[messageId]['extra'])) };
            }

            let formattedText = messageFormatting(
                processedText,
                chat[messageId].name,
                chat[messageId].is_system,
                chat[messageId].is_user,
            );
            const mesText = $(`#chat .mes[mesid="${messageId}"] .mes_text`);
            mesText.html(formattedText);
            $(`#chat .mes[mesid="${messageId}"] .mes_timer`).text(timePassed.timerValue).attr('title', timePassed.timerTitle);
            this.setFirstSwipe(messageId);
        }

        if (!scrollLock) {
            scrollChatToBottom();
        }
    }

    async onFinishStreaming(messageId, text) {
        this.hideMessageButtons(this.messageId);
        this.onProgressStreaming(messageId, text, true);
        addCopyToCodeBlocks($(`#chat .mes[mesid="${messageId}"]`));

        if (Array.isArray(this.swipes) && this.swipes.length > 0) {
            const message = chat[messageId];
            const swipeInfo = {
                send_date: message.send_date,
                gen_started: message.gen_started,
                gen_finished: message.gen_finished,
                extra: structuredClone(message.extra),
            };
            const swipeInfoArray = [];
            swipeInfoArray.length = this.swipes.length;
            swipeInfoArray.fill(swipeInfo);
            chat[messageId].swipes.push(...this.swipes);
            chat[messageId].swipe_info.push(...swipeInfoArray);
        }

        if (this.type !== 'impersonate') {
            await eventSource.emit(event_types.MESSAGE_RECEIVED, this.messageId);
            await eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, this.messageId);
        } else {
            await eventSource.emit(event_types.IMPERSONATE_READY, text);
        }

        await saveChatConditional();
        activateSendButtons();
        showSwipeButtons();
        setGenerationProgress(0);
        generatedPromptCache = '';

        //console.log("Generated text size:", text.length, text)

        if (power_user.auto_swipe) {
            function containsBlacklistedWords(str, blacklist, threshold) {
                const regex = new RegExp(`\\b(${blacklist.join('|')})\\b`, 'gi');
                const matches = str.match(regex) || [];
                return matches.length >= threshold;
            }

            const generatedTextFiltered = (text) => {
                if (text) {
                    if (power_user.auto_swipe_minimum_length) {
                        if (text.length < power_user.auto_swipe_minimum_length && text.length !== 0) {
                            console.log('Generated text size too small');
                            return true;
                        }
                    }
                    if (power_user.auto_swipe_blacklist_threshold) {
                        if (containsBlacklistedWords(text, power_user.auto_swipe_blacklist, power_user.auto_swipe_blacklist_threshold)) {
                            console.log('Generated text has blacklisted words');
                            return true;
                        }
                    }
                }
                return false;
            };

            if (generatedTextFiltered(text)) {
                swipe_right();
                return;
            }
        }
        playMessageSound();
    }

    onErrorStreaming() {
        this.abortController.abort();
        this.isStopped = true;

        this.hideMessageButtons(this.messageId);
        $('#send_textarea').removeAttr('disabled');
        is_send_press = false;
        activateSendButtons();
        setGenerationProgress(0);
        showSwipeButtons();
    }

    setFirstSwipe(messageId) {
        if (this.type !== 'swipe' && this.type !== 'impersonate') {
            if (Array.isArray(chat[messageId]['swipes']) && chat[messageId]['swipes'].length === 1 && chat[messageId]['swipe_id'] === 0) {
                chat[messageId]['swipes'][0] = chat[messageId]['mes'];
                chat[messageId]['swipe_info'][0] = { 'send_date': chat[messageId]['send_date'], 'gen_started': chat[messageId]['gen_started'], 'gen_finished': chat[messageId]['gen_finished'], 'extra': JSON.parse(JSON.stringify(chat[messageId]['extra'])) };
            }
        }
    }

    onStopStreaming() {
        this.onErrorStreaming();
    }

    *nullStreamingGeneration() {
        throw new Error('Generation function for streaming is not hooked up');
    }

    async generate() {
        if (this.messageId == -1) {
            this.messageId = await this.onStartStreaming(this.firstMessageText);
            await delay(1); // delay for message to be rendered
            scrollLock = false;
        }

        // Stopping strings are expensive to calculate, especially with macros enabled. To remove stopping strings
        // when streaming, we cache the result of getStoppingStrings instead of calling it once per token.
        const isImpersonate = this.type == 'impersonate';
        const isContinue = this.type == 'continue';
        this.stoppingStrings = getStoppingStrings(isImpersonate, isContinue);

        try {
            const sw = new Stopwatch(1000 / power_user.streaming_fps);
            const timestamps = [];
            for await (const { text, swipes } of this.generator()) {
                timestamps.push(Date.now());
                if (this.isStopped) {
                    return;
                }

                this.result = text;
                this.swipes = swipes;
                await sw.tick(() => this.onProgressStreaming(this.messageId, this.messageAlreadyGenerated + text));
            }
            const seconds = (timestamps[timestamps.length - 1] - timestamps[0]) / 1000;
            console.warn(`Stream stats: ${timestamps.length} tokens, ${seconds.toFixed(2)} seconds, rate: ${Number(timestamps.length / seconds).toFixed(2)} TPS`);
        }
        catch (err) {
            console.error(err);
            this.onErrorStreaming();
            return;
        }

        this.isFinished = true;
        return this.result;
    }
}

/**
 * Generates a message using the provided prompt.
 * @param {string} prompt Prompt to generate a message from
 * @param {string} api API to use. Main API is used if not specified.
 * @param {boolean} instructOverride true to override instruct mode, false to use the default value
 * @returns {Promise<string>} Generated message
 */
export async function generateRaw(prompt, api, instructOverride) {
    if (!api) {
        api = main_api;
    }

    const abortController = new AbortController();
    const isInstruct = power_user.instruct.enabled && main_api !== 'openai' && main_api !== 'novel' && !instructOverride;

    prompt = substituteParams(prompt);
    prompt = api == 'novel' ? adjustNovelInstructionPrompt(prompt) : prompt;
    prompt = isInstruct ? formatInstructModeChat(name1, prompt, false, true, '', name1, name2, false) : prompt;
    prompt = isInstruct ? (prompt + formatInstructModePrompt(name2, false, '', name1, name2)) : (prompt + '\n');

    let generateData = {};

    switch (api) {
        case 'kobold':
        case 'koboldhorde':
            if (preset_settings === 'gui') {
                generateData = { prompt: prompt, gui_settings: true, max_length: amount_gen, max_context_length: max_context };
            } else {
                const isHorde = api === 'koboldhorde';
                const koboldSettings = koboldai_settings[koboldai_setting_names[preset_settings]];
                generateData = getKoboldGenerationData(prompt, koboldSettings, amount_gen, max_context, isHorde, 'quiet');
            }
            break;
        case 'novel': {
            const novelSettings = novelai_settings[novelai_setting_names[nai_settings.preset_settings_novel]];
            generateData = getNovelGenerationData(prompt, novelSettings, amount_gen, false, false, null, 'quiet');
            break;
        }
        case 'textgenerationwebui':
            generateData = getTextGenGenerationData(prompt, amount_gen, false, false, null, 'quiet');
            break;
        case 'openai':
            generateData = [{ role: 'user', content: prompt.trim() }];
    }

    let data = {};

    if (api == 'koboldhorde') {
        data = await generateHorde(prompt, generateData, abortController.signal, false);
    } else if (api == 'openai') {
        data = await sendOpenAIRequest('quiet', generateData, abortController.signal);
    } else {
        const generateUrl = getGenerateUrl(api);
        const response = await fetch(generateUrl, {
            method: 'POST',
            headers: getRequestHeaders(),
            cache: 'no-cache',
            body: JSON.stringify(generateData),
            signal: abortController.signal,
        });

        if (!response.ok) {
            const error = await response.json();
            throw error;
        }

        data = await response.json();
    }

    if (data.error) {
        throw new Error(data.error);
    }

    const message = cleanUpMessage(extractMessageFromData(data), false, false, true);

    if (!message) {
        throw new Error('No message generated');
    }

    return message;
}

// Returns a promise that resolves when the text is done generating.
async function Generate(type, { automatic_trigger, force_name2, quiet_prompt, quietToLoud, skipWIAN, force_chid, signal, quietImage, maxLoops } = {}, dryRun = false) {
    console.log('Generate entered');
    eventSource.emit(event_types.GENERATION_STARTED, type, { automatic_trigger, force_name2, quiet_prompt, quietToLoud, skipWIAN, force_chid, signal, quietImage, maxLoops }, dryRun);
    setGenerationProgress(0);
    generation_started = new Date();

    // Don't recreate abort controller if signal is passed
    if (!(abortController && signal)) {
        abortController = new AbortController();
    }

    // OpenAI doesn't need instruct mode. Use OAI main prompt instead.
    const isInstruct = power_user.instruct.enabled && main_api !== 'openai';
    const isImpersonate = type == 'impersonate';

    let message_already_generated = isImpersonate ? `${name1}: ` : `${name2}: `;

    const interruptedByCommand = await processCommands($('#send_textarea').val(), type, dryRun);

    if (interruptedByCommand) {
        //$("#send_textarea").val('').trigger('input');
        unblockGeneration();
        return Promise.resolve();
    }

    if (main_api == 'kobold' && kai_settings.streaming_kobold && !kai_flags.can_use_streaming) {
        toastr.error('Streaming is enabled, but the version of Kobold used does not support token streaming.', undefined, { timeOut: 10000, preventDuplicates: true });
        unblockGeneration();
        return Promise.resolve();
    }

    if (main_api === 'textgenerationwebui' &&
        textgen_settings.streaming &&
        textgen_settings.legacy_api &&
        (textgen_settings.type === OOBA || textgen_settings.type === APHRODITE)) {
        toastr.error('Streaming is not supported for the Legacy API. Update Ooba and use new API to enable streaming.', undefined, { timeOut: 10000, preventDuplicates: true });
        unblockGeneration();
        return Promise.resolve();
    }

    if (isHordeGenerationNotAllowed()) {
        unblockGeneration();
        return Promise.resolve();
    }

    // Hide swipes if not in a dry run.
    if (!dryRun) {
        hideSwipeButtons();
    }

    if (selected_group && !is_group_generating && !dryRun) {
        // Returns the promise that generateGroupWrapper returns; resolves when generation is done
        return generateGroupWrapper(false, type, { quiet_prompt, force_chid, signal: abortController.signal, quietImage, maxLoops });
    } else if (selected_group && !is_group_generating && dryRun) {
        const characterIndexMap = new Map(characters.map((char, index) => [char.avatar, index]));
        const group = groups.find((x) => x.id === selected_group);

        const enabledMembers = group.members.reduce((acc, member) => {
            if (!group.disabled_members.includes(member) && !acc.includes(member)) {
                acc.push(member);
            }
            return acc;
        }, []);

        const memberIds = enabledMembers
            .map((member) => characterIndexMap.get(member))
            .filter((index) => index !== undefined && index !== null);

        if (memberIds.length > 0) {
            setCharacterId(memberIds[0]);
            setCharacterName('');
        } else {
            console.log('No enabled members found');
            unblockGeneration();
            return Promise.resolve();
        }
    }

    //#########QUIET PROMPT STUFF##############
    //this function just gives special care to novel quiet instruction prompts
    if (quiet_prompt) {
        quiet_prompt = substituteParams(quiet_prompt);
        quiet_prompt = main_api == 'novel' && !quietToLoud ? adjustNovelInstructionPrompt(quiet_prompt) : quiet_prompt;
    }

    if (true === dryRun ||
        (online_status != 'no_connection' && this_chid != undefined && this_chid !== 'invalid-safety-id')) {
        let textareaText;
        if (type !== 'regenerate' && type !== 'swipe' && type !== 'quiet' && !isImpersonate && !dryRun) {
            is_send_press = true;
            textareaText = String($('#send_textarea').val());
            $('#send_textarea').val('').trigger('input');
        } else {
            textareaText = '';
            if (chat.length && chat[chat.length - 1]['is_user']) {
                //do nothing? why does this check exist?
            }
            else if (type !== 'quiet' && type !== 'swipe' && !isImpersonate && !dryRun && chat.length) {
                chat.length = chat.length - 1;
                count_view_mes -= 1;
                $('#chat').children().last().hide(250, function () {
                    $(this).remove();
                });
                await eventSource.emit(event_types.MESSAGE_DELETED, chat.length);
            }
        }

        if (!type && !textareaText && power_user.continue_on_send && !selected_group && chat.length && !chat[chat.length - 1]['is_user'] && !chat[chat.length - 1]['is_system']) {
            type = 'continue';
        }

        const isContinue = type == 'continue';

        // Rewrite the generation timer to account for the time passed for all the continuations.
        if (isContinue && chat.length) {
            const prevFinished = chat[chat.length - 1]['gen_finished'];
            const prevStarted = chat[chat.length - 1]['gen_started'];

            if (prevFinished && prevStarted) {
                const timePassed = prevFinished - prevStarted;
                generation_started = new Date(Date.now() - timePassed);
                chat[chat.length - 1]['gen_started'] = generation_started;
            }
        }

        if (!dryRun) {
            deactivateSendButtons();
        }

        let { messageBias, promptBias, isUserPromptBias } = getBiasStrings(textareaText, type);

        //*********************************
        //PRE FORMATING STRING
        //*********************************

        //for normal messages sent from user..
        if ((textareaText != '' || hasPendingFileAttachment()) && !automatic_trigger && type !== 'quiet' && !dryRun) {
            // If user message contains no text other than bias - send as a system message
            if (messageBias && !removeMacros(textareaText)) {
                sendSystemMessage(system_message_types.GENERIC, ' ', { bias: messageBias });
            }
            else {
                await sendMessageAsUser(textareaText, messageBias);
            }
        }
        else if (textareaText == '' && !automatic_trigger && !dryRun && type === undefined && main_api == 'openai' && oai_settings.send_if_empty.trim().length > 0) {
            // Use send_if_empty if set and the user message is empty. Only when sending messages normally
            await sendMessageAsUser(oai_settings.send_if_empty.trim(), messageBias);
        }

        let {
            description,
            personality,
            persona,
            scenario,
            mesExamples,
            system,
            jailbreak,
        } = getCharacterCardFields();

        if (isInstruct) {
            system = power_user.prefer_character_prompt && system ? system : baseChatReplace(power_user.instruct.system_prompt, name1, name2);
            system = formatInstructModeSystemPrompt(substituteParams(system, name1, name2, power_user.instruct.system_prompt));
        }

        // Depth prompt (character-specific A/N)
        removeDepthPrompts();
        const groupDepthPrompts = getGroupDepthPrompts(selected_group, Number(this_chid));

        if (selected_group && Array.isArray(groupDepthPrompts) && groupDepthPrompts.length > 0) {
            groupDepthPrompts.forEach((value, index) => {
                setExtensionPrompt('DEPTH_PROMPT_' + index, value.text, extension_prompt_types.IN_CHAT, value.depth, extension_settings.note.allowWIScan);
            });
        } else {
            const depthPromptText = baseChatReplace(characters[this_chid].data?.extensions?.depth_prompt?.prompt?.trim(), name1, name2) || '';
            const depthPromptDepth = characters[this_chid].data?.extensions?.depth_prompt?.depth ?? depth_prompt_depth_default;
            setExtensionPrompt('DEPTH_PROMPT', depthPromptText, extension_prompt_types.IN_CHAT, depthPromptDepth, extension_settings.note.allowWIScan);
        }

        // Parse example messages
        if (!mesExamples.startsWith('<START>')) {
            mesExamples = '<START>\n' + mesExamples.trim();
        }
        if (mesExamples.replace(/<START>/gi, '').trim().length === 0) {
            mesExamples = '';
        }
        if (mesExamples && isInstruct) {
            mesExamples = formatInstructModeExamples(mesExamples, name1, name2);
        }

        const exampleSeparator = power_user.context.example_separator ? `${substituteParams(power_user.context.example_separator)}\n` : '';
        const blockHeading = main_api === 'openai' ? '<START>\n' : exampleSeparator;
        let mesExamplesArray = mesExamples.split(/<START>/gi).slice(1).map(block => `${blockHeading}${block.trim()}\n`);

        // First message in fresh 1-on-1 chat reacts to user/character settings changes
        if (chat.length) {
            chat[0].mes = substituteParams(chat[0].mes);
        }

        // Collect messages with usable content
        let coreChat = chat.filter(x => !x.is_system);
        if (type === 'swipe') {
            coreChat.pop();
        }

        coreChat = await Promise.all(coreChat.map(async (chatItem, index) => {
            let message = chatItem.mes;
            let regexType = chatItem.is_user ? regex_placement.USER_INPUT : regex_placement.AI_OUTPUT;
            let options = { isPrompt: true };

            let regexedMessage = getRegexedString(message, regexType, options);
            regexedMessage = await appendFileContent(chatItem, regexedMessage);

            return {
                ...chatItem,
                mes: regexedMessage,
                index,
            };
        }));

        // Determine token limit
        let this_max_context = getMaxContextSize();

        if (!dryRun && type !== 'quiet') {
            console.debug('Running extension interceptors');
            const aborted = await runGenerationInterceptors(coreChat, this_max_context);

            if (aborted) {
                console.debug('Generation aborted by extension interceptors');
                unblockGeneration();
                return Promise.resolve();
            }
        } else {
            console.debug('Skipping extension interceptors for dry run');
        }

        console.log(`Core/all messages: ${coreChat.length}/${chat.length}`);

        // kingbri MARK: - Make sure the prompt bias isn't the same as the user bias
        if ((promptBias && !isUserPromptBias) || power_user.always_force_name2 || main_api == 'novel') {
            force_name2 = true;
        }

        if (isImpersonate) {
            force_name2 = false;
        }

        //////////////////////////////////

        let chat2 = [];
        let continue_mag = '';
        for (let i = coreChat.length - 1, j = 0; i >= 0; i--, j++) {
            // For OpenAI it's only used in WI
            if (main_api == 'openai' && (!world_info || world_info.length === 0)) {
                console.debug('No WI, skipping chat2 for OAI');
                break;
            }

            chat2[i] = formatMessageHistoryItem(coreChat[j], isInstruct, false);

            if (j === 0 && isInstruct) {
                // Reformat with the first output sequence (if any)
                chat2[i] = formatMessageHistoryItem(coreChat[j], isInstruct, force_output_sequence.FIRST);
            }

            // Do not suffix the message for continuation
            if (i === 0 && isContinue) {
                if (isInstruct) {
                    // Reformat with the last output sequence (if any)
                    chat2[i] = formatMessageHistoryItem(coreChat[j], isInstruct, force_output_sequence.LAST);
                }

                chat2[i] = chat2[i].slice(0, chat2[i].lastIndexOf(coreChat[j].mes) + coreChat[j].mes.length);
                continue_mag = coreChat[j].mes;
            }
        }

        // Adjust token limit for Horde
        let adjustedParams;
        if (main_api == 'koboldhorde' && (horde_settings.auto_adjust_context_length || horde_settings.auto_adjust_response_length)) {
            try {
                adjustedParams = await adjustHordeGenerationParams(max_context, amount_gen);
            }
            catch {
                unblockGeneration();
                return Promise.resolve();
            }
            if (horde_settings.auto_adjust_context_length) {
                this_max_context = (adjustedParams.maxContextLength - adjustedParams.maxLength);
            }
        }

        // Extension added strings
        // Set non-WI AN
        setFloatingPrompt();
        // Add WI to prompt (and also inject WI to AN value via hijack)

        let { worldInfoString, worldInfoBefore, worldInfoAfter, worldInfoDepth } = await getWorldInfoPrompt(chat2, this_max_context);

        if (skipWIAN !== true) {
            console.log('skipWIAN not active, adding WIAN');
            // Add all depth WI entries to prompt
            flushWIDepthInjections();
            if (Array.isArray(worldInfoDepth)) {
                worldInfoDepth.forEach((e) => {
                    const joinedEntries = e.entries.join('\n');
                    setExtensionPrompt(`customDepthWI-${e.depth}`, joinedEntries, extension_prompt_types.IN_CHAT, e.depth);
                });
            }
        } else {
            console.log('skipping WIAN');
        }

        // Add persona description to prompt
        addPersonaDescriptionExtensionPrompt();
        // Call combined AN into Generate
        let allAnchors = getAllExtensionPrompts();
        const beforeScenarioAnchor = getExtensionPrompt(extension_prompt_types.BEFORE_PROMPT).trimStart();
        const afterScenarioAnchor = getExtensionPrompt(extension_prompt_types.IN_PROMPT);
        let zeroDepthAnchor = getExtensionPrompt(extension_prompt_types.IN_CHAT, 0, ' ');

        const storyStringParams = {
            description: description,
            personality: personality,
            persona: persona,
            scenario: scenario,
            system: isInstruct ? system : '',
            char: name2,
            user: name1,
            wiBefore: worldInfoBefore,
            wiAfter: worldInfoAfter,
            loreBefore: worldInfoBefore,
            loreAfter: worldInfoAfter,
            mesExamples: mesExamplesArray.join(''),
        };

        const storyString = renderStoryString(storyStringParams);

        // Story string rendered, safe to remove
        if (power_user.strip_examples) {
            mesExamplesArray = [];
        }

        let oaiMessages = [];
        let oaiMessageExamples = [];

        if (main_api === 'openai') {
            message_already_generated = '';
            oaiMessages = setOpenAIMessages(coreChat);
            oaiMessageExamples = setOpenAIMessageExamples(mesExamplesArray);
        }

        // hack for regeneration of the first message
        if (chat2.length == 0) {
            chat2.push('');
        }

        let examplesString = '';
        let chatString = '';
        let cyclePrompt = '';

        function getMessagesTokenCount() {
            const encodeString = [
                storyString,
                examplesString,
                chatString,
                allAnchors,
                quiet_prompt,
                cyclePrompt,
            ].join('').replace(/\r/gm, '');
            return getTokenCount(encodeString, power_user.token_padding);
        }

        // Force pinned examples into the context
        let pinExmString;
        if (power_user.pin_examples) {
            pinExmString = examplesString = mesExamplesArray.join('');
        }

        // Only add the chat in context if past the greeting message
        if (isContinue && (chat2.length > 1 || main_api === 'openai')) {
            cyclePrompt = chat2.shift();
        }

        // Collect enough messages to fill the context
        let arrMes = [];
        let tokenCount = getMessagesTokenCount();
        for (let item of chat2) {
            // not needed for OAI prompting
            if (main_api == 'openai') {
                break;
            }

            tokenCount += getTokenCount(item.replace(/\r/gm, ''));
            chatString = item + chatString;
            if (tokenCount < this_max_context) {
                arrMes[arrMes.length] = item;
            } else {
                break;
            }

            // Prevent UI thread lock on tokenization
            await delay(1);
        }

        if (main_api !== 'openai') {
            setInContextMessages(arrMes.length, type);
        }

        // Estimate how many unpinned example messages fit in the context
        tokenCount = getMessagesTokenCount();
        let count_exm_add = 0;
        if (!power_user.pin_examples) {
            for (let example of mesExamplesArray) {
                tokenCount += getTokenCount(example.replace(/\r/gm, ''));
                examplesString += example;
                if (tokenCount < this_max_context) {
                    count_exm_add++;
                } else {
                    break;
                }
                await delay(1);
            }
        }

        let mesSend = [];
        console.debug('calling runGenerate');

        if (isContinue) {
            // Coping mechanism for OAI spacing
            const isForceInstruct = isOpenRouterWithInstruct();
            if (main_api === 'openai' && !isForceInstruct && !cyclePrompt.endsWith(' ')) {
                cyclePrompt += ' ';
                continue_mag += ' ';
            }
            message_already_generated = continue_mag;
        }

        const originalType = type;

        if (!dryRun) {
            is_send_press = true;
        }

        generatedPromptCache += cyclePrompt;
        if (generatedPromptCache.length == 0 || type === 'continue') {
            console.debug('generating prompt');
            chatString = '';
            arrMes = arrMes.reverse();
            arrMes.forEach(function (item, i, arr) {// For added anchors and others
                // OAI doesn't need all of this
                if (main_api === 'openai') {
                    return;
                }

                // Cohee: I'm not even sure what this is for anymore
                if (i === arrMes.length - 1 && type !== 'continue') {
                    item = item.replace(/\n?$/, '');
                }

                mesSend[mesSend.length] = { message: item, extensionPrompts: [] };
            });
        }

        let mesExmString = '';

        function setPromptString() {
            if (main_api == 'openai') {
                return;
            }

            console.debug('--setting Prompt string');
            mesExmString = pinExmString ?? mesExamplesArray.slice(0, count_exm_add).join('');

            if (mesSend.length) {
                mesSend[mesSend.length - 1].message = modifyLastPromptLine(mesSend[mesSend.length - 1].message);
            }
        }

        function modifyLastPromptLine(lastMesString) {
            //#########QUIET PROMPT STUFF PT2##############

            // Add quiet generation prompt at depth 0
            if (quiet_prompt && quiet_prompt.length) {

                // here name1 is forced for all quiet prompts..why?
                const name = name1;
                //checks if we are in instruct, if so, formats the chat as such, otherwise just adds the quiet prompt
                const quietAppend = isInstruct ? formatInstructModeChat(name, quiet_prompt, false, true, '', name1, name2, false) : `\n${quiet_prompt}`;

                //This begins to fix quietPrompts (particularly /sysgen) for instruct
                //previously instruct input sequence was being appended to the last chat message w/o '\n'
                //and no output sequence was added after the input's content.
                //TODO: respect output_sequence vs last_output_sequence settings
                //TODO: decide how to prompt this to clarify who is talking 'Narrator', 'System', etc.
                if (isInstruct) {
                    lastMesString += '\n' + quietAppend; // + power_user.instruct.output_sequence + '\n';
                } else {
                    lastMesString += quietAppend;
                }


                // Ross: bailing out early prevents quiet prompts from respecting other instruct prompt toggles
                // for sysgen, SD, and summary this is desireable as it prevents the AI from responding as char..
                // but for idle prompting, we want the flexibility of the other prompt toggles, and to respect them as per settings in the extension
                // need a detection for what the quiet prompt is being asked for...

                // Bail out early?
                if (quietToLoud !== true) {
                    return lastMesString;
                }
            }


            // Get instruct mode line
            if (isInstruct && !isContinue) {
                const name = isImpersonate ? name1 : name2;
                lastMesString += formatInstructModePrompt(name, isImpersonate, promptBias, name1, name2);
            }

            // Get non-instruct impersonation line
            if (!isInstruct && isImpersonate && !isContinue) {
                const name = name1;
                if (!lastMesString.endsWith('\n')) {
                    lastMesString += '\n';
                }
                lastMesString += name + ':';
            }

            // Add character's name
            // Force name append on continue (if not continuing on user message)
            if (!isInstruct && force_name2) {
                if (!lastMesString.endsWith('\n')) {
                    lastMesString += '\n';
                }
                if (!isContinue || !(chat[chat.length - 1]?.is_user)) {
                    lastMesString += `${name2}:`;
                }
            }

            return lastMesString;
        }

        // Clean up the already generated prompt for seamless addition
        function cleanupPromptCache(promptCache) {
            // Remove the first occurrance of character's name
            if (promptCache.trimStart().startsWith(`${name2}:`)) {
                promptCache = promptCache.replace(`${name2}:`, '').trimStart();
            }

            // Remove the first occurrance of prompt bias
            if (promptCache.trimStart().startsWith(promptBias)) {
                promptCache = promptCache.replace(promptBias, '');
            }

            // Add a space if prompt cache doesn't start with one
            if (!/^\s/.test(promptCache) && !isInstruct && !isContinue) {
                promptCache = ' ' + promptCache;
            }

            return promptCache;
        }

        function checkPromptSize() {
            console.debug('---checking Prompt size');
            setPromptString();
            const prompt = [
                storyString,
                mesExmString,
                mesSend.join(''),
                generatedPromptCache,
                allAnchors,
                quiet_prompt,
            ].join('').replace(/\r/gm, '');
            let thisPromptContextSize = getTokenCount(prompt, power_user.token_padding);

            if (thisPromptContextSize > this_max_context) {        //if the prepared prompt is larger than the max context size...
                if (count_exm_add > 0) {                            // ..and we have example mesages..
                    count_exm_add--;                            // remove the example messages...
                    checkPromptSize();                            // and try agin...
                } else if (mesSend.length > 0) {                    // if the chat history is longer than 0
                    mesSend.shift();                            // remove the first (oldest) chat entry..
                    checkPromptSize();                            // and check size again..
                } else {
                    //end
                    console.debug(`---mesSend.length = ${mesSend.length}`);
                }
            }
        }

        if (generatedPromptCache.length > 0 && main_api !== 'openai') {
            console.debug('---Generated Prompt Cache length: ' + generatedPromptCache.length);
            checkPromptSize();
        } else {
            console.debug('---calling setPromptString ' + generatedPromptCache.length);
            setPromptString();
        }

        // Fetches the combined prompt for both negative and positive prompts
        const cfgGuidanceScale = getGuidanceScale();

        // For prompt bit itemization
        let mesSendString = '';

        function getCombinedPrompt(isNegative) {
            // Only return if the guidance scale doesn't exist or the value is 1
            // Also don't return if constructing the neutral prompt
            if (isNegative && (!cfgGuidanceScale || cfgGuidanceScale?.value === 1)) {
                return;
            }

            // OAI has its own prompt manager. No need to do anything here
            if (main_api === 'openai') {
                return '';
            }

            // Deep clone
            let finalMesSend = structuredClone(mesSend);

            // TODO: Rewrite getExtensionPrompt to not require multiple for loops
            // Set all extension prompts where insertion depth > mesSend length
            if (finalMesSend.length) {
                for (let upperDepth = MAX_INJECTION_DEPTH; upperDepth >= finalMesSend.length; upperDepth--) {
                    const upperAnchor = getExtensionPrompt(extension_prompt_types.IN_CHAT, upperDepth);
                    if (upperAnchor && upperAnchor.length) {
                        finalMesSend[0].extensionPrompts.push(upperAnchor);
                    }
                }
            }

            finalMesSend.forEach((mesItem, index) => {
                if (index === 0) {
                    return;
                }

                const anchorDepth = Math.abs(index - finalMesSend.length);
                // NOTE: Depth injected here!
                const extensionAnchor = getExtensionPrompt(extension_prompt_types.IN_CHAT, anchorDepth);

                if (anchorDepth >= 0 && extensionAnchor && extensionAnchor.length) {
                    mesItem.extensionPrompts.push(extensionAnchor);
                }
            });

            // TODO: Move zero-depth anchor append to work like CFG and bias appends
            if (zeroDepthAnchor?.length && !isContinue) {
                console.debug(/\s/.test(finalMesSend[finalMesSend.length - 1].message.slice(-1)));
                finalMesSend[finalMesSend.length - 1].message +=
                    /\s/.test(finalMesSend[finalMesSend.length - 1].message.slice(-1))
                        ? zeroDepthAnchor
                        : `${zeroDepthAnchor}`;
            }

            let cfgPrompt = {};
            if (cfgGuidanceScale && cfgGuidanceScale?.value !== 1) {
                cfgPrompt = getCfgPrompt(cfgGuidanceScale, isNegative);
            }

            if (cfgPrompt && cfgPrompt?.value) {
                if (cfgPrompt?.depth === 0) {
                    finalMesSend[finalMesSend.length - 1].message +=
                        /\s/.test(finalMesSend[finalMesSend.length - 1].message.slice(-1))
                            ? cfgPrompt.value
                            : ` ${cfgPrompt.value}`;
                } else {
                    // TODO: Make all extension prompts use an array/splice method
                    const lengthDiff = mesSend.length - cfgPrompt.depth;
                    const cfgDepth = lengthDiff >= 0 ? lengthDiff : 0;
                    finalMesSend[cfgDepth].extensionPrompts.push(`${cfgPrompt.value}\n`);
                }
            }

            // Add prompt bias after everything else
            // Always run with continue
            if (!isInstruct && !isImpersonate) {
                if (promptBias.trim().length !== 0) {
                    finalMesSend[finalMesSend.length - 1].message +=
                        /\s/.test(finalMesSend[finalMesSend.length - 1].message.slice(-1))
                            ? promptBias.trimStart()
                            : ` ${promptBias.trimStart()}`;
                }
            }

            // Prune from prompt cache if it exists
            if (generatedPromptCache.length !== 0) {
                generatedPromptCache = cleanupPromptCache(generatedPromptCache);
            }

            // Flattens the multiple prompt objects to a string.
            const combine = () => {
                // Right now, everything is suffixed with a newline
                mesSendString = finalMesSend.map((e) => `${e.extensionPrompts.join('')}${e.message}`).join('');

                // add a custom dingus (if defined)
                mesSendString = addChatsSeparator(mesSendString);

                // add chat preamble
                mesSendString = addChatsPreamble(mesSendString);

                let combinedPrompt = beforeScenarioAnchor +
                    storyString +
                    afterScenarioAnchor +
                    mesExmString +
                    mesSendString +
                    generatedPromptCache;

                combinedPrompt = combinedPrompt.replace(/\r/gm, '');

                if (power_user.collapse_newlines) {
                    combinedPrompt = collapseNewlines(combinedPrompt);
                }

                return combinedPrompt;
            };

            let data = {
                api: main_api,
                combinedPrompt: null,
                description,
                personality,
                persona,
                scenario,
                char: name2,
                user: name1,
                beforeScenarioAnchor,
                afterScenarioAnchor,
                mesExmString,
                finalMesSend,
                generatedPromptCache,
                main: system,
                jailbreak,
                naiPreamble: nai_settings.preamble,
            };

            // Before returning the combined prompt, give available context related information to all subscribers.
            eventSource.emitAndWait(event_types.GENERATE_BEFORE_COMBINE_PROMPTS, data);

            // If one or multiple subscribers return a value, forfeit the responsibillity of flattening the context.
            return !data.combinedPrompt ? combine() : data.combinedPrompt;
        }

        // Get the negative prompt first since it has the unmodified mesSend array
        let negativePrompt = main_api == 'textgenerationwebui' ? getCombinedPrompt(true) : undefined;
        let finalPrompt = getCombinedPrompt(false);

        // Include the entire guidance scale object
        const cfgValues = cfgGuidanceScale && cfgGuidanceScale?.value !== 1 ? ({ guidanceScale: cfgGuidanceScale, negativePrompt: negativePrompt }) : null;

        let maxLength = Number(amount_gen); // how many tokens the AI will be requested to generate
        let thisPromptBits = [];

        // TODO: Make this a switch
        if (main_api == 'koboldhorde' && horde_settings.auto_adjust_response_length) {
            maxLength = Math.min(maxLength, adjustedParams.maxLength);
            maxLength = Math.max(maxLength, MIN_LENGTH); // prevent validation errors
        }

        let generate_data;
        if (main_api == 'koboldhorde' || main_api == 'kobold') {
            generate_data = {
                prompt: finalPrompt,
                gui_settings: true,
                max_length: maxLength,
                max_context_length: max_context,
            };

            if (preset_settings != 'gui') {
                const isHorde = main_api == 'koboldhorde';
                const presetSettings = koboldai_settings[koboldai_setting_names[preset_settings]];
                const maxContext = (adjustedParams && horde_settings.auto_adjust_context_length) ? adjustedParams.maxContextLength : max_context;
                generate_data = getKoboldGenerationData(finalPrompt, presetSettings, maxLength, maxContext, isHorde, type);
            }
        }
        else if (main_api == 'textgenerationwebui') {
            generate_data = getTextGenGenerationData(finalPrompt, maxLength, isImpersonate, isContinue, cfgValues, type);
        }
        else if (main_api == 'novel') {
            const presetSettings = novelai_settings[novelai_setting_names[nai_settings.preset_settings_novel]];
            generate_data = getNovelGenerationData(finalPrompt, presetSettings, maxLength, isImpersonate, isContinue, cfgValues, type);
        }
        else if (main_api == 'openai') {
            let [prompt, counts] = await prepareOpenAIMessages({
                name2: name2,
                charDescription: description,
                charPersonality: personality,
                Scenario: scenario,
                worldInfoBefore: worldInfoBefore,
                worldInfoAfter: worldInfoAfter,
                extensionPrompts: extension_prompts,
                bias: promptBias,
                type: type,
                quietPrompt: quiet_prompt,
                quietImage: quietImage,
                cyclePrompt: cyclePrompt,
                systemPromptOverride: system,
                jailbreakPromptOverride: jailbreak,
                personaDescription: persona,
                messages: oaiMessages,
                messageExamples: oaiMessageExamples,
            }, dryRun);
            generate_data = { prompt: prompt };

            // counts will return false if the user has not enabled the token breakdown feature
            if (counts) {
                parseTokenCounts(counts, thisPromptBits);
            }

            if (!dryRun) {
                setInContextMessages(openai_messages_count, type);
            }
        }

        async function finishGenerating() {
            if (dryRun) return { error: 'dryRun' };

            if (power_user.console_log_prompts) {
                console.log(generate_data.prompt);
            }

            console.debug('rungenerate calling API');

            showStopButton();

            //set array object for prompt token itemization of this message
            let currentArrayEntry = Number(thisPromptBits.length - 1);
            let additionalPromptStuff = {
                ...thisPromptBits[currentArrayEntry],
                rawPrompt: generate_data.prompt || generate_data.input,
                mesId: getNextMessageId(type),
                allAnchors: allAnchors,
                summarizeString: (extension_prompts['1_memory']?.value || ''),
                authorsNoteString: (extension_prompts['2_floating_prompt']?.value || ''),
                smartContextString: (extension_prompts['chromadb']?.value || ''),
                worldInfoString: worldInfoString,
                storyString: storyString,
                beforeScenarioAnchor: beforeScenarioAnchor,
                afterScenarioAnchor: afterScenarioAnchor,
                examplesString: examplesString,
                mesSendString: mesSendString,
                generatedPromptCache: generatedPromptCache,
                promptBias: promptBias,
                finalPrompt: finalPrompt,
                charDescription: description,
                charPersonality: personality,
                scenarioText: scenario,
                this_max_context: this_max_context,
                padding: power_user.token_padding,
                main_api: main_api,
                instruction: isInstruct ? substituteParams(power_user.prefer_character_prompt && system ? system : power_user.instruct.system_prompt) : '',
                userPersona: (power_user.persona_description || ''),
            };

            thisPromptBits = additionalPromptStuff;

            //console.log(thisPromptBits);
            const itemizedIndex = itemizedPrompts.findIndex((item) => item.mesId === thisPromptBits['mesId']);

            if (itemizedIndex !== -1) {
                itemizedPrompts[itemizedIndex] = thisPromptBits;
            }
            else {
                itemizedPrompts.push(thisPromptBits);
            }

            console.debug(`pushed prompt bits to itemizedPrompts array. Length is now: ${itemizedPrompts.length}`);

            if (isStreamingEnabled() && type !== 'quiet') {
                streamingProcessor = new StreamingProcessor(type, force_name2, generation_started, message_already_generated);
                if (isContinue) {
                    // Save reply does add cycle text to the prompt, so it's not needed here
                    streamingProcessor.firstMessageText = '';
                }

                streamingProcessor.generator = await sendStreamingRequest(type, generate_data);

                hideSwipeButtons();
                let getMessage = await streamingProcessor.generate();
                let messageChunk = cleanUpMessage(getMessage, isImpersonate, isContinue, false);

                if (isContinue) {
                    getMessage = continue_mag + getMessage;
                }

                if (streamingProcessor && !streamingProcessor.isStopped && streamingProcessor.isFinished) {
                    await streamingProcessor.onFinishStreaming(streamingProcessor.messageId, getMessage);
                    streamingProcessor = null;
                    triggerAutoContinue(messageChunk, isImpersonate);
                }
            } else {
                return await sendGenerationRequest(type, generate_data);
            }
        }

        return finishGenerating().then(onSuccess, onError);

        async function onSuccess(data) {
            if (!data) return;
            let messageChunk = '';

            if (data.error == 'dryRun') {
                generatedPromptCache = '';
                return;
            }

            if (!data.error) {
                //const getData = await response.json();
                let getMessage = extractMessageFromData(data);
                let title = extractTitleFromData(data);
                kobold_horde_model = title;

                const swipes = extractMultiSwipes(data, type);

                messageChunk = cleanUpMessage(getMessage, isImpersonate, isContinue, false);

                if (isContinue) {
                    getMessage = continue_mag + getMessage;
                }

                //Formating
                const displayIncomplete = type === 'quiet' && !quietToLoud;
                getMessage = cleanUpMessage(getMessage, isImpersonate, isContinue, displayIncomplete);

                if (getMessage.length > 0) {
                    if (isImpersonate) {
                        $('#send_textarea').val(getMessage).trigger('input');
                        generatedPromptCache = '';
                        await eventSource.emit(event_types.IMPERSONATE_READY, getMessage);
                    }
                    else if (type == 'quiet') {
                        unblockGeneration();
                        return getMessage;
                    }
                    else {
                        // Without streaming we'll be having a full message on continuation. Treat it as a last chunk.
                        if (originalType !== 'continue') {
                            ({ type, getMessage } = await saveReply(type, getMessage, false, title, swipes));
                        }
                        else {
                            ({ type, getMessage } = await saveReply('appendFinal', getMessage, false, title, swipes));
                        }
                    }

                    if (type !== 'quiet') {
                        playMessageSound();
                    }
                } else {
                    // If maxLoops is not passed in (e.g. first time generating), set it to MAX_GENERATION_LOOPS
                    maxLoops ??= MAX_GENERATION_LOOPS;

                    if (maxLoops === 0) {
                        if (type !== 'quiet') {
                            throwCircuitBreakerError();
                        }
                        throw new Error('Generate circuit breaker interruption');
                    }

                    // regenerate with character speech reenforced
                    // to make sure we leave on swipe type while also adding the name2 appendage
                    await delay(1000);
                    // The first await is for waiting for the generate to start. The second one is waiting for it to finish
                    const result = await await Generate(type, { automatic_trigger, force_name2: true, quiet_prompt, skipWIAN, force_chid, maxLoops: maxLoops - 1 });
                    return result;
                }

                if (power_user.auto_swipe) {
                    console.debug('checking for autoswipeblacklist on non-streaming message');
                    function containsBlacklistedWords(getMessage, blacklist, threshold) {
                        console.debug('checking blacklisted words');
                        const regex = new RegExp(`\\b(${blacklist.join('|')})\\b`, 'gi');
                        const matches = getMessage.match(regex) || [];
                        return matches.length >= threshold;
                    }

                    const generatedTextFiltered = (getMessage) => {
                        if (power_user.auto_swipe_blacklist_threshold) {
                            if (containsBlacklistedWords(getMessage, power_user.auto_swipe_blacklist, power_user.auto_swipe_blacklist_threshold)) {
                                console.debug('Generated text has blacklisted words');
                                return true;
                            }
                        }

                        return false;
                    };
                    if (generatedTextFiltered(getMessage)) {
                        console.debug('swiping right automatically');
                        is_send_press = false;
                        swipe_right();
                        // TODO: do we want to resolve after an auto-swipe?
                        return;
                    }
                }
            } else {
                generatedPromptCache = '';

                if (data?.response) {
                    toastr.error(data.response, 'API Error');
                }
                throw data?.response;
            }

            console.debug('/api/chats/save called by /Generate');
            await saveChatConditional();
            unblockGeneration();
            streamingProcessor = null;

            if (type !== 'quiet') {
                triggerAutoContinue(messageChunk, isImpersonate);
            }
        }

        function onError(exception) {
            if (typeof exception?.error?.message === 'string') {
                toastr.error(exception.error.message, 'Error', { timeOut: 10000, extendedTimeOut: 20000 });
            }

            unblockGeneration();
            console.log(exception);
            streamingProcessor = null;
            throw exception;
        }
    } else {    //generate's primary loop ends, after this is error handling for no-connection or safety-id
        if (this_chid === undefined || this_chid === 'invalid-safety-id') {
            toastr.warning('Сharacter is not selected');
        }
        is_send_press = false;
    }
}

function flushWIDepthInjections() {
    //prevent custom depth WI entries (which have unique random key names) from duplicating
    for (const key of Object.keys(extension_prompts)) {
        if (key.startsWith('customDepthWI')) {
            delete extension_prompts[key];
        }
    }
}

function unblockGeneration() {
    is_send_press = false;
    activateSendButtons();
    showSwipeButtons();
    setGenerationProgress(0);
    flushEphemeralStoppingStrings();
    flushWIDepthInjections();
    $('#send_textarea').removeAttr('disabled');
}

export function getNextMessageId(type) {
    return type == 'swipe' ? Number(count_view_mes - 1) : Number(count_view_mes);
}

/**
 *
 * @param {string} messageChunk
 * @param {boolean} isImpersonate
 * @returns {void}
 */
export function triggerAutoContinue(messageChunk, isImpersonate) {
    if (selected_group) {
        console.log('Auto-continue is disabled for group chat');
        return;
    }

    if (power_user.auto_continue.enabled && !is_send_press) {
        if (power_user.auto_continue.target_length <= 0) {
            console.log('Auto-continue target length is 0, not triggering auto-continue');
            return;
        }

        if (main_api === 'openai' && !power_user.auto_continue.allow_chat_completions) {
            console.log('Auto-continue for OpenAI is disabled by user.');
            return;
        }

        if (isImpersonate) {
            console.log('Continue for impersonation is not implemented yet');
            return;
        }

        const textareaText = String($('#send_textarea').val());
        const USABLE_LENGTH = 5;

        if (textareaText.length > 0) {
            console.log('Not triggering auto-continue because user input is not empty');
            return;
        }

        if (messageChunk.trim().length > USABLE_LENGTH && chat.length) {
            const lastMessage = chat[chat.length - 1];
            const messageLength = getTokenCount(lastMessage.mes);
            const shouldAutoContinue = messageLength < power_user.auto_continue.target_length;

            if (shouldAutoContinue) {
                console.log(`Triggering auto-continue. Message tokens: ${messageLength}. Target tokens: ${power_user.auto_continue.target_length}. Message chunk: ${messageChunk}`);
                $('#option_continue').trigger('click');
            } else {
                console.log(`Not triggering auto-continue. Message tokens: ${messageLength}. Target tokens: ${power_user.auto_continue.target_length}`);
                return;
            }
        } else {
            console.log('Last generated chunk was empty, not triggering auto-continue');
            return;
        }
    }
}

export function getBiasStrings(textareaText, type) {
    if (type == 'impersonate' || type == 'continue') {
        return { messageBias: '', promptBias: '', isUserPromptBias: false };
    }

    let promptBias = '';
    let messageBias = extractMessageBias(textareaText);

    // If user input is not provided, retrieve the bias of the most recent relevant message
    if (!textareaText) {
        for (let i = chat.length - 1; i >= 0; i--) {
            const mes = chat[i];
            if (type === 'swipe' && chat.length - 1 === i) {
                continue;
            }
            if (mes && (mes.is_user || mes.is_system || mes.extra?.type === system_message_types.NARRATOR)) {
                if (mes.extra?.bias?.trim()?.length > 0) {
                    promptBias = mes.extra.bias;
                }
                break;
            }
        }
    }

    promptBias = messageBias || promptBias || power_user.user_prompt_bias || '';
    const isUserPromptBias = promptBias === power_user.user_prompt_bias;

    // Substitute params for everything
    messageBias = substituteParams(messageBias);
    promptBias = substituteParams(promptBias);

    return { messageBias, promptBias, isUserPromptBias };
}

/**
 * @param {Object} chatItem Message history item.
 * @param {boolean} isInstruct Whether instruct mode is enabled.
 * @param {boolean|number} forceOutputSequence Whether to force the first/last output sequence for instruct mode.
 */
function formatMessageHistoryItem(chatItem, isInstruct, forceOutputSequence) {
    const isNarratorType = chatItem?.extra?.type === system_message_types.NARRATOR;
    const characterName = chatItem?.name ? chatItem.name : name2;
    const itemName = chatItem.is_user ? chatItem['name'] : characterName;
    const shouldPrependName = !isNarratorType;

    let textResult = shouldPrependName ? `${itemName}: ${chatItem.mes}\n` : `${chatItem.mes}\n`;

    if (isInstruct) {
        textResult = formatInstructModeChat(itemName, chatItem.mes, chatItem.is_user, isNarratorType, chatItem.force_avatar, name1, name2, forceOutputSequence);
    }

    return textResult;
}

/**
 * Removes all {{macros}} from a string.
 * @param {string} str String to remove macros from.
 * @returns {string} String with macros removed.
 */
export function removeMacros(str) {
    return (str ?? '').replace(/\{\{[\s\S]*?\}\}/gm, '').trim();
}

/**
 * Inserts a user message into the chat history.
 * @param {string} messageText Message text.
 * @param {string} messageBias Message bias.
 * @param {number} [insertAt] Optional index to insert the message at.
 * @returns {Promise<void>} A promise that resolves when the message is inserted.
 */
export async function sendMessageAsUser(messageText, messageBias, insertAt = null) {
    messageText = getRegexedString(messageText, regex_placement.USER_INPUT);

    const message = {
        name: name1,
        is_user: true,
        is_system: false,
        send_date: getMessageTimeStamp(),
        mes: substituteParams(messageText),
        extra: {},
    };

    if (power_user.message_token_count_enabled) {
        message.extra.token_count = getTokenCount(message.mes, 0);
    }

    // Lock user avatar to a persona.
    if (user_avatar in power_user.personas) {
        message.force_avatar = getUserAvatar(user_avatar);
    }

    if (messageBias) {
        message.extra.bias = messageBias;
    }

    await populateFileAttachment(message);
    statMesProcess(message, 'user', characters, this_chid, '');

    if (typeof insertAt === 'number' && insertAt >= 0 && insertAt <= chat.length) {
        chat.splice(insertAt, 0, message);
        await saveChatConditional();
        await eventSource.emit(event_types.MESSAGE_SENT, insertAt);
        await reloadCurrentChat();
        await eventSource.emit(event_types.USER_MESSAGE_RENDERED, insertAt);
    } else {
        chat.push(message);
        const chat_id = (chat.length - 1);
        await eventSource.emit(event_types.MESSAGE_SENT, chat_id);
        addOneMessage(message);
        await eventSource.emit(event_types.USER_MESSAGE_RENDERED, chat_id);
    }
}

function getMaxContextSize() {
    let this_max_context = 1487;
    if (main_api == 'kobold' || main_api == 'koboldhorde' || main_api == 'textgenerationwebui') {
        this_max_context = (max_context - amount_gen);
    }
    if (main_api == 'novel') {
        this_max_context = Number(max_context);
        if (nai_settings.model_novel.includes('clio')) {
            this_max_context = Math.min(max_context, 8192);
        }
        if (nai_settings.model_novel.includes('kayra')) {
            this_max_context = Math.min(max_context, 8192);

            const subscriptionLimit = getKayraMaxContextTokens();
            if (typeof subscriptionLimit === 'number' && this_max_context > subscriptionLimit) {
                this_max_context = subscriptionLimit;
                console.log(`NovelAI subscription limit reached. Max context size is now ${this_max_context}`);
            }
        }

        this_max_context = this_max_context - amount_gen;
    }
    if (main_api == 'openai') {
        this_max_context = oai_settings.openai_max_context - oai_settings.openai_max_tokens;
    }
    return this_max_context;
}

function parseTokenCounts(counts, thisPromptBits) {
    /**
     * @param {any[]} numbers
     */
    function getSum(...numbers) {
        return numbers.map(x => Number(x)).filter(x => !Number.isNaN(x)).reduce((acc, val) => acc + val, 0);
    }
    const total = getSum(Object.values(counts));

    thisPromptBits.push({
        oaiStartTokens: (counts?.start + counts?.controlPrompts) || 0,
        oaiPromptTokens: getSum(counts?.prompt, counts?.charDescription, counts?.charPersonality, counts?.scenario) || 0,
        oaiBiasTokens: counts?.bias || 0,
        oaiNudgeTokens: counts?.nudge || 0,
        oaiJailbreakTokens: counts?.jailbreak || 0,
        oaiImpersonateTokens: counts?.impersonate || 0,
        oaiExamplesTokens: (counts?.dialogueExamples + counts?.examples) || 0,
        oaiConversationTokens: (counts?.conversation + counts?.chatHistory) || 0,
        oaiNsfwTokens: counts?.nsfw || 0,
        oaiMainTokens: counts?.main || 0,
        oaiTotalTokens: total,
    });
}

function addChatsPreamble(mesSendString) {
    return main_api === 'novel'
        ? substituteParams(nai_settings.preamble) + '\n' + mesSendString
        : mesSendString;
}

function addChatsSeparator(mesSendString) {
    if (power_user.context.chat_start) {
        return substituteParams(power_user.context.chat_start) + '\n' + mesSendString;
    }

    else {
        return mesSendString;
    }
}

// There's a TODO related to zero-depth anchors; not removing this function until that's resolved
// eslint-disable-next-line no-unused-vars
function appendZeroDepthAnchor(force_name2, zeroDepthAnchor, finalPrompt) {
    const trimBothEnds = !force_name2;
    let trimmedPrompt = (trimBothEnds ? zeroDepthAnchor.trim() : zeroDepthAnchor.trimEnd());

    if (trimBothEnds && !finalPrompt.endsWith('\n')) {
        finalPrompt += '\n';
    }

    finalPrompt += trimmedPrompt;

    if (force_name2) {
        finalPrompt += ' ';
    }

    return finalPrompt;
}

async function DupeChar() {
    if (!this_chid) {
        toastr.warning('You must first select a character to duplicate!');
        return;
    }

    const confirmMessage = `
    <h3>Are you sure you want to duplicate this character?</h3>
    <span>If you just want to start a new chat with the same character, use "Start new chat" option in the bottom-left options menu.</span><br><br>`;

    const confirm = await callPopup(confirmMessage, 'confirm');

    if (!confirm) {
        console.log('User cancelled duplication');
        return;
    }

    const body = { avatar_url: characters[this_chid].avatar };
    const response = await fetch('/api/characters/duplicate', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(body),
    });
    if (response.ok) {
        toastr.success('Character Duplicated');
        getCharacters();
    }
}

function promptItemize(itemizedPrompts, requestedMesId) {
    console.log('PROMPT ITEMIZE ENTERED');
    var incomingMesId = Number(requestedMesId);
    console.debug(`looking for MesId ${incomingMesId}`);
    var thisPromptSet = undefined;

    for (var i = 0; i < itemizedPrompts.length; i++) {
        console.log(`looking for ${incomingMesId} vs ${itemizedPrompts[i].mesId}`);
        if (itemizedPrompts[i].mesId === incomingMesId) {
            console.log(`found matching mesID ${i}`);
            thisPromptSet = i;
            PromptArrayItemForRawPromptDisplay = i;
            console.log(`wanting to raw display of ArrayItem: ${PromptArrayItemForRawPromptDisplay} which is mesID ${incomingMesId}`);
            console.log(itemizedPrompts[thisPromptSet]);
        }
    }

    if (thisPromptSet === undefined) {
        console.log(`couldnt find the right mesId. looked for ${incomingMesId}`);
        console.log(itemizedPrompts);
        return null;
    }

    const params = {
        charDescriptionTokens: getTokenCount(itemizedPrompts[thisPromptSet].charDescription),
        charPersonalityTokens: getTokenCount(itemizedPrompts[thisPromptSet].charPersonality),
        scenarioTextTokens: getTokenCount(itemizedPrompts[thisPromptSet].scenarioText),
        userPersonaStringTokens: getTokenCount(itemizedPrompts[thisPromptSet].userPersona),
        worldInfoStringTokens: getTokenCount(itemizedPrompts[thisPromptSet].worldInfoString),
        allAnchorsTokens: getTokenCount(itemizedPrompts[thisPromptSet].allAnchors),
        summarizeStringTokens: getTokenCount(itemizedPrompts[thisPromptSet].summarizeString),
        authorsNoteStringTokens: getTokenCount(itemizedPrompts[thisPromptSet].authorsNoteString),
        smartContextStringTokens: getTokenCount(itemizedPrompts[thisPromptSet].smartContextString),
        beforeScenarioAnchorTokens: getTokenCount(itemizedPrompts[thisPromptSet].beforeScenarioAnchor),
        afterScenarioAnchorTokens: getTokenCount(itemizedPrompts[thisPromptSet].afterScenarioAnchor),
        zeroDepthAnchorTokens: getTokenCount(itemizedPrompts[thisPromptSet].zeroDepthAnchor), // TODO: unused
        thisPrompt_padding: itemizedPrompts[thisPromptSet].padding,
        this_main_api: itemizedPrompts[thisPromptSet].main_api,
    };

    if (params.this_main_api == 'openai') {
        //for OAI API
        //console.log('-- Counting OAI Tokens');

        //params.finalPromptTokens = itemizedPrompts[thisPromptSet].oaiTotalTokens;
        params.oaiMainTokens = itemizedPrompts[thisPromptSet].oaiMainTokens;
        params.oaiStartTokens = itemizedPrompts[thisPromptSet].oaiStartTokens;
        params.ActualChatHistoryTokens = itemizedPrompts[thisPromptSet].oaiConversationTokens;
        params.examplesStringTokens = itemizedPrompts[thisPromptSet].oaiExamplesTokens;
        params.oaiPromptTokens = itemizedPrompts[thisPromptSet].oaiPromptTokens - (params.afterScenarioAnchorTokens + params.beforeScenarioAnchorTokens) + params.examplesStringTokens;
        params.oaiBiasTokens = itemizedPrompts[thisPromptSet].oaiBiasTokens;
        params.oaiJailbreakTokens = itemizedPrompts[thisPromptSet].oaiJailbreakTokens;
        params.oaiNudgeTokens = itemizedPrompts[thisPromptSet].oaiNudgeTokens;
        params.oaiImpersonateTokens = itemizedPrompts[thisPromptSet].oaiImpersonateTokens;
        params.oaiNsfwTokens = itemizedPrompts[thisPromptSet].oaiNsfwTokens;
        params.finalPromptTokens =
            params.oaiStartTokens +
            params.oaiPromptTokens +
            params.oaiMainTokens +
            params.oaiNsfwTokens +
            params.oaiBiasTokens +
            params.oaiImpersonateTokens +
            params.oaiJailbreakTokens +
            params.oaiNudgeTokens +
            params.ActualChatHistoryTokens +
            //charDescriptionTokens +
            //charPersonalityTokens +
            //allAnchorsTokens +
            params.worldInfoStringTokens +
            params.beforeScenarioAnchorTokens +
            params.afterScenarioAnchorTokens;
        // Max context size - max completion tokens
        params.thisPrompt_max_context = (oai_settings.openai_max_context - oai_settings.openai_max_tokens);

        //console.log('-- applying % on OAI tokens');
        params.oaiStartTokensPercentage = ((params.oaiStartTokens / (params.finalPromptTokens)) * 100).toFixed(2);
        params.storyStringTokensPercentage = (((params.afterScenarioAnchorTokens + params.beforeScenarioAnchorTokens + params.oaiPromptTokens) / (params.finalPromptTokens)) * 100).toFixed(2);
        params.ActualChatHistoryTokensPercentage = ((params.ActualChatHistoryTokens / (params.finalPromptTokens)) * 100).toFixed(2);
        params.promptBiasTokensPercentage = ((params.oaiBiasTokens / (params.finalPromptTokens)) * 100).toFixed(2);
        params.worldInfoStringTokensPercentage = ((params.worldInfoStringTokens / (params.finalPromptTokens)) * 100).toFixed(2);
        params.allAnchorsTokensPercentage = ((params.allAnchorsTokens / (params.finalPromptTokens)) * 100).toFixed(2);
        params.selectedTokenizer = getFriendlyTokenizerName(params.this_main_api).tokenizerName;
        params.oaiSystemTokens = params.oaiImpersonateTokens + params.oaiJailbreakTokens + params.oaiNudgeTokens + params.oaiStartTokens + params.oaiNsfwTokens + params.oaiMainTokens;
        params.oaiSystemTokensPercentage = ((params.oaiSystemTokens / (params.finalPromptTokens)) * 100).toFixed(2);
    } else {
        //for non-OAI APIs
        //console.log('-- Counting non-OAI Tokens');
        params.finalPromptTokens = getTokenCount(itemizedPrompts[thisPromptSet].finalPrompt);
        params.storyStringTokens = getTokenCount(itemizedPrompts[thisPromptSet].storyString) - params.worldInfoStringTokens;
        params.examplesStringTokens = getTokenCount(itemizedPrompts[thisPromptSet].examplesString);
        params.mesSendStringTokens = getTokenCount(itemizedPrompts[thisPromptSet].mesSendString);
        params.ActualChatHistoryTokens = params.mesSendStringTokens - (params.allAnchorsTokens - (params.beforeScenarioAnchorTokens + params.afterScenarioAnchorTokens)) + power_user.token_padding;
        params.instructionTokens = getTokenCount(itemizedPrompts[thisPromptSet].instruction);
        params.promptBiasTokens = getTokenCount(itemizedPrompts[thisPromptSet].promptBias);

        params.totalTokensInPrompt =
            params.storyStringTokens +     //chardefs total
            params.worldInfoStringTokens +
            params.examplesStringTokens + // example messages
            params.ActualChatHistoryTokens +  //chat history
            params.allAnchorsTokens +      // AN and/or legacy anchors
            //afterScenarioAnchorTokens +       //only counts if AN is set to 'after scenario'
            //zeroDepthAnchorTokens +           //same as above, even if AN not on 0 depth
            params.promptBiasTokens;       //{{}}
        //- thisPrompt_padding;  //not sure this way of calculating is correct, but the math results in same value as 'finalPrompt'
        params.thisPrompt_max_context = itemizedPrompts[thisPromptSet].this_max_context;
        params.thisPrompt_actual = params.thisPrompt_max_context - params.thisPrompt_padding;

        //console.log('-- applying % on non-OAI tokens');
        params.storyStringTokensPercentage = ((params.storyStringTokens / (params.totalTokensInPrompt)) * 100).toFixed(2);
        params.ActualChatHistoryTokensPercentage = ((params.ActualChatHistoryTokens / (params.totalTokensInPrompt)) * 100).toFixed(2);
        params.promptBiasTokensPercentage = ((params.promptBiasTokens / (params.totalTokensInPrompt)) * 100).toFixed(2);
        params.worldInfoStringTokensPercentage = ((params.worldInfoStringTokens / (params.totalTokensInPrompt)) * 100).toFixed(2);
        params.allAnchorsTokensPercentage = ((params.allAnchorsTokens / (params.totalTokensInPrompt)) * 100).toFixed(2);
        params.selectedTokenizer = getFriendlyTokenizerName(params.this_main_api).tokenizerName;
    }

    if (params.this_main_api == 'openai') {
        callPopup(renderTemplate('itemizationChat', params), 'text');

    } else {
        callPopup(renderTemplate('itemizationText', params), 'text');
    }
}

function setInContextMessages(lastmsg, type) {
    $('#chat .mes').removeClass('lastInContext');

    if (type === 'swipe' || type === 'regenerate' || type === 'continue') {
        lastmsg++;
    }

    const lastMessageBlock = $('#chat .mes:not([is_system="true"])').eq(-lastmsg);
    lastMessageBlock.addClass('lastInContext');

    if (lastMessageBlock.length === 0) {
        const firstMessageId = getFirstDisplayedMessageId();
        $(`#chat .mes[mesid="${firstMessageId}"`).addClass('lastInContext');
    }
}

/**
 * Sends a non-streaming request to the API.
 * @param {string} type Generation type
 * @param {object} data Generation data
 * @returns {Promise<object>} Response data from the API
 */
async function sendGenerationRequest(type, data) {
    if (main_api === 'openai') {
        return await sendOpenAIRequest(type, data.prompt, abortController.signal);
    }

    if (main_api === 'koboldhorde') {
        return await generateHorde(data.prompt, data, abortController.signal, true);
    }

    const response = await fetch(getGenerateUrl(main_api), {
        method: 'POST',
        headers: getRequestHeaders(),
        cache: 'no-cache',
        body: JSON.stringify(data),
        signal: abortController.signal,
    });

    if (!response.ok) {
        const error = await response.json();
        throw error;
    }

    const responseData = await response.json();
    return responseData;
}

/**
 * Sends a streaming request to the API.
 * @param {string} type Generation type
 * @param {object} data Generation data
 * @returns {Promise<any>} Streaming generator
 */
async function sendStreamingRequest(type, data) {
    switch (main_api) {
        case 'openai':
            return await sendOpenAIRequest(type, data.prompt, streamingProcessor.abortController.signal);
        case 'textgenerationwebui':
            return await generateTextGenWithStreaming(data, streamingProcessor.abortController.signal);
        case 'novel':
            return await generateNovelWithStreaming(data, streamingProcessor.abortController.signal);
        case 'kobold':
            return await generateKoboldWithStreaming(data, streamingProcessor.abortController.signal);
        default:
            throw new Error('Streaming is enabled, but the current API does not support streaming.');
    }
}

/**
 * Gets the generation endpoint URL for the specified API.
 * @param {string} api API name
 * @returns {string} Generation URL
 */
function getGenerateUrl(api) {
    switch (api) {
        case 'kobold':
            return '/api/backends/kobold/generate';
        case 'koboldhorde':
            return '/api/backends/koboldhorde/generate';
        case 'textgenerationwebui':
            return '/api/backends/text-completions/generate';
        case 'novel':
            return '/api/novelai/generate';
        default:
            throw new Error(`Unknown API: ${api}`);
    }
}

function throwCircuitBreakerError() {
    callPopup(`Could not extract reply in ${MAX_GENERATION_LOOPS} attempts. Try generating again`, 'text');
    unblockGeneration();
}

function extractTitleFromData(data) {
    if (main_api == 'koboldhorde') {
        return data.workerName;
    }

    return undefined;
}

/**
 * Extracts the message from the response data.
 * @param {object} data Response data
 * @returns {string} Extracted message
 */
function extractMessageFromData(data) {
    switch (main_api) {
        case 'kobold':
            return data.results[0].text;
        case 'koboldhorde':
            return data.text;
        case 'textgenerationwebui':
            return data.choices?.[0]?.text ?? data.content ?? data.response;
        case 'novel':
            return data.output;
        case 'openai':
            return data;
        default:
            return '';
    }
}

/**
 * Extracts multiswipe swipes from the response data.
 * @param {Object} data Response data
 * @param {string} type Type of generation
 * @returns {string[]} Array of extra swipes
 */
function extractMultiSwipes(data, type) {
    const swipes = [];

    if (type === 'continue' || type === 'impersonate' || type === 'quiet') {
        return swipes;
    }

    if (main_api === 'textgenerationwebui' && textgen_settings.type === textgen_types.APHRODITE) {
        const multiSwipeCount = data.choices.length - 1;

        if (multiSwipeCount <= 0) {
            return swipes;
        }

        for (let i = 1; i < data.choices.length; i++) {
            const text = cleanUpMessage(data.choices[i].text, false, false, false);
            swipes.push(text);
        }
    }

    return swipes;
}

function cleanUpMessage(getMessage, isImpersonate, isContinue, displayIncompleteSentences = false, stoppingStrings = null) {
    if (!getMessage) {
        return '';
    }

    // Add the prompt bias before anything else
    if (
        power_user.user_prompt_bias &&
        !isImpersonate &&
        !isContinue &&
        power_user.user_prompt_bias.length !== 0
    ) {
        getMessage = substituteParams(power_user.user_prompt_bias) + getMessage;
    }

    // Allow for caching of stopping strings. getStoppingStrings is an expensive function, especially with macros
    // enabled, so for streaming, we call it once and then pass it into each cleanUpMessage call.
    if (!stoppingStrings) {
        stoppingStrings = getStoppingStrings(isImpersonate, isContinue);
    }

    for (const stoppingString of stoppingStrings) {
        if (stoppingString.length) {
            for (let j = stoppingString.length; j > 0; j--) {
                if (getMessage.slice(-j) === stoppingString.slice(0, j)) {
                    getMessage = getMessage.slice(0, -j);
                    break;
                }
            }
        }
    }

    // Regex uses vars, so add before formatting
    getMessage = getRegexedString(getMessage, isImpersonate ? regex_placement.USER_INPUT : regex_placement.AI_OUTPUT);

    if (!displayIncompleteSentences && power_user.trim_sentences) {
        getMessage = trimToEndSentence(getMessage, power_user.include_newline);
    }

    if (power_user.collapse_newlines) {
        getMessage = collapseNewlines(getMessage);
    }

    if (power_user.trim_spaces) {
        getMessage = getMessage.trim();
    }
    // trailing invisible whitespace before every newlines, on a multiline string
    // "trailing whitespace on newlines       \nevery line of the string    \n?sample text" ->
    // "trailing whitespace on newlines\nevery line of the string\nsample text"
    getMessage = getMessage.replace(/[^\S\r\n]+$/gm, '');

    let nameToTrim = isImpersonate ? name2 : name1;

    if (isImpersonate) {
        nameToTrim = power_user.allow_name2_display ? '' : name2;
    }
    else {
        nameToTrim = power_user.allow_name1_display ? '' : name1;
    }

    if (nameToTrim && getMessage.indexOf(`${nameToTrim}:`) == 0) {
        getMessage = getMessage.substring(0, getMessage.indexOf(`${nameToTrim}:`));
    }
    if (nameToTrim && getMessage.indexOf(`\n${nameToTrim}:`) >= 0) {
        getMessage = getMessage.substring(0, getMessage.indexOf(`\n${nameToTrim}:`));
    }
    if (getMessage.indexOf('<|endoftext|>') != -1) {
        getMessage = getMessage.substring(0, getMessage.indexOf('<|endoftext|>'));
    }
    const isInstruct = power_user.instruct.enabled && main_api !== 'openai';
    if (isInstruct && power_user.instruct.stop_sequence) {
        if (getMessage.indexOf(power_user.instruct.stop_sequence) != -1) {
            getMessage = getMessage.substring(0, getMessage.indexOf(power_user.instruct.stop_sequence));
        }
    }
    // Hana: Only use the first sequence (should be <|model|>)
    // of the prompt before <|user|> (as KoboldAI Lite does it).
    if (isInstruct && power_user.instruct.input_sequence) {
        if (getMessage.indexOf(power_user.instruct.input_sequence) != -1) {
            getMessage = getMessage.substring(0, getMessage.indexOf(power_user.instruct.input_sequence));
        }
    }
    if (isInstruct && power_user.instruct.input_sequence && isImpersonate) {
        //getMessage = getMessage.replaceAll(power_user.instruct.input_sequence, '');
        power_user.instruct.input_sequence.split('\n')
            .filter(line => line.trim() !== '')
            .forEach(line => {
                getMessage = getMessage.replaceAll(line, '');
            });
    }
    if (isInstruct && power_user.instruct.output_sequence && !isImpersonate) {
        //getMessage = getMessage.replaceAll(power_user.instruct.output_sequence, '');
        power_user.instruct.output_sequence.split('\n')
            .filter(line => line.trim() !== '')
            .forEach(line => {
                getMessage = getMessage.replaceAll(line, '');
            });
    }
    if (isInstruct && power_user.instruct.last_output_sequence && !isImpersonate) {
        //getMessage = getMessage.replaceAll(power_user.instruct.last_output_sequence, '');
        power_user.instruct.last_output_sequence.split('\n')
            .filter(line => line.trim() !== '')
            .forEach(line => {
                getMessage = getMessage.replaceAll(line, '');
            });
    }
    // clean-up group message from excessive generations
    if (selected_group) {
        getMessage = cleanGroupMessage(getMessage);
    }

    if (!power_user.allow_name2_display) {
        const name2Escaped = escapeRegex(name2);
        getMessage = getMessage.replace(new RegExp(`(^|\n)${name2Escaped}:\\s*`, 'g'), '$1');
    }

    if (isImpersonate) {
        getMessage = getMessage.trim();
    }

    if (power_user.auto_fix_generated_markdown) {
        getMessage = fixMarkdown(getMessage, false);
    }

    const nameToTrim2 = isImpersonate ? name1 : name2;

    if (getMessage.startsWith(nameToTrim2 + ':')) {
        getMessage = getMessage.replace(nameToTrim2 + ':', '');
        getMessage = getMessage.trimStart();
    }

    if (isImpersonate) {
        getMessage = getMessage.trim();
    }

    return getMessage;
}

async function saveReply(type, getMessage, fromStreaming, title, swipes) {
    if (type != 'append' && type != 'continue' && type != 'appendFinal' && chat.length && (chat[chat.length - 1]['swipe_id'] === undefined ||
        chat[chat.length - 1]['is_user'])) {
        type = 'normal';
    }

    if (chat.length && typeof chat[chat.length - 1]['extra'] !== 'object') {
        chat[chat.length - 1]['extra'] = {};
    }

    let oldMessage = '';
    const generationFinished = new Date();
    const img = extractImageFromMessage(getMessage);
    getMessage = img.getMessage;
    if (type === 'swipe') {
        oldMessage = chat[chat.length - 1]['mes'];
        chat[chat.length - 1]['swipes'].length++;
        if (chat[chat.length - 1]['swipe_id'] === chat[chat.length - 1]['swipes'].length - 1) {
            chat[chat.length - 1]['title'] = title;
            chat[chat.length - 1]['mes'] = getMessage;
            chat[chat.length - 1]['gen_started'] = generation_started;
            chat[chat.length - 1]['gen_finished'] = generationFinished;
            chat[chat.length - 1]['send_date'] = getMessageTimeStamp();
            chat[chat.length - 1]['extra']['api'] = getGeneratingApi();
            chat[chat.length - 1]['extra']['model'] = getGeneratingModel();
            if (power_user.message_token_count_enabled) {
                chat[chat.length - 1]['extra']['token_count'] = getTokenCount(chat[chat.length - 1]['mes'], 0);
            }
            const chat_id = (chat.length - 1);
            await eventSource.emit(event_types.MESSAGE_RECEIVED, chat_id);
            addOneMessage(chat[chat_id], { type: 'swipe' });
            await eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, chat_id);
        } else {
            chat[chat.length - 1]['mes'] = getMessage;
        }
    } else if (type === 'append' || type === 'continue') {
        console.debug('Trying to append.');
        oldMessage = chat[chat.length - 1]['mes'];
        chat[chat.length - 1]['title'] = title;
        chat[chat.length - 1]['mes'] += getMessage;
        chat[chat.length - 1]['gen_started'] = generation_started;
        chat[chat.length - 1]['gen_finished'] = generationFinished;
        chat[chat.length - 1]['send_date'] = getMessageTimeStamp();
        chat[chat.length - 1]['extra']['api'] = getGeneratingApi();
        chat[chat.length - 1]['extra']['model'] = getGeneratingModel();
        if (power_user.message_token_count_enabled) {
            chat[chat.length - 1]['extra']['token_count'] = getTokenCount(chat[chat.length - 1]['mes'], 0);
        }
        const chat_id = (chat.length - 1);
        await eventSource.emit(event_types.MESSAGE_RECEIVED, chat_id);
        addOneMessage(chat[chat_id], { type: 'swipe' });
        await eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, chat_id);
    } else if (type === 'appendFinal') {
        oldMessage = chat[chat.length - 1]['mes'];
        console.debug('Trying to appendFinal.');
        chat[chat.length - 1]['title'] = title;
        chat[chat.length - 1]['mes'] = getMessage;
        chat[chat.length - 1]['gen_started'] = generation_started;
        chat[chat.length - 1]['gen_finished'] = generationFinished;
        chat[chat.length - 1]['send_date'] = getMessageTimeStamp();
        chat[chat.length - 1]['extra']['api'] = getGeneratingApi();
        chat[chat.length - 1]['extra']['model'] = getGeneratingModel();
        if (power_user.message_token_count_enabled) {
            chat[chat.length - 1]['extra']['token_count'] = getTokenCount(chat[chat.length - 1]['mes'], 0);
        }
        const chat_id = (chat.length - 1);
        await eventSource.emit(event_types.MESSAGE_RECEIVED, chat_id);
        addOneMessage(chat[chat_id], { type: 'swipe' });
        await eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, chat_id);

    } else {
        console.debug('entering chat update routine for non-swipe post');
        chat[chat.length] = {};
        chat[chat.length - 1]['extra'] = {};
        chat[chat.length - 1]['name'] = name2;
        chat[chat.length - 1]['is_user'] = false;
        chat[chat.length - 1]['send_date'] = getMessageTimeStamp();
        chat[chat.length - 1]['extra']['api'] = getGeneratingApi();
        chat[chat.length - 1]['extra']['model'] = getGeneratingModel();
        if (power_user.trim_spaces) {
            getMessage = getMessage.trim();
        }
        chat[chat.length - 1]['mes'] = getMessage;
        chat[chat.length - 1]['title'] = title;
        chat[chat.length - 1]['gen_started'] = generation_started;
        chat[chat.length - 1]['gen_finished'] = generationFinished;

        if (power_user.message_token_count_enabled) {
            chat[chat.length - 1]['extra']['token_count'] = getTokenCount(chat[chat.length - 1]['mes'], 0);
        }

        if (selected_group) {
            console.debug('entering chat update for groups');
            let avatarImg = 'img/ai4.png';
            if (characters[this_chid].avatar != 'none') {
                avatarImg = getThumbnailUrl('avatar', characters[this_chid].avatar);
            }
            chat[chat.length - 1]['force_avatar'] = avatarImg;
            chat[chat.length - 1]['original_avatar'] = characters[this_chid].avatar;
            chat[chat.length - 1]['extra']['gen_id'] = group_generation_id;
        }

        saveImageToMessage(img, chat[chat.length - 1]);
        const chat_id = (chat.length - 1);

        !fromStreaming && await eventSource.emit(event_types.MESSAGE_RECEIVED, chat_id);
        addOneMessage(chat[chat_id]);
        !fromStreaming && await eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, chat_id);
    }

    const item = chat[chat.length - 1];
    if (item['swipe_info'] === undefined) {
        item['swipe_info'] = [];
    }
    if (item['swipe_id'] !== undefined) {
        const swipeId = item['swipe_id'];
        item['swipes'][swipeId] = item['mes'];
        item['swipe_info'][swipeId] = {
            send_date: item['send_date'],
            gen_started: item['gen_started'],
            gen_finished: item['gen_finished'],
            extra: JSON.parse(JSON.stringify(item['extra'])),
        };
    } else {
        item['swipe_id'] = 0;
        item['swipes'] = [];
        item['swipes'][0] = chat[chat.length - 1]['mes'];
        item['swipe_info'][0] = {
            send_date: chat[chat.length - 1]['send_date'],
            gen_started: chat[chat.length - 1]['gen_started'],
            gen_finished: chat[chat.length - 1]['gen_finished'],
            extra: JSON.parse(JSON.stringify(chat[chat.length - 1]['extra'])),
        };
    }

    if (Array.isArray(swipes) && swipes.length > 0) {
        const swipeInfo = {
            send_date: item.send_date,
            gen_started: item.gen_started,
            gen_finished: item.gen_finished,
            extra: structuredClone(item.extra),
        };
        const swipeInfoArray = [];
        swipeInfoArray.length = swipes.length;
        swipeInfoArray.fill(swipeInfo, 0, swipes.length);
        item.swipes.push(...swipes);
        item.swipe_info.push(...swipeInfoArray);
    }

    statMesProcess(chat[chat.length - 1], type, characters, this_chid, oldMessage);
    return { type, getMessage };
}

function saveImageToMessage(img, mes) {
    if (mes && img.image) {
        if (typeof mes.extra !== 'object') {
            mes.extra = {};
        }
        mes.extra.image = img.image;
        mes.extra.title = img.title;
    }
}

function getGeneratingApi() {
    switch (main_api) {
        case 'openai':
            return oai_settings.chat_completion_source || 'openai';
        case 'textgenerationwebui':
            return textgen_settings.type === textgen_types.OOBA ? 'textgenerationwebui' : textgen_settings.type;
        default:
            return main_api;
    }
}

function getGeneratingModel(mes) {
    let model = '';
    switch (main_api) {
        case 'kobold':
            model = online_status;
            break;
        case 'novel':
            model = nai_settings.model_novel;
            break;
        case 'openai':
            model = getChatCompletionModel();
            break;
        case 'textgenerationwebui':
            model = online_status;
            break;
        case 'koboldhorde':
            model = kobold_horde_model;
            break;
    }
    return model;
}

function extractImageFromMessage(getMessage) {
    const regex = /<img src="(.*?)".*?alt="(.*?)".*?>/g;
    const results = regex.exec(getMessage);
    const image = results ? results[1] : '';
    const title = results ? results[2] : '';
    getMessage = getMessage.replace(regex, '');
    return { getMessage, image, title };
}

export function activateSendButtons() {
    is_send_press = false;
    $('#send_but').removeClass('displayNone');
    $('#mes_continue').removeClass('displayNone');
    $('#send_textarea').attr('disabled', false);
    $('.mes_buttons:last').show();
    hideStopButton();
}

export function deactivateSendButtons() {
    $('#send_but').addClass('displayNone');
    $('#mes_continue').addClass('displayNone');
    showStopButton();
}

function resetChatState() {
    //unsets expected chid before reloading (related to getCharacters/printCharacters from using old arrays)
    this_chid = 'invalid-safety-id';
    // replaces deleted charcter name with system user since it will be displayed next.
    name2 = systemUserName;
    // sets up system user to tell user about having deleted a character
    chat = [...safetychat];
    // resets chat metadata
    chat_metadata = {};
    // resets the characters array, forcing getcharacters to reset
    characters.length = 0;
}

export function setMenuType(value) {
    menu_type = value;
}

export function setExternalAbortController(controller) {
    abortController = controller;
}

function setCharacterId(value) {
    this_chid = value;
}

function setCharacterName(value) {
    name2 = value;
}

function setOnlineStatus(value) {
    online_status = value;
    displayOnlineStatus();
}

function setEditedMessageId(value) {
    this_edit_mes_id = value;
}

function setSendButtonState(value) {
    is_send_press = value;
}

async function renameCharacter() {
    const oldAvatar = characters[this_chid].avatar;
    const newValue = await callPopup('<h3>New name:</h3>', 'input', characters[this_chid].name);

    if (newValue && newValue !== characters[this_chid].name) {
        const body = JSON.stringify({ avatar_url: oldAvatar, new_name: newValue });
        const response = await fetch('/api/characters/rename', {
            method: 'POST',
            headers: getRequestHeaders(),
            body,
        });

        try {
            if (response.ok) {
                const data = await response.json();
                const newAvatar = data.avatar;

                // Replace tags list
                renameTagKey(oldAvatar, newAvatar);

                // Reload characters list
                await getCharacters();

                // Find newly renamed character
                const newChId = characters.findIndex(c => c.avatar == data.avatar);

                if (newChId !== -1) {
                    // Select the character after the renaming
                    this_chid = -1;
                    await selectCharacterById(String(newChId));

                    // Async delay to update UI
                    await delay(1);

                    if (this_chid === -1) {
                        throw new Error('New character not selected');
                    }

                    // Also rename as a group member
                    await renameGroupMember(oldAvatar, newAvatar, newValue);
                    const renamePastChatsConfirm = await callPopup(`<h3>Character renamed!</h3>
                    <p>Past chats will still contain the old character name. Would you like to update the character name in previous chats as well?</p>
                    <i><b>Sprites folder (if any) should be renamed manually.</b></i>`, 'confirm');

                    if (renamePastChatsConfirm) {
                        await renamePastChats(newAvatar, newValue);
                        await reloadCurrentChat();
                        toastr.success('Character renamed and past chats updated!');
                    }
                }
                else {
                    throw new Error('Newly renamed character was lost?');
                }
            }
            else {
                throw new Error('Could not rename the character');
            }
        }
        catch {
            // Reloading to prevent data corruption
            await callPopup('Something went wrong. The page will be reloaded.', 'text');
            location.reload();
        }
    }
}

async function renamePastChats(newAvatar, newValue) {
    const pastChats = await getPastCharacterChats();

    for (const { file_name } of pastChats) {
        try {
            const fileNameWithoutExtension = file_name.replace('.jsonl', '');
            const getChatResponse = await fetch('/api/chats/get', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({
                    ch_name: newValue,
                    file_name: fileNameWithoutExtension,
                    avatar_url: newAvatar,
                }),
                cache: 'no-cache',
            });

            if (getChatResponse.ok) {
                const currentChat = await getChatResponse.json();

                for (const message of currentChat) {
                    if (message.is_user || message.is_system || message.extra?.type == system_message_types.NARRATOR) {
                        continue;
                    }

                    if (message.name !== undefined) {
                        message.name = newValue;
                    }
                }

                const saveChatResponse = await fetch('/api/chats/save', {
                    method: 'POST',
                    headers: getRequestHeaders(),
                    body: JSON.stringify({
                        ch_name: newValue,
                        file_name: fileNameWithoutExtension,
                        chat: currentChat,
                        avatar_url: newAvatar,
                    }),
                    cache: 'no-cache',
                });

                if (!saveChatResponse.ok) {
                    throw new Error('Could not save chat');
                }
            }
        } catch (error) {
            toastr.error(`Past chat could not be updated: ${file_name}`);
            console.error(error);
        }
    }
}

export function saveChatDebounced() {
    const chid = this_chid;
    const selectedGroup = selected_group;

    if (chatSaveTimeout) {
        console.debug('Clearing chat save timeout');
        clearTimeout(chatSaveTimeout);
    }

    chatSaveTimeout = setTimeout(async () => {
        if (selectedGroup !== selected_group) {
            console.warn('Chat save timeout triggered, but group changed. Aborting.');
            return;
        }

        if (chid !== this_chid) {
            console.warn('Chat save timeout triggered, but chid changed. Aborting.');
            return;
        }

        console.debug('Chat save timeout triggered');
        await saveChatConditional();
        console.debug('Chat saved');
    }, 1000);
}

async function saveChat(chat_name, withMetadata, mesId) {
    const metadata = { ...chat_metadata, ...(withMetadata || {}) };
    let file_name = chat_name ?? characters[this_chid]?.chat;

    if (!file_name) {
        console.warn('saveChat called without chat_name and no chat file found');
        return;
    }

    characters[this_chid]['date_last_chat'] = Date.now();
    chat.forEach(function (item, i) {
        if (item['is_group']) {
            toastr.error('Trying to save group chat with regular saveChat function. Aborting to prevent corruption.');
            throw new Error('Group chat saved from saveChat');
        }
        /*
        if (item.is_user) {
            //var str = item.mes.replace(`${name1}:`, `${name1}:`);
            //chat[i].mes = str;
            //chat[i].name = name1;
        } else if (i !== chat.length - 1 && chat[i].swipe_id !== undefined) {
            //  delete chat[i].swipes;
            //  delete chat[i].swipe_id;
        }
        */
    });

    const trimmed_chat = (mesId !== undefined && mesId >= 0 && mesId < chat.length)
        ? chat.slice(0, parseInt(mesId) + 1)
        : chat;

    var save_chat = [
        {
            user_name: name1,
            character_name: name2,
            create_date: chat_create_date,
            chat_metadata: metadata,
        },
        ...trimmed_chat,
    ];
    return jQuery.ajax({
        type: 'POST',
        url: '/api/chats/save',
        data: JSON.stringify({
            ch_name: characters[this_chid].name,
            file_name: file_name,
            chat: save_chat,
            avatar_url: characters[this_chid].avatar,
        }),
        beforeSend: function () {

        },
        cache: false,
        dataType: 'json',
        contentType: 'application/json',
        success: function (data) { },
        error: function (jqXHR, exception) {
            console.log(exception);
            console.log(jqXHR);
        },
    });
}

async function read_avatar_load(input) {
    if (input.files && input.files[0]) {
        if (selected_button == 'create') {
            create_save.avatar = input.files;
        }

        const file = input.files[0];
        const fileData = await getBase64Async(file);

        if (!power_user.never_resize_avatars) {
            $('#dialogue_popup').addClass('large_dialogue_popup wide_dialogue_popup');
            const croppedImage = await callPopup(getCropPopup(fileData), 'avatarToCrop');
            if (!croppedImage) {
                return;
            }

            $('#avatar_load_preview').attr('src', croppedImage);
        } else {
            $('#avatar_load_preview').attr('src', fileData);
        }

        if (menu_type == 'create') {
            return;
        }

        await createOrEditCharacter();
        await delay(durationSaveEdit);

        const formData = new FormData($('#form_create').get(0));
        await fetch(getThumbnailUrl('avatar', formData.get('avatar_url')), {
            method: 'GET',
            cache: 'no-cache',
            headers: {
                'pragma': 'no-cache',
                'cache-control': 'no-cache',
            },
        });

        $('.mes').each(async function () {
            const nameMatch = $(this).attr('ch_name') == formData.get('ch_name');
            if ($(this).attr('is_system') == 'true' && !nameMatch) {
                return;
            }
            if ($(this).attr('is_user') == 'true') {
                return;
            }
            if (nameMatch) {
                const previewSrc = $('#avatar_load_preview').attr('src');
                const avatar = $(this).find('.avatar img');
                avatar.attr('src', default_avatar);
                await delay(1);
                avatar.attr('src', previewSrc);
            }
        });

        console.log('Avatar refreshed');
    }
}

export function getCropPopup(src) {
    return `<h3>Set the crop position of the avatar image and click Accept to confirm.</h3>
            <div id='avatarCropWrap'>
                <img id='avatarToCrop' src='${src}'>
            </div>`;
}

function getThumbnailUrl(type, file) {
    return `/thumbnail?type=${type}&file=${encodeURIComponent(file)}`;
}

async function getChat() {
    //console.log('/api/chats/get -- entered for -- ' + characters[this_chid].name);
    try {
        const response = await $.ajax({
            type: 'POST',
            url: '/api/chats/get',
            data: JSON.stringify({
                ch_name: characters[this_chid].name,
                file_name: characters[this_chid].chat,
                avatar_url: characters[this_chid].avatar,
            }),
            dataType: 'json',
            contentType: 'application/json',
        });
        if (response[0] !== undefined) {
            chat.push(...response);
            chat_create_date = chat[0]['create_date'];
            chat_metadata = chat[0]['chat_metadata'] ?? {};

            chat.shift();
        } else {
            chat_create_date = humanizedDateTime();
        }
        await getChatResult();
        eventSource.emit('chatLoaded', { detail: { id: this_chid, character: characters[this_chid] } });

        setTimeout(function () {
            $('#send_textarea').click();
            $('#send_textarea').focus();
        }, 200);
    } catch (error) {
        await getChatResult();
        console.log(error);
    }
}

async function getChatResult() {
    name2 = characters[this_chid].name;
    if (chat.length === 0) {
        const message = getFirstMessage();
        chat.push(message);
        await saveChatConditional();
    }
    await loadItemizedPrompts(getCurrentChatId());
    await printMessages();
    select_selected_character(this_chid);

    await eventSource.emit(event_types.CHAT_CHANGED, (getCurrentChatId()));

    if (chat.length === 1) {
        const chat_id = (chat.length - 1);
        await eventSource.emit(event_types.MESSAGE_RECEIVED, chat_id);
        await eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, chat_id);
    }
}

function getFirstMessage() {
    const firstMes = characters[this_chid].first_mes || default_ch_mes;
    const alternateGreetings = characters[this_chid]?.data?.alternate_greetings;

    const message = {
        name: name2,
        is_user: false,
        is_system: false,
        send_date: getMessageTimeStamp(),
        mes: substituteParams(getRegexedString(firstMes, regex_placement.AI_OUTPUT)),
        extra: {},
    };

    if (Array.isArray(alternateGreetings) && alternateGreetings.length > 0) {
        const swipes = [message.mes, ...(alternateGreetings.map(greeting => substituteParams(getRegexedString(greeting, regex_placement.AI_OUTPUT))))];
        message['swipe_id'] = 0;
        message['swipes'] = swipes;
        message['swipe_info'] = [];
    }
    return message;
}

async function openCharacterChat(file_name) {
    await clearChat();
    characters[this_chid]['chat'] = file_name;
    chat.length = 0;
    chat_metadata = {};
    await getChat();
    $('#selected_chat_pole').val(file_name);
    await createOrEditCharacter();
}

////////// OPTIMZED MAIN API CHANGE FUNCTION ////////////

function changeMainAPI() {
    const selectedVal = $('#main_api').val();
    //console.log(selectedVal);
    const apiElements = {
        'koboldhorde': {
            apiSettings: $('#kobold_api-settings'),
            apiConnector: $('#kobold_horde'),
            apiPresets: $('#kobold_api-presets'),
            apiRanges: $('#range_block'),
            maxContextElem: $('#max_context_block'),
            amountGenElem: $('#amount_gen_block'),
        },
        'kobold': {
            apiSettings: $('#kobold_api-settings'),
            apiConnector: $('#kobold_api'),
            apiPresets: $('#kobold_api-presets'),
            apiRanges: $('#range_block'),
            maxContextElem: $('#max_context_block'),
            amountGenElem: $('#amount_gen_block'),
        },
        'textgenerationwebui': {
            apiSettings: $('#textgenerationwebui_api-settings'),
            apiConnector: $('#textgenerationwebui_api'),
            apiPresets: $('#textgenerationwebui_api-presets'),
            apiRanges: $('#range_block_textgenerationwebui'),
            maxContextElem: $('#max_context_block'),
            amountGenElem: $('#amount_gen_block'),
        },
        'novel': {
            apiSettings: $('#novel_api-settings'),
            apiConnector: $('#novel_api'),
            apiPresets: $('#novel_api-presets'),
            apiRanges: $('#range_block_novel'),
            maxContextElem: $('#max_context_block'),
            amountGenElem: $('#amount_gen_block'),
        },
        'openai': {
            apiSettings: $('#openai_settings'),
            apiConnector: $('#openai_api'),
            apiPresets: $('#openai_api-presets'),
            apiRanges: $('#range_block_openai'),
            maxContextElem: $('#max_context_block'),
            amountGenElem: $('#amount_gen_block'),
        },
    };
    //console.log('--- apiElements--- ');
    //console.log(apiElements);

    //first, disable everything so the old elements stop showing
    for (const apiName in apiElements) {
        const apiObj = apiElements[apiName];
        //do not hide items to then proceed to immediately show them.
        if (selectedVal === apiName) {
            continue;
        }
        apiObj.apiSettings.css('display', 'none');
        apiObj.apiConnector.css('display', 'none');
        apiObj.apiRanges.css('display', 'none');
        apiObj.apiPresets.css('display', 'none');
    }

    //then, find and enable the active item.
    //This is split out of the loop so that different apis can share settings divs
    let activeItem = apiElements[selectedVal];

    activeItem.apiSettings.css('display', 'block');
    activeItem.apiConnector.css('display', 'block');
    activeItem.apiRanges.css('display', 'block');
    activeItem.apiPresets.css('display', 'block');

    if (selectedVal === 'openai') {
        activeItem.apiPresets.css('display', 'flex');
    }

    if (selectedVal === 'textgenerationwebui' || selectedVal === 'novel') {
        console.log('enabling amount_gen for ooba/novel');
        activeItem.amountGenElem.find('input').prop('disabled', false);
        activeItem.amountGenElem.css('opacity', 1.0);
    }

    //custom because streaming has been moved up under response tokens, which exists inside common settings block
    if (selectedVal === 'textgenerationwebui') {
        $('#streaming_textgenerationwebui_block').css('display', 'block');
    } else {
        $('#streaming_textgenerationwebui_block').css('display', 'none');
    }
    if (selectedVal === 'kobold') {
        $('#streaming_kobold_block').css('display', 'block');
    } else {
        $('#streaming_kobold_block').css('display', 'none');
    }

    if (selectedVal === 'novel') {
        $('#ai_module_block_novel').css('display', 'block');
    } else {
        $('#ai_module_block_novel').css('display', 'none');
    }

    // Hide common settings for OpenAI
    console.debug('value?', selectedVal);
    if (selectedVal == 'openai') {
        console.debug('hiding settings?');
        $('#common-gen-settings-block').css('display', 'none');
    } else {
        $('#common-gen-settings-block').css('display', 'block');
    }

    main_api = selectedVal;
    online_status = 'no_connection';

    if (main_api == 'openai' && oai_settings.chat_completion_source == chat_completion_sources.WINDOWAI) {
        $('#api_button_openai').trigger('click');
    }

    if (main_api == 'koboldhorde') {
        getStatusHorde();
        getHordeModels();
    }

    switch (oai_settings.chat_completion_source) {
        case chat_completion_sources.SCALE:
        case chat_completion_sources.OPENROUTER:
        case chat_completion_sources.WINDOWAI:
        case chat_completion_sources.CLAUDE:
        case chat_completion_sources.OPENAI:
        case chat_completion_sources.AI21:
        case chat_completion_sources.MAKERSUITE:
        case chat_completion_sources.MISTRALAI:
        case chat_completion_sources.CUSTOM:
        default:
            setupChatCompletionPromptManager(oai_settings);
            break;
    }
}

////////////////////////////////////////////////////

export async function getUserAvatars() {
    const response = await fetch('/getuseravatars', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            '': '',
        }),
    });
    if (response.ok === true) {
        const getData = await response.json();
        $('#user_avatar_block').html(''); //RossAscends: necessary to avoid doubling avatars each refresh.
        $('#user_avatar_block').append('<div class="avatar_upload">+</div>');

        for (var i = 0; i < getData.length; i++) {
            appendUserAvatar(getData[i]);
        }

        return getData;
    }
}

function highlightSelectedAvatar() {
    $('#user_avatar_block').find('.avatar').removeClass('selected');
    $('#user_avatar_block')
        .find(`.avatar[imgfile='${user_avatar}']`)
        .addClass('selected');
}

function appendUserAvatar(name) {
    const template = $('#user_avatar_template .avatar-container').clone();
    const personaName = power_user.personas[name];
    if (personaName) {
        template.attr('title', personaName);
    } else {
        template.attr('title', '[Unnamed Persona]');
    }
    template.find('.avatar').attr('imgfile', name);
    template.toggleClass('default_persona', name === power_user.default_persona);
    template.find('img').attr('src', getUserAvatar(name));
    $('#user_avatar_block').append(template);
    highlightSelectedAvatar();
}

function reloadUserAvatar(force = false) {
    $('.mes').each(function () {
        const avatarImg = $(this).find('.avatar img');
        if (force) {
            avatarImg.attr('src', avatarImg.attr('src'));
        }

        if ($(this).attr('is_user') == 'true' && $(this).attr('force_avatar') == 'false') {
            avatarImg.attr('src', getUserAvatar(user_avatar));
        }
    });
}

export function setUserName(value) {
    name1 = value;
    if (name1 === undefined || name1 == '')
        name1 = default_user_name;
    console.log(`User name changed to ${name1}`);
    $('#your_name').val(name1);
    if (power_user.persona_show_notifications) {
        toastr.success(`Your messages will now be sent as ${name1}`, 'Current persona updated');
    }
    saveSettingsDebounced();
}

function setUserAvatar() {
    user_avatar = $(this).attr('imgfile');
    reloadUserAvatar();
    highlightSelectedAvatar();
    selectCurrentPersona();
    saveSettingsDebounced();
    $('.zoomed_avatar[forchar]').remove();
}

async function uploadUserAvatar(e) {
    const file = e.target.files[0];

    if (!file) {
        $('#form_upload_avatar').trigger('reset');
        return;
    }

    const formData = new FormData($('#form_upload_avatar').get(0));
    const dataUrl = await getBase64Async(file);
    let url = '/uploaduseravatar';

    if (!power_user.never_resize_avatars) {
        $('#dialogue_popup').addClass('large_dialogue_popup wide_dialogue_popup');
        const confirmation = await callPopup(getCropPopup(dataUrl), 'avatarToCrop');
        if (!confirmation) {
            return;
        }

        if (crop_data !== undefined) {
            url += `?crop=${encodeURIComponent(JSON.stringify(crop_data))}`;
        }
    }

    jQuery.ajax({
        type: 'POST',
        url: url,
        data: formData,
        beforeSend: () => { },
        cache: false,
        contentType: false,
        processData: false,
        success: async function (data) {
            // If the user uploaded a new avatar, we want to make sure it's not cached
            const name = formData.get('overwrite_name');
            if (name) {
                await fetch(getUserAvatar(name), { cache: 'no-cache' });
                reloadUserAvatar(true);
            }

            if (!name && data.path) {
                await getUserAvatars();
                await delay(500);
                await createPersona(data.path);
            }

            crop_data = undefined;
            await getUserAvatars();
        },
        error: (jqXHR, exception) => { },
    });

    // Will allow to select the same file twice in a row
    $('#form_upload_avatar').trigger('reset');
}

async function doOnboarding(avatarId) {
    let simpleUiMode = false;
    const template = $('#onboarding_template .onboarding');
    template.find('input[name="enable_simple_mode"]').on('input', function () {
        simpleUiMode = $(this).is(':checked');
    });
    var userName = await callPopup(template, 'input', name1);

    if (userName) {
        userName = userName.replace('\n', ' ');
        setUserName(userName);
        console.log(`Binding persona ${avatarId} to name ${userName}`);
        power_user.personas[avatarId] = userName;
        power_user.persona_descriptions[avatarId] = {
            description: '',
            position: persona_description_positions.IN_PROMPT,
        };
    }

    if (simpleUiMode) {
        power_user.ui_mode = ui_mode.SIMPLE;
        $('#ui_mode_select').val(power_user.ui_mode);
        switchSimpleMode();
    }
}

//***************SETTINGS****************//
///////////////////////////////////////////
async function getSettings() {
    const response = await fetch('/api/settings/get', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({}),
        cache: 'no-cache',
    });

    if (!response.ok) {
        toastr.error('Settings could not be loaded. Try reloading the page.');
        throw new Error('Error getting settings');
    }

    const data = await response.json();
    if (data.result != 'file not find' && data.settings) {
        settings = JSON.parse(data.settings);
        if (settings.username !== undefined && settings.username !== '') {
            name1 = settings.username;
            $('#your_name').val(name1);
        }

        // Allow subscribers to mutate settings
        eventSource.emit(event_types.SETTINGS_LOADED_BEFORE, settings);

        //Load KoboldAI settings
        koboldai_setting_names = data.koboldai_setting_names;
        koboldai_settings = data.koboldai_settings;
        koboldai_settings.forEach(function (item, i, arr) {
            koboldai_settings[i] = JSON.parse(item);
        });

        let arr_holder = {};

        $('#settings_preset').empty();
        $('#settings_preset').append(
            '<option value="gui">GUI KoboldAI Settings</option>',
        ); //adding in the GUI settings, since it is not loaded dynamically

        koboldai_setting_names.forEach(function (item, i, arr) {
            arr_holder[item] = i;
            $('#settings_preset').append(`<option value=${i}>${item}</option>`);
            //console.log('loading preset #'+i+' -- '+item);
        });
        koboldai_setting_names = {};
        koboldai_setting_names = arr_holder;
        preset_settings = settings.preset_settings;

        if (preset_settings == 'gui') {
            selectKoboldGuiPreset();
        } else {
            if (typeof koboldai_setting_names[preset_settings] !== 'undefined') {
                $(`#settings_preset option[value=${koboldai_setting_names[preset_settings]}]`)
                    .attr('selected', 'true');
            } else {
                preset_settings = 'gui';
                selectKoboldGuiPreset();
            }
        }

        novelai_setting_names = data.novelai_setting_names;
        novelai_settings = data.novelai_settings;
        novelai_settings.forEach(function (item, i, arr) {
            novelai_settings[i] = JSON.parse(item);
        });
        arr_holder = {};

        $('#settings_preset_novel').empty();

        novelai_setting_names.forEach(function (item, i, arr) {
            arr_holder[item] = i;
            $('#settings_preset_novel').append(`<option value=${i}>${item}</option>`);
        });
        novelai_setting_names = {};
        novelai_setting_names = arr_holder;

        //Load AI model config settings

        amount_gen = settings.amount_gen;
        if (settings.max_context !== undefined)
            max_context = parseInt(settings.max_context);

        swipes = settings.swipes !== undefined ? !!settings.swipes : true;  // enable swipes by default
        $('#swipes-checkbox').prop('checked', swipes); /// swipecode
        hideSwipeButtons();
        showSwipeButtons();

        // Kobold
        loadKoboldSettings(settings.kai_settings ?? settings);

        // Novel
        loadNovelSettings(settings.nai_settings ?? settings);
        $(`#settings_preset_novel option[value=${novelai_setting_names[nai_settings.preset_settings_novel]}]`).attr('selected', 'true');

        // TextGen
        loadTextGenSettings(data, settings);

        // OpenAI
        loadOpenAISettings(data, settings.oai_settings ?? settings);

        // Horde
        loadHordeSettings(settings);

        // Load power user settings
        loadPowerUserSettings(settings, data);

        // Load character tags
        loadTagsSettings(settings);

        // Load background
        loadBackgroundSettings(settings);

        // Allow subscribers to mutate settings
        eventSource.emit(event_types.SETTINGS_LOADED_AFTER, settings);

        // Set context size after loading power user (may override the max value)
        $('#max_context').val(max_context);
        $('#max_context_counter').val(max_context);

        $('#amount_gen').val(amount_gen);
        $('#amount_gen_counter').val(amount_gen);

        //Load which API we are using
        if (settings.main_api == undefined) {
            settings.main_api = 'kobold';
        }

        if (settings.main_api == 'poe') {
            settings.main_api = 'openai';
        }

        main_api = settings.main_api;
        $('#main_api').val(main_api);
        $('#main_api option[value=' + main_api + ']').attr(
            'selected',
            'true',
        );
        changeMainAPI();

        //Load User's Name and Avatar

        user_avatar = settings.user_avatar;
        firstRun = !!settings.firstRun;

        if (firstRun) {
            hideLoader();
            await doOnboarding(user_avatar);
            firstRun = false;
        }

        reloadUserAvatar();
        highlightSelectedAvatar();
        setPersonaDescription();

        //Load the active character and group
        active_character = settings.active_character;
        active_group = settings.active_group;

        //Load the API server URL from settings
        api_server = settings.api_server;
        $('#api_url_text').val(api_server);

        setWorldInfoSettings(settings.world_info_settings ?? settings, data);

        selected_button = settings.selected_button;

        if (data.enable_extensions) {
            const isVersionChanged = settings.currentVersion !== currentVersion;
            await loadExtensionSettings(settings, isVersionChanged);
            eventSource.emit(event_types.EXTENSION_SETTINGS_LOADED);
        }
    }

    settingsReady = true;
    eventSource.emit(event_types.SETTINGS_LOADED);
}

function selectKoboldGuiPreset() {
    $('#settings_preset option[value=gui]')
        .attr('selected', 'true')
        .trigger('change');
}

async function saveSettings(type) {
    if (!settingsReady) {
        console.warn('Settings not ready, aborting save');
        return;
    }

    console.log(background_settings);

    //console.log('Entering settings with name1 = '+name1);

    return jQuery.ajax({
        type: 'POST',
        url: '/api/settings/save',
        data: JSON.stringify({
            firstRun: firstRun,
            currentVersion: currentVersion,
            username: name1,
            active_character: active_character,
            active_group: active_group,
            api_server: api_server,
            preset_settings: preset_settings,
            user_avatar: user_avatar,
            amount_gen: amount_gen,
            max_context: max_context,
            main_api: main_api,
            world_info_settings: getWorldInfoSettings(),
            textgenerationwebui_settings: textgen_settings,
            swipes: swipes,
            horde_settings: horde_settings,
            power_user: power_user,
            extension_settings: extension_settings,
            tags: tags,
            tag_map: tag_map,
            nai_settings: nai_settings,
            kai_settings: kai_settings,
            oai_settings: oai_settings,
            background: background_settings,
        }, null, 4),
        beforeSend: function () { },
        cache: false,
        dataType: 'json',
        contentType: 'application/json',
        //processData: false,
        success: async function (data) {
            eventSource.emit(event_types.SETTINGS_UPDATED);
        },
        error: function (jqXHR, exception) {
            toastr.error('Check the server connection and reload the page to prevent data loss.', 'Settings could not be saved');
            console.log(exception);
            console.log(jqXHR);
        },
    });
}

export function setGenerationParamsFromPreset(preset) {
    const needsUnlock = preset.max_length > MAX_CONTEXT_DEFAULT || preset.genamt > MAX_RESPONSE_DEFAULT;
    $('#max_context_unlocked').prop('checked', needsUnlock).trigger('change');

    if (preset.genamt !== undefined) {
        amount_gen = preset.genamt;
        $('#amount_gen').val(amount_gen);
        $('#amount_gen_counter').val(amount_gen);
    }

    if (preset.max_length !== undefined) {
        max_context = preset.max_length;
        $('#max_context').val(max_context);
        $('#max_context_counter').val(max_context);
    }
}

// Common code for message editor done and auto-save
function updateMessage(div) {
    const mesBlock = div.closest('.mes_block');
    let text = mesBlock.find('.edit_textarea').val();
    const mes = chat[this_edit_mes_id];

    let regexPlacement;
    if (mes.is_user) {
        regexPlacement = regex_placement.USER_INPUT;
    } else if (mes.name === name2) {
        regexPlacement = regex_placement.AI_OUTPUT;
    } else if (mes.name !== name2 || mes.extra?.type === 'narrator') {
        regexPlacement = regex_placement.SLASH_COMMAND;
    }

    // Ignore character override if sent as system
    text = getRegexedString(
        text,
        regexPlacement,
        { characterOverride: mes.extra?.type === 'narrator' ? undefined : mes.name },
    );


    if (power_user.trim_spaces) {
        text = text.trim();
    }

    const bias = extractMessageBias(text);
    mes['mes'] = text;
    if (mes['swipe_id'] !== undefined) {
        mes['swipes'][mes['swipe_id']] = text;
    }

    // editing old messages
    if (!mes.extra) {
        mes.extra = {};
    }

    if (mes.is_system || mes.is_user || mes.extra.type === system_message_types.NARRATOR) {
        mes.extra.bias = bias ?? null;
    } else {
        mes.extra.bias = null;
    }

    return { mesBlock, text, mes, bias };
}

function openMessageDelete(fromSlashCommand) {
    closeMessageEditor();
    hideSwipeButtons();
    if (fromSlashCommand || (this_chid != undefined && !is_send_press) || (selected_group && !is_group_generating)) {
        $('#dialogue_del_mes').css('display', 'block');
        $('#send_form').css('display', 'none');
        $('.del_checkbox').each(function () {
            $(this).css('display', 'grid');
            $(this).parent().children('.for_checkbox').css('display', 'none');
        });
    } else {
        console.debug(`
            ERR -- could not enter del mode
            this_chid: ${this_chid}
            is_send_press: ${is_send_press}
            selected_group: ${selected_group}
            is_group_generating: ${is_group_generating}`);
    }
    this_del_mes = -1;
    is_delete_mode = true;
}

function messageEditAuto(div) {
    const { mesBlock, text, mes } = updateMessage(div);

    mesBlock.find('.mes_text').val('');
    mesBlock.find('.mes_text').val(messageFormatting(
        text,
        this_edit_mes_chname,
        mes.is_system,
        mes.is_user,
    ));
    saveChatDebounced();
}

async function messageEditDone(div) {
    let { mesBlock, text, mes, bias } = updateMessage(div);
    if (this_edit_mes_id == 0) {
        text = substituteParams(text);
    }

    mesBlock.find('.mes_text').empty();
    mesBlock.find('.mes_edit_buttons').css('display', 'none');
    mesBlock.find('.mes_buttons').css('display', '');
    mesBlock.find('.mes_text').append(
        messageFormatting(
            text,
            this_edit_mes_chname,
            mes.is_system,
            mes.is_user,
        ),
    );
    mesBlock.find('.mes_bias').empty();
    mesBlock.find('.mes_bias').append(messageFormatting(bias));
    appendMediaToMessage(mes, div.closest('.mes'));
    addCopyToCodeBlocks(div.closest('.mes'));
    await eventSource.emit(event_types.MESSAGE_EDITED, this_edit_mes_id);

    this_edit_mes_id = undefined;
    await saveChatConditional();
}

/**
 * Fetches the chat content for each chat file from the server and compiles them into a dictionary.
 * The function iterates over a provided list of chat metadata and requests the actual chat content
 * for each chat, either as an individual chat or a group chat based on the context.
 *
 * @param {Array} data - An array containing metadata about each chat such as file_name.
 * @param {boolean} isGroupChat - A flag indicating if the chat is a group chat.
 * @returns {Promise<Object>} chat_dict - A dictionary where each key is a file_name and the value is the
 * corresponding chat content fetched from the server.
 */
export async function getChatsFromFiles(data, isGroupChat) {
    const context = getContext();
    let chat_dict = {};
    let chat_list = Object.values(data).sort((a, b) => a['file_name'].localeCompare(b['file_name'])).reverse();

    let chat_promise = chat_list.map(({ file_name }) => {
        return new Promise(async (res, rej) => {
            try {
                const endpoint = isGroupChat ? '/api/chats/group/get' : '/api/chats/get';
                const requestBody = isGroupChat
                    ? JSON.stringify({ id: file_name })
                    : JSON.stringify({
                        ch_name: characters[context.characterId].name,
                        file_name: file_name.replace('.jsonl', ''),
                        avatar_url: characters[context.characterId].avatar,
                    });

                const chatResponse = await fetch(endpoint, {
                    method: 'POST',
                    headers: getRequestHeaders(),
                    body: requestBody,
                    cache: 'no-cache',
                });

                if (!chatResponse.ok) {
                    return res();
                    // continue;
                }

                const currentChat = await chatResponse.json();
                if (!isGroupChat) {
                    // remove the first message, which is metadata, only for individual chats
                    currentChat.shift();
                }
                chat_dict[file_name] = currentChat;

            } catch (error) {
                console.error(error);
            }

            return res();
        });
    });

    await Promise.all(chat_promise);

    return chat_dict;
}

/**
 * Fetches the metadata of all past chats related to a specific character based on its avatar URL.
 * The function sends a POST request to the server to retrieve all chats for the character. It then
 * processes the received data, sorts it by the file name, and returns the sorted data.
 *
 * @param {null|number} [characterId=null] - When set, the function will use this character id instead of this_chid.
 *
 * @returns {Promise<Array>} - An array containing metadata of all past chats of the character, sorted
 * in descending order by file name. Returns `undefined` if the fetch request is unsuccessful.
 */
export async function getPastCharacterChats(characterId = null) {
    characterId = characterId ?? this_chid;
    if (!characters[characterId]) return [];

    const response = await fetch('/api/characters/chats', {
        method: 'POST',
        body: JSON.stringify({ avatar_url: characters[characterId].avatar }),
        headers: getRequestHeaders(),
    });

    if (!response.ok) {
        return [];
    }

    let data = await response.json();
    data = Object.values(data);
    data = data.sort((a, b) => a['file_name'].localeCompare(b['file_name'])).reverse();
    return data;
}

/**
 * Displays the past chats for a character or a group based on the selected context.
 * The function first fetches the chats, processes them, and then displays them in
 * the HTML. It also has a built-in search functionality that allows filtering the
 * displayed chats based on a search query.
 */
export async function displayPastChats() {
    $('#select_chat_div').empty();

    const group = selected_group ? groups.find(x => x.id === selected_group) : null;
    const data = await (selected_group ? getGroupPastChats(selected_group) : getPastCharacterChats());

    if (!data) {
        toastr.error('Could not load chat data. Try reloading the page.');
        return;
    }

    const currentChat = selected_group ? group?.chat_id : characters[this_chid]['chat'];
    const displayName = selected_group ? group?.name : characters[this_chid].name;
    const avatarImg = selected_group ? group?.avatar_url : getThumbnailUrl('avatar', characters[this_chid]['avatar']);
    const rawChats = await getChatsFromFiles(data, selected_group);
    // Sort by last message date descending
    data.sort((a, b) => sortMoments(timestampToMoment(a.last_mes), timestampToMoment(b.last_mes)));
    console.log(data);
    $('#load_select_chat_div').css('display', 'none');
    $('#ChatHistoryCharName').text(`${displayName}'s `);

    const displayChats = (searchQuery) => {
        $('#select_chat_div').empty();  // Clear the current chats before appending filtered chats

        const filteredData = data.filter(chat => {
            const fileName = chat['file_name'];
            const chatContent = rawChats[fileName];

            return chatContent && Object.values(chatContent).some(message => message?.mes?.toLowerCase()?.includes(searchQuery.toLowerCase()));
        });

        console.log(filteredData);
        for (const key in filteredData) {
            let strlen = 300;
            let mes = filteredData[key]['mes'];

            if (mes !== undefined) {
                if (mes.length > strlen) {
                    mes = '...' + mes.substring(mes.length - strlen);
                }
                const chat_items = data[key]['chat_items'];
                const file_size = data[key]['file_size'];
                const fileName = data[key]['file_name'];
                const timestamp = timestampToMoment(data[key]['last_mes']).format('lll');
                const template = $('#past_chat_template .select_chat_block_wrapper').clone();
                template.find('.select_chat_block').attr('file_name', fileName);
                template.find('.avatar img').attr('src', avatarImg);
                template.find('.select_chat_block_filename').text(fileName);
                template.find('.chat_file_size').text(`(${file_size},`);
                template.find('.chat_messages_num').text(`${chat_items}💬)`);
                template.find('.select_chat_block_mes').text(mes);
                template.find('.PastChat_cross').attr('file_name', fileName);
                template.find('.chat_messages_date').text(timestamp);

                if (selected_group) {
                    template.find('.avatar img').replaceWith(getGroupAvatar(group));
                }

                $('#select_chat_div').append(template);

                if (currentChat === fileName.toString().replace('.jsonl', '')) {
                    $('#select_chat_div').find('.select_chat_block:last').attr('highlight', true);
                }
            }
        }
    };
    displayChats('');  // Display all by default

    const debouncedDisplay = debounce((searchQuery) => {
        displayChats(searchQuery);
    }, 300);

    // Define the search input listener
    $('#select_chat_search').on('input', function () {
        const searchQuery = $(this).val();
        debouncedDisplay(searchQuery);
    });
}

function selectRightMenuWithAnimation(selectedMenuId) {
    const displayModes = {
        'rm_group_chats_block': 'flex',
        'rm_api_block': 'grid',
        'rm_characters_block': 'flex',
    };
    $('#result_info').toggle(selectedMenuId === 'rm_ch_create_block');
    document.querySelectorAll('#right-nav-panel .right_menu').forEach((menu) => {
        $(menu).css('display', 'none');

        if (selectedMenuId && selectedMenuId.replace('#', '') === menu.id) {
            const mode = displayModes[menu.id] ?? 'block';
            $(menu).css('display', mode);
            $(menu).css('opacity', 0.0);
            $(menu).transition({
                opacity: 1.0,
                duration: animation_duration,
                easing: animation_easing,
                complete: function () { },
            });
        }
    });
}

function select_rm_info(type, charId, previousCharId = null) {
    if (!type) {
        toastr.error('Invalid process (no \'type\')');
        return;
    }
    if (type !== 'group_create') {
        var displayName = String(charId).replace('.png', '');
    }

    if (type === 'char_delete') {
        toastr.warning(`Character Deleted: ${displayName}`);
    }
    if (type === 'char_create') {
        toastr.success(`Character Created: ${displayName}`);
    }
    if (type === 'group_create') {
        toastr.success('Group Created');
    }
    if (type === 'group_delete') {
        toastr.warning('Group Deleted');
    }

    if (type === 'char_import') {
        toastr.success(`Character Imported: ${displayName}`);
    }

    selectRightMenuWithAnimation('rm_characters_block');

    // Set a timeout so multiple flashes don't overlap
    clearTimeout(importFlashTimeout);
    importFlashTimeout = setTimeout(function () {
        if (type === 'char_import' || type === 'char_create') {
            // Find the page at which the character is located
            const charData = getEntitiesList({ doFilter: true });
            const charIndex = charData.findIndex((x) => x?.item?.avatar?.startsWith(charId));

            if (charIndex === -1) {
                console.log(`Could not find character ${charId} in the list`);
                return;
            }

            try {
                const perPage = Number(localStorage.getItem('Characters_PerPage')) || per_page_default;
                const page = Math.floor(charIndex / perPage) + 1;
                const selector = `#rm_print_characters_block [title^="${charId}"]`;
                $('#rm_print_characters_pagination').pagination('go', page);

                waitUntilCondition(() => document.querySelector(selector) !== null).then(() => {
                    const element = $(selector).parent();

                    if (element.length === 0) {
                        console.log(`Could not find element for character ${charId}`);
                        return;
                    }

                    const scrollOffset = element.offset().top - element.parent().offset().top;
                    element.parent().scrollTop(scrollOffset);
                    element.addClass('flash animated');
                    setTimeout(function () {
                        element.removeClass('flash animated');
                    }, 5000);
                });
            } catch (e) {
                console.error(e);
            }
        }

        if (type === 'group_create') {
            // Find the page at which the character is located
            const charData = getEntitiesList({ doFilter: true });
            const charIndex = charData.findIndex((x) => String(x?.item?.id) === String(charId));

            if (charIndex === -1) {
                console.log(`Could not find group ${charId} in the list`);
                return;
            }

            const perPage = Number(localStorage.getItem('Characters_PerPage')) || per_page_default;
            const page = Math.floor(charIndex / perPage) + 1;
            $('#rm_print_characters_pagination').pagination('go', page);
            const selector = `#rm_print_characters_block [grid="${charId}"]`;
            try {
                waitUntilCondition(() => document.querySelector(selector) !== null).then(() => {
                    const element = $(selector);
                    const scrollOffset = element.offset().top - element.parent().offset().top;
                    element.parent().scrollTop(scrollOffset);
                    $(element).addClass('flash animated');
                    setTimeout(function () {
                        $(element).removeClass('flash animated');
                    }, 5000);
                });
            } catch (e) {
                console.error(e);
            }
        }
    }, 250);

    if (previousCharId) {
        const newId = characters.findIndex((x) => x.avatar == previousCharId);
        if (newId >= 0) {
            this_chid = newId;
        }
    }
}

export function select_selected_character(chid) {
    //character select
    //console.log('select_selected_character() -- starting with input of -- ' + chid + ' (name:' + characters[chid].name + ')');
    select_rm_create();
    menu_type = 'character_edit';
    $('#delete_button').css('display', 'flex');
    $('#export_button').css('display', 'flex');
    var display_name = characters[chid].name;

    //create text poles
    $('#rm_button_back').css('display', 'none');
    //$("#character_import_button").css("display", "none");
    $('#create_button').attr('value', 'Save');              // what is the use case for this?
    $('#dupe_button').show();
    $('#create_button_label').css('display', 'none');

    // Hide the chat scenario button if we're peeking the group member defs
    $('#set_chat_scenario').toggle(!selected_group);

    // Don't update the navbar name if we're peeking the group member defs
    if (!selected_group) {
        $('#rm_button_selected_ch').children('h2').text(display_name);
    }

    $('#add_avatar_button').val('');

    $('#character_popup_text_h3').text(characters[chid].name);
    $('#character_name_pole').val(characters[chid].name);
    $('#description_textarea').val(characters[chid].description);
    $('#character_world').val(characters[chid].data?.extensions?.world || '');
    $('#creator_notes_textarea').val(characters[chid].data?.creator_notes || characters[chid].creatorcomment);
    $('#creator_notes_spoiler').text(characters[chid].data?.creator_notes || characters[chid].creatorcomment);
    $('#character_version_textarea').val(characters[chid].data?.character_version || '');
    $('#system_prompt_textarea').val(characters[chid].data?.system_prompt || '');
    $('#post_history_instructions_textarea').val(characters[chid].data?.post_history_instructions || '');
    $('#tags_textarea').val(Array.isArray(characters[chid].data?.tags) ? characters[chid].data.tags.join(', ') : '');
    $('#creator_textarea').val(characters[chid].data?.creator);
    $('#character_version_textarea').val(characters[chid].data?.character_version || '');
    $('#personality_textarea').val(characters[chid].personality);
    $('#firstmessage_textarea').val(characters[chid].first_mes);
    $('#scenario_pole').val(characters[chid].scenario);
    $('#depth_prompt_prompt').val(characters[chid].data?.extensions?.depth_prompt?.prompt ?? '');
    $('#depth_prompt_depth').val(characters[chid].data?.extensions?.depth_prompt?.depth ?? depth_prompt_depth_default);
    $('#talkativeness_slider').val(characters[chid].talkativeness || talkativeness_default);
    $('#mes_example_textarea').val(characters[chid].mes_example);
    $('#selected_chat_pole').val(characters[chid].chat);
    $('#create_date_pole').val(characters[chid].create_date);
    $('#avatar_url_pole').val(characters[chid].avatar);
    $('#chat_import_avatar_url').val(characters[chid].avatar);
    $('#chat_import_character_name').val(characters[chid].name);
    $('#character_json_data').val(characters[chid].json_data);
    let this_avatar = default_avatar;
    if (characters[chid].avatar != 'none') {
        this_avatar = getThumbnailUrl('avatar', characters[chid].avatar);
    }

    updateFavButtonState(characters[chid].fav || characters[chid].fav == 'true');

    $('#avatar_load_preview').attr('src', this_avatar);
    $('#name_div').removeClass('displayBlock');
    $('#name_div').addClass('displayNone');
    $('#renameCharButton').css('display', '');
    $('.open_alternate_greetings').data('chid', chid);
    $('#set_character_world').data('chid', chid);
    setWorldInfoButtonClass(chid);
    checkEmbeddedWorld(chid);

    $('#form_create').attr('actiontype', 'editcharacter');
    $('.form_create_bottom_buttons_block .chat_lorebook_button').show();
    saveSettingsDebounced();
}

function select_rm_create() {
    menu_type = 'create';

    //console.log('select_rm_Create() -- selected button: '+selected_button);
    if (selected_button == 'create') {
        if (create_save.avatar != '') {
            $('#add_avatar_button').get(0).files = create_save.avatar;
            read_avatar_load($('#add_avatar_button').get(0));
        }
    }

    selectRightMenuWithAnimation('rm_ch_create_block');

    $('#set_chat_scenario').hide();
    $('#delete_button_div').css('display', 'none');
    $('#delete_button').css('display', 'none');
    $('#export_button').css('display', 'none');
    $('#create_button_label').css('display', '');
    $('#create_button').attr('value', 'Create');
    $('#dupe_button').hide();

    //create text poles
    $('#rm_button_back').css('display', '');
    $('#character_import_button').css('display', '');
    $('#character_popup_text_h3').text('Create character');
    $('#character_name_pole').val(create_save.name);
    $('#description_textarea').val(create_save.description);
    $('#character_world').val(create_save.world);
    $('#creator_notes_textarea').val(create_save.creator_notes);
    $('#creator_notes_spoiler').text(create_save.creator_notes);
    $('#post_history_instructions_textarea').val(create_save.post_history_instructions);
    $('#system_prompt_textarea').val(create_save.system_prompt);
    $('#tags_textarea').val(create_save.tags);
    $('#creator_textarea').val(create_save.creator);
    $('#character_version_textarea').val(create_save.character_version);
    $('#personality_textarea').val(create_save.personality);
    $('#firstmessage_textarea').val(create_save.first_message);
    $('#talkativeness_slider').val(create_save.talkativeness);
    $('#scenario_pole').val(create_save.scenario);
    $('#depth_prompt_prompt').val(create_save.depth_prompt_prompt);
    $('#depth_prompt_depth').val(create_save.depth_prompt_depth);
    $('#mes_example_textarea').val(create_save.mes_example);
    $('#character_json_data').val('');
    $('#avatar_div').css('display', 'flex');
    $('#avatar_load_preview').attr('src', default_avatar);
    $('#renameCharButton').css('display', 'none');
    $('#name_div').removeClass('displayNone');
    $('#name_div').addClass('displayBlock');
    $('.open_alternate_greetings').data('chid', undefined);
    $('#set_character_world').data('chid', undefined);
    setWorldInfoButtonClass(undefined, !!create_save.world);
    updateFavButtonState(false);
    checkEmbeddedWorld();

    $('#form_create').attr('actiontype', 'createcharacter');
    $('.form_create_bottom_buttons_block .chat_lorebook_button').hide();
}

function select_rm_characters() {
    const doFullRefresh = menu_type === 'characters';
    menu_type = 'characters';
    selectRightMenuWithAnimation('rm_characters_block');
    printCharacters(doFullRefresh);
}

/**
 * Sets a prompt injection to insert custom text into any outgoing prompt. For use in UI extensions.
 * @param {string} key Prompt injection id.
 * @param {string} value Prompt injection value.
 * @param {number} position Insertion position. 0 is after story string, 1 is in-chat with custom depth.
 * @param {number} depth Insertion depth. 0 represets the last message in context. Expected values up to MAX_INJECTION_DEPTH.
 * @param {boolean} scan Should the prompt be included in the world info scan.
 */
export function setExtensionPrompt(key, value, position, depth, scan = false) {
    extension_prompts[key] = { value: String(value), position: Number(position), depth: Number(depth), scan: !!scan };
}

/**
 * Removes all char A/N prompt injections from the chat.
 * To clean up when switching from groups to solo and vice versa.
 */
export function removeDepthPrompts() {
    for (const key of Object.keys(extension_prompts)) {
        if (key.startsWith('DEPTH_PROMPT')) {
            delete extension_prompts[key];
        }
    }
}

/**
 * Adds or updates the metadata for the currently active chat.
 * @param {Object} newValues An object with collection of new values to be added into the metadata.
 * @param {boolean} reset Should a metadata be reset by this call.
 */
function updateChatMetadata(newValues, reset) {
    chat_metadata = reset ? { ...newValues } : { ...chat_metadata, ...newValues };
}

function updateFavButtonState(state) {
    fav_ch_checked = state;
    $('#fav_checkbox').val(fav_ch_checked);
    $('#favorite_button').toggleClass('fav_on', fav_ch_checked);
    $('#favorite_button').toggleClass('fav_off', !fav_ch_checked);
}

export function setScenarioOverride() {
    if (!selected_group && !this_chid) {
        console.warn('setScenarioOverride() -- no selected group or character');
        return;
    }

    const template = $('#scenario_override_template .scenario_override').clone();
    const metadataValue = chat_metadata['scenario'] || '';
    const isGroup = !!selected_group;
    template.find('[data-group="true"]').toggle(isGroup);
    template.find('[data-character="true"]').toggle(!isGroup);
    template.find('.chat_scenario').val(metadataValue).on('input', onScenarioOverrideInput);
    template.find('.remove_scenario_override').on('click', onScenarioOverrideRemoveClick);
    callPopup(template, 'text');
}

function onScenarioOverrideInput() {
    const value = String($(this).val());
    chat_metadata['scenario'] = value;
    saveMetadataDebounced();
}

function onScenarioOverrideRemoveClick() {
    $(this).closest('.scenario_override').find('.chat_scenario').val('').trigger('input');
}

/**
 * Displays a blocking popup with a given text and type.
 * @param {JQuery<HTMLElement>|string|Element} text - Text to display in the popup.
 * @param {string} type
 * @param {string} inputValue - Value to set the input to.
 * @param {PopupOptions} options - Options for the popup.
 * @typedef {{okButton?: string, rows?: number, wide?: boolean, large?: boolean }} PopupOptions - Options for the popup.
 * @returns
 */
function callPopup(text, type, inputValue = '', { okButton, rows, wide, large } = {}) {
    dialogueCloseStop = true;
    if (type) {
        popup_type = type;
    }

    $('#dialogue_popup').toggleClass('wide_dialogue_popup', !!wide);

    $('#dialogue_popup').toggleClass('large_dialogue_popup', !!large);

    $('#dialogue_popup_cancel').css('display', 'inline-block');
    switch (popup_type) {
        case 'avatarToCrop':
            $('#dialogue_popup_ok').text(okButton ?? 'Accept');
            break;
        case 'text':
        case 'alternate_greeting':
        case 'char_not_selected':
            $('#dialogue_popup_ok').text(okButton ?? 'Ok');
            $('#dialogue_popup_cancel').css('display', 'none');
            break;
        case 'delete_extension':
            $('#dialogue_popup_ok').text(okButton ?? 'Ok');
            break;
        case 'new_chat':
        case 'confirm':
            $('#dialogue_popup_ok').text(okButton ?? 'Yes');
            break;
        case 'del_group':
        case 'rename_chat':
        case 'del_chat':
        default:
            $('#dialogue_popup_ok').text(okButton ?? 'Delete');
    }

    $('#dialogue_popup_input').val(inputValue);
    $('#dialogue_popup_input').attr('rows', rows ?? 1);

    if (popup_type == 'input') {
        $('#dialogue_popup_input').css('display', 'block');
        $('#dialogue_popup_ok').text(okButton ?? 'Save');
    }
    else {
        $('#dialogue_popup_input').css('display', 'none');
    }

    $('#dialogue_popup_text').empty().append(text);
    $('#shadow_popup').css('display', 'block');
    if (popup_type == 'input') {
        $('#dialogue_popup_input').focus();
    }
    if (popup_type == 'avatarToCrop') {
        // unset existing data
        crop_data = undefined;

        $('#avatarToCrop').cropper({
            aspectRatio: 2 / 3,
            autoCropArea: 1,
            viewMode: 2,
            rotatable: false,
            crop: function (event) {
                crop_data = event.detail;
                crop_data.want_resize = !power_user.never_resize_avatars;
            },
        });
    }
    $('#shadow_popup').transition({
        opacity: 1,
        duration: animation_duration,
        easing: animation_easing,
    });

    return new Promise((resolve) => {
        dialogueResolve = resolve;
    });
}

function showSwipeButtons() {
    if (chat.length === 0) {
        return;
    }

    if (
        chat[chat.length - 1].is_system ||
        !swipes ||
        $('.mes:last').attr('mesid') < 0 ||
        chat[chat.length - 1].is_user ||
        chat[chat.length - 1].extra?.image ||
        count_view_mes < 1 ||
        (selected_group && is_group_generating)
    ) { return; }

    // swipe_id should be set if alternate greetings are added
    if (chat.length == 1 && chat[0].swipe_id === undefined) {
        return;
    }

    //had to add this to make the swipe counter work
    //(copied from the onclick functions for swipe buttons..
    //don't know why the array isn't set for non-swipe messsages in Generate or addOneMessage..)

    if (chat[chat.length - 1]['swipe_id'] === undefined) {              // if there is no swipe-message in the last spot of the chat array
        chat[chat.length - 1]['swipe_id'] = 0;                        // set it to id 0
        chat[chat.length - 1]['swipes'] = [];                         // empty the array
        chat[chat.length - 1]['swipes'][0] = chat[chat.length - 1]['mes'];  //assign swipe array with last message from chat
    }

    const currentMessage = $('#chat').children().filter(`[mesid="${count_view_mes - 1}"]`);
    const swipeId = chat[chat.length - 1].swipe_id;
    var swipesCounterHTML = (`${(swipeId + 1)}/${(chat[chat.length - 1].swipes.length)}`);

    if (swipeId !== undefined && (chat[chat.length - 1].swipes.length > 1 || swipeId > 0)) {
        currentMessage.children('.swipe_left').css('display', 'flex');
    }
    //only show right when generate is off, or when next right swipe would not make a generate happen
    if (is_send_press === false || chat[chat.length - 1].swipes.length >= swipeId) {
        currentMessage.children('.swipe_right').css('display', 'flex');
        currentMessage.children('.swipe_right').css('opacity', '0.3');
    }
    //console.log((chat[chat.length - 1]));
    if ((chat[chat.length - 1].swipes.length - swipeId) === 1) {
        //console.log('highlighting R swipe');
        currentMessage.children('.swipe_right').css('opacity', '0.7');
    }
    //console.log(swipesCounterHTML);

    $('.swipes-counter').html(swipesCounterHTML);

    //console.log(swipeId);
    //console.log(chat[chat.length - 1].swipes.length);
}

function hideSwipeButtons() {
    //console.log('hideswipebuttons entered');
    $('#chat').children().filter(`[mesid="${count_view_mes - 1}"]`).children('.swipe_right').css('display', 'none');
    $('#chat').children().filter(`[mesid="${count_view_mes - 1}"]`).children('.swipe_left').css('display', 'none');
}

export async function saveMetadata() {
    if (selected_group) {
        await editGroup(selected_group, true, false);
    }
    else {
        await saveChatConditional();
    }
}

export async function saveChatConditional() {
    try {
        await waitUntilCondition(() => !isChatSaving, durationSaveEdit, 100);
    } catch {
        console.warn('Timeout waiting for chat to save');
        return;
    }

    try {
        isChatSaving = true;

        if (selected_group) {
            await saveGroupChat(selected_group, true);
        }
        else {
            await saveChat();
        }

        // Save token and prompts cache to IndexedDB storage
        saveTokenCache();
        saveItemizedPrompts(getCurrentChatId());
    } catch (error) {
        console.error('Error saving chat', error);
    } finally {
        isChatSaving = false;
    }
}

async function importCharacterChat(formData) {
    await jQuery.ajax({
        type: 'POST',
        url: '/api/chats/import',
        data: formData,
        beforeSend: function () {
        },
        cache: false,
        contentType: false,
        processData: false,
        success: async function (data) {
            if (data.res) {
                await displayPastChats();
            }
        },
        error: function () {
            $('#create_button').removeAttr('disabled');
        },
    });
}

function updateViewMessageIds(startFromZero = false) {
    const minId = startFromZero ? 0 : getFirstDisplayedMessageId();

    $('#chat').find('.mes').each(function (index, element) {
        $(element).attr('mesid', minId + index);
        $(element).find('.mesIDDisplay').text(`#${minId + index}`);
    });

    $('#chat .mes').removeClass('last_mes');
    $('#chat .mes').last().addClass('last_mes');

    updateEditArrowClasses();
}

export function getFirstDisplayedMessageId() {
    const allIds = Array.from(document.querySelectorAll('#chat .mes')).map(el => Number(el.getAttribute('mesid'))).filter(x => !isNaN(x));
    const minId = Math.min(...allIds);
    return minId;
}

function updateEditArrowClasses() {
    $('#chat .mes .mes_edit_up').removeClass('disabled');
    $('#chat .mes .mes_edit_down').removeClass('disabled');

    if (this_edit_mes_id !== undefined) {
        const down = $(`#chat .mes[mesid="${this_edit_mes_id}"] .mes_edit_down`);
        const up = $(`#chat .mes[mesid="${this_edit_mes_id}"] .mes_edit_up`);
        const lastId = Number($('#chat .mes').last().attr('mesid'));
        const firstId = Number($('#chat .mes').first().attr('mesid'));

        if (lastId == Number(this_edit_mes_id)) {
            down.addClass('disabled');
        }

        if (firstId == Number(this_edit_mes_id)) {
            up.addClass('disabled');
        }
    }
}

function closeMessageEditor() {
    if (this_edit_mes_id) {
        $(`#chat .mes[mesid="${this_edit_mes_id}"] .mes_edit_cancel`).click();
    }
}

function setGenerationProgress(progress) {
    if (!progress) {
        $('#send_textarea').css({ 'background': '', 'transition': '' });
    }
    else {
        $('#send_textarea').css({
            'background': `linear-gradient(90deg, #008000d6 ${progress}%, transparent ${progress}%)`,
            'transition': '0.25s ease-in-out',
        });
    }
}

function isHordeGenerationNotAllowed() {
    if (main_api == 'koboldhorde' && preset_settings == 'gui') {
        toastr.error('GUI Settings preset is not supported for Horde. Please select another preset.');
        return true;
    }

    return false;
}

export function cancelTtsPlay() {
    if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
    }
}

async function deleteMessageImage() {
    const value = await callPopup('<h3>Delete image from message?<br>This action can\'t be undone.</h3>', 'confirm');

    if (!value) {
        return;
    }

    const mesBlock = $(this).closest('.mes');
    const mesId = mesBlock.attr('mesid');
    const message = chat[mesId];
    delete message.extra.image;
    delete message.extra.inline_image;
    mesBlock.find('.mes_img_container').removeClass('img_extra');
    mesBlock.find('.mes_img').attr('src', '');
    await saveChatConditional();
}

function enlargeMessageImage() {
    const mesBlock = $(this).closest('.mes');
    const mesId = mesBlock.attr('mesid');
    const message = chat[mesId];
    const imgSrc = message?.extra?.image;
    const title = message?.extra?.title;

    if (!imgSrc) {
        return;
    }

    const img = document.createElement('img');
    img.classList.add('img_enlarged');
    img.src = imgSrc;
    const imgContainer = $('<div><pre><code></code></pre></div>');
    imgContainer.prepend(img);
    imgContainer.addClass('img_enlarged_container');
    imgContainer.find('code').addClass('txt').text(title);
    const titleEmpty = !title || title.trim().length === 0;
    imgContainer.find('pre').toggle(!titleEmpty);
    addCopyToCodeBlocks(imgContainer);
    callPopup(imgContainer, 'text', '', { wide: true, large: true });
}

function updateAlternateGreetingsHintVisibility(root) {
    const numberOfGreetings = root.find('.alternate_greetings_list .alternate_greeting').length;
    $(root).find('.alternate_grettings_hint').toggle(numberOfGreetings == 0);
}

function openCharacterWorldPopup() {
    const chid = $('#set_character_world').data('chid');

    if (menu_type != 'create' && chid == undefined) {
        toastr.error('Does not have an Id for this character in world select menu.');
        return;
    }

    async function onSelectCharacterWorld() {
        const value = $('.character_world_info_selector').find('option:selected').val();
        const worldIndex = value !== '' ? Number(value) : NaN;
        const name = !isNaN(worldIndex) ? world_names[worldIndex] : '';

        const previousValue = $('#character_world').val();
        $('#character_world').val(name);

        console.debug('Character world selected:', name);

        if (menu_type == 'create') {
            create_save.world = name;
        } else {
            if (previousValue && !name) {
                try {
                    // Dirty hack to remove embedded lorebook from character JSON data.
                    const data = JSON.parse($('#character_json_data').val());

                    if (data?.data?.character_book) {
                        data.data.character_book = undefined;
                    }

                    $('#character_json_data').val(JSON.stringify(data));
                    toastr.info('Embedded lorebook will be removed from this character.');
                } catch {
                    console.error('Failed to parse character JSON data.');
                }
            }

            await createOrEditCharacter();
        }

        setWorldInfoButtonClass(undefined, !!value);
    }

    function onExtraWorldInfoChanged() {
        const selectedWorlds = $('.character_extra_world_info_selector').val();
        let charLore = world_info.charLore ?? [];

        // TODO: Maybe make this utility function not use the window context?
        const fileName = getCharaFilename(chid);
        const tempExtraBooks = selectedWorlds.map((index) => world_names[index]).filter((e) => e !== undefined);

        const existingCharIndex = charLore.findIndex((e) => e.name === fileName);
        if (existingCharIndex === -1) {
            const newCharLoreEntry = {
                name: fileName,
                extraBooks: tempExtraBooks,
            };

            charLore.push(newCharLoreEntry);
        } else if (tempExtraBooks.length === 0) {
            charLore.splice(existingCharIndex, 1);
        } else {
            charLore[existingCharIndex].extraBooks = tempExtraBooks;
        }

        Object.assign(world_info, { charLore: charLore });
        saveSettingsDebounced();
    }

    const template = $('#character_world_template .character_world').clone();
    const select = template.find('.character_world_info_selector');
    const extraSelect = template.find('.character_extra_world_info_selector');
    const name = (menu_type == 'create' ? create_save.name : characters[chid]?.data?.name) || 'Nameless';
    const worldId = (menu_type == 'create' ? create_save.world : characters[chid]?.data?.extensions?.world) || '';
    template.find('.character_name').text(name);

    // Not needed on mobile
    if (!isMobile()) {
        $(extraSelect).select2({
            width: '100%',
            placeholder: 'No auxillary Lorebooks set. Click here to select.',
            allowClear: true,
            closeOnSelect: false,
        });
    }

    // Apped to base dropdown
    world_names.forEach((item, i) => {
        const option = document.createElement('option');
        option.value = i;
        option.innerText = item;
        option.selected = item === worldId;
        select.append(option);
    });

    // Append to extras dropdown
    if (world_names.length > 0) {
        extraSelect.empty();
    }
    world_names.forEach((item, i) => {
        const option = document.createElement('option');
        option.value = i;
        option.innerText = item;

        const existingCharLore = world_info.charLore?.find((e) => e.name === getCharaFilename());
        if (existingCharLore) {
            option.selected = existingCharLore.extraBooks.includes(item);
        } else {
            option.selected = false;
        }
        extraSelect.append(option);
    });

    select.on('change', onSelectCharacterWorld);
    extraSelect.on('mousedown change', async function (e) {
        // If there's no world names, don't do anything
        if (world_names.length === 0) {
            e.preventDefault();
            return;
        }

        onExtraWorldInfoChanged();
    });

    callPopup(template, 'text');
}

function openAlternateGreetings() {
    const chid = $('.open_alternate_greetings').data('chid');

    if (menu_type != 'create' && chid === undefined) {
        toastr.error('Does not have an Id for this character in editor menu.');
        return;
    } else {
        // If the character does not have alternate greetings, create an empty array
        if (chid && Array.isArray(characters[chid].data.alternate_greetings) == false) {
            characters[chid].data.alternate_greetings = [];
        }
    }

    const template = $('#alternate_greetings_template .alternate_grettings').clone();
    const getArray = () => menu_type == 'create' ? create_save.alternate_greetings : characters[chid].data.alternate_greetings;

    for (let index = 0; index < getArray().length; index++) {
        addAlternateGreeting(template, getArray()[index], index, getArray);
    }

    template.find('.add_alternate_greeting').on('click', function () {
        const array = getArray();
        const index = array.length;
        array.push(default_ch_mes);
        addAlternateGreeting(template, default_ch_mes, index, getArray);
        updateAlternateGreetingsHintVisibility(template);
    });

    updateAlternateGreetingsHintVisibility(template);
    callPopup(template, 'alternate_greeting');
}

function addAlternateGreeting(template, greeting, index, getArray) {
    const greetingBlock = $('#alternate_greeting_form_template .alternate_greeting').clone();
    greetingBlock.find('.alternate_greeting_text').on('input', async function () {
        const value = $(this).val();
        const array = getArray();
        array[index] = value;
    }).val(greeting);
    greetingBlock.find('.greeting_index').text(index + 1);
    greetingBlock.find('.delete_alternate_greeting').on('click', async function () {
        if (confirm('Are you sure you want to delete this alternate greeting?')) {
            const array = getArray();
            array.splice(index, 1);
            // We need to reopen the popup to update the index numbers
            openAlternateGreetings();
        }
    });
    template.find('.alternate_greetings_list').append(greetingBlock);
}

async function createOrEditCharacter(e) {
    $('#rm_info_avatar').html('');
    var formData = new FormData($('#form_create').get(0));
    formData.set('fav', fav_ch_checked);
    if ($('#form_create').attr('actiontype') == 'createcharacter') {
        if ($('#character_name_pole').val().length > 0) {
            //if the character name text area isn't empty (only posible when creating a new character)
            let url = '/api/characters/create';

            if (crop_data != undefined) {
                url += `?crop=${encodeURIComponent(JSON.stringify(crop_data))}`;
            }

            formData.delete('alternate_greetings');
            for (const value of create_save.alternate_greetings) {
                formData.append('alternate_greetings', value);
            }

            await jQuery.ajax({
                type: 'POST',
                url: url,
                data: formData,
                beforeSend: function () {
                    $('#create_button').attr('disabled', true);
                    $('#create_button').attr('value', '⏳');
                },
                cache: false,
                contentType: false,
                processData: false,
                success: async function (html) {
                    $('#character_cross').trigger('click'); //closes the advanced character editing popup
                    const fields = [
                        { id: '#character_name_pole', callback: value => create_save.name = value },
                        { id: '#description_textarea', callback: value => create_save.description = value },
                        { id: '#creator_notes_textarea', callback: value => create_save.creator_notes = value },
                        { id: '#character_version_textarea', callback: value => create_save.character_version = value },
                        { id: '#post_history_instructions_textarea', callback: value => create_save.post_history_instructions = value },
                        { id: '#system_prompt_textarea', callback: value => create_save.system_prompt = value },
                        { id: '#tags_textarea', callback: value => create_save.tags = value },
                        { id: '#creator_textarea', callback: value => create_save.creator = value },
                        { id: '#personality_textarea', callback: value => create_save.personality = value },
                        { id: '#firstmessage_textarea', callback: value => create_save.first_message = value },
                        { id: '#talkativeness_slider', callback: value => create_save.talkativeness = value, defaultValue: talkativeness_default },
                        { id: '#scenario_pole', callback: value => create_save.scenario = value },
                        { id: '#depth_prompt_prompt', callback: value => create_save.depth_prompt_prompt = value },
                        { id: '#depth_prompt_depth', callback: value => create_save.depth_prompt_depth = value, defaultValue: depth_prompt_depth_default },
                        { id: '#mes_example_textarea', callback: value => create_save.mes_example = value },
                        { id: '#character_json_data', callback: () => { } },
                        { id: '#alternate_greetings_template', callback: value => create_save.alternate_greetings = value, defaultValue: [] },
                        { id: '#character_world', callback: value => create_save.world = value },
                    ];

                    fields.forEach(field => {
                        const fieldValue = field.defaultValue !== undefined ? field.defaultValue : '';
                        $(field.id).val(fieldValue);
                        field.callback && field.callback(fieldValue);
                    });

                    $('#character_popup_text_h3').text('Create character');

                    create_save.avatar = '';

                    $('#create_button').removeAttr('disabled');
                    $('#add_avatar_button').replaceWith(
                        $('#add_avatar_button').val('').clone(true),
                    );

                    $('#create_button').attr('value', '✅');
                    let oldSelectedChar = null;
                    if (this_chid != undefined && this_chid != 'invalid-safety-id') {
                        oldSelectedChar = characters[this_chid].avatar;
                    }

                    console.log(`new avatar id: ${html}`);
                    createTagMapFromList('#tagList', html);
                    await getCharacters();

                    select_rm_info('char_create', html, oldSelectedChar);

                    crop_data = undefined;
                },
                error: function (jqXHR, exception) {
                    $('#create_button').removeAttr('disabled');
                },
            });
        } else {
            toastr.error('Name is required');
        }
    } else {
        let url = '/api/characters/edit';

        if (crop_data != undefined) {
            url += `?crop=${encodeURIComponent(JSON.stringify(crop_data))}`;
        }

        formData.delete('alternate_greetings');
        const chid = $('.open_alternate_greetings').data('chid');
        if (chid && Array.isArray(characters[chid]?.data?.alternate_greetings)) {
            for (const value of characters[chid].data.alternate_greetings) {
                formData.append('alternate_greetings', value);
            }
        }

        await jQuery.ajax({
            type: 'POST',
            url: url,
            data: formData,
            beforeSend: function () {
                $('#create_button').attr('disabled', true);
                $('#create_button').attr('value', 'Save');
            },
            cache: false,
            contentType: false,
            processData: false,
            success: async function (html) {
                $('#create_button').removeAttr('disabled');

                await getOneCharacter(formData.get('avatar_url'));
                favsToHotswap(); // Update fav state

                $('#add_avatar_button').replaceWith(
                    $('#add_avatar_button').val('').clone(true),
                );
                $('#create_button').attr('value', 'Save');
                crop_data = undefined;
                eventSource.emit(event_types.CHARACTER_EDITED, { detail: { id: this_chid, character: characters[this_chid] } });

                if (chat.length === 1 && !selected_group) {
                    const firstMessage = getFirstMessage();
                    chat[0] = firstMessage;

                    const chat_id = (chat.length - 1);
                    await eventSource.emit(event_types.MESSAGE_RECEIVED, chat_id);
                    await clearChat();
                    await printMessages();
                    await eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, chat_id);
                    await saveChatConditional();
                }
            },
            error: function (jqXHR, exception) {
                $('#create_button').removeAttr('disabled');
                console.log('Error! Either a file with the same name already existed, or the image file provided was in an invalid format. Double check that the image is not a webp.');
                toastr.error('Something went wrong while saving the character, or the image file provided was in an invalid format. Double check that the image is not a webp.');
            },
        });
    }
}

window['SillyTavern'].getContext = function () {
    return {
        chat: chat,
        characters: characters,
        groups: groups,
        name1: name1,
        name2: name2,
        characterId: this_chid,
        groupId: selected_group,
        chatId: selected_group
            ? groups.find(x => x.id == selected_group)?.chat_id
            : (this_chid && characters[this_chid] && characters[this_chid].chat),
        getCurrentChatId: getCurrentChatId,
        getRequestHeaders: getRequestHeaders,
        reloadCurrentChat: reloadCurrentChat,
        saveSettingsDebounced: saveSettingsDebounced,
        onlineStatus: online_status,
        maxContext: Number(max_context),
        chatMetadata: chat_metadata,
        streamingProcessor,
        eventSource: eventSource,
        event_types: event_types,
        addOneMessage: addOneMessage,
        generate: Generate,
        getTokenCount: getTokenCount,
        extensionPrompts: extension_prompts,
        setExtensionPrompt: setExtensionPrompt,
        updateChatMetadata: updateChatMetadata,
        saveChat: saveChatConditional,
        saveMetadata: saveMetadata,
        sendSystemMessage: sendSystemMessage,
        activateSendButtons,
        deactivateSendButtons,
        saveReply,
        registerSlashCommand: registerSlashCommand,
        executeSlashCommands: executeSlashCommands,
        /**
         * @deprecated Handlebars for extensions are no longer supported.
         */
        registerHelper: () => { },
        registedDebugFunction: registerDebugFunction,
        renderExtensionTemplate: renderExtensionTemplate,
        callPopup: callPopup,
        mainApi: main_api,
        extensionSettings: extension_settings,
        ModuleWorkerWrapper: ModuleWorkerWrapper,
        getTokenizerModel: getTokenizerModel,
        generateQuietPrompt: generateQuietPrompt,
        tags: tags,
        tagMap: tag_map,
    };
};

function swipe_left() {      // when we swipe left..but no generation.
    if (chat.length - 1 === Number(this_edit_mes_id)) {
        closeMessageEditor();
    }

    if (isStreamingEnabled() && streamingProcessor) {
        streamingProcessor.onStopStreaming();
    }

    const swipe_duration = 120;
    const swipe_range = '700px';
    chat[chat.length - 1]['swipe_id']--;

    if (chat[chat.length - 1]['swipe_id'] < 0) {
        chat[chat.length - 1]['swipe_id'] = chat[chat.length - 1]['swipes'].length - 1;
    }

    if (chat[chat.length - 1]['swipe_id'] >= 0) {
        /*$(this).parent().children('swipe_right').css('display', 'flex');
        if (chat[chat.length - 1]['swipe_id'] === 0) {
            $(this).css('display', 'none');
        }*/ // Just in case
        if (!Array.isArray(chat[chat.length - 1]['swipe_info'])) {
            chat[chat.length - 1]['swipe_info'] = [];
        }
        let this_mes_div = $(this).parent();
        let this_mes_block = $(this).parent().children('.mes_block').children('.mes_text');
        const this_mes_div_height = this_mes_div[0].scrollHeight;
        this_mes_div.css('height', this_mes_div_height);
        const this_mes_block_height = this_mes_block[0].scrollHeight;
        chat[chat.length - 1]['mes'] = chat[chat.length - 1]['swipes'][chat[chat.length - 1]['swipe_id']];
        chat[chat.length - 1]['send_date'] = chat[chat.length - 1].swipe_info[chat[chat.length - 1]['swipe_id']]?.send_date || chat[chat.length - 1].send_date; //load the last mes box with the latest generation
        chat[chat.length - 1]['extra'] = JSON.parse(JSON.stringify(chat[chat.length - 1].swipe_info[chat[chat.length - 1]['swipe_id']]?.extra || chat[chat.length - 1].extra));

        if (chat[chat.length - 1].extra) {
            // if message has memory attached - remove it to allow regen
            if (chat[chat.length - 1].extra.memory) {
                delete chat[chat.length - 1].extra.memory;
            }
            // ditto for display text
            if (chat[chat.length - 1].extra.display_text) {
                delete chat[chat.length - 1].extra.display_text;
            }
        }
        $(this).parent().children('.mes_block').transition({
            x: swipe_range,
            duration: swipe_duration,
            easing: animation_easing,
            queue: false,
            complete: function () {
                const is_animation_scroll = ($('#chat').scrollTop() >= ($('#chat').prop('scrollHeight') - $('#chat').outerHeight()) - 10);
                //console.log('on left swipe click calling addOneMessage');
                addOneMessage(chat[chat.length - 1], { type: 'swipe' });

                if (power_user.message_token_count_enabled) {
                    if (!chat[chat.length - 1].extra) {
                        chat[chat.length - 1].extra = {};
                    }

                    const swipeMessage = $('#chat').find(`[mesid="${count_view_mes - 1}"]`);
                    const tokenCount = getTokenCount(chat[chat.length - 1].mes, 0);
                    chat[chat.length - 1]['extra']['token_count'] = tokenCount;
                    swipeMessage.find('.tokenCounterDisplay').text(`${tokenCount}t`);
                }

                let new_height = this_mes_div_height - (this_mes_block_height - this_mes_block[0].scrollHeight);
                if (new_height < 103) new_height = 103;
                this_mes_div.animate({ height: new_height + 'px' }, {
                    duration: 0, //used to be 100
                    queue: false,
                    progress: function () {
                        // Scroll the chat down as the message expands

                        if (is_animation_scroll) $('#chat').scrollTop($('#chat')[0].scrollHeight);
                    },
                    complete: function () {
                        this_mes_div.css('height', 'auto');
                        // Scroll the chat down to the bottom once the animation is complete
                        if (is_animation_scroll) $('#chat').scrollTop($('#chat')[0].scrollHeight);
                    },
                });
                $(this).parent().children('.mes_block').transition({
                    x: '-' + swipe_range,
                    duration: 0,
                    easing: animation_easing,
                    queue: false,
                    complete: function () {
                        $(this).parent().children('.mes_block').transition({
                            x: '0px',
                            duration: swipe_duration,
                            easing: animation_easing,
                            queue: false,
                            complete: async function () {
                                await eventSource.emit(event_types.MESSAGE_SWIPED, (chat.length - 1));
                                saveChatDebounced();
                            },
                        });
                    },
                });
            },
        });

        $(this).parent().children('.avatar').transition({
            x: swipe_range,
            duration: swipe_duration,
            easing: animation_easing,
            queue: false,
            complete: function () {
                $(this).parent().children('.avatar').transition({
                    x: '-' + swipe_range,
                    duration: 0,
                    easing: animation_easing,
                    queue: false,
                    complete: function () {
                        $(this).parent().children('.avatar').transition({
                            x: '0px',
                            duration: swipe_duration,
                            easing: animation_easing,
                            queue: false,
                            complete: function () {

                            },
                        });
                    },
                });
            },
        });
    }
    if (chat[chat.length - 1]['swipe_id'] < 0) {
        chat[chat.length - 1]['swipe_id'] = 0;
    }
}

/**
 * Creates a new branch from the message with the given ID
 * @param {number} mesId Message ID
 * @returns {Promise<string>} Branch file name
 */
async function branchChat(mesId) {
    const fileName = await createBranch(mesId);

    if (selected_group) {
        await openGroupChat(selected_group, fileName);
    } else {
        await openCharacterChat(fileName);
    }

    return fileName;
}

// when we click swipe right button
const swipe_right = () => {
    if (chat.length - 1 === Number(this_edit_mes_id)) {
        closeMessageEditor();
    }

    if (isHordeGenerationNotAllowed()) {
        return unblockGeneration();
    }

    const swipe_duration = 200;
    const swipe_range = 700;
    //console.log(swipe_range);
    let run_generate = false;
    let run_swipe_right = false;
    if (chat[chat.length - 1]['swipe_id'] === undefined) {              // if there is no swipe-message in the last spot of the chat array
        chat[chat.length - 1]['swipe_id'] = 0;                        // set it to id 0
        chat[chat.length - 1]['swipes'] = [];                         // empty the array
        chat[chat.length - 1]['swipe_info'] = [];
        chat[chat.length - 1]['swipes'][0] = chat[chat.length - 1]['mes'];  //assign swipe array with last message from chat
        chat[chat.length - 1]['swipe_info'][0] = { 'send_date': chat[chat.length - 1]['send_date'], 'gen_started': chat[chat.length - 1]['gen_started'], 'gen_finished': chat[chat.length - 1]['gen_finished'], 'extra': JSON.parse(JSON.stringify(chat[chat.length - 1]['extra'])) };
        //assign swipe info array with last message from chat
    }
    if (chat.length === 1 && chat[0]['swipe_id'] !== undefined && chat[0]['swipe_id'] === chat[0]['swipes'].length - 1) {    // if swipe_right is called on the last alternate greeting, loop back around
        chat[0]['swipe_id'] = 0;
    } else {
        chat[chat.length - 1]['swipe_id']++;                                // make new slot in array
    }
    if (chat[chat.length - 1].extra) {
        // if message has memory attached - remove it to allow regen
        if (chat[chat.length - 1].extra.memory) {
            delete chat[chat.length - 1].extra.memory;
        }
        // ditto for display text
        if (chat[chat.length - 1].extra.display_text) {
            delete chat[chat.length - 1].extra.display_text;
        }
    }
    if (!Array.isArray(chat[chat.length - 1]['swipe_info'])) {
        chat[chat.length - 1]['swipe_info'] = [];
    }
    //console.log(chat[chat.length-1]['swipes']);
    if (parseInt(chat[chat.length - 1]['swipe_id']) === chat[chat.length - 1]['swipes'].length && chat.length !== 1) { //if swipe id of last message is the same as the length of the 'swipes' array and not the greeting
        delete chat[chat.length - 1].gen_started;
        delete chat[chat.length - 1].gen_finished;
        run_generate = true;
    } else if (parseInt(chat[chat.length - 1]['swipe_id']) < chat[chat.length - 1]['swipes'].length) { //otherwise, if the id is less than the number of swipes
        chat[chat.length - 1]['mes'] = chat[chat.length - 1]['swipes'][chat[chat.length - 1]['swipe_id']]; //load the last mes box with the latest generation
        chat[chat.length - 1]['send_date'] = chat[chat.length - 1]?.swipe_info[chat[chat.length - 1]['swipe_id']]?.send_date || chat[chat.length - 1]['send_date']; //update send date
        chat[chat.length - 1]['extra'] = JSON.parse(JSON.stringify(chat[chat.length - 1].swipe_info[chat[chat.length - 1]['swipe_id']]?.extra || chat[chat.length - 1].extra || []));
        run_swipe_right = true; //then prepare to do normal right swipe to show next message
    }

    const currentMessage = $('#chat').children().filter(`[mesid="${count_view_mes - 1}"]`);
    let this_div = currentMessage.children('.swipe_right');
    let this_mes_div = this_div.parent();

    if (chat[chat.length - 1]['swipe_id'] > chat[chat.length - 1]['swipes'].length) { //if we swipe right while generating (the swipe ID is greater than what we are viewing now)
        chat[chat.length - 1]['swipe_id'] = chat[chat.length - 1]['swipes'].length; //show that message slot (will be '...' while generating)
    }
    if (run_generate) {               //hide swipe arrows while generating
        this_div.css('display', 'none');
    }
    // handles animated transitions when swipe right, specifically height transitions between messages
    if (run_generate || run_swipe_right) {
        let this_mes_block = this_mes_div.children('.mes_block').children('.mes_text');
        const this_mes_div_height = this_mes_div[0].scrollHeight;
        const this_mes_block_height = this_mes_block[0].scrollHeight;

        this_mes_div.children('.swipe_left').css('display', 'flex');
        this_mes_div.children('.mes_block').transition({        // this moves the div back and forth
            x: '-' + swipe_range,
            duration: swipe_duration,
            easing: animation_easing,
            queue: false,
            complete: function () {
                /*if (!selected_group) {
                    var typingIndicator = $("#typing_indicator_template .typing_indicator").clone();
                    typingIndicator.find(".typing_indicator_name").text(characters[this_chid].name);
                } */
                /* $("#chat").append(typingIndicator); */
                const is_animation_scroll = ($('#chat').scrollTop() >= ($('#chat').prop('scrollHeight') - $('#chat').outerHeight()) - 10);
                //console.log(parseInt(chat[chat.length-1]['swipe_id']));
                //console.log(chat[chat.length-1]['swipes'].length);
                const swipeMessage = $('#chat').find('[mesid="' + (count_view_mes - 1) + '"]');
                if (run_generate && parseInt(chat[chat.length - 1]['swipe_id']) === chat[chat.length - 1]['swipes'].length) {
                    //shows "..." while generating
                    swipeMessage.find('.mes_text').html('...');
                    // resets the timer
                    swipeMessage.find('.mes_timer').html('');
                    swipeMessage.find('.tokenCounterDisplay').text('');
                } else {
                    //console.log('showing previously generated swipe candidate, or "..."');
                    //console.log('onclick right swipe calling addOneMessage');
                    addOneMessage(chat[chat.length - 1], { type: 'swipe' });

                    if (power_user.message_token_count_enabled) {
                        if (!chat[chat.length - 1].extra) {
                            chat[chat.length - 1].extra = {};
                        }

                        const tokenCount = getTokenCount(chat[chat.length - 1].mes, 0);
                        chat[chat.length - 1]['extra']['token_count'] = tokenCount;
                        swipeMessage.find('.tokenCounterDisplay').text(`${tokenCount}t`);
                    }
                }
                let new_height = this_mes_div_height - (this_mes_block_height - this_mes_block[0].scrollHeight);
                if (new_height < 103) new_height = 103;


                this_mes_div.animate({ height: new_height + 'px' }, {
                    duration: 0, //used to be 100
                    queue: false,
                    progress: function () {
                        // Scroll the chat down as the message expands
                        if (is_animation_scroll) $('#chat').scrollTop($('#chat')[0].scrollHeight);
                    },
                    complete: function () {
                        this_mes_div.css('height', 'auto');
                        // Scroll the chat down to the bottom once the animation is complete
                        if (is_animation_scroll) $('#chat').scrollTop($('#chat')[0].scrollHeight);
                    },
                });
                this_mes_div.children('.mes_block').transition({
                    x: swipe_range,
                    duration: 0,
                    easing: animation_easing,
                    queue: false,
                    complete: function () {
                        this_mes_div.children('.mes_block').transition({
                            x: '0px',
                            duration: swipe_duration,
                            easing: animation_easing,
                            queue: false,
                            complete: async function () {
                                await eventSource.emit(event_types.MESSAGE_SWIPED, (chat.length - 1));
                                if (run_generate && !is_send_press && parseInt(chat[chat.length - 1]['swipe_id']) === chat[chat.length - 1]['swipes'].length) {
                                    console.debug('caught here 2');
                                    is_send_press = true;
                                    $('.mes_buttons:last').hide();
                                    await Generate('swipe');
                                } else {
                                    if (parseInt(chat[chat.length - 1]['swipe_id']) !== chat[chat.length - 1]['swipes'].length) {
                                        saveChatDebounced();
                                    }
                                }
                            },
                        });
                    },
                });
            },
        });
        this_mes_div.children('.avatar').transition({ // moves avatar along with swipe
            x: '-' + swipe_range,
            duration: swipe_duration,
            easing: animation_easing,
            queue: false,
            complete: function () {
                this_mes_div.children('.avatar').transition({
                    x: swipe_range,
                    duration: 0,
                    easing: animation_easing,
                    queue: false,
                    complete: function () {
                        this_mes_div.children('.avatar').transition({
                            x: '0px',
                            duration: swipe_duration,
                            easing: animation_easing,
                            queue: false,
                            complete: function () {

                            },
                        });
                    },
                });
            },
        });
    }
};

const CONNECT_API_MAP = {
    'kobold': {
        button: '#api_button',
    },
    'horde': {
        selected: 'koboldhorde',
    },
    'novel': {
        button: '#api_button_novel',
    },
    'ooba': {
        selected: 'textgenerationwebui',
        button: '#api_button_textgenerationwebui',
        type: textgen_types.OOBA,
    },
    'tabby': {
        selected: 'textgenerationwebui',
        button: '#api_button_textgenerationwebui',
        type: textgen_types.TABBY,
    },
    'llamacpp': {
        selected: 'textgenerationwebui',
        button: '#api_button_textgenerationwebui',
        type: textgen_types.LLAMACPP,
    },
    'ollama': {
        selected: 'textgenerationwebui',
        button: '#api_button_textgenerationwebui',
        type: textgen_types.OLLAMA,
    },
    'mancer': {
        selected: 'textgenerationwebui',
        button: '#api_button_textgenerationwebui',
        type: textgen_types.MANCER,
    },
    'aphrodite': {
        selected: 'textgenerationwebui',
        button: '#api_button_textgenerationwebui',
        type: textgen_types.APHRODITE,
    },
    'kcpp': {
        selected: 'textgenerationwebui',
        button: '#api_button_textgenerationwebui',
        type: textgen_types.KOBOLDCPP,
    },
    'togetherai': {
        selected: 'textgenerationwebui',
        button: '#api_button_textgenerationwebui',
        type: textgen_types.TOGETHERAI,
    },
    'oai': {
        selected: 'openai',
        button: '#api_button_openai',
        source: chat_completion_sources.OPENAI,
    },
    'claude': {
        selected: 'openai',
        button: '#api_button_openai',
        source: chat_completion_sources.CLAUDE,
    },
    'windowai': {
        selected: 'openai',
        button: '#api_button_openai',
        source: chat_completion_sources.WINDOWAI,
    },
    'openrouter': {
        selected: 'openai',
        button: '#api_button_openai',
        source: chat_completion_sources.OPENROUTER,
    },
    'scale': {
        selected: 'openai',
        button: '#api_button_openai',
        source: chat_completion_sources.SCALE,
    },
    'ai21': {
        selected: 'openai',
        button: '#api_button_openai',
        source: chat_completion_sources.AI21,
    },
    'makersuite': {
        selected: 'openai',
        button: '#api_button_openai',
        source: chat_completion_sources.MAKERSUITE,
    },
    'mistralai': {
        selected: 'openai',
        button: '#api_button_openai',
        source: chat_completion_sources.MISTRALAI,
    },
    'custom': {
        selected: 'openai',
        button: '#api_button_openai',
        source: chat_completion_sources.CUSTOM,
    },
};

/**
 * @param {string} text API name
 */
async function connectAPISlash(_, text) {
    if (!text) return;

    const apiConfig = CONNECT_API_MAP[text.toLowerCase()];
    if (!apiConfig) {
        toastr.error(`Error: ${text} is not a valid API`);
        return;
    }

    $(`#main_api option[value='${apiConfig.selected || text}']`).prop('selected', true);
    $('#main_api').trigger('change');

    if (apiConfig.source) {
        $(`#chat_completion_source option[value='${apiConfig.source}']`).prop('selected', true);
        $('#chat_completion_source').trigger('change');
    }

    if (apiConfig.type) {
        $(`#textgen_type option[value='${apiConfig.type}']`).prop('selected', true);
        $('#textgen_type').trigger('change');
    }

    if (apiConfig.button) {
        $(apiConfig.button).trigger('click');
    }

    toastr.info(`API set to ${text}, trying to connect..`);

    try {
        await waitUntilCondition(() => online_status !== 'no_connection', 5000, 100);
        console.log('Connection successful');
    } catch {
        console.log('Could not connect after 5 seconds, skipping.');
    }
}

export async function processDroppedFiles(files) {
    const allowedMimeTypes = [
        'application/json',
        'image/png',
        'application/yaml',
        'application/x-yaml',
        'text/yaml',
        'text/x-yaml',
    ];

    for (const file of files) {
        if (allowedMimeTypes.includes(file.type)) {
            await importCharacter(file);
        } else {
            toastr.warning('Unsupported file type: ' + file.name);
        }
    }
}

async function importCharacter(file) {
    const ext = file.name.match(/\.(\w+)$/);
    if (!ext || !(['json', 'png', 'yaml', 'yml'].includes(ext[1].toLowerCase()))) {
        return;
    }

    const format = ext[1].toLowerCase();
    $('#character_import_file_type').val(format);
    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('file_type', format);

    const data = await jQuery.ajax({
        type: 'POST',
        url: '/api/characters/import',
        data: formData,
        async: true,
        cache: false,
        contentType: false,
        processData: false,
    });

    if (data.error) {
        toastr.error('The file is likely invalid or corrupted.', 'Could not import character');
        return;
    }

    if (data.file_name !== undefined) {
        $('#character_search_bar').val('').trigger('input');

        let oldSelectedChar = null;
        if (this_chid != undefined && this_chid != 'invalid-safety-id') {
            oldSelectedChar = characters[this_chid].avatar;
        }

        await getCharacters();
        select_rm_info('char_import', data.file_name, oldSelectedChar);
        if (power_user.import_card_tags) {
            let currentContext = getContext();
            let avatarFileName = `${data.file_name}.png`;
            let importedCharacter = currentContext.characters.find(character => character.avatar === avatarFileName);
            await importTags(importedCharacter);
        }
    }
}

async function importFromURL(items, files) {
    for (const item of items) {
        if (item.type === 'text/uri-list') {
            const uriList = await new Promise((resolve) => {
                item.getAsString((uriList) => { resolve(uriList); });
            });
            const uris = uriList.split('\n').filter(uri => uri.trim() !== '');
            try {
                for (const uri of uris) {
                    const request = await fetch(uri);
                    const data = await request.blob();
                    const fileName = request.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || uri.split('/').pop() || 'file.png';
                    const file = new File([data], fileName, { type: data.type });
                    files.push(file);
                }
            } catch (error) {
                console.error('Failed to import from URL', error);
            }
        }
    }
}

async function doImpersonate() {
    $('#send_textarea').val('');
    $('#option_impersonate').trigger('click', { fromSlashCommand: true });
}

async function doDeleteChat() {
    $('#option_select_chat').trigger('click', { fromSlashCommand: true });
    await delay(100);
    let currentChatDeleteButton = $('.select_chat_block[highlight=\'true\']').parent().find('.PastChat_cross');
    $(currentChatDeleteButton).trigger('click', { fromSlashCommand: true });
    await delay(1);
    $('#dialogue_popup_ok').trigger('click');
    //200 delay needed let the past chat view reshow first
    await delay(200);
    $('#select_chat_cross').trigger('click');
}

const isPwaMode = window.navigator.standalone;
if (isPwaMode) { $('body').addClass('PWA'); }

function doCharListDisplaySwitch() {
    console.debug('toggling body charListGrid state');
    $('body').toggleClass('charListGrid');
    power_user.charListGrid = $('body').hasClass('charListGrid') ? true : false;
    saveSettingsDebounced();
}

function doCloseChat() {
    $('#option_close_chat').trigger('click');
}

/**
 * Function to handle the deletion of a character, given a specific popup type and character ID.
 * If popup type equals "del_ch", it will proceed with deletion otherwise it will exit the function.
 * It fetches the delete character route, sending necessary parameters, and in case of success,
 * it proceeds to delete character from UI and saves settings.
 * In case of error during the fetch request, it logs the error details.
 *
 * @param {string} popup_type - The type of popup currently active.
 * @param {string} this_chid - The character ID to be deleted.
 * @param {boolean} delete_chats - Whether to delete chats or not.
 */
export async function handleDeleteCharacter(popup_type, this_chid, delete_chats) {
    if (popup_type !== 'del_ch' ||
        !characters[this_chid]) {
        return;
    }

    const avatar = characters[this_chid].avatar;
    const name = characters[this_chid].name;
    const pastChats = await getPastCharacterChats();

    const msg = { avatar_url: avatar, delete_chats: delete_chats };

    const response = await fetch('/api/characters/delete', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(msg),
        cache: 'no-cache',
    });

    if (response.ok) {
        await deleteCharacter(name, avatar);

        if (delete_chats) {
            for (const chat of pastChats) {
                const name = chat.file_name.replace('.jsonl', '');
                await eventSource.emit(event_types.CHAT_DELETED, name);
            }
        }
    } else {
        console.error('Failed to delete character: ', response.status, response.statusText);
    }
}

/**
 * Function to delete a character from UI after character deletion API success.
 * It manages necessary UI changes such as closing advanced editing popup, unsetting
 * character ID, resetting characters array and chat metadata, deselecting character's tab
 * panel, removing character name from navigation tabs, clearing chat, removing character's
 * avatar from tag_map, fetching updated list of characters and updating the 'deleted
 * character' message.
 * It also ensures to save the settings after all the operations.
 *
 * @param {string} name - The name of the character to be deleted.
 * @param {string} avatar - The avatar URL of the character to be deleted.
 * @param {boolean} reloadCharacters - Whether the character list should be refreshed after deletion.
 */
export async function deleteCharacter(name, avatar, reloadCharacters = true) {
    await clearChat();
    $('#character_cross').click();
    this_chid = 'invalid-safety-id';
    characters.length = 0;
    name2 = systemUserName;
    chat = [...safetychat];
    chat_metadata = {};
    $(document.getElementById('rm_button_selected_ch')).children('h2').text('');
    this_chid = undefined;
    delete tag_map[avatar];
    if (reloadCharacters) await getCharacters();
    select_rm_info('char_delete', name);
    await printMessages();
    saveSettingsDebounced();
}

function doTogglePanels() {
    $('#option_settings').trigger('click');
}

function addDebugFunctions() {
    const doBackfill = async () => {
        for (const message of chat) {
            // System messages are not counted
            if (message.is_system) {
                continue;
            }

            if (!message.extra) {
                message.extra = {};
            }

            message.extra.token_count = getTokenCount(message.mes, 0);
        }

        await saveChatConditional();
        await reloadCurrentChat();
    };

    registerDebugFunction('backfillTokenCounts', 'Backfill token counters',
        `Recalculates token counts of all messages in the current chat to refresh the counters.
        Useful when you switch between models that have different tokenizers.
        This is a visual change only. Your chat will be reloaded.`, doBackfill);

    registerDebugFunction('generationTest', 'Send a generation request', 'Generates text using the currently selected API.', async () => {
        const text = prompt('Input text:', 'Hello');
        toastr.info('Working on it...');
        const message = await generateRaw(text, null, '');
        alert(message);
    });

    registerDebugFunction('clearPrompts', 'Delete itemized prompts', 'Deletes all itemized prompts from the local storage.', async () => {
        await clearItemizedPrompts();
        toastr.info('Itemized prompts deleted.');
        if (getCurrentChatId()) {
            await reloadCurrentChat();
        }
    });
}

jQuery(async function () {

    if (isMobile()) {
        console.debug('hiding movingUI and sheldWidth toggles for mobile');
        $('#sheldWidthToggleBlock').hide();
        $('#movingUIModeCheckBlock').hide();

    }

    async function doForceSave() {
        await saveSettings();
        await saveChatConditional();
        toastr.success('Chat and settings saved.');
    }

    registerSlashCommand('dupe', DupeChar, [], '– duplicates the currently selected character', true, true);
    registerSlashCommand('api', connectAPISlash, [], `<span class="monospace">(${Object.keys(CONNECT_API_MAP).join(', ')})</span> – connect to an API`, true, true);
    registerSlashCommand('impersonate', doImpersonate, ['imp'], '– calls an impersonation response', true, true);
    registerSlashCommand('delchat', doDeleteChat, [], '– deletes the current chat', true, true);
    registerSlashCommand('closechat', doCloseChat, [], '– closes the current chat', true, true);
    registerSlashCommand('panels', doTogglePanels, ['togglepanels'], '– toggle UI panels on/off', true, true);
    registerSlashCommand('forcesave', doForceSave, [], '– forces a save of the current chat and settings', true, true);

    setTimeout(function () {
        $('#groupControlsToggle').trigger('click');
        $('#groupCurrentMemberListToggle .inline-drawer-icon').trigger('click');
    }, 200);

    $('#chat').on('mousewheel touchstart', () => {
        scrollLock = true;
    });

    $(document).on('click', '.api_loading', cancelStatusCheck);

    //////////INPUT BAR FOCUS-KEEPING LOGIC/////////////
    let S_TAPreviouslyFocused = false;
    $('#send_textarea').on('focusin focus click', () => {
        S_TAPreviouslyFocused = true;
    });
    $('#options_button, #send_but, #option_regenerate, #option_continue, #mes_continue').on('click', () => {
        if (S_TAPreviouslyFocused) {
            $('#send_textarea').focus();
        }
    });
    $(document).click(event => {
        if ($(':focus').attr('id') !== 'send_textarea') {
            var validIDs = ['options_button', 'send_but', 'mes_continue', 'send_textarea', 'option_regenerate', 'option_continue'];
            if (!validIDs.includes($(event.target).attr('id'))) {
                S_TAPreviouslyFocused = false;
            }
        } else {
            S_TAPreviouslyFocused = true;
        }
    });

    /////////////////

    $('#swipes-checkbox').change(function () {
        swipes = !!$('#swipes-checkbox').prop('checked');
        if (swipes) {
            //console.log('toggle change calling showswipebtns');
            showSwipeButtons();
        } else {
            hideSwipeButtons();
        }
        saveSettingsDebounced();
    });

    ///// SWIPE BUTTON CLICKS ///////

    $(document).on('click', '.swipe_right', swipe_right);

    $(document).on('click', '.swipe_left', swipe_left);

    $('#character_search_bar').on('input', function () {
        const searchValue = String($(this).val()).toLowerCase();
        entitiesFilter.setFilterData(FILTER_TYPES.SEARCH, searchValue);
    });

    $('#mes_continue').on('click', function () {
        $('#option_continue').trigger('click');
    });

    $('#send_but').on('click', function () {
        if (is_send_press == false) {
            // This prevents from running /trigger command with a send button
            // But send on Enter doesn't set is_send_press (it is done by the Generate itself)
            // is_send_press = true;
            Generate();
        }
    });

    //menu buttons setup

    $('#rm_button_settings').click(function () {
        selected_button = 'settings';
        menu_type = 'settings';
        selectRightMenuWithAnimation('rm_api_block');
    });
    $('#rm_button_characters').click(function () {
        selected_button = 'characters';
        select_rm_characters();
    });
    $('#rm_button_back').click(function () {
        selected_button = 'characters';
        select_rm_characters();
    });
    $('#rm_button_create').click(function () {
        selected_button = 'create';
        select_rm_create();
    });
    $('#rm_button_selected_ch').click(function () {
        if (selected_group) {
            select_group_chats(selected_group);
        } else {
            selected_button = 'character_edit';
            select_selected_character(this_chid);
        }
        $('#character_search_bar').val('').trigger('input');
    });

    $(document).on('click', '.character_select', async function () {
        const id = $(this).attr('chid');
        await selectCharacterById(id);
    });

    $(document).on('click', '.bogus_folder_select', function () {
        const tagId = $(this).attr('tagid');
        console.log('Bogus folder clicked', tagId);

        const filterData = structuredClone(entitiesFilter.getFilterData(FILTER_TYPES.TAG));

        if (!Array.isArray(filterData.selected)) {
            filterData.selected = [];
            filterData.excluded = [];
            filterData.bogus = false;
        }

        if (tagId === 'back') {
            filterData.selected.pop();
            filterData.bogus = filterData.selected.length > 0;
        } else {
            filterData.selected.push(tagId);
            filterData.bogus = true;
        }

        entitiesFilter.setFilterData(FILTER_TYPES.TAG, filterData);
    });

    $(document).on('input', '.edit_textarea', function () {
        scroll_holder = $('#chat').scrollTop();
        $(this).height(0).height(this.scrollHeight);
        is_use_scroll_holder = true;
    });
    $('#chat').on('scroll', function () {
        if (is_use_scroll_holder) {
            $('#chat').scrollTop(scroll_holder);
            is_use_scroll_holder = false;
        }
    });

    $(document).on('click', '.mes', function () {
        //when a 'delete message' parent div is clicked
        // and we are in delete mode and del_checkbox is visible
        if (!is_delete_mode || !$(this).children('.del_checkbox').is(':visible')) {
            return;
        }
        $('.mes').children('.del_checkbox').each(function () {
            $(this).prop('checked', false);
            $(this).parent().css('background', css_mes_bg);
        });
        $(this).css('background', '#600'); //sets the bg of the mes selected for deletion
        var i = Number($(this).attr('mesid')); //checks the message ID in the chat
        this_del_mes = i;
        while (i < chat.length) {
            //as long as the current message ID is less than the total chat length
            $('.mes[mesid=\'' + i + '\']').css('background', '#600'); //sets the bg of the all msgs BELOW the selected .mes
            $('.mes[mesid=\'' + i + '\']')
                .children('.del_checkbox')
                .prop('checked', true);
            i++;
            //console.log(i);
        }
    });

    $(document).on('click', '#user_avatar_block .avatar', setUserAvatar);
    $(document).on('click', '#user_avatar_block .avatar_upload', function () {
        $('#avatar_upload_overwrite').val('');
        $('#avatar_upload_file').trigger('click');
    });
    $(document).on('click', '#user_avatar_block .set_persona_image', function () {
        const avatarId = $(this).closest('.avatar-container').find('.avatar').attr('imgfile');

        if (!avatarId) {
            console.log('no imgfile');
            return;
        }

        $('#avatar_upload_overwrite').val(avatarId);
        $('#avatar_upload_file').trigger('click');
    });
    $('#avatar_upload_file').on('change', uploadUserAvatar);

    $(document).on('click', '.PastChat_cross', function (e) {
        e.stopPropagation();
        chat_file_for_del = $(this).attr('file_name');
        console.debug('detected cross click for' + chat_file_for_del);
        popup_type = 'del_chat';
        callPopup('<h3>Delete the Chat File?</h3>');
    });

    $('#advanced_div').click(function () {
        if (!is_advanced_char_open) {
            is_advanced_char_open = true;
            $('#character_popup').css('display', 'flex');
            $('#character_popup').css('opacity', 0.0);
            $('#character_popup').transition({
                opacity: 1.0,
                duration: animation_duration,
                easing: animation_easing,
            });
        } else {
            is_advanced_char_open = false;
            $('#character_popup').css('display', 'none');
        }
    });

    $('#character_cross').click(function () {
        is_advanced_char_open = false;
        $('#character_popup').transition({
            opacity: 0,
            duration: animation_duration,
            easing: animation_easing,
        });
        setTimeout(function () { $('#character_popup').css('display', 'none'); }, animation_duration);
    });

    $('#character_popup_ok').click(function () {
        is_advanced_char_open = false;
        $('#character_popup').css('display', 'none');
    });

    $('#dialogue_popup_ok').click(async function (e) {
        dialogueCloseStop = false;
        $('#shadow_popup').transition({
            opacity: 0,
            duration: animation_duration,
            easing: animation_easing,
        });
        setTimeout(function () {
            if (dialogueCloseStop) return;
            $('#shadow_popup').css('display', 'none');
            $('#dialogue_popup').removeClass('large_dialogue_popup');
            $('#dialogue_popup').removeClass('wide_dialogue_popup');
        }, animation_duration);

        //      $("#shadow_popup").css("opacity:", 0.0);

        if (popup_type == 'avatarToCrop') {
            dialogueResolve($('#avatarToCrop').data('cropper').getCroppedCanvas().toDataURL('image/jpeg'));
        }

        if (popup_type == 'del_chat') {
            //close past chat popup
            $('#select_chat_cross').trigger('click');
            showLoader();
            if (selected_group) {
                await deleteGroupChat(selected_group, chat_file_for_del);
            } else {
                await delChat(chat_file_for_del);
            }

            //open the history view again after 2seconds (delay to avoid edge cases for deleting last chat)
            //hide option popup menu
            setTimeout(function () {
                $('#option_select_chat').click();
                $('#options').hide();
                hideLoader();
            }, 2000);

        }
        if (popup_type == 'del_ch') {
            const deleteChats = !!$('#del_char_checkbox').prop('checked');
            await handleDeleteCharacter(popup_type, this_chid, deleteChats);
            eventSource.emit('characterDeleted', { id: this_chid, character: characters[this_chid] });
        }
        if (popup_type == 'alternate_greeting' && menu_type !== 'create') {
            createOrEditCharacter();
        }
        if (popup_type === 'del_group') {
            const groupId = $('#dialogue_popup').data('group_id');

            if (groupId) {
                deleteGroup(groupId);
            }
        }
        //Make a new chat for selected character
        if (
            popup_type == 'new_chat' &&
            (selected_group || this_chid !== undefined) &&
            menu_type != 'create'
        ) {
            //Fix it; New chat doesn't create while open create character menu
            await clearChat();
            chat.length = 0;

            if (selected_group) {
                await createNewGroupChat(selected_group);
            }
            else {
                //RossAscends: added character name to new chat filenames and replaced Date.now() with humanizedDateTime;
                chat_metadata = {};
                characters[this_chid].chat = `${name2} - ${humanizedDateTime()}`;
                $('#selected_chat_pole').val(characters[this_chid].chat);
                await getChat();
                await createOrEditCharacter();
            }
        }

        rawPromptPopper.update();
        $('#rawPromptPopup').hide();

        if (dialogueResolve) {
            if (popup_type == 'input') {
                dialogueResolve($('#dialogue_popup_input').val());
                $('#dialogue_popup_input').val('');

            }
            else {
                dialogueResolve(true);

            }

            dialogueResolve = null;
        }
    });

    $('#dialogue_popup_cancel').click(function (e) {
        dialogueCloseStop = false;
        $('#shadow_popup').transition({
            opacity: 0,
            duration: animation_duration,
            easing: animation_easing,
        });
        setTimeout(function () {
            if (dialogueCloseStop) return;
            $('#shadow_popup').css('display', 'none');
            $('#dialogue_popup').removeClass('large_dialogue_popup');
        }, animation_duration);

        //$("#shadow_popup").css("opacity:", 0.0);
        popup_type = '';

        if (dialogueResolve) {
            dialogueResolve(false);
            dialogueResolve = null;
        }

    });

    $('#add_avatar_button').change(function () {
        read_avatar_load(this);
    });

    $('#form_create').submit(createOrEditCharacter);

    $('#delete_button').on('click', function () {
        popup_type = 'del_ch';
        callPopup(`
                <h3>Delete the character?</h3>
                <b>THIS IS PERMANENT!<br><br>
                <label for="del_char_checkbox" class="checkbox_label justifyCenter">
                    <input type="checkbox" id="del_char_checkbox" />
                    <span>Also delete the chat files</span>
                </label><br></b>`,
        );
    });

    //////// OPTIMIZED ALL CHAR CREATION/EDITING TEXTAREA LISTENERS ///////////////

    $('#character_name_pole').on('input', function () {
        if (menu_type == 'create') {
            create_save.name = String($('#character_name_pole').val());
        }
    });

    const elementsToUpdate = {
        '#description_textarea': function () { create_save.description = String($('#description_textarea').val()); },
        '#creator_notes_textarea': function () { create_save.creator_notes = String($('#creator_notes_textarea').val()); },
        '#character_version_textarea': function () { create_save.character_version = String($('#character_version_textarea').val()); },
        '#system_prompt_textarea': function () { create_save.system_prompt = String($('#system_prompt_textarea').val()); },
        '#post_history_instructions_textarea': function () { create_save.post_history_instructions = String($('#post_history_instructions_textarea').val()); },
        '#creator_textarea': function () { create_save.creator = String($('#creator_textarea').val()); },
        '#tags_textarea': function () { create_save.tags = String($('#tags_textarea').val()); },
        '#personality_textarea': function () { create_save.personality = String($('#personality_textarea').val()); },
        '#scenario_pole': function () { create_save.scenario = String($('#scenario_pole').val()); },
        '#mes_example_textarea': function () { create_save.mes_example = String($('#mes_example_textarea').val()); },
        '#firstmessage_textarea': function () { create_save.first_message = String($('#firstmessage_textarea').val()); },
        '#talkativeness_slider': function () { create_save.talkativeness = Number($('#talkativeness_slider').val()); },
        '#depth_prompt_prompt': function () { create_save.depth_prompt_prompt = String($('#depth_prompt_prompt').val()); },
        '#depth_prompt_depth': function () { create_save.depth_prompt_depth = Number($('#depth_prompt_depth').val()); },
    };

    Object.keys(elementsToUpdate).forEach(function (id) {
        $(id).on('input', function () {
            if (menu_type == 'create') {
                elementsToUpdate[id]();
            } else {
                saveCharacterDebounced();
            }
        });
    });

    $('#favorite_button').on('click', function () {
        updateFavButtonState(!fav_ch_checked);
        if (menu_type != 'create') {
            saveCharacterDebounced();
        }
    });

    /* $("#renameCharButton").on('click', renameCharacter); */

    $(document).on('click', '.renameChatButton', async function (e) {
        e.stopPropagation();
        const old_filenamefull = $(this).closest('.select_chat_block_wrapper').find('.select_chat_block_filename').text();
        const old_filename = old_filenamefull.replace('.jsonl', '');

        const popupText = `<h3>Enter the new name for the chat:<h3>
        <small>!!Using an existing filename will produce an error!!<br>
        This will break the link between checkpoint chats.<br>
        No need to add '.jsonl' at the end.<br>
        </small>`;
        const newName = await callPopup(popupText, 'input', old_filename);

        if (!newName || newName == old_filename) {
            console.log('no new name found, aborting');
            return;
        }

        const body = {
            is_group: !!selected_group,
            avatar_url: characters[this_chid]?.avatar,
            original_file: `${old_filename}.jsonl`,
            renamed_file: `${newName}.jsonl`,
        };

        try {
            showLoader();
            const response = await fetch('/api/chats/rename', {
                method: 'POST',
                body: JSON.stringify(body),
                headers: getRequestHeaders(),
            });

            if (!response.ok) {
                throw new Error('Unsuccessful request.');
            }

            const data = response.json();

            if (data.error) {
                throw new Error('Server returned an error.');
            }

            if (selected_group) {
                await renameGroupChat(selected_group, old_filename, newName);
            }
            else {
                if (characters[this_chid].chat == old_filename) {
                    characters[this_chid].chat = newName;
                    await createOrEditCharacter();
                }
            }

            await reloadCurrentChat();

            await delay(250);
            $('#option_select_chat').trigger('click');
            $('#options').hide();
        } catch {
            hideLoader();
            await delay(500);
            await callPopup('An error has occurred. Chat was not renamed.', 'text');
        } finally {
            hideLoader();
        }
    });

    $(document).on('click', '.exportChatButton, .exportRawChatButton', async function (e) {
        e.stopPropagation();
        const format = $(this).data('format') || 'txt';
        await saveChatConditional();
        const filenamefull = $(this).closest('.select_chat_block_wrapper').find('.select_chat_block_filename').text();
        console.log(`exporting ${filenamefull} in ${format} format`);

        const filename = filenamefull.replace('.jsonl', '');
        const body = {
            is_group: !!selected_group,
            avatar_url: characters[this_chid]?.avatar,
            file: `${filename}.jsonl`,
            exportfilename: `${filename}.${format}`,
            format: format,
        };
        console.log(body);
        try {
            const response = await fetch('/api/chats/export', {
                method: 'POST',
                body: JSON.stringify(body),
                headers: getRequestHeaders(),
            });
            const data = await response.json();
            if (!response.ok) {
                // display error message
                console.log(data.message);
                await delay(250);
                toastr.error(`Error: ${data.message}`);
                return;
            } else {
                const mimeType = format == 'txt' ? 'text/plain' : 'application/octet-stream';
                // success, handle response data
                console.log(data);
                await delay(250);
                toastr.success(data.message);
                download(data.result, body.exportfilename, mimeType);
            }
        } catch (error) {
            // display error message
            console.log(`An error has occurred: ${error.message}`);
            await delay(250);
            toastr.error(`Error: ${error.message}`);
        }
    });

    ///////////////////////////////////////////////////////////////////////////////////

    $('#api_button').click(function (e) {
        if ($('#api_url_text').val() != '') {
            let value = formatKoboldUrl(String($('#api_url_text').val()).trim());

            if (!value) {
                toastr.error('Please enter a valid URL.');
                return;
            }

            $('#api_url_text').val(value);
            api_server = value;
            startStatusLoading();

            main_api = 'kobold';
            saveSettingsDebounced();
            getStatusKobold();
        }
    });

    $('#api_button_textgenerationwebui').on('click', async function (e) {
        const mancerKey = String($('#api_key_mancer').val()).trim();
        if (mancerKey.length) {
            await writeSecret(SECRET_KEYS.MANCER, mancerKey);
        }

        const aphroditeKey = String($('#api_key_aphrodite').val()).trim();
        if (aphroditeKey.length) {
            await writeSecret(SECRET_KEYS.APHRODITE, aphroditeKey);
        }

        const tabbyKey = String($('#api_key_tabby').val()).trim();
        if (tabbyKey.length) {
            await writeSecret(SECRET_KEYS.TABBY, tabbyKey);
        }

        const togetherKey = String($('#api_key_togetherai').val()).trim();
        if (togetherKey.length) {
            await writeSecret(SECRET_KEYS.TOGETHERAI, togetherKey);
        }

        validateTextGenUrl();
        startStatusLoading();
        main_api = 'textgenerationwebui';
        saveSettingsDebounced();
        getStatusTextgen();
    });

    $('#api_button_novel').on('click', async function (e) {
        e.stopPropagation();
        const api_key_novel = String($('#api_key_novel').val()).trim();

        if (api_key_novel.length) {
            await writeSecret(SECRET_KEYS.NOVEL, api_key_novel);
        }

        if (!secret_state[SECRET_KEYS.NOVEL]) {
            console.log('No secret key saved for NovelAI');
            return;
        }

        startStatusLoading();
        // Check near immediately rather than waiting for up to 90s
        await getStatusNovel();
    });

    var button = $('#options_button');
    var menu = $('#options');

    function showMenu() {
        showBookmarksButtons();
        // menu.stop()
        menu.fadeIn(animation_duration);
        optionsPopper.update();
    }

    function hideMenu() {
        // menu.stop();
        menu.fadeOut(animation_duration);
        optionsPopper.update();
    }

    function isMouseOverButtonOrMenu() {
        return menu.is(':hover') || button.is(':hover');
    }

    button.on('click', function () {
        if (menu.is(':visible')) {
            hideMenu();
        } else {
            showMenu();
        }
    });
    button.on('blur', function () {
        //delay to prevent menu hiding when mouse leaves button into menu
        setTimeout(() => {
            if (!isMouseOverButtonOrMenu()) { hideMenu(); }
        }, 100);
    });
    menu.on('blur', function () {
        //delay to prevent menu hide when mouseleaves menu into button
        setTimeout(() => {
            if (!isMouseOverButtonOrMenu()) { hideMenu(); }
        }, 100);
    });
    $(document).on('click', function () {
        if (!isMouseOverButtonOrMenu() && menu.is(':visible')) { hideMenu(); }
    });

    /* $('#set_chat_scenario').on('click', setScenarioOverride); */

    ///////////// OPTIMIZED LISTENERS FOR LEFT SIDE OPTIONS POPUP MENU //////////////////////
    $('#options [id]').on('click', async function (event, customData) {
        const fromSlashCommand = customData?.fromSlashCommand || false;
        var id = $(this).attr('id');

        if (id == 'option_select_chat') {
            if ((selected_group && !is_group_generating) || (this_chid !== undefined && !is_send_press) || fromSlashCommand) {
                displayPastChats();
                //this is just to avoid the shadow for past chat view when using /delchat
                //however, the dialog popup still gets one..
                if (!fromSlashCommand) {
                    console.log('displaying shadow');
                    $('#shadow_select_chat_popup').css('display', 'block');
                    $('#shadow_select_chat_popup').css('opacity', 0.0);
                    $('#shadow_select_chat_popup').transition({
                        opacity: 1.0,
                        duration: animation_duration,
                        easing: animation_easing,
                    });
                }
            }
        }

        else if (id == 'option_start_new_chat') {
            if ((selected_group || this_chid !== undefined) && !is_send_press) {
                popup_type = 'new_chat';
                callPopup('<h3>Start new chat?</h3>');
            }
        }

        else if (id == 'option_regenerate') {
            closeMessageEditor();
            if (is_send_press == false) {
                //hideSwipeButtons();

                if (selected_group) {
                    regenerateGroup();
                }
                else {
                    is_send_press = true;
                    Generate('regenerate');
                }
            }
        }

        else if (id == 'option_impersonate') {
            if (is_send_press == false || fromSlashCommand) {
                is_send_press = true;
                Generate('impersonate');
            }
        }

        else if (id == 'option_continue') {
            if (is_send_press == false || fromSlashCommand) {
                is_send_press = true;
                Generate('continue');
            }
        }

        else if (id == 'option_delete_mes') {
            setTimeout(() => openMessageDelete(fromSlashCommand), animation_duration);
        }

        else if (id == 'option_close_chat') {
            if (is_send_press == false) {
                await clearChat();
                chat.length = 0;
                resetSelectedGroup();
                setCharacterId(undefined);
                setCharacterName('');
                setActiveCharacter(null);
                setActiveGroup(null);
                this_edit_mes_id = undefined;
                chat_metadata = {};
                selected_button = 'characters';
                $('#rm_button_selected_ch').children('h2').text('');
                select_rm_characters();
                sendSystemMessage(system_message_types.WELCOME);
                eventSource.emit(event_types.CHAT_CHANGED, getCurrentChatId());
                await getClientVersion();
            } else {
                toastr.info('Please stop the message generation first.');
            }
        }

        else if (id === 'option_settings') {
            //var checkBox = document.getElementById("waifuMode");
            var topBar = document.getElementById('top-bar');
            var topSettingsHolder = document.getElementById('top-settings-holder');
            var divchat = document.getElementById('chat');

            //if (checkBox.checked) {
            if (topBar.style.display === 'none') {
                topBar.style.display = ''; // or "inline-block" if that's the original display value
                topSettingsHolder.style.display = ''; // or "inline-block" if that's the original display value

                divchat.style.borderRadius = '';
                divchat.style.backgroundColor = '';

            } else {

                divchat.style.borderRadius = '10px'; // Adjust the value to control the roundness of the corners
                divchat.style.backgroundColor = ''; // Set the background color to your preference

                topBar.style.display = 'none';
                topSettingsHolder.style.display = 'none';
            }
            //}
        }
        hideMenu();
    });

    $('#newChatFromManageScreenButton').on('click', function () {
        setTimeout(() => {
            $('#option_start_new_chat').trigger('click');
        }, 1);
        setTimeout(() => {
            $('#dialogue_popup_ok').trigger('click');
        }, 1);
        $('#select_chat_cross').trigger('click');

    });

    //////////////////////////////////////////////////////////////////////////////////////////////

    //functionality for the cancel delete messages button, reverts to normal display of input form
    $('#dialogue_del_mes_cancel').click(function () {
        $('#dialogue_del_mes').css('display', 'none');
        $('#send_form').css('display', css_send_form_display);
        $('.del_checkbox').each(function () {
            $(this).css('display', 'none');
            $(this).parent().children('.for_checkbox').css('display', 'block');
            $(this).parent().css('background', css_mes_bg);
            $(this).prop('checked', false);
        });
        showSwipeButtons();
        this_del_mes = -1;
        is_delete_mode = false;
    });

    //confirms message deletion with the "ok" button
    $('#dialogue_del_mes_ok').click(async function () {
        $('#dialogue_del_mes').css('display', 'none');
        $('#send_form').css('display', css_send_form_display);
        $('.del_checkbox').each(function () {
            $(this).css('display', 'none');
            $(this).parent().children('.for_checkbox').css('display', 'block');
            $(this).parent().css('background', css_mes_bg);
            $(this).prop('checked', false);
        });

        if (this_del_mes >= 0) {
            $('.mes[mesid=\'' + this_del_mes + '\']')
                .nextAll('div')
                .remove();
            $('.mes[mesid=\'' + this_del_mes + '\']').remove();
            chat.length = this_del_mes;
            count_view_mes = this_del_mes;
            await saveChatConditional();
            var $textchat = $('#chat');
            $textchat.scrollTop($textchat[0].scrollHeight);
            eventSource.emit(event_types.MESSAGE_DELETED, chat.length);
            $('#chat .mes').last().addClass('last_mes');
            $('#chat .mes').eq(-2).removeClass('last_mes');
        } else {
            console.log('this_del_mes is not >= 0, not deleting');
        }

        showSwipeButtons();
        this_del_mes = -1;
        is_delete_mode = false;
    });

    $('#settings_preset').change(function () {
        if ($('#settings_preset').find(':selected').val() != 'gui') {
            preset_settings = $('#settings_preset').find(':selected').text();
            const preset = koboldai_settings[koboldai_setting_names[preset_settings]];
            loadKoboldSettings(preset);
            setGenerationParamsFromPreset(preset);
            $('#kobold_api-settings').find('input').prop('disabled', false);
            $('#kobold_api-settings').css('opacity', 1.0);
            $('#kobold_order')
                .css('opacity', 1)
                .sortable('enable');
        } else {
            //$('.button').disableSelection();
            preset_settings = 'gui';

            $('#kobold_api-settings').find('input').prop('disabled', true);
            $('#kobold_api-settings').css('opacity', 0.5);

            $('#kobold_order')
                .css('opacity', 0.5)
                .sortable('disable');
        }
        saveSettingsDebounced();
    });

    $('#settings_preset_novel').change(function () {
        nai_settings.preset_settings_novel = $('#settings_preset_novel')
            .find(':selected')
            .text();

        const preset = novelai_settings[novelai_setting_names[nai_settings.preset_settings_novel]];
        loadNovelPreset(preset);
        amount_gen = Number($('#amount_gen').val());
        max_context = Number($('#max_context').val());

        saveSettingsDebounced();
    });

    $('#main_api').change(function () {
        cancelStatusCheck();
        changeMainAPI();
        saveSettingsDebounced();
    });

    ////////////////// OPTIMIZED RANGE SLIDER LISTENERS////////////////

    var sliderLocked = true;
    var sliderTimer;

    $('input[type=\'range\']').on('touchstart', function () {
        // Unlock the slider after 300ms
        setTimeout(function () {
            sliderLocked = false;
            $(this).css('background-color', 'var(--SmartThemeQuoteColor)');
        }.bind(this), 300);
    });

    $('input[type=\'range\']').on('touchend', function () {
        clearTimeout(sliderTimer);
        $(this).css('background-color', '');
        sliderLocked = true;
    });

    $('input[type=\'range\']').on('touchmove', function (event) {
        if (sliderLocked) {
            event.preventDefault();
        }
    });

    const sliders = [
        {
            sliderId: '#amount_gen',
            counterId: '#amount_gen_counter',
            format: (val) => `${val}`,
            setValue: (val) => { amount_gen = Number(val); },
        },
        {
            sliderId: '#max_context',
            counterId: '#max_context_counter',
            format: (val) => `${val}`,
            setValue: (val) => { max_context = Number(val); },
        },
    ];

    sliders.forEach(slider => {
        $(document).on('input', slider.sliderId, function () {
            const value = $(this).val();
            const formattedValue = slider.format(value);
            slider.setValue(value);
            $(slider.counterId).val(formattedValue);
            saveSettingsDebounced();
        });
    });

    //////////////////////////////////////////////////////////////

    $('#select_chat_cross').click(function () {
        $('#shadow_select_chat_popup').transition({
            opacity: 0,
            duration: animation_duration,
            easing: animation_easing,
        });
        setTimeout(function () { $('#shadow_select_chat_popup').css('display', 'none'); }, animation_duration);
        //$("#shadow_select_chat_popup").css("display", "none");
        $('#load_select_chat_div').css('display', 'block');
    });

    if (navigator.clipboard === undefined) {
        // No clipboard support
        $('.mes_copy').remove();
    }
    else {
        $(document).on('pointerup', '.mes_copy', function () {
            if (this_chid !== undefined || selected_group) {
                const message = $(this).closest('.mes');

                if (message.data('isSystem')) {
                    return;
                }
                try {
                    var edit_mes_id = $(this).closest('.mes').attr('mesid');
                    var text = chat[edit_mes_id]['mes'];
                    navigator.clipboard.writeText(text);
                    toastr.info('Copied!', '', { timeOut: 2000 });
                } catch (err) {
                    console.error('Failed to copy: ', err);
                }
            }
        });
    }

    $(document).on('pointerup', '.mes_prompt', function () {
        let mesIdForItemization = $(this).closest('.mes').attr('mesId');
        console.log(`looking for mesID: ${mesIdForItemization}`);
        if (itemizedPrompts.length !== undefined && itemizedPrompts.length !== 0) {
            promptItemize(itemizedPrompts, mesIdForItemization);
        }
    });

    $(document).on('pointerup', '#copyPromptToClipboard', function () {
        let rawPrompt = itemizedPrompts[PromptArrayItemForRawPromptDisplay].rawPrompt;
        let rawPromptValues = rawPrompt;

        if (Array.isArray(rawPrompt)) {
            rawPromptValues = rawPrompt.map(x => x.content).join('\n');
        }

        navigator.clipboard.writeText(rawPromptValues);
        toastr.info('Copied!', '', { timeOut: 2000 });
    });

    $(document).on('pointerup', '#showRawPrompt', function () {
        //console.log(itemizedPrompts[PromptArrayItemForRawPromptDisplay].rawPrompt);
        console.log(PromptArrayItemForRawPromptDisplay);
        console.log(itemizedPrompts);
        console.log(itemizedPrompts[PromptArrayItemForRawPromptDisplay].rawPrompt);

        let rawPrompt = itemizedPrompts[PromptArrayItemForRawPromptDisplay].rawPrompt;
        let rawPromptValues = rawPrompt;

        if (Array.isArray(rawPrompt)) {
            rawPromptValues = rawPrompt.map(x => x.content).join('\n');
        }

        //let DisplayStringifiedPrompt = JSON.stringify(itemizedPrompts[PromptArrayItemForRawPromptDisplay].rawPrompt).replace(/\n+/g, '<br>');
        $('#rawPromptWrapper').text(rawPromptValues);
        rawPromptPopper.update();
        $('#rawPromptPopup').toggle();
    });

    //********************
    //***Message Editor***
    $(document).on('click', '.mes_edit', async function () {
        if (this_chid !== undefined || selected_group) {
            // Previously system messages we're allowed to be edited
            /*const message = $(this).closest(".mes");

            if (message.data("isSystem")) {
                return;
            }*/

            let chatScrollPosition = $('#chat').scrollTop();
            if (this_edit_mes_id !== undefined) {
                let mes_edited = $(`#chat [mesid="${this_edit_mes_id}"]`).find('.mes_edit_done');
                if (Number(edit_mes_id) == count_view_mes - 1) { //if the generating swipe (...)
                    let run_edit = true;
                    if (chat[edit_mes_id]['swipe_id'] !== undefined) {
                        if (chat[edit_mes_id]['swipes'].length === chat[edit_mes_id]['swipe_id']) {
                            run_edit = false;
                        }
                    }
                    if (run_edit) {
                        hideSwipeButtons();
                    }
                }
                await messageEditDone(mes_edited);
            }
            $(this).closest('.mes_block').find('.mes_text').empty();
            $(this).closest('.mes_block').find('.mes_buttons').css('display', 'none');
            $(this).closest('.mes_block').find('.mes_edit_buttons').css('display', 'inline-flex');
            var edit_mes_id = $(this).closest('.mes').attr('mesid');
            this_edit_mes_id = edit_mes_id;

            var text = chat[edit_mes_id]['mes'];
            if (chat[edit_mes_id]['is_user']) {
                this_edit_mes_chname = name1;
            } else if (chat[edit_mes_id]['force_avatar']) {
                this_edit_mes_chname = chat[edit_mes_id]['name'];
            } else {
                this_edit_mes_chname = name2;
            }
            if (power_user.trim_spaces) {
                text = text.trim();
            }
            $(this)
                .closest('.mes_block')
                .find('.mes_text')
                .append(
                    '<textarea id=\'curEditTextarea\' class=\'edit_textarea\' style=\'max-width:auto;\'></textarea>',
                );
            $('#curEditTextarea').val(text);
            let edit_textarea = $(this)
                .closest('.mes_block')
                .find('.edit_textarea');
            edit_textarea.height(0);
            edit_textarea.height(edit_textarea[0].scrollHeight);
            edit_textarea.focus();
            edit_textarea[0].setSelectionRange(     //this sets the cursor at the end of the text
                edit_textarea.val().length,
                edit_textarea.val().length,
            );
            if (this_edit_mes_id == count_view_mes - 1) {
                $('#chat').scrollTop(chatScrollPosition);
            }

            updateEditArrowClasses();
        }
    });

    $(document).on('input', '#curEditTextarea', function () {
        if (power_user.auto_save_msg_edits === true) {
            messageEditAuto($(this));
        }
    });

    $(document).on('click', '.extraMesButtonsHint', function (e) {
        const elmnt = e.target;
        $(elmnt).transition({
            opacity: 0,
            duration: animation_duration,
            easing: 'ease-in-out',
        });
        setTimeout(function () {
            $(elmnt).hide();
            $(elmnt).siblings('.extraMesButtons').css('opcacity', '0');
            $(elmnt).siblings('.extraMesButtons').css('display', 'flex');
            $(elmnt).siblings('.extraMesButtons').transition({
                opacity: 1,
                duration: animation_duration,
                easing: 'ease-in-out',
            });
        }, animation_duration);
    });

    $(document).on('click', function (e) {
        // Expanded options don't need to be closed
        if (power_user.expand_message_actions) {
            return;
        }

        // Check if the click was outside the relevant elements
        if (!$(e.target).closest('.extraMesButtons, .extraMesButtonsHint').length) {
            // Transition out the .extraMesButtons first
            $('.extraMesButtons:visible').transition({
                opacity: 0,
                duration: animation_duration,
                easing: 'ease-in-out',
                complete: function () {
                    $(this).hide(); // Hide the .extraMesButtons after the transition

                    // Transition the .extraMesButtonsHint back in
                    $('.extraMesButtonsHint:not(:visible)').show().transition({
                        opacity: .3,
                        duration: animation_duration,
                        easing: 'ease-in-out',
                        complete: function () {
                            $(this).css('opacity', '');
                        },
                    });
                },
            });
        }
    });

    $(document).on('click', '.mes_edit_cancel', function () {
        let text = chat[this_edit_mes_id]['mes'];

        $(this).closest('.mes_block').find('.mes_text').empty();
        $(this).closest('.mes_edit_buttons').css('display', 'none');
        $(this).closest('.mes_block').find('.mes_buttons').css('display', '');
        $(this)
            .closest('.mes_block')
            .find('.mes_text')
            .append(messageFormatting(
                text,
                this_edit_mes_chname,
                chat[this_edit_mes_id].is_system,
                chat[this_edit_mes_id].is_user,
            ));
        appendMediaToMessage(chat[this_edit_mes_id], $(this).closest('.mes'));
        addCopyToCodeBlocks($(this).closest('.mes'));
        this_edit_mes_id = undefined;
    });

    $(document).on('click', '.mes_edit_up', async function () {
        if (is_send_press || this_edit_mes_id <= 0) {
            return;
        }

        hideSwipeButtons();
        const targetId = Number(this_edit_mes_id) - 1;
        const target = $(`#chat .mes[mesid="${targetId}"]`);
        const root = $(this).closest('.mes');

        if (root.length === 0 || target.length === 0) {
            return;
        }

        root.insertBefore(target);

        target.attr('mesid', this_edit_mes_id);
        root.attr('mesid', targetId);

        const temp = chat[targetId];
        chat[targetId] = chat[this_edit_mes_id];
        chat[this_edit_mes_id] = temp;

        this_edit_mes_id = targetId;
        updateViewMessageIds();
        await saveChatConditional();
        showSwipeButtons();
    });

    $(document).on('click', '.mes_edit_down', async function () {
        if (is_send_press || this_edit_mes_id >= chat.length - 1) {
            return;
        }

        hideSwipeButtons();
        const targetId = Number(this_edit_mes_id) + 1;
        const target = $(`#chat .mes[mesid="${targetId}"]`);
        const root = $(this).closest('.mes');

        if (root.length === 0 || target.length === 0) {
            return;
        }

        root.insertAfter(target);

        target.attr('mesid', this_edit_mes_id);
        root.attr('mesid', targetId);

        const temp = chat[targetId];
        chat[targetId] = chat[this_edit_mes_id];
        chat[this_edit_mes_id] = temp;

        this_edit_mes_id = targetId;
        updateViewMessageIds();
        await saveChatConditional();
        showSwipeButtons();
    });

    $(document).on('click', '.mes_edit_copy', async function () {
        const confirmation = await callPopup('Create a copy of this message?', 'confirm');
        if (!confirmation) {
            return;
        }

        hideSwipeButtons();
        let oldScroll = $('#chat')[0].scrollTop;
        const clone = JSON.parse(JSON.stringify(chat[this_edit_mes_id])); // quick and dirty clone
        clone.send_date = Date.now();
        clone.mes = $(this).closest('.mes').find('.edit_textarea').val();

        if (power_user.trim_spaces) {
            clone.mes = clone.mes.trim();
        }

        chat.splice(Number(this_edit_mes_id) + 1, 0, clone);
        addOneMessage(clone, { insertAfter: this_edit_mes_id });

        updateViewMessageIds();
        await saveChatConditional();
        $('#chat')[0].scrollTop = oldScroll;
        showSwipeButtons();
    });

    $(document).on('click', '.mes_edit_delete', async function (event, customData) {
        const fromSlashCommand = customData?.fromSlashCommand || false;
        const swipeExists = (!Array.isArray(chat[this_edit_mes_id].swipes) || chat[this_edit_mes_id].swipes.length <= 1 || chat[this_edit_mes_id].is_user || parseInt(this_edit_mes_id) !== chat.length - 1);
        if (power_user.confirm_message_delete && fromSlashCommand !== true) {
            const confirmation = swipeExists ? await callPopup('Are you sure you want to delete this message?', 'confirm')
                : await callPopup('<h3>Delete this...</h3> <select id=\'del_type\'><option value=\'swipe\'>Swipe</option><option value=\'message\'>Message</option></select>', 'confirm');
            if (!confirmation) {
                return;
            }
        }

        const mes = $(this).closest('.mes');

        if (!mes) {
            return;
        }

        if ($('#del_type').val() === 'swipe') {
            const swipe_id = chat[this_edit_mes_id]['swipe_id'];
            chat[this_edit_mes_id]['swipes'].splice(swipe_id, 1);
            if (swipe_id > 0) {
                $('.swipe_left:last').click();
            } else {
                $('.swipe_right:last').click();
            }
        } else {
            chat.splice(this_edit_mes_id, 1);
            mes.remove();
            count_view_mes--;
        }

        let startFromZero = Number(this_edit_mes_id) === 0;

        this_edit_mes_id = undefined;

        updateViewMessageIds(startFromZero);
        saveChatDebounced();

        hideSwipeButtons();
        showSwipeButtons();

        await eventSource.emit(event_types.MESSAGE_DELETED, count_view_mes);
    });

    $(document).on('click', '.mes_edit_done', async function () {
        await messageEditDone($(this));
    });

    $('#your_name_button').click(async function () {
        const userName = String($('#your_name').val()).trim();
        setUserName(userName);
        await updatePersonaNameIfExists(user_avatar, userName);
    });

    $('#sync_name_button').on('click', async function () {
        const confirmation = await callPopup(`<h3>Are you sure?</h3>All user-sent messages in this chat will be attributed to ${name1}.`, 'confirm');

        if (!confirmation) {
            return;
        }

        for (const mes of chat) {
            if (mes.is_user) {
                mes.name = name1;
                mes.force_avatar = getUserAvatar(user_avatar);
            }
        }

        await saveChatConditional();
        await reloadCurrentChat();
    });
    //Select chat

    //**************************CHARACTER IMPORT EXPORT*************************//
    $('#character_import_button').click(function () {
        $('#character_import_file').click();
    });

    $('#character_import_file').on('change', function (e) {
        $('#rm_info_avatar').html('');
        if (!e.target.files.length) {
            return;
        }

        for (const file of e.target.files) {
            importCharacter(file);
        }
    });

    $('#export_button').on('click', function (e) {
        $('#export_format_popup').toggle();
        exportPopper.update();
    });

    $(document).on('click', '.export_format', async function () {
        const format = $(this).data('format');

        if (!format) {
            return;
        }

        // Save before exporting
        await createOrEditCharacter();
        const body = { format, avatar_url: characters[this_chid].avatar };

        const response = await fetch('/api/characters/export', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(body),
        });

        if (response.ok) {
            const filename = characters[this_chid].avatar.replace('.png', `.${format}`);
            const blob = await response.blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.setAttribute('download', filename);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }


        $('#export_format_popup').hide();
    });
    //**************************CHAT IMPORT EXPORT*************************//
    $('#chat_import_button').click(function () {
        $('#chat_import_file').click();
    });

    $('#chat_import_file').on('change', async function (e) {
        var file = e.target.files[0];

        if (!file) {
            return;
        }

        var ext = file.name.match(/\.(\w+)$/);
        if (
            !ext ||
            (ext[1].toLowerCase() != 'json' && ext[1].toLowerCase() != 'jsonl')
        ) {
            return;
        }

        if (selected_group && file.name.endsWith('.json')) {
            toastr.warning('Only SillyTavern\'s own format is supported for group chat imports. Sorry!');
            return;
        }

        var format = ext[1].toLowerCase();
        $('#chat_import_file_type').val(format);

        var formData = new FormData($('#form_import_chat').get(0));
        formData.append('user_name', name1);
        $('#select_chat_div').html('');
        $('#load_select_chat_div').css('display', 'block');

        if (selected_group) {
            await importGroupChat(formData);
        } else {
            await importCharacterChat(formData);
        }
    });

    $('#rm_button_group_chats').click(function () {
        selected_button = 'group_chats';
        select_group_chats();
    });

    $('#rm_button_back_from_group').click(function () {
        selected_button = 'characters';
        select_rm_characters();
    });

    $('#dupe_button').click(async function () {
        await DupeChar();
    });

    $(document).on('click', '.select_chat_block, .bookmark_link, .mes_bookmark', async function () {
        let file_name = $(this).hasClass('mes_bookmark')
            ? $(this).closest('.mes').attr('bookmark_link')
            : $(this).attr('file_name').replace('.jsonl', '');

        if (!file_name) {
            return;
        }

        try {
            showLoader();
            if (selected_group) {
                await openGroupChat(selected_group, file_name);
            } else {
                await openCharacterChat(file_name);
            }
        } finally {
            hideLoader();
        }

        $('#shadow_select_chat_popup').css('display', 'none');
        $('#load_select_chat_div').css('display', 'block');
    });

    $(document).on('click', '.mes_create_bookmark', async function () {
        var selected_mes_id = $(this).closest('.mes').attr('mesid');
        if (selected_mes_id !== undefined) {
            createNewBookmark(selected_mes_id);
        }
    });

    $(document).on('click', '.mes_create_branch', async function () {
        var selected_mes_id = $(this).closest('.mes').attr('mesid');
        if (selected_mes_id !== undefined) {
            branchChat(selected_mes_id);
        }
    });

    $(document).on('click', '.mes_stop', function () {
        if (streamingProcessor) {
            streamingProcessor.onStopStreaming();
            streamingProcessor = null;
        }
        if (abortController) {
            abortController.abort();
            hideStopButton();
        }
        eventSource.emit(event_types.GENERATION_STOPPED);
        activateSendButtons();
    });

    $('.drawer-toggle').on('click', function () {
        var icon = $(this).find('.drawer-icon');
        var drawer = $(this).parent().find('.drawer-content');
        if (drawer.hasClass('resizing')) { return; }
        var drawerWasOpenAlready = $(this).parent().find('.drawer-content').hasClass('openDrawer');
        let targetDrawerID = $(this).parent().find('.drawer-content').attr('id');
        const pinnedDrawerClicked = drawer.hasClass('pinnedOpen');

        if (!drawerWasOpenAlready) { //to open the drawer
            $('.openDrawer').not('.pinnedOpen').addClass('resizing').slideToggle(200, 'swing', async function () {
                await delay(50); $(this).closest('.drawer-content').removeClass('resizing');
            });
            $('.openIcon').toggleClass('closedIcon openIcon');
            $('.openDrawer').not('.pinnedOpen').toggleClass('closedDrawer openDrawer');
            icon.toggleClass('openIcon closedIcon');
            drawer.toggleClass('openDrawer closedDrawer');

            //console.log(targetDrawerID);
            if (targetDrawerID === 'right-nav-panel') {
                $(this).closest('.drawer').find('.drawer-content').addClass('resizing').slideToggle({
                    duration: 200,
                    easing: 'swing',
                    start: function () {
                        jQuery(this).css('display', 'flex'); //flex needed to make charlist scroll
                    },
                    complete: async function () {
                        favsToHotswap();
                        await delay(50);
                        $(this).closest('.drawer-content').removeClass('resizing');
                        $('#rm_print_characters_block').trigger('scroll');
                    },
                });
            } else {
                $(this).closest('.drawer').find('.drawer-content').addClass('resizing').slideToggle(200, 'swing', async function () {
                    await delay(50); $(this).closest('.drawer-content').removeClass('resizing');
                });
            }

            // Set the height of "autoSetHeight" textareas within the drawer to their scroll height
            $(this).closest('.drawer').find('.drawer-content textarea.autoSetHeight').each(function () {
                resetScrollHeight($(this));
            });

        } else if (drawerWasOpenAlready) { //to close manually
            icon.toggleClass('closedIcon openIcon');

            if (pinnedDrawerClicked) {
                $(drawer).addClass('resizing').slideToggle(200, 'swing', async function () {
                    await delay(50); $(this).removeClass('resizing');
                });
            }
            else {
                $('.openDrawer').not('.pinnedOpen').addClass('resizing').slideToggle(200, 'swing', async function () {
                    await delay(50); $(this).closest('.drawer-content').removeClass('resizing');
                });
            }

            drawer.toggleClass('closedDrawer openDrawer');
        }
    });

    $('html').on('touchstart mousedown', function (e) {
        var clickTarget = $(e.target);

        if ($('#export_format_popup').is(':visible')
            && clickTarget.closest('#export_button').length == 0
            && clickTarget.closest('#export_format_popup').length == 0) {
            $('#export_format_popup').hide();
        }

        const forbiddenTargets = [
            '#character_cross',
            '#avatar-and-name-block',
            '#shadow_popup',
            '#world_popup',
            '.ui-widget',
            '.text_pole',
            '#toast-container',
            '.select2-results',
        ];
        for (const id of forbiddenTargets) {
            if (clickTarget.closest(id).length > 0) {
                return;
            }
        }

        var targetParentHasOpenDrawer = clickTarget.parents('.openDrawer').length;
        if (clickTarget.hasClass('drawer-icon') == false && !clickTarget.hasClass('openDrawer')) {
            if (jQuery.find('.openDrawer').length !== 0) {
                if (targetParentHasOpenDrawer === 0) {
                    //console.log($('.openDrawer').not('.pinnedOpen').length);
                    $('.openDrawer').not('.pinnedOpen').addClass('resizing').slideToggle(200, 'swing', function () {
                        $(this).closest('.drawer-content').removeClass('resizing');
                    });
                    $('.openIcon').toggleClass('closedIcon openIcon');
                    $('.openDrawer').not('.pinnedOpen').toggleClass('closedDrawer openDrawer');

                }
            }
        }
    });

    $(document).on('click', '.inline-drawer-toggle', function (e) {
        if ($(e.target).hasClass('text_pole')) {
            return;
        }
        var icon = $(this).find('.inline-drawer-icon');
        icon.toggleClass('down up');
        icon.toggleClass('fa-circle-chevron-down fa-circle-chevron-up');
        $(this).closest('.inline-drawer').find('.inline-drawer-content').stop().slideToggle();

        // Set the height of "autoSetHeight" textareas within the inline-drawer to their scroll height
        $(this).closest('.inline-drawer').find('.inline-drawer-content textarea.autoSetHeight').each(function () {
            resetScrollHeight($(this));
        });
    });

    $(document).on('click', '.mes .avatar', function () {
        const messageElement = $(this).closest('.mes');
        const thumbURL = $(this).children('img').attr('src');
        const charsPath = '/characters/';
        const targetAvatarImg = thumbURL.substring(thumbURL.lastIndexOf('=') + 1);
        const charname = targetAvatarImg.replace('.png', '');
        const isValidCharacter = characters.some(x => x.avatar === decodeURIComponent(targetAvatarImg));

        // Remove existing zoomed avatars for characters that are not the clicked character when moving UI is not enabled
        if (!power_user.movingUI) {
            $('.zoomed_avatar').each(function () {
                const currentForChar = $(this).attr('forChar');
                if (currentForChar !== charname && typeof currentForChar !== 'undefined') {
                    console.debug(`Removing zoomed avatar for character: ${currentForChar}`);
                    $(this).remove();
                }
            });
        }

        const avatarSrc = isDataURL(thumbURL) ? thumbURL : charsPath + targetAvatarImg;
        if ($(`.zoomed_avatar[forChar="${charname}"]`).length) {
            console.debug('removing container as it already existed');
            $(`.zoomed_avatar[forChar="${charname}"]`).remove();
        } else {
            console.debug('making new container from template');
            const template = $('#zoomed_avatar_template').html();
            const newElement = $(template);
            newElement.attr('forChar', charname);
            newElement.attr('id', `zoomFor_${charname}`);
            newElement.addClass('draggable');
            newElement.find('.drag-grabber').attr('id', `zoomFor_${charname}header`);

            $('body').append(newElement);
            if (messageElement.attr('is_user') == 'true') { //handle user avatars
                $(`.zoomed_avatar[forChar="${charname}"] img`).attr('src', thumbURL);
            } else if (messageElement.attr('is_system') == 'true' && !isValidCharacter) { //handle system avatars
                $(`.zoomed_avatar[forChar="${charname}"] img`).attr('src', thumbURL);
            } else if (messageElement.attr('is_user') == 'false') { //handle char avatars
                $(`.zoomed_avatar[forChar="${charname}"] img`).attr('src', avatarSrc);
            }
            loadMovingUIState();
            $(`.zoomed_avatar[forChar="${charname}"]`).css('display', 'block');
            dragElement(newElement);

            $(`.zoomed_avatar[forChar="${charname}"] img`).on('dragstart', (e) => {
                console.log('saw drag on avatar!');
                e.preventDefault();
                return false;
            });
        }
    });

    $(document).on('click', '#OpenAllWIEntries', function () {
        $('#world_popup_entries_list').children().find('.down').click();
    });
    $(document).on('click', '#CloseAllWIEntries', function () {
        $('#world_popup_entries_list').children().find('.up').click();
    });
    $(document).on('click', '.open_alternate_greetings', openAlternateGreetings);
    /* $('#set_character_world').on('click', openCharacterWorldPopup); */

    $(document).keyup(function (e) {
        if (e.key === 'Escape') {
            if (power_user.auto_save_msg_edits === false) {
                closeMessageEditor();
                $('#send_textarea').focus();
            }
            if (power_user.auto_save_msg_edits === true) {
                $(`#chat .mes[mesid="${this_edit_mes_id}"] .mes_edit_done`).click();
                $('#send_textarea').focus();
            }
            if (!this_edit_mes_id && $('#mes_stop').is(':visible')) {
                $('#mes_stop').trigger('click');
                if (chat.length && Array.isArray(chat[chat.length - 1].swipes) && chat[chat.length - 1].swipe_id == chat[chat.length - 1].swipes.length) {
                    $('.last_mes .swipe_left').trigger('click');
                }
            }
        }
    });

    $('#char-management-dropdown').on('change', async (e) => {
        let target = $(e.target.selectedOptions).attr('id');
        switch (target) {
            case 'set_character_world':
                openCharacterWorldPopup();
                break;
            case 'set_chat_scenario':
                setScenarioOverride();
                break;
            case 'renameCharButton':
                renameCharacter();
                break;
            /*case 'dupe_button':
                DupeChar();
                break;
            case 'export_button':
                $('#export_format_popup').toggle();
                exportPopper.update();
                break;
            */
            case 'import_character_info':
                await importEmbeddedWorldInfo();
                saveCharacterDebounced();
                break;
            /*case 'delete_button':
                popup_type = "del_ch";
                callPopup(`
                        <h3>Delete the character?</h3>
                        <b>THIS IS PERMANENT!<br><br>
                        THIS WILL ALSO DELETE ALL<br>
                        OF THE CHARACTER'S CHAT FILES.<br><br></b>`
                );
                break;*/
            default:
                eventSource.emit('charManagementDropdown', target);
        }
        $('#char-management-dropdown').prop('selectedIndex', 0);
    });

    $(document).on('click', '.mes_img_enlarge', enlargeMessageImage);
    $(document).on('click', '.mes_img_delete', deleteMessageImage);

    $(window).on('beforeunload', () => {
        cancelTtsPlay();
        if (streamingProcessor) {
            console.log('Page reloaded. Aborting streaming...');
            streamingProcessor.onStopStreaming();
        }
    });


    var isManualInput = false;
    var valueBeforeManualInput;

    $('.range-block-counter input, .neo-range-input').on('click', function () {
        valueBeforeManualInput = $(this).val();
        console.log(valueBeforeManualInput);
    })
        .on('change', function (e) {
            e.target.focus();
            e.target.dispatchEvent(new Event('keyup'));
        })
        .on('keydown', function (e) {
            const masterSelector = '#' + $(this).data('for');
            const masterElement = $(masterSelector);
            if (e.key === 'Enter') {
                let manualInput = parseFloat($(this).val());
                if (isManualInput) {
                    //disallow manual inputs outside acceptable range
                    if (manualInput >= $(this).attr('min') && manualInput <= $(this).attr('max')) {
                        //if value is ok, assign to slider and update handle text and position
                        //newSlider.val(manualInput)
                        //handleSlideEvent.call(newSlider, null, { value: parseFloat(manualInput) }, 'manual');
                        valueBeforeManualInput = manualInput;
                        $(masterElement).val($(this).val()).trigger('input');
                    } else {
                        //if value not ok, warn and reset to last known valid value
                        toastr.warning(`Invalid value. Must be between ${$(this).attr('min')} and ${$(this).attr('max')}`);
                        console.log(valueBeforeManualInput);
                        //newSlider.val(valueBeforeManualInput)
                        $(this).val(valueBeforeManualInput);
                    }
                }
            }
        })
        .on('keyup', function () {
            valueBeforeManualInput = $(this).val();
            console.log(valueBeforeManualInput);
            isManualInput = true;
        })
        //trigger slider changes when user clicks away
        .on('mouseup blur', function () {
            const masterSelector = '#' + $(this).data('for');
            const masterElement = $(masterSelector);
            let manualInput = parseFloat($(this).val());
            if (isManualInput) {
                //if value is between correct range for the slider
                if (manualInput >= $(this).attr('min') && manualInput <= $(this).attr('max')) {
                    valueBeforeManualInput = manualInput;
                    //set the slider value to input value
                    $(masterElement).val($(this).val()).trigger('input');
                } else {
                    //if value not ok, warn and reset to last known valid value
                    toastr.warning(`Invalid value. Must be between ${$(this).attr('min')} and ${$(this).attr('max')}`);
                    console.log(valueBeforeManualInput);
                    $(this).val(valueBeforeManualInput);
                }
            }
            isManualInput = false;
        });
    /*
        let manualInputTimeout;
             .on('input', '.range-block-counter input, .neo-range-input', function () {
            clearTimeout(manualInputTimeout);
            manualInputTimeout = setTimeout(() => {
                const caretPosition = saveCaretPosition($(this).get(0));
                const myText = $(this).val().trim();
                $(this).val(myText); // trim line breaks and spaces
                const masterSelector = $(this).data('for');
                const masterElement = document.getElementById(masterSelector);

                if (masterElement == null) {
                    console.error('Master input element not found for the editable label', masterSelector);
                    return;
                }

                const myValue = Number(myText);
                const masterStep = Number(masterElement.getAttribute('step'))
                const masterMin = Number($(masterElement).attr('min'));
                const masterMax = Number($(masterElement).attr('max'));
                const rawStepCompare = myValue / masterStep
                const closestStep = Math.round(rawStepCompare)
                const closestStepRaw = (closestStep) * masterStep

                //yolo anything for Lab Mode
                if (power_user.enableLabMode) {
                    //console.log($(masterElement).attr('id'), myValue)
                    $(masterElement).val(myValue).trigger('input')
                    return
                }

                //if text box val is not a number, reset slider val to its previous and wait for better input
                if (Number.isNaN(myValue)) {
                    console.warn('Label input is not a valid number. Resetting the value to match slider', myText);
                    $(masterElement).trigger('input');
                    restoreCaretPosition($(this).get(0), caretPosition);
                    return;
                }

                //if textbox val is less than min, set slider to min
                //PROBLEM: the moment slider gets set to min, textbox also auto-sets to min.
                //if min = 0, this prevents further typing and locks input at 0 unless users pastes
                //a multi-character number which is between min and max. adding delay was necessary.
                if (myValue < masterMin) {
                    console.warn('Label input is less than minimum.', myText, '<', masterMin);
                    $(masterElement).val(masterMin).trigger('input').trigger('mouseup');
                    $(masterElement).val(myValue)
                    restoreCaretPosition($(this).get(0), caretPosition);
                    return;
                }
                //Same as above but in reverse. Not a problem because max value has multiple
                //characters which can be edited.
                if (myValue > masterMax) {
                    console.warn('Label input is more than maximum.', myText, '>', masterMax);
                    $(masterElement).val(masterMax).trigger('input').trigger('mouseup');
                    $(masterElement).val(myValue)
                    restoreCaretPosition($(this).get(0), caretPosition);
                    return;
                }

                //round input value to nearest step if between min and max
                if (!(myValue < masterMin) && !(myValue > masterMax)) {
                    console.debug(`Label value ${myText} is OK, setting slider to closest step (${closestStepRaw})`);
                    $(masterElement).val(closestStepRaw).trigger('input').trigger('mouseup');
                    restoreCaretPosition($(this).get(0), caretPosition);
                    return;
                }

                restoreCaretPosition($(this).get(0), caretPosition);
            }, 2000); */
    //});

    $('.user_stats_button').on('click', function () {
        userStatsHandler();
    });

    $('#external_import_button').on('click', async () => {
        const html = `<h3>Enter the URL of the content to import</h3>
        Supported sources:<br>
        <ul class="justifyLeft">
            <li>Chub characters (direct link or id)<br>Example: <tt>Anonymous/example-character</tt></li>
            <li>Chub lorebooks (direct link or id)<br>Example: <tt>lorebooks/bartleby/example-lorebook</tt></li>
            <li>JanitorAI character (direct link or id)<br>Example: <tt>https://janitorai.com/characters/ddd1498a-a370-4136-b138-a8cd9461fdfe_character-aqua-the-useless-goddess</tt></li>
            <li>More coming soon...</li>
        <ul>`;
        const input = await callPopup(html, 'input', '', { okButton: 'Import', rows: 4 });

        if (!input) {
            console.debug('Custom content import cancelled');
            return;
        }

        const url = input.trim();
        console.debug('Custom content import started', url);

        const request = await fetch('/api/content/import', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ url }),
        });

        if (!request.ok) {
            toastr.info(request.statusText, 'Custom content import failed');
            console.error('Custom content import failed', request.status, request.statusText);
            return;
        }

        const data = await request.blob();
        const customContentType = request.headers.get('X-Custom-Content-Type');
        const fileName = request.headers.get('Content-Disposition').split('filename=')[1].replace(/"/g, '');
        const file = new File([data], fileName, { type: data.type });

        switch (customContentType) {
            case 'character':
                await processDroppedFiles([file]);
                break;
            case 'lorebook':
                await importWorldInfo(file);
                break;
            default:
                toastr.warning('Unknown content type');
                console.error('Unknown content type', customContentType);
                break;
        }
    });

    const $dropzone = $(document.body);

    $dropzone.on('dragover', (event) => {
        event.preventDefault();
        event.stopPropagation();
        $dropzone.addClass('dragover');
    });

    $dropzone.on('dragleave', (event) => {
        event.preventDefault();
        event.stopPropagation();
        $dropzone.removeClass('dragover');
    });

    $dropzone.on('drop', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        $dropzone.removeClass('dragover');

        const files = Array.from(event.originalEvent.dataTransfer.files);
        if (!files.length) {
            await importFromURL(event.originalEvent.dataTransfer.items, files);
        }
        await processDroppedFiles(files);
    });


    $('#charListGridToggle').on('click', async () => {
        doCharListDisplaySwitch();
    });

    $('#hideCharPanelAvatarButton').on('click', () => {
        $('#avatar-and-name-block').slideToggle();
    });

    $(document).on('mouseup touchend', '#show_more_messages', () => {
        showMoreMessages();
    });

    // Added here to prevent execution before script.js is loaded and get rid of quirky timeouts
    await firstLoadInit();

    addDebugFunctions();

    eventSource.on(event_types.CHAT_DELETED, async (name) => {
        await deleteItemizedPrompts(name);
    });
    eventSource.on(event_types.GROUP_CHAT_DELETED, async (name) => {
        await deleteItemizedPrompts(name);
    });
});
