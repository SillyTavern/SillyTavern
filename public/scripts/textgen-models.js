import { isMobile } from './RossAscends-mods.js';
import { amount_gen, callPopup, eventSource, event_types, getRequestHeaders, max_context, online_status, setGenerationParamsFromPreset } from '../script.js';
import { textgenerationwebui_settings as textgen_settings, textgen_types } from './textgen-settings.js';
import { tokenizers } from './tokenizers.js';
import { renderTemplateAsync } from './templates.js';
import { POPUP_TYPE, callGenericPopup } from './popup.js';

let mancerModels = [];
let togetherModels = [];
let infermaticAIModels = [];
let dreamGenModels = [];
let vllmModels = [];
let aphroditeModels = [];
let featherlessModels = [];
let tabbyModels = [];
export let openRouterModels = [];

/**
 * List of OpenRouter providers.
 * @type {string[]}
 */
const OPENROUTER_PROVIDERS = [
    'OpenAI',
    'Anthropic',
    'HuggingFace',
    'Google',
    'Mancer',
    'Mancer 2',
    'Together',
    'DeepInfra',
    'Azure',
    'Modal',
    'AnyScale',
    'Replicate',
    'Perplexity',
    'Recursal',
    'Fireworks',
    'Mistral',
    'Groq',
    'Cohere',
    'Lepton',
    'OctoAI',
    'Novita',
    'Lynn',
    'Lynn 2',
    'DeepSeek',
    'Infermatic',
];

export async function loadOllamaModels(data) {
    if (!Array.isArray(data)) {
        console.error('Invalid Ollama models data', data);
        return;
    }

    if (!data.find(x => x.id === textgen_settings.ollama_model)) {
        textgen_settings.ollama_model = data[0]?.id || '';
    }

    $('#ollama_model').empty();
    for (const model of data) {
        const option = document.createElement('option');
        option.value = model.id;
        option.text = model.name;
        option.selected = model.id === textgen_settings.ollama_model;
        $('#ollama_model').append(option);
    }
}

export async function loadTabbyModels(data) {
    if (!Array.isArray(data)) {
        console.error('Invalid Tabby models data', data);
        return;
    }

    tabbyModels = data;
    tabbyModels.sort((a, b) => a.id.localeCompare(b.id));
    tabbyModels.unshift({ id: '' });

    if (!tabbyModels.find(x => x.id === textgen_settings.tabby_model)) {
        textgen_settings.tabby_model = tabbyModels[0]?.id || '';
    }

    $('#tabby_model').empty();
    for (const model of tabbyModels) {
        const option = document.createElement('option');
        option.value = model.id;
        option.text = model.id;
        option.selected = model.id === textgen_settings.tabby_model;
        $('#tabby_model').append(option);
    }
}

export async function loadTogetherAIModels(data) {
    if (!Array.isArray(data)) {
        console.error('Invalid Together AI models data', data);
        return;
    }

    data.sort((a, b) => a.name.localeCompare(b.name));
    togetherModels = data;

    if (!data.find(x => x.name === textgen_settings.togetherai_model)) {
        textgen_settings.togetherai_model = data[0]?.name || '';
    }

    $('#model_togetherai_select').empty();
    for (const model of data) {
        // Hey buddy, I think you've got the wrong door.
        if (model.display_type === 'image') {
            continue;
        }

        const option = document.createElement('option');
        option.value = model.name;
        option.text = model.display_name;
        option.selected = model.name === textgen_settings.togetherai_model;
        $('#model_togetherai_select').append(option);
    }
}

export async function loadInfermaticAIModels(data) {
    if (!Array.isArray(data)) {
        console.error('Invalid Infermatic AI models data', data);
        return;
    }

    data.sort((a, b) => a.id.localeCompare(b.id));
    infermaticAIModels = data;

    if (!data.find(x => x.id === textgen_settings.infermaticai_model)) {
        textgen_settings.infermaticai_model = data[0]?.id || '';
    }

    $('#model_infermaticai_select').empty();
    for (const model of data) {
        if (model.display_type === 'image') {
            continue;
        }

        const option = document.createElement('option');
        option.value = model.id;
        option.text = model.id;
        option.selected = model.id === textgen_settings.infermaticai_model;
        $('#model_infermaticai_select').append(option);
    }
}

