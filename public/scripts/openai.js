/*
* CODE FOR OPENAI SUPPORT
* By CncAnon (@CncAnon1)
* https://github.com/CncAnon1/TavernAITurbo
*/

import {
    abortStatusCheck,
    callPopup,
    characters,
    event_types,
    eventSource,
    extension_prompt_roles,
    extension_prompt_types,
    Generate,
    getExtensionPrompt,
    getNextMessageId,
    getRequestHeaders,
    getStoppingStrings,
    is_send_press,
    main_api,
    MAX_INJECTION_DEPTH,
    name1,
    name2,
    replaceItemizedPromptText,
    resultCheckStatus,
    saveSettingsDebounced,
    setOnlineStatus,
    startStatusLoading,
    substituteParams,
    substituteParamsExtended,
    system_message_types,
    this_chid,
} from '../script.js';
import { selected_group } from './group-chats.js';

import {
    chatCompletionDefaultPrompts,
    INJECTION_POSITION,
    Prompt,
    PromptManager,
    promptManagerDefaultPromptOrders,
} from './PromptManager.js';

import { forceCharacterEditorTokenize, getCustomStoppingStrings, persona_description_positions, power_user } from './power-user.js';
import { SECRET_KEYS, secret_state, writeSecret } from './secrets.js';

import { getEventSourceStream } from './sse-stream.js';
import {
    createThumbnail,
    delay,
    download,
    getBase64Async,
    getFileText,
    getImageSizeFromDataURL,
    getSortableDelay,
    getStringHash,
    isDataURL,
    parseJsonFile,
    resetScrollHeight,
    stringFormat,
} from './utils.js';
import { countTokensOpenAI, getTokenizerModel } from './tokenizers.js';
import {
    formatInstructModeChat,
    formatInstructModeExamples,
    formatInstructModePrompt,
    formatInstructModeSystemPrompt,
} from './instruct-mode.js';
import { isMobile } from './RossAscends-mods.js';
import { saveLogprobsForActiveMessage } from './logprobs.js';
import { SlashCommandParser } from './slash-commands/SlashCommandParser.js';
import { SlashCommand } from './slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument } from './slash-commands/SlashCommandArgument.js';
import { renderTemplateAsync } from './templates.js';
import { SlashCommandEnumValue } from './slash-commands/SlashCommandEnumValue.js';
import { Popup, POPUP_RESULT } from './popup.js';
import { t } from './i18n.js';

export {
    openai_messages_count,
    oai_settings,
    loadOpenAISettings,
    setOpenAIMessages,
    setOpenAIMessageExamples,
    setupChatCompletionPromptManager,
    sendOpenAIRequest,
    getChatCompletionModel,
    TokenHandler,
    IdentifierNotFoundError,
    Message,
    MessageCollection,
};

let openai_messages_count = 0;

const default_main_prompt = 'Write {{char}}\'s next reply in a fictional chat between {{charIfNotGroup}} and {{user}}.';
const default_nsfw_prompt = '';
const default_jailbreak_prompt = '';
const default_impersonation_prompt = '[Write your next reply from the point of view of {{user}}, using the chat history so far as a guideline for the writing style of {{user}}. Don\'t write as {{char}} or system. Don\'t describe actions of {{char}}.]';
const default_enhance_definitions_prompt = 'If you have more knowledge of {{char}}, add to the character\'s lore and personality to enhance them but keep the Character Sheet\'s definitions absolute.';
const default_wi_format = '{0}';
const default_new_chat_prompt = '[Start a new Chat]';
const default_new_group_chat_prompt = '[Start a new group chat. Group members: {{group}}]';
const default_new_example_chat_prompt = '[Example Chat]';
const default_claude_human_sysprompt_message = 'Let\'s get started. Please generate your response based on the information and instructions provided above.';
const default_continue_nudge_prompt = '[Continue the following message. Do not include ANY parts of the original message. Use capitalization and punctuation as if your reply is a part of the original message: {{lastChatMessage}}]';
const default_bias = 'Default (none)';
const default_personality_format = '[{{char}}\'s personality: {{personality}}]';
const default_scenario_format = '[Circumstances and context of the dialogue: {{scenario}}]';
const default_group_nudge_prompt = '[Write the next reply only as {{char}}.]';
const default_bias_presets = {
    [default_bias]: [],
    'Anti-bond': [
        { text: ' bond', value: -50 },
        { text: ' future', value: -50 },
        { text: ' bonding', value: -50 },
        { text: ' connection', value: -25 },
    ],
};

const max_2k = 2047;
const max_4k = 4095;
const max_8k = 8191;
const max_12k = 12287;
const max_16k = 16383;
const max_32k = 32767;
const max_64k = 65535;
const max_128k = 128 * 1000;
const max_200k = 200 * 1000;
const max_256k = 256 * 1000;
const max_1mil = 1000 * 1000;
const max_2mil = 2000 * 1000;
const scale_max = 8191;
const claude_max = 9000; // We have a proper tokenizer, so theoretically could be larger (up to 9k)
const claude_100k_max = 99000;
const unlocked_max = max_2mil;
const oai_max_temp = 2.0;
const claude_max_temp = 1.0;
const openrouter_website_model = 'OR_Website';
const openai_max_stop_strings = 4;

const textCompletionModels = [
    'gpt-3.5-turbo-instruct',
    'gpt-3.5-turbo-instruct-0914',
    'text-davinci-003',
    'text-davinci-002',
    'text-davinci-001',
    'text-curie-001',
    'text-babbage-001',
    'text-ada-001',
    'code-davinci-002',
    'code-davinci-001',
    'code-cushman-002',
    'code-cushman-001',
    'text-davinci-edit-001',
    'code-davinci-edit-001',
    'text-embedding-ada-002',
    'text-similarity-davinci-001',
    'text-similarity-curie-001',
    'text-similarity-babbage-001',
    'text-similarity-ada-001',
    'text-search-davinci-doc-001',
    'text-search-curie-doc-001',
    'text-search-babbage-doc-001',
    'text-search-ada-doc-001',
    'code-search-babbage-code-001',
    'code-search-ada-code-001',
];

let biasCache = undefined;
export let model_list = [];

export const chat_completion_sources = {
    OPENAI: 'openai',
    WINDOWAI: 'windowai',
    CLAUDE: 'claude',
    SCALE: 'scale',
    OPENROUTER: 'openrouter',
    AI21: 'ai21',
    MAKERSUITE: 'makersuite',
    MISTRALAI: 'mistralai',
    CUSTOM: 'custom',
    COHERE: 'cohere',
    PERPLEXITY: 'perplexity',
    GROQ: 'groq',
    ZEROONEAI: '01ai',
    BLOCKENTROPY: 'blockentropy',
};

const character_names_behavior = {
    NONE: -1,
    DEFAULT: 0,
    COMPLETION: 1,
    CONTENT: 2,
};

const continue_postfix_types = {
    NONE: '',
    SPACE: ' ',
    NEWLINE: '\n',
    DOUBLE_NEWLINE: '\n\n',
};

const custom_prompt_post_processing_types = {
    NONE: '',
    CLAUDE: 'claude',
};

const sensitiveFields = [
    'reverse_proxy',
    'proxy_password',
    'custom_url',
    'custom_include_body',
    'custom_exclude_body',
    'custom_include_headers',
];

const default_settings = {
    preset_settings_openai: 'Default',
    temp_openai: 1.0,
    freq_pen_openai: 0,
    pres_pen_openai: 0,
    top_p_openai: 1.0,
    top_k_openai: 0,
    min_p_openai: 0,
    top_a_openai: 0,
    repetition_penalty_openai: 1,
    stream_openai: false,
    websearch_cohere: false,
    openai_max_context: max_4k,
    openai_max_tokens: 300,
    wrap_in_quotes: false,
    ...chatCompletionDefaultPrompts,
    ...promptManagerDefaultPromptOrders,
    send_if_empty: '',
    impersonation_prompt: default_impersonation_prompt,
    new_chat_prompt: default_new_chat_prompt,
    new_group_chat_prompt: default_new_group_chat_prompt,
    new_example_chat_prompt: default_new_example_chat_prompt,
    continue_nudge_prompt: default_continue_nudge_prompt,
    bias_preset_selected: default_bias,
    bias_presets: default_bias_presets,
    wi_format: default_wi_format,
    group_nudge_prompt: default_group_nudge_prompt,
    scenario_format: default_scenario_format,
    personality_format: default_personality_format,
    openai_model: 'gpt-4-turbo',
    claude_model: 'claude-3-5-sonnet-20240620',
    google_model: 'gemini-1.5-pro',
    ai21_model: 'jamba-1.5-large',
    mistralai_model: 'mistral-large-latest',
    cohere_model: 'command-r-plus',
    perplexity_model: 'llama-3.1-70b-instruct',
    groq_model: 'llama-3.1-70b-versatile',
    zerooneai_model: 'yi-large',
    blockentropy_model: 'be-70b-base-llama3.1',
    custom_model: '',
    custom_url: '',
    custom_include_body: '',
    custom_exclude_body: '',
    custom_include_headers: '',
    windowai_model: '',
    openrouter_model: openrouter_website_model,
    openrouter_use_fallback: false,
    openrouter_force_instruct: false,
    openrouter_group_models: false,
    openrouter_sort_models: 'alphabetically',
    openrouter_providers: [],
    openrouter_allow_fallbacks: true,
    jailbreak_system: false,
    reverse_proxy: '',
    chat_completion_source: chat_completion_sources.OPENAI,
    max_context_unlocked: false,
    api_url_scale: '',
    show_external_models: false,
    proxy_password: '',
    assistant_prefill: '',
    assistant_impersonation: '',
    human_sysprompt_message: default_claude_human_sysprompt_message,
    claude_use_sysprompt: false,
    use_makersuite_sysprompt: true,
    use_alt_scale: false,
    squash_system_messages: false,
    image_inlining: false,
    inline_image_quality: 'low',
    bypass_status_check: false,
    continue_prefill: false,
    function_calling: false,
    names_behavior: character_names_behavior.DEFAULT,
    continue_postfix: continue_postfix_types.SPACE,
    custom_prompt_post_processing: custom_prompt_post_processing_types.NONE,
    seed: -1,
    n: 1,
};

const oai_settings = {
    preset_settings_openai: 'Default',
    temp_openai: 1.0,
    freq_pen_openai: 0,
    pres_pen_openai: 0,
    top_p_openai: 1.0,
    top_k_openai: 0,
    min_p_openai: 0,
    top_a_openai: 0,
    repetition_penalty_openai: 1,
    stream_openai: false,
    websearch_cohere: false,
    openai_max_context: max_4k,
    openai_max_tokens: 300,
    wrap_in_quotes: false,
    ...chatCompletionDefaultPrompts,
    ...promptManagerDefaultPromptOrders,
    send_if_empty: '',
    impersonation_prompt: default_impersonation_prompt,
    new_chat_prompt: default_new_chat_prompt,
    new_group_chat_prompt: default_new_group_chat_prompt,
    new_example_chat_prompt: default_new_example_chat_prompt,
    continue_nudge_prompt: default_continue_nudge_prompt,
    bias_preset_selected: default_bias,
    bias_presets: default_bias_presets,
    wi_format: default_wi_format,
    group_nudge_prompt: default_group_nudge_prompt,
    scenario_format: default_scenario_format,
    personality_format: default_personality_format,
    openai_model: 'gpt-4-turbo',
    claude_model: 'claude-3-5-sonnet-20240620',
    google_model: 'gemini-1.5-pro',
    ai21_model: 'jamba-1.5-large',
    mistralai_model: 'mistral-large-latest',
    cohere_model: 'command-r-plus',
    perplexity_model: 'llama-3.1-70b-instruct',
    groq_model: 'llama-3.1-70b-versatile',
    zerooneai_model: 'yi-large',
    blockentropy_model: 'be-70b-base-llama3.1',
    custom_model: '',
    custom_url: '',
    custom_include_body: '',
    custom_exclude_body: '',
    custom_include_headers: '',
    windowai_model: '',
    openrouter_model: openrouter_website_model,
    openrouter_use_fallback: false,
    openrouter_force_instruct: false,
    openrouter_group_models: false,
    openrouter_sort_models: 'alphabetically',
    openrouter_providers: [],
    openrouter_allow_fallbacks: true,
    jailbreak_system: false,
    reverse_proxy: '',
    chat_completion_source: chat_completion_sources.OPENAI,
    max_context_unlocked: false,
    api_url_scale: '',
    show_external_models: false,
    proxy_password: '',
    assistant_prefill: '',
    assistant_impersonation: '',
    human_sysprompt_message: default_claude_human_sysprompt_message,
    claude_use_sysprompt: false,
    use_makersuite_sysprompt: true,
    use_alt_scale: false,
    squash_system_messages: false,
    image_inlining: false,
    inline_image_quality: 'low',
    bypass_status_check: false,
    continue_prefill: false,
    function_calling: false,
    names_behavior: character_names_behavior.DEFAULT,
    continue_postfix: continue_postfix_types.SPACE,
    custom_prompt_post_processing: custom_prompt_post_processing_types.NONE,
    seed: -1,
    n: 1,
};

export let proxies = [
    {
        name: 'None',
        url: '',
        password: '',
    },
];
export let selected_proxy = proxies[0];

let openai_setting_names;
let openai_settings;


let promptManager = null;

async function validateReverseProxy() {
    if (!oai_settings.reverse_proxy) {
        return;
    }

    try {
        new URL(oai_settings.reverse_proxy);
    }
    catch (err) {
        toastr.error('Entered reverse proxy address is not a valid URL');
        setOnlineStatus('no_connection');
        resultCheckStatus();
        throw err;
    }
    const rememberKey = `Proxy_SkipConfirm_${getStringHash(oai_settings.reverse_proxy)}`;
    const skipConfirm = localStorage.getItem(rememberKey) === 'true';

    const confirmation = skipConfirm || await Popup.show.confirm(t`Connecting To Proxy`, await renderTemplateAsync('proxyConnectionWarning', { proxyURL: DOMPurify.sanitize(oai_settings.reverse_proxy) }));

    if (!confirmation) {
        toastr.error('Update or remove your reverse proxy settings.');
        setOnlineStatus('no_connection');
        resultCheckStatus();
        throw new Error('Proxy connection denied.');
    }

    localStorage.setItem(rememberKey, String(true));
}

/**
 * Converts the Chat Completion object to an Instruct Mode prompt string.
 * @param {object[]} messages Array of messages
 * @param {string} type Generation type
 * @returns {string} Text completion prompt
 */
function convertChatCompletionToInstruct(messages, type) {
    const newChatPrompts = [
        substituteParams(oai_settings.new_chat_prompt),
        substituteParams(oai_settings.new_example_chat_prompt),
        substituteParams(oai_settings.new_group_chat_prompt),
    ];
    messages = messages.filter(x => !newChatPrompts.includes(x.content));

    let chatMessagesText = '';
    let systemPromptText = '';
    let examplesText = '';

    function getPrefix(message) {
        let prefix;

        if (message.role === 'user' || message.name === 'example_user') {
            if (selected_group) {
                prefix = '';
            } else if (message.name === 'example_user') {
                prefix = name1;
            } else {
                prefix = message.name ?? name1;
            }
        }

        if (message.role === 'assistant' || message.name === 'example_assistant') {
            if (selected_group) {
                prefix = '';
            }
            else if (message.name === 'example_assistant') {
                prefix = name2;
            } else {
                prefix = message.name ?? name2;
            }
        }

        return prefix;
    }

    function toString(message) {
        if (message.role === 'system' && !message.name) {
            return message.content;
        }

        const prefix = getPrefix(message);
        return prefix ? `${prefix}: ${message.content}` : message.content;
    }

    const firstChatMessage = messages.findIndex(message => message.role === 'assistant' || message.role === 'user');
    const systemPromptMessages = messages.slice(0, firstChatMessage).filter(message => message.role === 'system' && !message.name);

    if (systemPromptMessages.length) {
        systemPromptText = systemPromptMessages.map(message => message.content).join('\n');
        systemPromptText = formatInstructModeSystemPrompt(systemPromptText);
    }

    const exampleMessages = messages.filter(x => x.role === 'system' && (x.name === 'example_user' || x.name === 'example_assistant'));

    if (exampleMessages.length) {
        const blockHeading = power_user.context.example_separator ? (substituteParams(power_user.context.example_separator) + '\n') : '';
        const examplesArray = exampleMessages.map(m => '<START>\n' + toString(m));
        examplesText = blockHeading + formatInstructModeExamples(examplesArray, name1, name2).join('');
    }

    const chatMessages = messages.slice(firstChatMessage);

    if (chatMessages.length) {
        chatMessagesText = substituteParams(power_user.context.chat_start) + '\n';

        for (const message of chatMessages) {
            const name = getPrefix(message);
            const isUser = message.role === 'user';
            const isNarrator = message.role === 'system';
            chatMessagesText += formatInstructModeChat(name, message.content, isUser, isNarrator, '', name1, name2, false);
        }
    }

    const isImpersonate = type === 'impersonate';
    const isContinue = type === 'continue';
    const isQuiet = type === 'quiet';
    const isQuietToLoud = false; // Quiet to loud not implemented for Chat Completion
    const promptName = isImpersonate ? name1 : name2;
    const promptLine = isContinue ? '' : formatInstructModePrompt(promptName, isImpersonate, '', name1, name2, isQuiet, isQuietToLoud).trimStart();

    let prompt = [systemPromptText, examplesText, chatMessagesText, promptLine]
        .filter(x => x)
        .map(x => x.endsWith('\n') ? x : `${x}\n`)
        .join('');

    if (isContinue) {
        prompt = prompt.replace(/\n$/, '');
    }

    return prompt;
}

/**
 * Formats chat messages into chat completion messages.
 * @param {object[]} chat - Array containing all messages.
 * @returns {object[]} - Array containing all messages formatted for chat completion.
 */
function setOpenAIMessages(chat) {
    let j = 0;
    // clean openai msgs
    const messages = [];
    for (let i = chat.length - 1; i >= 0; i--) {
        let role = chat[j]['is_user'] ? 'user' : 'assistant';
        let content = chat[j]['mes'];

        // 100% legal way to send a message as system
        if (chat[j].extra?.type === system_message_types.NARRATOR) {
            role = 'system';
        }

        // for groups or sendas command - prepend a character's name
        switch (oai_settings.names_behavior) {
            case character_names_behavior.NONE:
                break;
            case character_names_behavior.DEFAULT:
                if ((selected_group && chat[j].name !== name1) || (chat[j].force_avatar && chat[j].name !== name1 && chat[j].extra?.type !== system_message_types.NARRATOR)) {
                    content = `${chat[j].name}: ${content}`;
                }
                break;
            case character_names_behavior.CONTENT:
                if (chat[j].extra?.type !== system_message_types.NARRATOR) {
                    content = `${chat[j].name}: ${content}`;
                }
                break;
            case character_names_behavior.COMPLETION:
                break;
            default:
                break;
        }

        // remove caret return (waste of tokens)
        content = content.replace(/\r/gm, '');

        // Apply the "wrap in quotes" option
        if (role == 'user' && oai_settings.wrap_in_quotes) content = `"${content}"`;
        const name = chat[j]['name'];
        const image = chat[j]?.extra?.image;
        messages[i] = { 'role': role, 'content': content, name: name, 'image': image };
        j++;
    }

    return messages;
}

/**
 * Formats chat examples into chat completion messages.
 * @param {string[]} mesExamplesArray - Array containing all examples.
 * @returns {object[]} - Array containing all examples formatted for chat completion.
 */
function setOpenAIMessageExamples(mesExamplesArray) {
    // get a nice array of all blocks of all example messages = array of arrays (important!)
    const examples = [];
    for (let item of mesExamplesArray) {
        // remove <START> {Example Dialogue:} and replace \r\n with just \n
        let replaced = item.replace(/<START>/i, '{Example Dialogue:}').replace(/\r/gm, '');
        let parsed = parseExampleIntoIndividual(replaced, true);
        // add to the example message blocks array
        examples.push(parsed);
    }
    return examples;
}

/**
 * One-time setup for prompt manager module.
 *
 * @param openAiSettings
 * @returns {PromptManager|null}
 */
function setupChatCompletionPromptManager(openAiSettings) {
    // Do not set up prompt manager more than once
    if (promptManager) {
        promptManager.render(false);
        return promptManager;
    }

    promptManager = new PromptManager();

    const configuration = {
        prefix: 'completion_',
        containerIdentifier: 'completion_prompt_manager',
        listIdentifier: 'completion_prompt_manager_list',
        toggleDisabled: [],
        sortableDelay: getSortableDelay(),
        defaultPrompts: {
            main: default_main_prompt,
            nsfw: default_nsfw_prompt,
            jailbreak: default_jailbreak_prompt,
            enhanceDefinitions: default_enhance_definitions_prompt,
        },
        promptOrder: {
            strategy: 'global',
            dummyId: 100001,
        },
    };

    promptManager.saveServiceSettings = () => {
        saveSettingsDebounced();
        return new Promise((resolve) => eventSource.once(event_types.SETTINGS_UPDATED, resolve));
    };

    promptManager.tryGenerate = () => {
        if (characters[this_chid]) {
            return Generate('normal', {}, true);
        } else {
            return Promise.resolve();
        }
    };

    promptManager.tokenHandler = tokenHandler;

    promptManager.init(configuration, openAiSettings);
    promptManager.render(false);

    return promptManager;
}

/**
 * Parses the example messages into individual messages.
 * @param {string} messageExampleString - The string containing the example messages
 * @param {boolean} appendNamesForGroup - Whether to append the character name for group chats
 * @returns {Message[]} Array of message objects
 */
export function parseExampleIntoIndividual(messageExampleString, appendNamesForGroup = true) {
    let result = []; // array of msgs
    let tmp = messageExampleString.split('\n');
    let cur_msg_lines = [];
    let in_user = false;
    let in_bot = false;
    // DRY my cock and balls :)
    function add_msg(name, role, system_name) {
        // join different newlines (we split them by \n and join by \n)
        // remove char name
        // strip to remove extra spaces
        let parsed_msg = cur_msg_lines.join('\n').replace(name + ':', '').trim();

        if (appendNamesForGroup && selected_group && ['example_user', 'example_assistant'].includes(system_name)) {
            parsed_msg = `${name}: ${parsed_msg}`;
        }

        result.push({ 'role': role, 'content': parsed_msg, 'name': system_name });
        cur_msg_lines = [];
    }
    // skip first line as it'll always be "This is how {bot name} should talk"
    for (let i = 1; i < tmp.length; i++) {
        let cur_str = tmp[i];
        // if it's the user message, switch into user mode and out of bot mode
        // yes, repeated code, but I don't care
        if (cur_str.startsWith(name1 + ':')) {
            in_user = true;
            // we were in the bot mode previously, add the message
            if (in_bot) {
                add_msg(name2, 'system', 'example_assistant');
            }
            in_bot = false;
        } else if (cur_str.startsWith(name2 + ':')) {
            in_bot = true;
            // we were in the user mode previously, add the message
            if (in_user) {
                add_msg(name1, 'system', 'example_user');
            }
            in_user = false;
        }
        // push the current line into the current message array only after checking for presence of user/bot
        cur_msg_lines.push(cur_str);
    }
    // Special case for last message in a block because we don't have a new message to trigger the switch
    if (in_user) {
        add_msg(name1, 'system', 'example_user');
    } else if (in_bot) {
        add_msg(name2, 'system', 'example_assistant');
    }
    return result;
}

function formatWorldInfo(value) {
    if (!value) {
        return '';
    }

    if (!oai_settings.wi_format.trim()) {
        return value;
    }

    return stringFormat(oai_settings.wi_format, value);
}

/**
 * This function populates the injections in the conversation.
 *
 * @param {Prompt[]} prompts - Array containing injection prompts.
 * @param {Object[]} messages - Array containing all messages.
 */
function populationInjectionPrompts(prompts, messages) {
    let totalInsertedMessages = 0;

    const roleTypes = {
        'system': extension_prompt_roles.SYSTEM,
        'user': extension_prompt_roles.USER,
        'assistant': extension_prompt_roles.ASSISTANT,
    };

    for (let i = 0; i <= MAX_INJECTION_DEPTH; i++) {
        // Get prompts for current depth
        const depthPrompts = prompts.filter(prompt => prompt.injection_depth === i && prompt.content);

        // Order of priority (most important go lower)
        const roles = ['system', 'user', 'assistant'];
        const roleMessages = [];
        const separator = '\n';
        const wrap = false;

        for (const role of roles) {
            // Get prompts for current role
            const rolePrompts = depthPrompts.filter(prompt => prompt.role === role).map(x => x.content).join(separator);
            // Get extension prompt
            const extensionPrompt = getExtensionPrompt(extension_prompt_types.IN_CHAT, i, separator, roleTypes[role], wrap);

            const jointPrompt = [rolePrompts, extensionPrompt].filter(x => x).map(x => x.trim()).join(separator);

            if (jointPrompt && jointPrompt.length) {
                roleMessages.push({ 'role': role, 'content': jointPrompt, injected: true });
            }
        }

        if (roleMessages.length) {
            const injectIdx = i + totalInsertedMessages;
            messages.splice(injectIdx, 0, ...roleMessages);
            totalInsertedMessages += roleMessages.length;
        }
    }

    messages = messages.reverse();
    return messages;
}

