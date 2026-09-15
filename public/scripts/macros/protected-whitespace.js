/**
 * Protected-whitespace sentinels for the macro engine.
 *
 * Macro-produced whitespace (e.g. `{{newline}}` resolving to '\n', or a value
 * like `{{noop}} bar` resolving to ' bar') is semantically meaningful and must
 * survive the engine's trim passes, while LITERAL whitespace written by the
 * author keeps being trimmed as before. To make the two distinguishable, the
 * engine wraps macro results that contain edge whitespace in a sentinel
 * character before inserting them into the text stream. Because the sentinel
 * is not a whitespace codepoint, every existing `String.trim()` /
 * dedent operation stops at it automatically — trim call sites need no changes.
 *
 * Sentinels are stripped:
 * 1. before values are persisted into variables (see MacroCstWalker), and
 * 2. in a final pass at the end of `MacroEngine.evaluate`, after all
 *    post-processors have run.
 *
 * The sentinel is a Unicode noncharacter (permanently reserved, unassignable), chosen so it cannot collide with user content.
 */

/** Sentinel character used to protect macro-produced whitespace. */
export const PROTECTED = '\uFDD0';

/**
 * Wraps the given macro result in sentinels if it has leading or trailing
 * whitespace, so downstream trim operations leave it intact.
 *
 * @param {string} value The macro result to protect.
 * @returns {string} The protected value (unchanged if no edge whitespace).
 */
export function protect(value) {
    const text = String(value ?? '');
    if (text.length === 0) {
        return text;
    }
    const first = text[0];
    const last = text[text.length - 1];
    // The sentinel itself is not whitespace: already-protected or sentinel-only
    // values pass through without additional wrapping.
    if (!isTrimTarget(first) && !isTrimTarget(last)) {
        return text;
    }
    return (isTrimTarget(first) ? PROTECTED : '') + text + (isTrimTarget(last) ? PROTECTED : '');
}

/**
 * Removes all sentinel characters from the given text. Idempotent.
 *
 * @param {string} text Text that may contain sentinels.
 * @returns {string} The text without sentinels.
 */
export function stripProtected(text) {
    return String(text ?? '').split(PROTECTED).join('');
}

/**
 * Checks if a character is affected by String.prototype.trim() and the engine's
 * dedent logic (whitespace, or a newline/separator produced by macros).
 *
 * @param {string} ch A single character.
 * @returns {boolean} True if the character is trimmable whitespace.
 */
function isTrimTarget(ch) {
    return /\s/.test(ch);
}
