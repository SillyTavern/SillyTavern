import { describe, expect, test } from '@jest/globals';
import {
    classifyGoogleModels,
    GoogleModelBranch,
    GoogleModelFamily,
    GoogleModelPurpose,
    GoogleModelTier,
} from '../public/scripts/google-model.js';

describe('Google AI Studio model classification', () => {
    test('recognizes Gemini versions and tiers', () => {
        const cases = [
            ['gemini-2.0-flash', '2.0', GoogleModelTier.FLASH],
            ['gemini-2.5-pro', '2.5', GoogleModelTier.PRO],
            ['gemini-3-flash-preview', '3.0', GoogleModelTier.FLASH],
            ['gemini-3.5-flash-lite', '3.5', GoogleModelTier.FLASH_LITE],
            ['gemini-10.2-flash', '10.2', GoogleModelTier.FLASH],
        ];

        for (const [id, version, tier] of cases) {
            const [model] = classifyGoogleModels([{ id }]);
            expect(model).toMatchObject({
                family: GoogleModelFamily.GEMINI,
                version,
                tier,
            });
        }
    });

    test('recognizes non-versioned families and tiers', () => {
        const cases = [
            ['gemma-3-27b-it', GoogleModelFamily.GEMMA, null],
            ['gemini-flash-latest', GoogleModelFamily.OTHER, GoogleModelTier.FLASH],
            ['gemini-robotics-er-2-preview', GoogleModelFamily.OTHER, null],
            ['gemini-embedding-2', GoogleModelFamily.OTHER, null],
            ['learnlm-2.0-flash-experimental', GoogleModelFamily.OTHER, GoogleModelTier.FLASH],
        ];

        for (const [id, family, tier] of cases) {
            const [model] = classifyGoogleModels([{ id }]);
            expect(model).toMatchObject({ family, tier, version: null });
        }
    });

    test('recognizes release branches', () => {
        const cases = [
            ['gemini-2.5-pro', GoogleModelBranch.STABLE],
            ['gemini-3.1-pro-preview', GoogleModelBranch.PREVIEW],
            ['gemini-2.0-flash-thinking-exp', GoogleModelBranch.EXPERIMENTAL],
            ['learnlm-2.0-flash-experimental', GoogleModelBranch.EXPERIMENTAL],
            ['gemini-flash-latest', GoogleModelBranch.UNKNOWN],
            ['gemini-3.0-flash-preview-exp', GoogleModelBranch.UNKNOWN],
        ];

        for (const [id, branch] of cases) {
            const [model] = classifyGoogleModels([{ id }]);
            expect(model.branch).toBe(branch);
        }
    });

    test('recognizes primary purposes', () => {
        const cases = [
            ['gemini-2.5-flash', GoogleModelPurpose.TEXT_GENERATION],
            ['gemini-2.5-pro', GoogleModelPurpose.TEXT_GENERATION],
            ['gemini-flash-latest', GoogleModelPurpose.TEXT_GENERATION],
            ['gemma-3-27b-it', GoogleModelPurpose.TEXT_GENERATION],
            ['gemini-2.5-flash-image', GoogleModelPurpose.IMAGE_GENERATION],
            ['nano-banana-pro-preview', GoogleModelPurpose.IMAGE_GENERATION],
            ['gemini-3.1-flash-image', GoogleModelPurpose.IMAGE_GENERATION],
            ['gemini-2.5-flash-image-preview-tts', GoogleModelPurpose.IMAGE_GENERATION],
            ['imagen-4.0-generate', GoogleModelPurpose.IMAGE_GENERATION],
            ['lyria-3-clip-preview', GoogleModelPurpose.OTHER],
            ['lyria-3.5', GoogleModelPurpose.OTHER],
            ['gemini-2.5-flash-preview-tts', GoogleModelPurpose.OTHER],
            ['gemini-2.5-pro-preview-tts', GoogleModelPurpose.OTHER],
            ['gemini-3.5-transcribe', GoogleModelPurpose.OTHER],
            ['gemini-robotics-er-2-preview', GoogleModelPurpose.OTHER],
            ['gemini-omni-1.1-flash', GoogleModelPurpose.OTHER],
            ['veo-3.1-generate-preview', GoogleModelPurpose.OTHER],
            ['gemini-embedding-2', GoogleModelPurpose.OTHER],
            ['unrecognized-model', GoogleModelPurpose.OTHER],
        ];

        for (const [id, purpose] of cases) {
            const [model] = classifyGoogleModels([{ id }]);
            expect(model.purpose).toBe(purpose);
        }
    });

    test('preserves the original model and does not mutate the input', () => {
        const rawModel = Object.freeze({
            id: 'gemini-2.5-flash',
            displayName: 'Gemini 2.5 Flash',
        });
        const models = Object.freeze([rawModel]);

        const result = classifyGoogleModels(models);

        expect(result).toEqual([{
            id: rawModel.id,
            family: GoogleModelFamily.GEMINI,
            version: '2.5',
            tier: GoogleModelTier.FLASH,
            branch: GoogleModelBranch.STABLE,
            purpose: GoogleModelPurpose.TEXT_GENERATION,
            rawModel,
        }]);
        expect(result[0].rawModel).toBe(rawModel);
    });

    test('rejects malformed input', () => {
        const cases = [
            [null, 'Expected Google models to be an array'],
            [[null], 'Google model at index 0 must be an object'],
            [[{}], 'Google model at index 0 must have a non-empty string id'],
            [[{ id: 42 }], 'Google model at index 0 must have a non-empty string id'],
            [[{ id: '   ' }], 'Google model at index 0 must have a non-empty string id'],
        ];

        for (const [input, message] of cases) {
            expect(() => classifyGoogleModels(input)).toThrow(new TypeError(message));
        }
    });
});
