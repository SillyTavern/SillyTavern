const path = require('path');
const fs = require('fs');
const sanitize = require('sanitize-filename');
const fetch = require('node-fetch').default;
const { finished } = require('stream/promises');
const { DIRECTORIES, UNSAFE_EXTENSIONS } = require('./constants');

const VALID_CATEGORIES = ["bgm", "ambient", "blip", "live2d"];

/**
 * Sanitizes the input filename for theasset.
 * @param {string} inputFilename Input filename
 * @returns {string} Normalized or empty path if invalid
 */
function checkAssetFileName(inputFilename) {
    // Sanitize filename
    if (inputFilename.indexOf('\0') !== -1) {
        console.debug("Bad request: poisong null bytes in filename.");
        return '';
    }

    if (!/^[a-zA-Z0-9_\-\.]+$/.test(inputFilename)) {
        console.debug("Bad request: illegal character in filename, only alphanumeric, '_', '-' are accepted.");
        return '';
    }

    if (UNSAFE_EXTENSIONS.some(ext => inputFilename.toLowerCase().endsWith(ext))) {
        console.debug("Bad request: forbidden file extension.");
        return '';
    }

    if (inputFilename.startsWith('.')) {
        console.debug("Bad request: filename cannot start with '.'");
        return '';
    }

    return path.normalize(inputFilename).replace(/^(\.\.(\/|\\|$))+/, '');;
}

// Recursive function to get files
function getFiles(dir, files = []) {
    // Get an array of all files and directories in the passed directory using fs.readdirSync
    const fileList = fs.readdirSync(dir);
    // Create the full path of the file/directory by concatenating the passed directory and file/directory name
    for (const file of fileList) {
        const name = `${dir}/${file}`;
        // Check if the current file/directory is a directory using fs.statSync
        if (fs.statSync(name).isDirectory()) {
            // If it is a directory, recursively call the getFiles function with the directory path and the files array
            getFiles(name, files);
        } else {
            // If it is a file, push the full path to the files array
            files.push(name);
        }
    }
    return files;
}

/**
 * Registers the endpoints for the asset management.
 * @param {import('express').Express} app Express app
 * @param {any} jsonParser JSON parser middleware
 */
