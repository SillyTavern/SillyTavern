import assert from 'node:assert/strict';
import test from 'node:test';
import showdown from 'showdown';
import { MarkdownRenderCache, trackMarkdownConverter } from '../public/scripts/util/markdown-cache.js';

function fixture() {
    const converter = new showdown.Converter({ tables: true });
    const makeHtml = converter.makeHtml;
    let calls = 0;
    converter.makeHtml = function (text) {
        calls++;
        return makeHtml.call(this, text);
    };
    trackMarkdownConverter(converter);
    return { converter, cache: new MarkdownRenderCache(), calls: () => calls };
}

test('unchanged reasoning converts once, with the same Markdown result', () => {
    const { converter, cache, calls } = fixture();
    const text = '**Reasoning**\n\n- first\n- second\n\n```js\nconst x = 1 < 2;\n```';
    const expected = new showdown.Converter({ tables: true }).makeHtml(text);
    for (let i = 0; i < 100; i++) assert.equal(cache.render(text, converter), expected);
    assert.equal(calls(), 1);
    assert.notEqual(cache.render(text + '\n\nDone.', converter), expected);
    assert.equal(calls(), 2);
    cache.clear();
    cache.render(text + '\n\nDone.', converter);
    assert.equal(calls(), 3);
});

test('converter options and replacement converters invalidate the previous result', () => {
    const { converter, cache, calls } = fixture();
    const text = 'line one\nline two';
    const original = cache.render(text, converter);
    converter.setOption('simpleLineBreaks', true);
    assert.notEqual(cache.render(text, converter), original);
    assert.equal(calls(), 2);
    const next = fixture();
    assert.equal(cache.render(text, next.converter), original);
    assert.equal(next.calls(), 1);
});

test('custom extensions, listeners and makeHtml replacements still run on each call', () => {
    const { converter, cache } = fixture();
    cache.render('content', converter);
    let version = 0;
    converter.addExtension({ type: 'output', filter: html => html + ++version }, 'dynamic');
    assert.match(cache.render('content', converter), /1$/);
    assert.match(cache.render('content', converter), /2$/);

    const next = fixture();
    next.cache.render('content', next.converter);
    let events = 0;
    next.converter.listen('blockGamut.before', () => { events++; });
    next.cache.render('content', next.converter);
    next.cache.render('content', next.converter);
    assert.equal(events, 2);

    const last = fixture();
    last.cache.render('content', last.converter);
    let changes = 0;
    last.converter.makeHtml = () => String(++changes);
    assert.equal(last.cache.render('content', last.converter), '1');
    assert.equal(last.cache.render('content', last.converter), '2');
});

test('mutating a registered extension disables reuse', () => {
    const converter = new showdown.Converter();
    converter.addExtension({ type: 'output', filter: text => text }, 'native');
    trackMarkdownConverter(converter);
    const cache = new MarkdownRenderCache();
    cache.render('content', converter);
    let changes = 0;
    converter.getAllExtensions().output[0].filter = () => String(++changes);
    assert.equal(cache.render('content', converter), '1');
    assert.equal(cache.render('content', converter), '2');
});

test('macro exclusions and metadata parsing bypass the cache', () => {
    const { converter, cache, calls } = fixture();
    cache.render('same', converter);
    cache.render('same', converter, false);
    cache.render('same', converter, false);
    cache.render('same', converter);
    assert.equal(calls(), 4);
    converter.setOption('metadata', true);
    const text = '---\ntitle: Reasoning\n---\n\nsame';
    cache.render(text, converter);
    converter.makeHtml('---\ntitle: Body\n---\n\nbody');
    cache.render(text, converter);
    assert.equal(converter.getMetadata().title, 'Reasoning');
});
