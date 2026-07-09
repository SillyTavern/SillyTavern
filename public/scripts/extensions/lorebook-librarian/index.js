import { chat_metadata, getMaxContextSize, saveSettingsDebounced } from '../../../script.js';
import { extension_settings, getContext, renderExtensionTemplateAsync } from '../../extensions.js';
import { event_types, eventSource } from '../../events.js';
import { SlashCommand } from '../../slash-commands/SlashCommand.js';
import { SlashCommandParser } from '../../slash-commands/SlashCommandParser.js';
import { checkWorldInfo, selected_world_info } from '../../world-info.js';
import { ConnectionManagerRequestService } from '../shared.js';

const MODULE_NAME = 'lorebook-librarian';
const SETTINGS_KEY = 'lorebookLibrarian';
const ALLOWED_OPERATIONS = new Set(['update_content', 'append_content', 'update_keys']);

const defaultSettings = {
    summaryProfileId: '',
    messageCount: 3,
    maxResponseTokens: 1024,
    debugVisible: true,
    excerptLength: 1600,
};

const state = {
    isRunning: false,
    lastDiagnostics: {},
};

function getSettings() {
    if (!extension_settings[SETTINGS_KEY]) {
        extension_settings[SETTINGS_KEY] = {};
    }

    for (const [key, value] of Object.entries(defaultSettings)) {
        if (extension_settings[SETTINGS_KEY][key] === undefined) {
            extension_settings[SETTINGS_KEY][key] = value;
        }
    }

    return extension_settings[SETTINGS_KEY];
}

function persistSettings() {
    Object.assign(extension_settings[SETTINGS_KEY], getSettings());
    saveSettingsDebounced();
}

function getConnectionProfiles() {
    return extension_settings.connectionManager?.profiles ?? [];
}

function isConnectionManagerAvailable() {
    return !extension_settings.disabledExtensions?.includes('connection-manager')
        && Array.isArray(extension_settings.connectionManager?.profiles);
}

function getProfile(profileId) {
    return getConnectionProfiles().find(profile => profile.id === profileId);
}

function getProfileApiMap(profile) {
    const context = getContext();
    return profile?.api ? context.CONNECT_API_MAP?.[profile.api] : null;
}

function isChatCompletionProfile(profile) {
    const apiMap = getProfileApiMap(profile);
    return apiMap?.selected === 'openai' && Boolean(apiMap.source);
}

function getChatCompletionProfiles() {
    return getConnectionProfiles().filter(isChatCompletionProfile);
}

function populateProfileDropdown() {
    const settings = getSettings();
    const profiles = getChatCompletionProfiles();
    const select = $('#lorebook_librarian_profile');

    if (!select.length) {
        return;
    }

    select.empty();
    select.append($('<option></option>').val('').text('Select a Chat Completion profile'));

    for (const profile of profiles.sort((a, b) => String(a.name).localeCompare(String(b.name)))) {
        select.append($('<option></option>').val(profile.id).text(profile.name || profile.id));
    }

    if (settings.summaryProfileId && profiles.some(profile => profile.id === settings.summaryProfileId)) {
        select.val(settings.summaryProfileId);
    } else {
        settings.summaryProfileId = '';
        select.val('');
    }
}

function loadSettingsIntoUI() {
    const settings = getSettings();
    populateProfileDropdown();
    $('#lorebook_librarian_message_count').val(settings.messageCount);
    $('#lorebook_librarian_max_tokens').val(settings.maxResponseTokens);
    $('#lorebook_librarian_debug_visible').prop('checked', settings.debugVisible);
    $('#lorebook_librarian_debug').prop('open', settings.debugVisible);
}

function bindSettingsListeners() {
    $('#lorebook_librarian_profile').on('change', function () {
        getSettings().summaryProfileId = String($(this).val() || '');
        persistSettings();
    });

    $('#lorebook_librarian_message_count').on('input', function () {
        getSettings().messageCount = clampInteger(Number($(this).val()), 1, 25, defaultSettings.messageCount);
        persistSettings();
    });

    $('#lorebook_librarian_max_tokens').on('input', function () {
        getSettings().maxResponseTokens = clampInteger(Number($(this).val()), 128, 8192, defaultSettings.maxResponseTokens);
        persistSettings();
    });

    $('#lorebook_librarian_debug_visible').on('input', function () {
        getSettings().debugVisible = Boolean($(this).prop('checked'));
        $('#lorebook_librarian_debug').prop('open', getSettings().debugVisible);
        persistSettings();
    });

    $('#lorebook_librarian_run').on('click', () => runLibrarian('settings-button'));
    $('#lorebook_librarian_refresh_profiles').on('click', populateProfileDropdown);
}

