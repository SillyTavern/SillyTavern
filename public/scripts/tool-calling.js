import { DOMPurify } from '../lib.js';
import { power_user } from './power-user.js';

import {
    addOneMessage,
    chat,
    chat_metadata,
    event_types,
    eventSource,
    getCurrentSandboxCharacterName,
    getCurrentSandboxWorkspace,
    getDefaultSandboxWorkspace,
    main_api,
    getRequestHeaders,
    saveChatConditional,
    saveSettingsDebounced,
    SANDBOX_ROOT_WORKSPACE,
    system_avatar,
    systemUserName,
    user_avatar,
} from '../script.js';
import { chat_completion_sources, custom_prompt_post_processing_types, getChatCompletionModel, model_list, oai_settings } from './openai.js';
import { Popup } from './popup.js';
import { autoFitSendTextAreaDebounced } from './RossAscends-mods.js';
import { SlashCommand } from './slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from './slash-commands/SlashCommandArgument.js';
import { SlashCommandClosure } from './slash-commands/SlashCommandClosure.js';
import { enumIcons } from './slash-commands/SlashCommandCommonEnumsProvider.js';
import { enumTypes, SlashCommandEnumValue } from './slash-commands/SlashCommandEnumValue.js';
import { SlashCommandParser } from './slash-commands/SlashCommandParser.js';
import { slashCommandReturnHelper } from './slash-commands/SlashCommandReturnHelper.js';
import { getSanitizedFilename, isTrueBoolean } from './utils.js';
import { setPersonaDescription } from './personas.js';

/**
 * @typedef {object} ToolInvocation
 * @property {string} id - A unique identifier for the tool invocation.
 * @property {string} displayName - The display name of the tool.
 * @property {string} name - The name of the tool.
 * @property {string} parameters - The parameters for the tool invocation.
 * @property {string} result - The result of the tool invocation.
 * @property {string?} signature - The thought signature associated with the tool invocation.
 * @property {string?} reasoning - The plaintext reasoning associated with this tool call turn.
 * @property {boolean} [error] - Whether the tool invocation failed.
 */

/**
 * @typedef {object} ToolInvocationResult
 * @property {ToolInvocation[]} invocations Tool invocations (both successful and failed)
 * @property {Error[]} errors Errors that occurred during tool invocation
 * @property {string[]} stealthCalls Names of stealth tools that were invoked
 */

/**
 * @typedef {object} ToolRegistration
 * @property {string} name - The name of the tool.
 * @property {string} displayName - The display name of the tool.
 * @property {string} description - A description of the tool.
 * @property {object} parameters - The parameters for the tool.
 * @property {function} action - The action to perform when the tool is invoked.
 * @property {function} [formatMessage] - A function to format the tool call message.
 * @property {function} [shouldRegister] - A function to determine if the tool should be registered.
 * @property {boolean} [stealth] - A tool call result will not be shown in the chat. No follow-up generation will be performed.
 */

/**
 * @typedef {object} ToolDefinitionOpenAI
 * @property {string} type - The type of the tool.
 * @property {object} function - The function definition.
 * @property {string} function.name - The name of the function.
 * @property {string} function.description - The description of the function.
 * @property {object} function.parameters - The parameters of the function.
 * @property {function} toString - A function to convert the tool to a string.
 */

/**
 * Assigns nested variables to a scope.
 * @param {import('./slash-commands/SlashCommandScope.js').SlashCommandScope} scope The scope to assign variables to.
 * @param {object} arg Object to assign variables from.
 * @param {string} prefix Prefix for the variable names.
 */
function assignNestedVariables(scope, arg, prefix) {
    Object.entries(arg).forEach(([key, value]) => {
        const newPrefix = `${prefix}.${key}`;
        if (typeof value === 'object' && value !== null) {
            if (Array.isArray(value)) {
                scope.letVariable(newPrefix, JSON.stringify(value));
            }
            assignNestedVariables(scope, value, newPrefix);
        } else {
            scope.letVariable(newPrefix, value);
        }
    });
}

/**
 * Checks if a string is a valid JSON string.
 * @param {string} str The string to check
 * @returns {boolean} If the string is a valid JSON string
 */
function isJson(str) {
    try {
        JSON.parse(str);
        return true;
    } catch {
        return false;
    }
}

/**
 * Tries to parse a string as JSON, returning the original string if parsing fails.
 * @param {string} str The string to try to parse
 * @returns {object|string} Parsed JSON or the original string
 */
function tryParse(str) {
    try {
        return JSON.parse(str);
    } catch {
        return str;
    }
}

/**
 * Wraps a promise with a timeout. If the promise doesn't resolve within the timeout,
 * returns a timeout result instead of waiting forever.
 * @param {Promise} promise The promise to wrap
 * @param {number} timeoutMs The timeout in milliseconds
 * @param {string} timeoutMessage The message to return on timeout
 * @returns {Promise} The result of the promise or the timeout message
 */
function withTimeout(promise, timeoutMs, timeoutMessage) {
    return Promise.race([
        promise,
        new Promise((resolve) => {
            setTimeout(() => {
                resolve(timeoutMessage);
            }, timeoutMs);
        }),
    ]);
}

/**
 * Stringifies an object if it is not already a string.
 * @param {any} obj The object to stringify
 * @returns {string} A JSON string representation of the object.
 */
function stringify(obj) {
    return typeof obj === 'string' ? obj : JSON.stringify(obj);
}

const LIST_DIRECTORY_CONTEXT_TIMEOUT_MS = 3000;
const LIST_DIRECTORY_CONTEXT_TIMEOUT_RESULT = '__list_directory_context_timeout__';
const LIST_DIRECTORY_CONTEXT_MAX_CHARS = 4000;
const NEW_WORKSPACE_OPTION = '__new_workspace__';
const WORKSPACE_SEPARATOR_OPTION = '__workspace_separator__';
let lastBrowserSessionId = '';
let lastBrowserTabIndex = null;
const ASK_USER_MAX_QUESTIONS = 4;
const ASK_USER_MAX_OPTIONS = 4;
const ASK_USER_DEFAULT_FREE_FIELD_LABEL = 'Something else';
const ASK_USER_DEFAULT_PLACEHOLDER = 'Something else';
let askUserPanelInitialized = false;
let askUserSession = null;

/**
 * A class that represents a tool definition.
 */
class ToolDefinition {
    /**
     * A unique name for the tool.
     * @type {string}
     */
    #name;

    /**
     * A user-friendly display name for the tool.
     * @type {string}
     */
    #displayName;

    /**
     * A description of what the tool does.
     * @type {string}
     */
    #description;

    /**
     * A JSON schema for the parameters that the tool accepts.
     * @type {object}
     */
    #parameters;

    /**
     * A function that will be called when the tool is executed.
     * @type {function}
     */
    #action;

    /**
     * A function that will be called to format the tool call toast.
     * @type {function}
     */
    #formatMessage;

    /**
     * A function that will be called to determine if the tool should be registered.
     * @type {function}
     */
    #shouldRegister;

    /**
     * A tool call result will not be shown in the chat. No follow-up generation will be performed.
     * @type {boolean}
     */
    #stealth;

    /**
     * Creates a new ToolDefinition.
     * @param {string} name A unique name for the tool.
     * @param {string} displayName A user-friendly display name for the tool.
     * @param {string} description A description of what the tool does.
     * @param {object} parameters A JSON schema for the parameters that the tool accepts.
     * @param {function} action A function that will be called when the tool is executed.
     * @param {function} formatMessage A function that will be called to format the tool call toast.
     * @param {function} shouldRegister A function that will be called to determine if the tool should be registered.
     * @param {boolean} stealth A tool call result will not be shown in the chat. No follow-up generation will be performed.
     */
    constructor(name, displayName, description, parameters, action, formatMessage, shouldRegister, stealth) {
        this.#name = name;
        this.#displayName = displayName;
        this.#description = description;
        this.#parameters = parameters;
        this.#action = action;
        this.#formatMessage = formatMessage;
        this.#shouldRegister = shouldRegister;
        this.#stealth = stealth;
    }

    /**
     * Converts the ToolDefinition to an OpenAI API representation
     * @returns {ToolDefinitionOpenAI} OpenAI API representation of the tool.
     */
    toFunctionOpenAI() {
        return {
            type: 'function',
            function: {
                name: this.#name,
                description: this.#description,
                parameters: this.#parameters,
            },
            toString: function () {
                return `<div><b>${this.function.name}</b></div><div><small>${this.function.description}</small></div><pre class="justifyLeft wordBreakAll"><code class="flex padding5">${JSON.stringify(this.function.parameters, null, 2)}</code></pre><hr>`;
            },
        };
    }

    /**
     * Invokes the tool with the given parameters.
     * @param {object} parameters The parameters to pass to the tool.
     * @param {AbortSignal} signal The AbortSignal to use for cancellation.
     * @returns {Promise<any>} The result of the tool's action function.
     */
    async invoke(parameters, signal) {
        return await this.#action(parameters, signal);
    }

    /**
     * Formats a message with the tool invocation.
     * @param {object} parameters The parameters to pass to the tool.
     * @returns {Promise<string>} The formatted message.
     */
    async formatMessage(parameters) {
        return typeof this.#formatMessage === 'function'
            ? await this.#formatMessage(parameters)
            : `Invoking tool: ${this.#displayName || this.#name}`;
    }

    async shouldRegister() {
        return typeof this.#shouldRegister === 'function'
            ? await this.#shouldRegister()
            : true;
    }

    get displayName() {
        return this.#displayName;
    }

    get stealth() {
        return this.#stealth;
    }
}

function getSandboxRequestContext() {
    return {
        workspace: getCurrentSandboxWorkspace(),
        character: getCurrentSandboxCharacterName(),
    };
}

/**
 * Calls a browser tool endpoint.
 * @param {string} action Browser action name.
 * @param {object} payload Request payload.
 * @param {AbortSignal} [signal] Abort signal.
 * @returns {Promise<any|string>} Parsed response or error string.
 */
async function callBrowserTool(action, payload = {}, signal) {
    try {
        const sandbox = getSandboxRequestContext();
        const requestedSessionId = String(payload?.session_id ?? '').trim();
        const usedImplicitSession = !requestedSessionId && Boolean(lastBrowserSessionId);
        const buildRequestBody = () => {
            const body = { ...payload, ...sandbox };
            if (!body.session_id) {
                body.session_id = lastBrowserSessionId;
            }
            if ((body.tab_index === null || typeof body.tab_index === 'undefined' || body.tab_index === '') && lastBrowserTabIndex !== null) {
                body.tab_index = lastBrowserTabIndex;
            }
            return body;
        };
        const sendRequest = async (body) => {
            const response = await fetch(`/api/extensions/tools/browser/${action}`, {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify(body),
                signal,
            });
            const result = await response.json().catch(() => ({}));
            return { response, result };
        };

        let body = buildRequestBody();
        let { response, result } = await sendRequest(body);
        if (!response.ok) {
            const browserSessionError = String(result?.error ?? '');
            const staleImplicitSession = usedImplicitSession
                && body.session_id
                && body.session_id === lastBrowserSessionId
                && (browserSessionError.includes('No browser session found')
                    || browserSessionError.includes('has already been closed'));
            const canRetryFreshSession = staleImplicitSession && (action === 'open' || action === 'search');

            if (staleImplicitSession) {
                lastBrowserSessionId = '';
                lastBrowserTabIndex = null;
            }

            if (canRetryFreshSession) {
                body = buildRequestBody();
                ({ response, result } = await sendRequest(body));
            }

            if (!response.ok) {
                return `Error: ${result?.error || 'An unknown browser error occurred.'}`;
            }
        }

        if (action === 'close') {
            if (!body.session_id || body.session_id === lastBrowserSessionId || result?.session_id === lastBrowserSessionId) {
                lastBrowserSessionId = '';
                lastBrowserTabIndex = null;
            }
            return result;
        }

        if (typeof result?.session_id === 'string' && result.session_id) {
            lastBrowserSessionId = result.session_id;
        }
        if (typeof result?.tab_index === 'number') {
            lastBrowserTabIndex = result.tab_index;
        } else if (typeof result?.active_tab_index === 'number') {
            lastBrowserTabIndex = result.active_tab_index;
        }

        return result;
    } catch (error) {
        if (error?.name === 'AbortError') {
            return 'Browser action was cancelled by the user.';
        }

        return `Error: Could not connect to the browser tool server. ${error.message}`;
    }
}

/**
 * Adds image display metadata for browser screenshots returned by backend actions.
 * @param {any} result Browser tool result.
 * @returns {any}
 */
function augmentBrowserToolResult(result) {
    if (!result || typeof result !== 'object') {
        return result;
    }

    const imageExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg'];
    const filepath = String(result.filepath ?? '').trim().toLowerCase();
    const mimeType = String(result.mime_type ?? '').trim().toLowerCase();
    const isDownloadedImage = !result.type && filepath && (mimeType.startsWith('image/') || imageExtensions.some(ext => filepath.endsWith(ext)));

    if (result.screenshot_filepath && !result.screenshot) {
        result.screenshot = {
            type: 'image_display',
            filepath: result.screenshot_filepath,
            title: 'Result page after click',
            ...getSandboxRequestContext(),
        };
    }

    if (result.opened_tab_screenshot_filepath && !result.opened_tab_screenshot) {
        result.opened_tab_screenshot = {
            type: 'image_display',
            filepath: result.opened_tab_screenshot_filepath,
            title: 'Opened tab',
            ...getSandboxRequestContext(),
        };
    }

    if (result.pre_click_screenshot_filepath && !result.pre_click_screenshot) {
        result.pre_click_screenshot = {
            type: 'image_display',
            filepath: result.pre_click_screenshot_filepath,
            title: 'Clicked location before click',
            ...getSandboxRequestContext(),
        };
    }

    if (isDownloadedImage && !result.downloaded_file) {
        result.downloaded_file = {
            type: 'image_display',
            filepath: result.filepath,
            ...getSandboxRequestContext(),
        };
    }

    return result;
}

