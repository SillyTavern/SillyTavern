import { t } from './i18n.js';

// the hash can be obtained from command line e.g. via: MODEL=path_to_model; python -c "import json, hashlib, sys; print(hashlib.sha256(json.load(open('"$MODEL"/tokenizer_config.json'))['chat_template'].encode()).hexdigest())"
// note that chat templates must be trimmed to match the llama.cpp metadata value
const hash_derivations = {
    // Meta
    'e10ca381b1ccc5cf9db52e371f3b6651576caee0a630b452e2816b2d404d4b65':
        // Meta-Llama-3.1-8B-Instruct
        // Meta-Llama-3.1-70B-Instruct
        'Llama 3 Instruct'
    ,
    '5816fce10444e03c2e9ee1ef8a4a1ea61ae7e69e438613f3b17b69d0426223a4':
        // Llama-3.2-1B-Instruct
        // Llama-3.2-3B-Instruct
        'Llama 3 Instruct'
    ,
    '73e87b1667d87ab7d7b579107f01151b29ce7f3ccdd1018fdc397e78be76219d':
        // Nemotron 70B
        'Llama 3 Instruct'
    ,

    // Mistral
    // Mistral Reference: https://github.com/mistralai/mistral-common
    'e16746b40344d6c5b5265988e0328a0bf7277be86f1c335156eae07e29c82826':
        // Mistral-Small-Instruct-2409
        // Mistral-Large-Instruct-2407
        'Mistral V2 & V3'
    ,
    '26a59556925c987317ce5291811ba3b7f32ec4c647c400c6cc7e3a9993007ba7':
        // Mistral-7B-Instruct-v0.3
        'Mistral V2 & V3'
    ,
    'e4676cb56dffea7782fd3e2b577cfaf1e123537e6ef49b3ec7caa6c095c62272':
        // Mistral-Nemo-Instruct-2407
        'Mistral V3-Tekken'
    ,
    '3c4ad5fa60dd8c7ccdf82fa4225864c903e107728fcaf859fa6052cb80c92ee9':
        // Mistral-Large-Instruct-2411
        'Mistral V7'
    ,
    '3934d199bfe5b6fab5cba1b5f8ee475e8d5738ac315f21cb09545b4e665cc005':
        // Mistral Small 24B
        'Mistral V7'
    ,

    // Gemma
    'ecd6ae513fe103f0eb62e8ab5bfa8d0fe45c1074fa398b089c93a7e70c15cfd6':
        // gemma-2-9b-it
        // gemma-2-27b-it
        'Gemma 2'
    ,
    '87fa45af6cdc3d6a9e4dd34a0a6848eceaa73a35dcfe976bd2946a5822a38bf3':
        // gemma-2-2b-it
        'Gemma 2'
    ,
    '7de1c58e208eda46e9c7f86397df37ec49883aeece39fb961e0a6b24088dd3c4':
        // gemma-3
        'Gemma 2'
    ,

    // Cohere
    '3b54f5c219ae1caa5c0bb2cdc7c001863ca6807cf888e4240e8739fa7eb9e02e':
        // command-r-08-2024
        'Command R'
    ,

    // Tulu
    'ac7498a36a719da630e99d48e6ebc4409de85a77556c2b6159eeb735bcbd11df':
        // Tulu-3-8B
        // Tulu-3-70B
        'Tulu'
    ,

    // DeepSeek V2.5
    '54d400beedcd17f464e10063e0577f6f798fa896266a912d8a366f8a2fcc0bca':
        'DeepSeek-V2.5'
    ,

    // DeepSeek R1
    'b6835114b7303ddd78919a82e4d9f7d8c26ed0d7dfc36beeb12d524f6144eab1':
        'DeepSeek-V2.5'
    ,

    // THUDM-GLM 4
    '854b703e44ca06bdb196cc471c728d15dbab61e744fe6cdce980086b61646ed1':
        'GLM-4'
    ,

    // Kimi K2, ...
    'aab20feb9bc6881f941ea649356130ffbc4943b3c2577c0991e1fba90de5a0fc':
        'Moonshot AI'
    ,

    // gpt-oss (unsloth)
    '70da0d2348e40aaf8dad05f04a316835fd10547bd7e3392ce337e4c79ba91c01':
        'OpenAI Harmony'
    ,

    // gpt-oss (ggml-org)
    'a4c9919cbbd4acdd51ccffe22da049264b1b73e59055fa58811a99efbd7c8146':
        'OpenAI Harmony'
    ,
};

