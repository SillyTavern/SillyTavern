import fs from 'node:fs';
import { promises as fsPromises } from 'node:fs';
import path from 'node:path';

import mime from 'mime-types';
import express from 'express';
import sanitize from 'sanitize-filename';
import sharp from 'sharp';
import { sync as writeFileAtomicSync } from 'write-file-atomic';

import { getConfigValue } from '../util.js';
/** @typedef {import('../users.js').UserDirectoryList} UserDirectoryList */

const thumbnailsEnabled = !!getConfigValue('thumbnails.enabled', true, 'boolean');
const quality = Math.min(100, Math.max(1, parseInt(getConfigValue('thumbnails.quality', 95, 'number'))));
const usePngFormat = String(getConfigValue('thumbnails.format', 'jpg')).toLowerCase().trim() === 'png';
const outputExtension = usePngFormat ? 'png' : 'jpg';
const outputMimeType = usePngFormat ? 'image/png' : 'image/jpeg';

/** @type {Record<string, [number, number]>} */
const dimensions = {
    'bg': getConfigValue('thumbnails.dimensions.bg', [160, 90]),
    'avatar': getConfigValue('thumbnails.dimensions.avatar', [96, 144]),
};

// Log only errors to the console
const logError = (...args) => console.error('[Thumbnails]', ...args);

/**
 * @param {UserDirectoryList} directories
 * @param {'bg' | 'avatar'} type
 * @returns {string | undefined}
 */
function getThumbnailFolder(directories, type) {
    switch (type) {
        case 'bg': return directories.thumbnailsBg;
        case 'avatar': return directories.thumbnailsAvatar;
        default: return undefined;
    }
}

/**
 * @param {UserDirectoryList} directories
 * @param {'bg' | 'avatar'} type
 * @returns {string | undefined}
 */
function getOriginalFolder(directories, type) {
    switch (type) {
        case 'bg': return directories.backgrounds;
        case 'avatar': return directories.characters;
        default: return undefined;
    }
}

/**
 * @param {UserDirectoryList} directories
 * @param {'bg' | 'avatar'} type
 * @param {string} originalFileName
 */
export function invalidateThumbnail(directories, type, originalFileName) {
    const folder = getThumbnailFolder(directories, type);
    if (!folder) {
        logError(`[invalidateThumbnail] Invalid thumbnail type "${type}" or directories.`);
        return;
    }

    const safeOriginalFileName = sanitize(path.basename(originalFileName));
     if (!safeOriginalFileName) {
        logError(`[invalidateThumbnail] Received invalid originalFileName: ${originalFileName}`);
        return;
    }

    const baseName = path.parse(safeOriginalFileName).name;
    const thumbnailFileName = `${baseName}.${outputExtension}`;
    const pathToThumbnail = path.join(folder, thumbnailFileName);

    try {
        if (fs.existsSync(pathToThumbnail)) {
            fs.rmSync(pathToThumbnail);
        }
    } catch (error) {
        logError(`[invalidateThumbnail] Failed to remove thumbnail ${pathToThumbnail}:`, error);
    }
}

/**
 * @param {UserDirectoryList} directories
 * @param {'bg' | 'avatar'} type
 * @param {string} originalFileName
 * @returns {Promise<string | null>}
 */
