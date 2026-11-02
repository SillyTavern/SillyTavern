import {
    attachFiles,
    connect,
    continueMessage,
    downloadBackup,
    exportCharacter,
    getChatCompletionPresetEditor,
    getConnectionCatalog,
    getLorebook,
    importCharacter,
    openChat,
    regenerate,
    removeCharacter,
    removeChat,
    removeLorebook,
    removeMessage,
    removePersona,
    saveCharacter,
    saveChatSettings,
    saveLorebook,
    savePersona,
    saveChatCompletionPresetAs,
    saveChatCompletionPresetDraft,
    selectPersona,
    selectChatCompletionPreset,
    sendMessage,
    setActiveModel,
    setAutoConnect,
    setFavoriteModels,
    setGlobalLorebooks,
    setMode,
    setSidebarCollapsed,
    startChat,
    stopGeneration,
    subscribe,
    swipeMessage,
    updateMessage,
} from './bridge-client.js';
import { getCurrentLocale, translate } from './i18n.js';

const root = document.getElementById('simple-ui-root');
const legacyButton = document.getElementById('simple-ui-enable-button');

const ui = {
    view: 'home',
    query: '',
    draft: '',
    modal: null,
    busy: false,
    error: '',
    notice: '',
    lore: null,
    connectionFamily: '',
    connectionProvider: '',
    confirm: null,
    expandedLoreEntries: new Set(),
    globalLoreDraft: [],
    presetEditor: null,
    settingsSection: '',
    favoriteSearch: '',
    scrollChatOnRender: false,
};

let snapshot = null;
let renderQueued = false;
let alertTimer = null;

const navItems = [
    ['chats', 'Chats', '◌'],
    ['characters', 'Characters', '♙'],
    ['lore', 'Lorebooks', '◇'],
    ['profiles', 'Profiles', '♡'],
    ['settings', 'Settings', '⚙'],
];

function t(text) {
    return translate(text);
}

function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '\u0027': '&#39;', '\u0022': '&quot;',
    })[character]);
}

export function formatSimpleMessage(value) {
    const text = String(value ?? '');
    const pattern = /(\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|"([^"\n]+)"|“([^”\n]+)”)/g;
    let html = '';
    let cursor = 0;
    for (const match of text.matchAll(pattern)) {
        html += `<span class="su-narration">${esc(text.slice(cursor, match.index))}</span>`;
        const action = match[2] ?? match[3];
        const dialogue = match[4] ?? match[5];
        if (action !== undefined) html += `<strong class="su-action-text">${esc(action)}</strong>`;
        else html += `<span class="su-dialogue-text">“${esc(dialogue)}”</span>`;
        cursor = match.index + match[0].length;
    }
    html += `<span class="su-narration">${esc(text.slice(cursor))}</span>`;
    return html.replace(/\n/g, '<br>');
}

function queueRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
        renderQueued = false;
        render();
    });
}

function clearAlertTimer() {
    if (alertTimer) clearTimeout(alertTimer);
    alertTimer = null;
}

function dismissAlerts() {
    clearAlertTimer();
    ui.error = '';
    ui.notice = '';
}

function showAlert(kind, message) {
    dismissAlerts();
    ui[kind] = message;
    alertTimer = setTimeout(() => {
        ui[kind] = '';
        alertTimer = null;
        queueRender();
    }, kind === 'error' ? 8000 : 4000);
}

function fitTextarea(textarea) {
    if (!(textarea instanceof HTMLTextAreaElement) || !textarea.isConnected || textarea.offsetParent === null) return;
    if (textarea.matches('#send_textarea, .edit_textarea, .reasoning_edit_textarea, [data-no-autogrow]')) return;
    const maximum = Math.max(160, Math.round(window.innerHeight * 0.6));
    textarea.style.height = 'auto';
    const desired = Math.min(textarea.scrollHeight, maximum);
    textarea.style.height = `${desired}px`;
    textarea.style.overflowY = textarea.scrollHeight > maximum ? 'auto' : 'hidden';
}

function fitTextareas(scope = document) {
    scope.querySelectorAll('textarea').forEach(fitTextarea);
}

document.addEventListener('input', event => fitTextarea(event.target));
document.addEventListener('toggle', event => {
    if (event.target.open) requestAnimationFrame(() => fitTextareas(event.target));
}, true);
document.addEventListener('click', () => {
    requestAnimationFrame(() => fitTextareas());
    setTimeout(() => fitTextareas(), 250);
});
window.addEventListener('resize', () => fitTextareas());

function avatar(url, name, className = '') {
    return `<img class="su-avatar ${className}" src="${esc(url || '/img/ai4.png')}" alt="${esc(name)}">`;
}

function statusBadge() {
    const connected = snapshot.connection.connected;
    return `<span class="su-status ${connected ? 'is-online' : ''}"><i></i>${connected ? t('Connected') : t('Not connected')}</span>`;
}

function shell(content) {
    const chatMode = ui.view === 'chat';
    return `<div class="su-shell ${snapshot.sidebarCollapsed ? 'sidebar-collapsed' : ''} ${chatMode ? 'chat-mode' : ''}">
        <aside class="su-sidebar">
            <button class="su-brand" data-view="home" aria-label="${t('Home')}"><span class="su-brand-mark">☾</span><span>EasierTavern<small>${t('YOUR STORIES')}</small></span></button>
            <div class="su-sidebar-utilities"><span class="su-sidebar-status ${snapshot.connection.connected ? 'is-online' : ''}" title="${snapshot.connection.connected ? t('Connected') : t('Not connected')}"><i></i><b>${snapshot.connection.connected ? t('Connected') : t('Not connected')}</b><button data-action="toggle-sidebar" aria-label="${t(snapshot.sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar')}" aria-expanded="${!snapshot.sidebarCollapsed}"><i class="fa-solid ${snapshot.sidebarCollapsed ? 'fa-angles-right' : 'fa-angles-left'}" aria-hidden="true"></i></button></span></div>
            <nav>${navItems.map(([id, label, icon]) => `<button data-view="${id}" class="${ui.view === id ? 'active' : ''}"><span>${icon}</span><b>${t(label)}</b>${id === 'chats' && snapshot.recentChats.length ? `<em>${snapshot.recentChats.length}</em>` : ''}</button>`).join('')}</nav>
            <blockquote>“${t('Some worlds belong only to you.')}”</blockquote>
        </aside>
        <main class="su-main">
            <section class="su-content">
                ${ui.error ? `<div class="su-alert error" role="alert">${esc(ui.error)}<button data-action="dismiss-error">×</button></div>` : ''}
                ${ui.notice ? `<div class="su-alert" role="status">${esc(ui.notice)}<button data-action="dismiss-alert">×</button></div>` : ''}
                ${content}
            </section>
        </main>
        ${modalView()}${confirmView()}
    </div>`;
}

function homeView() {
    const recent = snapshot.recentChats.slice(0, 3);
    const userName = snapshot.user?.name || snapshot.names.user || t('traveler');
    return `<div class="su-welcome"><div><span class="su-eyebrow">${t('WELCOME TO YOUR OWN WORLD')}</span><h1>${t('Your story continues here')}, <i>${esc(userName)}</i>.</h1><p>${t('Your characters, imagined worlds, and scenes still waiting to be written.')}</p></div><span>☾</span></div>
        <section class="su-hero"><div class="su-hero-art"><i></i><b>✦</b><b>✧</b></div><div><span class="su-pill">☾ ${t('YOUR STORY, YOUR RULES')}</span><h2>${t('Build a world.')}<br><i>${t('Get lost inside it.')}</i></h2><p>${t('Open a different door for every story.')}</p><button class="su-primary" data-action="new-story">＋ ${t('Start a new story')} ↗</button></div><small>EASIERTAVERN / 01</small></section>
        <div class="su-section-title"><h2>${t('Continue where you left off')}</h2><button data-view="chats">${t('All chats')} ↗</button></div>
        <div class="su-list">${recent.length ? recent.map(chatRow).join('') : emptyInline(t('Your first scene is waiting'), t('Choose a character and begin with one sentence.'), 'new-story')}</div>
        <div class="su-section-title"><h2>${t('Pieces of your universe')}</h2><span>${t('Every detail has a place.')}</span></div>
        <div class="su-quick-grid">
            ${quickCard('characters', '♙', t('Your characters'), t('Personalities, histories, and bonds'), snapshot.characters.length)}
            ${quickCard('lore', '◇', t('Your world\'s memory'), t('Rules, places, and important details'), snapshot.lorebooks.length)}
            ${quickCard('profiles', '♡', t('Your different selves'), t('A different profile for every story'), snapshot.personas.length)}
        </div>`;
}

function quickCard(view, icon, title, description, count) {
    return `<button class="su-quick-card" data-view="${view}"><span>${icon}</span><b>↗</b><h3>${title}</h3><p>${description}</p><small>${count} ${t('records')}</small></button>`;
}

