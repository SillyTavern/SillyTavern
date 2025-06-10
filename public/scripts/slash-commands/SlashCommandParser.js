import { hljs } from '../../lib.js';
import { power_user } from '../power-user.js';
import { isFalseBoolean, isTrueBoolean, uuidv4 } from '../utils.js';
import { SlashCommand } from './SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument } from './SlashCommandArgument.js';
import { SlashCommandClosure } from './SlashCommandClosure.js';
import { SlashCommandExecutor } from './SlashCommandExecutor.js';
import { SlashCommandParserError } from './SlashCommandParserError.js';
import { AutoCompleteNameResult } from '../autocomplete/AutoCompleteNameResult.js';
import { SlashCommandQuickReplyAutoCompleteOption } from './SlashCommandQuickReplyAutoCompleteOption.js';
import { SlashCommandScope } from './SlashCommandScope.js';
import { SlashCommandVariableAutoCompleteOption } from './SlashCommandVariableAutoCompleteOption.js';
import { SlashCommandNamedArgumentAssignment } from './SlashCommandNamedArgumentAssignment.js';
import { SlashCommandAbortController } from './SlashCommandAbortController.js';
import { SlashCommandAutoCompleteNameResult } from './SlashCommandAutoCompleteNameResult.js';
import { SlashCommandUnnamedArgumentAssignment } from './SlashCommandUnnamedArgumentAssignment.js';
import { SlashCommandEnumValue } from './SlashCommandEnumValue.js';
import { MacroAutoCompleteOption } from '../autocomplete/MacroAutoCompleteOption.js';
import { SlashCommandBreakPoint } from './SlashCommandBreakPoint.js';
import { SlashCommandDebugController } from './SlashCommandDebugController.js';
import { commonEnumProviders } from './SlashCommandCommonEnumsProvider.js';
import { SlashCommandBreak } from './SlashCommandBreak.js';
import { MacrosParser } from '../macros.js';
import { t } from '../i18n.js';

/** @typedef {import('./SlashCommand.js').NamedArgumentsCapture} NamedArgumentsCapture */
/** @typedef {import('./SlashCommand.js').NamedArguments} NamedArguments */

/**
 * @enum {Number}
 * @readonly
 * @typedef {{[id:PARSER_FLAG]:boolean}} ParserFlags
 */
export const PARSER_FLAG = {
    'STRICT_ESCAPING': 1,
    'REPLACE_GETVAR': 2,
};

export class SlashCommandParser {
    /** @type {Object.<string, SlashCommand>} */ static commands = {};

    /**
     * @deprecated Use SlashCommandParser.addCommandObject() instead.
     * @param {string} command Command name
     * @param {(namedArguments:NamedArguments|NamedArgumentsCapture, unnamedArguments:string|SlashCommandClosure|(string|SlashCommandClosure)[])=>string|SlashCommandClosure|Promise<string|SlashCommandClosure>} callback callback The function to execute when the command is called
     * @param {string[]} aliases List of alternative command names
     * @param {string} helpString Help text shown in autocomplete and command browser
     */
    static addCommand(command, callback, aliases, helpString = '') {
        this.addCommandObject(SlashCommand.fromProps({
            name: command,
            callback,
            aliases,
            helpString,
        }));
    }
    /**
     *
     * @param {SlashCommand} command
     */
    static addCommandObject(command) {
        const reserved = ['/', '#', ':', 'parser-flag', 'breakpoint'];
        for (const start of reserved) {
            if (command.name.toLowerCase().startsWith(start) || (command.aliases ?? []).find(a=>a.toLowerCase().startsWith(start))) {
                throw new Error(`Illegal Name. Slash command name cannot begin with "${start}".`);
            }
        }
        this.addCommandObjectUnsafe(command);
    }
    /**
     *
     * @param {SlashCommand} command
     */
    static addCommandObjectUnsafe(command) {
        if ([command.name, ...command.aliases].some(x => Object.hasOwn(this.commands, x))) {
            console.trace('WARN: Duplicate slash command registered!', [command.name, ...command.aliases]);
        }

        const stack = new Error().stack.split('\n').map(it=>it.trim());
        command.isExtension = stack.find(it=>it.includes('/scripts/extensions/')) != null;
        command.isThirdParty = stack.find(it=>it.includes('/scripts/extensions/third-party/')) != null;
        if (command.isThirdParty) {
            command.source = stack.find(it=>it.includes('/scripts/extensions/third-party/')).replace(/^.*?\/scripts\/extensions\/third-party\/([^/]+)\/.*$/, '$1');
        } else if (command.isExtension) {
            command.source = stack.find(it=>it.includes('/scripts/extensions/')).replace(/^.*?\/scripts\/extensions\/([^/]+)\/.*$/, '$1');
        } else {
            const idx = stack.findLastIndex(it=>it.includes('at SlashCommandParser.')) + 1;
            command.source = stack[idx].replace(/^.*?\/((?:scripts\/)?(?:[^/]+)\.js).*$/, '$1');
        }

        this.commands[command.name] = command;

        if (Array.isArray(command.aliases)) {
            command.aliases.forEach((alias) => {
                this.commands[alias] = command;
            });
        }
    }


