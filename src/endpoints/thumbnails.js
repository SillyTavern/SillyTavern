import fs from 'node:fs';
import path from 'node:path';

import express from 'express';
import sanitize from 'sanitize-filename';
import { Jimp, JimpMime } from '../jimp.js';
import { sync as writeFileAtomicSync } from 'write-file-atomic';
import { imageSize as sizeOf } from 'image-size';

import { getConfigValue, invalidateFirefoxCache } from '../util.js';
import { getThumbnailResolution, isAnimatedWebP, thumbnailDimensions as dimensions, isAnimatedApng } from './image-metadata.js';
import { ResizeStrategy } from '@jimp/plugin-resize';

export const publicRouter = express.Router();
export const apiRouter = express.Router();

export const SKIPPED_EXTENSIONS = new Set(['.apng', '.mp4', '.webm', '.avi', '.mkv', '.flv', '.gif']);
export const ALLOWED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tif', '.tiff', '.apng']);

const thumbnailsEnabled = !!getConfigValue('thumbnails.enabled', true, 'boolean');
const quality = Math.min(100, Math.max(1, parseInt(getConfigValue('thumbnails.quality', 95, 'number'))));
const pngFormat = String(getConfigValue('thumbnails.format', 'jpg')).toLowerCase().trim() === 'png';

/**
 * @typedef {'bg' | 'avatar' | 'persona'} ThumbnailType
 */


/**
 * Gets a path to thumbnail folder based on the type.
 * @param {import('../users.js').UserDirectoryList} directories User directories
 * @param {ThumbnailType} type Thumbnail type
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
        case 'persona':
            thumbnailFolder = directories.thumbnailsPersona;
            break;
    }

    return thumbnailFolder;
}

/**
 * Gets a path to the original images folder based on the type.
 * @param {import('../users.js').UserDirectoryList} directories User directories
 * @param {ThumbnailType} type Thumbnail type
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
        case 'persona':
            originalFolder = directories.avatars;
            break;
    }

    return originalFolder;
}

/**
 * Removes the generated thumbnail from the disk.
 * @param {import('../users.js').UserDirectoryList} directories User directories
 * @param {ThumbnailType} type Type of the thumbnail
 * @param {string} file Name of the file
 */
export function invalidateThumbnail(directories, type, file) {
    const folder = getThumbnailFolder(directories, type);
    if (folder === undefined) throw new Error('Invalid thumbnail type');

    const pathToThumbnail = path.join(folder, sanitize(file));

    if (fs.existsSync(pathToThumbnail)) {
        fs.unlinkSync(pathToThumbnail);
    }
}

/**
 * Generates or retrieves a thumbnail for a given file.
 * @param {import('../users.js').UserDirectoryList} directories - User's directory configuration.
 * @param {ThumbnailType} type - Type of thumbnail ('bg', 'avatar', 'persona').
 * @param {string} file - The filename of the image.
 * @param {boolean} [forceGenerate=false] - Whether to force generation even if a thumbnail exists.
 * @param {boolean|null} [isKnownAnimated=null] - If true, skips generation. If false, assumes static. If null, checks.
 * @returns {Promise<{path: string|null, aspectRatio: number|null, resolution: number|null}>} Path to thumbnail, its aspect ratio, and resolution.
 */
