import { getRequestHeaders } from "../script.js";

export const SECRET_KEYS = {
    HORDE: 'api_key_horde',
    OPENAI: 'api_key_openai',
    POE: 'api_key_poe',
    NOVEL: 'api_key_novel',
}

const INPUT_MAP = {
    [SECRET_KEYS.HORDE]: '#horde_api_key',
    [SECRET_KEYS.OPENAI]: '#api_key_openai',
    [SECRET_KEYS.POE]: '#poe_token',
    [SECRET_KEYS.NOVEL]: '#api_key_novel',
}

function updateSecretDisplay() {
    for (const [secret_key, input_selector] of Object.entries(INPUT_MAP)) {
        const validSecret = !!secret_state[secret_key];
        const placeholder = validSecret ? '✔️ Key saved' : '❌ Missing key'; 
        $(input_selector).attr('placeholder', placeholder).val('');
    }
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