function emptyInline(title, text, action) {
    return `<div class="su-empty-inline"><span>◌</span><div><h3>${title}</h3><p>${text}</p></div><button data-action="${action}" aria-label="${esc(title)}">＋</button></div>`;
}

function chatRow(item) {
    const character = snapshot.characters.find(entry => entry.avatar === item.avatar);
    return `<article class="su-row" data-avatar="${esc(item.avatar)}" data-file="${esc(item.file_name)}">
        <button class="su-row-open" data-action="open-chat" data-avatar="${esc(item.avatar)}" data-file="${esc(item.file_name)}">
            ${avatar(character?.avatarUrl, character?.name || '')}<span><h3>${esc(item.file_id || item.file_name)}</h3><p>${esc(item.mes || t('A new beginning is waiting.'))}</p><small>${esc(character?.name || '')}</small></span><b>›</b>
        </button><button class="su-delete-button" data-action="delete-chat" data-avatar="${esc(item.avatar)}" data-file="${esc(item.file_name)}" aria-label="${t('Delete chat')}" title="${t('Delete chat')}"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
    </article>`;
}

function chatsView() {
    if (ui.view === 'chat') return chatView();
    const query = ui.query.toLocaleLowerCase();
    const chats = snapshot.recentChats.filter(item => `${item.file_name} ${item.mes}`.toLocaleLowerCase().includes(query));
    return `<div class="su-page-head"><div><span class="su-eyebrow">${t('YOUR STORIES')}</span><h1>${t('Chats')}</h1></div><button class="su-primary" data-action="new-story">＋ ${t('New story')}</button></div>
        <p>${t('Different beginnings, separate stories. Each chat keeps its own memory.')}</p>
        ${searchBox(t('Search your chats…'))}
        <div class="su-list">${chats.length ? chats.map(chatRow).join('') : emptyInline(t('No chats found'), t('Start a new story with one of your characters.'), 'new-story')}</div>`;
}

function chatView() {
    const character = snapshot.selectedCharacter;
    const allModels = snapshot.connection.models || [];
    const favoriteIds = snapshot.favoriteModels?.[snapshot.connection.source] || [];
    const favoriteModels = allModels.filter(model => favoriteIds.includes(model.id));
    const activeModel = allModels.find(model => model.id === snapshot.connection.model)
        || (snapshot.connection.model ? { id: snapshot.connection.model, name: snapshot.connection.model } : null);
    const models = favoriteModels.length > 1 ? favoriteModels : activeModel ? [activeModel] : [];
    const affinity = snapshot.affinity || { level: 'Stranger', nextLevel: 'Acquaintance', progress: 0 };
    const currentModel = activeModel;
    return `<section class="su-chat-info" aria-label="${t('Chat information')}"><button class="su-chat-back" data-view="chats" aria-label="${t('Back to chats')}">←</button>${avatar(character?.avatarUrl, character?.name || '', 'su-chat-info-avatar')}<div class="su-chat-identity"><small>${t('Talking with')}</small><strong>${esc(character?.name || t('Chat'))}</strong></div>${statusBadge()}<div class="su-affinity"><div><span>${t('Affinity')}</span><strong>${t(affinity.level)}</strong></div><div class="su-affinity-track" role="progressbar" aria-label="${t('Affinity progress')}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(affinity.progress)}"><i style="width:${affinity.progress}%"></i></div>${affinity.nextLevel ? `<small>${t('Next')}: ${t(affinity.nextLevel)}</small>` : ''}</div>${models.length ? `<details class="su-model-menu"><summary>✦ <span>${esc(currentModel?.name || snapshot.connection.model || t('Model'))}</span>⌄</summary><div>${models.map(model => `<button type="button" data-action="select-model" data-model="${esc(model.id)}" class="${model.id === snapshot.connection.model ? 'selected' : ''}">${esc(model.name)}${model.id === snapshot.connection.model ? '<i class="fa-solid fa-check" aria-hidden="true"></i>' : ''}</button>`).join('')}</div></details>` : ''}</section>
        <div class="su-transcript">${snapshot.messages.length ? snapshot.messages.map((message, id) => messageView(message, id)).join('') : `<div class="su-empty"><span>✎</span><h2>${t('Begin with one sentence.')}</h2></div>`}</div>
        <form class="su-composer" data-form="message"><textarea name="message" rows="3" placeholder="${t('Write your message…')}" ${snapshot.generating ? 'disabled' : ''}>${esc(ui.draft)}</textarea><div><label class="su-attach">＋ ${t('Attach')}<input type="file" name="attachments" multiple hidden></label><button class="su-chat-settings-button" type="button" data-action="chat-settings" title="${t('Chat settings')}">⚙ ${t('Chat settings')}</button><span>${snapshot.generating ? t('Generating…') : snapshot.connection.connected ? t('Ready') : t('Connect an AI provider in Settings')}</span>${snapshot.generating ? `<button class="su-danger" type="button" data-action="stop">■ ${t('Stop')}</button>` : `<button class="su-primary" type="submit">➤ ${t('Send')}</button>`}</div></form>`;
}

function messageView(message, id) {
    if (!message || (!message.mes && message.is_system)) return '';
    const role = message.is_user ? 'user' : 'assistant';
    return `<article class="su-message ${role}" data-message-id="${id}"><header><b>${esc(message.name || (message.is_user ? snapshot.names.user : snapshot.names.character))}</b><span>${esc(message.send_date || '')}</span></header><div class="su-message-text">${formatSimpleMessage(message.mes || '')}</div><footer>
        ${!message.is_user ? `<button data-action="swipe-left" title="${t('Previous reply')}">‹</button><button data-action="swipe-right" title="${t('Next reply')}">›</button>` : ''}
        <button data-action="edit-message">✎ ${t('Edit')}</button><button class="su-delete-button" data-action="delete-message" aria-label="${t('Delete message')}" title="${t('Delete message')}"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
        ${id === snapshot.messages.length - 1 && !message.is_user ? `<button data-action="regenerate">↻ ${t('Regenerate')}</button><button data-action="continue">→ ${t('Continue')}</button>` : ''}
    </footer></article>`;
}

function charactersView() {
    const query = ui.query.toLocaleLowerCase();
    const items = snapshot.characters.filter(item => `${item.name} ${item.description}`.toLocaleLowerCase().includes(query));
    return `<div class="su-page-head"><div><span class="su-eyebrow">${t('SHAPE YOUR WORLD')}</span><h1>${t('Characters')}</h1></div><div class="su-head-actions"><label class="su-secondary">⇧ ${t('Import card')}<input id="su-character-import" type="file" accept=".png,.json,.charx" hidden></label><button class="su-primary" data-action="new-character">＋ ${t('New character')}</button></div></div>
        <p>${t('Keep your character\'s personality, history, and speaking style together.')}</p>${searchBox(t('Search characters…'))}
        <div class="su-card-grid">${items.map(item => `<article class="su-record">${avatar(item.avatarUrl, item.name)}<div><h3>${esc(item.name)}</h3><p>${esc(item.description || t('No description yet.'))}</p><div><button data-action="edit-character" data-id="${item.id}">${t('Edit')} ↗</button><button data-action="export-character" data-id="${item.id}">⇩ ${t('Export')}</button><button class="su-delete-button" data-action="delete-character" data-id="${item.id}" aria-label="${t('Delete character')}" title="${t('Delete character')}"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button></div></div></article>`).join('') || `<div class="su-empty"><h2>${t('Create your first character')}</h2><button class="su-secondary" data-action="new-character">＋ ${t('Create')}</button></div>`}</div>`;
}

function loreView() {
    const query = ui.query.toLocaleLowerCase();
    const books = snapshot.lorebooks.filter(book => `${book.name} ${book.file_id}`.toLocaleLowerCase().includes(query));
    const selectedGlobalBooks = snapshot.globalLorebookSummary || { count: 0, names: [] };
    const globalSummary = selectedGlobalBooks.count
        ? `${selectedGlobalBooks.names.slice(0, 3).join(', ')}${selectedGlobalBooks.count > 3 ? ` +${selectedGlobalBooks.count - 3}` : ''}`
        : t('No global lorebooks selected');
    return `<div class="su-page-head"><div><span class="su-eyebrow">${t('YOUR WORLD\'S MEMORY')}</span><h1>${t('Lorebooks')}</h1></div><button class="su-primary" data-action="new-lorebook">＋ ${t('New lorebook')}</button></div>
        <p>${t('Save places, rules, and facts that should remain true in your stories.')}</p>
        <button class="su-global-lore-summary" data-action="global-lorebooks"><span>◇</span><div><h2>${t('Lorebooks active in all chats')}</h2><p>${esc(globalSummary)}</p></div><em>${selectedGlobalBooks.count} ${t('selected')}</em><b>›</b></button>${searchBox(t('Search lorebooks…'))}
        <div class="su-card-grid su-lore-grid">${books.map(book => `<article class="su-lore-card"><span class="su-record-symbol">◇</span><h3 title="${esc(book.name)}">${esc(book.name)}</h3><button data-action="edit-lorebook" data-name="${esc(book.file_id)}">${t('Open')} ↗</button><button class="su-delete-button" data-action="delete-lorebook" data-name="${esc(book.file_id)}" aria-label="${t('Delete lorebook')}: ${esc(book.name)}" title="${t('Delete lorebook')}"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button></article>`).join('') || `<div class="su-empty"><h2>${t('No lorebooks yet')}</h2></div>`}</div>`;
}