export function isOpenRouterWithInstruct() {
    return oai_settings.chat_completion_source === chat_completion_sources.OPENROUTER && oai_settings.openrouter_force_instruct && power_user.instruct.enabled;
}

/**
 * Populates the chat history of the conversation.
 * @param {object[]} messages - Array containing all messages.
 * @param {import('./PromptManager').PromptCollection} prompts - Map object containing all prompts where the key is the prompt identifier and the value is the prompt object.
 * @param {ChatCompletion} chatCompletion - An instance of ChatCompletion class that will be populated with the prompts.
 * @param type
 * @param cyclePrompt
 */
async function populateChatHistory(messages, prompts, chatCompletion, type = null, cyclePrompt = null) {
    if (!prompts.has('chatHistory')) {
        return;
    }

    chatCompletion.add(new MessageCollection('chatHistory'), prompts.index('chatHistory'));

    // Reserve budget for new chat message
    const newChat = selected_group ? oai_settings.new_group_chat_prompt : oai_settings.new_chat_prompt;
    const newChatMessage = new Message('system', substituteParams(newChat), 'newMainChat');
    chatCompletion.reserveBudget(newChatMessage);

    // Reserve budget for group nudge
    let groupNudgeMessage = null;
    const noGroupNudgeTypes = ['impersonate'];
    if (selected_group && prompts.has('groupNudge') && !noGroupNudgeTypes.includes(type)) {
        groupNudgeMessage = Message.fromPrompt(prompts.get('groupNudge'));
        chatCompletion.reserveBudget(groupNudgeMessage);
    }

    // Reserve budget for continue nudge
    let continueMessage = null;
    const instruct = isOpenRouterWithInstruct();
    if (type === 'continue' && cyclePrompt && !instruct && !oai_settings.continue_prefill) {
        const promptObject = {
            identifier: 'continueNudge',
            role: 'system',
            content: substituteParamsExtended(oai_settings.continue_nudge_prompt, { lastChatMessage: String(cyclePrompt).trim() }),
            system_prompt: true,
        };
        const continuePrompt = new Prompt(promptObject);
        const preparedPrompt = promptManager.preparePrompt(continuePrompt);
        continueMessage = Message.fromPrompt(preparedPrompt);
        chatCompletion.reserveBudget(continueMessage);
    }

    const lastChatPrompt = messages[messages.length - 1];
    const message = new Message('user', oai_settings.send_if_empty, 'emptyUserMessageReplacement');
    if (lastChatPrompt && lastChatPrompt.role === 'assistant' && oai_settings.send_if_empty && chatCompletion.canAfford(message)) {
        chatCompletion.insert(message, 'chatHistory');
    }

    const imageInlining = isImageInliningSupported();

    // Insert chat messages as long as there is budget available
    const chatPool = [...messages].reverse();
    const firstNonInjected = chatPool.find(x => !x.injected);
    for (let index = 0; index < chatPool.length; index++) {
        const chatPrompt = chatPool[index];

        // We do not want to mutate the prompt
        const prompt = new Prompt(chatPrompt);
        prompt.identifier = `chatHistory-${messages.length - index}`;
        const chatMessage = Message.fromPrompt(promptManager.preparePrompt(prompt));

        if (promptManager.serviceSettings.names_behavior === character_names_behavior.COMPLETION && prompt.name) {
            const messageName = promptManager.isValidName(prompt.name) ? prompt.name : promptManager.sanitizeName(prompt.name);
            chatMessage.setName(messageName);
        }

        if (imageInlining && chatPrompt.image) {
            await chatMessage.addImage(chatPrompt.image);
        }

        if (chatCompletion.canAfford(chatMessage)) {
            if (type === 'continue' && oai_settings.continue_prefill && chatPrompt === firstNonInjected) {
                const collection = new MessageCollection('continuePrefill', chatMessage);
                chatCompletion.add(collection, -1);
                continue;
            }

            chatCompletion.insertAtStart(chatMessage, 'chatHistory');
        } else {
            break;
        }
    }

    // Insert and free new chat
    chatCompletion.freeBudget(newChatMessage);
    chatCompletion.insertAtStart(newChatMessage, 'chatHistory');

    // Reserve budget for group nudge
    if (selected_group && groupNudgeMessage) {
        chatCompletion.freeBudget(groupNudgeMessage);
        chatCompletion.insertAtEnd(groupNudgeMessage, 'chatHistory');
    }

    // Insert and free continue nudge
    if (type === 'continue' && continueMessage) {
        chatCompletion.freeBudget(continueMessage);
        chatCompletion.insertAtEnd(continueMessage, 'chatHistory');
    }
}

/**
 * This function populates the dialogue examples in the conversation.
 *
 * @param {import('./PromptManager').PromptCollection} prompts - Map object containing all prompts where the key is the prompt identifier and the value is the prompt object.
 * @param {ChatCompletion} chatCompletion - An instance of ChatCompletion class that will be populated with the prompts.
 * @param {Object[]} messageExamples - Array containing all message examples.
 */
function populateDialogueExamples(prompts, chatCompletion, messageExamples) {
    if (!prompts.has('dialogueExamples')) {
        return;
    }

    chatCompletion.add(new MessageCollection('dialogueExamples'), prompts.index('dialogueExamples'));
    if (Array.isArray(messageExamples) && messageExamples.length) {
        const newExampleChat = new Message('system', substituteParams(oai_settings.new_example_chat_prompt), 'newChat');
        [...messageExamples].forEach((dialogue, dialogueIndex) => {
            let examplesAdded = 0;

            if (chatCompletion.canAfford(newExampleChat)) chatCompletion.insert(newExampleChat, 'dialogueExamples');

            for (let promptIndex = 0; promptIndex < dialogue.length; promptIndex++) {
                const prompt = dialogue[promptIndex];
                const role = 'system';
                const content = prompt.content || '';
                const identifier = `dialogueExamples ${dialogueIndex}-${promptIndex}`;

                const chatMessage = new Message(role, content, identifier);
                chatMessage.setName(prompt.name);
                if (!chatCompletion.canAfford(chatMessage)) {
                    break;
                }
                chatCompletion.insert(chatMessage, 'dialogueExamples');
                examplesAdded++;
            }

            if (0 === examplesAdded) {
                chatCompletion.removeLastFrom('dialogueExamples');
            }
        });
    }
}

/**
 * @param {number} position - Prompt position in the extensions object.
 * @returns {string|false} - The prompt position for prompt collection.
 */
function getPromptPosition(position) {
    if (position == extension_prompt_types.BEFORE_PROMPT) {
        return 'start';
    }

    if (position == extension_prompt_types.IN_PROMPT) {
        return 'end';
    }

    return false;
}

/**
 * Gets a Chat Completion role based on the prompt role.
 * @param {number} role Role of the prompt.
 * @returns {string} Mapped role.
 */
function getPromptRole(role) {
    switch (role) {
        case extension_prompt_roles.SYSTEM:
            return 'system';
        case extension_prompt_roles.USER:
            return 'user';
        case extension_prompt_roles.ASSISTANT:
            return 'assistant';
        default:
            return 'system';
    }
}

/**
 * Populate a chat conversation by adding prompts to the conversation and managing system and user prompts.
 *
 * @param {import('./PromptManager.js').PromptCollection} prompts - PromptCollection containing all prompts where the key is the prompt identifier and the value is the prompt object.
 * @param {ChatCompletion} chatCompletion - An instance of ChatCompletion class that will be populated with the prompts.
 * @param {Object} options - An object with optional settings.
 * @param {string} options.bias - A bias to be added in the conversation.
 * @param {string} options.quietPrompt - Instruction prompt for extras
 * @param {string} options.quietImage - Image prompt for extras
 * @param {string} options.type - The type of the chat, can be 'impersonate'.
 * @param {string} options.cyclePrompt - The last prompt in the conversation.
 * @param {object[]} options.messages - Array containing all messages.
 * @param {object[]} options.messageExamples - Array containing all message examples.
 * @returns {Promise<void>}
 */
async function populateChatCompletion(prompts, chatCompletion, { bias, quietPrompt, quietImage, type, cyclePrompt, messages, messageExamples }) {
    // Helper function for preparing a prompt, that already exists within the prompt collection, for completion
    const addToChatCompletion = (source, target = null) => {
        // We need the prompts array to determine a position for the source.
        if (false === prompts.has(source)) return;

        if (promptManager.isPromptDisabledForActiveCharacter(source) && source !== 'main') {
            promptManager.log(`Skipping prompt ${source} because it is disabled`);
            return;
        }

        const prompt = prompts.get(source);

        if (prompt.injection_position === INJECTION_POSITION.ABSOLUTE) {
            promptManager.log(`Skipping prompt ${source} because it is an absolute prompt`);
            return;
        }

        const index = target ? prompts.index(target) : prompts.index(source);
        const collection = new MessageCollection(source);
        collection.add(Message.fromPrompt(prompt));
        chatCompletion.add(collection, index);
    };

    chatCompletion.reserveBudget(3); // every reply is primed with <|start|>assistant<|message|>
    // Character and world information
    addToChatCompletion('worldInfoBefore');
    addToChatCompletion('main');
    addToChatCompletion('worldInfoAfter');
    addToChatCompletion('charDescription');
    addToChatCompletion('charPersonality');
    addToChatCompletion('scenario');
    addToChatCompletion('personaDescription');

    // Collection of control prompts that will always be positioned last
    chatCompletion.setOverriddenPrompts(prompts.overriddenPrompts);
    const controlPrompts = new MessageCollection('controlPrompts');

    const impersonateMessage = Message.fromPrompt(prompts.get('impersonate')) ?? null;
    if (type === 'impersonate') controlPrompts.add(impersonateMessage);

    // Add quiet prompt to control prompts
    // This should always be last, even in control prompts. Add all further control prompts BEFORE this prompt
    const quietPromptMessage = Message.fromPrompt(prompts.get('quietPrompt')) ?? null;
    if (quietPromptMessage && quietPromptMessage.content) {
        if (isImageInliningSupported() && quietImage) {
            await quietPromptMessage.addImage(quietImage);
        }

        controlPrompts.add(quietPromptMessage);
    }

    chatCompletion.reserveBudget(controlPrompts);

    // Add ordered system and user prompts
    const systemPrompts = ['nsfw', 'jailbreak'];
    const userRelativePrompts = prompts.collection
        .filter((prompt) => false === prompt.system_prompt && prompt.injection_position !== INJECTION_POSITION.ABSOLUTE)
        .reduce((acc, prompt) => {
            acc.push(prompt.identifier);
            return acc;
        }, []);
    const absolutePrompts = prompts.collection
        .filter((prompt) => prompt.injection_position === INJECTION_POSITION.ABSOLUTE)
        .reduce((acc, prompt) => {
            acc.push(prompt);
            return acc;
        }, []);

    [...systemPrompts, ...userRelativePrompts].forEach(identifier => addToChatCompletion(identifier));

    // Add enhance definition instruction
    if (prompts.has('enhanceDefinitions')) addToChatCompletion('enhanceDefinitions');

    // Bias
    if (bias && bias.trim().length) addToChatCompletion('bias');

    // Tavern Extras - Summary
    if (prompts.has('summary')) {
        const summary = prompts.get('summary');

        if (summary.position) {
            chatCompletion.insert(Message.fromPrompt(summary), 'main', summary.position);
        }
    }

    // Authors Note
    if (prompts.has('authorsNote')) {
        const authorsNote = prompts.get('authorsNote');

        if (authorsNote.position) {
            chatCompletion.insert(Message.fromPrompt(authorsNote), 'main', authorsNote.position);
        }
    }

    // Vectors Memory
    if (prompts.has('vectorsMemory')) {
        const vectorsMemory = prompts.get('vectorsMemory');

        if (vectorsMemory.position) {
            chatCompletion.insert(Message.fromPrompt(vectorsMemory), 'main', vectorsMemory.position);
        }
    }

    // Vectors Data Bank
    if (prompts.has('vectorsDataBank')) {
        const vectorsDataBank = prompts.get('vectorsDataBank');

        if (vectorsDataBank.position) {
            chatCompletion.insert(Message.fromPrompt(vectorsDataBank), 'main', vectorsDataBank.position);
        }
    }

    // Smart Context (ChromaDB)
    if (prompts.has('smartContext')) {
        const smartContext = prompts.get('smartContext');

        if (smartContext.position) {
            chatCompletion.insert(Message.fromPrompt(smartContext), 'main', smartContext.position);
        }
    }

    // Other relative extension prompts
    for (const prompt of prompts.collection.filter(p => p.extension && p.position)) {
        chatCompletion.insert(Message.fromPrompt(prompt), 'main', prompt.position);
    }

    // Add in-chat injections
    messages = populationInjectionPrompts(absolutePrompts, messages);

    // Decide whether dialogue examples should always be added
    if (power_user.pin_examples) {
        populateDialogueExamples(prompts, chatCompletion, messageExamples);
        await populateChatHistory(messages, prompts, chatCompletion, type, cyclePrompt);
    } else {
        await populateChatHistory(messages, prompts, chatCompletion, type, cyclePrompt);
        populateDialogueExamples(prompts, chatCompletion, messageExamples);
    }

    chatCompletion.freeBudget(controlPrompts);
    if (controlPrompts.collection.length) chatCompletion.add(controlPrompts);
}

/**
 * Combines system prompts with prompt manager prompts
 *
 * @param {Object} options - An object with optional settings.
 * @param {string} options.Scenario - The scenario or context of the dialogue.
 * @param {string} options.charPersonality - Description of the character's personality.
 * @param {string} options.name2 - The second name to be used in the messages.
 * @param {string} options.worldInfoBefore - The world info to be added before the main conversation.
 * @param {string} options.worldInfoAfter - The world info to be added after the main conversation.
 * @param {string} options.charDescription - Description of the character.
 * @param {string} options.quietPrompt - The quiet prompt to be used in the conversation.
 * @param {string} options.bias - The bias to be added in the conversation.
 * @param {Object} options.extensionPrompts - An object containing additional prompts.
 * @param {string} options.systemPromptOverride
 * @param {string} options.jailbreakPromptOverride
 * @param {string} options.personaDescription
 * @returns {Object} prompts - The prepared and merged system and user-defined prompts.
 */
function preparePromptsForChatCompletion({ Scenario, charPersonality, name2, worldInfoBefore, worldInfoAfter, charDescription, quietPrompt, bias, extensionPrompts, systemPromptOverride, jailbreakPromptOverride, personaDescription }) {
    const scenarioText = Scenario && oai_settings.scenario_format ? substituteParams(oai_settings.scenario_format) : '';
    const charPersonalityText = charPersonality && oai_settings.personality_format ? substituteParams(oai_settings.personality_format) : '';
    const groupNudge = substituteParams(oai_settings.group_nudge_prompt);
    const impersonationPrompt = oai_settings.impersonation_prompt ? substituteParams(oai_settings.impersonation_prompt) : '';

    // Create entries for system prompts
    const systemPrompts = [
        // Ordered prompts for which a marker should exist
        { role: 'system', content: formatWorldInfo(worldInfoBefore), identifier: 'worldInfoBefore' },
        { role: 'system', content: formatWorldInfo(worldInfoAfter), identifier: 'worldInfoAfter' },
        { role: 'system', content: charDescription, identifier: 'charDescription' },
        { role: 'system', content: charPersonalityText, identifier: 'charPersonality' },
        { role: 'system', content: scenarioText, identifier: 'scenario' },
        // Unordered prompts without marker
        { role: 'system', content: impersonationPrompt, identifier: 'impersonate' },
        { role: 'system', content: quietPrompt, identifier: 'quietPrompt' },
        { role: 'system', content: bias, identifier: 'bias' },
        { role: 'system', content: groupNudge, identifier: 'groupNudge' },
    ];

    // Tavern Extras - Summary
    const summary = extensionPrompts['1_memory'];
    if (summary && summary.value) systemPrompts.push({
        role: getPromptRole(summary.role),
        content: summary.value,
        identifier: 'summary',
        position: getPromptPosition(summary.position),
    });

    // Authors Note
    const authorsNote = extensionPrompts['2_floating_prompt'];
    if (authorsNote && authorsNote.value) systemPrompts.push({
        role: getPromptRole(authorsNote.role),
        content: authorsNote.value,
        identifier: 'authorsNote',
        position: getPromptPosition(authorsNote.position),
    });

    // Vectors Memory
    const vectorsMemory = extensionPrompts['3_vectors'];
    if (vectorsMemory && vectorsMemory.value) systemPrompts.push({
        role: 'system',
        content: vectorsMemory.value,
        identifier: 'vectorsMemory',
        position: getPromptPosition(vectorsMemory.position),
    });

    const vectorsDataBank = extensionPrompts['4_vectors_data_bank'];
    if (vectorsDataBank && vectorsDataBank.value) systemPrompts.push({
        role: getPromptRole(vectorsDataBank.role),
        content: vectorsDataBank.value,
        identifier: 'vectorsDataBank',
        position: getPromptPosition(vectorsDataBank.position),
    });

    // Smart Context (ChromaDB)
    const smartContext = extensionPrompts['chromadb'];
    if (smartContext && smartContext.value) systemPrompts.push({
        role: 'system',
        content: smartContext.value,
        identifier: 'smartContext',
        position: getPromptPosition(smartContext.position),
    });

    // Persona Description
    if (power_user.persona_description && power_user.persona_description_position === persona_description_positions.IN_PROMPT) {
        systemPrompts.push({ role: 'system', content: power_user.persona_description, identifier: 'personaDescription' });
    }

    const knownExtensionPrompts = [
        '1_memory',
        '2_floating_prompt',
        '3_vectors',
        '4_vectors_data_bank',
        'chromadb',
        'PERSONA_DESCRIPTION',
        'QUIET_PROMPT',
        'DEPTH_PROMPT',
    ];

    // Anything that is not a known extension prompt
    for (const key in extensionPrompts) {
        if (Object.hasOwn(extensionPrompts, key)) {
            const prompt = extensionPrompts[key];
            if (knownExtensionPrompts.includes(key)) continue;
            if (!extensionPrompts[key].value) continue;
            if (![extension_prompt_types.BEFORE_PROMPT, extension_prompt_types.IN_PROMPT].includes(prompt.position)) continue;

            systemPrompts.push({
                identifier: key.replace(/\W/g, '_'),
                position: getPromptPosition(prompt.position),
                role: getPromptRole(prompt.role),
                content: prompt.value,
                extension: true,
            });
        }
    }

    // This is the prompt order defined by the user
    const prompts = promptManager.getPromptCollection();

    // Merge system prompts with prompt manager prompts
    systemPrompts.forEach(prompt => {
        const collectionPrompt = prompts.get(prompt.identifier);

        // Apply system prompt role/depth overrides if they set in the prompt manager
        if (collectionPrompt) {
            // In-Chat / Relative
            prompt.injection_position = collectionPrompt.injection_position ?? prompt.injection_position;
            // Depth for In-Chat
            prompt.injection_depth = collectionPrompt.injection_depth ?? prompt.injection_depth;
            // Role (system, user, assistant)
            prompt.role = collectionPrompt.role ?? prompt.role;
        }

        const newPrompt = promptManager.preparePrompt(prompt);
        const markerIndex = prompts.index(prompt.identifier);

        if (-1 !== markerIndex) prompts.collection[markerIndex] = newPrompt;
        else prompts.add(newPrompt);
    });

    // Apply character-specific main prompt
    const systemPrompt = prompts.get('main') ?? null;
    if (systemPromptOverride && systemPrompt && systemPrompt.forbid_overrides !== true) {
        const mainOriginalContent = systemPrompt.content;
        systemPrompt.content = systemPromptOverride;
        const mainReplacement = promptManager.preparePrompt(systemPrompt, mainOriginalContent);
        prompts.override(mainReplacement, prompts.index('main'));
    }

    // Apply character-specific jailbreak
    const jailbreakPrompt = prompts.get('jailbreak') ?? null;
    if (jailbreakPromptOverride && jailbreakPrompt && jailbreakPrompt.forbid_overrides !== true) {
        const jbOriginalContent = jailbreakPrompt.content;
        jailbreakPrompt.content = jailbreakPromptOverride;
        const jbReplacement = promptManager.preparePrompt(jailbreakPrompt, jbOriginalContent);
        prompts.override(jbReplacement, prompts.index('jailbreak'));
    }

    return prompts;
}

/**
 * Take a configuration object and prepares messages for a chat with OpenAI's chat completion API.
 * Handles prompts, prepares chat history, manages token budget, and processes various user settings.
 *
 * @param {Object} content - System prompts provided by SillyTavern
 * @param {string} content.name2 - The second name to be used in the messages.
 * @param {string} content.charDescription - Description of the character.
 * @param {string} content.charPersonality - Description of the character's personality.
 * @param {string} content.Scenario - The scenario or context of the dialogue.
 * @param {string} content.worldInfoBefore - The world info to be added before the main conversation.
 * @param {string} content.worldInfoAfter - The world info to be added after the main conversation.
 * @param {string} content.bias - The bias to be added in the conversation.
 * @param {string} content.type - The type of the chat, can be 'impersonate'.
 * @param {string} content.quietPrompt - The quiet prompt to be used in the conversation.
 * @param {string} content.quietImage - Image prompt for extras
 * @param {string} content.cyclePrompt - The last prompt used for chat message continuation.
 * @param {string} content.systemPromptOverride - The system prompt override.
 * @param {string} content.jailbreakPromptOverride - The jailbreak prompt override.
 * @param {string} content.personaDescription - The persona description.
 * @param {object} content.extensionPrompts - An array of additional prompts.
 * @param {object[]} content.messages - An array of messages to be used as chat history.
 * @param {string[]} content.messageExamples - An array of messages to be used as dialogue examples.
 * @param dryRun - Whether this is a live call or not.
 * @returns {Promise<(any[]|boolean)[]>} An array where the first element is the prepared chat and the second element is a boolean flag.
 */
export async function prepareOpenAIMessages({
    name2,
    charDescription,
    charPersonality,
    Scenario,
    worldInfoBefore,
    worldInfoAfter,
    bias,
    type,
    quietPrompt,
    quietImage,
    extensionPrompts,
    cyclePrompt,
    systemPromptOverride,
    jailbreakPromptOverride,
    personaDescription,
    messages,
    messageExamples,
}, dryRun) {
    // Without a character selected, there is no way to accurately calculate tokens
    if (!promptManager.activeCharacter && dryRun) return [null, false];

    const chatCompletion = new ChatCompletion();
    if (power_user.console_log_prompts) chatCompletion.enableLogging();

    const userSettings = promptManager.serviceSettings;
    chatCompletion.setTokenBudget(userSettings.openai_max_context, userSettings.openai_max_tokens);

    try {
        // Merge markers and ordered user prompts with system prompts
        const prompts = preparePromptsForChatCompletion({
            Scenario,
            charPersonality,
            name2,
            worldInfoBefore,
            worldInfoAfter,
            charDescription,
            quietPrompt,
            quietImage,
            bias,
            extensionPrompts,
            systemPromptOverride,
            jailbreakPromptOverride,
            personaDescription,
            messages,
            messageExamples,
        });

        // Fill the chat completion with as much context as the budget allows
        await populateChatCompletion(prompts, chatCompletion, { bias, quietPrompt, quietImage, type, cyclePrompt, messages, messageExamples });
    } catch (error) {
        if (error instanceof TokenBudgetExceededError) {
            toastr.error('An error occurred while counting tokens: Token budget exceeded.');
            chatCompletion.log('Token budget exceeded.');
            promptManager.error = 'Not enough free tokens for mandatory prompts. Raise your token Limit or disable custom prompts.';
        } else if (error instanceof InvalidCharacterNameError) {
            toastr.warning('An error occurred while counting tokens: Invalid character name');
            chatCompletion.log('Invalid character name');
            promptManager.error = 'The name of at least one character contained whitespaces or special characters. Please check your user and character name.';
        } else {
            toastr.error('An unknown error occurred while counting tokens. Further information may be available in console.');
            chatCompletion.log('----- Unexpected error while preparing prompts -----');
            chatCompletion.log(error);
            chatCompletion.log(error.stack);
            chatCompletion.log('----------------------------------------------------');
        }
    } finally {
        // Pass chat completion to prompt manager for inspection
        promptManager.setChatCompletion(chatCompletion);

        if (oai_settings.squash_system_messages && dryRun == false) {
            chatCompletion.squashSystemMessages();
        }

        // All information is up-to-date, render.
        if (false === dryRun) promptManager.render(false);
    }

    const chat = chatCompletion.getChat();

    const eventData = { chat, dryRun };
    await eventSource.emit(event_types.CHAT_COMPLETION_PROMPT_READY, eventData);

    openai_messages_count = chat.filter(x => x?.role === 'user' || x?.role === 'assistant')?.length || 0;

    return [chat, promptManager.tokenHandler.counts];
}

