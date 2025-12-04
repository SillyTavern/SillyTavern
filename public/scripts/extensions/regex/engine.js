import { characters, saveSettingsDebounced, substituteParams, substituteParamsExtended, this_chid } from '../../../script.js';
import { extension_settings, writeExtensionField } from '../../extensions.js';
import { getPresetManager } from '../../preset-manager.js';
import { regexFromString } from '../../utils.js';
import { lodash } from '../../../lib.js';

/**
 * @readonly
 * @enum {number} Regex scripts types
 */
export const SCRIPT_TYPES = {
    // ORDER MATTERS: defines the regex script priority
    GLOBAL: 0,
    PRESET: 2,
    SCOPED: 1,
};

/**
 * Special type for unknown/invalid script types.
 */
export const SCRIPT_TYPE_UNKNOWN = -1;

/**
 * @typedef {import('../../char-data.js').RegexScriptData} RegexScript
 */

/**
 * @typedef {object} GetRegexScriptsOptions
 * @property {boolean} allowedOnly Only return allowed scripts
 */

/**
 * @type {Readonly<GetRegexScriptsOptions>}
 */
const DEFAULT_GET_REGEX_SCRIPTS_OPTIONS = Object.freeze({ allowedOnly: false });

/**
 * Manages the compiled regex cache with LRU eviction.
 */
export class RegexProvider {
    /** @type {Map<string, RegExp>} */
    #cache = new Map();
    /** @type {number} */
    // Increased capacity to improve cache hit rate in large rule sets.
    // Memory vs speed trade-off: fewer recompilations under heavy usage.
    #maxSize = 1000;

    static instance = new RegexProvider();

    /**
     * Gets a regex instance by its string representation.
     * @param {string} regexString The regex string to retrieve
     * @returns {RegExp?} Compiled regex or null if invalid
     */
    get(regexString) {
        const existed = this.#cache.has(regexString);
        const regex = existed
            ? this.#cache.get(regexString)
            : regexFromString(regexString);

        if (!regex) {
            return null;
        }

        // LRU policy details:
        // - Hit: re-insert to mark as most-recently-used without changing size
        // - Miss: evict the oldest BEFORE inserting when at capacity
        // This keeps effective capacity equal to #maxSize
        if (existed) {
            this.#cache.delete(regexString);
            this.#cache.set(regexString, regex);
        } else {
            // Evict oldest BEFORE adding to keep size at max capacity
            if (this.#cache.size >= this.#maxSize) {
                const firstKey = this.#cache.keys().next().value;
                this.#cache.delete(firstKey);
            }
            this.#cache.set(regexString, regex);
        }

        // Reset lastIndex for global/sticky regexes
        if (regex.global || regex.sticky) {
            regex.lastIndex = 0;
        }

        return regex;
    }

    /**
     * Clears the entire cache.
     */
    clear() {
        this.#cache.clear();
    }
}

// Detect capture group references inside replacement templates:
// - "$1", "$2", ... numbered references
// - "$<name>" named references
const groupRefRegex = /(\$(\d+))|\$<([^>]+)>/g;
// Cache execution plans per script and override context
// Key: script id (or content hash) + characterOverride
// Value: precomputed structures (tokens, trim regex, flags) to minimize per-match work
const scriptExecCache = new Map();

/**
 * Retrieves the list of regex scripts by combining the scripts from the extension settings and the character data
 *
 * @param {GetRegexScriptsOptions} options Options for retrieving the regex scripts
 * @returns {RegexScript[]} An array of regex scripts, where each script is an object containing the necessary information.
 */
// Scripts cache and context tracking to reduce recomposition overhead
// These caches store the composed script arrays for the current UI context.
// Context keys include: selected character (chid), character reference, preset API, and preset name.
// When any of these change, caches are invalidated to ensure fresh script lists.
let scriptsCacheAll = null;
let scriptsCacheAllowed = null;
let lastContext = {
    chid: undefined,
    characterRef: undefined,
    presetApi: null,
    presetName: null,
};

export function invalidateScriptsCache() {
    // Clear both caches so subsequent calls rebuild script arrays for the new context
    scriptsCacheAll = null;
    scriptsCacheAllowed = null;
}

