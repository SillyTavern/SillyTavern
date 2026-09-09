export const REFRESH_MESSAGE = '这只是刷新缓存，收到后回复确认即可。';
export const DEFAULT_INTERVAL = 4;

export function validateInterval(value) {
    const minutes = Number(value);
    if (!Number.isFinite(minutes) || minutes < 0.1 || minutes > 1440) {
        throw new Error('Interval must be between 0.1 and 1440 minutes.');
    }
    return minutes;
}

/** Build a disposable request without rebuilding or mutating the cached prefix. */
export function buildRefreshRequest(request) {
    if (!Array.isArray(request.messages) || !request.messages.length) {
        throw new Error('A Chat Completion request with messages is required.');
    }
    const copy = structuredClone(request);
    copy.messages.push({ role: 'user', content: REFRESH_MESSAGE });
    // Keep tools, tool choice, output budget and thinking settings unchanged.
    // Tool calls in the response are discarded, never executed.
    copy.n = 1;
    return copy;
}

/** Drain replies without invoking chat rendering, message saving or tools. */
export async function consumeRefreshResponse(response) {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const check = data => {
        if (!data || data.error || data.type === 'error') throw new Error('API returned an error; check the server log');
    };
    if (!response.headers.get('content-type')?.includes('text/event-stream')) {
        check(await response.json());
        return;
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let completed = false;
    const parseEvent = event => {
        const data = event.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
        if (!data) return;
        if (data === '[DONE]') {
            completed = true;
            return;
        }
        const parsed = JSON.parse(data);
        check(parsed);
        completed ||= parsed.type === 'message_stop' || parsed.type === 'message-end'
            || parsed.choices?.some(choice => choice.finish_reason != null)
            || parsed.candidates?.some(candidate => candidate.finishReason != null);
    };
    try {
        while (true) {
            const { done, value } = await reader.read();
            buffer += decoder.decode(value, { stream: !done }).replace(/\r/g, '');
            let boundary;
            while ((boundary = buffer.indexOf('\n\n')) !== -1) {
                parseEvent(buffer.slice(0, boundary));
                buffer = buffer.slice(boundary + 2);
            }
            if (done) {
                if (buffer.trim()) parseEvent(buffer);
                break;
            }
        }
        if (!completed) throw new Error('Incomplete streaming response');
    } finally {
        await reader.cancel();
        reader.releaseLock();
    }
}

/** In-memory state only: request bodies must never be persisted in settings. */
export class CacheKeeper {
    constructor({ send, changed = () => {}, now = Date.now }) {
        this.send = send;
        this.changed = changed;
        this.now = now;
        this.enabled = false;
        this.interval = DEFAULT_INTERVAL;
        this.request = null;
        this.context = null;
        this.count = 0;
        this.nextAt = 0;
        this.controller = null;
        this.epoch = 0;
        this.status = 'Disabled';
    }

    report(status) {
        this.status = status;
        this.changed(this);
    }

    configure(enabled, interval) {
        this.interval = validateInterval(interval);
        this.enabled = Boolean(enabled);
        this.invalidate(this.enabled ? 'Waiting for a normal chat request' : 'Disabled');
    }

    invalidate(status = 'Context changed; waiting for a normal chat request') {
        this.epoch++;
        this.controller?.abort();
        this.request = null;
        this.context = null;
        this.count = 0;
        this.nextAt = 0;
        this.report(this.enabled ? status : 'Disabled');
    }

    capture(request) {
        if (!this.enabled) return;
        // Validate now, before accepting a snapshot of a real request.
        buildRefreshRequest(request);
        this.invalidate('Waiting for generation to finish');
        // Generation time consumes the cache lifetime too.
        this.nextAt = this.now() + this.interval * 60000;
        this.request = structuredClone(request);
    }

    settle(context) {
        if (!this.enabled || !this.request) return;
        this.context = context;
        this.report('Waiting for next refresh');
    }

    resume(context) {
        if (!this.request || this.context !== context) {
            this.invalidate();
            return;
        }
        this.count = 0;
        this.nextAt = this.now() + this.interval * 60000;
        this.settle(context);
    }

    async tick(context, busy = false) {
        if (!this.enabled || !this.request || this.context === null) return;
        if (context !== this.context) {
            this.invalidate();
            return;
        }
        if (busy || this.controller || this.count >= 6 || !this.nextAt || this.now() < this.nextAt) return;
        const epoch = this.epoch;
        const controller = new AbortController();
        this.controller = controller;
        const timeout = setTimeout(() => controller.abort(), 60000);
        this.report('Refreshing in background');
        try {
            const startedAt = this.now();
            await this.send(buildRefreshRequest(this.request), controller.signal);
            if (epoch !== this.epoch) return;
            this.count++;
            this.nextAt = this.count < 6 ? startedAt + this.interval * 60000 : 0;
            this.report(this.count === 6 ? 'Paused: context unchanged for 6 refreshes' : 'Refresh completed');
        } catch (error) {
            if (epoch !== this.epoch) return;
            this.nextAt = 0;
            this.report(controller.signal.aborted ? 'Paused: request timed out' : `Paused: ${error.message}`);
        } finally {
            clearTimeout(timeout);
            if (this.controller === controller) this.controller = null;
        }
    }
}
