const path = require('path');
const fs = require('fs');
const readline = require('readline');
const express = require('express');
const sanitize = require('sanitize-filename');
const writeFileAtomicSync = require('write-file-atomic').sync;
const yaml = require('yaml');
const _ = require('lodash');

const encode = require('png-chunks-encode');
const extract = require('png-chunks-extract');
const PNGtext = require('png-chunk-text');
const jimp = require('jimp');

const { DIRECTORIES, UPLOADS_PATH, AVATAR_WIDTH, AVATAR_HEIGHT } = require('../constants');
const { jsonParser, urlencodedParser } = require('../express-common');
const { deepMerge, humanizedISO8601DateTime, tryParse } = require('../util');
const { TavernCardValidator } = require('../validator/TavernCardValidator');
const characterCardParser = require('../character-card-parser.js');
const { readWorldInfoFile } = require('./worldinfo');
const { invalidateThumbnail } = require('./thumbnails');
const { importRisuSprites } = require('./sprites');
const defaultAvatarPath = './public/img/ai4.png';

let characters = {};

// KV-store for parsed character data
const characterDataCache = new Map();

/**
 * Reads the character card from the specified image file.
 * @param {string} img_url - Path to the image file
 * @param {string} input_format - 'png'
 * @returns {Promise<string | undefined>} - Character card data
 */
async function charaRead(img_url, input_format) {
    const stat = fs.statSync(img_url);
    const cacheKey = `${img_url}-${stat.mtimeMs}`;
    if (characterDataCache.has(cacheKey)) {
        return characterDataCache.get(cacheKey);
    }

    const result = characterCardParser.parse(img_url, input_format);
    characterDataCache.set(cacheKey, result);
    return result;
}

/**
 * @param {express.Response | undefined} response
 * @param {{file_name: string} | string} mes
 */
async function charaWrite(img_url, data, target_img, response = undefined, mes = 'ok', crop = undefined) {
    try {
        // Reset the cache
        for (const key of characterDataCache.keys()) {
            if (key.startsWith(img_url)) {
                characterDataCache.delete(key);
                break;
            }
        }
        // Read the image, resize, and save it as a PNG into the buffer
        const image = await tryReadImage(img_url, crop);

        // Get the chunks
        const chunks = extract(image);
        const tEXtChunks = chunks.filter(chunk => chunk.name === 'tEXt');

        // Remove all existing tEXt chunks
        for (let tEXtChunk of tEXtChunks) {
            chunks.splice(chunks.indexOf(tEXtChunk), 1);
        }
        // Add new chunks before the IEND chunk
        const base64EncodedData = Buffer.from(data, 'utf8').toString('base64');
        chunks.splice(-1, 0, PNGtext.encode('chara', base64EncodedData));
        //chunks.splice(-1, 0, text.encode('lorem', 'ipsum'));

        writeFileAtomicSync(DIRECTORIES.characters + target_img + '.png', Buffer.from(encode(chunks)));
        if (response !== undefined) response.send(mes);
        return true;
    } catch (err) {
        console.log(err);
        if (response !== undefined) response.status(500).send(err);
        return false;
    }
}

async function tryReadImage(img_url, crop) {
    try {
        let rawImg = await jimp.read(img_url);
        let final_width = rawImg.bitmap.width, final_height = rawImg.bitmap.height;

        // Apply crop if defined
        if (typeof crop == 'object' && [crop.x, crop.y, crop.width, crop.height].every(x => typeof x === 'number')) {
            rawImg = rawImg.crop(crop.x, crop.y, crop.width, crop.height);
            // Apply standard resize if requested
            if (crop.want_resize) {
                final_width = AVATAR_WIDTH;
                final_height = AVATAR_HEIGHT;
            } else {
                final_width = crop.width;
                final_height = crop.height;
            }
        }

        const image = await rawImg.cover(final_width, final_height).getBufferAsync(jimp.MIME_PNG);
        return image;
    }
    // If it's an unsupported type of image (APNG) - just read the file as buffer
    catch {
        return fs.readFileSync(img_url);
    }
}

/**
 * calculateChatSize - Calculates the total chat size for a given character.
 *
 * @param  {string} charDir The directory where the chats are stored.
 * @return { {chatSize: number, dateLastChat: number} }         The total chat size.
 */
