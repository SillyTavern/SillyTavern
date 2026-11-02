import { test, expect } from '@playwright/test';

test.describe('minimal interface', () => {
    test.describe.configure({ mode: 'serial' });

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForFunction(() => document.body.classList.contains('simple-ui-active') || document.body.classList.contains('simple-ui-advanced'));
        await page.evaluate(() => window.simpleUiBridge.setMode('minimal'));
        await expect(page.locator('body')).toHaveClass(/simple-ui-active/);
        await expect(page.locator('#simple-ui-root .su-brand')).toBeVisible();
    });

    test('switches minimal and advanced interfaces in one runtime', async ({ page }) => {
        const root = page.locator('#simple-ui-root');
        await expect(root).toBeVisible();
        await expect(root.locator('.su-brand')).toContainText('EasierTavern');
        await expect(page.locator('#simple-ui-engine')).toHaveCount(0);
        await expect(page.locator('#rightNavDrawerIcon')).toHaveCount(1);
        const initialURL = page.url();

        await root.locator('[data-view="settings"]').click();
        await root.locator('[data-action="settings-section"][data-section="advanced"]').click();
        await root.locator('[data-action="advanced"]').click();
        await expect(page.locator('body')).toHaveClass(/simple-ui-advanced/);
        await expect(root).toBeHidden();
        expect(page.url()).toBe(initialURL);
        await expect(page.locator('#simple-ui-enable-button')).toHaveCount(1);

        await page.locator('#simple-ui-enable-button').first().evaluate(button => button.click());
        await expect(page.locator('body')).toHaveClass(/simple-ui-active/);
        await expect(root).toBeVisible();
        expect(page.url()).toBe(initialURL);
    });

    test('keeps canonical advanced drawers and editors functional', async ({ page }) => {
        await page.evaluate(() => window.simpleUiBridge.setMode('advanced'));
        await expect(page.locator('body')).toHaveClass(/simple-ui-advanced/);

        await page.locator('#backgrounds-drawer-toggle').click();
        await expect(page.locator('#Backgrounds')).toHaveClass(/openDrawer/);
        await expect(page.locator('#bg_menu_content')).toBeVisible();
        await page.locator('#backgrounds-drawer-toggle').click();

        await page.locator('#leftNavDrawerIcon').click();
        await expect(page.locator('#left-nav-panel')).toHaveClass(/openDrawer/);
        await page.locator('.inline-drawer:has(#main_prompt_quick_edit_textarea) > .inline-drawer-toggle').click();
        const promptExpander = page.locator('.editor_maximize[data-for="main_prompt_quick_edit_textarea"]');
        await promptExpander.scrollIntoViewIfNeeded();
        await promptExpander.click();
        await expect(page.locator('dialog.popup[open] .maximized_textarea')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.locator('dialog.popup[open]')).toHaveCount(0);

        await page.locator('#persona-management-button .drawer-toggle').click();
        await expect(page.locator('#PersonaManagement')).toHaveClass(/openDrawer/);
        const selectedPersona = page.locator('#user_avatar_block .avatar-container.selected');
        if (await selectedPersona.count()) {
            const expectedName = (await selectedPersona.locator('.ch_name').textContent())?.trim();
            await selectedPersona.click();
            await expect(page.locator('#your_name')).toHaveText(expectedName || '');
        }
        await page.locator('#persona-management-button .drawer-toggle').click();

        await page.locator('#WIDrawerIcon').click();
        await expect(page.locator('#WorldInfo')).toHaveClass(/openDrawer/);
        const lorebookOption = page.locator('#world_editor_select option:not([value=""])').first();
        if (await lorebookOption.count()) {
            await page.locator('#world_editor_select').selectOption(await lorebookOption.getAttribute('value'));
            await expect(page.locator('#world_popup_entries_list .world_entry').first()).toBeAttached();
        }
        await page.locator('#WIDrawerIcon').click();

        await page.locator('#rightNavDrawerIcon').click();
        const character = page.locator('#rm_print_characters_block .character_select').first();
        if (await character.count()) {
            const expectedName = (await character.locator('.ch_name').textContent())?.trim();
            await character.click();
            await expect(page.locator('#rm_ch_create_block')).toBeVisible();
            await expect(page.locator('#character_name_pole')).toHaveValue(expectedName || '');
            await page.locator('#advanced_div').click();
            await expect(page.locator('#character_popup')).toBeVisible();
            await page.locator('#character_cross').click();
        }
    });

    test('uses mobile bottom navigation', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        const sidebar = page.locator('#simple-ui-root .su-sidebar');
        await expect(sidebar).toBeVisible();
        await expect(sidebar).toHaveCSS('position', 'fixed');
        const charactersButton = page.locator('#simple-ui-root .su-sidebar [data-view="characters"]');
        await expect(charactersButton).toBeVisible();
        const buttonBox = await charactersButton.boundingBox();
        expect(buttonBox?.y).toBeLessThan(844);
        await charactersButton.evaluate(button => button.click());
        await expect(page.locator('#simple-ui-root h1')).toContainText(/Characters|Karakterler/);
        const mobileHome = page.locator('#simple-ui-root .su-brand[data-view="home"]');
        await expect(mobileHome).toBeVisible();
        await mobileHome.click();
        await expect(page.locator('#simple-ui-root .su-welcome')).toBeVisible();
    });

    test('uses the simplified sidebar and nearly full-width desktop content', async ({ page }) => {
        await page.setViewportSize({ width: 1600, height: 900 });
        const root = page.locator('#simple-ui-root');
        await expect(root.locator('.su-private')).toHaveCount(0);
        await expect(root.locator('.su-account')).toHaveCount(0);
        await expect(root.locator('.su-sidebar nav [data-view="home"]')).toHaveCount(0);
        await expect(root.locator('.su-topbar')).toHaveCount(0);
        await expect(root.locator('.su-content > .su-content-tools')).toHaveCount(0);
        await expect(root.locator('.su-sidebar-utilities [data-view="home"]')).toHaveCount(0);
        await expect(root.locator('.su-sidebar-status')).toBeVisible();
        const sidebarToggle = root.locator('.su-sidebar-status [data-action="toggle-sidebar"]');
        await expect(sidebarToggle).toBeVisible();
        if (await root.locator('.su-shell').evaluate(element => element.classList.contains('sidebar-collapsed'))) {
            await sidebarToggle.click();
            await expect(root.locator('.su-shell')).not.toHaveClass(/sidebar-collapsed/);
        }
        await expect(sidebarToggle.locator('.fa-angles-left')).toHaveCount(1);
        await expect(sidebarToggle).not.toContainText(/Collapse|küçült/);

        const mainBox = await root.locator('.su-main').boundingBox();
        const contentBox = await root.locator('.su-content').boundingBox();
        expect(mainBox).not.toBeNull();
        expect(contentBox).not.toBeNull();
        expect(mainBox.width - contentBox.width).toBeLessThanOrEqual(70);

        await root.locator('.su-sidebar [data-action="toggle-sidebar"]').click();
        await expect(root.locator('.su-shell')).toHaveClass(/sidebar-collapsed/);
        await expect(root.locator('.su-sidebar')).toBeVisible();
        const collapsedWidth = await root.locator('.su-sidebar').evaluate(element => element.getBoundingClientRect().width);
        expect(collapsedWidth).toBeGreaterThanOrEqual(70);
        expect(collapsedWidth).toBeLessThanOrEqual(76);
        await expect(root.locator('.su-sidebar nav [data-view="characters"] > span')).toBeVisible();
        await expect(root.locator('.su-sidebar nav [data-view="characters"] > b')).toBeHidden();
        await root.locator('.su-sidebar [data-action="toggle-sidebar"]').click();
        await expect(root.locator('.su-shell')).not.toHaveClass(/sidebar-collapsed/);
    });

    test('shows advanced-equivalent character and profile fields', async ({ page }) => {
        const root = page.locator('#simple-ui-root');
        await root.locator('.su-sidebar [data-view="characters"]').click();
        await root.locator('[data-action="new-character"]').click();
        const characterForm = root.locator('form[data-form="character"]');
        for (const name of ['alternateGreetings', 'systemPrompt', 'postHistoryInstructions', 'depthPrompt', 'primaryLorebook']) {
            await expect(characterForm.locator(`[name="${name}"]`)).toHaveCount(1);
        }
        await expect(characterForm.locator('.su-lore-choice-list')).toHaveCount(1);
        for (const name of ['creator', 'characterVersion', 'creatorNotes']) {
            await expect(characterForm.locator(`[name="${name}"]`)).toHaveCount(0);
        }
        const sections = await characterForm.locator('details > summary').allTextContents();
        expect(sections[0]).toMatch(/Character definition|Karakter tanımı/);
        expect(sections[1]).toMatch(/Lorebook connections|Lorebook bağlantıları/);
        expect(sections[2]).toMatch(/Advanced prompts|Gelişmiş promptlar/);
        await expect(characterForm.locator('details').first()).not.toHaveAttribute('open', '');
        await root.locator('[data-action="close-modal"]').click();

        await root.locator('.su-sidebar [data-view="profiles"]').click();
        await root.locator('[data-action="new-persona"]').click();
        const personaForm = root.locator('form[data-form="persona"]');
        for (const name of ['image', 'name', 'title', 'description', 'position', 'depth', 'role', 'lorebook']) {
            await expect(personaForm.locator(`[name="${name}"]`)).toHaveCount(1);
        }
        await personaForm.locator('[name="position"]').selectOption('4');
        await expect(personaForm.locator('.su-persona-depth')).not.toHaveClass(/is-hidden/);
    });

    test('renders provider models with saved-key status support', async ({ page }) => {
        const root = page.locator('#simple-ui-root');
        await root.locator('.su-sidebar [data-view="settings"]').click();
        await expect(root.locator('.su-settings-card')).toHaveCount(4);
        await root.locator('[data-action="settings-section"][data-section="connection"]').click();
        const connectionForm = root.locator('form[data-form="connection"]');
        await expect(connectionForm.locator('[name="provider"]')).toHaveCount(1);
        await expect(connectionForm.locator('[name="model"]')).toHaveCount(1);
        await expect(connectionForm.locator('.su-input-status')).toHaveCount(1);
        await expect(connectionForm.locator('[name="autoConnect"]')).toBeChecked();
        const favoriteModels = connectionForm.locator('.su-favorite-models');
        if (await favoriteModels.count()) {
            await expect(favoriteModels.locator('[data-favorite-search]')).toBeVisible();
            await expect(favoriteModels.locator('input[name="favoriteModels"]')).toHaveCount(await connectionForm.locator('[name="model"] option').count());
            expect((await favoriteModels.boundingBox())?.width).toBeLessThanOrEqual(861);
            const firstFavoriteCheckbox = favoriteModels.locator('input[name="favoriteModels"]').first();
            if (await firstFavoriteCheckbox.count()) {
                const firstFavoriteRow = favoriteModels.locator('.su-favorite-model-list > label').first();
                await expect(firstFavoriteRow).toHaveCSS('display', 'flex');
                const checkboxBox = await firstFavoriteCheckbox.boundingBox();
                const textBox = await firstFavoriteRow.locator('span').boundingBox();
                expect(checkboxBox?.width).toBeLessThanOrEqual(18);
                expect(checkboxBox?.height).toBeLessThanOrEqual(18);
                expect(Math.abs(((checkboxBox?.y || 0) + (checkboxBox?.height || 0) / 2) - ((textBox?.y || 0) + (textBox?.height || 0) / 2))).toBeLessThanOrEqual(3);
            }
        }
        await root.locator('[data-action="settings-home"]').click();
        await root.locator('[data-action="settings-section"][data-section="ai"]').click();
        const aiFeatures = root.locator('.su-ai-features');
        await expect(aiFeatures).toBeVisible();
        if (await aiFeatures.locator('[name="chatCompletionPreset"]').count()) {
            await expect(aiFeatures.locator('[data-action="edit-preset"]')).toHaveCount(1);
            await expect(aiFeatures.locator('form[data-form="preset-save-as"]')).toHaveCount(1);
        }
    });

    test('splits settings into compact category views', async ({ page }) => {
        const root = page.locator('#simple-ui-root');
        await root.locator('.su-sidebar [data-view="settings"]').click();
        const cards = root.locator('.su-settings-card');
        await expect(cards).toHaveCount(4);
        for (const section of ['connection', 'ai', 'application', 'advanced']) {
            await root.locator(`[data-action="settings-section"][data-section="${section}"]`).click();
            await expect(root.locator('[data-action="settings-home"]')).toBeVisible();
            await root.locator('[data-action="settings-home"]').click();
        }
        await page.setViewportSize({ width: 390, height: 844 });
        const first = await cards.first().boundingBox();
        const second = await cards.nth(1).boundingBox();
        expect(Math.abs((first?.x || 0) - (second?.x || 0))).toBeLessThan(2);
    });

    test('keeps preset editing in a safe cancellable draft', async ({ page }) => {
        const root = page.locator('#simple-ui-root');
        await root.locator('.su-sidebar [data-view="settings"]').click();
        await root.locator('[data-action="settings-section"][data-section="ai"]').click();
        const editButton = root.locator('[data-action="edit-preset"]');
        test.skip(await editButton.count() === 0, 'The active connection is not Chat Completion');
        const activePreset = await page.evaluate(() => window.simpleUiBridge.getSnapshot().aiFeatures.activePresetId);
        if (activePreset === 'gui') {
            await expect(editButton).toBeDisabled();
            return;
        }

        await expect(editButton).toBeEnabled();
        await editButton.click();
        const editor = root.locator('form[data-form="preset-editor"]');
        await expect(editor).toBeVisible();
        await expect(editor.locator('.su-preset-section')).not.toHaveCount(0);
        await expect(editor.locator('[data-preset-category="Provider and model"]')).toHaveCount(0);
        await expect(editor.locator('[data-preset-category="Other"]')).toHaveCount(0);
        await expect(editor.locator('[data-prompt-content]')).not.toHaveCount(0);
        await expect(editor.locator('[data-prompt-order]')).not.toHaveCount(0);
        const editorContract = await page.evaluate(async () => {
            const bridge = await import('/scripts/simple-ui/bridge.js');
            const state = bridge.getChatCompletionPresetEditor();
            return {
                promptOrderCharacterId: state.promptOrderCharacterId,
                keepsProviderValue: Object.hasOwn(state.values, 'chat_completion_source'),
                exposesProviderField: state.fields.some(field => field.category === 'Provider and model'),
                exposesOtherField: state.fields.some(field => field.category === 'Other'),
            };
        });
        expect(editorContract).toEqual({ promptOrderCharacterId: 100001, keepsProviderValue: true, exposesProviderField: false, exposesOtherField: false });
        const keys = await editor.locator('[data-preset-key]').evaluateAll(elements => elements.map(element => element.dataset.presetKey));
        expect(keys.join(' ')).not.toMatch(/api.?key|password|proxy|url|endpoint|account.?id|project.?id|custom.?header/i);

        const firstField = editor.locator('[data-preset-key]').first();
        const original = await firstField.evaluate(element => element instanceof HTMLInputElement && element.type === 'checkbox' ? element.checked : element.value);
        const firstPrompt = editor.locator('[data-prompt-content]').first();
        const originalPrompt = await firstPrompt.inputValue();
        const originalOrder = await editor.locator('[data-prompt-order]').evaluateAll(elements => elements.map(element => element.dataset.promptOrder));
        await firstField.evaluate(element => {
            if (element instanceof HTMLInputElement && element.type === 'checkbox') element.checked = !element.checked;
            else element.value = `${element.value}__draft`;
            element.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await firstPrompt.fill(`${originalPrompt}__draft`);
        if (originalOrder.length > 1) await editor.locator('[data-action="prompt-down"]').first().click();
        await editor.locator('[data-action="cancel-modal"]').click();
        await editButton.click();
        const reopened = root.locator('form[data-form="preset-editor"] [data-preset-key]').first();
        const restored = await reopened.evaluate(element => element instanceof HTMLInputElement && element.type === 'checkbox' ? element.checked : element.value);
        expect(restored).toBe(original);
        await expect(root.locator('form[data-form="preset-editor"] [data-prompt-content]').first()).toHaveValue(originalPrompt);
        expect(await root.locator('form[data-form="preset-editor"] [data-prompt-order]').evaluateAll(elements => elements.map(element => element.dataset.promptOrder))).toEqual(originalOrder);
        await root.locator('form[data-form="preset-editor"] [data-action="cancel-modal"]').click();
    });

    test('shows global lorebook selection and keeps the primary book out of additional choices', async ({ page }) => {
        const root = page.locator('#simple-ui-root');
        await root.locator('.su-sidebar [data-view="lore"]').click();
        await expect(root.locator('.su-global-lore-summary')).toBeVisible();
        const loreCard = root.locator('.su-lore-card').first();
        if (await loreCard.count()) {
            expect((await loreCard.boundingBox())?.height).toBeLessThanOrEqual(90);
            await expect(loreCard.locator('p')).toHaveCount(0);
            await expect(loreCard.locator('[data-action="edit-lorebook"]')).toBeVisible();
            const deleteButton = loreCard.locator('[data-action="delete-lorebook"]');
            await expect(deleteButton).toBeVisible();
            await expect(deleteButton.locator('.fa-trash-can')).toHaveCount(1);
            await expect(deleteButton).toHaveAttribute('aria-label', /.+/);
            expect((await deleteButton.textContent())?.trim()).toBe('');
        }
        const originalSelection = await page.evaluate(() => [...window.simpleUiBridge.getSnapshot().globalLorebooks]);
        await root.locator('.su-global-lore-summary').click();
        const globalForm = root.locator('form[data-form="global-lorebooks"]');
        await expect(globalForm.locator('.su-modal-search')).toHaveCSS('border-top-style', 'solid');
        await expect(globalForm.locator('.su-modal-search input')).toHaveCSS('border-top-style', 'none');
        const searchIconBox = await globalForm.locator('.su-modal-search .fa-magnifying-glass').boundingBox();
        const searchInputBox = await globalForm.locator('.su-modal-search input').boundingBox();
        expect(Math.abs(((searchIconBox?.y || 0) + (searchIconBox?.height || 0) / 2) - ((searchInputBox?.y || 0) + (searchInputBox?.height || 0) / 2))).toBeLessThanOrEqual(2);
        await expect(globalForm.locator('input[name="globalLorebooks"]')).toHaveCount(await page.locator('#world_info option').count());
        const firstGlobal = globalForm.locator('input[name="globalLorebooks"]').first();
        if (await firstGlobal.count()) {
            await firstGlobal.setChecked(!(await firstGlobal.isChecked()));
            if (await firstGlobal.isChecked()) {
                expect(await firstGlobal.evaluate(element => getComputedStyle(element, '::after').borderRightColor)).toBe('rgb(255, 255, 255)');
            }
            await globalForm.locator('[data-action="cancel-modal"]').click();
            expect(await page.evaluate(() => window.simpleUiBridge.getSnapshot().globalLorebooks)).toEqual(originalSelection);

            await root.locator('.su-global-lore-summary').click();
            const reopenedForm = root.locator('form[data-form="global-lorebooks"]');
            const reopenedFirst = reopenedForm.locator('input[name="globalLorebooks"]').first();
            expect(await reopenedFirst.isChecked()).toBe(originalSelection.includes(await reopenedFirst.inputValue()));
            await reopenedForm.locator('.su-primary').click();
            await expect(reopenedForm).toHaveCount(0);
        } else {
            await globalForm.locator('[data-action="cancel-modal"]').click();
        }

        await root.locator('.su-sidebar [data-view="characters"]').click();
        await root.locator('[data-action="new-character"]').click();
        const form = root.locator('form[data-form="character"]');
        await form.locator('details').nth(1).locator('summary').click();
        const primaryOptions = form.locator('[name="primaryLorebook"] option:not([value=""])');
        test.skip(await primaryOptions.count() === 0, 'No lorebook is available');
        const primary = await primaryOptions.first().getAttribute('value');
        await form.locator('[name="primaryLorebook"]').selectOption(primary);
        const lorebookValues = await form.locator('.su-lore-choice[data-lorebook]').evaluateAll(elements => elements.map(element => element.dataset.lorebook));
        const matchingExtra = form.locator('.su-lore-choice[data-lorebook]').nth(lorebookValues.indexOf(primary));
        await expect(matchingExtra).toHaveClass(/is-hidden/);
        await expect(matchingExtra.locator('input')).not.toBeChecked();
    });

    test('submits composer with Enter and preserves newlines with Shift+Enter', async ({ page }) => {
        const root = page.locator('#simple-ui-root');
        await root.locator('.su-sidebar [data-view="chats"]').click();
        const recentChat = root.locator('.su-row-open').first();
        test.skip(await recentChat.count() === 0, 'No saved chat is available');
        await recentChat.click();
        const composer = root.locator('.su-composer');
        const textarea = composer.locator('textarea[name="message"]');
        await page.evaluate(() => {
            window.__simpleUiSubmitCount = 0;
            HTMLFormElement.prototype.requestSubmit = function () {
                window.__simpleUiSubmitCount += 1;
            };
        });
        await textarea.fill('Send this');
        await textarea.press('Enter');
        await expect.poll(() => page.evaluate(() => window.__simpleUiSubmitCount)).toBe(1);
        await textarea.fill('Keep');
        await textarea.press('Shift+Enter');
        await expect(textarea).toHaveValue('Keep\n');
        await expect.poll(() => page.evaluate(() => window.__simpleUiSubmitCount)).toBe(1);
        await textarea.fill('');
        await textarea.press('Enter');
        await expect.poll(() => page.evaluate(() => window.__simpleUiSubmitCount)).toBe(1);
    });

    test('shows the chat information header and changes models without reconnecting', async ({ page }) => {
        const root = page.locator('#simple-ui-root');
        await root.locator('.su-sidebar [data-view="chats"]').click();
        const recentChat = root.locator('.su-row-open').first();
        test.skip(await recentChat.count() === 0, 'No saved chat is available');
        await recentChat.click();
        const info = root.locator('.su-chat-info');
        await expect.poll(() => root.evaluate(element => Math.abs(element.scrollTop - Math.max(0, element.scrollHeight - element.clientHeight)))).toBeLessThanOrEqual(2);
        await expect(root.locator('.su-shell')).toHaveClass(/chat-mode/);
        await expect(root.locator('.su-sidebar')).toBeHidden();
        await expect(root.locator('.su-main')).toHaveCSS('margin-left', '0px');
        await expect(info).toBeVisible();
        await expect(info).toHaveCSS('position', 'sticky');
        await expect(info).toHaveCSS('backdrop-filter', 'none');
        await expect(root.locator('.su-composer')).toHaveCSS('backdrop-filter', 'none');
        await expect(info.locator('.su-chat-back')).toBeVisible();
        await expect(info.locator('.su-chat-info-avatar')).toBeVisible();
        await expect(info.locator('.su-chat-identity strong')).not.toBeEmpty();
        await expect(info.locator('.su-status')).toBeVisible();
        await expect(info.locator('.su-affinity-track')).toHaveAttribute('role', 'progressbar');
        const affinityHeight = await info.locator('.su-affinity-track').evaluate(element => element.getBoundingClientRect().height);
        expect(affinityHeight).toBeGreaterThanOrEqual(8);
        await root.locator('.su-transcript').evaluate(element => { element.style.minHeight = '1800px'; });
        await root.evaluate(element => { element.scrollTop = 600; });
        await expect.poll(async () => (await info.boundingBox())?.y || 0).toBeLessThanOrEqual(14);
        await expect(info).toHaveClass(/is-stuck/);
        await expect(info).toHaveCSS('border-top-left-radius', '0px');
        const menu = info.locator('.su-model-menu');
        test.skip(await menu.count() === 0, 'The active provider has no selectable model list');
        await menu.locator('summary').click();
        const selectedButton = menu.locator('[data-action="select-model"].selected');
        await expect(selectedButton).toHaveClass(/selected/);
        await page.evaluate(() => {
            window.__simpleUiConnectClicks = 0;
            document.querySelector('#api_button_openai, #api_button_textgenerationwebui, #api_button')?.addEventListener('click', () => window.__simpleUiConnectClicks += 1);
        });
        await selectedButton.click();
        await expect.poll(() => page.evaluate(() => window.__simpleUiConnectClicks)).toBe(0);
        await page.setViewportSize({ width: 390, height: 844 });
        await expect(root.locator('.su-sidebar')).toBeHidden();
        await expect(root).toHaveCSS('padding-bottom', '0px');
        expect(await root.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    });

    test('filters the chat model menu with provider-specific favorites', async ({ page }) => {
        const state = await page.evaluate(() => window.simpleUiBridge.getSnapshot());
        const provider = state.connection.source;
        const models = state.connection.models || [];
        test.skip(!provider || models.length < 2, 'The active provider has fewer than two selectable models');
        const original = state.favoriteModels?.[provider] || [];
        try {
            await page.evaluate(({ provider, ids }) => window.simpleUiBridge.setFavoriteModels(provider, ids), { provider, ids: [models[0].id] });
            const root = page.locator('#simple-ui-root');
            await root.locator('.su-sidebar [data-view="chats"]').click();
            const recentChat = root.locator('.su-row-open').first();
            test.skip(await recentChat.count() === 0, 'No saved chat is available');
            await recentChat.click();
            const oneFavoriteButtons = root.locator('.su-model-menu [data-action="select-model"]');
            await expect(oneFavoriteButtons).toHaveCount(1);
            await expect(oneFavoriteButtons.first()).toHaveAttribute('data-model', await page.evaluate(() => window.simpleUiBridge.getSnapshot().connection.model));

            const chosen = [models[0].id, models[1].id];
            await page.evaluate(({ provider, chosen }) => window.simpleUiBridge.setFavoriteModels(provider, chosen), { provider, chosen });
            await expect.poll(() => root.locator('.su-model-menu [data-action="select-model"]').evaluateAll(buttons => buttons.map(button => button.dataset.model))).toEqual(chosen);
        } finally {
            await page.evaluate(({ provider, original }) => window.simpleUiBridge.setFavoriteModels(provider, original), { provider, original });
        }
    });

    test('formats narration, balanced actions and dialogue with safe HTML escaping', async ({ page }) => {
        const output = await page.evaluate(async () => {
            const module = await import('/scripts/simple-ui/index.js');
            return module.formatSimpleMessage('Normal <tag> *action* **strong** "speech" “curly” unmatched *');
        });
        expect(output).toContain('Normal &lt;tag&gt;');
        expect(output).toContain('<strong class="su-action-text">action</strong>');
        expect(output).toContain('<strong class="su-action-text">strong</strong>');
        expect(output).toContain('<span class="su-dialogue-text">“speech”</span>');
        expect(output).toContain('<span class="su-dialogue-text">“curly”</span>');
        expect(output).toContain('unmatched *');
        expect(output).not.toContain('<tag>');
    });

    test('calculates affinity levels and meaningful-message limits', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const bridge = await import('/scripts/simple-ui/bridge.js');
            return {
                zero: bridge.getAffinityState(0),
                middle: bridge.getAffinityState(80),
                maximum: bridge.getAffinityState(3200),
                short: bridge.isMeaningfulAffinityMessage({ mes: '1234', is_user: true }),
                exact: bridge.isMeaningfulAffinityMessage({ mes: '12345', is_user: true }),
                slash: bridge.isMeaningfulAffinityMessage({ mes: '/help me', is_user: true }),
                awards: (() => {
                    const message = { mes: 'hello', is_user: true };
                    const first = bridge.buildAffinityTurnAward(null, message, '', () => 0, () => 'turn-one');
                    const duplicate = bridge.buildAffinityTurnAward(first.affinity, message, '', () => 0.99, () => 'unused');
                    const regenerate = bridge.buildAffinityTurnAward(null, { mes: 'hello', is_user: true }, 'regenerate', () => 0.99, () => 'turn-two');
                    const continueMessage = bridge.buildAffinityTurnAward(null, { mes: 'hello', is_user: true }, 'appendFinal', () => 0.99, () => 'turn-three');
                    const maximum = bridge.buildAffinityTurnAward(null, { mes: 'hello', is_user: true }, '', () => 0.999, () => 'turn-four');
                    return { first, duplicate, regenerate, continueMessage, maximum };
                })(),
            };
        });
        expect(result.zero).toMatchObject({ level: 'Stranger', nextLevel: 'Acquaintance', progress: 0 });
        expect(result.middle).toMatchObject({ level: 'Acquaintance', nextLevel: 'Friend', progress: 50 });
        expect(result.maximum).toMatchObject({ level: 'Until death do us part', nextLevel: null, progress: 100 });
        expect(result.short).toBe(false);
        expect(result.exact).toBe(true);
        expect(result.slash).toBe(false);
        expect(result.awards.first).toMatchObject({ points: 1, turnId: 'turn-one', affinity: { version: 1, score: 1, awardedTurns: ['turn-one'] } });
        expect(result.awards.duplicate).toBeNull();
        expect(result.awards.regenerate).toBeNull();
        expect(result.awards.continueMessage).toBeNull();
        expect(result.awards.maximum).toMatchObject({ points: 5, affinity: { score: 5 } });
    });

    test('keeps popup drafts stable and shows the avatar picker', async ({ page }) => {
        const root = page.locator('#simple-ui-root');
        await root.locator('.su-sidebar [data-view="characters"]').click();
        await root.locator('[data-action="new-character"]').click();

        const characterForm = root.locator('form[data-form="character"]');
        await expect(characterForm.locator('.su-avatar-control')).toBeVisible();
        await expect(characterForm.locator('[data-avatar-preview]')).toBeVisible();
        await characterForm.locator('[name="name"]').fill('Stable character draft');
        const description = characterForm.locator('[name="description"]');
        await description.click();
        await page.keyboard.type('This text must survive a click and snapshot update.');
        await expect(description).toBeFocused();
        await expect(description).toHaveValue('This text must survive a click and snapshot update.');

        await page.evaluate(async () => {
            window.simpleUiBridge.setMode('minimal');
        });

        await expect(characterForm.locator('[name="name"]')).toHaveValue('Stable character draft');
        await expect(description).toHaveValue('This text must survive a click and snapshot update.');

        await root.locator('.su-modal > header [data-action="close-modal"]').click();
        await root.locator('.su-sidebar [data-view="lore"]').click();
        await root.locator('[data-action="new-lorebook"]').click();
        await root.locator('input[name="name"]').fill('Persistent lorebook name');
        await root.locator('[data-action="add-lore-entry"]').click();
        await expect(root.locator('input[name="name"]')).toHaveValue('Persistent lorebook name');
        const firstEntry = root.locator('.su-lore-entry').first();
        await expect(firstEntry).toHaveAttribute('open', '');
        await firstEntry.locator('[data-field="comment"]').fill('Persistent entry');
        await firstEntry.locator('[data-field="content"]').fill('Persistent content');
        await firstEntry.locator('.su-toggle').first().click();
        await expect(firstEntry.locator('[data-field="constant"]')).toBeChecked();
        await expect(firstEntry.locator('summary small')).toContainText(/Always active|Her zaman aktif/);
        const entryFields = await firstEntry.locator('.su-lore-entry-content > label').allTextContents();
        expect(entryFields.slice(0, 3).join(' ')).toMatch(/Title|Başlık/);
        expect(entryFields.slice(0, 3).join(' ')).toMatch(/Content|İçerik/);
        expect(entryFields.slice(0, 3).join(' ')).toMatch(/Trigger keywords|Tetikleyici anahtar kelimeler/);
        await root.locator('.su-modal').evaluate(element => { element.scrollTop = element.scrollHeight; });
        await root.locator('[data-action="add-lore-entry"]').click();
        await expect.poll(() => root.locator('.su-modal').evaluate(element => element.scrollTop)).toBeGreaterThan(0);
        await expect(firstEntry.locator('[data-field="comment"]')).toHaveValue('Persistent entry');
        await expect(firstEntry.locator('[data-field="content"]')).toHaveValue('Persistent content');
    });

    test('wraps list rows without horizontal overflow', async ({ page }) => {
        const root = page.locator('#simple-ui-root');
        await root.locator('.su-sidebar [data-view="chats"]').click();
        const row = root.locator('.su-list .su-row').first();
        test.skip(await row.count() === 0, 'No saved chat is available');
        const widths = await row.evaluate(element => ({
            row: element.getBoundingClientRect().width,
            list: element.parentElement.getBoundingClientRect().width,
        }));
        expect(widths.row).toBeLessThanOrEqual(widths.list + 1);
        await expect(row.locator('p').first()).toHaveCSS('white-space', 'normal');
    });

    test('exposes active-chat settings beside attachments', async ({ page }) => {
        const root = page.locator('#simple-ui-root');
        await root.locator('.su-sidebar [data-view="chats"]').click();
        const recentChat = root.locator('.su-row-open').first();
        test.skip(await recentChat.count() === 0, 'No saved chat is available');
        await recentChat.click();
        await expect(root.locator('[data-action="chat-settings"]')).toBeVisible();
        await root.locator('[data-action="chat-settings"]').click();
        const form = root.locator('form[data-form="chat-settings"]');
        for (const name of ['lorebook', 'authorNote', 'authorNotePosition', 'authorNoteInterval', 'authorNoteDepth', 'authorNoteRole', 'scenario', 'exampleMessages', 'systemPrompt']) {
            await expect(form.locator(`[name="${name}"]`)).toHaveCount(1);
        }
        await form.locator('[name="authorNotePosition"]').selectOption('0');
        await expect(form.locator('.su-author-note-depth')).toHaveClass(/is-hidden/);
    });

    test('automatically dismisses normal notifications', async ({ page }) => {
        const root = page.locator('#simple-ui-root');
        await root.locator('.su-sidebar [data-view="chats"]').click();
        const recentChat = root.locator('.su-row-open').first();
        test.skip(await recentChat.count() === 0, 'No saved chat is available');
        await recentChat.click();
        await root.locator('input[name="attachments"]').setInputFiles({
            name: 'notice.txt',
            mimeType: 'text/plain',
            buffer: Buffer.from('notification timer'),
        });
        await expect(root.locator('.su-alert')).toBeVisible();
        await expect(root.locator('.su-alert')).toHaveCount(0, { timeout: 5000 });
    });

    test('keeps errors visible longer and then dismisses them', async ({ page }) => {
        const root = page.locator('#simple-ui-root');
        await root.evaluate(element => {
            const button = document.createElement('button');
            button.dataset.action = 'open-chat';
            button.dataset.avatar = '__missing_character__';
            button.dataset.file = '__missing_chat__';
            element.append(button);
            button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        await expect(root.locator('.su-alert.error')).toBeVisible();
        await page.waitForTimeout(4500);
        await expect(root.locator('.su-alert.error')).toBeVisible();
        await expect(root.locator('.su-alert.error')).toHaveCount(0, { timeout: 4500 });
    });

    test('uses the shared destructive action dialog', async ({ page }) => {
        const root = page.locator('#simple-ui-root');
        await root.locator('.su-sidebar [data-view="lore"]').click();
        await root.locator('[data-action="new-lorebook"]').click();
        await root.locator('[data-action="add-lore-entry"]').click();
        await root.locator('[data-action="delete-lore-entry"]').click();
        const dialog = root.locator('.su-confirm[role="alertdialog"]');
        await expect(dialog).toBeVisible();
        await expect(dialog.locator('[data-action="cancel-delete"]')).toBeFocused();
        await dialog.locator('[data-action="cancel-delete"]').click();
        await expect(root.locator('.su-lore-entry')).toHaveCount(1);

        await root.locator('[data-action="delete-lore-entry"]').click();
        await dialog.locator('[data-action="confirm-delete"]').click();
        await expect(root.locator('.su-lore-entry')).toHaveCount(0);
    });
});

