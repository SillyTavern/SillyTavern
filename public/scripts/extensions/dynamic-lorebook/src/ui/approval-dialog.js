/**
 * Dynamic Lorebook Manager — Approval Dialog
 *
 * Modal dialog that renders suggestion cards and lets the user review,
 * edit, approve, or reject each one before applying changes.
 *
 * Usage:
 *   const dialog = new ApprovalDialog(suggestions, onApply);
 *   dialog.open();
 */

import { DiffViewer } from './diff-viewer.js';
import { escapeHtml } from '../utils.js';

export class ApprovalDialog {
    /**
     * @param {object[]} suggestions - From UpdateSuggester
     * @param {function(object[]): Promise<void>} onApply - Called with approved suggestions
     */
    constructor(suggestions, onApply) {
        this.suggestions = suggestions.map(s => ({ ...s })); // shallow copy for UI state
        this.onApply = onApply;
        this.el = null;
        this.filterConfidence = 0; // 0–1, filter slider value
    }

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    open() {
        if (this.el) this.close();

        this.el = this.build();
        document.body.appendChild(this.el);

        // Trap keyboard
        this._keyHandler = (e) => this.handleKey(e);
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
        modal.id = 'dlm-approval-modal';

        const overlay = document.createElement('div');
        overlay.className = 'dlm-modal-overlay';
        overlay.addEventListener('click', () => this.close());

        const content = document.createElement('div');
        content.className = 'dlm-modal-content';
        content.addEventListener('click', e => e.stopPropagation());

        content.appendChild(this.buildHeader());
        content.appendChild(this.buildSummary());
        content.appendChild(this.buildToolbar());

        this.listEl = document.createElement('div');
        this.listEl.className = 'dlm-modal-body';
        this.cardListEl = document.createElement('div');
        this.listEl.appendChild(this.cardListEl);
        content.appendChild(this.listEl);

        content.appendChild(this.buildFooter());

        this.renderCards();

        modal.append(overlay, content);
        return modal;
    }

    buildHeader() {
        const header = document.createElement('div');
        header.className = 'dlm-modal-header';

        const title = document.createElement('h2');
        title.className = 'dlm-modal-title';
        title.innerHTML = '<i class="fa-solid fa-wand-sparkles"></i> Lorebook Update Suggestions';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'dlm-modal-close';
        closeBtn.innerHTML = '<i class="fa-solid fa-times"></i>';
        closeBtn.addEventListener('click', () => this.close());

        header.append(title, closeBtn);
        return header;
    }

    buildSummary() {
        const bar = document.createElement('div');
        bar.className = 'dlm-summary-bar';

        const stats = [
            { n: this.suggestions.length, label: 'Suggestion(s)' },
            { n: Math.round(this.suggestions.reduce((a, s) => a + s.confidence, 0) / (this.suggestions.length || 1) * 100), label: 'Avg Confidence' },
        ];

        for (const { n, label } of stats) {
            const box = document.createElement('div');
            box.className = 'dlm-stat-box';
            box.innerHTML = `<span class="dlm-stat-number">${n}${label.includes('Conf') ? '%' : ''}</span><span class="dlm-stat-label">${label}</span>`;
            bar.appendChild(box);
        }

        return bar;
    }

    buildToolbar() {
        const bar = document.createElement('div');
        bar.className = 'dlm-toolbar';

        // Left: select-all
        const left = document.createElement('div');
        left.className = 'dlm-toolbar-left';

        const selectAll = document.createElement('input');
        selectAll.type = 'checkbox';
        selectAll.id = 'dlm-select-all';
        selectAll.addEventListener('change', () => {
            const checked = selectAll.checked;
            this.suggestions.forEach(s => {
                if (s.status !== 'rejected') {
                    s.status = checked ? 'approved' : 'pending';
                }
            });
            this.renderCards();
        });

        const selectLabel = document.createElement('label');
        selectLabel.htmlFor = 'dlm-select-all';
        selectLabel.textContent = 'Select All';

        left.append(selectAll, selectLabel);

        // Right: sort + confidence filter
        const right = document.createElement('div');
        right.className = 'dlm-toolbar-right';

        const sortSel = document.createElement('select');
        sortSel.innerHTML = `
            <option value="confidence">Sort: Confidence</option>
            <option value="impact">Sort: Impact</option>
        `;
        sortSel.addEventListener('change', () => {
            const key = sortSel.value;
            this.suggestions.sort((a, b) => b[key] - a[key]);
            this.renderCards();
        });

        const confLabel = document.createElement('span');
        confLabel.className = 'dlm-filter-label';
        this.confLabelEl = confLabel;
        this.updateConfLabel();

        const confSlider = document.createElement('input');
        confSlider.type = 'range';
        confSlider.min = 0;
        confSlider.max = 100;
        confSlider.value = 0;
        confSlider.addEventListener('input', () => {
            this.filterConfidence = confSlider.value / 100;
            this.updateConfLabel();
            this.renderCards();
        });

        right.append(confLabel, confSlider, sortSel);
        bar.append(left, right);
        return bar;
    }

