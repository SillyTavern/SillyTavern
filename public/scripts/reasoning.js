import {
    moment,
} from '../lib.js';
import { chat, closeMessageEditor, event_types, eventSource, main_api, messageFormatting, saveChatConditional, saveSettingsDebounced, substituteParams, updateMessageBlock } from '../script.js';
import { getRegexedString, regex_placement } from './extensions/regex/engine.js';
import { getCurrentLocale, t } from './i18n.js';
import { MacrosParser } from './macros.js';
import { chat_completion_sources, getChatCompletionModel, oai_settings } from './openai.js';
import { Popup } from './popup.js';
import { power_user } from './power-user.js';
import { SlashCommand } from './slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from './slash-commands/SlashCommandArgument.js';
import { commonEnumProviders } from './slash-commands/SlashCommandCommonEnumsProvider.js';
import { SlashCommandParser } from './slash-commands/SlashCommandParser.js';
import { textgen_types, textgenerationwebui_settings } from './textgen-settings.js';
import { copyText, escapeRegex, isFalseBoolean, setDatasetProperty } from './utils.js';

/**
 * Gets a message from a jQuery element.
 * @param {Element} element
 * @returns {{messageId: number, message: object, messageBlock: JQuery<HTMLElement>}}
 */
function getMessageFromJquery(element) {
    const messageBlock = $(element).closest('.mes');
    const messageId = Number(messageBlock.attr('mesid'));
    const message = chat[messageId];
    return { messageId: messageId, message, messageBlock };
}

/**
 * Toggles the auto-expand state of reasoning blocks.
 */
function toggleReasoningAutoExpand() {
    const reasoningBlocks = document.querySelectorAll('details.mes_reasoning_details');
    reasoningBlocks.forEach((block) => {
        if (block instanceof HTMLDetailsElement) {
            block.open = power_user.reasoning.auto_expand;
        }
    });
}

/**
 * Extracts the reasoning from the response data.
 * @param {object} data Response data
 * @returns {string} Extracted reasoning
 */
export function extractReasoningFromData(data) {
    switch (main_api) {
        case 'textgenerationwebui':
            switch (textgenerationwebui_settings.type) {
                case textgen_types.OPENROUTER:
                    return data?.choices?.[0]?.reasoning ?? '';
            }
            break;

        case 'openai':
            if (!oai_settings.show_thoughts) break;

            switch (oai_settings.chat_completion_source) {
                case chat_completion_sources.DEEPSEEK:
                    return data?.choices?.[0]?.message?.reasoning_content ?? '';
                case chat_completion_sources.OPENROUTER:
                    return data?.choices?.[0]?.message?.reasoning ?? '';
                case chat_completion_sources.MAKERSUITE:
                    return data?.responseContent?.parts?.filter(part => part.thought)?.map(part => part.text)?.join('\n\n') ?? '';
            }
            break;
    }

    return '';
}

/**
 * Check if the model supports reasoning, but does not send back the reasoning
 * @returns {boolean} True if the model supports reasoning
 */
export function isHiddenReasoningModel() {
    if (main_api !== 'openai') {
        return false;
    }

    /** @typedef {{ (currentModel: string, supportedModel: string): boolean }} MatchingFunc */
    /** @type {Record.<string, MatchingFunc>} */
    const FUNCS = {
        equals: (currentModel, supportedModel) => currentModel === supportedModel,
        startsWith: (currentModel, supportedModel) => currentModel.startsWith(supportedModel),
    };

    /** @type {{ name: string; func: MatchingFunc; }[]} */
    const hiddenReasoningModels = [
        { name: 'o1', func: FUNCS.startsWith },
        { name: 'o3', func: FUNCS.startsWith },
        { name: 'gemini-2.0-flash-thinking-exp', func: FUNCS.startsWith },
        { name: 'gemini-2.0-pro-exp', func: FUNCS.startsWith },
    ];

    const model = getChatCompletionModel() || '';

    const isHidden = hiddenReasoningModels.some(({ name, func }) => func(model, name));
    return isHidden;
}