const calculateChatSize = (charDir) => {
    let chatSize = 0;
    let dateLastChat = 0;

    if (fs.existsSync(charDir)) {
        const chats = fs.readdirSync(charDir);
        if (Array.isArray(chats) && chats.length) {
            for (const chat of chats) {
                const chatStat = fs.statSync(path.join(charDir, chat));
                chatSize += chatStat.size;
                dateLastChat = Math.max(dateLastChat, chatStat.mtimeMs);
            }
        }
    }

    return { chatSize, dateLastChat };
};

// Calculate the total string length of the data object
const calculateDataSize = (data) => {
    return typeof data === 'object' ? Object.values(data).reduce((acc, val) => acc + new String(val).length, 0) : 0;
};

/**
 * processCharacter - Process a given character, read its data and calculate its statistics.
 *
 * @param  {string} item The name of the character.
 * @param  {number} i    The index of the character in the characters list.
 * @return {Promise}     A Promise that resolves when the character processing is done.
 */
const processCharacter = async (item, i) => {
    try {
        const img_data = await charaRead(DIRECTORIES.characters + item);
        if (img_data === undefined) throw new Error('Failed to read character file');

        let jsonObject = getCharaCardV2(JSON.parse(img_data));
        jsonObject.avatar = item;
        characters[i] = jsonObject;
        characters[i]['json_data'] = img_data;
        const charStat = fs.statSync(path.join(DIRECTORIES.characters, item));
        characters[i]['date_added'] = charStat.birthtimeMs;
        characters[i]['create_date'] = jsonObject['create_date'] || humanizedISO8601DateTime(charStat.birthtimeMs);
        const char_dir = path.join(DIRECTORIES.chats, item.replace('.png', ''));

        const { chatSize, dateLastChat } = calculateChatSize(char_dir);
        characters[i]['chat_size'] = chatSize;
        characters[i]['date_last_chat'] = dateLastChat;
        characters[i]['data_size'] = calculateDataSize(jsonObject?.data);
    }
    catch (err) {
        characters[i] = {
            date_added: 0,
            date_last_chat: 0,
            chat_size: 0,
        };

        console.log(`Could not process character: ${item}`);

        if (err instanceof SyntaxError) {
            console.log('String [' + i + '] is not valid JSON!');
        } else {
            console.log('An unexpected error occurred: ', err);
        }
    }
};

function getCharaCardV2(jsonObject) {
    if (jsonObject.spec === undefined) {
        jsonObject = convertToV2(jsonObject);
    } else {
        jsonObject = readFromV2(jsonObject);
    }
    return jsonObject;
}

function convertToV2(char) {
    // Simulate incoming data from frontend form
    const result = charaFormatData({
        json_data: JSON.stringify(char),
        ch_name: char.name,
        description: char.description,
        personality: char.personality,
        scenario: char.scenario,
        first_mes: char.first_mes,
        mes_example: char.mes_example,
        creator_notes: char.creatorcomment,
        talkativeness: char.talkativeness,
        fav: char.fav,
        creator: char.creator,
        tags: char.tags,
        depth_prompt_prompt: char.depth_prompt_prompt,
        depth_prompt_response: char.depth_prompt_response,
    });

    result.chat = char.chat ?? humanizedISO8601DateTime();
    result.create_date = char.create_date ?? humanizedISO8601DateTime();
    return result;
}


function unsetFavFlag(char) {
    _.set(char, 'fav', false);
    _.set(char, 'data.extensions.fav', false);
}

function readFromV2(char) {
    if (_.isUndefined(char.data)) {
        console.warn(`Char ${char['name']} has Spec v2 data missing`);
        return char;
    }

    const fieldMappings = {
        name: 'name',
        description: 'description',
        personality: 'personality',
        scenario: 'scenario',
        first_mes: 'first_mes',
        mes_example: 'mes_example',
        talkativeness: 'extensions.talkativeness',
        fav: 'extensions.fav',
        tags: 'tags',
    };

    _.forEach(fieldMappings, (v2Path, charField) => {
        //console.log(`Migrating field: ${charField} from ${v2Path}`);
        const v2Value = _.get(char.data, v2Path);
        if (_.isUndefined(v2Value)) {
            let defaultValue = undefined;

            // Backfill default values for missing ST extension fields
            if (v2Path === 'extensions.talkativeness') {
                defaultValue = 0.5;
            }

            if (v2Path === 'extensions.fav') {
                defaultValue = false;
            }

            if (!_.isUndefined(defaultValue)) {
                //console.debug(`Spec v2 extension data missing for field: ${charField}, using default value: ${defaultValue}`);
                char[charField] = defaultValue;
            } else {
                console.debug(`Char ${char['name']} has Spec v2 data missing for unknown field: ${charField}`);
                return;
            }
        }
        if (!_.isUndefined(char[charField]) && !_.isUndefined(v2Value) && String(char[charField]) !== String(v2Value)) {
            console.debug(`Char ${char['name']} has Spec v2 data mismatch with Spec v1 for field: ${charField}`, char[charField], v2Value);
        }
        char[charField] = v2Value;
    });

    char['chat'] = char['chat'] ?? humanizedISO8601DateTime();

    return char;
}

