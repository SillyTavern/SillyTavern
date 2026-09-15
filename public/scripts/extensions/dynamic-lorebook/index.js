/**
 * Dynamic Lorebook Manager — Main Entry Point
 *
 * Wires together all modules and registers with the SillyTavern extension
 * system. Subscribes to core events, runs the analysis pipeline after each
 * AI message, and drives the approval dialog.
 */

import {
    eventSource,
    event_types,
    chat,
    saveSettingsDebounced,
    main_api,
} from '../../../script.js';
import {
    extension_settings,
    getContext,
    renderExtensionTemplateAsync,
} from '../../extensions.js';

import { EntryDetector } from './src/detector.js';
import { ResponseAnalyzer } from './src/analyzer.js';
import { UpdateSuggester } from './src/suggester.js';
import { LorebookUpdater } from './src/updater.js';
import { UpdateHistory } from './src/storage.js';
import { ApprovalDialog } from './src/ui/approval-dialog.js';
import { HistoryPanel } from './src/ui/history-panel.js';
import { debounce, timeAgo } from './src/utils.js';

// ============================================================================
// Extension name and defaults
// ============================================================================

const EXT_NAME = 'dynamic_lorebook';

const DEFAULT_SETTINGS = {
    enabled: true,
    updateMode: 'auto-suggest',      // 'manual' | 'auto-suggest' | 'auto-approve'
    aggressiveness: 'balanced',       // 'conservative' | 'balanced' | 'aggressive'
    minConfidence: 0.7,               // 0.0 – 1.0
    updateFields: ['content', 'keywords'],
    analysisDelayMs: 2000,
    maxHistorySize: 50,
    debugMode: false,
    analysisProfileId: null,          // null = use the current chat API connection
};

// ============================================================================
// Module instances (created during init)
// ============================================================================

let detector;
let analyzer;
let suggester;
let updater;
let history;

// Pending suggestions waiting for the user to review
let pendingSuggestions = [];
let activeDialog = null;
let lastUpdateTimestamp = null;

// ============================================================================
// Settings helpers
// ============================================================================

function getSettings() {
    if (!extension_settings[EXT_NAME]) {
        extension_settings[EXT_NAME] = { ...DEFAULT_SETTINGS };
    }
    // Fill in any missing keys from future defaults
    for (const [key, val] of Object.entries(DEFAULT_SETTINGS)) {
        if (!(key in extension_settings[EXT_NAME])) {
            extension_settings[EXT_NAME][key] = val;
        }
    }
    return extension_settings[EXT_NAME];
}

/**
 * Resolves the currently selected analysis connection profile from the
 * connection-manager extension's profile list.
 * Returns null when "Use current chat API" is selected.
 *
 * @returns {object|null}
 */
function getAnalysisProfile() {
    const profileId = getSettings().analysisProfileId;
    if (!profileId) return null;
    const profiles = extension_settings['connection-manager']?.profiles ?? [];
    return profiles.find(p => p.id === profileId) ?? null;
}

/**
 * Rebuilds the analysis-profile <select> from the connection-manager profile list.
 * Safe to call when the DOM element doesn't exist yet.
 */
function populateProfileDropdown() {
    const select = document.getElementById('dlm-analysis-profile');
    if (!select) return;

    const profiles = extension_settings['connection-manager']?.profiles ?? [];
    const currentId = getSettings().analysisProfileId ?? '';

    // Remove all options after the first placeholder
    while (select.options.length > 1) select.remove(1);

    for (const p of profiles) {
        const opt = document.createElement('option');
        opt.value = p.id;
        const modeLabel = p.mode === 'cc' ? 'Chat' : 'Text';
        opt.textContent = `${p.name ?? p.id} (${modeLabel})`;
        select.appendChild(opt);
    }

    select.value = currentId;
}

// ============================================================================
// Event handlers
// ============================================================================

function onGenerationStarted() {
    if (!getSettings().enabled) return;
    detector.onGenerationStarted();
}

function onWorldInfoActivated(entries) {
    if (!getSettings().enabled) return;
    detector.onActivation(entries);
}

/**
 * Called when the AI finishes generating a message.
 * Kicks off the analysis pipeline (debounced).
 *
 * @param {number} messageId - Index into the chat[] array
 * @param {string} type      - Generation type (ignored)
 */
