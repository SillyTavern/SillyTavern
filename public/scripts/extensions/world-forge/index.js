import { eventSource, event_types, this_chid, characters, substituteParams } from '../../../script.js';
import { extension_settings } from '../../extensions.js';

const SETTINGS_KEY = 'world_forge';
const STYLE_CONTRACT_CLOSE = '</style_contract>';

function getSettings() {
    if (!extension_settings[SETTINGS_KEY] || typeof extension_settings[SETTINGS_KEY] !== 'object') {
        extension_settings[SETTINGS_KEY] = {};
    }
    const s = extension_settings[SETTINGS_KEY];
    if (typeof s.enabled !== 'boolean') s.enabled = true;
    if (typeof s.debug !== 'boolean') s.debug = true;
    return s;
}

function buildOverrideBlock(styleOverride) {
    if (!styleOverride || typeof styleOverride !== 'object') {
        return { block: '', applied: [], skipped: [] };
    }

    const directives = Array.isArray(styleOverride.directives)
        ? styleOverride.directives.filter(s => typeof s === 'string' && s.trim().length > 0)
        : [];

    if (directives.length === 0) {
        return { block: '', applied: [], skipped: [] };
    }

    const applied = directives.map(line => {
        const colonIdx = line.indexOf(':');
        return colonIdx > 0 ? line.slice(0, colonIdx).trim() : line;
    });

    return {
        block: `<style_override>\n${directives.join('\n')}\n</style_override>`,
        applied,
        skipped: [],
    };
}

function getActiveCharacter() {
    const idx = this_chid;
    if (idx === undefined || idx === null) return null;
    return characters?.[idx] ?? null;
}

function spliceOverrideIntoChat(chat, block) {
    if (!Array.isArray(chat)) return false;
    for (const msg of chat) {
        if (!msg || msg.role !== 'system' || typeof msg.content !== 'string') continue;
        const anchor = msg.content.indexOf(STYLE_CONTRACT_CLOSE);
        if (anchor === -1) continue;
        const insertAt = anchor + STYLE_CONTRACT_CLOSE.length;
        msg.content = msg.content.slice(0, insertAt) + '\n\n' + block + msg.content.slice(insertAt);
        return true;
    }
    return false;
}

function onChatCompletionPromptReady(eventData) {
    const settings = getSettings();
    if (!settings.enabled) return;
    if (!eventData || eventData.dryRun) return;

    const character = getActiveCharacter();
    if (!character) return;

    const styleOverride = character.data?.extensions?.world_forge?.style_override;
    const { block, applied, skipped } = buildOverrideBlock(styleOverride);
    const tag = `[world-forge] ${character.name || `chid#${this_chid}`}`;

    if (!block) {
        if (settings.debug) {
            if (skipped.length) console.warn(`${tag} → no override emitted; unknown enum values: ${skipped.join(', ')}`);
            else console.log(`${tag} → no override`);
        }
        return;
    }

    const resolvedBlock = substituteParams(block);
    const inserted = spliceOverrideIntoChat(eventData.chat, resolvedBlock);
    if (settings.debug) {
        if (inserted) console.log(`${tag} → injected style_override after </style_contract> (${applied.join(', ')})`);
        else console.warn(`${tag} → override built but no </style_contract> marker found in any system message; nothing injected`);
    }
}

export function init() {
    getSettings();
    eventSource.on(event_types.CHAT_COMPLETION_PROMPT_READY, onChatCompletionPromptReady);
    console.log('[world-forge] runtime extension loaded');
}
