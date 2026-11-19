/**
 * Smoke test for the dynamic context window state machine.
 *
 * Tests the pure logic: _dyctxHash, _dyctxOldestIncludedIndex, and the
 * state-machine flow (cold-start → growth → at-cap → re-establish).
 *
 * Run: npm run test:unit --prefix tests -- dyctx-smoke
 *
 * Zero API calls, zero browser — pure logic verification.
 */

// ============================================================================
// Stubs: extract the logic under test without importing the full openai.js
// (which has 20+ browser-only imports).
// ============================================================================

// Mirrors the fixed logic in openai.js — reads from chatCompletion's chatHistory
// collection, NOT from tokenCounts (which only has aggregate keys).
function _dyctxHash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return h;
}

function _dyctxCreate(chatSig) {
    return { chatSig, fixedHash: null, perChar: new Map() };
}

function _dyctxOldestIncludedIndex(totalMsgs, chatCompletion) {
    const collections = chatCompletion?.getMessages?.()?.getCollection?.();
    if (!Array.isArray(collections)) return Math.max(0, totalMsgs - 1);
    const chatHistory = collections.find(c => c?.identifier === 'chatHistory');
    const includedCount = chatHistory?.collection?.length ?? 0;
    if (includedCount === 0) return Math.max(0, totalMsgs - 1);
    return Math.max(0, totalMsgs - includedCount);
}

// Build a mock chatCompletion where chatHistory has `includedCount` messages.
function mockChatCompletion(includedCount) {
    const collection = [];
    for (let i = 0; i < includedCount; i++) collection.push({ identifier: `chatHistory-${i + 1}` });
    return {
        getMessages: () => ({
            getCollection: () => [{ identifier: 'chatHistory', collection }],
        }),
    };
}

// ----------------------------------------------------------------------------
// Simulated prepareOpenAIMessages — the state machine, sans browser deps.
// Mirrors the logic in openai.js ~line 1573-1702.
// ----------------------------------------------------------------------------
function makeRunner(opts) {
    const { minContext, capContext } = opts;
    let _dyctx = null;

    // Simulated chat_metadata + this_chid + selected_group for chatSig
    let chatMetadata = {};
    let thisChid = undefined;
    let selectedGroup = undefined;

    function _dyctxChatSig() {
        const hash = chatMetadata?.chat_id_hash;
        if (hash !== undefined && hash !== null && hash !== '') {
            return Number(hash);
        }
        return _dyctxHash(`${thisChid ?? 'none'}::${selectedGroup ?? 'none'}`);
    }

    /**
     * Simulates one turn of prepareOpenAIMessages.
     * @param {object} p
     * @param {number} p.msgCount       Total messages in the chat
     * @param {string} p.charDescription
     * @param {object} p.fixedParts     { worldInfoBefore, scenario, ... }
     * @param {object} p.mockCounts     The tokenHandler.counts (for actualTokens sum).
     * @param {number} p.mockIncludedCount  How many chat msgs populateChatHistory included.
     * @param {boolean} [p.dryRun=false]
     * @returns {{budget:number, slicedFrom:number|null, actualTokens:number}}
     *   budget = token budget set; slicedFrom = anchor index (null=full array);
     *   actualTokens = sum of mockCounts.
     */
    function runTurn(p) {
        const dyctxEnabled = capContext > minContext;
        const dryRun = p.dryRun ?? false;

        let windowMessagesFrom = null; // null = full array (0)
        let charState = null;
        let charKey = 0;
        let needEstablish = false;
        let budget;

        if (!dyctxEnabled) {
            budget = minContext;
        } else {
            const sig = _dyctxChatSig();
            if (!_dyctx || _dyctx.chatSig !== sig) {
                _dyctx = _dyctxCreate(sig);
            }

            const fixedPartsKey = [
                p.fixedParts.worldInfoBefore ?? '',
                p.fixedParts.worldInfoAfter ?? '',
                p.fixedParts.scenario ?? '',
                p.fixedParts.charPersonality ?? '',
                p.fixedParts.systemPromptOverride ?? '',
                p.fixedParts.jailbreakPromptOverride ?? '',
                p.fixedParts.summary ?? '',
                p.fixedParts.authorsNote ?? '',
            ].join('::ST_DYNCTX::');
            const fixedHash = _dyctxHash(fixedPartsKey);
            if (!dryRun) {
                if (_dyctx.fixedHash !== null && fixedHash !== _dyctx.fixedHash) {
                    _dyctx.perChar.clear();
                }
                _dyctx.fixedHash = fixedHash;
            }

            charKey = _dyctxHash(p.charDescription ?? '');
            charState = _dyctx.perChar.get(charKey) ?? { anchor: null, prevTokens: null };

            const atCap = charState.prevTokens !== null && charState.prevTokens >= capContext;
            if (charState.anchor === null || atCap) {
                needEstablish = true;
                budget = minContext;
            } else {
                windowMessagesFrom = Math.max(0, Math.min(charState.anchor, p.msgCount - 1));
                budget = capContext;
            }
        }

        // Simulate post-generation update
        const actualTokens = Object.values(p.mockCounts).reduce(
            (s, v) => s + (typeof v === 'number' ? v : 0), 0);

        if (!dryRun && dyctxEnabled && charState) {
            if (needEstablish) {
                const includedCount = p.mockIncludedCount ?? Object.keys(p.mockCounts).filter(k => k.startsWith('chatHistory-')).length;
                charState.anchor = _dyctxOldestIncludedIndex(p.msgCount, mockChatCompletion(includedCount));
            }
            charState.prevTokens = actualTokens;
            _dyctx.perChar.set(charKey, charState);
        }

        return {
            budget,
            slicedFrom: windowMessagesFrom, // null = full array
            actualTokens,
            needEstablish,
        };
    }

    return {
        runTurn,
        _setChatMetadata: (m) => { chatMetadata = m; },
        _setChid: (c) => { thisChid = c; },
        _setGroup: (g) => { selectedGroup = g; },
        _getDyctx: () => _dyctx,
    };
}

