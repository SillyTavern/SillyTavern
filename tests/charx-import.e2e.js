import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { CharXParser } from '../src/charx.js';
import { buildSyntheticCharXArchive } from './charx-fixtures.js';

// Run against a disposable data root: these tests import characters and regexes.
// eslint-disable-next-line playwright/no-skipped-test
test.skip(!process.env.ST_CHARX_IMPORT_E2E, 'Requires an isolated SillyTavern server.');

const image = readFileSync(new URL('../public/img/ai4.png', import.meta.url));
const audio = readFileSync(new URL('../public/sounds/silence.mp3', import.meta.url));
// A generated 32x32 teal VP9 clip (0.3 seconds); contains no external content.
const video = readFileSync(new URL('./fixtures/charx-clip.webm', import.meta.url));

async function openApp(page) {
    await page.route('**/*', route => {
        const hostname = new URL(route.request().url()).hostname;
        return ['localhost', '127.0.0.1', '[::1]'].includes(hostname) ? route.continue() : route.abort();
    });
    await page.addLocatorHandler(page.locator('.popup:visible .onboarding'), async () => {
        await page.locator('.popup:visible .popup-button-ok').click();
    });
    await page.goto('/');
    await page.locator('#preloader').waitFor({ state: 'detached' });
    await page.locator('#rightNavHolder .drawer-toggle').click();
    await expect(page.locator('#character_import_button')).toBeVisible();
}

async function importCharacter(page, file) {
    const response = page.waitForResponse(r => r.url().endsWith('/api/characters/import') && r.request().method() === 'POST');
    await page.locator('#character_import_file').setInputFiles(file);
    const imported = await response;
    expect(imported.ok()).toBe(true);
    const result = await imported.json();
    expect(result.error).toBeUndefined();
    return result.file_name;
}

test('imports preserved media paths and renders a user-installed regex shortcut', async ({ page }, testInfo) => {
    const name = `CharX browser ${Date.now()}`;
    const folder = `/characters/${encodeURIComponent(name)}`;
    const assets = [
        { type: 'emotion', name: 'Happy Face.PNG', ext: 'png', archivePath: 'assets/emotion/Happy Face.PNG', content: image },
        { type: 'custom', name: 'Gallery Pose #1.png', ext: 'png', archivePath: 'assets/images/Gallery Pose #1.png', content: image },
        { type: 'custom', name: 'Theme Mix (Lo-Fi).mp3', ext: 'mp3', archivePath: 'assets/audio/Theme Mix (Lo-Fi).mp3', content: audio },
        { type: 'custom', name: 'Reaction Cam 01.webm', ext: 'webm', archivePath: 'assets/video/Reaction Cam 01.webm', content: video },
        { type: 'background', name: 'Forest Dawn.png', ext: 'png', archivePath: 'assets/background/Forest Dawn.png', content: image },
        { type: 'background', name: 'Moving Scene.webm', ext: 'webm', archivePath: 'assets/background/Moving Scene.webm', content: video },
        { type: 'custom', name: 'Character Regex.json', ext: 'json', archivePath: 'assets/json/Character Regex.json', content: '{"version":1}' },
    ];
    const imageUrl = `${folder}/images/Gallery%20Pose%20%231.png`;
    const audioUrl = `${folder}/audio/Theme%20Mix%20(Lo-Fi).mp3`;
    const videoUrl = `${folder}/video/Reaction%20Cam%2001.webm`;
    const firstMessage = `<img width="64" height="64" src="${imageUrl}" alt="CharX gallery"><audio controls src="${audioUrl}"></audio><video controls src="${videoUrl}"></video>`;
    const archive = await buildSyntheticCharXArchive(name, assets, { avatar: image, firstMessage });

    await openApp(page);
    await importCharacter(page, { name: 'media.charx', mimeType: 'application/zip', buffer: archive });
    await page.locator('#rm_button_characters').click();
    await page.locator('.character_select').filter({ has: page.locator('.ch_name', { hasText: name }) }).click();
    const gallery = page.locator('#chat .mes_text img[alt="CharX gallery"]');
    await expect(gallery).toBeVisible();
    await expect.poll(() => gallery.evaluate(element => element.naturalWidth)).toBeGreaterThan(0);
    await expect.poll(() => page.locator('#chat audio').evaluate(element => element.readyState)).toBeGreaterThanOrEqual(1);
    await expect.poll(() => page.locator('#chat video').evaluate(element => element.readyState)).toBeGreaterThanOrEqual(1);

    for (const resource of ['happy-face.png', 'backgrounds/Forest%20Dawn.png', 'backgrounds/Moving%20Scene.webm', 'json/Character%20Regex.json']) {
        const response = await page.request.get(`${folder}/${resource}`);
        expect(response.ok(), resource).toBe(true);
    }

    await page.locator('#extensions-settings-button .drawer-toggle').click();
    await page.locator('.regex_settings .inline-drawer-toggle').click();
    await page.locator('#import_regex_file').setInputFiles({
        name: 'charx-gallery.json', mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({
            scriptName: `CharX gallery ${name}`, findRegex: '/\\[\\[gallery\\]\\]/g',
            replaceString: `<img width="64" height="64" src="${imageUrl}" alt="CharX regex gallery">`,
            trimStrings: [], placement: [1, 2], disabled: false, markdownOnly: true,
            promptOnly: false, runOnEdit: true, substituteRegex: 0, minDepth: null, maxDepth: null,
        })),
    });
    await page.locator('#regex_import_target_global').check();
    await page.locator('.popup:visible .popup-button-ok').click();
    await expect(page.locator('.regex_script_name').filter({ hasText: `CharX gallery ${name}` })).toBeVisible();
    await page.locator('#extensions-settings-button .drawer-toggle').click();
    await page.locator('#send_textarea').fill('/send [[gallery]]');
    await page.locator('#send_textarea').press('Enter');
    const regexImage = page.locator('#chat .mes_text img[alt="CharX regex gallery"]');
    await expect(regexImage).toBeVisible();
    await expect(regexImage).toHaveAttribute('src', imageUrl);
    await expect.poll(() => regexImage.evaluate(element => element.naturalWidth)).toBeGreaterThan(0);
    await page.screenshot({ path: testInfo.outputPath('charx-media-regex.png'), fullPage: true });

    // Malformed archives must fail without breaking the existing chat.
    const failedImport = page.waitForResponse(r => r.url().endsWith('/api/characters/import'));
    await page.locator('#character_import_file').setInputFiles({ name: 'broken.charx', mimeType: 'application/zip', buffer: Buffer.from('not a zip') });
    expect((await (await failedImport).json()).error).toBe(true);
    await expect(page.locator('.toast-error')).toContainText('Could not import character');
    await expect(regexImage).toBeVisible();
});

