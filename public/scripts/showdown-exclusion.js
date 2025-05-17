import { power_user } from './power-user.js';
import { substituteParams } from '../script.js';

/**
 * Showdown extension to make chat separators (dinkuses) ignore markdown formatting
 * @returns {import('showdown').ShowdownExtension[]} An array of Showdown extensions
 */
export const markdownExclusionExt = () => {
    if (!power_user) {
        console.log('Showdown-dinkus extension: power_user wasn\'t found! Returning.');
        return [];
    }

    // The extension will only be applied if the user has non-empty "Non-markdown strings"
    // Changing the string in the UI reloads the processor, so we don't need to worry about it
    if (!power_user.markdown_escape_strings) {
        return [];
    }

    // Escape the strings to be excluded from markdown parsing
    // Function is evaluated every time, so we don't care about stale macros in the strings
    return [{
        type: 'lang',
        filter: (text) => {
            const escapedExclusions = substituteParams(power_user.markdown_escape_strings)
                .split(',')
                .filter((element) => element.length > 0)
                .map((element) => `(${element.split('').map((char) => `\\${char}`).join('')})`);

            // No exclusions? No extension!
            if (escapedExclusions.length === 0) {
                return text;
            }

            const replaceRegex = new RegExp(`^(${escapedExclusions.join('|')})\n`, 'gm');
            return text.replace(replaceRegex, ((match) => match.replace(replaceRegex, `\u0000${match} \n`)));
        },
    }];
};
