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
function multerMonkeyPatch(req, _res, next) {
    try {
        if (req.file) {
            req.file.originalname = decodeFileName(req.file.originalname);
        }

        next();
    } catch (error) {
        console.error('Error in multerMonkeyPatch:', error);
        next();
    }
}

module.exports = multerMonkeyPatch;