test('serves literal percent filenames without decoding them twice or allowing traversal', async ({ page }) => {
    const name = `CharX percent ${Date.now()}`;
    const assets = [
        { name: '50%.png', content: image },
        { name: 'literal%20name.png', content: image },
        { name: 'literal name.png', content: Buffer.concat([image, Buffer.from('different asset')]) },
        { name: 'literal%2Fname.png', content: image },
    ].map(asset => ({ ...asset, type: 'custom', ext: 'png', archivePath: `assets/${asset.name}` }));
    const folder = `/characters/${encodeURIComponent(name)}/images`;
    const archive = await buildSyntheticCharXArchive(name, assets, { avatar: image });
    await openApp(page);
    await importCharacter(page, { name: 'percent.charx', mimeType: 'application/zip', buffer: archive });
    for (const asset of assets) {
        const response = await page.request.get(`${folder}/${encodeURIComponent(asset.name)}`);
        expect(response.status(), asset.name).toBe(200);
        expect((await response.body()).equals(asset.content), asset.name).toBe(true);
    }

    // The user settings file exists beside characters, outside this route's root.
    const traversal = await page.request.get('/characters/%2e%2e%2fsettings.json');
    expect(traversal.status()).toBe(403);
    const doubleEncodedTraversal = await page.request.get('/characters/%252e%252e%252fsettings.json');
    expect(doubleEncodedTraversal.status()).toBe(404);
});

// Opt in to local real/synthetic archives without committing private fixtures.
const fixtureDirectory = process.env.ST_CHARX_FIXTURE_DIR;
const fixturePaths = fixtureDirectory
    ? readdirSync(fixtureDirectory, { recursive: true }).filter(name => name.endsWith('.charx')).sort()
    : [];
for (const [index, relativePath] of fixturePaths.entries()) {
    test(`preserves card metadata and asset bytes from local archive ${index + 1}`, async ({ page }) => {
        test.slow();
        const fixture = path.join(fixtureDirectory, relativePath);
        const { card, auxiliaryAssets, extractedBuffers } = await new CharXParser(readFileSync(fixture)).parse();
        await openApp(page);
        const fileName = await importCharacter(page, fixture);
        const { token } = await (await page.request.get('/csrf-token')).json();
        const saved = await page.request.post('/api/characters/get', {
            headers: { 'X-CSRF-Token': token }, data: { avatar_url: `${fileName}.png` },
        });
        expect(saved.ok()).toBe(true);
        const imported = await saved.json();
        // Boolean comparisons keep private card text out of assertion reports.
        expect(JSON.stringify(imported.data.assets) === JSON.stringify(card.data.assets)).toBe(true);
        expect(imported.data.description === card.data.description).toBe(true);
        expect(imported.data.first_mes === card.data.first_mes).toBe(true);
        for (const asset of auxiliaryAssets) {
            const folders = { sprite: '', background: 'backgrounds', image: 'images', audio: 'audio', video: 'video', json: 'json' };
            const url = '/characters/' + [imported.name, folders[asset.storageCategory], `${asset.baseName}.${asset.ext}`]
                .filter(Boolean).map(encodeURIComponent).join('/');
            const response = await page.request.get(url);
            expect(response.ok(), `Asset ${asset.order} is accessible`).toBe(true);
            expect((await response.body()).equals(extractedBuffers.get(asset.zipPath)), `Asset ${asset.order} keeps its bytes`).toBe(true);
        }
    });
}
