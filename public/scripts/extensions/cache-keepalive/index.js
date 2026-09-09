import { CacheKeeper, DEFAULT_INTERVAL, validateInterval, consumeRefreshResponse } from './keeper.js';

const OWNER = Symbol.for('SillyTavern.cacheKeepalive');
const ENDPOINT = '/api/backends/chat-completions/generate';
const SETTING = 'cache_keepalive';
let cleanup;

/** Include the whole chat and prompt settings, not just the most recent message. */
export function contextFingerprint(ctx) {
    return JSON.stringify({
        chatId: ctx.chatId,
        characterId: ctx.characterId,
        groupId: ctx.groupId,
        chat: ctx.chat,
        metadata: ctx.chatMetadata,
        character: ctx.characters[ctx.characterId],
        group: ctx.groups.find(group => group.id == ctx.groupId),
        names: [ctx.name1, ctx.name2],
        // Prompt assembly skips empty entries; extensions can recreate these
        // after generation without changing any input to the model.
        prompts: Object.fromEntries(Object.entries(ctx.extensionPrompts ?? {}).filter(([, prompt]) => prompt.value)),
        api: ctx.mainApi,
        completion: ctx.chatCompletionSettings,
        powerUser: ctx.powerUserSettings,
        extensions: Object.fromEntries(Object.entries(ctx.extensionSettings).filter(([key]) => key !== SETTING)),
    });
}