/**
 * Updates the Reasoning UI for a specific message
 * @param {number|JQuery<HTMLElement>|HTMLElement} messageIdOrElement The message ID or the message element
 * @param {Object} [options={}] - Optional arguments
 * @param {boolean} [options.reset=false] - Whether to reset state, and not take the current mess properties (for example when swiping)
 */
export function updateReasoningUI(messageIdOrElement, { reset = false } = {}) {
    const handler = new ReasoningHandler();
    handler.initHandleMessage(messageIdOrElement, { reset });
}


/**
 * Enum for representing the state of reasoning
 * @enum {string}
 * @readonly
 */
export const ReasoningState = {
    None: 'none',
    Thinking: 'thinking',
    Done: 'done',
    Hidden: 'hidden',
};

/**
 * Handles reasoning-specific logic and DOM updates for messages.
 * This class is used inside the {@link StreamingProcessor} to manage reasoning states and UI updates.
 */
export class ReasoningHandler {
    #isHiddenReasoningModel;

    /**
     * @param {Date?} [timeStarted=null] - When the generation started
     */
    constructor(timeStarted = null) {
        /** @type {ReasoningState} The current state of the reasoning process */
        this.state = ReasoningState.None;
        /** @type {string} The reasoning output */
        this.reasoning = '';
        /** @type {Date} When the reasoning started */
        this.startTime = null;
        /** @type {Date} When the reasoning ended */
        this.endTime = null;

        /** @type {Date} Initial starting time of the generation */
        this.initialTime = timeStarted ?? new Date();

        /** @type {boolean} True if the model supports reasoning, but hides the reasoning output */
        this.#isHiddenReasoningModel = isHiddenReasoningModel();

        // Cached DOM elements for reasoning
        /** @type {HTMLElement} Main message DOM element `.mes` */
        this.messageDom = null;
        /** @type {HTMLDetailsElement} Reasoning details DOM element `.mes_reasoning_details` */
        this.messageReasoningDetailsDom = null;
        /** @type {HTMLElement} Reasoning content DOM element `.mes_reasoning` */
        this.messageReasoningContentDom = null;
        /** @type {HTMLElement} Reasoning header DOM element `.mes_reasoning_header_title` */
        this.messageReasoningHeaderDom = null;
    }

    /**
     * Initializes the reasoning handler for a specific message.
     *
     * Can be used to update the DOM elements or read other reasoning states.
     * It will internally take the message-saved data and write the states back into the handler, as if during streaming of the message.
     * The state will always be either done/hidden or none.
     *
     * @param {number|JQuery<HTMLElement>|HTMLElement} messageIdOrElement - The message ID or the message element
     * @param {Object} [options={}] - Optional arguments
     * @param {boolean} [options.reset=false] - Whether to reset state of the handler, and not take the current mess properties (for example when swiping)
     */
    initHandleMessage(messageIdOrElement, { reset = false } = {}) {
        /** @type {HTMLElement} */
        const messageElement = typeof messageIdOrElement === 'number'
            ? document.querySelector(`#chat [mesid="${messageIdOrElement}"]`)
            : messageIdOrElement instanceof HTMLElement
                ? messageIdOrElement
                : $(messageIdOrElement)[0];
        const messageId = Number(messageElement.getAttribute('mesid'));

        if (isNaN(messageId) || !chat[messageId]) return;

        if (!chat[messageId].extra) {
            chat[messageId].extra = {};
        }
        const extra = chat[messageId].extra;

        if (extra.reasoning) {
            this.state = ReasoningState.Done;
        } else if (extra.reasoning_duration) {
            this.state = ReasoningState.Hidden;
        }

        this.reasoning = extra?.reasoning ?? '';

        if (this.state !== ReasoningState.None) {
            this.initialTime = new Date(chat[messageId].gen_started);
            this.startTime = this.initialTime;
            this.endTime = new Date(this.startTime.getTime() + (extra?.reasoning_duration ?? 0));
        }

        // Prefill main dom element, as message might not have been rendered yet
        this.messageDom = messageElement;

        // Make sure reset correctly clears all relevant states
        if (reset) {
            this.state = this.#isHiddenReasoningModel ? ReasoningState.Thinking : ReasoningState.None;
            this.reasoning = '';
            this.initialTime = new Date();
            this.startTime = null;
            this.endTime = null;
        }

        this.updateDom(messageId);

        if (power_user.reasoning.auto_expand && this.state !== ReasoningState.Hidden) {
            this.messageReasoningDetailsDom.open = true;
        }
    }

