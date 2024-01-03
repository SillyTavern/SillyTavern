const fs = require('fs');
const path = require('path');
const readline = require('readline');
const express = require('express');
const sanitize = require('sanitize-filename');
const writeFileAtomicSync = require('write-file-atomic').sync;

const { jsonParser, urlencodedParser } = require('../express-common');
const { DIRECTORIES, UPLOADS_PATH } = require('../constants');
const { getConfigValue, humanizedISO8601DateTime, tryParse, generateTimestamp, removeOldBackups } = require('../util');

/**
 * Saves a chat to the backups directory.
 * @param {string} name The name of the chat.
 * @param {string} chat The serialized chat to save.
 */
function backupChat(name, chat) {
    try {
        const isBackupDisabled = getConfigValue('disableChatBackup', false);

        if (isBackupDisabled) {
            return;
        }

        if (!fs.existsSync(DIRECTORIES.backups)) {
            fs.mkdirSync(DIRECTORIES.backups);
        }

        // replace non-alphanumeric characters with underscores
        name = sanitize(name).replace(/[^a-z0-9]/gi, '_').toLowerCase();

        const backupFile = path.join(DIRECTORIES.backups, `chat_${name}_${generateTimestamp()}.jsonl`);
        writeFileAtomicSync(backupFile, chat, 'utf-8');

        removeOldBackups(`chat_${name}_`);
    } catch (err) {
        console.log(`Could not backup chat for ${name}`, err);
    }
}

const router = express.Router();

router.post('/save', jsonParser, function (request, response) {
    try {
        var dir_name = String(request.body.avatar_url).replace('.png', '');
        let chat_data = request.body.chat;
        let jsonlData = chat_data.map(JSON.stringify).join('\n');
        writeFileAtomicSync(`${DIRECTORIES.chats + sanitize(dir_name)}/${sanitize(String(request.body.file_name))}.jsonl`, jsonlData, 'utf8');
        backupChat(dir_name, jsonlData);
        return response.send({ result: 'ok' });
    } catch (error) {
        response.send(error);
        return console.log(error);
    }
});

