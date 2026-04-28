// Plugin manager script.
// Usage:
// 1. node plugins.js update
// 2. node plugins.js install <plugin-git-url>
// More operations coming soon.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createGitClient, getRepoUpdateState } from './src/git/client.js';
import { color } from './src/util.js';

const __dirname = import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url));
process.chdir(__dirname);
const pluginsPath = './plugins';
const gitBackend = process.env.SILLYTAVERN_GIT_BACKEND || 'auto';
const gitClient = createGitClient({ backend: gitBackend });

const command = process.argv[2];

if (!command) {
    console.log('Usage: node plugins.js <command>');
    console.log('Commands:');
    console.log('  update - Update all installed plugins');
    console.log('  install <plugin-git-url> - Install plugin from a Git URL');
    process.exit(1);
}

if (command === 'update') {
    console.log(color.magenta('Updating all plugins'));
    updatePlugins();
}

if (command === 'install') {
    const pluginName = process.argv[3];
    console.log('Installing a new plugin', color.green(pluginName));
    installPlugin(pluginName);
}

async function updatePlugins() {
    const directories = fs.readdirSync(pluginsPath)
        .filter(file => !file.startsWith('.'))
        .filter(file => fs.statSync(path.join(pluginsPath, file)).isDirectory());

    console.log(`Found ${color.cyan(directories.length)} directories in ./plugins`);

    for (const directory of directories) {
        try {
            console.log(`Updating plugin ${color.green(directory)}...`);
            const pluginPath = path.join(pluginsPath, directory);
            const updateState = await getRepoUpdateState(gitClient, pluginPath);
            if (!updateState.isRepo) {
                console.log(`Directory ${color.yellow(directory)} is not a Git repository`);
                continue;
            }
            if (updateState.isUpToDate) {
                console.log(`Plugin ${color.blue(directory)} is already up to date`);
                continue;
            }

            await gitClient.pull(pluginPath, { remote: updateState.remote, branch: updateState.remoteBranch });
            const latestCommit = await gitClient.resolveRef(pluginPath, 'HEAD');
            console.log(`Plugin ${color.green(directory)} updated to commit ${color.cyan(latestCommit)}`);
        } catch (error) {
            console.error(color.red(`Failed to update plugin ${directory}: ${error.message}`));
        }
    }

    console.log(color.magenta('All plugins updated!'));
}

async function installPlugin(pluginName) {
    try {
        const pluginPath = path.join(pluginsPath, path.basename(pluginName, '.git'));

        if (fs.existsSync(pluginPath)) {
            return console.log(color.yellow(`Directory already exists at ${pluginPath}`));
        }

        await gitClient.clone(pluginName, pluginPath, { depth: 1 });
        console.log(`Plugin ${color.green(pluginName)} installed to ${color.cyan(pluginPath)}`);
    } catch (error) {
        console.error(color.red(`Failed to install plugin ${pluginName}`), error);
    }
}
