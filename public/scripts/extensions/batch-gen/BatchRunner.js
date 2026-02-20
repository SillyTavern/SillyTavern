import { getRequestHeaders } from '../../../script.js';
import { textgen_types, textgenerationwebui_settings, getTextGenServer } from '../../textgen-settings.js';

/**
 * Concurrency-controlled batch generation engine.
 * Sends raw prompts directly to the text-completions backend,
 * bypassing all prompt templates, instruct mode, and sampler presets.
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
     * Execute a single job: direct HTTP to backend, no templates.
     * @param {import('./BatchJob.js').BatchJob} job
     * @param {number} maxTokens
     * @param {number} timeoutMs
     */
    async _runJob(job, maxTokens, timeoutMs) {
        job.status = 'running';
        this._emitUpdate(job);

        const perJobController = new AbortController();
        const timer = setTimeout(() => perJobController.abort(), timeoutMs);

        // Also abort if the whole batch is cancelled
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
     * Direct fetch to /api/backends/text-completions/generate.
     * Sends ONLY raw prompt + minimal params — no instruct template,
     * no system prompt, no character card, no sampler preset.
     * @param {string} prompt
     * @param {number} maxTokens
     * @param {AbortSignal} signal
     * @returns {Promise<string>}
     */
    async _callBackend(prompt, maxTokens, signal) {
        const body = {
            prompt: prompt,
            max_tokens: maxTokens,
            max_new_tokens: maxTokens,
            stream: false,
            n: 1,
            temperature: 1,
            stop: [],
            stopping_strings: [],
            api_type: textgenerationwebui_settings.type,
            api_server: getTextGenServer(),
        };

        const response = await fetch('/api/backends/text-completions/generate', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(body),
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
     * @param {import('./BatchJob.js').BatchJob} job
     */
    _emitUpdate(job) {
        if (typeof this.onJobUpdate === 'function') {
            this.onJobUpdate(job);
        }
    }
}
