import {
    main_api,
    saveSettingsDebounced,
    novelai_setting_names,
    callPopup,
    settings,
} from '../script.js';
import { power_user } from './power-user.js';
//import { BIAS_CACHE, displayLogitBias, getLogitBiasListResult } from './logit-bias.js';
//import { getEventSourceStream } from './sse-stream.js';
//import { getSortableDelay, onlyUnique } from './utils.js';
//import { getCfgPrompt } from './cfg-scale.js';
import { setting_names } from './textgen-settings.js';


const TGsamplerNames = setting_names;

const forcedOnColoring = 'filter: sepia(1) hue-rotate(59deg) contrast(1.5) saturate(3.5)';
const forcedOffColoring = 'filter: sepia(1) hue-rotate(308deg) contrast(0.7) saturate(10)';

let userDisabledSamplers, userShownSamplers;

/*

for reference purposes:

//NAI
const nai_settings = {
    temperature: 1.5,
    repetition_penalty: 2.25,
    repetition_penalty_range: 2048,
    repetition_penalty_slope: 0.09,
    repetition_penalty_frequency: 0,
    repetition_penalty_presence: 0.005,
    tail_free_sampling: 0.975,
    top_k: 10,
    top_p: 0.75,
    top_a: 0.08,
    typical_p: 0.975,
    min_length: 1,
    model_novel: 'clio-v1',
    preset_settings_novel: 'Talker-Chat-Clio',
    streaming_novel: false,
    preamble: default_preamble,
    prefix: '',
    cfg_uc: '',
    banned_tokens: '',
    order: default_order,
    logit_bias: [],
};

// TG Types
export const textgen_types = {
    OOBA: 'ooba',
    MANCER: 'mancer',
    VLLM: 'vllm',
    APHRODITE: 'aphrodite',
    TABBY: 'tabby',
    KOBOLDCPP: 'koboldcpp',
    TOGETHERAI: 'togetherai',
    LLAMACPP: 'llamacpp',
    OLLAMA: 'ollama',
    INFERMATICAI: 'infermaticai',
    DREAMGEN: 'dreamgen',
    OPENROUTER: 'openrouter',
};

//KAI and TextGen
const setting_names = [
    'temp',
    'temperature_last',
    'rep_pen',
    'rep_pen_range',
    'no_repeat_ngram_size',
    'top_k',
    'top_p',
    'top_a',
    'tfs',
    'epsilon_cutoff',
    'eta_cutoff',
    'typical_p',
    'min_p',
    'penalty_alpha',
    'num_beams',
    'length_penalty',
    'min_length',
    'dynatemp',
    'min_temp',
    'max_temp',
    'dynatemp_exponent',
    'smoothing_factor',
    'smoothing_curve',
    'max_tokens_second',
    'encoder_rep_pen',
    'freq_pen',
    'presence_pen',
    'do_sample',
    'early_stopping',
    'seed',
    'add_bos_token',
    'ban_eos_token',
    'skip_special_tokens',
    'streaming',
    'mirostat_mode',
    'mirostat_tau',
    'mirostat_eta',
    'guidance_scale',
    'negative_prompt',
    'grammar_string',
    'json_schema',
    'banned_tokens',
    'legacy_api',
    //'n_aphrodite',
    //'best_of_aphrodite',
    'ignore_eos_token',
    'spaces_between_special_tokens',
    //'logits_processors_aphrodite',
    //'log_probs_aphrodite',
    //'prompt_log_probs_aphrodite'
    'sampler_order',
    'sampler_priority',
    'samplers',
    'n',
    'logit_bias',
    'custom_model',
    'bypass_status_check',
];

//OAI settings

const default_settings = {
    preset_settings_openai: 'Default',
    temp_openai: 1.0,
    freq_pen_openai: 0,
    pres_pen_openai: 0,
    count_pen: 0.0,
    top_p_openai: 1.0,
    top_k_openai: 0,
    min_p_openai: 0,
    top_a_openai: 1,
    repetition_penalty_openai: 1,
    stream_openai: false,
    //...
}


*/

// Goal 1: show popup with all samplers for active API
async function showSamplerSelectPopup() {
    const popup = $('#dialogue_popup');
    popup.addClass('large_dialogue_popup');
    const html = $(document.createElement('div'));
    html.attr('id', 'sampler_view_list')
        .addClass('flex-container flexFlowColumn');
    html.append(`
    <div class="title_restorable flexFlowColumn alignItemsBaseline">
        <div class="flex-container justifyCenter">
            <h3>Sampler Select</h3>
            <div class="flex-container alignItemsBaseline">
            <div id="resetSelectedSamplers" class="menu_button menu_button_icon tag_view_create" title="Reset custom sampler selection">
                <i class="fa-solid fa-recycle"></i>
            </div>
        </div>
            <!--<div class="flex-container alignItemsBaseline">
                <div class="menu_button menu_button_icon tag_view_create" title="Create a new sampler">
                    <i class="fa-solid fa-plus"></i>
                    <span data-i18n="Create">Create</span>
                </div>
            </div>-->
        </div>
        <small>Here you can toggle the display of individual samplers. (WIP)</small>
    </div>
    <hr>`);

    const listContainer = $('<div id="apiSamplersList" class="flex-container flexNoGap"></div>');
    const APISamplers = await listSamplers(main_api);
    listContainer.append(APISamplers);
    html.append(listContainer);

    callPopup(html, 'text', null, { allowVerticalScrolling: true });

    setSamplerListListeners();

    $('#resetSelectedSamplers').off('click').on('click', async function () {
        console.log('saw sampler select reset click');
        userDisabledSamplers = [];
        userShownSamplers = [];
        power_user.selectSamplers.forceShown = [];
        power_user.selectSamplers.forceHidden = [];
        await validateDisabledSamplers(true);
    });
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

        if (samplerName === 'dynatemp') {
            relatedDOMElement = $('#dynatemp_block_ooba');
            targetDisplayType = 'block';
        }

        if (samplerName === 'banned_tokens') {
            relatedDOMElement = $('#banned_tokens_block_ooba');
            targetDisplayType = 'block';
        }

        if (samplerName === 'sampler_order') {
            relatedDOMElement = $('#sampler_order_block');
            targetDisplayType = 'flex';
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
        const valuesToRemove = new Set(['streaming', 'seed', 'bypass_status_check', 'custom_model', 'legacy_api', 'samplers']);
        availableSamplers = availableSamplers.filter(sampler => !valuesToRemove.has(sampler));
        availableSamplers.sort();
    }

    if (arrayOnly) {
        console.debug('returning full samplers array');
        return availableSamplers;
    }

    const samplersListHTML = availableSamplers.reduce((html, sampler) => {
        let customColor;
        const targetDOMelement = $(`#${sampler}_${main_api}`);

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
        console.log(sampler, isInDefaultState(), isInForceHiddenArray, shouldBeChecked());
        return html + `
        <div class="sampler_view_list_item wide50p flex-container">
            <input type="checkbox" name="${sampler}_checkbox" ${shouldBeChecked() ? 'checked' : ''}>
            <small class="sampler_name" style="${customColor}">${sampler}</small>
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

        if (sampler === 'sampler_order') {
            relatedDOMElement = $('#sampler_order_block');
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
