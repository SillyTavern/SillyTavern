import { Buffer } from 'node:buffer';

/**
 * Decodes a file name from Latin1 to UTF-8.
 * @param {string} str Input string
 * @returns {string} Decoded file name
 */
function decodeFileName(str) {
    return Buffer.from(str, 'latin1').toString('utf-8');
}

/**
 * Middleware to decode file names from Latin1 to UTF-8.
 * See: https://github.com/expressjs/multer/issues/1104
 * @param {import('express').Request} req Request
 * @param {import('express').Response} _res Response
 * @param {import('express').NextFunction} next Next middleware
 */
export default function multerMonkeyPatch(req, _res, next) {
    try {
        if (req.file) {
            req.file.originalname = decodeFileName(req.file.originalname);
        }

        // If multiple files were uploaded via fields(), multer sets req.files as an object
        // where each key is a fieldname and the value is an array of files.
        if (req.files && typeof req.files === 'object') {
            if (Array.isArray(req.files)) {
                // Some variants might leave an array of files
                for (const f of req.files) {
                    if (f && f.originalname) f.originalname = decodeFileName(f.originalname);
                }
            } else {
                for (const key of Object.keys(req.files)) {
                    const arr = req.files[key];
                    if (Array.isArray(arr)) {
                        for (const f of arr) {
                            if (f && f.originalname) f.originalname = decodeFileName(f.originalname);
                        }
                    }
                }
            }
        }

        next();
    } catch (error) {
        console.error('Error in multerMonkeyPatch:', error);
        next();
    }
}
