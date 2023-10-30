const fetch = require('node-fetch').default;
const { getBasicAuthHeader, delay } = require('./util');

/**
 * Sanitizes a string.
 * @param {string} x String to sanitize
 * @returns {string} Sanitized string
 */
function safeStr(x) {
    x = String(x);
    for (let i = 0; i < 16; i++) {
        x = x.replace(/  /g, ' ');
    }
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
        let regex = new RegExp("\\" + p, 'g');
        x = x.replace(regex, '');
    }
    return x;
}

/**
 * Registers the endpoints for the Stable Diffusion API extension.
 * @param {import("express").Express} app Express app
 * @param {any} jsonParser JSON parser middleware
 */
function registerEndpoints(app, jsonParser) {
    app.post('/api/sd/ping', jsonParser, async (request, response) => {
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

    app.post('/api/sd/upscalers', jsonParser, async (request, response) => {
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

    app.post('/api/sd/samplers', jsonParser, async (request, response) => {
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

    app.post('/api/sd/models', jsonParser, async (request, response) => {
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

    app.post('/api/sd/get-model', jsonParser, async (request, response) => {
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

    app.post('/api/sd/set-model', jsonParser, async (request, response) => {
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

                const progress = progressState["progress"]
                const jobCount = progressState["state"]["job_count"];
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

    app.post('/api/sd/generate', jsonParser, async (request, response) => {
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

    app.post('/api/sd-next/upscalers', jsonParser, async (request, response) => {
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
    app.post('/api/sd/expand', jsonParser, async (request, response) => {
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
            const module = await import('./transformers.mjs');
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
}

module.exports = {
    registerEndpoints,
};
