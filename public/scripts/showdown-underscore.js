// Showdown extension that replaces words surrounded by singular underscores with <em> tags
export const markdownUnderscoreExt = () => {
    if (!canUseNegativeLookbehind()) {
        console.log('Showdown-underscore extension: Negative lookbehind not supported. Skipping.');
        return [];
    }

    return [{
        type: 'lang',
        regex: /\b(?<!_)_(?!_)(.*?)(?<!_)_(?!_)\b/g,
        replace: '<em>$1</em>',
    }];
};

function canUseNegativeLookbehind() {
    try {
        new RegExp('(?<!_)');
        return true;
    } catch (e) {
        return false;
    }
}
