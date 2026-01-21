/**
 * Scripts to be done before starting the server for the first time.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import yaml from 'yaml';
import chalk from 'chalk';
import { createRequire } from 'node:module';
import { addMissingConfigValues } from './src/config-init.js';

/**
 * Colorizes console output.
 */
const color = chalk;

/**
 * Converts the old config.conf file to the new config.yaml format.
 */
function convertConfig() {
    if (fs.existsSync('./config.conf')) {
        if (fs.existsSync('./config.yaml')) {
            console.log(color.yellow('Both config.conf and config.yaml exist. Please delete config.conf manually.'));
            return;
        }

        try {
            console.log(color.blue('Converting config.conf to config.yaml. Your old config.conf will be renamed to config.conf.bak'));
            fs.renameSync('./config.conf', './config.conf.cjs'); // Force loading as CommonJS
            const require = createRequire(import.meta.url);
            const config = require(path.join(process.cwd(), './config.conf.cjs'));
            fs.copyFileSync('./config.conf.cjs', './config.conf.bak');
            fs.rmSync('./config.conf.cjs');
            fs.writeFileSync('./config.yaml', yaml.stringify(config));
            console.log(color.green('Conversion successful. Please check your config.yaml and fix it if necessary.'));
        } catch (error) {
            console.error(color.red('FATAL: Config conversion failed. Please check your config.conf file and try again.'), error);
            return;
        }
    }
}

/**
 * Creates the default config files if they don't exist yet.
 */
function createDefaultFiles() {
    /**
     * @typedef DefaultItem
     * @type {object}
     * @property {'file' | 'directory'} type - Whether the item should be copied as a single file or merged into a directory structure.
     * @property {string} defaultPath - The path to the default item (typically in `default/`).
     * @property {string} productionPath - The path to the copied item for production use.
     */

    /** @type {DefaultItem[]} */
    const defaultItems = [
        {
            type: 'file',
            defaultPath: './default/config.yaml',
            productionPath: './config.yaml',
        },
        {
            type: 'directory',
            defaultPath: './default/public/',
            productionPath: './public/',
        },
    ];

    for (const defaultItem of defaultItems) {
        try {
            if (defaultItem.type === 'file') {
                if (!fs.existsSync(defaultItem.productionPath)) {
                    fs.copyFileSync(
                        defaultItem.defaultPath,
                        defaultItem.productionPath,
                    );
                    console.log(
                        color.green(`Created default file: ${defaultItem.productionPath}`),
                    );
                }
            } else if (defaultItem.type === 'directory') {
                fs.cpSync(defaultItem.defaultPath, defaultItem.productionPath, {
                    force: false, // Don't overwrite existing files!
                    recursive: true,
                });
                console.log(
                    color.green(`Synchronized missing files: ${defaultItem.productionPath}`),
                );
            } else {
                throw new Error(
                    'FATAL: Unexpected default file format in `post-install.js#createDefaultFiles()`.',
                );
            }
        } catch (error) {
            console.error(
                color.red(
                    `FATAL: Could not write default ${defaultItem.type}: ${defaultItem.productionPath}`,
                ),
                error,
            );
        }
    }
}

try {
    // 0. Convert config.conf to config.yaml
    convertConfig();
    // 1. Create default config files
    createDefaultFiles();
    // 2. Add missing config values
    addMissingConfigValues(path.join(process.cwd(), './config.yaml'));
} catch (error) {
    console.error(error);
}
