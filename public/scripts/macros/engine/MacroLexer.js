import { chevrotain } from '../../../lib.js';
const { createToken, Lexer } = chevrotain;

/** @typedef {import('chevrotain').TokenType} TokenType */


/** Regex for lexer token matching (no anchors). */
const IDENTIFIER_LEXER_PATTERN = /[a-zA-Z][\w-_]*/;

/**
 * Pattern for valid macro identifiers.
 * Must start with a letter, followed by word chars (letters, digits, underscore) or hyphens.
 * Used by both the lexer token and the validation regex.
 *
 * Regex for full-string validation (with anchors). Exported for macro registration.
 */
export const MACRO_IDENTIFIER_PATTERN = /^[a-zA-Z][\w-_]*$/;

/**
 * Pattern for valid variable shorthand identifiers.
 * Must start with a letter, followed by word chars (letters, digits, underscore) or hyphens,
 * but must end with a word character (not a hyphen).
 *
 * Used for variable shorthand syntax like .varName or $varName.
 */
export const MACRO_VARIABLE_SHORTHAND_PATTERN = /[a-zA-Z](?:[\w\-_]*[\w])?/;

/** @enum {string} */
const modes = Object.freeze({
    plaintext: 'plaintext_mode',
    macro_def: 'macro_def_mode',
    macro_identifier_end: 'macro_identifier_end_mode',
    macro_args: 'macro_args_mode',
    macro_filter_modifer: 'macro_filter_modifer_mode',
    macro_filter_modifier_end: 'macro_filter_modifier_end_mode',
    // Variable shorthand modes
    var_identifier: 'var_identifier_mode',
    var_after_identifier: 'var_after_identifier_mode',
    var_value: 'var_value_mode',
});

/**
 * All lexer tokens used by the macro parser.
 * @readonly
 */
