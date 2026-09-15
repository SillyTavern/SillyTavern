import fs from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';

import express from 'express';
import sanitize from 'sanitize-filename';

import { clientRelativePath, removeFileExtension, getImages, isPathUnderParent } from '../util.js';
import { MEDIA_EXTENSIONS, MEDIA_REQUEST_TYPE } from '../constants.js';

/**
 * Ensure the directory for the provided file path exists.
 * If not, it will recursively create the directory.
 *
 * @param {string} filePath - The full path of the file for which the directory should be ensured.
 */
function ensureDirectoryExistence(filePath) {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
        return true;
    }
    ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);
}

/**
 * Builds a sanitized destination path for an uploaded image.
 * Returns null if the requested format is not a supported media extension.
 *
 * @param {import('../users.js').UserDirectoryList} directories - User directories
 * @param {string} format - File extension of the image
 * @param {string} [filename] - Optional filename (extension is ignored)
 * @param {string} [chName] - Optional character name for a sub-folder
 * @returns {string|null} The full path to save the image to, or null if the format is invalid
 */
function getUploadedImagePath(directories, format, filename, chName) {
    if (!MEDIA_EXTENSIONS.includes(format)) {
        return null;
    }

    // Constructing filename and path
    const finalName = filename
        ? `${removeFileExtension(filename)}.${format}`
        : `${Date.now()}.${format}`;

    // if character is defined, save to a sub folder for that character
    if (chName) {
        return path.join(directories.userImages, sanitize(chName), sanitize(finalName));
    }

    return path.join(directories.userImages, sanitize(finalName));
}

/**
 * Moves an uploaded temp file to its destination.
 * Falls back to copy+unlink when renaming across devices.
 *
 * @param {string} sourcePath - Path to the uploaded temp file
 * @param {string} destinationPath - Path to move the file to
 * @returns {Promise<void>}
 */
export async function moveUploadedFile(sourcePath, destinationPath) {
    try {
        await fs.promises.rename(sourcePath, destinationPath);
    } catch (error) {
        if (error.code === 'EXDEV') {
            await fs.promises.copyFile(sourcePath, destinationPath);
            await fs.promises.unlink(sourcePath);
        } else {
            throw error;
        }
    }
}

export const router = express.Router();

/**
 * Endpoint to handle image uploads.
 * The image should be provided in the request body in base64 format.
 * Optionally, a character name can be provided to save the image in a sub-folder.
 *
 * @route POST /api/images/upload
 * @param {Object} request.body - The request payload.
 * @param {string} request.body.image - The base64 encoded image data.
 * @param {string} [request.body.ch_name] - Optional character name to determine the sub-directory.
 * @returns {Object} response - The response object containing the path where the image was saved.
 */
router.post('/upload', async (request, response) => {
    try {
        if (!request.body) {
            return response.status(400).send({ error: 'No data provided' });
        }

        const { image, format } = request.body;

        if (!image) {
            return response.status(400).send({ error: 'No image data provided' });
        }

        const pathToNewFile = getUploadedImagePath(request.user.directories, format, request.body.filename, request.body.ch_name);
        if (!pathToNewFile) {
            return response.status(400).send({ error: 'Invalid image format' });
        }

        ensureDirectoryExistence(pathToNewFile);
        const imageBuffer = Buffer.from(image, 'base64');
        await fs.promises.writeFile(pathToNewFile, new Uint8Array(imageBuffer));
        response.send({ path: clientRelativePath(request.user.directories.root, pathToNewFile) });
    } catch (error) {
        console.error(error);
        response.status(500).send({ error: 'Failed to save the image' });
    }
});

/**
 * Endpoint to handle raw multipart image/media uploads.
 * The file should be provided as a multipart form field named 'avatar'.
 * Avoids buffering the file contents in memory by moving the uploaded temp file into place.
 *
 * @route POST /api/images/upload-form
 * @param {Object} request.body - The multipart form fields.
 * @param {string} request.body.format - The file extension of the media file.
 * @param {string} [request.body.filename] - Optional filename (extension is ignored).
 * @param {string} [request.body.ch_name] - Optional character name to determine the sub-directory.
 * @returns {Object} response - The response object containing the path where the file was saved.
 */
router.post('/upload-form', async (request, response) => {
    try {
        if (!request.file) {
            return response.status(400).send({ error: 'No file provided' });
        }

        const pathToNewFile = getUploadedImagePath(request.user.directories, request.body.format, request.body.filename, request.body.ch_name);
        if (!pathToNewFile) {
            await fs.promises.unlink(request.file.path).catch(() => { });
            return response.status(400).send({ error: 'Invalid image format' });
        }

        ensureDirectoryExistence(pathToNewFile);
        await moveUploadedFile(request.file.path, pathToNewFile);
        response.send({ path: clientRelativePath(request.user.directories.root, pathToNewFile) });
    } catch (error) {
        console.error(error);
        if (request.file?.path) {
            await fs.promises.unlink(request.file.path).catch(() => { });
        }
        response.status(500).send({ error: 'Failed to save the image' });
    }
});

router.post('/list/:folder?', (request, response) => {
    try {
        if (request.params.folder) {
            if (request.body.folder) {
                return response.status(400).send({ error: 'Folder specified in both URL and body' });
            }

            console.warn('Deprecated: Use POST /api/images/list with folder in request body');
            request.body.folder = request.params.folder;
        }

        if (!request.body.folder) {
            return response.status(400).send({ error: 'No folder specified' });
        }

        const directoryPath = path.join(request.user.directories.userImages, sanitize(request.body.folder));
        const type = Number(request.body.type ?? MEDIA_REQUEST_TYPE.IMAGE);
        const sort = request.body.sortField || 'date';
        const order = request.body.sortOrder || 'asc';

        if (!fs.existsSync(directoryPath)) {
            fs.mkdirSync(directoryPath, { recursive: true });
        }

        const images = getImages(directoryPath, sort, type);
        if (order === 'desc') {
            images.reverse();
        }
        return response.send(images);
    } catch (error) {
        console.error(error);
        return response.status(500).send({ error: 'Unable to retrieve files' });
    }
});

router.post('/folders', (request, response) => {
    try {
        const directoryPath = request.user.directories.userImages;
        if (!fs.existsSync(directoryPath)) {
            fs.mkdirSync(directoryPath, { recursive: true });
        }

        const folders = fs.readdirSync(directoryPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        return response.send(folders);
    } catch (error) {
        console.error(error);
        return response.status(500).send({ error: 'Unable to retrieve folders' });
    }
});

router.post('/delete', async (request, response) => {
    try {
        if (!request.body.path) {
            return response.status(400).send('No path specified');
        }

        const pathToDelete = path.join(request.user.directories.root, request.body.path);
        if (!isPathUnderParent(request.user.directories.userImages, pathToDelete)) {
            return response.status(400).send('Invalid path');
        }

        if (!fs.existsSync(pathToDelete)) {
            return response.status(404).send('File not found');
        }

        fs.unlinkSync(pathToDelete);
        console.info(`Deleted image: ${request.body.path} from ${request.user.profile.handle}`);
        return response.sendStatus(200);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});