function tryParseStreamingError(response, decoded) {
    try {
        const data = JSON.parse(decoded);

        if (!data) {
            return;
        }

        checkQuotaError(data);
        checkModerationError(data);

        if (data.error) {
            toastr.error(data.error.message || response.statusText, 'Chat Completion API');
            throw new Error(data);
        }

        if (data.message) {
            toastr.error(data.message, 'Chat Completion API');
            throw new Error(data);
        }
    }
    catch {
        // No JSON. Do nothing.
    }
}

function checkQuotaError(data) {
    const errorText = `<h3>Encountered an error while processing your request.<br>
    Check you have credits available on your
    <a href="https://platform.openai.com/account/usage" target="_blank">OpenAI account</a>.<br>
    If you have sufficient credits, please try again later.</h3>`;

    if (!data) {
        return;
    }

    if (data.quota_error) {
        callPopup(errorText, 'text');
        throw new Error(data);
    }
}

function checkModerationError(data) {
    const moderationError = data?.error?.message?.includes('requires moderation');
    if (moderationError) {
        const moderationReason = `Reasons: ${data?.error?.metadata?.reasons?.join(', ') ?? '(N/A)'}`;
        const flaggedText = data?.error?.metadata?.flagged_input ?? '(N/A)';
        toastr.info(flaggedText, moderationReason, { timeOut: 10000 });
    }
}

async function sendWindowAIRequest(messages, signal, stream) {
    if (!('ai' in window)) {
        return showWindowExtensionError();
    }

    let content = '';
    let lastContent = '';
    let finished = false;

    const currentModel = await window.ai.getCurrentModel();
    let temperature = Number(oai_settings.temp_openai);

    if ((currentModel.includes('claude') || currentModel.includes('palm-2')) && temperature > claude_max_temp) {
        console.warn(`Claude and PaLM models only supports temperature up to ${claude_max_temp}. Clamping ${temperature} to ${claude_max_temp}.`);
        temperature = claude_max_temp;
    }

    async function* windowStreamingFunction() {
        while (true) {
            if (signal.aborted) {
                return;
            }

            // unhang UI thread
            await delay(1);

            if (lastContent !== content) {
                yield { text: content, swipes: [] };
            }

            lastContent = content;

            if (finished) {
                return;
            }
        }
    }

    const onStreamResult = (res, err) => {
        if (err) {
            return;
        }

        const thisContent = res?.message?.content;

        if (res?.isPartial) {
            content += thisContent;
        }
        else {
            content = thisContent;
        }
    };

    const generatePromise = window.ai.generateText(
        {
            messages: messages,
        },
        {
            temperature: temperature,
            maxTokens: oai_settings.openai_max_tokens,
            model: oai_settings.windowai_model || null,
            onStreamResult: onStreamResult,
        },
    );

    const handleGeneratePromise = (resolve, reject) => {
        generatePromise
            .then((res) => {
                content = res[0]?.message?.content;
                finished = true;
                resolve && resolve(content);
            })
            .catch((err) => {
                finished = true;
                reject && reject(err);
                handleWindowError(err);
            });
    };

    if (stream) {
        handleGeneratePromise();
        return windowStreamingFunction;
    } else {
        return new Promise((resolve, reject) => {
            signal.addEventListener('abort', (reason) => {
                reject(reason);
            });

            handleGeneratePromise(resolve, reject);
        });
    }
}

function getChatCompletionModel() {
    switch (oai_settings.chat_completion_source) {
        case chat_completion_sources.CLAUDE:
            return oai_settings.claude_model;
        case chat_completion_sources.OPENAI:
            return oai_settings.openai_model;
        case chat_completion_sources.WINDOWAI:
            return oai_settings.windowai_model;
        case chat_completion_sources.SCALE:
            return '';
        case chat_completion_sources.MAKERSUITE:
            return oai_settings.google_model;
        case chat_completion_sources.OPENROUTER:
            return oai_settings.openrouter_model !== openrouter_website_model ? oai_settings.openrouter_model : null;
        case chat_completion_sources.AI21:
            return oai_settings.ai21_model;
        case chat_completion_sources.MISTRALAI:
            return oai_settings.mistralai_model;
        case chat_completion_sources.CUSTOM:
            return oai_settings.custom_model;
        case chat_completion_sources.COHERE:
            return oai_settings.cohere_model;
        case chat_completion_sources.PERPLEXITY:
            return oai_settings.perplexity_model;
        case chat_completion_sources.GROQ:
            return oai_settings.groq_model;
        case chat_completion_sources.ZEROONEAI:
            return oai_settings.zerooneai_model;
        case chat_completion_sources.BLOCKENTROPY:
            return oai_settings.blockentropy_model;
        default:
            throw new Error(`Unknown chat completion source: ${oai_settings.chat_completion_source}`);
    }
}

function getOpenRouterModelTemplate(option) {
    const model = model_list.find(x => x.id === option?.element?.value);

    if (!option.id || !model) {
        return option.text;
    }

    let tokens_dollar = Number(1 / (1000 * model.pricing?.prompt));
    let tokens_rounded = (Math.round(tokens_dollar * 1000) / 1000).toFixed(0);

    const price = 0 === Number(model.pricing?.prompt) ? 'Free' : `${tokens_rounded}k t/$ `;

    return $((`
        <div class="flex-container flexFlowColumn" title="${DOMPurify.sanitize(model.id)}">
            <div><strong>${DOMPurify.sanitize(model.name)}</strong> | ${model.context_length} ctx | <small>${price}</small></div>
        </div>
    `));
}

function calculateOpenRouterCost() {
    if (oai_settings.chat_completion_source !== chat_completion_sources.OPENROUTER) {
        return;
    }

    let cost = 'Unknown';
    const model = model_list.find(x => x.id === oai_settings.openrouter_model);

    if (model?.pricing) {
        const completionCost = Number(model.pricing.completion);
        const promptCost = Number(model.pricing.prompt);
        const completionTokens = oai_settings.openai_max_tokens;
        const promptTokens = (oai_settings.openai_max_context - completionTokens);
        const totalCost = (completionCost * completionTokens) + (promptCost * promptTokens);
        if (!isNaN(totalCost)) {
            cost = '$' + totalCost.toFixed(3);
        }
    }

    $('#openrouter_max_prompt_cost').text(cost);
}

function saveModelList(data) {
    model_list = data.map((model) => ({ ...model }));
    model_list.sort((a, b) => a?.id && b?.id && a.id.localeCompare(b.id));

    if (oai_settings.chat_completion_source == chat_completion_sources.OPENROUTER) {
        model_list = openRouterSortBy(model_list, oai_settings.openrouter_sort_models);

        $('#model_openrouter_select').empty();

        if (true === oai_settings.openrouter_group_models) {
            appendOpenRouterOptions(openRouterGroupByVendor(model_list), oai_settings.openrouter_group_models);
        } else {
            appendOpenRouterOptions(model_list);
        }

        $('#model_openrouter_select').val(oai_settings.openrouter_model).trigger('change');
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.OPENAI) {
        $('#openai_external_category').empty();
        model_list.forEach((model) => {
            $('#openai_external_category').append(
                $('<option>', {
                    value: model.id,
                    text: model.id,
                }));
        });
        // If the selected model is not in the list, revert to default
        if (oai_settings.show_external_models) {
            const model = model_list.findIndex((model) => model.id == oai_settings.openai_model) !== -1 ? oai_settings.openai_model : default_settings.openai_model;
            $('#model_openai_select').val(model).trigger('change');
        }
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.CUSTOM) {
        $('.model_custom_select').empty();
        $('.model_custom_select').append('<option value="">None</option>');
        model_list.forEach((model) => {
            $('.model_custom_select').append(
                $('<option>', {
                    value: model.id,
                    text: model.id,
                    selected: model.id == oai_settings.custom_model,
                }));
        });

        if (!oai_settings.custom_model && model_list.length > 0) {
            $('#model_custom_select').val(model_list[0].id).trigger('change');
        }
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.ZEROONEAI) {
        $('#model_01ai_select').empty();
        model_list.forEach((model) => {
            $('#model_01ai_select').append(
                $('<option>', {
                    value: model.id,
                    text: model.id,
                }));
        });

        if (!oai_settings.zerooneai_model && model_list.length > 0) {
            oai_settings.zerooneai_model = model_list[0].id;
        }

        $('#model_01ai_select').val(oai_settings.zerooneai_model).trigger('change');
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.BLOCKENTROPY) {
        $('#model_blockentropy_select').empty();
        model_list.forEach((model) => {
            $('#model_blockentropy_select').append(
                $('<option>', {
                    value: model.id,
                    text: model.id,
                }));
        });

        if (!oai_settings.blockentropy_model && model_list.length > 0) {
            oai_settings.blockentropy_model = model_list[0].id;
        }

        $('#model_blockentropy_select').val(oai_settings.blockentropy_model).trigger('change');
    }
}

function appendOpenRouterOptions(model_list, groupModels = false, sort = false) {
    $('#model_openrouter_select').append($('<option>', { value: openrouter_website_model, text: 'Use OpenRouter website setting' }));

    const appendOption = (model, parent = null) => {
        (parent || $('#model_openrouter_select')).append(
            $('<option>', {
                value: model.id,
                text: model.name,
            }));
    };

    if (groupModels) {
        model_list.forEach((models, vendor) => {
            const optgroup = $(`<optgroup label="${vendor}">`);

            models.forEach((model) => {
                appendOption(model, optgroup);
            });

            $('#model_openrouter_select').append(optgroup);
        });
    } else {
        model_list.forEach((model) => {
            appendOption(model);
        });
    }
}

const openRouterSortBy = (data, property = 'alphabetically') => {
    return data.sort((a, b) => {
        if (property === 'context_length') {
            return b.context_length - a.context_length;
        } else if (property === 'pricing.prompt') {
            return parseFloat(a.pricing.prompt) - parseFloat(b.pricing.prompt);
        } else {
            // Alphabetically
            return a?.name && b?.name && a.name.localeCompare(b.name);
        }
    });
};

function openRouterGroupByVendor(array) {
    return array.reduce((acc, curr) => {
        const vendor = curr.id.split('/')[0];

        if (!acc.has(vendor)) {
            acc.set(vendor, []);
        }

        acc.get(vendor).push(curr);

        return acc;
    }, new Map());
}

async function sendAltScaleRequest(messages, logit_bias, signal, type) {
    const generate_url = '/api/backends/scale-alt/generate';

    let firstSysMsgs = [];
    for (let msg of messages) {
        if (msg.role === 'system') {
            firstSysMsgs.push(substituteParams(msg.name ? msg.name + ': ' + msg.content : msg.content));
        } else {
            break;
        }
    }

    let subsequentMsgs = messages.slice(firstSysMsgs.length);

    const joinedSysMsgs = substituteParams(firstSysMsgs.join('\n'));
    const joinedSubsequentMsgs = subsequentMsgs.reduce((acc, obj) => {
        return acc + obj.role + ': ' + obj.content + '\n';
    }, '');

    messages = substituteParams(joinedSubsequentMsgs);
    const messageId = getNextMessageId(type);
    replaceItemizedPromptText(messageId, messages);

    const generate_data = {
        sysprompt: joinedSysMsgs,
        prompt: messages,
        temp: Number(oai_settings.temp_openai),
        top_p: Number(oai_settings.top_p_openai),
        max_tokens: Number(oai_settings.openai_max_tokens),
        logit_bias: logit_bias,
    };

    const response = await fetch(generate_url, {
        method: 'POST',
        body: JSON.stringify(generate_data),
        headers: getRequestHeaders(),
        signal: signal,
    });

    if (!response.ok) {
        tryParseStreamingError(response, await response.text());
        throw new Error('Scale response does not indicate success.');
    }

    const data = await response.json();
    return data.output;
}

async function sendOpenAIRequest(type, messages, signal) {
    // Provide default abort signal
    if (!signal) {
        signal = new AbortController().signal;
    }

    // HACK: Filter out null and non-object messages
    if (!Array.isArray(messages)) {
        throw new Error('messages must be an array');
    }

    messages = messages.filter(msg => msg && typeof msg === 'object');

    let logit_bias = {};
    const messageId = getNextMessageId(type);
    const isClaude = oai_settings.chat_completion_source == chat_completion_sources.CLAUDE;
    const isOpenRouter = oai_settings.chat_completion_source == chat_completion_sources.OPENROUTER;
    const isScale = oai_settings.chat_completion_source == chat_completion_sources.SCALE;
    const isGoogle = oai_settings.chat_completion_source == chat_completion_sources.MAKERSUITE;
    const isOAI = oai_settings.chat_completion_source == chat_completion_sources.OPENAI;
    const isMistral = oai_settings.chat_completion_source == chat_completion_sources.MISTRALAI;
    const isCustom = oai_settings.chat_completion_source == chat_completion_sources.CUSTOM;
    const isCohere = oai_settings.chat_completion_source == chat_completion_sources.COHERE;
    const isPerplexity = oai_settings.chat_completion_source == chat_completion_sources.PERPLEXITY;
    const isGroq = oai_settings.chat_completion_source == chat_completion_sources.GROQ;
    const is01AI = oai_settings.chat_completion_source == chat_completion_sources.ZEROONEAI;
    const isTextCompletion = (isOAI && textCompletionModels.includes(oai_settings.openai_model)) || (isOpenRouter && oai_settings.openrouter_force_instruct && power_user.instruct.enabled);
    const isQuiet = type === 'quiet';
    const isImpersonate = type === 'impersonate';
    const isContinue = type === 'continue';
    const stream = oai_settings.stream_openai && !isQuiet && !isScale && !(isGoogle && oai_settings.google_model.includes('bison')) && !(isOAI && oai_settings.openai_model.startsWith('o1-'));
    const useLogprobs = !!power_user.request_token_probabilities;
    const canMultiSwipe = oai_settings.n > 1 && !isContinue && !isImpersonate && !isQuiet && (isOAI || isCustom);

    if (isTextCompletion && isOpenRouter) {
        messages = convertChatCompletionToInstruct(messages, type);
        replaceItemizedPromptText(messageId, messages);
    }

    // If we're using the window.ai extension, use that instead
    // Doesn't support logit bias yet
    if (oai_settings.chat_completion_source == chat_completion_sources.WINDOWAI) {
        return sendWindowAIRequest(messages, signal, stream);
    }

    const logitBiasSources = [chat_completion_sources.OPENAI, chat_completion_sources.OPENROUTER, chat_completion_sources.SCALE, chat_completion_sources.CUSTOM];
    if (oai_settings.bias_preset_selected
        && logitBiasSources.includes(oai_settings.chat_completion_source)
        && Array.isArray(oai_settings.bias_presets[oai_settings.bias_preset_selected])
        && oai_settings.bias_presets[oai_settings.bias_preset_selected].length) {
        logit_bias = biasCache || await calculateLogitBias();
        biasCache = logit_bias;
    }

    if (isScale && oai_settings.use_alt_scale) {
        return sendAltScaleRequest(messages, logit_bias, signal, type);
    }

    const model = getChatCompletionModel();
    const generate_data = {
        'messages': messages,
        'model': model,
        'temperature': Number(oai_settings.temp_openai),
        'frequency_penalty': Number(oai_settings.freq_pen_openai),
        'presence_penalty': Number(oai_settings.pres_pen_openai),
        'top_p': Number(oai_settings.top_p_openai),
        'max_tokens': oai_settings.openai_max_tokens,
        'stream': stream,
        'logit_bias': logit_bias,
        'stop': getCustomStoppingStrings(openai_max_stop_strings),
        'chat_completion_source': oai_settings.chat_completion_source,
        'n': canMultiSwipe ? oai_settings.n : undefined,
        'user_name': name1,
        'char_name': name2,
    };

    // Empty array will produce a validation error
    if (!Array.isArray(generate_data.stop) || !generate_data.stop.length) {
        delete generate_data.stop;
    }

    // Proxy is only supported for Claude, OpenAI, Mistral, and Google MakerSuite
    if (oai_settings.reverse_proxy && [chat_completion_sources.CLAUDE, chat_completion_sources.OPENAI, chat_completion_sources.MISTRALAI, chat_completion_sources.MAKERSUITE].includes(oai_settings.chat_completion_source)) {
        await validateReverseProxy();
        generate_data['reverse_proxy'] = oai_settings.reverse_proxy;
        generate_data['proxy_password'] = oai_settings.proxy_password;
    }

    // Add logprobs request (currently OpenAI only, max 5 on their side)
    if (useLogprobs && (isOAI || isCustom)) {
        generate_data['logprobs'] = 5;
    }

    // Remove logit bias, logprobs and stop strings if it's not supported by the model
    if (isOAI && oai_settings.openai_model.includes('vision') || isOpenRouter && oai_settings.openrouter_model.includes('vision')) {
        delete generate_data.logit_bias;
        delete generate_data.stop;
        delete generate_data.logprobs;
    }

    if (isClaude) {
        generate_data['top_k'] = Number(oai_settings.top_k_openai);
        generate_data['claude_use_sysprompt'] = oai_settings.claude_use_sysprompt;
        generate_data['stop'] = getCustomStoppingStrings(); // Claude shouldn't have limits on stop strings.
        generate_data['human_sysprompt_message'] = substituteParams(oai_settings.human_sysprompt_message);
        // Don't add a prefill on quiet gens (summarization)
        if (!isQuiet) {
            generate_data['assistant_prefill'] = isImpersonate ? substituteParams(oai_settings.assistant_impersonation) : substituteParams(oai_settings.assistant_prefill);
        }
    }

    if (isOpenRouter) {
        generate_data['top_k'] = Number(oai_settings.top_k_openai);
        generate_data['min_p'] = Number(oai_settings.min_p_openai);
        generate_data['repetition_penalty'] = Number(oai_settings.repetition_penalty_openai);
        generate_data['top_a'] = Number(oai_settings.top_a_openai);
        generate_data['use_fallback'] = oai_settings.openrouter_use_fallback;
        generate_data['provider'] = oai_settings.openrouter_providers;
        generate_data['allow_fallbacks'] = oai_settings.openrouter_allow_fallbacks;

        if (isTextCompletion) {
            generate_data['stop'] = getStoppingStrings(isImpersonate, isContinue);
        }
    }

    if (isScale) {
        generate_data['api_url_scale'] = oai_settings.api_url_scale;
    }

    if (isGoogle) {
        const nameStopString = isImpersonate ? `\n${name2}:` : `\n${name1}:`;
        const stopStringsLimit = 3; // 5 - 2 (nameStopString and new_chat_prompt)
        generate_data['top_k'] = Number(oai_settings.top_k_openai);
        generate_data['stop'] = [nameStopString, substituteParams(oai_settings.new_chat_prompt), ...getCustomStoppingStrings(stopStringsLimit)];
        generate_data['use_makersuite_sysprompt'] = oai_settings.use_makersuite_sysprompt;
    }

    if (isMistral) {
        generate_data['safe_prompt'] = false; // already defaults to false, but just incase they change that in the future.
    }

    if (isCustom) {
        generate_data['custom_url'] = oai_settings.custom_url;
        generate_data['custom_include_body'] = oai_settings.custom_include_body;
        generate_data['custom_exclude_body'] = oai_settings.custom_exclude_body;
        generate_data['custom_include_headers'] = oai_settings.custom_include_headers;
        generate_data['custom_prompt_post_processing'] = oai_settings.custom_prompt_post_processing;
    }

    if (isCohere) {
        // Clamp to 0.01 -> 0.99
        generate_data['top_p'] = Math.min(Math.max(Number(oai_settings.top_p_openai), 0.01), 0.99);
        generate_data['top_k'] = Number(oai_settings.top_k_openai);
        // Clamp to 0 -> 1
        generate_data['frequency_penalty'] = Math.min(Math.max(Number(oai_settings.freq_pen_openai), 0), 1);
        generate_data['presence_penalty'] = Math.min(Math.max(Number(oai_settings.pres_pen_openai), 0), 1);
        generate_data['stop'] = getCustomStoppingStrings(5);
        generate_data['websearch'] = oai_settings.websearch_cohere;
    }

    if (isPerplexity) {
        generate_data['top_k'] = Number(oai_settings.top_k_openai);
        // Normalize values. 1 == disabled. 0 == is usual disabled state in OpenAI.
        generate_data['frequency_penalty'] = Math.max(0, Number(oai_settings.freq_pen_openai)) + 1;
        generate_data['presence_penalty'] = Number(oai_settings.pres_pen_openai);

        // YEAH BRO JUST USE OPENAI CLIENT BRO
        delete generate_data['stop'];
    }

    // https://console.groq.com/docs/openai
    if (isGroq) {
        delete generate_data.logprobs;
        delete generate_data.logit_bias;
        delete generate_data.top_logprobs;
        delete generate_data.n;
    }

    // https://platform.01.ai/docs#request-body
    if (is01AI) {
        delete generate_data.logprobs;
        delete generate_data.logit_bias;
        delete generate_data.top_logprobs;
        delete generate_data.n;
        delete generate_data.frequency_penalty;
        delete generate_data.presence_penalty;
        delete generate_data.stop;
    }

    if ((isOAI || isOpenRouter || isMistral || isCustom || isCohere) && oai_settings.seed >= 0) {
        generate_data['seed'] = oai_settings.seed;
    }

    if (isFunctionCallingSupported() && !stream) {
        await registerFunctionTools(type, generate_data);
    }

    if (isOAI && oai_settings.openai_model.startsWith('o1-')) {
        generate_data.messages.forEach((msg) => {
            if (msg.role === 'system') {
                msg.role = 'user';
            }
        });
        generate_data.max_completion_tokens = generate_data.max_tokens;
        delete generate_data.max_tokens;
        delete generate_data.stream;
        delete generate_data.logprobs;
        delete generate_data.top_logprobs;
        delete generate_data.n;
        delete generate_data.temperature;
        delete generate_data.top_p;
        delete generate_data.frequency_penalty;
        delete generate_data.presence_penalty;
        delete generate_data.tools;
        delete generate_data.tool_choice;
        delete generate_data.stop;
        // It does support logit_bias, but the tokenizer used and its effect is yet unknown.
        // delete generate_data.logit_bias;
    }

    await eventSource.emit(event_types.CHAT_COMPLETION_SETTINGS_READY, generate_data);

    const generate_url = '/api/backends/chat-completions/generate';
    const response = await fetch(generate_url, {
        method: 'POST',
        body: JSON.stringify(generate_data),
        headers: getRequestHeaders(),
        signal: signal,
    });

    if (!response.ok) {
        tryParseStreamingError(response, await response.text());
        throw new Error(`Got response status ${response.status}`);
    }
    if (stream) {
        const eventStream = getEventSourceStream();
        response.body.pipeThrough(eventStream);
        const reader = eventStream.readable.getReader();
        return async function* streamData() {
            let text = '';
            const swipes = [];
            while (true) {
                const { done, value } = await reader.read();
                if (done) return;
                const rawData = value.data;
                if (rawData === '[DONE]') return;
                tryParseStreamingError(response, rawData);
                const parsed = JSON.parse(rawData);

                if (Array.isArray(parsed?.choices) && parsed?.choices?.[0]?.index > 0) {
                    const swipeIndex = parsed.choices[0].index - 1;
                    swipes[swipeIndex] = (swipes[swipeIndex] || '') + getStreamingReply(parsed);
                } else {
                    text += getStreamingReply(parsed);
                }

                yield { text, swipes: swipes, logprobs: parseChatCompletionLogprobs(parsed) };
            }
        };
    }
    else {
        const data = await response.json();

        checkQuotaError(data);
        checkModerationError(data);

        if (data.error) {
            toastr.error(data.error.message || response.statusText, 'API returned an error');
            throw new Error(data);
        }

        if (type !== 'quiet') {
            const logprobs = parseChatCompletionLogprobs(data);
            // Delay is required to allow the active message to be updated to
            // the one we are generating (happens right after sendOpenAIRequest)
            delay(1).then(() => saveLogprobsForActiveMessage(logprobs, null));
        }

        if (isFunctionCallingSupported()) {
            await checkFunctionToolCalls(data);
        }

        return data;
    }
}