    updateConfLabel() {
        if (this.confLabelEl) {
            this.confLabelEl.textContent = `Min: ${Math.round(this.filterConfidence * 100)}%`;
        }
    }

    buildFooter() {
        const footer = document.createElement('div');
        footer.className = 'dlm-modal-footer';

        const rejectAllBtn = document.createElement('button');
        rejectAllBtn.className = 'dlm-btn dlm-btn-secondary';
        rejectAllBtn.innerHTML = '<i class="fa-solid fa-times-circle"></i> Reject All';
        rejectAllBtn.addEventListener('click', () => {
            this.suggestions.forEach(s => { s.status = 'rejected'; });
            this.renderCards();
        });

        const right = document.createElement('div');
        right.style.display = 'flex';
        right.style.gap = '8px';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'dlm-btn dlm-btn-secondary';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', () => this.close());

        this.applyBtn = document.createElement('button');
        this.applyBtn.className = 'dlm-btn dlm-btn-primary';
        this.applyBtn.innerHTML = '<i class="fa-solid fa-check-circle"></i> Apply Selected';
        this.applyBtn.addEventListener('click', () => this.applySelected());

        right.append(cancelBtn, this.applyBtn);
        footer.append(rejectAllBtn, right);
        return footer;
    }

    // -----------------------------------------------------------------------
    // Card rendering
    // -----------------------------------------------------------------------

    renderCards() {
        this.cardListEl.innerHTML = '';

        const visible = this.suggestions.filter(s => s.confidence >= this.filterConfidence);

        if (visible.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'dlm-empty';
            empty.textContent = 'No suggestions match the current filter.';
            this.cardListEl.appendChild(empty);
            return;
        }

        for (const suggestion of visible) {
            this.cardListEl.appendChild(this.buildCard(suggestion));
        }

        // Update apply button label
        const approvedCount = this.suggestions.filter(
            s => s.status === 'approved' || s.status === 'edited',
        ).length;
        this.applyBtn.innerHTML = `<i class="fa-solid fa-check-circle"></i> Apply Selected (${approvedCount})`;
        this.applyBtn.disabled = approvedCount === 0;
    }

    buildCard(suggestion) {
        const card = document.createElement('div');
        card.className = 'dlm-card';
        card.dataset.id = suggestion.id;
        card.dataset.status = suggestion.status;

        card.appendChild(this.buildCardHeader(suggestion, card));
        const body = this.buildCardBody(suggestion);
        card.appendChild(body);

        return card;
    }

    buildCardHeader(suggestion, card) {
        const header = document.createElement('div');
        header.className = 'dlm-card-header';

        // Toggle collapse on header click
        header.addEventListener('click', (e) => {
            if (e.target.closest('button, input')) return;
            const body = card.querySelector('.dlm-card-body');
            body.classList.toggle('dlm-collapsed');
        });

        // Left: checkbox + title
        const left = document.createElement('div');
        left.style.display = 'flex';
        left.style.gap = '8px';
        left.style.alignItems = 'flex-start';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = suggestion.status === 'approved' || suggestion.status === 'edited';
        checkbox.addEventListener('change', () => {
            suggestion.status = checkbox.checked ? 'approved' : 'pending';
            card.dataset.status = suggestion.status;
            this.renderCards();
        });

        const titleBlock = document.createElement('div');
        titleBlock.className = 'dlm-card-title-block';
        titleBlock.innerHTML = `
            <span class="dlm-entry-name">${escapeHtml(suggestion.entryComment || String(suggestion.entryUid))}</span>
            <span class="dlm-world-name">${escapeHtml(suggestion.worldName)}</span>
        `;

        left.append(checkbox, titleBlock);

        // Right: confidence + change type
        const meta = document.createElement('div');
        meta.className = 'dlm-card-meta';

        const pct = Math.round(suggestion.confidence * 100);
        const level = pct >= 80 ? 'high' : pct >= 60 ? 'medium' : 'low';

        meta.innerHTML = `
            <div class="dlm-confidence-bar-wrap">
                <div class="dlm-confidence-bar">
                    <div class="dlm-confidence-fill" data-level="${level}" style="width:${pct}%"></div>
                </div>
                <span class="dlm-confidence-text">${pct}%</span>
            </div>
            <span class="dlm-change-badge" data-type="${escapeHtml(suggestion.changeType)}">${escapeHtml(suggestion.changeType)}</span>
        `;

        header.append(left, meta);
        return header;
    }

