import { getCharacterCardFields, eventSource, event_types, substituteParams } from '../../script.js';
import { getWorldInfoPrompt } from '../world-info.js';
import { getTokenCountAsync } from '../tokenizers.js';
import { getPresetManager } from '../preset-manager.js';
import { system_prompts } from '../sysprompt.js';
import { system_message_types } from '../system-messages.js';
import { persona_description_positions } from '../personas.js';
import { power_user } from '../power-user.js';
import { ConnectionManagerRequestService } from './shared.js';

/**
 * @typedef {Object} BuildLeanChatPromptArgs
 * @property {string} profileId Connection profile to size against (provides budget,
 *   sysprompt resolution, prompt_post_processing semantics).
 * @property {string} [quietPrompt] Optional caller instruction appended as the final
 *   user message. Behaves like `quiet_prompt` in the main pipeline — purely a
 *   trailing instruction, similar to `systemInstruction` at the head.
 * @property {boolean} [includeCharacter=false] Include character-card-derived fields
 *   (description, personality, scenario, depth prompt, mes_examples). Fields are
 *   concatenated raw (no labels) to avoid breaking instruct templates.
 * @property {boolean} [includePersonaDescription=false] Include the active persona's
 *   description, respecting `persona_description_position` from user settings
 *   (IN_PROMPT inline, AT_DEPTH inserted into history, NONE → skipped).
 * @property {boolean} [includeChatHistory=false] Include recent chat messages.
 *   Fills remaining budget after fixed sections; which end is dropped when capped
 *   depends on `historyPacking`.
 * @property {?number} [historyMaxMessages=null] Optional cap on number of history
 *   messages considered. Null means no extra cap (still budget-bound).
 * @property {?number} [historySkipMessages=null] Skip the first N messages of the
 *   considered range (typically used by `oldest-first` callers like summary that
 *   already processed everything up to a known index — passing the index here
 *   advances the cursor instead of re-scanning from chat start every run).
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
 *   sysprompt at the start. For CC profiles, this is the 'main' identifier from
 *   the connection's CC preset (matches what the main pipeline would inject); for
 *   TC profiles, it's the named system prompt from the sysprompt manager. Macros
 *   ({{char}}, {{user}}, etc.) are resolved.
 * @property {?string} [systemInstruction=null] Caller-supplied system message,
 *   prepended at the very start (before sysprompt / character / world info).
 *   Useful for classifier-style prompts (expressions: "Classify the emotion in
 *   the following text...") where the instruction belongs in system role.
 * @property {boolean} [rejectOnOverflow=true] If the fixed sections (system /
 *   character / world info / final user message) already exceed the input budget
 *   before any history is added, throw instead of silently emitting a prompt that
 *   the model will refuse. Set false to mimic the main TC builder behaviour, which
 *   sends overfit prompts.
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
    quietPrompt = '',
    includeCharacter = false,
    includePersonaDescription = false,
    includeChatHistory = false,
    historyMaxMessages = null,
    historySkipMessages = null,
    chatHistory = null,
    historyPacking = 'newest-first',
    includeWorldInfo = false,
    includeSystemPrompt = false,
    systemInstruction = null,
    rejectOnOverflow = true,
}) {
    if (!profileId) {
        throw new Error('buildLeanChatPrompt: profileId is required');
    }

    const profile = ConnectionManagerRequestService.getProfile(profileId);
    const apiKind = ConnectionManagerRequestService.validateProfile(profile).selected;
    const { context: contextBudget, response: responseReserve } = resolveBudget(profile, apiKind);
    const inputBudget = Math.max(0, contextBudget - responseReserve);

    const head = [];
    const personaDepthEntry = collectPersonaDescription(includePersonaDescription);

    if (typeof systemInstruction === 'string' && systemInstruction.length > 0) {
        head.push({ role: 'system', content: systemInstruction });
    }

    if (includeSystemPrompt) {
        const sys = resolveSysprompt(profile, apiKind);
        if (sys) head.push({ role: 'system', content: sys });
    }

    if (includeCharacter || (personaDepthEntry && personaDepthEntry.placement === 'in-character-block')) {
        const block = buildCharacterBlock({
            includeCard: includeCharacter,
            personaInline: personaDepthEntry?.placement === 'in-character-block' ? personaDepthEntry.content : null,
        });
        if (block) head.push({ role: 'system', content: block });
    }

    if (includeWorldInfo) {
        const block = await buildWorldInfoBlock(contextBudget);
        if (block) head.push({ role: 'system', content: block });
    }

    const finalUser = quietPrompt
        ? { role: 'user', content: quietPrompt }
        : null;

    let claimed = 0;
    for (const m of head) claimed += await tokenCost(m);
    if (finalUser) claimed += await tokenCost(finalUser);

    if (claimed > inputBudget && rejectOnOverflow) {
        throw new Error(
            `buildLeanChatPrompt: fixed sections claim ${claimed} tokens, ` +
            `but input budget is ${inputBudget} (context ${contextBudget} − response ${responseReserve}). ` +
            'Either trim systemInstruction/quietPrompt/character fields, raise the profile\'s context, ' +
            'or pass rejectOnOverflow: false to emit anyway.',
        );
    }

    let history = [];
    if (includeChatHistory) {
        const remaining = inputBudget - claimed;
        if (remaining > 0) {
            history = await collectChatHistory({
                budgetTokens: remaining,
                maxMessages: historyMaxMessages,
                skipMessages: historySkipMessages,
                chatOverride: chatHistory,
                packing: historyPacking,
            });
        }
    }

    if (personaDepthEntry?.placement === 'at-depth') {
        const insertIndex = Math.max(0, history.length - (personaDepthEntry.depth ?? 0));
        history.splice(insertIndex, 0, {
            role: personaDepthEntry.role,
            content: personaDepthEntry.content,
        });
    }

    const messages = finalUser ? [...head, ...history, finalUser] : [...head, ...history];

    console.debug('[lean-chat-prompt] built', {
        profileId,
        apiKind,
        budget: { context: contextBudget, response: responseReserve, input: inputBudget },
        messageCount: messages.length,
        claimed,
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
    // 8k is a safer fallback than 4k for the modern API/model landscape — almost
    // every relevant model supports at least 8k, and undersizing risks dropping
    // history that would have fit.
    const DEFAULT_CONTEXT = 8192;
    const DEFAULT_RESPONSE = 512;
    if (apiKind === 'openai') {
        const presetManager = getPresetManager('openai');
        const preset = presetManager?.getCompletionPresetByName(profile.preset);
        return {
            context: numberOr(preset?.openai_max_context, DEFAULT_CONTEXT),
            response: numberOr(preset?.openai_max_tokens, DEFAULT_RESPONSE),
        };
    }
    const presetManager = getPresetManager('textgenerationwebui');
    const preset = presetManager?.getCompletionPresetByName(profile.preset);
    return {
        context: numberOr(preset?.max_context ?? preset?.max_length, DEFAULT_CONTEXT),
        response: numberOr(preset?.genamt ?? preset?.max_length, DEFAULT_RESPONSE),
    };
}

function numberOr(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Resolve the profile's system prompt content as a string.
 * For CC profiles, that's the `main` identifier in the connection's CC preset
 * (matching what the main openai.js pipeline would inject). For TC profiles,
 * the named sysprompt entry from the sysprompt manager.
 * Macros ({{char}}, {{user}}, etc.) are evaluated.
 */
