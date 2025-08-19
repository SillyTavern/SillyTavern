/**
 * Common debounce timeout values to use with `debounce` calls.
 * @enum {number}
 */
export const debounce_timeout = {
    /** [100 ms] For ultra-fast responses, typically for keypresses or executions that might happen multiple times in a loop or recursion. */
    quick: 100,
    /** [200 ms] Slightly slower than quick, but still very responsive. */
    short: 200,
    /** [300 ms] Default time for general use, good balance between responsiveness and performance. */
    standard: 300,
    /** [1.000 ms] For situations where the function triggers more intensive tasks. */
    relaxed: 1000,
    /** [5 sec] For delayed tasks, like auto-saving or completing batch operations that need a significant pause. */
    extended: 5000,
};

/**
 * Used as an ephemeral key in message extra metadata.
 * When set, the message will be excluded from generation
 * prompts without affecting the number of chat messages,
 * which is needed to preserve world info timed effects.
 */
export const IGNORE_SYMBOL = Symbol.for('ignore');

/**
 * Common video file extensions. Should be the same as supported by Gemini.
 * https://ai.google.dev/gemini-api/docs/video-understanding#supported-formats
 */
export const VIDEO_EXTENSIONS = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', '3gp', 'mkv', 'mpg'];

/**
 * Known generation triggers that can be passed to Generate function.
 */
export const GENERATION_TYPE_TRIGGERS = [
    'normal',
    'continue',
    'impersonate',
    'swipe',
    'regenerate',
    'quiet',
];

/**
 * Known injection IDs and helper functions for system extensions handling.
 */
export const inject_ids = {
    STORY_STRING: '__STORY_STRING__',
    QUIET_PROMPT: 'QUIET_PROMPT',
    DEPTH_PROMPT: 'DEPTH_PROMPT',
    DEPTH_PROMPT_INDEX: (index) => `DEPTH_PROMPT_${index}`,
    CUSTOM_WI_DEPTH: 'customDepthWI',
    CUSTOM_WI_DEPTH_ROLE: (depth, role) => `customDepthWI_${depth}_${role}`,
};

export const COMETAPI_IGNORE_PATTERNS = [
    // Image generation models
    'dall-e', 'dalle', 'midjourney', 'mj_', 'stable-diffusion', 'sd-',
    'flux-', 'playground-v', 'ideogram', 'recraft-', 'black-forest-labs',
    '/recraft-v3', 'recraftv3', 'stability-ai/', 'sdxl',
    // Audio generation models
    'suno_', 'tts', 'whisper',
    // Video generation models
    'runway', 'luma_', 'luma-', 'veo', 'kling_', 'minimax_video', 'hunyuan-t1',
    // Utility models
    'embedding', 'search-gpts', 'files_retrieve', 'moderation',
];
