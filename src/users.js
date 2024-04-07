// Native Node Modules
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');

// Express and other dependencies
const storage = require('node-persist');
const express = require('express');
const cookieSession = require('cookie-session');
const uuid = require('uuid');
const mime = require('mime-types');
const slugify = require('slugify').default;

// Local imports
const { jsonParser } = require('./express-common');
const { USER_DIRECTORY_TEMPLATE, DEFAULT_USER, PUBLIC_DIRECTORIES, DEFAULT_AVATAR } = require('./constants');
const { getConfigValue, color, delay, setConfigValue, Cache } = require('./util');
const { readSecret, writeSecret } = require('./endpoints/secrets');
const { checkForNewContent } = require('./endpoints/content-manager');

const KEY_PREFIX = 'user:';
const DATA_ROOT = getConfigValue('dataRoot', './data');
const ENABLE_ACCOUNTS = getConfigValue('enableUserAccounts', false);
const MFA_CACHE = new Cache(5 * 60 * 1000);
/**
 * Cache for user directories.
 * @type {Map<string, UserDirectoryList>}
 */
const DIRECTORIES_CACHE = new Map();

const STORAGE_KEYS = {
    csrfSecret: 'csrfSecret',
    cookieSecret: 'cookieSecret',
};

/**
 * @typedef {Object} User
 * @property {string} uuid - The user's id
 * @property {string} handle - The user's short handle. Used for directories and other references
 * @property {string} name - The user's name. Displayed in the UI
 * @property {number} created - The timestamp when the user was created
 * @property {string} password - SHA256 hash of the user's password
 * @property {string} salt - Salt used for hashing the password
 * @property {boolean} enabled - Whether the user is enabled
 * @property {boolean} admin - Whether the user is an admin (can manage other users)
 */

/**
 * @typedef {Object} UserViewModel
 * @property {string} handle - The user's short handle. Used for directories and other references
 * @property {string} name - The user's name. Displayed in the UI
 * @property {string} avatar - The user's avatar image
 * @property {boolean} admin - Whether the user is an admin (can manage other users)
 * @property {boolean} password - Whether the user is password protected
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
 * @property {string} vectors - The directory where the vectors are stored
 */

/**
 * Ensures that the content directories exist.
 * @returns {Promise<import('./users').UserDirectoryList[]>} - The list of user directories
 */
async function ensurePublicDirectoriesExist() {
    for (const dir of Object.values(PUBLIC_DIRECTORIES)) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    const userHandles = await getAllUserHandles();
    const directoriesList = userHandles.map(handle => getUserDirectories(handle));
    for (const userDirectories of directoriesList) {
        for (const dir of Object.values(userDirectories)) {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }
    }
    return directoriesList;
}

/**
 * Perform migration from the old user data format to the new one.
 */
