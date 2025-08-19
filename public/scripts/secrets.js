import { DOMPurify, moment } from '../lib.js';
import { event_types, eventSource, getRequestHeaders } from '../script.js';
import { t } from './i18n.js';
import { chat_completion_sources } from './openai.js';
import { callGenericPopup, Popup, POPUP_TYPE } from './popup.js';
import { SlashCommand } from './slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from './slash-commands/SlashCommandArgument.js';
import { enumIcons } from './slash-commands/SlashCommandCommonEnumsProvider.js';
import { enumTypes, SlashCommandEnumValue } from './slash-commands/SlashCommandEnumValue.js';
import { SlashCommandExecutor } from './slash-commands/SlashCommandExecutor.js';
import { SlashCommandParser } from './slash-commands/SlashCommandParser.js';
import { SlashCommandScope } from './slash-commands/SlashCommandScope.js';
import { renderTemplateAsync } from './templates.js';
import { textgen_types } from './textgen-settings.js';
import { copyText, isTrueBoolean } from './utils.js';

export const SECRET_KEYS = {
    HORDE: 'api_key_horde',
    MANCER: 'api_key_mancer',
    VLLM: 'api_key_vllm',
    APHRODITE: 'api_key_aphrodite',
    TABBY: 'api_key_tabby',
    OPENAI: 'api_key_openai',
    NOVEL: 'api_key_novel',
    CLAUDE: 'api_key_claude',
    DEEPL: 'deepl',
    LIBRE: 'libre',
    LIBRE_URL: 'libre_url',
    LINGVA_URL: 'lingva_url',
    OPENROUTER: 'api_key_openrouter',
    AI21: 'api_key_ai21',
    ONERING_URL: 'oneringtranslator_url',
    DEEPLX_URL: 'deeplx_url',
    MAKERSUITE: 'api_key_makersuite',
    VERTEXAI: 'api_key_vertexai',
    SERPAPI: 'api_key_serpapi',
    MISTRALAI: 'api_key_mistralai',
    TOGETHERAI: 'api_key_togetherai',
    INFERMATICAI: 'api_key_infermaticai',
    DREAMGEN: 'api_key_dreamgen',
    CUSTOM: 'api_key_custom',
    OOBA: 'api_key_ooba',
    NOMICAI: 'api_key_nomicai',
    KOBOLDCPP: 'api_key_koboldcpp',
    LLAMACPP: 'api_key_llamacpp',
    COHERE: 'api_key_cohere',
    PERPLEXITY: 'api_key_perplexity',
    GROQ: 'api_key_groq',
    AZURE_TTS: 'api_key_azure_tts',
    FEATHERLESS: 'api_key_featherless',
    HUGGINGFACE: 'api_key_huggingface',
    STABILITY: 'api_key_stability',
    CUSTOM_OPENAI_TTS: 'api_key_custom_openai_tts',
    NANOGPT: 'api_key_nanogpt',
    TAVILY: 'api_key_tavily',
    BFL: 'api_key_bfl',
    GENERIC: 'api_key_generic',
    DEEPSEEK: 'api_key_deepseek',
    SERPER: 'api_key_serper',
    AIMLAPI: 'api_key_aimlapi',
    FALAI: 'api_key_falai',
    XAI: 'api_key_xai',
    FIREWORKS: 'api_key_fireworks',
    VERTEXAI_SERVICE_ACCOUNT: 'vertexai_service_account_json',
    MINIMAX: 'api_key_minimax',
    MINIMAX_GROUP_ID: 'minimax_group_id',
    MOONSHOT: 'api_key_moonshot',
    COMETAPI: 'api_key_cometapi',
};

