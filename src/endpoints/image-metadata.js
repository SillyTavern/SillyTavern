/**
 * Generic image metadata service.
 * Provides on-demand metadata generation with file mtime-based caching.
 */

import * as fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { imageSize } from 'image-size';
import writeFileAtomic from 'write-file-atomic';
import express from 'express';
import { Jimp } from '../jimp.js';
import { getConfigValue, isPathUnderParent, uuidv4 } from '../util.js';

export const METADATA_FILE = 'image-metadata.json';

/**
 * @typedef {Object} ImageMetadata
 * @property {string} [hash] - SHA-256 hash of the image file.
 * @property {number} [aspectRatio] - Aspect ratio (width / height) of the image.
 * @property {boolean} [isAnimated] - Whether the image is animated.
 * @property {string} [dominantColor] - Dominant color in hex format (e.g., '#RRGGBB').
 * @property {string[]} folderIds - Array of virtual folder IDs the image belongs to.
 * @property {number} [addedTimestamp] - Timestamp when the image was added.
 * @property {number} [thumbnailResolution] - Thumbnail resolution (width * height) for cache invalidation.
 * @property {number} [mtime] - File modification time for cache invalidation (internal use).
 */

/**
 * @typedef {Object} MetadataIndex
 * @property {number} version - Metadata version.
 * @property {Object.<string, ImageMetadata>} images - Mapping of relative paths to their metadata.
 * @property {Array<{id: string, name: string, thumbnailFile: string}>} folders - Virtual folders.
 */

/**
 * @typedef {'bg' | 'avatar' | 'persona'} ThumbnailType
 */

/** @type {Record<string, number[]>} */
export const thumbnailDimensions = {
    'bg': getConfigValue('thumbnails.dimensions.bg', [160, 90]),
    'avatar': getConfigValue('thumbnails.dimensions.avatar', [96, 144]),
    'persona': getConfigValue('thumbnails.dimensions.persona', [96, 144]),
};

/**
 * Gets the configured resolution for a given thumbnail type.
 * @param {ThumbnailType} type Thumbnail type
 * @returns {number} Resolution (width * height)
 */
export function getThumbnailResolution(type) {
    const dims = thumbnailDimensions[type];
    if (Array.isArray(dims) && dims.length >= 2) {
        return Number(dims[0]) * Number(dims[1]);
    }
    return 0;
}

/**
 * Checks if a buffer contains an animated PNG (APNG) by looking for the 'acTL' chunk.
 * @param {Buffer} buffer The file buffer.
 * @returns {boolean}
 */
export function isAnimatedApng(buffer) {
    return buffer.subarray(0, 200).includes('acTL');
}

/**
 * Checks if a WebP buffer is animated by looking for 'ANIM' or 'ANMF' chunks.
 * @param {Buffer} buffer The WebP file buffer (can be full file or header)
 * @returns {boolean} True if the WebP is animated
 */
export function isAnimatedWebP(buffer) {
    const headerBuffer = buffer.length > 200 ? buffer.subarray(0, 200) : buffer;
    return headerBuffer.includes('ANIM') || headerBuffer.includes('ANMF');
}

/**
 * Calculate average color using Jimp.
 * Resizes the image to 1x1 to efficiently get the average color.
 * @param {Buffer} buffer The image buffer.
 * @returns {Promise<string>} The average color as a hex string (e.g., '#RRGGBB').
 */
async function getAverageColorWithJimp(buffer) {
    try {
        const image = await Jimp.read(buffer);
        image.resize({ w: 1, h: 1 });

        const colorInt = image.getPixelColor(0, 0);
        const r = (colorInt >> 24) & 255;
        const g = (colorInt >> 16) & 255;
        const b = (colorInt >> 8) & 255;

        const toHex = (c) => c.toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    } catch (error) {
        console.warn('[Jimp] Failed to calculate average color:', error.message);
        return '#808080';
    }
}

/**
 * Generates metadata for a single image file.
 * @param {string} filePath - The full path to the image file.
 * @param {ThumbnailType} type - The thumbnail type for resolution calculation.
 * @returns {Promise<ImageMetadata>} A metadata object. Throws an error if processing fails.
 */
