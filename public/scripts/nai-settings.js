import {
    abortStatusCheck,
    getRequestHeaders,
    getStoppingStrings,
    novelai_setting_names,
    saveSettingsDebounced,
    setGenerationParamsFromPreset,
    substituteParams,
} from '../script.js';
import { getCfgPrompt } from './cfg-scale.js';
import { MAX_CONTEXT_DEFAULT, MAX_RESPONSE_DEFAULT, power_user } from './power-user.js';
import { getTextTokens, tokenizers } from './tokenizers.js';
import EventSourceStream from './sse-stream.js';
import {
    getSortableDelay,
    getStringHash,
    onlyUnique,
} from './utils.js';
import { BIAS_CACHE, createNewLogitBiasEntry, displayLogitBias, getLogitBiasListResult } from './logit-bias.js';

const default_preamble = '[ Style: chat, complex, sensory, visceral ]';
const default_order = [1, 5, 0, 2, 3, 4];
const maximum_output_length = 150;
const default_presets = {
    'clio-v1': 'Talker-Chat-Clio',
    'kayra-v1': 'Carefree-Kayra',
};

export const nai_settings = {
    temperature: 1.5,
    repetition_penalty: 2.25,
    repetition_penalty_range: 2048,
    repetition_penalty_slope: 0.09,
    repetition_penalty_frequency: 0,
    repetition_penalty_presence: 0.005,
    tail_free_sampling: 0.975,
    top_k: 10,
    top_p: 0.75,
    top_a: 0.08,
    typical_p: 0.975,
    min_length: 1,
    model_novel: 'clio-v1',
    preset_settings_novel: 'Talker-Chat-Clio',
    streaming_novel: false,
    preamble: default_preamble,
    prefix: '',
    cfg_uc: '',
    banned_tokens: '',
    order: default_order,
    logit_bias: [],
};

const nai_tiers = {
    0: 'Paper',
    1: 'Tablet',
    2: 'Scroll',
    3: 'Opus',
};

let novel_data = null;
let badWordsCache = {};
const BIAS_KEY = '#novel_api-settings';

export function setNovelData(data) {
    novel_data = data;
}

export function getKayraMaxContextTokens() {
    switch (novel_data?.tier) {
        case 1:
            return 3072;
        case 2:
            return 6144;
        case 3:
            return 8192;
    }

    return null;
}

export function getNovelTier() {
    return nai_tiers[novel_data?.tier] ?? 'no_connection';
}

export function getNovelAnlas() {
    return novel_data?.trainingStepsLeft?.fixedTrainingStepsLeft ?? 0;
}

export function getNovelUnlimitedImageGeneration() {
    return novel_data?.perks?.unlimitedImageGeneration ?? false;
}

export async function loadNovelSubscriptionData() {
    const result = await fetch('/api/novelai/status', {
        method: 'POST',
        headers: getRequestHeaders(),
        signal: abortStatusCheck.signal,
    });

    if (result.ok) {
        const data = await result.json();
        setNovelData(data);
    }

    return result.ok;
}

export function loadNovelPreset(preset) {
    if (preset.genamt === undefined) {
        const needsUnlock = preset.max_context > MAX_CONTEXT_DEFAULT || preset.max_length > MAX_RESPONSE_DEFAULT;
        $('#amount_gen').val(preset.max_length).trigger('input');
        $('#max_context_unlocked').prop('checked', needsUnlock).trigger('change');
        $('#max_context').val(preset.max_context).trigger('input');
    }
    else {
        setGenerationParamsFromPreset(preset);
    }

    nai_settings.temperature = preset.temperature;
    nai_settings.repetition_penalty = preset.repetition_penalty;
    nai_settings.repetition_penalty_range = preset.repetition_penalty_range;
    nai_settings.repetition_penalty_slope = preset.repetition_penalty_slope;
    nai_settings.repetition_penalty_frequency = preset.repetition_penalty_frequency;
    nai_settings.repetition_penalty_presence = preset.repetition_penalty_presence;
    nai_settings.tail_free_sampling = preset.tail_free_sampling;
    nai_settings.top_k = preset.top_k;
    nai_settings.top_p = preset.top_p;
    nai_settings.top_a = preset.top_a;
    nai_settings.typical_p = preset.typical_p;
    nai_settings.min_length = preset.min_length;
    nai_settings.cfg_scale = preset.cfg_scale;
    nai_settings.phrase_rep_pen = preset.phrase_rep_pen;
    nai_settings.mirostat_lr = preset.mirostat_lr;
    nai_settings.mirostat_tau = preset.mirostat_tau;
    nai_settings.prefix = preset.prefix;
    nai_settings.cfg_uc = preset.cfg_uc || '';
    nai_settings.banned_tokens = preset.banned_tokens || '';
    nai_settings.order = preset.order || default_order;
    nai_settings.logit_bias = preset.logit_bias || [];
    nai_settings.preamble = preset.preamble || default_preamble;
    loadNovelSettingsUi(nai_settings);
}

