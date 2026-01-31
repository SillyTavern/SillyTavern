/**
 * Playwright Global Teardown
 *
 * Stops the test server after E2E tests complete.
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function globalTeardown() {
    console.log('\n🛑 Stopping test server...');

    const stopProcess = spawn('node', ['e2e-test-server.js', 'stop'], {
        cwd: __dirname,
        stdio: 'inherit',
    });

    await new Promise((resolve) => {
        stopProcess.on('close', resolve);
    });

    console.log('✅ Test server stopped.\n');
}

export default globalTeardown;