//***************** Main functions
function charaFormatData(data) {
    // This is supposed to save all the foreign keys that ST doesn't care about
    const char = tryParse(data.json_data) || {};

    // Checks if data.alternate_greetings is an array, a string, or neither, and acts accordingly. (expected to be an array of strings)
    const getAlternateGreetings = data => {
        if (Array.isArray(data.alternate_greetings)) return data.alternate_greetings;
        if (typeof data.alternate_greetings === 'string') return [data.alternate_greetings];
        return [];
    };

    // Spec V1 fields
    _.set(char, 'name', data.ch_name);
    _.set(char, 'description', data.description || '');
    _.set(char, 'personality', data.personality || '');
    _.set(char, 'scenario', data.scenario || '');
    _.set(char, 'first_mes', data.first_mes || '');
    _.set(char, 'mes_example', data.mes_example || '');

    // Old ST extension fields (for backward compatibility, will be deprecated)
    _.set(char, 'creatorcomment', data.creator_notes);
    _.set(char, 'avatar', 'none');
    _.set(char, 'chat', data.ch_name + ' - ' + humanizedISO8601DateTime());
    _.set(char, 'talkativeness', data.talkativeness);
    _.set(char, 'fav', data.fav == 'true');
    _.set(char, 'tags', typeof data.tags == 'string' ? (data.tags.split(',').map(x => x.trim()).filter(x => x)) : data.tags || []);

    // Spec V2 fields
    _.set(char, 'spec', 'chara_card_v2');
    _.set(char, 'spec_version', '2.0');
    _.set(char, 'data.name', data.ch_name);
    _.set(char, 'data.description', data.description || '');
    _.set(char, 'data.personality', data.personality || '');
    _.set(char, 'data.scenario', data.scenario || '');
    _.set(char, 'data.first_mes', data.first_mes || '');
    _.set(char, 'data.mes_example', data.mes_example || '');

    // New V2 fields
    _.set(char, 'data.creator_notes', data.creator_notes || '');
    _.set(char, 'data.system_prompt', data.system_prompt || '');
    _.set(char, 'data.post_history_instructions', data.post_history_instructions || '');
    _.set(char, 'data.tags', typeof data.tags == 'string' ? (data.tags.split(',').map(x => x.trim()).filter(x => x)) : data.tags || []);
    _.set(char, 'data.creator', data.creator || '');
    _.set(char, 'data.character_version', data.character_version || '');
    _.set(char, 'data.alternate_greetings', getAlternateGreetings(data));

    // ST extension fields to V2 object
    _.set(char, 'data.extensions.talkativeness', data.talkativeness);
    _.set(char, 'data.extensions.fav', data.fav == 'true');
    _.set(char, 'data.extensions.world', data.world || '');

    // Spec extension: depth prompt
    const depth_default = 4;
    const depth_value = !isNaN(Number(data.depth_prompt_depth)) ? Number(data.depth_prompt_depth) : depth_default;
    _.set(char, 'data.extensions.depth_prompt.prompt', data.depth_prompt_prompt ?? '');
    _.set(char, 'data.extensions.depth_prompt.depth', depth_value);
    //_.set(char, 'data.extensions.create_date', humanizedISO8601DateTime());
    //_.set(char, 'data.extensions.avatar', 'none');
    //_.set(char, 'data.extensions.chat', data.ch_name + ' - ' + humanizedISO8601DateTime());

    if (data.world) {
        try {
            const file = readWorldInfoFile(data.world, false);

            // File was imported - save it to the character book
            if (file && file.originalData) {
                _.set(char, 'data.character_book', file.originalData);
            }

            // File was not imported - convert the world info to the character book
            if (file && file.entries) {
                _.set(char, 'data.character_book', convertWorldInfoToCharacterBook(data.world, file.entries));
            }

        } catch {
            console.debug(`Failed to read world info file: ${data.world}. Character book will not be available.`);
        }
    }

    return char;
}

/**
 * @param {string} name Name of World Info file
 * @param {object} entries Entries object
 */