router.post('/get', jsonParser, function (request, response) {
    try {
        const dirName = String(request.body.avatar_url).replace('.png', '');
        const chatDirExists = fs.existsSync(DIRECTORIES.chats + dirName);

        //if no chat dir for the character is found, make one with the character name
        if (!chatDirExists) {
            fs.mkdirSync(DIRECTORIES.chats + dirName);
            return response.send({});
        }

        if (!request.body.file_name) {
            return response.send({});
        }

        const fileName = `${DIRECTORIES.chats + dirName}/${sanitize(String(request.body.file_name))}.jsonl`;
        const chatFileExists = fs.existsSync(fileName);

        if (!chatFileExists) {
            return response.send({});
        }

        const data = fs.readFileSync(fileName, 'utf8');
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
        ? DIRECTORIES.groupChats
        : path.join(DIRECTORIES.chats, String(request.body.avatar_url).replace('.png', ''));
    const pathToOriginalFile = path.join(pathToFolder, request.body.original_file);
    const pathToRenamedFile = path.join(pathToFolder, request.body.renamed_file);
    console.log('Old chat name', pathToOriginalFile);
    console.log('New chat name', pathToRenamedFile);

    if (!fs.existsSync(pathToOriginalFile) || fs.existsSync(pathToRenamedFile)) {
        console.log('Either Source or Destination files are not available');
        return response.status(400).send({ error: true });
    }

    console.log('Successfully renamed.');
    fs.renameSync(pathToOriginalFile, pathToRenamedFile);
    return response.send({ ok: true });
});

router.post('/delete', jsonParser, function (request, response) {
    console.log('/api/chats/delete entered');
    if (!request.body) {
        console.log('no request body seen');
        return response.sendStatus(400);
    }

    if (request.body.chatfile !== sanitize(request.body.chatfile)) {
        console.error('Malicious chat name prevented');
        return response.sendStatus(403);
    }

    const dirName = String(request.body.avatar_url).replace('.png', '');
    const fileName = `${DIRECTORIES.chats + dirName}/${sanitize(String(request.body.chatfile))}`;
    const chatFileExists = fs.existsSync(fileName);

    if (!chatFileExists) {
        console.log(`Chat file not found '${fileName}'`);
        return response.sendStatus(400);
    } else {
        console.log('found the chat file: ' + fileName);
        /* fs.unlinkSync(fileName); */
        fs.rmSync(fileName);
        console.log('deleted chat file: ' + fileName);

    }

    return response.send('ok');
});

router.post('/export', jsonParser, async function (request, response) {
    if (!request.body.file || (!request.body.avatar_url && request.body.is_group === false)) {
        return response.sendStatus(400);
    }
    const pathToFolder = request.body.is_group
        ? DIRECTORIES.groupChats
        : path.join(DIRECTORIES.chats, String(request.body.avatar_url).replace('.png', ''));
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
        if (request.body.format == 'jsonl') {
            try {
                const rawFile = fs.readFileSync(filename, 'utf8');
                const successMessage = {
                    message: `Chat saved to ${exportfilename}`,
                    result: rawFile,
                };

                console.log(`Chat exported as ${exportfilename}`);
                return response.status(200).json(successMessage);
            }
            catch (err) {
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
    }
    catch (err) {
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
        const pathToUpload = path.join(UPLOADS_PATH, filedata.filename);
        const pathToNewFile = path.join(DIRECTORIES.groupChats, `${chatname}.jsonl`);
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

    var format = request.body.file_type;
    let filedata = request.file;
    let avatar_url = (request.body.avatar_url).replace('.png', '');
    let ch_name = request.body.character_name;
    let user_name = request.body.user_name || 'You';

    if (!filedata) {
        return response.sendStatus(400);
    }

    try {
        const data = fs.readFileSync(path.join(UPLOADS_PATH, filedata.filename), 'utf8');

        if (format === 'json') {
            const jsonData = JSON.parse(data);
            if (jsonData.histories !== undefined) {
                //console.log('/api/chats/import confirms JSON histories are defined');
                const chat = {
                    from(history) {
                        return [
                            {
                                user_name: user_name,
                                character_name: ch_name,
                                create_date: humanizedISO8601DateTime(),
                            },
                            ...history.msgs.map(
                                (message) => ({
                                    name: message.src.is_human ? user_name : ch_name,
                                    is_user: message.src.is_human,
                                    send_date: humanizedISO8601DateTime(),
                                    mes: message.text,
                                }),
                            )];
                    },
                };

                const newChats = [];
                (jsonData.histories.histories ?? []).forEach((history) => {
                    newChats.push(chat.from(history));
                });

                const errors = [];

                for (const chat of newChats) {
                    const filePath = `${DIRECTORIES.chats + avatar_url}/${ch_name} - ${humanizedISO8601DateTime()} imported.jsonl`;
                    const fileContent = chat.map(tryParse).filter(x => x).join('\n');

                    try {
                        writeFileAtomicSync(filePath, fileContent, 'utf8');
                    } catch (err) {
                        errors.push(err);
                    }
                }

                if (0 < errors.length) {
                    response.send('Errors occurred while writing character files. Errors: ' + JSON.stringify(errors));
                }

                response.send({ res: true });
            } else if (Array.isArray(jsonData.data_visible)) {
                // oobabooga's format
                /** @type {object[]} */
                const chat = [{
                    user_name: user_name,
                    character_name: ch_name,
                    create_date: humanizedISO8601DateTime(),
                }];

                for (const arr of jsonData.data_visible) {
                    if (arr[0]) {
                        const userMessage = {
                            name: user_name,
                            is_user: true,
                            send_date: humanizedISO8601DateTime(),
                            mes: arr[0],
                        };
                        chat.push(userMessage);
                    }
                    if (arr[1]) {
                        const charMessage = {
                            name: ch_name,
                            is_user: false,
                            send_date: humanizedISO8601DateTime(),
                            mes: arr[1],
                        };
                        chat.push(charMessage);
                    }
                }

                const chatContent = chat.map(obj => JSON.stringify(obj)).join('\n');
                writeFileAtomicSync(`${DIRECTORIES.chats + avatar_url}/${ch_name} - ${humanizedISO8601DateTime()} imported.jsonl`, chatContent, 'utf8');

                response.send({ res: true });
            } else {
                console.log('Incorrect chat format .json');
                return response.send({ error: true });
            }
        }

        if (format === 'jsonl') {
            const line = data.split('\n')[0];

            let jsonData = JSON.parse(line);

            if (jsonData.user_name !== undefined || jsonData.name !== undefined) {
                fs.copyFileSync(path.join(UPLOADS_PATH, filedata.filename), (`${DIRECTORIES.chats + avatar_url}/${ch_name} - ${humanizedISO8601DateTime()}.jsonl`));
                response.send({ res: true });
            } else {
                console.log('Incorrect chat format .jsonl');
                return response.send({ error: true });
            }
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
    const pathToFile = path.join(DIRECTORIES.groupChats, `${id}.jsonl`);

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
    const pathToFile = path.join(DIRECTORIES.groupChats, `${id}.jsonl`);

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
    const pathToFile = path.join(DIRECTORIES.groupChats, `${id}.jsonl`);

    if (!fs.existsSync(DIRECTORIES.groupChats)) {
        fs.mkdirSync(DIRECTORIES.groupChats);
    }

    let chat_data = request.body.chat;
    let jsonlData = chat_data.map(JSON.stringify).join('\n');
    writeFileAtomicSync(pathToFile, jsonlData, 'utf8');
    backupChat(String(id), jsonlData);
    return response.send({ ok: true });
});

module.exports = { router };
