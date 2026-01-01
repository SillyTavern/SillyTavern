/** @typedef {import('./MacroCstWalker.js').MacroCall} MacroCall */
/** @typedef {import('./MacroRegistry.js').MacroDefinition} MacroDefinition */
/** @typedef {import('chevrotain').ILexingError} ILexingError */
/** @typedef {import('chevrotain').IRecognitionException} IRecognitionException */

/**
 * @typedef {Object} MacroErrorContext
 * @property {string} [macroName]
 * @property {MacroCall} [call]
 * @property {MacroDefinition} [def]
 */

/**
 * Options for creating a macro runtime error.
 *
 * @typedef {MacroErrorContext & { message: string }} MacroRuntimeErrorOptions
 */

/**
 * Options for logging macro warnings or errors.
 *
 * @typedef {MacroErrorContext & { message: string, error?: any }} MacroLogOptions
 */

/**
 * Creates an error representing a runtime macro invocation problem (such as
 * arity or type mismatches). These errors are intended to be caught by the
 * MacroEngine, which will log them as runtime warnings and leave the macro
 * raw in the evaluated text.
 *
 * @param {MacroRuntimeErrorOptions} options
 * @returns {Error}
 */
export function createMacroRuntimeError({ message, call, def, macroName }) {
    const inferredName = inferMacroName(call, def, macroName);

    const error = new Error(message);
    error.name = 'MacroRuntimeError';
    // @ts-ignore - custom tagging for downstream classification
    error.isMacroRuntimeError = true;
    // @ts-ignore - helpful metadata for debugging
    error.macroName = inferredName;
    // @ts-ignore - best-effort location information
    error.macroRange = call && call.range ? call.range : null;
    // @ts-ignore - attach raw call/definition for convenience
    if (call) error.macroCall = call;
    // @ts-ignore
    if (def) error.macroDefinition = def;

    return error;
}

/**
 * Logs a macro runtime warning with consistent, helpful context. These
 * correspond to issues in how a macro was written in the text (e.g. invalid
 * arguments), not bugs in macro definitions or the engine itself.
 *
 * @param {MacroLogOptions} options
 */
export function logMacroRuntimeWarning({ message, call, def, macroName, error }) {
    const payload = buildMacroPayload({ call, def, macroName, error });
    console.warn('[Macro] Warning:', message, payload);
}

/**
 * Logs an internal macro error (definition or engine bug) with a consistent
 * schema. These are surfaced as red errors in the console.
 *
 * @param {MacroLogOptions} options
 */
export function logMacroInternalError({ message, call, macroName, error }) {
    const payload = buildMacroPayload({ call, def: undefined, macroName, error });
    console.error('[Macro] Error:', message, payload);
}

/**
 * Logs a warning during macro registration.
 *
 * @param {{ message: string, macroName?: string, error?: any }} options
 */
export function logMacroRegisterWarning({ message, macroName, error = undefined }) {
    const payload = buildMacroPayload({ macroName, error });
    console.warn('[Macro] Warning:', message, payload);
}

/**
 * Logs an error during macro registration. Used when registration fails
 * and the macro will not be available.
 *
 * @param {{ message: string, macroName?: string, error?: any }} options
 */
export function logMacroRegisterError({ message, macroName, error = undefined }) {
    const payload = buildMacroPayload({ macroName, error });
    console.error('[Macro] Registration Error:', message, payload);
}

/**
 * Logs a macro error with a consistent schema.
 *
 * @param {{ message: string, error?: any }} options
 */
export function logMacroGeneralError({ message, error }) {
    console.error('[Macro] Error:', message, error);
}

/**
 * Logs lexer/parser syntax warnings for the macro engine with a compact,
 * human-readable payload.
 *
 * @param {{ phase: 'lexing', input: string, errors: ILexingError[] }|{ phase: 'parsing', input: string, errors: IRecognitionException[] }} options
 */
export function logMacroSyntaxWarning({ phase, input, errors }) {
    if (!errors || errors.length === 0) {
        return;
    }

    /** @type {{ message: string, line: number|null, column: number|null, length: number|null }[]} */
    const issues = errors.map((err) => {
        const hasOwnLine = typeof err.line === 'number';
        const hasOwnColumn = typeof err.column === 'number';

        const token = /** @type {{ startLine?: number, startColumn?: number, startOffset?: number, endOffset?: number }|undefined} */ (err.token);

        const line = hasOwnLine ? err.line : (token && typeof token.startLine === 'number' ? token.startLine : null);
        const column = hasOwnColumn ? err.column : (token && typeof token.startColumn === 'number' ? token.startColumn : null);

        /** @type {number|null} */
        let length = null;
        if (typeof err.length === 'number') {
            length = err.length;
        } else if (token && typeof token.startOffset === 'number' && typeof token.endOffset === 'number') {
            length = token.endOffset - token.startOffset + 1;
        }

        return {
            message: err.message,
            line,
            column,
            length,
        };
    });

    const label = phase === 'lexing' ? 'Lexing' : 'Parsing';

    /** @type {Record<string, any>} */
    const payload = {
        phase,
        count: issues.length,
        issues,
        input,
    };

    console.warn('[Macro] Warning:', `${label} errors detected`, payload);
}

/**
 * Builds a structured payload for macro logging.
 *
 * @param {MacroErrorContext & { error?: any }} ctx
 */
function buildMacroPayload({ call, def, macroName, error }) {
    const inferredName = inferMacroName(call, def, macroName);

    /** @type {Record<string, any>} */
    const payload = {
        macroName: inferredName,
    };

    if (call && call.range) payload.range = call.range;
    if (call && typeof call.rawInner === 'string') payload.raw = call.rawInner;
    if (call) payload.call = call;
    if (def) payload.def = def;
    if (error) payload.error = error;

    return payload;
}

/**
 * Infers the most appropriate macro name from the available context.
 *
 * @param {MacroCall} [call]
 * @param {MacroDefinition} [def]
 * @param {string} [explicit]
 * @returns {string}
 */
function inferMacroName(call, def, explicit) {
    if (typeof explicit === 'string' && explicit.trim()) {
        return explicit.trim();
    }
    if (call && typeof call.name === 'string' && call.name.trim()) {
        return call.name.trim();
    }
    if (def && typeof def.name === 'string' && def.name.trim()) {
        return def.name.trim();
    }
    return 'unknown';
}