async function migrateUserData() {
    const publicDirectory = path.join(process.cwd(), 'public');

    // No need to migrate if the characters directory doesn't exists
    if (!fs.existsSync(path.join(publicDirectory, 'characters'))) {
        return;
    }

    const TIMEOUT = 10;

    console.log();
    console.log(color.magenta('Preparing to migrate user data...'));
    console.log(`All public data will be moved to the ${DATA_ROOT} directory.`);
    console.log('This process may take a while depending on the amount of data to move.');
    console.log(`Backups will be placed in the ${PUBLIC_DIRECTORIES.backups} directory.`);
    console.log(`The process will start in ${TIMEOUT} seconds. Press Ctrl+C to cancel.`);

    for (let i = TIMEOUT; i > 0; i--) {
        console.log(`${i}...`);
        await delay(1000);
    }

    console.log(color.magenta('Starting migration... Do not interrupt the process!'));

    const userDirectories = getUserDirectories(DEFAULT_USER.handle);

    const dataMigrationMap = [
        {
            old: path.join(publicDirectory, 'assets'),
            new: userDirectories.assets,
            file: false,
        },
        {
            old: path.join(publicDirectory, 'backgrounds'),
            new: userDirectories.backgrounds,
            file: false,
        },
        {
            old: path.join(publicDirectory, 'characters'),
            new: userDirectories.characters,
            file: false,
        },
        {
            old: path.join(publicDirectory, 'chats'),
            new: userDirectories.chats,
            file: false,
        },
        {
            old: path.join(publicDirectory, 'context'),
            new: userDirectories.context,
            file: false,
        },
        {
            old: path.join(publicDirectory, 'group chats'),
            new: userDirectories.groupChats,
            file: false,
        },
        {
            old: path.join(publicDirectory, 'groups'),
            new: userDirectories.groups,
            file: false,
        },
        {
            old: path.join(publicDirectory, 'instruct'),
            new: userDirectories.instruct,
            file: false,
        },
        {
            old: path.join(publicDirectory, 'KoboldAI Settings'),
            new: userDirectories.koboldAI_Settings,
            file: false,
        },
        {
            old: path.join(publicDirectory, 'movingUI'),
            new: userDirectories.movingUI,
            file: false,
        },
        {
            old: path.join(publicDirectory, 'NovelAI Settings'),
            new: userDirectories.novelAI_Settings,
            file: false,
        },
        {
            old: path.join(publicDirectory, 'OpenAI Settings'),
            new: userDirectories.openAI_Settings,
            file: false,
        },
        {
            old: path.join(publicDirectory, 'QuickReplies'),
            new: userDirectories.quickreplies,
            file: false,
        },
        {
            old: path.join(publicDirectory, 'TextGen Settings'),
            new: userDirectories.textGen_Settings,
            file: false,
        },
        {
            old: path.join(publicDirectory, 'themes'),
            new: userDirectories.themes,
            file: false,
        },
        {
            old: path.join(publicDirectory, 'user'),
            new: userDirectories.user,
            file: false,
        },
        {
            old: path.join(publicDirectory, 'User Avatars'),
            new: userDirectories.avatars,
            file: false,
        },
        {
            old: path.join(publicDirectory, 'worlds'),
            new: userDirectories.worlds,
            file: false,
        },
        {
            old: path.join(publicDirectory, 'scripts/extensions/third-party'),
            new: userDirectories.extensions,
            file: false,
        },
        {
            old: path.join(process.cwd(), 'thumbnails'),
            new: userDirectories.thumbnails,
            file: false,
        },
        {
            old: path.join(process.cwd(), 'vectors'),
            new: userDirectories.vectors,
            file: false,
        },
        {
            old: path.join(process.cwd(), 'secrets.json'),
            new: path.join(userDirectories.root, 'secrets.json'),
            file: true,
        },
        {
            old: path.join(publicDirectory, 'settings.json'),
            new: path.join(userDirectories.root, 'settings.json'),
            file: true,
        },
        {
            old: path.join(publicDirectory, 'stats.json'),
            new: path.join(userDirectories.root, 'stats.json'),
            file: true,
        },
    ];

    const currentDate = new Date().toISOString().split('T')[0];
    const backupDirectory = path.join(process.cwd(), PUBLIC_DIRECTORIES.backups, '_migration', currentDate);

    if (!fs.existsSync(backupDirectory)) {
        fs.mkdirSync(backupDirectory, { recursive: true });
    }

    const errors = [];

    for (const migration of dataMigrationMap) {
        console.log(`Migrating ${migration.old} to ${migration.new}...`);

        try {
            if (!fs.existsSync(migration.old)) {
                console.log(color.yellow(`Skipping migration of ${migration.old} as it does not exist.`));
                continue;
            }

            if (migration.file) {
                // Copy the file to the new location
                fs.cpSync(migration.old, migration.new, { force: true });
                // Move the file to the backup location
                fs.renameSync(migration.old, path.join(backupDirectory, path.basename(migration.old)));
            } else {
                // Copy the directory to the new location
                fs.cpSync(migration.old, migration.new, { recursive: true, force: true });
                // Move the directory to the backup location
                fs.renameSync(migration.old, path.join(backupDirectory, path.basename(migration.old)));
            }
        } catch (error) {
            console.error(color.red(`Error migrating ${migration.old} to ${migration.new}:`), error.message);
            errors.push(migration.old);
        }
    }

    if (errors.length > 0) {
        console.log(color.red('Migration completed with errors. Move the following files manually:'));
        errors.forEach(error => console.error(error));
    }

    console.log(color.green('Migration completed!'));
}

