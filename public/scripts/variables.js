import { chat_metadata, getCurrentChatId, saveSettingsDebounced, sendSystemMessage, system_message_types } from '../script.js';
import { extension_settings, saveMetadataDebounced } from './extensions.js';
import { executeSlashCommandsWithOptions } from './slash-commands.js';
import { SlashCommand } from './slash-commands/SlashCommand.js';
import { SlashCommandAbortController } from './slash-commands/SlashCommandAbortController.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from './slash-commands/SlashCommandArgument.js';
import { SlashCommandBreakController } from './slash-commands/SlashCommandBreakController.js';
import { SlashCommandClosure } from './slash-commands/SlashCommandClosure.js';
import { SlashCommandClosureResult } from './slash-commands/SlashCommandClosureResult.js';
import { commonEnumProviders, enumIcons } from './slash-commands/SlashCommandCommonEnumsProvider.js';
import { SlashCommandEnumValue, enumTypes } from './slash-commands/SlashCommandEnumValue.js';
import { PARSER_FLAG, SlashCommandParser } from './slash-commands/SlashCommandParser.js';
import { SlashCommandScope } from './slash-commands/SlashCommandScope.js';
import { isFalseBoolean, convertValueType } from './utils.js';

/** @typedef {import('./slash-commands/SlashCommandParser.js').NamedArguments} NamedArguments */
/** @typedef {import('./slash-commands/SlashCommand.js').UnnamedArguments} UnnamedArguments */

const MAX_LOOPS = 100;

function getLocalVariable(name, args = {}) {
    if (!chat_metadata.variables) {
        chat_metadata.variables = {};
    }

    let localVariable = chat_metadata?.variables[args.key ?? name];
    if (args.index !== undefined) {
        try {
            localVariable = JSON.parse(localVariable);
            const numIndex = Number(args.index);
            if (Number.isNaN(numIndex)) {
                localVariable = localVariable[args.index];
            } else {
                localVariable = localVariable[Number(args.index)];
            }
            if (typeof localVariable == 'object') {
                localVariable = JSON.stringify(localVariable);
            }
        } catch {
            // that didn't work
        }
    }

    return (localVariable?.trim?.() === '' || isNaN(Number(localVariable))) ? (localVariable || '') : Number(localVariable);
}

function setLocalVariable(name, value, args = {}) {
    if (!chat_metadata.variables) {
        chat_metadata.variables = {};
    }

    if (args.index !== undefined) {
        try {
            let localVariable = JSON.parse(chat_metadata.variables[name] ?? 'null');
            const numIndex = Number(args.index);
            if (Number.isNaN(numIndex)) {
                if (localVariable === null) {
                    localVariable = {};
                }
                localVariable[args.index] = convertValueType(value, args.as);
            } else {
                if (localVariable === null) {
                    localVariable = [];
                }
                localVariable[numIndex] = convertValueType(value, args.as);
            }
            chat_metadata.variables[name] = JSON.stringify(localVariable);
        } catch {
            // that didn't work
        }
    } else {
        chat_metadata.variables[name] = value;
    }
    saveMetadataDebounced();
    return value;
}

function getGlobalVariable(name, args = {}) {
    let globalVariable = extension_settings.variables.global[args.key ?? name];
    if (args.index !== undefined) {
        try {
            globalVariable = JSON.parse(globalVariable);
            const numIndex = Number(args.index);
            if (Number.isNaN(numIndex)) {
                globalVariable = globalVariable[args.index];
            } else {
                globalVariable = globalVariable[Number(args.index)];
            }
            if (typeof globalVariable == 'object') {
                globalVariable = JSON.stringify(globalVariable);
            }
        } catch {
            // that didn't work
        }
    }

    return (globalVariable?.trim?.() === '' || isNaN(Number(globalVariable))) ? (globalVariable || '') : Number(globalVariable);
}

function setGlobalVariable(name, value, args = {}) {
    if (args.index !== undefined) {
        try {
            let globalVariable = JSON.parse(extension_settings.variables.global[name] ?? 'null');
            const numIndex = Number(args.index);
            if (Number.isNaN(numIndex)) {
                if (globalVariable === null) {
                    globalVariable = {};
                }
                globalVariable[args.index] = convertValueType(value, args.as);
            } else {
                if (globalVariable === null) {
                    globalVariable = [];
                }
                globalVariable[numIndex] = convertValueType(value, args.as);
            }
            extension_settings.variables.global[name] = JSON.stringify(globalVariable);
        } catch {
            // that didn't work
        }
    } else {
        extension_settings.variables.global[name] = value;
    }
    saveSettingsDebounced();
    return value;
}