    /**
     * Gets the duration of the reasoning in milliseconds.
     *
     * @returns {number?} The duration in milliseconds, or null if the start or end time is not set
     */
    getDuration() {
        if (this.startTime && this.endTime) {
            return this.endTime.getTime() - this.startTime.getTime();
        }
        return null;
    }

    /**
     * Updates the reasoning text/string for a message.
     *
     * @param {number} messageId - The ID of the message to update
     * @param {string?} [reasoning=null] - The reasoning text to update - If null, uses the current reasoning
     * @param {Object} [options={}] - Optional arguments
     * @param {boolean} [options.persist=false] - Whether to persist the reasoning to the message object
     * @returns {boolean} - Returns true if the reasoning was changed, otherwise false
     */
    updateReasoning(messageId, reasoning = null, { persist = false } = {}) {
        if (messageId == -1 || !chat[messageId]) {
            return false;
        }

        reasoning = reasoning ?? this.reasoning;
        reasoning = power_user.trim_spaces ? reasoning.trim() : reasoning;

        // Ensure the chat extra exists
        if (!chat[messageId].extra) {
            chat[messageId].extra = {};
        }
        const extra = chat[messageId].extra;

        const reasoningChanged = extra.reasoning !== reasoning;
        this.reasoning = getRegexedString(reasoning ?? '', regex_placement.REASONING);

        if (persist) {
            // Build and save the reasoning data to message extras
            extra.reasoning = this.reasoning;
            extra.reasoning_duration = this.getDuration();
        }

        return reasoningChanged;
    }


