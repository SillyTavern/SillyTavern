/** @typedef {import('../../public/lib/chevrotain.js').ILexingResult} ILexingResult */
/** @typedef {{type: string, text: string}} TestableToken */

describe("MacroLexer Tests", () => {
    beforeAll(async () => {
        await page.goto(global.ST_URL);
        await page.waitForFunction('document.getElementById("preloader") === null', { timeout: 0 });
    });

    it("basic macro tokenization", async () => {
        const input = "Hello, {{user}}!";
        const tokens = await runLexerGetTokens(input);

        const expectedTokens = [
            { type: 'Plaintext', text: 'Hello, ' },
            { type: 'MacroStart', text: '{{' },
            { type: 'MacroIdentifier', text: 'user' },
            { type: 'MacroEnd', text: '}}' },
            { type: 'Plaintext', text: '!' },
        ];

        // Compare the actual result with expected tokens
        expect(tokens).toEqual(expectedTokens);
    });

    it("should tokenize plaintext only", async () => {
        const input = "Just some text here.";
        const tokens = await runLexerGetTokens(input);

        const expectedTokens = [
            { type: 'Plaintext', text: 'Just some text here.' },
        ];

        expect(tokens).toEqual(expectedTokens);
    });

    it("should handle macro only", async () => {
        const input = "{{user}}";
        const tokens = await runLexerGetTokens(input);

        const expectedTokens = [
            { type: 'MacroStart', text: '{{' },
            { type: 'MacroIdentifier', text: 'user' },
            { type: 'MacroEnd', text: '}}' },
        ];

        expect(tokens).toEqual(expectedTokens);
    });

    it("should handle empty macro", async () => {
        const input = "{{}}";
        const tokens = await runLexerGetTokens(input);

        const expectedTokens = [
            { type: 'MacroStart', text: '{{' },
            { type: 'MacroEnd', text: '}}' },
        ];

        expect(tokens).toEqual(expectedTokens);
    });

    it("should handle macro with leading and trailing whitespace inside", async () => {
        const input = "{{   user   }}";
        const tokens = await runLexerGetTokens(input);

        const expectedTokens = [
            { type: 'MacroStart', text: '{{' },
            { type: 'MacroIdentifier', text: 'user' },
            { type: 'MacroEnd', text: '}}' },
        ];

        expect(tokens).toEqual(expectedTokens);
    });

    it("should handle nested macros", async () => {
        const input = "{{outerMacro {{innerMacro}}}}";
        const tokens = await runLexerGetTokens(input);

        const expectedTokens = [
            { type: 'MacroStart', text: '{{' },
            { type: 'MacroIdentifier', text: 'outerMacro' },
            { type: 'MacroStart', text: '{{' },
            { type: 'MacroIdentifier', text: 'innerMacro' },
            { type: 'MacroEnd', text: '}}' },
            { type: 'MacroEnd', text: '}}' },
        ];

        expect(tokens).toEqual(expectedTokens);
    });

    it("should handle macros with nested quotation marks", async () => {
        const input = '{{doStuff "inner {{nested}} string"}}';
        const tokens = await runLexerGetTokens(input);

        const expectedTokens = [
            { type: 'MacroStart', text: '{{' },
            { type: 'MacroIdentifier', text: 'doStuff' },
            { type: 'Quote', text: '"' },
            { type: 'Identifier', text: 'inner' },
            { type: 'MacroStart', text: '{{' },
            { type: 'MacroIdentifier', text: 'nested' },
            { type: 'MacroEnd', text: '}}' },
            { type: 'Identifier', text: 'string' },
            { type: 'Quote', text: '"' },
            { type: 'MacroEnd', text: '}}' },
        ];

        expect(tokens).toEqual(expectedTokens);
    });


    it("should tokenize macros with double colons arguments correctly", async () => {
        const input = "{{setvar::myVar::This is Sparta!}}";
        const tokens = await runLexerGetTokens(input);

        const expectedTokens = [
            { type: 'MacroStart', text: '{{' },
            { type: 'MacroIdentifier', text: 'setvar' },
            { type: 'DoubleColon', text: '::' },
            { type: 'Identifier', text: 'myVar' },
            { type: 'DoubleColon', text: '::' },
            { type: 'Identifier', text: 'This' },
            { type: 'Identifier', text: 'is' },
            { type: 'Identifier', text: 'Sparta' },
            { type: 'Unknown', text: '!' },
            { type: 'MacroEnd', text: '}}' },
        ];

        expect(tokens).toEqual(expectedTokens);
    });

    it("should handle named arguments with key=value syntax", async () => {
        const input = "{{doStuff key=MyValue another=AnotherValue}}";
        const tokens = await runLexerGetTokens(input);

        const expectedTokens = [
            { type: 'MacroStart', text: '{{' },
            { type: 'MacroIdentifier', text: 'doStuff' },
            { type: 'Identifier', text: 'key' },
            { type: 'Equals', text: '=' },
            { type: 'Identifier', text: 'MyValue' },
            { type: 'Identifier', text: 'another' },
            { type: 'Equals', text: '=' },
            { type: 'Identifier', text: 'AnotherValue' },
            { type: 'MacroEnd', text: '}}' },
        ];

        expect(tokens).toEqual(expectedTokens);
    });

    it("should handle named arguments with quotation marks", async () => {
        const input = '{{getvar key="My variable"}}';
        const tokens = await runLexerGetTokens(input);

        const expectedTokens = [
            { type: 'MacroStart', text: '{{' },
            { type: 'MacroIdentifier', text: 'getvar' },
            { type: 'Identifier', text: 'key' },
            { type: 'Equals', text: '=' },
            { type: 'Quote', text: '"' },
            { type: 'Identifier', text: 'My' },
            { type: 'Identifier', text: 'variable' },
            { type: 'Quote', text: '"' },
            { type: 'MacroEnd', text: '}}' },
        ];

        expect(tokens).toEqual(expectedTokens);
    });

    it("should handle multiple unnamed arguments in quotation marks", async () => {
        const input = '{{random "this" "and that" "and some more"}}';
        const tokens = await runLexerGetTokens(input);

        const expectedTokens = [
            { type: 'MacroStart', text: '{{' },
            { type: 'MacroIdentifier', text: 'random' },
            { type: 'Quote', text: '"' },
            { type: 'Identifier', text: 'this' },
            { type: 'Quote', text: '"' },
            { type: 'Quote', text: '"' },
            { type: 'Identifier', text: 'and' },
            { type: 'Identifier', text: 'that' },
            { type: 'Quote', text: '"' },
            { type: 'Quote', text: '"' },
            { type: 'Identifier', text: 'and' },
            { type: 'Identifier', text: 'some' },
            { type: 'Identifier', text: 'more' },
            { type: 'Quote', text: '"' },
            { type: 'MacroEnd', text: '}}' },
        ];

        expect(tokens).toEqual(expectedTokens);
    });

    it("should handle multiple sequential macros", async () => {
        const input = "{{macro1}}{{macro2}}";
        const tokens = await runLexerGetTokens(input);

        const expectedTokens = [
            { type: 'MacroStart', text: '{{' },
            { type: 'MacroIdentifier', text: 'macro1' },
            { type: 'MacroEnd', text: '}}' },
            { type: 'MacroStart', text: '{{' },
            { type: 'MacroIdentifier', text: 'macro2' },
            { type: 'MacroEnd', text: '}}' },
        ];

        expect(tokens).toEqual(expectedTokens);
    });

    it("should handle named arguments with mixed style", async () => {
        const input = '{{doStuff key="My Spaced Value" otherKey=SingleKey}}';
        const tokens = await runLexerGetTokens(input);

        const expectedTokens = [
            { type: 'MacroStart', text: '{{' },
            { type: 'MacroIdentifier', text: 'doStuff' },
            { type: 'Identifier', text: 'key' },
            { type: 'Equals', text: '=' },
            { type: 'Quote', text: '"' },
            { type: 'Identifier', text: 'My' },
            { type: 'Identifier', text: 'Spaced' },
            { type: 'Identifier', text: 'Value' },
            { type: 'Quote', text: '"' },
            { type: 'Identifier', text: 'otherKey' },
            { type: 'Equals', text: '=' },
            { type: 'Identifier', text: 'SingleKey' },
            { type: 'MacroEnd', text: '}}' },
        ];

        expect(tokens).toEqual(expectedTokens);
    });

    it("should handle macros with empty named arguments", async () => {
        const input = "{{doStuff key=}}";
        const tokens = await runLexerGetTokens(input);

        const expectedTokens = [
            { type: 'MacroStart', text: '{{' },
            { type: 'MacroIdentifier', text: 'doStuff' },
            { type: 'Identifier', text: 'key' },
            { type: 'Equals', text: '=' },
            { type: 'MacroEnd', text: '}}' },
        ];

        expect(tokens).toEqual(expectedTokens);
    });

    it("should handle macros with special characters in arguments", async () => {
        const input = '{{doStuff special chars #!@&*()}}';
        const tokens = await runLexerGetTokens(input);

        const expectedTokens = [
            { type: 'MacroStart', text: '{{' },
            { type: 'MacroIdentifier', text: 'doStuff' },
            { type: 'Identifier', text: 'special' },
            { type: 'Identifier', text: 'chars' },
            { type: 'Unknown', text: '#' },
            { type: 'Unknown', text: '!' },
            { type: 'Unknown', text: '@' },
            { type: 'Unknown', text: '&' },
            { type: 'Unknown', text: '*' },
            { type: 'Unknown', text: '(' },
            { type: 'Unknown', text: ')' },
            { type: 'MacroEnd', text: '}}' },
        ];

        expect(tokens).toEqual(expectedTokens);
    });

    it("should handle long macros with multiple arguments", async () => {
        const input = '{{longMacro arg1="value1" arg2="value2" arg3="value3"}}';
        const tokens = await runLexerGetTokens(input);

        const expectedTokens = [
            { type: 'MacroStart', text: '{{' },
            { type: 'MacroIdentifier', text: 'longMacro' },
            { type: 'Identifier', text: 'arg1' },
            { type: 'Equals', text: '=' },
            { type: 'Quote', text: '"' },
            { type: 'Identifier', text: 'value1' },
            { type: 'Quote', text: '"' },
            { type: 'Identifier', text: 'arg2' },
            { type: 'Equals', text: '=' },
            { type: 'Quote', text: '"' },
            { type: 'Identifier', text: 'value2' },
            { type: 'Quote', text: '"' },
            { type: 'Identifier', text: 'arg3' },
            { type: 'Equals', text: '=' },
            { type: 'Quote', text: '"' },
            { type: 'Identifier', text: 'value3' },
            { type: 'Quote', text: '"' },
            { type: 'MacroEnd', text: '}}' }
        ];

        expect(tokens).toEqual(expectedTokens);
    });


    it("should handle macros with complex argument patterns", async () => {
        const input = '{{complexMacro "text with {{nested}} content" key=val}}';
        const tokens = await runLexerGetTokens(input);

        const expectedTokens = [
            { type: 'MacroStart', text: '{{' },
            { type: 'MacroIdentifier', text: 'complexMacro' },
            { type: 'Quote', text: '"' },
            { type: 'Identifier', text: 'text' },
            { type: 'Identifier', text: 'with' },
            { type: 'MacroStart', text: '{{' },
            { type: 'MacroIdentifier', text: 'nested' },
            { type: 'MacroEnd', text: '}}' },
            { type: 'Identifier', text: 'content' },
            { type: 'Quote', text: '"' },
            { type: 'Identifier', text: 'key' },
            { type: 'Equals', text: '=' },
            { type: 'Identifier', text: 'val' },
            { type: 'MacroEnd', text: '}}' },
        ];

        expect(tokens).toEqual(expectedTokens);
    });

    it("do not lex special characters as part of the macro identifier", async () => {
        const input = "{{macro!@#%}}";
        const tokens = await runLexerGetTokens(input);

        const expectedTokens = [
            { type: 'MacroStart', text: '{{' },
            { type: 'MacroIdentifier', text: 'macro' },
            { type: 'Unknown', text: '!' },
            { type: 'Unknown', text: '@' },
            { type: 'Unknown', text: '#' },
            { type: 'Unknown', text: '%' },
            { type: 'MacroEnd', text: '}}' }
        ];

        expect(tokens).toEqual(expectedTokens);
    });

});

/**
 * Asynchronously runs the MacroLexer on the given input and returns the tokens.
 *
 * @param {string} input - The input string to be tokenized.
 * @return {Promise<TestableToken[]>} A promise that resolves to an array of tokens.
 */
async function runLexerGetTokens(input) {
    const result = await page.evaluate(async (input) => {
        /** @type {import('../../public/scripts/macros/MacroLexer.js')} */
        const { MacroLexer } = await import('./scripts/macros/MacroLexer.js');

        const result = MacroLexer.tokenize(input);
        return result;
    }, input);

    const tokens = getTestableTokens(result);
    return tokens;
}

/**
 *
 * @param {ILexingResult} result The result from the lexer
 * @returns {TestableToken[]} The tokens
 */
function getTestableTokens(result) {
    return result.tokens
        // Filter out the mode popper. We don't care aobut that for testing
        .filter(token => token.tokenType.name !== 'EndMode')
        // Extract relevant properties from tokens for comparison
        .map(token => ({
            type: token.tokenType.name,
            text: token.image
        }));
}
