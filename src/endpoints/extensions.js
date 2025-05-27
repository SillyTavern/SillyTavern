import path from 'node:path';
import fs from 'node:fs';

import express from 'express';
import sanitize from 'sanitize-filename';
import { default as simpleGit } from 'simple-git';

import { PUBLIC_DIRECTORIES } from '../constants.js';

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
    const git = simpleGit({ baseDir: extensionPath });
    await git.fetch('origin');
    const currentBranch = await git.branch();
    const currentCommitHash = await git.revparse(['HEAD']);
    const log = await git.log({
        from: currentCommitHash,
        to: `origin/${currentBranch.current}`,
    });

    // Fetch remote repository information
    const remotes = await git.getRemotes(true);
    if (remotes.length === 0) {
        return {
            isUpToDate: true,
            remoteUrl: '',
        };
    }

    return {
        isUpToDate: log.total === 0,
        remoteUrl: remotes[0].refs.fetch, // URL of the remote repository
    };
}

export const router = express.Router();

/**
 * HTTP POST handler function to clone a git repository from a provided URL, read the extension manifest,
 * and return extension information and path.
 *
 * @param {Object} request - HTTP Request object, expects a JSON body with a 'url' property.
 * @param {Object} response - HTTP Response object used to respond to the HTTP request.
 *
 * @returns {void}
 */