/**
 * Register function tools for the next chat completion request.
 * @param {string} type Generation type
 * @param {object} data Generation data
 */
async function registerFunctionTools(type, data) {
    let toolChoice = 'auto';
    const tools = [];

    /**
     * @type {registerFunctionTool}
     */
    const registerFunctionTool = (name, description, parameters, required) => {
        tools.push({
            type: 'function',
            function: {
                name,
                description,
                parameters,
            },
        });

        if (required) {
            toolChoice = 'required';
        }
    };

    /**
     * @type {FunctionToolRegister}
     */
    const args = {
        type,
        data,
        registerFunctionTool,
    };

    await eventSource.emit(event_types.LLM_FUNCTION_TOOL_REGISTER, args);

    if (tools.length) {
        console.log('Registered function tools:', tools);

        data['tools'] = tools;
        data['tool_choice'] = toolChoice;
    }
}

async function checkFunctionToolCalls(data) {
    const oaiCompat = [
        chat_completion_sources.OPENAI,
        chat_completion_sources.CUSTOM,
        chat_completion_sources.MISTRALAI,
        chat_completion_sources.OPENROUTER,
        chat_completion_sources.GROQ,
    ];
    if (oaiCompat.includes(oai_settings.chat_completion_source)) {
        if (!Array.isArray(data?.choices)) {
            return;
        }

        // Find a choice with 0-index
        const choice = data.choices.find(choice => choice.index === 0);

        if (!choice) {
            return;
        }

        const toolCalls = choice.message.tool_calls;

        if (!Array.isArray(toolCalls)) {
            return;
        }

        for (const toolCall of toolCalls) {
            if (typeof toolCall.function !== 'object') {
                continue;
            }

            /** @type {FunctionToolCall} */
            const args = toolCall.function;
            console.log('Function tool call:', toolCall);
            await eventSource.emit(event_types.LLM_FUNCTION_TOOL_CALL, args);
        }
    }

    if ([chat_completion_sources.CLAUDE].includes(oai_settings.chat_completion_source)) {
        if (!Array.isArray(data?.content)) {
            return;
        }

        for (const content of data.content) {
            if (content.type === 'tool_use') {
                /** @type {FunctionToolCall} */
                const args = { name: content.name, arguments: JSON.stringify(content.input) };
                await eventSource.emit(event_types.LLM_FUNCTION_TOOL_CALL, args);
            }
        }
    }

    if ([chat_completion_sources.COHERE].includes(oai_settings.chat_completion_source)) {
        if (!Array.isArray(data?.tool_calls)) {
            return;
        }

        for (const toolCall of data.tool_calls) {
            /** @type {FunctionToolCall} */
            const args = { name: toolCall.name, arguments: JSON.stringify(toolCall.parameters) };
            console.log('Function tool call:', toolCall);
            await eventSource.emit(event_types.LLM_FUNCTION_TOOL_CALL, args);
        }
    }
}

export function isFunctionCallingSupported() {
    if (main_api !== 'openai') {
        return false;
    }

    if (!oai_settings.function_calling) {
        return false;
    }

    const supportedSources = [
        chat_completion_sources.OPENAI,
        chat_completion_sources.COHERE,
        chat_completion_sources.CUSTOM,
        chat_completion_sources.MISTRALAI,
        chat_completion_sources.CLAUDE,
        chat_completion_sources.OPENROUTER,
        chat_completion_sources.GROQ,
    ];
    return supportedSources.includes(oai_settings.chat_completion_source);
}

function getStreamingReply(data) {
    if (oai_settings.chat_completion_source == chat_completion_sources.CLAUDE) {
        return data?.delta?.text || '';
    } else if (oai_settings.chat_completion_source == chat_completion_sources.MAKERSUITE) {
        return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
        return data.choices[0]?.delta?.content ?? data.choices[0]?.message?.content ?? data.choices[0]?.text ?? '';
    }
}

/**
 * parseChatCompletionLogprobs converts the response data returned from a chat
 * completions-like source into an array of TokenLogprobs found in the response.
 * @param {Object} data - response data from a chat completions-like source
 * @returns {import('logprobs.js').TokenLogprobs[] | null} converted logprobs
 */
function parseChatCompletionLogprobs(data) {
    if (!data) {
        return null;
    }

    switch (oai_settings.chat_completion_source) {
        case chat_completion_sources.OPENAI:
        case chat_completion_sources.CUSTOM:
            if (!data.choices?.length) {
                return null;
            }
            // OpenAI Text Completion API is treated as a chat completion source
            // by SillyTavern, hence its presence in this function.
            return textCompletionModels.includes(oai_settings.openai_model)
                ? parseOpenAITextLogprobs(data.choices[0]?.logprobs)
                : parseOpenAIChatLogprobs(data.choices[0]?.logprobs);
        default:
        // implement other chat completion sources here
    }
    return null;
}

/**
 * parseOpenAIChatLogprobs receives a `logprobs` response from OpenAI's chat
 * completion API and converts into the structure used by the Token Probabilities
 * view.
 * @param {{content: { token: string, logprob: number, top_logprobs: { token: string, logprob: number }[] }[]}} logprobs
 * @returns {import('logprobs.js').TokenLogprobs[] | null} converted logprobs
 */
function parseOpenAIChatLogprobs(logprobs) {
    const { content } = logprobs ?? {};

    if (!Array.isArray(content)) {
        return null;
    }

    /** @type {({ token: string, logprob: number }) => [string, number]} */
    const toTuple = (x) => [x.token, x.logprob];

    return content.map(({ token, logprob, top_logprobs }) => {
        // Add the chosen token to top_logprobs if it's not already there, then
        // convert to a list of [token, logprob] pairs
        const chosenTopToken = top_logprobs.some((top) => token === top.token);
        const topLogprobs = chosenTopToken
            ? top_logprobs.map(toTuple)
            : [...top_logprobs.map(toTuple), [token, logprob]];
        return { token, topLogprobs };
    });
}

/**
 * parseOpenAITextLogprobs receives a `logprobs` response from OpenAI's text
 * completion API and converts into the structure used by the Token Probabilities
 * view.
 * @param {{tokens: string[], token_logprobs: number[], top_logprobs: { token: string, logprob: number }[][]}} logprobs
 * @returns {import('logprobs.js').TokenLogprobs[] | null} converted logprobs
 */
function parseOpenAITextLogprobs(logprobs) {
    const { tokens, token_logprobs, top_logprobs } = logprobs ?? {};

    if (!Array.isArray(tokens)) {
        return null;
    }

    return tokens.map((token, i) => {
        // Add the chosen token to top_logprobs if it's not already there, then
        // convert to a list of [token, logprob] pairs
        const topLogprobs = top_logprobs[i] ? Object.entries(top_logprobs[i]) : [];
        const chosenTopToken = topLogprobs.some(([topToken]) => token === topToken);
        if (!chosenTopToken) {
            topLogprobs.push([token, token_logprobs[i]]);
        }
        return { token, topLogprobs };
    });
}


function handleWindowError(err) {
    const text = parseWindowError(err);
    toastr.error(text, 'Window.ai returned an error');
    throw err;
}

function parseWindowError(err) {
    let text = 'Unknown error';

    switch (err) {
        case 'NOT_AUTHENTICATED':
            text = 'Incorrect API key / auth';
            break;
        case 'MODEL_REJECTED_REQUEST':
            text = 'AI model refused to fulfill a request';
            break;
        case 'PERMISSION_DENIED':
            text = 'User denied permission to the app';
            break;
        case 'REQUEST_NOT_FOUND':
            text = 'Permission request popup timed out';
            break;
        case 'INVALID_REQUEST':
            text = 'Malformed request';
            break;
    }

    return text;
}

async function calculateLogitBias() {
    const body = JSON.stringify(oai_settings.bias_presets[oai_settings.bias_preset_selected]);
    let result = {};

    try {
        const reply = await fetch(`/api/backends/chat-completions/bias?model=${getTokenizerModel()}`, {
            method: 'POST',
            headers: getRequestHeaders(),
            body,
        });

        result = await reply.json();
    }
    catch (err) {
        result = {};
        console.error(err);
    }
    return result;
}

class TokenHandler {
    constructor(countTokenFn) {
        this.countTokenFn = countTokenFn;
        this.counts = {
            'start_chat': 0,
            'prompt': 0,
            'bias': 0,
            'nudge': 0,
            'jailbreak': 0,
            'impersonate': 0,
            'examples': 0,
            'conversation': 0,
        };
    }

    getCounts() {
        return this.counts;
    }

    resetCounts() {
        Object.keys(this.counts).forEach((key) => this.counts[key] = 0);
    }

    setCounts(counts) {
        this.counts = counts;
    }

    uncount(value, type) {
        this.counts[type] -= value;
    }

    count(messages, full, type) {
        const token_count = this.countTokenFn(messages, full);
        this.counts[type] += token_count;

        return token_count;
    }

    getTokensForIdentifier(identifier) {
        return this.counts[identifier] ?? 0;
    }

    getTotal() {
        return Object.values(this.counts).reduce((a, b) => a + (isNaN(b) ? 0 : b), 0);
    }

    log() {
        console.table({ ...this.counts, 'total': this.getTotal() });
    }
}


const tokenHandler = new TokenHandler(countTokensOpenAI);

// Thrown by ChatCompletion when a requested prompt couldn't be found.
class IdentifierNotFoundError extends Error {
    constructor(identifier) {
        super(`Identifier ${identifier} not found.`);
        this.name = 'IdentifierNotFoundError';
    }
}

// Thrown by ChatCompletion when the token budget is unexpectedly exceeded
class TokenBudgetExceededError extends Error {
    constructor(identifier = '') {
        super(`Token budged exceeded. Message: ${identifier}`);
        this.name = 'TokenBudgetExceeded';
    }
}

// Thrown when a character name is invalid
class InvalidCharacterNameError extends Error {
    constructor(identifier = '') {
        super(`Invalid character name. Message: ${identifier}`);
        this.name = 'InvalidCharacterName';
    }
}

/**
 * Used for creating, managing, and interacting with a specific message object.
 */
class Message {
    static tokensPerImage = 85;

    /** @type {number} */
    tokens;
    /** @type {string} */
    identifier;
    /** @type {string} */
    role;
    /** @type {string|any[]} */
    content;
    /** @type {string} */
    name;

    /**
     * @constructor
     * @param {string} role - The role of the entity creating the message.
     * @param {string} content - The actual content of the message.
     * @param {string} identifier - A unique identifier for the message.
     */
    constructor(role, content, identifier) {
        this.identifier = identifier;
        this.role = role;
        this.content = content;

        if (!this.role) {
            console.log(`Message role not set, defaulting to 'system' for identifier '${this.identifier}'`);
            this.role = 'system';
        }

        if (typeof this.content === 'string' && this.content.length > 0) {
            this.tokens = tokenHandler.count({ role: this.role, content: this.content });
        } else {
            this.tokens = 0;
        }
    }

    setName(name) {
        this.name = name;
        this.tokens = tokenHandler.count({ role: this.role, content: this.content, name: this.name });
    }

    async addImage(image) {
        const textContent = this.content;
        const isDataUrl = isDataURL(image);
        if (!isDataUrl) {
            try {
                const response = await fetch(image, { method: 'GET', cache: 'force-cache' });
                if (!response.ok) throw new Error('Failed to fetch image');
                const blob = await response.blob();
                image = await getBase64Async(blob);
            } catch (error) {
                console.error('Image adding skipped', error);
                return;
            }
        }

        image = await this.compressImage(image);

        const quality = oai_settings.inline_image_quality || default_settings.inline_image_quality;
        this.content = [
            { type: 'text', text: textContent },
            { type: 'image_url', image_url: { 'url': image, 'detail': quality } },
        ];

        try {
            const tokens = await this.getImageTokenCost(image, quality);
            this.tokens += tokens;
        } catch (error) {
            this.tokens += Message.tokensPerImage;
            console.error('Failed to get image token cost', error);
        }
    }

    /**
     * Compress an image if it exceeds the size threshold for the current chat completion source.
     * @param {string} image Data URL of the image.
     * @returns {Promise<string>} Compressed image as a Data URL.
     */
    async compressImage(image) {
        if ([chat_completion_sources.OPENROUTER, chat_completion_sources.MAKERSUITE, chat_completion_sources.MISTRALAI].includes(oai_settings.chat_completion_source)) {
            const sizeThreshold = 2 * 1024 * 1024;
            const dataSize = image.length * 0.75;
            const maxSide = 1024;
            if (dataSize > sizeThreshold) {
                image = await createThumbnail(image, maxSide);
            }
        }
        return image;
    }

    /**
     * Get the token cost of an image.
     * @param {string} dataUrl Data URL of the image.
     * @param {string} quality String representing the quality of the image. Can be 'low', 'auto', or 'high'.
     * @returns {Promise<number>} The token cost of the image.
     */
    async getImageTokenCost(dataUrl, quality) {
        if (quality === 'low') {
            return Message.tokensPerImage;
        }

        const size = await getImageSizeFromDataURL(dataUrl);

        // If the image is small enough, we can use the low quality token cost
        if (quality === 'auto' && size.width <= 512 && size.height <= 512) {
            return Message.tokensPerImage;
        }

        /*
        * Images are first scaled to fit within a 2048 x 2048 square, maintaining their aspect ratio.
        * Then, they are scaled such that the shortest side of the image is 768px long.
        * Finally, we count how many 512px squares the image consists of.
        * Each of those squares costs 170 tokens. Another 85 tokens are always added to the final total.
        * https://platform.openai.com/docs/guides/vision/calculating-costs
        */

        const scale = 2048 / Math.min(size.width, size.height);
        const scaledWidth = Math.round(size.width * scale);
        const scaledHeight = Math.round(size.height * scale);

        const finalScale = 768 / Math.min(scaledWidth, scaledHeight);
        const finalWidth = Math.round(scaledWidth * finalScale);
        const finalHeight = Math.round(scaledHeight * finalScale);

        const squares = Math.ceil(finalWidth / 512) * Math.ceil(finalHeight / 512);
        const tokens = squares * 170 + 85;
        return tokens;
    }

    /**
     * Create a new Message instance from a prompt.
     * @static
     * @param {Object} prompt - The prompt object.
     * @returns {Message} A new instance of Message.
     */
    static fromPrompt(prompt) {
        return new Message(prompt.role, prompt.content, prompt.identifier);
    }

    /**
     * Returns the number of tokens in the message.
     * @returns {number} Number of tokens in the message.
     */
    getTokens() { return this.tokens; }
}

/**
 * Used for creating, managing, and interacting with a collection of Message instances.
 *
 * @class MessageCollection
 */
class MessageCollection {
    collection = [];
    identifier;

    /**
     * @constructor
     * @param {string} identifier - A unique identifier for the MessageCollection.
     * @param {...Object} items - An array of Message or MessageCollection instances to be added to the collection.
     */
    constructor(identifier, ...items) {
        for (let item of items) {
            if (!(item instanceof Message || item instanceof MessageCollection)) {
                throw new Error('Only Message and MessageCollection instances can be added to MessageCollection');
            }
        }

        this.collection.push(...items);
        this.identifier = identifier;
    }

    /**
     * Get chat in the format of {role, name, content}.
     * @returns {Array} Array of objects with role, name, and content properties.
     */
    getChat() {
        return this.collection.reduce((acc, message) => {
            const name = message.name;
            if (message.content) acc.push({ role: message.role, ...(name && { name }), content: message.content });
            return acc;
        }, []);
    }

    /**
     * Method to get the collection of messages.
     * @returns {Array} The collection of Message instances.
     */
    getCollection() {
        return this.collection;
    }

    /**
     * Add a new item to the collection.
     * @param {Object} item - The Message or MessageCollection instance to be added.
     */
    add(item) {
        this.collection.push(item);
    }

    /**
     * Get an item from the collection by its identifier.
     * @param {string} identifier - The identifier of the item to be found.
     * @returns {Object} The found item, or undefined if no item was found.
     */
    getItemByIdentifier(identifier) {
        return this.collection.find(item => item?.identifier === identifier);
    }

    /**
     * Check if an item with the given identifier exists in the collection.
     * @param {string} identifier - The identifier to check.
     * @returns {boolean} True if an item with the given identifier exists, false otherwise.
     */
    hasItemWithIdentifier(identifier) {
        return this.collection.some(message => message.identifier === identifier);
    }

    /**
     * Get the total number of tokens in the collection.
     * @returns {number} The total number of tokens.
     */
    getTokens() {
        return this.collection.reduce((tokens, message) => tokens + message.getTokens(), 0);
    }

    /**
     * Combines message collections into a single collection.
     * @returns {Message[]} The collection of messages flattened into a single array.
     */
    flatten() {
        return this.collection.reduce((acc, message) => {
            if (message instanceof MessageCollection) {
                acc.push(...message.flatten());
            } else {
                acc.push(message);
            }
            return acc;
        }, []);
    }
}

/**
 * OpenAI API chat completion representation
 * const map = [{identifier: 'example', message: {role: 'system', content: 'exampleContent'}}, ...];
 *
 * This class creates a chat context that can be sent to Open AI's api
 * Includes message management and token budgeting.
 *
 * @see https://platform.openai.com/docs/guides/gpt/chat-completions-api
 *
 */
export class ChatCompletion {

    /**
     * Combines consecutive system messages into one if they have no name attached.
     */
    squashSystemMessages() {
        const excludeList = ['newMainChat', 'newChat', 'groupNudge'];
        this.messages.collection = this.messages.flatten();

        let lastMessage = null;
        let squashedMessages = [];

        for (let message of this.messages.collection) {
            // Force exclude empty messages
            if (message.role === 'system' && !message.content) {
                continue;
            }

            const shouldSquash = (message) => {
                return !excludeList.includes(message.identifier) && message.role === 'system' && !message.name;
            };

            if (shouldSquash(message)) {
                if (lastMessage && shouldSquash(lastMessage)) {
                    lastMessage.content += '\n' + message.content;
                    lastMessage.tokens = tokenHandler.count({ role: lastMessage.role, content: lastMessage.content });
                }
                else {
                    squashedMessages.push(message);
                    lastMessage = message;
                }
            }
            else {
                squashedMessages.push(message);
                lastMessage = message;
            }
        }

        this.messages.collection = squashedMessages;
    }

    /**
     * Initializes a new instance of ChatCompletion.
     * Sets up the initial token budget and a new message collection.
     */
    constructor() {
        this.tokenBudget = 0;
        this.messages = new MessageCollection('root');
        this.loggingEnabled = false;
        this.overriddenPrompts = [];
    }

    /**
     * Retrieves all messages.
     *
     * @returns {MessageCollection} The MessageCollection instance holding all messages.
     */
    getMessages() {
        return this.messages;
    }

    /**
     * Calculates and sets the token budget based on context and response.
     *
     * @param {number} context - Number of tokens in the context.
     * @param {number} response - Number of tokens in the response.
     */
    setTokenBudget(context, response) {
        this.log(`Prompt tokens: ${context}`);
        this.log(`Completion tokens: ${response}`);

        this.tokenBudget = context - response;

        this.log(`Token budget: ${this.tokenBudget}`);
    }

    /**
     * Adds a message or message collection to the collection.
     *
     * @param {Message|MessageCollection} collection - The message or message collection to add.
     * @param {number|null} position - The position at which to add the collection.
     * @returns {ChatCompletion} The current instance for chaining.
     */
    add(collection, position = null) {
        this.validateMessageCollection(collection);
        this.checkTokenBudget(collection, collection.identifier);

        if (null !== position && -1 !== position) {
            this.messages.collection[position] = collection;
        } else {
            this.messages.collection.push(collection);
        }

        this.decreaseTokenBudgetBy(collection.getTokens());

        this.log(`Added ${collection.identifier}. Remaining tokens: ${this.tokenBudget}`);

        return this;
    }

    /**
     * Inserts a message at the start of the specified collection.
     *
     * @param {Message} message - The message to insert.
     * @param {string} identifier - The identifier of the collection where to insert the message.
     */
    insertAtStart(message, identifier) {
        this.insert(message, identifier, 'start');
    }

    /**
     * Inserts a message at the end of the specified collection.
     *
     * @param {Message} message - The message to insert.
     * @param {string} identifier - The identifier of the collection where to insert the message.
     */
    insertAtEnd(message, identifier) {
        this.insert(message, identifier, 'end');
    }

    /**
     * Inserts a message at the specified position in the specified collection.
     *
     * @param {Message} message - The message to insert.
     * @param {string} identifier - The identifier of the collection where to insert the message.
     * @param {string|number} position - The position at which to insert the message ('start' or 'end').
     */
    insert(message, identifier, position = 'end') {
        this.validateMessage(message);
        this.checkTokenBudget(message, message.identifier);

        const index = this.findMessageIndex(identifier);
        if (message.content) {
            if ('start' === position) this.messages.collection[index].collection.unshift(message);
            else if ('end' === position) this.messages.collection[index].collection.push(message);
            else if (typeof position === 'number') this.messages.collection[index].collection.splice(position, 0, message);

            this.decreaseTokenBudgetBy(message.getTokens());

            this.log(`Inserted ${message.identifier} into ${identifier}. Remaining tokens: ${this.tokenBudget}`);
        }
    }

    /**
     * Remove the last item of the collection
     *
     * @param identifier
     */
    removeLastFrom(identifier) {
        const index = this.findMessageIndex(identifier);
        const message = this.messages.collection[index].collection.pop();

        if (!message) {
            this.log(`No message to remove from ${identifier}`);
            return;
        }

        this.increaseTokenBudgetBy(message.getTokens());

        this.log(`Removed ${message.identifier} from ${identifier}. Remaining tokens: ${this.tokenBudget}`);
    }

    /**
     * Checks if the token budget can afford the tokens of the specified message.
     *
     * @param {Message} message - The message to check for affordability.
     * @returns {boolean} True if the budget can afford the message, false otherwise.
     */
    canAfford(message) {
        return 0 <= this.tokenBudget - message.getTokens();
    }

    /**
     * Checks if a message with the specified identifier exists in the collection.
     *
     * @param {string} identifier - The identifier to check for existence.
     * @returns {boolean} True if a message with the specified identifier exists, false otherwise.
     */
    has(identifier) {
        return this.messages.hasItemWithIdentifier(identifier);
    }

    /**
     * Retrieves the total number of tokens in the collection.
     *
     * @returns {number} The total number of tokens.
     */
    getTotalTokenCount() {
        return this.messages.getTokens();
    }

    /**
     * Retrieves the chat as a flattened array of messages.
     *
     * @returns {Array} The chat messages.
     */
    getChat() {
        const chat = [];
        for (let item of this.messages.collection) {
            if (item instanceof MessageCollection) {
                chat.push(...item.getChat());
            } else if (item instanceof Message && item.content) {
                const message = { role: item.role, content: item.content, ...(item.name ? { name: item.name } : {}) };
                chat.push(message);
            } else {
                this.log(`Skipping invalid or empty message in collection: ${JSON.stringify(item)}`);
            }
        }
        return chat;
    }

    /**
     * Logs an output message to the console if logging is enabled.
     *
     * @param {string} output - The output message to log.
     */
    log(output) {
        if (this.loggingEnabled) console.log('[ChatCompletion] ' + output);
    }

    /**
     * Enables logging of output messages to the console.
     */
    enableLogging() {
        this.loggingEnabled = true;
    }

    /**
     * Disables logging of output messages to the console.
     */
    disableLogging() {
        this.loggingEnabled = false;
    }

    /**
     * Validates if the given argument is an instance of MessageCollection.
     * Throws an error if the validation fails.
     *
     * @param {MessageCollection} collection - The collection to validate.
     */
    validateMessageCollection(collection) {
        if (!(collection instanceof MessageCollection)) {
            console.log(collection);
            throw new Error('Argument must be an instance of MessageCollection');
        }
    }

    /**
     * Validates if the given argument is an instance of Message.
     * Throws an error if the validation fails.
     *
     * @param {Message} message - The message to validate.
     */
    validateMessage(message) {
        if (!(message instanceof Message)) {
            console.log(message);
            throw new Error('Argument must be an instance of Message');
        }
    }

    /**
     * Checks if the token budget can afford the tokens of the given message.
     * Throws an error if the budget can't afford the message.
     *
     * @param {Message} message - The message to check.
     * @param {string} identifier - The identifier of the message.
     */
    checkTokenBudget(message, identifier) {
        if (!this.canAfford(message)) {
            throw new TokenBudgetExceededError(identifier);
        }
    }

