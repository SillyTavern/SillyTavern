/**
 * Counts non-system messages after a message, as used by regex depth limits.
 * Scanning only the suffix makes streaming the last message independent of
 * history length. Recompute from live data so edits and reordering stay visible.
 * @param {{ is_system?: boolean }[]} messages Chat messages
 * @param {number|string} messageId Absolute message index
 * @returns {number|undefined} Depth, or undefined for system/transient messages
 */
export function getMessageDepth(messages, messageId) {
    const index = Number(messageId);
    if (!Number.isInteger(index) || index < 0 || index >= messages.length || !messages[index] || messages[index].is_system) {
        return undefined;
    }

    let depth = 0;
    for (let i = index + 1; i < messages.length; i++) {
        if (messages[i] && !messages[i].is_system) {
            depth++;
        }
    }
    return depth;
}
