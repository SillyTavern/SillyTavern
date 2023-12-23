import { chat_metadata, getCurrentChatId, saveSettingsDebounced, sendSystemMessage, system_message_types } from '../script.js';
import { extension_settings, saveMetadataDebounced } from './extensions.js';
import { executeSlashCommands, registerSlashCommand } from './slash-commands.js';
import { isFalseBoolean } from './utils.js';

const MAX_LOOPS = 100;

function getLocalVariable(name, args = {}) {
    if (!chat_metadata.variables) {
        chat_metadata.variables = {};
    }

    let localVariable = chat_metadata?.variables[name];
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

    return (localVariable === '' || isNaN(Number(localVariable))) ? (localVariable || '') : Number(localVariable);
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
                localVariable[args.index] = value;
            } else {
                if (localVariable === null) {
                    localVariable = [];
                }
                localVariable[numIndex] = value;
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
    let globalVariable = extension_settings.variables.global[name];
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

    return (globalVariable === '' || isNaN(Number(globalVariable))) ? (globalVariable || '') : Number(globalVariable);
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
                globalVariable[args.index] = value;
            } else {
                if (globalVariable === null) {
                    globalVariable = [];
                }
                globalVariable[numIndex] = value;
            }
            extension_settings.variables.global[name] = JSON.stringify(globalVariable);
        } catch {
            // that didn't work
        }
    } else {
        extension_settings.variables.global[name] = value;
    }
    saveSettingsDebounced();
}

function addLocalVariable(name, value) {
    const currentValue = getLocalVariable(name) || 0;
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
 * @returns {string} Variable value or the string literal
 */
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
}

