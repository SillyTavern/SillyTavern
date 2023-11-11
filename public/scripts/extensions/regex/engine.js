import { substituteParams } from "../../../script.js";
import { extension_settings } from "../../extensions.js";
export {
    regex_placement,
    getRegexedString,
    runRegexScript
}

const regex_placement = {
    // MD Display is deprecated. Do not use.
    MD_DISPLAY: 0,
    USER_INPUT: 1,
    AI_OUTPUT: 2,
    SLASH_COMMAND: 3
}

const regex_replace_strategy = {
    REPLACE: 0,
    OVERLAY: 1
}

// Originally from: https://github.com/IonicaBizau/regex-parser.js/blob/master/lib/index.js
function regexFromString(input) {
    try {
        // Parse input
        var m = input.match(/(\/?)(.+)\1([a-z]*)/i);

        // Invalid flags
        if (m[3] && !/^(?!.*?(.).*?\1)[gmixXsuUAJ]+$/.test(m[3])) {
            return RegExp(input);
        }

        // Create the regular expression
        return new RegExp(m[2], m[3]);
    } catch {
        return;
    }
}

// Parent function to fetch a regexed version of a raw string
function getRegexedString(rawString, placement, { characterOverride, isMarkdown, isPrompt } = {}) {
    let finalString = rawString;
    if (extension_settings.disabledExtensions.includes("regex") || !rawString || placement === undefined) {
        return finalString;
    }

    extension_settings.regex.forEach((script) => {
        if (
            // Script applies to Markdown and input is Markdown
            (script.markdownOnly && isMarkdown) ||
            // Script applies to Generate and input is Generate
            (script.promptOnly && isPrompt) ||
            // Script applies to all cases when neither "only"s are true, but there's no need to do it when `isMarkdown`, the as source (chat history) should already be changed beforehand
            (!script.markdownOnly && !script.promptOnly && !isMarkdown)
        ) {
            if (script.placement.includes(placement)) {
                finalString = runRegexScript(script, finalString, { characterOverride });
            }
        }
    });

    return finalString;
}

// Runs the provided regex script on the given string
function runRegexScript(regexScript, rawString, { characterOverride } = {}) {
    let newString = rawString;
    if (!regexScript || !!(regexScript.disabled) || !regexScript?.findRegex || !rawString) {
        return newString;
    }

    let match;
    const findRegex = regexFromString(regexScript.substituteRegex ? substituteParams(regexScript.findRegex) : regexScript.findRegex);

    // The user skill issued. Return with nothing.
    if (!findRegex) {
        return newString;
    }

    while ((match = findRegex.exec(rawString)) !== null) {
        const fencedMatch = match[0];
        const capturedMatch = match[1];

        let trimCapturedMatch;
        let trimFencedMatch;
        if (capturedMatch) {
            const tempTrimCapture = filterString(capturedMatch, regexScript.trimStrings, { characterOverride });
            trimFencedMatch = fencedMatch.replaceAll(capturedMatch, tempTrimCapture);
            trimCapturedMatch = tempTrimCapture;
        } else {
            trimFencedMatch = filterString(fencedMatch, regexScript.trimStrings, { characterOverride });
        }

        // TODO: Use substrings for replacement. But not necessary at this time.
        // A substring is from match.index to match.index + match[0].length or fencedMatch.length
        const subReplaceString = substituteRegexParams(
            regexScript.replaceString,
            trimCapturedMatch ?? trimFencedMatch,
            {
                characterOverride,
                replaceStrategy: regexScript.replaceStrategy ?? regex_replace_strategy.REPLACE
            }
        );
        if (!newString) {
            newString = rawString.replace(fencedMatch, subReplaceString);
        } else {
            newString = newString.replace(fencedMatch, subReplaceString);
        }

        // If the regex isn't global, break out of the loop
        if (!findRegex.flags.includes('g')) {
            break;
        }
    }

    return newString;
}

// Filters anything to trim from the regex match
function filterString(rawString, trimStrings, { characterOverride } = {}) {
    let finalString = rawString;
    trimStrings.forEach((trimString) => {
        const subTrimString = substituteParams(trimString, undefined, characterOverride);
        finalString = finalString.replaceAll(subTrimString, "");
    });

    return finalString;
}

// Substitutes regex-specific and normal parameters
function substituteRegexParams(rawString, regexMatch, { characterOverride, replaceStrategy } = {}) {
    let finalString = rawString;
    finalString = substituteParams(finalString, undefined, characterOverride);

    let overlaidMatch = regexMatch;
    // TODO: Maybe move the for loops into a separate function?
    if (replaceStrategy === regex_replace_strategy.OVERLAY) {
        const splitReplace = finalString.split("{{match}}");

        // There's a prefix
        if (splitReplace[0]) {
            // Fetch the prefix
            const splicedPrefix = spliceSymbols(splitReplace[0], false);

            // Sequentially remove all occurrences of prefix from start of split
            const splitMatch = overlaidMatch.split(splicedPrefix);
            let sliceNum = 0;
            for (let index = 0; index < splitMatch.length; index++) {
                if (splitMatch[index].length === 0) {
                    sliceNum++;
                } else {
                    break;
                }
            }

            overlaidMatch = splitMatch.slice(sliceNum, splitMatch.length).join(splicedPrefix);
        }

        // There's a suffix
        if (splitReplace[1]) {
            // Fetch the suffix
            const splicedSuffix = spliceSymbols(splitReplace[1], true);

            // Sequential removal of all suffix occurrences from end of split
            const splitMatch = overlaidMatch.split(splicedSuffix);
            let sliceNum = 0;
            for (let index = splitMatch.length - 1; index >= 0; index--) {
                if (splitMatch[index].length === 0) {
                    sliceNum++;
                } else {
                    break;
                }
            }

            overlaidMatch = splitMatch.slice(0, splitMatch.length - sliceNum).join(splicedSuffix);
        }
    }

    // Only one match is replaced. This is by design
    finalString = finalString.replace("{{match}}", overlaidMatch) || finalString.replace("{{match}}", regexMatch);

    return finalString;
}

// Splices common sentence symbols and whitespace from the beginning and end of a string
// Using a for loop due to sequential ordering
function spliceSymbols(rawString, isSuffix) {
    let offset = 0;

    for (const ch of isSuffix ? rawString.split('').reverse() : rawString) {
        if (ch.match(/[^\w.,?'!]/)) {
            offset++;
        } else {
            break;
        }
    }

    return isSuffix ? rawString.substring(0, rawString.length - offset) : rawString.substring(offset);
}