// ============================================================================
// Tests
// ============================================================================
// This file uses throw-based assertions (assert/assertEq) rather than jest's
// expect(), and the multi-turn sawtooth test needs loops/conditionals by design.
/* eslint-disable jest/expect-expect, playwright/expect-expect, playwright/no-conditional-in-test */
function assert(cond, msg) { if (!cond) throw new Error(`Assertion failed: ${msg}`); }
function assertEq(a, b, msg) { if (a !== b) throw new Error(`Expected ${b} but got ${a}: ${msg}`); }

// --- _dyctxHash ---
test('_dyctxHash is deterministic', () => {
    assertEq(_dyctxHash('hello'), _dyctxHash('hello'), 'same input → same output');
    assert(_dyctxHash('hello') !== _dyctxHash('world'), 'different inputs → different outputs');
});

test('_dyctxHash returns 0 for empty string', () => {
    assertEq(_dyctxHash(''), 0, 'empty string → 0');
});

// --- _dyctxOldestIncludedIndex ---
test('_dyctxOldestIncludedIndex finds oldest included message', () => {
    // 100 messages total, 16 included → anchor = 100 - 16 = 84
    const idx = _dyctxOldestIncludedIndex(100, mockChatCompletion(16));
    assertEq(idx, 84, '100 msgs, 16 included → index 84');
});

test('_dyctxOldestIncludedIndex returns last index if nothing included', () => {
    const idx = _dyctxOldestIncludedIndex(50, mockChatCompletion(0));
    assertEq(idx, 49, '0 included → fallback to last message');
});

test('_dyctxOldestIncludedIndex handles all included', () => {
    const idx = _dyctxOldestIncludedIndex(10, mockChatCompletion(10));
    assertEq(idx, 0, 'all 10 included → index 0');
});