export async function generateThumbnail(directories, type, file, forceGenerate = false, isKnownAnimated = null) {
    // If the caller has already determined the file is animated, skip processing.
    if (isKnownAnimated) {
        return { path: null, aspectRatio: null, resolution: null };
    }

    const thumbnailFolder = getThumbnailFolder(directories, type);
    const originalFolder = getOriginalFolder(directories, type);
    if (thumbnailFolder === undefined || originalFolder === undefined) throw new Error('Invalid thumbnail type');
    const pathToCachedFile = path.join(thumbnailFolder, file);

    try {
        const pathToOriginalFile = path.join(originalFolder, file);

        // Check if thumbnail already exists and return it if not forcing regeneration
        if (!forceGenerate && fs.existsSync(pathToCachedFile)) {
            try {
                // Check if original image was updated after thumbnail creation
                const originalFileExists = fs.existsSync(pathToOriginalFile);
                if (originalFileExists) {
                    const originalStat = fs.statSync(pathToOriginalFile);
                    const cachedStat = fs.statSync(pathToCachedFile);

                    if (originalStat.mtimeMs > cachedStat.ctimeMs) {
                        // Original file changed, regenerate thumbnail
                        forceGenerate = true;
                    }
                }

                if (!forceGenerate) {
                    const buffer = fs.readFileSync(pathToCachedFile);
                    const fileDimensions = sizeOf(buffer);
                    const ratio = (fileDimensions.height > 0) ? (fileDimensions.width / fileDimensions.height) : 1.0;
                    // When a thumbnail exists, return the current resolution from config so the JSON can be updated.
                    const resolution = getThumbnailResolution(type);
                    return { path: pathToCachedFile, aspectRatio: ratio, resolution };
                }
            } catch (e) {
                forceGenerate = true;
            }
        }
        if (!fs.existsSync(pathToOriginalFile)) {
            console.error(`[generateThumbnail] Cannot generate thumbnail, original file not found: ${pathToOriginalFile}`);
            return { path: null, aspectRatio: null, resolution: null };
        }

        const fileExtension = path.extname(file).toLowerCase();

        // For WebP files, we must check if they are animated, as Jimp cannot process them.
        // If isKnownAnimated is false, we assume the caller knows it is static and skip this check.
        if (fileExtension === '.webp' && isKnownAnimated !== false) {
            const buffer = fs.readFileSync(pathToOriginalFile);
            const isAnimated = isAnimatedWebP(buffer);
            if (isAnimated) {
                // The client is expected to handle it.
                return { path: null, aspectRatio: null, resolution: null };
            }
        }

        // For PNG files, check if they are actually APNGs.
        if (fileExtension === '.png' && isKnownAnimated !== false) {
            const buffer = fs.readFileSync(pathToOriginalFile);
            const isAnimated = isAnimatedApng(buffer);
            if (isAnimated) {
                // The client is expected to handle it.
                return { path: null, aspectRatio: null, resolution: null };
            }
        }

        if (SKIPPED_EXTENSIONS.has(fileExtension)) {
            return { path: null, aspectRatio: null, resolution: null };
        }

        // Process the image to generate thumbnail
        const result = await processSingleImage(file, originalFolder, thumbnailFolder, type);
        if (result.success) {
            return { path: pathToCachedFile, aspectRatio: result.aspectRatio ?? null, resolution: result.resolution ?? null };
        } else {
            console.error(`[generateThumbnail] Failed to process image ${file}:`, result.error);
            return { path: null, aspectRatio: null, resolution: null };
        }
    } catch (error) {
        console.error(`[generateThumbnail] Unexpected error processing ${file}:`, error);
        return { path: null, aspectRatio: null, resolution: null };
    }
}

/**
 * Processes a single image to generate its thumbnail.
 * @param {string} file - The filename of the image.
 * @param {string} originalFolder - Path to the original image folder.
 * @param {string} thumbnailFolder - Path to the thumbnail output folder.
 * @param {ThumbnailType} type - The type of thumbnail to generate.
 * @returns {Promise<{success: boolean, filename?: string, error?: string, aspectRatio?: number, resolution?: number}>} Result of the processing.
 */
