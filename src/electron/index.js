import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import yargs from 'yargs';
import { serverEvents, EVENT_NAMES } from '../server-events.js';

const cliArguments = yargs(process.argv)
    .usage('Usage: <your-start-script> [options]')
    .option('width', {
        type: 'number',
        default: 800,
        describe: 'The width of the window',
    })
    .option('height', {
        type: 'number',
        default: 600,
        describe: 'The height of the window',
    })
    .parseSync();

/** @type {string} The URL to load in the window. */
let appUrl;

function createSillyTavernWindow() {
    if (!appUrl) {
        console.error('The server has not started yet.');
        return;
    }
    new BrowserWindow({
        height: cliArguments.height,
        width: cliArguments.width,
    }).loadURL(appUrl);
}

function startServer() {
    return new Promise((_resolve, _reject) => {
        serverEvents.addListener(EVENT_NAMES.SERVER_STARTED, ({ url }) => {
            appUrl = url.toString();
            createSillyTavernWindow();
        });
        const sillyTavernRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
        process.chdir(sillyTavernRoot);

        import('../../server.js');
    });
}

app.whenReady().then(() => {
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createSillyTavernWindow();
        }
    });

    startServer();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