// --- State machine: cold start ---
test('Cold start: uses minContext budget, establishes anchor', () => {
    const r = makeRunner({ minContext: 3000, capContext: 200000 });
    // 100 messages, minContext budget → only recent ~25 fit
    const counts = {};
    counts['system'] = 500;
    for (let n = 76; n <= 100; n++) counts[`chatHistory-${n}`] = 100;

    const result = r.runTurn({
        msgCount: 100,
        charDescription: 'Alice is a knight.',
        fixedParts: { worldInfoBefore: 'WI' },
        mockCounts: counts,
    });

    assertEq(result.budget, 3000, 'cold start uses minContext');
    assertEq(result.slicedFrom, null, 'cold start uses full array');
    assert(result.needEstablish, 'cold start sets needEstablish');

    const dyctx = r._getDyctx();
    const charKey = _dyctxHash('Alice is a knight.');
    const charState = dyctx.perChar.get(charKey);
    assert(charState !== undefined, 'char state stored after cold start');
    assertEq(charState.anchor, 75, 'anchor = oldest included index (chatHistory-76 → 75)');
});

// --- State machine: growth phase ---
test('Growth: uses capContext budget, slices from anchor', () => {
    const r = makeRunner({ minContext: 3000, capContext: 200000 });
    // Turn 1: cold start, establish anchor at 75
    const coldCounts = { system: 500 };
    for (let n = 76; n <= 100; n++) coldCounts[`chatHistory-${n}`] = 100;
    r.runTurn({
        msgCount: 100,
        charDescription: 'Alice',
        fixedParts: { worldInfoBefore: 'WI' },
        mockCounts: coldCounts,
    });

    // Turn 2: growth — budget should be cap, slice from anchor 75
    // New message added (101 messages), sliced from 75
    const growthCounts = { system: 500 };
    for (let n = 1; n <= 26; n++) growthCounts[`chatHistory-${n}`] = 100; // 26 msgs in slice
    const result = r.runTurn({
        msgCount: 101,
        charDescription: 'Alice',
        fixedParts: { worldInfoBefore: 'WI' },
        mockCounts: growthCounts,
    });

    assertEq(result.budget, 200000, 'growth uses capContext');
    assertEq(result.slicedFrom, 75, 'growth slices from established anchor');
    assert(!result.needEstablish, 'growth does not need establish');
});

// --- State machine: at cap → re-establish ---
test('At cap: triggers re-establish on next turn', () => {
    const r = makeRunner({ minContext: 3000, capContext: 10000 });
    // Turn 1: cold start
    const coldCounts = { system: 500 };
    for (let n = 91; n <= 100; n++) coldCounts[`chatHistory-${n}`] = 100;
    r.runTurn({
        msgCount: 100,
        charDescription: 'Bob',
        fixedParts: {},
        mockCounts: coldCounts,
    });

    // Turn 2: growth, but simulate actualTokens >= cap
    const growthCounts = { system: 500 };
    for (let n = 1; n <= 90; n++) growthCounts[`chatHistory-${n}`] = 100; // 9400 tokens → >= cap(10000)? no
    // Actually 500 + 90*100 = 9500 < 10000. Let's make it exceed:
    growthCounts['big'] = 1000; // pad to exceed cap
    r.runTurn({
        msgCount: 190, // bigger conversation
        charDescription: 'Bob',
        fixedParts: {},
        mockCounts: { ...growthCounts, system: 500 + 1000 }, // 10500 >= 10000
    });

    // Turn 3: should re-establish (prevTokens >= cap)
    const reEstablishCounts = { system: 500 };
    for (let n = 171; n <= 190; n++) reEstablishCounts[`chatHistory-${n}`] = 100;
    const result = r.runTurn({
        msgCount: 190,
        charDescription: 'Bob',
        fixedParts: {},
        mockCounts: reEstablishCounts,
    });

    assertEq(result.budget, 3000, 'at-cap turn uses minContext');
    assert(result.needEstablish, 'at-cap turn triggers re-establish');
});

