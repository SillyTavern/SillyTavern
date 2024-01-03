const express = require('express');
const fetch = require('node-fetch').default;
const sanitize = require('sanitize-filename');
const { getBasicAuthHeader, delay, getHexString } = require('../util.js');
const fs = require('fs');
const { DIRECTORIES } = require('../constants.js');
const writeFileAtomicSync = require('write-file-atomic').sync;
const { jsonParser } = require('../express-common');
const { readSecret, SECRET_KEYS } = require('./secrets.js');

/**
 * Sanitizes a string.
 * @param {string} x String to sanitize
 * @returns {string} Sanitized string
 */
function safeStr(x) {
    x = String(x);
    x = x.replace(/ +/g, ' ');
    x = x.trim();
    x = x.replace(/^[\s,.]+|[\s,.]+$/g, '');
    return x;
}

const splitStrings = [
    ', extremely',
    ', intricate,',
];

const dangerousPatterns = '[]【】()（）|:：';

/**
 * Removes patterns from a string.
 * @param {string} x String to sanitize
 * @param {string} pattern Pattern to remove
 * @returns {string} Sanitized string
 */
function removePattern(x, pattern) {
    for (let i = 0; i < pattern.length; i++) {
        let p = pattern[i];
        let regex = new RegExp('\\' + p, 'g');
        x = x.replace(regex, '');
    }
    return x;
}

function getComfyWorkflows() {
    return fs
        .readdirSync(DIRECTORIES.comfyWorkflows)
        .filter(file => file[0] != '.' && file.toLowerCase().endsWith('.json'))
        .sort(Intl.Collator().compare);
}

const router = express.Router();

router.post('/ping', jsonParser, async (request, response) => {
    try {
        const url = new URL(request.body.url);
        url.pathname = '/sdapi/v1/options';

        const result = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': getBasicAuthHeader(request.body.auth),
            },
        });

        if (!result.ok) {
            throw new Error('SD WebUI returned an error.');
        }

        return response.sendStatus(200);
    } catch (error) {
        console.log(error);
        return response.sendStatus(500);
    }
});

router.post('/upscalers', jsonParser, async (request, response) => {
    try {
        async function getUpscalerModels() {
            const url = new URL(request.body.url);
            url.pathname = '/sdapi/v1/upscalers';

            const result = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': getBasicAuthHeader(request.body.auth),
                },
            });

            if (!result.ok) {
                throw new Error('SD WebUI returned an error.');
            }

            const data = await result.json();
            const names = data.map(x => x.name);
            return names;
        }

        async function getLatentUpscalers() {
            const url = new URL(request.body.url);
            url.pathname = '/sdapi/v1/latent-upscale-modes';

            const result = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': getBasicAuthHeader(request.body.auth),
                },
            });

            if (!result.ok) {
                throw new Error('SD WebUI returned an error.');
            }

            const data = await result.json();
            const names = data.map(x => x.name);
            return names;
        }

        const [upscalers, latentUpscalers] = await Promise.all([getUpscalerModels(), getLatentUpscalers()]);

        // 0 = None, then Latent Upscalers, then Upscalers
        upscalers.splice(1, 0, ...latentUpscalers);

        return response.send(upscalers);
    } catch (error) {
        console.log(error);
        return response.sendStatus(500);
    }
});

router.post('/samplers', jsonParser, async (request, response) => {
    try {
        const url = new URL(request.body.url);
        url.pathname = '/sdapi/v1/samplers';

        const result = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': getBasicAuthHeader(request.body.auth),
            },
        });

        if (!result.ok) {
            throw new Error('SD WebUI returned an error.');
        }

        const data = await result.json();
        const names = data.map(x => x.name);
        return response.send(names);

    } catch (error) {
        console.log(error);
        return response.sendStatus(500);
    }
});

router.post('/models', jsonParser, async (request, response) => {
    try {
        const url = new URL(request.body.url);
        url.pathname = '/sdapi/v1/sd-models';

        const result = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': getBasicAuthHeader(request.body.auth),
            },
        });

        if (!result.ok) {
            throw new Error('SD WebUI returned an error.');
        }

        const data = await result.json();
        const models = data.map(x => ({ value: x.title, text: x.title }));
        return response.send(models);
    } catch (error) {
        console.log(error);
        return response.sendStatus(500);
    }
});

