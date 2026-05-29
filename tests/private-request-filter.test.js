import { describe, test, expect, jest, beforeAll, beforeEach, afterAll } from '@jest/globals';

const mockNetConnect = jest.fn(() => ({ type: 'net-socket' }));
const mockTlsConnect = jest.fn(() => ({ type: 'tls-socket' }));
const mockLookup = jest.fn();

jest.unstable_mockModule('node:net', () => ({
    default: { connect: mockNetConnect },
}));

jest.unstable_mockModule('node:tls', () => ({
    default: { connect: mockTlsConnect },
}));

jest.unstable_mockModule('node:dns', () => ({
    default: { promises: { lookup: mockLookup } },
}));

jest.unstable_mockModule('../src/util.js', () => ({
    color: {
        red: text => text,
        green: text => text,
        blue: text => text,
        yellow: text => text,
    },
}));

jest.unstable_mockModule('../src/express-common.js', () => ({
    filterValidIpPatterns: patterns => patterns,
}));

/** @type {import('../src/private-request-filter.js').default} */
let initPrivateRequestFilter;
/** @type {import('node:http').default} */
let http;
/** @type {import('node:https').default} */
let https;
let originalHttpGlobalAgent;
let originalHttpsGlobalAgent;

beforeAll(async () => {
    ({ default: initPrivateRequestFilter } = await import('../src/private-request-filter.js'));
    ({ default: http } = await import('node:http'));
    ({ default: https } = await import('node:https'));
    originalHttpGlobalAgent = http.globalAgent;
    originalHttpsGlobalAgent = https.globalAgent;
});

beforeEach(() => {
    mockNetConnect.mockClear();
    mockTlsConnect.mockClear();
    mockLookup.mockReset();
    http.globalAgent = originalHttpGlobalAgent;
    https.globalAgent = originalHttpsGlobalAgent;
});

afterAll(() => {
    http.globalAgent = originalHttpGlobalAgent;
    https.globalAgent = originalHttpsGlobalAgent;
});

function initAgent({ privateAddressWhitelist = [], allowUnresolvedHosts = false, enableHappyEyeballs = true } = {}) {
    initPrivateRequestFilter({
        listen: false,
        enabled: true,
        privateAddressWhitelist,
        logBlocked: false,
        logAllowed: false,
        allowUnresolvedHosts,
        enableHappyEyeballs,
        happyEyeballsTimeout: 250,
    });

    return http.globalAgent;
}

