const storage = require('node-persist');
const express = require('express');
const { jsonParser } = require('../express-common');
const { getUserAvatar, toKey, getPasswordHash, getPasswordSalt } = require('../users');

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
        };

        return response.json(viewModel);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

router.post('/change-password', jsonParser, async (request, response) => {
    try {
        if (!request.body.handle || !request.body.oldPassword || !request.body.newPassword) {
            console.log('Change password failed: Missing required fields');
            return response.status(400).json({ error: 'Missing required fields' });
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

        if (user.password && user.password !== getPasswordHash(request.body.oldPassword, user.salt)) {
            console.log('Change password failed: Incorrect password');
            return response.status(401).json({ error: 'Incorrect password' });
        }

        const salt = getPasswordSalt();
        user.password = getPasswordHash(request.body.newPassword, salt);
        user.salt = salt;
        await storage.setItem(toKey(request.body.handle), user);
        return response.sendStatus(204);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

module.exports = {
    router,
};
