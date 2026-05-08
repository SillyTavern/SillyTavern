const openaiXHighReasoningEffortModel = /^gpt-5\.(?:[2-9]|\d{2,})(?:$|-(?:\d{4}-\d{2}-\d{2}|chat-latest|mini(?:-\d{4}-\d{2}-\d{2})?|nano(?:-\d{4}-\d{2}-\d{2})?))$/;

/**
 * Models that only accept a single fixed reasoning effort value.
 * These models accept reasoning_effort, but not xhigh, so the broader family
 * regex must not opt them into the frontend Maximum -> xhigh mapping.
 * @type {Readonly<Record<string, string>>}
 */
export const OPENAI_FIXED_REASONING_EFFORT = Object.freeze({
    'gpt-5.3-chat-latest': 'medium',
});

/**
 * @param {string} model Model name
 * @returns {boolean} True when the OpenAI Chat Completions model supports xhigh reasoning effort
 */
export function supportsOpenAIXHighReasoningEffort(model) {
    return !Object.hasOwn(OPENAI_FIXED_REASONING_EFFORT, model) && openaiXHighReasoningEffortModel.test(model);
}
