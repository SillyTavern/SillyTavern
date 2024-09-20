const fs = require('fs');
const path = require('path');
const readline = require('readline');
const express = require('express');
const sanitize = require('sanitize-filename');
const writeFileAtomicSync = require('write-file-atomic').sync;
const _ = require('lodash');

const { jsonParser, urlencodedParser } = require('../express-common');
const { getConfigValue, humanizedISO8601DateTime, tryParse, generateTimestamp, removeOldBackups } = require('../util');

/**
 * Saves a chat to the backups directory.
 * @param {string} directory The user's backups directory.
 * @param {string} name The name of the chat.
 * @param {string} chat The serialized chat to save.
 */
function backupChat(directory, name, chat) {
    try {
        const isBackupDisabled = getConfigValue('disableChatBackup', false);

        if (isBackupDisabled) {
            return;
        }

        // replace non-alphanumeric characters with underscores
        name = sanitize(name).replace(/[^a-z0-9]/gi, '_').toLowerCase();

        const backupFile = path.join(directory, `chat_${name}_${generateTimestamp()}.jsonl`);
        writeFileAtomicSync(backupFile, chat, 'utf-8');

        removeOldBackups(directory, `chat_${name}_`);
    } catch (err) {
        console.log(`Could not backup chat for ${name}`, err);
    }
}

const backupFunctions = new Map();

/**
 * Gets a backup function for a user.
 * @param {string} handle User handle
 * @returns {function(string, string, string): void} Backup function
 */
function getBackupFunction(handle) {
    const throttleInterval = getConfigValue('chatBackupThrottleInterval', 10_000);
    if (!backupFunctions.has(handle)) {
        backupFunctions.set(handle, _.throttle(backupChat, throttleInterval, { leading: true, trailing: true }));
    }
    return backupFunctions.get(handle);
}

process.on('exit', () => {
    for (const func of backupFunctions.values()) {
        func.flush();
    }
});

/**
 * Imports a chat from Ooba's format.
 * @param {string} userName User name
 * @param {string} characterName Character name
 * @param {object} jsonData JSON data
 * @returns {string} Chat data
 */
function importOobaChat(userName, characterName, jsonData) {
    /** @type {object[]} */
    const chat = [{
        user_name: userName,
        character_name: characterName,
        create_date: humanizedISO8601DateTime(),
    }];

    for (const arr of jsonData.data_visible) {
        if (arr[0]) {
            const userMessage = {
                name: userName,
                is_user: true,
                send_date: humanizedISO8601DateTime(),
                mes: arr[0],
            };
            chat.push(userMessage);
        }
        if (arr[1]) {
            const charMessage = {
                name: characterName,
                is_user: false,
                send_date: humanizedISO8601DateTime(),
                mes: arr[1],
            };
            chat.push(charMessage);
        }
    }

    return chat.map(obj => JSON.stringify(obj)).join('\n');
}

/**
 * Imports a chat from Agnai's format.
 * @param {string} userName User name
 * @param {string} characterName Character name
 * @param {object} jsonData Chat data
 * @returns {string} Chat data
 */
function importAgnaiChat(userName, characterName, jsonData) {
    /** @type {object[]} */
    const chat = [{
        user_name: userName,
        character_name: characterName,
        create_date: humanizedISO8601DateTime(),
    }];

    for (const message of jsonData.messages) {
        const isUser = !!message.userId;
        chat.push({
            name: isUser ? userName : characterName,
            is_user: isUser,
            send_date: humanizedISO8601DateTime(),
            mes: message.msg,
        });
    }

    return chat.map(obj => JSON.stringify(obj)).join('\n');
}

/**
 * Imports a chat from CAI Tools format.
 * @param {string} userName User name
 * @param {string} characterName Character name
 * @param {object} jsonData JSON data
 * @returns {string[]} Converted data
 */
function importCAIChat(userName, characterName, jsonData) {
    /**
     * Converts the chat data to suitable format.
     * @param {object} history Imported chat data
     * @returns {object[]} Converted chat data
     */
    function convert(history) {
        const starter = {
            user_name: userName,
            character_name: characterName,
            create_date: humanizedISO8601DateTime(),
        };

        const historyData = history.msgs.map((msg) => ({
            name: msg.src.is_human ? userName : characterName,
            is_user: msg.src.is_human,
            send_date: humanizedISO8601DateTime(),
            mes: msg.text,
        }));

        return [starter, ...historyData];
    }

    const newChats = (jsonData.histories.histories ?? []).map(history => newChats.push(convert(history).map(obj => JSON.stringify(obj)).join('\n')));
    return newChats;
}

