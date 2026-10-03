import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test.describe('World Info Persona Filter (#5595)', () => {
    test.beforeEach(testSetup.awaitST);
    test('matcher: include/exclude/empty table', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { isPersonaFiltered } = await import('./scripts/world-info.js');
            const { user_avatar } = await import('./scripts/personas.js');
            const stranger = '__st_5595_stranger__.png';
            const listed = (isExclude) => ({ personaFilter: { isExclude, personas: [user_avatar] } });
            return [
                [listed(false), user_avatar, false],
                [listed(false), stranger, true],
                [listed(true), user_avatar, true],
                [listed(true), stranger, false],
                [{}, user_avatar, false],
                [{ personaFilter: { isExclude: false, personas: [] } }, user_avatar, false],
                [{ personaFilter: { isExclude: true, personas: [] } }, user_avatar, false],
            ].map(([entry, persona, expected]) => isPersonaFiltered(entry, persona) === expected);
        });
        expect(result.every(Boolean)).toBe(true);
    });
    test('save/reload round-trip plus real editor DOM wiring', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const wi = await import('./scripts/world-info.js');
            const { user_avatar } = await import('./scripts/personas.js');
            const bookName = 'STAGE_REPRO_5595_PERSONA';
            const out = {};
            try {
                if (wi.world_names?.includes(bookName)) await wi.deleteWorldInfo(bookName);
                if (!await wi.createNewWorldInfo(bookName, { interactive: false })) throw new Error('create failed');
                const data = await wi.loadWorldInfo(bookName);
                const entry = wi.createWorldInfoEntry(bookName, data);
                entry.comment = 'STAGE_REPRO_5595';
                entry.personaFilter = { isExclude: true, personas: [user_avatar] };
                await wi.saveWorldInfo(bookName, data, true);
                wi.worldInfoCache.delete(bookName);
                const reloaded = await wi.loadWorldInfo(bookName);
                const runtimeEntry = Object.values(reloaded.entries).find((e) => e.comment === 'STAGE_REPRO_5595');
                out.savedFilter = structuredClone(runtimeEntry.personaFilter);
                out.listedFiltered = wi.isPersonaFiltered(runtimeEntry, user_avatar);
                const rendered = await wi.getWorldEntry(bookName, reloaded, runtimeEntry);
                rendered.find('.inline-drawer').trigger('inline-drawer-toggle');
                const label = () => String(rendered[0].querySelector('small[for="personaFilter"]')?.textContent ?? '').trim();
                const checkbox = rendered[0].querySelector('input[name="persona_exclusion"]');
                if (!checkbox) throw new Error('persona checkbox not rendered');
                out.excludeLabel = label();
                out.checked = checkbox.checked;
                window.$(checkbox).prop('checked', false).trigger('input', { noSave: true });
                out.includeLabel = label();
                out.flipped = reloaded.entries[runtimeEntry.uid].personaFilter.isExclude;
            } finally {
                await wi.deleteWorldInfo(bookName);
            }
            return out;
        });
        expect(result.savedFilter).toEqual({ isExclude: true, personas: expect.any(Array) });
        expect(result.listedFiltered).toBe(true);
        expect(result.checked).toBe(true);
        expect(result.excludeLabel).toBe('Exclude Persona(s)');
        expect(result.includeLabel).toBe('Filter to Persona(s)');
        expect(result.flipped).toBe(false);
    });
});
