import { promises as fsPromises } from 'node:fs';

import storage from 'node-persist';
import express from 'express';
import lodash from 'lodash';
import { checkForNewContent, CONTENT_TYPES } from './content-manager.js';
import {
    KEY_PREFIX,
    toKey,
    requireMinRole,
    getEffectiveRole,
    hasRole,
    getUserAvatar,
    getAllUserHandles,
    getPasswordSalt,
    getPasswordHash,
    getUserDirectories,
    ensurePublicDirectoriesExist,
} from '../users.js';
import { DEFAULT_USER, ROLES, ROLE_HIERARCHY } from '../constants.js';

export const router = express.Router();

router.post('/get', requireMinRole(ROLES.ADMIN), async (_request, response) => {
    try {
        /** @type {import('../users.js').User[]} */
        const users = await storage.values(x => x.key.startsWith(KEY_PREFIX));

        /** @type {Promise<import('../users.js').UserViewModel>[]} */
        const viewModelPromises = users
            .map(user => new Promise(resolve => {
                getUserAvatar(user.handle).then(avatar =>
                    resolve({
                        handle: user.handle,
                        name: user.name,
                        avatar: avatar,
                        admin: user.admin,
                        role: getEffectiveRole(user),
                        enabled: user.enabled,
                        created: user.created,
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

router.post('/disable', requireMinRole(ROLES.ADMIN), async (request, response) => {
    try {
        if (!request.body.handle) {
            console.warn('Disable user failed: Missing required fields');
            return response.status(400).json({ error: 'Missing required fields' });
        }

        if (request.body.handle === request.user.profile.handle) {
            console.warn('Disable user failed: Cannot disable yourself');
            return response.status(400).json({ error: 'Cannot disable yourself' });
        }

        /** @type {import('../users.js').User} */
        const user = await storage.getItem(toKey(request.body.handle));

        if (!user) {
            console.error('Disable user failed: User not found');
            return response.status(404).json({ error: 'User not found' });
        }

        // Admins cannot disable owners
        if (getEffectiveRole(user) === ROLES.OWNER && getEffectiveRole(request.user.profile) !== ROLES.OWNER) {
            return response.status(403).json({ error: 'Only owners can disable another owner' });
        }

        user.enabled = false;
        await storage.setItem(toKey(request.body.handle), user);
        return response.sendStatus(204);
    } catch (error) {
        console.error('User disable failed:', error);
        return response.sendStatus(500);
    }
});

router.post('/enable', requireMinRole(ROLES.ADMIN), async (request, response) => {
    try {
        if (!request.body.handle) {
            console.warn('Enable user failed: Missing required fields');
            return response.status(400).json({ error: 'Missing required fields' });
        }

        /** @type {import('../users.js').User} */
        const user = await storage.getItem(toKey(request.body.handle));

        if (!user) {
            console.error('Enable user failed: User not found');
            return response.status(404).json({ error: 'User not found' });
        }

        user.enabled = true;
        await storage.setItem(toKey(request.body.handle), user);
        return response.sendStatus(204);
    } catch (error) {
        console.error('User enable failed:', error);
        return response.sendStatus(500);
    }
});

/** @deprecated Use /set-role instead. */
router.post('/promote', requireMinRole(ROLES.ADMIN), async (request, response) => {
    try {
        if (!request.body.handle) {
            console.warn('Promote user failed: Missing required fields');
            return response.status(400).json({ error: 'Missing required fields' });
        }

        /** @type {import('../users.js').User} */
        const user = await storage.getItem(toKey(request.body.handle));

        if (!user) {
            console.error('Promote user failed: User not found');
            return response.status(404).json({ error: 'User not found' });
        }

        user.admin = true;
        user.role = ROLES.ADMIN;
        await storage.setItem(toKey(request.body.handle), user);
        return response.sendStatus(204);
    } catch (error) {
        console.error('User promote failed:', error);
        return response.sendStatus(500);
    }
});

/** @deprecated Use /set-role instead. */
router.post('/demote', requireMinRole(ROLES.ADMIN), async (request, response) => {
    try {
        if (!request.body.handle) {
            console.warn('Demote user failed: Missing required fields');
            return response.status(400).json({ error: 'Missing required fields' });
        }

        if (request.body.handle === request.user.profile.handle) {
            console.warn('Demote user failed: Cannot demote yourself');
            return response.status(400).json({ error: 'Cannot demote yourself' });
        }

        /** @type {import('../users.js').User} */
        const user = await storage.getItem(toKey(request.body.handle));

        if (!user) {
            console.error('Demote user failed: User not found');
            return response.status(404).json({ error: 'User not found' });
        }

        user.admin = false;
        user.role = ROLES.END_USER;
        await storage.setItem(toKey(request.body.handle), user);
        return response.sendStatus(204);
    } catch (error) {
        console.error('User demote failed:', error);
        return response.sendStatus(500);
    }
});

router.post('/create', requireMinRole(ROLES.ADMIN), async (request, response) => {
    try {
        if (!request.body.handle || !request.body.name) {
            console.warn('Create user failed: Missing required fields');
            return response.status(400).json({ error: 'Missing required fields' });
        }

        const handles = await getAllUserHandles();
        const handle = lodash.kebabCase(String(request.body.handle).toLowerCase().trim());

        if (!handle) {
            console.warn('Create user failed: Invalid handle');
            return response.status(400).json({ error: 'Invalid handle' });
        }

        if (handles.some(x => x === handle)) {
            console.warn('Create user failed: User with that handle already exists');
            return response.status(409).json({ error: 'User already exists' });
        }

        const salt = getPasswordSalt();
        const password = request.body.password ? getPasswordHash(request.body.password, salt) : '';

        // Determine role: accept from request body, fall back to legacy admin flag, default to end_user
        let newRole = request.body.role || (request.body.admin ? ROLES.ADMIN : ROLES.END_USER);
        if (!ROLE_HIERARCHY.includes(newRole)) {
            newRole = ROLES.END_USER;
        }

        // Non-owners cannot create users with admin or owner roles
        const actorRole = getEffectiveRole(request.user.profile);
        if (actorRole !== ROLES.OWNER && hasRole(newRole, ROLES.ADMIN)) {
            newRole = ROLES.END_USER;
        }

        const newUser = {
            handle: handle,
            name: request.body.name || 'Anonymous',
            created: Date.now(),
            password: password,
            salt: salt,
            admin: hasRole(newRole, ROLES.ADMIN),
            role: newRole,
            enabled: true,
        };

        await storage.setItem(toKey(handle), newUser);

        // Create user directories
        console.info('Creating data directories for', newUser.handle);
        await ensurePublicDirectoriesExist();
        const directories = getUserDirectories(newUser.handle);
        await checkForNewContent([directories], [CONTENT_TYPES.SETTINGS]);
        return response.json({ handle: newUser.handle });
    } catch (error) {
        console.error('User create failed:', error);
        return response.sendStatus(500);
    }
});

router.post('/delete', requireMinRole(ROLES.ADMIN), async (request, response) => {
    try {
        if (!request.body.handle) {
            console.warn('Delete user failed: Missing required fields');
            return response.status(400).json({ error: 'Missing required fields' });
        }

        if (request.body.handle === request.user.profile.handle) {
            console.warn('Delete user failed: Cannot delete yourself');
            return response.status(400).json({ error: 'Cannot delete yourself' });
        }

        if (request.body.handle === DEFAULT_USER.handle) {
            console.warn('Delete user failed: Cannot delete default user');
            return response.status(400).json({ error: 'Sorry, but the default user cannot be deleted. It is required as a fallback.' });
        }

        // Admins cannot delete owners
        /** @type {import('../users.js').User} */
        const targetUser = await storage.getItem(toKey(request.body.handle));
        if (targetUser && getEffectiveRole(targetUser) === ROLES.OWNER && getEffectiveRole(request.user.profile) !== ROLES.OWNER) {
            return response.status(403).json({ error: 'Only owners can delete another owner' });
        }

        await storage.removeItem(toKey(request.body.handle));

        if (request.body.purge) {
            const directories = getUserDirectories(request.body.handle);
            console.info('Deleting data directories for', request.body.handle);
            await fsPromises.rm(directories.root, { recursive: true, force: true });
        }

        return response.sendStatus(204);
    } catch (error) {
        console.error('User delete failed:', error);
        return response.sendStatus(500);
    }
});

router.post('/slugify', requireMinRole(ROLES.ADMIN), async (request, response) => {
    try {
        if (!request.body.text) {
            console.warn('Slugify failed: Missing required fields');
            return response.status(400).json({ error: 'Missing required fields' });
        }

        const text = lodash.kebabCase(String(request.body.text).toLowerCase().trim());

        return response.send(text);
    } catch (error) {
        console.error('Slugify failed:', error);
        return response.sendStatus(500);
    }
});

router.post('/set-role', requireMinRole(ROLES.ADMIN), async (request, response) => {
    try {
        if (!request.body.handle || !request.body.role) {
            console.warn('Set role failed: Missing required fields');
            return response.status(400).json({ error: 'Missing required fields' });
        }

        const newRole = request.body.role;
        if (!ROLE_HIERARCHY.includes(newRole)) {
            return response.status(400).json({ error: 'Invalid role' });
        }

        if (request.body.handle === request.user.profile.handle) {
            console.warn('Set role failed: Cannot change your own role');
            return response.status(400).json({ error: 'Cannot change your own role' });
        }

        const actorRole = getEffectiveRole(request.user.profile);

        // Only owners can assign the owner role
        if (newRole === ROLES.OWNER && actorRole !== ROLES.OWNER) {
            return response.status(403).json({ error: 'Only owners can assign the owner role' });
        }

        // Admins cannot assign admin or higher roles
        if (actorRole === ROLES.ADMIN && hasRole(newRole, ROLES.ADMIN)) {
            return response.status(403).json({ error: 'Admins cannot assign admin or owner roles' });
        }

        /** @type {import('../users.js').User} */
        const user = await storage.getItem(toKey(request.body.handle));

        if (!user) {
            return response.status(404).json({ error: 'User not found' });
        }

        // Only owners can change the role of another owner
        const targetCurrentRole = getEffectiveRole(user);
        if (targetCurrentRole === ROLES.OWNER && actorRole !== ROLES.OWNER) {
            return response.status(403).json({ error: 'Only owners can modify another owner' });
        }

        user.role = newRole;
        user.admin = hasRole(newRole, ROLES.ADMIN);
        await storage.setItem(toKey(request.body.handle), user);
        return response.sendStatus(204);
    } catch (error) {
        console.error('Set role failed:', error);
        return response.sendStatus(500);
    }
});
