import fs from 'node:fs';
import path from 'node:path';

import express from 'express';
import sanitize from 'sanitize-filename';
import _ from 'lodash';
import { sync as writeFileAtomicSync } from 'write-file-atomic';
import { tryParse } from '../util.js';
import { getAllUserHandles, getUserDirectories, getAllEnabledUsers } from '../users.js';
import { findCharactersByWorld } from './characters.js';
import { read as readCharacterCard, write as writeCharacterCard } from '../character-card-parser.js';

// ────────────────────────────────────────────────────────
// Push manifest – tracks which files were pushed to whom
// so edits can be synced back automatically.
// Stored at  data/{handle}/push-manifest.json
// ────────────────────────────────────────────────────────

/**
 * Returns the path to a user's push manifest file.
 * @param {string} handle User handle
 * @returns {string}
 */
function getPushManifestPath(handle) {
    const dirs = getUserDirectories(handle);
    // dirs.root is  data/{handle}  — go one level up from any sub-dir
    return path.join(path.dirname(dirs.worlds), 'push-manifest.json');
}

/**
 * Read the push manifest for a creator. Returns [] if missing/corrupt.
 * @param {string} handle Creator handle
 * @returns {Array<{source_lorebook:string, pushed_lorebook_name:string, character_files:string[], recipients:string[]}>}
 */
export function readPushManifest(handle) {
    try {
        const p = getPushManifestPath(handle);
        if (!fs.existsSync(p)) return [];
        return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {
        return [];
    }
}

/**
 * Write the push manifest for a creator.
 * @param {string} handle Creator handle
 * @param {Array} records Manifest records
 */
function writePushManifest(handle, records) {
    const p = getPushManifestPath(handle);
    writeFileAtomicSync(p, JSON.stringify(records, null, 2));
}

/**
 * Merge a new push into the manifest.
 * If a record with the same pushed_lorebook_name already exists, its
 * recipients list is extended (de-duped).  Otherwise a new entry is added.
 * @param {string} creatorHandle
 * @param {{source_lorebook:string, pushed_lorebook_name:string, character_files:string[], recipients:string[]}} record
 */
function recordPush(creatorHandle, record) {
    if (!record.recipients || record.recipients.length === 0) return;
    const manifest = readPushManifest(creatorHandle);
    const existing = manifest.find(r => r.pushed_lorebook_name === record.pushed_lorebook_name);
    if (existing) {
        const set = new Set(existing.recipients);
        for (const h of record.recipients) set.add(h);
        existing.recipients = [...set];
        // Also merge any new character files
        const charSet = new Set(existing.character_files);
        for (const f of record.character_files) charSet.add(f);
        existing.character_files = [...charSet];
    } else {
        manifest.push(record);
    }
    writePushManifest(creatorHandle, manifest);
}

/**
 * Write a push notification file for a recipient user.
 * The client polls /api/worldinfo/push-notifications to pick these up.
 * @param {string} handle Recipient user handle
 * @param {string} message Notification message
 */
function writePushNotification(handle, message) {
    try {
        const userDirs = getUserDirectories(handle);
        const notifDir = path.join(path.dirname(userDirs.worlds), 'push-notifications');
        if (!fs.existsSync(notifDir)) fs.mkdirSync(notifDir, { recursive: true });
        const notifFile = path.join(notifDir, `${Date.now()}.json`);
        writeFileAtomicSync(notifFile, JSON.stringify({ message, ts: Date.now() }));
    } catch (err) {
        console.warn(`[Push] Failed to write notification for ${handle}:`, err.message);
    }
}

/**
 * Reads a World Info file and returns its contents
 * @param {import('../users.js').UserDirectoryList} directories User directories
 * @param {string} worldInfoName Name of the World Info file
 * @param {boolean} allowDummy If true, returns an empty object if the file doesn't exist
 * @returns {object} World Info file contents
 */
export function readWorldInfoFile(directories, worldInfoName, allowDummy) {
    const dummyObject = allowDummy ? { entries: {} } : null;

    if (!worldInfoName) {
        return dummyObject;
    }

    const filename = sanitize(`${worldInfoName}.json`);
    const pathToWorldInfo = path.join(directories.worlds, filename);

    if (!fs.existsSync(pathToWorldInfo)) {
        console.error(`World info file ${filename} doesn't exist.`);
        return dummyObject;
    }

    const worldInfoText = fs.readFileSync(pathToWorldInfo, 'utf8');
    const worldInfo = JSON.parse(worldInfoText);
    return worldInfo;
}

/**
 * Checks if a lorebook is locked and the user lacks permission to modify it.
 * @param {string} filePath Path to the world info JSON file
 * @param {object} userProfile User profile object
 * @returns {{ locked: boolean, reason?: string }}
 */
function checkLock(filePath, userProfile) {
    if (!fs.existsSync(filePath)) return { locked: false };

    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const ext = data?.extensions || {};

        if (!ext.dreamtavern_locked) return { locked: false };

        // Admin can always edit
        if (userProfile?.admin) return { locked: false };

        // Creator can edit their own
        if (ext.dreamtavern_creator === userProfile?.handle) return { locked: false };

        return { locked: true, reason: 'This lorebook is locked. Only the creator or an admin can modify it.' };
    } catch {
        return { locked: false };
    }
}

