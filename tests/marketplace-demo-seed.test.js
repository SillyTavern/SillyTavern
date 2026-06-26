import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, test, expect, afterEach } from '@jest/globals';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const seedScript = path.join(rootDirectory, 'scripts', 'seed-marketplace-demo.mjs');
const tempRoots = [];

function makeTempRoot() {
    const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'st-market-demo-seed-'));
    tempRoots.push(dataRoot);
    return dataRoot;
}

function runSeed(dataRoot, args = []) {
    return execFileSync(process.execPath, [seedScript, '--dataRoot', dataRoot, ...args], {
        cwd: rootDirectory,
        encoding: 'utf8',
    });
}

function readStore(dataRoot) {
    return JSON.parse(fs.readFileSync(path.join(dataRoot, 'market-assets.json'), 'utf8'));
}

describe('marketplace demo seed script', () => {
    afterEach(() => {
        for (const dataRoot of tempRoots.splice(0)) {
            fs.rmSync(dataRoot, { recursive: true, force: true });
        }
    });

    test('requires an explicit data root', () => {
        expect(() => execFileSync(process.execPath, [seedScript], {
            cwd: rootDirectory,
            encoding: 'utf8',
            stdio: 'pipe',
        })).toThrow();
    });

    test('creates listed demo assets and preserves wallet storage isolation', () => {
        const dataRoot = makeTempRoot();

        const output = runSeed(dataRoot);
        const store = readStore(dataRoot);

        expect(output).toContain('Seeded 2 demo marketplace assets');
        expect(output).toContain('Created: 2; updated: 0');
        expect(store).toMatchObject({
            version: 1,
            entitlements: [],
            installs: [],
            reports: [],
        });
        expect(store.assets).toHaveLength(2);
        expect(fs.existsSync(path.join(dataRoot, '_storage'))).toBe(false);

        const character = store.assets.find(asset => asset.id === 'demo_character_mira');
        expect(character).toMatchObject({
            creator_id: 'demo-creator',
            type: 'character_card',
            title: 'Mira the Harbor Oracle',
            visibility: 'public',
            status: 'listed',
            price_type: 'free',
            price_coins: 0,
            sales_count: 0,
            install_count: 0,
            metadata: {
                demo: true,
            },
        });
        expect(character.normalized_payload).toMatchObject({
            spec: 'chara_card_v2',
            spec_version: '2.0',
            data: {
                name: 'Mira the Harbor Oracle',
            },
        });
        expect(Array.isArray(character.normalized_payload.data.alternate_greetings)).toBe(true);
        expect(Array.isArray(character.normalized_payload.data.tags)).toBe(true);

        const world = store.assets.find(asset => asset.id === 'demo_world_clockwork');
        expect(world).toMatchObject({
            creator_id: 'demo-creator',
            type: 'world_book',
            title: 'Clockwork City Lore',
            visibility: 'public',
            status: 'listed',
            price_type: 'fixed_price',
            price_coins: 25,
            sales_count: 0,
            install_count: 0,
        });
        expect(Object.keys(world.normalized_payload.entries)).toEqual(['0', '1']);
    });

    test('upserts demo assets without duplicating or clearing marketplace state', () => {
        const dataRoot = makeTempRoot();

        runSeed(dataRoot);
        const firstStore = readStore(dataRoot);
        const firstCharacter = firstStore.assets.find(asset => asset.id === 'demo_character_mira');
        firstCharacter.sales_count = 7;
        firstCharacter.install_count = 3;
        firstStore.entitlements.push({
            id: 'ent_existing_demo',
            user_id: 'reader',
            asset_id: 'demo_character_mira',
            source: 'free',
            created_at: '2026-01-01T00:00:00.000Z',
            revoked_at: null,
        });
        fs.writeFileSync(path.join(dataRoot, 'market-assets.json'), JSON.stringify(firstStore, null, 4), 'utf8');

        const output = runSeed(dataRoot, ['--creator', 'seed-admin']);
        const store = readStore(dataRoot);
        const demoAssets = store.assets.filter(asset => asset.metadata?.seeded_by === 'scripts/seed-marketplace-demo.mjs');
        const character = store.assets.find(asset => asset.id === 'demo_character_mira');

        expect(output).toContain('Created: 0; updated: 2');
        expect(demoAssets.map(asset => asset.id).sort()).toEqual([
            'demo_character_mira',
            'demo_world_clockwork',
        ]);
        expect(character.creator_id).toBe('seed-admin');
        expect(character.sales_count).toBe(7);
        expect(character.install_count).toBe(3);
        expect(store.entitlements).toHaveLength(1);
        expect(store.entitlements[0].id).toBe('ent_existing_demo');
    });
});
