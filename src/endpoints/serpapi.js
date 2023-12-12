const fetch = require('node-fetch').default;
const express = require('express');
const { readSecret, SECRET_KEYS } = require('./secrets');
const { jsonParser } = require('../express-common');

const router = express.Router();

// Cosplay as Firefox
const visitHeaders = {
    'Accept': 'text/html',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:120.0) Gecko/20100101 Firefox/120.0',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'TE': 'trailers',
    'DNT': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
};

router.post('/search', jsonParser, async (request, response) => {
    try {
        const key = readSecret(SECRET_KEYS.SERPAPI);

        if (!key) {
            console.log('No SerpApi key found');
            return response.sendStatus(400);
        }

        const { query } = request.body;
        const result = await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${key}`);

        if (!result.ok) {
            const text = await result.text();
            console.log('SerpApi request failed', result.statusText, text);
            return response.status(500).send(text);
        }

        const data = await result.json();
        return response.json(data);
    } catch (error) {
        console.log(error);
        return response.sendStatus(500);
    }
});

router.post('/visit', jsonParser, async (request, response) => {
    try {
        const url = request.body.url;

        if (!url) {
            console.log('No url provided for /visit');
            return response.sendStatus(400);
        }

        try {
            const urlObj = new URL(url);

            // Reject relative URLs
            if (urlObj.protocol === null || urlObj.host === null) {
                throw new Error('Invalid URL format');
            }

            // Reject non-HTTP URLs
            if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
                throw new Error('Invalid protocol');
            }

            // Reject URLs with a non-standard port
            if (urlObj.port !== '') {
                throw new Error('Invalid port');
            }

            // Reject IP addresses
            if (urlObj.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
                throw new Error('Invalid hostname');
            }
        } catch (error) {
            console.log('Invalid url provided for /visit', url);
            return response.sendStatus(400);
        }

        const result = await fetch(url, { headers: visitHeaders });

        if (!result.ok) {
            console.log(`Visit failed ${result.status} ${result.statusText}`);
            return response.sendStatus(500);
        }

        const contentType = String(result.headers.get('content-type'));
        if (!contentType.includes('text/html')) {
            console.log(`Visit failed, content-type is ${contentType}, expected text/html`);
            return response.sendStatus(500);
        }

        const text = await result.text();
        return response.send(text);
    } catch (error) {
        console.log(error);
        return response.sendStatus(500);
    }
});

module.exports = { router };
