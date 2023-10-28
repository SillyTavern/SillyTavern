/**
 * Scripts to be done before starting the server for the first time.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Creates the default config files if they don't exist yet.
 */
function createDefaultFiles() {
    const files = {
        settings: './public/settings.json',
        bg_load: './public/css/bg_load.css',
        config: './config.conf',
        user: './public/css/user.css',
    };

    for (const file of Object.values(files)) {
        try {
            if (!fs.existsSync(file)) {
                const defaultFilePath = path.join('./default', path.parse(file).base);
                fs.copyFileSync(defaultFilePath, file);
                console.log(`Created default file: ${file}`);
            }
        } catch (error) {
            console.error(`FATAL: Could not write default file: ${file}`, error);
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

try {
    // 1. Create default config files
    createDefaultFiles();
    // 2. Copy transformers WASM binaries from node_modules
    copyWasmFiles();
} catch (error) {
    console.error(error);
}