export const router = express.Router();

router.post('/list', async (request, response) => {
    try {
        const data = [];
        const jsonFiles = (await fs.promises.readdir(request.user.directories.worlds, { withFileTypes: true }))
            .filter((file) => file.isFile() && path.extname(file.name).toLowerCase() === '.json')
            .sort((a, b) => a.name.localeCompare(b.name));

        for (const file of jsonFiles) {
            try {
                const filePath = path.join(request.user.directories.worlds, file.name);
                const fileContents = await fs.promises.readFile(filePath, 'utf8');
                const fileContentsParsed = tryParse(fileContents) || {};
                const fileExtensions = fileContentsParsed?.extensions || {};
                const fileNameWithoutExt = path.parse(file.name).name;
                const fileData = {
                    file_id: fileNameWithoutExt,
                    name: fileContentsParsed?.name || fileNameWithoutExt,
                    extensions: _.isObjectLike(fileExtensions) ? fileExtensions : {},
                };
                data.push(fileData);
            } catch (err) {
                console.warn(`Error reading or parsing World Info file ${file.name}:`, err);
            }
        }

        // Hide pushed lorebooks from non-admin/non-creator users
        // ADMIN-* → hidden from all non-admins
        // dd-{handle}-* → visible only to that handle + admins
        // dreamtavern_hidden flag → visible only to creator + admins
        const isAdmin = request.user.profile?.admin;
        const userHandle = request.user.profile?.handle;
        const filtered = data.filter(entry => {
            if (isAdmin) return true;

            const fileId = entry.file_id || '';

            // ADMIN-* lorebooks: hidden from ALL non-admin users
            if (fileId.startsWith('ADMIN-')) return false;

            // dd-{handle}-* lorebooks: visible only to that handle
            if (fileId.startsWith('dd-')) {
                const parts = fileId.split('-');
                const creatorHandle = parts[1];
                if (creatorHandle === userHandle) return true;
                return false;
            }

            // Also check the internal flag
            if (!entry.extensions?.dreamtavern_hidden) return true;
            if (entry.extensions?.dreamtavern_creator === userHandle) return true;
            return false;
        });

        return response.send(filtered);
    } catch (err) {
        console.error('Error reading World Info directory:', err);
        return response.sendStatus(500);
    }
});

