import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test.beforeEach(testSetup.awaitST);

test('system messages keep their extra data separate from their template and each other', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const { getSystemMessageByType, system_messages, system_message_types } = await import('/scripts/system-messages.js');
        const type = system_message_types.GENERIC;
        const first = getSystemMessageByType(type, 'First', { swipeable: true });
        const second = getSystemMessageByType(type, 'Second');
        first.extra.note = 'first only';
        return { first: first.extra, second: second.extra, template: system_messages[type].extra };
    });

    expect(result.first).toMatchObject({ swipeable: true, type: 'generic', note: 'first only' });
    expect(result.second).toMatchObject({ swipeable: false, type: 'generic' });
    expect(result.second).not.toHaveProperty('note');
    expect(result.template).not.toHaveProperty('note');
    expect(result.template).not.toHaveProperty('type');
});

test('system messages copy nested template metadata without copying unrelated fields', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const { getSystemMessageByType, system_messages } = await import('/scripts/system-messages.js');
        const type = 'test-system-message';
        const template = { ...system_messages.generic, swipes: ['hello'], extra: { flags: { archived: false } } };
        system_messages[type] = template;
        try {
            const first = getSystemMessageByType(type);
            const second = getSystemMessageByType(type);
            first.extra.flags.archived = true;
            return {
                secondArchived: second.extra.flags.archived,
                templateArchived: template.extra.flags.archived,
                keptSwipes: first.swipes === template.swipes,
            };
        } finally {
            delete system_messages[type];
        }
    });

    expect(result).toEqual({ secondArchived: false, templateArchived: false, keptSwipes: true });
});
