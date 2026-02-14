/** @typedef {import('chevrotain').CstNode} CstNode */
/** @typedef {import('chevrotain').IToken} IToken */
/** @typedef {import('./MacroEnv.types.js').MacroEnv} MacroEnv */
/** @typedef {import('./MacroFlags.js').MacroFlags} MacroFlags */

import { logMacroInternalError, logMacroRuntimeWarning } from './MacroDiagnostics.js';
import { MacroEngine } from './MacroEngine.js';
import { parseFlags, createEmptyFlags, MacroFlagType } from './MacroFlags.js';
import { MacroParser } from './MacroParser.js';
import { MacroRegistry } from './MacroRegistry.js';
import { isFalseBoolean } from '/scripts/utils.js';

/**
 * @typedef {Object} MacroCall
 * @property {string} name
 * @property {string[]} args
 * @property {MacroFlags} flags - Parsed macro execution flags.
 * @property {boolean} isScoped - Whether this macro was invoked using scoped syntax (opening + closing tags).
 * @property {boolean} [isVariableShorthand] - Whether this call originated from variable shorthand syntax.
 * @property {MacroEnv} env
 * @property {string} rawInner
 * @property {string} rawWithBraces
 * @property {string[]} rawArgs
 * @property {{ startOffset: number, endOffset: number }} range - Range relative to the current evaluation context's text.
 * @property {number} globalOffset - The offset of this macro in the original top-level document.
 *           This combines the context's base offset with the local range. Use this for deterministic
 *           seeding (e.g., in {{pick}}) to ensure identical macros at different positions produce different results.
 * @property {CstNode} cstNode
 */

/**
 * @typedef {Object} VariableExprInfo
 * @property {'local' | 'global'} scope - Whether this is a local (.) or global ($) variable.
 * @property {string} varName - The variable name.
 * @property {'get' | 'set' | 'inc' | 'dec' | 'add'} operation - The operation to perform.
 * @property {string | null} value - The value for set/add operations, null for get/inc/dec.
 */

/**
 * Context passed through the CST evaluation process.
 *
 * @typedef {Object} EvaluationContext
 * @property {string} text - The text being evaluated at the current level. This is NOT the same as env.content.
 *           At the top level, this is the full document text. When evaluating nested content (arguments or scoped
 *           content), this is the substring being evaluated. CST node positions are always relative to this text.
 *
 *           - Careful, this also means when resolving macros inside macro arguments, this will NOT be the text of
 *           the argument currently being resolved, but the full macro text with identifier and all macros.
 * @property {number} contextOffset - Base offset from the original top-level document. At the top level this is 0.
 *           When re-parsing nested content (arguments/scoped), this is set to the substring's start position in
 *           the original document. Used to calculate globalOffset for macros that need deterministic positioning.
 * @property {MacroEnv} env - The macro environment containing context like user/char names, variables, and the
 *           original full content (env.content). This remains constant throughout the evaluation.
 * @property {(call: MacroCall) => string} resolveMacro - Callback to resolve a macro call to its result string.
 * @property {(content: string, options?: { trimIndent?: boolean }) => string} trimContent - Shared utility function that trims scoped content with optional indentation dedent.
 */

/**
 * @typedef {Object} TokenRange
 * @property {number} startOffset
 * @property {number} endOffset
 */

/**
 * @typedef {Object} MacroNodeInfo
 * @property {string} name - The macro identifier name.
 * @property {boolean} isClosing - Whether this macro has the closing block flag (/).
 * @property {number} startOffset - Start position in the source text.
 * @property {number} endOffset - End position in the source text (inclusive).
 * @property {number} argCount - Number of arguments provided to the macro.
 */

/**
 * The singleton instance of the MacroCstWalker.
 *
 * @type {MacroCstWalker}
 */
let instance;
export { instance as MacroCstWalker };

