import { humanizedDateTime, favsToHotswap, getMessageTimeStamp, dragElement, isMobile, initRossMods, shouldSendOnEnter, addSafariPatch } from './scripts/RossAscends-mods.js';
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
    getTextGenServer,
    validateTextGenUrl,
    parseTextgenLogprobs,
    parseTabbyLogprobs,
} from './scripts/textgen-settings.js';

const { MANCER, TOGETHERAI, OOBA, VLLM, APHRODITE, TABBY, OLLAMA, INFERMATICAI, DREAMGEN, OPENROUTER, FEATHERLESS } = textgen_types;

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
    wi_anchor_position,
    world_info_include_names,
} from './scripts/world-info.js';

import {
    groups,
    selected_group,
    saveGroupChat,
    getGroups,
    generateGroupWrapper,
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
    flushEphemeralStoppingStrings,
    context_presets,
    resetMovableStyles,
    forceCharacterEditorTokenize,
    applyPowerUserSettings,
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
    proxies,
    loadProxyPresets,
    selected_proxy,
    initOpenAI,
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
    parseNovelAILogprobs,
} from './scripts/nai-settings.js';

import {
    initBookmarks,
    showBookmarksButtons,
    updateBookmarkDisplay,
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
    PAGINATION_TEMPLATE,
    waitUntilCondition,
    escapeRegex,
    resetScrollHeight,
    onlyUnique,
    getBase64Async,
    humanFileSize,
    Stopwatch,
    isValidUrl,
    ensureImageFormatSupported,
    flashHighlight,
    isTrueBoolean,
    toggleDrawer,
} from './scripts/utils.js';
import { debounce_timeout } from './scripts/constants.js';

import { ModuleWorkerWrapper, doDailyExtensionUpdatesCheck, extension_settings, getContext, loadExtensionSettings, renderExtensionTemplate, renderExtensionTemplateAsync, runGenerationInterceptors, saveMetadataDebounced, writeExtensionField } from './scripts/extensions.js';
import { COMMENT_NAME_DEFAULT, executeSlashCommands, executeSlashCommandsOnChatInput, executeSlashCommandsWithOptions, getSlashCommandsHelp, initDefaultSlashCommands, isExecutingCommandsFromChatInput, pauseScriptExecution, processChatSlashCommands, registerSlashCommand, stopScriptExecution } from './scripts/slash-commands.js';
import {
    tag_map,
    tags,
    filterByTagState,
    isBogusFolder,
    isBogusFolderOpen,
    chooseBogusFolder,
    getTagBlock,
    loadTagsSettings,
    printTagFilters,
    getTagKeyForEntity,
    printTagList,
    createTagMapFromList,
    renameTagKey,
    importTags,
    tag_filter_type,
    compareTagsForSort,
    initTags,
    applyTagsOnCharacterSelect,
    applyTagsOnGroupSelect,
    tag_import_setting,
} from './scripts/tags.js';
import {
    SECRET_KEYS,
    readSecretState,
    secret_state,
    writeSecret,
} from './scripts/secrets.js';
import { EventEmitter } from './lib/eventemitter.js';
import { markdownExclusionExt } from './scripts/showdown-exclusion.js';
import { markdownUnderscoreExt } from './scripts/showdown-underscore.js';
import { NOTE_MODULE_NAME, initAuthorsNote, metadata_keys, setFloatingPrompt, shouldWIAddPrompt } from './scripts/authors-note.js';
import { registerPromptManagerMigration } from './scripts/PromptManager.js';
import { getRegexedString, regex_placement } from './scripts/extensions/regex/engine.js';
import { initLogprobs, saveLogprobsForActiveMessage } from './scripts/logprobs.js';
import { FILTER_STATES, FILTER_TYPES, FilterHelper, isFilterState } from './scripts/filters.js';
import { getCfgPrompt, getGuidanceScale, initCfg } from './scripts/cfg-scale.js';
import {
    force_output_sequence,
    formatInstructModeChat,
    formatInstructModePrompt,
    formatInstructModeExamples,
    getInstructStoppingSequences,
    autoSelectInstructPreset,
    formatInstructModeSystemPrompt,
    selectInstructPreset,
    instruct_presets,
    selectContextPreset,
} from './scripts/instruct-mode.js';
import { initLocales, t, translate } from './scripts/i18n.js';
import { getFriendlyTokenizerName, getTokenCount, getTokenCountAsync, getTokenizerModel, initTokenizers, saveTokenCache, TOKENIZER_SUPPORTED_KEY } from './scripts/tokenizers.js';
import {
    user_avatar,
    getUserAvatars,
    getUserAvatar,
    setUserAvatar,
    initPersonas,
    setPersonaDescription,
    initUserAvatar,
} from './scripts/personas.js';
import { getBackgrounds, initBackgrounds, loadBackgroundSettings, background_settings } from './scripts/backgrounds.js';
import { hideLoader, showLoader } from './scripts/loader.js';
import { BulkEditOverlay, CharacterContextMenu } from './scripts/BulkEditOverlay.js';
import { loadFeatherlessModels, loadMancerModels, loadOllamaModels, loadTogetherAIModels, loadInfermaticAIModels, loadOpenRouterModels, loadVllmModels, loadAphroditeModels, loadDreamGenModels, initTextGenModels, loadTabbyModels } from './scripts/textgen-models.js';
import { appendFileContent, hasPendingFileAttachment, populateFileAttachment, decodeStyleTags, encodeStyleTags, isExternalMediaAllowed, getCurrentEntityId, preserveNeutralChat, restoreNeutralChat } from './scripts/chats.js';
import { initPresetManager } from './scripts/preset-manager.js';
import { MacrosParser, evaluateMacros, getLastMessageId } from './scripts/macros.js';
import { currentUser, setUserControls } from './scripts/user.js';
import { POPUP_RESULT, POPUP_TYPE, Popup, callGenericPopup, fixToastrForDialogs } from './scripts/popup.js';
import { renderTemplate, renderTemplateAsync } from './scripts/templates.js';
import { ScraperManager } from './scripts/scrapers.js';
import { SlashCommandParser } from './scripts/slash-commands/SlashCommandParser.js';
import { SlashCommand } from './scripts/slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from './scripts/slash-commands/SlashCommandArgument.js';
import { SlashCommandBrowser } from './scripts/slash-commands/SlashCommandBrowser.js';
import { initCustomSelectedSamplers, validateDisabledSamplers } from './scripts/samplerSelect.js';
import { DragAndDropHandler } from './scripts/dragdrop.js';
import { INTERACTABLE_CONTROL_CLASS, initKeyboard } from './scripts/keyboard.js';
import { initDynamicStyles } from './scripts/dynamic-styles.js';
import { SlashCommandEnumValue, enumTypes } from './scripts/slash-commands/SlashCommandEnumValue.js';
import { commonEnumProviders, enumIcons } from './scripts/slash-commands/SlashCommandCommonEnumsProvider.js';
import { initInputMarkdown } from './scripts/input-md-formatting.js';
import { AbortReason } from './scripts/util/AbortReason.js';
import { initSystemPrompts } from './scripts/sysprompt.js';

//exporting functions and vars for mods
export {
    user_avatar,
    setUserAvatar,
    getUserAvatars,
    getUserAvatar,
    nai_settings,
    isOdd,
    countOccurrences,
    renderTemplate,
};

/**
 * Wait for page to load before continuing the app initialization.
 */
await new Promise((resolve) => {
    if (document.readyState === 'complete') {
        resolve();
    } else {
        window.addEventListener('load', resolve);
    }
});

showLoader();

// Configure toast library:
toastr.options.escapeHtml = true; // Prevent raw HTML inserts
toastr.options.timeOut = 4000; // How long the toast will display without user interaction
toastr.options.extendedTimeOut = 10000; // How long the toast will display after a user hovers over it
toastr.options.progressBar = true; // Visually indicate how long before a toast expires.
toastr.options.closeButton = true; // enable a close button
toastr.options.positionClass = 'toast-top-center'; // Where to position the toast container
toastr.options.onHidden = () => {
    // If we have any dialog still open, the last "hidden" toastr will remove the toastr-container. We need to keep it alive inside the dialog though
    // so the toasts still show up inside there.
    fixToastrForDialogs();
};

// Allow target="_blank" in links
DOMPurify.addHook('afterSanitizeAttributes', function (node) {
    if ('target' in node) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener');
    }
});

DOMPurify.addHook('uponSanitizeAttribute', (_, data, config) => {
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

                    return 'custom-' + v;
                }).join(' ');
            }
            break;
        }
    }
});

