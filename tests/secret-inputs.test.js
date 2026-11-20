import { describe, test, expect } from '@jest/globals';
import fs from 'node:fs';

const indexHtml = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const openaiJs = fs.readFileSync(new URL('../public/scripts/openai.js', import.meta.url), 'utf8');
const styleCss = fs.readFileSync(new URL('../public/style.css', import.meta.url), 'utf8');
const inputTags = indexHtml.match(/<input\b[^>]*>/gi) ?? [];

function getInputById(id) {
    return inputTags.find(tag => tag.includes(`id="${id}"`));
}

describe('secret inputs', () => {
    test('keeps the proxy access key out of password manager form detection', () => {
        const input = getInputById('openai_proxy_access_key');

        expect(input).toBeDefined();
        expect(input).toContain('type="text"');
        expect(input).toContain('masked-secret');
        expect(input).not.toMatch(/\sform=/i);
        expect(indexHtml).not.toContain('id="openai_proxy_password"');
        expect(openaiJs).not.toContain('#openai_proxy_password');
        expect(openaiJs).toMatch(/proxy_password:\s*\['#openai_proxy_access_key', 'proxy_password'/);
        expect(openaiJs).toMatch(/\$\('#openai_proxy_access_key'\)\.toggleClass\('masked-secret'\)/);
        expect(openaiJs).toMatch(/\$\('#openai_proxy_access_key'\)\.on\('copy cut', function \(event\) \{\s*if \(\$\(this\)\.hasClass\('masked-secret'\)\) \{\s*event\.preventDefault\(\);/s);
        expect(styleCss).toMatch(/\.masked-secret\s*{[^}]*-webkit-text-security:\s*disc;/s);
    });

    test('uses a regular text input for the Azure API key', () => {
        const input = getInputById('api_key_azure_openai');

        expect(input).toBeDefined();
        expect(input).toContain('type="text"');
    });
});
