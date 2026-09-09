export const VERSION = '1.0.5';

const messages = {
    en: {
        title: 'Automatic cache keepalive', enable: 'Enable', interval: 'Interval in minutes', resume: 'Resume',
        hint: 'Capture a normal chat request first. Background replies never enter chat. API usage is billable; keep this tab open.',
        version: 'Version', update: 'Check and update', updating: 'Checking for updates…', updated: 'Update installed. Reload the page to apply it.',
        upToDate: 'Already up to date. Reload if another tab installed an update.', updateFailed: 'Update failed. Check network access, repository state and server logs.',
        forbidden: 'No permission to update this extension. Ask your SillyTavern administrator.',
        builtin: 'Built-in version: update the SillyTavern source branch that includes this feature.',
        missing: 'Cannot find the installed extension. Open Manage extensions to check its installation.',
        reload: 'Reload page', snapshot: 'Request snapshot', captured: 'Captured ({count} messages)', noSnapshot: 'Not captured — send a normal message after enabling',
        countdown: 'Next refresh', off: 'Disabled', waiting: 'Waiting for a request', due: 'Due; waiting for the next check', running: 'Refreshing',
        paused: 'Paused', offline: 'Waiting for connection', never: 'None yet', lastSuccess: 'Last successful refresh',
        cache: 'Cache result of last refresh', untested: 'Not checked yet', unknown: 'Unknown — provider returned no cache usage',
        hit: 'Hit: {count} cached tokens', miss: 'No hit reported (0 cached tokens)', written: 'Written: {count} tokens',
        cacheHint: 'Request captured does not mean cache hit. Cache results describe the last completed refresh, not current cache availability.',
        invalid: 'Interval must be between 0.1 and 1440 minutes.', error: 'Request failed; check the connection and server logs',
        apiError: 'API returned an error', incomplete: 'Incomplete streaming response', network: 'Network request failed',
        'Disabled': 'Disabled', 'Waiting for a normal chat request': 'Waiting for a normal chat request',
        'Context changed; waiting for a normal chat request': 'Context changed; waiting for a normal chat request',
        'Waiting for a context snapshot': 'Waiting for a context snapshot', 'Waiting for next refresh': 'Waiting for next refresh',
        'Refreshing in background': 'Refreshing in background', 'Refresh completed': 'Refresh completed',
        'Paused: context unchanged for 6 refreshes': 'Paused: context unchanged for 6 refreshes',
        'Paused: request timed out': 'Paused: request timed out',
        'Unsupported request; waiting for a normal chat request': 'Unsupported request; waiting for a normal chat request',
        'No completed reply; waiting for a normal chat request': 'No completed reply; waiting for a normal chat request',
    },
    zh: {
        title: '自动保持缓存在线', enable: '开启', interval: '刷新间隔（分钟）', resume: '恢复',
        hint: '开启后先正常发送一次消息。后台回复不会写入聊天；请求会产生 API 费用，请保持页面打开。',
        version: '当前版本', update: '检查并更新', updating: '正在检查更新…', updated: '更新已安装，请刷新页面使其生效。',
        upToDate: '已是最新版本。如果其他页面刚安装了更新，请刷新本页。', updateFailed: '更新失败，请检查网络、插件仓库状态和酒馆服务端日志。',
        forbidden: '没有更新此扩展的权限，请联系酒馆管理员。',
        builtin: '这是内置版，请更新包含此功能的酒馆源码分支。',
        missing: '未找到对应的插件安装记录，请到“管理扩展程序”检查。',
        reload: '刷新页面', snapshot: '请求快照', captured: '已捕获（{count} 条消息）', noSnapshot: '尚未捕获，请在开启后正常发送一次消息',
        countdown: '下次刷新', off: '已关闭', waiting: '等待捕获请求', due: '已到期，等待下一次检查', running: '正在刷新',
        paused: '已暂停', offline: '等待连接恢复', never: '暂无', lastSuccess: '上次保活成功',
        cache: '最近一次保活的缓存结果', untested: '尚未检查', unknown: '未知，服务商未返回缓存用量',
        hit: '已命中：{count} 个词元', miss: '未命中（读取缓存 0 个词元）', written: '已写入：{count} 个词元',
        cacheHint: '捕获请求不等于缓存命中。这里展示最近一次完成的保活结果，不代表缓存此刻仍然有效。',
        invalid: '间隔必须在 0.1～1440 分钟之间。', error: '请求失败，请检查连接和服务端日志',
        apiError: '接口返回错误', incomplete: '流式响应未完整结束', network: '网络请求失败',
        'Disabled': '已关闭', 'Waiting for a normal chat request': '等待一次正常聊天请求',
        'Context changed; waiting for a normal chat request': '上下文已变化，等待新的正常聊天请求',
        'Waiting for a context snapshot': '等待上下文快照', 'Waiting for next refresh': '运行中，等待下次刷新',
        'Refreshing in background': '正在后台刷新', 'Refresh completed': '保活请求成功',
        'Paused: context unchanged for 6 refreshes': '已暂停：上下文连续 6 次刷新未变化',
        'Paused: request timed out': '已暂停：请求超时',
        'Unsupported request; waiting for a normal chat request': '请求类型不受支持，等待正常聊天请求',
        'No completed reply; waiting for a normal chat request': '正常回复未完成，等待新的聊天请求',
    },
};