DOMPurify.addHook('uponSanitizeElement', (node, _, config) => {
    if (!config['MESSAGE_SANITIZE']) {
        return;
    }

    // Replace line breaks with <br> in unknown elements
    if (node instanceof HTMLUnknownElement) {
        node.innerHTML = node.innerHTML.replaceAll('\n', '<br>');
    }

    const isMediaAllowed = isExternalMediaAllowed();
    if (isMediaAllowed) {
        return;
    }

    let mediaBlocked = false;

    switch (node.tagName) {
        case 'AUDIO':
        case 'VIDEO':
        case 'SOURCE':
        case 'TRACK':
        case 'EMBED':
        case 'OBJECT':
        case 'IMG': {
            const isExternalUrl = (url) => (url.indexOf('://') > 0 || url.indexOf('//') === 0) && !url.startsWith(window.location.origin);
            const src = node.getAttribute('src');
            const data = node.getAttribute('data');
            const srcset = node.getAttribute('srcset');

            if (srcset) {
                const srcsetUrls = srcset.split(',');

                for (const srcsetUrl of srcsetUrls) {
                    const [url] = srcsetUrl.trim().split(' ');

                    if (isExternalUrl(url)) {
                        console.warn('External media blocked', url);
                        node.remove();
                        mediaBlocked = true;
                        break;
                    }
                }
            }

            if (src && isExternalUrl(src)) {
                console.warn('External media blocked', src);
                mediaBlocked = true;
                node.remove();
            }

            if (data && isExternalUrl(data)) {
                console.warn('External media blocked', data);
                mediaBlocked = true;
                node.remove();
            }

            if (mediaBlocked && (node instanceof HTMLMediaElement)) {
                node.autoplay = false;
                node.pause();
            }
        }
            break;
    }

    if (mediaBlocked) {
        const entityId = getCurrentEntityId();
        const warningShownKey = `mediaWarningShown:${entityId}`;

        if (localStorage.getItem(warningShownKey) === null) {
            const warningToast = toastr.warning(
                'Use the "Ext. Media" button to allow it. Click on this message to dismiss.',
                'External media has been blocked',
                {
                    timeOut: 0,
                    preventDuplicates: true,
                    onclick: () => toastr.clear(warningToast),
                },
            );

            localStorage.setItem(warningShownKey, 'true');
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
    MESSAGE_UPDATED: 'message_updated',
    MESSAGE_FILE_EMBEDDED: 'message_file_embedded',
    IMPERSONATE_READY: 'impersonate_ready',
    CHAT_CHANGED: 'chat_id_changed',
    GENERATION_AFTER_COMMANDS: 'GENERATION_AFTER_COMMANDS',
    GENERATION_STARTED: 'generation_started',
    GENERATION_STOPPED: 'generation_stopped',
    GENERATION_ENDED: 'generation_ended',
    EXTENSIONS_FIRST_LOAD: 'extensions_first_load',
    EXTENSION_SETTINGS_LOADED: 'extension_settings_loaded',
    SETTINGS_LOADED: 'settings_loaded',
    SETTINGS_UPDATED: 'settings_updated',
    GROUP_UPDATED: 'group_updated',
    MOVABLE_PANELS_RESET: 'movable_panels_reset',
    SETTINGS_LOADED_BEFORE: 'settings_loaded_before',
    SETTINGS_LOADED_AFTER: 'settings_loaded_after',
    CHATCOMPLETION_SOURCE_CHANGED: 'chatcompletion_source_changed',
    CHATCOMPLETION_MODEL_CHANGED: 'chatcompletion_model_changed',
    OAI_PRESET_CHANGED_BEFORE: 'oai_preset_changed_before',
    OAI_PRESET_CHANGED_AFTER: 'oai_preset_changed_after',
    OAI_PRESET_EXPORT_READY: 'oai_preset_export_ready',
    OAI_PRESET_IMPORT_READY: 'oai_preset_import_ready',
    WORLDINFO_SETTINGS_UPDATED: 'worldinfo_settings_updated',
    WORLDINFO_UPDATED: 'worldinfo_updated',
    CHARACTER_EDITED: 'character_edited',
    CHARACTER_PAGE_LOADED: 'character_page_loaded',
    CHARACTER_GROUP_OVERLAY_STATE_CHANGE_BEFORE: 'character_group_overlay_state_change_before',
    CHARACTER_GROUP_OVERLAY_STATE_CHANGE_AFTER: 'character_group_overlay_state_change_after',
    USER_MESSAGE_RENDERED: 'user_message_rendered',
    CHARACTER_MESSAGE_RENDERED: 'character_message_rendered',
    FORCE_SET_BACKGROUND: 'force_set_background',
    CHAT_DELETED: 'chat_deleted',
    CHAT_CREATED: 'chat_created',
    GROUP_CHAT_DELETED: 'group_chat_deleted',
    GROUP_CHAT_CREATED: 'group_chat_created',
    GENERATE_BEFORE_COMBINE_PROMPTS: 'generate_before_combine_prompts',
    GENERATE_AFTER_COMBINE_PROMPTS: 'generate_after_combine_prompts',
    GENERATE_AFTER_DATA: 'generate_after_data',
    GROUP_MEMBER_DRAFTED: 'group_member_drafted',
    WORLD_INFO_ACTIVATED: 'world_info_activated',
    TEXT_COMPLETION_SETTINGS_READY: 'text_completion_settings_ready',
    CHAT_COMPLETION_SETTINGS_READY: 'chat_completion_settings_ready',
    CHAT_COMPLETION_PROMPT_READY: 'chat_completion_prompt_ready',
    CHARACTER_FIRST_MESSAGE_SELECTED: 'character_first_message_selected',
    // TODO: Naming convention is inconsistent with other events
    CHARACTER_DELETED: 'characterDeleted',
    CHARACTER_DUPLICATED: 'character_duplicated',
    /** @deprecated The event is aliased to STREAM_TOKEN_RECEIVED. */
    SMOOTH_STREAM_TOKEN_RECEIVED: 'stream_token_received',
    STREAM_TOKEN_RECEIVED: 'stream_token_received',
    FILE_ATTACHMENT_DELETED: 'file_attachment_deleted',
    WORLDINFO_FORCE_ACTIVATE: 'worldinfo_force_activate',
    OPEN_CHARACTER_LIBRARY: 'open_character_library',
    LLM_FUNCTION_TOOL_REGISTER: 'llm_function_tool_register',
    LLM_FUNCTION_TOOL_CALL: 'llm_function_tool_call',
    ONLINE_STATUS_CHANGED: 'online_status_changed',
    IMAGE_SWIPED: 'image_swiped',
    CONNECTION_PROFILE_LOADED: 'connection_profile_loaded',
};

export const eventSource = new EventEmitter();

eventSource.on(event_types.CHAT_CHANGED, processChatSlashCommands);

export const characterGroupOverlay = new BulkEditOverlay();
const characterContextMenu = new CharacterContextMenu(characterGroupOverlay);
eventSource.on(event_types.CHARACTER_PAGE_LOADED, characterGroupOverlay.onPageLoad);
console.debug('Character context menu initialized', characterContextMenu);

// Markdown converter
export let mesForShowdownParse; //intended to be used as a context to compare showdown strings against
let converter;
reloadMarkdownProcessor();

// array for prompt token calculations
console.debug('initializing Prompt Itemization Array on Startup');
const promptStorage = new localforage.createInstance({ name: 'SillyTavern_Prompts' });
export let itemizedPrompts = [];

export const systemUserName = 'SillyTavern System';
export const neutralCharacterName = 'Assistant';
let default_user_name = 'User';
export let name1 = default_user_name;
export let name2 = systemUserName;
export let chat = [];
let chatSaveTimeout;
let importFlashTimeout;
export let isChatSaving = false;
let chat_create_date = '';
let firstRun = false;
let settingsReady = false;
let currentVersion = '0.0.0';
let displayVersion = 'SillyTavern';

let generatedPromptCache = '';
let generation_started = new Date();
/** @type {import('scripts/char-data.js').v1CharData[]} */
export let characters = [];
export let this_chid;
let saveCharactersPage = 0;
export const default_avatar = 'img/ai4.png';
export const system_avatar = 'img/five.png';
export const comment_avatar = 'img/quill.png';
export const default_user_avatar = 'img/user-default.png';
export let CLIENT_VERSION = 'SillyTavern:UNKNOWN:Cohee#1207'; // For Horde header
let optionsPopper = Popper.createPopper(document.getElementById('options_button'), document.getElementById('options'), {
    placement: 'top-start',
});
let exportPopper = Popper.createPopper(document.getElementById('export_button'), document.getElementById('export_format_popup'), {
    placement: 'left',
});

// Saved here for performance reasons
const messageTemplate = $('#message_template .mes');
const chatElement = $('#chat');

let dialogueResolve = null;
let dialogueCloseStop = false;
export let chat_metadata = {};
/** @type {StreamingProcessor} */
export let streamingProcessor = null;
let crop_data = undefined;
let is_delete_mode = false;
let fav_ch_checked = false;
let scrollLock = false;
export let abortStatusCheck = new AbortController();
let charDragDropHandler = null;

/** @type {debounce_timeout} The debounce timeout used for chat/settings save. debounce_timeout.long: 1.000 ms */
export const DEFAULT_SAVE_EDIT_TIMEOUT = debounce_timeout.relaxed;
/** @type {debounce_timeout} The debounce timeout used for printing. debounce_timeout.quick: 100 ms */
export const DEFAULT_PRINT_TIMEOUT = debounce_timeout.quick;

export const saveSettingsDebounced = debounce(() => saveSettings(), DEFAULT_SAVE_EDIT_TIMEOUT);
export const saveCharacterDebounced = debounce(() => $('#create_button').trigger('click'), DEFAULT_SAVE_EDIT_TIMEOUT);

/**
 * Prints the character list in a debounced fashion without blocking, with a delay of 100 milliseconds.
 * Use this function instead of a direct `printCharacters()` whenever the reprinting of the character list is not the primary focus.
 *
 * The printing will also always reprint all filter options of the global list, to keep them up to date.
 */
export const printCharactersDebounced = debounce(() => { printCharacters(false); }, DEFAULT_PRINT_TIMEOUT);

/**
 * @enum {string} System message types
 */
export const system_message_types = {
    HELP: 'help',
    WELCOME: 'welcome',
    GROUP: 'group',
    EMPTY: 'empty',
    GENERIC: 'generic',
    NARRATOR: 'narrator',
    COMMENT: 'comment',
    SLASH_COMMANDS: 'slash_commands',
    FORMATTING: 'formatting',
    HOTKEYS: 'hotkeys',
    MACROS: 'macros',
    WELCOME_PROMPT: 'welcome_prompt',
    ASSISTANT_NOTE: 'assistant_note',
};

/**
 * @enum {number} Extension prompt types
 */
export const extension_prompt_types = {
    NONE: -1,
    IN_PROMPT: 0,
    IN_CHAT: 1,
    BEFORE_PROMPT: 2,
};

/**
 * @enum {number} Extension prompt roles
 */
export const extension_prompt_roles = {
    SYSTEM: 0,
    USER: 1,
    ASSISTANT: 2,
};

export const MAX_INJECTION_DEPTH = 1000;

const SAFETY_CHAT = [
    {
        name: systemUserName,
        force_avatar: system_avatar,
        is_system: true,
        is_user: false,
        create_date: 0,
        mes: 'You deleted a character/chat and arrived back here for safety reasons! Pick another character!',
    },
];

export let system_messages = {};

async function getSystemMessages() {
    system_messages = {
        help: {
            name: systemUserName,
            force_avatar: system_avatar,
            is_user: false,
            is_system: true,
            mes: await renderTemplateAsync('help'),
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
            mes: await renderTemplateAsync('hotkeys'),
        },
        formatting: {
            name: systemUserName,
            force_avatar: system_avatar,
            is_user: false,
            is_system: true,
            mes: await renderTemplateAsync('formatting'),
        },
        macros: {
            name: systemUserName,
            force_avatar: system_avatar,
            is_user: false,
            is_system: true,
            mes: await renderTemplateAsync('macros'),
        },
        welcome:
        {
            name: systemUserName,
            force_avatar: system_avatar,
            is_user: false,
            is_system: true,
            mes: await renderTemplateAsync('welcome', { displayVersion }),
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
        welcome_prompt: {
            name: systemUserName,
            force_avatar: system_avatar,
            is_user: false,
            is_system: true,
            mes: await renderTemplateAsync('welcomePrompt'),
            extra: {
                isSmallSys: true,
            },
        },
        assistant_note: {
            name: systemUserName,
            force_avatar: system_avatar,
            is_user: false,
            is_system: true,
            mes: await renderTemplateAsync('assistantNote'),
            extra: {
                isSmallSys: true,
            },
        },
    };
}

// Register configuration migrations
registerPromptManagerMigration();

$(document).ajaxError(function myErrorHandler(_, xhr) {
    // Cohee: CSRF doesn't error out in multiple tabs anymore, so this is unnecessary
    /*
    if (xhr.status == 403) {
        toastr.warning(
            'doubleCsrf errors in console are NORMAL in this case. If you want to run ST in multiple tabs, start the server with --disableCsrf option.',
            'Looks like you\'ve opened SillyTavern in another browser tab',
            { timeOut: 0, extendedTimeOut: 0, preventDuplicates: true },
        );
    } */
});

async function getClientVersion() {
    try {
        const response = await fetch('/version');
        const data = await response.json();
        CLIENT_VERSION = data.agent;
        displayVersion = `SillyTavern ${data.pkgVersion}`;
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

export function reloadMarkdownProcessor(render_formulas = false) {
    if (render_formulas) {
        converter = new showdown.Converter({
            emoji: true,
            underline: true,
            tables: true,
            parseImgDimensions: true,
            simpleLineBreaks: true,
            strikethrough: true,
            disableForced4SpacesIndentedSublists: true,
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
            underline: true,
            simpleLineBreaks: true,
            strikethrough: true,
            disableForced4SpacesIndentedSublists: true,
            extensions: [markdownUnderscoreExt()],
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

export function getCurrentChatId() {
    if (selected_group) {
        return groups.find(x => x.id == selected_group)?.chat_id;
    }
    else if (this_chid !== undefined) {
        return characters[this_chid]?.chat;
    }
}

export const talkativeness_default = 0.5;
export const depth_prompt_depth_default = 4;
export const depth_prompt_role_default = 'system';
const per_page_default = 50;

var is_advanced_char_open = false;

/**
 * The type of the right menu
 * @typedef {'characters' | 'character_edit' | 'create' | 'group_edit' | 'group_create' | '' } MenuType
 */

/**
 * The type of the right menu that is currently open
 * @type {MenuType}
 */
export let menu_type = '';

export let selected_button = ''; //which button pressed

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
    depth_prompt_role: depth_prompt_role_default,
    extensions: {},
};

//animation right menu
export const ANIMATION_DURATION_DEFAULT = 125;
export let animation_duration = ANIMATION_DURATION_DEFAULT;
export let animation_easing = 'ease-in-out';
let popup_type = '';
let chat_file_for_del = '';
export let online_status = 'no_connection';

export let api_server = '';

export let is_send_press = false; //Send generation

let this_del_mes = -1;

//message editing and chat scroll position persistence
var this_edit_mes_chname = '';
var this_edit_mes_id;
var scroll_holder = 0;
var is_use_scroll_holder = false;

//settings
export let settings;
export let koboldai_settings;
export let koboldai_setting_names;
var preset_settings = 'gui';
export let amount_gen = 80; //default max length of AI generated responses
export let max_context = 2048;

var swipes = true;
let extension_prompts = {};

export let main_api;// = "kobold";
//novel settings
export let novelai_settings;
export let novelai_setting_names;
/** @type {AbortController} */
let abortController;

//css
var css_send_form_display = $('<div id=send_form></div>').css('display');

var kobold_horde_model = '';

export let token;

var PromptArrayItemForRawPromptDisplay;
var priorPromptArrayItemForRawPromptDisplay;

/** The tag of the active character. (NOT the id) */
export let active_character = '';
/** The tag of the active group. (Coincidentally also the id) */
export let active_group = '';

export const entitiesFilter = new FilterHelper(printCharactersDebounced);

export function getRequestHeaders() {
    return {
        'Content-Type': 'application/json',
        'X-CSRF-Token': token,
    };
}

$.ajaxPrefilter((options, originalOptions, xhr) => {
    xhr.setRequestHeader('X-CSRF-Token', token);
});

/**
 * Pings the STserver to check if it is reachable.
 * @returns {Promise<boolean>} True if the server is reachable, false otherwise.
 */
export async function pingServer() {
    try {
        const result = await fetch('api/ping', {
            method: 'GET',
            headers: getRequestHeaders(),
        });

        if (!result.ok) {
            return false;
        }

        return true;
    } catch (error) {
        console.error('Error pinging server', error);
        return false;
    }
}

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

    addSafariPatch();
    await getClientVersion();
    await readSecretState();
    await initLocales();
    initDefaultSlashCommands();
    initTextGenModels();
    initOpenAI();
    initSystemPrompts();
    await initPresetManager();
    await getSystemMessages();
    sendSystemMessage(system_message_types.WELCOME);
    sendSystemMessage(system_message_types.WELCOME_PROMPT);
    await getSettings();
    initKeyboard();
    initDynamicStyles();
    initTags();
    initBookmarks();
    await getUserAvatars(true, user_avatar);
    await getCharacters();
    await getBackgrounds();
    await initTokenizers();
    initBackgrounds();
    initAuthorsNote();
    initPersonas();
    initRossMods();
    initStats();
    initCfg();
    initLogprobs();
    initInputMarkdown();
    doDailyExtensionUpdatesCheck();
    await hideLoader();
    await fixViewport();
    await eventSource.emit(event_types.APP_READY);
}

async function fixViewport() {
    document.body.style.position = 'absolute';
    await delay(1);
    document.body.style.position = '';
}

function cancelStatusCheck(reason = 'Manually cancelled status check') {
    abortStatusCheck?.abort(new AbortReason(reason));
    abortStatusCheck = new AbortController();
    setOnlineStatus('no_connection');
}

export function displayOnlineStatus() {
    if (online_status == 'no_connection') {
        $('.online_status_indicator').removeClass('success');
        $('.online_status_text').text($('#API-status-top').attr('no_connection_text'));
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
    // Set CSS variable to document
    document.documentElement.style.setProperty('--animation-duration', `${animation_duration}ms`);
}

export function setActiveCharacter(entityOrKey) {
    active_character = getTagKeyForEntity(entityOrKey);
}

export function setActiveGroup(entityOrKey) {
    active_group = getTagKeyForEntity(entityOrKey);
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
        setOnlineStatus(hordeStatus ? 'Connected' : 'no_connection');
    }
    catch {
        setOnlineStatus('no_connection');
    }

    return resultCheckStatus();
}

async function getStatusKobold() {
    let endpoint = api_server;

    if (!endpoint) {
        console.warn('No endpoint for status check');
        setOnlineStatus('no_connection');
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

        setOnlineStatus(data?.model ?? 'no_connection');

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
        setOnlineStatus('no_connection');
    }

    return resultCheckStatus();
}

async function getStatusTextgen() {
    const url = '/api/backends/text-completions/status';

    const endpoint = getTextGenServer();

    if (!endpoint) {
        console.warn('No endpoint for status check');
        setOnlineStatus('no_connection');
        return resultCheckStatus();
    }

    if (textgen_settings.type == OOBA && textgen_settings.bypass_status_check) {
        setOnlineStatus('Status check bypassed');
        return resultCheckStatus();
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                api_server: endpoint,
                api_type: textgen_settings.type,
                legacy_api: textgen_settings.legacy_api && textgen_settings.type === OOBA,
            }),
            signal: abortStatusCheck.signal,
        });

        const data = await response.json();

        if (textgen_settings.type === MANCER) {
            loadMancerModels(data?.data);
            setOnlineStatus(textgen_settings.mancer_model);
        } else if (textgen_settings.type === TOGETHERAI) {
            loadTogetherAIModels(data?.data);
            setOnlineStatus(textgen_settings.togetherai_model);
        } else if (textgen_settings.type === OLLAMA) {
            loadOllamaModels(data?.data);
            setOnlineStatus(textgen_settings.ollama_model || 'Connected');
        } else if (textgen_settings.type === INFERMATICAI) {
            loadInfermaticAIModels(data?.data);
            setOnlineStatus(textgen_settings.infermaticai_model);
        } else if (textgen_settings.type === DREAMGEN) {
            loadDreamGenModels(data?.data);
            setOnlineStatus(textgen_settings.dreamgen_model);
        } else if (textgen_settings.type === OPENROUTER) {
            loadOpenRouterModels(data?.data);
            setOnlineStatus(textgen_settings.openrouter_model);
        } else if (textgen_settings.type === VLLM) {
            loadVllmModels(data?.data);
            setOnlineStatus(textgen_settings.vllm_model);
        } else if (textgen_settings.type === APHRODITE) {
            loadAphroditeModels(data?.data);
            setOnlineStatus(textgen_settings.aphrodite_model);
        } else if (textgen_settings.type === FEATHERLESS) {
            loadFeatherlessModels(data?.data);
            setOnlineStatus(textgen_settings.featherless_model);
        } else if (textgen_settings.type === TABBY) {
            loadTabbyModels(data?.data);
            setOnlineStatus(textgen_settings.tabby_model || data?.result);
        } else {
            setOnlineStatus(data?.result);
        }

        if (!online_status) {
            setOnlineStatus('no_connection');
        }

        // Determine instruct mode preset
        autoSelectInstructPreset(online_status);

        const supportsTokenization = response.headers.get('x-supports-tokenization') === 'true';
        supportsTokenization ? sessionStorage.setItem(TOKENIZER_SUPPORTED_KEY, 'true') : sessionStorage.removeItem(TOKENIZER_SUPPORTED_KEY);

        // We didn't get a 200 status code, but the endpoint has an explanation. Which means it DID connect, but I digress.
        if (online_status === 'no_connection' && data.response) {
            toastr.error(data.response, 'API Error', { timeOut: 5000, preventDuplicates: true });
        }
    } catch (err) {
        if (err instanceof AbortReason) {
            console.info('Status check aborted.', err.reason);
        } else {
            console.error('Error getting status', err);

        }
        setOnlineStatus('no_connection');
    }

    return resultCheckStatus();
}

async function getStatusNovel() {
    try {
        const result = await loadNovelSubscriptionData();

        if (!result) {
            throw new Error('Could not load subscription data');
        }

        setOnlineStatus(getNovelTier());
    } catch {
        setOnlineStatus('no_connection');
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
    if (characters[id] === undefined) {
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

function getBackBlock() {
    const template = $('#bogus_folder_back_template .bogus_folder_select').clone();
    return template;
}

function getEmptyBlock() {
    const icons = ['fa-dragon', 'fa-otter', 'fa-kiwi-bird', 'fa-crow', 'fa-frog'];
    const texts = ['Here be dragons', 'Otterly empty', 'Kiwibunga', 'Pump-a-Rum', 'Croak it'];
    const roll = new Date().getMinutes() % icons.length;
    const emptyBlock = `
    <div class="text_block empty_block">
        <i class="fa-solid ${icons[roll]} fa-4x"></i>
        <h1>${texts[roll]}</h1>
        <p>There are no items to display.</p>
    </div>`;
    return $(emptyBlock);
}

/**
 * @param {number} hidden Number of hidden characters
 */
function getHiddenBlock(hidden) {
    const hiddenBlock = `
    <div class="text_block hidden_block">
        <small>
            <p>${hidden} ${hidden > 1 ? 'characters' : 'character'} hidden.</p>
            <div class="fa-solid fa-circle-info opacity50p" data-i18n="[title]Characters and groups hidden by filters or closed folders" title="Characters and groups hidden by filters or closed folders"></div>
        </small>
    </div>`;
    return $(hiddenBlock);
}

function getCharacterBlock(item, id) {
    let this_avatar = default_avatar;
    if (item.avatar != 'none') {
        this_avatar = getThumbnailUrl('avatar', item.avatar);
    }
    // Populate the template
    const template = $('#character_template .character_select').clone();
    template.attr({ 'chid': id, 'id': `CharID${id}` });
    template.find('img').attr('src', this_avatar).attr('alt', item.name);
    template.find('.avatar').attr('title', `[Character] ${item.name}\nFile: ${item.avatar}`);
    template.find('.ch_name').text(item.name).attr('title', `[Character] ${item.name}`);
    if (power_user.show_card_avatar_urls) {
        template.find('.ch_avatar_url').text(item.avatar);
    }
    template.find('.ch_fav_icon').css('display', 'none');
    template.toggleClass('is_fav', item.fav || item.fav == 'true');
    template.find('.ch_fav').val(item.fav);

    const description = item.data?.creator_notes || '';
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
    const tagsElement = template.find('.tags');
    printTagList(tagsElement, { forEntityOrKey: id });

    // Add to the list
    return template;
}

/**
 * Prints the global character list, optionally doing a full refresh of the list
 * Use this function whenever the reprinting of the character list is the primary focus, otherwise using `printCharactersDebounced` is preferred for a cleaner, non-blocking experience.
 *
 * The printing will also always reprint all filter options of the global list, to keep them up to date.
 *
 * @param {boolean} fullRefresh - If true, the list is fully refreshed and the navigation is being reset
 */
export async function printCharacters(fullRefresh = false) {
    const storageKey = 'Characters_PerPage';
    const listId = '#rm_print_characters_block';

    let currentScrollTop = $(listId).scrollTop();

    if (fullRefresh) {
        saveCharactersPage = 0;
        currentScrollTop = 0;
        await delay(1);
    }

    // Before printing the personas, we check if we should enable/disable search sorting
    verifyCharactersSearchSortRule();

    // We are actually always reprinting filters, as it "doesn't hurt", and this way they are always up to date
    printTagFilters(tag_filter_type.character);
    printTagFilters(tag_filter_type.group_member);

    // We are also always reprinting the lists on character/group edit window, as these ones doesn't get updated otherwise
    applyTagsOnCharacterSelect();
    applyTagsOnGroupSelect();

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
        callback: function (/** @type {Entity[]} */ data) {
            $(listId).empty();
            if (power_user.bogus_folders && isBogusFolderOpen()) {
                $(listId).append(getBackBlock());
            }
            if (!data.length) {
                $(listId).append(getEmptyBlock());
            }
            let displayCount = 0;
            for (const i of data) {
                switch (i.type) {
                    case 'character':
                        $(listId).append(getCharacterBlock(i.item, i.id));
                        displayCount++;
                        break;
                    case 'group':
                        $(listId).append(getGroupBlock(i.item));
                        displayCount++;
                        break;
                    case 'tag':
                        $(listId).append(getTagBlock(i.item, i.entities, i.hidden, i.isUseless));
                        break;
                }
            }

            const hidden = (characters.length + groups.length) - displayCount;
            if (hidden > 0 && entitiesFilter.hasAnyFilter()) {
                $(listId).append(getHiddenBlock(hidden));
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
            $(listId).scrollTop(currentScrollTop);
        },
    });

    favsToHotswap();
}

/** Checks the state of the current search, and adds/removes the search sorting option accordingly */
function verifyCharactersSearchSortRule() {
    const searchTerm = entitiesFilter.getFilterData(FILTER_TYPES.SEARCH);
    const searchOption = $('#character_sort_order option[data-field="search"]');
    const selector = $('#character_sort_order');
    const isHidden = searchOption.attr('hidden') !== undefined;

    // If we have a search term, we are displaying the sorting option for it
    if (searchTerm && isHidden) {
        searchOption.removeAttr('hidden');
        searchOption.prop('selected', true);
        flashHighlight(selector);
    }
    // If search got cleared, we make sure to hide the option and go back to the one before
    if (!searchTerm && !isHidden) {
        searchOption.attr('hidden', '');
        $(`#character_sort_order option[data-order="${power_user.sort_order}"][data-field="${power_user.sort_field}"]`).prop('selected', true);
    }
}

/** @typedef {object} Character - A character */
/** @typedef {object} Group - A group */

/**
 * @typedef {object} Entity - Object representing a display entity
 * @property {Character|Group|import('./scripts/tags.js').Tag|*} item - The item
 * @property {string|number} id - The id
 * @property {'character'|'group'|'tag'} type - The type of this entity (character, group, tag)
 * @property {Entity[]?} [entities=null] - An optional list of entities relevant for this item
 * @property {number?} [hidden=null] - An optional number representing how many hidden entities this entity contains
 * @property {boolean?} [isUseless=null] - Specifies if the entity is useless (not relevant, but should still be displayed for consistency) and should be displayed greyed out
 */

/**
 * Converts the given character to its entity representation
 *
 * @param {Character} character - The character
 * @param {string|number} id - The id of this character
 * @returns {Entity} The entity for this character
 */
export function characterToEntity(character, id) {
    return { item: character, id, type: 'character' };
}

/**
 * Converts the given group to its entity representation
 *
 * @param {Group} group - The group
 * @returns {Entity} The entity for this group
 */
export function groupToEntity(group) {
    return { item: group, id: group.id, type: 'group' };
}

/**
 * Converts the given tag to its entity representation
 *
 * @param {import('./scripts/tags.js').Tag} tag - The tag
 * @returns {Entity} The entity for this tag
 */
export function tagToEntity(tag) {
    return { item: structuredClone(tag), id: tag.id, type: 'tag', entities: [] };
}

/**
 * Builds the full list of all entities available
 *
 * They will be correctly marked and filtered.
 *
 * @param {object} param0 - Optional parameters
 * @param {boolean} [param0.doFilter] - Whether this entity list should already be filtered based on the global filters
 * @param {boolean} [param0.doSort] - Whether the entity list should be sorted when returned
 * @returns {Entity[]} All entities
 */
export function getEntitiesList({ doFilter = false, doSort = true } = {}) {
    let entities = [
        ...characters.map((item, index) => characterToEntity(item, index)),
        ...groups.map(item => groupToEntity(item)),
        ...(power_user.bogus_folders ? tags.filter(isBogusFolder).sort(compareTagsForSort).map(item => tagToEntity(item)) : []),
    ];

    // We need to do multiple filter runs in a specific order, otherwise different settings might override each other
    // and screw up tags and search filter, sub lists or similar.
    // The specific filters are written inside the "filterByTagState" method and its different parameters.
    // Generally what we do is the following:
    //   1. First swipe over the list to remove the most obvious things
    //   2. Build sub entity lists for all folders, filtering them similarly to the second swipe
    //   3. We do the last run, where global filters are applied, and the search filters last

    // First run filters, that will hide what should never be displayed
    if (doFilter) {
        entities = filterByTagState(entities);
    }

    // Run over all entities between first and second filter to save some states
    for (const entity of entities) {
        // For folders, we remember the sub entities so they can be displayed later, even if they might be filtered
        // Those sub entities should be filtered and have the search filters applied too
        if (entity.type === 'tag') {
            let subEntities = filterByTagState(entities, { subForEntity: entity, filterHidden: false });
            const subCount = subEntities.length;
            subEntities = filterByTagState(entities, { subForEntity: entity });
            if (doFilter) {
                // sub entities filter "hacked" because folder filter should not be applied there, so even in "only folders" mode characters show up
                subEntities = entitiesFilter.applyFilters(subEntities, { clearScoreCache: false, tempOverrides: { [FILTER_TYPES.FOLDER]: FILTER_STATES.UNDEFINED } });
            }
            if (doSort) {
                sortEntitiesList(subEntities);
            }
            entity.entities = subEntities;
            entity.hidden = subCount - subEntities.length;
        }
    }

    // Second run filters, hiding whatever should be filtered later
    if (doFilter) {
        const beforeFinalEntities = filterByTagState(entities, { globalDisplayFilters: true });
        entities = entitiesFilter.applyFilters(beforeFinalEntities);

        // Magic for folder filter. If that one is enabled, and no folders are display anymore, we remove that filter to actually show the characters.
        if (isFilterState(entitiesFilter.getFilterData(FILTER_TYPES.FOLDER), FILTER_STATES.SELECTED) && entities.filter(x => x.type == 'tag').length == 0) {
            entities = entitiesFilter.applyFilters(beforeFinalEntities, { tempOverrides: { [FILTER_TYPES.FOLDER]: FILTER_STATES.UNDEFINED } });
        }
    }

    // Final step, updating some properties after the last filter run
    const nonTagEntitiesCount = entities.filter(entity => entity.type !== 'tag').length;
    for (const entity of entities) {
        if (entity.type === 'tag') {
            if (entity.entities?.length == nonTagEntitiesCount) entity.isUseless = true;
        }
    }

    // Sort before returning if requested
    if (doSort) {
        sortEntitiesList(entities);
    }
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

function getCharacterSource(chId = this_chid) {
    const character = characters[chId];

    if (!character) {
        return '';
    }

    const chubId = characters[chId]?.data?.extensions?.chub?.full_path;

    if (chubId) {
        return `https://chub.ai/characters/${chubId}`;
    }

    const pygmalionId = characters[chId]?.data?.extensions?.pygmalion_id;

    if (pygmalionId) {
        return `https://pygmalion.chat/${pygmalionId}`;
    }

    const githubRepo = characters[chId]?.data?.extensions?.github_repo;

    if (githubRepo) {
        return `https://github.com/${githubRepo}`;
    }

    const sourceUrl = characters[chId]?.data?.extensions?.source_url;

    if (sourceUrl) {
        return sourceUrl;
    }

    const risuId = characters[chId]?.data?.extensions?.risuai?.source;

    if (Array.isArray(risuId) && risuId.length && typeof risuId[0] === 'string' && risuId[0].startsWith('risurealm:')) {
        const realmId = risuId[0].split(':')[1];
        return `https://realm.risuai.net/character/${realmId}`;
    }

    return '';
}

export async function getCharacters() {
    const response = await fetch('/api/characters/all', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            '': '',
        }),
    });
    if (response.ok === true) {
        characters.splice(0, characters.length);
        const getData = await response.json();
        for (let i = 0; i < getData.length; i++) {
            characters[i] = getData[i];
            characters[i]['name'] = DOMPurify.sanitize(characters[i]['name']);

            // For dropped-in cards
            if (!characters[i]['chat']) {
                characters[i]['chat'] = `${characters[i]['name']} - ${humanizedDateTime()}`;
            }

            characters[i]['chat'] = String(characters[i]['chat']);
        }
        if (this_chid !== undefined) {
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

export async function replaceCurrentChat() {
    await clearChat();
    chat.length = 0;

    const chatsResponse = await fetch('/api/characters/chats', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ avatar_url: characters[this_chid].avatar }),
    });

    if (chatsResponse.ok) {
        const chats = Object.values(await chatsResponse.json());
        chats.sort((a, b) => sortMoments(timestampToMoment(a.last_mes), timestampToMoment(b.last_mes)));

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
    const firstDisplayedMesId = $('#chat').children('.mes').first().attr('mesid');
    let messageId = Number(firstDisplayedMesId);
    let count = power_user.chat_truncation || Number.MAX_SAFE_INTEGER;

    // If there are no messages displayed, or the message somehow has no mesid, we default to one higher than last message id,
    // so the first "new" message being shown will be the last available message
    if (isNaN(messageId)) {
        messageId = getLastMessageId() + 1;
    }

    console.debug('Inserting messages before', messageId, 'count', count, 'chat length', chat.length);
    const prevHeight = $('#chat').prop('scrollHeight');

    while (messageId > 0 && count > 0) {
        let newMessageId = messageId - 1;
        addOneMessage(chat[newMessageId], { insertBefore: messageId >= chat.length ? null : messageId, scroll: false, forceId: newMessageId });
        count--;
        messageId--;
    }

    if (messageId == 0) {
        $('#show_more_messages').remove();
    }

    const newHeight = $('#chat').prop('scrollHeight');
    $('#chat').scrollTop(newHeight - prevHeight);
}

export async function printMessages() {
    let startIndex = 0;
    let count = power_user.chat_truncation || Number.MAX_SAFE_INTEGER;

    if (chat.length > count) {
        startIndex = chat.length - count;
        $('#chat').append('<div id="show_more_messages">Show more messages</div>');
    }

    for (let i = startIndex; i < chat.length; i++) {
        const item = chat[i];
        addOneMessage(item, { scroll: false, forceId: i, showSwipes: false });
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

    $('#chat .mes').removeClass('last_mes');
    $('#chat .mes').last().addClass('last_mes');
    hideSwipeButtons();
    showSwipeButtons();
    scrollChatToBottom();

    function incrementAndCheck() {
        imagesLoaded++;
        if (imagesLoaded === images.length) {
            scrollChatToBottom();
        }
    }
}

export async function clearChat() {
    closeMessageEditor();
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

export async function deleteLastMessage() {
    chat.length = chat.length - 1;
    $('#chat').children('.mes').last().remove();
    await eventSource.emit(event_types.MESSAGE_DELETED, chat.length);
}

export async function reloadCurrentChat() {
    preserveNeutralChat();
    await clearChat();
    chat.length = 0;

    if (selected_group) {
        await getGroupChat(selected_group, true);
    }
    else if (this_chid !== undefined) {
        await getChat();
    }
    else {
        resetChatState();
        restoreNeutralChat();
        await getCharacters();
        await printMessages();
        await eventSource.emit(event_types.CHAT_CHANGED, getCurrentChatId());
    }

    hideSwipeButtons();
    showSwipeButtons();
}

/**
 * Send the message currently typed into the chat box.
 */
export async function sendTextareaMessage() {
    if (is_send_press) return;
    if (isExecutingCommandsFromChatInput) return;

    let generateType;
    // "Continue on send" is activated when the user hits "send" (or presses enter) on an empty chat box, and the last
    // message was sent from a character (not the user or the system).
    const textareaText = String($('#send_textarea').val());
    if (power_user.continue_on_send &&
        !hasPendingFileAttachment() &&
        !textareaText &&
        !selected_group &&
        chat.length &&
        !chat[chat.length - 1]['is_user'] &&
        !chat[chat.length - 1]['is_system']
    ) {
        generateType = 'continue';
    }

    if (textareaText && !selected_group && this_chid === undefined && name2 !== neutralCharacterName) {
        await newAssistantChat();
    }

    Generate(generateType);
}

/**
 * Formats the message text into an HTML string using Markdown and other formatting.
 * @param {string} mes Message text
 * @param {string} ch_name Character name
 * @param {boolean} isSystem If the message was sent by the system
 * @param {boolean} isUser If the message was sent by the user
 * @param {number} messageId Message index in chat array
 * @returns {string} HTML string
 */
export function messageFormatting(mes, ch_name, isSystem, isUser, messageId) {
    if (!mes) {
        return '';
    }

    if (Number(messageId) === 0 && !isSystem && !isUser) {
        const mesBeforeReplace = mes;
        const chatMessage = chat[messageId];
        mes = substituteParams(mes, undefined, ch_name);
        if (chatMessage && chatMessage.mes === mesBeforeReplace && chatMessage.extra?.display_text !== mesBeforeReplace) {
            chatMessage.mes = mes;
        }
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
        function getRegexPlacement() {
            try {
                if (isUser) {
                    return regex_placement.USER_INPUT;
                } else if (chat[messageId]?.extra?.type === 'narrator') {
                    return regex_placement.SLASH_COMMAND;
                } else {
                    return regex_placement.AI_OUTPUT;
                }
            } catch {
                return regex_placement.AI_OUTPUT;
            }
        }

        const regexPlacement = getRegexPlacement();
        const usableMessages = chat.map((x, index) => ({ message: x, index: index })).filter(x => !x.message.is_system);
        const indexOf = usableMessages.findIndex(x => x.index === Number(messageId));
        const depth = messageId >= 0 && indexOf !== -1 ? (usableMessages.length - indexOf - 1) : undefined;

        // Always override the character name
        mes = getRegexedString(mes, regexPlacement, {
            characterOverride: ch_name,
            isMarkdown: true,
            depth: depth,
        });
    }

    if (power_user.auto_fix_generated_markdown) {
        mes = fixMarkdown(mes, true);
    }

    if (!isSystem && power_user.encode_tags) {
        mes = mes.replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    }

    if (!isSystem) {
        // Save double quotes in tags as a special character to prevent them from being encoded
        if (!power_user.encode_tags) {
            mes = mes.replace(/<([^>]+)>/g, function (_, contents) {
                return '<' + contents.replace(/"/g, '\ufffe') + '>';
            });
        }

        mes = mes.replace(/```[\s\S]*?```|``[\s\S]*?``|`[\s\S]*?`|(".+?")|(\u201C.+?\u201D)/gm, function (match, p1, p2) {
            if (p1) {
                return '<q>"' + p1.replace(/"/g, '') + '"</q>';
            } else if (p2) {
                return '<q>“' + p2.replace(/\u201C|\u201D/g, '') + '”</q>';
            } else {
                return match;
            }
        });

        // Restore double quotes in tags
        if (!power_user.encode_tags) {
            mes = mes.replace(/\ufffe/g, '"');
        }

        mes = mes.replaceAll('\\begin{align*}', '$$');
        mes = mes.replaceAll('\\end{align*}', '$$');
        mes = converter.makeHtml(mes);

        mes = mes.replace(/<code(.*)>[\s\S]*?<\/code>/g, function (match) {
            // Firefox creates extra newlines from <br>s in code blocks, so we replace them before converting newlines to <br>s.
            return match.replace(/\n/gm, '\u0000');
        });
        mes = mes.replace(/\u0000/g, '\n'); // Restore converted newlines
        mes = mes.trim();

        mes = mes.replace(/<code(.*)>[\s\S]*?<\/code>/g, function (match) {
            return match.replace(/&amp;/g, '&');
        });
    }

    if (!power_user.allow_name2_display && ch_name && !isUser && !isSystem) {
        mes = mes.replace(new RegExp(`(^|\n)${escapeRegex(ch_name)}:`, 'g'), '$1');
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
    swipeId,
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
}) {
    const mes = messageTemplate.clone();
    mes.attr({
        'mesid': mesId,
        'swipeid': swipeId,
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
    bookmarkLink && updateBookmarkDisplay(mes);

    if (power_user.timestamp_model_icon && extra?.api) {
        insertSVGIcon(mes, extra);
    }

    return mes;
}

export function updateMessageBlock(messageId, message) {
    const messageElement = $(`#chat [mesid="${messageId}"]`);
    const text = message?.extra?.display_text ?? message.mes;
    messageElement.find('.mes_text').html(messageFormatting(text, message.name, message.is_system, message.is_user, messageId));
    addCopyToCodeBlocks(messageElement);
    appendMediaToMessage(message, messageElement);
}

/**
 * Appends image or file to the message element.
 * @param {object} mes Message object
 * @param {JQuery<HTMLElement>} messageElement Message element
 * @param {boolean} [adjustScroll=true] Whether to adjust the scroll position after appending the media
 */
export function appendMediaToMessage(mes, messageElement, adjustScroll = true) {
    // Add image to message
    if (mes.extra?.image) {
        const container = messageElement.find('.mes_img_container');
        const chatHeight = $('#chat').prop('scrollHeight');
        const image = messageElement.find('.mes_img');
        const text = messageElement.find('.mes_text');
        const isInline = !!mes.extra?.inline_image;
        image.off('load').on('load', function () {
            if (!adjustScroll) {
                return;
            }
            const scrollPosition = $('#chat').scrollTop();
            const newChatHeight = $('#chat').prop('scrollHeight');
            const diff = newChatHeight - chatHeight;
            $('#chat').scrollTop(scrollPosition + diff);
        });
        image.attr('src', mes.extra?.image);
        image.attr('title', mes.extra?.title || mes.title || '');
        container.addClass('img_extra');
        image.toggleClass('img_inline', isInline);
        text.toggleClass('displayNone', !isInline);

        const imageSwipes = mes.extra.image_swipes;
        if (Array.isArray(imageSwipes) && imageSwipes.length > 0) {
            container.addClass('img_swipes');
            const counter = container.find('.mes_img_swipe_counter');
            const currentImage = imageSwipes.indexOf(mes.extra.image) + 1;
            counter.text(`${currentImage}/${imageSwipes.length}`);

            const swipeLeft = container.find('.mes_img_swipe_left');
            swipeLeft.off('click').on('click', function () {
                eventSource.emit(event_types.IMAGE_SWIPED, { message: mes, element: messageElement, direction: 'left' });
            });

            const swipeRight = container.find('.mes_img_swipe_right');
            swipeRight.off('click').on('click', function () {
                eventSource.emit(event_types.IMAGE_SWIPED, { message: mes, element: messageElement, direction: 'right' });
            });
        }
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
            copyButton.classList.add('fa-solid', 'fa-copy', 'code-copy', 'interactable');
            copyButton.title = 'Copy code';
            codeBlocks.get(i).appendChild(copyButton);
            copyButton.addEventListener('pointerup', function (event) {
                navigator.clipboard.writeText(codeBlocks.get(i).innerText);
                toastr.info(t`Copied!`, '', { timeOut: 2000 });
            });
        }
    }
}


export function addOneMessage(mes, { type = 'normal', insertAfter = null, scroll = true, insertBefore = null, forceId = null, showSwipes = true } = {}) {
    let messageText = mes['mes'];
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

    let avatarImg = getUserAvatar(user_avatar);
    const isSystem = mes.is_system;
    const title = mes.title;
    generatedPromptCache = '';

    //for non-user mesages
    if (!mes['is_user']) {
        if (mes.force_avatar) {
            avatarImg = mes.force_avatar;
        } else if (this_chid === undefined) {
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

    messageText = messageFormatting(
        messageText,
        mes.name,
        isSystem,
        mes.is_user,
        chat.indexOf(mes),
    );
    const bias = messageFormatting(mes.extra?.bias ?? '', '', false, false, -1);
    let bookmarkLink = mes?.extra?.bookmark_link ?? '';

    let params = {
        mesId: forceId ?? chat.length - 1,
        swipeId: mes.swipe_id ?? 0,
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
        tokenCount: mes.extra?.token_count ?? 0,
        ...formatGenerationTimer(mes.gen_started, mes.gen_finished, mes.extra?.token_count),
    };

    const renderedMessage = getMessageFromTemplate(params);

    if (type !== 'swipe') {
        if (!insertAfter && !insertBefore) {
            chatElement.append(renderedMessage);
        }
        else if (insertAfter) {
            const target = chatElement.find(`.mes[mesid="${insertAfter}"]`);
            $(renderedMessage).insertAfter(target);
        } else {
            const target = chatElement.find(`.mes[mesid="${insertBefore}"]`);
            $(renderedMessage).insertBefore(target);
        }
    }

    // Callers push the new message to chat before calling addOneMessage
    const newMessageId = typeof forceId == 'number' ? forceId : chat.length - 1;

    const newMessage = $(`#chat [mesid="${newMessageId}"]`);
    const isSmallSys = mes?.extra?.isSmallSys;

    if (isSmallSys === true) {
        newMessage.addClass('smallSysMes');
    }

    //shows or hides the Prompt display button
    let mesIdToFind = type == 'swipe' ? params.mesId - 1 : params.mesId;  //Number(newMessage.attr('mesId'));

    //if we have itemized messages, and the array isn't null..
    if (params.isUser === false && Array.isArray(itemizedPrompts) && itemizedPrompts.length > 0) {
        const itemizedPrompt = itemizedPrompts.find(x => Number(x.mesId) === Number(mesIdToFind));
        if (itemizedPrompt) {
            newMessage.find('.mes_prompt').show();
        }
    }

    newMessage.find('.avatar img').on('error', function () {
        $(this).hide();
        $(this).parent().html('<div class="missing-avatar fa-solid fa-user-slash"></div>');
    });

    if (type === 'swipe') {
        const swipeMessage = chatElement.find(`[mesid="${chat.length - 1}"]`);
        swipeMessage.attr('swipeid', params.swipeId);
        swipeMessage.find('.mes_text').html(messageText).attr('title', title);
        swipeMessage.find('.timestamp').text(timestamp).attr('title', `${params.extra.api} - ${params.extra.model}`);
        appendMediaToMessage(mes, swipeMessage);
        if (power_user.timestamp_model_icon && params.extra?.api) {
            insertSVGIcon(swipeMessage, params.extra);
        }

        if (mes.swipe_id == mes.swipes.length - 1) {
            swipeMessage.find('.mes_timer').text(params.timerValue).attr('title', params.timerTitle);
            swipeMessage.find('.tokenCounterDisplay').text(`${params.tokenCount}t`);
        } else {
            swipeMessage.find('.mes_timer').empty();
            swipeMessage.find('.tokenCounterDisplay').empty();
        }
    } else {
        const messageId = forceId ?? chat.length - 1;
        chatElement.find(`[mesid="${messageId}"] .mes_text`).append(messageText);
        appendMediaToMessage(mes, newMessage);
        showSwipes && hideSwipeButtons();
    }

    addCopyToCodeBlocks(newMessage);

    if (showSwipes) {
        $('#chat .mes').last().addClass('last_mes');
        $('#chat .mes').eq(-2).removeClass('last_mes');
        hideSwipeButtons();
        showSwipeButtons();
    }

    // Don't scroll if not inserting last
    if (!insertAfter && !insertBefore && scroll) {
        scrollChatToBottom();
    }
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

    if (isNaN(seconds) || seconds < 0) {
        return { timerValue: '', timerTitle };
    }

    return { timerValue, timerTitle };
}

export function scrollChatToBottom() {
    if (power_user.auto_scroll_chat_to_bottom) {
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
 * Substitutes {{macro}} parameters in a string.
 * @param {string} content - The string to substitute parameters in.
 * @param {Record<string,any>} additionalMacro - Additional environment variables for substitution.
 * @returns {string} The string with substituted parameters.
 */
export function substituteParamsExtended(content, additionalMacro = {}) {
    return substituteParams(content, undefined, undefined, undefined, undefined, true, additionalMacro);
}

/**
 * Substitutes {{macro}} parameters in a string.
 * @param {string} content - The string to substitute parameters in.
 * @param {string} [_name1] - The name of the user. Uses global name1 if not provided.
 * @param {string} [_name2] - The name of the character. Uses global name2 if not provided.
 * @param {string} [_original] - The original message for {{original}} substitution.
 * @param {string} [_group] - The group members list for {{group}} substitution.
 * @param {boolean} [_replaceCharacterCard] - Whether to replace character card macros.
 * @param {Record<string,any>} [additionalMacro] - Additional environment variables for substitution.
 * @returns {string} The string with substituted parameters.
 */
export function substituteParams(content, _name1, _name2, _original, _group, _replaceCharacterCard = true, additionalMacro = {}) {
    if (!content) {
        return '';
    }

    const environment = {};

    if (typeof _original === 'string') {
        let originalSubstituted = false;
        environment.original = () => {
            if (originalSubstituted) {
                return '';
            }

            originalSubstituted = true;
            return _original;
        };
    }

    const getGroupValue = () => {
        if (typeof _group === 'string') {
            return _group;
        }

        if (selected_group) {
            const members = groups.find(x => x.id === selected_group)?.members;
            const names = Array.isArray(members)
                ? members.map(m => characters.find(c => c.avatar === m)?.name).filter(Boolean).join(', ')
                : '';
            return names;
        } else {
            return _name2 ?? name2;
        }
    };

    if (_replaceCharacterCard) {
        const fields = getCharacterCardFields();
        environment.charPrompt = fields.system || '';
        environment.charJailbreak = fields.jailbreak || '';
        environment.description = fields.description || '';
        environment.personality = fields.personality || '';
        environment.scenario = fields.scenario || '';
        environment.persona = fields.persona || '';
        environment.mesExamples = fields.mesExamples || '';
        environment.charVersion = fields.version || '';
        environment.char_version = fields.version || '';
    }

    // Must be substituted last so that they're replaced inside {{description}}
    environment.user = _name1 ?? name1;
    environment.char = _name2 ?? name2;
    environment.group = environment.charIfNotGroup = getGroupValue();
    environment.model = getGeneratingModel();

    if (additionalMacro && typeof additionalMacro === 'object') {
        Object.assign(environment, additionalMacro);
    }

    return evaluateMacros(content, environment);
}


/**
 * Gets stopping sequences for the prompt.
 * @param {boolean} isImpersonate A request is made to impersonate a user
 * @param {boolean} isContinue A request is made to continue the message
 * @returns {string[]} Array of stopping strings
 */
export function getStoppingStrings(isImpersonate, isContinue) {
    const result = [];

    if (power_user.context.names_as_stop_strings) {
        const charString = `\n${name2}:`;
        const userString = `\n${name1}:`;
        result.push(isImpersonate ? charString : userString);

        result.push(userString);

        if (isContinue && Array.isArray(chat) && chat[chat.length - 1]?.is_user) {
            result.push(charString);
        }

        // Add group members as stopping strings if generating for a specific group member or user. (Allow slash commands to work around name stopping string restrictions)
        if (selected_group && (name2 || isImpersonate)) {
            const group = groups.find(x => x.id === selected_group);

            if (group && Array.isArray(group.members)) {
                const names = group.members
                    .map(x => characters.find(y => y.avatar == x))
                    .filter(x => x && x.name && x.name !== name2)
                    .map(x => `\n${x.name}:`);
                result.push(...names);
            }
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
 * @param {string} quietName Name to use for the quiet prompt (defaults to "System:")
 * @param {number} [responseLength] Maximum response length. If unset, the global default value is used.
 * @returns
 */
export async function generateQuietPrompt(quiet_prompt, quietToLoud, skipWIAN, quietImage = null, quietName = null, responseLength = null) {
    console.log('got into genQuietPrompt');
    const responseLengthCustomized = typeof responseLength === 'number' && responseLength > 0;
    let originalResponseLength = -1;
    try {
        /** @type {GenerateOptions} */
        const options = {
            quiet_prompt,
            quietToLoud,
            skipWIAN: skipWIAN,
            force_name2: true,
            quietImage: quietImage,
            quietName: quietName,
        };
        originalResponseLength = responseLengthCustomized ? saveResponseLength(main_api, responseLength) : -1;
        const generateFinished = await Generate('quiet', options);
        return generateFinished;
    } finally {
        if (responseLengthCustomized) {
            restoreResponseLength(main_api, originalResponseLength);
        }
    }
}

/**
 * Executes slash commands and returns the new text and whether the generation was interrupted.
 * @param {string} message Text to be sent
 * @returns {Promise<boolean>} Whether the message sending was interrupted
 */
export async function processCommands(message) {
    if (!message || !message.trim().startsWith('/')) {
        return false;
    }
    await executeSlashCommandsOnChatInput(message, {
        clearChatInput: true,
    });
    return true;
}

export function sendSystemMessage(type, text, extra = {}) {
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
    if (type == system_message_types.SLASH_COMMANDS) {
        const browser = new SlashCommandBrowser();
        const spinner = document.querySelector('#chat .last_mes .custom-slashHelp');
        const parent = spinner.parentElement;
        spinner.remove();
        browser.renderInto(parent);
        browser.search.focus();
    }
}

/**
 * Extracts the contents of bias macros from a message.
 * @param {string} message Message text
 * @returns {string} Message bias extracted from the message (or an empty string if not found)
 */
export function extractMessageBias(message) {
    if (!message) {
        return '';
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
    const INJECT_TAG = 'PERSONA_DESCRIPTION';
    setExtensionPrompt(INJECT_TAG, '', extension_prompt_types.IN_PROMPT, 0);

    if (!power_user.persona_description || power_user.persona_description_position === persona_description_positions.NONE) {
        return;
    }

    const promptPositions = [persona_description_positions.BOTTOM_AN, persona_description_positions.TOP_AN];

    if (promptPositions.includes(power_user.persona_description_position) && shouldWIAddPrompt) {
        const originalAN = extension_prompts[NOTE_MODULE_NAME].value;
        const ANWithDesc = power_user.persona_description_position === persona_description_positions.TOP_AN
            ? `${power_user.persona_description}\n${originalAN}`
            : `${originalAN}\n${power_user.persona_description}`;

        setExtensionPrompt(NOTE_MODULE_NAME, ANWithDesc, chat_metadata[metadata_keys.position], chat_metadata[metadata_keys.depth], extension_settings.note.allowWIScan, chat_metadata[metadata_keys.role]);
    }

    if (power_user.persona_description_position === persona_description_positions.AT_DEPTH) {
        setExtensionPrompt(INJECT_TAG, power_user.persona_description, extension_prompt_types.IN_CHAT, power_user.persona_description_depth, true, power_user.persona_description_role);
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
export function getExtensionPromptByName(moduleName) {
    if (moduleName) {
        return substituteParams(extension_prompts[moduleName]?.value);
    } else {
        return;
    }
}

/**
 * Returns the extension prompt for the given position, depth, and role.
 * If multiple prompts are found, they are joined with a separator.
 * @param {number} [position] Position of the prompt
 * @param {number} [depth] Depth of the prompt
 * @param {string} [separator] Separator for joining multiple prompts
 * @param {number} [role] Role of the prompt
 * @param {boolean} [wrap] Wrap start and end with a separator
 * @returns {string} Extension prompt
 */
export function getExtensionPrompt(position = extension_prompt_types.IN_PROMPT, depth = undefined, separator = '\n', role = undefined, wrap = true) {
    let extension_prompt = Object.keys(extension_prompts)
        .sort()
        .map((x) => extension_prompts[x])
        .filter(x => x.position == position && x.value)
        .filter(x => depth === undefined || x.depth === undefined || x.depth === depth)
        .filter(x => role === undefined || x.role === undefined || x.role === role)
        .map(x => x.value.trim())
        .join(separator);
    if (wrap && extension_prompt.length && !extension_prompt.startsWith(separator)) {
        extension_prompt = separator + extension_prompt;
    }
    if (wrap && extension_prompt.length && !extension_prompt.endsWith(separator)) {
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
 * @returns {{system: string, mesExamples: string, description: string, personality: string, persona: string, scenario: string, jailbreak: string, version: string}}
 */
export function getCharacterCardFields() {
    const result = { system: '', mesExamples: '', description: '', personality: '', persona: '', scenario: '', jailbreak: '', version: '' };
    result.persona = baseChatReplace(power_user.persona_description?.trim(), name1, name2);

    const character = characters[this_chid];

    if (!character) {
        return result;
    }

    const scenarioText = chat_metadata['scenario'] || character.scenario || '';
    result.description = baseChatReplace(character.description?.trim(), name1, name2);
    result.personality = baseChatReplace(character.personality?.trim(), name1, name2);
    result.scenario = baseChatReplace(scenarioText.trim(), name1, name2);
    result.mesExamples = baseChatReplace(character.mes_example?.trim(), name1, name2);
    result.system = power_user.prefer_character_prompt ? baseChatReplace(character.data?.system_prompt?.trim(), name1, name2) : '';
    result.jailbreak = power_user.prefer_character_jailbreak ? baseChatReplace(character.data?.post_history_instructions?.trim(), name1, name2) : '';
    result.version = character.data?.character_version ?? '';

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

export function isStreamingEnabled() {
    const noStreamSources = [chat_completion_sources.SCALE];
    return (
        (main_api == 'openai' &&
            oai_settings.stream_openai &&
            !noStreamSources.includes(oai_settings.chat_completion_source) &&
            !(oai_settings.chat_completion_source == chat_completion_sources.OPENAI && oai_settings.openai_model.startsWith('o1-')) &&
            !(oai_settings.chat_completion_source == chat_completion_sources.MAKERSUITE && oai_settings.google_model.includes('bison')))
        || (main_api == 'kobold' && kai_settings.streaming_kobold && kai_flags.can_use_streaming)
        || (main_api == 'novel' && nai_settings.streaming_novel)
        || (main_api == 'textgenerationwebui' && textgen_settings.streaming));
}

function showStopButton() {
    $('#mes_stop').css({ 'display': 'flex' });
}

function hideStopButton() {
    // prevent NOOP, because hideStopButton() gets called multiple times
    if ($('#mes_stop').css('display') !== 'none') {
        $('#mes_stop').css({ 'display': 'none' });
        eventSource.emit(event_types.GENERATION_ENDED, chat.length);
    }
}

class StreamingProcessor {
    /**
     * Creates a new streaming processor.
     * @param {string} type Generation type
     * @param {boolean} forceName2 If true, force the use of name2
     * @param {Date} timeStarted Date when generation was started
     * @param {string} continueMessage Previous message if the type is 'continue'
     */
    constructor(type, forceName2, timeStarted, continueMessage) {
        this.result = '';
        this.messageId = -1;
        this.messageDom = null;
        this.messageTextDom = null;
        this.messageTimerDom = null;
        this.messageTokenCounterDom = null;
        /** @type {HTMLTextAreaElement} */
        this.sendTextarea = document.querySelector('#send_textarea');
        this.type = type;
        this.force_name2 = forceName2;
        this.isStopped = false;
        this.isFinished = false;
        this.generator = this.nullStreamingGeneration;
        this.abortController = new AbortController();
        this.firstMessageText = '...';
        this.timeStarted = timeStarted;
        this.continueMessage = type === 'continue' ? continueMessage : '';
        this.swipes = [];
        /** @type {import('./scripts/logprobs.js').TokenLogprobs[]} */
        this.messageLogprobs = [];
    }

    #checkDomElements(messageId) {
        if (this.messageDom === null || this.messageTextDom === null) {
            this.messageDom = document.querySelector(`#chat .mes[mesid="${messageId}"]`);
            this.messageTextDom = this.messageDom?.querySelector('.mes_text');
            this.messageTimerDom = this.messageDom?.querySelector('.mes_timer');
            this.messageTokenCounterDom = this.messageDom?.querySelector('.tokenCounterDisplay');
        }
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
            this.sendTextarea.value = '';
            this.sendTextarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
        else {
            await saveReply(this.type, text, true);
            messageId = chat.length - 1;
            this.#checkDomElements(messageId);
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
            this.sendTextarea.value = processedText;
            this.sendTextarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
        else {
            this.#checkDomElements(messageId);
            const currentTime = new Date();
            // Don't waste time calculating token count for streaming
            const currentTokenCount = isFinal && power_user.message_token_count_enabled ? getTokenCount(processedText, 0) : 0;
            const timePassed = formatGenerationTimer(this.timeStarted, currentTime, currentTokenCount);
            chat[messageId]['mes'] = processedText;
            chat[messageId]['gen_started'] = this.timeStarted;
            chat[messageId]['gen_finished'] = currentTime;

            if (currentTokenCount) {
                if (!chat[messageId]['extra']) {
                    chat[messageId]['extra'] = {};
                }

                chat[messageId]['extra']['token_count'] = currentTokenCount;
                if (this.messageTokenCounterDom instanceof HTMLElement) {
                    this.messageTokenCounterDom.textContent = `${currentTokenCount}t`;
                }
            }

            if ((this.type == 'swipe' || this.type === 'continue') && Array.isArray(chat[messageId]['swipes'])) {
                chat[messageId]['swipes'][chat[messageId]['swipe_id']] = processedText;
                chat[messageId]['swipe_info'][chat[messageId]['swipe_id']] = { 'send_date': chat[messageId]['send_date'], 'gen_started': chat[messageId]['gen_started'], 'gen_finished': chat[messageId]['gen_finished'], 'extra': JSON.parse(JSON.stringify(chat[messageId]['extra'])) };
            }

            const formattedText = messageFormatting(
                processedText,
                chat[messageId].name,
                chat[messageId].is_system,
                chat[messageId].is_user,
                messageId,
            );
            if (this.messageTextDom instanceof HTMLElement) {
                this.messageTextDom.innerHTML = formattedText;
            }
            if (this.messageTimerDom instanceof HTMLElement) {
                this.messageTimerDom.textContent = timePassed.timerValue;
                this.messageTimerDom.title = timePassed.timerTitle;
            }
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

        saveLogprobsForActiveMessage(this.messageLogprobs.filter(Boolean), this.continueMessage);
        await saveChatConditional();
        unblockGeneration();
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
        generatedPromptCache = '';
        unblockGeneration();

        const noEmitTypes = ['swipe', 'impersonate', 'continue'];
        if (!noEmitTypes.includes(this.type)) {
            eventSource.emit(event_types.MESSAGE_RECEIVED, this.messageId);
            eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, this.messageId);
        }
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

    /**
     * @returns {Generator<{ text: string, swipes: string[], logprobs: import('./scripts/logprobs.js').TokenLogprobs }, void, void>}
     */
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
            for await (const { text, swipes, logprobs } of this.generator()) {
                timestamps.push(Date.now());
                if (this.isStopped) {
                    return;
                }

                this.result = text;
                this.swipes = Array.from(swipes ?? []);
                if (logprobs) {
                    this.messageLogprobs.push(...(Array.isArray(logprobs) ? logprobs : [logprobs]));
                }
                await eventSource.emit(event_types.STREAM_TOKEN_RECEIVED, text);
                await sw.tick(() => this.onProgressStreaming(this.messageId, this.continueMessage + text));
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
 * @param {boolean} quietToLoud true to generate a message in system mode, false to generate a message in character mode
 * @param {string} [systemPrompt] System prompt to use. Only Instruct mode or OpenAI.
 * @param {number} [responseLength] Maximum response length. If unset, the global default value is used.
 * @returns {Promise<string>} Generated message
 */
export async function generateRaw(prompt, api, instructOverride, quietToLoud, systemPrompt, responseLength) {
    if (!api) {
        api = main_api;
    }

    const abortController = new AbortController();
    const responseLengthCustomized = typeof responseLength === 'number' && responseLength > 0;
    let originalResponseLength = -1;
    const isInstruct = power_user.instruct.enabled && api !== 'openai' && api !== 'novel' && !instructOverride;
    const isQuiet = true;

    if (systemPrompt) {
        systemPrompt = substituteParams(systemPrompt);
        systemPrompt = isInstruct ? formatInstructModeSystemPrompt(systemPrompt) : systemPrompt;
        prompt = api === 'openai' ? prompt : `${systemPrompt}\n${prompt}`;
    }

    prompt = substituteParams(prompt);
    prompt = api == 'novel' ? adjustNovelInstructionPrompt(prompt) : prompt;
    prompt = isInstruct ? formatInstructModeChat(name1, prompt, false, true, '', name1, name2, false) : prompt;
    prompt = isInstruct ? (prompt + formatInstructModePrompt(name2, false, '', name1, name2, isQuiet, quietToLoud)) : (prompt + '\n');

    try {
        originalResponseLength = responseLengthCustomized ? saveResponseLength(api, responseLength) : -1;
        let generateData = {};

        switch (api) {
            case 'kobold':
            case 'koboldhorde':
                if (preset_settings === 'gui') {
                    generateData = { prompt: prompt, gui_settings: true, max_length: amount_gen, max_context_length: max_context, api_server };
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
            case 'openai': {
                generateData = [{ role: 'user', content: prompt.trim() }];
                if (systemPrompt) {
                    generateData.unshift({ role: 'system', content: systemPrompt.trim() });
                }
            } break;
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
            throw new Error(data.response);
        }

        const message = cleanUpMessage(extractMessageFromData(data), false, false, true);

        if (!message) {
            throw new Error('No message generated');
        }

        return message;
    } finally {
        if (responseLengthCustomized) {
            restoreResponseLength(api, originalResponseLength);
        }
    }
}

/**
 * Temporarily change the response length for the specified API.
 * @param {string} api API to use.
 * @param {number} responseLength Target response length.
 * @returns {number} The original response length.
 */
function saveResponseLength(api, responseLength) {
    let oldValue = -1;
    if (api === 'openai') {
        oldValue = oai_settings.openai_max_tokens;
        oai_settings.openai_max_tokens = responseLength;
    } else {
        oldValue = amount_gen;
        amount_gen = responseLength;
    }
    return oldValue;
}

/**
 * Restore the original response length for the specified API.
 * @param {string} api API to use.
 * @param {number} responseLength Target response length.
 * @returns {void}
 */
function restoreResponseLength(api, responseLength) {
    if (api === 'openai') {
        oai_settings.openai_max_tokens = responseLength;
    } else {
        amount_gen = responseLength;
    }
}

/**
 * Removes last message from the chat DOM.
 * @returns {Promise<void>} Resolves when the message is removed.
 */
function removeLastMessage() {
    return new Promise((resolve) => {
        const lastMes = $('#chat').children('.mes').last();
        if (lastMes.length === 0) {
            return resolve();
        }
        lastMes.hide(animation_duration, function () {
            $(this).remove();
            resolve();
        });
    });
}

/**
 * Runs a generation using the current chat context.
 * @param {string} type Generation type
 * @param {GenerateOptions} options Generation options
 * @param {boolean} dryRun Whether to actually generate a message or just assemble the prompt
 * @returns {Promise<any>} Returns a promise that resolves when the text is done generating.
 * @typedef {{automatic_trigger?: boolean, force_name2?: boolean, quiet_prompt?: string, quietToLoud?: boolean, skipWIAN?: boolean, force_chid?: number, signal?: AbortSignal, quietImage?: string, quietName?: string }} GenerateOptions
 */
export async function Generate(type, { automatic_trigger, force_name2, quiet_prompt, quietToLoud, skipWIAN, force_chid, signal, quietImage, quietName } = {}, dryRun = false) {
    console.log('Generate entered');
    setGenerationProgress(0);
    generation_started = new Date();

    // Occurs every time, even if the generation is aborted due to slash commands execution
    await eventSource.emit(event_types.GENERATION_STARTED, type, { automatic_trigger, force_name2, quiet_prompt, quietToLoud, skipWIAN, force_chid, signal, quietImage }, dryRun);

    // Don't recreate abort controller if signal is passed
    if (!(abortController && signal)) {
        abortController = new AbortController();
    }

    // OpenAI doesn't need instruct mode. Use OAI main prompt instead.
    const isInstruct = power_user.instruct.enabled && main_api !== 'openai';
    const isImpersonate = type == 'impersonate';

    if (!(dryRun || type == 'regenerate' || type == 'swipe' || type == 'quiet')) {
        const interruptedByCommand = await processCommands(String($('#send_textarea').val()));

        if (interruptedByCommand) {
            //$("#send_textarea").val('')[0].dispatchEvent(new Event('input', { bubbles:true }));
            unblockGeneration(type);
            return Promise.resolve();
        }
    }

    // Occurs only if the generation is not aborted due to slash commands execution
    await eventSource.emit(event_types.GENERATION_AFTER_COMMANDS, type, { automatic_trigger, force_name2, quiet_prompt, quietToLoud, skipWIAN, force_chid, signal, quietImage }, dryRun);

    if (main_api == 'kobold' && kai_settings.streaming_kobold && !kai_flags.can_use_streaming) {
        toastr.error('Streaming is enabled, but the version of Kobold used does not support token streaming.', undefined, { timeOut: 10000, preventDuplicates: true });
        unblockGeneration(type);
        return Promise.resolve();
    }

    if (main_api === 'textgenerationwebui' &&
        textgen_settings.streaming &&
        textgen_settings.legacy_api &&
        textgen_settings.type === OOBA) {
        toastr.error('Streaming is not supported for the Legacy API. Update Ooba and use new API to enable streaming.', undefined, { timeOut: 10000, preventDuplicates: true });
        unblockGeneration(type);
        return Promise.resolve();
    }

    if (isHordeGenerationNotAllowed()) {
        unblockGeneration(type);
        return Promise.resolve();
    }

    if (!dryRun) {
        // Ping server to make sure it is still alive
        const pingResult = await pingServer();

        if (!pingResult) {
            unblockGeneration(type);
            toastr.error('Verify that the server is running and accessible.', 'ST Server cannot be reached');
            throw new Error('Server unreachable');
        }

        // Hide swipes if not in a dry run.
        hideSwipeButtons();
        // If generated any message, set the flag to indicate it can't be recreated again.
        chat_metadata['tainted'] = true;
    }

    if (selected_group && !is_group_generating) {
        if (!dryRun) {
            // Returns the promise that generateGroupWrapper returns; resolves when generation is done
            return generateGroupWrapper(false, type, { quiet_prompt, force_chid, signal: abortController.signal, quietImage });
        }

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
            if (menu_type != 'character_edit') setCharacterId(memberIds[0]);
            setCharacterName('');
        } else {
            console.log('No enabled members found');
            unblockGeneration(type);
            return Promise.resolve();
        }
    }

    //#########QUIET PROMPT STUFF##############
    //this function just gives special care to novel quiet instruction prompts
    if (quiet_prompt) {
        quiet_prompt = substituteParams(quiet_prompt);
        quiet_prompt = main_api == 'novel' && !quietToLoud ? adjustNovelInstructionPrompt(quiet_prompt) : quiet_prompt;
    }

    const hasBackendConnection = online_status !== 'no_connection';

    // We can't do anything because we're not in a chat right now. (Unless it's a dry run, in which case we need to
    // assemble the prompt so we can count its tokens regardless of whether a chat is active.)
    if (!dryRun && !hasBackendConnection) {
        is_send_press = false;
        return Promise.resolve();
    }

    let textareaText;
    if (type !== 'regenerate' && type !== 'swipe' && type !== 'quiet' && !isImpersonate && !dryRun) {
        is_send_press = true;
        textareaText = String($('#send_textarea').val());
        $('#send_textarea').val('')[0].dispatchEvent(new Event('input', { bubbles: true }));
    } else {
        textareaText = '';
        if (chat.length && chat[chat.length - 1]['is_user']) {
            //do nothing? why does this check exist?
        }
        else if (type !== 'quiet' && type !== 'swipe' && !isImpersonate && !dryRun && chat.length) {
            chat.length = chat.length - 1;
            await removeLastMessage();
            await eventSource.emit(event_types.MESSAGE_DELETED, chat.length);
        }
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

    // These generation types should not attach pending files to the chat
    const noAttachTypes = [
        'regenerate',
        'swipe',
        'impersonate',
        'quiet',
        'continue',
        'ask_command',
    ];
    //for normal messages sent from user..
    if ((textareaText != '' || (hasPendingFileAttachment() && !noAttachTypes.includes(type))) && !automatic_trigger && type !== 'quiet' && !dryRun) {
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

    if (main_api !== 'openai') {
        if (power_user.sysprompt.enabled) {
            system = power_user.prefer_character_prompt && system ? system : baseChatReplace(power_user.sysprompt.content, name1, name2);
            system = isInstruct ? formatInstructModeSystemPrompt(substituteParams(system, name1, name2, power_user.sysprompt.content)) : system;
        } else {
            // Nullify if it's not enabled
            system = '';
        }
    }

    // Depth prompt (character-specific A/N)
    removeDepthPrompts();
    const groupDepthPrompts = getGroupDepthPrompts(selected_group, Number(this_chid));

    if (selected_group && Array.isArray(groupDepthPrompts) && groupDepthPrompts.length > 0) {
        groupDepthPrompts.forEach((value, index) => {
            const role = getExtensionPromptRoleByName(value.role);
            setExtensionPrompt('DEPTH_PROMPT_' + index, value.text, extension_prompt_types.IN_CHAT, value.depth, extension_settings.note.allowWIScan, role);
        });
    } else {
        const depthPromptText = baseChatReplace(characters[this_chid]?.data?.extensions?.depth_prompt?.prompt?.trim(), name1, name2) || '';
        const depthPromptDepth = characters[this_chid]?.data?.extensions?.depth_prompt?.depth ?? depth_prompt_depth_default;
        const depthPromptRole = getExtensionPromptRoleByName(characters[this_chid]?.data?.extensions?.depth_prompt?.role ?? depth_prompt_role_default);
        setExtensionPrompt('DEPTH_PROMPT', depthPromptText, extension_prompt_types.IN_CHAT, depthPromptDepth, extension_settings.note.allowWIScan, depthPromptRole);
    }

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
        let options = { isPrompt: true, depth: (coreChat.length - index - 1) };

        let regexedMessage = getRegexedString(message, regexType, options);
        regexedMessage = await appendFileContent(chatItem, regexedMessage);

        if (chatItem?.extra?.append_title && chatItem?.extra?.title) {
            regexedMessage = `${regexedMessage}\n\n${chatItem.extra.title}`;
        }

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
            unblockGeneration(type);
            return Promise.resolve();
        }
    } else {
        console.debug('Skipping extension interceptors for dry run');
    }

    // Adjust token limit for Horde
    let adjustedParams;
    if (main_api == 'koboldhorde' && (horde_settings.auto_adjust_context_length || horde_settings.auto_adjust_response_length)) {
        try {
            adjustedParams = await adjustHordeGenerationParams(max_context, amount_gen);
        }
        catch {
            unblockGeneration(type);
            return Promise.resolve();
        }
        if (horde_settings.auto_adjust_context_length) {
            this_max_context = (adjustedParams.maxContextLength - adjustedParams.maxLength);
        }
    }

    console.log(`Core/all messages: ${coreChat.length}/${chat.length}`);

    // kingbri MARK: - Make sure the prompt bias isn't the same as the user bias
    if ((promptBias && !isUserPromptBias) || power_user.always_force_name2 || main_api == 'novel') {
        force_name2 = true;
    }

    if (isImpersonate) {
        force_name2 = false;
    }

    // TODO (kingbri): Migrate to a utility function
    /**
     * Parses an examples string.
     * @param {string} examplesStr
     * @returns {string[]} Examples array with block heading
     */
    function parseMesExamples(examplesStr) {
        if (examplesStr.length === 0 || examplesStr === '<START>') {
            return [];
        }

        if (!examplesStr.startsWith('<START>')) {
            examplesStr = '<START>\n' + examplesStr.trim();
        }

        const exampleSeparator = power_user.context.example_separator ? `${substituteParams(power_user.context.example_separator)}\n` : '';
        const blockHeading = main_api === 'openai' ? '<START>\n' : (exampleSeparator || (isInstruct ? '<START>\n' : ''));
        const splitExamples = examplesStr.split(/<START>/gi).slice(1).map(block => `${blockHeading}${block.trim()}\n`);

        return splitExamples;
    }

    let mesExamplesArray = parseMesExamples(mesExamples);

    //////////////////////////////////
    // Extension added strings
    // Set non-WI AN
    setFloatingPrompt();
    // Add persona description to prompt
    addPersonaDescriptionExtensionPrompt();

    // Add WI to prompt (and also inject WI to AN value via hijack)
    // Make quiet prompt available for WIAN
    setExtensionPrompt('QUIET_PROMPT', quiet_prompt || '', extension_prompt_types.IN_PROMPT, 0, true);
    const chatForWI = coreChat.map(x => world_info_include_names ? `${x.name}: ${x.mes}` : x.mes).reverse();
    const { worldInfoString, worldInfoBefore, worldInfoAfter, worldInfoExamples, worldInfoDepth } = await getWorldInfoPrompt(chatForWI, this_max_context, dryRun);
    setExtensionPrompt('QUIET_PROMPT', '', extension_prompt_types.IN_PROMPT, 0, true);

    // Add message example WI
    for (const example of worldInfoExamples) {
        const exampleMessage = example.content;

        if (exampleMessage.length === 0) {
            continue;
        }

        const formattedExample = baseChatReplace(exampleMessage, name1, name2);
        const cleanedExample = parseMesExamples(formattedExample);

        // Insert depending on before or after position
        if (example.position === wi_anchor_position.before) {
            mesExamplesArray.unshift(...cleanedExample);
        } else {
            mesExamplesArray.push(...cleanedExample);
        }
    }

    // At this point, the raw message examples can be created
    const mesExamplesRawArray = [...mesExamplesArray];

    if (mesExamplesArray && isInstruct) {
        mesExamplesArray = formatInstructModeExamples(mesExamplesArray, name1, name2);
    }

    if (skipWIAN !== true) {
        console.log('skipWIAN not active, adding WIAN');
        // Add all depth WI entries to prompt
        flushWIDepthInjections();
        if (Array.isArray(worldInfoDepth)) {
            worldInfoDepth.forEach((e) => {
                const joinedEntries = e.entries.join('\n');
                setExtensionPrompt(`customDepthWI-${e.depth}-${e.role}`, joinedEntries, extension_prompt_types.IN_CHAT, e.depth, false, e.role);
            });
        }
    } else {
        console.log('skipping WIAN');
    }

    // Inject all Depth prompts. Chat Completion does it separately
    let injectedIndices = [];
    if (main_api !== 'openai') {
        injectedIndices = doChatInject(coreChat, isContinue);
    }

    // Insert character jailbreak as the last user message (if exists, allowed, preferred, and not using Chat Completion)
    if (power_user.context.allow_jailbreak && power_user.prefer_character_jailbreak && main_api !== 'openai' && jailbreak) {
        // Set "original" explicity to empty string since there's no original
        jailbreak = substituteParams(jailbreak, name1, name2, '');

        // When continuing generation of previous output, last user message precedes the message to continue
        if (isContinue) {
            coreChat.splice(coreChat.length - 1, 0, { mes: jailbreak, is_user: true });
        }
        else {
            coreChat.push({ mes: jailbreak, is_user: true });
        }
    }

    let chat2 = [];
    let continue_mag = '';
    const userMessageIndices = [];
    const lastUserMessageIndex = coreChat.findLastIndex(x => x.is_user);

    for (let i = coreChat.length - 1, j = 0; i >= 0; i--, j++) {
        if (main_api == 'openai') {
            chat2[i] = coreChat[j].mes;
            if (i === 0 && isContinue) {
                chat2[i] = chat2[i].slice(0, chat2[i].lastIndexOf(coreChat[j].mes) + coreChat[j].mes.length);
                continue_mag = coreChat[j].mes;
            }
            continue;
        }

        chat2[i] = formatMessageHistoryItem(coreChat[j], isInstruct, false);

        if (j === 0 && isInstruct) {
            // Reformat with the first output sequence (if any)
            chat2[i] = formatMessageHistoryItem(coreChat[j], isInstruct, force_output_sequence.FIRST);
        }

        if (lastUserMessageIndex >= 0 && j === lastUserMessageIndex && isInstruct) {
            // Reformat with the last input sequence (if any)
            chat2[i] = formatMessageHistoryItem(coreChat[j], isInstruct, force_output_sequence.LAST);
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

        if (coreChat[j].is_user) {
            userMessageIndices.push(i);
        }
    }

    let addUserAlignment = isInstruct && power_user.instruct.user_alignment_message;
    let userAlignmentMessage = '';

    if (addUserAlignment) {
        const alignmentMessage = {
            name: name1,
            mes: power_user.instruct.user_alignment_message,
            is_user: true,
        };
        userAlignmentMessage = formatMessageHistoryItem(alignmentMessage, isInstruct, force_output_sequence.FIRST);
    }

    // Call combined AN into Generate
    const beforeScenarioAnchor = getExtensionPrompt(extension_prompt_types.BEFORE_PROMPT).trimStart();
    const afterScenarioAnchor = getExtensionPrompt(extension_prompt_types.IN_PROMPT);

    const storyStringParams = {
        description: description,
        personality: personality,
        persona: power_user.persona_description_position == persona_description_positions.IN_PROMPT ? persona : '',
        scenario: scenario,
        system: system,
        char: name2,
        user: name1,
        wiBefore: worldInfoBefore,
        wiAfter: worldInfoAfter,
        loreBefore: worldInfoBefore,
        loreAfter: worldInfoAfter,
        mesExamples: mesExamplesArray.join(''),
        mesExamplesRaw: mesExamplesRawArray.join(''),
    };

    const storyString = renderStoryString(storyStringParams);

    // Story string rendered, safe to remove
    if (power_user.strip_examples) {
        mesExamplesArray = [];
    }

    let oaiMessages = [];
    let oaiMessageExamples = [];

    if (main_api === 'openai') {
        oaiMessages = setOpenAIMessages(coreChat);
        oaiMessageExamples = setOpenAIMessageExamples(mesExamplesArray);
    }

    // hack for regeneration of the first message
    if (chat2.length == 0) {
        chat2.push('');
    }

    let examplesString = '';
    let chatString = addChatsPreamble(addChatsSeparator(''));
    let cyclePrompt = '';

    async function getMessagesTokenCount() {
        const encodeString = [
            beforeScenarioAnchor,
            storyString,
            afterScenarioAnchor,
            examplesString,
            userAlignmentMessage,
            chatString,
            modifyLastPromptLine(''),
            cyclePrompt,
        ].join('').replace(/\r/gm, '');
        return getTokenCountAsync(encodeString, power_user.token_padding);
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
    let arrMes = new Array(chat2.length);
    let tokenCount = await getMessagesTokenCount();
    let lastAddedIndex = -1;

    // Pre-allocate all injections first.
    // If it doesn't fit - user shot himself in the foot
    for (const index of injectedIndices) {
        const item = chat2[index];

        if (typeof item !== 'string') {
            continue;
        }

        tokenCount += await getTokenCountAsync(item.replace(/\r/gm, ''));
        if (tokenCount < this_max_context) {
            chatString = chatString + item;
            arrMes[index] = item;
            lastAddedIndex = Math.max(lastAddedIndex, index);
        } else {
            break;
        }
    }

    for (let i = 0; i < chat2.length; i++) {
        // not needed for OAI prompting
        if (main_api == 'openai') {
            break;
        }

        // Skip already injected messages
        if (arrMes[i] !== undefined) {
            continue;
        }

        const item = chat2[i];

        if (typeof item !== 'string') {
            continue;
        }

        tokenCount += await getTokenCountAsync(item.replace(/\r/gm, ''));
        if (tokenCount < this_max_context) {
            chatString = chatString + item;
            arrMes[i] = item;
            lastAddedIndex = Math.max(lastAddedIndex, i);
        } else {
            break;
        }
    }

    // Add user alignment message if last message is not a user message
    const stoppedAtUser = userMessageIndices.includes(lastAddedIndex);
    if (addUserAlignment && !stoppedAtUser) {
        tokenCount += await getTokenCountAsync(userAlignmentMessage.replace(/\r/gm, ''));
        chatString = userAlignmentMessage + chatString;
        arrMes.push(userAlignmentMessage);
        injectedIndices.push(arrMes.length - 1);
    }

    // Unsparse the array. Adjust injected indices
    const newArrMes = [];
    const newInjectedIndices = [];
    for (let i = 0; i < arrMes.length; i++) {
        if (arrMes[i] !== undefined) {
            newArrMes.push(arrMes[i]);
            if (injectedIndices.includes(i)) {
                newInjectedIndices.push(newArrMes.length - 1);
            }
        }
    }

    arrMes = newArrMes;
    injectedIndices = newInjectedIndices;

    if (main_api !== 'openai') {
        setInContextMessages(arrMes.length - injectedIndices.length, type);
    }

    // Estimate how many unpinned example messages fit in the context
    tokenCount = await getMessagesTokenCount();
    let count_exm_add = 0;
    if (!power_user.pin_examples) {
        for (let example of mesExamplesArray) {
            tokenCount += await getTokenCountAsync(example.replace(/\r/gm, ''));
            examplesString += example;
            if (tokenCount < this_max_context) {
                count_exm_add++;
            } else {
                break;
            }
        }
    }

    let mesSend = [];
    console.debug('calling runGenerate');

    if (isContinue) {
        // Coping mechanism for OAI spacing
        const isForceInstruct = isOpenRouterWithInstruct();
        if (main_api === 'openai' && !isForceInstruct && !cyclePrompt.endsWith(' ')) {
            cyclePrompt += oai_settings.continue_postfix;
            continue_mag += oai_settings.continue_postfix;
        }
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
        arrMes.forEach(function (item, i, arr) {
            // OAI doesn't need all of this
            if (main_api === 'openai') {
                return;
            }

            // Cohee: This removes a newline from the end of the last message in the context
            // Last prompt line will add a newline if it's not a continuation
            // In instruct mode it only removes it if wrap is enabled and it's not a quiet generation
            if (i === arrMes.length - 1 && type !== 'continue') {
                if (!isInstruct || (power_user.instruct.wrap && type !== 'quiet')) {
                    item = item.replace(/\n?$/, '');
                }
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
                lastMesString += quietAppend; // + power_user.instruct.output_sequence + '\n';
            } else {
                lastMesString += quietAppend;
            }


            // Ross: bailing out early prevents quiet prompts from respecting other instruct prompt toggles
            // for sysgen, SD, and summary this is desireable as it prevents the AI from responding as char..
            // but for idle prompting, we want the flexibility of the other prompt toggles, and to respect them as per settings in the extension
            // need a detection for what the quiet prompt is being asked for...

            // Bail out early?
            if (!isInstruct && !quietToLoud) {
                return lastMesString;
            }
        }


        // Get instruct mode line
        if (isInstruct && !isContinue) {
            const name = (quiet_prompt && !quietToLoud && !isImpersonate) ? (quietName ?? 'System') : (isImpersonate ? name1 : name2);
            const isQuiet = quiet_prompt && type == 'quiet';
            lastMesString += formatInstructModePrompt(name, isImpersonate, promptBias, name1, name2, isQuiet, quietToLoud);
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
        // Force name append on continue (if not continuing on user message or first message)
        const isContinuingOnFirstMessage = chat.length === 1 && isContinue;
        if (!isInstruct && force_name2 && !isContinuingOnFirstMessage) {
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
        if (!/^\s/.test(promptCache) && !isInstruct) {
            promptCache = ' ' + promptCache;
        }

        return promptCache;
    }

    async function checkPromptSize() {
        console.debug('---checking Prompt size');
        setPromptString();
        const jointMessages = mesSend.map((e) => `${e.extensionPrompts.join('')}${e.message}`).join('');
        const prompt = [
            beforeScenarioAnchor,
            storyString,
            afterScenarioAnchor,
            mesExmString,
            addChatsPreamble(addChatsSeparator(jointMessages)),
            '\n',
            modifyLastPromptLine(''),
            generatedPromptCache,
        ].join('').replace(/\r/gm, '');
        let thisPromptContextSize = await getTokenCountAsync(prompt, power_user.token_padding);

        if (thisPromptContextSize > this_max_context) {        //if the prepared prompt is larger than the max context size...
            if (count_exm_add > 0) {                            // ..and we have example mesages..
                count_exm_add--;                            // remove the example messages...
                await checkPromptSize();                            // and try agin...
            } else if (mesSend.length > 0) {                    // if the chat history is longer than 0
                mesSend.shift();                            // remove the first (oldest) chat entry..
                await checkPromptSize();                            // and check size again..
            } else {
                //end
                console.debug(`---mesSend.length = ${mesSend.length}`);
            }
        }
    }

    if (generatedPromptCache.length > 0 && main_api !== 'openai') {
        console.debug('---Generated Prompt Cache length: ' + generatedPromptCache.length);
        await checkPromptSize();
    } else {
        console.debug('---calling setPromptString ' + generatedPromptCache.length);
        setPromptString();
    }

    // Fetches the combined prompt for both negative and positive prompts
    const cfgGuidanceScale = getGuidanceScale();
    const useCfgPrompt = cfgGuidanceScale && cfgGuidanceScale.value !== 1;

    // For prompt bit itemization
    let mesSendString = '';

    function getCombinedPrompt(isNegative) {
        // Only return if the guidance scale doesn't exist or the value is 1
        // Also don't return if constructing the neutral prompt
        if (isNegative && !useCfgPrompt) {
            return;
        }

        // OAI has its own prompt manager. No need to do anything here
        if (main_api === 'openai') {
            return '';
        }

        // Deep clone
        let finalMesSend = structuredClone(mesSend);

        if (useCfgPrompt) {
            const cfgPrompt = getCfgPrompt(cfgGuidanceScale, isNegative);
            if (cfgPrompt.value) {
                if (cfgPrompt.depth === 0) {
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

        finalMesSend.forEach((item, i) => {
            item.injected = injectedIndices.includes(finalMesSend.length - i - 1);
        });

        let data = {
            api: main_api,
            combinedPrompt: null,
            description,
            personality,
            persona,
            scenario,
            char: name2,
            user: name1,
            worldInfoBefore,
            worldInfoAfter,
            beforeScenarioAnchor,
            afterScenarioAnchor,
            storyString,
            mesExmString,
            mesSendString,
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

    let finalPrompt = getCombinedPrompt(false);

    const eventData = { prompt: finalPrompt, dryRun: dryRun };
    await eventSource.emit(event_types.GENERATE_AFTER_COMBINE_PROMPTS, eventData);
    finalPrompt = eventData.prompt;

    let maxLength = Number(amount_gen); // how many tokens the AI will be requested to generate
    let thisPromptBits = [];

    let generate_data;
    switch (main_api) {
        case 'koboldhorde':
        case 'kobold':
            if (main_api == 'koboldhorde' && horde_settings.auto_adjust_response_length) {
                maxLength = Math.min(maxLength, adjustedParams.maxLength);
                maxLength = Math.max(maxLength, MIN_LENGTH); // prevent validation errors
            }

            generate_data = {
                prompt: finalPrompt,
                gui_settings: true,
                max_length: maxLength,
                max_context_length: max_context,
                api_server,
            };

            if (preset_settings != 'gui') {
                const isHorde = main_api == 'koboldhorde';
                const presetSettings = koboldai_settings[koboldai_setting_names[preset_settings]];
                const maxContext = (adjustedParams && horde_settings.auto_adjust_context_length) ? adjustedParams.maxContextLength : max_context;
                generate_data = getKoboldGenerationData(finalPrompt, presetSettings, maxLength, maxContext, isHorde, type);
            }
            break;
        case 'textgenerationwebui': {
            const cfgValues = useCfgPrompt ? { guidanceScale: cfgGuidanceScale, negativePrompt: getCombinedPrompt(true) } : null;
            generate_data = getTextGenGenerationData(finalPrompt, maxLength, isImpersonate, isContinue, cfgValues, type);
            break;
        }
        case 'novel': {
            const cfgValues = useCfgPrompt ? { guidanceScale: cfgGuidanceScale } : null;
            const presetSettings = novelai_settings[novelai_setting_names[nai_settings.preset_settings_novel]];
            generate_data = getNovelGenerationData(finalPrompt, presetSettings, maxLength, isImpersonate, isContinue, cfgValues, type);
            break;
        }
        case 'openai': {
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

            // TODO: move these side-effects somewhere else, so this switch-case solely sets generate_data
            // counts will return false if the user has not enabled the token breakdown feature
            if (counts) {
                parseTokenCounts(counts, thisPromptBits);
            }

            if (!dryRun) {
                setInContextMessages(openai_messages_count, type);
            }
            break;
        }
    }

    await eventSource.emit(event_types.GENERATE_AFTER_DATA, generate_data);

    if (dryRun) {
        generatedPromptCache = '';
        return Promise.resolve();
    }

    async function finishGenerating() {
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
            allAnchors: getAllExtensionPrompts(),
            chatInjects: injectedIndices?.map(index => arrMes[arrMes.length - index - 1])?.join('') || '',
            summarizeString: (extension_prompts['1_memory']?.value || ''),
            authorsNoteString: (extension_prompts['2_floating_prompt']?.value || ''),
            smartContextString: (extension_prompts['chromadb']?.value || ''),
            chatVectorsString: (extension_prompts['3_vectors']?.value || ''),
            dataBankVectorsString: (extension_prompts['4_vectors_data_bank']?.value || ''),
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
            instruction: main_api !== 'openai' && power_user.sysprompt.enabled ? substituteParams(power_user.prefer_character_prompt && system ? system : power_user.sysprompt.content) : '',
            userPersona: (power_user.persona_description_position == persona_description_positions.IN_PROMPT ? (persona || '') : ''),
            tokenizer: getFriendlyTokenizerName(main_api).tokenizerName || '',
        };

        //console.log(additionalPromptStuff);
        const itemizedIndex = itemizedPrompts.findIndex((item) => item.mesId === additionalPromptStuff.mesId);

        if (itemizedIndex !== -1) {
            itemizedPrompts[itemizedIndex] = additionalPromptStuff;
        }
        else {
            itemizedPrompts.push(additionalPromptStuff);
        }

        console.debug(`pushed prompt bits to itemizedPrompts array. Length is now: ${itemizedPrompts.length}`);

        if (isStreamingEnabled() && type !== 'quiet') {
            streamingProcessor = new StreamingProcessor(type, force_name2, generation_started, continue_mag);
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
                return Object.defineProperties(new String(getMessage), {
                    'messageChunk': { value: messageChunk },
                    'fromStream': { value: true },
                });
            }
        } else {
            return await sendGenerationRequest(type, generate_data);
        }
    }

    return finishGenerating().then(onSuccess, onError);

    async function onSuccess(data) {
        if (!data) return;

        if (data?.fromStream) {
            return data;
        }

        let messageChunk = '';

        if (data.error) {
            unblockGeneration(type);
            generatedPromptCache = '';

            if (data?.response) {
                toastr.error(data.response, 'API Error', { preventDuplicates: true });
            }
            throw new Error(data?.response);
        }

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

        if (isImpersonate) {
            $('#send_textarea').val(getMessage)[0].dispatchEvent(new Event('input', { bubbles: true }));
            generatedPromptCache = '';
            await eventSource.emit(event_types.IMPERSONATE_READY, getMessage);
        }
        else if (type == 'quiet') {
            unblockGeneration(type);
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

            // This relies on `saveReply` having been called to add the message to the chat, so it must be last.
            parseAndSaveLogprobs(data, continue_mag);
        }

        if (type !== 'quiet') {
            playMessageSound();
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

        console.debug('/api/chats/save called by /Generate');
        await saveChatConditional();
        unblockGeneration(type);
        streamingProcessor = null;

        if (type !== 'quiet') {
            triggerAutoContinue(messageChunk, isImpersonate);
        }

        // Don't break the API chain that expects a single string in return
        return Object.defineProperty(new String(getMessage), 'messageChunk', { value: messageChunk });
    }

    function onError(exception) {
        if (typeof exception?.error?.message === 'string') {
            toastr.error(exception.error.message, 'Error', { timeOut: 10000, extendedTimeOut: 20000 });
        }

        generatedPromptCache = '';

        unblockGeneration(type);
        console.log(exception);
        streamingProcessor = null;
        throw exception;
    }
}

/**
 * Stops the generation and any streaming if it is currently running.
 */
export function stopGeneration() {
    let stopped = false;
    if (streamingProcessor) {
        streamingProcessor.onStopStreaming();
        streamingProcessor = null;
        stopped = true;
    }
    if (abortController) {
        abortController.abort('Clicked stop button');
        hideStopButton();
        stopped = true;
    }
    eventSource.emit(event_types.GENERATION_STOPPED);
    return stopped;
}

/**
 * Injects extension prompts into chat messages.
 * @param {object[]} messages Array of chat messages
 * @param {boolean} isContinue Whether the generation is a continuation. If true, the extension prompts of depth 0 are injected at position 1.
 * @returns {number[]} Array of indices where the extension prompts were injected
 */
function doChatInject(messages, isContinue) {
    const injectedIndices = [];
    let totalInsertedMessages = 0;
    messages.reverse();

    for (let i = 0; i <= MAX_INJECTION_DEPTH; i++) {
        // Order of priority (most important go lower)
        const roles = [extension_prompt_roles.SYSTEM, extension_prompt_roles.USER, extension_prompt_roles.ASSISTANT];
        const names = {
            [extension_prompt_roles.SYSTEM]: '',
            [extension_prompt_roles.USER]: name1,
            [extension_prompt_roles.ASSISTANT]: name2,
        };
        const roleMessages = [];
        const separator = '\n';
        const wrap = false;

        for (const role of roles) {
            const extensionPrompt = String(getExtensionPrompt(extension_prompt_types.IN_CHAT, i, separator, role, wrap)).trimStart();
            const isNarrator = role === extension_prompt_roles.SYSTEM;
            const isUser = role === extension_prompt_roles.USER;
            const name = names[role];

            if (extensionPrompt) {
                roleMessages.push({
                    name: name,
                    is_user: isUser,
                    mes: extensionPrompt,
                    extra: {
                        type: isNarrator ? system_message_types.NARRATOR : null,
                    },
                });
            }
        }

        if (roleMessages.length) {
            const depth = isContinue && i === 0 ? 1 : i;
            const injectIdx = depth + totalInsertedMessages;
            messages.splice(injectIdx, 0, ...roleMessages);
            totalInsertedMessages += roleMessages.length;
            injectedIndices.push(...Array.from({ length: roleMessages.length }, (_, i) => injectIdx + i));
        }
    }

    messages.reverse();
    return injectedIndices;
}

function flushWIDepthInjections() {
    //prevent custom depth WI entries (which have unique random key names) from duplicating
    for (const key of Object.keys(extension_prompts)) {
        if (key.startsWith('customDepthWI')) {
            delete extension_prompts[key];
        }
    }
}

/**
 * Unblocks the UI after a generation is complete.
 * @param {string} [type] Generation type (optional)
 */
function unblockGeneration(type) {
    // Don't unblock if a parallel stream is still running
    if (type === 'quiet' && streamingProcessor && !streamingProcessor.isFinished) {
        return;
    }

    is_send_press = false;
    activateSendButtons();
    showSwipeButtons();
    setGenerationProgress(0);
    flushEphemeralStoppingStrings();
    flushWIDepthInjections();
}

export function getNextMessageId(type) {
    return type == 'swipe' ? chat.length - 1 : chat.length;
}

/**
 * Determines if the message should be auto-continued.
 * @param {string} messageChunk Current message chunk
 * @param {boolean} isImpersonate Is the user impersonation
 * @returns {boolean} Whether the message should be auto-continued
 */
export function shouldAutoContinue(messageChunk, isImpersonate) {
    if (!power_user.auto_continue.enabled) {
        console.debug('Auto-continue is disabled by user.');
        return false;
    }

    if (typeof messageChunk !== 'string') {
        console.debug('Not triggering auto-continue because message chunk is not a string');
        return false;
    }

    if (isImpersonate) {
        console.log('Continue for impersonation is not implemented yet');
        return false;
    }

    if (is_send_press) {
        console.debug('Auto-continue is disabled because a message is currently being sent.');
        return false;
    }

    if (power_user.auto_continue.target_length <= 0) {
        console.log('Auto-continue target length is 0, not triggering auto-continue');
        return false;
    }

    if (main_api === 'openai' && !power_user.auto_continue.allow_chat_completions) {
        console.log('Auto-continue for OpenAI is disabled by user.');
        return false;
    }

    const textareaText = String($('#send_textarea').val());
    const USABLE_LENGTH = 5;

    if (textareaText.length > 0) {
        console.log('Not triggering auto-continue because user input is not empty');
        return false;
    }

    if (messageChunk.trim().length > USABLE_LENGTH && chat.length) {
        const lastMessage = chat[chat.length - 1];
        const messageLength = getTokenCount(lastMessage.mes);
        const shouldAutoContinue = messageLength < power_user.auto_continue.target_length;

        if (shouldAutoContinue) {
            console.log(`Triggering auto-continue. Message tokens: ${messageLength}. Target tokens: ${power_user.auto_continue.target_length}. Message chunk: ${messageChunk}`);
            return true;
        } else {
            console.log(`Not triggering auto-continue. Message tokens: ${messageLength}. Target tokens: ${power_user.auto_continue.target_length}`);
            return false;
        }
    } else {
        console.log('Last generated chunk was empty, not triggering auto-continue');
        return false;
    }
}

/**
 * Triggers auto-continue if the message meets the criteria.
 * @param {string} messageChunk Current message chunk
 * @param {boolean} isImpersonate Is the user impersonation
 */
export function triggerAutoContinue(messageChunk, isImpersonate) {
    if (selected_group) {
        console.debug('Auto-continue is disabled for group chat');
        return;
    }

    if (shouldAutoContinue(messageChunk, isImpersonate)) {
        $('#option_continue').trigger('click');
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

    // Don't include a name if it's empty
    let textResult = chatItem?.name && shouldPrependName ? `${itemName}: ${chatItem.mes}\n` : `${chatItem.mes}\n`;

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
 * @param {boolean} [compact] Send as a compact display message.
 * @param {string} [name] Name of the user sending the message. Defaults to name1.
 * @param {string} [avatar] Avatar of the user sending the message. Defaults to user_avatar.
 * @returns {Promise<void>} A promise that resolves when the message is inserted.
 */
export async function sendMessageAsUser(messageText, messageBias, insertAt = null, compact = false, name = name1, avatar = user_avatar) {
    messageText = getRegexedString(messageText, regex_placement.USER_INPUT);

    const message = {
        name: name,
        is_user: true,
        is_system: false,
        send_date: getMessageTimeStamp(),
        mes: substituteParams(messageText),
        extra: {
            isSmallSys: compact,
        },
    };

    if (power_user.message_token_count_enabled) {
        message.extra.token_count = await getTokenCountAsync(message.mes, 0);
    }

    // Lock user avatar to a persona.
    if (avatar in power_user.personas) {
        message.force_avatar = getUserAvatar(avatar);
    }

    if (messageBias) {
        message.extra.bias = messageBias;
        message.mes = removeMacros(message.mes);
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
        await saveChatConditional();
    }
}

/**
 * Gets the maximum usable context size for the current API.
 * @param {number|null} overrideResponseLength Optional override for the response length.
 * @returns {number} Maximum usable context size.
 */
export function getMaxContextSize(overrideResponseLength = null) {
    if (typeof overrideResponseLength !== 'number' || overrideResponseLength <= 0 || isNaN(overrideResponseLength)) {
        overrideResponseLength = null;
    }

    let this_max_context = 1487;
    if (main_api == 'kobold' || main_api == 'koboldhorde' || main_api == 'textgenerationwebui') {
        this_max_context = (max_context - (overrideResponseLength || amount_gen));
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
        if (nai_settings.model_novel.includes('erato')) {
            // subscriber limits coming soon
            this_max_context = Math.min(max_context, 8192);

            // Added special tokens and whatnot
            this_max_context -= 1;
        }

        this_max_context = this_max_context - (overrideResponseLength || amount_gen);
    }
    if (main_api == 'openai') {
        this_max_context = oai_settings.openai_max_context - (overrideResponseLength || oai_settings.openai_max_tokens);
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
        return substituteParams(power_user.context.chat_start + '\n') + mesSendString;
    }

    else {
        return mesSendString;
    }
}

async function duplicateCharacter() {
    if (!this_chid) {
        toastr.warning('You must first select a character to duplicate!');
        return '';
    }

    const confirmMessage = $(await renderTemplateAsync('duplicateConfirm'));
    const confirm = await callGenericPopup(confirmMessage, POPUP_TYPE.CONFIRM);

    if (!confirm) {
        console.log('User cancelled duplication');
        return '';
    }

    const body = { avatar_url: characters[this_chid].avatar };
    const response = await fetch('/api/characters/duplicate', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(body),
    });
    if (response.ok) {
        toastr.success('Character Duplicated');
        const data = await response.json();
        await eventSource.emit(event_types.CHARACTER_DUPLICATED, { oldAvatar: body.avatar_url, newAvatar: data.path });
        await getCharacters();
    }

    return '';
}

export async function itemizedParams(itemizedPrompts, thisPromptSet, incomingMesId) {
    const params = {
        charDescriptionTokens: await getTokenCountAsync(itemizedPrompts[thisPromptSet].charDescription),
        charPersonalityTokens: await getTokenCountAsync(itemizedPrompts[thisPromptSet].charPersonality),
        scenarioTextTokens: await getTokenCountAsync(itemizedPrompts[thisPromptSet].scenarioText),
        userPersonaStringTokens: await getTokenCountAsync(itemizedPrompts[thisPromptSet].userPersona),
        worldInfoStringTokens: await getTokenCountAsync(itemizedPrompts[thisPromptSet].worldInfoString),
        allAnchorsTokens: await getTokenCountAsync(itemizedPrompts[thisPromptSet].allAnchors),
        summarizeStringTokens: await getTokenCountAsync(itemizedPrompts[thisPromptSet].summarizeString),
        authorsNoteStringTokens: await getTokenCountAsync(itemizedPrompts[thisPromptSet].authorsNoteString),
        smartContextStringTokens: await getTokenCountAsync(itemizedPrompts[thisPromptSet].smartContextString),
        beforeScenarioAnchorTokens: await getTokenCountAsync(itemizedPrompts[thisPromptSet].beforeScenarioAnchor),
        afterScenarioAnchorTokens: await getTokenCountAsync(itemizedPrompts[thisPromptSet].afterScenarioAnchor),
        zeroDepthAnchorTokens: await getTokenCountAsync(itemizedPrompts[thisPromptSet].zeroDepthAnchor), // TODO: unused
        thisPrompt_padding: itemizedPrompts[thisPromptSet].padding,
        this_main_api: itemizedPrompts[thisPromptSet].main_api,
        chatInjects: await getTokenCountAsync(itemizedPrompts[thisPromptSet].chatInjects),
        chatVectorsStringTokens: await getTokenCountAsync(itemizedPrompts[thisPromptSet].chatVectorsString),
        dataBankVectorsStringTokens: await getTokenCountAsync(itemizedPrompts[thisPromptSet].dataBankVectorsString),
        modelUsed: chat[incomingMesId]?.extra?.model,
        apiUsed: chat[incomingMesId]?.extra?.api,
    };

    const getFriendlyName = (value) => $(`#rm_api_block select option[value="${value}"]`).first().text() || value;

    if (params.apiUsed) {
        params.apiUsed = getFriendlyName(params.apiUsed);
    }

    if (params.this_main_api) {
        params.mainApiFriendlyName = getFriendlyName(params.this_main_api);
    }

    if (params.chatInjects) {
        params.ActualChatHistoryTokens = params.ActualChatHistoryTokens - params.chatInjects;
    }

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
        params.finalPromptTokens = await getTokenCountAsync(itemizedPrompts[thisPromptSet].finalPrompt);
        params.storyStringTokens = await getTokenCountAsync(itemizedPrompts[thisPromptSet].storyString) - params.worldInfoStringTokens;
        params.examplesStringTokens = await getTokenCountAsync(itemizedPrompts[thisPromptSet].examplesString);
        params.mesSendStringTokens = await getTokenCountAsync(itemizedPrompts[thisPromptSet].mesSendString);
        params.ActualChatHistoryTokens = params.mesSendStringTokens - (params.allAnchorsTokens - (params.beforeScenarioAnchorTokens + params.afterScenarioAnchorTokens)) + power_user.token_padding;
        params.instructionTokens = await getTokenCountAsync(itemizedPrompts[thisPromptSet].instruction);
        params.promptBiasTokens = await getTokenCountAsync(itemizedPrompts[thisPromptSet].promptBias);

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
        params.selectedTokenizer = itemizedPrompts[thisPromptSet]?.tokenizer || getFriendlyTokenizerName(params.this_main_api).tokenizerName;
    }
    return params;
}

export function findItemizedPromptSet(itemizedPrompts, incomingMesId) {
    var thisPromptSet = undefined;

    for (var i = 0; i < itemizedPrompts.length; i++) {
        console.log(`looking for ${incomingMesId} vs ${itemizedPrompts[i].mesId}`);
        if (itemizedPrompts[i].mesId === incomingMesId) {
            console.log(`found matching mesID ${i}`);
            thisPromptSet = i;
            PromptArrayItemForRawPromptDisplay = i;
            console.log(`wanting to raw display of ArrayItem: ${PromptArrayItemForRawPromptDisplay} which is mesID ${incomingMesId}`);
            console.log(itemizedPrompts[thisPromptSet]);
            break;
        } else if (itemizedPrompts[i].rawPrompt) {
            priorPromptArrayItemForRawPromptDisplay = i;
        }
    }
    return thisPromptSet;
}

async function promptItemize(itemizedPrompts, requestedMesId) {
    console.log('PROMPT ITEMIZE ENTERED');
    var incomingMesId = Number(requestedMesId);
    console.debug(`looking for MesId ${incomingMesId}`);
    var thisPromptSet = findItemizedPromptSet(itemizedPrompts, incomingMesId);

    if (thisPromptSet === undefined) {
        console.log(`couldnt find the right mesId. looked for ${incomingMesId}`);
        console.log(itemizedPrompts);
        return null;
    }

    const params = await itemizedParams(itemizedPrompts, thisPromptSet, incomingMesId);
    const flatten = (rawPrompt) => Array.isArray(rawPrompt) ? rawPrompt.map(x => x.content).join('\n') : rawPrompt;

    const template = params.this_main_api == 'openai'
        ? await renderTemplateAsync('itemizationChat', params)
        : await renderTemplateAsync('itemizationText', params);

    const popup = new Popup(template, POPUP_TYPE.TEXT);

    /** @type {HTMLElement} */
    const diffPrevPrompt = popup.dlg.querySelector('#diffPrevPrompt');
    if (priorPromptArrayItemForRawPromptDisplay) {
        diffPrevPrompt.style.display = '';
        diffPrevPrompt.addEventListener('click', function () {
            const dmp = new diff_match_patch();
            const text1 = flatten(itemizedPrompts[priorPromptArrayItemForRawPromptDisplay].rawPrompt);
            const text2 = flatten(itemizedPrompts[PromptArrayItemForRawPromptDisplay].rawPrompt);

            dmp.Diff_Timeout = 2.0;

            const d = dmp.diff_main(text1, text2);
            let ds = dmp.diff_prettyHtml(d);
            // make it readable
            ds = ds.replaceAll('background:#e6ffe6;', 'background:#b9f3b9; color:black;');
            ds = ds.replaceAll('background:#ffe6e6;', 'background:#f5b4b4; color:black;');
            ds = ds.replaceAll('&para;', '');
            const container = document.createElement('div');
            container.innerHTML = DOMPurify.sanitize(ds);
            const rawPromptWrapper = document.getElementById('rawPromptWrapper');
            rawPromptWrapper.replaceChildren(container);
            $('#rawPromptPopup').slideToggle();
        });
    } else {
        diffPrevPrompt.style.display = 'none';
    }
    popup.dlg.querySelector('#copyPromptToClipboard').addEventListener('click', function () {
        let rawPrompt = itemizedPrompts[PromptArrayItemForRawPromptDisplay].rawPrompt;
        let rawPromptValues = rawPrompt;

        if (Array.isArray(rawPrompt)) {
            rawPromptValues = rawPrompt.map(x => x.content).join('\n');
        }

        navigator.clipboard.writeText(rawPromptValues);
        toastr.info(t`Copied!`);
    });

    popup.dlg.querySelector('#showRawPrompt').addEventListener('click', function () {
        //console.log(itemizedPrompts[PromptArrayItemForRawPromptDisplay].rawPrompt);
        console.log(PromptArrayItemForRawPromptDisplay);
        console.log(itemizedPrompts);
        console.log(itemizedPrompts[PromptArrayItemForRawPromptDisplay].rawPrompt);

        const rawPrompt = flatten(itemizedPrompts[PromptArrayItemForRawPromptDisplay].rawPrompt);

        //let DisplayStringifiedPrompt = JSON.stringify(itemizedPrompts[PromptArrayItemForRawPromptDisplay].rawPrompt).replace(/\n+/g, '<br>');
        const rawPromptWrapper = document.getElementById('rawPromptWrapper');
        rawPromptWrapper.innerText = rawPrompt;
        $('#rawPromptPopup').slideToggle();
    });

    await popup.show();
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
export async function sendGenerationRequest(type, data) {
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
export async function sendStreamingRequest(type, data) {
    if (abortController?.signal?.aborted) {
        throw new Error('Generation was aborted.');
    }

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

function extractTitleFromData(data) {
    if (main_api == 'koboldhorde') {
        return data.workerName;
    }

    return undefined;
}

/**
 * parseAndSaveLogprobs receives the full data response for a non-streaming
 * generation, parses logprobs for all tokens in the message, and saves them
 * to the currently active message.
 * @param {object} data - response data containing all tokens/logprobs
 * @param {string} continueFrom - for 'continue' generations, the prompt
 *  */
function parseAndSaveLogprobs(data, continueFrom) {
    /** @type {import('./scripts/logprobs.js').TokenLogprobs[] | null} */
    let logprobs = null;

    switch (main_api) {
        case 'novel':
            // parser only handles one token/logprob pair at a time
            logprobs = data.logprobs?.map(parseNovelAILogprobs) || null;
            break;
        case 'openai':
            // OAI and other chat completion APIs must handle this earlier in
            // `sendOpenAIRequest`. `data` for these APIs is just a string with
            // the text of the generated message, logprobs are not included.
            return;
        case 'textgenerationwebui':
            switch (textgen_settings.type) {
                case textgen_types.LLAMACPP: {
                    logprobs = data?.completion_probabilities?.map(x => parseTextgenLogprobs(x.content, [x])) || null;
                } break;
                case textgen_types.VLLM:
                case textgen_types.INFERMATICAI:
                case textgen_types.APHRODITE:
                case textgen_types.MANCER:
                case textgen_types.TABBY: {
                    logprobs = parseTabbyLogprobs(data) || null;
                } break;
            } break;
        default:
            return;
    }

    saveLogprobsForActiveMessage(logprobs, continueFrom);
}

/**
 * Extracts the message from the response data.
 * @param {object} data Response data
 * @returns {string} Extracted message
 */
function extractMessageFromData(data) {
    if (typeof data === 'string') {
        return data;
    }

    switch (main_api) {
        case 'kobold':
            return data.results[0].text;
        case 'koboldhorde':
            return data.text;
        case 'textgenerationwebui':
            return data.choices?.[0]?.text ?? data.content ?? data.response ?? '';
        case 'novel':
            return data.output;
        case 'openai':
            return data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? data?.text ?? '';
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

    if (!data) {
        return swipes;
    }

    if (type === 'continue' || type === 'impersonate' || type === 'quiet') {
        return swipes;
    }

    if (main_api === 'openai' || (main_api === 'textgenerationwebui' && [MANCER, VLLM, APHRODITE, TABBY, INFERMATICAI].includes(textgen_settings.type))) {
        if (!Array.isArray(data.choices)) {
            return swipes;
        }

        const multiSwipeCount = data.choices.length - 1;

        if (multiSwipeCount <= 0) {
            return swipes;
        }

        for (let i = 1; i < data.choices.length; i++) {
            const text = data?.choices[i]?.message?.content ?? data?.choices[i]?.text ?? '';
            const cleanedText = cleanUpMessage(text, false, false, false);
            swipes.push(cleanedText);
        }
    }

    return swipes;
}

export function cleanUpMessage(getMessage, isImpersonate, isContinue, displayIncompleteSentences = false, stoppingStrings = null) {
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

    if (power_user.collapse_newlines) {
        getMessage = collapseNewlines(getMessage);
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

    const nameToTrim2 = isImpersonate
        ? (!power_user.allow_name1_display ? name1 : '')
        : (!power_user.allow_name2_display ? name2 : '');

    if (nameToTrim2 && getMessage.startsWith(nameToTrim2 + ':')) {
        getMessage = getMessage.replace(nameToTrim2 + ':', '');
        getMessage = getMessage.trimStart();
    }

    if (isImpersonate) {
        getMessage = getMessage.trim();
    }

    if (!displayIncompleteSentences && power_user.trim_sentences) {
        getMessage = trimToEndSentence(getMessage);
    }

    if (power_user.trim_spaces) {
        getMessage = getMessage.trim();
    }

    return getMessage;
}

async function saveReply(type, getMessage, fromStreaming, title, swipes) {
    if (type != 'append' && type != 'continue' && type != 'appendFinal' && chat.length && (chat[chat.length - 1]['swipe_id'] === undefined ||
        chat[chat.length - 1]['is_user'])) {
        type = 'normal';
    }

    if (chat.length && (!chat[chat.length - 1]['extra'] || typeof chat[chat.length - 1]['extra'] !== 'object')) {
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
                chat[chat.length - 1]['extra']['token_count'] = await getTokenCountAsync(chat[chat.length - 1]['mes'], 0);
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
            chat[chat.length - 1]['extra']['token_count'] = await getTokenCountAsync(chat[chat.length - 1]['mes'], 0);
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
            chat[chat.length - 1]['extra']['token_count'] = await getTokenCountAsync(chat[chat.length - 1]['mes'], 0);
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
            chat[chat.length - 1]['extra']['token_count'] = await getTokenCountAsync(chat[chat.length - 1]['mes'], 0);
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
        if (!mes.extra || typeof mes.extra !== 'object') {
            mes.extra = {};
        }
        mes.extra.image = img.image;
        mes.extra.title = img.title;
    }
}

export function getGeneratingApi() {
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
    $('#mes_impersonate').removeClass('displayNone');
    $('.mes_buttons:last').show();
    hideStopButton();
}

export function deactivateSendButtons() {
    $('#send_but').addClass('displayNone');
    $('#mes_continue').addClass('displayNone');
    $('#mes_impersonate').addClass('displayNone');
    showStopButton();
}

export function resetChatState() {
    // replaces deleted charcter name with system user since it will be displayed next.
    name2 = (this_chid === undefined && neutralCharacterName) ? neutralCharacterName : systemUserName;
    //unsets expected chid before reloading (related to getCharacters/printCharacters from using old arrays)
    this_chid = undefined;
    // sets up system user to tell user about having deleted a character
    chat.splice(0, chat.length, ...SAFETY_CHAT);
    // resets chat metadata
    chat_metadata = {};
    // resets the characters array, forcing getcharacters to reset
    characters.length = 0;
}

/**
 *
 * @param {'characters' | 'character_edit' | 'create' | 'group_edit' | 'group_create'} value
 */
export function setMenuType(value) {
    menu_type = value;
    // Allow custom CSS to see which menu type is active
    document.getElementById('right-nav-panel').dataset.menuType = menu_type;
}

export function setExternalAbortController(controller) {
    abortController = controller;
}

export function setCharacterId(value) {
    this_chid = value;
}

export function setCharacterName(value) {
    name2 = value;
}

/**
 * Sets the API connection status of the application
 * @param {string|'no_connection'} value Connection status value
 */
export function setOnlineStatus(value) {
    const previousStatus = online_status;
    online_status = value;
    displayOnlineStatus();
    if (previousStatus !== online_status) {
        eventSource.emitAndWait(event_types.ONLINE_STATUS_CHANGED, online_status);
    }
}

export function setEditedMessageId(value) {
    this_edit_mes_id = value;
}

export function setSendButtonState(value) {
    is_send_press = value;
}

export async function renameCharacter(name = null, { silent = false, renameChats = null } = {}) {
    if (!name && silent) {
        toastr.warning('No character name provided.', 'Rename Character');
        return false;
    }
    if (this_chid === undefined) {
        toastr.warning('No character selected.', 'Rename Character');
        return false;
    }

    const oldAvatar = characters[this_chid].avatar;
    const newValue = name || await callGenericPopup('<h3>New name:</h3>', POPUP_TYPE.INPUT, characters[this_chid].name);

    if (!newValue) {
        toastr.warning('No character name provided.', 'Rename Character');
        return false;
    }
    if (newValue === characters[this_chid].name) {
        toastr.info('Same character name provided, so name did not change.', 'Rename Character');
        return false;
    }

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
                const renamePastChatsConfirm = renameChats !== null ? renameChats
                    : silent ? false : await callPopup(`<h3>Character renamed!</h3>
                <p>Past chats will still contain the old character name. Would you like to update the character name in previous chats as well?</p>
                <i><b>Sprites folder (if any) should be renamed manually.</b></i>`, 'confirm');

                if (renamePastChatsConfirm) {
                    await renamePastChats(newAvatar, newValue);
                    await reloadCurrentChat();
                    toastr.success('Character renamed and past chats updated!', 'Rename Character');
                } else {
                    toastr.success('Character renamed!', 'Rename Character');
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
    catch (error) {
        // Reloading to prevent data corruption
        if (!silent) await callPopup('Something went wrong. The page will be reloaded.', 'text');
        else toastr.error('Something went wrong. The page will be reloaded.', 'Rename Character');

        console.log('Renaming character error:', error);
        location.reload();
        return false;
    }

    return true;
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

export async function saveChat(chatName, withMetadata, mesId) {
    const metadata = { ...chat_metadata, ...(withMetadata || {}) };
    const fileName = chatName ?? characters[this_chid]?.chat;

    if (!fileName && name2 === neutralCharacterName) {
        // TODO: Do something for a temporary chat with no character.
        return;
    }

    if (!fileName) {
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
            file_name: fileName,
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
            toastr.error('Check the server connection and reload the page to prevent data loss.', 'Chat could not be saved');
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

        crop_data = undefined;
        const file = input.files[0];
        const fileData = await getBase64Async(file);

        if (!power_user.never_resize_avatars) {
            const dlg = new Popup('Set the crop position of the avatar image', POPUP_TYPE.CROP, '', { cropImage: fileData });
            const croppedImage = await dlg.show();

            if (!croppedImage) {
                return;
            }

            crop_data = dlg.cropData;
            $('#avatar_load_preview').attr('src', String(croppedImage));
        } else {
            $('#avatar_load_preview').attr('src', fileData);
        }

        if (menu_type == 'create') {
            return;
        }

        await createOrEditCharacter();
        await delay(DEFAULT_SAVE_EDIT_TIMEOUT);

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

export function getThumbnailUrl(type, file) {
    return `/thumbnail?type=${type}&file=${encodeURIComponent(file)}`;
}

export function buildAvatarList(block, entities, { templateId = 'inline_avatar_template', empty = true, interactable = false, highlightFavs = true } = {}) {
    if (empty) {
        block.empty();
    }

    for (const entity of entities) {
        const id = entity.id;

        // Populate the template
        const avatarTemplate = $(`#${templateId} .avatar`).clone();

        let this_avatar = default_avatar;
        if (entity.item.avatar !== undefined && entity.item.avatar != 'none') {
            this_avatar = getThumbnailUrl('avatar', entity.item.avatar);
        }

        avatarTemplate.attr('data-type', entity.type);
        avatarTemplate.attr({ 'chid': id, 'id': `CharID${id}` });
        avatarTemplate.find('img').attr('src', this_avatar).attr('alt', entity.item.name);
        avatarTemplate.attr('title', `[Character] ${entity.item.name}\nFile: ${entity.item.avatar}`);
        if (highlightFavs) {
            avatarTemplate.toggleClass('is_fav', entity.item.fav || entity.item.fav == 'true');
            avatarTemplate.find('.ch_fav').val(entity.item.fav);
        }

        // If this is a group, we need to hack slightly. We still want to keep most of the css classes and layout, but use a group avatar instead.
        if (entity.type === 'group') {
            const grpTemplate = getGroupAvatar(entity.item);

            avatarTemplate.addClass(grpTemplate.attr('class'));
            avatarTemplate.empty();
            avatarTemplate.append(grpTemplate.children());
            avatarTemplate.attr('title', `[Group] ${entity.item.name}`);
        }

        if (interactable) {
            avatarTemplate.addClass(INTERACTABLE_CONTROL_CLASS);
            avatarTemplate.toggleClass('character_select', entity.type === 'character');
            avatarTemplate.toggleClass('group_select', entity.type === 'group');
        }

        block.append(avatarTemplate);
    }
}

export async function getChat() {
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
            chat.splice(0, chat.length, ...response);
            chat_create_date = chat[0]['create_date'];
            chat_metadata = chat[0]['chat_metadata'] ?? {};

            chat.shift();
        } else {
            chat_create_date = humanizedDateTime();
        }
        await getChatResult();
        eventSource.emit('chatLoaded', { detail: { id: this_chid, character: characters[this_chid] } });

        // Focus on the textarea if not already focused on a visible text input
        setTimeout(function () {
            if ($(document.activeElement).is('input:visible, textarea:visible')) {
                return;
            }
            $('#send_textarea').trigger('click').trigger('focus');
        }, 200);
    } catch (error) {
        await getChatResult();
        console.log(error);
    }
}

async function getChatResult() {
    name2 = characters[this_chid].name;
    let freshChat = false;
    if (chat.length === 0) {
        const message = getFirstMessage();
        if (message.mes) {
            chat.push(message);
            freshChat = true;
        }
        // Make sure the chat appears on the server
        await saveChatConditional();
    }
    await loadItemizedPrompts(getCurrentChatId());
    await printMessages();
    select_selected_character(this_chid);

    await eventSource.emit(event_types.CHAT_CHANGED, (getCurrentChatId()));
    if (freshChat) await eventSource.emit(event_types.CHAT_CREATED);

    if (chat.length === 1) {
        const chat_id = (chat.length - 1);
        await eventSource.emit(event_types.MESSAGE_RECEIVED, chat_id);
        await eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, chat_id);
    }
}

function getFirstMessage() {
    const firstMes = characters[this_chid].first_mes || '';
    const alternateGreetings = characters[this_chid]?.data?.alternate_greetings;

    const message = {
        name: name2,
        is_user: false,
        is_system: false,
        send_date: getMessageTimeStamp(),
        mes: getRegexedString(firstMes, regex_placement.AI_OUTPUT),
        extra: {},
    };

    if (Array.isArray(alternateGreetings) && alternateGreetings.length > 0) {
        const swipes = [message.mes, ...(alternateGreetings.map(greeting => getRegexedString(greeting, regex_placement.AI_OUTPUT)))];

        if (!message.mes) {
            swipes.shift();
            message.mes = swipes[0];
        }

        message['swipe_id'] = 0;
        message['swipes'] = swipes;
        message['swipe_info'] = [];
    }

    return message;
}

export async function openCharacterChat(file_name) {
    await clearChat();
    characters[this_chid]['chat'] = file_name;
    chat.length = 0;
    chat_metadata = {};
    await getChat();
    $('#selected_chat_pole').val(file_name);
    await createOrEditCharacter(new CustomEvent('newChat'));
}

////////// OPTIMZED MAIN API CHANGE FUNCTION ////////////

export function changeMainAPI() {
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
        console.debug('enabling amount_gen for ooba/novel');
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
    setOnlineStatus('no_connection');

    if (main_api == 'openai' && oai_settings.chat_completion_source == chat_completion_sources.WINDOWAI) {
        $('#api_button_openai').trigger('click');
    }

    if (main_api == 'koboldhorde') {
        getStatusHorde();
        getHordeModels(true);
    }
    validateDisabledSamplers();
    setupChatCompletionPromptManager(oai_settings);
    forceCharacterEditorTokenize();
}

export function setUserName(value) {
    name1 = value;
    if (name1 === undefined || name1 == '')
        name1 = default_user_name;
    console.log(`User name changed to ${name1}`);
    $('#your_name').val(name1);
    if (power_user.persona_show_notifications) {
        toastr.success(t`Your messages will now be sent as ${name1}`, t`Current persona updated`);
    }
    saveSettingsDebounced();
}

async function doOnboarding(avatarId) {
    const template = $('#onboarding_template .onboarding');
    let userName = await callGenericPopup(template, POPUP_TYPE.INPUT, currentUser?.name || name1, { rows: 2, wider: true, cancelButton: false });

    if (userName) {
        userName = String(userName).replace('\n', ' ');
        setUserName(userName);
        console.log(`Binding persona ${avatarId} to name ${userName}`);
        power_user.personas[avatarId] = userName;
        power_user.persona_descriptions[avatarId] = {
            description: '',
            position: persona_description_positions.IN_PROMPT,
        };
    }
}

function reloadLoop() {
    const MAX_RELOADS = 5;
    let reloads = Number(sessionStorage.getItem('reloads') || 0);
    if (reloads < MAX_RELOADS) {
        reloads++;
        sessionStorage.setItem('reloads', String(reloads));
        window.location.reload();
    }
}

//***************SETTINGS****************//
///////////////////////////////////////////
export async function getSettings() {
    const response = await fetch('/api/settings/get', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({}),
        cache: 'no-cache',
    });

    if (!response.ok) {
        reloadLoop();
        toastr.error('Settings could not be loaded after multiple attempts. Please try again later.');
        throw new Error('Error getting settings');
    }

    const data = await response.json();
    if (data.result != 'file not find' && data.settings) {
        settings = JSON.parse(data.settings);
        if (settings.username !== undefined && settings.username !== '') {
            name1 = settings.username;
            $('#your_name').val(name1);
        }

        await setUserControls(data.enable_accounts);

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
        await loadPowerUserSettings(settings, data);

        // Apply theme toggles from power user settings
        applyPowerUserSettings();

        // Load character tags
        loadTagsSettings(settings);

        // Load background
        loadBackgroundSettings(settings);

        // Load proxy presets
        loadProxyPresets(settings);

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
        initUserAvatar(settings.user_avatar);
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
            const enableAutoUpdate = Boolean(data.enable_extensions_auto_update);
            const isVersionChanged = settings.currentVersion !== currentVersion;
            await loadExtensionSettings(settings, isVersionChanged, enableAutoUpdate);
            await eventSource.emit(event_types.EXTENSION_SETTINGS_LOADED);
        }

        firstRun = !!settings.firstRun;

        if (firstRun) {
            hideLoader();
            await doOnboarding(user_avatar);
            firstRun = false;
        }
    }
    await validateDisabledSamplers();
    settingsReady = true;
    eventSource.emit(event_types.SETTINGS_LOADED);
}

function selectKoboldGuiPreset() {
    $('#settings_preset option[value=gui]')
        .attr('selected', 'true')
        .trigger('change');
}

export async function saveSettings(type) {
    if (!settingsReady) {
        console.warn('Settings not ready, aborting save');
        return;
    }

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
            proxies: proxies,
            selected_proxy: selected_proxy,
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
    const needsUnlock = (preset.max_length ?? max_context) > MAX_CONTEXT_DEFAULT || (preset.genamt ?? amount_gen) > MAX_RESPONSE_DEFAULT;
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
    } else if (mes.extra?.type === 'narrator') {
        regexPlacement = regex_placement.SLASH_COMMAND;
    } else {
        regexPlacement = regex_placement.AI_OUTPUT;
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

    const bias = substituteParams(extractMessageBias(text));
    text = substituteParams(text);
    if (bias) {
        text = removeMacros(text);
    }
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

    chat_metadata['tainted'] = true;

    return { mesBlock, text, mes, bias };
}

function openMessageDelete(fromSlashCommand) {
    closeMessageEditor();
    hideSwipeButtons();
    if (fromSlashCommand || (!is_send_press) || (selected_group && !is_group_generating)) {
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
    const { mesBlock, text, mes, bias } = updateMessage(div);

    mesBlock.find('.mes_text').val('');
    mesBlock.find('.mes_text').val(messageFormatting(
        text,
        this_edit_mes_chname,
        mes.is_system,
        mes.is_user,
        this_edit_mes_id,
    ));
    mesBlock.find('.mes_bias').empty();
    mesBlock.find('.mes_bias').append(messageFormatting(bias, '', false, false, -1));
    saveChatDebounced();
}

async function messageEditDone(div) {
    let { mesBlock, text, mes, bias } = updateMessage(div);
    if (this_edit_mes_id == 0) {
        text = substituteParams(text);
    }

    await eventSource.emit(event_types.MESSAGE_EDITED, this_edit_mes_id);
    text = chat[this_edit_mes_id]?.mes ?? text;
    mesBlock.find('.mes_text').empty();
    mesBlock.find('.mes_edit_buttons').css('display', 'none');
    mesBlock.find('.mes_buttons').css('display', '');
    mesBlock.find('.mes_text').append(
        messageFormatting(
            text,
            this_edit_mes_chname,
            mes.is_system,
            mes.is_user,
            this_edit_mes_id,
        ),
    );
    mesBlock.find('.mes_bias').empty();
    mesBlock.find('.mes_bias').append(messageFormatting(bias, '', false, false, -1));
    appendMediaToMessage(mes, div.closest('.mes'));
    addCopyToCodeBlocks(div.closest('.mes'));

    await eventSource.emit(event_types.MESSAGE_UPDATED, this_edit_mes_id);
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
 * in descending order by file name. Returns an empty array if the fetch request is unsuccessful or the
 * response is an object with an `error` property set to `true`.
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

    const data = await response.json();
    if (typeof data === 'object' && data.error === true) {
        return [];
    }

    const chats = Object.values(data);
    return chats.sort((a, b) => a['file_name'].localeCompare(b['file_name'])).reverse();
}

/**
 * Helper for `displayPastChats`, to make the same info consistently available for other functions
 */
function getCurrentChatDetails() {
    if (!characters[this_chid] && !selected_group) {
        return { sessionName: '', group: null, characterName: '', avatarImgURL: '' };
    }

    const group = selected_group ? groups.find(x => x.id === selected_group) : null;
    const currentChat = selected_group ? group?.chat_id : characters[this_chid]['chat'];
    const displayName = selected_group ? group?.name : characters[this_chid].name;
    const avatarImg = selected_group ? group?.avatar_url : getThumbnailUrl('avatar', characters[this_chid]['avatar']);
    return { sessionName: currentChat, group: group, characterName: displayName, avatarImgURL: avatarImg };
}

/**
 * Displays the past chats for a character or a group based on the selected context.
 * The function first fetches the chats, processes them, and then displays them in
 * the HTML. It also has a built-in search functionality that allows filtering the
 * displayed chats based on a search query.
 */
export async function displayPastChats() {
    $('#select_chat_div').empty();
    $('#select_chat_search').val('').off('input');

    const data = await (selected_group ? getGroupPastChats(selected_group) : getPastCharacterChats());

    if (!data) {
        toastr.error('Could not load chat data. Try reloading the page.');
        return;
    }

    const chatDetails = getCurrentChatDetails();
    const group = chatDetails.group;
    const currentChat = chatDetails.sessionName;
    const displayName = chatDetails.characterName;
    const avatarImg = chatDetails.avatarImgURL;

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

            // Make sure empty chats are displayed when there is no search query
            if (Array.isArray(chatContent) && !chatContent.length && !searchQuery) {
                return true;
            }

            // // Uncomment this to return to old behavior (classical full-substring search).
            // return chatContent && Object.values(chatContent).some(message => message?.mes?.toLowerCase()?.includes(searchQuery.toLowerCase()));

            // Fragment search a.k.a. swoop (as in `helm-swoop` in the Helm package of Emacs).
            // Split a `query` {string} into its fragments {string[]}.
            function makeQueryFragments(query) {
                let fragments = query.trim().split(/\s+/).map(str => str.trim().toLowerCase()).filter(onlyUnique);
                // fragments = fragments.filter( function(str) { return str.length >= 3; } );  // Helm does this, but perhaps better if we don't.
                return fragments;
            }
            // Check whether `text` {string} includes all of the `fragments` {string[]}.
            function matchFragments(fragments, text) {
                if (!text || !text.toLowerCase) return false;
                return fragments.every(item => text.toLowerCase().includes(item));
            }
            const fragments = makeQueryFragments(searchQuery);
            // At least one chat message must match *all* the fragments.
            // Currently, this doesn't match if the fragment matches are distributed across several chat messages.
            return chatContent && Object.values(chatContent).some(message => matchFragments(fragments, message?.mes));
        });

        console.debug(filteredData);
        for (const value of filteredData.values()) {
            let strlen = 300;
            let mes = value['mes'];

            if (mes !== undefined) {
                if (mes.length > strlen) {
                    mes = '...' + mes.substring(mes.length - strlen);
                }
                const fileSize = value['file_size'];
                const fileName = value['file_name'];
                const chatItems = rawChats[fileName].length;
                const timestamp = timestampToMoment(value['last_mes']).format('lll');
                const template = $('#past_chat_template .select_chat_block_wrapper').clone();
                template.find('.select_chat_block').attr('file_name', fileName);
                template.find('.avatar img').attr('src', avatarImg);
                template.find('.select_chat_block_filename').text(fileName);
                template.find('.chat_file_size').text(`(${fileSize},`);
                template.find('.chat_messages_num').text(`${chatItems}💬)`);
                template.find('.select_chat_block_mes').text(mes);
                template.find('.PastChat_cross').attr('file_name', fileName);
                template.find('.chat_messages_date').text(timestamp);

                if (selected_group) {
                    template.find('.avatar img').replaceWith(getGroupAvatar(group));
                }

                $('#select_chat_div').append(template);

                if (currentChat === fileName.toString().replace('.jsonl', '')) {
                    $('#select_chat_div').find('.select_chat_block:last').attr('highlight', String(true));
                }
            }
        }
    };
    displayChats('');  // Display all by default

    const debouncedDisplay = debounce((searchQuery) => {
        displayChats(searchQuery);
    });

    // Define the search input listener
    $('#select_chat_search').on('input', function () {
        const searchQuery = $(this).val();
        debouncedDisplay(searchQuery);
    });

    // UX convenience: Focus the search field when the Manage Chat Files view opens.
    setTimeout(function () {
        const textSearchElement = $('#select_chat_search');
        textSearchElement.click();
        textSearchElement.focus();
        textSearchElement.select();  // select content (if any) for easy erasing
    }, 200);
}

export function selectRightMenuWithAnimation(selectedMenuId) {
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

export function select_rm_info(type, charId, previousCharId = null) {
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
            const avatarFileName = `${charId}.png`;
            const charData = getEntitiesList({ doFilter: true });
            const charIndex = charData.findIndex((x) => x?.item?.avatar?.startsWith(avatarFileName));

            if (charIndex === -1) {
                console.log(`Could not find character ${charId} in the list`);
                return;
            }

            try {
                const perPage = Number(localStorage.getItem('Characters_PerPage')) || per_page_default;
                const page = Math.floor(charIndex / perPage) + 1;
                const selector = `#rm_print_characters_block [title*="${avatarFileName}"]`;
                $('#rm_print_characters_pagination').pagination('go', page);

                waitUntilCondition(() => document.querySelector(selector) !== null).then(() => {
                    const element = $(selector).parent();

                    if (element.length === 0) {
                        console.log(`Could not find element for character ${charId}`);
                        return;
                    }

                    const scrollOffset = element.offset().top - element.parent().offset().top;
                    element.parent().scrollTop(scrollOffset);
                    flashHighlight(element, 5000);
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
                    flashHighlight(element, 5000);
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
    setMenuType('character_edit');
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

    $('#character_popup-button-h3').text(characters[chid].name);
    $('#character_name_pole').val(characters[chid].name);
    $('#description_textarea').val(characters[chid].description);
    $('#character_world').val(characters[chid].data?.extensions?.world || '');
    $('#creator_notes_textarea').val(characters[chid].data?.creator_notes || characters[chid].creatorcomment);
    $('#creator_notes_spoiler').html(DOMPurify.sanitize(converter.makeHtml(substituteParams(characters[chid].data?.creator_notes) || characters[chid].creatorcomment), { MESSAGE_SANITIZE: true }));
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
    $('#depth_prompt_role').val(characters[chid].data?.extensions?.depth_prompt?.role ?? depth_prompt_role_default);
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

    const externalMediaState = isExternalMediaAllowed();
    $('#character_open_media_overrides').toggle(!selected_group);
    $('#character_media_allowed_icon').toggle(externalMediaState);
    $('#character_media_forbidden_icon').toggle(!externalMediaState);

    saveSettingsDebounced();
}

function select_rm_create() {
    setMenuType('create');

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
    $('#character_popup-button-h3').text('Create character');
    $('#character_name_pole').val(create_save.name);
    $('#description_textarea').val(create_save.description);
    $('#character_world').val(create_save.world);
    $('#creator_notes_textarea').val(create_save.creator_notes);
    $('#creator_notes_spoiler').html(DOMPurify.sanitize(converter.makeHtml(create_save.creator_notes), { MESSAGE_SANITIZE: true }));
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
    $('#depth_prompt_role').val(create_save.depth_prompt_role);
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
    $('#character_open_media_overrides').hide();
}

function select_rm_characters() {
    const doFullRefresh = menu_type === 'characters';
    setMenuType('characters');
    selectRightMenuWithAnimation('rm_characters_block');
    printCharacters(doFullRefresh);
}

/**
 * Sets a prompt injection to insert custom text into any outgoing prompt. For use in UI extensions.
 * @param {string} key Prompt injection id.
 * @param {string} value Prompt injection value.
 * @param {number} position Insertion position. 0 is after story string, 1 is in-chat with custom depth.
 * @param {number} depth Insertion depth. 0 represets the last message in context. Expected values up to MAX_INJECTION_DEPTH.
 * @param {number} role Extension prompt role. Defaults to SYSTEM.
 * @param {boolean} scan Should the prompt be included in the world info scan.
 */
export function setExtensionPrompt(key, value, position, depth, scan = false, role = extension_prompt_roles.SYSTEM) {
    extension_prompts[key] = {
        value: String(value),
        position: Number(position),
        depth: Number(depth),
        scan: !!scan,
        role: Number(role ?? extension_prompt_roles.SYSTEM),
    };
}

/**
 * Gets a enum value of the extension prompt role by its name.
 * @param {string} roleName The name of the extension prompt role.
 * @returns {number} The role id of the extension prompt.
 */
export function getExtensionPromptRoleByName(roleName) {
    // If the role is already a valid number, return it
    if (typeof roleName === 'number' && Object.values(extension_prompt_roles).includes(roleName)) {
        return roleName;
    }

    switch (roleName) {
        case 'system':
            return extension_prompt_roles.SYSTEM;
        case 'user':
            return extension_prompt_roles.USER;
        case 'assistant':
            return extension_prompt_roles.ASSISTANT;
    }

    // Skill issue?
    return extension_prompt_roles.SYSTEM;
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
export function updateChatMetadata(newValues, reset) {
    chat_metadata = reset ? { ...newValues } : { ...chat_metadata, ...newValues };
}

function updateFavButtonState(state) {
    fav_ch_checked = state;
    $('#fav_checkbox').val(fav_ch_checked);
    $('#favorite_button').toggleClass('fav_on', fav_ch_checked);
    $('#favorite_button').toggleClass('fav_off', !fav_ch_checked);
}

export async function setScenarioOverride() {
    if (!selected_group && !this_chid) {
        console.warn('setScenarioOverride() -- no selected group or character');
        return;
    }

    const metadataValue = chat_metadata['scenario'] || '';
    const isGroup = !!selected_group;

    const $template = $(await renderTemplateAsync('scenarioOverride'));
    $template.find('[data-group="true"]').toggle(isGroup);
    $template.find('[data-character="true"]').toggle(!isGroup);
    // TODO: Why does this save on every character input? Save on popup close
    $template.find('.chat_scenario').val(metadataValue).on('input', onScenarioOverrideInput);
    $template.find('.remove_scenario_override').on('click', onScenarioOverrideRemoveClick);

    await callGenericPopup($template, POPUP_TYPE.TEXT, '');
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
 * @typedef {{okButton?: string, rows?: number, wide?: boolean, wider?: boolean, large?: boolean, allowHorizontalScrolling?: boolean, allowVerticalScrolling?: boolean, cropAspect?: number }} PopupOptions - Options for the popup.
 * @returns {Promise<any>} A promise that resolves when the popup is closed.
 * @deprecated Use `callGenericPopup` instead.
 */
export function callPopup(text, type, inputValue = '', { okButton, rows, wide, wider, large, allowHorizontalScrolling, allowVerticalScrolling, cropAspect } = {}) {
    function getOkButtonText() {
        if (['text', 'alternate_greeting', 'char_not_selected'].includes(popup_type)) {
            $dialoguePopupCancel.css('display', 'none');
            return okButton ?? 'Ok';
        } else if (['delete_extension'].includes(popup_type)) {
            return okButton ?? 'Ok';
        } else if (['new_chat', 'confirm'].includes(popup_type)) {
            return okButton ?? 'Yes';
        } else if (['input'].includes(popup_type)) {
            return okButton ?? 'Save';
        }
        return okButton ?? 'Delete';
    }

    dialogueCloseStop = true;
    if (type) {
        popup_type = type;
    }

    const $dialoguePopup = $('#dialogue_popup');
    const $dialoguePopupCancel = $('#dialogue_popup_cancel');
    const $dialoguePopupOk = $('#dialogue_popup_ok');
    const $dialoguePopupInput = $('#dialogue_popup_input');
    const $dialoguePopupText = $('#dialogue_popup_text');
    const $shadowPopup = $('#shadow_popup');

    $dialoguePopup.toggleClass('wide_dialogue_popup', !!wide)
        .toggleClass('wider_dialogue_popup', !!wider)
        .toggleClass('large_dialogue_popup', !!large)
        .toggleClass('horizontal_scrolling_dialogue_popup', !!allowHorizontalScrolling)
        .toggleClass('vertical_scrolling_dialogue_popup', !!allowVerticalScrolling);

    $dialoguePopupCancel.css('display', 'inline-block');
    $dialoguePopupOk.text(getOkButtonText());
    $dialoguePopupInput.toggle(popup_type === 'input').val(inputValue).attr('rows', rows ?? 1);
    $dialoguePopupText.empty().append(text);
    $shadowPopup.css('display', 'block');

    if (popup_type == 'input') {
        $dialoguePopupInput.trigger('focus');
    }

    $shadowPopup.transition({
        opacity: 1,
        duration: animation_duration,
        easing: animation_easing,
    });

    return new Promise((resolve) => {
        dialogueResolve = resolve;
    });
}

export function showSwipeButtons() {
    if (chat.length === 0) {
        return;
    }

    if (
        chat[chat.length - 1].is_system ||
        !swipes ||
        Number($('.mes:last').attr('mesid')) < 0 ||
        chat[chat.length - 1].is_user ||
        chat[chat.length - 1].extra?.image ||
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

    const currentMessage = $('#chat').children().filter(`[mesid="${chat.length - 1}"]`);
    const swipeId = chat[chat.length - 1].swipe_id;
    const swipeCounterText = (`${(swipeId + 1)}\u200B/\u200b${(chat[chat.length - 1].swipes.length)}`);

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

    $('.swipes-counter').text(swipeCounterText);

    //console.log(swipeId);
    //console.log(chat[chat.length - 1].swipes.length);
}

export function hideSwipeButtons() {
    //console.log('hideswipebuttons entered');
    $('#chat').find('.swipe_right').css('display', 'none');
    $('#chat').find('.swipe_left').css('display', 'none');
}

/**
 * Deletes a swipe from the chat.
 *
 * @param {number?} swipeId - The ID of the swipe to delete. If not provided, the current swipe will be deleted.
 * @returns {Promise<number>|undefined} - The ID of the new swipe after deletion.
 */
export async function deleteSwipe(swipeId = null) {
    if (swipeId && (isNaN(swipeId) || swipeId < 0)) {
        toastr.warning(`Invalid swipe ID: ${swipeId + 1}`);
        return;
    }

    const lastMessage = chat[chat.length - 1];
    if (!lastMessage || !Array.isArray(lastMessage.swipes) || !lastMessage.swipes.length) {
        toastr.warning('No messages to delete swipes from.');
        return;
    }

    if (lastMessage.swipes.length <= 1) {
        toastr.warning('Can\'t delete the last swipe.');
        return;
    }

    swipeId = swipeId ?? lastMessage.swipe_id;

    if (swipeId < 0 || swipeId >= lastMessage.swipes.length) {
        toastr.warning(`Invalid swipe ID: ${swipeId + 1}`);
        return;
    }

    lastMessage.swipes.splice(swipeId, 1);

    if (Array.isArray(lastMessage.swipe_info) && lastMessage.swipe_info.length) {
        lastMessage.swipe_info.splice(swipeId, 1);
    }

    // Select the next swip, or the one before if it was the last one
    const newSwipeId = Math.min(swipeId, lastMessage.swipes.length - 1);
    lastMessage.swipe_id = newSwipeId;
    lastMessage.mes = lastMessage.swipes[newSwipeId];

    await saveChatConditional();
    await reloadCurrentChat();

    return newSwipeId;
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
        await waitUntilCondition(() => !isChatSaving, DEFAULT_SAVE_EDIT_TIMEOUT, 100);
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

export function setGenerationProgress(progress) {
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
                    const data = JSON.parse(String($('#character_json_data').val()));

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
        array.push('');
        addAlternateGreeting(template, '', index, getArray);
        updateAlternateGreetingsHintVisibility(template);
    });

    updateAlternateGreetingsHintVisibility(template);
    callPopup(template, 'alternate_greeting', '', { wide: true, large: true });
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

/**
 * Creates or edits a character based on the form data.
 * @param {Event} [e] Event that triggered the function call.
 */
async function createOrEditCharacter(e) {
    $('#rm_info_avatar').html('');
    const formData = new FormData($('#form_create').get(0));
    formData.set('fav', String(fav_ch_checked));
    const isNewChat = e instanceof CustomEvent && e.type === 'newChat';

    const rawFile = formData.get('avatar');
    if (rawFile instanceof File) {
        const convertedFile = await ensureImageFormatSupported(rawFile);
        formData.set('avatar', convertedFile);
    }

    const headers = getRequestHeaders();
    delete headers['Content-Type'];

    if ($('#form_create').attr('actiontype') == 'createcharacter') {
        if (String($('#character_name_pole').val()).length === 0) {
            toastr.error('Name is required');
            return;
        }
        if (is_group_generating || is_send_press) {
            toastr.error('Cannot create characters while generating. Stop the request and try again.', 'Creation aborted');
            return;
        }
        try {
            //if the character name text area isn't empty (only posible when creating a new character)
            let url = '/api/characters/create';

            if (crop_data != undefined) {
                url += `?crop=${encodeURIComponent(JSON.stringify(crop_data))}`;
            }

            formData.delete('alternate_greetings');
            for (const value of create_save.alternate_greetings) {
                formData.append('alternate_greetings', value);
            }

            formData.append('extensions', JSON.stringify(create_save.extensions));

            const fetchResult = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: formData,
                cache: 'no-cache',
            });

            if (!fetchResult.ok) {
                throw new Error('Fetch result is not ok');
            }

            const avatarId = await fetchResult.text();

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
                { id: '#depth_prompt_role', callback: value => create_save.depth_prompt_role = value, defaultValue: depth_prompt_role_default },
                { id: '#mes_example_textarea', callback: value => create_save.mes_example = value },
                { id: '#character_json_data', callback: () => { } },
                { id: '#alternate_greetings_template', callback: value => create_save.alternate_greetings = value, defaultValue: [] },
                { id: '#character_world', callback: value => create_save.world = value },
                { id: '#_character_extensions_fake', callback: value => create_save.extensions = {} },
            ];

            fields.forEach(field => {
                const fieldValue = field.defaultValue !== undefined ? field.defaultValue : '';
                $(field.id).val(fieldValue);
                field.callback && field.callback(fieldValue);
            });

            $('#character_popup-button-h3').text('Create character');

            create_save.avatar = '';

            $('#add_avatar_button').replaceWith(
                $('#add_avatar_button').val('').clone(true),
            );

            let oldSelectedChar = null;
            if (this_chid !== undefined) {
                oldSelectedChar = characters[this_chid].avatar;
            }

            console.log(`new avatar id: ${avatarId}`);
            createTagMapFromList('#tagList', avatarId);
            await getCharacters();

            select_rm_info('char_create', avatarId, oldSelectedChar);

            crop_data = undefined;

        } catch (error) {
            console.error('Error creating character', error);
            toastr.error('Failed to create character');
        }
    } else {
        try {
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

            const fetchResult = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: formData,
                cache: 'no-cache',
            });

            if (!fetchResult.ok) {
                throw new Error('Fetch result is not ok');
            }

            await getOneCharacter(formData.get('avatar_url'));
            favsToHotswap(); // Update fav state

            $('#add_avatar_button').replaceWith(
                $('#add_avatar_button').val('').clone(true),
            );
            $('#create_button').attr('value', 'Save');
            crop_data = undefined;
            await eventSource.emit(event_types.CHARACTER_EDITED, { detail: { id: this_chid, character: characters[this_chid] } });

            // Recreate the chat if it hasn't been used at least once (i.e. with continue).
            const message = getFirstMessage();
            const shouldRegenerateMessage =
                !isNewChat &&
                message.mes &&
                !selected_group &&
                !chat_metadata['tainted'] &&
                (chat.length === 0 || (chat.length === 1 && !chat[0].is_user && !chat[0].is_system));

            if (shouldRegenerateMessage) {
                chat.splice(0, chat.length, message);
                const messageId = (chat.length - 1);
                await eventSource.emit(event_types.MESSAGE_RECEIVED, messageId);
                await clearChat();
                await printMessages();
                await eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, messageId);
                await saveChatConditional();
            }
        } catch (error) {
            console.log(error);
            toastr.error('Something went wrong while saving the character, or the image file provided was in an invalid format. Double check that the image is not a webp.');
        }
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
        renameChat: renameChat,
        saveSettingsDebounced: saveSettingsDebounced,
        onlineStatus: online_status,
        maxContext: Number(max_context),
        chatMetadata: chat_metadata,
        streamingProcessor,
        eventSource: eventSource,
        eventTypes: event_types,
        addOneMessage: addOneMessage,
        generate: Generate,
        sendStreamingRequest: sendStreamingRequest,
        sendGenerationRequest: sendGenerationRequest,
        stopGeneration: stopGeneration,
        getTokenCount: getTokenCount,
        extensionPrompts: extension_prompts,
        setExtensionPrompt: setExtensionPrompt,
        updateChatMetadata: updateChatMetadata,
        saveChat: saveChatConditional,
        openCharacterChat: openCharacterChat,
        openGroupChat: openGroupChat,
        saveMetadata: saveMetadata,
        sendSystemMessage: sendSystemMessage,
        activateSendButtons,
        deactivateSendButtons,
        saveReply,
        substituteParams,
        substituteParamsExtended,
        SlashCommandParser,
        executeSlashCommandsWithOptions,
        /** @deprecated Use SlashCommandParser.addCommandObject() instead */
        registerSlashCommand: registerSlashCommand,
        /** @deprecated Use executeSlashCommandWithOptions instead */
        executeSlashCommands: executeSlashCommands,
        timestampToMoment: timestampToMoment,
        /** @deprecated Handlebars for extensions are no longer supported. */
        registerHelper: () => { },
        registerMacro: MacrosParser.registerMacro.bind(MacrosParser),
        unregisterMacro: MacrosParser.unregisterMacro.bind(MacrosParser),
        registerDebugFunction: registerDebugFunction,
        /** @deprecated Use renderExtensionTemplateAsync instead. */
        renderExtensionTemplate: renderExtensionTemplate,
        renderExtensionTemplateAsync: renderExtensionTemplateAsync,
        registerDataBankScraper: ScraperManager.registerDataBankScraper,
        /** @deprecated Use callGenericPopup or Popup instead. */
        callPopup: callPopup,
        callGenericPopup: callGenericPopup,
        showLoader: showLoader,
        hideLoader: hideLoader,
        mainApi: main_api,
        extensionSettings: extension_settings,
        ModuleWorkerWrapper: ModuleWorkerWrapper,
        getTokenizerModel: getTokenizerModel,
        generateQuietPrompt: generateQuietPrompt,
        writeExtensionField: writeExtensionField,
        getThumbnailUrl: getThumbnailUrl,
        selectCharacterById: selectCharacterById,
        messageFormatting: messageFormatting,
        shouldSendOnEnter: shouldSendOnEnter,
        isMobile: isMobile,
        t: t,
        translate: translate,
        tags: tags,
        tagMap: tag_map,
        menuType: menu_type,
        createCharacterData: create_save,
        /** @deprecated Legacy snake-case naming, compatibility with old extensions */
        event_types: event_types,
        Popup: Popup,
        POPUP_TYPE: POPUP_TYPE,
        POPUP_RESULT: POPUP_RESULT,
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
            duration: animation_duration > 0 ? swipe_duration : 0,
            easing: animation_easing,
            queue: false,
            complete: async function () {
                const is_animation_scroll = ($('#chat').scrollTop() >= ($('#chat').prop('scrollHeight') - $('#chat').outerHeight()) - 10);
                //console.log('on left swipe click calling addOneMessage');
                addOneMessage(chat[chat.length - 1], { type: 'swipe' });

                if (power_user.message_token_count_enabled) {
                    if (!chat[chat.length - 1].extra) {
                        chat[chat.length - 1].extra = {};
                    }

                    const swipeMessage = $('#chat').find(`[mesid="${chat.length - 1}"]`);
                    const tokenCount = await getTokenCountAsync(chat[chat.length - 1].mes, 0);
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
                            duration: animation_duration > 0 ? swipe_duration : 0,
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
            duration: animation_duration > 0 ? swipe_duration : 0,
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
                            duration: animation_duration > 0 ? swipe_duration : 0,
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

    const currentMessage = $('#chat').children().filter(`[mesid="${chat.length - 1}"]`);
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
            duration: animation_duration > 0 ? swipe_duration : 0,
            easing: animation_easing,
            queue: false,
            complete: async function () {
                /*if (!selected_group) {
                    var typingIndicator = $("#typing_indicator_template .typing_indicator").clone();
                    typingIndicator.find(".typing_indicator_name").text(characters[this_chid].name);
                } */
                /* $("#chat").append(typingIndicator); */
                const is_animation_scroll = ($('#chat').scrollTop() >= ($('#chat').prop('scrollHeight') - $('#chat').outerHeight()) - 10);
                //console.log(parseInt(chat[chat.length-1]['swipe_id']));
                //console.log(chat[chat.length-1]['swipes'].length);
                const swipeMessage = $('#chat').find('[mesid="' + (chat.length - 1) + '"]');
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

                        const tokenCount = await getTokenCountAsync(chat[chat.length - 1].mes, 0);
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
                            duration: animation_duration > 0 ? swipe_duration : 0,
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
            duration: animation_duration > 0 ? swipe_duration : 0,
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
                            duration: animation_duration > 0 ? swipe_duration : 0,
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
    // Default APIs not contined inside text gen / chat gen
    'kobold': {
        selected: 'kobold',
        button: '#api_button',
    },
    'horde': {
        selected: 'koboldhorde',
    },
    'novel': {
        selected: 'novel',
        button: '#api_button_novel',
    },
    // KoboldCpp alias
    'kcpp': {
        selected: 'textgenerationwebui',
        button: '#api_button_textgenerationwebui',
        type: textgen_types.KOBOLDCPP,
    },
    // OpenAI alias
    'oai': {
        selected: 'openai',
        button: '#api_button_openai',
        source: chat_completion_sources.OPENAI,
    },
    // Google alias
    'google': {
        selected: 'openai',
        button: '#api_button_openai',
        source: chat_completion_sources.MAKERSUITE,
    },
    // OpenRouter special naming, to differentiate between chat comp and text comp
    'openrouter': {
        selected: 'openai',
        button: '#api_button_openai',
        source: chat_completion_sources.OPENROUTER,
    },
    'openrouter-text': {
        selected: 'textgenerationwebui',
        button: '#api_button_textgenerationwebui',
        type: textgen_types.OPENROUTER,
    },
};

// Collect all unique API names in an array
export const UNIQUE_APIS = [...new Set(Object.values(CONNECT_API_MAP).map(x => x.selected))];

// Fill connections map from textgen_types and chat_completion_sources
for (const textGenType of Object.values(textgen_types)) {
    if (CONNECT_API_MAP[textGenType]) continue;
    CONNECT_API_MAP[textGenType] = {
        selected: 'textgenerationwebui',
        button: '#api_button_textgenerationwebui',
        type: textGenType,
    };
}
for (const chatCompletionSource of Object.values(chat_completion_sources)) {
    if (CONNECT_API_MAP[chatCompletionSource]) continue;
    CONNECT_API_MAP[chatCompletionSource] = {
        selected: 'openai',
        button: '#api_button_openai',
        source: chatCompletionSource,
    };
}

async function selectContextCallback(args, name) {
    if (!name) {
        return power_user.context.preset;
    }

    const quiet = isTrueBoolean(args?.quiet);
    const contextNames = context_presets.map(preset => preset.name);
    const fuse = new Fuse(contextNames);
    const result = fuse.search(name);

    if (result.length === 0) {
        !quiet && toastr.warning(`Context template "${name}" not found`);
        return '';
    }

    const foundName = result[0].item;
    selectContextPreset(foundName, { quiet: quiet });
    return foundName;
}

async function selectInstructCallback(args, name) {
    if (!name) {
        return power_user.instruct.enabled || isTrueBoolean(args?.forceGet) ? power_user.instruct.preset : '';
    }

    const quiet = isTrueBoolean(args?.quiet);
    const instructNames = instruct_presets.map(preset => preset.name);
    const fuse = new Fuse(instructNames);
    const result = fuse.search(name);

    if (result.length === 0) {
        !quiet && toastr.warning(`Instruct template "${name}" not found`);
        return '';
    }

    const foundName = result[0].item;
    selectInstructPreset(foundName, { quiet: quiet });
    return foundName;
}

async function enableInstructCallback() {
    $('#instruct_enabled').prop('checked', true).trigger('input').trigger('change');
    return '';
}

async function disableInstructCallback() {
    $('#instruct_enabled').prop('checked', false).trigger('input').trigger('change');
    return '';
}

/**
 * @param {string} text API name
 */
async function connectAPISlash(args, text) {
    if (!text.trim()) {
        for (const [key, config] of Object.entries(CONNECT_API_MAP)) {
            if (config.selected !== main_api) continue;

            if (config.source) {
                if (oai_settings.chat_completion_source === config.source) {
                    return key;
                } else {
                    continue;
                }
            }

            if (config.type) {
                if (textgen_settings.type === config.type) {
                    return key;
                } else {
                    continue;
                }
            }

            return key;
        }

        console.error('FIXME: The current API is not in the API map');
        return '';
    }

    const apiConfig = CONNECT_API_MAP[text.toLowerCase()];
    if (!apiConfig) {
        toastr.error(`Error: ${text} is not a valid API`);
        return '';
    }

    let connectionRequired = false;

    if (main_api !== apiConfig.selected) {
        $(`#main_api option[value='${apiConfig.selected || text}']`).prop('selected', true);
        $('#main_api').trigger('change');
        connectionRequired = true;
    }

    if (apiConfig.source && oai_settings.chat_completion_source !== apiConfig.source) {
        $(`#chat_completion_source option[value='${apiConfig.source}']`).prop('selected', true);
        $('#chat_completion_source').trigger('change');
        connectionRequired = true;
    }

    if (apiConfig.type && textgen_settings.type !== apiConfig.type) {
        $(`#textgen_type option[value='${apiConfig.type}']`).prop('selected', true);
        $('#textgen_type').trigger('change');
        connectionRequired = true;
    }

    if (connectionRequired && apiConfig.button) {
        $(apiConfig.button).trigger('click');
    }

    const quiet = isTrueBoolean(args?.quiet);
    const toast = quiet ? jQuery() : toastr.info(`API set to ${text}, trying to connect..`);

    try {
        await waitUntilCondition(() => online_status !== 'no_connection', 10000, 100);
        console.log('Connection successful');
    } catch {
        console.log('Could not connect after 10 seconds, skipping.');
    }

    toastr.clear(toast);
    return text;
}

/**
 * Imports supported files dropped into the app window.
 * @param {File[]} files Array of files to process
 * @param {Map<File, string>} [data] Extra data to pass to the import function
 * @returns {Promise<void>}
 */
export async function processDroppedFiles(files, data = new Map()) {
    const allowedMimeTypes = [
        'application/json',
        'image/png',
        'application/yaml',
        'application/x-yaml',
        'text/yaml',
        'text/x-yaml',
    ];

    const allowedExtensions = [
        'charx',
    ];

    for (const file of files) {
        const extension = file.name.split('.').pop().toLowerCase();
        if (allowedMimeTypes.some(x => file.type.startsWith(x)) || allowedExtensions.includes(extension)) {
            const preservedName = data instanceof Map && data.get(file);
            await importCharacter(file, preservedName);
        } else {
            toastr.warning('Unsupported file type: ' + file.name);
        }
    }
}

/**
 * Imports a character from a file.
 * @param {File} file File to import
 * @param {string?} preserveFileName Whether to preserve original file name
 * @returns {Promise<void>}
 */
async function importCharacter(file, preserveFileName = '') {
    if (is_group_generating || is_send_press) {
        toastr.error('Cannot import characters while generating. Stop the request and try again.', 'Import aborted');
        throw new Error('Cannot import character while generating');
    }

    const ext = file.name.match(/\.(\w+)$/);
    if (!ext || !(['json', 'png', 'yaml', 'yml', 'charx'].includes(ext[1].toLowerCase()))) {
        return;
    }

    const format = ext[1].toLowerCase();
    $('#character_import_file_type').val(format);
    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('file_type', format);
    if (preserveFileName) formData.append('preserved_name', preserveFileName);

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
        if (this_chid !== undefined) {
            oldSelectedChar = characters[this_chid].avatar;
        }

        await getCharacters();
        select_rm_info('char_import', data.file_name, oldSelectedChar);
        if (power_user.tag_import_setting !== tag_import_setting.NONE) {
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

async function doImpersonate(args, prompt) {
    const options = prompt?.trim() ? { quiet_prompt: prompt.trim(), quietToLoud: true } : {};
    const shouldAwait = isTrueBoolean(args?.await);
    const outerPromise = new Promise((outerResolve) => setTimeout(async () => {
        try {
            await waitUntilCondition(() => !is_send_press && !is_group_generating, 10000, 100);
        } catch {
            console.warn('Timeout waiting for generation unlock');
            toastr.warning('Cannot run /impersonate command while the reply is being generated.');
            return '';
        }

        // Prevent generate recursion
        $('#send_textarea').val('')[0].dispatchEvent(new Event('input', { bubbles: true }));

        outerResolve(new Promise(innerResolve => setTimeout(() => innerResolve(Generate('impersonate', options)), 1)));
    }, 1));

    if (shouldAwait) {
        const innerPromise = await outerPromise;
        await innerPromise;
    }

    return '';
}

export async function doNewChat({ deleteCurrentChat = false } = {}) {
    //Make a new chat for selected character
    if ((!selected_group && this_chid == undefined) || menu_type == 'create') {
        return;
    }

    //Fix it; New chat doesn't create while open create character menu
    await clearChat();
    chat.length = 0;

    chat_file_for_del = getCurrentChatDetails()?.sessionName;

    // Make it easier to find in backups
    if (deleteCurrentChat) {
        await saveChatConditional();
    }

    if (selected_group) {
        await createNewGroupChat(selected_group);
        if (deleteCurrentChat) await deleteGroupChat(selected_group, chat_file_for_del);
    }
    else {
        //RossAscends: added character name to new chat filenames and replaced Date.now() with humanizedDateTime;
        chat_metadata = {};
        characters[this_chid].chat = `${name2} - ${humanizedDateTime()}`;
        $('#selected_chat_pole').val(characters[this_chid].chat);
        await getChat();
        await createOrEditCharacter(new CustomEvent('newChat'));
        if (deleteCurrentChat) await delChat(chat_file_for_del + '.jsonl');
    }

}

async function doDeleteChat() {
    await displayPastChats();
    let currentChatDeleteButton = $('.select_chat_block[highlight=\'true\']').parent().find('.PastChat_cross');
    $(currentChatDeleteButton).trigger('click');
    await delay(1);
    $('#dialogue_popup_ok').trigger('click', { fromSlashCommand: true });
    return '';
}

async function doRenameChat(_, chatName) {
    if (!chatName) {
        toastr.warning('Name must be provided as an argument to rename this chat.');
        return '';
    }

    const currentChatName = getCurrentChatId();
    if (!currentChatName) {
        toastr.warning('No chat selected that can be renamed.');
        return '';
    }

    await renameChat(currentChatName, chatName);

    toastr.success(`Successfully renamed chat to: ${chatName}`);
    return '';
}

/**
 * Renames the currently selected chat.
 * @param {string} oldFileName Old name of the chat (no JSONL extension)
 * @param {string} newName New name for the chat (no JSONL extension)
 */
export async function renameChat(oldFileName, newName) {
    const body = {
        is_group: !!selected_group,
        avatar_url: characters[this_chid]?.avatar,
        original_file: `${oldFileName}.jsonl`,
        renamed_file: `${newName.trim()}.jsonl`,
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

        const data = await response.json();

        if (data.error) {
            throw new Error('Server returned an error.');
        }

        if (data.sanitizedFileName) {
            newName = data.sanitizedFileName;
        }

        if (selected_group) {
            await renameGroupChat(selected_group, oldFileName, newName);
        }
        else {
            if (characters[this_chid].chat == oldFileName) {
                characters[this_chid].chat = newName;
                $('#selected_chat_pole').val(characters[this_chid].chat);
                await createOrEditCharacter();
            }
        }

        await reloadCurrentChat();
    } catch {
        hideLoader();
        await delay(500);
        await callPopup('An error has occurred. Chat was not renamed.', 'text');
    } finally {
        hideLoader();
    }
}

/**
 * /getchatname` slash command
 */
async function doGetChatName() {
    return getCurrentChatDetails().sessionName;
}

const isPwaMode = window.navigator.standalone;
if (isPwaMode) { $('body').addClass('PWA'); }

function doCharListDisplaySwitch() {
    power_user.charListGrid = !power_user.charListGrid;
    document.body.classList.toggle('charListGrid', power_user.charListGrid);
    saveSettingsDebounced();
}

function doCloseChat() {
    $('#option_close_chat').trigger('click');
    return '';
}

/**
 * Function to handle the deletion of a character, given a specific popup type and character ID.
 * If popup type equals "del_ch", it will proceed with deletion otherwise it will exit the function.
 * It fetches the delete character route, sending necessary parameters, and in case of success,
 * it proceeds to delete character from UI and saves settings.
 * In case of error during the fetch request, it logs the error details.
 *
 * @param {string} this_chid - The character ID to be deleted.
 * @param {boolean} delete_chats - Whether to delete chats or not.
 */
export async function handleDeleteCharacter(this_chid, delete_chats) {
    if (!characters[this_chid]) {
        return;
    }

    await deleteCharacter(characters[this_chid].avatar, { deleteChats: delete_chats });
}

/**
 * Deletes a character completely, including associated chats if specified
 *
 * @param {string|string[]} characterKey - The key (avatar) of the character to be deleted
 * @param {Object} [options] - Optional parameters for the deletion
 * @param {boolean} [options.deleteChats=true] - Whether to delete associated chats or not
 * @return {Promise<void>} - A promise that resolves when the character is successfully deleted
 */
export async function deleteCharacter(characterKey, { deleteChats = true } = {}) {
    if (!Array.isArray(characterKey)) {
        characterKey = [characterKey];
    }

    for (const key of characterKey) {
        const character = characters.find(x => x.avatar == key);
        if (!character) {
            toastr.warning(`Character ${key} not found. Skipping deletion.`);
            continue;
        }

        const chid = characters.indexOf(character);
        const pastChats = await getPastCharacterChats(chid);

        const msg = { avatar_url: character.avatar, delete_chats: deleteChats };

        const response = await fetch('/api/characters/delete', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(msg),
            cache: 'no-cache',
        });

        if (!response.ok) {
            toastr.error(`${response.status} ${response.statusText}`, 'Failed to delete character');
            continue;
        }

        delete tag_map[character.avatar];
        select_rm_info('char_delete', character.name);

        if (deleteChats) {
            for (const chat of pastChats) {
                const name = chat.file_name.replace('.jsonl', '');
                await eventSource.emit(event_types.CHAT_DELETED, name);
            }
        }

        await eventSource.emit(event_types.CHARACTER_DELETED, { id: chid, character: character });
    }

    await removeCharacterFromUI();
}

/**
 * Function to delete a character from UI after character deletion API success.
 * It manages necessary UI changes such as closing advanced editing popup, unsetting
 * character ID, resetting characters array and chat metadata, deselecting character's tab
 * panel, removing character name from navigation tabs, clearing chat, fetching updated list of characters.
 * It also ensures to save the settings after all the operations.
 */
async function removeCharacterFromUI() {
    preserveNeutralChat();
    await clearChat();
    $('#character_cross').trigger('click');
    resetChatState();
    $(document.getElementById('rm_button_selected_ch')).children('h2').text('');
    restoreNeutralChat();
    await getCharacters();
    await printMessages();
    saveSettingsDebounced();
}

async function newAssistantChat() {
    await clearChat();
    chat.splice(0, chat.length);
    chat_metadata = {};
    setCharacterName(neutralCharacterName);
    sendSystemMessage(system_message_types.ASSISTANT_NOTE);
}

function doTogglePanels() {
    $('#option_settings').trigger('click');
    return '';
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

            message.extra.token_count = await getTokenCountAsync(message.mes, 0);
        }

        await saveChatConditional();
        await reloadCurrentChat();
    };

    registerDebugFunction('forceOnboarding', 'Force onboarding', 'Forces the onboarding process to restart.', async () => {
        firstRun = true;
        await saveSettings();
        location.reload();
    });

    registerDebugFunction('backfillTokenCounts', 'Backfill token counters',
        `Recalculates token counts of all messages in the current chat to refresh the counters.
        Useful when you switch between models that have different tokenizers.
        This is a visual change only. Your chat will be reloaded.`, doBackfill);

    registerDebugFunction('generationTest', 'Send a generation request', 'Generates text using the currently selected API.', async () => {
        const text = prompt('Input text:', 'Hello');
        toastr.info('Working on it...');
        const message = await generateRaw(text, null, false, false);
        alert(message);
    });

    registerDebugFunction('clearPrompts', 'Delete itemized prompts', 'Deletes all itemized prompts from the local storage.', async () => {
        await clearItemizedPrompts();
        toastr.info('Itemized prompts deleted.');
        if (getCurrentChatId()) {
            await reloadCurrentChat();
        }
    });

    registerDebugFunction('toggleEventTracing', 'Toggle event tracing', 'Useful to see what triggered a certain event.', () => {
        localStorage.setItem('eventTracing', localStorage.getItem('eventTracing') === 'true' ? 'false' : 'true');
        toastr.info('Event tracing is now ' + (localStorage.getItem('eventTracing') === 'true' ? 'enabled' : 'disabled'));
    });

    registerDebugFunction('copySetup', 'Copy ST setup to clipboard [WIP]', 'Useful data when reporting bugs', async () => {
        const getContextContents = getContext();
        const getSettingsContents = settings;
        //console.log(getSettingsContents);
        const logMessage = `
\`\`\`
API: ${getSettingsContents.main_api}
API Type: ${getSettingsContents[getSettingsContents.main_api + '_settings'].type}
API server: ${getSettingsContents.api_server}
Model: ${getContextContents.onlineStatus}
Context Template: ${power_user.context.preset}
Instruct Template: ${power_user.instruct.preset}
API Settings: ${JSON.stringify(getSettingsContents[getSettingsContents.main_api + '_settings'], null, 2)}
\`\`\`
    `;

        //console.log(getSettingsContents)
        //console.log(logMessage);

        try {
            await navigator.clipboard.writeText(logMessage);
            toastr.info('Your ST API setup data has been copied to the clipboard.');
        } catch (error) {
            toastr.error('Failed to copy ST Setup to clipboard:', error);
        }
    });
}

jQuery(async function () {
    async function doForceSave() {
        await saveSettings();
        await saveChatConditional();
        toastr.success('Chat and settings saved.');
        return '';
    }

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'dupe',
        callback: duplicateCharacter,
        helpString: 'Duplicates the currently selected character.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'api',
        callback: connectAPISlash,
        returns: 'the current API',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'quiet',
                description: 'Suppress the toast message on connection',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'API to connect to',
                typeList: [ARGUMENT_TYPE.STRING],
                enumList: Object.entries(CONNECT_API_MAP).map(([api, { selected }]) =>
                    new SlashCommandEnumValue(api, selected, enumTypes.getBasedOnIndex(UNIQUE_APIS.findIndex(x => x === selected)),
                        selected[0].toUpperCase() ?? enumIcons.default)),
            }),
        ],
        helpString: `
            <div>
                Connect to an API. If no argument is provided, it will return the currently connected API.
            </div>
            <div>
                <strong>Available APIs:</strong>
                <pre><code>${Object.keys(CONNECT_API_MAP).join(', ')}</code></pre>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'impersonate',
        callback: doImpersonate,
        aliases: ['imp'],
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'await',
                'Whether to await for the triggered generation before continuing',
                [ARGUMENT_TYPE.BOOLEAN],
                false,
                false,
                'false',
            ),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'prompt', [ARGUMENT_TYPE.STRING], false,
            ),
        ],
        helpString: `
            <div>
                Calls an impersonation response, with an optional additional prompt.
            </div>
            <div>
                If <code>await=true</code> named argument is passed, the command will wait for the impersonation to end before continuing.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/impersonate What is the meaning of life?</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'delchat',
        callback: doDeleteChat,
        helpString: 'Deletes the current chat.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'renamechat',
        callback: doRenameChat,
        unnamedArgumentList: [
            new SlashCommandArgument(
                'new chat name', [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: 'Renames the current chat.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'getchatname',
        callback: doGetChatName,
        returns: 'chat file name',
        helpString: 'Returns the name of the current chat file into the pipe.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'closechat',
        callback: doCloseChat,
        helpString: 'Closes the current chat.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'tempchat',
        callback: () => {
            return new Promise((resolve, reject) => {
                const eventCallback = async (chatId) => {
                    if (chatId) {
                        return reject('Not in a temporary chat');
                    }
                    await newAssistantChat();
                    return resolve('');
                };
                eventSource.once(event_types.CHAT_CHANGED, eventCallback);
                doCloseChat();
                setTimeout(() => {
                    reject('Failed to open temporary chat');
                    eventSource.removeListener(event_types.CHAT_CHANGED, eventCallback);
                }, debounce_timeout.relaxed);
            });
        },
        helpString: 'Opens a temporary chat with Assistant.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'panels',
        callback: doTogglePanels,
        aliases: ['togglepanels'],
        helpString: 'Toggle UI panels on/off',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'forcesave',
        callback: doForceSave,
        helpString: 'Forces a save of the current chat and settings',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'instruct',
        callback: selectInstructCallback,
        returns: 'current template',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'quiet',
                description: 'Suppress the toast message on template change',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'forceGet',
                description: 'Force getting a name even if instruct mode is disabled',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'instruct template name',
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: () => instruct_presets.map(preset => new SlashCommandEnumValue(preset.name, null, enumTypes.enum, enumIcons.preset)),
            }),
        ],
        helpString: `
            <div>
                Selects instruct mode template by name. Enables instruct mode if not already enabled.
                Gets the current instruct template if no name is provided and instruct mode is enabled or <code>forceGet=true</code> is passed.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/instruct creative</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'instruct-on',
        callback: enableInstructCallback,
        helpString: 'Enables instruct mode.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'instruct-off',
        callback: disableInstructCallback,
        helpString: 'Disables instruct mode',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'instruct-state',
        aliases: ['instruct-toggle'],
        helpString: 'Gets the current instruct mode state. If an argument is provided, it will set the instruct mode state.',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'instruct mode state',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
        ],
        callback: async (_args, state) => {
            if (!state || typeof state !== 'string') {
                return String(power_user.instruct.enabled);
            }

            const newState = isTrueBoolean(state);
            newState ? enableInstructCallback() : disableInstructCallback();
            return String(power_user.instruct.enabled);
        },
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'context',
        callback: selectContextCallback,
        returns: 'template name',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'quiet',
                description: 'Suppress the toast message on template change',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'context template name',
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: () => context_presets.map(preset => new SlashCommandEnumValue(preset.name, null, enumTypes.enum, enumIcons.preset)),
            }),
        ],
        helpString: 'Selects context template by name. Gets the current template if no name is provided',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'chat-manager',
        callback: () => {
            $('#option_select_chat').trigger('click');
            return '';
        },
        aliases: ['chat-history', 'manage-chats'],
        helpString: 'Opens the chat manager for the current character/group.',
    }));

    setTimeout(function () {
        $('#groupControlsToggle').trigger('click');
        $('#groupCurrentMemberListToggle .inline-drawer-icon').trigger('click');
    }, 200);

    $(document).on('click', '.api_loading', () => cancelStatusCheck('Canceled because connecting was manually canceled'));

    //////////INPUT BAR FOCUS-KEEPING LOGIC/////////////
    let S_TAPreviouslyFocused = false;
    $('#send_textarea').on('focusin focus click', () => {
        S_TAPreviouslyFocused = true;
    });
    $('#send_but, #option_regenerate, #option_continue, #mes_continue, #mes_impersonate').on('click', () => {
        if (S_TAPreviouslyFocused) {
            $('#send_textarea').focus();
        }
    });
    $(document).click(event => {
        if ($(':focus').attr('id') !== 'send_textarea') {
            var validIDs = ['options_button', 'send_but', 'mes_impersonate', 'mes_continue', 'send_textarea', 'option_regenerate', 'option_continue'];
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

    const debouncedCharacterSearch = debounce((searchQuery) => {
        entitiesFilter.setFilterData(FILTER_TYPES.SEARCH, searchQuery);
    });
    $('#character_search_bar').on('input', function () {
        const searchQuery = String($(this).val());
        debouncedCharacterSearch(searchQuery);
    });

    $('#mes_impersonate').on('click', function () {
        $('#option_impersonate').trigger('click');
    });

    $('#mes_continue').on('click', function () {
        $('#option_continue').trigger('click');
    });

    $('#send_but').on('click', function () {
        sendTextareaMessage();
    });

    //menu buttons setup

    $('#rm_button_settings').click(function () {
        selected_button = 'settings';
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
        console.debug('Bogus folder clicked', tagId);
        chooseBogusFolder($(this), tagId);
    });

    /**
     * Sets the scroll height of the edit textarea to fit the content.
     * @param {HTMLTextAreaElement} e Textarea element to auto-fit
     */
    function autoFitEditTextArea(e) {
        scroll_holder = chatElement[0].scrollTop;
        e.style.height = '0px';
        const newHeight = e.scrollHeight + 4;
        e.style.height = `${newHeight}px`;
        is_use_scroll_holder = true;
    }
    const autoFitEditTextAreaDebounced = debounce(autoFitEditTextArea, debounce_timeout.short);
    document.addEventListener('input', e => {
        if (e.target instanceof HTMLTextAreaElement && e.target.classList.contains('edit_textarea')) {
            const scrollbarShown = e.target.clientWidth < e.target.offsetWidth && e.target.offsetHeight >= window.innerHeight * 0.75;
            const immediately = (e.target.scrollHeight > e.target.offsetHeight && !scrollbarShown) || e.target.value === '';
            immediately ? autoFitEditTextArea(e.target) : autoFitEditTextAreaDebounced(e.target);
        }
    });
    const chatElementScroll = document.getElementById('chat');
    const chatScrollHandler = function () {
        if (power_user.waifuMode) {
            scrollLock = true;
            return;
        }

        const scrollIsAtBottom = Math.abs(chatElementScroll.scrollHeight - chatElementScroll.clientHeight - chatElementScroll.scrollTop) < 1;

        // Resume autoscroll if the user scrolls to the bottom
        if (scrollLock && scrollIsAtBottom) {
            scrollLock = false;
        }

        // Cancel autoscroll if the user scrolls up
        if (!scrollLock && !scrollIsAtBottom) {
            scrollLock = true;
        }
    };
    chatElementScroll.addEventListener('wheel', chatScrollHandler, { passive: true });
    chatElementScroll.addEventListener('touchmove', chatScrollHandler, { passive: true });
    chatElementScroll.addEventListener('scroll', function () {
        if (is_use_scroll_holder) {
            this.scrollTop = scroll_holder;
            is_use_scroll_holder = false;
        }
    }, { passive: true });

    $(document).on('click', '.mes', function () {
        //when a 'delete message' parent div is clicked
        // and we are in delete mode and del_checkbox is visible
        if (!is_delete_mode || !$(this).children('.del_checkbox').is(':visible')) {
            return;
        }
        $('.mes').children('.del_checkbox').each(function () {
            $(this).prop('checked', false);
            $(this).parent().removeClass('selected');
        });
        $(this).addClass('selected'); //sets the bg of the mes selected for deletion
        var i = Number($(this).attr('mesid')); //checks the message ID in the chat
        this_del_mes = i;
        //as long as the current message ID is less than the total chat length
        while (i < chat.length) {
            //sets the bg of the all msgs BELOW the selected .mes
            $(`.mes[mesid="${i}"]`).addClass('selected');
            $(`.mes[mesid="${i}"]`).children('.del_checkbox').prop('checked', true);
            i++;
        }
    });

    $(document).on('click', '.PastChat_cross', function (e) {
        e.stopPropagation();
        chat_file_for_del = $(this).attr('file_name');
        console.debug('detected cross click for' + chat_file_for_del);
        callPopup('<h3>Delete the Chat File?</h3>', 'del_chat');
    });

    $('#advanced_div').click(function () {
        if (!is_advanced_char_open) {
            is_advanced_char_open = true;
            $('#character_popup').css({ 'display': 'flex', 'opacity': 0.0 }).addClass('open');
            $('#character_popup').transition({
                opacity: 1.0,
                duration: animation_duration,
                easing: animation_easing,
            });
        } else {
            is_advanced_char_open = false;
            $('#character_popup').css('display', 'none').removeClass('open');
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

    $('#dialogue_popup_ok').click(async function (e, customData) {
        const fromSlashCommand = customData?.fromSlashCommand || false;
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

        if (popup_type == 'del_chat') {
            //close past chat popup
            $('#select_chat_cross').trigger('click');
            showLoader();
            if (selected_group) {
                await deleteGroupChat(selected_group, chat_file_for_del);
            } else {
                await delChat(chat_file_for_del);
            }

            if (fromSlashCommand) {  // When called from `/delchat` command, don't re-open the history view.
                $('#options').hide();  // hide option popup menu
                hideLoader();
            } else {  // Open the history view again after 2 seconds (delay to avoid edge cases for deleting last chat).
                setTimeout(function () {
                    $('#option_select_chat').click();
                    $('#options').hide();  // hide option popup menu
                    hideLoader();
                }, 2000);
            }
        }
        if (popup_type == 'alternate_greeting' && menu_type !== 'create') {
            createOrEditCharacter();
        }

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

    $('#delete_button').on('click', async function () {
        if (!this_chid) {
            toastr.warning('No character selected.');
            return;
        }

        let deleteChats = false;

        const confirm = await Popup.show.confirm('Delete the character?', `
            <b>THIS IS PERMANENT!<br><br>
                <label for="del_char_checkbox" class="checkbox_label justifyCenter">
                    <input type="checkbox" id="del_char_checkbox" />
                    <small>Also delete the chat files</small>
                </label></b>`, {
            onClose: () => deleteChats = !!$('#del_char_checkbox').prop('checked'),
        });
        if (!confirm) {
            return;
        }

        await deleteCharacter(characters[this_chid].avatar, { deleteChats: deleteChats });
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
        '#depth_prompt_role': function () { create_save.depth_prompt_role = String($('#depth_prompt_role').val()); },
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
        const oldFileNameFull = $(this).closest('.select_chat_block_wrapper').find('.select_chat_block_filename').text();
        const oldFileName = oldFileNameFull.replace('.jsonl', '');

        const popupText = await renderTemplateAsync('chatRename');
        const newName = await callPopup(popupText, 'input', oldFileName);

        if (!newName || newName == oldFileName) {
            console.log('no new name found, aborting');
            return;
        }

        await renameChat(oldFileName, newName);

        await delay(250);
        $('#option_select_chat').trigger('click');
        $('#options').hide();
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
        const keys = [
            { id: 'api_key_mancer', secret: SECRET_KEYS.MANCER },
            { id: 'api_key_vllm', secret: SECRET_KEYS.VLLM },
            { id: 'api_key_aphrodite', secret: SECRET_KEYS.APHRODITE },
            { id: 'api_key_tabby', secret: SECRET_KEYS.TABBY },
            { id: 'api_key_togetherai', secret: SECRET_KEYS.TOGETHERAI },
            { id: 'api_key_ooba', secret: SECRET_KEYS.OOBA },
            { id: 'api_key_infermaticai', secret: SECRET_KEYS.INFERMATICAI },
            { id: 'api_key_dreamgen', secret: SECRET_KEYS.DREAMGEN },
            { id: 'api_key_openrouter-tg', secret: SECRET_KEYS.OPENROUTER },
            { id: 'api_key_koboldcpp', secret: SECRET_KEYS.KOBOLDCPP },
            { id: 'api_key_llamacpp', secret: SECRET_KEYS.LLAMACPP },
            { id: 'api_key_featherless', secret: SECRET_KEYS.FEATHERLESS },
            { id: 'api_key_huggingface', secret: SECRET_KEYS.HUGGINGFACE },
        ];

        for (const key of keys) {
            const keyValue = String($(`#${key.id}`).val()).trim();
            if (keyValue.length) {
                await writeSecret(key.secret, keyValue);
            }
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
        return menu.is(':hover, :focus-within') || button.is(':hover, :focus');
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

        // Check whether a custom prompt was provided via custom data (for example through a slash command)
        const additionalPrompt = customData?.additionalPrompt?.trim() || undefined;
        const buildOrFillAdditionalArgs = (args = {}) => ({
            ...args,
            ...(additionalPrompt !== undefined && { quiet_prompt: additionalPrompt, quietToLoud: true }),
        });

        if (id == 'option_select_chat') {
            if ((selected_group && !is_group_generating) || (this_chid !== undefined && !is_send_press) || fromSlashCommand) {
                await displayPastChats();
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
                let deleteCurrentChat = false;
                const result = await Popup.show.confirm(t`Start new chat?`, await renderTemplateAsync('newChatConfirm'), {
                    onClose: () => deleteCurrentChat = !!$('#del_chat_checkbox').prop('checked'),
                });
                if (!result) {
                    return;
                }

                await doNewChat({ deleteCurrentChat: deleteCurrentChat });
            }
            if (!selected_group && this_chid === undefined && !is_send_press) {
                await newAssistantChat();
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
                    Generate('regenerate', buildOrFillAdditionalArgs());
                }
            }
        }

        else if (id == 'option_impersonate') {
            if (is_send_press == false || fromSlashCommand) {
                is_send_press = true;
                Generate('impersonate', buildOrFillAdditionalArgs());
            }
        }

        else if (id == 'option_continue') {
            if (is_send_press == false || fromSlashCommand) {
                is_send_press = true;
                Generate('continue', buildOrFillAdditionalArgs());
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
                sendSystemMessage(system_message_types.WELCOME_PROMPT);
                await getClientVersion();
                await eventSource.emit(event_types.CHAT_CHANGED, getCurrentChatId());
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

    $('#newChatFromManageScreenButton').on('click', async function () {
        await doNewChat({ deleteCurrentChat: false });
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
            $(this).parent().removeClass('selected');
            $(this).prop('checked', false);
        });
        showSwipeButtons();
        this_del_mes = -1;
        is_delete_mode = false;
    });

    //confirms message deletion with the "ok" button
    $('#dialogue_del_mes_ok').on('click', async function () {
        $('#dialogue_del_mes').css('display', 'none');
        $('#send_form').css('display', css_send_form_display);
        $('.del_checkbox').each(function () {
            $(this).css('display', 'none');
            $(this).parent().children('.for_checkbox').css('display', 'block');
            $(this).parent().removeClass('selected');
            $(this).prop('checked', false);
        });

        if (this_del_mes >= 0) {
            $(`.mes[mesid="${this_del_mes}"]`).nextAll('div').remove();
            $(`.mes[mesid="${this_del_mes}"]`).remove();
            chat.length = this_del_mes;
            await saveChatConditional();
            chatElement.scrollTop(chatElement[0].scrollHeight);
            await eventSource.emit(event_types.MESSAGE_DELETED, chat.length);
            $('#chat .mes').removeClass('last_mes');
            $('#chat .mes').last().addClass('last_mes');
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
        cancelStatusCheck('Canceled because main api changed');
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
            if (this_chid !== undefined || selected_group || name2 === neutralCharacterName) {
                try {
                    const messageId = $(this).closest('.mes').attr('mesid');
                    const text = chat[messageId]['mes'];
                    navigator.clipboard.writeText(text);
                    toastr.info('Copied!', '', { timeOut: 2000 });
                } catch (err) {
                    console.error('Failed to copy: ', err);
                }
            }
        });
    }

    $(document).on('pointerup', '.mes_prompt', async function () {
        let mesIdForItemization = $(this).closest('.mes').attr('mesId');
        console.log(`looking for mesID: ${mesIdForItemization}`);
        if (itemizedPrompts.length !== undefined && itemizedPrompts.length !== 0) {
            await promptItemize(itemizedPrompts, mesIdForItemization);
        }
    });

    //********************
    //***Message Editor***
    $(document).on('click', '.mes_edit', async function () {
        if (this_chid !== undefined || selected_group || name2 === neutralCharacterName) {
            // Previously system messages we're allowed to be edited
            /*const message = $(this).closest(".mes");

            if (message.data("isSystem")) {
                return;
            }*/

            let chatScrollPosition = $('#chat').scrollTop();
            if (this_edit_mes_id !== undefined) {
                let mes_edited = $(`#chat [mesid="${this_edit_mes_id}"]`).find('.mes_edit_done');
                if (Number(edit_mes_id) == chat.length - 1) { //if the generating swipe (...)
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
                    '<textarea id=\'curEditTextarea\' class=\'edit_textarea mdHotkeys\' style=\'max-width:auto;\'></textarea>',
                );
            $('#curEditTextarea').val(text);
            let edit_textarea = $(this)
                .closest('.mes_block')
                .find('.edit_textarea');
            edit_textarea.height(0);
            edit_textarea.height(edit_textarea[0].scrollHeight);
            edit_textarea.focus();
            edit_textarea[0].setSelectionRange(     //this sets the cursor at the end of the text
                String(edit_textarea.val()).length,
                String(edit_textarea.val()).length,
            );
            if (Number(this_edit_mes_id) === chat.length - 1) {
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

    $(document).on('click', '.mes_edit_cancel', async function () {
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
                this_edit_mes_id,
            ));
        appendMediaToMessage(chat[this_edit_mes_id], $(this).closest('.mes'));
        addCopyToCodeBlocks($(this).closest('.mes'));

        await eventSource.emit(event_types.MESSAGE_UPDATED, this_edit_mes_id);
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
        const confirmation = await callGenericPopup('Create a copy of this message?', POPUP_TYPE.CONFIRM);
        if (!confirmation) {
            return;
        }

        hideSwipeButtons();
        const oldScroll = chatElement[0].scrollTop;
        const clone = structuredClone(chat[this_edit_mes_id]);
        clone.send_date = Date.now();
        clone.mes = $(this).closest('.mes').find('.edit_textarea').val();

        if (power_user.trim_spaces) {
            clone.mes = clone.mes.trim();
        }

        chat.splice(Number(this_edit_mes_id) + 1, 0, clone);
        addOneMessage(clone, { insertAfter: this_edit_mes_id });

        updateViewMessageIds();
        await saveChatConditional();
        chatElement[0].scrollTop = oldScroll;
        showSwipeButtons();
    });

    $(document).on('click', '.mes_edit_delete', async function (event, customData) {
        const fromSlashCommand = customData?.fromSlashCommand || false;
        const canDeleteSwipe = (Array.isArray(chat[this_edit_mes_id].swipes) && chat[this_edit_mes_id].swipes.length > 1 && !chat[this_edit_mes_id].is_user && parseInt(this_edit_mes_id) === chat.length - 1);

        let deleteOnlySwipe = false;
        if (power_user.confirm_message_delete && fromSlashCommand !== true) {
            const result = await callGenericPopup(t`Are you sure you want to delete this message?`, POPUP_TYPE.CONFIRM, null, {
                okButton: canDeleteSwipe ? t`Delete Swipe` : t`Delete Message`,
                cancelButton: 'Cancel',
                customButtons: canDeleteSwipe ? [t`Delete Message`] : null,
            });
            if (!result) {
                return;
            }
            deleteOnlySwipe = canDeleteSwipe && result === 1; // Default button, not the custom one
        }

        const messageElement = $(this).closest('.mes');
        if (!messageElement) {
            return;
        }

        if (deleteOnlySwipe) {
            const message = chat[this_edit_mes_id];
            const swipe_id = message.swipe_id;
            await deleteSwipe(swipe_id);
            return;
        }

        chat.splice(this_edit_mes_id, 1);
        messageElement.remove();

        let startFromZero = Number(this_edit_mes_id) === 0;

        this_edit_mes_id = undefined;

        updateViewMessageIds(startFromZero);
        saveChatDebounced();

        hideSwipeButtons();
        showSwipeButtons();

        await eventSource.emit(event_types.MESSAGE_DELETED, chat.length);
    });

    $(document).on('click', '.mes_edit_done', async function () {
        await messageEditDone($(this));
    });

    //Select chat

    //**************************CHARACTER IMPORT EXPORT*************************//
    $('#character_import_button').click(function () {
        $('#character_import_file').click();
    });

    $('#character_import_file').on('change', async function (e) {
        $('#rm_info_avatar').html('');

        if (!(e.target instanceof HTMLInputElement)) {
            return;
        }

        if (!e.target.files.length) {
            return;
        }

        for (const file of e.target.files) {
            await importCharacter(file);
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
            URL.revokeObjectURL(a.href);
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
        await duplicateCharacter();
    });

    $(document).on('click', '.mes_stop', function () {
        stopGeneration();
    });

    $(document).on('click', '#form_sheld .stscript_continue', function () {
        pauseScriptExecution();
    });

    $(document).on('click', '#form_sheld .stscript_pause', function () {
        pauseScriptExecution();
    });

    $(document).on('click', '#form_sheld .stscript_stop', function () {
        stopScriptExecution();
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
            if (!CSS.supports('field-sizing', 'content')) {
                $(this).closest('.drawer').find('.drawer-content textarea.autoSetHeight').each(async function () {
                    await resetScrollHeight($(this));
                    return;
                });
            }

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
            '.popup',
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
            if ($('.openDrawer').length !== 0) {
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
        $(this).closest('.inline-drawer').find('.inline-drawer-content').stop().slideToggle({
            complete: () => {
                $(this).css('height', '');
            },
        });

        // Set the height of "autoSetHeight" textareas within the inline-drawer to their scroll height
        if (!CSS.supports('field-sizing', 'content')) {
            $(this).closest('.inline-drawer').find('.inline-drawer-content textarea.autoSetHeight').each(async function () {
                await resetScrollHeight($(this));
                return;
            });
        }
    });

    $(document).on('click', '.inline-drawer-maximize', function () {
        const icon = $(this).find('.inline-drawer-icon, .floating_panel_maximize');
        icon.toggleClass('fa-window-maximize fa-window-restore');
        const drawerContent = $(this).closest('.drawer-content');
        drawerContent.toggleClass('maximized');
        const drawerId = drawerContent.attr('id');
        resetMovableStyles(drawerId);
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

        const avatarSrc = (isDataURL(thumbURL) || /^\/?img\/(?:.+)/.test(thumbURL)) ? thumbURL : charsPath + targetAvatarImg;
        if ($(`.zoomed_avatar[forChar="${charname}"]`).length) {
            console.debug('removing container as it already existed');
            $(`.zoomed_avatar[forChar="${charname}"]`).fadeOut(animation_duration, () => {
                $(`.zoomed_avatar[forChar="${charname}"]`).remove();
            });
        } else {
            console.debug('making new container from template');
            const template = $('#zoomed_avatar_template').html();
            const newElement = $(template);
            newElement.attr('forChar', charname);
            newElement.attr('id', `zoomFor_${charname}`);
            newElement.addClass('draggable');
            newElement.find('.drag-grabber').attr('id', `zoomFor_${charname}header`);

            $('body').append(newElement);
            newElement.fadeIn(animation_duration);
            const zoomedAvatarImgElement = $(`.zoomed_avatar[forChar="${charname}"] img`);
            if (messageElement.attr('is_user') == 'true' || (messageElement.attr('is_system') == 'true' && !isValidCharacter)) { //handle user and system avatars
                zoomedAvatarImgElement.attr('src', thumbURL);
                zoomedAvatarImgElement.attr('data-izoomify-url', thumbURL);
            } else if (messageElement.attr('is_user') == 'false') { //handle char avatars
                zoomedAvatarImgElement.attr('src', avatarSrc);
                zoomedAvatarImgElement.attr('data-izoomify-url', avatarSrc);
            }
            loadMovingUIState();
            $(`.zoomed_avatar[forChar="${charname}"]`).css('display', 'flex');
            dragElement(newElement);

            if (power_user.zoomed_avatar_magnification) {
                $('.zoomed_avatar_container').izoomify();
            }

            $('.zoomed_avatar, .zoomed_avatar .dragClose').on('click touchend', (e) => {
                if (e.target.closest('.dragClose')) {
                    $(`.zoomed_avatar[forChar="${charname}"]`).fadeOut(animation_duration, () => {
                        $(`.zoomed_avatar[forChar="${charname}"]`).remove();
                    });
                }
            });

            zoomedAvatarImgElement.on('dragstart', (e) => {
                console.log('saw drag on avatar!');
                e.preventDefault();
                return false;
            });
        }
    });

    document.addEventListener('click', function (e) {
        if (!(e.target instanceof HTMLElement)) return;
        if (e.target.matches('#OpenAllWIEntries')) {
            document.querySelectorAll('#world_popup_entries_list .inline-drawer').forEach((/** @type {HTMLElement} */ drawer) => {
                toggleDrawer(drawer, true);
            });
        } else if (e.target.matches('#CloseAllWIEntries')) {
            document.querySelectorAll('#world_popup_entries_list .inline-drawer').forEach((/** @type {HTMLElement} */ drawer) => {
                toggleDrawer(drawer, false);
            });
        }
    });

    $(document).on('click', '.open_alternate_greetings', openAlternateGreetings);
    /* $('#set_character_world').on('click', openCharacterWorldPopup); */

    $(document).on('focus', 'input.auto-select, textarea.auto-select', function () {
        if (!power_user.enable_auto_select_input) return;
        const control = $(this)[0];
        if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement) {
            control.select();
            console.debug('Auto-selecting content of input control', control);
        }
    });

    $(document).keyup(function (e) {
        if (e.key === 'Escape') {
            const isEditVisible = $('#curEditTextarea').is(':visible');
            if (isEditVisible && power_user.auto_save_msg_edits === false) {
                closeMessageEditor();
                $('#send_textarea').focus();
                return;
            }
            if (isEditVisible && power_user.auto_save_msg_edits === true) {
                $(`#chat .mes[mesid="${this_edit_mes_id}"] .mes_edit_done`).click();
                $('#send_textarea').focus();
                return;
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
                await setScenarioOverride();
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
            case 'character_source': {
                const source = getCharacterSource(this_chid);
                if (source && isValidUrl(source)) {
                    const url = new URL(source);
                    const confirm = await Popup.show.confirm('Open Source', `<span>Do you want to open the link to ${url.hostname} in a new tab?</span><var>${url}</var>`);
                    if (confirm) {
                        window.open(source, '_blank');
                    }
                } else {
                    toastr.info('This character doesn\'t seem to have a source.');
                }
            } break;
            case 'replace_update': {
                const confirm = await Popup.show.confirm('Replace Character', '<p>Choose a new character card to replace this character with.</p>All chats, assets and group memberships will be preserved, but local changes to the character data will be lost.<br />Proceed?');
                if (confirm) {
                    async function uploadReplacementCard(e) {
                        const file = e.target.files[0];

                        if (!file) {
                            return;
                        }

                        try {
                            const chatFile = characters[this_chid]['chat'];
                            const data = new Map();
                            data.set(file, characters[this_chid].avatar);
                            await processDroppedFiles([file], data);
                            await openCharacterChat(chatFile);
                            await fetch(getThumbnailUrl('avatar', characters[this_chid].avatar), { cache: 'no-cache' });
                        } catch {
                            toastr.error('Failed to replace the character card.', 'Something went wrong');
                        }
                    }
                    $('#character_replace_file').off('change').on('change', uploadReplacementCard).trigger('click');
                }
            } break;
            case 'import_tags': {
                await importTags(characters[this_chid], { importSetting: tag_import_setting.ASK });
            } break;
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

    $(window).on('beforeunload', () => {
        cancelTtsPlay();
        if (streamingProcessor) {
            console.log('Page reloaded. Aborting streaming...');
            streamingProcessor.onStopStreaming();
        }
    });


    var isManualInput = false;
    var valueBeforeManualInput;

    $(document).on('input', '.range-block-counter input, .neo-range-input', function () {
        valueBeforeManualInput = $(this).val();
        console.log(valueBeforeManualInput);
    });

    $(document).on('change', '.range-block-counter input, .neo-range-input', function (e) {
        e.target.focus();
        e.target.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
    });

    $(document).on('keydown', '.range-block-counter input, .neo-range-input', function (e) {
        const masterSelector = '#' + $(this).data('for');
        const masterElement = $(masterSelector);
        if (e.key === 'Enter') {
            let manualInput = Number($(this).val());
            if (isManualInput) {
                //disallow manual inputs outside acceptable range
                if (manualInput >= Number($(this).attr('min')) && manualInput <= Number($(this).attr('max'))) {
                    //if value is ok, assign to slider and update handle text and position
                    //newSlider.val(manualInput)
                    //handleSlideEvent.call(newSlider, null, { value: parseFloat(manualInput) }, 'manual');
                    valueBeforeManualInput = manualInput;
                    $(masterElement).val($(this).val()).trigger('input', { forced: true });
                } else {
                    //if value not ok, warn and reset to last known valid value
                    toastr.warning(`Invalid value. Must be between ${$(this).attr('min')} and ${$(this).attr('max')}`);
                    console.log(valueBeforeManualInput);
                    //newSlider.val(valueBeforeManualInput)
                    $(this).val(valueBeforeManualInput);
                }
            }
        }
    });

    $(document).on('keyup', '.range-block-counter input, .neo-range-input', function () {
        valueBeforeManualInput = $(this).val();
        console.log(valueBeforeManualInput);
        isManualInput = true;
    });

    //trigger slider changes when user clicks away
    $(document).on('mouseup blur', '.range-block-counter input, .neo-range-input', function () {
        const masterSelector = '#' + $(this).data('for');
        const masterElement = $(masterSelector);
        let manualInput = Number($(this).val());
        if (isManualInput) {
            //if value is between correct range for the slider
            if (manualInput >= Number($(this).attr('min')) && manualInput <= Number($(this).attr('max'))) {
                valueBeforeManualInput = manualInput;
                //set the slider value to input value
                $(masterElement).val($(this).val()).trigger('input', { forced: true });
            } else {
                //if value not ok, warn and reset to last known valid value
                toastr.warning(`Invalid value. Must be between ${$(this).attr('min')} and ${$(this).attr('max')}`);
                console.log(valueBeforeManualInput);
                $(this).val(valueBeforeManualInput);
            }
        }
        isManualInput = false;
    });

    $('.user_stats_button').on('click', function () {
        userStatsHandler();
    });

    $(document).on('click', '.external_import_button, #external_import_button', async () => {
        const html = await renderTemplateAsync('importCharacters');

        /** @type {string?} */
        const input = await callGenericPopup(html, POPUP_TYPE.INPUT, '', { wider: true, okButton: $('#popup_template').attr('popup-button-import'), rows: 4 });

        if (!input) {
            console.debug('Custom content import cancelled');
            return;
        }

        // break input into one input per line
        const inputs = input.split('\n').map(x => x.trim()).filter(x => x.length > 0);

        for (const url of inputs) {
            let request;

            if (isValidUrl(url)) {
                console.debug('Custom content import started for URL: ', url);
                request = await fetch('/api/content/importURL', {
                    method: 'POST',
                    headers: getRequestHeaders(),
                    body: JSON.stringify({ url }),
                });
            } else {
                console.debug('Custom content import started for Char UUID: ', url);
                request = await fetch('/api/content/importUUID', {
                    method: 'POST',
                    headers: getRequestHeaders(),
                    body: JSON.stringify({ url }),
                });
            }

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
        }
    });

    charDragDropHandler = new DragAndDropHandler('body', async (files, event) => {
        if (!files.length) {
            await importFromURL(event.originalEvent.dataTransfer.items, files);
        }
        await processDroppedFiles(files);
    }, { noAnimation: true });

    $('#charListGridToggle').on('click', async () => {
        doCharListDisplaySwitch();
    });

    $('#hideCharPanelAvatarButton').on('click', () => {
        $('#avatar-and-name-block').slideToggle();
    });

    $(document).on('mouseup touchend', '#show_more_messages', () => {
        showMoreMessages();
    });

    $(document).on('click', '.open_characters_library', async function () {
        await getCharacters();
        eventSource.emit(event_types.OPEN_CHARACTER_LIBRARY);
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

    initCustomSelectedSamplers();
});

