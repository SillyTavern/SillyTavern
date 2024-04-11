/**
 * Scripts to be done before starting the server for the first time.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const yaml = require('yaml');
const _ = require('lodash');

/**
 * Colorizes console output.
 */
const color = {
    byNum: (mess, fgNum) => {
        mess = mess || '';
        fgNum = fgNum === undefined ? 31 : fgNum;
        return '\u001b[' + fgNum + 'm' + mess + '\u001b[39m';
    },
    black: (mess) => color.byNum(mess, 30),
    red: (mess) => color.byNum(mess, 31),
    green: (mess) => color.byNum(mess, 32),
    yellow: (mess) => color.byNum(mess, 33),
    blue: (mess) => color.byNum(mess, 34),
    magenta: (mess) => color.byNum(mess, 35),
    cyan: (mess) => color.byNum(mess, 36),
    white: (mess) => color.byNum(mess, 37),
};

/**
 * Gets all keys from an object recursively.
 * @param {object} obj Object to get all keys from
 * @param {string} prefix Prefix to prepend to all keys
 * @returns {string[]} Array of all keys in the object
 */
function getAllKeys(obj, prefix = '') {
    if (typeof obj !== 'object' || Array.isArray(obj)) {
        return [];
    }

    return _.flatMap(Object.keys(obj), key => {
        const newPrefix = prefix ? `${prefix}.${key}` : key;
        if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
            return getAllKeys(obj[key], newPrefix);
        } else {
            return [newPrefix];
        }
    });
}

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
            const config = require(path.join(process.cwd(), './config.conf'));
            fs.renameSync('./config.conf', './config.conf.bak');
            fs.writeFileSync('./config.yaml', yaml.stringify(config));
            console.log(color.green('Conversion successful. Please check your config.yaml and fix it if necessary.'));
        } catch (error) {
            console.error(color.red('FATAL: Config conversion failed. Please check your config.conf file and try again.'));
            return;
        }
    }
}

/**
 * Compares the current config.yaml with the default config.yaml and adds any missing values.
 */
function addMissingConfigValues() {
    try  {
        const defaultConfig = yaml.parse(fs.readFileSync(path.join(process.cwd(), './default/config.yaml'), 'utf8'));
        let config = yaml.parse(fs.readFileSync(path.join(process.cwd(), './config.yaml'), 'utf8'));

        // Get all keys from the original config
        const originalKeys = getAllKeys(config);

        // Use lodash's defaultsDeep function to recursively apply default properties
        config = _.defaultsDeep(config, defaultConfig);

        // Get all keys from the updated config
        const updatedKeys = getAllKeys(config);

        // Find the keys that were added
        const addedKeys = _.difference(updatedKeys, originalKeys);

        if (addedKeys.length === 0) {
            return;
        }

        console.log('Adding missing config values to config.yaml:', addedKeys);
        fs.writeFileSync('./config.yaml', yaml.stringify(config));
    } catch (error) {
        console.error(color.red('FATAL: Could not add missing config values to config.yaml'), error);
    }
}

/**
 * Creates the default config files if they don't exist yet.
 */
function createDefaultFiles() {
    const files = {
        settings: './public/settings.json',
        config: './config.yaml',
        user: './public/css/user.css',
    };

    for (const file of Object.values(files)) {
        try {
            if (!fs.existsSync(file)) {
                const defaultFilePath = path.join('./default', path.parse(file).base);
                fs.copyFileSync(defaultFilePath, file);
                console.log(color.green(`Created default file: ${file}`));
            }
        } catch (error) {
            console.error(color.red(`FATAL: Could not write default file: ${file}`), error);
        }
    }
}

/**
 * Returns the MD5 hash of the given data.
 * @param {Buffer} data Input data
 * @returns {string} MD5 hash of the input data
 */
function getMd5Hash(data) {
    return crypto
        .createHash('md5')
        .update(data)
        .digest('hex');
}

/**
 * Copies the WASM binaries from the sillytavern-transformers package to the dist folder.
 */
function copyWasmFiles() {
    if (!fs.existsSync('./dist')) {
        fs.mkdirSync('./dist');
    }

    const listDir = fs.readdirSync('./node_modules/sillytavern-transformers/dist');

    for (const file of listDir) {
        if (file.endsWith('.wasm')) {
            const sourcePath = `./node_modules/sillytavern-transformers/dist/${file}`;
            const targetPath = `./dist/${file}`;

            // Don't copy if the file already exists and is the same checksum
            if (fs.existsSync(targetPath)) {
                const sourceChecksum = getMd5Hash(fs.readFileSync(sourcePath));
                const targetChecksum = getMd5Hash(fs.readFileSync(targetPath));

                if (sourceChecksum === targetChecksum) {
                    continue;
                }
            }

            fs.copyFileSync(sourcePath, targetPath);
            console.log(`${file} successfully copied to ./dist/${file}`);
        }
    }
}

/**
 * Moves the custom background into settings.json.
 */
function migrateBackground() {
    if (!fs.existsSync('./public/css/bg_load.css')) return;

    const bgCSS = fs.readFileSync('./public/css/bg_load.css', 'utf-8');
    const bgMatch = /url\('([^']*)'\)/.exec(bgCSS);
    if (!bgMatch) return;
    const bgFilename = bgMatch[1].replace('../backgrounds/', '');

    const settings = fs.readFileSync('./public/settings.json', 'utf-8');
    const settingsJSON = JSON.parse(settings);
    if (Object.hasOwn(settingsJSON, 'background')) {
        console.log(color.yellow('Both bg_load.css and the "background" setting exist. Please delete bg_load.css manually.'));
        return;
    }

    settingsJSON.background = { name: bgFilename, url: `url('backgrounds/${bgFilename}')` };
    fs.writeFileSync('./public/settings.json', JSON.stringify(settingsJSON, null, 4));
    fs.rmSync('./public/css/bg_load.css');
}

try {
    // 0. Convert config.conf to config.yaml
    convertConfig();
    // 1. Create default config files
    createDefaultFiles();
    // 2. Copy transformers WASM binaries from node_modules
    copyWasmFiles();
    // 3. Add missing config values
    addMissingConfigValues();
    // 4. Migrate bg_load.css to settings.json
    migrateBackground();
} catch (error) {
    console.error(error);
}
