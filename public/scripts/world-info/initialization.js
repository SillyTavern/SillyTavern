/**
 * World Info Initialization
 * Contains the initWorldInfo function that sets up all DOM event bindings.
 */

import { characters, eventSource, event_types, saveCharacterDebounced } from '../../script.js';
import { debounce, navigation_option, flashHighlight, select2ChoiceClickSubscribe } from '../utils.js';
import { isMobile } from '../RossAscends-mods.js';
import { FILTER_TYPES } from '../filters.js';
import { Popup } from '../popup.js';
import { accountStorage } from '../util/AccountStorage.js';
import { t } from '../i18n.js';

import {
    world_names,
    saveSettingsDebounced,
    setWorldInfoDepth,
    setWorldInfoMinActivations,
    setWorldInfoMinActivationsDepthMax,
    setWorldInfoBudget,
    setWorldInfoIncludeNames,
    setWorldInfoRecursive,
    setWorldInfoCaseSensitive,
    setWorldInfoMatchWholeWords,
    setWorldInfoCharacterStrategy,
    setWorldInfoOverflowAlert,
    setWorldInfoUseGroupScoring,
    setWorldInfoUseAhoCorasick,
    setWorldInfoBudgetCap,
    setWorldInfoMaxRecursionSteps,
    world_info_max_recursion_steps,
    world_info_min_activations,
} from './state.js';
import { SORT_ORDER_KEY } from './constants.js';
import { getFreeWorldName } from './utilities.js';
import { createNewWorldInfo } from './persistence/index.js';
import { worldInfoFilter, showWorldEditor, hideWorldEditor } from './editor/index.js';
import { onWorldInfoChange, importWorldInfo, checkEmbeddedWorld, importEmbeddedWorldInfo, openWorldInfoEditor, assignLorebookToChat } from './integration.js';
import { registerWorldInfoSlashCommands } from './slash-commands.js';

// Reference to updateEditor - will be set after displayWorldEntries runs
// We need to use a getter pattern since updateEditor is reassigned dynamically
let getUpdateEditor = () => (navigation, flashOnNav) => { console.debug('Triggered WI navigation (init)', navigation, flashOnNav); };

/**
 * Sets the updateEditor reference for use in initialization handlers.
 * @param {Function} getter - A function that returns the current updateEditor function
 */
export function setUpdateEditorGetter(getter) {
    getUpdateEditor = getter;
}

/**
 * Initializes all World Info UI event handlers.
 */