function convertWorldInfoToCharacterBook(name, entries) {
    /** @type {{ entries: object[]; name: string }} */
    const result = { entries: [], name };

    for (const index in entries) {
        const entry = entries[index];

        const originalEntry = {
            id: entry.uid,
            keys: entry.key,
            secondary_keys: entry.keysecondary,
            comment: entry.comment,
            content: entry.content,
            constant: entry.constant,
            selective: entry.selective,
            insertion_order: entry.order,
            enabled: !entry.disable,
            position: entry.position == 0 ? 'before_char' : 'after_char',
            extensions: {
                position: entry.position,
                exclude_recursion: entry.excludeRecursion,
                display_index: entry.displayIndex,
                probability: entry.probability ?? null,
                useProbability: entry.useProbability ?? false,
                depth: entry.depth ?? 4,
                selectiveLogic: entry.selectiveLogic ?? 0,
                group: entry.group ?? '',
                prevent_recursion: entry.preventRecursion ?? false,
                scan_depth: entry.scanDepth ?? null,
                match_whole_words: entry.matchWholeWords ?? null,
                case_sensitive: entry.caseSensitive ?? null,
            },
        };

        result.entries.push(originalEntry);
    }

    return result;
}

/**
 * Import a character from a YAML file.
 * @param {string} uploadPath Path to the uploaded file
 * @param {import('express').Response} response Express response object
 */
function importFromYaml(uploadPath, response) {
    const fileText = fs.readFileSync(uploadPath, 'utf8');
    fs.rmSync(uploadPath);
    const yamlData = yaml.parse(fileText);
    console.log('importing from yaml');
    yamlData.name = sanitize(yamlData.name);
    const fileName = getPngName(yamlData.name);
    let char = convertToV2({
        'name': yamlData.name,
        'description': yamlData.context ?? '',
        'first_mes': yamlData.greeting ?? '',
        'create_date': humanizedISO8601DateTime(),
        'chat': `${yamlData.name} - ${humanizedISO8601DateTime()}`,
        'personality': '',
        'creatorcomment': '',
        'avatar': 'none',
        'mes_example': '',
        'scenario': '',
        'talkativeness': 0.5,
        'creator': '',
        'tags': '',
    });
    charaWrite(defaultAvatarPath, JSON.stringify(char), fileName, response, { file_name: fileName });
}

const router = express.Router();

router.post('/create', urlencodedParser, async function (request, response) {
    if (!request.body) return response.sendStatus(400);

    request.body.ch_name = sanitize(request.body.ch_name);

    const char = JSON.stringify(charaFormatData(request.body));
    const internalName = getPngName(request.body.ch_name);
    const avatarName = `${internalName}.png`;
    const defaultAvatar = './public/img/ai4.png';
    const chatsPath = DIRECTORIES.chats + internalName; //path.join(chatsPath, internalName);

    if (!fs.existsSync(chatsPath)) fs.mkdirSync(chatsPath);

    if (!request.file) {
        charaWrite(defaultAvatar, char, internalName, response, avatarName);
    } else {
        const crop = tryParse(request.query.crop);
        const uploadPath = path.join(UPLOADS_PATH, request.file.filename);
        await charaWrite(uploadPath, char, internalName, response, avatarName, crop);
        fs.unlinkSync(uploadPath);
    }
});

router.post('/rename', jsonParser, async function (request, response) {
    if (!request.body.avatar_url || !request.body.new_name) {
        return response.sendStatus(400);
    }

    const oldAvatarName = request.body.avatar_url;
    const newName = sanitize(request.body.new_name);
    const oldInternalName = path.parse(request.body.avatar_url).name;
    const newInternalName = getPngName(newName);
    const newAvatarName = `${newInternalName}.png`;

    const oldAvatarPath = path.join(DIRECTORIES.characters, oldAvatarName);

    const oldChatsPath = path.join(DIRECTORIES.chats, oldInternalName);
    const newChatsPath = path.join(DIRECTORIES.chats, newInternalName);

    try {
        // Read old file, replace name int it
        const rawOldData = await charaRead(oldAvatarPath);
        if (rawOldData === undefined) throw new Error('Failed to read character file');

        const oldData = getCharaCardV2(JSON.parse(rawOldData));
        _.set(oldData, 'data.name', newName);
        _.set(oldData, 'name', newName);
        const newData = JSON.stringify(oldData);

        // Write data to new location
        await charaWrite(oldAvatarPath, newData, newInternalName);

        // Rename chats folder
        if (fs.existsSync(oldChatsPath) && !fs.existsSync(newChatsPath)) {
            fs.renameSync(oldChatsPath, newChatsPath);
        }

        // Remove the old character file
        fs.rmSync(oldAvatarPath);

        // Return new avatar name to ST
        return response.send({ 'avatar': newAvatarName });
    }
    catch (err) {
        console.error(err);
        return response.sendStatus(500);
    }
});