/**
 * Converts a user handle to a storage key.
 * @param {string} handle User handle
 * @returns {string} The key for the user storage
 */
function toKey(handle) {
    return `${KEY_PREFIX}${handle}`;
}

/**
 * Initializes the user storage. Currently a no-op.
 * @returns {Promise<void>}
 */
async function initUserStorage() {
    await storage.init({
        dir: path.join(DATA_ROOT, '_storage'),
        ttl: true,
    });

    const keys = await getAllUserHandles();

    // If there are no users, create the default user
    if (keys.length === 0) {
        await storage.setItem(toKey(DEFAULT_USER.handle), DEFAULT_USER);
    }
}

/**
 * Get the cookie secret from the config. If it doesn't exist, generate a new one.
 * @returns {string} The cookie secret
 */
function getCookieSecret() {
    let secret = getConfigValue(STORAGE_KEYS.cookieSecret);

    if (!secret) {
        console.warn(color.yellow('Cookie secret is missing from config.yaml. Generating a new one...'));
        secret = crypto.randomBytes(64).toString('base64');
        setConfigValue(STORAGE_KEYS.cookieSecret, secret);
    }

    return secret;
}

/**
 * Generates a random password salt.
 * @returns {string} The password salt
 */
function getPasswordSalt() {
    return crypto.randomBytes(16).toString('base64');
}

/**
 * Get the session name for the current server.
 * @returns {string} The session name
 */
function getCookieSessionName() {
    // Get server hostname and hash it to generate a session suffix
    const suffix = crypto.createHash('sha256').update(os.hostname()).digest('hex').slice(0, 8);
    return `session-${suffix}`;
}

/**
 * Hashes a password using SHA256.
 * @param {string} password Password to hash
 * @param {string} salt Salt to use for hashing
 * @returns {string} Hashed password
 */
function getPasswordHash(password, salt) {
    return crypto.createHash('sha256').update(password + salt).digest('hex');
}

/**
 * Get the CSRF secret from the storage.
 * @param {import('express').Request} [request] HTTP request object
 * @returns {string} The CSRF secret
 */
function getCsrfSecret(request) {
    if (!request || !request.user) {
        throw new Error('Request object is required to get the CSRF secret.');
    }

    let csrfSecret = readSecret(request.user.directories, STORAGE_KEYS.csrfSecret);

    if (!csrfSecret) {
        csrfSecret = crypto.randomBytes(64).toString('base64');
        writeSecret(request.user.directories, STORAGE_KEYS.csrfSecret, csrfSecret);
    }

    return csrfSecret;
}

/**
 * Gets a list of all user handles.
 * @returns {Promise<string[]>} - The list of user handles
 */
async function getAllUserHandles() {
    const keys = await storage.keys(x=> x.key.startsWith(KEY_PREFIX));
    const handles = keys.map(x => x.replace(KEY_PREFIX, ''));
    return handles;
}

/**
 * Gets the directories listing for the provided user.
 * @param {string} handle User handle
 * @returns {UserDirectoryList} User directories
 */
function getUserDirectories(handle) {
    if (DIRECTORIES_CACHE.has(handle)) {
        const cache = DIRECTORIES_CACHE.get(handle);
        if (cache) {
            return cache;
        }
    }

    const directories = structuredClone(USER_DIRECTORY_TEMPLATE);
    for (const key in directories) {
        directories[key] = path.join(DATA_ROOT, handle, USER_DIRECTORY_TEMPLATE[key]);
    }
    DIRECTORIES_CACHE.set(handle, directories);
    return directories;
}

/**
 * Gets the avatar URL for the provided user.
 * @param {string} handle User handle
 * @returns {string} User avatar URL
 */
