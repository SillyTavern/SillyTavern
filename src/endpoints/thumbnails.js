import fs from 'node:fs';
import { promises as fsPromises } from 'node:fs';
import path from 'node:path';

import mime from 'mime-types';
import express from 'express';
import sanitize from 'sanitize-filename';
import { sync as writeFileAtomicSync } from 'write-file-atomic'; // Import for local use
import { Jimp, JimpMime } from '../jimp.js';
export { sync as writeFileAtomicSync } from 'write-file-atomic'; // Re-exporting for other modules

import { getConfigValue } from '../util.js';

// This constant needs to be accessible for export
export const currentMetadataVersion = '1.0.1';

const SKIPPED_EXTENSIONS_FOR_JIMP = ['.apng', '.mp4', '.webm', '.avi', '.mkv', '.flv', '.webp'];

const thumbnailsEnabled = !!getConfigValue('thumbnails.enabled', true, 'boolean');
const quality = Math.min(100, Math.max(1, parseInt(getConfigValue('thumbnails.quality', 95, 'number'))));
const pngFormat = String(getConfigValue('thumbnails.format', 'jpg')).toLowerCase().trim() === 'png';

/** @type {Record<string, number[]>} */
export const dimensions = {
    bg: getConfigValue('thumbnails.dimensions.bg', [160, 90]),
    avatar: getConfigValue('thumbnails.dimensions.avatar', [96, 144]),
};

/**
 * Gets a path to thumbnail folder based on the type.
 * @param {import('../users.js').UserDirectoryList} directories User directories
 * @param {'bg' | 'avatar'} type Thumbnail type
 * @returns {string} Path to the thumbnails folder
 */
