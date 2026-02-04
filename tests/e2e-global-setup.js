/**
 * Playwright Global Setup
 *
 * Starts the test server before running E2E tests.
 */
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_PORT = 8001;

async function isServerRunning() {
    try {
        const response = await fetch(`http://127.0.0.1:${TEST_PORT}/`);
        return response.ok || response.status === 200 || response.status === 302;
    } catch {
        return false;
    }
}

async function globalSetup() {
    console.log('\n🚀 Setting up test server...');

    // Check if server is already running
    if (await isServerRunning()) {
        console.log('✅ Test server is already running!\n');
        return;
    }

    // Setup test data first
    const setupScript = path.join(__dirname, 'e2e-test-server.js');

    // Start the server in background
    const serverProcess = spawn('node', [setupScript, 'start'], {
        cwd: __dirname,
        stdio: 'inherit',
        detached: true,
    });

    serverProcess.unref();

    // Wait for server to be ready
    console.log('⏳ Waiting for server to be ready...');
    let ready = false;
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds max

    while (!ready && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;

        ready = await isServerRunning();

        if (attempts % 10 === 0) {
            console.log(`   Still waiting... (${attempts}s)`);
        }
    }

    if (!ready) {
        throw new Error('Test server did not become ready in time');
    }

    console.log('✅ Test server is ready!\n');
}

export default globalSetup;
