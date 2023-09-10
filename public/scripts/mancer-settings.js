import { api_server_textgenerationwebui, getRequestHeaders, setGenerationParamsFromPreset } from "../script.js";
import { getDeviceInfo } from "./RossAscends-mods.js";

let models = [];

/**
 * @param {string} modelId
 */
export function getMancerModelURL(modelId) {
    return `https://neuro.mancer.tech/webui/${modelId}/api`;
}

export async function loadMancerModels() {
    try {
        const response = await fetch('/api/mancer/models', {
            method: 'POST',
            headers: getRequestHeaders(),
        });

        if (!response.ok) {
            return;
        }

        const data = await response.json();
        models = data;

        $('#mancer_model').empty();
        for (const model of data) {
            const option = document.createElement('option');
            option.value = model.id;
            option.text = model.name;
            option.selected = api_server_textgenerationwebui === getMancerModelURL(model.id);
            $('#mancer_model').append(option);
        }

    } catch {
        console.warn('Failed to load Mancer models');
    }
}

function onMancerModelSelect() {
    const modelId = String($('#mancer_model').val());
    const url = getMancerModelURL(modelId);
    $('#mancer_api_url_text').val(url);
    $('#api_button_textgenerationwebui').trigger('click');

    const context = models.find(x => x.id === modelId)?.context;
    setGenerationParamsFromPreset({ max_length: context });
}

function getMancerModelTemplate(option) {
    const model = models.find(x => x.id === option?.element?.value);

    if (!option.id || !model) {
        return option.text;
    }

    return $((`
        <div class="flex-container flexFlowColumn">
            <div><strong>${DOMPurify.sanitize(model.name)}</strong> | <span>${model.context} ctx</span></div>
            <small>${DOMPurify.sanitize(model.description)}</small>
        </div>
    `));
}

jQuery(function () {
    $('#mancer_model').on('change', onMancerModelSelect);

    const deviceInfo = getDeviceInfo();
    if (deviceInfo && deviceInfo.device.type === 'desktop') {
        $('#mancer_model').select2({
            placeholder: 'Select a model',
            searchInputPlaceholder: 'Search models...',
            searchInputCssClass: 'text_pole',
            width: '100%',
            templateResult: getMancerModelTemplate,
        });
    }
});