router.post('/get', (request, response) => {
    if (!request.body?.name) {
        return response.sendStatus(400);
    }

    const file = readWorldInfoFile(request.user.directories, request.body.name, true);

    // If lorebook is hidden and user is not admin or creator,
    // still return data (needed for character generation) but mark as restricted
    if (file?.extensions?.dreamtavern_hidden) {
        const userIsAdmin = request.user.profile?.admin;
        const userHandle = request.user.profile?.handle;
        const creator = file.extensions.dreamtavern_creator;
        if (!userIsAdmin && userHandle !== creator) {
            file._dreamtavern_restricted = true;
        }
    }

    return response.send(file);
});

router.post('/delete', (request, response) => {
    if (!request.body?.name) {
        return response.sendStatus(400);
    }

    const worldInfoName = request.body.name;
    const filename = sanitize(`${worldInfoName}.json`);
    const pathToWorldInfo = path.join(request.user.directories.worlds, filename);

    if (!fs.existsSync(pathToWorldInfo)) {
        throw new Error(`World info file ${filename} doesn't exist.`);
    }

    // Lock check
    const lock = checkLock(pathToWorldInfo, request.user.profile);
    if (lock.locked) {
        return response.status(403).send(lock.reason);
    }

    fs.unlinkSync(pathToWorldInfo);

    return response.sendStatus(200);
});

router.post('/import', (request, response) => {
    if (!request.file) return response.sendStatus(400);

    const filename = `${path.parse(sanitize(request.file.originalname)).name}.json`;

    let fileContents = null;

    if (request.body.convertedData) {
        fileContents = request.body.convertedData;
    } else {
        const pathToUpload = path.join(request.file.destination, request.file.filename);
        fileContents = fs.readFileSync(pathToUpload, 'utf8');
        fs.unlinkSync(pathToUpload);
    }

    try {
        const worldContent = JSON.parse(fileContents);
        if (!('entries' in worldContent)) {
            throw new Error('File must contain a world info entries list');
        }
    } catch (err) {
        return response.status(400).send('Is not a valid world info file');
    }

    const pathToNewFile = path.join(request.user.directories.worlds, filename);
    const worldName = path.parse(pathToNewFile).name;

    if (!worldName) {
        return response.status(400).send('World file must have a name');
    }

    writeFileAtomicSync(pathToNewFile, fileContents);
    return response.send({ name: worldName });
});

router.post('/edit', (request, response) => {
    if (!request.body) {
        return response.sendStatus(400);
    }

    if (!request.body.name) {
        return response.status(400).send('World file must have a name');
    }

    try {
        if (!('entries' in request.body.data)) {
            throw new Error('World info must contain an entries list');
        }
    } catch (err) {
        return response.status(400).send('Is not a valid world info file');
    }

    const filename = sanitize(`${request.body.name}.json`);
    const pathToFile = path.join(request.user.directories.worlds, filename);

    // Lock check
    const lock = checkLock(pathToFile, request.user.profile);
    if (lock.locked) {
        return response.status(403).send(lock.reason);
    }

    writeFileAtomicSync(pathToFile, JSON.stringify(request.body.data, null, 4));

    // ── One-way lorebook sync (fire-and-forget) ──
    // If this user has pushed this lorebook before, propagate the edit
    // to every recipient who still has the file.
    const lorebookName = request.body.name;
    const creatorHandle = request.user.profile.handle;
    setImmediate(() => {
        try {
            const manifest = readPushManifest(creatorHandle);
            const records = manifest.filter(r => r.source_lorebook === lorebookName);
            if (records.length === 0) return;

            for (const record of records) {
                const pushedFilename = sanitize(`${record.pushed_lorebook_name}.json`);
                for (const recipient of record.recipients) {
                    try {
                        const recipDirs = getUserDirectories(recipient);
                        const destPath = path.join(recipDirs.worlds, pushedFilename);
                        if (!fs.existsSync(destPath)) continue; // user deleted it

                        // Build updated copy: creator's data + preserved lock metadata
                        const synced = JSON.parse(JSON.stringify(request.body.data));
                        if (!synced.extensions) synced.extensions = {};
                        synced.extensions.dreamtavern_locked = true;
                        synced.extensions.dreamtavern_hidden = true;
                        synced.extensions.dreamtavern_creator = creatorHandle;

                        writeFileAtomicSync(destPath, JSON.stringify(synced, null, 4));
                    } catch (e) {
                        console.warn(`[Sync] Lorebook sync to ${recipient} failed:`, e.message);
                    }
                }
            }
            console.log(`[Sync] Lorebook "${lorebookName}" synced to recipients`);
        } catch (err) {
            console.warn('[Sync] Lorebook sync error:', err.message);
        }
    });

    return response.send({ ok: true });
});

