import fs from 'node:fs';
import path from 'node:path';
import sanitize from 'sanitize-filename';

const UNPAIRED_SURROGATE = /[\uD800-\uDFFF]/u;

export class UploadDirectoryError extends Error {
    constructor(message = 'Invalid upload directory.') {
        super(message);
        this.name = 'UploadDirectoryError';
    }
}

/**
 * Resolves an unencoded relative upload directory without creating it.
 * @param {string} baseDirectory The permitted storage root.
 * @param {string} directory The relative directory, or an empty string for the root.
 * @param {string} [fileName=''] An optional filename already validated by the caller.
 * @returns {string} The absolute path within the storage root.
 */
export function resolveUploadPath(baseDirectory, directory, fileName = '') {
    if (typeof directory !== 'string') {
        throw new UploadDirectoryError('Upload directory must be a string.');
    }

    const directories = directory === '' ? [] : directory.split('/');
    if (directories.some(part => !part || part === '.' || part === '..' || UNPAIRED_SURROGATE.test(part) || sanitize(part) !== part)) {
        throw new UploadDirectoryError('Upload directory must contain valid relative directory names.');
    }
    if (typeof fileName !== 'string' || (fileName && (fileName === '.' || fileName === '..' || UNPAIRED_SURROGATE.test(fileName) || sanitize(fileName) !== fileName))) {
        throw new UploadDirectoryError('Upload filename must be a single valid filename.');
    }

    const base = path.resolve(baseDirectory);
    const parts = fileName ? [...directories, fileName] : directories;
    const target = path.resolve(base, ...parts);
    const relative = path.relative(base, target);
    if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
        throw new UploadDirectoryError('Upload path must remain inside its storage directory.');
    }

    let current = base;
    for (let index = 0; index < parts.length; index++) {
        current = path.join(current, parts[index]);
        let entry;
        try {
            entry = fs.lstatSync(current);
        } catch (error) {
            if (error.code === 'ENOENT') {
                break;
            }
            throw error;
        }

        if (entry.isSymbolicLink()) {
            throw new UploadDirectoryError('Upload path must not contain symbolic links.');
        }
        const isFile = fileName && index === parts.length - 1;
        if (isFile ? !entry.isFile() : !entry.isDirectory()) {
            throw new UploadDirectoryError('Upload path conflicts with an existing filesystem entry.');
        }
    }

    return target;
}
