import { eventSource, event_types, extension_prompt_types, extension_prompt_roles, setExtensionPrompt, this_chid, characters } from '../../../script.js';
import { extension_settings } from '../../extensions.js';

const MODULE_NAME = 'world_forge_style_override';
const SETTINGS_KEY = 'world_forge';
const INJECTION_DEPTH = 0;

const PERSPECTIVE_PROSE = {
    first: 'Narrate in first-person past tense, focal on {{char}} this turn. The narrator speaks as {{char}}; other characters\' interiors are not directly accessible. Reference {{user}} by name or pronoun, never as "you" inside narration.',
    second: 'Narrate in second-person past tense, addressing {{char}} as "you". Render {{char}}\'s interior — thoughts, sensations, immediate reactions — but not other characters\' interiors. Reference {{user}} by name or pronoun, never as "you" inside narration; second-person address is reserved for {{char}}.',
    third_limited: 'Narrate in third-person limited past tense, focal on {{char}} this turn. The narrator sees {{char}}\'s interior — their thoughts, sensations, and immediate reactions — but not other characters\' interiors. {{user}} is referenced by name or pronoun and is never addressed as "you" inside narration; second-person address occurs only inside dialogue.',
    third_omniscient: 'Narrate in third-person omniscient past tense. {{char}} is the focal narrator for this turn — render the protagonists and NPCs as he/she/they; reference {{user}} by name or pronoun, never as "you" inside narration. The narrator may render any character\'s interior as the scene requires, may move freely between locations and points of view within a scene, and is not bound to any single character\'s knowledge state.',
};

const NARRATION_MARKER_PROSE = {
    asterisks_for_narration: '*Asterisks* delimit narration, action, and interior glimpses. "Double quotes" delimit spoken dialogue. **Double asterisks** delimit emphasis. No other formatting conventions apply.',
    asterisks_for_thoughts_only: 'Plain prose for narration and action. *Asterisks* delimit interior thoughts only. "Double quotes" delimit spoken dialogue. **Double asterisks** delimit emphasis.',
    plain_prose: 'Plain prose for narration and action with no asterisk markers. "Double quotes" delimit spoken dialogue. **Double asterisks** delimit emphasis.',
};

const HANDLERS = [
    { key: 'perspective_override', label: 'NARRATIVE PERSPECTIVE', table: PERSPECTIVE_PROSE },
    { key: 'narration_marker_override', label: 'FORMATTING MARKERS', table: NARRATION_MARKER_PROSE },
];

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
    if (!styleOverride || typeof styleOverride !== 'object') return { block: '', applied: [], skipped: [] };
    const lines = [];
    const applied = [];
    const skipped = [];
    for (const { key, label, table } of HANDLERS) {
        const value = styleOverride[key];
        if (value === null || value === undefined) continue;
        const directive = table[value];
        if (!directive) {
            skipped.push(`${key}=${value}`);
            continue;
        }
        lines.push(`${label}: ${directive}`);
        applied.push(`${key}=${value}`);
    }
    if (lines.length === 0) return { block: '', applied, skipped };
    return { block: `<style_override>\n${lines.join('\n')}\n</style_override>`, applied, skipped };
}

function clearInjection() {
    setExtensionPrompt(MODULE_NAME, '', extension_prompt_types.IN_PROMPT, INJECTION_DEPTH, false, extension_prompt_roles.SYSTEM);
}

function applyForActiveCharacter() {
    const settings = getSettings();
    if (!settings.enabled) {
        clearInjection();
        return;
    }
    const idx = this_chid;
    const character = (idx === undefined || idx === null) ? null : characters?.[idx];
    if (!character) {
        clearInjection();
        return;
    }
    const wf = character.data?.extensions?.world_forge;
    const styleOverride = wf?.style_override;
    const { block, applied, skipped } = buildOverrideBlock(styleOverride);
    setExtensionPrompt(MODULE_NAME, block, extension_prompt_types.IN_PROMPT, INJECTION_DEPTH, false, extension_prompt_roles.SYSTEM);

    if (settings.debug) {
        const tag = `[world-forge] ${character.name || `chid#${idx}`}`;
        if (block) {
            console.log(`${tag} → injected style_override (${applied.join(', ')})`);
        } else if (skipped.length) {
            console.warn(`${tag} → no override emitted; unknown enum values skipped: ${skipped.join(', ')}`);
        } else {
            console.log(`${tag} → no override`);
        }
    }
}

export function init() {
    getSettings();
    eventSource.on(event_types.GENERATION_STARTED, applyForActiveCharacter);
    eventSource.on(event_types.CHAT_CHANGED, clearInjection);
    console.log('[world-forge] runtime extension loaded');
}