async function onMessageReceived(messageId, type) {
    const settings = getSettings();
    if (!settings.enabled) return;
    if (settings.updateMode === 'manual') return;

    // Associate pending activations with this message
    const activations = detector.onMessageReceived(messageId);
    if (activations.length === 0) {
        if (settings.debugMode) console.debug('[DLM] No lorebook entries were activated — skipping analysis.');
        return;
    }

    // Get the AI message text
    const message = chat[messageId];
    if (!message || message.is_user) return;
    const messageText = message.mes ?? '';
    if (!messageText.trim()) return;

    // Run analysis after the configured delay
    debouncedAnalyze(messageId, messageText, activations, settings);
}

/**
 * Add an "Analyze" button to each AI message's extras strip.
 * @param {number} messageId
 */
function onCharacterMessageRendered(messageId) {
    if (!getSettings().enabled) return;

    const msgEl = document.querySelector(`.mes[mesid="${messageId}"]`);
    if (!msgEl) return;

    // Don't add duplicate buttons
    if (msgEl.querySelector('.dlm-analyze-btn')) return;

    const extras = msgEl.querySelector('.mes_buttons');
    if (!extras) return;

    const btn = document.createElement('div');
    btn.className = 'mes_button dlm-analyze-btn';
    btn.title = 'Analyze for lorebook updates';
    btn.innerHTML = '<i class="fa-solid fa-book-open"></i>';
    btn.addEventListener('click', () => triggerManualAnalysis(messageId));
    extras.appendChild(btn);
}

// ============================================================================
// Analysis pipeline
// ============================================================================

let debouncedAnalyze;

function buildDebouncedAnalyze(delayMs) {
    return debounce(runAnalysis, delayMs);
}

/**
 * Core analysis + suggestion pipeline.
 */
async function runAnalysis(messageId, messageText, activations, settings) {
    if (settings.debugMode) {
        console.debug(`[DLM] Analyzing message ${messageId} with ${activations.length} activated entries.`);
    }

    let analysis;
    try {
        analysis = await analyzer.analyzeMessage(messageText, activations, getAnalysisProfile());
    } catch (e) {
        console.error('[DLM] Analysis request failed:', e.message);
        if (isUnsupportedApiError(e)) {
            showApiWarning();
        } else {
            toastr.error('Lorebook analysis failed: ' + e.message, 'Dynamic Lorebook Manager');
        }
        return;
    }

    const suggestions = suggester.generateSuggestions(analysis, activations);

    if (suggestions.length === 0) {
        if (settings.debugMode) {
            console.debug('[DLM] No suggestions generated for message', messageId);
        }
        return;
    }

    pendingSuggestions = suggestions;
    updateStatusWidget();

    if (settings.updateMode === 'auto-approve') {
        // Apply high-confidence suggestions automatically
        const highConf = suggestions.filter(s => s.confidence >= 0.85);
        if (highConf.length > 0) {
            highConf.forEach(s => { s.status = 'approved'; });
            await applyApprovedSuggestions(highConf);
        }
        // Show the rest to the user
        const remaining = suggestions.filter(s => s.confidence < 0.85);
        if (remaining.length > 0) {
            pendingSuggestions = remaining;
            updateStatusWidget();
            toastr.info(
                `${remaining.length} suggestion(s) ready for review.`,
                'Dynamic Lorebook Manager',
            );
        }
        return;
    }

    // auto-suggest: notify and let user open the dialog
    toastr.info(
        `${suggestions.length} lorebook suggestion(s) available. <a href="#" id="dlm-toast-review">Review</a>`,
        'Dynamic Lorebook Manager',
        { timeOut: 8000, extendedTimeOut: 4000, closeButton: true },
    );

    // Wire the inline link inside the toast
    setTimeout(() => {
        document.getElementById('dlm-toast-review')?.addEventListener('click', (e) => {
            e.preventDefault();
            openApprovalDialog();
        });
    }, 100);
}

/**
 * Manual analysis triggered by the "Analyze" button on a message.
 * @param {number} messageId
 */
