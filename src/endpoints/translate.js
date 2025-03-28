import { createRequire } from 'node:module';

import fetch from 'node-fetch';
import express from 'express';
import { translate as bingTranslate } from 'bing-translate-api';
import iconv from 'iconv-lite';
import urlJoin from 'url-join';

import { readSecret, SECRET_KEYS } from './secrets.js';
import { getConfigValue, uuidv4 } from '../util.js';

const DEEPLX_URL_DEFAULT = 'http://127.0.0.1:1188/translate';
const ONERING_URL_DEFAULT = 'http://127.0.0.1:4990/translate';
const LINGVA_DEFAULT = 'https://lingva.ml/api/v1';

export const router = express.Router();

/**
 * Get the Google Translate API client.
 * @returns {import('google-translate-api-browser')} Google Translate API client
 */
function getGoogleTranslateClient() {
    const require = createRequire(import.meta.url);
    const googleTranslateApi = require('google-translate-api-browser');
    return googleTranslateApi;
}

/**
 * Tries to decode an ArrayBuffer to a string using iconv-lite for UTF-8.
 * @param {ArrayBuffer} buffer ArrayBuffer
 * @returns {string} Decoded string
 */
function decodeBuffer(buffer) {
    try {
        return iconv.decode(Buffer.from(buffer), 'utf-8');
    } catch (error) {
        console.error('Failed to decode buffer:', error);
        return Buffer.from(buffer).toString('utf-8');
    }
}

router.post('/libre', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.LIBRE);
        const url = readSecret(request.user.directories, SECRET_KEYS.LIBRE_URL);

        if (!url) {
            console.warn('LibreTranslate URL is not configured.');
            return response.sendStatus(400);
        }

        if (request.body.lang === 'zh-CN') {
            request.body.lang = 'zh';
        }

        if (request.body.lang === 'zh-TW') {
            request.body.lang = 'zt';
        }

        if (request.body.lang === 'pt-BR' || request.body.lang === 'pt-PT') {
            request.body.lang = 'pt';
        }

        const text = request.body.text;
        const lang = request.body.lang;

        if (!text || !lang) {
            return response.sendStatus(400);
        }

        console.debug('Input text: ' + text);

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
            console.warn('LibreTranslate error: ', result.statusText, error);
            return response.sendStatus(500);
        }

        /** @type {any} */
        const json = await result.json();
        console.debug('Translated text: ' + json.translatedText);

        return response.send(json.translatedText);
    } catch (error) {
        console.error('Translation error: ' + error.message);
        return response.sendStatus(500);
    }
});

router.post('/google', async (request, response) => {
    try {
        const text = request.body.text;
        const lang = request.body.lang;

        if (!text || !lang) {
            return response.sendStatus(400);
        }

        console.debug('Input text: ' + text);

        const { generateRequestUrl, normaliseResponse } = getGoogleTranslateClient();
        const requestUrl = generateRequestUrl(text, { to: lang });
        const result = await fetch(requestUrl);

        if (!result.ok) {
            console.warn('Google Translate error: ', result.statusText);
            return response.sendStatus(500);
        }

        const buffer = await result.arrayBuffer();
        const translateResponse = normaliseResponse(JSON.parse(decodeBuffer(buffer)));
        const translatedText = translateResponse.text;

        response.setHeader('Content-Type', 'text/plain; charset=utf-8');
        console.debug('Translated text: ' + translatedText);
        return response.send(translatedText);
    } catch (error) {
        console.error('Translation error', error);
        return response.sendStatus(500);
    }
});