// Push lorebook + associated character(s) to target users
// Admin can push to anyone; regular users can only push to admin(s)
router.post('/push', async (request, response) => {
    const { name, targets, charLabel } = request.body;
    const isAdmin = request.user.profile?.admin;

    if (!name) {
        return response.status(400).send('Lorebook name is required');
    }

    // Read source lorebook
    const sourceFilename = sanitize(`${name}.json`);
    const sourcePath = path.join(request.user.directories.worlds, sourceFilename);

    if (!fs.existsSync(sourcePath)) {
        return response.status(404).send('Lorebook not found in your collection');
    }

    // Parse lorebook and add lock metadata
    const lorebookData = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
    if (!lorebookData.extensions) lorebookData.extensions = {};
    lorebookData.extensions.dreamtavern_locked = true;
    lorebookData.extensions.dreamtavern_hidden = true;

    // Determine if this is a user-pushed lorebook (dd-{handle}-{name}) being re-pushed by admin.
    // If so, preserve the original creator and dd-* naming. Otherwise set admin as creator.
    const isUserPushedBook = name.startsWith('dd-');
    if (!isUserPushedBook || !lorebookData.extensions.dreamtavern_creator) {
        lorebookData.extensions.dreamtavern_creator = request.user.profile.handle;
    }
    // The "real" creator for character stamps — the original user for dd-* books, admin for admin's own
    const effectiveCreator = lorebookData.extensions.dreamtavern_creator;

    // Find characters that reference this lorebook
    const characterFiles = await findCharactersByWorld(request.user.directories, name);

    // Build the new lorebook name based on who is pushing:
    //   Admin pushing own book  → ADMIN-{BookName}       (hidden from all non-admins)
    //   Admin pushing dd-* book → dd-{USERHANDLE}-{Name}  (keep original naming)
    //   User  → admin           → dd-{USERHANDLE}-{Name}  (only creator + admin can see/edit)
    const creatorHandle = request.user.profile.handle;
    const labelToUse = charLabel || name;
    let newLorebookName;
    if (isAdmin) {
        // If the lorebook is already a dd-* (user sent it to admin), keep the dd-* name as-is
        newLorebookName = isUserPushedBook ? name : `ADMIN-${labelToUse}`;
    } else {
        newLorebookName = `dd-${creatorHandle}-${labelToUse}`;
    }
    const newLorebookFilename = sanitize(`${newLorebookName}.json`);
    const lockedContents = JSON.stringify(lorebookData, null, 4);

    // Determine target handles
    let targetHandles;
    if (targets === 'all') {
        targetHandles = await getAllUserHandles();
        targetHandles = targetHandles.filter(h => h !== request.user.profile.handle);
    } else if (Array.isArray(targets)) {
        targetHandles = targets;
    } else {
        return response.status(400).send('targets must be "all" or an array of handles');
    }

    // Non-admin users can ONLY push to admin accounts
    if (!isAdmin) {
        const allUsers = await getAllEnabledUsers();
        const adminHandles = allUsers.filter(u => u.admin).map(u => u.handle);
        const invalidTargets = targetHandles.filter(h => !adminHandles.includes(h));
        if (invalidTargets.length > 0) {
            return response.status(403).send('Non-admin users can only push to admin accounts');
        }
    }

    const results = { pushed: [], updated: [], skipped: [], failed: [], characters_pushed: [] };

    for (const handle of targetHandles) {
        try {
            const userDirs = getUserDirectories(handle);

            // Push lorebook with renamed filename (overwrite if already exists)
            if (!fs.existsSync(userDirs.worlds)) {
                fs.mkdirSync(userDirs.worlds, { recursive: true });
            }
            const destLorebook = path.join(userDirs.worlds, newLorebookFilename);
            const alreadyExists = fs.existsSync(destLorebook);
            writeFileAtomicSync(destLorebook, lockedContents);
            if (alreadyExists) {
                results.updated.push(handle);
            } else {
                results.pushed.push(handle);
            }

            // Push character(s) with updated world reference (overwrite if already exists)
            // This only overwrites the character card PNG — chat files and memories are untouched.
            if (characterFiles.length > 0) {
                if (!fs.existsSync(userDirs.characters)) {
                    fs.mkdirSync(userDirs.characters, { recursive: true });
                }
                for (const charFile of characterFiles) {
                    const srcChar = path.join(request.user.directories.characters, charFile);
                    const destChar = path.join(userDirs.characters, charFile);
                    if (fs.existsSync(srcChar)) {
                        try {
                            // Read source character, update world reference + push metadata
                            const pngBuffer = fs.readFileSync(srcChar);
                            const charDataStr = readCharacterCard(pngBuffer);
                            const charData = JSON.parse(charDataStr);
                            if (charData?.data?.extensions) {
                                charData.data.extensions.world = newLorebookName;
                                charData.data.extensions.dreamtavern_pushed = true;
                                charData.data.extensions.dreamtavern_creator = effectiveCreator;
                            }

                            // If recipient already has this character, preserve their
                            // avatar image (they may have customised it) and only
                            // update the embedded JSON metadata.
                            const basePng = fs.existsSync(destChar)
                                ? fs.readFileSync(destChar)
                                : pngBuffer;
                            const modifiedPng = writeCharacterCard(basePng, JSON.stringify(charData));
                            fs.writeFileSync(destChar, modifiedPng);
                        } catch (charErr) {
                            console.warn(`[Push] Could not update world ref for ${charFile}, copying as-is:`, charErr.message);
                            fs.copyFileSync(srcChar, destChar);
                        }
                        results.characters_pushed.push(`${handle}/${charFile}`);
                    }
                }
            }
        } catch (err) {
            console.error(`[Push] Failed to push "${name}" to ${handle}:`, err);
            results.failed.push(handle);
        }
    }

    // Record in push manifest for future one-way sync
    try {
        recordPush(creatorHandle, {
            source_lorebook: name,
            pushed_lorebook_name: newLorebookName,
            character_files: characterFiles,
            recipients: [...results.pushed, ...results.updated],
        });
    } catch (mErr) {
        console.warn('[Push] Failed to write push manifest:', mErr.message);
    }

    console.log(`[Push] ${request.user.profile.handle} pushed "${name}" (+ ${characterFiles.length} character(s)) → ${results.pushed.length} new, ${results.updated.length} updated, ${results.failed.length} failed`);

    // Notify recipients who received new characters
    if (characterFiles.length > 0) {
        for (const handle of [...results.pushed, ...results.updated]) {
            writePushNotification(handle, 'New character added! Please refresh your browser 😊');
        }
    }
    return response.send(results);
});

