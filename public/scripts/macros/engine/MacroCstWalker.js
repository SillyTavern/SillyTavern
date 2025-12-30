/** @typedef {import('chevrotain').CstNode} CstNode */
/** @typedef {import('chevrotain').IToken} IToken */
/** @typedef {import('./MacroEnv.types.js').MacroEnv} MacroEnv */

/**
 * @typedef {Object} MacroCall
 * @property {string} name
 * @property {string[]} args
 * @property {MacroEnv} env
 * @property {string} rawInner
 * @property {string} rawWithBraces
 * @property {{ startOffset: number, endOffset: number }} range
 * @property {CstNode} cstNode
 */

/**
 * @typedef {Object} EvaluationContext
 * @property {string} text
 * @property {MacroEnv} env
 * @property {(call: MacroCall) => string} resolveMacro
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
        const { text, cst, env, resolveMacro } = options;

        if (typeof text !== 'string') {
            throw new Error('MacroCstWalker.evaluateDocument: text must be a string');
        }
        if (!cst || typeof cst !== 'object' || !cst.children) {
            throw new Error('MacroCstWalker.evaluateDocument: cst must be a CstNode');
        }
        if (typeof resolveMacro !== 'function') {
            throw new Error('MacroCstWalker.evaluateDocument: resolveMacro must be a function');
        }

        /** @type {EvaluationContext} */
        const context = { text, env, resolveMacro };
        const items = this.#collectDocumentItems(cst);

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
            } else {
                result += this.#evaluateMacroNode(item.node, context);
            }

            cursor = item.endOffset + 1;
        }

        if (cursor < text.length) {
            result += text.slice(cursor);
        }

        return result;
    }

    /** @typedef {{ type: 'plaintext', startOffset: number, endOffset: number, token: IToken }} DocumentItemPlaintext */
    /** @typedef {{ type: 'macro', startOffset: number, endOffset: number, node: CstNode }} DocumentItemMacro */
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
     * @returns {string}
     */
    #evaluateMacroNode(macroNode, context) {
        const { text, env, resolveMacro } = context;

        const children = macroNode.children || {};
        const identifierTokens = /** @type {IToken[]} */ (children['Macro.identifier'] || []);
        const name = identifierTokens[0]?.image || '';

        const range = this.#getMacroRange(macroNode);
        const startToken = /** @type {IToken?} */ ((children['Macro.Start'] || [])[0]);
        const endToken = /** @type {IToken?} */ ((children['Macro.End'] || [])[0]);

        const innerStart = startToken ? startToken.endOffset + 1 : range.startOffset;
        const innerEnd = endToken ? endToken.startOffset - 1 : range.endOffset;

        // Extract argument nodes from the "arguments" rule (if present)
        const argumentsNode = /** @type {CstNode?} */ ((children.arguments || [])[0]);
        const argumentNodes = /** @type {CstNode[]} */ (argumentsNode?.children?.argument || []);

        /** @type {string[]} */
        const args = [];
        /** @type {({ value: string } & TokenRange)[]} */
        const evaluatedArguments = [];

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
            rawInner,
            rawWithBraces: text.slice(range.startOffset, range.endOffset + 1),
            range,
            cstNode: macroNode,
            env,
        };

        const value = resolveMacro(call);
        const stringValue = typeof value === 'string' ? value : String(value ?? '');

        return stringValue;
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
}

instance = MacroCstWalker.instance;
