/**
 * PRTS Narrative Engine — Generalized RP Operation Interface
 *
 * Architecture:
 * - UI is a shell; all content comes from AI generation dispatches
 * - Each user action (actor commit, director override, editor jump, auto-progress)
 *   packages a different generation task and sends it to the backend
 * - Streaming tokens are routed to the story canvas in real-time
 * - Slash commands registered for all operations (scriptable)
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

/** Generation task types — each maps to a different prompt packaging strategy */
const TASK_TYPE = {
    ACTOR_COMMIT: 'actor_commit',
    DIRECTOR_OVERRIDE: 'director_override',
    EDITOR_JUMP: 'editor_jump',
    AUTO_WAIT: 'auto_wait',
    AUTO_CONTINUE: 'auto_continue',
    AUTO_SKIP: 'auto_skip',
    PERCEPTION_GEN: 'perception_gen',
    DEDUCTION_GEN: 'deduction_gen',
    SCENE_INIT: 'scene_init',
};

const MODES = { ACTOR: 'actor', DIRECTOR: 'director', EDITOR: 'editor' };

const VIBES = ['tense', 'calm', 'melancholy', 'urgent', 'eerie', 'warm', 'chaotic', 'solemn'];

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
//  GENERATION DISPATCHER
//  Every UI action calls dispatchGeneration with a task config.
//  The dispatcher builds a prompt, calls generateQuietPrompt/generateRaw,
//  and streams results into the story canvas.
// ═══════════════════════════════════════════════════════════

/**
 * Build a structured prompt for the given task type.
 * This is the core "packaging" function — different tasks produce different prompts.
 * @param {string} taskType
 * @param {object} payload
 * @returns {string}
 */
