import fs from 'node:fs';
import path from 'node:path';

import { sync as commandExistsSync } from 'command-exists';
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import simpleGit, { CheckRepoActions } from 'simple-git';

/** @type {{ AUTO: 'auto', SYSTEM: 'system', BUILTIN: 'builtin' }} */
export const GIT_BACKENDS = {
    AUTO: 'auto',
    SYSTEM: 'system',
    BUILTIN: 'builtin',
};

const CLONE_OPTION_KEYS = ['depth', 'branch'];
const FETCH_OPTION_KEYS = ['remote', 'unshallow'];
const BRANCH_OPTION_KEYS = ['remote'];
const UNSHALLOW_DEPTH = 2147483647;
const SHORT_COMMIT_LENGTH = 7;

/**
 * @typedef {object} GitCloneOptions
 * @property {number} [depth]
 * @property {string} [branch]
 */

/**
 * @typedef {object} GitFetchOptions
 * @property {string} remote
 * @property {boolean} [unshallow]
 */

/**
 * @typedef {object} GitBranchOptions
 * @property {boolean | string} [remote]
 */

/**
 * @typedef {object} GitClient
 * @property {'system' | 'builtin'} backend
 * @property {(url: string, localPath: string, options?: GitCloneOptions) => Promise<void>} clone
 * @property {(localPath: string) => Promise<boolean>} checkIsRepo
 * @property {(localPath: string, options: GitFetchOptions) => Promise<void>} fetch
 * @property {(localPath: string, options?: GitBranchOptions) => Promise<any>} branch
 */

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
 * @param {'clone' | 'fetch' | 'branch'} method
 * @param {object} options
 * @param {string[]} allowedKeys
 * @returns {void}
 */
function assertAllowedOptions(method, options, allowedKeys) {
    for (const key of Object.keys(options)) {
        if (!allowedKeys.includes(key)) {
            throw new Error(`Unsupported ${method} option: ${key}`);
        }
    }
}

/**
 * @param {boolean | string | undefined} remote
 * @param {string | undefined} [fallback]
 * @returns {string | undefined}
 */
function normalizeRemote(remote, fallback = undefined) {
    if (remote === true) {
        return 'origin';
    }

    if (typeof remote === 'string' && remote) {
        return remote;
    }

    return fallback;
}

/**
 * @param {GitFetchOptions} options
 * @returns {string}
 */
function getRequiredFetchRemote(options) {
    if (typeof options.remote === 'string' && options.remote) {
        return options.remote;
    }

    throw new Error('fetch() requires an explicit remote name, e.g. { remote: "origin" }.');
}

/**
 * @param {Array<{name: string, commit: string, label: string, current: boolean}>} entries
 * @param {string} [current]
 * @param {boolean} [detached]
 * @returns {{all: string[], branches: Record<string, {current: boolean, linkedWorkTree: boolean, name: string, commit: string, label: string}>, current: string, detached: boolean}}
 */
function createBranchSummary(entries, current = '', detached = !current) {
    const branches = entries.reduce((result, entry) => {
        result[entry.name] = {
            current: entry.current,
            linkedWorkTree: false,
            name: entry.name,
            commit: entry.commit,
            label: entry.label,
        };
        return result;
    }, {});

    return {
        all: entries.map(entry => entry.name),
        branches,
        current,
        detached,
    };
}

/**
 * @param {{ backend?: string, timeout?: number }} [options]
 * `timeout` applies to repo-scoped system-git commands and does not apply to clone.
 * @returns {GitClient}
 */
export function createGitClient(options = {}) {
    const backend = resolveBackend(options.backend);
    if (backend === GIT_BACKENDS.SYSTEM) {
        return new SimpleGitClient({ timeout: options.timeout });
    }

    return new IsomorphicGitClient();
}

/**
 * @implements {GitClient}
 */
class SimpleGitClient {
    /**
     * @param {{ timeout?: number }} [options]
     */
    constructor({ timeout } = {}) {
        this.backend = GIT_BACKENDS.SYSTEM;
        /** @type {Partial<import('simple-git').SimpleGitOptions>} */
        this.repoOptions = timeout ? { timeout: { block: timeout } } : {};
        this.git = simpleGit();
    }

    /**
     * @param {string} localPath
     * @returns {import('simple-git').SimpleGit}
     */
    getRepositoryGit(localPath) {
        return simpleGit({ ...this.repoOptions, baseDir: localPath });
    }

    /**
     * @param {string} url
     * @param {string} localPath
     * @param {GitCloneOptions} [options]
     * @returns {Promise<void>}
     */
    async clone(url, localPath, options = {}) {
        assertAllowedOptions('clone', options, CLONE_OPTION_KEYS);
        /** @type {Record<string, any>} */
        const cloneOptions = {};

        if (options.depth !== undefined) {
            cloneOptions['--depth'] = options.depth;
        }

        if (options.branch !== undefined && options.branch !== '') {
            cloneOptions['--branch'] = options.branch;
        }

        await this.git.clone(url, localPath, cloneOptions);
    }

