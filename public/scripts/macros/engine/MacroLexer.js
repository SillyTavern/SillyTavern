import { chevrotain } from '../../../lib.js';
const { createToken, Lexer } = chevrotain;

/** @typedef {import('chevrotain').TokenType} TokenType */

/** @enum {string} */
const modes = {
    plaintext: 'plaintext_mode',
    macro_def: 'macro_def_mode',
    macro_identifier_end: 'macro_identifier_end_mode',
    macro_args: 'macro_args_mode',
    macro_filter_modifer: 'macro_filter_modifer_mode',
    macro_filter_modifier_end: 'macro_filter_modifier_end_mode',
};

/** @readonly */
const Tokens = {
    // General capture-all plaintext without macros. Consumes any character that is not the first '{' of a macro opener '{{'.
    Plaintext: createToken({ name: 'Plaintext', pattern: /(?:[^{]|\{(?!\{))+/u, line_breaks: true }),
    // Single literal '{' that appears immediately before a macro opener '{{'.
    PlaintextOpenBrace: createToken({ name: 'Plaintext.OpenBrace', pattern: /\{(?=\{\{)/ }),

    // General macro capture
    Macro: {
        Start: createToken({ name: 'Macro.Start', pattern: /\{\{/ }),
        // Separate macro identifier needed, that is similar to the global indentifier, but captures the actual macro "name"
        // We need this, because this token is going to switch lexer mode, while the general identifier does not.
        Flags: createToken({ name: 'Macro.Flag', pattern: /[!?#~/.$]/ }),
        DoubleSlash: createToken({ name: 'Macro.DoubleSlash', pattern: /\/\// }),
        Identifier: createToken({ name: 'Macro.Identifier', pattern: /[a-zA-Z][\w-_]*/ }),
        // At the end of an identifier, there has to be whitspace, or must be directly followed by colon/double-colon separator, output modifier or closing braces
        EndOfIdentifier: createToken({ name: 'Macro.EndOfIdentifier', pattern: /(?:\s+|(?=:{1,2})|(?=[|}]))/, group: Lexer.SKIPPED }),
        BeforeEnd: createToken({ name: 'Macro.BeforeEnd', pattern: /(?=\}\})/, group: Lexer.SKIPPED }),
        End: createToken({ name: 'Macro.End', pattern: /\}\}/ }),
    },

    // Captures that only appear inside arguments
    Args: {
        DoubleColon: createToken({ name: 'Args.DoubleColon', pattern: /::/ }),
        Colon: createToken({ name: 'Args.Colon', pattern: /:/ }),
        Equals: createToken({ name: 'Args.Equals', pattern: /=/ }),
        Quote: createToken({ name: 'Args.Quote', pattern: /"/ }),
    },

    Filter: {
        EscapedPipe: createToken({ name: 'Filter.EscapedPipe', pattern: /\\\|/ }),
        Pipe: createToken({ name: 'Filter.Pipe', pattern: /\|/ }),
        Identifier: createToken({ name: 'Filter.Identifier', pattern: /[a-zA-Z][\w-_]*/ }),
        // At the end of an identifier, there has to be whitspace, or must be directly followed by colon/double-colon separator, output modifier or closing braces
        EndOfIdentifier: createToken({ name: 'Filter.EndOfIdentifier', pattern: /(?:\s+|(?=:{1,2})|(?=[|}]))/, group: Lexer.SKIPPED }),
    },

    // All tokens that can be captured inside a macro
    Identifier: createToken({ name: 'Identifier', pattern: /[a-zA-Z][\w-_]*/ }),
    WhiteSpace: createToken({ name: 'WhiteSpace', pattern: /\s+/, group: Lexer.SKIPPED }),

    // Capture unknown characters one by one, to still allow other tokens being matched once they are there.
    // This includes any possible braces that is not the double closing braces as MacroEnd.
    Unknown: createToken({ name: 'Unknown', pattern: /([^}]|\}(?!\}))/ }),

    // TODO: Capture-all rest for now, that is not the macro end or opening of a new macro. Might be replaced later down the line.
    Text: createToken({ name: 'Text', pattern: /.+(?=\}\}|\{\{)/, line_breaks: true }),

    // DANGER ZONE: Careful with this token. This is used as a way to pop the current mode, if no other token matches.
    // Can be used in modes that don't have a "defined" end really, like when capturing a single argument, argument list, etc.
    // Has to ALWAYS be the last token.
    ModePopper: createToken({ name: 'ModePopper', pattern: () => [''], line_breaks: false, group: Lexer.SKIPPED }),
};

/** @type {Map<string,string>} Saves all token definitions that are marked as entering modes */
const enterModesMap = new Map();

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

            using(Tokens.Macro.Flags),

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