export function getThumbnailFolder(directories, type) {
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
 * @param {import('../users.js').UserDirectoryList} directories User directories
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
 * @param {import('../users.js').UserDirectoryList} directories User directories
 * @param {'bg' | 'avatar'} type Type of the thumbnail
 * @param {string} file Name of the file
 */
export function invalidateThumbnail(directories, type, file) {
    const folder = getThumbnailFolder(directories, type);
    if (folder === undefined) throw new Error('Invalid thumbnail type');

    const pathToThumbnail = path.join(folder, file);

    if (fs.existsSync(pathToThumbnail)) {
        try {
            fs.unlinkSync(pathToThumbnail);
            console.info(`[invalidateThumbnail] Deleted thumbnail file: ${pathToThumbnail}`);
        } catch (e) {
            console.error(`[invalidateThumbnail] Failed to delete thumbnail file ${pathToThumbnail}:`, e);
        }
    }

    if (type === 'bg') {
        const thumbnailBaseDir = getThumbnailFolder(directories, 'bg');
        if (!thumbnailBaseDir) { // Should not happen if type is 'bg' and getThumbnailFolder is correct
            console.error('[invalidateThumbnail] Could not determine thumbnail base directory for bg type.');
            return;
        }
        const aspectRatiosJsonPath = path.join(thumbnailBaseDir, 'aspect_ratios.json');

        try {
            if (fs.existsSync(aspectRatiosJsonPath)) {
                const aspectRatiosData = fs.readFileSync(aspectRatiosJsonPath, 'utf-8');
                const aspectRatios = JSON.parse(aspectRatiosData); // Potential point of failure if JSON is corrupt

                if (Object.prototype.hasOwnProperty.call(aspectRatios, file)) {
                    delete aspectRatios[file];
                    // Use the imported writeFileAtomicSync from this module
                    writeFileAtomicSync(aspectRatiosJsonPath, JSON.stringify(aspectRatios, null, 2));
                    console.info(`[invalidateThumbnail] Removed entry for "${file}" from aspect_ratios.json.`);

                    const versionFilePath = path.join(thumbnailBaseDir, 'aspect_metadata_version.txt');
                    // currentMetadataVersion is a const available in this module's scope
                    fs.writeFileSync(versionFilePath, currentMetadataVersion);
                    console.info(`[invalidateThumbnail] Updated aspect_metadata_version.txt due to removal of ${file}.`);
                }
            }
        } catch (e) {
            console.error(`[invalidateThumbnail] Failed to update aspect_ratios.json or version for deleted file ${file}:`, e);
        }
    }
}

/**
 * Generates a thumbnail for the given file.
 * @param {import('../users.js').UserDirectoryList} directories User directories
 * @param {'bg' | 'avatar'} type Type of the thumbnail
 * @param {string} file Name of the file
 * @returns
 */
export async function generateThumbnail(directories, type, file) {
    const fileExtension = path.extname(file).toLowerCase();
    if (SKIPPED_EXTENSIONS_FOR_JIMP.includes(fileExtension)) {
        return null; // Immediately return null, no further processing.
    }

    const thumbnailFolder = getThumbnailFolder(directories, type);
    const originalFolder = getOriginalFolder(directories, type);
    if (thumbnailFolder === undefined || originalFolder === undefined) throw new Error('Invalid thumbnail type');

    const pathToCachedFile = path.join(thumbnailFolder, file);
    const pathToOriginalFile = path.join(originalFolder, file);

    const cachedFileExists = fs.existsSync(pathToCachedFile);
    const originalFileExists = fs.existsSync(pathToOriginalFile);
    let shouldRegenerate = false;

    if (!originalFileExists) {
        if (cachedFileExists) {
            try {
                fs.unlinkSync(pathToCachedFile);
                console.warn(`Removed stale thumbnail for deleted original: ${file}`);
            } catch (e) {
                console.error(`Error removing stale thumbnail ${pathToCachedFile}: ${e.message}`);
            }
        }
        return null;
    }

    if (cachedFileExists) {
        const originalStat = fs.statSync(pathToOriginalFile);
        const cachedStat = fs.statSync(pathToCachedFile);
        if (originalStat.mtimeMs > cachedStat.mtimeMs) {
            shouldRegenerate = true;
        }
    }

    try {
        if (cachedFileExists && !shouldRegenerate) {
            let classification = 'unknown';
            try {
                const imageForClassification = await Jimp.read(pathToOriginalFile);
                const ratio = imageForClassification.bitmap.width / imageForClassification.bitmap.height;
                if (ratio >= 1.2857) classification = 'landscape';
                else if (ratio <= 0.7778) classification = 'portrait';
                else classification = 'square';
            }
            return { path: pathToCachedFile, classification };
        }

        // If we reach here, either thumbnail doesn't exist or needs regeneration.
        const image = await Jimp.read(pathToOriginalFile);

        let classification = 'square';
        const ratio = image.bitmap.width / image.bitmap.height;
        if (ratio >= 1.2857) classification = 'landscape';
        else if (ratio <= 0.7778) classification = 'portrait';

        // Generate thumbnail
        let buffer;
        const size = dimensions[type];
        const thumbImage = image.clone();
        const width = !isNaN(size?.[0]) && size?.[0] > 0 ? size[0] : thumbImage.bitmap.width;
        const height = !isNaN(size?.[1]) && size?.[1] > 0 ? size[1] : thumbImage.bitmap.height;
        thumbImage.cover({ w: width, h: height });

        buffer = pngFormat
            ? await thumbImage.getBufferAsync(JimpMime.png)
            : await thumbImage.getBufferAsync(JimpMime.jpeg, { quality });

        writeFileAtomicSync(pathToCachedFile, buffer);
        return { path: pathToCachedFile, classification };

    } catch (error) {

        if (shouldRegenerate && cachedFileExists) {
            try {
                fs.unlinkSync(pathToCachedFile);
                console.warn(`Removed potentially outdated/corrupt thumbnail for ${file} due to regeneration failure.`);
            } catch (e) {
                console.error(`Error removing thumbnail for ${file} after regeneration failure: ${e.message}`);
            }
        }
        return null;
    }
}

/**
 * Ensures that the thumbnail cache for backgrounds is valid.
 * @param {import('../users.js').UserDirectoryList[]} directoriesList User directories
 * @returns {Promise<void>} Promise that resolves when the cache is validated
 */
export async function ensureThumbnailCache(directoriesList) {

    for (const directories of directoriesList) {
        if (!directories.backgrounds || !directories.thumbnailsBg) {
            console.warn('[ensureThumbnailCache] Missing backgrounds or thumbnailsBg directory for a user, skipping.');
            continue;
        }
        if (!fs.existsSync(directories.backgrounds)) {
            console.warn(`[ensureThumbnailCache] Backgrounds directory ${directories.backgrounds} does not exist, skipping.`);
            continue;
        }
        if (!fs.existsSync(directories.thumbnailsBg)) {
            try {
                fs.mkdirSync(directories.thumbnailsBg, { recursive: true });
                console.info(`[ensureThumbnailCache] Created thumbnailsBg directory: ${directories.thumbnailsBg}`);
            } catch (e) {
                console.error(`[ensureThumbnailCache] Failed to create thumbnailsBg directory ${directories.thumbnailsBg}: ${e.message}. Skipping this directory.`);
                continue;
            }
        }

        const aspectRatiosJsonPath = path.join(directories.thumbnailsBg, 'aspect_ratios.json');
        const versionFilePath = path.join(directories.thumbnailsBg, 'aspect_metadata_version.txt');

        let existingAspectRatios = {};
        let needsFullRegeneration = false;
        let madeChangesToJSON = false;

        const detectedVersion = fs.existsSync(versionFilePath) ? fs.readFileSync(versionFilePath, 'utf-8') : null;

        if (detectedVersion !== currentMetadataVersion || !fs.existsSync(aspectRatiosJsonPath)) {
            console.info(`[ensureThumbnailCache] Metadata version mismatch or missing JSON for ${directories.thumbnailsBg}. Triggering full regeneration.`);
            needsFullRegeneration = true;
            madeChangesToJSON = true; // Will definitely make changes if regenerating fully

            // Delete all existing image thumbnails (not metadata files)
            const filesInThumbnailsBg = fs.readdirSync(directories.thumbnailsBg);
            for (const fileInThumbnailsBg of filesInThumbnailsBg) {
                if (fileInThumbnailsBg !== 'aspect_ratios.json' && fileInThumbnailsBg !== 'aspect_metadata_version.txt') {
                    const fullPath = path.join(directories.thumbnailsBg, fileInThumbnailsBg);
                    if (fs.statSync(fullPath).isFile()) {
                        try { fs.unlinkSync(fullPath); } catch (e) { console.warn(`[ensureThumbnailCache] Could not delete old thumbnail ${fileInThumbnailsBg}:`, e); }
                    }
                }
            }
            if (fs.existsSync(aspectRatiosJsonPath)) {
                try { fs.unlinkSync(aspectRatiosJsonPath); } catch (e) { console.warn('[ensureThumbnailCache] Could not delete old aspect_ratios.json:', e); }
            }
        } else {
            try {
                existingAspectRatios = JSON.parse(fs.readFileSync(aspectRatiosJsonPath, 'utf-8'));
            } catch (e) {
                console.warn(`[ensureThumbnailCache] Could not parse aspect_ratios.json for ${directories.thumbnailsBg}, triggering full regeneration. Error: ${e.message}`);
                needsFullRegeneration = true; // Treat as full regeneration if JSON is corrupt
                madeChangesToJSON = true;
                existingAspectRatios = {}; // Reset
                // Also clear out potentially inconsistent thumbnails
                const filesInThumbnailsBg = fs.readdirSync(directories.thumbnailsBg);
                for (const fileInThumbnailsBg of filesInThumbnailsBg) {
                    if (fileInThumbnailsBg !== 'aspect_ratios.json' && fileInThumbnailsBg !== 'aspect_metadata_version.txt') {
                        const fullPath = path.join(directories.thumbnailsBg, fileInThumbnailsBg);
                        if (fs.statSync(fullPath).isFile()) {
                            try { fs.unlinkSync(fullPath); } catch (e) { console.warn(`[ensureThumbnailCache] Could not delete old thumbnail ${fileInThumbnailsBg} during corruption handling:`, e); }
                        }
                    }
                }
            }
        }

        const allEntriesInBgDir = fs.readdirSync(directories.backgrounds);
        const bgFiles = []; // This will store only valid image files
        const PLAUSIBLE_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.apng', '.tiff'];

        for (const entryName of allEntriesInBgDir) {
            const fullPathToEntry = path.join(directories.backgrounds, entryName);
            try {
                if (!fs.statSync(fullPathToEntry).isFile()) {
                    continue; // Skip directories
                }
                const fileExtension = path.extname(entryName).toLowerCase();
                if (!PLAUSIBLE_IMAGE_EXTENSIONS.includes(fileExtension)) {
                    continue; // Skip non-plausible image files
                }
                bgFiles.push(entryName); // Add valid image file to the list for processing
            } catch (statError) {

                continue;
            }
        }
        // Now, bgFiles contains only actual image files.

        const bgFileSet = new Set(bgFiles); // For efficient lookup of existing background files
        let currentAspectRatios = { ...existingAspectRatios };
        const tasks = [];

        // Process current background files: add new ones, update changed ones
        for (const file of bgFiles) { // Iterate over pre-filtered bgFiles
            const pathToOriginalFile = path.join(directories.backgrounds, file);
            const pathToCachedFile = path.join(directories.thumbnailsBg, file);
            let fileNeedsProcessing = false;

            if (needsFullRegeneration) {
                fileNeedsProcessing = true;
            } else {
                // Since we've filtered for files, statSync should be safe.
                // Error handling for statSync can be added if needed, but the outer try-catch for the loop might cover it.
                const originalStat = fs.statSync(pathToOriginalFile);
                if (!Object.prototype.hasOwnProperty.call(currentAspectRatios, file)) {
                    fileNeedsProcessing = true;
                } else if (!fs.existsSync(pathToCachedFile)) {
                    fileNeedsProcessing = true;
                } else {
                    const cachedStat = fs.statSync(pathToCachedFile);
                    if (originalStat.mtimeMs > cachedStat.mtimeMs) {
                        fileNeedsProcessing = true;
                    }
                }
            }

            if (fileNeedsProcessing) {
                tasks.push(
                    generateThumbnail(directories, 'bg', file).then(result => {
                        if (result && result.path) { // Successfully generated/classified
                            if (currentAspectRatios[file] !== result.classification) {
                                madeChangesToJSON = true;
                            }
                            currentAspectRatios[file] = result.classification;
                        } else { // generateThumbnail returned null (skipped, or error)
                            if (Object.prototype.hasOwnProperty.call(currentAspectRatios, file)) {
                                delete currentAspectRatios[file];
                                madeChangesToJSON = true;
                            }
                            // If it's a new file that couldn't be processed, it's just not added.
                        }
                    }),
                );
            }
            // If !fileNeedsProcessing, the entry from existingAspectRatios is kept in currentAspectRatios implicitly.
        }

        await Promise.all(tasks);

        // Process deletions: remove entries from currentAspectRatios if original file is gone
        if (!needsFullRegeneration) { // No need to check deletions if we started from scratch
            for (const existingFileInJson in currentAspectRatios) {
                if (Object.prototype.hasOwnProperty.call(currentAspectRatios, existingFileInJson)) {
                    if (!bgFileSet.has(existingFileInJson)) {
                        console.info(`[ensureThumbnailCache] Original file ${existingFileInJson} deleted. Removing from aspect ratios and deleting its thumbnail.`);
                        delete currentAspectRatios[existingFileInJson];
                        madeChangesToJSON = true;
                        const pathToStaleThumbnail = path.join(directories.thumbnailsBg, existingFileInJson);
                        if (fs.existsSync(pathToStaleThumbnail)) {
                            try { fs.unlinkSync(pathToStaleThumbnail); } catch (e) { console.warn(`[ensureThumbnailCache] Could not delete stale thumbnail ${pathToStaleThumbnail}: ${e.message}`); }
                        }
                    }
                }
            }
        }

        if (madeChangesToJSON) {
            try {
                writeFileAtomicSync(aspectRatiosJsonPath, JSON.stringify(currentAspectRatios, null, 2));
                fs.writeFileSync(versionFilePath, currentMetadataVersion); // Update version if JSON is written
                console.info(`[ensureThumbnailCache] Aspect ratio data updated for ${directories.thumbnailsBg}. Processed ${tasks.length} files that needed updates/generation.`);
            } catch (e) {
                console.error(`[ensureThumbnailCache] Failed to write aspect_ratios.json or version file for ${directories.thumbnailsBg}: ${e.message}`);
            }
        } else {
            console.info(`[ensureThumbnailCache] Aspect ratio data is up-to-date for ${directories.thumbnailsBg}.`);
        }
    }
}

export const router = express.Router();

// Important: This route must be mounted as '/thumbnail'. It is used in the client code and saved to chat files.
router.get('/', async function (request, response) {
    try {
        if (typeof request.query.file !== 'string' || typeof request.query.type !== 'string') {
            return response.sendStatus(400);
        }

        const type = request.query.type;
        const file = sanitize(request.query.file);

        if (!type || !file) {
            return response.sendStatus(400);
        }

        if (!(type === 'bg' || type === 'avatar')) {
            return response.sendStatus(400);
        }

        if (sanitize(file) !== file) {
            console.error('Malicious filename prevented');
            return response.sendStatus(403);
        }

        if (!thumbnailsEnabled) {
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

        const thumbnailResult = await generateThumbnail(request.user.directories, type, file);
        const pathToCachedFile = thumbnailResult ? thumbnailResult.path : null;

        if (!pathToCachedFile) {
            return response.sendStatus(404);
        }

        if (!fs.existsSync(pathToCachedFile)) {
            // Keeping a minimal error log here if the file is still not found after generation attempt.
            console.error(`[/thumbnail route] File NOT FOUND at an expected cached path: ${pathToCachedFile} for type: ${type}, file: ${file}`);
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