function addLocalVariable(name, value) {
    const currentValue = getLocalVariable(name) || 0;
    try {
        const parsedValue = JSON.parse(currentValue);
        if (Array.isArray(parsedValue)) {
            parsedValue.push(value);
            setLocalVariable(name, JSON.stringify(parsedValue));
            return parsedValue;
        }
    } catch {
        // ignore non-array values
    }
    const increment = Number(value);

    if (isNaN(increment) || isNaN(Number(currentValue))) {
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
    try {
        const parsedValue = JSON.parse(currentValue);
        if (Array.isArray(parsedValue)) {
            parsedValue.push(value);
            setGlobalVariable(name, JSON.stringify(parsedValue));
            return parsedValue;
        }
    } catch {
        // ignore non-array values
    }
    const increment = Number(value);

    if (isNaN(increment) || isNaN(Number(currentValue))) {
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

function incrementLocalVariable(name) {
    return addLocalVariable(name, 1);
}

function incrementGlobalVariable(name) {
    return addGlobalVariable(name, 1);
}

function decrementLocalVariable(name) {
    return addLocalVariable(name, -1);
}

function decrementGlobalVariable(name) {
    return addGlobalVariable(name, -1);
}

/**
 * Resolves a variable name to its value or returns the string as is if the variable does not exist.
 * @param {string} name Variable name
 * @param {SlashCommandScope} scope Scope
 * @returns {string} Variable value or the string literal
 */
export function resolveVariable(name, scope = null) {
    if (scope?.existsVariable(name)) {
        return scope.getVariable(name);
    }

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
            addLocalVariable(name, value);
            return '';
        });

        // Replace {{incvar::name}} with empty string and increment the variable name by 1
        line = line.replace(/{{incvar::([^}]+)}}/gi, (_, name) => {
            name = name.trim();
            return incrementLocalVariable(name);
        });

        // Replace {{decvar::name}} with empty string and decrement the variable name by 1
        line = line.replace(/{{decvar::([^}]+)}}/gi, (_, name) => {
            name = name.trim();
            return decrementLocalVariable(name);
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

        // Replace {{incglobalvar::name}} with empty string and increment the global variable name by 1
        line = line.replace(/{{incglobalvar::([^}]+)}}/gi, (_, name) => {
            name = name.trim();
            return incrementGlobalVariable(name);
        });

        // Replace {{decglobalvar::name}} with empty string and decrement the global variable name by 1
        line = line.replace(/{{decglobalvar::([^}]+)}}/gi, (_, name) => {
            name = name.trim();
            return decrementGlobalVariable(name);
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
    return '';
}

/**
 *
 * @param {NamedArguments} args
 * @param {(string|SlashCommandClosure)[]} value
 */
async function whileCallback(args, value) {
    if (args.guard instanceof SlashCommandClosure) throw new Error('argument \'guard\' cannot be a closure for command /while');
    const isGuardOff = isFalseBoolean(args.guard);
    const iterations = isGuardOff ? Number.MAX_SAFE_INTEGER : MAX_LOOPS;
    /**@type {string|SlashCommandClosure} */
    let command;
    if (value) {
        if (value[0] instanceof SlashCommandClosure) {
            command = value[0];
        } else {
            command = value.join(' ');
        }
    }

    let commandResult;
    for (let i = 0; i < iterations; i++) {
        const { a, b, rule } = parseBooleanOperands(args);
        const result = evalBoolean(rule, a, b);

        if (result && command) {
            if (command instanceof SlashCommandClosure) {
                command.breakController = new SlashCommandBreakController();
                commandResult = await command.execute();
            } else {
                commandResult = await executeSubCommands(command, args._scope, args._parserFlags, args._abortController);
            }
            if (commandResult.isAborted) break;
            if (commandResult.isBreak) break;
        } else {
            break;
        }
    }

    if (commandResult) {
        return commandResult.pipe;
    }

    return '';
}

/**
 *
 * @param {NamedArguments} args
 * @param {UnnamedArguments} value
 * @returns
 */
async function timesCallback(args, value) {
    if (args.guard instanceof SlashCommandClosure) throw new Error('argument \'guard\' cannot be a closure for command /while');
    let repeats;
    let command;
    if (Array.isArray(value)) {
        [repeats, ...command] = value;
        if (command[0] instanceof SlashCommandClosure) {
            command = command[0];
        } else {
            command = command.join(' ');
        }
    } else {
        [repeats, ...command] = /**@type {string}*/(value).split(' ');
        command = command.join(' ');
    }
    const isGuardOff = isFalseBoolean(args.guard);
    const iterations = Math.min(Number(repeats), isGuardOff ? Number.MAX_SAFE_INTEGER : MAX_LOOPS);
    let result;
    for (let i = 0; i < iterations; i++) {
        if (command instanceof SlashCommandClosure) {
            command.breakController = new SlashCommandBreakController();
            command.scope.setMacro('timesIndex', i);
            result = await command.execute();
        }
        else {
            result = await executeSubCommands(command.replace(/\{\{timesIndex\}\}/g, i.toString()), args._scope, args._parserFlags, args._abortController);
        }
        if (result.isAborted) break;
        if (result.isBreak) break;
    }

    return result?.pipe ?? '';
}

/**
 *
 * @param {NamedArguments} args
 * @param {(string|SlashCommandClosure)[]} value
 */
async function ifCallback(args, value) {
    const { a, b, rule } = parseBooleanOperands(args);
    const result = evalBoolean(rule, a, b);

    /**@type {string|SlashCommandClosure} */
    let command;
    if (value) {
        if (value[0] instanceof SlashCommandClosure) {
            command = value[0];
        } else {
            command = value.join(' ');
        }
    }

    let commandResult;
    if (result && command) {
        if (command instanceof SlashCommandClosure) return (await command.execute()).pipe;
        commandResult = await executeSubCommands(command, args._scope, args._parserFlags, args._abortController);
    } else if (!result && args.else && ((typeof args.else === 'string' && args.else !== '') || args.else instanceof SlashCommandClosure)) {
        if (args.else instanceof SlashCommandClosure) return (await args.else.execute()).pipe;
        commandResult = await executeSubCommands(args.else, args._scope, args._parserFlags, args._abortController);
    }

    if (commandResult) {
        return commandResult.pipe;
    }
    return '';
}

/**
 * Checks if a local variable exists.
 * @param {string} name Local variable name
 * @returns {boolean} True if the local variable exists, false otherwise
 */
function existsLocalVariable(name) {
    return chat_metadata.variables && chat_metadata.variables[name] !== undefined;
}

/**
 * Checks if a global variable exists.
 * @param {string} name Global variable name
 * @returns {boolean} True if the global variable exists, false otherwise
 */
function existsGlobalVariable(name) {
    return extension_settings.variables.global && extension_settings.variables.global[name] !== undefined;
}

/**
 * Parses boolean operands from command arguments.
 * @param {object} args Command arguments
 * @returns {{a: string | number, b: string | number, rule: string}} Boolean operands
 */
export function parseBooleanOperands(args) {
    // Resolution order: numeric literal, local variable, global variable, string literal
    /**
     * @param {string} operand Boolean operand candidate
     */
    function getOperand(operand) {
        if (operand === undefined) {
            return '';
        }

        const operandNumber = Number(operand);

        if (!isNaN(operandNumber)) {
            return operandNumber;
        }

        if (args._scope.existsVariable(operand)) {
            const operandVariable = args._scope.getVariable(operand);
            return operandVariable ?? '';
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

/**
 * Evaluates a boolean comparison rule.
 * @param {string} rule Boolean comparison rule
 * @param {string|number} a The left operand
 * @param {string|number} b The right operand
 * @returns {boolean} True if the rule yields true, false otherwise
 */
export function evalBoolean(rule, a, b) {
    if (!rule) {
        toastr.warning('The rule must be specified for the boolean comparison.', 'Invalid command');
        throw new Error('Invalid command.');
    }

    let result = false;
    if (typeof a === 'number' && typeof b === 'number') {
        // only do numeric comparison if both operands are numbers
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
    } else {
        // otherwise do case-insensitive string comparsion, stringify non-strings
        let aString;
        let bString;
        if (typeof a == 'string') {
            aString = a.toLowerCase();
        } else {
            aString = JSON.stringify(a).toLowerCase();
        }
        if (typeof b == 'string') {
            bString = b.toLowerCase();
        } else {
            bString = JSON.stringify(b).toLowerCase();
        }

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
    }

    return result;
}

/**
 * Executes a slash command from a string (may be enclosed in quotes) and returns the result.
 * @param {string} command Command to execute. May contain escaped macro and batch separators.
 * @param {SlashCommandScope} [scope] The scope to use.
 * @param {{[id:PARSER_FLAG]:boolean}} [parserFlags] The parser flags to use.
 * @param {SlashCommandAbortController} [abortController] The abort controller to use.
 * @returns {Promise<SlashCommandClosureResult>} Closure execution result
 */
async function executeSubCommands(command, scope = null, parserFlags = null, abortController = null) {
    if (command.startsWith('"') && command.endsWith('"')) {
        command = command.slice(1, -1);
    }

    const result = await executeSlashCommandsWithOptions(command, {
        handleExecutionErrors: false,
        handleParserErrors: false,
        parserFlags,
        scope,
        abortController: abortController ?? new SlashCommandAbortController(),
    });

    return result;
}

/**
 * Deletes a local variable.
 * @param {string} name Variable name to delete
 * @returns {string} Empty string
 */
function deleteLocalVariable(name) {
    if (!existsLocalVariable(name)) {
        console.warn(`The local variable "${name}" does not exist.`);
        return '';
    }

    delete chat_metadata.variables[name];
    saveMetadataDebounced();
    return '';
}

/**
 * Deletes a global variable.
 * @param {string} name Variable name to delete
 * @returns {string} Empty string
 */
function deleteGlobalVariable(name) {
    if (!existsGlobalVariable(name)) {
        console.warn(`The global variable "${name}" does not exist.`);
        return '';
    }

    delete extension_settings.variables.global[name];
    saveSettingsDebounced();
    return '';
}

/**
 * Parses a series of numeric values from a string.
 * @param {string} value A space-separated list of numeric values or variable names
 * @param {SlashCommandScope} scope Scope
 * @returns {number[]} An array of numeric values
 */
function parseNumericSeries(value, scope = null) {
    if (typeof value === 'number') {
        return [value];
    }

    const array = value
        .split(' ')
        .map(i => i.trim())
        .filter(i => i !== '')
        .map(i => isNaN(Number(i)) ? Number(resolveVariable(i, scope)) : Number(i))
        .filter(i => !isNaN(i));

    return array;
}

function performOperation(value, operation, singleOperand = false, scope = null) {
    function getResult() {
        if (!value) {
            return 0;
        }

        const array = parseNumericSeries(value, scope);

        if (array.length === 0) {
            return 0;
        }

        const result = singleOperand ? operation(array[0]) : operation(array);

        if (isNaN(result) || !isFinite(result)) {
            return 0;
        }

        return result;
    }

    const result = getResult();
    return String(result);
}

function addValuesCallback(args, value) {
    return performOperation(value, (array) => array.reduce((a, b) => a + b, 0), false, args._scope);
}

function mulValuesCallback(args, value) {
    return performOperation(value, (array) => array.reduce((a, b) => a * b, 1), false, args._scope);
}

function minValuesCallback(args, value) {
    return performOperation(value, (array) => Math.min(...array), false, args._scope);
}

function maxValuesCallback(args, value) {
    return performOperation(value, (array) => Math.max(...array), false, args._scope);
}

function subValuesCallback(args, value) {
    return performOperation(value, (array) => array[0] - array[1], false, args._scope);
}

function divValuesCallback(args, value) {
    return performOperation(value, (array) => {
        if (array[1] === 0) {
            console.warn('Division by zero.');
            return 0;
        }
        return array[0] / array[1];
    }, false, args._scope);
}

function modValuesCallback(args, value) {
    return performOperation(value, (array) => {
        if (array[1] === 0) {
            console.warn('Division by zero.');
            return 0;
        }
        return array[0] % array[1];
    }, false, args._scope);
}

function powValuesCallback(args, value) {
    return performOperation(value, (array) => Math.pow(array[0], array[1]), false, args._scope);
}

function sinValuesCallback(args, value) {
    return performOperation(value, Math.sin, true, args._scope);
}

function cosValuesCallback(args, value) {
    return performOperation(value, Math.cos, true, args._scope);
}

function logValuesCallback(args, value) {
    return performOperation(value, Math.log, true, args._scope);
}

function roundValuesCallback(args, value) {
    return performOperation(value, Math.round, true, args._scope);
}

function absValuesCallback(args, value) {
    return performOperation(value, Math.abs, true, args._scope);
}

function sqrtValuesCallback(args, value) {
    return performOperation(value, Math.sqrt, true, args._scope);
}

function lenValuesCallback(value) {
    let parsedValue = value;
    try {
        parsedValue = JSON.parse(value);
    } catch {
        // could not parse
    }
    if (Array.isArray(parsedValue)) {
        return parsedValue.length;
    }
    switch (typeof parsedValue) {
        case 'string':
            return parsedValue.length;
        case 'object':
            return Object.keys(parsedValue).length;
        case 'number':
            return String(parsedValue).length;
        default:
            return 0;
    }
}

function randValuesCallback(from, to, args) {
    const range = to - from;
    const value = from + Math.random() * range;
    if (args.round == 'round') {
        return Math.round(value);
    }
    if (args.round == 'ceil') {
        return Math.ceil(value);
    }
    if (args.round == 'floor') {
        return Math.floor(value);
    }
    return value;
}

/**
 * Declare a new variable in the current scope.
 * @param {NamedArguments} args Named arguments.
 * @param {string|SlashCommandClosure|(string|SlashCommandClosure)[]} value Name and optional value for the variable.
 * @returns The variable's value
 */
function letCallback(args, value) {
    if (!Array.isArray(value)) value = [value];
    if (args.key !== undefined) {
        const key = args.key;
        if (typeof key != 'string') throw new Error('Key must be a string');
        if (args._hasUnnamedArgument) {
            const val = typeof value[0] == 'string' ? value.join(' ') : value[0];
            args._scope.letVariable(key, val);
            return val;
        } else {
            args._scope.letVariable(key);
            return '';
        }
    }
    const key = value.shift();
    if (typeof key != 'string') throw new Error('Key must be a string');
    if (value.length > 0) {
        const val = typeof value[0] == 'string' ? value.join(' ') : value[0];
        args._scope.letVariable(key, val);
        return val;
    } else {
        args._scope.letVariable(key);
        return '';
    }
}

/**
 * Set or retrieve a variable in the current scope or nearest ancestor scope.
 * @param {NamedArguments} args Named arguments.
 * @param {string|SlashCommandClosure|(string|SlashCommandClosure)[]} value Name and optional value for the variable.
 * @returns The variable's value
 */
function varCallback(args, value) {
    if (!Array.isArray(value)) value = [value];
    if (args.key !== undefined) {
        const key = args.key;
        if (typeof key != 'string') throw new Error('Key must be a string');
        if (args._hasUnnamedArgument) {
            const val = typeof value[0] == 'string' ? value.join(' ') : value[0];
            args._scope.setVariable(key, val, args.index, args.as);
            return val;
        } else {
            return args._scope.getVariable(key, args.index);
        }
    }
    const key = value.shift();
    if (typeof key != 'string') throw new Error('Key must be a string');
    if (value.length > 0) {
        const val = typeof value[0] == 'string' ? value.join(' ') : value[0];
        args._scope.setVariable(key, val, args.index, args.as);
        return val;
    } else {
        return args._scope.getVariable(key, args.index);
    }
}

/**
 * @param {NamedArguments} args
 * @param {SlashCommandClosure} value
 * @returns {string}
 */
function closureSerializeCallback(args, value) {
    if (!(value instanceof SlashCommandClosure)) {
        throw new Error('unnamed argument must be a closure');
    }
    return value.rawText;
}

/**
 * @param {NamedArguments} args
 * @param {UnnamedArguments} value
 * @returns {SlashCommandClosure}
 */
function closureDeserializeCallback(args, value) {
    const parser = new SlashCommandParser();
    const closure = parser.parse(value, true, args._parserFlags, args._abortController);
    closure.scope.parent = args._scope;
    return closure;
}

export function registerVariableCommands() {
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'listvar',
        callback: listVariablesCallback,
        aliases: ['listchatvar'],
        helpString: 'List registered chat variables.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'setvar',
        callback: (args, value) => String(setLocalVariable(args.key || args.name, value, args)),
        aliases: ['setchatvar'],
        returns: 'the set variable value',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'key',
                description: 'variable name',
                typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
                isRequired: true,
                enumProvider: commonEnumProviders.variables('local'),
                forceEnum: false,
            }),
            new SlashCommandNamedArgument(
                'index', 'list index', [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.STRING], false,
            ),
            SlashCommandNamedArgument.fromProps({
                name: 'as',
                description: 'change the type of the value when used with index',
                forceEnum: true,
                enumProvider: commonEnumProviders.types,
                isRequired: false,
                defaultValue: 'string',
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'value', [ARGUMENT_TYPE.STRING, ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.BOOLEAN, ARGUMENT_TYPE.LIST, ARGUMENT_TYPE.DICTIONARY], true,
            ),
        ],
        helpString: `
            <div>
                Set a local variable value and pass it down the pipe. The <code>index</code> argument is optional.
                To convert the value to a specific JSON type when using <code>index</code>, use the <code>as</code> argument.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/setvar key=color green</code></pre>
                    </li>
                    <li>
                        <pre><code class="language-stscript">/setvar key=ages index=John as=number 21</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'getvar',
        callback: (args, value) => String(getLocalVariable(value, args)),
        aliases: ['getchatvar'],
        returns: 'the variable value',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'key',
                description: 'variable name',
                typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
                enumProvider: commonEnumProviders.variables('local'),
            }),
            new SlashCommandNamedArgument(
                'index', 'list index', [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.STRING], false,
            ),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'key',
                typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
                isRequired: false,
                enumProvider: commonEnumProviders.variables('local'),
            }),
        ],
        helpString: `
            <div>
                Get a local variable value and pass it down the pipe. The <code>index</code> argument is optional.
            </div>
            <div>
                <strong>Examples:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/getvar height</code></pre>
                    </li>
                    <li>
                        <pre><code class="language-stscript">/getvar key=height</code></pre>
                    </li>
                    <li>
                        <pre><code class="language-stscript">/getvar index=3 costumes</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'addvar',
        callback: (args, value) => String(addLocalVariable(args.key || args.name, value)),
        aliases: ['addchatvar'],
        returns: 'the new variable value',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'key',
                description: 'variable name',
                typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
                isRequired: true,
                enumProvider: commonEnumProviders.variables('local'),
                forceEnum: false,
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'value to add to the variable', [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: `
            <div>
                Add a value to a local variable and pass the result down the pipe.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/addvar key=score 10</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'setglobalvar',
        callback: (args, value) => String(setGlobalVariable(args.key || args.name, value, args)),
        returns: 'the set global variable value',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'key',
                description: 'variable name',
                typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
                isRequired: true,
                enumProvider: commonEnumProviders.variables('global'),
                forceEnum: false,
            }),
            new SlashCommandNamedArgument(
                'index', 'list index', [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.STRING], false,
            ),
            SlashCommandNamedArgument.fromProps({
                name: 'as',
                description: 'change the type of the value when used with index',
                forceEnum: true,
                enumProvider: commonEnumProviders.types,
                isRequired: false,
                defaultValue: 'string',
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'value', [ARGUMENT_TYPE.STRING, ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.BOOLEAN, ARGUMENT_TYPE.LIST, ARGUMENT_TYPE.DICTIONARY], true,
            ),
        ],
        helpString: `
            <div>
                Set a global variable value and pass it down the pipe. The <code>index</code> argument is optional.
                To convert the value to a specific JSON type when using <code>index</code>, use the <code>as</code> argument.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/setglobalvar key=color green</code></pre>
                    </li>
                    <li>
                        <pre><code class="language-stscript">/setglobalvar key=ages index=John as=number 21</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'getglobalvar',
        callback: (args, value) => String(getGlobalVariable(value, args)),
        returns: 'global variable value',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'key',
                description: 'variable name',
                typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
                enumProvider: commonEnumProviders.variables('global'),
            }),
            new SlashCommandNamedArgument(
                'index', 'list index', [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.STRING], false,
            ),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'key',
                typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
                enumProvider: commonEnumProviders.variables('global'),
            }),
        ],
        helpString: `
            <div>
                Get a global variable value and pass it down the pipe. The <code>index</code> argument is optional.
            </div>
            <div>
                <strong>Examples:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/getglobalvar height</code></pre>
                    </li>
                    <li>
                        <pre><code class="language-stscript">/getglobalvar key=height</code></pre>
                    </li>
                    <li>
                        <pre><code class="language-stscript">/getglobalvar index=3 costumes</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'addglobalvar',
        callback: (args, value) => String(addGlobalVariable(args.key || args.name, value)),
        returns: 'the new variable value',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'key',
                description: 'variable name',
                typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
                isRequired: true,
                enumProvider: commonEnumProviders.variables('global'),
                forceEnum: false,
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'value to add to the variable', [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: `
            <div>
                Add a value to a global variable and pass the result down the pipe.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/addglobalvar key=score 10</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'incvar',
        callback: (_, value) => String(incrementLocalVariable(value)),
        aliases: ['incchatvar'],
        returns: 'the new variable value',
        unnamedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'key',
                description: 'variable name',
                typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
                isRequired: true,
                enumProvider: commonEnumProviders.variables('local'),
                forceEnum: false,
            }),
        ],
        helpString: `
            <div>
                Increment a local variable by 1 and pass the result down the pipe.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/incvar score</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'decvar',
        callback: (_, value) => String(decrementLocalVariable(value)),
        aliases: ['decchatvar'],
        returns: 'the new variable value',
        unnamedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'key',
                description: 'variable name',
                typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
                isRequired: true,
                enumProvider: commonEnumProviders.variables('local'),
                forceEnum: false,
            }),
        ],
        helpString: `
            <div>
                Decrement a local variable by 1 and pass the result down the pipe.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/decvar score</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'incglobalvar',
        callback: (_, value) => String(incrementGlobalVariable(value)),
        returns: 'the new variable value',
        unnamedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'key',
                description: 'variable name',
                typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
                isRequired: true,
                enumProvider: commonEnumProviders.variables('global'),
                forceEnum: false,
            }),
        ],
        helpString: `
            <div>
                Increment a global variable by 1 and pass the result down the pipe.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/incglobalvar score</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'decglobalvar',
        callback: (_, value) => String(decrementGlobalVariable(value)),
        returns: 'the new variable value',
        unnamedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'key',
                description: 'variable name',
                typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
                isRequired: true,
                enumProvider: commonEnumProviders.variables('global'),
                forceEnum: false,
            }),
        ],
        helpString: `
            <div>
                Decrement a global variable by 1 and pass the result down the pipe.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/decglobalvar score</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'if',
        callback: ifCallback,
        returns: 'result of the executed command ("then" or "else")',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'left',
                description: 'left operand',
                typeList: [ARGUMENT_TYPE.VARIABLE_NAME, ARGUMENT_TYPE.STRING, ARGUMENT_TYPE.NUMBER],
                isRequired: true,
                enumProvider: commonEnumProviders.variables('all'),
                forceEnum: false,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'right',
                description: 'right operand',
                typeList: [ARGUMENT_TYPE.VARIABLE_NAME, ARGUMENT_TYPE.STRING, ARGUMENT_TYPE.NUMBER],
                isRequired: true,
                enumProvider: commonEnumProviders.variables('all'),
                forceEnum: false,
            }),
            new SlashCommandNamedArgument(
                'rule', 'comparison rule', [ARGUMENT_TYPE.STRING], true, false, null, [
                    new SlashCommandEnumValue('gt', 'a > b'),
                    new SlashCommandEnumValue('gte', 'a >= b'),
                    new SlashCommandEnumValue('lt', 'a < b'),
                    new SlashCommandEnumValue('lte', 'a <= b'),
                    new SlashCommandEnumValue('eq', 'a == b'),
                    new SlashCommandEnumValue('neq', 'a !== b'),
                    new SlashCommandEnumValue('not', '!a'),
                    new SlashCommandEnumValue('in', 'a includes b'),
                    new SlashCommandEnumValue('nin', 'a not includes b'),
                ],
            ),
            new SlashCommandNamedArgument(
                'else', 'command to execute if not true', [ARGUMENT_TYPE.CLOSURE, ARGUMENT_TYPE.SUBCOMMAND], false,
            ),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'command to execute if true', [ARGUMENT_TYPE.CLOSURE, ARGUMENT_TYPE.SUBCOMMAND], true,
            ),
        ],
        splitUnnamedArgument: true,
        helpString: `
            <div>
                Compares the value of the left operand <code>a</code> with the value of the right operand <code>b</code>,
                and if the condition yields true, then execute any valid slash command enclosed in quotes and pass the
                result of the command execution down the pipe.
            </div>
            <div>
                Numeric values and string literals for left and right operands supported.
            </div>
            <div>
                <strong>Available rules:</strong>
                <ul>
                    <li>gt => a > b</li>
                    <li>gte => a >= b</li>
                    <li>lt => a < b</li>
                    <li>lte => a <= b</li>
                    <li>eq => a == b</li>
                    <li>neq => a != b</li>
                    <li>not => !a</li>
                    <li>in (strings) => a includes b</li>
                    <li>nin (strings) => a not includes b</li>
                </ul>
            </div>
            <div>
                <strong>Examples:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/if left=score right=10 rule=gte "/speak You win"</code></pre>
                        triggers a /speak command if the value of "score" is greater or equals 10.
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'while',
        callback: whileCallback,
        returns: 'result of the last executed command',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'left',
                description: 'left operand',
                typeList: [ARGUMENT_TYPE.VARIABLE_NAME, ARGUMENT_TYPE.STRING, ARGUMENT_TYPE.NUMBER],
                isRequired: true,
                enumProvider: commonEnumProviders.variables('all'),
                forceEnum: false,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'right',
                description: 'right operand',
                typeList: [ARGUMENT_TYPE.VARIABLE_NAME, ARGUMENT_TYPE.STRING, ARGUMENT_TYPE.NUMBER],
                isRequired: true,
                enumProvider: commonEnumProviders.variables('all'),
                forceEnum: false,
            }),
            new SlashCommandNamedArgument(
                'rule', 'comparison rule', [ARGUMENT_TYPE.STRING], true, false, null, [
                    new SlashCommandEnumValue('gt', 'a > b'),
                    new SlashCommandEnumValue('gte', 'a >= b'),
                    new SlashCommandEnumValue('lt', 'a < b'),
                    new SlashCommandEnumValue('lte', 'a <= b'),
                    new SlashCommandEnumValue('eq', 'a == b'),
                    new SlashCommandEnumValue('neq', 'a !== b'),
                    new SlashCommandEnumValue('not', '!a'),
                    new SlashCommandEnumValue('in', 'a includes b'),
                    new SlashCommandEnumValue('nin', 'a not includes b'),
                ],
            ),
            new SlashCommandNamedArgument(
                'guard', 'disable loop iteration limit', [ARGUMENT_TYPE.STRING], false, false, null, commonEnumProviders.boolean('onOff')(),
            ),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'command to execute while true', [ARGUMENT_TYPE.CLOSURE, ARGUMENT_TYPE.SUBCOMMAND], true,
            ),
        ],
        splitUnnamedArgument: true,
        helpString: `
            <div>
                Compares the value of the left operand <code>a</code> with the value of the right operand <code>b</code>,
                and if the condition yields true, then execute any valid slash command enclosed in quotes.
            </div>
            <div>
                Numeric values and string literals for left and right operands supported.
            </div>
            <div>
                <strong>Available rules:</strong>
                <ul>
                    <li>gt => a > b</li>
                    <li>gte => a >= b</li>
                    <li>lt => a < b</li>
                    <li>lte => a <= b</li>
                    <li>eq => a == b</li>
                    <li>neq => a != b</li>
                    <li>not => !a</li>
                    <li>in (strings) => a includes b</li>
                    <li>nin (strings) => a not includes b</li>
                </ul>
            </div>
            <div>
                <strong>Examples:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/setvar key=i 0 | /while left=i right=10 rule=lte "/addvar key=i 1"</code></pre>
                        adds 1 to the value of "i" until it reaches 10.
                    </li>
                </ul>
            </div>
            <div>
                Loops are limited to 100 iterations by default, pass <code>guard=off</code> to disable.
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'times',
        callback: timesCallback,
        returns: 'result of the last executed command',
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'guard', 'disable loop iteration limit', [ARGUMENT_TYPE.STRING], false, false, null, commonEnumProviders.boolean('onOff')(),
            ),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'repeats',
                [ARGUMENT_TYPE.NUMBER],
                true,
            ),
            new SlashCommandArgument(
                'command',
                [ARGUMENT_TYPE.CLOSURE, ARGUMENT_TYPE.SUBCOMMAND],
                true,
            ),
        ],
        splitUnnamedArgument: true,
        splitUnnamedArgumentCount: 1,
        helpString: `
            <div>
                Execute any valid slash command enclosed in quotes <code>repeats</code> number of times.
            </div>
            <div>
                <strong>Examples:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/setvar key=i 1 | /times 5 "/addvar key=i 1"</code></pre>
                        adds 1 to the value of "i" 5 times.
                    </li>
                    <li>
                        <pre><code class="language-stscript">/times 4 "/echo {{timesIndex}}"</code></pre>
                        echos the numbers 0 through 4. <code>{{timesIndex}}</code> is replaced with the iteration number (zero-based).
                    </li>
                </ul>
            </div>
            <div>
                Loops are limited to 100 iterations by default, pass <code>guard=off</code> to disable.
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'flushvar',
        callback: async (_, value) => deleteLocalVariable(value instanceof SlashCommandClosure ? (await value.execute())?.pipe : String(value)),
        aliases: ['flushchatvar'],
        unnamedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'key',
                description: 'variable name or closure that returns a variable name',
                typeList: [ARGUMENT_TYPE.VARIABLE_NAME, ARGUMENT_TYPE.CLOSURE],
                enumProvider: commonEnumProviders.variables('local'),
            }),
        ],
        helpString: `
            <div>
                Delete a local variable.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/flushvar score</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'flushglobalvar',
        callback: async (_, value) => deleteGlobalVariable(value instanceof SlashCommandClosure ? (await value.execute())?.pipe : String(value)),
        namedArgumentList: [],
        unnamedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'key',
                description: 'variable name or closure that returns a variable name',
                typeList: [ARGUMENT_TYPE.VARIABLE_NAME, ARGUMENT_TYPE.CLOSURE],
                enumProvider: commonEnumProviders.variables('global'),
            }),
        ],
        helpString: `
            <div>
                Deletes the specified global variable.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/flushglobalvar score</code></pre>
                        Deletes the global variable <code>score</code>.
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'add',
        callback: (args, /**@type {string[]}*/value) => addValuesCallback(args, value.join(' ')),
        returns: 'sum of the provided values',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'values to sum',
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.VARIABLE_NAME],
                isRequired: true,
                acceptsMultiple: true,
                enumProvider: (executor, scope)=>{
                    const vars = commonEnumProviders.variables('all')(executor, scope);
                    vars.push(
                        new SlashCommandEnumValue(
                            'any variable name',
                            null,
                            enumTypes.variable,
                            enumIcons.variable,
                            (input)=>/^\w*$/.test(input),
                            (input)=>input,
                        ),
                        new SlashCommandEnumValue(
                            'any number',
                            null,
                            enumTypes.number,
                            enumIcons.number,
                            (input)=>input == '' || !Number.isNaN(Number(input)),
                            (input)=>input,
                        ),
                    );
                    return vars;
                },
                forceEnum: false,
            }),
        ],
        splitUnnamedArgument: true,
        helpString: `
            <div>
                Performs an addition of the set of values and passes the result down the pipe.
                Can use variable names.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/add 10 i 30 j</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'mul',
        callback: (args, value) => mulValuesCallback(args, value),
        returns: 'product of the provided values',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'values to multiply',
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.VARIABLE_NAME],
                isRequired: true,
                acceptsMultiple: true,
                enumProvider: commonEnumProviders.variables('all'),
                forceEnum: false,
            }),
        ],
        helpString: `
            <div>
                Performs a multiplication of the set of values and passes the result down the pipe. Can use variable names.
            </div>
            <div>
                <strong>Examples:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/mul 10 i 30 j</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'max',
        callback: maxValuesCallback,
        returns: 'maximum value of the set of values',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'values to find the max',
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.VARIABLE_NAME],
                isRequired: true,
                acceptsMultiple: true,
                enumProvider: commonEnumProviders.variables('all'),
                forceEnum: false,
            }),
        ],
        helpString: `
            <div>
                Returns the maximum value of the set of values and passes the result down the pipe. Can use variable names.
            </div>
            <div>
                <strong>Examples:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/max 10 i 30 j</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'min',
        callback: minValuesCallback,
        returns: 'minimum value of the set of values',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'values to find the min',
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.VARIABLE_NAME],
                isRequired: true,
                acceptsMultiple: true,
                enumProvider: commonEnumProviders.variables('all'),
                forceEnum: false,
            }),
        ],
        helpString: `
            <div>
                Returns the minimum value of the set of values and passes the result down the pipe.
                Can use variable names.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/min 10 i 30 j</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'sub',
        callback: subValuesCallback,
        returns: 'difference of the provided values',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'values to find the difference',
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.VARIABLE_NAME],
                isRequired: true,
                acceptsMultiple: true,
                enumProvider: commonEnumProviders.variables('all'),
                forceEnum: false,
            }),
        ],
        helpString: `
            <div>
                Performs a subtraction of the set of values and passes the result down the pipe.
                Can use variable names.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/sub i 5</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'div',
        callback: divValuesCallback,
        returns: 'result of division',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'dividend',
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.VARIABLE_NAME],
                isRequired: true,
                enumProvider: commonEnumProviders.variables('all'),
                forceEnum: false,
            }),
            SlashCommandArgument.fromProps({
                description: 'divisor',
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.VARIABLE_NAME],
                isRequired: true,
                enumProvider: commonEnumProviders.variables('all'),
                forceEnum: false,
            }),
        ],
        helpString: `
            <div>
                Performs a division of two values and passes the result down the pipe.
                Can use variable names.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/div 10 i</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'mod',
        callback: modValuesCallback,
        returns: 'result of modulo operation',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'dividend',
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.VARIABLE_NAME],
                isRequired: true,
                enumProvider: commonEnumProviders.variables('all'),
                forceEnum: false,
            }),
            SlashCommandArgument.fromProps({
                description: 'divisor',
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.VARIABLE_NAME],
                isRequired: true,
                enumProvider: commonEnumProviders.variables('all'),
                forceEnum: false,
            }),
        ],
        helpString: `
            <div>
                Performs a modulo operation of two values and passes the result down the pipe.
                Can use variable names.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/mod i 2</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'pow',
        callback: powValuesCallback,
        returns: 'result of power operation',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'base',
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.VARIABLE_NAME],
                isRequired: true,
                enumProvider: commonEnumProviders.variables('all'),
                forceEnum: false,
            }),
            SlashCommandArgument.fromProps({
                description: 'exponent',
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.VARIABLE_NAME],
                isRequired: true,
                enumProvider: commonEnumProviders.variables('all'),
                forceEnum: false,
            }),
        ],
        helpString: `
            <div>
                Performs a power operation of two values and passes the result down the pipe.
                Can use variable names.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/pow i 2</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'sin',
        callback: sinValuesCallback,
        returns: 'sine of the provided value',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'value',
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.VARIABLE_NAME],
                isRequired: true,
                enumProvider: commonEnumProviders.variables('all'),
                forceEnum: false,
            }),
        ],
        helpString: `
            <div>
                Performs a sine operation of a value and passes the result down the pipe.
                Can use variable names.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/sin i</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'cos',
        callback: cosValuesCallback,
        returns: 'cosine of the provided value',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'value',
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.VARIABLE_NAME],
                isRequired: true,
                enumProvider: commonEnumProviders.variables('all'),
                forceEnum: false,
            }),
        ],
        helpString: `
            <div>
                Performs a cosine operation of a value and passes the result down the pipe.
                Can use variable names.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/cos i</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'log',
        callback: logValuesCallback,
        returns: 'log of the provided value',
        namedArgumentList: [],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'value',
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.VARIABLE_NAME],
                isRequired: true,
                enumProvider: commonEnumProviders.variables('all'),
                forceEnum: false,
            }),
        ],
        helpString: `
            <div>
                Performs a logarithm operation of a value and passes the result down the pipe.
                Can use variable names.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/log i</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'abs',
        callback: absValuesCallback,
        returns: 'absolute value of the provided value',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'value',
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.VARIABLE_NAME],
                isRequired: true,
                enumProvider: commonEnumProviders.variables('all'),
                forceEnum: false,
            }),
        ],
        helpString: `
            <div>
                Performs an absolute value operation of a value and passes the result down the pipe.
                Can use variable names.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/abs i</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'sqrt',
        callback: sqrtValuesCallback,
        returns: 'square root of the provided value',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'value',
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.VARIABLE_NAME],
                isRequired: true,
                enumProvider: commonEnumProviders.variables('all'),
                forceEnum: false,
            }),
        ],
        helpString: `
            <div>
                Performs a square root operation of a value and passes the result down the pipe.
                Can use variable names.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/sqrt i</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'round',
        callback: roundValuesCallback,
        returns: 'rounded value',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'value',
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.VARIABLE_NAME],
                isRequired: true,
                enumProvider: commonEnumProviders.variables('all'),
                forceEnum: false,
            }),
        ],
        helpString: `
            <div>
                Rounds a value and passes the result down the pipe.
                Can use variable names.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/round i</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'len',
        callback: (_, value) => String(lenValuesCallback(value)),
        aliases: ['length'],
        returns: 'length of the provided value',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'value',
                typeList: [ARGUMENT_TYPE.STRING, ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.LIST, ARGUMENT_TYPE.DICTIONARY],
                isRequired: true,
                forceEnum: false,
            }),
        ],
        helpString: `
            <div>
                Gets the length of a value and passes the result down the pipe.
                <ul>
                    <li>
                        For strings, returns the number of characters.
                    </li>
                    <li>
                        For lists and dictionaries, returns the number of elements.
                    </li>
                    <li>
                        For numbers, returns the number of digits (including the sign and decimal point).
                    </li>
                </ul>
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/len Lorem ipsum | /echo</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'rand',
        callback: (args, value) => String(randValuesCallback(Number(args.from ?? 0), Number(args.to ?? (value ? value : 1)), args)),
        returns: 'random number',
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'from',
                'starting value for the range (inclusive)',
                [ARGUMENT_TYPE.NUMBER],
                false,
                false,
                '0',
            ),
            new SlashCommandNamedArgument(
                'to',
                'ending value for the range (inclusive)',
                [ARGUMENT_TYPE.NUMBER],
                false,
                false,
                '1',
            ),
            new SlashCommandNamedArgument(
                'round',
                'rounding method for the result',
                [ARGUMENT_TYPE.STRING],
                false,
                false,
                null,
                ['round', 'ceil', 'floor'],
            ),
        ],
        helpString: `
            <div>
                Returns a random number between <code>from</code> and <code>to</code> (inclusive).
            </div>
            <div>
                <strong>Examples:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/rand</code></pre>
                        Returns a random number between 0 and 1.
                    </li>
                    <li>
                        <pre><code class="language-stscript">/rand 10</code></pre>
                        Returns a random number between 0 and 10.
                    </li>
                    <li>
                        <pre><code class="language-stscript">/rand from=5 to=10</code></pre>
                        Returns a random number between 5 and 10.
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'var',
        callback: (/** @type {NamedArguments} */ args, value) => varCallback(args, value),
        returns: 'the variable value',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'key',
                description: 'variable name; forces setting the variable, even if no value is provided',
                typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
                enumProvider: commonEnumProviders.variables('scope'),
                forceEnum: false,
            }),
            new SlashCommandNamedArgument(
                'index',
                'optional index for list or dictionary',
                [ARGUMENT_TYPE.NUMBER],
                false, // isRequired
                false, // acceptsMultiple
            ),
            SlashCommandNamedArgument.fromProps({
                name: 'as',
                description: 'change the type of the value when used with index',
                forceEnum: true,
                enumProvider: commonEnumProviders.types,
                isRequired: false,
                defaultValue: 'string',
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'variable name',
                typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
                enumProvider: commonEnumProviders.variables('scope'),
                forceEnum: false,
            }),
            new SlashCommandArgument(
                'variable value',
                [ARGUMENT_TYPE.STRING, ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.BOOLEAN, ARGUMENT_TYPE.LIST, ARGUMENT_TYPE.DICTIONARY, ARGUMENT_TYPE.CLOSURE],
                false, // isRequired
                false, // acceptsMultiple
            ),
        ],
        splitUnnamedArgument: true,
        splitUnnamedArgumentCount: 1,
        helpString: `
            <div>
                Get or set a variable. Use <code>index</code> to access elements of a JSON-serialized list or dictionary.
                To convert the value to a specific JSON type when using with <code>index</code>, use the <code>as</code> argument.
            </div>
            <div>
                <strong>Examples:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/let x foo | /var x foo bar | /var x | /echo</code></pre>
                    </li>
                    <li>
                        <pre><code class="language-stscript">/let x foo | /var key=x foo bar | /var x | /echo</code></pre>
                    </li>
                    <li>
                        <pre><code class="language-stscript">/let x {} | /var index=cool as=number x 1337 | /echo {{var::x}}</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'let',
        callback: (/** @type {NamedArguments} */ args, value) => letCallback(args, value),
        returns: 'the variable value',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'key',
                description: 'variable name',
                typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
                enumProvider: commonEnumProviders.variables('scope'),
                forceEnum: false,
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'variable name',
                typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
                enumProvider: commonEnumProviders.variables('scope'),
                forceEnum: false,
            }),
            new SlashCommandArgument(
                'variable value', [ARGUMENT_TYPE.STRING, ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.BOOLEAN, ARGUMENT_TYPE.LIST, ARGUMENT_TYPE.DICTIONARY, ARGUMENT_TYPE.CLOSURE],
            ),
        ],
        splitUnnamedArgument: true,
        splitUnnamedArgumentCount: 1,
        helpString: `
            <div>
                Declares a new variable in the current scope.
            </div>
            <div>
                <strong>Examples:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/let x foo bar | /echo {{var::x}}</code></pre>
                    </li>
                    <li>
                        <pre><code class="language-stscript">/let key=x foo bar | /echo {{var::x}}</code></pre>
                    </li>
                    <li>
                        <pre><code class="language-stscript">/let y</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'closure-serialize',
        /**
         *
         * @param {NamedArguments} args
         * @param {SlashCommandClosure} value
         * @returns {string}
         */
        callback: (args, value) => closureSerializeCallback(args, value),
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'the closure to serialize',
                typeList: [ARGUMENT_TYPE.CLOSURE],
                isRequired: true,
            }),
        ],
        returns: 'serialized closure as string',
        helpString: `
            <div>
                Serialize a closure as text that can be stored in global and chat variables.
            </div>
            <div>
                <strong>Examples:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/closure-serialize {: x=1 /echo x is {{var::x}} and y is {{var::y}} :} |\n/setvar key=myClosure</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'closure-deserialize',
        /**
         * @param {NamedArguments} args
         * @param {UnnamedArguments} value
         * @returns {SlashCommandClosure}
         */
        callback: (args, value) => closureDeserializeCallback(args, value),
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'serialized closure',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
            }),
        ],
        returns: 'deserialized closure',
        helpString: `
            <div>
                Deserialize a closure from text.
            </div>
            <div>
                <strong>Examples:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/closure-deserialize {{getvar::myClosure}} |\n/let myClosure {{pipe}} |\n/let y bar |\n/:myClosure x=foo</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
}
