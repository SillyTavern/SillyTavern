import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from '@jest/globals';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(testDir, '..');

function readSourceFile(fileName) {
    return fs.readFileSync(path.join(rootDir, fileName), 'utf8');
}

describe('hosted tavern health endpoint contract', () => {
    test('exposes a public lightweight health endpoint before authenticated routes', () => {
        const source = readSourceFile('src/server-main.js');
        const healthRouteIndex = source.indexOf("app.get('/api/health'");
        const loginMiddlewareIndex = source.indexOf('app.use(requireLoginMiddleware)');

        expect(healthRouteIndex).toBeGreaterThan(-1);
        expect(loginMiddlewareIndex).toBeGreaterThan(-1);
        expect(healthRouteIndex).toBeLessThan(loginMiddlewareIndex);
        expect(source).toContain("status: 'ok'");
        expect(source).toContain("service: 'sillytavern'");
        expect(source).toContain('version.pkgVersion');
        expect(source).toContain('process.uptime()');
        expect(source).toContain('new Date().toISOString()');
    });
});
