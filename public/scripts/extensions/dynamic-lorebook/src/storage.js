/**
 * Dynamic Lorebook Manager — Update History
 *
 * Stores a bounded, ordered log of lorebook updates in localStorage.
 * Supports sequential undo/redo via a current-index pointer.
 * The actual backup restoration is handled by LorebookUpdater;
 * this class only manages the records and pointer.
 */

import { generateId } from './utils.js';

const STORAGE_KEY = 'dlm_update_history';

export class UpdateHistory {
    /**
     * @param {number} [maxSize=50] Maximum number of records to keep
     */
    constructor(maxSize = 50) {
        this.maxSize = maxSize;
        /** @type {object[]} Ordered list of update records */
        this.history = [];
        /** @type {number} Points at the last applied record (-1 = nothing applied) */
        this.currentIndex = -1;
        this.load();
    }

    // -----------------------------------------------------------------------
    // Record management
    // -----------------------------------------------------------------------

    /**
     * Append a new update record.
     * Truncates any "future" history (records after currentIndex) that existed
     * from a previous undo before adding the new record.
     *
     * @param {object} record - Must contain: worldName, changes[], metadata
     */
    addUpdate(record) {
        // Discard any redo history
        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
        }

        this.history.push({
            id: generateId('rec'),
            timestamp: Date.now(),
            ...record,
        });
        this.currentIndex++;

        // Enforce size cap — drop the oldest
        if (this.history.length > this.maxSize) {
            const overflow = this.history.length - this.maxSize;
            this.history.splice(0, overflow);
            this.currentIndex = Math.max(this.currentIndex - overflow, -1);
        }

        this.save();
    }

    // -----------------------------------------------------------------------
    // Undo / redo — two-phase API
    // The actual restoration is performed by LorebookUpdater; the caller
    // calls peekUndo(), does the restore, then calls commitUndo().
    // -----------------------------------------------------------------------

    /**
     * Return the record that would be undone, without moving the pointer.
     * @returns {object|null}
     */
    peekUndo() {
        if (!this.canUndo()) return null;
        return this.history[this.currentIndex];
    }

    /**
     * Mark the current record as undone and move the pointer backward.
     * Must only be called after the restore was successfully applied.
     */
    commitUndo() {
        if (!this.canUndo()) return;
        this.history[this.currentIndex] = {
            ...this.history[this.currentIndex],
            undone: true,
        };
        this.currentIndex--;
        this.save();
    }

    /**
     * Return the record that would be redone, without moving the pointer.
     * @returns {object|null}
     */
    peekRedo() {
        if (!this.canRedo()) return null;
        return this.history[this.currentIndex + 1];
    }

    /**
     * Move the pointer forward after a successful redo.
     */
    commitRedo() {
        if (!this.canRedo()) return;
        this.currentIndex++;
        this.history[this.currentIndex] = {
            ...this.history[this.currentIndex],
            undone: false,
        };
        this.save();
    }

    canUndo() { return this.currentIndex >= 0; }
    canRedo() { return this.currentIndex < this.history.length - 1; }

    // -----------------------------------------------------------------------
    // Accessors
    // -----------------------------------------------------------------------

    /**
     * Returns all records in chronological order.
     * @returns {object[]}
     */
    getHistory() { return [...this.history]; }

    /**
     * Returns only the records that are currently "active" (not undone).
     * @returns {object[]}
     */
    getActiveHistory() {
        return this.history.slice(0, this.currentIndex + 1);
    }

    // -----------------------------------------------------------------------
    // Persistence
    // -----------------------------------------------------------------------

    clearHistory() {
        this.history = [];
        this.currentIndex = -1;
        this.save();
    }

    exportHistory() {
        return JSON.stringify({ history: this.history, currentIndex: this.currentIndex }, null, 2);
    }

    importHistory(json) {
        try {
            const data = JSON.parse(json);
            this.history = Array.isArray(data.history) ? data.history : [];
            this.currentIndex = typeof data.currentIndex === 'number' ? data.currentIndex : -1;
            this.save();
        } catch (e) {
            console.error('[DLM] Failed to import history:', e.message);
        }
    }

    save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                history: this.history,
                currentIndex: this.currentIndex,
            }));
        } catch (e) {
            console.warn('[DLM] localStorage write failed (storage full?):', e.message);
        }
    }

    load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const data = JSON.parse(raw);
                this.history = Array.isArray(data.history) ? data.history : [];
                this.currentIndex = typeof data.currentIndex === 'number'
                    ? data.currentIndex
                    : this.history.length - 1;
            }
        } catch (e) {
            console.warn('[DLM] Could not load history from localStorage:', e.message);
            this.history = [];
            this.currentIndex = -1;
        }
    }
}
