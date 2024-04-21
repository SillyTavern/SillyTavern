const crypto = require('crypto');
const storage = require('node-persist');
const express = require('express');
const { RateLimiterMemory, RateLimiterRes } = require('rate-limiter-flexible');
const { jsonParser, getIpFromRequest } = require('../express-common');
const { color, Cache, getConfigValue } = require('../util');
const { KEY_PREFIX, getUserAvatar, toKey, getPasswordHash, getPasswordSalt } = require('../users');

const DISCREET_LOGIN = getConfigValue('enableDiscreetLogin', false);
const MFA_CACHE = new Cache(5 * 60 * 1000);

const router = express.Router();
const loginLimiter = new RateLimiterMemory({
    points: 5,
    duration: 60,
});
const recoverLimiter = new RateLimiterMemory({
    points: 5,
    duration: 300,
});

router.post('/list', async (_request, response) => {
    try {
        if (DISCREET_LOGIN) {
            return response.sendStatus(204);
        }

        /** @type {import('../users').User[]} */
        const users = await storage.values(x => x.key.startsWith(KEY_PREFIX));

        /** @type {Promise<import('../users').UserViewModel>[]} */
        const viewModelPromises = users
            .filter(x => x.enabled)
            .map(user => new Promise(async (resolve) => {
                getUserAvatar(user.handle).then(avatar =>
                    resolve({
                        handle: user.handle,
                        name: user.name,
                        created: user.created,
                        avatar: avatar,
                        password: !!user.password,
                    }),
                );
            }));

        const viewModels = await Promise.all(viewModelPromises);
        viewModels.sort((x, y) => (x.created ?? 0) - (y.created ?? 0));
        return response.json(viewModels);
    } catch (error) {
        console.error('User list failed:', error);
        return response.sendStatus(500);
    }
});

router.post('/login', jsonParser, async (request, response) => {
    try {
        if (!request.body.handle) {
            console.log('Login failed: Missing required fields');
            return response.status(400).json({ error: 'Missing required fields' });
        }

        const ip = getIpFromRequest(request);
        await loginLimiter.consume(ip);

        /** @type {import('../users').User} */
        const user = await storage.getItem(toKey(request.body.handle));

        if (!user) {
            console.log('Login failed: User not found');
            return response.status(403).json({ error: 'Incorrect credentials' });
        }

        if (!user.enabled) {
            console.log('Login failed: User is disabled');
            return response.status(403).json({ error: 'User is disabled' });
        }

        if (user.password && user.password !== getPasswordHash(request.body.password, user.salt)) {
            console.log('Login failed: Incorrect password');
            return response.status(403).json({ error: 'Incorrect credentials' });
        }

        if (!request.session) {
            console.error('Session not available');
            return response.sendStatus(500);
        }

        await loginLimiter.delete(ip);
        request.session.handle = user.handle;
        console.log('Login successful:', user.handle, request.session);
        return response.json({ handle: user.handle });
    } catch (error) {
        if (error instanceof RateLimiterRes) {
            console.log('Login failed: Rate limited from', getIpFromRequest(request));
            return response.status(429).send({ error: 'Too many attempts. Try again later or recover your password.' });
        }

        console.error('Login failed:', error);
        return response.sendStatus(500);
    }
});

router.post('/recover-step1', jsonParser, async (request, response) => {
    try {
        if (!request.body.handle) {
            console.log('Recover step 1 failed: Missing required fields');
            return response.status(400).json({ error: 'Missing required fields' });
        }

        const ip = getIpFromRequest(request);
        await recoverLimiter.consume(ip);

        /** @type {import('../users').User} */
        const user = await storage.getItem(toKey(request.body.handle));

        if (!user) {
            console.log('Recover step 1 failed: User not found');
            return response.status(404).json({ error: 'User not found' });
        }

        if (!user.enabled) {
            console.log('Recover step 1 failed: User is disabled');
            return response.status(403).json({ error: 'User is disabled' });
        }

        const mfaCode = String(crypto.randomInt(1000, 9999));
        console.log();
        console.log(color.blue(`${user.name}, your password recovery code is: `) + color.magenta(mfaCode));
        console.log();
        MFA_CACHE.set(user.handle, mfaCode);
        return response.sendStatus(204);
    } catch (error) {
        if (error instanceof RateLimiterRes) {
            console.log('Recover step 1 failed: Rate limited from', getIpFromRequest(request));
            return response.status(429).send({ error: 'Too many attempts. Try again later or contact your admin.' });
        }

        console.error('Recover step 1 failed:', error);
        return response.sendStatus(500);
    }
});

router.post('/recover-step2', jsonParser, async (request, response) => {
    try {
        if (!request.body.handle || !request.body.code) {
            console.log('Recover step 2 failed: Missing required fields');
            return response.status(400).json({ error: 'Missing required fields' });
        }

        /** @type {import('../users').User} */
        const user = await storage.getItem(toKey(request.body.handle));
        const ip = getIpFromRequest(request);

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
            await recoverLimiter.consume(ip);
            console.log('Recover step 2 failed: Incorrect code');
            return response.status(403).json({ error: 'Incorrect code' });
        }

        if (request.body.newPassword) {
            const salt = getPasswordSalt();
            user.password = getPasswordHash(request.body.newPassword, salt);
            user.salt = salt;
            await storage.setItem(toKey(user.handle), user);
        } else {
            user.password = '';
            user.salt = '';
            await storage.setItem(toKey(user.handle), user);
        }

        await recoverLimiter.delete(ip);
        MFA_CACHE.remove(user.handle);
        return response.sendStatus(204);
    } catch (error) {
        if (error instanceof RateLimiterRes) {
            console.log('Recover step 2 failed: Rate limited from', getIpFromRequest(request));
            return response.status(429).send({ error: 'Too many attempts. Try again later or contact your admin.' });
        }

        console.error('Recover step 2 failed:', error);
        return response.sendStatus(500);
    }
});

module.exports = {
    router,
};
