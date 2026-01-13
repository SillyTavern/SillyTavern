/**
 * Patches showdown to unrestrictedly unhash HTML spans.
 * @param {import('showdown')} showdown The showdown object to patch
 */
export function addShowdownPatch(showdown) {
    showdown.subParser('unhashHTMLSpans', function (text, options, globals) {
        'use strict';
        text = globals.converter._dispatch('unhashHTMLSpans.before', text, options, globals);

        for (var i = 0; i < globals.gHtmlSpans.length; ++i) {
            var repText = globals.gHtmlSpans[i],
                // limiter to prevent infinite loop (assume 10 as limit for recurse)
                limit = 0;

            while (/¨C(\d+)C/.test(repText)) {
                var num = RegExp.$1;
                repText = repText.replace('¨C' + num + 'C', globals.gHtmlSpans[num]);
                if (limit === 10000) {
                    console.error('maximum nesting of 10000 spans reached!!!');
                    break;
                }
                ++limit;
            }
            text = text.replace('¨C' + i + 'C', repText);
        }

        text = globals.converter._dispatch('unhashHTMLSpans.after', text, options, globals);
        return text;
    });

    showdown.subParser('hashHTMLBlocks', function (text, options, globals) {
        'use strict';
        text = globals.converter._dispatch('hashHTMLBlocks.before', text, options, globals);

        var blockTags = [
                'pre',
                'div',
                'h1',
                'h2',
                'h3',
                'h4',
                'h5',
                'h6',
                'blockquote',
                'table',
                'dl',
                'ol',
                'ul',
                'script',
                'noscript',
                'form',
                'fieldset',
                'iframe',
                'math',
                'style',
                'section',
                'header',
                'footer',
                'nav',
                'article',
                'aside',
                'address',
                'audio',
                'canvas',
                'figure',
                'hgroup',
                'output',
                'video',
                'details',
                'p',
                // New additions
                'svg',
            ],
            repFunc = function (wholeMatch, match, left, right) {
                var txt = wholeMatch;
                // check if this html element is marked as markdown
                // if so, it's contents should be parsed as markdown
                if (left.search(/\bmarkdown\b/) !== -1) {
                    txt = left + globals.converter.makeHtml(match) + right;
                }
                return '\n\n¨K' + (globals.gHtmlBlocks.push(txt) - 1) + 'K\n\n';
            };

        if (options.backslashEscapesHTMLTags) {
            // encode backslash escaped HTML tags
            text = text.replace(/\\<(\/?[^>]+?)>/g, function (wm, inside) {
                return '&lt;' + inside + '&gt;';
            });
        }

        // hash HTML Blocks
        for (var i = 0; i < blockTags.length; ++i) {

            var opTagPos,
                rgx1 = new RegExp('^ {0,3}(<' + blockTags[i] + '\\b[^>]*>)', 'im'),
                patLeft = '<' + blockTags[i] + '\\b[^>]*>',
                patRight = '</' + blockTags[i] + '>';
            // 1. Look for the first position of the first opening HTML tag in the text
            while ((opTagPos = showdown.helper.regexIndexOf(text, rgx1)) !== -1) {

                // if the HTML tag is \ escaped, we need to escape it and break


                //2. Split the text in that position
                var subTexts = showdown.helper.splitAtIndex(text, opTagPos),
                    //3. Match recursively
                    newSubText1 = showdown.helper.replaceRecursiveRegExp(subTexts[1], repFunc, patLeft, patRight, 'im');

                // prevent an infinite loop
                if (newSubText1 === subTexts[1]) {
                    break;
                }
                text = subTexts[0].concat(newSubText1);
            }
        }
        // HR SPECIAL CASE
        text = text.replace(/(\n {0,3}(<(hr)\b([^<>])*?\/?>)[ \t]*(?=\n{2,}))/g,
            showdown.subParser('hashElement')(text, options, globals));

        // Special case for standalone HTML comments
        text = showdown.helper.replaceRecursiveRegExp(text, function (txt) {
            return '\n\n¨K' + (globals.gHtmlBlocks.push(txt) - 1) + 'K\n\n';
        }, '^ {0,3}<!--', '-->', 'gm');

        // PHP and ASP-style processor instructions (<?...?> and <%...%>)
        text = text.replace(/\n\n( {0,3}<([?%])[^\r]*?\2>[ \t]*(?=\n{2,}))/g,
            showdown.subParser('hashElement')(text, options, globals));

        text = globals.converter._dispatch('hashHTMLBlocks.after', text, options, globals);
        return text;
    });
}
