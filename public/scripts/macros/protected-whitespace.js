/**
 * Invisible markers that let the macro engine keep explicit {{newline}}, {{space}} and {{noop}} output when it trims
 * text. String.prototype.trim() stops at a marker because a marker is not whitespace. The engine removes the markers
 * before its result leaves it.
 *
 * Both markers are Unicode noncharacters, which are reserved for internal use. The engine also removes them from
 * prompt text that contains them.
 */

/** Wraps {{newline}} and {{space}} output. The legacy {{trim}} removes it together with the newlines around it. */
export const WHITESPACE_MARKER = '﷐';

/** Wraps {{noop}} output. No trim goes past it, and that includes the legacy {{trim}}. */
export const STOP_MARKER = '﷑';

/**
 * @param {string|undefined} macroName - Primary name of the macro that produced the value.
 * @param {string} value - Output of the macro.
 * @returns {string} The value with markers if it is output of {{newline}}, {{space}} or {{noop}}.
 */
export function markWhitespaceMacroResult(macroName, value) {
    switch (macroName) {
        case 'noop':
            return STOP_MARKER + value + STOP_MARKER;
        case 'newline':
        case 'space':
            // An empty pair stops trims but keeps no whitespace, as with {{space::0}}.
            return value ? WHITESPACE_MARKER + value + WHITESPACE_MARKER : value;
        default:
            return value;
    }
}

/**
 * Removes non-scoped {{trim}} and the newlines around it. Whitespace markers count as part of those newlines, so
 * {{trim}} removes {{newline}} output. A stop marker ends them, so {{noop}} protects the newlines on its other side.
 * Both rules match the legacy macro engine, which replaced {{newline}} before {{trim}} and {{noop}} after it.
 *
 * @param {string} text
 * @returns {string}
 */
export function applyLegacyTrim(text) {
    return text.replace(/(?:\r?\n|﷐)*{{trim}}(?:\r?\n|﷐)*/gi, '');
}

/**
 * @param {string} text
 * @returns {string} The text without whitespace markers and stop markers.
 */
export function stripWhitespaceMarkers(text) {
    return text.replace(/[﷐﷑]/g, '');
}