function buildTaskPrompt(taskType, payload = {}) {
    const ctx = getContext();
    const charName = ctx.name2 || 'Character';
    const userName = ctx.name1 || 'User';
    const vibeStr = state.vibe ? `[Emotional Tone: ${state.vibe}]` : '';
    const sceneContext = state.sceneBlocks.slice(-3).map(b => b.text).join('\n');

    const perceptionBlock = state.perceptionCards.length > 0
        ? `[Perceptions]\n${state.perceptionCards.map((c, i) => `${i + 1}. ${c.text}`).join('\n')}`
        : '';

    const deductionBlock = state.deductionCards.length > 0
        ? `[Deductions]\n${state.deductionCards.map((c, i) => `${i + 1}. ${c.text}`).join('\n')}`
        : '';

    const header = `[PRTS NARRATIVE ENGINE — TASK: ${taskType.toUpperCase()}]`;

    switch (taskType) {
        case TASK_TYPE.ACTOR_COMMIT:
            return [
                header,
                vibeStr,
                `[Scene Context]\n${sceneContext || '(opening scene)'}`,
                perceptionBlock,
                deductionBlock,
                `[${userName}'s Action]\n${payload.action || '(observes)'}`,
                '',
                `Continue the narrative from ${charName}'s perspective and the world's response.`,
                'Write in vivid prose. Include dialogue, internal states, and environmental changes.',
                'Format: Start with a brief SCENE_STATE tag line, then the narrative.',
            ].filter(Boolean).join('\n');

        case TASK_TYPE.DIRECTOR_OVERRIDE:
            return [
                header,
                vibeStr,
                `[Scene Context]\n${sceneContext || '(opening scene)'}`,
                `[DIRECTOR INTERVENTION]\n${payload.override || '(no directive)'}`,
                '',
                'A narrative authority has intervened. The world must respond to this forced event.',
                `Write the consequences and scene transition as experienced by ${charName} and ${userName}.`,
                'Format: Start with a brief SCENE_STATE tag line, then the narrative.',
            ].filter(Boolean).join('\n');

        case TASK_TYPE.EDITOR_JUMP:
            return [
                header,
                vibeStr,
                `[Timeline Jump Target]\n${payload.nodeDesc || '(unknown point)'}`,
                `[Previous Scene Context]\n${sceneContext || '(none)'}`,
                '',
                `Time has shifted. Reconstruct the scene at this point in the timeline.`,
                `Write an establishing scene for ${charName} and ${userName} at this moment.`,
                'Format: Start with a brief SCENE_STATE tag line, then the narrative.',
            ].filter(Boolean).join('\n');

        case TASK_TYPE.AUTO_WAIT:
            return [
                header,
                vibeStr,
                `[Scene Context]\n${sceneContext || '(opening scene)'}`,
                `[Action: ${userName} waits and observes]`,
                '',
                'The protagonist chooses inaction. Time passes. The situation evolves naturally.',
                'Show environmental changes, NPC behaviors, and escalating or de-escalating tension.',
                'Format: Start with a brief SCENE_STATE tag line, then the narrative.',
            ].filter(Boolean).join('\n');

        case TASK_TYPE.AUTO_CONTINUE:
            return [
                header,
                vibeStr,
                `[Scene Context]\n${sceneContext || '(opening scene)'}`,
                '',
                'Continue the narrative naturally from where it left off.',
                'Advance the plot, introduce new developments, and maintain pacing.',
                'Format: Start with a brief SCENE_STATE tag line, then the narrative.',
            ].filter(Boolean).join('\n');

        case TASK_TYPE.AUTO_SKIP:
            return [
                header,
                vibeStr,
                `[Scene Context]\n${sceneContext || '(opening scene)'}`,
                '',
                'Fast-forward past the current scene. Provide a brief transition summary,',
                'then establish the next significant scene.',
                'Format: [SKIP SUMMARY] one paragraph, then SCENE_STATE tag and new scene narrative.',
            ].filter(Boolean).join('\n');

        case TASK_TYPE.PERCEPTION_GEN:
            return [
                header,
                `[Scene Context]\n${sceneContext || '(opening scene)'}`,
                `[Focus: ${payload.focus || 'general awareness'}]`,
                '',
                `Generate a single sensory perception for ${userName} in this scene.`,
                'Be vivid, specific, and tactical. One short paragraph only.',
                'Do NOT continue the narrative — just the perception.',
            ].filter(Boolean).join('\n');

        case TASK_TYPE.DEDUCTION_GEN:
            return [
                header,
                `[Scene Context]\n${sceneContext || '(opening scene)'}`,
                perceptionBlock,
                `[Reasoning Focus: ${payload.focus || 'analyze the situation'}]`,
                '',
                `Generate a single tactical deduction for ${userName} based on available perceptions.`,
                'Be analytical, strategic, and concise. One short paragraph only.',
                'Do NOT continue the narrative — just the deduction.',
            ].filter(Boolean).join('\n');

        case TASK_TYPE.SCENE_INIT:
            return [
                header,
                vibeStr,
                '',
                `Initialize the opening scene for a narrative involving ${charName} and ${userName}.`,
                'Set the stage: environment, atmosphere, positions, tension level.',
                'Format: Start with a brief SCENE_STATE tag line, then the narrative.',
            ].filter(Boolean).join('\n');

        default:
            return `[PRTS] Unknown task type: ${taskType}. ${payload.fallback || ''}`;
    }
}

/**
 * Dispatch a generation task. This is the single entry point for all generation.
 * @param {string} taskType - One of TASK_TYPE values
 * @param {object} payload - Task-specific parameters
 * @returns {Promise<string>} The generated text
 */
async function dispatchGeneration(taskType, payload = {}) {
    if (state.generating) {
        console.warn('[PRTS] Generation already in progress');
        return '';
    }

    const ctx = getContext();
    state.generating = true;
    saveState();
    updateUI();

    try {
        const prompt = buildTaskPrompt(taskType, payload);

        // Use generateQuietPrompt — runs generation with full context but doesn't
        // insert a message into the chat. We manage display ourselves.
        const result = await ctx.generateQuietPrompt({
            quietPrompt: prompt,
            skipWIAN: false,
            quietToLoud: false,
            responseLength: payload.maxTokens || null,
        });

        if (result) {
            processGenerationResult(taskType, result, payload);
        }

        return result || '';
    } catch (err) {
        console.error('[PRTS] Generation error:', err);
        addHistoryEntry('error', `Generation failed: ${err.message || 'Unknown error'}`);
        return '';
    } finally {
        state.generating = false;
        saveState();
        updateUI();
    }
}