async function generateThumbnail(directories, type, originalFileName) {
    const thumbnailFolder = getThumbnailFolder(directories, type);
    if (!thumbnailFolder) {
        logError(`[generateThumbnail] Could not determine thumbnail folder for type=${type}`);
        return null;
    }
    const originalFolder = getOriginalFolder(directories, type);
    if (!originalFolder) {
        logError(`[generateThumbnail] Could not determine original folder for type=${type}`);
        return null;
    }

    const baseName = path.parse(originalFileName).name;
    const thumbnailFileName = `${baseName}.${outputExtension}`;
    const pathToCachedFile = path.join(thumbnailFolder, thumbnailFileName);
    const pathToOriginalFile = path.join(originalFolder, originalFileName);

    const originalFileExists = fs.existsSync(pathToOriginalFile);
    if (!originalFileExists) {
        return null;
    }

    const cachedFileExists = fs.existsSync(pathToCachedFile);
    let shouldRegenerate = false;
    if (cachedFileExists) {
        try {
            const originalStat = fs.statSync(pathToOriginalFile);
            const cachedStat = fs.statSync(pathToCachedFile);
            if (originalStat.mtimeMs > cachedStat.ctimeMs) {
                shouldRegenerate = true;
            }
        } catch (statError) {
            logError(`[generateThumbnail] Error stating files for ${originalFileName}, forcing regeneration:`, statError);
            shouldRegenerate = true;
        }
    } else {
        shouldRegenerate = true;
    }

    if (cachedFileExists && !shouldRegenerate) {
        return pathToCachedFile;
    }

    let processedBuffer = null;
    try {
        const targetSize = dimensions[type];
        if (!targetSize || targetSize.length !== 2 || isNaN(targetSize[0]) || isNaN(targetSize[1]) || targetSize[0] <= 0 || targetSize[1] <= 0) {
            logError(`[generateThumbnail] Invalid dimensions configured for type "${type}": ${targetSize}. Cannot generate thumbnail for ${originalFileName}`);
            return null;
        }
        const [targetWidth, targetHeight] = targetSize;

        const sharpInstance = sharp(pathToOriginalFile, { animated: false });

        sharpInstance.resize({
            width: targetWidth,
            height: targetHeight,
            fit: sharp.fit.cover
        });

        if (usePngFormat) {
            sharpInstance.png();
        } else {
            sharpInstance.jpeg({ quality: quality });
        }
        processedBuffer = await sharpInstance.toBuffer();

    } catch (processingError) {
        logError(`[generateThumbnail] Failed processing ${originalFileName}`);
        logError(`[generateThumbnail] Error: ${processingError.message}`);
        console.error("[Thumbnails] Stack:", processingError.stack); // Keep stack trace for debugging errors
        return null;
    }

    if (processedBuffer && processedBuffer.length > 0) {
        try {
            if (!fs.existsSync(thumbnailFolder)) {
                fs.mkdirSync(thumbnailFolder, { recursive: true });
            }
            writeFileAtomicSync(pathToCachedFile, processedBuffer);
        } catch (saveError) {
            logError(`[generateThumbnail] Failed to write thumbnail file: ${pathToCachedFile}`, saveError);
            return null;
        }
    } else {
        logError(`[generateThumbnail] Processing finished, but buffer empty/null for ${originalFileName}.`);
        return null;
    }

    return pathToCachedFile;
}

/**
 * @param {UserDirectoryList[]} directoriesList
 * @returns {Promise<void>}
 */
export async function ensureThumbnailCache(directoriesList) {
    console.info('[Thumbnails] Starting thumbnail cache validation/generation...'); // Keep startup info log
    let totalGenerated = 0;
    const allowedExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.avif', '.heic', '.heif']);

    for (const directories of directoriesList) {
        const userId = directories.userData || directories.root || 'unknown_user';
        const thumbnailBgDir = directories.thumbnailsBg;
        const backgroundsDir = directories.backgrounds;

        if (!thumbnailBgDir || !backgroundsDir) {
            logError(`[ensureThumbnailCache] Missing 'thumbnailsBg' or 'backgrounds' path in directories object for ${userId}. Skipping.`);
            continue;
        }

        if (!fs.existsSync(backgroundsDir)) {
            continue;
        }
        if (!fs.existsSync(thumbnailBgDir)) {
             try {
                 fs.mkdirSync(thumbnailBgDir, { recursive: true });
             } catch(e) {
                 logError(`[ensureThumbnailCache] Failed to create thumbnail dir: ${thumbnailBgDir}`, e);
                 continue;
             }
        }

        let bgFiles = [];
        try {
            bgFiles = fs.readdirSync(backgroundsDir);
        } catch (readDirError) {
             logError(`[ensureThumbnailCache] Failed to read backgrounds directory: ${backgroundsDir}`, readDirError);
             continue;
        }

        const tasks = [];
        let generatedCount = 0;

        for (const file of bgFiles) {
            const originalFilePath = path.join(backgroundsDir, file);
            const fileExt = path.extname(file).toLowerCase();

            if (!allowedExtensions.has(fileExt)) continue;

            try {
                if (!fs.statSync(originalFilePath).isFile()) continue;
            } catch (statError){
                 logError(`[ensureThumbnailCache] Could not stat file ${originalFilePath}, skipping. Error: ${statError.message}`);
                 continue;
            }

            const baseName = path.parse(file).name;
            const thumbnailFileName = `${baseName}.${outputExtension}`;
            const pathToCachedFile = path.join(thumbnailBgDir, thumbnailFileName);

            if (!fs.existsSync(pathToCachedFile)) {
                tasks.push(
                    generateThumbnail(directories, 'bg', file)
                        .then(result => { if (result) generatedCount++; })
                        .catch(err => { /* Error already logged */ })
                );
            }
        }

        if (tasks.length > 0) {
            console.info(`[Thumbnails] Found ${tasks.length} missing thumbnails for ${userId}, generating...`); // Keep info log
            try {
                await Promise.all(tasks);
                 console.info(`[Thumbnails] Completed generation for ${userId}. New thumbnails: ${generatedCount}.`); // Keep info log
            } catch (promiseAllError) {
                 logError(`[ensureThumbnailCache] Error during Promise.all for thumbnail generation: ${promiseAllError}`);
            }
            totalGenerated += generatedCount;
        }
    }
     console.info(`[Thumbnails] Thumbnail cache validation/generation finished. Total new thumbnails generated: ${totalGenerated}`); // Keep final summary info log
}

