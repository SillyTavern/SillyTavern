import { chat_metadata, getCurrentChatId, saveSettingsDebounced, sendSystemMessage, system_message_types } from "../script.js";
import { extension_settings, saveMetadataDebounced } from "./extensions.js";
import { executeSlashCommands, registerSlashCommand } from "./slash-commands.js";

function getLocalVariable(name) {
    if (!chat_metadata.variables) {
        chat_metadata.variables = {};
    }

    const localVariable = chat_metadata?.variables[name];

    return (localVariable === '' || isNaN(Number(localVariable))) ? (localVariable || '') : Number(localVariable);
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

    return (globalVariable === '' || isNaN(Number(globalVariable))) ? (globalVariable || '') : Number(globalVariable);
}

function setGlobalVariable(name, value) {
    extension_settings.variables.global[name] = value;
    saveSettingsDebounced();
}

function addLocalVariable(name, value) {
    const currentValue = getLocalVariable(name) || 0;
    const increment = Number(value);

    if (isNaN(increment)) {
        const stringValue = String(currentValue || '') + value;
        setLocalVariable(name, stringValue);
        return stringValue;
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
        const stringValue = String(currentValue || '') + value;
        setGlobalVariable(name, stringValue);
        return stringValue;
    }

    const newValue = Number(currentValue) + increment;

    if (isNaN(newValue)) {
        return '';
    }

    setGlobalVariable(name, newValue);
    return newValue;
}

export function resolveVariable(name) {
    if (existsLocalVariable(name)) {
        return getLocalVariable(name);
    }

    if (existsGlobalVariable(name)) {
        return getGlobalVariable(name);
    }

    return name;
}

export function replaceVariableMacros(input) {
    const lines = input.split('\n');

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];

        // Skip lines without macros
        if (!line || !line.includes('{{')) {
            continue;
        }

        // Replace {{getvar::name}} with the value of the variable name
        line = line.replace(/{{getvar::([^}]+)}}/gi, (_, name) => {
            name = name.trim();
            return getLocalVariable(name);
        });

        // Replace {{setvar::name::value}} with empty string and set the variable name to value
        line = line.replace(/{{setvar::([^:]+)::([^}]+)}}/gi, (_, name, value) => {
            name = name.trim();
            setLocalVariable(name, value);
            return '';
        });

        // Replace {{addvar::name::value}} with empty string and add value to the variable value
        line = line.replace(/{{addvar::([^:]+)::([^}]+)}}/gi, (_, name, value) => {
            name = name.trim();
            addLocalVariable(name, value);;
            return '';
        });

        // Replace {{getglobalvar::name}} with the value of the global variable name
        line = line.replace(/{{getglobalvar::([^}]+)}}/gi, (_, name) => {
            name = name.trim();
            return getGlobalVariable(name);
        });

        // Replace {{setglobalvar::name::value}} with empty string and set the global variable name to value
        line = line.replace(/{{setglobalvar::([^:]+)::([^}]+)}}/gi, (_, name, value) => {
            name = name.trim();
            setGlobalVariable(name, value);
            return '';
        });

        // Replace {{addglobalvar::name::value}} with empty string and add value to the global variable value
        line = line.replace(/{{addglobalvar::([^:]+)::([^}]+)}}/gi, (_, name, value) => {
            name = name.trim();
            addGlobalVariable(name, value);
            return '';
        });

        lines[i] = line;
    }

    return lines.join('\n');
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

async function whileCallback(args, command) {
    const MAX_LOOPS = 100;
    const isGuardOff = ['off', 'false', '0'].includes(args.guard?.toLowerCase());
    const iterations = isGuardOff ? Number.MAX_SAFE_INTEGER : MAX_LOOPS;

    for (let i = 0; i < iterations; i++) {
        const { a, b, rule } = parseBooleanOperands(args);
        const result = evalBoolean(rule, a, b);

        if (result && command) {
            await executeSubCommands(command);
        } else {
            break;
        }
    }

    return '';
}

async function ifCallback(args, command) {
    const { a, b, rule } = parseBooleanOperands(args);
    const result = evalBoolean(rule, a, b);

    if (result && command) {
        return await executeSubCommands(command);
    } else if (!result && args.else && typeof args.else === 'string' && args.else !== '') {
        return await executeSubCommands(args.else);
    }

    return '';
}

