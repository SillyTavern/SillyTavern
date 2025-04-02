import fs from 'node:fs';
import path from 'node:path';

import express from 'express';
import sanitize from 'sanitize-filename';
import mime from 'mime-types';

import { invalidateThumbnail } from './thumbnails.js';
import { getMediaFiles } from '../util.js';
import { getFileNameValidationFunction } from '../middleware/validateFileName.js';

export const router = express.Router();

router.post('/all', function (request, response) {
    try {
        var media = getMediaFiles(request.user.directories.backgrounds);
        response.send(JSON.stringify(media));
    } catch (error) {
        console.error('Error fetching media files in /api/backgrounds/all:', error);
        response.status(500).send('Error fetching background media.');
    }
});

router.post('/delete', getFileNameValidationFunction('bg'), function (request, response) {
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
    fs.rmSync(fileName);
    invalidateThumbnail(request.user.directories, 'bg', request.body.bg); // Harmless for videos
    return response.send('ok');
});

router.post('/rename', function (request, response) {
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
    fs.rmSync(oldFileName);
    invalidateThumbnail(request.user.directories, 'bg', request.body.old_bg); // Harmless for videos
    return response.send('ok');
});

// Unified route
// Relies on the global multer instance configured in server.js
router.post('/upload', function (request, response) {
    // Global multer should have processed the file into req.file by now
    if (!request.body || !request.file) {
        // If file is missing here, multer likely rejected it or failed
        console.warn('Background upload request missing file data.');
        return response.status(400).json({ success: false, error: 'No file data received or upload failed before processing.' });
    }

    const tempPath = request.file.path; // Path to temp file from global multer
    let destinationPath = '';          // Final destination path (set below)
    let responseData = { success: false }; // Default error response
    let fileType = 'unknown';

    try {
        const mimeType = request.file.mimetype || mime.lookup(request.file.originalname); // Get MIME type
        const originalFilename = request.file.originalname;
        const finalFilename = sanitize(originalFilename); // Sanitize the filename

        if (!finalFilename) {
            throw new Error('Invalid filename after sanitization.');
        }

        destinationPath = path.join(request.user.directories.backgrounds, finalFilename);
        const userBackgroundsDir = request.user.directories.backgrounds;

        // Ensure the destination directory exists
        if (!fs.existsSync(userBackgroundsDir)) {
            fs.mkdirSync(userBackgroundsDir, { recursive: true });
        }

        // Prevent overwriting existing files
        if (fs.existsSync(destinationPath)) {
            throw new Error(`File "${finalFilename}" already exists.`);
        }

        // Determine type and response data
        if (mimeType && mimeType.startsWith('image/')) {
            fileType = 'image';
            responseData = { success: true, type: 'image', fileName: finalFilename };
            // Copy the file from temp location to final destination
            fs.copyFileSync(tempPath, destinationPath);
            // Invalidate thumbnail cache only for images
            invalidateThumbnail(request.user.directories, 'bg', finalFilename);
        } else if (mimeType && mimeType.startsWith('video/')) {
            fileType = 'video';
            // Construct the URL based on the confirmed /backgrounds/ path
            const videoUrl = `/backgrounds/${encodeURIComponent(finalFilename)}`;
            responseData = { success: true, type: 'video', fileName: finalFilename, videoUrl: videoUrl };
            // Copy the file from temp location to final destination
            fs.copyFileSync(tempPath, destinationPath);
        } else {
            // Invalid file type, don't copy, prepare error response
            console.warn(`Background upload: Invalid file type "${mimeType}" for file "${originalFilename}".`);
            responseData = { success: false, error: 'Invalid file type (must be image or video).' };
            // No copy needed, temp file will be cleaned up in finally block
        }

        // Send the response
        if (responseData.success) {
            return response.status(200).json(responseData);
        } else {
            return response.status(400).json(responseData);
        }

    } catch (error) {
        console.error('Error processing background upload:', error);
        // Attempt cleanup of final file if copy happened before error
        if (fileType !== 'unknown' && destinationPath && fs.existsSync(destinationPath)) {
            try { fs.unlinkSync(destinationPath); } catch (e) { /* ignore cleanup error */ }
        }
        return response.status(500).json({ success: false, error: error.message || 'Server error processing upload.' });
    } finally {
        // Always attempt to clean up the temporary file from global multer
        if (tempPath && fs.existsSync(tempPath)) {
            try {
                fs.unlinkSync(tempPath);
            } catch (unlinkErr) {
                console.error(`Failed to delete temporary upload file: ${tempPath}`, unlinkErr);
            }
        }
    }
});
