import { Handlebars, moment, seedrandom, droll } from '../lib.js';
import { chat, chat_metadata, main_api, getMaxContextSize, getCurrentChatId, substituteParams, eventSource, event_types } from '../script.js';
import { timestampToMoment, isDigitsOnly, getStringHash, escapeRegex, uuidv4 } from './utils.js';
import { textgenerationwebui_banned_in_macros } from './textgen-settings.js';
import { getInstructMacros } from './instruct-mode.js';
import { getVariableMacros } from './variables.js';
import { isMobile } from './RossAscends-mods.js';

/**
 * @typedef Macro
 * @property {RegExp} regex - Regular expression to match the macro
 * @property {(substring: string, ...args: any[]) => string} replace - Function to replace the macro
 */

// Register any macro that you want to leave in the compiled story string
Handlebars.registerHelper('trim', () => '{{trim}}');
// Catch-all helper for any macro that is not defined for story strings
Handlebars.registerHelper('helperMissing', function () {
    const options = arguments[arguments.length - 1];
    const macroName = options.name;
    return substituteParams(`{{${macroName}}}`);
});

/**
 * @typedef {Object<string, *>} EnvObject
 * @typedef {(nonce: string) => string} MacroFunction
 */

/**
 * @typedef {Object} CustomMacro
 * @property {string} key - Macro name (key)
 * @property {string} description - Optional description of the macro
 */

export class MacrosParser {
    /**
     * A map of registered macros.
     * @type {Map<string, string|MacroFunction>}
     */
    static #macros = new Map();

    /**
     * A map of macro descriptions.
     * @type {Map<string, string>}
     */
    static #descriptions = new Map();

