import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test('loads settings after the window load event when an image is slow', async ({ page }) => {
    // Delay only an image, so module loading and DOMContentLoaded proceed normally.
    await page.addInitScript(() => {
        if (location.pathname !== '/') return;
        performance.setResourceTimingBufferSize(2000);
        document.addEventListener('DOMContentLoaded', () => {
            const image = document.createElement('img');
            image.hidden = true;
            image.src = '/test-delayed-image.svg';
            document.body.append(image);
        }, { once: true });
    });
    await page.route('**/test-delayed-image.svg', async route => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' });
    });

    await testSetup.awaitST({ page });
    await finishOnboarding(page);

    const { domReady, imageEnd, load, settingsStart } = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        const resource = path => performance.getEntriesByName(new URL(path, location.href).href, 'resource')[0];
        return {
            domReady: navigation.domContentLoadedEventEnd,
            imageEnd: resource('/test-delayed-image.svg').responseEnd,
            load: navigation.loadEventStart,
            settingsStart: resource('/api/settings/get').startTime,
        };
    });
    expect(imageEnd).toBeGreaterThan(domReady);
    expect(load).toBeGreaterThanOrEqual(imageEnd);
    expect(settingsStart).toBeGreaterThanOrEqual(load);
    const editor = page.locator('#send_textarea');
    await editor.fill('Unsent startup test');
    await expect(editor).toHaveValue('Unsent startup test');
    await editor.fill('');
});

async function finishOnboarding(page) {
    // A fresh account stops at onboarding while a returning account proceeds directly to APP_READY.
    const state = await page.waitForFunction(() => (document.querySelector('dialog[open] .onboarding') && 'onboarding')
        || (window.SillyTavern?.getContext().eventSource.autoFireLastArgs.has('app_ready') && 'ready'));
    if (await state.jsonValue() === 'onboarding') {
        await page.locator('dialog[open]:has(.onboarding) .popup-button-ok').click();
    }
    await page.waitForFunction(() => window.SillyTavern.getContext().eventSource.autoFireLastArgs.has('app_ready'));
}