router.post('/install', async (request, response) => {
    if (!request.body.url) {
        return response.status(400).send('Bad Request: URL is required in the request body.');
    }

    try {
        const git = simpleGit();

        // make sure the third-party directory exists
        if (!fs.existsSync(path.join(request.user.directories.extensions))) {
            fs.mkdirSync(path.join(request.user.directories.extensions));
        }

        if (!fs.existsSync(PUBLIC_DIRECTORIES.globalExtensions)) {
            fs.mkdirSync(PUBLIC_DIRECTORIES.globalExtensions);
        }

        const { url, global, branch } = request.body;

        if (global && !request.user.profile.admin) {
            console.error(`User ${request.user.profile.handle} does not have permission to install global extensions.`);
            return response.status(403).send('Forbidden: No permission to install global extensions.');
        }

        const basePath = global ? PUBLIC_DIRECTORIES.globalExtensions : request.user.directories.extensions;
        const extensionPath = path.join(basePath, sanitize(path.basename(url, '.git')));

        if (fs.existsSync(extensionPath)) {
            return response.status(409).send(`Directory already exists at ${extensionPath}`);
        }

        const cloneOptions = { '--depth': 1 };
        if (branch) {
            cloneOptions['--branch'] = branch;
        }
        await git.clone(url, extensionPath, cloneOptions);
        console.info(`Extension has been cloned to ${extensionPath} from ${url} at ${branch || '(default)'} branch`);

        const { version, author, display_name } = await getManifest(extensionPath);

        return response.send({ version, author, display_name, extensionPath });
    } catch (error) {
        console.error('Importing custom content failed', error);
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
router.post('/update', async (request, response) => {
    if (!request.body.extensionName) {
        return response.status(400).send('Bad Request: extensionName is required in the request body.');
    }

    try {
        const { extensionName, global } = request.body;

        if (global && !request.user.profile.admin) {
            console.error(`User ${request.user.profile.handle} does not have permission to update global extensions.`);
            return response.status(403).send('Forbidden: No permission to update global extensions.');
        }

        const basePath = global ? PUBLIC_DIRECTORIES.globalExtensions : request.user.directories.extensions;
        const extensionPath = path.join(basePath, sanitize(extensionName));

        if (!fs.existsSync(extensionPath)) {
            return response.status(404).send(`Directory does not exist at ${extensionPath}`);
        }

        const { isUpToDate, remoteUrl } = await checkIfRepoIsUpToDate(extensionPath);
        const git = simpleGit({ baseDir: extensionPath });
        const currentBranch = await git.branch();
        if (!isUpToDate) {
            await git.pull('origin', currentBranch.current);
            console.info(`Extension has been updated at ${extensionPath}`);
        } else {
            console.info(`Extension is up to date at ${extensionPath}`);
        }
        await git.fetch('origin');
        const fullCommitHash = await git.revparse(['HEAD']);
        const shortCommitHash = fullCommitHash.slice(0, 7);

        return response.send({ shortCommitHash, extensionPath, isUpToDate, remoteUrl });

    } catch (error) {
        console.error('Updating custom content failed', error);
        return response.status(500).send(`Server Error: ${error.message}`);
    }
});

router.post('/branches', async (request, response) => {
    try {
        const { extensionName, global } = request.body;

        if (!extensionName) {
            return response.status(400).send('Bad Request: extensionName is required in the request body.');
        }

        if (global && !request.user.profile.admin) {
            console.error(`User ${request.user.profile.handle} does not have permission to list branches of global extensions.`);
            return response.status(403).send('Forbidden: No permission to list branches of global extensions.');
        }

        const basePath = global ? PUBLIC_DIRECTORIES.globalExtensions : request.user.directories.extensions;
        const extensionPath = path.join(basePath, sanitize(extensionName));

        if (!fs.existsSync(extensionPath)) {
            return response.status(404).send(`Directory does not exist at ${extensionPath}`);
        }

        const git = simpleGit({ baseDir: extensionPath });
        // Unshallow the repository if it is shallow
        const isShallow = await git.revparse(['--is-shallow-repository']) === 'true';
        if (isShallow) {
            console.info(`Unshallowing the repository at ${extensionPath}`);
            await git.fetch('origin', ['--unshallow']);
        }

        // Fetch all branches
        await git.remote(['set-branches', 'origin', '*']);
        await git.fetch('origin');
        const localBranches = await git.branchLocal();
        const remoteBranches = await git.branch(['-r', '--list', 'origin/*']);
        const result = [
            ...Object.values(localBranches.branches),
            ...Object.values(remoteBranches.branches),
        ].map(b => ({ current: b.current, commit: b.commit, name: b.name, label: b.label }));

        return response.send(result);
    } catch (error) {
        console.error('Getting branches failed', error);
        return response.status(500).send('Internal Server Error. Check the server logs for more details.');
    }
});

router.post('/switch', async (request, response) => {
    try {
        const { extensionName, branch, global } = request.body;

        if (!extensionName || !branch) {
            return response.status(400).send('Bad Request: extensionName and branch are required in the request body.');
        }

        if (global && !request.user.profile.admin) {
            console.error(`User ${request.user.profile.handle} does not have permission to switch branches of global extensions.`);
            return response.status(403).send('Forbidden: No permission to switch branches of global extensions.');
        }

        const basePath = global ? PUBLIC_DIRECTORIES.globalExtensions : request.user.directories.extensions;
        const extensionPath = path.join(basePath, sanitize(extensionName));

        if (!fs.existsSync(extensionPath)) {
            return response.status(404).send(`Directory does not exist at ${extensionPath}`);
        }

        const git = simpleGit({ baseDir: extensionPath });
        const branches = await git.branchLocal();

        if (String(branch).startsWith('origin/')) {
            const localBranch = branch.replace('origin/', '');
            if (branches.all.includes(localBranch)) {
                console.info(`Branch ${localBranch} already exists locally, checking it out`);
                await git.checkout(localBranch);
                return response.sendStatus(204);
            }

            console.info(`Branch ${localBranch} does not exist locally, creating it from ${branch}`);
            await git.checkoutBranch(localBranch, branch);
            return response.sendStatus(204);
        }

        if (!branches.all.includes(branch)) {
            console.error(`Branch ${branch} does not exist locally`);
            return response.status(404).send(`Branch ${branch} does not exist locally`);
        }

        // Check if the branch is already checked out
        const currentBranch = await git.branch();
        if (currentBranch.current === branch) {
            console.info(`Branch ${branch} is already checked out`);
            return response.sendStatus(204);
        }

        // Checkout the branch
        await git.checkout(branch);
        console.info(`Checked out branch ${branch} at ${extensionPath}`);

        return response.sendStatus(204);
    } catch (error) {
        console.error('Switching branches failed', error);
        return response.status(500).send('Internal Server Error. Check the server logs for more details.');
    }
});

router.post('/move', async (request, response) => {
    try {
        const { extensionName, source, destination } = request.body;

        if (!extensionName || !source || !destination) {
            return response.status(400).send('Bad Request. Not all required parameters are provided.');
        }

        if (!request.user.profile.admin) {
            console.error(`User ${request.user.profile.handle} does not have permission to move extensions.`);
            return response.status(403).send('Forbidden: No permission to move extensions.');
        }

        const sourceDirectory = source === 'global' ? PUBLIC_DIRECTORIES.globalExtensions : request.user.directories.extensions;
        const destinationDirectory = destination === 'global' ? PUBLIC_DIRECTORIES.globalExtensions : request.user.directories.extensions;
        const sourcePath = path.join(sourceDirectory, sanitize(extensionName));
        const destinationPath = path.join(destinationDirectory, sanitize(extensionName));

        if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isDirectory()) {
            console.error(`Source directory does not exist at ${sourcePath}`);
            return response.status(404).send('Source directory does not exist.');
        }

        if (fs.existsSync(destinationPath)) {
            console.error(`Destination directory already exists at ${destinationPath}`);
            return response.status(409).send('Destination directory already exists.');
        }

        if (source === destination) {
            console.error('Source and destination directories are the same');
            return response.status(409).send('Source and destination directories are the same.');
        }

        fs.cpSync(sourcePath, destinationPath, { recursive: true, force: true });
        fs.rmSync(sourcePath, { recursive: true, force: true });
        console.info(`Extension has been moved from ${sourcePath} to ${destinationPath}`);

        return response.sendStatus(204);
    } catch (error) {
        console.error('Moving extension failed', error);
        return response.status(500).send('Internal Server Error. Check the server logs for more details.');
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
router.post('/version', async (request, response) => {
    if (!request.body.extensionName) {
        return response.status(400).send('Bad Request: extensionName is required in the request body.');
    }

    try {
        const { extensionName, global } = request.body;
        const basePath = global ? PUBLIC_DIRECTORIES.globalExtensions : request.user.directories.extensions;
        const extensionPath = path.join(basePath, sanitize(extensionName));

        if (!fs.existsSync(extensionPath)) {
            return response.status(404).send(`Directory does not exist at ${extensionPath}`);
        }

        const git = simpleGit({ baseDir: extensionPath });
        let currentCommitHash;
        try {
            currentCommitHash = await git.revparse(['HEAD']);
        } catch (error) {
            // it is not a git repo, or has no commits yet, or is a bare repo
            // not possible to update it, most likely can't get the branch name either
            return response.send({ currentBranchName: '', currentCommitHash: '', isUpToDate: true, remoteUrl: '' });
        }

        const currentBranch = await git.branch();
        // get only the working branch
        const currentBranchName = currentBranch.current;
        await git.fetch('origin');
        console.debug(extensionName, currentBranchName, currentCommitHash);
        const { isUpToDate, remoteUrl } = await checkIfRepoIsUpToDate(extensionPath);

        return response.send({ currentBranchName, currentCommitHash, isUpToDate, remoteUrl });

    } catch (error) {
        console.error('Getting extension version failed', error);
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
router.post('/delete', async (request, response) => {
    if (!request.body.extensionName) {
        return response.status(400).send('Bad Request: extensionName is required in the request body.');
    }

    try {
        const { extensionName, global } = request.body;

        if (global && !request.user.profile.admin) {
            console.error(`User ${request.user.profile.handle} does not have permission to delete global extensions.`);
            return response.status(403).send('Forbidden: No permission to delete global extensions.');
        }

        const basePath = global ? PUBLIC_DIRECTORIES.globalExtensions : request.user.directories.extensions;
        const extensionPath = path.join(basePath, sanitize(extensionName));

        if (!fs.existsSync(extensionPath)) {
            return response.status(404).send(`Directory does not exist at ${extensionPath}`);
        }

        await fs.promises.rm(extensionPath, { recursive: true });
        console.info(`Extension has been deleted at ${extensionPath}`);

        return response.send(`Extension has been deleted at ${extensionPath}`);

    } catch (error) {
        console.error('Deleting custom content failed', error);
        return response.status(500).send(`Server Error: ${error.message}`);
    }
});

/**
 * Discover the extension folders
 * If the folder is called third-party, search for subfolders instead
 */
router.get('/discover', function (request, response) {
    if (!fs.existsSync(path.join(request.user.directories.extensions))) {
        fs.mkdirSync(path.join(request.user.directories.extensions));
    }

    if (!fs.existsSync(PUBLIC_DIRECTORIES.globalExtensions)) {
        fs.mkdirSync(PUBLIC_DIRECTORIES.globalExtensions);
    }

    // Get all folders in system extensions folder, excluding third-party
    const builtInExtensions = fs
        .readdirSync(PUBLIC_DIRECTORIES.extensions)
        .filter(f => fs.statSync(path.join(PUBLIC_DIRECTORIES.extensions, f)).isDirectory())
        .filter(f => f !== 'third-party')
        .map(f => ({ type: 'system', name: f }));

    // Get all folders in local extensions folder
    const userExtensions = fs
        .readdirSync(path.join(request.user.directories.extensions))
        .filter(f => fs.statSync(path.join(request.user.directories.extensions, f)).isDirectory())
        .map(f => ({ type: 'local', name: `third-party/${f}` }));

    // Get all folders in global extensions folder
    // In case of a conflict, the extension will be loaded from the user folder
    const globalExtensions = fs
        .readdirSync(PUBLIC_DIRECTORIES.globalExtensions)
        .filter(f => fs.statSync(path.join(PUBLIC_DIRECTORIES.globalExtensions, f)).isDirectory())
        .map(f => ({ type: 'global', name: `third-party/${f}` }))
        .filter(f => !userExtensions.some(e => e.name === f.name));

    // Combine all extensions
    const allExtensions = [...builtInExtensions, ...userExtensions, ...globalExtensions];
    console.debug('Extensions available for', request.user.profile.handle, allExtensions);

    return response.send(allExtensions);
});
