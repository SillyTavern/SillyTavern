import { getTokenCount } from './tokenizers.js';
import { setExtensionPrompt, extension_prompt_types, extension_prompt_roles, saveMetadataDebounced, eventSource, event_types } from './extensions.js';
import { generateQuietPrompt, chat, chat_metadata, oai_settings, main_api } from '../script.js';
import {
    PF_METADATA_KEY,
    PF_RETENTION_RATIO,
    isThresholdExceeded,
    calculateRawRetention,
    clampPointer,
    formatSummaryInjection,
    buildSummarizePrompt,
    buildMergePrompt,
    formatConversationRange,
} from './prefill-friendly-core.js';

/** Extension prompt injection ID for the canonical summary. */
const INJECT_ID = 'prefill_friendly_summary';

/** Maximum response length requested for summarization calls (~3k tokens + headroom). */
const SUMMARY_RESPONSE_TOKENS = 3072;

/**
 * Flat token padding covering prompt components that are not individually
 * measurable at estimation time (prompt manager wrappers, markers, nudges).
 */
const PADDING_TOKENS = 256;

let compactionLock = Promise.resolve();

/**
 * Serializes compaction runs so concurrent generation requests cannot race
 * with or bypass an active compaction (blocking invariant). Subsequent callers
 * queue behind the running one and re-evaluate the threshold afterwards.
 * @param {() => Promise<any>} fn Operation to run under lock
 * @returns {Promise<any>} Result of fn
 */
async function withLock(fn) {
    const prev = compactionLock;
    let release;
    compactionLock = new Promise(resolve => { release = resolve; });
    try {
        await prev;
        return await fn();
    } finally {
        release();
    }
}

function getState() {
    const state = chat_metadata[PF_METADATA_KEY] || {};
    const summary = typeof state.summary === 'string' ? state.summary : '';
    const pointer = Number.isInteger(state.pointer) ? state.pointer : 0;
    return { summary, pointer };
}

function writeState(summary, pointer) {
    chat_metadata[PF_METADATA_KEY] = { summary, pointer };
    saveMetadataDebounced();
}

/**
 * Injects or clears the canonical summary extension prompt.
 * Uses IN_PROMPT position with SYSTEM role so the summary sits near the start
 * of the request and its position stays stable between ordinary turns.
 * @param {string} summary Canonical summary ('' clears the injection)
 */
function applySummaryInjection(summary) {
    setExtensionPrompt(INJECT_ID, formatSummaryInjection(summary), extension_prompt_types.IN_PROMPT, 0, false, extension_prompt_roles.SYSTEM);
}

function estimateMessageTokens(message) {
    return getTokenCount(`${message.name}:\n${message.mes}`);
}

/**
 * Estimates tokens of everything in the request besides the conversation
 * messages: character card fields, persona, system prompt, bias,
 * world information, and the formatted canonical summary.
 * @param {object} args Prompt component strings
 * @returns {Promise<number>} Estimated overhead token count
 */
async function estimateOverheadTokens(args) {
    const texts = [
        args.description,
        args.personality,
        args.scenario,
        args.persona,
        args.system,
        args.promptBias,
        args.worldInfoBefore,
        args.worldInfoAfter,
    ].filter(Boolean);

    if (args.summary) {
        texts.push(formatSummaryInjection(args.summary));
    }

    let total = PADDING_TOKENS;
    for (const t of texts) {
        total += getTokenCount(t);
    }
    return total;
}

/**
 * Sums tokens of the model-visible conversation messages.
 * @param {{ mes?: string, name?: string, is_system?: boolean }[]} coreChat Visible messages
 * @returns {Promise<number>} Total history token count
 */
async function countHistoryTokens(coreChat) {
    let total = 0;
    for (const m of coreChat) {
        if (!m || m.is_system || !m.mes) {
            continue;
        }
        total += estimateMessageTokens(m);
    }
    return total;
}

/**
 * Begins a generation request: decides whether Prefill Friendly applies and
 * returns the pointer-selected model-visible raw history. The underlying chat
 * array itself is never mutated; only a suffix view of it is returned.
 * @param {{ type: string, quietPrompt?: string, dryRun: boolean }} params Generation parameters
 * @returns {Promise<{ enabled: boolean, history: any[] | null }>} Selection result
 */
export async function beginRequest({ type, quietPrompt, dryRun }) {
    // Quiet generations (including our own summarizer calls) must never trigger selection/compaction.
    const enabled =
        !dryRun &&
        !quietPrompt &&
        type !== 'quiet' &&
        !!oai_settings.prefill_friendly &&
        main_api === 'openai';

    if (!enabled) {
        return { enabled: false, history: null };
    }

    if (!chat.length) {
        applySummaryInjection('');
        return { enabled: true, history: chat };
    }

    const state = getState();
    const clampedPointer = clampPointer(state.pointer, chat.length);
    if (clampedPointer !== state.pointer) {
        writeState(state.summary, clampedPointer);
    }

    const history = clampedPointer > 0 ? chat.slice(clampedPointer) : chat;

    applySummaryInjection(state.summary);
    return { enabled: true, history };
}

