import express from 'express';
import fetch from 'node-fetch';

import { readSecret, SECRET_KEYS } from '../secrets.js';

export const router = express.Router();

router.post('/generate', async function (request, response) {
    if (!request.body) return response.sendStatus(400);

    try {
        const cookie = readSecret(request.user.directories, SECRET_KEYS.SCALE_COOKIE);

        if (!cookie) {
            console.error('No Scale cookie found');
            return response.sendStatus(400);
        }

        const body = {
            json: {
                variant: {
                    name: 'New Variant',
                    appId: '',
                    taxonomy: null,
                },
                prompt: {
                    id: '',
                    template: '{{input}}\n',
                    exampleVariables: {},
                    variablesSourceDataId: null,
                    systemMessage: request.body.sysprompt,
                },
                modelParameters: {
                    id: '',
                    modelId: 'GPT4',
                    modelType: 'OpenAi',
                    maxTokens: request.body.max_tokens,
                    temperature: request.body.temp,
                    stop: 'user:',
                    suffix: null,
                    topP: request.body.top_p,
                    logprobs: null,
                    logitBias: request.body.logit_bias,
                },
                inputs: [
                    {
                        index: '-1',
                        valueByName: {
                            input: request.body.prompt,
                        },
                    },
                ],
            },
            meta: {
                values: {
                    'variant.taxonomy': ['undefined'],
                    'prompt.variablesSourceDataId': ['undefined'],
                    'modelParameters.suffix': ['undefined'],
                    'modelParameters.logprobs': ['undefined'],
                },
            },
        };

        console.debug('Scale request:', body);

        const result = await fetch('https://dashboard.scale.com/spellbook/api/trpc/v2.variant.run', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'cookie': `_jwt=${cookie}`,
            },
            body: JSON.stringify(body),
        });

        if (!result.ok) {
            const text = await result.text();
            console.error('Scale request failed', result.statusText, text);
            return response.status(500).send({ error: { message: result.statusText } });
        }

        /** @type {any} */
        const data = await result.json();
        const output = data?.result?.data?.json?.outputs?.[0] || '';

        console.debug('Scale response:', data);

        if (!output) {
            console.warn('Scale response is empty');
            return response.sendStatus(500).send({ error: { message: 'Empty response' } });
        }

        return response.json({ output });
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});