function getAskUserPanelElements() {
    const sendForm = document.getElementById('send_form');
    const panel = document.getElementById('ask_user_panel');
    const title = document.getElementById('ask_user_title');
    const context = document.getElementById('ask_user_context');
    const counter = document.getElementById('ask_user_counter');
    const prevButton = document.getElementById('ask_user_prev');
    const nextButton = document.getElementById('ask_user_next');
    const options = document.getElementById('ask_user_options');
    const dismissButton = document.getElementById('ask_user_dismiss');
    const continueButton = document.getElementById('ask_user_continue');

    if (!(sendForm instanceof HTMLDivElement)
        || !(panel instanceof HTMLDivElement)
        || !(title instanceof HTMLDivElement)
        || !(context instanceof HTMLDivElement)
        || !(counter instanceof HTMLDivElement)
        || !(prevButton instanceof HTMLButtonElement)
        || !(nextButton instanceof HTMLButtonElement)
        || !(options instanceof HTMLDivElement)
        || !(dismissButton instanceof HTMLButtonElement)
        || !(continueButton instanceof HTMLButtonElement)) {
        return null;
    }

    return {
        sendForm,
        panel,
        title,
        context,
        counter,
        prevButton,
        nextButton,
        options,
        dismissButton,
        continueButton,
    };
}

function syncAskUserPanelLayout() {
    autoFitSendTextAreaDebounced();
}

function autoFitAskUserFreeInput(input) {
    if (!(input instanceof HTMLTextAreaElement)) {
        return;
    }

    input.style.height = '0px';
    input.style.height = `${input.scrollHeight}px`;
}

function initAskUserPanel() {
    if (askUserPanelInitialized) {
        return true;
    }

    const elements = getAskUserPanelElements();
    if (!elements) {
        return false;
    }

    elements.prevButton.addEventListener('click', () => {
        if (!askUserSession || askUserSession.currentIndex <= 0) {
            return;
        }

        askUserSession.currentIndex -= 1;
        renderAskUserPanel();
    });

    elements.nextButton.addEventListener('click', () => {
        if (!askUserSession || askUserSession.currentIndex >= askUserSession.questionnaire.questions.length - 1) {
            return;
        }

        askUserSession.currentIndex += 1;
        renderAskUserPanel();
    });

    elements.dismissButton.addEventListener('click', () => finishAskUserSession('dismissed'));
    elements.continueButton.addEventListener('click', () => {
        if (!askUserSession) {
            return;
        }

        if (askUserSession.currentIndex < askUserSession.questionnaire.questions.length - 1) {
            askUserSession.currentIndex += 1;
            renderAskUserPanel();
            return;
        }

        finishAskUserSession('completed');
    });

    document.addEventListener('keydown', (event) => {
        if (!askUserSession) {
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            finishAskUserSession('dismissed');
            return;
        }

        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            event.stopPropagation();

            if (askUserSession.currentIndex < askUserSession.questionnaire.questions.length - 1) {
                askUserSession.currentIndex += 1;
                renderAskUserPanel();
            } else {
                finishAskUserSession('completed');
            }
        }
    });

    askUserPanelInitialized = true;
    return true;
}

function normalizeAskUserOption(option, questionIndex, optionIndex) {
    if (typeof option === 'string') {
        const label = option.trim();
        if (!label) {
            throw new Error(`Question ${questionIndex + 1} option ${optionIndex + 1} must not be empty.`);
        }

        return { label, value: label, selected: false };
    }

    if (typeof option === 'object' && option !== null) {
        const label = String(option.label ?? option.text ?? option.value ?? '').trim();
        const value = String(option.value ?? label).trim();

        if (!label || !value) {
            throw new Error(`Question ${questionIndex + 1} option ${optionIndex + 1} must include a label.`);
        }

        return {
            label,
            value,
            selected: option.selected === true,
        };
    }

    throw new Error(`Question ${questionIndex + 1} option ${optionIndex + 1} must be a string or object.`);
}

function normalizeAskUserStringArray(value) {
    return Array.isArray(value)
        ? value.map(item => String(item ?? '').trim()).filter(Boolean)
        : [];
}

function normalizeAskUserQuestion(question, questionIndex) {
    if (typeof question !== 'object' || question === null) {
        throw new Error(`Question ${questionIndex + 1} must be an object.`);
    }

    const prompt = String(question.prompt ?? question.question ?? '').trim();
    if (!prompt) {
        throw new Error(`Question ${questionIndex + 1} must include a prompt.`);
    }

    const context = String(question.context ?? question.helper_text ?? question.description ?? '').trim();
    if (!context) {
        throw new Error(`Question ${questionIndex + 1} must include context.`);
    }

    const rawOptions = Array.isArray(question.options) ? question.options : [];
    if (rawOptions.length === 0) {
        throw new Error(`Question ${questionIndex + 1} must include at least one option.`);
    }
    if (rawOptions.length > ASK_USER_MAX_OPTIONS) {
        throw new Error(`Question ${questionIndex + 1} has too many options. Max is ${ASK_USER_MAX_OPTIONS}.`);
    }

    const options = rawOptions.map((option, optionIndex) => normalizeAskUserOption(option, questionIndex, optionIndex));
    const defaultSelected = new Set(normalizeAskUserStringArray(question.default_selected));
    const selectedValues = Array.from(new Set(options
        .filter(option => option.selected || defaultSelected.has(option.value) || defaultSelected.has(option.label))
        .map(option => option.value)));

    return {
        prompt,
        context,
        options,
        defaultSelected: selectedValues,
        defaultText: String(question.default_answer ?? question.default_text ?? '').trim(),
        placeholder: String(question.placeholder ?? '').trim(),
        freeFieldLabel: String(question.free_field_label ?? '').trim(),
        multiline: question.multiline === true,
    };
}

function normalizeAskUserPayload(payload) {
    if (typeof payload !== 'object' || payload === null) {
        throw new Error('ask_user payload must be an object.');
    }

    const rawQuestions = Array.isArray(payload.questions)
        ? payload.questions
        : [{
            prompt: payload.question,
            context: payload.context,
            options: payload.options,
            default_answer: payload.default_answer,
            placeholder: payload.placeholder,
            multiline: payload.multiline,
        }];

    if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
        throw new Error('ask_user requires at least one question.');
    }

    if (rawQuestions.length > ASK_USER_MAX_QUESTIONS) {
        throw new Error(`ask_user supports a maximum of ${ASK_USER_MAX_QUESTIONS} questions.`);
    }

    return {
        questions: rawQuestions.map((question, questionIndex) => normalizeAskUserQuestion(question, questionIndex)),
    };
}

function renderAskUserPanel() {
    if (!askUserSession) {
        return;
    }

    const { elements, questionnaire, currentIndex, answers } = askUserSession;
    const question = questionnaire.questions[currentIndex];
    const answer = answers[currentIndex];
    const submitCurrentQuestion = () => {
        if (!askUserSession) {
            return;
        }

        if (askUserSession.currentIndex < askUserSession.questionnaire.questions.length - 1) {
            askUserSession.currentIndex += 1;
            renderAskUserPanel();
            return;
        }

        finishAskUserSession('completed');
    };

    elements.title.textContent = question.prompt;
    elements.context.textContent = question.context;
    elements.context.hidden = !question.context;
    elements.counter.textContent = `${currentIndex + 1} of ${questionnaire.questions.length}`;
    elements.prevButton.disabled = currentIndex === 0;
    elements.nextButton.disabled = currentIndex >= questionnaire.questions.length - 1;
    elements.options.replaceChildren();

    question.options.forEach((option, optionIndex) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'ask_user_option_row';
        const isSelected = answer.selectedOptions.includes(option.value);
        button.classList.toggle('is-selected', isSelected);
        button.setAttribute('aria-pressed', String(isSelected));

        const index = document.createElement('span');
        index.className = 'ask_user_option_index';
        index.textContent = `${optionIndex + 1}.`;

        const body = document.createElement('span');
        body.className = 'ask_user_option_body';

        const label = document.createElement('span');
        label.className = 'ask_user_option_label';
        label.textContent = option.label;

        const check = document.createElement('i');
        check.className = 'fa-solid fa-check ask_user_option_check';
        check.setAttribute('aria-hidden', 'true');

        body.append(label, check);
        button.append(index, body);
        button.addEventListener('click', () => {
            if (!askUserSession) {
                return;
            }

            const selectedOptions = askUserSession.answers[currentIndex].selectedOptions;
            const valueIndex = selectedOptions.indexOf(option.value);
            const nextSelected = valueIndex === -1;

            if (nextSelected) {
                selectedOptions.push(option.value);
            } else {
                selectedOptions.splice(valueIndex, 1);
            }

            button.classList.toggle('is-selected', nextSelected);
            button.setAttribute('aria-pressed', String(nextSelected));
        });

        elements.options.appendChild(button);
    });

    const freeRow = document.createElement('div');
    freeRow.className = 'ask_user_free_row';

    const freeIndex = document.createElement('span');
    freeIndex.className = 'ask_user_option_index';
    freeIndex.textContent = `${question.options.length + 1}.`;

    const freeBody = document.createElement('div');
    freeBody.className = 'ask_user_free_body';

    const freeInput = question.multiline
        ? document.createElement('textarea')
        : document.createElement('input');
    freeInput.className = 'ask_user_free_input';
    freeInput.placeholder = question.placeholder || question.freeFieldLabel || ASK_USER_DEFAULT_PLACEHOLDER;
    freeInput.setAttribute('aria-label', question.freeFieldLabel || ASK_USER_DEFAULT_FREE_FIELD_LABEL);
    freeInput.value = answer.freeText;
    if (freeInput instanceof HTMLTextAreaElement) {
        freeInput.rows = 3;
    } else {
        freeInput.type = 'text';
    }
    freeInput.addEventListener('input', () => {
        if (!askUserSession) {
            return;
        }

        askUserSession.answers[currentIndex].freeText = freeInput.value;
        autoFitAskUserFreeInput(freeInput);
        syncAskUserPanelLayout();
    });
    freeInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        submitCurrentQuestion();
    });

    freeBody.append(freeInput);
    freeRow.append(freeIndex, freeBody);
    elements.options.appendChild(freeRow);

    autoFitAskUserFreeInput(freeInput);
    syncAskUserPanelLayout();
}

function formatAskUserSessionResult(session, status) {
    if (status !== 'completed') {
        return 'User dismissed the questionnaire.';
    }

    return session.questionnaire.questions.map((question, index) => {
        const answer = session.answers[index];
        const answerParts = [...answer.selectedOptions];

        if (answer.freeText.trim()) {
            answerParts.push(answer.freeText.trim());
        }

        return `Q: ${question.prompt}\nA: ${answerParts.join(', ')}`;
    }).join('\n');
}

function finishAskUserSession(status) {
    if (!askUserSession) {
        return;
    }

    const session = askUserSession;
    askUserSession = null;

    session.cleanupAbort?.();
    session.elements.options.replaceChildren();
    session.elements.title.textContent = '';
    session.elements.context.textContent = '';
    session.elements.context.hidden = true;
    session.elements.panel.hidden = true;
    session.elements.sendForm.classList.remove('ask-user-active');
    syncAskUserPanelLayout();

    const sendTextarea = document.getElementById('send_textarea');
    if (sendTextarea instanceof HTMLTextAreaElement) {
        sendTextarea.focus();
    }

    session.resolve(formatAskUserSessionResult(session, status));
}

async function promptAskUserQuestionnaire(questionnaire, signal) {
    if (askUserSession) {
        return 'Error: ask_user is already waiting for a response.';
    }

    if (!initAskUserPanel()) {
        return 'Error: ask_user panel is not available.';
    }

    const elements = getAskUserPanelElements();
    if (!elements) {
        return 'Error: ask_user panel is not available.';
    }

    return await new Promise((resolve) => {
        const cleanupAbort = () => {
            if (signal instanceof AbortSignal) {
                signal.removeEventListener('abort', abortHandler);
            }
        };

        const abortHandler = () => finishAskUserSession('dismissed');
        if (signal instanceof AbortSignal) {
            signal.addEventListener('abort', abortHandler, { once: true });
        }

        askUserSession = {
            questionnaire,
            answers: questionnaire.questions.map(question => ({
                selectedOptions: [...question.defaultSelected],
                freeText: question.defaultText,
            })),
            currentIndex: 0,
            elements,
            resolve,
            cleanupAbort,
        };

        elements.panel.hidden = false;
        elements.sendForm.classList.add('ask-user-active');
        renderAskUserPanel();
        elements.dismissButton.focus();
    });
}

