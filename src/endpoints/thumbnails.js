import fs from 'node:fs';
import { promises as fsPromises } from 'node:fs';
import path from 'node:path';

import mime from 'mime-types';
import express from 'express';
import sanitize from 'sanitize-filename';
import { Jimp, JimpMime } from '../jimp.js';
import { sync as writeFileAtomicSync } from 'write-file-atomic';

import { getConfigValue } from '../util.js';

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
            //console.warn('Original file changed. Regenerating thumbnail...');
            shouldRegenerate = true;
        }
    }

    // Read the image to determine classification, even if cached file exists and no regeneration is needed for the image itself.
    // This is simplified for now; ensureThumbnailCache will be the primary writer of classification data.
    let classification = 'square'; // Default classification

    if (!originalFileExists) {
        // If original doesn't exist, can't generate or classify.
        // If a cached file exists but original is gone, it's stale. invalidateThumbnail should handle cleanup.
        return null;
    }

    let image;
    try {
        image = await Jimp.read(pathToOriginalFile);
        const ratio = image.bitmap.width / image.bitmap.height;
        if (ratio >= 1.2857) classification = 'landscape';
        else if (ratio <= 0.7778) classification = 'portrait';
    } catch (e) {
        console.error(`Failed to read image for classification ${pathToOriginalFile}:`, e);
        // If we can't read the image, we can't generate a thumbnail or classify it.
        // If a cached version exists, we could return its path but without classification.
        // However, the function expects to return classification. So, treat as failure.
        return null;
    }

    if (cachedFileExists && !shouldRegenerate) {
        return { path: pathToCachedFile, classification: classification };
    }

    // If we reach here, either the thumbnail doesn't exist or needs regeneration.
    try {
        let buffer;
        // Image already read for classification, use the 'image' object.
        const size = dimensions[type];
        const width = !isNaN(size?.[0]) && size?.[0] > 0 ? size[0] : image.bitmap.width;
        const height = !isNaN(size?.[1]) && size?.[1] > 0 ? size[1] : image.bitmap.height;
        image.cover({ w: width, h: height }); // Use image.cover for resizing
        buffer = pngFormat
            ? await image.getBuffer(JimpMime.png)
            : await image.getBuffer(JimpMime.jpeg, { quality: quality, jpegColorSpace: 'ycbcr' });

        writeFileAtomicSync(pathToCachedFile, buffer);
    }
    catch (e) {
        console.error(`Failed to generate thumbnail for ${pathToOriginalFile}:`, e);
        // Attempted to generate, but failed. Return null.
        return null;
    }

    return { path: pathToCachedFile, classification: classification };
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
            // This simple check can be expanded if needed
            if (!/\.(jpeg|jpg|png|gif|webp)$/i.test(file)) {
                // console.log(`Skipping non-image file: ${file}`);
                continue;
            }
            tasks.push(
                generateThumbnail(directories, 'bg', file).then(result => {
                    if (result && result.path && result.classification) {
                        newAspectRatios[file] = result.classification;
                    } else if (result && result.path && !result.classification) {
                        // Thumbnail generated/existed, but classification failed (should not happen with current generateThumbnail logic)
                        // Or, if generateThumbnail was modified to not always return classification for existing files.
                        // For now, we expect classification. If missing, it might indicate an issue or an old image.
                        // console.warn(`Thumbnail for ${file} processed, but classification missing.`);
                    } else {
                        // generation failed or original file missing
                        // if (result === null && newAspectRatios[file]) {
                        //     // Original file might have been deleted. Remove from aspect ratios.
                        //     delete newAspectRatios[file];
                        // }
                        // console.warn(`Thumbnail generation failed for ${file}. It might be removed from aspect ratios if previously present.`);
                    }
                }).catch(error => {
                    console.error(`Error processing thumbnail for ${file}:`, error);
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
