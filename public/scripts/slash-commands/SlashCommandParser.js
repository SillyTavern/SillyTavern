import { power_user } from '../power-user.js';
import { isTrueBoolean, uuidv4 } from '../utils.js';
import { SlashCommand } from './SlashCommand.js';
import { OPTION_TYPE, SlashCommandAutoCompleteOption } from './SlashCommandAutoCompleteOption.js';
import { SlashCommandClosure } from './SlashCommandClosure.js';
import { SlashCommandExecutor } from './SlashCommandExecutor.js';
import { SlashCommandParserError } from './SlashCommandParserError.js';
import { NAME_RESULT_TYPE, SlashCommandParserNameResult } from './SlashCommandParserNameResult.js';
// eslint-disable-next-line no-unused-vars
import { SlashCommandScope } from './SlashCommandScope.js';

/**@readonly*/
/**@enum {Number}*/
export const PARSER_FLAG = {
    'STRICT_ESCAPING': 1,
    'REPLACE_GETVAR': 2,
};

export class SlashCommandParser {
    // @ts-ignore
    /**@type {Object.<string, SlashCommand>}*/ commands = {};
    // @ts-ignore
    /**@type {Object.<string, string>}*/ helpStrings = {};
    /**@type {boolean}*/ verifyCommandNames = true;
    /**@type {string}*/ text;
    /**@type {string}*/ keptText;
    /**@type {number}*/ index;
    /**@type {SlashCommandScope}*/ scope;
    /**@type {SlashCommandClosure}*/ closure;

    /**@type {Object.<PARSER_FLAG,boolean>}*/ flags = {};

    /**@type {boolean}*/ jumpedEscapeSequence = false;

    /**@type {{start:number, end:number}[]}*/ closureIndex;
    /**@type {SlashCommandExecutor[]}*/ commandIndex;
    /**@type {SlashCommandScope[]}*/ scopeIndex;

    get userIndex() { return this.index - 2; }

    get ahead() {
        return this.text.slice(this.index + 1);
    }
    get behind() {
        return this.text.slice(0, this.index);
    }
    get char() {
        return this.text[this.index];
    }
    get endOfText() {
        return this.index >= this.text.length || /^\s+$/.test(this.ahead);
    }


