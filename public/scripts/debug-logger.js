import { chat, eventSource, event_types, getRequestHeaders, this_chid, characters, name1 } from '../script.js';
import { power_user } from './power-user.js';
import { selected_group, groups } from './group-chats.js';

/**
 * Lightweight per-generation debug logger that writes one entry per turn to a daily
 * file under the user's Logs_Debug directory. Captures only structural metadata
 * (last speaker, activated lorebook entries, prompt section order) — not the full
 * prompt content — so the file stays small and human-scannable.
 *
 * Activated by the "Debug log to file" checkbox in User Settings.
 */

/** @type {object|null} Currently-building entry, or null between generations */
let currentEntry = null;

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

/**
 * Resets and starts a new log entry. Idempotent: if a previous one was never flushed
 * (e.g. generation aborted mid-flight), it's discarded.
 */
function startEntry(generationType) {
    if (!isEnabled()) return;
    currentEntry = {
        startedAt: nowIso(),
        generationType: String(generationType ?? 'normal'),
        context: getCurrentContextLabel(),
        lastSpeaker: getLastSpeaker(),
        worldInfoEntries: [],
        promptOrder: [],
        notes: [],
    };
}

function captureWorldInfo(entries) {
    if (!isEnabled() || !currentEntry) return;
    if (!Array.isArray(entries)) return;
    for (const entry of entries) {
        currentEntry.worldInfoEntries.push({
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

/**
 * Capture the chat completion prompt order. Fired by the openai pipeline.
 */
function captureChatCompletionPrompt(eventData) {
    if (!isEnabled() || !currentEntry) return;
    const messages = Array.isArray(eventData?.chat) ? eventData.chat : [];
    currentEntry.promptOrder = messages.map((m, i) => `${String(i + 1).padStart(2, '0')}. ${describeChatCompletionMessage(m)}`);
    currentEntry.promptKind = 'chat-completion';
    currentEntry.promptCount = messages.length;
}

/**
 * Capture the text completion combined-prompt. Fires for non-OpenAI APIs. We only
 * have a single combined string, so split on the major SillyTavern section markers
 * to give a rough sense of order.
 */
function captureTextCompletionPrompt(eventData) {
    if (!isEnabled() || !currentEntry) return;
    if (currentEntry.promptOrder.length > 0) return; // already captured via chat-completion path
    const prompt = String(eventData?.prompt ?? '');
    if (!prompt) return;
    // Sniff for common section markers SillyTavern emits in the assembled text-completion prompt.
    const markerLines = prompt.split('\n').filter(line => /^(?:###|##|---|\[Start a new Chat\]|<[A-Za-z_]+>|Persona:|Scenario:|Personality:|Description:|World Info:|Author's Note:|Example:)/.test(line));
    currentEntry.promptKind = 'text-completion';
    currentEntry.promptCount = prompt.length;
    currentEntry.promptOrder = markerLines.slice(0, 60).map((line, i) => `${String(i + 1).padStart(2, '0')}. ${line.trim().slice(0, 100)}`);
    if (markerLines.length === 0) {
        currentEntry.notes.push('text-completion prompt: no recognized section markers');
    }
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
    lines.push(`  world_info_injected (${entry.worldInfoEntries.length}):`);
    if (entry.worldInfoEntries.length === 0) {
        lines.push('    (none)');
    } else {
        for (const e of entry.worldInfoEntries) {
            const tags = [];
            if (e.constant) tags.push('constant');
            if (e.position !== null) tags.push(`pos=${e.position}`);
            if (e.depth !== null) tags.push(`depth=${e.depth}`);
            lines.push(`    - [${e.world}/${e.uid}] ${e.title}${tags.length ? ' (' + tags.join(', ') + ')' : ''}`);
        }
    }
    lines.push(`  prompt_order (${entry.promptKind ?? 'unknown'}, ${entry.promptCount ?? 0} items):`);
    if (!entry.promptOrder.length) {
        lines.push('    (no prompt captured — generation may have aborted before assembly)');
    } else {
        for (const line of entry.promptOrder) {
            lines.push(`    ${line}`);
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
    eventSource.on(event_types.GENERATION_STARTED, (type) => startEntry(type));
    eventSource.on(event_types.WORLD_INFO_ACTIVATED, (entries) => captureWorldInfo(entries));
    eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, (eventData) => captureChatCompletionPrompt(eventData));
    eventSource.on(event_types.GENERATE_AFTER_COMBINE_PROMPTS, (eventData) => captureTextCompletionPrompt(eventData));
    eventSource.on(event_types.GENERATION_ENDED, () => { void flushEntry(); });
    // Defensive: if generation is interrupted (stop button, abort), still flush what we have.
    eventSource.on(event_types.GENERATION_STOPPED, () => { void flushEntry(); });
}
