/**
 * Dynamic Lorebook Manager — Lorebook Updater
 *
 * Applies approved suggestions to lorebook entries using SillyTavern's
 * world-info API. Groups saves by lorebook to minimise write calls.
 */

import { loadWorldInfo, saveWorldInfo, createWorldInfoEntry } from '../../../../scripts/world-info.js';
import { deepClone } from './utils.js';

export class LorebookUpdater {
    /**
     * @param {object} settings - Extension settings reference
     */
    constructor(settings) {
        this.settings = settings;
    }

    // -----------------------------------------------------------------------
    // Single suggestion
    // -----------------------------------------------------------------------

    /**
     * Apply a single approved suggestion.
     *
     * @param {object} suggestion
     * @returns {Promise<{success: boolean, suggestionId: string, worldName: string,
     *   entryUid: number, backup: object, after: object, timestamp: number}>}
     */
    async applySuggestion(suggestion) {
        const lorebook = await loadWorldInfo(suggestion.worldName);
        if (!lorebook) {
            throw new Error(`[DLM] Could not load lorebook: "${suggestion.worldName}"`);
        }

        const entry = lorebook.entries[suggestion.entryUid];
        if (!entry) {
            throw new Error(`[DLM] Entry UID ${suggestion.entryUid} not found in "${suggestion.worldName}"`);
        }

        const backup = deepClone(entry);
        this.applyChangesToEntry(entry, suggestion);
        await saveWorldInfo(suggestion.worldName, lorebook, true);

        return {
            success: true,
            suggestionId: suggestion.id,
            worldName: suggestion.worldName,
            entryUid: suggestion.entryUid,
            backup,
            after: deepClone(entry),
            timestamp: Date.now(),
        };
    }

    // -----------------------------------------------------------------------
    // Batch — multiple suggestions, potentially across multiple lorebooks
    // -----------------------------------------------------------------------

    /**
     * Apply multiple suggestions efficiently, grouping by lorebook so each
     * file is loaded and saved only once.
     *
     * @param {object[]} suggestions
     * @returns {Promise<object[]>} One result object per suggestion
     */
    async applySuggestions(suggestions) {
        // Group by worldName
        const grouped = new Map();
        for (const s of suggestions) {
            if (!grouped.has(s.worldName)) grouped.set(s.worldName, []);
            grouped.get(s.worldName).push(s);
        }

        const results = [];
        for (const [worldName, group] of grouped) {
            const batchResults = await this.applyBatch(worldName, group);
            results.push(...batchResults);
        }
        return results;
    }

    /**
     * Apply a batch of suggestions to a single lorebook in one load+save cycle.
     *
     * @param {string} worldName
     * @param {object[]} suggestions
     * @returns {Promise<object[]>}
     */
    async applyBatch(worldName, suggestions) {
        const lorebook = await loadWorldInfo(worldName);
        if (!lorebook) {
            return suggestions.map(s => ({
                success: false,
                suggestionId: s.id,
                worldName,
                error: `Could not load lorebook: "${worldName}"`,
            }));
        }

        const results = [];
        for (const suggestion of suggestions) {
            const entry = lorebook.entries[suggestion.entryUid];
            if (!entry) {
                results.push({
                    success: false,
                    suggestionId: suggestion.id,
                    worldName,
                    error: `Entry UID ${suggestion.entryUid} not found`,
                });
                continue;
            }

            const backup = deepClone(entry);
            this.applyChangesToEntry(entry, suggestion);

            results.push({
                success: true,
                suggestionId: suggestion.id,
                worldName,
                entryUid: suggestion.entryUid,
                backup,
                after: deepClone(entry),
                timestamp: Date.now(),
            });
        }

        await saveWorldInfo(worldName, lorebook, true);
        return results;
    }

    // -----------------------------------------------------------------------
    // Undo
    // -----------------------------------------------------------------------

    /**
     * Restore an entry from a backup created before an update.
     *
     * @param {string} worldName
     * @param {number} entryUid
     * @param {object} backup - The full entry object as it was before the update
     * @returns {Promise<void>}
     */
    async restoreBackup(worldName, entryUid, backup) {
        const lorebook = await loadWorldInfo(worldName);
        if (!lorebook) throw new Error(`[DLM] Could not load lorebook: "${worldName}"`);
        lorebook.entries[entryUid] = deepClone(backup);
        await saveWorldInfo(worldName, lorebook, true);
    }

    // -----------------------------------------------------------------------
    // New entry creation (from newEntities suggestions)
    // -----------------------------------------------------------------------

    /**
     * Create a brand-new entry in a lorebook from a new-entity suggestion.
     *
     * @param {string} worldName
     * @param {{name: string, description: string, suggestedKeywords: string[]}} entity
     * @returns {Promise<object>} The newly created entry
     */
    async createEntry(worldName, entity) {
        const lorebook = await loadWorldInfo(worldName);
        if (!lorebook) throw new Error(`[DLM] Could not load lorebook: "${worldName}"`);

        const entry = createWorldInfoEntry(worldName, lorebook);
        if (!entry) throw new Error('[DLM] createWorldInfoEntry returned null — could not allocate UID');

        entry.comment = entity.name.trim();
        entry.content = entity.description.trim();
        entry.key = Array.isArray(entity.suggestedKeywords)
            ? entity.suggestedKeywords.filter(k => typeof k === 'string' && k.trim())
            : [];

        await saveWorldInfo(worldName, lorebook, true);
        return entry;
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    /**
     * Mutate `entry` in-place according to the suggestion.
     * @param {object} entry
     * @param {object} suggestion
     */
    applyChangesToEntry(entry, suggestion) {
        // Content
        entry.content = suggestion.userModified
            ? (suggestion.editedContent ?? suggestion.suggestedContent)
            : suggestion.suggestedContent;

        // Keywords — only if setting allows it
        const updateFields = this.settings.updateFields ?? ['content'];
        if (updateFields.includes('keywords') && Array.isArray(suggestion.keywordsToAdd) && suggestion.keywordsToAdd.length > 0) {
            entry.key = Array.isArray(entry.key) ? entry.key : [];
            const existingLower = new Set(entry.key.map(k => k.toLowerCase()));
            for (const kw of suggestion.keywordsToAdd) {
                if (typeof kw === 'string' && kw.trim() && !existingLower.has(kw.toLowerCase())) {
                    entry.key.push(kw.trim());
                    existingLower.add(kw.toLowerCase());
                }
            }
        }
    }
}
