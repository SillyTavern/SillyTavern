import { chat_metadata, getCurrentChatId, sendSystemMessage, system_message_types } from "../script.js";
import { extension_settings } from "./extensions.js";
import { executeSlashCommands, registerSlashCommand } from "./slash-commands.js";

function getLocalVariable(name) {
    const localVariable = chat_metadata?.variables[name];

    return localVariable || '';
}

function setLocalVariable(name, value) {
    if (!chat_metadata.variables) {
        chat_metadata.variables = {};
    }

    chat_metadata.variables[name] = value;
    return value;
}

function getGlobalVariable(name) {
    const globalVariable = extension_settings.variables.global[name];

    return globalVariable || '';
}

function setGlobalVariable(name, value) {
    extension_settings.variables.global[name] = value;
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
    const a = getLocalVariable(args.a) || getGlobalVariable(args.a) || Number(args.a);
    const b = getLocalVariable(args.b) || getGlobalVariable(args.b) || Number(args.b);
    const rule = args.rule;

    if (!a || !b || !rule) {
        toastr.warning('Both operands and the rule must be specified for the /if command.', 'Invalid /if command');
        return '';
    }

    const aNumber = Number(a);
    const bNumber = Number(b);

    if (isNaN(aNumber) || isNaN(bNumber)) {
        toastr.warning('Both operands must be numbers for the /if command.', 'Invalid /if command');
        return '';
    }

    let result = false;

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
        default:
            toastr.warning('Unknown rule for the /if command.', 'Invalid /if command');
            return '';
    }

    if (result && command) {
        if (command.startsWith('"')) {
            command = command.slice(1);
        }

        if (command.endsWith('"')) {
            command = command.slice(0, -1);
        }

        const result = await executeSlashCommands(command);

        if (!result || typeof result !== 'object') {
            return '';
        }

        return result?.pipe || '';
    }

    return '';
}

export function registerVariableCommands() {
    registerSlashCommand('listvar', listVariablesCallback, [''], ' – list registered chat variables', true, true);
    registerSlashCommand('setvar', (args, value) => setLocalVariable(args.key || args.name, value), [], '<span class="monospace">key=varname (value)</span> – set a local variable value and pass it down the pipe, e.g. <tt>/setvar key=color green</tt>', true, true);
    registerSlashCommand('getvar', (_, value) => getLocalVariable(value), [], '<span class="monospace">(key)</span> – get a local variable value and pass it down the pipe, e.g. <tt>/getvar height</tt>', true, true);
    registerSlashCommand('addvar', (args, value) => addLocalVariable(args.key || args.name, value), [], '<span class="monospace">key=varname (increment)</span> – add a value to a local variable and pass the result down the pipe, e.g. <tt>/addvar score 10</tt>', true, true);
    registerSlashCommand('setglobalvar', (args, value) => setGlobalVariable(args.key || args.name, value), [], '<span class="monospace">key=varname (value)</span> – set a global variable value and pass it down the pipe, e.g. <tt>/setglobalvar key=color green</tt>', true, true);
    registerSlashCommand('getglobalvar', (_, value) => getGlobalVariable(value), [], '<span class="monospace">(key)</span> – get a global variable value and pass it down the pipe, e.g. <tt>/getglobalvar height</tt>', true, true);
    registerSlashCommand('addglobalvar', (args, value) => addGlobalVariable(args.key || args.name, value), [], '<span class="monospace">key=varname (increment)</span> – add a value to a global variable and pass the result down the pipe, e.g. <tt>/addglobalvar score 10</tt>', true, true);
    registerSlashCommand('if', ifCallback, [], '<span class="monospace">a=varname1 b=varname2 rule=comparison "(command)"</span> – compare the value of variable "a" with the value of variable "b", and if the condition yields true, then execute any valid slash command enclosed in quotes and pass the result of the command execution down the pipe. Numeric values for "a" and "b" supported. Available rules: gt => a > b, gte => a >= b, lt => a < b, lte => a <= b, eq => a == b  e.g. <tt>/if a=score a=10 rule=gte "/speak You win"</tt> triggers a /speak command if the value of "score" is greater or equals 10.', true, true);
}
