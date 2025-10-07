import path from 'node:path';
import fs from 'node:fs';

import express from 'express';
import sanitize from 'sanitize-filename';
import { Jimp } from '../jimp.js';
import { sync as writeFileAtomicSync } from 'write-file-atomic';

import { getImages, tryParse } from '../util.js';
import { getFileNameValidationFunction } from '../middleware/validateFileName.js';
import { applyAvatarCropResize } from './characters.js';
import { invalidateThumbnail } from './thumbnails.js';
import cacheBuster from '../middleware/cacheBuster.js';

export const router = express.Router();

router.post('/get', function (request, response) {
    const images = getImages(request.user.directories.avatars);
    response.send(images);
});

router.post('/delete', getFileNameValidationFunction('avatar'), function (request, response) {
    if (!request.body) return response.sendStatus(400);

    if (request.body.avatar !== sanitize(request.body.avatar)) {
        console.error('Malicious avatar name prevented');
        return response.sendStatus(403);
    }

    const fileName = path.join(request.user.directories.avatars, sanitize(request.body.avatar));

    if (fs.existsSync(fileName)) {
        fs.unlinkSync(fileName);
        invalidateThumbnail(request.user.directories, 'persona', sanitize(request.body.avatar));
        return response.send({ result: 'ok' });
    }

    return response.sendStatus(404);
});

router.post('/upload', getFileNameValidationFunction('overwrite_name'), async (request, response) => {
    // support both request.file and request.files
    let fileObj = request.file;
    if (!fileObj && request.files) {
        if (Array.isArray(request.files)) fileObj = request.files[0];
        else {
            const keys = Object.keys(request.files);
            if (keys.length > 0 && Array.isArray(request.files[keys[0]]) && request.files[keys[0]][0]) {
                fileObj = request.files[keys[0]][0];
            }
        }
    }

    if (!fileObj) return response.sendStatus(400);

    try {
        const pathToUpload = path.join(fileObj.destination, fileObj.filename);
        const crop = tryParse(request.query.crop);
        const rawImg = await Jimp.read(pathToUpload);
        const image = await applyAvatarCropResize(rawImg, crop);

        // Remove previous thumbnail and bust cache if overwriting
        if (request.body.overwrite_name) {
            invalidateThumbnail(request.user.directories, 'persona', sanitize(request.body.overwrite_name));
            cacheBuster.bust(request, response);
        }

        const filename = sanitize(request.body.overwrite_name || `${Date.now()}.png`);
        const pathToNewFile = path.join(request.user.directories.avatars, filename);
        writeFileAtomicSync(pathToNewFile, image);
        try { fs.unlinkSync(pathToUpload); } catch (e) { void e; }

        // If client uploaded a companion 'video_avatar' field, persist it into the user's avatars folder
        let videoSavedName = null;
        try {
            const filesObj = request.files;
            let videoFile = null;
            if (filesObj) {
                if (Array.isArray(filesObj)) videoFile = filesObj.find(f => f.fieldname === 'video_avatar');
                else videoFile = (filesObj.video_avatar && filesObj.video_avatar[0]) || null;
            }
            if (videoFile) {
                const originalName = (videoFile.originalname || videoFile.filename || 'video_avatar').toLowerCase();
                const ext = path.extname(originalName).replace(/[^.a-z0-9]/g, '') || '.bin';
                const allowed = ['.webm', '.mp4', '.ogg', '.mov', '.m4v'];
                const safeExt = allowed.includes(ext) ? ext : '.bin';
                const baseName = (request.body.overwrite_name && String(request.body.overwrite_name).replace(/\.[^.]+$/, '')) || String(filename).replace(/\.[^.]+$/, '');
                const safeVideoName = `${baseName}${safeExt}`;
                const srcPath = path.join(videoFile.destination || path.dirname(videoFile.path), videoFile.filename || path.basename(videoFile.path));
                const destPath = path.join(request.user.directories.avatars, safeVideoName);
                try {
                    await fs.promises.rename(srcPath, destPath);
                    videoSavedName = safeVideoName;
                } catch (err) {
                    try { fs.copyFileSync(srcPath, destPath); fs.unlinkSync(srcPath); videoSavedName = safeVideoName; } catch (err2) { console.error('Failed to persist companion video_avatar', err2); }
                }
            }
        } catch (err) { console.error('Error persisting companion video_avatar:', err); }

        const result = { path: filename };
        if (videoSavedName) result.video = videoSavedName;
        return response.send(result);
    } catch (err) {
        console.error('Error uploading user avatar:', err);
        return response.status(400).send('Is not a valid image');
    }
});
