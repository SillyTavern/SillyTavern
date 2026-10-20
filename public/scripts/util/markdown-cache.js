/** @type {WeakMap<object, object>} Native converter configurations eligible for memoization. */
const nativeConverters = new WeakMap();

/**
 * Records a freshly configured native converter. Custom Showdown listeners may
 * depend on external state, so registering one disables caching for this instance.
 * @param {import('showdown').Converter} converter Markdown converter
 */
export function trackMarkdownConverter(converter) {
    const extensions = converter.getAllExtensions();
    const profile = {
        makeHtml: converter.makeHtml,
        dispatch: converter._dispatch,
        extensions: Object.fromEntries(Object.entries(extensions).map(([type, entries]) =>
            [type, entries.map(entry => ({ ...entry }))],
        )),
        hasListeners: false,
    };
    nativeConverters.set(converter, profile);
    const listen = converter.listen;
    converter.listen = function (...args) {
        profile.hasListeners = true;
        return listen.apply(this, args);
    };
}

/**
 * Checks that only the recorded native extensions are installed and unchanged.
 * @param {import('showdown').Converter} converter Markdown converter
 * @returns {boolean} Whether conversion is eligible for caching
 */
function isNativeConverter(converter) {
    const profile = nativeConverters.get(converter);
    if (!profile || profile.hasListeners || converter.makeHtml !== profile.makeHtml || converter._dispatch !== profile.dispatch) {
        return false;
    }
    const extensions = converter.getAllExtensions();
    return Object.keys(extensions).length === Object.keys(profile.extensions).length
        && Object.entries(profile.extensions).every(([type, entries]) =>
            extensions[type]?.length === entries.length && entries.every((entry, index) => {
                const current = extensions[type][index];
                return Object.keys(current).length === Object.keys(entry).length
                    && Object.entries(entry).every(([key, value]) => current[key] === value);
            }),
        );
}

/**
 * One-result cache owned by a reasoning handler. Regexes, formatter hooks and
 * sanitization stay outside this cache and continue to run on every update.
 */
export class MarkdownRenderCache {
    #converter;
    #options;
    #text;
    #html;

    /** Discards the previous conversion, including before a forced final render. */
    clear() {
        this.#converter = undefined;
        this.#options = undefined;
        this.#text = undefined;
        this.#html = undefined;
    }

    /**
     * Converts Markdown, reusing the last identical native conversion.
     * @param {string} text Markdown after regexes and formatting preparation
     * @param {import('showdown').Converter} converter Markdown converter
     * @param {boolean} [enabled=true] False when Markdown exclusions can evaluate macros
     * @returns {string} Converted HTML, before sanitization
     */
    render(text, converter, enabled = true) {
        // Metadata parsing mutates converter state that callers can read afterward.
        if (!enabled || !isNativeConverter(converter) || converter.getOption('metadata')) {
            this.clear();
            return converter.makeHtml(text);
        }
        const options = JSON.stringify(converter.getOptions());
        if (this.#converter === converter && this.#options === options && this.#text === text) {
            return this.#html;
        }
        const html = converter.makeHtml(text);
        this.#converter = converter;
        this.#options = options;
        this.#text = text;
        this.#html = html;
        return html;
    }
}
