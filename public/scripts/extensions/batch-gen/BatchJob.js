/**
 * Represents a single job in a batch generation run.
 */
export class BatchJob {
    /**
     * @param {number} index - Position in the batch array
     * @param {string} prompt - Raw prompt text (no template wrapping)
     */
    constructor(index, prompt) {
        /** @type {number} */
        this.index = index;
        /** @type {string} */
        this.prompt = prompt;
        /** @type {'pending'|'running'|'done'|'error'} */
        this.status = 'pending';
        /** @type {string|null} */
        this.result = null;
        /** @type {string|null} */
        this.error = null;
    }

    /**
     * Build a BatchJob array from a JSON string array.
     * @param {string[]} prompts
     * @returns {BatchJob[]}
     */
    static fromArray(prompts) {
        return prompts.map((p, i) => new BatchJob(i, String(p)));
    }
}