    buildCardBody(suggestion) {
        const body = document.createElement('div');
        body.className = 'dlm-card-body';

        // Diff viewer
        const viewer = new DiffViewer(suggestion.diff);
        body.appendChild(viewer.render());

        // Reasoning (collapsible)
        if (suggestion.reasoning) {
            const reasonBtn = document.createElement('button');
            reasonBtn.className = 'dlm-reasoning-toggle';
            reasonBtn.innerHTML = '<i class="fa-solid fa-chevron-right"></i> Why this change?';

            const reasonContent = document.createElement('div');
            reasonContent.className = 'dlm-reasoning-content';
            reasonContent.style.display = 'none';
            reasonContent.textContent = suggestion.reasoning;

            reasonBtn.addEventListener('click', () => {
                const hidden = reasonContent.style.display === 'none';
                reasonContent.style.display = hidden ? 'block' : 'none';
                reasonBtn.querySelector('i').className = hidden
                    ? 'fa-solid fa-chevron-down'
                    : 'fa-solid fa-chevron-right';
            });

            body.append(reasonBtn, reasonContent);
        }

        // Keyword tags
        if (suggestion.keywordsToAdd?.length > 0) {
            const tagWrap = document.createElement('div');
            tagWrap.className = 'dlm-keyword-tags';
            tagWrap.innerHTML = '<span class="dlm-keyword-add-label">+ keywords:</span>';
            for (const kw of suggestion.keywordsToAdd) {
                const tag = document.createElement('span');
                tag.className = 'dlm-tag';
                tag.textContent = kw;
                tagWrap.appendChild(tag);
            }
            body.appendChild(tagWrap);
        }

        // Edit area (hidden initially)
        const editArea = document.createElement('div');
        editArea.className = 'dlm-edit-area';
        editArea.style.display = 'none';

        const textarea = document.createElement('textarea');
        textarea.className = 'dlm-edit-textarea';
        textarea.value = suggestion.editedContent ?? suggestion.suggestedContent;

        const editActions = document.createElement('div');
        editActions.className = 'dlm-edit-actions';

        const saveEditBtn = document.createElement('button');
        saveEditBtn.className = 'dlm-btn dlm-btn-success dlm-btn-sm';
        saveEditBtn.innerHTML = '<i class="fa-solid fa-check"></i> Save Edit';
        saveEditBtn.addEventListener('click', () => {
            suggestion.editedContent = textarea.value;
            suggestion.userModified = true;
            suggestion.status = 'edited';
            editArea.style.display = 'none';
            this.renderCards();
        });

        const cancelEditBtn = document.createElement('button');
        cancelEditBtn.className = 'dlm-btn dlm-btn-secondary dlm-btn-sm';
        cancelEditBtn.innerHTML = '<i class="fa-solid fa-times"></i> Cancel';
        cancelEditBtn.addEventListener('click', () => {
            editArea.style.display = 'none';
        });

        editActions.append(saveEditBtn, cancelEditBtn);
        editArea.append(textarea, editActions);
        body.appendChild(editArea);

        // Card footer actions
        body.appendChild(this.buildCardActions(suggestion, editArea));

        return body;
    }

    buildCardActions(suggestion, editArea) {
        const footer = document.createElement('div');
        footer.className = 'dlm-card-footer';

        const approveBtn = document.createElement('button');
        approveBtn.className = 'dlm-btn dlm-btn-success dlm-btn-sm';
        approveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Approve';
        approveBtn.addEventListener('click', () => {
            suggestion.status = 'approved';
            this.renderCards();
        });

        const editBtn = document.createElement('button');
        editBtn.className = 'dlm-btn dlm-btn-secondary dlm-btn-sm';
        editBtn.innerHTML = '<i class="fa-solid fa-pen"></i> Edit';
        editBtn.addEventListener('click', () => {
            const opening = editArea.style.display === 'none';
            editArea.style.display = opening ? 'block' : 'none';
            if (opening && suggestion.status !== 'edited') {
                suggestion.status = 'editing';
                this.renderCards();
            }
        });

        const rejectBtn = document.createElement('button');
        rejectBtn.className = 'dlm-btn dlm-btn-danger dlm-btn-sm';
        rejectBtn.innerHTML = '<i class="fa-solid fa-times"></i> Reject';
        rejectBtn.addEventListener('click', () => {
            suggestion.status = 'rejected';
            this.renderCards();
        });

        footer.append(approveBtn, editBtn, rejectBtn);
        return footer;
    }

    // -----------------------------------------------------------------------
    // Apply
    // -----------------------------------------------------------------------

    async applySelected() {
        const toApply = this.suggestions.filter(
            s => s.status === 'approved' || s.status === 'edited',
        );

        if (toApply.length === 0) return;

        this.applyBtn.disabled = true;
        this.applyBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Applying…';

        try {
            await this.onApply(toApply);
        } finally {
            this.close();
        }
    }

    // -----------------------------------------------------------------------
    // Keyboard
    // -----------------------------------------------------------------------

    handleKey(e) {
        if (e.key === 'Escape') {
            this.close();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            this.applySelected();
        }
    }
}