export async function generateImageMetadata(filePath, type) {
    const buffer = await fs.readFile(filePath);
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const dimensions = imageSize(buffer);

    if (!dimensions || !dimensions.width || !dimensions.height) {
        throw new Error('Could not determine image dimensions.');
    }

    const aspectRatio = dimensions.width / dimensions.height;
    let isAnimated = false;

    switch (dimensions.type) {
        case 'gif':
            isAnimated = true;
            break;
        case 'png':
            isAnimated = isAnimatedApng(buffer);
            break;
        case 'webp':
            isAnimated = isAnimatedWebP(buffer);
            break;
    }

    let dominantColor;
    if (isAnimated) {
        dominantColor = '#808080';
    } else {
        dominantColor = await getAverageColorWithJimp(buffer);
    }

    let addedTimestamp;
    try {
        const stats = await fs.stat(filePath);
        addedTimestamp = Math.floor(stats.birthtimeMs || stats.mtimeMs);
    } catch {
        addedTimestamp = Date.now();
    }

    return {
        hash,
        aspectRatio: parseFloat(aspectRatio.toFixed(4)),
        isAnimated,
        dominantColor,
        folderIds: [],
        addedTimestamp,
        thumbnailResolution: getThumbnailResolution(type),
    };
}

/**
 * Reads the centralized metadata index from the user data root.
 * @param {string} userDataRoot - Path to the user data directory root
 * @returns {Promise<MetadataIndex>} The metadata index
 */
export async function readMetadataIndex(userDataRoot) {
    const indexPath = path.join(userDataRoot, METADATA_FILE);
    try {
        const rawData = await fs.readFile(indexPath, 'utf8');
        return JSON.parse(rawData);
    } catch {
        return { version: 1, images: {}, folders: [] };
    }
}

/**
 * Writes the centralized metadata index to the user data root.
 * @param {string} userDataRoot - Path to the user data directory root
 * @param {MetadataIndex} metadata - The metadata to write
 */
export async function writeMetadataIndex(userDataRoot, metadata) {
    const indexPath = path.join(userDataRoot, METADATA_FILE);
    const jsonString = JSON.stringify(metadata, null, 4);
    await writeFileAtomic(indexPath, jsonString, 'utf8');
}

/**
 * Gets metadata for multiple images, generating on-demand as needed.
 * Uses relative paths from the user data root as keys in the centralized index.
 * @param {string} userDataRoot - Path to the user data directory root
 * @param {string[]} relativePaths - Array of relative paths from userDataRoot
 * @param {ThumbnailType} type - The thumbnail type for resolution calculation.
 * @returns {Promise<{results: Object.<string, ImageMetadata>, generatedCount: number}>} Results map and count of newly generated
 */
export async function getOrGenerateMetadataBatch(userDataRoot, relativePaths, type) {
    /** @type {Object.<string, ImageMetadata>} */
    const results = {};
    const index = await readMetadataIndex(userDataRoot);
    let indexModified = false;
    let generatedCount = 0;

    for (const relativePath of relativePaths) {
        // Normalize the path to use forward slashes for consistent keys
        const posixPath = relativePath.replaceAll(path.sep, path.posix.sep);
        const fullPath = path.join(userDataRoot, relativePath);

        let stats;
        try {
            stats = await fs.stat(fullPath);
        } catch {
            continue; // File doesn't exist, skip
        }

        const currentMtime = stats.mtimeMs;
        const cached = index.images[posixPath];

        // If cached and not modified, use cached
        if (cached && cached.mtime === currentMtime) {
            results[relativePath] = cached;
            continue;
        }

        // Generate new metadata
        try {
            const metadata = await generateImageMetadata(fullPath, type);
            metadata.mtime = currentMtime;

            // Preserve folderIds if they existed
            if (cached?.folderIds) {
                metadata.folderIds = cached.folderIds;
            }

            index.images[posixPath] = metadata;
            results[relativePath] = metadata;
            indexModified = true;
            generatedCount++;
        } catch (error) {
            console.warn(`[ImageMetadata] Failed to generate metadata for ${relativePath}:`, error.message);
        }
    }

    // Write index if modified
    if (indexModified) {
        await writeMetadataIndex(userDataRoot, index);
    }

    return { results, generatedCount };
}

