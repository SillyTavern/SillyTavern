// const fs = require('fs');
const { BedrockRuntimeClient, InvokeModelCommand, InvokeModelWithResponseStreamCommand } = require("@aws-sdk/client-bedrock-runtime");
const { BedrockClient, ListFoundationModelsCommand } = require("@aws-sdk/client-bedrock");

const { readSecret, SECRET_KEYS } = require('./endpoints/secrets');

const getClient = (function() {
    const client = {};
    let aksk = '';
    return function(region_name) {
        const secrets = readSecret(SECRET_KEYS.BEDROCK);
        const _aksk = secrets[0] + secrets[1];
        const refresh = _aksk != aksk;

        if(! client[region_name] || refresh) {
            aksk = _aksk;
            const secrets = readSecret(SECRET_KEYS.BEDROCK);
            if (secrets[0] && secrets[1]) {
                client[region_name] = new BedrockClient({
                    region: region_name,
                    credentials: {
                        accessKeyId: secrets[0],
                        secretAccessKey: secrets[1]
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
        const secrets = readSecret(SECRET_KEYS.BEDROCK);
        const _aksk = secrets[0] + secrets[1];
        const refresh = _aksk != aksk;

        if(! client[region_name] || refresh) {
            aksk = _aksk;
            if (secrets[0] && secrets[1]) {
                client[region_name] = new BedrockRuntimeClient({
                    region: region_name,
                    credentials: {
                        accessKeyId: secrets[0],
                        secretAccessKey: secrets[1]
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
