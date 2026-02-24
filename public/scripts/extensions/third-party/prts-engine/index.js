/**
 * PRTS Narrative Engine — Pure UI Shell + Command Registry
 *
 * Architecture:
 * - This file is ONLY a display shell and state store.
 * - It contains ZERO generation logic, ZERO prompt templates.
 * - Every button click executes an STscript pipeline (configurable).
 * - Slash commands are pure state read/write + display operations.
 * - External STscript pipelines call these commands to drive the UI.
 *
 * Command categories:
 *   Display:  /prts-display  — push text/html into the story canvas
 *   Cards:    /prts-card     — add/remove/list/clear perception & deduction cards
 *   State:    /prts-state    — get/set arbitrary state fields
 *   Timeline: /prts-timeline — add/jump/list/clear timeline nodes
 *   Scene:    /prts-scene    — set/append/clear scene blocks
 *   History:  /prts-history  — add/list/clear log entries
 *   Items:    /prts-inventory— add/remove/clear/list inventory items
 *   Stream:   /prts-stream   — start/append/commit/cancel live streaming display
 *   UI:       /prts          — toggle on/off
 *             /prts-mode     — switch mode (actor/director/editor)
 *             /prts-vibe     — set emotional tone
 *             /prts-reset    — full state reset
 *
 * Button bindings (configurable via /prts-bind):
 *   Each UI button has an id → maps to an STscript string.
 *   When clicked, the STscript is executed via executeSlashCommandsWithOptions.
 */

import { eventSource, event_types } from '../../../script.js';
import { getContext } from '../../st-context.js';
import { SlashCommandParser } from '../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from '../../slash-commands/SlashCommandArgument.js';

// ═══════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════

const EXTENSION_NAME = 'prts-engine';

const MODES = { ACTOR: 'actor', DIRECTOR: 'director', EDITOR: 'editor' };

const VIBES = ['tense', 'calm', 'melancholy', 'urgent', 'eerie', 'warm', 'chaotic', 'solemn'];

/**
 * Default button → STscript bindings.
 * Keys are button element IDs. Values are STscript strings to execute on click.
 * Users can override these via /prts-bind or by editing chat_metadata.
 *
 * Available template variables (expanded at execution time):
 *   {{prtsInput}}     — text from the actor hub input
 *   {{prtsDirector}}  — text from the director input
 *   {{prtsVibe}}      — current vibe string
 *   {{prtsMode}}      — current mode string
 */
const DEFAULT_BINDINGS = {
    'prts-actor-commit': '/prts-commit {{prtsInput}}',
    'prts-director-commit': '/prts-override {{prtsDirector}}',
    'prts-add-perception': '/prts-perception',
    'prts-add-deduction': '/prts-deduction',
    'prts-auto-wait': '/prts-auto type=wait',
    'prts-auto-continue': '/prts-auto type=continue',
    'prts-auto-skip': '/prts-auto type=skip',
    'prts-editor-branch': '/prts-timeline action=add type=branch desc="Branch at scene {{prtsSceneCount}}"',
    'prts-editor-rewind': '/prts-timeline action=back',
    'prts-editor-bookmark': '/prts-timeline action=add type=bookmark desc="Bookmark at scene {{prtsSceneCount}}"',
    'prts-gen-stop': '/stop',
};

const DEFAULT_STATE = () => ({
    active: false,
    mode: MODES.ACTOR,
    vibe: 'tense',
    timeline: [],
    timelineIndex: -1,
    perceptionCards: [],
    deductionCards: [],
    historyLog: [],
    inventory: [],
    sceneBlocks: [],
    currentScene: '',
    generating: false,
    bindings: {},
});

// ═══════════════════════════════════════════════════════════
//  STATE MANAGEMENT (persisted in chat_metadata)
// ═══════════════════════════════════════════════════════════

let state = DEFAULT_STATE();

function loadState() {
    const ctx = getContext();
    const saved = ctx.chatMetadata?.prts_state;
    if (saved) {
        state = Object.assign(DEFAULT_STATE(), JSON.parse(JSON.stringify(saved)));
    } else {
        state = DEFAULT_STATE();
    }
}

function saveState() {
    const ctx = getContext();
    if (ctx.chatMetadata) {
        ctx.chatMetadata.prts_state = JSON.parse(JSON.stringify(state));
        ctx.saveMetadataDebounced();
    }
}

// ═══════════════════════════════════════════════════════════
//  BUTTON BINDING SYSTEM
//  Every UI button executes an STscript pipeline.
//  Bindings are resolved: user overrides > defaults.
// ═══════════════════════════════════════════════════════════

function getBinding(buttonId) {
    return state.bindings[buttonId] || DEFAULT_BINDINGS[buttonId] || '';
}

/**
 * Expand template variables in a binding string.
 * @param {string} script — the STscript template
 * @returns {string}
 */
function expandBindingVars(script) {
    const hubInput = document.getElementById('prts-hub-input');
    const dirInput = document.getElementById('prts-director-input');
    return script
        .replace(/\{\{prtsInput\}\}/g, hubInput ? hubInput.value.trim() : '')
        .replace(/\{\{prtsDirector\}\}/g, dirInput ? dirInput.value.trim() : '')
        .replace(/\{\{prtsVibe\}\}/g, state.vibe)
        .replace(/\{\{prtsMode\}\}/g, state.mode)
        .replace(/\{\{prtsSceneCount\}\}/g, String(state.sceneBlocks.length));
}

/**
 * Execute a button's bound STscript.
 * @param {string} buttonId
 */
