import { beforeAll, describe, expect, jest, test } from '@jest/globals';

const jqueryElement = {
    append: jest.fn(function () { return this; }),
    children: jest.fn(() => ({ each: jest.fn() })),
    detach: jest.fn(function () { return this; }),
    empty: jest.fn(function () { return this; }),
    find: jest.fn(function () { return this; }),
    on: jest.fn(function () { return this; }),
    prop: jest.fn(function () { return this; }),
    trigger: jest.fn(function () { return this; }),
    val: jest.fn(function () { return this; }),
};

global.$ = jest.fn(() => jqueryElement);

jest.unstable_mockModule('../public/script.js', () => ({
    abortStatusCheck: { signal: undefined },
    event_types: {},
    eventSource: { emit: jest.fn() },
    getRequestHeaders: jest.fn(),
    getStoppingStrings: jest.fn(),
    resultCheckStatus: jest.fn(),
    saveSettingsDebounced: jest.fn(),
    setGenerationParamsFromPreset: jest.fn(),
    setOnlineStatus: jest.fn(),
    startStatusLoading: jest.fn(),
}));
jest.unstable_mockModule('../public/scripts/power-user.js', () => ({
    MAX_CONTEXT_DEFAULT: 8192,
    MAX_RESPONSE_DEFAULT: 150,
    power_user: {},
}));
jest.unstable_mockModule('../public/scripts/tokenizers.js', () => ({
    getTextTokens: jest.fn(),
    tokenizers: { NONE: 0, NERD: 1, NERD2: 2, LLAMA3: 3 },
}));
jest.unstable_mockModule('../public/scripts/sse-stream.js', () => ({ getEventSourceStream: jest.fn() }));
jest.unstable_mockModule('../public/scripts/utils.js', () => ({
    getSortableDelay: jest.fn(),
    getStringHash: jest.fn(),
    onlyUnique: jest.fn(),
}));
jest.unstable_mockModule('../public/scripts/logit-bias.js', () => ({
    BIAS_CACHE: new Map(),
    createNewLogitBiasEntry: jest.fn(),
    displayLogitBias: jest.fn(),
    getLogitBiasListResult: jest.fn(),
}));
jest.unstable_mockModule('../public/scripts/secrets.js', () => ({
    SECRET_KEYS: {},
    secret_state: {},
    writeSecret: jest.fn(),
}));

let loadNovelPreset;
let loadNovelSettings;
let naiSettings;

beforeAll(async () => {
    ({
        loadNovelPreset,
        loadNovelSettings,
        nai_settings: naiSettings,
    } = await import('../public/scripts/nai-settings.js'));
});

describe('NovelAI settings', () => {
    test('preserves a zero Math1 temperature when loading settings', () => {
        loadNovelSettings(
            { novelai_setting_names: [], novelai_settings: [] },
            { ...naiSettings, math1_temp: 0 },
        );
        expect(naiSettings.math1_temp).toBe(0);

        naiSettings.math1_temp = 1;
        loadNovelPreset({ ...naiSettings, genamt: 150, math1_temp: 0 });
        expect(naiSettings.math1_temp).toBe(0);
    });
});