export async function loadDreamGenModels(data) {
    if (!Array.isArray(data)) {
        console.error('Invalid DreamGen models data', data);
        return;
    }

    dreamGenModels = data;

    if (!data.find(x => x.id === textgen_settings.dreamgen_model)) {
        textgen_settings.dreamgen_model = data[0]?.id || '';
    }

    $('#model_dreamgen_select').empty();
    for (const model of data) {
        if (model.display_type === 'image') {
            continue;
        }

        const option = document.createElement('option');
        option.value = model.id;
        option.text = model.id;
        option.selected = model.id === textgen_settings.dreamgen_model;
        $('#model_dreamgen_select').append(option);
    }
}

export async function loadMancerModels(data) {
    if (!Array.isArray(data)) {
        console.error('Invalid Mancer models data', data);
        return;
    }

    data.sort((a, b) => a.name.localeCompare(b.name));
    mancerModels = data;

    if (!data.find(x => x.id === textgen_settings.mancer_model)) {
        textgen_settings.mancer_model = data[0]?.id || '';
    }

    $('#mancer_model').empty();
    for (const model of data) {
        const option = document.createElement('option');
        option.value = model.id;
        option.text = model.name;
        option.selected = model.id === textgen_settings.mancer_model;
        $('#mancer_model').append(option);
    }
}

export async function loadOpenRouterModels(data) {
    if (!Array.isArray(data)) {
        console.error('Invalid OpenRouter models data', data);
        return;
    }

    data.sort((a, b) => a.name.localeCompare(b.name));
    openRouterModels = data;

    if (!data.find(x => x.id === textgen_settings.openrouter_model)) {
        textgen_settings.openrouter_model = data[0]?.id || '';
    }

    $('#openrouter_model').empty();
    for (const model of data) {
        const option = document.createElement('option');
        option.value = model.id;
        option.text = model.id;
        option.selected = model.id === textgen_settings.openrouter_model;
        $('#openrouter_model').append(option);
    }

    // Calculate the cost of the selected model + update on settings change
    calculateOpenRouterCost();
}

export async function loadVllmModels(data) {
    if (!Array.isArray(data)) {
        console.error('Invalid vLLM models data', data);
        return;
    }

    vllmModels = data;

    if (!data.find(x => x.id === textgen_settings.vllm_model)) {
        textgen_settings.vllm_model = data[0]?.id || '';
    }

    $('#vllm_model').empty();
    for (const model of data) {
        const option = document.createElement('option');
        option.value = model.id;
        option.text = model.id;
        option.selected = model.id === textgen_settings.vllm_model;
        $('#vllm_model').append(option);
    }
}

export async function loadAphroditeModels(data) {
    if (!Array.isArray(data)) {
        console.error('Invalid Aphrodite models data', data);
        return;
    }

    aphroditeModels = data;

    if (!data.find(x => x.id === textgen_settings.aphrodite_model)) {
        textgen_settings.aphrodite_model = data[0]?.id || '';
    }

    $('#aphrodite_model').empty();
    for (const model of data) {
        const option = document.createElement('option');
        option.value = model.id;
        option.text = model.id;
        option.selected = model.id === textgen_settings.aphrodite_model;
        $('#aphrodite_model').append(option);
    }
}

export async function loadFeatherlessModels(data) {
    if (!Array.isArray(data)) {
        console.error('Invalid Featherless models data', data);
        return;
    }

    data.sort((a, b) => a.id.localeCompare(b.id));
    featherlessModels = data;

    if (!data.find(x => x.id === textgen_settings.featherless_model)) {
        textgen_settings.featherless_model = data[0]?.id || '';
    }

    $('#featherless_model').empty();
    for (const model of data) {
        const option = document.createElement('option');
        option.value = model.id;
        option.text = model.id;
        option.selected = model.id === textgen_settings.featherless_model;
        $('#featherless_model').append(option);
    }
}