function registerBuiltinTools() {
    const builtinTools = [
        {
            name: 'ask_user',
            displayName: 'Ask User',
            description: 'Ask the user questions.',
            parameters: {
                type: 'object',
                properties: {
                    questions: {
                        type: 'array',
                        description: 'Up to 4 questions. Each question may include up to 4 options.',
                        minItems: 1,
                        maxItems: 4,
                        items: {
                            type: 'object',
                            properties: {
                                prompt: {
                                    type: 'string',
                                    description: 'Question shown to the user.',
                                },
                                context: {
                                    type: 'string',
                                    description: 'Explanatory text.',
                                },
                                options: {
                                    type: 'array',
                                    description: 'Up to 4 options.',
                                    maxItems: 4,
                                    items: {
                                        type: 'string',
                                    },
                                },
                            },
                            required: ['prompt', 'context', 'options'],
                        },
                    },
                },
            },
            formatMessage: async (parameters) => {
                const questionnaire = normalizeAskUserPayload(parameters);
                const firstPrompt = questionnaire.questions[0]?.prompt || 'questionnaire';
                return `Asking the user in the bottom bar: ${firstPrompt}`;
            },
            action: async (parameters, signal) => {
                try {
                    const questionnaire = normalizeAskUserPayload(parameters);
                    return await promptAskUserQuestionnaire(questionnaire, signal);
                } catch (error) {
                    return `Error: ${error.message}`;
                }
            },
        },
        {
            name: 'write_file',
            description: 'Writes or appends content to a file in the files. Creates the file and parent directories if they don\'t exist.',
            parameters: {
                'type': 'object',
                'properties': {
                    'filepath': {
                        'type': 'string',
                        'description': 'The path to the file to write to, relative to the uploads directory.',
                    },
                    'content': {
                        'type': 'string',
                        'description': 'The content to write to the file.',
                    },
                    'append': {
                        'type': 'boolean',
                        'description': 'If true, appends the content to the end of the file. If false (default), overwrites the file.',
                    },
                },
                'required': ['filepath', 'content'],
            },
            action: async ({ filepath, content, append = false }) => {
                try {
                    const sandbox = getSandboxRequestContext();
                    const response = await fetch('/api/extensions/tools/writefile', {
                        method: 'POST',
                        headers: getRequestHeaders(),
                        body: JSON.stringify({ filepath, content, append, ...sandbox }),
                    });

                    const result = await response.json();

                    if (!response.ok) {
                        return `Error: ${result.error || 'An unknown error occurred.'}`;
                    }

                    return result.message;
                } catch (error) {
                    return `Error: Could not connect to the server to write the file. ${error.message}`;
                }
            },
        },
        {
            name: 'read_file',
            description: 'Reads the content of one or more text files from the files. Only use this for text.',
            parameters: {
                'type': 'object',
                'properties': {
                    'filepath': {
                        'type': 'string',
                        'description': 'The path to the file to read. Use this for single-file reads.',
                    },
                    'filepaths': {
                        'type': 'array',
                        'items': { 'type': 'string' },
                        'description': 'Multiple file paths to read in a single tool call (max 20). Prefer this when you need several files at once.',
                        'minItems': 1,
                        'maxItems': 20,
                    },
                },
            },
            action: async ({ filepath, filepaths }, signal) => {
                try {
                    const sandbox = getSandboxRequestContext();

                    const sanitizePaths = (paths) => (paths || [])
                        .map(p => String(p ?? '').trim())
                        .filter(Boolean);

                    const readOne = async (oneFilepath) => {
                        const response = await fetch('/api/extensions/tools/readfile', {
                            method: 'POST',
                            headers: getRequestHeaders(),
                            body: JSON.stringify({ filepath: oneFilepath, ...sandbox }),
                            signal,
                        });

                        const result = await response.json();

                        if (!response.ok) {
                            return { ok: false, filepath: oneFilepath, error: result?.error || 'An unknown error occurred.' };
                        }

                        return { ok: true, filepath: oneFilepath, content: result?.content ?? '' };
                    };

                    if (Array.isArray(filepaths)) {
                        const paths = sanitizePaths(filepaths);
                        if (paths.length === 0) {
                            return 'Error: "filepaths" must contain at least one filepath.';
                        }
                        if (paths.length > 20) {
                            return 'Error: Too many filepaths. Max is 20.';
                        }

                        const concurrencyLimit = 4;
                        const results = new Array(paths.length);
                        let nextIndex = 0;

                        const worker = async () => {
                            while (nextIndex < paths.length) {
                                const index = nextIndex++;
                                results[index] = await readOne(paths[index]);
                            }
                        };

                        await Promise.all(
                            Array.from({ length: Math.min(concurrencyLimit, paths.length) }, () => worker()),
                        );

                        return results.map((r) => {
                            if (r.ok) {
                                return `=== BEGIN FILE: ${r.filepath} ===\n${r.content}\n=== END FILE: ${r.filepath} ===`;
                            }
                            return `=== BEGIN FILE: ${r.filepath} (ERROR) ===\nError: ${r.error}\n=== END FILE: ${r.filepath} ===`;
                        }).join('\n\n');
                    }

                    const single = String(filepath ?? '').trim();
                    if (!single) {
                        return 'Error: "filepath" is required (or provide "filepaths").';
                    }

                    const singleResult = await readOne(single);
                    if (!singleResult.ok) {
                        return `Error: ${singleResult.error}`;
                    }

                    return singleResult.content;
                } catch (error) {
                    if (error?.name === 'AbortError') {
                        return 'Read was cancelled by the user.';
                    }
                    const errorMessage = `Error: Could not connect to the server to read the file. ${error.message}`;
                    return errorMessage;
                }
            },
        },
        {
            name: 'list_directory',
            description: 'Lists the files and directories in a given path within the files.',
            parameters: {
                'type': 'object',
                'properties': {
                    'path': {
                        'type': 'string',
                        'description': 'The path to the directory to list. Omit or use "." to list the root of the sandbox.',
                    },
                },
            },
            action: async ({ path = '.' }) => {
                try {
                    const sandbox = getSandboxRequestContext();
                    const response = await fetch('/api/extensions/tools/listdir', {
                        method: 'POST',
                        headers: getRequestHeaders(),
                        body: JSON.stringify({ path, ...sandbox }),
                    });

                    const result = await response.json();

                    if (!response.ok) {
                        const errorMessage = `Error: ${result.error || 'An unknown error occurred.'}`;
                        return errorMessage;
                    }

                    let output = '';
                    if (result.directories.length > 0) {
                        output += 'Directories:\n' + result.directories.map(d => `  - ${d}/`).join('\n') + '\n\n';
                    }
                    if (result.files.length > 0) {
                        output += 'Files:\n' + result.files.map(f => `  - ${f}`).join('\n');
                    }

                    if (output === '') {
                        output = 'The directory is empty.';
                    }

                    const trimmedOutput = output.trim();
                    return trimmedOutput;
                } catch (error) {
                    const errorMessage = `Error: Could not connect to the server to list the directory. ${error.message}`;
                    return errorMessage;
                }
            },
        },
        {
            name: 'display_image',
            description: 'Displays an image or video to the user from the files.',
            parameters: {
                'type': 'object',
                'properties': {
                    'filepath': {
                        'type': 'string',
                        'description': 'The path to the image or video file to display, relative to the uploads directory.',
                    },
                },
                'required': ['filepath'],
            },
            action: async ({ filepath }) => {
                const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];
                const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov'];
                const sandbox = getSandboxRequestContext();

                const extension = filepath.slice(filepath.lastIndexOf('.')).toLowerCase();

                if (imageExtensions.includes(extension)) {
                    return JSON.stringify({ type: 'image_display', filepath: filepath, ...sandbox });
                }

                if (videoExtensions.includes(extension)) {
                    return JSON.stringify({ type: 'video_display', filepath: filepath, ...sandbox });
                }

                return `Error: The file "${filepath}" is not a supported image or video type.`;
            },
        },
        {
            name: 'view_image_file',
            description: 'Provides an uploaded image to the model as multimodal context for further analysis. Use this when you need to inspect image contents before answering.',
            parameters: {
                'type': 'object',
                'properties': {
                    'filepath': {
                        'type': 'string',
                        'description': 'The path to the image file, relative to the uploads directory.',
                    },
                },
                'required': ['filepath'],
            },
            action: async ({ filepath }) => {
                const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];
                const extension = filepath.slice(filepath.lastIndexOf('.')).toLowerCase();
                const sandbox = getSandboxRequestContext();

                if (!imageExtensions.includes(extension)) {
                    return `Error: The file "${filepath}" is not a supported image type.`;
                }

                return {
                    type: 'image_context',
                    filepath: filepath,
                    ...sandbox,
                };
            },
        },
        {
            name: 'execute_shell',
            description: 'Executes a shell command in the environment. Useful for git, curl, or other command-line tools.',
            parameters: {
                'type': 'object',
                'properties': {
                    'command': {
                        'type': 'string',
                        'description': 'The shell command to execute.',
                    },
                },
                'required': ['command'],
            },
            action: async ({ command }, signal) => {
                try {
                    const sandbox = getSandboxRequestContext();
                    const response = await fetch('/api/extensions/tools/executeshell', {
                        method: 'POST',
                        headers: getRequestHeaders(),
                        body: JSON.stringify({ command, ...sandbox }),
                        signal,
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        return `Error executing command. Status: ${response.status}. Message: ${errorText}`;
                    }

                    const result = await response.json();
                    const fullOutput = result.output;

                    return fullOutput.trim() || 'Command executed with no output.';
                } catch (error) {
                    if (error.name === 'AbortError') {
                        return 'Execution was cancelled by the user.';
                    }
                    return `Error: Could not connect to server. ${error.message}`;
                }
            },
        },
        {
            name: 'execute_python',
            description: 'Executes Python code in a secure environment with access to the files.',
            parameters: {
                'type': 'object',
                'properties': {
                    'code': {
                        'type': 'string',
                        'description': 'The Python code to execute.',
                    },
                },
                'required': ['code'],
            },
            action: async ({ code }, signal) => {
                let fullOutput = '';
                try {
                    const sandbox = getSandboxRequestContext();
                    const response = await fetch('/api/extensions/tools/executepython', {
                        method: 'POST',
                        headers: getRequestHeaders(),
                        body: JSON.stringify({ code, ...sandbox }),
                        signal,
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        return `Error: ${errorText}`;
                    }

                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();

                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) {
                            break;
                        }
                        const chunk = decoder.decode(value, { stream: true });
                        fullOutput += chunk;
                    }
                    return fullOutput.trim() || 'Script executed with no output.';
                } catch (error) {
                    if (error.name === 'AbortError') {
                        const errorMessage = 'Execution was cancelled by the user. Do not re-attempt.';
                        return errorMessage;
                    }
                    const errorMessage = `Error: Could not connect to the server or stream was interrupted. ${error.message}`;
                    return errorMessage;
                }
            },
        },
        {
            name: 'browser_open',
            description: 'Opens a URL in an isolated Firefox browser session. If a recent session exists, it is reused by default; use new_tab=true to keep the current page open in another tab. The tool saves an automatic screenshot after the page loads. If the result contains an interstitial such as unusual traffic or captcha, switch sites instead of retrying the same engine repeatedly.',
            parameters: {
                type: 'object',
                properties: {
                    url: {
                        type: 'string',
                        description: 'The HTTP or HTTPS URL to open.',
                    },
                    session_id: {
                        type: 'string',
                        description: 'Optional existing browser session ID to reuse. If omitted, the most recent browser session is reused when available.',
                    },
                    tab_index: {
                        type: 'integer',
                        description: 'Optional existing tab index to reuse inside the session. If omitted, the active tab is reused.',
                    },
                    new_tab: {
                        type: 'boolean',
                        description: 'If true, opens the URL in a newly created tab within the existing session instead of replacing the active tab.',
                    },
                },
                required: ['url'],
            },
            action: async ({ url, session_id, tab_index, new_tab = false }, signal) => {
                const result = await callBrowserTool('open', { url, session_id, tab_index, new_tab }, signal);
                return typeof result === 'string' ? result : augmentBrowserToolResult(result);
            },
        },
        {
            name: 'browser_search',
            description: 'Opens a search results page for a query without needing site-specific selectors. Prefer duckduckgo or brave if another engine reports unusual traffic or captcha.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'The search query.',
                    },
                    engine: {
                        type: 'string',
                        description: 'Search engine to use. One of duckduckgo, brave, bing, or google. Defaults to duckduckgo.',
                    },
                    session_id: {
                        type: 'string',
                        description: 'Optional existing browser session ID to reuse. If omitted, the most recent browser session is reused when available.',
                    },
                    tab_index: {
                        type: 'integer',
                        description: 'Optional existing tab index to reuse inside the session.',
                    },
                    new_tab: {
                        type: 'boolean',
                        description: 'If true, opens the search results in a new tab.',
                    },
                },
                required: ['query'],
            },
            action: async ({ query, engine = 'duckduckgo', session_id, tab_index, new_tab = false }, signal) => {
                const result = await callBrowserTool('search', { query, engine, session_id, tab_index, new_tab }, signal);
                return typeof result === 'string' ? result : augmentBrowserToolResult(result);
            },
        },
        {
            name: 'browser_tabs',
            description: 'Lists, selects, or closes tabs in an existing browser session. Use this to explicitly manage tab indices.',
            parameters: {
                type: 'object',
                properties: {
                    session_id: {
                        type: 'string',
                        description: 'Optional browser session ID. If omitted, the most recent browser session is reused when available.',
                    },
                    action: {
                        type: 'string',
                        description: 'One of list, select, or close.',
                    },
                    tab_index: {
                        type: 'integer',
                        description: 'The tab index to select or close. Not needed for action=list.',
                    },
                },
                required: ['action'],
            },
            action: async ({ session_id, action, tab_index }, signal) => {
                const result = await callBrowserTool('tabs', { session_id, action, tab_index }, signal);
                return typeof result === 'string' ? result : augmentBrowserToolResult(result);
            },
        },
        {
            name: 'browser_close',
            description: 'Closes an isolated Firefox browser session.',
            parameters: {
                type: 'object',
                properties: {
                    session_id: {
                        type: 'string',
                        description: 'Optional browser session ID to close. If omitted, closes the most recent browser session when available.',
                    },
                },
                required: [],
            },
            action: async ({ session_id }, signal) => {
                return await callBrowserTool('close', { session_id }, signal);
            },
        },
        {
            name: 'browser_go_back',
            description: 'Navigates a browser tab one step back in its history and saves a screenshot of the resulting page.',
            parameters: {
                type: 'object',
                properties: {
                    session_id: {
                        type: 'string',
                        description: 'Optional browser session ID. If omitted, the most recent browser session is reused when available.',
                    },
                    tab_index: {
                        type: 'integer',
                        description: 'Optional tab index to target. Defaults to the active tab.',
                    },
                },
                required: [],
            },
            action: async ({ session_id, tab_index }, signal) => {
                const result = await callBrowserTool('back', { session_id, tab_index }, signal);
                return typeof result === 'string' ? result : augmentBrowserToolResult(result);
            },
        },
        {
            name: 'browser_click',
            description: 'Clicks in a browser tab using visible text, a CSS selector, a numbered element from dom_fetch interactive or links mode, or viewport coordinates. Prefer element_index immediately after dom_fetch because it is shorter and more reliable for small models. If you provide selector, text, and element_index together, selector is tried first, then text, then the cached element. Use button=right for right click. Saves a screenshot after the action.',
            parameters: {
                type: 'object',
                properties: {
                    session_id: {
                        type: 'string',
                        description: 'Optional browser session ID. If omitted, the most recent browser session is reused when available.',
                    },
                    tab_index: {
                        type: 'integer',
                        description: 'Optional tab index to target. Defaults to the active tab.',
                    },
                    element_index: {
                        type: 'integer',
                        description: 'Optional numbered element index from the most recent dom_fetch interactive or links result for this tab. Prefer this right after dom_fetch. Do not reuse stale indices from older pages.',
                    },
                    selector: {
                        type: 'string',
                        description: 'A CSS selector targeting the element to click. Use this when element_index is unavailable or stale. Do not provide a long copied selector from a different page.',
                    },
                    text: {
                        type: 'string',
                        description: 'Optional visible text to match on a clickable element across frames.',
                    },
                    text_index: {
                        type: 'integer',
                        description: 'Optional zero-based index to disambiguate between multiple visible text matches.',
                    },
                    button: {
                        type: 'string',
                        description: 'Mouse button to use: left, middle, or right. Defaults to left.',
                    },
                    x: {
                        type: 'number',
                        description: 'Viewport X coordinate to click. Provide this together with y when selector is not used.',
                    },
                    y: {
                        type: 'number',
                        description: 'Viewport Y coordinate to click. Provide this together with x when selector is not used.',
                    },
                },
                required: [],
            },
            action: async ({ session_id, tab_index, element_index, selector, text, text_index, button, x, y }, signal) => {
                const result = await callBrowserTool('click', { session_id, tab_index, element_index, selector, text, text_index, button, x, y }, signal);
                return typeof result === 'string' ? result : augmentBrowserToolResult(result);
            },
        },
        {
            name: 'browser_pixel_click',
            description: 'Clicks a browser tab at explicit viewport pixel coordinates. Use this when dom_fetch gives x and y for a target or when DOM selectors are unreliable. Prefer coordinates returned by dom_fetch interactive or links mode rather than guessing.',
            parameters: {
                type: 'object',
                properties: {
                    session_id: {
                        type: 'string',
                        description: 'Optional browser session ID. If omitted, the most recent browser session is reused when available.',
                    },
                    tab_index: {
                        type: 'integer',
                        description: 'Optional tab index to target. Defaults to the active tab.',
                    },
                    x: {
                        type: 'number',
                        description: 'Viewport X coordinate to click.',
                    },
                    y: {
                        type: 'number',
                        description: 'Viewport Y coordinate to click.',
                    },
                },
                required: ['x', 'y'],
            },
            action: async ({ session_id, tab_index, x, y }, signal) => {
                const result = await callBrowserTool('click', { session_id, tab_index, x, y }, signal);
                return typeof result === 'string' ? result : augmentBrowserToolResult(result);
            },
        },
        {
            name: 'browser_hover',
            description: 'Hovers in a browser tab using visible text, a CSS selector, a numbered element from dom_fetch interactive or links mode, or viewport coordinates. Prefer element_index right after dom_fetch; if you provide selector, text, and element_index together, selector is tried first, then text, then the cached element.',
            parameters: {
                type: 'object',
                properties: {
                    session_id: {
                        type: 'string',
                        description: 'Optional browser session ID. If omitted, the most recent browser session is reused when available.',
                    },
                    tab_index: {
                        type: 'integer',
                        description: 'Optional tab index to target. Defaults to the active tab.',
                    },
                    element_index: {
                        type: 'integer',
                        description: 'Optional numbered element index from the most recent dom_fetch interactive or links result for this tab. Prefer this right after dom_fetch.',
                    },
                    text: {
                        type: 'string',
                        description: 'Optional visible text to hover across frames.',
                    },
                    text_index: {
                        type: 'integer',
                        description: 'Optional zero-based index to disambiguate between multiple visible text matches.',
                    },
                    selector: {
                        type: 'string',
                        description: 'A CSS selector targeting the element to hover. Provide this or x/y coordinates.',
                    },
                    x: {
                        type: 'number',
                        description: 'Viewport X coordinate to hover.',
                    },
                    y: {
                        type: 'number',
                        description: 'Viewport Y coordinate to hover.',
                    },
                },
                required: [],
            },
            action: async ({ session_id, tab_index, element_index, selector, text, text_index, x, y }, signal) => {
                const result = await callBrowserTool('hover', { session_id, tab_index, element_index, selector, text, text_index, x, y }, signal);
                return typeof result === 'string' ? result : augmentBrowserToolResult(result);
            },
        },
        {
            name: 'browser_type',
            description: 'Types into an input-like element in a browser tab using either a CSS selector or a numbered element from dom_fetch interactive mode. Prefer element_index right after dom_fetch interactive. If you provide both selector and element_index, the selector is tried first. Saves a screenshot after typing.',
            parameters: {
                type: 'object',
                properties: {
                    session_id: {
                        type: 'string',
                        description: 'Optional browser session ID. If omitted, the most recent browser session is reused when available.',
                    },
                    tab_index: {
                        type: 'integer',
                        description: 'Optional tab index to target. Defaults to the active tab.',
                    },
                    element_index: {
                        type: 'integer',
                        description: 'Optional numbered element index from the most recent dom_fetch interactive result for this tab. Prefer this right after dom_fetch interactive.',
                    },
                    selector: {
                        type: 'string',
                        description: 'A CSS selector targeting the element to type into. You may use this or element_index.',
                    },
                    text: {
                        type: 'string',
                        description: 'The text to type.',
                    },
                    submit: {
                        type: 'boolean',
                        description: 'If true, presses Enter after typing.',
                    },
                },
                required: ['text'],
            },
            action: async ({ session_id, tab_index, element_index, selector, text, submit = false }, signal) => {
                const result = await callBrowserTool('type', { session_id, tab_index, element_index, selector, text, submit }, signal);
                return typeof result === 'string' ? result : augmentBrowserToolResult(result);
            },
        },
        {
            name: 'browser_key',
            description: 'Presses one key or a sequence of keys in the active browser tab. Use this for Escape, Enter, Tab, arrow keys, shortcuts, and menu access keys when clicking is unreliable. Saves a screenshot after the key sequence.',
            parameters: {
                type: 'object',
                properties: {
                    session_id: {
                        type: 'string',
                        description: 'Optional browser session ID. If omitted, the most recent browser session is reused when available.',
                    },
                    tab_index: {
                        type: 'integer',
                        description: 'Optional tab index to target. Defaults to the active tab.',
                    },
                    key: {
                        type: 'string',
                        description: 'Single key or chord to press, such as Escape, Enter, Tab, ArrowDown, or Alt+H.',
                    },
                    keys: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Optional sequence of keys to press in order, such as ["Alt+H", "O", "H"].',
                    },
                    delay_ms: {
                        type: 'integer',
                        description: 'Optional delay between keys in milliseconds. Defaults to 120.',
                    },
                },
                required: [],
            },
            action: async ({ session_id, tab_index, key, keys, delay_ms }, signal) => {
                const result = await callBrowserTool('key', { session_id, tab_index, key, keys, delay_ms }, signal);
                return typeof result === 'string' ? result : augmentBrowserToolResult(result);
            },
        },
        {
            name: 'browser_wait',
            description: 'Waits for text or a CSS selector to appear in a browser tab.',
            parameters: {
                type: 'object',
                properties: {
                    session_id: {
                        type: 'string',
                        description: 'Optional browser session ID. If omitted, the most recent browser session is reused when available.',
                    },
                    tab_index: {
                        type: 'integer',
                        description: 'Optional tab index to target. Defaults to the active tab.',
                    },
                    text: {
                        type: 'string',
                        description: 'Text to wait for. Provide this or selector.',
                    },
                    selector: {
                        type: 'string',
                        description: 'A CSS selector to wait for. Provide this or text.',
                    },
                    timeout_ms: {
                        type: 'integer',
                        description: 'Timeout in milliseconds. Default 10000, max 30000.',
                    },
                },
                required: [],
            },
            action: async ({ session_id, tab_index, text, selector, timeout_ms }, signal) => {
                return await callBrowserTool('wait', { session_id, tab_index, text, selector, timeout_ms }, signal);
            },
        },
        {
            name: 'dom_fetch',
            description: 'Fetches DOM content from a browser tab. Supports readable text, raw HTML, visible text, normalized links, or numbered interactive elements. Interactive and links results include element indices and viewport click coordinates when available.',
            parameters: {
                type: 'object',
                properties: {
                    session_id: {
                        type: 'string',
                        description: 'Optional browser session ID. If omitted, the most recent browser session is reused when available.',
                    },
                    tab_index: {
                        type: 'integer',
                        description: 'Optional tab index to target. Defaults to the active tab.',
                    },
                    mode: {
                        type: 'string',
                        description: 'One of readable, html, text, links, or interactive. Defaults to readable.',
                    },
                    selector: {
                        type: 'string',
                        description: 'Optional CSS selector to scope the fetch.',
                    },
                    max_chars: {
                        type: 'integer',
                        description: 'Maximum characters to return. Default 12000, hard cap 30000.',
                    },
                    limit: {
                        type: 'integer',
                        description: 'Maximum number of items to return for links or interactive mode. Default 20. For small models, prefer 8-15 unless you truly need more.',
                    },
                    offset: {
                        type: 'integer',
                        description: 'Starting offset for links or interactive mode. Default 0.',
                    },
                },
                required: [],
            },
            action: async ({ session_id, tab_index, mode, selector, max_chars, limit, offset }, signal) => {
                return await callBrowserTool('domfetch', { session_id, tab_index, mode, selector, max_chars, limit, offset }, signal);
            },
        },
        {
            name: 'execute_js',
            description: 'Executes controlled JavaScript in a browser tab and returns a JSON-safe result. Always return a JSON-serializable value. The snippet can use element, arg, $(selector) for querySelector, and $$(selector) for Array.from(querySelectorAll(...)).',
            parameters: {
                type: 'object',
                properties: {
                    session_id: {
                        type: 'string',
                        description: 'Optional browser session ID. If omitted, the most recent browser session is reused when available.',
                    },
                    tab_index: {
                        type: 'integer',
                        description: 'Optional tab index to target. Defaults to the active tab.',
                    },
                    code: {
                        type: 'string',
                        description: 'JavaScript code to run inside the page context. The snippet may use element, arg, $, and $$. It should return a JSON-serializable result. Example: return $$("img").slice(0, 3).map(img => ({ src: img.src, alt: img.alt }));',
                    },
                    selector: {
                        type: 'string',
                        description: 'Optional CSS selector. If provided, the matched element is passed in as element.',
                    },
                    arg: {
                        description: 'Optional JSON-serializable argument passed into the snippet as arg.',
                    },
                },
                required: ['code'],
            },
            action: async ({ session_id, tab_index, code, selector, arg }, signal) => {
                const result = await callBrowserTool('executejs', { session_id, tab_index, code, selector, arg }, signal);
                return typeof result === 'string' ? result : augmentBrowserToolResult(result);
            },
        },
        {
            name: 'browser_screenshot',
            description: 'Captures a screenshot from a browser tab and saves it to the sandbox.',
            parameters: {
                type: 'object',
                properties: {
                    session_id: {
                        type: 'string',
                        description: 'Optional browser session ID. If omitted, the most recent browser session is reused when available.',
                    },
                    tab_index: {
                        type: 'integer',
                        description: 'Optional tab index to target. Defaults to the active tab.',
                    },
                    filepath: {
                        type: 'string',
                        description: 'Optional sandbox filepath for the screenshot PNG.',
                    },
                    full_page: {
                        type: 'boolean',
                        description: 'If true, attempts a full-page screenshot.',
                    },
                },
                required: [],
            },
            action: async ({ session_id, tab_index, filepath, full_page = false }, signal) => {
                const result = await callBrowserTool('screenshot', { session_id, tab_index, filepath, full_page }, signal);
                if (typeof result === 'string') {
                    return result;
                }

                return {
                    ...result,
                    ...getSandboxRequestContext(),
                };
            },
        },
        {
            name: 'browser_download',
            description: 'Downloads a file from a browser tab, either by clicking a selector or by triggering a URL, and saves it to the sandbox.',
            parameters: {
                type: 'object',
                properties: {
                    session_id: {
                        type: 'string',
                        description: 'Optional browser session ID. If omitted, the most recent browser session is reused when available.',
                    },
                    tab_index: {
                        type: 'integer',
                        description: 'Optional tab index to target. Defaults to the active tab.',
                    },
                    selector: {
                        type: 'string',
                        description: 'Optional CSS selector to click to trigger the download.',
                    },
                    url: {
                        type: 'string',
                        description: 'Optional HTTP or HTTPS URL to trigger as a direct download.',
                    },
                    filepath: {
                        type: 'string',
                        description: 'Optional sandbox filepath for the downloaded file.',
                    },
                },
                required: [],
            },
            action: async ({ session_id, tab_index, selector, url, filepath }, signal) => {
                const result = await callBrowserTool('download', { session_id, tab_index, selector, url, filepath }, signal);
                return typeof result === 'string' ? result : augmentBrowserToolResult(result);
            },
        },
        {
            name: 'sd_list_models',
            description: 'Lists the available Stable Diffusion checkpoints (models) on the SD WebUI instance. Use this to discover which models are available before generating images.',
            parameters: {
                'type': 'object',
                'properties': {},
            },
            action: async () => {
                try {
                    const response = await fetch('/api/extensions/tools/sd_models', {
                        method: 'GET',
                        headers: getRequestHeaders(),
                    });

                    if (!response.ok) {
                        const error = await response.json();
                        return `Error fetching models: ${error.error || response.statusText}`;
                    }

                    const models = await response.json();
                    const modelNames = models.map(m => m.title || m.model_name);
                    return JSON.stringify({ available_models: modelNames });
                } catch (error) {
                    return `Error: Could not connect to Stable Diffusion WebUI. Make sure it is running at localhost:7860 with --api flag. ${error.message}`;
                }
            },
        },
        {
            name: 'sd_txt2img',
            description: 'Generates an image using Stable Diffusion text-to-image. The generated image is saved to the files and can be displayed using display_image.',
            parameters: {
                'type': 'object',
                'properties': {
                    'prompt': {
                        'type': 'string',
                        'description': 'The text prompt describing the image to generate.',
                    },
                    'negative_prompt': {
                        'type': 'string',
                        'description': 'Text prompt for concepts to avoid in the generated image.',
                    },
                    'model': {
                        'type': 'string',
                        'description': 'The exact model/checkpoint name to use. Use sd_list_models to get available names. If not specified, uses whatever model is currently loaded.',
                    },
                    'width': {
                        'type': 'integer',
                        'description': 'Output image width in pixels. Default: 1200.',
                    },
                    'height': {
                        'type': 'integer',
                        'description': 'Output image height in pixels. Default: 1200.',
                    },
                    'steps': {
                        'type': 'integer',
                        'description': 'Number of sampling steps. Default: 25.',
                    },
                    'cfg_scale': {
                        'type': 'number',
                        'description': 'Classifier-free guidance scale. Higher values follow the prompt more closely. Default: 5.',
                    },
                    'sampler_name': {
                        'type': 'string',
                        'description': 'Name of the sampler to use (e.g. "Euler a", "DPM++ 2M Karras"). Default: "Euler a".',
                    },
                    'seed': {
                        'type': 'integer',
                        'description': 'Random seed for reproducibility. Use -1 for random. Default: -1.',
                    },
                },
                'required': ['prompt'],
            },
            action: async ({ prompt, negative_prompt, model, width, height, steps, cfg_scale, sampler_name, seed }) => {
                try {
                    const sandbox = getSandboxRequestContext();
                    const response = await fetch('/api/extensions/tools/sd_txt2img', {
                        method: 'POST',
                        headers: getRequestHeaders(),
                        body: JSON.stringify({
                            prompt,
                            negative_prompt: negative_prompt || '',
                            model: model || '',
                            width: width || 1200,
                            height: height || 1200,
                            steps: steps || 25,
                            cfg_scale: cfg_scale || 5,
                            sampler_name: sampler_name || 'Euler a',
                            seed: seed ?? -1,
                            ...sandbox,
                        }),
                    });

                    if (!response.ok) {
                        const error = await response.json();
                        return `Error generating image: ${error.error || response.statusText}`;
                    }

                    const result = await response.json();
                    return JSON.stringify({
                        type: 'image_display',
                        filepath: result.filepath,
                        info: result.info || 'Image generated successfully.',
                        ...sandbox,
                    });
                } catch (error) {
                    return `Error: Could not connect to Stable Diffusion WebUI. Make sure it is running at localhost:7860 with --api flag. ${error.message}`;
                }
            },
        },
        {
            name: 'bio',
            displayName: 'Update Bio',
            description: 'Appends additional information to the user\'s bio. Use this to record new details about the user that they share during conversation, such as preferences, background, traits, or any other personal information. The text will be appended to the existing bio. Nothing can be deleted with this tool; the user can manually edit their bio in the Persona tab if needed.',
            parameters: {
                'type': 'object',
                'properties': {
                    'text': {
                        'type': 'string',
                        'description': 'The text to append to the user\'s bio.',
                    },
                },
                'required': ['text'],
            },
            action: async ({ text }) => {
                try {
                    if (!text || typeof text !== 'string' || text.trim().length === 0) {
                        return 'Error: No text provided to append to the bio.';
                    }

                    const currentDescription = power_user.persona_description || '';
                    const separator = currentDescription.length > 0 ? '\n' : '';
                    const newDescription = currentDescription + separator + text.trim();

                    // Update the active persona description
                    power_user.persona_description = newDescription;

                    // Update the stored persona descriptor if a persona is active
                    if (user_avatar && power_user.persona_descriptions[user_avatar]) {
                        power_user.persona_descriptions[user_avatar].description = newDescription;
                    } else if (user_avatar) {
                        power_user.persona_descriptions[user_avatar] = {
                            description: newDescription,
                            position: power_user.persona_description_position,
                            depth: power_user.persona_description_depth,
                            role: power_user.persona_description_role,
                            lorebook: power_user.persona_description_lorebook,
                            connections: [],
                        };
                    }

                    // Refresh the UI and save
                    setPersonaDescription();
                    saveSettingsDebounced();

                    return `Successfully appended to bio. The added text is:\n${text}`;
                } catch (error) {
                    return `Error updating bio: ${error.message}`;
                }
            },
        },
    ];
    const dangerousTools = ['write_file', 'execute_shell', 'execute_python'];
    const imageGenTools = ['sd_list_models', 'sd_txt2img'];
    const browserTools = ['browser_open', 'browser_search', 'browser_tabs', 'browser_close', 'browser_go_back', 'browser_click', 'browser_pixel_click', 'browser_hover', 'browser_type', 'browser_key', 'browser_wait', 'dom_fetch', 'execute_js', 'browser_screenshot', 'browser_download'];

    builtinTools.forEach(tool => {
        // Security gate for dangerous tools.
        if (dangerousTools.includes(tool.name) && !power_user.enable_dangerous_tools) {
            return;
        }
        // Gate for image generation tools.
        if (imageGenTools.includes(tool.name) && !power_user.enable_image_generation) {
            return;
        }
        // Gate for browser automation tools.
        if (browserTools.includes(tool.name) && !power_user.enable_browser_tools) {
            return;
        }
        if (!ToolManager.tools.some(t => t.toFunctionOpenAI().function.name === tool.name)) {
            ToolManager.registerFunctionTool(tool);
        }
    });
}

