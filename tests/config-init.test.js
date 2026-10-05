import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { addMissingConfigValues } from '../src/config-init.js';

const oldEnvKey = 'SILLYTAVERN_DISABLETHUMBNAILS';
const newEnvKey = 'SILLYTAVERN_THUMBNAILS_ENABLED';

describe('addMissingConfigValues', () => {
    let tempDirectory;
    let configPath;

    beforeEach(() => {
        tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'sillytavern-config-'));
        configPath = path.join(tempDirectory, 'config.yaml');
        fs.writeFileSync(configPath, '{}\n');
        delete process.env[oldEnvKey];
        delete process.env[newEnvKey];
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        delete process.env[oldEnvKey];
        delete process.env[newEnvKey];
        fs.rmSync(tempDirectory, { recursive: true, force: true });
        jest.restoreAllMocks();
    });

    test.each([
        ['false', 'true'],
        ['true', 'false'],
    ])('migrates the boolean environment value %s to %s', (oldValue, newValue) => {
        process.env[oldEnvKey] = oldValue;

        addMissingConfigValues(configPath);

        expect(process.env[newEnvKey]).toBe(newValue);
        expect(process.env[oldEnvKey]).toBeUndefined();
    });
});
