/** @typedef {import('../../public/lib/chevrotain.js').CstNode} CstNode */
/** @typedef {import('../../public/lib/chevrotain.js').IRecognitionException} IRecognitionException */

/** @typedef {{[tokenName: string]: (string|string[]|TestableCstNode|TestableCstNode[])}} TestableCstNode */
/** @typedef {{name: string, message: string}} TestableRecognitionException */

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
            const macroCst = await runParser(input);

            const expectedCst = {
                'Macro.Start': '{{',
                'Macro.Identifier': 'user',
                'Macro.End': '}}',
            };

            expect(macroCst).toEqual(expectedCst);
        });
        // {{  user  }}
        it('should generally handle whitespaces', async () => {
            const input = '{{  user  }}';
            const macroCst = await runParser(input);

            const expectedCst = {
                'Macro.Start': '{{',
                'Macro.Identifier': 'user',
                'Macro.End': '}}',
            };

            expect(macroCst).toEqual(expectedCst);
        });
        // {{ macro value }}
        it('should only read one identifier and treat the rest as arguments', async () => {
            const input = '{{ macro value }}';
            const macroCst = await runParser(input);

            const expectedCst = {
                'Macro.Start': '{{',
                'Macro.Identifier': 'macro',
                'arguments': { 'Identifier': 'value' },
                'Macro.End': '}}',
            };

            expect(macroCst).toEqual(expectedCst);
        });

        describe('Error Cases (General Macro', () => {
            // {{}}
            it('[Error] should throw an error for empty macro', async () => {
                const input = '{{}}';
                const { macroCst, errors } = await runParserAndGetErrors(input);

                const expectedErrors = [
                    { name: 'MismatchedTokenException', message: 'Expecting token of type --> Macro.Identifier <-- but found --> \'}}\' <--' },
                ];

                expect(errors).toEqual(expectedErrors);
                expect(macroCst).toBeUndefined();
            });
            // {{§!#&blah}}
            it('[Error] should throw an error for invalid identifier', async () => {
                const input = '{{§!#&blah}}';
                const { macroCst, errors } = await runParserAndGetErrors(input);

                const expectedErrors = [
                    { name: 'MismatchedTokenException', message: 'Expecting token of type --> Macro.Identifier <-- but found --> \'!\' <--' },
                ];

                expect(errors).toEqual(expectedErrors);
                expect(macroCst).toBeUndefined();
            });
            // {{user
            it('[Error] should throw an error for incomplete macro', async () => {
                const input = '{{user';
                const { macroCst, errors } = await runParserAndGetErrors(input);

                const expectedErrors = [
                    { name: 'MismatchedTokenException', message: 'Expecting token of type --> Macro.End <-- but found --> \'\' <--' },
                ];

                expect(errors).toEqual(expectedErrors);
                expect(macroCst).toBeUndefined();
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
    const { cst, errors } = await runParserAndGetErrors(input);

    // Make sure that parser errors get correctly marked as errors during testing, even if the resulting structure might work.
    // If we don't test for errors, the test should fail.
    if (errors.length > 0) {
        throw new Error('Parser errors found\n' + errors.map(x => x.message).join('\n'));
    }

    return cst;
}

/**
 * Runs the input through the MacroParser and returns the syntax tree result and any parser errors.
 *
 * Use `runParser` if you don't want to explicitly test against parser errors.
 *
 * @param {string} input - The input string to be parsed.
 * @return {Promise<{cst: TestableCstNode, errors: TestableRecognitionException[]}>} A promise that resolves to the result of the MacroParser and error list.
 */
async function runParserAndGetErrors(input) {
    const result = await page.evaluate(async (input) => {
        /** @type {import('../../public/scripts/macros/MacroParser.js')} */
        const { MacroParser } = await import('./scripts/macros/MacroParser.js');

        const result = MacroParser.test(input);
        return result;
    }, input);

    return { cst: simplifyCstNode(result.cst), errors: simplifyErrors(result.errors) };
}

/**
 * Simplify the parser syntax tree result into an easily testable format.
 *
 * @param {CstNode} result The result from the parser
 * @returns {TestableCstNode} The testable syntax tree
 */
function simplifyCstNode(cst) {
    /** @returns {TestableCstNode} @param {CstNode} node */
    function simplifyNode(node) {
        if (!node) return node;
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


/**
 * Simplifies a recognition exceptions into an easily testable format.
 *
 * @param {IRecognitionException[]} errors - The error list containing exceptions to be simplified.
 * @return {TestableRecognitionException[]} - The simplified error list
 */
function simplifyErrors(errors) {
    return errors.map(exception => ({
        name: exception.name,
        message: exception.message,
    }));
}
