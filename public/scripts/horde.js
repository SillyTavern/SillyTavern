import { saveSettingsDebounced, changeMainAPI, callPopup } from "../script.js";
import { delay } from "./utils.js";

export {
    horde_settings,
    generateHorde,
    checkHordeStatus,
    loadHordeSettings,
    adjustHordeGenerationParams,
}

let models = [];

let horde_settings = {
    api_key: '0000000000',
    model: null,
    use_horde: false,
    auto_adjust: true,
};

const MAX_RETRIES = 100;
const CHECK_INTERVAL = 1000;

async function getWorkers() {
    const response = await fetch('https://horde.koboldai.net/api/v2/workers?type=text');
    const data = await response.json();
    return data;
}

async function adjustHordeGenerationParams(max_context_length, max_length) {
    const workers = await getWorkers();
    let maxContextLength = max_context_length;
    let maxLength = max_length;
    let availableWorkers = [];
    let selectedModel = models.find(m => m.name == horde_settings.model);

    if (!selectedModel) {
        return { maxContextLength, maxLength };
    }

    for (const worker of workers) {
        if (selectedModel.cluster == worker.cluster && worker.models.includes(selectedModel.name)) {
            availableWorkers.push(worker);
        }
    }

    //get the minimum requires parameters, lowest common value for all selected
    for (const worker of availableWorkers) {
        maxContextLength = Math.min(worker.max_context_length, maxContextLength);
        maxLength = Math.min(worker.max_length, maxLength);
    }

    return { maxContextLength, maxLength };
}

async function generateHorde(prompt, params) {
    delete params.prompt;

    const payload = {
        "prompt": prompt,
        "params": params,
        "trusted_workers": false,
        "slow_workers": false,
        "models": [horde_settings.model],
    };

    const response = await fetch("https://horde.koboldai.net/api/v2/generate/text/async", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "apikey": horde_settings.api_key,
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const error = await response.json();
        callPopup(error.message, 'text');
        throw new Error('Horde generation failed: ' + error.message);
    }

    const responseJson = await response.json();
    const task_id = responseJson.id;
    console.log(`Horde task id = ${task_id}`);

    for (let retryNumber = 0; retryNumber < MAX_RETRIES; retryNumber++) {
        await delay(CHECK_INTERVAL);

        const statusCheckResponse = await fetch(`https://horde.koboldai.net/api/v2/generate/text/status/${task_id}`, {
            headers: {
                "Content-Type": "application/json",
                "apikey": horde_settings.api_key,
            }
        });

        const statusCheckJson = await statusCheckResponse.json();
        console.log(statusCheckJson);

        if (statusCheckJson.done) {
            const generatedText = statusCheckJson.generations[0];
            console.log(generatedText);
            return generatedText;
        }
    }
}

async function checkHordeStatus() {
    const response = await fetch('https://horde.koboldai.net/api/v2/status/heartbeat');
    return response.ok;
}

async function getHordeModels() {
    $('#horde_model').empty();
    const response = await fetch('https://horde.koboldai.net/api/v2/status/models?type=text');
    models = await response.json();

    for (const model of models) {
        const option = document.createElement('option');
        option.value = model.name;
        option.innerText = `${model.name} (Queue: ${model.queued}, Workers: ${model.count})`;
        option.selected = horde_settings.model === model.name;
        $('#horde_model').append(option);
    }
}

function loadHordeSettings(settings) {
    if (settings.horde_settings) {
        Object.assign(horde_settings, settings.horde_settings);
    }

    $('#use_horde').prop("checked", horde_settings.use_horde).trigger('input');
    $('#horde_api_key').val(horde_settings.api_key);
    $('#horde_auto_adjust').prop("checked", horde_settings.auto_adjust);
}

$(document).ready(function () {
    $("#use_horde").on("input", async function () {
        horde_settings.use_horde = !!$(this).prop("checked");

        if (horde_settings.use_horde) {
            $('#kobold_api_block').hide();
            $('#kobold_horde_block').show();
        }
        else {
            $('#kobold_api_block').show();
            $('#kobold_horde_block').hide();
        }

        // Trigger status check
        changeMainAPI();
        saveSettingsDebounced();

        if (horde_settings.use_horde) {
            await getHordeModels();
        }
    });

    $("#horde_model").on("change", function () {
        horde_settings.model = $(this).val();
        saveSettingsDebounced();
    });

    $("#horde_api_key").on("input", function () {
        horde_settings.api_key = $(this).val();
        saveSettingsDebounced();
    });

    $("#horde_auto_adjust").on("input", function () {
        horde_settings.auto_adjust = !!$(this).prop("checked");
        saveSettingsDebounced();
    });
})