    /**
     * Returns an iterator over all registered macros.
     * @returns {IterableIterator<CustomMacro>}
     */
    static [Symbol.iterator] = function* () {
        for (const macro of MacrosParser.#macros.keys()) {
            yield { key: macro, description: MacrosParser.#descriptions.get(macro) };
        }
    };

    /**
     * Registers a global macro that can be used anywhere where substitution is allowed.
     * @param {string} key Macro name (key)
     * @param {string|MacroFunction} value A string or a function that returns a string
     * @param {string} [description] Optional description of the macro
     */
    static registerMacro(key, value, description = '') {
        if (typeof key !== 'string') {
            throw new Error('Macro key must be a string');
        }

        // Allowing surrounding whitespace would just create more confusion...
        key = key.trim();

        if (!key) {
            throw new Error('Macro key must not be empty or whitespace only');
        }

        if (key.startsWith('{{') || key.endsWith('}}')) {
            throw new Error('Macro key must not include the surrounding braces');
        }

        if (typeof value !== 'string' && typeof value !== 'function') {
            console.warn(`Macro value for "${key}" will be converted to a string`);
            value = this.sanitizeMacroValue(value);
        }

        if (this.#macros.has(key)) {
            console.warn(`Macro ${key} is already registered`);
        }

        this.#macros.set(key, value);

        if (typeof description === 'string' && description) {
            this.#descriptions.set(key, description);
        }
    }

    /**
     * Unregisters a global macro with the given key
     *
     * @param {string} key Macro name (key)
     */
    static unregisterMacro(key) {
        if (typeof key !== 'string') {
            throw new Error('Macro key must be a string');
        }

        // Allowing surrounding whitespace would just create more confusion...
        key = key.trim();

        if (!key) {
            throw new Error('Macro key must not be empty or whitespace only');
        }

        const deleted = this.#macros.delete(key);

        if (!deleted) {
            console.warn(`Macro ${key} was not registered`);
        }

        this.#descriptions.delete(key);
    }

    /**
     * Populate the env object with macro values from the current context.
     * @param {EnvObject} env Env object for the current evaluation context
     * @returns {void}
     */
    static populateEnv(env) {
        if (!env || typeof env !== 'object') {
            console.warn('Env object is not provided');
            return;
        }

        // No macros are registered
        if (this.#macros.size === 0) {
            return;
        }

        for (const [key, value] of this.#macros) {
            env[key] = value;
        }
    }

    /**
     * Performs a type-check on the macro value and returns a sanitized version of it.
     * @param {any} value Value returned by a macro
     * @returns {string} Sanitized value
     */
    static sanitizeMacroValue(value) {
        if (typeof value === 'string') {
            return value;
        }

        if (value === null || value === undefined) {
            return '';
        }

        if (value instanceof Promise) {
            console.warn('Promises are not supported as macro values');
            return '';
        }

        if (typeof value === 'function') {
            console.warn('Functions are not supported as macro values');
            return '';
        }

        if (value instanceof Date) {
            return value.toISOString();
        }

        if (typeof value === 'object') {
            return JSON.stringify(value);
        }

        return String(value);
    }
}

/**
 * Gets a hashed id of the current chat from the metadata.
 * If no metadata exists, creates a new hash and saves it.
 * @returns {number} The hashed chat id
 */
function getChatIdHash() {
    const cachedIdHash = chat_metadata['chat_id_hash'];

    // If chat_id_hash is not already set, calculate it
    if (!cachedIdHash) {
        // Use the main_chat if it's available, otherwise get the current chat ID
        const chatId = chat_metadata['main_chat'] ?? getCurrentChatId();
        const chatIdHash = getStringHash(chatId);
        chat_metadata['chat_id_hash'] = chatIdHash;
        return chatIdHash;
    }

    return cachedIdHash;
}

/**
 * Returns the ID of the last message in the chat
 *
 * Optionally can only choose specific messages, if a filter is provided.
 *
 * @param {object} param0 - Optional arguments
 * @param {boolean} [param0.exclude_swipe_in_propress=true] - Whether a message that is currently being swiped should be ignored
 * @param {function(object):boolean} [param0.filter] - A filter applied to the search, ignoring all messages that don't match the criteria. For example to only find user messages, etc.
 * @returns {number|null} The message id, or null if none was found
 */
export function getLastMessageId({ exclude_swipe_in_propress = true, filter = null } = {}) {
    for (let i = chat?.length - 1; i >= 0; i--) {
        let message = chat[i];

        // If ignoring swipes and the message is being swiped, continue
        // We can check if a message is being swiped by checking whether the current swipe id is not in the list of finished swipes yet
        if (exclude_swipe_in_propress && message.swipes && message.swipe_id >= message.swipes.length) {
            continue;
        }

        // Check if no filter is provided, or if the message passes the filter
        if (!filter || filter(message)) {
            return i;
        }
    }

    return null;
}

/**
 * Returns the ID of the first message included in the context
 *
 * @returns {number|null} The ID of the first message in the context
 */
function getFirstIncludedMessageId() {
    return chat_metadata['lastInContextMessageId'];
}

/**
 * Returns the ID of the first displayed message in the chat.
 *
 * @returns {number|null} The ID of the first displayed message
 */
function getFirstDisplayedMessageId() {
    const mesId = Number(document.querySelector('#chat .mes')?.getAttribute('mesid'));

    if (!isNaN(mesId) && mesId >= 0) {
        return mesId;
    }

    return null;
}

/**
 * Returns the last message in the chat
 *
 * @returns {string} The last message in the chat
 */
function getLastMessage() {
    const mid = getLastMessageId();
    return chat[mid]?.mes ?? '';
}

/**
 * Returns the last message from the user
 *
 * @returns {string} The last message from the user
 */
function getLastUserMessage() {
    const mid = getLastMessageId({ filter: m => m.is_user && !m.is_system });
    return chat[mid]?.mes ?? '';
}

/**
 * Returns the last message from the bot
 *
 * @returns {string} The last message from the bot
 */
function getLastCharMessage() {
    const mid = getLastMessageId({ filter: m => !m.is_user && !m.is_system });
    return chat[mid]?.mes ?? '';
}

/**
 * Returns the 1-based ID (number) of the last swipe
 *
 * @returns {number|null} The 1-based ID of the last swipe
 */
function getLastSwipeId() {
    // For swipe macro, we are accepting using the message that is currently being swiped
    const mid = getLastMessageId({ exclude_swipe_in_propress: false });
    const swipes = chat[mid]?.swipes;
    return swipes?.length;
}

/**
 * Returns the 1-based ID (number) of the current swipe
 *
 * @returns {number|null} The 1-based ID of the current swipe
 */
function getCurrentSwipeId() {
    // For swipe macro, we are accepting using the message that is currently being swiped
    const mid = getLastMessageId({ exclude_swipe_in_propress: false });
    const swipeId = chat[mid]?.swipe_id;
    return swipeId !== null ? swipeId + 1 : null;
}

/**
 * Replaces banned words in macros with an empty string.
 * Adds them to textgenerationwebui ban list.
 * @returns {Macro}
 */
function getBannedWordsMacro() {
    const banPattern = /{{banned "(.*)"}}/gi;
    const banReplace = (match, bannedWord) => {
        if (main_api == 'textgenerationwebui') {
            console.log('Found banned word in macros: ' + bannedWord);
            textgenerationwebui_banned_in_macros.push(bannedWord);
        }
        return '';
    };

    return { regex: banPattern, replace: banReplace };
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

/**
 * Returns a macro that picks a random item from a list.
 * @returns {Macro} The random replace macro
 */
function getRandomReplaceMacro() {
    const randomPattern = /{{random\s?::?([^}]+)}}/gi;
    const randomReplace = (match, listString) => {
        // Split on either double colons or comma. If comma is the separator, we are also trimming all items.
        const list = listString.includes('::')
            ? listString.split('::')
            // Replaced escaped commas with a placeholder to avoid splitting on them
            : listString.replace(/\\,/g, '##�COMMA�##').split(',').map(item => item.trim().replace(/##�COMMA�##/g, ','));

        if (list.length === 0) {
            return '';
        }
        const rng = seedrandom('added entropy.', { entropy: true });
        const randomIndex = Math.floor(rng() * list.length);
        return list[randomIndex];
    };

    return { regex: randomPattern, replace: randomReplace };
}

/**
 * Returns a macro that picks a random item from a list with a consistent seed.
 * @param {string} rawContent The raw content of the string
 * @returns {Macro} The pick replace macro
 */
function getPickReplaceMacro(rawContent) {
    // We need to have a consistent chat hash, otherwise we'll lose rolls on chat file rename or branch switches
    // No need to save metadata here - branching and renaming will implicitly do the save for us, and until then loading it like this is consistent
    const chatIdHash = getChatIdHash();
    const rawContentHash = getStringHash(rawContent);

    const pickPattern = /{{pick\s?::?([^}]+)}}/gi;
    const pickReplace = (match, listString, offset) => {
        // Split on either double colons or comma. If comma is the separator, we are also trimming all items.
        const list = listString.includes('::')
            ? listString.split('::')
            // Replaced escaped commas with a placeholder to avoid splitting on them
            : listString.replace(/\\,/g, '##�COMMA�##').split(',').map(item => item.trim().replace(/##�COMMA�##/g, ','));

        if (list.length === 0) {
            return '';
        }

        // We build a hash seed based on: unique chat file, raw content, and the placement inside this content
        // This allows us to get unique but repeatable picks in nearly all cases
        const combinedSeedString = `${chatIdHash}-${rawContentHash}-${offset}`;
        const finalSeed = getStringHash(combinedSeedString);
        // @ts-ignore - have to use numbers for legacy picks
        const rng = seedrandom(finalSeed);
        const randomIndex = Math.floor(rng() * list.length);
        return list[randomIndex];
    };

    return { regex: pickPattern, replace: pickReplace };
}

/**
 * @returns {Macro} The dire roll macro
 */
function getDiceRollMacro() {
    const rollPattern = /{{roll[ : ]([^}]+)}}/gi;
    const rollReplace = (match, matchValue) => {
        let formula = matchValue.trim();

        if (isDigitsOnly(formula)) {
            formula = `1d${formula}`;
        }

        const isValid = droll.validate(formula);

        if (!isValid) {
            console.debug(`Invalid roll formula: ${formula}`);
            return '';
        }

        const result = droll.roll(formula);
        if (result === false) return '';
        return String(result.total);
    };

    return { regex: rollPattern, replace: rollReplace };
}

/**
 * Returns the difference between two times. Works with any time format acceptable by moment().
 * Can work with {{date}} {{time}} macros
 * @returns {Macro} The time difference macro
 */
function getTimeDiffMacro() {
    const timeDiffPattern = /{{timeDiff::(.*?)::(.*?)}}/gi;
    const timeDiffReplace = (_match, matchPart1, matchPart2) => {
        const time1 = moment(matchPart1);
        const time2 = moment(matchPart2);

        const timeDifference = moment.duration(time1.diff(time2));
        return timeDifference.humanize(true);
    };

    return { regex: timeDiffPattern, replace: timeDiffReplace };
}

/**
 * Substitutes {{macro}} parameters in a string.
 * @param {string} content - The string to substitute parameters in.
 * @param {EnvObject} env - Map of macro names to the values they'll be substituted with. If the param
 * values are functions, those functions will be called and their return values are used.
 * @param {function(string): string} postProcessFn - Function to run on the macro value before replacing it.
 * @returns {string} The string with substituted parameters.
 */
export function evaluateMacros(content, env, postProcessFn) {
    if (!content) {
        return '';
    }

    postProcessFn = typeof postProcessFn === 'function' ? postProcessFn : (x => x);
    const rawContent = content;

    /**
     * Built-ins running before the env variables
     * @type {Macro[]}
     * */
    const preEnvMacros = [
        // Legacy non-curly macros
        { regex: /<USER>/gi, replace: () => typeof env.user === 'function' ? env.user() : env.user },
        { regex: /<BOT>/gi, replace: () => typeof env.char === 'function' ? env.char() : env.char },
        { regex: /<CHAR>/gi, replace: () => typeof env.char === 'function' ? env.char() : env.char },
        { regex: /<CHARIFNOTGROUP>/gi, replace: () => typeof env.group === 'function' ? env.group() : env.group },
        { regex: /<GROUP>/gi, replace: () => typeof env.group === 'function' ? env.group() : env.group },
        getDiceRollMacro(),
        ...getInstructMacros(env),
        ...getVariableMacros(),
        { regex: /{{newline}}/gi, replace: () => '\n' },
        { regex: /(?:\r?\n)*{{trim}}(?:\r?\n)*/gi, replace: () => '' },
        { regex: /{{noop}}/gi, replace: () => '' },
        { regex: /{{input}}/gi, replace: () => String($('#send_textarea').val()) },
    ];

    /**
     * Built-ins running after the env variables
     * @type {Macro[]}
    */
    const postEnvMacros = [
        { regex: /{{maxPrompt}}/gi, replace: () => String(getMaxContextSize()) },
        { regex: /{{lastMessage}}/gi, replace: () => getLastMessage() },
        { regex: /{{lastMessageId}}/gi, replace: () => String(getLastMessageId() ?? '') },
        { regex: /{{lastUserMessage}}/gi, replace: () => getLastUserMessage() },
        { regex: /{{lastCharMessage}}/gi, replace: () => getLastCharMessage() },
        { regex: /{{firstIncludedMessageId}}/gi, replace: () => String(getFirstIncludedMessageId() ?? '') },
        { regex: /{{firstDisplayedMessageId}}/gi, replace: () => String(getFirstDisplayedMessageId() ?? '') },
        { regex: /{{lastSwipeId}}/gi, replace: () => String(getLastSwipeId() ?? '') },
        { regex: /{{currentSwipeId}}/gi, replace: () => String(getCurrentSwipeId() ?? '') },
        { regex: /{{reverse:(.+?)}}/gi, replace: (_, str) => Array.from(str).reverse().join('') },
        { regex: /\{\{\/\/([\s\S]*?)\}\}/gm, replace: () => '' },
        { regex: /{{time}}/gi, replace: () => moment().format('LT') },
        { regex: /{{date}}/gi, replace: () => moment().format('LL') },
        { regex: /{{weekday}}/gi, replace: () => moment().format('dddd') },
        { regex: /{{isotime}}/gi, replace: () => moment().format('HH:mm') },
        { regex: /{{isodate}}/gi, replace: () => moment().format('YYYY-MM-DD') },
        { regex: /{{datetimeformat +([^}]*)}}/gi, replace: (_, format) => moment().format(format) },
        { regex: /{{idle_duration}}/gi, replace: () => getTimeSinceLastMessage() },
        { regex: /{{time_UTC([-+]\d+)}}/gi, replace: (_, offset) => moment().utc().utcOffset(parseInt(offset, 10)).format('LT') },
        getTimeDiffMacro(),
        getBannedWordsMacro(),
        getRandomReplaceMacro(),
        getPickReplaceMacro(rawContent),
    ];

    // Add all registered macros to the env object
    MacrosParser.populateEnv(env);
    const nonce = uuidv4();
    const envMacros = [];

    // Substitute passed-in variables
    for (const varName in env) {
        if (!Object.hasOwn(env, varName)) continue;

        const envRegex = new RegExp(`{{${escapeRegex(varName)}}}`, 'gi');
        const envReplace = () => {
            const param = env[varName];
            const value = MacrosParser.sanitizeMacroValue(typeof param === 'function' ? param(nonce) : param);
            return value;
        };

        envMacros.push({ regex: envRegex, replace: envReplace });
    }

    const macros = [...preEnvMacros, ...envMacros, ...postEnvMacros];

    for (const macro of macros) {
        // Stop if the content is empty
        if (!content) {
            break;
        }

        // Short-circuit if no curly braces are found
        if (!macro.regex.source.startsWith('<') && !content.includes('{{')) {
            break;
        }

        try {
            content = content.replace(macro.regex, (...args) => postProcessFn(macro.replace(...args)));
        } catch (e) {
            console.warn(`Macro content can't be replaced: ${macro.regex} in ${content}`, e);
        }
    }

    return content;
}

export function initMacros() {
    function initLastGenerationType() {
        let lastGenerationType = '';

        MacrosParser.registerMacro('lastGenerationType', () => lastGenerationType);

        eventSource.on(event_types.GENERATION_STARTED, (type, _params, isDryRun) => {
            if (isDryRun) return;
            lastGenerationType = type || 'normal';
        });

        eventSource.on(event_types.CHAT_CHANGED, () => {
            lastGenerationType = '';
        });
    }

    MacrosParser.registerMacro('isMobile', () => String(isMobile()));
    initLastGenerationType();
}
