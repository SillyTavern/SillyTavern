import fs from 'node:fs';
import path from 'node:path';

/** @type {{ AUTO: 'auto', SYSTEM: 'system', BUILTIN: 'builtin' }} */
export const GIT_BACKENDS = {
    AUTO: 'auto',
    SYSTEM: 'system',
    BUILTIN: 'builtin',
};

export const CLONE_OPTION_KEYS = ['depth', 'branch'];
export const FETCH_OPTION_KEYS = ['remote', 'unshallow'];
export const BRANCH_OPTION_KEYS = ['remote'];
export const PULL_OPTION_KEYS = ['remote', 'branch'];
export const CHECKOUT_OPTION_KEYS = ['branch', 'remote', 'create'];
export const IS_DESCENDENT_OPTION_KEYS = ['oid', 'ancestor'];
export const SET_REMOTE_BRANCHES_OPTION_KEYS = ['remote'];
export const UNSHALLOW_DEPTH = 2147483647;
export const SHORT_COMMIT_LENGTH = 7;

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
 * @property {string} [remote]
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
 * @property {string} [remote]
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
 * @typedef {object} GitClient
 * @property {'system' | 'builtin'} backend
 * @property {(url: string, localPath: string, options?: GitCloneOptions) => Promise<void>} clone
 * @property {(localPath: string) => Promise<boolean>} checkIsRepo
 * @property {(localPath: string, options: GitFetchOptions) => Promise<void>} fetch
 * @property {(localPath: string, options?: GitBranchOptions) => Promise<any>} branch
 * @property {(localPath: string, ref: string) => Promise<string>} resolveRef
 * @property {(localPath: string, ref: string) => Promise<GitCommitInfo>} getCommitInfo
 * @property {(localPath: string, branch: string) => Promise<string | null>} getTrackingRef
 * @property {(localPath: string) => Promise<GitRemote[]>} listRemotes
 * @property {(localPath: string, options: GitIsDescendentOptions) => Promise<boolean>} isDescendent
 * @property {(localPath: string, options: GitPullOptions) => Promise<void>} pull
 * @property {(localPath: string, options: GitCheckoutOptions) => Promise<void>} checkout
 * @property {(localPath: string, options: GitSetRemoteBranchesOptions) => Promise<void>} setRemoteBranches
 * @property {(localPath: string) => Promise<boolean>} isShallowRepository
 */

/**
 * @param {string} method
 * @param {object} options
 * @param {string[]} allowedKeys
 * @returns {void}
 */
export function assertAllowedOptions(method, options, allowedKeys) {
    for (const key of Object.keys(options)) {
        if (!allowedKeys.includes(key)) {
            throw new Error(`Unsupported ${method} option: ${key}`);
        }
    }
}

/**
 * @param {string | null | undefined} remote
 * @param {string | null | undefined} mergeRef
 * @returns {string | null}
 */
export function buildTrackingRef(remote, mergeRef) {
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
export function getRequiredStringOption(method, options, option, hint = '') {
    if (typeof options[option] === 'string' && options[option]) {
        return options[option];
    }

    const hintSuffix = hint ? `, ${hint}` : '';
    throw new Error(`${method}() requires a non-empty "${option}" option${hintSuffix}.`);
}

/**
 * @param {string} localPath
 * @returns {string}
 */
export function getGitDirectory(localPath) {
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
export function isShallowRepository(localPath) {
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
 * Determine whether a repository has updates available on a remote for its current branch.
 * @param {GitClient} gitClient
 * @param {string} localPath
 * @returns {Promise<GitRepoUpdateState>}
 */
export async function getRepoUpdateState(gitClient, localPath) {
    const remote = 'origin';
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

    const remoteBranch = branch;

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
 * @param {Array<{name: string, commit: string, label: string, current: boolean}>} entries
 * @param {string} [current]
 * @param {boolean} [detached]
 * @returns {{all: string[], branches: Record<string, {current: boolean, linkedWorkTree: boolean, name: string, commit: string, label: string}>, current: string, detached: boolean}}
 */
export function createBranchSummary(entries, current = '', detached = !current) {
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
