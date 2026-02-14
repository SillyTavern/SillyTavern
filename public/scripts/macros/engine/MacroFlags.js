/**
 * Macro Execution Flags - modifiers that change how macros are resolved at runtime.
 *
 * Flags are special symbols placed between the opening braces `{{` and the macro identifier.
 * Example: `{{!user}}` - the `!` is an "immediate resolve" flag.
 *
 * Multiple flags can be combined: `{{!?myMacro}}` or `{{ ! ? myMacro }}`
 */

/**
 * @typedef {Object} MacroFlags
 * @property {boolean} immediate - Whether the immediate (`!`) flag is set.
 * @property {boolean} delayed - Whether the delayed (`?`) flag is set.
 * @property {boolean} reevaluate - Whether the re-evaluate (`~`) flag is set.
 * @property {boolean} filter - Whether the filter (`>`) flag is set.
 * @property {boolean} closingBlock - Whether the closing block (`/`) flag is set.
 * @property {boolean} preserveWhitespace - Whether the preserve whitespace (`#`) flag is set.
 * @property {string[]} raw - The raw flag symbols in order of appearance.
 */

/**
 * Enum of all recognized macro execution flags.
 *
 * @readonly
 * @enum {string}
 */
export const MacroFlagType = Object.freeze({
    /**
     * Immediate resolve flag (`!`).
     * This macro will be resolved first (in order of appearance) before "normal" macros.
     * @status TBD - Not implemented in v1
     */
    IMMEDIATE: '!',

    /**
     * Delayed resolve flag (`?`).
     * This macro will be resolved last (in order of appearance) after "normal" macros.
     * @status TBD - Not implemented in v1
     */
    DELAYED: '?',

    /**
     * Re-evaluate flag (`~`).
     * Marks a macro for potential re-evaluation.
     * @status TBD - Not implemented in v1
     */
    REEVALUATE: '~',

    /**
     * Filter/pipe flag (`>`).
     * Indicates that this macro should resolve `|` characters as output filters.
     * @status Parsed - Filter feature not yet implemented
     */
    FILTER: '>',

    /**
     * Closing block flag (`/`).
     * Marks this macro as the closing block of a scoped macro with the same identifier.
     * A closing block macro does not support arguments itself.
     * Example: `{{setvar::myvar}}long text{{/setvar}}`
     * @status Implemented - Content between opening and closing tags becomes the last unnamed argument
     */
    CLOSING_BLOCK: '/',

    /**
     * Preserve whitespace flag (`#`).
     * Prevents automatic trimming of scoped content.
     * By default, scoped macro content is trimmed. Use this flag to preserve leading/trailing whitespace.
     * Also provides backwards compatibility with legacy handlebars-style syntax like `{{#if ...}}`.
     * Example: `{{#setvar::myvar}}  content with spaces  {{/setvar}}`
     * @status Implemented - Prevents auto-trim on scoped content
     */
    PRESERVE_WHITESPACE: '#',

    // Note: Variable shorthand (. and $) are NOT flags - they are special prefixes
    // that trigger the variable expression parsing branch. See MacroLexer.js Var tokens.
});

/**
 * @typedef {Object} MacroFlagDefinition
 * @property {MacroFlagType} type - The flag type enum value (also the symbol).
 * @property {string} name - Human-readable name for the flag.
 * @property {string} description - Description of what the flag does.
 * @property {boolean} implemented - Whether this flag's behavior is implemented.
 * @property {boolean} affectsParser - Whether this flag changes parsing behavior (e.g., filter flag).
 */

/**
 * Definitions for all macro flags with metadata.
 *
 * @type {Map<string, MacroFlagDefinition>}
 */
export const MacroFlagDefinitions = new Map([
    [MacroFlagType.IMMEDIATE, {
        type: MacroFlagType.IMMEDIATE,
        name: 'Immediate',
        description: 'Resolve this macro before other macros in the same text.',
        implemented: false,
        affectsParser: false,
    }],
    [MacroFlagType.DELAYED, {
        type: MacroFlagType.DELAYED,
        name: 'Delayed',
        description: 'Resolve this macro after other macros in the same text.',
        implemented: false,
        affectsParser: false,
    }],
    [MacroFlagType.REEVALUATE, {
        type: MacroFlagType.REEVALUATE,
        name: 'Re-evaluate',
        description: 'Mark this macro for re-evaluation.',
        implemented: false,
        affectsParser: false,
    }],
    [MacroFlagType.FILTER, {
        type: MacroFlagType.FILTER,
        name: 'Filter',
        description: 'Enable pipe-based output filters for this macro.',
        implemented: false,
        affectsParser: true, // Changes how `|` is parsed
    }],
    [MacroFlagType.CLOSING_BLOCK, {
        type: MacroFlagType.CLOSING_BLOCK,
        name: 'Closing Block',
        description: 'Marks this as a closing block for a scoped macro.',
        implemented: true,
        affectsParser: false,
    }],
    [MacroFlagType.PRESERVE_WHITESPACE, {
        type: MacroFlagType.PRESERVE_WHITESPACE,
        name: 'Preserve Whitespace',
        description: 'Prevent automatic trimming of scoped content (legacy # syntax).',
        implemented: true,
        affectsParser: false,
    }],
]);

/**
 * Set of all valid flag symbols for quick lookup.
 *
 * @type {Set<string>}
 */
export const ValidFlagSymbols = new Set(Object.values(MacroFlagType));

/**
 * Creates a default MacroFlags object with all flags set to false.
 *
 * @returns {MacroFlags}
 */
export function createEmptyFlags() {
    return {
        immediate: false,
        delayed: false,
        reevaluate: false,
        filter: false,
        closingBlock: false,
        preserveWhitespace: false,
        raw: [],
    };
}

/**
 * Parses an array of flag symbols into a MacroFlags object.
 *
 * @param {string[]} flagSymbols - Array of flag symbol strings (e.g., ['!', '?']).
 * @returns {MacroFlags}
 */
export function parseFlags(flagSymbols) {
    const flags = createEmptyFlags();

    for (const symbol of flagSymbols) {
        switch (symbol) {
            case MacroFlagType.IMMEDIATE:
                flags.immediate = true;
                break;
            case MacroFlagType.DELAYED:
                flags.delayed = true;
                break;
            case MacroFlagType.REEVALUATE:
                flags.reevaluate = true;
                break;
            case MacroFlagType.FILTER:
                flags.filter = true;
                break;
            case MacroFlagType.CLOSING_BLOCK:
                flags.closingBlock = true;
                break;
            case MacroFlagType.PRESERVE_WHITESPACE:
                flags.preserveWhitespace = true;
                break;
            default:
                console.warn(`Can't parse unknown macro flag: ${symbol}`);
        }
        flags.raw.push(symbol);
    }

    return flags;
}

/**
 * Checks if a MacroFlags object has any flags set.
 *
 * @param {MacroFlags} flags - The flags object to check.
 * @returns {boolean} True if at least one flag is set.
 */
export function hasAnyFlag(flags) {
    return flags.raw.length > 0;
}

/**
 * Gets the flag definition for a given symbol.
 *
 * @param {string} symbol - The flag symbol (e.g., '!').
 * @returns {MacroFlagDefinition|undefined}
 */
export function getFlagDefinition(symbol) {
    return MacroFlagDefinitions.get(symbol);
}

/**
 * Checks if a given symbol is a valid macro flag.
 *
 * @param {string} symbol - The symbol to check.
 * @returns {boolean}
 */
export function isValidFlag(symbol) {
    return ValidFlagSymbols.has(symbol);
}