export function loadNovelSettings(settings) {
    //load the rest of the Novel settings without any checks
    nai_settings.model_novel = settings.model_novel;
    $('#model_novel_select').val(nai_settings.model_novel);
    $(`#model_novel_select option[value=${nai_settings.model_novel}]`).prop('selected', true);

    if (settings.nai_preamble !== undefined) {
        nai_settings.preamble = settings.nai_preamble;
        delete settings.nai_preamble;
    }
    nai_settings.preset_settings_novel = settings.preset_settings_novel;
    nai_settings.temperature = settings.temperature;
    nai_settings.repetition_penalty = settings.repetition_penalty;
    nai_settings.repetition_penalty_range = settings.repetition_penalty_range;
    nai_settings.repetition_penalty_slope = settings.repetition_penalty_slope;
    nai_settings.repetition_penalty_frequency = settings.repetition_penalty_frequency;
    nai_settings.repetition_penalty_presence = settings.repetition_penalty_presence;
    nai_settings.tail_free_sampling = settings.tail_free_sampling;
    nai_settings.top_k = settings.top_k;
    nai_settings.top_p = settings.top_p;
    nai_settings.top_a = settings.top_a;
    nai_settings.typical_p = settings.typical_p;
    nai_settings.min_length = settings.min_length;
    nai_settings.phrase_rep_pen = settings.phrase_rep_pen;
    nai_settings.cfg_scale = settings.cfg_scale;
    nai_settings.mirostat_lr = settings.mirostat_lr;
    nai_settings.mirostat_tau = settings.mirostat_tau;
    nai_settings.streaming_novel = !!settings.streaming_novel;
    nai_settings.preamble = settings.preamble || default_preamble;
    nai_settings.prefix = settings.prefix;
    nai_settings.cfg_uc = settings.cfg_uc || '';
    nai_settings.banned_tokens = settings.banned_tokens || '';
    nai_settings.order = settings.order || default_order;
    nai_settings.logit_bias = settings.logit_bias || [];
    loadNovelSettingsUi(nai_settings);
}

