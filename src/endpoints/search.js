import fetch from 'node-fetch';
import express from 'express';

import { decode } from 'html-entities';
import { readSecret, SECRET_KEYS } from './secrets.js';
import { trimV1 } from '../util.js';
import { setAdditionalHeaders } from '../additional-headers.js';

export const router = express.Router();

// Cosplay as Chrome
const visitHeaders = {
    'Accept': 'text/html',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
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

/**
 * Extract the transcript of a YouTube video
 * @param {string} videoPageBody HTML of the video page
 * @param {string} lang Language code
 * @returns {Promise<string>} Transcript text
 */
async function extractTranscript(videoPageBody, lang) {
    const RE_XML_TRANSCRIPT = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;
    const splittedHTML = videoPageBody.split('"captions":');

    if (splittedHTML.length <= 1) {
        if (videoPageBody.includes('class="g-recaptcha"')) {
            throw new Error('Too many requests');
        }
        if (!videoPageBody.includes('"playabilityStatus":')) {
            throw new Error('Video is not available');
        }
        throw new Error('Transcript not available');
    }

    const captions = (() => {
        try {
            return JSON.parse(splittedHTML[1].split(',"videoDetails')[0].replace('\n', ''));
        } catch (e) {
            return undefined;
        }
    })()?.['playerCaptionsTracklistRenderer'];

    if (!captions) {
        throw new Error('Transcript disabled');
    }

    if (!('captionTracks' in captions)) {
        throw new Error('Transcript not available');
    }

    if (lang && !captions.captionTracks.some(track => track.languageCode === lang)) {
        throw new Error('Transcript not available in this language');
    }

    const transcriptURL = (lang ? captions.captionTracks.find(track => track.languageCode === lang) : captions.captionTracks[0]).baseUrl;
    const transcriptResponse = await fetch(transcriptURL, {
        headers: {
            ...(lang && { 'Accept-Language': lang }),
            'User-Agent': visitHeaders['User-Agent'],
        },
    });

    if (!transcriptResponse.ok) {
        throw new Error('Transcript request failed');
    }

    const transcriptBody = await transcriptResponse.text();
    const results = [...transcriptBody.matchAll(RE_XML_TRANSCRIPT)];
    const transcript = results.map((result) => ({
        text: result[3],
        duration: parseFloat(result[2]),
        offset: parseFloat(result[1]),
        lang: lang ?? captions.captionTracks[0].languageCode,
    }));
    // The text is double-encoded
    const transcriptText = transcript.map((line) => decode(decode(line.text))).join(' ');
    return transcriptText;
}

router.post('/serpapi', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.SERPAPI);

        if (!key) {
            console.error('No SerpApi key found');
            return response.sendStatus(400);
        }

        const { query } = request.body;
        const result = await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${key}`);

        console.debug('SerpApi query', query);

        if (!result.ok) {
            const text = await result.text();
            console.error('SerpApi request failed', result.statusText, text);
            return response.status(500).send(text);
        }

        const data = await result.json();
        console.debug('SerpApi response', data);
        return response.json(data);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

/**
 * Get the transcript of a YouTube video
 * @copyright https://github.com/Kakulukian/youtube-transcript (MIT License)
 */
router.post('/transcript', async (request, response) => {
    try {
        const id = request.body.id;
        const lang = request.body.lang;
        const json = request.body.json;

        if (!id) {
            console.error('Id is required for /transcript');
            return response.sendStatus(400);
        }

        const videoPageResponse = await fetch(`https://www.youtube.com/watch?v=${id}`, {
            headers: {
                ...(lang && { 'Accept-Language': lang }),
                'User-Agent': visitHeaders['User-Agent'],
            },
        });

        const videoPageBody = await videoPageResponse.text();

        try {
            const transcriptText = await extractTranscript(videoPageBody, lang);
            return json
                ? response.json({ transcript: transcriptText, html: videoPageBody })
                : response.send(transcriptText);
        } catch (error) {
            if (json) {
                return response.json({ html: videoPageBody, transcript: '' });
            }
            throw error;
        }
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

