import { eventSource, event_types } from '../../../script.js';
import { renderExtensionTemplateAsync } from '../../extensions.js';
import { POPUP_TYPE, callGenericPopup } from '../../popup.js';
import { t } from '../../i18n.js';

const MODULE = 'prompt-viewer';

/**
 * Endpoints whose POST bodies we want to capture. These are the SillyTavern
 * backend routes that proxy to upstream model APIs. The captured body is what
 * the browser sent — the server may still mutate it (prompt post-processing,
 * Claude / Gemini format conversion, name-prefix injection) before forwarding.
 */
const CAPTURE_ENDPOINTS = [
    '/api/backends/chat-completions/generate',
    '/api/backends/text-completions/generate',
    '/api/backends/kobold/generate',
    '/api/backends/scale-alt/generate',
    '/api/novelai/generate',
    '/generate',
];

/** @type {{ url: string, body: any, time: Date, mode: 'chat'|'text'|'unknown' } | null} */
let lastCapture = null;

function detectMode(url, body) {
    if (url.includes('chat-completions')) return 'chat';
    if (url.includes('text-completions') || url.includes('kobold') || url.includes('novelai')) return 'text';
    if (body && Array.isArray(body.messages)) return 'chat';
    if (body && typeof body.prompt === 'string') return 'text';
    return 'unknown';
}

function patchFetch() {
    if (window.__promptViewerFetchPatched) return;
    window.__promptViewerFetchPatched = true;

    const originalFetch = window.fetch;
    window.fetch = async function (input, init) {
        try {
            const url = typeof input === 'string' ? input : (input?.url ?? '');
            const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();

            if (method === 'POST' && CAPTURE_ENDPOINTS.some(ep => url.endsWith(ep))) {
                let body = init?.body;
                if (typeof body === 'string') {
                    try {
                        const parsed = JSON.parse(body);
                        lastCapture = {
                            url,
                            body: parsed,
                            time: new Date(),
                            mode: detectMode(url, parsed),
                        };
                    } catch {
                        lastCapture = { url, body, time: new Date(), mode: detectMode(url, null) };
                    }
                }
            }
        } catch (err) {
            console.warn(`[${MODULE}] capture failed:`, err);
        }
        return originalFetch.apply(this, arguments);
    };
}

function escapeHtml(s) {
    return String(s)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll('\'', '&#39;');
}

/**
 * Renders message content. Chat-completion messages may have content as a
 * string or an array of parts ({type:'text'|'image_url'|...}).
 */
function renderMessageContent(content) {
    if (typeof content === 'string') return escapeHtml(content);
    if (Array.isArray(content)) {
        return content.map(part => {
            if (!part || typeof part !== 'object') return escapeHtml(String(part));
            if (part.type === 'text' || typeof part.text === 'string') return escapeHtml(part.text ?? '');
            if (part.type === 'image_url' || part.image_url) {
                const url = part.image_url?.url ?? part.image_url ?? '';
                const preview = typeof url === 'string' && url.length > 100 ? url.slice(0, 80) + '… [' + url.length + ' chars]' : url;
                return `<i>[image] ${escapeHtml(preview)}</i>`;
            }
            return `<i>[${escapeHtml(part.type ?? 'part')}]</i> ${escapeHtml(JSON.stringify(part))}`;
        }).join('\n');
    }
    if (content == null) return '<i>(no content)</i>';
    return escapeHtml(JSON.stringify(content));
}

/**
 * Builds a list of transforms the SillyTavern server will apply to this body
 * before forwarding to the upstream model. Used so the user understands the
 * delta between what's POSTed from the browser and what hits the model API.
 */