function onFeatherlessModelSelect() {
    const modelId = String($('#featherless_model').val());
    textgen_settings.featherless_model = modelId;
    $('#api_button_textgenerationwebui').trigger('click');
    const model = featherlessModels.find(x => x.id === modelId);
    setGenerationParamsFromPreset({ max_length: model.context_length });
}


function onMancerModelSelect() {
    const modelId = String($('#mancer_model').val());
    textgen_settings.mancer_model = modelId;
    $('#api_button_textgenerationwebui').trigger('click');

    const limits = mancerModels.find(x => x.id === modelId)?.limits;
    setGenerationParamsFromPreset({ max_length: limits.context });
}

function onTogetherModelSelect() {
    const modelName = String($('#model_togetherai_select').val());
    textgen_settings.togetherai_model = modelName;
    $('#api_button_textgenerationwebui').trigger('click');
    const model = togetherModels.find(x => x.name === modelName);
    setGenerationParamsFromPreset({ max_length: model.context_length });
}

function onInfermaticAIModelSelect() {
    const modelName = String($('#model_infermaticai_select').val());
    textgen_settings.infermaticai_model = modelName;
    $('#api_button_textgenerationwebui').trigger('click');
    const model = infermaticAIModels.find(x => x.id === modelName);
    setGenerationParamsFromPreset({ max_length: model.context_length });
}

function onDreamGenModelSelect() {
    const modelName = String($('#model_dreamgen_select').val());
    textgen_settings.dreamgen_model = modelName;
    $('#api_button_textgenerationwebui').trigger('click');
    // TODO(DreamGen): Consider retuning max_tokens from API and setting it here.
}

function onOllamaModelSelect() {
    const modelId = String($('#ollama_model').val());
    textgen_settings.ollama_model = modelId;
    $('#api_button_textgenerationwebui').trigger('click');
}

function onTabbyModelSelect() {
    const modelId = String($('#tabby_model').val());
    textgen_settings.tabby_model = modelId;
    $('#api_button_textgenerationwebui').trigger('click');
}

function onOpenRouterModelSelect() {
    const modelId = String($('#openrouter_model').val());
    textgen_settings.openrouter_model = modelId;
    $('#api_button_textgenerationwebui').trigger('click');
    const model = openRouterModels.find(x => x.id === modelId);
    setGenerationParamsFromPreset({ max_length: model.context_length });
}

function onVllmModelSelect() {
    const modelId = String($('#vllm_model').val());
    textgen_settings.vllm_model = modelId;
    $('#api_button_textgenerationwebui').trigger('click');
}

function onAphroditeModelSelect() {
    const modelId = String($('#aphrodite_model').val());
    textgen_settings.aphrodite_model = modelId;
    $('#api_button_textgenerationwebui').trigger('click');
}

function getMancerModelTemplate(option) {
    const model = mancerModels.find(x => x.id === option?.element?.value);

    if (!option.id || !model) {
        return option.text;
    }

    const creditsPerPrompt = (model.limits?.context - model.limits?.completion) * model.pricing?.prompt;
    const creditsPerCompletion = model.limits?.completion * model.pricing?.completion;
    const creditsTotal = Math.round(creditsPerPrompt + creditsPerCompletion).toFixed(0);

    return $((`
        <div class="flex-container flexFlowColumn">
            <div><strong>${DOMPurify.sanitize(model.name)}</strong> | <span>${model.limits?.context} ctx</span> / <span>${model.limits?.completion} res</span> | <small>Credits per request (max): ${creditsTotal}</small></div>
        </div>
    `));
}

function getTogetherModelTemplate(option) {
    const model = togetherModels.find(x => x.name === option?.element?.value);

    if (!option.id || !model) {
        return option.text;
    }

    return $((`
        <div class="flex-container flexFlowColumn">
            <div><strong>${DOMPurify.sanitize(model.name)}</strong> | <span>${model.context_length || '???'} tokens</span></div>
            <div><small>${DOMPurify.sanitize(model.description)}</small></div>
        </div>
    `));
}