router.post('/get-model', jsonParser, async (request, response) => {
    try {
        const url = new URL(request.body.url);
        url.pathname = '/sdapi/v1/options';

        const result = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': getBasicAuthHeader(request.body.auth),
            },
        });
        const data = await result.json();
        return response.send(data['sd_model_checkpoint']);
    } catch (error) {
        console.log(error);
        return response.sendStatus(500);
    }
});

router.post('/set-model', jsonParser, async (request, response) => {
    try {
        async function getProgress() {
            const url = new URL(request.body.url);
            url.pathname = '/sdapi/v1/progress';

            const result = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': getBasicAuthHeader(request.body.auth),
                },
                timeout: 0,
            });
            const data = await result.json();
            return data;
        }

        const url = new URL(request.body.url);
        url.pathname = '/sdapi/v1/options';

        const options = {
            sd_model_checkpoint: request.body.model,
        };

        const result = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(options),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getBasicAuthHeader(request.body.auth),
            },
            timeout: 0,
        });

        if (!result.ok) {
            throw new Error('SD WebUI returned an error.');
        }

        const MAX_ATTEMPTS = 10;
        const CHECK_INTERVAL = 2000;

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            const progressState = await getProgress();

            const progress = progressState['progress'];
            const jobCount = progressState['state']['job_count'];
            if (progress == 0.0 && jobCount === 0) {
                break;
            }

            console.log(`Waiting for SD WebUI to finish model loading... Progress: ${progress}; Job count: ${jobCount}`);
            await delay(CHECK_INTERVAL);
        }

        return response.sendStatus(200);
    } catch (error) {
        console.log(error);
        return response.sendStatus(500);
    }
});

router.post('/generate', jsonParser, async (request, response) => {
    try {
        console.log('SD WebUI request:', request.body);

        const url = new URL(request.body.url);
        url.pathname = '/sdapi/v1/txt2img';

        const result = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(request.body),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getBasicAuthHeader(request.body.auth),
            },
            timeout: 0,
        });

        if (!result.ok) {
            const text = await result.text();
            throw new Error('SD WebUI returned an error.', { cause: text });
        }

        const data = await result.json();
        return response.send(data);
    } catch (error) {
        console.log(error);
        return response.sendStatus(500);
    }
});

router.post('/sd-next/upscalers', jsonParser, async (request, response) => {
    try {
        const url = new URL(request.body.url);
        url.pathname = '/sdapi/v1/upscalers';

        const result = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': getBasicAuthHeader(request.body.auth),
            },
        });

        if (!result.ok) {
            throw new Error('SD WebUI returned an error.');
        }

        // Vlad doesn't provide Latent Upscalers in the API, so we have to hardcode them here
        const latentUpscalers = ['Latent', 'Latent (antialiased)', 'Latent (bicubic)', 'Latent (bicubic antialiased)', 'Latent (nearest)', 'Latent (nearest-exact)'];

        const data = await result.json();
        const names = data.map(x => x.name);

        // 0 = None, then Latent Upscalers, then Upscalers
        names.splice(1, 0, ...latentUpscalers);

        return response.send(names);
    } catch (error) {
        console.log(error);
        return response.sendStatus(500);
    }
});

/**
 * SD prompt expansion using GPT-2 text generation model.
 * Adapted from: https://github.com/lllyasviel/Fooocus/blob/main/modules/expansion.py
 */
