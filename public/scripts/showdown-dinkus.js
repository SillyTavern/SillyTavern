import { power_user } from './power-user.js';

// Showdown extension to make chat separators (dinkuses) ignore markdown formatting
export const dinkusExtension = () => {
    if (!power_user) {
        console.log("Showdown-dinkus extension: power_user wasn't found! Returning.");
        return []
    }

    // Create an escaped sequence so the regex can work with any character
    const savedDinkus = power_user.custom_chat_separator

    // No dinkus? No extension!
    if (!savedDinkus || savedDinkus.trim().length === 0) {
        return []
    }

    const escapedDinkus = savedDinkus.split('').map((e) => `\\${e}`).join('');
    const replaceRegex = new RegExp(`^(${escapedDinkus})\n`, "gm")
    return [{
        type: "lang",
        regex: replaceRegex,
        replace: (match) => match.replace(replaceRegex, `<div>${savedDinkus}</div>`).trim()
    }];
}
