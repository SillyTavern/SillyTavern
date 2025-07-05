import {
    main_api,
    saveSettingsDebounced,
} from '../script.js';
import { power_user } from './power-user.js';
//import { BIAS_CACHE, displayLogitBias, getLogitBiasListResult } from './logit-bias.js';
//import { getEventSourceStream } from './sse-stream.js';
//import { getSortableDelay, onlyUnique } from './utils.js';
//import { getCfgPrompt } from './cfg-scale.js';
import { setting_names } from './textgen-settings.js';
import { renderTemplateAsync } from './templates.js';
import { Popup, POPUP_TYPE } from './popup.js';


const TGsamplerNames = setting_names;

const forcedOnColoring = 'color: #89db35;';
const forcedOffColoring = 'color: #e84f62;';

let userDisabledSamplers, userShownSamplers;

// Goal 1: show popup with all samplers for active API
async function showSamplerSelectPopup() {
    const html = $(document.createElement('div'));
    html.attr('id', 'sampler_view_list')
        .addClass('flex-container flexFlowColumn');
    html.append(await renderTemplateAsync('samplerSelector'));

    const listContainer = $('<div id="apiSamplersList" class="flex-container flexNoGap"></div>');
    const APISamplers = await listSamplers(main_api);
    listContainer.append(APISamplers);
    html.append(listContainer);

    const showPromise = new Popup(html, POPUP_TYPE.TEXT, null, { wide: true, large: true, allowVerticalScrolling: true }).show();

    setSamplerListListeners();

    $('#resetSelectedSamplers').off('click').on('click', async function () {
        console.log('saw sampler select reset click');
        userDisabledSamplers = [];
        userShownSamplers = [];
        power_user.selectSamplers.forceShown = [];
        power_user.selectSamplers.forceHidden = [];
        await validateDisabledSamplers(true);
    });

    $('#textgen_type').on('change', async function () {
        console.log('changed TG Type, resetting custom samplers'); //unfortunate, but necessary unless we save custom samplers for each TGTytpe
        userDisabledSamplers = [];
        userShownSamplers = [];
        power_user.selectSamplers.forceShown = [];
        power_user.selectSamplers.forceHidden = [];
        await validateDisabledSamplers();
    });

    await showPromise;
}

