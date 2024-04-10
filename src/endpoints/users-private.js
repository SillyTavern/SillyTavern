const path = require('path');
const fsPromises = require('fs').promises;
const storage = require('node-persist');
const express = require('express');
const { jsonParser } = require('../express-common');
const { getUserAvatar, toKey, getPasswordHash, getPasswordSalt, createBackupArchive } = require('../users');
const { SETTINGS_FILE } = require('../constants');
const contentManager = require('./content-manager');

const router = express.Router();

router.post('/logout', async (request, response) => {
    try {
        if (!request.session) {
            console.error('Session not available');
            return response.sendStatus(500);
        }

        request.session.handle = null;
        return response.sendStatus(204);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

router.get('/me', async (request, response) => {
    try {
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
            created: user.created,
        };

        return response.json(viewModel);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

router.post('/change-password', jsonParser, async (request, response) => {
    try {
        if (!request.body.handle) {
            console.log('Change password failed: Missing required fields');
            return response.status(400).json({ error: 'Missing required fields' });
        }

        if (request.body.handle !== request.user.profile.handle && !request.user.profile.admin) {
            console.log('Change password failed: Unauthorized');
            return response.status(403).json({ error: 'Unauthorized' });
        }

        /** @type {import('../users').User} */
        const user = await storage.getItem(toKey(request.body.handle));

        if (!user) {
            console.log('Change password failed: User not found');
            return response.status(404).json({ error: 'User not found' });
        }

        if (!user.enabled) {
            console.log('Change password failed: User is disabled');
            return response.status(403).json({ error: 'User is disabled' });
        }

        if (!request.user.profile.admin && user.password && user.password !== getPasswordHash(request.body.oldPassword, user.salt)) {
            console.log('Change password failed: Incorrect password');
            return response.status(401).json({ error: 'Incorrect password' });
        }

        if (request.body.newPassword) {
            const salt = getPasswordSalt();
            user.password = getPasswordHash(request.body.newPassword, salt);
            user.salt = salt;
        } else {
            user.password = '';
            user.salt = '';
        }

        await storage.setItem(toKey(request.body.handle), user);
        return response.sendStatus(204);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

router.post('/backup', jsonParser, async (request, response) => {
    try {
        const handle = request.body.handle;

        if (!handle) {
            console.log('Backup failed: Missing required fields');
            return response.status(400).json({ error: 'Missing required fields' });
        }

        if (handle !== request.user.profile.handle && !request.user.profile.admin) {
            console.log('Backup failed: Unauthorized');
            return response.status(403).json({ error: 'Unauthorized' });
        }

        await createBackupArchive(handle, response);
    } catch (error) {
        console.error('Backup failed', error);
        return response.sendStatus(500);
    }
});

router.post('/reset-settings', jsonParser, async (request, response) => {
    try {
        const pathToFile = path.join(request.user.directories.root, SETTINGS_FILE);
        await fsPromises.rm(pathToFile, { force: true });
        await contentManager.checkForNewContent([request.user.directories], [contentManager.CONTENT_TYPES.SETTINGS]);

        return response.sendStatus(204);
    } catch (error) {
        console.error('Reset settings failed', error);
        return response.sendStatus(500);
    }
});

module.exports = {
    router,
};