export function getRegexScripts(options = DEFAULT_GET_REGEX_SCRIPTS_OPTIONS, characterOverride = null) {
    let currentChid = this_chid;

    if (characterOverride) {
        // Map avatar override to a temporary chid for script selection
        // This allows running scripts in the context of another character without switching UI state
        const overrideId = characters.findIndex(c => c.avatar === characterOverride);
        if (overrideId !== -1) {
            currentChid = String(overrideId);
        }
    }

    const currentCharacterRef = characters?.[currentChid];
    const currentPresetApi = getCurrentPresetAPI();
    const currentPresetName = getCurrentPresetName();

    // If not using override and context changed, invalidate caches to rebuild script arrays
    if (
        !characterOverride && (
            currentChid !== lastContext.chid ||
            currentCharacterRef !== lastContext.characterRef ||
            currentPresetApi !== lastContext.presetApi ||
            currentPresetName !== lastContext.presetName
        )
    ) {
        invalidateScriptsCache();
        lastContext = {
            chid: currentChid,
            characterRef: currentCharacterRef,
            presetApi: currentPresetApi,
            presetName: currentPresetName,
        };
    }

    if (characterOverride) {
        return [...Object.values(SCRIPT_TYPES).flatMap(type => getScriptsByType(type, options, currentChid))];
    }

    if (options.allowedOnly) {
        if (!scriptsCacheAllowed) {
            scriptsCacheAllowed = [...Object.values(SCRIPT_TYPES).flatMap(type => getScriptsByType(type, options, currentChid))];
        }
        return scriptsCacheAllowed;
    }

    if (!scriptsCacheAll) {
        scriptsCacheAll = [...Object.values(SCRIPT_TYPES).flatMap(type => getScriptsByType(type, options, currentChid))];
    }
    return scriptsCacheAll;
}

/**
 * Retrieves the regex scripts for a specific type.
 * @param {SCRIPT_TYPES} scriptType The type of regex scripts to retrieve.
 * @param {GetRegexScriptsOptions} options Options for retrieving the regex scripts
 * @returns {RegexScript[]} An array of regex scripts for the specified type.
 */
// `targetChid` allows selecting scripts for a specific character (used by overrides)
export function getScriptsByType(scriptType, { allowedOnly } = DEFAULT_GET_REGEX_SCRIPTS_OPTIONS, targetChid = this_chid) {
    switch (scriptType) {
        case SCRIPT_TYPE_UNKNOWN:
            return [];
        case SCRIPT_TYPES.GLOBAL:
            return extension_settings.regex ?? [];
        case SCRIPT_TYPES.SCOPED: {
            // Respect per-character allow-list when returning scoped scripts
            if (allowedOnly && !extension_settings?.character_allowed_regex?.includes(characters?.[targetChid]?.avatar)) {
                return [];
            }
            const scopedScripts = characters[targetChid]?.data?.extensions?.regex_scripts;
            return Array.isArray(scopedScripts) ? scopedScripts : [];
        }
        case SCRIPT_TYPES.PRESET: {
            // Respect per-preset allow-list when returning preset scripts
            if (allowedOnly && !extension_settings?.preset_allowed_regex?.[getCurrentPresetAPI()]?.includes(getCurrentPresetName())) {
                return [];
            }
            const presetManager = getPresetManager();
            const presetScripts = presetManager?.readPresetExtensionField({ path: 'regex_scripts' });
            return Array.isArray(presetScripts) ? presetScripts : [];
        }
        default:
            console.warn(`getScriptsByType: Invalid script type ${scriptType}`);
            return [];
    }
}

/**
 * Saves an array of regex scripts for a specific type.
 * @param {RegexScript[]} scripts An array of regex scripts to save.
 * @param {SCRIPT_TYPES} scriptType The type of regex scripts to save.
 * @returns {Promise<void>}
 */
export async function saveScriptsByType(scripts, scriptType) {
    switch (scriptType) {
        case SCRIPT_TYPES.GLOBAL:
            extension_settings.regex = scripts;
            // Global scripts are stored in extension_settings; invalidate caches so UI sees updated lists
            invalidateScriptsCache();
            saveSettingsDebounced();
            break;
        case SCRIPT_TYPES.SCOPED:
            await writeExtensionField(this_chid, 'regex_scripts', scripts);
            // Scoped scripts changed; invalidate caches for correct per-character lists
            invalidateScriptsCache();
            break;
        case SCRIPT_TYPES.PRESET: {
            const presetManager = getPresetManager();
            await presetManager.writePresetExtensionField({ path: 'regex_scripts', value: scripts });
            // Preset scripts changed; invalidate caches for correct per-preset lists
            invalidateScriptsCache();
            break;
        }
        default:
            console.warn(`saveScriptsByType: Invalid script type ${scriptType}`);
            break;
    }
}