class MacroCstWalker {
    /** @type {MacroCstWalker} */ static #instance;
    /** @type {MacroCstWalker} */ static get instance() { return MacroCstWalker.#instance ?? (MacroCstWalker.#instance = new MacroCstWalker()); }

    constructor() { }

    /**
     * Evaluates a full document CST into a resolved string.
     *
     * @param {EvaluationContext & { cst: CstNode }} options
     * @returns {string}
     */
    evaluateDocument(options) {
        const { text, cst, contextOffset, env, resolveMacro, trimContent } = options;

        if (typeof text !== 'string') {
            throw new Error('MacroCstWalker.evaluateDocument: text must be a string');
        }
        if (!cst || typeof cst !== 'object' || !cst.children) {
            throw new Error('MacroCstWalker.evaluateDocument: cst must be a CstNode');
        }
        if (typeof resolveMacro !== 'function') {
            throw new Error('MacroCstWalker.evaluateDocument: resolveMacro must be a function');
        }
        if (typeof trimContent !== 'function') {
            throw new Error('MacroCstWalker.evaluateDocument: trimContent must be a function');
        }

        /** @type {EvaluationContext} */
        const context = { text, contextOffset, env, resolveMacro, trimContent };
        let items = this.#collectDocumentItems(cst);

        // Process scoped macros: find opening/closing pairs and merge them
        items = this.#processScopedMacros(items, text);

        if (items.length === 0) {
            return text;
        }

        let result = '';
        let cursor = 0;

        // Iterate over all items in the document. Evaluate any macro being found, and keep them in the exact same place.
        for (const item of items) {
            if (item.startOffset > cursor) {
                result += text.slice(cursor, item.startOffset);
            }

            // Items can be either plaintext or macro nodes
            if (item.type === 'plaintext') {
                result += text.slice(item.startOffset, item.endOffset + 1);
                cursor = item.endOffset + 1;
            } else if (item.keepRaw) {
                // Unmatched closing macros stay as raw text
                result += text.slice(item.startOffset, item.endOffset + 1);
                cursor = item.endOffset + 1;
            } else {
                result += this.#evaluateMacroNode(item.node, context, item.scopedContent);
                // If this macro has scoped content, skip past the closing macro
                if (item.scopedContent && item.scopedContent.closingEndOffset > item.endOffset) {
                    cursor = item.scopedContent.closingEndOffset + 1;
                } else {
                    cursor = item.endOffset + 1;
                }
            }
        }

        if (cursor < text.length) {
            result += text.slice(cursor);
        }

        return result;
    }

    /**
     * Extracts basic info from a macro CST node: name, closing flag, position, and argument count.
     * Returns null for variable expressions or nodes without valid identifiers.
     *
     * @param {CstNode} macroNode - A macro CST node from the parser.
     * @returns {MacroNodeInfo | null}
     */
    extractMacroInfo(macroNode) {
        const children = macroNode?.children || {};

        // Variable expressions don't have standard macro identifiers
        if ((children.variableExpr || [])[0]) {
            return null;
        }

        // Get start/end tokens for position
        const startToken = /** @type {IToken?} */ ((children['Macro.Start'] || [])[0]);
        const endToken = /** @type {IToken?} */ ((children['Macro.End'] || [])[0]);
        if (!startToken || !endToken) {
            return null;
        }

        // Get identifier and arguments from macroBody
        const macroBodyNode = /** @type {CstNode?} */ ((children.macroBody || [])[0]);
        const bodyChildren = macroBodyNode?.children || {};
        const identifierTokens = /** @type {IToken[]} */ (bodyChildren['Macro.identifier'] || []);
        const name = identifierTokens[0]?.image || '';

        if (!name) return null;

        // Count arguments (arguments rule contains argument nodes)
        const argumentsNode = /** @type {CstNode?} */ ((bodyChildren.arguments || [])[0]);
        const argumentNodes = /** @type {CstNode[]} */ (argumentsNode?.children?.argument || []);
        const argCount = argumentNodes.length;

        // Check for closing block flag
        const flagTokens = /** @type {IToken[]} */ (children.flags || []);
        const isClosing = flagTokens.some(token => token.image === MacroFlagType.CLOSING_BLOCK);

        return {
            name,
            isClosing,
            startOffset: startToken.startOffset,
            endOffset: endToken.endOffset,
            argCount,
        };
    }

    /**
     * Finds unclosed scoped macros in a document CST.
     * Used by autocomplete to suggest closing tags.
     *
     * @param {Object} options
     * @param {string} options.text - The document text.
     * @param {CstNode} options.cst - The parsed CST.
     * @returns {Array<{ name: string, startOffset: number, endOffset: number, paddingBefore: string, paddingAfter: string }>} - Array of unclosed macro info, innermost last.
     */
    findUnclosedScopes(options) {
        const { text, cst } = options;

        if (typeof text !== 'string' || !cst?.children) {
            return [];
        }

        let items = this.#collectDocumentItems(cst);
        // Don't process scoped macros - we want to find the raw opening/closing pairs
        // Just extract macro info and find unmatched openers

        /** @type {Array<{ name: string, startOffset: number, endOffset: number, paddingBefore: string, paddingAfter: string }>} */
        const unclosedStack = [];

        // Extract macro names and closing status
        for (const item of items) {
            if (item.type !== 'macro') continue;

            const info = this.#extractMacroInfo(item.node);
            if (!info) continue;

            if (info.isClosing) {
                // Find matching opener in stack (case-insensitive)
                // When closing an outer scope, all inner unclosed scopes are implicitly closed
                const matchIndex = unclosedStack.findLastIndex(s => s.name.toLowerCase() === info.name.toLowerCase());
                if (matchIndex !== -1) {
                    // Pop everything from matchIndex to end (inclusive) - closes the matched scope and all nested ones
                    unclosedStack.splice(matchIndex);
                }
                // If no matching opener, ignore (orphan closing tag)
            } else {
                // Opening tag - check if this macro can accept scoped content
                if (this.#canAcceptScopedContent(item.node, info.name)) {
                    // Extract whitespace padding from the macro
                    const { paddingBefore, paddingAfter } = this.#extractMacroPadding(item.node, text);

                    unclosedStack.push({
                        name: info.name,
                        startOffset: item.startOffset,
                        endOffset: item.endOffset,
                        paddingBefore,
                        paddingAfter,
                    });
                }
            }
        }

        return unclosedStack;
    }

    /**
     * Extracts the whitespace padding from a macro node.
     * Returns the whitespace after {{ and before }}.
     *
     * @param {CstNode} macroNode - The macro CST node.
     * @param {string} text - The source text.
     * @returns {{ paddingBefore: string, paddingAfter: string }}
     */
    #extractMacroPadding(macroNode, text) {
        const children = macroNode.children || {};
        const startToken = /** @type {IToken?} */ ((children['Macro.Start'] || [])[0]);
        const endToken = /** @type {IToken?} */ ((children['Macro.End'] || [])[0]);

        if (!startToken || !endToken) {
            return { paddingBefore: '', paddingAfter: '' };
        }

        // Get the raw text inside the macro (between {{ and }})
        const innerStart = startToken.endOffset + 1;
        const innerEnd = endToken.startOffset;
        const innerText = text.slice(innerStart, innerEnd);

        // Extract leading whitespace (paddingBefore)
        const leadingMatch = innerText.match(/^(\s*)/);
        const paddingBefore = leadingMatch ? leadingMatch[1] : '';

        // Extract trailing whitespace (paddingAfter)
        const trailingMatch = innerText.match(/(\s*)$/);
        const paddingAfter = trailingMatch ? trailingMatch[1] : '';

        return { paddingBefore, paddingAfter };
    }

    /** @typedef {{ type: 'plaintext', startOffset: number, endOffset: number, token: IToken }} DocumentItemPlaintext */
    /** @typedef {{ type: 'macro', startOffset: number, endOffset: number, node: CstNode, scopedContent?: { startOffset: number, endOffset: number, closingEndOffset: number }, keepRaw?: boolean }} DocumentItemMacro */
    /** @typedef {DocumentItemPlaintext | DocumentItemMacro} DocumentItem */