const Tokens = Object.freeze({
/** General capture-all plaintext without macros. Consumes any character that is not the first '{' of a macro opener '{{'. */
    Plaintext: createToken({ name: 'Plaintext', pattern: /(?:[^{]|\{(?!\{))+/u, line_breaks: true }),
    /** Single literal '{' that appears immediately before a macro opener '{{' */
    PlaintextOpenBrace: createToken({ name: 'Plaintext.OpenBrace', pattern: /\{(?=\{\{)/ }),

    /** General macro capture */
    Macro: {
        Start: createToken({ name: 'Macro.Start', pattern: /\{\{/ }),
        /**
         * Macro execution flags - special symbols that modify macro resolution behavior.
         * - `!` = immediate resolve (TBD)
         * - `?` = delayed resolve (TBD)
         * - `~` = re-evaluate (TBD)
         * - `/` = closing block marker for scoped macros
         * - `#` = preserve whitespace (don't auto-trim scoped content), also legacy handlebars compatibility
         */
        Flags: createToken({ name: 'Macro.Flag', pattern: /[!?~#/]/ }),
        /**
         * Filter flag (`>`) - separate token because it changes parsing behavior.
         * When present, `|` characters inside the macro are treated as filter/pipe operators.
         */
        FilterFlag: createToken({ name: 'Macro.FilterFlag', pattern: />/ }),
        DoubleSlash: createToken({ name: 'Macro.DoubleSlash', pattern: /\/\// }),
        /**
         * Separate macro identifier needed, that is similar to the global indentifier, but captures the actual macro "name"
         * We need this, because this token is going to switch lexer mode, while the general identifier does not.
         */
        Identifier: createToken({ name: 'Macro.Identifier', pattern: IDENTIFIER_LEXER_PATTERN }),
        /** At the end of an identifier, there has to be whitspace, or must be directly followed by colon/double-colon separator, output modifier or closing braces */
        EndOfIdentifier: createToken({ name: 'Macro.EndOfIdentifier', pattern: /(?:\s+|(?=:{1,2})|(?=[|}]))/, group: Lexer.SKIPPED }),
        BeforeEnd: createToken({ name: 'Macro.BeforeEnd', pattern: /(?=\}\})/, group: Lexer.SKIPPED }),
        End: createToken({ name: 'Macro.End', pattern: /\}\}/ }),
    },

    /** Captures that only appear inside arguments */
    Args: {
        DoubleColon: createToken({ name: 'Args.DoubleColon', pattern: /::/ }),
        Colon: createToken({ name: 'Args.Colon', pattern: /:/ }),
        Equals: createToken({ name: 'Args.Equals', pattern: /=/ }),
        Quote: createToken({ name: 'Args.Quote', pattern: /"/ }),
    },

    Filter: {
        EscapedPipe: createToken({ name: 'Filter.EscapedPipe', pattern: /\\\|/ }),
        Pipe: createToken({ name: 'Filter.Pipe', pattern: /\|/ }),
        Identifier: createToken({ name: 'Filter.Identifier', pattern: IDENTIFIER_LEXER_PATTERN }),
        /** At the end of an identifier, there has to be whitspace, or must be directly followed by colon/double-colon separator, output modifier or closing braces */
        EndOfIdentifier: createToken({ name: 'Filter.EndOfIdentifier', pattern: /(?:\s+|(?=:{1,2})|(?=[|}]))/, group: Lexer.SKIPPED }),
    },

    // All tokens that can be captured inside a macro
    Identifier: createToken({ name: 'Identifier', pattern: IDENTIFIER_LEXER_PATTERN }),
    WhiteSpace: createToken({ name: 'WhiteSpace', pattern: /\s+/, group: Lexer.SKIPPED }),

    /** Variable shorthand tokens */
    Var: {
        /** Local variable prefix (`.`) - triggers variable shorthand for local variables */
        LocalPrefix: createToken({ name: 'Var.LocalPrefix', pattern: /\./ }),
        /** Global variable prefix (`$`) - triggers variable shorthand for global variables */
        GlobalPrefix: createToken({ name: 'Var.GlobalPrefix', pattern: /\$/ }),
        /**
         * Variable identifier - allows hyphens inside but not at the end to avoid conflict with -- operator.
         * Pattern: starts with letter, optionally followed by word chars/hyphens, but must end with word char.
         * Examples: myVar, my-var, my_var, myVar123, my-long-var-name
         * Invalid: my-, my--, -var
         */
        Identifier: createToken({ name: 'Var.Identifier', pattern: MACRO_VARIABLE_SHORTHAND_PATTERN }),

        /** All tokens that are valid operators inside a variable shorthand expression */
        Operators: {
            /** Increment operator (`++`) */
            Increment: createToken({ name: 'Var.Increment', pattern: /\+\+/ }),
            /** Decrement operator (`--`) */
            Decrement: createToken({ name: 'Var.Decrement', pattern: /--/ }),
            /** Nullish coalescing assignment operator (`??=`) - sets var if undefined, must come before NullishCoalescing */
            NullishCoalescingEquals: createToken({ name: 'Var.NullishCoalescingEquals', pattern: /\?\?=/ }),
            /** Nullish coalescing operator (`??`) - returns default if var undefined */
            NullishCoalescing: createToken({ name: 'Var.NullishCoalescing', pattern: /\?\?/ }),
            /** Logical OR assignment operator (`||=`) - sets var if falsy, must come before LogicalOr */
            LogicalOrEquals: createToken({ name: 'Var.LogicalOrEquals', pattern: /\|\|=/ }),
            /** Logical OR operator (`||`) - returns default if var falsy */
            LogicalOr: createToken({ name: 'Var.LogicalOr', pattern: /\|\|/ }),
            /** Subtract operator (`-=`) - subtracts value from variable */
            MinusEquals: createToken({ name: 'Var.MinusEquals', pattern: /-=/ }),
            /** Equality comparison operator (`==`) - compares variable to value */
            DoubleEquals: createToken({ name: 'Var.DoubleEquals', pattern: /==/ }),
            /** Not equals comparison operator (`!=`) - compares variable to value, returns inverted result */
            NotEquals: createToken({ name: 'Var.NotEquals', pattern: /!=/ }),
            /** Greater than or equal comparison operator (`>=`) - must come before GreaterThan */
            GreaterThanOrEqual: createToken({ name: 'Var.GreaterThanOrEqual', pattern: />=/ }),
            /** Greater than comparison operator (`>`) */
            GreaterThan: createToken({ name: 'Var.GreaterThan', pattern: />/ }),
            /** Less than or equal comparison operator (`<=`) - must come before LessThan */
            LessThanOrEqual: createToken({ name: 'Var.LessThanOrEqual', pattern: /<=/ }),
            /** Less than comparison operator (`<`) */
            LessThan: createToken({ name: 'Var.LessThan', pattern: /</ }),
            /** Add/append operator (`+=`) - must come before Equals to avoid conflict */
            PlusEquals: createToken({ name: 'Var.PlusEquals', pattern: /\+=/ }),
            /** Set operator (`=`) */
            Equals: createToken({ name: 'Var.Equals', pattern: /=/ }),
        },
    },

    /**
     * Capture unknown characters one by one, to still allow other tokens being matched once they are there.
     * This includes any possible braces that is not the double closing braces as MacroEnd.
     */
    Unknown: createToken({ name: 'Unknown', pattern: /([^}]|\}(?!\}))/ }),

    /** TODO: Capture-all rest for now, that is not the macro end or opening of a new macro. Might be replaced later down the line. */
    Text: createToken({ name: 'Text', pattern: /.+(?=\}\}|\{\{)/, line_breaks: true }),

    /**
     * DANGER ZONE: Careful with this token. This is used as a way to pop the current mode, if no other token matches.
     * Can be used in modes that don't have a "defined" end really, like when capturing a single argument, argument list, etc.
     * Has to ALWAYS be the last token.
     */
    ModePopper: createToken({ name: 'ModePopper', pattern: () => [''], line_breaks: false, group: Lexer.SKIPPED }),
});

/** @type {Map<string,string>} Saves all token definitions that are marked as entering modes */
const enterModesMap = new Map();

/**
 * Lexer definition object that maps states/modes to their token rules.
 * Each mode defines which tokens are valid in that context and how to transition between modes.
 * @readonly
 */
const Def = {
    modes: {
        [modes.plaintext]: [
            using(Tokens.Plaintext),
            using(Tokens.PlaintextOpenBrace),
            enter(Tokens.Macro.Start, modes.macro_def),
        ],
        [modes.macro_def]: [
            exits(Tokens.Macro.End, modes.macro_def),

            // An explicit double-slash will be treated above flags to consume, as it'll introduce a comment macro. Directly following is the args then.
            enter(Tokens.Macro.DoubleSlash, modes.macro_args),

            // Variable shorthand prefixes - must come before flags to take precedence
            // These enter the variable identifier mode to parse variable expressions
            enter(Tokens.Var.LocalPrefix, modes.var_identifier),
            enter(Tokens.Var.GlobalPrefix, modes.var_identifier),

            using(Tokens.Macro.Flags),
            // Filter flag is separate because it affects parsing behavior for pipes
            using(Tokens.Macro.FilterFlag),

            // We allow whitspaces inbetween flags or in front of the modifier
            using(Tokens.WhiteSpace),

            // Inside a macro, we will match the identifier
            // Enter 'macro_identifier_end' mode automatically at the end of the identifier, so we don't match more than one identifier
            enter(Tokens.Macro.Identifier, modes.macro_identifier_end),

            // If none of the tokens above are found, this is an invalid macro at runtime.
            // We still need to exit the mode to prevent lexer errors
            exits(Tokens.ModePopper, modes.macro_def),
        ],
        [modes.macro_identifier_end]: [
            // Valid options after a macro identifier: whitespace, colon/double-colon (captured), macro end braces, or output modifier pipe.
            exits(Tokens.Macro.BeforeEnd, modes.macro_identifier_end),
            enter(Tokens.Macro.EndOfIdentifier, modes.macro_args, { andExits: modes.macro_identifier_end }),
        ],
        [modes.macro_args]: [
            // Macro args allow nested macros
            enter(Tokens.Macro.Start, modes.macro_def),

            // We allow escaped pipes to not start output modifiers. We need to capture this first, before the pipe
            using(Tokens.Filter.EscapedPipe),

            // If at any place during args writing there is a pipe, we lex it as an output identifier, and then continue with lex its args
            enter(Tokens.Filter.Pipe, modes.macro_filter_modifer),

            using(Tokens.Args.DoubleColon),
            using(Tokens.Args.Colon),
            using(Tokens.Args.Equals),
            using(Tokens.Args.Quote),
            using(Tokens.Identifier),

            using(Tokens.WhiteSpace),

            // Last fallback, before we need to exit the mode, as we might have characters we (wrongly) haven't defined yet
            using(Tokens.Unknown),

            // Args are optional, and we don't know how long, so exit the mode to be able to capture the actual macro end
            exits(Tokens.ModePopper, modes.macro_args),
        ],
        [modes.macro_filter_modifer]: [
            using(Tokens.WhiteSpace),

            enter(Tokens.Filter.Identifier, modes.macro_filter_modifier_end, { andExits: modes.macro_filter_modifer }),
        ],
        [modes.macro_filter_modifier_end]: [
            // Valid options after a filter itenfier: whitespace, colon/double-colon (captured), macro end braces, or output modifier pipe.
            exits(Tokens.Macro.BeforeEnd, modes.macro_identifier_end),
            exits(Tokens.Filter.EndOfIdentifier, modes.macro_filter_modifer),
        ],

        // After seeing `.` or `$`, expect a variable identifier
        [modes.var_identifier]: [
            using(Tokens.WhiteSpace),
            // Consume the variable identifier and move to operator detection
            enter(Tokens.Var.Identifier, modes.var_after_identifier, { andExits: modes.var_identifier }),
            // If no valid identifier found, exit back (will result in parser error)
            exits(Tokens.ModePopper, modes.var_identifier),
        ],
        // After the variable identifier, look for operators or end
        [modes.var_after_identifier]: [
            using(Tokens.WhiteSpace),
            // Check for operators - order matters: longer patterns first
            using(Tokens.Var.Operators.Increment),
            using(Tokens.Var.Operators.Decrement),
            enter(Tokens.Var.Operators.NullishCoalescingEquals, modes.var_value, { andExits: modes.var_after_identifier }),
            enter(Tokens.Var.Operators.NullishCoalescing, modes.var_value, { andExits: modes.var_after_identifier }),
            enter(Tokens.Var.Operators.LogicalOrEquals, modes.var_value, { andExits: modes.var_after_identifier }),
            enter(Tokens.Var.Operators.LogicalOr, modes.var_value, { andExits: modes.var_after_identifier }),
            enter(Tokens.Var.Operators.MinusEquals, modes.var_value, { andExits: modes.var_after_identifier }),
            enter(Tokens.Var.Operators.DoubleEquals, modes.var_value, { andExits: modes.var_after_identifier }),
            enter(Tokens.Var.Operators.NotEquals, modes.var_value, { andExits: modes.var_after_identifier }),
            enter(Tokens.Var.Operators.GreaterThanOrEqual, modes.var_value, { andExits: modes.var_after_identifier }),
            enter(Tokens.Var.Operators.GreaterThan, modes.var_value, { andExits: modes.var_after_identifier }),
            enter(Tokens.Var.Operators.LessThanOrEqual, modes.var_value, { andExits: modes.var_after_identifier }),
            enter(Tokens.Var.Operators.LessThan, modes.var_value, { andExits: modes.var_after_identifier }),
            enter(Tokens.Var.Operators.PlusEquals, modes.var_value, { andExits: modes.var_after_identifier }),
            enter(Tokens.Var.Operators.Equals, modes.var_value, { andExits: modes.var_after_identifier }),
            // If we see the end, exit
            exits(Tokens.Macro.BeforeEnd, modes.var_after_identifier),
            // Fallback exit
            exits(Tokens.ModePopper, modes.var_after_identifier),
        ],
        // After `=` or `+=`, capture the value (can contain nested macros)
        [modes.var_value]: [
            // Nested macros in value
            enter(Tokens.Macro.Start, modes.macro_def),

            using(Tokens.Identifier),
            using(Tokens.WhiteSpace),
            using(Tokens.Unknown),

            // Exit when we're about to see the end
            exits(Tokens.ModePopper, modes.var_value),
        ],
    },
    defaultMode: modes.plaintext,
};

/**
 * The singleton instance of the MacroLexer.
 *
 * @type {MacroLexer}
 */
let instance;
export { instance as MacroLexer };

class MacroLexer extends Lexer {
    /** @type {MacroLexer} */ static #instance;
    /** @type {MacroLexer} */ static get instance() { return MacroLexer.#instance ?? (MacroLexer.#instance = new MacroLexer()); }

    // Define the tokens
    /** @readonly */ static tokens = Tokens;
    /** @readonly */ static def = Def;
    /** @readonly */ tokens = Tokens;
    /** @readonly */ def = MacroLexer.def;

    /** @private */
    constructor() {
        super(MacroLexer.def, {
            traceInitPerf: false,
        });
    }

    test(input) {
        const result = this.tokenize(input);
        return {
            errors: result.errors,
            groups: result.groups,
            tokens: result.tokens.map(({ tokenType, ...rest }) => ({ type: tokenType.name, ...rest, tokenType: tokenType })),
        };
    }
}

instance = MacroLexer.instance;

/**
 * [Utility]
 * Set push mode on the token definition.
 * Can be used inside the token mode definition block.
 *
 * Marks the token to **enter** the following lexer mode.
 *
 * Optionally, you can specify the modes to exit when entering this mode.
 *
 * @param {TokenType} token - The token to modify
 * @param {string} mode - The mode to set
 * @param {object} [options={}] - Additional options
 * @param {string} [options.andExits] - The modes to exit when entering this mode
 * @returns {TokenType} The token again
 */
function enter(token, mode, { andExits = undefined } = {}) {
    if (!token) throw new Error('Token must not be undefined');
    if (enterModesMap.has(token.name) && enterModesMap.get(token.name) !== mode) {
        throw new Error(`Token ${token.name} already is set to enter mode ${enterModesMap.get(token.name)}. The token definition are global, so they cannot be used to lead to different modes.`);
    }

    if (andExits) exits(token, andExits);

    token.PUSH_MODE = mode;
    enterModesMap.set(token.name, mode);
    return token;
}

/**
 * [Utility]
 * Set pop mode on the token definition.
 * Can be used inside the token mode definition block.
 *
 * Marks the token to **exit** the following lexer mode.
 *
 * @param {TokenType} token - The token to modify
 * @param {string} mode - The mode to leave
 * @returns {TokenType} The token again
 */
function exits(token, mode) {
    if (!token) throw new Error('Token must not be undefined');
    token.POP_MODE = !!mode; // Always set to true. We just use the mode here, so the linter thinks it was used. We just pass it in for clarity in the definition
    return token;
}

/**
 * [Utility]
 * Can be used inside the token mode definition block.
 *
 * Marks the token to to just be used/consumed, and not exit or enter a mode.
 *
 * @param {TokenType} token - The token to modify
 * @returns {TokenType} The token again
 */
function using(token) {
    if (!token) throw new Error('Token must not be undefined');
    if (enterModesMap.has(token.name)) {
        throw new Error(`Token ${token.name} is already marked to enter a mode (${enterModesMap.get(token.name)}). The token definition are global, so they cannot be used to lead or stay differently.`);
    }
    return token;
}
