// const fs = require('fs');
const { BedrockRuntimeClient, InvokeModelCommand, InvokeModelWithResponseStreamCommand } = require("@aws-sdk/client-bedrock-runtime");
const { BedrockClient, ListFoundationModelsCommand } = require("@aws-sdk/client-bedrock");

const getClient = (function() {
    const client = {};
    return function(region_name) {
        if(! client[region_name]) {
            client[region_name] = new BedrockClient({ region: region_name });
        }
        return client[region_name];
    };
})();

const getRuntimeClient = (function() {
    const client = {};
    return function(region_name) {
        if(! client[region_name]) {
            client[region_name] = new BedrockRuntimeClient({ region: region_name });
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
