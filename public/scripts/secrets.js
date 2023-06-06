import { callPopup, getRequestHeaders } from "../script.js";

export const SECRET_KEYS = {
    HORDE: 'api_key_horde',
    OPENAI: 'api_key_openai',
    POE: 'api_key_poe',
    NOVEL: 'api_key_novel',
    CLAUDE: 'api_key_claude',
}

const INPUT_MAP = {
    [SECRET_KEYS.HORDE]: '#horde_api_key',
    [SECRET_KEYS.OPENAI]: '#api_key_openai',
    [SECRET_KEYS.POE]: '#poe_token',
    [SECRET_KEYS.NOVEL]: '#api_key_novel',
    [SECRET_KEYS.CLAUDE]: '#api_key_claude',
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

    for (const [key,value] of Object.entries(data)) {
        $(table).append(`<tr><td>${DOMPurify.sanitize(key)}</td><td>${DOMPurify.sanitize(value)}</td></tr>`);
    }

    callPopup(table.outerHTML, 'text');
}

export let secret_state = {};

export async function writeSecret(key, value) {
    try {
        const response = await fetch('/writesecret', {
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
        const response = await fetch('/readsecretstate', {
            method: 'POST',
            headers: getRequestHeaders(),
        });

        if (response.ok) {
            secret_state = await response.json();
            updateSecretDisplay();
        }
    } catch {
        console.error('Could not read secrets file');
    }
}

jQuery(() => {
    $('#viewSecrets').on('click', viewSecrets);
    $(document).on('click', '.clear-api-key', clearSecret);
});