    /**
     * Reserves the tokens required by the given message from the token budget.
     *
     * @param {Message|MessageCollection|number} message - The message whose tokens to reserve.
     */
    reserveBudget(message) {
        const tokens = typeof message === 'number' ? message : message.getTokens();
        this.decreaseTokenBudgetBy(tokens);
    }

    /**
     * Frees up the tokens used by the given message from the token budget.
     *
     * @param {Message|MessageCollection} message - The message whose tokens to free.
     */
    freeBudget(message) { this.increaseTokenBudgetBy(message.getTokens()); }

    /**
     * Increases the token budget by the given number of tokens.
     * This function should be used sparingly, per design the completion should be able to work with its initial budget.
     *
     * @param {number} tokens - The number of tokens to increase the budget by.
     */
    increaseTokenBudgetBy(tokens) {
        this.tokenBudget += tokens;
    }

    /**
     * Decreases the token budget by the given number of tokens.
     * This function should be used sparingly, per design the completion should be able to work with its initial budget.
     *
     * @param {number} tokens - The number of tokens to decrease the budget by.
     */
    decreaseTokenBudgetBy(tokens) {
        this.tokenBudget -= tokens;
    }

    /**
     * Finds the index of a message in the collection by its identifier.
     * Throws an error if a message with the given identifier is not found.
     *
     * @param {string} identifier - The identifier of the message to find.
     * @returns {number} The index of the message in the collection.
     */
    findMessageIndex(identifier) {
        const index = this.messages.collection.findIndex(item => item?.identifier === identifier);
        if (index < 0) {
            throw new IdentifierNotFoundError(identifier);
        }
        return index;
    }

    /**
     * Sets the list of overridden prompts.
     * @param {string[]} list A list of prompts that were overridden.
     */
    setOverriddenPrompts(list) {
        this.overriddenPrompts = list;
    }

    getOverriddenPrompts() {
        return this.overriddenPrompts ?? [];
    }
}

function loadOpenAISettings(data, settings) {
    openai_setting_names = data.openai_setting_names;
    openai_settings = data.openai_settings;
    openai_settings.forEach(function (item, i, arr) {
        openai_settings[i] = JSON.parse(item);
    });

    $('#settings_preset_openai').empty();
    let arr_holder = {};
    openai_setting_names.forEach(function (item, i, arr) {
        arr_holder[item] = i;
        $('#settings_preset_openai').append(`<option value=${i}>${item}</option>`);

    });
    openai_setting_names = arr_holder;

    oai_settings.preset_settings_openai = settings.preset_settings_openai;
    $(`#settings_preset_openai option[value=${openai_setting_names[oai_settings.preset_settings_openai]}]`).attr('selected', true);

    oai_settings.temp_openai = settings.temp_openai ?? default_settings.temp_openai;
    oai_settings.freq_pen_openai = settings.freq_pen_openai ?? default_settings.freq_pen_openai;
    oai_settings.pres_pen_openai = settings.pres_pen_openai ?? default_settings.pres_pen_openai;
    oai_settings.top_p_openai = settings.top_p_openai ?? default_settings.top_p_openai;
    oai_settings.top_k_openai = settings.top_k_openai ?? default_settings.top_k_openai;
    oai_settings.top_a_openai = settings.top_a_openai ?? default_settings.top_a_openai;
    oai_settings.min_p_openai = settings.min_p_openai ?? default_settings.min_p_openai;
    oai_settings.repetition_penalty_openai = settings.repetition_penalty_openai ?? default_settings.repetition_penalty_openai;
    oai_settings.stream_openai = settings.stream_openai ?? default_settings.stream_openai;
    oai_settings.websearch_cohere = settings.websearch_cohere ?? default_settings.websearch_cohere;
    oai_settings.openai_max_context = settings.openai_max_context ?? default_settings.openai_max_context;
    oai_settings.openai_max_tokens = settings.openai_max_tokens ?? default_settings.openai_max_tokens;
    oai_settings.bias_preset_selected = settings.bias_preset_selected ?? default_settings.bias_preset_selected;
    oai_settings.bias_presets = settings.bias_presets ?? default_settings.bias_presets;
    oai_settings.max_context_unlocked = settings.max_context_unlocked ?? default_settings.max_context_unlocked;
    oai_settings.send_if_empty = settings.send_if_empty ?? default_settings.send_if_empty;
    oai_settings.wi_format = settings.wi_format ?? default_settings.wi_format;
    oai_settings.scenario_format = settings.scenario_format ?? default_settings.scenario_format;
    oai_settings.personality_format = settings.personality_format ?? default_settings.personality_format;
    oai_settings.group_nudge_prompt = settings.group_nudge_prompt ?? default_settings.group_nudge_prompt;
    oai_settings.claude_model = settings.claude_model ?? default_settings.claude_model;
    oai_settings.windowai_model = settings.windowai_model ?? default_settings.windowai_model;
    oai_settings.openrouter_model = settings.openrouter_model ?? default_settings.openrouter_model;
    oai_settings.openrouter_group_models = settings.openrouter_group_models ?? default_settings.openrouter_group_models;
    oai_settings.openrouter_sort_models = settings.openrouter_sort_models ?? default_settings.openrouter_sort_models;
    oai_settings.openrouter_use_fallback = settings.openrouter_use_fallback ?? default_settings.openrouter_use_fallback;
    oai_settings.openrouter_force_instruct = settings.openrouter_force_instruct ?? default_settings.openrouter_force_instruct;
    oai_settings.openrouter_allow_fallbacks = settings.openrouter_allow_fallbacks ?? default_settings.openrouter_allow_fallbacks;
    oai_settings.ai21_model = settings.ai21_model ?? default_settings.ai21_model;
    oai_settings.mistralai_model = settings.mistralai_model ?? default_settings.mistralai_model;
    oai_settings.cohere_model = settings.cohere_model ?? default_settings.cohere_model;
    oai_settings.perplexity_model = settings.perplexity_model ?? default_settings.perplexity_model;
    oai_settings.groq_model = settings.groq_model ?? default_settings.groq_model;
    oai_settings.blockentropy_model = settings.blockentropy_model ?? default_settings.blockentropy_model;
    oai_settings.zerooneai_model = settings.zerooneai_model ?? default_settings.zerooneai_model;
    oai_settings.custom_model = settings.custom_model ?? default_settings.custom_model;
    oai_settings.custom_url = settings.custom_url ?? default_settings.custom_url;
    oai_settings.custom_include_body = settings.custom_include_body ?? default_settings.custom_include_body;
    oai_settings.custom_exclude_body = settings.custom_exclude_body ?? default_settings.custom_exclude_body;
    oai_settings.custom_include_headers = settings.custom_include_headers ?? default_settings.custom_include_headers;
    oai_settings.custom_prompt_post_processing = settings.custom_prompt_post_processing ?? default_settings.custom_prompt_post_processing;
    oai_settings.google_model = settings.google_model ?? default_settings.google_model;
    oai_settings.chat_completion_source = settings.chat_completion_source ?? default_settings.chat_completion_source;
    oai_settings.api_url_scale = settings.api_url_scale ?? default_settings.api_url_scale;
    oai_settings.show_external_models = settings.show_external_models ?? default_settings.show_external_models;
    oai_settings.proxy_password = settings.proxy_password ?? default_settings.proxy_password;
    oai_settings.assistant_prefill = settings.assistant_prefill ?? default_settings.assistant_prefill;
    oai_settings.assistant_impersonation = settings.assistant_impersonation ?? default_settings.assistant_impersonation;
    oai_settings.human_sysprompt_message = settings.human_sysprompt_message ?? default_settings.human_sysprompt_message;
    oai_settings.image_inlining = settings.image_inlining ?? default_settings.image_inlining;
    oai_settings.inline_image_quality = settings.inline_image_quality ?? default_settings.inline_image_quality;
    oai_settings.bypass_status_check = settings.bypass_status_check ?? default_settings.bypass_status_check;
    oai_settings.seed = settings.seed ?? default_settings.seed;
    oai_settings.n = settings.n ?? default_settings.n;

    oai_settings.prompts = settings.prompts ?? default_settings.prompts;
    oai_settings.prompt_order = settings.prompt_order ?? default_settings.prompt_order;

    oai_settings.new_chat_prompt = settings.new_chat_prompt ?? default_settings.new_chat_prompt;
    oai_settings.new_group_chat_prompt = settings.new_group_chat_prompt ?? default_settings.new_group_chat_prompt;
    oai_settings.new_example_chat_prompt = settings.new_example_chat_prompt ?? default_settings.new_example_chat_prompt;
    oai_settings.continue_nudge_prompt = settings.continue_nudge_prompt ?? default_settings.continue_nudge_prompt;
    oai_settings.squash_system_messages = settings.squash_system_messages ?? default_settings.squash_system_messages;
    oai_settings.continue_prefill = settings.continue_prefill ?? default_settings.continue_prefill;
    oai_settings.names_behavior = settings.names_behavior ?? default_settings.names_behavior;
    oai_settings.continue_postfix = settings.continue_postfix ?? default_settings.continue_postfix;
    oai_settings.function_calling = settings.function_calling ?? default_settings.function_calling;
    oai_settings.openrouter_providers = settings.openrouter_providers ?? default_settings.openrouter_providers;

    // Migrate from old settings
    if (settings.names_in_completion === true) {
        oai_settings.names_behavior = character_names_behavior.COMPLETION;
    }

    if (oai_settings.ai21_model.startsWith('j2-')) {
        oai_settings.ai21_model = 'jamba-1.5-large';
    }

    if (settings.wrap_in_quotes !== undefined) oai_settings.wrap_in_quotes = !!settings.wrap_in_quotes;
    if (settings.openai_model !== undefined) oai_settings.openai_model = settings.openai_model;
    if (settings.claude_use_sysprompt !== undefined) oai_settings.claude_use_sysprompt = !!settings.claude_use_sysprompt;
    if (settings.use_makersuite_sysprompt !== undefined) oai_settings.use_makersuite_sysprompt = !!settings.use_makersuite_sysprompt;
    if (settings.use_alt_scale !== undefined) { oai_settings.use_alt_scale = !!settings.use_alt_scale; updateScaleForm(); }
    $('#stream_toggle').prop('checked', oai_settings.stream_openai);
    $('#websearch_toggle').prop('checked', oai_settings.websearch_cohere);
    $('#api_url_scale').val(oai_settings.api_url_scale);
    $('#openai_proxy_password').val(oai_settings.proxy_password);
    $('#claude_assistant_prefill').val(oai_settings.assistant_prefill);
    $('#claude_assistant_impersonation').val(oai_settings.assistant_impersonation);
    $('#claude_human_sysprompt_textarea').val(oai_settings.human_sysprompt_message);
    $('#openai_image_inlining').prop('checked', oai_settings.image_inlining);
    $('#openai_bypass_status_check').prop('checked', oai_settings.bypass_status_check);

    $('#openai_inline_image_quality').val(oai_settings.inline_image_quality);
    $(`#openai_inline_image_quality option[value="${oai_settings.inline_image_quality}"]`).prop('selected', true);

    $('#model_openai_select').val(oai_settings.openai_model);
    $(`#model_openai_select option[value="${oai_settings.openai_model}"`).attr('selected', true);
    $('#model_claude_select').val(oai_settings.claude_model);
    $(`#model_claude_select option[value="${oai_settings.claude_model}"`).attr('selected', true);
    $('#model_windowai_select').val(oai_settings.windowai_model);
    $(`#model_windowai_select option[value="${oai_settings.windowai_model}"`).attr('selected', true);
    $('#model_google_select').val(oai_settings.google_model);
    $(`#model_google_select option[value="${oai_settings.google_model}"`).attr('selected', true);
    $('#model_ai21_select').val(oai_settings.ai21_model);
    $(`#model_ai21_select option[value="${oai_settings.ai21_model}"`).attr('selected', true);
    $('#model_mistralai_select').val(oai_settings.mistralai_model);
    $(`#model_mistralai_select option[value="${oai_settings.mistralai_model}"`).attr('selected', true);
    $('#model_cohere_select').val(oai_settings.cohere_model);
    $(`#model_cohere_select option[value="${oai_settings.cohere_model}"`).attr('selected', true);
    $('#model_perplexity_select').val(oai_settings.perplexity_model);
    $(`#model_perplexity_select option[value="${oai_settings.perplexity_model}"`).attr('selected', true);
    $('#model_groq_select').val(oai_settings.groq_model);
    $(`#model_groq_select option[value="${oai_settings.groq_model}"`).attr('selected', true);
    $('#model_01ai_select').val(oai_settings.zerooneai_model);
    $('#model_blockentropy_select').val(oai_settings.blockentropy_model);
    $('#custom_model_id').val(oai_settings.custom_model);
    $('#custom_api_url_text').val(oai_settings.custom_url);
    $('#openai_max_context').val(oai_settings.openai_max_context);
    $('#openai_max_context_counter').val(`${oai_settings.openai_max_context}`);
    $('#model_openrouter_select').val(oai_settings.openrouter_model);
    $('#openrouter_sort_models').val(oai_settings.openrouter_sort_models);

    $('#openai_max_tokens').val(oai_settings.openai_max_tokens);

    $('#wrap_in_quotes').prop('checked', oai_settings.wrap_in_quotes);
    $('#jailbreak_system').prop('checked', oai_settings.jailbreak_system);
    $('#openai_show_external_models').prop('checked', oai_settings.show_external_models);
    $('#openai_external_category').toggle(oai_settings.show_external_models);
    $('#claude_use_sysprompt').prop('checked', oai_settings.claude_use_sysprompt);
    $('#use_makersuite_sysprompt').prop('checked', oai_settings.use_makersuite_sysprompt);
    $('#scale-alt').prop('checked', oai_settings.use_alt_scale);
    $('#openrouter_use_fallback').prop('checked', oai_settings.openrouter_use_fallback);
    $('#openrouter_force_instruct').prop('checked', oai_settings.openrouter_force_instruct);
    $('#openrouter_group_models').prop('checked', oai_settings.openrouter_group_models);
    $('#openrouter_allow_fallbacks').prop('checked', oai_settings.openrouter_allow_fallbacks);
    $('#openrouter_providers_chat').val(oai_settings.openrouter_providers).trigger('change');
    $('#squash_system_messages').prop('checked', oai_settings.squash_system_messages);
    $('#continue_prefill').prop('checked', oai_settings.continue_prefill);
    $('#openai_function_calling').prop('checked', oai_settings.function_calling);
    if (settings.impersonation_prompt !== undefined) oai_settings.impersonation_prompt = settings.impersonation_prompt;

    $('#impersonation_prompt_textarea').val(oai_settings.impersonation_prompt);

    $('#newchat_prompt_textarea').val(oai_settings.new_chat_prompt);
    $('#newgroupchat_prompt_textarea').val(oai_settings.new_group_chat_prompt);
    $('#newexamplechat_prompt_textarea').val(oai_settings.new_example_chat_prompt);
    $('#continue_nudge_prompt_textarea').val(oai_settings.continue_nudge_prompt);

    $('#wi_format_textarea').val(oai_settings.wi_format);
    $('#scenario_format_textarea').val(oai_settings.scenario_format);
    $('#personality_format_textarea').val(oai_settings.personality_format);
    $('#group_nudge_prompt_textarea').val(oai_settings.group_nudge_prompt);
    $('#send_if_empty_textarea').val(oai_settings.send_if_empty);

    $('#temp_openai').val(oai_settings.temp_openai);
    $('#temp_counter_openai').val(Number(oai_settings.temp_openai).toFixed(2));

    $('#freq_pen_openai').val(oai_settings.freq_pen_openai);
    $('#freq_pen_counter_openai').val(Number(oai_settings.freq_pen_openai).toFixed(2));

    $('#pres_pen_openai').val(oai_settings.pres_pen_openai);
    $('#pres_pen_counter_openai').val(Number(oai_settings.pres_pen_openai).toFixed(2));

    $('#top_p_openai').val(oai_settings.top_p_openai);
    $('#top_p_counter_openai').val(Number(oai_settings.top_p_openai).toFixed(2));

    $('#top_k_openai').val(oai_settings.top_k_openai);
    $('#top_k_counter_openai').val(Number(oai_settings.top_k_openai).toFixed(0));
    $('#top_a_openai').val(oai_settings.top_a_openai);
    $('#top_a_counter_openai').val(Number(oai_settings.top_a_openai));
    $('#min_p_openai').val(oai_settings.min_p_openai);
    $('#min_p_counter_openai').val(Number(oai_settings.min_p_openai));
    $('#repetition_penalty_openai').val(oai_settings.repetition_penalty_openai);
    $('#repetition_penalty_counter_openai').val(Number(oai_settings.repetition_penalty_openai));
    $('#seed_openai').val(oai_settings.seed);
    $('#n_openai').val(oai_settings.n);

    if (settings.reverse_proxy !== undefined) oai_settings.reverse_proxy = settings.reverse_proxy;
    $('#openai_reverse_proxy').val(oai_settings.reverse_proxy);

    $('.reverse_proxy_warning').toggle(oai_settings.reverse_proxy !== '');

    $('#openai_logit_bias_preset').empty();
    for (const preset of Object.keys(oai_settings.bias_presets)) {
        const option = document.createElement('option');
        option.innerText = preset;
        option.value = preset;
        option.selected = preset === oai_settings.bias_preset_selected;
        $('#openai_logit_bias_preset').append(option);
    }
    $('#openai_logit_bias_preset').trigger('change');

    // Upgrade Palm to Makersuite
    if (oai_settings.chat_completion_source === 'palm') {
        oai_settings.chat_completion_source = chat_completion_sources.MAKERSUITE;
    }

    setNamesBehaviorControls();
    setContinuePostfixControls();

    $('#chat_completion_source').val(oai_settings.chat_completion_source).trigger('change');
    $('#oai_max_context_unlocked').prop('checked', oai_settings.max_context_unlocked);
    $('#custom_prompt_post_processing').val(oai_settings.custom_prompt_post_processing);
    $(`#custom_prompt_post_processing option[value="${oai_settings.custom_prompt_post_processing}"]`).attr('selected', true);
}

function setNamesBehaviorControls() {
    switch (oai_settings.names_behavior) {
        case character_names_behavior.NONE:
            $('#character_names_none').prop('checked', true);
            break;
        case character_names_behavior.DEFAULT:
            $('#character_names_default').prop('checked', true);
            break;
        case character_names_behavior.COMPLETION:
            $('#character_names_completion').prop('checked', true);
            break;
        case character_names_behavior.CONTENT:
            $('#character_names_content').prop('checked', true);
            break;
    }

    const checkedItemText = $('input[name="character_names"]:checked ~ span').text().trim();
    $('#character_names_display').text(checkedItemText);
}

function setContinuePostfixControls() {
    switch (oai_settings.continue_postfix) {
        case continue_postfix_types.NONE:
            $('#continue_postfix_none').prop('checked', true);
            break;
        case continue_postfix_types.SPACE:
            $('#continue_postfix_space').prop('checked', true);
            break;
        case continue_postfix_types.NEWLINE:
            $('#continue_postfix_newline').prop('checked', true);
            break;
        case continue_postfix_types.DOUBLE_NEWLINE:
            $('#continue_postfix_double_newline').prop('checked', true);
            break;
        default:
            // Prevent preset value abuse
            oai_settings.continue_postfix = continue_postfix_types.SPACE;
            $('#continue_postfix_space').prop('checked', true);
            break;
    }

    $('#continue_postfix').val(oai_settings.continue_postfix);
    const checkedItemText = $('input[name="continue_postfix"]:checked ~ span').text().trim();
    $('#continue_postfix_display').text(checkedItemText);
}

async function getStatusOpen() {
    if (oai_settings.chat_completion_source == chat_completion_sources.WINDOWAI) {
        let status;

        if ('ai' in window) {
            status = 'Valid';
        }
        else {
            showWindowExtensionError();
            status = 'no_connection';
        }

        setOnlineStatus(status);
        return resultCheckStatus();
    }

    const noValidateSources = [
        chat_completion_sources.SCALE,
        chat_completion_sources.CLAUDE,
        chat_completion_sources.AI21,
        chat_completion_sources.MAKERSUITE,
        chat_completion_sources.PERPLEXITY,
        chat_completion_sources.GROQ,
    ];
    if (noValidateSources.includes(oai_settings.chat_completion_source)) {
        let status = 'Unable to verify key; press "Test Message" to validate.';
        setOnlineStatus(status);
        return resultCheckStatus();
    }

    let data = {
        reverse_proxy: oai_settings.reverse_proxy,
        proxy_password: oai_settings.proxy_password,
        chat_completion_source: oai_settings.chat_completion_source,
    };

    if (oai_settings.reverse_proxy && (oai_settings.chat_completion_source === chat_completion_sources.OPENAI || oai_settings.chat_completion_source === chat_completion_sources.CLAUDE)) {
        await validateReverseProxy();
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.CUSTOM) {
        $('.model_custom_select').empty();
        data.custom_url = oai_settings.custom_url;
        data.custom_include_headers = oai_settings.custom_include_headers;
    }

    const canBypass = (oai_settings.chat_completion_source === chat_completion_sources.OPENAI && oai_settings.bypass_status_check) || oai_settings.chat_completion_source === chat_completion_sources.CUSTOM;
    if (canBypass) {
        setOnlineStatus('Status check bypassed');
    }

    try {
        const response = await fetch('/api/backends/chat-completions/status', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(data),
            signal: abortStatusCheck.signal,
            cache: 'no-cache',
        });

        if (!response.ok) {
            throw new Error(response.statusText);
        }

        const responseData = await response.json();

        if ('data' in responseData && Array.isArray(responseData.data)) {
            saveModelList(responseData.data);
        }
        if (!('error' in responseData)) {
            setOnlineStatus('Valid');
        }
    } catch (error) {
        console.error(error);

        if (!canBypass) {
            setOnlineStatus('no_connection');
        }
    }

    return resultCheckStatus();
}

function showWindowExtensionError() {
    toastr.error('Get it here: <a href="https://windowai.io/" target="_blank">windowai.io</a>', 'Extension is not installed', {
        escapeHtml: false,
        timeOut: 0,
        extendedTimeOut: 0,
        preventDuplicates: true,
    });
}

/**
 * Persist a settings preset with the given name
 *
 * @param name - Name of the preset
 * @param settings The OpenAi settings object
 * @param triggerUi Whether the change event of preset UI element should be emitted
 * @returns {Promise<void>}
 */