/**
 * Check if character's regexes are allowed to be used; if character is undefined, returns false
 * @param {Character|undefined} character
 * @returns {boolean}
 */
export function isScopedScriptsAllowed(character) {
    return !!extension_settings?.character_allowed_regex?.includes(character?.avatar);
}

/**
 * Allow character's regexes to be used; if character is undefined, do nothing
 * @param {Character|undefined} character
 * @returns {void}
 */
export function allowScopedScripts(character) {
    const avatar = character?.avatar;
    if (!avatar) {
        return;
    }
    if (!Array.isArray(extension_settings?.character_allowed_regex)) {
        extension_settings.character_allowed_regex = [];
    }
    if (!extension_settings.character_allowed_regex.includes(avatar)) {
        extension_settings.character_allowed_regex.push(avatar);
        // Allow-list updated; invalidate caches so scoped scripts become visible
        invalidateScriptsCache();
        saveSettingsDebounced();
    }
}

/**
 * Disallow character's regexes to be used; if character is undefined, do nothing
 * @param {Character|undefined} character
 * @returns {void}
 */
export function disallowScopedScripts(character) {
    const avatar = character?.avatar;
    if (!avatar) {
        return;
    }
    if (!Array.isArray(extension_settings?.character_allowed_regex)) {
        return;
    }
    const index = extension_settings.character_allowed_regex.indexOf(avatar);
    if (index !== -1) {
        extension_settings.character_allowed_regex.splice(index, 1);
        // Allow-list updated; invalidate caches so scoped scripts are hidden
        invalidateScriptsCache();
        saveSettingsDebounced();
    }
}

/**
 * Check if preset's regexes are allowed to be used
 * @param {string} apiId API ID
 * @param {string} presetName Preset name
 * @returns {boolean} True if allowed, false if not
 */
export function isPresetScriptsAllowed(apiId, presetName) {
    if (!apiId || !presetName) {
        return false;
    }
    return !!extension_settings?.preset_allowed_regex?.[apiId]?.includes(presetName);
}

/**
 * Allow preset's regexes to be used
 * @param {string} apiId API ID
 * @param {string} presetName Preset name
 * @returns {void}
 */
export function allowPresetScripts(apiId, presetName) {
    if (!apiId || !presetName) {
        return;
    }
    if (!Array.isArray(extension_settings?.preset_allowed_regex?.[apiId])) {
        lodash.set(extension_settings, ['preset_allowed_regex', apiId], []);
    }
    if (!extension_settings.preset_allowed_regex[apiId].includes(presetName)) {
        extension_settings.preset_allowed_regex[apiId].push(presetName);
        // Allow-list updated; invalidate caches so preset scripts become visible
        invalidateScriptsCache();
        saveSettingsDebounced();
    }
}

/**
 * Disallow preset's regexes to be used
 * @param {string} apiId API ID
 * @param {string} presetName Preset name
 * @returns {void}
 */
export function disallowPresetScripts(apiId, presetName) {
    if (!apiId || !presetName) {
        return;
    }
    if (!Array.isArray(extension_settings?.preset_allowed_regex?.[apiId])) {
        return;
    }
    const index = extension_settings.preset_allowed_regex[apiId].indexOf(presetName);
    if (index !== -1) {
        extension_settings.preset_allowed_regex[apiId].splice(index, 1);
        // Allow-list updated; invalidate caches so preset scripts are hidden
        invalidateScriptsCache();
        saveSettingsDebounced();
    }
}

/**
 * Gets the current API ID from the preset manager.
 * @returns {string|null} Current API ID, or null if no preset manager
 */
export function getCurrentPresetAPI() {
    return getPresetManager()?.apiId ?? null;
}

/**
 * Gets the name of the currently selected preset.
 * @returns {string|null} The name of the currently selected preset, or null if no preset manager
 */
export function getCurrentPresetName() {
    return getPresetManager()?.getSelectedPresetName() ?? null;
}

/**
 * @readonly
 * @enum {number} Where the regex script should be applied
 */
export const regex_placement = {
    /**
     * @deprecated MD Display is deprecated. Do not use.
     */
    MD_DISPLAY: 0,
    USER_INPUT: 1,
    AI_OUTPUT: 2,
    SLASH_COMMAND: 3,
    // 4 - sendAs (legacy)
    WORLD_INFO: 5,
    REASONING: 6,
};

/**
 * @readonly
 * @enum {number} How to substitute parameters in the find regex
 */
