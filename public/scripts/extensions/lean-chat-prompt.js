import { getCharacterCardFields, eventSource, event_types } from '../../script.js';
import { getWorldInfoPrompt } from '../world-info.js';
import { getTokenCountAsync } from '../tokenizers.js';
import { getPresetManager } from '../preset-manager.js';
import { system_prompts } from '../sysprompt.js';
import { ConnectionManagerRequestService } from './shared.js';

/**
 * @typedef {Object} ChatCompletionMessage
 * @property {'system'|'user'|'assistant'} role
 * @property {string} content
 */

/**
 * @typedef {Object} BuildLeanChatPromptArgs
 * @property {string} profileId Connection profile to size against (provides budget,
 *   sysprompt resolution, prompt_post_processing semantics).
 * @property {string} quietPrompt The caller's instruction. Appended as the final
 *   user message. Required.
 * @property {boolean} [includeCharacter=false] Include all character-card-derived
 *   bits (description, personality, scenario, depth prompt, mes_examples). Bundled
 *   per single toggle.
 * @property {boolean} [includeChatHistory=false] Include recent chat messages.
 *   Fills remaining budget after fixed sections; oldest dropped first when capped.
 * @property {?number} [historyMaxMessages=null] Optional cap on number of history
 *   messages considered. Null means no extra cap (still budget-bound).
 * @property {?Array} [chatHistory=null] Override for which chat messages to consider.
 *   Defaults to the active chat from SillyTavern.getContext().chat. Useful for
 *   callers (e.g. summary) that want to pass a pre-filtered range.
 * @property {'newest-first'|'oldest-first'} [historyPacking='newest-first'] When
 *   the budget can't hold every history message, which end to keep. 'newest-first'
 *   (default) keeps recent context, drops oldest — fits chat / RAG / classification.
 *   'oldest-first' keeps the start of the range, drops newest — fits summary, where
 *   we want to advance from the last summary point forward.
 * @property {boolean} [includeWorldInfo=false] Include activated World Info entries.
 * @property {boolean} [includeSystemPrompt=false] Include profile's configured
 *   sysprompt at the start.
 * @property {?string} [systemInstruction=null] Caller-supplied system message,
 *   prepended at the very start (before sysprompt / character / world info).
 *   Useful for classifier-style prompts (expressions: "Classify the emotion in
 *   the following text...") where the instruction belongs in system role.
 */

/**
 * Build a chat-completion-style messages array sized to a connection profile's
 * input budget.
 *
 * The output is API-agnostic: callers chain with the existing bridge so the same
 * code works for both Chat Completion and Text Completion profiles.
 *
 * ```js
 * const messages = await buildLeanChatPrompt({ profileId, quietPrompt, ... });
 * const prompt = ConnectionManagerRequestService.constructPrompt(messages, profileId);
 * const result = await ConnectionManagerRequestService.sendRequest(profileId, prompt, maxTokens);
 * ```
 *
 * `prompt-post-processing` configured on the profile is applied server-side by
 * `ChatCompletionService.processRequest` (the chosen mode is forwarded as
 * `custom_prompt_post_processing`); this builder produces the raw messages and
 * does not pre-merge.
 *
 * @param {BuildLeanChatPromptArgs} args
 * @returns {Promise<ChatCompletionMessage[]>}
 */
export async function buildLeanChatPrompt({
    profileId,
    quietPrompt,
    includeCharacter = false,
    includeChatHistory = false,
    historyMaxMessages = null,
    chatHistory = null,
    historyPacking = 'newest-first',
    includeWorldInfo = false,
    includeSystemPrompt = false,
    systemInstruction = null,
}) {
    if (!profileId) {
        throw new Error('buildLeanChatPrompt: profileId is required');
    }
    if (typeof quietPrompt !== 'string' || !quietPrompt.length) {
        throw new Error('buildLeanChatPrompt: quietPrompt is required');
    }

    const profile = ConnectionManagerRequestService.getProfile(profileId);
    const apiKind = ConnectionManagerRequestService.validateProfile(profile).selected;
    const { context: contextBudget, response: responseReserve } = resolveBudget(profile, apiKind);
    const inputBudget = Math.max(0, contextBudget - responseReserve);

    const head = [];

    if (typeof systemInstruction === 'string' && systemInstruction.length > 0) {
        head.push({ role: 'system', content: systemInstruction });
    }

    if (includeSystemPrompt) {
        const sys = resolveSysprompt(profile);
        if (sys) head.push({ role: 'system', content: sys });
    }

    if (includeCharacter) {
        const block = buildCharacterBlock();
        if (block) head.push({ role: 'system', content: block });
    }

    if (includeWorldInfo) {
        const block = await buildWorldInfoBlock(contextBudget);
        if (block) head.push({ role: 'system', content: block });
    }

    const finalUser = { role: 'user', content: quietPrompt };

    let claimed = 0;
    for (const m of head) claimed += await tokenCost(m);
    claimed += await tokenCost(finalUser);

    let history = [];
    if (includeChatHistory) {
        const remaining = inputBudget - claimed;
        if (remaining > 0) {
            history = await collectChatHistory(remaining, historyMaxMessages, chatHistory, historyPacking);
        }
    }

    const messages = [...head, ...history, finalUser];

    console.debug('[lean-chat-prompt] built', {
        profileId,
        apiKind,
        budget: { context: contextBudget, response: responseReserve, input: inputBudget },
        messageCount: messages.length,
    });

    return messages;
}

