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
    VariableValueContextAutoCompleteOption,
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
/*** @typedef {import('../macros/macro-system.js').MacroDefinition} MacroDefinition */

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
 * @property {boolean} [isForced=false] - Whether autocomplete was force-triggered (Ctrl+Space)
 */

/** @typedef {(EnhancedMacroAutoCompleteOption|MacroFlagAutoCompleteOption|MacroClosingTagAutoCompleteOption|VariableShorthandAutoCompleteOption|VariableNameAutoCompleteOption|VariableOperatorAutoCompleteOption|VariableValueContextAutoCompleteOption|SimpleAutoCompleteOption)} AnyMacroAutoCompleteOption */

/**
 * Finds unclosed scoped macros in the text up to cursor position.
 * Uses the MacroParser and MacroCstWalker for accurate analysis.
 *
 * @param {string} textUpToCursor - The document text up to the cursor position.
 * @returns {Array<{ name: string, startOffset: number, endOffset: number, paddingBefore: string, paddingAfter: string }>}
 */
export function findUnclosedScopes(textUpToCursor) {
    if (!textUpToCursor) return [];

    try {
        // Parse the document to get the CST
        const { cst } = MacroParser.parseDocument(textUpToCursor);
        if (!cst) return [];

        // Use the CST walker to find unclosed scopes
        return MacroCstWalker.findUnclosedScopes({ text: textUpToCursor, cst });
    } catch {
        // If parsing fails (incomplete input), fall back to simple regex approach
        return findUnclosedScopesRegex(textUpToCursor);
    }
}

/**
 * Fallback regex-based approach for finding unclosed scopes.
 * Used when the parser fails on incomplete input.
 *
 * @param {string} text - The text to analyze.
 * @returns {Array<{ name: string, startOffset: number, endOffset: number, paddingBefore: string, paddingAfter: string }>}
 */
