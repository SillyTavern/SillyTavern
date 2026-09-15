/**
 * Dynamic Lorebook Manager — Response Analyzer
 *
 * Uses the active LLM backend to identify new information in an AI response
 * that should be incorporated into existing lorebook entries.
 */

import { sendAnalysisRequest } from './api-client.js';
import { simpleHash } from './utils.js';

const SYSTEM_PROMPT = `You are a lorebook analysis assistant for a roleplay/story system.
Your task is to analyze an AI-generated story message and identify new information that should be added to existing lorebook (World Info) entries.

Guidelines:
- Only suggest updates when there is GENUINELY NEW information not already in the entry
- Preserve the original tone, style, and structure of the entry
- Do not add information that is already present in the entry
- Be conservative: a high-confidence, small update is better than a speculative large one
- The "suggestedNewContent" field must be a complete replacement for the entry — integrate old and new naturally

Respond ONLY with valid JSON in the exact format specified. No markdown, no explanation outside the JSON.`;

/**
 * Analyzes an AI response against activated lorebook entries to identify
 * new lore that should be persisted.
 */
export class ResponseAnalyzer {
    /**
     * @param {object} settings - Extension settings reference
     */
    constructor(settings) {
        this.settings = settings;
        /** @type {Map<string, object>} LRU-style analysis cache */
        this.cache = new Map();
        this.cacheMaxSize = 100;
    }

    /**
     * Analyze an AI message against the entries that were active during its generation.
     *
     * @param {string} messageText - The raw AI response text
     * @param {object[]} activatedEntries - WI entries from the detector
     * @param {object|null} [profile] - Optional connection profile to use for the API call
     * @returns {Promise<{updates: object[], newEntities: object[]}>}
     */
    async analyzeMessage(messageText, activatedEntries, profile = null) {
        if (!messageText || !Array.isArray(activatedEntries) || activatedEntries.length === 0) {
            return { updates: [], newEntities: [] };
        }

        const cacheKey = this.getCacheKey(messageText, activatedEntries);
        if (this.cache.has(cacheKey)) {
            if (this.settings.debugMode) {
                console.debug('[DLM] Analysis cache hit for key:', cacheKey);
            }
            return this.cache.get(cacheKey);
        }

        const userPrompt = this.buildPrompt(messageText, activatedEntries);

        if (this.settings.debugMode) {
            console.debug('[DLM] Analysis system prompt:\n', SYSTEM_PROMPT);
            console.debug('[DLM] Analysis user prompt:\n', userPrompt);
            if (profile) {
                console.debug('[DLM] Using connection profile:', profile.name ?? profile.id, `(mode=${profile.mode}, api=${profile.api})`);
            }
        }

        const rawResponse = await sendAnalysisRequest(SYSTEM_PROMPT, userPrompt, profile);

        if (this.settings.debugMode) {
            console.debug('[DLM] Raw LLM response:\n', rawResponse);
        }

        const result = this.parseResponse(rawResponse, activatedEntries);
        this.addToCache(cacheKey, result);
        return result;
    }

    /**
     * Build the user prompt sent to the LLM.
     *
     * @param {string} messageText
     * @param {object[]} entries
     * @returns {string}
     */
    buildPrompt(messageText, entries) {
        const entriesSection = entries.map(e => {
            const keywords = Array.isArray(e.key) ? e.key.join(', ') : '';
            return [
                `Entry UID: ${e.uid}`,
                `World: ${e.world ?? '(unknown)'}`,
                `Title: ${e.comment ?? '(untitled)'}`,
                `Keywords: ${keywords || '(none)'}`,
                `Content:\n${e.content ?? '(empty)'}`,
            ].join('\n');
        }).join('\n\n---\n\n');

        return `ACTIVATED LOREBOOK ENTRIES:
${entriesSection}

AI RESPONSE MESSAGE:
${messageText}

TASK:
For each activated entry, identify facts, expansions, or corrections that appear in the AI response but are NOT already in the entry content.
Only include entries where there is genuinely new information worth recording.

OUTPUT FORMAT (JSON):
{
  "updates": [
    {
      "entryUid": <number — must match one of the UIDs above>,
      "worldName": "<world name string>",
      "entryComment": "<entry title string>",
      "confidence": <0.0–1.0>,
      "changeType": "expansion|correction|addition",
      "reasoning": "<one-sentence explanation of what is new>",
      "suggestedNewContent": "<complete updated entry content — integrates original and new info>",
      "keywordsToAdd": ["<new keyword>"]
    }
  ],
  "newEntities": [
    {
      "name": "<entity name>",
      "description": "<brief description suitable for a lorebook entry>",
      "suggestedKeywords": ["<keyword>"],
      "confidence": <0.0–1.0>
    }
  ]
}`;
    }

