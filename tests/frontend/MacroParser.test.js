/** @typedef {import('../../public/lib/chevrotain.js').CstNode} CstNode */

// Those tests ar evaluating via puppeteer, the need more time to run and finish
jest.setTimeout(10_000);

describe('MacroParser', () => {
    beforeAll(async () => {
        await page.goto(global.ST_URL);
        await page.waitForFunction('document.getElementById("preloader") === null', { timeout: 0 });
    });

    describe('General Macro', () => {
        // {{user}}
        it('should parse a simple macro', async () => {
            const input = '{{user}}';
            const cst = await runParser(input);

            const expectedCst = {
                'Macro.Start': '{{',
                'Macro.Identifier': 'user',
                'Macro.End': '}}',
            };

            expect(cst).toEqual(expectedCst);
        });
        // {{  user  }}
        it('should generally handle whitespaces', async () => {
            const input = '{{  user  }}';
            const cst = await runParser(input);

            const expectedCst = {
                'Macro.Start': '{{',
                'Macro.Identifier': 'user',
                'Macro.End': '}}',
            };

            expect(cst).toEqual(expectedCst);
        });
        // {{ macro value }}
        it('should only read one identifier and treat the rest as arguments', async () => {
            const input = '{{ macro value }}';
            const cst = await runParser(input);

            const expectedCst = {
                'Macro.Start': '{{',
                'Macro.Identifier': 'macro',
                'arguments': { 'Identifier': 'value' },
                'Macro.End': '}}',
            };

            expect(cst).toEqual(expectedCst);
        });

        describe('Error Cases (General Macro', () => {
            // {{}}
            it('[Error] should throw an error for empty macro', () => {
                // TODO:
            });
            // {{§!#&blah}}
            it('[Error] should throw an error for invalid identifier', () => {
                // TODO:
            });
            // {{user
            it('[Error] should throw an error for incomplete macro', () => {
                // TODO:
            });
        });
    });
});


/**
 * Runs the input through the MacroParser and returns the result.
 *
 * @param {string} input - The input string to be parsed.
 * @return {Promise<TestableCstNode>} A promise that resolves to the result of the MacroParser.
 */
async function runParser(input) {
    const cst = await page.evaluate(async (input) => {
        /** @type {import('../../public/scripts/macros/MacroParser.js')} */
        const { MacroParser } = await import('./scripts/macros/MacroParser.js');

        const cst = MacroParser.test(input);
        return cst;
    }, input);

    return simplifyCstNode(cst);
}

/** @typedef {{[tokenName: string]: (string|string[]|TestableCstNode|TestableCstNode[])}} TestableCstNode */

/**
 * Simplify the parser syntax tree result into an easily testable format.
 *
 * @param {CstNode} result The result from the parser
 * @returns {TestableCstNode} The testable syntax tree
 */
function simplifyCstNode(cst) {
    /** @returns {TestableCstNode} @param {CstNode} node */
    function simplifyNode(node) {
        if (Array.isArray(node)) {
            // Single-element arrays are converted to a single string
            if (node.length === 1) {
                return node[0].image || simplifyNode(node[0]);
            }
            // For multiple elements, return an array of simplified nodes
            return node.map(simplifyNode);
        }
        if (node.children) {
            const simplifiedChildren = {};
            for (const key in node.children) {
                simplifiedChildren[key] = simplifyNode(node.children[key]);
            }
            return simplifiedChildren;
        }
        return node.image;
    }

    return simplifyNode(cst);
}
