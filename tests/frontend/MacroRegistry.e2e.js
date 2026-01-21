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
            await expect(page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroRegistry.js')} */
                const { MacroRegistry } = await import('./scripts/macros/engine/MacroRegistry.js');
                // Empty name
                MacroRegistry.registerMacro('   ', {
                    handler: () => '',
                });
            })).rejects.toThrow(/Macro name must be a non-empty string/);
        });

        test('should reject invalid options object', async ({ page }) => {
            await expect(page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroRegistry.js')} */
                const { MacroRegistry } = await import('./scripts/macros/engine/MacroRegistry.js');
                // Options must be object
                // @ts-expect-error intentionally wrong
                MacroRegistry.registerMacro('invalid-options', null);
            })).rejects.toThrow(/options must be a non-null object/);
        });

        test('should reject invalid handler', async ({ page }) => {
            await expect(page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroRegistry.js')} */
                const { MacroRegistry } = await import('./scripts/macros/engine/MacroRegistry.js');
                // Handler must be function
                // @ts-expect-error intentionally wrong
                MacroRegistry.registerMacro('no-handler', { handler: null });
            })).rejects.toThrow(/options\.handler must be a function/);
        });

        test('should reject invalid unnamedArgs', async ({ page }) => {
            await expect(page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroRegistry.js')} */
                const { MacroRegistry } = await import('./scripts/macros/engine/MacroRegistry.js');
                // unnamedArgs must be non-negative integer
                MacroRegistry.registerMacro('bad-required', {
                    // @ts-expect-error intentionally wrong
                    unnamedArgs: -1,
                    handler: () => '',
                });
            })).rejects.toThrow(/options\.unnamedArgs must be a non-negative integer/);
        });

        test('should reject invalid strictArgs', async ({ page }) => {
            await expect(page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroRegistry.js')} */
                const { MacroRegistry } = await import('./scripts/macros/engine/MacroRegistry.js');
                // strictArgs must be boolean
                MacroRegistry.registerMacro('bad-strict', {
                    // @ts-expect-error intentionally wrong
                    strictArgs: 'yes',
                    handler: () => '',
                });
            })).rejects.toThrow(/options\.strictArgs must be a boolean/);
        });

        test('should reject invalid list configuration', async ({ page }) => {
            await expect(page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroRegistry.js')} */
                const { MacroRegistry } = await import('./scripts/macros/engine/MacroRegistry.js');
                // list must be boolean or object
                MacroRegistry.registerMacro('bad-list-type', {
                    // @ts-expect-error intentionally wrong
                    list: 'invalid',
                    handler: () => '',
                });
            })).rejects.toThrow(/options\.list must be a boolean or an object/);
        });

        test('should reject invalid list.min', async ({ page }) => {
            await expect(page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroRegistry.js')} */
                const { MacroRegistry } = await import('./scripts/macros/engine/MacroRegistry.js');
                // list.min must be non-negative
                MacroRegistry.registerMacro('bad-list-min', {
                    list: { min: -1 },
                    handler: () => '',
                });
            })).rejects.toThrow(/options\.list\.min must be a non-negative integer/);
        });

        test('should reject invalid list.max', async ({ page }) => {
            await expect(page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroRegistry.js')} */
                const { MacroRegistry } = await import('./scripts/macros/engine/MacroRegistry.js');
                // list.max must be >= min
                MacroRegistry.registerMacro('bad-list-max', {
                    list: { min: 2, max: 1 },
                    handler: () => '',
                });
            })).rejects.toThrow(/options\.list\.max must be greater than or equal to options\.list\.min/);
        });

        test('should reject invalid description', async ({ page }) => {
            await expect(page.evaluate(async () => {
                /** @type {import('../../public/scripts/macros/engine/MacroRegistry.js')} */
                const { MacroRegistry } = await import('./scripts/macros/engine/MacroRegistry.js');
                // description must be string
                MacroRegistry.registerMacro('bad-desc', {
                    // @ts-expect-error intentionally wrong
                    description: 123,
                    handler: () => '',
                });
            })).rejects.toThrow(/options\.description must be a string/);
        });
    });
});
