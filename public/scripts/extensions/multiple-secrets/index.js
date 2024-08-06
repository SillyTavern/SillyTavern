import { eventSource, event_types, saveSettingsDebounced } from "../../../script.js";
import { getRequestHeaders } from '../../../script.js';
import { oai_settings } from '../../openai.js';
import { secret_state, updateSecretDisplay, writeSecret } from '../../secrets.js';
import { renderExtensionTemplateAsync, extension_settings } from '../../extensions.js';


async function switchSecretsFromArray(generationType, _args, isDryRun) {
	if (!isDryRun) {
    	const key = "api_key_"+oai_settings.chat_completion_source;
        try {
            const response = await fetch('/api/plugins/multiple-secrets/switch', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({ key }),
            });
            if (response.status == 200) {
                secret_state[key] = true;
                updateSecretDisplay();
            }
        } catch {
            console.error('Could not write secret value: ', key);
        }
    }
}

function updateSecretsArrayDisplay() {
    const validSecret = !!secret_state["api_key_"+oai_settings.chat_completion_source];
    const placeholder = $('#viewSecrets').attr(validSecret ? 'key_saved_text' : 'missing_key_text');
    $("#api_key_array").attr('placeholder', placeholder);
}

async function saveSecretsArray() {
	const key = "api_key_"+oai_settings.chat_completion_source
	const value = document.getElementById("api_key_array").value.split(",")
	await writeSecret(key+"_array", value)
	await switchSecretsFromArray()
	$('#api_button_openai').trigger('click');
}

function clearSecretsArray() {
    const key = "api_key_"+oai_settings.chat_completion_source;
    writeSecret(key+"_array", '');
    secret_state[key] = false;
    updateSecretDisplay();
    updateSecretsArrayDisplay()
    $('#api_key_array').val('').trigger('input');
    $('#main_api').trigger('change');
    $('#api_button_openai').trigger('click');
}

const html = await renderExtensionTemplateAsync('multiple-secrets', 'index');
$('#extensions_settings').append('<div id="multiplesecrets_container" class="extension_container"></div>');
$('#multiplesecrets_container').append(html);
eventSource.on(event_types.GENERATION_STARTED, switchSecretsFromArray);
$(document).on('click', '.clear-api-key-array', clearSecretsArray);
$(document).on('click', '.save-api-key-array', saveSecretsArray);
updateSecretsArrayDisplay()