/**
 * Blocking context re-evaluation. Called after world info has been resolved so
 * the threshold accounts for the complete request context (system prompt,
 * character card, persona, lore, extensions, summary, and raw history).
 *
 * When the ~80% trigger fires:
 *   1. Retains ~20% of max context worth of newest complete messages.
 *   2. Summarizes [current pointer .. new pointer).
 *   3. If a previous canonical summary exists, merges it with the new summary
 *      (two-stage pipeline) so exactly one canonical summary remains.
 *   4. Only then atomically updates the persisted state and moves the pointer.
 *
 * On any failure the previous summary and pointer are preserved untouched and
 * the error propagates so the caller can abort generation gracefully.
 *
 * @param {object} args Context components and limits
 * @param {any[]} args.chat Full chat array (never mutated)
 * @param {any[]} args.coreChat Model-visible messages used for the current request
 * @param {string} [args.description] Character description
 * @param {string} [args.personality] Character personality
 * @param {string} [args.scenario] Scenario
 * @param {string} [args.persona] Persona description
 * @param {string} [args.system] System prompt
 * @param {string} [args.promptBias] Prompt bias
 * @param {string} [args.worldInfoBefore] World info before
 * @param {string} [args.worldInfoAfter] World info after
 * @param {number} args.maxContext Configured maximum context size
 * @returns {Promise<{ compacted: boolean, history?: any[], summary?: string }>}
 */
export async function enforceCompaction(args) {
    if (!args.chat || !args.chat.length) {
        return { compacted: false };
    }

    return withLock(async () => {
        const state = getState();
        const clampedPointer = clampPointer(state.pointer, args.chat.length);

        // Threshold check happens inside the lock so queued requests re-evaluate
        // against post-compaction state instead of compacting redundantly.
        const overheadTokens = await estimateOverheadTokens({
            description: args.description,
            personality: args.personality,
            scenario: args.scenario,
            persona: args.persona,
            system: args.system,
            promptBias: args.promptBias,
            worldInfoBefore: args.worldInfoBefore,
            worldInfoAfter: args.worldInfoAfter,
            summary: state.summary,
        });
        const historyTokens = await countHistoryTokens(args.coreChat);
        const totalTokens = overheadTokens + historyTokens;

        if (!isThresholdExceeded(totalTokens, args.maxContext)) {
            return { compacted: false };
        }

        toastr?.info?.('Context reached 80% of maximum. Compacting...', 'Prefill Friendly', { timeOut: 0, extendedTimeOut: 0, preventDuplicates: true });

        try {
            // Raw retention budget: ~20% of max context, complete messages only.
            const retentionBudget = Math.floor(args.maxContext * PF_RETENTION_RATIO);
            const tokensByIndex = [];
            const isIncluded = [];
            for (const m of args.chat) {
                if (!m || m.is_system || !m.mes) {
                    tokensByIndex.push(0);
                    isIncluded.push(false);
                } else {
                    tokensByIndex.push(estimateMessageTokens(m));
                    isIncluded.push(true);
                }
            }
            const newPointer = calculateRawRetention(tokensByIndex, retentionBudget, i => isIncluded[i]);

            // Nothing accumulated beyond the previous compaction point.
            if (newPointer <= clampedPointer) {
                return { compacted: false };
            }

            const conversationText = formatConversationRange(args.chat, clampedPointer, newPointer);
            if (!conversationText.trim()) {
                return { compacted: false };
            }

            // Stage 1: reconstruct the whole roleplay (previous summary + new range).
            const summarizeInput = buildSummarizePrompt(state.summary, conversationText);
            let newSummary = await generateQuietPrompt({
                quietPrompt: summarizeInput,
                skipWIAN: true,
                responseLength: SUMMARY_RESPONSE_TOKENS,
                removeReasoning: true,
            });

            if (!newSummary || !newSummary.trim()) {
                throw new Error('Summarization returned an empty result');
            }
            newSummary = newSummary.trim();

            // Stage 2: merge with the previous canonical summary (subsequent compactions only).
            if (state.summary) {
                const mergeInput = buildMergePrompt(state.summary, newSummary);
                const merged = await generateQuietPrompt({
                    quietPrompt: mergeInput,
                    skipWIAN: true,
                    responseLength: SUMMARY_RESPONSE_TOKENS,
                    removeReasoning: true,
                });
                if (!merged || !merged.trim()) {
                    throw new Error('Summary merge returned an empty result');
                }
                newSummary = merged.trim();
            }

            // Atomic state update: only reached when both stages succeeded.
            writeState(newSummary, newPointer);
            applySummaryInjection(newSummary);

            console.log(`[Prefill Friendly] Compacted: pointer ${clampedPointer} -> ${newPointer}, summary ${newSummary.length} chars`);

            return {
                compacted: true,
                history: args.chat.slice(newPointer),
                summary: newSummary,
            };
        } catch (err) {
            // Previous canonical summary and pointer remain intact (error invariant).
            console.error('[Prefill Friendly] Compaction failed:', err);
            toastr?.error?.(err.message || 'Context compaction failed', 'Prefill Friendly');
            throw err;
        } finally {
            toastr?.clear?.();
        }
    });
}

function onChatChanged() {
    applySummaryInjection(getState().summary);
}

function onMessageDeleted(eventData) {
    const deletedIdx = eventData?.index ?? eventData;
    const state = getState();
    if (typeof deletedIdx === 'number' && deletedIdx < state.pointer) {
        // Keep pointing at the same logical message after removal.
        writeState(state.summary, Math.max(0, state.pointer - 1));
    }
    onChatChanged();
}

export function init() {
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    eventSource.on(event_types.MESSAGE_DELETED, onMessageDeleted);
}
