import { afterAll, afterEach, beforeAll, beforeEach, expect, jest, test } from '@jest/globals';
import http from 'node:http';
import { once } from 'node:events';
import express from 'express';
import { TEXTGEN_TYPES } from '../src/constants.js';

const setAdditionalHeaders = jest.fn();
jest.unstable_mockModule('../src/additional-headers.js', () => ({ setAdditionalHeaders }));
const { router } = await import('../src/endpoints/backends/text-completions.js');
const servers = [];
const clients = [];

beforeAll(() => {
    for (const method of ['debug', 'info', 'error']) jest.spyOn(console, method).mockImplementation(() => {});
});
afterAll(() => jest.restoreAllMocks());
beforeEach(() => setAdditionalHeaders.mockClear());
afterEach(async () => {
    for (const client of clients.splice(0)) client.destroy();
    await Promise.all(servers.splice(0).map(server => new Promise(resolve => {
        server.close(resolve);
        server.closeAllConnections();
    })));
});

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

async function within(promise) {
    let timer;
    try {
        return await Promise.race([
            promise,
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Request did not settle')), 1000); }),
        ]);
    } finally {
        clearTimeout(timer);
    }
}

async function listen(server) {
    servers.push(server);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    return `http://127.0.0.1:${server.address().port}`;
}

async function generate(apiType, stream = true) {
    const generation = deferred();
    const generationClosed = deferred();
    const remoteAbort = deferred();
    const downstreamClosed = deferred();
    const abortRequests = [];
    const upstreamUrl = await listen(http.createServer((request, response) => {
        if (request.url === '/api/extra/abort') {
            abortRequests.push(request.method);
            remoteAbort.resolve(response);
        } else {
            response.once('close', generationClosed.resolve);
            generation.resolve(response);
        }
    }));
    const app = express();
    app.use(express.json());
    app.use((request, response, next) => {
        response.once('finish', () => request.socket.once('close', downstreamClosed.resolve));
        next();
    });
    app.use(router);
    const proxyUrl = await listen(http.createServer(app));
    const client = http.request(`${proxyUrl}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        agent: false,
    });
    clients.push(client);
    client.on('error', () => {});
    const clientResponse = deferred();
    client.on('response', clientResponse.resolve);
    client.end(JSON.stringify({ api_server: `${upstreamUrl}/v1`, api_type: apiType, stream }));
    return { client, generation, generationClosed, remoteAbort, abortRequests, clientResponse, downstreamClosed };
}

test('cancels the generation transport while the separate Kobold abort endpoint is stalled', async () => {
    const state = await generate(TEXTGEN_TYPES.KOBOLDCPP);
    const upstream = await within(state.generation.promise);
    state.client.destroy();
    const abortResponse = await within(state.remoteAbort.promise);
    await within(state.generationClosed.promise);
    expect(upstream.destroyed).toBe(true);
    expect(abortResponse.destroyed).toBe(false);
    expect(state.abortRequests).toEqual(['POST']);
});

test('still sends the separate Kobold abort request when it responds normally', async () => {
    const state = await generate(TEXTGEN_TYPES.KOBOLDCPP);
    await within(state.generation.promise);
    state.client.destroy();
    const abortResponse = await within(state.remoteAbort.promise);
    abortResponse.end('{}');
    await within(state.generationClosed.promise);
    expect(state.abortRequests).toEqual(['POST']);
});

test('cancels other backends without sending a Kobold abort request', async () => {
    const state = await generate(TEXTGEN_TYPES.OOBA);
    const upstream = await within(state.generation.promise);
    state.client.destroy();
    await within(state.generationClosed.promise);
    expect(upstream.destroyed).toBe(true);
    expect(state.abortRequests).toEqual([]);
});

for (const { stream, format, expected } of [
    { stream: false, format: 'JSON', expected: JSON.stringify({ choices: [{ text: 'complete' }] }) },
    { stream: true, format: 'streaming', expected: 'data: [DONE]\n\n' },
]) {
    test(`does not send a Kobold abort after a completed ${format} response`, async () => {
        const state = await generate(TEXTGEN_TYPES.KOBOLDCPP, stream);
        const upstream = await within(state.generation.promise);
        upstream.end(expected);
        const response = await within(state.clientResponse.promise);
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        await within(once(response, 'end'));
        await within(state.generationClosed.promise);
        await within(state.downstreamClosed.promise);
        expect(Buffer.concat(chunks).toString()).toBe(expected);
        expect(state.abortRequests).toEqual([]);
        expect(setAdditionalHeaders).toHaveBeenCalledTimes(1);
    });
}
