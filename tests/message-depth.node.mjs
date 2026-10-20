import assert from 'node:assert/strict';
import test from 'node:test';
import { getMessageDepth } from '../public/scripts/util/message-depth.js';

function originalDepth(chat, messageId) {
    const usableMessages = chat.map((x, index) => ({ message: x, index })).filter(x => !x.message.is_system);
    const indexOf = usableMessages.findIndex(x => x.index === Number(messageId));
    return messageId >= 0 && indexOf !== -1 ? usableMessages.length - indexOf - 1 : undefined;
}

test('depth matches the original for system messages, numeric IDs and transient messages', () => {
    for (let flags = 0; flags < 256; flags++) {
        const chat = Array.from({ length: 8 }, (_, i) => ({ is_system: Boolean(flags & (1 << i)) }));
        for (const id of [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, '3', '', null, undefined, NaN, Infinity, 1.5]) {
            assert.equal(getMessageDepth(chat, id), originalDepth(chat, id));
        }
    }
    assert.equal(getMessageDepth([], 0), undefined);
});

test('depth follows insertion, deletion, system toggles, reordering and chat switches immediately', () => {
    let chat = [{}, { is_system: true }, {}, {}];
    const check = () => chat.forEach((_, id) => assert.equal(getMessageDepth(chat, id), originalDepth(chat, id)));
    check();
    chat.splice(1, 0, {});
    check();
    chat.splice(3, 1);
    check();
    chat[1].is_system = true;
    check();
    chat.reverse();
    check();
    chat = [{}, {}, { is_system: true }];
    check();
});

test('formatting the tail does not inspect older history', () => {
    const chat = Array.from({ length: 10000 }, () => ({}));
    Object.defineProperty(chat[0], 'is_system', { get() { throw new Error('Older history was inspected'); } });
    assert.equal(getMessageDepth(chat, 9999), 0);
    assert.equal(getMessageDepth(chat, 9997), 2);
});
