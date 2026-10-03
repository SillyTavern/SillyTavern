import { test, expect, jest } from '@jest/globals';
import { translator, countdownText, cacheText, statusText, updateInstalledExtension } from '../public/scripts/extensions/cache-keepalive/ui.js';

test('localizes Chinese and English statuses and errors separately', () => {
    expect(translator('zh-CN')('title')).toBe('自动保持缓存在线');
    expect(translator('en-US')('title')).toBe('Automatic cache keepalive');
    expect(statusText({ status: 'Paused: API returned an error; check the server log' }, translator('zh-CN'))).toBe('已暂停: 接口返回错误');
    expect(statusText({ status: 'Paused: Failed to fetch' }, translator('zh-CN'))).toBe('已暂停: 网络请求失败');
});

test('counts down against the actual deadline and distinguishes paused/offline/running', () => {
    const t = translator('en');
    const state = { enabled: true, request: {}, nextAt: 240000, count: 0 };
    expect(countdownText(state, t, 120000)).toBe('02:00');
    expect(countdownText(state, t, 121000)).toBe('01:59');
    expect(countdownText(state, t, 120000, true)).toBe('Waiting for connection');
    expect(countdownText({ ...state, count: 6 }, t, 120000)).toBe('Paused');
    expect(countdownText({ ...state, controller: {} }, t, 120000)).toBe('Refreshing');
});

test('distinguishes not yet checked, missing usage, zero hits and confirmed hits', () => {
    const t = translator('zh-CN');
    expect(cacheText(null, t)).toBe('尚未检查');
    expect(cacheText({ readTokens: null, writeTokens: null }, t)).toContain('未知');
    expect(cacheText({ readTokens: 0, writeTokens: 200 }, t)).toBe('未命中（读取缓存 0 个词元） · 已写入：200 个词元');
    expect(cacheText({ readTokens: 800, writeTokens: null }, t)).toBe('已命中：800 个词元');
});

test('updates the discovered global installation using its actual folder name', async () => {
    const fetcher = jest.fn().mockResolvedValueOnce(Response.json([{ name: 'third-party/custom-folder', type: 'global' }]))
        .mockResolvedValueOnce(Response.json({ isUpToDate: false }));
    const result = await updateInstalledExtension('http://localhost/scripts/extensions/third-party/custom-folder/index.js', fetcher, { 'X-CSRF-Token': 'test' });
    expect(result).toBe('updated');
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ extensionName: 'custom-folder', global: true });
    expect(fetcher.mock.calls[1][1].headers['X-CSRF-Token']).toBe('test');
});

test('does not try to update a built-in or missing extension', async () => {
    const fetcher = jest.fn().mockResolvedValue(Response.json([]));
    expect(await updateInstalledExtension('http://localhost/scripts/extensions/cache-keepalive/index.js', fetcher, {})).toBe('builtin');
    expect(fetcher).not.toHaveBeenCalled();
    expect(await updateInstalledExtension('http://localhost/scripts/extensions/third-party/missing/index.js', fetcher, {})).toBe('missing');
    expect(fetcher).toHaveBeenCalledTimes(1);
});

test('reports denied updates without claiming success', async () => {
    const fetcher = jest.fn().mockResolvedValueOnce(Response.json([{ name: 'third-party/example', type: 'local' }]))
        .mockResolvedValueOnce(new Response('', { status: 403 }));
    expect(await updateInstalledExtension('http://localhost/scripts/extensions/third-party/example/index.js', fetcher, {})).toBe('forbidden');
});