function getInfermaticAIModelTemplate(option) {
    const model = infermaticAIModels.find(x => x.id === option?.element?.value);

    if (!option.id || !model) {
        return option.text;
    }

    return $((`
        <div class="flex-container flexFlowColumn">
            <div><strong>${DOMPurify.sanitize(model.id)}</strong></div>
        </div>
    `));
}

function getDreamGenModelTemplate(option) {
    const model = dreamGenModels.find(x => x.id === option?.element?.value);

    if (!option.id || !model) {
        return option.text;
    }

    return $((`
        <div class="flex-container flexFlowColumn">
            <div><strong>${DOMPurify.sanitize(model.id)}</strong></div>
        </div>
    `));
}

function getOpenRouterModelTemplate(option) {
    const model = openRouterModels.find(x => x.id === option?.element?.value);

    if (!option.id || !model) {
        return option.text;
    }

    let tokens_dollar = Number(1 / (1000 * model.pricing?.prompt));
    let tokens_rounded = (Math.round(tokens_dollar * 1000) / 1000).toFixed(0);

    const price = 0 === Number(model.pricing?.prompt) ? 'Free' : `${tokens_rounded}k t/$ `;

    return $((`
        <div class="flex-container flexFlowColumn" title="${DOMPurify.sanitize(model.id)}">
            <div><strong>${DOMPurify.sanitize(model.name)}</strong> | ${model.context_length} ctx | <small>${price}</small></div>
        </div>
    `));
}

function getVllmModelTemplate(option) {
    const model = vllmModels.find(x => x.id === option?.element?.value);

    if (!option.id || !model) {
        return option.text;
    }

    return $((`
        <div class="flex-container flexFlowColumn">
            <div><strong>${DOMPurify.sanitize(model.id)}</strong></div>
        </div>
    `));
}

function getAphroditeModelTemplate(option) {
    const model = aphroditeModels.find(x => x.id === option?.element?.value);

    if (!option.id || !model) {
        return option.text;
    }

    return $((`
        <div class="flex-container flexFlowColumn">
            <div><strong>${DOMPurify.sanitize(model.id)}</strong></div>
        </div>
    `));
}

function getFeatherlessModelTemplate(option) {
    const model = featherlessModels.find(x => x.id === option?.element?.value);

    if (!option.id || !model) {
        return option.text;
    }

    return $((`
        <div class="flex-container flexFlowColumn">
            <div><strong>${DOMPurify.sanitize(model.name)}</strong> | <span>${model.context_length || '???'} tokens</span></div>
        </div>
    `));
}

async function downloadOllamaModel() {
    try {
        const serverUrl = textgen_settings.server_urls[textgen_types.OLLAMA];

        if (!serverUrl) {
            toastr.info('Please connect to an Ollama server first.');
            return;
        }

        const html = `Enter a model tag, for example <code>llama2:latest</code>.<br>
        See <a target="_blank" href="https://ollama.ai/library">Library</a> for available models.`;
        const name = await callPopup(html, 'input', '', { okButton: 'Download' });

        if (!name) {
            return;
        }

        toastr.info('Download may take a while, please wait...', 'Working on it');

        const response = await fetch('/api/backends/text-completions/ollama/download', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                name: name,
                api_server: serverUrl,
            }),
        });

        if (!response.ok) {
            throw new Error(response.statusText);
        }

        // Force refresh the model list
        toastr.success('Download complete. Please select the model from the dropdown.');
        $('#api_button_textgenerationwebui').trigger('click');
    } catch (err) {
        console.error(err);
        toastr.error('Failed to download Ollama model. Please try again.');
    }
}

