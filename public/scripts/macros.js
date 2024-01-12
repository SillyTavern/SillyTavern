import { chat, main_api, getMaxContextSize, getCharacterCardFields } from '../script.js';
import { timestampToMoment, isDigitsOnly } from './utils.js';
import { textgenerationwebui_banned_in_macros } from './textgen-settings.js';
import { replaceInstructMacros } from './instruct-mode.js';
import { replaceVariableMacros } from './variables.js';

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
 * Substitutes {{macro}} parameters in a string.
 * @param {string} content - The string to substitute parameters in.
 * @param {*} _name1 - The name of the user.
 * @param {*} _name2 - The name of the character.
 * @param {*} _original - The original message for {{original}} substitution.
 * @param {*} _group - The group members list for {{group}} substitution.
 * @param {boolean} _replaceCharacterCard - Whether to replace character card macros.
 * @returns {string} The string with substituted parameters.
 */
export function evaluateMacros(content, _name1, _name2, _original, _group, _replaceCharacterCard = true) {
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