router.post('/edit', urlencodedParser, async function (request, response) {
    if (!request.body) {
        console.error('Error: no response body detected');
        response.status(400).send('Error: no response body detected');
        return;
    }

    if (request.body.ch_name === '' || request.body.ch_name === undefined || request.body.ch_name === '.') {
        console.error('Error: invalid name.');
        response.status(400).send('Error: invalid name.');
        return;
    }

    let char = charaFormatData(request.body);
    char.chat = request.body.chat;
    char.create_date = request.body.create_date;
    char = JSON.stringify(char);
    let target_img = (request.body.avatar_url).replace('.png', '');

    try {
        if (!request.file) {
            const avatarPath = path.join(DIRECTORIES.characters, request.body.avatar_url);
            await charaWrite(avatarPath, char, target_img, response, 'Character saved');
        } else {
            const crop = tryParse(request.query.crop);
            const newAvatarPath = path.join(UPLOADS_PATH, request.file.filename);
            invalidateThumbnail('avatar', request.body.avatar_url);
            await charaWrite(newAvatarPath, char, target_img, response, 'Character saved', crop);
            fs.unlinkSync(newAvatarPath);
        }
    }
    catch {
        console.error('An error occured, character edit invalidated.');
    }
});


/**
 * Handle a POST request to edit a character attribute.
 *
 * This function reads the character data from a file, updates the specified attribute,
 * and writes the updated data back to the file.
 *
 * @param {Object} request - The HTTP request object.
 * @param {Object} response - The HTTP response object.
 * @returns {void}
 */
router.post('/edit-attribute', jsonParser, async function (request, response) {
    console.log(request.body);
    if (!request.body) {
        console.error('Error: no response body detected');
        response.status(400).send('Error: no response body detected');
        return;
    }

    if (request.body.ch_name === '' || request.body.ch_name === undefined || request.body.ch_name === '.') {
        console.error('Error: invalid name.');
        response.status(400).send('Error: invalid name.');
        return;
    }

    try {
        const avatarPath = path.join(DIRECTORIES.characters, request.body.avatar_url);
        let charJSON = await charaRead(avatarPath);
        if (typeof charJSON !== 'string') throw new Error('Failed to read character file');

        let char = JSON.parse(charJSON);
        //check if the field exists
        if (char[request.body.field] === undefined && char.data[request.body.field] === undefined) {
            console.error('Error: invalid field.');
            response.status(400).send('Error: invalid field.');
            return;
        }
        char[request.body.field] = request.body.value;
        char.data[request.body.field] = request.body.value;
        let newCharJSON = JSON.stringify(char);
        await charaWrite(avatarPath, newCharJSON, (request.body.avatar_url).replace('.png', ''), response, 'Character saved');
    } catch (err) {
        console.error('An error occured, character edit invalidated.', err);
    }
});

/**
 * Handle a POST request to edit character properties.
 *
 * Merges the request body with the selected character and
 * validates the result against TavernCard V2 specification.
 *
 * @param {Object} request - The HTTP request object.
 * @param {Object} response - The HTTP response object.
 *
 * @returns {void}
 * */
router.post('/merge-attributes', jsonParser, async function (request, response) {
    const update = request.body;
    const avatarPath = path.join(DIRECTORIES.characters, update.avatar);

    try {
        const pngStringData = await charaRead(avatarPath);

        if (!pngStringData) {
            console.error('Error: invalid character file.');
            response.status(400).send('Error: invalid character file.');
            return;
        }

        let character = JSON.parse(pngStringData);
        character = deepMerge(character, update);

        const validator = new TavernCardValidator(character);

        //Accept either V1 or V2.
        if (validator.validate()) {
            await charaWrite(
                avatarPath,
                JSON.stringify(character),
                (update.avatar).replace('.png', ''),
                response,
                'Character saved',
            );
        } else {
            console.log(validator.lastValidationError);
            response.status(400).send({ message: `Validation failed for ${character.name}`, error: validator.lastValidationError });
        }
    } catch (exception) {
        response.status(500).send({ message: 'Unexpected error while saving character.', error: exception.toString() });
    }
});

