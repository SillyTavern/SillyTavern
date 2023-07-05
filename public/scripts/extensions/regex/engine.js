import { substituteParams } from "../../../script.js";
import { extension_settings } from "../../extensions.js";
export {
    regex_placement,
    getRegexedString,
    runRegexScript
}

const regex_placement = {
    MD_DISPLAY: 0,
    USER_INPUT: 1,
    AI_OUTPUT: 2,
    SYSTEM: 3,
    SENDAS: 4
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

function getRegexedString(rawString, placement, { characterOverride } = {}) {
    if (extension_settings.disabledExtensions.includes("regex") || !rawString || placement === undefined) {
        return;
    }

    let finalString;
    extension_settings.regex.forEach((script) => {
        if (script.placement.includes(placement)) {
            finalString = runRegexScript(script, rawString, { characterOverride });
        }
    });

    return finalString;
}

// Runs the provided regex script on the given string
function runRegexScript(regexScript, rawString, { characterOverride } = {}) {
    if (!regexScript || !!(regexScript.disabled) || !regexScript?.findRegex || !rawString) {
        return;
    }

    let match;
    let newString;
    const findRegex = regexFromString(regexScript.substituteRegex ? substituteParams(regexScript.findRegex) : regexScript.findRegex);

    // The user skill issued. Return with nothing.
    if (!findRegex) {
        return;
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
        const subReplaceString = substituteRegexParams(regexScript.replaceString, trimCapturedMatch ?? trimFencedMatch, { characterOverride });
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
function substituteRegexParams(rawString, regexMatch, { characterOverride } = {}) {
    let finalString = rawString;
    finalString = finalString.replace("{{match}}", regexMatch);
    finalString = substituteParams(finalString, undefined, characterOverride);

    return finalString;
}
