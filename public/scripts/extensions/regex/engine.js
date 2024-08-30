import { characters, event_types, eventSource, streamingProcessor, substituteParams, this_chid } from '../../../script.js';
import { extension_settings } from '../../extensions.js';
import { regexFromString } from '../../utils.js';
export {
    regex_placement,
    getRegexedString,
    runRegexScript,
};

/** @type {Map<string, string[]>} */
const REGEX_RUNS = new Map();

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
};

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
 * @typedef {{characterOverride?: string, isMarkdown?: boolean, isPrompt?: boolean, depth?: number }} RegexParams The parameters to use for the regex script
 */
function getRegexedString(rawString, placement, { characterOverride, isMarkdown, isPrompt, depth } = {}) {
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
            // Script applies to all cases when neither "only"s are true, but there's no need to do it when `isMarkdown`, the as source (chat history) should already be changed beforehand
            (!script.markdownOnly && !script.promptOnly && !isMarkdown)
        ) {
            // Check if the depth is within the min/max depth
            if (typeof depth === 'number' && depth >= 0) {
                if (!isNaN(script.minDepth) && script.minDepth !== null && script.minDepth >= 0 && depth < script.minDepth) {
                    console.debug(`getRegexedString: Skipping script ${script.scriptName} because depth ${depth} is less than minDepth ${script.minDepth}`);
                    return;
                }

                if (!isNaN(script.maxDepth) && script.maxDepth !== null && script.maxDepth >= 0 && depth > script.maxDepth) {
                    console.debug(`getRegexedString: Skipping script ${script.scriptName} because depth ${depth} is greater than maxDepth ${script.maxDepth}`);
                    return;
                }
            }

            if (script.placement.includes(placement)) {
                finalString = runRegexScript(script, finalString, { characterOverride });
            }
        }
    });

    return finalString;
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

    const findRegex = regexFromString(regexScript.substituteRegex ? substituteParams(regexScript.findRegex) : regexScript.findRegex);

    // The user skill issued. Return with nothing.
    if (!findRegex) {
        return newString;
    }

    // Run replacement. Currently does not support the Overlay strategy
    newString = rawString.replace(findRegex, function (match) {
        const args = [...arguments];
        const replaceString = regexScript.replaceString.replace(/{{match}}/gi, '$0');
        const replaceWithGroups = replaceString.replaceAll(/\$(\d+)/g, (_, num) => {
            // Get a full match or a capture group
            const match = args[Number(num)];

            // No match found - return the empty string
            if (!match) {
                return '';
            }

            // Remove trim strings from the match
            const filteredMatch = filterString(match, regexScript.trimStrings, { characterOverride });

            // TODO: Handle overlay here

            return filteredMatch;
        });

        // Substitute parameters in the replacement string
        const replacement = substituteParams(replaceWithGroups);

        // Emit the event
        if (regexScript.automationId && shouldRunOnStream(regexScript)) {
            eventSource.emitAndWait(event_types.REGEX_SCRIPT_MATCHED, {
                scriptName: regexScript.scriptName,
                automationId: regexScript.automationId,
                matches: args,
                replacement: replacement,
            });
        }

        return replacement;
    });

    return newString;
}

/**
 * Determines if the regex script should run on the current stream.
 * @param {import('./index.js').RegexScript} regexScript The regex script to check
 * @returns {boolean} True if the script should run, false otherwise
 */
function shouldRunOnStream(regexScript) {
    // If there is no streaming processor, always run the script
    // Assuming only one stream can run at a time, so we can clear previous runs
    if (!streamingProcessor) {
        REGEX_RUNS.clear();
        return true;
    }
    // If streaming is active, but the request is not from the streaming processor, always run the script
    const isFromStreaming = new Error().stack.includes(`${streamingProcessor.constructor.name}.${streamingProcessor.onProgressStreaming.name}`);
    if (!isFromStreaming) {
        return true;
    }
    // Run only once per stream ID
    const streamId = streamingProcessor.streamId;
    const scriptKey = `${regexScript.automationId}-${regexScript.scriptName}`;
    const scriptRuns = REGEX_RUNS.get(streamId) ?? [];
    const shouldRun = !scriptRuns.includes(scriptKey);
    if (shouldRun) {
        scriptRuns.push(scriptKey);
        REGEX_RUNS.set(streamId, scriptRuns);
    }
    return shouldRun;
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