async function executeBinding(buttonId) {
    const raw = getBinding(buttonId);
    if (!raw) return;

    const script = expandBindingVars(raw);
    const ctx = getContext();

    try {
        await ctx.executeSlashCommandsWithOptions(script);
    } catch (err) {
        console.error(`[PRTS] Binding execution error (${buttonId}):`, err);
    }

    // Clear inputs after commit actions
    if (buttonId === 'prts-actor-commit') {
        const hubInput = document.getElementById('prts-hub-input');
        if (hubInput) hubInput.value = '';
    }
    if (buttonId === 'prts-director-commit') {
        const dirInput = document.getElementById('prts-director-input');
        if (dirInput) dirInput.value = '';
    }
}

// ═══════════════════════════════════════════════════════════
//  STATE MUTATION HELPERS (called by slash commands)
// ═══════════════════════════════════════════════════════════

function appendSceneBlock(text, source = '') {
    state.sceneBlocks.push({
        id: Date.now(),
        text: text,
        source: source,
        timestamp: new Date().toISOString(),
    });
    state.currentScene = text;
}

function addTimelineNode(type, desc) {
    state.timeline.push({
        id: Date.now(),
        type: type,
        desc: desc,
        timestamp: new Date().toISOString(),
    });
    state.timelineIndex = state.timeline.length - 1;
}

function addHistoryEntry(type, text) {
    state.historyLog.push({
        id: Date.now(),
        type: type,
        text: text,
        timestamp: new Date().toISOString(),
    });
    if (state.historyLog.length > 100) {
        state.historyLog = state.historyLog.slice(-100);
    }
}

function addPerceptionCard(text) {
    state.perceptionCards.push({ id: Date.now(), text: text.trim() });
}

function addDeductionCard(text) {
    state.deductionCards.push({ id: Date.now(), text: text.trim() });
}

function removeCard(type, id) {
    if (type === 'perception') {
        state.perceptionCards = state.perceptionCards.filter(c => c.id !== id);
    } else if (type === 'deduction') {
        state.deductionCards = state.deductionCards.filter(c => c.id !== id);
    }
    saveState();
    updateUI();
}

function setMode(mode) {
    if (Object.values(MODES).includes(mode)) {
        state.mode = mode;
        saveState();
        updateUI();
    }
}

function setVibe(vibe) {
    state.vibe = vibe;
    saveState();
    updateUI();
}

// ═══════════════════════════════════════════════════════════
//  UI — HTML TEMPLATE
// ═══════════════════════════════════════════════════════════

function buildHTML() {
    const vibeChips = VIBES.map(v =>
        `<button class="prts-vibe-chip${state.vibe === v ? ' active' : ''}" data-vibe="${v}">${v}</button>`,
    ).join('');

    return `
<div id="prts-engine" class="${state.active ? '' : 'hidden'}">
    <!-- Top Stage -->
    <div class="prts-top-stage">
        <!-- Story Canvas -->
        <div class="prts-story-canvas">
            <div class="prts-story-scroll" id="prts-story-scroll">
                <div id="prts-scene-container"></div>
            </div>
            <div class="prts-gen-overlay" id="prts-gen-overlay">
                <div class="prts-gen-spinner"></div>
                <span class="prts-gen-label">GENERATING...</span>
                <button class="prts-gen-stop" id="prts-gen-stop">STOP</button>
            </div>
        </div>

        <!-- Side Panel -->
        <div class="prts-side-panel" id="prts-side-panel">
            <div class="prts-side-tabs">
                <button class="prts-side-tab active" data-panel="visual">Visual</button>
                <button class="prts-side-tab" data-panel="history">History</button>
                <button class="prts-side-tab" data-panel="custom">Items</button>
            </div>
            <div class="prts-side-content">
                <div class="prts-side-section active" data-panel="visual">
                    <div class="prts-visual-frame" id="prts-cg-frame">
                        <span>CG VIEWPORT</span>
                    </div>
                    <div class="prts-portrait-frame" id="prts-portrait-frame">
                        <span>?</span>
                    </div>
                </div>
                <div class="prts-side-section" data-panel="history">
                    <div id="prts-history-list"></div>
                </div>
                <div class="prts-side-section" data-panel="custom">
                    <div id="prts-inventory-list"></div>
                </div>
            </div>
        </div>
    </div>

    <!-- Console Wrapper -->
    <div class="prts-console-wrapper expanded" id="prts-console-wrapper">
        <div class="prts-console-toggle" id="prts-console-toggle">
            <span class="prts-toggle-arrow">▲</span>
            <span class="prts-toggle-label">Console</span>
            <span class="prts-mode-indicator" id="prts-mode-indicator" data-mode="${state.mode}">${state.mode.toUpperCase()}</span>
        </div>
        <div class="prts-console-body">
            <!-- Mode Shifter -->
            <div class="prts-mode-shifter">
                <button class="prts-mode-btn${state.mode === 'actor' ? ' active' : ''}" data-mode="actor">Actor</button>
                <button class="prts-mode-btn${state.mode === 'director' ? ' active' : ''}" data-mode="director">Director</button>
                <button class="prts-mode-btn${state.mode === 'editor' ? ' active' : ''}" data-mode="editor">Editor</button>
            </div>

            <!-- Actor Mode -->
            <div class="prts-mode-panel${state.mode === 'actor' ? ' active' : ''}" data-mode="actor">
                <div class="prts-actor-layout">
                    <div class="prts-actor-column">
                        <div class="prts-column-header">Action Hub</div>
                        <textarea class="prts-hub-input" id="prts-hub-input"
                            placeholder="Describe your action, dialogue, or intention..."></textarea>
                        <div class="prts-vibe-row">${vibeChips}</div>
                    </div>
                    <div class="prts-actor-column">
                        <div class="prts-column-header">Perception</div>
                        <div class="prts-card-stack" id="prts-perception-stack"></div>
                        <button class="prts-card-add" id="prts-add-perception">+ Generate Perception</button>
                    </div>
                    <div class="prts-actor-column">
                        <div class="prts-column-header">Deduction</div>
                        <div class="prts-card-stack" id="prts-deduction-stack"></div>
                        <button class="prts-card-add" id="prts-add-deduction">+ Generate Deduction</button>
                    </div>
                </div>
                <button class="prts-commit-btn" id="prts-actor-commit">
                    <span>▶</span> COMMIT ACTION
                </button>
            </div>

            <!-- Director Mode -->
            <div class="prts-mode-panel${state.mode === 'director' ? ' active' : ''}" data-mode="director">
                <textarea class="prts-director-override" id="prts-director-input"
                    placeholder="Force a narrative event, introduce a plot twist, change the weather..."></textarea>
                <button class="prts-director-commit" id="prts-director-commit">
                    <span>◆</span> OVERRIDE
                </button>
            </div>

            <!-- Editor Mode -->
            <div class="prts-mode-panel${state.mode === 'editor' ? ' active' : ''}" data-mode="editor">
                <div class="prts-timeline-viewport" id="prts-timeline-viewport"></div>
                <div class="prts-editor-actions">
                    <button class="prts-editor-btn" id="prts-editor-branch">Branch</button>
                    <button class="prts-editor-btn" id="prts-editor-rewind">Rewind</button>
                    <button class="prts-editor-btn" id="prts-editor-bookmark">Bookmark</button>
                </div>
            </div>

            <!-- Auto-Progress Bar (always visible) -->
            <div class="prts-autoprogress">
                <button class="prts-auto-btn" id="prts-auto-wait">Wait</button>
                <button class="prts-auto-btn" id="prts-auto-continue">Continue</button>
                <button class="prts-auto-btn" id="prts-auto-skip">Skip</button>
            </div>
        </div>
    </div>

    <!-- Status Bar -->
    <div class="prts-status-bar">
        <div class="prts-status-item">
            <div class="prts-status-dot idle" id="prts-status-dot"></div>
            <span id="prts-status-text">IDLE</span>
        </div>
        <span id="prts-status-mode">MODE: ${state.mode.toUpperCase()}</span>
        <span id="prts-status-vibe">VIBE: ${state.vibe.toUpperCase()}</span>
        <span id="prts-status-scene">SCENES: ${state.sceneBlocks.length}</span>
    </div>
</div>`;
}