export function init() {
    if (cleanup || globalThis[OWNER]) return;
    globalThis[OWNER] = true;
    const ctx = SillyTavern.getContext();
    const settings = ctx.extensionSettings[SETTING] ??= { enabled: false, interval: DEFAULT_INTERVAL };
    const source = ctx.eventSource;
    const events = ctx.eventTypes;
    const listeners = [];
    const originalFetch = globalThis.fetch;
    let generationType = null;
    let busy = false;
    let active = true;
    let candidateChat = null;
    let finished = false;
    let received = false;
    const identity = () => JSON.stringify([SillyTavern.getContext().groupId, SillyTavern.getContext().characterId, SillyTavern.getContext().chatId]);

    const panel = document.createElement('div');
    panel.id = 'cache_keepalive_settings';
    panel.className = 'extension_container';
    panel.innerHTML = `<div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b>Automatic cache keepalive / 自动保持缓存在线</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <label class="checkbox_label"><input type="checkbox" data-enabled> Enable / 开启</label>
            <label>Interval in minutes / 间隔（分钟）
                <input class="text_pole" type="number" min="0.1" max="1440" step="0.1" data-interval>
            </label>
            <small>Uses the last real Chat Completion request. Send a normal message first.
                Replies are discarded. Pauses after 6 unchanged refreshes. API usage is billable.
                Keep this tab open; browser sleep can delay timers.</small>
            <div role="status" aria-live="polite" data-status></div>
            <button class="menu_button" type="button" data-resume>Resume / 恢复</button>
        </div>
    </div>`;
    document.querySelector('#extensions_settings').append(panel);
    const enabledInput = panel.querySelector('[data-enabled]');
    const intervalInput = panel.querySelector('[data-interval]');
    const status = panel.querySelector('[data-status]');

    const keeper = new CacheKeeper({
        changed: state => { status.textContent = `${state.status} (${state.count}/6)`; },
        send: async (body, signal) => {
            const response = await originalFetch.call(globalThis, ENDPOINT, {
                method: 'POST',
                headers: SillyTavern.getContext().getRequestHeaders(),
                body: JSON.stringify(body),
                signal,
            });
            await consumeRefreshResponse(response);
        },
    });
    const on = (event, handler) => {
        if (!event) return;
        source.on(event, handler);
        listeners.push([event, handler]);
    };
    const invalidate = () => { candidateChat = null; finished = false; received = false; keeper.invalidate(); };
    const capture = (body, type = generationType) => {
        if (!active || !busy || !['normal', 'regenerate', 'swipe', 'continue'].includes(type)) return;
        const current = SillyTavern.getContext();
        if (!current.chatId || current.mainApi !== 'openai') return;
        try {
            keeper.capture(JSON.parse(body));
            candidateChat = identity();
            received = false;
        } catch {
            keeper.invalidate('Unsupported request; waiting for a normal chat request');
        }
    };

    // Native builds expose the final serialized request. Stock builds use a
    // narrowly scoped fetch observer, after all prompt/settings event handlers.
    const observedFetch = function (input, options) {
        if (active && typeof input === 'string' && new URL(input, location.href).pathname === ENDPOINT
            && options?.method === 'POST' && typeof options.body === 'string') {
            capture(options.body);
        }
        return originalFetch.apply(this, arguments);
    };
    if (events.CHAT_COMPLETION_REQUEST_READY) {
        on(events.CHAT_COMPLETION_REQUEST_READY, ({ body, type }) => capture(body, type));
    } else {
        globalThis.fetch = observedFetch;
    }
    on(events.GENERATION_STARTED, (type, options, dryRun) => {
        if (dryRun) return;
        busy = true;
        generationType = type || 'normal';
        invalidate();
    });
    on(events.GENERATION_ENDED, () => {
        busy = false;
        generationType = null;
        // Streaming emits MESSAGE_RECEIVED after GENERATION_ENDED, and the
        // core still cleans up transient prompt injections after this event.
        finished = true;
    });
    on(events.GENERATION_STOPPED, () => { busy = false; invalidate(); });
    for (const key of ['CHAT_CHANGED', 'MAIN_API_CHANGED', 'CHATCOMPLETION_SOURCE_CHANGED',
        'CHATCOMPLETION_MODEL_CHANGED', 'OAI_PRESET_CHANGED_AFTER', 'WORLDINFO_SETTINGS_UPDATED',
        'WORLDINFO_UPDATED', 'CHARACTER_EDITED', 'PERSONA_CHANGED', 'CONNECTION_PROFILE_LOADED',
        'SECRET_ROTATED', 'SECRET_DELETED', 'SECRET_WRITTEN']) {
        on(events[key], invalidate);
    }
    on(events.MESSAGE_RECEIVED, () => {
        if (candidateChat === identity()) received = true;
        else if (!busy) invalidate();
    });
    for (const key of ['MESSAGE_EDITED', 'MESSAGE_DELETED', 'MESSAGE_SWIPED', 'MESSAGE_UPDATED',
        'MESSAGE_SENT', 'MESSAGE_REASONING_EDITED', 'MESSAGE_REASONING_DELETED']) {
        on(events[key], () => { if (!busy) invalidate(); });
    }

    try {
        settings.interval = validateInterval(settings.interval);
    } catch {
        settings.interval = DEFAULT_INTERVAL;
        settings.enabled = false;
    }
    enabledInput.checked = settings.enabled === true;
    intervalInput.value = String(settings.interval);
    keeper.configure(enabledInput.checked, settings.interval);
    const configure = () => {
        try {
            const interval = validateInterval(intervalInput.value);
            intervalInput.setCustomValidity('');
            settings.interval = interval;
            settings.enabled = enabledInput.checked;
            keeper.configure(settings.enabled, interval);
            ctx.saveSettingsDebounced();
        } catch (error) {
            intervalInput.setCustomValidity(error.message);
            intervalInput.reportValidity();
            if (!enabledInput.checked) {
                settings.enabled = false;
                keeper.configure(false, settings.interval);
                ctx.saveSettingsDebounced();
            }
        }
    };
    enabledInput.addEventListener('change', configure);
    intervalInput.addEventListener('change', configure);
    panel.querySelector('[data-resume]').addEventListener('click', () => keeper.resume(contextFingerprint(SillyTavern.getContext())));
    const timer = setInterval(() => {
        if (!keeper.enabled || !keeper.request || busy) return;
        const current = SillyTavern.getContext();
        if (finished) {
            if (received && candidateChat === identity()) keeper.settle(contextFingerprint(current));
            else keeper.invalidate('No completed reply; waiting for a normal chat request');
            candidateChat = null;
            finished = false;
        }
        void keeper.tick(contextFingerprint(current), current.onlineStatus === 'no_connection');
    }, 1000);
    cleanup = () => {
        active = false;
        clearInterval(timer);
        keeper.configure(false, settings.interval);
        for (const [event, handler] of listeners) source.removeListener(event, handler);
        if (globalThis.fetch === observedFetch) globalThis.fetch = originalFetch;
        panel.remove();
        delete globalThis[OWNER];
        cleanup = null;
    };
}

export function dispose() {
    cleanup?.();
}
