import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

/**
 * @typedef {import('../../public/scripts/message-formatter.js').MessageFormattingContext} MessageFormattingContext
 */

test.describe('MessageFormatter', () => {
    // message-formatter.js imports script.js, which requires the full ST module
    // graph to be settled before dynamic import works (otherwise hits SlashCommandParser TDZ).
    test.beforeEach(testSetup.awaitST);

    // -------------------------------------------------------------------------
    // Module exports & singleton
    // -------------------------------------------------------------------------

    test.describe('Module exports & singleton', () => {
        test('should export formatting_stage with expected keys', async ({ page }) => {
            const stage = await page.evaluate(async () => {
                /** @type {import('../../public/scripts/message-formatter.js')} */
                const { formatting_stage } = await import('./scripts/message-formatter.js');
                return formatting_stage;
            });

            expect(stage).toEqual({
                BEFORE_REGEX: 'beforeRegex',
                AFTER_REGEX: 'afterRegex',
                AFTER_MARKDOWN: 'afterMarkdown',
            });
        });

        test('should export hook_order with expected keys', async ({ page }) => {
            const order = await page.evaluate(async () => {
                /** @type {import('../../public/scripts/message-formatter.js')} */
                const { hook_order } = await import('./scripts/message-formatter.js');
                return hook_order;
            });

            expect(order).toMatchObject({
                EARLIEST: 0,
                EARLY: 10,
                NORMAL: 50,
                LATE: 90,
                LATEST: 100,
            });
        });

        test('should expose stage and order constants on the instance', async ({ page }) => {
            const result = await page.evaluate(async () => {
                /** @type {import('../../public/scripts/message-formatter.js')} */
                const { MessageFormatter, formatting_stage, hook_order } = await import('./scripts/message-formatter.js');
                return {
                    stageMatches: JSON.stringify(MessageFormatter.stage) === JSON.stringify(formatting_stage),
                    orderMatches: JSON.stringify(MessageFormatter.order) === JSON.stringify(hook_order),
                };
            });

            expect(result.stageMatches).toBe(true);
            expect(result.orderMatches).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // addHook — registration validation
    // -------------------------------------------------------------------------

    test.describe('addHook — registration validation', () => {
        test('should throw TypeError when registering a non-function hook', async ({ page }) => {
            const errorMessage = await page.evaluate(async () => {
                /** @type {import('../../public/scripts/message-formatter.js')} */
                const { formatting_stage } = await import('./scripts/message-formatter.js');

                // Use a fresh MessageFormatter instance so we don't pollute the singleton
                const { MessageFormatter: MF } = await import('./scripts/message-formatter.js');
                try {
                    // @ts-ignore intentional misuse
                    MF.addHook('not a function', { stage: formatting_stage.AFTER_MARKDOWN });
                    return null;
                } catch (e) {
                    return { name: e.name, message: e.message };
                }
            });

            expect(errorMessage).not.toBeNull();
            expect(errorMessage.name).toBe('TypeError');
        });

        test('should throw TypeError when registering an async hook', async ({ page }) => {
            const errorMessage = await page.evaluate(async () => {
                /** @type {import('../../public/scripts/message-formatter.js')} */
                const { MessageFormatter } = await import('./scripts/message-formatter.js');
                try {
                    MessageFormatter.addHook(async (mes) => mes);
                    return null;
                } catch (e) {
                    return { name: e.name, message: e.message };
                }
            });

            expect(errorMessage).not.toBeNull();
            expect(errorMessage.name).toBe('TypeError');
            expect(errorMessage.message).toContain('synchronous');
        });

        test('should throw RangeError when registering a hook with an unknown stage', async ({ page }) => {
            const errorMessage = await page.evaluate(async () => {
                /** @type {import('../../public/scripts/message-formatter.js')} */
                const { MessageFormatter } = await import('./scripts/message-formatter.js');
                try {
                    // @ts-ignore intentional misuse
                    MessageFormatter.addHook((mes) => mes, { stage: 'nonExistentStage' });
                    return null;
                } catch (e) {
                    return { name: e.name, message: e.message };
                }
            });

            expect(errorMessage).not.toBeNull();
            expect(errorMessage.name).toBe('RangeError');
            expect(errorMessage.message).toContain('nonExistentStage');
        });

        test('should successfully register a valid synchronous hook', async ({ page }) => {
            const threw = await page.evaluate(async () => {
                /** @type {import('../../public/scripts/message-formatter.js')} */
                const { MessageFormatter } = await import('./scripts/message-formatter.js');
                try {
                    MessageFormatter.addHook((mes) => mes);
                    return false;
                } catch {
                    return true;
                }
            });

            expect(threw).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // runStage — hook execution
    // -------------------------------------------------------------------------

    test.describe('runStage — hook execution', () => {
        /** @type {import('../../public/scripts/message-formatter.js').MessageFormattingBase} */
        const BASE_CTX = { ch_name: 'Test', isSystem: false, isUser: false, messageId: 1, isReasoning: false };

        test('should return the message unchanged when no hooks are registered for a stage', async ({ page }) => {
            // Use a unique tag that no registered hook could produce so the result
            // is deterministic regardless of hooks other tests added to the singleton.
            const TAG = `__mf_test_nohooks_${Date.now()}`;
            const output = await page.evaluate(async ({ base, tag }) => {
                /** @type {import('../../public/scripts/message-formatter.js')} */
                const { MessageFormatter, formatting_stage } = await import('./scripts/message-formatter.js');
                // No hook is registered that would append/modify `tag`, so it must come back unchanged.
                return MessageFormatter.runStage(formatting_stage.AFTER_MARKDOWN, tag, base);
            }, { base: BASE_CTX, tag: TAG });

            expect(output).toBe(TAG);
        });

        test('should apply a registered hook and return the transformed text', async ({ page }) => {
            const TAG = `__mf_test_transform_${Date.now()}`;
            const output = await page.evaluate(async ({ base, tag }) => {
                /** @type {import('../../public/scripts/message-formatter.js')} */
                const { MessageFormatter, formatting_stage } = await import('./scripts/message-formatter.js');
                MessageFormatter.addHook((mes) => mes + tag, { stage: formatting_stage.BEFORE_REGEX });
                return MessageFormatter.runStage(formatting_stage.BEFORE_REGEX, 'hello', base);
            }, { base: BASE_CTX, tag: TAG });

            expect(output).toBe(`hello${TAG}`);
        });

        test('should pass an immutable frozen context to hooks', async ({ page }) => {
            const result = await page.evaluate(async (base) => {
                /** @type {import('../../public/scripts/message-formatter.js')} */
                const { MessageFormatter, formatting_stage } = await import('./scripts/message-formatter.js');

                let receivedCtx = null;
                let isFrozen = false;

                MessageFormatter.addHook((mes, ctx) => {
                    receivedCtx = { ...ctx };
                    isFrozen = Object.isFrozen(ctx);
                    return mes;
                }, { stage: formatting_stage.AFTER_REGEX });

                MessageFormatter.runStage(formatting_stage.AFTER_REGEX, 'text', base);

                return { receivedCtx, isFrozen };
            }, BASE_CTX);

            expect(result.receivedCtx.stage).toBe('afterRegex');
            expect(result.receivedCtx.ch_name).toBe(BASE_CTX.ch_name);
            expect(result.isFrozen).toBe(true);
        });

        test('should inject the correct stage into the context', async ({ page }) => {
            const stages = await page.evaluate(async (base) => {
                /** @type {import('../../public/scripts/message-formatter.js')} */
                const { MessageFormatter, formatting_stage } = await import('./scripts/message-formatter.js');

                const seen = [];
                const hook = (mes, ctx) => { seen.push(ctx.stage); return mes; };

                MessageFormatter.addHook(hook, { stage: formatting_stage.BEFORE_REGEX });
                MessageFormatter.addHook(hook, { stage: formatting_stage.AFTER_REGEX });
                MessageFormatter.addHook(hook, { stage: formatting_stage.AFTER_MARKDOWN });

                MessageFormatter.runStage(formatting_stage.BEFORE_REGEX, 'a', base);
                MessageFormatter.runStage(formatting_stage.AFTER_REGEX, 'b', base);
                MessageFormatter.runStage(formatting_stage.AFTER_MARKDOWN, 'c', base);

                return seen;
            }, BASE_CTX);

            expect(stages).toContain('beforeRegex');
            expect(stages).toContain('afterRegex');
            expect(stages).toContain('afterMarkdown');
        });

        test('should run hooks in ascending order within a stage', async ({ page }) => {
            const TAG = `__mf_test_order_${Date.now()}`;
            const output = await page.evaluate(async ({ base, tag }) => {
                /** @type {import('../../public/scripts/message-formatter.js')} */
                const { MessageFormatter, formatting_stage, hook_order } = await import('./scripts/message-formatter.js');

                MessageFormatter.addHook((mes) => mes + `[late${tag}]`, { stage: formatting_stage.AFTER_MARKDOWN, order: hook_order.LATE });
                MessageFormatter.addHook((mes) => mes + `[early${tag}]`, { stage: formatting_stage.AFTER_MARKDOWN, order: hook_order.EARLY });
                MessageFormatter.addHook((mes) => mes + `[normal${tag}]`, { stage: formatting_stage.AFTER_MARKDOWN, order: hook_order.NORMAL });

                return MessageFormatter.runStage(formatting_stage.AFTER_MARKDOWN, '', base);
            }, { base: BASE_CTX, tag: TAG });

            // early → normal → late
            const earlyIdx = output.indexOf(`[early${TAG}]`);
            const normalIdx = output.indexOf(`[normal${TAG}]`);
            const lateIdx = output.indexOf(`[late${TAG}]`);
            expect(earlyIdx).toBeLessThan(normalIdx);
            expect(normalIdx).toBeLessThan(lateIdx);
        });

        test('should continue pipeline and skip a hook that throws', async ({ page }) => {
            const TAG = `__mf_test_throw_${Date.now()}`;
            const output = await page.evaluate(async ({ base, tag }) => {
                /** @type {import('../../public/scripts/message-formatter.js')} */
                const { MessageFormatter, formatting_stage, hook_order } = await import('./scripts/message-formatter.js');

                // Hook 1: throws
                MessageFormatter.addHook(() => { throw new Error('intentional test error'); }, {
                    stage: formatting_stage.BEFORE_REGEX,
                    order: hook_order.EARLY,
                });
                // Hook 2: appends tag to prove it still ran
                MessageFormatter.addHook((mes) => mes + tag, {
                    stage: formatting_stage.BEFORE_REGEX,
                    order: hook_order.LATE,
                });

                return MessageFormatter.runStage(formatting_stage.BEFORE_REGEX, 'base', base);
            }, { base: BASE_CTX, tag: TAG });

            expect(output).toBe(`base${TAG}`);
        });

        test('should ignore a hook that returns a non-string and keep the previous text', async ({ page }) => {
            const TAG = `__mf_test_nonstring_${Date.now()}`;
            const result = await page.evaluate(async ({ base, tag }) => {
                /** @type {import('../../public/scripts/message-formatter.js')} */
                const { MessageFormatter, formatting_stage, hook_order } = await import('./scripts/message-formatter.js');

                const warnings = [];
                const origWarn = console.warn.bind(console);
                console.warn = (...args) => { warnings.push(args.join(' ')); origWarn(...args); };

                // Hook 1: returns undefined (bad hook)
                MessageFormatter.addHook(() => undefined, {
                    stage: formatting_stage.AFTER_REGEX,
                    order: hook_order.EARLY,
                });
                // Hook 2: valid, appends tag
                MessageFormatter.addHook((mes) => mes + tag, {
                    stage: formatting_stage.AFTER_REGEX,
                    order: hook_order.LATE,
                });

                const output = MessageFormatter.runStage(formatting_stage.AFTER_REGEX, 'original', base);

                console.warn = origWarn;
                return { output, hasWarning: warnings.some(w => w.includes('undefined')) };
            }, { base: BASE_CTX, tag: TAG });

            expect(result.output).toBe(`original${TAG}`);
            expect(result.hasWarning).toBe(true);
        });

        test('should warn and keep text when a hook returns a Promise (simulated async escape)', async ({ page }) => {
            const result = await page.evaluate(async (base) => {
                /** @type {import('../../public/scripts/message-formatter.js')} */
                const { MessageFormatter, formatting_stage } = await import('./scripts/message-formatter.js');

                const warnings = [];
                const origWarn = console.warn.bind(console);
                console.warn = (...args) => { warnings.push(args.join(' ')); origWarn(...args); };

                // Bypasses registration check by wrapping async call inside a sync function
                MessageFormatter.addHook(() => Promise.resolve('sneaky async'), {
                    stage: formatting_stage.BEFORE_REGEX,
                });

                const output = MessageFormatter.runStage(formatting_stage.BEFORE_REGEX, 'safe', base);

                console.warn = origWarn;
                return {
                    output,
                    hasPromiseWarning: warnings.some(w => w.toLowerCase().includes('promise')),
                };
            }, BASE_CTX);

            expect(result.output).toBe('safe');
            expect(result.hasPromiseWarning).toBe(true);
        });
    });
});
