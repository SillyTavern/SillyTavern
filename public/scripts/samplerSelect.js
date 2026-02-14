import {
    main_api,
    saveSettingsDebounced,
} from '../script.js';
//import { BIAS_CACHE, displayLogitBias, getLogitBiasListResult } from './logit-bias.js';
//import { getEventSourceStream } from './sse-stream.js';
//import { getSortableDelay, onlyUnique } from './utils.js';
//import { getCfgPrompt } from './cfg-scale.js';
import { setting_names as TGsamplerNames, showTGSamplerControls, textgenerationwebui_settings } from './textgen-settings.js';
import { renderTemplateAsync } from './templates.js';
import { Popup, POPUP_TYPE } from './popup.js';
import { localforage } from '../lib.js';

const forcedOnColoring = 'color: #89db35;';
const forcedOffColoring = 'color: #e84f62;';
const SELECT_SAMPLER = {
    DATA: 'selectsampler',
    SHOWN: 'shown',
    HIDDEN: 'hidden',
};

const textGenObjectStore = localforage.createInstance({ name: 'SillyTavern_TextCompletions' });
let selectedSamplers = {};

// Goal 1: show popup with all samplers for active API
async function showSamplerSelectPopup() {
    const html = $(document.createElement('div'));
    html.attr('id', 'sampler_view_list')
        .addClass('flex-container flexFlowColumn');
    html.append(await renderTemplateAsync('samplerSelector'));

    const listContainer = $('<div id="apiSamplersList" class="flex-container flexNoGap"></div>');
    const APISamplers = await listSamplers(main_api);
    listContainer.append(APISamplers.toString());
    html.append(listContainer);

    const showPromise = new Popup(html, POPUP_TYPE.TEXT, null, { wide: true, large: true, allowVerticalScrolling: true }).show();

    setSamplerListListeners();

    $('#resetSelectedSamplers').off('click').on('click', async function () {
        console.log('saw sampler select reset click');

        if (main_api === 'textgenerationwebui') {
            $('#prioritizeManuallySelectedSamplers').toggleClass('toggleEnabled', false);
            await resetApiSelectedSamplers(null, true);
        }

        await validateDisabledSamplers(true);
    });

    if (main_api === 'textgenerationwebui') {
        $('#prioritizeManuallySelectedSamplers').show();
        $('#prioritizeManuallySelectedSamplers').toggleClass('toggleEnabled', isSamplerManualPriorityEnabled());
        $('#prioritizeManuallySelectedSamplers').off('click').on('click', function () {
            $(this).toggleClass('toggleEnabled');

            const isActive = $(this).hasClass('toggleEnabled');

            toggleSamplerManualPriority(isActive);
        });
    } else {
        $('#prioritizeManuallySelectedSamplers').hide();
        $('#prioritizeManuallySelectedSamplers').off('click');
    }

    await showPromise;
    if (main_api === 'textgenerationwebui') await saveApiSelectedSamplers();
}

