import simpleGit, { CheckRepoActions } from 'simple-git';

import {
    BRANCH_OPTION_KEYS,
    CHECKOUT_OPTION_KEYS,
    CLONE_OPTION_KEYS,
    FETCH_OPTION_KEYS,
    GIT_BACKENDS,
    IS_DESCENDENT_OPTION_KEYS,
    PULL_OPTION_KEYS,
    SET_REMOTE_BRANCHES_OPTION_KEYS,
    SHORT_COMMIT_LENGTH,
    assertAllowedOptions,
    buildTrackingRef,
    getRequiredStringOption,
    isShallowRepository,
} from './git-common.js';

/**
 * @implements {import('./git-common.js').GitClient}
 */
export class SimpleGitClient {
    /**
     * @param {{ timeout?: number }} [options]
     */
    constructor({ timeout } = {}) {
        this.backend = GIT_BACKENDS.SYSTEM;
        /** @type {Partial<import('simple-git').SimpleGitOptions>} */
        this.repoOptions = timeout ? { timeout: { block: timeout } } : {};
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
     * @param {import('./git-common.js').GitCloneOptions} [options]
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

        // Called directly to bypass timeout for clone
        await simpleGit().clone(url, localPath, cloneOptions);
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
     * @param {import('./git-common.js').GitFetchOptions} [options]
     * @returns {Promise<void>}
     */
    async fetch(localPath, options = {}) {
        assertAllowedOptions('fetch', options, FETCH_OPTION_KEYS);
        const repositoryGit = this.getRepositoryGit(localPath);
        const remote = getRequiredStringOption('fetch', options, 'remote', 'e.g. { remote: "origin" }');
        const unshallow = Boolean(options.unshallow);

        if (unshallow) {
            await repositoryGit.fetch(remote, ['--unshallow']);
            return;
        }

        await repositoryGit.fetch(remote);
    }

    /**
     * @param {string} localPath
     * @param {import('./git-common.js').GitBranchOptions} [options]
     * @returns {Promise<any>}
     */
    async branch(localPath, options = {}) {
        assertAllowedOptions('branch', options, BRANCH_OPTION_KEYS);
        const repositoryGit = this.getRepositoryGit(localPath);
        const remote = options.remote;

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
     * @returns {Promise<import('./git-common.js').GitCommitInfo>}
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
     * @returns {Promise<import('./git-common.js').GitRemote[]>}
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
     * @param {import('./git-common.js').GitIsDescendentOptions} options
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
     * @param {import('./git-common.js').GitPullOptions} options
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
     * @param {import('./git-common.js').GitCheckoutOptions} options
     * @returns {Promise<void>}
     */
    async checkout(localPath, options = {}) {
        assertAllowedOptions('checkout', options, CHECKOUT_OPTION_KEYS);
        const repositoryGit = this.getRepositoryGit(localPath);
        const branch = getRequiredStringOption('checkout', options, 'branch');
        const create = Boolean(options.create);
        const remote = options.remote;

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
     * @param {import('./git-common.js').GitSetRemoteBranchesOptions} options
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
