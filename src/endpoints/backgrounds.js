import fs from 'node:fs';
import path from 'node:path';

import express from 'express';
import multer from 'multer';
import sanitize from 'sanitize-filename';

import { invalidateThumbnail } from './thumbnails.js';
import { getMediaFiles } from '../util.js';
import { getFileNameValidationFunction } from '../middleware/validateFileName.js';

const mediaStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        try {
            const userBackgroundsPath = req.user.directories.backgrounds;
            if (!fs.existsSync(userBackgroundsPath)) {
                fs.mkdirSync(userBackgroundsPath, { recursive: true });
            }
            cb(null, userBackgroundsPath); // Save directly to user's backgrounds folder
        } catch (error) {
            console.error('Error setting upload destination:', error);
            cb(error, null);
        }
    },
    filename: (req, file, cb) => {
        const sanitizedFilename = sanitize(file.originalname);
        if (!sanitizedFilename) {
            return cb(new Error('Invalid filename after sanitization results in empty string.'), null);
        }
        cb(null, sanitizedFilename);
    },
});

// Filter to accept only image/* or video/* mimetypes
const mediaFileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type: Only image or video files are allowed.'), false);
    }
};

// Set a combined file size limit (e.g., 100MB) - adjust as needed
const MEDIA_UPLOAD_LIMIT_MB = 100;
const MEDIA_UPLOAD_LIMIT_BYTES = MEDIA_UPLOAD_LIMIT_MB * 1024 * 1024;

const uploadMedia = multer({
    storage: mediaStorage,
    fileFilter: mediaFileFilter,
    limits: {
        fileSize: MEDIA_UPLOAD_LIMIT_BYTES,
    },
});

export const router = express.Router();

router.post('/all', function (request, response) {
    try {
        var mediaFiles = getMediaFiles(request.user.directories.backgrounds);
        response.send(JSON.stringify(mediaFiles));
    } catch (error) {
        console.error('Error fetching media files:', error);
        response.status(500).send('Error fetching media files.');
    }
});

router.post('/delete', getFileNameValidationFunction('bg'), function (request, response) {
    const dir = request.user.directories.backgrounds;
    const file = request.body.bg;

    if (!file) {
        return response.status(400).send('Filename missing.');
    }

    const filePath = path.join(dir, file);

    try {
        if (!filePath.startsWith(dir)) {
             console.warn(`Attempt to delete file outside designated directory blocked: ${file}`);
             return response.status(403).send('Forbidden.');
        }

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            invalidateThumbnail(request.user.directories, 'bg', file);
            return response.send('Ok');
        } else {
            console.warn(`Attempt to delete non-existent file: ${file}`);
            return response.status(404).send('File not found.');
        }
    } catch (err) {
        console.error(`Error deleting file ${file}:`, err);
        return response.status(500).send('Error deleting file.');
    }
});

router.post('/rename', function (request, response) {
    const dir = request.user.directories.backgrounds;
    const oldFile = request.body.old_bg;
    const newFile = request.body.new_bg;

    if (!oldFile || !newFile) {
        return response.status(400).send('Old or new filename missing.');
    }

    const sanitizedNewFile = sanitize(newFile);
    if (!sanitizedNewFile || sanitizedNewFile !== newFile) {
         return response.status(400).send('Invalid new filename.');
    }


    const oldFilePath = path.join(dir, oldFile);
    const newFilePath = path.join(dir, sanitizedNewFile);

    // Basic security checks
    if (!oldFilePath.startsWith(dir) || !newFilePath.startsWith(dir)) {
        console.warn(`Attempt to rename file outside designated directory blocked: ${oldFile} -> ${sanitizedNewFile}`);
        return response.status(403).send('Forbidden.');
    }

    try {
        if (fs.existsSync(oldFilePath)) {
            fs.renameSync(oldFilePath, newFilePath);
            // Invalidate caches for both old and new names
            invalidateThumbnail(request.user.directories, 'bg', oldFile);
            invalidateThumbnail(request.user.directories, 'bg', sanitizedNewFile);
            return response.send('ok');
        } else {
            console.warn(`Attempt to rename non-existent file: ${oldFile}`);
            return response.status(404).send('Original file not found.');
        }
    } catch (err) {
        console.error(`Error renaming file ${oldFile} to ${sanitizedNewFile}:`, err);
        return response.status(500).send('Error renaming file.');
    }
});

router.post('/upload', uploadMedia.single('avatar'), (req, res, next) => {
    // 'uploadMedia' middleware runs before this. Saves file directly. Calls next(err) on failure.

    // Safety check: Ensure file object exists (should be caught by error handler otherwise)
    if (!req.file) {
        console.warn('/upload route reached without req.file.');
        return res.status(400).json({ success: false, error: 'No valid file received or upload failed unexpectedly.' });
    }

    const uploadedFilePath = req.file.path;

    try {
        const uploadedFilename = req.file.filename;
        const mimeType = req.file.mimetype;

        if (mimeType.startsWith('image/')) {
            invalidateThumbnail(req.user.directories, 'bg', uploadedFilename);
            res.status(200).json({
                success: true,
                type: 'image',
                fileName: uploadedFilename,
            });
        } else if (mimeType.startsWith('video/')) {
            const videoUrl = `/user-files/backgrounds/${encodeURIComponent(uploadedFilename)}`;
            res.status(200).json({
                success: true,
                type: 'video',
                fileName: uploadedFilename,
                videoUrl: videoUrl,
            });
        } else {
            console.warn(`Unexpected file type after upload: ${mimeType}. Deleting file: ${uploadedFilePath}`);
            try {
                fs.unlinkSync(uploadedFilePath);
            } catch (cleanupError) {
                console.error(`Failed to delete unexpected file type ${uploadedFilePath}:`, cleanupError);
            }
            res.status(400).json({ success: false, error: 'Uploaded file was not an image or video.' });
        }
    } catch (error) {
        console.error('Error processing uploaded media:', error);
        if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
            try {
                console.warn(`Attempting to delete file due to processing error: ${uploadedFilePath}`);
                fs.unlinkSync(uploadedFilePath);
            } catch (cleanupError) {
                console.error(`Failed to delete file ${uploadedFilePath} after processing error:`, cleanupError);
            }
        }
        next(error);
    }
}, (err, req, res, next) => {
    // Handle Multer-specific errors (e.g., file size, file type filter)
    if (err instanceof multer.MulterError) {
        console.warn(`Multer upload error: ${err.message}`);
        return res.status(400).json({ success: false, error: `Upload failed: ${err.message}` });
    }
    else if (err) {
        console.error(`Media upload processing error: ${err.message}`);
        return res.status(500).json({ success: false, error: err.message || 'Server error during upload.' });
    }

});