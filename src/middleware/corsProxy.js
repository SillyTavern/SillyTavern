import fetch from 'node-fetch';
import { forwardFetchResponse } from '../util.js';

/**
 * Middleware to proxy requests to a different domain
 * @param {import('express').Request} req Express request object
 * @param {import('express').Response} res Express response object
 */
export default async function corsProxyMiddleware(req, res) {
    const url = req.params.url; // get the url from the request path

    // Disallow circular requests
    const serverUrl = req.protocol + '://' + req.get('host');
    if (url.startsWith(serverUrl)) {
        return res.status(400).send('Circular requests are not allowed');
    }

    try {
        const headers = JSON.parse(JSON.stringify(req.headers));
        const headersToRemove = [
            'x-csrf-token', 'host', 'referer', 'origin', 'cookie',
            'x-forwarded-for', 'x-forwarded-protocol', 'x-forwarded-proto',
            'x-forwarded-host', 'x-real-ip', 'sec-fetch-mode',
            'sec-fetch-site', 'sec-fetch-dest',
        ];

        headersToRemove.forEach(header => delete headers[header]);

        const bodyMethods = ['POST', 'PUT', 'PATCH'];

        const response = await fetch(url, {
            method: req.method,
            headers: headers,
            body: bodyMethods.includes(req.method) ? JSON.stringify(req.body) : undefined,
        });

        // Copy over relevant response params to the proxy response
        forwardFetchResponse(response, res);
    } catch (error) {
        res.status(500).send('Error occurred while trying to proxy to: ' + url + ' ' + error);
    }
}
