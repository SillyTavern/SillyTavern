import { saveSettingsDebounced, changeMainAPI, callPopup, setGenerationProgress, main_api } from "../script.js";
import { delay } from "./utils.js";

export {
    horde_settings,
    generateHorde,
    checkHordeStatus,
    loadHordeSettings,
    adjustHordeGenerationParams,
    getHordeModels,
}

let models = [];

let horde_settings = {
    api_key: '0000000000',
    model: null,
    use_horde: false,
    auto_adjust: true,
};

const MAX_RETRIES = 100;
const CHECK_INTERVAL = 3000;

async function getWorkers() {
    const response = await fetch('https://horde.koboldai.net/api/v2/workers?type=text');
    const data = await response.json();
    return data;
}

function validateHordeModel() {
    let selectedModel = models.find(m => m.name == horde_settings.model);

    if (!selectedModel) {
        callPopup('No Horde model selected or the selected model is no longer available. Please choose another model', 'text');
        throw new Error('No Horde model available');
    }

    return selectedModel;
}

async function adjustHordeGenerationParams(max_context_length, max_length) {
    const workers = await getWorkers();
    let maxContextLength = max_context_length;
    let maxLength = max_length;
    let availableWorkers = [];
    let selectedModel = validateHordeModel();

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
    validateHordeModel();
    delete params.prompt;

    // No idea what these do
    params["n"] = 1;
    params["frmtadsnsp"] = false;
    params["frmtrmblln"] = false;
    params["frmtrmspch"] = false;
    params["frmttriminc"] = false;

    const payload = {
        "prompt": prompt,
        "params": params,
        //"trusted_workers": false,
        //"slow_workers": false,
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
    let queue_position_first = null;
    console.log(`Horde task id = ${task_id}`);

    for (let retryNumber = 0; retryNumber < MAX_RETRIES; retryNumber++) {
        const statusCheckResponse = await fetch(`https://horde.koboldai.net/api/v2/generate/text/status/${task_id}`, {
            headers: {
                "Content-Type": "application/json",
                "apikey": horde_settings.api_key,
            }
        });

        const statusCheckJson = await statusCheckResponse.json();
        console.log(statusCheckJson);

        if (statusCheckJson.done && Array.isArray(statusCheckJson.generations) && statusCheckJson.generations.length) {
            setGenerationProgress(100);
            const generatedText = statusCheckJson.generations[0].text;
            console.log(generatedText);
            return generatedText;
        }
        else if (!queue_position_first) {
            queue_position_first = statusCheckJson.queue_position;
            setGenerationProgress(0);
        }
        else if (statusCheckJson.queue_position >= 0) {
            let queue_position = statusCheckJson.queue_position;
            const progress = Math.round(100 - (queue_position / queue_position_first * 100));
            setGenerationProgress(progress);
        }

        await delay(CHECK_INTERVAL);
    }

    callPopup('Horde request timed out. Try again', 'text');
    throw new Error('Horde timeout');
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

    // if previously selected is no longer available
    if (horde_settings.model && !models.find(m => m.name == horde_settings.model)) {
        horde_settings.model = null;
    }

    // if no models preselected - select a first one in dropdown
    if (!horde_settings.model) {
        horde_settings.model = $('#horde_model').find(":selected").val();
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

    $("#horde_refresh").on("click", getHordeModels);
})