// Bulk-push 1-10 lorebook-embedded characters to ALL other users (admin only)
router.post('/bulk-push', async (request, response) => {
    if (!request.user.profile?.admin) {
        return response.status(403).send('Bulk push is admin-only');
    }

    const { lorebooks, targets } = request.body;
    if (!Array.isArray(lorebooks) || lorebooks.length < 1 || lorebooks.length > 10) {
        return response.status(400).send('Provide an array of 1-10 lorebook names');
    }

    const creatorHandle = request.user.profile.handle;

    // Resolve target users: use provided targets array, or fall back to all other users
    let targetHandles;
    try {
        if (Array.isArray(targets) && targets.length > 0) {
            // Use admin-selected targets, but always exclude self
            targetHandles = targets.filter(h => h !== creatorHandle);
        } else {
            // Default: all other users on the server
            targetHandles = await getAllUserHandles();
            targetHandles = targetHandles.filter(h => h !== creatorHandle);
        }
    } catch {
        return response.status(500).send('Failed to resolve user list');
    }

    if (targetHandles.length === 0) {
        return response.status(400).send('No target users selected');
    }

    const allResults = [];

    for (const lorebookName of lorebooks) {
        const result = { lorebook: lorebookName, pushed: [], updated: [], failed: [], characters_pushed: [] };

        try {
            // Read source lorebook
            const sourceFilename = sanitize(`${lorebookName}.json`);
            const sourcePath = path.join(request.user.directories.worlds, sourceFilename);
            if (!fs.existsSync(sourcePath)) {
                result.failed = [`Source lorebook "${lorebookName}" not found`];
                allResults.push(result);
                continue;
            }

            const lorebookData = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
            if (!lorebookData.extensions) lorebookData.extensions = {};
            lorebookData.extensions.dreamtavern_locked = true;
            lorebookData.extensions.dreamtavern_hidden = true;

            // If this is a user-pushed lorebook (dd-*) being re-pushed by admin,
            // preserve the original creator. Otherwise set admin as creator.
            const isUserPushedBook = lorebookName.startsWith('dd-');
            if (!isUserPushedBook || !lorebookData.extensions.dreamtavern_creator) {
                lorebookData.extensions.dreamtavern_creator = creatorHandle;
            }
            const effectiveCreator = lorebookData.extensions.dreamtavern_creator;

            // Find linked characters
            const characterFiles = await findCharactersByWorld(request.user.directories, lorebookName);

            // Build pushed lorebook name:
            //   dd-* lorebooks (user-sent) → keep the dd-{handle}-{name} as-is
            //   Admin's own lorebooks      → ADMIN-{name}
            const pushedLorebookName = isUserPushedBook ? lorebookName : `ADMIN-${lorebookName}`;
            const pushedFilename = sanitize(`${pushedLorebookName}.json`);
            const lockedContents = JSON.stringify(lorebookData, null, 4);

            for (const handle of targetHandles) {
                try {
                    const userDirs = getUserDirectories(handle);

                    // Push lorebook (overwrite if already exists — chat files & memories are untouched)
                    if (!fs.existsSync(userDirs.worlds)) {
                        fs.mkdirSync(userDirs.worlds, { recursive: true });
                    }
                    const destLorebook = path.join(userDirs.worlds, pushedFilename);
                    const alreadyExists = fs.existsSync(destLorebook);
                    writeFileAtomicSync(destLorebook, lockedContents);
                    if (alreadyExists) {
                        result.updated.push(handle);
                    } else {
                        result.pushed.push(handle);
                    }

                    // Push character PNGs (overwrite if already exists — only the card PNG, not chats/memories)
                    if (characterFiles.length > 0) {
                        if (!fs.existsSync(userDirs.characters)) {
                            fs.mkdirSync(userDirs.characters, { recursive: true });
                        }
                        for (const charFile of characterFiles) {
                            const srcChar = path.join(request.user.directories.characters, charFile);
                            const destChar = path.join(userDirs.characters, charFile);
                            if (fs.existsSync(srcChar)) {
                                try {
                                    const pngBuffer = fs.readFileSync(srcChar);
                                    const charDataStr = readCharacterCard(pngBuffer);
                                    const charData = JSON.parse(charDataStr);
                                    if (charData?.data?.extensions) {
                                        charData.data.extensions.world = pushedLorebookName;
                                        charData.data.extensions.dreamtavern_pushed = true;
                                        charData.data.extensions.dreamtavern_creator = effectiveCreator;
                                    }

                                    // If recipient already has this character, preserve their
                                    // avatar image (they may have customised it) and only
                                    // update the embedded JSON metadata.
                                    const basePng = fs.existsSync(destChar)
                                        ? fs.readFileSync(destChar)
                                        : pngBuffer;
                                    const modifiedPng = writeCharacterCard(basePng, JSON.stringify(charData));
                                    fs.writeFileSync(destChar, modifiedPng);
                                } catch (charErr) {
                                    console.warn(`[BulkPush] Could not update world ref for ${charFile}, copying as-is:`, charErr.message);
                                    fs.copyFileSync(srcChar, destChar);
                                }
                                result.characters_pushed.push(`${handle}/${charFile}`);
                            }
                        }
                    }
                } catch (err) {
                    console.error(`[BulkPush] Failed to push "${lorebookName}" to ${handle}:`, err);
                    result.failed.push(handle);
                }
            }

            // Record in push manifest (include both new + updated recipients)
            try {
                recordPush(creatorHandle, {
                    source_lorebook: lorebookName,
                    pushed_lorebook_name: pushedLorebookName,
                    character_files: characterFiles,
                    recipients: [...result.pushed, ...result.updated],
                });
            } catch (mErr) {
                console.warn('[BulkPush] Failed to write manifest:', mErr.message);
            }
        } catch (err) {
            console.error(`[BulkPush] Error processing lorebook "${lorebookName}":`, err);
            result.failed.push('internal error');
        }

        allResults.push(result);
    }

    console.log(`[BulkPush] Admin "${creatorHandle}" bulk-pushed ${lorebooks.length} lorebook(s) to ${targetHandles.length} user(s)`);

    // Notify all recipients who received new or updated characters
    const notifiedHandles = new Set();
    for (const result of allResults) {
        for (const handle of [...result.pushed, ...result.updated]) {
            if (typeof handle === 'string') notifiedHandles.add(handle);
        }
    }
    for (const handle of notifiedHandles) {
        writePushNotification(handle, 'New character added! Please refresh your browser 😊');
    }

    return response.send({ results: allResults });
});

