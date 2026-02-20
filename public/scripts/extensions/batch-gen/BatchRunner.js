import { getRequestHeaders, name1, name2 } from '../../../script.js';
import { textgen_types, textgenerationwebui_settings, getTextGenServer, getTextGenGenerationData } from '../../textgen-settings.js';
import { power_user } from '../../power-user.js';
import { formatInstructModeChat, formatInstructModePrompt, force_output_sequence } from '../../instruct-mode.js';

/**
 * Concurrency-controlled batch generation engine.
 *
 * Uses the currently selected sampler preset, instruct template, and stop
 * strings — but does NOT inject character card, world info, chat history,
 * or system prompt. The caller is responsible for providing a clean prompt.
 */
export class BatchRunner {
    constructor() {
        /** @type {AbortController|null} */
        this._abortController = null;
        /** @type {boolean} */
        this._cancelled = false;
        /** @type {((job: import('./BatchJob.js').BatchJob) => void)|null} */
        this.onJobUpdate = null;
    }

    /**
     * Get the recommended default concurrency for the current backend.
     * @returns {number}
     */
    static getDefaultConcurrency() {
        const type = textgenerationwebui_settings.type;
        switch (type) {
            case textgen_types.TABBY:
                return 8;
            case textgen_types.VLLM:
            case textgen_types.APHRODITE:
                return 8;
            case textgen_types.KOBOLDCPP:
                return 1;
            default:
                return 1;
        }
    }

    /**
     * Run a batch of jobs with concurrency control.
     * @param {import('./BatchJob.js').BatchJob[]} jobs
     * @param {object} options
     * @param {number} options.concurrency
     * @param {number} options.maxTokens
     * @param {number} [options.timeoutMs=120000]
     * @returns {Promise<string[]>} - Results array, same length as jobs
     */
    async run(jobs, { concurrency, maxTokens, timeoutMs = 120000 }) {
        this._cancelled = false;
        this._abortController = new AbortController();

        const executing = new Set();

        for (const job of jobs) {
            if (this._cancelled) break;

            const promise = this._runJob(job, maxTokens, timeoutMs)
                .finally(() => executing.delete(promise));
            executing.add(promise);

            if (executing.size >= concurrency) {
                await Promise.race(executing);
            }
        }

        await Promise.allSettled(executing);

        return jobs.map(j => j.result ?? j.error ?? '[ERROR] Unknown');
    }

    /**
     * Cancel all in-flight and pending jobs.
     */
    cancel() {
        this._cancelled = true;
        if (this._abortController) {
            this._abortController.abort();
        }
    }

    /**
     * Execute a single job.
     * @param {import('./BatchJob.js').BatchJob} job
     * @param {number} maxTokens
     * @param {number} timeoutMs
     */
    async _runJob(job, maxTokens, timeoutMs) {
        job.status = 'running';
        this._emitUpdate(job);

        const perJobController = new AbortController();
        const timer = setTimeout(() => perJobController.abort(), timeoutMs);

        const onBatchAbort = () => perJobController.abort();
        this._abortController?.signal.addEventListener('abort', onBatchAbort, { once: true });

        try {
            const text = await this._callBackend(job.prompt, maxTokens, perJobController.signal);
            job.result = text;
            job.status = 'done';
        } catch (err) {
            if (this._cancelled || perJobController.signal.aborted) {
                job.error = '[CANCELLED]';
                job.status = 'error';
            } else {
                job.error = `[ERROR] ${err.message || err}`;
                job.status = 'error';
            }
        } finally {
            clearTimeout(timer);
            this._abortController?.signal.removeEventListener('abort', onBatchAbort);
            this._emitUpdate(job);
        }
    }

    /**
     * Build the final prompt, apply instruct template if enabled, then fetch.
     *
     * Uses `getTextGenGenerationData` which reads the current sampler preset
     * and stop strings (including instruct template stop sequences).
     * The only things NOT included: character card, world info, chat history.
     *
     * @param {string} prompt - Raw user prompt
     * @param {number} maxTokens
     * @param {AbortSignal} signal
     * @returns {Promise<string>}
     */
    async _callBackend(prompt, maxTokens, signal) {
        // 1. Optionally wrap in current instruct template
        const finalPrompt = power_user.instruct?.enabled
            ? this._wrapInInstruct(prompt)
            : prompt;

        // 2. Build generation body: sampler preset + stop strings from current settings
        //    isImpersonate=false, isContinue=false, cfgValues=null, type=null
        const genData = await getTextGenGenerationData(finalPrompt, maxTokens, false, false, null, null);

        // 3. Force non-streaming for batch
        genData.stream = false;

        const response = await fetch('/api/backends/text-completions/generate', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(genData),
            signal,
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => 'Unknown error');
            throw new Error(`HTTP ${response.status}: ${errText}`);
        }

        const data = await response.json();

        // Standard OpenAI completions format (TabbyAPI, vLLM, etc.)
        if (data?.choices?.[0]?.text !== undefined) {
            return data.choices[0].text;
        }
        // Ollama format
        if (data?.response !== undefined) {
            return data.response;
        }
        // KoboldCPP format
        if (data?.results?.[0]?.text !== undefined) {
            return data.results[0].text;
        }

        throw new Error('Unexpected response format');
    }

    /**
     * Wrap a prompt in the current instruct template (user turn + output prompt).
     * Equivalent to a single-turn exchange with no prior context.
     * @param {string} prompt
     * @returns {string}
     */
    _wrapInInstruct(prompt) {
        const userTurn = formatInstructModeChat(
            name1,               // speaker name
            prompt,              // message text
            true,                // isUser
            false,               // isNarrator
            false,               // forceAvatar
            name1,               // name1
            name2,               // name2
            force_output_sequence.LAST,  // treat as the last user turn
        );

        const outputPrompt = formatInstructModePrompt(
            name2,    // AI name
            false,    // isImpersonate
            '',       // promptBias
            name1,    // name1
            name2,    // name2
            false,    // isQuiet
            false,    // isQuietToLoud
        );

        return userTurn + outputPrompt;
    }

    /**
     * @param {import('./BatchJob.js').BatchJob} job
     */
    _emitUpdate(job) {
        if (typeof this.onJobUpdate === 'function') {
            this.onJobUpdate(job);
        }
    }
}
