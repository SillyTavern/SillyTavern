/** @typedef {import('../../public/lib/chevrotain.js').ILexingResult} ILexingResult */
/** @typedef {import('../../public/lib/chevrotain.js').ILexingError} ILexingError */
/** @typedef {{type: string, text: string}} TestableToken */

describe('MacroLexer', () => {
    beforeAll(async () => {
        await page.goto(global.ST_URL);
        await page.waitForFunction('document.getElementById("preloader") === null', { timeout: 0 });

        // Those tests ar evaluating via puppeteer, the need more time to run and finish
        jest.setTimeout(10_000);
    });

    describe('General Macro', () => {
        // {{user}}
        it('should handle macro only', async () => {
            const input = '{{user}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'user' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{}}
        it('should handle empty macro', async () => {
            const input = '{{}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{   user   }}
        it('should handle macro with leading and trailing whitespace inside', async () => {
            const input = '{{   user   }}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'user' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{macro1}}{{macro2}}
        it('should handle multiple sequential macros', async () => {
            const input = '{{macro1}}{{macro2}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'macro1' },
                { type: 'Macro.End', text: '}}' },
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'macro2' },
                { type: 'Macro.End', text: '}}' },
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
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'outerMacro' },
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'innerMacro' },
                { type: 'Macro.End', text: '}}' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{doStuff "inner {{nested}} string"}}
        it('should handle macros with nested quotation marks', async () => {
            const input = '{{doStuff "inner {{nested}} string"}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'doStuff' },
                { type: 'Args.Quote', text: '"' },
                { type: 'Identifier', text: 'inner' },
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'nested' },
                { type: 'Macro.End', text: '}}' },
                { type: 'Identifier', text: 'string' },
                { type: 'Args.Quote', text: '"' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
    });

    describe('Macro Identifier', () => {
        // {{ a }}
        it('allow one-character macro identifiers', async () => {
            const input = '{{ a }}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'a' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{ some macro }}
        it('whitespaces between two valid identifiers will only capture the first as macro identifier', async () => {
            const input = '{{ some macro }}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'some' },
                { type: 'Identifier', text: 'macro' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{my2cents}}
        it('should allow numerics inside the macro identifier', async () => {
            const input = '{{my2cents}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'my2cents' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{SCREAM}}
        it('should allow capslock macro', async () => {
            const input = '{{SCREAM}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'SCREAM' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{some-longer-macro}}
        it('allow dashes in macro identifiers', async () => {
            const input = '{{some-longer-macro}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'some-longer-macro' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{legacy_macro}}
        it('allow underscores as legacy in macro identifiers', async () => {
            const input = '{{legacy_macro}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'legacy_macro' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });

        describe('Error Cases (Macro Identifier)', () => {
            // {{macro!@#%}}
            it('[Error] do not lex special characters as part of the macro identifier', async () => {
                const input = '{{macro!@#%}}';
                const { tokens, errors } = await runLexerGetTokensAndErrors(input);

                const expectedErrors = [
                    { message: 'unexpected character: ->!<- at offset: 7, skipped 4 characters.' },
                ];

                expect(errors).toMatchObject(expectedErrors);

                const expectedTokens = [
                    { type: 'Macro.Start', text: '{{' },
                    { type: 'Macro.Identifier', text: 'macro' },
                    // Do not lex the wrong characters
                    { type: 'Macro.End', text: '}}' },
                ];

                expect(tokens).toEqual(expectedTokens);
            });
            // {{ma!@#%ro}}
            it('[Error] invalid chars in macro identifier are not parsed as valid macro identifier', async () => {
                const input = '{{ma!@#%ro}}';
                const { tokens, errors } = await runLexerGetTokensAndErrors(input);

                const expectedErrors = [
                    { message: 'unexpected character: ->!<- at offset: 4, skipped 6 characters.' },
                ];

                expect(errors).toMatchObject(expectedErrors);

                const expectedTokens = [
                    { type: 'Macro.Start', text: '{{' },
                    { type: 'Macro.Identifier', text: 'ma' },
                    // Do not lex the wrong characters
                    { type: 'Macro.End', text: '}}' },
                ];

                expect(tokens).toEqual(expectedTokens);
            });
        });
    });

    describe('Macro Arguments', () => {
        // {{setvar::myVar::This is Sparta!}}
        it('should tokenize macros with double colons arguments correctly', async () => {
            const input = '{{setvar::myVar::This is Sparta!}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'setvar' },
                { type: 'Args.DoubleColon', text: '::' },
                { type: 'Identifier', text: 'myVar' },
                { type: 'Args.DoubleColon', text: '::' },
                { type: 'Identifier', text: 'This' },
                { type: 'Identifier', text: 'is' },
                { type: 'Identifier', text: 'Sparta' },
                { type: 'Unknown', text: '!' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{doStuff key=MyValue another=AnotherValue}}
        it('should handle named arguments with key=value syntax', async () => {
            const input = '{{doStuff key=MyValue another=AnotherValue}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'doStuff' },
                { type: 'Identifier', text: 'key' },
                { type: 'Args.Equals', text: '=' },
                { type: 'Identifier', text: 'MyValue' },
                { type: 'Identifier', text: 'another' },
                { type: 'Args.Equals', text: '=' },
                { type: 'Identifier', text: 'AnotherValue' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{getvar key="My variable"}}
        it('should handle named arguments with quotation marks', async () => {
            const input = '{{getvar key="My variable"}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'getvar' },
                { type: 'Identifier', text: 'key' },
                { type: 'Args.Equals', text: '=' },
                { type: 'Args.Quote', text: '"' },
                { type: 'Identifier', text: 'My' },
                { type: 'Identifier', text: 'variable' },
                { type: 'Args.Quote', text: '"' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{getvar KEY=big}}
        it('should handle capslock argument name identifiers', async () => {
            const input = '{{getvar KEY=big}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'getvar' },
                { type: 'Identifier', text: 'KEY' },
                { type: 'Args.Equals', text: '=' },
                { type: 'Identifier', text: 'big' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{dostuff longer-key=value}}
        it('should handle argument name identifiers with dashes', async () => {
            const input = '{{dostuff longer-key=value}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'dostuff' },
                { type: 'Identifier', text: 'longer-key' },
                { type: 'Args.Equals', text: '=' },
                { type: 'Identifier', text: 'value' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{macro legacy_key=blah}}
        it('should handle legacy argument name identifiers', async () => {
            const input = '{{macro legacy_key=blah}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'macro' },
                { type: 'Identifier', text: 'legacy_key' },
                { type: 'Args.Equals', text: '=' },
                { type: 'Identifier', text: 'blah' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{roll:1d4}}
        it('should handle argument with legacy one colon syntax to start the arguments', async () => {
            const input = '{{roll:1d4}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'roll' },
                { type: 'Args.Colon', text: ':' },
                { type: 'Unknown', text: '1' },
                { type: 'Identifier', text: 'd4' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{random "this" "and that" "and some more"}}
        it('should handle multiple unnamed arguments in quotation marks', async () => {
            const input = '{{random "this" "and that" "and some more"}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'random' },
                { type: 'Args.Quote', text: '"' },
                { type: 'Identifier', text: 'this' },
                { type: 'Args.Quote', text: '"' },
                { type: 'Args.Quote', text: '"' },
                { type: 'Identifier', text: 'and' },
                { type: 'Identifier', text: 'that' },
                { type: 'Args.Quote', text: '"' },
                { type: 'Args.Quote', text: '"' },
                { type: 'Identifier', text: 'and' },
                { type: 'Identifier', text: 'some' },
                { type: 'Identifier', text: 'more' },
                { type: 'Args.Quote', text: '"' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{doStuff key="My Spaced Value" otherKey=SingleKey}}
        it('should handle named arguments with mixed style', async () => {
            const input = '{{doStuff key="My Spaced Value" otherKey=SingleKey}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'doStuff' },
                { type: 'Identifier', text: 'key' },
                { type: 'Args.Equals', text: '=' },
                { type: 'Args.Quote', text: '"' },
                { type: 'Identifier', text: 'My' },
                { type: 'Identifier', text: 'Spaced' },
                { type: 'Identifier', text: 'Value' },
                { type: 'Args.Quote', text: '"' },
                { type: 'Identifier', text: 'otherKey' },
                { type: 'Args.Equals', text: '=' },
                { type: 'Identifier', text: 'SingleKey' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{doStuff key=}}
        it('should handle macros with empty named arguments', async () => {
            const input = '{{doStuff key=}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'doStuff' },
                { type: 'Identifier', text: 'key' },
                { type: 'Args.Equals', text: '=' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{random "" ""}}
        it('should handle empty unnamed arguments if quoted', async () => {
            const input = '{{random "" ""}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'random' },
                { type: 'Args.Quote', text: '"' },
                { type: 'Args.Quote', text: '"' },
                { type: 'Args.Quote', text: '"' },
                { type: 'Args.Quote', text: '"' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{doStuff special chars #!@&*()}}
        it('should handle macros with special characters in arguments', async () => {
            const input = '{{doStuff special chars #!@&*()}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'doStuff' },
                { type: 'Identifier', text: 'special' },
                { type: 'Identifier', text: 'chars' },
                { type: 'Unknown', text: '#' },
                { type: 'Unknown', text: '!' },
                { type: 'Unknown', text: '@' },
                { type: 'Unknown', text: '&' },
                { type: 'Unknown', text: '*' },
                { type: 'Unknown', text: '(' },
                { type: 'Unknown', text: ')' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{longMacro arg1="value1" arg2="value2" arg3="value3"}}
        it('should handle long macros with multiple arguments', async () => {
            const input = '{{longMacro arg1="value1" arg2="value2" arg3="value3"}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'longMacro' },
                { type: 'Identifier', text: 'arg1' },
                { type: 'Args.Equals', text: '=' },
                { type: 'Args.Quote', text: '"' },
                { type: 'Identifier', text: 'value1' },
                { type: 'Args.Quote', text: '"' },
                { type: 'Identifier', text: 'arg2' },
                { type: 'Args.Equals', text: '=' },
                { type: 'Args.Quote', text: '"' },
                { type: 'Identifier', text: 'value2' },
                { type: 'Args.Quote', text: '"' },
                { type: 'Identifier', text: 'arg3' },
                { type: 'Args.Equals', text: '=' },
                { type: 'Args.Quote', text: '"' },
                { type: 'Identifier', text: 'value3' },
                { type: 'Args.Quote', text: '"' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{complexMacro "text with {{nested}} content" key=val}}
        it('should handle macros with complex argument patterns', async () => {
            const input = '{{complexMacro "text with {{nested}} content" key=val}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'complexMacro' },
                { type: 'Args.Quote', text: '"' },
                { type: 'Identifier', text: 'text' },
                { type: 'Identifier', text: 'with' },
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'nested' },
                { type: 'Macro.End', text: '}}' },
                { type: 'Identifier', text: 'content' },
                { type: 'Args.Quote', text: '"' },
                { type: 'Identifier', text: 'key' },
                { type: 'Args.Equals', text: '=' },
                { type: 'Identifier', text: 'val' },
                { type: 'Macro.End', text: '}}' },
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
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Flag', text: '!' },
                { type: 'Macro.Identifier', text: 'immediate' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{?lazy}}
        it('should support ? flag', async () => {
            const input = '{{?lazy}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Flag', text: '?' },
                { type: 'Macro.Identifier', text: 'lazy' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{~reevaluate}}
        it('should support ~ flag', async () => {
            const input = '{{~reevaluate}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Flag', text: '~' },
                { type: 'Macro.Identifier', text: 'reevaluate' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{/if}}
        it('should support / flag', async () => {
            const input = '{{/if}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Flag', text: '/' },
                { type: 'Macro.Identifier', text: 'if' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{.variable}}
        it('should support . flag', async () => {
            const input = '{{.variable}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Flag', text: '.' },
                { type: 'Macro.Identifier', text: 'variable' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{$variable}}
        it('should support alias $ flag', async () => {
            const input = '{{$variable}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Flag', text: '$' },
                { type: 'Macro.Identifier', text: 'variable' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{#legacy}}
        it('should support legacy # flag', async () => {
            const input = '{{#legacy}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Flag', text: '#' },
                { type: 'Macro.Identifier', text: 'legacy' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{  !  identifier  }}
        it('support whitespaces around flags', async () => {
            const input = '{{  !  identifier  }}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Flag', text: '!' },
                { type: 'Macro.Identifier', text: 'identifier' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{ ?~lateragain }}
        it('support multiple flags', async () => {
            const input = '{{ ?~lateragain }}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Flag', text: '?' },
                { type: 'Macro.Flag', text: '~' },
                { type: 'Macro.Identifier', text: 'lateragain' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{ ! .importantvariable }}
        it('support multiple flags with whitspace', async () => {
            const input = '{{ !.importantvariable }}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Flag', text: '!' },
                { type: 'Macro.Flag', text: '.' },
                { type: 'Macro.Identifier', text: 'importantvariable' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{ a shaaark }}
        it('do not capture single letter as flag, but as macro identifiers', async () => {
            const input = '{{ a shaaark }}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'a' },
                { type: 'Identifier', text: 'shaaark' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });

        describe('Error Cases (Macro Execution Modifiers)', () => {
            // {{ @unknown }}
            it('[Error] do not capture unknown special characters as flag', async () => {
                const input = '{{ @unknown }}';
                const { tokens, errors } = await runLexerGetTokensAndErrors(input);

                const expectedErrors = [
                    { message: 'unexpected character: ->@<- at offset: 3, skipped 1 characters.' },
                ];

                expect(errors).toMatchObject(expectedErrors);

                const expectedTokens = [
                    { type: 'Macro.Start', text: '{{' },
                    // Do not capture '@' as anything, as it's a lexer error
                    { type: 'Macro.Identifier', text: 'unknown' },
                    { type: 'Macro.End', text: '}}' },
                ];

                expect(tokens).toEqual(expectedTokens);
            });
            // {{ 2 cents }}
            it('[Error] do not capture numbers as flag - they are also invalid macro identifiers', async () => {
                const input = '{{ 2 cents }}';
                const { tokens, errors } = await runLexerGetTokensAndErrors(input);

                const expectedErrors = [
                    { message: 'unexpected character: ->2<- at offset: 3, skipped 1 characters.' },
                ];
                expect(errors).toMatchObject(expectedErrors);

                const expectedTokens = [
                    { type: 'Macro.Start', text: '{{' },
                    // Do not capture '2' as anything, as it's a lexer error
                    { type: 'Macro.Identifier', text: 'cents' },
                    { type: 'Macro.End', text: '}}' },
                ];

                expect(tokens).toEqual(expectedTokens);
            });
        });
    });

    describe('Macro Output Modifiers', () => {
        // {{macro | outputModifier}}
        it('should support output modifier without arguments', async () => {
            const input = '{{macro | outputModifier}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'macro' },
                { type: 'Filter.Pipe', text: '|' },
                { type: 'Filter.Identifier', text: 'outputModifier' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{macro | outputModifier arg1=val1 arg2=val2}}
        it('should support output modifier with named arguments', async () => {
            const input = '{{macro | outputModifier arg1=val1 arg2=val2}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'macro' },
                { type: 'Filter.Pipe', text: '|' },
                { type: 'Filter.Identifier', text: 'outputModifier' },
                { type: 'Identifier', text: 'arg1' },
                { type: 'Args.Equals', text: '=' },
                { type: 'Identifier', text: 'val1' },
                { type: 'Identifier', text: 'arg2' },
                { type: 'Args.Equals', text: '=' },
                { type: 'Identifier', text: 'val2' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{macro | outputModifier "unnamed1" "unnamed2"}}
        it('should support output modifier with unnamed arguments', async () => {
            const input = '{{macro | outputModifier "unnamed1" "unnamed2"}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'macro' },
                { type: 'Filter.Pipe', text: '|' },
                { type: 'Filter.Identifier', text: 'outputModifier' },
                { type: 'Args.Quote', text: '"' },
                { type: 'Identifier', text: 'unnamed1' },
                { type: 'Args.Quote', text: '"' },
                { type: 'Args.Quote', text: '"' },
                { type: 'Identifier', text: 'unnamed2' },
                { type: 'Args.Quote', text: '"' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{macro arg1=val1 | outputModifier arg2=val2 "unnamed1"}}
        it('should support macro arguments before output modifier', async () => {
            const input = '{{macro arg1=val1 | outputModifier arg2=val2 "unnamed1"}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'macro' },
                { type: 'Identifier', text: 'arg1' },
                { type: 'Args.Equals', text: '=' },
                { type: 'Identifier', text: 'val1' },
                { type: 'Filter.Pipe', text: '|' },
                { type: 'Filter.Identifier', text: 'outputModifier' },
                { type: 'Identifier', text: 'arg2' },
                { type: 'Args.Equals', text: '=' },
                { type: 'Identifier', text: 'val2' },
                { type: 'Args.Quote', text: '"' },
                { type: 'Identifier', text: 'unnamed1' },
                { type: 'Args.Quote', text: '"' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{macro | outputModifier1 | outputModifier2}}
        it('should support chaining multiple output modifiers', async () => {
            const input = '{{macro | outputModifier1 | outputModifier2}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'macro' },
                { type: 'Filter.Pipe', text: '|' },
                { type: 'Filter.Identifier', text: 'outputModifier1' },
                { type: 'Filter.Pipe', text: '|' },
                { type: 'Filter.Identifier', text: 'outputModifier2' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{macro | outputModifier1 arg1=val1 | outputModifier2 arg2=val2}}
        it('should support chaining multiple output modifiers with arguments', async () => {
            const input = '{{macro | outputModifier1 arg1=val1 | outputModifier2 arg2=val2}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'macro' },
                { type: 'Filter.Pipe', text: '|' },
                { type: 'Filter.Identifier', text: 'outputModifier1' },
                { type: 'Identifier', text: 'arg1' },
                { type: 'Args.Equals', text: '=' },
                { type: 'Identifier', text: 'val1' },
                { type: 'Filter.Pipe', text: '|' },
                { type: 'Filter.Identifier', text: 'outputModifier2' },
                { type: 'Identifier', text: 'arg2' },
                { type: 'Args.Equals', text: '=' },
                { type: 'Identifier', text: 'val2' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{macro|outputModifier}}
        it('should support output modifiers without whitespace', async () => {
            const input = '{{macro|outputModifier}}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'macro' },
                { type: 'Filter.Pipe', text: '|' },
                { type: 'Filter.Identifier', text: 'outputModifier' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{ macro test escaped \| pipe }}
        it('should support escaped pipes, not treating them as output modifiers', async () => {
            const input = '{{ macro test escaped \\| pipe }}';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'macro' },
                { type: 'Identifier', text: 'test' },
                { type: 'Identifier', text: 'escaped' },
                { type: 'Unknown', text: '\\' },
                { type: 'Unknown', text: '|' },
                { type: 'Identifier', text: 'pipe' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });

        describe('Error Cases (Macro Output Modifiers)', () => {
            // {{|macro}}
            it('[Error] should not capture when starting the macro with a pipe', async () => {
                const input = '{{|macro}}';
                const { tokens, errors } = await runLexerGetTokensAndErrors(input);

                const expectedErrors = [
                    { message: 'unexpected character: ->|<- at offset: 2, skipped 1 characters.' },
                ];

                expect(errors).toMatchObject(expectedErrors);

                const expectedTokens = [
                    { type: 'Macro.Start', text: '{{' },
                    { type: 'Macro.Identifier', text: 'macro' },
                    { type: 'Macro.End', text: '}}' },
                ];

                expect(tokens).toEqual(expectedTokens);
            });
            // {{macro | Iam$peci@l}}
            it('[Error] do not allow special characters inside output modifier identifier', async () => {
                const input = '{{macro | Iam$peci@l}}';
                const { tokens, errors } = await runLexerGetTokensAndErrors(input);

                const expectedErrors = [
                    { message: 'unexpected character: ->$<- at offset: 13, skipped 7 characters.' },
                ];

                expect(errors).toMatchObject(expectedErrors);

                const expectedTokens = [
                    { type: 'Macro.Start', text: '{{' },
                    { type: 'Macro.Identifier', text: 'macro' },
                    { type: 'Filter.Pipe', text: '|' },
                    { type: 'Filter.Identifier', text: 'Iam' },
                    { type: 'Macro.End', text: '}}' },
                ];

                expect(tokens).toEqual(expectedTokens);
            });
            // {{macro | !cannotBeImportant }}
            it('[Error] do not allow output modifiers to have execution modifiers', async () => {
                const input = '{{macro | !cannotBeImportant }}';
                const { tokens, errors } = await runLexerGetTokensAndErrors(input);

                const expectedErrors = [
                    { message: 'unexpected character: ->!<- at offset: 10, skipped 1 characters.' },
                ];

                expect(errors).toMatchObject(expectedErrors);

                const expectedTokens = [
                    { type: 'Macro.Start', text: '{{' },
                    { type: 'Macro.Identifier', text: 'macro' },
                    { type: 'Filter.Pipe', text: '|' },
                    { type: 'Filter.Identifier', text: 'cannotBeImportant' },
                    { type: 'Macro.End', text: '}}' },
                ];

                expect(tokens).toEqual(expectedTokens);
            });
            // {{macro | 2invalidIdentifier}}
            it('[Error] should throw an error for an invalid identifier starting with a number', async () => {
                const input = '{{macro | 2invalidIdentifier}}';
                const { tokens, errors } = await runLexerGetTokensAndErrors(input);

                const expectedErrors = [
                    { message: 'unexpected character: ->2<- at offset: 10, skipped 1 characters.' },
                ];

                expect(errors).toMatchObject(expectedErrors);

                const expectedTokens = [
                    { type: 'Macro.Start', text: '{{' },
                    { type: 'Macro.Identifier', text: 'macro' },
                    { type: 'Filter.Pipe', text: '|' },
                    { type: 'Filter.Identifier', text: 'invalidIdentifier' },
                    { type: 'Macro.End', text: '}}' },
                ];

                expect(tokens).toEqual(expectedTokens);
            });
            // {{macro || outputModifier}}
            it('[Error] should throw an error when double pipe is used without an identifier', async () => {
                const input = '{{macro || outputModifier}}';
                const { tokens, errors } = await runLexerGetTokensAndErrors(input);

                const expectedErrors = [
                    { message: 'unexpected character: ->|<- at offset: 9, skipped 1 characters.' },
                ];

                expect(errors).toMatchObject(expectedErrors);

                const expectedTokens = [
                    { type: 'Macro.Start', text: '{{' },
                    { type: 'Macro.Identifier', text: 'macro' },
                    { type: 'Filter.Pipe', text: '|' },
                    { type: 'Filter.Identifier', text: 'outputModifier' },
                    { type: 'Macro.End', text: '}}' },
                ];

                expect(tokens).toEqual(expectedTokens);
            });
        });
    });

    describe('Macro While Typing..', () => {
    // {{unclosed_macro word and more. Done.
        it('lexer allows unclosed macros, but tries to parse it as a macro', async () => {
            const input = '{{unclosed_macro word and more. Done.';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'unclosed_macro' },
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
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'user' },
                { type: 'Macro.End', text: '}}' },
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

    describe('"Error" Cases in Macro Lexing', () => {
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
        it('treats opening/closing with whitspaces between brackets not as macros', async () => {
            const input = '{ { not a macro } }';
            const tokens = await runLexerGetTokens(input);

            const expectedTokens = [
                { type: 'Plaintext', text: '{ { not a macro } }' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // invalid {{ 000 }} followed by correct {{ macro }}
        it('valid macro still works after an invalid macro', async () => {
            const input = 'invalid {{ 000 }} followed by correct {{ macro }}';
            const { tokens, errors } = await runLexerGetTokensAndErrors(input);

            const expectedErrors = [
                { message: 'unexpected character: ->0<- at offset: 11, skipped 3 characters.' },
            ];

            expect(errors).toMatchObject(expectedErrors);

            const expectedTokens = [
                { type: 'Plaintext', text: 'invalid ' },
                { type: 'Macro.Start', text: '{{' },
                // Do not capture '000' as anything, as it's a lexer error
                { type: 'Macro.End', text: '}}' },
                { type: 'Plaintext', text: ' followed by correct ' },
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'macro' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
    });
});

/**
 * Asynchronously runs the MacroLexer on the given input and returns the tokens.
 *
 * Lexer errors will throw an Error. To test and validate lexer errors, use `runLexerGetTokensAndErrors`.
 *
 * @param {string} input - The input string to be tokenized.
 * @returns {Promise<TestableToken[]>} A promise that resolves to an array of tokens.
 */
async function runLexerGetTokens(input) {
    const { tokens, errors } = await runLexerGetTokensAndErrors(input);

    // Make sure that lexer errors get correctly marked as errors during testing, even if the resulting tokens might work.
    // If we don't test for errors, the test should fail.
    if (errors.length > 0) {
        throw new Error('Lexer errors found\n' + errors.map(x => x.message).join('\n'));
    }

    return tokens;
}


/**
 * Asynchronously runs the MacroLexer on the given input and returns the tokens and errors.
 *
 * Use `runLexerGetTokens` if you don't want to explicitly test against lexer errors
 *
 * @param {string} input - The input string to be tokenized.
 * @returns {Promise<{tokens: TestableToken[], errors: LexerError[]}>} A promise that resolves to an object containing an array of tokens and an array of lexer errors.
 */
async function runLexerGetTokensAndErrors(input) {
    const result = await page.evaluate(async (input) => {
        /** @type {import('../../public/scripts/macros/MacroLexer.js')} */
        const { MacroLexer } = await import('./scripts/macros/MacroLexer.js');

        const result = MacroLexer.tokenize(input);
        return result;
    }, input);

    return getTestableTokens(result);
}

/**
 *
 * @param {ILexingResult} result The result from the lexer
 * @returns {{tokens: TestableToken[], errors: ILexingError[]}} The tokens
 */
function getTestableTokens(result) {
    const errors = result.errors;
    const tokens = result.tokens
        // Filter out the mode popper. We don't care aobut that for testing
        //.filter(token => !['ModePopper', 'BeforeEnd'].includes(token.tokenType.name))
        // Extract relevant properties from tokens for comparison
        .map(token => ({
            type: token.tokenType.name,
            text: token.image,
        }));

    return { tokens, errors };
}