router.post('/yandex', async (request, response) => {
    try {
        if (request.body.lang === 'pt-PT') {
            request.body.lang = 'pt';
        }

        if (request.body.lang === 'zh-CN' || request.body.lang === 'zh-TW') {
            request.body.lang = 'zh';
        }

        const chunks = request.body.chunks;
        const lang = request.body.lang;

        if (!chunks || !lang) {
            return response.sendStatus(400);
        }

        // reconstruct original text to log
        let inputText = '';

        const params = new URLSearchParams();
        for (const chunk of chunks) {
            params.append('text', chunk);
            inputText += chunk;
        }
        params.append('lang', lang);
        const ucid = uuidv4().replaceAll('-', '');

        console.debug('Input text: ' + inputText);

        const result = await fetch(`https://translate.yandex.net/api/v1/tr.json/translate?ucid=${ucid}&srv=android&format=text`, {
            method: 'POST',
            body: params,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        if (!result.ok) {
            const error = await result.text();
            console.warn('Yandex error: ', result.statusText, error);
            return response.sendStatus(500);
        }

        /** @type {any} */
        const json = await result.json();
        const translated = json.text.join();
        console.debug('Translated text: ' + translated);

        return response.send(translated);
    } catch (error) {
        console.error('Translation error: ' + error.message);
        return response.sendStatus(500);
    }
});

router.post('/lingva', async (request, response) => {
    try {
        const secretUrl = readSecret(request.user.directories, SECRET_KEYS.LINGVA_URL);
        const baseUrl = secretUrl || LINGVA_DEFAULT;

        if (!secretUrl && baseUrl === LINGVA_DEFAULT) {
            console.warn('Lingva URL is using default value.', LINGVA_DEFAULT);
        }

        if (request.body.lang === 'zh-CN' || request.body.lang === 'zh-TW') {
            request.body.lang = 'zh';
        }

        if (request.body.lang === 'pt-BR' || request.body.lang === 'pt-PT') {
            request.body.lang = 'pt';
        }

        const text = request.body.text;
        const lang = request.body.lang;

        if (!text || !lang) {
            return response.sendStatus(400);
        }

        console.debug('Input text: ' + text);

        const url = urlJoin(baseUrl, 'auto', lang, encodeURIComponent(text));
        const result = await fetch(url);

        if (!result.ok) {
            const error = await result.text();
            console.warn('Lingva error: ', result.statusText, error);
        }

        /** @type {any} */
        const data = await result.json();
        console.debug('Translated text: ' + data.translation);
        return response.send(data.translation);
    } catch (error) {
        console.error('Translation error', error);
        return response.sendStatus(500);
    }
});

router.post('/deepl', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.DEEPL);

        if (!key) {
            console.warn('DeepL key is not configured.');
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

        console.debug('Input text: ' + text);

        const params = new URLSearchParams();
        params.append('text', text);
        params.append('target_lang', lang);

        if (['de', 'fr', 'it', 'es', 'nl', 'ja', 'ru', 'pt-BR', 'pt-PT'].includes(lang)) {
            params.append('formality', formality);
        }

        const endpoint = request.body.endpoint === 'pro'
            ? 'https://api.deepl.com/v2/translate'
            : 'https://api-free.deepl.com/v2/translate';

        const result = await fetch(endpoint, {
            method: 'POST',
            body: params,
            headers: {
                'Accept': 'application/json',
                'Authorization': `DeepL-Auth-Key ${key}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        if (!result.ok) {
            const error = await result.text();
            console.warn('DeepL error: ', result.statusText, error);
            return response.sendStatus(500);
        }

        /** @type {any} */
        const json = await result.json();
        console.debug('Translated text: ' + json.translations[0].text);

        return response.send(json.translations[0].text);
    } catch (error) {
        console.error('Translation error: ' + error.message);
        return response.sendStatus(500);
    }
});

router.post('/onering', async (request, response) => {
    try {
        const secretUrl = readSecret(request.user.directories, SECRET_KEYS.ONERING_URL);
        const url = secretUrl || ONERING_URL_DEFAULT;

        if (!url) {
            console.warn('OneRing URL is not configured.');
            return response.sendStatus(400);
        }

        if (!secretUrl && url === ONERING_URL_DEFAULT) {
            console.info('OneRing URL is using default value.', ONERING_URL_DEFAULT);
        }

        if (request.body.lang === 'pt-BR' || request.body.lang === 'pt-PT') {
            request.body.lang = 'pt';
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

        console.debug('Input text: ' + text);

        const fetchUrl = new URL(url);
        fetchUrl.search = params.toString();

        const result = await fetch(fetchUrl, {
            method: 'GET',
        });

        if (!result.ok) {
            const error = await result.text();
            console.warn('OneRing error: ', result.statusText, error);
            return response.sendStatus(500);
        }

        /** @type {any} */
        const data = await result.json();
        console.debug('Translated text: ' + data.result);

        return response.send(data.result);
    } catch (error) {
        console.error('Translation error: ' + error.message);
        return response.sendStatus(500);
    }
});

router.post('/deeplx', async (request, response) => {
    try {
        const secretUrl = readSecret(request.user.directories, SECRET_KEYS.DEEPLX_URL);
        const url = secretUrl || DEEPLX_URL_DEFAULT;

        if (!url) {
            console.warn('DeepLX URL is not configured.');
            return response.sendStatus(400);
        }

        if (!secretUrl && url === DEEPLX_URL_DEFAULT) {
            console.info('DeepLX URL is using default value.', DEEPLX_URL_DEFAULT);
        }

        const text = request.body.text;
        let lang = request.body.lang;
        if (request.body.lang === 'zh-CN' || request.body.lang === 'zh-TW') {
            lang = 'ZH';
        }

        if (!text || !lang) {
            return response.sendStatus(400);
        }

        console.debug('Input text: ' + text);

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
        });

        if (!result.ok) {
            const error = await result.text();
            console.warn('DeepLX error: ', result.statusText, error);
            return response.sendStatus(500);
        }

        /** @type {any} */
        const json = await result.json();
        console.debug('Translated text: ' + json.data);

        return response.send(json.data);
    } catch (error) {
        console.error('DeepLX translation error: ' + error.message);
        return response.sendStatus(500);
    }
});

router.post('/bing', async (request, response) => {
    try {
        const text = request.body.text;
        let lang = request.body.lang;

        if (request.body.lang === 'zh-CN') {
            lang = 'zh-Hans';
        }

        if (request.body.lang === 'zh-TW') {
            lang = 'zh-Hant';
        }

        if (request.body.lang === 'pt-BR') {
            lang = 'pt';
        }

        if (!text || !lang) {
            return response.sendStatus(400);
        }

        console.debug('Input text: ' + text);

        const result = await bingTranslate(text, null, lang);
        const translatedText = result?.translation;
        console.debug('Translated text: ' + translatedText);
        return response.send(translatedText);
    } catch (error) {
        console.error('Translation error', error);
        return response.sendStatus(500);
    }
});
