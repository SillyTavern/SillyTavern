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
import {
    EnhancedMacroAutoCompleteOption,
    MacroFlagAutoCompleteOption,
    MacroClosingTagAutoCompleteOption,
    VariableShorthandAutoCompleteOption,
    VariableShorthandDefinitions,
    VariableNameAutoCompleteOption,
    VariableOperatorAutoCompleteOption,
    VariableOperatorDefinitions,
    isValidVariableShorthandName,
    parseMacroContext,
    SimpleAutoCompleteOption,
} from '../autocomplete/EnhancedMacroAutoCompleteOption.js';
import { MacroFlagDefinitions, MacroFlagType } from '../macros/engine/MacroFlags.js';
import { MacroParser } from '../macros/engine/MacroParser.js';
import { MacroCstWalker } from '../macros/engine/MacroCstWalker.js';
import { SlashCommandBreakPoint } from './SlashCommandBreakPoint.js';
import { SlashCommandDebugController } from './SlashCommandDebugController.js';
import { commonEnumProviders } from './SlashCommandCommonEnumsProvider.js';
import { SlashCommandBreak } from './SlashCommandBreak.js';
import { macros as macroSystem } from '../macros/macro-system.js';
import { AutoCompleteOption } from '../autocomplete/AutoCompleteOption.js';
import { chat_metadata } from '/script.js';
import { extension_settings } from '../extensions.js';
import { onboardingExperimentalMacroEngine } from '../macros/engine/MacroDiagnostics.js';

