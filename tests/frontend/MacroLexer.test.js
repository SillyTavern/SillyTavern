/** @typedef {import('../../public/lib/chevrotain.js').ILexingResult} ILexingResult */
/** @typedef {{type: string, text: string}} TestableToken */

describe('MacroLexer', () => {
    beforeAll(async () => {
        await page.goto(global.ST_URL);
        await page.waitForFunction('document.getElementById("preloader") === null', { timeout: 0 });
    });

    describe('General Macro', () => {
        // {{user}}
        it('should handle macro only', async () => {
            const input = '{{user}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'MacroStart', text: '{{' },
                { type: 'MacroIdentifier', text: 'user' },
                { type: 'MacroEnd', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{}}
        it('should handle empty macro', async () => {
            const input = '{{}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'MacroStart', text: '{{' },
                { type: 'MacroEnd', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{   user   }}
        it('should handle macro with leading and trailing whitespace inside', async () => {
            const input = '{{   user   }}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'MacroStart', text: '{{' },
                { type: 'MacroIdentifier', text: 'user' },
                { type: 'MacroEnd', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{ some macro }}
        it('whitespaces between two valid identifiers will only capture the first as macro identifier', async () => {
            const input = '{{ some macro }}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'MacroStart', text: '{{' },
                { type: 'MacroIdentifier', text: 'some' },
                { type: 'Identifier', text: 'macro' },
                { type: 'MacroEnd', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{macro1}}{{macro2}}
        it('should handle multiple sequential macros', async () => {
            const input = '{{macro1}}{{macro2}}';
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
        // {{my2cents}}
        it('should allow numerics inside the macro identifier', async () => {
            const input = '{{my2cents}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'MacroStart', text: '{{' },
                { type: 'MacroIdentifier', text: 'my2cents' },
                { type: 'MacroEnd', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{SCREAM}}
        it('should allow capslock macros', async () => {
            const input = '{{SCREAM}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'MacroStart', text: '{{' },
                { type: 'MacroIdentifier', text: 'SCREAM' },
                { type: 'MacroEnd', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{some-longer-macro}}
        it('allow dashes in macro identifiers', async () => {
            const input = '{{some-longer-macro}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'MacroStart', text: '{{' },
                { type: 'MacroIdentifier', text: 'some-longer-macro' },
                { type: 'MacroEnd', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{macro!@#%}}
        it('do not lex special characters as part of the macro identifier', async () => {
            const input = '{{macro!@#%}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'MacroStart', text: '{{' },
                { type: 'MacroIdentifier', text: 'macro' },
                { type: 'Unknown', text: '!' },
                { type: 'Unknown', text: '@' },
                { type: 'Unknown', text: '#' },
                { type: 'Unknown', text: '%' },
                { type: 'MacroEnd', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{ma!@#%ro}}
        it('invalid chars in macro identifier are not parsed as valid macro identifier', async () => {
            const input = '{{ma!@#%ro}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'MacroStart', text: '{{' },
                { type: 'MacroIdentifier', text: 'ma' },
                { type: 'Unknown', text: '!' },
                { type: 'Unknown', text: '@' },
                { type: 'Unknown', text: '#' },
                { type: 'Unknown', text: '%' },
                { type: 'Identifier', text: 'ro' },
                { type: 'MacroEnd', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
    });

    describe('Macro Nesting', () => {
    // {{outerMacro {{innerMacro}}}}
        it('should handle nested macros', async () => {
            const input = '{{outerMacro {{innerMacro}}}}';
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
        // {{doStuff "inner {{nested}} string"}}
        it('should handle macros with nested quotation marks', async () => {
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
    });

    describe('Macro Arguments', () => {
        // {{setvar::myVar::This is Sparta!}}
        it('should tokenize macros with double colons arguments correctly', async () => {
            const input = '{{setvar::myVar::This is Sparta!}}';
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
        // {{doStuff key=MyValue another=AnotherValue}}
        it('should handle named arguments with key=value syntax', async () => {
            const input = '{{doStuff key=MyValue another=AnotherValue}}';
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
        // {{getvar key="My variable"}}
        it('should handle named arguments with quotation marks', async () => {
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
        // {{getvar KEY=big}}
        it('should handle capslock argument name identifiers', async () => {
            const input = '{{getvar KEY=big}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'MacroStart', text: '{{' },
                { type: 'MacroIdentifier', text: 'getvar' },
                { type: 'Identifier', text: 'KEY' },
                { type: 'Equals', text: '=' },
                { type: 'Identifier', text: 'big' },
                { type: 'MacroEnd', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{dostuff longer-key=value}}
        it('should handle argument name identifiers with dashes', async () => {
            const input = '{{dostuff longer-key=value}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'MacroStart', text: '{{' },
                { type: 'MacroIdentifier', text: 'dostuff' },
                { type: 'Identifier', text: 'longer-key' },
                { type: 'Equals', text: '=' },
                { type: 'Identifier', text: 'value' },
                { type: 'MacroEnd', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{random "this" "and that" "and some more"}}
        it('should handle multiple unnamed arguments in quotation marks', async () => {
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
        // {{doStuff key="My Spaced Value" otherKey=SingleKey}}
        it('should handle named arguments with mixed style', async () => {
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
        // {{doStuff key=}}
        it('should handle macros with empty named arguments', async () => {
            const input = '{{doStuff key=}}';
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
        // {{random "" ""}}
        it('should handle empty unnamed arguments if quoted', async () => {
            const input = '{{random "" ""}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'MacroStart', text: '{{' },
                { type: 'MacroIdentifier', text: 'random' },
                { type: 'Quote', text: '"' },
                { type: 'Quote', text: '"' },
                { type: 'Quote', text: '"' },
                { type: 'Quote', text: '"' },
                { type: 'MacroEnd', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{doStuff special chars #!@&*()}}
        it('should handle macros with special characters in arguments', async () => {
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
        // {{longMacro arg1="value1" arg2="value2" arg3="value3"}}
        it('should handle long macros with multiple arguments', async () => {
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
                { type: 'MacroEnd', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{complexMacro "text with {{nested}} content" key=val}}
        it('should handle macros with complex argument patterns', async () => {
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
        // TODO: test invalid argument name identifiers
    });

    describe('Macro Execution Modifiers', () => {
        // {{!immediate}}
        it('should support ! flag', async () => {
            const input = '{{!immediate}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'MacroStart', text: '{{' },
                { type: 'MacroFlag', text: '!' },
                { type: 'MacroIdentifier', text: 'immediate' },
                { type: 'MacroEnd', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{?lazy}}
        it('should support ? flag', async () => {
            const input = '{{?lazy}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'MacroStart', text: '{{' },
                { type: 'MacroFlag', text: '?' },
                { type: 'MacroIdentifier', text: 'lazy' },
                { type: 'MacroEnd', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{~reevaluate}}
        it('should support ~ flag', async () => {
            const input = '{{~reevaluate}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'MacroStart', text: '{{' },
                { type: 'MacroFlag', text: '~' },
                { type: 'MacroIdentifier', text: 'reevaluate' },
                { type: 'MacroEnd', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{/if}}
        it('should support / flag', async () => {
            const input = '{{/if}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'MacroStart', text: '{{' },
                { type: 'MacroFlag', text: '/' },
                { type: 'MacroIdentifier', text: 'if' },
                { type: 'MacroEnd', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{.variable}}
        it('should support . flag', async () => {
            const input = '{{.variable}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'MacroStart', text: '{{' },
                { type: 'MacroFlag', text: '.' },
                { type: 'MacroIdentifier', text: 'variable' },
                { type: 'MacroEnd', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{$variable}}
        it('should support alias $ flag', async () => {
            const input = '{{$variable}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'MacroStart', text: '{{' },
                { type: 'MacroFlag', text: '$' },
                { type: 'MacroIdentifier', text: 'variable' },
                { type: 'MacroEnd', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{#legacy}}
        it('should support legacy # flag', async () => {
            const input = '{{#legacy}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'MacroStart', text: '{{' },
                { type: 'MacroFlag', text: '#' },
                { type: 'MacroIdentifier', text: 'legacy' },
                { type: 'MacroEnd', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{  !  identifier  }}
        it('support whitespaces around flags', async () => {
            const input = '{{  !  identifier  }}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'MacroStart', text: '{{' },
                { type: 'MacroFlag', text: '!' },
                { type: 'MacroIdentifier', text: 'identifier' },
                { type: 'MacroEnd', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{ ?~lateragain }}
        it('support multiple flags', async () => {
            const input = '{{ ?~lateragain }}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'MacroStart', text: '{{' },
                { type: 'MacroFlag', text: '?' },
                { type: 'MacroFlag', text: '~' },
                { type: 'MacroIdentifier', text: 'lateragain' },
                { type: 'MacroEnd', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{ ! .importantvariable }}
        it('support multiple flags with whitspace', async () => {
            const input = '{{ !.importantvariable }}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'MacroStart', text: '{{' },
                { type: 'MacroFlag', text: '!' },
                { type: 'MacroFlag', text: '.' },
                { type: 'MacroIdentifier', text: 'importantvariable' },
                { type: 'MacroEnd', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{ @unknown }}
        it('do not capture unknown special characters as flag', async () => {
            const input = '{{ @unknown }}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'MacroStart', text: '{{' },
                { type: 'Unknown', text: '@' },
                { type: 'Identifier', text: 'unknown' },
                { type: 'MacroEnd', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{ a shaaark }}
        it('do not capture single letter as flag, but as macro identifiers', async () => {
            const input = '{{ a shaaark }}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'MacroStart', text: '{{' },
                { type: 'MacroIdentifier', text: 'a' },
                { type: 'Identifier', text: 'shaaark' },
                { type: 'MacroEnd', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{ 2 cents }}
        it('do not capture numbers as flag - they are also invalid macro identifiers', async () => {
            const input = '{{ 2 cents }}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'MacroStart', text: '{{' },
                { type: 'Unknown', text: '2' },
                { type: 'Identifier', text: 'cents' },
                { type: 'MacroEnd', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
    });

    describe('Macro While Typing..', () => {
    // {{unclosed_macro word and more. Done.
        it('lexer allows unclosed macros, but tries to parse it as a macro', async () => {
            const input = '{{unclosed_macro word and more. Done.';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'MacroStart', text: '{{' },
                { type: 'MacroIdentifier', text: 'unclosed_macro' },
                { type: 'Identifier', text: 'word' },
                { type: 'Identifier', text: 'and' },
                { type: 'Identifier', text: 'more' },
                { type: 'Unknown', text: '.' },
                { type: 'Identifier', text: 'Done' },
                { type: 'Unknown', text: '.' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
    });

    describe('Macro and Plaintext', () => {
        // Hello, {{user}}!
        it('basic macro tokenization', async () => {
            const input = 'Hello, {{user}}!';
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
        // Just some text here.
        it('should tokenize plaintext only', async () => {
            const input = 'Just some text here.';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Plaintext', text: 'Just some text here.' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
    });

    describe('Error Cases in Macro Lexing', () => {
        // this is an unopened_macro}} and will be done
        it('lexer treats unopened macors as simple plaintext', async () => {
            const input = 'this is an unopened_macro}} and will be done';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Plaintext', text: 'this is an unopened_macro}} and will be done' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // { { not a macro } }
        it('treats opening/clasing with whitspaces between brackets as not macros', async () => {
            const input = '{ { not a macro } }';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Plaintext', text: '{ { not a macro } }' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
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
    // Make sure that lexer errors get correctly marked as errors during testing, even if the resulting tokens might work.
    // The lexer should generally be able to parse all kinds of tokens.
    if (result.errors.length > 0) {
        throw new Error('Lexer errors found\n' + result.errors.map(x => x.message).join('\n'));
    }

    return result.tokens
        // Filter out the mode popper. We don't care aobut that for testing
        .filter(token => token.tokenType.name !== 'EndMode')
        // Extract relevant properties from tokens for comparison
        .map(token => ({
            type: token.tokenType.name,
            text: token.image,
        }));
}
