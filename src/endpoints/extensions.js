const path = require('path');
const fs = require('fs');
const express = require('express');
const { default: simpleGit } = require('simple-git');
const sanitize = require('sanitize-filename');
const { PUBLIC_DIRECTORIES } = require('../constants');
const { jsonParser } = require('../express-common');

/**
 * This function extracts the extension information from the manifest file.
 * @param {string} extensionPath - The path of the extension folder
 * @returns {Promise<Object>} - Returns the manifest data as an object
 */
async function getManifest(extensionPath) {
    const manifestPath = path.join(extensionPath, 'manifest.json');

    // Check if manifest.json exists
    if (!fs.existsSync(manifestPath)) {
        throw new Error(`Manifest file not found at ${manifestPath}`);
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return manifest;
}

/**
 * This function checks if the local repository is up-to-date with the remote repository.
 * @param {string} extensionPath - The path of the extension folder
 * @returns {Promise<Object>} - Returns the extension information as an object
 */
async function checkIfRepoIsUpToDate(extensionPath) {
    const git = simpleGit();
    await git.cwd(extensionPath).fetch('origin');
    const currentBranch = await git.cwd(extensionPath).branch();
    const currentCommitHash = await git.cwd(extensionPath).revparse(['HEAD']);
    const log = await git.cwd(extensionPath).log({
        from: currentCommitHash,
        to: `origin/${currentBranch.current}`,
    });

    // Fetch remote repository information
    const remotes = await git.cwd(extensionPath).getRemotes(true);

    return {
        isUpToDate: log.total === 0,
        remoteUrl: remotes[0].refs.fetch, // URL of the remote repository
    };
}

const router = express.Router();

/**
 * HTTP POST handler function to clone a git repository from a provided URL, read the extension manifest,
 * and return extension information and path.
 *
 * @param {Object} request - HTTP Request object, expects a JSON body with a 'url' property.
 * @param {Object} response - HTTP Response object used to respond to the HTTP request.
 *
 * @returns {void}
 */
router.post('/install', jsonParser, async (request, response) => {
    if (!request.body.url) {
        return response.status(400).send('Bad Request: URL is required in the request body.');
    }

    try {
        const git = simpleGit();

        // make sure the third-party directory exists
        if (!fs.existsSync(path.join(request.user.directories.extensions))) {
            fs.mkdirSync(path.join(request.user.directories.extensions));
        }

        const url = request.body.url;
        const extensionPath = path.join(request.user.directories.extensions, path.basename(url, '.git'));

        if (fs.existsSync(extensionPath)) {
            return response.status(409).send(`Directory already exists at ${extensionPath}`);
        }

        await git.clone(url, extensionPath, { '--depth': 1 });
        console.log(`Extension has been cloned at ${extensionPath}`);


        const { version, author, display_name } = await getManifest(extensionPath);


        return response.send({ version, author, display_name, extensionPath });
    } catch (error) {
        console.log('Importing custom content failed', error);
        return response.status(500).send(`Server Error: ${error.message}`);
    }
});

/**
 * HTTP POST handler function to pull the latest updates from a git repository
 * based on the extension name provided in the request body. It returns the latest commit hash,
 * the path of the extension, the status of the repository (whether it's up-to-date or not),
 * and the remote URL of the repository.
 *
 * @param {Object} request - HTTP Request object, expects a JSON body with an 'extensionName' property.
 * @param {Object} response - HTTP Response object used to respond to the HTTP request.
 *
 * @returns {void}
 */
router.post('/update', jsonParser, async (request, response) => {
    const git = simpleGit();
    if (!request.body.extensionName) {
        return response.status(400).send('Bad Request: extensionName is required in the request body.');
    }

    try {
        const extensionName = request.body.extensionName;
        const extensionPath = path.join(request.user.directories.extensions, extensionName);

        if (!fs.existsSync(extensionPath)) {
            return response.status(404).send(`Directory does not exist at ${extensionPath}`);
        }

        const { isUpToDate, remoteUrl } = await checkIfRepoIsUpToDate(extensionPath);
        const currentBranch = await git.cwd(extensionPath).branch();
        if (!isUpToDate) {

            await git.cwd(extensionPath).pull('origin', currentBranch.current);
            console.log(`Extension has been updated at ${extensionPath}`);
        } else {
            console.log(`Extension is up to date at ${extensionPath}`);
        }
        await git.cwd(extensionPath).fetch('origin');
        const fullCommitHash = await git.cwd(extensionPath).revparse(['HEAD']);
        const shortCommitHash = fullCommitHash.slice(0, 7);

        return response.send({ shortCommitHash, extensionPath, isUpToDate, remoteUrl });

    } catch (error) {
        console.log('Updating custom content failed', error);
        return response.status(500).send(`Server Error: ${error.message}`);
    }
});

/**
 * HTTP POST handler function to get the current git commit hash and branch name for a given extension.
 * It checks whether the repository is up-to-date with the remote, and returns the status along with
 * the remote URL of the repository.
 *
 * @param {Object} request - HTTP Request object, expects a JSON body with an 'extensionName' property.
 * @param {Object} response - HTTP Response object used to respond to the HTTP request.
 *
 * @returns {void}
 */
router.post('/version', jsonParser, async (request, response) => {
    const git = simpleGit();
    if (!request.body.extensionName) {
        return response.status(400).send('Bad Request: extensionName is required in the request body.');
    }

    try {
        const extensionName = request.body.extensionName;
        const extensionPath = path.join(request.user.directories.extensions, extensionName);

        if (!fs.existsSync(extensionPath)) {
            return response.status(404).send(`Directory does not exist at ${extensionPath}`);
        }

        const currentBranch = await git.cwd(extensionPath).branch();
        // get only the working branch
        const currentBranchName = currentBranch.current;
        await git.cwd(extensionPath).fetch('origin');
        const currentCommitHash = await git.cwd(extensionPath).revparse(['HEAD']);
        console.log(currentBranch, currentCommitHash);
        const { isUpToDate, remoteUrl } = await checkIfRepoIsUpToDate(extensionPath);

        return response.send({ currentBranchName, currentCommitHash, isUpToDate, remoteUrl });

    } catch (error) {
        console.log('Getting extension version failed', error);
        return response.status(500).send(`Server Error: ${error.message}`);
    }
});

/**
 * HTTP POST handler function to delete a git repository based on the extension name provided in the request body.
 *
 * @param {Object} request - HTTP Request object, expects a JSON body with a 'url' property.
 * @param {Object} response - HTTP Response object used to respond to the HTTP request.
 *
 * @returns {void}
 */
router.post('/delete', jsonParser, async (request, response) => {
    if (!request.body.extensionName) {
        return response.status(400).send('Bad Request: extensionName is required in the request body.');
    }

    // Sanitize the extension name to prevent directory traversal
    const extensionName = sanitize(request.body.extensionName);

    try {
        const extensionPath = path.join(request.user.directories.extensions, extensionName);

        if (!fs.existsSync(extensionPath)) {
            return response.status(404).send(`Directory does not exist at ${extensionPath}`);
        }

        await fs.promises.rm(extensionPath, { recursive: true });
        console.log(`Extension has been deleted at ${extensionPath}`);

        return response.send(`Extension has been deleted at ${extensionPath}`);

    } catch (error) {
        console.log('Deleting custom content failed', error);
        return response.status(500).send(`Server Error: ${error.message}`);
    }
});

/**
 * Discover the extension folders
 * If the folder is called third-party, search for subfolders instead
 */
router.get('/discover', jsonParser, function (request, response) {
    // get all folders in the extensions folder, except third-party
    const extensions = fs
        .readdirSync(PUBLIC_DIRECTORIES.extensions)
        .filter(f => fs.statSync(path.join(PUBLIC_DIRECTORIES.extensions, f)).isDirectory())
        .filter(f => f !== 'third-party');

    // get all folders in the third-party folder, if it exists

    if (!fs.existsSync(path.join(request.user.directories.extensions))) {
        return response.send(extensions);
    }

    const thirdPartyExtensions = fs
        .readdirSync(path.join(request.user.directories.extensions))
        .filter(f => fs.statSync(path.join(request.user.directories.extensions, f)).isDirectory());

    // add the third-party extensions to the extensions array
    extensions.push(...thirdPartyExtensions.map(f => `third-party/${f}`));
    console.log(extensions);


    return response.send(extensions);
});

module.exports = { router };
