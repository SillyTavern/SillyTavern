const express = require('express');
const fetch = require('node-fetch').default;

const { jsonParser } = require('../../express-common');

const { readSecret, SECRET_KEYS } = require('../secrets');

const router = express.Router();

router.post('/generate', jsonParser, async function (request, response) {
    if (!request.body) return response.sendStatus(400);

    try {
        const cookie = readSecret(request.user.directories, SECRET_KEYS.SCALE_COOKIE);

        if (!cookie) {
            console.log('No Scale cookie found');
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

        console.log('Scale request:', body);

        const result = await fetch('https://dashboard.scale.com/spellbook/api/trpc/v2.variant.run', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'cookie': `_jwt=${cookie}`,
            },
            timeout: 0,
            body: JSON.stringify(body),
        });

        if (!result.ok) {
            const text = await result.text();
            console.log('Scale request failed', result.statusText, text);
            return response.status(500).send({ error: { message: result.statusText } });
        }

        const data = await result.json();
        const output = data?.result?.data?.json?.outputs?.[0] || '';

        console.log('Scale response:', data);

        if (!output) {
            console.warn('Scale response is empty');
            return response.sendStatus(500).send({ error: { message: 'Empty response' } });
        }

        return response.json({ output });
    } catch (error) {
        console.log(error);
        return response.sendStatus(500);
    }
});

module.exports = { router };
