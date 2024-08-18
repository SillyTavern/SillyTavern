// Showdown extension that replaces words surrounded by singular underscores with <em> tags
export const markdownUnderscoreExt = () => {
    try {
        if (!canUseNegativeLookbehind()) {
            console.log('Showdown-underscore extension: Negative lookbehind not supported. Skipping.');
            return [];
        }

        return [{
            type: 'lang',
            regex: new RegExp('(`{1,3}).*?\\1|\\b(?<!_)_(?!_)(.*?)(?<!_)_(?!_)\\b', 'gs'),
            replace: function(match, codeBlock, italicContent) {
                if (codeBlock) {
                    // If it's a code block, return it unchanged
                    return match;
                } else {
                    // If it's an italic group, apply the replacement
                    return `<em>${italicContent}</em>`;
                }
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
