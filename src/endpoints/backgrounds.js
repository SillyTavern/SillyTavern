import fs from 'node:fs';
import path from 'node:path';

import express from 'express';
import sanitize from 'sanitize-filename';

// invalidateThumbnail is still used for /delete and /rename, dimensions for /all
import {
    dimensions,
    invalidateThumbnail,
    generateThumbnail,
    getThumbnailFolder,
    currentMetadataVersion as sharedMetadataVersion,
    writeFileAtomicSync as sharedWriteFileAtomicSync,
} from './thumbnails.js';
import { getImages } from '../util.js';

export const router = express.Router();

router.post('/all', function (request, response) {
    const images = getImages(request.user.directories.backgrounds);
    const config = { width: dimensions.bg[0], height: dimensions.bg[1] };
    const aspectRatiosJsonPath = path.join(request.user.directories.thumbnailsBg, 'aspect_ratios.json');
    let aspects = {};

    try {
        if (fs.existsSync(aspectRatiosJsonPath)) {
            aspects = JSON.parse(fs.readFileSync(aspectRatiosJsonPath, 'utf-8'));
        }
    } catch (e) {
        console.error('Failed to read or parse aspect_ratios.json:', e);
        aspects = {}; // Ensure aspects is an empty object on error
    }

    response.json({ images, config, aspects });
});

router.post('/delete', function (request, response) {
    if (!request.body) return response.sendStatus(400);

    const sanitizedBg = sanitize(request.body.bg);
    if (request.body.bg !== sanitizedBg) {
        console.error('Malicious bg name prevented');
        return response.sendStatus(403);
    }

    const fileName = path.join(request.user.directories.backgrounds, sanitizedBg);

    if (!fs.existsSync(fileName)) {
        console.error('BG file not found');
        return response.sendStatus(400);
    }

    fs.unlinkSync(fileName);
    invalidateThumbnail(request.user.directories, 'bg', sanitizedBg);
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
    fs.unlinkSync(oldFileName);
    invalidateThumbnail(request.user.directories, 'bg', request.body.old_bg);
    return response.send('ok');
});

router.post('/upload', function (request, response) {
    if (!request.body || !request.file) return response.sendStatus(400);

    const img_path = path.join(request.file.destination, request.file.filename);
    // Ensure filename is from originalname, as sanitize might have been applied to request.file.filename
    const { originalname: filename } = request.file;

    try {
        fs.copyFileSync(img_path, path.join(request.user.directories.backgrounds, filename));
        fs.unlinkSync(img_path);

        (async () => { 
            try {
                const thumbnailResult = await generateThumbnail(request.user.directories, 'bg', filename);

                if (thumbnailResult && thumbnailResult.classification) {
                    const thumbnailBaseDir = getThumbnailFolder(request.user.directories, 'bg');

                    if (thumbnailBaseDir) {
                        const aspectRatiosJsonPath = path.join(thumbnailBaseDir, 'aspect_ratios.json');
                        let aspectRatios = {};

                        if (fs.existsSync(aspectRatiosJsonPath)) {
                            try {
                                const jsonData = fs.readFileSync(aspectRatiosJsonPath, 'utf-8');
                                aspectRatios = JSON.parse(jsonData);
                            } catch (e) {
                                console.error(`[Upload] Failed to parse aspect_ratios.json: ${e.message}. Initializing new object.`);
                                aspectRatios = {};
                            }
                        }

                        if (aspectRatios[filename] !== thumbnailResult.classification) {
                            aspectRatios[filename] = thumbnailResult.classification;
                            try {
                                // Use sharedWriteFileAtomicSync (already imported, no need for fallback check as export is direct)
                                sharedWriteFileAtomicSync(aspectRatiosJsonPath, JSON.stringify(aspectRatios, null, 2));
                                console.info(`[Upload] Updated aspect_ratios.json for: ${filename} -> ${thumbnailResult.classification}`);

                                const versionFilePath = path.join(thumbnailBaseDir, 'aspect_metadata_version.txt');
                                // Use sharedMetadataVersion (already imported)
                                fs.writeFileSync(versionFilePath, sharedMetadataVersion);
                                console.info(`[Upload] Updated aspect_metadata_version.txt to ${sharedMetadataVersion}`);

                            } catch (e) {
                                console.error(`[Upload] Failed to write aspect_ratios.json or version file: ${e.message}`);
                            }
                        }
                    } else {
                        console.error('[Upload] Could not get thumbnail folder path.');
                    }
                } else if (thumbnailResult === null) {
                    const thumbnailBaseDir = getThumbnailFolder(request.user.directories, 'bg');
                    if (thumbnailBaseDir) {
                        const aspectRatiosJsonPath = path.join(thumbnailBaseDir, 'aspect_ratios.json');
                        if (fs.existsSync(aspectRatiosJsonPath)) {
                            try {
                                const aspectRatios = JSON.parse(fs.readFileSync(aspectRatiosJsonPath, 'utf-8'));
                                if (Object.prototype.hasOwnProperty.call(aspectRatios, filename)) {
                                    delete aspectRatios[filename];
                                    sharedWriteFileAtomicSync(aspectRatiosJsonPath, JSON.stringify(aspectRatios, null, 2));
                                    console.info(`[Upload] Removed entry for unprocessable file ${filename} from aspect_ratios.json.`);
                                    const versionFilePath = path.join(thumbnailBaseDir, 'aspect_metadata_version.txt');
                                    fs.writeFileSync(versionFilePath, sharedMetadataVersion);
                                    console.info(`[Upload] Updated aspect_metadata_version.txt to ${sharedMetadataVersion} after removing entry.`);
                                }
                            } catch (e) {
                                console.error(`[Upload] Error processing aspect_ratios.json for unprocessable file ${filename}: ${e.message}`);
                            }
                        }
                    }
                }
            } catch (e) {
                console.error(`[Upload] Error during thumbnail generation or aspect ratio update for ${filename}: ${e.message}`);
            }
        })(); 

        response.send(filename);
    } catch (err) {
        console.error(err);
        response.sendStatus(500);
    }
});
