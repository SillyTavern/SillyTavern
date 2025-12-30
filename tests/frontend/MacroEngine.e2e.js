import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test.describe('MacroEngine', () => {
    test.beforeEach(testSetup.awaitST);

    test.describe('Basic evaluation', () => {
        test('should return input unchanged when there are no macros', async ({ page }) => {
            const input = 'Hello world, no macros here.';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe(input);
        });

        test('should evaluate a simple macro without arguments', async ({ page }) => {
            const input = 'Start {{newline}} end.';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('Start \n end.');
        });

        test('should evaluate multiple macros in order', async ({ page }) => {
            const input = 'A {{setvar::test::4}}{{getvar::test}} B {{setvar::test::2}}{{getvar::test}} C';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('A 4 B 2 C');
        });
    });

    test.describe('Unnamed arguments', () => {
        test('should handle normal double-colon separated unnamed argument', async ({ page }) => {
            const input = 'Reversed: {{reverse::abc}}!';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('Reversed: cba!');
        });

        test('should handle (legacy) colon separated unnamed argument', async ({ page }) => {
            const input = 'Reversed: {{reverse:abc}}!';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('Reversed: cba!');
        });

        test('should handle (legacy) colon separated argument as only one, even with more separators (double colon)', async ({ page }) => {
            const input = 'Reversed: {{reverse:abc::def}}!';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('Reversed: fed::cba!');
        });

        test('should handle (legacy) colon separated argument as only one, even with more separators (single colon)', async ({ page }) => {
            const input = 'Reversed: {{reverse:abc:def}}!';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('Reversed: fed:cba!');
        });

        test('should handle (legacy) whitespace separated unnamed argument', async ({ page }) => {
            const input = 'Values: {{roll 1d1}}!';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('Values: 1!');
        });

        test('should handle (legacy) whitespace separated unnamed argument as only one, even with more separators (space)', async ({ page }) => {
            const input = 'Values: {{reverse abc def}}!';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('Values: fed cba!');
        });

        test('should support multi-line arguments for macros', async ({ page }) => {
            const input = 'Result: {{reverse::first line\nsecond line}}'; // "\n" becomes a real newline in the macro argument
            const output = await evaluateWithEngine(page, input);

            const original = 'first line\nsecond line';
            const expectedReversed = Array.from(original).reverse().join('');
            expect(output).toBe(`Result: ${expectedReversed}`);
        });
    });

    test.describe('Nested macros', () => {
        test('should resolve nested macros inside arguments inside-out', async ({ page }) => {
            const input = 'Result: {{setvar::test::0}}{{reverse::{{addvar::test::100}}{{getvar::test}}}}{{setvar::test::0}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('Result: 001');
        });

        // {{wrap::{{upper::x}}::[::]}} -> '[X]'
        test('should resolve nested macros across multiple arguments', async ({ page }) => {
            const input = 'Result: {{setvar::addvname::test}}{{addvar::{{getvar::addvname}}::{{setvar::test::5}}{{getvar::test}}}}{{getvar::test}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('Result: 10');
        });
    });

    test.describe('Unknown macros', () => {
        test('should keep unknown macro syntax but resolve nested macros inside it', async ({ page }) => {
            const input = 'Test: {{unknown::{{newline}}}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('Test: {{unknown::\n}}');
        });

        test('should keep surrounding text inside unknown macros intact', async ({ page }) => {
            const input = 'Test: {{unknown::my {{newline}} example}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('Test: {{unknown::my \n example}}');
        });
    });

    test.describe('Comment macro', () => {
        test('should remove single-line comments with simple body', async ({ page }) => {
            const input = 'Hello{{// comment}}World';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('HelloWorld');
        });

        test('should accept non-word characters immediately after //', async ({ page }) => {
            const input = 'A{{//!@#$%^&*()_+}}B';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('AB');
        });

        test('should ignore additional // sequences inside the comment body', async ({ page }) => {
            const input = 'X{{//comment with // extra // slashes}}Y';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('XY');
        });

        test('should support multi-line comment bodies', async ({ page }) => {
            const input = 'Start{{// line one\nline two\nline three}}End';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('StartEnd');
        });
    });

    test.describe('Trim macro', () => {
        test('should trim content inside scoped trim macro', async ({ page }) => {
            const input = '{{trim}}  hello world  {{/trim}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('hello world');
        });

        test('should trim leading whitespace in scoped trim', async ({ page }) => {
            const input = '{{trim}}\n\n  content{{/trim}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('content');
        });

        test('should trim trailing whitespace in scoped trim', async ({ page }) => {
            const input = '{{trim}}content  \n\n{{/trim}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('content');
        });

        test('should handle scoped trim with macros inside', async ({ page }) => {
            const input = '{{trim}}  Hello {{user}}  {{/trim}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('Hello User');
        });

        test('should handle nested scoped trim', async ({ page }) => {
            const input = '{{trim}}  outer {{trim}}  inner  {{/trim}} outer  {{/trim}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('outer inner outer');
        });
    });

    test.describe('Legacy compatibility', () => {
        test('should strip trim macro and surrounding newlines (legacy behavior)', async ({ page }) => {
            const input = 'foo\n\n{{trim}}\n\nbar';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('foobar');
        });

        test('should handle multiple trim macros in a single string', async ({ page }) => {
            const input = 'A\n\n{{trim}}\n\nB\n\n{{trim}}\n\nC';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('ABC');
        });

        test('should support legacy time macro with positive offset via pre-processing', async ({ page }) => {
            const input = 'Time: {{time_UTC+2}}';
            const output = await evaluateWithEngine(page, input);

            // After pre-processing, this should behave like {{time::UTC+2}} and be resolved by the time macro.
            // We only assert that the placeholder was consumed and some non-empty value was produced.
            expect(output).not.toBe(input);
            expect(output.startsWith('Time: ')).toBeTruthy();
            expect(output.length).toBeGreaterThan('Time: '.length);
        });

        test('should support legacy time macro with negative offset via pre-processing', async ({ page }) => {
            const input = 'Time: {{time_UTC-10}}';
            const output = await evaluateWithEngine(page, input);

            expect(output).not.toBe(input);
            expect(output.startsWith('Time: ')).toBeTruthy();
            expect(output.length).toBeGreaterThan('Time: '.length);
        });

        test('should support legacy <USER> marker via pre-processing', async ({ page }) => {
            const input = 'Hello <USER>!';
            const output = await evaluateWithEngine(page, input);

            // In the default test env, name1Override is "User".
            expect(output).toBe('Hello User!');
        });

        test('should support legacy <BOT> and <CHAR> markers via pre-processing', async ({ page }) => {
            const input = 'Bot: <BOT>, Char: <CHAR>.';
            const output = await evaluateWithEngine(page, input);

            // In the default test env, name2Override is "Character".
            expect(output).toBe('Bot: Character, Char: Character.');
        });

        test('should support legacy <GROUP> and <CHARIFNOTGROUP> markers via pre-processing (non-group fallback)', async ({ page }) => {
            const input = 'Group: <GROUP>, CharIfNotGroup: <CHARIFNOTGROUP>.';
            const output = await evaluateWithEngine(page, input);

            // Without an active group, both markers fall back to the current character name.
            expect(output).toBe('Group: Character, CharIfNotGroup: Character.');
        });
    });

    test.describe('Bracket handling around macros', () => {
        test('should allow single opening brace inside macro arguments', async ({ page }) => {
            const input = 'Test§ {{reverse::my { test}}';
            const { output, hasMacroWarnings, hasMacroErrors } = await evaluateWithEngineAndCaptureMacroLogs(page, input);

            // "my { test" reversed becomes "tset { ym"
            expect(output).toBe('Test§ tset { ym');

            const EXPECT_WARNINGS = false;
            const EXPECT_ERRORS = false;
            expect(hasMacroWarnings).toBe(EXPECT_WARNINGS);
            expect(hasMacroErrors).toBe(EXPECT_ERRORS);
        });

        test('should allow single closing brace inside macro arguments', async ({ page }) => {
            const input = 'Test§ {{reverse::my } test}}';
            const { output, hasMacroWarnings, hasMacroErrors } = await evaluateWithEngineAndCaptureMacroLogs(page, input);

            // "my } test" reversed becomes "tset } ym"
            expect(output).toBe('Test§ tset } ym');

            expect(hasMacroWarnings).toBe(false);
            expect(hasMacroErrors).toBe(false);
        });

        test('should treat unterminated macro with identifier at end of input as plain text', async ({ page }) => {
            const input = 'Test {{ hehe';
            const { output, hasMacroWarnings, hasMacroErrors } = await evaluateWithEngineAndCaptureMacroLogs(page, input);

            expect(output).toBe(input);

            expect(hasMacroWarnings).toBe(true);
            expect(hasMacroErrors).toBe(false);
        });

        test('should treat invalid macro start as plain text when followed by non-identifier characters', async ({ page }) => {
            const input = 'Test {{§§ hehe';
            const { output, hasMacroWarnings, hasMacroErrors } = await evaluateWithEngineAndCaptureMacroLogs(page, input);

            expect(output).toBe(input);

            expect(hasMacroWarnings).toBe(false); // Doesn't even try to recognize this as a macro, doesn't look like one. No warning is fine
            expect(hasMacroErrors).toBe(false);
        });

        test('should treat unterminated macro in the middle of the string as plain text', async ({ page }) => {
            const input = 'Before {{ hehe After';
            const { output, hasMacroWarnings, hasMacroErrors } = await evaluateWithEngineAndCaptureMacroLogs(page, input);

            expect(output).toBe(input);

            expect(hasMacroWarnings).toBe(true);
            expect(hasMacroErrors).toBe(false);
        });

        test('should treat dangling macro start as text and still evaluate subsequent macro', async ({ page }) => {
            const input = 'Test {{ hehe {{user}}';
            const { output, hasMacroWarnings, hasMacroErrors } = await evaluateWithEngineAndCaptureMacroLogs(page, input);

            // Default test env uses name1Override = "User" and name2Override = "Character".
            expect(output).toBe('Test {{ hehe User');

            expect(hasMacroWarnings).toBe(true);
            expect(hasMacroErrors).toBe(false);
        });

        test('should ignore invalid macro start but still evaluate following valid macro', async ({ page }) => {
            const input = 'Test {{&& hehe {{user}}';
            const { output, hasMacroWarnings, hasMacroErrors } = await evaluateWithEngineAndCaptureMacroLogs(page, input);

            // Default test env uses name1Override = "User" and name2Override = "Character".
            expect(output).toBe('Test {{&& hehe User');

            expect(hasMacroWarnings).toBe(false); // Doesn't even try to recognize this as a macro, doesn't look like one. No warning is fine
            expect(hasMacroErrors).toBe(false);
        });

        test('should allow single opening brace immediately before a macro', async ({ page }) => {
            const input = '{{{char}}';
            const { output, hasMacroWarnings, hasMacroErrors } = await evaluateWithEngineAndCaptureMacroLogs(page, input);

            // One literal '{' plus the resolved character name.
            expect(output).toBe('{Character');

            expect(hasMacroWarnings).toBe(false);
            expect(hasMacroErrors).toBe(false);
        });

        test('should allow single closing brace immediately after a macro', async ({ page }) => {
            const input = '{{char}}}';
            const { output, hasMacroWarnings, hasMacroErrors } = await evaluateWithEngineAndCaptureMacroLogs(page, input);

            expect(output).toBe('Character}');

            expect(hasMacroWarnings).toBe(false);
            expect(hasMacroErrors).toBe(false);
        });

        test('should allow single braces around a macro', async ({ page }) => {
            const input = '{{{char}}}';
            const { output, hasMacroWarnings, hasMacroErrors } = await evaluateWithEngineAndCaptureMacroLogs(page, input);

            expect(output).toBe('{Character}');

            expect(hasMacroWarnings).toBe(false);
            expect(hasMacroErrors).toBe(false);
        });

        test('should allow double opening braces immediately before a macro', async ({ page }) => {
            const input = '{{{{char}}';
            const { output, hasMacroWarnings, hasMacroErrors } = await evaluateWithEngineAndCaptureMacroLogs(page, input);

            expect(output).toBe('{{Character');

            expect(hasMacroWarnings).toBe(false);
            expect(hasMacroErrors).toBe(false);
        });

        test('should allow double closing braces immediately after a macro', async ({ page }) => {
            const input = '{{char}}}}';
            const { output, hasMacroWarnings, hasMacroErrors } = await evaluateWithEngineAndCaptureMacroLogs(page, input);

            expect(output).toBe('Character}}');

            expect(hasMacroWarnings).toBe(false);
            expect(hasMacroErrors).toBe(false);
        });

        test('should allow double braces around a macro', async ({ page }) => {
            const input = '{{{{char}}}}';
            const { output, hasMacroWarnings, hasMacroErrors } = await evaluateWithEngineAndCaptureMacroLogs(page, input);

            expect(output).toBe('{{Character}}');

            expect(hasMacroWarnings).toBe(false);
            expect(hasMacroErrors).toBe(false);
        });

        test('should resolve nested macro inside argument with surrounding braces', async ({ page }) => {
            const input = 'Result: {{reverse::pre-{ {{user}} }-post}}';
            const { output, hasMacroWarnings, hasMacroErrors } = await evaluateWithEngineAndCaptureMacroLogs(page, input);

            // Argument "pre-{ User }-post" reversed becomes "tsop-} resU {-erp".
            expect(output).toBe('Result: tsop-} resU {-erp');

            expect(hasMacroWarnings).toBe(false);
            expect(hasMacroErrors).toBe(false);
        });

        test('should handle adjacent macros with no separator', async ({ page }) => {
            const input = '{{char}}{{user}}';
            const { output, hasMacroWarnings, hasMacroErrors } = await evaluateWithEngineAndCaptureMacroLogs(page, input);

            expect(output).toBe('CharacterUser');

            expect(hasMacroWarnings).toBe(false);
            expect(hasMacroErrors).toBe(false);
        });

        test('should handle macros separated only by surrounding braces', async ({ page }) => {
            const input = '{{char}}{ {{user}} }';
            const { output, hasMacroWarnings, hasMacroErrors } = await evaluateWithEngineAndCaptureMacroLogs(page, input);

            expect(output).toBe('Character{ User }');

            expect(hasMacroWarnings).toBe(false);
            expect(hasMacroErrors).toBe(false);
        });

        test('should handle Windows newlines with braces near macros', async ({ page }) => {
            const input = 'Line1 {{char}}\r\n{Line2}';
            const { output, hasMacroWarnings, hasMacroErrors } = await evaluateWithEngineAndCaptureMacroLogs(page, input);

            expect(output).toBe('Line1 Character\r\n{Line2}');

            expect(hasMacroWarnings).toBe(false);
            expect(hasMacroErrors).toBe(false);
        });

        test('should treat stray closing braces outside macros as plain text', async ({ page }) => {
            const input = 'Foo }} bar';
            const { output, hasMacroWarnings, hasMacroErrors } = await evaluateWithEngineAndCaptureMacroLogs(page, input);

            expect(output).toBe(input);

            expect(hasMacroWarnings).toBe(false);
            expect(hasMacroErrors).toBe(false);
        });

        test('should keep stray closing braces and still evaluate following macro', async ({ page }) => {
            const input = 'Foo }} {{user}}';
            const { output, hasMacroWarnings, hasMacroErrors } = await evaluateWithEngineAndCaptureMacroLogs(page, input);

            expect(output).toBe('Foo }} User');

            expect(hasMacroWarnings).toBe(false);
            expect(hasMacroErrors).toBe(false);
        });

        test('should handle stray closing braces before macros as plain text', async ({ page }) => {
            const input = 'Foo {{user}} }}';
            const { output, hasMacroWarnings, hasMacroErrors } = await evaluateWithEngineAndCaptureMacroLogs(page, input);

            expect(output).toBe('Foo User }}');

            expect(hasMacroWarnings).toBe(false);
            expect(hasMacroErrors).toBe(false);
        });
    });

    test.describe('Arity errors', () => {
        test('should not resolve macro without arguments when called with arguments', async ({ page }) => {
            /** @type {string[]} */
            const warnings = [];
            page.on('console', msg => {
                if (msg.type() === 'warning') {
                    warnings.push(msg.text());
                }
            });

            const input = 'Start {{char::extra}} end.';
            const output = await evaluateWithEngine(page, input);

            // Macro text should remain unchanged
            expect(output).toBe(input);

            // Should have logged an arity warning for char
            expect(warnings.some(w => w.includes('Macro "char"') && w.includes('unnamed arguments'))).toBeTruthy();
        });

        test('should not resolve reverse when called without arguments', async ({ page }) => {
            /** @type {string[]} */
            const warnings = [];
            page.on('console', msg => {
                if (msg.type() === 'warning') {
                    warnings.push(msg.text());
                }
            });

            const input = 'Result: {{reverse}}';
            const output = await evaluateWithEngine(page, input);

            expect(output).toBe(input);

            expect(warnings.some(w => w.includes('Macro "reverse"') && w.includes('unnamed arguments'))).toBeTruthy();
        });

        test('should not resolve reverse when called with too many arguments', async ({ page }) => {
            /** @type {string[]} */
            const warnings = [];
            page.on('console', msg => {
                if (msg.type() === 'warning') {
                    warnings.push(msg.text());
                }
            });

            const input = 'Result: {{reverse::a::b}}';
            const output = await evaluateWithEngine(page, input);

            // Macro text should remain unchanged when extra unnamed args are provided
            expect(output).toBe(input);

            // Should have logged an arity warning for reverse
            expect(warnings.some(w => w.includes('Macro "reverse"') && w.includes('unnamed arguments'))).toBeTruthy();
        });

        test('should not resolve list-bounded macro when called outside list bounds', async ({ page }) => {
            /** @type {string[]} */
            const warnings = [];
            page.on('console', msg => {
                if (msg.type() === 'warning') {
                    warnings.push(msg.text());
                }
            });

            // Register a temporary macro with explicit list bounds: exactly 1 required + 1-2 list args
            await page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroRegistry.js')} */
                const { MacroRegistry } = await import('./scripts/macros/engine/MacroRegistry.js');

                MacroRegistry.unregisterMacro('test-list-bounds');
                MacroRegistry.registerMacro('test-list-bounds', {
                    unnamedArgs: 1,
                    list: { min: 1, max: 2 },
                    description: 'Test macro for list bounds.',
                    handler: ({ unnamedArgs, list }) => {
                        const all = [...unnamedArgs, ...(list ?? [])];
                        return all.join('|');
                    },
                });
            });

            // First macro: too few list args (only required arg)
            // Second macro: too many list args (required arg + 3 list entries)
            const input = 'A {{test-list-bounds::base}} B {{test-list-bounds::base::x::y::z}}';
            const output = await evaluateWithEngine(page, input);

            // Both macros should remain unchanged in the output
            expect(output).toBe(input);

            const testWarnings = warnings.filter(w => w.includes('Macro "test-list-bounds"') && w.includes('unnamed arguments'));
            // We expect one warning for each invalid invocation (too few and too many list args)
            expect(testWarnings.length).toBe(2);
        });

        test('should resolve nested macros in arguments, even though the outer macro has wrong number of arguments', async ({ page }) => {
            // Macro {{user ....}} will fail, because it has no args, but {{char}} should still resolve
            const input = 'Result: {{user Something {{char}}}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('Result: {{user Something Character}}');
        });

    });

    test.describe('Type validation', () => {
        test('should not resolve strict typed macro when argument type is invalid', async ({ page }) => {
            /** @type {string[]} */
            const warnings = [];
            page.on('console', msg => {
                if (msg.type() === 'warning') {
                    warnings.push(msg.text());
                }
            });

            await page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroRegistry.js')} */
                const { MacroRegistry } = await import('./scripts/macros/engine/MacroRegistry.js');

                MacroRegistry.unregisterMacro('test-int-strict');
                MacroRegistry.registerMacro('test-int-strict', {
                    unnamedArgs: [
                        { name: 'value', type: 'integer', description: 'Must be an integer.' },
                    ],
                    strictArgs: true,
                    description: 'Strict integer macro for testing type validation.',
                    handler: ({ unnamedArgs: [value] }) => `#${value}#`,
                });
            });

            const input = 'Value: {{test-int-strict::abc}}';
            const output = await evaluateWithEngine(page, input);

            // Strict typed macro should leave the text unchanged when the argument is invalid
            expect(output).toBe(input);

            // A runtime type validation warning should be logged
            expect(warnings.some(w => w.includes('Macro "test-int-strict"') && w.includes('expected type integer'))).toBeTruthy();
        });

        test('should resolve non-strict typed macro when argument type is invalid but still log warning', async ({ page }) => {
            /** @type {string[]} */
            const warnings = [];
            page.on('console', msg => {
                if (msg.type() === 'warning') {
                    warnings.push(msg.text());
                }
            });

            await page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroRegistry.js')} */
                const { MacroRegistry } = await import('./scripts/macros/engine/MacroRegistry.js');

                MacroRegistry.unregisterMacro('test-int-nonstrict');
                MacroRegistry.registerMacro('test-int-nonstrict', {
                    unnamedArgs: [
                        { name: 'value', type: 'integer', description: 'Must be an integer.' },
                    ],
                    strictArgs: false,
                    description: 'Non-strict integer macro for testing type validation.',
                    handler: ({ unnamedArgs: [value] }) => `#${value}#`,
                });
            });

            const input = 'Value: {{test-int-nonstrict::abc}}';
            const output = await evaluateWithEngine(page, input);

            // Non-strict typed macro should still execute, even with invalid type
            expect(output).toBe('Value: #abc#');

            // A runtime type validation warning should still be logged
            expect(warnings.some(w => w.includes('Macro "test-int-nonstrict"') && w.includes('expected type integer'))).toBeTruthy();
        });
    });

    test.describe('Environment', () => {
        test('should expose original content as env.content to macro handlers', async ({ page }) => {
            const input = '{{env-content}}';
            const originalContent = 'This is the full original input string.';

            const output = await page.evaluate(async ({ input, originalContent }) => {
                /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');
                /** @type {import('../../public/scripts/macros/engine/MacroRegistry.js')} */
                const { MacroRegistry } = await import('./scripts/macros/engine/MacroRegistry.js');

                MacroRegistry.unregisterMacro('env-content');
                MacroRegistry.registerMacro('env-content', {
                    description: 'Test macro that returns env.content.',
                    handler: ({ env }) => env.content,
                });

                /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js').MacroEnvRawContext} */
                const rawEnv = {
                    content: originalContent,
                };
                const env = MacroEnvBuilder.buildFromRawEnv(rawEnv);

                return MacroEngine.evaluate(input, env);
            }, { input, originalContent });

            expect(output).toBe(originalContent);
        });
    });

    test.describe('Deterministic pick macro', () => {
        test('should return stable results for the same chat and content', async ({ page }) => {
            // Simulate a consistent chat id hash
            let originalHash;
            await page.evaluate(async ([originalHash]) => {
                /** @type {import('../../public/script.js')} */
                const { chat_metadata } = await import('./script.js');
                originalHash = chat_metadata['chat_id_hash'];
                chat_metadata['chat_id_hash'] = 123456;
            }, [originalHash]);

            const input = 'Choices: {{pick::red::green::blue}}, {{pick::red::green::blue}}.';

            const output1 = await evaluateWithEngine(page, input);
            const output2 = await evaluateWithEngine(page, input);

            // Deterministic: same chat and same content should yield identical output.
            expect(output1).toBe(output2);

            // Sanity check: both picks should resolve to one of the provided options.
            const match = output1.match(/Choices: ([^,]+), ([^.]+)\./);
            expect(match).not.toBeNull();

            if (!match) return;

            const first = match[1].trim();
            const second = match[2].trim();
            const options = ['red', 'green', 'blue'];

            expect(options.includes(first)).toBeTruthy();
            expect(options.includes(second)).toBeTruthy();

            // Restore original hash
            await page.evaluate(async ([originalHash]) => {
                /** @type {import('../../public/script.js')} */
                const { chat_metadata } = await import('./script.js');
                chat_metadata['chat_id_hash'] = originalHash;
            }, [originalHash]);
        });
    });

    test.describe('Dynamic macros', () => {
        test('should not resolve dynamic macro when called with arguments due to strict arity', async ({ page }) => {
            /** @type {string[]} */
            const warnings = [];
            page.on('console', msg => {
                if (msg.type() === 'warning') {
                    warnings.push(msg.text());
                }
            });

            const input = 'Dyn: {{dyn::extra}}';
            const output = await page.evaluate(async (input) => {
                /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

                /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js').MacroEnvRawContext} */
                const rawEnv = {
                    content: input,
                    dynamicMacros: {
                        dyn: () => 'OK',
                    },
                };
                const env = MacroEnvBuilder.buildFromRawEnv(rawEnv);

                return MacroEngine.evaluate(input, env);
            }, input);

            // Dynamic macro with arguments should not resolve because the
            // temporary definition is strictArgs: true and minArgs/maxArgs: 0.
            expect(output).toBe(input);

            // A runtime arity warning for the dynamic macro should be logged
            expect(warnings.some(w => w.includes('Macro "dyn"') && w.includes('unnamed arguments'))).toBeTruthy();
        });
    });

    test.describe('Macro flags', () => {
        test('should resolve macro with legacy hash flag (no effect)', async ({ page }) => {
            // Legacy hash flag should be parsed but have no effect
            const input = 'Hello {{#user}}!';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('Hello User!');
        });

        test('should keep unmatched closing block macro as raw text', async ({ page }) => {
        // Closing block without matching opening should be kept as raw
            const input = '{{/unknown}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('{{/unknown}}');
        });

        test('should keep unmatched closing block macro for existing macro as raw text', async ({ page }) => {
            // Closing block for a known macro (user) without matching opening should stay raw
            const input = '{{/user}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('{{/user}}');
        });

        test('should keep unmatched closing block macro with arguments as raw text', async ({ page }) => {
            // Closing block with arguments should stay raw (closing macros don't take args anyway)
            const input = '{{/getvar::test}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('{{/getvar::test}}');
        });

        test('should keep closing macro raw when surrounded by other content', async ({ page }) => {
            // Closing macro in middle of text should stay raw, other macros should resolve
            const input = 'Hello {{user}}, this {{/char}} is raw, bye {{char}}!';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('Hello User, this {{/char}} is raw, bye Character!');
        });

        test('should resolve scoped macro while keeping unrelated closing raw', async ({ page }) => {
            // Scoped macro resolves normally, unrelated closing stays raw
            const input = '{{setvar::x}}value{{/setvar}}{{/user}}{{getvar::x}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('{{/user}}value');
        });

        test('should pass flags to macro handler', async ({ page }) => {
            // Register a test macro that returns its flags
            const output = await page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');
                /** @type {import('../../public/scripts/macros/engine/MacroRegistry.js')} */
                const { MacroRegistry } = await import('./scripts/macros/engine/MacroRegistry.js');

                MacroRegistry.unregisterMacro('test-flags');
                MacroRegistry.registerMacro('test-flags', {
                    description: 'Test macro that returns its flags.',
                    handler: ({ flags }) => {
                        const activeFlags = flags.raw.join(',') || 'none';
                        return `[${activeFlags}]`;
                    },
                });

                const rawEnv = { content: '' };
                const env = MacroEnvBuilder.buildFromRawEnv(rawEnv);

                return MacroEngine.evaluate('{{test-flags}} / {{!test-flags}} / {{!?test-flags}}', env);
            });

            expect(output).toBe('[none] / [!] / [!,?]');
        });

        test('should correctly identify individual flags in handler', async ({ page }) => {
            const output = await page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');
                /** @type {import('../../public/scripts/macros/engine/MacroRegistry.js')} */
                const { MacroRegistry } = await import('./scripts/macros/engine/MacroRegistry.js');

                MacroRegistry.unregisterMacro('test-flag-check');
                MacroRegistry.registerMacro('test-flag-check', {
                    description: 'Test macro that checks specific flags.',
                    handler: ({ flags }) => {
                        const parts = [];
                        if (flags.immediate) parts.push('immediate');
                        if (flags.delayed) parts.push('delayed');
                        if (flags.filter) parts.push('filter');
                        if (flags.closingBlock) parts.push('closingBlock');
                        if (flags.preserveWhitespace) parts.push('preserveWhitespace');
                        return parts.join('+') || 'noflags';
                    },
                });

                const rawEnv = { content: '' };
                const env = MacroEnvBuilder.buildFromRawEnv(rawEnv);

                const results = [
                    MacroEngine.evaluate('{{test-flag-check}}', env),
                    MacroEngine.evaluate('{{!test-flag-check}}', env),
                    MacroEngine.evaluate('{{?test-flag-check}}', env),
                    MacroEngine.evaluate('{{>test-flag-check}}', env),
                    // Note: {{/test-flag-check}} would stay raw (unmatched closing macro)
                    MacroEngine.evaluate('{{#test-flag-check}}', env),
                    MacroEngine.evaluate('{{!?>test-flag-check}}', env),
                ];
                return results.join(' | ');
            });

            // Closing flag (/) is not tested here as standalone closing macros stay raw
            expect(output).toBe('noflags | immediate | delayed | filter | preserveWhitespace | immediate+delayed+filter');
        });

        test('should handle flags with arguments correctly', async ({ page }) => {
            const input = '{{!reverse::hello}}';
            const output = await evaluateWithEngine(page, input);
            // The flag should not affect the macro resolution
            expect(output).toBe('olleh');
        });

        test('should handle multiple flags with whitespace', async ({ page }) => {
            const output = await page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');
                /** @type {import('../../public/scripts/macros/engine/MacroRegistry.js')} */
                const { MacroRegistry } = await import('./scripts/macros/engine/MacroRegistry.js');

                MacroRegistry.unregisterMacro('test-flags-ws');
                MacroRegistry.registerMacro('test-flags-ws', {
                    description: 'Test macro for flags with whitespace.',
                    handler: ({ flags }) => flags.raw.length.toString(),
                });

                const rawEnv = { content: '' };
                const env = MacroEnvBuilder.buildFromRawEnv(rawEnv);

                return MacroEngine.evaluate('{{ ! ? > test-flags-ws }}', env);
            });

            expect(output).toBe('3');
        });
    });

    test.describe('Scoped macros', () => {
        test('should merge scoped content as last unnamed argument', async ({ page }) => {
            const input = '{{setvar::myvar}}Hello World{{/setvar}}{{getvar::myvar}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('Hello World');
        });

        test('should be equivalent to inline argument syntax', async ({ page }) => {
            const input1 = '{{setvar::myvar::test value}}{{getvar::myvar}}';
            const input2 = '{{setvar::myvar}}test value{{/setvar}}{{getvar::myvar}}';

            const output1 = await evaluateWithEngine(page, input1);
            const output2 = await evaluateWithEngine(page, input2);

            expect(output1).toBe(output2);
        });

        test('should resolve nested macros inside scoped content', async ({ page }) => {
            const input = '{{setvar::myvar}}Hello {{user}}!{{/setvar}}{{getvar::myvar}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('Hello User!');
        });

        test('should handle nested scoped macros with same name', async ({ page }) => {
            // Outer scope sets 'outer', inner scope sets 'inner'
            // Since setvar returns '', the inner macro contributes nothing to outer's content
            const input = '{{setvar::outer}}before {{setvar::inner}}nested{{/setvar}} after{{/setvar}}{{getvar::outer}} | {{getvar::inner}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('before  after | nested'); // Note: double space where inner setvar was
        });

        test('should handle multiple independent scoped macros', async ({ page }) => {
            const input = '{{setvar::a}}first{{/setvar}}{{setvar::b}}second{{/setvar}}[{{getvar::a}}][{{getvar::b}}]';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('[first][second]');
        });

        test('should keep unmatched closing tag as raw text', async ({ page }) => {
            const input = 'Before {{/setvar}} After';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('Before {{/setvar}} After');
        });

        test('should keep second closing tag as raw when already closed', async ({ page }) => {
            const input = '{{setvar::myvar}}content{{/setvar}}{{/setvar}}{{getvar::myvar}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('{{/setvar}}content');
        });

        test('should work with empty scoped content', async ({ page }) => {
            const input = '{{setvar::empty}}{{/setvar}}[{{getvar::empty}}]';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('[]');
        });

        test('should work with multi-line scoped content', async ({ page }) => {
            const input = '{{setvar::multi}}Line 1\nLine 2\nLine 3{{/setvar}}{{getvar::multi}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('Line 1\nLine 2\nLine 3');
        });

        test('should preserve plaintext around scoped macros', async ({ page }) => {
            const input = 'Before {{setvar::x}}value{{/setvar}} After {{getvar::x}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('Before  After value');
        });

        test('should handle deeply nested scoped macros', async ({ page }) => {
            // Since setvar returns '', nested setvars contribute nothing to parent content
            // l3 = "C", l2 = "B" + "" + "B" = "BB", l1 = "A" + "" + "A" = "AA"
            const input = '{{setvar::l1}}A{{setvar::l2}}B{{setvar::l3}}C{{/setvar}}B{{/setvar}}A{{/setvar}}{{getvar::l1}}|{{getvar::l2}}|{{getvar::l3}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('AA|BB|C');
        });

        test('should handle scoped macro with existing arguments', async ({ page }) => {
            // reverse takes 1 arg; scoped content becomes the only arg
            const input = '{{reverse}}hello{{/reverse}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('olleh');
        });

        test('should not match closing tag for different macro name', async ({ page }) => {
            // Opening setvar, closing getvar - should not match
            const input = '{{setvar::x}}content{{/getvar}}{{getvar::x}}';
            const output = await evaluateWithEngine(page, input);
            // setvar without proper closing keeps looking, finds none, so it stays as is
            // getvar closing has no opener, stays as raw
            expect(output).toBe('{{setvar::x}}content{{/getvar}}');
        });

        test('should handle scoped content with special characters', async ({ page }) => {
            const input = '{{setvar::special}}Hello { world } :: test{{/setvar}}{{getvar::special}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('Hello { world } :: test');
        });

        test('should set isScoped to true for scoped macro invocation', async ({ page }) => {
            const output = await page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');
                /** @type {import('../../public/scripts/macros/engine/MacroRegistry.js')} */
                const { MacroRegistry } = await import('./scripts/macros/engine/MacroRegistry.js');

                MacroRegistry.unregisterMacro('test-isscoped');
                MacroRegistry.registerMacro('test-isscoped', {
                    description: 'Test macro that reports isScoped value.',
                    unnamedArgs: [{ name: 'content', type: 'string', description: 'Content' }],
                    handler: ({ isScoped }) => `isScoped:${isScoped}`,
                });

                const rawEnv = { content: '' };
                const env = MacroEnvBuilder.buildFromRawEnv(rawEnv);
                return MacroEngine.evaluate('{{test-isscoped}}content{{/test-isscoped}}', env);
            });
            expect(output).toBe('isScoped:true');
        });

        test('should set isScoped to false for inline argument syntax', async ({ page }) => {
            const output = await page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');
                /** @type {import('../../public/scripts/macros/engine/MacroRegistry.js')} */
                const { MacroRegistry } = await import('./scripts/macros/engine/MacroRegistry.js');

                MacroRegistry.unregisterMacro('test-isscoped');
                MacroRegistry.registerMacro('test-isscoped', {
                    description: 'Test macro that reports isScoped value.',
                    unnamedArgs: [{ name: 'content', type: 'string', description: 'Content' }],
                    handler: ({ isScoped }) => `isScoped:${isScoped}`,
                });

                const rawEnv = { content: '' };
                const env = MacroEnvBuilder.buildFromRawEnv(rawEnv);
                return MacroEngine.evaluate('{{test-isscoped::content}}', env);
            });
            expect(output).toBe('isScoped:false');
        });

        test('should keep scoped macro raw when macro accepts no arguments', async ({ page }) => {
            // {{user}} takes no arguments, so {{user}}content{{/user}} should stay raw
            // But content inside should still resolve
            const input = '{{user}}Hello {{char}}!{{/user}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('{{user}}Hello Character!{{/user}}');
        });

        test('should keep scoped macro raw when argument count exceeds maximum', async ({ page }) => {
            // setvar takes 2 args (name, value). With scoped content as 3rd arg, it exceeds max.
            // When already at max args, scoped content would be extra - should stay raw
            const input = '{{setvar::myvar::existing}}extra{{/setvar}}{{getvar::myvar}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('{{setvar::myvar::existing}}extra{{/setvar}}');
        });

        test('should keep scoped macro raw when argument count is below minimum', async ({ page }) => {
            const output = await page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');
                /** @type {import('../../public/scripts/macros/engine/MacroRegistry.js')} */
                const { MacroRegistry } = await import('./scripts/macros/engine/MacroRegistry.js');

                // Register a macro that requires exactly 3 arguments
                MacroRegistry.unregisterMacro('test-3args');
                MacroRegistry.registerMacro('test-3args', {
                    description: 'Test macro requiring 3 arguments.',
                    unnamedArgs: [
                        { name: 'a', type: 'string', description: 'First' },
                        { name: 'b', type: 'string', description: 'Second' },
                        { name: 'c', type: 'string', description: 'Third' },
                    ],
                    handler: ({ unnamedArgs: [a, b, c] }) => `${a}-${b}-${c}`,
                });

                const rawEnv = { content: '' };
                const env = MacroEnvBuilder.buildFromRawEnv(rawEnv);
                // Only 2 args (1 inline + 1 scoped), but needs 3 - should stay raw
                return MacroEngine.evaluate('{{test-3args::first}}second{{/test-3args}}', env);
            });
            expect(output).toBe('{{test-3args::first}}second{{/test-3args}}');
        });

        test('should evaluate inner macros before outer macro in scoped content', async ({ page }) => {
            const output = await page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');
                /** @type {import('../../public/scripts/macros/engine/MacroRegistry.js')} */
                const { MacroRegistry } = await import('./scripts/macros/engine/MacroRegistry.js');

                // Track evaluation order
                const evalOrder = [];

                MacroRegistry.unregisterMacro('test-outer');
                MacroRegistry.registerMacro('test-outer', {
                    description: 'Outer test macro.',
                    unnamedArgs: [{ name: 'content', type: 'string', description: 'Content' }],
                    handler: ({ unnamedArgs: [content] }) => {
                        evalOrder.push('outer');
                        return `[outer:${content}]`;
                    },
                });

                MacroRegistry.unregisterMacro('test-inner');
                MacroRegistry.registerMacro('test-inner', {
                    description: 'Inner test macro.',
                    handler: () => {
                        evalOrder.push('inner');
                        return 'INNER';
                    },
                });

                const rawEnv = { content: '' };
                const env = MacroEnvBuilder.buildFromRawEnv(rawEnv);
                const result = MacroEngine.evaluate('{{test-outer}}before {{test-inner}} after{{/test-outer}}', env);
                return { result, order: evalOrder.join(',') };
            });
            expect(output.result).toBe('[outer:before INNER after]');
            expect(output.order).toBe('inner,outer');
        });

        test('should handle scoped macro inside another scoped macro content', async ({ page }) => {
            // Both scoped macros should resolve, inner first
            const input = '{{setvar::outer}}A{{setvar::inner}}B{{/setvar}}C{{/setvar}}{{getvar::outer}}|{{getvar::inner}}';
            const output = await evaluateWithEngine(page, input);
            // inner = "B", outer = "A" + "" + "C" = "AC" (setvar returns empty string)
            expect(output).toBe('AC|B');
        });

        test('should auto-trim whitespace-only scoped content to empty', async ({ page }) => {
            const input = '{{setvar::ws}}   {{/setvar}}[{{getvar::ws}}]';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('[]');
        });

        test('should preserve whitespace-only scoped content with # flag', async ({ page }) => {
            const input = '{{#setvar::ws}}   {{/setvar}}[{{getvar::ws}}]';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('[   ]');
        });

        test('should handle scoped macro at start of input', async ({ page }) => {
            const input = '{{setvar::x}}value{{/setvar}}result:{{getvar::x}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('result:value');
        });

        test('should handle scoped macro at end of input', async ({ page }) => {
            const input = 'prefix {{setvar::x}}value{{/setvar}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('prefix ');
        });

        test('should handle consecutive scoped macros', async ({ page }) => {
            const input = '{{setvar::a}}1{{/setvar}}{{setvar::b}}2{{/setvar}}{{setvar::c}}3{{/setvar}}{{getvar::a}}{{getvar::b}}{{getvar::c}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('123');
        });

        test('should handle scoped macro with only macro content (no plaintext)', async ({ page }) => {
            const input = '{{setvar::x}}{{user}}{{/setvar}}{{getvar::x}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('User');
        });

        test('should not match closing tag across different macro instances', async ({ page }) => {
            // Two separate setvar macros - second closing should not match first opening
            const input = '{{setvar::a}}first{{/setvar}}middle{{setvar::b}}second{{/setvar}}[{{getvar::a}}][{{getvar::b}}]';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('middle[first][second]');
        });
    });

    test.describe('{{if}} conditional macro', () => {
        test.describe('with literal values', () => {
            test('should return content when condition is truthy string', async ({ page }) => {
                const input = '{{if::hello::shown}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('shown');
            });

            test('should return empty when condition is empty string', async ({ page }) => {
                const input = '{{if::::hidden}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('');
            });

            test('should return empty when condition is "false"', async ({ page }) => {
                const input = '{{if::false::hidden}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('');
            });

            test('should return empty when condition is "off"', async ({ page }) => {
                const input = '{{if::off::hidden}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('');
            });

            test('should return empty when condition is "0"', async ({ page }) => {
                const input = '{{if::0::hidden}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('');
            });

            test('should return content when condition is "true"', async ({ page }) => {
                const input = '{{if::true::shown}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('shown');
            });

            test('should return content when condition is "1"', async ({ page }) => {
                const input = '{{if::1::shown}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('shown');
            });
        });

        test.describe('with macro name resolution', () => {
            test('should resolve macro name and return content when macro returns truthy', async ({ page }) => {
                // {{char}} returns "Character" (set in test env)
                const input = '{{if char}}Name: {{char}}{{/if}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('Name: Character');
            });

            test('should resolve macro name and return empty when macro returns empty', async ({ page }) => {
                // {{noop}} is a registered macro that always returns empty string
                const input = '{{if noop}}should not show{{/if}}[end]';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('[end]');
            });

            test('should not resolve non-existent macro names (treat as literal)', async ({ page }) => {
                // "notamacro" is not registered, so it's truthy as a literal string
                const input = '{{if::notamacro::shown}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('shown');
            });

            test('should resolve user macro and show content', async ({ page }) => {
                // {{user}} returns "User" (set in test env)
                const input = '{{if user}}Hello {{user}}{{/if}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('Hello User');
            });
        });

        test.describe('with nested macros in condition', () => {
            test('should evaluate nested macro in condition (truthy)', async ({ page }) => {
                const input = '{{setvar::flag::yes}}{{if {{getvar::flag}}}}shown{{/if}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('shown');
            });

            test('should evaluate nested macro in condition (falsy)', async ({ page }) => {
                const input = '{{setvar::flag::}}{{if {{getvar::flag}}}}hidden{{/if}}[end]';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('[end]');
            });

            test('should evaluate nested macro in condition (false string)', async ({ page }) => {
                const input = '{{setvar::flag::false}}{{if {{getvar::flag}}}}hidden{{/if}}[end]';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('[end]');
            });
        });

        test.describe('scoped usage', () => {
            test('should work with scoped content (truthy)', async ({ page }) => {
                const input = '{{if yes}}This is the content{{/if}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('This is the content');
            });

            test('should work with scoped content (falsy)', async ({ page }) => {
                const input = '{{if::}}This should not show{{/if}}[after]';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('[after]');
            });

            test('should handle macros inside scoped content', async ({ page }) => {
                const input = '{{if yes}}Hello {{user}}!{{/if}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('Hello User!');
            });

            test('should handle nested if macros', async ({ page }) => {
                const input = '{{if yes}}outer{{if yes}}inner{{/if}}{{/if}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('outerinner');
            });

            test('should handle nested if with outer false', async ({ page }) => {
                const input = '{{if::}}outer{{if yes}}inner{{/if}}{{/if}}[end]';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('[end]');
            });

            test('should handle nested if with inner false', async ({ page }) => {
                const input = '{{if yes}}outer{{if::}}inner{{/if}}end{{/if}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('outerend');
            });
        });

        test.describe('with space-separated condition', () => {
            test('should work with space-separated condition (truthy)', async ({ page }) => {
                const input = '{{if something}}content{{/if}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('content');
            });

            test('should resolve macro name with space-separated syntax', async ({ page }) => {
                const input = '{{if char}}{{char}} exists{{/if}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('Character exists');
            });
        });

        test.describe('with {{else}} branch', () => {
            test('should return then-branch when condition is truthy', async ({ page }) => {
                const input = '{{if yes}}then{{else}}else{{/if}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('then');
            });

            test('should return else-branch when condition is falsy', async ({ page }) => {
                const input = '{{if::}}then{{else}}else{{/if}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('else');
            });

            test('should return else-branch when condition is "false"', async ({ page }) => {
                const input = '{{if::false}}yes{{else}}no{{/if}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('no');
            });

            test('should handle macros in both branches', async ({ page }) => {
                const input = '{{if yes}}Hello {{user}}{{else}}Goodbye {{char}}{{/if}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('Hello User');
            });

            test('should handle macros in else branch when falsy', async ({ page }) => {
                const input = '{{if::}}Hello {{user}}{{else}}Goodbye {{char}}{{/if}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('Goodbye Character');
            });

            test('should handle nested if-else in then-branch', async ({ page }) => {
                const input = '{{if yes}}outer-then{{if yes}}inner-then{{else}}inner-else{{/if}}{{else}}outer-else{{/if}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('outer-theninner-then');
            });

            test('should handle nested if-else in else-branch', async ({ page }) => {
                const input = '{{if::}}outer-then{{else}}outer-else{{if yes}}inner-then{{else}}inner-else{{/if}}{{/if}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('outer-elseinner-then');
            });

            test('should handle deeply nested if-else', async ({ page }) => {
                const input = '{{if::}}A{{else}}B{{if::}}C{{else}}D{{/if}}{{/if}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('BD');
            });

            test('should return empty else-branch if not provided', async ({ page }) => {
                const input = '{{if::}}content{{/if}}[end]';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('[end]');
            });

            test('should trim whitespace from branches', async ({ page }) => {
                const input = '{{if yes}}  then  {{else}}  else  {{/if}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('then');
            });

            test('should trim newlines from branches', async ({ page }) => {
                const input = '{{if yes}}\n  then\n{{else}}\n  else\n{{/if}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('then');
            });

            test('should trim else branch when selected', async ({ page }) => {
                const input = '{{if::}}\n  then\n{{else}}\n  else\n{{/if}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('else');
            });

            test('should resolve macro name in condition with else branch', async ({ page }) => {
                const input = '{{if char}}Has char{{else}}No char{{/if}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('Has char');
            });

            test('should handle empty macro returning else branch', async ({ page }) => {
                const input = '{{if noop}}Has value{{else}}Empty{{/if}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('Empty');
            });
        });

        test.describe('with inverted condition (!)', () => {
            test('should invert truthy condition to falsy', async ({ page }) => {
                const input = '{{if !yes}}shown{{/if}}[end]';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('[end]');
            });

            test('should invert falsy condition to truthy', async ({ page }) => {
                const input = '{{if !false}}shown{{/if}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('shown');
            });

            test('should invert empty string to truthy', async ({ page }) => {
                const input = '{{if::!}}not shown{{else}}shown{{/if}}';
                const output = await evaluateWithEngine(page, input);
                // Note: "!" is not empty, so it's truthy - but this tests literal ! as value
                expect(output).toBe('not shown');
            });

            test('should work with ! prefix and macro name', async ({ page }) => {
                // noop returns empty string, so !noop should be truthy
                const input = '{{if !noop}}No value{{/if}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('No value');
            });

            test('should work with ! prefix and truthy macro', async ({ page }) => {
                // char returns "Character", so !char should be falsy
                const input = '{{if !char}}No char{{else}}Has char{{/if}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('Has char');
            });

            test('should work with ! prefix and nested macro', async ({ page }) => {
                // Set a variable to empty, then check !{{getvar}}
                const input = '{{setvar::emptyVar::}}{{if !{{getvar::emptyVar}}}}Empty var{{/if}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('Empty var');
            });

            test('should NOT invert when ! comes from resolved value', async ({ page }) => {
                // Set a variable starting with !, then check without ! prefix
                // The ! in the value should NOT cause inversion
                const input = '{{setvar::bangVar::!hello}}{{if {{getvar::bangVar}}}}Has value{{else}}No value{{/if}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('Has value');
            });

            test('should work with else branch on inverted condition', async ({ page }) => {
                const input = '{{if !yes}}then{{else}}else{{/if}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('else');
            });

            test('should work with separator syntax', async ({ page }) => {
                const input = '{{if::!something}}shown{{/if}}[end]';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('[end]');
            });
        });
    });

    test.describe('scoped content auto-trim', () => {
        test('should auto-trim scoped content by default', async ({ page }) => {
            const input = '{{setvar::myvar}}\n  content with whitespace  \n{{/setvar}}[{{getvar::myvar}}]';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('[content with whitespace]');
        });

        test('should auto-trim leading newlines in scoped content', async ({ page }) => {
            const input = '{{setvar::myvar}}\n\n\ntext{{/setvar}}[{{getvar::myvar}}]';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('[text]');
        });

        test('should auto-trim trailing newlines in scoped content', async ({ page }) => {
            const input = '{{setvar::myvar}}text\n\n\n{{/setvar}}[{{getvar::myvar}}]';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('[text]');
        });

        test('should dedent consistent indentation when auto-trimming', async ({ page }) => {
        // Both lines have 2-space indent, so dedent removes it from both
            const input = '{{setvar::myvar}}\n  line1\n  line2  \n{{/setvar}}[{{getvar::myvar}}]';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('[line1\nline2]');
        });

        test('should preserve whitespace with # flag', async ({ page }) => {
            const input = '{{#setvar::myvar}}\n  content  \n{{/setvar}}[{{getvar::myvar}}]';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('[\n  content  \n]');
        });

        test('should preserve leading newlines with # flag', async ({ page }) => {
            const input = '{{#setvar::myvar}}\n\ntext{{/setvar}}[{{getvar::myvar}}]';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('[\n\ntext]');
        });

        test('should preserve trailing newlines with # flag', async ({ page }) => {
            const input = '{{#setvar::myvar}}text\n\n{{/setvar}}[{{getvar::myvar}}]';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('[text\n\n]');
        });

        test('should work with # flag and nested macros', async ({ page }) => {
            const input = '{{#setvar::myvar}}\n  {{char}}  \n{{/setvar}}[{{getvar::myvar}}]';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('[\n  Character  \n]');
        });

        test('should auto-trim with nested macros by default', async ({ page }) => {
            const input = '{{setvar::myvar}}\n  {{char}}  \n{{/setvar}}[{{getvar::myvar}}]';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('[Character]');
        });

        test('should auto-trim {{if}} scoped content', async ({ page }) => {
            const input = '{{if yes}}\n  trimmed  \n{{/if}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('trimmed');
        });

        test('should preserve {{if}} whitespace with # flag', async ({ page }) => {
            const input = '{{#if yes}}\n  preserved  \n{{/if}}';
            const output = await evaluateWithEngine(page, input);
            // With # flag, both outer content AND branch trimming is skipped
            expect(output).toBe('\n  preserved  \n');
        });

        test('should auto-trim {{reverse}} scoped content', async ({ page }) => {
            const input = '{{reverse}}\n  abc  \n{{/reverse}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('cba');
        });

        test('should preserve {{reverse}} whitespace with # flag', async ({ page }) => {
            const input = '{{#reverse}}\n  abc  \n{{/reverse}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('\n  cba  \n');
        });

        test('should dedent consistent indentation from multiline content', async ({ page }) => {
            const input = '{{setvar::myvar}}\n  # Heading\n  Content here\n{{/setvar}}[{{getvar::myvar}}]';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('[# Heading\nContent here]');
        });

        test('should dedent based on first non-empty line indentation', async ({ page }) => {
            const input = '{{setvar::myvar}}\n    line1\n    line2\n    line3\n{{/setvar}}[{{getvar::myvar}}]';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('[line1\nline2\nline3]');
        });

        test('should preserve relative indentation when dedenting', async ({ page }) => {
            const input = '{{setvar::myvar}}\n  parent\n    child\n  sibling\n{{/setvar}}[{{getvar::myvar}}]';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('[parent\n  child\nsibling]');
        });

        test('should handle mixed indentation levels correctly', async ({ page }) => {
            const input = '{{setvar::myvar}}\n  # Header\n    - item1\n    - item2\n  Paragraph\n{{/setvar}}[{{getvar::myvar}}]';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('[# Header\n  - item1\n  - item2\nParagraph]');
        });

        test('should dedent {{if}} branches with indentation', async ({ page }) => {
            const input = '{{if yes}}\n  # Title\n  Body text\n{{/if}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('# Title\nBody text');
        });

        test('should dedent {{if}} else branch with indentation', async ({ page }) => {
            const input = '{{if false}}\n  Then branch\n{{else}}\n  # Else Title\n  Else body\n{{/if}}';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('# Else Title\nElse body');
        });

        test('should not dedent when # flag is set', async ({ page }) => {
            const input = '{{#setvar::myvar}}\n  # Heading\n  Content\n{{/setvar}}[{{getvar::myvar}}]';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('[\n  # Heading\n  Content\n]');
        });

        test('should handle single line content without dedent issues', async ({ page }) => {
            const input = '{{setvar::myvar}}\n  single line\n{{/setvar}}[{{getvar::myvar}}]';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('[single line]');
        });

        test('should handle empty lines in multiline content', async ({ page }) => {
            const input = '{{setvar::myvar}}\n  line1\n\n  line2\n{{/setvar}}[{{getvar::myvar}}]';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('[line1\n\nline2]');
        });

        test('should dedent based on first non-empty line and preserve relative indentation', async ({ page }) => {
            // First non-empty line has 2-space indent, subsequent lines have varying indentation
            // The 2-space base indent should be removed, preserving relative indentation
            const input = '{{setvar::myvar}}\n  First Line\n    Second Line, more indented\n  Third line\n    Fourth line, also more indented\n{{/setvar}}[{{getvar::myvar}}]';
            const output = await evaluateWithEngine(page, input);
            expect(output).toBe('[First Line\n  Second Line, more indented\nThird line\n  Fourth line, also more indented]');
        });
    });

    test.describe('Pre/Post Processor Registration', () => {
        test('should run custom pre-processor before macro evaluation', async ({ page }) => {
            const output = await page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

                // Add a pre-processor that replaces [[USER]] with {{user}}
                const handler = (text) => text.replace(/\[\[USER\]\]/g, '{{user}}');
                MacroEngine.addPreProcessor(handler, { priority: 100, source: 'test:custom-user-marker' });

                try {
                    const input = 'Hello [[USER]]!';
                    const env = MacroEnvBuilder.buildFromRawEnv({ content: input, name1Override: 'TestUser' });
                    return MacroEngine.evaluate(input, env);
                } finally {
                    MacroEngine.removePreProcessor(handler);
                }
            });

            expect(output).toBe('Hello TestUser!');
        });

        test('should run custom post-processor after macro evaluation', async ({ page }) => {
            const output = await page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

                // Add a post-processor that wraps output in brackets
                const handler = (text) => `[${text}]`;
                MacroEngine.addPostProcessor(handler, { priority: 100, source: 'test:bracket-wrapper' });

                try {
                    const input = 'Hello {{user}}!';
                    const env = MacroEnvBuilder.buildFromRawEnv({ content: input, name1Override: 'TestUser' });
                    return MacroEngine.evaluate(input, env);
                } finally {
                    MacroEngine.removePostProcessor(handler);
                }
            });

            expect(output).toBe('[Hello TestUser!]');
        });

        test('should execute pre-processors in priority order (lower first)', async ({ page }) => {
            const output = await page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

                // First handler (priority 200) appends 'B'
                const handlerB = (text) => text + 'B';
                // Second handler (priority 100) appends 'A' - should run first despite being registered second
                const handlerA = (text) => text + 'A';

                MacroEngine.addPreProcessor(handlerB, { priority: 200, source: 'test:append-b' });
                MacroEngine.addPreProcessor(handlerA, { priority: 100, source: 'test:append-a' });

                try {
                    const input = 'X';
                    const env = MacroEnvBuilder.buildFromRawEnv({ content: input });
                    return MacroEngine.evaluate(input, env);
                } finally {
                    MacroEngine.removePreProcessor(handlerA);
                    MacroEngine.removePreProcessor(handlerB);
                }
            });

            // Priority 100 (A) runs before priority 200 (B), so: X -> XA -> XAB
            expect(output).toBe('XAB');
        });

        test('should execute post-processors in priority order (lower first)', async ({ page }) => {
            const output = await page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

                // First handler (priority 200) wraps with ()
                const handlerParen = (text) => `(${text})`;
                // Second handler (priority 100) wraps with [] - should run first
                const handlerBracket = (text) => `[${text}]`;

                MacroEngine.addPostProcessor(handlerParen, { priority: 200, source: 'test:wrap-paren' });
                MacroEngine.addPostProcessor(handlerBracket, { priority: 100, source: 'test:wrap-bracket' });

                try {
                    const input = 'X';
                    const env = MacroEnvBuilder.buildFromRawEnv({ content: input });
                    return MacroEngine.evaluate(input, env);
                } finally {
                    MacroEngine.removePostProcessor(handlerBracket);
                    MacroEngine.removePostProcessor(handlerParen);
                }
            });

            // Priority 100 ([]) runs before priority 200 (()), so: X -> [X] -> ([X])
            expect(output).toBe('([X])');
        });

        test('should successfully remove a registered pre-processor', async ({ page }) => {
            const output = await page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

                const handler = (text) => text + '-ADDED';
                MacroEngine.addPreProcessor(handler, { priority: 100, source: 'test:to-remove' });

                // Remove it immediately
                const removed = MacroEngine.removePreProcessor(handler);

                const input = 'Test';
                const env = MacroEnvBuilder.buildFromRawEnv({ content: input });
                const result = MacroEngine.evaluate(input, env);

                return { result, removed };
            });

            expect(output.removed).toBe(true);
            expect(output.result).toBe('Test'); // No '-ADDED' suffix
        });

        test('should return false when removing non-existent processor', async ({ page }) => {
            const removed = await page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');

                const handler = () => 'never registered';
                return MacroEngine.removePreProcessor(handler);
            });

            expect(removed).toBe(false);
        });

        test('should pass env to pre-processor handlers', async ({ page }) => {
            const output = await page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

                // Pre-processor that uses env to get the user name
                /** @param {string} text @param {import('../../public/scripts/macros/engine/MacroEnv.types.js').MacroEnv} env */
                const handler = (text, env) => text.replace('__NAME__', env.names.user);
                MacroEngine.addPreProcessor(handler, { priority: 100, source: 'test:env-access' });

                try {
                    const input = 'Hello __NAME__!';
                    const env = MacroEnvBuilder.buildFromRawEnv({ content: input, name1Override: 'EnvUser' });
                    return MacroEngine.evaluate(input, env);
                } finally {
                    MacroEngine.removePreProcessor(handler);
                }
            });

            expect(output).toBe('Hello EnvUser!');
        });

        test('should pass env to post-processor handlers', async ({ page }) => {
            const output = await page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

                // Post-processor that appends the character name from env
                /** @param {string} text @param {import('../../public/scripts/macros/engine/MacroEnv.types.js').MacroEnv} env */
                const handler = (text, env) => `${text} (by ${env.names.char})`;
                MacroEngine.addPostProcessor(handler, { priority: 100, source: 'test:env-access-post' });

                try {
                    const input = 'Message';
                    const env = MacroEnvBuilder.buildFromRawEnv({ content: input, name2Override: 'EnvChar' });
                    return MacroEngine.evaluate(input, env);
                } finally {
                    MacroEngine.removePostProcessor(handler);
                }
            });

            expect(output).toBe('Message (by EnvChar)');
        });
    });

    test.describe('Variable Shorthand Syntax', () => {
        // {{.myvar}} - get local variable
        test('should get local variable with . shorthand', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar}}', { local: { myvar: 'hello' } });
            expect(output).toBe('hello');
        });

        // {{$myvar}} - get global variable
        test('should get global variable with $ shorthand', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{$myvar}}', { global: { myvar: 'world' } });
            expect(output).toBe('world');
        });

        // {{.myvar = value}} - set local variable (setvar returns empty string)
        test('should set local variable with = shorthand', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar = test}}Value: {{.myvar}}', { local: {} });
            // setvar returns '', then "Value: ", then getvar returns "test"
            expect(output).toBe('Value: test');
        });

        // {{.counter++}} - increment local variable (incvar returns new value)
        test('should increment local variable with ++ shorthand', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.counter++}}', { local: { counter: '5' } });
            expect(output).toBe('6');
        });

        // {{$counter--}} - decrement global variable (decvar returns new value)
        test('should decrement global variable with -- shorthand', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{$counter--}}', { global: { counter: '10' } });
            expect(output).toBe('9');
        });

        // {{.myvar += 5}} - add to local variable (addvar returns empty string)
        test('should add to local variable with += shorthand', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar += 3}}Then: {{.myvar}}', { local: { myvar: '7' } });
            // addvar returns '', then "Then: ", then getvar returns "10"
            expect(output).toBe('Then: 10');
        });

        // Nested macro in value: {{.myvar = {{user}}}}
        test('should support nested macro in variable value', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.greeting = Hello {{user}}}}{{.greeting}}', { local: {} });
            // setvar returns '', then getvar returns "Hello User"
            expect(output).toBe('Hello User');
        });

        // Whitespace handling: {{ .myvar = value }}
        test('should handle whitespace in variable shorthand', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{ .myvar = spaced }}{{.myvar}}', { local: {} });
            // setvar returns '', then getvar returns "spaced"
            expect(output).toBe('spaced');
        });

        // Variable with hyphen in name: {{.my-var}}
        test('should handle variable name with hyphens', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.my-var}}', { local: { 'my-var': 'hyphenated' } });
            expect(output).toBe('hyphenated');
        });

        // Variable with underscore: {{.my_var}}
        test('should handle variable name with underscores', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.my_var}}', { local: { 'my_var': 'underscored' } });
            expect(output).toBe('underscored');
        });

        // Non-existent variable returns empty string
        test('should return empty string for non-existent variable', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, 'Value:[{{.nonexistent}}]', { local: {} });
            expect(output).toBe('Value:[]');
        });

        // Increment non-existent variable (should start from 0)
        test('should increment non-existent variable starting from 0', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.newcounter++}}', { local: {} });
            expect(output).toBe('1');
        });

        // Chain multiple operations
        test('should handle multiple variable operations in sequence', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.x = 5}}{{.x++}}{{.x += 10}}{{.x}}', { local: {} });
            // setvar returns '', incvar returns '6', addvar returns '', getvar returns '16'
            expect(output).toBe('616');
        });
    });

    test.describe('Variable Shorthand in {{if}} Macro', () => {
        // {{if .myvar}}...{{/if}} - truthy local variable
        test('should evaluate truthy local variable in if condition', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{if .flag}}Yes{{/if}}', { local: { flag: '1' } });
            expect(output).toBe('Yes');
        });

        // {{if .myvar}}...{{/if}} - falsy local variable
        test('should evaluate falsy local variable in if condition', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{if .flag}}Yes{{/if}}', { local: { flag: '' } });
            expect(output).toBe('');
        });

        // {{if $globalvar}}...{{/if}} - truthy global variable
        test('should evaluate truthy global variable in if condition', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{if $enabled}}Active{{/if}}', { global: { enabled: 'true' } });
            expect(output).toBe('Active');
        });

        // {{if !.myvar}}...{{/if}} - inverted condition
        test('should evaluate inverted variable condition', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{if !.flag}}Not set{{/if}}', { local: { flag: '' } });
            expect(output).toBe('Not set');
        });

        // {{if !$globalvar}}...{{/if}} - inverted global
        test('should evaluate inverted global variable condition', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{if !$disabled}}Enabled{{/if}}', { global: { disabled: '' } });
            expect(output).toBe('Enabled');
        });

        // {{if ! .myvar}}...{{/if}} - inverted with whitespace
        test('should evaluate inverted condition with whitespace after !', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{if ! .empty}}Empty{{/if}}', { local: { empty: '' } });
            expect(output).toBe('Empty');
        });

        // Non-existent variable is falsy
        test('should treat non-existent variable as falsy in if condition', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{if .nonexistent}}Yes{{else}}No{{/if}}', { local: {} });
            expect(output).toBe('No');
        });

        // {{if .myvar}}...{{else}}...{{/if}} - with else branch
        test('should handle else branch with variable shorthand', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{if .active}}On{{else}}Off{{/if}}', { local: { active: 'yes' } });
            expect(output).toBe('On');
        });

        // Variable with hyphen in if condition
        test('should handle variable with hyphen in if condition', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{if .is-valid}}Valid{{/if}}', { local: { 'is-valid': '1' } });
            expect(output).toBe('Valid');
        });

        // Combine set and if
        test('should work with variable set before if check', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.ready = yes}}{{if .ready}}Ready!{{/if}}', { local: {} });
            expect(output).toBe('Ready!');
        });

        // Zero is falsy
        test('should treat zero as falsy in if condition', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{if .count}}Has count{{else}}No count{{/if}}', { local: { count: '0' } });
            expect(output).toBe('No count');
        });

        // Non-zero number is truthy
        test('should treat non-zero number as truthy in if condition', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{if .count}}Count: {{.count}}{{/if}}', { local: { count: '42' } });
            expect(output).toBe('Count: 42');
        });
    });
});

