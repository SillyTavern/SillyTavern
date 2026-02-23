import fs from 'node:fs';
import path from 'node:path';

import express from 'express';
import sanitize from 'sanitize-filename';

import { invalidateThumbnail } from './thumbnails.js';
import { getOrGenerateMetadataBatch, removeMetadata, renameMetadata, thumbnailDimensions } from './image-metadata.js';
import { getImages } from '../util.js';
import { getFileNameValidationFunction } from '../middleware/validateFileName.js';

export const router = express.Router();

router.post('/all', async function (request, response) {
    try {
        const images = getImages(request.user.directories.backgrounds);
        const config = { width: thumbnailDimensions.bg[0], height: thumbnailDimensions.bg[1] };

        // Get metadata for all images to provide isAnimated flag to client
        const relativePaths = images.map(img => path.join('backgrounds', img));
        const { results: metadataMap } = await getOrGenerateMetadataBatch(request.user.directories.root, relativePaths, 'bg');

        // Build response with metadata for each image
        const imagesWithMetadata = images.map(img => {
            const relativePath = path.join('backgrounds', img);
            const metadata = metadataMap[relativePath];
            return {
                filename: img,
                isAnimated: metadata?.isAnimated ?? false,
            };
        });

        response.json({ images: imagesWithMetadata, config });
    } catch (error) {
        console.error('[Backgrounds] Error fetching backgrounds:', error);
        response.status(500).json({ error: 'Failed to fetch backgrounds' });
    }
});

router.post('/delete', getFileNameValidationFunction('bg'), async function (request, response) {
    try {
        if (!request.body) return response.sendStatus(400);

        if (request.body.bg !== sanitize(request.body.bg)) {
            console.error('Malicious bg name prevented');
            return response.sendStatus(403);
        }

        const fileName = path.join(request.user.directories.backgrounds, sanitize(request.body.bg));

        if (!fs.existsSync(fileName)) {
            console.error('BG file not found');
            return response.sendStatus(400);
        }

        fs.unlinkSync(fileName);
        invalidateThumbnail(request.user.directories, 'bg', request.body.bg);

        // Remove metadata for deleted image
        const relativePath = path.join('backgrounds', request.body.bg);
        await removeMetadata(request.user.directories.root, relativePath).catch(err => {
            console.warn('[Backgrounds] Failed to remove metadata:', err.message);
        });

        return response.send('ok');
    } catch (err) {
        console.error(err);
        response.sendStatus(500);
    }
});

router.post('/rename', async function (request, response) {
    try {
        if (!request.body) return response.sendStatus(400);

        const oldFileName = path.join(request.user.directories.backgrounds, sanitize(request.body.old_bg));
        const newFileName = path.join(request.user.directories.backgrounds, sanitize(request.body.new_bg));

        if (!fs.existsSync(oldFileName)) {
            console.error('BG file not found');
            return response.sendStatus(400);
        }

        if (fs.existsSync(newFileName)) {
            console.error('New BG file already exists');
            return response.sendStatus(400);
        }

        fs.copyFileSync(oldFileName, newFileName);
        fs.unlinkSync(oldFileName);
        invalidateThumbnail(request.user.directories, 'bg', request.body.old_bg);

        // Update metadata for renamed image
        const oldRelativePath = path.join('backgrounds', request.body.old_bg);
        const newRelativePath = path.join('backgrounds', request.body.new_bg);
        await renameMetadata(request.user.directories.root, oldRelativePath, newRelativePath).catch(err => {
            console.warn('[Backgrounds] Failed to rename metadata:', err.message);
        });

        return response.send('ok');
    } catch (err) {
        console.error(err);
        response.sendStatus(500);
    }
});

router.post('/upload', async function (request, response) {
    try {
        if (!request.body || !request.file) return response.sendStatus(400);

        const img_path = path.join(request.file.destination, request.file.filename);
        const filename = sanitize(request.file.originalname);

        fs.copyFileSync(img_path, path.join(request.user.directories.backgrounds, filename));
        fs.unlinkSync(img_path);
        invalidateThumbnail(request.user.directories, 'bg', filename);

        // Generate metadata for the new image
        const relativePath = path.join('backgrounds', filename);
        await getOrGenerateMetadataBatch(request.user.directories.root, [relativePath], 'bg').catch(err => {
            console.warn('[Backgrounds] Failed to generate metadata for upload:', err.message);
        });

        response.send(filename);
    } catch (err) {
        console.error(err);
        response.sendStatus(500);
    }
});
