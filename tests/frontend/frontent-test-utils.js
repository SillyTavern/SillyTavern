const baseURL = process.env.ST_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8000';

export const testSetup = {
    /**
     * Navigates to the home page without waiting for SillyTavern to load.
     * @param {Object} params
     * @param {import('@playwright/test').Page} params.page
     */
    goST: async ({ page }) => {
        await page.goto('/');
    },

    /**
     * Waits for SillyTavern to fully load by navigating to the home page and waiting for the preloader to disappear.
     * @param {Object} params
     * @param {import('@playwright/test').Page} params.page
     */
    awaitST: async ({ page }) => {
        await page.goto('/');
        const userSelect = page.locator('#userList .userSelect').last();
        if (await userSelect.count()) {
            await userSelect.click();
        }
        await page.waitForURL(url => url.toString().startsWith(baseURL));
        await page.waitForFunction('document.getElementById("preloader") === null', { timeout: 0 });
    },
};