function loadNovelSettingsUi(ui_settings) {
    $('#temp_novel').val(ui_settings.temperature);
    $('#temp_counter_novel').val(Number(ui_settings.temperature).toFixed(2));
    $('#rep_pen_novel').val(ui_settings.repetition_penalty);
    $('#rep_pen_counter_novel').val(Number(ui_settings.repetition_penalty).toFixed(2));
    $('#rep_pen_size_novel').val(ui_settings.repetition_penalty_range);
    $('#rep_pen_size_counter_novel').val(Number(ui_settings.repetition_penalty_range).toFixed(0));
    $('#rep_pen_slope_novel').val(ui_settings.repetition_penalty_slope);
    $('#rep_pen_slope_counter_novel').val(Number(`${ui_settings.repetition_penalty_slope}`).toFixed(2));
    $('#rep_pen_freq_novel').val(ui_settings.repetition_penalty_frequency);
    $('#rep_pen_freq_counter_novel').val(Number(ui_settings.repetition_penalty_frequency).toFixed(3));
    $('#rep_pen_presence_novel').val(ui_settings.repetition_penalty_presence);
    $('#rep_pen_presence_counter_novel').val(Number(ui_settings.repetition_penalty_presence).toFixed(3));
    $('#tail_free_sampling_novel').val(ui_settings.tail_free_sampling);
    $('#tail_free_sampling_counter_novel').val(Number(ui_settings.tail_free_sampling).toFixed(3));
    $('#top_k_novel').val(ui_settings.top_k);
    $('#top_k_counter_novel').val(Number(ui_settings.top_k).toFixed(0));
    $('#top_p_novel').val(ui_settings.top_p);
    $('#top_p_counter_novel').val(Number(ui_settings.top_p).toFixed(3));
    $('#top_a_novel').val(ui_settings.top_a);
    $('#top_a_counter_novel').val(Number(ui_settings.top_a).toFixed(3));
    $('#typical_p_novel').val(ui_settings.typical_p);
    $('#typical_p_counter_novel').val(Number(ui_settings.typical_p).toFixed(3));
    $('#cfg_scale_novel').val(ui_settings.cfg_scale);
    $('#cfg_scale_counter_novel').val(Number(ui_settings.cfg_scale).toFixed(2));
    $('#phrase_rep_pen_novel').val(ui_settings.phrase_rep_pen || 'off');
    $('#mirostat_lr_novel').val(ui_settings.mirostat_lr);
    $('#mirostat_lr_counter_novel').val(Number(ui_settings.mirostat_lr).toFixed(2));
    $('#mirostat_tau_novel').val(ui_settings.mirostat_tau);
    $('#mirostat_tau_counter_novel').val(Number(ui_settings.mirostat_tau).toFixed(2));
    $('#min_length_novel').val(ui_settings.min_length);
    $('#min_length_counter_novel').val(Number(ui_settings.min_length).toFixed(0));
    $('#nai_preamble_textarea').val(ui_settings.preamble);
    $('#nai_prefix').val(ui_settings.prefix || 'vanilla');
    $('#nai_cfg_uc').val(ui_settings.cfg_uc || '');
    $('#nai_banned_tokens').val(ui_settings.banned_tokens || '');

    $('#streaming_novel').prop('checked', ui_settings.streaming_novel);
    sortItemsByOrder(ui_settings.order);
    displayLogitBias(ui_settings.logit_bias, BIAS_KEY);
}

const sliders = [
    {
        sliderId: '#temp_novel',
        counterId: '#temp_counter_novel',
        format: (val) => Number(val).toFixed(2),
        setValue: (val) => { nai_settings.temperature = Number(val).toFixed(2); },
    },
    {
        sliderId: '#rep_pen_novel',
        counterId: '#rep_pen_counter_novel',
        format: (val) => Number(val).toFixed(2),
        setValue: (val) => { nai_settings.repetition_penalty = Number(val).toFixed(2); },
    },
    {
        sliderId: '#rep_pen_size_novel',
        counterId: '#rep_pen_size_counter_novel',
        format: (val) => `${val}`,
        setValue: (val) => { nai_settings.repetition_penalty_range = Number(val).toFixed(0); },
    },
    {
        sliderId: '#rep_pen_slope_novel',
        counterId: '#rep_pen_slope_counter_novel',
        format: (val) => `${val}`,
        setValue: (val) => { nai_settings.repetition_penalty_slope = Number(val).toFixed(2); },
    },
    {
        sliderId: '#rep_pen_freq_novel',
        counterId: '#rep_pen_freq_counter_novel',
        format: (val) => Number(val).toFixed(2),
        setValue: (val) => { nai_settings.repetition_penalty_frequency = Number(val).toFixed(3); },
    },
    {
        sliderId: '#rep_pen_presence_novel',
        counterId: '#rep_pen_presence_counter_novel',
        format: (val) => `${val}`,
        setValue: (val) => { nai_settings.repetition_penalty_presence = Number(val).toFixed(3); },
    },
    {
        sliderId: '#tail_free_sampling_novel',
        counterId: '#tail_free_sampling_counter_novel',
        format: (val) => `${val}`,
        setValue: (val) => { nai_settings.tail_free_sampling = Number(val).toFixed(3); },
    },
    {
        sliderId: '#top_k_novel',
        counterId: '#top_k_counter_novel',
        format: (val) => `${val}`,
        setValue: (val) => { nai_settings.top_k = Number(val).toFixed(0); },
    },
    {
        sliderId: '#top_p_novel',
        counterId: '#top_p_counter_novel',
        format: (val) => Number(val).toFixed(3),
        setValue: (val) => { nai_settings.top_p = Number(val).toFixed(3); },
    },
    {
        sliderId: '#top_a_novel',
        counterId: '#top_a_counter_novel',
        format: (val) => Number(val).toFixed(2),
        setValue: (val) => { nai_settings.top_a = Number(val).toFixed(3); },
    },
    {
        sliderId: '#typical_p_novel',
        counterId: '#typical_p_counter_novel',
        format: (val) => Number(val).toFixed(3),
        setValue: (val) => { nai_settings.typical_p = Number(val).toFixed(3); },
    },
    {
        sliderId: '#mirostat_tau_novel',
        counterId: '#mirostat_tau_counter_novel',
        format: (val) => Number(val).toFixed(2),
        setValue: (val) => { nai_settings.mirostat_tau = Number(val).toFixed(2); },
    },
    {
        sliderId: '#mirostat_lr_novel',
        counterId: '#mirostat_lr_counter_novel',
        format: (val) => Number(val).toFixed(2),
        setValue: (val) => { nai_settings.mirostat_lr = Number(val).toFixed(2); },
    },
    {
        sliderId: '#cfg_scale_novel',
        counterId: '#cfg_scale_counter_novel',
        format: (val) => `${val}`,
        setValue: (val) => { nai_settings.cfg_scale = Number(val).toFixed(2); },
    },
    {
        sliderId: '#min_length_novel',
        counterId: '#min_length_counter_novel',
        format: (val) => `${val}`,
        setValue: (val) => { nai_settings.min_length = Number(val).toFixed(0); },
    },
    {
        sliderId: '#nai_cfg_uc',
        counterId: '#nai_cfg_uc_counter',
        format: (val) => val,
        setValue: (val) => { nai_settings.cfg_uc = val; },
    },
    {
        sliderId: '#nai_banned_tokens',
        counterId: '#nai_banned_tokens_counter',
        format: (val) => val,
        setValue: (val) => { nai_settings.banned_tokens = val; },
    },
];