function clampInteger(value, min, max, fallback) {
    if (!Number.isInteger(value)) {
        return fallback;
    }

    return Math.min(max, Math.max(min, value));
}

function setStatus(message, stateName = 'idle') {
    $('#lorebook_librarian_status')
        .attr('data-state', stateName)
        .text(message);
}

function clearResults() {
    $('#lorebook_librarian_results').empty();
}

function collectAssistantMessages(context, count) {
    return context.chat
        .filter(message => !message.is_user && !message.is_system && String(message.mes || '').trim())
        .slice(-count)
        .map(message => String(message.mes).trim())
        .reverse();
}

function normalizeActivatedEntries(allActivatedEntries, excerptLength) {
    const entries = allActivatedEntries instanceof Set
        ? [...allActivatedEntries]
        : allActivatedEntries instanceof Map
            ? [...allActivatedEntries.values()]
            : Array.isArray(allActivatedEntries)
                ? allActivatedEntries
                : [];

    return entries.map(entry => ({
        world: String(entry.world ?? ''),
        uid: entry.uid,
        title: String(entry.comment || entry.key?.[0] || `Entry ${entry.uid}`),
        key: Array.isArray(entry.key) ? entry.key : [],
        keysecondary: Array.isArray(entry.keysecondary) ? entry.keysecondary : [],
        content: String(entry.content || ''),
        contentExcerpt: excerpt(String(entry.content || ''), excerptLength),
        position: entry.position,
        depth: entry.depth,
        order: entry.order,
    }));
}

function excerpt(text, maxLength) {
    if (text.length <= maxLength) {
        return text;
    }

    return `${text.slice(0, maxLength).trimEnd()}\n[...truncated ${text.length - maxLength} chars]`;
}

function buildMessages(recentMessages, activatedEntries) {
    const systemPrompt = [
        'You are Lorebook Librarian, a read-only assistant for maintaining SillyTavern lorebook entries.',
        'The lorebook entries are authoritative canon. Recent assistant messages are only drift evidence.',
        'Propose edits only for existing entries included in the canon slice.',
        'Do not create, delete, disable, merge, or split entries.',
        'Return only valid JSON. Do not wrap it in Markdown unless unavoidable.',
    ].join('\n');

    const canon = activatedEntries.map(entry => [
        `World: ${entry.world}`,
        `Entry UID: ${entry.uid}`,
        `Title: ${entry.title}`,
        `Primary keys: ${entry.key.join(', ') || '(none)'}`,
        `Secondary keys: ${entry.keysecondary.join(', ') || '(none)'}`,
        'Content:',
        entry.contentExcerpt,
    ].join('\n')).join('\n\n---\n\n');

    const evidence = recentMessages
        .map((message, index) => `Assistant message ${index + 1} (newest-first scan order):\n${message}`)
        .join('\n\n---\n\n');

    const userPrompt = [
        'Review the activated lorebook entries against the recent assistant messages.',
        'Suggest only these operations: update_content, append_content, update_keys.',
        'Every proposal must include world and entryUid from the canon slice.',
        'If no edits are warranted, return {"proposals":[]}.',
        '',
        'Required JSON shape:',
        '{"proposals":[{"world":"string","entryUid":0,"entryTitle":"string","operation":"update_content|append_content|update_keys","reason":"string","proposedText":"string","proposedKeys":["string"]}]}',
        '',
        'Activated lorebook entries:',
        canon,
        '',
        'Recent assistant messages:',
        evidence,
    ].join('\n');

    return [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
    ];
}

function getRawTextFromResult(result) {
    if (typeof result === 'string') {
        return result;
    }

    if (typeof result?.content === 'string') {
        return result.content;
    }

    if (typeof result?.text === 'string') {
        return result.text;
    }

    if (typeof result?.message?.content === 'string') {
        return result.message.content;
    }

    return JSON.stringify(result ?? '');
}

function parseProposalJson(rawText) {
    try {
        return JSON.parse(rawText);
    } catch {
        const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (fenced?.[1]) {
            return JSON.parse(fenced[1]);
        }

        throw new Error('Malformed JSON response');
    }
}

function validateProposals(parsed, activatedEntries) {
    const proposals = Array.isArray(parsed?.proposals) ? parsed.proposals : [];
    const activatedKeys = new Set(activatedEntries.map(entry => `${entry.world}.${entry.uid}`));
    const valid = [];
    const rejected = [];

    for (const proposal of proposals) {
        const normalized = {
            world: String(proposal.world ?? ''),
            entryUid: proposal.entryUid,
            entryTitle: String(proposal.entryTitle ?? ''),
            operation: String(proposal.operation ?? ''),
            reason: String(proposal.reason ?? ''),
            proposedText: String(proposal.proposedText ?? ''),
            proposedKeys: Array.isArray(proposal.proposedKeys) ? proposal.proposedKeys.map(String) : [],
        };
        const errors = [];

        if (!ALLOWED_OPERATIONS.has(normalized.operation)) {
            errors.push(`Unsupported operation: ${normalized.operation || '(empty)'}`);
        }

        if (!activatedKeys.has(`${normalized.world}.${normalized.entryUid}`)) {
            errors.push(`Proposal target is not an activated entry: ${normalized.world}.${normalized.entryUid}`);
        }

        if (errors.length) {
            rejected.push({ proposal: normalized, errors });
        } else {
            valid.push(normalized);
        }
    }

    return { proposals: valid, rejected };
}