function getRelatedDOMElement(samplerName) {
    let relatedDOMElement = $(`#${samplerName}_${main_api}`).parent();
    let targetDisplayType = 'flex';
    let displayname;

    if (samplerName === 'json_schema') {
        relatedDOMElement = $('#json_schema_block');
        targetDisplayType = 'block';
        displayname = 'JSON Schema Block';
    }

    if (samplerName === 'grammar_string') {
        relatedDOMElement = $('#grammar_block_ooba');
        targetDisplayType = 'block';
        displayname = 'Grammar Block';
    }

    if (samplerName === 'guidance_scale') {
        relatedDOMElement = $('#cfg_block_ooba');
        targetDisplayType = 'block';
        displayname = 'CFG Block';
    }

    if (samplerName === 'mirostat_mode') {
        relatedDOMElement = $('#mirostat_block_ooba');
        targetDisplayType = 'block';
        displayname = 'Mirostat Block';
    }

    if (samplerName === 'dry_multiplier') {
        relatedDOMElement = $('#dryBlock');
        targetDisplayType = 'block';
        displayname = 'DRY Rep Pen Block';
    }

    if (samplerName === 'xtc_probability') {
        relatedDOMElement = $('#xtc_block');
        targetDisplayType = 'block';
        displayname = 'XTC Block';
    }

    if (samplerName === 'dynatemp') {
        relatedDOMElement = $('#dynatemp_block_ooba');
        targetDisplayType = 'block';
        displayname = 'DynaTemp Block';
    }

    if (samplerName === 'banned_tokens') {
        relatedDOMElement = $('#banned_tokens_block_ooba');
        targetDisplayType = 'block';
    }

    if (samplerName === 'sampler_order') { //this is for kcpp sampler order
        relatedDOMElement = $('#sampler_order_block_kcpp');
        displayname = 'KCPP Sampler Order Block';
    }

    if (samplerName === 'samplers') { //this is for lcpp sampler order
        relatedDOMElement = $('#sampler_order_block_lcpp');
        displayname = 'LCPP Sampler Order Block';
    }

    if (samplerName === 'sampler_priority') { //this is for ooba's sampler priority
        relatedDOMElement = $('#sampler_priority_block_ooba');
        displayname = 'Ooba Sampler Priority Block';
    }

    if (samplerName === 'samplers_priorities') { //this is for aphrodite's sampler priority
        relatedDOMElement = $('#sampler_priority_block_aphrodite');
        displayname = 'Aphrodite Sampler Priority Block';
    }

    if (samplerName === 'penalty_alpha') { //contrastive search only has one sampler, does it need its own block?
        relatedDOMElement = $('#contrastiveSearchBlock');
        displayname = 'Contrast Search Block';
    }

    if (samplerName === 'num_beams') { // num_beams is the killswitch for Beam Search
        relatedDOMElement = $('#beamSearchBlock');
        targetDisplayType = 'block';
        displayname = 'Beam Search Block';
    }

    if (samplerName === 'smoothing_factor') { // num_beams is the killswitch for Beam Search
        relatedDOMElement = $('#smoothingBlock');
        targetDisplayType = 'block';
        displayname = 'Smoothing Block';
    }

    return { relatedDOMElement, targetDisplayType, displayname };
}

function setSamplerListListeners() {
    // Goal 2: hide unchecked samplers from DOM
    let listContainer = $('#apiSamplersList');
    listContainer.find('input').off('change').on('change', async function () {
        const samplerName = this.name.replace('_checkbox', '');
        const { relatedDOMElement, targetDisplayType } = getRelatedDOMElement(samplerName);

        // Get the current state of the custom data attribute
        const previousState = relatedDOMElement.data(SELECT_SAMPLER.DATA);
        const isChecked = $(this).prop('checked');
        const popupInputLabel = $(this).parent().find('.sampler_name');

        if (isChecked === false) {
            if (previousState === SELECT_SAMPLER.SHOWN) {
                console.log('saw previously custom shown sampler => new state:', isChecked, samplerName);
                relatedDOMElement.removeData(SELECT_SAMPLER.DATA);
                popupInputLabel.removeAttr('style');
            } else {
                console.log('saw previous untouched sampler => new state:', isChecked, samplerName);
                relatedDOMElement.data(SELECT_SAMPLER.DATA, SELECT_SAMPLER.HIDDEN);
                popupInputLabel.attr('style', forcedOffColoring);
            }
        } else {
            if (previousState === SELECT_SAMPLER.HIDDEN) {
                console.log('saw previously custom hidden sampler => new state:', isChecked, samplerName);
                relatedDOMElement.removeData(SELECT_SAMPLER.DATA);
                popupInputLabel.removeAttr('style');
            } else {
                console.log('saw previous untouched sampler => new state:', isChecked, samplerName);
                relatedDOMElement.data(SELECT_SAMPLER.DATA, SELECT_SAMPLER.SHOWN);
                popupInputLabel.attr('style', forcedOnColoring);
            }
        }

        await saveSettingsDebounced();

        const shouldDisplay = isChecked ? targetDisplayType : 'none';
        relatedDOMElement.css('display', shouldDisplay);

        if (main_api === 'textgenerationwebui') setApiSamplersState(samplerName, shouldDisplay !== 'none');

        console.log(samplerName, relatedDOMElement.data(SELECT_SAMPLER.DATA), shouldDisplay);
    });

}

function isElementVisibleInDOM(element) {
    while (element && element !== document.body) {
        if (window.getComputedStyle(element).display === 'none') {
            return false;
        }
        element = element.parentElement;
    }
    return true;
}


