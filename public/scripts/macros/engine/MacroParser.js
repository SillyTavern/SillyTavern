import { chevrotain } from '../../../lib.js';
import { MacroLexer } from './MacroLexer.js';

const { CstParser } = chevrotain;

/** @typedef {import('chevrotain').TokenType} TokenType */
/** @typedef {import('chevrotain').CstNode} CstNode */
/** @typedef {import('chevrotain').ILexingError} ILexingError */
/** @typedef {import('chevrotain').IRecognitionException} IRecognitionException */

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
        super(MacroLexer.def, {
            traceInitPerf: false,
            nodeLocationTracking: 'full',
            recoveryEnabled: true,
        });
        const Tokens = MacroLexer.tokens;

        const $ = this;

        // Top-level document rule that can handle both plaintext and macros
        $.document = $.RULE('document', () => {
            $.MANY(() => {
                $.OR([
                    { ALT: () => $.CONSUME(Tokens.Plaintext, { LABEL: 'plaintext' }) },
                    { ALT: () => $.CONSUME(Tokens.PlaintextOpenBrace, { LABEL: 'plaintext' }) },
                    { ALT: () => $.SUBRULE($.macro) },
                    { ALT: () => $.CONSUME(Tokens.Macro.Start, { LABEL: 'plaintext' }) },
                ]);
            });
        });

        // Basic Macro Structure - can be either a regular macro or a variable expression
        $.macro = $.RULE('macro', () => {
            $.CONSUME(Tokens.Macro.Start);

            // Optional flags before the identifier (e.g., {{!user}}, {{?~macro}}, {{>filtered}})
            // Both regular flags and filter flag are captured under the 'flags' label
            $.MANY(() => {
                $.OR1([
                    { ALT: () => $.CONSUME(Tokens.Macro.Flags, { LABEL: 'flags' }) },
                    { ALT: () => $.CONSUME(Tokens.Macro.FilterFlag, { LABEL: 'flags' }) },
                ]);
            });

            // Branch: either a variable expression (starts with . or $) or a regular macro
            $.OR([
                // Variable expression branch
                { ALT: () => $.SUBRULE($.variableExpr) },
                // Regular macro branch
                { ALT: () => $.SUBRULE($.macroBody) },
            ]);

            $.CONSUME(Tokens.Macro.End);
        });

        // Regular macro body (flags + identifier + optional arguments)
        $.macroBody = $.RULE('macroBody', () => {
            // Macro identifier (name)
            $.OR2([
                { ALT: () => $.CONSUME(Tokens.Macro.DoubleSlash, { LABEL: 'Macro.identifier' }) },
                { ALT: () => $.CONSUME(Tokens.Macro.Identifier, { LABEL: 'Macro.identifier' }) },
            ]);
            $.OPTION(() => $.SUBRULE($.arguments));
        });

        // Variable expression: .varName or $varName with optional operator
        $.variableExpr = $.RULE('variableExpr', () => {
            // Variable scope prefix
            $.OR3([
                { ALT: () => $.CONSUME(Tokens.Var.LocalPrefix, { LABEL: 'Var.scope' }) },
                { ALT: () => $.CONSUME(Tokens.Var.GlobalPrefix, { LABEL: 'Var.scope' }) },
            ]);

            // Variable identifier (name)
            $.CONSUME(Tokens.Var.Identifier, { LABEL: 'Var.identifier' });

            // Optional operator (and expression, if operator requires one)
            $.OPTION2(() => $.SUBRULE($.variableOperator));
        });

        // Variable operator: ++, --, = value, += value, -= value, ||, ??, ||=, ??=, ==, !=, >, >=, <, <=
        $.variableOperator = $.RULE('variableOperator', () => {
            $.OR4([
                { ALT: () => $.CONSUME(Tokens.Var.Operators.Increment, { LABEL: 'Var.operator' }) },
                { ALT: () => $.CONSUME(Tokens.Var.Operators.Decrement, { LABEL: 'Var.operator' }) },
                {
                    ALT: () => {
                        $.OR5([
                            { ALT: () => $.CONSUME(Tokens.Var.Operators.NullishCoalescingEquals, { LABEL: 'Var.operator' }) },
                            { ALT: () => $.CONSUME(Tokens.Var.Operators.NullishCoalescing, { LABEL: 'Var.operator' }) },
                            { ALT: () => $.CONSUME(Tokens.Var.Operators.LogicalOrEquals, { LABEL: 'Var.operator' }) },
                            { ALT: () => $.CONSUME(Tokens.Var.Operators.LogicalOr, { LABEL: 'Var.operator' }) },
                            { ALT: () => $.CONSUME(Tokens.Var.Operators.MinusEquals, { LABEL: 'Var.operator' }) },
                            { ALT: () => $.CONSUME(Tokens.Var.Operators.DoubleEquals, { LABEL: 'Var.operator' }) },
                            { ALT: () => $.CONSUME(Tokens.Var.Operators.NotEquals, { LABEL: 'Var.operator' }) },
                            { ALT: () => $.CONSUME(Tokens.Var.Operators.GreaterThanOrEqual, { LABEL: 'Var.operator' }) },
                            { ALT: () => $.CONSUME(Tokens.Var.Operators.GreaterThan, { LABEL: 'Var.operator' }) },
                            { ALT: () => $.CONSUME(Tokens.Var.Operators.LessThanOrEqual, { LABEL: 'Var.operator' }) },
                            { ALT: () => $.CONSUME(Tokens.Var.Operators.LessThan, { LABEL: 'Var.operator' }) },
                            { ALT: () => $.CONSUME(Tokens.Var.Operators.PlusEquals, { LABEL: 'Var.operator' }) },
                            { ALT: () => $.CONSUME(Tokens.Var.Operators.Equals, { LABEL: 'Var.operator' }) },
                        ]);
                        $.SUBRULE($.variableValue, { LABEL: 'Var.value' });
                    },
                },
            ]);
        });

        // Variable value: everything after = or += until the end
        // Can contain nested macros and any other tokens
        $.variableValue = $.RULE('variableValue', () => {
            $.MANY2(() => {
                $.OR5([
                    { ALT: () => $.SUBRULE($.macro) }, // Nested macros
                    { ALT: () => $.CONSUME(Tokens.Identifier) },
                    { ALT: () => $.CONSUME(Tokens.Unknown) },
                ]);
            });
        });

        // Arguments Parsing
        $.arguments = $.RULE('arguments', () => {
            $.OR([
                {
                    ALT: () => {
                        $.CONSUME(Tokens.Args.DoubleColon, { LABEL: 'separator' });
                        $.AT_LEAST_ONE_SEP({
                            SEP: Tokens.Args.DoubleColon,
                            DEF: () => $.SUBRULE($.argument, { LABEL: 'argument' }),
                        });
                    },
                },
                {
                    ALT: () => {
                        $.OPTION(() => {
                            $.CONSUME(Tokens.Args.Colon, { LABEL: 'separator' });
                        });
                        $.SUBRULE($.argumentAllowingColons, { LABEL: 'argument' });
                    },
                    // So, this is a bit hacky. But implemented below, the argument capture does explicitly exclude double colons
                    // from being captured as the first token. The potential ambiguity chevrotain claims here is not possible.
                    // It says stuff like <Args.DoubleColon, Identifier/Macro/Unknown> is possible in both branches, but it is not.
                    IGNORE_AMBIGUITIES: true,
                },
            ]);
        });

        // List the argument tokens here, as we need two rules, one to be able to parse with double colons and one without
        const validArgumentTokens = [
            { ALT: () => $.SUBRULE($.macro) }, // Nested Macros
            { ALT: () => $.CONSUME(Tokens.Identifier) },
            { ALT: () => $.CONSUME(Tokens.Unknown) },
            { ALT: () => $.CONSUME(Tokens.Args.Colon) },
            { ALT: () => $.CONSUME(Tokens.Args.Equals) },
            { ALT: () => $.CONSUME(Tokens.Args.Quote) },
        ];

        $.argument = $.RULE('argument', () => {
            $.MANY(() => {
                $.OR([...validArgumentTokens]);
            });
        });
        $.argumentAllowingColons = $.RULE('argumentAllowingColons', () => {
            $.AT_LEAST_ONE(() => {
                $.OR([
                    ...validArgumentTokens,
                    { ALT: () => $.CONSUME(Tokens.Args.DoubleColon) },
                ]);
            });
        });

        this.performSelfAnalysis();
    }

    /**
     * Parses a document into a CST.
     *
     * @param {string} input
     * @returns {{ cst: CstNode|null, errors: ({ message: string }|ILexingError|IRecognitionException)[] , lexingErrors: ILexingError[], parserErrors: IRecognitionException[] }}
     */
    parseDocument(input) {
        if (!input) {
            return { cst: null, errors: [{ message: 'Input is empty' }], lexingErrors: [], parserErrors: [] };
        }

        const lexingResult = MacroLexer.tokenize(input);

        this.input = lexingResult.tokens;
        const cst = this.document();

        const errors = [
            ...lexingResult.errors,
            ...this.errors,
        ];

        return { cst, errors, lexingErrors: lexingResult.errors, parserErrors: this.errors };
    }

    test(input) {
        const lexingResult = MacroLexer.tokenize(input);
        // "input" is a setter which will reset the parser's state.
        this.input = lexingResult.tokens;
        const cst = this.macro();

        // For testing purposes we need to actually persist the error messages in the object,
        // otherwise the test cases cannot read those, as they don't have access to the exception object type.
        const errors = this.errors.map(x => ({ message: x.message, ...x, stack: x.stack }));

        return { cst, errors: errors };
    }
}

instance = MacroParser.instance;
