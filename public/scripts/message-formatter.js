import { messageFormatting } from '../script.js';

/**
 * Pipeline stages at which extension hooks may run.
 * All stages occur **before** DOMPurify sanitization so output is always safe.
 *
 * - `BEFORE_REGEX`   – Raw message text, after prompt-bias stripping but before
 *                      custom regex rules are applied. Suitable for transforms
 *                      that should be invisible to regex rules.
 * - `AFTER_REGEX`    – After custom regex rules, before Markdown conversion.
 *                      The text is still plain Markdown at this point.
 * - `AFTER_MARKDOWN` – After Markdown-to-HTML conversion (showdown), before
 *                      DOMPurify. The value is an HTML string. This is the
 *                      **default** stage and the most common insertion point
 *                      for extensions that want to annotate rendered HTML (e.g.
 *                      adding ruby tags, tooltips, highlights).
 *
 * > There is intentionally no post-sanitize stage.
 * > All hooks run before DOMPurify so their output is always sanitized along
 * > with the rest of the message. If your hook inserts HTML, make sure it is
 * > safe to pass through DOMPurify (i.e. avoid `<script>` tags and inline
 * > event handlers — they will be stripped anyway, but it is still bad
 * > practice to produce them).
 *
 * @enum {string}
 */
export const formatting_stage = {
    BEFORE_REGEX: 'beforeRegex',
    AFTER_REGEX: 'afterRegex',
    AFTER_MARKDOWN: 'afterMarkdown',
};

/**
 * @typedef {formatting_stage[keyof formatting_stage]} MessageFormattingStage
 */

/**
 * Message metadata supplied by {@link messageFormatting} to {@link MessageFormatter#runStage}.
 * Does not include `stage` — that is injected by `runStage` itself.
 *
 * @typedef {Object} MessageFormattingBase
 * @property {string} characterName - Character name associated with the message.
 * @property {boolean} isSystem - Whether the message is a system message.
 * @property {boolean} isUser - Whether the message was sent by the user.
 * @property {number} messageId - Index of the message in the chat array, or -1 for transient messages (e.g. streaming previews).
 * @property {boolean} isReasoning - Whether the message is reasoning/thinking output.
 */

/**
 * Immutable context object passed to every formatting hook.
 * Built from {@link MessageFormattingBase} with `stage` added and the whole
 * object frozen by {@link MessageFormatter#runStage}.
 *
 * @typedef {Readonly<MessageFormattingBase & { stage: MessageFormattingStage }>} MessageFormattingContext
 */

/**
 * A formatting hook function.
 * Receives the current message text (plain Markdown or HTML, depending on
 * the stage) and an immutable context object.  Must return the (possibly
 * modified) message text **synchronously** as a `string`.  Passing an async
 * function to {@link MessageFormatter#addHook} will throw a `TypeError` at
 * registration time.  If a hook returns a non-string at runtime, a console
 * warning is emitted and the return value is ignored (the pipeline continues
 * with the previous text unchanged).
 *
 * @callback MessageFormattingHook
 * @param {string}                    mes - Current message text at this pipeline stage.
 * @param {MessageFormattingContext}  ctx - Immutable metadata about the message.
 * @returns {string} The (possibly transformed) message text.
 */

/**
 * Options accepted by {@link MessageFormatter#addHook}.
 *
 * @typedef {Object} AddHookOptions
 * @property {hook_order|number} [order=hook_order.NORMAL] - Numeric priority within the stage.
 *   Lower numbers run first. Use the exported {@link hook_order} constants for readable values.
 */

/**
 * Ordering buckets for formatting hooks.
 * Use these when calling {@link MessageFormatter#addHook} to express
 * intent rather than bare numbers.
 *
 * @enum {number}
 */
export const hook_order = {
    EARLIEST: 0,
    EARLY: 10,
    NORMAL: 50,
    LATE: 90,
    LATEST: 100,
};

/** @type {MessageFormatter} */
let instance;

/**
 * Singleton instance of {@link MessageFormatter}.
 * Exported under the class name so callers can write
 * `import { MessageFormatter } from './message-formatter.js'`
 * and use it directly.
 *
 * @type {MessageFormatter}
 */
export { instance as MessageFormatter };

/**
 * Manages the message-formatting pipeline and exposes registration points
 * for extensions that need to transform message text before it reaches the
 * DOM.
 *
 * Extensions should obtain the singleton via `getContext().messageFormatter`
 * and call {@link MessageFormatter#addHook} once during their init phase.
 *
 * @example
 * // In your extension's init function:
 * const { messageFormatter } = getContext();
 * messageFormatter.addHook((mes, ctx) => {
 *     if (ctx.isUser) return mes;
 *     return addFurigana(mes);
 * });
 *
 * // With an explicit stage and order (using the enum accessors on the singleton):
 * const { messageFormatter } = getContext();
 * messageFormatter.addHook((mes, ctx) => transform(mes), {
 *     stage: messageFormatter.stage.AFTER_REGEX,
 *     order: messageFormatter.order.EARLY,
 * });
 */
class MessageFormatter {
    /** @type {MessageFormatter} */
    static #instance;

    /** @returns {MessageFormatter} */
    static get instance() {
        return MessageFormatter.#instance ?? (MessageFormatter.#instance = new MessageFormatter());
    }

