import { sync as commandExistsSync } from 'command-exists';

import { IsomorphicGitClient } from './isomorphic-git-client.js';
import { SimpleGitClient } from './simple-git-client.js';
import { GIT_BACKENDS } from './git-common.js';

export { GIT_BACKENDS, getRepoUpdateState } from './git-common.js';

/**
 * @param {string | undefined | null} preferredBackend
 * @returns {'system' | 'builtin'}
 */
function resolveBackend(preferredBackend) {
    const normalized = typeof preferredBackend === 'string' ? preferredBackend.trim().toLowerCase() : GIT_BACKENDS.AUTO;
    const backend = normalized === GIT_BACKENDS.SYSTEM
        ? GIT_BACKENDS.SYSTEM
        : normalized === GIT_BACKENDS.BUILTIN
            ? GIT_BACKENDS.BUILTIN
            : GIT_BACKENDS.AUTO;
    const systemGitAvailable = commandExistsSync('git');

    if (backend === GIT_BACKENDS.SYSTEM && !systemGitAvailable) {
        throw new Error('git.backend is set to "system", but no git binary was found in PATH. Install Git or set git.backend to "auto" or "builtin".');
    }

    if (backend === GIT_BACKENDS.SYSTEM || (backend === GIT_BACKENDS.AUTO && systemGitAvailable)) {
        return GIT_BACKENDS.SYSTEM;
    }

    return GIT_BACKENDS.BUILTIN;
}

/**
 * @param {{ backend?: string, timeout?: number }} [options]
 * `timeout` applies to repo-scoped system-git commands and does not apply to clone.
 * @returns {import('./git-common.js').GitClient}
 */
export function createGitClient(options = {}) {
    const backend = resolveBackend(options.backend);
    if (backend === GIT_BACKENDS.SYSTEM) {
        return new SimpleGitClient({ timeout: options.timeout });
    }

    return new IsomorphicGitClient();
}