function renderResults(validation, rawText) {
    const container = $('#lorebook_librarian_results');
    container.empty();

    if (!validation.proposals.length && !validation.rejected.length) {
        container.append($('<div class="lorebook-librarian-card"></div>').text('No proposals returned.'));
    }

    for (const proposal of validation.proposals) {
        const card = $('<div class="lorebook-librarian-card"></div>');
        const header = $('<div class="lorebook-librarian-card-header"></div>');
        header.append($('<b></b>').text(proposal.entryTitle || `${proposal.world}.${proposal.entryUid}`));
        header.append($('<span class="lorebook-librarian-chip"></span>').text(proposal.operation));
        header.append($('<span class="lorebook-librarian-chip"></span>').text(`${proposal.world}.${proposal.entryUid}`));
        card.append(header);
        card.append($('<div></div>').text(proposal.reason || 'No reason provided.'));

        if (proposal.proposedText) {
            card.append($('<pre></pre>').text(proposal.proposedText));
        }

        if (proposal.proposedKeys.length) {
            card.append($('<div></div>').text(`Proposed keys: ${proposal.proposedKeys.join(', ')}`));
        }

        container.append(card);
    }

    for (const rejected of validation.rejected) {
        const card = $('<div class="lorebook-librarian-card"></div>');
        card.append($('<b></b>').text('Rejected proposal'));
        card.append($('<div></div>').text(rejected.errors.join('; ')));
        card.append($('<pre></pre>').text(JSON.stringify(rejected.proposal, null, 4)));
        container.append(card);
    }

    const rawCard = $('<details class="lorebook-librarian-card"></details>');
    rawCard.append($('<summary></summary>').text('Raw model response'));
    rawCard.append($('<pre></pre>').text(rawText));
    container.append(rawCard);
}

function renderDiagnostics(diagnostics) {
    state.lastDiagnostics = diagnostics;
    $('#lorebook_librarian_debug_output').text(JSON.stringify(diagnostics, null, 4));
}

function getPublicProfileDiagnostics(profile) {
    if (!profile) {
        return null;
    }

    const apiMap = getProfileApiMap(profile);
    return {
        id: profile.id,
        name: profile.name,
        api: profile.api,
        model: profile.model,
        source: apiMap?.source,
        selected: apiMap?.selected,
        hasCustomUrl: Boolean(profile['api-url']),
        preset: profile.preset,
    };
}

function buildContextDiagnostics(context) {
    return {
        name1: context.name1,
        name2: context.name2,
        characterId: context.characterId,
        groupId: context.groupId,
        chatId: context.chatId,
    };
}

function cloneValue(value) {
    if (value === undefined) {
        return undefined;
    }

    if (value === null || typeof value !== 'object') {
        return value;
    }

    if (Array.isArray(value)) {
        return value.map(cloneValue);
    }

    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)]));
}

function restoreObject(target, snapshot) {
    for (const key of Object.keys(target)) {
        delete target[key];
    }

    if (!snapshot) {
        return;
    }

    Object.assign(target, snapshot);
}

async function runWorldInfoDryScan(recentMessages, maxContext) {
    const context = getContext();
    const timedWorldInfoSnapshot = cloneValue(chat_metadata.timedWorldInfo);
    const extensionPromptsSnapshot = cloneValue(context.extensionPrompts);

    try {
        return await checkWorldInfo(recentMessages, maxContext, true);
    } finally {
        if (timedWorldInfoSnapshot === undefined) {
            delete chat_metadata.timedWorldInfo;
        } else {
            chat_metadata.timedWorldInfo = timedWorldInfoSnapshot;
        }

        restoreObject(context.extensionPrompts, extensionPromptsSnapshot);
    }
}

