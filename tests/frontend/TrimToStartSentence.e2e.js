import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test.describe('trimToStartSentence', () => {
    test.beforeEach(testSetup.awaitST);

    test('should trim to the start of the first full sentence', async ({ page }) => {
        const output = await page.evaluate(async () => {
            const { trimToStartSentence } = await import('./scripts/utils.js');
            return [
                trimToStartSentence('Hello, world. I am from'),
                trimToStartSentence('Hello, world! I am from'),
                trimToStartSentence('Hello, world? I am from'),
                trimToStartSentence('Hello, world\nI am from'),
                trimToStartSentence('Hello, world!I am from'),
                trimToStartSentence('Hello, world! And more. I am from'),
                trimToStartSentence('Hello world'),
                trimToStartSentence(''),
            ];
        });

        expect(output).toEqual([
            'I am from',
            'I am from',
            'I am from',
            'I am from',
            'I am from',
            'And more. I am from',
            'Hello world',
            '',
        ]);
    });
});