    /**
     * Internal storage: one sorted bucket per stage.
     *
     * @type {Map<MessageFormattingStage, { fn: MessageFormattingHook, order: number }[]>}
     */
    #hooks = new Map();

    /**
     * Exposes {@link formatting_stage} on the instance so extensions can
     * access stage constants without a separate import.
     * @type {typeof formatting_stage}
     * @readonly
     */
    stage = formatting_stage;

    /**
     * Exposes {@link hook_order} on the instance so extensions can
     * access order constants without a separate import.
     * @type {typeof hook_order}
     * @readonly
     */
    order = hook_order;

    constructor() {
        this.#hooks.set(formatting_stage.BEFORE_REGEX, []);
        this.#hooks.set(formatting_stage.AFTER_REGEX, []);
        this.#hooks.set(formatting_stage.AFTER_MARKDOWN, []);
    }

    /**
     * Registers a hook function to run at a specific pipeline stage.
     *
     * Should be called once during the extension's init/setup phase.
     * Hooks are applied in ascending `order` within each stage.
     *
     * @param {MessageFormattingHook} fn - The hook function.
     * @param {AddHookOptions & { stage?: MessageFormattingStage }} [options={}]
     *   Options object. `stage` defaults to `'afterMarkdown'`; `order` defaults to `50`.
     * @returns {void}
     *
     * @throws {TypeError} If `fn` is not a function or is an async function.
     * @throws {RangeError} If `stage` is not a known {@link formatting_stage} value.
     */
    addHook(fn, { stage = formatting_stage.AFTER_MARKDOWN, order = hook_order.NORMAL } = {}) {
        if (typeof fn !== 'function') throw new TypeError('MessageFormatter: hook must be a function');
        if (fn.constructor?.name === 'AsyncFunction') throw new TypeError(`MessageFormatter: hook registered for stage '${stage}' must be synchronous — async functions are not supported`);
        if (!this.#hooks.has(stage)) throw new RangeError(`MessageFormatter: unknown stage '${stage}'`);
        this.#hooks.get(stage).push({ fn, order });
    }

    /**
     * Runs all hooks registered for the given stage in order.
     * Called internally by {@link messageFormatting} at each pipeline point.
     * Extensions do not need to call this directly.
     *
     * @param {MessageFormattingStage} stage - The pipeline stage to execute.
     * @param {string} mes - Current message text.
     * @param {MessageFormattingBase} base - Message metadata. `stage` is injected automatically.
     * @returns {string} The message text after all hooks have been applied.
     */
    runStage(stage, mes, base) {
        const bucket = this.#hooks.get(stage);
        if (!bucket?.length) return mes;
        const ctx = Object.freeze({ ...base, stage });
        const sorted = bucket.slice().sort((a, b) => a.order - b.order);
        for (const { fn } of sorted) {
            try {
                const result = fn(mes, ctx);
                if (typeof result !== 'string') {
                    console.warn(`[MessageFormatter] Hook at stage '${stage}' returned ${/** @type {unknown} */ (result) instanceof Promise ? 'a Promise (hook may be async)' : typeof result} instead of a string. The hook's return value has been ignored.`);
                } else {
                    mes = result;
                }
            } catch (e) {
                console.error(`[MessageFormatter] Hook error at stage '${stage}':`, e);
            }
        }
        return mes;
    }

    /**
     * Formats a message using the full pipeline (including all registered
     * hooks). This is a convenience shim over the top-level
     * {@link messageFormatting} function and accepts the same arguments.
     *
     * Extensions that already import `getContext()` can use this instead of
     * importing `messageFormatting` directly from `script.js`.
     *
     * The pipeline is, in order:
     *   1. Prompt-bias stripping (message 0 only)
     *   2. Comment / hidden-message normalisation
     *   3. `beforeRegex` extension hooks (see {@link MessageFormatter})
     *   4. Custom regex rules (`getRegexedString`)
     *   5. `afterRegex` extension hooks
     *   6. Markdown auto-fix (`fixMarkdown`)
     *   7. HTML tag encoding (`encode_tags`)
     *   8. Showdown Markdown → HTML conversion
     *   9. `afterMarkdown` extension hooks
     *  10. Name-prefix stripping (`allow_name2_display`)
     *  11. DOMPurify sanitization
     *
     * All extension hooks run **before** DOMPurify (steps 3, 5, 9) so their
     * output is always sanitised.
     *
     * @param {string} mes - Raw message text.
     * @param {string} characterName - Character name.
     * @param {boolean} isSystem - Whether this is a system message.
     * @param {boolean} isUser - Whether this was sent by the user.
     * @param {number} messageId - Message index in the chat array.
     * @param {Partial<import('dompurify').Config>} [sanitizerOverrides={}] - DOMPurify option overrides.
     * @param {boolean} [isReasoning=false] - Whether this is reasoning output.
     * @returns {string} Formatted HTML string ready for DOM insertion.
     */
    format(mes, characterName, isSystem, isUser, messageId, sanitizerOverrides = {}, isReasoning = false) {
        return messageFormatting(mes, characterName, isSystem, isUser, messageId, sanitizerOverrides, isReasoning);
    }
}

instance = MessageFormatter.instance;
