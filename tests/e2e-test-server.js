/**
 * E2E Test Server Manager
 *
 * Starts a fresh SillyTavern instance with isolated test data for E2E testing.
 * Usage:
 *   node e2e-test-server.js start   - Start the test server
 *   node e2e-test-server.js stop    - Stop the test server
 *   node e2e-test-server.js status  - Check if server is running
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const TEST_DATA_DIR = path.join(__dirname, '.test-data');
const TEST_PORT = 8001;
const PID_FILE = path.join(__dirname, '.test-server.pid');

/**
 * Creates minimal test data directory with required structure
 */
function setupTestData() {
    // Create directories
    const dirs = [
        TEST_DATA_DIR,
        path.join(TEST_DATA_DIR, 'default-user'),
        path.join(TEST_DATA_DIR, 'default-user', 'worlds'),
        path.join(TEST_DATA_DIR, 'default-user', 'characters'),
        path.join(TEST_DATA_DIR, 'default-user', 'chats'),
        path.join(TEST_DATA_DIR, 'default-user', 'groups'),
        path.join(TEST_DATA_DIR, 'default-user', 'User Avatars'),
        path.join(TEST_DATA_DIR, 'default-user', 'backgrounds'),
        path.join(TEST_DATA_DIR, 'default-user', 'themes'),
        path.join(TEST_DATA_DIR, 'default-user', 'OpenAI Settings'),
        path.join(TEST_DATA_DIR, 'default-user', 'TextGen Settings'),
        path.join(TEST_DATA_DIR, 'default-user', 'KoboldAI Settings'),
        path.join(TEST_DATA_DIR, 'default-user', 'NovelAI Settings'),
    ];

    for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    // Create minimal settings file
    const settingsPath = path.join(TEST_DATA_DIR, 'default-user', 'settings.json');
    if (!fs.existsSync(settingsPath)) {
        const defaultSettings = {
            'username': 'TestUser',
            'dark_mode': true,
            'api_server': 'http://localhost:5000',
            'preset_settings': 'Default',
            'world_info_depth': 4,
            'world_info_budget': 25,
            'world_info_recursive': true,
        };
        fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2));
    }

    // Create a test lorebook for World Info tests
    const testLorebookPath = path.join(TEST_DATA_DIR, 'default-user', 'worlds', 'Test Lorebook.json');
    if (!fs.existsSync(testLorebookPath)) {
        const testLorebook = {
            'entries': {
                '0': {
                    'uid': 0,
                    'key': ['Alice', 'alice'],
                    'keysecondary': [],
                    'comment': 'Alice Character',
                    'content': 'Alice is a curious adventurer who loves exploring ancient ruins.',
                    'constant': false,
                    'selective': true,
                    'selectiveLogic': 0,
                    'order': 100,
                    'position': 0,
                    'disable': false,
                    'excludeRecursion': false,
                    'preventRecursion': false,
                    'delayUntilRecursion': false,
                    'probability': 100,
                    'depth': 4,
                },
                '1': {
                    'uid': 1,
                    'key': ['Bob', 'bob'],
                    'keysecondary': [],
                    'comment': 'Bob Character',
                    'content': 'Bob is a skilled blacksmith who crafts legendary weapons.',
                    'constant': false,
                    'selective': true,
                    'selectiveLogic': 0,
                    'order': 100,
                    'position': 0,
                    'disable': false,
                    'excludeRecursion': false,
                    'preventRecursion': false,
                    'delayUntilRecursion': false,
                    'probability': 100,
                    'depth': 4,
                },
                '2': {
                    'uid': 2,
                    'key': ['Castle', 'castle', 'fortress'],
                    'keysecondary': ['ancient'],
                    'comment': 'The Castle',
                    'content': 'The ancient castle stands atop the mountain, its towers reaching into the clouds.',
                    'constant': false,
                    'selective': true,
                    'selectiveLogic': 0,
                    'order': 50,
                    'position': 0,
                    'disable': false,
                    'excludeRecursion': false,
                    'preventRecursion': false,
                    'delayUntilRecursion': false,
                    'probability': 100,
                    'depth': 4,
                },
            },
        };
        fs.writeFileSync(testLorebookPath, JSON.stringify(testLorebook, null, 2));
    }

    // Create config.yaml for the test instance
    const configPath = path.join(TEST_DATA_DIR, 'config.yaml');
    if (!fs.existsSync(configPath)) {
        const config = `# Test Configuration
listen: false
port: ${TEST_PORT}
whitelistMode: false
basicAuthMode: false
enableUserAccounts: false
securityOverride: true
autorun: false
disableThumbnails: true
`;
        fs.writeFileSync(configPath, config);
    }

    console.log(`Test data directory set up at: ${TEST_DATA_DIR}`);
}