const FRIENDLY_NAMES = {
    [SECRET_KEYS.HORDE]: 'AI Horde',
    [SECRET_KEYS.MANCER]: 'Mancer',
    [SECRET_KEYS.OPENAI]: 'OpenAI',
    [SECRET_KEYS.NOVEL]: 'NovelAI',
    [SECRET_KEYS.CLAUDE]: 'Claude',
    [SECRET_KEYS.OPENROUTER]: 'OpenRouter',
    [SECRET_KEYS.AI21]: 'AI21',
    [SECRET_KEYS.MAKERSUITE]: 'Google AI Studio',
    [SECRET_KEYS.VERTEXAI]: 'Google Vertex AI (Express Mode)',
    [SECRET_KEYS.VLLM]: 'vLLM',
    [SECRET_KEYS.APHRODITE]: 'Aphrodite',
    [SECRET_KEYS.TABBY]: 'TabbyAPI',
    [SECRET_KEYS.MISTRALAI]: 'MistralAI',
    [SECRET_KEYS.CUSTOM]: 'Custom (OpenAI-compatible)',
    [SECRET_KEYS.TOGETHERAI]: 'TogetherAI',
    [SECRET_KEYS.OOBA]: 'Text Generation WebUI',
    [SECRET_KEYS.INFERMATICAI]: 'InfermaticAI',
    [SECRET_KEYS.DREAMGEN]: 'DreamGen',
    [SECRET_KEYS.NOMICAI]: 'NomicAI',
    [SECRET_KEYS.KOBOLDCPP]: 'KoboldCpp',
    [SECRET_KEYS.LLAMACPP]: 'llama.cpp',
    [SECRET_KEYS.COHERE]: 'Cohere',
    [SECRET_KEYS.PERPLEXITY]: 'Perplexity',
    [SECRET_KEYS.GROQ]: 'Groq',
    [SECRET_KEYS.FEATHERLESS]: 'Featherless',
    [SECRET_KEYS.HUGGINGFACE]: 'HuggingFace',
    [SECRET_KEYS.NANOGPT]: 'NanoGPT',
    [SECRET_KEYS.GENERIC]: 'Generic (OpenAI-compatible)',
    [SECRET_KEYS.DEEPSEEK]: 'DeepSeek',
    [SECRET_KEYS.XAI]: 'xAI (Grok)',
    [SECRET_KEYS.VERTEXAI_SERVICE_ACCOUNT]: 'Google Vertex AI (Service Account)',
    [SECRET_KEYS.STABILITY]: 'Stability AI',
    [SECRET_KEYS.CUSTOM_OPENAI_TTS]: 'Custom OpenAI TTS',
    [SECRET_KEYS.TAVILY]: 'Tavily',
    [SECRET_KEYS.BFL]: 'Black Forest Labs',
    [SECRET_KEYS.SERPAPI]: 'SerpApi',
    [SECRET_KEYS.SERPER]: 'Serper',
    [SECRET_KEYS.FALAI]: 'FAL.AI',
    [SECRET_KEYS.AZURE_TTS]: 'Azure TTS',
    [SECRET_KEYS.AIMLAPI]: 'AI/ML API',
    [SECRET_KEYS.FIREWORKS]: 'Fireworks AI',
    [SECRET_KEYS.DEEPL]: 'DeepL',
    [SECRET_KEYS.LIBRE]: 'LibreTranslate',
    [SECRET_KEYS.LIBRE_URL]: 'LibreTranslate Endpoint (e.g. http://127.0.0.1:5000/translate)',
    [SECRET_KEYS.LINGVA_URL]: 'Lingva Endpoint (e.g. https://lingva.ml/api/v1)',
    [SECRET_KEYS.ONERING_URL]: 'OneRingTranslator Endpoint (e.g. http://127.0.0.1:4990/translate)',
    [SECRET_KEYS.DEEPLX_URL]: 'DeepLX Endpoint (e.g. http://127.0.0.1:1188/translate)',
    [SECRET_KEYS.MINIMAX]: 'MiniMax TTS',
    [SECRET_KEYS.MINIMAX_GROUP_ID]: 'MiniMax Group ID',
    [SECRET_KEYS.MOONSHOT]: 'Moonshot AI',
    [SECRET_KEYS.COMETAPI]: 'CometAPI',
};

