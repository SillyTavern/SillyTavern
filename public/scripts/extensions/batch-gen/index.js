import { SlashCommand } from '../../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from '../../slash-commands/SlashCommandArgument.js';
import { SlashCommandParser } from '../../slash-commands/SlashCommandParser.js';
import { resolveVariable } from '../../variables.js';
import { setLocalVariable } from '../../variables.js';
import { BatchJob } from './BatchJob.js';
import { BatchRunner } from './BatchRunner.js';

const PANEL_HTML = `
<div id="batch-gen-panel">
    <div class="batch-header">
        <span class="batch-title">Batch Generation</span>
        <span class="batch-cancel-btn" title="Cancel">\u2716</span>
    </div>
    <div class="batch-progress"><div class="batch-progress-bar"></div></div>
    <div class="batch-status-text"></div>
    <div class="batch-job-list"></div>
</div>`;

let currentRunner = null;

/**
 * Show the floating progress panel.
 * @param {BatchJob[]} jobs
 * @returns {{ updateJob: (job: BatchJob) => void, close: () => void }}
 */
function showPanel(jobs) {
    let panel = document.getElementById('batch-gen-panel');
    if (!panel) {
        const container = document.createElement('div');
        container.innerHTML = PANEL_HTML;
        document.body.appendChild(container.firstElementChild);
        panel = document.getElementById('batch-gen-panel');
    }

    panel.classList.add('active');

    const jobList = panel.querySelector('.batch-job-list');
    const progressBar = panel.querySelector('.batch-progress-bar');
    const statusText = panel.querySelector('.batch-status-text');
    const cancelBtn = panel.querySelector('.batch-cancel-btn');

    // Build job rows
    jobList.innerHTML = '';
    const rows = [];
    for (const job of jobs) {
        const row = document.createElement('div');
        row.className = `batch-job ${job.status}`;
        row.dataset.index = String(job.index);
        row.innerHTML = `<span class="status-icon"></span><span class="prompt-text" title="${escapeHtml(job.prompt)}">${escapeHtml(truncate(job.prompt, 60))}</span>`;
        jobList.appendChild(row);
        rows.push(row);
    }

    const total = jobs.length;
    let completed = 0;
    statusText.textContent = `0 / ${total}`;

    cancelBtn.onclick = () => {
        if (currentRunner) {
            currentRunner.cancel();
        }
    };

    return {
        updateJob(job) {
            const row = rows[job.index];
            if (!row) return;
            row.className = `batch-job ${job.status}`;
            if (job.status === 'done' || job.status === 'error') {
                completed++;
                const pct = Math.round((completed / total) * 100);
                progressBar.style.width = `${pct}%`;
                statusText.textContent = `${completed} / ${total}`;
            }
        },
        close() {
            setTimeout(() => {
                panel.classList.remove('active');
            }, 2000);
        },
    };
}

/**
 * @param {string} str
 * @param {number} len
 */
function truncate(str, len) {
    return str.length > len ? str.slice(0, len) + '\u2026' : str;
}

/**
 * @param {string} str
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Main /batch command handler.
 * @param {object} args - Named arguments
 * @param {string} _value - Unnamed argument (unused)
 */
async function batchCommandCallback(args, _value) {
    // 1. Resolve input: a variable name containing a JSON array string
    const inputName = args.input;
    if (!inputName) {
        throw new Error('/batch: "input" argument is required (variable name holding a JSON array)');
    }

    const rawJson = resolveVariable(inputName);
    if (!rawJson) {
        throw new Error(`/batch: variable "${inputName}" not found or empty`);
    }

    let prompts;
    try {
        prompts = JSON.parse(String(rawJson));
    } catch {
        throw new Error(`/batch: variable "${inputName}" is not valid JSON`);
    }

    if (!Array.isArray(prompts) || prompts.length === 0) {
        throw new Error('/batch: input must be a non-empty JSON array of strings');
    }

    // 2. Parse options
    const concurrency = parseInt(args.concurrency) || BatchRunner.getDefaultConcurrency();
    const maxTokens = parseInt(args.maxtokens) || 300;
    const timeoutMs = parseInt(args.timeout) || 120000;
    const outputKey = args.output || 'batch_results';

    // 3. Build jobs
    const jobs = BatchJob.fromArray(prompts);

    // 4. Show panel
    const panel = showPanel(jobs);

    // 5. Run
    const runner = new BatchRunner();
    currentRunner = runner;
    runner.onJobUpdate = (job) => panel.updateJob(job);

    let results;
    try {
        results = await runner.run(jobs, { concurrency, maxTokens, timeoutMs });
    } finally {
        currentRunner = null;
        panel.close();
    }

    // 6. Store results as JSON array in a local variable
    const resultsJson = JSON.stringify(results);
    setLocalVariable(outputKey, resultsJson);

    return resultsJson;
}

jQuery(async () => {
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'batch',
        callback: batchCommandCallback,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'input',
                description: 'Variable name holding a JSON array of prompt strings',
                typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
                isRequired: true,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'output',
                description: 'Variable name to store results array (default: batch_results)',
                typeList: [ARGUMENT_TYPE.VARIABLE_NAME],
                isRequired: false,
                defaultValue: 'batch_results',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'concurrency',
                description: 'Max parallel requests (default: auto by backend, TabbyAPI=8)',
                typeList: [ARGUMENT_TYPE.NUMBER],
                isRequired: false,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'maxtokens',
                description: 'Max tokens per generation (default: 300)',
                typeList: [ARGUMENT_TYPE.NUMBER],
                isRequired: false,
                defaultValue: '300',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'timeout',
                description: 'Per-request timeout in ms (default: 120000)',
                typeList: [ARGUMENT_TYPE.NUMBER],
                isRequired: false,
                defaultValue: '120000',
            }),
        ],
        helpString: 'Run batch generation from a JSON array of prompts. Each prompt is sent raw to the backend (no templates, no system prompt). Results are stored as a JSON array of the same length.<br>' +
            'Example: <code>/batch input=my_prompts concurrency=8 maxtokens=200 output=my_results</code>',
        returns: ARGUMENT_TYPE.STRING,
    }));
});
