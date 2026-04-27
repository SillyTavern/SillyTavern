import { chat, eventSource, event_types, getRequestHeaders, this_chid, characters, name1 } from '../script.js';
import { power_user } from './power-user.js';
import { selected_group, groups } from './group-chats.js';

/**
 * Lightweight per-turn debug logger that writes one entry per "user turn" to a daily
 * file under the user's Logs_Debug directory. Captures only structural metadata
 * (last speaker, activated lorebook entries, prompt section order, LLM router/filter
 * inputs and outputs) — not the full main-prompt content — so the file stays small
 * and human-scannable.
 *
 * Activated by the "Debug Log to File" checkbox in User Settings.
 *
 * Entry boundaries:
 *   - Solo turn:  GENERATION_STARTED → GENERATION_ENDED  (one entry per Generate)
 *   - Group turn: GROUP_WRAPPER_STARTED → GROUP_WRAPPER_FINISHED  (one entry covering
 *                 every sub-Generate inside the wrapper, plus pre-wrapper router calls)
 *
 * Sub-generations:
 *   Each Generate inside a group turn becomes a sub-generation with its own
 *   world_info_injected and prompt_order. Solo turns have exactly one sub-generation
 *   and the formatter flattens it for readability.
 */

/** @type {object|null} Currently-building entry, or null between turns */
let currentEntry = null;
/** True between GROUP_WRAPPER_STARTED and GROUP_WRAPPER_FINISHED. Suppresses per-Generate flush. */
let inGroupWrapper = false;
/** Hard cap on prompt/response sizes written to the log so files stay reasonable. */
const LLM_TEXT_TRUNCATE = 8000;

function isEnabled() {
    return !!power_user?.debug_logger_enabled;
}

function todayFilename() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `debug-${yyyy}-${mm}-${dd}.log`;
}

function nowIso() {
    return new Date().toISOString();
}

function getLastSpeaker() {
    for (let i = chat.length - 1; i >= 0; i--) {
        const m = chat[i];
        if (!m || m.is_system) continue;
        return {
            name: m.is_user ? `{{user}} (${name1 ?? 'user'})` : (m.name ?? 'unknown'),
            is_user: !!m.is_user,
            mes_id: i,
        };
    }
    return null;
}

function getCurrentContextLabel() {
    if (selected_group) {
        const g = groups?.find(x => x.id === selected_group);
        return `group: ${g?.name ?? selected_group}`;
    }
    if (typeof this_chid === 'number' && characters[this_chid]) {
        return `solo: ${characters[this_chid].name}`;
    }
    return 'unknown';
}

function makeSubGeneration(generationType) {
    return {
        startedAt: nowIso(),
        generationType: String(generationType ?? 'pending'),
        worldInfoEntries: [],
        promptOrder: [],
        promptKind: undefined,
        promptCount: 0,
    };
}

/**
 * Lazily creates the per-turn entry on first relevant event. The group router fires
 * its first LLM decision *before* GENERATION_STARTED, and the user message itself
 * may trigger multiple events; we want them all to land in one entry.
 */
function ensureEntry() {
    if (!isEnabled()) return null;
    if (!currentEntry) {
        currentEntry = {
            startedAt: nowIso(),
            generationType: 'pending',
            context: getCurrentContextLabel(),
            lastSpeaker: getLastSpeaker(),
            subGenerations: [],
            llmDecisionCalls: [],
            notes: [],
        };
    }
    return currentEntry;
}

/**
 * Returns the current sub-generation, creating one lazily if needed. Required for
 * pre-Generate events (e.g. WI scan during group router pre-roll, though uncommon).
 */
function ensureCurrentSub() {
    const entry = ensureEntry();
    if (!entry) return null;
    if (entry.subGenerations.length === 0) {
        entry.subGenerations.push(makeSubGeneration('pending'));
    }
    return entry.subGenerations[entry.subGenerations.length - 1];
}

/** GENERATION_STARTED: open a new sub-generation; refresh entry-level fields. */
function onGenerationStarted(generationType) {
    if (!isEnabled()) return;
    const entry = ensureEntry();
    if (!entry) return;
    entry.subGenerations.push(makeSubGeneration(generationType));
    if (entry.generationType === 'pending') entry.generationType = String(generationType ?? 'normal');
    if (!entry.lastSpeaker) entry.lastSpeaker = getLastSpeaker();
    if (entry.context === 'unknown') entry.context = getCurrentContextLabel();
}

function truncate(text, max = LLM_TEXT_TRUNCATE) {
    const s = String(text ?? '');
    if (s.length <= max) return s;
    return s.slice(0, max) + `…[truncated, ${s.length - max} chars omitted]`;
}

