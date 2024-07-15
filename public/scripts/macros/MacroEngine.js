import { MacroLexer } from './MacroLexer.js';
import { MacroParser } from './MacroParser.js';

class MacroEngine {
    static instance = new MacroEngine();

    constructor() {
        this.parser = MacroParser.instance;
    }

    parseDocument(input) {
        const lexingResult = MacroLexer.tokenize(input);
        this.parser.input = lexingResult.tokens;
        // const cst = this.parser.document();
        // return cst;
    }

    evaluate(input) {
        const lexingResult = MacroLexer.tokenize(input);
        this.parser.input = lexingResult.tokens;
        // const cst = this.parser.macro();

        // if (this.parser.errors.length > 0) {
        //     throw new Error('Parsing errors detected');
        // }

        // return this.execute(cst);
    }

    execute(cstNode) {
        // Implement execution logic here, traversing the CST and replacing macros with their values
        // For now, we'll just return a placeholder result
        return 'Executed Macro';
    }
}

const macroEngineInstance = MacroEngine.instance;

export { MacroEngine, macroEngineInstance };
