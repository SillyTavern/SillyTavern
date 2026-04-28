import fs from 'node:fs';
import path from 'node:path';

import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';

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
    UNSHALLOW_DEPTH,
    assertAllowedOptions,
    buildTrackingRef,
    createBranchSummary,
    getRequiredStringOption,
    isShallowRepository,
} from './git-common.js';

/**
 * @implements {import('./git-common.js').GitClient}
 */
export class IsomorphicGitClient {
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
     * @param {import('./git-common.js').GitCloneOptions} [options]
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
     * @param {import('./git-common.js').GitFetchOptions} [options]
     * @returns {Promise<void>}
     */
    async fetch(localPath, options = {}) {
        assertAllowedOptions('fetch', options, FETCH_OPTION_KEYS);
        const remote = getRequiredStringOption('fetch', options, 'remote', 'e.g. { remote: "origin" }');
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
     * @param {import('./git-common.js').GitBranchOptions} [options]
     * @returns {Promise<any>}
     */
    async branch(localPath, options = {}) {
        assertAllowedOptions('branch', options, BRANCH_OPTION_KEYS);
        const remote = options.remote;

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
     * @returns {Promise<import('./git-common.js').GitCommitInfo>}
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
     * @returns {Promise<import('./git-common.js').GitRemote[]>}
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
     * @param {import('./git-common.js').GitIsDescendentOptions} options
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
     * @param {import('./git-common.js').GitPullOptions} options
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
     * @param {import('./git-common.js').GitCheckoutOptions} options
     * @returns {Promise<void>}
     */
    async checkout(localPath, options = {}) {
        assertAllowedOptions('checkout', options, CHECKOUT_OPTION_KEYS);
        const branch = getRequiredStringOption('checkout', options, 'branch');
        const create = Boolean(options.create);
        const remote = options.remote;

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
     * @param {import('./git-common.js').GitSetRemoteBranchesOptions} options
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