/**
 * Flattens `msg` and `swipes` data from Chub Chat format.
 * Only changes enough to make it compatible with the standard chat serialization format.
 * @param {string} userName User name
 * @param {string} characterName Character name
 * @param {string[]} lines serialised JSONL data
 * @returns {string} Converted data
 */
function flattenChubChat(userName, characterName, lines) {
    function flattenSwipe(swipe) {
        return swipe.message ? swipe.message : swipe;
    }

    function convert(line) {
        const lineData = tryParse(line);
        if (!lineData) return line;

        if (lineData.mes && lineData.mes.message) {
            lineData.mes = lineData?.mes.message;
        }

        if (lineData?.swipes && Array.isArray(lineData.swipes)) {
            lineData.swipes = lineData.swipes.map(swipe => flattenSwipe(swipe));
        }

        return JSON.stringify(lineData);
    }

    return (lines ?? []).map(convert).join('\n');
}

const router = express.Router();

router.post('/save', jsonParser, function (request, response) {
    try {
        const directoryName = String(request.body.avatar_url).replace('.png', '');
        const chatData = request.body.chat;
        const jsonlData = chatData.map(JSON.stringify).join('\n');
        const fileName = `${String(request.body.file_name)}.jsonl`;
        const filePath = path.join(request.user.directories.chats, directoryName, sanitize(fileName));
        writeFileAtomicSync(filePath, jsonlData, 'utf8');
        getBackupFunction(request.user.profile.handle)(request.user.directories.backups, directoryName, jsonlData);
        return response.send({ result: 'ok' });
    } catch (error) {
        response.send(error);
        return console.log(error);
    }
});

router.post('/get', jsonParser, function (request, response) {
    try {
        const dirName = String(request.body.avatar_url).replace('.png', '');
        const directoryPath = path.join(request.user.directories.chats, dirName);
        const chatDirExists = fs.existsSync(directoryPath);

        //if no chat dir for the character is found, make one with the character name
        if (!chatDirExists) {
            fs.mkdirSync(directoryPath);
            return response.send({});
        }

        if (!request.body.file_name) {
            return response.send({});
        }

        const fileName = `${String(request.body.file_name)}.jsonl`;
        const filePath = path.join(directoryPath, sanitize(fileName));
        const chatFileExists = fs.existsSync(filePath);

        if (!chatFileExists) {
            return response.send({});
        }

        const data = fs.readFileSync(filePath, 'utf8');
        const lines = data.split('\n');

        // Iterate through the array of strings and parse each line as JSON
        const jsonData = lines.map((l) => { try { return JSON.parse(l); } catch (_) { return; } }).filter(x => x);
        return response.send(jsonData);
    } catch (error) {
        console.error(error);
        return response.send({});
    }
});


router.post('/rename', jsonParser, async function (request, response) {
    if (!request.body || !request.body.original_file || !request.body.renamed_file) {
        return response.sendStatus(400);
    }

    const pathToFolder = request.body.is_group
        ? request.user.directories.groupChats
        : path.join(request.user.directories.chats, String(request.body.avatar_url).replace('.png', ''));
    const pathToOriginalFile = path.join(pathToFolder, sanitize(request.body.original_file));
    const pathToRenamedFile = path.join(pathToFolder, sanitize(request.body.renamed_file));
    const sanitizedFileName = path.parse(pathToRenamedFile).name;
    console.log('Old chat name', pathToOriginalFile);
    console.log('New chat name', pathToRenamedFile);

    if (!fs.existsSync(pathToOriginalFile) || fs.existsSync(pathToRenamedFile)) {
        console.log('Either Source or Destination files are not available');
        return response.status(400).send({ error: true });
    }

    fs.copyFileSync(pathToOriginalFile, pathToRenamedFile);
    fs.rmSync(pathToOriginalFile);
    console.log('Successfully renamed.');
    return response.send({ ok: true, sanitizedFileName });
});

