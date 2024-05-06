// Plugin manager script.
// Usage: node plugins.js update
// More operations coming soon.
const { default: git } = require('simple-git');
const fs = require('fs');
const path = require('path');
const { color } = require('./src/util');

const pluginsPath = './plugins';

const command = process.argv[2];

if (command === 'update') {
    console.log(color.magenta('Updating all plugins'));
    updatePlugins();
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