function getUserAvatar(handle) {
    try {
        const directory = getUserDirectories(handle);
        const pathToSettings = path.join(directory.root, 'settings.json');
        const settings = fs.existsSync(pathToSettings) ? JSON.parse(fs.readFileSync(pathToSettings, 'utf8')) : {};
        const avatarFile = settings?.power_user?.default_persona || settings?.user_avatar;
        if (!avatarFile) {
            return DEFAULT_AVATAR;
        }
        const avatarPath = path.join(directory.avatars, avatarFile);
        if (!fs.existsSync(avatarPath)) {
            return DEFAULT_AVATAR;
        }
        const mimeType = mime.lookup(avatarPath);
        const base64Content = fs.readFileSync(avatarPath, 'base64');
        return `data:${mimeType};base64,${base64Content}`;
    }
    catch {
        // Ignore errors
        return DEFAULT_AVATAR;
    }
}

/**
 * Middleware to add user data to the request object.
 * @param {import('express').Express} app Express app
 * @returns {import('express').RequestHandler}
 */
function userDataMiddleware(app) {
    app.use(cookieSession({
        name: getCookieSessionName(),
        sameSite: 'strict',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        secret: getCookieSecret(),
    }));

    /**
     * Middleware to add user data to the request object.
     * @param {import('express').Request} req Request object
     * @param {import('express').Response} res Response object
     * @param {import('express').NextFunction} next Next function
     */
    return async (req, res, next) => {
        // Skip for login page
        if (req.path === '/login') {
            return next();
        }

        // If user accounts are disabled, use the default user
        if (!ENABLE_ACCOUNTS) {
            const handle = DEFAULT_USER.handle;
            const directories = getUserDirectories(handle);
            req.user = {
                profile: DEFAULT_USER,
                directories: directories,
            };
            return next();
        }

        if (!req.session) {
            console.error('Session not available');
            return res.sendStatus(500);
        }

        // If user accounts are enabled, get the user from the session
        let handle = req.session?.handle;

        // If we have the only user and it's not password protected, use it
        if (!handle) {
            const handles = await getAllUserHandles();
            if (handles.length === 1) {
                /** @type {User} */
                const user = await storage.getItem(toKey(handles[0]));
                if (!user.password) {
                    handle = user.handle;
                    req.session.handle = handle;
                }
            }
        }

        if (!handle) {
            return res.redirect('/login');
        }

        /** @type {User} */
        const user = await storage.getItem(toKey(handle));

        if (!user) {
            console.error('User not found:', handle);
            return res.redirect('/login');
        }

        if (!user.enabled) {
            console.error('User is disabled:', handle);
            return res.redirect('/login');
        }

        const directories = getUserDirectories(handle);
        req.user = {
            profile: user,
            directories: directories,
        };
        return next();
    };
}

/**
 * Creates a route handler for serving files from a specific directory.
 * @param {(req: import('express').Request) => string} directoryFn A function that returns the directory path to serve files from
 * @returns {import('express').RequestHandler}
 */
function createRouteHandler(directoryFn) {
    return async (req, res) => {
        try {
            const directory = directoryFn(req);
            const filePath = decodeURIComponent(req.params[0]);
            return res.sendFile(filePath, { root: directory });
        } catch (error) {
            console.error(error);
            return res.sendStatus(404);
        }
    };
}

/**
 * Verifies that the current user is an admin.
 * @param {import('express').Request} request Request object
 * @param {import('express').Response} response Response object
 * @param {import('express').NextFunction} next Next function
 * @returns {any}
 */
function requireAdminMiddleware(request, response, next) {
    if (!request.user) {
        return response.sendStatus(401);
    }

    if (request.user.profile.admin) {
        return next();
    }

    console.warn('Unauthorized access to admin endpoint:', request.originalUrl);
    return response.sendStatus(403);
}

/**
 * Express router for serving files from the user's directories.
 */