    /**
     * Handles processing of reasoning for a message.
     *
     * This is usually called by the message processor when a message is changed.
     *
     * @param {number} messageId - The ID of the message to process
     * @param {boolean} mesChanged - Whether the message has changed
     * @returns {Promise<void>}
     */
    async process(messageId, mesChanged) {
        if (!this.reasoning && !this.#isHiddenReasoningModel) return;

        // Ensure reasoning string is updated and regexes are applied correctly
        const reasoningChanged = this.updateReasoning(messageId, null, { persist: true });

        if ((this.#isHiddenReasoningModel || reasoningChanged) && this.state === ReasoningState.None) {
            this.state = ReasoningState.Thinking;
            this.startTime = this.initialTime;
        }
        if ((this.#isHiddenReasoningModel || !reasoningChanged) && mesChanged && this.state === ReasoningState.Thinking) {
            this.endTime = new Date();
            await this.finish(messageId);
        }
    }

    /**
     * Completes the reasoning process for a message.
     *
     * Records the finish time if it was not set during streaming and updates the reasoning state.
     * Emits an event to signal the completion of reasoning and updates the DOM elements accordingly.
     *
     * @param {number} messageId - The ID of the message to complete reasoning for
     * @returns {Promise<void>}
     */
    async finish(messageId) {
        if (this.state === ReasoningState.None) return;

        // Make sure the finish time is recorded if a reasoning was in process and it wasn't ended correctly during streaming
        if (this.startTime !== null && this.endTime === null) {
            this.endTime = new Date();
        }

        if (this.state === ReasoningState.Thinking) {
            this.state = this.#isHiddenReasoningModel ? ReasoningState.Hidden : ReasoningState.Done;
            this.updateReasoning(messageId, null, { persist: true });
            await eventSource.emit(event_types.STREAM_REASONING_DONE, this.reasoning, this.getDuration(), messageId, this.state);
        }

        this.updateDom(messageId);
    }

    /**
     * Updates the reasoning UI elements for a message.
     *
     * Toggles the CSS class, updates states, reasoning message, and duration.
     *
     * @param {number} messageId - The ID of the message to update
     */
    updateDom(messageId) {
        this.#checkDomElements(messageId);

        // Main CSS class to show this message includes reasoning
        this.messageDom.classList.toggle('reasoning', this.state !== ReasoningState.None);

        // Update states to the relevant DOM elements
        setDatasetProperty(this.messageDom, 'reasoningState', this.state !== ReasoningState.None ? this.state : null);
        setDatasetProperty(this.messageReasoningDetailsDom, 'state', this.state);

        // Update the reasoning message
        const reasoning = power_user.trim_spaces ? this.reasoning.trim() : this.reasoning;
        const displayReasoning = messageFormatting(reasoning, '', false, false, messageId, {}, true);
        this.messageReasoningContentDom.innerHTML = displayReasoning;

        // Update tooltip for hidden reasoning edit
        /** @type {HTMLElement} */
        const button = this.messageDom.querySelector('.mes_edit_add_reasoning');
        button.title = this.state === ReasoningState.Hidden ? t`Hidden reasoning - Add reasoning block` : t`Add reasoning block`;

        // Make sure that hidden reasoning headers are collapsed by default, to not show a useless edit button
        if (this.state === ReasoningState.Hidden) {
            this.messageReasoningDetailsDom.open = false;
        }

        // Update the reasoning duration in the UI
        this.#updateReasoningTimeUI();
    }

    /**
     * Finds and caches reasoning-related DOM elements for the given message.
     *
     * @param {number} messageId - The ID of the message to cache the DOM elements for
     */
    #checkDomElements(messageId) {
        // Make sure we reset dom elements if we are checking for a different message (shouldn't happen, but be sure)
        if (this.messageDom !== null && this.messageDom.getAttribute('mesid') !== messageId.toString()) {
            this.messageDom = null;
        }

        // Cache the DOM elements once
        if (this.messageDom === null) {
            this.messageDom = document.querySelector(`#chat .mes[mesid="${messageId}"]`);
            if (this.messageDom === null) throw new Error('message dom does not exist');
        }
        if (this.messageReasoningDetailsDom === null) {
            this.messageReasoningDetailsDom = this.messageDom.querySelector('.mes_reasoning_details');
        }
        if (this.messageReasoningContentDom === null) {
            this.messageReasoningContentDom = this.messageDom.querySelector('.mes_reasoning');
        }
        if (this.messageReasoningHeaderDom === null) {
            this.messageReasoningHeaderDom = this.messageDom.querySelector('.mes_reasoning_header_title');
        }
    }

    /**
     * Updates the reasoning time display in the UI.
     *
     * Shows the duration in a human-readable format with a tooltip for exact seconds.
     * Displays "Thinking..." if still processing, or a generic message otherwise.
     */
    #updateReasoningTimeUI() {
        const element = this.messageReasoningHeaderDom;
        const duration = this.getDuration();
        let data = null;
        if (duration) {
            const durationStr = moment.duration(duration).locale(getCurrentLocale()).humanize({ s: 50, ss: 3 });
            const secondsStr = moment.duration(duration).asSeconds();

            const span = document.createElement('span');
            span.title = t`${secondsStr} seconds`;
            span.textContent = durationStr;

            element.textContent = t`Thought for `;
            element.appendChild(span);
            data = String(secondsStr);
        } else if ([ReasoningState.Done, ReasoningState.Hidden].includes(this.state)) {
            element.textContent = t`Thought for some time`;
            data = 'unknown';
        } else {
            element.textContent = t`Thinking...`;
            data = null;
        }

        setDatasetProperty(this.messageReasoningDetailsDom, 'duration', data);
        setDatasetProperty(element, 'duration', data);
    }
}

/**
 * Helper class for adding reasoning to messages.
 * Keeps track of the number of reasoning additions.
 */
export class PromptReasoning {
    static REASONING_PLACEHOLDER = '\u200B';

