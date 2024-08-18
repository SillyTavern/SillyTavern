// Showdown extension that replaces words surrounded by singular underscores with <em> tags
export const markdownUnderscoreExt = () => {
    try {
        if (!canUseNegativeLookbehind()) {
            console.log('Showdown-underscore extension: Negative lookbehind not supported. Skipping.');
            return [];
        }

        return [{
            type: 'lang',
            regex: /(`{3,})\s*\n[\s\S]*?\n\1(?:\n|$)|(`{1,2}).*?\2|(\n`\n[\s\S]*?\n`\n)|(?<!\S)_(?!_)([^_\n]+?)(?<!_)_(?!\w)/g,
            replace: function(match, tripleBackticks, singleOrDoubleBackticks, singleBackticksWithLineBreaks, italicContent) {
                if (singleOrDoubleBackticks || tripleBackticks || singleBackticksWithLineBreaks) {
                    // If it's any type of backticks, return unchanged
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
