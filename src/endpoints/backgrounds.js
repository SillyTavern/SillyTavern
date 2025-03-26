import fs from 'node:fs';
import path from 'node:path';

import express from 'express';
import multer from 'multer';
import sanitize from 'sanitize-filename';

import { invalidateThumbnail } from './thumbnails.js';
import { getMediaFiles } from '../util.js';
import { getFileNameValidationFunction } from '../middleware/validateFileName.js';

// --- START: Multer Configuration for Video Uploads ---

const videoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        try {
            // Get the target directory directly from user context (matches existing /upload logic pattern)
            const userBackgroundsPath = req.user.directories.backgrounds;

            // Ensure the directory exists (synchronous, matching existing style)
            // Check if it exists first to avoid potential errors if permissions are weird
            if (!fs.existsSync(userBackgroundsPath)) {
                fs.mkdirSync(userBackgroundsPath, { recursive: true });
            }

            cb(null, userBackgroundsPath); // Tell multer where to save
        } catch (error) {
            console.error('Error setting upload destination:', error);
            // Pass error to multer's error handling
            cb(error, null);
        }
    },
    filename: (req, file, cb) => {
        // Sanitize the original filename before saving (matches existing /rename, /delete logic)
        const sanitizedFilename = sanitize(file.originalname);
        // Basic check: if sanitization results in empty string, reject
        if (!sanitizedFilename) {
            // Pass an error to multer's error handling
            return cb(new Error('Invalid filename after sanitization results in empty string.'), null);
        }
        cb(null, sanitizedFilename); // Use the sanitized name
    },
});

// Define file filter to accept only video/* mimetypes
const videoFileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
        cb(null, true); // Accept file
    } else {
        // Reject file - pass an error for clearer feedback to the client via error handler
        cb(new Error('Invalid file type: Only video files are allowed.'), false);
    }
};

// Set a reasonable file size limit (e.g., 100MB) - adjust as needed
const VIDEO_UPLOAD_LIMIT_MB = 100;
const VIDEO_UPLOAD_LIMIT_BYTES = VIDEO_UPLOAD_LIMIT_MB * 1024 * 1024;

// Create the Multer instance configured for video uploads
const uploadVideo = multer({
    storage: videoStorage,
    fileFilter: videoFileFilter,
    limits: {
        fileSize: VIDEO_UPLOAD_LIMIT_BYTES,
    },
});

// --- END: Multer Configuration ---

// --- START: Multer Configuration for Image Uploads ---

// Use multer's default disk storage (saves to OS temp directory)
// Or explicitly define a temp directory if needed:
// const tempImageStorage = multer.diskStorage({ destination: '/path/to/temp' });

// Define file filter for images
const imageFileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true); // Accept file
    } else {
        cb(new Error('Invalid file type: Only image files are allowed.'), false);
    }
};

// Set image file size limit (e.g., 10MB) - adjust as needed
const IMAGE_UPLOAD_LIMIT_MB = 10;
const IMAGE_UPLOAD_LIMIT_BYTES = IMAGE_UPLOAD_LIMIT_MB * 1024 * 1024;

// Create the Multer instance configured for image uploads
// Using default storage (temp files)
const uploadImage = multer({
    // storage: tempImageStorage, // Use default temp storage
    fileFilter: imageFileFilter,
    limits: {
        fileSize: IMAGE_UPLOAD_LIMIT_BYTES,
    },
});

// --- END: Multer Configuration for Image Uploads ---

export const router = express.Router();

router.post('/all', function (request, response) {
    var mediaFiles = getMediaFiles(request.user.directories.backgrounds); // Correct function call
    response.send(JSON.stringify(mediaFiles));
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
    invalidateThumbnail(request.user.directories, 'bg', request.body.bg);
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
    invalidateThumbnail(request.user.directories, 'bg', request.body.old_bg);
    return response.send('ok');
});

