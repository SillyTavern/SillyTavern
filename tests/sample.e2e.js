describe('sample', () => {
    beforeAll(async () => {
        await page.goto(global.ST_URL);
        await page.waitForFunction('document.getElementById("preloader") === null', { timeout: 0 });
    });

    it('should be titled "SillyTavern"', async () => {
        await expect(page.title()).resolves.toMatch('SillyTavern');
    });
});