function getBadWordIds(banned_tokens, tokenizerType) {
    if (tokenizerType === tokenizers.NONE) {
        return [];
    }

    const cacheKey = `${getStringHash(banned_tokens)}-${tokenizerType}`;

    if (cacheKey in badWordsCache && Array.isArray(badWordsCache[cacheKey])) {
        console.debug(`Bad words ids cache hit for "${banned_tokens}"`, badWordsCache[cacheKey]);
        return badWordsCache[cacheKey];
    }

    const result = [];
    const sequence = banned_tokens.split('\n');

    for (let token of sequence) {
        const trimmed = token.trim();

        // Skip empty lines
        if (trimmed.length === 0) {
            continue;
        }

        // Verbatim text
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            const tokens = getTextTokens(tokenizerType, trimmed.slice(1, -1));
            result.push(tokens);
        }

        // Raw token ids, JSON serialized
        else if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
            try {
                const tokens = JSON.parse(trimmed);

                if (Array.isArray(tokens) && tokens.every(t => Number.isInteger(t))) {
                    result.push(tokens);
                } else {
                    throw new Error('Not an array of integers');
                }
            } catch (err) {
                console.log(`Failed to parse bad word token list: ${trimmed}`, err);
            }
        }

        // Apply permutations
        else {
            const permutations = getBadWordPermutations(trimmed).map(t => getTextTokens(tokenizerType, t));
            result.push(...permutations);
        }
    }

    // Cache the result
    console.debug(`Bad words ids for "${banned_tokens}"`, result);
    badWordsCache[cacheKey] = result;

    return result;
}

function getBadWordPermutations(text) {
    const result = [];

    // Original text
    result.push(text);
    // Original text + leading space
    result.push(` ${text}`);
    // First letter capitalized
    result.push(text[0].toUpperCase() + text.slice(1));
    // Ditto + leading space
    result.push(` ${text[0].toUpperCase() + text.slice(1)}`);
    // First letter lower cased
    result.push(text[0].toLowerCase() + text.slice(1));
    // Ditto + leading space
    result.push(` ${text[0].toLowerCase() + text.slice(1)}`);
    // Original all upper cased
    result.push(text.toUpperCase());
    // Ditto + leading space
    result.push(` ${text.toUpperCase()}`);
    // Original all lower cased
    result.push(text.toLowerCase());
    // Ditto + leading space
    result.push(` ${text.toLowerCase()}`);

    return result.filter(onlyUnique);
}

