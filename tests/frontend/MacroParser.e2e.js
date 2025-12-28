import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

/** @typedef {import('chevrotain').CstNode} CstNode */
/** @typedef {import('chevrotain').IRecognitionException} IRecognitionException */

/** @typedef {{[tokenName: string]: (string|string[]|TestableCstNode|TestableCstNode[])}} TestableCstNode */
/** @typedef {{name: string, message: string}} TestableRecognitionException */

const DEFAULT_FLATTEN_KEYS = [
    'arguments.Args.DoubleColon',
];
const DEFAULT_IGNORE_KEYS = [

];

test.describe('MacroParser', () => {
    // Currently this test suits runs without ST context. Enable, if ever needed
    test.beforeEach(testSetup.goST);

    test.describe('General Macro', () => {
        // {{user}}
        test('should parse a simple macro', async ({ page }) => {
            const input = '{{user}}';
            const macroCst = await runParser(page, input);

            const expectedCst = {
                'Macro.Start': '{{',
                'Macro.identifier': 'user',
                'Macro.End': '}}',
            };

            expect(macroCst).toEqual(expectedCst);
        });
        // {{  user  }}
        test('should generally handle whitespaces', async ({ page }) => {
            const input = '{{  user  }}';
            const macroCst = await runParser(page, input);

            const expectedCst = {
                'Macro.Start': '{{',
                'Macro.identifier': 'user',
                'Macro.End': '}}',
            };

            expect(macroCst).toEqual(expectedCst);
        });

        test.describe('Error Cases (General Macro)', () => {
            // {{}}
            test('[Error] should throw an error for empty macro', async ({ page }) => {
                const input = '{{}}';
                const { macroCst, errors } = await runParserAndGetErrors(page, input);

                const expectedErrors = [
                    { name: 'NoViableAltException' },
                ];
                const expectedMessage = /Expecting: one of these possible Token sequences:(.*?)\[Macro\.Identifier\](.*?)but found: '}}'/gs;

                expect(macroCst).toBeUndefined();
                expect(errors).toMatchObject(expectedErrors);
                expect(errors[0].message).toMatch(expectedMessage);
            });
            // {{§%€blah}}
            test('[Error] should throw an error for invalid identifier', async ({ page }) => {
                const input = '{{§%€blah}}';
                const { macroCst, errors } = await runParserAndGetErrors(page, input);

                const expectedErrors = [
                    { name: 'NoViableAltException' },
                ];
                const expectedMessage = /Expecting: one of these possible Token sequences:(.*?)\[Macro\.Identifier\](.*?)but found: '§%€blah}}'/gs;

                expect(macroCst).toBeUndefined();
                expect(errors).toMatchObject(expectedErrors);
                expect(errors[0].message).toMatch(expectedMessage);
            });
            // {{user
            test('[Error] should throw an error for incomplete macro', async ({ page }) => {
                const input = '{{user';
                const { macroCst, errors } = await runParserAndGetErrors(page, input);

                const expectedErrors = [
                    { name: 'MismatchedTokenException', message: 'Expecting token of type --> Macro.End <-- but found --> \'\' <--' },
                ];

                expect(macroCst).toBeUndefined();
                expect(errors).toEqual(expectedErrors);
            });

            // something{{user}}
            test('[Error] for testing purposes, macros need to start at the beginning of the string', async ({ page }) => {
                const input = 'something{{user}}';
                const { macroCst, errors } = await runParserAndGetErrors(page, input);

                const expectedErrors = [
                    { name: 'MismatchedTokenException', message: 'Expecting token of type --> Macro.Start <-- but found --> \'something\' <--' },
                ];

                expect(macroCst).toBeUndefined();
                expect(errors).toEqual(expectedErrors);
            });
        });
    });

    test.describe('Arguments Handling', () => {
        // {{getvar::myvar}}
        test('should parse macros with double-colon argument', async ({ page }) => {
            const input = '{{getvar::myvar}}';
            const macroCst = await runParser(page, input, {
                flattenKeys: ['arguments.argument'],
            });
            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'Macro.identifier': 'getvar',
                'arguments': {
                    'separator': '::',
                    'argument': 'myvar',
                },
                'Macro.End': '}}',
            });
        });

        // {{roll:3d20}}
        test('should parse macros with single colon argument', async ({ page }) => {
            const input = '{{roll:3d20}}';
            const macroCst = await runParser(page, input, {
                flattenKeys: ['arguments.argument'],
            });
            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'Macro.identifier': 'roll',
                'arguments': {
                    'separator': ':',
                    'argument': '3d20',
                },
                'Macro.End': '}}',
            });
        });

        // {{setvar::myvar::value}}
        test('should parse macros with multiple double-colon arguments', async ({ page }) => {
            const input = '{{setvar::myvar::value}}';
            const macroCst = await runParser(page, input, {
                flattenKeys: ['arguments.argument'],
                ignoreKeys: ['arguments.Args.DoubleColon'],
            });
            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'Macro.identifier': 'setvar',
                'arguments': {
                    'separator': '::',
                    'argument': ['myvar', 'value'],
                },
                'Macro.End': '}}',
            });
        });

        // {{something::  spaced  }}
        test('should strip spaces around arguments', async ({ page }) => {
            const input = '{{something::  spaced  }}';
            const macroCst = await runParser(page, input, {
                flattenKeys: ['arguments.argument'],
                ignoreKeys: ['arguments.separator', 'arguments.Args.DoubleColon'],
            });
            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'Macro.identifier': 'something',
                'arguments': { 'argument': 'spaced' },
                'Macro.End': '}}',
            });
        });

        // {{something::with:single:colons}}
        test('should treat single colons as part of the argument with double-colon separator', async ({ page }) => {
            const input = '{{something::with:single:colons}}';
            const macroCst = await runParser(page, input, {
                flattenKeys: ['arguments.argument'],
                ignoreKeys: ['arguments.Args.DoubleColon'],
            });
            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'Macro.identifier': 'something',
                'arguments': {
                    'separator': '::',
                    'argument': 'with:single:colons',
                },
                'Macro.End': '}}',
            });
        });

        // {{legacy:something:else}}
        test('should treat single colons as part of the argument even with colon separator', async ({ page }) => {
            const input = '{{legacy:something:else}}';
            const macroCst = await runParser(page, input, {
                flattenKeys: ['arguments.argument'],
                ignoreKeys: ['arguments.separator', 'arguments.Args.Colon'],
            });
            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'Macro.identifier': 'legacy',
                'arguments': { 'argument': 'something:else' },
                'Macro.End': '}}',
            });
        });

        // {{something::}}
        test('should parse double-colon with an empty argument value', async ({ page }) => {
            const input = '{{something::}}';
            const macroCst = await runParser(page, input, {
                flattenKeys: ['arguments.argument'],
            });

            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'Macro.identifier': 'something',
                'arguments': {
                    'separator': '::',
                    'argument': '',
                },
                'Macro.End': '}}',
            });
        });

    });

    test.describe('Legacy Macros', () => {
        // {{roll 1d5}}
        test('should parse legacy roll macro with whitespace separator', async ({ page }) => {
            const input = '{{roll 1d5}}';
            const macroCst = await runParser(page, input, {
                flattenKeys: ['arguments.argument'],
            });

            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'Macro.identifier': 'roll',
                'arguments': { 'argument': '1d5' },
                'Macro.End': '}}',
            });
        });

        // {{roll:2d20}}
        test('should parse legacy roll macro with explicit colon separator', async ({ page }) => {
            const input = '{{roll:2d20}}';
            const macroCst = await runParser(page, input, {
                flattenKeys: ['arguments.argument'],
            });

            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'Macro.identifier': 'roll',
                'arguments': {
                    'separator': ':',
                    'argument': '2d20',
                },
                'Macro.End': '}}',
            });
        });

        // {{roll 20}}
        test('should parse legacy roll macro with numeric argument', async ({ page }) => {
            const input = '{{roll 20}}';
            const macroCst = await runParser(page, input, {
                flattenKeys: ['arguments.argument'],
            });

            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'Macro.identifier': 'roll',
                'arguments': { 'argument': '20' },
                'Macro.End': '}}',
            });
        });

        // {{reverse:something}}
        test('should parse reverse legacy macro with colon argument', async ({ page }) => {
            const input = '{{reverse:something}}';
            const macroCst = await runParser(page, input, {
                flattenKeys: ['arguments.argument'],
            });

            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'Macro.identifier': 'reverse',
                'arguments': {
                    'separator': ':',
                    'argument': 'something',
                },
                'Macro.End': '}}',
            });
        });

        // {{reverse:this contains::double::colons}}
        test('should parse legacy single colon argument that allows double colons inside the argument', async ({ page }) => {
            const input = '{{reverse:this contains::double::colons}}';
            const macroCst = await runParser(page, input, {
                flattenKeys: ['arguments.argument'],
            });

            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'Macro.identifier': 'reverse',
                'arguments': {
                    'separator': ':',
                    'argument': 'this contains::double::colons',
                },
                'Macro.End': '}}',
            });
        });

        // {{//comment-style macro}}
        // TODO: Comment like // is not a valid identifier, needs to be an exception (until we maybe add flags)
        test('should parse legacy comment macro', async ({ page }) => {
            const input = '{{//comment-style macro}}';
            const macroCst = await runParser(page, input, {
                flattenKeys: ['arguments.argument'],
            });

            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'Macro.identifier': '//',
                'arguments': { 'argument': 'comment-style macro' },
                'Macro.End': '}}',
            });
        });

        // {{datetimeformat HH:mm}}
        test('should parse legacy datetime format macro', async ({ page }) => {
            const input = '{{datetimeformat HH:mm}}';
            const macroCst = await runParser(page, input, {
                flattenKeys: ['arguments.argument'],
            });

            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'Macro.identifier': 'datetimeformat',
                'arguments': { 'argument': 'HH:mm' },
                'Macro.End': '}}',
            });
        });

        // Note: Legacy time macros like {{time_UTC+2}} are now handled by the MacroEngine
        // pre-processing pipeline instead of the parser. See MacroEngine.e2e tests for coverage.

        // {{banned "abannedword"}}
        test('should parse legacy banned macro with quoted argument', async ({ page }) => {
            const input = '{{banned "abannedword"}}';
            const macroCst = await runParser(page, input, {
                flattenKeys: ['arguments.argument'],
            });

            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'Macro.identifier': 'banned',
                'arguments': { 'argument': '"abannedword"' },
                'Macro.End': '}}',
            });
        });

        // {{banned ""}}
        test('should parse legacy macro with empty quoted argument', async ({ page }) => {
            const input = '{{banned ""}}';
            const macroCst = await runParser(page, input, {
                flattenKeys: ['arguments.argument'],
            });

            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'Macro.identifier': 'banned',
                'arguments': { 'argument': '""' },
                'Macro.End': '}}',
            });
        });

        // {{setvar::myvar::}}
        test('should allow legacy setvar with empty value argument', async ({ page }) => {
            const input = '{{setvar::myvar::}}';
            const macroCst = await runParser(page, input, {
                flattenKeys: ['arguments.argument'],
            });

            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'Macro.identifier': 'setvar',
                'arguments': {
                    'separator': '::',
                    'argument': ['myvar', ''],
                },
                'Macro.End': '}}',
            });
        });

    });

    test.describe('Comment Macros', () => {
        // {{//comment}}
        test('should parse comment macro without whitespace', async ({ page }) => {
            const input = '{{//comment}}';
            const macroCst = await runParser(page, input, {
                flattenKeys: ['arguments.argument'],
            });
            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'Macro.identifier': '//',
                'Macro.End': '}}',
                'arguments': {
                    'argument': 'comment',
                },
            });
        });

        // {{// comment}}
        test('should parse comment macro with whitespace', async ({ page }) => {
            const input = '{{// comment}}';
            const macroCst = await runParser(page, input, {
                flattenKeys: ['arguments.argument'],
            });
            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'Macro.identifier': '//',
                'Macro.End': '}}',
                'arguments': {
                    'argument': 'comment',
                },
            });
        });


        // {{//!@#$%^&*()_+}}
        test('should parse comment macro with special characters', async ({ page }) => {
            const input = '{{//!@#$%^&*()_+}}';
            const macroCst = await runParser(page, input, {
                flattenKeys: ['arguments.argument'],
            });
            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'Macro.identifier': '//',
                'Macro.End': '}}',
                'arguments': {
                    'argument': '!@#$%^&*()_+',
                },
            });
        });


        // {{//!@flags}}
        test('should parse comment macro starting with flags', async ({ page }) => {
            const input = '{{//!@flags}}';
            const macroCst = await runParser(page, input, {
                flattenKeys: ['arguments.argument'],
            });
            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'Macro.identifier': '//',
                'Macro.End': '}}',
                'arguments': {
                    'argument': '!@flags',
                },
            });
        });

        // {{// This is a multiline comment.
        // This is the second line
        // }}
        test('should parse multiline comments', async ({ page }) => {
            const input = `{{// This is a multiline comment.
This is the second line
}}`;
            const macroCst = await runParser(page, input, {
                flattenKeys: ['arguments.argument'],
            });
            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'Macro.identifier': '//',
                'Macro.End': '}}',
                'arguments': {
                    'argument': 'This is a multiline comment.\nThis is the second line',
                },
            });
        });


    });

    test.describe('Nested Macros', () => {
        // {{outer::word {{inner}}}}
        test('should parse nested macros inside arguments', async ({ page }) => {
            const input = '{{outer::word {{inner}}}}';
            const macroCst = await runParser(page, input, {});
            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'Macro.identifier': 'outer',
                'arguments': {
                    'argument': {
                        'Identifier': 'word',
                        'macro': {
                            'Macro.Start': '{{',
                            'Macro.identifier': 'inner',
                            'Macro.End': '}}',
                        },
                    },
                    'separator': '::',
                },
                'Macro.End': '}}',
            });
        });

        // {{outer::word {{inner1}}{{inner2}}}}
        test('should parse two nested macros next to each other inside an argument', async ({ page }) => {
            const input = '{{outer::word {{inner1}}{{inner2}}}}';
            const macroCst = await runParser(page, input, {});
            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'Macro.identifier': 'outer',
                'arguments': {
                    'argument': {
                        'Identifier': 'word',
                        'macro': [
                            {
                                'Macro.Start': '{{',
                                'Macro.identifier': 'inner1',
                                'Macro.End': '}}',
                            },
                            {
                                'Macro.Start': '{{',
                                'Macro.identifier': 'inner2',
                                'Macro.End': '}}',
                            },
                        ],
                    },
                    'separator': '::',
                },
                'Macro.End': '}}',
            });
        });

        test.describe('Error Cases (Nested Macros)', () => {
            // {{{{macroindentifier}}::value}}
            test('[Error] should throw when there is a nested macro instead of an identifier', async ({ page }) => {
                const input = '{{{{macroindentifier}}::value}}';
                const { macroCst, errors } = await runParserAndGetErrors(page, input);

                expect(macroCst).toBeUndefined();
                expect(errors).toHaveLength(1); // error doesn't really matter. Just don't parse it pls.
            });

            // {{inside{{macro}}me}}
            test('[Error] should throw when there is a macro inside an identifier', async ({ page }) => {
                const input = '{{inside{{macro}}me}}';
                const { macroCst, errors } = await runParserAndGetErrors(page, input);

                expect(macroCst).toBeUndefined();
                expect(errors).toHaveLength(1); // error doesn't really matter. Just don't parse it pls.
            });

        });
    });

    test.describe('Macro Flags', () => {
        // {{!user}}
        test('should parse macro with single flag', async ({ page }) => {
            const input = '{{!user}}';
            const macroCst = await runParser(page, input);

            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'flags': '!',
                'Macro.identifier': 'user',
                'Macro.End': '}}',
            });
        });

        // {{?delayed}}
        test('should parse macro with delayed flag', async ({ page }) => {
            const input = '{{?delayed}}';
            const macroCst = await runParser(page, input);

            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'flags': '?',
                'Macro.identifier': 'delayed',
                'Macro.End': '}}',
            });
        });

        // {{/closing}}
        test('should parse macro with closing block flag', async ({ page }) => {
            const input = '{{/closing}}';
            const macroCst = await runParser(page, input);

            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'flags': '/',
                'Macro.identifier': 'closing',
                'Macro.End': '}}',
            });
        });

        // {{>filtered}}
        test('should parse macro with filter flag', async ({ page }) => {
            const input = '{{>filtered}}';
            const macroCst = await runParser(page, input);

            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'flags': '>',
                'Macro.identifier': 'filtered',
                'Macro.End': '}}',
            });
        });

        // {{!?user}}
        test('should parse macro with multiple flags', async ({ page }) => {
            const input = '{{!?user}}';
            const macroCst = await runParser(page, input);

            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'flags': ['!', '?'],
                'Macro.identifier': 'user',
                'Macro.End': '}}',
            });
        });

        // {{ ! > macro }}
        test('should parse macro with flags and whitespace', async ({ page }) => {
            const input = '{{ ! > macro }}';
            const macroCst = await runParser(page, input);

            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'flags': ['!', '>'],
                'Macro.identifier': 'macro',
                'Macro.End': '}}',
            });
        });

        // {{#legacy}}
        test('should parse macro with legacy hash flag', async ({ page }) => {
            const input = '{{#legacy}}';
            const macroCst = await runParser(page, input);

            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'flags': '#',
                'Macro.identifier': 'legacy',
                'Macro.End': '}}',
            });
        });

        // {{!setvar::value::test}}
        test('should parse macro with flag and arguments', async ({ page }) => {
            const input = '{{!setvar::value::test}}';
            const macroCst = await runParser(page, input, {
                flattenKeys: ['arguments.argument'],
            });

            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'flags': '!',
                'Macro.identifier': 'setvar',
                'arguments': {
                    'separator': '::',
                    'argument': ['value', 'test'],
                },
                'Macro.End': '}}',
            });
        });
    });

    test.describe('Variable Shorthand Syntax', () => {
        // {{.myvar}} - local variable get
        test('should parse local variable shorthand', async ({ page }) => {
            const input = '{{.myvar}}';
            const macroCst = await runParser(page, input);

            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'variableExpr': {
                    'Var.scope': '.',
                    'Var.identifier': 'myvar',
                },
                'Macro.End': '}}',
            });
        });

        // {{$myvar}} - global variable get
        test('should parse global variable shorthand', async ({ page }) => {
            const input = '{{$myvar}}';
            const macroCst = await runParser(page, input);

            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'variableExpr': {
                    'Var.scope': '$',
                    'Var.identifier': 'myvar',
                },
                'Macro.End': '}}',
            });
        });

        // {{.my-var}} - variable with hyphen in name
        test('should parse variable with hyphen in name', async ({ page }) => {
            const input = '{{.my-var}}';
            const macroCst = await runParser(page, input);

            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'variableExpr': {
                    'Var.scope': '.',
                    'Var.identifier': 'my-var',
                },
                'Macro.End': '}}',
            });
        });

        // {{.myvar = value}} - set operator
        test('should parse variable set shorthand', async ({ page }) => {
            const input = '{{.myvar = hello}}';
            const macroCst = await runParser(page, input);

            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'variableExpr': {
                    'Var.scope': '.',
                    'Var.identifier': 'myvar',
                    'variableOperator': {
                        'Var.operator': '=',
                        'Var.value': {
                            'Identifier': 'hello',
                        },
                    },
                },
                'Macro.End': '}}',
            });
        });

        // {{.counter++}} - increment operator
        test('should parse variable increment shorthand', async ({ page }) => {
            const input = '{{.counter++}}';
            const macroCst = await runParser(page, input);

            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'variableExpr': {
                    'Var.scope': '.',
                    'Var.identifier': 'counter',
                    'variableOperator': {
                        'Var.operator': '++',
                    },
                },
                'Macro.End': '}}',
            });
        });

        // {{$counter--}} - decrement operator
        test('should parse global variable decrement shorthand', async ({ page }) => {
            const input = '{{$counter--}}';
            const macroCst = await runParser(page, input);

            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'variableExpr': {
                    'Var.scope': '$',
                    'Var.identifier': 'counter',
                    'variableOperator': {
                        'Var.operator': '--',
                    },
                },
                'Macro.End': '}}',
            });
        });

        // {{.myvar += 5}} - add operator
        test('should parse variable add shorthand', async ({ page }) => {
            const input = '{{.myvar += 5}}';
            const macroCst = await runParser(page, input);

            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'variableExpr': {
                    'Var.scope': '.',
                    'Var.identifier': 'myvar',
                    'variableOperator': {
                        'Var.operator': '+=',
                        'Var.value': {
                            'Unknown': '5',
                        },
                    },
                },
                'Macro.End': '}}',
            });
        });

        // {{.myvar = Hello {{user}}}} - nested macro in value
        test('should parse nested macro in variable value', async ({ page }) => {
            const input = '{{.myvar = Hello {{user}}}}';
            const macroCst = await runParser(page, input);

            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'variableExpr': {
                    'Var.scope': '.',
                    'Var.identifier': 'myvar',
                    'variableOperator': {
                        'Var.operator': '=',
                        'Var.value': {
                            'Identifier': 'Hello',
                            'macro': {
                                'Macro.Start': '{{',
                                'Macro.identifier': 'user',
                                'Macro.End': '}}',
                            },
                        },
                    },
                },
                'Macro.End': '}}',
            });
        });

        // {{ .myvar = spaced }} - whitespace handling
        test('should parse variable shorthand with whitespace', async ({ page }) => {
            const input = '{{ .myvar = spaced }}';
            const macroCst = await runParser(page, input);

            expect(macroCst).toEqual({
                'Macro.Start': '{{',
                'variableExpr': {
                    'Var.scope': '.',
                    'Var.identifier': 'myvar',
                    'variableOperator': {
                        'Var.operator': '=',
                        'Var.value': {
                            'Identifier': 'spaced',
                        },
                    },
                },
                'Macro.End': '}}',
            });
        });
    });
});