const INPUT_MAP = {
    [SECRET_KEYS.HORDE]: '#horde_api_key',
    [SECRET_KEYS.MANCER]: '#api_key_mancer',
    [SECRET_KEYS.OPENAI]: '#api_key_openai',
    [SECRET_KEYS.NOVEL]: '#api_key_novel',
    [SECRET_KEYS.CLAUDE]: '#api_key_claude',
    [SECRET_KEYS.OPENROUTER]: '.api_key_openrouter',
    [SECRET_KEYS.AI21]: '#api_key_ai21',
    [SECRET_KEYS.MAKERSUITE]: '#api_key_makersuite',
    [SECRET_KEYS.VERTEXAI]: '#api_key_vertexai',
    [SECRET_KEYS.VLLM]: '#api_key_vllm',
    [SECRET_KEYS.APHRODITE]: '#api_key_aphrodite',
    [SECRET_KEYS.TABBY]: '#api_key_tabby',
    [SECRET_KEYS.MISTRALAI]: '#api_key_mistralai',
    [SECRET_KEYS.CUSTOM]: '#api_key_custom',
    [SECRET_KEYS.TOGETHERAI]: '#api_key_togetherai',
    [SECRET_KEYS.OOBA]: '#api_key_ooba',
    [SECRET_KEYS.INFERMATICAI]: '#api_key_infermaticai',
    [SECRET_KEYS.DREAMGEN]: '#api_key_dreamgen',
    [SECRET_KEYS.KOBOLDCPP]: '#api_key_koboldcpp',
    [SECRET_KEYS.LLAMACPP]: '#api_key_llamacpp',
    [SECRET_KEYS.COHERE]: '#api_key_cohere',
    [SECRET_KEYS.PERPLEXITY]: '#api_key_perplexity',
    [SECRET_KEYS.GROQ]: '#api_key_groq',
    [SECRET_KEYS.FEATHERLESS]: '#api_key_featherless',
    [SECRET_KEYS.HUGGINGFACE]: '#api_key_huggingface',
    [SECRET_KEYS.NANOGPT]: '#api_key_nanogpt',
    [SECRET_KEYS.GENERIC]: '#api_key_generic',
    [SECRET_KEYS.DEEPSEEK]: '#api_key_deepseek',
    [SECRET_KEYS.AIMLAPI]: '#api_key_aimlapi',
    [SECRET_KEYS.XAI]: '#api_key_xai',
    [SECRET_KEYS.VERTEXAI_SERVICE_ACCOUNT]: '#vertexai_service_account_json',
    [SECRET_KEYS.MOONSHOT]: '#api_key_moonshot',
    [SECRET_KEYS.FIREWORKS]: '#api_key_fireworks',
    [SECRET_KEYS.COMETAPI]: '#api_key_cometapi',
};

const getLabel = () => moment().format('L LT');

/**
 * Resolves the secret key based on the selected API, chat completion source, and text completion type.
 * @returns {string|null} The secret key corresponding to the selected API, or null if no key is found.
 */
export function resolveSecretKey() {
    const { mainApi, chatCompletionSettings, textCompletionSettings } = SillyTavern.getContext();
    const chatCompletionSource = chatCompletionSettings.chat_completion_source;
    const textCompletionType = textCompletionSettings.type;

    if (mainApi === 'koboldhorde') {
        return SECRET_KEYS.HORDE;
    }

    if (mainApi === 'novel') {
        return SECRET_KEYS.NOVEL;
    }

    if (mainApi === 'textgenerationwebui') {
        const [key] = Object.entries(textgen_types).find(([, value]) => value === textCompletionType) ?? [null];
        if (key && SECRET_KEYS[key]) {
            return SECRET_KEYS[key];
        }
    }

    if (mainApi === 'openai') {
        if (chatCompletionSource === chat_completion_sources.VERTEXAI) {
            switch (chatCompletionSettings.vertexai_auth_mode) {
                case 'express':
                    return SECRET_KEYS.VERTEXAI;
                case 'full':
                    return SECRET_KEYS.VERTEXAI_SERVICE_ACCOUNT;
            }
        }

        const [key] = Object.entries(chat_completion_sources).find(([, value]) => value === chatCompletionSource) ?? [null];
        if (key && SECRET_KEYS[key]) {
            return SECRET_KEYS[key];
        }
    }

    return null;
}

/**
 * Gets the label of a secret by its ID.
 * @param {string} id The ID of the secret to find.
 * @returns {string} The label of the secret with the given ID, or an empty string if not found.
 */
export function getSecretLabelById(id) {
    for (const key of Object.values(SECRET_KEYS)) {
        const secrets = secret_state[key];
        if (!Array.isArray(secrets)) {
            continue;
        }
        const secret = secrets.find(s => s.id === id);
        if (secret) {
            return `${secret.label} (${secret.value})`;
        }
    }
    return '';
}

export function updateSecretDisplay() {
    for (const [secret_key, input_selector] of Object.entries(INPUT_MAP)) {
        const validSecret = !!secret_state[secret_key];
        const placeholder = $('#viewSecrets').attr(validSecret ? 'key_saved_text' : 'missing_key_text');
        const label = getActiveSecretLabel(secret_key);
        const placeholderWithLabel = label ? `${placeholder} (${label})` : placeholder;
        $(input_selector).attr('placeholder', placeholderWithLabel);
    }
}

/**
 * Gets the active secret label for a given key.
 * @param {string} key Gets the active secret label for a given key.
 * @returns {string} The label of the active secret, or '[No label]' if none is active.
 */
function getActiveSecretLabel(key) {
    const selectedSecret = secret_state[key];
    if (Array.isArray(selectedSecret)) {
        const activeSecret = selectedSecret.find(x => x.active);
        if (!activeSecret) {
            return '';
        }
        return activeSecret.label || activeSecret.value || t`[No label]`;
    }
    return '';
}

