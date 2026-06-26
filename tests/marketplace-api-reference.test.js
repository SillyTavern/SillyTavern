import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, test, expect, afterEach } from '@jest/globals';

import { generateMarketplaceApiReference, run } from '../scripts/export-marketplace-api-reference.mjs';

let tmpRoot = '';

afterEach(async () => {
    if (tmpRoot) {
        await rm(tmpRoot, { recursive: true, force: true });
        tmpRoot = '';
    }
});

describe('marketplace API reference export script', () => {
    test('generates markdown from current MVP routes', async () => {
        const markdown = await generateMarketplaceApiReference({ generatedAt: '2026-06-26T00:00:00.000Z' });

        expect(markdown).toContain('# Marketplace API Reference');
        expect(markdown).toContain('Generated at: 2026-06-26T00:00:00.000Z');
        expect(markdown).toContain('## Market API');
        expect(markdown).toContain('GET    /api/market/assets');
        expect(markdown).toContain('GET    /api/market/assets/:id');
        expect(markdown).toContain('GET    /api/market/creator/summary');
        expect(markdown).toContain('GET    /api/market/library');
        expect(markdown).toContain('GET    /api/market/reports/admin');
        expect(markdown).toContain('PATCH  /api/market/assets/:id');
        expect(markdown).toContain('POST   /api/market/assets');
        expect(markdown).toContain('POST   /api/market/assets/:id/submit');
        expect(markdown).toContain('POST   /api/market/assets/:id/approve');
        expect(markdown).toContain('POST   /api/market/assets/:id/reject');
        expect(markdown).toContain('POST   /api/market/assets/:id/delist');
        expect(markdown).toContain('POST   /api/market/assets/:id/report');
        expect(markdown).toContain('POST   /api/market/assets/:id/purchase');
        expect(markdown).toContain('POST   /api/market/assets/:id/install');
        expect(markdown).toContain('POST   /api/market/reports/:id/resolve');
        expect(markdown).toContain('## Wallet API');
        expect(markdown).toContain('GET    /api/wallet');
        expect(markdown).toContain('GET    /api/wallet/ledger');
        expect(markdown).toContain('POST   /api/wallet/grants/admin');
        expect(markdown).toContain('## Public health API');
        expect(markdown).toContain('GET    /api/health');
    });

    test('writes markdown to an explicit output path', async () => {
        tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'st-market-api-reference-'));
        const outPath = path.join(tmpRoot, 'api-reference.md');
        const logs = [];
        const originalLog = console.log;
        console.log = message => logs.push(message);
        try {
            await run(['--out', outPath]);
        } finally {
            console.log = originalLog;
        }

        const markdown = await readFile(outPath, 'utf8');
        expect(markdown).toContain('GET    /api/market/assets');
        expect(markdown).toContain('POST   /api/wallet/grants/admin');
        expect(logs.join('\n')).toContain('Marketplace API reference written to');
    });

    test('rejects unknown arguments', async () => {
        await expect(run(['--unknown'])).rejects.toThrow('Unknown argument: --unknown');
    });

    test('requires an output path after --out', async () => {
        await expect(run(['--out'])).rejects.toThrow('Missing value for --out');
        await expect(run(['--out='])).rejects.toThrow('Missing value for --out');
    });
});