router.post('/delete', jsonParser, async function (request, response) {
    if (!request.body || !request.body.avatar_url) {
        return response.sendStatus(400);
    }

    if (request.body.avatar_url !== sanitize(request.body.avatar_url)) {
        console.error('Malicious filename prevented');
        return response.sendStatus(403);
    }

    const avatarPath = DIRECTORIES.characters + request.body.avatar_url;
    if (!fs.existsSync(avatarPath)) {
        return response.sendStatus(400);
    }

    fs.rmSync(avatarPath);
    invalidateThumbnail('avatar', request.body.avatar_url);
    let dir_name = (request.body.avatar_url.replace('.png', ''));

    if (!dir_name.length) {
        console.error('Malicious dirname prevented');
        return response.sendStatus(403);
    }

    if (request.body.delete_chats == true) {
        try {
            await fs.promises.rm(path.join(DIRECTORIES.chats, sanitize(dir_name)), { recursive: true, force: true });
        } catch (err) {
            console.error(err);
            return response.sendStatus(500);
        }
    }

    return response.sendStatus(200);
});

/**
 * HTTP POST endpoint for the "/api/characters/all" route.
 *
 * This endpoint is responsible for reading character files from the `charactersPath` directory,
 * parsing character data, calculating stats for each character and responding with the data.
 * Stats are calculated only on the first run, on subsequent runs the stats are fetched from
 * the `charStats` variable.
 * The stats are calculated by the `calculateStats` function.
 * The characters are processed by the `processCharacter` function.
 *
 * @param  {object}   request  The HTTP request object.
 * @param  {object}   response The HTTP response object.
 * @return {undefined}         Does not return a value.
 */
router.post('/all', jsonParser, function (request, response) {
    fs.readdir(DIRECTORIES.characters, async (err, files) => {
        if (err) {
            console.error(err);
            return;
        }

        const pngFiles = files.filter(file => file.endsWith('.png'));
        characters = {};

        let processingPromises = pngFiles.map((file, index) => processCharacter(file, index));
        await Promise.all(processingPromises); performance.mark('B');

        // Filter out invalid/broken characters
        characters = Object.values(characters).filter(x => x?.name).reduce((acc, val, index) => {
            acc[index] = val;
            return acc;
        }, {});

        response.send(JSON.stringify(characters));
    });
});

router.post('/get', jsonParser, async function (request, response) {
    if (!request.body) return response.sendStatus(400);
    const item = request.body.avatar_url;
    const filePath = path.join(DIRECTORIES.characters, item);

    if (!fs.existsSync(filePath)) {
        return response.sendStatus(404);
    }

    characters = {};
    await processCharacter(item, 0);

    return response.send(characters[0]);
});

router.post('/chats', jsonParser, async function (request, response) {
    if (!request.body) return response.sendStatus(400);

    const characterDirectory = (request.body.avatar_url).replace('.png', '');

    try {
        const chatsDirectory = path.join(DIRECTORIES.chats, characterDirectory);
        const files = fs.readdirSync(chatsDirectory);
        const jsonFiles = files.filter(file => path.extname(file) === '.jsonl');

        if (jsonFiles.length === 0) {
            response.send({ error: true });
            return;
        }

        const jsonFilesPromise = jsonFiles.map((file) => {
            return new Promise(async (res) => {
                const pathToFile = path.join(DIRECTORIES.chats, characterDirectory, file);
                const fileStream = fs.createReadStream(pathToFile);
                const stats = fs.statSync(pathToFile);
                const fileSizeInKB = `${(stats.size / 1024).toFixed(2)}kb`;

                const rl = readline.createInterface({
                    input: fileStream,
                    crlfDelay: Infinity,
                });

                let lastLine;
                let itemCounter = 0;
                rl.on('line', (line) => {
                    itemCounter++;
                    lastLine = line;
                });
                rl.on('close', () => {
                    rl.close();

                    if (lastLine) {
                        const jsonData = tryParse(lastLine);
                        if (jsonData && (jsonData.name || jsonData.character_name)) {
                            const chatData = {};

                            chatData['file_name'] = file;
                            chatData['file_size'] = fileSizeInKB;
                            chatData['chat_items'] = itemCounter - 1;
                            chatData['mes'] = jsonData['mes'] || '[The chat is empty]';
                            chatData['last_mes'] = jsonData['send_date'] || Date.now();

                            res(chatData);
                        } else {
                            console.log('Found an invalid or corrupted chat file:', pathToFile);
                            res({});
                        }
                    }
                });
            });
        });

        const chatData = await Promise.all(jsonFilesPromise);
        const validFiles = chatData.filter(i => i.file_name);

        return response.send(validFiles);
    } catch (error) {
        console.log(error);
        return response.send({ error: true });
    }
});