    constructor() {
        // add dummy commands for help strings / autocomplete
        this.addDummyCommand('parser-flag',
            [],
            `<span class="monospace">(${Object.keys(PARSER_FLAG).join('|')}) (on|off)</span> – Set a parser flag.`,
        );
        this.addDummyCommand('/',
            ['#'],
            '<span class="monospace">(comment)</span> – Write a comment.',
        );
        this.registerLanguage();
    }
    registerLanguage() {
        // NUMBER mode is copied from highlightjs's own implementation for JavaScript
        // https://tc39.es/ecma262/#sec-literals-numeric-literals
        const decimalDigits = '[0-9](_?[0-9])*';
        const frac = `\\.(${decimalDigits})`;
        // DecimalIntegerLiteral, including Annex B NonOctalDecimalIntegerLiteral
        // https://tc39.es/ecma262/#sec-additional-syntax-numeric-literals
        const decimalInteger = '0|[1-9](_?[0-9])*|0[0-7]*[89][0-9]*';
        const NUMBER = {
            className: 'number',
            variants: [
                // DecimalLiteral
                { begin: `(\\b(${decimalInteger})((${frac})|\\.)?|(${frac}))` +
        `[eE][+-]?(${decimalDigits})\\b` },
                { begin: `\\b(${decimalInteger})\\b((${frac})\\b|\\.)?|(${frac})\\b` },

                // DecimalBigIntegerLiteral
                { begin: '\\b(0|[1-9](_?[0-9])*)n\\b' },

                // NonDecimalIntegerLiteral
                { begin: '\\b0[xX][0-9a-fA-F](_?[0-9a-fA-F])*n?\\b' },
                { begin: '\\b0[bB][0-1](_?[0-1])*n?\\b' },
                { begin: '\\b0[oO][0-7](_?[0-7])*n?\\b' },

                // LegacyOctalIntegerLiteral (does not include underscore separators)
                // https://tc39.es/ecma262/#sec-additional-syntax-numeric-literals
                { begin: '\\b0[0-7]+n?\\b' },
            ],
            relevance: 0,
        };

        const COMMAND = {
            scope: 'command',
            begin: /\/\S+/,
            beginScope: 'title.function',
            end: /\||$|:}/,
            contains: [], // defined later
        };
        const CLOSURE = {
            scope: 'closure',
            begin: /{:/,
            end: /:}/,
            contains: [], // defined later
        };
        const CLOSURE_ARGS = {
            scope: 'params',
            begin: /:}\(/,
            end: /\)/,
            contains: [],
        };
        const NAMED_ARG = {
            scope: 'type',
            begin: /\w+=/,
            end: '',
        };
        const MACRO = {
            scope: 'operator',
            begin: /{{/,
            end: /}}/,
        };
        COMMAND.contains.push(
            hljs.BACKSLASH_ESCAPE,
            NAMED_ARG,
            hljs.QUOTE_STRING_MODE,
            NUMBER,
            MACRO,
            CLOSURE,
            CLOSURE_ARGS,
        );
        CLOSURE.contains.push(
            hljs.BACKSLASH_ESCAPE,
            NAMED_ARG,
            hljs.QUOTE_STRING_MODE,
            NUMBER,
            MACRO,
            COMMAND,
            'self',
            CLOSURE_ARGS,
        );
        CLOSURE_ARGS.contains.push(
            hljs.BACKSLASH_ESCAPE,
            NAMED_ARG,
            hljs.QUOTE_STRING_MODE,
            NUMBER,
            MACRO,
            CLOSURE,
            'self',
        );
        hljs.registerLanguage('stscript', ()=>({
            case_insensitive: false,
            keywords: ['|'],
            contains: [
                hljs.BACKSLASH_ESCAPE,
                COMMAND,
                CLOSURE,
                CLOSURE_ARGS,
            ],
        }));
    }

    addCommand(command, callback, aliases, helpString = '', interruptsGeneration = false, purgeFromMessage = true) {
        const reserved = ['/', '#', ':', 'parser-flag'];
        for (const start of reserved) {
            if (command.toLowerCase().startsWith(start) || (aliases ?? []).find(a=>a.toLowerCase().startsWith(reserved))) {
                throw new Error(`Illegal Name. Slash command name cannot begin with "${start}".`);
            }
        }
        this.addCommandUnsafe(command, callback, aliases, helpString, interruptsGeneration, purgeFromMessage);
    }
    addCommandUnsafe(command, callback, aliases, helpString = '', interruptsGeneration = false, purgeFromMessage = true) {
        const fnObj = Object.assign(new SlashCommand(), { name:command, callback, helpString, interruptsGeneration, purgeFromMessage, aliases });

        if ([command, ...aliases].some(x => Object.hasOwn(this.commands, x))) {
            console.trace('WARN: Duplicate slash command registered!', [command, ...aliases]);
        }

        this.commands[command] = fnObj;

        if (Array.isArray(aliases)) {
            aliases.forEach((alias) => {
                this.commands[alias] = fnObj;
            });
        }
    }
    addDummyCommand(command, aliases, helpString) {
        this.addCommandUnsafe(command, null, aliases, helpString, true, true);
    }

    getHelpString() {
        const listItems = Object
            .keys(this.commands)
            .filter(key=>this.commands[key].name == key)
            .map(key=>this.commands[key])
            .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
            .map(x => x.helpStringFormatted)
            .map(x => `<li>${x}</li>`)
            .join('\n');
        return `<p>Slash commands:</p><ol>${listItems}</ol>
        <small>Slash commands can be batched into a single input by adding a pipe character | at the end, and then writing a new slash command.</small>
        <ul><li><small>Example:</small><code>/cut 1 | /sys Hello, | /continue</code></li>
        <li>This will remove the first message in chat, send a system message that starts with 'Hello,', and then ask the AI to continue the message.</li></ul>`;
    }

    /**
     *
     * @param {*} text The text to parse.
     * @param {*} index Index to check for names (cursor position).
     */
    getNameAt(text, index) {
        if (this.text != `{:${text}:}`) {
            try {
                this.parse(text, false);
            } catch (e) {
                // do nothing
                console.warn(e);
            }
        }
        index += 2;
        const executor = this.commandIndex
            .filter(it=>it.start <= index && (it.end >= index || it.end == null))
            .slice(-1)[0]
            ?? null
        ;

        if (executor) {
            const childClosure = this.closureIndex
                .find(it=>it.start <= index && (it.end >= index || it.end == null) && it.start > executor.start)
                ?? null
            ;
            if (childClosure !== null) return null;
            if (executor.name == ':') {
                return new SlashCommandParserNameResult(
                    NAME_RESULT_TYPE.CLOSURE,
                    executor.value.toString(),
                    executor.start,
                    this.scopeIndex[this.commandIndex.indexOf(executor)]
                        ?.allVariableNames
                        ?.map(it=>new SlashCommandAutoCompleteOption(OPTION_TYPE.VARIABLE_NAME, it, it))
                        ?? []
                    ,
                );
            }
            return new SlashCommandParserNameResult(
                NAME_RESULT_TYPE.COMMAND,
                executor.name,
                executor.start,
            );
        }
        return null;
    }

    /**
     * Moves the index <length> number of characters forward and returns the last character taken.
     * @param {number} length Number of characters to take.
     * @param {boolean} keep Whether to add the characters to the kept text.
     * @returns The last character taken.
     */
    take(length = 1, keep = false) {
        this.jumpedEscapeSequence = false;
        let content = this.char;
        this.index++;
        if (keep) this.keptText += content;
        if (length > 1) {
            content = this.take(length - 1, keep);
        }
        return content;
    }
    discardWhitespace() {
        while (/\s/.test(this.char)) {
            this.take(); // discard whitespace
            this.jumpedEscapeSequence = false;
        }
    }
    /**
     * Tests if the next characters match a symbol.
     * Moves the index forward if the next characters are backslashes directly followed by the symbol.
     * Expects that the current char is taken after testing.
     * @param {string|RegExp} sequence Sequence of chars or regex character group that is the symbol.
     * @param {number} offset Offset from the current index (won't move the index if offset != 0).
     * @returns Whether the next characters are the indicated symbol.
     */
    testSymbol(sequence, offset = 0) {
        if (!this.flags[PARSER_FLAG.STRICT_ESCAPING]) return this.testSymbolLooseyGoosey(sequence, offset);
        // /echo abc | /echo def
        // -> TOAST: abc
        // -> TOAST: def
        // /echo abc \| /echo def
        // -> TOAST: abc | /echo def
        // /echo abc \\| /echo def
        // -> TOAST: abc \
        // -> TOAST: def
        // /echo abc \\\| /echo def
        // -> TOAST: abc \| /echo def
        // /echo abc \\\\| /echo def
        // -> TOAST: abc \\
        // -> TOAST: def
        // /echo title=\:} \{: | /echo title=\{: \:}
        // -> TOAST: *:}* {:
        // -> TOAST: *{:* :}
        const escapeOffset = this.jumpedEscapeSequence ? -1 : 0;
        const escapes = this.text.slice(this.index + offset + escapeOffset).replace(/^(\\*).*$/s, '$1').length;
        const test = (sequence instanceof RegExp) ?
            (text) => new RegExp(`^${sequence.source}`).test(text) :
            (text) => text.startsWith(sequence)
        ;
        if (test(this.text.slice(this.index + offset + escapeOffset + escapes))) {
            // no backslashes before sequence
            //   -> sequence found
            if (escapes == 0) return true;
            // uneven number of backslashes before sequence
            //   = the final backslash escapes the sequence
            //   = every preceding pair is one literal backslash
            //    -> move index forward to skip the backslash escaping the first backslash or the symbol
            // even number of backslashes before sequence
            //   = every pair is one literal backslash
            //    -> move index forward to skip the backslash escaping the first backslash
            if (!this.jumpedEscapeSequence && offset == 0) {
                this.index++;
                this.jumpedEscapeSequence = true;
            }
            return false;
        }
    }

    testSymbolLooseyGoosey(sequence, offset = 0) {
        const escapeOffset = this.jumpedEscapeSequence ? -1 : 0;
        const escapes = this.text[this.index + offset + escapeOffset] == '\\' ? 1 : 0;
        const test = (sequence instanceof RegExp) ?
            (text) => new RegExp(`^${sequence.source}`).test(text) :
            (text) => text.startsWith(sequence)
        ;
        if (test(this.text.slice(this.index + offset + escapeOffset + escapes))) {
            // no backslashes before sequence
            //   -> sequence found
            if (escapes == 0) return true;
            // otherwise
            //   -> sequence found
            if (!this.jumpedEscapeSequence && offset == 0) {
                this.index++;
                this.jumpedEscapeSequence = true;
            }
            return false;
        }
    }

    replaceGetvar(value) {
        return value.replace(/{{(get(?:global)?var)::([^}]+)}}/gi, (_, cmd, name) => {
            name = name.trim();
            // store pipe
            const pipeName = `_PARSER_${uuidv4()}`;
            const storePipe = new SlashCommandExecutor(null);
            storePipe.command = this.commands['let'];
            storePipe.name = 'let';
            storePipe.value = `${pipeName} {{pipe}}`;
            this.closure.executorList.push(storePipe);
            // getvar / getglobalvar
            const getvar = new SlashCommandExecutor(null);
            getvar.command = this.commands[cmd];
            getvar.name = 'cmd';
            getvar.value = name;
            this.closure.executorList.push(getvar);
            // set to temp scoped var
            const varName = `_PARSER_${uuidv4()}`;
            const setvar = new SlashCommandExecutor(null);
            setvar.command = this.commands['let'];
            setvar.name = 'let';
            setvar.value = `${varName} {{pipe}}`;
            this.closure.executorList.push(setvar);
            // return pipe
            const returnPipe = new SlashCommandExecutor(null);
            returnPipe.command = this.commands['return'];
            returnPipe.name = 'return';
            returnPipe.value = `{{var::${pipeName}}}`;
            this.closure.executorList.push(returnPipe);
            return `{{var::${varName}}}`;
        });
    }


    parse(text, verifyCommandNames = true, flags = null) {
        this.verifyCommandNames = verifyCommandNames;
        for (const key of Object.keys(PARSER_FLAG)) {
            this.flags[PARSER_FLAG[key]] = flags?.[PARSER_FLAG[key]] ?? power_user.stscript.parser.flags[PARSER_FLAG[key]] ?? false;
        }
        this.text = `{:${text}:}`;
        this.keptText = '';
        this.index = 0;
        this.scope = null;
        this.closureIndex = [];
        this.commandIndex = [];
        this.scopeIndex = [];
        const closure = this.parseClosure();
        closure.keptText = this.keptText;
        return closure;
    }

    testClosure() {
        return this.testSymbol('{:');
    }
    testClosureEnd() {
        if (this.ahead.length < 1) throw new SlashCommandParserError(`Unclosed closure at position ${this.userIndex}`, this.text, this.index);
        return this.testSymbol(':}');
    }
    parseClosure() {
        const closureIndexEntry = { start:this.index + 1, end:null };
        this.closureIndex.push(closureIndexEntry);
        let injectPipe = true;
        this.take(2); // discard opening {:
        let closure = new SlashCommandClosure(this.scope);
        this.scope = closure.scope;
        this.closure = closure;
        this.discardWhitespace();
        while (this.testNamedArgument()) {
            const arg = this.parseNamedArgument();
            closure.arguments[arg.key] = arg.value;
            this.scope.variableNames.push(arg.key);
            this.discardWhitespace();
        }
        while (!this.testClosureEnd()) {
            if (this.testComment()) {
                this.parseComment();
            } else if (this.testParserFlag()) {
                this.parseParserFlag();
            } else if (this.testRunShorthand()) {
                const cmd = this.parseRunShorthand();
                closure.executorList.push(cmd);
                injectPipe = true;
            } else if (this.testCommand()) {
                const cmd = this.parseCommand();
                cmd.injectPipe = injectPipe;
                closure.executorList.push(cmd);
                injectPipe = true;
            } else {
                while (!this.testCommandEnd()) this.take(); // discard plain text and comments
            }
            this.discardWhitespace();
            // first pipe marks end of command
            if (this.testSymbol('|')) {
                this.take(); // discard first pipe
                // second pipe indicates no pipe injection for the next command
                if (this.testSymbol('|')) {
                    injectPipe = false;
                    this.take(); // discard second pipe
                }
            }
            this.discardWhitespace(); // discard further whitespace
        }
        this.take(2); // discard closing :}
        if (this.testSymbol('()')) {
            this.take(2); // discard ()
            closure.executeNow = true;
        }
        closureIndexEntry.end = this.index - 1;
        this.discardWhitespace(); // discard trailing whitespace
        this.scope = closure.scope.parent;
        return closure;
    }

    testComment() {
        return this.testSymbol(/\/[/#]/);
    }
    testCommentEnd() {
        return this.testCommandEnd();
    }
    parseComment() {
        const start = this.index + 2;
        const cmd = new SlashCommandExecutor(start);
        this.commandIndex.push(cmd);
        this.scopeIndex.push(this.scope.getCopy());
        this.take(); // discard "/"
        cmd.name = this.take(); // set second "/" or "#" as name
        while (!this.testCommentEnd()) this.take();
        cmd.end = this.index;
    }

    testParserFlag() {
        return this.testSymbol('/parser-flag ');
    }
    testParserFlagEnd() {
        return this.testCommandEnd();
    }
    parseParserFlag() {
        const start = this.index + 1;
        const cmd = new SlashCommandExecutor(start);
        cmd.name = 'parser-flag';
        cmd.value = '';
        this.commandIndex.push(cmd);
        this.scopeIndex.push(this.scope.getCopy());
        this.take(13); // discard "/parser-flag "
        const [flag, state] = this.parseUnnamedArgument()?.split(/\s+/) ?? [null, null];
        if (Object.keys(PARSER_FLAG).includes(flag)) {
            this.flags[PARSER_FLAG[flag]] = isTrueBoolean(state);
        }
        cmd.end = this.index;
    }

    testRunShorthand() {
        return this.testSymbol('/:') && !this.testSymbol(':}', 1);
    }
    testRunShorthandEnd() {
        return this.testCommandEnd();
    }
    parseRunShorthand() {
        const start = this.index + 2;
        const cmd = new SlashCommandExecutor(start);
        cmd.name = ':';
        cmd.value = '';
        cmd.command = this.commands['run'];
        this.commandIndex.push(cmd);
        this.scopeIndex.push(this.scope.getCopy());
        this.take(2); //discard "/:"
        if (this.testQuotedValue()) cmd.value = this.parseQuotedValue();
        else cmd.value = this.parseValue();
        this.discardWhitespace();
        while (this.testNamedArgument()) {
            const arg = this.parseNamedArgument();
            cmd.args[arg.key] = arg.value;
            this.discardWhitespace();
        }
        this.discardWhitespace();
        // /run shorthand does not take unnamed arguments (the command name practically *is* the unnamed argument)
        if (this.testRunShorthandEnd()) {
            cmd.end = this.index;
            if (!cmd.command?.purgeFromMessage) this.keptText += this.text.slice(cmd.start, cmd.end);
            return cmd;
        } else {
            console.warn(this.behind, this.char, this.ahead);
            throw new SlashCommandParserError(`Unexpected end of command at position ${this.userIndex}: "/${cmd.name}"`, this.text, this.index);
        }
    }

    testCommand() {
        return this.testSymbol('/');
    }
    testCommandEnd() {
        return this.testClosureEnd() || this.testSymbol('|');
    }
    parseCommand() {
        const start = this.index + 1;
        const cmd = new SlashCommandExecutor(start);
        cmd.parserFlags = Object.assign({}, this.flags);
        this.commandIndex.push(cmd);
        this.scopeIndex.push(this.scope.getCopy());
        this.take(); // discard "/"
        while (!/\s/.test(this.char) && !this.testCommandEnd()) cmd.name += this.take(); // take chars until whitespace or end
        this.discardWhitespace();
        if (this.verifyCommandNames && !this.commands[cmd.name]) throw new SlashCommandParserError(`Unknown command at position ${this.index - cmd.name.length - 2}: "/${cmd.name}"`, this.text, this.index - cmd.name.length);
        cmd.command = this.commands[cmd.name];
        while (this.testNamedArgument()) {
            const arg = this.parseNamedArgument();
            cmd.args[arg.key] = arg.value;
            this.discardWhitespace();
        }
        this.discardWhitespace();
        if (this.testUnnamedArgument()) {
            cmd.value = this.parseUnnamedArgument();
            if (cmd.name == 'let') {
                if (Array.isArray(cmd.value)) {
                    if (typeof cmd.value[0] == 'string') {
                        this.scope.variableNames.push(cmd.value[0]);
                    }
                } else if (typeof cmd.value == 'string') {
                    this.scope.variableNames.push(cmd.value.split(/\s+/)[0]);
                }
            }
        }
        if (this.testCommandEnd()) {
            cmd.end = this.index;
            if (!cmd.command?.purgeFromMessage) this.keptText += this.text.slice(cmd.start, cmd.end);
            return cmd;
        } else {
            console.warn(this.behind, this.char, this.ahead);
            throw new SlashCommandParserError(`Unexpected end of command at position ${this.userIndex}: "/${cmd.name}"`, this.text, this.index);
        }
    }

    testNamedArgument() {
        return /^(\w+)=/.test(`${this.char}${this.ahead}`);
    }
    parseNamedArgument() {
        let key = '';
        while (/\w/.test(this.char)) key += this.take(); // take chars
        this.take(); // discard "="
        let value;
        if (this.testClosure()) {
            value = this.parseClosure();
        } else if (this.testQuotedValue()) {
            value = this.parseQuotedValue();
        } else if (this.testListValue()) {
            value = this.parseListValue();
        } else if (this.testValue()) {
            value = this.parseValue();
        }
        return { key, value };
    }

    testUnnamedArgument() {
        return !this.testCommandEnd();
    }
    testUnnamedArgumentEnd() {
        return this.testCommandEnd();
    }
    parseUnnamedArgument() {
        /**@type {SlashCommandClosure|String}*/
        let value = this.jumpedEscapeSequence ? this.take() : ''; // take the first, already tested, char if it is an escaped one
        let isList = false;
        let listValues = [];
        while (!this.testUnnamedArgumentEnd()) {
            if (this.testClosure()) {
                isList = true;
                if (value.length > 0) {
                    listValues.push(value.trim());
                    value = '';
                }
                listValues.push(this.parseClosure());
            } else {
                value += this.take();
            }
        }
        if (isList && value.trim().length > 0) {
            listValues.push(value.trim());
        }
        if (isList) {
            if (listValues.length == 1) return listValues[0];
            return listValues;
        }
        value = value.trim();
        if (this.flags[PARSER_FLAG.REPLACE_GETVAR]) {
            value = this.replaceGetvar(value);
        }
        return value;
    }

    testQuotedValue() {
        return this.testSymbol('"');
    }
    testQuotedValueEnd() {
        if (this.endOfText) {
            if (this.verifyCommandNames) throw new SlashCommandParserError(`Unexpected end of quoted value at position ${this.index}`, this.text, this.index);
            else return true;
        }
        if (!this.verifyCommandNames && this.testClosureEnd()) return true;
        if (this.verifyCommandNames && !this.flags[PARSER_FLAG.STRICT_ESCAPING] && this.testCommandEnd()) {
            throw new SlashCommandParserError(`Unexpected end of quoted value at position ${this.index}`, this.text, this.index);
        }
        return this.testSymbol('"') || (!this.flags[PARSER_FLAG.STRICT_ESCAPING] && this.testCommandEnd());
    }
    parseQuotedValue() {
        this.take(); // discard opening quote
        let value = '';
        while (!this.testQuotedValueEnd()) value += this.take(); // take all chars until closing quote
        this.take(); // discard closing quote
        if (this.flags[PARSER_FLAG.REPLACE_GETVAR]) {
            value = this.replaceGetvar(value);
        }
        return value;
    }

    testListValue() {
        return this.testSymbol('[');
    }
    testListValueEnd() {
        if (this.endOfText) throw new SlashCommandParserError(`Unexpected end of list value at position ${this.index}`, this.text, this.index);
        return this.testSymbol(']');
    }
    parseListValue() {
        let value = this.take(); // take the already tested opening bracket
        while (!this.testListValueEnd()) value += this.take(); // take all chars until closing bracket
        value += this.take(); // take closing bracket
        if (this.flags[PARSER_FLAG.REPLACE_GETVAR]) {
            value = this.replaceGetvar(value);
        }
        return value;
    }

    testValue() {
        return !this.testSymbol(/\s/);
    }
    testValueEnd() {
        if (this.testSymbol(/\s/)) return true;
        return this.testCommandEnd();
    }
    parseValue() {
        let value = this.jumpedEscapeSequence ? this.take() : ''; // take the first, already tested, char if it is an escaped one
        while (!this.testValueEnd()) value += this.take(); // take all chars until value end
        if (this.flags[PARSER_FLAG.REPLACE_GETVAR]) {
            value = this.replaceGetvar(value);
        }
        return value;
    }
}