function describeServerTransforms(body) {
    if (!body || typeof body !== 'object') return [];
    const transforms = [];
    const source = body.chat_completion_source;

    if (body.custom_prompt_post_processing) {
        const map = {
            'none': null,
            'strict': { title: 'Strict role merging', desc: 'Server enforces strict user/assistant role alternation, merging consecutive messages of the same role.' },
            'semi': { title: 'Semi role merging', desc: 'Server merges consecutive same-role messages and may collapse certain system messages.' },
            'merge': { title: 'Aggressive role merging', desc: 'Server merges consecutive same-role messages without preserving names.' },
            'strict-tools': { title: 'Strict role merging (tools)', desc: 'Strict merging, but preserves tool_calls / tool messages.' },
            'semi-tools': { title: 'Semi role merging (tools)', desc: 'Semi merging, preserves tool_calls / tool messages.' },
            'merge-tools': { title: 'Aggressive role merging (tools)', desc: 'Merge processing, preserves tool_calls / tool messages.' },
            'single': { title: 'Single user message', desc: 'Squashes the entire conversation into a single user message.' },
        };
        const entry = map[body.custom_prompt_post_processing];
        if (entry) {
            transforms.push({ active: true, ...entry, hint: `custom_prompt_post_processing = "${body.custom_prompt_post_processing}"` });
        }
    }

    if (source === 'claude' || source === 'anthropic') {
        transforms.push({
            active: true,
            title: 'Claude format conversion',
            desc: 'Server splits "system" messages from the messages array into a top-level `system` field, and may add an assistant prefill.',
            hint: 'chat_completion_source = "claude"',
        });
    }

    if (source === 'makersuite' || source === 'vertexai') {
        transforms.push({
            active: true,
            title: 'Google (Gemini) format conversion',
            desc: 'Server converts the OpenAI-style messages into Google contents/parts format with role mapping (assistant → model).',
            hint: `chat_completion_source = "${source}"`,
        });
    }

    if (source === 'cohere') {
        transforms.push({
            active: true,
            title: 'Cohere format conversion',
            desc: 'Server converts to Cohere chat_history + message + preamble structure.',
            hint: 'chat_completion_source = "cohere"',
        });
    }

    if (source === 'openrouter') {
        transforms.push({
            active: true,
            title: 'OpenRouter routing params',
            desc: 'Server attaches provider/transforms/plugins and may add cache markers for Claude/Gemini models.',
            hint: 'chat_completion_source = "openrouter"',
        });
    }

    // Assistant prefix flag — added when there are no tools defined.
    if (Array.isArray(body.messages) && !body.tools) {
        transforms.push({
            active: true,
            title: 'Assistant name-prefix flag',
            desc: 'Server adds { name: true } to trailing assistant messages so the upstream API renders the bot name before the response (only when no tools are present).',
            hint: 'addAssistantPrefix() in src/prompt-converters.js',
        });
    }

    if (body.stream === false) {
        transforms.push({
            active: false,
            title: 'Streaming disabled',
            desc: 'Response will be returned as a single JSON payload rather than SSE.',
            hint: 'stream = false',
        });
    }

    return transforms;
}

function renderMeta($container, capture) {
    const body = capture.body ?? {};
    const rows = [];
    rows.push(['Captured at', capture.time.toLocaleString()]);
    rows.push(['Endpoint', capture.url]);
    rows.push(['Mode', capture.mode]);
    if (capture.mode === 'chat') {
        rows.push(['Source', body.chat_completion_source ?? '(unset)']);
        rows.push(['Model', body.model ?? '(unset)']);
        rows.push(['Messages', Array.isArray(body.messages) ? String(body.messages.length) : '—']);
        rows.push(['Stream', String(Boolean(body.stream))]);
        rows.push(['Max tokens', body.max_tokens ?? '—']);
        rows.push(['Temperature', body.temperature ?? '—']);
    } else if (capture.mode === 'text') {
        const promptLen = typeof body.prompt === 'string' ? body.prompt.length : (typeof body.input === 'string' ? body.input.length : 0);
        rows.push(['Model', body.model ?? '(unset)']);
        rows.push(['Prompt length', `${promptLen} chars`]);
        rows.push(['Max tokens', body.max_new_tokens ?? body.max_tokens ?? '—']);
    }

    const html = rows.map(([k, v]) =>
        `<div class="pv_kv"><div class="pv_key">${escapeHtml(k)}</div><div class="pv_val">${escapeHtml(String(v))}</div></div>`,
    ).join('');
    $container.html(html);
}

function renderTransforms($container, capture) {
    const transforms = capture.mode === 'chat' ? describeServerTransforms(capture.body) : [];
    if (transforms.length === 0) {
        $container.html(`<div class="pv_transform pv_inactive"><div class="pv_transform_desc">${escapeHtml(t`No server-side transforms detected based on the captured request fields.`)}</div></div>`);
        return;
    }
    $container.html(transforms.map(tx => `
        <div class="pv_transform ${tx.active ? 'pv_active' : 'pv_inactive'}">
            <div class="pv_transform_title">${escapeHtml(tx.title)}</div>
            <div class="pv_transform_desc">${escapeHtml(tx.desc)}</div>
            ${tx.hint ? `<div class="pv_transform_desc"><code>${escapeHtml(tx.hint)}</code></div>` : ''}
        </div>
    `).join(''));
}