/**
 * Evaluates the given input string using the MacroEngine inside the browser
 * context, ensuring that the core macros are registered.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} input
 * @returns {Promise<string>}
 */
async function evaluateWithEngine(page, input) {
    const result = await page.evaluate(async (input) => {
        /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
        const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
        /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
        const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

        /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js').MacroEnvRawContext} */
        const rawEnv = {
            content: input,
            name1Override: 'User',
            name2Override: 'Character',
        };
        const env = MacroEnvBuilder.buildFromRawEnv(rawEnv);

        const output = await MacroEngine.evaluate(input, env);
        return output;
    }, input);

    return result;
}

/**
 * Evaluates the given input string while capturing whether any macro-related
 * warnings or errors were logged to the browser console.
 *
 * This is useful for tests that want to assert both the resolved output and
 * whether the lexer/parser/engine reported issues (e.g. unterminated macros).
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} input
 * @returns {Promise<{ output: string, hasMacroWarnings: boolean, hasMacroErrors: boolean }>}
 */
async function evaluateWithEngineAndCaptureMacroLogs(page, input) {
    /** @type {boolean} */
    let hasMacroWarnings = false;
    /** @type {boolean} */
    let hasMacroErrors = false;

    /** @param {import('playwright').ConsoleMessage} msg */
    const handler = (msg) => {
        const text = msg.text();
        if (text.includes('[Macro] Warning:')) {
            hasMacroWarnings = true;
        }
        if (text.includes('[Macro] Error:')) {
            hasMacroErrors = true;
        }
    };

    page.on('console', handler);
    try {
        const output = await evaluateWithEngine(page, input);
        return { output, hasMacroWarnings, hasMacroErrors };
    } finally {
        page.off('console', handler);
    }
}

