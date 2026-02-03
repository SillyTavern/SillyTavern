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
        /** Fixed chat ID hash used across all pick tests for deterministic behavior */
        const TEST_CHAT_ID_HASH = 123456;

        /**
         * Registers a testable pick macro that returns the seed string instead of the picked value.
         * This allows tests to verify that different macro positions produce different seeds.
         *
         * @param {import('@playwright/test').Page} page
         */
        async function registerTestablePick(page) {
            await page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroRegistry.js')} */
                const { MacroRegistry, MacroCategory } = await import('./scripts/macros/engine/MacroRegistry.js');
                /** @type {import('../../public/scripts/utils.js')} */
                const { getStringHash } = await import('./scripts/utils.js');
                /** @type {import('../../public/script.js')} */
                const { chat_metadata } = await import('./script.js');
                /** @type {import('../../public/lib.js')} */
                const { seedrandom } = await import('./lib.js');

                // Only register once
                if (MacroRegistry.getMacro('testablePick')) return;

                MacroRegistry.registerMacro('testablePick', {
                    category: MacroCategory.RANDOM,
                    list: true,
                    description: 'Test version of pick that returns the seed string for verification.',
                    handler: ({ list, globalOffset, env }) => {
                        const chatIdHash = chat_metadata.chat_id_hash ?? 0;
                        const rawContentHash = env.contentHash;
                        const offset = globalOffset;
                        const rerollSeed = chat_metadata.pick_reroll_seed || null;
                        const combinedSeedString = [chatIdHash, rawContentHash, offset, rerollSeed].filter(it => it !== null).join('-');
                        // Return both the seed and what would be picked for validation
                        const finalSeed = getStringHash(combinedSeedString);
                        const rng = seedrandom(String(finalSeed));
                        const randomIndex = Math.floor(rng() * list.length);
                        return `seed:${combinedSeedString}|pick:${list[randomIndex]}`;
                    },
                });
            });
        }

        test.beforeEach(async ({ page }) => {
            // Set consistent chat ID hash for all tests
            await page.evaluate(async (hash) => {
                /** @type {import('../../public/script.js')} */
                const { chat_metadata } = await import('./script.js');
                chat_metadata.chat_id_hash = hash;
            }, TEST_CHAT_ID_HASH);
        });

        test('should return stable results for the same chat and content', async ({ page }) => {
            const input = 'Choices: {{pick::red::green::blue}}, {{pick::red::green::blue}}.';

            const output1 = await evaluateWithEngine(page, input);
            const output2 = await evaluateWithEngine(page, input);

            // Deterministic: same chat and same content should yield identical output
            expect(output1).toBe(output2);

            // Sanity check: both picks should resolve to one of the provided options
            const match = output1.match(/Choices: ([^,]+), ([^.]+)\./);
            expect(match).not.toBeNull();
            if (!match) return;

            const first = match[1].trim();
            const second = match[2].trim();
            const options = ['red', 'green', 'blue'];

            expect(options.includes(first)).toBeTruthy();
            expect(options.includes(second)).toBeTruthy();
        });

        test('should use different seeds for identical picks at different positions', async ({ page }) => {
            await registerTestablePick(page);

            const output = await page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

                const input = '{{testablePick::A::B::C}}###{{testablePick::A::B::C}}';
                const env = MacroEnvBuilder.buildFromRawEnv({ content: input });
                return MacroEngine.evaluate(input, env);
            });

            const parts = output.split('###');
            expect(parts.length).toBe(2);

            // Extract seeds from both results
            const seed1 = parts[0].match(/seed:([^|]+)/)?.[1];
            const seed2 = parts[1].match(/seed:([^|]+)/)?.[1];

            expect(seed1).toBeTruthy();
            expect(seed2).toBeTruthy();
            // Seeds must be different because the macros are at different positions
            expect(seed1).not.toBe(seed2);

            // Verify picked values are valid options
            const pick1 = parts[0].match(/pick:(\w+)/)?.[1];
            const pick2 = parts[1].match(/pick:(\w+)/)?.[1];
            const options = ['A', 'B', 'C'];
            expect(options.includes(pick1 ?? '')).toBeTruthy();
            expect(options.includes(pick2 ?? '')).toBeTruthy();
        });

        test('should use different seeds for identical picks inside different scoped macros at the same offset', async ({ page }) => {
            await registerTestablePick(page);

            // Key regression test: picks inside scoped content must use global offsets
            const output = await page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

                // Two identical pick macros inside different setvar scopes
                // Before the fix, both would get startOffset=0 relative to their argument
                // After the fix, they get different globalOffset values
                const input = '{{setvar::first}}{{testablePick::A::B::C}}{{/setvar}}{{setvar::second}}{{testablePick::A::B::C}}{{/setvar}}{{.first}}###{{.second}}';
                const env = MacroEnvBuilder.buildFromRawEnv({ content: input });
                return MacroEngine.evaluate(input, env);
            });

            const parts = output.split('###');
            expect(parts.length).toBe(2);

            const seed1 = parts[0].match(/seed:([^|]+)/)?.[1];
            const seed2 = parts[1].match(/seed:([^|]+)/)?.[1];

            expect(seed1).toBeTruthy();
            expect(seed2).toBeTruthy();
            // Seeds must be different - this is the key assertion for the fix
            expect(seed1).not.toBe(seed2);
        });

        test('should use different seeds for identical picks in inline arguments', async ({ page }) => {
            await registerTestablePick(page);

            const output = await page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

                // Two identical pick macros inside different setvar inline arguments
                const input = '{{setvar::first::{{testablePick::A::B::C}}}}{{setvar::second::{{testablePick::A::B::C}}}}{{.first}}###{{.second}}';
                const env = MacroEnvBuilder.buildFromRawEnv({ content: input });
                return MacroEngine.evaluate(input, env);
            });

            const parts = output.split('###');
            expect(parts.length).toBe(2);

            const seed1 = parts[0].match(/seed:([^|]+)/)?.[1];
            const seed2 = parts[1].match(/seed:([^|]+)/)?.[1];

            expect(seed1).toBeTruthy();
            expect(seed2).toBeTruthy();
            // Seeds must be different due to different global offsets
            expect(seed1).not.toBe(seed2);
        });

        test('should maintain stability across evaluations for picks in scoped content', async ({ page }) => {
            // Picks inside scoped content should still be deterministic (same result each time)
            const outputs = await page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

                const input = '{{setvar::val}}{{pick::X::Y::Z}}{{/setvar}}{{.val}}';
                const env1 = MacroEnvBuilder.buildFromRawEnv({ content: input });
                const env2 = MacroEnvBuilder.buildFromRawEnv({ content: input });
                const result1 = MacroEngine.evaluate(input, env1);
                const result2 = MacroEngine.evaluate(input, env2);
                return [result1, result2];
            });

            // Same input should produce same output (deterministic)
            expect(outputs[0]).toBe(outputs[1]);
            // Should be one of the valid options
            expect(['X', 'Y', 'Z'].includes(outputs[0])).toBeTruthy();
        });

        test('should use different seeds for identical picks inside different if blocks (delayArgResolution)', async ({ page }) => {
            await registerTestablePick(page);

            // Key regression test: picks inside {{if}} blocks use resolve() which must preserve globalOffset
            // This tests the fix for macros with delayArgResolution that call resolve() internally
            const output = await page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

                // Two identical pick macros inside different if blocks
                // Before the fix, both would get contextOffset=0 when resolve() was called
                // After the fix, resolve() passes the caller's globalOffset as contextOffset
                const input = '{{if true}}{{testablePick::A::B::C}}{{/if}}###{{if true}}{{testablePick::A::B::C}}{{/if}}';
                const env = MacroEnvBuilder.buildFromRawEnv({ content: input });
                return MacroEngine.evaluate(input, env);
            });

            const parts = output.split('###');
            expect(parts.length).toBe(2);

            const seed1 = parts[0].match(/seed:([^|]+)/)?.[1];
            const seed2 = parts[1].match(/seed:([^|]+)/)?.[1];

            expect(seed1).toBeTruthy();
            expect(seed2).toBeTruthy();
            // Seeds must be different because the {{if}} blocks are at different positions
            expect(seed1).not.toBe(seed2);
        });

        test('should maintain stability for picks inside if blocks across evaluations', async ({ page }) => {
            // Picks inside if blocks should still be deterministic
            const outputs = await page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

                const input = '{{if true}}{{pick::X::Y::Z}}{{/if}}';
                const env1 = MacroEnvBuilder.buildFromRawEnv({ content: input });
                const env2 = MacroEnvBuilder.buildFromRawEnv({ content: input });
                const result1 = MacroEngine.evaluate(input, env1);
                const result2 = MacroEngine.evaluate(input, env2);
                return [result1, result2];
            });

            // Same input should produce same output (deterministic)
            expect(outputs[0]).toBe(outputs[1]);
            // Should be one of the valid options
            expect(['X', 'Y', 'Z'].includes(outputs[0])).toBeTruthy();
        });
    });

    test.describe('Dynamic macros', () => {
        test.describe('String value dynamic macros', () => {
            test('should resolve dynamic macro with string value', async ({ page }) => {
                const output = await page.evaluate(async () => {
                    /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                    const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                    /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                    const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

                    const rawEnv = {
                        content: 'Test: {{myvalue}}',
                        dynamicMacros: {
                            myvalue: 'hello world',
                        },
                    };
                    const env = MacroEnvBuilder.buildFromRawEnv(rawEnv);
                    return MacroEngine.evaluate('Test: {{myvalue}}', env);
                });

                expect(output).toBe('Test: hello world');
            });

            test('should resolve dynamic macro with numeric value converted to string', async ({ page }) => {
                const output = await page.evaluate(async () => {
                    /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                    const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                    /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                    const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

                    const rawEnv = {
                        content: '',
                        dynamicMacros: {
                            num: 42,
                        },
                    };
                    const env = MacroEnvBuilder.buildFromRawEnv(rawEnv);
                    return MacroEngine.evaluate('Value: {{num}}', env);
                });

                expect(output).toBe('Value: 42');
            });

            test('should not resolve string dynamic macro when called with arguments', async ({ page }) => {
                const warnings = [];
                page.on('console', msg => {
                    if (msg.type() === 'warning') warnings.push(msg.text());
                });

                const input = 'Dyn: {{myvalue::extra}}';
                const output = await page.evaluate(async (input) => {
                    /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                    const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                    /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                    const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

                    const rawEnv = {
                        content: input,
                        dynamicMacros: { myvalue: 'hello' },
                    };
                    const env = MacroEnvBuilder.buildFromRawEnv(rawEnv);
                    return MacroEngine.evaluate(input, env);
                }, input);

                expect(output).toBe(input);
                expect(warnings.some(w => w.includes('Macro "myvalue"') && w.includes('unnamed arguments'))).toBeTruthy();
            });
        });

        test.describe('Handler function dynamic macros', () => {
            test('should resolve dynamic macro with handler function', async ({ page }) => {
                const output = await page.evaluate(async () => {
                    /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                    const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                    /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                    const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

                    const rawEnv = {
                        content: '',
                        dynamicMacros: {
                            dyn: () => 'handler result',
                        },
                    };
                    const env = MacroEnvBuilder.buildFromRawEnv(rawEnv);
                    return MacroEngine.evaluate('Result: {{dyn}}', env);
                });

                expect(output).toBe('Result: handler result');
            });

            test('should pass execution context to handler function', async ({ page }) => {
                const output = await page.evaluate(async () => {
                    /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                    const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                    /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                    const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

                    const rawEnv = {
                        content: 'full content here',
                        dynamicMacros: {
                            dyn: (ctx) => `name=${ctx.name}, content=${ctx.env.content}`,
                        },
                    };
                    const env = MacroEnvBuilder.buildFromRawEnv(rawEnv);
                    return MacroEngine.evaluate('{{dyn}}', env);
                });

                expect(output).toBe('name=dyn, content=full content here');
            });

            test('should not resolve handler dynamic macro when called with arguments due to strict arity', async ({ page }) => {
                const warnings = [];
                page.on('console', msg => {
                    if (msg.type() === 'warning') warnings.push(msg.text());
                });

                const input = 'Dyn: {{dyn::extra}}';
                const output = await page.evaluate(async (input) => {
                    /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                    const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                    /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                    const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

                    const rawEnv = {
                        content: input,
                        dynamicMacros: {
                            dyn: () => 'OK',
                        },
                    };
                    const env = MacroEnvBuilder.buildFromRawEnv(rawEnv);
                    return MacroEngine.evaluate(input, env);
                }, input);

                expect(output).toBe(input);
                expect(warnings.some(w => w.includes('Macro "dyn"') && w.includes('unnamed arguments'))).toBeTruthy();
            });
        });

        test.describe('MacroDefinitionOptions dynamic macros', () => {
            test('should resolve dynamic macro with MacroDefinitionOptions', async ({ page }) => {
                const output = await page.evaluate(async () => {
                    /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                    const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                    /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                    const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

                    const rawEnv = {
                        content: '',
                        dynamicMacros: {
                            greet: {
                                description: 'A greeting macro',
                                handler: () => 'Hello from options!',
                            },
                        },
                    };
                    const env = MacroEnvBuilder.buildFromRawEnv(rawEnv);
                    return MacroEngine.evaluate('{{greet}}', env);
                });

                expect(output).toBe('Hello from options!');
            });

            test('should support unnamed arguments in dynamic macro with options', async ({ page }) => {
                const output = await page.evaluate(async () => {
                    /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                    const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                    /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                    const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

                    const rawEnv = {
                        content: '',
                        dynamicMacros: {
                            greet: {
                                unnamedArgs: [{ name: 'name' }],
                                handler: ({ unnamedArgs: [name] }) => `Hello, ${name}!`,
                            },
                        },
                    };
                    const env = MacroEnvBuilder.buildFromRawEnv(rawEnv);
                    return MacroEngine.evaluate('{{greet::World}}', env);
                });

                expect(output).toBe('Hello, World!');
            });

            test('should support multiple unnamed arguments in dynamic macro', async ({ page }) => {
                const output = await page.evaluate(async () => {
                    /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                    const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                    /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                    const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

                    const rawEnv = {
                        content: '',
                        dynamicMacros: {
                            wrap: {
                                unnamedArgs: [
                                    { name: 'content' },
                                    { name: 'prefix' },
                                    { name: 'suffix' },
                                ],
                                handler: ({ unnamedArgs: [content, prefix, suffix] }) => `${prefix}${content}${suffix}`,
                            },
                        },
                    };
                    const env = MacroEnvBuilder.buildFromRawEnv(rawEnv);
                    return MacroEngine.evaluate('{{wrap::hello::[::]}}', env);
                });

                expect(output).toBe('[hello]');
            });

            test('should support optional arguments in dynamic macro', async ({ page }) => {
                const output = await page.evaluate(async () => {
                    /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                    const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                    /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                    const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

                    const rawEnv = {
                        content: '',
                        dynamicMacros: {
                            greet: {
                                unnamedArgs: [
                                    { name: 'name' },
                                    { name: 'greeting', optional: true, defaultValue: 'Hello' },
                                ],
                                handler: ({ unnamedArgs: [name, greeting] }) => `${greeting || 'Hello'}, ${name}!`,
                            },
                        },
                    };
                    const env = MacroEnvBuilder.buildFromRawEnv(rawEnv);

                    const result1 = MacroEngine.evaluate('{{greet::World}}', env);
                    const result2 = MacroEngine.evaluate('{{greet::World::Hi}}', env);
                    return { result1, result2 };
                });

                expect(output.result1).toBe('Hello, World!');
                expect(output.result2).toBe('Hi, World!');
            });

            test('should support list arguments in dynamic macro', async ({ page }) => {
                const output = await page.evaluate(async () => {
                    /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                    const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                    /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                    const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

                    const rawEnv = {
                        content: '',
                        dynamicMacros: {
                            join: {
                                unnamedArgs: [{ name: 'separator' }],
                                list: true,
                                handler: ({ unnamedArgs: [sep], list }) => list.join(sep),
                            },
                        },
                    };
                    const env = MacroEnvBuilder.buildFromRawEnv(rawEnv);
                    return MacroEngine.evaluate('{{join::-::a::b::c}}', env);
                });

                expect(output).toBe('a-b-c');
            });

            test('should enforce type validation in dynamic macro with options', async ({ page }) => {
                const warnings = [];
                page.on('console', msg => {
                    if (msg.type() === 'warning') warnings.push(msg.text());
                });

                const input = '{{calc::abc}}';
                const output = await page.evaluate(async (input) => {
                    /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                    const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                    /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                    const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

                    const rawEnv = {
                        content: input,
                        dynamicMacros: {
                            calc: {
                                unnamedArgs: [{ name: 'value', type: 'integer' }],
                                strictArgs: true,
                                handler: ({ unnamedArgs: [val] }) => `#${val}#`,
                            },
                        },
                    };
                    const env = MacroEnvBuilder.buildFromRawEnv(rawEnv);
                    return MacroEngine.evaluate(input, env);
                }, input);

                expect(output).toBe(input);
                expect(warnings.some(w => w.includes('calc') && w.includes('expected type integer'))).toBeTruthy();
            });

            test('should respect strictArgs: false in dynamic macro with options', async ({ page }) => {
                const warnings = [];
                page.on('console', msg => {
                    if (msg.type() === 'warning') warnings.push(msg.text());
                });

                const output = await page.evaluate(async () => {
                    /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                    const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                    /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                    const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

                    const rawEnv = {
                        content: '',
                        dynamicMacros: {
                            calc: {
                                unnamedArgs: [{ name: 'value', type: 'integer' }],
                                strictArgs: false,
                                handler: ({ unnamedArgs: [val] }) => `#${val}#`,
                            },
                        },
                    };
                    const env = MacroEnvBuilder.buildFromRawEnv(rawEnv);
                    return MacroEngine.evaluate('{{calc::abc}}', env);
                });

                expect(output).toBe('#abc#');
                expect(warnings.some(w => w.includes('calc') && w.includes('expected type integer'))).toBeTruthy();
            });

            test('should fail arity check in dynamic macro with options when too few args', async ({ page }) => {
                const warnings = [];
                page.on('console', msg => {
                    if (msg.type() === 'warning') warnings.push(msg.text());
                });

                const input = '{{greet}}';
                const output = await page.evaluate(async (input) => {
                    /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                    const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                    /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                    const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

                    const rawEnv = {
                        content: input,
                        dynamicMacros: {
                            greet: {
                                unnamedArgs: [{ name: 'name' }],
                                handler: ({ unnamedArgs: [name] }) => `Hello, ${name}!`,
                            },
                        },
                    };
                    const env = MacroEnvBuilder.buildFromRawEnv(rawEnv);
                    return MacroEngine.evaluate(input, env);
                }, input);

                expect(output).toBe(input);
                expect(warnings.some(w => w.includes('greet') && w.includes('unnamed arguments'))).toBeTruthy();
            });

            test('should fail arity check in dynamic macro with options when too many args', async ({ page }) => {
                const warnings = [];
                page.on('console', msg => {
                    if (msg.type() === 'warning') warnings.push(msg.text());
                });

                const input = '{{greet::one::two}}';
                const output = await page.evaluate(async (input) => {
                    /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                    const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                    /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                    const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

                    const rawEnv = {
                        content: input,
                        dynamicMacros: {
                            greet: {
                                unnamedArgs: [{ name: 'name' }],
                                handler: ({ unnamedArgs: [name] }) => `Hello, ${name}!`,
                            },
                        },
                    };
                    const env = MacroEnvBuilder.buildFromRawEnv(rawEnv);
                    return MacroEngine.evaluate(input, env);
                }, input);

                expect(output).toBe(input);
                expect(warnings.some(w => w.includes('greet') && w.includes('unnamed arguments'))).toBeTruthy();
            });

            test('should handle invalid MacroDefinitionOptions gracefully', async ({ page }) => {
                const warnings = [];
                page.on('console', msg => {
                    if (msg.type() === 'warning') warnings.push(msg.text());
                });

                const input = '{{bad}}';
                const output = await page.evaluate(async (input) => {
                    /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                    const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                    /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                    const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

                    /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js').MacroEnvRawContext} */
                    const rawEnv = {
                        content: input,
                        dynamicMacros: {
                            bad: {
                                // Missing handler - should fail validation
                                unnamedArgs: 1,
                            },
                        },
                    };
                    const env = MacroEnvBuilder.buildFromRawEnv(rawEnv);
                    return MacroEngine.evaluate(input, env);
                }, input);

                // Should remain unresolved since options are invalid
                expect(output).toBe(input);
                expect(warnings.some(w => w.includes('bad') && w.includes('is not defined correctly'))).toBeTruthy();
            });
        });

        test.describe('Dynamic macro priority and case sensitivity', () => {
            test('should override registered macro with dynamic macro of same name', async ({ page }) => {
                const output = await page.evaluate(async () => {
                    /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                    const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                    /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                    const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

                    const rawEnv = {
                        content: '',
                        name1Override: 'User',
                        dynamicMacros: {
                            user: 'DynamicUser',
                        },
                    };
                    const env = MacroEnvBuilder.buildFromRawEnv(rawEnv);
                    return MacroEngine.evaluate('{{user}}', env);
                });

                expect(output).toBe('DynamicUser');
            });

            test('should match dynamic macro names case-insensitively', async ({ page }) => {
                const output = await page.evaluate(async () => {
                    /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                    const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                    /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                    const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

                    const rawEnv = {
                        content: '',
                        dynamicMacros: {
                            MyMacro: 'value',
                        },
                    };
                    const env = MacroEnvBuilder.buildFromRawEnv(rawEnv);

                    const r1 = MacroEngine.evaluate('{{MyMacro}}', env);
                    const r2 = MacroEngine.evaluate('{{mymacro}}', env);
                    const r3 = MacroEngine.evaluate('{{MYMACRO}}', env);
                    return { r1, r2, r3 };
                });

                expect(output.r1).toBe('value');
                expect(output.r2).toBe('value');
                expect(output.r3).toBe('value');
            });

            test('should resolve multiple different dynamic macros in same evaluation', async ({ page }) => {
                const output = await page.evaluate(async () => {
                    /** @type {import('../../public/scripts/macros/engine/MacroEngine.js')} */
                    const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                    /** @type {import('../../public/scripts/macros/engine/MacroEnvBuilder.js')} */
                    const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');

                    const rawEnv = {
                        content: '',
                        dynamicMacros: {
                            a: 'alpha',
                            b: () => 'beta',
                            c: {
                                handler: () => 'gamma',
                            },
                        },
                    };
                    const env = MacroEnvBuilder.buildFromRawEnv(rawEnv);
                    return MacroEngine.evaluate('{{a}}-{{b}}-{{c}}', env);
                });

                expect(output).toBe('alpha-beta-gamma');
            });
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

        test.describe('scoped macros nested inside arguments', () => {
            test('should resolve scoped macro inside another macro argument', async ({ page }) => {
                // {{reverse}}hello{{/reverse}} inside setvar's value argument should resolve first
                const input = '{{setvar::testvar::{{reverse}}hello{{/reverse}}}} {{getvar::testvar}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe(' olleh');
            });

            test('should resolve scoped if macro inside setvar argument', async ({ page }) => {
                // {{if true}}true branch{{/if}} inside setvar should resolve to "true branch"
                const input = '{{setvar::testvar::{{if true}}true branch{{/if}}}} {{getvar::testvar}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe(' true branch');
            });

            test('should resolve scoped if/else macro inside setvar argument', async ({ page }) => {
                const input = '{{setvar::testvar::{{if 0}}wrong{{else}}correct{{/if}}}} {{getvar::testvar}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe(' correct');
            });

            test('should resolve multiple scoped macros inside single argument', async ({ page }) => {
                // Two scoped macros in the same argument
                const input = '{{setvar::testvar::{{reverse}}ab{{/reverse}}-{{reverse}}cd{{/reverse}}}} {{getvar::testvar}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe(' ba-dc');
            });

            test('should resolve deeply nested scoped macros in arguments', async ({ page }) => {
                // Scoped macro inside scoped macro inside argument
                const input = '{{setvar::outer::{{setvar::inner::{{reverse}}xyz{{/reverse}}}}{{getvar::inner}}}} {{getvar::outer}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe(' zyx');
            });

            test('should resolve scoped macro with text before and after in argument', async ({ page }) => {
                const input = '{{setvar::testvar::before {{reverse}}mid{{/reverse}} after}} {{getvar::testvar}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe(' before dim after');
            });

            test('should handle scoped macro inside first argument when macro has multiple args', async ({ page }) => {
                // setvar has two args: name and value. Test scoped in value position.
                const input = '{{setvar::myvar::prefix-{{reverse}}abc{{/reverse}}-suffix}}{{getvar::myvar}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe('prefix-cba-suffix');
            });

            test('should handle multiline scoped content inside argument', async ({ page }) => {
                const input = '{{setvar::testvar::{{if true}}\ntrue\nbranch\n{{/if}}}} {{getvar::testvar}}';
                const output = await evaluateWithEngine(page, input);
                expect(output).toBe(' true\nbranch');
            });
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

        // {{.myvar -= 5}} - subtract from local variable
        test('should subtract from local variable with -= shorthand', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar -= 3}}Then: {{.myvar}}', { local: { myvar: '10' } });
            // subvar returns '', then "Then: ", then getvar returns "7"
            expect(output).toBe('Then: 7');
        });

        // {{$myvar -= 5}} - subtract from global variable
        test('should subtract from global variable with -= shorthand', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{$myvar -= 5}}{{$myvar}}', { global: { myvar: '20' } });
            expect(output).toBe('15');
        });

        // {{.myvar || default}} - returns default when falsy
        test('should return default value with || when variable is falsy (empty)', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar || fallback}}', { local: { myvar: '' } });
            expect(output).toBe('fallback');
        });

        test('should return default value with || when variable is falsy (zero)', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar || fallback}}', { local: { myvar: '0' } });
            expect(output).toBe('fallback');
        });

        test('should return variable value with || when truthy', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar || fallback}}', { local: { myvar: 'existing' } });
            expect(output).toBe('existing');
        });

        test('should return default value with || when variable does not exist', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.nonexistent || default}}', { local: {} });
            expect(output).toBe('default');
        });

        // {{.myvar ?? default}} - returns default only when undefined
        test('should return default value with ?? when variable does not exist', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar ?? fallback}}', { local: {} });
            expect(output).toBe('fallback');
        });

        test('should return empty string with ?? when variable exists but is empty', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '[{{.myvar ?? fallback}}]', { local: { myvar: '' } });
            expect(output).toBe('[]');
        });

        test('should return zero with ?? when variable exists and is zero', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar ?? fallback}}', { local: { myvar: '0' } });
            expect(output).toBe('0');
        });

        test('should return variable value with ?? when it exists', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar ?? fallback}}', { local: { myvar: 'value' } });
            expect(output).toBe('value');
        });

        // {{.myvar ||= default}} - sets and returns default when falsy
        test('should set and return default with ||= when variable is falsy', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar ||= newval}}{{.myvar}}', { local: { myvar: '' } });
            // ||= returns 'newval', then getvar also returns 'newval'
            expect(output).toBe('newvalnewval');
        });

        test('should not set and return current with ||= when variable is truthy', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar ||= newval}}{{.myvar}}', { local: { myvar: 'existing' } });
            // ||= returns 'existing', then getvar returns 'existing'
            expect(output).toBe('existingexisting');
        });

        test('should set and return default with ||= when variable does not exist', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar ||= created}}{{.myvar}}', { local: {} });
            expect(output).toBe('createdcreated');
        });

        // {{.myvar ??= default}} - sets and returns default only when undefined
        test('should set and return default with ??= when variable does not exist', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar ??= created}}{{.myvar}}', { local: {} });
            expect(output).toBe('createdcreated');
        });

        test('should not set and return current with ??= when variable exists but is empty', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '[{{.myvar ??= newval}}][{{.myvar}}]', { local: { myvar: '' } });
            // ??= returns '' (current value), then getvar returns '' (unchanged)
            expect(output).toBe('[][]');
        });

        test('should not set and return current with ??= when variable exists and is zero', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar ??= newval}}{{.myvar}}', { local: { myvar: '0' } });
            // ??= returns '0', then getvar returns '0'
            expect(output).toBe('00');
        });

        // {{.myvar == value}} - equality comparison
        test('should return true when variable equals value with ==', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar == hello}}', { local: { myvar: 'hello' } });
            expect(output).toBe('true');
        });

        test('should return false when variable does not equal value with ==', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar == world}}', { local: { myvar: 'hello' } });
            expect(output).toBe('false');
        });

        test('should compare empty variable correctly with ==', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar ==}}', { local: { myvar: '' } });
            expect(output).toBe('true');
        });

        test('should compare numeric value correctly with ==', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar == 42}}', { local: { myvar: '42' } });
            expect(output).toBe('true');
        });

        // {{.myvar != value}} - inequality comparison
        test('should return true when variable does not equal value with !=', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar != world}}', { local: { myvar: 'hello' } });
            expect(output).toBe('true');
        });

        test('should return false when variable equals value with !=', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar != hello}}', { local: { myvar: 'hello' } });
            expect(output).toBe('false');
        });

        test('should compare empty variable correctly with !=', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar !=}}', { local: { myvar: '' } });
            expect(output).toBe('false');
        });

        test('should compare non-empty to empty with !=', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar != }}', { local: { myvar: 'value' } });
            expect(output).toBe('true');
        });

        test('should compare numeric value correctly with !=', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar != 99}}', { local: { myvar: '42' } });
            expect(output).toBe('true');
        });

        // {{.myvar > value}} - greater than comparison (numeric)
        test('should return true when variable is greater than value with >', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar > 5}}', { local: { myvar: '10' } });
            expect(output).toBe('true');
        });

        test('should return false when variable is not greater than value with >', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar > 10}}', { local: { myvar: '5' } });
            expect(output).toBe('false');
        });

        test('should return false when variable equals value with >', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar > 10}}', { local: { myvar: '10' } });
            expect(output).toBe('false');
        });

        test('should return false for non-numeric values with >', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar > 5}}', { local: { myvar: 'abc' } });
            expect(output).toBe('false');
        });

        // {{.myvar >= value}} - greater than or equal comparison (numeric)
        test('should return true when variable is greater than value with >=', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar >= 5}}', { local: { myvar: '10' } });
            expect(output).toBe('true');
        });

        test('should return true when variable equals value with >=', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar >= 10}}', { local: { myvar: '10' } });
            expect(output).toBe('true');
        });

        test('should return false when variable is less than value with >=', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar >= 10}}', { local: { myvar: '5' } });
            expect(output).toBe('false');
        });

        // {{.myvar < value}} - less than comparison (numeric)
        test('should return true when variable is less than value with <', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar < 10}}', { local: { myvar: '5' } });
            expect(output).toBe('true');
        });

        test('should return false when variable is not less than value with <', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar < 5}}', { local: { myvar: '10' } });
            expect(output).toBe('false');
        });

        test('should return false when variable equals value with <', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar < 10}}', { local: { myvar: '10' } });
            expect(output).toBe('false');
        });

        test('should return false for non-numeric values with <', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar < 5}}', { local: { myvar: 'abc' } });
            expect(output).toBe('false');
        });

        // {{.myvar <= value}} - less than or equal comparison (numeric)
        test('should return true when variable is less than value with <=', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar <= 10}}', { local: { myvar: '5' } });
            expect(output).toBe('true');
        });

        test('should return true when variable equals value with <=', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar <= 10}}', { local: { myvar: '10' } });
            expect(output).toBe('true');
        });

        test('should return false when variable is greater than value with <=', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar <= 5}}', { local: { myvar: '10' } });
            expect(output).toBe('false');
        });

        // Negative numbers with comparison operators
        test('should handle negative numbers with > operator', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar > -5}}', { local: { myvar: '0' } });
            expect(output).toBe('true');
        });

        test('should handle negative numbers with < operator', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar < 0}}', { local: { myvar: '-5' } });
            expect(output).toBe('true');
        });

        // Decimal numbers with comparison operators
        test('should handle decimal numbers with >= operator', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar >= 3.14}}', { local: { myvar: '3.14' } });
            expect(output).toBe('true');
        });

        test('should handle decimal numbers with <= operator', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar <= 2.5}}', { local: { myvar: '2.49' } });
            expect(output).toBe('true');
        });

        // Global variable versions of new operators
        test('should use || with global variable', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{$myvar || globaldefault}}', { global: { myvar: '' } });
            expect(output).toBe('globaldefault');
        });

        test('should use ?? with global variable', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{$myvar ?? globaldefault}}', { global: {} });
            expect(output).toBe('globaldefault');
        });

        test('should use ||= with global variable', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{$myvar ||= gset}}{{$myvar}}', { global: { myvar: '' } });
            expect(output).toBe('gsetgset');
        });

        test('should use ??= with global variable', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{$myvar ??= gcreated}}{{$myvar}}', { global: {} });
            expect(output).toBe('gcreatedgcreated');
        });

        test('should use == with global variable', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{$myvar == test}}', { global: { myvar: 'test' } });
            expect(output).toBe('true');
        });

        // Nested macro in fallback value
        test('should support nested macro in || fallback value', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar || Hello {{user}}}}', { local: {} });
            expect(output).toBe('Hello User');
        });

        test('should support nested macro in ?? fallback value', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar ?? Hello {{user}}}}', { local: {} });
            expect(output).toBe('Hello User');
        });

        // Whitespace handling with new operators
        test('should handle whitespace with || operator', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{ .myvar || spaced }}', { local: {} });
            expect(output).toBe('spaced');
        });

        test('should handle whitespace with ?? operator', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{ .myvar ?? spaced }}', { local: {} });
            expect(output).toBe('spaced');
        });
    });

    test.describe('Variable Shorthand Lazy Evaluation', () => {
        // Tests to verify that fallback value expressions are only evaluated when needed.
        // This is important for performance and because some macros are stateful.

        // ?? should NOT evaluate fallback when variable exists
        test('should NOT evaluate ?? fallback when variable exists', async ({ page }) => {
            // Use setvar in the fallback - if lazy evaluation works, tracker should remain unset
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar ?? {{.tracker = evaluated}}fallback}}[{{.tracker}}]', { local: { myvar: 'exists' } });
            // myvar exists, so ?? returns 'exists' and the fallback (which would set tracker) is NOT evaluated
            expect(output).toBe('exists[]');
        });

        test('should evaluate ?? fallback when variable does not exist', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar ?? {{.tracker = evaluated}}fallback}}[{{.tracker}}]', { local: {} });
            // myvar doesn't exist, so ?? evaluates and returns the fallback, setting tracker
            expect(output).toBe('fallback[evaluated]');
        });

        // || should NOT evaluate fallback when variable is truthy
        test('should NOT evaluate || fallback when variable is truthy', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar || {{.tracker = evaluated}}fallback}}[{{.tracker}}]', { local: { myvar: 'truthy' } });
            // myvar is truthy, so || returns 'truthy' and the fallback is NOT evaluated
            expect(output).toBe('truthy[]');
        });

        test('should evaluate || fallback when variable is falsy', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar || {{.tracker = evaluated}}fallback}}[{{.tracker}}]', { local: { myvar: '' } });
            // myvar is falsy, so || evaluates and returns the fallback, setting tracker
            expect(output).toBe('fallback[evaluated]');
        });

        // ??= should NOT evaluate value when variable exists
        test('should NOT evaluate ??= value when variable exists', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar ??= {{.tracker = evaluated}}newval}}[{{.tracker}}]', { local: { myvar: 'exists' } });
            // myvar exists, so ??= returns current value and the value expression is NOT evaluated
            expect(output).toBe('exists[]');
        });

        test('should evaluate ??= value when variable does not exist', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar ??= {{.tracker = evaluated}}newval}}[{{.tracker}}]', { local: {} });
            // myvar doesn't exist, so ??= evaluates value, sets myvar, and returns it
            expect(output).toBe('newval[evaluated]');
        });

        // ||= should NOT evaluate value when variable is truthy
        test('should NOT evaluate ||= value when variable is truthy', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar ||= {{.tracker = evaluated}}newval}}[{{.tracker}}]', { local: { myvar: 'truthy' } });
            // myvar is truthy, so ||= returns current value and the value expression is NOT evaluated
            expect(output).toBe('truthy[]');
        });

        test('should evaluate ||= value when variable is falsy', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar ||= {{.tracker = evaluated}}newval}}[{{.tracker}}]', { local: { myvar: '' } });
            // myvar is falsy, so ||= evaluates value, sets myvar, and returns it
            expect(output).toBe('newval[evaluated]');
        });

        // Operators that ALWAYS evaluate value should still work
        test('should always evaluate = value expression', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar = {{.tracker = evaluated}}value}}[{{.tracker}}]', { local: {} });
            expect(output).toBe('[evaluated]');
        });

        test('should always evaluate += value expression', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar += {{.tracker = evaluated}}5}}[{{.tracker}}]', { local: { myvar: '10' } });
            expect(output).toBe('[evaluated]');
        });

        test('should always evaluate == value expression', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar == {{.tracker = evaluated}}test}}[{{.tracker}}]', { local: { myvar: 'test' } });
            expect(output).toBe('true[evaluated]');
        });

        // Value should only be evaluated once (caching test)
        test('should only evaluate value expression once when needed', async ({ page }) => {
            // Use addvar to track how many times the value is evaluated (addvar returns empty string)
            const output = await evaluateWithEngineAndVariables(page, '{{.counter = 0}}{{.myvar ??= {{.counter += 1}}value}}{{.counter}}', { local: {} });
            // counter should be 1 (value evaluated exactly once)
            expect(output).toBe('value1');
        });
    });

    test.describe('Variable Shorthand Edge Cases', () => {
        // Operators requiring a value but value is empty
        test('should handle = operator with empty value', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar = }}[{{.myvar}}]', { local: {} });
            // Empty value after = should set the variable to empty string
            expect(output).toBe('[]');
        });

        test('should handle += operator with empty value', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar += }}[{{.myvar}}]', { local: { myvar: 'existing' } });
            // Empty value after += should add nothing
            expect(output).toBe('[existing]');
        });

        test('should handle -= operator with empty value (non-numeric)', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar -= }}[{{.myvar}}]', { local: { myvar: '10' } });
            // Empty value is NaN, so subtraction fails silently and returns empty
            expect(output).toBe('[10]');
        });

        test('should handle || operator with empty fallback', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '[{{.myvar || }}]', { local: { myvar: '' } });
            // Falsy myvar, empty fallback - returns empty string
            expect(output).toBe('[]');
        });

        test('should handle ?? operator with empty fallback', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '[{{.myvar ?? }}]', { local: {} });
            // Undefined myvar, empty fallback - returns empty string
            expect(output).toBe('[]');
        });

        test('should handle == operator with empty comparison value', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar == }}', { local: { myvar: '' } });
            // Empty var equals empty value - should be true
            expect(output).toBe('true');
        });

        test('should handle == operator comparing non-empty to empty', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar == }}', { local: { myvar: 'value' } });
            // Non-empty var vs empty value - should be false
            expect(output).toBe('false');
        });

        // Operators that don't take values - should return raw if invalid
        test('should return raw with trailing content after ++ operator', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar++5}}', { local: { myvar: '5' } });
            expect(output).toBe('{{.myvar++5}}');
        });

        test('should return empty with trailing content after -- operator', async ({ page }) => {
            // This is a weird case. The "--" operator does not accept value expression, but writing it like this,
            // makes the parser treat "myvar--5" as the variable identifier, as dashes and numbers are allowed.
            // This is intended, so this resolving to null, as the variable does not exist, is also intended.
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar--5}}', { local: { myvar: '10' } });
            expect(output).toBe('');
        });

        test('should return raw with trailing content after -- operator separated by spaces', async ({ page }) => {
            // This is a weird case. The "--" operator does not accept value expression, but writing it like this,
            // makes the parser treat "myvar--5" as the variable identifier, as dashes and numbers are allowed.
            // This is intended, so this resolving to null, as the variable does not exist, is also intended.
            const output = await evaluateWithEngineAndVariables(page, '{{.myvar -- 5}}', { local: { myvar: '10' } });
            expect(output).toBe('{{.myvar -- 5}}');
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

    const getUniqueVariableId = () => `dt_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    test.describe('Delayed Argument Resolution ({{if}} branch isolation)', () => {
        // Core feature: setvar in non-chosen branch should NOT execute
        test('should NOT execute setvar in false branch', async ({ page }) => {
            const id = getUniqueVariableId();
            const output = await page.evaluate(async (id) => {
                const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');
                const ctx = SillyTavern.getContext();

                ctx.variables.local.del(id);

                const input = `{{if 0}}{{setvar::${id}::should-not-set}}{{/if}}`;
                const env = MacroEnvBuilder.buildFromRawEnv({ content: input });
                MacroEngine.evaluate(input, env);

                // Variable should NOT be set because the branch was not taken
                const result = ctx.variables.local.get(id);
                ctx.variables.local.del(id);
                return result;
            }, id);

            expect(output).toBe('');
        });

        // setvar in true branch SHOULD execute
        test('should execute setvar in true branch', async ({ page }) => {
            const id = getUniqueVariableId();
            const output = await page.evaluate(async (id) => {
                const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');
                const ctx = SillyTavern.getContext();

                ctx.variables.local.del(id);

                const input = `{{if 1}}{{setvar::${id}::was-set}}{{/if}}`;
                const env = MacroEnvBuilder.buildFromRawEnv({ content: input });
                MacroEngine.evaluate(input, env);

                const result = ctx.variables.local.get(id);
                ctx.variables.local.del(id);
                return result;
            }, id);

            expect(output).toBe('was-set');
        });

        // With else branch: only the chosen branch's setvar should execute
        test('should only execute setvar in chosen else branch', async ({ page }) => {
            const id = getUniqueVariableId();
            const output = await page.evaluate(async (id) => {
                const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');
                const ctx = SillyTavern.getContext();

                ctx.variables.local.del(id);

                const input = `{{if 0}}{{setvar::${id}::then-branch}}{{else}}{{setvar::${id}::else-branch}}{{/if}}`;
                const env = MacroEnvBuilder.buildFromRawEnv({ content: input });
                MacroEngine.evaluate(input, env);

                const result = ctx.variables.local.get(id);
                ctx.variables.local.del(id);
                return result;
            }, id);

            expect(output).toBe('else-branch');
        });

        // Verify then branch setvar executes, not else branch
        test('should only execute setvar in chosen then branch', async ({ page }) => {
            const id = getUniqueVariableId();
            const output = await page.evaluate(async (id) => {
                const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');
                const ctx = SillyTavern.getContext();

                ctx.variables.local.del(id);

                const input = `{{if 1}}{{setvar::${id}::then-branch}}{{else}}{{setvar::${id}::else-branch}}{{/if}}`;
                const env = MacroEnvBuilder.buildFromRawEnv({ content: input });
                MacroEngine.evaluate(input, env);

                const result = ctx.variables.local.get(id);
                ctx.variables.local.del(id);
                return result;
            }, id);

            expect(output).toBe('then-branch');
        });

        // Multiple setvars in branches - only chosen branch's setvars execute
        test('should execute multiple setvars only in chosen branch', async ({ page }) => {
            const id = getUniqueVariableId();
            const output = await page.evaluate(async (id) => {
                const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');
                const ctx = SillyTavern.getContext();

                ctx.variables.local.del(`${id}_a`);
                ctx.variables.local.del(`${id}_b`);

                const input = `{{if 0}}{{setvar::${id}_a::wrong}}{{setvar::${id}_b::wrong}}{{else}}{{setvar::${id}_a::right}}{{setvar::${id}_b::right}}{{/if}}`;
                const env = MacroEnvBuilder.buildFromRawEnv({ content: input });
                MacroEngine.evaluate(input, env);

                const a = ctx.variables.local.get(`${id}_a`);
                const b = ctx.variables.local.get(`${id}_b`);
                ctx.variables.local.del(`${id}_a`);
                ctx.variables.local.del(`${id}_b`);
                return `a=${a},b=${b}`;
            }, id);

            expect(output).toBe('a=right,b=right');
        });

        // Nested if with delayed resolution - inner if should also work correctly
        test('should handle nested if with delayed resolution', async ({ page }) => {
            const id = `dt_nested_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            const output = await page.evaluate(async (id) => {
                const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');
                const ctx = SillyTavern.getContext();

                ctx.variables.local.del(`${id}_outer`);
                ctx.variables.local.del(`${id}_inner`);

                // Outer if is true, inner if is false
                const input = `{{if 1}}{{setvar::${id}_outer::yes}}{{if 0}}{{setvar::${id}_inner::wrong}}{{else}}{{setvar::${id}_inner::correct}}{{/if}}{{/if}}`;
                const env = MacroEnvBuilder.buildFromRawEnv({ content: input });
                MacroEngine.evaluate(input, env);

                const outer = ctx.variables.local.get(`${id}_outer`);
                const inner = ctx.variables.local.get(`${id}_inner`);
                ctx.variables.local.del(`${id}_outer`);
                ctx.variables.local.del(`${id}_inner`);
                return `outer=${outer},inner=${inner}`;
            }, id);

            expect(output).toBe('outer=yes,inner=correct');
        });

        // Variable-based condition with delayed resolution
        test('should work with variable shorthand condition and delayed resolution', async ({ page }) => {
            const id = `dt_varsh_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            const output = await page.evaluate(async (id) => {
                const { MacroEngine } = await import('./scripts/macros/engine/MacroEngine.js');
                const { MacroEnvBuilder } = await import('./scripts/macros/engine/MacroEnvBuilder.js');
                const ctx = SillyTavern.getContext();

                ctx.variables.local.set(`${id}_flag`, '');
                ctx.variables.local.del(`${id}_result`);

                const input = `{{if .${id}_flag}}{{setvar::${id}_result::truthy}}{{else}}{{setvar::${id}_result::falsy}}{{/if}}`;
                const env = MacroEnvBuilder.buildFromRawEnv({ content: input });
                MacroEngine.evaluate(input, env);

                const result = ctx.variables.local.get(`${id}_result`);
                ctx.variables.local.del(`${id}_flag`);
                ctx.variables.local.del(`${id}_result`);
                return result;
            }, id);

            expect(output).toBe('falsy');
        });

        // Inline {{if}} should not break outer {{else}} detection
        test('should handle inline if inside scoped if with else', async ({ page }) => {
            const output = await evaluateWithEngine(page, '{{if 0}}{{if::1::inner}}{{else}}outer-else{{/if}}');
            expect(output).toBe('outer-else');
        });

        // Another inline if scenario - inner inline if should not affect outer else
        test('should correctly find outer else with multiple inline ifs', async ({ page }) => {
            const output = await evaluateWithEngine(page, '{{if 0}}{{if::1::a}}{{if::1::b}}{{else}}found{{/if}}');
            expect(output).toBe('found');
        });
    });

    test.describe('Variable Macros (hasvar, deletevar)', () => {
        // {{hasvar::name}} - check if local variable exists
        test('should return true when local variable exists', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{hasvar::myvar}}', { local: { myvar: 'value' } });
            expect(output).toBe('true');
        });

        test('should return false when local variable does not exist', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{hasvar::nonexistent}}', { local: {} });
            expect(output).toBe('false');
        });

        test('should return true when local variable exists but is empty', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{hasvar::myvar}}', { local: { myvar: '' } });
            expect(output).toBe('true');
        });

        // {{hasglobalvar::name}} - check if global variable exists
        test('should return true when global variable exists', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{hasglobalvar::myvar}}', { global: { myvar: 'value' } });
            expect(output).toBe('true');
        });

        test('should return false when global variable does not exist', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{hasglobalvar::nonexistent}}', { global: {} });
            expect(output).toBe('false');
        });

        // {{deletevar::name}} - delete local variable
        test('should delete local variable', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{hasvar::myvar}}{{deletevar::myvar}}{{hasvar::myvar}}', { local: { myvar: 'value' } });
            expect(output).toBe('truefalse');
        });

        // {{deleteglobalvar::name}} - delete global variable
        test('should delete global variable', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{hasglobalvar::myvar}}{{deleteglobalvar::myvar}}{{hasglobalvar::myvar}}', { global: { myvar: 'value' } });
            expect(output).toBe('truefalse');
        });

        // Combining hasvar with if
        test('should use hasvar in if condition', async ({ page }) => {
            const output = await evaluateWithEngineAndVariables(page, '{{if {{hasvar::myvar}} == true}}exists{{else}}missing{{/if}}', { local: { myvar: '' } });
            expect(output).toBe('exists');
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
