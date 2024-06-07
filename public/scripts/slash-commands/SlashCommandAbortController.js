export class SlashCommandAbortController {
    /**@type {SlashCommandAbortSignal}*/ signal;


    constructor() {
        this.signal = new SlashCommandAbortSignal();
    }
    abort(reason = 'No reason.', isQuiet = false) {
        this.signal.isQuiet = isQuiet;
        this.signal.aborted = true;
        this.signal.reason = reason;
    }
    pause(reason = 'No reason.') {
        this.signal.paused = true;
        this.signal.reason = reason;
    }
    continue(reason = 'No reason.') {
        this.signal.paused = false;
        this.signal.reason = reason;
    }
}

export class SlashCommandAbortSignal {
    /**@type {boolean}*/ isQuiet = false;
    /**@type {boolean}*/ paused = false;
    /**@type {boolean}*/ aborted = false;
    /**@type {string}*/ reason = null;
}
