const express = require('express');
const fetch = require('node-fetch').default;

const { jsonParser } = require('../../express-common');

const { readSecret, SECRET_KEYS } = require('../secrets');

const router = express.Router();

router.post('/generate', jsonParser, function (request, response) {
    if (!request.body) return response.sendStatus(400);

    fetch('https://dashboard.scale.com/spellbook/api/trpc/v2.variant.run', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'cookie': `_jwt=${readSecret(SECRET_KEYS.SCALE_COOKIE)}`,
        },
        body: JSON.stringify({
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
        }),
    })
        .then(res => res.json())
        .then(data => {
            console.log(data.result.data.json.outputs[0]);
            return response.send({ output: data.result.data.json.outputs[0] });
        })
        .catch((error) => {
            console.error('Error:', error);
            return response.send({ error: true });
        });

});

module.exports = { router };