async function runLibrarian(trigger = 'manual') {
    if (state.isRunning) {
        toastr.info('Lorebook Librarian is already running.');
        return '';
    }

    state.isRunning = true;
    clearResults();
    setStatus('Running Lorebook Librarian...', 'idle');

    const diagnostics = {
        trigger,
        settings: { ...getSettings() },
        context: null,
        recentMessages: [],
        activeWorldNames: [],
        activatedEntries: [],
        requestMessages: [],
        profile: null,
        rawText: '',
        parsed: null,
        validation: null,
        error: null,
    };

    try {
        const settings = getSettings();
        const context = getContext();
        diagnostics.context = buildContextDiagnostics(context);
        diagnostics.activeWorldNames = [...selected_world_info];

        if (!Array.isArray(context.chat) || context.chat.length === 0) {
            throw new Error('No active chat.');
        }

        if (!isConnectionManagerAvailable()) {
            throw new Error('Connection Manager is not available.');
        }

        if (!settings.summaryProfileId) {
            throw new Error('Select a Chat Completion connection profile for Lorebook Librarian.');
        }

        const profile = getProfile(settings.summaryProfileId);
        diagnostics.profile = getPublicProfileDiagnostics(profile);

        if (!isChatCompletionProfile(profile)) {
            throw new Error('Selected profile is not a Chat Completion profile.');
        }

        const recentMessages = collectAssistantMessages(context, settings.messageCount);
        diagnostics.recentMessages = recentMessages;

        if (!recentMessages.length) {
            throw new Error('No assistant messages found in the current chat.');
        }

        const maxContext = getMaxContextSize();
        const worldInfoResult = await runWorldInfoDryScan(recentMessages, maxContext);
        const activatedEntries = normalizeActivatedEntries(worldInfoResult.allActivatedEntries, settings.excerptLength);
        diagnostics.maxContext = maxContext;
        diagnostics.activatedEntries = activatedEntries;
        diagnostics.activeWorldNames = [...new Set([...diagnostics.activeWorldNames, ...activatedEntries.map(entry => entry.world).filter(Boolean)])];

        if (!activatedEntries.length) {
            throw new Error('No relevant active lorebook entries were found.');
        }

        const requestMessages = buildMessages(recentMessages, activatedEntries);
        diagnostics.requestMessages = requestMessages;

        const result = await ConnectionManagerRequestService.sendRequest(
            settings.summaryProfileId,
            requestMessages,
            settings.maxResponseTokens,
            {
                stream: false,
                extractData: true,
                includePreset: true,
                includeInstruct: false,
            },
        );

        const rawText = getRawTextFromResult(result);
        diagnostics.rawText = rawText;
        diagnostics.rawResultShape = result && typeof result === 'object' ? Object.keys(result) : typeof result;

        const parsed = parseProposalJson(rawText);
        diagnostics.parsed = parsed;

        const validation = validateProposals(parsed, activatedEntries);
        diagnostics.validation = validation;

        renderResults(validation, rawText);
        setStatus(`Generated ${validation.proposals.length} valid proposal(s). No lorebook writes were performed.`, 'success');
        toastr.success('Lorebook Librarian proposal run complete.');
    } catch (error) {
        diagnostics.error = {
            message: error.message,
            cause: error.cause?.message,
            stack: error.stack,
        };
        setStatus(error.message, 'error');
        clearResults();
        toastr.error(error.message, 'Lorebook Librarian');
    } finally {
        renderDiagnostics(diagnostics);
        state.isRunning = false;
    }

    return '';
}

function registerSlashCommand() {
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lorelibrarian',
        callback: async () => {
            await runLibrarian('slash-command');
            return '';
        },
        helpString: 'Runs Lorebook Librarian against recent assistant messages and displays read-only lorebook edit proposals.',
    }));
}

function addWorldInfoButton() {
    if ($('#lorebook_librarian_world_button').length) {
        return;
    }

    const button = $(`
        <div id="lorebook_librarian_world_button" class="menu_button fa-solid fa-book-open-reader lorebook-librarian-world-button" title="Run Lorebook Librarian"></div>
    `);

    const anchor = $('#world_backfill_memos');
    if (anchor.length) {
        anchor.after(button);
    } else {
        $('#world_popup .flex-container.alignitemscenter').eq(1).prepend(button);
    }

    button.on('click', () => runLibrarian('world-info-button'));
}

jQuery(async () => {
    getSettings();

    try {
        const html = await renderExtensionTemplateAsync(MODULE_NAME, 'index');
        $('#extensions_settings').append(html);
        loadSettingsIntoUI();
        bindSettingsListeners();
        addWorldInfoButton();
    } catch (error) {
        console.error('[Lorebook Librarian] Failed to render extension UI:', error);
        toastr.error('Failed to render Lorebook Librarian UI.');
    }

    eventSource.on(event_types.CONNECTION_PROFILE_CREATED, populateProfileDropdown);
    eventSource.on(event_types.CONNECTION_PROFILE_DELETED, populateProfileDropdown);
    eventSource.on(event_types.CONNECTION_PROFILE_UPDATED, populateProfileDropdown);

    registerSlashCommand();
    console.log('[Lorebook Librarian] Loaded.');
});
