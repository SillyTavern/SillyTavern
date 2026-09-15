/**
 * Dynamic Lorebook Manager — Diff Viewer Component
 *
 * Renders a diff_match_patch diff array as an HTML element.
 * Supports inline (default) and side-by-side modes.
 *
 * Usage:
 *   const viewer = new DiffViewer(diffArray);
 *   container.appendChild(viewer.render());
 */

// diff_match_patch operation constants
const DIFF_DELETE = -1;
const DIFF_EQUAL  =  0;
const DIFF_INSERT =  1;

export class DiffViewer {
    /**
     * @param {Array<[number, string]>} diffs - Output from diff_match_patch.diff_main()
     */
    constructor(diffs) {
        this.diffs = diffs ?? [];
        this.mode = 'inline'; // 'inline' | 'side-by-side'
    }

    /**
     * Build and return the root DOM element for this diff viewer.
     * @returns {HTMLElement}
     */
    render() {
        const wrap = document.createElement('div');
        wrap.className = 'dlm-diff-viewer';

        wrap.appendChild(this.renderHeader());
        this.contentEl = this.renderContent();
        wrap.appendChild(this.contentEl);
        wrap.appendChild(this.renderLegend());

        return wrap;
    }

    // -----------------------------------------------------------------------
    // Header
    // -----------------------------------------------------------------------

    renderHeader() {
        const stats = this.computeStats();

        const header = document.createElement('div');
        header.className = 'dlm-diff-header';

        // Stats
        const statsEl = document.createElement('div');
        statsEl.className = 'dlm-diff-stats';
        statsEl.innerHTML = `
            <span class="dlm-stat-add">+${stats.charsAdded} chars</span>
            <span class="dlm-stat-remove">-${stats.charsRemoved} chars</span>
        `;

        // Mode toggle
        const toggle = document.createElement('div');
        toggle.className = 'dlm-diff-mode-toggle';

        const inlineBtn = this.makeModeBtn('Inline', 'inline');
        const sideBtn   = this.makeModeBtn('Side-by-side', 'side-by-side');

        inlineBtn.classList.add('dlm-active');

        inlineBtn.addEventListener('click', () => {
            this.setMode('inline');
            inlineBtn.classList.add('dlm-active');
            sideBtn.classList.remove('dlm-active');
        });
        sideBtn.addEventListener('click', () => {
            this.setMode('side-by-side');
            sideBtn.classList.add('dlm-active');
            inlineBtn.classList.remove('dlm-active');
        });

        toggle.append(inlineBtn, sideBtn);
        header.append(statsEl, toggle);
        return header;
    }

    makeModeBtn(label, mode) {
        const btn = document.createElement('button');
        btn.className = 'dlm-diff-mode-btn';
        btn.textContent = label;
        btn.dataset.mode = mode;
        return btn;
    }

    setMode(mode) {
        this.mode = mode;
        const newContent = this.renderContent();
        this.contentEl.replaceWith(newContent);
        this.contentEl = newContent;
    }

    // -----------------------------------------------------------------------
    // Content
    // -----------------------------------------------------------------------

    renderContent() {
        const el = document.createElement('div');
        el.className = 'dlm-diff-content';
        el.dataset.mode = this.mode;

        if (this.mode === 'inline') {
            this.renderInline(el);
        } else {
            this.renderSideBySide(el);
        }

        return el;
    }

    renderInline(container) {
        for (const [op, text] of this.diffs) {
            const span = document.createElement('span');
            span.textContent = text;

            if (op === DIFF_INSERT) {
                span.className = 'dlm-diff-insert';
            } else if (op === DIFF_DELETE) {
                span.className = 'dlm-diff-delete';
            } else {
                span.className = 'dlm-diff-equal';
            }

            container.appendChild(span);
        }
    }

    renderSideBySide(container) {
        // Build old and new text with highlights
        const oldSide = document.createElement('div');
        oldSide.className = 'dlm-diff-side';

        const newSide = document.createElement('div');
        newSide.className = 'dlm-diff-side';

        const oldLabel = document.createElement('div');
        oldLabel.className = 'dlm-diff-side-label';
        oldLabel.textContent = 'Before';

        const newLabel = document.createElement('div');
        newLabel.className = 'dlm-diff-side-label';
        newLabel.textContent = 'After';

        oldSide.appendChild(oldLabel);
        newSide.appendChild(newLabel);

        for (const [op, text] of this.diffs) {
            if (op === DIFF_EQUAL) {
                oldSide.appendChild(this.makeSpan(text, 'dlm-diff-equal'));
                newSide.appendChild(this.makeSpan(text, 'dlm-diff-equal'));
            } else if (op === DIFF_DELETE) {
                oldSide.appendChild(this.makeSpan(text, 'dlm-diff-delete'));
            } else if (op === DIFF_INSERT) {
                newSide.appendChild(this.makeSpan(text, 'dlm-diff-insert'));
            }
        }

        container.append(oldSide, newSide);
    }

    makeSpan(text, className) {
        const span = document.createElement('span');
        span.className = className;
        span.textContent = text;
        return span;
    }

    // -----------------------------------------------------------------------
    // Legend
    // -----------------------------------------------------------------------

    renderLegend() {
        const legend = document.createElement('div');
        legend.className = 'dlm-diff-legend';
        legend.innerHTML = `
            <span class="dlm-legend-item">
                <span class="dlm-legend-dot dlm-legend-equal"></span> Unchanged
            </span>
            <span class="dlm-legend-item">
                <span class="dlm-legend-dot dlm-legend-insert"></span> Added
            </span>
            <span class="dlm-legend-item">
                <span class="dlm-legend-dot dlm-legend-delete"></span> Removed
            </span>
        `;
        return legend;
    }

    // -----------------------------------------------------------------------
    // Stats
    // -----------------------------------------------------------------------

    computeStats() {
        let charsAdded = 0;
        let charsRemoved = 0;
        for (const [op, text] of this.diffs) {
            if (op === DIFF_INSERT) charsAdded += text.length;
            else if (op === DIFF_DELETE) charsRemoved += text.length;
        }
        return { charsAdded, charsRemoved };
    }
}