// Find characters linked to a lorebook (any authenticated user)
router.post('/find-characters', async (request, response) => {
    const { name } = request.body;
    if (!name) {
        return response.status(400).send('Lorebook name is required');
    }

    const characters = await findCharactersByWorld(request.user.directories, name);
    return response.send({ characters });
});

// Get admin user handles (for non-admin users to know who they can push to)
router.post('/admin-handles', async (request, response) => {
    try {
        const allUsers = await getAllEnabledUsers();
        const admins = allUsers
            .filter(u => u.admin)
            .map(u => ({ handle: u.handle, name: u.name, admin: true, enabled: true }));
        return response.json(admins);
    } catch (err) {
        console.error('Failed to get admin handles:', err);
        return response.sendStatus(500);
    }
});

// Poll for push notifications (called by client on an interval)
router.post('/push-notifications', (request, response) => {
    try {
        const notifDir = path.join(path.dirname(request.user.directories.worlds), 'push-notifications');
        if (!fs.existsSync(notifDir)) return response.json([]);

        const files = fs.readdirSync(notifDir).filter(f => f.endsWith('.json')).sort();
        const notifications = [];
        for (const file of files) {
            try {
                const data = JSON.parse(fs.readFileSync(path.join(notifDir, file), 'utf8'));
                notifications.push(data);
                // Delete after reading
                fs.unlinkSync(path.join(notifDir, file));
            } catch { /* skip bad files */ }
        }
        return response.json(notifications);
    } catch (err) {
        console.error('Failed to read push notifications:', err);
        return response.json([]);
    }
});
