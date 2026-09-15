/**
 * Dynamic Lorebook Manager — History Panel
 *
 * Modal panel that displays the update history and exposes
 * undo/redo/revert controls.
 *
 * Usage:
 *   const panel = new HistoryPanel(history, updater, onUndoRedo);
 *   panel.open();
 */

import { escapeHtml, timeAgo } from '../utils.js';

export class HistoryPanel {
    /**
     * @param {import('../storage.js').UpdateHistory} history
     * @param {import('../updater.js').LorebookUpdater} updater
     * @param {function(): void} onUndoRedo - Called after any undo/redo so the
     *   settings widget can refresh its state
     */
    constructor(history, updater, onUndoRedo) {
        this.history = history;
        this.updater = updater;
        this.onUndoRedo = onUndoRedo;
        this.el = null;
    }

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    open() {
        if (this.el) this.close();
        this.el = this.build();
        document.body.appendChild(this.el);

        this._keyHandler = (e) => { if (e.key === 'Escape') this.close(); };
        document.addEventListener('keydown', this._keyHandler);

        requestAnimationFrame(() => this.el.classList.add('dlm-open'));
    }

    close() {
        if (!this.el) return;
        document.removeEventListener('keydown', this._keyHandler);
        this.el.remove();
        this.el = null;
    }

    // -----------------------------------------------------------------------
    // Build
    // -----------------------------------------------------------------------

    build() {
        const modal = document.createElement('div');
        modal.className = 'dlm-modal';

        const overlay = document.createElement('div');
        overlay.className = 'dlm-modal-overlay';
        overlay.addEventListener('click', () => this.close());

        const content = document.createElement('div');
        content.className = 'dlm-modal-content';
        content.style.width = '600px';
        content.addEventListener('click', e => e.stopPropagation());

        content.appendChild(this.buildHeader());

        this.bodyEl = document.createElement('div');
        this.bodyEl.className = 'dlm-modal-body';
        this.renderList();
        content.appendChild(this.bodyEl);

        content.appendChild(this.buildFooter());

        modal.append(overlay, content);
        return modal;
    }

    buildHeader() {
        const header = document.createElement('div');
        header.className = 'dlm-modal-header';

        const title = document.createElement('h2');
        title.className = 'dlm-modal-title';
        title.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i> Update History';

        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '6px';
        actions.style.alignItems = 'center';

        this.undoBtn = document.createElement('button');
        this.undoBtn.className = 'dlm-btn dlm-btn-secondary dlm-btn-sm';
        this.undoBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Undo';
        this.undoBtn.addEventListener('click', () => this.doUndo());

        this.redoBtn = document.createElement('button');
        this.redoBtn.className = 'dlm-btn dlm-btn-secondary dlm-btn-sm';
        this.redoBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Redo';
        this.redoBtn.addEventListener('click', () => this.doRedo());

        const closeBtn = document.createElement('button');
        closeBtn.className = 'dlm-modal-close';
        closeBtn.innerHTML = '<i class="fa-solid fa-times"></i>';
        closeBtn.addEventListener('click', () => this.close());

        this.refreshUndoRedoBtns();
        actions.append(this.undoBtn, this.redoBtn, closeBtn);
        header.append(title, actions);
        return header;
    }

