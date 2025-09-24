import { characters, substituteParams, substituteParamsExtended, this_chid } from '../../../script.js';
import { extension_settings } from '../../extensions.js';
import { regexFromString } from '../../utils.js';
export {
    regex_placement,
    getRegexedString,
    runRegexScript,
};

/**
 * @enum {number} Where the regex script should be applied
 */
const regex_placement = {
    /**
     * @deprecated MD Display is deprecated. Do not use.
     */
    MD_DISPLAY: 0,
    USER_INPUT: 1,
    AI_OUTPUT: 2,
    SLASH_COMMAND: 3,
    // 4 - sendAs (legacy)
    WORLD_INFO: 5,
    REASONING: 6,
};

export const substitute_find_regex = {
    NONE: 0,
    RAW: 1,
    ESCAPED: 2,
};

function sanitizeRegexMacro(x) {
    return (x && typeof x === 'string') ?
        x.replaceAll(/[\n\r\t\v\f\0.^$*+?{}[\]\\/|()]/gs, function (s) {
            switch (s) {
                case '\n':
                    return '\\n';
                case '\r':
                    return '\\r';
                case '\t':
                    return '\\t';
                case '\v':
                    return '\\v';
                case '\f':
                    return '\\f';
                case '\0':
                    return '\\0';
                default:
                    return '\\' + s;
            }
        }) : x;
}

function getScopedRegex() {
    const isAllowed = extension_settings?.character_allowed_regex?.includes(characters?.[this_chid]?.avatar);

    if (!isAllowed) {
        return [];
    }

    const scripts = characters[this_chid]?.data?.extensions?.regex_scripts;

    if (!Array.isArray(scripts)) {
        return [];
    }

    return scripts;
}

/**
 * Parent function to fetch a regexed version of a raw string
 * @param {string} rawString The raw string to be regexed
 * @param {regex_placement} placement The placement of the string
 * @param {RegexParams} params The parameters to use for the regex script
 * @returns {string} The regexed string
 * @typedef {{characterOverride?: string, isMarkdown?: boolean, isPrompt?: boolean, isEdit?: boolean, depth?: number }} RegexParams The parameters to use for the regex script
 */
function getRegexedString(rawString, placement, { characterOverride, isMarkdown, isPrompt, isEdit, depth } = {}) {
    // WTF have you passed me?
    if (typeof rawString !== 'string') {
        console.warn('getRegexedString: rawString is not a string. Returning empty string.');
        return '';
    }

    let finalString = rawString;
    if (extension_settings.disabledExtensions.includes('regex') || !rawString || placement === undefined) {
        return finalString;
    }

    const allRegex = [...(extension_settings.regex ?? []), ...(getScopedRegex() ?? [])];
    allRegex.forEach((script) => {
        if (
            // Script applies to Markdown and input is Markdown
            (script.markdownOnly && isMarkdown) ||
            // Script applies to Generate and input is Generate
            (script.promptOnly && isPrompt) ||
            // Script applies to all cases when neither "only"s are true
            (!script.markdownOnly && !script.promptOnly)
        ) {
            if (isEdit && !script.runOnEdit) {
                console.debug(`getRegexedString: Skipping script ${script.scriptName} because it does not run on edit`);
                return;
            }

            // Check if the depth is within the min/max depth
            if (typeof depth === 'number') {
                if (!isNaN(script.minDepth) && script.minDepth !== null && script.minDepth >= -1 && depth < script.minDepth) {
                    console.debug(`getRegexedString: Skipping script ${script.scriptName} because depth ${depth} is less than minDepth ${script.minDepth}`);
                    return;
                }

                if (!isNaN(script.maxDepth) && script.maxDepth !== null && script.maxDepth >= 0 && depth > script.maxDepth) {
                    console.debug(`getRegexedString: Skipping script ${script.scriptName} because depth ${depth} is greater than maxDepth ${script.maxDepth}`);
                    return;
                }
            } else {
                // Debug: Log when depth is not a number
                console.debug(`getRegexedString: Script ${script.scriptName} - depth is not a number: ${depth} (typeof: ${typeof depth})`);

                // When depth is null/undefined, treat it as depth 0 for filtering purposes
                // This prevents scripts with minDepth > 0 from running on null depth
                if (depth === null || depth === undefined) {
                    const effectiveDepth = 0;
                    if (!isNaN(script.minDepth) && script.minDepth !== null && script.minDepth >= -1 && effectiveDepth < script.minDepth) {
                        console.debug(`getRegexedString: Skipping script ${script.scriptName} because null depth (treated as ${effectiveDepth}) is less than minDepth ${script.minDepth}`);
                        return;
                    }
                }
            }

            if (script.placement.includes(placement)) {
                // Debug logging for the specific script
                if (script.scriptName === 'Statbox Deletion (Visible)') {
                    console.log(`DEBUG: ${script.scriptName} - Processing with depth: ${depth}, minDepth: ${script.minDepth}, placement: ${placement}, isMarkdown: ${isMarkdown}`);
                }

                const processedString = runRegexScript(script, finalString, { characterOverride });

                // If permanent edit is enabled and this is display-time processing (isMarkdown=true)
                // and the text changed, save it back to the chat file
                if (script.permanentEdit && isMarkdown && processedString !== finalString && typeof depth === 'number') {
                    if (script.scriptName === 'Statbox Deletion (Visible)') {
                        console.log(`DEBUG: ${script.scriptName} - Permanent edit triggered for depth ${depth}`);
                    }
                    updateChatMessagePermanently(placement, characterOverride, depth, processedString, finalString).catch(error => {
                        console.warn('Failed to permanently update chat message:', error);
                    });
                } else if (script.permanentEdit && script.scriptName === 'Statbox Deletion (Visible)') {
                    // Debug: Show why permanent edit was NOT triggered
                    console.log(`DEBUG: ${script.scriptName} - Permanent edit NOT triggered. permanentEdit: ${script.permanentEdit}, isMarkdown: ${isMarkdown}, textChanged: ${processedString !== finalString}, depthIsNumber: ${typeof depth === 'number'}`);
                }

                finalString = processedString;
            }
        }
    });

    return finalString;
}

