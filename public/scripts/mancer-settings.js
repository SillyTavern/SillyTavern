import { setGenerationParamsFromPreset } from "../script.js";
import { getDeviceInfo } from "./RossAscends-mods.js";
import { textgenerationwebui_settings } from "./textgen-settings.js";

let models = [];

export async function loadMancerModels(data) {
    if (!Array.isArray(data)) {
        console.error('Invalid Mancer models data', data);
        return;
    }

    models = data;

    $('#mancer_model').empty();
    for (const model of data) {
        const option = document.createElement('option');
        option.value = model.id;
        option.text = model.name;
        option.selected = model.id === textgenerationwebui_settings.mancer_model;
        $('#mancer_model').append(option);
    }
}

function onMancerModelSelect() {
    const modelId = String($('#mancer_model').val());
    textgenerationwebui_settings.mancer_model = modelId;
    $('#api_button_textgenerationwebui').trigger('click');

    const limits = models.find(x => x.id === modelId)?.limits;
    setGenerationParamsFromPreset({ max_length: limits.context, genamt: limits.completion });
}

function getMancerModelTemplate(option) {
    const model = models.find(x => x.id === option?.element?.value);

    if (!option.id || !model) {
        return option.text;
    }

    return $((`
        <div class="flex-container flexFlowColumn">
            <div><strong>${DOMPurify.sanitize(model.name)}</strong> | <span>${model.limits?.context} ctx</span></div>
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
