import { AbstractEventTarget } from './AbstractEventTarget.js';

export class SlashCommandAbortController extends AbstractEventTarget {
    /**@type {SlashCommandAbortSignal}*/ signal;


    constructor() {
        super();
        this.signal = new SlashCommandAbortSignal();
    }
    abort(reason = 'No reason.', isQuiet = false) {
        this.signal.isQuiet = isQuiet;
        this.signal.aborted = true;
        this.signal.reason = reason;
        this.dispatchEvent(new Event('abort'));
    }
    pause(reason = 'No reason.') {
        this.signal.paused = true;
        this.signal.reason = reason;
        this.dispatchEvent(new Event('pause'));
    }
    continue(reason = 'No reason.') {
        this.signal.paused = false;
        this.signal.reason = reason;
        this.dispatchEvent(new Event('continue'));
    }
}

export class SlashCommandAbortSignal {
    /**@type {boolean}*/ isQuiet = false;
    /**@type {boolean}*/ paused = false;
    /**@type {boolean}*/ aborted = false;
    /**@type {string}*/ reason = null;
}
