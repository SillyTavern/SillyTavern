import { createToken, Lexer } from '../../lib/chevrotain.min.mjs';

/** @enum {string} */
const MODES = {
    macro: 'macro_mode',
    text: 'text_mode',
};

/** @readonly */
const tokens = {
    // General capture-all plaintext without macros
    Plaintext: createToken({ name: 'Plaintext', pattern: /(.+?)(?=\{\{)|(.+)/, line_breaks: true }), // Match everything up till opening brackets. Or to the end.

    // The relevant blocks to start/end a macro
    MacroStart: createToken({ name: 'MacroStart', pattern: /\{\{/, push_mode: MODES.macro }),
    MacroEnd: createToken({ name: 'MacroEnd', pattern: /\}\}/, pop_mode: true }),

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
    // TODO: Capture-all rest for now, that is not the macro end or opening of a new macro. Might be replaced later down the line.
    Text: createToken({ name: 'Text', pattern: /.+(?=\}\}|\{\{)/, line_breaks: true }),
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
    /** @readonly */ static tokens = tokens;
    /** @readonly */ static def = {
        modes: {
            [MODES.text]: [
                tokens.MacroStart,
                tokens.Plaintext,
            ],
            [MODES.macro]: [
                tokens.MacroStart,
                tokens.MacroEnd,
                tokens.DoubleColon,
                tokens.Colon,
                tokens.Equals,
                tokens.Quote,
                tokens.Identifier,
                tokens.WhiteSpace,
                tokens.Text,
            ],
        },
        defaultMode: MODES.text,
    };
    /** @readonly */ tokens = tokens;
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

