import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import yargs from 'yargs';

const cliArguments = yargs(process.argv)
    .usage('Usage: <your-start-script> [options]')
    .option('width', {
        type: 'number',
        default: 800,
        describe: 'The width of the window',
    }).option('height', {
        type: 'number',
        default: 600,
        describe: 'The height of the window',
    }).parseSync();

function createSillyTavernWindow(autorunUrl) {
    const url = autorunUrl.toString();

    new BrowserWindow({
        height: cliArguments.height,
        width: cliArguments.width,
    }).loadURL(url);
}

function startServer() {
    return new Promise((_resolve, _reject) => {
        const sillyTavernRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
        process.chdir(sillyTavernRoot);

        import('../server.js')
            .then((sillyTavern) => {
                sillyTavern.serverStatusEvent.addListener('serverStarted', createSillyTavernWindow);
            });
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
