import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals';

const fetchMock = jest.fn();
jest.unstable_mockModule('node-fetch', () => ({ default: fetchMock }));
jest.unstable_mockModule('../src/endpoints/secrets.js', () => ({
    readSecret: jest.fn().mockReturnValue('test-token'),
    SECRET_KEYS: { NOVEL: 'api_key_novel' },
}));

/** CRC-32 (IEEE 802.3) over a buffer. */
function crc32(buffer) {
    let crc = 0xFFFFFFFF;
    for (const byte of buffer) {
        crc ^= byte;
        for (let i = 0; i < 8; i++) {
            crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
        }
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

/** Builds a minimal ZIP archive with a single STORE-method entry. */
function buildZip(entryName, data) {
    const name = Buffer.from(entryName, 'utf8');
    const crc = crc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    const centralDirectory = Buffer.alloc(46);
    centralDirectory.writeUInt32LE(0x02014b50, 0);
    centralDirectory.writeUInt16LE(20, 4);
    centralDirectory.writeUInt16LE(20, 6);
    centralDirectory.writeUInt32LE(crc, 16);
    centralDirectory.writeUInt32LE(data.length, 20);
    centralDirectory.writeUInt32LE(data.length, 24);
    centralDirectory.writeUInt16LE(name.length, 28);
    centralDirectory.writeUInt32LE(0, 42);
    const endOfCentralDirectory = Buffer.alloc(22);
    endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
    endOfCentralDirectory.writeUInt16LE(1, 8);
    endOfCentralDirectory.writeUInt16LE(1, 10);
    endOfCentralDirectory.writeUInt32LE(centralDirectory.length + name.length, 12);
    endOfCentralDirectory.writeUInt32LE(30 + name.length + data.length, 16);
    return Buffer.concat([localHeader, name, data, centralDirectory, name, endOfCentralDirectory]);
}

describe('NovelAI image generation', () => {
    /** @type {import('node:http').Server} */
    let server;
    let baseUrl;

    beforeAll(async () => {
        const { default: express } = await import('express');
        const { router } = await import('../src/endpoints/novelai.js');
        const app = express();
        app.use(express.json());
        app.use((req, _res, next) => {
            req.user = { directories: {} };
            next();
        });
        app.use(router);
        server = app.listen(0, '127.0.0.1');
        await new Promise(resolve => server.once('listening', resolve));
        const address = server.address();
        baseUrl = `http://127.0.0.1:${address.port}`;
    });

    afterAll(async () => {
        await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    });

    beforeEach(() => {
        fetchMock.mockReset();
    });

    function mockZipResponse() {
        const png = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3]);
        fetchMock.mockResolvedValueOnce({
            ok: true,
            arrayBuffer: async () => Uint8Array.from(buildZip('image_0.png', png)).buffer,
        });
        return png;
    }

    function requestParameters() {
        const [, options] = fetchMock.mock.calls[0];
        return JSON.parse(options.body).parameters;
    }

    test('V5 models use params_version 4 and omit skip_cfg_above_sigma (Variety+ unsupported)', async () => {
        for (const model of ['nai-diffusion-5-full', 'nai-diffusion-5-curated']) {
            fetchMock.mockReset();
            const png = mockZipResponse();

            const response = await fetch(`${baseUrl}/generate-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: '1girl',
                    model: model,
                    width: 832,
                    height: 1216,
                    steps: 28,
                    scale: 6,
                    variety_boost: true,
                    seed: 1234,
                    upscale_ratio: 1,
                }),
            });

            expect(response.status).toBe(200);
            expect(await response.text()).toBe(png.toString('base64'));

            const [url, options] = fetchMock.mock.calls[0];
            expect(url).toBe('https://image.novelai.net/ai/generate-image');
            expect(options.headers.Authorization).toBe('Bearer test-token');
            const parameters = requestParameters();
            expect(parameters.params_version).toBe(4);
            expect(parameters.skip_cfg_above_sigma).toBeNull();
            expect(fetchMock).toHaveBeenCalledTimes(1);
        }
    });

    test('V4.5 keeps params_version 3 and applies the scaled Variety+ sigma', async () => {
        mockZipResponse();

        await fetch(`${baseUrl}/generate-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: '1girl',
                model: 'nai-diffusion-4-5-full',
                width: 832,
                height: 1216,
                variety_boost: true,
                seed: 1234,
                upscale_ratio: 1,
            }),
        });

        const parameters = requestParameters();
        expect(parameters.params_version).toBe(3);
        // 832*1216 is the reference pixel count, so the multiplier applies unscaled
        expect(parameters.skip_cfg_above_sigma).toBeCloseTo(58, 5);
    });

    test('V5 forces karras and disables SMEA and Decrisper regardless of client settings', async () => {
        mockZipResponse();

        await fetch(`${baseUrl}/generate-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: '1girl',
                model: 'nai-diffusion-5-full',
                width: 832,
                height: 1216,
                scheduler: 'exponential',
                sm: true,
                sm_dyn: true,
                decrisper: true,
                seed: 1234,
                upscale_ratio: 1,
            }),
        });

        const parameters = requestParameters();
        expect(parameters.noise_schedule).toBe('karras');
        expect(parameters.sm).toBe(false);
        expect(parameters.sm_dyn).toBe(false);
        expect(parameters.dynamic_thresholding).toBe(false);
    });

    test('V4.5 passes through scheduler, SMEA and Decrisper settings', async () => {
        mockZipResponse();

        await fetch(`${baseUrl}/generate-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: '1girl',
                model: 'nai-diffusion-4-5-full',
                width: 832,
                height: 1216,
                scheduler: 'exponential',
                sm: true,
                sm_dyn: true,
                decrisper: true,
                seed: 1234,
                upscale_ratio: 1,
            }),
        });

        const parameters = requestParameters();
        expect(parameters.noise_schedule).toBe('exponential');
        expect(parameters.sm).toBe(true);
        expect(parameters.sm_dyn).toBe(true);
        expect(parameters.dynamic_thresholding).toBe(true);
    });

    test('V3 keeps params_version 3 and the base Variety+ sigma', async () => {
        mockZipResponse();

        await fetch(`${baseUrl}/generate-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: '1girl',
                model: 'nai-diffusion-3',
                width: 832,
                height: 1216,
                variety_boost: true,
                seed: 1234,
                upscale_ratio: 1,
            }),
        });

        const parameters = requestParameters();
        expect(parameters.params_version).toBe(3);
        expect(parameters.skip_cfg_above_sigma).toBeCloseTo(19, 5);
    });
});
