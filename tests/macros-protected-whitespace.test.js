import { jest } from '@jest/globals';
import * as chevrotain from 'chevrotain';

await jest.unstable_mockModule('../public/lib.js', () => ({ chevrotain, seedrandom: () => Math.random, droll: {} }));
await jest.unstable_mockModule('../public/script.js', () => ({
    chat_metadata: {},
    main_api: '',
    extension_prompts: {},
    getCurrentChatId: () => undefined,
    getMaxContextTokens: () => 0,
    getMaxPromptTokens: () => 0,
    getMaxResponseTokens: () => 0,
}));
await jest.unstable_mockModule('../public/scripts/utils.js', () => ({
    getStringHash: () => 0,
    isFalseBoolean: arg => ['off', 'false', '0'].includes(arg?.trim()?.toLowerCase()),
    isTrueBoolean: arg => ['on', 'true', '1'].includes(arg?.trim()?.toLowerCase()),
}));
await jest.unstable_mockModule('../public/scripts/textgen-settings.js', () => ({ textgenerationwebui_banned_in_macros: [] }));
await jest.unstable_mockModule('../public/scripts/macros/engine/MacroDiagnostics.js', () => ({
    createMacroRuntimeError: ({ message }) => Object.assign(new Error(message), { name: 'MacroRuntimeError' }),
    logMacroGeneralError: () => {},
    logMacroInternalError: () => {},
    logMacroRegisterError: () => {},
    logMacroRegisterWarning: () => {},
    logMacroRuntimeWarning: () => {},
    logMacroSyntaxWarning: () => {},
}));

const { MacroEngine } = await import('../public/scripts/macros/engine/MacroEngine.js');
const { registerCoreMacros } = await import('../public/scripts/macros/definitions/core-macros.js');
const {
    STOP_MARKER,
    WHITESPACE_MARKER,
    applyLegacyTrim,
    markWhitespaceMacroResult,
    stripWhitespaceMarkers,
} = await import('../public/scripts/macros/protected-whitespace.js');

registerCoreMacros();

const localVariables = new Map();

beforeAll(() => {
    global.SillyTavern = {
        getContext: () => ({
            variables: {
                local: {
                    get: name => localVariables.get(name),
                    set: (name, value) => localVariables.set(name, value),
                    has: name => localVariables.has(name),
                    add: (name, value) => localVariables.set(name, `${localVariables.get(name) ?? ''}${value}`),
                },
            },
        }),
    };
});

afterAll(() => {
    delete global.SillyTavern;
});

beforeEach(() => {
    localVariables.clear();
});

/**
 * @param {string} input
 * @returns {string}
 */
function evaluate(input) {
    return MacroEngine.evaluate(input, { dynamicMacros: {}, functions: { postProcess: x => x } });
}

/**
 * Registers a post-processor for the duration of one callback and records the texts it gets.
 *
 * @param {{ priority: number, source?: string, transform?: (text: string) => string }} options
 * @param {() => void} callback
 * @returns {string[]} The texts the post-processor got, in order.
 */
function withPostProcessor({ priority, source = 'test', transform = text => text }, callback) {
    const seen = [];
    const handler = text => {
        seen.push(text);
        return transform(text);
    };
    MacroEngine.addPostProcessor(handler, { priority, source });
    try {
        callback();
    } finally {
        MacroEngine.removePostProcessor(handler);
    }
    return seen;
}

describe('whitespace marker helpers', () => {
    test('marks {{newline}} and {{space}} output with whitespace markers', () => {
        expect(markWhitespaceMacroResult('newline', '\n')).toBe(`${WHITESPACE_MARKER}\n${WHITESPACE_MARKER}`);
        expect(markWhitespaceMacroResult('space', '  ')).toBe(`${WHITESPACE_MARKER}  ${WHITESPACE_MARKER}`);
    });

    test('does not mark empty {{newline}} or {{space}} output', () => {
        expect(markWhitespaceMacroResult('space', '')).toBe('');
    });

    test('marks {{noop}} output with stop markers', () => {
        expect(markWhitespaceMacroResult('noop', '')).toBe(`${STOP_MARKER}${STOP_MARKER}`);
    });

    test('leaves other macro output unchanged', () => {
        expect(markWhitespaceMacroResult('user', ' User ')).toBe(' User ');
        expect(markWhitespaceMacroResult(undefined, '\n')).toBe('\n');
    });

    test('legacy trim removes whitespace markers with the newlines around {{trim}}', () => {
        expect(applyLegacyTrim(`a\n${WHITESPACE_MARKER}\n${WHITESPACE_MARKER}{{trim}}\nb`)).toBe('ab');
    });

    test('legacy trim stops at a stop marker', () => {
        expect(applyLegacyTrim(`a\n${STOP_MARKER}{{trim}}\nb`)).toBe(`a\n${STOP_MARKER}b`);
    });

    test('strips both marker kinds', () => {
        expect(stripWhitespaceMarkers(`${STOP_MARKER}a${WHITESPACE_MARKER}\n${WHITESPACE_MARKER}b`)).toBe('a\nb');
    });
});