/**
 * A class that manages the registration and invocation of tools.
 */
export class ToolManager {
    /**
     * A map of tool names to tool definitions.
     * @type {Map<string, ToolDefinition>}
     */
    static #tools = new Map();

    static #INPUT_DELTA_KEY = '__input_json_delta';

    /**
     * The maximum number of times to recurse when parsing tool calls.
     * @type {number}
     */
    static RECURSE_LIMIT = 50;
    static #lastListDirectoryContext = '';

    /**
     * Returns an Array of all tools that have been registered.
     * @type {ToolDefinition[]}
     */
    static get tools() {
        return Array.from(this.#tools.values());
    }

    /**
     * Registers a new tool with the tool registry.
     * @param {ToolRegistration} tool The tool to register.
     */
    static registerFunctionTool({ name, displayName, description, parameters, action, formatMessage, shouldRegister, stealth }) {
        // Convert WIP arguments
        if (typeof arguments[0] !== 'object') {
            [name, description, parameters, action] = arguments;
        }

        if (this.#tools.has(name)) {
            console.warn(`[ToolManager] A tool with the name "${name}" has already been registered. The definition will be overwritten.`);
        }

        const definition = new ToolDefinition(
            name,
            displayName,
            description,
            parameters,
            action,
            formatMessage,
            shouldRegister,
            stealth,
        );
        this.#tools.set(name, definition);
        console.log('[ToolManager] Registered function tool:', definition);
    }

    /**
     * Removes a tool from the tool registry.
     * @param {string} name The name of the tool to unregister.
     */
    static unregisterFunctionTool(name) {
        if (!this.#tools.has(name)) {
            return;
        }

        this.#tools.delete(name);
        console.log(`[ToolManager] Unregistered function tool: ${name}`);
    }

    /**
    * Parse tool call parameters -- they're usually JSON, but they can also be empty strings (which are not valid JSON apparently).
    * @param {object} parameters The parameters for a tool call, usually a string with JSON inside
    * @returns {object} The parsed parameters
    */
    static #parseParameters(parameters) {
        return parameters === ''
            ? {}
            : typeof parameters === 'string'
                ? JSON.parse(parameters)
                : parameters;
    }