export function getNovelGenerationData(finalPrompt, settings, maxLength, isImpersonate, isContinue, cfgValues, type) {
    console.debug('NovelAI generation data for', type);
    if (cfgValues && cfgValues.guidanceScale && cfgValues.guidanceScale?.value !== 1) {
        cfgValues.negativePrompt = (getCfgPrompt(cfgValues.guidanceScale, true))?.value;
    }

    const tokenizerType = getTokenizerTypeForModel(nai_settings.model_novel);
    const stopSequences = (tokenizerType !== tokenizers.NONE)
        ? getStoppingStrings(isImpersonate, isContinue)
            .map(t => getTextTokens(tokenizerType, t))
        : undefined;

    const badWordIds = (tokenizerType !== tokenizers.NONE)
        ? getBadWordIds(nai_settings.banned_tokens, tokenizerType)
        : undefined;

    const prefix = selectPrefix(nai_settings.prefix, finalPrompt);

    let logitBias = [];
    if (tokenizerType !== tokenizers.NONE && Array.isArray(nai_settings.logit_bias) && nai_settings.logit_bias.length) {
        logitBias = BIAS_CACHE.get(BIAS_KEY) || calculateLogitBias();
        BIAS_CACHE.set(BIAS_KEY, logitBias);
    }

    if (power_user.console_log_prompts) {
        console.log(finalPrompt);
    }

    return {
        'input': finalPrompt,
        'model': nai_settings.model_novel,
        'use_string': true,
        'temperature': Number(nai_settings.temperature),
        'max_length': maxLength < maximum_output_length ? maxLength : maximum_output_length,
        'min_length': Number(nai_settings.min_length),
        'tail_free_sampling': Number(nai_settings.tail_free_sampling),
        'repetition_penalty': Number(nai_settings.repetition_penalty),
        'repetition_penalty_range': Number(nai_settings.repetition_penalty_range),
        'repetition_penalty_slope': Number(nai_settings.repetition_penalty_slope),
        'repetition_penalty_frequency': Number(nai_settings.repetition_penalty_frequency),
        'repetition_penalty_presence': Number(nai_settings.repetition_penalty_presence),
        'top_a': Number(nai_settings.top_a),
        'top_p': Number(nai_settings.top_p),
        'top_k': Number(nai_settings.top_k),
        'typical_p': Number(nai_settings.typical_p),
        'mirostat_lr': Number(nai_settings.mirostat_lr),
        'mirostat_tau': Number(nai_settings.mirostat_tau),
        'cfg_scale': cfgValues?.guidanceScale?.value ?? Number(nai_settings.cfg_scale),
        'cfg_uc': cfgValues?.negativePrompt ?? substituteParams(nai_settings.cfg_uc) ?? '',
        'phrase_rep_pen': nai_settings.phrase_rep_pen,
        'stop_sequences': stopSequences,
        'bad_words_ids': badWordIds,
        'logit_bias_exp': logitBias,
        'generate_until_sentence': true,
        'use_cache': false,
        'return_full_text': false,
        'prefix': prefix,
        'order': nai_settings.order || settings.order || default_order,
        'num_logprobs': power_user.request_token_probabilities ? 10 : undefined,
    };
}

// Check if the prefix needs to be overriden to use instruct mode
function selectPrefix(selected_prefix, finalPrompt) {
    let useInstruct = false;
    const clio = nai_settings.model_novel.includes('clio');
    const kayra = nai_settings.model_novel.includes('kayra');
    const isNewModel = clio || kayra;

    if (isNewModel) {
        // NovelAI claims they scan backwards 1000 characters (not tokens!) to look for instruct brackets. That's really short.
        const tail = finalPrompt.slice(-1500);
        useInstruct = tail.includes('}');
        return useInstruct ? 'special_instruct' : selected_prefix;
    }

    return 'vanilla';
}

function getTokenizerTypeForModel(model) {
    if (model.includes('clio')) {
        return tokenizers.NERD;
    }
    if (model.includes('kayra')) {
        return tokenizers.NERD2;
    }
    return tokenizers.NONE;
}

