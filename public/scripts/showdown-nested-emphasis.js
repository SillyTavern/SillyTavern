// Showdown extension that prevents parsing breakage when single asterisks are nested.
// It converts `*... *inner* ...*` into `*... **inner** ...*` before Showdown processes it.

export const markdownNestedEmphasisExt = () => {
    try {
        if (!canUseLookbehind()) {
            console.log('Showdown-nested-emphasis extension: Lookbehind not supported. Skipping.');
            return [];
        }

        return [{
            type: 'lang',
            filter: function (text) {
                const regex = /(?<=^|\W|_)\*(?!\s)([^*]+?)\*(?!\s)([^*]+?)(?<!\s)\*([^*]+?)(?<!\s)\*(?=\W|_|$)/g;
                let newText = text;
                let previousText = '';

                while (newText !== previousText) {
                    previousText = newText;
                    newText = newText.replace(regex, '*$1**$2**$3*');
                }

                return newText;
            },
        }];
    } catch (e) {
        console.error('Error in Showdown-nested-emphasis extension:', e);
        return [];
    }
};

function canUseLookbehind() {
    try {
        new RegExp('(?<=a)(?<!b)');
        return true;
    } catch (e) {
        return false;
    }
}