async function triggerManualAnalysis(messageId) {
    const settings = getSettings();
    const message = chat[messageId];
    if (!message || message.is_user) {
        toastr.warning('Select an AI message to analyze.');
        return;
    }

    const activations = detector.getActivationsForMessage(messageId);
    if (activations.length === 0) {
        toastr.info('No lorebook entries were activated for that message.');
        return;
    }

    toastr.info('Analyzing message…', 'Dynamic Lorebook Manager', { timeOut: 3000 });
    await runAnalysis(messageId, message.mes, activations, settings);
}

// ============================================================================
// Apply suggestions → lorebook
// ============================================================================

/**
 * Called by the ApprovalDialog when the user clicks "Apply Selected".
 * @param {object[]} approvedSuggestions
 */
async function applyApprovedSuggestions(approvedSuggestions) {
    let results;
    try {
        results = await updater.applySuggestions(approvedSuggestions);
    } catch (e) {
        console.error('[DLM] Failed to apply suggestions:', e);
        toastr.error('Failed to apply updates: ' + e.message, 'Dynamic Lorebook Manager');
        return;
    }

    const succeeded = results.filter(r => r.success);
    const failed    = results.filter(r => !r.success);

    if (failed.length > 0) {
        console.warn('[DLM] Some updates failed:', failed);
        toastr.warning(`${failed.length} update(s) failed. Check the console.`);
    }

    if (succeeded.length > 0) {
        // Build one history record per world name
        const byWorld = new Map();
        for (const r of succeeded) {
            if (!byWorld.has(r.worldName)) byWorld.set(r.worldName, []);
            byWorld.get(r.worldName).push(r);
        }

        for (const [worldName, worldResults] of byWorld) {
            const suggestion = approvedSuggestions.find(s => s.worldName === worldName);
            history.addUpdate({
                worldName,
                changes: worldResults.map(r => ({
                    entryUid: r.entryUid,
                    entryComment: approvedSuggestions.find(s => s.entryUid === r.entryUid)?.entryComment ?? '',
                    suggestionId: r.suggestionId,
                    before: r.backup,
                    after: r.after,
                })),
                metadata: {
                    messageId: suggestion?.createdAt,
                    characterName: getContext().name2,
                },
            });
        }

        lastUpdateTimestamp = Date.now();
        toastr.success(
            `${succeeded.length} lorebook entr${succeeded.length !== 1 ? 'ies' : 'y'} updated.`,
            'Dynamic Lorebook Manager',
        );
    }

    // Clear pending and refresh widget
    pendingSuggestions = [];
    updateStatusWidget();
}

// ============================================================================
// Dialog helpers
// ============================================================================

function openApprovalDialog() {
    if (pendingSuggestions.length === 0) {
        toastr.info('No pending suggestions.');
        return;
    }
    activeDialog = new ApprovalDialog(pendingSuggestions, applyApprovedSuggestions);
    activeDialog.open();
}

function openHistoryPanel() {
    new HistoryPanel(history, updater, updateStatusWidget).open();
}

// ============================================================================
// Status widget
// ============================================================================

function updateStatusWidget() {
    const pendingBadge  = document.getElementById('dlm-pending-badge');
    const pendingCount  = document.getElementById('dlm-pending-count');
    const reviewBtn     = document.getElementById('dlm-review-btn');
    const undoBtn       = document.getElementById('dlm-undo-btn');
    const lastUpdateEl  = document.getElementById('dlm-last-update');

    if (pendingBadge && pendingCount) {
        const hasPending = pendingSuggestions.length > 0;
        pendingBadge.style.display = hasPending ? '' : 'none';
        pendingCount.textContent = String(pendingSuggestions.length);
    }

    if (reviewBtn) {
        reviewBtn.style.display = pendingSuggestions.length > 0 ? '' : 'none';
    }

    if (undoBtn) {
        undoBtn.disabled = !history.canUndo();
    }

    if (lastUpdateEl) {
        lastUpdateEl.textContent = lastUpdateTimestamp
            ? `Last update: ${timeAgo(lastUpdateTimestamp)}`
            : '';
    }
}

// ============================================================================
// API warning
// ============================================================================

function isUnsupportedApiError(e) {
    return e.message.includes('Unsupported API type');
}

function showApiWarning() {
    const warn = document.getElementById('dlm-api-warning');
    if (warn) warn.style.display = '';
    toastr.warning(
        `API type "${main_api}" is not supported for lorebook analysis.`,
        'Dynamic Lorebook Manager',
    );
}