async function listSamplers(main_api, arrayOnly = false) {
    let availableSamplers;
    if (main_api === 'textgenerationwebui') {
        availableSamplers = TGsamplerNames;
        const valuesToRemove = new Set(['streaming', 'bypass_status_check', 'custom_model', 'legacy_api', 'extensions']);
        availableSamplers = availableSamplers.filter(sampler => !valuesToRemove.has(sampler));
        availableSamplers.sort();
    }

    if (arrayOnly) {
        console.debug('returning full samplers array');
        return availableSamplers;
    }

    const samplersActivatedManually = (main_api === 'textgenerationwebui') ? getActiveManualApiSamplers() : [];
    const prioritizeManualSamplerSelect = (main_api === 'textgenerationwebui') ? isSamplerManualPriorityEnabled() : false;

    const samplersListHTML = availableSamplers.reduce((html, sampler) => {
        let customColor;
        let { relatedDOMElement, displayname } = getRelatedDOMElement(sampler);

        const isManuallyActivated = samplersActivatedManually.includes(sampler);
        const displayModified = relatedDOMElement.data(SELECT_SAMPLER.DATA);
        const isInDefaultState = !displayModified;

        const shouldBeChecked = () => {
            let finalState = isElementVisibleInDOM(relatedDOMElement[0]);

            if (prioritizeManualSamplerSelect) {
                finalState = isManuallyActivated;
            }

            else if (!isInDefaultState) {
                finalState = displayModified === SELECT_SAMPLER.SHOWN;
                customColor = finalState ? forcedOnColoring : forcedOffColoring;
            }

            return finalState;
        };

        console.log(sampler, relatedDOMElement.prop('id'), isInDefaultState, shouldBeChecked());

        if (displayname === undefined) displayname = sampler;
        if (main_api === 'textgenerationwebui') setApiSamplersState(sampler, shouldBeChecked());

        return html + `
        <label class="sampler_view_list_item wide50p flex-container">
            <input type="checkbox" name="${sampler}_checkbox" ${shouldBeChecked() ? 'checked' : ''}>
            <small class="sampler_name" style="${customColor}">${displayname}</small>
        </label>`;
    }, '');

    return samplersListHTML;
}

// Goal 3: make "sampler is hidden/disabled" status persistent (save settings)
// this runs on initial getSettings as well as after API changes

export async function validateDisabledSamplers(redraw = false) {
    const APISamplers = await listSamplers(main_api, true);

    if (!Array.isArray(APISamplers)) {
        return;
    }

    const samplersActivatedManually = (main_api === 'textgenerationwebui') ? getActiveManualApiSamplers() : [];
    const prioritizeManualSamplerSelect = (main_api === 'textgenerationwebui') ? isSamplerManualPriorityEnabled() : false;

    for (const sampler of APISamplers) {
        const { relatedDOMElement, targetDisplayType } = getRelatedDOMElement(sampler);

        if (prioritizeManualSamplerSelect) {
            const isManuallyActivated = samplersActivatedManually.includes(sampler);
            relatedDOMElement.css('display', isManuallyActivated ? targetDisplayType : 'none');
        } else {
            const selectSamplerData = relatedDOMElement.data(SELECT_SAMPLER.DATA);
            relatedDOMElement.css('display', selectSamplerData === SELECT_SAMPLER.SHOWN ? targetDisplayType : 'none');
        }

        relatedDOMElement.removeData(SELECT_SAMPLER.DATA);
    }

    if (!prioritizeManualSamplerSelect && main_api === 'textgenerationwebui') {
        showTGSamplerControls();
    }

    if (redraw) {
        let samplersHTML = await listSamplers(main_api);
        $('#apiSamplersList').empty().append(samplersHTML.toString());
        setSamplerListListeners();
    }

    await saveSettingsDebounced();
}

/**
 * Initializes the configuration object for manually selected samplers.
 * @returns void
 */
export async function loadApiSelectedSamplers() {
    try {
        console.debug('Text Completions: loading selected samplers');
        selectedSamplers = await textGenObjectStore.getItem('selectedSamplers') || {};
    } catch (error) {
        console.log('Text Completions: unable to load selected samplers, using default samplers', error);
        selectedSamplers = {};
    }
}

/**
 * Synchronizes the local forage instance with the selected samplers configuration object.
 * @returns void
 */
export async function saveApiSelectedSamplers() {
    try {
        console.debug('Text Completions: saving selected samplers');
        await textGenObjectStore.setItem('selectedSamplers', selectedSamplers);
    } catch (error) {
        console.log('Text Completions: unable to save selected samplers', error);
    }
}