// ═══════════════════════════════════════════════════════════
//  UI — RENDER & UPDATE
// ═══════════════════════════════════════════════════════════

function injectUI() {
    const existing = document.getElementById('prts-engine');
    if (existing) existing.remove();

    const sheld = document.getElementById('sheld');
    if (!sheld) {
        console.error('[PRTS] Cannot find #sheld container');
        return;
    }
    sheld.insertAdjacentHTML('beforeend', buildHTML());

    if (!document.getElementById('prts-toggle-btn')) {
        const topBar = document.getElementById('top-bar');
        if (topBar) {
            const btn = document.createElement('button');
            btn.id = 'prts-toggle-btn';
            btn.innerHTML = '◈ PRTS';
            btn.title = 'Toggle PRTS Narrative Engine';
            topBar.appendChild(btn);
        }
    }

    bindEvents();
    updateUI();
}

function updateUI() {
    const engine = document.getElementById('prts-engine');
    if (!engine) return;

    engine.classList.toggle('hidden', !state.active);

    const toggleBtn = document.getElementById('prts-toggle-btn');
    if (toggleBtn) toggleBtn.classList.toggle('active', state.active);

    const chatBlock = document.getElementById('chat');
    const sendForm = document.getElementById('send_form');
    if (chatBlock) chatBlock.style.display = state.active ? 'none' : '';
    if (sendForm) sendForm.style.display = state.active ? 'none' : '';

    if (!state.active) return;

    // Mode indicator
    const modeInd = document.getElementById('prts-mode-indicator');
    if (modeInd) {
        modeInd.dataset.mode = state.mode;
        modeInd.textContent = state.mode.toUpperCase();
    }

    // Mode panels
    engine.querySelectorAll('.prts-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === state.mode);
    });
    engine.querySelectorAll('.prts-mode-panel').forEach(panel => {
        panel.classList.toggle('active', panel.dataset.mode === state.mode);
    });

    // Vibe chips
    engine.querySelectorAll('.prts-vibe-chip').forEach(chip => {
        chip.classList.toggle('active', chip.dataset.vibe === state.vibe);
    });

    // Generation overlay
    const overlay = document.getElementById('prts-gen-overlay');
    if (overlay) overlay.classList.toggle('active', state.generating);

    // Commit buttons disabled during generation
    const actorCommit = document.getElementById('prts-actor-commit');
    const directorCommit = document.getElementById('prts-director-commit');
    if (actorCommit) {
        actorCommit.disabled = state.generating;
        actorCommit.classList.toggle('generating', state.generating);
    }
    if (directorCommit) directorCommit.disabled = state.generating;

    // Status bar
    const dot = document.getElementById('prts-status-dot');
    const statusText = document.getElementById('prts-status-text');
    if (dot) {
        dot.className = `prts-status-dot ${state.generating ? 'generating' : 'idle'}`;
    }
    if (statusText) statusText.textContent = state.generating ? 'GENERATING' : 'IDLE';

    const modeStatus = document.getElementById('prts-status-mode');
    const vibeStatus = document.getElementById('prts-status-vibe');
    const sceneStatus = document.getElementById('prts-status-scene');
    if (modeStatus) modeStatus.textContent = `MODE: ${state.mode.toUpperCase()}`;
    if (vibeStatus) vibeStatus.textContent = `VIBE: ${state.vibe.toUpperCase()}`;
    if (sceneStatus) sceneStatus.textContent = `SCENES: ${state.sceneBlocks.length}`;

    renderSceneBlocks();
    renderPerceptionCards();
    renderDeductionCards();
    renderTimeline();
    renderHistory();
    renderInventory();
}