// Apply the specific 'uploadImage' middleware here.
// 'avatar' MUST match the name attribute of the image input in HTML (<input id="add_bg_button" name="avatar" ...>).
router.post('/upload', uploadImage.single('avatar'), function (request, response, next) { // Added 'next' for error handling
    // 'uploadImage.single()' middleware runs BEFORE this handler.
    // It saves the file to a temporary location.
    // If error (filter, size), it calls next(err).

    // Check if middleware succeeded and provided req.file
    if (!request.file) {
        // Should have been caught by error handler below, but good fallback.
        console.warn('/upload reached without req.file.');
        return response.status(400).send('No valid image file received or upload failed unexpectedly.');
    }

    // Get temp path and sanitized original filename from req.file
    const tempFilePath = request.file.path; // Path to the temp file saved by multer
    const finalFilename = sanitize(request.file.originalname); // Sanitize original name

    // Basic check for empty filename after sanitization
    if (!finalFilename) {
        // Clean up temp file before sending error
        fs.unlink(tempFilePath, (err) => { if (err) console.error('Error deleting temp upload file after sanitization failure:', err); });
        return response.status(400).send('Invalid filename after sanitization.');
    }

    const finalPath = path.join(request.user.directories.backgrounds, finalFilename);

    try {
        // Copy from temp location to final user directory
        // Use rename for efficiency if possible (might cross partitions, so copy is safer)
        fs.copyFileSync(tempFilePath, finalPath);
        // Clean up temp file AFTER successful copy
        fs.unlinkSync(tempFilePath); // Use sync here for simplicity within try block

        invalidateThumbnail(request.user.directories, 'bg', finalFilename);
        response.send(finalFilename); // Send back just the filename (original behavior)
    } catch (err) {
        console.error('Error processing/copying uploaded image:', err);
        // Clean up temp file if it still exists on error
        if (fs.existsSync(tempFilePath)) {
            fs.unlink(tempFilePath, (unlinkErr) => { if (unlinkErr) console.error('Error deleting temp upload file after copy error:', unlinkErr); });
        }
        // Pass error to a potential downstream error handler or send 500
        // response.sendStatus(500);
        next(err); // Use next() for better error handling pattern
    }
// Add a route-specific error handler similar to the video one
}, (err, req, res, next) => {
    // --- Route-Specific Error Handler for Multer (Images) ---
    if (err instanceof multer.MulterError) {
        console.warn(`Multer upload error for image: ${err.message}`);
        return res.status(400).send(`Upload failed: ${err.message}`); // Send plain text like original?
    } else if (err) {
        console.error(`Image upload error: ${err.message}`);
        return res.status(500).send(err.message || 'Server error during image upload.');
    }
    next();
});
// --- START: NEW Route - Handle Video Background Upload ---
// Apply our specific 'uploadVideo' multer middleware here.
// 'backgroundVideo' MUST match the name attribute of the <input type="file"> in HTML.
router.post('/upload-video', uploadVideo.single('backgroundVideo'), (req, res, next) => {
    // 'uploadVideo.single()' middleware runs BEFORE this handler.
    // It uses 'videoStorage' to save directly to req.user.directories.backgrounds.
    // It uses 'videoFileFilter' and checks limits.
    // If an error occurs there (filter, size, disk), it calls 'next(err)'.

    // If we get here, and req.file exists, the upload was physically successful.
    if (!req.file) {
        // This case *shouldn't* normally happen if multer failed, as it should call next(err).
        // But as a fallback, send a generic error.
        console.warn('/upload-video reached without req.file, multer might not have passed error correctly.');
        return res.status(400).json({ success: false, error: 'No video file received or upload failed unexpectedly.' });
    }

    // File was successfully saved by multer's videoStorage.
    try {
        const uploadedFilename = req.file.filename; // This is the sanitized filename saved to disk

        // Construct the URL the frontend will use via the static server middleware.
        // Uses the hardcoded 'backgrounds' path segment.
        const videoUrl = `/user-files/backgrounds/${encodeURIComponent(uploadedFilename)}`;

        // Send the success response expected by the frontend JS
        res.status(200).json({
            success: true,
            fileName: uploadedFilename,
            videoUrl: videoUrl,
        });

    } catch (error) {
        // Catch any unexpected errors during URL construction or response sending
        console.error('Error processing successful video upload:', error);
        // Pass to the next error handler (could be Express default or a custom one)
        next(error);
    }
}, (err, req, res, next) => {
    // --- Route-Specific Error Handler for Multer ---
    // This catches errors passed by `next(err)` from the `uploadVideo` middleware or the main handler.
    if (err instanceof multer.MulterError) {
        // Handle specific Multer errors (e.g., file too large)
        console.warn(`Multer upload error for video: ${err.message}`);
        return res.status(400).json({ success: false, error: `Upload failed: ${err.message}` }); // Provide Multer's message
    } else if (err) {
        // Handle other errors (e.g., disk space, filter error, sanitization error, processing error)
        console.error(`Video upload error: ${err.message}`);
        // Send back the specific error message if available (like 'Invalid file type')
        return res.status(500).json({ success: false, error: err.message || 'Server error during upload.' });
    }
    // If no error, theoretically pass control, though it shouldn't be needed here.
    next();
});
// --- END: NEW Route ---
