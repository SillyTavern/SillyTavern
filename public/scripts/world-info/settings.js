/**
 * World Info Settings
 * Contains functions for getting, updating, and setting world info settings.
 */

import { eventSource, event_types } from '../../script.js';
import { accountStorage } from '../util/AccountStorage.js';
import { SORT_ORDER_KEY, METADATA_KEY } from './constants.js';
import {
    world_info,
    world_info_depth,
    world_info_min_activations,
    world_info_min_activations_depth_max,
    world_info_budget,
    world_info_include_names,
    world_info_recursive,
    world_info_overflow_alert,
    world_info_case_sensitive,
    world_info_match_whole_words,
    world_info_character_strategy,
    world_info_budget_cap,
    world_info_use_group_scoring,
    world_info_use_aho_corasick,
    world_info_max_recursion_steps,
    selected_world_info,
    world_names,
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
} from './state.js';
import { WorldInfoBuffer } from './WorldInfoBuffer.js';
import { getSortedEntries } from './scanning/entry-collection.js';
import { getEntryId } from './pure-functions.js';

/**
 * Gets the current world info settings.
 * @returns {object} The world info settings object
 */
export function getWorldInfoSettings() {
    return {
        world_info,
        world_info_depth,
        world_info_min_activations,
        world_info_min_activations_depth_max,
        world_info_budget,
        world_info_include_names,
        world_info_recursive,
        world_info_overflow_alert,
        world_info_case_sensitive,
        world_info_match_whole_words,
        world_info_character_strategy,
        world_info_budget_cap,
        world_info_use_group_scoring,
        world_info_use_aho_corasick,
        world_info_max_recursion_steps,
    };
}

/**
 * Updates the world info settings.
 * @param {object} settings - Settings object
 * @param {string[]} [activeWorldInfo] - Optional array of active world info names
 */
export function updateWorldInfoSettings(settings, activeWorldInfo) {
    console.debug('[WI] Updating world info settings', settings, activeWorldInfo);

    /** @type {Record<string, (value: any) => void>} */
    const fields = {
        world_info_depth: (value) => setWorldInfoDepth(value),
        world_info_min_activations: (value) => setWorldInfoMinActivations(value),
        world_info_min_activations_depth_max: (value) => setWorldInfoMinActivationsDepthMax(value),
        world_info_budget: (value) => setWorldInfoBudget(value),
        world_info_include_names: (value) => setWorldInfoIncludeNames(value),
        world_info_recursive: (value) => setWorldInfoRecursive(value),
        world_info_overflow_alert: (value) => setWorldInfoOverflowAlert(value),
        world_info_case_sensitive: (value) => setWorldInfoCaseSensitive(value),
        world_info_match_whole_words: (value) => setWorldInfoMatchWholeWords(value),
        world_info_character_strategy: (value) => setWorldInfoCharacterStrategy(value),
        world_info_budget_cap: (value) => setWorldInfoBudgetCap(value),
        world_info_use_group_scoring: (value) => setWorldInfoUseGroupScoring(value),
        world_info_use_aho_corasick: (value) => setWorldInfoUseAhoCorasick(value),
        world_info_max_recursion_steps: (value) => setWorldInfoMaxRecursionSteps(value),
        // Unused
        world_info: (_value) => {},
    };

    for (const [key, setter] of Object.entries(fields)) {
        if (Object.hasOwn(settings, key)) {
            setter(settings[key]);
        }
    }

    if (Array.isArray(activeWorldInfo)) {
        delete settings.world_info;
        setSelectedWorldInfo(activeWorldInfo);
    }

    saveSettingsDebounced();
}

/**
 * Sets the world info settings from loaded data.
 * @param {object} settings - The settings object
 * @param {object} data - The data object containing world names
 */
