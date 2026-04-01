import path from 'node:path';
import fs from 'node:fs';
import { CONTENT_TYPES, getGlobalTargetByType } from '../endpoints/content-manager.js';

/**
 * Returns an Express middleware function that serves public override files from the data directory if they exist,
 * falling back to the default server public directory if not.
 * If the DATA_ROOT global variable is not defined or if there are issues with the public overrides configuration,
 * returns a no-op middleware.
 * @type {import('express').Handler}
 */
export function userCssMiddleware(req, res, next) {
    if (req.method === 'GET' && req.path === '/css/user.css') {
        const dataPath = getGlobalTargetByType(CONTENT_TYPES.STYLESHEET);
        if (dataPath) {
            const userCssPath = path.resolve(path.join(dataPath, 'user.css'));
            if (fs.existsSync(userCssPath)) {
                res.sendFile(userCssPath);
                return;
            }
        }
    }
    next();
}

export default userCssMiddleware;