    get commands() {
        return SlashCommandParser.commands;
    }
    /** @type {Object.<string, string>} */ helpStrings = {};
    /** @type {boolean} */ verifyCommandNames = true;
    /** @type {string} */ text;
    /** @type {number} */ index;
    /** @type {SlashCommandAbortController} */ abortController;
    /** @type {SlashCommandDebugController} */ debugController;
    /** @type {SlashCommandScope} */ scope;
    /** @type {SlashCommandClosure} */ closure;

    /** @type {Object.<PARSER_FLAG,boolean>} */ flags = {};

    /** @type {boolean} */ jumpedEscapeSequence = false;

    /** @type {{start:number, end:number}[]} */ closureIndex;
    /** @type {{start:number, end:number, name:string}[]} */ macroIndex;
    /** @type {SlashCommandExecutor[]} */ commandIndex;
    /** @type {SlashCommandScope[]} */ scopeIndex;

    /** @type {string} */ parserContext;

    get userIndex() { return this.index; }

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
        return this.index >= this.text.length || (/\s/.test(this.char) && /^\s+$/.test(this.ahead));
    }


    constructor() {
        // add dummy commands for help strings / autocomplete
        if (!Object.keys(this.commands).includes('parser-flag')) {
            const help = {};
            help[PARSER_FLAG.REPLACE_GETVAR] = 'Replace all {{getvar::}} and {{getglobalvar::}} macros with scoped variables to avoid double macro substitution.';
            help[PARSER_FLAG.STRICT_ESCAPING] = 'Allows to escape all delimiters with backslash, and allows escaping of backslashes.';
            SlashCommandParser.addCommandObjectUnsafe(SlashCommand.fromProps({ name: 'parser-flag',
                unnamedArgumentList: [
                    SlashCommandArgument.fromProps({
                        description: 'The parser flag to modify.',
                        typeList: [ARGUMENT_TYPE.STRING],
                        isRequired: true,
                        enumList: Object.keys(PARSER_FLAG).map(flag=>new SlashCommandEnumValue(flag, help[PARSER_FLAG[flag]])),
                    }),
                    SlashCommandArgument.fromProps({
                        description: 'The state of the parser flag to set.',
                        typeList: [ARGUMENT_TYPE.BOOLEAN],
                        defaultValue: 'on',
                        enumList: commonEnumProviders.boolean('onOff')(),
                    }),
                ],
                splitUnnamedArgument: true,
                helpString: 'Set a parser flag.',
            }));
        }
        if (!Object.keys(this.commands).includes('/')) {
            SlashCommandParser.addCommandObjectUnsafe(SlashCommand.fromProps({ name: '/',
                aliases: ['#'],
                unnamedArgumentList: [
                    SlashCommandArgument.fromProps({
                        description: 'commentary',
                        typeList: [ARGUMENT_TYPE.STRING],
                    }),
                ],
                helpString: 'Write a comment.',
            }));
        }
        if (!Object.keys(this.commands).includes('breakpoint')) {
            SlashCommandParser.addCommandObjectUnsafe(SlashCommand.fromProps({ name: 'breakpoint',
                helpString: 'Set a breakpoint for debugging in the QR Editor.',
            }));
        }
        if (!Object.keys(this.commands).includes('break')) {
            SlashCommandParser.addCommandObjectUnsafe(SlashCommand.fromProps({ name: 'break',
                helpString: 'Break out of a loop or closure executed through /run or /:',
                unnamedArgumentList: [
                    SlashCommandArgument.fromProps({ description: 'value to pass down the pipe instead of the current pipe value',
                        typeList: Object.values(ARGUMENT_TYPE),
                    }),
                ],
            }));
        }

        //TODO should not be re-registered from every instance
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

        function getQuotedRunRegex() {
            try {
                return new RegExp('(".+?(?<!\\\\)")|(\\S+?)(\\||$|\\s)');
            } catch {
                // fallback for browsers that don't support lookbehind
                return /(".+?")|(\S+?)(\||$|\s)/;
            }
        }

        const BLOCK_COMMENT = {
            scope: 'comment',
            begin: /\/\*/,
            end: /\*\|/,
            contains: [],
        };
        const COMMENT = {
            scope: 'comment',
            begin: /\/[/#]/,
            end: /\||$|:}/,
            contains: [],
        };
        const ABORT = {
            begin: /\/(abort|breakpoint)/,
            beginScope: 'abort',
            end: /\||$|(?=:})/,
            excludeEnd: false,
            returnEnd: true,
            contains: [],
        };
        const IMPORT = {
            scope: 'command',
            begin: /\/(import)/,
            beginScope: 'keyword',
            end: /\||$|(?=:})/,
            excludeEnd: false,
            returnEnd: true,
            contains: [],
        };
        const BREAK = {
            scope: 'command',
            begin: /\/(break)/,
            beginScope: 'keyword',
            end: /\||$|(?=:})/,
            excludeEnd: false,
            returnEnd: true,
            contains: [],
        };
        const LET = {
            begin: [
                /\/(let|var)\s+/,
            ],
            beginScope: {
                1: 'variable',
            },
            end: /\||$|:}/,
            excludeEnd: false,
            returnEnd: true,
            contains: [],
        };
        const SETVAR = {
            begin: /\/(setvar|setglobalvar)\s+/,
            beginScope: 'variable',
            end: /\||$|:}/,
            excludeEnd: false,
            returnEnd: true,
            contains: [],
        };
        const GETVAR = {
            begin: /\/(getvar|getglobalvar)\s+/,
            beginScope: 'variable',
            end: /\||$|:}/,
            excludeEnd: false,
            returnEnd: true,
            contains: [],
        };
        const RUN = {
            match: [
                /\/:/,
                getQuotedRunRegex(),
                /\||$|(?=:})/,
            ],
            className: {
                1: 'variable.language',
                2: 'title.function.invoke',
            },
            contains: [], // defined later
        };
        const COMMAND = {
            scope: 'command',
            begin: /\/\S+/,
            beginScope: 'title.function',
            end: /\||$|(?=:})/,
            excludeEnd: false,
            returnEnd: true,
            contains: [], // defined later
        };
        const CLOSURE = {
            scope: 'closure',
            begin: /{:/,
            end: /:}(\(\))?/,
            beginScope: 'punctuation',
            endScope: 'punctuation',
            contains: [], // defined later
        };
        const NAMED_ARG = {
            scope: 'property',
            begin: /\w+=/,
            end: '',
        };
        const MACRO = {
            scope: 'variable',
            begin: /{{/,
            end: /}}/,
        };
        const PIPEBREAK = {
            beginScope: 'pipebreak',
            begin: /\|\|/,
            end: '',
        };
        const PIPE = {
            beginScope: 'pipe',
            begin: /\|/,
            end: '',
        };
        BLOCK_COMMENT.contains.push(
            BLOCK_COMMENT,
        );
        RUN.contains.push(
            hljs.BACKSLASH_ESCAPE,
            NAMED_ARG,
            hljs.QUOTE_STRING_MODE,
            NUMBER,
            MACRO,
            CLOSURE,
        );
        IMPORT.contains.push(
            hljs.BACKSLASH_ESCAPE,
            NAMED_ARG,
            NUMBER,
            MACRO,
            CLOSURE,
            hljs.QUOTE_STRING_MODE,
        );
        BREAK.contains.push(
            hljs.BACKSLASH_ESCAPE,
            NAMED_ARG,
            NUMBER,
            MACRO,
            CLOSURE,
            hljs.QUOTE_STRING_MODE,
        );
        LET.contains.push(
            hljs.BACKSLASH_ESCAPE,
            NAMED_ARG,
            NUMBER,
            MACRO,
            CLOSURE,
            hljs.QUOTE_STRING_MODE,
        );
        SETVAR.contains.push(
            hljs.BACKSLASH_ESCAPE,
            NAMED_ARG,
            NUMBER,
            MACRO,
            CLOSURE,
            hljs.QUOTE_STRING_MODE,
        );
        GETVAR.contains.push(
            hljs.BACKSLASH_ESCAPE,
            NAMED_ARG,
            hljs.QUOTE_STRING_MODE,
            NUMBER,
            MACRO,
            CLOSURE,
        );
        ABORT.contains.push(
            hljs.BACKSLASH_ESCAPE,
            NAMED_ARG,
            NUMBER,
            MACRO,
            CLOSURE,
            hljs.QUOTE_STRING_MODE,
        );
        COMMAND.contains.push(
            hljs.BACKSLASH_ESCAPE,
            NAMED_ARG,
            NUMBER,
            MACRO,
            CLOSURE,
            hljs.QUOTE_STRING_MODE,
        );
        CLOSURE.contains.push(
            hljs.BACKSLASH_ESCAPE,
            BLOCK_COMMENT,
            COMMENT,
            ABORT,
            IMPORT,
            BREAK,
            NAMED_ARG,
            NUMBER,
            MACRO,
            RUN,
            LET,
            GETVAR,
            SETVAR,
            COMMAND,
            'self',
            hljs.QUOTE_STRING_MODE,
            PIPEBREAK,
            PIPE,
        );
        hljs.registerLanguage('stscript', ()=>({
            case_insensitive: false,
            keywords: [],
            contains: [
                hljs.BACKSLASH_ESCAPE,
                BLOCK_COMMENT,
                COMMENT,
                ABORT,
                IMPORT,
                BREAK,
                RUN,
                LET,
                GETVAR,
                SETVAR,
                COMMAND,
                CLOSURE,
                PIPEBREAK,
                PIPE,
            ],
        }));
    }

    getHelpString() {
        return '<div class="slashHelp">Loading...</div>';
    }

    /**
     *
     * @param {*} text The text to parse.
     * @param {*} index Index to check for names (cursor position).
     */
    async getNameAt(text, index) {
        if (this.text != text) {
            try {
                this.parse(text, false);
            } catch (e) {
                // do nothing
                console.warn(e);
            }
        }
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
            const macro = this.macroIndex.findLast(it=>it.start <= index && it.end >= index);
            if (macro) {
                const frag = document.createRange().createContextualFragment(await (await fetch('/scripts/templates/macros.html')).text());
                const options = [...frag.querySelectorAll('ul:nth-of-type(2n+1) > li')].map(li=>new MacroAutoCompleteOption(
                    li.querySelector('tt').textContent.slice(2, -2).replace(/^([^\s:]+[\s:]+).*$/, '$1'),
                    li.querySelector('tt').textContent,
                    (li.querySelector('tt').remove(),li.innerHTML),
                ));
                for (const macro of MacrosParser) {
                    if (options.find(it => it.name === macro.key)) continue;
                    options.push(new MacroAutoCompleteOption(macro.key, `{{${macro.key}}}`, macro.description || t`No description provided`));
                }
                const result = new AutoCompleteNameResult(
                    macro.name,
                    macro.start + 2,
                    options,
                    false,
                    ()=>`No matching macros for "{{${result.name}}}"`,
                    ()=>'No macros found.',
                );
                return result;
            }
            if (executor.name == ':') {
                const options = this.scopeIndex[this.commandIndex.indexOf(executor)]
                    ?.allVariableNames
                    ?.map(it=>new SlashCommandVariableAutoCompleteOption(it))
                    ?? []
                ;
                try {
                    if ('quickReplyApi' in globalThis) {
                        const qrApi = globalThis.quickReplyApi;
                        options.push(...qrApi.listSets()
                            .map(set=>qrApi.listQuickReplies(set).map(qr=>`${set}.${qr}`))
                            .flat()
                            .map(qr=>new SlashCommandQuickReplyAutoCompleteOption(qr)),
                        );
                    }
                } catch { /* empty */ }
                const result = new AutoCompleteNameResult(
                    executor.unnamedArgumentList[0]?.value.toString(),
                    executor.start,
                    options,
                    true,
                    ()=>`No matching variables in scope and no matching Quick Replies for "${result.name}"`,
                    ()=>'No variables in scope and no Quick Replies found.',
                );
                return result;
            }
            const result = new SlashCommandAutoCompleteNameResult(executor, this.scopeIndex[this.commandIndex.indexOf(executor)], this.commands);
            return result;
        }
        return null;
    }

    /**
     * Moves the index <length> number of characters forward and returns the last character taken.
     * @param {number} length Number of characters to take.
     * @param {boolean} keep Whether to add the characters to the kept text.
     * @returns The last character taken.
     */
    take(length = 1) {
        this.jumpedEscapeSequence = false;
        let content = this.char;
        this.index++;
        if (length > 1) {
            content = this.take(length - 1);
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
        return value.replace(/{{(get(?:global)?var)::([^}]+)}}/gi, (match, cmd, name, idx) => {
            name = name.trim();
            const startIdx = this.index - value.length + idx;
            const endIdx = this.index - value.length + idx + match.length;
            // store pipe
            const pipeName = `_PARSER_PIPE_${uuidv4()}`;
            const storePipe = new SlashCommandExecutor(startIdx); {
                storePipe.end = endIdx;
                storePipe.command = this.commands['let'];
                storePipe.name = 'let';
                const nameAss = new SlashCommandUnnamedArgumentAssignment();
                nameAss.value = pipeName;
                const valAss = new SlashCommandUnnamedArgumentAssignment();
                valAss.value = '{{pipe}}';
                storePipe.unnamedArgumentList = [nameAss, valAss];
                this.closure.executorList.push(storePipe);
            }
            // getvar / getglobalvar
            const getvar = new SlashCommandExecutor(startIdx); {
                getvar.end = endIdx;
                getvar.command = this.commands[cmd];
                getvar.name = cmd;
                const nameAss = new SlashCommandUnnamedArgumentAssignment();
                nameAss.value = name;
                getvar.unnamedArgumentList = [nameAss];
                this.closure.executorList.push(getvar);
            }
            // set to temp scoped var
            const varName = `_PARSER_VAR_${uuidv4()}`;
            const setvar = new SlashCommandExecutor(startIdx); {
                setvar.end = endIdx;
                setvar.command = this.commands['let'];
                setvar.name = 'let';
                const nameAss = new SlashCommandUnnamedArgumentAssignment();
                nameAss.value = varName;
                const valAss = new SlashCommandUnnamedArgumentAssignment();
                valAss.value = '{{pipe}}';
                setvar.unnamedArgumentList = [nameAss, valAss];
                this.closure.executorList.push(setvar);
            }
            // return pipe
            const returnPipe = new SlashCommandExecutor(startIdx); {
                returnPipe.end = endIdx;
                returnPipe.command = this.commands['return'];
                returnPipe.name = 'return';
                const varAss = new SlashCommandUnnamedArgumentAssignment();
                varAss.value = `{{var::${pipeName}}}`;
                returnPipe.unnamedArgumentList = [varAss];
                this.closure.executorList.push(returnPipe);
            }
            return `{{var::${varName}}}`;
        });
    }


    parse(text, verifyCommandNames = true, flags = null, abortController = null, debugController = null) {
        this.verifyCommandNames = verifyCommandNames;
        for (const key of Object.keys(PARSER_FLAG)) {
            this.flags[PARSER_FLAG[key]] = flags?.[PARSER_FLAG[key]] ?? power_user.stscript.parser.flags[PARSER_FLAG[key]] ?? false;
        }
        this.abortController = abortController;
        this.debugController = debugController;
        this.text = text;
        this.index = 0;
        this.scope = null;
        this.closureIndex = [];
        this.commandIndex = [];
        this.scopeIndex = [];
        this.macroIndex = [];
        this.parserContext = uuidv4();
        const closure = this.parseClosure(true);
        return closure;
    }

    testClosure() {
        return this.testSymbol('{:');
    }
    testClosureEnd() {
        if (!this.scope.parent) {
            // "root" closure does not have {: and :}
            if (this.index >= this.text.length) return true;
            return false;
        }
        if (!this.verifyCommandNames) {
            if (this.index >= this.text.length) return true;
        } else {
            if (this.ahead.length < 1) throw new SlashCommandParserError(`Unclosed closure at position ${this.userIndex}`, this.text, this.index);
        }
        return this.testSymbol(':}');
    }
    parseClosure(isRoot = false) {
        const closureIndexEntry = { start:this.index + 1, end:null };
        this.closureIndex.push(closureIndexEntry);
        let injectPipe = true;
        if (!isRoot) this.take(2); // discard opening {:
        const textStart = this.index;
        let closure = new SlashCommandClosure(this.scope);
        closure.parserContext = this.parserContext;
        closure.fullText = this.text;
        closure.abortController = this.abortController;
        closure.debugController = this.debugController;
        this.scope = closure.scope;
        const oldClosure = this.closure;
        this.closure = closure;
        this.discardWhitespace();
        while (this.testNamedArgument()) {
            const arg = this.parseNamedArgument();
            closure.argumentList.push(arg);
            this.scope.variableNames.push(arg.name);
            this.discardWhitespace();
        }
        while (!this.testClosureEnd()) {
            if (this.testBlockComment()) {
                this.parseBlockComment();
            } else if (this.testComment()) {
                this.parseComment();
            } else if (this.testParserFlag()) {
                this.parseParserFlag();
            } else if (this.testRunShorthand()) {
                const cmd = this.parseRunShorthand();
                closure.executorList.push(cmd);
                injectPipe = true;
            } else if (this.testBreakPoint()) {
                const bp = this.parseBreakPoint();
                if (this.debugController) {
                    closure.executorList.push(bp);
                }
            } else if (this.testBreak()) {
                const b = this.parseBreak();
                closure.executorList.push(b);
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
        closure.rawText = this.text.slice(textStart, this.index);
        if (!isRoot) this.take(2); // discard closing :}
        if (this.testSymbol('()')) {
            this.take(2); // discard ()
            closure.executeNow = true;
        }
        closureIndexEntry.end = this.index - 1;
        this.scope = closure.scope.parent;
        this.closure = oldClosure ?? closure;
        return closure;
    }

    testBreakPoint() {
        return this.testSymbol(/\/breakpoint\s*\|/);
    }
    parseBreakPoint() {
        const cmd = new SlashCommandBreakPoint();
        cmd.name = 'breakpoint';
        cmd.command = this.commands['breakpoint'];
        cmd.start = this.index + 1;
        this.take('/breakpoint'.length);
        cmd.end = this.index;
        this.commandIndex.push(cmd);
        this.scopeIndex.push(this.scope.getCopy());
        return cmd;
    }

    testBreak() {
        return this.testSymbol(/\/break(\s|\||$)/);
    }
    parseBreak() {
        const cmd = new SlashCommandBreak();
        cmd.name = 'break';
        cmd.command = this.commands['break'];
        cmd.start = this.index + 1;
        this.take('/break'.length);
        this.discardWhitespace();
        if (this.testUnnamedArgument()) {
            cmd.unnamedArgumentList.push(...this.parseUnnamedArgument());
        }
        cmd.end = this.index;
        this.commandIndex.push(cmd);
        this.scopeIndex.push(this.scope.getCopy());
        return cmd;
    }

    testBlockComment() {
        return this.testSymbol('/*');
    }
    testBlockCommentEnd() {
        if (!this.verifyCommandNames) {
            if (this.index >= this.text.length) return true;
        } else {
            if (this.ahead.length < 1) throw new SlashCommandParserError(`Unclosed block comment at position ${this.userIndex}`, this.text, this.index);
        }
        return this.testSymbol('*|');
    }
    parseBlockComment() {
        const start = this.index + 1;
        const cmd = new SlashCommandExecutor(start);
        cmd.command = this.commands['*'];
        this.commandIndex.push(cmd);
        this.scopeIndex.push(this.scope.getCopy());
        this.take(); // discard "/"
        cmd.name = this.take(); //set "*" as name
        while (!this.testBlockCommentEnd()) {
            if (this.testBlockComment()) {
                this.parseBlockComment();
            }
            this.take();
        }
        this.take(2); // take closing "*|"
        cmd.end = this.index - 1;
    }

    testComment() {
        return this.testSymbol(/\/[/#]/);
    }
    testCommentEnd() {
        if (!this.verifyCommandNames) {
            if (this.index >= this.text.length) return true;
        } else {
            if (this.endOfText) throw new SlashCommandParserError(`Unclosed comment at position ${this.userIndex}`, this.text, this.index);
        }
        return this.testSymbol('|');
    }
    parseComment() {
        const start = this.index + 1;
        const cmd = new SlashCommandExecutor(start);
        cmd.command = this.commands['/'];
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
        cmd.unnamedArgumentList = [];
        cmd.command = this.commands[cmd.name];
        this.commandIndex.push(cmd);
        this.scopeIndex.push(this.scope.getCopy());
        this.take(13); // discard "/parser-flag "
        cmd.startNamedArgs = -1;
        cmd.endNamedArgs = -1;
        cmd.startUnnamedArgs = this.index;
        cmd.unnamedArgumentList = this.parseUnnamedArgument(true);
        const [flag, state] = cmd.unnamedArgumentList ?? [null, null];
        cmd.endUnnamedArgs = this.index;
        if (Object.keys(PARSER_FLAG).includes(flag.value.toString())) {
            this.flags[PARSER_FLAG[flag.value.toString()]] = isTrueBoolean(state?.value.toString() ?? 'on');
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
        cmd.unnamedArgumentList = [];
        cmd.command = this.commands['run'];
        this.commandIndex.push(cmd);
        this.scopeIndex.push(this.scope.getCopy());
        this.take(2); //discard "/:"
        const assignment = new SlashCommandUnnamedArgumentAssignment();
        if (this.testQuotedValue()) assignment.value = this.parseQuotedValue();
        else assignment.value = this.parseValue();
        cmd.unnamedArgumentList = [assignment];
        this.discardWhitespace();
        cmd.startNamedArgs = this.index;
        while (this.testNamedArgument()) {
            const arg = this.parseNamedArgument();
            cmd.namedArgumentList.push(arg);
            this.discardWhitespace();
        }
        cmd.endNamedArgs = this.index;
        this.discardWhitespace();
        // /run shorthand does not take unnamed arguments (the command name practically *is* the unnamed argument)
        if (this.testRunShorthandEnd()) {
            cmd.end = this.index;
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
        if (this.verifyCommandNames && !this.commands[cmd.name]) throw new SlashCommandParserError(`Unknown command at position ${this.index - cmd.name.length}: "/${cmd.name}"`, this.text, this.index - cmd.name.length);
        cmd.command = this.commands[cmd.name];
        cmd.startNamedArgs = this.index;
        cmd.endNamedArgs = this.index;
        while (this.testNamedArgument()) {
            const arg = this.parseNamedArgument();
            cmd.namedArgumentList.push(arg);
            cmd.endNamedArgs = this.index;
            this.discardWhitespace();
        }
        this.discardWhitespace();
        cmd.startUnnamedArgs = this.index - (/\s(\s*)$/s.exec(this.behind)?.[1]?.length ?? 0);
        cmd.endUnnamedArgs = this.index;
        if (this.testUnnamedArgument()) {
            const rawQuotesArg = cmd?.namedArgumentList?.find(a => a.name === 'raw');
            const rawQuotes = cmd?.command?.rawQuotes && rawQuotesArg ? !isFalseBoolean(rawQuotesArg?.value?.toString()) : cmd?.command?.rawQuotes;
            cmd.unnamedArgumentList = this.parseUnnamedArgument(cmd.command?.unnamedArgumentList?.length && cmd?.command?.splitUnnamedArgument, cmd?.command?.splitUnnamedArgumentCount, rawQuotes);
            cmd.endUnnamedArgs = this.index;
            if (cmd.name == 'let') {
                const keyArg = cmd.namedArgumentList.find(it=>it.name == 'key');
                if (keyArg) {
                    this.scope.variableNames.push(keyArg.value.toString());
                } else if (typeof cmd.unnamedArgumentList[0]?.value == 'string') {
                    this.scope.variableNames.push(cmd.unnamedArgumentList[0].value);
                }
            } else if (cmd.name == 'import') {
                const value = /**@type {string[]}*/(cmd.unnamedArgumentList.map(it=>it.value));
                for (let i = 0; i < value.length; i++) {
                    const srcName = value[i];
                    let dstName = srcName;
                    if (i + 2 < value.length && value[i + 1] == 'as') {
                        dstName = value[i + 2];
                        i += 2;
                    }
                    this.scope.variableNames.push(dstName);
                }
            }
        }
        if (this.testCommandEnd()) {
            cmd.end = this.index;
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
        let assignment = new SlashCommandNamedArgumentAssignment();
        assignment.start = this.index;
        let key = '';
        while (/\w/.test(this.char)) key += this.take(); // take chars
        this.take(); // discard "="
        assignment.name = key;
        if (this.testClosure()) {
            assignment.value = this.parseClosure();
        } else if (this.testQuotedValue()) {
            assignment.value = this.parseQuotedValue();
        } else if (this.testListValue()) {
            assignment.value = this.parseListValue();
        } else if (this.testValue()) {
            assignment.value = this.parseValue();
        }
        assignment.end = this.index;
        return assignment;
    }

    testUnnamedArgument() {
        return !this.testCommandEnd();
    }
    testUnnamedArgumentEnd() {
        return this.testCommandEnd();
    }
    parseUnnamedArgument(split, splitCount = null, rawQuotes = false) {
        const wasSplit = split;
        /**@type {SlashCommandClosure|String}*/
        let value = this.jumpedEscapeSequence ? this.take() : ''; // take the first, already tested, char if it is an escaped one
        let isList = split;
        let listValues = [];
        let listQuoted = []; // keep track of which listValues were quoted
        /**@type {SlashCommandUnnamedArgumentAssignment}*/
        let assignment = new SlashCommandUnnamedArgumentAssignment();
        assignment.start = this.index;
        if (!split && !rawQuotes && this.testQuotedValue()) {
            // if the next bit is a quoted value, take the whole value and gather contents as a list
            assignment.value = this.parseQuotedValue();
            assignment.end = this.index;
            isList = true;
            listValues.push(assignment);
            listQuoted.push(true);
            assignment = new SlashCommandUnnamedArgumentAssignment();
            assignment.start = this.index;
        }
        while (!this.testUnnamedArgumentEnd()) {
            if (split && splitCount && listValues.length >= splitCount) {
                // the split count has just been reached: stop splitting, the rest is one singular value
                split = false;
                if (this.testQuotedValue()) {
                    // if the next bit is a quoted value, take the whole value
                    assignment.value = this.parseQuotedValue();
                    assignment.end = this.index;
                    listValues.push(assignment);
                    listQuoted.push(true);
                    assignment = new SlashCommandUnnamedArgumentAssignment();
                    assignment.start = this.index;
                }
            }
            if (this.testClosure()) {
                isList = true;
                if (value.length > 0) {
                    this.indexMacros(this.index - value.length, value);
                    assignment.value = value;
                    listValues.push(assignment);
                    listQuoted.push(false);
                    assignment = new SlashCommandUnnamedArgumentAssignment();
                    assignment.start = this.index;
                    if (!split && this.testQuotedValue()) {
                        // if where currently not splitting and the next bit is a quoted value, take the whole value
                        assignment.value = this.parseQuotedValue();
                        assignment.end = this.index;
                        listValues.push(assignment);
                        listQuoted.push(true);
                        assignment = new SlashCommandUnnamedArgumentAssignment();
                        assignment.start = this.index;
                    } else {
                        value = '';
                    }
                }
                assignment.start = this.index;
                assignment.value = this.parseClosure();
                assignment.end = this.index;
                listValues.push(assignment);
                assignment = new SlashCommandUnnamedArgumentAssignment();
                assignment.start = this.index;
                if (split) this.discardWhitespace();
            } else if (split) {
                if (this.testQuotedValue()) {
                    assignment.start = this.index;
                    assignment.value = this.parseQuotedValue();
                    assignment.end = this.index;
                    listValues.push(assignment);
                    listQuoted.push(true);
                    assignment = new SlashCommandUnnamedArgumentAssignment();
                } else if (this.testListValue()) {
                    assignment.start = this.index;
                    assignment.value = this.parseListValue();
                    assignment.end = this.index;
                    listValues.push(assignment);
                    listQuoted.push(false);
                    assignment = new SlashCommandUnnamedArgumentAssignment();
                } else if (this.testValue()) {
                    assignment.start = this.index;
                    assignment.value = this.parseValue();
                    assignment.end = this.index;
                    listValues.push(assignment);
                    listQuoted.push(false);
                    assignment = new SlashCommandUnnamedArgumentAssignment();
                } else {
                    throw new SlashCommandParserError(`Unexpected end of unnamed argument at index ${this.userIndex}.`);
                }
                this.discardWhitespace();
            } else {
                value += this.take();
                assignment.end = this.index;
            }
        }
        if (isList && value.length > 0) {
            assignment.value = value;
            listValues.push(assignment);
            listQuoted.push(false);
        }
        if (isList) {
            const firstVal = listValues[0];
            if (typeof firstVal?.value == 'string') {
                if (!listQuoted[0]) {
                    // only trim the first part if it wasn't quoted
                    firstVal.value = firstVal.value.trimStart();
                }
                if (firstVal.value.length == 0) {
                    listValues.shift();
                    listQuoted.shift();
                }
            }
            const lastVal = listValues.slice(-1)[0];
            if (typeof lastVal?.value == 'string') {
                if (!listQuoted.slice(-1)[0]) {
                    // only trim the last part if it wasn't quoted
                    lastVal.value = lastVal.value.trimEnd();
                }
                if (lastVal.value.length == 0) {
                    listValues.pop();
                    listQuoted.pop();
                }
            }
            if (wasSplit && splitCount && splitCount + 1 < listValues.length) {
                // if split with a split count and there are more values than expected
                // -> should be result of quoting + additional (non-whitespace) text
                // -> join the parts into one and restore quotes
                const joined = new SlashCommandUnnamedArgumentAssignment();
                joined.start = listValues[splitCount].start;
                joined.end = listValues.slice(-1)[0].end;
                joined.value = '';
                for (let i = splitCount; i < listValues.length; i++) {
                    if (listQuoted[i]) joined.value += `"${listValues[i].value}"`;
                    else joined.value += listValues[i].value;
                }
                listValues = [
                    ...listValues.slice(0, splitCount),
                    joined,
                ];
            }
            return listValues;
        }
        this.indexMacros(this.index - value.length, value);
        value = value.trim();
        if (this.flags[PARSER_FLAG.REPLACE_GETVAR]) {
            value = this.replaceGetvar(value);
        }
        assignment.value = value;
        return [assignment];
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
        this.indexMacros(this.index - value.length, value);
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
        this.indexMacros(this.index - value.length, value);
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
        this.indexMacros(this.index - value.length, value);
        return value;
    }

    indexMacros(offset, text) {
        const re = /{{(?:((?:(?!}})[^\s:])+[\s:]*)((?:(?!}}).)*)(}}|}$|$))?/s;
        let remaining = text;
        let localOffset = 0;
        while (remaining.length > 0 && re.test(remaining)) {
            const match = re.exec(remaining);
            this.macroIndex.push({
                start: offset + localOffset + match.index,
                end: offset + localOffset + match.index + (match[0]?.length ?? 0),
                name: match[1] ?? '',
            });
            localOffset += match.index + (match[0]?.length ?? 0);
            remaining = remaining.slice(match.index + (match[0]?.length ?? 0));
        }
    }
}