/**
 * Starts the test server
 */
async function startServer() {
    if (isServerRunning()) {
        console.log('Test server is already running');
        return;
    }

    setupTestData();

    console.log(`Starting test server on port ${TEST_PORT}...`);

    const serverProcess = spawn('node', [
        'server.js',
        '--port', String(TEST_PORT),
        '--dataRoot', TEST_DATA_DIR,
        '--browserLaunchEnabled', 'false',
    ], {
        cwd: PROJECT_ROOT,
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true,
    });

    // Save PID
    fs.writeFileSync(PID_FILE, String(serverProcess.pid));

    // Wait for server to be ready
    let ready = false;
    let attempts = 0;
    const maxAttempts = 30;

    serverProcess.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('listening on') || output.includes('SillyTavern is ready')) {
            ready = true;
        }
        if (process.env.DEBUG) {
            console.log('[server]', output.trim());
        }
    });

    serverProcess.stderr.on('data', (data) => {
        if (process.env.DEBUG) {
            console.error('[server error]', data.toString().trim());
        }
    });

    // Poll for server readiness
    while (!ready && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;

        try {
            const response = await fetch(`http://127.0.0.1:${TEST_PORT}/`);
            if (response.ok) {
                ready = true;
            }
        } catch (e) {
            // Server not ready yet
        }
    }

    if (ready) {
        console.log(`Test server started successfully on http://127.0.0.1:${TEST_PORT}`);
        serverProcess.unref();
    } else {
        console.error('Failed to start test server within timeout');
        stopServer();
        process.exit(1);
    }
}

/**
 * Stops the test server
 */
function stopServer() {
    if (!fs.existsSync(PID_FILE)) {
        console.log('No test server PID file found');
        return;
    }

    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim());

    try {
        process.kill(pid, 'SIGTERM');
        console.log(`Stopped test server (PID: ${pid})`);
    } catch (e) {
        if (e.code === 'ESRCH') {
            console.log('Test server was not running');
        } else {
            console.error('Error stopping server:', e.message);
        }
    }

    fs.unlinkSync(PID_FILE);
}

/**
 * Checks if server is running
 */
function isServerRunning() {
    if (!fs.existsSync(PID_FILE)) {
        return false;
    }

    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim());

    try {
        process.kill(pid, 0);
        return true;
    } catch (e) {
        // Process not running, clean up stale PID file
        fs.unlinkSync(PID_FILE);
        return false;
    }
}

/**
 * Cleans up test data
 */
function cleanup() {
    stopServer();

    if (fs.existsSync(TEST_DATA_DIR)) {
        fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
        console.log('Cleaned up test data directory');
    }
}

// CLI
const command = process.argv[2];

switch (command) {
    case 'start':
        await startServer();
        break;
    case 'stop':
        stopServer();
        break;
    case 'status':
        console.log(isServerRunning() ? 'Test server is running' : 'Test server is not running');
        break;
    case 'cleanup':
        cleanup();
        break;
    default:
        console.log('Usage: node e2e-test-server.js [start|stop|status|cleanup]');
        break;
}