export const substitute_find_regex = {
    NONE: 0,
    RAW: 1,
    ESCAPED: 2,
};

function sanitizeRegexMacro(x) {
    return (x && typeof x === 'string') ?
        x.replaceAll(/[\n\r\t\v\f\0.^$*+?{}[\]\\/|()]/gs, function (s) {
            switch (s) {
                case '\n':
                    return '\\n';
                case '\r':
                    return '\\r';
                case '\t':
                    return '\\t';
                case '\v':
                    return '\\v';
                case '\f':
                    return '\\f';
                case '\0':
                    return '\\0';
                default:
                    return '\\' + s;
            }
        }) : x;
}

/**
 * Parent function to fetch a regexed version of a raw string
 * @param {string} rawString The raw string to be regexed
 * @param {regex_placement} placement The placement of the string
 * @param {RegexParams} params The parameters to use for the regex script
 * @returns {string} The regexed string
 * @typedef {{characterOverride?: string, isMarkdown?: boolean, isPrompt?: boolean, isEdit?: boolean, depth?: number }} RegexParams The parameters to use for the regex script
 */
export function getRegexedString(rawString, placement, { characterOverride, isMarkdown, isPrompt, isEdit, depth } = {}) {
    // WTF have you passed me?
    if (typeof rawString !== 'string') {
        console.warn('getRegexedString: rawString is not a string. Returning empty string.');
        return '';
    }

    let finalString = rawString;
    if (extension_settings.disabledExtensions.includes('regex') || !rawString || placement === undefined) {
        return finalString;
    }

    // Iterate with early exits to reduce overhead:
    // 1) Early filter by placement
    // 2) Short-circuit scenario flags (markdown/prompt)
    // 3) Skip non-editable on edit, and depth out of range
    const allRegex = getRegexScripts({ allowedOnly: true }, characterOverride);
    for (let i = 0; i < allRegex.length; i++) {
        const script = allRegex[i];

        if (!Array.isArray(script?.placement) || !script.placement.includes(placement)) {
            continue;
        }

        const applies =
            (script.markdownOnly && isMarkdown) ||
            (script.promptOnly && isPrompt) ||
            (!script.markdownOnly && !script.promptOnly && !isMarkdown && !isPrompt);

        if (!applies) {
            continue;
        }

        if (isEdit && !script.runOnEdit) {
            continue;
        }

        if (typeof depth === 'number') {
            if (!isNaN(script.minDepth) && script.minDepth !== null && script.minDepth >= -1 && depth < script.minDepth) {
                continue;
            }

            if (!isNaN(script.maxDepth) && script.maxDepth !== null && script.maxDepth >= 0 && depth > script.maxDepth) {
                continue;
            }
        }

        // Apply this script; output becomes input for the next script to preserve ordering
        finalString = runRegexScript(script, finalString, { characterOverride });
    }

    return finalString;
}

function getExecPlan(regexScript, characterOverride) {
    // Build a stable cache key; prefer script id when available
    const key = (regexScript.id ? String(regexScript.id) : JSON.stringify({ fr: regexScript.findRegex, rs: regexScript.replaceString, ts: regexScript.trimStrings, sr: regexScript.substituteRegex })) + '|' + (characterOverride || '');
    const cached = scriptExecCache.get(key);
    if (cached) return cached;
    // Normalize match macro to "$0" so downstream handling is uniform
    const preparedReplaceString = regexScript.replaceString ? regexScript.replaceString.replace(/\{\{match\}\}/gi, '$0') : '';
    const preparedTrimStrings = Array.isArray(regexScript.trimStrings)
        ? regexScript.trimStrings.map((trimString) => substituteParams(trimString, undefined, characterOverride))
        : [];
    // Feature flags guiding fast paths
    const hasGroupRefs = /(\$\d+)|\$<[^>]+>/.test(preparedReplaceString);
    const needsSubstitution = /\{\{[^}]+\}\}/.test(preparedReplaceString);
    // Compile a single alternation for trimming, reducing multiple replaceAll calls
    const trimAlternation = preparedTrimStrings.filter(Boolean).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const trimRegex = trimAlternation ? new RegExp(trimAlternation, 'g') : null;
    const isNoOp = !needsSubstitution && !hasGroupRefs && preparedTrimStrings.length === 0 && preparedReplaceString === '$0';
    // Tokenize template once: literals + numbered/named references
    let tokens = null;
    if (hasGroupRefs) {
        const re = new RegExp(groupRefRegex.source, groupRefRegex.flags);
        tokens = [];
        let last = 0;
        let m;
        while ((m = re.exec(preparedReplaceString)) !== null) {
            const idx = m.index;
            if (idx > last) {
                tokens.push({ t: 'lit', v: preparedReplaceString.slice(last, idx) });
            }
            if (m[2]) {
                tokens.push({ t: 'num', i: Number(m[2]) });
            } else if (m[3]) {
                tokens.push({ t: 'name', n: m[3] });
            }
            last = idx + m[0].length;
        }
        if (last < preparedReplaceString.length) {
            tokens.push({ t: 'lit', v: preparedReplaceString.slice(last) });
        }
    }
    // Execution plan summary:
    // - preparedReplaceString: normalized template
    // - preparedTrimStrings: expanded per override
    // - hasGroupRefs / needsSubstitution: decide fast paths
    // - trimRegex: one-pass trimming regex
    // - isNoOp: skip entirely if template equals original
    // - tokens: pre-parsed segments for fast emission
    const plan = { preparedReplaceString, preparedTrimStrings, hasGroupRefs, needsSubstitution, trimRegex, isNoOp, tokens };
    scriptExecCache.set(key, plan);
    return plan;
}