    /**
     * Collects top-level plaintext tokens and macro nodes from the document CST.
     *
     * @param {CstNode} cst
     * @returns {Array<DocumentItem>}
     */
    #collectDocumentItems(cst) {
        const plaintextTokens = /** @type {IToken[]} */ (cst.children.plaintext || []);
        const macroNodes = /** @type {CstNode[]} */ (cst.children.macro || []);

        /** @type {Array<DocumentItem>} */
        const items = [];

        for (const token of plaintextTokens) {
            if (typeof token.startOffset !== 'number' || typeof token.endOffset !== 'number') {
                continue;
            }

            items.push({
                type: 'plaintext',
                startOffset: token.startOffset,
                endOffset: token.endOffset,
                token,
            });
        }

        for (const macroNode of macroNodes) {
            const children = macroNode.children || {};
            const endToken = /** @type {IToken?} */ ((children['Macro.End'] || [])[0]);

            // If the end token was inserted during error recovery, treat this macro as plaintext
            if (this.#isRecoveryToken(endToken)) {
                // Flatten the incomplete macro: collect its tokens as plaintext but keep nested macros
                this.#flattenIncompleteMacro(macroNode, endToken, items);
                continue;
            }

            const range = this.#getMacroRange(macroNode);
            items.push({
                type: 'macro',
                startOffset: range.startOffset,
                endOffset: range.endOffset,
                node: macroNode,
            });
        }

        items.sort((a, b) => {
            if (a.startOffset !== b.startOffset) {
                return a.startOffset - b.startOffset;
            }
            return a.endOffset - b.endOffset;
        });