async function downloadTabbyModel() {
    try {
        const serverUrl = textgen_settings.server_urls[textgen_types.TABBY];

        if (online_status === 'no_connection' || !serverUrl) {
            toastr.info('Please connect to a TabbyAPI server first.');
            return;
        }

        const downloadHtml = $(await renderTemplateAsync('tabbyDownloader'));
        const popupResult = await callGenericPopup(downloadHtml, POPUP_TYPE.CONFIRM, '', { okButton: 'Download', cancelButton: 'Cancel' });

        // User cancelled the download
        if (!popupResult) {
            return;
        }

        const repoId = downloadHtml.find('input[name="hf_repo_id"]').val().toString();
        if (!repoId) {
            toastr.error('A HuggingFace repo ID must be provided. Skipping Download.');
            return;
        }

        if (repoId.split('/').length !== 2) {
            toastr.error('A HuggingFace repo ID must be formatted as Author/Name. Please try again.');
            return;
        }

        const params = {
            repo_id: repoId,
            folder_name: downloadHtml.find('input[name="folder_name"]').val() || undefined,
            revision: downloadHtml.find('input[name="revision"]').val() || undefined,
            token: downloadHtml.find('input[name="hf_token"]').val() || undefined,
        };

        for (const suffix of ['include', 'exclude']) {
            const patterns = downloadHtml.find(`textarea[name="tabby_download_${suffix}"]`).val().toString();
            if (patterns) {
                params[suffix] = patterns.split('\n');
            }
        }

        // Params for the server side of ST
        params['api_server'] = serverUrl;
        params['api_type'] = textgen_settings.type;

        toastr.info('Downloading. Check the Tabby console for progress reports.');

        const response = await fetch('/api/backends/text-completions/tabby/download', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(params),
        });

        if (response.status === 403) {
            toastr.error('The provided key has invalid permissions. Please use an admin key for downloading.');
            return;
        } else if (!response.ok) {
            throw new Error(response.statusText);
        }

        toastr.success('Download complete.');
    } catch (err) {
        console.error(err);
        toastr.error('Failed to download HuggingFace model in TabbyAPI. Please try again.');
    }
}

function calculateOpenRouterCost() {
    if (textgen_settings.type !== textgen_types.OPENROUTER) {
        return;
    }

    let cost = 'Unknown';
    const model = openRouterModels.find(x => x.id === textgen_settings.openrouter_model);

    if (model?.pricing) {
        const completionCost = Number(model.pricing.completion);
        const promptCost = Number(model.pricing.prompt);
        const completionTokens = amount_gen;
        const promptTokens = (max_context - completionTokens);
        const totalCost = (completionCost * completionTokens) + (promptCost * promptTokens);
        if (!isNaN(totalCost)) {
            cost = '$' + totalCost.toFixed(3);
        }
    }

    $('#or_prompt_cost').text(cost);

    // Schedule an update when settings change
    eventSource.removeListener(event_types.SETTINGS_UPDATED, calculateOpenRouterCost);
    eventSource.once(event_types.SETTINGS_UPDATED, calculateOpenRouterCost);
}

export function getCurrentOpenRouterModelTokenizer() {
    const modelId = textgen_settings.openrouter_model;
    const model = openRouterModels.find(x => x.id === modelId);
    if (modelId?.includes('jamba')) {
        return tokenizers.JAMBA;
    }
    switch (model?.architecture?.tokenizer) {
        case 'Llama2':
            return tokenizers.LLAMA;
        case 'Llama3':
            return tokenizers.LLAMA3;
        case 'Yi':
            return tokenizers.YI;
        case 'Mistral':
            return tokenizers.MISTRAL;
        case 'Gemini':
            return tokenizers.GEMMA;
        case 'Claude':
            return tokenizers.CLAUDE;
        case 'Cohere':
            return tokenizers.COMMAND_R;
        case 'Qwen':
            return tokenizers.QWEN2;
        default:
            return tokenizers.OPENAI;
    }
}

export function getCurrentDreamGenModelTokenizer() {
    const modelId = textgen_settings.dreamgen_model;
    const model = dreamGenModels.find(x => x.id === modelId);
    if (model.id.startsWith('opus-v1-sm')) {
        return tokenizers.MISTRAL;
    } else if (model.id.startsWith('opus-v1-lg')) {
        return tokenizers.YI;
    } else if (model.id.startsWith('opus-v1-xl')) {
        return tokenizers.LLAMA;
    } else {
        return tokenizers.MISTRAL;
    }
}