function renderSceneBlocks() {
    const container = document.getElementById('prts-scene-container');
    if (!container) return;

    container.innerHTML = state.sceneBlocks.map((block, i) => {
        const sourceLabel = block.source ? block.source.replace(/_/g, ' ').toUpperCase() : '';
        return `
            <div class="prts-scene-block" style="animation-delay: ${i * 0.05}s">
                ${sourceLabel ? `<span class="scene-label">${escapeHtml(sourceLabel)}</span>` : ''}
                ${formatNarrative(block.text)}
            </div>
            ${i < state.sceneBlocks.length - 1 ? '<div class="prts-scene-divider">◆</div>' : ''}
        `;
    }).join('');

    if (state.generating) {
        const lastBlock = container.querySelector('.prts-scene-block:last-child');
        if (lastBlock) {
            lastBlock.insertAdjacentHTML('beforeend', '<span class="prts-cursor"></span>');
        }
    }

    const scroll = document.getElementById('prts-story-scroll');
    if (scroll) scroll.scrollTop = scroll.scrollHeight;
}

function renderPerceptionCards() {
    const stack = document.getElementById('prts-perception-stack');
    if (!stack) return;

    stack.innerHTML = state.perceptionCards.map(card => `
        <div class="prts-card perception" data-id="${card.id}">
            <span class="card-type">Perception</span>
            <button class="card-close" data-card-type="perception" data-card-id="${card.id}">×</button>
            ${escapeHtml(card.text)}
        </div>
    `).join('');
}

function renderDeductionCards() {
    const stack = document.getElementById('prts-deduction-stack');
    if (!stack) return;

    stack.innerHTML = state.deductionCards.map(card => `
        <div class="prts-card deduction" data-id="${card.id}">
            <span class="card-type">Deduction</span>
            <button class="card-close" data-card-type="deduction" data-card-id="${card.id}">×</button>
            ${escapeHtml(card.text)}
        </div>
    `).join('');
}

function renderTimeline() {
    const viewport = document.getElementById('prts-timeline-viewport');
    if (!viewport) return;

    viewport.innerHTML = state.timeline.map((node, i) => `
        <div class="prts-timeline-node${i === state.timelineIndex ? ' active' : ''}" data-index="${i}">
            <div class="node-label">${escapeHtml(node.type.replace(/_/g, ' '))}</div>
            <div class="node-desc">${escapeHtml(node.desc)}</div>
        </div>
    `).join('');

    const activeNode = viewport.querySelector('.prts-timeline-node.active');
    if (activeNode) activeNode.scrollIntoView({ behavior: 'smooth', inline: 'center' });
}

function renderHistory() {
    const list = document.getElementById('prts-history-list');
    if (!list) return;

    const entries = [...state.historyLog].reverse().slice(0, 50);
    list.innerHTML = entries.map(entry => `
        <div class="prts-history-entry">
            <span class="entry-time">${formatTime(entry.timestamp)} [${entry.type}]</span>
            <span class="entry-text">${escapeHtml(entry.text)}</span>
        </div>
    `).join('');
}

function renderInventory() {
    const list = document.getElementById('prts-inventory-list');
    if (!list) return;

    if (state.inventory.length === 0) {
        list.innerHTML = '<div style="color: var(--prts-text-dim); font-size: 11px; padding: 8px;">No items yet</div>';
        return;
    }

    list.innerHTML = state.inventory.map(item => `
        <div class="prts-inventory-item">
            <div class="item-icon">${escapeHtml(item.icon || '?')}</div>
            <span class="item-name">${escapeHtml(item.name)}</span>
            <span class="item-qty">${item.qty || ''}</span>
        </div>
    `).join('');
}

// ═══════════════════════════════════════════════════════════
//  UI — EVENT BINDINGS
//  All action buttons call executeBinding() → STscript.
//  Mode/vibe/tab switches are pure local state changes.
// ═══════════════════════════════════════════════════════════

function bindEvents() {
    const engine = document.getElementById('prts-engine');
    if (!engine) return;

    // Toggle button
    const toggleBtn = document.getElementById('prts-toggle-btn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            state.active = !state.active;
            saveState();
            updateUI();
        });
    }

    // Console toggle
    const consoleToggle = document.getElementById('prts-console-toggle');
    if (consoleToggle) {
        consoleToggle.addEventListener('click', () => {
            const wrapper = document.getElementById('prts-console-wrapper');
            if (wrapper) wrapper.classList.toggle('expanded');
        });
    }

    // Mode switcher (pure local)
    engine.querySelectorAll('.prts-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });

    // Vibe chips (pure local)
    engine.querySelectorAll('.prts-vibe-chip').forEach(chip => {
        chip.addEventListener('click', () => setVibe(chip.dataset.vibe));
    });

    // Side panel tabs (pure local)
    engine.querySelectorAll('.prts-side-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            engine.querySelectorAll('.prts-side-tab').forEach(t => t.classList.remove('active'));
            engine.querySelectorAll('.prts-side-section').forEach(s => s.classList.remove('active'));
            tab.classList.add('active');
            const section = engine.querySelector(`.prts-side-section[data-panel="${tab.dataset.panel}"]`);
            if (section) section.classList.add('active');
        });
    });

    // ── All action buttons → executeBinding (STscript) ──
    const boundButtons = [
        'prts-actor-commit',
        'prts-director-commit',
        'prts-add-perception',
        'prts-add-deduction',
        'prts-auto-wait',
        'prts-auto-continue',
        'prts-auto-skip',
        'prts-editor-branch',
        'prts-editor-rewind',
        'prts-editor-bookmark',
        'prts-gen-stop',
    ];

    for (const id of boundButtons) {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', () => executeBinding(id));
        }
    }

    // Card close buttons (delegated — pure local state removal)
    engine.addEventListener('click', (e) => {
        const closeBtn = e.target.closest('.card-close');
        if (closeBtn) {
            removeCard(closeBtn.dataset.cardType, Number(closeBtn.dataset.cardId));
        }
    });

    // Timeline node click (pure local)
    engine.addEventListener('click', (e) => {
        const node = e.target.closest('.prts-timeline-node');
        if (node) {
            const index = Number(node.dataset.index);
            if (!isNaN(index) && index >= 0 && index < state.timeline.length) {
                state.timelineIndex = index;
                saveState();
                updateUI();
            }
        }
    });

    // Keyboard shortcut: Enter in hub input = actor commit
    const hubInput = document.getElementById('prts-hub-input');
    if (hubInput) {
        hubInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                executeBinding('prts-actor-commit');
            }
        });
    }
}

