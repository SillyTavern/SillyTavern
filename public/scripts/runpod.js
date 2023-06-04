import { saveSettingsDebounced, changeMainAPI, callPopup, setGenerationProgress, CLIENT_VERSION, setOnlineStatus, checkOnlineStatus } from "../script.js";
import { delay } from "./utils.js";

export {
    runpod_settings,
    generateRunpodPygmalion,
    loadRunpodSettings
}

let runpod_settings = {
    runpod_api_key: '',
};

function loadRunpodSettings(settings) {
    runpod_settings.runpod_api_key = settings?.runpod_api_key ?? ""
    $('#api_key_runpod').val(runpod_settings.runpod_api_key ?? '');
}

const MAX_RETRIES = 100;
const CHECK_INTERVAL = 3000;

const getRequestArgs = () => ({
    method: "GET",
    headers: {
        "accept": "application/json",
        "authorization": runpod_settings.runpod_api_key,
    }
});

const postRequestArgs = () => ({
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "accept": "application/json",
        "authorization": runpod_settings.runpod_api_key,
    }
});

async function generateRunpodPygmalion(prompt, params) {
    const payload = {
        "input": {
            "prompt": prompt,
            "do_sample": false,
            "temperature": 0.9,
            "max_length": 2000
        }
    };

    const response = await fetch("https://api.runpod.ai/v2/pygmalion-6b/run", {
        ...postRequestArgs(),
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const error = await response.json();
        callPopup(error.message, 'text');
        throw new Error('Runpod generation failed: ' + error.message);
    }

    const responseJson = await response.json();
    const task_id = responseJson.id;
    console.log(`Task id = ${task_id}`);

    for (let retryNumber = 0; retryNumber < MAX_RETRIES; retryNumber++) {
        const statusCheckResponse = await fetch(`https://api.runpod.ai/v2/pygmalion-6b/status/${task_id}`, getRequestArgs());

        const statusCheckJson = await statusCheckResponse.json();
        console.log(statusCheckJson);

        if (statusCheckJson.status === "COMPLETED") {
            const generatedText = statusCheckJson.output
            let message = generatedText.replace(prompt, "")
            message = message.split("You:")[0]
            console.log("Generated text:" + generatedText);
            console.log("Message:" + message);
            return message;
        }

        if (statusCheckJson.status === "FAILED") {
            console.log("Runpod api error: " + statusCheckJson.error)
            throw new Error(statusCheckJson.error)
        }

        await delay(CHECK_INTERVAL);
    }

    callPopup('Runpod request timed out. Try again', 'text');
    throw new Error('Runpod timeout');
}

async function onConnectClick() {
    if (!runpod_settings.runpod_api_key) {
        return;
    }
    await checkStatusRunpod();
}

async function checkStatusRunpod() {
    let connected = false
    try {
        // To validate the api key we make a request against the health endpoint for pygmalion.
        const response = await fetch('https://api.runpod.ai/v2/pygmalion-6b/health', getRequestArgs());
        connected = response.ok
    }
    finally {
        setOnlineStatus(connected ? 'Connected!' : 'no_connection');
        checkOnlineStatus();
        setButtonState(connected)
        saveSettingsDebounced();
    }
}

function setButtonState(connected) {
    $("#api_button_runpod").css("display", connected ? 'inline-block' : 'none');
    $("#api_loading_runpod").css("display", connected ? 'none' : 'block');
}

function onTokenInput() {
    runpod_settings.runpod_api_key = $('#api_key_runpod').val();
    saveSettingsDebounced();
}

$('document').ready(function () {
    $('#api_button_runpod').on('click', onConnectClick);
    $('#api_key_runpod').on('input', onTokenInput);
});