const router = express.Router();
router.use('/backgrounds/*', createRouteHandler(req => req.user.directories.backgrounds));
router.use('/characters/*', createRouteHandler(req => req.user.directories.characters));
router.use('/User%20Avatars/*', createRouteHandler(req => req.user.directories.avatars));
router.use('/assets/*', createRouteHandler(req => req.user.directories.assets));
router.use('/user/images/*', createRouteHandler(req => req.user.directories.userImages));
router.use('/user/files/*', createRouteHandler(req => req.user.directories.files));
router.use('/scripts/extensions/third-party/*', createRouteHandler(req => req.user.directories.extensions));

const endpoints = express.Router();

endpoints.get('/list', async (_request, response) => {
    /** @type {User[]} */
    const users = await storage.values();
    const viewModels = users.filter(x => x.enabled).map(user => ({
        handle: user.handle,
        name: user.name,
        avatar: getUserAvatar(user.handle),
        admin: user.admin,
        password: !!user.password,
    }));

    return response.json(viewModels);
});

endpoints.get('/me', async (request, response) => {
    if (!request.user) {
        return response.sendStatus(401);
    }

    const user = request.user.profile;
    const viewModel = {
        handle: user.handle,
        name: user.name,
        avatar: getUserAvatar(user.handle),
        admin: user.admin,
        password: !!user.password,
    };

    return response.json(viewModel);
});

endpoints.post('/recover-step1', jsonParser, async (request, response) => {
    if (!request.body.handle) {
        console.log('Recover step 1 failed: Missing required fields');
        return response.status(400).json({ error: 'Missing required fields' });
    }

    /** @type {User} */
    const user = await storage.getItem(toKey(request.body.handle));

    if (!user) {
        console.log('Recover step 1 failed: User not found');
        return response.status(404).json({ error: 'User not found' });
    }

    if (!user.enabled) {
        console.log('Recover step 1 failed: User is disabled');
        return response.status(403).json({ error: 'User is disabled' });
    }

    const mfaCode = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    console.log(color.blue(`${user.name} YOUR PASSWORD RECOVERY CODE IS: `) + color.magenta(mfaCode));
    MFA_CACHE.set(user.handle, mfaCode);
    return response.sendStatus(204);
});

endpoints.post('/recover-step2', jsonParser, async (request, response) => {
    if (!request.body.handle || !request.body.code || !request.body.password) {
        console.log('Recover step 2 failed: Missing required fields');
        return response.status(400).json({ error: 'Missing required fields' });
    }

    /** @type {User} */
    const user = await storage.getItem(toKey(request.body.handle));

    if (!user) {
        console.log('Recover step 2 failed: User not found');
        return response.status(404).json({ error: 'User not found' });
    }

    if (!user.enabled) {
        console.log('Recover step 2 failed: User is disabled');
        return response.status(403).json({ error: 'User is disabled' });
    }

    const mfaCode = MFA_CACHE.get(user.handle);

    if (request.body.code !== mfaCode) {
        console.log('Recover step 2 failed: Incorrect code');
        return response.status(401).json({ error: 'Incorrect code' });
    }

    const salt = getPasswordSalt();
    user.password = getPasswordHash(request.body.password, salt);
    user.salt = salt;
    await storage.setItem(toKey(user.handle), user);
    return response.sendStatus(204);
});

endpoints.post('/login', jsonParser, async (request, response) => {
    if (!request.body.handle || !request.body.password) {
        console.log('Login failed: Missing required fields');
        return response.status(400).json({ error: 'Missing required fields' });
    }

    /** @type {User} */
    const user = await storage.getItem(toKey(request.body.handle));

    if (!user) {
        console.log('Login failed: User not found');
        return response.status(401).json({ error: 'User not found' });
    }

    if (!user.enabled) {
        console.log('Login failed: User is disabled');
        return response.status(403).json({ error: 'User is disabled' });
    }

    if (user.password && user.password !== getPasswordHash(request.body.password, user.salt)) {
        console.log('Login failed: Incorrect password');
        return response.status(401).json({ error: 'Incorrect password' });
    }

    if (!request.session) {
        console.error('Login failed: Session not available');
        return response.status(500).json({ error: 'Session not available' });
    }

    // Regenerate session to prevent session fixation attacks
    await new Promise(resolve => request.session?.regenerate(resolve));


    request.session.handle = user.handle;
    console.log('Login successful:', user.handle, request.session);
    return response.json({ handle: user.handle });
});

