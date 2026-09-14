export const GoogleModelFamily = Object.freeze({
    GEMINI: 'Gemini',
    GEMMA: 'Gemma',
    OTHER: 'Other',
});

export const GoogleModelTier = Object.freeze({
    PRO: 'pro',
    FLASH: 'flash',
    FLASH_LITE: 'flash-lite',
});

export const GoogleModelBranch = Object.freeze({
    STABLE: 'stable',
    PREVIEW: 'preview',
    EXPERIMENTAL: 'exp',
    UNKNOWN: 'unknown',
});

export const GoogleModelPurpose = Object.freeze({
    TEXT_GENERATION: 'TextGeneration',
    IMAGE_GENERATION: 'ImageGeneration',
    OTHER: 'Other',
});

const GEMINI_VERSION_PATTERN = /^gemini-(\d+)(?:\.(\d+))?(?:-|$)/;
const IMAGE_MODEL_PATTERN = /(?:^|-)image(?:-|$)/;
const SPECIALIZED_MODEL_PATTERN = /(?:^|-)(?:tts|transcribe|robotics|embedding|veo|lyria|omni|live|computer-use)(?:-|$)/;

/**
 * Tests whether a model ID contains a complete hyphen-delimited token.
 *
 * @param {string} modelId Lowercase model ID
 * @param {string} token Token to find
 * @returns {boolean} Whether the token is present
 */
function hasToken(modelId, token) {
    return modelId === token || modelId.startsWith(`${token}-`) || modelId.endsWith(`-${token}`) || modelId.includes(`-${token}-`);
}

/**
 * Identifies the model family and the normalized Gemini version.
 *
 * @param {string} modelId Lowercase model ID
 * @returns {{ family: string, version: string | null }} Family classification and version
 */
function classifyFamily(modelId) {
    const versionMatch = modelId.match(GEMINI_VERSION_PATTERN);
    if (versionMatch) {
        return {
            family: GoogleModelFamily.GEMINI,
            version: `${versionMatch[1]}.${versionMatch[2] ?? '0'}`,
        };
    }

    if (modelId === 'gemma' || modelId.startsWith('gemma-')) {
        return { family: GoogleModelFamily.GEMMA, version: null };
    }

    return { family: GoogleModelFamily.OTHER, version: null };
}

/**
 * Identifies a performance tier from complete model ID tokens.
 *
 * @param {string} modelId Lowercase model ID
 * @returns {string | null} Recognized tier or null
 */
function classifyTier(modelId) {
    if (hasToken(modelId, GoogleModelTier.FLASH_LITE)) {
        return GoogleModelTier.FLASH_LITE;
    }
    if (hasToken(modelId, GoogleModelTier.FLASH)) {
        return GoogleModelTier.FLASH;
    }
    if (hasToken(modelId, GoogleModelTier.PRO)) {
        return GoogleModelTier.PRO;
    }

    return null;
}

/**
 * Identifies a release branch from complete model ID tokens.
 *
 * @param {string} modelId Lowercase model ID
 * @returns {string} Recognized release branch
 */
function classifyBranch(modelId) {
    const hasPreview = hasToken(modelId, GoogleModelBranch.PREVIEW);
    const hasExperimental = hasToken(modelId, GoogleModelBranch.EXPERIMENTAL) || hasToken(modelId, 'experimental');
    const hasLatest = hasToken(modelId, 'latest');
    const markerCount = Number(hasPreview) + Number(hasExperimental) + Number(hasLatest);

    if (markerCount > 1 || hasLatest) {
        return GoogleModelBranch.UNKNOWN;
    }
    if (hasPreview) {
        return GoogleModelBranch.PREVIEW;
    }
    if (hasExperimental) {
        return GoogleModelBranch.EXPERIMENTAL;
    }

    return GoogleModelBranch.STABLE;
}

/**
 * Identifies the primary model purpose using conservative model ID rules.
 *
 * @param {string} modelId Lowercase model ID
 * @param {string} family Model family
 * @returns {string} Recognized primary purpose
 */
function classifyPurpose(modelId, family) {
    if (IMAGE_MODEL_PATTERN.test(modelId) || modelId.startsWith('imagen-') || modelId.startsWith('nano-banana-')) {
        return GoogleModelPurpose.IMAGE_GENERATION;
    }
    if (SPECIALIZED_MODEL_PATTERN.test(modelId)) {
        return GoogleModelPurpose.OTHER;
    }
    if (family === GoogleModelFamily.GEMINI || family === GoogleModelFamily.GEMMA) {
        return GoogleModelPurpose.TEXT_GENERATION;
    }
    if (modelId.startsWith('gemini-') && hasToken(modelId, 'latest')) {
        return GoogleModelPurpose.TEXT_GENERATION;
    }

    return GoogleModelPurpose.OTHER;
}

/**
 * @typedef {object} ClassifiedGoogleModel
 * @property {string} id Original model ID
 * @property {string} family Gemini, Gemma, or Other
 * @property {string | null} version Normalized Gemini version, or null for other families
 * @property {string | null} tier Pro, Flash, Flash-Lite, or null when no tier is recognized
 * @property {string} branch Stable, preview, experimental, or unknown release branch
 * @property {string} purpose Text generation, image generation, or another specialized purpose
 * @property {object} rawModel Original model object returned by the status endpoint
 */

/**
 * Classifies Google AI Studio models returned in the `data` array of the
 * chat-completions status response. Gemini IDs with a numeric version directly
 * after the `gemini-` prefix are assigned to a normalized Gemini X.Y family;
 * Gemma IDs are assigned to Gemma; all remaining IDs are assigned to Other.
 * Complete ID tokens identify Pro, Flash, and Flash-Lite tiers and stable,
 * preview, experimental, or unknown release branches. Purpose detection gives
 * image-capable ID patterns precedence, treats known audio, transcription,
 * robotics, embedding, video, live, and computer-use patterns as specialized
 * models, and otherwise recognizes versioned Gemini, Gemini latest aliases,
 * and Gemma as general text-generation models. Unrecognized purposes remain
 * Other.
 *
 * The function rejects malformed input instead of omitting it, does not mutate
 * the supplied array or its entries, and keeps each original entry available as
 * `rawModel` for callers that need metadata not represented by the classifier.
 *
 * @param {object[]} models Raw models from the Google AI Studio status response
 * @returns {ClassifiedGoogleModel[]} A new array of structured model records
 * @throws {TypeError} When the input or a model ID is malformed
 */
export function classifyGoogleModels(models) {
    if (!Array.isArray(models)) {
        throw new TypeError('Expected Google models to be an array');
    }

    return models.map((rawModel, index) => {
        if (rawModel === null || typeof rawModel !== 'object' || Array.isArray(rawModel)) {
            throw new TypeError(`Google model at index ${index} must be an object`);
        }
        if (typeof rawModel.id !== 'string' || rawModel.id.trim().length === 0) {
            throw new TypeError(`Google model at index ${index} must have a non-empty string id`);
        }

        const normalizedId = rawModel.id.toLowerCase();
        const { family, version } = classifyFamily(normalizedId);

        return {
            id: rawModel.id,
            family,
            version,
            tier: classifyTier(normalizedId),
            branch: classifyBranch(normalizedId),
            purpose: classifyPurpose(normalizedId, family),
            rawModel,
        };
    });
}