async function viewSecrets() {
    const response = await fetch('/api/secrets/view', {
        method: 'POST',
        headers: getRequestHeaders(),
    });

    if (response.status == 403) {
        await Popup.show.text(t`Forbidden`, t`To view your API keys here, set the value of allowKeysExposure to true in config.yaml file and restart the SillyTavern server.`);
        return;
    }

    if (!response.ok) {
        return;
    }

    const data = await response.json();
    const table = document.createElement('table');
    table.classList.add('responsiveTable');
    $(table).append('<thead><th>Key</th><th>Value</th></thead>');

    for (const [key, value] of Object.entries(data)) {
        $(table).append(`<tr><td>${DOMPurify.sanitize(key)}</td><td>${DOMPurify.sanitize(value)}</td></tr>`);
    }

    await callGenericPopup(table.outerHTML, POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true });
}

/**
 * @type {import('../../src/endpoints/secrets.js').SecretStateMap}
 */
export let secret_state = {};

/**
 * Write a secret value to the server.
 * @param {string} key Secret key
 * @param {string} value Secret value to write
 * @param {string} [label] (Optional) Label for the key. If not provided, generated automatically.
 * @return {Promise<string?>} The ID of the newly created secret key, or null if no value is provided.
 */
export async function writeSecret(key, value, label) {
    try {
        if (!value) {
            console.warn(`No value provided for ${key} in writeSecret, redirecting to deleteSecret`);
            await deleteSecret(key);
            return null;
        }

        if (!label) {
            label = getLabel();
        }

        const response = await fetch('/api/secrets/write', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ key, value, label }),
        });

        if (!response.ok) {
            return null;
        }

        const { id } = await response.json();
        // Clear the input field
        $(INPUT_MAP[key]).val('').trigger('input');
        await readSecretState();
        await eventSource.emit(event_types.SECRET_WRITTEN, key);
        return id;
    } catch (error) {
        console.error(`Could not write secret value: ${key}`, error);
        return null;
    }
}

/**
 * Deletes a secret value from the server.
 * @param {string} key Secret key
 * @param {string} [id] (Optional) ID of the secret key to delete. If not provided, deletes an active key.
 */
export async function deleteSecret(key, id) {
    try {
        const response = await fetch('/api/secrets/delete', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ key, id }),
        });

        if (response.ok) {
            await readSecretState();
            // Force reconnection to the API with the new key
            $('#main_api').trigger('change');
            await eventSource.emit(event_types.SECRET_DELETED, key);
        }
    } catch (error) {
        console.error(`Could not delete secret value: ${key}`, error);
    }
}

/**
 * Reads the current state of secrets from the server.
 * @returns {Promise<void>}
 */
export async function readSecretState() {
    try {
        const response = await fetch('/api/secrets/read', {
            method: 'POST',
            headers: getRequestHeaders(),
        });

        if (response.ok) {
            secret_state = await response.json();
            updateSecretDisplay();
            updateInputDataLists();
            await checkOpenRouterAuth();
        }
    } catch {
        console.error('Could not read secrets file');
    }
}

/**
 * Finds a secret value by key.
 * @param {string} key Secret key
 * @param {string} [id] ID of the secret to find. If not provided, will return the active secret.
 * @returns {Promise<string?>} Secret value, or null if keys are not exposed
 */
export async function findSecret(key, id) {
    try {
        const response = await fetch('/api/secrets/find', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ key, id }),
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        return data.value;
    } catch {
        console.error('Could not find secret value: ', key);
        return null;
    }
}

/**
 * Changes the active value for a given secret key.
 * @param {string} key Secret key to rotate
 * @param {string} id ID of the secret to rotate
 */
export async function rotateSecret(key, id) {
    try {
        const response = await fetch('/api/secrets/rotate', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ key, id }),
        });

        if (response.ok) {
            await readSecretState();
            // Force reconnection to the API with the new key
            $('#main_api').trigger('change');
            await eventSource.emit(event_types.SECRET_ROTATED, key);
        }
    } catch (error) {
        console.error(`Could not rotate secret value: ${key}`, error);
    }
}

/**
 * Renames a secret value on the server.
 * @param {string} key Secret key to rename
 * @param {string} id ID of the secret to rename
 * @param {string} label Label to rename the secret to
 */
