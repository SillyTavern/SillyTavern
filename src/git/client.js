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
const PULL_OPTION_KEYS = ['remote', 'branch'];
const CHECKOUT_OPTION_KEYS = ['branch', 'remote', 'create'];
const IS_DESCENDENT_OPTION_KEYS = ['oid', 'ancestor'];
const SET_REMOTE_BRANCHES_OPTION_KEYS = ['remote'];
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
 * @typedef {object} GitPullOptions
 * @property {string} remote
 * @property {string} branch
 */

/**
 * @typedef {object} GitCheckoutOptions
 * @property {string} branch
 * @property {boolean} [create]
 * @property {boolean | string} [remote]
 */

/**
 * @typedef {object} GitIsDescendentOptions
 * @property {string} oid
 * @property {string} ancestor
 */

/**
 * @typedef {object} GitSetRemoteBranchesOptions
 * @property {string} remote
 */

/**
 * @typedef {object} GitRemote
 * @property {string} name
 * @property {string} url
 */

/**
 * @typedef {object} GitCommitInfo
 * @property {string} oid
 * @property {string} shortOid
 * @property {string} commitDate
 */

/**
 * @typedef {object} GitRepoUpdateState
 * @property {boolean} isRepo
 * @property {string} branch
 * @property {string} remote
 * @property {string} remoteBranch
 * @property {string} currentCommit
 * @property {string} remoteCommit
 * @property {boolean} isUpToDate
 * @property {string} remoteUrl
 */

/**
 * @typedef {object} GitRepoUpdateStateOptions
 * @property {string} [remote]
 */

/**
 * @typedef {object} GitClient
 * @property {'system' | 'builtin'} backend
 * @property {(url: string, localPath: string, options?: GitCloneOptions) => Promise<void>} clone
 * @property {(localPath: string) => Promise<boolean>} checkIsRepo
 * @property {(localPath: string, options: GitFetchOptions) => Promise<void>} fetch
 * @property {(localPath: string, options?: GitBranchOptions) => Promise<any>} branch
 * @property {(localPath: string, ref: string) => Promise<string>} resolveRef
 * @property {(localPath: string, ref: string) => Promise<GitCommitInfo>} getCommitInfo
 * @property {(localPath: string, branch: string) => Promise<string | null>} getTrackingRef
 * @property {(localPath: string, branch: string) => Promise<{ remote: string, branch: string } | null>} getTrackingInfo
 * @property {(localPath: string) => Promise<GitRemote[]>} listRemotes
 * @property {(localPath: string, options: GitIsDescendentOptions) => Promise<boolean>} isDescendent
 * @property {(localPath: string, options: GitPullOptions) => Promise<void>} pull
 * @property {(localPath: string, options: GitCheckoutOptions) => Promise<void>} checkout
 * @property {(localPath: string, options: GitSetRemoteBranchesOptions) => Promise<void>} setRemoteBranches
 * @property {(localPath: string) => Promise<boolean>} isShallowRepository
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
 * @param {string} method
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
 * @param {string | null | undefined} remote
 * @param {string | null | undefined} mergeRef
 * @returns {string | null}
 */
function buildTrackingRef(remote, mergeRef) {
    if (!remote || !mergeRef) {
        return null;
    }

    if (remote === '.') {
        return mergeRef;
    }

    if (mergeRef.startsWith('refs/heads/')) {
        return `refs/remotes/${remote}/${mergeRef.slice('refs/heads/'.length)}`;
    }

    return mergeRef;
}

/**
 * @param {string} method
 * @param {object} options
 * @param {string} option
 * @param {string} [hint]
 * @returns {string}
 */
function getRequiredStringOption(method, options, option, hint = '') {
    if (typeof options[option] === 'string' && options[option]) {
        return options[option];
    }

    const hintSuffix = hint ? `, ${hint}` : '';
    throw new Error(`${method}() requires a non-empty "${option}" option${hintSuffix}.`);
}

/**
 * @param {GitFetchOptions} options
 * @returns {string}
 */
function getRequiredFetchRemote(options) {
    return getRequiredStringOption('fetch', options, 'remote', 'e.g. { remote: "origin" }');
}

/**
 * @param {string} localPath
 * @returns {string}
 */
