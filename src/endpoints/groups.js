const fs = require('fs');
const path = require('path');
const express = require('express');
const sanitize = require('sanitize-filename');
const writeFileAtomicSync = require('write-file-atomic').sync;

const { jsonParser } = require('../express-common');
const { DIRECTORIES } = require('../constants');
const { humanizedISO8601DateTime } = require('../util');

const router = express.Router();

router.post('/all', jsonParser, (_, response) => {
    const groups = [];

    if (!fs.existsSync(DIRECTORIES.groups)) {
        fs.mkdirSync(DIRECTORIES.groups);
    }

    const files = fs.readdirSync(DIRECTORIES.groups).filter(x => path.extname(x) === '.json');
    const chats = fs.readdirSync(DIRECTORIES.groupChats).filter(x => path.extname(x) === '.jsonl');

    files.forEach(function (file) {
        try {
            const filePath = path.join(DIRECTORIES.groups, file);
            const fileContents = fs.readFileSync(filePath, 'utf8');
            const group = JSON.parse(fileContents);
            const groupStat = fs.statSync(filePath);
            group['date_added'] = groupStat.birthtimeMs;
            group['create_date'] = humanizedISO8601DateTime(groupStat.birthtimeMs);

            let chat_size = 0;
            let date_last_chat = 0;

            if (Array.isArray(group.chats) && Array.isArray(chats)) {
                for (const chat of chats) {
                    if (group.chats.includes(path.parse(chat).name)) {
                        const chatStat = fs.statSync(path.join(DIRECTORIES.groupChats, chat));
                        chat_size += chatStat.size;
                        date_last_chat = Math.max(date_last_chat, chatStat.mtimeMs);
                    }
                }
            }

            group['date_last_chat'] = date_last_chat;
            group['chat_size'] = chat_size;
            groups.push(group);
        }
        catch (error) {
            console.error(error);
        }
    });

    return response.send(groups);
});

router.post('/create', jsonParser, (request, response) => {
    if (!request.body) {
        return response.sendStatus(400);
    }

    const id = String(Date.now());
    const groupMetadata = {
        id: id,
        name: request.body.name ?? 'New Group',
        members: request.body.members ?? [],
        avatar_url: request.body.avatar_url,
        allow_self_responses: !!request.body.allow_self_responses,
        activation_strategy: request.body.activation_strategy ?? 0,
        generation_mode: request.body.generation_mode ?? 0,
        disabled_members: request.body.disabled_members ?? [],
        chat_metadata: request.body.chat_metadata ?? {},
        fav: request.body.fav,
        chat_id: request.body.chat_id ?? id,
        chats: request.body.chats ?? [id],
        auto_mode_delay: request.body.auto_mode_delay ?? 5,
    };
    const pathToFile = path.join(DIRECTORIES.groups, `${id}.json`);
    const fileData = JSON.stringify(groupMetadata);

    if (!fs.existsSync(DIRECTORIES.groups)) {
        fs.mkdirSync(DIRECTORIES.groups);
    }

    writeFileAtomicSync(pathToFile, fileData);
    return response.send(groupMetadata);
});

router.post('/edit', jsonParser, (request, response) => {
    if (!request.body || !request.body.id) {
        return response.sendStatus(400);
    }
    const id = request.body.id;
    const pathToFile = path.join(DIRECTORIES.groups, `${id}.json`);
    const fileData = JSON.stringify(request.body);

    writeFileAtomicSync(pathToFile, fileData);
    return response.send({ ok: true });
});

router.post('/delete', jsonParser, async (request, response) => {
    if (!request.body || !request.body.id) {
        return response.sendStatus(400);
    }

    const id = request.body.id;
    const pathToGroup = path.join(DIRECTORIES.groups, sanitize(`${id}.json`));

    try {
        // Delete group chats
        const group = JSON.parse(fs.readFileSync(pathToGroup, 'utf8'));

        if (group && Array.isArray(group.chats)) {
            for (const chat of group.chats) {
                console.log('Deleting group chat', chat);
                const pathToFile = path.join(DIRECTORIES.groupChats, `${id}.jsonl`);

                if (fs.existsSync(pathToFile)) {
                    fs.rmSync(pathToFile);
                }
            }
        }
    } catch (error) {
        console.error('Could not delete group chats. Clean them up manually.', error);
    }

    if (fs.existsSync(pathToGroup)) {
        fs.rmSync(pathToGroup);
    }

    return response.send({ ok: true });
});

module.exports = { router };