// --- Fixed prefix change → reset ---
test('WI change: clears all character state', () => {
    const r = makeRunner({ minContext: 3000, capContext: 200000 });
    const counts = { system: 500, 'chatHistory-1': 100, 'chatHistory-2': 100 };

    // Turn 1: establish with WI_A
    r.runTurn({
        msgCount: 2,
        charDescription: 'Alice',
        fixedParts: { worldInfoBefore: 'WI_A' },
        mockCounts: counts,
    });
    const dyctxAfterT1 = r._getDyctx();
    assertEq(dyctxAfterT1.perChar.size, 1, 'one char state after T1');

    // Turn 2: WI changed to WI_B → should clear
    r.runTurn({
        msgCount: 2,
        charDescription: 'Alice',
        fixedParts: { worldInfoBefore: 'WI_B' },
        mockCounts: counts,
    });
    // After WI change, perChar was cleared then re-populated with new cold-start entry
    const dyctxAfterT2 = r._getDyctx();
    const charState = dyctxAfterT2.perChar.get(_dyctxHash('Alice'));
    assert(charState !== undefined, 'char re-created after WI change (cold start)');
    assertEq(charState.anchor, 0, 'anchor reset to 0 after WI change (only msgs 1-2 included)');
});

// --- Multi-character (SWAP simulation) ---
test('SWAP: two characters get independent state', () => {
    const r = makeRunner({ minContext: 3000, capContext: 200000 });
    const counts = { system: 500, 'chatHistory-1': 100, 'chatHistory-2': 100 };

    // Char A turn
    r.runTurn({ msgCount: 2, charDescription: 'Alice the knight', fixedParts: {}, mockCounts: counts });
    // Char B turn
    r.runTurn({ msgCount: 2, charDescription: 'Bob the mage', fixedParts: {}, mockCounts: counts });

    const dyctx = r._getDyctx();
    assertEq(dyctx.perChar.size, 2, 'two separate char states');
    assert(dyctx.perChar.has(_dyctxHash('Alice the knight')), 'Alice state exists');
    assert(dyctx.perChar.has(_dyctxHash('Bob the mage')), 'Bob state exists');
});

// --- charDescription change does NOT trigger reset (unlike WI) ---
test('charDescription change does NOT reset other characters', () => {
    const r = makeRunner({ minContext: 3000, capContext: 200000 });
    const counts = { system: 500, 'chatHistory-1': 100 };

    // Char A, establish + grow
    r.runTurn({ msgCount: 1, charDescription: 'Alice', fixedParts: { scenario: 'S' }, mockCounts: counts });
    // Char B (different charDescription, same fixed parts)
    r.runTurn({ msgCount: 1, charDescription: 'Bob', fixedParts: { scenario: 'S' }, mockCounts: counts });

    const dyctx = r._getDyctx();
    // Both chars should coexist — charDescription change didn't clear
    assertEq(dyctx.perChar.size, 2, 'charDescription change does NOT clear perChar');
});

// --- dryRun: no state mutation ---
test('dryRun does not mutate state', () => {
    const r = makeRunner({ minContext: 3000, capContext: 200000 });
    const counts = { system: 500, 'chatHistory-1': 100 };

    r.runTurn({
        msgCount: 1, charDescription: 'Alice', fixedParts: {},
        mockCounts: counts, dryRun: true,
    });

    const dyctx = r._getDyctx();
    // dryRun should not have stored anything
    assertEq(dyctx.perChar.size, 0, 'dryRun does not populate perChar');
    assertEq(dyctx.fixedHash, null, 'dryRun does not update fixedHash');
});

// --- Chat switch detection ---
test('Chat switch: resets state', () => {
    const r = makeRunner({ minContext: 3000, capContext: 200000 });
    const counts = { system: 500, 'chatHistory-1': 100 };

    // Chat 1
    r._setChatMetadata({ chat_id_hash: 111 });
    r.runTurn({ msgCount: 1, charDescription: 'Alice', fixedParts: {}, mockCounts: counts });
    assert(r._getDyctx() !== null, 'state created for chat 1');

    const dyctx1 = r._getDyctx();
    const sig1 = dyctx1.chatSig;

    // Chat 2
    r._setChatMetadata({ chat_id_hash: 222 });
    r.runTurn({ msgCount: 1, charDescription: 'Alice', fixedParts: {}, mockCounts: counts });

    const dyctx2 = r._getDyctx();
    assert(dyctx2 !== dyctx1, 'new state object after chat switch');
    assert(dyctx2.chatSig !== sig1, 'new chatSig after switch');
    assertEq(dyctx2.perChar.size, 1, 'chat 2 has its own fresh state');
});