describe('macro engine whitespace', () => {
    describe('explicit whitespace macros survive trims', () => {
        test('{{noop}} stops {{trim}} from removing the newline before it', () => {
            expect(evaluate('foo\n{{noop}}{{trim}}\nbar')).toBe('foo\nbar');
        });

        test('{{noop}} keeps the space in a variable shorthand value', () => {
            expect(evaluate('{{.v1 = foo}}{{.v1 += {{noop}} bar}}{{.v1}}')).toBe('foo bar');
        });

        test('{{newline}} stays in an {{if}} branch', () => {
            expect(evaluate('foo{{if 1}}{{newline}}{{/if}}bar')).toBe('foo\nbar');
        });

        test('{{space}} stays in an {{if}} branch', () => {
            expect(evaluate('a{{if 1}}{{space}}{{/if}}b')).toBe('a b');
        });

        test('{{newline}} stays in an {{else}} branch', () => {
            expect(evaluate('a{{if 0}}x{{else}}{{newline}}{{/if}}b')).toBe('a\nb');
        });

        test('{{newline}} stays in nested {{if}} branches', () => {
            expect(evaluate('{{if 1}}{{if 1}}{{newline}}x{{/if}}{{/if}}')).toBe('\nx');
        });

        test('{{newline}} stays at the start of scoped content', () => {
            expect(evaluate('{{trim}}{{newline}}x  {{/trim}}')).toBe('\nx');
        });

        test('{{space}} stays in a variable shorthand value', () => {
            expect(evaluate('{{.v2 = {{space}}}}[{{.v2}}]')).toBe('[ ]');
        });

        test('{{noop}} protects {{newline}} output from {{trim}}', () => {
            expect(evaluate('a{{newline}}{{noop}}{{trim}}b')).toBe('a\nb');
        });
    });

    describe('other whitespace behaves as before', () => {
        test('{{trim}} removes {{newline}} output next to it', () => {
            expect(evaluate('a{{newline}}{{trim}}b')).toBe('ab');
            expect(evaluate('a{{trim}}{{newline}}b')).toBe('ab');
        });

        test('{{trim}} removes literal newlines next to it', () => {
            expect(evaluate('A\n\n{{trim}}\n\nB')).toBe('AB');
        });

        test('{{trim}} keeps {{space}} output', () => {
            expect(evaluate('a{{space}}{{trim}}b')).toBe('a b');
        });

        test('literal whitespace at the edges of an {{if}} branch is trimmed', () => {
            expect(evaluate('[{{if 1}}\n  x  \n{{/if}}]')).toBe('[x]');
        });

        test('an indented {{if}} block is dedented', () => {
            expect(evaluate('{{if 1}}\n    # Heading\n    {{newline}}Content\n{{/if}}')).toBe('# Heading\n\nContent');
        });

        test('literal whitespace in a variable shorthand value is trimmed', () => {
            expect(evaluate('{{.v3 =   padded   }}[{{.v3}}]')).toBe('[padded]');
        });

        test('{{noop}} alone is an empty string', () => {
            expect(evaluate('a{{noop}}b')).toBe('ab');
        });

        test('{{if}} conditions resolve without markers', () => {
            expect(evaluate('[{{if noop}}T{{else}}F{{/if}}]')).toBe('[F]');
            expect(evaluate('[{{if {{space}}}}T{{else}}F{{/if}}]')).toBe('[T]');
        });

        test('object variable values are still JSON', () => {
            localVariables.set('vobj', { a: 1 });
            expect(evaluate('[{{.vobj}}]')).toBe('[{"a":1}]');
        });
    });

    test('removes marker characters that are in the prompt text', () => {
        expect(evaluate(`a${WHITESPACE_MARKER}${STOP_MARKER}b`)).toBe('ab');
    });

    describe('post-processors', () => {
        const input = 'a{{newline}}b{{if 1}}{{newline}}{{/if}}c';

        for (const priority of [5, 50.5, 100]) {
            test(`a post-processor at priority ${priority} runs on each evaluation and gets no markers`, () => {
                let output;
                const seen = withPostProcessor({ priority }, () => {
                    output = evaluate(input);
                });
                expect(output).toBe('a\nb\nc');
                expect(seen).toEqual(['1', '\n', 'a\nb\nc']);
            });
        }

        test('a post-processor that changes an {{if}} branch gets the branch trimmed as before', () => {
            let output;
            withPostProcessor({ priority: 100, transform: text => text.replace('x', 'y') }, () => {
                output = evaluate('[{{if 1}}{{newline}}x{{/if}}]');
            });
            expect(output).toBe('[y]');
        });

        test('a post-processor between core post-processors runs in priority order', () => {
            const seen = withPostProcessor({ priority: 15 }, () => evaluate('\\{\\{trim\\}\\}'));
            expect(seen).toEqual(['{{trim}}']);
        });
    });
});