/**
 * Updates a chat message permanently when permanent edit is enabled
 * @param {number} placement The regex placement type
 * @param {string} characterOverride Character name override
 * @param {number} depth Message depth
 * @param {string} newText The processed text
 * @param {string} originalText The original text
 * @returns {Promise<void>}
 */
async function updateChatMessagePermanently(placement, characterOverride, depth, newText, originalText) {
    try {
        // Import chat array and substituteParams from main script
        const { chat, saveChatConditional, substituteParams } = await import('../../../script.js');

        // Calculate message index from depth
        const messageIndex = chat.length - depth - 1;

        if (messageIndex >= 0 && messageIndex < chat.length) {
            const message = chat[messageIndex];

            // Verify this is the right message type for the placement
            const isCorrectType = (
                (placement === regex_placement.USER_INPUT && message.is_user) ||
                (placement === regex_placement.AI_OUTPUT && !message.is_user && !message.is_system) ||
                (placement === regex_placement.SLASH_COMMAND && message.extra?.type === 'narrator')
            );

            if (isCorrectType) {
                // Try direct match first (for depth 0 and already processed messages)
                let shouldUpdate = message.mes === originalText;

                // If direct match fails, try matching against processed stored text
                // This handles cases where stored message has templates ({{char}}) but originalText has processed text
                if (!shouldUpdate) {
                    try {
                        const processedStoredText = substituteParams(message.mes, undefined, characterOverride);
                        shouldUpdate = processedStoredText === originalText;
                    } catch (e) {
                        // If substituteParams fails, fall back to direct comparison
                        console.debug('Failed to process stored message text for comparison:', e);
                    }
                }

                if (shouldUpdate) {
                    message.mes = newText;

                    // Debounced save to avoid excessive saves
                    saveChatConditional();
                }
            }
        }
    } catch (error) {
        console.warn('Failed to permanently update chat message:', error);
        throw error; // Re-throw so caller can handle if needed
    }
}

/**
 * Runs the provided regex script on the given string
 * @param {import('./index.js').RegexScript} regexScript The regex script to run
 * @param {string} rawString The string to run the regex script on
 * @param {RegexScriptParams} params The parameters to use for the regex script
 * @returns {string} The new string
 * @typedef {{characterOverride?: string}} RegexScriptParams The parameters to use for the regex script
 */
function runRegexScript(regexScript, rawString, { characterOverride } = {}) {
    let newString = rawString;
    if (!regexScript || !!(regexScript.disabled) || !regexScript?.findRegex || !rawString) {
        return newString;
    }

    const getRegexString = () => {
        switch (Number(regexScript.substituteRegex)) {
            case substitute_find_regex.NONE:
                return regexScript.findRegex;
            case substitute_find_regex.RAW:
                return substituteParamsExtended(regexScript.findRegex);
            case substitute_find_regex.ESCAPED:
                return substituteParamsExtended(regexScript.findRegex, {}, sanitizeRegexMacro);
            default:
                console.warn(`runRegexScript: Unknown substituteRegex value ${regexScript.substituteRegex}. Using raw regex.`);
                return regexScript.findRegex;
        }
    };
    const regexString = getRegexString();
    const findRegex = regexFromString(regexString);

    // The user skill issued. Return with nothing.
    if (!findRegex) {
        return newString;
    }

    // Run replacement. Currently does not support the Overlay strategy
    newString = rawString.replace(findRegex, function (match) {
        const args = [...arguments];
        const replaceString = regexScript.replaceString.replace(/{{match}}/gi, '$0');
        const replaceWithGroups = replaceString.replaceAll(/\$(\d+)|\$<([^>]+)>/g, (_, num, groupName) => {
            if (num) {
                // Handle numbered capture groups ($1, $2, etc.)
                match = args[Number(num)];
            } else if (groupName) {
                // Handle named capture groups ($<name>)
                const groups = args[args.length - 1];
                match = groups && typeof groups === 'object' && groups[groupName];
            }

            // No match found - return the empty string
            if (!match) {
                return '';
            }

            // Remove trim strings from the match
            const filteredMatch = filterString(match, regexScript.trimStrings, { characterOverride });

            return filteredMatch;
        });

        // Substitute at the end
        return substituteParams(replaceWithGroups);
    });

    return newString;
}

/**
 * Filters anything to trim from the regex match
 * @param {string} rawString The raw string to filter
 * @param {string[]} trimStrings The strings to trim
 * @param {RegexScriptParams} params The parameters to use for the regex filter
 * @returns {string} The filtered string
 */
function filterString(rawString, trimStrings, { characterOverride } = {}) {
    let finalString = rawString;
    trimStrings.forEach((trimString) => {
        const subTrimString = substituteParams(trimString, undefined, characterOverride);
        finalString = finalString.replaceAll(subTrimString, '');
    });

    return finalString;
}
