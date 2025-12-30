/** @typedef {import('chevrotain').CstNode} CstNode */
/** @typedef {import('chevrotain').IToken} IToken */
/** @typedef {import('./MacroEnv.types.js').MacroEnv} MacroEnv */
/** @typedef {import('./MacroFlags.js').MacroFlags} MacroFlags */

import { parseFlags, createEmptyFlags, MacroFlagType } from './MacroFlags.js';
import { MacroParser } from './MacroParser.js';
import { MacroRegistry } from './MacroRegistry.js';

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
 * @property {{ startOffset: number, endOffset: number }} range
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
 * @typedef {Object} EvaluationContext
 * @property {string} text
 * @property {MacroEnv} env
 * @property {(call: MacroCall) => string} resolveMacro
 * @property {(content: string, options?: { trimIndent?: boolean }) => string} trimContent - Shared utility function that trims scoped content with optional indentation dedent.
 */

/**
 * @typedef {Object} TokenRange
 * @property {number} startOffset
 * @property {number} endOffset
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
        const { text, cst, env, resolveMacro, trimContent } = options;

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
        const context = { text, env, resolveMacro, trimContent };
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
     * Finds unclosed scoped macros in a document CST.
     * Used by autocomplete to suggest closing tags.
     *
     * @param {Object} options
     * @param {string} options.text - The document text.
     * @param {CstNode} options.cst - The parsed CST.
     * @returns {Array<{ name: string, startOffset: number, endOffset: number }>} - Array of unclosed macro info, innermost last.
     */
    findUnclosedScopes(options) {
        const { text, cst } = options;

        if (typeof text !== 'string' || !cst?.children) {
            return [];
        }

        let items = this.#collectDocumentItems(cst);
        // Don't process scoped macros - we want to find the raw opening/closing pairs
        // Just extract macro info and find unmatched openers

        /** @type {Array<{ name: string, startOffset: number, endOffset: number }>} */
        const unclosedStack = [];

        // Extract macro names and closing status
        for (const item of items) {
            if (item.type !== 'macro') continue;

            const info = this.#extractMacroInfo(item.node);
            if (!info) continue;

            if (info.isClosing) {
                // Closing tag - pop matching opener from stack
                if (unclosedStack.length > 0 && unclosedStack[unclosedStack.length - 1].name === info.name) {
                    unclosedStack.pop();
                }
                // If no matching opener, ignore (orphan closing tag)
            } else {
                // Opening tag - check if this macro can accept scoped content
                if (this.#canAcceptScopedContent(item.node, info.name)) {
                    unclosedStack.push({
                        name: info.name,
                        startOffset: item.startOffset,
                        endOffset: item.endOffset,
                    });
                }
            }
        }

        return unclosedStack;
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
        const { text, env, resolveMacro, trimContent } = context;

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

        /** @type {string[]} */
        const args = [];
        /** @type {({ value: string } & TokenRange)[]} */
        const evaluatedArguments = [];
        /** @type {string[]} */
        const rawArgs = [];

        for (const argNode of argumentNodes) {
            const argValue = this.#evaluateArgumentNode(argNode, context);
            args.push(argValue);

            const location = this.#getArgumentLocation(argNode);
            if (location) {
                evaluatedArguments.push({
                    value: argValue,
                    ...location,
                });
            }

            rawArgs.push(location ? text.slice(location.startOffset, location.endOffset + 1) : '');
        }

        // If this macro has scoped content, evaluate it and append as the last argument
        if (scopedContent) {
            // Handle empty scoped content (when opening and closing are adjacent)
            if (scopedContent.startOffset > scopedContent.endOffset) {
                args.push('');
            } else {
                let scopedValue = this.#evaluateScopedContent(scopedContent, context);

                // Auto-trim scoped content unless the '#' (preserveWhitespace) flag is set
                if (!flags.preserveWhitespace) {
                    scopedValue = trimContent(scopedValue);
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
            cstNode: macroNode,
            env,
        };

        const value = resolveMacro(call);
        const stringValue = typeof value === 'string' ? value : String(value ?? '');

        return stringValue;
    }

    /**
     * Evaluates a variable expression node and routes it to the appropriate variable macro.
     *
     * @param {CstNode} macroNode - The parent macro node.
     * @param {CstNode} variableExprNode - The variableExpr CST node.
     * @param {EvaluationContext} context - The evaluation context.
     * @returns {string}
     */
    #evaluateVariableExpr(macroNode, variableExprNode, context) {
        const { text, env, resolveMacro } = context;

        const children = macroNode.children || {};
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

        // Determine operation and value
        let operation = 'get';
        let value = null;

        if (operatorNode) {
            const operatorTokens = /** @type {IToken[]} */ (operatorChildren['Var.operator'] || []);
            const operatorToken = operatorTokens[0];

            if (operatorToken) {
                const operatorImage = operatorToken.image;
                if (operatorImage === '++') {
                    operation = 'inc';
                } else if (operatorImage === '--') {
                    operation = 'dec';
                } else if (operatorImage === '=') {
                    operation = 'set';
                    value = this.#evaluateVariableValue(operatorChildren, context);
                } else if (operatorImage === '+=') {
                    operation = 'add';
                    value = this.#evaluateVariableValue(operatorChildren, context);
                }
            }
        }

        // Map operation to macro name
        const macroNameMap = {
            get: isGlobal ? 'getglobalvar' : 'getvar',
            set: isGlobal ? 'setglobalvar' : 'setvar',
            inc: isGlobal ? 'incglobalvar' : 'incvar',
            dec: isGlobal ? 'decglobalvar' : 'decvar',
            add: isGlobal ? 'addglobalvar' : 'addvar',
        };

        const targetMacroName = macroNameMap[operation];

        // Build args array based on operation
        const args = [varName];
        if (value !== null) {
            args.push(value);
        }

        const range = this.#getMacroRange(macroNode);

        /** @type {MacroCall} */
        const call = {
            name: targetMacroName,
            args,
            flags: createEmptyFlags(),
            isScoped: false,
            isVariableShorthand: true,
            rawInner: text.slice(
                (/** @type {IToken|undefined} */ (children['Macro.Start']?.[0])?.endOffset ?? range.startOffset) + 1,
                (/** @type {IToken|undefined} */ (children['Macro.End']?.[0])?.startOffset ?? range.endOffset + 1) - 1,
            ),
            rawWithBraces: text.slice(range.startOffset, range.endOffset + 1),
            rawArgs: args,
            range,
            cstNode: macroNode,
            env,
        };

        const result = resolveMacro(call);
        return typeof result === 'string' ? result : String(result ?? '');
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
     * @param {CstNode} argNode
     * @param {EvaluationContext} context
     * @returns {string}
     */
    #evaluateArgumentNode(argNode, context) {
        const location = this.#getArgumentLocation(argNode);
        if (!location) {
            return '';
        }

        const { text } = context;

        const nestedMacros = /** @type {CstNode[]} */ ((argNode.children || {}).macro || []);

        // If there are no nested macros, we can just return the original text
        if (nestedMacros.length === 0) {
            return text.slice(location.startOffset, location.endOffset + 1);
        }

        // If there are macros, evaluate them one by one in appearing order, inside the argument, before we return the resolved argument
        const nestedWithRange = nestedMacros.map(node => ({
            node,
            range: this.#getMacroRange(node),
        }));

        nestedWithRange.sort((a, b) => a.range.startOffset - b.range.startOffset);

        let result = '';
        let cursor = location.startOffset;

        for (const entry of nestedWithRange) {
            if (entry.range.startOffset < cursor) {
                continue;
            }

            result += text.slice(cursor, entry.range.startOffset);
            result += this.#evaluateMacroNode(entry.node, context);
            cursor = entry.range.endOffset + 1;
        }

        if (cursor <= location.endOffset) {
            result += text.slice(cursor, location.endOffset + 1);
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
     * @param {EvaluationContext} context - The evaluation context.
     * @returns {string} - The evaluated scoped content with nested macros resolved.
     */
    #evaluateScopedContent(scopedContent, context) {
        const { text, env, resolveMacro, trimContent } = context;
        const { startOffset, endOffset } = scopedContent;

        // Extract the raw content between opening and closing tags
        const rawContent = text.slice(startOffset, endOffset + 1);

        // If empty, return empty string
        if (!rawContent) {
            return '';
        }

        // Re-evaluate the scoped content to resolve any nested macros
        // We need to parse and evaluate this content as if it were a standalone document
        const { cst: scopedCst } = MacroParser.parseDocument(rawContent);

        // If parsing fails, return the raw content
        if (!scopedCst || typeof scopedCst !== 'object' || !scopedCst.children) {
            return rawContent;
        }

        // Create a new context with the scoped content text
        /** @type {EvaluationContext} */
        const scopedContext = { text: rawContent, env, resolveMacro, trimContent };

        // Collect items from the scoped content CST
        let items = this.#collectDocumentItems(scopedCst);

        // Process any nested scoped macros within this content
        items = this.#processScopedMacros(items, rawContent);

        // Evaluate the items
        if (items.length === 0) {
            return rawContent;
        }

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
                result += this.#evaluateMacroNode(item.node, scopedContext, item.scopedContent);
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

        // Check if adding 1 more argument (scoped content) would be valid
        const newArgCount = currentArgCount + 1;

        // Macro must accept at least newArgCount arguments
        // For macros with list args, they can accept unlimited after maxArgs
        if (def.list) {
            // With list: valid if newArgCount >= minArgs (list can absorb extra)
            return newArgCount >= def.minArgs;
        }

        // Without list: newArgCount must be between minArgs and maxArgs
        return newArgCount >= def.minArgs && newArgCount <= def.maxArgs;
    }

    /**
     * Finds the matching closing macro for an opening macro at the given index.
     * Handles nested scopes by tracking depth.
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

            // Only consider macros with the same name
            if (info.name !== targetName) continue;

            // Skip already matched macros
            if (info.matched) continue;

            if (info.isClosing) {
                depth--;
                if (depth === 0) {
                    return i;
                }
            } else {
                // Another opening macro with the same name increases depth
                depth++;
            }
        }

        return -1; // No matching closing macro found
    }
}

instance = MacroCstWalker.instance;