// Sort the samplers by the order array
function sortItemsByOrder(orderArray) {
    console.debug('Preset samplers order: ' + orderArray);
    const $draggableItems = $('#novel_order');

    // Sort the items by the order array
    for (let i = 0; i < orderArray.length; i++) {
        const index = orderArray[i];
        const $item = $draggableItems.find(`[data-id="${index}"]`).detach();
        $draggableItems.append($item);
    }

    // Update the disabled class for each sampler
    $draggableItems.children().each(function () {
        const isEnabled = orderArray.includes(parseInt($(this).data('id')));
        $(this).toggleClass('disabled', !isEnabled);

        // If the sampler is disabled, move it to the bottom of the list
        if (!isEnabled) {
            const item = $(this).detach();
            $draggableItems.append(item);
        }
    });
}

function saveSamplingOrder() {
    const order = [];
    $('#novel_order').children().each(function () {
        const isEnabled = !$(this).hasClass('disabled');
        if (isEnabled) {
            order.push($(this).data('id'));
        }
    });
    nai_settings.order = order;
    console.log('Samplers reordered:', nai_settings.order);
    saveSettingsDebounced();
}

/**
 * Calculates logit bias for Novel AI
 * @returns {object[]} Array of logit bias objects
 */
function calculateLogitBias() {
    const biasPreset = nai_settings.logit_bias;

    if (!Array.isArray(biasPreset) || biasPreset.length === 0) {
        return [];
    }

    const tokenizerType = getTokenizerTypeForModel(nai_settings.model_novel);

    /**
     * Creates a bias object for Novel AI
     * @param {number} bias Bias value
     * @param {number[]} sequence Sequence of token ids
     */
    function getBiasObject(bias, sequence) {
        return {
            bias: bias,
            ensure_sequence_finish: false,
            generate_once: false,
            sequence: sequence,
        };
    }

    const result = getLogitBiasListResult(biasPreset, tokenizerType, getBiasObject);
    return result;
}

/**
 * Transforms instruction into compatible format for Novel AI if Novel AI instruct format not already detected.
 * 1. Instruction must begin and end with curly braces followed and preceded by a space.
 * 2. Instruction must not contain square brackets as it serves different purpose in NAI.
 * @param {string} prompt Original instruction prompt
 * @returns Processed prompt
 */
export function adjustNovelInstructionPrompt(prompt) {
    const stripedPrompt = prompt.replace(/[[\]]/g, '').trim();
    if (!stripedPrompt.includes('{ ')) {
        return `{ ${stripedPrompt} }`;
    }
    return stripedPrompt;
}

function tryParseStreamingError(response, decoded) {
    try {
        const data = JSON.parse(decoded);

        if (!data) {
            return;
        }

        if (data.message || data.error) {
            toastr.error(data.message || data.error?.message || response.statusText, 'NovelAI API');
            throw new Error(data);
        }
    }
    catch {
        // No JSON. Do nothing.
    }
}

export async function generateNovelWithStreaming(generate_data, signal) {
    generate_data.streaming = nai_settings.streaming_novel;

    const response = await fetch('/api/novelai/generate', {
        headers: getRequestHeaders(),
        body: JSON.stringify(generate_data),
        method: 'POST',
        signal: signal,
    });
    if (!response.ok) {
        tryParseStreamingError(response, await response.text());
        throw new Error(`Got response status ${response.status}`);
    }
    const eventStream = new EventSourceStream();
    response.body.pipeThrough(eventStream);
    const reader = eventStream.readable.getReader();

    return async function* streamData() {
        let text = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) return;

            const data = JSON.parse(value.data);

            if (data.token) {
                text += data.token;
            }

            yield { text, swipes: [], logprobs: parseNovelAILogprobs(data.logprobs) };
        }
    };
}

/**
 * A single token's ID.
 * @typedef {[number]} TokenIdEntry
 */
/**
 * A single token's log probabilities. The first element is before repetition
 * penalties and samplers are applied, the second is after.
 * @typedef {[number, number]} LogprobsEntry
 */
/**
 * Combination of token ID and its corresponding log probabilities.
 * @typedef {[TokenIdEntry, LogprobsEntry]} TokenLogprobTuple
 */