export const router = express.Router();

router.get('/', async (request, response) => {
    try {
        if (typeof request.query.file !== 'string' || typeof request.query.type !== 'string') {
            return response.status(400).send('Missing or invalid "file" or "type" query parameter.');
        }
        const type = request.query.type === 'bg' ? 'bg' : request.query.type === 'avatar' ? 'avatar' : null;
        if (!type) {
             return response.status(400).send('Invalid "type" parameter. Use "bg" or "avatar".');
        }
        const requestedFile = request.query.file;
        const sanitizedFile = sanitize(path.basename(requestedFile));
        if (sanitizedFile !== path.basename(requestedFile) || !sanitizedFile) {
            logError(`Malicious or invalid filename prevented: ${requestedFile}`);
            return response.status(403).send('Invalid filename.');
        }
        const file = sanitizedFile;

        if (!request.user?.directories) {
             logError('User directory information not found on request object.');
             return response.status(500).send('Internal server configuration error.');
        }
        const directories = request.user.directories;

        const originalFolder = getOriginalFolder(directories, type);
        if (!originalFolder) {
            logError(`Router: Could not determine original folder for type=${type}.`);
            return response.status(400).send('Invalid type mapping or directory configuration.');
        }
        const originalFilePath = path.join(originalFolder, file);

        if (!thumbnailsEnabled) {
            if (!fs.existsSync(originalFilePath)) {
                return response.status(404).send('Original file not found.');
            }
            try {
                const contentType = mime.lookup(originalFilePath) || 'application/octet-stream';
                const originalFileBuffer = await fsPromises.readFile(originalFilePath);
                response.setHeader('Content-Type', contentType);
                response.setHeader('Cache-Control', 'public, max-age=3600');
                return response.send(originalFileBuffer);
            } catch (readError) {
                logError(`Error reading original file ${originalFilePath}:`, readError);
                return response.status(500).send('Error reading file.');
            }
        }

        const pathToCachedFile = await generateThumbnail(directories, type, file);

        if (!pathToCachedFile) {
            return response.status(404).send('Thumbnail not available or generation failed.');
        }
        if (!fs.existsSync(pathToCachedFile)) {
             logError(`Router: Thumbnail path returned (${pathToCachedFile}) but file does not exist.`);
             return response.status(404).send('Thumbnail generation failed unexpectedly.');
        }

        try {
            const cachedFileBuffer = await fsPromises.readFile(pathToCachedFile);
            response.setHeader('Content-Type', outputMimeType);
            response.setHeader('Cache-Control', 'public, max-age=86400');
            return response.send(cachedFileBuffer);
        } catch (readError) {
            logError(`Error reading cached thumbnail file ${pathToCachedFile}:`, readError);
            return response.status(500).send('Error reading thumbnail file.');
        }

    } catch (error) {
        logError('Unexpected error in thumbnail route:', error);
        return response.status(500).send('Internal Server Error');
    }
});