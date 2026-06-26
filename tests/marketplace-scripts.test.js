import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, test, expect } from '@jest/globals';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readRootPackage() {
    return JSON.parse(fs.readFileSync(path.join(rootDirectory, 'package.json'), 'utf8'));
}

function readReadme() {
    return fs.readFileSync(path.join(rootDirectory, 'README.md'), 'utf8');
}

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getReadmeScriptSection(readme) {
    const startMarker = '### Useful Scripts';
    const endMarker = '### Development Notes';
    const start = readme.indexOf(startMarker);
    const end = readme.indexOf(endMarker);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);

    return readme.slice(start, end);
}

describe('marketplace runnable scripts', () => {
    test('defines a slow full-loop marketplace validation command', () => {
        const { scripts } = readRootPackage();

        expect(scripts['test:marketplace:all']).toBe([
            'npm run test:marketplace',
            'npm run test:marketplace:smoke',
            'npm run test:marketplace:e2e:server',
        ].join(' && '));
    });

    test('keeps the fast marketplace command free of recursive slow-loop calls', () => {
        const { scripts } = readRootPackage();

        expect(scripts['test:marketplace']).toContain('npm run test:marketplace:syntax');
        expect(scripts['test:marketplace']).toContain('market-wallet.test.js');
        expect(scripts['test:marketplace']).not.toContain('test:marketplace:all');
        expect(scripts['test:marketplace']).not.toContain('test:marketplace:e2e:server');
    });

    test('checks marketplace wallet static extension assets in the syntax gate', () => {
        const script = fs.readFileSync(path.join(rootDirectory, 'scripts/check-marketplace-syntax.mjs'), 'utf8');

        expect(script).toContain('staticAssets');
        expect(script).toContain('public/scripts/extensions/marketplace-wallet/manifest.json');
        expect(script).toContain('public/scripts/extensions/marketplace-wallet/window.html');
        expect(script).toContain('public/scripts/extensions/marketplace-wallet/style.css');
        expect(script).toContain('JSON.parse(content)');
        expect(script).toContain('asset ok: ${asset.file}');
    });

    test('documents hosted marketplace and PWA scripts in README', () => {
        const { scripts } = readRootPackage();
        const readmeScriptSection = getReadmeScriptSection(readReadme());
        const documentedScripts = [
            'start:no-csrf',
            'marketplace:seed:demo',
            'marketplace:export:snapshot',
            'marketplace:export:api',
            'test:marketplace:syntax',
            'test:marketplace',
            'test:marketplace:smoke',
            'test:marketplace:e2e',
            'test:marketplace:e2e:server',
            'test:marketplace:all',
            'test:pwa',
            'test:pwa:e2e',
        ];

        for (const scriptName of documentedScripts) {
            expect(scripts).toHaveProperty(scriptName);
            expect(readmeScriptSection).toMatch(new RegExp(`npm run ${escapeRegex(scriptName)}(?:\\s|$)`));
        }
    });
});
