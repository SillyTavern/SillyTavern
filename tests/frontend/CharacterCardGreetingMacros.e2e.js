import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

// Values the fixture's greetings push into the chat variable when their macros run.
const FIRST_MESSAGE_VALUE = 'FROM_FIRST_MESSAGE';
const ALTERNATE_ONE_VALUE = 'FROM_ALTERNATE_ONE';
const ALTERNATE_TWO_VALUE = 'FROM_ALTERNATE_TWO';

// Stands in for a variable the user set before generating; no greeting assigns it.
const PRESET_VALUE = 'PRESET_BY_USER';

const FIXTURE_AVATAR = 'greeting-setvar-fixture.png';

/**
 * Installs a character whose greetings carry {{setvar}} side effects and points
 * getCharacterCardFields() at it. Returns the chid to pass to that function.
 * @param {import('@playwright/test').Page} page Playwright page
 */
async function installFixtureCharacter(page) {
    return page.evaluate(async ({ avatar, firstValue, altOneValue, altTwoValue }) => {
        const { characters, selected_group } = await import('./script.js');

        if (selected_group) {
            throw new Error('Fixture requires no active group chat.');
        }

        const chid = characters.findIndex(character => character.avatar === avatar);
        if (chid === -1) {
            characters.push({
                name: 'Greeting Setvar Fixture',
                avatar,
                description: 'Fixture used to observe greeting macro side effects.',
                personality: '',
                scenario: '',
                mes_example: '',
                first_mes: `First message. {{setvar::route::${firstValue}}}`,
                chat: '',
                chat_name: '',
                alternate_greetings: [],
                data: {
                    character_version: '1.0',
                    creator_notes: '',
                    system_prompt: '',
                    post_history_instructions: '',
                    alternate_greetings: [
                        `Alternate one. {{setvar::route::${altOneValue}}}`,
                        `Alternate two. {{setvar::route::${altTwoValue}}}`,
                    ],
                    extensions: {
                        depth_prompt: { prompt: '', depth: 4, role: 'system' },
                    },
                },
            });
        }

        return chid === -1 ? characters.length - 1 : chid;
    }, {
        avatar: FIXTURE_AVATAR,
        firstValue: FIRST_MESSAGE_VALUE,
        altOneValue: ALTERNATE_ONE_VALUE,
        altTwoValue: ALTERNATE_TWO_VALUE,
    });
}

/**
 * Resets the chat variable to the preset value.
 * @param {import('@playwright/test').Page} page Playwright page
 */
async function presetRouteVariable(page) {
    await page.evaluate(async (value) => {
        const { setLocalVariable } = await import('./scripts/variables.js');
        setLocalVariable('route', value);
    }, PRESET_VALUE);
}

/**
 * Reads the chat variable back out of the live module.
 * @param {import('@playwright/test').Page} page Playwright page
 */
async function readRouteVariable(page) {
    return page.evaluate(async () => {
        const { getLocalVariable } = await import('./scripts/variables.js');
        return getLocalVariable('route');
    });
}

test.describe('character card greeting macro side effects', () => {
    test.beforeEach(testSetup.awaitST);

    test('a generation-style caller that destructures only non-greeting fields leaves the chat variable alone', async ({ page }) => {
        const chid = await installFixtureCharacter(page);
        await presetRouteVariable(page);

        // Mirrors the generation path: it needs the prompt fields, never the greetings.
        const result = await page.evaluate(async (index) => {
            const { getCharacterCardFields } = await import('./script.js');
            const {
                description, personality, persona, scenario,
                mesExamples, system, jailbreak, charDepthPrompt, creatorNotes,
            } = getCharacterCardFields({ chid: index });
            return { description, personality, persona, scenario, mesExamples, system, jailbreak, charDepthPrompt, creatorNotes };
        }, chid);

        expect(result.description).toBe('Fixture used to observe greeting macro side effects.');
        expect(await readRouteVariable(page)).toBe(PRESET_VALUE);
    });

    test('merely calling getCharacterCardFields() does not run greeting macros', async ({ page }) => {
        const chid = await installFixtureCharacter(page);
        await presetRouteVariable(page);

        await page.evaluate(async (index) => {
            const { getCharacterCardFields } = await import('./script.js');
            getCharacterCardFields({ chid: index });
        }, chid);

        expect(await readRouteVariable(page)).toBe(PRESET_VALUE);
    });

    test('reading firstMessage explicitly still resolves it and runs its macro', async ({ page }) => {
        const chid = await installFixtureCharacter(page);
        await presetRouteVariable(page);

        const firstMessage = await page.evaluate(async (index) => {
            const { getCharacterCardFields } = await import('./script.js');
            return getCharacterCardFields({ chid: index }).firstMessage;
        }, chid);

        expect(firstMessage).toBe('First message. ');
        expect(await readRouteVariable(page)).toBe(FIRST_MESSAGE_VALUE);
    });

    test('reading alternateGreetings explicitly still resolves every greeting', async ({ page }) => {
        const chid = await installFixtureCharacter(page);
        await presetRouteVariable(page);

        const alternateGreetings = await page.evaluate(async (index) => {
            const { getCharacterCardFields } = await import('./script.js');
            return getCharacterCardFields({ chid: index }).alternateGreetings;
        }, chid);

        expect(alternateGreetings).toEqual(['Alternate one. ', 'Alternate two. ']);
        expect(await readRouteVariable(page)).toBe(ALTERNATE_TWO_VALUE);
    });

    test('greeting fields stay enumerable for consumers that spread or serialize the result', async ({ page }) => {
        const chid = await installFixtureCharacter(page);

        const keys = await page.evaluate(async (index) => {
            const { getCharacterCardFields } = await import('./script.js');
            return Object.keys(getCharacterCardFields({ chid: index }));
        }, chid);

        expect(keys).toEqual([
            'system', 'mesExamples', 'description', 'personality', 'persona', 'scenario',
            'jailbreak', 'version', 'charDepthPrompt', 'creatorNotes',
            'firstMessage', 'alternateGreetings',
        ]);
    });
});
