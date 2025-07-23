import sanitize from 'sanitize-filename';
import { promises as fsPromises } from 'node:fs';
import path from 'node:path';
import urlJoin from 'url-join';
import { DEFAULT_AVATAR_PATH } from './constants.js';
import { extractFileFromZipBuffer, humanizedISO8601DateTime } from './util.js';

export const replaceByafMacros = (s) =>
    String(s || '')
        .replace(/#{user}:/gi, '{{user}}:')
        .replace(/#{character}:/gi, '{{char}}:')
        .replace(/{character}(?!})/gi, '{{char}}')
        .replace(/{user}(?!})/gi, '{{user}}');

export const formatByafExampleMessages = (examples) => {
    if (!Array.isArray(examples)) {
        return '';
    }

    let formattedExamples = '';

    examples.forEach((example) => {
        if (!example?.text) {
            return;
        }
        formattedExamples += `<START>\n${replaceByafMacros(example.text)}\n`;
    });

    return formattedExamples.trimEnd();
};

export const formatByafAlternateGreetings = (greetings) => {
    if (!Array.isArray(greetings)) {
        return [];
    }

    if (greetings.length <= 1) {
        return [];
    }

    // Skip one because it goes into 'first_mes'
    return greetings.slice(1).map(g => replaceByafMacros(g?.text));
};

export const convertByafCharacterBook = (items) => {
    if (!Array.isArray(items) || items.length === 0) {
        return null;
    }

    const book = {
        /** @type {any[]} */
        entries: [],
    };

    items.forEach((item, index) => {
        if (!item) {
            return;
        }
        book.entries.push({
            keys: replaceByafMacros(item?.key).split(',').map(key => key.trim()).filter(Boolean),
            content: replaceByafMacros(item?.value),
            extensions: {},
            enabled: true,
            insertion_order: index,
        });
    });

    return book;
};

/**
 * Extracts a character object from BYAF buffer.
 * @param {ArrayBufferLike} data ZIP buffer
 * @param {object} manifest BYAF manifest
 * @returns {Promise<{character:object,characterPath:string}>} Character object
 */
export async function getCharacterFromByafManifest(data, manifest) {
    const charactersArray = manifest?.characters;

    if (!Array.isArray(charactersArray)) {
        throw new Error('Invalid BYAF file: missing characters array');
    }

    if (charactersArray.length === 0) {
        throw new Error('Invalid BYAF file: characters array is empty');
    }

    if (charactersArray.length > 1) {
        console.warn('Warning: BYAF manifest contains more than one character, only the first one will be imported');
    }

    const characterPath = charactersArray[0];
    if (!characterPath) {
        throw new Error('Invalid BYAF file: missing character path');
    }

    const characterBuffer = await extractFileFromZipBuffer(data, characterPath);
    if (!characterBuffer) {
        throw new Error('Invalid BYAF file: failed to extract character JSON');
    }

    try {
        const character = JSON.parse(characterBuffer.toString());
        return { character, characterPath };
    } catch (error) {
        console.error('Failed to parse character JSON from BYAF:', error);
        throw new Error('Invalid BYAF file: character is not a valid JSON');
    }
}

/**
 * Extracts a scenario object from BYAF buffer.
 * @param {ArrayBufferLike} data ZIP buffer
 * @param {object} manifest BYAF manifest
 * @returns {Promise<object>} Scenario object
 */
export async function getScenarioFromByafManifest(data, manifest) {
    const scenariosArray = manifest?.scenarios;

    if (!Array.isArray(scenariosArray) || scenariosArray.length === 0) {
        console.warn('Warning: BYAF manifest contains no scenarios');
        return {};
    }

    if (scenariosArray.length > 1) {
        console.warn('Warning: BYAF manifest contains more than one scenario, only the first one will be imported');
    }

    const scenarioPath = scenariosArray[0];
    if (!scenarioPath) {
        console.warn('Warning: missing BYAF scenario path');
        return {};
    }

    const scenarioBuffer = await extractFileFromZipBuffer(data, scenarioPath);
    if (!scenarioBuffer) {
        console.warn('Warning: failed to extract BYAF scenario JSON');
        return {};
    }

    try {
        return JSON.parse(scenarioBuffer.toString());
    } catch (error) {
        console.warn('Warning: BYAF scenario is not a valid JSON', error);
        return {};
    }
}

/**
 * Extracts an image from BYAF buffer.
 * @param {ArrayBufferLike} data ZIP buffer
 * @param {object} character Character object
 * @param {string} characterPath Path to the character in the BYAF manifest
 */
export async function getImageBufferFromByafCharacter(data, character, characterPath) {
    const defaultAvatarBuffer = await fsPromises.readFile(DEFAULT_AVATAR_PATH);
    const characterImages = character?.images;

    if (!Array.isArray(characterImages) || characterImages.length === 0) {
        console.warn('Warning: BYAF character has no images');
        return defaultAvatarBuffer;
    }

    const imagePath = characterImages[0]?.path;
    if (!imagePath) {
        console.warn('Warning: BYAF character image path is empty');
        return defaultAvatarBuffer;
    }

    const fullImagePath = urlJoin(path.dirname(characterPath), imagePath);
    const imageBuffer = await extractFileFromZipBuffer(data, fullImagePath);
    if (!imageBuffer) {
        console.warn('Warning: failed to extract BYAF character image');
        return defaultAvatarBuffer;
    }

    return imageBuffer;
}

/**
 * Formats BYAF data as a character card.
 * @param {object} character
 * @param {object} scenario
 */
export function formatByafAsCharacterCard(character, scenario) {
    return {
        spec: 'chara_card_v2',
        spec_version: '2.0',
        create_date: humanizedISO8601DateTime(),
        data: {
            name: sanitize(character?.name || character?.displayName || ''),
            description: replaceByafMacros(character?.persona),
            personality: '',
            scenario: replaceByafMacros(scenario?.narrative),
            first_mes: replaceByafMacros(scenario?.firstMessages?.[0]?.text),
            mes_example: formatByafExampleMessages(scenario?.exampleMessages),
            creator_notes: '',
            system_prompt: replaceByafMacros(scenario?.formattingInstructions),
            post_history_instructions: '',
            alternate_greetings: formatByafAlternateGreetings(scenario?.firstMessages),
            character_book: convertByafCharacterBook(character?.loreItems),
            tags: [],
            creator: '',
            character_version: '',
            extensions: {},
        },
    };
}