    buildFooter() {
        const footer = document.createElement('div');
        footer.className = 'dlm-modal-footer';

        const clearBtn = document.createElement('button');
        clearBtn.className = 'dlm-btn dlm-btn-secondary';
        clearBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Clear History';
        clearBtn.addEventListener('click', () => {
            if (confirm('Clear all update history? This cannot be undone.')) {
                this.history.clearHistory();
                this.renderList();
                this.refreshUndoRedoBtns();
            }
        });

        const exportBtn = document.createElement('button');
        exportBtn.className = 'dlm-btn dlm-btn-secondary';
        exportBtn.innerHTML = '<i class="fa-solid fa-download"></i> Export';
        exportBtn.addEventListener('click', () => {
            const blob = new Blob([this.history.exportHistory()], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `dlm-history-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
        });

        const closeBtn = document.createElement('button');
        closeBtn.className = 'dlm-btn dlm-btn-secondary';
        closeBtn.textContent = 'Close';
        closeBtn.addEventListener('click', () => this.close());

        footer.append(clearBtn, exportBtn, closeBtn);
        return footer;
    }

    // -----------------------------------------------------------------------
    // List rendering
    // -----------------------------------------------------------------------

    renderList() {
        this.bodyEl.innerHTML = '';

        const records = this.history.getHistory();

        if (records.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'dlm-empty';
            empty.textContent = 'No updates recorded yet.';
            this.bodyEl.appendChild(empty);
            return;
        }

        const list = document.createElement('div');
        list.className = 'dlm-history-list';

        // Show newest first
        for (let i = records.length - 1; i >= 0; i--) {
            const record = records[i];
            const isActive = i <= this.history.currentIndex;
            list.appendChild(this.buildItem(record, i, isActive));
        }

        this.bodyEl.appendChild(list);
    }

    buildItem(record, index, isActive) {
        const item = document.createElement('div');
        item.className = 'dlm-history-item';
        if (!isActive) item.classList.add('dlm-undone');

        const icon = document.createElement('div');
        icon.className = 'dlm-history-icon';
        icon.innerHTML = '<i class="fa-solid fa-pen-to-square"></i>';

        const details = document.createElement('div');
        details.className = 'dlm-history-details';

        const changes = Array.isArray(record.changes) ? record.changes : [];
        const entryNames = changes.map(c => c.entryComment || `UID ${c.entryUid}`).join(', ');
        const title = changes.length === 1
            ? `Updated "${entryNames}"`
            : `Updated ${changes.length} entries`;

        details.innerHTML = `
            <div class="dlm-history-title">${escapeHtml(title)}</div>
            <div class="dlm-history-meta">
                ${escapeHtml(record.worldName ?? '')} &middot; ${timeAgo(record.timestamp)}
            </div>
        `;

        const actions = document.createElement('div');
        actions.className = 'dlm-history-actions';

        const revertBtn = document.createElement('button');
        revertBtn.className = 'dlm-btn dlm-btn-secondary dlm-btn-sm';
        revertBtn.title = 'Revert this update';
        revertBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i>';
        revertBtn.disabled = !isActive;
        revertBtn.addEventListener('click', () => this.doRevert(record, index));

        actions.appendChild(revertBtn);
        item.append(icon, details, actions);
        return item;
    }

    // -----------------------------------------------------------------------
    // Undo / Redo / Revert
    // -----------------------------------------------------------------------

    async doUndo() {
        const record = this.history.peekUndo();
        if (!record) return;

        try {
            await this.restoreRecord(record);
            this.history.commitUndo();
            this.onUndoRedo?.();
            this.renderList();
            this.refreshUndoRedoBtns();
            toastr.success('Update undone.');
        } catch (e) {
            console.error('[DLM] Undo failed:', e);
            toastr.error('Undo failed: ' + e.message);
        }
    }

    async doRedo() {
        const record = this.history.peekRedo();
        if (!record) return;

        try {
            await this.reapplyRecord(record);
            this.history.commitRedo();
            this.onUndoRedo?.();
            this.renderList();
            this.refreshUndoRedoBtns();
            toastr.success('Update reapplied.');
        } catch (e) {
            console.error('[DLM] Redo failed:', e);
            toastr.error('Redo failed: ' + e.message);
        }
    }

    async doRevert(record, _index) {
        if (!confirm(`Revert update to "${record.worldName}"?`)) return;

        try {
            await this.restoreRecord(record);
            // Revert doesn't move the history pointer — it's a standalone restore
            this.onUndoRedo?.();
            this.renderList();
            toastr.success('Entry reverted to previous state.');
        } catch (e) {
            console.error('[DLM] Revert failed:', e);
            toastr.error('Revert failed: ' + e.message);
        }
    }

    /**
     * Restore all entry backups stored in a history record.
     * @param {object} record
     */
    async restoreRecord(record) {
        for (const change of (record.changes ?? [])) {
            await this.updater.restoreBackup(record.worldName, change.entryUid, change.before);
        }
    }

    /**
     * Reapply the "after" state from a history record.
     * @param {object} record
     */
    async reapplyRecord(record) {
        for (const change of (record.changes ?? [])) {
            await this.updater.restoreBackup(record.worldName, change.entryUid, change.after);
        }
    }

    refreshUndoRedoBtns() {
        if (this.undoBtn) this.undoBtn.disabled = !this.history.canUndo();
        if (this.redoBtn) this.redoBtn.disabled = !this.history.canRedo();
    }
}
