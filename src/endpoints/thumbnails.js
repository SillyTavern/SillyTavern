const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const mime = require('mime-types');
const express = require('express');
const sanitize = require('sanitize-filename');
const jimp = require('jimp');
const writeFileAtomicSync = require('write-file-atomic').sync;
const { getAllUserHandles, getUserDirectories } = require('../users');
const { getConfigValue } = require('../util');
const { jsonParser } = require('../express-common');

const thumbnailsDisabled = getConfigValue('disableThumbnails', false);
const quality = getConfigValue('thumbnailsQuality', 95);
const pngFormat = getConfigValue('avatarThumbnailsPng', false);

/**
 * Gets a path to thumbnail folder based on the type.
 * @param {import('../users').UserDirectoryList} directories User directories
 * @param {'bg' | 'avatar'} type Thumbnail type
 * @returns {string} Path to the thumbnails folder
 */
function getThumbnailFolder(directories, type) {
    let thumbnailFolder;

    switch (type) {
        case 'bg':
            thumbnailFolder = directories.thumbnailsBg;
            break;
        case 'avatar':
            thumbnailFolder = directories.thumbnailsAvatar;
            break;
    }

    return thumbnailFolder;
}

/**
 * Gets a path to the original images folder based on the type.
 * @param {import('../users').UserDirectoryList} directories User directories
 * @param {'bg' | 'avatar'} type Thumbnail type
 * @returns {string} Path to the original images folder
 */
function getOriginalFolder(directories, type) {
    let originalFolder;

    switch (type) {
        case 'bg':
            originalFolder = directories.backgrounds;
            break;
        case 'avatar':
            originalFolder = directories.characters;
            break;
    }

    return originalFolder;
}

/**
 * Removes the generated thumbnail from the disk.
 * @param {import('../users').UserDirectoryList} directories User directories
 * @param {'bg' | 'avatar'} type Type of the thumbnail
 * @param {string} file Name of the file
 */
function invalidateThumbnail(directories, type, file) {
    const folder = getThumbnailFolder(directories, type);
    if (folder === undefined) throw new Error('Invalid thumbnail type');

    const pathToThumbnail = path.join(folder, file);

    if (fs.existsSync(pathToThumbnail)) {
        fs.rmSync(pathToThumbnail);
    }
}

/**
 * Generates a thumbnail for the given file.
 * @param {import('../users').UserDirectoryList} directories User directories
 * @param {'bg' | 'avatar'} type Type of the thumbnail
 * @param {string} file Name of the file
 * @returns
 */
async function generateThumbnail(directories, type, file) {
    let thumbnailFolder = getThumbnailFolder(directories, type);
    let originalFolder = getOriginalFolder(directories, type);
    if (thumbnailFolder === undefined || originalFolder === undefined) throw new Error('Invalid thumbnail type');

    const pathToCachedFile = path.join(thumbnailFolder, file);
    const pathToOriginalFile = path.join(originalFolder, file);

    const cachedFileExists = fs.existsSync(pathToCachedFile);
    const originalFileExists = fs.existsSync(pathToOriginalFile);

    // to handle cases when original image was updated after thumb creation
    let shouldRegenerate = false;

    if (cachedFileExists && originalFileExists) {
        const originalStat = fs.statSync(pathToOriginalFile);
        const cachedStat = fs.statSync(pathToCachedFile);

        if (originalStat.mtimeMs > cachedStat.ctimeMs) {
            //console.log('Original file changed. Regenerating thumbnail...');
            shouldRegenerate = true;
        }
    }

    if (cachedFileExists && !shouldRegenerate) {
        return pathToCachedFile;
    }

    if (!originalFileExists) {
        return null;
    }

    const imageSizes = { 'bg': [160, 90], 'avatar': [96, 144] };
    const mySize = imageSizes[type];

    try {
        let buffer;

        try {
            const image = await jimp.read(pathToOriginalFile);
            const imgType = type == 'avatar' && pngFormat ? 'image/png' : 'image/jpeg';
            buffer = await image.cover(mySize[0], mySize[1]).quality(quality).getBufferAsync(imgType);
        }
        catch (inner) {
            console.warn(`Thumbnailer can not process the image: ${pathToOriginalFile}. Using original size`);
            buffer = fs.readFileSync(pathToOriginalFile);
        }

        writeFileAtomicSync(pathToCachedFile, buffer);
    }
    catch (outer) {
        return null;
    }

    return pathToCachedFile;
}

/**
 * Ensures that the thumbnail cache for backgrounds is valid.
 * @returns {Promise<void>} Promise that resolves when the cache is validated
 */
async function ensureThumbnailCache() {
    const userHandles = await getAllUserHandles();
    for (const handle of userHandles) {
        const directories = getUserDirectories(handle);
        const cacheFiles = fs.readdirSync(directories.thumbnailsBg);

        // files exist, all ok
        if (cacheFiles.length) {
            return;
        }

        console.log('Generating thumbnails cache. Please wait...');

        const bgFiles = fs.readdirSync(directories.backgrounds);
        const tasks = [];

        for (const file of bgFiles) {
            tasks.push(generateThumbnail(directories, 'bg', file));
        }

        await Promise.all(tasks);
        console.log(`Done! Generated: ${bgFiles.length} preview images`);
    }
}

const router = express.Router();

// Important: This route must be mounted as '/thumbnail'. It is used in the client code and saved to chat files.
router.get('/', jsonParser, async function (request, response) {
    try{
        if (typeof request.query.file !== 'string' || typeof request.query.type !== 'string') {
            return response.sendStatus(400);
        }

        const type = request.query.type;
        const file = sanitize(request.query.file);

        if (!type || !file) {
            return response.sendStatus(400);
        }

        if (!(type == 'bg' || type == 'avatar')) {
            return response.sendStatus(400);
        }

        if (sanitize(file) !== file) {
            console.error('Malicious filename prevented');
            return response.sendStatus(403);
        }

        if (thumbnailsDisabled) {
            const folder = getOriginalFolder(request.user.directories, type);

            if (folder === undefined) {
                return response.sendStatus(400);
            }

            const pathToOriginalFile = path.join(folder, file);
            if (!fs.existsSync(pathToOriginalFile)) {
                return response.sendStatus(404);
            }
            const contentType = mime.lookup(pathToOriginalFile) || 'image/png';
            const originalFile = await fsPromises.readFile(pathToOriginalFile);
            response.setHeader('Content-Type', contentType);
            return response.send(originalFile);
        }

        const pathToCachedFile = await generateThumbnail(request.user.directories, type, file);

        if (!pathToCachedFile) {
            return response.sendStatus(404);
        }

        if (!fs.existsSync(pathToCachedFile)) {
            return response.sendStatus(404);
        }

        const contentType = mime.lookup(pathToCachedFile) || 'image/jpeg';
        const cachedFile = await fsPromises.readFile(pathToCachedFile);
        response.setHeader('Content-Type', contentType);
        return response.send(cachedFile);
    } catch (error) {
        console.error('Failed getting thumbnail', error);
        return response.sendStatus(500);
    }
});

module.exports = {
    invalidateThumbnail,
    ensureThumbnailCache,
    router,
};