async function whileCallback(args, command) {
    const isGuardOff = isFalseBoolean(args.guard);
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

async function timesCallback(args, value) {
    const [repeats, ...commandParts] = value.split(' ');
    const command = commandParts.join(' ');
    const isGuardOff = isFalseBoolean(args.guard);
    const iterations = Math.min(Number(repeats), isGuardOff ? Number.MAX_SAFE_INTEGER : MAX_LOOPS);

    for (let i = 0; i < iterations; i++) {
        await executeSubCommands(command.replace(/\{\{timesIndex\}\}/g, i));
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
function parseBooleanOperands(args) {
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

/**
 * Executes a slash command from a string (may be enclosed in quotes) and returns the result.
 * @param {string} command Command to execute. May contain escaped macro and batch separators.
 * @returns {Promise<string>} Pipe result
 */
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
 * @returns {number[]} An array of numeric values
 */
function parseNumericSeries(value) {
    if (typeof value === 'number') {
        return [value];
    }

    const array = value
        .split(' ')
        .map(i => i.trim())
        .filter(i => i !== '')
        .map(i => isNaN(Number(i)) ? Number(resolveVariable(i)) : Number(i))
        .filter(i => !isNaN(i));

    return array;
}

function performOperation(value, operation, singleOperand = false) {
    if (!value) {
        return 0;
    }

    const array = parseNumericSeries(value);

    if (array.length === 0) {
        return 0;
    }

    const result = singleOperand ? operation(array[0]) : operation(array);

    if (isNaN(result) || !isFinite(result)) {
        return 0;
    }

    return result;
}

function addValuesCallback(value) {
    return performOperation(value, (array) => array.reduce((a, b) => a + b, 0));
}

function mulValuesCallback(value) {
    return performOperation(value, (array) => array.reduce((a, b) => a * b, 1));
}

function minValuesCallback(value) {
    return performOperation(value, (array) => Math.min(...array));
}

function maxValuesCallback(value) {
    return performOperation(value, (array) => Math.max(...array));
}

function subValuesCallback(value) {
    return performOperation(value, (array) => array[0] - array[1]);
}

function divValuesCallback(value) {
    return performOperation(value, (array) => {
        if (array[1] === 0) {
            console.warn('Division by zero.');
            return 0;
        }
        return array[0] / array[1];
    });
}

function modValuesCallback(value) {
    return performOperation(value, (array) => {
        if (array[1] === 0) {
            console.warn('Division by zero.');
            return 0;
        }
        return array[0] % array[1];
    });
}

function powValuesCallback(value) {
    return performOperation(value, (array) => Math.pow(array[0], array[1]));
}

function sinValuesCallback(value) {
    return performOperation(value, Math.sin, true);
}

function cosValuesCallback(value) {
    return performOperation(value, Math.cos, true);
}

function logValuesCallback(value) {
    return performOperation(value, Math.log, true);
}

function roundValuesCallback(value) {
    return performOperation(value, Math.round, true);
}

function absValuesCallback(value) {
    return performOperation(value, Math.abs, true);
}

function sqrtValuesCallback(value) {
    return performOperation(value, Math.sqrt, true);
}

function lenValuesCallback(value) {
    let parsedValue = value;
    try {
        parsedValue = JSON.parse(value);
    } catch {
        // could not parse
    }
    return parsedValue.length;
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

export function registerVariableCommands() {
    registerSlashCommand('listvar', listVariablesCallback, [], ' – list registered chat variables', true, true);
    registerSlashCommand('setvar', (args, value) => setLocalVariable(args.key || args.name, value, args), [], '<span class="monospace">key=varname index=listIndex (value)</span> – set a local variable value and pass it down the pipe, index is optional, e.g. <tt>/setvar key=color green</tt>', true, true);
    registerSlashCommand('getvar', (args, value) => getLocalVariable(value, args), [], '<span class="monospace">index=listIndex (key)</span> – get a local variable value and pass it down the pipe, index is optional, e.g. <tt>/getvar height</tt> or <tt>/getvar index=3 costumes</tt>', true, true);
    registerSlashCommand('addvar', (args, value) => addLocalVariable(args.key || args.name, value), [], '<span class="monospace">key=varname (increment)</span> – add a value to a local variable and pass the result down the pipe, e.g. <tt>/addvar score 10</tt>', true, true);
    registerSlashCommand('setglobalvar', (args, value) => setGlobalVariable(args.key || args.name, value, args), [], '<span class="monospace">key=varname index=listIndex (value)</span> – set a global variable value and pass it down the pipe, index is optional, e.g. <tt>/setglobalvar key=color green</tt>', true, true);
    registerSlashCommand('getglobalvar', (args, value) => getGlobalVariable(value, args), [], '<span class="monospace">index=listIndex (key)</span> – get a global variable value and pass it down the pipe, index is optional, e.g. <tt>/getglobalvar height</tt> or <tt>/getglobalvar index=3 costumes</tt>', true, true);
    registerSlashCommand('addglobalvar', (args, value) => addGlobalVariable(args.key || args.name, value), [], '<span class="monospace">key=varname (increment)</span> – add a value to a global variable and pass the result down the pipe, e.g. <tt>/addglobalvar score 10</tt>', true, true);
    registerSlashCommand('incvar', (_, value) => incrementLocalVariable(value), [], '<span class="monospace">(key)</span> – increment a local variable by 1 and pass the result down the pipe, e.g. <tt>/incvar score</tt>', true, true);
    registerSlashCommand('decvar', (_, value) => decrementLocalVariable(value), [], '<span class="monospace">(key)</span> – decrement a local variable by 1 and pass the result down the pipe, e.g. <tt>/decvar score</tt>', true, true);
    registerSlashCommand('incglobalvar', (_, value) => incrementGlobalVariable(value), [], '<span class="monospace">(key)</span> – increment a global variable by 1 and pass the result down the pipe, e.g. <tt>/incglobalvar score</tt>', true, true);
    registerSlashCommand('decglobalvar', (_, value) => decrementGlobalVariable(value), [], '<span class="monospace">(key)</span> – decrement a global variable by 1 and pass the result down the pipe, e.g. <tt>/decglobalvar score</tt>', true, true);
    registerSlashCommand('if', ifCallback, [], '<span class="monospace">left=varname1 right=varname2 rule=comparison else="(alt.command)" "(command)"</span> – compare the value of the left operand "a" with the value of the right operand "b", and if the condition yields true, then execute any valid slash command enclosed in quotes and pass the result of the command execution down the pipe. Numeric values and string literals for left and right operands supported. Available rules: gt => a > b, gte => a >= b, lt => a < b, lte => a <= b, eq => a == b, neq => a != b, not => !a, in (strings) => a includes b, nin (strings) => a not includes b, e.g. <tt>/if left=score right=10 rule=gte "/speak You win"</tt> triggers a /speak command if the value of "score" is greater or equals 10.', true, true);
    registerSlashCommand('while', whileCallback, [], '<span class="monospace">left=varname1 right=varname2 rule=comparison "(command)"</span> – compare the value of the left operand "a" with the value of the right operand "b", and if the condition yields true, then execute any valid slash command enclosed in quotes. Numeric values and string literals for left and right operands supported. Available rules: gt => a > b, gte => a >= b, lt => a < b, lte => a <= b, eq => a == b, neq => a != b, not => !a, in (strings) => a includes b, nin (strings) => a not includes b, e.g. <tt>/setvar key=i 0 | /while left=i right=10 rule=let "/addvar key=i 1"</tt> adds 1 to the value of "i" until it reaches 10. Loops are limited to 100 iterations by default, pass guard=off to disable.', true, true);
    registerSlashCommand('times', (args, value) => timesCallback(args, value), [], '<span class="monospace">(repeats) "(command)"</span> – execute any valid slash command enclosed in quotes <tt>repeats</tt> number of times, e.g. <tt>/setvar key=i 1 | /times 5 "/addvar key=i 1"</tt> adds 1 to the value of "i" 5 times. <tt>{{timesIndex}}</tt> is replaced with the iteration number (zero-based), e.g. <tt>/times 4 "/echo {{timesIndex}}"</tt> echos the numbers 0 through 4. Loops are limited to 100 iterations by default, pass guard=off to disable.', true, true);
    registerSlashCommand('flushvar', (_, value) => deleteLocalVariable(value), [], '<span class="monospace">(key)</span> – delete a local variable, e.g. <tt>/flushvar score</tt>', true, true);
    registerSlashCommand('flushglobalvar', (_, value) => deleteGlobalVariable(value), [], '<span class="monospace">(key)</span> – delete a global variable, e.g. <tt>/flushglobalvar score</tt>', true, true);
    registerSlashCommand('add', (_, value) => addValuesCallback(value), [], '<span class="monospace">(a b c d)</span> – performs an addition of the set of values and passes the result down the pipe, can use variable names, e.g. <tt>/add 10 i 30 j</tt>', true, true);
    registerSlashCommand('mul', (_, value) => mulValuesCallback(value), [], '<span class="monospace">(a b c d)</span> – performs a multiplication of the set of values and passes the result down the pipe, can use variable names, e.g. <tt>/mul 10 i 30 j</tt>', true, true);
    registerSlashCommand('max', (_, value) => maxValuesCallback(value), [], '<span class="monospace">(a b c d)</span> – returns the maximum value of the set of values and passes the result down the pipe, can use variable names, e.g. <tt>/max 10 i 30 j</tt>', true, true);
    registerSlashCommand('min', (_, value) => minValuesCallback(value), [], '<span class="monospace">(a b c d)</span> – returns the minimum value of the set of values and passes the result down the pipe, can use variable names, e.g. <tt>/min 10 i 30 j</tt>', true, true);
    registerSlashCommand('sub', (_, value) => subValuesCallback(value), [], '<span class="monospace">(a b)</span> – performs a subtraction of two values and passes the result down the pipe, can use variable names, e.g. <tt>/sub i 5</tt>', true, true);
    registerSlashCommand('div', (_, value) => divValuesCallback(value), [], '<span class="monospace">(a b)</span> – performs a division of two values and passes the result down the pipe, can use variable names, e.g. <tt>/div 10 i</tt>', true, true);
    registerSlashCommand('mod', (_, value) => modValuesCallback(value), [], '<span class="monospace">(a b)</span> – performs a modulo operation of two values and passes the result down the pipe, can use variable names, e.g. <tt>/mod i 2</tt>', true, true);
    registerSlashCommand('pow', (_, value) => powValuesCallback(value), [], '<span class="monospace">(a b)</span> – performs a power operation of two values and passes the result down the pipe, can use variable names, e.g. <tt>/pow i 2</tt>', true, true);
    registerSlashCommand('sin', (_, value) => sinValuesCallback(value), [], '<span class="monospace">(a)</span> – performs a sine operation of a value and passes the result down the pipe, can use variable names, e.g. <tt>/sin i</tt>', true, true);
    registerSlashCommand('cos', (_, value) => cosValuesCallback(value), [], '<span class="monospace">(a)</span> – performs a cosine operation of a value and passes the result down the pipe, can use variable names, e.g. <tt>/cos i</tt>', true, true);
    registerSlashCommand('log', (_, value) => logValuesCallback(value), [], '<span class="monospace">(a)</span> – performs a logarithm operation of a value and passes the result down the pipe, can use variable names, e.g. <tt>/log i</tt>', true, true);
    registerSlashCommand('abs', (_, value) => absValuesCallback(value), [], '<span class="monospace">(a)</span> – performs an absolute value operation of a value and passes the result down the pipe, can use variable names, e.g. <tt>/abs i</tt>', true, true);
    registerSlashCommand('sqrt', (_, value) => sqrtValuesCallback(value), [], '<span class="monospace">(a)</span> – performs a square root operation of a value and passes the result down the pipe, can use variable names, e.g. <tt>/sqrt i</tt>', true, true);
    registerSlashCommand('round', (_, value) => roundValuesCallback(value), [], '<span class="monospace">(a)</span> – rounds a value and passes the result down the pipe, can use variable names, e.g. <tt>/round i</tt>', true, true);
    registerSlashCommand('len', (_, value) => lenValuesCallback(value), [], '<span class="monospace">(a)</span> – gets the length of a value and passes the result down the pipe, can use variable names, e.g. <tt>/len i</tt>', true, true);
    registerSlashCommand('rand', (args, value) => randValuesCallback(Number(args.from ?? 0), Number(args.to ?? (value.length ? value : 1)), args), [], '<span class="monospace">(from=number=0 to=number=1 round=round|ceil|floor)</span> – returns a random number between from and to, e.g. <tt>/rand</tt> or <tt>/rand 10</tt> or <tt>/rand from=5 to=10</tt>', true, true);
}