router.post('/delete', jsonParser, function (request, response) {
    const dirName = String(request.body.avatar_url).replace('.png', '');
    const fileName = String(request.body.chatfile);
    const filePath = path.join(request.user.directories.chats, dirName, sanitize(fileName));
    const chatFileExists = fs.existsSync(filePath);

    if (!chatFileExists) {
        console.log(`Chat file not found '${filePath}'`);
        return response.sendStatus(400);
    }

    fs.rmSync(filePath);
    console.log('Deleted chat file: ' + filePath);
    return response.send('ok');
});

router.post('/export', jsonParser, async function (request, response) {
    if (!request.body.file || (!request.body.avatar_url && request.body.is_group === false)) {
        return response.sendStatus(400);
    }
    const pathToFolder = request.body.is_group
        ? request.user.directories.groupChats
        : path.join(request.user.directories.chats, String(request.body.avatar_url).replace('.png', ''));
    let filename = path.join(pathToFolder, request.body.file);
    let exportfilename = request.body.exportfilename;
    if (!fs.existsSync(filename)) {
        const errorMessage = {
            message: `Could not find JSONL file to export. Source chat file: ${filename}.`,
        };
        console.log(errorMessage.message);
        return response.status(404).json(errorMessage);
    }
    try {
        // Short path for JSONL files
        if (request.body.format === 'jsonl') {
            try {
                const rawFile = fs.readFileSync(filename, 'utf8');
                const successMessage = {
                    message: `Chat saved to ${exportfilename}`,
                    result: rawFile,
                };

                console.log(`Chat exported as ${exportfilename}`);
                return response.status(200).json(successMessage);
            } catch (err) {
                console.error(err);
                const errorMessage = {
                    message: `Could not read JSONL file to export. Source chat file: ${filename}.`,
                };
                console.log(errorMessage.message);
                return response.status(500).json(errorMessage);
            }
        }

        const readStream = fs.createReadStream(filename);
        const rl = readline.createInterface({
            input: readStream,
        });
        let buffer = '';
        rl.on('line', (line) => {
            const data = JSON.parse(line);
            // Skip non-printable/prompt-hidden messages
            if (data.is_system) {
                return;
            }
            if (data.mes) {
                const name = data.name;
                const message = (data?.extra?.display_text || data?.mes || '').replace(/\r?\n/g, '\n');
                buffer += (`${name}: ${message}\n\n`);
            }
        });
        rl.on('close', () => {
            const successMessage = {
                message: `Chat saved to ${exportfilename}`,
                result: buffer,
            };
            console.log(`Chat exported as ${exportfilename}`);
            return response.status(200).json(successMessage);
        });
    } catch (err) {
        console.log('chat export failed.');
        console.log(err);
        return response.sendStatus(400);
    }
});

router.post('/group/import', urlencodedParser, function (request, response) {
    try {
        const filedata = request.file;

        if (!filedata) {
            return response.sendStatus(400);
        }

        const chatname = humanizedISO8601DateTime();
        const pathToUpload = path.join(filedata.destination, filedata.filename);
        const pathToNewFile = path.join(request.user.directories.groupChats, `${chatname}.jsonl`);
        fs.copyFileSync(pathToUpload, pathToNewFile);
        fs.unlinkSync(pathToUpload);
        return response.send({ res: chatname });
    } catch (error) {
        console.error(error);
        return response.send({ error: true });
    }
});

