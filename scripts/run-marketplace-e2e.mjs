import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const startupTimeoutMs = Number(process.env.MARKETPLACE_E2E_TIMEOUT_MS ?? 90_000);
const requestTimeoutMs = Number(process.env.MARKETPLACE_E2E_REQUEST_TIMEOUT_MS ?? 5_000);

function appendLog(buffer, chunk) {
    const maxLength = 20_000;
    const next = buffer + chunk.toString();
    return next.length > maxLength ? next.slice(next.length - maxLength) : next;
}

async function findFreePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            const port = typeof address === 'object' && address ? address.port : null;

            server.close(() => {
                if (!port) {
                    reject(new Error('Could not allocate a marketplace E2E port'));
                    return;
                }

                resolve(port);
            });
        });
    });
}

function waitForExit(child, timeoutMs) {
    if (child.exitCode !== null || child.signalCode !== null) {
        return Promise.resolve(true);
    }

    return new Promise(resolve => {
        const timeout = setTimeout(() => {
            cleanup();
            resolve(false);
        }, timeoutMs);

        const onExit = () => {
            cleanup();
            resolve(true);
        };

        function cleanup() {
            clearTimeout(timeout);
            child.off('exit', onExit);
        }

        child.once('exit', onExit);
    });
}

async function stopServer(child) {
    if (child.exitCode !== null || child.signalCode !== null) {
        return;
    }

    child.kill('SIGTERM');

    if (!(await waitForExit(child, 5_000))) {
        child.kill('SIGKILL');
        await waitForExit(child, 5_000);
    }
}

async function fetchWithTimeout(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
        const response = await fetch(url, { signal: controller.signal });
        const body = await response.text();
        return { response, body };
    } finally {
        clearTimeout(timeout);
    }
}

async function waitForHealth(baseUrl, child, getLogs) {
    const deadline = Date.now() + startupTimeoutMs;
    let lastError;

    while (Date.now() < deadline) {
        if (child.exitCode !== null || child.signalCode !== null) {
            throw new Error(`SillyTavern exited before E2E server became healthy.\n${getLogs()}`);
        }

        try {
            const { response, body } = await fetchWithTimeout(`${baseUrl}/api/health`);
            if (response.ok) {
                const health = JSON.parse(body);
                if (health.ok === true && health.status === 'ok') {
                    return;
                }
            }
            lastError = new Error(`GET /api/health returned ${response.status}: ${body.slice(0, 500)}`);
        } catch (error) {
            lastError = error;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error(`Timed out waiting for E2E server health. Last error: ${lastError?.message ?? 'unknown'}\n${getLogs()}`);
}

function runPlaywright(baseUrl, extraArgs) {
    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    return new Promise((resolve, reject) => {
        const child = spawn(npmCommand, [
            '--prefix',
            'tests',
            'run',
            'test:e2e',
            '--',
            'marketplace-wallet.e2e.js',
            ...extraArgs,
        ], {
            cwd: rootDirectory,
            env: {
                ...process.env,
                PLAYWRIGHT_BASE_URL: baseUrl,
            },
            stdio: 'inherit',
        });

        child.once('error', reject);
        child.once('exit', code => resolve(code ?? 1));
    });
}

async function run() {
    const port = await findFreePort();
    const tmpRoot = await mkdtemp(path.join(os.tmpdir(), 'sillytavern-marketplace-e2e-'));
    const configPath = path.join(tmpRoot, 'config.yaml');
    const dataRoot = path.join(tmpRoot, 'data');
    const baseUrl = `http://127.0.0.1:${port}`;
    const extraArgs = process.argv.slice(2);

    let stdout = '';
    let stderr = '';
    let server;

    const getLogs = () => [
        '--- stdout ---',
        stdout.trim(),
        '--- stderr ---',
        stderr.trim(),
    ].join('\n');

    try {
        server = spawn(process.execPath, [
            'server.js',
            `--port=${port}`,
            '--listen=false',
            '--enableIPv4=true',
            '--enableIPv6=false',
            '--browserLaunchEnabled=false',
            '--ssl=false',
            '--heartbeatInterval=0',
            '--whitelist=false',
            '--basicAuthMode=false',
            '--disableCsrf',
            `--configPath=${configPath}`,
            `--dataRoot=${dataRoot}`,
        ], {
            cwd: rootDirectory,
            env: {
                ...process.env,
                NODE_ENV: process.env.NODE_ENV ?? 'test',
            },
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        server.stdout.on('data', chunk => {
            stdout = appendLog(stdout, chunk);
        });
        server.stderr.on('data', chunk => {
            stderr = appendLog(stderr, chunk);
        });

        await waitForHealth(baseUrl, server, getLogs);
        console.log(`marketplace e2e server ok: ${baseUrl}`);

        const exitCode = await runPlaywright(baseUrl, extraArgs);
        if (exitCode !== 0) {
            console.error(getLogs());
            process.exit(exitCode);
        }
    } finally {
        if (server) {
            await stopServer(server);
        }
        await rm(tmpRoot, { recursive: true, force: true });
    }
}

run().catch(error => {
    console.error(error);
    process.exit(1);
});