/**
 * Removes metadata for an image from the centralized index.
 * @param {string} userDataRoot - Path to the user data directory root
 * @param {string} relativePath - The relative path to remove
 */
export async function removeMetadata(userDataRoot, relativePath) {
    const posixPath = relativePath.replaceAll(path.sep, path.posix.sep);
    const index = await readMetadataIndex(userDataRoot);
    if (index.images[posixPath]) {
        delete index.images[posixPath];

        // Clear any folder thumbnailFile references that point to the deleted file
        const deletedFileName = path.posix.basename(posixPath);
        if (Array.isArray(index.folders)) {
            for (const folder of index.folders) {
                if (folder.thumbnailFile === deletedFileName) {
                    folder.thumbnailFile = '';
                }
            }
        }

        await writeMetadataIndex(userDataRoot, index);
    }
}

/**
 * Updates metadata for an image (e.g., after rename).
 * @param {string} userDataRoot - Path to the user data directory root
 * @param {string} oldRelativePath - The old relative path
 * @param {string} newRelativePath - The new relative path
 * @returns {Promise<ImageMetadata|null>} The updated metadata
 */
export async function renameMetadata(userDataRoot, oldRelativePath, newRelativePath) {
    const posixOldPath = oldRelativePath.replaceAll(path.sep, path.posix.sep);
    const posixNewPath = newRelativePath.replaceAll(path.sep, path.posix.sep);
    const index = await readMetadataIndex(userDataRoot);
    const data = index.images[posixOldPath];

    if (!data) {
        throw new Error(`Image '${oldRelativePath}' not found in metadata.`);
    }

    delete index.images[posixOldPath];
    index.images[posixNewPath] = data;

    // Update any folder thumbnailFile references that point to the old filename
    const oldFileName = path.posix.basename(posixOldPath);
    const newFileName = path.posix.basename(posixNewPath);
    if (oldFileName !== newFileName && Array.isArray(index.folders)) {
        for (const folder of index.folders) {
            if (folder.thumbnailFile === oldFileName) {
                folder.thumbnailFile = newFileName;
            }
        }
    }

    await writeMetadataIndex(userDataRoot, index);

    return data;
}

/**
 * Cleans up orphaned entries from the metadata index.
 * Iterates over all entries and removes those whose files no longer exist.
 * @param {string} userDataRoot - Path to the user data directory root
 * @returns {Promise<string[]>} Array of removed paths
 */
export async function cleanupOrphanedMetadata(userDataRoot) {
    const index = await readMetadataIndex(userDataRoot);
    const orphanedPaths = [];

    for (const relativePath of Object.keys(index.images)) {
        const fullPath = path.resolve(userDataRoot, relativePath);

        if (!isPathUnderParent(userDataRoot, fullPath)) {
            orphanedPaths.push(relativePath);
            delete index.images[relativePath];
            continue;
        }

        try {
            await fs.access(fullPath);
        } catch {
            // File doesn't exist, mark for removal
            orphanedPaths.push(relativePath);
            delete index.images[relativePath];
        }
    }

    if (orphanedPaths.length > 0) {
        await writeMetadataIndex(userDataRoot, index);
        console.log(`[ImageMetadata] Cleaned up ${orphanedPaths.length} orphaned metadata entries`);
    }

    return orphanedPaths;
}

/**
 * Creates a new virtual folder.
 * @param {string} userDataRoot
 * @param {string} name
 * @returns {Promise<{id: string, name: string, thumbnailFile: string}>}
 */
export async function createFolder(userDataRoot, name) {
    const index = await readMetadataIndex(userDataRoot);
    const id = uuidv4();
    const folder = { id, name, thumbnailFile: '' };
    index.folders.push(folder);
    await writeMetadataIndex(userDataRoot, index);
    return folder;
}

/**
 * Sets thumbnail files for multiple folders in a single atomic read-modify-write.
 * Folders not found in the index are silently skipped.
 * @param {string} userDataRoot
 * @param {{id: string, thumbnailFile: string}[]} updates
 * @returns {Promise<void>}
 */