export function translator(locale) {
    const dict = messages[String(locale).toLowerCase().startsWith('zh') ? 'zh' : 'en'];
    return (key, values = {}) => (dict[key] ?? dict.error).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}

export function statusText(state, t) {
    if (!state.status.startsWith('Paused: ') || messages.en[state.status]) return t(state.status);
    const error = state.status.slice(8);
    const detail = /^HTTP \d+$/.test(error) ? error
        : error.startsWith('API returned an error') ? t('apiError')
            : error === 'Incomplete streaming response' ? t('incomplete')
                : /fetch|network|load failed/i.test(error) ? t('network') : t('error');
    return `${t('paused')}: ${detail}`;
}

export function countdownText(state, t, now = Date.now(), unavailable = false) {
    if (!state.enabled) return t('off');
    if (!state.request) return t('waiting');
    if (state.controller) return t('running');
    if (!state.nextAt || state.count >= 6) return t('paused');
    if (unavailable) return t('offline');
    const seconds = Math.ceil((state.nextAt - now) / 1000);
    if (seconds <= 0) return t('due');
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

export function cacheText(usage, t) {
    if (!usage) return t('untested');
    const parts = [];
    if (usage.readTokens !== null) parts.push(t(usage.readTokens > 0 ? 'hit' : 'miss', { count: usage.readTokens }));
    if (usage.writeTokens > 0) parts.push(t('written', { count: usage.writeTokens }));
    return parts.length ? parts.join(' · ') : t('unknown');
}

/** Use the installed folder and scope rather than assuming the repository name. */
export async function updateInstalledExtension(moduleUrl, fetcher, headers) {
    const match = new URL(moduleUrl).pathname.match(/\/scripts\/extensions\/third-party\/([^/]+)\/index\.js$/);
    if (!match) return 'builtin';
    const extensionName = decodeURIComponent(match[1]);
    const discovery = await fetcher('/api/extensions/discover', { headers, signal: AbortSignal.timeout(30000) });
    if (!discovery.ok) return discovery.status === 403 ? 'forbidden' : 'updateFailed';
    const extensions = await discovery.json();
    const extension = extensions.find(entry => entry.name === `third-party/${extensionName}`);
    if (!extension || !['local', 'global'].includes(extension.type)) return 'missing';
    const response = await fetcher('/api/extensions/update', {
        method: 'POST', headers, signal: AbortSignal.timeout(60000),
        body: JSON.stringify({ extensionName, global: extension.type === 'global' }),
    });
    if (!response.ok) return response.status === 403 ? 'forbidden' : 'updateFailed';
    const result = await response.json();
    if (typeof result.isUpToDate !== 'boolean') return 'updateFailed';
    return result.isUpToDate ? 'upToDate' : 'updated';
}