/**
 * Runs the input through the MacroParser and returns the result.
 *
 * @param {import('@playwright/test').Page} page - The Playwright page object.
 * @param {string} input - The input string to be parsed.
 * @param {Object} [options={}] Optional arguments
 * @param {string[]} [options.flattenKeys=[]] Optional array of dot-separated keys to flatten
 * @param {string[]} [options.ignoreKeys=[]] Optional array of dot-separated keys to ignore
 * @returns {Promise<TestableCstNode>} A promise that resolves to the result of the MacroParser.
 */
async function runParser(page, input, options = {}) {
    const { cst, errors } = await runParserAndGetErrors(page, input, options);

    // Make sure that parser errors get correctly marked as errors during testing, even if the resulting structure might work.
    // If we don't test for errors, the test should fail.
    if (errors.length > 0) {
        throw new Error('Parser errors found\n' + errors.map(x => x.message).join('\n'));
    }

    return cst;
}

/**
 * Runs the input through the MacroParser and returns the syntax tree result and any parser errors.
 *
 * Use `runParser` if you don't want to explicitly test against parser errors.
 *
 * @param {import('@playwright/test').Page} page - The Playwright page object.
 * @param {string} input - The input string to be parsed.
 * @param {Object} [options={}] Optional arguments
 * @param {string[]} [options.flattenKeys=[]] Optional array of dot-separated keys to flatten
 * @param {string[]} [options.ignoreKeys=[]] Optional array of dot-separated keys to ignore
 * @returns {Promise<{cst: TestableCstNode, errors: TestableRecognitionException[]}>} A promise that resolves to the result of the MacroParser and error list.
 */