    /**
     * Invokes a tool by name. Returns the result of the tool's action function.
     * @param {string} name The name of the tool to invoke.
     * @param {object} parameters Function parameters. For example, if the tool requires a "name" parameter, you would pass {name: "value"}.
     * @param {AbortSignal} signal The AbortSignal to use for cancellation.
     * @returns {Promise<string|Error>} The result of the tool's action function. If an error occurs, null is returned. Non-string results are JSON-stringified.
     */
    static async invokeFunctionTool(name, parameters, signal) {
        try {
            if (!this.#tools.has(name)) {
                throw new Error(`No tool with the name "${name}" has been registered.`);
            }

            const invokeParameters = this.#parseParameters(parameters);
            const tool = this.#tools.get(name);

            const toolTimeouts = new Map([
                ['execute_python', 10000],
                ['execute_shell', 10000],
                ['browser_open', 90000],
                ['browser_search', 90000],
                ['browser_tabs', 90000],
                ['browser_close', 90000],
                ['browser_go_back', 90000],
                ['browser_click', 90000],
                ['browser_pixel_click', 90000],
                ['browser_hover', 90000],
                ['browser_type', 90000],
                ['browser_key', 90000],
                ['browser_wait', 90000],
                ['dom_fetch', 90000],
                ['execute_js', 90000],
                ['browser_screenshot', 90000],
                ['browser_download', 90000],
            ]);
            const timeoutMs = toolTimeouts.get(name);
            const timeoutMessage = name.startsWith('browser_') || name === 'dom_fetch' || name === 'execute_js'
                ? `Browser tool "${name}" timed out before returning a result.`
                : 'Tool call run for max duration 10 seconds, ending logging here. Your command is running in the background. Make a new python or bash call to interrupt with the new tool call.';

            const result = timeoutMs
                ? await withTimeout(tool.invoke(invokeParameters, signal), timeoutMs, timeoutMessage)
                : await tool.invoke(invokeParameters, signal);

            return typeof result === 'string' ? result : JSON.stringify(result);
        } catch (error) {
            console.error(`[ToolManager] An error occurred while invoking the tool "${name}":`, error);

            if (error instanceof Error) {
                error.cause = name;
                return error;
            }

            return new Error('Unknown error occurred while invoking the tool.', { cause: name });
        }
    }

    /**
     * Checks if a tool is a stealth tool.
     * @param {string} name The name of the tool to check.
     * @returns {boolean} Whether the tool is a stealth tool.
     */
    static isStealthTool(name) {
        if (!this.#tools.has(name)) {
            return false;
        }

        const tool = this.#tools.get(name);
        return !!tool.stealth;
    }

    /**
     * Formats a message for a tool call by name.
     * @param {string} name The name of the tool to format the message for.
     * @param {object} parameters Function tool call parameters.
     * @returns {Promise<string>} The formatted message for the tool call.
     */
    static async formatToolCallMessage(name, parameters) {
        if (!this.#tools.has(name)) {
            return `Invoked unknown tool: ${name}`;
        }

        try {
            const tool = this.#tools.get(name);
            const formatParameters = this.#parseParameters(parameters);
            return await tool.formatMessage(formatParameters);
        } catch (error) {
            console.error(`[ToolManager] An error occurred while formatting the tool call message for "${name}":`, error);
            return `Invoking tool: ${name}`;
        }
    }

    /**
     * Gets the display name of a tool by name.
     * @param {string} name
     * @returns {string} The display name of the tool.
     */
    static getDisplayName(name) {
        if (!this.#tools.has(name)) {
            return name;
        }

        const tool = this.#tools.get(name);
        return tool.displayName || name;
    }

    /**
     * Register function tools for the next chat completion request.
     * @param {object} data Generation data
     */
    static async registerFunctionToolsOpenAI(data) {
        const tools = [];

        for (const tool of ToolManager.tools) {
            const register = await tool.shouldRegister();
            if (!register) {
                console.log('[ToolManager] Skipping tool registration:', tool);
                continue;
            }
            tools.push(tool.toFunctionOpenAI());
        }

        if (tools.length) {
            console.log('[ToolManager] Registered function tools:', tools);

            data.tools = tools;
            data.tool_choice = 'auto';
        }
    }

