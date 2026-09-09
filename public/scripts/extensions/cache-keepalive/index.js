import { CacheKeeper, DEFAULT_INTERVAL, validateInterval, consumeRefreshResponse } from './keeper.js';
import { VERSION, translator, statusText, countdownText, cacheText, updateInstalledExtension } from './ui.js';

const OWNER = Symbol.for('SillyTavern.cacheKeepalive');
const ENDPOINT = '/api/backends/chat-completions/generate';
const SETTING = 'cache_keepalive';
let cleanup;

// Streaming initializes absent reasoning fields to an empty string.
function serializeContext(value) {
    return JSON.stringify(value, (key, entry) => key === 'reasoning' && entry === '' ? undefined : entry);
}

/** Include the whole chat and prompt settings, not just the most recent message. */
export function contextFingerprint(ctx) {
    const activeCharacter = ctx.characters[ctx.characterId];
    const character = activeCharacter ? { ...activeCharacter } : activeCharacter;
    // saveChat updates this sorting timestamp; it is not part of the prompt.
    if (character) delete character.date_last_chat;
    return serializeContext({
        chatId: ctx.chatId,
        characterId: ctx.characterId,
        groupId: ctx.groupId,
        chat: ctx.chat,
        metadata: ctx.chatMetadata,
        character,
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
    let historyLength = 0;
    let historyLimit = 0;
    let protectedHistory = '';
    const identity = () => JSON.stringify([SillyTavern.getContext().groupId, SillyTavern.getContext().characterId, SillyTavern.getContext().chatId]);
    // Only the active output slot may grow while the original request runs.
    // Swipe/continue write into the last existing slot; normal replies append.
    const inputContext = current => ({ ...current, chat: current.chat.slice(0, historyLength) });
    const fingerprint = current => contextFingerprint(candidateChat === null ? current : inputContext(current));

    const panel = document.createElement('div');
    panel.id = 'cache_keepalive_settings';
    panel.className = 'extension_container';
    panel.innerHTML = `<div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
            <b data-label="title"></b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="marginTop5 marginBot5">
            <div role="status" aria-live="polite" data-status></div>
            <div data-countdown></div>
            <div data-snapshot></div>
            <div data-cache></div>
            <div data-last-success></div>
            <div data-version></div>
            <div class="flex-container">
                <button class="menu_button menu_button_icon" type="button" data-update data-label="update"></button>
                <button class="menu_button menu_button_icon" type="button" data-reload data-label="reload"></button>
            </div>
            <div role="status" data-update-status></div>
        </div>
        <div class="inline-drawer-content">
            <label class="checkbox_label"><input type="checkbox" data-enabled><span data-label="enable"></span></label>
            <label><span data-label="interval"></span>
                <input class="text_pole" type="number" min="0.1" max="1440" step="0.1" data-interval>
            </label>
            <small data-label="hint"></small>
            <p><small data-label="cacheHint"></small></p>
            <button class="menu_button menu_button_icon" type="button" data-resume data-label="resume"></button>
        </div>
    </div>`;
    document.querySelector('#extensions_settings').append(panel);
    const enabledInput = panel.querySelector('[data-enabled]');
    const intervalInput = panel.querySelector('[data-interval]');
    const status = panel.querySelector('[data-status]');
    let locale;
    let t;
    const render = state => {
        const nextLocale = SillyTavern.getContext().getCurrentLocale?.() || document.documentElement.lang || navigator.language || 'en';
        if (locale !== nextLocale) {
            locale = nextLocale;
            t = translator(locale);
            for (const element of panel.querySelectorAll('[data-label]')) element.textContent = t(element.dataset.label);
            panel.querySelector('[data-version]').textContent = `${t('version')}: ${VERSION}`;
        }
        status.textContent = `${statusText(state, t)} (${state.count}/6)`;
        const unavailable = SillyTavern.getContext().onlineStatus === 'no_connection';
        panel.querySelector('[data-countdown]').textContent = `${t('countdown')}: ${countdownText(state, t, Date.now(), unavailable)}`;
        panel.querySelector('[data-snapshot]').textContent = `${t('snapshot')}: ${state.request ? t('captured', { count: state.request.messages.length }) : t('noSnapshot')}`;
        panel.querySelector('[data-cache]').textContent = `${t('cache')}: ${cacheText(state.cacheUsage, t)}`;
        const time = state.lastSuccessAt === null ? t('never') : new Date(state.lastSuccessAt).toLocaleTimeString(locale);
        panel.querySelector('[data-last-success]').textContent = `${t('lastSuccess')}: ${time}`;
    };

    const keeper = new CacheKeeper({
        changed: render,
        send: async (body, signal) => {
            const response = await originalFetch.call(globalThis, ENDPOINT, {
                method: 'POST',
                headers: SillyTavern.getContext().getRequestHeaders(),
                body: JSON.stringify(body),
                signal,
            });
            return consumeRefreshResponse(response);
        },
    });
    const on = (event, handler) => {
        if (!event) return;
        source.on(event, handler);
        listeners.push([event, handler]);
    };
    const invalidate = () => { candidateChat = null; finished = false; received = false; keeper.invalidate(); };
    const capture = (body, type = generationType) => {
        if (!active || !busy) return;
        const current = SillyTavern.getContext();
        if (!current.chatId || current.mainApi !== 'openai') return;
        try {
            const request = JSON.parse(body);
            // Auxiliary requests may run during a normal generation without
            // emitting GENERATION_STARTED. Trust the serialized request type.
            const requestType = request.type || type;
            if (!['normal', 'regenerate', 'swipe', 'continue'].includes(requestType)) return;
            const replacesLast = ['swipe', 'continue'].includes(requestType);
            historyLength = Math.max(0, current.chat.length - (replacesLast ? 1 : 0));
            historyLimit = current.chat.length + (replacesLast ? 0 : 1);
            protectedHistory = serializeContext(current.chat.slice(0, historyLength));
            keeper.capture(request, contextFingerprint(inputContext(current)));
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
        'MESSAGE_REASONING_EDITED', 'MESSAGE_REASONING_DELETED']) {
        on(events[key], invalidate);
    }
    on(events.MESSAGE_SENT, () => { if (!busy || keeper.request) invalidate(); });

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
            intervalInput.setCustomValidity(t('invalid'));
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
    panel.querySelector('[data-resume]').addEventListener('click', () => keeper.resume(fingerprint(SillyTavern.getContext())));
    panel.querySelector('[data-reload]').addEventListener('click', () => location.reload());
    panel.querySelector('[data-update]').addEventListener('click', async event => {
        const button = event.currentTarget;
        const updateStatus = panel.querySelector('[data-update-status]');
        button.disabled = true;
        updateStatus.textContent = t('updating');
        try {
            const result = await updateInstalledExtension(import.meta.url, originalFetch.bind(globalThis), ctx.getRequestHeaders());
            updateStatus.textContent = t(result);
        } catch (error) {
            console.error('Cache keepalive update failed:', error);
            updateStatus.textContent = t('updateFailed');
        } finally {
            button.disabled = false;
        }
    });
    const timer = setInterval(() => {
        render(keeper);
        if (!keeper.enabled || !keeper.request) return;
        const current = SillyTavern.getContext();
        if (candidateChat !== null && (candidateChat !== identity() || current.chat.length > historyLimit
            || serializeContext(current.chat.slice(0, historyLength)) !== protectedHistory)) {
            invalidate();
            return;
        }
        if (finished) {
            if (received && candidateChat === identity()) keeper.settle(contextFingerprint(current));
            else keeper.invalidate('No completed reply; waiting for a normal chat request');
            candidateChat = null;
            finished = false;
        }
        void keeper.tick(fingerprint(current), current.onlineStatus === 'no_connection');
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
