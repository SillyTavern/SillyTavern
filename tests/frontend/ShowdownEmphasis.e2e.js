import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test.describe('fixNestedEmphasis', () => {
    test.beforeEach(testSetup.goST);

    test.describe('Basic nested emphasis', () => {
        test('should convert inner emphasis to bold within outer emphasis', async ({ page }) => {
            const result = await runFixNestedEmphasis(page, '*She looks at you. *Are you okay?* she asks.*');
            expect(result).toBe('*She looks at you. **Are you okay?** she asks.*');
        });

        test('should handle the issue example case', async ({ page }) => {
            const result = await runFixNestedEmphasis(page, '*Some Text *Nested Emphasis Text* More text*');
            expect(result).toBe('*Some Text **Nested Emphasis Text** More text*');
        });

        test('should handle short nested action/speech', async ({ page }) => {
            const result = await runFixNestedEmphasis(page, '*action *speech* action*');
            expect(result).toBe('*action **speech** action*');
        });

        test('should handle nested emphasis with punctuation in inner text', async ({ page }) => {
            const result = await runFixNestedEmphasis(page, '*She sighs. *I never asked for this,* she mutters, turning away.*');
            expect(result).toBe('*She sighs. **I never asked for this,** she mutters, turning away.*');
        });
    });

    test.describe('Multiple nested pairs', () => {
        test('should handle multiple nested pairs in same outer emphasis', async ({ page }) => {
            const result = await runFixNestedEmphasis(page, '*action *speech1* middle *speech2* end*');
            expect(result).toBe('*action **speech1** middle **speech2** end*');
        });

        test('should handle multiple nested pairs with longer text', async ({ page }) => {
            const result = await runFixNestedEmphasis(page, '*She said *hello* and *goodbye* to him.*');
            expect(result).toBe('*She said **hello** and **goodbye** to him.*');
        });
    });

    test.describe('Text that should NOT be modified', () => {
        test('should not modify simple emphasis', async ({ page }) => {
            const result = await runFixNestedEmphasis(page, '*normal emphasis*');
            expect(result).toBe('*normal emphasis*');
        });

        test('should not modify bold text', async ({ page }) => {
            const result = await runFixNestedEmphasis(page, '**bold text**');
            expect(result).toBe('**bold text**');
        });

        test('should not modify sequential (non-nested) emphasis', async ({ page }) => {
            const result = await runFixNestedEmphasis(page, '*first emphasis* and *second emphasis*');
            expect(result).toBe('*first emphasis* and *second emphasis*');
        });

        test('should not modify already-correct bold inside italic', async ({ page }) => {
            const result = await runFixNestedEmphasis(page, '*text **already bold** text*');
            expect(result).toBe('*text **already bold** text*');
        });

        test('should not modify triple emphasis', async ({ page }) => {
            const result = await runFixNestedEmphasis(page, '***triple emphasis***');
            expect(result).toBe('***triple emphasis***');
        });

        test('should not modify plain text', async ({ page }) => {
            const result = await runFixNestedEmphasis(page, 'no formatting at all');
            expect(result).toBe('no formatting at all');
        });

        test('should not modify adjacent emphasis without spaces (non-nested pattern)', async ({ page }) => {
            const result = await runFixNestedEmphasis(page, '*hello*world*bye*');
            expect(result).toBe('*hello*world*bye*');
        });
    });

    test.describe('Nested bold (** inside **)', () => {
        test('should strip inner ** when nested inside outer **', async ({ page }) => {
            const result = await runFixNestedEmphasis(page, '**This is **bold**, is it?**');
            expect(result).toBe('**This is bold, is it?**');
        });

        test('should strip inner ** for simple nesting', async ({ page }) => {
            const result = await runFixNestedEmphasis(page, '**text **nested** text**');
            expect(result).toBe('**text nested text**');
        });

        test('should strip inner ** for short content', async ({ page }) => {
            const result = await runFixNestedEmphasis(page, '**a **b** c**');
            expect(result).toBe('**a b c**');
        });

        test('should strip inner ** with longer word', async ({ page }) => {
            const result = await runFixNestedEmphasis(page, '**She said **hello** to him**');
            expect(result).toBe('**She said hello to him**');
        });

        test('should handle multiple nested ** pairs', async ({ page }) => {
            const result = await runFixNestedEmphasis(page, '**She **whispered** and then **shouted** at him**');
            expect(result).toBe('**She whispered and then shouted at him**');
        });

        test('should not modify normal bold (no nesting)', async ({ page }) => {
            const result = await runFixNestedEmphasis(page, '**normal bold**');
            expect(result).toBe('**normal bold**');
        });

        test('should not modify sequential bold', async ({ page }) => {
            const result = await runFixNestedEmphasis(page, '**first** and **second**');
            expect(result).toBe('**first** and **second**');
        });
    });

    test.describe('Edge cases', () => {
        test('should handle nested emphasis next to sequential emphasis', async ({ page }) => {
            const result = await runFixNestedEmphasis(page, '*start *nested* end* and *another*');
            expect(result).toBe('*start **nested** end* and *another*');
        });

        test('should not modify asterisk preceded by space (non-flanking)', async ({ page }) => {
            const result = await runFixNestedEmphasis(page, '*single asterisk at end *');
            expect(result).toBe('*single asterisk at end *');
        });

        test('should handle nested emphasis adjacent to punctuation', async ({ page }) => {
            const result = await runFixNestedEmphasis(page, '*She said: *"Hello!"* quietly.*');
            expect(result).toBe('*She said: **"Hello!"** quietly.*');
        });

        test('should handle tabs as whitespace around nested emphasis', async ({ page }) => {
            const result = await runFixNestedEmphasis(page, '*She looks.\t*Are you okay?*\tshe asks.*');
            expect(result).toBe('*She looks.\t**Are you okay?**\tshe asks.*');
        });

        test('should process each line independently for multi-line text', async ({ page }) => {
            const result = await runFixNestedEmphasis(page, '*first line\n*nested* second line*');
            // Lines are processed independently - first line has only 1 asterisk, second has 3
            expect(result).toBe('*first line\n*nested* second line*');
        });
    });

    test.describe('Code block protection', () => {
        test('should not modify content inside inline code', async ({ page }) => {
            const result = await runFixNestedEmphasis(page, '`*code *nested* code*`');
            expect(result).toBe('`*code *nested* code*`');
        });

        test('should not modify content inside fenced code blocks', async ({ page }) => {
            const result = await runFixNestedEmphasis(page, '```\n*code *nested* code*\n```');
            expect(result).toBe('```\n*code *nested* code*\n```');
        });
    });

    test.describe('Realistic roleplay examples', () => {
        test('should handle dialogue within action narration', async ({ page }) => {
            const input = '*She reaches out, her hand trembling. *Please... don\'t leave me,* she whispers, tears streaming down her face.*';
            const expected = '*She reaches out, her hand trembling. **Please... don\'t leave me,** she whispers, tears streaming down her face.*';
            const result = await runFixNestedEmphasis(page, input);
            expect(result).toBe(expected);
        });

        test('should handle multiple dialogue lines within narration', async ({ page }) => {
            const input = '*The door creaks open. *Who\'s there?* a voice calls out from the darkness. *Show yourself!* it demands.*';
            const expected = '*The door creaks open. **Who\'s there?** a voice calls out from the darkness. **Show yourself!** it demands.*';
            const result = await runFixNestedEmphasis(page, input);
            expect(result).toBe(expected);
        });
    });

    test.describe('Full pipeline (fixNestedEmphasis + showdown)', () => {
        test('should render nested emphasis as italic with bold inside', async ({ page }) => {
            const html = await runFullPipeline(page, '*action *speech* action*');
            expect(html).toContain('<em>');
            expect(html).toContain('<strong>');
            expect(html).toContain('speech');
        });

        test('should render basic nested example correctly', async ({ page }) => {
            const html = await runFullPipeline(page, '*Some Text *Nested Emphasis Text* More text*');
            expect(html).toMatch(/<em>.*<strong>Nested Emphasis Text<\/strong>.*<\/em>/);
        });

        test('should not break normal emphasis rendering', async ({ page }) => {
            const html = await runFullPipeline(page, '*normal emphasis*');
            expect(html).toContain('<em>normal emphasis</em>');
        });

        test('should not break bold rendering', async ({ page }) => {
            const html = await runFullPipeline(page, '**bold text**');
            expect(html).toContain('<strong>bold text</strong>');
        });

        test('should not break sequential emphasis rendering', async ({ page }) => {
            const html = await runFullPipeline(page, '*first* and *second*');
            expect(html).toContain('<em>first</em>');
            expect(html).toContain('<em>second</em>');
        });

        test('should render nested bold as single bold block', async ({ page }) => {
            const html = await runFullPipeline(page, '**This is **bold**, is it?**');
            expect(html).toContain('<strong>');
            expect(html).toContain('This is bold');
            expect(html).not.toContain('**');
        });

        test('should render stripped nested bold correctly', async ({ page }) => {
            const html = await runFullPipeline(page, '**text **nested** text**');
            expect(html).toMatch(/<strong>text nested text<\/strong>/);
        });
    });
});

/**
 * Run fixNestedEmphasis in the browser context.
 * @param {import('@playwright/test').Page} page
 * @param {string} input
 * @returns {Promise<string>}
 */
async function runFixNestedEmphasis(page, input) {
    return await page.evaluate(async (text) => {
        /** @type {import('../../public/scripts/showdown-emphasis.js')} */
        const { fixNestedEmphasis } = await import('./scripts/showdown-emphasis.js');
        return fixNestedEmphasis(text);
    }, input);
}

/**
 * Run fixNestedEmphasis followed by showdown conversion in the browser context.
 * @param {import('@playwright/test').Page} page
 * @param {string} input
 * @returns {Promise<string>}
 */
async function runFullPipeline(page, input) {
    return await page.evaluate(async (text) => {
        /** @type {import('../../public/scripts/showdown-emphasis.js')} */
        const { fixNestedEmphasis } = await import('./scripts/showdown-emphasis.js');
        const { showdown } = await import('./lib.js');
        const converter = new showdown.Converter({
            literalMidWordUnderscores: true,
            simpleLineBreaks: true,
        });
        const fixed = fixNestedEmphasis(text);
        return converter.makeHtml(fixed);
    }, input);
}
