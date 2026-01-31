import { test, expect } from '@playwright/test';

test.describe('World Info Entry Rendering', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForFunction(
            'document.getElementById("preloader") === null || document.getElementById("preloader")?.style.display === "none"',
            { timeout: 30000 },
        );
        await page.waitForTimeout(1000);
    });

    test('entries should render when lorebook is selected', async ({ page }) => {
        // Capture console messages for debugging
        const consoleLogs = [];
        const jsErrors = [];
        page.on('console', msg => {
            const text = msg.text();
            if (text.includes('[WI]') || msg.type() === 'error') {
                consoleLogs.push(`${msg.type()}: ${text}`);
            }
        });
        page.on('pageerror', error => {
            jsErrors.push(error.message);
        });

        // Open World Info panel
        const wiButton = page.locator('#world_info_button, .fa-book-atlas').first();
        await wiButton.click();
        await page.waitForTimeout(500);

        // Select Test Lorebook
        const worldSelect = page.locator('#world_editor_select').first();
        await worldSelect.selectOption({ label: 'Test Lorebook' });
        await page.waitForTimeout(1000);

        // Verify entries exist in the entries list (not the template)
        // Use #world_popup_entries_list to avoid selecting template elements
        const entriesList = page.locator('#world_popup_entries_list');
        await expect(entriesList).toBeVisible();

        const entries = entriesList.locator('.world_entry');
        const count = await entries.count();

        // Log diagnostic info if no entries found
        if (count === 0) {
            console.log('WI Console logs:', consoleLogs);
            console.log('JS Errors:', jsErrors);
        }

        expect(count).toBeGreaterThan(0);

        // Verify first entry is visible and has content
        const firstEntry = entries.first();
        await expect(firstEntry).toBeVisible();

        // Verify entry has the form structure
        const entryForm = firstEntry.locator('.world_entry_form');
        await expect(entryForm).toBeVisible();

        // Verify comment textarea exists and is visible
        const commentTextarea = firstEntry.locator('textarea[name="comment"]');
        await expect(commentTextarea).toBeVisible();
    });

    test('entry should expand when toggle is clicked', async ({ page }) => {
        // Capture JS errors
        const jsErrors = [];
        page.on('pageerror', error => {
            jsErrors.push(error.message);
        });

        // Open World Info panel
        const wiButton = page.locator('#world_info_button, .fa-book-atlas').first();
        await wiButton.click();
        await page.waitForTimeout(500);

        // Select Test Lorebook
        const worldSelect = page.locator('#world_editor_select').first();
        await worldSelect.selectOption({ label: 'Test Lorebook' });
        await page.waitForTimeout(1000);

        // Find first entry in the list
        const entriesList = page.locator('#world_popup_entries_list');
        const firstEntry = entriesList.locator('.world_entry').first();
        await expect(firstEntry).toBeVisible();

        // Click the expand toggle
        const expandToggle = firstEntry.locator('.inline-drawer-toggle').first();
        await expandToggle.click();
        await page.waitForTimeout(500);

        // Log errors if any
        if (jsErrors.length > 0) {
            console.log('JS Errors during expansion:', jsErrors);
        }

        // Verify no JS errors occurred (especially require errors)
        expect(jsErrors.filter(e => e.includes('require is not defined'))).toHaveLength(0);

        // Verify the edit form is visible (use .inline-drawer-outlet for the dynamically loaded content)
        const editForm = firstEntry.locator('.inline-drawer-content.inline-drawer-outlet');
        await expect(editForm).toBeVisible();

        // Verify key form controls are present
        const contentTextarea = firstEntry.locator('textarea[name="content"]');
        await expect(contentTextarea).toBeVisible();
    });
});
