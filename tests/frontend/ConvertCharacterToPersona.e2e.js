import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test.describe('Convert character to persona', () => {
    test.beforeEach(testSetup.awaitST);

    test('keeps the size of the character image', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { characters, getCharacters, getRequestHeaders } = await import('./script.js');
            const { convertCharacterToPersona, getUserAvatar } = await import('./scripts/personas.js');
            const { power_user } = await import('./scripts/power-user.js');

            const name = 'STAGE_REPRO_CONVERT_TO_PERSONA';
            const personaAvatar = `${name} (Persona).png`;

            const canvas = document.createElement('canvas');
            canvas.width = 400;
            canvas.height = 600;
            canvas.getContext('2d').fillRect(0, 0, canvas.width, canvas.height);
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

            const formData = new FormData();
            formData.append('ch_name', name);
            formData.append('avatar', new File([blob], 'avatar.png', { type: 'image/png' }));
            const createResponse = await fetch('/api/characters/create', {
                method: 'POST',
                headers: getRequestHeaders({ omitContentType: true }),
                body: formData,
            });
            if (!createResponse.ok) {
                throw new Error(`Failed to create character: ${createResponse.status}`);
            }
            const characterAvatar = await createResponse.text();

            try {
                await getCharacters();
                const characterId = characters.findIndex(x => x.avatar === characterAvatar);
                const converted = await convertCharacterToPersona(characterId);

                const image = new Image();
                image.src = `${getUserAvatar(personaAvatar)}?t=${Date.now()}`;
                await image.decode();
                return { converted, width: image.naturalWidth, height: image.naturalHeight };
            } finally {
                delete power_user.personas[personaAvatar];
                delete power_user.persona_descriptions[personaAvatar];
                await fetch('/api/avatars/delete', {
                    method: 'POST',
                    headers: getRequestHeaders(),
                    body: JSON.stringify({ avatar: personaAvatar }),
                });
                await fetch('/api/characters/delete', {
                    method: 'POST',
                    headers: getRequestHeaders(),
                    body: JSON.stringify({ avatar_url: characterAvatar, delete_chats: true }),
                });
                await getCharacters();
            }
        });

        expect(result).toEqual({ converted: true, width: 400, height: 600 });
    });
});
