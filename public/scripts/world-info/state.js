/**
 * World Info State
 * Contains all mutable state variables and setter functions for the world info module.
 * Using setters avoids ES module live binding issues when re-exporting mutable let variables.
 */

import { debounce } from '../utils.js';
import { saveSettings } from '../../script.js';
import { debounce_timeout } from '../constants.js';
import { world_info_insertion_strategy } from './constants.js';

// Core world info data
export let world_info = {};
export let selected_world_info = [];
/** @type {string[]} */
export let world_names = [];

// World info settings
export let world_info_depth = 2;
export let world_info_min_activations = 0; // if > 0, will continue seeking chat until minimum world infos are activated
export let world_info_min_activations_depth_max = 0; // used when (world_info_min_activations > 0)
export let world_info_budget = 25;
export let world_info_include_names = true;
export let world_info_recursive = false;
export let world_info_overflow_alert = false;
export let world_info_case_sensitive = false;
export let world_info_match_whole_words = false;
export let world_info_use_group_scoring = false;
export let world_info_use_aho_corasick = false; // Default off - opt-in for users with large lorebooks
export let world_info_character_strategy = world_info_insertion_strategy.character_first;
export let world_info_budget_cap = 0;
export let world_info_max_recursion_steps = 0;

// Debounced save function for settings
export const saveSettingsDebounced = debounce(() => {
    Object.assign(world_info, { globalSelect: selected_world_info });
    saveSettings();
}, debounce_timeout.relaxed);

// Sort function used across the module
export const sortFn = (a, b) => b.order - a.order;

// Setter functions to avoid ES module live binding issues

export function setWorldInfo(value) {
    world_info = value;
}

export function setSelectedWorldInfo(value) {
    selected_world_info = value;
}

export function setWorldNames(value) {
    world_names = value;
}

export function setWorldInfoDepth(value) {
    world_info_depth = Number(value);
}

export function setWorldInfoMinActivations(value) {
    world_info_min_activations = Number(value);
}

export function setWorldInfoMinActivationsDepthMax(value) {
    world_info_min_activations_depth_max = Number(value);
}

export function setWorldInfoBudget(value) {
    world_info_budget = Number(value);
}

export function setWorldInfoIncludeNames(value) {
    world_info_include_names = Boolean(value);
}

export function setWorldInfoRecursive(value) {
    world_info_recursive = Boolean(value);
}

export function setWorldInfoOverflowAlert(value) {
    world_info_overflow_alert = Boolean(value);
}

export function setWorldInfoCaseSensitive(value) {
    world_info_case_sensitive = Boolean(value);
}

export function setWorldInfoMatchWholeWords(value) {
    world_info_match_whole_words = Boolean(value);
}

export function setWorldInfoUseGroupScoring(value) {
    world_info_use_group_scoring = Boolean(value);
}

export function setWorldInfoUseAhoCorasick(value) {
    world_info_use_aho_corasick = Boolean(value);
}

export function setWorldInfoCharacterStrategy(value) {
    world_info_character_strategy = Number(value);
}

export function setWorldInfoBudgetCap(value) {
    world_info_budget_cap = Number(value);
}

export function setWorldInfoMaxRecursionSteps(value) {
    world_info_max_recursion_steps = Number(value);
}
