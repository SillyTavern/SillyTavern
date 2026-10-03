import { describe, expect, test } from '@jest/globals';
import {
    classifyGoogleModels,
    GoogleModelBranch,
    GoogleModelFamily,
    GoogleModelPurpose,
    GoogleModelTier,
} from '../public/scripts/google-model.js';

const F = GoogleModelFamily;
const T = GoogleModelTier;
const B = GoogleModelBranch;
const P = GoogleModelPurpose;

// Columns: id, family, version, tier, branch, purpose.
const EXPECTED_MODELS = [
    ['gemini-2.5-flash', F.GEMINI, '2.5', T.FLASH, B.STABLE, P.TEXT_GENERATION],
    ['gemini-2.5-pro', F.GEMINI, '2.5', T.PRO, B.STABLE, P.TEXT_GENERATION],
    ['gemini-2.5-flash-preview-tts', F.GEMINI, '2.5', T.FLASH, B.PREVIEW, P.OTHER],
    ['gemini-2.5-pro-preview-tts', F.GEMINI, '2.5', T.PRO, B.PREVIEW, P.OTHER],
    ['gemma-4-26b-a4b-it', F.GEMMA, null, null, B.STABLE, P.TEXT_GENERATION],
    ['gemma-4-31b-it', F.GEMMA, null, null, B.STABLE, P.TEXT_GENERATION],
    ['gemini-flash-latest', F.OTHER, null, T.FLASH, B.UNKNOWN, P.TEXT_GENERATION],
    ['gemini-flash-lite-latest', F.OTHER, null, T.FLASH_LITE, B.UNKNOWN, P.TEXT_GENERATION],
    ['gemini-pro-latest', F.OTHER, null, T.PRO, B.UNKNOWN, P.TEXT_GENERATION],
    ['gemini-2.5-flash-lite', F.GEMINI, '2.5', T.FLASH_LITE, B.STABLE, P.TEXT_GENERATION],
    ['gemini-2.5-flash-image', F.GEMINI, '2.5', T.FLASH, B.STABLE, P.IMAGE_GENERATION],
    ['gemini-3-flash-preview', F.GEMINI, '3.0', T.FLASH, B.PREVIEW, P.TEXT_GENERATION],
    ['gemini-3.1-pro-preview', F.GEMINI, '3.1', T.PRO, B.PREVIEW, P.TEXT_GENERATION],
    ['gemini-3.1-pro-preview-customtools', F.GEMINI, '3.1', T.PRO, B.PREVIEW, P.TEXT_GENERATION],
    ['gemini-3.1-flash-lite-preview', F.GEMINI, '3.1', T.FLASH_LITE, B.PREVIEW, P.TEXT_GENERATION],
    ['gemini-3.1-flash-lite', F.GEMINI, '3.1', T.FLASH_LITE, B.STABLE, P.TEXT_GENERATION],
    ['gemini-3-pro-image-preview', F.GEMINI, '3.0', T.PRO, B.PREVIEW, P.IMAGE_GENERATION],
    ['gemini-3-pro-image', F.GEMINI, '3.0', T.PRO, B.STABLE, P.IMAGE_GENERATION],
    ['nano-banana-pro-preview', F.OTHER, null, T.PRO, B.PREVIEW, P.IMAGE_GENERATION],
    ['gemini-3.1-flash-image-preview', F.GEMINI, '3.1', T.FLASH, B.PREVIEW, P.IMAGE_GENERATION],
    ['gemini-3.1-flash-image', F.GEMINI, '3.1', T.FLASH, B.STABLE, P.IMAGE_GENERATION],
    ['gemini-3.1-flash-lite-image', F.GEMINI, '3.1', T.FLASH_LITE, B.STABLE, P.IMAGE_GENERATION],
    ['gemini-3.5-flash', F.GEMINI, '3.5', T.FLASH, B.STABLE, P.TEXT_GENERATION],
    ['gemini-3.5-flash-lite', F.GEMINI, '3.5', T.FLASH_LITE, B.STABLE, P.TEXT_GENERATION],
    ['gemini-omni-flash-preview', F.OTHER, null, T.FLASH, B.PREVIEW, P.OTHER],
    ['gemini-omni-1.1-flash', F.OTHER, null, T.FLASH, B.STABLE, P.OTHER],
    ['gemini-3.5-transcribe', F.GEMINI, '3.5', null, B.STABLE, P.OTHER],
    ['gemini-3.6-flash', F.GEMINI, '3.6', T.FLASH, B.STABLE, P.TEXT_GENERATION],
    ['gemini-3.7-flash', F.GEMINI, '3.7', T.FLASH, B.STABLE, P.TEXT_GENERATION],
    ['gemini-3.8-flash', F.GEMINI, '3.8', T.FLASH, B.STABLE, P.TEXT_GENERATION],
    ['lyria-3-clip-preview', F.OTHER, null, null, B.PREVIEW, P.OTHER],
    ['lyria-3-pro-preview', F.OTHER, null, T.PRO, B.PREVIEW, P.OTHER],
    ['lyria-3.5', F.OTHER, null, null, B.STABLE, P.OTHER],
    ['gemini-3.1-flash-tts-preview', F.GEMINI, '3.1', T.FLASH, B.PREVIEW, P.OTHER],
    ['gemini-robotics-er-2-preview', F.OTHER, null, null, B.PREVIEW, P.OTHER],
    ['gemini-2.5-computer-use-preview-10-2025', F.GEMINI, '2.5', null, B.PREVIEW, P.OTHER],
    ['antigravity-preview-05-2026', F.OTHER, null, null, B.PREVIEW, P.OTHER],
    ['deep-research-max-preview-04-2026', F.OTHER, null, null, B.PREVIEW, P.OTHER],
    ['deep-research-preview-04-2026', F.OTHER, null, null, B.PREVIEW, P.OTHER],
    ['deep-research-pro-preview-12-2025', F.OTHER, null, T.PRO, B.PREVIEW, P.OTHER],
];

describe('Google AI Studio model catalog classification', () => {
    test('classifies the manually reviewed model catalog', () => {
        const rawModels = EXPECTED_MODELS.map(([id]) => ({ id }));
        const expected = EXPECTED_MODELS.map(([id, family, version, tier, branch, purpose], index) => ({
            id,
            family,
            version,
            tier,
            branch,
            purpose,
            rawModel: rawModels[index],
        }));

        const actual = classifyGoogleModels(rawModels);

        expect(actual).toEqual(expected);
        actual.forEach((model, index) => expect(model.rawModel).toBe(rawModels[index]));
    });
});
