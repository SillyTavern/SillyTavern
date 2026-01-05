import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test.describe('MacroSlashCommands', () => {
    test.beforeEach(testSetup.awaitST);

    test.describe('Parser Flags', () => {
        test('should bypass REPLACE_GETVAR', async ({ page }) => {
            const output = await page.evaluate(async () => {
                const { executeSlashCommandsWithOptions } = await import('./scripts/slash-commands.js');
                const { power_user } = await import('./scripts/power-user.js');

                power_user.experimental_macro_engine = true;

                return (await executeSlashCommandsWithOptions('/parser-flag REPLACE_GETVAR || /setvar key=x \\{\\{lastMessageId}} || /pass {{getvar::x}}')).pipe;
            });

            expect(output).toBe('{{lastMessageId}}');
        });
    });

    test.describe('{{pipe}} Macro', () => {
        test('should support {{pipe}} macro', async ({ page }) => {
            const output = await page.evaluate(async () => {
                const { executeSlashCommandsWithOptions } = await import('./scripts/slash-commands.js');
                const { power_user } = await import('./scripts/power-user.js');

                power_user.experimental_macro_engine = true;

                return (await executeSlashCommandsWithOptions('/pass Hello World || /pass {{pipe}}')).pipe;
            });

            expect(output).toBe('Hello World');
        });
    });

    test.describe('{{var}} Macro', () => {
        test('should support {{var::key}} macro', async ({ page }) => {
            const output = await page.evaluate(async () => {
                const { executeSlashCommandsWithOptions } = await import('./scripts/slash-commands.js');
                const { power_user } = await import('./scripts/power-user.js');

                power_user.experimental_macro_engine = true;

                return (await executeSlashCommandsWithOptions('/let key=greeting Hello || /pass {{var::greeting}}')).pipe;
            });

            expect(output).toBe('Hello');
        });

        test('should support {{var::key::index}} macro', async ({ page }) => {
            const output = await page.evaluate(async () => {
                const { executeSlashCommandsWithOptions } = await import('./scripts/slash-commands.js');
                const { power_user } = await import('./scripts/power-user.js');

                power_user.experimental_macro_engine = true;

                return (await executeSlashCommandsWithOptions('/let key=list ["item1","item2","item3"] || /pass {{var::list::1}}')).pipe;
            });

            expect(output).toBe('item2');
        });

        test('should not fail on unknown variable keys', async ({ page }) => {
            const output = await page.evaluate(async () => {
                const { executeSlashCommandsWithOptions } = await import('./scripts/slash-commands.js');
                const { power_user } = await import('./scripts/power-user.js');

                power_user.experimental_macro_engine = true;
                return (await executeSlashCommandsWithOptions('/pass {{var::unknownKey}}')).pipe;
            });

            expect(output).toBe('');
        });

        test('should not fail on out-of-bounds variable index', async ({ page }) => {
            const output = await page.evaluate(async () => {
                const { executeSlashCommandsWithOptions } = await import('./scripts/slash-commands.js');
                const { power_user } = await import('./scripts/power-user.js');

                power_user.experimental_macro_engine = true;

                return (await executeSlashCommandsWithOptions('/let key=test {"key":"value"} || /pass {{var::test::error}}')).pipe;
            });

            expect(output).toBe('');
        });
    });

    test.describe('{{arg}} Macro', () => {
        test('should support {{arg}} macro with plain value', async ({ page }) => {
            const output = await page.evaluate(async () => {
                const { executeSlashCommandsWithOptions } = await import('./scripts/slash-commands.js');
                const { power_user } = await import('./scripts/power-user.js');

                power_user.experimental_macro_engine = true;

                return (await executeSlashCommandsWithOptions('/qr-arg hello world || /pass {{arg::hello}}')).pipe;
            });

            expect(output).toBe('world');
        });

        test('should support {{arg}} macro with closure value', async ({ page }) => {
            const output = await page.evaluate(async () => {
                const { executeSlashCommandsWithOptions } = await import('./scripts/slash-commands.js');
                const { power_user } = await import('./scripts/power-user.js');

                power_user.experimental_macro_engine = true;

                return (await executeSlashCommandsWithOptions('/qr-arg x {: /echo test :} || /echo {{arg::x}}')).pipe;
            });

            expect(output).toBe('[Closure]');
        });

        test('should support mixed type {{arg}} macro values', async ({ page }) => {
            const output = await page.evaluate(async () => {
                const { executeSlashCommandsWithOptions } = await import('./scripts/slash-commands.js');
                const { power_user } = await import('./scripts/power-user.js');

                power_user.experimental_macro_engine = true;

                return (await executeSlashCommandsWithOptions('/qr-arg a simple || /qr-arg b {: /echo closure :} || /echo {{arg::a}} and {{arg::b}}')).pipe;
            });

            expect(output).toBe('simple and ,[Closure]');
        });

        test('should support wildcard {{arg}} macro', async ({ page }) => {
            const output = await page.evaluate(async () => {
                const { executeSlashCommandsWithOptions } = await import('./scripts/slash-commands.js');
                const { power_user } = await import('./scripts/power-user.js');

                power_user.experimental_macro_engine = true;

                return (await executeSlashCommandsWithOptions('/qr-arg * wildcard || /pass {{arg::any}}')).pipe;
            });

            expect(output).toBe('wildcard');
        });
    });

    test.describe('Custom Scope Macros', () => {
        test('should support {{timesIndex}} in /times command', async ({ page }) => {
            const output = await page.evaluate(async () => {
                const { executeSlashCommandsWithOptions } = await import('./scripts/slash-commands.js');
                const { power_user } = await import('./scripts/power-user.js');

                power_user.experimental_macro_engine = true;

                return (await executeSlashCommandsWithOptions('/times 1 {: /pass {{timesIndex}} :}')).pipe;
            });

            expect(output).toBe('0');
        });

        test('should support custom SlashCommandScope macros', async ({ page }) => {
            const output = await page.evaluate(async () => {
                const { executeSlashCommandsWithOptions } = await import('./scripts/slash-commands.js');
                const { SlashCommandScope } = await import('./scripts/slash-commands/SlashCommandScope.js');
                const { power_user } = await import('./scripts/power-user.js');

                power_user.experimental_macro_engine = true;

                // Create a custom scope with a macro
                const customScope = new SlashCommandScope(null);
                customScope.setMacro('uno::dos::tres', 'CUSTOM_VALUE');
                customScope.setMacro('uno::dos::quatro', 'SHOULD_NOT_BE_USED');
                customScope.setMacro('uno::dos::*', 'WILDCARD_VALUE');
                return (await executeSlashCommandsWithOptions('/pass {{uno::dos::tres}}', { scope: customScope })).pipe;
            });

            expect(output).toBe('CUSTOM_VALUE');
        });
    });
});