router.post('/searxng', async (request, response) => {
    try {
        const { baseUrl, query, preferences, categories } = request.body;

        if (!baseUrl || !query) {
            console.error('Missing required parameters for /searxng');
            return response.sendStatus(400);
        }

        console.debug('SearXNG query', baseUrl, query);

        const mainPageUrl = new URL(baseUrl);
        const mainPageRequest = await fetch(mainPageUrl, { headers: visitHeaders });

        if (!mainPageRequest.ok) {
            console.error('SearXNG request failed', mainPageRequest.statusText);
            return response.sendStatus(500);
        }

        const mainPageText = await mainPageRequest.text();
        const clientHref = mainPageText.match(/href="(\/client.+\.css)"/)?.[1];

        if (clientHref) {
            const clientUrl = new URL(clientHref, baseUrl);
            await fetch(clientUrl, { headers: visitHeaders });
        }

        const searchUrl = new URL('/search', baseUrl);
        const searchParams = new URLSearchParams();
        searchParams.append('q', query);
        if (preferences) {
            searchParams.append('preferences', preferences);
        }
        if (categories) {
            searchParams.append('categories', categories);
        }
        searchUrl.search = searchParams.toString();

        const searchResult = await fetch(searchUrl, { headers: visitHeaders });

        if (!searchResult.ok) {
            const text = await searchResult.text();
            console.error('SearXNG request failed', searchResult.statusText, text);
            return response.sendStatus(500);
        }

        const data = await searchResult.text();
        return response.send(data);
    } catch (error) {
        console.error('SearXNG request failed', error);
        return response.sendStatus(500);
    }
});

router.post('/tavily', async (request, response) => {
    try {
        const apiKey = readSecret(request.user.directories, SECRET_KEYS.TAVILY);

        if (!apiKey) {
            console.error('No Tavily key found');
            return response.sendStatus(400);
        }

        const { query, include_images } = request.body;

        const body = {
            query: query,
            api_key: apiKey,
            search_depth: 'basic',
            topic: 'general',
            include_answer: true,
            include_raw_content: false,
            include_images: !!include_images,
            include_image_descriptions: false,
            include_domains: [],
            max_results: 10,
        };

        const result = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        console.debug('Tavily query', query);

        if (!result.ok) {
            const text = await result.text();
            console.error('Tavily request failed', result.statusText, text);
            return response.status(500).send(text);
        }

        const data = await result.json();
        console.debug('Tavily response', data);
        return response.json(data);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

router.post('/koboldcpp', async (request, response) => {
    try {
        const { query, url } = request.body;

        if (!url) {
            console.error('No URL provided for KoboldCpp search');
            return response.sendStatus(400);
        }

        console.debug('KoboldCpp search query', query);

        const baseUrl = trimV1(url);
        const args = {
            method: 'POST',
            headers: {},
            body: JSON.stringify({ q: query }),
        };

        setAdditionalHeaders(request, args, baseUrl);
        const result = await fetch(`${baseUrl}/api/extra/websearch`, args);

        if (!result.ok) {
            const text = await result.text();
            console.error('KoboldCpp request failed', result.statusText, text);
            return response.status(500).send(text);
        }

        const data = await result.json();
        console.debug('KoboldCpp search response', data);
        return response.json(data);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

router.post('/serper', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.SERPER);

        if (!key) {
            console.error('No Serper key found');
            return response.sendStatus(400);
        }

        const { query, images } = request.body;

        const url = images
            ? 'https://google.serper.dev/images'
            : 'https://google.serper.dev/search';

        const result = await fetch(url, {
            method: 'POST',
            headers: {
                'X-API-KEY': key,
                'Content-Type': 'application/json',
            },
            redirect: 'follow',
            body: JSON.stringify({ q: query }),
        });

        console.debug('Serper query', query);

        if (!result.ok) {
            const text = await result.text();
            console.warn('Serper request failed', result.statusText, text);
            return response.status(500).send(text);
        }

        const data = await result.json();
        console.debug('Serper response', data);
        return response.json(data);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

router.post('/visit', async (request, response) => {
    try {
        const url = request.body.url;
        const html = Boolean(request.body.html ?? true);

        if (!url) {
            console.error('No url provided for /visit');
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
            console.error('Invalid url provided for /visit', url);
            return response.sendStatus(400);
        }

        console.info('Visiting web URL', url);

        const result = await fetch(url, { headers: visitHeaders });

        if (!result.ok) {
            console.error(`Visit failed ${result.status} ${result.statusText}`);
            return response.sendStatus(500);
        }

        const contentType = String(result.headers.get('content-type'));

        if (html) {
            if (!contentType.includes('text/html')) {
                console.error(`Visit failed, content-type is ${contentType}, expected text/html`);
                return response.sendStatus(500);
            }

            const text = await result.text();
            return response.send(text);
        }

        response.setHeader('Content-Type', contentType);
        const buffer = await result.arrayBuffer();
        return response.send(Buffer.from(buffer));
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});
