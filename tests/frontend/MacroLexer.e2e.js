import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

/** @typedef {import('chevrotain').ILexingResult} ILexingResult */
/** @typedef {import('chevrotain').ILexingError} ILexingError */
/** @typedef {{type: string, text: string}} TestableToken */

test.describe('MacroLexer', () => {
    // Currently this test suits runs without ST context. Enable, if ever needed
    test.beforeEach(testSetup.goST);

    test.describe('General Macro', () => {
        // {{user}}
        test('should handle macro only', async ({ page }) => {
            const input = '{{user}}';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'user' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{}}
        test('should handle empty macro', async ({ page }) => {
            const input = '{{}}';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{   user   }}
        test('should handle macro with leading and trailing whitespace inside', async ({ page }) => {
            const input = '{{   user   }}';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'user' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{macro1}}{{macro2}}
        test('should handle multiple sequential macros', async ({ page }) => {
            const input = '{{macro1}}{{macro2}}';
            const tokens = await runLexerGetTokens(page, input);

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

    test.describe('Macro Nesting', () => {
        // {{outerMacro {{innerMacro}}}}
        test('should handle nested macros', async ({ page }) => {
            const input = '{{outerMacro {{innerMacro}}}}';
            const tokens = await runLexerGetTokens(page, input);

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
        test('should handle macros with nested quotation marks', async ({ page }) => {
            const input = '{{doStuff "inner {{nested}} string"}}';
            const tokens = await runLexerGetTokens(page, input);

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

    test.describe('Macro Identifier', () => {
        // {{ a }}
        test('should allow one-character macro identifiers', async ({ page }) => {
            const input = '{{ a }}';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'a' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{ some macro }}
        test('should only capture the first identifier as macro identifier when there are whitespaces between two valid identifiers', async ({ page }) => {
            const input = '{{ some macro }}';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'some' },
                { type: 'Identifier', text: 'macro' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{my2cents}}
        test('should allow numerics inside the macro identifier', async ({ page }) => {
            const input = '{{my2cents}}';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'my2cents' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{SCREAM}}
        test('should allow capslock macro', async ({ page }) => {
            const input = '{{SCREAM}}';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'SCREAM' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{some-longer-macro}}
        test('should allow dashes in macro identifiers', async ({ page }) => {
            const input = '{{some-longer-macro}}';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'some-longer-macro' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{legacy_macro}}
        test('should allow underscores as legacy in macro identifiers', async ({ page }) => {
            const input = '{{legacy_macro}}';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'legacy_macro' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });

        test.describe('Error Cases (Macro Identifier)', () => {
            // {{macro!@#%}}
            test('[Error] should not lex special characters as part of the macro identifier', async ({ page }) => {
                const input = '{{macro!@#%}}';
                const { tokens, errors } = await runLexerGetTokensAndErrors(page, input);

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
            test('[Error] should not parse invalid chars in macro identifier as valid macro identifier', async ({ page }) => {
                const input = '{{ma!@#%ro}}';
                const { tokens, errors } = await runLexerGetTokensAndErrors(page, input);

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

    test.describe('Macro Arguments', () => {
        // {{setvar::myVar::This is Sparta!}}
        test('should tokenize macros with double colons arguments correctly', async ({ page }) => {
            const input = '{{setvar::myVar::This is Sparta!}}';
            const tokens = await runLexerGetTokens(page, input);

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
        test('should handle named arguments with key=value syntax', async ({ page }) => {
            const input = '{{doStuff key=MyValue another=AnotherValue}}';
            const tokens = await runLexerGetTokens(page, input);

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
        test('should handle named arguments with quotation marks', async ({ page }) => {
            const input = '{{getvar key="My variable"}}';
            const tokens = await runLexerGetTokens(page, input);

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
        test('should handle capslock argument name identifiers', async ({ page }) => {
            const input = '{{getvar KEY=big}}';
            const tokens = await runLexerGetTokens(page, input);

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
        test('should handle argument name identifiers with dashes', async ({ page }) => {
            const input = '{{dostuff longer-key=value}}';
            const tokens = await runLexerGetTokens(page, input);

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
        test('should handle legacy argument name identifiers', async ({ page }) => {
            const input = '{{macro legacy_key=blah}}';
            const tokens = await runLexerGetTokens(page, input);

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
        test('should handle argument with legacy one colon syntax to start the arguments', async ({ page }) => {
            const input = '{{roll:1d4}}';
            const tokens = await runLexerGetTokens(page, input);

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
        test('should handle multiple unnamed arguments in quotation marks', async ({ page }) => {
            const input = '{{random "this" "and that" "and some more"}}';
            const tokens = await runLexerGetTokens(page, input);

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
        test('should handle named arguments with mixed style', async ({ page }) => {
            const input = '{{doStuff key="My Spaced Value" otherKey=SingleKey}}';
            const tokens = await runLexerGetTokens(page, input);

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
        test('should handle macros with empty named arguments', async ({ page }) => {
            const input = '{{doStuff key=}}';
            const tokens = await runLexerGetTokens(page, input);

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
        test('should handle empty unnamed arguments if quoted', async ({ page }) => {
            const input = '{{random "" ""}}';
            const tokens = await runLexerGetTokens(page, input);

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
        test('should handle macros with special characters in arguments', async ({ page }) => {
            const input = '{{doStuff special chars #!@&*()}}';
            const tokens = await runLexerGetTokens(page, input);

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
        test('should handle long macros with multiple arguments', async ({ page }) => {
            const input = '{{longMacro arg1="value1" arg2="value2" arg3="value3"}}';
            const tokens = await runLexerGetTokens(page, input);

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
        test('should handle macros with complex argument patterns', async ({ page }) => {
            const input = '{{complexMacro "text with {{nested}} content" key=val}}';
            const tokens = await runLexerGetTokens(page, input);

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

    test.describe('Macro Execution Modifiers', () => {
        // {{!immediate}}
        test('should support ! flag', async ({ page }) => {
            const input = '{{!immediate}}';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Flag', text: '!' },
                { type: 'Macro.Identifier', text: 'immediate' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{?lazy}}
        test('should support ? flag', async ({ page }) => {
            const input = '{{?lazy}}';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Flag', text: '?' },
                { type: 'Macro.Identifier', text: 'lazy' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{~reevaluate}}
        test('should support ~ flag', async ({ page }) => {
            const input = '{{~reevaluate}}';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Flag', text: '~' },
                { type: 'Macro.Identifier', text: 'reevaluate' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{/if}}
        test('should support / flag', async ({ page }) => {
            const input = '{{/if}}';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Flag', text: '/' },
                { type: 'Macro.Identifier', text: 'if' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{#legacy}}
        test('should support legacy # flag', async ({ page }) => {
            const input = '{{#legacy}}';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Flag', text: '#' },
                { type: 'Macro.Identifier', text: 'legacy' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{  !  identifier  }}
        test('should allow whitespaces around flags', async ({ page }) => {
            const input = '{{  !  identifier  }}';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Flag', text: '!' },
                { type: 'Macro.Identifier', text: 'identifier' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{ ?~lateragain }}
        test('should support multiple flags', async ({ page }) => {
            const input = '{{ ?~lateragain }}';
            const tokens = await runLexerGetTokens(page, input);

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
        test('should support multiple flags with whitespace', async ({ page }) => {
            const input = '{{ !#importantvariable }}';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Flag', text: '!' },
                { type: 'Macro.Flag', text: '#' },
                { type: 'Macro.Identifier', text: 'importantvariable' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{>filtered}}
        test('should support > filter flag as separate token', async ({ page }) => {
            const input = '{{>filtered}}';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.FilterFlag', text: '>' },
                { type: 'Macro.Identifier', text: 'filtered' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{ ! > user }}
        test('should support filter flag combined with other flags', async ({ page }) => {
            const input = '{{ ! > user }}';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Flag', text: '!' },
                { type: 'Macro.FilterFlag', text: '>' },
                { type: 'Macro.Identifier', text: 'user' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // {{ a shaaark }}
        test('should not capture single letter as flag, but as macro identifiers', async ({ page }) => {
            const input = '{{ a shaaark }}';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'a' },
                { type: 'Identifier', text: 'shaaark' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });

        test.describe('"Error" Cases (Macro Execution Modifiers)', () => {
            // {{ @unknown }}
            test('should not capture unknown special characters as flag', async ({ page }) => {
                const input = '{{ @unknown }}';
                const { tokens, errors } = await runLexerGetTokensAndErrors(page, input);

                // No errors expected, as lexer should not error out even on invalid macros
                expect(errors).toMatchObject([]);

                const expectedTokens = [
                    { type: 'Macro.Start', text: '{{' },
                    // Because '@' is invalid in lexer, it'll "pop out" and be captured as plaintext
                    { type: 'Plaintext', text: '@unknown }}' },
                ];

                expect(tokens).toEqual(expectedTokens);
            });
            // {{ 2 cents }}
            test('should not capture numbers as flag - they are also invalid macro identifiers', async ({ page }) => {
                const input = '{{ 2 cents }}';
                const { tokens, errors } = await runLexerGetTokensAndErrors(page, input);

                // No errors expected, as lexer should not error out even on invalid macros
                expect(errors).toMatchObject([]);

                const expectedTokens = [
                    { type: 'Macro.Start', text: '{{' },
                    // Because '2' is invalid in lexer, it'll "pop out" and be captured as plaintext
                    { type: 'Plaintext', text: '2 cents }}' },
                ];

                expect(tokens).toEqual(expectedTokens);
            });
        });
    });

    test.describe('Variable Shorthand Syntax', () => {
        // {{.variable}} - Local variable get
        test('should tokenize local variable shorthand', async ({ page }) => {
            const input = '{{.myvar}}';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Var.LocalPrefix', text: '.' },
                { type: 'Var.Identifier', text: 'myvar' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });

        // {{$variable}} - Global variable get
        test('should tokenize global variable shorthand', async ({ page }) => {
            const input = '{{$myvar}}';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Var.GlobalPrefix', text: '$' },
                { type: 'Var.Identifier', text: 'myvar' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });

        // {{.my-var}} - Variable with hyphen in name
        test('should tokenize variable with hyphen in name', async ({ page }) => {
            const input = '{{.my-var}}';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Var.LocalPrefix', text: '.' },
                { type: 'Var.Identifier', text: 'my-var' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });

        // {{.counter++}} - Increment operator
        test('should tokenize increment operator', async ({ page }) => {
            const input = '{{.counter++}}';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Var.LocalPrefix', text: '.' },
                { type: 'Var.Identifier', text: 'counter' },
                { type: 'Var.Increment', text: '++' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });

        // {{$counter--}} - Decrement operator
        test('should tokenize decrement operator', async ({ page }) => {
            const input = '{{$counter--}}';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Var.GlobalPrefix', text: '$' },
                { type: 'Var.Identifier', text: 'counter' },
                { type: 'Var.Decrement', text: '--' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });

        // {{.myvar = value}} - Set operator
        test('should tokenize set operator with value', async ({ page }) => {
            const input = '{{.myvar = hello}}';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Var.LocalPrefix', text: '.' },
                { type: 'Var.Identifier', text: 'myvar' },
                { type: 'Var.Equals', text: '=' },
                { type: 'Identifier', text: 'hello' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });

        // {{.myvar += 5}} - Add operator
        test('should tokenize add operator with value', async ({ page }) => {
            const input = '{{.myvar += 5}}';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Var.LocalPrefix', text: '.' },
                { type: 'Var.Identifier', text: 'myvar' },
                { type: 'Var.PlusEquals', text: '+=' },
                { type: 'Unknown', text: '5' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });

        // {{ !.importantvariable }} - Variable prefix after flags
        test('should tokenize variable prefix after flags', async ({ page }) => {
            const input = '{{ !.importantvariable }}';
            const tokens = await runLexerGetTokens(page, input);

            // When . is encountered, it triggers variable mode regardless of previous flags
            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Flag', text: '!' },
                { type: 'Var.LocalPrefix', text: '.' },
                { type: 'Var.Identifier', text: 'importantvariable' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });

        // {{.my-long-var-name}} - Variable with multiple hyphens
        test('should tokenize variable with multiple hyphens', async ({ page }) => {
            const input = '{{.my-long-var-name}}';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Var.LocalPrefix', text: '.' },
                { type: 'Var.Identifier', text: 'my-long-var-name' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });

        // {{.myvar = Hello {{user}}}} - Nested macro in value
        test('should tokenize nested macro in variable value', async ({ page }) => {
            const input = '{{.myvar = Hello {{user}}}}';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Var.LocalPrefix', text: '.' },
                { type: 'Var.Identifier', text: 'myvar' },
                { type: 'Var.Equals', text: '=' },
                { type: 'Identifier', text: 'Hello' },
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'user' },
                { type: 'Macro.End', text: '}}' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });

        // {{ .myvar }} - Whitespace around variable shorthand
        test('should tokenize variable shorthand with surrounding whitespace', async ({ page }) => {
            const input = '{{ .myvar }}';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Var.LocalPrefix', text: '.' },
                { type: 'Var.Identifier', text: 'myvar' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });

        // {{$myVar123}} - Variable with numbers
        test('should tokenize variable with numbers in name', async ({ page }) => {
            const input = '{{$myVar123}}';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Var.GlobalPrefix', text: '$' },
                { type: 'Var.Identifier', text: 'myVar123' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });

        // {{.my_var}} - Variable with underscore
        test('should tokenize variable with underscore in name', async ({ page }) => {
            const input = '{{.my_var}}';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Var.LocalPrefix', text: '.' },
                { type: 'Var.Identifier', text: 'my_var' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });

        // {{.counter ++ }} - Increment with whitespace
        test('should tokenize increment operator with surrounding whitespace', async ({ page }) => {
            const input = '{{.counter ++ }}';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Var.LocalPrefix', text: '.' },
                { type: 'Var.Identifier', text: 'counter' },
                { type: 'Var.Increment', text: '++' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
    });

    test.describe('Macro Output Modifiers', () => {
        // {{macro | outputModifier}}
        test('should support output modifier without arguments', async ({ page }) => {
            const input = '{{macro | outputModifier}}';
            const tokens = await runLexerGetTokens(page, input);

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
        test('should support output modifier with named arguments', async ({ page }) => {
            const input = '{{macro | outputModifier arg1=val1 arg2=val2}}';
            const tokens = await runLexerGetTokens(page, input);

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
        test('should support output modifier with unnamed arguments', async ({ page }) => {
            const input = '{{macro | outputModifier "unnamed1" "unnamed2"}}';
            const tokens = await runLexerGetTokens(page, input);

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
        test('should support macro arguments before output modifier', async ({ page }) => {
            const input = '{{macro arg1=val1 | outputModifier arg2=val2 "unnamed1"}}';
            const tokens = await runLexerGetTokens(page, input);

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
        test('should support chaining multiple output modifiers', async ({ page }) => {
            const input = '{{macro | outputModifier1 | outputModifier2}}';
            const tokens = await runLexerGetTokens(page, input);

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
        test('should support chaining multiple output modifiers with arguments', async ({ page }) => {
            const input = '{{macro | outputModifier1 arg1=val1 | outputModifier2 arg2=val2}}';
            const tokens = await runLexerGetTokens(page, input);

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
        test('should support output modifiers without whitespace', async ({ page }) => {
            const input = '{{macro|outputModifier}}';
            const tokens = await runLexerGetTokens(page, input);

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
        test('should support escaped pipes, not treating them as output modifiers', async ({ page }) => {
            const input = '{{ macro test escaped \\| pipe }}';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Macro.Start', text: '{{' },
                { type: 'Macro.Identifier', text: 'macro' },
                { type: 'Identifier', text: 'test' },
                { type: 'Identifier', text: 'escaped' },
                { type: 'Filter.EscapedPipe', text: '\\|' },
                { type: 'Identifier', text: 'pipe' },
                { type: 'Macro.End', text: '}}' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });

        test.describe('Error Cases (Macro Output Modifiers)', () => {
            // {{|macro}}
            test('should not capture when starting the macro with a pipe', async ({ page }) => {
                const input = '{{|macro}}';
                const { tokens, errors } = await runLexerGetTokensAndErrors(page, input);

                // No errors expected, as lexer should not error out even on invalid macros
                expect(errors).toMatchObject([]);

                const expectedTokens = [
                    { type: 'Macro.Start', text: '{{' },
                    { type: 'Plaintext', text: '|macro}}' },
                ];

                expect(tokens).toEqual(expectedTokens);
            });
            // {{macro | Iam$peci@l}}
            test('[Error] should not allow special characters inside output modifier identifier', async ({ page }) => {
                const input = '{{macro | Iam$peci@l}}';
                const { tokens, errors } = await runLexerGetTokensAndErrors(page, input);

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
            test('[Error] should not allow output modifiers to have execution modifiers', async ({ page }) => {
                const input = '{{macro | !cannotBeImportant }}';
                const { tokens, errors } = await runLexerGetTokensAndErrors(page, input);

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
            test('[Error] should not allow invalid identifier starting with a number', async ({ page }) => {
                const input = '{{macro | 2invalidIdentifier}}';
                const { tokens, errors } = await runLexerGetTokensAndErrors(page, input);

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
            test('[Error] should not allow double pipe used without an identifier', async ({ page }) => {
                const input = '{{macro || outputModifier}}';
                const { tokens, errors } = await runLexerGetTokensAndErrors(page, input);

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

    test.describe('Macro While Typing..', () => {
    // {{unclosed_macro word and more. Done.
        test('should allow unclosed macros, but tries to parse it as a macro', async ({ page }) => {
            const input = '{{unclosed_macro word and more. Done.';
            const tokens = await runLexerGetTokens(page, input);

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

    test.describe('Macro and Plaintext', () => {
        // Hello, {{user}}!
        test('should handle basic macro tokenization', async ({ page }) => {
            const input = 'Hello, {{user}}!';
            const tokens = await runLexerGetTokens(page, input);

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
        test('should tokenize plaintext only', async ({ page }) => {
            const input = 'Just some text here.';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Plaintext', text: 'Just some text here.' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
    });

    test.describe('"Error" Cases in Macro Lexing', () => {
        // this is an unopened_macro}} and will be done
        test('should treat unopened macros as simple plaintext', async ({ page }) => {
            const input = 'this is an unopened_macro}} and will be done';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Plaintext', text: 'this is an unopened_macro}} and will be done' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // { { not a macro } }
        test('should treat opening/closing with whitspaces between brackets not as macros', async ({ page }) => {
            const input = '{ { not a macro } }';
            const tokens = await runLexerGetTokens(page, input);

            const expectedTokens = [
                { type: 'Plaintext', text: '{ { not a macro } }' },
            ];

            expect(tokens).toEqual(expectedTokens);
        });
        // invalid {{ 000 }} followed by correct {{ macro }}
        test('should handle valid macro correctly after an invalid macro', async ({ page }) => {
            const input = 'invalid {{ 000 }} followed by correct {{ macro }}';
            const { tokens, errors } = await runLexerGetTokensAndErrors(page, input);

            // No errors expected, as lexer should not error out even on invalid macros
            expect(errors).toMatchObject([]);

            const expectedTokens = [
                { type: 'Plaintext', text: 'invalid ' },
                { type: 'Macro.Start', text: '{{' },
                // '000' is invalid vor the lexer, so it is captured as plaintext
                { type: 'Plaintext', text: '000 }} followed by correct ' },
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
 * @param {import('@playwright/test').Page} page - The Playwright page object.
 * @param {string} input - The input string to be tokenized.
 * @returns {Promise<TestableToken[]>} A promise that resolves to an array of tokens.
 */
async function runLexerGetTokens(page, input) {
    const { tokens, errors } = await runLexerGetTokensAndErrors(page, input);

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
 * Use `runLexerGetTokens` if you don't want to explicitly test against lexer errors.
 *
 * @param {import('@playwright/test').Page} page - The Playwright page object.
 * @param {string} input - The input string to be tokenized.
 * @returns {Promise<{tokens: TestableToken[], errors: LexerError[]}>} A promise that resolves to an object containing an array of tokens and an array of lexer errors.
 */
async function runLexerGetTokensAndErrors(page, input) {
    const result = await page.evaluate(async (input) => {
        /** @type {import('../../public/scripts/macros/engine/MacroLexer.js')} */
        const { MacroLexer } = await import('./scripts/macros/engine/MacroLexer.js');

        const result = MacroLexer.tokenize(input);
        return result;
    }, input);

    return simplifyTokens(result);
}

/**
 * Simplify the lexer tokens result into an easily testable format.
 *
 * @param {ILexingResult} result The result from the lexer
 * @returns {{tokens: TestableToken[], errors: ILexingError[]}} The tokens
 */
function simplifyTokens(result) {
    const errors = result.errors;
    const tokens = result.tokens
        // Extract relevant properties from tokens for comparison
        .map(token => ({
            type: token.tokenType.name,
            text: token.image,
        }));

    return { tokens, errors };
}