/**
 * Runs the provided regex script on the given string
 * @param {RegexScript} regexScript The regex script to run
 * @param {string} rawString The string to run the regex script on
 * @param {RegexScriptParams} params The parameters to use for the regex script
 * @returns {string} The new string
 * @typedef {{characterOverride?: string}} RegexScriptParams The parameters to use for the regex script
 */
export function runRegexScript(regexScript, rawString, { characterOverride } = {}) {
    let newString = rawString;
    if (!regexScript || !!(regexScript.disabled) || !regexScript?.findRegex || !rawString) {
        return newString;
    }

    const getRegexString = () => {
        switch (Number(regexScript.substituteRegex)) {
            case substitute_find_regex.NONE:
                return regexScript.findRegex;
            case substitute_find_regex.RAW:
                return substituteParamsExtended(regexScript.findRegex);
            case substitute_find_regex.ESCAPED:
                return substituteParamsExtended(regexScript.findRegex, {}, sanitizeRegexMacro);
            default:
                console.warn(`runRegexScript: Unknown substituteRegex value ${regexScript.substituteRegex}. Using raw regex.`);
                return regexScript.findRegex;
        }
    };
    const regexString = getRegexString();
    const findRegex = RegexProvider.instance.get(regexString);

    // Retrieve precomputed execution plan for this script/context
    const { preparedReplaceString, hasGroupRefs, needsSubstitution, trimRegex, isNoOp, tokens } = getExecPlan(regexScript, characterOverride);

    // The user skill issued. Return with nothing.
    if (!findRegex) {
        return newString;
    }

    // Fast path: no-op rule ("$0" without macros or trimming)
    if (isNoOp) {
        return newString;
    }

    // Fast path: constant replacement without callback
    if (!hasGroupRefs && !needsSubstitution && !trimRegex) {
        return rawString.replace(findRegex, preparedReplaceString);
    }
    // General path: emit via tokens, trim once per captured value, conditionally apply macros
    newString = rawString.replace(findRegex, function (...args) {
        const lastArg = args[args.length - 1];
        let out = preparedReplaceString;
        if (tokens) {
            let buf = '';
            for (let i = 0; i < tokens.length; i++) {
                const tk = tokens[i];
                if (tk.t === 'lit') {
                    buf += tk.v;
                } else if (tk.t === 'num') {
                    let m = args[tk.i] || '';
                    if (m && trimRegex) m = m.replace(trimRegex, '');
                    buf += m;
                } else {
                    const groups = lastArg && typeof lastArg === 'object' ? lastArg : null;
                    let m = (groups && groups[tk.n]) || '';
                    if (m && trimRegex) m = m.replace(trimRegex, '');
                    buf += m;
                }
            }
            out = buf;
        }
        // Macro substitution only when present to avoid unnecessary work
        return needsSubstitution ? substituteParams(out) : out;
    });

    return newString;
}

/**
 * Filters anything to trim from the regex match
 * @param {string} rawString The raw string to filter
 * @param {string[]} trimStrings The strings to trim
 * @param {RegexScriptParams} params The parameters to use for the regex filter
 * @returns {string} The filtered string
 */
// Legacy filterString removed: trimming now uses a compiled alternation (trimRegex)
// inside the replacement callback, minimizing repeated passes.
