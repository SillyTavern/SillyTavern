import { getContext } from "../../extensions.js";

/**
 * Gets a chat variable from the current chat metadata.
 * @param {string} name The name of the variable to get.
 * @returns {string} The value of the variable.
 */
function getChatVariable(name) {
    const metadata = getContext().chatMetadata;

    if (!metadata) {
        return '';
    }

    if (!metadata.variables) {
        metadata.variables = {};
        return '';
    }

    return metadata.variables[name] || '';
}

/**
 * Sets a chat variable in the current chat metadata.
 * @param {string} name The name of the variable to set.
 * @param {any} value The value of the variable to set.
 */
function setChatVariable(name, value) {
    if (name === undefined || value === undefined) {
        return;
    }

    const metadata = getContext().chatMetadata;

    if (!metadata) {
        return;
    }

    if (!metadata.variables) {
        metadata.variables = {};
    }

    metadata.variables[name] = value;
}

function listChatVariables() {
    const metadata = getContext().chatMetadata;

    if (!metadata) {
        return '';
    }

    if (!metadata.variables) {
        metadata.variables = {};
        return '';
    }

    return Object.keys(metadata.variables).map(key => `${key}=${metadata.variables[key]}`).join(';');
}

jQuery(() => {
    const context = getContext();
    context.registerHelper('getvar', getChatVariable);
    context.registerHelper('setvar', setChatVariable);
    context.registerHelper('listvar', listChatVariables);
});
