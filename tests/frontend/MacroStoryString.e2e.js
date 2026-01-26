import fs from 'node:fs';
import path from 'node:path';

import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';
import { serverDirectory } from '../../src/server-directory.js';

test.describe('MacroStoryString', () => {
    test.beforeEach(testSetup.awaitST);

    /** @type {any[]} */
    const defaultContextPresets = [];

    test.beforeAll(() => {
        const contextPresetsPath = path.join(serverDirectory, 'default', 'content', 'presets', 'context');
        const files = fs.readdirSync(contextPresetsPath).filter(f => path.extname(f).toLowerCase() === '.json');
        for (const file of files) {
            const fullPath = path.join(contextPresetsPath, file);
            const fileContent = fs.readFileSync(fullPath, 'utf-8');
            const preset = JSON.parse(fileContent);
            defaultContextPresets.push(preset);
        }
    });

    test('should produce equivalent story strings with new macro engine', async ({ page }) => {
        const output = await page.evaluate(async ([defaultContextPresets]) => {
            const { substituteParams, extension_prompt_types } = await import('./script.js');
            const { power_user, renderStoryString } = await import('./scripts/power-user.js');

            power_user.experimental_macro_engine = true;

            const context = {
                description: 'character description',
                personality: 'character personality',
                persona: 'persona details',
                scenario: 'scenario setup',
                system: 'system instructions',
                char: 'character name',
                user: 'user name',
                wiBefore: 'world info before',
                wiAfter: 'world info after',
                loreBefore: 'lore before',
                loreAfter: 'lore after',
                anchorBefore: 'before anchor text',
                anchorAfter: 'after anchor text',
                mesExamples: 'example messages',
                mesExamplesRaw: 'raw example messages',
            };

            const customInstructSettings = {
                enabled: false,
            };

            const customContextSettings = {
                story_string_position: extension_prompt_types.IN_PROMPT,
            };

            const result = [];

            function getMacroStoryString(templateString) {
                let output = substituteParams(templateString, { name1Override: context.user, name2Override: context.char, replaceCharacterCard: true, dynamicMacros: context });
                output = output.replace(/^\n+/, '');
                if (output.length > 0 && !output.endsWith('\n')) {
                    output += '\n';
                }
                return output;
            }

            for (const template of defaultContextPresets) {
                const classicStoryString = renderStoryString(context, { customStoryString: template.story_string, customContextSettings, customInstructSettings });
                const macroStoryString = getMacroStoryString(template.story_string);
                result.push({ name: template.name, classicStoryString, macroStoryString });
            }

            return result;
        }, [defaultContextPresets]);

        for (const { classicStoryString, macroStoryString, name } of output) {
            expect(macroStoryString, `Mismatch in template: ${name}`).toBe(classicStoryString);
        }
    });
});