/**
 * Process the result of a generation task and route it to appropriate UI components.
 * @param {string} taskType
 * @param {string} text
 * @param {object} payload
 */
function processGenerationResult(taskType, text, payload = {}) {
    switch (taskType) {
        case TASK_TYPE.ACTOR_COMMIT:
        case TASK_TYPE.DIRECTOR_OVERRIDE:
        case TASK_TYPE.EDITOR_JUMP:
        case TASK_TYPE.AUTO_WAIT:
        case TASK_TYPE.AUTO_CONTINUE:
        case TASK_TYPE.AUTO_SKIP:
        case TASK_TYPE.SCENE_INIT:
            // These all produce narrative output → story canvas
            appendSceneBlock(text, taskType);
            addTimelineNode(taskType, text.substring(0, 60));
            addHistoryEntry(taskType, text.substring(0, 120));
            break;

        case TASK_TYPE.PERCEPTION_GEN:
            addPerceptionCard(text);
            addHistoryEntry('perception', text.substring(0, 80));
            break;

        case TASK_TYPE.DEDUCTION_GEN:
            addDeductionCard(text);
            addHistoryEntry('deduction', text.substring(0, 80));
            break;
    }

    saveState();
    updateUI();
}

// ═══════════════════════════════════════════════════════════
//  STATE MUTATION HELPERS
// ═══════════════════════════════════════════════════════════

function appendSceneBlock(text, source = '') {
    const block = {
        id: Date.now(),
        text: text,
        source: source,
        timestamp: new Date().toISOString(),
    };
    state.sceneBlocks.push(block);
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
    // Keep last 100 entries
    if (state.historyLog.length > 100) {
        state.historyLog = state.historyLog.slice(-100);
    }
}

function addPerceptionCard(text) {
    state.perceptionCards.push({
        id: Date.now(),
        text: text.trim(),
    });
}