        return items;
    }

    /**
     * Evaluates a single macro CST node, resolving any nested macros first.
     *
     * @param {CstNode} macroNode
     * @param {EvaluationContext} context
     * @param {{ startOffset: number, endOffset: number, closingEndOffset: number }} [scopedContent] - Optional scoped content range for block macros.
     * @returns {string}
     */
    #evaluateMacroNode(macroNode, context, scopedContent) {
        const { text, contextOffset, env, resolveMacro, trimContent } = context;

        const children = macroNode.children || {};

        // Check if this is a variable expression (has variableExpr child)
        const variableExprNode = /** @type {CstNode?} */ ((children.variableExpr || [])[0]);
        if (variableExprNode) {
            return this.#evaluateVariableExpr(macroNode, variableExprNode, context);
        }

        // Regular macro - get identifier from macroBody
        const macroBodyNode = /** @type {CstNode?} */ ((children.macroBody || [])[0]);
        const bodyChildren = macroBodyNode?.children || {};
        const identifierTokens = /** @type {IToken[]} */ (bodyChildren['Macro.identifier'] || []);
        const name = identifierTokens[0]?.image || '';

        // Extract flag tokens and parse them into a MacroFlags object (now inside macroBody)
        const flagTokens = /** @type {IToken[]} */ (children.flags || []);
        const flagSymbols = flagTokens.map(token => token.image);
        const flags = flagSymbols.length > 0 ? parseFlags(flagSymbols) : createEmptyFlags();

        const range = this.#getMacroRange(macroNode);
        const startToken = /** @type {IToken?} */ ((children['Macro.Start'] || [])[0]);
        const endToken = /** @type {IToken?} */ ((children['Macro.End'] || [])[0]);

        const innerStart = startToken ? startToken.endOffset + 1 : range.startOffset;
        const innerEnd = endToken ? endToken.startOffset - 1 : range.endOffset;

        // Extract argument nodes from the "arguments" rule (if present, inside macroBody)
        const argumentsNode = /** @type {CstNode?} */ ((bodyChildren.arguments || [])[0]);
        const argumentNodes = /** @type {CstNode[]} */ (argumentsNode?.children?.argument || []);

        // Check if this macro has delayArgResolution flag - if so, skip nested macro evaluation
        const macroDef = MacroRegistry.getMacro(name);
        const delayArgResolution = macroDef?.delayArgResolution === true;

        /** @type {string[]} */
        const args = [];
        /** @type {({ value: string } & TokenRange)[]} */
        const evaluatedArguments = [];
        /** @type {string[]} */
        const rawArgs = [];

        for (const argNode of argumentNodes) {
            const location = this.#getArgumentLocation(argNode);
            const rawArgText = location ? text.slice(location.startOffset, location.endOffset + 1) : '';
            rawArgs.push(rawArgText);

            // If delayArgResolution is true, use raw text; otherwise evaluate nested macros
            const argValue = delayArgResolution ? rawArgText : this.#evaluateArgumentNode(argNode, context);
            args.push(argValue);

            if (location) {
                evaluatedArguments.push({
                    value: argValue,
                    ...location,
                });
            }
        }

        // If this macro has scoped content, evaluate it and append as the last argument
        if (scopedContent) {
            // Handle empty scoped content (when opening and closing are adjacent)
            if (scopedContent.startOffset > scopedContent.endOffset) {
                args.push('');
                rawArgs.push('');
            } else {
                const rawScopedText = text.slice(scopedContent.startOffset, scopedContent.endOffset + 1);
                rawArgs.push(rawScopedText);

                // If delayArgResolution is true, use raw text; otherwise evaluate nested macros
                let scopedValue;
                if (delayArgResolution) {
                    scopedValue = rawScopedText;
                } else {
                    scopedValue = this.#evaluateScopedContent(scopedContent, context);
                    // Auto-trim scoped content unless the '#' (preserveWhitespace) flag is set
                    if (!flags.preserveWhitespace) {
                        scopedValue = trimContent(scopedValue);
                    }
                }

                args.push(scopedValue);

                // Add to evaluated arguments for rawInner reconstruction
                evaluatedArguments.push({
                    value: scopedValue,
                    startOffset: scopedContent.startOffset,
                    endOffset: scopedContent.endOffset,
                });
            }
        }

        evaluatedArguments.sort((a, b) => a.startOffset - b.startOffset);

        // Build the inner raw string between the braces, with nested macros resolved.
        // This uses the already evaluated argument strings and preserves any text
        // between arguments (such as separators or whitespace).
        let rawInner = '';
        if (innerStart <= innerEnd) {
            let cursor = innerStart;

            for (const entry of evaluatedArguments) {
                if (entry.startOffset > cursor) {
                    rawInner += text.slice(cursor, entry.startOffset);
                }

                rawInner += entry.value;
                cursor = entry.endOffset + 1;
            }

            if (cursor <= innerEnd) {
                rawInner += text.slice(cursor, innerEnd + 1);
            }
        }

        /** @type {MacroCall} */
        const call = {
            name,
            args,
            flags,
            isScoped: scopedContent != null,
            rawInner,
            rawWithBraces: text.slice(range.startOffset, range.endOffset + 1),
            rawArgs,
            range,
            globalOffset: contextOffset + range.startOffset,
            cstNode: macroNode,
            env,
        };

        const value = resolveMacro(call);
        const stringValue = typeof value === 'string' ? value : String(value ?? '');

        return stringValue;
    }

    /**
     * Evaluates a variable expression node using direct variable API calls.
     * Supports operators: get, set (=), add (+=), sub (-=), inc (++), dec (--),
     * logical or (||), nullish coalescing (??), logical or assign (||=),
     * nullish coalescing assign (??=), and equality comparison (==).
     *
     * @param {CstNode} macroNode - The parent macro node.
     * @param {CstNode} variableExprNode - The variableExpr CST node.
     * @param {EvaluationContext} context - The evaluation context.
     * @returns {string}
     */
    #evaluateVariableExpr(macroNode, variableExprNode, context) {
        const varChildren = variableExprNode.children || {};

        // Extract scope (. for local, $ for global)
        const localPrefixToken = /** @type {IToken?} */ ((varChildren['Var.scope'] || []).find(t => /** @type {IToken} */(t).tokenType?.name === 'Var.LocalPrefix'));
        const isGlobal = !localPrefixToken;

        // Extract variable name
        const varIdentifierToken = /** @type {IToken?} */ ((varChildren['Var.identifier'] || [])[0]);
        const varName = varIdentifierToken?.image || '';

        // Extract operator (if any)
        const operatorNode = /** @type {CstNode?} */ ((varChildren.variableOperator || [])[0]);
        const operatorChildren = operatorNode?.children || {};

        // Determine operation and whether a value expression is expected
        let operation = 'get';
        let hasValueExpr = false;

        if (operatorNode) {
            const operatorTokens = /** @type {IToken[]} */ (operatorChildren['Var.operator'] || []);
            const operatorToken = operatorTokens[0];

            if (operatorToken) {
                const operatorImage = operatorToken.image;
                switch (operatorImage) {
                    case '++':
                        operation = 'inc';
                        break;
                    case '--':
                        operation = 'dec';
                        break;
                    case '=':
                        operation = 'set';
                        hasValueExpr = true;
                        break;
                    case '+=':
                        operation = 'add';
                        hasValueExpr = true;
                        break;
                    case '-=':
                        operation = 'sub';
                        hasValueExpr = true;
                        break;
                    case '||':
                        operation = 'logicalOr';
                        hasValueExpr = true;
                        break;
                    case '??':
                        operation = 'nullishCoalescing';
                        hasValueExpr = true;
                        break;
                    case '||=':
                        operation = 'logicalOrAssign';
                        hasValueExpr = true;
                        break;
                    case '??=':
                        operation = 'nullishCoalescingAssign';
                        hasValueExpr = true;
                        break;
                    case '==':
                        operation = 'equals';
                        hasValueExpr = true;
                        break;
                    case '!=':
                        operation = 'notEquals';
                        hasValueExpr = true;
                        break;
                    case '>':
                        operation = 'greaterThan';
                        hasValueExpr = true;
                        break;
                    case '>=':
                        operation = 'greaterThanOrEqual';
                        hasValueExpr = true;
                        break;
                    case '<':
                        operation = 'lessThan';
                        hasValueExpr = true;
                        break;
                    case '<=':
                        operation = 'lessThanOrEqual';
                        hasValueExpr = true;
                        break;
                    default:
                        logMacroInternalError({ message: `Lexer found macro operator that is not implemented for variable shorthand expressions in macro node '${macroNode.name}'.` });
                        break;
                }
            }
        }

        // Create a lazy value resolver that caches its result on first call.
        // This ensures the value expression is only evaluated when actually needed,
        // which is important for performance and because some macros are stateful.
        const lazyValue = hasValueExpr ? this.#createLazyValue(operatorChildren, context) : () => '';

        // Execute the operation using direct variable API calls
        return this.#executeVariableOperation(varName, isGlobal, operation, lazyValue);
    }

    /**
     * Creates a lazy value resolver that caches its result on first call.
     * This ensures the value expression is only evaluated when actually needed.
     *
     * @param {Record<string, any>} operatorChildren - The children of the variableOperator node.
     * @param {EvaluationContext} context - The evaluation context.
     * @returns {() => string} A function that returns the evaluated value, caching the result.
     */
    #createLazyValue(operatorChildren, context) {
        let cached = null;
        let resolved = false;

        return () => {
            if (!resolved) {
                cached = this.#evaluateVariableValue(operatorChildren, context);
                resolved = true;
            }
            return cached;
        };
    }

    /**
     * Executes a variable operation using the SillyTavern context API.
     *
     * @param {string} varName - The variable name.
     * @param {boolean} isGlobal - Whether this is a global ($) or local (.) variable.
     * @param {string} operation - The operation to perform.
     * @param {() => string} lazyValue - A lazy function that returns the value when called. Only evaluated when needed.
     * @returns {string} The result of the operation.
     */
    #executeVariableOperation(varName, isGlobal, operation, lazyValue) {
        const ctx = SillyTavern.getContext();
        const vars = isGlobal ? ctx.variables.global : ctx.variables.local;

        /**
        * Normalizes macro results into a string.
        * @param {any} value
        * @returns {string}
        */
        const normalize = MacroEngine.normalizeMacroResult.bind(MacroEngine);

        /**
         * Checks if a value is falsy (empty string, 0, '0', false, 'false', null, undefined).
         * @param {any} val
         * @returns {boolean}
         */
        const isFalsy = (val) => !val || isFalseBoolean(normalize(val));

        switch (operation) {
            case 'get':
                return normalize(vars.get(varName));

            case 'set':
                vars.set(varName, lazyValue());
                return '';

            case 'inc':
                return normalize(vars.inc(varName));

            case 'dec':
                return normalize(vars.dec(varName));

            case 'add':
                vars.add(varName, lazyValue());
                return '';

            case 'sub': {
                // Subtract by adding the negative value
                const numValue = Number(lazyValue());
                if (!isNaN(numValue)) vars.add(varName, -numValue);
                else logMacroRuntimeWarning({ message: `Variable shorthand "-=" operator requires a numeric value, got: "${lazyValue()}"` });
                return '';
            }

            case 'logicalOr': {
                // Returns default value if variable is falsy, otherwise returns variable value
                // Value is only resolved if needed (when variable is falsy)
                const currentValue = vars.get(varName);
                return isFalsy(currentValue) ? normalize(lazyValue()) : normalize(currentValue);
            }

            case 'nullishCoalescing': {
                // Returns default value only if variable doesn't exist, otherwise returns variable value (even if falsy)
                // Value is only resolved if needed (when variable doesn't exist)
                const exists = vars.has(varName);
                return exists ? normalize(vars.get(varName)) : normalize(lazyValue());
            }

            case 'logicalOrAssign': {
                // If variable is falsy, set it to value and return value; otherwise return current value
                // Value is only resolved if needed (when variable is falsy)
                const currentValue = vars.get(varName);
                if (isFalsy(currentValue)) {
                    vars.set(varName, lazyValue());
                    return normalize(lazyValue());
                }
                return normalize(currentValue);
            }

            case 'nullishCoalescingAssign': {
                // If variable doesn't exist, set it to value and return value; otherwise return current value
                // Value is only resolved if needed (when variable doesn't exist)
                const exists = vars.has(varName);
                if (!exists) {
                    vars.set(varName, lazyValue());
                    return normalize(lazyValue());
                }
                return normalize(vars.get(varName));
            }

            case 'equals': {
                // String equality comparison - value is always needed
                const currentValue = normalize(vars.get(varName));
                const compareValue = normalize(lazyValue());
                return currentValue === compareValue ? 'true' : 'false';
            }

            case 'notEquals': {
                // String inequality comparison - value is always needed
                const currentValue = normalize(vars.get(varName));
                const compareValue = normalize(lazyValue());
                return currentValue !== compareValue ? 'true' : 'false';
            }

            case 'greaterThan': {
                // Numeric greater than comparison
                const currentNum = Number(vars.get(varName));
                const compareNum = Number(lazyValue());
                if (isNaN(currentNum) || isNaN(compareNum)) {
                    logMacroRuntimeWarning({ message: `Variable shorthand ">" operator requires numeric values. Got: "${vars.get(varName)}" > "${lazyValue()}"` });
                    return 'false';
                }
                return currentNum > compareNum ? 'true' : 'false';
            }

            case 'greaterThanOrEqual': {
                // Numeric greater than or equal comparison
                const currentNum = Number(vars.get(varName));
                const compareNum = Number(lazyValue());
                if (isNaN(currentNum) || isNaN(compareNum)) {
                    logMacroRuntimeWarning({ message: `Variable shorthand ">=" operator requires numeric values. Got: "${vars.get(varName)}" >= "${lazyValue()}"` });
                    return 'false';
                }
                return currentNum >= compareNum ? 'true' : 'false';
            }

            case 'lessThan': {
                // Numeric less than comparison
                const currentNum = Number(vars.get(varName));
                const compareNum = Number(lazyValue());
                if (isNaN(currentNum) || isNaN(compareNum)) {
                    logMacroRuntimeWarning({ message: `Variable shorthand "<" operator requires numeric values. Got: "${vars.get(varName)}" < "${lazyValue()}"` });
                    return 'false';
                }
                return currentNum < compareNum ? 'true' : 'false';
            }

            case 'lessThanOrEqual': {
                // Numeric less than or equal comparison
                const currentNum = Number(vars.get(varName));
                const compareNum = Number(lazyValue());
                if (isNaN(currentNum) || isNaN(compareNum)) {
                    logMacroRuntimeWarning({ message: `Variable shorthand "<=" operator requires numeric values. Got: "${vars.get(varName)}" <= "${lazyValue()}"` });
                    return 'false';
                }
                return currentNum <= compareNum ? 'true' : 'false';
            }

            default:
                logMacroRuntimeWarning({ message: `Unknown variable shorthand operation: "${operation}"` });
                return '';
        }
    }

    /**
     * Evaluates the value part of a variable expression (after = or +=).
     * Resolves any nested macros in the value.
     *
     * @param {Record<string, any>} operatorChildren - The children of the variableOperator node.
     * @param {EvaluationContext} context - The evaluation context.
     * @returns {string}
     */
    #evaluateVariableValue(operatorChildren, context) {
        const { text } = context;

        const valueNodes = /** @type {CstNode[]} */ (operatorChildren['Var.value'] || []);
        const valueNode = valueNodes[0];

        if (!valueNode) {
            return '';
        }

        const valueChildren = valueNode.children || {};

        // Get all tokens and nested macros from the value
        const identifierTokens = /** @type {IToken[]} */ (valueChildren.Identifier || []);
        const unknownTokens = /** @type {IToken[]} */ (valueChildren.Unknown || []);
        const nestedMacros = /** @type {CstNode[]} */ (valueChildren.macro || []);

        // Get the range of the value
        const allTokens = [...identifierTokens, ...unknownTokens];
        const allRanges = [
            ...allTokens.map(t => ({ startOffset: t.startOffset, endOffset: t.endOffset })),
            ...nestedMacros.map(m => this.#getMacroRange(m)),
        ];

        if (allRanges.length === 0) {
            return '';
        }

        const startOffset = Math.min(...allRanges.map(r => r.startOffset));
        const endOffset = Math.max(...allRanges.map(r => r.endOffset));

        // If no nested macros, return the raw text (trimmed)
        if (nestedMacros.length === 0) {
            return text.slice(startOffset, endOffset + 1).trim();
        }

        // Evaluate nested macros
        const nestedWithRange = nestedMacros.map(node => ({
            node,
            range: this.#getMacroRange(node),
        }));

        nestedWithRange.sort((a, b) => a.range.startOffset - b.range.startOffset);

        let result = '';
        let cursor = startOffset;

        for (const entry of nestedWithRange) {
            if (entry.range.startOffset > cursor) {
                result += text.slice(cursor, entry.range.startOffset);
            }
            result += this.#evaluateMacroNode(entry.node, context);
            cursor = entry.range.endOffset + 1;
        }

        if (cursor <= endOffset) {
            result += text.slice(cursor, endOffset + 1);
        }

        return result.trim();
    }

    /**
     * Evaluates a single argument node by resolving nested macros and reconstructing
     * the original argument text.
     *
     * This method extracts the argument's raw text and re-parses it to properly
     * handle scoped macros (opening/closing tag pairs) that may appear within
     * the argument content.
     *
     * @param {CstNode} argNode - The argument CST node to evaluate.
     * @param {EvaluationContext} context - The evaluation context containing the parent document's text and environment.
     * @returns {string} The evaluated argument with all nested macros (including scoped ones) resolved.
     */
    #evaluateArgumentNode(argNode, context) {
        const location = this.#getArgumentLocation(argNode);
        if (!location) {
            return '';
        }

        const { text, contextOffset } = context;
        const rawContent = text.slice(location.startOffset, location.endOffset + 1);

        // Calculate the new base offset: parent's contextOffset + this argument's start position
        const newContextOffset = contextOffset + location.startOffset;

        // Use the shared helper to evaluate the content, which handles scoped macros
        return this.#evaluateRawContent(rawContent, newContextOffset, context);
    }

    /**
     * Evaluates a text content string by parsing it and resolving all macros,
     * including scoped macro pairs (opening/closing tags).
     *
     * This is the core helper used by both argument evaluation and scoped content
     * evaluation to ensure consistent handling of nested and scoped macros.
     *
     * @param {string} rawContent - The raw text content to evaluate.
     * @param {number} newContextOffset - The offset of rawContent's start position in the original top-level document.
     * @param {EvaluationContext} context - The parent evaluation context (used for env, resolveMacro, trimContent).
     * @returns {string} The evaluated content with all macros resolved.
     */
    #evaluateRawContent(rawContent, newContextOffset, context) {
        // If empty, return as-is
        if (!rawContent) {
            return '';
        }

        // Re-evaluate the content to find all nested macros including scoped pairs
        // We need to parse and evaluate this content as if it were a standalone document
        const { cst } = MacroParser.parseDocument(rawContent);

        // If parsing fails, return the raw content
        if (!cst || typeof cst !== 'object' || !cst.children) {
            return rawContent;
        }

        // Create a new context with the content as the text and updated contextOffset
        // This is important: positions in the parsed CST are relative to rawContent,
        // but contextOffset tracks the absolute position in the original document
        /** @type {EvaluationContext} */
        const contentContext = { ...context, text: rawContent, contextOffset: newContextOffset };

        // Collect items and process scoped macros
        let items = this.#collectDocumentItems(cst);
        items = this.#processScopedMacros(items, rawContent);

        // If no items, return raw content
        if (items.length === 0) {
            return rawContent;
        }

        // Evaluate items in order
        let result = '';
        let cursor = 0;

        for (const item of items) {
            if (item.startOffset > cursor) {
                result += rawContent.slice(cursor, item.startOffset);
            }

            if (item.type === 'plaintext') {
                result += rawContent.slice(item.startOffset, item.endOffset + 1);
                cursor = item.endOffset + 1;
            } else if (item.keepRaw) {
                // Unmatched closing macros stay as raw text
                result += rawContent.slice(item.startOffset, item.endOffset + 1);
                cursor = item.endOffset + 1;
            } else {
                result += this.#evaluateMacroNode(item.node, contentContext, item.scopedContent);
                // If this macro has scoped content, skip past the closing macro
                if (item.scopedContent && item.scopedContent.closingEndOffset > item.endOffset) {
                    cursor = item.scopedContent.closingEndOffset + 1;
                } else {
                    cursor = item.endOffset + 1;
                }
            }
        }

        if (cursor < rawContent.length) {
            result += rawContent.slice(cursor);
        }

        return result;
    }

    /**
     * Computes the character range of a macro node based on its start/end tokens
     * or its own location if those are not available.
     *
     * @param {CstNode} macroNode
     * @returns {TokenRange}
     */
    #getMacroRange(macroNode) {
        const startToken = /** @type {IToken?} */ (((macroNode.children || {})['Macro.Start'] || [])[0]);
        const endToken = /** @type {IToken?} */ (((macroNode.children || {})['Macro.End'] || [])[0]);

        if (startToken && endToken) {
            return { startOffset: startToken.startOffset, endOffset: endToken.endOffset };
        }
        if (macroNode.location) {
            return { startOffset: macroNode.location.startOffset, endOffset: macroNode.location.endOffset };
        }
        return { startOffset: 0, endOffset: 0 };
    }

    /**
     * Flattens an incomplete macro node into document items.
     * Tokens from the incomplete macro become plaintext, but nested complete macros are preserved.
     *
     * @param {CstNode} macroNode
     * @param {IToken} excludeToken - The recovery-inserted token to exclude
     * @param {Array<DocumentItem>} items - The items array to add to
     */
    #flattenIncompleteMacro(macroNode, excludeToken, items) {
        const children = macroNode.children || {};

        for (const key of Object.keys(children)) {
            for (const element of children[key] || []) {
                // Skip the recovery-inserted token
                if (element === excludeToken) continue;

                // Handle IToken - add as plaintext
                if ('startOffset' in element && typeof element.startOffset === 'number') {
                    items.push({
                        type: 'plaintext',
                        startOffset: element.startOffset,
                        endOffset: element.endOffset ?? element.startOffset,
                        token: element,
                    });
                }
                // Handle nested CstNode (macro or argument)
                else if ('children' in element) {
                    const nestedChildren = element.children || {};
                    const nestedEnd = /** @type {IToken?} */ ((nestedChildren['Macro.End'] || [])[0]);
                    const nestedStart = /** @type {IToken?} */ ((nestedChildren['Macro.Start'] || [])[0]);

                    // Check if this is a complete macro node
                    if (nestedStart && nestedEnd) {
                        if (!this.#isRecoveryToken(nestedEnd)) {
                            // Complete nested macro - add as macro item
                            const range = this.#getMacroRange(element);
                            items.push({
                                type: 'macro',
                                startOffset: range.startOffset,
                                endOffset: range.endOffset,
                                node: element,
                            });
                        } else {
                            // Another incomplete nested macro - recurse
                            this.#flattenIncompleteMacro(element, nestedEnd, items);
                        }
                    } else {
                        // Not a macro node (e.g., arguments, argument) - recurse into it
                        this.#flattenIncompleteMacro(element, excludeToken, items);
                    }
                }
            }
        }
    }

    /**
     * Checks if a token was inserted during Chevrotain's error recovery.
     * Recovery tokens have `isInsertedInRecovery=true` or invalid offset values.
     *
     * @param {IToken|null|undefined} token
     * @returns {boolean}
     */
    #isRecoveryToken(token) {
        return token?.isInsertedInRecovery === true
            || typeof token?.startOffset !== 'number'
            || Number.isNaN(token?.startOffset);
    }

    /**
     * Computes the character range of an argument node based on all its child
     * tokens and nested macros.
     *
     * @param {CstNode} argNode
     * @returns {TokenRange|null}
     */
    #getArgumentLocation(argNode) {
        const children = argNode.children || {};
        let startOffset = Number.POSITIVE_INFINITY;
        let endOffset = Number.NEGATIVE_INFINITY;

        for (const key of Object.keys(children)) {
            for (const element of children[key] || []) {
                if (this.#isCstNode(element)) {
                    const location = element.location;
                    if (!location) {
                        continue;
                    }

                    if (location.startOffset < startOffset) {
                        startOffset = location.startOffset;
                    }
                    if (location.endOffset > endOffset) {
                        endOffset = location.endOffset;
                    }
                } else if (element) {
                    if (element.startOffset < startOffset) {
                        startOffset = element.startOffset;
                    }
                    if (element.endOffset > endOffset) {
                        endOffset = element.endOffset;
                    }
                }
            }
        }

        if (!Number.isFinite(startOffset) || !Number.isFinite(endOffset)) {
            return null;
        }

        return { startOffset, endOffset };
    }

    /**
     * Determines whether the given value is a CST node.
     *
     * @param {any} value
     * @returns {value is CstNode}
     */
    #isCstNode(value) {
        return !!value && typeof value === 'object' && 'name' in value && 'children' in value;
    }

    /**
     * Evaluates scoped content between an opening and closing macro tag.
     * This resolves any nested macros within the scoped content.
     *
     * @param {{ startOffset: number, endOffset: number }} scopedContent - The range of the scoped content.
     * @param {EvaluationContext} context - The evaluation context. The `text` property contains the parent
     *        document text, and offsets in scopedContent are relative to that parent text.
     * @returns {string} - The evaluated scoped content with nested macros resolved.
     */
    #evaluateScopedContent(scopedContent, context) {
        const { text, contextOffset } = context;
        const { startOffset, endOffset } = scopedContent;

        // Extract the raw content between opening and closing tags
        const rawContent = text.slice(startOffset, endOffset + 1);

        // Calculate the new base offset: parent's contextOffset + this scoped content's start position
        const newContextOffset = contextOffset + startOffset;

        // Use the shared helper to evaluate the content
        return this.#evaluateRawContent(rawContent, newContextOffset, context);
    }

    // ========================================================================
    // Scoped Macro Processing
    // ========================================================================

    /**
     * Processes document items to find and merge scoped macro pairs.
     * A scoped macro is an opening macro followed by content and a closing macro.
     * Example: `{{setvar::myvar}}content{{/setvar}}` becomes `{{setvar::myvar::content}}`
     *
     * The closing macro has the `closingBlock` flag (`/`) and the same identifier.
     * Everything between the opening and closing macros becomes the last unnamed argument.
     *
     * @param {Array<DocumentItem>} items - The collected document items.
     * @param {string} text - The original document text.
     * @returns {Array<DocumentItem>} - The processed items with scoped macros merged.
     */
    #processScopedMacros(items, text) {
        // Build a list of scoped macro info for each macro item
        /** @type {Array<{ index: number, item: DocumentItemMacro, name: string, isClosing: boolean, matched: boolean }>} */
        const macroInfos = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type !== 'macro') continue;

            const info = this.#extractMacroInfo(item.node);
            if (!info) continue;

            macroInfos.push({
                index: i,
                item,
                name: info.name,
                isClosing: info.isClosing,
                matched: false,
            });
        }

        // Find matching pairs - only process OUTERMOST scopes at this level
        // Nested scopes will be discovered when parent's scoped content is re-parsed
        /** @type {Array<{ openingIndex: number, closingIndex: number }>} */
        const pairs = [];

        // Track ranges that are inside a scope (to skip nested openers)
        /** @type {Set<number>} */
        const insideScope = new Set();

        for (let i = 0; i < macroInfos.length; i++) {
            const openInfo = macroInfos[i];

            // Skip closing macros, already matched macros, or macros inside another scope
            if (openInfo.isClosing || openInfo.matched || insideScope.has(openInfo.index)) continue;

            // Find the matching closing macro for this opening macro
            const closingIdx = this.#findMatchingClosingMacro(macroInfos, i);
            if (closingIdx === -1) continue;

            // Check if the macro can accept scoped content (arity validation)
            if (!this.#canAcceptScopedContent(openInfo.item.node, openInfo.name)) {
                // Macro cannot accept scoped content - mark both as keepRaw
                openInfo.item.keepRaw = true;
                macroInfos[closingIdx].item.keepRaw = true;
                // Mark as matched so they won't be processed again
                openInfo.matched = true;
                macroInfos[closingIdx].matched = true;
                continue;
            }

            // Mark both as matched
            openInfo.matched = true;
            macroInfos[closingIdx].matched = true;

            const closingIndex = macroInfos[closingIdx].index;

            pairs.push({
                openingIndex: openInfo.index,
                closingIndex: closingIndex,
            });

            // Mark all items between this pair as inside a scope
            // They will be processed when the scoped content is re-parsed
            for (let j = openInfo.index + 1; j < closingIndex; j++) {
                insideScope.add(j);
            }
        }

        // Mark unmatched closing macros as keepRaw so they stay as raw text
        for (const info of macroInfos) {
            if (info.isClosing && !info.matched) {
                info.item.keepRaw = true;
            }
        }

        // If no pairs found, return items (with unmatched closings marked as raw)
        if (pairs.length === 0) {
            return items;
        }

        // Process pairs: merge content into opening macro's scopedContent field

        // Track which items to remove (closing macros and intermediate content items)
        /** @type {Set<number>} */
        const itemsToRemove = new Set();

        for (const pair of pairs) {
            const openingItem = /** @type {DocumentItemMacro} */ (items[pair.openingIndex]);
            const closingItem = /** @type {DocumentItemMacro} */ (items[pair.closingIndex]);

            // Collect content between opening and closing (exclusive)
            const contentStart = openingItem.endOffset + 1;
            const contentEnd = closingItem.startOffset - 1;

            // Store the scoped content range on the opening macro item
            // This will be used during macro evaluation to append the content as the last argument
            openingItem.scopedContent = {
                startOffset: contentStart,
                endOffset: contentEnd,
                closingEndOffset: closingItem.endOffset,
            };

            // Mark closing macro for removal
            itemsToRemove.add(pair.closingIndex);

            // Mark ALL intermediate items between opening and closing for removal
            // They will be captured as raw scoped content and re-parsed during evaluation
            for (let j = pair.openingIndex + 1; j < pair.closingIndex; j++) {
                itemsToRemove.add(j);
            }
        }

        // Filter out removed items
        return items.filter((_, index) => !itemsToRemove.has(index));
    }

    /**
     * Extracts macro name and closing flag status from a macro node.
     *
     * @param {CstNode} macroNode
     * @returns {{ name: string, isClosing: boolean } | null}
     */
    #extractMacroInfo(macroNode) {
        const children = macroNode.children || {};

        // Check if this is a variable expression - they can't be scoped
        const variableExprNode = (children.variableExpr || [])[0];
        if (variableExprNode) {
            return null; // Variable expressions don't support scoped content
        }

        // Regular macro - get info from macroBody
        const macroBodyNode = /** @type {CstNode?} */ ((children.macroBody || [])[0]);
        const bodyChildren = macroBodyNode?.children || {};

        const identifierTokens = /** @type {IToken[]} */ (bodyChildren['Macro.identifier'] || []);
        const name = identifierTokens[0]?.image || '';

        if (!name) return null;

        // Check for closing block flag (inside macroBody)
        const flagTokens = /** @type {IToken[]} */ (children.flags || []);
        const isClosing = flagTokens.some(token => token.image === MacroFlagType.CLOSING_BLOCK);

        return { name, isClosing };
    }

    /**
     * Checks if a macro can accept scoped content as an additional argument.
     * Returns true if adding one more argument would result in valid arity.
     *
     * @param {CstNode} macroNode - The macro CST node.
     * @param {string} macroName - The macro name.
     * @returns {boolean} - True if scoped content is allowed.
     */
    #canAcceptScopedContent(macroNode, macroName) {
        const def = MacroRegistry.getPrimaryMacro(macroName);
        if (!def) {
            // Unknown macro - allow scoped content (will be handled as unknown macro later)
            return true;
        }

        // Count current arguments in the macro (now inside macroBody)
        const children = macroNode.children || {};
        const macroBodyNode = /** @type {CstNode?} */ ((children.macroBody || [])[0]);
        const bodyChildren = macroBodyNode?.children || {};
        const argumentsNode = /** @type {CstNode?} */ ((bodyChildren.arguments || [])[0]);
        const argumentNodes = /** @type {CstNode[]} */ (argumentsNode?.children?.argument || []);
        const currentArgCount = argumentNodes.length;

        // List-arg macros don't support scoped content - they accept arbitrary inline args instead
        if (def.list) {
            return false;
        }

        // Check if adding 1 more argument (scoped content) would be valid
        const newArgCount = currentArgCount + 1;

        // Without list: newArgCount must be between minArgs and maxArgs
        return newArgCount >= def.minArgs && newArgCount <= def.maxArgs;
    }

    /**
     * Finds the matching closing macro for an opening macro at the given index.
     * Handles nested scopes by tracking depth. Only counts opening macros that
     * can accept scoped content (inline macros with all args filled don't count).
     *
     * @param {Array<{ index: number, item: DocumentItemMacro, name: string, isClosing: boolean, matched: boolean }>} macroInfos
     * @param {number} openingIdx - Index in macroInfos array of the opening macro.
     * @returns {number} - Index in macroInfos array of the matching closing macro, or -1 if not found.
     */
    #findMatchingClosingMacro(macroInfos, openingIdx) {
        const openInfo = macroInfos[openingIdx];
        const targetName = openInfo.name;
        let depth = 1;

        for (let i = openingIdx + 1; i < macroInfos.length; i++) {
            const info = macroInfos[i];

            // Only consider macros with the same name (case-insensitive)
            if (info.name.toLowerCase() !== targetName.toLowerCase()) continue;

            // Skip already matched macros
            if (info.matched) continue;

            if (info.isClosing) {
                depth--;
                if (depth === 0) {
                    return i;
                }
            } else {
                // Only increment depth for opening macros that can accept scoped content
                // Inline macros (e.g., {{if condition::content}}) don't need closing tags
                if (this.#canAcceptScopedContent(info.item.node, info.name)) {
                    depth++;
                }
            }
        }

        return -1; // No matching closing macro found
    }
}

instance = MacroCstWalker.instance;