    constructor() {
        this.counter = 0;
    }

    /**
     * Checks if the limit of reasoning additions has been reached.
     * @returns {boolean} True if the limit of reasoning additions has been reached, false otherwise.
     */
    isLimitReached() {
        if (!power_user.reasoning.add_to_prompts) {
            return true;
        }

        return this.counter >= power_user.reasoning.max_additions;
    }

    /**
     * Add reasoning to a message according to the power user settings.
     * @param {string} content Message content
     * @param {string} reasoning Message reasoning
     * @param {boolean} isPrefix Whether this is the last message prefix
     * @returns {string} Message content with reasoning
     */
    addToMessage(content, reasoning, isPrefix) {
        // Disabled or reached limit of additions
        if (!isPrefix && (!power_user.reasoning.add_to_prompts || this.counter >= power_user.reasoning.max_additions)) {
            return content;
        }

        // No reasoning provided or a legacy placeholder
        if (!reasoning || reasoning === PromptReasoning.REASONING_PLACEHOLDER) {
            return content;
        }

        // Increment the counter
        this.counter++;

        // Substitute macros in variable parts
        const prefix = substituteParams(power_user.reasoning.prefix || '');
        const separator = substituteParams(power_user.reasoning.separator || '');
        const suffix = substituteParams(power_user.reasoning.suffix || '');

        // Combine parts with reasoning only
        if (isPrefix && !content) {
            return `${prefix}${reasoning}`;
        }

        // Combine parts with reasoning and content
        return `${prefix}${reasoning}${suffix}${separator}${content}`;
    }
}

function loadReasoningSettings() {
    $('#reasoning_add_to_prompts').prop('checked', power_user.reasoning.add_to_prompts);
    $('#reasoning_add_to_prompts').on('change', function () {
        power_user.reasoning.add_to_prompts = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#reasoning_prefix').val(power_user.reasoning.prefix);
    $('#reasoning_prefix').on('input', function () {
        power_user.reasoning.prefix = String($(this).val());
        saveSettingsDebounced();
    });

    $('#reasoning_suffix').val(power_user.reasoning.suffix);
    $('#reasoning_suffix').on('input', function () {
        power_user.reasoning.suffix = String($(this).val());
        saveSettingsDebounced();
    });

    $('#reasoning_separator').val(power_user.reasoning.separator);
    $('#reasoning_separator').on('input', function () {
        power_user.reasoning.separator = String($(this).val());
        saveSettingsDebounced();
    });

    $('#reasoning_max_additions').val(power_user.reasoning.max_additions);
    $('#reasoning_max_additions').on('input', function () {
        power_user.reasoning.max_additions = Number($(this).val());
        saveSettingsDebounced();
    });

    $('#reasoning_auto_parse').prop('checked', power_user.reasoning.auto_parse);
    $('#reasoning_auto_parse').on('change', function () {
        power_user.reasoning.auto_parse = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#reasoning_auto_expand').prop('checked', power_user.reasoning.auto_expand);
    $('#reasoning_auto_expand').on('change', function () {
        power_user.reasoning.auto_expand = !!$(this).prop('checked');
        toggleReasoningAutoExpand();
        saveSettingsDebounced();
    });
    toggleReasoningAutoExpand();

    $('#reasoning_show_hidden').prop('checked', power_user.reasoning.show_hidden);
    $('#reasoning_show_hidden').on('change', function () {
        power_user.reasoning.show_hidden = !!$(this).prop('checked');
        $('#chat').attr('data-show-hidden-reasoning', power_user.reasoning.show_hidden ? 'true' : null);
        saveSettingsDebounced();
    });
    $('#chat').attr('data-show-hidden-reasoning', power_user.reasoning.show_hidden ? 'true' : null);
}

function registerReasoningSlashCommands() {
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'reasoning-get',
        aliases: ['get-reasoning'],
        returns: ARGUMENT_TYPE.STRING,
        helpString: t`Get the contents of a reasoning block of a message. Returns an empty string if the message does not have a reasoning block.`,
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Message ID. If not provided, the message ID of the last message is used.',
                typeList: ARGUMENT_TYPE.NUMBER,
                enumProvider: commonEnumProviders.messages(),
            }),
        ],
        callback: (_args, value) => {
            const messageId = !isNaN(parseInt(value.toString())) ? parseInt(value.toString()) : chat.length - 1;
            const message = chat[messageId];
            const reasoning = String(message?.extra?.reasoning ?? '');
            return reasoning;
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'reasoning-set',
        aliases: ['set-reasoning'],
        returns: ARGUMENT_TYPE.STRING,
        helpString: t`Set the reasoning block of a message. Returns the reasoning block content.`,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'at',
                description: 'Message ID. If not provided, the message ID of the last message is used.',
                typeList: ARGUMENT_TYPE.NUMBER,
                enumProvider: commonEnumProviders.messages(),
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Reasoning block content.',
                typeList: ARGUMENT_TYPE.STRING,
            }),
        ],
        callback: async (args, value) => {
            const messageId = !isNaN(Number(args.at)) ? Number(args.at) : chat.length - 1;
            const message = chat[messageId];
            if (!message?.extra) {
                return '';
            }

            message.extra.reasoning = String(value ?? '');
            await saveChatConditional();

            closeMessageEditor('reasoning');
            updateMessageBlock(messageId, message);
            return message.extra.reasoning;
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'reasoning-parse',
        aliases: ['parse-reasoning'],
        returns: 'reasoning string',
        helpString: t`Extracts the reasoning block from a string using the Reasoning Formatting settings.`,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'regex',
                description: 'Whether to apply regex scripts to the reasoning content.',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'true',
                isRequired: false,
                enumProvider: commonEnumProviders.boolean('trueFalse'),
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'input string',
                typeList: [ARGUMENT_TYPE.STRING],
            }),
        ],
        callback: (args, value) => {
            if (!value) {
                return '';
            }

            if (!power_user.reasoning.prefix || !power_user.reasoning.suffix) {
                toastr.warning(t`Both prefix and suffix must be set in the Reasoning Formatting settings.`);
                return String(value);
            }

            const parsedReasoning = parseReasoningFromString(String(value));

            if (!parsedReasoning) {
                return '';
            }

            const applyRegex = !isFalseBoolean(String(args.regex ?? ''));
            return applyRegex
                ? getRegexedString(parsedReasoning.reasoning, regex_placement.REASONING)
                : parsedReasoning.reasoning;
        },
    }));
}