// --- Feature disabled: cap <= min ---
test('Disabled (cap <= min): uses minContext, no state tracking', () => {
    const r = makeRunner({ minContext: 8000, capContext: 8000 });
    const counts = { system: 500, 'chatHistory-1': 100 };

    const result = r.runTurn({
        msgCount: 1, charDescription: 'Alice', fixedParts: {}, mockCounts: counts,
    });

    assertEq(result.budget, 8000, 'disabled → minContext budget');
    assertEq(result.slicedFrom, null, 'disabled → full array');
    assert(!result.needEstablish, 'disabled → no establish');
    assert(r._getDyctx() === null, 'disabled → no state object created');
});

// --- Sawtooth pattern: multi-turn simulation ---
test('Sawtooth: growth → cap → truncate → growth (multi-turn)', () => {
    const r = makeRunner({ minContext: 2000, capContext: 5000 });

    // Simulate a conversation that grows 1 message per turn.
    // Each message = 100 tokens. Fixed overhead = 500.
    // minContext=2000 → ~15 messages fit. capContext=5000 → ~45 messages fit.

    let msgCount = 1;
    const budgets = [];

    for (let turn = 0; turn < 60; turn++) {
        // Determine what mockCounts should look like based on the mode:
        // - Establish (budget=min): only recent ~15 msgs included, numbered by original position
        // - Growth (budget=cap): slice from anchor, all included, numbered 1..sliceLen
        const dyctx = r._getDyctx();
        const charKey = _dyctxHash('Alice');
        const charState = dyctx?.perChar.get(charKey);
        const anchor = charState?.anchor ?? null;
        const atCap = charState?.prevTokens != null && charState.prevTokens >= 5000;

        const counts = { system: 500 };
        if (anchor === null || atCap) {
            // Establish: full array, only recent ~15 msgs fit in min
            const included = Math.min(msgCount, 15);
            for (let i = 0; i < included; i++) {
                counts[`chatHistory-${msgCount - included + i + 1}`] = 100;
            }
        } else {
            // Growth: sliced from anchor, all included
            const sliceLen = msgCount - anchor;
            for (let i = 0; i < sliceLen; i++) {
                counts[`chatHistory-${i + 1}`] = 100;
            }
        }

        const result = r.runTurn({
            msgCount,
            charDescription: 'Alice',
            fixedParts: {},
            mockCounts: counts,
        });

        budgets.push(result.budget);

        // Verify the sawtooth pattern:
        // - First turn: establish (budget=min=2000)
        // - Then growth (budget=cap=5000) for several turns
        // - When actualTokens >= cap, next turn re-establishes (budget=min=2000)
        // - Then growth again

        msgCount++; // new message each turn
    }

    // Turn 0: cold start (budget=2000)
    assertEq(budgets[0], 2000, 'turn 0: cold start at min');

    // Turns 1..N: growth (budget=5000) until cap hit
    let firstGrowthTurn = 1;
    while (firstGrowthTurn < budgets.length && budgets[firstGrowthTurn] !== 5000) firstGrowthTurn++;
    assert(firstGrowthTurn < budgets.length, 'should enter growth phase');

    // Find a re-establish turn (budget drops back to 2000 after being at 5000)
    let sawReEstablish = false;
    for (let i = firstGrowthTurn + 1; i < budgets.length; i++) {
        if (budgets[i] === 2000) {
            sawReEstablish = true;
            // After re-establish, should go back to growth
            if (i + 1 < budgets.length) {
                assertEq(budgets[i + 1], 5000, `turn ${i + 1}: growth resumes after re-establish at turn ${i}`);
            }
            break;
        }
    }
    assert(sawReEstablish, 'should see at least one truncate (budget back to min) in 60 turns');
});
