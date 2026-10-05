import { describe, test, expect, jest, beforeAll, afterAll, beforeEach } from '@jest/globals';

// secrets.js reads this config value at module load. The env var override takes
// precedence over config.yaml, so the search router imports without a config file.
process.env.SILLYTAVERN_ALLOWKEYSEXPOSURE = 'false';

const fetchMock = jest.fn();
jest.unstable_mockModule('node-fetch', () => ({
    default: fetchMock,
}));

/** @type {import('express').Router} */
let router;
/** @type {import('../src/private-request-filter.js').getUntrustedRequestAgent} */
let getUntrustedRequestAgent;
/** @type {import('node:http').Server} */
let server;
let baseUrl;

beforeAll(async () => {
    ({ router } = await import('../src/endpoints/search.js'));
    ({ getUntrustedRequestAgent } = await import('../src/private-request-filter.js'));
    const express = (await import('express')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/search', router);
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => new Promise(resolve => server.close(resolve)));

beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html' },
        text: async () => '<html>ok</html>',
    });
});

function visit(url) {
    return fetch(`${baseUrl}/api/search/visit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
    });
}

describe('POST /api/search/visit URL validation', () => {
    const rejectedUrls = [
        ['missing url', undefined],
        ['empty url', ''],
        ['relative url', '/etc/passwd'],
        ['ftp protocol', 'ftp://example.com/'],
        ['file protocol', 'file:///etc/passwd'],
        ['non-standard port', 'http://example.com:8080/'],
        ['literal IPv4 loopback', 'http://127.0.0.1/'],
        ['literal IPv4 private', 'http://10.0.0.1/'],
        ['literal IPv4 metadata service', 'http://169.254.169.254/'],
        ['hex IPv4 form', 'http://0x7f000001/'],
        ['octal IPv4 form', 'http://0177.0.0.1/'],
        ['decimal IPv4 form', 'http://2130706433/'],
        ['bracketed IPv6 loopback', 'http://[::1]/'],
        ['bracketed IPv6 link-local', 'http://[fe80::1]/'],
        ['localhost', 'http://localhost/'],
        ['localhost subdomain', 'http://sub.localhost/'],
        ['https localhost', 'https://localhost/'],
    ];

    for (const [label, url] of rejectedUrls) {
        test(`rejects ${label} with 400 before any request is made`, async () => {
            const response = await visit(url);
            expect(response.status).toBe(400);
            expect(fetchMock).not.toHaveBeenCalled();
        });
    }

    const allowedUrls = [
        ['public http url', 'http://example.com/'],
        ['public https url', 'https://example.com/some/page?query=1'],
    ];

    for (const [label, url] of allowedUrls) {
        test(`passes ${label} to fetch through the untrusted request agent`, async () => {
            const response = await visit(url);
            expect(response.status).toBe(200);
            expect(await response.text()).toBe('<html>ok</html>');
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock).toHaveBeenCalledWith(url, expect.objectContaining({
                agent: getUntrustedRequestAgent(),
            }));
            expect(getUntrustedRequestAgent()).toBeDefined();
        });
    }
});
