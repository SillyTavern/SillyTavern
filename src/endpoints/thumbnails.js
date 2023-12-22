const fs = require('fs');
const path = require('path');
const express = require('express');
const sanitize = require('sanitize-filename');
const jimp = require('jimp');
const writeFileAtomicSync = require('write-file-atomic').sync;
const { DIRECTORIES } = require('../constants');
const { getConfigValue } = require('../util');
const { jsonParser } = require('../express-common');

/**
 * Gets a path to thumbnail folder based on the type.
 * @param {'bg' | 'avatar'} type Thumbnail type
 * @returns {string} Path to the thumbnails folder
 */
function getThumbnailFolder(type) {
    let thumbnailFolder;

    switch (type) {
        case 'bg':
            thumbnailFolder = DIRECTORIES.thumbnailsBg;
            break;
        case 'avatar':
            thumbnailFolder = DIRECTORIES.thumbnailsAvatar;
            break;
    }

    return thumbnailFolder;
}

/**
 * Gets a path to the original images folder based on the type.
 * @param {'bg' | 'avatar'} type Thumbnail type
 * @returns {string} Path to the original images folder
 */
function getOriginalFolder(type) {
    let originalFolder;

    switch (type) {
        case 'bg':
            originalFolder = DIRECTORIES.backgrounds;
            break;
        case 'avatar':
            originalFolder = DIRECTORIES.characters;
            break;
    }

    return originalFolder;
}

/**
 * Removes the generated thumbnail from the disk.
 * @param {'bg' | 'avatar'} type Type of the thumbnail
 * @param {string} file Name of the file
 */
function invalidateThumbnail(type, file) {
    const folder = getThumbnailFolder(type);
    if (folder === undefined) throw new Error('Invalid thumbnail type');

    const pathToThumbnail = path.join(folder, file);

    if (fs.existsSync(pathToThumbnail)) {
        fs.rmSync(pathToThumbnail);
    }
}

/**
 * Generates a thumbnail for the given file.
 * @param {'bg' | 'avatar'} type Type of the thumbnail
 * @param {string} file Name of the file
 * @returns
 */
async function generateThumbnail(type, file) {
    let thumbnailFolder = getThumbnailFolder(type);
    let originalFolder = getOriginalFolder(type);
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
            const quality = getConfigValue('thumbnailsQuality', 95);
            const image = await jimp.read(pathToOriginalFile);
            const imgType = type == 'avatar' && getConfigValue('avatarThumbnailsPng', false) ? 'image/png' : 'image/jpeg';
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
    const cacheFiles = fs.readdirSync(DIRECTORIES.thumbnailsBg);

    // files exist, all ok
    if (cacheFiles.length) {
        return;
    }

    console.log('Generating thumbnails cache. Please wait...');

    const bgFiles = fs.readdirSync(DIRECTORIES.backgrounds);
    const tasks = [];

    for (const file of bgFiles) {
        tasks.push(generateThumbnail('bg', file));
    }

    await Promise.all(tasks);
    console.log(`Done! Generated: ${bgFiles.length} preview images`);
}

const router = express.Router();

// Important: This route must be mounted as '/thumbnail'. It is used in the client code and saved to chat files.
router.get('/', jsonParser, async function (request, response) {
    if (typeof request.query.file !== 'string' || typeof request.query.type !== 'string') return response.sendStatus(400);

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

    if (getConfigValue('disableThumbnails', false) == true) {
        let folder = getOriginalFolder(type);
        if (folder === undefined) return response.sendStatus(400);
        const pathToOriginalFile = path.join(folder, file);
        return response.sendFile(pathToOriginalFile, { root: process.cwd() });
    }

    const pathToCachedFile = await generateThumbnail(type, file);

    if (!pathToCachedFile) {
        return response.sendStatus(404);
    }

    return response.sendFile(pathToCachedFile, { root: process.cwd() });
});

module.exports = {
    invalidateThumbnail,
    ensureThumbnailCache,
    router,
};