export function findUnclosedScopesRegex(text) {
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
            // Find matching opener in stack (case-insensitive)
            // When closing an outer scope, all inner unclosed scopes are implicitly closed
            const matchIndex = stack.findLastIndex(s => s.name.toLowerCase() === name.toLowerCase());
            if (matchIndex !== -1) {
                // Pop everything from matchIndex to end (inclusive) - closes the matched scope and all nested ones
                stack.splice(matchIndex);
            }
        } else {
            // Check if macro can accept scoped content
            // List-arg macros don't support scopes - they accept arbitrary inline args instead
            const macroDef = macroSystem.registry.getPrimaryMacro(name);
            if (macroDef && macroDef.maxArgs > 0 && macroDef.list === null) {
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
 * Checks if a scoped macro's scope content is optional (i.e., all required args are already filled).
 * Used to determine whether to show the scope hint by default or only when forced.
 *
 * @param {UnclosedScope} scope - The unclosed scope info.
 * @param {string} textUpToCursor - The text up to cursor to parse the macro content.
 * @returns {boolean} - True if the scope content is optional.
 */
function isScopeOptional(scope, textUpToCursor) {
    const def = macroSystem.registry.getPrimaryMacro(scope.name);
    if (!def) {
        // Unknown macro - treat scope as required (show hint)
        return false;
    }

    // Find the macro's closing }} to extract its content
    const openingEnd = textUpToCursor.indexOf('}}', scope.startOffset);
    if (openingEnd === -1) {
        // Macro not closed yet - can't determine
        return false;
    }

    // Extract content between {{ and }} to count arguments
    const macroContent = textUpToCursor.slice(scope.startOffset + 2, openingEnd);
    const context = parseMacroContext(macroContent, macroContent.length);

    // Count current arguments (including space-separated arg if present)
    const currentArgCount = context.args.length;

    // The scoped content would be the next argument (currentArgCount + 1)
    // Scope is optional if:
    // 1. Current args already meet minArgs requirement, AND
    // 2. Adding one more (scope) would still be <= maxArgs
    const wouldBeArgIndex = currentArgCount; // 0-indexed
    const scopeIsOptional = currentArgCount >= def.minArgs && wouldBeArgIndex < def.maxArgs;

    // Check if the argument at wouldBeArgIndex is marked as optional in the definition
    if (def.unnamedArgDefs && def.unnamedArgDefs[wouldBeArgIndex]) {
        return def.unnamedArgDefs[wouldBeArgIndex].optional === true;
    }

    // If no explicit arg definition, use the min/max args logic
    return scopeIsOptional;
}

/**
 * Filters unclosed scopes to exclude those with optional scope content.
 * Used when autocomplete is not force-triggered (Ctrl+Space).
 *
 * @param {UnclosedScope[]} unclosedScopes - The unclosed scopes to filter.
 * @param {string} textUpToCursor - The text up to cursor.
 * @param {boolean} isForced - Whether autocomplete was force-triggered.
 * @returns {UnclosedScope[]} - Filtered scopes (excludes optional scopes unless forced).
 */
function filterOptionalScopes(unclosedScopes, textUpToCursor, isForced) {
    if (isForced) {
        // When forced, show all scopes including optional ones
        return unclosedScopes;
    }

    // Filter out scopes where the scope content is optional
    return unclosedScopes.filter(scope => !isScopeOptional(scope, textUpToCursor));
}

/**
 * Builds autocomplete options for variable shorthand syntax (.varName or $varName).
 * @param {MacroAutoCompleteContext} context
 * @param {Object} [opts] - Optional configuration.
 * @param {boolean} [opts.forIfCondition=false] - If true, options are for {{if}} condition (closes with }}).
 * @param {string} [opts.paddingAfter=''] - Whitespace to add before closing }}.
 * @returns {AnyMacroAutoCompleteOption[]}
 */
export function buildVariableShorthandOptions(context, opts = {}) {
    const { forIfCondition = false, paddingAfter = '' } = opts;
    /** @type {AnyMacroAutoCompleteOption[]} */
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
        prefixOption.matchProvider = () => true; // Always show regardless of filtering
        options.push(prefixOption);
    }

    // If typing the variable name, suggest existing variables
    // Get existing variable names from the appropriate scope
    // Filter to only include names that are valid for shorthand syntax
    const existingVariables = getVariableNames(scope)
        .filter(name => isValidVariableShorthandName(name));

    // Check if the typed variable name exactly matches an existing variable
    const variableNameMatchesExisting = context.variableName.length > 0 && existingVariables.includes(context.variableName);

    if (context.isTypingVariableName) {
        // Add existing variables that match the typed name
        for (const varName of existingVariables) {
            const option = new VariableNameAutoCompleteOption(varName, scope, false);
            // Not selectable if it matches the typed name
            if (varName === context.variableName) {
                option.valueProvider = () => '';
                option.makeSelectable = false;
            }
            // For {{if}} condition, provide full value with closing braces
            if (forIfCondition) {
                option.valueProvider = () => `${varName}${paddingAfter}}}`; // No variable prefix, as that has been written and committed already.
                option.makeSelectable = true;
            }
            // Variables matching the typed prefix get higher priority
            option.sortPriority = varName.startsWith(context.variableName) ? 3 : 10;
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
                newVarOption.makeSelectable = true;
            }
            options.push(newVarOption);
        }

        // If the typed variable name exactly matches an existing variable, also show operators
        // This allows users to see available operators without having to type a space first
        if (variableNameMatchesExisting) {
            for (const [, operatorDef] of VariableOperatorDefinitions) {
                const opOption = new VariableOperatorAutoCompleteOption(operatorDef);
                opOption.sortPriority = 6; // Lower priority than variable suggestions
                opOption.matchProvider = () => true; // Always show
                // IMPORTANT: Operators should INSERT after variable name, not replace it
                // Use replacementStartOffset to shift insertion point past the variable name
                opOption.replacementStartOffset = context.variableName.length;
                options.push(opOption);
            }
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
        varNameOption.makeSelectable = false;
        varNameOption.sortPriority = 2;
        varNameOption.matchProvider = () => true; // Always show
        options.push(varNameOption);

        // Then show available operators, filtered by partial prefix if any
        // Also filter by current complete operator to show longer variants (e.g., > shows >=)
        const partialOp = context.partialOperator || '';
        const currentOp = context.variableOperator || '';
        const filterPrefix = partialOp || currentOp;
        for (const [, operatorDef] of VariableOperatorDefinitions) {
            // Filter by operator prefix if user is typing one
            // This allows typing ">" to show both ">" and ">="
            if (filterPrefix && !operatorDef.symbol.startsWith(filterPrefix)) {
                continue;
            }
            const opOption = new VariableOperatorAutoCompleteOption(operatorDef);
            // Exact match gets higher priority
            opOption.sortPriority = operatorDef.symbol === currentOp ? 4 : 5;
            // Already-typed operator is non-selectable
            if (operatorDef.symbol === currentOp) {
                opOption.valueProvider = () => '';
                opOption.makeSelectable = false;
            }
            // Always match operators when showing operator suggestions
            opOption.matchProvider = () => true;
            options.push(opOption);
        }
    }

    // If typing value (after = or +=), no autocomplete needed - freeform text
    // But we show the current context for reference (greyed out, non-selectable)
    if (context.isTypingValue && !context.isTypingOperator && !context.isTypingClosingBrace) {
        // Show the current variable name as context (non-selectable)
        const varNameOption = new VariableNameAutoCompleteOption(context.variableName, scope, false);
        varNameOption.valueProvider = () => ''; // Context only
        varNameOption.makeSelectable = false;
        varNameOption.sortPriority = 2;
        varNameOption.matchProvider = () => true; // Always show
        options.push(varNameOption);

        // Show the operator that was used (non-selectable)
        if (context.variableOperator) {
            const opDef = VariableOperatorDefinitions.get(context.variableOperator);
            if (opDef) {
                const opOption = new VariableOperatorAutoCompleteOption(opDef);
                opOption.valueProvider = () => ''; // Already typed
                opOption.makeSelectable = false;
                opOption.sortPriority = 3;
                opOption.matchProvider = () => true; // Always show
                options.push(opOption);

                // Show value context info (non-selectable)
                const valueOption = new VariableValueContextAutoCompleteOption(opDef, context.variableValue);
                valueOption.valueProvider = () => ''; // Context only
                valueOption.makeSelectable = false;
                valueOption.sortPriority = 4;
                valueOption.matchProvider = () => true; // Always show
                options.push(valueOption);
            }
        }
    }

    // If operator is complete (++ or --), show context without value input (non-selectable)
    if (context.isOperatorComplete && !context.isTypingOperator) {
        // Show the current variable name as context (non-selectable)
        const varNameOption = new VariableNameAutoCompleteOption(context.variableName, scope, false);
        varNameOption.valueProvider = () => ''; // Context only
        varNameOption.makeSelectable = false;
        varNameOption.sortPriority = 2;
        varNameOption.matchProvider = () => true; // Always show
        options.push(varNameOption);

        // Show the operator that was used (non-selectable)
        if (context.variableOperator) {
            const opDef = VariableOperatorDefinitions.get(context.variableOperator);
            if (opDef) {
                const opOption = new VariableOperatorAutoCompleteOption(opDef);
                opOption.valueProvider = () => ''; // Already typed
                opOption.makeSelectable = false;
                opOption.sortPriority = 3;
                opOption.matchProvider = () => true; // Always show
                options.push(opOption);
            }
        }
    }

    // If typing closing brace on a variable shorthand (without operator), show the current state
    // This handles cases like {{.Lila} or {{.Lila}}| where we want to show what was typed
    if (context.isTypingClosingBrace && !context.isOperatorComplete && !context.isTypingOperator && !context.isTypingValue) {
        // Show the current variable name as context (non-selectable)
        const varNameOption = new VariableNameAutoCompleteOption(context.variableName, scope, false);
        varNameOption.valueProvider = () => ''; // Context only
        varNameOption.makeSelectable = false;
        varNameOption.sortPriority = 2;
        varNameOption.matchProvider = () => true; // Always show
        options.push(varNameOption);
    }

    // If typing closing brace after a value operator (like {{.Lila+=4}} or {{.Lila+=4}),
    // show the full context (variable + operator + value)
    if (context.isTypingClosingBrace && context.variableOperator && context.isTypingValue) {
        // Show the current variable name as context (non-selectable)
        const varNameOption = new VariableNameAutoCompleteOption(context.variableName, scope, false);
        varNameOption.valueProvider = () => ''; // Context only
        varNameOption.makeSelectable = false;
        varNameOption.sortPriority = 2;
        varNameOption.matchProvider = () => true; // Always show
        options.push(varNameOption);

        // Show the operator that was used (non-selectable)
        const opDef = VariableOperatorDefinitions.get(context.variableOperator);
        if (opDef) {
            const opOption = new VariableOperatorAutoCompleteOption(opDef);
            opOption.valueProvider = () => ''; // Already typed
            opOption.makeSelectable = false;
            opOption.sortPriority = 3;
            opOption.matchProvider = () => true; // Always show
            options.push(opOption);

            // Show value context info (non-selectable)
            const valueOption = new VariableValueContextAutoCompleteOption(opDef, context.variableValue);
            valueOption.valueProvider = () => ''; // Context only
            valueOption.makeSelectable = false;
            valueOption.sortPriority = 4;
            valueOption.matchProvider = () => true; // Always show
            options.push(valueOption);
        }
    }

    return options;
}

/**
 * Builds enhanced macro autocomplete options from the MacroRegistry.
 * When in the flags area (before identifier), includes flag options.
 * When typing arguments (after ::), prioritizes the exact macro match.
 * @param {MacroAutoCompleteContext} context
 * @param {string} [textUpToCursor] - Full document text up to cursor, for unclosed scope detection.
 * @param {Object} [opts] - Additional options.
 * @param {boolean} [opts.isForced=false] - Whether autocomplete was force-triggered (Ctrl+Space).
 * @returns {AnyMacroAutoCompleteOption[]}
 */
export function buildEnhancedMacroOptions(context, textUpToCursor, { isForced = false } = {}) {
    /** @type {AnyMacroAutoCompleteOption[]} */
    const options = [];

    if (context.isVariableShorthand) {
        return buildVariableShorthandOptions(context);
    }

    // Check for unclosed scoped macros and suggest closing tags
    // Iterate from innermost to outermost, adding optional scopes and stopping at first required scope
    const unclosedScopes = findUnclosedScopes(textUpToCursor);
    if (unclosedScopes.length > 0) {
        let firstRequiredPriority = 1; // Priority for the first required (non-optional) scope
        let optionalPriority = 3; // Lower priority for optional scopes
        let foundRequired = false;
        let elseOptionAdded = false;

        // Iterate from innermost (last) to outermost (first)
        for (let i = unclosedScopes.length - 1; i >= 0; i--) {
            const scope = unclosedScopes[i];
            const isOptional = isScopeOptional(scope, textUpToCursor);
            const nestingLevel = unclosedScopes.length - 1 - i; // 0 = innermost

            // If we've already found a required scope, stop adding more
            if (foundRequired && !isOptional) break;

            const closingOption = new MacroClosingTagAutoCompleteOption(scope.name, {
                paddingBefore: scope.paddingBefore,
                paddingAfter: scope.paddingAfter,
                currentPadding: context.paddingBefore,
                isOptional: isOptional,
                nestingLevel: nestingLevel,
            });

            if (isOptional) {
                closingOption.sortPriority = optionalPriority++;
            } else {
                // First required scope gets top priority
                closingOption.sortPriority = firstRequiredPriority;
                foundRequired = true;
            }

            options.push(closingOption);

            // If inside a scoped {{if}}, also suggest {{else}} (only once, for innermost if)
            if (!elseOptionAdded && scope.name === 'if') {
                const macroDef = macroSystem.registry.getPrimaryMacro('else');
                const elseOption = new EnhancedMacroAutoCompleteOption(macroDef);
                elseOption.sortPriority = 2;
                options.push(elseOption);
                elseOptionAdded = true;
            }

            // Stop once we've added a required scope
            if (foundRequired) break;
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
                lastFlagOption.makeSelectable = false;
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
                flagOption.makeSelectable = false;
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
    // Also treat typing closing brace the same way - show details for matching macro
    const isTypingArgs = context.currentArgIndex >= 0;
    const isTypingClosingBrace = context.isTypingClosingBrace ?? false;
    const shouldShowMatchingMacroDetails = isTypingArgs || isTypingClosingBrace;

    // Check if we're inside a scoped {{if}} for {{else}} selectability
    const isInsideScopedIf = unclosedScopes.some(scope => scope.name === 'if');

    // Track if any macro matches the identifier (for "no match" message)
    let hasMatchingMacro = false;

    for (const macro of allMacros) {
        // Check if this macro matches the typed identifier
        const isExactMatch = macro.name === context.identifier;
        const isAliasMatch = macro.aliasOf === context.identifier;

        if (isExactMatch || isAliasMatch) {
            hasMatchingMacro = true;
        }

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

        // When typing arguments or closing brace, prioritize exact matches by putting them first
        if (shouldShowMatchingMacroDetails && (isExactMatch || isAliasMatch)) {
            options.unshift(option);
        } else {
            options.push(option);
        }
    }

    // If typing args/closing brace but no macro matches, check for closing macro context
    if (shouldShowMatchingMacroDetails && !hasMatchingMacro && context.identifier.length > 0) {
        // Check if this is a closing macro (starts with /) - show original macro's details
        // Note: We look up the macro directly, not from unclosedScopes, because the closing tag
        // itself may have already closed the scope by this point in the text
        const isClosingMacro = context.identifier.startsWith('/');
        const closingMacroName = isClosingMacro ? context.identifier.slice(1) : null;
        const macroDef = closingMacroName ? macroSystem.registry.getPrimaryMacro(closingMacroName) : null;

        if (macroDef) {
            // Show the original macro's details for the closing tag
            // Create a context that shows we're closing the scope (no argument highlight)
            const closingContext = /** @type {MacroAutoCompleteContext} */ ({
                ...context,
                identifier: macroDef.name,
                currentArgIndex: -1, // No argument highlight
                isClosingTag: true,
            });
            const closingOption = new EnhancedMacroAutoCompleteOption(macroDef, closingContext);
            closingOption.valueProvider = () => '';
            closingOption.makeSelectable = false;
            closingOption.matchProvider = () => true;
            closingOption.sortPriority = 0;
            options.unshift(closingOption);
            hasMatchingMacro = true; // Prevent "no match" message
        }

        // Only show "no match" if we didn't find a matching closing scope
        if (!hasMatchingMacro) {
            const noMatchOption = new SimpleAutoCompleteOption({
                name: context.identifier,
                symbol: '❌',
                description: `No macro found: "${context.identifier}"`,
                detailedDescription: `The macro name <code>${context.identifier}</code> does not exist.<br><br>Check spelling or use a different macro name.`,
                type: 'error',
            });
            noMatchOption.valueProvider = () => '';
            noMatchOption.makeSelectable = false;
            noMatchOption.matchProvider = () => true; // Always show
            noMatchOption.sortPriority = 0; // Top priority
            options.unshift(noMatchOption);
        }
    }

    return options;
}

/**
 * Builds autocomplete options for {{if}} condition - shows zero-arg macros as shorthand.
 * @param {MacroAutoCompleteContext} context
 * @param {MacroDefinition[]} allMacros
 * @param {string} macroInnerText - The text inside the macro braces (e.g., "  if  pers" from "{{  if  pers").
 * @returns {AutoCompleteOption[]}
 */
export function buildIfConditionOptions(context, allMacros, macroInnerText) {
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
 * Finds macro boundaries at a given cursor position in any text.
 * Works independently of slash command parsing.
 *
 * @param {string} text - The full text content.
 * @param {number} cursorPos - The cursor position in the text.
 * @returns {{ start: number, end: number, content: string } | null}
 */
export function findMacroAtCursor(text, cursorPos) {
    // Search backwards for opening {{ while tracking nesting depth for nested macros
    let openPos = -1;
    let depth = 0;

    // If cursor is right after }}, those are the closing braces of the macro we're looking for,
    // not nested braces. Skip them by starting the search before them.
    let searchStart = cursorPos - 1;
    let cursorAfterClosingBraces = false;
    if (cursorPos >= 2 && text[cursorPos - 1] === '}' && text[cursorPos - 2] === '}') {
        searchStart = cursorPos - 3; // Start before the }}
        cursorAfterClosingBraces = true;
    }

    for (let i = searchStart; i >= 0; i--) {
        if (text[i] === '}' && i > 0 && text[i - 1] === '}') {
            // Found }}, going backwards means we're entering a nested macro
            depth++;
            i--; // Skip the other brace
            continue;
        }
        if (text[i] === '{' && i > 0 && text[i - 1] === '{') {
            if (depth > 0) {
                // This {{ closes a nested macro we entered going backwards
                depth--;
                i--; // Skip the other brace
                continue;
            }
            // Found our opening {{ at depth 0
            openPos = i - 1;
            break;
        }
    }

    if (openPos === -1) return null;

    // Search forwards for closing }} while tracking nesting depth
    let closePos = -1;

    // If cursor is right after }}, we already know where the closing braces are
    if (cursorAfterClosingBraces) {
        closePos = cursorPos;
    } else {
        depth = 0;
        for (let i = cursorPos; i < text.length - 1; i++) {
            if (text[i] === '{' && text[i + 1] === '{') {
                // Found {{, entering a nested macro
                depth++;
                i++; // Skip the other brace
                continue;
            }
            if (text[i] === '}' && text[i + 1] === '}') {
                if (depth > 0) {
                    // This }} closes a nested macro
                    depth--;
                    i++; // Skip the other brace
                    continue;
                }
                // Found our closing }} at depth 0
                closePos = i + 2;
                break;
            }
        }

        if (closePos === -1) {
            closePos = text.length;
        }
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
    isForced = false,
} = {}) {
    // Compute textUpToCursor if not provided
    if (textUpToCursor === null) {
        textUpToCursor = text.slice(0, cursorPos);
    }

    // Compute unclosedScopes if not provided
    if (unclosedScopes === null) {
        unclosedScopes = findUnclosedScopes(textUpToCursor);
    }

    // Filter out optional scopes unless forced (Ctrl+Space)
    // This prevents intrusive hints for macros like {{trim}} where scope is optional
    const filteredScopes = filterOptionalScopes(unclosedScopes, textUpToCursor, isForced);

    // If cursor is NOT inside a macro, check if we're in scoped content
    if (!macro) {
        if (filteredScopes.length > 0) {
            const scopedMacro = filteredScopes[filteredScopes.length - 1];

            // Find where the opening macro ends
            const openingEnd = text.indexOf('}}', scopedMacro.startOffset);
            if (openingEnd !== -1 && cursorPos >= openingEnd + 2) {
                // We're in scoped content - show parent macro's details
                const macroContent = text.slice(scopedMacro.startOffset + 2, openingEnd);
                const baseContext = parseMacroContext(macroContent, macroContent.length);

                // Check if this scope is optional (for display purposes)
                const scopeIsOptional = isScopeOptional(scopedMacro, textUpToCursor);

                const scopedContext = {
                    ...baseContext,
                    currentArgIndex: baseContext.args.length,
                    isInScopedContent: true,
                    isScopedContentOptional: scopeIsOptional,
                    scopedMacroName: scopedMacro.name,
                };

                await onboardingExperimentalMacroEngine('scoped macros');

                const macroDef = macroSystem.registry.getPrimaryMacro(scopedMacro.name);
                if (macroDef) {
                    const scopedOption = new EnhancedMacroAutoCompleteOption(macroDef, scopedContext);
                    scopedOption.valueProvider = () => '';
                    scopedOption.makeSelectable = false;

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
        // Cursor is at the closing }} - check if this is an unclosed scoped macro
        if (filteredScopes.length > 0) {
            const scopedMacro = filteredScopes[filteredScopes.length - 1];
            // Check if the current macro IS the unclosed scoped macro
            if (scopedMacro.startOffset === macro.start) {
                // Show scoped context - cursor is right at the end of the opening tag
                // Check if this scope is optional (for display purposes)
                const scopeIsOptional = isScopeOptional(scopedMacro, textUpToCursor);

                const scopedContext = {
                    ...context,
                    currentArgIndex: context.args.length,
                    isInScopedContent: true,
                    isScopedContentOptional: scopeIsOptional,
                    scopedMacroName: scopedMacro.name,
                };

                const macroDef = macroSystem.registry.getPrimaryMacro(scopedMacro.name);
                if (macroDef) {
                    const scopedOption = new EnhancedMacroAutoCompleteOption(macroDef, scopedContext);
                    scopedOption.valueProvider = () => '';
                    scopedOption.makeSelectable = false;

                    return new AutoCompleteNameResult(
                        scopedMacro.name,
                        macro.start + 2,
                        [scopedOption],
                        false,
                    );
                }
            }
        }

        // Check if this is a closing tag ({{/macroName}}) - show original macro's details
        // Note: We look up the macro directly, not from unclosedScopes, because the closing tag
        // itself has already closed the scope by this point in the text
        if (context.identifier.startsWith('/')) {
            const closingMacroName = context.identifier.slice(1);
            const macroDef = macroSystem.registry.getPrimaryMacro(closingMacroName);
            if (macroDef) {
                const closingContext = /** @type {MacroAutoCompleteContext} */ ({
                    ...context,
                    identifier: macroDef.name,
                    currentArgIndex: -1, // No argument highlight
                    isClosingTag: true,
                });
                const closingOption = new EnhancedMacroAutoCompleteOption(macroDef, closingContext);
                closingOption.valueProvider = () => '';
                closingOption.makeSelectable = false;

                return new AutoCompleteNameResult(
                    macroDef.name,
                    macro.start + 2,
                    [closingOption],
                    false,
                );
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

    // Special case for {{if}} condition: use the condition text for matching/replacement
    const isTypingIfCondition = context.identifier === 'if' && context.currentArgIndex === 0;
    if (isTypingIfCondition) {
        // Get the typed condition text and calculate its start position
        const conditionText = context.args[0] || '';
        // Find where the condition argument starts in the macro text
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

        // Build if-condition options using macroContent for padding calculation
        const allMacros = macroSystem.registry.getAllMacros({ excludeHiddenAliases: true });
        const options = buildIfConditionOptions(context, allMacros, macro.content);

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

    // For variable shorthands, calculate the correct identifier and start position
    // based on what the user is currently typing (variable name, operator, or value)
    let resultIdentifier = identifier;
    let resultStart = identifierStartInText;
    if (context.isVariableShorthand && context.variablePrefix) {
        // Find where the prefix is in the macro content
        const prefixIndex = macro.content.indexOf(context.variablePrefix);

        if (context.isTypingVariableName) {
            // Typing variable name: identifier = variableName, start = after prefix
            resultIdentifier = context.variableName;
            if (prefixIndex >= 0) {
                resultStart = macro.start + 2 + prefixIndex + 1; // +1 to skip the prefix
            }
        } else if (context.isTypingOperator) {
            // Typing operator: identifier = partial operator or current operator, start = after variable name
            resultIdentifier = context.partialOperator || context.variableOperator || '';
            // Use actual variableNameEnd position from parsing (accounts for whitespace)
            resultStart = macro.start + 2 + context.variableNameEnd;
            // Skip whitespace between variable name and operator
            while (resultStart < cursorPos && /\s/.test(text[resultStart])) {
                resultStart++;
            }
        } else if (context.isOperatorComplete) {
            // Operator complete (++ or --) - show context but no value input needed
            resultIdentifier = '';
            resultStart = cursorPos; // Cursor at end
        } else if (context.hasInvalidTrailingChars) {
            // Invalid chars after variable name: show the invalid chars for warning
            resultIdentifier = context.invalidTrailingChars || '';
            // Use actual variableNameEnd position from parsing
            resultStart = macro.start + 2 + context.variableNameEnd;
        } else if (context.isTypingValue && !context.isTypingClosingBrace) {
            // Typing value: identifier = value being typed, start = after operator
            resultIdentifier = context.variableValue;
            // Use actual operatorEnd position from parsing (accounts for whitespace)
            resultStart = macro.start + 2 + context.variableOperatorEnd;
            // Skip any whitespace between operator and value
            while (resultStart < cursorPos && /\s/.test(text[resultStart])) {
                resultStart++;
            }

            makeNoMatchText = () => `Type any value you want to ${context.variableOperator == '+=' ? `add to the variable '${context.variableName}'` : `set the variable '${context.variableName}' to`}.`;
            makeNoOptionsText = () => 'Enter a variable value';
        } else if (context.isTypingClosingBrace) {
            // Typing closing brace on variable shorthand - show context, no replacement needed
            resultIdentifier = '';
            resultStart = cursorPos;
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
 * @param {Object} [options={}] - Additional options.
 * @param {boolean} [options.isForced=false] - Whether autocomplete was force-triggered (Ctrl+Space).
 * @returns {Promise<AutoCompleteNameResult|null>}
 */
export async function getMacroAutoCompleteAt(text, cursorPos, { isForced = false } = {}) {
    const macro = findMacroAtCursor(text, cursorPos);
    return buildMacroAutoCompleteResult(text, cursorPos, { macro, isForced });
}