async function saveOpenAIPreset(name, settings, triggerUi = true) {
    const presetBody = {
        chat_completion_source: settings.chat_completion_source,
        openai_model: settings.openai_model,
        claude_model: settings.claude_model,
        windowai_model: settings.windowai_model,
        openrouter_model: settings.openrouter_model,
        openrouter_use_fallback: settings.openrouter_use_fallback,
        openrouter_force_instruct: settings.openrouter_force_instruct,
        openrouter_group_models: settings.openrouter_group_models,
        openrouter_sort_models: settings.openrouter_sort_models,
        openrouter_providers: settings.openrouter_providers,
        openrouter_allow_fallbacks: settings.openrouter_allow_fallbacks,
        ai21_model: settings.ai21_model,
        mistralai_model: settings.mistralai_model,
        cohere_model: settings.cohere_model,
        perplexity_model: settings.perplexity_model,
        groq_model: settings.groq_model,
        zerooneai_model: settings.zerooneai_model,
        blockentropy_model: settings.blockentropy_model,
        custom_model: settings.custom_model,
        custom_url: settings.custom_url,
        custom_include_body: settings.custom_include_body,
        custom_exclude_body: settings.custom_exclude_body,
        custom_include_headers: settings.custom_include_headers,
        custom_prompt_post_processing: settings.custom_prompt_post_processing,
        google_model: settings.google_model,
        temperature: settings.temp_openai,
        frequency_penalty: settings.freq_pen_openai,
        presence_penalty: settings.pres_pen_openai,
        top_p: settings.top_p_openai,
        top_k: settings.top_k_openai,
        top_a: settings.top_a_openai,
        min_p: settings.min_p_openai,
        repetition_penalty: settings.repetition_penalty_openai,
        openai_max_context: settings.openai_max_context,
        openai_max_tokens: settings.openai_max_tokens,
        wrap_in_quotes: settings.wrap_in_quotes,
        names_behavior: settings.names_behavior,
        send_if_empty: settings.send_if_empty,
        jailbreak_prompt: settings.jailbreak_prompt,
        jailbreak_system: settings.jailbreak_system,
        impersonation_prompt: settings.impersonation_prompt,
        new_chat_prompt: settings.new_chat_prompt,
        new_group_chat_prompt: settings.new_group_chat_prompt,
        new_example_chat_prompt: settings.new_example_chat_prompt,
        continue_nudge_prompt: settings.continue_nudge_prompt,
        bias_preset_selected: settings.bias_preset_selected,
        reverse_proxy: settings.reverse_proxy,
        proxy_password: settings.proxy_password,
        max_context_unlocked: settings.max_context_unlocked,
        wi_format: settings.wi_format,
        scenario_format: settings.scenario_format,
        personality_format: settings.personality_format,
        group_nudge_prompt: settings.group_nudge_prompt,
        stream_openai: settings.stream_openai,
        websearch_cohere: settings.websearch_cohere,
        prompts: settings.prompts,
        prompt_order: settings.prompt_order,
        api_url_scale: settings.api_url_scale,
        show_external_models: settings.show_external_models,
        assistant_prefill: settings.assistant_prefill,
        assistant_impersonation: settings.assistant_impersonation,
        human_sysprompt_message: settings.human_sysprompt_message,
        claude_use_sysprompt: settings.claude_use_sysprompt,
        use_makersuite_sysprompt: settings.use_makersuite_sysprompt,
        use_alt_scale: settings.use_alt_scale,
        squash_system_messages: settings.squash_system_messages,
        image_inlining: settings.image_inlining,
        inline_image_quality: settings.inline_image_quality,
        bypass_status_check: settings.bypass_status_check,
        continue_prefill: settings.continue_prefill,
        continue_postfix: settings.continue_postfix,
        function_calling: settings.function_calling,
        seed: settings.seed,
        n: settings.n,
    };

    const savePresetSettings = await fetch(`/api/presets/save-openai?name=${name}`, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(presetBody),
    });

    if (savePresetSettings.ok) {
        const data = await savePresetSettings.json();

        if (Object.keys(openai_setting_names).includes(data.name)) {
            oai_settings.preset_settings_openai = data.name;
            const value = openai_setting_names[data.name];
            Object.assign(openai_settings[value], presetBody);
            $(`#settings_preset_openai option[value="${value}"]`).attr('selected', true);
            if (triggerUi) $('#settings_preset_openai').trigger('change');
        }
        else {
            openai_settings.push(presetBody);
            openai_setting_names[data.name] = openai_settings.length - 1;
            const option = document.createElement('option');
            option.selected = true;
            option.value = openai_settings.length - 1;
            option.innerText = data.name;
            if (triggerUi) $('#settings_preset_openai').append(option).trigger('change');
        }
    } else {
        toastr.error('Failed to save preset');
        throw new Error('Failed to save preset');
    }
}

function onLogitBiasPresetChange() {
    const value = String($('#openai_logit_bias_preset').find(':selected').val());
    const preset = oai_settings.bias_presets[value];

    if (!Array.isArray(preset)) {
        console.error('Preset not found');
        return;
    }

    oai_settings.bias_preset_selected = value;
    $('.openai_logit_bias_list').empty();

    for (const entry of preset) {
        if (entry) {
            createLogitBiasListItem(entry);
        }
    }

    biasCache = undefined;
    saveSettingsDebounced();
}

function createNewLogitBiasEntry() {
    const entry = { text: '', value: 0 };
    oai_settings.bias_presets[oai_settings.bias_preset_selected].push(entry);
    biasCache = undefined;
    createLogitBiasListItem(entry);
    saveSettingsDebounced();
}

function createLogitBiasListItem(entry) {
    const id = oai_settings.bias_presets[oai_settings.bias_preset_selected].indexOf(entry);
    const template = $('#openai_logit_bias_template .openai_logit_bias_form').clone();
    template.data('id', id);
    template.find('.openai_logit_bias_text').val(entry.text).on('input', function () {
        oai_settings.bias_presets[oai_settings.bias_preset_selected][id].text = String($(this).val());
        biasCache = undefined;
        saveSettingsDebounced();
    });
    template.find('.openai_logit_bias_value').val(entry.value).on('input', function () {
        const min = Number($(this).attr('min'));
        const max = Number($(this).attr('max'));
        let value = Number($(this).val());

        if (value < min) {
            $(this).val(min);
            value = min;
        }

        if (value > max) {
            $(this).val(max);
            value = max;
        }

        oai_settings.bias_presets[oai_settings.bias_preset_selected][id].value = value;
        biasCache = undefined;
        saveSettingsDebounced();
    });
    template.find('.openai_logit_bias_remove').on('click', function () {
        $(this).closest('.openai_logit_bias_form').remove();
        oai_settings.bias_presets[oai_settings.bias_preset_selected].splice(id, 1);
        onLogitBiasPresetChange();
    });
    $('.openai_logit_bias_list').prepend(template);
}

async function createNewLogitBiasPreset() {
    const name = await callPopup('Preset name:', 'input');

    if (!name) {
        return;
    }

    if (name in oai_settings.bias_presets) {
        toastr.error('Preset name should be unique.');
        return;
    }

    oai_settings.bias_preset_selected = name;
    oai_settings.bias_presets[name] = [];

    addLogitBiasPresetOption(name);
    saveSettingsDebounced();
}

function addLogitBiasPresetOption(name) {
    const option = document.createElement('option');
    option.innerText = name;
    option.value = name;
    option.selected = true;

    $('#openai_logit_bias_preset').append(option);
    $('#openai_logit_bias_preset').trigger('change');
}

function onImportPresetClick() {
    $('#openai_preset_import_file').trigger('click');
}

function onLogitBiasPresetImportClick() {
    $('#openai_logit_bias_import_file').trigger('click');
}

async function onPresetImportFileChange(e) {
    const file = e.target.files[0];

    if (!file) {
        return;
    }

    const name = file.name.replace(/\.[^/.]+$/, '');
    const importedFile = await getFileText(file);
    let presetBody;
    e.target.value = '';

    try {
        presetBody = JSON.parse(importedFile);
    } catch (err) {
        toastr.error('Invalid file');
        return;
    }

    const fields = sensitiveFields.filter(field => presetBody[field]).map(field => `<b>${field}</b>`);
    const shouldConfirm = fields.length > 0;

    if (shouldConfirm) {
        const textHeader = 'The imported preset contains proxy and/or custom endpoint settings.';
        const textMessage = fields.join('<br>');
        const cancelButton = { text: 'Cancel import', result: POPUP_RESULT.CANCELLED, appendAtEnd: true };
        const popupOptions = { customButtons: [cancelButton], okButton: 'Remove them', cancelButton: 'Import as-is' };
        const popupResult = await Popup.show.confirm(textHeader, textMessage, popupOptions);

        if (popupResult === POPUP_RESULT.CANCELLED) {
            console.log('Import cancelled by user');
            return;
        }

        if (popupResult === POPUP_RESULT.AFFIRMATIVE) {
            sensitiveFields.forEach(field => delete presetBody[field]);
        }
    }

    if (name in openai_setting_names) {
        const confirm = await callPopup('Preset name already exists. Overwrite?', 'confirm');

        if (!confirm) {
            return;
        }
    }

    await eventSource.emit(event_types.OAI_PRESET_IMPORT_READY, { data: presetBody, presetName: name });

    const savePresetSettings = await fetch(`/api/presets/save-openai?name=${name}`, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: importedFile,
    });

    if (!savePresetSettings.ok) {
        toastr.error('Failed to save preset');
        return;
    }

    const data = await savePresetSettings.json();

    if (Object.keys(openai_setting_names).includes(data.name)) {
        oai_settings.preset_settings_openai = data.name;
        const value = openai_setting_names[data.name];
        Object.assign(openai_settings[value], presetBody);
        $(`#settings_preset_openai option[value="${value}"]`).attr('selected', true);
        $('#settings_preset_openai').trigger('change');
    } else {
        openai_settings.push(presetBody);
        openai_setting_names[data.name] = openai_settings.length - 1;
        const option = document.createElement('option');
        option.selected = true;
        option.value = openai_settings.length - 1;
        option.innerText = data.name;
        $('#settings_preset_openai').append(option).trigger('change');
    }
}

async function onExportPresetClick() {
    if (!oai_settings.preset_settings_openai) {
        toastr.error('No preset selected');
        return;
    }

    const preset = structuredClone(openai_settings[openai_setting_names[oai_settings.preset_settings_openai]]);

    const fieldValues = sensitiveFields.filter(field => preset[field]).map(field => `<b>${field}</b>: <code>${preset[field]}</code>`);
    const shouldConfirm = fieldValues.length > 0;
    const textHeader = 'Your preset contains proxy and/or custom endpoint settings.';
    const textMessage = `<div>Do you want to remove these fields before exporting?</div><br>${DOMPurify.sanitize(fieldValues.join('<br>'))}`;
    const cancelButton = { text: 'Cancel', result: POPUP_RESULT.CANCELLED, appendAtEnd: true };
    const popupOptions = { customButtons: [cancelButton] };
    const popupResult = await Popup.show.confirm(textHeader, textMessage, popupOptions);

    if (popupResult === POPUP_RESULT.CANCELLED) {
        console.log('Export cancelled by user');
        return;
    }

    if (!shouldConfirm || popupResult === POPUP_RESULT.AFFIRMATIVE) {
        sensitiveFields.forEach(field => delete preset[field]);
    }

    await eventSource.emit(event_types.OAI_PRESET_EXPORT_READY, preset);
    const presetJsonString = JSON.stringify(preset, null, 4);
    const presetFileName = `${oai_settings.preset_settings_openai}.json`;
    download(presetJsonString, presetFileName, 'application/json');
}

async function onLogitBiasPresetImportFileChange(e) {
    const file = e.target.files[0];

    if (!file || file.type !== 'application/json') {
        return;
    }

    const name = file.name.replace(/\.[^/.]+$/, '');
    const importedFile = await parseJsonFile(file);
    e.target.value = '';

    if (name in oai_settings.bias_presets) {
        toastr.error('Preset name should be unique.');
        return;
    }

    if (!Array.isArray(importedFile)) {
        toastr.error('Invalid logit bias preset file.');
        return;
    }

    const validEntries = [];

    for (const entry of importedFile) {
        if (typeof entry == 'object' && entry !== null) {
            if (Object.hasOwn(entry, 'text') &&
                Object.hasOwn(entry, 'value')) {
                validEntries.push(entry);
            }
        }
    }

    oai_settings.bias_presets[name] = validEntries;
    oai_settings.bias_preset_selected = name;

    addLogitBiasPresetOption(name);
    saveSettingsDebounced();
}

function onLogitBiasPresetExportClick() {
    if (!oai_settings.bias_preset_selected || Object.keys(oai_settings.bias_presets).length === 0) {
        return;
    }

    const presetJsonString = JSON.stringify(oai_settings.bias_presets[oai_settings.bias_preset_selected], null, 4);
    const presetFileName = `${oai_settings.bias_preset_selected}.json`;
    download(presetJsonString, presetFileName, 'application/json');
}

async function onDeletePresetClick() {
    const confirm = await callPopup('Delete the preset? This action is irreversible and your current settings will be overwritten.', 'confirm');

    if (!confirm) {
        return;
    }

    const nameToDelete = oai_settings.preset_settings_openai;
    const value = openai_setting_names[oai_settings.preset_settings_openai];
    $(`#settings_preset_openai option[value="${value}"]`).remove();
    delete openai_setting_names[oai_settings.preset_settings_openai];
    oai_settings.preset_settings_openai = null;

    if (Object.keys(openai_setting_names).length) {
        oai_settings.preset_settings_openai = Object.keys(openai_setting_names)[0];
        const newValue = openai_setting_names[oai_settings.preset_settings_openai];
        $(`#settings_preset_openai option[value="${newValue}"]`).attr('selected', true);
        $('#settings_preset_openai').trigger('change');
    }

    const response = await fetch('/api/presets/delete-openai', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ name: nameToDelete }),
    });

    if (!response.ok) {
        toastr.warning('Preset was not deleted from server');
    } else {
        toastr.success('Preset deleted');
    }

    saveSettingsDebounced();
}

async function onLogitBiasPresetDeleteClick() {
    const value = await callPopup('Delete the preset?', 'confirm');

    if (!value) {
        return;
    }

    $(`#openai_logit_bias_preset option[value="${oai_settings.bias_preset_selected}"]`).remove();
    delete oai_settings.bias_presets[oai_settings.bias_preset_selected];
    oai_settings.bias_preset_selected = null;

    if (Object.keys(oai_settings.bias_presets).length) {
        oai_settings.bias_preset_selected = Object.keys(oai_settings.bias_presets)[0];
        $(`#openai_logit_bias_preset option[value="${oai_settings.bias_preset_selected}"]`).attr('selected', true);
        $('#openai_logit_bias_preset').trigger('change');
    }

    biasCache = undefined;
    saveSettingsDebounced();
}

// Load OpenAI preset settings
function onSettingsPresetChange() {
    const settingsToUpdate = {
        chat_completion_source: ['#chat_completion_source', 'chat_completion_source', false],
        temperature: ['#temp_openai', 'temp_openai', false],
        frequency_penalty: ['#freq_pen_openai', 'freq_pen_openai', false],
        presence_penalty: ['#pres_pen_openai', 'pres_pen_openai', false],
        top_p: ['#top_p_openai', 'top_p_openai', false],
        top_k: ['#top_k_openai', 'top_k_openai', false],
        top_a: ['#top_a_openai', 'top_a_openai', false],
        min_p: ['#min_p_openai', 'min_p_openai', false],
        repetition_penalty: ['#repetition_penalty_openai', 'repetition_penalty_openai', false],
        max_context_unlocked: ['#oai_max_context_unlocked', 'max_context_unlocked', true],
        openai_model: ['#model_openai_select', 'openai_model', false],
        claude_model: ['#model_claude_select', 'claude_model', false],
        windowai_model: ['#model_windowai_select', 'windowai_model', false],
        openrouter_model: ['#model_openrouter_select', 'openrouter_model', false],
        openrouter_use_fallback: ['#openrouter_use_fallback', 'openrouter_use_fallback', true],
        openrouter_force_instruct: ['#openrouter_force_instruct', 'openrouter_force_instruct', true],
        openrouter_group_models: ['#openrouter_group_models', 'openrouter_group_models', false],
        openrouter_sort_models: ['#openrouter_sort_models', 'openrouter_sort_models', false],
        openrouter_providers: ['#openrouter_providers_chat', 'openrouter_providers', false],
        openrouter_allow_fallbacks: ['#openrouter_allow_fallbacks', 'openrouter_allow_fallbacks', true],
        ai21_model: ['#model_ai21_select', 'ai21_model', false],
        mistralai_model: ['#model_mistralai_select', 'mistralai_model', false],
        cohere_model: ['#model_cohere_select', 'cohere_model', false],
        perplexity_model: ['#model_perplexity_select', 'perplexity_model', false],
        groq_model: ['#model_groq_select', 'groq_model', false],
        zerooneai_model: ['#model_01ai_select', 'zerooneai_model', false],
        blockentropy_model: ['#model_blockentropy_select', 'blockentropy_model', false],
        custom_model: ['#custom_model_id', 'custom_model', false],
        custom_url: ['#custom_api_url_text', 'custom_url', false],
        custom_include_body: ['#custom_include_body', 'custom_include_body', false],
        custom_exclude_body: ['#custom_exclude_body', 'custom_exclude_body', false],
        custom_include_headers: ['#custom_include_headers', 'custom_include_headers', false],
        custom_prompt_post_processing: ['#custom_prompt_post_processing', 'custom_prompt_post_processing', false],
        google_model: ['#model_google_select', 'google_model', false],
        openai_max_context: ['#openai_max_context', 'openai_max_context', false],
        openai_max_tokens: ['#openai_max_tokens', 'openai_max_tokens', false],
        wrap_in_quotes: ['#wrap_in_quotes', 'wrap_in_quotes', true],
        names_behavior: ['#names_behavior', 'names_behavior', false],
        send_if_empty: ['#send_if_empty_textarea', 'send_if_empty', false],
        impersonation_prompt: ['#impersonation_prompt_textarea', 'impersonation_prompt', false],
        new_chat_prompt: ['#newchat_prompt_textarea', 'new_chat_prompt', false],
        new_group_chat_prompt: ['#newgroupchat_prompt_textarea', 'new_group_chat_prompt', false],
        new_example_chat_prompt: ['#newexamplechat_prompt_textarea', 'new_example_chat_prompt', false],
        continue_nudge_prompt: ['#continue_nudge_prompt_textarea', 'continue_nudge_prompt', false],
        bias_preset_selected: ['#openai_logit_bias_preset', 'bias_preset_selected', false],
        reverse_proxy: ['#openai_reverse_proxy', 'reverse_proxy', false],
        wi_format: ['#wi_format_textarea', 'wi_format', false],
        scenario_format: ['#scenario_format_textarea', 'scenario_format', false],
        personality_format: ['#personality_format_textarea', 'personality_format', false],
        group_nudge_prompt: ['#group_nudge_prompt_textarea', 'group_nudge_prompt', false],
        stream_openai: ['#stream_toggle', 'stream_openai', true],
        websearch_cohere: ['#websearch_toggle', 'websearch_cohere', true],
        prompts: ['', 'prompts', false],
        prompt_order: ['', 'prompt_order', false],
        api_url_scale: ['#api_url_scale', 'api_url_scale', false],
        show_external_models: ['#openai_show_external_models', 'show_external_models', true],
        proxy_password: ['#openai_proxy_password', 'proxy_password', false],
        assistant_prefill: ['#claude_assistant_prefill', 'assistant_prefill', false],
        assistant_impersonation: ['#claude_assistant_impersonation', 'assistant_impersonation', false],
        human_sysprompt_message: ['#claude_human_sysprompt_textarea', 'human_sysprompt_message', false],
        claude_use_sysprompt: ['#claude_use_sysprompt', 'claude_use_sysprompt', true],
        use_makersuite_sysprompt: ['#use_makersuite_sysprompt', 'use_makersuite_sysprompt', true],
        use_alt_scale: ['#use_alt_scale', 'use_alt_scale', true],
        squash_system_messages: ['#squash_system_messages', 'squash_system_messages', true],
        image_inlining: ['#openai_image_inlining', 'image_inlining', true],
        inline_image_quality: ['#openai_inline_image_quality', 'inline_image_quality', false],
        continue_prefill: ['#continue_prefill', 'continue_prefill', true],
        continue_postfix: ['#continue_postfix', 'continue_postfix', false],
        function_calling: ['#openai_function_calling', 'function_calling', true],
        seed: ['#seed_openai', 'seed', false],
        n: ['#n_openai', 'n', false],
    };

    const presetName = $('#settings_preset_openai').find(':selected').text();
    oai_settings.preset_settings_openai = presetName;

    const preset = structuredClone(openai_settings[openai_setting_names[oai_settings.preset_settings_openai]]);

    // Migrate old settings
    if (preset.names_in_completion === true && preset.names_behavior === undefined) {
        preset.names_behavior = character_names_behavior.COMPLETION;
    }

    // Claude: Assistant Impersonation Prefill = Inherit from Assistant Prefill
    if (preset.assistant_prefill !== undefined && preset.assistant_impersonation === undefined) {
        preset.assistant_impersonation = preset.assistant_prefill;
    }

    const updateInput = (selector, value) => $(selector).val(value).trigger('input', { source: 'preset' });
    const updateCheckbox = (selector, value) => $(selector).prop('checked', value).trigger('input', { source: 'preset' });

    // Allow subscribers to alter the preset before applying deltas
    eventSource.emit(event_types.OAI_PRESET_CHANGED_BEFORE, {
        preset: preset,
        presetName: presetName,
        settingsToUpdate: settingsToUpdate,
        settings: oai_settings,
        savePreset: saveOpenAIPreset,
    }).finally(r => {
        for (const [key, [selector, setting, isCheckbox]] of Object.entries(settingsToUpdate)) {
            if (preset[key] !== undefined) {
                if (isCheckbox) {
                    updateCheckbox(selector, preset[key]);
                } else {
                    updateInput(selector, preset[key]);
                }
                oai_settings[setting] = preset[key];
            }
        }

        $('#chat_completion_source').trigger('change');
        $('#openai_logit_bias_preset').trigger('change');
        $('#openrouter_providers_chat').trigger('change');

        saveSettingsDebounced();
        eventSource.emit(event_types.OAI_PRESET_CHANGED_AFTER);
    });
}

function getMaxContextOpenAI(value) {
    if (oai_settings.max_context_unlocked) {
        return unlocked_max;
    }
    else if (value.startsWith('o1-')) {
        return max_128k;
    }
    else if (value.includes('chatgpt-4o-latest') || value.includes('gpt-4-turbo') || value.includes('gpt-4o') || value.includes('gpt-4-1106') || value.includes('gpt-4-0125') || value.includes('gpt-4-vision')) {
        return max_128k;
    }
    else if (value.includes('gpt-3.5-turbo-1106')) {
        return max_16k;
    }
    else if (['gpt-4', 'gpt-4-0314', 'gpt-4-0613'].includes(value)) {
        return max_8k;
    }
    else if (['gpt-4-32k', 'gpt-4-32k-0314', 'gpt-4-32k-0613'].includes(value)) {
        return max_32k;
    }
    else if (['gpt-3.5-turbo-16k', 'gpt-3.5-turbo-16k-0613'].includes(value)) {
        return max_16k;
    }
    else if (value == 'code-davinci-002') {
        return max_8k;
    }
    else if (['text-curie-001', 'text-babbage-001', 'text-ada-001'].includes(value)) {
        return max_2k;
    }
    else {
        // default to gpt-3 (4095 tokens)
        return max_4k;
    }
}

function getMaxContextWindowAI(value) {
    if (oai_settings.max_context_unlocked) {
        return unlocked_max;
    }
    else if (value.endsWith('100k')) {
        return claude_100k_max;
    }
    else if (value.includes('claude')) {
        return claude_max;
    }
    else if (value.includes('gpt-3.5-turbo-1106')) {
        return max_16k;
    }
    else if (value.includes('gpt-3.5-turbo-16k')) {
        return max_16k;
    }
    else if (value.includes('gpt-3.5')) {
        return max_4k;
    }
    else if (value.includes('gpt-4-1106')) {
        return max_128k;
    }
    else if (value.includes('gpt-4-vision')) {
        return max_128k;
    }
    else if (value.includes('gpt-4-32k')) {
        return max_32k;
    }
    else if (value.includes('gpt-4')) {
        return max_8k;
    }
    else if (value.includes('palm-2')) {
        return max_8k;
    }
    else if (value.includes('GPT-NeoXT')) {
        return max_2k;
    }
    else {
        // default to gpt-3 (4095 tokens)
        return max_4k;
    }
}

