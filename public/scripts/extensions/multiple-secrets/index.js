import { eventSource, event_types, saveSettingsDebounced } from "../../../script.js";
import { getRequestHeaders } from '../../../script.js';
import { oai_settings } from '../../openai.js';
import { secret_state, updateSecretDisplay, writeSecret, viewSecrets } from '../../secrets.js';
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

async function saveSecretsArray() {
	const key = "api_key_"+oai_settings.chat_completion_source
	const value = Array.from(document.querySelectorAll('.api_key_array')).map(input => input.value).filter(item => item.length > 0);
	await writeSecret(key+"_array", value)
	await switchSecretsFromArray()
	$('#api_button_openai').trigger('click');
}

function addApiKeyArray(){
	$('#api_key_array_container').append(`
        <div class="flex-container">
            <input name="api_key_array" class="text_pole flex1 api_key_array" maxlength="500" value="" type="text" autocomplete="off" placeholder="Please enter your API key">
            <div title="Clear your API key" data-i18n="[title]Clear your API key" class="menu_button fa-solid fa-circle-xmark remove-api-key-array"></div>
        </div>`
    );
}

const html = await renderExtensionTemplateAsync('multiple-secrets', 'index');
$('#extensions_settings').append('<div id="multiplesecrets_container" class="extension_container"></div>');
$('#multiplesecrets_container').append(html);
eventSource.on(event_types.GENERATION_STARTED, switchSecretsFromArray);
$(document).on('click', '.remove-api-key-array', function() {
	$(event.target).closest('.flex-container').remove();
});
$(document).on('click', '#save-api-key-array', saveSecretsArray);
$(document).on('click', '#add_api_key_array', addApiKeyArray);
$('.viewSecrets').on('click', viewSecrets);