const fetch = require('node-fetch').default;
const AIHorde = require("./ai_horde");
const { getVersion, delay } = require("./util");
const { readSecret, SECRET_KEYS } = require("./secrets");

const ANONYMOUS_KEY = "0000000000";

/**
 * Returns the AIHorde client.
 * @returns {Promise<AIHorde>} AIHorde client
 */
async function getHordeClient() {
    const version = await getVersion();
    const ai_horde = new AIHorde({
        client_agent: version?.agent || 'SillyTavern:UNKNOWN:Cohee#1207',
    });
    return ai_horde;
}

/**
 *
 * @param {import("express").Express} app
 * @param {any} jsonParser
 */
function registerEndpoints(app, jsonParser) {
    app.post('/api/horde/generate-text', jsonParser, async (request, response) => {
        const api_key_horde = readSecret(SECRET_KEYS.HORDE) || ANONYMOUS_KEY;
        const url = 'https://horde.koboldai.net/api/v2/generate/text/async';

        console.log(request.body);
        try {
            const result = await fetch(url, {
                method: 'POST',
                body: JSON.stringify(request.body),
                headers: {
                    "Content-Type": "application/json",
                    "apikey": api_key_horde,
                    'Client-Agent': String(request.header('Client-Agent')),
                }
            });

            if (!result.ok) {
                const message = await result.text();
                console.log('Horde returned an error:', message);
                return response.send({ error: { message } });
            }

            const data = await result.json();
            return response.send(data);
        } catch (error) {
            console.log(error);
            return response.send({ error: true });
        }
    });

    app.post('/api/horde/sd-samplers', jsonParser, async (_, response) => {
        try {
            const ai_horde = await getHordeClient();
            const samplers = Object.values(ai_horde.ModelGenerationInputStableSamplers);
            response.send(samplers);
        } catch (error) {
            console.error(error);
            response.sendStatus(500);
        }
    });

    app.post('/api/horde/sd-models', jsonParser, async (_, response) => {
        try {
            const ai_horde = await getHordeClient();
            const models = await ai_horde.getModels();
            response.send(models);
        } catch (error) {
            console.error(error);
            response.sendStatus(500);
        }
    });

    app.post('/api/horde/user-info', jsonParser, async (_, response) => {
        const api_key_horde = readSecret(SECRET_KEYS.HORDE);

        if (!api_key_horde) {
            return response.send({ anonymous: true });
        }

        try {
            const ai_horde = await getHordeClient();
            const user = await ai_horde.findUser({ token: api_key_horde });
            return response.send(user);
        } catch (error) {
            console.error(error);
            return response.sendStatus(500);
        }
    })

    app.post('/api/horde/generate-image', jsonParser, async (request, response) => {
        if (!request.body.prompt) {
            return response.sendStatus(400);
        }

        const MAX_ATTEMPTS = 200;
        const CHECK_INTERVAL = 3000;
        const PROMPT_THRESHOLD = 5000;

        try {
            const maxLength = PROMPT_THRESHOLD - String(request.body.negative_prompt).length - 5;
            if (String(request.body.prompt).length > maxLength) {
                console.log('Stable Horde prompt is too long, truncating...');
                request.body.prompt = String(request.body.prompt).substring(0, maxLength);
            }

            const api_key_horde = readSecret(SECRET_KEYS.HORDE) || ANONYMOUS_KEY;
            console.log('Stable Horde request:', request.body);

            const ai_horde = await getHordeClient();
            const generation = await ai_horde.postAsyncImageGenerate(
                {
                    prompt: `${request.body.prompt} ### ${request.body.negative_prompt}`,
                    params:
                    {
                        sampler_name: request.body.sampler,
                        hires_fix: request.body.enable_hr,
                        // @ts-ignore - use_gfpgan param is not in the type definition, need to update to new ai_horde @ https://github.com/ZeldaFan0225/ai_horde/blob/main/index.ts
                        use_gfpgan: request.body.restore_faces,
                        cfg_scale: request.body.scale,
                        steps: request.body.steps,
                        width: request.body.width,
                        height: request.body.height,
                        karras: Boolean(request.body.karras),
                        n: 1,
                    },
                    r2: false,
                    nsfw: request.body.nfsw,
                    models: [request.body.model],
                },
                { token: api_key_horde });

            if (!generation.id) {
                console.error('Image generation request is not satisfyable:', generation.message || 'unknown error');
                return response.sendStatus(400);
            }

            for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
                await delay(CHECK_INTERVAL);
                const check = await ai_horde.getImageGenerationCheck(generation.id);
                console.log(check);

                if (check.done) {
                    const result = await ai_horde.getImageGenerationStatus(generation.id);
                    if (result.generations === undefined) return response.sendStatus(500);
                    return response.send(result.generations[0].img);
                }

                /*
                if (!check.is_possible) {
                    return response.sendStatus(503);
                }
                */

                if (check.faulted) {
                    return response.sendStatus(500);
                }
            }

            return response.sendStatus(504);
        } catch (error) {
            console.error(error);
            return response.sendStatus(500);
        }
    });
}

module.exports = {
    registerEndpoints,
};