export function initTextGenModels() {
    $('#mancer_model').on('change', onMancerModelSelect);
    $('#model_togetherai_select').on('change', onTogetherModelSelect);
    $('#model_infermaticai_select').on('change', onInfermaticAIModelSelect);
    $('#model_dreamgen_select').on('change', onDreamGenModelSelect);
    $('#ollama_model').on('change', onOllamaModelSelect);
    $('#openrouter_model').on('change', onOpenRouterModelSelect);
    $('#ollama_download_model').on('click', downloadOllamaModel);
    $('#vllm_model').on('change', onVllmModelSelect);
    $('#aphrodite_model').on('change', onAphroditeModelSelect);
    $('#featherless_model').on('change', onFeatherlessModelSelect);
    $('#tabby_download_model').on('click', downloadTabbyModel);
    $('#tabby_model').on('change', onTabbyModelSelect);

    const providersSelect = $('.openrouter_providers');
    for (const provider of OPENROUTER_PROVIDERS) {
        providersSelect.append($('<option>', {
            value: provider,
            text: provider,
        }));
    }

    if (!isMobile()) {
        $('#mancer_model').select2({
            placeholder: 'Select a model',
            searchInputPlaceholder: 'Search models...',
            searchInputCssClass: 'text_pole',
            width: '100%',
            templateResult: getMancerModelTemplate,
        });
        $('#model_togetherai_select').select2({
            placeholder: 'Select a model',
            searchInputPlaceholder: 'Search models...',
            searchInputCssClass: 'text_pole',
            width: '100%',
            templateResult: getTogetherModelTemplate,
        });
        $('#ollama_model').select2({
            placeholder: 'Select a model',
            searchInputPlaceholder: 'Search models...',
            searchInputCssClass: 'text_pole',
            width: '100%',
        });
        $('#tabby_model').select2({
            placeholder: '[Currently loaded]',
            searchInputPlaceholder: 'Search models...',
            searchInputCssClass: 'text_pole',
            width: '100%',
            allowClear: true,
        });
        $('#model_infermaticai_select').select2({
            placeholder: 'Select a model',
            searchInputPlaceholder: 'Search models...',
            searchInputCssClass: 'text_pole',
            width: '100%',
            templateResult: getInfermaticAIModelTemplate,
        });
        $('#model_dreamgen_select').select2({
            placeholder: 'Select a model',
            searchInputPlaceholder: 'Search models...',
            searchInputCssClass: 'text_pole',
            width: '100%',
            templateResult: getDreamGenModelTemplate,
        });
        $('#openrouter_model').select2({
            placeholder: 'Select a model',
            searchInputPlaceholder: 'Search models...',
            searchInputCssClass: 'text_pole',
            width: '100%',
            templateResult: getOpenRouterModelTemplate,
        });
        $('#vllm_model').select2({
            placeholder: 'Select a model',
            searchInputPlaceholder: 'Search models...',
            searchInputCssClass: 'text_pole',
            width: '100%',
            templateResult: getVllmModelTemplate,
        });
        $('#aphrodite_model').select2({
            placeholder: 'Select a model',
            searchInputPlaceholder: 'Search models...',
            searchInputCssClass: 'text_pole',
            width: '100%',
            templateResult: getAphroditeModelTemplate,
        });
        $('#featherless_model').select2({
            placeholder: 'Select a model',
            searchInputPlaceholder: 'Search models...',
            searchInputCssClass: 'text_pole',
            width: '100%',
            templateResult: getFeatherlessModelTemplate,
        });
        providersSelect.select2({
            sorter: data => data.sort((a, b) => a.text.localeCompare(b.text)),
            placeholder: 'Select providers. No selection = all providers.',
            searchInputPlaceholder: 'Search providers...',
            searchInputCssClass: 'text_pole',
            width: '100%',
            closeOnSelect: false,
        });
        providersSelect.on('select2:select', function (/** @type {any} */ evt) {
            const element = evt.params.data.element;
            const $element = $(element);

            $element.detach();
            $(this).append($element);
            $(this).trigger('change');
        });
    }
}