// ═══════════════════════════════════════════════════════════
//  STREAMING DISPLAY
//  External pipelines call /prts-stream to drive the live
//  text display in the story canvas.
//  Also hooks into SillyTavern's native stream events.
// ═══════════════════════════════════════════════════════════

let streamBuffer = '';

function streamStart() {
    streamBuffer = '';
    state.generating = true;
    saveState();
    updateUI();
}

function streamAppend(token) {
    streamBuffer += token;

    const container = document.getElementById('prts-scene-container');
    if (!container) return;

    let liveBlock = container.querySelector('.prts-live-block');
    if (!liveBlock) {
        liveBlock = document.createElement('div');
        liveBlock.className = 'prts-scene-block prts-live-block';
        container.appendChild(liveBlock);
    }
    liveBlock.innerHTML = formatNarrative(streamBuffer) + '<span class="prts-cursor"></span>';

    const scroll = document.getElementById('prts-story-scroll');
    if (scroll) scroll.scrollTop = scroll.scrollHeight;
}

function streamCommit(source) {
    if (streamBuffer) {
        appendSceneBlock(streamBuffer, source || 'stream');
        addTimelineNode(source || 'stream', streamBuffer.substring(0, 60));
        addHistoryEntry(source || 'stream', streamBuffer.substring(0, 120));
    }
    streamEnd();
}

function streamCancel() {
    streamEnd();
}

function streamEnd() {
    const container = document.getElementById('prts-scene-container');
    if (container) {
        const liveBlock = container.querySelector('.prts-live-block');
        if (liveBlock) liveBlock.remove();
    }
    streamBuffer = '';
    state.generating = false;
    saveState();
    updateUI();
}

// Native SillyTavern stream event hooks
function onStreamToken(data) {
    if (!state.active || !state.generating) return;
    const token = typeof data === 'string' ? data : (data?.text || '');
    if (token) streamAppend(token);
}

function onStreamEnd() {
    if (!state.active) return;
    // Only clean up the live block; state.generating is managed by /prts-stream
    const container = document.getElementById('prts-scene-container');
    if (container) {
        const liveBlock = container.querySelector('.prts-live-block');
        if (liveBlock) liveBlock.remove();
    }
    streamBuffer = '';
}

// ═══════════════════════════════════════════════════════════
//  SLASH COMMANDS — Pure state read/write + display
// ═══════════════════════════════════════════════════════════

