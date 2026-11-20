import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test.describe('Quick Reply overwrite cancellation', () => {
    test.beforeEach(testSetup.awaitST);

    for (const operation of ['create', 'import']) {
        test(`should keep the existing set when ${operation} overwrite is cancelled`, async ({ page }) => {
            const result = await page.evaluate(async (operation) => {
                const { Popup, POPUP_RESULT } = await import('./scripts/popup.js');
                const { QuickReplySet } = await import('./scripts/extensions/quick-reply/src/QuickReplySet.js');
                const { SettingsUi } = await import('./scripts/extensions/quick-reply/src/ui/SettingsUi.js');

                const setName = 'STAGE_REPRO_OVERWRITE_CANCEL';
                const existingSet = { name: setName };
                const originalSets = QuickReplySet.list;
                const originalInput = Popup.show.input;
                const originalConfirm = Popup.show.confirm;
                const originalFrom = QuickReplySet.from;
                const originalAddQuickReply = QuickReplySet.prototype.addQuickReply;
                let deleteCalls = 0;
                let confirmMessage = '';

                try {
                    QuickReplySet.list = [existingSet];
                    Popup.show.input = async () => setName;
                    Popup.show.confirm = async (_title, message) => {
                        confirmMessage = message;
                        return POPUP_RESULT.NEGATIVE;
                    };
                    QuickReplySet.prototype.addQuickReply = () => {};
                    QuickReplySet.from = props => ({
                        ...props,
                        qrList: [],
                        init: () => {},
                        save: async () => {},
                    });

                    const settingsUi = new SettingsUi({});
                    settingsUi.currentSet = document.createElement('select');
                    settingsUi.doDeleteQrSet = async () => deleteCalls++;
                    settingsUi.rerender = () => {};
                    settingsUi.onQrSetChange = () => {};
                    settingsUi.prepareGlobalSetList = () => {};
                    settingsUi.prepareChatSetList = () => {};
                    settingsUi.prepareCharacterSetList = () => {};

                    if (operation === 'create') {
                        await settingsUi.addQrSet();
                    } else {
                        const file = {
                            name: 'duplicate.json',
                            text: async () => JSON.stringify({ version: 2, name: setName, qrList: [] }),
                        };
                        await settingsUi.importSingleQrSet(file);
                    }

                    return {
                        confirmMessage,
                        deleteCalls,
                        setNames: QuickReplySet.list.map(set => set.name),
                        setName,
                    };
                } finally {
                    QuickReplySet.list = originalSets;
                    Popup.show.input = originalInput;
                    Popup.show.confirm = originalConfirm;
                    QuickReplySet.from = originalFrom;
                    QuickReplySet.prototype.addQuickReply = originalAddQuickReply;
                }
            }, operation);

            expect(result.confirmMessage).toContain(`"${result.setName}"`);
            expect(result.deleteCalls).toBe(0);
            expect(result.setNames).toEqual([result.setName]);
        });
    }
});
