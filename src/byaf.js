import sanitize from 'sanitize-filename';
import { promises as fsPromises } from 'node:fs';
import path from 'node:path';
import urlJoin from 'url-join';
import { DEFAULT_AVATAR_PATH } from './constants.js';
import { extractFileFromZipBuffer, humanizedISO8601DateTime } from './util.js';

/**
 * A parser for BYAF (Backyard Archive Format) files.
 */
export class ByafParser {
    /**
     * @param {ArrayBufferLike} data BYAF ZIP buffer
     */
    #data;

    /**
     * Creates an instance of ByafParser.
     * @param {ArrayBufferLike} data BYAF ZIP buffer
     */
    constructor(data) {
        this.#data = data;
    }

    /**
     * Replaces known macros in a string.
     * @param {string} [str] String to process
     * @returns {string} String with macros replaced
     * @private
     */
    replaceMacros(str) {
        return String(str || '')
            .replace(/#{user}:/gi, '{{user}}:')
            .replace(/#{character}:/gi, '{{char}}:')
            .replace(/{character}(?!})/gi, '{{char}}')
            .replace(/{user}(?!})/gi, '{{user}}');
    }

    /**
     * Formats example messages for a character.
     * @param {ByafExampleMessage[]} [examples] Array of example objects
     * @returns {string} Formatted example messages
     * @private
     */
    formatExampleMessages(examples) {
        if (!Array.isArray(examples)) {
            return '';
        }

        let formattedExamples = '';

        examples.forEach((example) => {
            if (!example?.text) {
                return;
            }
            formattedExamples += `<START>\n${this.replaceMacros(example.text)}\n`;
        });

        return formattedExamples.trimEnd();
    }

    /**
     * Formats alternate greetings for a character.
     * @param {ByafExampleMessage[]} [greetings] Array of greeting objects
     * @returns {string[]} Formatted alternate greetings
     * @private
     */
    formatAlternateGreetings(greetings) {
        if (!Array.isArray(greetings)) {
            return [];
        }

        if (greetings.length <= 1) {
            return [];
        }

        // Skip one because it goes into 'first_mes'
        return greetings.slice(1).map(g => this.replaceMacros(g?.text));
    }

    /**
     * Converts character book items to a structured format.
     * @param {ByafLoreItem[]} items Array of key-value pairs
     * @returns {CharacterBook|undefined} Converted character book or undefined if invalid
     * @private
     */
    convertCharacterBook(items) {
        if (!Array.isArray(items) || items.length === 0) {
            return undefined;
        }

        /** @type {CharacterBook} */
        const book = {
            entries: [],
            extensions: {},
        };

        items.forEach((item, index) => {
            if (!item) {
                return;
            }
            book.entries.push({
                keys: this.replaceMacros(item?.key).split(',').map(key => key.trim()).filter(Boolean),
                content: this.replaceMacros(item?.value),
                extensions: {},
                enabled: true,
                insertion_order: index,
            });
        });

        return book;
    }

    /**
     * Extracts a character object from BYAF buffer.
     * @param {ByafManifest} manifest BYAF manifest
     * @returns {Promise<{character:ByafCharacter,characterPath:string}>} Character object
     * @private
     */
    async getCharacterFromManifest(manifest) {
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

        const characterBuffer = await extractFileFromZipBuffer(this.#data, characterPath);
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
     * @param {ByafManifest} manifest BYAF manifest
     * @returns {Promise<Partial<ByafScenario>>} Scenario object
     * @private
     */
    async getScenarioFromManifest(manifest) {
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

        const scenarioBuffer = await extractFileFromZipBuffer(this.#data, scenarioPath);
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
     * @param {ByafCharacter} character Character object
     * @param {string} characterPath Path to the character in the BYAF manifest
     * @return {Promise<Buffer>} Image buffer
     * @private
     */
    async getCharacterImage(character, characterPath) {
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
        const imageBuffer = await extractFileFromZipBuffer(this.#data, fullImagePath);
        if (!imageBuffer) {
            console.warn('Warning: failed to extract BYAF character image');
            return defaultAvatarBuffer;
        }

        return imageBuffer;
    }

    /**
     * Formats BYAF data as a character card.
     * @param {ByafManifest} manifest BYAF manifest
     * @param {ByafCharacter} character Character object
     * @param {Partial<ByafScenario>} scenario Scenario object
     * @return {TavernCardV2} Character card object
     * @private
     */
    getCharacterCard(manifest, character, scenario) {
        return {
            spec: 'chara_card_v2',
            spec_version: '2.0',
            data: {
                name: sanitize(character?.name || character?.displayName || ''),
                description: this.replaceMacros(character?.persona),
                personality: '',
                scenario: this.replaceMacros(scenario?.narrative),
                first_mes: this.replaceMacros(scenario?.firstMessages?.[0]?.text),
                mes_example: this.formatExampleMessages(scenario?.exampleMessages),
                creator_notes: '',
                system_prompt: this.replaceMacros(scenario?.formattingInstructions),
                post_history_instructions: '',
                alternate_greetings: this.formatAlternateGreetings(scenario?.firstMessages),
                character_book: this.convertCharacterBook(character?.loreItems),
                tags: [],
                creator: manifest?.author?.name || '',
                character_version: '',
                extensions: {},
            },
            // @ts-ignore Non-standard spec extension
            create_date: humanizedISO8601DateTime(),
        };
    }

    /**
     * Gets the manifest from the BYAF data.
     * @returns {Promise<ByafManifest>} Parsed manifest
     * @private
     */
    async getManifest() {
        const manifestBuffer = await extractFileFromZipBuffer(this.#data, 'manifest.json');
        if (!manifestBuffer) {
            throw new Error('Failed to extract manifest.json from BYAF file');
        }

        const manifest = JSON.parse(manifestBuffer.toString());
        if (!manifest || typeof manifest !== 'object') {
            throw new Error('Invalid BYAF manifest');
        }

        return manifest;
    }

    /**
     * Parses the BYAF data.
     * @return {Promise<{card: TavernCardV2, image: Buffer}>} Parsed character card and image buffer
     */
    async parse() {
        const manifest = await this.getManifest();
        const { character, characterPath } = await this.getCharacterFromManifest(manifest);
        const scenario = await this.getScenarioFromManifest(manifest);
        const image = await this.getCharacterImage(character, characterPath);
        const card = this.getCharacterCard(manifest, character, scenario);

        return { card, image };
    }
}

export default ByafParser;
