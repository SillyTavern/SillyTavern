import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test.describe('MacroRegistry', () => {
    // Currently this test suits runs without ST context. Enable, if ever needed
    test.beforeEach(testSetup.awaitST);

    test.describe('valid', () => {
        test('should register a macro with valid options', async ({ page }) => {
            const result = await page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroRegistry.js')} */
                const { MacroRegistry } = await import('./scripts/macros/engine/MacroRegistry.js');

                MacroRegistry.unregisterMacro('test-valid');
                MacroRegistry.registerMacro('test-valid', {
                    unnamedArgs: 2,
                    list: { min: 1, max: 3 },
                    strictArgs: false,
                    description: 'Test macro for validation.',
                    handler: ({ args }) => args.join(','),
                });

                const def = MacroRegistry.getMacro('test-valid');
                return {
                    name: def?.name,
                    minArgs: def?.minArgs,
                    maxArgs: def?.maxArgs,
                    list: def?.list,
                    strictArgs: def?.strictArgs,
                    description: def?.description,
                };
            });

            expect(result).toEqual({
                name: 'test-valid',
                minArgs: 2,
                maxArgs: 2,
                list: { min: 1, max: 3 },
                strictArgs: false,
                description: 'Test macro for validation.',
            });
        });
    });

    test.describe('reject', () => {
        test('should reject invalid macro name', async ({ page }) => {
            const result = await registerMacroAndCaptureErrors(page, {
                macroName: '   ',
                options: {},
            });

            expect(result.registered).toBeNull();
            expect(result.errors.length).toBeGreaterThan(0);

            const registrationError = result.errors.find(e => e.text.includes('[Macro] Registration Error:'));
            expect(registrationError).toBeTruthy();
            expect(registrationError?.text).toContain('Failed to register macro ""');
            expect(registrationError?.errorMessage).toContain('Must start with a letter, followed by alphanumeric characters or hyphens.');
        });

        test('should reject invalid options object', async ({ page }) => {
            const result = await registerMacroAndCaptureErrors(page, {
                macroName: 'invalid-options',
                options: null,
            });

            expect(result.registered).toBeNull();
            expect(result.errors.length).toBeGreaterThan(0);

            const registrationError = result.errors.find(e => e.text.includes('[Macro] Registration Error:'));
            expect(registrationError).toBeTruthy();
            expect(registrationError?.text).toContain('Failed to register macro "invalid-options"');
            expect(registrationError?.errorMessage).toContain('options must be a non-null object');
        });

        test('should reject invalid handler', async ({ page }) => {
            const result = await registerMacroAndCaptureErrors(page, {
                macroName: 'no-handler',
                options: { handler: null },
            });

            expect(result.registered).toBeNull();
            expect(result.errors.length).toBeGreaterThan(0);

            const registrationError = result.errors.find(e => e.text.includes('[Macro] Registration Error:'));
            expect(registrationError).toBeTruthy();
            expect(registrationError?.text).toContain('Failed to register macro "no-handler"');
            expect(registrationError?.errorMessage).toContain('options.handler must be a function');
        });

        test('should reject invalid unnamedArgs', async ({ page }) => {
            const result = await registerMacroAndCaptureErrors(page, {
                macroName: 'bad-required',
                options: {
                    unnamedArgs: -1,
                },
            });

            expect(result.registered).toBeNull();
            expect(result.errors.length).toBeGreaterThan(0);

            const registrationError = result.errors.find(e => e.text.includes('[Macro] Registration Error:'));
            expect(registrationError).toBeTruthy();
            expect(registrationError?.text).toContain('Failed to register macro "bad-required"');
            expect(registrationError?.errorMessage).toContain('options.unnamedArgs must be a non-negative integer');
        });

        test('should reject invalid strictArgs', async ({ page }) => {
            const result = await registerMacroAndCaptureErrors(page, {
                macroName: 'bad-strict',
                options: {
                    strictArgs: 'yes',
                },
            });

            expect(result.registered).toBeNull();
            expect(result.errors.length).toBeGreaterThan(0);

            const registrationError = result.errors.find(e => e.text.includes('[Macro] Registration Error:'));
            expect(registrationError).toBeTruthy();
            expect(registrationError?.text).toContain('Failed to register macro "bad-strict"');
            expect(registrationError?.errorMessage).toContain('options.strictArgs must be a boolean');
        });

        test('should reject invalid list configuration', async ({ page }) => {
            const result = await registerMacroAndCaptureErrors(page, {
                macroName: 'bad-list-type',
                options: {
                    list: 'invalid',
                },
            });

            expect(result.registered).toBeNull();
            expect(result.errors.length).toBeGreaterThan(0);

            const registrationError = result.errors.find(e => e.text.includes('[Macro] Registration Error:'));
            expect(registrationError).toBeTruthy();
            expect(registrationError?.text).toContain('Failed to register macro "bad-list-type"');
            expect(registrationError?.errorMessage).toContain('options.list must be a boolean');
        });

        test('should reject invalid list.min', async ({ page }) => {
            const result = await registerMacroAndCaptureErrors(page, {
                macroName: 'bad-list-min',
                options: {
                    list: { min: -1 },
                },
            });

            expect(result.registered).toBeNull();
            expect(result.errors.length).toBeGreaterThan(0);

            const registrationError = result.errors.find(e => e.text.includes('[Macro] Registration Error:'));
            expect(registrationError).toBeTruthy();
            expect(registrationError?.text).toContain('Failed to register macro "bad-list-min"');
            expect(registrationError?.errorMessage).toContain('options.list.min must be a non-negative integer');
        });

        test('should reject invalid list.max', async ({ page }) => {
            const result = await registerMacroAndCaptureErrors(page, {
                macroName: 'bad-list-max',
                options: {
                    list: { min: 2, max: 1 },
                },
            });

            expect(result.registered).toBeNull();
            expect(result.errors.length).toBeGreaterThan(0);

            const registrationError = result.errors.find(e => e.text.includes('[Macro] Registration Error:'));
            expect(registrationError).toBeTruthy();
            expect(registrationError?.text).toContain('Failed to register macro "bad-list-max"');
            expect(registrationError?.errorMessage).toContain('options.list.max must be greater than or equal to options.list.min');
        });

        test('should reject invalid description', async ({ page }) => {
            const result = await registerMacroAndCaptureErrors(page, {
                macroName: 'bad-desc',
                options: {
                    description: 123,
                },
            });

            expect(result.registered).toBeNull();
            expect(result.errors.length).toBeGreaterThan(0);

            const registrationError = result.errors.find(e => e.text.includes('[Macro] Registration Error:'));
            expect(registrationError).toBeTruthy();
            expect(registrationError?.text).toContain('Failed to register macro "bad-desc"');
            expect(registrationError?.errorMessage).toContain('options.description must be a string');
        });
    });

    test.describe('identifier validation', () => {
        test('should accept valid identifier with letters only', async ({ page }) => {
            const result = await registerMacroAndCaptureErrors(page, {
                macroName: 'validMacro',
                options: {},
            });
            expect(result.registered).not.toBeNull();
            expect(result.errors.length).toBe(0);
        });

        test('should accept valid identifier with hyphens', async ({ page }) => {
            const result = await registerMacroAndCaptureErrors(page, {
                macroName: 'my-macro-name',
                options: {},
            });
            expect(result.registered).not.toBeNull();
            expect(result.errors.length).toBe(0);
        });

        test('should accept valid identifier with underscores', async ({ page }) => {
            const result = await registerMacroAndCaptureErrors(page, {
                macroName: 'my_macro_name',
                options: {},
            });
            expect(result.registered).not.toBeNull();
            expect(result.errors.length).toBe(0);
        });

        test('should accept valid identifier with digits after first char', async ({ page }) => {
            const result = await registerMacroAndCaptureErrors(page, {
                macroName: 'macro123',
                options: {},
            });
            expect(result.registered).not.toBeNull();
            expect(result.errors.length).toBe(0);
        });

        test('should reject identifier starting with digit', async ({ page }) => {
            const result = await registerMacroAndCaptureErrors(page, {
                macroName: '123macro',
                options: {},
            });
            expect(result.registered).toBeNull();
            const registrationError = result.errors.find(e => e.text.includes('[Macro] Registration Error:'));
            expect(registrationError?.errorMessage).toContain('is invalid');
        });

        test('should reject identifier starting with hyphen', async ({ page }) => {
            const result = await registerMacroAndCaptureErrors(page, {
                macroName: '-macro',
                options: {},
            });
            expect(result.registered).toBeNull();
            const registrationError = result.errors.find(e => e.text.includes('[Macro] Registration Error:'));
            expect(registrationError?.errorMessage).toContain('is invalid');
        });

        test('should reject identifier with special characters', async ({ page }) => {
            const result = await registerMacroAndCaptureErrors(page, {
                macroName: 'macro@name',
                options: {},
            });
            expect(result.registered).toBeNull();
            const registrationError = result.errors.find(e => e.text.includes('[Macro] Registration Error:'));
            expect(registrationError?.errorMessage).toContain('is invalid');
        });

        test('should reject identifier with spaces', async ({ page }) => {
            const result = await registerMacroAndCaptureErrors(page, {
                macroName: 'macro name',
                options: {},
            });
            expect(result.registered).toBeNull();
            const registrationError = result.errors.find(e => e.text.includes('[Macro] Registration Error:'));
            expect(registrationError?.errorMessage).toContain('is invalid');
        });

        test('should accept valid alias identifier', async ({ page }) => {
            const result = await registerMacroAndCaptureErrors(page, {
                macroName: 'primaryMacro',
                options: {
                    aliases: [{ alias: 'valid-alias_123' }],
                },
            });
            expect(result.registered).not.toBeNull();
            expect(result.errors.length).toBe(0);
        });

        test('should reject invalid alias identifier', async ({ page }) => {
            const result = await registerMacroAndCaptureErrors(page, {
                macroName: 'primaryMacro2',
                options: {
                    aliases: [{ alias: '123-invalid' }],
                },
            });
            expect(result.registered).toBeNull();
            const registrationError = result.errors.find(e => e.text.includes('[Macro] Registration Error:'));
            expect(registrationError?.errorMessage).toContain('is invalid');
        });
    });
});