// ============================================================================
// Settings UI wiring
// ============================================================================

function loadSettingsIntoUI() {
    const s = getSettings();

    // Enabled checkbox
    const enabledEl = document.getElementById('dlm-enabled');
    if (enabledEl) enabledEl.checked = s.enabled;

    // Update mode
    const modeEl = document.getElementById('dlm-update-mode');
    if (modeEl) modeEl.value = s.updateMode;

    // Aggressiveness radio
    document.querySelectorAll('input[name="dlm-aggressiveness"]').forEach(radio => {
        radio.checked = radio.value === s.aggressiveness;
    });

    // Confidence slider
    const confEl = document.getElementById('dlm-min-confidence');
    const confValEl = document.getElementById('dlm-confidence-value');
    if (confEl) {
        confEl.value = Math.round(s.minConfidence * 100);
        if (confValEl) confValEl.textContent = `${Math.round(s.minConfidence * 100)}%`;
    }

    // Update fields checkboxes
    document.querySelectorAll('input[name="dlm-update-fields"]').forEach(cb => {
        cb.checked = s.updateFields.includes(cb.value);
    });

    // Analysis delay
    const delayEl = document.getElementById('dlm-analysis-delay');
    const delayValEl = document.getElementById('dlm-delay-value');
    if (delayEl) {
        delayEl.value = s.analysisDelayMs;
        if (delayValEl) delayValEl.textContent = String(s.analysisDelayMs);
    }

    // History size
    const histSizeEl = document.getElementById('dlm-history-size');
    if (histSizeEl) histSizeEl.value = s.maxHistorySize;

    // Debug mode
    const debugEl = document.getElementById('dlm-debug-mode');
    if (debugEl) debugEl.checked = s.debugMode;

    // Analysis connection profile
    populateProfileDropdown();
}

function bindSettingsListeners() {
    const s = getSettings();

    document.getElementById('dlm-enabled')?.addEventListener('change', (e) => {
        s.enabled = e.target.checked;
        if (s.enabled) {
            eventSource.on(event_types.GENERATION_STARTED,         onGenerationStarted);
            eventSource.on(event_types.WORLD_INFO_ACTIVATED,       onWorldInfoActivated);
            eventSource.on(event_types.MESSAGE_RECEIVED,           onMessageReceived);
            eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, onCharacterMessageRendered);
        } else {
            eventSource.off(event_types.GENERATION_STARTED,         onGenerationStarted);
            eventSource.off(event_types.WORLD_INFO_ACTIVATED,       onWorldInfoActivated);
            eventSource.off(event_types.MESSAGE_RECEIVED,           onMessageReceived);
            eventSource.off(event_types.CHARACTER_MESSAGE_RENDERED, onCharacterMessageRendered);
            detector.clearHistory();
        }
        saveSettingsDebounced();
    });

    document.getElementById('dlm-update-mode')?.addEventListener('change', (e) => {
        s.updateMode = e.target.value;
        saveSettingsDebounced();
    });

    document.querySelectorAll('input[name="dlm-aggressiveness"]').forEach(radio => {
        radio.addEventListener('change', () => {
            if (radio.checked) {
                s.aggressiveness = radio.value;
                suggester.settings = s;
                saveSettingsDebounced();
            }
        });
    });

    const confEl = document.getElementById('dlm-min-confidence');
    const confValEl = document.getElementById('dlm-confidence-value');
    confEl?.addEventListener('input', () => {
        s.minConfidence = confEl.value / 100;
        if (confValEl) confValEl.textContent = `${confEl.value}%`;
        saveSettingsDebounced();
    });

    document.querySelectorAll('input[name="dlm-update-fields"]').forEach(cb => {
        cb.addEventListener('change', () => {
            s.updateFields = Array.from(
                document.querySelectorAll('input[name="dlm-update-fields"]:checked'),
            ).map(el => el.value);
            updater.settings = s;
            saveSettingsDebounced();
        });
    });

    const delayEl = document.getElementById('dlm-analysis-delay');
    const delayValEl = document.getElementById('dlm-delay-value');
    delayEl?.addEventListener('input', () => {
        s.analysisDelayMs = Number(delayEl.value);
        if (delayValEl) delayValEl.textContent = String(delayEl.value);
        debouncedAnalyze = buildDebouncedAnalyze(s.analysisDelayMs);
        saveSettingsDebounced();
    });

    document.getElementById('dlm-history-size')?.addEventListener('change', (e) => {
        s.maxHistorySize = Number(e.target.value);
        history.maxSize = s.maxHistorySize;
        saveSettingsDebounced();
    });

    document.getElementById('dlm-debug-mode')?.addEventListener('change', (e) => {
        s.debugMode = e.target.checked;
        analyzer.settings = s;
        saveSettingsDebounced();
    });

    document.getElementById('dlm-analysis-profile')?.addEventListener('change', (e) => {
        s.analysisProfileId = e.target.value || null;
        // Clear the analysis cache so the next request uses the new profile
        analyzer.clearCache();
        saveSettingsDebounced();
    });

    // Status widget buttons
    document.getElementById('dlm-review-btn')?.addEventListener('click', openApprovalDialog);
    document.getElementById('dlm-history-btn')?.addEventListener('click', openHistoryPanel);
    document.getElementById('dlm-undo-btn')?.addEventListener('click', async () => {
        const record = history.peekUndo();
        if (!record) return;
        try {
            for (const change of (record.changes ?? [])) {
                await updater.restoreBackup(record.worldName, change.entryUid, change.before);
            }
            history.commitUndo();
            updateStatusWidget();
            toastr.success('Last update undone.');
        } catch (e) {
            console.error('[DLM] Quick undo failed:', e);
            toastr.error('Undo failed: ' + e.message);
        }
    });
}