export async function setFolderThumbnailsBatch(userDataRoot, updates) {
    const index = await readMetadataIndex(userDataRoot);
    for (const { id, thumbnailFile } of updates) {
        const folder = index.folders.find(f => f.id === id);
        if (folder) {
            folder.thumbnailFile = thumbnailFile;
        }
    }
    await writeMetadataIndex(userDataRoot, index);
}

/**
 * Renames or updates a virtual folder.
 * @param {string} userDataRoot
 * @param {string} folderId
 * @param {{name?: string, thumbnailFile?: string}} updates
 * @returns {Promise<{id: string, name: string, thumbnailFile: string}>}
 */
export async function updateFolder(userDataRoot, folderId, updates) {
    const index = await readMetadataIndex(userDataRoot);
    const folder = index.folders.find(f => f.id === folderId);
    if (!folder) throw new Error(`Folder '${folderId}' not found.`);
    if (updates.name !== undefined) folder.name = updates.name;
    if (updates.thumbnailFile !== undefined) folder.thumbnailFile = updates.thumbnailFile;
    await writeMetadataIndex(userDataRoot, index);
    return folder;
}

/**
 * Deletes a virtual folder and removes its ID from all images.
 * @param {string} userDataRoot
 * @param {string} folderId
 * @returns {Promise<void>}
 */
export async function deleteFolder(userDataRoot, folderId) {
    const index = await readMetadataIndex(userDataRoot);
    const idx = index.folders.findIndex(f => f.id === folderId);
    if (idx === -1) throw new Error(`Folder '${folderId}' not found.`);
    index.folders.splice(idx, 1);
    // Remove folderId from all images
    for (const meta of Object.values(index.images)) {
        if (Array.isArray(meta.folderIds)) {
            const fi = meta.folderIds.indexOf(folderId);
            if (fi !== -1) meta.folderIds.splice(fi, 1);
        }
    }
    await writeMetadataIndex(userDataRoot, index);
}

/**
 * Assigns images to a folder.
 * @param {string} userDataRoot
 * @param {string} folderId
 * @param {string[]} relativePaths
 * @returns {Promise<void>}
 */
export async function assignImagesToFolder(userDataRoot, folderId, relativePaths) {
    const index = await readMetadataIndex(userDataRoot);
    if (!index.folders.some(f => f.id === folderId)) {
        throw new Error(`Folder '${folderId}' not found.`);
    }
    for (const rp of relativePaths) {
        const posixPath = rp.replaceAll(path.sep, path.posix.sep);

        // Validate: must be a backgrounds/ path, and no path-traversal segments
        const normalized = path.posix.normalize(posixPath);
        if (!normalized.startsWith('backgrounds/') || normalized.split('/').some(seg => seg === '..')) {
            throw new Error(`Invalid background path: '${posixPath}'`);
        }

        // Validate: skip silently on missing files
        const absPath = path.join(userDataRoot, normalized);
        try {
            await fs.access(absPath);
        } catch {
            console.warn(`[ImageMetadata] Skipping missing background file: '${posixPath}'`);
            continue;
        }

        let meta = index.images[normalized];
        if (!meta) {
            // Create a stub entry so folderIds can be stored even before full metadata generation
            meta = { folderIds: [] };
            index.images[normalized] = meta;
        }
        if (!Array.isArray(meta.folderIds)) meta.folderIds = [];
        if (!meta.folderIds.includes(folderId)) {
            meta.folderIds.push(folderId);
        }
    }
    await writeMetadataIndex(userDataRoot, index);
}

/**
 * Unassigns images from a folder.
 * @param {string} userDataRoot
 * @param {string} folderId
 * @param {string[]} relativePaths
 * @returns {Promise<void>}
 */
export async function unassignImagesFromFolder(userDataRoot, folderId, relativePaths) {
    const index = await readMetadataIndex(userDataRoot);
    for (const rp of relativePaths) {
        const posixPath = rp.replaceAll(path.sep, path.posix.sep);
        const meta = index.images[posixPath];
        if (!meta || !Array.isArray(meta.folderIds)) continue;
        const fi = meta.folderIds.indexOf(folderId);
        if (fi !== -1) meta.folderIds.splice(fi, 1);
    }
    await writeMetadataIndex(userDataRoot, index);
}