    /**
     * @param {string} localPath
     * @returns {Promise<boolean>}
     */
    async checkIsRepo(localPath) {
        return this.getRepositoryGit(localPath).checkIsRepo(CheckRepoActions.IS_REPO_ROOT);
    }

    /**
     * @param {string} localPath
     * @param {GitFetchOptions} [options]
     * @returns {Promise<void>}
     */
    async fetch(localPath, options = {}) {
        assertAllowedOptions('fetch', options, FETCH_OPTION_KEYS);
        const repositoryGit = this.getRepositoryGit(localPath);
        const remote = getRequiredFetchRemote(options);
        const unshallow = Boolean(options.unshallow);

        if (unshallow) {
            await repositoryGit.fetch(remote, ['--unshallow']);
            return;
        }

        await repositoryGit.fetch(remote);
    }

    /**
     * @param {string} localPath
     * @param {GitBranchOptions} [options]
     * @returns {Promise<any>}
     */
    async branch(localPath, options = {}) {
        assertAllowedOptions('branch', options, BRANCH_OPTION_KEYS);
        const repositoryGit = this.getRepositoryGit(localPath);
        const remote = normalizeRemote(options.remote);

        if (remote) {
            return repositoryGit.branch(['-r', '--list', `${remote}/*`]);
        }

        return repositoryGit.branchLocal();
    }
}

/**
 * @implements {GitClient}
 */
class IsomorphicGitClient {
    constructor() {
        this.backend = GIT_BACKENDS.BUILTIN;
    }

    /**
     * @param {string} localPath
     * @param {string} ref
     * @param {string} defaultLabel
     * @returns {Promise<{commit: string, label: string}>}
     */
    async getBranchMetadata(localPath, ref, defaultLabel) {
        let oid = '';
        try {
            oid = await git.resolveRef({ fs, dir: localPath, ref });
            const { commit } = await git.readCommit({ fs, dir: localPath, oid });
            return {
                commit: oid ? oid.slice(0, SHORT_COMMIT_LENGTH) : '',
                label: commit.message.split('\n', 1)[0] || defaultLabel,
            };
        } catch {
            return { commit: '', label: defaultLabel };
        }
    }

    /**
     * @param {string} url
     * @param {string} localPath
     * @param {GitCloneOptions} [options]
     * @returns {Promise<void>}
     */
    async clone(url, localPath, options = {}) {
        assertAllowedOptions('clone', options, CLONE_OPTION_KEYS);

        await git.clone({
            fs,
            http,
            dir: localPath,
            url,
            depth: options.depth,
            ref: options.branch,
            singleBranch: options.depth !== undefined || Boolean(options.branch),
        });
    }

    /**
     * @param {string} localPath
     * @returns {Promise<boolean>}
     */
    async checkIsRepo(localPath) {
        try {
            const gitRootPath = await git.findRoot({ fs, filepath: localPath });
            return path.resolve(gitRootPath) === path.resolve(localPath);
        } catch {
            return false;
        }
    }

    /**
     * @param {string} localPath
     * @param {GitFetchOptions} [options]
     * @returns {Promise<void>}
     */
    async fetch(localPath, options = {}) {
        assertAllowedOptions('fetch', options, FETCH_OPTION_KEYS);
        const remote = getRequiredFetchRemote(options);
        const unshallow = Boolean(options.unshallow);

        if (unshallow) {
            await git.fetch({
                fs,
                http,
                dir: localPath,
                remote,
                depth: UNSHALLOW_DEPTH,
                relative: true,
            });
            return;
        }

        await git.fetch({
            fs,
            http,
            dir: localPath,
            remote,
        });
    }

    /**
     * @param {string} localPath
     * @param {GitBranchOptions} [options]
     * @returns {Promise<any>}
     */
    async branch(localPath, options = {}) {
        assertAllowedOptions('branch', options, BRANCH_OPTION_KEYS);
        const remote = normalizeRemote(options.remote);

        if (remote) {
            const remoteBranchNames = (await git.listBranches({ fs, dir: localPath, remote }))
                .filter(name => name !== 'HEAD');
            const entries = await Promise.all(remoteBranchNames.map(async (name) => {
                const fullName = `${remote}/${name}`;
                const { commit, label } = await this.getBranchMetadata(localPath, `refs/remotes/${fullName}`, fullName);
                return { name: fullName, commit, label, current: false };
            }));
            return createBranchSummary(entries, '', false);
        }

        const currentBranch = await git.currentBranch({ fs, dir: localPath, test: true }) || '';
        const localBranchNames = await git.listBranches({ fs, dir: localPath });
        const entries = await Promise.all(localBranchNames.map(async (name) => {
            const { commit, label } = await this.getBranchMetadata(localPath, `refs/heads/${name}`, name);
            return { name, commit, label, current: currentBranch === name };
        }));

        return createBranchSummary(entries, currentBranch);
    }
}
