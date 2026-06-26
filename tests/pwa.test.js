import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from '@jest/globals';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testDir, '..');
const publicDir = path.join(rootDir, 'public');

function readPublicFile(fileName) {
    return fs.readFileSync(path.join(publicDir, fileName), 'utf8');
}

function readServiceWorkerShellAssets() {
    const serviceWorker = readPublicFile('service-worker.js');
    const sandbox = {
        self: {
            addEventListener: () => {},
        },
    };

    vm.createContext(sandbox);
    vm.runInContext(`${serviceWorker}\nthis.__SHELL_ASSETS__ = SHELL_ASSETS;`, sandbox);

    return sandbox.__SHELL_ASSETS__;
}

describe('hosted tavern PWA shell', () => {
    test('defines installable manifest metadata', () => {
        const manifest = JSON.parse(readPublicFile('manifest.json'));

        expect(manifest.id).toBe('/');
        expect(manifest.scope).toBe('/');
        expect(manifest.start_url).toBe('/');
        expect(manifest.display).toBe('standalone');
        expect(manifest.icons.some(icon => icon.sizes === '192x192')).toBe(true);
        expect(manifest.icons.some(icon => icon.sizes === '512x512')).toBe(true);
    });

    test('registers a service worker from app and login shells', () => {
        expect(readPublicFile('index.html')).toContain('scripts/pwa.js');
        expect(readPublicFile('login.html')).toContain('scripts/pwa.js');
        expect(readPublicFile('scripts/pwa.js')).toContain("navigator.serviceWorker.register('/service-worker.js')");
    });

    test('keeps API and non-GET requests out of the static shell cache', () => {
        const serviceWorker = readPublicFile('service-worker.js');

        expect(serviceWorker).toContain("request.method !== 'GET'");
        expect(serviceWorker).toContain("url.pathname.startsWith('/api/')");
        expect(serviceWorker).toContain('sillytavern-shell-v1');
    });

    test('precache shell assets exist in the public directory', () => {
        const shellAssets = readServiceWorkerShellAssets();

        expect(shellAssets).toEqual(expect.arrayContaining([
            '/',
            '/manifest.json',
            '/scripts/pwa.js',
        ]));

        for (const asset of shellAssets) {
            expect(asset).toMatch(/^\//);

            const relativePath = asset === '/' ? 'index.html' : asset.slice(1);
            expect(fs.existsSync(path.join(publicDir, relativePath))).toBe(true);
        }
    });
});