/** @typedef {import('./SlashCommand.js').NamedArgumentsCapture} NamedArgumentsCapture */
/** @typedef {import('./SlashCommand.js').NamedArguments} NamedArguments */
/** @typedef {import('../autocomplete/EnhancedMacroAutoCompleteOption.js').MacroAutoCompleteContext} MacroAutoCompleteContext */
/** @typedef {import('../autocomplete/EnhancedMacroAutoCompleteOption.js').EnhancedMacroAutoCompleteOptions} EnhancedMacroAutoCompleteOptions */

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
                return new RegExp('(".+?(?<!\\\\)")|((?:[^\\s\\|"]|"[^"]*")*)(\\||$|\\s)');
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
                // Calculate cursor position within the macro for argument context
                const cursorInMacro = index - macro.start - 2; // -2 for {{
                const macroContent = text.slice(macro.start + 2, macro.end - (text.slice(macro.end - 2, macro.end) === '}}' ? 2 : 0));
                const context = parseMacroContext(macroContent, cursorInMacro);

                // Check if cursor is at/after the closing }} - macro syntax is complete
                const macroEndsBrackets = text.slice(macro.end - 2, macro.end) === '}}';
                const isCursorAtClosing = macroEndsBrackets && index >= macro.end - 1;

                if (isCursorAtClosing) {
                    // Cursor is at the closing }} - check if this is an unclosed scoped macro
                    const textUpToCursor = text.slice(0, index);
                    const unclosedScopes = this.#findUnclosedScopes(textUpToCursor);

                    if (unclosedScopes.length > 0) {
                        const scopedMacro = unclosedScopes[unclosedScopes.length - 1];
                        // Check if the current macro IS the unclosed scoped macro
                        if (scopedMacro.startOffset === macro.start) {
                            // Show scoped context - cursor is right at the end of the opening tag
                            const scopedContext = {
                                ...context,
                                currentArgIndex: context.args.length, // Next arg (scoped content)
                                isInScopedContent: true,
                                scopedMacroName: scopedMacro.name,
                            };

                            const macroDef = macroSystem.registry.getPrimaryMacro(scopedMacro.name);
                            if (macroDef) {
                                const scopedOption = new EnhancedMacroAutoCompleteOption(macroDef, scopedContext);
                                scopedOption.valueProvider = () => '';

                                const result = new AutoCompleteNameResult(
                                    scopedMacro.name,
                                    macro.start + 2,
                                    [scopedOption],
                                    false,
                                );
                                return result;
                            }
                        }
                    }

                    // Not a scoped macro, just clear arg highlighting
                    context.currentArgIndex = -1;
                }

                // Use the identifier from context (handles whitespace and flags)
                // Start position must be where the identifier actually begins (after whitespace/flags)
                // so that the autocomplete range calculation works correctly
                const identifier = context.identifier;
                const identifierStartInText = macro.start + 2 + context.identifierStart;

                // Use enhanced macro autocomplete when experimental engine is enabled
                // Pass full text up to cursor for unclosed scope detection
                const textUpToCursor = text.slice(0, index);

                // Special case for {{if}} condition: use the condition text for matching/replacement
                const isTypingIfCondition = context.identifier === 'if' && context.currentArgIndex === 0;
                if (isTypingIfCondition) {
                    // Get the typed condition text and calculate its start position
                    const conditionText = context.args[0] || '';
                    // Find where the condition argument starts in the macro text
                    const separatorMatch = macroContent.match(/^.*?if\s*(?:::?)\s*/);
                    const spaceMatch = macroContent.match(/^.*?if\s+/);
                    let conditionStartOffset;
                    if (separatorMatch) {
                        conditionStartOffset = separatorMatch[0].length;
                    } else if (spaceMatch) {
                        conditionStartOffset = spaceMatch[0].length;
                    } else {
                        conditionStartOffset = context.identifierStart + identifier.length;
                    }
                    let conditionStartInText = macro.start + 2 + conditionStartOffset;

                    // Build if-condition options using macroContent for padding calculation
                    const allMacros = macroSystem.registry.getAllMacros({ excludeHiddenAliases: true });
                    const options = this.#buildIfConditionOptions(context, allMacros, macroContent);

                    // For variable shorthand in {{if}} condition, adjust identifier and start position
                    // Same fix as for regular variable shorthands - identifier must be just the var name
                    // Also handle ! inversion prefix: !.var or !$var or !macroName
                    const trimmedCondition = conditionText.trim();
                    const hasInversion = trimmedCondition.startsWith('!');
                    // Trim whitespace after ! to handle "! $myvar" syntax
                    const conditionAfterInversion = hasInversion ? trimmedCondition.slice(1).trimStart() : trimmedCondition;
                    const isTypingVarShorthand = conditionAfterInversion.startsWith('.') || conditionAfterInversion.startsWith('$');
                    let resultIdentifier = conditionText;
                    let resultStart = conditionStartInText;

                    if (isTypingVarShorthand) {
                        // Identifier = just the variable name part (without prefix and without !)
                        resultIdentifier = conditionAfterInversion.slice(1);
                        // Start = after the ! (if any) and the prefix
                        const prefixChar = conditionAfterInversion[0];
                        const prefixPosInCondition = conditionText.indexOf(prefixChar, hasInversion ? 1 : 0);
                        resultStart = conditionStartInText + prefixPosInCondition + 1;
                    } else if (hasInversion && conditionAfterInversion.length === 0) {
                        // Just ! (possibly with whitespace) typed - identifier should be empty so other options can match
                        resultIdentifier = '';
                        // Start at end of actual condition text (including any whitespace after !)
                        // This ensures cursor is within the name range for filtering
                        resultStart = conditionStartInText + conditionText.length;
                    } else if (hasInversion && conditionAfterInversion.length > 0) {
                        // Typing a macro name after ! (e.g., !descr) - identifier should be just the macro name
                        resultIdentifier = conditionAfterInversion;
                        // Start = after the ! and any whitespace, at the beginning of the macro name
                        const macroNameStart = trimmedCondition.indexOf(conditionAfterInversion);
                        resultStart = conditionStartInText + macroNameStart;
                    }

                    await onboardingExperimentalMacroEngine('{{if}} macro');

                    const result = new AutoCompleteNameResult(
                        resultIdentifier,
                        resultStart,
                        options,
                        false,
                        () => isTypingVarShorthand
                            ? 'Enter a variable name for the condition'
                            : 'Use {{macro}} syntax for dynamic conditions',
                        () => isTypingVarShorthand
                            ? 'Enter a variable name or select from the list'
                            : 'Enter a macro name or {{macro}} for the condition',
                    );
                    return result;
                }

                /** @type {()=>string|undefined} */
                let makeNoMatchText = undefined;
                /** @type {()=>string|undefined} */
                let makeNoOptionsText = undefined;

                const options = this.#buildEnhancedMacroOptions(context, textUpToCursor);

                // For variable shorthands, calculate the correct identifier and start position
                // based on what the user is currently typing (variable name, operator, or value)
                let resultIdentifier = identifier;
                let resultStart = identifierStartInText;
                if (context.isVariableShorthand && context.variablePrefix) {
                    // Find where the prefix is in the macro content
                    const prefixIndex = macroContent.indexOf(context.variablePrefix);

                    if (context.isTypingVariableName) {
                        // Typing variable name: identifier = variableName, start = after prefix
                        resultIdentifier = context.variableName;
                        if (prefixIndex >= 0) {
                            resultStart = macro.start + 2 + prefixIndex + 1; // +1 to skip the prefix
                        }
                    } else if (context.isTypingOperator) {
                        // Typing operator: identifier = partial operator text (if any), start = after variable name
                        // Using partial operator as identifier ensures cursor is within name range for filtering
                        resultIdentifier = context.partialOperator || '';
                        if (prefixIndex >= 0) {
                            // Start after prefix + variable name length
                            resultStart = macro.start + 2 + prefixIndex + 1 + context.variableName.length;
                            // If no partial operator (just whitespace after var name), set start to cursor
                            // This ensures cursor is in the name range for filtering
                            if (!context.partialOperator) {
                                resultStart = index;
                            }
                        }
                    } else if (context.isOperatorComplete) {
                        // Operator complete (++ or --) - show context but no value input needed
                        resultIdentifier = '';
                        resultStart = index; // Cursor at end
                    } else if (context.hasInvalidTrailingChars) {
                        // Invalid chars after variable name: show the invalid chars for warning
                        resultIdentifier = context.invalidTrailingChars || '';
                        if (prefixIndex >= 0) {
                            resultStart = macro.start + 2 + prefixIndex + 1 + context.variableName.length;
                        }
                    } else if (context.isTypingValue) {
                        // Typing value: identifier = value being typed, start = after operator
                        resultIdentifier = context.variableValue;
                        if (prefixIndex >= 0) {
                            const operatorLen = context.variableOperator?.length ?? 0;
                            resultStart = macro.start + 2 + prefixIndex + 1 + context.variableName.length + operatorLen;
                            // Skip any whitespace between operator and value
                            while (resultStart < index && /\s/.test(text[resultStart])) {
                                resultStart++;
                            }

                            makeNoMatchText = () => `Type any value you want to ${context.variableOperator == '+=' ? `add to the variable '${context.variableName}'` : `set the variable '${context.variableName}' to`}.`;
                            makeNoOptionsText = () => 'Enter a variable value';
                        }
                    } else {
                        // Fallback: use variable name
                        resultIdentifier = context.variableName;
                        if (prefixIndex >= 0) {
                            resultStart = macro.start + 2 + prefixIndex + 1;
                        }
                    }

                    if (!makeNoMatchText && !makeNoOptionsText) {
                        makeNoMatchText = () => 'Invalid syntax or variable name (must be alphanumeric, not ending in hyphen or underscore). Use a valid macro name or syntax.';
                        makeNoOptionsText = () => 'Enter a variable name to create or use a new variable';
                    }
                }

                const result = new AutoCompleteNameResult(
                    resultIdentifier,
                    resultStart,
                    options,
                    false,
                    makeNoMatchText,
                    makeNoOptionsText,
                );
                return result;
            }

            // Check if cursor is in scoped content of an unclosed macro
            const textUpToCursor = text.slice(0, index);
            const unclosedScopes = this.#findUnclosedScopes(textUpToCursor);
            if (unclosedScopes.length > 0) {
                const scopedMacro = unclosedScopes[unclosedScopes.length - 1];
                // Find the original macro in macroIndex to get full info
                const originalMacro = this.macroIndex.find(it => it.start === scopedMacro.startOffset);
                if (originalMacro) {
                    // Parse the original macro content to get base context
                    const macroContent = text.slice(originalMacro.start + 2, originalMacro.end - 2);
                    const baseContext = parseMacroContext(macroContent, macroContent.length);

                    // Create a scoped context - show next arg as current (the scoped content)
                    const scopedContext = {
                        ...baseContext,
                        currentArgIndex: baseContext.args.length, // Next arg index (the scoped one)
                        isInScopedContent: true,
                        scopedMacroName: scopedMacro.name,
                    };

                    await onboardingExperimentalMacroEngine('scoped macros');

                    // Only show the scoped macro's details - no list of other macros
                    // This creates a "details only" view showing the scoped arg being typed
                    const macroDef = macroSystem.registry.getPrimaryMacro(scopedMacro.name);
                    if (macroDef) {
                        const scopedOption = new EnhancedMacroAutoCompleteOption(macroDef, scopedContext);
                        // Mark as non-insertable - we're just showing details
                        scopedOption.valueProvider = () => '';

                        const result = new AutoCompleteNameResult(
                            scopedMacro.name, // Use macro name so it shows as "match"
                            originalMacro.start + 2, // Point to original macro
                            [scopedOption],
                            false,
                        );
                        return result;
                    }
                }
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
     * Builds enhanced macro autocomplete options from the MacroRegistry.
     * When in the flags area (before identifier), includes flag options.
     * When typing arguments (after ::), prioritizes the exact macro match.
     * @param {import('../autocomplete/EnhancedMacroAutoCompleteOption.js').MacroAutoCompleteContext} context
     * @param {string} [textUpToCursor] - Full document text up to cursor, for unclosed scope detection.
     * @returns {(EnhancedMacroAutoCompleteOption|MacroFlagAutoCompleteOption|MacroClosingTagAutoCompleteOption|VariableShorthandAutoCompleteOption|VariableNameAutoCompleteOption|VariableOperatorAutoCompleteOption)[]}
     */
    #buildEnhancedMacroOptions(context, textUpToCursor = '') {
        /** @type {(EnhancedMacroAutoCompleteOption|MacroFlagAutoCompleteOption|MacroClosingTagAutoCompleteOption|VariableShorthandAutoCompleteOption|VariableNameAutoCompleteOption|VariableOperatorAutoCompleteOption)[]} */
        const options = [];

        // Handle variable shorthand mode
        if (context.isVariableShorthand) {
            return this.#buildVariableShorthandOptions(context);
        }

        // Check for unclosed scoped macros and suggest closing tags first
        const unclosedScopes = this.#findUnclosedScopes(textUpToCursor);
        if (unclosedScopes.length > 0) {
            // Suggest closing the innermost (last) unclosed scope first
            const innermostScope = unclosedScopes[unclosedScopes.length - 1];
            // Preserve whitespace padding from the opening tag
            // Pass currentPadding so the closing tag can replace user-typed whitespace with the target padding
            const closingOption = new MacroClosingTagAutoCompleteOption(innermostScope.name, {
                paddingBefore: innermostScope.paddingBefore,
                paddingAfter: innermostScope.paddingAfter,
                currentPadding: context.paddingBefore,
            });
            options.push(closingOption);

            // If inside a scoped {{if}}, also suggest {{else}}
            if (innermostScope.name === 'if') {
                const macroDef = macroSystem.registry.getPrimaryMacro('else');
                const elseOption = new EnhancedMacroAutoCompleteOption(macroDef);
                elseOption.sortPriority = 2;
                options.push(elseOption);
            }
        }

        // If cursor is in the flags area (before identifier starts), include flag options
        if (context.isInFlagsArea) {
            // Build flag options with priority-based sorting
            // Last typed flag has highest priority (1), other flags have lower priority (10)
            // Already-typed flags (except last) are hidden from the list
            const lastTypedFlag = context.flags.length > 0 ? context.flags[context.flags.length - 1] : null;

            // Add last typed flag with high priority (so it appears at top)
            if (lastTypedFlag) {
                const lastFlagDef = MacroFlagDefinitions.get(lastTypedFlag);
                if (lastFlagDef) {
                    const lastFlagOption = new MacroFlagAutoCompleteOption(lastFlagDef);
                    // Mark as already typed - valueProvider returns empty so it doesn't re-insert
                    lastFlagOption.valueProvider = () => '';
                    // High priority to appear at top (after closing tags at 1)
                    lastFlagOption.sortPriority = 2;
                    options.push(lastFlagOption);
                }
            }

            // Add flags that haven't been typed yet (skip already-typed ones except last)
            for (const [symbol, flagDef] of MacroFlagDefinitions) {
                // Skip the last typed flag (already added above) and other already-typed flags
                if (context.flags.includes(symbol)) {
                    continue;
                }
                const flagOption = new MacroFlagAutoCompleteOption(flagDef);

                // Define whether this flag is selectable (and at the top), based on being implemented, and closing actually being relevant
                let isSelectable = flagDef.implemented;
                if (flagDef.type === MacroFlagType.CLOSING_BLOCK && !unclosedScopes.length) isSelectable = false;
                if (!isSelectable) {
                    flagOption.valueProvider = () => '';
                }
                // Normal flag priority
                flagOption.sortPriority = isSelectable ? 10 : 12;
                options.push(flagOption);
            }

            // Add variable shorthand prefix options (. for local, $ for global)
            // These allow users to type variable shorthands instead of macro names
            for (const [, varShorthandDef] of VariableShorthandDefinitions) {
                const varOption = new VariableShorthandAutoCompleteOption(varShorthandDef);
                varOption.sortPriority = 8; // Between implemented flags (10) and unimplemented (12)
                options.push(varOption);
            }
        }

        // Get all macros from the registry (excluding hidden aliases)
        const allMacros = macroSystem.registry.getAllMacros({ excludeHiddenAliases: true });

        // If we're typing arguments (after ::), only show the context to the matching macro
        const isTypingArgs = context.currentArgIndex >= 0;

        // Check if we're inside a scoped {{if}} for {{else}} selectability
        const isInsideScopedIf = unclosedScopes.some(scope => scope.name === 'if');

        for (const macro of allMacros) {
            // Check if this macro matches the typed identifier
            const isExactMatch = macro.name === context.identifier;
            const isAliasMatch = macro.aliasOf === context.identifier;

            // Only pass context to the macro that matches the identifier being typed
            // This ensures argument hints only show for the relevant macro
            /** @type {MacroAutoCompleteContext|EnhancedMacroAutoCompleteOptions|null} */
            let macroContext = (isExactMatch || isAliasMatch) ? context : null;

            // If no context, we pass some options for additional details though
            if (!macroContext) {
                macroContext = /** @type {EnhancedMacroAutoCompleteOptions} */ ({
                    paddingAfter: context.paddingBefore, // Match whitespace before the macro - will only be used if the macro gets auto-closed
                    flags: context.flags,
                    currentFlag: context.currentFlag,
                    fullText: context.fullText,
                });
            }

            const option = new EnhancedMacroAutoCompleteOption(macro, macroContext);

            // {{else}} is only selectable inside a scoped {{if}} block
            // Outside of {{if}}, it should appear in the list but not be tab-completable
            if (macro.name === 'else' && !isInsideScopedIf) {
                option.valueProvider = () => '';
                option.makeSelectable = false;
            }

            // When typing arguments, prioritize exact matches by putting them first
            if (isTypingArgs && (isExactMatch || isAliasMatch)) {
                options.unshift(option);
            } else {
                options.push(option);
            }
        }

        return options;
    }

    /**
     * Builds autocomplete options for variable shorthand syntax (.varName or $varName).
     * @param {import('../autocomplete/EnhancedMacroAutoCompleteOption.js').MacroAutoCompleteContext} context
     * @param {Object} [opts] - Optional configuration.
     * @param {boolean} [opts.forIfCondition=false] - If true, options are for {{if}} condition (closes with }}).
     * @param {string} [opts.paddingAfter=''] - Whitespace to add before closing }}.
     * @returns {(EnhancedMacroAutoCompleteOption|MacroFlagAutoCompleteOption|MacroClosingTagAutoCompleteOption|VariableShorthandAutoCompleteOption|VariableNameAutoCompleteOption|VariableOperatorAutoCompleteOption)[]}
     */
    #buildVariableShorthandOptions(context, opts = {}) {
        const { forIfCondition = false, paddingAfter = '' } = opts;
        /** @type {(VariableShorthandAutoCompleteOption|VariableNameAutoCompleteOption|VariableOperatorAutoCompleteOption)[]} */
        const options = [];

        const isLocal = context.variablePrefix === '.';
        const scope = isLocal ? 'local' : 'global';

        // Always show the typed variable prefix as a non-completable option (like flags do)
        // This allows the details panel to show information about the prefix
        const prefixDef = VariableShorthandDefinitions.get(context.variablePrefix);
        if (prefixDef) {
            const prefixOption = new VariableShorthandAutoCompleteOption(prefixDef);
            prefixOption.valueProvider = () => ''; // Already typed, don't re-insert
            prefixOption.makeSelectable = false;
            prefixOption.sortPriority = 1; // Show at top
            options.push(prefixOption);
        }

        // If typing the variable name, suggest existing variables
        if (context.isTypingVariableName) {
            // Get existing variable names from the appropriate scope
            // Filter to only include names that are valid for shorthand syntax
            const existingVariables = this.#getVariableNames(scope)
                .filter(name => isValidVariableShorthandName(name));

            // Add existing variables that match the typed name
            for (const varName of existingVariables) {
                const option = new VariableNameAutoCompleteOption(varName, scope, false);
                // For {{if}} condition, provide full value with closing braces
                if (forIfCondition) {
                    option.valueProvider = () => `${varName}${paddingAfter}}}`; // No variable prefix, as that has been written and committed already.
                    option.makeSelectable = true;
                }
                // Variables matching the typed prefix get higher priority
                if (varName.startsWith(context.variableName)) {
                    option.sortPriority = 3;
                } else {
                    option.sortPriority = 10;
                }
                options.push(option);
            }

            // If typing a name that doesn't exist, offer to create a new variable
            // But if the name is invalid for shorthand syntax, show a warning instead
            if (context.variableName.length > 0 && !existingVariables.includes(context.variableName)) {
                const isInvalid = !isValidVariableShorthandName(context.variableName);
                const newVarOption = new VariableNameAutoCompleteOption(context.variableName, scope, true, isInvalid);
                newVarOption.sortPriority = isInvalid ? 2 : 4; // Invalid names get higher priority to show warning
                if (isInvalid) {
                    // Make it non-selectable since it can't be used
                    newVarOption.valueProvider = () => '';
                    newVarOption.makeSelectable = false;
                } else if (forIfCondition) {
                    // For {{if}} condition, provide full value with closing braces
                    newVarOption.valueProvider = () => `${context.variablePrefix}${context.variableName}${paddingAfter}}}`;
                }
                options.push(newVarOption);
            }
        }

        // If there are invalid trailing characters after the variable name, show a warning
        if (context.hasInvalidTrailingChars) {
            // Show the full invalid name (variableName + invalidTrailingChars) with a warning
            const fullInvalidName = context.variableName + (context.invalidTrailingChars || '');
            const invalidOption = new VariableNameAutoCompleteOption(
                fullInvalidName,
                scope,
                false,
                true, // isInvalidName - triggers warning display
            );
            invalidOption.valueProvider = () => ''; // Don't insert anything
            invalidOption.makeSelectable = false;
            invalidOption.sortPriority = 2;
            invalidOption.matchProvider = () => true; // Always show
            options.push(invalidOption);
            // Return early - don't show operators when syntax is invalid
            return options;
        }

        // If ready for operator (after variable name), suggest operators
        if (context.isTypingOperator) {
            // Show the current variable name as context (already typed)
            const varNameOption = new VariableNameAutoCompleteOption(context.variableName, scope, false);
            varNameOption.valueProvider = () => ''; // Already typed, don't re-insert
            varNameOption.sortPriority = 2;
            varNameOption.matchProvider = () => true; // Always show
            options.push(varNameOption);

            // Then show available operators, filtered by partial prefix if any
            const partialOp = context.partialOperator || '';
            for (const [, operatorDef] of VariableOperatorDefinitions) {
                // Filter by partial operator prefix if user is typing one
                if (partialOp && !operatorDef.symbol.startsWith(partialOp)) {
                    continue;
                }
                const opOption = new VariableOperatorAutoCompleteOption(operatorDef);
                opOption.sortPriority = 5;
                // Always match operators when showing operator suggestions
                opOption.matchProvider = () => true;
                options.push(opOption);
            }
        }

        // If typing value (after = or +=), no autocomplete needed - freeform text
        // But we can show the current context for reference
        if (context.isTypingValue) {
            // Show the current variable name as context
            const varNameOption = new VariableNameAutoCompleteOption(context.variableName, scope, false);
            varNameOption.valueProvider = () => ''; // Context only
            varNameOption.sortPriority = 2;
            varNameOption.matchProvider = () => true; // Always show
            options.push(varNameOption);

            // Show the operator that was used
            if (context.variableOperator) {
                const opDef = VariableOperatorDefinitions.get(context.variableOperator);
                if (opDef) {
                    const opOption = new VariableOperatorAutoCompleteOption(opDef);
                    opOption.valueProvider = () => ''; // Already typed
                    opOption.sortPriority = 3;
                    opOption.matchProvider = () => true; // Always show
                    options.push(opOption);
                }
            }
        }

        // If operator is complete (++ or --), show context without value input
        if (context.isOperatorComplete) {
            // Show the current variable name as context
            const varNameOption = new VariableNameAutoCompleteOption(context.variableName, scope, false);
            varNameOption.valueProvider = () => ''; // Context only
            varNameOption.sortPriority = 2;
            varNameOption.matchProvider = () => true; // Always show
            options.push(varNameOption);

            // Show the operator that was used
            if (context.variableOperator) {
                const opDef = VariableOperatorDefinitions.get(context.variableOperator);
                if (opDef) {
                    const opOption = new VariableOperatorAutoCompleteOption(opDef);
                    opOption.valueProvider = () => ''; // Already typed
                    opOption.sortPriority = 3;
                    opOption.matchProvider = () => true; // Always show
                    options.push(opOption);
                }
            }
        }

        return options;
    }

    /**
     * Gets variable names from the specified scope.
     * @param {'local'|'global'} scope - The variable scope.
     * @returns {string[]} Array of variable names.
     */
    #getVariableNames(scope) {
        try {
            // Import chat_metadata and extension_settings dynamically to avoid circular deps
            // These are the same sources used by commonEnumProviders.variables
            if (scope === 'local') {
                // Local variables are in chat_metadata.variables
                return Object.keys(chat_metadata?.variables ?? {});
            } else {
                // Global variables are in extension_settings.variables.global
                return Object.keys(extension_settings?.variables?.global ?? {});
            }
        } catch {
            return [];
        }
    }

    /**
     * Builds autocomplete options for {{if}} condition - shows zero-arg macros as shorthand.
     * @param {import('../autocomplete/EnhancedMacroAutoCompleteOption.js').MacroAutoCompleteContext} context
     * @param {import('../macros/engine/MacroRegistry.js').MacroDefinition[]} allMacros
     * @param {string} macroInnerText - The text inside the macro braces (e.g., "  if  pers" from "{{  if  pers").
     * @returns {AutoCompleteOption[]}
     */
    #buildIfConditionOptions(context, allMacros, macroInnerText) {
        /** @type {AutoCompleteOption[]} */
        const options = [];

        // Calculate padding from the original macro text for matching whitespace on completion
        // e.g., "  if pers" -> leading padding = "  " (whitespace before 'if', used before '}}')
        const leadingMatch = macroInnerText.match(/^(\s*)/);
        const paddingAfter = leadingMatch ? leadingMatch[1] : '';

        // Get the condition text being typed (trimmed for detection)
        const conditionText = (context.args[0] || '').trim();

        // Check for inversion prefix (!) - also trim whitespace after !
        const hasInversionPrefix = conditionText.startsWith('!');
        const conditionAfterInversion = hasInversionPrefix ? conditionText.slice(1).trimStart() : conditionText;

        const inversionOption = new SimpleAutoCompleteOption({
            name: '!',
            symbol: '🔁',
            description: 'Invert condition (NOT)',
            detailedDescription: 'Inverts the condition result. If the condition is truthy, it becomes falsy, and vice versa.<br><br>Example: <code>{{if !myVar}}</code> executes when <code>myVar</code> is empty or zero.',
            type: 'inverse',
        });

        // Check if condition starts with a variable shorthand prefix (with or without !)
        const isTypingVariableShorthand = conditionAfterInversion.startsWith('.') || conditionAfterInversion.startsWith('$');

        if (isTypingVariableShorthand) {
            // User is typing a variable shorthand - reuse #buildVariableShorthandOptions
            const prefix = /** @type {'.'|'$'} */ (conditionAfterInversion[0]);
            const varNameTyped = conditionAfterInversion.slice(1); // Variable name after the prefix

            // If inverted, show the ! as non-selectable context
            if (hasInversionPrefix) {
                inversionOption.valueProvider = () => ''; // Already typed
                inversionOption.makeSelectable = false;
                inversionOption.sortPriority = 0;
                options.push(inversionOption);
            }

            // Create a synthetic context for #buildVariableShorthandOptions
            /** @type {import('../autocomplete/EnhancedMacroAutoCompleteOption.js').MacroAutoCompleteContext} */
            const varContext = {
                ...context,
                isVariableShorthand: true,
                variablePrefix: prefix,
                variableName: varNameTyped,
                isTypingVariableName: true,
                isTypingOperator: false,
                isTypingValue: false,
                isOperatorComplete: false,
                hasInvalidTrailingChars: false,
                variableOperator: null,
                variableValue: '',
            };

            const varOptions = this.#buildVariableShorthandOptions(varContext, { forIfCondition: true, paddingAfter });
            options.push(...varOptions);
            return options;
        }

        // Not typing a variable shorthand - show macro options, variable shorthand prefixes, and inversion

        // Show ! inversion option at the top when nothing typed, or keep it visible (non-selectable) if already typed
        if (conditionText.length === 0) {
            // Nothing typed - offer ! as selectable option
            inversionOption.valueProvider = () => '!';
            inversionOption.makeSelectable = true;
            inversionOption.sortPriority = -1; // Show at very top
            options.push(inversionOption);
        } else if (hasInversionPrefix && conditionAfterInversion.length === 0) {
            // Just ! typed - show it as non-selectable context, then show macro names and variable prefixes
            inversionOption.valueProvider = () => ''; // Already typed
            inversionOption.makeSelectable = false;
            inversionOption.sortPriority = -1;
            options.push(inversionOption);
        }

        // Add variable shorthand prefix options when no content typed yet (or just ! typed)
        if (conditionAfterInversion.length === 0) {
            for (const [, prefixDef] of VariableShorthandDefinitions) {
                const prefixOption = new VariableShorthandAutoCompleteOption(prefixDef);
                // Complete with just the prefix symbol
                prefixOption.valueProvider = () => prefixDef.type;
                prefixOption.makeSelectable = true;
                prefixOption.sortPriority = 0; // Show at top
                options.push(prefixOption);
            }
        }

        // Add zero-arg macros as condition shorthand options
        for (const macro of allMacros) {
            // Only include macros that require zero arguments (can be auto-resolved)
            if (macro.minArgs !== 0) continue;

            // Skip internal/utility macros that don't make sense as conditions
            if (['else', 'noop', 'trim', '//'].includes(macro.name)) continue;

            const option = new EnhancedMacroAutoCompleteOption(macro, {
                noBraces: true,
                paddingAfter,
                closeWithBraces: true,
            });
            options.push(option);
        }

        return options;
    }

    /**
     * Finds unclosed scoped macros in the text up to cursor position.
     * Uses the MacroParser and MacroCstWalker for accurate analysis.
     *
     * @param {string} textUpToCursor - The document text up to the cursor position.
     * @returns {Array<{ name: string, startOffset: number, endOffset: number, paddingBefore: string, paddingAfter: string }>}
     */
    #findUnclosedScopes(textUpToCursor) {
        if (!textUpToCursor) return [];

        try {
            // Parse the document to get the CST
            const { cst } = MacroParser.parseDocument(textUpToCursor);
            if (!cst) return [];

            // Use the CST walker to find unclosed scopes
            return MacroCstWalker.findUnclosedScopes({ text: textUpToCursor, cst });
        } catch {
            // If parsing fails (incomplete input), fall back to simple regex approach
            return this.#findUnclosedScopesRegex(textUpToCursor);
        }
    }

    /**
     * Fallback regex-based approach for finding unclosed scopes.
     * Used when the parser fails on incomplete input.
     *
     * @param {string} text - The text to analyze.
     * @returns {Array<{ name: string, startOffset: number, endOffset: number, paddingBefore: string, paddingAfter: string }>}
     */
    #findUnclosedScopesRegex(text) {
        // Regex to find macro openings and closings, capturing whitespace padding
        // Group 1: padding after {{, Group 2: optional /, Group 3: macro name
        const macroPattern = /\{\{(\s*)(\/?)([\w-]+)/g;
        const stack = [];

        let match;
        while ((match = macroPattern.exec(text)) !== null) {
            const paddingBefore = match[1];
            const isClosing = match[2] === '/';
            const name = match[3];

            if (isClosing) {
                // Pop matching opener (case-insensitive)
                if (stack.length > 0 && stack[stack.length - 1].name.toLowerCase() === name.toLowerCase()) {
                    stack.pop();
                }
            } else {
                // Check if macro can accept scoped content
                const macroDef = macroSystem.registry.getPrimaryMacro(name);
                if (macroDef && macroDef.maxArgs > 0) {
                    // Try to find closing }} to extract trailing whitespace
                    let paddingAfter = '';
                    const afterMatch = text.slice(match.index + match[0].length);
                    const closingMatch = afterMatch.match(/^[^}]*?(\s*)\}\}/);
                    if (closingMatch) {
                        paddingAfter = closingMatch[1];
                    }

                    stack.push({
                        name,
                        startOffset: match.index,
                        endOffset: match.index + match[0].length,
                        paddingBefore,
                        paddingAfter,
                    });
                }
            }
        }

        return stack;
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
        // Not needed with the new parser.
        if (power_user.experimental_macro_engine) {
            return value;
        }
        return value.replace(/{{(get(?:global)?var)::([^}]+)}}/gi, (match, cmd, name, idx) => {
            name = name.trim();
            cmd = cmd.toLowerCase();
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
        if (this.testClosureEnd()) return true;
        // Only treat | as command end if we're not inside macro braces {{}}
        if (this.testSymbol('|') && !this.isInsideMacroBraces()) return true;
        return false;
    }

    /**
     * Checks if the current position is inside unclosed macro braces {{...}}.
     * This prevents pipes inside macros from being treated as command separators.
     * @returns {boolean} True if inside unclosed macro braces.
     */
    isInsideMacroBraces() {
        const textBehind = this.behind;
        let depth = 0;

        // Scan through the text to track macro brace depth
        for (let i = 0; i < textBehind.length; i++) {
            if (textBehind[i] === '{' && textBehind[i + 1] === '{') {
                depth++;
                i++; // Skip the second {
            } else if (textBehind[i] === '}' && textBehind[i + 1] === '}') {
                depth = Math.max(0, depth - 1);
                i++; // Skip the second }
            }
        }

        return depth > 0;
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
        // Index all macros including nested ones
        // We need to track brace depth to properly handle nested macros like {{reverse::Hey {{user}}}}
        let i = 0;
        while (i < text.length - 1) {
            // Look for macro start {{
            if (text[i] === '{' && text[i + 1] === '{') {
                const macroStart = i;
                i += 2; // Skip {{

                // Find where this macro ends, tracking nested braces
                let depth = 1;
                let macroEnd = text.length; // Default to end if unclosed

                while (i < text.length - 1 && depth > 0) {
                    if (text[i] === '{' && text[i + 1] === '{') {
                        // Nested macro start - recursively index it
                        // The nested macro will be indexed in subsequent iterations
                        depth++;
                        i += 2;
                    } else if (text[i] === '}' && text[i + 1] === '}') {
                        depth--;
                        if (depth === 0) {
                            macroEnd = i + 2; // Include the closing }}
                        }
                        i += 2;
                    } else {
                        i++;
                    }
                }

                // Extract macro content (between {{ and }} or end)
                const contentEnd = macroEnd === text.length ? macroEnd : macroEnd - 2;
                const macroContent = text.slice(macroStart + 2, contentEnd);

                // Use parseMacroContext to extract the identifier
                const context = parseMacroContext(macroContent, macroContent.length);

                this.macroIndex.push({
                    start: offset + macroStart,
                    end: offset + macroEnd,
                    name: context.identifier,
                });

                // Continue from where we left off (don't skip ahead)
                // This ensures nested macros get their own index entries
                i = macroStart + 2; // Move past the opening {{ to look for nested macros
                // Skip to find nested {{ inside this macro's content
                while (i < contentEnd) {
                    if (text[i] === '{' && i + 1 < text.length && text[i + 1] === '{') {
                        break; // Found nested macro, outer loop will handle it
                    }
                    i++;
                }
                if (i >= contentEnd) {
                    // No nested macro found, skip to end of this macro
                    i = macroEnd;
                }
            } else {
                i++;
            }
        }
    }
}
