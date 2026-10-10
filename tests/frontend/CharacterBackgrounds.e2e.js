import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

async function openCharacters(page) {
    const drawer = page.locator('#right-nav-panel');
    if (!await drawer.evaluate(element => element.classList.contains('openDrawer'))) {
        await page.locator('#rightNavDrawerIcon').click();
    }
    await expect(drawer).toHaveClass(/openDrawer/);
    await page.locator('#rm_button_characters').click();
    if (!await page.locator('#character_search_bar').isVisible()) {
        await page.locator('#rm_button_search').click();
    }
}

async function importCharacter(page, name) {
    await openCharacters(page);
    await page.locator('#character_search_bar').fill(name);
    const chooser = page.waitForEvent('filechooser');
    await page.locator('#character_import_button').click();
    await (await chooser).setFiles({
        name: `${name}.json`, mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({ name, description: 'Background test fixture', first_mes: 'Background test ready.' })),
    });
    await expect(page.locator('#rm_print_characters_block').getByText(name, { exact: true })).toBeVisible();
}

async function selectCharacter(page, name) {
    await openCharacters(page);
    await page.locator('#character_search_bar').fill(name);
    await page.locator('#rm_print_characters_block .character_select').filter({ has: page.getByText(name, { exact: true }) }).click();
    await expect(page.locator('#rm_button_selected_ch')).toContainText(name);
    await expect(page.locator('#chat .mes')).not.toHaveCount(0);
}

async function openBackgrounds(page, tab = 'character') {
    const drawer = page.locator('#Backgrounds');
    if (!await drawer.evaluate(element => element.classList.contains('openDrawer'))) {
        await page.locator('#backgrounds-drawer-toggle').click();
    }
    await expect(drawer).toHaveClass(/openDrawer/);
    await page.locator(`a[href="#bg_${tab}_tab"]`).click();
}

async function uploadBackground(page, name) {
    const chooser = page.waitForEvent('filechooser');
    await page.locator('#add_background_button_top').click();
    await (await chooser).setFiles({ name, mimeType: 'image/png', buffer: pixel });
}

function characterTile(page, name) {
    return page.locator('#bg_character_content .bg_example').filter({ has: page.getByText(name.replace(/\.png$/, ''), { exact: true }) });
}