endpoints.post('/logout', async (request, response) => {
    request.session?.destroy(() => {
        return response.sendStatus(204);
    });
});

endpoints.post('/disable', requireAdminMiddleware, jsonParser, async (request, response) => {
    if (!request.body.handle) {
        console.log('Disable user failed: Missing required fields');
        return response.status(400).json({ error: 'Missing required fields' });
    }

    if (request.body.handle === request.user.profile.handle) {
        console.log('Disable user failed: Cannot disable yourself');
        return response.status(400).json({ error: 'Cannot disable yourself' });
    }

    /** @type {User} */
    const user = await storage.getItem(toKey(request.body.handle));

    if (!user) {
        console.log('Disable user failed: User not found');
        return response.status(404).json({ error: 'User not found' });
    }

    user.enabled = false;
    await storage.setItem(toKey(request.body.handle), user);
    return response.sendStatus(204);
});

endpoints.post('/enable', requireAdminMiddleware, jsonParser, async (request, response) => {
    if (!request.body.handle) {
        console.log('Enable user failed: Missing required fields');
        return response.status(400).json({ error: 'Missing required fields' });
    }

    /** @type {User} */
    const user = await storage.getItem(toKey(request.body.handle));

    if (!user) {
        console.log('Enable user failed: User not found');
        return response.status(404).json({ error: 'User not found' });
    }

    user.enabled = true;
    await storage.setItem(toKey(request.body.handle), user);
    return response.sendStatus(204);
});

endpoints.post('/change-password', jsonParser, async (request, response) => {
    if (!request.body.handle || !request.body.oldPassword || !request.body.newPassword) {
        console.log('Change password failed: Missing required fields');
        return response.status(400).json({ error: 'Missing required fields' });
    }

    /** @type {User} */
    const user = await storage.getItem(toKey(request.body.handle));

    if (!user) {
        console.log('Change password failed: User not found');
        return response.status(404).json({ error: 'User not found' });
    }

    if (!user.enabled) {
        console.log('Change password failed: User is disabled');
        return response.status(403).json({ error: 'User is disabled' });
    }

    if (user.password && user.password !== getPasswordHash(request.body.oldPassword, user.salt)) {
        console.log('Change password failed: Incorrect password');
        return response.status(401).json({ error: 'Incorrect password' });
    }

    const salt = getPasswordSalt();
    user.password = getPasswordHash(request.body.newPassword, salt);
    user.salt = salt;
    await storage.setItem(toKey(request.body.handle), user);
    return response.sendStatus(204);
});

endpoints.post('/create', requireAdminMiddleware, jsonParser, async (request, response) => {
    if (!request.body.handle || !request.body.name) {
        console.log('Create user failed: Missing required fields');
        return response.status(400).json({ error: 'Missing required fields' });
    }

    const handles = await getAllUserHandles();
    const handle = slugify(request.body.handle, { lower: true, trim: true });

    if (handles.some(x => x === handle)) {
        console.log('Create user failed: User with that handle already exists');
        return response.status(409).json({ error: 'User already exists' });
    }

    const salt = getPasswordSalt();
    const password = request.body.password ? getPasswordHash(request.body.password, salt) : '';

    const newUser = {
        uuid: uuid.v4(),
        handle: handle,
        name: request.body.name || 'Anonymous',
        created: Date.now(),
        password: password,
        salt: salt,
        admin: !!request.body.admin,
        enabled: true,
    };

    await storage.setItem(toKey(handle), newUser);

    // Create user directories
    console.log('Creating data directories for', newUser.handle);
    const directories = await ensurePublicDirectoriesExist();
    await checkForNewContent(directories);
    return response.json({ handle: newUser.handle });
});

router.use('/api/users', endpoints);

module.exports = {
    initUserStorage,
    ensurePublicDirectoriesExist,
    getAllUserHandles,
    getUserDirectories,
    userDataMiddleware,
    migrateUserData,
    getCsrfSecret,
    getCookieSecret,
    router,
};