    /**
     * Utility function to parse tool calls from a parsed response.
     * @param {any[]} toolCalls The tool calls to update.
     * @param {any} parsed The parsed response from the OpenAI API.
     * @returns {void}
     */
    static parseToolCalls(toolCalls, parsed) {
        if (!this.isToolCallingSupported()) {
            return;
        }
        if (Array.isArray(parsed?.choices)) {
            for (const choice of parsed.choices) {
                const choiceIndex = (typeof choice.index === 'number') ? choice.index : null;
                const choiceDelta = choice.delta;

                if (choiceIndex === null || !choiceDelta) {
                    continue;
                }

                const toolCallDeltas = choiceDelta?.tool_calls;

                if (!Array.isArray(toolCallDeltas)) {
                    continue;
                }

                if (!Array.isArray(toolCalls[choiceIndex])) {
                    toolCalls[choiceIndex] = [];
                }

                for (const toolCallDelta of toolCallDeltas) {
                    const toolCallIndex = toolCallDelta?.index >= 0 ? toolCallDelta.index : toolCallDeltas.indexOf(toolCallDelta);

                    if (isNaN(toolCallIndex)) {
                        continue;
                    }

                    if (toolCalls[choiceIndex][toolCallIndex] === undefined) {
                        toolCalls[choiceIndex][toolCallIndex] = {};
                    }

                    const targetToolCall = toolCalls[choiceIndex][toolCallIndex];

                    ToolManager.#applyToolCallDelta(targetToolCall, toolCallDelta);
                }
            }
        }
        const cohereToolEvents = ['message-start', 'tool-call-start', 'tool-call-delta', 'tool-call-end'];
        if (cohereToolEvents.includes(parsed?.type) && typeof parsed?.delta?.message === 'object') {
            const choiceIndex = 0;
            const toolCallIndex = parsed?.index ?? 0;

            if (!Array.isArray(toolCalls[choiceIndex])) {
                toolCalls[choiceIndex] = [];
            }

            if (toolCalls[choiceIndex][toolCallIndex] === undefined) {
                toolCalls[choiceIndex][toolCallIndex] = {};
            }

            const targetToolCall = toolCalls[choiceIndex][toolCallIndex];
            ToolManager.#applyToolCallDelta(targetToolCall, parsed.delta.message);
        }
        if (typeof parsed?.content_block === 'object') {
            const choiceIndex = 0;
            const toolCallIndex = parsed?.index ?? 0;

            if (parsed?.content_block?.type === 'tool_use') {
                if (!Array.isArray(toolCalls[choiceIndex])) {
                    toolCalls[choiceIndex] = [];
                }
                if (toolCalls[choiceIndex][toolCallIndex] === undefined) {
                    toolCalls[choiceIndex][toolCallIndex] = {};
                }
                const targetToolCall = toolCalls[choiceIndex][toolCallIndex];
                ToolManager.#applyToolCallDelta(targetToolCall, parsed.content_block);
            }
        }
        if (typeof parsed?.delta === 'object') {
            const choiceIndex = 0;
            const toolCallIndex = parsed?.index ?? 0;
            const targetToolCall = toolCalls[choiceIndex]?.[toolCallIndex];
            if (targetToolCall) {
                if (parsed?.delta?.type === 'input_json_delta') {
                    const jsonDelta = parsed?.delta?.partial_json;
                    if (!targetToolCall[this.#INPUT_DELTA_KEY]) {
                        targetToolCall[this.#INPUT_DELTA_KEY] = '';
                    }
                    targetToolCall[this.#INPUT_DELTA_KEY] += jsonDelta;
                }
            }
        }
        if (parsed?.type === 'content_block_stop') {
            const choiceIndex = 0;
            const toolCallIndex = parsed?.index ?? 0;
            const targetToolCall = toolCalls[choiceIndex]?.[toolCallIndex];
            if (targetToolCall) {
                const jsonDeltaString = targetToolCall[this.#INPUT_DELTA_KEY];
                if (jsonDeltaString) {
                    try {
                        const jsonDelta = { input: JSON.parse(jsonDeltaString) };
                        delete targetToolCall[this.#INPUT_DELTA_KEY];
                        ToolManager.#applyToolCallDelta(targetToolCall, jsonDelta);
                    } catch (error) {
                        console.warn('[ToolManager] Failed to apply input JSON delta:', error);
                    }
                }
            }
        }
        if (Array.isArray(parsed?.candidates)) {
            for (let choiceIndex = 0; choiceIndex < parsed.candidates.length; choiceIndex++) {
                const candidate = parsed.candidates[choiceIndex];
                if (Array.isArray(candidate?.content?.parts)) {
                    for (let partIndex = 0; partIndex < candidate.content.parts.length; partIndex++) {
                        const part = candidate.content.parts[partIndex];
                        if (part.functionCall) {
                            if (!Array.isArray(toolCalls[choiceIndex])) {
                                toolCalls[choiceIndex] = [];
                            }
                            const toolCallIndex = toolCalls[choiceIndex].length;
                            if (toolCalls[choiceIndex][toolCallIndex] === undefined) {
                                toolCalls[choiceIndex][toolCallIndex] = {};
                            }
                            const targetToolCall = toolCalls[choiceIndex][toolCallIndex];
                            ToolManager.#applyToolCallDelta(targetToolCall, part.functionCall);
                        }
                    }
                }
            }
        }
    }

    /**
     * Apply a tool call delta to a target object.
     * @param {object} target The target object to apply the delta to
     * @param {object} delta The delta object to apply
     */
    static #applyToolCallDelta(target, delta) {
        for (const key in delta) {
            if (!Object.prototype.hasOwnProperty.call(delta, key)) continue;
            if (key === '__proto__' || key === 'constructor') continue;

            const deltaValue = delta[key];
            const targetValue = target[key];

            if (deltaValue === null || deltaValue === undefined) {
                // Don't reset the value if it already exists
                if (targetValue) {
                    continue;
                }
                target[key] = deltaValue;
                continue;
            }

            if (typeof deltaValue === 'string') {
                if (typeof targetValue === 'string') {
                    // Concatenate strings
                    target[key] = targetValue + deltaValue;
                } else {
                    target[key] = deltaValue;
                }
            } else if (typeof deltaValue === 'object' && !Array.isArray(deltaValue)) {
                if (typeof targetValue !== 'object' || targetValue === null || Array.isArray(targetValue)) {
                    target[key] = {};
                }
                // Recursively apply deltas to nested objects
                ToolManager.#applyToolCallDelta(target[key], deltaValue);
            } else {
                // Assign other types directly
                target[key] = deltaValue;
            }
        }
    }

    /**
     * Finds and parses a <tool> block from the LLM response.
     * @param {string} text The text content from the LLM.
     * @returns {object|null} The parsed tool call and reasoning, or null if not found.
     */
    static findAndParseNativeToolCall(text) {
        const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/);
        const reasoning = thinkMatch ? thinkMatch[1] : '';

        const toolTagIndex = text.indexOf('<tool>');
        if (toolTagIndex === -1) {
            return null;
        }

        // Calculate prefix text: everything before <tool> that isn't part of <think> block
        let prefixText = '';
        const textBeforeTool = text.substring(0, toolTagIndex);
        if (thinkMatch) {
            // Remove the <think>...</think> block from the text before <tool>
            prefixText = textBeforeTool.replace(/<think>[\s\S]*?<\/think>/, '');
        } else {
            prefixText = textBeforeTool;
        }

        // Start searching for the JSON object after the <tool> tag.
        const jsonStartIndex = text.indexOf('{', toolTagIndex);
        if (jsonStartIndex === -1) {
            return null;
        }

        let braceCount = 1;
        let jsonEndIndex = -1;

        // Find the matching closing brace for the JSON object.
        for (let i = jsonStartIndex + 1; i < text.length; i++) {
            if (text[i] === '{') {
                braceCount++;
            } else if (text[i] === '}') {
                braceCount--;
            }

            if (braceCount === 0) {
                jsonEndIndex = i;
                break;
            }
        }

        if (jsonEndIndex !== -1) {
            const jsonString = text.substring(jsonStartIndex, jsonEndIndex + 1);
            try {
                const parsed = JSON.parse(jsonString);
                if (typeof parsed.tool === 'string' && typeof parsed.args === 'object') {
                    // Extract the continue flag (default true for backward compatibility)
                    const shouldContinue = parsed.continue !== undefined ? !!parsed.continue : true;
                    console.log(`[ToolManager] Parsed tool call: ${parsed.tool}, continue flag: ${parsed.continue}, resolved: ${shouldContinue}`);
                    // Success!
                    return {
                        tool_call: parsed,
                        reasoning: reasoning,
                        prefix_text: prefixText,
                        original_text: text,
                        'continue': shouldContinue,
                    };
                }
            } catch (e) {
                console.error('Failed to parse JSON from tool block:', e);
                return null;
            }
        }
        return null;
    }

    /**
     * Reconstructs the message from the parsed tool call to be displayed in the chat.
     * @param {object} parsedTool The result from findAndParseNativeToolCall.
     * @returns {string} The canonical tool call string.
     */
    static formatNativeToolCallForDisplay(parsedTool) {
        const { tool_call, reasoning, prefix_text } = parsedTool;
        let result = '';

        // Include any text that appeared before the tool call
        if (prefix_text) {
            result += prefix_text;
            if (!prefix_text.endsWith('\n')) {
                result += '\n';
            }
        }

        if (reasoning) {
            result += `<think>${reasoning}</think>\n`;
        }

        const toolJsonString = JSON.stringify(tool_call, null, 2);
        result += `<tool>\n${toolJsonString}\n</tool>`;

        return result;
    }

    /**
     * Fetches current uploads directory listing for prompt context.
     * @returns {Promise<string|null>} Formatted context or null when disabled/unavailable.
     */
    static async #getListDirectoryPromptContext() {
        if (!power_user.auto_list_directory_context) {
            return null;
        }

        let listResult = await withTimeout(
            ToolManager.invokeFunctionTool('list_directory', { path: '.' }),
            LIST_DIRECTORY_CONTEXT_TIMEOUT_MS,
            LIST_DIRECTORY_CONTEXT_TIMEOUT_RESULT,
        );

        if (listResult === LIST_DIRECTORY_CONTEXT_TIMEOUT_RESULT) {
            listResult = this.#lastListDirectoryContext
                ? this.#lastListDirectoryContext
                : 'Unavailable: list_directory timed out.';
        } else if (listResult instanceof Error) {
            listResult = this.#lastListDirectoryContext
                ? this.#lastListDirectoryContext
                : `Unavailable: ${listResult.message}`;
        } else {
            listResult = String(listResult ?? '').trim();
            if (listResult.startsWith('Error:')) {
                listResult = this.#lastListDirectoryContext
                    ? this.#lastListDirectoryContext
                    : `Unavailable: ${listResult}`;
            }
        }

        if (typeof listResult !== 'string' || !listResult) {
            return null;
        }

        const trimmedListResult = listResult.length > LIST_DIRECTORY_CONTEXT_MAX_CHARS
            ? `${listResult.slice(0, LIST_DIRECTORY_CONTEXT_MAX_CHARS)}\n... (truncated)`
            : listResult;

        this.#lastListDirectoryContext = trimmedListResult;
        const workspace = getCurrentSandboxWorkspace();
        const workspaceLabel = workspace === SANDBOX_ROOT_WORKSPACE ? 'root' : workspace;
        return `Current sandbox workspace listing (workspace "${workspaceLabel}", auto-fetched using list_directory with path "."):\n${trimmedListResult}`;
    }

    /**
     * Constructs the system prompt instructions for native tool calling.
     * @returns {Promise<string|null>} The instruction string or null if no tools are available.
     */
    static async getNativeToolPrompt() {
        if (this.tools.length === 0) {
            return null;
        }

        const finalPromptParts = [];
        finalPromptParts.push(`Always put your tool call in your main response. Only one tool call at the end of your message is supported.

Call the tool with the required arguments inside a <tool> block. Use windows syntax always.
To provide a non-media file for the user to download, use the syntax \`![](filename.ext)\`
To provide media to the user to download or view, use display_image.

The "continue" field controls whether you get a follow-up turn after the tool executes:
- "continue": true — The tool result will be shown to you and you will generate another response. Use this when you need to see the result before responding, or when you have no text response yet.
- "continue": false — The tool runs silently and no follow-up generation occurs. Use this when you have ALREADY written your full response to the user in the same message and the tool call is just a side-effect (e.g. saving data, logging). This prevents a redundant empty reply.

If omitted, "continue" defaults to true.

Format example:

<tool>
{
  "tool": "tool_name",
  "args": {
    "arg_name": "arg_value"
  },
  "continue": true
}
</tool>

Here are the available tools:
`);

        const toolsString = this.tools.map(tool => {
            const openAITool = tool.toFunctionOpenAI();
            return JSON.stringify({
                name: openAITool.function.name,
                description: openAITool.function.description,
                arguments: openAITool.function.parameters,
            });
        }).join('\n');
        finalPromptParts.push(toolsString);

        const listDirectoryPromptContext = await this.#getListDirectoryPromptContext();
        if (listDirectoryPromptContext) {
            finalPromptParts.push(listDirectoryPromptContext);
        }

        return finalPromptParts.join('\n\n');
    }

    /**
     * Checks if tool calling is supported for the current settings and generation type.
     * @param {ChatCompletionSettings} settings Optional chat completion settings
     * @param {string} model Optional model name
     * @returns {boolean} Whether tool calling is supported for the given type
     */
    static isToolCallingSupported(settings = null, model = null) {
        settings = settings ?? oai_settings;
        model = model ?? getChatCompletionModel(settings);

        if (main_api !== 'openai' || !settings.function_calling || settings.native_tool_calling) {
            return false;
        }

        // Post-processing will forcefully remove past tool calls from the prompt, making them useless
        const { NONE, MERGE_TOOLS, SEMI_TOOLS, STRICT_TOOLS } = custom_prompt_post_processing_types;
        const allowedPromptPostProcessing = [NONE, MERGE_TOOLS, SEMI_TOOLS, STRICT_TOOLS];
        if (!allowedPromptPostProcessing.includes(settings.custom_prompt_post_processing)) {
            return false;
        }

        const currentModel = Array.isArray(model_list) ? model_list.find(m => m.id === model) : null;
        if (currentModel) {
            switch (settings.chat_completion_source) {
                case chat_completion_sources.POLLINATIONS:
                    return currentModel.tools;
                case chat_completion_sources.FIREWORKS:
                    return currentModel.supports_tools;
                case chat_completion_sources.OPENROUTER:
                    return currentModel.supported_parameters?.includes('tools');
                case chat_completion_sources.MISTRALAI:
                    return currentModel.capabilities?.function_calling;
                case chat_completion_sources.AIMLAPI:
                    return currentModel.features?.includes('openai/chat-completion.function');
                case chat_completion_sources.CHUTES:
                    return currentModel.supported_features?.includes('tools');
                case chat_completion_sources.ELECTRONHUB:
                    return currentModel.metadata?.function_call;
            }
        }

        const supportedSources = [
            chat_completion_sources.OPENAI,
            chat_completion_sources.CUSTOM,
            chat_completion_sources.MISTRALAI,
            chat_completion_sources.CLAUDE,
            chat_completion_sources.OPENROUTER,
            chat_completion_sources.AIMLAPI,
            chat_completion_sources.GROQ,
            chat_completion_sources.COHERE,
            chat_completion_sources.DEEPSEEK,
            chat_completion_sources.MAKERSUITE,
            chat_completion_sources.VERTEXAI,
            chat_completion_sources.AI21,
            chat_completion_sources.XAI,
            chat_completion_sources.POLLINATIONS,
            chat_completion_sources.MOONSHOT,
            chat_completion_sources.FIREWORKS,
            chat_completion_sources.COMETAPI,
            chat_completion_sources.CHUTES,
            chat_completion_sources.ELECTRONHUB,
            chat_completion_sources.AZURE_OPENAI,
            chat_completion_sources.ZAI,
            chat_completion_sources.SILICONFLOW,
        ];
        return supportedSources.includes(settings.chat_completion_source);
    }

    /**
     * Checks if tool calls can be performed for the current settings and generation type.
     * @param {string} type Generation type
     * @param {ChatCompletionSettings} settings Optional chat completion settings
     * @param {string} model Optional model name
     * @returns {boolean} Whether tool calls can be performed for the given type
     */
    static canPerformToolCalls(type, settings = null, model = null) {
        settings = settings ?? oai_settings;
        model = model ?? getChatCompletionModel(settings);
        const noToolCallTypes = ['impersonate', 'quiet', 'continue'];
        const isSupported = ToolManager.isToolCallingSupported(settings, model);
        return isSupported && !noToolCallTypes.includes(type);
    }

    /**
     * Utility function to get tool calls from the response data.
     * @param {any} data Response data
     * @returns {any[]} Tool calls from the response data
     */
    static #getToolCallsFromData(data) {
        const getRandomId = () => Math.random().toString(36).substring(2);
        const isClaudeToolCall = c => Array.isArray(c) ? c.filter(x => x).every(isClaudeToolCall) : c?.input && c?.name && c?.id;
        const isGoogleToolCall = c => Array.isArray(c) ? c.filter(x => x).every(isGoogleToolCall) : c?.name && c?.args;
        const convertClaudeToolCall = c => ({ id: c.id, function: { name: c.name, arguments: c.input } });
        const convertGoogleToolCall = (c) => ({ id: getRandomId(), function: { name: c.name, arguments: c.args } });

        // Parsed tool calls from streaming data
        if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0])) {
            if (isClaudeToolCall(data[0])) {
                return data[0].filter(x => x).map(convertClaudeToolCall);
            }

            if (isGoogleToolCall(data[0])) {
                return data[0].filter(x => x).map(convertGoogleToolCall);
            }

            if (typeof data[0]?.[0]?.tool_calls === 'object') {
                return Array.isArray(data[0]?.[0]?.tool_calls) ? data[0][0].tool_calls : [data[0][0].tool_calls];
            }

            return data[0];
        }

        // Google AI Studio tool calls
        if (Array.isArray(data?.responseContent?.parts)) {
            return data.responseContent.parts.filter(p => p.functionCall).map(p => convertGoogleToolCall(p.functionCall));
        }

        // Parsed tool calls from non-streaming data
        if (Array.isArray(data?.choices)) {
            // Find a choice with 0-index
            const choice = data.choices.find(choice => choice.index === 0);

            if (choice) {
                return choice.message.tool_calls;
            }
        }

        // Claude tool calls to OpenAI tool calls
        if (Array.isArray(data?.content)) {
            const content = data.content.filter(c => c.type === 'tool_use').map(convertClaudeToolCall);

            if (content) {
                return content;
            }
        }

        // Cohere tool calls
        if (typeof data?.message?.tool_calls === 'object') {
            return Array.isArray(data?.message?.tool_calls) ? data.message.tool_calls : [data.message.tool_calls];
        }
    }

    /**
     * Checks if the response data contains tool calls.
     * @param {object} data Response data
     * @returns {boolean} Whether the response data contains tool calls
     */
    static hasToolCalls(data) {
        const toolCalls = ToolManager.#getToolCallsFromData(data);
        return Array.isArray(toolCalls) && toolCalls.length > 0;
    }

    /**
     * Check for function tool calls in the response data and invoke them.
     * @param {any} data Reply data
     * @returns {Promise<ToolInvocationResult>} Successful tool invocations
     */
    static async invokeFunctionTools(data, { reasoningText = null } = {}) {
        /** @type {ToolInvocationResult} */
        const result = {
            invocations: [],
            errors: [],
            stealthCalls: [],
        };
        const toolCalls = ToolManager.#getToolCallsFromData(data);

        if (!Array.isArray(toolCalls)) {
            return result;
        }

        for (const toolCall of toolCalls) {
            if (!toolCall || !toolCall.function || typeof toolCall.function !== 'object') {
                continue;
            }

            console.log('[ToolManager] Function tool call:', toolCall);
            const id = toolCall.id;
            const parameters = toolCall.function.arguments;
            const name = toolCall.function.name;
            const displayName = ToolManager.getDisplayName(name);
            const isStealth = ToolManager.isStealthTool(name);
            const message = await ToolManager.formatToolCallMessage(name, parameters);
            const toast = message && toastr.info(message, 'Tool Calling', { timeOut: 0 });
            const toolResult = await ToolManager.invokeFunctionTool(name, parameters);
            toastr.clear(toast);
            console.log('[ToolManager] Function tool result:', result);

            // Handle tool errors — still create an invocation so the LLM sees the failure
            if (toolResult instanceof Error) {
                result.errors.push(toolResult);
                if (isStealth) {
                    result.stealthCalls.push(name);
                } else {
                    result.invocations.push({
                        id,
                        displayName,
                        name,
                        parameters: stringify(parameters),
                        result: toolResult.toString(),
                        error: true,
                        signature: toolCall.signature || null,
                        reasoning: reasoningText || null,
                    });
                }
                continue;
            }

            // Don't save stealth tool invocations
            if (isStealth) {
                result.stealthCalls.push(name);
                continue;
            }

            const invocation = {
                id,
                displayName,
                name,
                parameters: stringify(parameters),
                result: toolResult,
                error: false,
                signature: toolCall.signature || null,
                reasoning: reasoningText || null,
            };
            result.invocations.push(invocation);
        }

        return result;
    }

    /**
     * Groups tool names by count.
     * @param {string[]} toolNames Tool names
     * @returns {string} Grouped tool names
     */
    static #groupToolNames(toolNames) {
        const toolCounts = toolNames.reduce((acc, name) => {
            acc[name] = (acc[name] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(toolCounts).map(([name, count]) => count > 1 ? `${name} (${count})` : name).join(', ');
    }

    /**
     * Formats a message with tool invocations.
     * @param {ToolInvocation[]} invocations Tool invocations.
     * @returns {string} Formatted message with tool invocations.
     */
    static #formatToolInvocationMessage(invocations) {
        const data = structuredClone(invocations);
        const detailsElement = document.createElement('details');
        const summaryElement = document.createElement('summary');
        const preElement = document.createElement('pre');
        const codeElement = document.createElement('code');
        codeElement.classList.add('language-json');
        data.forEach(i => {
            i.parameters = tryParse(i.parameters);
            i.result = tryParse(i.result);
        });
        codeElement.textContent = JSON.stringify(data, null, 2);
        const toolNames = data.map(i => i.displayName || i.name);
        summaryElement.textContent = `Tool calls: ${this.#groupToolNames(toolNames)}`;
        preElement.append(codeElement);
        detailsElement.append(summaryElement, preElement);
        return detailsElement.outerHTML;
    }

    /**
     * Builds a downloadable sandbox URL for a media filepath.
     * @param {string} filepath Sandbox-relative path.
     * @param {string} [workspace]
     * @param {string} [character]
     * @returns {string}
     */
    static #getSandboxMediaUrl(filepath, workspace, character) {
        const params = new URLSearchParams({
            file: String(filepath ?? ''),
            workspace: String(workspace ?? getCurrentSandboxWorkspace() ?? ''),
            character: String(character ?? getCurrentSandboxCharacterName() ?? ''),
        });
        return `/api/extensions/tools/download?${params.toString()}`;
    }

    /**
     * Extracts image media attachments from tool invocation results.
     * @param {ToolInvocation[]} invocations
     * @returns {Array<{ url: string, type: string, title: string, source: string }>}
     */
    static #extractToolInvocationMedia(invocations) {
        const media = [];
        for (const invocation of invocations) {
            const parsed = tryParse(invocation.result);
            if (!parsed || typeof parsed !== 'object') {
                continue;
            }

            const screenshots = [];
            if (parsed.type === 'image_display' && parsed.filepath) {
                screenshots.push(parsed);
            }
            if (parsed.screenshot?.filepath) {
                screenshots.push(parsed.screenshot);
            }
            if (parsed.opened_tab_screenshot?.filepath) {
                screenshots.push(parsed.opened_tab_screenshot);
            }
            if (parsed.downloaded_file?.filepath) {
                screenshots.push(parsed.downloaded_file);
            }

            for (const screenshot of screenshots) {
                const url = this.#getSandboxMediaUrl(screenshot.filepath, screenshot.workspace, screenshot.character);
                media.push({
                    url,
                    type: 'image',
                    title: screenshot.filepath,
                    source: 'api',
                });
            }
        }
        return media;
    }

    /**
     * Saves function tool invocations to the last user chat message extra metadata.
     * @param {ToolInvocation[]} invocations Successful tool invocations
     */
    static async saveFunctionToolInvocations(invocations) {
        if (!Array.isArray(invocations) || invocations.length === 0) {
            return;
        }
        const message = {
            name: systemUserName,
            force_avatar: system_avatar,
            is_system: true,
            is_user: false,
            mes: ToolManager.#formatToolInvocationMessage(invocations),
            extra: {
                isSmallSys: true,
                tool_invocations: invocations,
                is_tool_result: true,
                media: ToolManager.#extractToolInvocationMedia(invocations),
            },
        };
        chat.push(message);
        await eventSource.emit(event_types.TOOL_CALLS_PERFORMED, invocations);
        addOneMessage(message);
        await eventSource.emit(event_types.TOOL_CALLS_RENDERED, invocations);
        await saveChatConditional();
    }

    /**
     * Shows an error message for tool calls.
     * @param {Error[]} errors Errors that occurred during tool invocation
     * @returns {void}
     */
    static showToolCallError(errors) {
        toastr.error('An error occurred while invoking function tools. Click here for more details.', 'Tool Calling', {
            onclick: () => Popup.show.text('Tool Calling Errors', DOMPurify.sanitize(errors.map(e => `${e.cause}: ${e.message}`).join('<br>'))),
            timeOut: 5000,
        });
    }

    static initToolSlashCommands() {
        return this.registerNativeToolCommand();
    }

    static unregisterNativeToolCommand() {
        this.#tools.clear();
        SlashCommandParser.removeCommand('tools-list');
        SlashCommandParser.removeCommand('tools-invoke');
        SlashCommandParser.removeCommand('tools-register');
        SlashCommandParser.removeCommand('tools-unregister');
    }

    static registerNativeToolCommand() {
        // First, unregister any existing tool commands to ensure a clean slate.
        this.unregisterNativeToolCommand();

        // Now, register the built-in tools based on current settings
        registerBuiltinTools();

        const toolsEnumProvider = () => ToolManager.tools.map(tool => {
            const toolOpenAI = tool.toFunctionOpenAI();
            return new SlashCommandEnumValue(toolOpenAI.function.name, toolOpenAI.function.description, enumTypes.enum, enumIcons.closure);
        });

        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
            name: 'tools-list',
            aliases: ['tool-list'],
            helpString: 'Gets a list of all registered tools in the OpenAI function JSON format. Use the <code>return</code> argument to specify the return value type.',
            returns: 'A list of all registered tools.',
            namedArgumentList: [
                SlashCommandNamedArgument.fromProps({
                    name: 'return',
                    description: 'The way how you want the return value to be provided',
                    typeList: [ARGUMENT_TYPE.STRING],
                    defaultValue: 'none',
                    enumList: slashCommandReturnHelper.enumList({ allowObject: true }),
                    forceEnum: true,
                }),
            ],
            callback: async (args) => {
                /** @type {any} */
                const returnType = String(args?.return ?? 'popup-html').trim().toLowerCase();
                const objectToStringFunc = (tools) => Array.isArray(tools) ? tools.map(x => x.toString()).join('\n\n') : tools.toString();
                const tools = ToolManager.tools.map(tool => tool.toFunctionOpenAI());
                return await slashCommandReturnHelper.doReturn(returnType ?? 'popup-html', tools ?? [], { objectToStringFunc });
            },
        }));

        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
            name: 'tools-invoke',
            aliases: ['tool-invoke'],
            helpString: 'Invokes a registered tool by name. The <code>parameters</code> argument MUST be a JSON-serialized object.',
            namedArgumentList: [
                SlashCommandNamedArgument.fromProps({
                    name: 'parameters',
                    description: 'The parameters to pass to the tool.',
                    typeList: [ARGUMENT_TYPE.DICTIONARY],
                    isRequired: true,
                    acceptsMultiple: false,
                }),
            ],
            unnamedArgumentList: [
                SlashCommandArgument.fromProps({
                    description: 'The name of the tool to invoke.',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: true,
                    acceptsMultiple: false,
                    forceEnum: true,
                    enumProvider: toolsEnumProvider,
                }),
            ],
            callback: async (args, name) => {
                const { parameters } = args;

                const result = await ToolManager.invokeFunctionTool(String(name), parameters);
                if (result instanceof Error) {
                    throw result;
                }

                return result;
            },
        }));

        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
            name: 'tools-register',
            aliases: ['tool-register'],
            helpString: `<div>Registers a new tool with the tool registry.</div>
                <ul>
                    <li>The <code>parameters</code> argument MUST be a JSON-serialized object with a valid JSON schema.</li>
                    <li>The unnamed argument MUST be a closure that accepts the function parameters as local script variables.</li>
                </ul>
                <div>See <a target="_blank" href="https://json-schema.org/learn/">json-schema.org</a> and <a target="_blank" href="https://platform.openai.com/docs/guides/function-calling">OpenAI Function Calling</a> for more information.</div>
                <div>Example:</div>
                <pre><code>/let key=echoSchema
{
    "$schema": "http://json-schema.org/draft-04/schema#",
    "type": "object",
    "properties": {
        "message": {
            "type": "string",
            "description": "The message to echo."
        }
    },
    "required": [
        "message"
    ]
}
||
/tools-register name=Echo description="Echoes a message. Call when the user is asking to repeat something" parameters={{var::echoSchema}} {: /echo {{var::arg.message}} :}</code></pre>`,
            namedArgumentList: [
                SlashCommandNamedArgument.fromProps({
                    name: 'name',
                    description: 'The name of the tool.',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: true,
                    acceptsMultiple: false,
                }),
                SlashCommandNamedArgument.fromProps({
                    name: 'description',
                    description: 'A description of what the tool does.',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: true,
                    acceptsMultiple: false,
                }),
                SlashCommandNamedArgument.fromProps({
                    name: 'parameters',
                    description: 'The parameters for the tool.',
                    typeList: [ARGUMENT_TYPE.DICTIONARY],
                    isRequired: true,
                    acceptsMultiple: false,
                }),
                SlashCommandNamedArgument.fromProps({
                    name: 'displayName',
                    description: 'The display name of the tool.',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: false,
                    acceptsMultiple: false,
                }),
                SlashCommandNamedArgument.fromProps({
                    name: 'formatMessage',
                    description: 'The closure to be executed to format the tool call message. Must return a string.',
                    typeList: [ARGUMENT_TYPE.CLOSURE],
                    isRequired: true,
                    acceptsMultiple: false,
                }),
                SlashCommandNamedArgument.fromProps({
                    name: 'shouldRegister',
                    description: 'The closure to be executed to determine if the tool should be registered. Must return a boolean.',
                    typeList: [ARGUMENT_TYPE.CLOSURE],
                    isRequired: false,
                    acceptsMultiple: false,
                }),
                SlashCommandNamedArgument.fromProps({
                    name: 'stealth',
                    description: 'If true, a tool call result will not be shown in the chat and no follow-up generation will be performed.',
                    typeList: [ARGUMENT_TYPE.BOOLEAN],
                    isRequired: false,
                    acceptsMultiple: false,
                    defaultValue: String(false),
                }),
            ],
            unnamedArgumentList: [
                SlashCommandArgument.fromProps({
                    description: 'The closure to be executed when the tool is invoked.',
                    typeList: [ARGUMENT_TYPE.CLOSURE],
                    isRequired: true,
                    acceptsMultiple: false,
                }),
            ],
            callback: async (args, action) => {
                /**
                 * Converts a slash command closure to a function.
                 * @param {SlashCommandClosure} action Closure to convert to a function
                 * @param {function(any): any} convertResult Function to convert the result
                 * @returns {function} Function that executes the closure
                 */
                function closureToFunction(action, convertResult) {
                    return async (args) => {
                        const localClosure = action.getCopy();
                        localClosure.onProgress = () => { };
                        const scope = localClosure.scope;
                        if (typeof args === 'object' && args !== null) {
                            assignNestedVariables(scope, args, 'arg');
                        } else if (typeof args !== 'undefined') {
                            scope.letVariable('arg', args);
                        }
                        const result = await localClosure.execute();
                        return convertResult(result.pipe);
                    };
                }

                const { name, displayName, description, parameters, formatMessage, shouldRegister, stealth } = args;

                if (!(action instanceof SlashCommandClosure)) {
                    throw new Error('The unnamed argument must be a closure.');
                }
                if (typeof name !== 'string' || !name) {
                    throw new Error('The "name" argument must be a non-empty string.');
                }
                if (typeof description !== 'string' || !description) {
                    throw new Error('The "description" argument must be a non-empty string.');
                }
                if (typeof parameters !== 'string' || !isJson(parameters)) {
                    throw new Error('The "parameters" argument must be a JSON-serialized object.');
                }
                if (displayName && typeof displayName !== 'string') {
                    throw new Error('The "displayName" argument must be a string.');
                }
                if (formatMessage && !(formatMessage instanceof SlashCommandClosure)) {
                    throw new Error('The "formatMessage" argument must be a closure.');
                }
                if (shouldRegister && !(shouldRegister instanceof SlashCommandClosure)) {
                    throw new Error('The "shouldRegister" argument must be a closure.');
                }

                const actionFunc = closureToFunction(action, x => x);
                const formatMessageFunc = formatMessage instanceof SlashCommandClosure ? closureToFunction(formatMessage, x => String(x)) : null;
                const shouldRegisterFunc = shouldRegister instanceof SlashCommandClosure ? closureToFunction(shouldRegister, x => isTrueBoolean(x)) : null;

                ToolManager.registerFunctionTool({
                    name: String(name ?? ''),
                    displayName: String(displayName ?? ''),
                    description: String(description ?? ''),
                    parameters: JSON.parse(parameters ?? '{}'),
                    action: actionFunc,
                    formatMessage: formatMessageFunc,
                    shouldRegister: shouldRegisterFunc,
                    stealth: stealth && isTrueBoolean(String(stealth)),
                });

                return '';
            },
        }));

        SlashCommandParser.addCommandObject(SlashCommand.fromProps({
            name: 'tools-unregister',
            aliases: ['tool-unregister'],
            helpString: 'Unregisters a tool from the tool registry.',
            unnamedArgumentList: [
                SlashCommandArgument.fromProps({
                    description: 'The name of the tool to unregister.',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: true,
                    acceptsMultiple: false,
                    forceEnum: true,
                    enumProvider: toolsEnumProvider,
                }),
            ],
            callback: async (_, name) => {
                if (typeof name !== 'string' || !name) {
                    throw new Error('The unnamed argument must be a non-empty string.');
                }

                ToolManager.unregisterFunctionTool(name);
                return '';
            },
        }));
    }
}

