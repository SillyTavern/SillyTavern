import { chat_metadata, getCurrentChatId, sendSystemMessage, system_message_types } from "../script.js";
import { extension_settings } from "./extensions.js";
import { registerSlashCommand } from "./slash-commands.js";

function getLocalVariable(name) {
    const localVariable = chat_metadata?.variables[name];

    return localVariable || '';
}

function setLocalVariable(name, value) {
    if (!chat_metadata.variables) {
        chat_metadata.variables = {};
    }

    chat_metadata.variables[name] = value;
}

function getGlobalVariable(name) {
    const globalVariable = extension_settings.variables.global[name];

    return globalVariable || '';
}

function setGlobalVariable(name, value) {
    extension_settings.variables.global[name] = value;
}

export function replaceVariableMacros(str) {
    // Replace {{getvar::name}} with the value of the variable name
    str = str.replace(/{{getvar::([^}]+)}}/gi, (_, name) => {
        name = name.toLowerCase().trim();
        return getLocalVariable(name);
    });

    // Replace {{setvar::name::value}} with empty string and set the variable name to value
    str = str.replace(/{{setvar::([^:]+)::([^}]+)}}/gi, (_, name, value) => {
        name = name.toLowerCase().trim();
        setLocalVariable(name, value);
        return '';
    });

    // Replace {{addvar::name::value}} with empty string and add value to the variable value
    str = str.replace(/{{addvar::([^:]+)::([^}]+)}}/gi, (_, name, value) => {
        name = name.toLowerCase().trim();
        const currentValue = getLocalVariable(name) || 0;
        const increment = Number(value);

        if (isNaN(increment)) {
            return '';
        }

        const newValue = Number(currentValue) + increment;

        if (isNaN(newValue)) {
            return '';
        }

        setLocalVariable(name, newValue);
        return '';
    });

    // Replace {{getglobalvar::name}} with the value of the global variable name
    str = str.replace(/{{getglobalvar::([^}]+)}}/gi, (_, name) => {
        name = name.toLowerCase().trim();
        return getGlobalVariable(name);
    });

    // Replace {{setglobalvar::name::value}} with empty string and set the global variable name to value
    str = str.replace(/{{setglobalvar::([^:]+)::([^}]+)}}/gi, (_, name, value) => {
        name = name.toLowerCase().trim();
        setGlobalVariable(name, value);
        return '';
    });

    // Replace {{addglobalvar::name::value}} with empty string and add value to the global variable value
    str = str.replace(/{{addglobalvar::([^:]+)::([^}]+)}}/gi, (_, name, value) => {
        name = name.toLowerCase().trim();
        const currentValue = getGlobalVariable(name) || 0;
        const increment = Number(value);

        if (isNaN(increment)) {
            return '';
        }

        const newValue = Number(currentValue) + increment;

        if (isNaN(newValue)) {
            return '';
        }

        setGlobalVariable(name, newValue);
        return '';
    });

    return str;
}

function listVariablesCallback() {
    if (!chat_metadata.variables) {
        chat_metadata.variables = {};
    }

    const localVariables = Object.entries(chat_metadata.variables).map(([name, value]) => `${name}: ${value}`);
    const globalVariables = Object.entries(extension_settings.variables.global).map(([name, value]) => `${name}: ${value}`);

    const localVariablesString = localVariables.length > 0 ? localVariables.join('\n\n') : 'No local variables';
    const globalVariablesString = globalVariables.length > 0 ? globalVariables.join('\n\n') : 'No global variables';
    const chatName = getCurrentChatId();

    const converter = new showdown.Converter();
    const message = `### Local variables (${chatName}):\n${localVariablesString}\n\n### Global variables:\n${globalVariablesString}`;
    const htmlMessage = converter.makeHtml(message);

    sendSystemMessage(system_message_types.GENERIC, htmlMessage);
}

export function registerVariableCommands() {
    registerSlashCommand('listvar', listVariablesCallback, [''], ' – list registered chat variables', true, true);
}