router.post('/expand', jsonParser, async (request, response) => {
    const originalPrompt = request.body.prompt;

    if (!originalPrompt) {
        console.warn('No prompt provided for SD expansion.');
        return response.send({ prompt: '' });
    }

    console.log('Refine prompt input:', originalPrompt);
    const splitString = splitStrings[Math.floor(Math.random() * splitStrings.length)];
    let prompt = safeStr(originalPrompt) + splitString;

    try {
        const task = 'text-generation';
        const module = await import('../transformers.mjs');
        const pipe = await module.default.getPipeline(task);

        const result = await pipe(prompt, { num_beams: 1, max_new_tokens: 256, do_sample: true });

        const newText = result[0].generated_text;
        const newPrompt = safeStr(removePattern(newText, dangerousPatterns));
        console.log('Refine prompt output:', newPrompt);

        return response.send({ prompt: newPrompt });
    } catch {
        console.warn('Failed to load transformers.js pipeline.');
        return response.send({ prompt: originalPrompt });
    }
});

const comfy = express.Router();

comfy.post('/ping', jsonParser, async (request, response) => {
    try {
        const url = new URL(request.body.url);
        url.pathname = '/system_stats';

        const result = await fetch(url);
        if (!result.ok) {
            throw new Error('ComfyUI returned an error.');
        }

        return response.sendStatus(200);
    } catch (error) {
        console.log(error);
        return response.sendStatus(500);
    }
});

comfy.post('/samplers', jsonParser, async (request, response) => {
    try {
        const url = new URL(request.body.url);
        url.pathname = '/object_info';

        const result = await fetch(url);
        if (!result.ok) {
            throw new Error('ComfyUI returned an error.');
        }

        const data = await result.json();
        return response.send(data.KSampler.input.required.sampler_name[0]);
    } catch (error) {
        console.log(error);
        return response.sendStatus(500);
    }
});

comfy.post('/models', jsonParser, async (request, response) => {
    try {
        const url = new URL(request.body.url);
        url.pathname = '/object_info';

        const result = await fetch(url);
        if (!result.ok) {
            throw new Error('ComfyUI returned an error.');
        }
        const data = await result.json();
        return response.send(data.CheckpointLoaderSimple.input.required.ckpt_name[0].map(it => ({ value: it, text: it })));
    } catch (error) {
        console.log(error);
        return response.sendStatus(500);
    }
});

comfy.post('/schedulers', jsonParser, async (request, response) => {
    try {
        const url = new URL(request.body.url);
        url.pathname = '/object_info';

        const result = await fetch(url);
        if (!result.ok) {
            throw new Error('ComfyUI returned an error.');
        }

        const data = await result.json();
        return response.send(data.KSampler.input.required.scheduler[0]);
    } catch (error) {
        console.log(error);
        return response.sendStatus(500);
    }
});

comfy.post('/vaes', jsonParser, async (request, response) => {
    try {
        const url = new URL(request.body.url);
        url.pathname = '/object_info';

        const result = await fetch(url);
        if (!result.ok) {
            throw new Error('ComfyUI returned an error.');
        }

        const data = await result.json();
        return response.send(data.VAELoader.input.required.vae_name[0]);
    } catch (error) {
        console.log(error);
        return response.sendStatus(500);
    }
});

comfy.post('/workflows', jsonParser, async (request, response) => {
    try {
        const data = getComfyWorkflows();
        return response.send(data);
    } catch (error) {
        console.log(error);
        return response.sendStatus(500);
    }
});

comfy.post('/workflow', jsonParser, async (request, response) => {
    try {
        let path = `${DIRECTORIES.comfyWorkflows}/${sanitize(String(request.body.file_name))}`;
        if (!fs.existsSync(path)) {
            path = `${DIRECTORIES.comfyWorkflows}/Default_Comfy_Workflow.json`;
        }
        const data = fs.readFileSync(
            path,
            { encoding: 'utf-8' },
        );
        return response.send(JSON.stringify(data));
    } catch (error) {
        console.log(error);
        return response.sendStatus(500);
    }
});

comfy.post('/save-workflow', jsonParser, async (request, response) => {
    try {
        writeFileAtomicSync(
            `${DIRECTORIES.comfyWorkflows}/${sanitize(String(request.body.file_name))}`,
            request.body.workflow,
            'utf8',
        );
        const data = getComfyWorkflows();
        return response.send(data);
    } catch (error) {
        console.log(error);
        return response.sendStatus(500);
    }
});