function existsLocalVariable(name) {
    return chat_metadata.variables && chat_metadata.variables[name] !== undefined;
}

function existsGlobalVariable(name) {
    return extension_settings.variables.global && extension_settings.variables.global[name] !== undefined;
}

function parseBooleanOperands(args) {
    // Resultion order: numeric literal, local variable, global variable, string literal
    function getOperand(operand) {
        if (operand === undefined) {
            return '';
        }

        const operandNumber = Number(operand);

        if (!isNaN(operandNumber)) {
            return operandNumber;
        }

        if (existsLocalVariable(operand)) {
            const operandLocalVariable = getLocalVariable(operand);
            return operandLocalVariable ?? '';
        }

        if (existsGlobalVariable(operand)) {
            const operandGlobalVariable = getGlobalVariable(operand);
            return operandGlobalVariable ?? '';
        }

        const stringLiteral = String(operand);
        return stringLiteral || '';
    }

    const left = getOperand(args.a || args.left || args.first || args.x);
    const right = getOperand(args.b || args.right || args.second || args.y);
    const rule = args.rule;

    return { a: left, b: right, rule };
}

function evalBoolean(rule, a, b) {
    if (!rule) {
        toastr.warning('The rule must be specified for the boolean comparison.', 'Invalid command');
        throw new Error('Invalid command.');
    }

    let result = false;

    if (typeof a === 'string' && typeof b !== 'number') {
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
                toastr.error('Unknown boolean comparison rule for type string.', 'Invalid /if command');
                throw new Error('Invalid command.');
        }
    } else if (typeof a === 'number') {
        const aNumber = Number(a);
        const bNumber = Number(b);

        switch (rule) {
            case 'not':
                result = !aNumber;
                break;
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
                toastr.error('Unknown boolean comparison rule for type number.', 'Invalid command');
                throw new Error('Invalid command.');
        }
    }

    return result;
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

function deleteLocalVariable(name) {
    if (!existsLocalVariable(name)) {
        console.warn(`The local variable "${name}" does not exist.`);
        return '';
    }

    delete chat_metadata.variables[name];
    saveMetadataDebounced();
    return '';
}

function deleteGlobalVariable(name) {
    if (!existsGlobalVariable(name)) {
        console.warn(`The global variable "${name}" does not exist.`);
        return '';
    }

    delete extension_settings.variables.global[name];
    saveSettingsDebounced();
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
    registerSlashCommand('if', ifCallback, [], '<span class="monospace">left=varname1 right=varname2 rule=comparison else="(alt.command)" "(command)"</span> – compare the value of the left operand "a" with the value of the right operand "b", and if the condition yields true, then execute any valid slash command enclosed in quotes and pass the result of the command execution down the pipe. Numeric values and string literals for left and right operands supported. Available rules: gt => a > b, gte => a >= b, lt => a < b, lte => a <= b, eq => a == b, neq => a != b, not => !a, in (strings) => a includes b, nin (strings) => a not includes b, e.g. <tt>/if left=score right=10 rule=gte "/speak You win"</tt> triggers a /speak command if the value of "score" is greater or equals 10.', true, true);
    registerSlashCommand('while', whileCallback, [], '<span class="monospace">left=varname1 right=varname2 rule=comparison "(command)"</span> – compare the value of the left operand "a" with the value of the right operand "b", and if the condition yields true, then execute any valid slash command enclosed in quotes. Numeric values and string literals for left and right operands supported. Available rules: gt => a > b, gte => a >= b, lt => a < b, lte => a <= b, eq => a == b, neq => a != b, not => !a, in (strings) => a includes b, nin (strings) => a not includes b, e.g. <tt>/setvar key=i 0 | /while left=i right=10 rule=let "/addvar key=i 1"</tt> adds 1 to the value of "i" until it reaches 10. Loops are limited to 100 iterations by default, pass guard=off to disable.', true, true);
    registerSlashCommand('flushvar', (_, value) => deleteLocalVariable(value), [], '<span class="monospace">(key)</span> – delete a local variable, e.g. <tt>/flushvar score</tt>', true, true);
    registerSlashCommand('flushglobalvar', (_, value) => deleteGlobalVariable(value), [], '<span class="monospace">(key)</span> – delete a global variable, e.g. <tt>/flushglobalvar score</tt>', true, true);
}