router.post('/import', urlencodedParser, function (request, response) {
    if (!request.body) return response.sendStatus(400);

    const format = request.body.file_type;
    const avatarUrl = (request.body.avatar_url).replace('.png', '');
    const characterName = request.body.character_name;
    const userName = request.body.user_name || 'You';

    if (!request.file) {
        return response.sendStatus(400);
    }

    try {
        const pathToUpload = path.join(request.file.destination, request.file.filename);
        const data = fs.readFileSync(pathToUpload, 'utf8');

        if (format === 'json') {
            fs.unlinkSync(pathToUpload);
            const jsonData = JSON.parse(data);
            if (jsonData.histories !== undefined) {
                // CAI Tools format
                const chats = importCAIChat(userName, characterName, jsonData);
                for (const chat of chats) {
                    const fileName = `${characterName} - ${humanizedISO8601DateTime()} imported.jsonl`;
                    const filePath = path.join(request.user.directories.chats, avatarUrl, fileName);
                    writeFileAtomicSync(filePath, chat, 'utf8');
                }
                return response.send({ res: true });
            } else if (Array.isArray(jsonData.data_visible)) {
                // oobabooga's format
                const chat = importOobaChat(userName, characterName, jsonData);
                const fileName = `${characterName} - ${humanizedISO8601DateTime()} imported.jsonl`;
                const filePath = path.join(request.user.directories.chats, avatarUrl, fileName);
                writeFileAtomicSync(filePath, chat, 'utf8');
                return response.send({ res: true });
            } else if (Array.isArray(jsonData.messages)) {
                // Agnai format
                const chat = importAgnaiChat(userName, characterName, jsonData);
                const fileName = `${characterName} - ${humanizedISO8601DateTime()} imported.jsonl`;
                const filePath = path.join(request.user.directories.chats, avatarUrl, fileName);
                writeFileAtomicSync(filePath, chat, 'utf8');
                return response.send({ res: true });
            } else {
                console.log('Incorrect chat format .json');
                return response.send({ error: true });
            }
        }

        if (format === 'jsonl') {
            let lines = data.split('\n');
            const header = lines[0];

            const jsonData = JSON.parse(header);

            if (!(jsonData.user_name !== undefined || jsonData.name !== undefined)) {
                console.log('Incorrect chat format .jsonl');
                return response.send({ error: true });
            }

            // Do a tiny bit of work to import Chub Chat data
            // Processing the entire file is so fast that it's not worth checking if it's a Chub chat first
            let flattenedChat = data;
            try {
                // flattening is unlikely to break, but it's not worth failing to
                // import normal chats in an attempt to import a Chub chat
                flattenedChat = flattenChubChat(userName, characterName, lines);
            } catch (error) {
                console.warn('Failed to flatten Chub Chat data: ', error);
            }

            const fileName = `${characterName} - ${humanizedISO8601DateTime()} imported.jsonl`;
            const filePath = path.join(request.user.directories.chats, avatarUrl, fileName);
            if (flattenedChat !== data) {
                writeFileAtomicSync(filePath, flattenedChat, 'utf8');
            } else {
                fs.copyFileSync(pathToUpload, filePath);
            }
            fs.unlinkSync(pathToUpload);
            response.send({ res: true });
        }
    } catch (error) {
        console.error(error);
        return response.send({ error: true });
    }
});

router.post('/group/get', jsonParser, (request, response) => {
    if (!request.body || !request.body.id) {
        return response.sendStatus(400);
    }

    const id = request.body.id;
    const pathToFile = path.join(request.user.directories.groupChats, `${id}.jsonl`);

    if (fs.existsSync(pathToFile)) {
        const data = fs.readFileSync(pathToFile, 'utf8');
        const lines = data.split('\n');

        // Iterate through the array of strings and parse each line as JSON
        const jsonData = lines.map(line => tryParse(line)).filter(x => x);
        return response.send(jsonData);
    } else {
        return response.send([]);
    }
});

router.post('/group/delete', jsonParser, (request, response) => {
    if (!request.body || !request.body.id) {
        return response.sendStatus(400);
    }

    const id = request.body.id;
    const pathToFile = path.join(request.user.directories.groupChats, `${id}.jsonl`);

    if (fs.existsSync(pathToFile)) {
        fs.rmSync(pathToFile);
        return response.send({ ok: true });
    }

    return response.send({ error: true });
});

router.post('/group/save', jsonParser, (request, response) => {
    if (!request.body || !request.body.id) {
        return response.sendStatus(400);
    }

    const id = request.body.id;
    const pathToFile = path.join(request.user.directories.groupChats, `${id}.jsonl`);

    if (!fs.existsSync(request.user.directories.groupChats)) {
        fs.mkdirSync(request.user.directories.groupChats);
    }

    let chat_data = request.body.chat;
    let jsonlData = chat_data.map(JSON.stringify).join('\n');
    writeFileAtomicSync(pathToFile, jsonlData, 'utf8');
    getBackupFunction(request.user.profile.handle)(request.user.directories.backups, String(id), jsonlData);
    return response.send({ ok: true });
});

module.exports = { router };
