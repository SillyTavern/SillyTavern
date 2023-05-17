import {
    saveSettingsDebounced,
} from "../../../script.js";
import { getApiUrl, getContext, extension_settings, defaultRequestArgs } from "../../extensions.js";
export { MODULE_NAME, chromadb_interceptGeneration };

const MODULE_NAME = 'chromadb';

const defaultSettings = {
    keep_context: 10,
    keep_context_min: 1,
    keep_context_max: 100,
    keep_context_step: 1,

    n_results: 20,
    n_results_min: 1,
    n_results_max: 100,
    n_results_step: 1,
}

async function loadSettings() {
    if (Object.keys(extension_settings.chromadb).length === 0) {
        Object.assign(extension_settings.chromadb, defaultSettings);
    }

    $('#chromadb_keep_context').val(extension_settings.chromadb.keep_context).trigger('input');
    $('#chromadb_n_results').val(extension_settings.chromadb.n_results).trigger('input');
}

function onKeepContextInput() {
    extension_settings.chromadb.keep_context = Number($('#chromadb_keep_context').val());
    $('#chromadb_keep_context_value').text(extension_settings.chromadb.keep_context);
    saveSettingsDebounced();
}

function onNResultsInput() {
    extension_settings.chromadb.n_results = Number($('#chromadb_n_results').val());
    $('#chromadb_n_results_value').text(extension_settings.chromadb.n_results);
    saveSettingsDebounced();
}

async function moduleWorker() {
    // ??? 
}

setInterval(moduleWorker, UPDATE_INTERVAL);

window.chromadb_interceptGeneration = async () => {
    const context = getContext();

    // TODO substitute context
}

jQuery(async () => {
    const settingsHtml = `
    <div class="chromadb_settings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
            <b>Infinity Context</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <label for="chromadb_keep_context">How many messages to keep (<span id="chromadb_keep_context_value"></span>)</label>
            <input id="chromadb_keep_context" type="range" min="${defaultSettings.keep_context_min}" max="${defaultSettings.keep_context_max}" step="${defaultSettings.keep_context_step}" value="${defaultSettings.keep_context}" />
            <label for="chromadb_n_results">Max messages to inject (<span id="chromadb_n_results_value"></span>)</label>
            <input id="chromadb_n_results" type="range" min="${defaultSettings.n_results_min}" max="${defaultSettings.n_results_max}" step="${defaultSettings.n_results_step}" value="${defaultSettings.n_results}" />
        </div>
    </div>`;

    $('#extensions_settings').append(settingsHtml);
    $('#chromadb_keep_context').on('input', onKeepContextInput);
    $('#chromadb_n_results').on('input', onNResultsInput);

    await loadSettings();
});