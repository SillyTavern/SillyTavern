import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

/**
 * Regression coverage for a cancelled swipe candidate that is discarded.
 *
 * A swipe that produces no candidate is reverted by `endSwipe()`. The chat data
 * and the message DOM are rebuilt, so extensions need a message event after the
 * restore to refresh their state. These tests assert both the event and the DOM
 * state visible from that event's handler.
 */
test.describe('Swipe revert notification', () => {
    test.beforeEach(async ({ page }) => {
        await testSetup.awaitST({ page });
        // Allow the welcome-screen chat to finish its initial render before the
        // in-page fixture replaces the chat buffer.
        // eslint-disable-next-line playwright/no-wait-for-timeout -- wait for the welcome chat's delayed initial render
        await page.waitForTimeout(3000);
    });

    test('notifies once after the restored message is available', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const script = await import('/script.js');
            const { chat, chat_metadata, eventSource, event_types, printMessages, setOnlineStatus, setSendButtonState } = script;

            const text = 'reverted candidate';
            const sendDate = new Date().toISOString();
            chat.length = 0;
            // Mark the chat as non-pristine so swiping past the only candidate
            // regenerates instead of looping the greeting.
            chat_metadata.tainted = true;
            chat.push({
                name: 'Test Character',
                is_user: false,
                is_system: false,
                send_date: sendDate,
                mes: text,
                extra: {},
                swipes: [text],
                swipe_id: 0,
                swipe_info: [{ send_date: sendDate, extra: {} }],
            });

            await printMessages();
            setSendButtonState(false);
            // A connected-model check is not needed for this path. Without a
            // backend, Generate() returns before producing a candidate, which
            // is the same state as cancelling a swipe before any text arrives.
            setOnlineStatus('no_connection');

            const events = [];
            const listener = messageId => {
                const element = document.querySelector(`#chat > .mes[mesid="${messageId}"]`);
                const messageElements = document.querySelectorAll('#chat > .mes');
                events.push({
                    messageId,
                    swipeId: chat[messageId]?.swipe_id,
                    swipeAttribute: element?.getAttribute('swipeid') ?? null,
                    connected: element?.isConnected ?? false,
                    isLastMessage: element === messageElements[messageElements.length - 1],
                    text: element?.querySelector('.mes_text')?.textContent ?? null,
                    counter: element?.querySelector('.swipes-counter')?.textContent?.replace(/\u200b/g, '') ?? null,
                });
            };

            eventSource.on(event_types.MESSAGE_SWIPED, listener);
            try {
                await script.swipe_right();
            } finally {
                eventSource.removeListener(event_types.MESSAGE_SWIPED, listener);
            }

            return {
                events,
                finalSwipeId: chat[0]?.swipe_id,
                finalCounter: document
                    .querySelector('#chat > .mes[mesid="0"] .swipes-counter')
                    ?.textContent?.replace(/\u200b/g, ''),
            };
        });

        // The first event is the new swipe candidate being displayed; the second
        // is the revert. No further event may be emitted for the same restore.
        expect(result.events).toHaveLength(2);

        expect(result.events[0]).toMatchObject({
            messageId: 0,
            swipeId: 1,
            connected: true,
        });
        expect(result.events[0].text).toBe('...');

        expect(result.events[1]).toMatchObject({
            messageId: 0,
            swipeId: 0,
            swipeAttribute: '0',
            connected: true,
            isLastMessage: true,
            counter: '1/1',
            text: 'reverted candidate',
        });

        expect(result.finalSwipeId).toBe(0);
        expect(result.finalCounter).toBe('1/1');
    });

    test('does not add a revert notification to a normal swipe switch', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const script = await import('/script.js');
            const { chat, eventSource, event_types, printMessages, setSendButtonState } = script;

            const sendDate = new Date().toISOString();
            chat.length = 0;
            chat.push({
                name: 'Test Character',
                is_user: false,
                is_system: false,
                send_date: sendDate,
                mes: 'first candidate',
                extra: {},
                swipes: ['first candidate', 'second candidate'],
                swipe_id: 0,
                swipe_info: [{ send_date: sendDate, extra: {} }, { send_date: sendDate, extra: {} }],
            });

            await printMessages();
            setSendButtonState(false);

            const events = [];
            const listener = messageId => {
                const element = document.querySelector(`#chat > .mes[mesid="${messageId}"]`);
                events.push({
                    messageId,
                    swipeId: chat[messageId]?.swipe_id,
                    text: element?.querySelector('.mes_text')?.textContent ?? null,
                });
            };

            eventSource.on(event_types.MESSAGE_SWIPED, listener);
            try {
                // "back" skips the debounced chat save while exercising the
                // normal candidate-switch path. Call swipe() directly because
                // swipe_right() does not forward forceSwipeId.
                const { SWIPE_DIRECTION, SWIPE_SOURCE } = await import('/scripts/constants.js');
                await script.swipe(null, SWIPE_DIRECTION.RIGHT, { source: SWIPE_SOURCE.BACK, forceSwipeId: 1 });
            } finally {
                eventSource.removeListener(event_types.MESSAGE_SWIPED, listener);
            }

            return {
                events,
                finalSwipeId: chat[0]?.swipe_id,
                finalText: document.querySelector('#chat > .mes[mesid="0"] .mes_text')?.textContent ?? null,
            };
        });

        expect(result.events).toHaveLength(1);
        expect(result.events[0]).toMatchObject({
            messageId: 0,
            swipeId: 1,
            text: 'second candidate',
        });
        expect(result.finalSwipeId).toBe(1);
        expect(result.finalText).toBe('second candidate');
    });
});