let sandboxWorkspaceSelectorInitialized = false;

function getSandboxWorkspaceSelectElement() {
    const element = document.getElementById('sandbox_workspace_select');
    return element instanceof HTMLSelectElement ? element : null;
}

async function fetchSandboxWorkspaces() {
    try {
        const response = await fetch('/api/extensions/tools/workspaces', {
            method: 'GET',
            headers: getRequestHeaders(),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to load workspaces.' }));
            throw new Error(error.error || 'Failed to load workspaces.');
        }

        const result = await response.json();
        return Array.isArray(result.workspaces) ? result.workspaces : [];
    } catch (error) {
        console.error('Failed to fetch sandbox workspaces:', error);
        toastr.error(`Failed to fetch sandbox workspaces: ${error.message}`);
        return [];
    }
}

async function createSandboxWorkspace(workspace) {
    try {
        const response = await fetch('/api/extensions/tools/listdir', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ path: '.', workspace }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Failed to create workspace.' }));
            throw new Error(error.error || 'Failed to create workspace.');
        }

        return true;
    } catch (error) {
        console.error('Failed to create workspace:', error);
        toastr.error(`Failed to create workspace: ${error.message}`);
        return false;
    }
}

function getMetadataWorkspace() {
    return typeof chat_metadata?.sandbox_workspace === 'string'
        ? chat_metadata.sandbox_workspace.trim()
        : '';
}

