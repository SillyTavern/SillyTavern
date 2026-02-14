import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test.describe('MacroRegistry', () => {
    // Currently this test suits runs without ST context. Enable, if ever needed
    test.beforeEach(testSetup.awaitST);

    test.describe('register valid', () => {
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

    test.describe('register reject', () => {
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

    test.describe('registerMacroAlias', () => {
        test.describe('valid', () => {
            test('should register an alias for an existing macro', async ({ page }) => {
                const result = await page.evaluate(async () => {
                    /** @type {import('../../public/scripts/macros/engine/MacroRegistry.js')} */
                    const { MacroRegistry } = await import('./scripts/macros/engine/MacroRegistry.js');

                    // Clean up any existing registrations
                    MacroRegistry.unregisterMacro('alias-target');
                    MacroRegistry.unregisterMacro('my-alias');

                    // Register target macro
                    MacroRegistry.registerMacro('alias-target', {
                        description: 'Target macro for alias test',
                        handler: () => 'target-result',
                    });

                    // Register alias
                    const success = MacroRegistry.registerMacroAlias('alias-target', 'my-alias');

                    const aliasDef = MacroRegistry.getMacro('my-alias');
                    const targetDef = MacroRegistry.getMacro('alias-target');

                    return {
                        success,
                        aliasName: aliasDef?.name,
                        aliasOf: aliasDef?.aliasOf,
                        aliasVisible: aliasDef?.aliasVisible,
                        targetName: targetDef?.name,
                        sameHandler: aliasDef?.handler === targetDef?.handler,
                    };
                });

                expect(result.success).toBe(true);
                expect(result.aliasName).toBe('my-alias');
                expect(result.aliasOf).toBe('alias-target');
                expect(result.aliasVisible).toBe(true);
                expect(result.targetName).toBe('alias-target');
                expect(result.sameHandler).toBe(true);
            });

            test('should register alias with visible=false option', async ({ page }) => {
                const result = await page.evaluate(async () => {
                    /** @type {import('../../public/scripts/macros/engine/MacroRegistry.js')} */
                    const { MacroRegistry } = await import('./scripts/macros/engine/MacroRegistry.js');

                    MacroRegistry.unregisterMacro('alias-target-hidden');
                    MacroRegistry.unregisterMacro('hidden-alias');

                    MacroRegistry.registerMacro('alias-target-hidden', {
                        description: 'Target macro',
                        handler: () => 'result',
                    });

                    const success = MacroRegistry.registerMacroAlias('alias-target-hidden', 'hidden-alias', { visible: false });
                    const aliasDef = MacroRegistry.getMacro('hidden-alias');

                    return {
                        success,
                        aliasVisible: aliasDef?.aliasVisible,
                    };
                });

                expect(result.success).toBe(true);
                expect(result.aliasVisible).toBe(false);
            });

            test('should resolve alias of alias to primary definition', async ({ page }) => {
                const result = await page.evaluate(async () => {
                    /** @type {import('../../public/scripts/macros/engine/MacroRegistry.js')} */
                    const { MacroRegistry } = await import('./scripts/macros/engine/MacroRegistry.js');

                    MacroRegistry.unregisterMacro('primary-macro');
                    MacroRegistry.unregisterMacro('first-alias');
                    MacroRegistry.unregisterMacro('second-alias');

                    // Register primary macro
                    MacroRegistry.registerMacro('primary-macro', {
                        description: 'Primary macro',
                        handler: () => 'primary-result',
                    });

                    // Register first alias
                    MacroRegistry.registerMacroAlias('primary-macro', 'first-alias');

                    // Register alias of alias (should resolve to primary)
                    const success = MacroRegistry.registerMacroAlias('first-alias', 'second-alias');

                    const secondAliasDef = MacroRegistry.getMacro('second-alias');

                    return {
                        success,
                        aliasOf: secondAliasDef?.aliasOf,
                    };
                });

                expect(result.success).toBe(true);
                // Should point to primary, not to the intermediate alias
                expect(result.aliasOf).toBe('primary-macro');
            });

            test('should have independent source for alias', async ({ page }) => {
                const result = await page.evaluate(async () => {
                    /** @type {import('../../public/scripts/macros/engine/MacroRegistry.js')} */
                    const { MacroRegistry } = await import('./scripts/macros/engine/MacroRegistry.js');

                    MacroRegistry.unregisterMacro('source-target');
                    MacroRegistry.unregisterMacro('source-alias');

                    MacroRegistry.registerMacro('source-target', {
                        description: 'Target',
                        handler: () => '',
                    });

                    MacroRegistry.registerMacroAlias('source-target', 'source-alias');

                    const targetDef = MacroRegistry.getMacro('source-target');
                    const aliasDef = MacroRegistry.getMacro('source-alias');

                    return {
                        // Both should have source objects
                        targetHasSource: !!targetDef?.source,
                        aliasHasSource: !!aliasDef?.source,
                        // The alias has its own source object (not shared reference)
                        sourcesAreDifferentObjects: targetDef?.source !== aliasDef?.source,
                    };
                });

                expect(result.targetHasSource).toBe(true);
                expect(result.aliasHasSource).toBe(true);
                expect(result.sourcesAreDifferentObjects).toBe(true);
            });

            test('should be case-insensitive for lookup', async ({ page }) => {
                const result = await page.evaluate(async () => {
                    /** @type {import('../../public/scripts/macros/engine/MacroRegistry.js')} */
                    const { MacroRegistry } = await import('./scripts/macros/engine/MacroRegistry.js');

                    MacroRegistry.unregisterMacro('case-target');
                    MacroRegistry.unregisterMacro('CaseAlias');

                    MacroRegistry.registerMacro('case-target', {
                        handler: () => '',
                    });

                    MacroRegistry.registerMacroAlias('case-target', 'CaseAlias');

                    return {
                        foundLowercase: !!MacroRegistry.getMacro('casealias'),
                        foundUppercase: !!MacroRegistry.getMacro('CASEALIAS'),
                        foundMixed: !!MacroRegistry.getMacro('CaseAlias'),
                    };
                });

                expect(result.foundLowercase).toBe(true);
                expect(result.foundUppercase).toBe(true);
                expect(result.foundMixed).toBe(true);
            });
        });

        test.describe('reject', () => {
            test('should reject invalid alias name', async ({ page }) => {
                const result = await registerAliasAndCaptureErrors(page, {
                    targetMacroName: 'random',
                    aliasName: '123-invalid',
                });

                expect(result.success).toBe(false);
                expect(result.errors.length).toBeGreaterThan(0);

                const registrationError = result.errors.find(e => e.text.includes('[Macro] Registration Error:'));
                expect(registrationError).toBeTruthy();
                expect(registrationError?.text).toContain('Failed to register alias "123-invalid"');
                expect(registrationError?.errorMessage).toContain('is invalid');
            });

            test('should reject alias same as target name (case insensitive)', async ({ page }) => {
                const result = await registerAliasAndCaptureErrors(page, {
                    targetMacroName: 'random',
                    aliasName: 'RANDOM',
                });

                expect(result.success).toBe(false);
                expect(result.errors.length).toBeGreaterThan(0);

                const registrationError = result.errors.find(e => e.text.includes('[Macro] Registration Error:'));
                expect(registrationError).toBeTruthy();
                expect(registrationError?.errorMessage).toContain('cannot be the same as the target macro name');
            });

            test('should reject alias for non-existent target macro', async ({ page }) => {
                const result = await registerAliasAndCaptureErrors(page, {
                    targetMacroName: 'non-existent-macro-xyz',
                    aliasName: 'my-alias',
                });

                expect(result.success).toBe(false);
                expect(result.errors.length).toBeGreaterThan(0);

                const registrationError = result.errors.find(e => e.text.includes('[Macro] Registration Error:'));
                expect(registrationError).toBeTruthy();
                expect(registrationError?.errorMessage).toContain('is not registered');
            });

            test('should reject alias with special characters', async ({ page }) => {
                const result = await registerAliasAndCaptureErrors(page, {
                    targetMacroName: 'random',
                    aliasName: 'alias@name',
                });

                expect(result.success).toBe(false);
                const registrationError = result.errors.find(e => e.text.includes('[Macro] Registration Error:'));
                expect(registrationError?.errorMessage).toContain('is invalid');
            });

            test('should reject alias starting with hyphen', async ({ page }) => {
                const result = await registerAliasAndCaptureErrors(page, {
                    targetMacroName: 'random',
                    aliasName: '-alias',
                });

                expect(result.success).toBe(false);
                const registrationError = result.errors.find(e => e.text.includes('[Macro] Registration Error:'));
                expect(registrationError?.errorMessage).toContain('is invalid');
            });
        });

        test.describe('warnings', () => {
            test('should warn when alias overwrites existing macro', async ({ page }) => {
                const result = await page.evaluate(async () => {
                    /** @type {string[]} */
                    const warnings = [];
                    const originalWarn = console.warn;

                    console.warn = (...args) => {
                        warnings.push(args.map(a => String(a)).join(' '));
                    };

                    try {
                        /** @type {import('../../public/scripts/macros/engine/MacroRegistry.js')} */
                        const { MacroRegistry } = await import('./scripts/macros/engine/MacroRegistry.js');

                        MacroRegistry.unregisterMacro('overwrite-target');
                        MacroRegistry.unregisterMacro('overwrite-existing');

                        // Register target macro
                        MacroRegistry.registerMacro('overwrite-target', {
                            handler: () => 'target',
                        });

                        // Register a macro that will be overwritten
                        MacroRegistry.registerMacro('overwrite-existing', {
                            handler: () => 'existing',
                        });

                        // Register alias that overwrites existing macro
                        const success = MacroRegistry.registerMacroAlias('overwrite-target', 'overwrite-existing');

                        return { success, warnings };
                    } finally {
                        console.warn = originalWarn;
                    }
                });

                expect(result.success).toBe(true);
                const overwriteWarning = result.warnings.find(w =>
                    w.includes('overwrites an existing macro') && w.includes('overwrite-existing'),
                );
                expect(overwriteWarning).toBeTruthy();
            });

            test('should warn when alias overwrites another alias', async ({ page }) => {
                const result = await page.evaluate(async () => {
                    /** @type {string[]} */
                    const warnings = [];
                    const originalWarn = console.warn;

                    console.warn = (...args) => {
                        warnings.push(args.map(a => String(a)).join(' '));
                    };

                    try {
                        /** @type {import('../../public/scripts/macros/engine/MacroRegistry.js')} */
                        const { MacroRegistry } = await import('./scripts/macros/engine/MacroRegistry.js');

                        MacroRegistry.unregisterMacro('alias-warn-target1');
                        MacroRegistry.unregisterMacro('alias-warn-target2');
                        MacroRegistry.unregisterMacro('shared-alias-name');

                        // Register two target macros
                        MacroRegistry.registerMacro('alias-warn-target1', { handler: () => '1' });
                        MacroRegistry.registerMacro('alias-warn-target2', { handler: () => '2' });

                        // Register first alias
                        MacroRegistry.registerMacroAlias('alias-warn-target1', 'shared-alias-name');

                        // Clear warnings from first registration
                        warnings.length = 0;

                        // Register second alias with same name (should warn)
                        MacroRegistry.registerMacroAlias('alias-warn-target2', 'shared-alias-name');

                        return { warnings };
                    } finally {
                        console.warn = originalWarn;
                    }
                });

                const overwriteWarning = result.warnings.find(w =>
                    w.includes('overwrites an existing macro') && w.includes('shared-alias-name'),
                );
                expect(overwriteWarning).toBeTruthy();
            });
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

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ targetMacroName: string, aliasName: string, options?: { visible?: boolean } }} params
 * @returns {Promise<{ success: boolean, errors: CapturedConsoleError[] }>}
 */
async function registerAliasAndCaptureErrors(page, { targetMacroName, aliasName, options = {} }) {
    const result = await page.evaluate(async ({ targetMacroName, aliasName, options }) => {
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

            // Registering an invalid alias does not throw. It returns false and logs an error.
            const success = MacroRegistry.registerMacroAlias(targetMacroName, aliasName, options);
            return { success, errors };
        } finally {
            console.error = originalError;
        }
    }, { targetMacroName, aliasName, options });

    return result;
}
