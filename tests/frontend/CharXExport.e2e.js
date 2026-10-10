import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import { read as readCard } from '../../src/character-card-parser.js';
import { buildSyntheticCharXArchive } from '../charx-fixtures.js';

// Use disposable data roots. A second server proves reimport cannot reuse source media.
// eslint-disable-next-line playwright/no-skipped-test
test.skip(!process.env.ST_CHARX_EXPORT_E2E, 'Requires isolated SillyTavern servers.');
const roundtripURL = process.env.ST_CHARX_ROUNDTRIP_URL;
const realFixtures = JSON.parse(process.env.ST_CHARX_EXPORT_FIXTURES || '[]');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const normalizeText = text => text.replace(/\r\n?/g, '\n');
const archivePath = asset => asset.uri.replace(/^embeded:\/\//, '');

async function openApp(page, url = '/') {
    page.setDefaultTimeout(15000);
    await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
    await page.addLocatorHandler(page.locator('dialog[open]').filter({ hasText: 'This character has embedded regex script(s).' }), async dialog => {
        await dialog.locator('.popup-button-cancel').click();
    });
    await page.addLocatorHandler(page.locator('dialog[open]').filter({ hasText: 'This character has an embedded World/Lorebook.' }), async dialog => {
        await dialog.locator('.popup-button-cancel').click();
    });
    await page.addLocatorHandler(page.locator('dialog[open]').filter({ has: page.getByRole('button', { name: 'Import All', exact: true }) }), async dialog => {
        await dialog.getByRole('button', { name: 'Import All', exact: true }).click();
    });
    await page.goto(url);
    await expect(page.locator('#preloader')).toHaveCount(0, { timeout: 60000 });
    const onboarding = page.locator('dialog:visible .popup-input');
    if (await onboarding.isVisible()) {
        await onboarding.fill('CharX Export Tester');
        await page.locator('dialog:visible .popup-button-ok').click();
    }
}

async function selectCharacter(page, name) {
    if (await page.locator('#rightNavDrawerIcon').evaluate(element => element.classList.contains('closedIcon'))) {
        await page.locator('#rightNavDrawerIcon').click();
    }
    await page.locator('#rm_button_characters').click();
    if (!await page.locator('#character_search_bar').isVisible()) {
        await page.locator('#rm_button_search').click();
    }
    await page.locator('#character_search_bar').fill(name);
    await page.locator('#rm_print_characters_block .character_select').filter({ hasText: name }).last().click();
    await expect(page.locator('#export_button').first()).toBeVisible();
}

async function importArchive(page, archive, name) {
    const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/characters/import'));
    await page.locator('#character_import_file').setInputFiles(archive);
    const response = await responsePromise;
    expect(response.ok()).toBe(true);
    expect((await response.json()).error).toBeUndefined();
    await expect(page.locator('#character_import_file')).toHaveValue('', { timeout: 30000 });
    await selectCharacter(page, name);
}

async function openManager(page) {
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    if (await page.locator('#rightNavDrawerIcon').evaluate(element => element.classList.contains('closedIcon'))) {
        await page.locator('#rightNavDrawerIcon').click();
    }
    await page.locator('#export_button').first().click();
    await page.locator('#manage_charx_media').click();
    await expect(page.locator('#charx_generate_regex')).toBeVisible();
}

async function saveManager(page) {
    await page.locator('dialog:visible .popup-button-ok').click();
    await expect(page.locator('#charx_generate_regex')).toHaveCount(0);
    await expect(page.locator('.toast-success').filter({ hasText: 'CharX media export settings saved.' }).last()).toBeVisible();
}

async function downloadArchive(page, testInfo, name) {
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    if (await page.locator('#rightNavDrawerIcon').evaluate(element => element.classList.contains('closedIcon'))) {
        await page.locator('#rightNavDrawerIcon').click();
    }
    await page.locator('#export_button').first().click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('.export_format[data-format="charx"]').click();
    const download = await downloadPromise;
    const target = testInfo.outputPath(name);
    await download.saveAs(target);
    const files = unzipSync(readFileSync(target));
    const card = JSON.parse(strFromU8(files['card.json']));
    expect(card.spec).toBe('chara_card_v3');
    const avatar = JSON.parse(readCard(Buffer.from(files['assets/icon/images/main.png'])));
    expect(avatar.fav).toBe(false);
    expect(avatar.data.extensions.fav).toBe(false);
    expect(avatar.chat).toBeUndefined();
    for (const asset of card.data.assets) {
        expect(files[archivePath(asset)]).toBeDefined();
    }
    return { target, files, card };
}

async function roundtrip(browser, exported, testInfo) {
    if (!roundtripURL) return;
    const context = await browser.newContext({ baseURL: roundtripURL });
    try {
        const page = await context.newPage();
        await openApp(page, roundtripURL);
        await importArchive(page, exported.target, exported.card.data.name);
        for (const script of exported.card.data.extensions.regex_scripts.filter(script => script.scriptName.startsWith('CharX media: '))) {
            const asset = exported.card.data.assets.find(asset => script.scriptName === `CharX media: ${asset.name}`);
            const response = await page.request.get(script.replaceString);
            expect(response.ok()).toBe(true);
            expect(hash(await response.body())).toBe(hash(exported.files[archivePath(asset)]));
        }
        const second = await downloadArchive(page, testInfo, 'second.charx');
        expect(second.card.data.assets).toEqual(exported.card.data.assets);
        expect(second.card.data.extensions.charx_media).toEqual(exported.card.data.extensions.charx_media);
        for (const asset of exported.card.data.assets.filter(asset => asset.type !== 'icon')) {
            expect(hash(second.files[archivePath(asset)])).toBe(hash(exported.files[archivePath(asset)]));
        }
    } finally {
        await context.close();
    }
}

test.describe('CharX media manager and export', () => {
    test('persists controls and downloads a byte-preserving archive', async ({ page, browser }, testInfo) => {
        test.setTimeout(120000);
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        const name = `CharX Export ${Date.now()}`;
        const files = unzipSync(await buildSyntheticCharXArchive(name));
        files['assets/icon/images/main.png'] = readFileSync(new URL('../../public/img/ai4.png', import.meta.url));
        const originalCard = JSON.parse(strFromU8(files['card.json']));
        files['assets/other/images/Second Gallery.webp'] = strToU8('second-gallery');
        originalCard.data.assets.push({ type: 'other', name: 'Second Gallery.webp', ext: 'webp', uri: 'embeded://assets/other/images/Second Gallery.webp' });
        files['assets/other/images/50%.webp'] = strToU8('percent-gallery');
        originalCard.data.assets.push({ type: 'other', name: '50%.webp', ext: 'webp', uri: 'embeded://assets/other/images/50%.webp' });
        originalCard.data.extensions.custom_roundtrip = { nested: ['kept', 42] };
        originalCard.data.description = 'A local synthetic export fixture.';
        files['card.json'] = strToU8(JSON.stringify(originalCard));
        await openApp(page);
        await importArchive(page, { name: `${name}.charx`, mimeType: 'application/zip', buffer: Buffer.from(zipSync(files)) }, name);
        await page.locator('#favorite_button').click();
        await expect(page.locator('#favorite_button')).toHaveClass(/fav_on/);
        await openManager(page);
        await expect(page.locator('[data-source-path]')).toHaveCount(10);
        const gallery = page.locator('[data-source-path$="/images/Gallery Pose A.webp"]');
        const secondGallery = page.locator('[data-source-path$="/images/Second Gallery.webp"]');
        const json = page.locator('[data-source-path$="/json/Character Regex.json"]');
        await gallery.locator('input[type="text"]').fill('Cancelled.webp');
        await page.locator('#charx_generate_regex').uncheck();
        await page.locator('dialog:visible .popup-button-cancel').click();
        await openManager(page);
        await expect(gallery.locator('input[type="text"]')).toHaveValue('Gallery Pose A.webp');
        await expect(page.locator('#charx_generate_regex')).toBeChecked();
        await secondGallery.locator('input[type="text"]').fill('Gallery Pose A.webp');
        await saveManager(page);
        await page.locator('#rightNavDrawerIcon.closedIcon').click();
        await page.locator('#export_button').first().click();
        const collisionResponse = page.waitForResponse(response => response.url().endsWith('/api/characters/export'));
        await page.locator('.export_format[data-format="charx"]').click();
        expect((await collisionResponse).status()).toBe(400);
        await expect(page.locator('.toast-error').filter({ hasText: 'Duplicate CharX archive path' })).toBeVisible();
        await openManager(page);
        await secondGallery.locator('input[type="text"]').fill('Second Gallery.webp');
        await gallery.locator('input[type="text"]').fill('Gallery Final.webp');
        await json.locator('input[type="checkbox"]').uncheck();
        await page.locator('#charx_generate_regex').uncheck();
        await saveManager(page);
        await page.reload();
        await expect(page.locator('#preloader')).toHaveCount(0);
        await selectCharacter(page, name);
        await openManager(page);
        await expect(gallery.locator('input[type="text"]')).toHaveValue('Gallery Final.webp');
        await expect(json.locator('input[type="checkbox"]')).not.toBeChecked();
        await expect(page.locator('#charx_generate_regex')).not.toBeChecked();
        await page.locator('#charx_generate_regex').check();
        await page.screenshot({ path: testInfo.outputPath('manager-desktop.png') });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: testInfo.outputPath('manager-mobile.png') });
        await page.setViewportSize({ width: 1280, height: 720 });
        await saveManager(page);
        const exported = await downloadArchive(page, testInfo, 'synthetic.charx');
        expect(exported.card.data.extensions.custom_roundtrip).toEqual(originalCard.data.extensions.custom_roundtrip);
        expect(hash(strToU8(normalizeText(exported.card.data.description)))).toBe(hash(strToU8(normalizeText(originalCard.data.description))));
        expect(exported.card.data.assets).toHaveLength(10);
        expect(exported.files['assets/other/other/Character Regex.json']).toBeUndefined();
        expect(hash(exported.files['assets/other/images/Gallery Final.webp'])).toBe(hash(files['assets/other/images/Gallery Pose A.webp']));
        const hashes = new Set(Object.values(files).map(hash));
        for (const asset of exported.card.data.assets.filter(asset => asset.type !== 'icon')) {
            expect(hashes.has(hash(exported.files[archivePath(asset)]))).toBe(true);
        }
        expect(errors).toEqual([]);
        await roundtrip(browser, exported, testInfo);
    });

    for (const fixture of realFixtures) {
        test(`round-trips local fixture ${path.basename(fixture)}`, async ({ page, browser }, testInfo) => {
            test.setTimeout(240000);
            const fixtureBytes = readFileSync(fixture);
            const zipStart = fixtureBytes.indexOf(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
            const originalFiles = unzipSync(fixtureBytes.subarray(Math.max(0, zipStart)));
            const originalCard = JSON.parse(strFromU8(originalFiles['card.json']));
            const name = originalCard.data.name;
            await openApp(page);
            await importArchive(page, fixture, name);
            await openManager(page);
            const count = await page.locator('[data-source-path]').count();
            expect(count).toBeGreaterThan(0);
            await page.locator('dialog:visible .popup-button-cancel').click();
            const exported = await downloadArchive(page, testInfo, 'local-fixture.charx');
            expect(exported.card.data.assets).toHaveLength(count + 1);
            expect(hash(strToU8(normalizeText(exported.card.data.description)))).toBe(hash(strToU8(normalizeText(originalCard.data.description))));
            expect(hash(strToU8(normalizeText(exported.card.data.first_mes)))).toBe(hash(strToU8(normalizeText(originalCard.data.first_mes))));
            const hashes = new Set(Object.values(originalFiles).map(hash));
            for (const asset of exported.card.data.assets.filter(asset => asset.type !== 'icon')) {
                expect(hashes.has(hash(exported.files[archivePath(asset)]))).toBe(true);
            }
            await roundtrip(browser, exported, testInfo);
        });
    }
});