export function initWorldInfo() {
    // Register slash commands first
    registerWorldInfoSlashCommands();

    $('#world_info').on('mousedown change', async function (e) {
        // If there's no world names, don't do anything
        if (world_names.length === 0) {
            e.preventDefault();
            return;
        }

        onWorldInfoChange('__notSlashCommand__');
    });

    //**************************WORLD INFO IMPORT EXPORT*************************//
    $('#world_import_button').on('click', function () {
        $('#world_import_file').trigger('click');
    });

    $('#world_import_file').on('change', async function (e) {
        if (!(e.target instanceof HTMLInputElement)) {
            return;
        }

        const file = e.target.files[0];

        await importWorldInfo(file);

        // Will allow to select the same file twice in a row
        e.target.value = '';
    });

    $('#world_create_button').on('click', async () => {
        const tempName = getFreeWorldName();
        const finalName = await Popup.show.input(t`Create a new World Info`, t`Enter a name for the new file:`, tempName);

        if (finalName) {
            await createNewWorldInfo(finalName, { interactive: true });
        }
    });

    $('#world_editor_select').on('change', async () => {
        $('#world_info_search').val('');
        worldInfoFilter.setFilterData(FILTER_TYPES.WORLD_INFO_SEARCH, '', true);
        const selectedIndex = String($('#world_editor_select').find(':selected').val());

        if (selectedIndex === '') {
            await hideWorldEditor();
        } else {
            const worldName = world_names[selectedIndex];
            showWorldEditor(worldName);
        }
    });

    const saveSettings = () => {
        saveSettingsDebounced();
        eventSource.emit(event_types.WORLDINFO_SETTINGS_UPDATED);
    };

    $('#world_info_depth').on('input', function () {
        setWorldInfoDepth(Number($(this).val()));
        $('#world_info_depth_counter').val($(this).val());
        saveSettings();
    });

    $('#world_info_min_activations').on('input', function () {
        const value = Number($(this).val());
        setWorldInfoMinActivations(value);
        $('#world_info_min_activations_counter').val(value);

        if (value !== 0 && world_info_max_recursion_steps !== 0) {
            $('#world_info_max_recursion_steps').val(0).trigger('input');
            flashHighlight($('#world_info_max_recursion_steps').parent()); // flash the other control to show it has changed
            console.info('[WI] Max recursion steps set to 0, as min activations is set to', value);
        } else {
            saveSettings();
        }
    });

    $('#world_info_min_activations_depth_max').on('input', function () {
        setWorldInfoMinActivationsDepthMax(Number($(this).val()));
        $('#world_info_min_activations_depth_max_counter').val($(this).val());
        saveSettings();
    });

    $('#world_info_budget').on('input', function () {
        setWorldInfoBudget(Number($(this).val()));
        $('#world_info_budget_counter').val($(this).val());
        saveSettings();
    });

    $('#world_info_include_names').on('input', function () {
        setWorldInfoIncludeNames(!!$(this).prop('checked'));
        saveSettings();
    });

    $('#world_info_recursive').on('input', function () {
        setWorldInfoRecursive(!!$(this).prop('checked'));
        saveSettings();
    });

    $('#world_info_case_sensitive').on('input', function () {
        setWorldInfoCaseSensitive(!!$(this).prop('checked'));
        saveSettings();
    });

    $('#world_info_match_whole_words').on('input', function () {
        setWorldInfoMatchWholeWords(!!$(this).prop('checked'));
        saveSettings();
    });

    $('#world_info_character_strategy').on('change', function () {
        setWorldInfoCharacterStrategy(Number($(this).val()));
        saveSettings();
    });

    $('#world_info_overflow_alert').on('change', function () {
        setWorldInfoOverflowAlert(!!$(this).prop('checked'));
        saveSettingsDebounced();
    });

    $('#world_info_use_group_scoring').on('change', function () {
        setWorldInfoUseGroupScoring(!!$(this).prop('checked'));
        saveSettingsDebounced();
    });

    $('#world_info_use_aho_corasick').on('change', function () {
        setWorldInfoUseAhoCorasick(!!$(this).prop('checked'));
        saveSettings();
    });

    $('#world_info_budget_cap').on('input', function () {
        const value = Number($(this).val());
        setWorldInfoBudgetCap(value);
        $('#world_info_budget_cap_counter').val(value);
        saveSettings();
    });

    $('#world_info_max_recursion_steps').on('input', function () {
        const value = Number($(this).val());
        setWorldInfoMaxRecursionSteps(value);
        $('#world_info_max_recursion_steps_counter').val(value);
        if (value !== 0 && world_info_min_activations !== 0) {
            $('#world_info_min_activations').val(0).trigger('input');
            flashHighlight($('#world_info_min_activations').parent()); // flash the other control to show it has changed
            console.info('[WI] Min activations set to 0, as max recursion steps is set to', value);
        } else {
            saveSettings();
        }
    });

    $('#world_button').on('click', async function (event) {
        const openSetWorldMenu = () => $('#char-management-dropdown').val($('#set_character_world').val()).trigger('change');
        const chid = $('#set_character_world').data('chid');

        if (chid === -1) {
            openSetWorldMenu();
            return;
        }

        const worldName = characters[chid]?.data?.extensions?.world;
        const hasEmbed = checkEmbeddedWorld(chid);
        if (worldName && world_names.includes(worldName) && !event.shiftKey) {
            openWorldInfoEditor(worldName);
        } else if (hasEmbed && !event.shiftKey) {
            await importEmbeddedWorldInfo();
            saveCharacterDebounced();
        }
        else {
            openSetWorldMenu();
        }
    });

    const debouncedWorldInfoSearch = debounce((searchQuery) => {
        worldInfoFilter.setFilterData(FILTER_TYPES.WORLD_INFO_SEARCH, searchQuery);
    });
    $('#world_info_search').on('input', function () {
        const searchQuery = $(this).val();
        debouncedWorldInfoSearch(searchQuery);
    });

    $('#world_refresh').on('click', () => {
        getUpdateEditor()(navigation_option.previous);
    });

    $('#world_info_sort_order').on('change', function () {
        const value = String($(this).find(':selected').val());
        // Save sort order, but do not save search sorting, as this is a temporary sorting option
        if (value !== 'search') accountStorage.setItem(SORT_ORDER_KEY, value);
        getUpdateEditor()(navigation_option.none);
    });

    $(document).on('click', '.chat_lorebook_button', assignLorebookToChat);

    // Not needed on mobile
    if (!isMobile()) {
        $('#world_editor_select').select2({
            placeholder: t`--- Pick to Edit ---`,
            searchInputPlaceholder: t`Search...`,
            allowClear: true,
            closeOnSelect: true,
            multiple: false,
        });

        $('#world_info').select2({
            width: '100%',
            placeholder: t`No Worlds active. Click here to select.`,
            allowClear: true,
            closeOnSelect: false,
        });

        // Subscribe world loading to the select2 multiselect items (We need to target the specific select2 control)
        select2ChoiceClickSubscribe($('#world_info'), target => {
            const name = $(target).text();
            const selectedIndex = world_names.indexOf(name);
            const alreadySelectedInEditor = $('#world_editor_select option:selected').text() === name;
            if (selectedIndex !== -1 && !alreadySelectedInEditor) {
                $('#world_editor_select').val(selectedIndex).trigger('change');
                console.log('Quick selection of world', name);
            } else {
                console.warn('lets not reload an already loaded list yes?');
            }
        }, { buttonStyle: true, closeDrawer: true });
    }

    $('#WorldInfo').on('scroll', () => {
        $('.world_entry input[name="group"], .world_entry input[name="automationId"]').each((_, el) => {
            const instance = $(el).autocomplete('instance');

            if (instance !== undefined) {
                $(el).autocomplete('close');
            }
        });
    });
}