    /**
     * Parse and validate the LLM's raw text response.
     * Returns an empty result on any parse failure — never throws.
     *
     * @param {string} raw
     * @param {object[]} activatedEntries
     * @returns {{updates: object[], newEntities: object[]}}
     */
    parseResponse(raw, activatedEntries) {
        const blank = { updates: [], newEntities: [] };

        if (!raw || typeof raw !== 'string') return blank;

        let text = raw.trim();

        // Strip markdown code fences if the model wrapped its output
        text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (_e) {
            // Attempt to extract the first JSON object from prose
            const match = text.match(/\{[\s\S]*\}/);
            if (!match) {
                console.warn('[DLM] Could not find JSON in analysis response:', text.slice(0, 300));
                return blank;
            }
            try {
                parsed = JSON.parse(match[0]);
            } catch (e2) {
                console.warn('[DLM] Could not parse extracted JSON:', e2.message);
                return blank;
            }
        }

        const validUids = new Set(activatedEntries.map(e => e.uid));

        const updates = (Array.isArray(parsed.updates) ? parsed.updates : [])
            .filter(u =>
                typeof u === 'object'
                && u !== null
                && typeof u.entryUid === 'number'
                && validUids.has(u.entryUid)
                && typeof u.suggestedNewContent === 'string'
                && u.suggestedNewContent.trim().length > 0
                && typeof u.confidence === 'number'
                && u.confidence >= 0
                && u.confidence <= 1,
            )
            .map(u => ({
                entryUid: u.entryUid,
                worldName: typeof u.worldName === 'string' ? u.worldName : '',
                entryComment: typeof u.entryComment === 'string' ? u.entryComment : '',
                confidence: u.confidence,
                changeType: ['expansion', 'correction', 'addition'].includes(u.changeType)
                    ? u.changeType
                    : 'expansion',
                reasoning: typeof u.reasoning === 'string' ? u.reasoning : '',
                suggestedNewContent: u.suggestedNewContent.trim(),
                keywordsToAdd: Array.isArray(u.keywordsToAdd)
                    ? u.keywordsToAdd.filter(k => typeof k === 'string')
                    : [],
            }));

        const newEntities = (Array.isArray(parsed.newEntities) ? parsed.newEntities : [])
            .filter(e =>
                typeof e === 'object'
                && e !== null
                && typeof e.name === 'string'
                && e.name.trim().length > 0
                && typeof e.description === 'string',
            )
            .map(e => ({
                name: e.name.trim(),
                description: e.description.trim(),
                suggestedKeywords: Array.isArray(e.suggestedKeywords)
                    ? e.suggestedKeywords.filter(k => typeof k === 'string')
                    : [],
                confidence: typeof e.confidence === 'number' ? e.confidence : 0.5,
            }));

        return { updates, newEntities };
    }

    /**
     * Build a cache key from the message text and entry state.
     * @param {string} messageText
     * @param {object[]} entries
     * @returns {string}
     */
    getCacheKey(messageText, entries) {
        const entryFingerprint = entries.map(e => `${e.uid}:${(e.content ?? '').length}`).join(',');
        return simpleHash(messageText.slice(0, 500) + '|' + entryFingerprint);
    }

    /**
     * Insert into cache, evicting the oldest entry when full.
     * @param {string} key
     * @param {object} value
     */
    addToCache(key, value) {
        if (this.cache.size >= this.cacheMaxSize) {
            const oldest = this.cache.keys().next().value;
            this.cache.delete(oldest);
        }
        this.cache.set(key, value);
    }

    /** Clear the analysis cache. */
    clearCache() {
        this.cache.clear();
    }
}