test.describe('Character backgrounds', () => {
    // The drawer stores account-wide settings, so these UI flows share one worker.
    test.describe.configure({ mode: 'serial' });
    test.beforeEach(async ({ page }) => {
        const onboarding = page.locator('dialog[open]').filter({ hasText: 'Welcome to SillyTavern!' });
        await page.addLocatorHandler(onboarding, async () => {
            await onboarding.locator('.popup-button-ok').click();
        });
        const embeddedRegex = page.locator('dialog[open]').filter({ hasText: 'This character has embedded regex script(s).' });
        await page.addLocatorHandler(embeddedRegex, async () => {
            await embeddedRegex.locator('.popup-button-cancel').click();
        });
        await testSetup.goST({ page });
        await expect(page.locator('#preloader')).toBeHidden({ timeout: 30000 });
    });

    test('upload, switch, persist, lock, unlock and delete through the drawer', async ({ page }, testInfo) => {
        const name = `BG lifecycle ${Date.now()}`;
        const other = `${name} other`;
        await importCharacter(page, name);
        await importCharacter(page, other);
        await selectCharacter(page, name);
        await openBackgrounds(page, 'global');
        await page.locator('#bg_menu_content [title="_white.jpg"] .thumbnail-clipper').click();
        await expect(page.locator('#bg1')).toHaveCSS('background-image', /_white\.jpg/);
        await openBackgrounds(page);
        await uploadBackground(page, 'Alpha scene.png');
        await expect(characterTile(page, 'Alpha scene.png')).toBeVisible();
        await characterTile(page, 'Alpha scene.png').locator('.thumbnail-clipper').click();
        await expect(page.locator('#bg1')).toHaveCSS('background-image', /Alpha%20scene\.png/);
        await expect(characterTile(page, 'Alpha scene.png')).toHaveClass(/selected-background/);
        await openBackgrounds(page, 'global');
        await page.locator('#bg_menu_content [title="_black.jpg"] .thumbnail-clipper').click();
        await expect(page.locator('#bg1')).toHaveCSS('background-image', /Alpha%20scene\.png/);

        await selectCharacter(page, other);
        await expect(page.locator('#bg1')).toHaveCSS('background-image', /_black\.jpg/);
        await openBackgrounds(page);
        await expect(page.locator('#bg_character_content .bg_example')).toHaveCount(0);
        await selectCharacter(page, name);
        await expect(page.locator('#bg1')).toHaveCSS('background-image', /Alpha%20scene\.png/);

        await openBackgrounds(page, 'chat');
        await uploadBackground(page, 'Chat scene.png');
        const chatTile = page.locator('#bg_custom_content .bg_example').last();
        await expect(chatTile).toBeVisible();
        await chatTile.hover();
        await chatTile.locator('[data-action="lock"]').click();
        await expect(chatTile).toHaveClass(/locked-background/);
        await expect(page.locator('#bg1')).toHaveCSS('background-image', /^url\(".*\/user\/images\//);
        const lockedImage = await page.locator('#bg1').evaluate(element => getComputedStyle(element).backgroundImage);
        await openBackgrounds(page);
        await uploadBackground(page, 'Beta scene.png');
        await expect(characterTile(page, 'Beta scene.png')).toBeVisible();
        await openBackgrounds(page, 'global');
        await page.locator('#bg_menu_content [title="_white.jpg"] .thumbnail-clipper').click({ modifiers: ['Shift'] });
        await expect(page.locator('#bg1')).toHaveCSS('background-image', lockedImage);
        await openBackgrounds(page, 'chat');
        await chatTile.hover();
        await chatTile.locator('[data-action="unlock"]').click();
        await expect(page.locator('#bg1')).toHaveCSS('background-image', /Alpha%20scene\.png/);
        await openBackgrounds(page);
        await characterTile(page, 'Beta scene.png').locator('.thumbnail-clipper').click();
        await expect(page.locator('#bg1')).toHaveCSS('background-image', /Beta%20scene\.png/);

        const saved = page.waitForResponse(response => response.url().endsWith('/api/settings/save') && response.ok());
        await openBackgrounds(page);
        await page.locator('#background_fitting').selectOption('cover');
        await saved;
        await page.reload();
        await page.locator('#preloader').waitFor({ state: 'detached' });
        await selectCharacter(page, name);
        await expect(page.locator('#bg1')).toHaveCSS('background-image', /Beta%20scene\.png/);
        await openBackgrounds(page);
        await page.screenshot({ path: testInfo.outputPath('character-backgrounds.png') });
        await characterTile(page, 'Beta scene.png').hover();
        await characterTile(page, 'Beta scene.png').locator('[data-action="delete"]').click();
        await page.locator('dialog[open] .popup-button-ok').click();
        await expect(characterTile(page, 'Beta scene.png')).toHaveCount(0);
        await expect(page.locator('#bg1')).toHaveCSS('background-image', /_white\.jpg/);
        await expect(characterTile(page, 'Alpha scene.png')).toBeVisible();
    });

    test('sorts by name and age and retains the search filter after upload', async ({ page }) => {
        const name = `BG sort ${Date.now()}`;
        await importCharacter(page, name);
        await selectCharacter(page, name);
        await openBackgrounds(page);
        await uploadBackground(page, 'Zulu old.png');
        await expect(characterTile(page, 'Zulu old.png')).toBeVisible();
        await uploadBackground(page, 'Alpha new.png');
        await expect(characterTile(page, 'Alpha new.png')).toBeVisible();
        const titles = page.locator('#bg_character_content .BGSampleTitle');
        for (const [sort, ordered] of [
            ['az', ['Alpha new', 'Zulu old']],
            ['za', ['Zulu old', 'Alpha new']],
            ['newest', ['Alpha new', 'Zulu old']],
            ['oldest', ['Zulu old', 'Alpha new']],
        ]) {
            await page.locator('#bg-sort').selectOption(sort);
            await expect(titles).toHaveText(ordered);
        }
        await page.locator('#bg-filter').fill('Alpha');
        await expect(characterTile(page, 'Zulu old.png')).toBeHidden();
        await uploadBackground(page, 'Beta hidden.png');
        await expect(characterTile(page, 'Beta hidden.png')).toHaveCount(1);
        await expect(characterTile(page, 'Beta hidden.png')).toBeHidden();
        await expect(characterTile(page, 'Zulu old.png')).toBeHidden();
        await expect(characterTile(page, 'Alpha new.png')).toBeVisible();
        await page.locator('#bg-filter').fill('');
        await expect(characterTile(page, 'Beta hidden.png')).toBeVisible();
    });

    test('loads reserved filename characters and keeps selection when deletion fails', async ({ page }) => {
        const name = `BG # paths ${Date.now()}`;
        const filename = 'Scène #1.png';
        await importCharacter(page, name);
        await selectCharacter(page, name);
        await openBackgrounds(page);
        await uploadBackground(page, filename);
        const tile = characterTile(page, filename);
        await expect(tile).toBeVisible();
        await tile.locator('.thumbnail-clipper').click();
        await expect(page.locator('#bg1')).toHaveCSS('background-image', /^url\(".*Sc%C3%A8ne%20%231\.png"\)$/);
        const backgroundUrl = await page.locator('#bg1').evaluate(element => getComputedStyle(element).backgroundImage.slice(5, -2));
        await expect(await page.request.get(backgroundUrl)).toBeOK();

        const copyName = `Copied background ${Date.now()}`;
        await tile.hover();
        await tile.locator('[data-action="copy"]').click();
        await page.locator('dialog[open] .popup-input').fill(copyName);
        await page.locator('dialog[open] .popup-button-ok').click();
        await openBackgrounds(page, 'global');
        await expect(page.locator('#bg_menu_content .BGSampleTitle').filter({ hasText: copyName })).toBeVisible();
        await openBackgrounds(page);
        await expect(tile).toBeVisible();
        await page.route('**/api/backgrounds/character/delete', route => route.fulfill({ status: 500, body: 'Injected failure' }));
        await tile.hover();
        await tile.locator('[data-action="delete"]').click();
        const failure = page.waitForResponse(response => response.url().endsWith('/api/backgrounds/character/delete'));
        await page.locator('dialog[open] .popup-button-ok').click();
        await failure;
        await expect(page.getByText('Failed to delete background', { exact: true })).toBeVisible();
        await expect(tile).toHaveClass(/selected-background/);
        await expect(page.locator('#bg1')).toHaveCSS('background-image', /Sc%C3%A8ne%20%231\.png/);
    });
});