const substr_derivations = [
    ['Moonshot AI', ['<|im_user|>user<|im_middle|>', '<|im_assistant|>assistant<|im_middle|>', '<|im_end|>']],
    ['OpenAI Harmony', ['<|start|>user<|message|>', '<|start|>assistant<|channel|>final<|message|>', '<|end|>']],

    // Generic cases
    ['ChatML', ['<|im_start|>user', '<|im_start|>assistant', '<|im_end|>']],
];

const parse_derivation = derivation => (typeof derivation === 'string') ? {
    'context': derivation,
    'instruct': derivation,
} : derivation;

const not_found = { context: null, instruct: null };

export async function deriveTemplatesFromChatTemplate(chat_template, hash) {
    if (chat_template.trim() === '') {
        console.log('Missing chat template.');
        return not_found;
    }

    if (hash in hash_derivations) {
        return parse_derivation(hash_derivations[hash]);
    }

    // heuristics
    for (const [derivation, substr] of substr_derivations) {
        if ([substr].flat().every(str => chat_template.includes(str))) {
            return parse_derivation(derivation);
        }
    }

    console.warn(`Unknown chat template hash: ${hash} for [${chat_template}]`);
    return not_found;
}

export async function bindModelTemplates(power_user, online_status) {
    if (online_status === 'no_connection') {
        return false;
    }

    const chatTemplateHash = power_user.chat_template_hash;
    const bindModelTemplates = power_user.model_templates_mappings[online_status]
        ?? power_user.model_templates_mappings[chatTemplateHash]
        ?? {};
    const bindingsMatch = bindModelTemplates
        && power_user.context.preset == bindModelTemplates['context']
        && (!power_user.instruct.enabled || power_user.instruct.preset === bindModelTemplates['instruct']);

    const bound = [];

    if (bindingsMatch) {
        // unmap current preset
        delete power_user.model_templates_mappings[chatTemplateHash];
        delete power_user.model_templates_mappings[online_status];
        toastr.info(t`Context preset for ${online_status} will use defaults when loaded the next time.`);
    } else {
        if (power_user.context_derived) {
            if (power_user.context.preset !== bindModelTemplates['context']) {
                bound.push(`${power_user.context.preset} context preset`);
                // toastr.info(`Bound ${power_user.context.preset} preset to currently loaded model and all models that share its chat template.`);

                // map current preset to current chat template hash
                bindModelTemplates['context'] = power_user.context.preset;
            }
        } else {
            toastr.warning(t`Note: Context derivation is disabled. Not including context preset.`);
        }
        if (power_user.instruct.enabled) {
            if (power_user.instruct_derived) {
                if (power_user.instruct.preset !== bindModelTemplates['instruct']) {
                    bound.push(`${power_user.instruct.preset} instruct preset`);
                    bindModelTemplates['instruct'] = power_user.instruct.preset;
                }
            } else {
                toastr.warning(t`Note: Instruct derivation is disabled. Not including instruct preset.`);
            }
        }
        if (bound.length == 0) {
            toastr.warning(t`No applicable presets available.`);
            return false;
        }

        toastr.info(t`Bound ${online_status} to ${bound.join(', ')}.`);
        if (!online_status.startsWith('koboldcpp/ggml-model-')) {
            power_user.model_templates_mappings[online_status] = bindModelTemplates;
        }
        if (chatTemplateHash !== '') {
            power_user.model_templates_mappings[chatTemplateHash] = bindModelTemplates;
        }
    }

    return true;
}
