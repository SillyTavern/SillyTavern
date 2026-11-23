// Run: node --test tests/server-stop.check.mjs
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import test from 'node:test';
import vm from 'node:vm';

const startupSource = readFileSync(new URL('../src/server-startup.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const mainSource = readFileSync(new URL('../src/server-main.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const classBody = startupSource.slice(startupSource.indexOf('export class ServerStartup')).replace('export ', '');
const quiet = { log() {}, warn() {}, error() {} };
const turn = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

function fixture(createServer = http.createServer, getHasIP = async () => ({})) {
    const ServerStartup = vm.runInNewContext(`${classBody}; ServerStartup`, {
        http: { createServer }, https: { createServer: (_options, app) => createServer(app) },
        fs: { existsSync: () => true, readFileSync: () => '' },
        color: { red: value => value, green: value => value },
        urlHostnameToIPv6: value => value.replace(/^\[|\]$/g, ''), getHasIP, console: quiet,
        process: { exit: code => assert.fail(`Unexpected startup exit: ${code}`) },
    });
    const args = {
        enableIPv6: true, enableIPv4: true, ssl: false,
        certPath: 'fixture-cert', keyPath: 'fixture-key',
        getIPv6ListenUrl: () => new URL('http://127.0.0.1:0'),
        getIPv4ListenUrl: () => new URL('http://127.0.0.1:0'),
    };
    return { ServerStartup, args };
}

test('HTTP and HTTPS paths close all listeners while admitted responses finish', async t => {
    for (const ssl of [false, true]) {
        await t.test(ssl ? 'HTTPS construction path' : 'HTTP', async () => {
            const admitted = deferred();
            const responses = [];
            const { ServerStartup, args } = fixture();
            // HTTPS construction is stubbed to HTTP; no certificate files or ST imports.
            const startup = new ServerStartup((_request, response) => {
                responses.push(response);
                if (responses.length === 2) admitted.resolve();
            }, { ...args, ssl });
            const clients = [];
            try {
                await startup.start();
                const bodies = startup.servers.map(({ server }) => new Promise((resolve, reject) => {
                    const request = http.get({ host: '127.0.0.1', port: server.address().port, agent: false }, response => {
                        let body = '';
                        response.on('data', chunk => { body += chunk; });
                        response.on('end', () => resolve(body));
                        response.on('error', reject);
                    });
                    request.on('error', reject);
                    clients.push(request);
                }));
                await admitted.promise;
                let finished = false;
                const stopping = startup.stop();
                stopping.then(() => { finished = true; });
                assert.equal(startup.stop(), stopping);
                assert.ok(startup.servers.every(({ server }) => !server.listening));
                await turn();
                assert.equal(finished, false);
                responses[0].end('first');
                await turn();
                assert.equal(finished, false);
                responses[1].end('second');
                assert.deepEqual(await Promise.all(bodies), ['first', 'second']);
                await stopping;
            } finally {
                responses.forEach(response => response.end());
                clients.forEach(request => request.destroy());
                await startup.stop();
            }
        });
    }
});

test('Stop waits for a pending bind and prevents the second listener', async () => {
    const servers = [];
    const { ServerStartup, args } = fixture(() => {
        const server = new EventEmitter();
        server.listening = false;
        server.listen = () => {};
        server.closeIdleConnections = () => {};
        server.close = callback => { server.listening = false; callback(); };
        servers.push(server);
        return server;
    });
    const startup = new ServerStartup(() => {}, args);
    const starting = startup.start();
    let stopped = false;
    const stopping = startup.stop().then(() => { stopped = true; });
    await turn();
    assert.equal(stopped, false);
    servers[0].listening = true;
    servers[0].emit('listening');
    await Promise.all([starting, stopping]);
    assert.equal(servers.length, 1);
    assert.equal(servers[0].listening, false);
    await startup.start();
    assert.equal(servers.length, 1);
});

test('Stop during IP discovery or before start creates no listeners', async () => {
    const discovery = deferred();
    const { ServerStartup, args } = fixture(() => assert.fail('Late listener'), () => discovery.promise);
    const startup = new ServerStartup(() => {}, { ...args, enableIPv6: 'auto', enableIPv4: 'auto' });
    const starting = startup.start();
    await startup.stop();
    discovery.resolve({ hasIPv6Local: true, hasIPv4Local: true });
    await starting;
    const neverStarted = new ServerStartup(() => {}, args);
    await neverStarted.stop();
    await neverStarted.start();
});

test('a failed IPv6 bind still permits IPv4 and does not stall Stop', async () => {
    let created = 0;
    const { ServerStartup, args } = fixture(() => {
        const fails = created++ === 0;
        const server = new EventEmitter();
        server.listening = false;
        server.listen = () => queueMicrotask(() => {
            if (fails) server.emit('error', Object.assign(new Error('Fixture port occupied'), { code: 'EADDRINUSE' }));
            else {
                server.listening = true;
                server.emit('listening');
            }
        });
        server.close = callback => { server.listening = false; callback(); };
        server.closeIdleConnections = () => {};
        return server;
    });
    const startup = new ServerStartup(() => {}, args);
    const result = await startup.start();
    assert.equal(result.v6Failed, true);
    assert.equal(result.v4Failed, false);
    assert.equal(created, 2);
    await startup.stop();
    assert.ok(startup.servers.every(({ server }) => !server.listening));
});

test('a failed close remains observable and allows another Stop', async () => {
    const { ServerStartup, args } = fixture();
    const startup = new ServerStartup(() => {}, { ...args, enableIPv6: false });
    await startup.start();
    const { server } = startup.servers[0];
    const close = server.close;
    server.close = callback => callback(new Error('Fixture close failure'));
    try {
        await assert.rejects(startup.stop(), /Fixture close failure/);
        assert.equal(server.listening, true);
    } finally {
        server.close = close;
        await startup.stop();
    }
    assert.equal(server.listening, false);
});

test('one failed close cannot skip another listener still draining', async () => {
    const admitted = deferred();
    const { ServerStartup, args } = fixture();
    let response;
    const startup = new ServerStartup((_request, incoming) => {
        response = incoming;
        admitted.resolve();
    }, args);
    await startup.start();
    const [first, second] = startup.servers.map(({ server }) => server);
    const close = second.close;
    const request = http.get({ host: '127.0.0.1', port: first.address().port, agent: false }, incoming => incoming.resume());
    request.on('error', () => {});
    await admitted.promise;
    second.close = callback => callback(new Error('Fixture second close failure'));
    let settled = false;
    const stopping = startup.stop();
    const rejected = assert.rejects(stopping, /Fixture second close failure/).then(() => { settled = true; });
    try {
        await turn();
        assert.equal(settled, false);
        assert.equal(startup.stop(), stopping);
    } finally {
        response.end('finished');
        await rejected;
        second.close = close;
        request.destroy();
        await startup.stop();
    }
    assert.ok(startup.servers.every(({ server }) => !server.listening));
});

function shutdownFixture(stop, calls) {
    const block = mainSource.slice(mainSource.indexOf('    const consoleTitle ='), mainSource.indexOf('    // Add private request filter.'));
    const process = new EventEmitter();
    process.title = 'fixture';
    process.exit = () => calls.push('exit');
    const exitProcess = vm.runInNewContext(`${block}\nexitProcess;`, {
        serverStartup: { stop }, process,
        statsOnExit: async () => calls.push('stats'), cleanupPlugins: async () => calls.push('plugins'),
        diskCache: { dispose: () => calls.push('cache') }, setWindowTitle: () => calls.push('title'),
        console: { error: () => calls.push('error') },
    });
    return { exitProcess, process };
}

test('shutdown waits for drain, then preserves cleanup order once', async () => {
    const calls = [];
    const drained = deferred();
    const { exitProcess } = shutdownFixture(() => { calls.push('stop'); return drained.promise; }, calls);
    const exiting = exitProcess();
    await exitProcess();
    await turn();
    assert.deepEqual(calls, ['stop']);
    drained.resolve();
    await exiting;
    assert.deepEqual(calls, ['stop', 'stats', 'plugins', 'cache', 'title', 'exit']);
});

test('fatal exceptions preserve existing cleanup without waiting for responses', async () => {
    const calls = [];
    const { process } = shutdownFixture(() => assert.fail('Fatal exception must not wait for drain'), calls);
    process.emit('uncaughtException', new Error('Fixture fatal exception'));
    await turn();
    assert.deepEqual(calls, ['error', 'stats', 'plugins', 'cache', 'title', 'exit']);
});

test('fatal exceptions during drain run cleanup once without waiting', async () => {
    const calls = [];
    const drained = deferred();
    const { exitProcess, process } = shutdownFixture(() => drained.promise, calls);
    const exiting = exitProcess();
    process.emit('uncaughtException', new Error('Fixture fatal during drain'));
    await turn();
    assert.deepEqual(calls, ['error', 'stats', 'plugins', 'cache', 'title', 'exit']);
    drained.resolve();
    await exiting;
    assert.equal(calls.filter(call => call === 'exit').length, 1);
});

test('a rejected drain permits another shutdown attempt', async () => {
    const calls = [];
    let attempt = 0;
    const { exitProcess } = shutdownFixture(() => {
        if (attempt++ === 0) return Promise.reject(new Error('Fixture drain failure'));
        return Promise.resolve();
    }, calls);
    await assert.rejects(exitProcess(), /Fixture drain failure/);
    assert.deepEqual(calls, []);
    await exitProcess();
    assert.deepEqual(calls, ['stats', 'plugins', 'cache', 'title', 'exit']);
});

test('Stop during post-start hostname discovery prevents browser and heartbeat work', async () => {
    const hostname = deferred();
    const startup = { stopping: false };
    const functionBody = mainSource.slice(mainSource.indexOf('async function postSetupTasks('), mainSource.indexOf('/**\n * Registers a not-found'));
    const postSetupTasks = vm.runInNewContext(`${functionBody}; postSetupTasks`, {
        serverStartup: startup, cliArgs: { getBrowserLaunchHostname: () => hostname.promise },
    });
    const pending = postSetupTasks({});
    startup.stopping = true;
    hostname.resolve('fixture');
    await pending;
});
