import { CstParser } from './lib.js';
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

        // const $ = this;

        this.performSelfAnalysis();
    }
}

instance = MacroParser.instance;