function registerCommands() {

    // ── /prts — Toggle on/off ──
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'prts',
        callback: async (args) => {
            const action = args.action || 'toggle';
            if (action === 'on') state.active = true;
            else if (action === 'off') state.active = false;
            else state.active = !state.active;
            saveState();
            updateUI();
            return state.active ? 'PRTS activated' : 'PRTS deactivated';
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'action',
                description: 'on/off/toggle (default: toggle)',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                defaultValue: 'toggle',
            }),
        ],
        helpString: 'Toggle PRTS Narrative Engine on/off. <code>/prts action=on</code>',
        returns: ARGUMENT_TYPE.STRING,
    }));

    // ── /prts-mode — Switch mode ──
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'prts-mode',
        callback: async (args) => {
            const mode = args.mode || MODES.ACTOR;
            setMode(mode);
            return `Mode: ${state.mode}`;
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'mode',
                description: 'actor/director/editor',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
            }),
        ],
        helpString: 'Switch PRTS mode. <code>/prts-mode mode=director</code>',
        returns: ARGUMENT_TYPE.STRING,
    }));

    // ── /prts-vibe — Set emotional tone ──
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'prts-vibe',
        callback: async (args) => {
            setVibe(args.vibe || 'tense');
            return `Vibe: ${state.vibe}`;
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'vibe',
                description: `One of: ${VIBES.join(', ')}`,
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
            }),
        ],
        helpString: `Set PRTS emotional tone. <code>/prts-vibe vibe=calm</code>`,
        returns: ARGUMENT_TYPE.STRING,
    }));

    // ── /prts-display — Push text into story canvas ──
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'prts-display',
        callback: async (args, value) => {
            const text = value || '';
            if (!text) return '';
            const source = args.source || 'display';
            appendSceneBlock(text, source);
            addTimelineNode(source, text.substring(0, 60));
            addHistoryEntry(source, text.substring(0, 120));
            saveState();
            updateUI();
            return text;
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'source',
                description: 'Source label for the scene block (default: display)',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                defaultValue: 'display',
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'The text to display in the story canvas',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
            }),
        ],
        helpString: 'Push text into the PRTS story canvas. <code>/prts-display source=narrator The room goes dark.</code>',
        returns: ARGUMENT_TYPE.STRING,
    }));

    // ── /prts-card — Manage perception & deduction cards ──
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'prts-card',
        callback: async (args, value) => {
            const action = args.action || 'add';
            const type = args.type || 'perception';

            if (action === 'add' && value) {
                if (type === 'perception') addPerceptionCard(value);
                else if (type === 'deduction') addDeductionCard(value);
                else return `Unknown card type: ${type}`;
                saveState();
                updateUI();
                return value;
            }
            if (action === 'remove') {
                const id = Number(args.id || 0);
                if (id) {
                    removeCard(type, id);
                    return `Removed ${type} card ${id}`;
                }
                return 'Error: id= required for remove';
            }
            if (action === 'clear') {
                if (type === 'perception') state.perceptionCards = [];
                else if (type === 'deduction') state.deductionCards = [];
                else { state.perceptionCards = []; state.deductionCards = []; }
                saveState();
                updateUI();
                return `Cleared ${type} cards`;
            }
            if (action === 'list') {
                const cards = type === 'perception' ? state.perceptionCards
                    : type === 'deduction' ? state.deductionCards
                        : [...state.perceptionCards, ...state.deductionCards];
                return JSON.stringify(cards);
            }
            return 'Usage: /prts-card action=add type=perception A strange noise...';
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'action',
                description: 'add/remove/clear/list',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                defaultValue: 'add',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'type',
                description: 'perception/deduction/all',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                defaultValue: 'perception',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'id',
                description: 'Card ID (for remove)',
                typeList: [ARGUMENT_TYPE.NUMBER],
                isRequired: false,
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Card text (for add)',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
        ],
        helpString: 'Manage perception/deduction cards. <code>/prts-card action=add type=deduction The guard is bluffing</code>',
        returns: ARGUMENT_TYPE.STRING,
    }));

    // ── /prts-state — Get/set arbitrary state fields ──
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'prts-state',
        callback: async (args, value) => {
            const action = args.action || 'get';
            const key = args.key || '';

            if (action === 'get') {
                if (!key) return JSON.stringify({
                    active: state.active,
                    mode: state.mode,
                    vibe: state.vibe,
                    generating: state.generating,
                    sceneCount: state.sceneBlocks.length,
                    timelineLength: state.timeline.length,
                    timelineIndex: state.timelineIndex,
                    perceptionCount: state.perceptionCards.length,
                    deductionCount: state.deductionCards.length,
                    inventoryCount: state.inventory.length,
                });
                if (key in state) {
                    const val = state[key];
                    return typeof val === 'object' ? JSON.stringify(val) : String(val);
                }
                return '';
            }

            if (action === 'set' && key) {
                // Only allow setting safe scalar fields
                const safeKeys = ['vibe', 'mode', 'active', 'generating', 'currentScene'];
                if (safeKeys.includes(key)) {
                    if (key === 'active' || key === 'generating') {
                        state[key] = value === 'true' || value === '1';
                    } else {
                        state[key] = value || '';
                    }
                    saveState();
                    updateUI();
                    return String(state[key]);
                }
                return `Error: cannot set "${key}" — use dedicated commands for complex fields`;
            }

            if (action === 'dump') {
                return JSON.stringify(state);
            }

            return 'Usage: /prts-state action=get key=vibe';
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'action',
                description: 'get/set/dump',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                defaultValue: 'get',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'key',
                description: 'State field name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Value to set',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
        ],
        helpString: 'Read/write PRTS state. <code>/prts-state action=get key=vibe</code> or <code>/prts-state action=set key=vibe calm</code>',
        returns: ARGUMENT_TYPE.STRING,
    }));

    // ── /prts-timeline — Manage timeline nodes ──
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'prts-timeline',
        callback: async (args) => {
            const action = args.action || 'list';

            if (action === 'add') {
                const type = args.type || 'node';
                const desc = args.desc || `Node ${state.timeline.length + 1}`;
                addTimelineNode(type, desc);
                saveState();
                updateUI();
                return `Timeline node added: [${type}] ${desc}`;
            }
            if (action === 'jump') {
                const index = Number(args.index);
                if (!isNaN(index) && index >= 0 && index < state.timeline.length) {
                    state.timelineIndex = index;
                    saveState();
                    updateUI();
                    return `Jumped to timeline index ${index}`;
                }
                return 'Error: invalid index';
            }
            if (action === 'back') {
                if (state.timelineIndex > 0) {
                    state.timelineIndex--;
                    saveState();
                    updateUI();
                    return `Rewound to timeline index ${state.timelineIndex}`;
                }
                return 'Already at the beginning';
            }
            if (action === 'forward') {
                if (state.timelineIndex < state.timeline.length - 1) {
                    state.timelineIndex++;
                    saveState();
                    updateUI();
                    return `Advanced to timeline index ${state.timelineIndex}`;
                }
                return 'Already at the end';
            }
            if (action === 'clear') {
                state.timeline = [];
                state.timelineIndex = -1;
                saveState();
                updateUI();
                return 'Timeline cleared';
            }
            if (action === 'list') {
                return JSON.stringify(state.timeline);
            }

            return 'Usage: /prts-timeline action=add type=branch desc="..."';
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'action',
                description: 'add/jump/back/forward/clear/list',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                defaultValue: 'list',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'type',
                description: 'Node type label (for add)',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                defaultValue: 'node',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'desc',
                description: 'Node description (for add)',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'index',
                description: 'Target index (for jump)',
                typeList: [ARGUMENT_TYPE.NUMBER],
                isRequired: false,
            }),
        ],
        helpString: 'Manage the PRTS timeline. <code>/prts-timeline action=add type=branch desc="Alt path"</code>',
        returns: ARGUMENT_TYPE.STRING,
    }));

    // ── /prts-scene — Manage scene blocks ──
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'prts-scene',
        callback: async (args, value) => {
            const action = args.action || 'list';

            if (action === 'set' && value) {
                const source = args.source || 'manual';
                appendSceneBlock(value, source);
                addTimelineNode(source, value.substring(0, 60));
                saveState();
                updateUI();
                return value;
            }
            if (action === 'clear') {
                state.sceneBlocks = [];
                state.currentScene = '';
                saveState();
                updateUI();
                return 'Scene cleared';
            }
            if (action === 'list') {
                return JSON.stringify(state.sceneBlocks);
            }
            if (action === 'current') {
                return state.currentScene || '';
            }
            if (action === 'context') {
                // Return last N scene blocks as plain text (for prompt building)
                const n = Number(args.count) || 3;
                return state.sceneBlocks.slice(-n).map(b => b.text).join('\n\n');
            }

            return 'Usage: /prts-scene action=set A dark corridor...';
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'action',
                description: 'set/clear/list/current/context',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                defaultValue: 'list',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'source',
                description: 'Source label (for set)',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                defaultValue: 'manual',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'count',
                description: 'Number of recent blocks (for context)',
                typeList: [ARGUMENT_TYPE.NUMBER],
                isRequired: false,
                defaultValue: '3',
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Scene text (for set)',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
        ],
        helpString: 'Manage PRTS scenes. <code>/prts-scene action=set source=narrator The wind howls.</code> or <code>/prts-scene action=context count=5</code>',
        returns: ARGUMENT_TYPE.STRING,
    }));

    // ── /prts-history — Manage history log ──
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'prts-history',
        callback: async (args, value) => {
            const action = args.action || 'list';

            if (action === 'add' && value) {
                const type = args.type || 'note';
                addHistoryEntry(type, value);
                saveState();
                updateUI();
                return value;
            }
            if (action === 'clear') {
                state.historyLog = [];
                saveState();
                updateUI();
                return 'History cleared';
            }
            if (action === 'list') {
                const n = Number(args.count) || 20;
                return JSON.stringify(state.historyLog.slice(-n));
            }

            return 'Usage: /prts-history action=add type=event Something happened';
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'action',
                description: 'add/clear/list',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                defaultValue: 'list',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'type',
                description: 'Entry type label (for add)',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                defaultValue: 'note',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'count',
                description: 'Number of recent entries (for list)',
                typeList: [ARGUMENT_TYPE.NUMBER],
                isRequired: false,
                defaultValue: '20',
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Entry text (for add)',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
        ],
        helpString: 'Manage PRTS history log. <code>/prts-history action=add type=combat The enemy attacks!</code>',
        returns: ARGUMENT_TYPE.STRING,
    }));

    // ── /prts-inventory — Manage inventory items ──
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'prts-inventory',
        callback: async (args, value) => {
            const action = args.action || 'add';
            if (action === 'add' && value) {
                state.inventory.push({
                    name: value,
                    icon: args.icon || '?',
                    qty: args.qty || '',
                });
                saveState();
                updateUI();
                return `Added: ${value}`;
            }
            if (action === 'remove' && value) {
                const idx = state.inventory.findIndex(i => i.name === value);
                if (idx >= 0) {
                    state.inventory.splice(idx, 1);
                    saveState();
                    updateUI();
                    return `Removed: ${value}`;
                }
                return `Not found: ${value}`;
            }
            if (action === 'clear') {
                state.inventory = [];
                saveState();
                updateUI();
                return 'Inventory cleared';
            }
            if (action === 'list') {
                return JSON.stringify(state.inventory);
            }
            return 'Usage: /prts-inventory action=add My Item';
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'action',
                description: 'add/remove/clear/list',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                defaultValue: 'add',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'icon',
                description: 'Icon character for the item',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                defaultValue: '?',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'qty',
                description: 'Quantity string',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Item name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
        ],
        helpString: 'Manage PRTS inventory. <code>/prts-inventory action=add icon=⚔ qty=1 Magic Sword</code>',
        returns: ARGUMENT_TYPE.STRING,
    }));

    // ── /prts-stream — Control live streaming display ──
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'prts-stream',
        callback: async (args, value) => {
            const action = args.action || 'append';

            if (action === 'start') {
                streamStart();
                return 'Stream started';
            }
            if (action === 'append' && value) {
                streamAppend(value);
                return value;
            }
            if (action === 'commit') {
                const source = args.source || 'stream';
                streamCommit(source);
                return 'Stream committed';
            }
            if (action === 'cancel') {
                streamCancel();
                return 'Stream cancelled';
            }
            if (action === 'end') {
                streamEnd();
                return 'Stream ended';
            }
            if (action === 'buffer') {
                return streamBuffer;
            }

            return 'Usage: /prts-stream action=start';
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'action',
                description: 'start/append/commit/cancel/end/buffer',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                defaultValue: 'append',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'source',
                description: 'Source label (for commit)',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                defaultValue: 'stream',
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Token text (for append)',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
        ],
        helpString: 'Control PRTS live stream display. <code>/prts-stream action=start</code> then <code>/prts-stream Some text</code> then <code>/prts-stream action=commit</code>',
        returns: ARGUMENT_TYPE.STRING,
    }));

    // ── /prts-bind — Configure button → STscript bindings ──
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'prts-bind',
        callback: async (args, value) => {
            const action = args.action || 'get';
            const button = args.button || '';

            if (action === 'set' && button && value) {
                state.bindings[button] = value;
                saveState();
                return `Bound ${button} → ${value}`;
            }
            if (action === 'get') {
                if (button) {
                    return getBinding(button);
                }
                // Return all effective bindings
                const all = {};
                for (const key of Object.keys(DEFAULT_BINDINGS)) {
                    all[key] = getBinding(key);
                }
                return JSON.stringify(all, null, 2);
            }
            if (action === 'reset') {
                if (button) {
                    delete state.bindings[button];
                } else {
                    state.bindings = {};
                }
                saveState();
                return button ? `Reset binding for ${button}` : 'All bindings reset to defaults';
            }
            if (action === 'list') {
                return JSON.stringify(Object.keys(DEFAULT_BINDINGS));
            }

            return 'Usage: /prts-bind action=set button=prts-actor-commit /my-custom-pipeline {{prtsInput}}';
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'action',
                description: 'get/set/reset/list',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                defaultValue: 'get',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'button',
                description: 'Button ID to bind',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'STscript to execute when button is clicked (for set)',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
        ],
        helpString: 'Configure PRTS button bindings. <code>/prts-bind action=set button=prts-actor-commit /my-pipeline {{prtsInput}}</code>',
        returns: ARGUMENT_TYPE.STRING,
    }));

    // ── Legacy compatibility commands (thin wrappers) ──

    // /prts-commit — convenience alias, calls display
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'prts-commit',
        callback: async (args, value) => {
            const text = value || args.action || '';
            addHistoryEntry('actor_commit', text.substring(0, 120) || '(observe)');
            saveState();
            updateUI();
            return text;
        },
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'The action text',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
        ],
        helpString: 'Log an actor commit action. <code>/prts-commit I search the room</code>',
        returns: ARGUMENT_TYPE.STRING,
    }));

    // /prts-override — convenience alias
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'prts-override',
        callback: async (args, value) => {
            const text = value || args.event || '';
            if (!text) return 'Error: No override text provided';
            addHistoryEntry('director_override', text.substring(0, 120));
            saveState();
            updateUI();
            return text;
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'event',
                description: 'The forced narrative event',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Override text',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
        ],
        helpString: 'Log a director override event. <code>/prts-override A sudden earthquake!</code>',
        returns: ARGUMENT_TYPE.STRING,
    }));

    // /prts-perception — add or list perception cards
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'prts-perception',
        callback: async (args, value) => {
            if (value) {
                addPerceptionCard(value);
                saveState();
                updateUI();
                return value;
            }
            return JSON.stringify(state.perceptionCards);
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'focus',
                description: 'Focus hint (passed through, not used internally)',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Perception text to add',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
        ],
        helpString: 'Add a perception card or list all. <code>/prts-perception The air smells like rust</code>',
        returns: ARGUMENT_TYPE.STRING,
    }));

    // /prts-deduction — add or list deduction cards
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'prts-deduction',
        callback: async (args, value) => {
            if (value) {
                addDeductionCard(value);
                saveState();
                updateUI();
                return value;
            }
            return JSON.stringify(state.deductionCards);
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'focus',
                description: 'Reasoning focus hint (passed through, not used internally)',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Deduction text to add',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
        ],
        helpString: 'Add a deduction card or list all. <code>/prts-deduction The guard is bluffing</code>',
        returns: ARGUMENT_TYPE.STRING,
    }));

    // /prts-auto — convenience log for auto-progress
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'prts-auto',
        callback: async (args) => {
            const type = args.type || 'continue';
            addHistoryEntry(`auto_${type}`, `Auto-progress: ${type}`);
            saveState();
            updateUI();
            return type;
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'type',
                description: 'wait/continue/skip',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                defaultValue: 'continue',
            }),
        ],
        helpString: 'Log an auto-progress event. <code>/prts-auto type=skip</code>',
        returns: ARGUMENT_TYPE.STRING,
    }));

    // ── /prts-reset — Full state reset ──
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'prts-reset',
        callback: async () => {
            const wasActive = state.active;
            state = DEFAULT_STATE();
            state.active = wasActive;
            saveState();
            updateUI();
            return 'PRTS state reset';
        },
        helpString: 'Reset all PRTS state (scenes, cards, timeline, inventory, bindings).',
        returns: ARGUMENT_TYPE.STRING,
    }));
}

