import fs from 'node:fs';
import { promises as fsPromises } from 'node:fs';
import path from 'node:path';

import mime from 'mime-types';
import express from 'express';
import sanitize from 'sanitize-filename';
import { Jimp, JimpMime } from '../jimp.js';
import { sync as writeFileAtomicSync } from 'write-file-atomic';

import { getConfigValue } from '../util.js';

const SKIPPED_EXTENSIONS_FOR_JIMP = ['.apng', '.mp4', '.webm', '.avi', '.mkv', '.flv', '.webp'];

const thumbnailsEnabled = !!getConfigValue('thumbnails.enabled', true, 'boolean');
const quality = Math.min(100, Math.max(1, parseInt(getConfigValue('thumbnails.quality', 95, 'number'))));
const pngFormat = String(getConfigValue('thumbnails.format', 'jpg')).toLowerCase().trim() === 'png';

/** @type {Record<string, number[]>} */
export const dimensions = {
    'bg': getConfigValue('thumbnails.dimensions.bg', [160, 90]),
    'avatar': getConfigValue('thumbnails.dimensions.avatar', [96, 144]),
};

/**
 * Gets a path to thumbnail folder based on the type.
 * @param {import('../users.js').UserDirectoryList} directories User directories
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
        } catch (e) {
            console.error(`Failed to delete thumbnail file ${pathToThumbnail}:`, e);
            // If deletion fails, we might not want to proceed with JSON update,
            // or handle it based on desired robustness. For now, log and continue.
        }
    }

    if (type === 'bg') {
        const aspectRatiosJsonPath = path.join(getThumbnailFolder(directories, 'bg'), 'aspect_ratios.json');
        try {
            if (fs.existsSync(aspectRatiosJsonPath)) {
                let aspectRatios = JSON.parse(fs.readFileSync(aspectRatiosJsonPath, 'utf-8'));
                if (aspectRatios[file]) {
                    delete aspectRatios[file];
                    writeFileAtomicSync(aspectRatiosJsonPath, JSON.stringify(aspectRatios, null, 2));
                }
            }
        } catch (e) {
            console.error(`Failed to update aspect_ratios.json for deleted file ${file}:`, e);
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
async function generateThumbnail(directories, type, file) {
    const fileExtension = path.extname(file).toLowerCase();
    if (SKIPPED_EXTENSIONS_FOR_JIMP.includes(fileExtension)) {
        console.warn(`[generateThumbnail] Skipped Jimp processing for "${file}" due to known problematic extension: ${fileExtension}.`);
        return null; // Immediately return null, no further processing.
    }

    let thumbnailFolder = getThumbnailFolder(directories, type);
    let originalFolder = getOriginalFolder(directories, type);
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

    // Main processing block
    try {
        // If thumbnail exists and doesn't need regeneration, get classification and return
        if (cachedFileExists && !shouldRegenerate) {
            let classification = 'unknown';
            try {
                const imageForClassification = await Jimp.read(pathToOriginalFile);
                const ratio = imageForClassification.bitmap.width / imageForClassification.bitmap.height;
                if (ratio >= 1.2857) classification = 'landscape';
                else if (ratio <= 0.7778) classification = 'portrait';
                else classification = 'square';
            } catch (e) {
                console.warn(`Jimp could not read ${file} for aspect ratio (cached thumbnail exists): ${e.message}. Classification set to 'unknown'.`);
            }
            return { path: pathToCachedFile, classification: classification };
        }

        // If we reach here, either thumbnail doesn't exist or needs regeneration.
        const image = await Jimp.read(pathToOriginalFile);

        // Get classification
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
            : await thumbImage.getBufferAsync(JimpMime.jpeg, { quality: quality });

        writeFileAtomicSync(pathToCachedFile, buffer);
        return { path: pathToCachedFile, classification: classification };

    } catch (error) {
        console.warn(`Jimp processing failed for image ${file}: ${error.message}. Skipping thumbnail and aspect ratio for this file.`);

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
    const currentMetadataVersion = "1.0.1";

    for (const directories of directoriesList) {
        const aspectRatiosJsonPath = path.join(directories.thumbnailsBg, 'aspect_ratios.json');
        const versionFilePath = path.join(directories.thumbnailsBg, 'aspect_metadata_version.txt');
        let existingAspectRatios = {};
        let detectedVersion = null;
        let needsRegeneration = false;

        if (fs.existsSync(versionFilePath)) {
            try {
                detectedVersion = fs.readFileSync(versionFilePath, 'utf-8');
            } catch (e) {
                console.warn('Could not read version file, assuming regeneration is needed:', e);
                needsRegeneration = true;
            }
        }

        if (!detectedVersion || detectedVersion !== currentMetadataVersion || !fs.existsSync(aspectRatiosJsonPath)) {
            needsRegeneration = true;
            console.info('Thumbnail metadata version mismatch or missing JSON. Regenerating all background thumbnails and aspect ratio data...');

            // Delete existing thumbnails and aspect ratio JSON if regeneration is needed
            const filesInThumbnailsBg = fs.readdirSync(directories.thumbnailsBg);
            for (const fileInThumbnailsBg of filesInThumbnailsBg) {
                if (fileInThumbnailsBg !== 'aspect_ratios.json' && fileInThumbnailsBg !== 'aspect_metadata_version.txt') {
                    const fullPath = path.join(directories.thumbnailsBg, fileInThumbnailsBg);
                    // Ensure it's a file before attempting to delete
                    try {
                        if (fs.statSync(fullPath).isFile()) {
                            fs.unlinkSync(fullPath);
                        }
                    } catch (e) {
                        console.warn(`Could not delete old thumbnail ${fileInThumbnailsBg}:`, e);
                    }
                }
            }
            if (fs.existsSync(aspectRatiosJsonPath)) {
                try {
                    fs.unlinkSync(aspectRatiosJsonPath);
                } catch (e) {
                    console.warn('Could not delete old aspect_ratios.json:', e);
                }
            }
        } else {
            try {
                existingAspectRatios = JSON.parse(fs.readFileSync(aspectRatiosJsonPath, 'utf-8'));
            } catch (e) {
                console.warn('Could not parse aspect_ratios.json, will regenerate it.', e);
                needsRegeneration = true; // Mark for regen if JSON is corrupt
                // Also clear existing aspect ratios if JSON is corrupt, to rebuild fresh
                existingAspectRatios = {};
            }
        }

        // Determine files to process: all original background files.
        // generateThumbnail will handle whether to regenerate the image or just get classification.
        const bgFiles = fs.readdirSync(directories.backgrounds);
        const tasks = [];
        let newAspectRatios = { ...existingAspectRatios }; // Initialize with existing, possibly empty or loaded

        for (const file of bgFiles) {
            // Check if the file is a known image type or simply attempt generation
            if (!/\.(jpeg|jpg|png|gif|webp)$/i.test(file)) {
                continue;
            }
            tasks.push(
                generateThumbnail(directories, 'bg', file).then(result => {
                    if (result && result.path && result.classification) {
                        newAspectRatios[file] = result.classification;
                    }
                    // Intentionally not re-adding complex else conditions here for classification missing / generation failed,
                    // as generateThumbnail itself handles logging and returns null for failures.
                    // The primary goal is to populate newAspectRatios with successful classifications.
                }).catch(error => {
                    console.error(`Error processing thumbnail for ${file}:`, error); // This catch is for unexpected errors in the promise chain itself
                })
            );
        }

        await Promise.all(tasks);

        // After all thumbnails are processed (or attempted), write the new aspect ratios JSON.
        try {
            writeFileAtomicSync(aspectRatiosJsonPath, JSON.stringify(newAspectRatios, null, 2));
        } catch (e) {
            console.error('Failed to write aspect_ratios.json:', e);
        }

        // If regeneration was flagged, or if the aspect ratio JSON was written (implying changes or initial creation),
        // update the version file.
        if (needsRegeneration || fs.existsSync(aspectRatiosJsonPath)) { // Check if JSON exists as proxy for successful write
            try {
                fs.writeFileSync(versionFilePath, currentMetadataVersion);
            } catch (e) {
                console.error('Failed to write aspect_metadata_version.txt:', e);
            }
        }
        console.info(`Done! Processed background images for ${directories.user}. Aspect ratio data updated.`);
    }
}

export const router = express.Router();

// Important: This route must be mounted as '/thumbnail'. It is used in the client code and saved to chat files.
router.get('/', async function (request, response) {
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
