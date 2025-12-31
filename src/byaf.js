import { promises as fsPromises } from 'node:fs';
import path from 'node:path';
import urlJoin from 'url-join';
import { DEFAULT_AVATAR_PATH } from './constants.js';
import { extractFileFromZipBuffer } from './util.js';

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
    static replaceMacros(str) {
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
    static formatExampleMessages(examples) {
        if (!Array.isArray(examples)) {
            return '';
        }

        let formattedExamples = '';

        examples.forEach((example) => {
            if (!example?.text) {
                return;
            }
            formattedExamples += `<START>\n${ByafParser.replaceMacros(example.text)}\n`;
        });

        return formattedExamples.trimEnd();
    }

    /**
     * Formats alternate greetings for a character.
     * @param {Partial<ByafScenario>[]} [scenarios] Array of scenario objects
     * @returns {string[]} Formatted alternate greetings
     * @private
     */
    formatAlternateGreetings(scenarios) {
        if (!Array.isArray(scenarios)) {
            return [];
        }

        // Skip one because it goes into 'first_mes'
        if (scenarios.length <= 1) {
            return [];
        }
        const greetings = new Set();
        const firstScenarioFirstMessage = scenarios?.[0]?.firstMessages?.[0]?.text;
        for (const scenario of scenarios.slice(1).filter(s => Array.isArray(s.firstMessages) && s.firstMessages.length > 0)) {
            // As per the BYAF spec, "firstMessages" array MUST contain AT MOST one message.
            // So we only consider the first one if it exists.
            const firstMessage = scenario?.firstMessages?.[0];
            if (firstMessage?.text && firstMessage.text !== firstScenarioFirstMessage) {
                greetings.add(ByafParser.replaceMacros(firstMessage.text));
            }
        }
        return Array.from(greetings);
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
                keys: ByafParser.replaceMacros(item?.key).split(',').map(key => key.trim()).filter(Boolean),
                content: ByafParser.replaceMacros(item?.value),
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
     * Extracts all scenario objects from BYAF buffer.
     * @param {ByafManifest} manifest BYAF manifest
     * @returns {Promise<Partial<ByafScenario>[]>} Scenarios array
     * @private
     */
    async getScenariosFromManifest(manifest) {
        const scenariosArray = manifest?.scenarios;

        if (!Array.isArray(scenariosArray) || scenariosArray.length === 0) {
            console.warn('Warning: BYAF manifest contains no scenarios');
            return [{}];
        }

        const scenarios = [];

        for (const scenarioPath of scenariosArray) {
            const scenarioBuffer = await extractFileFromZipBuffer(this.#data, scenarioPath);
            if (!scenarioBuffer) {
                console.warn('Warning: failed to extract BYAF scenario JSON');
            }
            if (scenarioBuffer) {
                try {
                    scenarios.push(JSON.parse(scenarioBuffer.toString()));
                } catch (error) {
                    console.warn('Warning: BYAF scenario is not a valid JSON', error);
                }
            }
        }

        if (scenarios.length === 0) {
            console.warn('Warning: BYAF manifest contains no valid scenarios');
            return [{}];
        }

        return scenarios;
    }

    /**
     * Extracts all character icon images from BYAF buffer.
     * @param {ByafCharacter} character Character object
     * @param {string} characterPath Path to the character in the BYAF manifest
     * @return {Promise<{filename: string, image: Buffer, label: string}[]>} Image buffer
     * @private
     */
    async getCharacterImages(character, characterPath) {
        const defaultAvatarBuffer = await fsPromises.readFile(DEFAULT_AVATAR_PATH);
        const characterImages = character?.images;

        if (!Array.isArray(characterImages) || characterImages.length === 0) {
            console.warn('Warning: BYAF character has no images');
            return [{ filename: '', image: defaultAvatarBuffer, label: '' }];
        }

        const imageBuffers = [];
        for (const image of characterImages) {
            const imagePath = image?.path;
            if (!imagePath) {
                console.warn('Warning: BYAF character image path is empty');
                continue;
            }

            const fullImagePath = urlJoin(path.dirname(characterPath), imagePath);
            const imageBuffer = await extractFileFromZipBuffer(this.#data, fullImagePath);
            if (!imageBuffer) {
                console.warn('Warning: failed to extract BYAF character image');
                continue;
            }

            imageBuffers.push({ filename: path.basename(imagePath), image: imageBuffer, label: image?.label || '' });
        }
        if (imageBuffers.length === 0) {
            console.warn('Warning: BYAF character has no valid images');
            return [{ filename: '', image: defaultAvatarBuffer, label: '' }];
        }
        return imageBuffers;
    }

    /**
     * Formats BYAF data as a character card.
     * @param {ByafManifest} manifest BYAF manifest
     * @param {ByafCharacter} character Character object
     * @param {Partial<ByafScenario>[]} scenarios Scenarios array
     * @return {TavernCardV2} Character card object
     * @private
     */
    getCharacterCard(manifest, character, scenarios) {
        return {
            spec: 'chara_card_v2',
            spec_version: '2.0',
            data: {
                name: character?.name || character?.displayName || '',
                description: ByafParser.replaceMacros(character?.persona),
                personality: '',
                scenario: ByafParser.replaceMacros(scenarios[0]?.narrative),
                first_mes: ByafParser.replaceMacros(scenarios[0]?.firstMessages?.[0]?.text),
                mes_example: ByafParser.formatExampleMessages(scenarios[0]?.exampleMessages),
                creator_notes: manifest?.author?.backyardURL || '', // To preserve the link to the author from BYAF manifest, this is a good place.
                system_prompt: ByafParser.replaceMacros(scenarios[0]?.formattingInstructions),
                post_history_instructions: '',
                alternate_greetings: this.formatAlternateGreetings(scenarios),
                character_book: this.convertCharacterBook(character?.loreItems),
                tags: character?.isNSFW ? ['nsfw'] : [], // Since there are no tags in BYAF spec, we can use this to preserve the isNSFW flag.
                creator: manifest?.author?.name || '',
                character_version: '',
                extensions: { ...(character?.displayName && { 'display_name': character?.displayName }) }, // Preserve display name unmodified using extensions. "display_name" is not used by SillyTavern currently.
            },
            // @ts-ignore Non-standard spec extension
            create_date: new Date().toISOString(),
        };
    }
    /**
     * Gets chat backgrounds from BYAF data mapped to their respective scenarios.
     * @param {ByafCharacter} character Character object
     * @param {Partial<ByafScenario>[]} scenarios Scenarios array
     * @returns {Promise<Array<ByafChatBackground>>} Chat backgrounds
     * @private
     */
    async getChatBackgrounds(character, scenarios) {
        // Implementation for extracting chat backgrounds from BYAF data
        const backgrounds = [];
        let i = 1;
        for (const scenario of scenarios) {
            const bgImagePath = scenario?.backgroundImage;
            if (bgImagePath) {
                const data = await extractFileFromZipBuffer(this.#data, bgImagePath);
                if (data) {
                    const existingIndex = backgrounds.findIndex(bg => bg.data.compare(data) === 0);
                    if (existingIndex !== -1) {
                        backgrounds[existingIndex].paths.push(bgImagePath);
                        continue; // Skip adding a new background since it already exists
                    }
                    backgrounds.push({
                        name: `${character?.name} bg ${i++}` || '',
                        data: data,
                        paths: [bgImagePath],
                    });
                }
            }
        }
        return backgrounds;
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
     * Imports a chat from BYAF format.
     * @param {Partial<ByafScenario>} scenario Scenario object
     * @param {string} userName User name
     * @param {string} characterName Character name
     * @param {Array<ByafChatBackground>} chatBackgrounds Chat backgrounds
     * @returns {string} Chat data
     */
    static getChatFromScenario(scenario, userName, characterName, chatBackgrounds) {
        const chatStartDate = scenario?.messages?.length == 0 ? new Date().toISOString() : scenario?.messages?.filter(m => 'createdAt' in m)[0].createdAt;
        const chatBackground = chatBackgrounds.find(bg => bg.paths.includes(scenario?.backgroundImage || ''))?.name || '';
        /** @type {object[]} */
        const chat = [{
            user_name: 'unused',
            character_name: 'unused',
            chat_metadata: {
                scenario: scenario?.narrative ?? '',
                mes_example: ByafParser.formatExampleMessages(scenario?.exampleMessages),
                system_prompt: ByafParser.replaceMacros(scenario?.formattingInstructions),
                mes_examples_optional: scenario?.canDeleteExampleMessages ?? false,
                byaf_model_settings: {
                    model: scenario?.model ?? '',
                    temperature: scenario?.temperature ?? 1.2,
                    top_k: scenario?.topK ?? 40,
                    top_p: scenario?.topP ?? 0.9,
                    min_p: scenario?.minP ?? 0.1,
                    min_p_enabled: scenario?.minPEnabled ?? true,
                    repeat_penalty: scenario?.repeatPenalty ?? 1.05,
                    repeat_penalty_tokens: scenario?.repeatLastN ?? 256,
                    by_prompt_template: scenario?.promptTemplate ?? 'general',
                    grammar: scenario?.grammar ?? null,
                },
                chat_backgrounds: chatBackground ? [chatBackground] : [],
                custom_background: chatBackground ? `url("${encodeURI(chatBackground)}")` : '',
            },
        }];
        // Add the first message IF it exists.
        if (scenario?.firstMessages?.length && scenario?.firstMessages?.length > 0 && scenario?.firstMessages?.[0]?.text) {
            chat.push({
                name: characterName,
                is_user: false,
                send_date: chatStartDate,
                mes: scenario?.firstMessages?.[0]?.text || '',
            });
        }

        const sortByTimestamp = (newest, curr) => {
            const aTime = new Date(newest.activeTimestamp);
            const bTime = new Date(curr.activeTimestamp);
            return aTime >= bTime ? newest : curr;
        };

        const getNewestAiMessage = (message) => {
            return message.outputs.reduce(sortByTimestamp);
        };
        const getSwipesForAiMessage = (aiMessage) => {
            return aiMessage.outputs.map(output => output.text);
        };

        const userMessages = scenario?.messages?.filter(msg => msg.type === 'human');
        const characterMessages = scenario?.messages?.filter(msg => msg.type === 'ai');
        /**
         * Reorders messages by interleaving user and character messages so that they are in correct chronological order.
         * This is only needed to import old chats from Backyard AI that were incorrectly imported by an earlier version
         * that completely messed up the order of messages. Backyard AI Windows frontend never supported creation of chats
         * with which were ordered like this in the first place, so for most users this is desired functionality.
         */
        if (userMessages && characterMessages && userMessages.length === characterMessages.length) { // Only do the reordering if there are equal numbers of user and character messages, otherwise just import in existing order, because it's probably correct already.
            for (let i = 0; i < userMessages.length; i++) {
                chat.push({
                    name: userName,
                    is_user: true,
                    send_date: Number(userMessages[i]?.createdAt),
                    mes: userMessages[i]?.text,
                });
                const aiMessage = getNewestAiMessage(characterMessages[i]);
                const aiSwipes = getSwipesForAiMessage(characterMessages[i]);
                chat.push({
                    name: characterName,
                    is_user: false,
                    send_date: Number(aiMessage.createdAt),
                    mes: aiMessage.text,
                    swipes: aiSwipes,
                    swipe_id: aiSwipes.findIndex(s => s === aiMessage.text),
                });
            }
        } else if (scenario?.messages) {
            for (const message of scenario.messages) {
                const isUser = message.type === 'human';
                const aiMessage = !isUser ? getNewestAiMessage(message) : null;
                const chatMessage = {
                    name: isUser ? userName : characterName,
                    is_user: isUser,
                    send_date: Number(isUser ? message.createdAt : aiMessage.createdAt),
                    mes: isUser ? message.text : aiMessage.text,
                };
                if (!isUser) {
                    const aiSwipes = getSwipesForAiMessage(message);
                    chatMessage.swipes = aiSwipes;
                    chatMessage.swipe_id = aiSwipes.findIndex(s => s === aiMessage.text);
                }
                chat.push(chatMessage);
            }
        } else {
            console.warn('Warning: BYAF scenario contained no messages property.');
        }

        return chat.map(obj => JSON.stringify(obj)).join('\n');
    }

    /**
     * Parses the BYAF data.
     * @return {Promise<ByafParseResult>} Parsed character card and image buffer
     */
    async parse() {
        const manifest = await this.getManifest();
        const { character, characterPath } = await this.getCharacterFromManifest(manifest);
        const scenarios = await this.getScenariosFromManifest(manifest);
        const images = await this.getCharacterImages(character, characterPath);
        const card = this.getCharacterCard(manifest, character, scenarios);
        const chatBackgrounds = await this.getChatBackgrounds(character, scenarios);
        return { card, images, scenarios, chatBackgrounds, character };
    }
}

export default ByafParser;