// ============================================================================
// Initialisation
// ============================================================================

jQuery(async () => {
    const settings = getSettings();

    // Instantiate all modules
    detector  = new EntryDetector();
    analyzer  = new ResponseAnalyzer(settings);
    suggester = new UpdateSuggester(settings);
    updater   = new LorebookUpdater(settings);
    history   = new UpdateHistory(settings.maxHistorySize);

    // Build the debounced analysis runner
    debouncedAnalyze = buildDebouncedAnalyze(settings.analysisDelayMs);

    // -----------------------------------------------------------------------
    // Register SillyTavern event listeners
    // -----------------------------------------------------------------------

    eventSource.on(event_types.GENERATION_STARTED,         onGenerationStarted);
    eventSource.on(event_types.WORLD_INFO_ACTIVATED,       onWorldInfoActivated);
    eventSource.on(event_types.MESSAGE_RECEIVED,           onMessageReceived);
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, onCharacterMessageRendered);

    // Keep the analysis-profile dropdown in sync with connection-manager changes
    eventSource.on(event_types.CONNECTION_PROFILE_CREATED, populateProfileDropdown);
    eventSource.on(event_types.CONNECTION_PROFILE_DELETED, populateProfileDropdown);
    eventSource.on(event_types.CONNECTION_PROFILE_UPDATED, populateProfileDropdown);

    // -----------------------------------------------------------------------
    // Render the settings panel into the extensions drawer
    // -----------------------------------------------------------------------

    try {
        const html = await renderExtensionTemplateAsync('dynamic-lorebook', 'index');
        $('#extensions_settings').append(html);
        loadSettingsIntoUI();
        bindSettingsListeners();
        updateStatusWidget();
    } catch (e) {
        console.error('[DLM] Failed to render settings panel:', e);
    }

    // Show API warning immediately if current API is unsupported
    if (settings.enabled && main_api !== 'openai' && main_api !== 'textgenerationwebui' && main_api !== 'kobold') {
        // Only warn — don't block, the API type might be fine (e.g. openai-compat)
        if (settings.debugMode) {
            console.debug(`[DLM] Loaded. main_api="${main_api}".`);
        }
    }

    // Inject the "Analyze" button into all character messages that are already
    // rendered in the DOM (CHARACTER_MESSAGE_RENDERED only fires for new ones).
    if (settings.enabled) {
        document.querySelectorAll('.mes[mesid]').forEach(msgEl => {
            if (msgEl.classList.contains('is_user')) return;
            const mesid = Number(msgEl.getAttribute('mesid'));
            if (!isNaN(mesid)) onCharacterMessageRendered(mesid);
        });
    }

    console.log('[DLM] Dynamic Lorebook Manager loaded.');
});
