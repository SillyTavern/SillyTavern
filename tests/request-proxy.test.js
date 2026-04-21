import { describe, test, expect, jest, beforeAll, beforeEach, afterAll } from '@jest/globals';

const mockProxyAgent = jest.fn(function ProxyAgent(options) {
    this.options = options;
});
const mockIsValidUrl = jest.fn(() => true);

jest.unstable_mockModule('proxy-agent', () => ({
    ProxyAgent: mockProxyAgent,
}));

jest.unstable_mockModule('../src/util.js', () => ({
    isValidUrl: mockIsValidUrl,
    color: {
        red: text => text,
        green: text => text,
        blue: text => text,
        yellow: text => text,
    },
}));

/** @type {import('../src/request-proxy.js').default} */
let initRequestProxy;
/** @type {import('node:http').default} */
let http;
/** @type {import('node:https').default} */
let https;
let originalHttpGlobalAgent;
let originalHttpsGlobalAgent;

beforeAll(async () => {
    ({ default: initRequestProxy } = await import('../src/request-proxy.js'));
    ({ default: http } = await import('node:http'));
    ({ default: https } = await import('node:https'));
    originalHttpGlobalAgent = http.globalAgent;
    originalHttpsGlobalAgent = https.globalAgent;
});

beforeEach(() => {
    mockProxyAgent.mockClear();
    mockIsValidUrl.mockReset();
    mockIsValidUrl.mockReturnValue(true);
    http.globalAgent = originalHttpGlobalAgent;
    https.globalAgent = originalHttpsGlobalAgent;
});

afterAll(() => {
    http.globalAgent = originalHttpGlobalAgent;
    https.globalAgent = originalHttpsGlobalAgent;
});

describe('request proxy', () => {
    test('warns that only bypassed URLs are filtered when private request filter is enabled', () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
        const proxyUrl = 'http://127.0.0.1:3128';
        const privateFilterAgent = { id: 'private-filter-agent' };

        http.globalAgent = privateFilterAgent;
        https.globalAgent = privateFilterAgent;

        initRequestProxy({
            enabled: true,
            url: proxyUrl,
            bypass: ['example.com'],
            privateRequestFilterEnabled: true,
        });

        const warningOutput = warnSpy.mock.calls.flat().join(' ');
        expect(warningOutput).toContain('Only URLs that BYPASS the request proxy will be checked.');
        expect(mockProxyAgent).toHaveBeenCalledWith({ httpAgent: privateFilterAgent, httpsAgent: privateFilterAgent });
        expect(http.globalAgent.options).toEqual({ httpAgent: privateFilterAgent, httpsAgent: privateFilterAgent });
        expect(https.globalAgent.options).toEqual({ httpAgent: privateFilterAgent, httpsAgent: privateFilterAgent });

        warnSpy.mockRestore();
        infoSpy.mockRestore();
    });
});