/**
 * Represents all logprob data for a single token, including its
 * before, after, and the ultimately selected token.
 * @typedef {Object} NAITokenLogprobs
 * @property {TokenLogprobTuple[]} chosen - always length 1
 * @property {TokenLogprobTuple[]} before - always `top_logprobs` length
 * @property {TokenLogprobTuple[]} after - maybe less than `top_logprobs` length
 */
/**
 * parseNovelAILogprobs converts a logprobs object returned from the NovelAI API
 * for a single token into a TokenLogprobs object used by the Token Probabilities
 * feature.
 * @param {NAITokenLogprobs} data - NAI logprobs object for one token
 * @returns {import('logprobs.js').TokenLogprobs | null} converted logprobs
 */
export function parseNovelAILogprobs(data) {
    if (!data) {
        return null;
    }
    const befores = data.before.map(([[tokenId], [before, _]]) => [tokenId, before]);
    const afters = data.after.map(([[tokenId], [_, after]]) => [tokenId, after]);

    // Find any tokens in `befores` that are missing from `afters`. Then add
    // them with a logprob of -Infinity (0% probability)
    const notInAfter = befores
        .filter(([id]) => !afters.some(([aid]) => aid === id))
        .map(([id]) => [id, -Infinity]);
    const merged = afters.concat(notInAfter);

    // Add the chosen token to `merged` if it's not already there. This can
    // happen if the chosen token was not among the top 10 most likely ones.
    const [[chosenId], [_, chosenAfter]] = data.chosen[0];
    if (!merged.some(([id]) => id === chosenId)) {
        merged.push([chosenId, chosenAfter]);
    }

    // nb: returned logprobs are provided alongside token IDs, not decoded text.
    // We don't want to send an API call for every streaming tick to decode the
    // text so we will use the IDs instead and bulk decode them in
    // StreamingProcessor. JSDoc typechecking may complain about this, but it's
    // intentional.
    return { token: chosenId, topLogprobs: merged };
}

$('#nai_preamble_textarea').on('input', function () {
    nai_settings.preamble = String($('#nai_preamble_textarea').val());
    saveSettingsDebounced();
});

$('#nai_preamble_restore').on('click', function () {
    nai_settings.preamble = default_preamble;
    $('#nai_preamble_textarea').val(nai_settings.preamble);
    saveSettingsDebounced();
});

jQuery(function () {
    sliders.forEach(slider => {
        $(document).on('input', slider.sliderId, function () {
            const value = $(this).val();
            const formattedValue = slider.format(value);
            slider.setValue(value);
            $(slider.counterId).val(formattedValue);
            saveSettingsDebounced();
        });
    });

    $('#streaming_novel').on('input', function () {
        const value = !!$(this).prop('checked');
        nai_settings.streaming_novel = value;
        saveSettingsDebounced();
    });

    $('#model_novel_select').change(function () {
        nai_settings.model_novel = String($('#model_novel_select').find(':selected').val());
        saveSettingsDebounced();

        // Update the selected preset to something appropriate
        const default_preset = default_presets[nai_settings.model_novel];
        $('#settings_preset_novel').val(novelai_setting_names[default_preset]);
        $(`#settings_preset_novel option[value=${novelai_setting_names[default_preset]}]`).attr('selected', 'true');
        $('#settings_preset_novel').trigger('change');
    });

    $('#nai_prefix').on('change', function () {
        nai_settings.prefix = String($('#nai_prefix').find(':selected').val());
        saveSettingsDebounced();
    });

    $('#phrase_rep_pen_novel').on('change', function () {
        nai_settings.phrase_rep_pen = String($('#phrase_rep_pen_novel').find(':selected').val());
        saveSettingsDebounced();
    });

    $('#novel_order').sortable({
        delay: getSortableDelay(),
        stop: saveSamplingOrder,
    });

    $('#novel_order .toggle_button').on('click', function () {
        const $item = $(this).closest('[data-id]');
        const isEnabled = !$item.hasClass('disabled');
        $item.toggleClass('disabled', isEnabled);
        console.log('Sampler toggled:', $item.data('id'), !isEnabled);
        saveSamplingOrder();
    });

    $('#novelai_logit_bias_new_entry').on('click', () => createNewLogitBiasEntry(nai_settings.logit_bias, BIAS_KEY));
});
