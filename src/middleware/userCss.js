import path from 'node:path';
import fs from 'node:fs';

/**
 * Provides an Express middleware function that serves a user-defined CSS file from the data directory if it exists.
 * @type {import('express').Handler}
 */
export function userCssMiddleware(req, res, next) {
    if (req.method === 'GET' && req.path === '/css/user.css') {
        const userCssPath = path.resolve(path.join(globalThis.DATA_ROOT, '_css', 'user.css'));
        if (fs.existsSync(userCssPath)) {
            res.sendFile(userCssPath);
            return;
        }
    }
    next();
}

export default userCssMiddleware;
