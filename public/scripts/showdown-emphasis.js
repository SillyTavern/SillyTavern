/**
 * Showdown emphasis extensions and pre-processing utilities.
 *
 * Contains:
 * - markdownUnderscoreExt: Showdown output extension for _word_ emphasis
 * - fixNestedEmphasis: Pre-processor to convert nested same-delimiter emphasis to bold
 */

// ===== Underscore Emphasis Extension =====

/**
 * Showdown extension that replaces words surrounded by singular underscores with <em> tags.
 * @returns {import('showdown').ShowdownExtension[]} An array of Showdown extensions
 */
export const markdownUnderscoreExt = () => {
    try {
        if (!canUseNegativeLookbehind()) {
            console.log('Showdown-underscore extension: Negative lookbehind not supported. Skipping.');
            return [];
        }

        return [{
            type: 'output',
            regex: new RegExp('(<code(?:\\s+[^>]*)?>[\\s\\S]*?<\\/code>|<style(?:\\s+[^>]*)?>[\\s\\S]*?<\\/style>)|\\b(?<!_)_(?!_)(.*?)(?<!_)_(?!_)\\b', 'gi'),
            replace: function (match, tagContent, italicContent) {
                if (tagContent) {
                    // If it's inside <code> or <style> tags, return unchanged
                    return match;
                } else if (italicContent) {
                    // If it's an italic group, apply the replacement
                    return '<em>' + italicContent + '</em>';
                }
                // If none of the conditions are met, return the original match
                return match;
            },
        }];
    } catch (e) {
        console.error('Error in Showdown-underscore extension:', e);
        return [];
    }
};

function canUseNegativeLookbehind() {
    try {
        new RegExp('(?<!_)');
        return true;
    } catch (e) {
        return false;
    }
}

// ===== Nested Emphasis Pre-Processor =====

/**
 * Fixes nested emphasis that showdown cannot handle.
 *
 * Showdown cannot handle nested emphasis with the same delimiter character.
 * This function handles two cases:
 * 1. `*outer *inner* outer*` — inner `*` promoted to `**` (renders as bold-inside-italic)
 * 2. `**outer **inner** outer**` — inner `**` stripped (bold-inside-bold is redundant)
 *
 * Uses CommonMark-like flanking rules and stack-based pairing to detect nesting.
 *
 * @param {string} text The message text to process
 * @returns {string} The processed text with nested emphasis fixed
 * @example
 * fixNestedEmphasis("*She sighs. *I can't do this,* she says.*")
 * // → "*She sighs. **I can't do this,** she says.*"
 * fixNestedEmphasis("**This is **bold**, isn't it?**")
 * // → "**This is bold, isn't it?**"
 */