/**
 * Resets the selected samplers configuration object from the local forage instance.
 * @param {string?} tcApiType Name of the target API Type - It picks the currently active TC API type name by default
 * @param {boolean} silent Suppresses the toastr message confirming that the data was deleted.
 * @returns void
 */
export async function resetApiSelectedSamplers(tcApiType = '', silent = false) {
    try {
        if (!textgenerationwebui_settings?.type && !tcApiType) return;
        if (!tcApiType) tcApiType = textgenerationwebui_settings.type;
        if (!selectedSamplers[tcApiType]) return;

        console.debug('Text Completions: resetting selected samplers');
        delete selectedSamplers[tcApiType];
        await saveApiSelectedSamplers();
        if (!silent) toastr.success('Selected samplers cleared.');
    } catch (error) {
        console.log('Text Completions: unable to reset selected preset samplers', error);
    }
}

/**
 * Saves the visibility state for selected samplers into the configuration object.
 * @param {string} samplerName Target sampler key name
 * @param {string|boolean} state Visibility state of the target sampler
 * @param {string?} tcApiType Name of the target API Type - It picks the currently active TC API type name by default
 * @returns void
 */
export function setApiSamplersState(samplerName, state, tcApiType = '') {
    if (!textgenerationwebui_settings?.type && !tcApiType) return;
    if (!tcApiType) tcApiType = textgenerationwebui_settings.type;
    if (!selectedSamplers[tcApiType]) selectedSamplers[tcApiType] = {};

    const presetSamplers = selectedSamplers[tcApiType];
    presetSamplers[samplerName] = String(state) === 'true';
}

/**
 * Returns the local forage object belonging to the active/selected TC API Type
 * @param {string?} tcApiType Name of the target API Type - It picks the currently active TC API type name by default
 * @returns {object} Full localforage object with manual selections
 */
export function getAllManualApiSamplers(tcApiType = '') {
    if (!textgenerationwebui_settings?.type && !tcApiType) return {};
    if (!tcApiType) tcApiType = textgenerationwebui_settings.type;
    if (!selectedSamplers[tcApiType]) selectedSamplers[tcApiType] = {};

    return selectedSamplers[tcApiType];
}

/**
 * Returns the key names of all the manually activated API Type samplers.
 * @param {string?} tcApiType Name of the target API Type - It picks the currently active TC API type name by default
 * @returns {string[]} Array of sampler key names
 */
export function getActiveManualApiSamplers(tcApiType = '') {
    if (!textgenerationwebui_settings?.type && !tcApiType) return [];
    if (!tcApiType) tcApiType = textgenerationwebui_settings.type;
    if (!selectedSamplers[tcApiType]) selectedSamplers[tcApiType] = {};

    try {
        const presetSamplers = Object.entries(selectedSamplers[tcApiType]);

        return presetSamplers
            .filter(([key, val]) => val === true && key !== 'st_manual_priority')
            .map(([key, val]) => key);
    } catch (error) {
        console.log('Text Completions: unable to fetch active preset samplers', error);
        return [];
    }
}

/**
 * @param {string|boolean} state Target state of the feature
 * @param {string?} tcApiType Name of the target API Type - It picks the currently active TC API type name by default
 * @returns void
 */
export function toggleSamplerManualPriority(state = false, tcApiType = '') {
    if (!textgenerationwebui_settings?.type && !tcApiType) return;
    if (!tcApiType) tcApiType = textgenerationwebui_settings.type;
    if (!selectedSamplers[tcApiType]) selectedSamplers[tcApiType] = {};

    const presetSamplers = selectedSamplers[tcApiType];
    presetSamplers.st_manual_priority = String(state) === 'true';
}

/**
 * @param {string?} tcApiType Name of the target API Type - It picks the currently active TC API type name by default
 * @returns {boolean}
 */
export function isSamplerManualPriorityEnabled(tcApiType = '') {
    if (!textgenerationwebui_settings?.type && !tcApiType) return false;
    if (!tcApiType) tcApiType = textgenerationwebui_settings.type;
    if (!selectedSamplers[tcApiType]) selectedSamplers[tcApiType] = {};

    return selectedSamplers[tcApiType]?.st_manual_priority ?? false;
}

export async function initCustomSelectedSamplers() {
    await saveSettingsDebounced();
    $('#samplerSelectButton').off('click').on('click', showSamplerSelectPopup);
}

// Goal 4: filter hidden samplers from API output

// Goal 5: allow addition of custom samplers to be displayed
// Goal 6: send custom sampler values into prompt