function registerReasoningMacros() {
    MacrosParser.registerMacro('reasoningPrefix', () => power_user.reasoning.prefix, t`Reasoning Prefix`);
    MacrosParser.registerMacro('reasoningSuffix', () => power_user.reasoning.suffix, t`Reasoning Suffix`);
    MacrosParser.registerMacro('reasoningSeparator', () => power_user.reasoning.separator, t`Reasoning Separator`);
}

function setReasoningEventHandlers() {
    $(document).on('click', '.mes_reasoning_details', function (e) {
        if (!e.target.closest('.mes_reasoning_actions') && !e.target.closest('.mes_reasoning_header')) {
            e.preventDefault();
        }
    });

    $(document).on('click', '.mes_reasoning_header', function (e) {
        const details = $(this).closest('.mes_reasoning_details');
        // Along with the CSS rules to mark blocks not toggle-able when they are empty, prevent them from actually being toggled, or being edited
        if (details.find('.mes_reasoning').is(':empty')) {
            e.preventDefault();
            return;
        }

        // If we are in message edit mode and reasoning area is closed, a click opens and edits it
        const mes = $(this).closest('.mes');
        const mesEditArea = mes.find('#curEditTextarea');
        if (mesEditArea.length) {
            const summary = $(mes).find('.mes_reasoning_summary');
            if (!summary.attr('open')) {
                summary.find('.mes_reasoning_edit').trigger('click');
            }
        }
    });

    $(document).on('click', '.mes_reasoning_copy', (e) => {
        e.stopPropagation();
        e.preventDefault();
    });

    $(document).on('click', '.mes_reasoning_edit', function (e) {
        e.stopPropagation();
        e.preventDefault();
        const { message, messageBlock } = getMessageFromJquery(this);
        if (!message?.extra) {
            return;
        }

        const reasoning = String(message?.extra?.reasoning ?? '');
        const chatElement = document.getElementById('chat');
        const textarea = document.createElement('textarea');
        const reasoningBlock = messageBlock.find('.mes_reasoning');
        textarea.classList.add('reasoning_edit_textarea');
        textarea.value = reasoning;
        $(textarea).insertBefore(reasoningBlock);

        if (!CSS.supports('field-sizing', 'content')) {
            const resetHeight = function () {
                const scrollTop = chatElement.scrollTop;
                textarea.style.height = '0px';
                textarea.style.height = `${textarea.scrollHeight}px`;
                chatElement.scrollTop = scrollTop;
            };

            textarea.addEventListener('input', resetHeight);
            resetHeight();
        }

        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);

        const textareaRect = textarea.getBoundingClientRect();
        const chatRect = chatElement.getBoundingClientRect();

        // Scroll if textarea bottom is below visible area
        if (textareaRect.bottom > chatRect.bottom) {
            const scrollOffset = textareaRect.bottom - chatRect.bottom;
            chatElement.scrollTop += scrollOffset;
        }
    });

    $(document).on('click', '.mes_reasoning_edit_done', async function (e) {
        e.stopPropagation();
        e.preventDefault();
        const { message, messageId, messageBlock } = getMessageFromJquery(this);
        if (!message?.extra) {
            return;
        }

        const textarea = messageBlock.find('.reasoning_edit_textarea');
        const reasoning = getRegexedString(String(textarea.val()), regex_placement.REASONING, { isEdit: true });
        message.extra.reasoning = reasoning;
        await saveChatConditional();
        updateMessageBlock(messageId, message);
        textarea.remove();

        messageBlock.find('.mes_edit_done:visible').trigger('click');
    });

    $(document).on('click', '.mes_reasoning_edit_cancel', function (e) {
        e.stopPropagation();
        e.preventDefault();

        const { messageBlock } = getMessageFromJquery(this);
        const textarea = messageBlock.find('.reasoning_edit_textarea');
        textarea.remove();

        messageBlock.find('.mes_reasoning_edit_cancel:visible').trigger('click');

        updateReasoningUI(messageBlock);
    });

    $(document).on('click', '.mes_edit_add_reasoning', async function () {
        const { message, messageBlock } = getMessageFromJquery(this);
        if (!message?.extra) {
            return;
        }

        if (message.extra.reasoning) {
            toastr.info(t`Reasoning already exists.`, t`Edit Message`);
            return;
        }

        messageBlock.addClass('reasoning');

        // To make hidden reasoning blocks editable, we just set them to "Done" here already.
        // They will be done on save anyway - and on cancel the reasoning block gets rerendered too.
        if (messageBlock.attr('data-reasoning-state') === ReasoningState.Hidden) {
            messageBlock.attr('data-reasoning-state', ReasoningState.Done);
        }

        // Open the reasoning area so we can actually edit it
        messageBlock.find('.mes_reasoning_details').attr('open', '');
        messageBlock.find('.mes_reasoning_edit').trigger('click');
        await saveChatConditional();
    });

    $(document).on('click', '.mes_reasoning_delete', async function (e) {
        e.stopPropagation();
        e.preventDefault();

        const confirm = await Popup.show.confirm(t`Remove Reasoning`, t`Are you sure you want to clear the reasoning?<br />Visible message contents will stay intact.`);

        if (!confirm) {
            return;
        }

        const { message, messageId, messageBlock } = getMessageFromJquery(this);
        if (!message?.extra) {
            return;
        }
        message.extra.reasoning = '';
        await saveChatConditional();
        updateMessageBlock(messageId, message);
        const textarea = messageBlock.find('.reasoning_edit_textarea');
        textarea.remove();
    });

    $(document).on('pointerup', '.mes_reasoning_copy', async function () {
        const { message } = getMessageFromJquery(this);
        const reasoning = String(message?.extra?.reasoning ?? '');

        if (!reasoning) {
            return;
        }

        await copyText(reasoning);
        toastr.info(t`Copied!`, '', { timeOut: 2000 });
    });
}

