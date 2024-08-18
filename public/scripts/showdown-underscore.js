// Showdown extension that replaces words surrounded by singular underscores with <em> tags
export const markdownUnderscoreExt = () => {
    try {
        if (!canUseNegativeLookbehind()) {
            console.log('Showdown-underscore extension: Negative lookbehind not supported. Skipping.');
            return [];
        }

        return [{
            type: 'lang',
            regex: new RegExp('(`{3})[\\s\\S]*?\\1|(`{1,2}).*?\\2|\\b(?<!_)_(?!_)(.*?)(?<!_)_(?!_)\\b', 'g'),
            replace: function(match, tripleBackticks, singleOrDoubleBackticks, italicContent) {
                if (tripleBackticks || singleOrDoubleBackticks) {
                    // If it's any kind of code block, return it unchanged
                    return match;
                } else if (italicContent) {
                    // If it's an italic group, apply the replacement
                    return '<em>' + italicContent + '</em>';
                }
                // If neither condition is met, return the original match
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
