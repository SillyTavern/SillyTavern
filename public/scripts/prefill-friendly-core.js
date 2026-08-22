/**
 * Pure, dependency-free logic for the Prefill Friendly context-management strategy.
 *
 * This module contains no imports so it can be unit-tested in isolation.
 * See prefill-friendly.js for the stateful orchestration layer.
 */

/** Fraction of the maximum context size at which compaction triggers. */
export const PF_TRIGGER_RATIO = 0.8;

/** Fraction of the maximum context size retained as raw history after compaction. */
export const PF_RETENTION_RATIO = 0.2;

/** Static target size (~tokens) requested for summaries; does not scale with context size. */
export const PF_SUMMARY_TARGET_TOKENS = 3000;

/** Unique key under chat_metadata where per-chat Prefill Friendly state is stored. */
export const PF_METADATA_KEY = 'prefill_friendly';

/**
 * Checks whether the total request token count reached the compaction trigger
 * (approximately 80% of the configured maximum context).
 * @param {number} totalTokens Total tokens of the complete request
 * @param {number} maxContext Configured maximum context size
 * @returns {boolean} True if compaction should run
 */
export function isThresholdExceeded(totalTokens, maxContext) {
    return totalTokens >= Math.floor(PF_TRIGGER_RATIO * maxContext);
}

/**
 * Computes the raw-history pointer after a compaction.
 *
 * Walks backward from the newest message and includes complete messages until
 * adding another complete message would exceed the retention budget
 * (~20% of maximum context). Never splits an individual message: the returned
 * index is always aligned to a complete-message boundary.
 *
 * @param {number[]} tokensByIndex Token count per message index of the full chat
 * @param {number} budgetTokens Maximum tokens retained as raw history
 * @param {(index: number) => boolean} isIncluded Predicate marking messages eligible for raw inclusion (non-system, non-empty)
 * @returns {number} Chat index of the first message included in the raw suffix
 */
export function calculateRawRetention(tokensByIndex, budgetTokens, isIncluded) {
    let acc = 0;
    let boundary = tokensByIndex.length;

    for (let i = tokensByIndex.length - 1; i >= 0; i--) {
        if (!isIncluded(i)) {
            boundary = i;
            continue;
        }

        const t = tokensByIndex[i];
        if (acc + t > budgetTokens) {
            break;
        }

        acc += t;
        boundary = i;
    }

    // Guarantee at least one eligible message is retained even if it alone
    // exceeds the budget (prevents an empty raw history on tiny contexts).
    if (boundary >= tokensByIndex.length) {
        for (let i = tokensByIndex.length - 1; i >= 0; i--) {
            if (isIncluded(i)) {
                return i;
            }
        }
        return 0;
    }

    return boundary;
}

/**
 * Clamps a stored pointer into the valid range of the current chat length.
 * Used when chats are loaded/switched or messages are deleted.
 * @param {number} pointer Stored pointer value
 * @param {number} chatLength Current chat length
 * @returns {number} Clamped pointer within [0, chatLength - 1]
 */
export function clampPointer(pointer, chatLength) {
    return Math.max(0, Math.min(pointer, Math.max(0, chatLength - 1)));
}

/**
 * Formats a canonical summary for stable injection near the start of the prompt.
 * The fixed wrapper keeps the prompt prefix stable between ordinary turns,
 * which is what makes prefix/prefill caching effective.
 * @param {string} summary Canonical summary text
 * @returns {string} Formatted summary injection or empty string
 */
export function formatSummaryInjection(summary) {
    return summary ? `[Summary of earlier events:\n${summary}\n]` : '';
}

/**
 * Builds the Stage 1 summarization request.
 *
 * First compaction (no previous summary):
 *   SUMMARISE ... [CONVERSATION FROM CURRENT POINTER]
 *
 * Subsequent compactions:
 *   SUMMARISE ... [PREVIOUS SUMMARY] [CONVERSATION FROM CURRENT POINTER]
 *
 * @param {string} previousSummary Previous canonical summary ('' on first compaction)
 * @param {string} conversationText Conversation from the current pointer
 * @returns {string} Complete summarization prompt
 */
export function buildSummarizePrompt(previousSummary, conversationText) {
    const parts = [
        'SUMMARISE THIS ENTIRE ROLEPLAY IN ~3K TOKENS',
        'Focus on major plot events, character developments, relationships, and world state changes.',
        'Do not include meta-commentary, only the story facts.',
        '',
    ];

    if (previousSummary) {
        parts.push('[PREVIOUS SUMMARY]', previousSummary, '');
    }

    parts.push('[CONVERSATION FROM CURRENT POINTER]', conversationText);
    return parts.join('\n\n');
}

/**
 * Builds the Stage 2 merge request that combines the previous canonical summary
 * with the newly generated summary into a single new canonical summary.
 * Prevents summaries from accumulating indefinitely (one canonical summary invariant).
 * @param {string} summaryA Previous canonical summary
 * @param {string} summaryB Newly generated summary
 * @returns {string} Complete merge prompt
 */
export function buildMergePrompt(summaryA, summaryB) {
    return [
        'MERGE THE STORY EVENTS OF THESE TWO SUMMARIES INTO ONE COHERENT SUMMARY OF ~3K TOKENS.',
        'Preserve chronological order and all key facts. Eliminate redundancy.',
        '',
        '[PREVIOUS CANONICAL SUMMARY]', summaryA,
        '',
        '[NEWLY GENERATED SUMMARY]', summaryB,
    ].join('\n');
}

/**
 * Formats a chat range [startIdx, endIdx) into a plain-text conversation block
 * used as summarizer input. System/empty messages are skipped.
 * @param {{ name?: string, mes?: string, is_system?: boolean }[]} chat Full chat array
 * @param {number} startIdx Inclusive start (current pointer)
 * @param {number} endIdx Exclusive end (new pointer)
 * @returns {string} Formatted conversation text
 */
export function formatConversationRange(chat, startIdx, endIdx) {
    const lines = [];
    for (let i = Math.max(0, startIdx); i < endIdx && i < chat.length; i++) {
        const m = chat[i];
        if (!m || m.is_system || !m.mes) {
            continue;
        }
        lines.push(`${m.name ?? 'Unknown'}:\n${m.mes}`);
    }
    return lines.join('\n\n');
}
