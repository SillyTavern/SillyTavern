import { createToken, Lexer } from '../../lib/chevrotain.js';

/** @typedef {import('../../lib/chevrotain.js').TokenType} TokenType */

/** @enum {string} */
const modes = {
    plaintext: 'plaintext_mode',
    macro_def: 'macro_def_mode',
    macro_args: 'macro_args_mode',
};

/** @readonly */
const Tokens = {
    // General capture-all plaintext without macros
    Plaintext: createToken({ name: 'Plaintext', pattern: /(.+?)(?=\{\{)|(.+)/, line_breaks: true }), // Match everything up till opening brackets. Or to the end.

    // General macro capture
    Macro: {
        Start: createToken({ name: 'MacroStart', pattern: /\{\{/ }),
        Identifier: createToken({ name: 'MacroIdentifier', pattern: /[a-zA-Z_]\w*/ }),
        // CaptureBeforeEnd: createToken({ name: 'MacroCaptureBeforeEnd', pattern: /.*?(?=\}\})/, pop_mode: true/*, group: Lexer.SKIPPED */ }),
        End: createToken({ name: 'MacroEnd', pattern: /\}\}/ }),
    },

    Args: {

    },

    // All tokens that can be captured inside a macro
    DoubleColon: createToken({ name: 'DoubleColon', pattern: /::/ }),
    Colon: createToken({ name: 'Colon', pattern: /:/ }),
    Equals: createToken({ name: 'Equals', pattern: /=/ }),
    Quote: createToken({ name: 'Quote', pattern: /"/ }),
    Identifier: createToken({ name: 'Identifier', pattern: /[a-zA-Z_]\w*/ }),
    WhiteSpace: createToken({
        name: 'WhiteSpace',
        pattern: /\s+/,
        group: Lexer.SKIPPED,
    }),

    Unknown: createToken({ name: 'Unknown', pattern: /[^{}]/ }),

    // TODO: Capture-all rest for now, that is not the macro end or opening of a new macro. Might be replaced later down the line.
    Text: createToken({ name: 'Text', pattern: /.+(?=\}\}|\{\{)/, line_breaks: true }),

    // DANGER ZONE: Careful with this token. This is used as a way to pop the current mode, if no other token matches.
    // Can be used in modes that don't have a "defined" end really, like when capturing a single argument, argument list, etc.
    // Has to ALWAYS be the last token.
    ModePopper: createToken({ name: 'EndMode', pattern: () => [''], pop_mode: true/*, group: Lexer.SKIPPED */ }),
};

/** @type {Map<string,string>} Saves all token definitions that are marked as entering modes */
const enterModesMap = new Map();

const Def = {
    modes: {
        [modes.plaintext]: [
            enter(Tokens.Macro.Start, modes.macro_def),
            using(Tokens.Plaintext),
        ],
        [modes.macro_def]: [
            exits(Tokens.Macro.End, modes.macro_def),

            // Inside a macro, we will match the identifier
            // Enter 'macro_args' mode automatically at the end of the identifier, to match any optional arguments
            enter(Tokens.Macro.Identifier, modes.macro_args),
        ],
        [modes.macro_args]: [
            // Macro args allow nested macros
            enter(Tokens.Macro.Start, modes.macro_def),

            using(Tokens.DoubleColon),
            using(Tokens.Colon),
            using(Tokens.Equals),
            using(Tokens.Quote),
            using(Tokens.Identifier),

            using(Tokens.WhiteSpace),

            // Last fallback, before we need to exit the mode, as we might have characters we falsely haven't defined yet
            using(Tokens.Unknown),

            // Args are optional, and we don't know how long, so exit the mode to be able to capture the actual macro end
            exits(Tokens.ModePopper, modes.macro_args),
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
        super(MacroLexer.def);
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
 * @param {TokenType} token - The token to modify
 * @param {string} mode - The mode to set
 * @returns {TokenType} The token again
 */
function enter(token, mode) {
    if (enterModesMap.has(token.name) && enterModesMap.get(token.name) !== mode) {
        throw new Error(`Token ${token.name} already is set to enter mode ${enterModesMap.get(token.name)}. The token definition are global, so they cannot be used to lead to different modes.`);
    }

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
    if (enterModesMap.has(token.name)) {
        throw new Error(`Token ${token.name} is already marked to enter a mode (${enterModesMap.get(token.name)}). The token definition are global, so they cannot be used to lead or stay differently.`);
    }
    return token;
}
