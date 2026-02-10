import fs from 'node:fs';
import path from 'node:path';

import express from 'express';
import fetch from 'node-fetch';
import sanitize from 'sanitize-filename';
import { sync as writeFileAtomicSync } from 'write-file-atomic';
import FormData from 'form-data';
import urlJoin from 'url-join';
import _ from 'lodash';
import mime from 'mime-types';

import { delay, getBasicAuthHeader, isValidUrl, tryParse } from '../util.js';
import { readSecret, SECRET_KEYS } from './secrets.js';
import { getFileNameValidationFunction } from '../middleware/validateFileName.js';
import { AIMLAPI_HEADERS } from '../constants.js';

/**
 * Gets the comfy workflows.
 * @param {import('../users.js').UserDirectoryList} directories
 * @returns {string[]} List of comfy workflows
 */
function getComfyWorkflows(directories) {
    return fs
        .readdirSync(directories.comfyWorkflows)
        .filter(file => file[0] !== '.' && file.toLowerCase().endsWith('.json'))
        .sort(Intl.Collator().compare);
}

export const router = express.Router();

router.post('/ping', async (request, response) => {
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
        console.error(error);
        return response.sendStatus(500);
    }
});

router.post('/upscalers', async (request, response) => {
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

            /** @type {any} */
            const data = await result.json();
            return data.map(x => x.name);
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

            /** @type {any} */
            const data = await result.json();
            return data.map(x => x.name);
        }

        const [upscalers, latentUpscalers] = await Promise.all([getUpscalerModels(), getLatentUpscalers()]);

        // 0 = None, then Latent Upscalers, then Upscalers
        upscalers.splice(1, 0, ...latentUpscalers);

        return response.send(upscalers);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

router.post('/vaes', async (request, response) => {
    try {
        const autoUrl = new URL(request.body.url);
        autoUrl.pathname = '/sdapi/v1/sd-vae';
        const forgeUrl = new URL(request.body.url);
        forgeUrl.pathname = '/sdapi/v1/sd-modules';

        const requestInit = {
            method: 'GET',
            headers: {
                'Authorization': getBasicAuthHeader(request.body.auth),
            },
        };
        const results = await Promise.allSettled([
            fetch(autoUrl, requestInit).then(r => r.ok ? r.json() : Promise.reject(r.statusText)),
            fetch(forgeUrl, requestInit).then(r => r.ok ? r.json() : Promise.reject(r.statusText)),
        ]);

        const data = results.find(r => r.status === 'fulfilled')?.value;

        if (!Array.isArray(data)) {
            throw new Error('SD WebUI returned an error.');
        }

        const names = data.map(x => x.model_name);
        return response.send(names);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

router.post('/samplers', async (request, response) => {
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

        /** @type {any} */
        const data = await result.json();
        const names = data.map(x => x.name);
        return response.send(names);

    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

router.post('/schedulers', async (request, response) => {
    try {
        const url = new URL(request.body.url);
        url.pathname = '/sdapi/v1/schedulers';

        const result = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': getBasicAuthHeader(request.body.auth),
            },
        });

        if (!result.ok) {
            throw new Error('SD WebUI returned an error.');
        }

        /** @type {any} */
        const data = await result.json();
        const names = data.map(x => x.name);
        return response.send(names);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

router.post('/models', async (request, response) => {
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

        /** @type {any} */
        const data = await result.json();
        const models = data.map(x => ({ value: x.title, text: x.title }));
        return response.send(models);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

router.post('/get-model', async (request, response) => {
    try {
        const url = new URL(request.body.url);
        url.pathname = '/sdapi/v1/options';

        const result = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': getBasicAuthHeader(request.body.auth),
            },
        });
        /** @type {any} */
        const data = await result.json();
        return response.send(data.sd_model_checkpoint);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

router.post('/set-model', async (request, response) => {
    try {
        async function getProgress() {
            const url = new URL(request.body.url);
            url.pathname = '/sdapi/v1/progress';

            const result = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': getBasicAuthHeader(request.body.auth),
                },
            });
            return await result.json();
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
        });

        if (!result.ok) {
            throw new Error('SD WebUI returned an error.');
        }

        const MAX_ATTEMPTS = 10;
        const CHECK_INTERVAL = 2000;

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            /** @type {any} */
            const progressState = await getProgress();

            const progress = progressState.progress;
            const jobCount = progressState.state.job_count;
            if (progress === 0.0 && jobCount === 0) {
                break;
            }

            console.info(`Waiting for SD WebUI to finish model loading... Progress: ${progress}; Job count: ${jobCount}`);
            await delay(CHECK_INTERVAL);
        }

        return response.sendStatus(200);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

router.post('/generate', async (request, response) => {
    try {
        try {
            const optionsUrl = new URL(request.body.url);
            optionsUrl.pathname = '/sdapi/v1/options';
            const optionsResult = await fetch(optionsUrl, { headers: { 'Authorization': getBasicAuthHeader(request.body.auth) } });
            if (optionsResult.ok) {
                const optionsData = /** @type {any} */ (await optionsResult.json());
                const isForge = 'forge_preset' in optionsData;

                if (!isForge) {
                    _.unset(request.body, 'override_settings.forge_additional_modules');
                }
            }
        } catch (error) {
            console.error('SD WebUI failed to get options:', error);
        }

        const controller = new AbortController();
        request.socket.removeAllListeners('close');
        request.socket.on('close', function () {
            if (!response.writableEnded) {
                const interruptUrl = new URL(request.body.url);
                interruptUrl.pathname = '/sdapi/v1/interrupt';
                fetch(interruptUrl, { method: 'POST', headers: { 'Authorization': getBasicAuthHeader(request.body.auth) } });
            }
            controller.abort();
        });

        console.debug('SD WebUI request:', request.body);
        const txt2imgUrl = new URL(request.body.url);
        txt2imgUrl.pathname = '/sdapi/v1/txt2img';
        const result = await fetch(txt2imgUrl, {
            method: 'POST',
            body: JSON.stringify(request.body),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getBasicAuthHeader(request.body.auth),
            },
            signal: controller.signal,
        });

        if (!result.ok) {
            const text = await result.text();
            throw new Error('SD WebUI returned an error.', { cause: text });
        }

        const data = await result.json();
        return response.send(data);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

router.post('/sd-next/upscalers', async (request, response) => {
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

        /** @type {any} */
        const data = await result.json();
        const names = data.map(x => x.name);

        // 0 = None, then Latent Upscalers, then Upscalers
        names.splice(1, 0, ...latentUpscalers);

        return response.send(names);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

const comfy = express.Router();

comfy.post('/ping', async (request, response) => {
    try {
        const url = new URL(urlJoin(request.body.url, '/system_stats'));

        const result = await fetch(url);
        if (!result.ok) {
            throw new Error('ComfyUI returned an error.');
        }

        return response.sendStatus(200);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

comfy.post('/samplers', async (request, response) => {
    try {
        const url = new URL(urlJoin(request.body.url, '/object_info'));

        const result = await fetch(url);
        if (!result.ok) {
            throw new Error('ComfyUI returned an error.');
        }

        /** @type {any} */
        const data = await result.json();
        return response.send(data.KSampler.input.required.sampler_name[0]);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

comfy.post('/models', async (request, response) => {
    try {
        const url = new URL(urlJoin(request.body.url, '/object_info'));

        const result = await fetch(url);
        if (!result.ok) {
            throw new Error('ComfyUI returned an error.');
        }
        /** @type {any} */
        const data = await result.json();

        const ckpts = data.CheckpointLoaderSimple.input.required.ckpt_name[0].map(it => ({ value: it, text: it })) || [];
        const unets = data.UNETLoader.input.required.unet_name[0].map(it => ({ value: it, text: `UNet: ${it}` })) || [];

        // load list of GGUF unets from diffusion_models if the loader node is available
        const ggufs = data.UnetLoaderGGUF?.input.required.unet_name[0].map(it => ({ value: it, text: `GGUF: ${it}` })) || [];
        const models = [...ckpts, ...unets, ...ggufs];

        // make the display names of the models somewhat presentable
        models.forEach(it => it.text = it.text.replace(/\.[^.]*$/, '').replace(/_/g, ' '));

        return response.send(models);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

comfy.post('/schedulers', async (request, response) => {
    try {
        const url = new URL(urlJoin(request.body.url, '/object_info'));

        const result = await fetch(url);
        if (!result.ok) {
            throw new Error('ComfyUI returned an error.');
        }

        /** @type {any} */
        const data = await result.json();
        return response.send(data.KSampler.input.required.scheduler[0]);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

comfy.post('/vaes', async (request, response) => {
    try {
        const url = new URL(urlJoin(request.body.url, '/object_info'));

        const result = await fetch(url);
        if (!result.ok) {
            throw new Error('ComfyUI returned an error.');
        }

        /** @type {any} */
        const data = await result.json();
        return response.send(data.VAELoader.input.required.vae_name[0]);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

comfy.post('/workflows', async (request, response) => {
    try {
        const data = getComfyWorkflows(request.user.directories);
        return response.send(data);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

comfy.post('/workflow', async (request, response) => {
    try {
        let filePath = path.join(request.user.directories.comfyWorkflows, sanitize(String(request.body.file_name)));
        if (!fs.existsSync(filePath)) {
            filePath = path.join(request.user.directories.comfyWorkflows, 'Default_Comfy_Workflow.json');
        }
        const data = fs.readFileSync(filePath, { encoding: 'utf-8' });
        return response.send(JSON.stringify(data));
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

comfy.post('/save-workflow', async (request, response) => {
    try {
        const filePath = path.join(request.user.directories.comfyWorkflows, sanitize(String(request.body.file_name)));
        writeFileAtomicSync(filePath, request.body.workflow, 'utf8');
        const data = getComfyWorkflows(request.user.directories);
        return response.send(data);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

comfy.post('/delete-workflow', async (request, response) => {
    try {
        const filePath = path.join(request.user.directories.comfyWorkflows, sanitize(String(request.body.file_name)));
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        return response.sendStatus(200);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

comfy.post('/rename-workflow', getFileNameValidationFunction('old_name'), getFileNameValidationFunction('new_name'), async (request, response) => {
    try {
        const oldName = sanitize(String(request.body.old_name));
        const newName = sanitize(String(request.body.new_name));

        if (path.extname(oldName).toLowerCase() !== '.json' || path.extname(newName).toLowerCase() !== '.json') {
            return response.status(400).send('Only JSON workflow files are allowed');
        }

        const oldPath = path.join(request.user.directories.comfyWorkflows, oldName);
        const newPath = path.join(request.user.directories.comfyWorkflows, newName);

        if (!fs.existsSync(oldPath)) {
            return response.status(404).send('Workflow not found');
        }

        if (fs.existsSync(newPath)) {
            return response.status(409).send('A workflow with that name already exists');
        }

        fs.renameSync(oldPath, newPath);
        return response.sendStatus(204);
    } catch (error) {
        console.error('ComfyUI workflow rename failed', error);
        return response.sendStatus(500);
    }
});

comfy.post('/generate', async (request, response) => {
    try {
        let item;
        const url = new URL(urlJoin(request.body.url, '/prompt'));

        const controller = new AbortController();
        request.socket.removeAllListeners('close');
        request.socket.on('close', function () {
            if (!response.writableEnded && !item) {
                const interruptUrl = new URL(urlJoin(request.body.url, '/interrupt'));
                fetch(interruptUrl, { method: 'POST', headers: { 'Authorization': getBasicAuthHeader(request.body.auth) } });
            }
            controller.abort();
        });

        const promptResult = await fetch(url, {
            method: 'POST',
            body: request.body.prompt,
        });
        if (!promptResult.ok) {
            const text = await promptResult.text();
            throw new Error('ComfyUI returned an error.', { cause: tryParse(text) });
        }

        /** @type {any} */
        const data = await promptResult.json();
        const id = data.prompt_id;
        const historyUrl = new URL(urlJoin(request.body.url, '/history'));
        while (true) {
            const result = await fetch(historyUrl);
            if (!result.ok) {
                throw new Error('ComfyUI returned an error.');
            }
            /** @type {any} */
            const history = await result.json();
            item = history[id];
            if (item) {
                break;
            }
            await delay(100);
        }
        if (item.status.status_str === 'error') {
            // Report node tracebacks if available
            const errorMessages = item.status?.messages
                ?.filter(it => it[0] === 'execution_error')
                .map(it => it[1])
                .map(it => `${it.node_type} [${it.node_id}] ${it.exception_type}: ${it.exception_message}`)
                .join('\n') || '';
            throw new Error(`ComfyUI generation did not succeed.\n\n${errorMessages}`.trim());
        }
        const outputs = Object.keys(item.outputs).map(it => item.outputs[it]);
        console.debug('ComfyUI outputs:', outputs);
        const imgInfo = outputs.map(it => it.images).flat()[0] ?? outputs.map(it => it.gifs).flat()[0];
        if (!imgInfo) {
            throw new Error('ComfyUI did not return any recognizable outputs.');
        }
        const imgUrl = new URL(urlJoin(request.body.url, '/view'));
        imgUrl.search = `?filename=${imgInfo.filename}&subfolder=${imgInfo.subfolder}&type=${imgInfo.type}`;
        const imgResponse = await fetch(imgUrl);
        if (!imgResponse.ok) {
            throw new Error('ComfyUI returned an error.');
        }
        const format = path.extname(imgInfo.filename).slice(1).toLowerCase() || 'png';
        const imgBuffer = await imgResponse.arrayBuffer();
        return response.send({ format: format, data: Buffer.from(imgBuffer).toString('base64') });
    } catch (error) {
        console.error('ComfyUI error:', error);
        response.status(500).send(error.message);
        return response;
    }
});

const comfyRunPod = express.Router();

comfyRunPod.post('/ping', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.COMFY_RUNPOD);

        if (!key) {
            console.warn('RunPod key not found.');
            return response.sendStatus(400);
        }

        const url = new URL(urlJoin(request.body.url, '/health'));

        const result = await fetch(url, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${key}` },
        });
        if (!result.ok) {
            throw new Error('ComfyUI returned an error.');
        }
        /** @type {any} */
        const data = await result.json();
        if (data.workers.ready <= 0) {
            console.warn(`No workers reported as ready. ${result}`);
        }

        return response.sendStatus(200);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

comfyRunPod.post('/generate', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.COMFY_RUNPOD);

        if (!key) {
            console.warn('RunPod key not found.');
            return response.sendStatus(400);
        }

        let jobId;
        let item;
        const url = new URL(urlJoin(request.body.url, '/run'));

        const controller = new AbortController();
        request.socket.removeAllListeners('close');
        request.socket.on('close', function () {
            if (!response.writableEnded && !item) {
                const interruptUrl = new URL(urlJoin(request.body.url, `/cancel/${jobId}`));
                fetch(interruptUrl, { method: 'POST', headers: { 'Authorization': `Bearer ${key}` } });
            }
            controller.abort();
        });
        const workflow = JSON.parse(request.body.prompt).prompt;
        const wrappedWorkflow = workflow?.input?.workflow ? workflow : ({ input: { workflow: workflow } });
        const runpodPrompt = JSON.stringify(wrappedWorkflow);

        console.debug('ComfyUI RunPod request:', wrappedWorkflow);

        const promptResult = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${key}` },
            body: runpodPrompt,
        });
        if (!promptResult.ok) {
            const text = await promptResult.text();
            throw new Error('ComfyUI returned an error.', { cause: tryParse(text) });
        }

        /** @type {any} */
        const data = await promptResult.json();
        jobId = data.id;
        const statusUrl = new URL(urlJoin(request.body.url, `/status/${jobId}`));
        while (true) {
            const result = await fetch(statusUrl, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${key}` },
            });
            if (!result.ok) {
                throw new Error('ComfyUI returned an error.');
            }
            /** @type {any} */
            const status = await result.json();
            if (status.output) {
                item = status.output.images[0];
            }
            if (item) {
                break;
            }
            await delay(500);
        }
        const format = path.extname(item.filename).slice(1).toLowerCase() || 'png';
        return response.send({ format: format, data: item.data });
    } catch (error) {
        console.error('ComfyUI error:', error);
        response.status(500).send(error.message);
        return response;
    }
});

const together = express.Router();

together.post('/models', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.TOGETHERAI);

        if (!key) {
            console.warn('TogetherAI key not found.');
            return response.sendStatus(400);
        }

        const modelsResponse = await fetch('https://api.together.xyz/api/models', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${key}`,
            },
        });

        if (!modelsResponse.ok) {
            console.warn('TogetherAI returned an error.');
            return response.sendStatus(500);
        }

        const data = await modelsResponse.json();

        if (!Array.isArray(data)) {
            console.warn('TogetherAI returned invalid data.');
            return response.sendStatus(500);
        }

        const models = data
            .filter(x => x.type === 'image')
            .map(x => ({ value: x.id, text: x.display_name }));

        return response.send(models);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

together.post('/generate', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.TOGETHERAI);

        if (!key) {
            console.warn('TogetherAI key not found.');
            return response.sendStatus(400);
        }

        console.debug('TogetherAI request:', request.body);

        const result = await fetch('https://api.together.xyz/v1/images/generations', {
            method: 'POST',
            body: JSON.stringify({
                prompt: request.body.prompt,
                negative_prompt: request.body.negative_prompt,
                height: request.body.height,
                width: request.body.width,
                model: request.body.model,
                steps: request.body.steps,
                n: 1,
                // Limited to 10000 on playground, works fine with more.
                seed: request.body.seed >= 0 ? request.body.seed : Math.floor(Math.random() * 10_000_000),
            }),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`,
            },
        });

        if (!result.ok) {
            console.warn('TogetherAI returned an error.', { body: await result.text() });
            return response.sendStatus(500);
        }

        /** @type {any} */
        const data = await result.json();
        console.debug('TogetherAI response:', data);

        const choice = data?.data?.[0];
        let b64_json = choice.b64_json;

        if (!b64_json) {
            const buffer = await (await fetch(choice.url)).arrayBuffer();
            b64_json = Buffer.from(buffer).toString('base64');
        }

        return response.send({ format: 'jpg', data: b64_json });
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

const sdcpp = express.Router();

sdcpp.post('/ping', async (request, response) => {
    try {
        const url = new URL(request.body.url);
        url.pathname = '/v1/images/generations';

        const result = await fetch(url, { method: 'OPTIONS' });
        if (!result.ok) {
            throw new Error('stable-diffusion.cpp server returned an error.');
        }

        return response.sendStatus(200);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

sdcpp.post('/generate', async (request, response) => {
    try {
        const url = new URL(request.body.url);
        url.pathname = '/sdapi/v1/txt2img';

        const payload = {
            prompt: request.body.prompt,
            negative_prompt: request.body.negative_prompt,
            width: request.body.width,
            height: request.body.height,
            steps: request.body.steps,
            cfg_scale: request.body.cfg_scale,
            seed: request.body.seed,
            batch_size: request.body.batch_size,
            sampler_name: request.body.sampler_name,
            scheduler: request.body.scheduler,
            clip_skip: request.body.clip_skip,
        };

        for (const [key, value] of Object.entries(payload)) {
            if (value === undefined || value === null || value === '') {
                delete payload[key];
            }
        }

        console.debug('stable-diffusion.cpp request:', payload);

        const result = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!result.ok) {
            const text = await result.text();
            throw new Error('stable-diffusion.cpp server returned an error.', { cause: text });
        }

        const data = await result.json();
        return response.send(data);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

const drawthings = express.Router();

drawthings.post('/ping', async (request, response) => {
    try {
        const url = new URL(request.body.url);
        url.pathname = '/';

        const result = await fetch(url, {
            method: 'HEAD',
        });

        if (!result.ok) {
            throw new Error('SD DrawThings API returned an error.');
        }

        return response.sendStatus(200);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

drawthings.post('/get-model', async (request, response) => {
    try {
        const url = new URL(request.body.url);
        url.pathname = '/';

        const result = await fetch(url, {
            method: 'GET',
        });

        /** @type {any} */
        const data = await result.json();

        return response.send(data.model);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

drawthings.post('/get-upscaler', async (request, response) => {
    try {
        const url = new URL(request.body.url);
        url.pathname = '/';

        const result = await fetch(url, {
            method: 'GET',
        });

        /** @type {any} */
        const data = await result.json();

        return response.send(data.upscaler);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

drawthings.post('/generate', async (request, response) => {
    try {
        console.debug('SD DrawThings API request:', request.body);

        const url = new URL(request.body.url);
        url.pathname = '/sdapi/v1/txt2img';

        const body = { ...request.body };
        const auth = getBasicAuthHeader(request.body.auth);
        delete body.url;
        delete body.auth;

        const result = await fetch(url, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': auth,
            },
        });

        if (!result.ok) {
            const text = await result.text();
            throw new Error('SD DrawThings API returned an error.', { cause: text });
        }

        const data = await result.json();
        return response.send(data);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

const pollinations = express.Router();

pollinations.post('/models', async (_request, response) => {
    try {
        const modelsUrl = new URL('https://gen.pollinations.ai/image/models');
        const result = await fetch(modelsUrl);

        if (!result.ok) {
            console.warn('Pollinations returned an error.', result.status, result.statusText);
            throw new Error('Pollinations request failed.');
        }

        const data = await result.json();

        if (!Array.isArray(data)) {
            console.warn('Pollinations returned invalid data.');
            throw new Error('Pollinations request failed.');
        }

        const models = data.map(x => ({ value: x.name, text: x.name }));
        return response.send(models);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

pollinations.post('/generate', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.POLLINATIONS);
        if (!key) {
            console.warn('Pollinations API key not found.');
            return response.sendStatus(400);
        }

        const promptUrl = new URL(`https://gen.pollinations.ai/image/${encodeURIComponent(request.body.prompt)}`);
        const params = new URLSearchParams({
            model: String(request.body.model),
            negative_prompt: String(request.body.negative_prompt),
            seed: String(request.body.seed >= 0 ? request.body.seed : Math.floor(Math.random() * 10_000_000)),
            width: String(request.body.width ?? 1024),
            height: String(request.body.height ?? 1024),
        });
        if (request.body.enhance) {
            params.set('enhance', String(true));
        }
        promptUrl.search = params.toString();

        console.info('Pollinations request URL:', promptUrl.toString());

        const result = await fetch(promptUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${key}`,
            },
        });

        if (!result.ok) {
            const text = await result.text();
            console.warn('Pollinations returned an error.', text);
            throw new Error('Pollinations request failed.');
        }

        const format = result.headers.get('Content-Type')?.toString() || 'image/jpeg';
        const buffer = await result.arrayBuffer();
        return response.send({ image: Buffer.from(buffer).toString('base64'), format: mime.extension(format) || 'jpg' });
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

const stability = express.Router();

stability.post('/generate', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.STABILITY);

        if (!key) {
            console.warn('Stability AI key not found.');
            return response.sendStatus(400);
        }

        const { payload, model } = request.body;

        console.debug('Stability AI request:', model, payload);

        const formData = new FormData();
        for (const [key, value] of Object.entries(payload)) {
            if (value !== undefined) {
                formData.append(key, String(value));
            }
        }

        let apiUrl;
        switch (model) {
            case 'stable-image-ultra':
                apiUrl = 'https://api.stability.ai/v2beta/stable-image/generate/ultra';
                break;
            case 'stable-image-core':
                apiUrl = 'https://api.stability.ai/v2beta/stable-image/generate/core';
                break;
            case 'stable-diffusion-3':
                apiUrl = 'https://api.stability.ai/v2beta/stable-image/generate/sd3';
                break;
            default:
                throw new Error('Invalid Stability AI model selected');
        }

        const result = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Accept': 'image/*',
            },
            body: formData,
        });

        if (!result.ok) {
            const text = await result.text();
            console.warn('Stability AI returned an error.', result.status, result.statusText, text);
            return response.sendStatus(500);
        }

        const buffer = await result.arrayBuffer();
        return response.send(Buffer.from(buffer).toString('base64'));
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

const huggingface = express.Router();

huggingface.post('/generate', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.HUGGINGFACE);

        if (!key) {
            console.warn('Hugging Face key not found.');
            return response.sendStatus(400);
        }

        console.debug('Hugging Face request:', request.body);

        const result = await fetch(`https://api-inference.huggingface.co/models/${request.body.model}`, {
            method: 'POST',
            body: JSON.stringify({
                inputs: request.body.prompt,
            }),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`,
            },
        });

        if (!result.ok) {
            console.warn('Hugging Face returned an error.');
            return response.sendStatus(500);
        }

        const buffer = await result.arrayBuffer();
        return response.send({
            image: Buffer.from(buffer).toString('base64'),
        });
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

const electronhub = express.Router();

electronhub.post('/models', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.ELECTRONHUB);

        if (!key) {
            console.warn('Electron Hub key not found.');
            return response.sendStatus(400);
        }

        const modelsResponse = await fetch('https://api.electronhub.ai/v1/models', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
            },
        });

        if (!modelsResponse.ok) {
            console.warn('Electron Hub returned an error.');
            return response.sendStatus(500);
        }

        /** @type {any} */
        const data = await modelsResponse.json();

        if (!Array.isArray(data?.data)) {
            console.warn('Electron Hub returned invalid data.');
            return response.sendStatus(500);
        }

        const models = data.data
            .filter(x => x && Array.isArray(x.endpoints) && x.endpoints.includes('/v1/images/generations'))
            .map(x => ({ ...x, value: x.id, text: x.name }));
        return response.send(models);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

electronhub.post('/generate', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.ELECTRONHUB);

        if (!key) {
            console.warn('Electron Hub key not found.');
            return response.sendStatus(400);
        }

        let bodyParams = {
            model: request.body.model,
            prompt: request.body.prompt,
            response_format: 'b64_json',
        };

        if (request.body.size) {
            bodyParams.size = request.body.size;
        }

        if (request.body.quality) {
            bodyParams.quality = request.body.quality;
        }

        console.debug('Electron Hub request:', bodyParams);

        const result = await fetch('https://api.electronhub.ai/v1/images/generations', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...bodyParams,
            }),
        });

        if (!result.ok) {
            const errorText = await result.text();
            console.warn('Electron Hub returned an error.', result.status, result.statusText, errorText);
            return response.sendStatus(500);
        }

        /** @type {any} */
        const data = await result.json();
        const image = data?.data?.[0]?.b64_json;

        if (!image) {
            console.warn('Electron Hub returned invalid data.');
            return response.sendStatus(500);
        }

        return response.send({ image });
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

electronhub.post('/sizes', async (request, response) => {
    const result = await fetch(`https://api.electronhub.ai/v1/models/${request.body.model}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    if (!result.ok) {
        console.warn('Electron Hub returned an error.');
        return response.sendStatus(500);
    }

    /** @type {any} */
    const data = await result.json();

    const sizes = data.sizes;

    if (!sizes) {
        console.warn('Electron Hub returned invalid data.');
        return response.sendStatus(500);
    }

    return response.send({ sizes });
});

const chutes = express.Router();

chutes.post('/models', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.CHUTES);

        if (!key) {
            console.warn('Chutes key not found.');
            return response.sendStatus(400);
        }

        const modelsResponse = await fetch('https://api.chutes.ai/chutes/?template=diffusion&include_public=true&limit=999', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
            },
        });

        if (!modelsResponse.ok) {
            console.warn('Chutes returned an error.');
            return response.sendStatus(500);
        }

        const data = await modelsResponse.json();

        const chutesData = /** @type {{items: Array<{name: string}>}} */ (data);
        const models = chutesData.items.map(x => ({ value: x.name, text: x.name })).sort((a, b) => a?.text?.localeCompare(b?.text));
        return response.send(models);
    }
    catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

chutes.post('/generate', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.CHUTES);

        if (!key) {
            console.warn('Chutes key not found.');
            return response.sendStatus(400);
        }

        const bodyParams = {
            model: request.body.model,
            prompt: request.body.prompt,
            negative_prompt: request.body.negative_prompt,
            guidance_scale: request.body.guidance_scale || 7.0,
            width: request.body.width || 1024,
            height: request.body.height || 1024,
            num_inference_steps: request.body.steps || 10,
        };

        console.debug('Chutes request:', bodyParams);

        const result = await fetch('https://image.chutes.ai/generate', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(bodyParams),
        });

        if (!result.ok) {
            const text = await result.text();
            console.warn('Chutes returned an error:', text);
            return response.sendStatus(500);
        }

        const buffer = await result.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');

        return response.send({ image: base64 });
    }
    catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

const nanogpt = express.Router();

nanogpt.post('/models', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.NANOGPT);

        if (!key) {
            console.warn('NanoGPT key not found.');
            return response.sendStatus(400);
        }

        const modelsResponse = await fetch('https://nano-gpt.com/api/models', {
            method: 'GET',
            headers: {
                'x-api-key': key,
                'Content-Type': 'application/json',
            },
        });

        if (!modelsResponse.ok) {
            console.warn('NanoGPT returned an error.');
            return response.sendStatus(500);
        }

        /** @type {any} */
        const data = await modelsResponse.json();
        const imageModels = data?.models?.image;

        if (!imageModels || typeof imageModels !== 'object') {
            console.warn('NanoGPT returned invalid data.');
            return response.sendStatus(500);
        }

        const models = Object.values(imageModels).map(x => ({ value: x.model, text: x.name }));
        return response.send(models);
    }
    catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

nanogpt.post('/generate', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.NANOGPT);

        if (!key) {
            console.warn('NanoGPT key not found.');
            return response.sendStatus(400);
        }

        console.debug('NanoGPT request:', request.body);

        const result = await fetch('https://nano-gpt.com/api/generate-image', {
            method: 'POST',
            body: JSON.stringify(request.body),
            headers: {
                'x-api-key': key,
                'Content-Type': 'application/json',
            },
        });

        if (!result.ok) {
            console.warn('NanoGPT returned an error.');
            return response.sendStatus(500);
        }

        /** @type {any} */
        const data = await result.json();

        const image = data?.data?.[0]?.b64_json;
        if (!image) {
            console.warn('NanoGPT returned invalid data.');
            return response.sendStatus(500);
        }

        return response.send({ image });
    }
    catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

const bfl = express.Router();

bfl.post('/generate', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.BFL);

        if (!key) {
            console.warn('BFL key not found.');
            return response.sendStatus(400);
        }

        const requestBody = {
            prompt: request.body.prompt,
            steps: request.body.steps,
            guidance: request.body.guidance,
            width: request.body.width,
            height: request.body.height,
            prompt_upsampling: request.body.prompt_upsampling,
            seed: request.body.seed ?? null,
            safety_tolerance: 6, // being least strict
            output_format: 'jpeg',
        };

        function getClosestAspectRatio(width, height) {
            const minAspect = 9 / 21;
            const maxAspect = 21 / 9;
            const currentAspect = width / height;

            const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
            const simplifyRatio = (w, h) => {
                const divisor = gcd(w, h);
                return `${w / divisor}:${h / divisor}`;
            };

            if (currentAspect < minAspect) {
                const adjustedHeight = Math.round(width / minAspect);
                return simplifyRatio(width, adjustedHeight);
            } else if (currentAspect > maxAspect) {
                const adjustedWidth = Math.round(height * maxAspect);
                return simplifyRatio(adjustedWidth, height);
            } else {
                return simplifyRatio(width, height);
            }
        }

        if (String(request.body.model).endsWith('-ultra')) {
            requestBody.aspect_ratio = getClosestAspectRatio(request.body.width, request.body.height);
            delete requestBody.steps;
            delete requestBody.guidance;
            delete requestBody.width;
            delete requestBody.height;
            delete requestBody.prompt_upsampling;
        }

        if (String(request.body.model).endsWith('-pro-1.1')) {
            delete requestBody.steps;
            delete requestBody.guidance;
        }

        console.debug('BFL request:', requestBody);

        const result = await fetch(`https://api.bfl.ml/v1/${request.body.model}`, {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: {
                'Content-Type': 'application/json',
                'x-key': key,
            },
        });

        if (!result.ok) {
            console.warn('BFL returned an error.');
            return response.sendStatus(500);
        }

        /** @type {any} */
        const taskData = await result.json();
        const { id } = taskData;

        const MAX_ATTEMPTS = 100;
        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            await delay(2500);

            const statusResult = await fetch(`https://api.bfl.ml/v1/get_result?id=${id}`);

            if (!statusResult.ok) {
                const text = await statusResult.text();
                console.warn('BFL returned an error.', text);
                return response.sendStatus(500);
            }

            /** @type {any} */
            const statusData = await statusResult.json();

            if (statusData?.status === 'Pending') {
                continue;
            }

            if (statusData?.status === 'Ready') {
                const { sample } = statusData.result;
                const fetchResult = await fetch(sample);
                const fetchData = await fetchResult.arrayBuffer();
                const image = Buffer.from(fetchData).toString('base64');
                return response.send({ image: image });
            }

            throw new Error('BFL failed to generate image.', { cause: statusData });
        }
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

const falai = express.Router();

falai.post('/models', async (_request, response) => {
    try {
        const modelsUrl = new URL('https://fal.ai/api/models?categories=text-to-image');
        let page = 1;
        /** @type {any} */
        let modelsResponse;
        let models = [];

        do {
            modelsUrl.searchParams.set('page', page.toString());
            const result = await fetch(modelsUrl);

            if (!result.ok) {
                console.warn('FAL.AI returned an error.', result.status, result.statusText);
                throw new Error('FAL.AI request failed.');
            }

            modelsResponse = await result.json();
            if (!('items' in modelsResponse) || !Array.isArray(modelsResponse.items)) {
                console.warn('FAL.AI returned invalid data.');
                throw new Error('FAL.AI request failed.');
            }

            models = models.concat(
                modelsResponse.items.filter(
                    x => (
                        !x.title.toLowerCase().includes('inpainting') &&
                        !x.title.toLowerCase().includes('control') &&
                        !x.title.toLowerCase().includes('upscale') &&
                        !x.title.toLowerCase().includes('lora')
                    ),
                ),
            );

            page = modelsResponse.page + 1;
        } while (modelsResponse != null && page < modelsResponse.pages);

        const modelOptions = models
            .sort((a, b) => a.title.localeCompare(b.title))
            .map(x => ({ value: x.modelUrl.split('fal-ai/')[1], text: x.title }))
            .map(x => ({ ...x, text: `${x.text} (${x.value})` }));
        return response.send(modelOptions);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

falai.post('/generate', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.FALAI);

        if (!key) {
            console.warn('FAL.AI key not found.');
            return response.sendStatus(400);
        }

        const requestBody = {
            prompt: request.body.prompt,
            image_size: { 'width': request.body.width, 'height': request.body.height },
            num_inference_steps: request.body.steps,
            seed: request.body.seed ?? null,
            guidance_scale: request.body.guidance,
            enable_safety_checker: false, // Disable general safety checks
            safety_tolerance: 6, // Make Flux the least strict
        };

        console.debug('FAL.AI request:', requestBody);

        const result = await fetch(`https://queue.fal.run/fal-ai/${request.body.model}`, {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Key ${key}`,
            },
        });

        if (!result.ok) {
            console.warn('FAL.AI returned an error.');
            return response.sendStatus(500);
        }

        /** @type {any} */
        const taskData = await result.json();
        const { status_url } = taskData;

        const MAX_ATTEMPTS = 100;
        for (let i = 0; i < MAX_ATTEMPTS; i++) {
            await delay(2500);

            const statusResult = await fetch(status_url, {
                headers: {
                    'Authorization': `Key ${key}`,
                },
            });

            if (!statusResult.ok) {
                const text = await statusResult.text();
                console.warn('FAL.AI returned an error.', text);
                return response.sendStatus(500);
            }

            /** @type {any} */
            const statusData = await statusResult.json();

            if (statusData?.status === 'IN_QUEUE' || statusData?.status === 'IN_PROGRESS') {
                continue;
            }

            if (statusData?.status === 'COMPLETED') {
                const resultFetch = await fetch(statusData?.response_url, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Key ${key}`,
                    },
                });
                /** @type {any} */
                const resultData = await resultFetch.json();

                if (resultData.detail !== null && resultData.detail !== undefined) {
                    throw new Error('FAL.AI failed to generate image.', { cause: `${resultData.detail[0].loc[1]}: ${resultData.detail[0].msg}` });
                }

                const imageFetch = await fetch(resultData?.images[0].url, {
                    headers: {
                        'Authorization': `Key ${key}`,
                    },
                });

                const fetchData = await imageFetch.arrayBuffer();
                const image = Buffer.from(fetchData).toString('base64');
                return response.send({ image: image });
            }

            throw new Error('FAL.AI failed to generate image.', { cause: statusData });
        }
    } catch (error) {
        console.error(error);
        return response.status(500).send(error.cause || error.message);
    }
});

const xai = express.Router();

xai.post('/generate', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.XAI);

        if (!key) {
            console.warn('xAI key not found.');
            return response.sendStatus(400);
        }

        const requestBody = {
            prompt: request.body.prompt,
            model: request.body.model,
            response_format: 'b64_json',
        };

        console.debug('xAI request:', requestBody);

        const result = await fetch('https://api.x.ai/v1/images/generations', {
            method: 'POST',
            body: JSON.stringify(requestBody),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`,
            },
        });

        if (!result.ok) {
            const text = await result.text();
            console.warn('xAI returned an error.', text);
            return response.sendStatus(500);
        }

        /** @type {any} */
        const data = await result.json();

        const image = data?.data?.[0]?.b64_json;
        if (!image) {
            console.warn('xAI returned invalid data.');
            return response.sendStatus(500);
        }

        return response.send({ image });
    } catch (error) {
        console.error('Error communicating with xAI', error);
        return response.sendStatus(500);
    }
});

const aimlapi = express.Router();

aimlapi.post('/models', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.AIMLAPI);

        if (!key) {
            console.warn('AI/ML API key not found.');
            return response.sendStatus(400);
        }

        const modelsResponse = await fetch('https://api.aimlapi.com/v1/models', {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${key}`,
            },
        });

        if (!modelsResponse.ok) {
            console.warn('AI/ML API returned an error.');
            return response.sendStatus(500);
        }

        /** @type {any} */
        const data = await modelsResponse.json();
        const models = (data.data || [])
            .filter(model =>
                model.type === 'image' &&
                model.id !== 'triposr' &&
                model.id !== 'flux/dev/image-to-image',
            )
            .map(model => ({
                value: model.id,
                text: model.info?.name || model.id,
            }));

        return response.send({ data: models });
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

aimlapi.post('/generate-image', async (req, res) => {
    try {
        const key = readSecret(req.user.directories, SECRET_KEYS.AIMLAPI);
        if (!key) return res.sendStatus(400);

        console.debug('AI/ML API image request:', req.body);

        const apiRes = await fetch('https://api.aimlapi.com/v1/images/generations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, ...AIMLAPI_HEADERS },
            body: JSON.stringify(req.body),
        });
        if (!apiRes.ok) {
            const err = await apiRes.text();
            return res.status(500).send(err);
        }
        /** @type {any} */
        const data = await apiRes.json();

        const imgObj = Array.isArray(data.images) ? data.images[0] : data.data?.[0];
        if (!imgObj) return res.status(500).send('No image returned');

        let base64;
        if (imgObj.b64_json || imgObj.base64) {
            base64 = imgObj.b64_json || imgObj.base64;
        } else if (imgObj.url) {
            const blobRes = await fetch(imgObj.url);
            if (!blobRes.ok) throw new Error('Failed to fetch image URL');
            const buffer = await blobRes.arrayBuffer();
            base64 = Buffer.from(buffer).toString('base64');
        } else {
            throw new Error('Unsupported image format');
        }

        return res.json({ format: 'png', data: base64 });
    } catch (e) {
        console.error(e);
        res.status(500).send('Internal error');
    }
});

const zai = express.Router();

zai.post('/generate', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.ZAI);

        if (!key) {
            console.warn('Z.AI key not found.');
            return response.sendStatus(400);
        }

        console.debug('Z.AI image request:', request.body);

        // Always use Common API for image generation (Coding API has stricter rate limits)
        const generateResponse = await fetch('https://api.z.ai/api/paas/v4/images/generations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`,
            },
            body: JSON.stringify({
                prompt: request.body.prompt,
                model: request.body.model,
                quality: request.body.quality,
                size: request.body.size,
            }),
        });

        if (!generateResponse.ok) {
            const text = await generateResponse.text();
            console.warn('Z.AI returned an error.', text);
            return response.sendStatus(500);
        }

        /** @type {any} */
        const data = await generateResponse.json();
        console.debug('Z.AI image response:', data);

        const url = data?.data?.[0]?.url;
        if (!url || !isValidUrl(url) || !new URL(url).hostname.endsWith('.z.ai')) {
            console.warn('Z.AI returned an invalid image URL.');
            return response.sendStatus(500);
        }

        const imageResponse = await fetch(url);
        if (!imageResponse.ok) {
            console.warn('Z.AI image fetch returned an error. Status:', imageResponse.status, imageResponse.statusText);
            return response.sendStatus(500);
        }

        const buffer = await imageResponse.arrayBuffer();
        const image = Buffer.from(buffer).toString('base64');
        const format = path.extname(url).substring(1).toLowerCase() || 'png';

        return response.send({ image, format });
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

zai.post('/generate-video', async (request, response) => {
    try {
        const controller = new AbortController();
        request.socket.removeAllListeners('close');
        request.socket.on('close', function () {
            controller.abort();
        });

        const key = readSecret(request.user.directories, SECRET_KEYS.ZAI);

        if (!key) {
            console.warn('Z.AI key not found.');
            return response.sendStatus(400);
        }

        console.debug('Z.AI video request:', request.body);

        const generateResponse = await fetch('https://api.z.ai/api/paas/v4/videos/generations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`,
            },
            body: JSON.stringify({
                prompt: request.body.prompt,
                model: request.body.model,
                quality: request.body.quality,
                size: request.body.size,
                aspect_ratio: request.body.aspect_ratio,
            }),
            signal: controller.signal,
        });

        if (!generateResponse.ok) {
            const text = await generateResponse.text();
            console.warn('Z.AI returned an error.', text);
            return response.sendStatus(500);
        }

        /** @type {any} */
        const data = await generateResponse.json();
        console.debug('Z.AI video response:', data);

        // Poll for video generation completion
        for (let attempt = 0; attempt < 30; attempt++) {
            if (controller.signal.aborted) {
                console.info('Z.AI video generation aborted by client');
                return response.status(500).send('Video generation aborted by client');
            }

            await delay(5000 + attempt * 1000);
            console.debug(`Polling Z.AI video job ${data.id}, attempt ${attempt + 1}`);

            const pollResponse = await fetch(`https://api.z.ai/api/paas/v4/async-result/${data.id}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${key}`,
                },
            });

            if (!pollResponse.ok) {
                const text = await pollResponse.text();
                console.warn('Z.AI video job polling failed', pollResponse.statusText, text);
                return response.status(500).send(text);
            }

            /** @type {any} */
            const pollResult = await pollResponse.json();
            console.debug(`Z.AI video job status: ${pollResult.task_status}`);

            if (pollResult.task_status === 'FAIL') {
                console.warn('Z.AI video generation failed', pollResult);
                return response.status(500).send('Video generation failed');
            }

            if (pollResult.task_status === 'SUCCESS') {
                console.debug('Z.AI video generation succeeded', pollResult);
                const url = pollResult?.video_result?.[0]?.url;

                if (!url || !isValidUrl(url)) {
                    console.warn('Z.AI returned an invalid video URL.');
                    return response.sendStatus(500);
                }

                const contentResponse = await fetch(url);
                if (!contentResponse.ok) {
                    const text = await contentResponse.text();
                    console.warn('Z.AI video content fetch failed', contentResponse.statusText, text);
                    return response.status(500).send(text);
                }

                const contentBuffer = await contentResponse.arrayBuffer();
                return response.send({ format: 'mp4', video: Buffer.from(contentBuffer).toString('base64') });
            }
        }
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

router.use('/comfy', comfy);
router.use('/comfyrunpod', comfyRunPod);
router.use('/together', together);
router.use('/sdcpp', sdcpp);
router.use('/drawthings', drawthings);
router.use('/pollinations', pollinations);
router.use('/stability', stability);
router.use('/huggingface', huggingface);
router.use('/chutes', chutes);
router.use('/electronhub', electronhub);
router.use('/nanogpt', nanogpt);
router.use('/bfl', bfl);
router.use('/falai', falai);
router.use('/xai', xai);
router.use('/aimlapi', aimlapi);
router.use('/zai', zai);