function getPngName(file) {
    let i = 1;
    let base_name = file;
    while (fs.existsSync(DIRECTORIES.characters + file + '.png')) {
        file = base_name + i;
        i++;
    }
    return file;
}

router.post('/import', urlencodedParser, async function (request, response) {
    if (!request.body || !request.file) return response.sendStatus(400);

    let png_name = '';
    let filedata = request.file;
    let uploadPath = path.join(UPLOADS_PATH, filedata.filename);
    let format = request.body.file_type;

    if (format == 'yaml' || format == 'yml') {
        try {
            importFromYaml(uploadPath, response);
        } catch (err) {
            console.log(err);
            response.send({ error: true });
        }
    } else if (format == 'json') {
        fs.readFile(uploadPath, 'utf8', async (err, data) => {
            fs.unlinkSync(uploadPath);

            if (err) {
                console.log(err);
                response.send({ error: true });
            }

            let jsonData = JSON.parse(data);

            if (jsonData.spec !== undefined) {
                console.log('importing from v2 json');
                importRisuSprites(jsonData);
                unsetFavFlag(jsonData);
                jsonData = readFromV2(jsonData);
                jsonData['create_date'] = humanizedISO8601DateTime();
                png_name = getPngName(jsonData.data?.name || jsonData.name);
                let char = JSON.stringify(jsonData);
                charaWrite(defaultAvatarPath, char, png_name, response, { file_name: png_name });
            } else if (jsonData.name !== undefined) {
                console.log('importing from v1 json');
                jsonData.name = sanitize(jsonData.name);
                if (jsonData.creator_notes) {
                    jsonData.creator_notes = jsonData.creator_notes.replace('Creator\'s notes go here.', '');
                }
                png_name = getPngName(jsonData.name);
                let char = {
                    'name': jsonData.name,
                    'description': jsonData.description ?? '',
                    'creatorcomment': jsonData.creatorcomment ?? jsonData.creator_notes ?? '',
                    'personality': jsonData.personality ?? '',
                    'first_mes': jsonData.first_mes ?? '',
                    'avatar': 'none',
                    'chat': jsonData.name + ' - ' + humanizedISO8601DateTime(),
                    'mes_example': jsonData.mes_example ?? '',
                    'scenario': jsonData.scenario ?? '',
                    'create_date': humanizedISO8601DateTime(),
                    'talkativeness': jsonData.talkativeness ?? 0.5,
                    'creator': jsonData.creator ?? '',
                    'tags': jsonData.tags ?? '',
                };
                char = convertToV2(char);
                let charJSON = JSON.stringify(char);
                charaWrite(defaultAvatarPath, charJSON, png_name, response, { file_name: png_name });
            } else if (jsonData.char_name !== undefined) {//json Pygmalion notepad
                console.log('importing from gradio json');
                jsonData.char_name = sanitize(jsonData.char_name);
                if (jsonData.creator_notes) {
                    jsonData.creator_notes = jsonData.creator_notes.replace('Creator\'s notes go here.', '');
                }
                png_name = getPngName(jsonData.char_name);
                let char = {
                    'name': jsonData.char_name,
                    'description': jsonData.char_persona ?? '',
                    'creatorcomment': jsonData.creatorcomment ?? jsonData.creator_notes ?? '',
                    'personality': '',
                    'first_mes': jsonData.char_greeting ?? '',
                    'avatar': 'none',
                    'chat': jsonData.name + ' - ' + humanizedISO8601DateTime(),
                    'mes_example': jsonData.example_dialogue ?? '',
                    'scenario': jsonData.world_scenario ?? '',
                    'create_date': humanizedISO8601DateTime(),
                    'talkativeness': jsonData.talkativeness ?? 0.5,
                    'creator': jsonData.creator ?? '',
                    'tags': jsonData.tags ?? '',
                };
                char = convertToV2(char);
                let charJSON = JSON.stringify(char);
                charaWrite(defaultAvatarPath, charJSON, png_name, response, { file_name: png_name });
            } else {
                console.log('Incorrect character format .json');
                response.send({ error: true });
            }
        });
    } else {
        try {
            var img_data = await charaRead(uploadPath, format);
            if (img_data === undefined) throw new Error('Failed to read character data');

            let jsonData = JSON.parse(img_data);

            jsonData.name = sanitize(jsonData.data?.name || jsonData.name);
            png_name = getPngName(jsonData.name);

            if (jsonData.spec !== undefined) {
                console.log('Found a v2 character file.');
                importRisuSprites(jsonData);
                unsetFavFlag(jsonData);
                jsonData = readFromV2(jsonData);
                jsonData['create_date'] = humanizedISO8601DateTime();
                const char = JSON.stringify(jsonData);
                await charaWrite(uploadPath, char, png_name, response, { file_name: png_name });
                fs.unlinkSync(uploadPath);
            } else if (jsonData.name !== undefined) {
                console.log('Found a v1 character file.');

                if (jsonData.creator_notes) {
                    jsonData.creator_notes = jsonData.creator_notes.replace('Creator\'s notes go here.', '');
                }

                let char = {
                    'name': jsonData.name,
                    'description': jsonData.description ?? '',
                    'creatorcomment': jsonData.creatorcomment ?? jsonData.creator_notes ?? '',
                    'personality': jsonData.personality ?? '',
                    'first_mes': jsonData.first_mes ?? '',
                    'avatar': 'none',
                    'chat': jsonData.name + ' - ' + humanizedISO8601DateTime(),
                    'mes_example': jsonData.mes_example ?? '',
                    'scenario': jsonData.scenario ?? '',
                    'create_date': humanizedISO8601DateTime(),
                    'talkativeness': jsonData.talkativeness ?? 0.5,
                    'creator': jsonData.creator ?? '',
                    'tags': jsonData.tags ?? '',
                };
                char = convertToV2(char);
                const charJSON = JSON.stringify(char);
                await charaWrite(uploadPath, charJSON, png_name, response, { file_name: png_name });
                fs.unlinkSync(uploadPath);
            } else {
                console.log('Unknown character card format');
                response.send({ error: true });
            }
        } catch (err) {
            console.log(err);
            response.send({ error: true });
        }
    }
});

