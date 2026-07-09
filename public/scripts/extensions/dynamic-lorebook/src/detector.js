/**
 * Dynamic Lorebook Manager — Entry Detector
 *
 * Tracks which lorebook entries were activated during each AI generation
 * by correlating WORLD_INFO_ACTIVATED events with MESSAGE_RECEIVED events.
 *
 * Event flow:
 *   GENERATION_STARTED → reset pending buffer
 *   WORLD_INFO_ACTIVATED (WIEntry[]) → accumulate into pending buffer
 *   MESSAGE_RECEIVED (messageId, type) → commit pending buffer to history
 */
export class EntryDetector {
    constructor() {
        /**
         * Maps message ID (string) → array of WI entries that were active.
         * @type {Map<string, object[]>}
         */
        this.activationHistory = new Map();

        /**
         * Entries accumulated since the last GENERATION_STARTED.
         * @type {object[]}
         */
        this.pendingActivations = [];

        /**
         * Whether a generation is currently in flight.
         * @type {boolean}
         */
        this.generationInProgress = false;

        /** Maximum number of messages to keep in history. */
        this.maxHistory = 100;
    }

    // -----------------------------------------------------------------------
    // Event handlers — bind these to the SillyTavern event bus
    // -----------------------------------------------------------------------

    /**
     * Called when GENERATION_STARTED fires.
     * Clears the pending buffer so a fresh generation starts clean.
     */
    onGenerationStarted() {
        this.pendingActivations = [];
        this.generationInProgress = true;
    }

    /**
     * Called when WORLD_INFO_ACTIVATED fires.
     * The event payload is a flat array of WI entry objects.
     *
     * @param {object[]} entries
     */
    onActivation(entries) {
        if (!Array.isArray(entries) || entries.length === 0) return;
        // Deduplicate by world+uid in case the event fires multiple times
        // (e.g. recursive WI scanning)
        const seen = new Set(this.pendingActivations.map(e => `${e.world}.${e.uid}`));
        for (const entry of entries) {
            const key = `${entry.world}.${entry.uid}`;
            if (!seen.has(key)) {
                seen.add(key);
                this.pendingActivations.push(entry);
            }
        }
    }

    /**
     * Called when MESSAGE_RECEIVED fires.
     * Associates the accumulated pending activations with the incoming message ID,
     * then clears the pending buffer.
     *
     * @param {number|string} messageId - The chat array index of the new message
     * @returns {object[]} The activations associated with this message
     */
    onMessageReceived(messageId) {
        this.generationInProgress = false;
        const key = String(messageId);

        if (this.pendingActivations.length > 0) {
            this.activationHistory.set(key, [...this.pendingActivations]);
        }

        this.pendingActivations = [];
        this.pruneHistory();

        return this.activationHistory.get(key) ?? [];
    }

    // -----------------------------------------------------------------------
    // Query helpers
    // -----------------------------------------------------------------------

    /**
     * Returns the activations recorded for a specific message.
     * @param {number|string} messageId
     * @returns {object[]}
     */
    getActivationsForMessage(messageId) {
        return this.activationHistory.get(String(messageId)) ?? [];
    }

    /**
     * Returns true if there are any activations stored for this message.
     * @param {number|string} messageId
     * @returns {boolean}
     */
    hasActivationsForMessage(messageId) {
        const entries = this.activationHistory.get(String(messageId));
        return Array.isArray(entries) && entries.length > 0;
    }

    // -----------------------------------------------------------------------
    // Maintenance
    // -----------------------------------------------------------------------

    /**
     * Prune history to stay within maxHistory entries.
     * Removes the oldest entries first.
     */
    pruneHistory() {
        if (this.activationHistory.size <= this.maxHistory) return;
        const keys = Array.from(this.activationHistory.keys());
        const removeCount = keys.length - this.maxHistory;
        for (let i = 0; i < removeCount; i++) {
            this.activationHistory.delete(keys[i]);
        }
    }

    /**
     * Clear all stored history and pending state.
     */
    clearHistory() {
        this.activationHistory.clear();
        this.pendingActivations = [];
        this.generationInProgress = false;
    }

    /**
     * Returns lightweight statistics about activation patterns.
     * @returns {object}
     */
    getStats() {
        let totalEntries = 0;
        const frequency = new Map();

        for (const entries of this.activationHistory.values()) {
            totalEntries += entries.length;
            for (const e of entries) {
                const k = `${e.world}.${e.uid}`;
                frequency.set(k, (frequency.get(k) ?? 0) + 1);
            }
        }

        const mostActivated = Array.from(frequency.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([key, count]) => ({ key, count }));

        const msgCount = this.activationHistory.size;
        return {
            totalMessages: msgCount,
            totalEntryActivations: totalEntries,
            averageEntriesPerMessage: msgCount ? (totalEntries / msgCount).toFixed(1) : 0,
            mostActivated,
        };
    }
}