/**
 * Run the prompt through ST's transport-layer inspection events, then through
 * the profile's CC/TC bridge, and return the value ready for `sendRequest()`.
 *
 * For chat-completion profiles, fires `CHAT_COMPLETION_PROMPT_READY` with
 * `{ chat, dryRun: false }` — the same event the main pipeline emits, which the
 * Prompt Inspector extension hooks into. Listeners may mutate `chat` in place.
 *
 * For text-completion profiles, the messages are first rendered via
 * `constructPrompt` (instruct template applied), then `GENERATE_AFTER_COMBINE_PROMPTS`
 * is fired with `{ prompt, dryRun: false }`. Listeners may rewrite `data.prompt`.
 *
 * @param {ChatCompletionMessage[]} messages
 * @param {string} profileId
 * @returns {Promise<string | ChatCompletionMessage[]>}
 */
/**
 * Sentinel returned when the user clicks "Cancel generation" inside the Prompt
 * Inspector popup. Callers should bail out without invoking sendRequest.
 */
export const LEAN_PROMPT_CANCELLED = Symbol('LEAN_PROMPT_CANCELLED');

export async function prepareLeanPromptForTransport(messages, profileId) {
    const profile = ConnectionManagerRequestService.getProfile(profileId);
    const apiKind = ConnectionManagerRequestService.validateProfile(profile).selected;

    let cancelled = false;
    const onStop = () => { cancelled = true; };
    eventSource.on(event_types.GENERATION_STOPPED, onStop);

    try {
        if (apiKind === 'openai') {
            const eventData = { chat: messages, dryRun: false };
            await eventSource.emit(event_types.CHAT_COMPLETION_PROMPT_READY, eventData);
            if (cancelled) return LEAN_PROMPT_CANCELLED;
            return ConnectionManagerRequestService.constructPrompt(messages, profileId);
        }

        const rendered = ConnectionManagerRequestService.constructPrompt(messages, profileId);
        const eventData = { prompt: rendered, dryRun: false };
        await eventSource.emit(event_types.GENERATE_AFTER_COMBINE_PROMPTS, eventData);
        if (cancelled) return LEAN_PROMPT_CANCELLED;
        return eventData.prompt;
    } finally {
        eventSource.removeListener(event_types.GENERATION_STOPPED, onStop);
    }
}

function resolveBudget(profile, apiKind) {
    if (apiKind === 'openai') {
        const presetManager = getPresetManager('openai');
        const preset = presetManager?.getCompletionPresetByName(profile.preset);
        return {
            context: numberOr(preset?.openai_max_context, 4096),
            response: numberOr(preset?.openai_max_tokens, 512),
        };
    }
    const presetManager = getPresetManager('textgenerationwebui');
    const preset = presetManager?.getCompletionPresetByName(profile.preset);
    return {
        context: numberOr(preset?.max_context ?? preset?.max_length, 4096),
        response: numberOr(preset?.genamt ?? preset?.max_length, 512),
    };
}

function numberOr(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

function resolveSysprompt(profile) {
    if (profile['sysprompt-state'] === false) return '';
    const name = profile.sysprompt;
    if (!name) return '';
    const found = system_prompts.find(s => s.name === name);
    return (found?.content ?? '').trim();
}

function buildCharacterBlock() {
    const fields = getCharacterCardFields();
    const parts = [];
    if (fields.description) parts.push(fields.description);
    if (fields.personality) parts.push(`Personality: ${fields.personality}`);
    if (fields.scenario) parts.push(`Scenario: ${fields.scenario}`);
    if (fields.persona) parts.push(`User: ${fields.persona}`);
    if (fields.charDepthPrompt) parts.push(fields.charDepthPrompt);
    if (fields.mesExamples) parts.push(fields.mesExamples);
    return parts.filter(Boolean).join('\n\n').trim();
}

async function buildWorldInfoBlock(contextBudget) {
    const ctx = SillyTavern.getContext();
    const reverseChat = (ctx.chat ?? [])
        .map(m => (m?.mes ?? '').toString())
        .filter(Boolean)
        .reverse();
    try {
        const wi = await getWorldInfoPrompt(reverseChat, contextBudget, true, undefined);
        return (wi?.worldInfoString ?? '').trim();
    } catch (err) {
        console.warn('[lean-chat-prompt] World Info gather failed:', err);
        return '';
    }
}

async function tokenCost(message) {
    const text = `${message.role}: ${message.content}`;
    return await getTokenCountAsync(text, 4);
}

async function collectChatHistory(budgetTokens, maxMessages, chatOverride, packing) {
    const ctx = SillyTavern.getContext();
    const chat = Array.isArray(chatOverride) ? chatOverride : (ctx.chat ?? []);
    if (!chat.length) return [];

    const oldestFirst = packing === 'oldest-first';
    const sliceEnd = chat.length;
    const sliceStart = maxMessages != null
        ? (oldestFirst ? 0 : Math.max(0, sliceEnd - maxMessages))
        : 0;
    const sliceTop = maxMessages != null && oldestFirst
        ? Math.min(sliceEnd, sliceStart + maxMessages)
        : sliceEnd;
    const candidates = chat
        .slice(sliceStart, sliceTop)
        .map(toLeanMessage)
        .filter(m => m.content);

    const result = [];
    let used = 0;
    if (oldestFirst) {
        for (let i = 0; i < candidates.length; i++) {
            const m = candidates[i];
            const cost = await tokenCost(m);
            if (used + cost > budgetTokens) break;
            result.push(m);
            used += cost;
        }
    } else {
        for (let i = candidates.length - 1; i >= 0; i--) {
            const m = candidates[i];
            const cost = await tokenCost(m);
            if (used + cost > budgetTokens) break;
            result.unshift(m);
            used += cost;
        }
    }
    return result;
}

function toLeanMessage(stMessage) {
    const role = stMessage.is_user
        ? 'user'
        : stMessage.is_system
            ? 'system'
            : 'assistant';
    return { role, content: (stMessage.mes ?? '').toString().trim() };
}