/**
 * Removes reasoning from a string if auto-parsing is enabled.
 * @param {string} str Input string
 * @returns {string} Output string
 */
export function removeReasoningFromString(str) {
    if (!power_user.reasoning.auto_parse) {
        return str;
    }

    const parsedReasoning = parseReasoningFromString(str);
    return parsedReasoning?.content ?? str;
}

/**
 * Parses reasoning from a string using the power user reasoning settings.
 * @typedef {Object} ParsedReasoning
 * @property {string} reasoning Reasoning block
 * @property {string} content Message content
 * @param {string} str Content of the message
 * @returns {ParsedReasoning|null} Parsed reasoning block and message content
 */
function parseReasoningFromString(str) {
    // Both prefix and suffix must be defined
    if (!power_user.reasoning.prefix || !power_user.reasoning.suffix) {
        return null;
    }

    try {
        const regex = new RegExp(`${escapeRegex(power_user.reasoning.prefix)}(.*?)${escapeRegex(power_user.reasoning.suffix)}`, 's');

        let didReplace = false;
        let reasoning = '';
        let content = String(str).replace(regex, (_match, captureGroup) => {
            didReplace = true;
            reasoning = captureGroup;
            return '';
        });

        if (didReplace && power_user.trim_spaces) {
            reasoning = reasoning.trim();
            content = content.trim();
        }

        return { reasoning, content };
    } catch (error) {
        console.error('[Reasoning] Error parsing reasoning block', error);
        return null;
    }
}