function captureLlmDecisionCall(payload) {
    if (!isEnabled()) return;
    if (!payload || typeof payload !== 'object') return;
    const entry = ensureEntry();
    if (!entry) return;
    entry.llmDecisionCalls.push({
        capturedAt: nowIso(),
        kind: String(payload.kind ?? 'unknown'),
        profileId: String(payload.profileId ?? ''),
        prompt: truncate(payload.prompt),
        response: truncate(payload.response),
        error: payload.error ? String(payload.error) : null,
        parsed: payload.parsed ?? null,
        meta: payload.meta ?? null,
    });
}

function captureWorldInfo(entries) {
    if (!isEnabled()) return;
    if (!Array.isArray(entries)) return;
    const sub = ensureCurrentSub();
    if (!sub) return;
    for (const entry of entries) {
        sub.worldInfoEntries.push({
            world: entry?.world ?? '',
            uid: entry?.uid ?? '',
            title: String(entry?.comment || entry?.key?.[0] || `entry ${entry?.uid}`).slice(0, 80),
            position: entry?.position ?? null,
            depth: entry?.depth ?? null,
            constant: !!entry?.constant,
        });
    }
}

/**
 * Heuristically classify a chat-completion message into a section label so the log
 * stays readable without dumping the full content. We look at the start of the content
 * for known markers, fall back to a role label.
 * @param {{role: string, content?: string|object[], identifier?: string, name?: string}} message
 * @returns {string}
 */
function describeChatCompletionMessage(message) {
    if (!message) return '(empty)';
    if (message.identifier) return String(message.identifier);
    const role = String(message.role ?? '?');
    const raw = typeof message.content === 'string'
        ? message.content
        : Array.isArray(message.content)
            ? message.content.map(p => p?.text ?? p?.content ?? '').join(' ')
            : '';
    const head = raw.replace(/\s+/g, ' ').slice(0, 60);
    return `${role}${message.name ? `:${message.name}` : ''}${head ? ` — ${head}…` : ''}`;
}

function captureChatCompletionPrompt(eventData) {
    if (!isEnabled()) return;
    const sub = ensureCurrentSub();
    if (!sub) return;
    const messages = Array.isArray(eventData?.chat) ? eventData.chat : [];
    sub.promptOrder = messages.map((m, i) => `${String(i + 1).padStart(2, '0')}. ${describeChatCompletionMessage(m)}`);
    sub.promptKind = 'chat-completion';
    sub.promptCount = messages.length;
}

