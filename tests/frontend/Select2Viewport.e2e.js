import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

async function dropdownBounds(page) {
    return page.evaluate(() => {
        const dropdown = document.querySelector('.select2-dropdown');
        const results = dropdown.querySelector('.select2-results__options');
        const control = document.querySelector('.select2-container--open .select2-selection');
        const rect = element => {
            const { top, bottom, left, height } = element.getBoundingClientRect();
            return { top, bottom, left, height };
        };
        return { dropdown: rect(dropdown), control: rect(control), results: rect(results), scrollHeight: results.scrollHeight };
    });
}

async function expectDropdownFits(page) {
    const bounds = await dropdownBounds(page);
    expect(bounds.dropdown.top).toBeGreaterThanOrEqual(0);
    expect(bounds.dropdown.bottom).toBeLessThanOrEqual(page.viewportSize().height);
    expect(Math.min(
        Math.abs(bounds.dropdown.top - bounds.control.bottom),
        Math.abs(bounds.dropdown.bottom - bounds.control.top),
    )).toBeLessThan(1);
    return bounds;
}

test.describe('Select2 viewport sizing', () => {
    test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 700 });
        await page.route('**/api/settings/get', async route => {
            const response = await route.fetch();
            const data = await response.json();
            data.settings = JSON.stringify({ ...JSON.parse(data.settings), firstRun: false });
            await route.fulfill({ response, json: data });
        });
        await testSetup.awaitST({ page });
        await page.waitForFunction(() => {
            const context = window.SillyTavern?.getContext();
            return context?.eventSource.autoFireLastArgs.has(context.eventTypes.APP_READY);
        });
        await page.locator('#sys-settings-button .drawer-toggle').click();
        await page.locator('#main_api').selectOption('openai');
        await page.locator('#chat_completion_source').selectOption('nanogpt');
        await page.evaluate(() => {
            const select = document.getElementById('model_nanogpt_select');
            select.replaceChildren(...Array.from({ length: 30 }, (_, index) => new Option(`Test NanoGPT Model ${index}`, `test-model-${index}`)));
            jQuery(select).trigger('change');
        });
    });

    for (const height of [500, 700]) {
        test(`keeps NanoGPT results visible and scrollable in a ${height}px viewport`, async ({ page }) => {
            await page.setViewportSize({ width: 1280, height });
            await page.locator('#model_nanogpt_select + .select2 .select2-selection').click();
            const bounds = await expectDropdownFits(page);
            expect(bounds.scrollHeight).toBeGreaterThan(bounds.results.height);
            expect(bounds.results.height).toBeLessThan(300);
            await page.getByRole('option', { name: 'Test NanoGPT Model 29', exact: true }).click();
            await expect(page.locator('#model_nanogpt_select')).toHaveValue('test-model-29');
        });
    }

    test('keeps the normal 300px results height in a tall viewport', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.locator('#model_nanogpt_select + .select2 .select2-selection').click();
        const bounds = await expectDropdownFits(page);
        expect(bounds.results.height).toBe(300);
        expect(bounds.scrollHeight).toBeGreaterThan(bounds.results.height);
    });

    test('repositions when searching reduces and restores the result list', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 500 });
        await page.locator('#model_nanogpt_select + .select2 .select2-selection').click();
        const search = page.locator('.select2-dropdown .select2-search__field');
        await search.fill('Test NanoGPT Model 29');
        await expect(page.locator('.select2-results__option--selectable')).toHaveCount(1);
        const filtered = await expectDropdownFits(page);
        expect(filtered.results.height).toBeLessThan(100);
        await search.fill('');
        await expect(page.locator('.select2-results__option--selectable')).toHaveCount(30);
        const restored = await expectDropdownFits(page);
        expect(restored.results.height).toBeGreaterThan(filtered.results.height);
        expect(restored.scrollHeight).toBeGreaterThan(restored.results.height);
    });

    test('restores the normal height and placement when an open dropdown is resized', async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 500 });
        await page.locator('#model_nanogpt_select + .select2 .select2-selection').click();
        await expectDropdownFits(page);
        await expect(page.locator('.select2-dropdown')).toHaveClass(/select2-dropdown--above/);
        await page.setViewportSize({ width: 1280, height: 900 });
        await expect(page.locator('.select2-dropdown')).toHaveClass(/select2-dropdown--below/);
        const expanded = await expectDropdownFits(page);
        expect(expanded.results.height).toBe(300);
        await page.setViewportSize({ width: 1280, height: 500 });
        await expect(page.locator('.select2-dropdown')).toHaveClass(/select2-dropdown--above/);
        await expectDropdownFits(page);
    });

    for (const multiple of [false, true]) {
        test(`opens ${multiple ? 'multiple' : 'single'} results above an offset dropdown parent`, async ({ page }) => {
            await page.setViewportSize({ width: 1280, height: 500 });
            await page.evaluate(multiple => {
                const parent = jQuery('<div id="select2-test-parent">').css({ position: 'absolute', top: 80, left: 70, width: 280, paddingTop: 220, zIndex: 50000 }).appendTo(document.body);
                const select = jQuery('<select id="select2-test-select">').prop('multiple', multiple).appendTo(parent);
                select.append(Array.from({ length: 30 }, (_, index) => new Option(`Parent option ${index}`, `${index}`)));
                select.select2({ dropdownParent: parent, width: '100%' });
            }, multiple);
            await page.locator('#select2-test-parent .select2-selection').click();
            const bounds = await expectDropdownFits(page);
            await expect(page.locator('.select2-dropdown')).toHaveClass(/select2-dropdown--above/);
            expect(Math.abs(bounds.dropdown.left - bounds.control.left)).toBeLessThan(1);
            expect(bounds.results.height).toBeLessThan(300);
            expect(bounds.scrollHeight).toBeGreaterThan(bounds.results.height);
            await page.getByRole('option', { name: 'Parent option 29', exact: true }).click();
            await expect(page.locator('#select2-test-select option:checked')).toHaveCount(1);
            await expect(page.locator('#select2-test-select option:checked')).toHaveAttribute('value', '29');
        });
    }
});