function addDeductionCard(text) {
    state.deductionCards.push({
        id: Date.now(),
        text: text.trim(),
    });
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

/** Inject the full PRTS UI into the page */
function injectUI() {
    // Remove existing if present
    const existing = document.getElementById('prts-engine');
    if (existing) existing.remove();

    // Insert into #sheld (the main chat shell container)
    const sheld = document.getElementById('sheld');
    if (!sheld) {
        console.error('[PRTS] Cannot find #sheld container');
        return;
    }
    sheld.insertAdjacentHTML('beforeend', buildHTML());

    // Inject toggle button into top bar
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

/** Full UI update — called after every state change */
function updateUI() {
    const engine = document.getElementById('prts-engine');
    if (!engine) return;

    // Visibility
    engine.classList.toggle('hidden', !state.active);

    // Toggle button state
    const toggleBtn = document.getElementById('prts-toggle-btn');
    if (toggleBtn) toggleBtn.classList.toggle('active', state.active);

    // Hide/show standard SillyTavern chat UI
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

    // Render dynamic lists
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

    // Add cursor to last block if generating
    if (state.generating) {
        const lastBlock = container.querySelector('.prts-scene-block:last-child');
        if (lastBlock) {
            lastBlock.insertAdjacentHTML('beforeend', '<span class="prts-cursor"></span>');
        }
    }

    // Scroll to bottom
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

    // Scroll active node into view
    const activeNode = viewport.querySelector('.prts-timeline-node.active');
    if (activeNode) activeNode.scrollIntoView({ behavior: 'smooth', inline: 'center' });
}

function renderHistory() {
    const list = document.getElementById('prts-history-list');
    if (!list) return;

    // Show newest first
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

    // Mode switcher
    engine.querySelectorAll('.prts-mode-btn').forEach(btn => {
        btn.addEventListener('click', () => setMode(btn.dataset.mode));
    });

    // Vibe chips
    engine.querySelectorAll('.prts-vibe-chip').forEach(chip => {
        chip.addEventListener('click', () => setVibe(chip.dataset.vibe));
    });

    // Side panel tabs
    engine.querySelectorAll('.prts-side-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            engine.querySelectorAll('.prts-side-tab').forEach(t => t.classList.remove('active'));
            engine.querySelectorAll('.prts-side-section').forEach(s => s.classList.remove('active'));
            tab.classList.add('active');
            const section = engine.querySelector(`.prts-side-section[data-panel="${tab.dataset.panel}"]`);
            if (section) section.classList.add('active');
        });
    });

    // Actor commit
    const actorCommit = document.getElementById('prts-actor-commit');
    if (actorCommit) {
        actorCommit.addEventListener('click', () => {
            const input = document.getElementById('prts-hub-input');
            const action = input ? input.value.trim() : '';
            dispatchGeneration(TASK_TYPE.ACTOR_COMMIT, { action });
            if (input) input.value = '';
        });
    }

    // Director commit
    const directorCommit = document.getElementById('prts-director-commit');
    if (directorCommit) {
        directorCommit.addEventListener('click', () => {
            const input = document.getElementById('prts-director-input');
            const override = input ? input.value.trim() : '';
            if (!override) return;
            dispatchGeneration(TASK_TYPE.DIRECTOR_OVERRIDE, { override });
            if (input) input.value = '';
        });
    }

    // Card generation
    const addPerception = document.getElementById('prts-add-perception');
    if (addPerception) {
        addPerception.addEventListener('click', () => {
            dispatchGeneration(TASK_TYPE.PERCEPTION_GEN, { focus: 'general awareness' });
        });
    }

    const addDeduction = document.getElementById('prts-add-deduction');
    if (addDeduction) {
        addDeduction.addEventListener('click', () => {
            dispatchGeneration(TASK_TYPE.DEDUCTION_GEN, { focus: 'analyze the current situation' });
        });
    }

    // Card close buttons (delegated)
    engine.addEventListener('click', (e) => {
        const closeBtn = e.target.closest('.card-close');
        if (closeBtn) {
            removeCard(closeBtn.dataset.cardType, Number(closeBtn.dataset.cardId));
        }
    });

    // Timeline node click
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

    // Editor buttons
    const editorBranch = document.getElementById('prts-editor-branch');
    if (editorBranch) {
        editorBranch.addEventListener('click', () => {
            addTimelineNode('branch', `Branch from scene ${state.sceneBlocks.length}`);
            saveState();
            updateUI();
        });
    }

    const editorRewind = document.getElementById('prts-editor-rewind');
    if (editorRewind) {
        editorRewind.addEventListener('click', () => {
            if (state.timelineIndex > 0) {
                const targetNode = state.timeline[state.timelineIndex - 1];
                state.timelineIndex--;
                dispatchGeneration(TASK_TYPE.EDITOR_JUMP, {
                    nodeDesc: targetNode.desc,
                });
            }
        });
    }

    const editorBookmark = document.getElementById('prts-editor-bookmark');
    if (editorBookmark) {
        editorBookmark.addEventListener('click', () => {
            addTimelineNode('bookmark', `Bookmark at scene ${state.sceneBlocks.length}`);
            addHistoryEntry('bookmark', `Bookmarked scene ${state.sceneBlocks.length}`);
            saveState();
            updateUI();
        });
    }

    // Auto-progress buttons
    const autoWait = document.getElementById('prts-auto-wait');
    if (autoWait) {
        autoWait.addEventListener('click', () => dispatchGeneration(TASK_TYPE.AUTO_WAIT));
    }

    const autoContinue = document.getElementById('prts-auto-continue');
    if (autoContinue) {
        autoContinue.addEventListener('click', () => dispatchGeneration(TASK_TYPE.AUTO_CONTINUE));
    }

    const autoSkip = document.getElementById('prts-auto-skip');
    if (autoSkip) {
        autoSkip.addEventListener('click', () => dispatchGeneration(TASK_TYPE.AUTO_SKIP));
    }

    // Stop generation
    const genStop = document.getElementById('prts-gen-stop');
    if (genStop) {
        genStop.addEventListener('click', () => {
            const ctx = getContext();
            ctx.stopGeneration();
        });
    }

    // Keyboard shortcut: Enter in hub input = commit
    const hubInput = document.getElementById('prts-hub-input');
    if (hubInput) {
        hubInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                actorCommit?.click();
            }
        });
    }
}