/**
 * Evaluates the given input string with pre-set variables.
 * Variables are set via SillyTavern.getContext().variables which is where
 * the variable macros read/write their data.
 *
 * @param {import('@playwright/test').Page} page
 * @param {string} input
 * @param {{ local?: Record<string, string>, global?: Record<string, string> }} variables
 * @returns {Promise<string>}
 */
async function evaluateWithEngineAndVariables(page, input, variables) {
    const result = await page.evaluate(async ({ input, variables }) => {
        /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
        const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
        /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
        const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

        // Get the SillyTavern context for variable access
        const ctx = SillyTavern.getContext();

        // Pre-set local variables
        if (variables.local) {
            for (const [key, value] of Object.entries(variables.local)) {
                ctx.variables.local.set(key, value);
            }
        }
        // Pre-set global variables
        if (variables.global) {
            for (const [key, value] of Object.entries(variables.global)) {
                ctx.variables.global.set(key, value);
            }
        }

        /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js').MacroEnvRawContext} */
        const rawEnv = {
            content: input,
            name1Override: 'User',
            name2Override: 'Character',
        };
        const env = MacroEnvBuilder.buildFromRawEnv(rawEnv);

        const output = await MacroEngine.evaluate(input, env);
        return output;
    }, { input, variables });

    return result;
}
