import { substituteParams } from "../../../script.js";
export {
    runRegexScript
}

// From: https://github.com/IonicaBizau/regex-parser.js/blob/master/lib/index.js
function regexFromString(input) {
    // Parse input
    var m = input.match(/(\/?)(.+)\1([a-z]*)/i);

    // Invalid flags
    if (m[3] && !/^(?!.*?(.).*?\1)[gmixXsuUAJ]+$/.test(m[3])) {
        return RegExp(input);
    }

    // Create the regular expression
    return new RegExp(m[2], m[3]);
}

// Runs the provided regex script on the given string
function runRegexScript(regexScript, rawString) {
    if (!!(regexScript.disabled)) {
        return;
    }

    let match;
    let newString;
    const findRegex = regexFromString(regexScript.findRegex);
    while ((match = findRegex.exec(rawString)) !== null) {
        const fencedMatch = match[0];
        const capturedMatch = match[1];

        // TODO: Use substrings for replacement. But not necessary at this time.
        // A substring is from match.index to match.index + match[0].length or fencedMatch.length
        const subReplaceString = substituteRegexParams(regexScript.replaceString, { regexMatch: capturedMatch ?? fencedMatch });
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

// Substitutes parameters 
function substituteRegexParams(rawString, { regexMatch }) {
    let finalString = rawString;
    finalString = finalString.replace("{{match}}", regexMatch);
    finalString = substituteParams(finalString);

    return finalString;
}