function profilesView() {
    return `<div class="su-page-head"><div><span class="su-eyebrow">${t('YOUR DIFFERENT SELVES')}</span><h1>${t('Profiles')}</h1></div><button class="su-primary" data-action="new-persona">＋ ${t('New profile')}</button></div>
        <p>${t('Choose who you are in each story.')}</p>
        <div class="su-card-grid">${snapshot.personas.map(item => `<article class="su-record ${item.active ? 'selected' : ''}">${avatar(item.avatarUrl, item.name)}<div><h3>${esc(item.name)}</h3><p>${esc(item.description || t('No description yet.'))}</p><div>${item.active ? `<span class="su-pill">${t('Active')}</span>` : `<button data-action="select-persona" data-avatar="${esc(item.avatar)}">${t('Use profile')}</button>`}<button data-action="edit-persona" data-avatar="${esc(item.avatar)}">${t('Edit')}</button><button class="su-delete-button" data-action="delete-persona" data-avatar="${esc(item.avatar)}" aria-label="${t('Delete profile')}" title="${t('Delete profile')}"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button></div></div></article>`).join('') || `<div class="su-empty"><h2>${t('Create your first profile')}</h2></div>`}</div>`;
}

function settingsView() {
    const catalog = getConnectionCatalog();
    const family = ui.connectionFamily || snapshot.connection.family || catalog.families[0]?.id || '';
    const providers = family === 'openai' ? catalog.chatCompletion : family === 'textgenerationwebui' ? catalog.textCompletion : [];
    const provider = ui.connectionProvider || snapshot.connection.source || providers[0]?.id || '';
    const modelProvider = provider === 'makersuite' ? 'google' : provider;
    const models = family === 'textgenerationwebui'
        ? catalog.textModelsByProvider?.[provider] || []
        : catalog.modelsByProvider?.[modelProvider] || [];
    const selectedModel = provider === snapshot.connection.source ? snapshot.connection.model : '';
    const favoriteIds = new Set(snapshot.favoriteModels?.[provider] || []);
    const favoriteQuery = ui.favoriteSearch.toLocaleLowerCase();
    const visibleFavoriteModels = models.filter(model => `${model.name} ${model.id}`.toLocaleLowerCase().includes(favoriteQuery));
    const favoritePicker = models.length ? `<section class="su-favorite-models" data-favorite-provider="${esc(provider)}"><div><h3>${t('Favorite models')}</h3><p>${t('Choose the models that should appear in the chat model selector.')}</p><em>${favoriteIds.size} ${t('selected')}</em></div><label class="su-favorite-search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input data-favorite-search value="${esc(ui.favoriteSearch)}" placeholder="${t('Search models…')}"></label><div class="su-favorite-model-list">${visibleFavoriteModels.map(model => `<label class="${favoriteIds.has(model.id) ? 'selected' : ''}"><input type="checkbox" name="favoriteModels" value="${esc(model.id)}" ${favoriteIds.has(model.id) ? 'checked' : ''}><span><b>${esc(model.name)}</b><small>${esc(model.id)}</small></span><i class="fa-solid fa-check" aria-hidden="true"></i></label>`).join('') || `<p>${t('No models found')}</p>`}</div></section>` : '';
    const aiFeatures = snapshot.aiFeatures || { chatCompletion: false, presets: [], activePresetId: '' };
    const activePreset = aiFeatures.presets.find(item => item.id === aiFeatures.activePresetId);
    const connection = `<section class="su-setting"><span>✦</span><div><h3>${t('AI connection')}</h3><p>${snapshot.connection.connected ? `${t('Connected through')} ${esc(snapshot.connection.family)} · ${esc(snapshot.connection.source)}` : t('Choose a provider and connect your model.')}</p></div>${statusBadge()}</section>
        <form class="su-connection" data-form="connection"><div class="su-form-grid"><label>${t('Connection family')}<select name="family">${catalog.families.map(item => `<option value="${esc(item.id)}" ${item.id === family ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select></label>${providers.length ? `<label>${t('Provider')}<select name="provider">${providers.map(item => `<option value="${esc(item.id)}" ${item.id === provider ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select></label>` : ''}</div><label>${t('API key')}<span class="su-input-status"><input name="apiKey" type="password" autocomplete="off" placeholder="${t('Leave blank to keep the saved key')}">${catalog.keySavedByProvider?.[provider] || catalog.keySavedByFamily?.[family] ? `<small>✓ ${t('API key saved')}</small>` : ''}</span></label><label>${t('Server URL')}<input name="url" type="url" placeholder="${t('Optional or required for local/custom servers')}"></label>${models.length ? `<label>${t('Model')}<select name="model">${models.map(item => `<option value="${esc(item.id)}" ${item.id === selectedModel ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select></label>` : `<label>${t('Model')}<input name="model" value="${esc(selectedModel)}" placeholder="${t('Optional model ID')}"></label>`}${provider === 'custom' && models.length ? `<label>${t('Custom model ID')}<input name="customModel" placeholder="${esc(selectedModel || t('Use a model outside the list'))}"></label>` : ''}${favoritePicker}<label class="su-check-row"><input name="autoConnect" type="checkbox" ${snapshot.autoConnect ? 'checked' : ''}> <span>${t('Auto-connect to Last Server')}</span></label><button class="su-primary" ${ui.busy || snapshot.connection.connecting ? 'disabled' : ''}>${ui.busy || snapshot.connection.connecting ? t('Connecting…') : t('Save and connect')}</button>${snapshot.connection.error ? `<p class="su-hint su-error-text">${esc(snapshot.connection.error)}</p>` : ''}${snapshot.connection.preset ? `<p class="su-hint">${t('Active preset')}: <strong>${esc(snapshot.connection.preset)}</strong></p>` : ''}<p class="su-hint">${t('The same provider settings, secrets, presets, and connection logic are shared with advanced mode.')}</p></form>`;
    const ai = `<section class="su-ai-features"><div class="su-setting"><span>✧</span><div><h3>${t('AI features')}</h3><p>${aiFeatures.chatCompletion ? t('Manage the Chat Completion preset shared with advanced mode.') : t('Chat Completion presets are available when the connection family is Chat Completion.')}</p></div></div>${aiFeatures.chatCompletion ? `<div class="su-ai-features-body"><label>${t('Chat Completion preset')}<select name="chatCompletionPreset">${aiFeatures.presets.map(item => `<option value="${esc(item.id)}" ${item.id === aiFeatures.activePresetId ? 'selected' : ''}>${esc(item.name)}</option>`).join('')}</select></label><div class="su-preset-actions"><button class="su-secondary" type="button" data-action="edit-preset" ${!activePreset || activePreset.id === 'gui' || ui.busy ? 'disabled' : ''}>${t('Edit preset')}</button><form data-form="preset-save-as"><label>${t('New preset name')}<input name="presetName" required maxlength="100" placeholder="${t('Preset name')}"></label><button class="su-secondary" ${ui.busy ? 'disabled' : ''}>${t('Save as new')}</button></form></div></div>` : `<div class="su-ai-features-body disabled"><p>${t('Switch the connection family to Chat Completion to use these controls.')}</p></div>`}</section>`;
    const application = `<section class="su-setting"><span>文</span><div><h3>${t('Language')}</h3><p>${t('The interface follows your selected language.')}</p></div><select id="su-language"><option value="en" ${getCurrentLocale().startsWith('en') ? 'selected' : ''}>English</option><option value="tr-tr" ${getCurrentLocale() === 'tr-tr' ? 'selected' : ''}>Türkçe</option></select></section><section class="su-setting"><span>⇩</span><div><h3>${t('Download your data')}</h3><p>${t('Download a complete EasierTavern user backup.')}</p></div><button class="su-secondary" data-action="backup">${t('Download backup')}</button></section>`;
    const advanced = `<section class="su-setting advanced"><span>⚙</span><div><h3>${t('Advanced mode')}</h3><p>${t('Open every power-user control and extension panel.')}</p></div><button class="su-secondary" data-action="advanced">${t('Switch to advanced mode')}</button></section>`;
    const sections = { connection, ai, application, advanced };
    if (ui.settingsSection) {
        const titles = { connection: 'Connection', ai: 'AI and presets', application: 'Application and data', advanced: 'Advanced mode' };
        return `<div class="su-settings-head"><button class="su-settings-back" data-action="settings-home">← ${t('Back to settings')}</button><span class="su-eyebrow">${t('MAKE IT YOURS')}</span><h1>${t(titles[ui.settingsSection])}</h1></div>${sections[ui.settingsSection] || ''}`;
    }
    const cards = [
        ['connection', 'fa-plug', 'Connection', 'Manage providers, credentials, and models.'],
        ['ai', 'fa-wand-magic-sparkles', 'AI and presets', 'Choose and edit Chat Completion presets.'],
        ['application', 'fa-sliders', 'Application and data', 'Language and local data tools.'],
        ['advanced', 'fa-gears', 'Advanced mode', 'Open the full power-user interface.'],
    ];
    return `<span class="su-eyebrow">${t('MAKE IT YOURS')}</span><h1>${t('Settings')}</h1><p>${t('Choose the part you want to change.')}</p><div class="su-settings-grid">${cards.map(([id, icon, title, description]) => `<button class="su-settings-card" data-action="settings-section" data-section="${id}"><i class="fa-solid ${icon}" aria-hidden="true"></i><span><b>${t(title)}</b><small>${t(description)}</small></span><em>›</em></button>`).join('')}</div>`;
}

function searchBox(placeholder) {
    return `<label class="su-search">⌕<input id="su-search" value="${esc(ui.query)}" placeholder="${placeholder}"></label>`;
}

function modalView() {
    if (!ui.modal) return '';
    if (ui.modal.type === 'story') return storyModal();
    if (ui.modal.type === 'character') return characterModal();
    if (ui.modal.type === 'persona') return personaModal();
    if (ui.modal.type === 'lorebook') return loreModal();
    if (ui.modal.type === 'chat-settings') return chatSettingsModal();
    if (ui.modal.type === 'edit-message') return messageModal();
    if (ui.modal.type === 'global-lorebooks') return globalLorebooksModal();
    if (ui.modal.type === 'preset-editor') return presetEditorModal();
    return '';
}

function modal(title, content, wide = false) {
    return `<div class="su-overlay" data-modal-overlay><section class="su-modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h2>${title}</h2><button data-action="close-modal" aria-label="${t('Close')}">×</button></header>${content}</section></div>`;
}

function storyModal() {
    return modal(t('Start a new story'), `<p>${t('Choose the character who will meet you in this story.')}</p><div class="su-character-picker">${snapshot.characters.map(item => `<button data-action="start-story" data-id="${item.id}">${avatar(item.avatarUrl, item.name)}<span><b>${esc(item.name)}</b><small>${esc(item.description)}</small></span>›</button>`).join('') || `<p>${t('Create a character first.')}</p>`}</div>`);
}

function globalLorebooksModal() {
    const selected = new Set(ui.globalLoreDraft || []);
    return modal(t('Lorebooks active in all chats'), `<form data-form="global-lorebooks"><p>${t('Choose the lorebooks that should be included in every conversation.')}</p><label class="su-search su-modal-search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input data-global-lore-search placeholder="${t('Search lorebooks…')}"></label><div class="su-lore-choice-list su-global-lore-options">${snapshot.lorebooks.map(book => `<label class="su-lore-choice ${selected.has(book.file_id) ? 'selected' : ''}" data-search-value="${esc(`${book.name} ${book.file_id}`.toLocaleLowerCase())}"><input type="checkbox" name="globalLorebooks" value="${esc(book.file_id)}" ${selected.has(book.file_id) ? 'checked' : ''}><span><b>${esc(book.name)}</b><small>${t('All chats')}</small></span><i class="fa-solid fa-check" aria-hidden="true"></i></label>`).join('') || `<p>${t('No lorebooks yet')}</p>`}</div><div class="su-modal-actions"><button class="su-secondary" type="button" data-action="cancel-modal">${t('Cancel')}</button><button class="su-primary" ${ui.busy ? 'disabled' : ''}>${t('Apply')}</button></div></form>`, true);
}

function presetEditorField(field) {
    const common = `data-preset-key="${esc(field.key)}" data-value-type="${esc(field.type)}"`;
    if (field.type === 'boolean') {
        return `<label class="su-check-row su-preset-field"><input type="checkbox" ${common} ${field.value ? 'checked' : ''}><span>${esc(field.label)}</span></label>`;
    }
    if (field.options?.length) {
        return `<label class="su-preset-field">${esc(field.label)}<select ${common}>${field.options.map(option => `<option value="${esc(option.id)}" ${String(option.id) === String(field.value) ? 'selected' : ''}>${esc(option.name)}</option>`).join('')}</select></label>`;
    }
    if (field.type === 'number') {
        return `<label class="su-preset-field">${esc(field.label)}<input type="number" step="any" ${common} value="${esc(field.value)}"></label>`;
    }
    if (field.type === 'array' || field.type === 'object') {
        return `<label class="su-preset-field su-preset-json">${esc(field.label)}<textarea rows="7" ${common}>${esc(JSON.stringify(field.value, null, 2))}</textarea></label>`;
    }
    const multiline = String(field.value ?? '').length > 80 || /prompt|format|prefill|send_if_empty/.test(field.key);
    return `<label class="su-preset-field">${esc(field.label)}${multiline ? `<textarea rows="4" ${common}>${esc(field.value)}</textarea>` : `<input ${common} value="${esc(field.value)}">`}</label>`;
}

function presetEditorModal() {
    const editor = ui.presetEditor;
    if (!editor) return '';
    const categoryOrder = ['Sampling', 'Context and response', 'Prompts and formatting', 'Reasoning and tools', 'Streaming and media'];
    const sections = categoryOrder.map(category => {
        const fields = editor.fields.filter(field => field.category === category);
        if (category === 'Prompts and formatting') {
            const contentPrompts = editor.prompts.filter(prompt => !prompt.marker && Object.hasOwn(prompt, 'content'));
            const promptAreas = contentPrompts.map(prompt => `<label class="su-preset-field su-prompt-content">${esc(prompt.name || prompt.identifier)}<small>${esc(prompt.identifier)}</small><textarea rows="5" data-prompt-content="${esc(prompt.identifier)}">${esc(prompt.content || '')}</textarea></label>`).join('');
            const orderRows = editor.promptOrder.map((entry, index) => {
                const prompt = editor.prompts.find(item => item.identifier === entry.identifier) || {};
                return `<li data-prompt-order="${esc(entry.identifier)}"><label><input type="checkbox" data-prompt-enabled="${esc(entry.identifier)}" ${entry.enabled ? 'checked' : ''}><span>${esc(prompt.name || entry.identifier)}</span></label><small>${prompt.marker ? t('Marker') : esc(entry.identifier)}</small><div><button type="button" data-action="prompt-up" data-identifier="${esc(entry.identifier)}" aria-label="${t('Move up')}" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-action="prompt-down" data-identifier="${esc(entry.identifier)}" aria-label="${t('Move down')}" ${index === editor.promptOrder.length - 1 ? 'disabled' : ''}>↓</button></div></li>`;
            }).join('');
            const count = fields.length + contentPrompts.length;
            return `<details class="su-preset-section" open data-preset-category="prompts"><summary>${t(category)} <small>${count}</small></summary><div class="su-prompt-editor"><section><h3>${t('Prompt contents')}</h3><p>${t('Edit each prompt without changing its identity or role.')}</p>${promptAreas || `<p>${t('No editable prompts')}</p>`}</section>${fields.length ? `<section class="su-prompt-formats"><h3>${t('Formatting')}</h3>${fields.map(presetEditorField).join('')}</section>` : ''}<section class="su-prompt-order"><h3>${t('Prompt order and activity')}</h3><p>${t('Markers can be enabled and reordered here.')}</p><ol>${orderRows}</ol></section></div></details>`;
        }
        if (!fields.length) return '';
        return `<details class="su-preset-section" ${category === 'Sampling' ? 'open' : ''} data-preset-category="${esc(category)}"><summary>${t(category)} <small>${fields.length}</small></summary><div>${fields.map(presetEditorField).join('')}</div></details>`;
    }).join('');
    return modal(`${t('Edit preset')}: ${esc(editor.name)}`, `<form data-form="preset-editor"><p>${t('Changes remain a draft until you save this preset.')}</p>${sections}<div class="su-modal-actions"><button class="su-secondary" type="button" data-action="cancel-modal">${t('Cancel')}</button><button class="su-primary" ${ui.busy ? 'disabled' : ''}>${t('Save preset')}</button></div></form>`, true);
}

function characterModal() {
    const item = ui.modal.id === null ? {} : snapshot.characters.find(character => character.id === ui.modal.id) || {};
    const loreOptions = snapshot.lorebooks.map(book => `<option value="${esc(book.file_id)}" ${book.file_id === item.primaryLorebook ? 'selected' : ''}>${esc(book.name)}</option>`).join('');
    const selectedExtraLorebooks = (item.extraLorebooks || []).filter(name => name !== item.primaryLorebook);
    const extraLoreChoices = snapshot.lorebooks.map(book => `<label class="su-lore-choice ${book.file_id === item.primaryLorebook ? 'is-hidden' : ''} ${selectedExtraLorebooks.includes(book.file_id) ? 'selected' : ''}" data-lorebook="${esc(book.file_id)}"><input type="checkbox" name="extraLorebooks" value="${esc(book.file_id)}" ${selectedExtraLorebooks.includes(book.file_id) ? 'checked' : ''}><span><b>${esc(book.name)}</b><small>${t('Additional lorebook')}</small></span><i class="fa-solid fa-check" aria-hidden="true"></i></label>`).join('');
    return modal(item.id === undefined ? t('New character') : t('Edit character'), `<form data-form="character"><input type="hidden" name="id" value="${item.id ?? ''}"><div class="su-form-grid"><label>${t('Name')}<input name="name" required maxlength="100" value="${esc(item.name)}"></label><label class="su-avatar-upload">${t('Avatar')}<span class="su-avatar-control"><img data-avatar-preview src="${esc(item.avatarUrl || '/img/ai4.png')}" alt=""><span><b>${t(item.avatarUrl ? 'Change image' : 'Choose image')}</b><small>PNG, JPG, WEBP</small></span><input name="avatar" type="file" accept="image/*" aria-label="${t('Avatar')}"></span></label></div><label>${t('Description')}<textarea name="description" rows="5">${esc(item.description)}</textarea></label><label>${t('First message')}<textarea name="firstMessage" rows="5">${esc(item.firstMessage)}</textarea></label><details><summary>${t('Character definition')}</summary><label>${t('Personality')}<textarea name="personality" rows="4">${esc(item.personality)}</textarea></label><label>${t('Scenario')}<textarea name="scenario" rows="4">${esc(item.scenario)}</textarea></label><label>${t('Example dialogue')}<textarea name="exampleMessages" rows="6">${esc(item.exampleMessages)}</textarea></label><label>${t('Alternate greetings')}<textarea name="alternateGreetings" rows="7" placeholder="${t('Separate greetings with a line containing only ---')}">${esc((item.alternateGreetings || []).join('\n---\n'))}</textarea></label><label>${t('Tags')}<input name="tags" value="${esc((item.tags || []).join(', '))}"></label></details><details><summary>${t('Lorebook connections')}</summary><label>${t('Primary lorebook')}<select name="primaryLorebook"><option value="">${t('None')}</option>${loreOptions}</select></label><div class="su-extra-lore-head"><span>${t('Additional lorebooks')}</span><small data-extra-lore-count>${selectedExtraLorebooks.length} ${t('selected')}</small></div><div class="su-lore-choice-list">${extraLoreChoices || `<p>${t('No lorebooks yet')}</p>`}</div></details><details><summary>${t('Advanced prompts')}</summary><label>${t('System prompt')}<textarea name="systemPrompt" rows="4">${esc(item.systemPrompt)}</textarea></label><label>${t('Post-history instructions')}<textarea name="postHistoryInstructions" rows="4">${esc(item.postHistoryInstructions)}</textarea></label><label>${t('Depth prompt')}<textarea name="depthPrompt" rows="4">${esc(item.depthPrompt)}</textarea></label><div class="su-form-grid"><label>${t('Depth')}<input name="depthPromptDepth" type="number" min="0" max="9999" value="${esc(item.depthPromptDepth ?? 4)}"></label><label>${t('Role')}<select name="depthPromptRole">${roleOptions(item.depthPromptRole || 'system', true)}</select></label></div></details><button class="su-primary" ${ui.busy ? 'disabled' : ''}>${ui.busy ? t('Saving…') : t('Save')}</button></form>`, true);
}

function personaModal() {
    const item = snapshot.personas.find(persona => persona.avatar === ui.modal.avatar) || {};
    const position = Number(item.position ?? 0);
    return modal(item.avatar ? t('Edit profile') : t('New profile'), `<form data-form="persona"><input type="hidden" name="avatar" value="${esc(item.avatar)}"><div class="su-form-grid"><label>${t('Name')}<input name="name" required maxlength="100" value="${esc(item.name)}"></label><label class="su-avatar-upload">${t('Avatar')}<span class="su-avatar-control"><img data-avatar-preview src="${esc(item.avatarUrl || '/img/user-default.png')}" alt=""><span><b>${t(item.avatar ? 'Change image' : 'Choose image')}</b><small>PNG, JPG, WEBP</small></span><input name="image" type="file" accept="image/*" aria-label="${t('Avatar')}"></span></label></div><label>${t('Title')}<input name="title" maxlength="100" value="${esc(item.title)}"></label><label>${t('Description')}<textarea name="description" rows="7">${esc(item.description)}</textarea></label><label>${t('Prompt position')}<select name="position"><option value="9" ${position === 9 ? 'selected' : ''}>${t('None (disabled)')}</option><option value="0" ${position === 0 ? 'selected' : ''}>${t('In Story String / Prompt Manager')}</option><option value="2" ${position === 2 ? 'selected' : ''}>${t("Top of Author's Note")}</option><option value="3" ${position === 3 ? 'selected' : ''}>${t("Bottom of Author's Note")}</option><option value="4" ${position === 4 ? 'selected' : ''}>${t('In-chat @ Depth')}</option></select></label><div class="su-form-grid su-persona-depth ${position === 4 ? '' : 'is-hidden'}"><label>${t('Depth')}<input name="depth" type="number" min="0" max="9999" value="${esc(item.depth ?? 2)}"></label><label>${t('Role')}<select name="role">${roleOptions(item.role ?? 0)}</select></label></div><label>${t('Linked lorebook')}<select name="lorebook"><option value="">${t('None')}</option>${snapshot.lorebooks.map(book => `<option value="${esc(book.file_id)}" ${book.file_id === item.lorebook ? 'selected' : ''}>${esc(book.name)}</option>`).join('')}</select></label><button class="su-primary" ${ui.busy ? 'disabled' : ''}>${ui.busy ? t('Saving…') : t('Save')}</button></form>`);
}

function roleOptions(selected, names = false) {
    const options = names ? [['system', 'System'], ['user', 'User'], ['assistant', 'Assistant']] : [[0, 'System'], [1, 'User'], [2, 'Assistant']];
    return options.map(([value, label]) => `<option value="${value}" ${String(value) === String(selected) ? 'selected' : ''}>${t(label)}</option>`).join('');
}

function chatSettingsModal() {
    const settings = snapshot.chatSettings || {};
    const position = Number(settings.authorNotePosition ?? 1);
    return modal(t('Chat settings'), `<form data-form="chat-settings"><p>${t('These values apply only to the active chat.')}</p><section class="su-chat-settings-section"><h3>◇ ${t('Chat lorebook')}</h3><label>${t('Linked lorebook')}<select name="lorebook"><option value="">${t('None')}</option>${snapshot.lorebooks.map(book => `<option value="${esc(book.file_id)}" ${book.file_id === settings.lorebook ? 'selected' : ''}>${esc(book.name)}</option>`).join('')}</select></label></section><section class="su-chat-settings-section"><h3>✎ ${t("Author's Note")}</h3><label>${t("Author's Note")}<textarea name="authorNote" rows="7">${esc(settings.authorNote)}</textarea></label><div class="su-form-grid"><label>${t('Position')}<select name="authorNotePosition"><option value="2" ${position === 2 ? 'selected' : ''}>${t('Before Main Prompt / Story String')}</option><option value="0" ${position === 0 ? 'selected' : ''}>${t('After Main Prompt / Story String')}</option><option value="1" ${position === 1 ? 'selected' : ''}>${t('In-chat @ Depth')}</option></select></label><label>${t('Insertion frequency')}<input name="authorNoteInterval" type="number" min="0" max="9999" value="${esc(settings.authorNoteInterval ?? 1)}"><small>${t('0 disables, 1 always includes')}</small></label></div><div class="su-form-grid su-author-note-depth ${position === 1 ? '' : 'is-hidden'}"><label>${t('Depth')}<input name="authorNoteDepth" type="number" min="0" max="9999" value="${esc(settings.authorNoteDepth ?? 4)}"></label><label>${t('Role')}<select name="authorNoteRole">${roleOptions(settings.authorNoteRole ?? 0)}</select></label></div></section><section class="su-chat-settings-section"><h3>⚙ ${t('Chat prompt overrides')}</h3><p>${t('Leave an override blank to use the character card value.')}</p><label>${t('Scenario')}<textarea name="scenario" rows="5">${esc(settings.scenario)}</textarea></label><label>${t('Example dialogue')}<textarea name="exampleMessages" rows="6">${esc(settings.exampleMessages)}</textarea></label><label>${t('System prompt')}<textarea name="systemPrompt" rows="5">${esc(settings.systemPrompt)}</textarea></label></section><button class="su-primary" ${ui.busy ? 'disabled' : ''}>${ui.busy ? t('Saving…') : t('Save chat settings')}</button></form>`, true);
}

function loreModal() {
    const name = ui.modal.name || '';
    const entries = Object.values(ui.lore?.entries || {});
    return modal(name ? `${t('Lorebook')}: ${esc(name)}` : t('New lorebook'), `<form data-form="lorebook"><label>${t('Lorebook name')}<input name="name" required maxlength="100" value="${esc(name)}" ${name ? 'readonly' : ''}></label><div class="su-lore-entries">${entries.map(loreEntry).join('')}</div><button class="su-secondary" type="button" data-action="add-lore-entry">＋ ${t('Add entry')}</button><button class="su-primary" ${ui.busy ? 'disabled' : ''}>${ui.busy ? t('Saving…') : t('Save lorebook')}</button></form>`, true);
}

function loreEntry(entry) {
    const activation = entry.constant ? t('Always active') : (entry.key || []).join(', ') || t('No trigger keywords');
    return `<details class="su-lore-entry" data-uid="${entry.uid}" ${ui.expandedLoreEntries.has(Number(entry.uid)) ? 'open' : ''}><summary><span>${esc(entry.comment || t('Lore entry'))}${entry.disable ? `<em>${t('Disabled')}</em>` : ''}</span><small>${esc(activation)}</small></summary><div class="su-lore-entry-content"><button class="su-delete-button" type="button" data-action="delete-lore-entry" data-uid="${entry.uid}" aria-label="${t('Delete lore entry')}" title="${t('Delete lore entry')}"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button><label>${t('Title')}<input data-field="comment" value="${esc(entry.comment)}"></label><label>${t('Content')}<textarea data-field="content" rows="5">${esc(entry.content)}</textarea></label><label>${t('Trigger keywords')}<input data-field="key" value="${esc((entry.key || []).join(', '))}" placeholder="city, castle, name"></label><div class="su-lore-toggles"><label class="su-toggle"><input type="checkbox" data-field="constant" ${entry.constant ? 'checked' : ''}><span></span>${t('Always active')}</label><label class="su-toggle"><input type="checkbox" data-field="disable" ${entry.disable ? 'checked' : ''}><span></span>${t('Disabled')}</label></div></div></details>`;
}

function updateLoreSummary(element, entry) {
    const title = element.querySelector('summary > span');
    const activation = element.querySelector('summary > small');
    if (title) {
        title.textContent = entry.comment || t('Lore entry');
        if (entry.disable) title.insertAdjacentHTML('beforeend', `<em>${esc(t('Disabled'))}</em>`);
    }
    if (activation) activation.textContent = entry.constant ? t('Always active') : (entry.key || []).join(', ') || t('No trigger keywords');
}

function confirmView() {
    if (!ui.confirm) return '';
    const checkbox = ui.confirm.optionLabel ? `<label class="su-confirm-option"><input type="checkbox" name="confirmOption"> ${ui.confirm.optionLabel}</label>` : '';
    return `<div class="su-overlay su-confirm-overlay"><section class="su-modal su-confirm" role="alertdialog" aria-modal="true" aria-labelledby="su-confirm-title" aria-describedby="su-confirm-message"><span class="su-confirm-icon">!</span><h2 id="su-confirm-title">${esc(ui.confirm.title)}</h2><p id="su-confirm-message">${esc(ui.confirm.message)}</p>${ui.error ? `<div class="su-alert error" role="alert">${esc(ui.error)}</div>` : ''}${checkbox}<div class="su-confirm-actions"><button class="su-secondary" data-action="cancel-delete" ${ui.busy ? 'disabled' : ''}>${t('Cancel')}</button><button class="su-danger" data-action="confirm-delete" ${ui.busy ? 'disabled' : ''}>${ui.busy ? t('Deleting…') : t('Delete')}</button></div></section></div>`;
}

function askDelete(kind, payload, title, message, optionLabel = '') {
    dismissAlerts();
    ui.confirm = { kind, payload, title, message, optionLabel };
    queueRender();
}

function messageModal() {
    const message = snapshot.messages[ui.modal.id];
    return modal(t('Edit message'), `<form data-form="edit-message"><input type="hidden" name="id" value="${ui.modal.id}"><label>${t('Message')}<textarea name="text" rows="10">${esc(message?.mes)}</textarea></label><button class="su-primary">${t('Save')}</button></form>`);
}

function updateChatSurfaceState() {
    const header = root?.querySelector('.su-chat-info');
    if (!header) return;
    const rootTop = root.getBoundingClientRect().top;
    header.classList.toggle('is-stuck', root.scrollTop > 0 && header.getBoundingClientRect().top <= rootTop + 1);
}

root?.addEventListener('scroll', updateChatSurfaceState, { passive: true });

function render() {
    if (!root || !snapshot) return;
    if (!snapshot.ready) return;
    if (snapshot.mode === 'advanced') {
        root.setAttribute('aria-hidden', 'true');
        return;
    }
    document.body.classList.add('simple-ui-active');
    document.body.classList.remove('simple-ui-advanced');
    root.removeAttribute('aria-hidden');
    root.classList.toggle('is-chat-view', ui.view === 'chat');

    const modalScrollTop = root.querySelector('.su-modal')?.scrollTop || 0;
    let content = homeView();
    if (ui.view === 'chats' || ui.view === 'chat') content = chatsView();
    else if (ui.view === 'characters') content = charactersView();
    else if (ui.view === 'lore') content = loreView();
    else if (ui.view === 'profiles') content = profilesView();
    else if (ui.view === 'settings') content = settingsView();
    root.innerHTML = shell(content);
    fitTextareas(root);
    const openModal = root.querySelector('.su-modal');
    if (openModal && modalScrollTop) openModal.scrollTop = modalScrollTop;
    if (ui.confirm) root.querySelector('.su-confirm [data-action="cancel-delete"]')?.focus();
    const textarea = root.querySelector('.su-composer textarea');
    if (textarea && document.activeElement?.classList?.contains('su-composer')) textarea.focus();
    requestAnimationFrame(() => {
        if (ui.scrollChatOnRender && ui.view === 'chat') {
            root.scrollTop = root.scrollHeight;
            ui.scrollChatOnRender = false;
        }
        updateChatSurfaceState();
    });
}

async function run(action, successMessage = '') {
    ui.busy = true;
    dismissAlerts();
    queueRender();
    try {
        await action();
        if (successMessage) showAlert('notice', successMessage);
    } catch (error) {
        console.error('[Simple UI]', error);
        showAlert('error', t(error?.message || 'Something went wrong.'));
    } finally {
        ui.busy = false;
        queueRender();
    }
}

root?.addEventListener('click', async event => {
    if (event.target.matches('[data-modal-overlay]')) {
        ui.modal = null;
        ui.presetEditor = null;
        ui.globalLoreDraft = [];
        queueRender();
        return;
    }
    const target = event.target.closest('button, [data-action], [data-view]');
    if (!target) return;
    const view = target.dataset.view;
    if (view) {
        ui.view = view;
        if (view === 'settings') ui.settingsSection = '';
        ui.query = '';
        ui.modal = null;
        queueRender();
        return;
    }
    const action = target.dataset.action;
    if (!action) return;
    if (action === 'cancel-delete') ui.confirm = null;
    else if (action === 'toggle-sidebar') setSidebarCollapsed(!snapshot.sidebarCollapsed);
    else if (action === 'confirm-delete') {
        const request = ui.confirm;
        const option = Boolean(root.querySelector('.su-confirm input[name="confirmOption"]')?.checked);
        if (!request) return;
        await run(async () => {
            if (request.kind === 'message') await removeMessage(request.payload.id);
            else if (request.kind === 'persona') await removePersona(request.payload.avatar);
            else if (request.kind === 'lorebook') await removeLorebook(request.payload.name);
            else if (request.kind === 'lore-entry') {
                delete ui.lore.entries[request.payload.uid];
                ui.expandedLoreEntries.delete(Number(request.payload.uid));
            } else if (request.kind === 'character') await removeCharacter(request.payload.id, option);
            else if (request.kind === 'chat') await removeChat(request.payload);
            ui.confirm = null;
        }, t('Deleted'));
    } else if (action === 'close-modal' || action === 'cancel-modal') {
        ui.modal = null;
        ui.presetEditor = null;
        ui.globalLoreDraft = [];
    }
    else if (action === 'dismiss-error' || action === 'dismiss-alert') dismissAlerts();
    else if (action === 'new-story') ui.modal = { type: 'story' };
    else if (action === 'start-story') await run(async () => { await startChat(Number(target.dataset.id)); ui.modal = null; ui.view = 'chat'; ui.scrollChatOnRender = true; });
    else if (action === 'open-chat') await run(async () => { await openChat({ avatar: target.dataset.avatar, file_name: target.dataset.file }); ui.view = 'chat'; ui.scrollChatOnRender = true; });
    else if (action === 'stop') stopGeneration();
    else if (action === 'select-model') await run(() => setActiveModel(target.dataset.model), t('Model changed'));
    else if (action === 'regenerate') await run(regenerate);
    else if (action === 'continue') await run(continueMessage);
    else if (action === 'swipe-left') await run(() => swipeMessage('left'));
    else if (action === 'swipe-right') await run(() => swipeMessage('right'));
    else if (action === 'edit-message') ui.modal = { type: 'edit-message', id: Number(target.closest('[data-message-id]').dataset.messageId) };
    else if (action === 'delete-message') askDelete('message', { id: Number(target.closest('[data-message-id]').dataset.messageId) }, t('Delete message'), t('Delete this message?'));
    else if (action === 'new-character') ui.modal = { type: 'character', id: null };
    else if (action === 'edit-character') ui.modal = { type: 'character', id: Number(target.dataset.id) };
    else if (action === 'export-character') await run(() => exportCharacter(Number(target.dataset.id)));
    else if (action === 'delete-character') askDelete('character', { id: Number(target.dataset.id) }, t('Delete character'), t('This character will be permanently deleted.'), t('Also delete associated chats'));
    else if (action === 'delete-chat') askDelete('chat', { avatar: target.dataset.avatar, file_name: target.dataset.file }, t('Delete chat'), t('This chat will be permanently deleted.'));
    else if (action === 'chat-settings') ui.modal = { type: 'chat-settings' };
    else if (action === 'new-persona') ui.modal = { type: 'persona', avatar: null };
    else if (action === 'edit-persona') ui.modal = { type: 'persona', avatar: target.dataset.avatar };
    else if (action === 'select-persona') await run(() => selectPersona(target.dataset.avatar), t('Profile selected'));
    else if (action === 'delete-persona') askDelete('persona', { avatar: target.dataset.avatar }, t('Delete profile'), t('Delete this profile?'));
    else if (action === 'new-lorebook') {
        ui.lore = { entries: {} };
        ui.modal = { type: 'lorebook', name: '' };
        ui.expandedLoreEntries.clear();
    } else if (action === 'edit-lorebook') await run(async () => { ui.lore = await getLorebook(target.dataset.name); ui.modal = { type: 'lorebook', name: target.dataset.name }; ui.expandedLoreEntries.clear(); });
    else if (action === 'delete-lorebook') askDelete('lorebook', { name: target.dataset.name }, t('Delete lorebook'), t('Delete this lorebook?'));
    else if (action === 'add-lore-entry') {
        const ids = Object.keys(ui.lore.entries || {}).map(Number).filter(Number.isFinite);
        const uid = ids.length ? Math.max(...ids) + 1 : 0;
        ui.lore.entries[uid] = { uid, key: [], keysecondary: [], comment: '', content: '', constant: false, selective: true, order: 100, position: 0, disable: false, probability: 100, useProbability: true, depth: 4 };
        ui.expandedLoreEntries.add(uid);
    } else if (action === 'delete-lore-entry') askDelete('lore-entry', { uid: target.dataset.uid }, t('Delete lore entry'), t('This lore entry will be permanently deleted.'));
    else if (action === 'global-lorebooks') {
        ui.globalLoreDraft = [...(snapshot.globalLorebooks || [])];
        ui.modal = { type: 'global-lorebooks' };
    }
    else if (action === 'backup') await run(downloadBackup);
    else if (action === 'settings-section') ui.settingsSection = target.dataset.section || '';
    else if (action === 'settings-home') ui.settingsSection = '';
    else if (action === 'prompt-up' || action === 'prompt-down') {
        const index = ui.presetEditor?.promptOrder.findIndex(entry => entry.identifier === target.dataset.identifier) ?? -1;
        const nextIndex = action === 'prompt-up' ? index - 1 : index + 1;
        if (index >= 0 && nextIndex >= 0 && nextIndex < ui.presetEditor.promptOrder.length) {
            [ui.presetEditor.promptOrder[index], ui.presetEditor.promptOrder[nextIndex]] = [ui.presetEditor.promptOrder[nextIndex], ui.presetEditor.promptOrder[index]];
        }
    }
    else if (action === 'edit-preset') await run(async () => {
        ui.presetEditor = getChatCompletionPresetEditor();
        ui.modal = { type: 'preset-editor' };
    });
    else if (action === 'advanced') setMode('advanced');
    queueRender();
});

root?.addEventListener('input', event => {
    if (event.target.id === 'su-search') {
        ui.query = event.target.value;
        queueRender();
    } else if (event.target.matches('[data-favorite-search]')) {
        ui.favoriteSearch = event.target.value;
        queueRender();
    } else if (event.target.closest('.su-composer') && event.target.name === 'message') {
        ui.draft = event.target.value;
    } else if (event.target.matches('[data-global-lore-search]')) {
        const query = event.target.value.toLocaleLowerCase();
        for (const choice of event.target.form.querySelectorAll('[data-search-value]')) {
            choice.classList.toggle('is-hidden', !choice.dataset.searchValue.includes(query));
        }
    } else if (event.target.matches('[data-prompt-content]')) {
        const prompt = ui.presetEditor?.prompts.find(item => item.identifier === event.target.dataset.promptContent);
        if (prompt) prompt.content = event.target.value;
    } else if (event.target.matches('form[data-form="lorebook"] input[name="name"]')) {
        ui.modal.name = event.target.value;
    } else if (event.target.matches('.su-lore-entry [data-field]')) {
        const fieldset = event.target.closest('.su-lore-entry');
        const entry = ui.lore?.entries?.[fieldset?.dataset.uid];
        if (!entry) return;
        const field = event.target.dataset.field;
        entry[field] = field === 'key'
            ? event.target.value.split(',').map(value => value.trim()).filter(Boolean)
            : event.target.value;
        updateLoreSummary(fieldset, entry);
    }
});

root?.addEventListener('change', async event => {
    if (event.target.id === 'su-character-import' && event.target.files?.[0]) await run(() => importCharacter(event.target.files[0]));
    else if (event.target.matches('.su-modal input[type="file"]') && event.target.files?.[0]) {
        const preview = event.target.closest('.su-avatar-control')?.querySelector('[data-avatar-preview]');
        if (preview) preview.src = URL.createObjectURL(event.target.files[0]);
    } else if (event.target.matches('.su-lore-entry input[type="checkbox"][data-field]')) {
        const fieldset = event.target.closest('.su-lore-entry');
        const entry = ui.lore?.entries?.[fieldset?.dataset.uid];
        if (entry) {
            entry[event.target.dataset.field] = event.target.checked;
            updateLoreSummary(fieldset, entry);
        }
    }
    else if (event.target.id === 'su-language') {
        localStorage.setItem('language', event.target.value);
        location.reload();
    } else if (event.target.name === 'family') {
        ui.connectionFamily = event.target.value;
        ui.connectionProvider = '';
        ui.favoriteSearch = '';
        queueRender();
    } else if (event.target.name === 'provider') {
        ui.connectionProvider = event.target.value;
        ui.favoriteSearch = '';
        queueRender();
    } else if (event.target.name === 'activeModel') {
        await run(() => setActiveModel(event.target.value), t('Model changed'));
    } else if (event.target.name === 'chatCompletionPreset') {
        await run(() => selectChatCompletionPreset(event.target.value), t('Preset selected'));
    } else if (event.target.name === 'globalLorebooks') {
        event.target.closest('.su-lore-choice')?.classList.toggle('selected', event.target.checked);
        ui.globalLoreDraft = Array.from(event.target.form.querySelectorAll('input[name="globalLorebooks"]:checked'), input => input.value);
    } else if (event.target.name === 'favoriteModels') {
        const section = event.target.closest('[data-favorite-provider]');
        const favorites = new Set(snapshot.favoriteModels?.[section?.dataset.favoriteProvider] || []);
        if (event.target.checked) favorites.add(event.target.value);
        else favorites.delete(event.target.value);
        event.target.closest('label')?.classList.toggle('selected', event.target.checked);
        setFavoriteModels(section?.dataset.favoriteProvider, [...favorites]);
    } else if (event.target.matches('[data-prompt-enabled]')) {
        const entry = ui.presetEditor?.promptOrder.find(item => item.identifier === event.target.dataset.promptEnabled);
        if (entry) entry.enabled = event.target.checked;
    } else if (event.target.matches('form[data-form="persona"] select[name="position"]')) {
        event.target.form.querySelector('.su-persona-depth')?.classList.toggle('is-hidden', event.target.value !== '4');
    } else if (event.target.matches('form[data-form="chat-settings"] select[name="authorNotePosition"]')) {
        event.target.form.querySelector('.su-author-note-depth')?.classList.toggle('is-hidden', event.target.value !== '1');
    } else if (event.target.matches('form[data-form="character"] select[name="primaryLorebook"]')) {
        const form = event.target.form;
        for (const choice of form.querySelectorAll('.su-lore-choice[data-lorebook]')) {
            const isPrimary = choice.dataset.lorebook === event.target.value;
            choice.classList.toggle('is-hidden', isPrimary);
            if (isPrimary) {
                const input = choice.querySelector('input[name="extraLorebooks"]');
                if (input) input.checked = false;
                choice.classList.remove('selected');
            }
        }
        const count = form.querySelectorAll('input[name="extraLorebooks"]:checked').length;
        const counter = form.querySelector('[data-extra-lore-count]');
        if (counter) counter.textContent = `${count} ${t('selected')}`;
    } else if (event.target.matches('form[data-form="character"] input[name="extraLorebooks"]')) {
        event.target.closest('.su-lore-choice')?.classList.toggle('selected', event.target.checked);
        const count = event.target.form.querySelectorAll('input[name="extraLorebooks"]:checked').length;
        const counter = event.target.form.querySelector('[data-extra-lore-count]');
        if (counter) counter.textContent = `${count} ${t('selected')}`;
    } else if (event.target.name === 'attachments' && event.target.files?.length) {
        attachFiles(event.target.files);
        showAlert('notice', t('Attachment added'));
        queueRender();
    }
});

root?.addEventListener('toggle', event => {
    if (!event.target.matches('.su-lore-entry')) return;
    const uid = Number(event.target.dataset.uid);
    if (event.target.open) ui.expandedLoreEntries.add(uid);
    else ui.expandedLoreEntries.delete(uid);
}, true);

document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (ui.confirm && !ui.busy) ui.confirm = null;
    else if (ui.modal && !ui.busy) {
        ui.modal = null;
        ui.presetEditor = null;
        ui.globalLoreDraft = [];
    }
    else return;
    queueRender();
});

root?.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return;
    const textarea = event.target.closest('.su-composer textarea[name="message"]');
    if (!textarea || snapshot?.generating || ui.busy || !textarea.value.trim()) return;
    event.preventDefault();
    textarea.form?.requestSubmit();
});