async function onModelChange() {
    biasCache = undefined;
    let value = String($(this).val() || '');

    if ($(this).is('#model_claude_select')) {
        if (value.includes('-v')) {
            value = value.replace('-v', '-');
        } else if (value === '' || value === 'claude-2') {
            value = default_settings.claude_model;
        }
        console.log('Claude model changed to', value);
        oai_settings.claude_model = value;
        $('#model_claude_select').val(oai_settings.claude_model);

    }

    if ($(this).is('#model_windowai_select')) {
        console.log('WindowAI model changed to', value);
        oai_settings.windowai_model = value;
    }

    if ($(this).is('#model_openai_select')) {
        console.log('OpenAI model changed to', value);
        oai_settings.openai_model = value;
    }

    if ($(this).is('#model_openrouter_select')) {
        if (!value) {
            console.debug('Null OR model selected. Ignoring.');
            return;
        }

        console.log('OpenRouter model changed to', value);
        oai_settings.openrouter_model = value;
    }

    if ($(this).is('#model_ai21_select')) {
        if (value === '' || value.startsWith('j2-')) {
            value = 'jamba-1.5-large';
            $('#model_ai21_select').val(value);
        }

        console.log('AI21 model changed to', value);
        oai_settings.ai21_model = value;
    }

    if ($(this).is('#model_google_select')) {
        console.log('Google model changed to', value);
        oai_settings.google_model = value;
    }

    if ($(this).is('#model_mistralai_select')) {
        // Upgrade old mistral models to new naming scheme
        // would have done this in loadOpenAISettings, but it wasn't updating on preset change?
        if (value === 'mistral-medium' || value === 'mistral-small') {
            value = value + '-latest';
        } else if (value === '') {
            value = default_settings.mistralai_model;
        }
        console.log('MistralAI model changed to', value);
        oai_settings.mistralai_model = value;
        $('#model_mistralai_select').val(oai_settings.mistralai_model);
    }

    if ($(this).is('#model_cohere_select')) {
        console.log('Cohere model changed to', value);
        oai_settings.cohere_model = value;
    }

    if ($(this).is('#model_perplexity_select')) {
        console.log('Perplexity model changed to', value);
        oai_settings.perplexity_model = value;
    }

    if ($(this).is('#model_groq_select')) {
        console.log('Groq model changed to', value);
        oai_settings.groq_model = value;
    }

    if (value && $(this).is('#model_01ai_select')) {
        console.log('01.AI model changed to', value);
        oai_settings.zerooneai_model = value;
    }

    if (value && $(this).is('#model_blockentropy_select')) {
        console.log('Block Entropy model changed to', value);
        oai_settings.blockentropy_model = value;
        $('#blockentropy_model_id').val(value).trigger('input');
    }

    if (value && $(this).is('#model_custom_select')) {
        console.log('Custom model changed to', value);
        oai_settings.custom_model = value;
        $('#custom_model_id').val(value).trigger('input');
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.SCALE) {
        if (oai_settings.max_context_unlocked) {
            $('#openai_max_context').attr('max', unlocked_max);
        } else {
            $('#openai_max_context').attr('max', scale_max);
        }
        oai_settings.openai_max_context = Math.min(Number($('#openai_max_context').attr('max')), oai_settings.openai_max_context);
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');
        $('#temp_openai').attr('max', oai_max_temp).val(oai_settings.temp_openai).trigger('input');
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.MAKERSUITE) {
        if (oai_settings.max_context_unlocked) {
            $('#openai_max_context').attr('max', max_2mil);
        } else if (value.includes('gemini-1.5-pro')) {
            $('#openai_max_context').attr('max', max_2mil);
        } else if (value.includes('gemini-1.5-flash')) {
            $('#openai_max_context').attr('max', max_1mil);
        } else if (value.includes('gemini-1.0-pro-vision') || value === 'gemini-pro-vision') {
            $('#openai_max_context').attr('max', max_16k);
        } else if (value.includes('gemini-1.0-pro') || value === 'gemini-pro') {
            $('#openai_max_context').attr('max', max_32k);
        } else if (value === 'text-bison-001') {
            $('#openai_max_context').attr('max', max_8k);
        // The ultra endpoints are possibly dead:
        } else if (value.includes('gemini-1.0-ultra') || value === 'gemini-ultra') {
            $('#openai_max_context').attr('max', max_32k);
        } else {
            $('#openai_max_context').attr('max', max_4k);
        }
        let makersuite_max_temp = (value.includes('vision') || value.includes('ultra')) ? 1.0 : 2.0;
        oai_settings.temp_openai = Math.min(makersuite_max_temp, oai_settings.temp_openai);
        $('#temp_openai').attr('max', makersuite_max_temp).val(oai_settings.temp_openai).trigger('input');
        oai_settings.openai_max_context = Math.min(Number($('#openai_max_context').attr('max')), oai_settings.openai_max_context);
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.OPENROUTER) {
        if (oai_settings.max_context_unlocked) {
            $('#openai_max_context').attr('max', unlocked_max);
        } else {
            const model = model_list.find(m => m.id == oai_settings.openrouter_model);
            if (model?.context_length) {
                $('#openai_max_context').attr('max', model.context_length);
            } else {
                $('#openai_max_context').attr('max', max_8k);
            }
        }
        oai_settings.openai_max_context = Math.min(Number($('#openai_max_context').attr('max')), oai_settings.openai_max_context);
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');

        if (value && (value.includes('claude') || value.includes('palm-2'))) {
            oai_settings.temp_openai = Math.min(claude_max_temp, oai_settings.temp_openai);
            $('#temp_openai').attr('max', claude_max_temp).val(oai_settings.temp_openai).trigger('input');
        }
        else {
            oai_settings.temp_openai = Math.min(oai_max_temp, oai_settings.temp_openai);
            $('#temp_openai').attr('max', oai_max_temp).val(oai_settings.temp_openai).trigger('input');
        }

        calculateOpenRouterCost();
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.CLAUDE) {
        if (oai_settings.max_context_unlocked) {
            $('#openai_max_context').attr('max', max_200k);
        }
        else if (value == 'claude-2.1' || value.startsWith('claude-3')) {
            $('#openai_max_context').attr('max', max_200k);
        }
        else if (value.endsWith('100k') || value.startsWith('claude-2') || value === 'claude-instant-1.2') {
            $('#openai_max_context').attr('max', claude_100k_max);
        }
        else {
            $('#openai_max_context').attr('max', claude_max);
        }

        oai_settings.openai_max_context = Math.min(oai_settings.openai_max_context, Number($('#openai_max_context').attr('max')));
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');

        $('#openai_reverse_proxy').attr('placeholder', 'https://api.anthropic.com/v1');

        oai_settings.temp_openai = Math.min(claude_max_temp, oai_settings.temp_openai);
        $('#temp_openai').attr('max', claude_max_temp).val(oai_settings.temp_openai).trigger('input');
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.WINDOWAI) {
        if (value == '' && 'ai' in window) {
            value = (await window.ai.getCurrentModel()) || '';
        }

        $('#openai_max_context').attr('max', getMaxContextWindowAI(value));
        oai_settings.openai_max_context = Math.min(Number($('#openai_max_context').attr('max')), oai_settings.openai_max_context);
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');

        if (value.includes('claude') || value.includes('palm-2')) {
            oai_settings.temp_openai = Math.min(claude_max_temp, oai_settings.temp_openai);
            $('#temp_openai').attr('max', claude_max_temp).val(oai_settings.temp_openai).trigger('input');
        }
        else {
            oai_settings.temp_openai = Math.min(oai_max_temp, oai_settings.temp_openai);
            $('#temp_openai').attr('max', oai_max_temp).val(oai_settings.temp_openai).trigger('input');
        }
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.OPENAI) {
        $('#openai_max_context').attr('max', getMaxContextOpenAI(value));
        oai_settings.openai_max_context = Math.min(oai_settings.openai_max_context, Number($('#openai_max_context').attr('max')));
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');

        $('#openai_reverse_proxy').attr('placeholder', 'https://api.openai.com/v1');

        oai_settings.temp_openai = Math.min(oai_max_temp, oai_settings.temp_openai);
        $('#temp_openai').attr('max', oai_max_temp).val(oai_settings.temp_openai).trigger('input');
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.MISTRALAI) {
        if (oai_settings.max_context_unlocked) {
            $('#openai_max_context').attr('max', unlocked_max);
        } else if (oai_settings.mistralai_model.includes('codestral-mamba')) {
            $('#openai_max_context').attr('max', max_256k);
        } else if (['mistral-large-2407', 'mistral-large-latest'].includes(oai_settings.mistralai_model)) {
            $('#openai_max_context').attr('max', max_128k);
        } else if (oai_settings.mistralai_model.includes('mistral-nemo')) {
            $('#openai_max_context').attr('max', max_128k);
        } else if (oai_settings.mistralai_model.includes('mixtral-8x22b')) {
            $('#openai_max_context').attr('max', max_64k);
        } else if (oai_settings.mistralai_model.includes('pixtral')) {
            $('#openai_max_context').attr('max', max_128k);
        } else {
            $('#openai_max_context').attr('max', max_32k);
        }
        oai_settings.openai_max_context = Math.min(oai_settings.openai_max_context, Number($('#openai_max_context').attr('max')));
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');

        //mistral also caps temp at 1.0
        oai_settings.temp_openai = Math.min(claude_max_temp, oai_settings.temp_openai);
        $('#temp_openai').attr('max', claude_max_temp).val(oai_settings.temp_openai).trigger('input');
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.COHERE) {
        if (oai_settings.max_context_unlocked) {
            $('#openai_max_context').attr('max', unlocked_max);
        }
        else if (['command-light', 'command'].includes(oai_settings.cohere_model)) {
            $('#openai_max_context').attr('max', max_4k);
        }
        else if (['command-light-nightly', 'command-nightly'].includes(oai_settings.cohere_model)) {
            $('#openai_max_context').attr('max', max_8k);
        }
        else if (oai_settings.cohere_model.includes('command-r')) {
            $('#openai_max_context').attr('max', max_128k);
        }
        else if (['c4ai-aya-23'].includes(oai_settings.cohere_model)) {
            $('#openai_max_context').attr('max', max_8k);
        }
        else {
            $('#openai_max_context').attr('max', max_4k);
        }
        oai_settings.openai_max_context = Math.min(Number($('#openai_max_context').attr('max')), oai_settings.openai_max_context);
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');
        $('#temp_openai').attr('max', claude_max_temp).val(oai_settings.temp_openai).trigger('input');
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.PERPLEXITY) {
        if (oai_settings.max_context_unlocked) {
            $('#openai_max_context').attr('max', unlocked_max);
        }
        else if (oai_settings.perplexity_model.includes('llama-3.1')) {
            const isOnline = oai_settings.perplexity_model.includes('online');
            const contextSize = isOnline ? 128 * 1024 - 4000 : 128 * 1024;
            $('#openai_max_context').attr('max', contextSize);
        }
        else if (['llama-3-sonar-small-32k-chat', 'llama-3-sonar-large-32k-chat'].includes(oai_settings.perplexity_model)) {
            $('#openai_max_context').attr('max', max_32k);
        }
        else if (['llama-3-sonar-small-32k-online', 'llama-3-sonar-large-32k-online'].includes(oai_settings.perplexity_model)) {
            $('#openai_max_context').attr('max', 28000);
        }
        else if (['sonar-small-chat', 'sonar-medium-chat', 'codellama-70b-instruct', 'mistral-7b-instruct', 'mixtral-8x7b-instruct', 'mixtral-8x22b-instruct'].includes(oai_settings.perplexity_model)) {
            $('#openai_max_context').attr('max', max_16k);
        }
        else if (['llama-3-8b-instruct', 'llama-3-70b-instruct'].includes(oai_settings.perplexity_model)) {
            $('#openai_max_context').attr('max', max_8k);
        }
        else if (['sonar-small-online', 'sonar-medium-online'].includes(oai_settings.perplexity_model)) {
            $('#openai_max_context').attr('max', 12000);
        }
        else {
            $('#openai_max_context').attr('max', max_4k);
        }
        oai_settings.openai_max_context = Math.min(Number($('#openai_max_context').attr('max')), oai_settings.openai_max_context);
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');
        oai_settings.temp_openai = Math.min(oai_max_temp, oai_settings.temp_openai);
        $('#temp_openai').attr('max', oai_max_temp).val(oai_settings.temp_openai).trigger('input');
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.GROQ) {
        if (oai_settings.max_context_unlocked) {
            $('#openai_max_context').attr('max', unlocked_max);
        }
        else if (oai_settings.groq_model.includes('llama-3.1')) {
            $('#openai_max_context').attr('max', max_128k);
        }
        else if (oai_settings.groq_model.includes('llama3-groq')) {
            $('#openai_max_context').attr('max', max_8k);
        }
        else if (['llama3-8b-8192', 'llama3-70b-8192', 'gemma-7b-it', 'gemma2-9b-it'].includes(oai_settings.groq_model)) {
            $('#openai_max_context').attr('max', max_8k);
        }
        else if (['mixtral-8x7b-32768'].includes(oai_settings.groq_model)) {
            $('#openai_max_context').attr('max', max_32k);
        }
        else {
            $('#openai_max_context').attr('max', max_4k);
        }
        oai_settings.openai_max_context = Math.min(Number($('#openai_max_context').attr('max')), oai_settings.openai_max_context);
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');
        oai_settings.temp_openai = Math.min(oai_max_temp, oai_settings.temp_openai);
        $('#temp_openai').attr('max', oai_max_temp).val(oai_settings.temp_openai).trigger('input');
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.AI21) {
        if (oai_settings.max_context_unlocked) {
            $('#openai_max_context').attr('max', unlocked_max);
        } else if (oai_settings.ai21_model.includes('jamba-1.5') || oai_settings.ai21_model.includes('jamba-instruct')) {
            $('#openai_max_context').attr('max', max_256k);
        }

        oai_settings.openai_max_context = Math.min(Number($('#openai_max_context').attr('max')), oai_settings.openai_max_context);
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');
        $('#temp_openai').attr('max', oai_max_temp).val(oai_settings.temp_openai).trigger('input');
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.CUSTOM) {
        $('#openai_max_context').attr('max', unlocked_max);
        oai_settings.openai_max_context = Math.min(Number($('#openai_max_context').attr('max')), oai_settings.openai_max_context);
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');
        $('#temp_openai').attr('max', oai_max_temp).val(oai_settings.temp_openai).trigger('input');
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.ZEROONEAI) {
        if (oai_settings.max_context_unlocked) {
            $('#openai_max_context').attr('max', unlocked_max);
        }
        else if (['yi-large'].includes(oai_settings.zerooneai_model)) {
            $('#openai_max_context').attr('max', max_32k);
        }
        else if (['yi-vision'].includes(oai_settings.zerooneai_model)) {
            $('#openai_max_context').attr('max', max_16k);
        }
        else if (['yi-large-turbo'].includes(oai_settings.zerooneai_model)) {
            $('#openai_max_context').attr('max', max_4k);
        }
        else {
            $('#openai_max_context').attr('max', max_16k);
        }

        oai_settings.openai_max_context = Math.min(oai_settings.openai_max_context, Number($('#openai_max_context').attr('max')));
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');

        oai_settings.temp_openai = Math.min(oai_max_temp, oai_settings.temp_openai);
        $('#temp_openai').attr('max', oai_max_temp).val(oai_settings.temp_openai).trigger('input');
    }
    if (oai_settings.chat_completion_source === chat_completion_sources.BLOCKENTROPY) {
        if (oai_settings.max_context_unlocked) {
            $('#openai_max_context').attr('max', unlocked_max);
        }
        else if (oai_settings.blockentropy_model.includes('llama3.1')) {
            $('#openai_max_context').attr('max', max_16k);
        }
        else if (oai_settings.blockentropy_model.includes('72b')) {
            $('#openai_max_context').attr('max', max_16k);
        }
        else if (oai_settings.blockentropy_model.includes('120b')) {
            $('#openai_max_context').attr('max', max_12k);
        }
        else {
            $('#openai_max_context').attr('max', max_8k);
        }

        oai_settings.openai_max_context = Math.min(oai_settings.openai_max_context, Number($('#openai_max_context').attr('max')));
        $('#openai_max_context').val(oai_settings.openai_max_context).trigger('input');

        oai_settings.temp_openai = Math.min(oai_max_temp, oai_settings.temp_openai);
        $('#temp_openai').attr('max', oai_max_temp).val(oai_settings.temp_openai).trigger('input');
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.COHERE) {
        oai_settings.pres_pen_openai = Math.min(Math.max(0, oai_settings.pres_pen_openai), 1);
        $('#pres_pen_openai').attr('max', 1).attr('min', 0).val(oai_settings.pres_pen_openai).trigger('input');
        oai_settings.freq_pen_openai = Math.min(Math.max(0, oai_settings.freq_pen_openai), 1);
        $('#freq_pen_openai').attr('max', 1).attr('min', 0).val(oai_settings.freq_pen_openai).trigger('input');
    } else {
        $('#pres_pen_openai').attr('max', 2).attr('min', -2).val(oai_settings.pres_pen_openai).trigger('input');
        $('#freq_pen_openai').attr('max', 2).attr('min', -2).val(oai_settings.freq_pen_openai).trigger('input');
    }

    $('#openai_max_context_counter').attr('max', Number($('#openai_max_context').attr('max')));

    saveSettingsDebounced();
    eventSource.emit(event_types.CHATCOMPLETION_MODEL_CHANGED, value);
}

async function onOpenrouterModelSortChange() {
    await getStatusOpen();
}

async function onNewPresetClick() {
    const popupText = `
        <h3>Preset name:</h3>
        <h4>Hint: Use a character/group name to bind preset to a specific chat.</h4>`;
    const name = await callPopup(popupText, 'input', oai_settings.preset_settings_openai);

    if (!name) {
        return;
    }

    await saveOpenAIPreset(name, oai_settings);
}

function onReverseProxyInput() {
    oai_settings.reverse_proxy = String($(this).val());
    $('.reverse_proxy_warning').toggle(oai_settings.reverse_proxy != '');
    saveSettingsDebounced();
}

async function onConnectButtonClick(e) {
    e.stopPropagation();

    if (oai_settings.chat_completion_source == chat_completion_sources.WINDOWAI) {
        return await getStatusOpen();
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.OPENROUTER) {
        const api_key_openrouter = String($('#api_key_openrouter').val()).trim();

        if (api_key_openrouter.length) {
            await writeSecret(SECRET_KEYS.OPENROUTER, api_key_openrouter);
        }

        if (!secret_state[SECRET_KEYS.OPENROUTER]) {
            console.log('No secret key saved for OpenRouter');
            return;
        }
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.SCALE) {
        const api_key_scale = String($('#api_key_scale').val()).trim();
        const scale_cookie = String($('#scale_cookie').val()).trim();

        if (api_key_scale.length) {
            await writeSecret(SECRET_KEYS.SCALE, api_key_scale);
        }

        if (scale_cookie.length) {
            await writeSecret(SECRET_KEYS.SCALE_COOKIE, scale_cookie);
        }

        if (!oai_settings.api_url_scale && !oai_settings.use_alt_scale) {
            console.log('No API URL saved for Scale');
            return;
        }

        if (!secret_state[SECRET_KEYS.SCALE] && !oai_settings.use_alt_scale) {
            console.log('No secret key saved for Scale');
            return;
        }

        if (!secret_state[SECRET_KEYS.SCALE_COOKIE] && oai_settings.use_alt_scale) {
            console.log('No cookie set for Scale');
            return;
        }
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.MAKERSUITE) {
        const api_key_makersuite = String($('#api_key_makersuite').val()).trim();

        if (api_key_makersuite.length) {
            await writeSecret(SECRET_KEYS.MAKERSUITE, api_key_makersuite);
        }

        if (!secret_state[SECRET_KEYS.MAKERSUITE] && !oai_settings.reverse_proxy) {
            console.log('No secret key saved for Google AI Studio');
            return;
        }
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.CLAUDE) {
        const api_key_claude = String($('#api_key_claude').val()).trim();

        if (api_key_claude.length) {
            await writeSecret(SECRET_KEYS.CLAUDE, api_key_claude);
        }

        if (!secret_state[SECRET_KEYS.CLAUDE] && !oai_settings.reverse_proxy) {
            console.log('No secret key saved for Claude');
            return;
        }
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.OPENAI) {
        const api_key_openai = String($('#api_key_openai').val()).trim();

        if (api_key_openai.length) {
            await writeSecret(SECRET_KEYS.OPENAI, api_key_openai);
        }

        if (!secret_state[SECRET_KEYS.OPENAI] && !oai_settings.reverse_proxy) {
            console.log('No secret key saved for OpenAI');
            return;
        }
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.AI21) {
        const api_key_ai21 = String($('#api_key_ai21').val()).trim();

        if (api_key_ai21.length) {
            await writeSecret(SECRET_KEYS.AI21, api_key_ai21);
        }

        if (!secret_state[SECRET_KEYS.AI21]) {
            console.log('No secret key saved for AI21');
            return;
        }
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.MISTRALAI) {
        const api_key_mistralai = String($('#api_key_mistralai').val()).trim();

        if (api_key_mistralai.length) {
            await writeSecret(SECRET_KEYS.MISTRALAI, api_key_mistralai);
        }

        if (!secret_state[SECRET_KEYS.MISTRALAI] && !oai_settings.reverse_proxy) {
            console.log('No secret key saved for MistralAI');
            return;
        }
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.CUSTOM) {
        const api_key_custom = String($('#api_key_custom').val()).trim();

        if (api_key_custom.length) {
            await writeSecret(SECRET_KEYS.CUSTOM, api_key_custom);
        }

        if (!oai_settings.custom_url) {
            console.log('No API URL saved for Custom');
            return;
        }
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.COHERE) {
        const api_key_cohere = String($('#api_key_cohere').val()).trim();

        if (api_key_cohere.length) {
            await writeSecret(SECRET_KEYS.COHERE, api_key_cohere);
        }

        if (!secret_state[SECRET_KEYS.COHERE]) {
            console.log('No secret key saved for Cohere');
            return;
        }
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.PERPLEXITY) {
        const api_key_perplexity = String($('#api_key_perplexity').val()).trim();

        if (api_key_perplexity.length) {
            await writeSecret(SECRET_KEYS.PERPLEXITY, api_key_perplexity);
        }

        if (!secret_state[SECRET_KEYS.PERPLEXITY]) {
            console.log('No secret key saved for Perplexity');
            return;
        }
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.GROQ) {
        const api_key_groq = String($('#api_key_groq').val()).trim();

        if (api_key_groq.length) {
            await writeSecret(SECRET_KEYS.GROQ, api_key_groq);
        }

        if (!secret_state[SECRET_KEYS.GROQ]) {
            console.log('No secret key saved for Groq');
            return;
        }
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.ZEROONEAI) {
        const api_key_01ai = String($('#api_key_01ai').val()).trim();

        if (api_key_01ai.length) {
            await writeSecret(SECRET_KEYS.ZEROONEAI, api_key_01ai);
        }

        if (!secret_state[SECRET_KEYS.ZEROONEAI]) {
            console.log('No secret key saved for 01.AI');
            return;
        }
    }
    if (oai_settings.chat_completion_source == chat_completion_sources.BLOCKENTROPY) {
        const api_key_blockentropy = String($('#api_key_blockentropy').val()).trim();

        if (api_key_blockentropy.length) {
            await writeSecret(SECRET_KEYS.BLOCKENTROPY, api_key_blockentropy);
        }

        if (!secret_state[SECRET_KEYS.BLOCKENTROPY]) {
            console.log('No secret key saved for Block Entropy');
            return;
        }
    }

    startStatusLoading();
    saveSettingsDebounced();
    await getStatusOpen();
}

function toggleChatCompletionForms() {
    if (oai_settings.chat_completion_source == chat_completion_sources.CLAUDE) {
        $('#model_claude_select').trigger('change');
    }
    else if (oai_settings.chat_completion_source == chat_completion_sources.OPENAI) {
        if (oai_settings.show_external_models && (!Array.isArray(model_list) || model_list.length == 0)) {
            // Wait until the models list is loaded so that we could show a proper saved model
        }
        else {
            $('#model_openai_select').trigger('change');
        }
    }
    else if (oai_settings.chat_completion_source == chat_completion_sources.WINDOWAI) {
        $('#model_windowai_select').trigger('change');
    }
    else if (oai_settings.chat_completion_source == chat_completion_sources.SCALE) {
        $('#model_scale_select').trigger('change');
    }
    else if (oai_settings.chat_completion_source == chat_completion_sources.MAKERSUITE) {
        $('#model_google_select').trigger('change');
    }
    else if (oai_settings.chat_completion_source == chat_completion_sources.OPENROUTER) {
        $('#model_openrouter_select').trigger('change');
    }
    else if (oai_settings.chat_completion_source == chat_completion_sources.AI21) {
        $('#model_ai21_select').trigger('change');
    }
    else if (oai_settings.chat_completion_source == chat_completion_sources.MISTRALAI) {
        $('#model_mistralai_select').trigger('change');
    }
    else if (oai_settings.chat_completion_source == chat_completion_sources.COHERE) {
        $('#model_cohere_select').trigger('change');
    }
    else if (oai_settings.chat_completion_source == chat_completion_sources.PERPLEXITY) {
        $('#model_perplexity_select').trigger('change');
    }
    else if (oai_settings.chat_completion_source == chat_completion_sources.GROQ) {
        $('#model_groq_select').trigger('change');
    }
    else if (oai_settings.chat_completion_source == chat_completion_sources.ZEROONEAI) {
        $('#model_01ai_select').trigger('change');
    }
    else if (oai_settings.chat_completion_source == chat_completion_sources.CUSTOM) {
        $('#model_custom_select').trigger('change');
    }
    else if (oai_settings.chat_completion_source == chat_completion_sources.BLOCKENTROPY) {
        $('#model_blockentropy_select').trigger('change');
    }
    $('[data-source]').each(function () {
        const validSources = $(this).data('source').split(',');
        $(this).toggle(validSources.includes(oai_settings.chat_completion_source));
    });

    if (chat_completion_sources.CLAUDE == oai_settings.chat_completion_source) {
        $('#claude_human_sysprompt_message_block').toggle(oai_settings.claude_use_sysprompt);
    }
}