export function fixNestedEmphasis(text) {
    // Temporarily replace code blocks and inline code to protect them from modification
    const codeBlocks = [];
    let processed = text.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~|``[\s\S]*?``|`[^`\n]*`/g, (match) => {
        codeBlocks.push(match);
        return `\x00CODE_BLOCK_${codeBlocks.length - 1}\x00`;
    });

    processed = processed.split('\n').map(line => {
        // Fix nested ** inside ** first (strip inner), then nested * inside * (promote inner)
        line = fixNestedBoldLine(line);
        line = fixNestedItalicLine(line);
        return line;
    }).join('\n');

    // Restore code blocks
    processed = processed.replace(/\x00CODE_BLOCK_(\d+)\x00/g, (_, idx) => codeBlocks[parseInt(idx)]);

    return processed;
}

/**
 * Finds nested `**...**` pairs inside other `**...**` pairs and strips the inner delimiters.
 * Bold inside bold is redundant — like GitHub, the whole block renders as bold.
 * @param {string} line A single line of text
 * @returns {string} The processed line
 */
function fixNestedBoldLine(line) {
    // Find all ** positions (exactly two consecutive asterisks, not part of ***)
    const positions = [];
    for (let i = 0; i < line.length - 1; i++) {
        if (line[i] === '*' && line[i + 1] === '*') {
            const before = i > 0 ? line[i - 1] : '';
            const after = i + 2 < line.length ? line[i + 2] : '';
            // Must be exactly ** (not *** or more)
            if (before !== '*' && after !== '*') {
                positions.push(i);
                i++; // skip the second *
            }
        }
    }

    // Need at least 4 ** delimiters for nesting to be possible
    if (positions.length < 4) return line;

    // Stack-based pairing with flanking rules
    const stack = [];
    const pairs = [];

    for (let i = 0; i < positions.length; i++) {
        const pos = positions[i];
        // For **, check the char before the first * and after the second *
        const charBefore = pos > 0 ? line[pos - 1] : '';
        const charAfter = pos + 2 < line.length ? line[pos + 2] : '';

        const canClose = charBefore !== '' && !/\s/.test(charBefore);
        const canOpen = charAfter !== '' && !/\s/.test(charAfter);

        if (canClose && stack.length > 0) {
            const openIdx = stack.pop();
            pairs.push([openIdx, i]);
        } else if (canOpen) {
            stack.push(i);
        }
    }

    // Determine which pairs are nested inside others
    const nestedPositions = new Set();
    for (let i = 0; i < pairs.length; i++) {
        const [outerOpen, outerClose] = [positions[pairs[i][0]], positions[pairs[i][1]]];
        for (let j = 0; j < pairs.length; j++) {
            if (i === j) continue;
            const [innerOpen, innerClose] = [positions[pairs[j][0]], positions[pairs[j][1]]];
            if (innerOpen > outerOpen && innerClose < outerClose) {
                // Inner pair is nested — mark both its ** delimiters for removal
                nestedPositions.add(innerOpen);
                nestedPositions.add(innerClose);
            }
        }
    }

    if (nestedPositions.size === 0) return line;

    // Build result, skipping the nested ** delimiters
    let result = '';
    for (let i = 0; i < line.length; i++) {
        if (nestedPositions.has(i)) {
            i++; // skip both characters of **
            continue;
        }
        result += line[i];
    }
    return result;
}

/**
 * Finds nested `*...*` pairs inside other `*...*` pairs and promotes them to `**...**`.
 * This converts inner emphasis to bold so showdown renders bold-inside-italic.
 * @param {string} line A single line of text
 * @returns {string} The processed line
 */
function fixNestedItalicLine(line) {
    // Find all single-* positions (not part of ** or ***)
    const positions = [];
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '*') {
            const before = i > 0 ? line[i - 1] : '';
            const after = i < line.length - 1 ? line[i + 1] : '';
            if (before !== '*' && after !== '*') {
                positions.push(i);
            }
        }
    }

    // Need at least 4 single asterisks for nesting to be possible
    if (positions.length < 4) return line;

    // Use stack-based pairing with CommonMark-like flanking rules:
    // - An asterisk can OPEN emphasis if followed by a non-whitespace character
    // - An asterisk can CLOSE emphasis if preceded by a non-whitespace character
    const stack = [];
    const pairs = [];

    for (let i = 0; i < positions.length; i++) {
        const pos = positions[i];
        const charBefore = pos > 0 ? line[pos - 1] : '';
        const charAfter = pos < line.length - 1 ? line[pos + 1] : '';

        const canClose = charBefore !== '' && !/\s/.test(charBefore);
        const canOpen = charAfter !== '' && !/\s/.test(charAfter);

        // Prefer closing over opening (matches CommonMark behavior)
        if (canClose && stack.length > 0) {
            const openIdx = stack.pop();
            pairs.push([openIdx, i]);
        } else if (canOpen) {
            stack.push(i);
        }
    }

    // Determine nesting: a pair is nested if fully contained within another pair
    const nestedIndices = new Set();
    for (let i = 0; i < pairs.length; i++) {
        const [outerOpen, outerClose] = [positions[pairs[i][0]], positions[pairs[i][1]]];
        for (let j = 0; j < pairs.length; j++) {
            if (i === j) continue;
            const [innerOpen, innerClose] = [positions[pairs[j][0]], positions[pairs[j][1]]];
            if (innerOpen > outerOpen && innerClose < outerClose) {
                nestedIndices.add(innerOpen);
                nestedIndices.add(innerClose);
            }
        }
    }

    if (nestedIndices.size === 0) return line;

    // Build result with doubled asterisks at nested positions
    let result = '';
    for (let i = 0; i < line.length; i++) {
        result += line[i];
        if (nestedIndices.has(i)) {
            result += '*';
        }
    }
    return result;
}