async function processSingleImage(file, originalFolder, thumbnailFolder, type) {
    const pathToOriginalFile = path.join(originalFolder, file);
    const pathToCachedFile = path.join(thumbnailFolder, file);

    try {
        const fileBuffer = fs.readFileSync(pathToOriginalFile);
        const image = await Jimp.read(fileBuffer);

        // Calculate aspect ratio from original image dimensions
        const originalWidth = image.bitmap.width;
        const originalHeight = image.bitmap.height;
        const aspectRatio = (originalHeight > 0) ? (originalWidth / originalHeight) : 1.0;

        const thumbImage = image.clone();
        const thumbnailResolution = getThumbnailResolution(type);

        if (type === 'bg') {
            const [configWidth, configHeight] = dimensions[type];
            const targetPixelArea = configWidth * configHeight;

            // Calculate thumbnail dimensions to maintain target pixel area while preserving aspect ratio
            // For aspect ratio w:h, if area = w*h and ratio = w/h, then:
            // w = sqrt(area * ratio) and h = sqrt(area / ratio)
            const thumbWidth = Math.round(Math.sqrt(targetPixelArea * aspectRatio));
            const thumbHeight = Math.round(Math.sqrt(targetPixelArea / aspectRatio));

            thumbImage.resize({ w: thumbWidth, h: thumbHeight, mode: ResizeStrategy.BILINEAR });
        } else if (type === 'avatar' || type === 'persona') {
            // Crop and resize to fixed dimensions
            const [configWidth, configHeight] = dimensions[type];
            thumbImage.cover({ w: configWidth, h: configHeight });
        }

        const buffer = pngFormat
            ? await thumbImage.getBuffer(JimpMime.png)
            : await thumbImage.getBuffer(JimpMime.jpeg, { quality: quality, jpegColorSpace: 'ycbcr' });

        writeFileAtomicSync(pathToCachedFile, buffer);

        return { success: true, aspectRatio, resolution: thumbnailResolution };
    } catch (error) {
        console.warn(`[Thumbnails] Failed to process image ${file}:`, error);
        return { success: false, filename: file, error: error.message };
    }
}

/**
 * Public endpoint for serving thumbnails.
 * @param {express.Request} request - The Express request object.
 * @param {express.Response} response - The Express response object.
 */
publicRouter.get('/', async function (request, response) {
    try {
        const { file: rawFile, type, animated } = request.query;
        if (typeof rawFile !== 'string' || typeof type !== 'string') return response.sendStatus(400);
        if (!(type === 'bg' || type === 'avatar' || type === 'persona')) {
            return response.sendStatus(400);
        }

        const file = sanitize(rawFile);
        if (file !== rawFile) return response.sendStatus(403);

        const serveOriginal = () => {
            const folder = getOriginalFolder(request.user.directories, type);
            const pathToOriginalFile = path.resolve(path.join(folder, file));
            if (!fs.existsSync(pathToOriginalFile)) return response.sendStatus(404);
            invalidateFirefoxCache(pathToOriginalFile, request, response);
            return response.sendFile(pathToOriginalFile);
        };

        if (!thumbnailsEnabled) {
            return serveOriginal();
        }

        const animatedEnabled = animated === 'true';
        const fileExtension = path.extname(file).toLowerCase();
        const isAnimatedFormat = SKIPPED_EXTENSIONS.has(fileExtension);

        // Serve original for animated formats or GIFs
        if (animatedEnabled && isAnimatedFormat) {
            return serveOriginal();
        }

        if (fileExtension === '.gif') {
            return serveOriginal();
        }

        const thumbnailFolder = getThumbnailFolder(request.user.directories, type);
        const pathToCachedFile = path.join(thumbnailFolder, file);

        // Try to generate thumbnail if it doesn't exist
        if (!fs.existsSync(pathToCachedFile)) {
            const thumbResult = await generateThumbnail(request.user.directories, type, file, false);
            // If generation failed (path is null), serve the original file
            if (!thumbResult.path) {
                return serveOriginal();
            }
        }

        if (fs.existsSync(pathToCachedFile)) {
            invalidateFirefoxCache(pathToCachedFile, request, response);
            return response.sendFile(file, { root: thumbnailFolder, dotfiles: 'allow' });
        }

        // Send a 404 so the frontend can display a placeholder
        return response.sendStatus(404);

    } catch (error) {
        console.error('Failed getting thumbnail', error);
        return response.sendStatus(500);
    }
});

export const router = express.Router();
router.use(publicRouter);
router.use(apiRouter);