async function testApiConnection() {
    // Check if the previous request is still in progress
    if (is_send_press) {
        toastr.info(t`Please wait for the previous request to complete.`);
        return;
    }

    try {
        const reply = await sendOpenAIRequest('quiet', [{ 'role': 'user', 'content': 'Hi' }]);
        console.log(reply);
        toastr.success(t`API connection successful!`);
    }
    catch (err) {
        toastr.error(t`Could not get a reply from API. Check your connection settings / API key and try again.`);
    }
}

function reconnectOpenAi() {
    if (main_api == 'openai') {
        setOnlineStatus('no_connection');
        resultCheckStatus();
        $('#api_button_openai').trigger('click');
    }
}

function onProxyPasswordShowClick() {
    const $input = $('#openai_proxy_password');
    const type = $input.attr('type') === 'password' ? 'text' : 'password';
    $input.attr('type', type);
    $(this).toggleClass('fa-eye-slash fa-eye');
}

function updateScaleForm() {
    if (oai_settings.use_alt_scale) {
        $('#normal_scale_form').css('display', 'none');
        $('#alt_scale_form').css('display', '');
    } else {
        $('#normal_scale_form').css('display', '');
        $('#alt_scale_form').css('display', 'none');
    }
}

async function onCustomizeParametersClick() {
    const template = $(await renderTemplateAsync('customEndpointAdditionalParameters'));

    template.find('#custom_include_body').val(oai_settings.custom_include_body).on('input', function () {
        oai_settings.custom_include_body = String($(this).val());
        saveSettingsDebounced();
    });

    template.find('#custom_exclude_body').val(oai_settings.custom_exclude_body).on('input', function () {
        oai_settings.custom_exclude_body = String($(this).val());
        saveSettingsDebounced();
    });

    template.find('#custom_include_headers').val(oai_settings.custom_include_headers).on('input', function () {
        oai_settings.custom_include_headers = String($(this).val());
        saveSettingsDebounced();
    });

    callPopup(template, 'text', '', { wide: true, large: true });
}

/**
 * Check if the model supports image inlining
 * @returns {boolean} True if the model supports image inlining
 */
export function isImageInliningSupported() {
    if (main_api !== 'openai') {
        return false;
    }

    if (!oai_settings.image_inlining) {
        return false;
    }

    // gultra just isn't being offered as multimodal, thanks google.
    const visionSupportedModels = [
        'gpt-4-vision',
        'gemini-1.5-flash',
        'gemini-1.5-flash-latest',
        'gemini-1.5-flash-001',
        'gemini-1.5-flash-exp-0827',
        'gemini-1.5-flash-8b-exp-0827',
        'gemini-1.0-pro-vision-latest',
        'gemini-1.5-pro',
        'gemini-1.5-pro-latest',
        'gemini-1.5-pro-001',
        'gemini-1.5-pro-exp-0801',
        'gemini-1.5-pro-exp-0827',
        'gemini-pro-vision',
        'claude-3',
        'claude-3-5',
        'gpt-4-turbo',
        'gpt-4o',
        'gpt-4o-mini',
        'chatgpt-4o-latest',
        'yi-vision',
        'pixtral-latest',
        'pixtral-12b-2409',
    ];

    switch (oai_settings.chat_completion_source) {
        case chat_completion_sources.OPENAI:
            return visionSupportedModels.some(model => oai_settings.openai_model.includes(model) && !oai_settings.openai_model.includes('gpt-4-turbo-preview'));
        case chat_completion_sources.MAKERSUITE:
            return visionSupportedModels.some(model => oai_settings.google_model.includes(model));
        case chat_completion_sources.CLAUDE:
            return visionSupportedModels.some(model => oai_settings.claude_model.includes(model));
        case chat_completion_sources.OPENROUTER:
            return !oai_settings.openrouter_force_instruct;
        case chat_completion_sources.CUSTOM:
            return true;
        case chat_completion_sources.ZEROONEAI:
            return visionSupportedModels.some(model => oai_settings.zerooneai_model.includes(model));
        case chat_completion_sources.MISTRALAI:
            return visionSupportedModels.some(model => oai_settings.mistralai_model.includes(model));
        default:
            return false;
    }
}

/**
 * Proxy stuff
 */
export function loadProxyPresets(settings) {
    let proxyPresets = settings.proxies;
    selected_proxy = settings.selected_proxy || selected_proxy;
    if (!Array.isArray(proxyPresets) || proxyPresets.length === 0) {
        proxyPresets = proxies;
    } else {
        proxies = proxyPresets;
    }

    $('#openai_proxy_preset').empty();

    for (const preset of proxyPresets) {
        const option = document.createElement('option');
        option.innerText = preset.name;
        option.value = preset.name;
        option.selected = preset.name === 'None';
        $('#openai_proxy_preset').append(option);
    }
    $('#openai_proxy_preset').val(selected_proxy.name);
    setProxyPreset(selected_proxy.name, selected_proxy.url, selected_proxy.password);
}

function setProxyPreset(name, url, password) {
    const preset = proxies.find(p => p.name === name);
    if (preset) {
        preset.url = url;
        preset.password = password;
        selected_proxy = preset;
    } else {
        let new_proxy = { name, url, password };
        proxies.push(new_proxy);
        selected_proxy = new_proxy;
    }

    $('#openai_reverse_proxy_name').val(name);
    oai_settings.reverse_proxy = url;
    $('#openai_reverse_proxy').val(oai_settings.reverse_proxy);
    oai_settings.proxy_password = password;
    $('#openai_proxy_password').val(oai_settings.proxy_password);
    reconnectOpenAi();
}

function onProxyPresetChange() {
    const value = String($('#openai_proxy_preset').find(':selected').val());
    const selectedPreset = proxies.find(preset => preset.name === value);

    if (selectedPreset) {
        setProxyPreset(selectedPreset.name, selectedPreset.url, selectedPreset.password);
    } else {
        console.error(t`Proxy preset '${value}' not found in proxies array.`);
    }
    saveSettingsDebounced();
}

$('#save_proxy').on('click', async function () {
    const presetName = $('#openai_reverse_proxy_name').val();
    const reverseProxy = $('#openai_reverse_proxy').val();
    const proxyPassword = $('#openai_proxy_password').val();

    setProxyPreset(presetName, reverseProxy, proxyPassword);
    saveSettingsDebounced();
    toastr.success(t`Proxy Saved`);
    if ($('#openai_proxy_preset').val() !== presetName) {
        const option = document.createElement('option');
        option.text = presetName;
        option.value = presetName;

        $('#openai_proxy_preset').append(option);
    }
    $('#openai_proxy_preset').val(presetName);
});

$('#delete_proxy').on('click', async function () {
    const presetName = $('#openai_reverse_proxy_name').val();
    const index = proxies.findIndex(preset => preset.name === presetName);

    if (index !== -1) {
        proxies.splice(index, 1);
        $('#openai_proxy_preset option[value="' + presetName + '"]').remove();

        if (proxies.length > 0) {
            const newIndex = Math.max(0, index - 1);
            selected_proxy = proxies[newIndex];
        } else {
            selected_proxy = { name: 'None', url: '', password: '' };
        }

        $('#openai_reverse_proxy_name').val(selected_proxy.name);
        oai_settings.reverse_proxy = selected_proxy.url;
        $('#openai_reverse_proxy').val(selected_proxy.url);
        oai_settings.proxy_password = selected_proxy.password;
        $('#openai_proxy_password').val(selected_proxy.password);

        saveSettingsDebounced();
        $('#openai_proxy_preset').val(selected_proxy.name);
        toastr.success(t`Proxy Deleted`);
    } else {
        toastr.error(t`Could not find proxy with name '${presetName}'`);
    }
});

function runProxyCallback(_, value) {
    if (!value) {
        return selected_proxy?.name || '';
    }

    const proxyNames = proxies.map(preset => preset.name);
    const fuse = new Fuse(proxyNames);
    const result = fuse.search(value);

    if (result.length === 0) {
        toastr.warning(`Proxy preset "${value}" not found`);
        return '';
    }

    const foundName = result[0].item;
    $('#openai_proxy_preset').val(foundName).trigger('change');
    return foundName;
}

export function initOpenAI() {
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'proxy',
        callback: runProxyCallback,
        returns: 'current proxy',
        namedArgumentList: [],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: () => proxies.map(preset => new SlashCommandEnumValue(preset.name, preset.url)),
            }),
        ],
        helpString: 'Sets a proxy preset by name.',
    }));

    $('#test_api_button').on('click', testApiConnection);

    $('#scale-alt').on('change', function () {
        oai_settings.use_alt_scale = !!$('#scale-alt').prop('checked');
        saveSettingsDebounced();
        updateScaleForm();
    });

    $('#temp_openai').on('input', function () {
        oai_settings.temp_openai = Number($(this).val());
        $('#temp_counter_openai').val(Number($(this).val()).toFixed(2));
        saveSettingsDebounced();
    });

    $('#freq_pen_openai').on('input', function () {
        oai_settings.freq_pen_openai = Number($(this).val());
        $('#freq_pen_counter_openai').val(Number($(this).val()).toFixed(2));
        saveSettingsDebounced();
    });

    $('#pres_pen_openai').on('input', function () {
        oai_settings.pres_pen_openai = Number($(this).val());
        $('#pres_pen_counter_openai').val(Number($(this).val()).toFixed(2));
        saveSettingsDebounced();
    });

    $('#top_p_openai').on('input', function () {
        oai_settings.top_p_openai = Number($(this).val());
        $('#top_p_counter_openai').val(Number($(this).val()).toFixed(2));
        saveSettingsDebounced();
    });

    $('#top_k_openai').on('input', function () {
        oai_settings.top_k_openai = Number($(this).val());
        $('#top_k_counter_openai').val(Number($(this).val()).toFixed(0));
        saveSettingsDebounced();
    });

    $('#top_a_openai').on('input', function () {
        oai_settings.top_a_openai = Number($(this).val());
        $('#top_a_counter_openai').val(Number($(this).val()));
        saveSettingsDebounced();
    });

    $('#min_p_openai').on('input', function () {
        oai_settings.min_p_openai = Number($(this).val());
        $('#min_p_counter_openai').val(Number($(this).val()));
        saveSettingsDebounced();
    });

    $('#repetition_penalty_openai').on('input', function () {
        oai_settings.repetition_penalty_openai = Number($(this).val());
        $('#repetition_penalty_counter_openai').val(Number($(this).val()));
        saveSettingsDebounced();
    });

    $('#openai_max_context').on('input', function () {
        oai_settings.openai_max_context = Number($(this).val());
        $('#openai_max_context_counter').val(`${$(this).val()}`);
        calculateOpenRouterCost();
        saveSettingsDebounced();
    });

    $('#openai_max_tokens').on('input', function () {
        oai_settings.openai_max_tokens = Number($(this).val());
        calculateOpenRouterCost();
        saveSettingsDebounced();
    });

    $('#stream_toggle').on('change', function () {
        oai_settings.stream_openai = !!$('#stream_toggle').prop('checked');
        saveSettingsDebounced();
    });

    $('#websearch_toggle').on('change', function () {
        oai_settings.websearch_cohere = !!$('#websearch_toggle').prop('checked');
        saveSettingsDebounced();
    });

    $('#wrap_in_quotes').on('change', function () {
        oai_settings.wrap_in_quotes = !!$('#wrap_in_quotes').prop('checked');
        saveSettingsDebounced();
    });

    $('#claude_use_sysprompt').on('change', function () {
        oai_settings.claude_use_sysprompt = !!$('#claude_use_sysprompt').prop('checked');
        $('#claude_human_sysprompt_message_block').toggle(oai_settings.claude_use_sysprompt);
        saveSettingsDebounced();
    });

    $('#use_makersuite_sysprompt').on('change', function () {
        oai_settings.use_makersuite_sysprompt = !!$('#use_makersuite_sysprompt').prop('checked');
        saveSettingsDebounced();
    });

    $('#send_if_empty_textarea').on('input', function () {
        oai_settings.send_if_empty = String($('#send_if_empty_textarea').val());
        saveSettingsDebounced();
    });

    $('#impersonation_prompt_textarea').on('input', function () {
        oai_settings.impersonation_prompt = String($('#impersonation_prompt_textarea').val());
        saveSettingsDebounced();
    });

    $('#newchat_prompt_textarea').on('input', function () {
        oai_settings.new_chat_prompt = String($('#newchat_prompt_textarea').val());
        saveSettingsDebounced();
    });

    $('#newgroupchat_prompt_textarea').on('input', function () {
        oai_settings.new_group_chat_prompt = String($('#newgroupchat_prompt_textarea').val());
        saveSettingsDebounced();
    });

    $('#newexamplechat_prompt_textarea').on('input', function () {
        oai_settings.new_example_chat_prompt = String($('#newexamplechat_prompt_textarea').val());
        saveSettingsDebounced();
    });

    $('#continue_nudge_prompt_textarea').on('input', function () {
        oai_settings.continue_nudge_prompt = String($('#continue_nudge_prompt_textarea').val());
        saveSettingsDebounced();
    });

    $('#wi_format_textarea').on('input', function () {
        oai_settings.wi_format = String($('#wi_format_textarea').val());
        saveSettingsDebounced();
    });

    $('#scenario_format_textarea').on('input', function () {
        oai_settings.scenario_format = String($('#scenario_format_textarea').val());
        saveSettingsDebounced();
    });

    $('#personality_format_textarea').on('input', function () {
        oai_settings.personality_format = String($('#personality_format_textarea').val());
        saveSettingsDebounced();
    });

    $('#group_nudge_prompt_textarea').on('input', function () {
        oai_settings.group_nudge_prompt = String($('#group_nudge_prompt_textarea').val());
        saveSettingsDebounced();
    });

    $('#update_oai_preset').on('click', async function () {
        const name = oai_settings.preset_settings_openai;
        await saveOpenAIPreset(name, oai_settings);
        toastr.success('Preset updated');
    });

    $('#impersonation_prompt_restore').on('click', function () {
        oai_settings.impersonation_prompt = default_impersonation_prompt;
        $('#impersonation_prompt_textarea').val(oai_settings.impersonation_prompt);
        saveSettingsDebounced();
    });

    $('#newchat_prompt_restore').on('click', function () {
        oai_settings.new_chat_prompt = default_new_chat_prompt;
        $('#newchat_prompt_textarea').val(oai_settings.new_chat_prompt);
        saveSettingsDebounced();
    });

    $('#claude_human_sysprompt_message_restore').on('click', function () {
        oai_settings.human_sysprompt_message = default_claude_human_sysprompt_message;
        $('#claude_human_sysprompt_textarea').val(oai_settings.human_sysprompt_message);
        saveSettingsDebounced();
    });

    $('#newgroupchat_prompt_restore').on('click', function () {
        oai_settings.new_group_chat_prompt = default_new_group_chat_prompt;
        $('#newgroupchat_prompt_textarea').val(oai_settings.new_group_chat_prompt);
        saveSettingsDebounced();
    });

    $('#newexamplechat_prompt_restore').on('click', function () {
        oai_settings.new_example_chat_prompt = default_new_example_chat_prompt;
        $('#newexamplechat_prompt_textarea').val(oai_settings.new_example_chat_prompt);
        saveSettingsDebounced();
    });

    $('#continue_nudge_prompt_restore').on('click', function () {
        oai_settings.continue_nudge_prompt = default_continue_nudge_prompt;
        $('#continue_nudge_prompt_textarea').val(oai_settings.continue_nudge_prompt);
        saveSettingsDebounced();
    });

    $('#wi_format_restore').on('click', function () {
        oai_settings.wi_format = default_wi_format;
        $('#wi_format_textarea').val(oai_settings.wi_format);
        saveSettingsDebounced();
    });

    $('#scenario_format_restore').on('click', function () {
        oai_settings.scenario_format = default_scenario_format;
        $('#scenario_format_textarea').val(oai_settings.scenario_format);
        saveSettingsDebounced();
    });

    $('#personality_format_restore').on('click', function () {
        oai_settings.personality_format = default_personality_format;
        $('#personality_format_textarea').val(oai_settings.personality_format);
        saveSettingsDebounced();
    });

    $('#group_nudge_prompt_restore').on('click', function () {
        oai_settings.group_nudge_prompt = default_group_nudge_prompt;
        $('#group_nudge_prompt_textarea').val(oai_settings.group_nudge_prompt);
        saveSettingsDebounced();
    });

    $('#openai_bypass_status_check').on('input', function () {
        oai_settings.bypass_status_check = !!$(this).prop('checked');
        getStatusOpen();
        saveSettingsDebounced();
    });

    $('#chat_completion_source').on('change', function () {
        oai_settings.chat_completion_source = String($(this).find(':selected').val());
        toggleChatCompletionForms();
        saveSettingsDebounced();
        reconnectOpenAi();
        forceCharacterEditorTokenize();
        eventSource.emit(event_types.CHATCOMPLETION_SOURCE_CHANGED, oai_settings.chat_completion_source);
    });

    $('#oai_max_context_unlocked').on('input', function (_e, data) {
        oai_settings.max_context_unlocked = !!$(this).prop('checked');
        if (data?.source !== 'preset') {
            $('#chat_completion_source').trigger('change');
        }
        saveSettingsDebounced();
    });

    $('#api_url_scale').on('input', function () {
        oai_settings.api_url_scale = String($(this).val());
        saveSettingsDebounced();
    });

    $('#openai_show_external_models').on('input', function () {
        oai_settings.show_external_models = !!$(this).prop('checked');
        $('#openai_external_category').toggle(oai_settings.show_external_models);
        saveSettingsDebounced();
    });

    $('#openai_proxy_password').on('input', function () {
        oai_settings.proxy_password = String($(this).val());
        saveSettingsDebounced();
    });

    $('#claude_assistant_prefill').on('input', function () {
        oai_settings.assistant_prefill = String($(this).val());
        saveSettingsDebounced();
    });

    $('#claude_assistant_impersonation').on('input', function () {
        oai_settings.assistant_impersonation = String($(this).val());
        saveSettingsDebounced();
    });

    $('#claude_human_sysprompt_textarea').on('input', function () {
        oai_settings.human_sysprompt_message = String($('#claude_human_sysprompt_textarea').val());
        saveSettingsDebounced();
    });

    $('#openrouter_use_fallback').on('input', function () {
        oai_settings.openrouter_use_fallback = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#openrouter_force_instruct').on('input', function () {
        oai_settings.openrouter_force_instruct = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#openrouter_group_models').on('input', function () {
        oai_settings.openrouter_group_models = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#openrouter_sort_models').on('input', function () {
        oai_settings.openrouter_sort_models = String($(this).val());
        saveSettingsDebounced();
    });

    $('#openrouter_allow_fallbacks').on('input', function () {
        oai_settings.openrouter_allow_fallbacks = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#squash_system_messages').on('input', function () {
        oai_settings.squash_system_messages = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#openai_image_inlining').on('input', function () {
        oai_settings.image_inlining = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#openai_inline_image_quality').on('input', function () {
        oai_settings.inline_image_quality = String($(this).val());
        saveSettingsDebounced();
    });

    $('#continue_prefill').on('input', function () {
        oai_settings.continue_prefill = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#openai_function_calling').on('input', function () {
        oai_settings.function_calling = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#seed_openai').on('input', function () {
        oai_settings.seed = Number($(this).val());
        saveSettingsDebounced();
    });

    $('#n_openai').on('input', function () {
        oai_settings.n = Number($(this).val());
        saveSettingsDebounced();
    });

    $('#custom_api_url_text').on('input', function () {
        oai_settings.custom_url = String($(this).val());
        saveSettingsDebounced();
    });

    $('#custom_model_id').on('input', function () {
        oai_settings.custom_model = String($(this).val());
        saveSettingsDebounced();
    });

    $('#custom_prompt_post_processing').on('change', function () {
        oai_settings.custom_prompt_post_processing = String($(this).val());
        saveSettingsDebounced();
    });

    $('#names_behavior').on('input', function () {
        oai_settings.names_behavior = Number($(this).val());
        setNamesBehaviorControls();
        saveSettingsDebounced();
    });

    $('#character_names_none').on('input', function () {
        oai_settings.names_behavior = character_names_behavior.NONE;
        setNamesBehaviorControls();
        saveSettingsDebounced();
    });

    $('#character_names_default').on('input', function () {
        oai_settings.names_behavior = character_names_behavior.DEFAULT;
        setNamesBehaviorControls();
        saveSettingsDebounced();
    });

    $('#character_names_completion').on('input', function () {
        oai_settings.names_behavior = character_names_behavior.COMPLETION;
        setNamesBehaviorControls();
        saveSettingsDebounced();
    });

    $('#character_names_content').on('input', function () {
        oai_settings.names_behavior = character_names_behavior.CONTENT;
        setNamesBehaviorControls();
        saveSettingsDebounced();
    });

    $('#continue_postifx').on('input', function () {
        oai_settings.continue_postfix = String($(this).val());
        setContinuePostfixControls();
        saveSettingsDebounced();
    });

    $('#continue_postfix_none').on('input', function () {
        oai_settings.continue_postfix = continue_postfix_types.NONE;
        setContinuePostfixControls();
        saveSettingsDebounced();
    });

    $('#continue_postfix_space').on('input', function () {
        oai_settings.continue_postfix = continue_postfix_types.SPACE;
        setContinuePostfixControls();
        saveSettingsDebounced();
    });

    $('#continue_postfix_newline').on('input', function () {
        oai_settings.continue_postfix = continue_postfix_types.NEWLINE;
        setContinuePostfixControls();
        saveSettingsDebounced();
    });

    $('#continue_postfix_double_newline').on('input', function () {
        oai_settings.continue_postfix = continue_postfix_types.DOUBLE_NEWLINE;
        setContinuePostfixControls();
        saveSettingsDebounced();
    });

    if (!CSS.supports('field-sizing', 'content')) {
        $(document).on('input', '#openai_settings .autoSetHeight', function () {
            resetScrollHeight($(this));
        });
    }

    if (!isMobile()) {
        $('#model_openrouter_select').select2({
            placeholder: 'Select a model',
            searchInputPlaceholder: 'Search models...',
            searchInputCssClass: 'text_pole',
            width: '100%',
            templateResult: getOpenRouterModelTemplate,
        });
    }

    $('#openrouter_providers_chat').on('change', function () {
        const selectedProviders = $(this).val();

        // Not a multiple select?
        if (!Array.isArray(selectedProviders)) {
            return;
        }

        oai_settings.openrouter_providers = selectedProviders;

        saveSettingsDebounced();
    });

    $('#api_button_openai').on('click', onConnectButtonClick);
    $('#openai_reverse_proxy').on('input', onReverseProxyInput);
    $('#model_openai_select').on('change', onModelChange);
    $('#model_claude_select').on('change', onModelChange);
    $('#model_windowai_select').on('change', onModelChange);
    $('#model_scale_select').on('change', onModelChange);
    $('#model_google_select').on('change', onModelChange);
    $('#model_openrouter_select').on('change', onModelChange);
    $('#openrouter_group_models').on('change', onOpenrouterModelSortChange);
    $('#openrouter_sort_models').on('change', onOpenrouterModelSortChange);
    $('#model_ai21_select').on('change', onModelChange);
    $('#model_mistralai_select').on('change', onModelChange);
    $('#model_cohere_select').on('change', onModelChange);
    $('#model_perplexity_select').on('change', onModelChange);
    $('#model_groq_select').on('change', onModelChange);
    $('#model_01ai_select').on('change', onModelChange);
    $('#model_blockentropy_select').on('change', onModelChange);
    $('#model_custom_select').on('change', onModelChange);
    $('#settings_preset_openai').on('change', onSettingsPresetChange);
    $('#new_oai_preset').on('click', onNewPresetClick);
    $('#delete_oai_preset').on('click', onDeletePresetClick);
    $('#openai_logit_bias_preset').on('change', onLogitBiasPresetChange);
    $('#openai_logit_bias_new_preset').on('click', createNewLogitBiasPreset);
    $('#openai_logit_bias_new_entry').on('click', createNewLogitBiasEntry);
    $('#openai_logit_bias_import_file').on('input', onLogitBiasPresetImportFileChange);
    $('#openai_preset_import_file').on('input', onPresetImportFileChange);
    $('#export_oai_preset').on('click', onExportPresetClick);
    $('#openai_logit_bias_import_preset').on('click', onLogitBiasPresetImportClick);
    $('#openai_logit_bias_export_preset').on('click', onLogitBiasPresetExportClick);
    $('#openai_logit_bias_delete_preset').on('click', onLogitBiasPresetDeleteClick);
    $('#import_oai_preset').on('click', onImportPresetClick);
    $('#openai_proxy_password_show').on('click', onProxyPasswordShowClick);
    $('#customize_additional_parameters').on('click', onCustomizeParametersClick);
    $('#openai_proxy_preset').on('change', onProxyPresetChange);
}
