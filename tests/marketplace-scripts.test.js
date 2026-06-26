import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, test, expect } from '@jest/globals';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readRootPackage() {
    return JSON.parse(fs.readFileSync(path.join(rootDirectory, 'package.json'), 'utf8'));
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
});
