import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test.describe('External media in messages', () => {
    test.beforeEach(testSetup.awaitST);

    /**
     * Formats a message and reports what the resulting HTML turns into.
     * @param {import('@playwright/test').Page} page
     * @param {string} text Message text
     * @param {{ forbidExternalMedia?: boolean }} [options]
     */
    async function render(page, text, { forbidExternalMedia = true } = {}) {
        return await page.evaluate(async ({ text, forbidExternalMedia }) => {
            const { messageFormatting } = await import('./script.js');
            const { power_user } = await import('./scripts/power-user.js');
            const before = power_user.forbid_external_media;
            power_user.forbid_external_media = forbidExternalMedia;
            try {
                // A scheme other than the one of the page, as a URL like "https:host" is relative on a https page
                const otherScheme = window.location.protocol === 'https:' ? 'http:' : 'https:';
                const html = messageFormatting(text.replaceAll('__ORIGIN__', window.location.origin).replaceAll('__OTHER_SCHEME__', otherScheme), 'Bot', false, false, 0);
                const template = document.createElement('template');
                template.innerHTML = html;
                const elements = [...template.content.querySelectorAll('*')];
                return {
                    tags: elements.map(x => x.tagName.toLowerCase()),
                    handlers: elements.flatMap(x => x.getAttributeNames()).filter(x => x.startsWith('on')),
                    css: [...template.content.querySelectorAll('style')].map(x => x.textContent).join('\n'),
                    styleAttributes: elements.map(x => x.getAttribute('style')).filter(Boolean),
                    backgrounds: elements.map(x => x.getAttribute('background')).filter(Boolean),
                    loaded: elements.filter(x => ['image', 'use', 'feimage', 'input'].includes(x.tagName.toLowerCase()))
                        .map(x => x.getAttribute('href') || x.getAttribute('xlink:href') || x.getAttribute('src')).filter(Boolean),
                };
            } finally {
                power_user.forbid_external_media = before;
            }
        }, { text, forbidExternalMedia });
    }

    test('external references in CSS are removed when external media is forbidden', async ({ page }) => {
        const declarations = [
            'background: url(https://example.com/a.png)',
            'background: url(//example.com/a.png)',
            'background: url("//example.com/a.png")',
            'background: url(/\\\\example.com/a.png)',
            'background: url(\\2f\\2f example.com/a.png)',
            'background: url(__OTHER_SCHEME__example.com/a.png)',
            'background: u\\72l(https://example.com/a.png)',
            'background: url(/**/"https://example.com/a.png")',
            'background: image-set(/**/"https://example.com/a.png" 1x)',
            '--image: url(https://example.com/a.png)',
            '--image: "https://example.com/a.png"; background: image-set(var(--image) 1x)',
            '--image: \'//example.com/a.png\'',
            '-\\-image: "https://example.com/a.png"; background: image-set(var(--image) 1x)',
            '/* " */ --image: "https://example.com/a.png"',
            'background: var(--image, "https://example.com/a.png")',
            'background: image-set("//example.com/a.png" 1x)',
            'background: url(__ORIGIN__.example.com/a.png)',
            'background: url("//example.com/\\"a.png")',
        ];

        for (const declaration of declarations) {
            const result = await render(page, `<style>.box { color: red; ${declaration}; }</style>`);
            expect(result.css, declaration).toContain('color: red');
            expect(result.css, declaration).not.toContain('example.com');
        }

        const svg = 'data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27/%3E';
        const local = await render(page, `<style>.box { background: url(/img/a.png); mask: url("data:image/png;base64,//8AAA=="); border-image: url(__ORIGIN__/img/b.png); cursor: url(${svg}); }</style>`);
        expect(local.css).toContain('/img/a.png');
        expect(local.css).toContain('base64,//8AAA==');
        expect(local.css).toContain('/img/b.png');
        expect(local.css).toContain('www.w3.org');

        const quotedSvg = 'data:image/svg+xml,%3Csvg%20xmlns=\'http://www.w3.org/2000/svg\'/%3E';
        const nested = await render(page, `<style>.box { background: image-set("${quotedSvg}" 1x); --image: "${quotedSvg}"; }</style>`);
        expect(nested.css.match(/www\.w3\.org/g)).toHaveLength(2);

        const strings = await render(page, '<style>.box::before { content: "Note: "; } .box::after { content: "see https://example.com"; --label: "a: b"; }</style>');
        expect(strings.css).toContain('Note: ');
        expect(strings.css).toContain('see https://example.com');
        expect(strings.css).toContain('a: b');

        const allowed = await render(page, '<style>.box { background: url(//example.com/a.png); }</style>', { forbidExternalMedia: false });
        expect(allowed.css).toContain('example.com');
    });

    test('external references in attributes are removed when external media is forbidden', async ({ page }) => {
        const text = '<div style="background-image: url(//example.com/a.png)">A</div><div style="color: red">B</div><table background="https://example.com/a.png"><tr><td>C</td></tr></table>';

        const result = await render(page, text);
        expect(result.styleAttributes).toEqual(['color: red']);
        expect(result.backgrounds).toEqual([]);

        const allowed = await render(page, text, { forbidExternalMedia: false });
        expect(allowed.styleAttributes).toHaveLength(2);
        expect(allowed.backgrounds).toHaveLength(1);

        const external = [
            '<div style="background: url(/img/a.png), url(//example.com/a.png)">A</div>',
            '<div style="background: url(//example.com/a.png">A</div>',
            '<div style="background: url(/\\\\example.com/a.png)">A</div>',
            '<div style="background: u\\72l(https://example.com/a.png)">A</div>',
            '<div style="/* \' */ background: url(https://example.com/a.png)">A</div>',
            '<div style="--image: \'https://example.com/a.png\'; background: image-set(var(--image) 1x)">A</div>',
            '<div style="\\2d-image: \'https://example.com/a.png\'; background: image-set(var(\\2d-image) 1x)">A</div>',
            '<div style="background: u\\72&#13;&#10;l(https://example.com/a.png)">A</div>',
            '<table background="/\\example.com/a.png"><tr><td>A</td></tr></table>',
            '<table background="__ORIGIN__.example.com/a.png"><tr><td>A</td></tr></table>',
        ];
        for (const item of external) {
            const blocked = await render(page, item);
            expect(blocked.styleAttributes, item).toEqual([]);
            expect(blocked.backgrounds, item).toEqual([]);
        }

        const svg = 'data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27/%3E';
        const local = await render(page, `<div style="background: url(__ORIGIN__/img/a.png); color: red">A</div><div style="background: url(${svg})">B</div><table background="__ORIGIN__/img/a.png"><tr><td>C</td></tr></table>`);
        expect(local.styleAttributes).toHaveLength(2);
        expect(local.backgrounds).toHaveLength(1);

        const strings = await render(page, '<div style="--label: \'Note: \'; color: red">A</div>');
        expect(strings.styleAttributes).toHaveLength(1);
    });

    test('external references of elements that load them are removed when external media is forbidden', async ({ page }) => {
        const text = '<svg width="10" height="10"><image href="https://example.com/a.png" width="10" height="10"></image><image href="/img/ai4.png" width="10" height="10"></image></svg>';

        const result = await render(page, text);
        expect(result.loaded).toEqual(['/img/ai4.png']);

        const allowed = await render(page, text, { forbidExternalMedia: false });
        expect(allowed.loaded).toEqual(['https://example.com/a.png', '/img/ai4.png']);
    });
});