function resolveSysprompt(profile, apiKind) {
    let raw = '';
    if (apiKind === 'openai') {
        const presetManager = getPresetManager('openai');
        const preset = presetManager?.getCompletionPresetByName(profile.preset);
        const prompts = Array.isArray(preset?.prompts) ? preset.prompts : [];
        const mainPrompt = prompts.find(p => p?.identifier === 'main');
        raw = (mainPrompt?.content ?? '').trim();
    } else {
        if (profile['sysprompt-state'] === false) return '';
        const name = profile.sysprompt;
        if (!name) return '';
        const found = system_prompts.find(s => s.name === name);
        raw = (found?.content ?? '').trim();
    }
    if (!raw) return '';
    return substituteParams(raw);
}

function buildCharacterBlock({ includeCard, personaInline }) {
    const parts = [];
    if (includeCard) {
        const fields = getCharacterCardFields();
        if (fields.description) parts.push(fields.description);
        if (fields.personality) parts.push(fields.personality);
        if (fields.scenario) parts.push(fields.scenario);
        if (fields.charDepthPrompt) parts.push(fields.charDepthPrompt);
        if (fields.mesExamples) parts.push(fields.mesExamples);
    }
    if (personaInline) parts.push(personaInline);
    return parts.filter(Boolean).join('\n\n').trim();
}