export async function renameSecret(key, id, label) {
    try {
        const response = await fetch('/api/secrets/rename', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ key, id, label }),
        });

        if (response.ok) {
            await readSecretState();
            await eventSource.emit(event_types.SECRET_EDITED, key);
        }
    } catch (error) {
        console.error(`Could not rename secret value: ${key}`, error);
    }
}

/**
 * Redirects the user to authorize OpenRouter.
 */
function authorizeOpenRouter() {
    const redirectUrl = new URL('/callback/openrouter', window.location.origin);
    const openRouterUrl = `https://openrouter.ai/auth?callback_url=${encodeURIComponent(redirectUrl.toString())}`;
    location.href = openRouterUrl;
}

/**
 * Checks if the OpenRouter authorization code is present in the URL, and if so, exchanges it for an API key.
 * @returns {Promise<void>}
 */
async function checkOpenRouterAuth() {
    const params = new URLSearchParams(location.search);
    const source = params.get('source');
    if (source === 'openrouter') {
        const query = new URLSearchParams(params.get('query'));
        const code = query.get('code');
        try {
            const response = await fetch('https://openrouter.ai/api/v1/auth/keys', {
                method: 'POST',
                body: JSON.stringify({ code }),
            });

            if (!response.ok) {
                throw new Error('OpenRouter exchange error');
            }

            const data = await response.json();
            if (!data || !data.key) {
                throw new Error('OpenRouter invalid response');
            }

            await writeSecret(SECRET_KEYS.OPENROUTER, data.key);

            if (secret_state[SECRET_KEYS.OPENROUTER]) {
                toastr.success('OpenRouter token saved');
                // Remove the code from the URL
                const currentUrl = window.location.href;
                const urlWithoutSearchParams = currentUrl.split('?')[0];
                window.history.pushState({}, '', urlWithoutSearchParams);
            } else {
                throw new Error('OpenRouter token not saved');
            }
        } catch (err) {
            toastr.error('Could not verify OpenRouter token. Please try again.');
            return;
        }
    }
}

/**
 * Updates the input data lists for secret keys for autocomplete functionality.
 */
function updateInputDataLists() {
    let container = document.getElementById('secrets_datalists');
    if (!container) {
        container = document.createElement('div');
        container.id = 'secrets_datalists';
        container.style.display = 'none';
        document.body.appendChild(container);
    }

    for (const [key, inputSelector] of Object.entries(INPUT_MAP)) {
        const inputElements = document.querySelectorAll(inputSelector);
        if (inputElements.length === 0) {
            console.warn(`No input elements found for key: ${key}`);
            continue;
        }

        const dataListId = `${key}_datalist`;
        let dataList = document.getElementById(dataListId);
        if (!dataList) {
            dataList = document.createElement('datalist');
            dataList.id = dataListId;
            container.appendChild(dataList);
        }

        // Clear existing options
        dataList.innerHTML = '';

        const secrets = secret_state[key];
        if (!Array.isArray(secrets)) {
            continue;
        }

        for (const secret of secrets) {
            const option = document.createElement('option');
            option.value = secret.id;
            option.textContent = `${secret.label} (${secret.value})`;
            dataList.appendChild(option);
        }

        // Set the input element to use the datalist
        inputElements.forEach(element => {
            element.setAttribute('list', dataListId);
        });
    }
}

/**
 * Opens the key manager dialog for a specific key.
 * @param {string} key Key for which to open the key manager dialog.
 */
