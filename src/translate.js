const fetch = require('node-fetch').default;
const https = require('https');
const { readSecret, SECRET_KEYS } = require('./secrets');
const { generateRequestUrl, normaliseResponse } = require('google-translate-api-browser');

/**
 * @param {import("express").Express} app
 * @param {any} jsonParser
 */
function registerEndpoints(app, jsonParser) {
    app.post('/api/translate/libre', jsonParser, async (request, response) => {
        const key = readSecret(SECRET_KEYS.LIBRE);
        const url = readSecret(SECRET_KEYS.LIBRE_URL);

        if (!url) {
            console.log('LibreTranslate URL is not configured.');
            return response.sendStatus(401);
        }

        const text = request.body.text;
        const lang = request.body.lang;

        if (!text || !lang) {
            return response.sendStatus(400);
        }

        console.log('Input text: ' + text);

        try {
            const result = await fetch(url, {
                method: "POST",
                body: JSON.stringify({
                    q: text,
                    source: "auto",
                    target: lang,
                    format: "text",
                    api_key: key
                }),
                headers: { "Content-Type": "application/json" }
            });

            if (!result.ok) {
                const error = await result.text();
                console.log('LibreTranslate error: ', result.statusText, error);
                return response.sendStatus(result.status);
            }

            const json = await result.json();
            console.log('Translated text: ' + json.translatedText);

            return response.send(json.translatedText);
        } catch (error) {
            console.log("Translation error: " + error.message);
            return response.sendStatus(500);
        }
    });

    app.post('/api/translate/google', jsonParser, async (request, response) => {
        const text = request.body.text;
        const lang = request.body.lang;

        if (!text || !lang) {
            return response.sendStatus(400);
        }

        console.log('Input text: ' + text);

        const url = generateRequestUrl(text, { to: lang });

        https.get(url, (resp) => {
            let data = '';

            resp.on('data', (chunk) => {
                data += chunk;
            });

            resp.on('end', () => {
                const result = normaliseResponse(JSON.parse(data));
                console.log('Translated text: ' + result.text);
                return response.send(result.text);
            });
        }).on("error", (err) => {
            console.log("Translation error: " + err.message);
            return response.sendStatus(500);
        });
    });

    app.post('/api/translate/deepl', jsonParser, async (request, response) => {
        const key = readSecret(SECRET_KEYS.DEEPL);

        if (!key) {
            return response.sendStatus(401);
        }

        const text = request.body.text;
        const lang = request.body.lang;

        if (!text || !lang) {
            return response.sendStatus(400);
        }

        console.log('Input text: ' + text);

        const params = new URLSearchParams();
        params.append('text', text);
        params.append('target_lang', lang);

        try {
            const result = await fetch('https://api-free.deepl.com/v2/translate', {
                method: 'POST',
                body: params,
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `DeepL-Auth-Key ${key}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                timeout: 0,
            });

            if (!result.ok) {
                const error = await result.text();
                console.log('DeepL error: ', result.statusText, error);
                return response.sendStatus(result.status);
            }

            const json = await result.json();
            console.log('Translated text: ' + json.translations[0].text);

            return response.send(json.translations[0].text);
        } catch (error) {
            console.log("Translation error: " + error.message);
            return response.sendStatus(500);
        }
    });
}

module.exports = {
    registerEndpoints,
};