/**
 * @typedef {Object} CapturedConsoleError
 * @property {string} text
 * @property {string|null} errorMessage
 */

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ macroName: string, options: import('../../public/scripts/macros/engine/MacroRegistry.js').MacroDefinitionOptions|null }} params
 * @returns {Promise<{ registered: unknown, errors: CapturedConsoleError[] }>}
 */
async function registerMacroAndCaptureErrors(page, { macroName, options }) {
    const result = await page.evaluate(async ({ macroName, options }) => {
        /** @type {CapturedConsoleError[]} */
        const errors = [];
        const originalError = console.error;

        console.error = (...args) => {
            const text = args
                .map(a => (typeof a === 'string' ? a : (a instanceof Error ? `Error: ${a.message}` : '')))
                .filter(Boolean)
                .join(' ');

            /** @type {string|null} */
            let errorMessage = null;
            for (const a of args) {
                if (a instanceof Error) {
                    errorMessage ??= a.message;
                    continue;
                }
                if (a && typeof a === 'object' && 'error' in a && a.error instanceof Error) {
                    errorMessage ??= a.error.message;
                }
            }

            errors.push({ text, errorMessage });
        };

        try {
            /** @type {import('../../public/scripts/macros/engine/MacroRegistry.js')} */
            const { MacroRegistry } = await import('./scripts/macros/engine/MacroRegistry.js');

            /** @type {any} */
            let resolvedOptions = options;
            if (resolvedOptions && typeof resolvedOptions === 'object' && !('handler' in resolvedOptions)) {
                resolvedOptions = {
                    ...resolvedOptions,
                    handler: () => '',
                };
            }

            // Registering an invalid macro does not throw. It returns null and logs an error.
            const registered = MacroRegistry.registerMacro(macroName, resolvedOptions);
            return { registered, errors };
        } finally {
            console.error = originalError;
        }
    }, { macroName, options });

    return result;
}
