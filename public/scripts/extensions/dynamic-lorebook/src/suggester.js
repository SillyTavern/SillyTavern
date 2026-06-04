/**
 * Dynamic Lorebook Manager — Update Suggester
 *
 * Filters and ranks raw analysis results, computes diffs, and produces
 * the final Suggestion objects consumed by the UI.
 */

import { generateId } from './utils.js';

/** Weight for change types when computing impact score. */
const CHANGE_TYPE_WEIGHT = {
    correction: 1.0,
    expansion: 0.7,
    addition: 0.5,
};

/**
 * Processes analysis results into actionable, UI-ready suggestions.
 */
export class UpdateSuggester {
    /**
     * @param {object} settings - Extension settings reference
     */
    constructor(settings) {
        this.settings = settings;
    }

    /**
     * Convert an AnalysisResult into a sorted array of Suggestions.
     *
     * @param {{updates: object[], newEntities: object[]}} analysis
     * @param {object[]} activatedEntries - Original WI entries (for original content)
     * @returns {object[]} Sorted suggestion list
     */
    generateSuggestions(analysis, activatedEntries) {
        const entryMap = new Map(activatedEntries.map(e => [e.uid, e]));

        const suggestions = analysis.updates
            .filter(u => u.confidence >= (this.settings.minConfidence ?? 0.7))
            .filter(u => this.passesAggressiveness(u))
            .map(u => {
                const original = entryMap.get(u.entryUid);
                const originalContent = original?.content ?? '';
                const diff = this.computeDiff(originalContent, u.suggestedNewContent);
                const impact = this.calculateImpact(u, originalContent);

                // Backfill world/comment from the original entry if the LLM omitted it
                const worldName = u.worldName || original?.world || '';
                const entryComment = u.entryComment || original?.comment || String(u.entryUid);

                return {
                    id: generateId('sug'),
                    entryUid: u.entryUid,
                    entryComment,
                    worldName,
                    originalContent,
                    suggestedContent: u.suggestedNewContent,
                    keywordsToAdd: u.keywordsToAdd ?? [],
                    diff,
                    confidence: u.confidence,
                    changeType: u.changeType,
                    reasoning: u.reasoning,
                    impact,
                    // UI state
                    status: 'pending',      // pending | approved | rejected | editing | edited
                    userModified: false,
                    editedContent: null,
                    createdAt: Date.now(),
                    reviewedAt: null,
                    appliedAt: null,
                };
            });

        return this.rankSuggestions(suggestions);
    }

    // -----------------------------------------------------------------------
    // Filtering
    // -----------------------------------------------------------------------

    /**
     * Returns true if the update passes the current aggressiveness setting.
     * @param {object} update
     * @returns {boolean}
     */
    passesAggressiveness(update) {
        switch (this.settings.aggressiveness ?? 'balanced') {
            case 'conservative':
                // Only obvious expansions
                return update.changeType === 'expansion' && update.confidence >= 0.8;
            case 'balanced':
                // Expansions and high-confidence corrections; additions need high confidence
                if (update.changeType === 'addition') return update.confidence >= 0.8;
                return true;
            case 'aggressive':
                return true;
            default:
                return true;
        }
    }

    // -----------------------------------------------------------------------
    // Ranking
    // -----------------------------------------------------------------------

    /**
     * Sort suggestions: highest confidence first, then highest impact.
     * @param {object[]} suggestions
     * @returns {object[]}
     */
    rankSuggestions(suggestions) {
        return [...suggestions].sort((a, b) => {
            if (b.confidence !== a.confidence) return b.confidence - a.confidence;
            return b.impact - a.impact;
        });
    }

    /**
     * Calculate a composite impact score for a suggestion.
     * @param {object} update
     * @param {string} originalContent
     * @returns {number}
     */
    calculateImpact(update, originalContent) {
        const charDelta = Math.max(0, update.suggestedNewContent.length - (originalContent?.length ?? 0));
        const keywordsAdded = (update.keywordsToAdd ?? []).length;
        const typeWeight = CHANGE_TYPE_WEIGHT[update.changeType] ?? 0.5;

        // Normalised: character delta contributes up to ~3 for +1000 chars
        const charScore = Math.min(charDelta / 333, 3) * 0.3;
        const kwScore = Math.min(keywordsAdded, 5) * 0.2;
        const typeScore = typeWeight * 0.5;

        return charScore + kwScore + typeScore;
    }

    // -----------------------------------------------------------------------
    // Diff computation
    // -----------------------------------------------------------------------

    /**
     * Compute a semantic character-level diff using diff_match_patch (from lib.js).
     * Returns an array of [DIFF_DELETE|DIFF_EQUAL|DIFF_INSERT, text] pairs.
     *
     * Falls back to a simple [delete all, insert all] pair if diff_match_patch
     * is unavailable.
     *
     * @param {string} oldText
     * @param {string} newText
     * @returns {Array<[number, string]>}
     */
    computeDiff(oldText, newText) {
        /* global diff_match_patch */
        if (typeof diff_match_patch === 'undefined') {
            console.warn('[DLM] diff_match_patch not available — using simple diff');
            if (oldText === newText) return [[0, oldText]];
            return [[-1, oldText], [1, newText]];
        }

        try {
            const dmp = new diff_match_patch();
            const diffs = dmp.diff_main(oldText, newText);
            dmp.diff_cleanupSemantic(diffs);
            return diffs;
        } catch (e) {
            console.warn('[DLM] diff_match_patch error:', e.message);
            return [[-1, oldText], [1, newText]];
        }
    }
}