export const router = express.Router();

/**
 * POST /api/image-metadata/folders/get
 * List all virtual folders.
 */
router.post('/folders/get', async function (request, response) {
    try {
        const index = await readMetadataIndex(request.user.directories.root);
        return response.json(index.folders || []);
    } catch (error) {
        console.error('[ImageMetadata] Folders list error:', error);
        return response.status(500).json({ error: 'Internal server error.' });
    }
});

/**
 * POST /api/image-metadata/folders/create
 * Create a new folder. Body: { name: string }
 */
router.post('/folders/create', async function (request, response) {
    try {
        const { name } = request.body;
        if (!name || typeof name !== 'string') {
            return response.status(400).json({ error: '"name" is required.' });
        }
        const folder = await createFolder(request.user.directories.root, name.trim());
        return response.json(folder);
    } catch (error) {
        console.error('[ImageMetadata] Folder create error:', error);
        return response.status(500).json({ error: 'Internal server error.' });
    }
});

/**
 * POST /api/image-metadata/folders/set-thumbnails
 * Batch-set thumbnail files for multiple folders in one write. Body: { updates: [{id, thumbnailFile}] }
 */
router.post('/folders/set-thumbnails', async function (request, response) {
    try {
        const { updates } = request.body;
        if (!Array.isArray(updates) || updates.some(u => !u.id || typeof u.thumbnailFile !== 'string')) {
            return response.status(400).json({ error: '"updates" must be an array of {id, thumbnailFile}.' });
        }
        await setFolderThumbnailsBatch(request.user.directories.root, updates);
        return response.json({ ok: true });
    } catch (error) {
        console.error('[ImageMetadata] Folder set-thumbnails error:', error);
        return response.status(500).json({ error: 'Internal server error.' });
    }
});

/**
 * POST /api/image-metadata/folders/update
 * Update a folder. Body: { id: string, name?: string, thumbnailFile?: string }
 */
router.post('/folders/update', async function (request, response) {
    try {
        const { id, ...updates } = request.body;
        if (!id || typeof id !== 'string') {
            return response.status(400).json({ error: '"id" is required.' });
        }
        const folder = await updateFolder(request.user.directories.root, id, updates);
        return response.json(folder);
    } catch (error) {
        if (error.message.includes('not found')) {
            return response.status(404).json({ error: error.message });
        }
        console.error('[ImageMetadata] Folder update error:', error);
        return response.status(500).json({ error: 'Internal server error.' });
    }
});

/**
 * POST /api/image-metadata/folders/delete
 * Delete a folder and unassign all images. Body: { id: string }
 */
router.post('/folders/delete', async function (request, response) {
    try {
        const { id } = request.body;
        if (!id || typeof id !== 'string') {
            return response.status(400).json({ error: '"id" is required.' });
        }
        await deleteFolder(request.user.directories.root, id);
        return response.json({ ok: true });
    } catch (error) {
        if (error.message.includes('not found')) {
            return response.status(404).json({ error: error.message });
        }
        console.error('[ImageMetadata] Folder delete error:', error);
        return response.status(500).json({ error: 'Internal server error.' });
    }
});

/**
 * POST /api/image-metadata/folders/assign
 * Assign images to a folder. Body: { id: string, paths: string[] }
 */
router.post('/folders/assign', async function (request, response) {
    try {
        const { id, paths } = request.body;
        if (!id || typeof id !== 'string') {
            return response.status(400).json({ error: '"id" is required.' });
        }
        if (!Array.isArray(paths)) {
            return response.status(400).json({ error: '"paths" array is required.' });
        }
        await assignImagesToFolder(request.user.directories.root, id, paths);
        return response.json({ ok: true });
    } catch (error) {
        if (error.message.includes('not found')) {
            return response.status(404).json({ error: error.message });
        }
        console.error('[ImageMetadata] Folder assign error:', error);
        return response.status(500).json({ error: 'Internal server error.' });
    }
});

/**
 * POST /api/image-metadata/folders/unassign
 * Unassign images from a folder. Body: { id: string, paths: string[] }
 */
