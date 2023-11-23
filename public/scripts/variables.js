import { chat_metadata, getCurrentChatId, saveSettingsDebounced, sendSystemMessage, system_message_types } from "../script.js";
import { extension_settings, saveMetadataDebounced } from "./extensions.js";
import { executeSlashCommands, registerSlashCommand } from "./slash-commands.js";

function getLocalVariable(name) {
    if (!chat_metadata.variables) {
        chat_metadata.variables = {};
    }

    const localVariable = chat_metadata?.variables[name];

    return localVariable || '';
}

function setLocalVariable(name, value) {
    if (!chat_metadata.variables) {
        chat_metadata.variables = {};
    }

    chat_metadata.variables[name] = value;
    saveMetadataDebounced();
    return value;
}

function getGlobalVariable(name) {
    const globalVariable = extension_settings.variables.global[name];

    return globalVariable || '';
}

function setGlobalVariable(name, value) {
    extension_settings.variables.global[name] = value;
    saveSettingsDebounced();
}

function addLocalVariable(name, value) {
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
    return newValue;
}

function addGlobalVariable(name, value) {
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
    return newValue;
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
        return addLocalVariable(name, value);;
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
        return addGlobalVariable(name, value);
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
    const htmlMessage = DOMPurify.sanitize(converter.makeHtml(message));

    sendSystemMessage(system_message_types.GENERIC, htmlMessage);
}

async function ifCallback(args, command) {
    // Resultion order: numeric literal, local variable, global variable, string literal
    const a = isNaN(Number(args.a)) ? (getLocalVariable(args.a) || getGlobalVariable(args.a) || args.a || '') : Number(args.a);
    const b = isNaN(Number(args.b)) ? (getLocalVariable(args.b) || getGlobalVariable(args.b) || args.b || '') : Number(args.b);
    const rule = args.rule;

    if (!rule) {
        toastr.warning('Both operands and the rule must be specified for the /if command.', 'Invalid /if command');
        return '';
    }

    if ((typeof a === 'number' && isNaN(a)) || (typeof a === 'string' && a === '')) {
        toastr.warning('The first operand must be a number, string or a variable name for the /if command.', 'Invalid /if command');
        return '';
    }

    let result = false;

    if (typeof a === 'string') {
        const aString = String(a).toLowerCase();
        const bString = String(b).toLowerCase();

        switch (rule) {
            case 'in':
                result = aString.includes(bString);
                break;
            case 'nin':
                result = !aString.includes(bString);
                break;
            case 'eq':
                result = aString === bString;
                break;
            case 'neq':
                result = aString !== bString;
                break;
            default:
                toastr.warning('Unknown rule for the /if command for type string.', 'Invalid /if command');
                return '';
        }
    } else if (typeof a === 'number') {
        const aNumber = Number(a);
        const bNumber = Number(b);

        switch (rule) {
            case 'gt':
                result = aNumber > bNumber;
                break;
            case 'gte':
                result = aNumber >= bNumber;
                break;
            case 'lt':
                result = aNumber < bNumber;
                break;
            case 'lte':
                result = aNumber <= bNumber;
                break;
            case 'eq':
                result = aNumber === bNumber;
                break;
            case 'neq':
                result = aNumber !== bNumber;
                break;
            default:
                toastr.warning('Unknown rule for the /if command for type number.', 'Invalid /if command');
                return '';
        }
    }

    if (result && command) {
        return await executeSubCommands(command);
    } else if (!result && args.else && typeof args.else === 'string' && args.else !== '') {
        return await executeSubCommands(args.else);
    }

    return '';
}

async function executeSubCommands(command) {
    if (command.startsWith('"')) {
        command = command.slice(1);
    }

    if (command.endsWith('"')) {
        command = command.slice(0, -1);
    }

    const unescape = true;
    const result = await executeSlashCommands(command, unescape);

    if (!result || typeof result !== 'object') {
        return '';
    }

    return result?.pipe || '';
}

export function registerVariableCommands() {
    registerSlashCommand('listvar', listVariablesCallback, [''], ' – list registered chat variables', true, true);
    registerSlashCommand('setvar', (args, value) => setLocalVariable(args.key || args.name, value), [], '<span class="monospace">key=varname (value)</span> – set a local variable value and pass it down the pipe, e.g. <tt>/setvar key=color green</tt>', true, true);
    registerSlashCommand('getvar', (_, value) => getLocalVariable(value), [], '<span class="monospace">(key)</span> – get a local variable value and pass it down the pipe, e.g. <tt>/getvar height</tt>', true, true);
    registerSlashCommand('addvar', (args, value) => addLocalVariable(args.key || args.name, value), [], '<span class="monospace">key=varname (increment)</span> – add a value to a local variable and pass the result down the pipe, e.g. <tt>/addvar score 10</tt>', true, true);
    registerSlashCommand('setglobalvar', (args, value) => setGlobalVariable(args.key || args.name, value), [], '<span class="monospace">key=varname (value)</span> – set a global variable value and pass it down the pipe, e.g. <tt>/setglobalvar key=color green</tt>', true, true);
    registerSlashCommand('getglobalvar', (_, value) => getGlobalVariable(value), [], '<span class="monospace">(key)</span> – get a global variable value and pass it down the pipe, e.g. <tt>/getglobalvar height</tt>', true, true);
    registerSlashCommand('addglobalvar', (args, value) => addGlobalVariable(args.key || args.name, value), [], '<span class="monospace">key=varname (increment)</span> – add a value to a global variable and pass the result down the pipe, e.g. <tt>/addglobalvar score 10</tt>', true, true);
    registerSlashCommand('if', ifCallback, [], '<span class="monospace">a=varname1 b=varname2 rule=comparison else="(alt.command)" "(command)"</span> – compare the value of variable "a" with the value of variable "b", and if the condition yields true, then execute any valid slash command enclosed in quotes and pass the result of the command execution down the pipe. Numeric values and string literals for "a" and "b" supported. Available rules: gt => a > b, gte => a >= b, lt => a < b, lte => a <= b, eq => a == b, neq => a != b, in (strings) => a includes b, nin (strings) => a not includes b, e.g. <tt>/if a=score a=10 rule=gte "/speak You win"</tt> triggers a /speak command if the value of "score" is greater or equals 10.', true, true);
}
