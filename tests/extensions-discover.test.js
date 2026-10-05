import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { afterAll, beforeAll, describe, expect, test } from '@jest/globals';

// extensions.js reads these config values at module load or per request; the env var
// overrides avoid needing a config.yaml in the test environment
process.env.SILLYTAVERN_GIT_BACKEND = 'auto';
process.env.SILLYTAVERN_EXTENSIONS_ENABLED = 'true';

// The extensions endpoint resolves the built-in extensions folder relative to the repo root
const originalCwd = process.cwd();
beforeAll(() => process.chdir(path.resolve(originalCwd, '..')));
afterAll(() => process.chdir(originalCwd));

describe('extensions discover', () => {
    /** @type {import('node:http').Server} */
    let server;
    let baseUrl;
    let userExtensionsDir;

    beforeAll(async () => {
        userExtensionsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'st-extensions-'));

        // A valid extension with a manifest
        fs.mkdirSync(path.join(userExtensionsDir, 'Valid-Extension'));
        fs.writeFileSync(path.join(userExtensionsDir, 'Valid-Extension', 'manifest.json'), JSON.stringify({ display_name: 'Valid' }));

        // A leftover folder without a manifest (e.g. locked .git remnant after manual deletion)
        fs.mkdirSync(path.join(userExtensionsDir, 'Deleted-Husk'));
        fs.mkdirSync(path.join(userExtensionsDir, 'Deleted-Husk', '.git'));

        const { default: express } = await import('express');
        const { router } = await import('../src/endpoints/extensions.js');
        const app = express();
        app.use((req, _res, next) => {
            req.user = {
                profile: { handle: 'test-user' },
                directories: { extensions: userExtensionsDir },
            };
            next();
        });
        app.use(router);
        server = app.listen(0, '127.0.0.1');
        await new Promise(resolve => server.once('listening', resolve));
        baseUrl = `http://127.0.0.1:${server.address().port}`;
    });

    afterAll(async () => {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
        fs.rmSync(userExtensionsDir, { recursive: true, force: true });
    });

    test('lists folders with a manifest and skips folders without one', async () => {
        const response = await fetch(`${baseUrl}/discover`);
        expect(response.status).toBe(200);
        const extensions = await response.json();
        const names = extensions.map(x => x.name);
        expect(names).toContain('third-party/Valid-Extension');
        expect(names).not.toContain('third-party/Deleted-Husk');
    });
});