function registerReasoningAppEvents() {
    eventSource.makeFirst(event_types.MESSAGE_RECEIVED, (/** @type {number} */ idx) => {
        if (!power_user.reasoning.auto_parse) {
            return;
        }

        console.debug('[Reasoning] Auto-parsing reasoning block for message', idx);
        const message = chat[idx];

        if (!message) {
            console.warn('[Reasoning] Message not found', idx);
            return null;
        }

        if (!message.mes || message.mes === '...') {
            console.debug('[Reasoning] Message content is empty or a placeholder', idx);
            return null;
        }

        const parsedReasoning = parseReasoningFromString(message.mes);

        // No reasoning block found
        if (!parsedReasoning) {
            return;
        }

        // Make sure the message has an extra object
        if (!message.extra || typeof message.extra !== 'object') {
            message.extra = {};
        }

        const contentUpdated = !!parsedReasoning.reasoning || parsedReasoning.content !== message.mes;

        // If reasoning was found, add it to the message
        if (parsedReasoning.reasoning) {
            message.extra.reasoning = getRegexedString(parsedReasoning.reasoning, regex_placement.REASONING);
        }

        // Update the message text if it was changed
        if (parsedReasoning.content !== message.mes) {
            message.mes = parsedReasoning.content;
        }

        // Find if a message already exists in DOM and must be updated
        if (contentUpdated) {
            const messageRendered = document.querySelector(`.mes[mesid="${idx}"]`) !== null;
            if (messageRendered) {
                console.debug('[Reasoning] Updating message block', idx);
                updateMessageBlock(idx, message);
            }
        }
    });
}

export function initReasoning() {
    loadReasoningSettings();
    setReasoningEventHandlers();
    registerReasoningSlashCommands();
    registerReasoningMacros();
    registerReasoningAppEvents();
}