function renderMessages($container, capture) {
    const body = capture.body ?? {};
    if (capture.mode === 'chat' && Array.isArray(body.messages)) {
        $container.html(body.messages.map((m, i) => {
            const role = m?.role ?? 'unknown';
            const name = m?.name ? ` · ${escapeHtml(m.name)}` : '';
            const tool = m?.tool_call_id ? ` · tool_call_id=${escapeHtml(m.tool_call_id)}` : '';
            return `
                <div class="pv_msg">
                    <div class="pv_msg_head">
                        <div><span class="pv_msg_role role_${escapeHtml(role)}">${escapeHtml(role)}</span>${name}${tool}</div>
                        <div>#${i}</div>
                    </div>
                    <div class="pv_msg_body">${renderMessageContent(m?.content)}</div>
                </div>
            `;
        }).join(''));
        return;
    }
    if (capture.mode === 'text') {
        const prompt = body.prompt ?? body.input ?? '';
        $container.html(`<div class="pv_msg"><div class="pv_msg_body">${escapeHtml(String(prompt))}</div></div>`);
        return;
    }
    $container.html(`<i>${escapeHtml(t`Unrecognised request shape.`)}</i>`);
}

function renderRaw($container, capture) {
    const text = typeof capture.body === 'string'
        ? capture.body
        : JSON.stringify(capture.body, null, 2);
    $container.find('code').text(text);
}

async function openPromptViewer() {
    const html = await renderExtensionTemplateAsync('prompt-viewer', 'window');
    const $dialog = $(html);

    const $empty = $dialog.find('#prompt_viewer_empty');
    const $content = $dialog.find('#prompt_viewer_content');
    const $meta = $dialog.find('.prompt_viewer_meta');
    const $transforms = $dialog.find('.prompt_viewer_transforms');
    const $messages = $dialog.find('.prompt_viewer_messages');
    const $raw = $dialog.find('.prompt_viewer_raw');

    const refresh = () => {
        if (!lastCapture) {
            $empty.show();
            $content.hide();
            return;
        }
        $empty.hide();
        $content.show();
        renderMeta($meta, lastCapture);
        renderTransforms($transforms, lastCapture);
        renderMessages($messages, lastCapture);
        renderRaw($raw, lastCapture);
    };

    $dialog.find('#prompt_viewer_refresh').on('click', refresh);
    $dialog.find('#prompt_viewer_copy').on('click', async () => {
        if (!lastCapture) return;
        const text = typeof lastCapture.body === 'string'
            ? lastCapture.body
            : JSON.stringify(lastCapture.body, null, 2);
        try {
            await navigator.clipboard.writeText(text);
            toastr.success(t`Copied request body to clipboard.`);
        } catch (err) {
            console.warn(`[${MODULE}] clipboard write failed`, err);
            toastr.error(t`Could not copy to clipboard.`);
        }
    });

    refresh();
    callGenericPopup($dialog, POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true });
}

function attachEventFallbacks() {
    // Fallback for dry-runs / cases where fetch isn't invoked: capture the
    // body straight from the event payload. The fetch patch wins when both fire.
    eventSource.on(event_types.CHAT_COMPLETION_SETTINGS_READY, (generate_data) => {
        if (!generate_data) return;
        lastCapture = {
            url: '/api/backends/chat-completions/generate',
            body: structuredClone(generate_data),
            time: new Date(),
            mode: 'chat',
        };
    });

    eventSource.on(event_types.GENERATE_AFTER_COMBINE_PROMPTS, (eventData) => {
        if (!eventData) return;
        const prompt = typeof eventData === 'string' ? eventData : (eventData.prompt ?? eventData.input ?? '');
        if (!prompt) return;
        lastCapture = {
            url: '(text-completion: from GENERATE_AFTER_COMBINE_PROMPTS event)',
            body: { prompt, dryRun: Boolean(eventData.dryRun) },
            time: new Date(),
            mode: 'text',
        };
    });
}

export function init() {
    patchFetch();
    attachEventFallbacks();

    const buttonHtml = `
        <div id="prompt_viewer_button" class="list-group-item flex-container flexGap5" title="${t`View the full prompt SillyTavern will send`}">
            <div class="fa-solid fa-magnifying-glass extensionsMenuExtensionButton"></div>
            <span>${t`Prompt Viewer`}</span>
        </div>`;
    $('#prompt_viewer_wand_container').append(buttonHtml);
    $('#prompt_viewer_button').on('click', openPromptViewer);
}
