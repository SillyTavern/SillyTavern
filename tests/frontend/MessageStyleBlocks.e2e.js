import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test.describe('Style blocks in messages', () => {
    test.beforeEach(testSetup.awaitST);

    /**
     * Formats a message and reports what the resulting HTML turns into.
     * @param {import('@playwright/test').Page} page
     * @param {string} text Message text
     */
    async function render(page, text) {
        return await page.evaluate(async (text) => {
            const { messageFormatting } = await import('./script.js');
            const html = messageFormatting(text, 'Bot', false, false, 0);
            const template = document.createElement('template');
            template.innerHTML = html;
            const elements = [...template.content.querySelectorAll('*')];
            return {
                tags: elements.map(x => x.tagName.toLowerCase()),
                handlers: elements.flatMap(x => x.getAttributeNames()).filter(x => x.startsWith('on')),
                css: [...template.content.querySelectorAll('style')].map(x => x.textContent).join('\n'),
            };
        }, text);
    }

    test('a style block keeps its rules scoped to the message', async ({ page }) => {
        const result = await render(page, '<style>\n.box { color: red; }\n</style>\n<div class="box">Text</div>');

        expect(result.css).toContain('.mes_text .custom-box');
        expect(result.css).toContain('color: red');
        expect(result.tags).toEqual(['style', 'div']);
    });

    test('a style block keeps strings and child selectors', async ({ page }) => {
        const result = await render(page, '<style>\n.box > .item::before { content: "a < b"; }\n</style>');

        expect(result.css).toContain('.custom-box > .custom-item::before');
        expect(result.css).toContain('a < b');
        expect(result.tags).toEqual(['style']);
    });

    test('the content of a style block stays inside the style element', async ({ page }) => {
        const blocks = [
            '<style>\n/* </st<br/>yle><img src="x" onerror="1"> */\n.box { color: red; }\n</style>',
            '<style>.box { content: \'</st<br/>yle><img src=x onerror=1>\'; }</style>',
            '<style></st<br/>yle><img/src=x/onerror=1>{ color: red; }</style>',
        ];

        for (const block of blocks) {
            const result = await render(page, block);
            expect(result.handlers, block).toEqual([]);
            expect(result.tags.filter(x => x !== 'style'), block).toEqual([]);
        }
    });
});