root?.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.target;
    const data = new FormData(form);
    if (form.dataset.form === 'message') {
        const text = String(data.get('message') || '').trim();
        if (text) await run(async () => { await sendMessage(text); ui.draft = ''; });
    } else if (form.dataset.form === 'global-lorebooks') {
        await run(async () => {
            await setGlobalLorebooks(ui.globalLoreDraft);
            ui.modal = null;
            ui.globalLoreDraft = [];
        }, t('Global lorebooks updated'));
    } else if (form.dataset.form === 'preset-editor') {
        await run(async () => {
            const draft = structuredClone(ui.presetEditor.values);
            for (const field of form.querySelectorAll('[data-preset-key]')) {
                const type = field.dataset.valueType;
                let value;
                if (type === 'boolean') value = field.checked;
                else if (type === 'number') value = Number(field.value);
                else if (type === 'array' || type === 'object') {
                    try {
                        value = JSON.parse(field.value);
                    } catch {
                        throw new Error(`Invalid JSON: ${field.dataset.presetKey}`);
                    }
                    if (type === 'array' && !Array.isArray(value)) throw new Error(`Expected a list: ${field.dataset.presetKey}`);
                    if (type === 'object' && (value === null || Array.isArray(value) || typeof value !== 'object')) throw new Error(`Expected an object: ${field.dataset.presetKey}`);
                } else value = field.value;
                draft[field.dataset.presetKey] = value;
            }
            draft.prompts = structuredClone(ui.presetEditor.prompts);
            const promptOrders = Array.isArray(draft.prompt_order) ? structuredClone(draft.prompt_order) : [];
            const orderIndex = promptOrders.findIndex(entry => Number(entry?.character_id) === Number(ui.presetEditor.promptOrderCharacterId));
            const globalOrder = {
                ...(orderIndex >= 0 ? promptOrders[orderIndex] : {}),
                character_id: ui.presetEditor.promptOrderCharacterId,
                order: ui.presetEditor.promptOrder.map(entry => ({ identifier: entry.identifier, enabled: entry.enabled !== false })),
            };
            if (orderIndex >= 0) promptOrders[orderIndex] = globalOrder;
            else promptOrders.push(globalOrder);
            draft.prompt_order = promptOrders;
            await saveChatCompletionPresetDraft(ui.presetEditor.name, draft);
            ui.modal = null;
            ui.presetEditor = null;
        }, t('Preset updated'));
    } else if (form.dataset.form === 'character') {
        await run(async () => {
            const primaryLorebook = data.get('primaryLorebook');
            await saveCharacter({ id: data.get('id'), name: data.get('name'), avatar: data.get('avatar')?.size ? data.get('avatar') : null, description: data.get('description'), firstMessage: data.get('firstMessage'), personality: data.get('personality'), scenario: data.get('scenario'), exampleMessages: data.get('exampleMessages'), tags: data.get('tags'), alternateGreetings: String(data.get('alternateGreetings') || '').split(/\n\s*---\s*\n/).map(value => value.trim()).filter(Boolean), systemPrompt: data.get('systemPrompt'), postHistoryInstructions: data.get('postHistoryInstructions'), depthPrompt: data.get('depthPrompt'), depthPromptDepth: data.get('depthPromptDepth'), depthPromptRole: data.get('depthPromptRole'), primaryLorebook, extraLorebooks: data.getAll('extraLorebooks').filter(name => name !== primaryLorebook) });
            ui.modal = null;
        }, t('Character saved'));
    } else if (form.dataset.form === 'persona') {
        await run(async () => { await savePersona({ avatar: data.get('avatar'), image: data.get('image')?.size ? data.get('image') : null, name: data.get('name'), title: data.get('title'), description: data.get('description'), position: data.get('position'), depth: data.get('depth'), role: data.get('role'), lorebook: data.get('lorebook') }); ui.modal = null; }, t('Profile saved'));
    } else if (form.dataset.form === 'edit-message') {
        await run(async () => { await updateMessage(Number(data.get('id')), data.get('text')); ui.modal = null; });
    } else if (form.dataset.form === 'lorebook') {
        for (const fieldset of form.querySelectorAll('.su-lore-entry')) {
            const entry = ui.lore.entries[fieldset.dataset.uid];
            entry.comment = fieldset.querySelector('[data-field="comment"]').value;
            entry.key = fieldset.querySelector('[data-field="key"]').value.split(',').map(value => value.trim()).filter(Boolean);
            entry.content = fieldset.querySelector('[data-field="content"]').value;
            entry.constant = fieldset.querySelector('[data-field="constant"]').checked;
            entry.disable = fieldset.querySelector('[data-field="disable"]').checked;
        }
        await run(async () => { await saveLorebook(String(data.get('name')).trim(), ui.lore); ui.modal = null; }, t('Lorebook saved'));
    } else if (form.dataset.form === 'chat-settings') {
        await run(async () => { await saveChatSettings({ lorebook: data.get('lorebook'), authorNote: data.get('authorNote'), authorNoteInterval: data.get('authorNoteInterval'), authorNotePosition: data.get('authorNotePosition'), authorNoteDepth: data.get('authorNoteDepth'), authorNoteRole: data.get('authorNoteRole'), scenario: data.get('scenario'), exampleMessages: data.get('exampleMessages'), systemPrompt: data.get('systemPrompt') }); ui.modal = null; }, t('Chat settings saved'));
    } else if (form.dataset.form === 'connection') {
        setAutoConnect(data.get('autoConnect') === 'on', { reconnect: false });
        await run(() => connect({ family: data.get('family'), provider: data.get('provider'), apiKey: data.get('apiKey'), url: data.get('url'), model: data.get('customModel') || data.get('model') }), t('Connection settings applied'));
    } else if (form.dataset.form === 'preset-save-as') {
        await run(async () => {
            await saveChatCompletionPresetAs(data.get('presetName'));
            form.reset();
        }, t('Preset saved'));
    }
});

legacyButton?.addEventListener('click', () => setMode('minimal'));

subscribe(nextSnapshot => {
    snapshot = nextSnapshot;
    // Replacing an open form makes the focused field and its unsaved value disappear.
    // Keep the modal DOM stable while background EasierTavern events update the snapshot.
    if (ui.modal && root?.querySelector('.su-modal')) return;
    queueRender();
});