function getGitDirectory(localPath) {
    const dotGitPath = path.join(localPath, '.git');
    try {
        const stats = fs.statSync(dotGitPath);
        if (stats.isDirectory()) {
            return dotGitPath;
        }

        if (stats.isFile()) {
            const fileContent = fs.readFileSync(dotGitPath, 'utf8');
            const match = fileContent.match(/^gitdir:\s*(.+)\s*$/im);
            if (match && match[1]) {
                return path.resolve(localPath, match[1]);
            }
        }
    } catch {
        // Fallback to the default .git path.
    }

    return dotGitPath;
}

/**
 * @param {string} localPath
 * @returns {boolean}
 */
function isShallowRepository(localPath) {
    const shallowFilePath = path.join(getGitDirectory(localPath), 'shallow');
    try {
        if (!fs.existsSync(shallowFilePath)) {
            return false;
        }

        return fs.statSync(shallowFilePath).size > 0;
    } catch {
        return false;
    }
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
 * Determine whether a repository has updates available on a remote for its current branch.
 * @param {GitClient} gitClient
 * @param {string} localPath
 * @param {GitRepoUpdateStateOptions} [options]
 * @returns {Promise<GitRepoUpdateState>}
 */
export async function getRepoUpdateState(gitClient, localPath, options = {}) {
    const defaultRemote = typeof options.remote === 'string' && options.remote ? options.remote : 'origin';
    const isRepo = await gitClient.checkIsRepo(localPath);
    if (!isRepo) {
        return {
            isRepo: false,
            branch: '',
            remote: '',
            remoteBranch: '',
            currentCommit: '',
            remoteCommit: '',
            isUpToDate: true,
            remoteUrl: '',
        };
    }

    const branchInfo = await gitClient.branch(localPath);
    const branch = branchInfo.current;
    if (!branch) {
        throw new Error(`No current branch found for repository at ${localPath}`);
    }

    const trackingInfo = await gitClient.getTrackingInfo(localPath, branch);
    const remote = trackingInfo?.remote ?? defaultRemote;
    const remoteBranch = trackingInfo?.branch ?? branch;

    await gitClient.fetch(localPath, { remote });

    const remotes = await gitClient.listRemotes(localPath);
    const remoteUrl = remotes.find(entry => entry.name === remote)?.url ?? '';
    const currentCommit = await gitClient.resolveRef(localPath, 'HEAD');
    const remoteCommit = await gitClient.resolveRef(localPath, `refs/remotes/${remote}/${remoteBranch}`);
    const isUpToDate = await gitClient.isDescendent(localPath, {
        oid: currentCommit,
        ancestor: remoteCommit,
    });

    return {
        isRepo: true,
        branch,
        remote,
        remoteBranch,
        currentCommit,
        remoteCommit,
        isUpToDate,
        remoteUrl,
    };
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

    /**
     * @param {string} localPath
     * @param {string} ref
     * @returns {Promise<string>}
     */
    async resolveRef(localPath, ref) {
        return this.getRepositoryGit(localPath).revparse([ref]);
    }

    /**
     * @param {string} localPath
     * @param {string} ref
     * @returns {Promise<GitCommitInfo>}
     */
    async getCommitInfo(localPath, ref) {
        const repositoryGit = this.getRepositoryGit(localPath);
        const oid = await repositoryGit.revparse([ref]);
        const commitDate = (await repositoryGit.show(['-s', '--format=%ci', oid])).trim();

        return {
            oid,
            shortOid: oid.slice(0, SHORT_COMMIT_LENGTH),
            commitDate,
        };
    }

    /**
     * @param {string} localPath
     * @param {string} branch
     * @returns {Promise<string | null>}
     */
    async getTrackingRef(localPath, branch) {
        if (typeof branch !== 'string' || !branch) {
            return null;
        }

        try {
            const repositoryGit = this.getRepositoryGit(localPath);
            const remote = (await repositoryGit.raw(['config', '--get', `branch.${branch}.remote`])).trim();
            const mergeRef = (await repositoryGit.raw(['config', '--get', `branch.${branch}.merge`])).trim();
            return buildTrackingRef(remote, mergeRef);
        } catch {
            return null;
        }
    }

    /**
     * @param {string} localPath
     * @param {string} branch
     * @returns {Promise<{ remote: string, branch: string } | null>}
     */
    async getTrackingInfo(localPath, branch) {
        if (typeof branch !== 'string' || !branch) {
            return null;
        }

        try {
            const repositoryGit = this.getRepositoryGit(localPath);
            const remote = (await repositoryGit.raw(['config', '--get', `branch.${branch}.remote`])).trim();
            const mergeRef = (await repositoryGit.raw(['config', '--get', `branch.${branch}.merge`])).trim();
            if (!remote || !mergeRef) {
                return null;
            }
            const remoteBranch = mergeRef.startsWith('refs/heads/') ? mergeRef.slice('refs/heads/'.length) : mergeRef;
            return { remote, branch: remoteBranch };
        } catch {
            return null;
        }
    }

    /**
     * @param {string} localPath
     * @returns {Promise<GitRemote[]>}
     */
    async listRemotes(localPath) {
        const remotes = await this.getRepositoryGit(localPath).getRemotes(true);
        return remotes.map(remote => ({
            name: remote.name,
            url: remote.refs?.fetch || '',
        }));
    }

    /**
     * @param {string} localPath
     * @param {GitIsDescendentOptions} options
     * @returns {Promise<boolean>}
     */
    async isDescendent(localPath, options = {}) {
        assertAllowedOptions('isDescendent', options, IS_DESCENDENT_OPTION_KEYS);
        const oid = getRequiredStringOption('isDescendent', options, 'oid');
        const ancestor = getRequiredStringOption('isDescendent', options, 'ancestor');
        const repositoryGit = this.getRepositoryGit(localPath);

        if (oid === ancestor) {
            return true;
        }

        try {
            await repositoryGit.raw(['merge-base', '--is-ancestor', ancestor, oid]);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * @param {string} localPath
     * @param {GitPullOptions} options
     * @returns {Promise<void>}
     */
    async pull(localPath, options = {}) {
        assertAllowedOptions('pull', options, PULL_OPTION_KEYS);
        const remote = getRequiredStringOption('pull', options, 'remote');
        const branch = getRequiredStringOption('pull', options, 'branch');
        await this.getRepositoryGit(localPath).pull(remote, branch);
    }

    /**
     * @param {string} localPath
     * @param {GitCheckoutOptions} options
     * @returns {Promise<void>}
     */
    async checkout(localPath, options = {}) {
        assertAllowedOptions('checkout', options, CHECKOUT_OPTION_KEYS);
        const repositoryGit = this.getRepositoryGit(localPath);
        const branch = getRequiredStringOption('checkout', options, 'branch');
        const create = Boolean(options.create);
        const remote = normalizeRemote(options.remote);

        if (create) {
            if (remote) {
                await repositoryGit.checkoutBranch(branch, `${remote}/${branch}`);
                return;
            }

            await repositoryGit.checkoutLocalBranch(branch);
            return;
        }

        await repositoryGit.checkout(branch);
    }

    /**
     * @param {string} localPath
     * @param {GitSetRemoteBranchesOptions} options
     * @returns {Promise<void>}
     */
    async setRemoteBranches(localPath, options = {}) {
        assertAllowedOptions('setRemoteBranches', options, SET_REMOTE_BRANCHES_OPTION_KEYS);
        const remote = getRequiredStringOption('setRemoteBranches', options, 'remote');
        await this.getRepositoryGit(localPath).remote(['set-branches', remote, '*']);
    }

    /**
     * @param {string} localPath
     * @returns {Promise<boolean>}
     */
    async isShallowRepository(localPath) {
        return isShallowRepository(localPath);
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

        const fetchOptions = {
            fs,
            http,
            dir: localPath,
            remote,
        };

        if (unshallow) {
            fetchOptions.depth = UNSHALLOW_DEPTH;
            fetchOptions.relative = true;
        }

        try {
            await git.fetch(fetchOptions);
        } catch (error) {
            if (error?.code === 'NotFoundError') {
                await git.fetch({ ...fetchOptions, ref: 'HEAD' });
                return;
            }
            throw error;
        }
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

    /**
     * @param {string} localPath
     * @param {string} ref
     * @returns {Promise<string>}
     */
    async resolveRef(localPath, ref) {
        return git.resolveRef({ fs, dir: localPath, ref });
    }

    /**
     * @param {string} localPath
     * @param {string} ref
     * @returns {Promise<GitCommitInfo>}
     */
    async getCommitInfo(localPath, ref) {
        const oid = await git.resolveRef({ fs, dir: localPath, ref });
        const { commit } = await git.readCommit({ fs, dir: localPath, oid });

        return {
            oid,
            shortOid: oid.slice(0, SHORT_COMMIT_LENGTH),
            commitDate: new Date(commit.committer.timestamp * 1000).toISOString(),
        };
    }

    /**
     * @param {string} localPath
     * @param {string} branch
     * @returns {Promise<string | null>}
     */
    async getTrackingRef(localPath, branch) {
        if (typeof branch !== 'string' || !branch) {
            return null;
        }

        try {
            const remote = await git.getConfig({ fs, dir: localPath, path: `branch.${branch}.remote` });
            const mergeRef = await git.getConfig({ fs, dir: localPath, path: `branch.${branch}.merge` });
            return buildTrackingRef(remote, mergeRef);
        } catch {
            return null;
        }
    }

    /**
     * @param {string} localPath
     * @param {string} branch
     * @returns {Promise<{ remote: string, branch: string } | null>}
     */
    async getTrackingInfo(localPath, branch) {
        if (typeof branch !== 'string' || !branch) {
            return null;
        }

        try {
            const remote = await git.getConfig({ fs, dir: localPath, path: `branch.${branch}.remote` });
            const mergeRef = await git.getConfig({ fs, dir: localPath, path: `branch.${branch}.merge` });
            if (!remote || !mergeRef) {
                return null;
            }
            const remoteBranch = mergeRef.startsWith('refs/heads/') ? mergeRef.slice('refs/heads/'.length) : mergeRef;
            return { remote, branch: remoteBranch };
        } catch {
            return null;
        }
    }

    /**
     * @param {string} localPath
     * @returns {Promise<GitRemote[]>}
     */
    async listRemotes(localPath) {
        const remotes = await git.listRemotes({ fs, dir: localPath });
        return remotes.map(remote => ({
            name: remote.remote,
            url: remote.url,
        }));
    }

    /**
     * @param {string} localPath
     * @param {GitIsDescendentOptions} options
     * @returns {Promise<boolean>}
     */
    async isDescendent(localPath, options = {}) {
        assertAllowedOptions('isDescendent', options, IS_DESCENDENT_OPTION_KEYS);
        const oid = getRequiredStringOption('isDescendent', options, 'oid');
        const ancestor = getRequiredStringOption('isDescendent', options, 'ancestor');

        if (oid === ancestor) {
            return true;
        }

        return git.isDescendent({ fs, dir: localPath, oid, ancestor });
    }

    /**
     * @param {string} localPath
     * @param {GitPullOptions} options
     * @returns {Promise<void>}
     */
    async pull(localPath, options = {}) {
        assertAllowedOptions('pull', options, PULL_OPTION_KEYS);
        const remote = getRequiredStringOption('pull', options, 'remote');
        const branch = getRequiredStringOption('pull', options, 'branch');
        await git.pull({
            fs,
            http,
            dir: localPath,
            remote,
            ref: branch,
            singleBranch: true,
            author: { name: 'SillyTavern', email: 'sillytavern@localhost' },
        });
    }

    /**
     * @param {string} localPath
     * @param {GitCheckoutOptions} options
     * @returns {Promise<void>}
     */
    async checkout(localPath, options = {}) {
        assertAllowedOptions('checkout', options, CHECKOUT_OPTION_KEYS);
        const branch = getRequiredStringOption('checkout', options, 'branch');
        const create = Boolean(options.create);
        const remote = normalizeRemote(options.remote);

        if (create && remote) {
            await git.checkout({
                fs,
                dir: localPath,
                ref: branch,
                remote,
            });
            return;
        }

        if (create) {
            await git.branch({
                fs,
                dir: localPath,
                ref: branch,
                checkout: true,
            });
            return;
        }

        await git.checkout({
            fs,
            dir: localPath,
            ref: branch,
        });
    }

    /**
     * @param {string} localPath
     * @param {GitSetRemoteBranchesOptions} options
     * @returns {Promise<void>}
     */
    async setRemoteBranches(localPath, options = {}) {
        assertAllowedOptions('setRemoteBranches', options, SET_REMOTE_BRANCHES_OPTION_KEYS);
        const remote = getRequiredStringOption('setRemoteBranches', options, 'remote');
        await git.setConfig({
            fs,
            dir: localPath,
            path: `remote.${remote}.fetch`,
            value: `+refs/heads/*:refs/remotes/${remote}/*`,
        });
    }

    /**
     * @param {string} localPath
     * @returns {Promise<boolean>}
     */
    async isShallowRepository(localPath) {
        return isShallowRepository(localPath);
    }
}
