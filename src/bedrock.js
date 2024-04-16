// const fs = require('fs');
const { BedrockRuntimeClient, InvokeModelCommand, InvokeModelWithResponseStreamCommand } = require("@aws-sdk/client-bedrock-runtime");
const { BedrockClient, ListFoundationModelsCommand } = require("@aws-sdk/client-bedrock");

const { readSecret, SECRET_KEYS } = require('./endpoints/secrets');

const getClient = (function() {
    const client = {};
    let aksk = '';
    return function(region_name) {
        const access_key = readSecret(SECRET_KEYS.BEDROCK_ACCESS_KEY) || '';
        const secret_key = readSecret(SECRET_KEYS.BEDROCK_SECRET_KEY) || '';
        const _aksk = access_key + secret_key;
        const refresh = _aksk != aksk;

        if(! client[region_name] || refresh) {
            aksk = _aksk;
            const secrets = readSecret(SECRET_KEYS.BEDROCK);
            if (access_key && secret_key) {
                client[region_name] = new BedrockClient({
                    region: region_name,
                    credentials: {
                        accessKeyId: access_key,
                        secretAccessKey: secret_key
                    }
                });
            } else {
                console.log('warn: secrets not found for bedrock, will fallback to default provider.');
                client[region_name] = new BedrockClient({region: region_name});
            }
        }
        return client[region_name];
    };
})();

const getRuntimeClient = (function() {
    const client = {};
    let aksk = '';
    return function(region_name) {
        const access_key = readSecret(SECRET_KEYS.BEDROCK_ACCESS_KEY) || '';
        const secret_key = readSecret(SECRET_KEYS.BEDROCK_SECRET_KEY) || '';
        const _aksk = access_key + secret_key;
        const refresh = _aksk != aksk;

        if(! client[region_name] || refresh) {
            aksk = _aksk;
            if (access_key && secret_key) {
                client[region_name] = new BedrockRuntimeClient({
                    region: region_name,
                    credentials: {
                        accessKeyId: access_key,
                        secretAccessKey: secret_key
                    }
                });
            } else {
                console.log('warn: secrets not found for bedrock, will fallback to default provider.');
                client[region_name] = new BedrockRuntimeClient({region: region_name});
            }
        }

        return client[region_name];
    };
})();

async function listTextModels(region_name) {
    const command = new ListFoundationModelsCommand({ byOutputModality: 'TEXT' });
    const data = await getClient(region_name).send(command);
    // process data.
    return data;
}

async function invokeModel(region_name, params) {
    const modelId = params.modelId;
    if (-1 === modelId.indexOf('claude-3')) {
        const command = new InvokeModelCommand(params);
        const data = await getRuntimeClient(region_name).send(command);

        // process data.
        return data;
    } else {
        // todo: cluade 3 model invoke
        const command = new InvokeModelCommand(params);
        const data = await getRuntimeClient(region_name).send(command);

        // process data.
        return data;
    }
}

async function invokeModelWithStreaming(region_name, params) {
    const command = new InvokeModelWithResponseStreamCommand(params);
    const data = await getRuntimeClient(region_name).send(command);
    // process data.
    return data;
}
module.exports = {
    getRuntimeClient,
    getClient,
    listTextModels,
    invokeModel,
    invokeModelWithStreaming,
};