// ═══════════════════════════════════════════════════════════
//  UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
}

function formatNarrative(text) {
    if (!text) return '';
    return escapeHtml(text)
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        .replace(/&quot;(.*?)&quot;/g, '<span class="dialogue-speaker">"$1"</span>')
        .replace(/\[SCENE_STATE\](.*?)(?:\n|$)/gi, '<span class="scene-label">$1</span>')
        .replace(/\[SKIP SUMMARY\](.*?)(?:\n|$)/gi, '<span class="scene-label">SKIP: $1</span>');
}

function formatTime(isoStr) {
    if (!isoStr) return '';
    try {
        const d = new Date(isoStr);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
        return '';
    }
}

// ═══════════════════════════════════════════════════════════
//  INITIALIZATION
// ═══════════════════════════════════════════════════════════

jQuery(async () => {
    registerCommands();

    eventSource.on(event_types.CHAT_CHANGED, () => {
        loadState();
        injectUI();
    });

    eventSource.on(event_types.CHAT_LOADED, () => {
        loadState();
        injectUI();
    });

    // Native streaming hooks
    eventSource.on(event_types.STREAM_TOKEN_RECEIVED, onStreamToken);
    eventSource.on(event_types.GENERATION_ENDED, onStreamEnd);
    eventSource.on(event_types.GENERATION_STOPPED, onStreamEnd);

    // Initial injection if chat is already loaded
    const ctx = getContext();
    if (ctx.chatId) {
        loadState();
        injectUI();
    }

    console.log('[PRTS] Narrative Engine v2 loaded — pure UI shell. Use /prts to toggle.');
});