router.post('/duplicate', jsonParser, async function (request, response) {
    try {
        if (!request.body.avatar_url) {
            console.log('avatar URL not found in request body');
            console.log(request.body);
            return response.sendStatus(400);
        }
        let filename = path.join(DIRECTORIES.characters, sanitize(request.body.avatar_url));
        if (!fs.existsSync(filename)) {
            console.log('file for dupe not found');
            console.log(filename);
            return response.sendStatus(404);
        }
        let suffix = 1;
        let newFilename = filename;

        // If filename ends with a _number, increment the number
        const nameParts = path.basename(filename, path.extname(filename)).split('_');
        const lastPart = nameParts[nameParts.length - 1];

        let baseName;

        if (!isNaN(Number(lastPart)) && nameParts.length > 1) {
            suffix = parseInt(lastPart) + 1;
            baseName = nameParts.slice(0, -1).join('_'); // construct baseName without suffix
        } else {
            baseName = nameParts.join('_'); // original filename is completely the baseName
        }

        newFilename = path.join(DIRECTORIES.characters, `${baseName}_${suffix}${path.extname(filename)}`);

        while (fs.existsSync(newFilename)) {
            let suffixStr = '_' + suffix;
            newFilename = path.join(DIRECTORIES.characters, `${baseName}${suffixStr}${path.extname(filename)}`);
            suffix++;
        }

        fs.copyFileSync(filename, newFilename);
        console.log(`${filename} was copied to ${newFilename}`);
        response.sendStatus(200);
    }
    catch (error) {
        console.error(error);
        return response.send({ error: true });
    }
});

router.post('/export', jsonParser, async function (request, response) {
    if (!request.body.format || !request.body.avatar_url) {
        return response.sendStatus(400);
    }

    let filename = path.join(DIRECTORIES.characters, sanitize(request.body.avatar_url));

    if (!fs.existsSync(filename)) {
        return response.sendStatus(404);
    }

    switch (request.body.format) {
        case 'png':
            return response.sendFile(filename, { root: process.cwd() });
        case 'json': {
            try {
                let json = await charaRead(filename);
                if (json === undefined) return response.sendStatus(400);
                let jsonObject = getCharaCardV2(JSON.parse(json));
                return response.type('json').send(JSON.stringify(jsonObject, null, 4));
            }
            catch {
                return response.sendStatus(400);
            }
        }
    }

    return response.sendStatus(400);
});

module.exports = { router };
