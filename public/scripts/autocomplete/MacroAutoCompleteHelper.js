/**
 * Shared utilities for macro autocomplete functionality.
 * Used by both SlashCommandParser (for slash command context) and MacroAutoComplete (for free text).
 *
 * This module extracts common macro autocomplete logic to avoid duplication and ensure
 * consistent behavior across all contexts where macro autocomplete is used.
 */

import { AutoCompleteNameResult } from './AutoCompleteNameResult.js';
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
} from './EnhancedMacroAutoCompleteOption.js';
import { macros as macroSystem } from '../macros/macro-system.js';
import { MacroFlagDefinitions, MacroFlagType } from '../macros/engine/MacroFlags.js';
import { MacroParser } from '../macros/engine/MacroParser.js';
import { MacroCstWalker } from '../macros/engine/MacroCstWalker.js';
import { onboardingExperimentalMacroEngine } from '../macros/engine/MacroDiagnostics.js';
import { chat_metadata } from '/script.js';
import { extension_settings } from '../extensions.js';

/** @typedef {import('./EnhancedMacroAutoCompleteOption.js').MacroAutoCompleteContext} MacroAutoCompleteContext */
/** @typedef {import('./EnhancedMacroAutoCompleteOption.js').EnhancedMacroAutoCompleteOptions} EnhancedMacroAutoCompleteOptions */
/** @typedef {import('./AutoCompleteOption.js').AutoCompleteOption} AutoCompleteOption */

/**
 * @typedef {Object} MacroInfo
 * @property {number} start - Start position of the macro in text (at first {)
 * @property {number} end - End position of the macro in text (after last })
 * @property {string} content - The content between {{ and }}
 */

/**
 * @typedef {Object} UnclosedScope
 * @property {string} name - Macro name
 * @property {number} startOffset - Start position in text
 * @property {number} endOffset - End position of opening tag
 * @property {string} paddingBefore - Whitespace before macro name
 * @property {string} paddingAfter - Whitespace after macro content
 */

/**
 * @typedef {Object} BuildMacroAutoCompleteOptions
 * @property {MacroInfo|null} [macro=null] - Macro info if cursor is inside a macro
 * @property {string|null} [textUpToCursor=null] - Pre-computed text up to cursor
 * @property {UnclosedScope[]|null} [unclosedScopes=null] - Pre-computed unclosed scopes
 */

/**
 * Finds unclosed scoped macros in text using the macro parser.
 *
 * @param {string} textUpToCursor - Text from start to cursor position.
 * @returns {Array<{ name: string, startOffset: number, endOffset: number, paddingBefore: string, paddingAfter: string }>}
 */
export function findUnclosedScopes(textUpToCursor) {
    if (!textUpToCursor) return [];

    try {
        const { cst } = MacroParser.parseDocument(textUpToCursor);
        if (!cst) return [];
        return MacroCstWalker.findUnclosedScopes({ text: textUpToCursor, cst });
    } catch {
        return findUnclosedScopesRegex(textUpToCursor);
    }
}

/**
 * Fallback regex-based approach for finding unclosed scopes.
 *
 * @param {string} text - The text to analyze.
 * @returns {Array<{ name: string, startOffset: number, endOffset: number, paddingBefore: string, paddingAfter: string }>}
 */