async function refreshSandboxWorkspaceSelector({ persistDefault = false } = {}) {
    const select = getSandboxWorkspaceSelectElement();
    if (!select) {
        return;
    }

    const assistantRootContext = getDefaultSandboxWorkspace() === SANDBOX_ROOT_WORKSPACE;
    const metadataWorkspace = getMetadataWorkspace();
    const fallbackWorkspace = getDefaultSandboxWorkspace();
    const selectedWorkspace = assistantRootContext
        ? SANDBOX_ROOT_WORKSPACE
        : (metadataWorkspace || fallbackWorkspace);
    const needsPersist = !metadataWorkspace || (assistantRootContext && metadataWorkspace !== SANDBOX_ROOT_WORKSPACE);

    if (needsPersist) {
        chat_metadata.sandbox_workspace = selectedWorkspace;
        if (persistDefault) {
            await saveChatConditional();
        }
    }

    const workspaceNames = await fetchSandboxWorkspaces();
    const uniqueWorkspaces = [...new Set(workspaceNames.map(x => String(x || '').trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));

    if (!assistantRootContext && selectedWorkspace !== SANDBOX_ROOT_WORKSPACE && !uniqueWorkspaces.includes(selectedWorkspace)) {
        uniqueWorkspaces.unshift(selectedWorkspace);
    }

    select.dataset.loading = 'true';
    select.innerHTML = '';

    const rootOption = document.createElement('option');
    rootOption.value = SANDBOX_ROOT_WORKSPACE;
    rootOption.textContent = 'root';
    select.append(rootOption);

    if (!assistantRootContext) {
        for (const workspace of uniqueWorkspaces) {
            if (workspace === SANDBOX_ROOT_WORKSPACE) {
                continue;
            }

            const option = document.createElement('option');
            option.value = workspace;
            option.textContent = workspace;
            select.append(option);
        }

        const separator = document.createElement('option');
        separator.value = WORKSPACE_SEPARATOR_OPTION;
        separator.textContent = '──────────────';
        separator.disabled = true;
        select.append(separator);

        const createOption = document.createElement('option');
        createOption.value = NEW_WORKSPACE_OPTION;
        createOption.textContent = '+ New workspace...';
        select.append(createOption);
    }

    select.value = selectedWorkspace;
    select.dataset.previousWorkspace = selectedWorkspace;
    select.disabled = false;
    select.removeAttribute('data-loading');
}

async function onSandboxWorkspaceChange(event) {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement) || select.dataset.loading === 'true') {
        return;
    }

    const selectedValue = String(select.value || '').trim();
    const previousWorkspace = select.dataset.previousWorkspace || getCurrentSandboxWorkspace();

    if (!selectedValue || selectedValue === WORKSPACE_SEPARATOR_OPTION) {
        select.value = previousWorkspace;
        return;
    }

    if (selectedValue === NEW_WORKSPACE_OPTION) {
        const input = await Popup.show.input('New Workspace', 'Enter a name for the new workspace:');
        if (!input) {
            select.value = previousWorkspace;
            return;
        }

        const sanitized = await getSanitizedFilename(String(input));
        const workspace = String(sanitized || '').trim();
        if (!workspace) {
            toastr.warning('Workspace name cannot be empty.');
            select.value = previousWorkspace;
            return;
        }

        const created = await createSandboxWorkspace(workspace);
        if (!created) {
            select.value = previousWorkspace;
            return;
        }

        chat_metadata.sandbox_workspace = workspace;
        await saveChatConditional();
        await refreshSandboxWorkspaceSelector();
        return;
    }

    if (selectedValue === previousWorkspace) {
        return;
    }

    chat_metadata.sandbox_workspace = selectedValue;
    select.dataset.previousWorkspace = selectedValue;
    await saveChatConditional();
}

async function initSandboxWorkspaceSelector() {
    const select = getSandboxWorkspaceSelectElement();
    if (!select) {
        return;
    }

    if (!sandboxWorkspaceSelectorInitialized) {
        select.addEventListener('change', onSandboxWorkspaceChange);
        sandboxWorkspaceSelectorInitialized = true;
    }

    await refreshSandboxWorkspaceSelector();
}

export function initToolCalling() {
    eventSource.on(event_types.DANGEROUS_TOOLS_TOGGLED, () => {
        // Only refresh the native tool commands if the feature is currently active.
        if (oai_settings.native_tool_calling) {
            ToolManager.registerNativeToolCommand();
        }
    });

    eventSource.on(event_types.IMAGE_GENERATION_TOGGLED, () => {
        if (oai_settings.native_tool_calling) {
            ToolManager.registerNativeToolCommand();
        }
    });

    eventSource.on(event_types.BROWSER_TOOLS_TOGGLED, () => {
        if (oai_settings.native_tool_calling) {
            ToolManager.registerNativeToolCommand();
        }
    });

    // Refresh tool registration after all settings (including power_user) have been loaded.
    eventSource.on(event_types.SETTINGS_LOADED_AFTER, async () => {
        await initSandboxWorkspaceSelector();
        if (oai_settings.native_tool_calling) {
            ToolManager.registerNativeToolCommand();
        }
    });

    eventSource.on(event_types.CHAT_CHANGED, async () => {
        await refreshSandboxWorkspaceSelector({ persistDefault: true });
    });
}
