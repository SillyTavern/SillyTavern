/**
 * World Info Facade
 * This file re-exports all public API from the world-info module.
 * The implementation has been split into multiple files under ./world-info/
 */

// Re-export constants and enums
export {
    world_info_insertion_strategy,
    world_info_logic,
    scan_state,
    world_info_position,
    wi_anchor_position,
    DEFAULT_DEPTH,
    DEFAULT_WEIGHT,
    MAX_SCAN_DEPTH,
    SORT_ORDER_KEY,
    METADATA_KEY,
} from './world-info/constants.js';

// Re-export state variables and setters
export {
    world_info,
    selected_world_info,
    world_names,
    world_info_depth,
    world_info_min_activations,
    world_info_min_activations_depth_max,
    world_info_budget,
    world_info_include_names,
    world_info_recursive,
    world_info_overflow_alert,
    world_info_case_sensitive,
    world_info_match_whole_words,
    world_info_use_group_scoring,
    world_info_use_aho_corasick,
    world_info_character_strategy,
    world_info_budget_cap,
    world_info_max_recursion_steps,
    setWorldInfo,
    setSelectedWorldInfo,
    setWorldNames,
    setWorldInfoDepth,
    setWorldInfoMinActivations,
    setWorldInfoMinActivationsDepthMax,
    setWorldInfoBudget,
    setWorldInfoIncludeNames,
    setWorldInfoRecursive,
    setWorldInfoOverflowAlert,
    setWorldInfoCaseSensitive,
    setWorldInfoMatchWholeWords,
    setWorldInfoUseGroupScoring,
    setWorldInfoUseAhoCorasick,
    setWorldInfoCharacterStrategy,
    setWorldInfoBudgetCap,
    setWorldInfoMaxRecursionSteps,
    saveSettingsDebounced,
    sortFn,
} from './world-info/state.js';

// Re-export classes
export { WorldInfoBuffer } from './world-info/WorldInfoBuffer.js';
export { WorldInfoTimedEffects } from './world-info/WorldInfoTimedEffects.js';

// Re-export settings functions
export {
    getWorldInfoSettings,
    updateWorldInfoSettings,
    setWorldInfoSettings,
} from './world-info/settings.js';

// Re-export editor functions
export {
    worldInfoFilter,
    showWorldEditor,
    hideWorldEditor,
    displayWorldEntries,
    reloadEditor,
    sortWorldInfoEntries,
    getWorldEntry,
} from './world-info/editor/index.js';

// Re-export entry functions
export {
    newWorldInfoEntryDefinition,
    newWorldInfoEntryTemplate,
    createWorldInfoEntry,
    duplicateWorldInfoEntry,
    deleteWorldInfoEntry,
    originalWIDataKeyMap,
    setWIOriginalDataValue,
    deleteWIOriginalDataValue,
} from './world-info/entry/index.js';

// Re-export persistence functions
export {
    worldInfoCache,
    loadWorldInfo,
    saveWorldInfo,
    deleteWorldInfo,
    renameWorldInfo,
    updateWorldInfoList,
    createNewWorldInfo,
} from './world-info/persistence/index.js';

// Re-export scanning functions
export {
    checkWorldInfo,
    getWorldInfoPrompt,
    getSortedEntries,
    acCacheManager,
} from './world-info/scanning/index.js';

// Re-export utilities
export {
    parseRegexFromString,
    splitKeywordsAndRegexes,
    getFreeWorldEntryUid,
    getFreeWorldName,
} from './world-info/utilities.js';

// Re-export converters
export {
    convertCharacterBook,
} from './world-info/converters.js';

// Re-export integration functions
export {
    setWorldInfoButtonClass,
    checkEmbeddedWorld,
    importEmbeddedWorldInfo,
    onWorldInfoChange,
    importWorldInfo,
    openWorldInfoEditor,
    assignLorebookToChat,
    moveWorldInfoEntry,
    charUpdatePrimaryWorld,
    charUpdateAddAuxWorld,
    charSetAuxWorlds,
} from './world-info/integration.js';

// Re-export initialization
export { initWorldInfo } from './world-info/initialization.js';
