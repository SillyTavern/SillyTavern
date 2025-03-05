import { app, BrowserWindow } from 'electron';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import yargs from 'yargs';

const cliArguments = yargs(process.argv)
    .usage('Usage: <your-start-script> [options]')
    .option('url', {
        type: 'string',
        default: 'http://127.0.0.1:8000',
        describe: 'The URL to connect to',
    }).option('width', {
        type: 'number',
        default: 800,
        describe: 'The width of the window',
    }).option('height', {
        type: 'number',
        default: 600,
        describe: 'The height of the window',
    }).parseSync();

const url = cliArguments.url;

function createSillyTavernWindow() {
    new BrowserWindow({
        height: cliArguments.height,
        width: cliArguments.width,
    }).loadURL(url);
}

/**
 * Checks server availability. Rejects if server does not respond
 * @param {string} serverUrl
 */
function checkAvailability(serverUrl) {
    return new Promise((resolve, reject) => {
        const req = http.get(serverUrl, res => (res.statusCode === 200 ? resolve(true) : reject(new Error('Server not found'))));
        req.on('error', reject);
        req.setTimeout(5000, () => reject(new Error('Timeout waiting for server to start')));
    });
}

function startServer() {
    return new Promise((_resolve, _reject) => {
        const sillyTavernRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
        process.chdir(sillyTavernRoot);

        import('../server.js');
    });
}

async function pollServerAvailability() {
    checkAvailability(url)
        .then(createSillyTavernWindow, () => setTimeout(pollServerAvailability, 1000));
}

app.whenReady().then(() => {
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createSillyTavernWindow();
        }
    });

    startServer();
    pollServerAvailability();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
