// Plugin manager script.
// Usage:
// 1. node plugins.js update
// 2. node plugins.js install <plugin-git-url>
// More operations coming soon.
const { default: git } = require('simple-git');
const fs = require('fs');
const path = require('path');
const { color } = require('./src/util');

process.chdir(__dirname);
const pluginsPath = './plugins';

const command = process.argv[2];

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
            const pluginRepo = git(pluginPath);
            await pluginRepo.fetch();
            const commitHash = await pluginRepo.revparse(['HEAD']);
            const trackingBranch = await pluginRepo.revparse(['--abbrev-ref', '@{u}']);
            const log = await pluginRepo.log({
                from: commitHash,
                to: trackingBranch,
            });

            if (log.total === 0) {
                console.log(`Plugin ${color.blue(directory)} is already up to date`);
                continue;
            }

            await pluginRepo.pull();
            const latestCommit = await pluginRepo.revparse(['HEAD']);
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

        await git().clone(pluginName, pluginPath, { '--depth': 1 });
        console.log(`Plugin ${color.green(pluginName)} installed to ${color.cyan(pluginPath)}`);
    }
    catch (error) {
        console.error(color.red(`Failed to install plugin ${pluginName}`), error);
    }
}
