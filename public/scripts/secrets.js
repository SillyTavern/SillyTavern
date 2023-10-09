import { callPopup, getRequestHeaders } from "../script.js";

export const SECRET_KEYS = {
    HORDE: 'api_key_horde',
    MANCER: 'api_key_mancer',
    APHRODITE: 'api_key_aphrodite',
    OPENAI: 'api_key_openai',
    NOVEL: 'api_key_novel',
    CLAUDE: 'api_key_claude',
    OPENROUTER: 'api_key_openrouter',
    SCALE: 'api_key_scale',
    AI21: 'api_key_ai21',
    SCALE_COOKIE: 'scale_cookie',
    PALM: 'api_key_palm',
}

const INPUT_MAP = {
    [SECRET_KEYS.HORDE]: '#horde_api_key',
    [SECRET_KEYS.MANCER]: '#api_key_mancer',
    [SECRET_KEYS.OPENAI]: '#api_key_openai',
    [SECRET_KEYS.NOVEL]: '#api_key_novel',
    [SECRET_KEYS.CLAUDE]: '#api_key_claude',
    [SECRET_KEYS.OPENROUTER]: '#api_key_openrouter',
    [SECRET_KEYS.SCALE]: '#api_key_scale',
    [SECRET_KEYS.AI21]: '#api_key_ai21',
    [SECRET_KEYS.SCALE_COOKIE]: '#scale_cookie',
    [SECRET_KEYS.PALM]: '#api_key_palm',
    [SECRET_KEYS.APHRODITE]: '#api_key_aphrodite',
}

async function clearSecret() {
    const key = $(this).data('key');
    await writeSecret(key, '');
    secret_state[key] = false;
    updateSecretDisplay();
    $(INPUT_MAP[key]).val('');
    $('#main_api').trigger('change');
}

function updateSecretDisplay() {
    for (const [secret_key, input_selector] of Object.entries(INPUT_MAP)) {
        const validSecret = !!secret_state[secret_key];
        const placeholder = validSecret ? '✔️ Key saved' : '❌ Missing key';
        $(input_selector).attr('placeholder', placeholder);
    }
}

async function viewSecrets() {
    const response = await fetch('/viewsecrets', {
        method: 'POST',
        headers: getRequestHeaders(),
    });

    if (response.status == 403) {
        callPopup('<h3>Forbidden</h3><p>To view your API keys here, set the value of allowKeysExposure to true in config.conf file and restart the SillyTavern server.</p>', 'text');
        return;
    }

    if (!response.ok) {
        return;
    }

    $('#dialogue_popup').addClass('wide_dialogue_popup');
    const data = await response.json();
    const table = document.createElement('table');
    table.classList.add('responsiveTable');
    $(table).append('<thead><th>Key</th><th>Value</th></thead>');

    for (const [key, value] of Object.entries(data)) {
        $(table).append(`<tr><td>${DOMPurify.sanitize(key)}</td><td>${DOMPurify.sanitize(value)}</td></tr>`);
    }

    callPopup(table.outerHTML, 'text');
}

export let secret_state = {};

export async function writeSecret(key, value) {
    try {
        const response = await fetch('/api/secrets/write', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ key, value }),
        });

        if (response.ok) {
            const text = await response.text();

            if (text == 'ok') {
                secret_state[key] = true;
                updateSecretDisplay();
            }
        }
    } catch {
        console.error('Could not write secret value: ', key);
    }
}

export async function readSecretState() {
    try {
        const response = await fetch('/api/secrets/read', {
            method: 'POST',
            headers: getRequestHeaders(),
        });

        if (response.ok) {
            secret_state = await response.json();
            updateSecretDisplay();
            await checkOpenRouterAuth();
        }
    } catch {
        console.error('Could not read secrets file');
    }
}

function authorizeOpenRouter() {
    const openRouterUrl = `https://openrouter.ai/auth?callback_url=${encodeURIComponent(location.origin)}`;
    location.href = openRouterUrl;
}

async function checkOpenRouterAuth() {
    const params = new URLSearchParams(location.search);
    if (params.has('code')) {
        const code = params.get('code');
        try {
            const response = await fetch("https://openrouter.ai/api/v1/auth/keys", {
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
                const urlWithoutSearchParams = currentUrl.split("?")[0];
                window.history.pushState({}, "", urlWithoutSearchParams);
            } else {
                throw new Error('OpenRouter token not saved');
            }
        } catch (err) {
            toastr.error('Could not verify OpenRouter token. Please try again.');
            return;
        }
    }
}

jQuery(async () => {
    $('#viewSecrets').on('click', viewSecrets);
    $(document).on('click', '.clear-api-key', clearSecret);
    $(document).on('input', Object.values(INPUT_MAP).join(','), function () {
        const id = $(this).attr('id');
        const value = $(this).val();
        const warningElement = $(`[data-for="${id}"]`);
        warningElement.toggle(value.length > 0);
    });
    $('#openrouter_authorize').on('click', authorizeOpenRouter);
});