async function openKeyManagerDialog(key) {
    const name = FRIENDLY_NAMES[key] || key;
    const template = $(await renderTemplateAsync('secretKeyManager', { name, key }));
    template.find('button[data-action="add-secret"]').on('click', async function () {
        let label = '';
        const value = await Popup.show.input(t`Add Secret`, t`Enter the secret value:`, '', {
            customInputs: [{
                id: 'newSecretLabel',
                type: 'text',
                label: t`Enter a label for the secret (optional):`,
            }],
            onClose: popup => {
                if (popup.result) {
                    label = popup.inputResults.get('newSecretLabel').toString().trim();
                }
            },
        });
        if (!value) {
            return;
        }
        await writeSecret(key, value, label);
        await renderSecretsList();
    });

    await renderSecretsList();
    await callGenericPopup(template, POPUP_TYPE.TEXT, '', { wide: true, large: true, onOpen: scrollToActive });

    async function renderSecretsList() {
        const secrets = secret_state[key] ?? [];
        const list = template.find('.secretKeyManagerList');
        const previousScrollTop = list.scrollTop();

        const emptyMessage = template.find('.secretKeyManagerListEmpty');
        emptyMessage.toggle(secrets.length === 0);

        const itemBlocks = [];
        for (const secret of secrets) {
            const itemTemplate = $(await renderTemplateAsync('secretKeyManagerListItem', secret));
            itemTemplate.find('[data-action="copy-id"]').on('click', async function () {
                await copyText(secret.id);
                toastr.info(t`Secret ID copied to clipboard.`);
            });
            itemTemplate.find('button[data-action="rotate-secret"]').on('click', async function () {
                await rotateSecret(key, secret.id);
                await renderSecretsList();
            });
            itemTemplate.find('button[data-action="copy-secret"]').on('click', async function () {
                const secretValue = await findSecret(key, secret.id);
                if (secretValue === null) {
                    toastr.error(t`The key exposure might be disabled by the server config.`, t`Failed to copy secret value`);
                    return;
                }
                await copyText(secretValue);
                toastr.info(t`Secret value copied to clipboard.`);
            });
            itemTemplate.find('button[data-action="rename-secret"]').on('click', async function () {
                const label = await Popup.show.input(t`Rename Secret`, t`Enter new label for the secret:`, secret?.label || getLabel());
                if (!label) {
                    return;
                }
                await renameSecret(key, secret.id, label);
                await renderSecretsList();
            });
            itemTemplate.find('button[data-action="delete-secret"]').on('click', async function () {
                const confirm = await Popup.show.confirm(t`Delete Secret: ${secret?.label}`, t`Are you sure you want to delete this secret? This action cannot be undone.`);
                if (!confirm) {
                    return;
                }
                await deleteSecret(key, secret.id);
                await renderSecretsList();
            });
            itemBlocks.push(itemTemplate);
        }

        list.empty().append(itemBlocks).scrollTop(previousScrollTop);
    }

    function scrollToActive() {
        const list = template.find('.secretKeyManagerList');
        const activeKey = list.find('.active');
        if (activeKey.length > 0) {
            const activeKeyScrollTop = activeKey.position().top + list.scrollTop() - list.height() / 2;
            list.scrollTop(activeKeyScrollTop);
        }
    }
}