// ═══════════════════════════════════════════════════════════
//  STREAMING TOKEN HOOK
//  When PRTS is active, intercept streaming tokens and
//  display them in the story canvas instead of the chat.
// ═══════════════════════════════════════════════════════════

let streamBuffer = '';

function onStreamToken(data) {
    if (!state.active || !state.generating) return;

    // data can be a string token or object with .text
    const token = typeof data === 'string' ? data : (data?.text || '');
    if (!token) return;

    streamBuffer += token;

    // Live-update the last scene block in the canvas
    const container = document.getElementById('prts-scene-container');
    if (!container) return;

    let liveBlock = container.querySelector('.prts-live-block');
    if (!liveBlock) {
        liveBlock = document.createElement('div');
        liveBlock.className = 'prts-scene-block prts-live-block';
        container.appendChild(liveBlock);
    }
    liveBlock.innerHTML = formatNarrative(streamBuffer) + '<span class="prts-cursor"></span>';

    // Auto-scroll
    const scroll = document.getElementById('prts-story-scroll');
    if (scroll) scroll.scrollTop = scroll.scrollHeight;
}

function onStreamEnd() {
    if (!state.active) return;

    // Clean up live block — the processGenerationResult will re-render
    const container = document.getElementById('prts-scene-container');
    if (container) {
        const liveBlock = container.querySelector('.prts-live-block');
        if (liveBlock) liveBlock.remove();
    }
    streamBuffer = '';
}

// ═══════════════════════════════════════════════════════════
//  SLASH COMMANDS (STscript interface)
// ═══════════════════════════════════════════════════════════