/**
 * Determine where the persona description (if enabled) should be placed.
 * Returns null when the user has the persona description disabled, no persona
 * description exists, or `includePersonaDescription` was false at call time.
 *
 * Placement values:
 *   'in-character-block' — append to the character block (IN_PROMPT / AFTER_CHAR)
 *   'at-depth'           — splice into history at .depth from the end (AT_DEPTH)
 * Other persona_description_positions (TOP_AN / BOTTOM_AN) aren't applicable to
 * a lean prompt and are treated as IN_PROMPT for simplicity.
 *
 * @param {boolean} include
 */
function collectPersonaDescription(include) {
    if (!include) return null;
    const avatarId = power_user?.['user_avatar'] ?? null;
    const desc = (power_user?.persona_descriptions?.[avatarId]?.description ?? '').trim();
    if (!desc) return null;
    const position = power_user?.persona_description_position;
    if (position === persona_description_positions.NONE) return null;
    const content = substituteParams(desc);
    if (position === persona_description_positions.AT_DEPTH) {
        return {
            placement: 'at-depth',
            content,
            depth: Number(power_user?.persona_description_depth ?? 2),
            role: power_user?.persona_description_role === 1 ? 'user'
                : power_user?.persona_description_role === 2 ? 'assistant'
                    : 'system',
        };
    }
    return { placement: 'in-character-block', content };
}

async function buildWorldInfoBlock(contextBudget) {
    const ctx = SillyTavern.getContext();
    // Don't filter empty messages here — the main pipeline scans the raw chat
    // when activating WI entries (vector-similarity / regex), so filtering could
    // shift activation thresholds and produce a different entry set than what
    // the main flow would have triggered. Pass the chat through as-is.
    const reverseChat = (ctx.chat ?? [])
        .map(m => (m?.mes ?? '').toString())
        .reverse();
    try {
        const wi = await getWorldInfoPrompt(reverseChat, contextBudget, true, undefined);
        return (wi?.worldInfoString ?? '').trim();
    } catch (err) {
        console.warn('[lean-chat-prompt] World Info gather failed:', err);
        return '';
    }
}

// Padding constant: rough overhead per message (role separators + JSON envelope
// in CC, instruct template boilerplate in TC). 4 tokens is a conservative
// estimate that matches the value used by the openai.js prompt builder for
// equivalent per-message overhead. Keep in sync if upstream changes it.
const MESSAGE_TOKEN_PADDING = 4;

async function tokenCost(message) {
    // Use a double-newline separator to mirror the SentencePiece / Web tokenizer
    // wrappers in src/endpoints/tokenizers.js, which join fields with \n\n.
    // Slight inflation vs ': ' separator but avoids systematic under-count.
    const text = `${message.role}\n\n${message.content}`;
    // TODO(follow-up): getTokenCountAsync currently tokenizes against main_api,
    // not the targeted profile's tokenizer. For a budget that's stable across
    // profile switches we'd need to thread profile-specific tokenizer selection
    // through callTokenizerAsync. Tracked as Codex review P1 #2 on PR #5620.
    return await getTokenCountAsync(text, MESSAGE_TOKEN_PADDING);
}

async function collectChatHistory({ budgetTokens, maxMessages, skipMessages, chatOverride, packing }) {
    const ctx = SillyTavern.getContext();
    const chat = Array.isArray(chatOverride) ? chatOverride : (ctx.chat ?? []);
    if (!chat.length) return [];

    const oldestFirst = packing === 'oldest-first';
    const skip = Math.max(0, Number(skipMessages) || 0);
    const sliceEnd = chat.length;
    const sliceStart = oldestFirst
        ? Math.min(skip, sliceEnd)
        : (maxMessages != null ? Math.max(0, sliceEnd - maxMessages) : 0);
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

/**
 * Project a stored ST chat message onto a lean {role, content} entry.
 *
 * Note: despite the field's name, `stMessage.is_system` does NOT mean the
 * message belongs in the 'system' role — it's a "prompt-hidden" flag (the
 * message is ignored when building the main prompt). The actual narrator /
 * system marker is `stMessage.extra.type === system_message_types.NARRATOR`,
 * which the `/sys` command sets.
 *
 * @param {ChatMessage} stMessage
 * @returns {ChatCompletionMessage}
 */
function toLeanMessage(stMessage) {
    const isNarrator = stMessage?.extra?.type === system_message_types.NARRATOR;
    const role = stMessage.is_user
        ? 'user'
        : isNarrator
            ? 'system'
            : 'assistant';
    return { role, content: (stMessage.mes ?? '').toString().trim() };
}