function registerSecretSlashCommands() {
    const secretKeyEnumProvider = () => Object.values(SECRET_KEYS).map(key => new SlashCommandEnumValue(key, FRIENDLY_NAMES[key] || key, enumTypes.name, enumIcons.key));
    const secretIdEnumProvider = (/** @type {SlashCommandExecutor} */ executor, /** @type {SlashCommandScope} */ _scope) => {
        const key = executor?.namedArgumentList?.find(x => x.name === 'key')?.value?.toString() || resolveSecretKey();
        if (!key || !secret_state[key] || !Array.isArray(secret_state[key]) || secret_state[key].length === 0) {
            return [];
        }

        return secret_state[key].map(secret => {
            return new SlashCommandEnumValue(secret.id, `${secret.label} (${secret.value})`, enumTypes.name, enumIcons.key);
        });
    };

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'secret-id',
        aliases: ['secret-rotate'],
        helpString: t`Sets the ID of a currently active secret key. Gets the ID of the secret key if no value is provided.`,
        returns: t`The ID of the secret key that is now active.`,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'quiet',
                description: t`Suppress toast message notifications.`,
                isRequired: false,
                defaultValue: String(false),
                typeList: [ARGUMENT_TYPE.BOOLEAN],
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'key',
                description: t`The key to get the secret ID for. If not provided, will use the currently active API secrets.`,
                isRequired: false,
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: secretKeyEnumProvider,
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`The ID or a label of the secret key to set as active. If not provided, will return the currently active secret ID.`,
                isRequired: true,
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: secretIdEnumProvider,
            }),
        ],
        callback: async (args, value) => {
            const quiet = isTrueBoolean(args?.quiet?.toString());
            const id = value?.toString()?.trim();
            const key = args?.key?.toString()?.trim() || resolveSecretKey();

            if (!key) {
                if (!quiet) {
                    toastr.error(t`No secret key provided, and the key can't be resolved for the currently selected API type.`);
                }
                return '';
            }

            const secrets = secret_state[key];
            if (!Array.isArray(secrets) || secrets.length === 0) {
                if (!quiet) {
                    toastr.error(t`No saved secrets found for the key: ${key}`);
                }
                return '';
            }

            if (!id) {
                const activeSecret = secrets.find(s => s.active);
                if (!activeSecret) {
                    if (!quiet) {
                        toastr.error(t`No active secret found for the key: ${key}`);
                    }
                    return '';
                }
                return activeSecret.id;
            }

            const savedSecret = secrets.find(s => s.id === id) ?? secrets.find(s => s.label === id);
            if (!savedSecret) {
                if (!quiet) {
                    toastr.error(t`No secret found with ID: ${id} for the key: ${key}`);
                }
                return '';
            }

            // Set the secret as active
            await rotateSecret(key, savedSecret.id);
            if (!quiet) {
                toastr.success(t`Secret with ID: ${id} is now active for the key: ${key}`);
            }

            return savedSecret.id;
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'secret-delete',
        helpString: t`Deletes a secret key by ID.`,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'quiet',
                description: t`Suppress toast message notifications.`,
                isRequired: false,
                defaultValue: String(false),
                typeList: [ARGUMENT_TYPE.BOOLEAN],
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'key',
                description: t`The key to delete the secret from. If not provided, will use the currently active API secrets.`,
                isRequired: false,
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: secretKeyEnumProvider,
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`The ID or a label of the secret key to delete. If not provided, will delete the active secret.`,
                isRequired: true,
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: secretIdEnumProvider,
            }),
        ],
        callback: async (args, value) => {
            const quiet = isTrueBoolean(args?.quiet?.toString());
            const id = value?.toString()?.trim();
            const key = args?.key?.toString()?.trim() || resolveSecretKey();

            if (!key) {
                if (!quiet) {
                    toastr.error(t`No secret key provided, and the key can't be resolved for the currently selected API type.`);
                }
                return '';
            }

            const secrets = secret_state[key];
            if (!Array.isArray(secrets) || secrets.length === 0) {
                if (!quiet) {
                    toastr.error(t`No saved secrets found for the key: ${key}`);
                }
                return '';
            }

            const savedSecret = secrets.find(s => s.id === id) ?? secrets.find(s => s.label === id) ?? secrets.find(s => s.active);
            if (!savedSecret) {
                if (!quiet) {
                    toastr.error(t`No secret found with ID: ${id} for the key: ${key}`);
                }
                return '';
            }

            // Delete the secret
            await deleteSecret(key, savedSecret.id);
            if (!quiet) {
                toastr.success(t`Secret with ID: ${id} has been deleted for the key: ${key}`);
            }

            return savedSecret.id;
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'secret-write',
        helpString: t`Writes a secret key with a value and an optional label.`,
        returns: t`The ID of the newly created secret key.`,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'quiet',
                description: t`Suppress toast message notifications.`,
                isRequired: false,
                defaultValue: String(false),
                typeList: [ARGUMENT_TYPE.BOOLEAN],
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'key',
                description: t`The key to write the secret to. If not provided, will use the currently active API secrets.`,
                isRequired: false,
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: secretKeyEnumProvider,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'label',
                description: t`The label for the secret key. If not provided, will use the current date and time.`,
                isRequired: false,
                typeList: [ARGUMENT_TYPE.STRING],
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`The value of the secret key to write.`,
                isRequired: true,
                typeList: [ARGUMENT_TYPE.STRING],
            }),
        ],
        callback: async (args, value) => {
            const quiet = isTrueBoolean(args?.quiet?.toString());
            const key = args?.key?.toString()?.trim() || resolveSecretKey();

            if (!key) {
                if (!quiet) {
                    toastr.error(t`No secret key provided, and the key can't be resolved for the currently selected API type.`);
                }
                return '';
            }

            const secrets = secret_state[key];
            if (!Array.isArray(secrets) || secrets.length === 0) {
                if (!quiet) {
                    toastr.error(t`No saved secrets found for the key: ${key}`);
                }
                return '';
            }

            const valueStr = value?.toString()?.trim();
            if (!valueStr) {
                if (!quiet) {
                    toastr.error(t`No value provided for the secret key: ${key}`);
                }
                return '';
            }

            const label = args?.label?.toString()?.trim() || getLabel();
            const id = await writeSecret(key, valueStr, label);

            if (!quiet) {
                toastr.success(t`Secret has been written for the key: ${key}`);
            }

            return id || '';
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'secret-rename',
        helpString: t`Renames a secret key by ID.`,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'quiet',
                description: t`Suppress toast message notifications.`,
                isRequired: false,
                defaultValue: String(false),
                typeList: [ARGUMENT_TYPE.BOOLEAN],
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'key',
                description: t`The key to rename the secret in. If not provided, will use the currently active API secrets.`,
                isRequired: false,
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: secretKeyEnumProvider,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'id',
                description: t`The ID of the secret to rename. If not provided, will rename the active secret.`,
                isRequired: true,
                typeList: [ARGUMENT_TYPE.STRING],
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`The new label for the secret key.`,
                isRequired: true,
                typeList: [ARGUMENT_TYPE.STRING],
            }),
        ],
        callback: async (args, value) => {
            const quiet = isTrueBoolean(args?.quiet?.toString());
            const key = args?.key?.toString()?.trim() || resolveSecretKey();
            const id = args?.id?.toString()?.trim();

            if (!key) {
                if (!quiet) {
                    toastr.error(t`No secret key provided, and the key can't be resolved for the currently selected API type.`);
                }
                return '';
            }

            const secrets = secret_state[key];
            if (!Array.isArray(secrets) || secrets.length === 0) {
                if (!quiet) {
                    toastr.error(t`No saved secrets found for the key: ${key}`);
                }
                return '';
            }

            const newLabel = value?.toString()?.trim();
            if (!newLabel) {
                if (!quiet) {
                    toastr.error(t`No new label provided for the secret key: ${key}`);
                }
                return '';
            }

            const savedSecret = secrets.find(s => s.id === id) ?? secrets.find(s => s.label === id) ?? secrets.find(s => s.active);
            if (!savedSecret) {
                if (!quiet) {
                    toastr.error(t`No secret found with ID: ${id} for the key: ${key}`);
                }
                return '';
            }

            // Rename the secret
            await renameSecret(key, savedSecret.id, newLabel);
            if (!quiet) {
                toastr.success(t`Secret with ID: ${id} has been renamed to "${newLabel}" for the key: ${key}`);
            }

            return savedSecret.id;
        },
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'secret-read',
        aliases: ['secret-find', 'secret-get'],
        helpString: t`Reads a secret key by ID. If key exposure is disabled, this command will not work!`,
        returns: t`The value of the secret key.`,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'quiet',
                description: t`Suppress toast message notifications.`,
                isRequired: false,
                defaultValue: String(false),
                typeList: [ARGUMENT_TYPE.BOOLEAN],
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'key',
                description: t`The key to read the secret from. If not provided, will use the currently active API secrets.`,
                isRequired: false,
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: secretKeyEnumProvider,
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: t`The ID or a label of the secret key to read. If not provided, will return the currently active secret value.`,
                isRequired: true,
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: secretIdEnumProvider,
            }),
        ],
        callback: async (args, value) => {
            const quiet = isTrueBoolean(args?.quiet?.toString());
            const key = args?.key?.toString()?.trim() || resolveSecretKey();
            const id = value?.toString()?.trim();

            if (!key) {
                if (!quiet) {
                    toastr.error(t`No secret key provided, and the key can't be resolved for the currently selected API type.`);
                }
                return '';
            }

            const secrets = secret_state[key];
            if (!Array.isArray(secrets) || secrets.length === 0) {
                if (!quiet) {
                    toastr.error(t`No saved secrets found for the key: ${key}`);
                }
                return '';
            }

            const savedSecret = secrets.find(s => s.id === id) ?? secrets.find(s => s.label === id) ?? secrets.find(s => s.active);
            if (!savedSecret) {
                if (!quiet) {
                    toastr.error(t`No secret found with ID: ${id} for the key: ${key}`);
                }
                return '';
            }

            const secretValue = await findSecret(key, savedSecret.id);
            if (secretValue === null) {
                if (!quiet) {
                    toastr.error(t`Could not retrieve the secret value for key: ${key}. Key exposure might be disabled.`);
                }
                return '';
            }

            return secretValue;
        },
    }));
}

export async function initSecrets() {
    $('#viewSecrets').on('click', viewSecrets);
    $(document).on('click', '.manage-api-keys', async function () {
        const key = $(this).data('key');
        if (!key || !Object.values(SECRET_KEYS).includes(key)) {
            console.error('Invalid key for manage-api-keys:', key);
            return;
        }
        await openKeyManagerDialog(key);
    });
    $(document).on('input', Object.values(INPUT_MAP).join(','), function () {
        const id = $(this).attr('id');
        const value = $(this).val();

        // Find the key based on the entered value
        for (const [key, inputSelector] of Object.entries(INPUT_MAP)) {
            if (!value || !this.matches(inputSelector)) {
                continue;
            }
            const secrets = secret_state[key];
            if (!Array.isArray(secrets)) {
                continue;
            }
            const secretMatch = secrets.find(secret => secret.id === value);
            if (secretMatch) {
                $(this).val('');
                return rotateSecret(key, secretMatch.id);
            }
        }

        const warningElement = $(`[data-for="${id}"]`);
        warningElement.toggle(value.length > 0);
    });
    $('.openrouter_authorize').on('click', authorizeOpenRouter);
    registerSecretSlashCommands();
}
