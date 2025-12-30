import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

// Tests for the deprecated MacrosParser shim to ensure it continues to work
// both with the legacy regex macro system (feature flag disabled) and with
// the new macro engine (feature flag enabled).

test.describe('MacrosParser (legacy shim)', () => {
    test.beforeEach(testSetup.awaitST);

    test('should resolve macros via legacy evaluateMacros when experimental engine is disabled', async ({ page }) => {
        const output = await page.evaluate(async () => {
            const { MacrosParser, evaluateMacros } = await import('./scripts/macros.js');
            const { power_user } = await import('./scripts/power-user.js');

            power_user.experimental_macro_engine = false;

            MacrosParser.registerMacro('legacyParserTest', 'LEGACY_OK', 'Legacy parser test');

            const env = {};
            const result = evaluateMacros('Value: {{legacyParserTest}}.', env, (x) => x);

            MacrosParser.unregisterMacro('legacyParserTest');

            return result;
        });

        expect(output).toBe('Value: LEGACY_OK.');
    });

    test('should resolve macros via new engine when experimental engine is enabled', async ({ page }) => {
        const output = await page.evaluate(async () => {
            const { MacrosParser } = await import('./scripts/macros.js');
            const { substituteParams } = await import('./script.js');
            const { power_user } = await import('./scripts/power-user.js');

            power_user.experimental_macro_engine = true;

            MacrosParser.registerMacro('engineParserTest', 'ENGINE_OK', 'Engine parser test');

            const result = substituteParams('Value: {{engineParserTest}}.', {});

            MacrosParser.unregisterMacro('engineParserTest');

            return result;
        });

        expect(output).toBe('Value: ENGINE_OK.');
    });
});