comfy.post('/delete-workflow', jsonParser, async (request, response) => {
    try {
        let path = `${DIRECTORIES.comfyWorkflows}/${sanitize(String(request.body.file_name))}`;
        if (fs.existsSync(path)) {
            fs.unlinkSync(path);
        }
        return response.sendStatus(200);
    } catch (error) {
        console.log(error);
        return response.sendStatus(500);
    }
});

comfy.post('/generate', jsonParser, async (request, response) => {
    try {
        const url = new URL(request.body.url);
        url.pathname = '/prompt';

        const promptResult = await fetch(url, {
            method: 'POST',
            body: request.body.prompt,
        });
        if (!promptResult.ok) {
            throw new Error('ComfyUI returned an error.');
        }

        const data = await promptResult.json();
        const id = data.prompt_id;
        let item;
        const historyUrl = new URL(request.body.url);
        historyUrl.pathname = '/history';
        while (true) {
            const result = await fetch(historyUrl);
            if (!result.ok) {
                throw new Error('ComfyUI returned an error.');
            }
            const history = await result.json();
            item = history[id];
            if (item) {
                break;
            }
            await delay(100);
        }
        const imgInfo = Object.keys(item.outputs).map(it => item.outputs[it].images).flat()[0];
        const imgUrl = new URL(request.body.url);
        imgUrl.pathname = '/view';
        imgUrl.search = `?filename=${imgInfo.filename}&subfolder=${imgInfo.subfolder}&type=${imgInfo.type}`;
        const imgResponse = await fetch(imgUrl);
        if (!imgResponse.ok) {
            throw new Error('ComfyUI returned an error.');
        }
        const imgBuffer = await imgResponse.buffer();
        return response.send(imgBuffer.toString('base64'));
    } catch (error) {
        return response.sendStatus(500);
    }
});

const together = express.Router();

together.post('/models', jsonParser, async (_, response) => {
    try {
        const key = readSecret(SECRET_KEYS.TOGETHERAI);

        if (!key) {
            console.log('TogetherAI key not found.');
            return response.sendStatus(400);
        }

        const modelsResponse = await fetch('https://api.together.xyz/api/models', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${key}`,
            },
        });

        if (!modelsResponse.ok) {
            console.log('TogetherAI returned an error.');
            return response.sendStatus(500);
        }

        const data = await modelsResponse.json();

        if (!Array.isArray(data)) {
            console.log('TogetherAI returned invalid data.');
            return response.sendStatus(500);
        }

        const models = data
            .filter(x => x.display_type === 'image')
            .map(x => ({ value: x.name, text: x.display_name }));

        return response.send(models);
    } catch (error) {
        console.log(error);
        return response.sendStatus(500);
    }
});

together.post('/generate', jsonParser, async (request, response) => {
    try {
        const key = readSecret(SECRET_KEYS.TOGETHERAI);

        if (!key) {
            console.log('TogetherAI key not found.');
            return response.sendStatus(400);
        }

        console.log('TogetherAI request:', request.body);

        const result = await fetch('https://api.together.xyz/api/inference', {
            method: 'POST',
            body: JSON.stringify({
                request_type: 'image-model-inference',
                prompt: request.body.prompt,
                negative_prompt: request.body.negative_prompt,
                height: request.body.height,
                width: request.body.width,
                model: request.body.model,
                steps: request.body.steps,
                n: 1,
                seed: Math.floor(Math.random() * 10_000_000), // Limited to 10000 on playground, works fine with more.
                sessionKey: getHexString(40), // Don't know if that's supposed to be random or not. It works either way.
            }),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`,
            },
        });

        if (!result.ok) {
            console.log('TogetherAI returned an error.');
            return response.sendStatus(500);
        }

        const data = await result.json();
        console.log('TogetherAI response:', data);

        if (data.status !== 'finished') {
            console.log('TogetherAI job failed.');
            return response.sendStatus(500);
        }

        return response.send(data);
    } catch (error) {
        console.log(error);
        return response.sendStatus(500);
    }
});

router.use('/comfy', comfy);
router.use('/together', together);

module.exports = { router };
