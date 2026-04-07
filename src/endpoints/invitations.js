import { randomUUID, randomBytes } from 'node:crypto';

import storage from 'node-persist';
import express from 'express';
import lodash from 'lodash';

import { checkForNewContent, CONTENT_TYPES } from './content-manager.js';
import {
    toKey,
    requireMinRole,
    getEffectiveRole,
    hasRole,
    getAllUserHandles,
    getPasswordSalt,
    getPasswordHash,
    getUserDirectories,
    ensurePublicDirectoriesExist,
} from '../users.js';
import { ROLES, ROLE_HIERARCHY } from '../constants.js';

export const router = express.Router();

const INVITE_PREFIX = 'invite:';

/**
 * @typedef {object} Invitation
 * @property {string} id
 * @property {string} token
 * @property {string} role
 * @property {string} label
 * @property {string} createdBy
 * @property {number} createdAt
 * @property {number|null} expiresAt
 * @property {string|null} usedBy
 * @property {number|null} usedAt
 * @property {'pending'|'accepted'|'revoked'} status
 */

/**
 * @param {string} id
 * @returns {string}
 */
function inviteKey(id) {
    return `${INVITE_PREFIX}${id}`;
}

/**
 * @returns {Promise<Invitation[]>}
 */
async function getAllInvitations() {
    return storage.values(x => x.key.startsWith(INVITE_PREFIX));
}

// POST /api/invitations/create — admin+
router.post('/create', requireMinRole(ROLES.ADMIN), async (request, response) => {
    try {
        const actorRole = getEffectiveRole(request.user.profile);

        let role = request.body.role || ROLES.END_USER;
        if (!ROLE_HIERARCHY.includes(role)) {
            role = ROLES.END_USER;
        }
        // Non-owners cannot create invites for admin/owner roles
        if (actorRole !== ROLES.OWNER && hasRole(role, ROLES.ADMIN)) {
            role = ROLES.END_USER;
        }

        const label = String(request.body.label || '').trim().slice(0, 200);
        const expiresIn = request.body.expiresIn; // hours, optional
        const expiresAt = expiresIn ? Date.now() + Number(expiresIn) * 60 * 60 * 1000 : null;

        /** @type {Invitation} */
        const invite = {
            id: randomUUID(),
            token: randomBytes(32).toString('hex'),
            role,
            label,
            createdBy: request.user.profile.handle,
            createdAt: Date.now(),
            expiresAt,
            usedBy: null,
            usedAt: null,
            status: 'pending',
        };

        await storage.setItem(inviteKey(invite.id), invite);
        return response.json(invite);
    } catch (error) {
        console.error('Create invitation failed:', error);
        return response.sendStatus(500);
    }
});

// POST /api/invitations/list — admin+
router.post('/list', requireMinRole(ROLES.ADMIN), async (_request, response) => {
    try {
        const invites = await getAllInvitations();
        // Sort newest first
        invites.sort((a, b) => b.createdAt - a.createdAt);
        return response.json(invites);
    } catch (error) {
        console.error('List invitations failed:', error);
        return response.sendStatus(500);
    }
});

// POST /api/invitations/revoke — admin+
router.post('/revoke', requireMinRole(ROLES.ADMIN), async (request, response) => {
    try {
        const { id } = request.body;
        if (!id) {
            return response.status(400).json({ error: 'Missing id' });
        }

        /** @type {Invitation|undefined} */
        const invite = await storage.getItem(inviteKey(id));
        if (!invite) {
            return response.status(404).json({ error: 'Invitation not found' });
        }
        if (invite.status !== 'pending') {
            return response.status(409).json({ error: `Invitation is already ${invite.status}` });
        }

        invite.status = 'revoked';
        await storage.setItem(inviteKey(id), invite);
        return response.json(invite);
    } catch (error) {
        console.error('Revoke invitation failed:', error);
        return response.sendStatus(500);
    }
});

// GET /api/invitations/validate/:token — public
router.get('/validate/:token', async (request, response) => {
    try {
        const { token } = request.params;
        const invites = await getAllInvitations();
        const invite = invites.find(i => i.token === token);

        if (!invite) {
            return response.status(404).json({ valid: false, error: 'Invalid invite link' });
        }
        if (invite.status !== 'pending') {
            return response.status(410).json({ valid: false, error: `Invitation has been ${invite.status}` });
        }
        if (invite.expiresAt && Date.now() > invite.expiresAt) {
            return response.status(410).json({ valid: false, error: 'Invitation has expired' });
        }

        return response.json({
            valid: true,
            role: invite.role,
            label: invite.label,
        });
    } catch (error) {
        console.error('Validate invitation failed:', error);
        return response.sendStatus(500);
    }
});

// POST /api/invitations/accept — public (no session required)
router.post('/accept', async (request, response) => {
    try {
        const { token, handle: rawHandle, name: rawName, password } = request.body;
        if (!token || !rawHandle || !rawName) {
            return response.status(400).json({ error: 'Missing required fields' });
        }

        // Validate the token
        const invites = await getAllInvitations();
        const invite = invites.find(i => i.token === token);

        if (!invite) {
            return response.status(404).json({ error: 'Invalid invite link' });
        }
        if (invite.status !== 'pending') {
            return response.status(410).json({ error: `Invitation has been ${invite.status}` });
        }
        if (invite.expiresAt && Date.now() > invite.expiresAt) {
            return response.status(410).json({ error: 'Invitation has expired' });
        }

        // Normalise handle
        const handle = lodash.kebabCase(String(rawHandle).toLowerCase().trim());
        if (!handle) {
            return response.status(400).json({ error: 'Invalid handle' });
        }

        const handles = await getAllUserHandles();
        if (handles.some(h => h === handle)) {
            return response.status(409).json({ error: 'Username already taken' });
        }

        const salt = getPasswordSalt();
        const passwordHash = password ? getPasswordHash(password, salt) : '';

        const newUser = {
            handle,
            name: String(rawName).trim().slice(0, 100) || 'Anonymous',
            created: Date.now(),
            password: passwordHash,
            salt,
            admin: hasRole(invite.role, ROLES.ADMIN),
            role: invite.role,
            enabled: true,
        };

        await storage.setItem(toKey(handle), newUser);

        // Create user directories
        console.info('Creating data directories for', handle, '(invited by', invite.createdBy, ')');
        await ensurePublicDirectoriesExist();
        const directories = getUserDirectories(handle);
        await checkForNewContent([directories], [CONTENT_TYPES.SETTINGS]);

        // Mark invite as used
        invite.status = 'accepted';
        invite.usedBy = handle;
        invite.usedAt = Date.now();
        await storage.setItem(inviteKey(invite.id), invite);

        return response.json({ handle });
    } catch (error) {
        console.error('Accept invitation failed:', error);
        return response.sendStatus(500);
    }
});
