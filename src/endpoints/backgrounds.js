const fs = require('fs');
const path = require('path');
const express = require('express');
const sanitize = require('sanitize-filename');

const { jsonParser, urlencodedParser } = require('../express-common');
const { invalidateThumbnail } = require('./thumbnails');
const { getImages } = require('../util');

const router = express.Router();

router.post('/all', jsonParser, function (request, response) {
    var images = getImages(request.user.directories.backgrounds);
    response.send(JSON.stringify(images));
});

router.post('/delete', jsonParser, function (request, response) {
    if (!request.body) return response.sendStatus(400);

    if (request.body.bg !== sanitize(request.body.bg)) {
        console.error('Malicious bg name prevented');
        return response.sendStatus(403);
    }

    const fileName = path.join(request.user.directories.backgrounds, sanitize(request.body.bg));

    if (!fs.existsSync(fileName)) {
        console.log('BG file not found');
        return response.sendStatus(400);
    }

    fs.rmSync(fileName);
    invalidateThumbnail(request.user.directories, 'bg', request.body.bg);
    return response.send('ok');
});

router.post('/rename', jsonParser, function (request, response) {
    if (!request.body) return response.sendStatus(400);

    const oldFileName = path.join(request.user.directories.backgrounds, sanitize(request.body.old_bg));
    const newFileName = path.join(request.user.directories.backgrounds, sanitize(request.body.new_bg));

    if (!fs.existsSync(oldFileName)) {
        console.log('BG file not found');
        return response.sendStatus(400);
    }

    if (fs.existsSync(newFileName)) {
        console.log('New BG file already exists');
        return response.sendStatus(400);
    }

    fs.copyFileSync(oldFileName, newFileName);
    fs.rmSync(oldFileName);
    invalidateThumbnail(request.user.directories, 'bg', request.body.old_bg);
    return response.send('ok');
});

router.post('/upload', urlencodedParser, function (request, response) {
    if (!request.body || !request.file) return response.sendStatus(400);

    const img_path = path.join(request.file.destination, request.file.filename);
    const filename = request.file.originalname;

    try {
        fs.copyFileSync(img_path, path.join(request.user.directories.backgrounds, filename));
        fs.rmSync(img_path);
        invalidateThumbnail(request.user.directories, 'bg', filename);
        response.send(filename);
    } catch (err) {
        console.error(err);
        response.sendStatus(500);
    }
});

module.exports = { router };