function registerCommands() {
    // /prts — Toggle PRTS engine on/off
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

    // /prts-mode — Switch mode
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

    // /prts-vibe — Set emotional tone
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

    // /prts-commit — Actor commit (trigger generation)
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'prts-commit',
        callback: async (args, value) => {
            const action = value || args.action || '';
            return await dispatchGeneration(TASK_TYPE.ACTOR_COMMIT, { action });
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'action',
                description: 'The action to commit',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'The action text to commit',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
        ],
        helpString: 'Commit an actor action. <code>/prts-commit I search the room carefully</code>',
        returns: ARGUMENT_TYPE.STRING,
    }));

    // /prts-override — Director override
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'prts-override',
        callback: async (args, value) => {
            const override = value || args.event || '';
            if (!override) return 'Error: No override text provided';
            return await dispatchGeneration(TASK_TYPE.DIRECTOR_OVERRIDE, { override });
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'event',
                description: 'The forced narrative event',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
        ],
        helpString: 'Force a narrative event (director mode). <code>/prts-override A sudden earthquake shakes the building</code>',
        returns: ARGUMENT_TYPE.STRING,
    }));

    // /prts-perception — Generate or add a perception card
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'prts-perception',
        callback: async (args, value) => {
            if (value) {
                // Manually add a perception card
                addPerceptionCard(value);
                saveState();
                updateUI();
                return value;
            }
            // Generate one
            const focus = args.focus || 'general awareness';
            return await dispatchGeneration(TASK_TYPE.PERCEPTION_GEN, { focus });
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'focus',
                description: 'Focus direction for generation',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                defaultValue: 'general awareness',
            }),
        ],
        helpString: 'Generate or add a perception card. <code>/prts-perception focus=sound</code> or <code>/prts-perception The air smells like rust</code>',
        returns: ARGUMENT_TYPE.STRING,
    }));

    // /prts-deduction — Generate or add a deduction card
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'prts-deduction',
        callback: async (args, value) => {
            if (value) {
                addDeductionCard(value);
                saveState();
                updateUI();
                return value;
            }
            const focus = args.focus || 'analyze the situation';
            return await dispatchGeneration(TASK_TYPE.DEDUCTION_GEN, { focus });
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'focus',
                description: 'Reasoning focus for generation',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                defaultValue: 'analyze the situation',
            }),
        ],
        helpString: 'Generate or add a deduction card. <code>/prts-deduction focus=escape routes</code>',
        returns: ARGUMENT_TYPE.STRING,
    }));

    // /prts-auto — Trigger auto-progress
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'prts-auto',
        callback: async (args) => {
            const type = args.type || 'continue';
            const taskMap = {
                'wait': TASK_TYPE.AUTO_WAIT,
                'continue': TASK_TYPE.AUTO_CONTINUE,
                'skip': TASK_TYPE.AUTO_SKIP,
            };
            const taskType = taskMap[type];
            if (!taskType) return `Error: Unknown auto type "${type}". Use wait/continue/skip.`;
            return await dispatchGeneration(taskType);
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
        helpString: 'Trigger auto-progress. <code>/prts-auto type=skip</code>',
        returns: ARGUMENT_TYPE.STRING,
    }));

    // /prts-inventory — Manage inventory items
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
            } else if (action === 'remove' && value) {
                const idx = state.inventory.findIndex(i => i.name === value);
                if (idx >= 0) {
                    state.inventory.splice(idx, 1);
                    saveState();
                    updateUI();
                    return `Removed: ${value}`;
                }
                return `Not found: ${value}`;
            } else if (action === 'clear') {
                state.inventory = [];
                saveState();
                updateUI();
                return 'Inventory cleared';
            } else if (action === 'list') {
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
        helpString: 'Manage PRTS inventory. <code>/prts-inventory action=add icon=⚔ qty=1 Magic Sword</code>',
        returns: ARGUMENT_TYPE.STRING,
    }));

    // /prts-scene — Initialize or set scene
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'prts-scene',
        callback: async (args, value) => {
            const action = args.action || 'init';
            if (action === 'init') {
                return await dispatchGeneration(TASK_TYPE.SCENE_INIT);
            } else if (action === 'set' && value) {
                appendSceneBlock(value, 'manual');
                addTimelineNode('manual', value.substring(0, 60));
                saveState();
                updateUI();
                return value;
            } else if (action === 'clear') {
                state.sceneBlocks = [];
                state.currentScene = '';
                saveState();
                updateUI();
                return 'Scene cleared';
            }
            return 'Usage: /prts-scene action=init';
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'action',
                description: 'init/set/clear',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                defaultValue: 'init',
            }),
        ],
        helpString: 'Manage PRTS scenes. <code>/prts-scene action=init</code> or <code>/prts-scene action=set A dark corridor...</code>',
        returns: ARGUMENT_TYPE.STRING,
    }));

    // /prts-reset — Full state reset
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
        helpString: 'Reset all PRTS state (scenes, cards, timeline, inventory).',
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
    // Basic formatting: preserve paragraphs, highlight dialogue
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
    // Register slash commands
    registerCommands();

    // Listen for chat change to reload state
    eventSource.on(event_types.CHAT_CHANGED, () => {
        loadState();
        injectUI();
    });

    // Listen for chat loaded
    eventSource.on(event_types.CHAT_LOADED, () => {
        loadState();
        injectUI();
    });

    // Streaming token hook
    eventSource.on(event_types.STREAM_TOKEN_RECEIVED, onStreamToken);

    // Generation end hook — clean up streaming buffer
    eventSource.on(event_types.GENERATION_ENDED, onStreamEnd);
    eventSource.on(event_types.GENERATION_STOPPED, onStreamEnd);

    // Initial injection if chat is already loaded
    const ctx = getContext();
    if (ctx.chatId) {
        loadState();
        injectUI();
    }

    console.log('[PRTS] Narrative Engine loaded. Use /prts to toggle.');
});