function registerEndpoints(app, jsonParser) {
    /**
     * HTTP POST handler function to retrieve name of all files of a given folder path.
     *
     * @param {Object} request - HTTP Request object. Require folder path in query
     * @param {Object} response - HTTP Response object will contain a list of file path.
     *
     * @returns {void}
     */
    app.post('/api/assets/get', jsonParser, async (_, response) => {
        const folderPath = path.join(DIRECTORIES.assets);
        let output = {}
        //console.info("Checking files into",folderPath);

        try {
            if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
                const folders = fs.readdirSync(folderPath)
                    .filter(filename => {
                        return fs.statSync(path.join(folderPath, filename)).isDirectory();
                    });

                for (const folder of folders) {
                    if (folder == "temp")
                        continue;

                    // Live2d assets
                    if (folder == "live2d") {
                        output[folder] = [];
                        const live2d_folder = path.normalize(path.join(folderPath, folder));
                        const files = getFiles(live2d_folder);
                        //console.debug("FILE FOUND:",files)
                        for (let file of files) {
                            file = path.normalize(file.replace('public' + path.sep, ''));
                            if (file.endsWith("model3.json")) {
                                //console.debug("Asset live2d model found:",file)
                                output[folder].push(path.normalize(path.join(file)));
                            }
                        }
                        continue;
                    }

                    // Other assets (bgm/ambient/blip)
                    const files = fs.readdirSync(path.join(folderPath, folder))
                        .filter(filename => {
                            return filename != ".placeholder";
                        });
                    output[folder] = [];
                    for (const file of files) {
                        output[folder].push(path.join("assets", folder, file));
                    }
                }
            }
        }
        catch (err) {
            console.log(err);
        }
        finally {
            return response.send(output);
        }
    });

    /**
     * HTTP POST handler function to download the requested asset.
     *
     * @param {Object} request - HTTP Request object, expects a url, a category and a filename.
     * @param {Object} response - HTTP Response only gives status.
     *
     * @returns {void}
     */
    app.post('/api/assets/download', jsonParser, async (request, response) => {
        const url = request.body.url;
        const inputCategory = request.body.category;
        const inputFilename = sanitize(request.body.filename);

        // Check category
        let category = null;
        for (let i of VALID_CATEGORIES)
            if (i == inputCategory)
                category = i;

        if (category === null) {
            console.debug("Bad request: unsuported asset category.");
            return response.sendStatus(400);
        }

        // Sanitize filename
        const safe_input = checkAssetFileName(inputFilename);
        if (safe_input == '')
            return response.sendStatus(400);

        const temp_path = path.join(DIRECTORIES.assets, "temp", safe_input)
        const file_path = path.join(DIRECTORIES.assets, category, safe_input)
        console.debug("Request received to download", url, "to", file_path);

        try {
            // Download to temp
            const res = await fetch(url);
            if (!res.ok || res.body === null) {
                throw new Error(`Unexpected response ${res.statusText}`);
            }
            const destination = path.resolve(temp_path);
            // Delete if previous download failed
            if (fs.existsSync(temp_path)) {
                fs.unlink(temp_path, (err) => {
                    if (err) throw err;
                });
            }
            const fileStream = fs.createWriteStream(destination, { flags: 'wx' });
            await finished(res.body.pipe(fileStream));

            // Move into asset place
            console.debug("Download finished, moving file from", temp_path, "to", file_path);
            fs.renameSync(temp_path, file_path);
            response.sendStatus(200);
        }
        catch (error) {
            console.log(error);
            response.sendStatus(500);
        }
    });

    /**
     * HTTP POST handler function to delete the requested asset.
     *
     * @param {Object} request - HTTP Request object, expects a category and a filename
     * @param {Object} response - HTTP Response only gives stats.
     *
     * @returns {void}
     */
    app.post('/api/assets/delete', jsonParser, async (request, response) => {
        const inputCategory = request.body.category;
        const inputFilename = sanitize(request.body.filename);

        // Check category
        let category = null;
        for (let i of VALID_CATEGORIES)
            if (i == inputCategory)
                category = i;

        if (category === null) {
            console.debug("Bad request: unsuported asset category.");
            return response.sendStatus(400);
        }

        // Sanitize filename
        const safe_input = checkAssetFileName(inputFilename);
        if (safe_input == '')
            return response.sendStatus(400);

        const file_path = path.join(DIRECTORIES.assets, category, safe_input)
        console.debug("Request received to delete", category, file_path);

        try {
            // Delete if previous download failed
            if (fs.existsSync(file_path)) {
                fs.unlink(file_path, (err) => {
                    if (err) throw err;
                });
                console.debug("Asset deleted.");
            }
            else {
                console.debug("Asset not found.");
                response.sendStatus(400);
            }
            // Move into asset place
            response.sendStatus(200);
        }
        catch (error) {
            console.log(error);
            response.sendStatus(500);
        }
    });

    ///////////////////////////////
    /**
     * HTTP POST handler function to retrieve a character background music list.
     *
     * @param {Object} request - HTTP Request object, expects a character name in the query.
     * @param {Object} response - HTTP Response object will contain a list of audio file path.
     *
     * @returns {void}
     */
    app.post('/api/assets/character', jsonParser, async (request, response) => {
        if (request.query.name === undefined) return response.sendStatus(400);
        const name = sanitize(request.query.name.toString());
        const inputCategory = request.query.category;

        // Check category
        let category = null
        for (let i of VALID_CATEGORIES)
            if (i == inputCategory)
                category = i

        if (category === null) {
            console.debug("Bad request: unsuported asset category.");
            return response.sendStatus(400);
        }

        const folderPath = path.join(DIRECTORIES.characters, name, category);

        let output = [];
        try {
            if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {

                // Live2d assets
                if (category == "live2d") {
                    const folders = fs.readdirSync(folderPath)
                    for (let modelFolder of folders) {
                        const live2dModelPath = path.join(folderPath, modelFolder);
                        if (fs.statSync(live2dModelPath).isDirectory()) {
                            for (let file of fs.readdirSync(live2dModelPath)) {
                                //console.debug("Character live2d model found:", file)
                                if (file.includes("model"))
                                    output.push(path.join("characters", name, category, modelFolder, file));
                            }
                        }
                    }
                    return response.send(output);
                }

                // Other assets
                const files = fs.readdirSync(folderPath)
                    .filter(filename => {
                        return filename != ".placeholder";
                    });

                for (let i of files)
                    output.push(`/characters/${name}/${category}/${i}`);
            }
            return response.send(output);
        }
        catch (err) {
            console.log(err);
            return response.sendStatus(500);
        }
    });
}

module.exports = {
    registerEndpoints,
}