function setSamplerListListeners() {
    // Goal 2: hide unchecked samplers from DOM
    let listContainer = $('#apiSamplersList');
    listContainer.find('input').off('change').on('change', async function () {

        const samplerName = this.name.replace('_checkbox', '');
        let relatedDOMElement = $(`#${samplerName}_${main_api}`).parent();
        let targetDisplayType = 'flex';

        if (samplerName === 'json_schema') {
            relatedDOMElement = $('#json_schema_block');
            targetDisplayType = 'block';
        }

        if (samplerName === 'grammar_string') {
            relatedDOMElement = $('#grammar_block_ooba');
            targetDisplayType = 'block';
        }

        if (samplerName === 'guidance_scale') {
            relatedDOMElement = $('#cfg_block_ooba');
            targetDisplayType = 'block';
        }

        if (samplerName === 'mirostat_mode') {
            relatedDOMElement = $('#mirostat_block_ooba');
            targetDisplayType = 'block';
        }

        if (samplerName === 'dry_multiplier') {
            relatedDOMElement = $('#dryBlock');
            targetDisplayType = 'block';
        }

        if (samplerName === 'xtc_probability') {
            relatedDOMElement = $('#xtc_block');
            targetDisplayType = 'block';
        }

        if (samplerName === 'dynatemp') {
            relatedDOMElement = $('#dynatemp_block_ooba');
            targetDisplayType = 'block';
        }

        if (samplerName === 'banned_tokens') {
            relatedDOMElement = $('#banned_tokens_block_ooba');
            targetDisplayType = 'block';
        }

        if (samplerName === 'sampler_order') { //this is for kcpp sampler order
            relatedDOMElement = $('#sampler_order_block_kcpp');
        }

        if (samplerName === 'samplers') { //this is for lcpp sampler order
            relatedDOMElement = $('#sampler_order_block_lcpp');
        }

        if (samplerName === 'sampler_priority') { //this is for ooba's sampler priority
            relatedDOMElement = $('#sampler_priority_block_ooba');
        }

        if (samplerName === 'samplers_priorities') { //this is for aphrodite's sampler priority
            relatedDOMElement = $('#sampler_priority_block_aphrodite');
        }

        if (samplerName === 'penalty_alpha') { //contrastive search only has one sampler, does it need its own block?
            relatedDOMElement = $('#contrastiveSearchBlock');
        }

        if (samplerName === 'num_beams') { // num_beams is the killswitch for Beam Search
            relatedDOMElement = $('#beamSearchBlock');
            targetDisplayType = 'block';
        }

        if (samplerName === 'smoothing_factor') { // num_beams is the killswitch for Beam Search
            relatedDOMElement = $('#smoothingBlock');
            targetDisplayType = 'block';
        }

        // Get the current state of the custom data attribute
        const previousState = relatedDOMElement.data('selectsampler');

        if ($(this).prop('checked') === false) {
            //console.log('saw clicking checkbox from on to off...');
            if (previousState === 'shown') {
                console.log('saw previously custom shown sampler');
                //console.log('removing from custom force show list');
                relatedDOMElement.removeData('selectsampler');
                $(this).parent().find('.sampler_name').removeAttr('style');
                power_user?.selectSamplers?.forceShown.splice(power_user?.selectSamplers?.forceShown.indexOf(samplerName), 1);
                console.log(power_user?.selectSamplers?.forceShown);
            } else {
                console.log('saw previous untouched sampler');
                //console.log(`adding ${samplerName} to force hide list`);
                relatedDOMElement.data('selectsampler', 'hidden');
                console.log(relatedDOMElement.data('selectsampler'));
                power_user.selectSamplers.forceHidden.push(samplerName);
                $(this).parent().find('.sampler_name').attr('style', forcedOffColoring);
                console.log(power_user.selectSamplers.forceHidden);
            }
        } else { // going from unchecked to checked
            //console.log('saw clicking checkbox from off to on...');
            if (previousState === 'hidden') {
                console.log('saw previously custom hidden sampler');
                //console.log('removing from custom force hide list');
                relatedDOMElement.removeData('selectsampler');
                $(this).parent().find('.sampler_name').removeAttr('style');
                power_user?.selectSamplers?.forceHidden.splice(power_user?.selectSamplers?.forceHidden.indexOf(samplerName), 1);
                console.log(power_user?.selectSamplers?.forceHidden);
            } else {
                console.log('saw previous untouched sampler');
                //console.log(`adding ${samplerName} to force shown list`);
                relatedDOMElement.data('selectsampler', 'shown');
                console.log(relatedDOMElement.data('selectsampler'));
                power_user.selectSamplers.forceShown.push(samplerName);
                $(this).parent().find('.sampler_name').attr('style', forcedOnColoring);
                console.log(power_user.selectSamplers.forceShown);
            }
        }
        await saveSettingsDebounced();

        const shouldDisplay = $(this).prop('checked') ? targetDisplayType : 'none';
        relatedDOMElement.css('display', shouldDisplay);

        console.log(samplerName, relatedDOMElement.data('selectsampler'), shouldDisplay);
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
        const valuesToRemove = new Set(['streaming', 'bypass_status_check', 'custom_model', 'legacy_api']);
        availableSamplers = availableSamplers.filter(sampler => !valuesToRemove.has(sampler));
        availableSamplers.sort();
    }

    if (arrayOnly) {
        console.debug('returning full samplers array');
        return availableSamplers;
    }

    const samplersListHTML = availableSamplers.reduce((html, sampler) => {
        let customColor, displayname;
        let targetDOMelement = $(`#${sampler}_${main_api}`);

        if (sampler === 'sampler_order') { //this is for kcpp sampler order
            targetDOMelement = $('#sampler_order_block_kcpp');
            displayname = 'KCPP Sampler Order Block';
        }

        if (sampler === 'samplers') { //this is for lcpp sampler order
            targetDOMelement = $('#sampler_order_block_lcpp');
            displayname = 'LCPP Sampler Order Block';
        }

        if (sampler === 'sampler_priority') { //this is for ooba's sampler priority
            targetDOMelement = $('#sampler_priority_block_ooba');
            displayname = 'Ooba Sampler Priority Block';
        }

        if (sampler === 'samplers_priorities') { //this is for aphrodite's sampler priority
            targetDOMelement = $('#sampler_priority_block_aphrodite');
            displayname = 'Aphrodite Sampler Priority Block';
        }

        if (sampler === 'penalty_alpha') { //contrastive search only has one sampler, does it need its own block?
            targetDOMelement = $('#contrastiveSearchBlock');
            displayname = 'Contrast Search Block';
        }

        if (sampler === 'num_beams') { // num_beams is the killswitch for Beam Search
            targetDOMelement = $('#beamSearchBlock');
            displayname = 'Beam Search Block';
        }

        if (sampler === 'smoothing_factor') { // num_beams is the killswitch for Beam Search
            targetDOMelement = $('#smoothingBlock');
            displayname = 'Smoothing Block';
        }

        if (sampler === 'dry_multiplier') {
            targetDOMelement = $('#dryBlock');
            displayname = 'DRY Rep Pen Block';
        }
        if (sampler === 'xtc_probability') {
            targetDOMelement = $('#xtc_block');
            displayname = 'XTC Block';
        }

        if (sampler === 'dynatemp') {
            targetDOMelement = $('#dynatemp_block_ooba');
            displayname = 'DynaTemp Block';
        }

        if (sampler === 'json_schema') {
            targetDOMelement = $('#json_schema_block');
            displayname = 'JSON Schema Block';
        }

        if (sampler === 'grammar_string') {
            targetDOMelement = $('#grammar_block_ooba');
            displayname = 'Grammar Block';
        }

        if (sampler === 'guidance_scale') {
            targetDOMelement = $('#cfg_block_ooba');
            displayname = 'CFG Block';
        }

        if (sampler === 'mirostat_mode') {
            targetDOMelement = $('#mirostat_block_ooba');
            displayname = 'Mirostat Block';
        }



        const isInForceHiddenArray = userDisabledSamplers.includes(sampler);
        const isInForceShownArray = userShownSamplers.includes(sampler);
        let isVisibleInDOM = isElementVisibleInDOM(targetDOMelement[0]);
        const isInDefaultState = () => {
            if (isVisibleInDOM && isInForceShownArray) { return false; }
            else if (!isVisibleInDOM && isInForceHiddenArray) { return false; }
            else { return true; }
        };

        const shouldBeChecked = () => {
            if (isInForceHiddenArray) {
                customColor = forcedOffColoring;
                return false;
            }
            else if (isInForceShownArray) {
                customColor = forcedOnColoring;
                return true;
            }
            else { return isVisibleInDOM; }
        };
        console.log(sampler, targetDOMelement.prop('id'), isInDefaultState(), isInForceShownArray, isInForceHiddenArray, shouldBeChecked());
        if (displayname === undefined) { displayname = sampler; }
        return html + `
        <div class="sampler_view_list_item wide50p flex-container">
            <input type="checkbox" name="${sampler}_checkbox" ${shouldBeChecked() ? 'checked' : ''}>
            <small class="sampler_name" style="${customColor}">${displayname}</small>
        </div>
        `;
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

    for (const sampler of APISamplers) {
        let relatedDOMElement = $(`#${sampler}_${main_api}`).parent();
        let targetDisplayType = 'flex';

        if (sampler === 'json_schema') {
            relatedDOMElement = $('#json_schema_block');
            targetDisplayType = 'block';
        }

        if (sampler === 'grammar_string') {
            relatedDOMElement = $('#grammar_block_ooba');
            targetDisplayType = 'block';
        }

        if (sampler === 'guidance_scale') {
            relatedDOMElement = $('#cfg_block_ooba');
            targetDisplayType = 'block';
        }

        if (sampler === 'mirostat_mode') {
            relatedDOMElement = $('#mirostat_block_ooba');
            targetDisplayType = 'block';
        }

        if (sampler === 'dynatemp') {
            relatedDOMElement = $('#dynatemp_block_ooba');
            targetDisplayType = 'block';
        }

        if (sampler === 'banned_tokens') {
            relatedDOMElement = $('#banned_tokens_block_ooba');
            targetDisplayType = 'block';
        }

        if (sampler === 'sampler_order') { //this is for kcpp sampler order
            relatedDOMElement = $('#sampler_order_block_kcpp');
        }

        if (sampler === 'samplers') { //this is for lcpp sampler order
            relatedDOMElement = $('#sampler_order_block_lcpp');
        }

        if (sampler === 'sampler_priority') { //this is for ooba's sampler priority
            relatedDOMElement = $('#sampler_priority_block_ooba');
        }

        if (sampler === 'samplers_priorities') { //this is for aphrodite's sampler priority
            relatedDOMElement = $('#sampler_priority_block_aphrodite');
        }

        if (sampler === 'dry_multiplier') {
            relatedDOMElement = $('#dryBlock');
            targetDisplayType = 'block';
        }

        if (sampler === 'xtc_probability') {
            relatedDOMElement = $('#xtc_block');
            targetDisplayType = 'block';
        }

        if (sampler === 'penalty_alpha') { //contrastive search only has one sampler, does it need its own block?
            relatedDOMElement = $('#contrastiveSearchBlock');
        }

        if (sampler === 'num_beams') { // num_beams is the killswitch for Beam Search
            relatedDOMElement = $('#beamSearchBlock');
        }

        if (sampler === 'smoothing_factor') { // num_beams is the killswitch for Beam Search
            relatedDOMElement = $('#smoothingBlock');
        }

        if (power_user?.selectSamplers?.forceHidden.includes(sampler)) {
            //default handling for standard sliders
            relatedDOMElement.data('selectsampler', 'hidden');
            relatedDOMElement.css('display', 'none');
        } else if (power_user?.selectSamplers?.forceShown.includes(sampler)) {
            relatedDOMElement.data('selectsampler', 'shown');
            relatedDOMElement.css('display', targetDisplayType);
        } else {
            if (relatedDOMElement.data('selectsampler') === 'hidden') {
                relatedDOMElement.removeAttr('selectsampler');
                relatedDOMElement.css('display', targetDisplayType);
            }
            if (relatedDOMElement.data('selectsampler') === 'shown') {
                relatedDOMElement.removeAttr('selectsampler');
                relatedDOMElement.css('display', 'none');
            }
        }
        if (redraw) {
            let samplersHTML = await listSamplers(main_api);
            $('#apiSamplersList').empty().append(samplersHTML);
            setSamplerListListeners();
        }

        await saveSettingsDebounced();

    }
}


export async function initCustomSelectedSamplers() {

    userDisabledSamplers = power_user?.selectSamplers?.forceHidden || [];
    userShownSamplers = power_user?.selectSamplers?.forceShown || [];
    power_user.selectSamplers = {};
    power_user.selectSamplers.forceHidden = userDisabledSamplers;
    power_user.selectSamplers.forceShown = userShownSamplers;
    await saveSettingsDebounced();
    $('#samplerSelectButton').off('click').on('click', showSamplerSelectPopup);

}

// Goal 4: filter hidden samplers from API output

// Goal 5: allow addition of custom samplers to be displayed
// Goal 6: send custom sampler values into prompt