router.post('/folders/unassign', async function (request, response) {
    try {
        const { id, paths } = request.body;
        if (!id || typeof id !== 'string') {
            return response.status(400).json({ error: '"id" is required.' });
        }
        if (!Array.isArray(paths)) {
            return response.status(400).json({ error: '"paths" array is required.' });
        }
        await unassignImagesFromFolder(request.user.directories.root, id, paths);
        return response.json({ ok: true });
    } catch (error) {
        console.error('[ImageMetadata] Folder unassign error:', error);
        return response.status(500).json({ error: 'Internal server error.' });
    }
});

/**
 * POST /api/image-metadata
 * Get metadata for image(s) by path.
 */
router.post('/', async function (request, response) {
    try {
        const { path: singlePath, paths, type } = request.body;

        if (!singlePath && !paths) {
            return response.status(400).json({ error: 'Either "path" or "paths" is required.' });
        }

        const userDataRoot = request.user.directories.root;

        // Helper to validate a path is under user data directory
        const validatePath = (relativePath) => {
            const fullPath = path.resolve(userDataRoot, relativePath);
            if (!isPathUnderParent(userDataRoot, fullPath)) {
                throw new Error(`Path "${relativePath}" is outside the user data directory.`);
            }
            return relativePath;
        };

        // Handle single path
        if (singlePath && !paths) {
            const relativePath = validatePath(singlePath);
            const fullPath = path.join(userDataRoot, relativePath);

            try {
                await fs.access(fullPath);
            } catch {
                return response.status(404).json({ error: 'File not found.' });
            }

            const { results: metadataResults } = await getOrGenerateMetadataBatch(userDataRoot, [relativePath], type);
            const metadata = metadataResults[relativePath];

            if (!metadata) {
                return response.status(404).json({ error: 'Could not generate metadata for file.' });
            }

            return response.json(metadata);
        }

        // Handle multiple paths
        if (paths && Array.isArray(paths)) {
            /** @type {Object.<string, ImageMetadata|{error: string}>} */
            const results = {};
            const validPaths = [];

            // Validate all paths first
            for (const relativePath of paths) {
                try {
                    validatePath(relativePath);
                    validPaths.push(relativePath);
                } catch (error) {
                    results[relativePath] = { error: error.message };
                }
            }

            // Process all valid paths in a single batch
            const { results: batchMetadata } = await getOrGenerateMetadataBatch(userDataRoot, validPaths, type);

            for (const relativePath of validPaths) {
                if (batchMetadata[relativePath]) {
                    results[relativePath] = batchMetadata[relativePath];
                } else {
                    results[relativePath] = { error: 'File not found or could not process.' };
                }
            }

            return response.json(results);
        }

        return response.status(400).json({ error: 'Invalid request format.' });
    } catch (error) {
        console.error('[ImageMetadata] API error:', error);
        return response.status(500).json({ error: 'Internal server error.' });
    }
});

/**
 * POST /api/image-metadata/all
 * Get all metadata from the index.
 * @body {string} [prefix] - Optional path prefix to filter results
 */
router.post('/all', async function (request, response) {
    try {
        const userDataRoot = request.user.directories.root;
        const prefix = String(request.body.prefix || '');
        const index = await readMetadataIndex(userDataRoot);

        // If prefix specified, filter to only matching paths
        if (prefix) {
            const filteredImages = {};
            for (const [key, value] of Object.entries(index.images)) {
                if (key.startsWith(prefix)) {
                    filteredImages[key] = value;
                }
            }
            return response.json({ version: index.version, images: filteredImages });
        }

        return response.json(index);
    } catch (error) {
        console.error('[ImageMetadata] Failed to read metadata index:', error);
        return response.status(500).json({ error: 'Internal server error.' });
    }
});

/**
 * POST /api/image-metadata/cleanup
 * Clean up orphaned metadata entries (files that no longer exist).
 */
router.post('/cleanup', async function (request, response) {
    try {
        const userDataRoot = request.user.directories.root;
        const removed = await cleanupOrphanedMetadata(userDataRoot);
        return response.json({ removed, count: removed.length });
    } catch (error) {
        console.error('[ImageMetadata] Cleanup error:', error);
        return response.status(500).json({ error: 'Internal server error.' });
    }
});