async function runParserAndGetErrors(page, input, options = {}) {
    const params = { input, options };
    const { result } = await page.evaluate(async ({ input, options }) => {
        /** @type {import('../../public/scripts/macros/engine/MacroParser.js')} */
        const { MacroParser } = await import('./scripts/macros/engine/MacroParser.js');
        const result = MacroParser.test(input);
        return { result };
    }, params);
    return { cst: simplifyCstNode(result.cst, input, options), errors: simplifyErrors(result.errors) };
}

/**
 * Simplify the parser syntax tree result into an easily testable format.
 *
 * @param {CstNode} result The result from the parser
 * @param {Object} [options={}] Optional arguments
 * @param {string[]} [options.flattenKeys=[]] Optional array of dot-separated keys to flatten
 * @param {string[]} [options.ignoreKeys=[]] Optional array of dot-separated keys to ignore
 * @returns {TestableCstNode} The testable syntax tree
 */
function simplifyCstNode(cst, input, { flattenKeys = [], ignoreKeys = [], ignoreDefaultFlattenKeys = false, ignoreDefaultIgnoreKeys = false } = {}) {
    if (!ignoreDefaultFlattenKeys) flattenKeys = [...flattenKeys, ...DEFAULT_FLATTEN_KEYS];
    if (!ignoreDefaultIgnoreKeys) ignoreKeys = [...ignoreKeys, ...DEFAULT_IGNORE_KEYS];

    /** @returns {TestableCstNode} @param {CstNode} node @param {string[]} path */
    function simplifyNode(node, path = []) {
        if (!node) return node;
        if (Array.isArray(node)) {
            // Single-element arrays are converted to a single string
            if (node.length === 1) {
                return node[0].image || simplifyNode(node[0], path.concat('[]'));
            }
            // For multiple elements, return an array of simplified nodes
            return node.map(child => simplifyNode(child, path.concat('[]')));
        }
        if (node.children) {
            const simplifiedChildren = {};

            // Special handling: merge macroBody children into parent (flatten the structure)
            // This preserves backward compatibility with existing tests after parser refactor
            if (node.children.macroBody && Array.isArray(node.children.macroBody) && node.children.macroBody.length === 1) {
                const macroBody = node.children.macroBody[0];
                if (macroBody.children) {
                    for (const bodyKey in macroBody.children) {
                        node.children[bodyKey] = macroBody.children[bodyKey];
                    }
                }
                delete node.children.macroBody;
            }

            for (const key in node.children) {
                function simplifyChildNode(childNode, path) {
                    if (Array.isArray(childNode)) {
                        // Single-element arrays are converted to a single string
                        if (childNode.length === 1) {
                            return simplifyChildNode(childNode[0], path.concat('[]'));
                        }
                        return childNode.map(child => simplifyChildNode(child, path.concat('[]')));
                    }

                    const flattenKey = path.filter(x => x !== '[]').join('.');
                    if (ignoreKeys.includes(flattenKey)) {
                        return null;
                    } else if (flattenKeys.includes(flattenKey)) {
                        if (!childNode.location) return null;
                        const startOffset = childNode.location.startOffset;
                        const endOffset = childNode.location.endOffset;
                        return input.slice(startOffset, endOffset + 1);
                    } else {
                        return simplifyNode(childNode, path);
                    }
                }

                const simplifiedValue = simplifyChildNode(node.children[key], path.concat(key));
                if (simplifiedValue !== null) simplifiedChildren[key] = simplifiedValue;
            }
            if (Object.values(simplifiedChildren).length === 0) return null;
            return simplifiedChildren;
        }
        return node.image;
    }

    return simplifyNode(cst);
}

/**
 * Simplifies a recognition exceptions into an easily testable format.
 *
 * @param {IRecognitionException[]} errors - The error list containing exceptions to be simplified.
 * @return {TestableRecognitionException[]} - The simplified error list
 */
function simplifyErrors(errors) {
    return errors.map(exception => ({
        name: exception.name,
        message: exception.message,
    }));
}
