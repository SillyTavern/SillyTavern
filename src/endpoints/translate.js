const fetch = require('node-fetch').default;
const https = require('https');
const express = require('express');
const { readSecret, SECRET_KEYS } = require('./secrets');
const { getConfigValue } = require('../util');
const { jsonParser } = require('../express-common');

const DEEPLX_URL_DEFAULT = 'http://127.0.0.1:1188/translate';
const ONERING_URL_DEFAULT = 'http://127.0.0.1:4990/translate';

const router = express.Router();

router.post('/libre', jsonParser, async (request, response) => {
    const key = readSecret(SECRET_KEYS.LIBRE);
    const url = readSecret(SECRET_KEYS.LIBRE_URL);

    if (!url) {
        console.log('LibreTranslate URL is not configured.');
        return response.sendStatus(400);
    }

    const text = request.body.text;
    const lang = request.body.lang;

    if (!text || !lang) {
        return response.sendStatus(400);
    }

    console.log('Input text: ' + text);

    try {
        const result = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({
                q: text,
                source: 'auto',
                target: lang,
                format: 'text',
                api_key: key,
            }),
            headers: { 'Content-Type': 'application/json' },
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
        console.log('Translation error: ' + error.message);
        return response.sendStatus(500);
    }
});

router.post('/google', jsonParser, async (request, response) => {
    try {
        const { generateRequestUrl, normaliseResponse } = require('google-translate-api-browser');
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
                try {
                    const result = normaliseResponse(JSON.parse(data));
                    console.log('Translated text: ' + result.text);
                    return response.send(result.text);
                } catch (error) {
                    console.log('Translation error', error);
                    return response.sendStatus(500);
                }
            });
        }).on('error', (err) => {
            console.log('Translation error: ' + err.message);
            return response.sendStatus(500);
        });
    } catch (error) {
        console.log('Translation error', error);
        return response.sendStatus(500);
    }
});

router.post('/deepl', jsonParser, async (request, response) => {
    const key = readSecret(SECRET_KEYS.DEEPL);

    if (!key) {
        console.log('DeepL key is not configured.');
        return response.sendStatus(400);
    }

    if (request.body.lang === 'zh-CN' || request.body.lang === 'zh-TW') {
        request.body.lang = 'ZH';
    }

    const text = request.body.text;
    const lang = request.body.lang;
    const formality = getConfigValue('deepl.formality', 'default');

    if (!text || !lang) {
        return response.sendStatus(400);
    }

    console.log('Input text: ' + text);

    const params = new URLSearchParams();
    params.append('text', text);
    params.append('target_lang', lang);

    if (['de', 'fr', 'it', 'es', 'nl', 'ja', 'ru'].includes(lang)) {
        // We don't specify a Portuguese variant, so ignore formality for it.
        params.append('formality', formality);
    }

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
        console.log('Translation error: ' + error.message);
        return response.sendStatus(500);
    }
});

router.post('/onering', jsonParser, async (request, response) => {
    const secretUrl = readSecret(SECRET_KEYS.ONERING_URL);
    const url = secretUrl || ONERING_URL_DEFAULT;

    if (!url) {
        console.log('OneRing URL is not configured.');
        return response.sendStatus(400);
    }

    if (!secretUrl && url === ONERING_URL_DEFAULT) {
        console.log('OneRing URL is using default value.', ONERING_URL_DEFAULT);
    }

    const text = request.body.text;
    const from_lang = request.body.from_lang;
    const to_lang = request.body.to_lang;

    if (!text || !from_lang || !to_lang) {
        return response.sendStatus(400);
    }

    const params = new URLSearchParams();
    params.append('text', text);
    params.append('from_lang', from_lang);
    params.append('to_lang', to_lang);

    console.log('Input text: ' + text);

    try {
        const fetchUrl = new URL(url);
        fetchUrl.search = params.toString();

        const result = await fetch(fetchUrl, {
            method: 'GET',
            timeout: 0,
        });

        if (!result.ok) {
            const error = await result.text();
            console.log('OneRing error: ', result.statusText, error);
            return response.sendStatus(result.status);
        }

        const data = await result.json();
        console.log('Translated text: ' + data.result);

        return response.send(data.result);
    } catch (error) {
        console.log('Translation error: ' + error.message);
        return response.sendStatus(500);
    }
});

router.post('/deeplx', jsonParser, async (request, response) => {
    const secretUrl = readSecret(SECRET_KEYS.DEEPLX_URL);
    const url = secretUrl || DEEPLX_URL_DEFAULT;

    if (!url) {
        console.log('DeepLX URL is not configured.');
        return response.sendStatus(400);
    }

    if (!secretUrl && url === DEEPLX_URL_DEFAULT) {
        console.log('DeepLX URL is using default value.', DEEPLX_URL_DEFAULT);
    }

    const text = request.body.text;
    let lang = request.body.lang;
    if (request.body.lang === 'zh-CN' || request.body.lang === 'zh-TW') {
        lang = 'ZH';
    }

    if (!text || !lang) {
        return response.sendStatus(400);
    }

    console.log('Input text: ' + text);

    try {
        const result = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({
                text: text,
                source_lang: 'auto',
                target_lang: lang,
            }),
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            timeout: 0,
        });

        if (!result.ok) {
            const error = await result.text();
            console.log('DeepLX error: ', result.statusText, error);
            return response.sendStatus(result.status);
        }

        const json = await result.json();
        console.log('Translated text: ' + json.data);

        return response.send(json.data);
    } catch (error) {
        console.log('DeepLX translation error: ' + error.message);
        return response.sendStatus(500);
    }
});

router.post('/bing', jsonParser, async (request, response) => {
    const bingTranslateApi = require('bing-translate-api');
    const text = request.body.text;
    let lang = request.body.lang;

    if (request.body.lang === 'zh-CN') {
        lang = 'zh-Hans';
    }

    if (!text || !lang) {
        return response.sendStatus(400);
    }

    console.log('Input text: ' + text);

    bingTranslateApi.translate(text, null, lang).then(result => {
        console.log('Translated text: ' + result.translation);
        return response.send(result.translation);
    }).catch(err => {
        console.log('Translation error: ' + err.message);
        return response.sendStatus(500);
    });
});

module.exports = { router };
