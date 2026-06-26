import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const files = [
    'src/endpoints/market.js',
    'src/endpoints/wallet.js',
    'src/server-main.js',
    'src/server-startup.js',
    'public/scripts/pwa.js',
    'public/service-worker.js',
    'public/scripts/extensions/marketplace-wallet/filters.js',
    'public/scripts/extensions/marketplace-wallet/index.js',
    'scripts/run-marketplace-e2e.mjs',
    'scripts/export-marketplace-api-reference.mjs',
    'scripts/export-marketplace-snapshot.mjs',
    'scripts/seed-marketplace-demo.mjs',
    'scripts/smoke-marketplace-runtime.mjs',
    'tests/market-wallet.test.js',
    'tests/marketplace-wallet-filters.test.js',
    'tests/marketplace-wallet-ui.test.js',
    'tests/marketplace-demo-seed.test.js',
    'tests/marketplace-api-reference.test.js',
    'tests/marketplace-snapshot-export.test.js',
    'tests/marketplace-wallet.e2e.js',
    'tests/playwright.config.js',
    'tests/pwa.test.js',
    'tests/health.test.js',
];

for (const file of files) {
    const absolutePath = path.join(rootDirectory, file);

    if (!existsSync(absolutePath)) {
        console.error(`Missing marketplace syntax target: ${file}`);
        process.exit(1);
    }

    const result = spawnSync(process.execPath, ['--check', absolutePath], {
        cwd: rootDirectory,
        encoding: 'utf8',
        stdio: 'pipe',
    });

    if (result.status !== 0) {
        process.stdout.write(result.stdout);
        process.stderr.write(result.stderr);
        process.exit(result.status ?? 1);
    }

    console.log(`syntax ok: ${file}`);
}
