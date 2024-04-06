const fsPromises = require('fs').promises;
const path = require('path');
const { USER_DIRECTORY_TEMPLATE, DEFAULT_USER } = require('./constants');
const { getConfigValue } = require('./util');

const DATA_ROOT = getConfigValue('dataRoot', './data');

/**
 * @typedef {Object} User
 * @property {string} uuid - The user's id
 * @property {string} handle - The user's short handle. Used for directories and other references
 * @property {string} name - The user's name. Displayed in the UI
 * @property {number} created - The timestamp when the user was created
 * @property {string} password - SHA256 hash of the user's password
 */

/**
 * @typedef {Object} UserDirectoryList
 * @property {string} root - The root directory for the user
 * @property {string} thumbnails - The directory where the thumbnails are stored
 * @property {string} thumbnailsBg - The directory where the background thumbnails are stored
 * @property {string} thumbnailsAvatar - The directory where the avatar thumbnails are stored
 * @property {string} worlds - The directory where the WI are stored
 * @property {string} user - The directory where the user's public data is stored
 * @property {string} avatars - The directory where the avatars are stored
 * @property {string} userImages - The directory where the images are stored
 * @property {string} groups - The directory where the groups are stored
 * @property {string} groupChats - The directory where the group chats are stored
 * @property {string} chats - The directory where the chats are stored
 * @property {string} characters - The directory where the characters are stored
 * @property {string} backgrounds - The directory where the backgrounds are stored
 * @property {string} novelAI_Settings - The directory where the NovelAI settings are stored
 * @property {string} koboldAI_Settings - The directory where the KoboldAI settings are stored
 * @property {string} openAI_Settings - The directory where the OpenAI settings are stored
 * @property {string} textGen_Settings - The directory where the TextGen settings are stored
 * @property {string} themes - The directory where the themes are stored
 * @property {string} movingUI - The directory where the moving UI data is stored
 * @property {string} extensions - The directory where the extensions are stored
 * @property {string} instruct - The directory where the instruct templates is stored
 * @property {string} context - The directory where the context templates is stored
 * @property {string} quickreplies - The directory where the quick replies are stored
 * @property {string} assets - The directory where the assets are stored
 * @property {string} comfyWorkflows - The directory where the ComfyUI workflows are stored
 * @property {string} files - The directory where the uploaded files are stored
 */

/**
 * Initializes the user storage. Currently a no-op.
 * @returns {Promise<void>}
 */
async function initUserStorage() {
    return Promise.resolve();
}

/**
 * Gets a user for the current request. Hard coded to return the default user.
 * @param {import('express').Request} _req - The request object. Currently unused.
 * @returns {Promise<string>} - The user's handle
 */
async function getCurrentUserHandle(_req) {
    return DEFAULT_USER.handle;
}

/**
 * Gets a list of all user handles. Currently hard coded to return the default user's handle.
 * @returns {Promise<string[]>} - The list of user handles
 */
async function getAllUserHandles() {
    return [DEFAULT_USER.handle];
}

/**
 * Gets the directories listing for the provided user.
 * @param {import('express').Request} req - The request object
 * @returns {Promise<UserDirectoryList>} - The user's directories like {worlds: 'data/user0/worlds/', ...
 */
async function getCurrentUserDirectories(req) {
    const handle = await getCurrentUserHandle(req);
    return getUserDirectories(handle);
}

/**
 * Gets the directories listing for the provided user.
 * @param {string} handle User handle
 * @returns {UserDirectoryList} User directories
 */
function getUserDirectories(handle) {
    const directories = structuredClone(USER_DIRECTORY_TEMPLATE);
    for (const key in directories) {
        directories[key] = path.join(DATA_ROOT, handle, USER_DIRECTORY_TEMPLATE[key]);
    }
    return directories;
}

/**
 * Middleware to add user data to the request object.
 * @param {import('express').Application} app - The express app
 * @returns {import('express').RequestHandler}
 */
function userDataMiddleware(app) {
    app.use('/backgrounds/:path', async (req, res) => {
        try {
            const filePath = path.join(process.cwd(), req.user.directories.backgrounds, decodeURIComponent(req.params.path));
            const data = await fsPromises.readFile(filePath);
            return res.send(data);
        }
        catch {
            return res.sendStatus(404);
        }
    });

    app.use('/characters/:path', async (req, res) => {
        try {
            const filePath = path.join(process.cwd(), req.user.directories.characters, decodeURIComponent(req.params.path));
            const data = await fsPromises.readFile(filePath);
            return res.send(data);
        }
        catch {
            return res.sendStatus(404);
        }
    });

    app.use('/User Avatars/:path', async (req, res) => {
        try {
            const filePath = path.join(process.cwd(), req.user.directories.avatars, decodeURIComponent(req.params.path));
            const data = await fsPromises.readFile(filePath);
            return res.send(data);
        }
        catch {
            return res.sendStatus(404);
        }
    });

    /**
     * Middleware to add user data to the request object.
     * @param {import('express').Request} req Request object
     * @param {import('express').Response} res Response object
     * @param {import('express').NextFunction} next Next function
     */
    return async (req, res, next) => {
        const directories = await getCurrentUserDirectories(req);
        req.user.profile = DEFAULT_USER;
        req.user.directories = directories;
        next();
    };
}

module.exports = {
    initUserStorage,
    getCurrentUserDirectories,
    getCurrentUserHandle,
    getAllUserHandles,
    getUserDirectories,
    userDataMiddleware,
};