export function findUnclosedScopesRegex(text) {
    const macroPattern = /\{\{(\s*)(\/?)([\w-]+)/g;
    const stack = [];

    let match;
    while ((match = macroPattern.exec(text)) !== null) {
        const paddingBefore = match[1];
        const isClosing = match[2] === '/';
        const name = match[3];

        if (isClosing) {
            if (stack.length > 0 && stack[stack.length - 1].name.toLowerCase() === name.toLowerCase()) {
                stack.pop();
            }
        } else {
            const macroDef = macroSystem.registry.getPrimaryMacro(name);
            if (macroDef && macroDef.maxArgs > 0) {
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
 * Builds variable shorthand autocomplete options.
 *
 * @param {MacroAutoCompleteContext} context - The macro context.
 * @param {Object} [opts] - Options.
 * @param {boolean} [opts.forIfCondition=false] - If true, closes with }}.
 * @param {string} [opts.paddingAfter=''] - Whitespace before }}.
 * @returns {AutoCompleteOption[]}
 */
export function buildVariableShorthandOptions(context, opts = {}) {
    const { forIfCondition = false, paddingAfter = '' } = opts;
    /** @type {AutoCompleteOption[]} */
    const options = [];

    const isLocal = context.variablePrefix === '.';
    const scope = isLocal ? 'local' : 'global';

    const prefixDef = VariableShorthandDefinitions.get(context.variablePrefix);
    if (prefixDef) {
        const prefixOption = new VariableShorthandAutoCompleteOption(prefixDef);
        prefixOption.valueProvider = () => '';
        prefixOption.makeSelectable = false;
        prefixOption.sortPriority = 1;
        options.push(prefixOption);
    }

    if (context.isTypingVariableName) {
        const existingVariables = getVariableNames(scope)
            .filter(name => isValidVariableShorthandName(name));

        for (const varName of existingVariables) {
            const option = new VariableNameAutoCompleteOption(varName, scope, false);
            if (forIfCondition) {
                option.valueProvider = () => `${varName}${paddingAfter}}}`;
                option.makeSelectable = true;
            }
            option.sortPriority = varName.startsWith(context.variableName) ? 3 : 10;
            options.push(option);
        }

        if (context.variableName.length > 0 && !existingVariables.includes(context.variableName)) {
            const isInvalid = !isValidVariableShorthandName(context.variableName);
            const newVarOption = new VariableNameAutoCompleteOption(context.variableName, scope, true, isInvalid);
            newVarOption.sortPriority = isInvalid ? 2 : 4;
            if (isInvalid) {
                newVarOption.valueProvider = () => '';
                newVarOption.makeSelectable = false;
            } else if (forIfCondition) {
                newVarOption.valueProvider = () => `${context.variablePrefix}${context.variableName}${paddingAfter}}}`;
            }
            options.push(newVarOption);
        }
    }

    if (context.hasInvalidTrailingChars) {
        const fullInvalidName = context.variableName + (context.invalidTrailingChars || '');
        const invalidOption = new VariableNameAutoCompleteOption(fullInvalidName, scope, false, true);
        invalidOption.valueProvider = () => '';
        invalidOption.makeSelectable = false;
        invalidOption.sortPriority = 2;
        invalidOption.matchProvider = () => true;
        options.push(invalidOption);
        return options;
    }

    if (context.isTypingOperator) {
        const varNameOption = new VariableNameAutoCompleteOption(context.variableName, scope, false);
        varNameOption.valueProvider = () => '';
        varNameOption.sortPriority = 2;
        varNameOption.matchProvider = () => true;
        options.push(varNameOption);

        const partialOp = context.partialOperator || '';
        for (const [, operatorDef] of VariableOperatorDefinitions) {
            if (partialOp && !operatorDef.symbol.startsWith(partialOp)) continue;
            const opOption = new VariableOperatorAutoCompleteOption(operatorDef);
            opOption.sortPriority = 5;
            opOption.matchProvider = () => true;
            options.push(opOption);
        }
    }

    if (context.isTypingValue) {
        const varNameOption = new VariableNameAutoCompleteOption(context.variableName, scope, false);
        varNameOption.valueProvider = () => '';
        varNameOption.sortPriority = 2;
        varNameOption.matchProvider = () => true;
        options.push(varNameOption);

        if (context.variableOperator) {
            const opDef = VariableOperatorDefinitions.get(context.variableOperator);
            if (opDef) {
                const opOption = new VariableOperatorAutoCompleteOption(opDef);
                opOption.valueProvider = () => '';
                opOption.sortPriority = 3;
                opOption.matchProvider = () => true;
                options.push(opOption);
            }
        }
    }

    if (context.isOperatorComplete) {
        const varNameOption = new VariableNameAutoCompleteOption(context.variableName, scope, false);
        varNameOption.valueProvider = () => '';
        varNameOption.sortPriority = 2;
        varNameOption.matchProvider = () => true;
        options.push(varNameOption);

        if (context.variableOperator) {
            const opDef = VariableOperatorDefinitions.get(context.variableOperator);
            if (opDef) {
                const opOption = new VariableOperatorAutoCompleteOption(opDef);
                opOption.valueProvider = () => '';
                opOption.sortPriority = 3;
                opOption.matchProvider = () => true;
                options.push(opOption);
            }
        }
    }

    return options;
}

/**
 * Builds enhanced macro autocomplete options.
 *
 * @param {MacroAutoCompleteContext} context - The parsed macro context.
 * @param {string} textUpToCursor - Full text up to cursor for scope detection.
 * @returns {AutoCompleteOption[]}
 */
export function buildEnhancedMacroOptions(context, textUpToCursor) {
    /** @type {AutoCompleteOption[]} */
    const options = [];

    if (context.isVariableShorthand) {
        return buildVariableShorthandOptions(context);
    }

    const unclosedScopes = findUnclosedScopes(textUpToCursor);
    if (unclosedScopes.length > 0) {
        const innermostScope = unclosedScopes[unclosedScopes.length - 1];
        const closingOption = new MacroClosingTagAutoCompleteOption(innermostScope.name, {
            paddingBefore: innermostScope.paddingBefore,
            paddingAfter: innermostScope.paddingAfter,
            currentPadding: context.paddingBefore,
        });
        options.push(closingOption);

        if (innermostScope.name === 'if') {
            const macroDef = macroSystem.registry.getPrimaryMacro('else');
            if (macroDef) {
                const elseOption = new EnhancedMacroAutoCompleteOption(macroDef);
                elseOption.sortPriority = 2;
                options.push(elseOption);
            }
        }
    }

    if (context.isInFlagsArea) {
        const lastTypedFlag = context.flags.length > 0 ? context.flags[context.flags.length - 1] : null;

        if (lastTypedFlag) {
            const lastFlagDef = MacroFlagDefinitions.get(lastTypedFlag);
            if (lastFlagDef) {
                const lastFlagOption = new MacroFlagAutoCompleteOption(lastFlagDef);
                lastFlagOption.valueProvider = () => '';
                lastFlagOption.sortPriority = 2;
                options.push(lastFlagOption);
            }
        }

        for (const [symbol, flagDef] of MacroFlagDefinitions) {
            if (context.flags.includes(symbol)) continue;
            const flagOption = new MacroFlagAutoCompleteOption(flagDef);
            let isSelectable = flagDef.implemented;
            if (flagDef.type === MacroFlagType.CLOSING_BLOCK && !unclosedScopes.length) {
                isSelectable = false;
            }
            if (!isSelectable) {
                flagOption.valueProvider = () => '';
            }
            flagOption.sortPriority = isSelectable ? 10 : 12;
            options.push(flagOption);
        }

        for (const [, varShorthandDef] of VariableShorthandDefinitions) {
            const varOption = new VariableShorthandAutoCompleteOption(varShorthandDef);
            varOption.sortPriority = 8;
            options.push(varOption);
        }
    }

    const allMacros = macroSystem.registry.getAllMacros({ excludeHiddenAliases: true });
    const isTypingArgs = context.currentArgIndex >= 0;
    const isInsideScopedIf = unclosedScopes.some(scope => scope.name === 'if');

    for (const macro of allMacros) {
        const isExactMatch = macro.name === context.identifier;
        const isAliasMatch = macro.aliasOf === context.identifier;

        /** @type {MacroAutoCompleteContext|EnhancedMacroAutoCompleteOptions|null} */
        let macroContext = (isExactMatch || isAliasMatch) ? context : null;

        if (!macroContext) {
            macroContext = /** @type {EnhancedMacroAutoCompleteOptions} */ ({
                paddingAfter: context.paddingBefore,
                flags: context.flags,
                currentFlag: context.currentFlag,
                fullText: context.fullText,
            });
        }

        const option = new EnhancedMacroAutoCompleteOption(macro, macroContext);

        if (macro.name === 'else' && !isInsideScopedIf) {
            option.valueProvider = () => '';
            option.makeSelectable = false;
        }

        if (isTypingArgs && (isExactMatch || isAliasMatch)) {
            options.unshift(option);
        } else {
            options.push(option);
        }
    }

    return options;
}

/**
 * Builds autocomplete options for {{if}} condition.
 *
 * @param {MacroAutoCompleteContext} context - The macro context.
 * @param {import('../macros/engine/MacroRegistry.js').MacroDefinition[]} allMacros - All available macros.
 * @param {string} macroInnerText - The text inside the macro braces.
 * @returns {AutoCompleteOption[]}
 */
export function buildIfConditionOptions(context, allMacros, macroInnerText) {
    /** @type {AutoCompleteOption[]} */
    const options = [];

    const leadingMatch = macroInnerText.match(/^(\s*)/);
    const paddingAfter = leadingMatch ? leadingMatch[1] : '';

    const conditionText = (context.args[0] || '').trim();
    const hasInversionPrefix = conditionText.startsWith('!');
    const conditionAfterInversion = hasInversionPrefix ? conditionText.slice(1).trimStart() : conditionText;

    const inversionOption = new SimpleAutoCompleteOption({
        name: '!',
        symbol: '🔁',
        description: 'Invert condition (NOT)',
        detailedDescription: 'Inverts the condition result. If the condition is truthy, it becomes falsy, and vice versa.<br><br>Example: <code>{{if !myVar}}</code> executes when <code>myVar</code> is empty or zero.',
        type: 'inverse',
    });

    const isTypingVariableShorthand = conditionAfterInversion.startsWith('.') || conditionAfterInversion.startsWith('$');

    if (isTypingVariableShorthand) {
        const prefix = /** @type {'.'|'$'} */ (conditionAfterInversion[0]);
        const varNameTyped = conditionAfterInversion.slice(1);

        if (hasInversionPrefix) {
            inversionOption.valueProvider = () => '';
            inversionOption.makeSelectable = false;
            inversionOption.sortPriority = 0;
            options.push(inversionOption);
        }

        /** @type {MacroAutoCompleteContext} */
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

        const varOptions = buildVariableShorthandOptions(varContext, { forIfCondition: true, paddingAfter });
        options.push(...varOptions);
        return options;
    }

    if (conditionText.length === 0) {
        inversionOption.valueProvider = () => '!';
        inversionOption.makeSelectable = true;
        inversionOption.sortPriority = -1;
        options.push(inversionOption);
    } else if (hasInversionPrefix && conditionAfterInversion.length === 0) {
        inversionOption.valueProvider = () => '';
        inversionOption.makeSelectable = false;
        inversionOption.sortPriority = -1;
        options.push(inversionOption);
    }

    if (conditionAfterInversion.length === 0) {
        for (const [, prefixDef] of VariableShorthandDefinitions) {
            const prefixOption = new VariableShorthandAutoCompleteOption(prefixDef);
            prefixOption.valueProvider = () => prefixDef.type;
            prefixOption.makeSelectable = true;
            prefixOption.sortPriority = 0;
            options.push(prefixOption);
        }
    }

    for (const macro of allMacros) {
        if (macro.minArgs !== 0) continue;
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
 * Finds macro boundaries at a given cursor position in any text.
 * Works independently of slash command parsing.
 *
 * @param {string} text - The full text content.
 * @param {number} cursorPos - The cursor position in the text.
 * @returns {{ start: number, end: number, content: string } | null}
 */
export function findMacroAtCursor(text, cursorPos) {
    let openPos = -1;
    for (let i = cursorPos - 1; i >= 0; i--) {
        if (text[i] === '{' && i > 0 && text[i - 1] === '{') {
            openPos = i - 1;
            break;
        }
        if (text[i] === '}' && i > 0 && text[i - 1] === '}') {
            break;
        }
    }

    if (openPos === -1) return null;

    let closePos = -1;
    for (let i = cursorPos; i < text.length - 1; i++) {
        if (text[i] === '}' && text[i + 1] === '}') {
            closePos = i + 2;
            break;
        }
        if (text[i] === '{' && text[i + 1] === '{') {
            break;
        }
    }

    if (closePos === -1) {
        closePos = text.length;
    }

    const hasClosingBraces = closePos <= text.length && text.slice(closePos - 2, closePos) === '}}';
    const content = text.slice(openPos + 2, hasClosingBraces ? closePos - 2 : closePos);

    return {
        start: openPos,
        end: closePos,
        content,
    };
}

/**
 * Gets variable names from the specified scope.
 *
 * @param {'local'|'global'} scope - The variable scope.
 * @returns {string[]} Array of variable names.
 */
export function getVariableNames(scope) {
    try {
        if (scope === 'local') {
            return Object.keys(chat_metadata?.variables ?? {});
        } else {
            return Object.keys(extension_settings?.variables?.global ?? {});
        }
    } catch {
        return [];
    }
}

/**
 * Core function to build macro autocomplete results.
 * Used by both SlashCommandParser (slash command context) and MacroAutoComplete (free text).
 *
 * This is the shared implementation that handles:
 * - Scoped content detection and context display
 * - {{if}} condition special handling
 * - Variable shorthand syntax (.var, $var)
 * - Flag handling
 * - Regular macro options
 *
 * @param {string} text - The full text content.
 * @param {number} cursorPos - The cursor position.
 * @param {BuildMacroAutoCompleteOptions} [options={}] - Optional pre-computed values.
 * @returns {Promise<AutoCompleteNameResult|null>}
 */
export async function buildMacroAutoCompleteResult(text, cursorPos, {
    macro = null,
    textUpToCursor = null,
    unclosedScopes = null,
} = {}) {
    // Compute textUpToCursor if not provided
    if (textUpToCursor === null) {
        textUpToCursor = text.slice(0, cursorPos);
    }

    // Compute unclosedScopes if not provided
    if (unclosedScopes === null) {
        unclosedScopes = findUnclosedScopes(textUpToCursor);
    }

    // If cursor is NOT inside a macro, check if we're in scoped content
    if (!macro) {
        if (unclosedScopes.length > 0) {
            const scopedMacro = unclosedScopes[unclosedScopes.length - 1];

            // Find where the opening macro ends
            const openingEnd = text.indexOf('}}', scopedMacro.startOffset);
            if (openingEnd !== -1 && cursorPos >= openingEnd + 2) {
                // We're in scoped content - show parent macro's details
                const macroContent = text.slice(scopedMacro.startOffset + 2, openingEnd);
                const baseContext = parseMacroContext(macroContent, macroContent.length);

                const scopedContext = {
                    ...baseContext,
                    currentArgIndex: baseContext.args.length,
                    isInScopedContent: true,
                    scopedMacroName: scopedMacro.name,
                };

                await onboardingExperimentalMacroEngine('scoped macros');

                const macroDef = macroSystem.registry.getPrimaryMacro(scopedMacro.name);
                if (macroDef) {
                    const scopedOption = new EnhancedMacroAutoCompleteOption(macroDef, scopedContext);
                    scopedOption.valueProvider = () => '';

                    return new AutoCompleteNameResult(
                        scopedMacro.name,
                        scopedMacro.startOffset + 2,
                        [scopedOption],
                        false,
                    );
                }
            }
        }
        return null;
    }

    // Cursor is inside a macro - parse context
    const cursorInMacro = cursorPos - macro.start - 2;
    const context = parseMacroContext(macro.content, cursorInMacro);

    // Check if cursor is at/after closing }}
    const macroEndsBrackets = text.slice(macro.end - 2, macro.end) === '}}';
    const isCursorAtClosing = macroEndsBrackets && cursorPos >= macro.end - 1;

    if (isCursorAtClosing) {
        // Check if this is an unclosed scoped macro
        if (unclosedScopes.length > 0) {
            const scopedMacro = unclosedScopes[unclosedScopes.length - 1];
            if (scopedMacro.startOffset === macro.start) {
                const scopedContext = {
                    ...context,
                    currentArgIndex: context.args.length,
                    isInScopedContent: true,
                    scopedMacroName: scopedMacro.name,
                };

                const macroDef = macroSystem.registry.getPrimaryMacro(scopedMacro.name);
                if (macroDef) {
                    const scopedOption = new EnhancedMacroAutoCompleteOption(macroDef, scopedContext);
                    scopedOption.valueProvider = () => '';

                    return new AutoCompleteNameResult(
                        scopedMacro.name,
                        macro.start + 2,
                        [scopedOption],
                        false,
                    );
                }
            }
        }
        context.currentArgIndex = -1;
    }

    const identifier = context.identifier;
    const identifierStartInText = macro.start + 2 + context.identifierStart;

    // Special case: {{if}} condition
    const isTypingIfCondition = context.identifier === 'if' && context.currentArgIndex === 0;
    if (isTypingIfCondition) {
        const conditionText = context.args[0] || '';
        const separatorMatch = macro.content.match(/^.*?if\s*(?:::?)\s*/);
        const spaceMatch = macro.content.match(/^.*?if\s+/);
        let conditionStartOffset;
        if (separatorMatch) {
            conditionStartOffset = separatorMatch[0].length;
        } else if (spaceMatch) {
            conditionStartOffset = spaceMatch[0].length;
        } else {
            conditionStartOffset = context.identifierStart + identifier.length;
        }
        const conditionStartInText = macro.start + 2 + conditionStartOffset;

        const allMacros = macroSystem.registry.getAllMacros({ excludeHiddenAliases: true });
        const options = buildIfConditionOptions(context, allMacros, macro.content);

        const trimmedCondition = conditionText.trim();
        const hasInversion = trimmedCondition.startsWith('!');
        const conditionAfterInversion = hasInversion ? trimmedCondition.slice(1).trimStart() : trimmedCondition;
        const isTypingVarShorthand = conditionAfterInversion.startsWith('.') || conditionAfterInversion.startsWith('$');
        let resultIdentifier = conditionText;
        let resultStart = conditionStartInText;

        if (isTypingVarShorthand) {
            resultIdentifier = conditionAfterInversion.slice(1);
            const prefixChar = conditionAfterInversion[0];
            const prefixPosInCondition = conditionText.indexOf(prefixChar, hasInversion ? 1 : 0);
            resultStart = conditionStartInText + prefixPosInCondition + 1;
        } else if (hasInversion && conditionAfterInversion.length === 0) {
            resultIdentifier = '';
            resultStart = conditionStartInText + conditionText.length;
        } else if (hasInversion && conditionAfterInversion.length > 0) {
            resultIdentifier = conditionAfterInversion;
            const macroNameStart = trimmedCondition.indexOf(conditionAfterInversion);
            resultStart = conditionStartInText + macroNameStart;
        }

        await onboardingExperimentalMacroEngine('{{if}} macro');

        return new AutoCompleteNameResult(
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
    }

    // Build regular macro options
    /** @type {()=>string|undefined} */
    let makeNoMatchText = undefined;
    /** @type {()=>string|undefined} */
    let makeNoOptionsText = undefined;

    const options = buildEnhancedMacroOptions(context, textUpToCursor);

    let resultIdentifier = identifier;
    let resultStart = identifierStartInText;

    // Handle variable shorthand syntax
    if (context.isVariableShorthand && context.variablePrefix) {
        const prefixIndex = macro.content.indexOf(context.variablePrefix);

        if (context.isTypingVariableName) {
            resultIdentifier = context.variableName;
            if (prefixIndex >= 0) {
                resultStart = macro.start + 2 + prefixIndex + 1;
            }
        } else if (context.isTypingOperator) {
            resultIdentifier = context.partialOperator || '';
            if (prefixIndex >= 0) {
                resultStart = macro.start + 2 + prefixIndex + 1 + context.variableName.length;
                if (!context.partialOperator) {
                    resultStart = cursorPos;
                }
            }
        } else if (context.isOperatorComplete) {
            resultIdentifier = '';
            resultStart = cursorPos;
        } else if (context.hasInvalidTrailingChars) {
            resultIdentifier = context.invalidTrailingChars || '';
            if (prefixIndex >= 0) {
                resultStart = macro.start + 2 + prefixIndex + 1 + context.variableName.length;
            }
        } else if (context.isTypingValue) {
            resultIdentifier = context.variableValue;
            if (prefixIndex >= 0) {
                const operatorLen = context.variableOperator?.length ?? 0;
                resultStart = macro.start + 2 + prefixIndex + 1 + context.variableName.length + operatorLen;
                while (resultStart < cursorPos && /\s/.test(text[resultStart])) {
                    resultStart++;
                }
                makeNoMatchText = () => `Type any value you want to ${context.variableOperator == '+=' ? `add to the variable '${context.variableName}'` : `set the variable '${context.variableName}' to`}.`;
                makeNoOptionsText = () => 'Enter a variable value';
            }
        } else {
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

    return new AutoCompleteNameResult(
        resultIdentifier,
        resultStart,
        options,
        false,
        makeNoMatchText,
        makeNoOptionsText,
    );
}

/**
 * Entry point for macro autocomplete in free text contexts.
 * Finds the macro at cursor position and delegates to the shared builder.
 *
 * @param {string} text - The full text content.
 * @param {number} cursorPos - The cursor position.
 * @returns {Promise<AutoCompleteNameResult|null>}
 */
export async function getMacroAutoCompleteAt(text, cursorPos) {
    const macro = findMacroAtCursor(text, cursorPos);
    return buildMacroAutoCompleteResult(text, cursorPos, { macro });
}