function captureTextCompletionPrompt(eventData) {
    if (!isEnabled()) return;
    const sub = ensureCurrentSub();
    if (!sub) return;
    if (sub.promptOrder.length > 0) return; // already captured via chat-completion path
    const prompt = String(eventData?.prompt ?? '');
    if (!prompt) return;
    // Sniff for common section markers SillyTavern emits in the assembled text-completion prompt.
    const markerLines = prompt.split('\n').filter(line => /^(?:###|##|---|\[Start a new Chat\]|<[A-Za-z_]+>|Persona:|Scenario:|Personality:|Description:|World Info:|Author's Note:|Example:)/.test(line));
    sub.promptKind = 'text-completion';
    sub.promptCount = prompt.length;
    sub.promptOrder = markerLines.slice(0, 60).map((line, i) => `${String(i + 1).padStart(2, '0')}. ${line.trim().slice(0, 100)}`);
    if (markerLines.length === 0 && currentEntry) {
        currentEntry.notes.push('text-completion prompt: no recognized section markers');
    }
}

function formatSubBody(sub, indent) {
    const lines = [];
    lines.push(`${indent}world_info_injected (${sub.worldInfoEntries.length}):`);
    if (sub.worldInfoEntries.length === 0) {
        lines.push(`${indent}  (none)`);
    } else {
        for (const e of sub.worldInfoEntries) {
            const tags = [];
            if (e.constant) tags.push('constant');
            if (e.position !== null) tags.push(`pos=${e.position}`);
            if (e.depth !== null) tags.push(`depth=${e.depth}`);
            lines.push(`${indent}  - [${e.world}/${e.uid}] ${e.title}${tags.length ? ' (' + tags.join(', ') + ')' : ''}`);
        }
    }
    lines.push(`${indent}prompt_order (${sub.promptKind ?? 'unknown'}, ${sub.promptCount ?? 0} items):`);
    if (!sub.promptOrder.length) {
        lines.push(`${indent}  (no prompt captured — generation may have aborted before assembly)`);
    } else {
        for (const line of sub.promptOrder) {
            lines.push(`${indent}  ${line}`);
        }
    }
    return lines;
}

function formatEntryAsLines(entry) {
    const lines = [];
    lines.push('='.repeat(80));
    lines.push(`[${entry.startedAt}] generation=${entry.generationType} context=${entry.context}`);
    if (entry.lastSpeaker) {
        lines.push(`  last_speaker: ${entry.lastSpeaker.name} (mes_id=${entry.lastSpeaker.mes_id})`);
    } else {
        lines.push('  last_speaker: (none)');
    }

    // Sub-generations: flatten when there's exactly one (typical for solo turns), expand
    // when there are multiple (group turns with re-routing).
    if (entry.subGenerations.length <= 1) {
        const sub = entry.subGenerations[0] ?? makeSubGeneration('none');
        for (const line of formatSubBody(sub, '  ')) lines.push(line);
    } else {
        lines.push(`  sub_generations (${entry.subGenerations.length}):`);
        for (let i = 0; i < entry.subGenerations.length; i++) {
            const sub = entry.subGenerations[i];
            lines.push(`    [#${i + 1}] (${sub.generationType}) started=${sub.startedAt}`);
            for (const line of formatSubBody(sub, '      ')) lines.push(line);
        }
    }

    if (entry.llmDecisionCalls.length) {
        lines.push(`  llm_decision_calls (${entry.llmDecisionCalls.length}):`);
        for (let i = 0; i < entry.llmDecisionCalls.length; i++) {
            const call = entry.llmDecisionCalls[i];
            lines.push('    ' + '-'.repeat(72));
            lines.push(`    [#${i + 1}] kind=${call.kind} profile=${call.profileId} captured=${call.capturedAt}`);
            if (call.error) {
                lines.push(`      error: ${call.error}`);
            }
            if (call.meta) {
                lines.push(`      meta: ${JSON.stringify(call.meta)}`);
            }
            if (call.parsed !== null && call.parsed !== undefined) {
                lines.push(`      parsed: ${JSON.stringify(call.parsed)}`);
            }
            lines.push('      --- prompt sent ---');
            for (const promptLine of String(call.prompt ?? '').split('\n')) {
                lines.push(`      | ${promptLine}`);
            }
            lines.push('      --- response received ---');
            for (const responseLine of String(call.response ?? '').split('\n')) {
                lines.push(`      | ${responseLine}`);
            }
        }
    }
    if (entry.notes.length) {
        lines.push('  notes:');
        for (const n of entry.notes) lines.push(`    - ${n}`);
    }
    return lines;
}

async function flushEntry() {
    if (!isEnabled() || !currentEntry) {
        currentEntry = null;
        return;
    }
    const entry = currentEntry;
    currentEntry = null;
    try {
        const lines = formatEntryAsLines(entry);
        await fetch('/api/debug-logs/append', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ filename: todayFilename(), lines }),
        });
    } catch (error) {
        console.warn('[debug-logger] failed to flush entry', error);
    }
}

/**
 * Wire the logger into the generation event lifecycle. Idempotent — safe to call once
 * during app boot.
 */
export function initDebugLogger() {
    eventSource.on(event_types.GROUP_WRAPPER_STARTED, () => {
        // Pre-router calls may have already created an entry; reuse it. Otherwise lazy.
        inGroupWrapper = true;
        ensureEntry();
    });
    eventSource.on(event_types.GROUP_WRAPPER_FINISHED, () => {
        inGroupWrapper = false;
        void flushEntry();
    });
    eventSource.on(event_types.GENERATION_STARTED, (type) => onGenerationStarted(type));
    eventSource.on(event_types.WORLD_INFO_ACTIVATED, (entries) => captureWorldInfo(entries));
    eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, (eventData) => captureChatCompletionPrompt(eventData));
    eventSource.on(event_types.GENERATE_AFTER_COMBINE_PROMPTS, (eventData) => captureTextCompletionPrompt(eventData));
    eventSource.on(event_types.LLM_DECISION_CALL, (payload) => captureLlmDecisionCall(payload));
    eventSource.on(event_types.GENERATION_ENDED, () => {
        // Inside a group wrapper, hold the entry open for re-poll router calls and the
        // next sub-Generate. The wrapper's FINISHED event flushes the whole turn.
        if (!inGroupWrapper) void flushEntry();
    });
    // Defensive: if generation is interrupted (stop button, abort), still flush what we have.
    eventSource.on(event_types.GENERATION_STOPPED, () => {
        inGroupWrapper = false;
        void flushEntry();
    });
}
