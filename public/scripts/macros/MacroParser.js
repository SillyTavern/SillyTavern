import { CstParser } from '../../lib/chevrotain.js';
import { MacroLexer } from './MacroLexer.js';

/**
 * The singleton instance of the MacroParser.
 *
 * @type {MacroParser}
 */
let instance;
export { instance as MacroParser };

class MacroParser extends CstParser {
    /** @type {MacroParser} */ static #instance;
    /** @type {MacroParser} */ static get instance() { return MacroParser.#instance ?? (MacroParser.#instance = new MacroParser()); }

    /** @private */
    constructor() {
        super(MacroLexer.def);
        const Tokens = MacroLexer.tokens;

        const $ = this;

        this.macro = $.RULE("macro", () => {
            $.CONSUME(Tokens.Macro.Start);
            $.CONSUME(Tokens.Macro.Identifier);
            $.OPTION(() => $.SUBRULE($.arguments));
            $.CONSUME(Tokens.Macro.End);
        });

        this.arguments = $.RULE("arguments", () => {
            $.CONSUME(Tokens.Identifier);
        });

        this.performSelfAnalysis();
    }

    test(input) {
        const lexingResult = MacroLexer.tokenize(input);
        // "input" is a setter which will reset the parser's state.
        this.input = lexingResult.tokens;
        const node = this.macro();


        if (this.errors.length > 0) {
            console.error('Parser errors', this.errors);
            throw new Error('Parser errors found\n' + this.errors.map(x => x.message).join('\n'));
        }

        return node;
    }
}

instance = MacroParser.instance;
