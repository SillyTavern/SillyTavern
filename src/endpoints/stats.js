const express = require('express');

const { jsonParser } = require('../express-common');
const { DIRECTORIES } = require('../constants');
const statsHelpers = require('../../statsHelpers');

const router = express.Router();

/**
 * Handle a POST request to get the stats object
 *
 * This function returns the stats object that was calculated by the `calculateStats` function.
 *
 *
 * @param {Object} request - The HTTP request object.
 * @param {Object} response - The HTTP response object.
 * @returns {void}
 */
router.post('/get', jsonParser, function (request, response) {
    response.send(JSON.stringify(statsHelpers.getCharStats()));
});

/**
 * Triggers the recreation of statistics from chat files.
 * - If successful: returns a 200 OK status.
 * - On failure: returns a 500 Internal Server Error status.
 *
 * @param {Object} request - Express request object.
 * @param {Object} response - Express response object.
 */
router.post('/recreate', jsonParser, async function (request, response) {
    try {
        await statsHelpers.recreateStats(DIRECTORIES.chats, DIRECTORIES.characters);
        return response.sendStatus(200);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});


/**
 * Handle a POST request to update the stats object
 *
 * This function updates the stats object with the data from the request body.
 *
 * @param {Object} request - The HTTP request object.
 * @param {Object} response - The HTTP response object.
 * @returns {void}
 *
*/
router.post('/update', jsonParser, function (request, response) {
    if (!request.body) return response.sendStatus(400);
    statsHelpers.setCharStats(request.body);
    return response.sendStatus(200);
});

module.exports = { router };
