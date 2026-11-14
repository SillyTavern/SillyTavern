import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveUploadPath, UploadDirectoryError } from '../src/upload-directories.js';

const directoryLinkType = process.platform === 'win32' ? 'junction' : 'dir';

describe('resolveUploadPath', () => {
    let fixture;
    let base;

    beforeEach(() => {
        fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'st-upload-directory-'));
        base = path.join(fixture, 'uploads');
        fs.mkdirSync(base);
    });

    afterEach(() => {
        jest.restoreAllMocks();
        if (path.dirname(fixture) !== path.resolve(os.tmpdir()) || !path.basename(fixture).startsWith('st-upload-directory-')) {
            throw new Error('Invalid test fixture cleanup path.');
        }
        fs.rmSync(fixture, { recursive: true, force: true });
    });

    test('resolves nested targets without creating directories', () => {
        const directory = 'extension/角色 A/开心#100%';
        expect(resolveUploadPath(base, directory, 'image.png')).toBe(path.join(base, directory, 'image.png'));
        expect(fs.existsSync(path.join(base, 'extension'))).toBe(false);
    });

    test('supports root targets and missing storage roots', () => {
        expect(resolveUploadPath(base, '')).toBe(base);
        expect(resolveUploadPath(base, '', 'file.json')).toBe(path.join(base, 'file.json'));
        const missingBase = path.join(fixture, 'new-root');
        expect(resolveUploadPath(missingBase, 'a/b', 'file.txt')).toBe(path.join(missingBase, 'a/b/file.txt'));
        expect(fs.existsSync(missingBase)).toBe(false);
    });

    test('keeps literal percent-encoded names distinct from decoded names', () => {
        expect(resolveUploadPath(base, 'a%20b')).not.toBe(resolveUploadPath(base, 'a b'));
        expect(resolveUploadPath(base, '%2e%2e/data')).toBe(path.join(base, '%2e%2e/data'));
    });

    test('preserves valid surrogate pairs in directory and file names', () => {
        const emoji = '\uD83D\uDE00';
        expect(resolveUploadPath(base, 'emoji/' + emoji, emoji + '.png')).toBe(path.join(base, 'emoji', emoji, emoji + '.png'));
    });

    test.each([['high', '\uD800'], ['low', '\uDC00']])('rejects unpaired %s surrogates before filesystem access', (_kind, character) => {
        const access = jest.spyOn(fs, 'lstatSync');
        expect(() => resolveUploadPath(base, 'parent/' + character + '/child', 'file.png')).toThrow(UploadDirectoryError);
        expect(() => resolveUploadPath(base, 'valid', character + '.png')).toThrow(UploadDirectoryError);
        expect(access).not.toHaveBeenCalled();
    });

    test.each([
        null, undefined, 1, {}, ['a'], '/', '/outside', 'C:/outside', 'C:outside',
        '\\\\server\\share', 'a\\b', '../outside', './a', 'a/../b', 'a/./b',
        'a//b', 'a/', '.', '..', 'a/\0b', 'a/\nb', 'a/con', 'a/NUL.txt',
        'a/b.', 'a/b ', 'a/b:c', 'a/b?c', 'a/' + 'x'.repeat(256),
    ])('rejects invalid directory %p', directory => {
        expect(() => resolveUploadPath(base, directory, 'file.txt')).toThrow(UploadDirectoryError);
    });

    test.each(['../file.txt', 'a/file.txt', 'a\\file.txt', '.', '..', '\0.txt', null])('rejects path-like filename %p', fileName => {
        expect(() => resolveUploadPath(base, 'a', fileName)).toThrow(UploadDirectoryError);
    });

    test('accepts existing directories and regular files', () => {
        fs.mkdirSync(path.join(base, 'a'));
        fs.writeFileSync(path.join(base, 'a', 'file.json'), '{}');
        expect(resolveUploadPath(base, 'a', 'file.json')).toBe(path.join(base, 'a', 'file.json'));
    });

    test('rejects files used as directories and directories used as files', () => {
        fs.writeFileSync(path.join(base, 'file'), '');
        fs.mkdirSync(path.join(base, 'folder'));
        expect(() => resolveUploadPath(base, 'file/child')).toThrow(UploadDirectoryError);
        expect(() => resolveUploadPath(base, '', 'folder')).toThrow(UploadDirectoryError);
    });

    test('rejects linked directories and linked final targets', () => {
        const outside = path.join(fixture, 'outside');
        fs.mkdirSync(outside);
        fs.symlinkSync(outside, path.join(base, 'escape'), directoryLinkType);
        fs.symlinkSync(outside, path.join(base, 'linked.png'), directoryLinkType);
        expect(() => resolveUploadPath(base, 'escape/new', 'file.txt')).toThrow(UploadDirectoryError);
        expect(() => resolveUploadPath(base, '', 'linked.png')).toThrow(UploadDirectoryError);
        expect(fs.readdirSync(outside)).toEqual([]);
    });

    test('rejects links to another directory inside the storage root', () => {
        const actual = path.join(base, 'actual');
        fs.mkdirSync(actual);
        fs.symlinkSync(actual, path.join(base, 'alias'), directoryLinkType);
        expect(() => resolveUploadPath(base, 'alias', 'file.txt')).toThrow(UploadDirectoryError);
    });

    test('allows a linked configured storage root', () => {
        const linkedBase = path.join(fixture, 'linked-root');
        fs.symlinkSync(base, linkedBase, directoryLinkType);
        fs.mkdirSync(path.join(base, 'existing'));
        expect(resolveUploadPath(linkedBase, 'existing/new', 'file.txt')).toBe(path.join(linkedBase, 'existing/new/file.txt'));
    });

    test('propagates filesystem failures instead of treating them as validation errors', () => {
        const failure = Object.assign(new Error('Access denied'), { code: 'EACCES' });
        jest.spyOn(fs, 'lstatSync').mockImplementation(() => { throw failure; });
        expect(() => resolveUploadPath(base, 'existing')).toThrow(failure);
    });
});