describe('private request filter', () => {
    test('allows direct private IP requests only when whitelisted', async () => {
        const agent = initAgent({ privateAddressWhitelist: ['127.0.0.0/8'] });
        await agent.connect({}, { host: '127.0.0.1', secureEndpoint: false });

        expect(mockNetConnect).toHaveBeenCalledWith(expect.objectContaining({ host: '127.0.0.1' }));

        const blockedAgent = initAgent({ privateAddressWhitelist: [] });
        await expect(blockedAgent.connect({}, { host: '127.0.0.1', secureEndpoint: false }))
            .rejects
            .toThrow('Blocked request to private IP address: 127.0.0.1');
    });

    test('resolves hostnames and blocks when DNS returns private IP', async () => {
        mockLookup.mockResolvedValue([{ address: '192.168.1.8', family: 4 }]);
        const agent = initAgent();

        await expect(agent.connect({}, { host: 'example.com', secureEndpoint: false }))
            .rejects
            .toThrow(/Blocked request to example\.com - resolves to private IP address\(es\): 192\.168\.1\.8/);
        expect(mockNetConnect).not.toHaveBeenCalled();
    });

    test('connects using hostname for Happy Eyeballs when all resolved IPs are public', async () => {
        mockLookup.mockResolvedValue([
            { address: '93.184.216.34', family: 4 },
            { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
        ]);
        const agent = initAgent({ enableHappyEyeballs: true });

        await agent.connect({}, { host: 'example.com', secureEndpoint: false });

        expect(mockLookup).toHaveBeenCalledWith('example.com', { all: true });
        // With Happy Eyeballs, connects using hostname to allow address family racing
        expect(mockNetConnect).toHaveBeenCalledWith(expect.objectContaining({
            host: 'example.com',
            autoSelectFamily: true,
            autoSelectFamilyAttemptTimeout: 250,
        }));
    });

    test('blocks when any resolved address is private (prevents DNS rebinding)', async () => {
        mockLookup.mockResolvedValue([
            { address: '93.184.216.34', family: 4 },
            { address: '192.168.1.1', family: 4 },
        ]);
        const agent = initAgent();

        await expect(agent.connect({}, { host: 'example.com', secureEndpoint: false }))
            .rejects
            .toThrow(/Blocked request to example\.com - resolves to private IP address\(es\): 192\.168\.1\.1/);
        expect(mockNetConnect).not.toHaveBeenCalled();
    });

    test('handles unresolved hosts according to allowUnresolvedHosts setting', async () => {
        mockLookup.mockRejectedValue(new Error('lookup failed'));
        const blockedAgent = initAgent({ allowUnresolvedHosts: false });

        await expect(blockedAgent.connect({}, { host: 'missing-host.local', secureEndpoint: false }))
            .rejects
            .toThrow('Unable to resolve host: missing-host.local. Set privateAddressWhitelist.allowUnresolvedHosts to true to bypass this check.');
        expect(mockNetConnect).not.toHaveBeenCalled();

        const allowedAgent = initAgent({ allowUnresolvedHosts: true });
        await allowedAgent.connect({}, { host: 'missing-host.local', secureEndpoint: false });
        expect(mockNetConnect).toHaveBeenCalledWith(expect.objectContaining({ host: 'missing-host.local' }));
    });

    test('uses tls.connect for secure endpoints', async () => {
        mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
        const agent = initAgent();
        await agent.connect({}, { host: 'example.com', secureEndpoint: true });
        expect(mockLookup).toHaveBeenCalledWith('example.com', { all: true });
        expect(mockTlsConnect).toHaveBeenCalledWith(expect.objectContaining({ host: 'example.com' }));
        expect(mockNetConnect).not.toHaveBeenCalled();
    });

    test('passes Happy Eyeballs options to connection', async () => {
        mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
        const agent = initAgent({ enableHappyEyeballs: true });
        await agent.connect({}, { host: 'example.com', secureEndpoint: false });

        expect(mockNetConnect).toHaveBeenCalledWith(expect.objectContaining({
            autoSelectFamily: true,
            autoSelectFamilyAttemptTimeout: 250,
        }));
    });

    test('omits Happy Eyeballs options when disabled', async () => {
        mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
        const agent = initAgent({ enableHappyEyeballs: false });
        await agent.connect({}, { host: 'example.com', secureEndpoint: false });

        const callOptions = mockNetConnect.mock.calls[0][0];
        expect(callOptions.autoSelectFamily).toBeUndefined();
        expect(callOptions.autoSelectFamilyAttemptTimeout).toBeUndefined();
    });

    test('installs a custom lookup that returns the pre-validated addresses (anti-rebinding)', async () => {
        const resolved = [
            { address: '93.184.216.34', family: 4 },
            { address: '2606:2800:220:1:248:1893:25c8:1946', family: 6 },
        ];
        mockLookup.mockResolvedValue(resolved);
        const agent = initAgent({ enableHappyEyeballs: true });

        await agent.connect({}, { host: 'example.com', secureEndpoint: false });

        const callOptions = mockNetConnect.mock.calls[0][0];
        expect(typeof callOptions.lookup).toBe('function');

        // The socket should receive the validated set, never re-query DNS.
        const allCb = jest.fn();
        callOptions.lookup('example.com', { all: true }, allCb);
        expect(allCb).toHaveBeenCalledWith(null, resolved);

        const singleCb = jest.fn();
        callOptions.lookup('example.com', {}, singleCb);
        expect(singleCb).toHaveBeenCalledWith(null, resolved[0].address, resolved[0].family);

        // Critically: the lookup we installed does NOT call the real DNS resolver again.
        expect(mockLookup).toHaveBeenCalledTimes(1);
    });
});