export function setWorldInfoSettings(settings, data) {
    if (settings.world_info_depth !== undefined)
        setWorldInfoDepth(settings.world_info_depth);
    if (settings.world_info_min_activations !== undefined)
        setWorldInfoMinActivations(settings.world_info_min_activations);
    if (settings.world_info_min_activations_depth_max !== undefined)
        setWorldInfoMinActivationsDepthMax(settings.world_info_min_activations_depth_max);
    if (settings.world_info_budget !== undefined)
        setWorldInfoBudget(settings.world_info_budget);
    if (settings.world_info_include_names !== undefined)
        setWorldInfoIncludeNames(settings.world_info_include_names);
    if (settings.world_info_recursive !== undefined)
        setWorldInfoRecursive(settings.world_info_recursive);
    if (settings.world_info_overflow_alert !== undefined)
        setWorldInfoOverflowAlert(settings.world_info_overflow_alert);
    if (settings.world_info_case_sensitive !== undefined)
        setWorldInfoCaseSensitive(settings.world_info_case_sensitive);
    if (settings.world_info_match_whole_words !== undefined)
        setWorldInfoMatchWholeWords(settings.world_info_match_whole_words);
    if (settings.world_info_character_strategy !== undefined)
        setWorldInfoCharacterStrategy(settings.world_info_character_strategy);
    if (settings.world_info_budget_cap !== undefined)
        setWorldInfoBudgetCap(settings.world_info_budget_cap);
    if (settings.world_info_use_group_scoring !== undefined)
        setWorldInfoUseGroupScoring(settings.world_info_use_group_scoring);
    if (settings.world_info_use_aho_corasick !== undefined)
        setWorldInfoUseAhoCorasick(settings.world_info_use_aho_corasick);
    if (settings.world_info_max_recursion_steps !== undefined)
        setWorldInfoMaxRecursionSteps(settings.world_info_max_recursion_steps);

    // Migrate old settings
    if (world_info_budget > 100) {
        setWorldInfoBudget(25);
    }

    if (world_info_use_group_scoring === undefined) {
        setWorldInfoUseGroupScoring(false);
    }

    // Reset selected world from old string and delete old keys
    // TODO: Remove next release
    const existingWorldInfo = settings.world_info;
    if (typeof existingWorldInfo === 'string') {
        delete settings.world_info;
        setSelectedWorldInfo([existingWorldInfo]);
    } else if (Array.isArray(existingWorldInfo)) {
        delete settings.world_info;
        setSelectedWorldInfo(existingWorldInfo);
    }

    setWorldInfo(settings.world_info ?? {});

    $('#world_info_depth_counter').val(world_info_depth);
    $('#world_info_depth').val(world_info_depth);

    $('#world_info_min_activations_counter').val(world_info_min_activations);
    $('#world_info_min_activations').val(world_info_min_activations);

    $('#world_info_min_activations_depth_max_counter').val(world_info_min_activations_depth_max);
    $('#world_info_min_activations_depth_max').val(world_info_min_activations_depth_max);

    $('#world_info_budget_counter').val(world_info_budget);
    $('#world_info_budget').val(world_info_budget);

    $('#world_info_include_names').prop('checked', world_info_include_names);
    $('#world_info_recursive').prop('checked', world_info_recursive);
    $('#world_info_overflow_alert').prop('checked', world_info_overflow_alert);
    $('#world_info_case_sensitive').prop('checked', world_info_case_sensitive);
    $('#world_info_match_whole_words').prop('checked', world_info_match_whole_words);
    $('#world_info_use_group_scoring').prop('checked', world_info_use_group_scoring);
    $('#world_info_use_aho_corasick').prop('checked', world_info_use_aho_corasick);

    $(`#world_info_character_strategy option[value='${world_info_character_strategy}']`).prop('selected', true);
    $('#world_info_character_strategy').val(world_info_character_strategy);

    $('#world_info_budget_cap').val(world_info_budget_cap);
    $('#world_info_budget_cap_counter').val(world_info_budget_cap);

    $('#world_info_max_recursion_steps').val(world_info_max_recursion_steps);
    $('#world_info_max_recursion_steps_counter').val(world_info_max_recursion_steps);

    setWorldNames(data.world_names?.length ? data.world_names : []);

    // Add to existing selected WI if it exists
    const newSelectedWorldInfo = selected_world_info.concat(settings.world_info?.globalSelect?.filter((e) => world_names.includes(e)) ?? []);
    setSelectedWorldInfo(newSelectedWorldInfo);

    if (world_names.length > 0) {
        $('#world_info').empty();
    }

    world_names.forEach((item, i) => {
        $('#world_info').append(`<option value='${i}'${selected_world_info.includes(item) ? ' selected' : ''}>${item}</option>`);
        $('#world_editor_select').append(`<option value='${i}'>${item}</option>`);
    });

    $('#world_info_sort_order').val(accountStorage.getItem(SORT_ORDER_KEY) || '0');
    $('#world_info').trigger('change');
    $('#world_editor_select').trigger('change');

    eventSource.on(event_types.CHAT_CHANGED, async () => {
        const { chat_metadata } = await import('../../script.js');
        const hasWorldInfo = !!chat_metadata[METADATA_KEY] && world_names.includes(chat_metadata[METADATA_KEY]);
        $('.chat_lorebook_button').toggleClass('world_set', hasWorldInfo);
        // Pre-cache the world info data for the chat for quicker first prompt generation
        await getSortedEntries();
    });

    eventSource.on(event_types.WORLDINFO_FORCE_ACTIVATE, (entries) => {
        for (const entry of entries) {
            if (!Object.hasOwn(entry, 'world') || !Object.hasOwn(entry, 'uid')) {
                console.error('[WI] WORLDINFO_FORCE_ACTIVATE requires all entries to have both world and uid fields, entry IGNORED', entry);
            } else {
                WorldInfoBuffer.externalActivations.set(getEntryId(entry), entry);
                console.log('[WI] WORLDINFO_FORCE_ACTIVATE added entry', entry);
            }
        }
    });

    // Add slash commands
    import('./slash-commands.js').then(({ registerWorldInfoSlashCommands }) => {
        registerWorldInfoSlashCommands();
    });
}
